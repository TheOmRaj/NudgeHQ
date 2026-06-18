import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { corsair } from "~/server/corsair";

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json() as {
      messageId: string; from: string; fromEmail: string;
      subject: string; attachmentName: string; attachmentId: string;
    };

    const { from, fromEmail, subject, attachmentName, messageId } = body;
    // @ts-ignore
    const tenant = corsair.withTenant(userId);
    const results: Record<string, unknown> = {};
    const errors: Record<string, string> = {};

    // Step 1: Get attachment from Gmail
    let attachmentData: string | null = null;
    try {
      // @ts-ignore
      const attachment = await tenant.gmail.api.messages.get({
        id: messageId,
        format: "full",
      });
      // Find the attachment part
      // @ts-ignore
      const part = (attachment.payload?.parts ?? []).find((p: any) => p.filename === attachmentName);
      attachmentData = part?.body?.data ?? null;
      results.gmailAttachment = { retrieved: !!attachmentData, filename: attachmentName };
    } catch (err) {
      console.error("[flow4] gmail attachment error:", err);
      errors.gmail = err instanceof Error ? err.message : "Failed";
    }

    // Step 2: Save to Google Drive
    if (attachmentData) {
      try {
        // @ts-ignore
        const file = await tenant.googledrive.api.files.create({
          name: attachmentName,
          content: attachmentData,
          mimeType: "application/octet-stream",
        });
        results.drive = { fileId: file.id, filename: attachmentName };
      } catch (err) {
        console.error("[flow4] drive error:", err);
        errors.drive = err instanceof Error ? err.message : "Failed";
        results.drive = { pending: true, filename: attachmentName };
      }
    } else {
      results.drive = { skipped: true, reason: "No attachment data retrieved" };
    }

    // Step 3: Notify Slack
    try {
      // @ts-ignore
      await tenant.slack.api.messages.post({
        channel: process.env.SLACK_CHANNEL_ID!,
        text: `⚡ *Flow 4 triggered*\n*Attachment from:* ${from} <${fromEmail}>\n*File:* ${attachmentName}\n*Saved to Drive:* ${attachmentData ? "✓" : "Pending"}`,
        mrkdwn: true,
      });
      results.slack = { notified: true };
    } catch (err) {
      console.error("[flow4] slack error:", err);
      errors.slack = err instanceof Error ? err.message : "Failed";
    }

    return NextResponse.json({
      success: Object.keys(errors).length === 0,
      message: `Flow 4 complete — attachment ${attachmentName} processed`,
      results,
      errors: Object.keys(errors).length > 0 ? errors : undefined,
    });
  } catch (err) {
    return NextResponse.json({ error: "Flow 4 failed", details: String(err) }, { status: 500 });
  }
}
