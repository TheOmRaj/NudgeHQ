import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { corsair } from "~/server/corsair";

function buildRawEmail({ to, subject, body, threadId }: {
  to: string; subject: string; body: string; threadId?: string;
}): string {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset=utf-8`,
    `MIME-Version: 1.0`,
    ``,
    body,
  ];
  return Buffer.from(lines.join("\r\n"))
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      threadId: string; from: string; fromEmail: string;
      subject: string; snippet: string; daysSinceEmail?: number;
    };

    const { threadId, from, fromEmail, subject, snippet, daysSinceEmail = 3 } = body;
    // @ts-ignore
    const tenant = corsair.withTenant("default");
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    // Step 1: Log to Notion database
    try {
      // @ts-ignore
      await tenant.notion.api.databasePages.createDatabasePage({
        database_id: "38117f0d3c318091aca8e1cdac5e0113",
        properties: {
          Status: {
            title: [{ text: { content: `Follow-up: ${subject}` } }],
          },
          From: {
            rich_text: [{ text: { content: `${from} <${fromEmail}>` } }],
          },
          Subject: {
            rich_text: [{ text: { content: subject } }],
          },
        },
      });
      results.notion = { logged: true };
    } catch (err) {
      console.error("[flow2] notion error:", err);
      errors.notion = err instanceof Error ? err.message : "Failed";
    }

    // Step 2: Add calendar reminder tomorrow 9AM
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);
      const end = new Date(tomorrow.getTime() + 15 * 60 * 1000);

      // @ts-ignore
      await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        event: {
          summary: `⚡ Follow-up reminder: ${subject}`,
          description: `NudgeHQ Flow 2: No reply from ${from} after ${daysSinceEmail} days`,
          start: { dateTime: tomorrow.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      });
      results.calendar = { reminder: true };
    } catch (err) {
      console.error("[flow2] calendar error:", err);
      errors.calendar = err instanceof Error ? err.message : "Failed";
    }

    // Step 3: Draft follow-up email
    try {
      const firstName = from.split(" ")[0] ?? from;
      const rawEmail = buildRawEmail({
        to: fromEmail,
        subject: `Re: ${subject}`,
        body: `Hi ${firstName},\n\nI wanted to follow up on my previous email regarding "${subject}". Please let me know if you had a chance to review it.\n\nLooking forward to your response.\n\nBest regards`,
        threadId,
      });
      // @ts-ignore
      await tenant.gmail.api.drafts.create({
        draft: {
          message: {
            raw: rawEmail,
          },
        },
      });
      results.gmail = { followUpDraft: true };
    } catch (err) {
      console.error("[flow2] gmail error:", err);
      errors.gmail = err instanceof Error ? err.message : "Failed";
    }

    // Step 4: Notify Slack
    try {
      // @ts-ignore
      await tenant.slack.api.messages.post({
        channel: process.env.SLACK_CHANNEL_ID!,
        text: `⚡ *Flow 2 triggered*
*No reply from:* ${from} <${fromEmail}>
*Subject:* ${subject}
*After:* ${daysSinceEmail} days
*Actions:* Notion logged ✓ · Calendar reminder ✓ · Follow-up draft ✓`,
        mrkdwn: true,
      });
      results.slack = { notified: true };
    } catch (err) {
      console.error("[flow2] slack error:", err);
      errors.slack = err instanceof Error ? err.message : "Failed";
    }

    return NextResponse.json({
      success: Object.keys(errors).length === 0,
      message: `Flow 2 complete`,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: "Flow 2 failed", details: String(err) }, { status: 500 });
  }
}
