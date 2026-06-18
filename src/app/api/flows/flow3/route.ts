import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { corsair } from "~/server/corsair";

function buildRawEmail({ to, subject, body, threadId }: {
  to: string; subject: string; body: string; threadId?: string;
}): string {
  const lines = [`To: ${to}`, `Subject: ${subject}`, `Content-Type: text/plain; charset=utf-8`, `MIME-Version: 1.0`, ``, body];
  return Buffer.from(lines.join("\r\n")).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      threadId: string; from: string; fromEmail: string;
      subject: string; proposedStart: string; proposedEnd: string;
    };

    const { threadId, from, fromEmail, subject, proposedStart, proposedEnd } = body;
    // @ts-ignore
    const tenant = corsair.withTenant("default");
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    // Step 1: Check calendar for conflicts
    let hasConflict = false;
    try {
      // @ts-ignore
      const events = await tenant.googlecalendar.api.events.getMany({
        calendarId: "primary",
        timeMin: proposedStart,
        timeMax: proposedEnd,
        singleEvents: true,
      });
      hasConflict = (events?.items ?? []).length > 0;
      results.conflictCheck = { hasConflict, conflictCount: (events?.items ?? []).length };
    } catch (err) {
      console.error("[flow3] calendar check error:", err);
      errors.calendarCheck = err instanceof Error ? err.message : "Failed";
    }

    // Step 2: Log conflict to Notion
    if (hasConflict) {
      try {
        // @ts-ignore
        await tenant.notion.api.pages.create({
          parent: { type: "database_id", database_id: "nudgehq-conflicts" },
          properties: {
            title: { title: [{ text: { content: `Conflict: ${subject}` } }] },
            Status: { select: { name: "Needs Reschedule" } },
          },
          children: [{
            object: "block", type: "paragraph",
            paragraph: { rich_text: [{ text: { content: `From: ${from}\nProposed: ${proposedStart} → ${proposedEnd}\nConflict detected.` } }] },
          }],
        });
        results.notion = { conflictLogged: true };
      } catch (err) {
        console.error("[flow3] notion error:", err);
        errors.notion = err instanceof Error ? err.message : "Failed";
      }

      // Step 3: Draft reschedule email
      try {
        const firstName = from.split(" ")[0] ?? from;
        const rawEmail = buildRawEmail({
          to: fromEmail,
          subject: `Re: ${subject} — Reschedule needed`,
          body: `Hi ${firstName},\n\nThank you for the meeting invite. Unfortunately, I have a conflict during the proposed time.\n\nCould we reschedule? I'm available at the following times:\n- Tomorrow at 10 AM\n- Day after tomorrow at 2 PM\n\nPlease let me know what works best for you.\n\nBest regards`,
          threadId,
        });
        // @ts-ignore
        await tenant.gmail.api.drafts.create({ draft: { message: { raw: rawEmail, threadId } } });
        results.gmail = { rescheduleDraft: true };
      } catch (err) {
        console.error("[flow3] gmail error:", err);
        errors.gmail = err instanceof Error ? err.message : "Failed";
      }
    }

    // Step 4: Notify Slack
    try {
      // @ts-ignore
      await tenant.slack.api.messages.post({
        channel: process.env.SLACK_CHANNEL_ID!,
        text: `⚡ *Flow 3 triggered*
*Meeting invite from:* ${from}
*Subject:* ${subject}
*Conflict detected:* ${hasConflict ? "Yes ⚠️" : "No ✓"}`,
        mrkdwn: true,
      });
      results.slack = { notified: true };
    } catch (err) {
      console.error("[flow3] slack error:", err);
      errors.slack = err instanceof Error ? err.message : "Failed";
    }

    return NextResponse.json({
      success: Object.keys(errors).length === 0,
      message: `Flow 3 complete — conflict ${hasConflict ? "detected" : "not found"}`,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: "Flow 3 failed", details: String(err) }, { status: 500 });
  }
}
