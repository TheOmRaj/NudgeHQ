import { type NextRequest, NextResponse } from "next/server";
import { createCorsair } from "corsair";
import { Pool } from "pg";
import { gmail } from "@corsair-dev/gmail";
import { googlecalendar } from "@corsair-dev/googlecalendar";
import { googledrive } from "@corsair-dev/googledrive";
import { slack } from "@corsair-dev/slack";
import { notion } from "@corsair-dev/notion";
import { todoist } from "@corsair-dev/todoist";
import { zoom } from "@corsair-dev/zoom";
import { hubspot } from "@corsair-dev/hubspot";
import Groq from "groq-sdk";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const corsair = createCorsair({
  multiTenancy: true,
  database: pool,
  kek: process.env.CORSAIR_KEK!,
  plugins: [gmail(), googlecalendar(), googledrive(), slack(), notion(), todoist(), zoom(), hubspot()],
}) as any;

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

function buildRawEmail({ to, subject, body }: { to: string; subject: string; body: string }): string {
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
    const body = await req.json() as { message?: { data?: string } };

    // Pub/Sub sends base64-encoded message data
    const messageData = body?.message?.data;
    if (!messageData) {
      return NextResponse.json({ ok: true }); // ACK empty messages
    }

    // Decode the Pub/Sub message
    const decoded = Buffer.from(messageData, "base64").toString("utf-8");
    console.log("[webhook/gmail] Pub/Sub message:", decoded);

    const notification = JSON.parse(decoded) as { emailAddress?: string; historyId?: string };
    const userEmail = notification.emailAddress;

    if (!userEmail) {
      return NextResponse.json({ ok: true });
    }

    console.log(`[webhook/gmail] New email notification for ${userEmail}, historyId: ${notification.historyId}`);

    // Get the latest unread important email
    const tenant = corsair.withTenant("default");

    const listResult = await tenant.gmail.api.messages.list({
      q: "is:unread is:important",
      maxResults: 1,
    });

    const messages = listResult?.messages ?? [];
    if (messages.length === 0) {
      console.log("[webhook/gmail] No unread important emails found");
      return NextResponse.json({ ok: true });
    }

    const msg = await tenant.gmail.api.messages.get({
      id: messages[0].id as string,
      format: "full",
    });

    // Extract email details
    const headers: Record<string, string> = {};
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (msg.payload?.headers ?? []).forEach((h: any) => {
      headers[(h.name as string).toLowerCase()] = h.value as string;
    });

    const from = headers["from"] ?? "";
    const nameMatch = from.match(/^(.+?)\s*</);
    const fromName = nameMatch?.[1]?.replace(/"/g, "").trim() ?? from.split("@")[0] ?? from;
    const emailMatch = from.match(/<(.+?)>/);
    const fromEmail = emailMatch?.[1] ?? from;
    const subject = headers["subject"] ?? "(no subject)";
    const snippet = (msg.snippet as string) ?? "";
    const messageId = msg.id as string;
    const threadId = msg.threadId as string;

    console.log(`[webhook/gmail] Triggering Flow 1 for: ${subject} from ${fromEmail}`);

    // ── Flow 1: Inbound Email Automation ──────────────────────────────────────

    // Step 1 — AI summary via Groq
    const aiRes = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content: "You are an email assistant. Given an email subject and snippet, write a concise 1-sentence action summary for a Todoist task. Be direct and actionable.",
        },
        {
          role: "user",
          content: `Subject: ${subject}\nSnippet: ${snippet}`,
        },
      ],
      max_tokens: 100,
    });
    const taskDescription = aiRes.choices[0]?.message?.content ?? snippet;

    // Step 2 — Create Todoist task
    try {
      await tenant.todoist.api.tasks.create({
        content: `📧 ${subject}`,
        description: `From: ${fromName} (${fromEmail})\n\n${taskDescription}`,
        priority: 3,
        due_string: "today",
      });
      console.log("[webhook/gmail] Flow 1: Todoist task created");
    } catch (err) {
      console.error("[webhook/gmail] Flow 1: Todoist failed", err);
    }

    // Step 3 — Create Gmail draft reply
    try {
      const draftBody = `Hi ${fromName},\n\nThank you for your email regarding "${subject}". I've received your message and will get back to you shortly.\n\nBest regards`;
      await tenant.gmail.api.drafts.create({
        message: {
          raw: buildRawEmail({ to: fromEmail, subject: `Re: ${subject}`, body: draftBody }),
          threadId,
        },
      });
      console.log("[webhook/gmail] Flow 1: Gmail draft created");
    } catch (err) {
      console.error("[webhook/gmail] Flow 1: Gmail draft failed", err);
    }

    // Step 4 — Block calendar time
    try {
      const start = new Date();
      start.setHours(start.getHours() + 1, 0, 0, 0);
      const end = new Date(start);
      end.setMinutes(end.getMinutes() + 30);

      await tenant.googlecalendar.api.events.create({
        calendarId: "primary",
        event: {
          summary: `📧 Review: ${subject}`,
          start: { dateTime: start.toISOString() },
          end: { dateTime: end.toISOString() },
        },
      });
      console.log("[webhook/gmail] Flow 1: Calendar blocked");
    } catch (err) {
      console.error("[webhook/gmail] Flow 1: Calendar failed", err);
    }

    // Step 5 — Slack notification
    try {
      await tenant.slack.api.messages.post({
        channel: process.env.SLACK_CHANNEL_ID!,
        text: `🔔 *New important email detected!*\n*From:* ${fromName} (${fromEmail})\n*Subject:* ${subject}\n*Summary:* ${taskDescription}\n\n_Flow 1 triggered automatically via Pub/Sub_ ⚡`,
        mrkdwn: true,
      });
      console.log("[webhook/gmail] Flow 1: Slack notified");
    } catch (err) {
      console.error("[webhook/gmail] Flow 1: Slack failed", err);
    }

    // Mark email as read
    try {
      await tenant.gmail.api.messages.modify({
        id: messageId,
        removeLabelIds: ["UNREAD"],
      });
    } catch (err) {
      console.error("[webhook/gmail] markRead failed", err);
    }

    console.log("[webhook/gmail] Flow 1 complete ✅");
    return NextResponse.json({ ok: true });

  } catch (err) {
    console.error("[webhook/gmail] Error:", err);
    // Always return 200 to ACK the Pub/Sub message — otherwise it will retry
    return NextResponse.json({ ok: true });
  }
}
