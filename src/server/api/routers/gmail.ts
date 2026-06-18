import { z } from "zod";
import Groq from "groq-sdk";
import { createTRPCRouter, protectedProcedure } from "~/server/api/trpc";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const gmailRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({
      limit: z.number().min(1).max(100).default(20),
      query: z.string().default("in:inbox"),
    }))
    .query(async ({ ctx, input }) => {
      try {
        console.log("USER ID:", ctx.userId);

        // @ts-ignore
        const tenant = ctx.corsair.withTenant(ctx.userId!);

        // @ts-ignore
        const listResult = await tenant.gmail.api.messages.list({
          q: input.query,
          maxResults: input.limit,
        });

        const messageStubs = listResult?.messages ?? [];
        if (messageStubs.length === 0) return { emails: [] };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fullMessages = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messageStubs.slice(0, 20).map((stub: any) =>
            // @ts-ignore
            tenant.gmail.api.messages.get({
              id: stub.id as string,
              format: "full",
            })
          )
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emails = fullMessages.map((msg: any) => {
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

          return {
            id: msg.id as string,
            threadId: msg.threadId as string,
            from: fromName,
            fromEmail,
            subject: headers["subject"] ?? "(no subject)",
            snippet: (msg.snippet as string) ?? "",
            body: extractBody(msg),
            timestamp: parseInt(msg.internalDate as string) || Date.now(),
            isRead: !((msg.labelIds as string[]) ?? []).includes("UNREAD"),
            labels: (msg.labelIds as string[]) ?? [],
            hasAttachment: ((msg.payload?.parts ?? []) as unknown[]).some(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (p: any) => p.filename && (p.filename as string).length > 0
            ),
            priority: "normal" as "urgent" | "normal" | "low",
          };
        });

        // Batch classify all emails in a single Groq call
        try {
          const emailSummaries = emails
            .map((e: typeof emails[0], i: number) => `${i}. Subject: "${e.subject}" | Snippet: "${e.snippet}"`).join("\n");

          const classification = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
              {
                role: "system",
                content: `You are an email priority classifier. Given a list of emails, return ONLY a JSON array with no markdown, no explanation. Each item must have "index" (number) and "priority" (one of: "urgent", "normal", "low"). Example: [{"index":0,"priority":"urgent"},{"index":1,"priority":"low"}]`,
              },
              { role: "user", content: emailSummaries },
            ],
            max_tokens: 500,
          });

          const raw = classification.choices[0]?.message?.content ?? "[]";
          const clean = raw.replace(/```json|```/g, "").trim();
          const priorities = JSON.parse(clean) as { index: number; priority: "urgent" | "normal" | "low" }[];

          priorities.forEach(({ index, priority }) => {
            if (emails[index]) emails[index]!.priority = priority;
          });
        } catch (err) {
          console.error("[gmail.list] priority classification error:", err);
          // Non-fatal — emails still return with default "normal" priority
        }

        return { emails };
      } catch (err) {
        console.error("[gmail.list] error:", err);
        throw err;
      }
    }),

  getMessage: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      try {
        // @ts-ignore
        const msg = await ctx.corsair
          .withTenant(ctx.userId!)
          .gmail.api.messages.get({ id: input.id, format: "full" });

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

        return {
          from: fromName,
          fromEmail,
          subject: headers["subject"] ?? "(no subject)",
          body: extractBody(msg),
          snippet: (msg.snippet as string) ?? "",
        };
      } catch (err) {
        console.error("[gmail.getMessage] error:", err);
        throw err;
      }
    }),

  draftReply: protectedProcedure
    .input(z.object({
      threadId: z.string(),
      to: z.string(),
      subject: z.string(),
      body: z.string(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        // @ts-ignore
        const draft = await ctx.corsair
          .withTenant(ctx.userId!)
          .gmail.api.drafts.create({
            message: {
              threadId: input.threadId,
              to: input.to,
              subject: input.subject,
              body: input.body,
            },
          });
        return { draft };
      } catch (err) {
        console.error("[gmail.draftReply] error:", err);
        throw err;
      }
    }),

  markRead: protectedProcedure
    .input(z.object({ messageId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      try {
        // @ts-ignore
        await ctx.corsair
          .withTenant(ctx.userId!)
          .gmail.api.messages.modify({
            id: input.messageId,
            removeLabelIds: ["UNREAD"],
          });
        return { success: true };
      } catch (err) {
        console.error("[gmail.markRead] error:", err);
        throw err;
      }
    }),

  setupWatch: protectedProcedure
    .mutation(async ({ ctx }) => {
      try {
        // @ts-ignore
        const tenant = ctx.corsair.withTenant(ctx.userId!);
        // @ts-ignore
        const result = await tenant.gmail.api.users.watch({
          userId: "me",
          requestBody: {
            topicName: "projects/nudgehq-499320/topics/gmail-push-notifications",
            labelIds: ["INBOX"],
          },
        });
        console.log("[gmail.setupWatch] Watch set:", result);
        return { success: true, result };
      } catch (err) {
        console.error("[gmail.setupWatch] error:", err);
        throw err;
      }
    }),

  search: protectedProcedure
    .input(z.object({ query: z.string().min(1) }))
    .query(async ({ ctx, input }) => {
      try {
        // @ts-ignore
        const tenant = ctx.corsair.withTenant(ctx.userId!);

        // @ts-ignore
        const listResult = await tenant.gmail.api.messages.list({
          q: input.query,
          maxResults: 20,
        });

        const messageStubs = listResult?.messages ?? [];
        if (messageStubs.length === 0) return { emails: [] };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fullMessages = await Promise.all(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          messageStubs.slice(0, 20).map((stub: any) =>
            // @ts-ignore
            tenant.gmail.api.messages.get({
              id: stub.id as string,
              format: "full",
            })
          )
        );

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const emails = fullMessages.map((msg: any) => {
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

          return {
            id: msg.id as string,
            threadId: msg.threadId as string,
            from: fromName,
            fromEmail,
            subject: headers["subject"] ?? "(no subject)",
            snippet: (msg.snippet as string) ?? "",
            body: extractBody(msg),
            timestamp: parseInt(msg.internalDate as string) || Date.now(),
            isRead: !((msg.labelIds as string[]) ?? []).includes("UNREAD"),
            labels: (msg.labelIds as string[]) ?? [],
            hasAttachment: ((msg.payload?.parts ?? []) as unknown[]).some(
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              (p: any) => p.filename && (p.filename as string).length > 0
            ),
            priority: "normal" as "urgent" | "normal" | "low",
          };
        });

        return { emails };
      } catch (err) {
        console.error("[gmail.search] error:", err);
        throw err;
      }
    }),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractBody(msg: any): string {
  try {
    const parts = msg.payload?.parts ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const textPart = parts.find((p: any) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data as string, "base64").toString("utf-8");
    }
    if (msg.payload?.body?.data) {
      return Buffer.from(msg.payload.body.data as string, "base64").toString("utf-8");
    }
    return (msg.snippet as string) ?? "";
  } catch {
    return (msg.snippet as string) ?? "";
  }
}
