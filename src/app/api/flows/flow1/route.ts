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
  const raw = lines.join("\r\n");
  return Buffer.from(raw)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      emailId: string;
      threadId: string;
      from: string;
      fromEmail: string;
      subject: string;
      snippet: string;
      slackChannel?: string;
    };

    const { threadId, from, fromEmail, subject, snippet } = body;

    // @ts-ignore
    const tenant = corsair.withTenant(userId);
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    // ── Step 1: Create Todoist task ────────────────────────────────────────────
    try {
      // @ts-ignore
      const task = await tenant.todoist.api.tasks.create({
        content: `Reply to: ${subject}`,
        description: `From: ${from} <${fromEmail}>\n\nSnippet: ${snippet}`,
        priority: 3,
        due_string: "today",
      });
      results.todoist = { id: task.id, content: task.content };
    } catch (err) {
      console.error("[flow1] todoist error:", err);
      errors.todoist = err instanceof Error ? err.message : "Failed";
    }

    // ── Step 2: Draft Gmail reply (RFC 2822 base64url) ─────────────────────────
    try {
      const firstName = from.split(" ")[0] ?? from;
      const replyBody = `Hi ${firstName},\n\nThank you for reaching out. I've received your email and will get back to you shortly.\n\nBest regards`;
      const rawEmail = buildRawEmail({
        to: fromEmail,
        subject: `Re: ${subject}`,
        body: replyBody,
        threadId,
      });

      // @ts-ignore
      const draft = await tenant.gmail.api.drafts.create({
        message: {
          raw: rawEmail,
          threadId,
        },
      });
      results.gmail = { draftId: draft.id };
    } catch (err) {
      console.error("[flow1] gmail draft error:", err);
      errors.gmail = err instanceof Error ? err.message : "Failed";
    }

    // ── Step 3: Block 30min on Calendar ───────────────────────────────────────
    try {
      const now = new Date();
      const start = new Date(now);
      start.setMinutes(Math.ceil(start.getMinutes() / 30) * 30 + 30, 0, 0);
      const end = new Date(start.getTime() + 30 * 60 * 1000);

      // @ts-ignore
      const event = await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        event: {
          summary: `⚡ Follow up: ${subject}`,
          description: `Auto-blocked by NudgeHQ Flow 1\nEmail from: ${from} <${fromEmail}>`,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      });
      results.calendar = { eventId: event.id, start: start.toISOString() };
    } catch (err) {
      console.error("[flow1] calendar error:", err);
      errors.calendar = err instanceof Error ? err.message : "Failed";
    }

    // ── Step 4: Notify Slack ──────────────────────────────────────────────────
    try {
      // @ts-ignore
      await tenant.slack.api.messages.post({
        channel: process.env.SLACK_CHANNEL_ID!,
        text: `⚡ *Flow 1 triggered*\n*From:* ${from} <${fromEmail}>\n*Subject:* ${subject}\n*Actions:* Todoist task ✓ · Gmail draft ✓ · Calendar blocked ✓`,
        mrkdwn: true,
      });
      results.slack = { notified: true };
    } catch (err) {
      console.error("[flow1] slack error:", err);
      errors.slack = err instanceof Error ? err.message : "Failed";
    }

    const successCount = Object.keys(results).length;
    const errorCount = Object.keys(errors).length;

    return NextResponse.json({
      success: errorCount === 0,
      message: `Flow 1 complete — ${successCount} actions succeeded${errorCount > 0 ? `, ${errorCount} failed` : ""}`,
      results,
      errors: errorCount > 0 ? errors : undefined,
    });

  } catch (err) {
    console.error("[flow1] fatal error:", err);
    return NextResponse.json({ error: "Flow 1 failed", details: String(err) }, { status: 500 });
  }
}
