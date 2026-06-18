import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = `You are the NudgeHQ AI agent — an intelligent assistant built into a Superhuman-style email and calendar automation app for SMBs.

You have access to the user's Gmail inbox and Google Calendar through Corsair integrations. You help users manage their workflow by understanding natural language commands.

You can help with:
- Finding and summarizing emails ("find emails from John", "show urgent emails", "any unread from last week")
- Drafting replies ("draft a reply to Rahul saying I'll review by Thursday")
- Calendar actions ("block 2pm tomorrow", "what's on my calendar today", "schedule a call with Priya")
- Running automation flows ("run Flow 1 on Rahul's email", "trigger follow-up for Ankit")
- Summarizing threads ("summarize the Q3 proposal thread")

The user's current inbox context is provided. Use it to give specific, actionable responses.

Keep replies concise and direct — this is a command palette, not a chat app. 2-4 sentences max unless the user asks for detail. Use bullet points only when listing multiple items. Never say "I'll help you with that" — just do it.

When the user asks to take an action (send email, block calendar, create task), confirm what you're about to do and tell them to click "Run Flow" to execute.`;

interface GroqMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
  error?: { message: string };
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json() as {
      message: string;
      emailContext?: Array<{
        id: string;
        from: string;
        subject: string;
        snippet: string;
      }>;
      history?: Array<{ role: "user" | "assistant"; content: string }>;
    };

    const { message, emailContext = [], history = [] } = body;

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY not set in .env" },
        { status: 500 }
      );
    }

    // Build inbox context string
    const inboxSummary =
      emailContext.length > 0
        ? `Current inbox (${emailContext.length} emails):\n` +
          emailContext
            .map(
              (e, i) =>
                `${i + 1}. From: ${e.from} | Subject: ${e.subject} | Preview: ${e.snippet.slice(0, 100)}`
            )
            .join("\n")
        : "Inbox is empty or not loaded yet.";

    // Build messages array — Groq uses OpenAI-compatible format
    const messages: GroqMessage[] = [
      { role: "system", content: SYSTEM_PROMPT },
      // Inject inbox context as first user message for awareness
      { role: "user", content: `Inbox context:\n${inboxSummary}` },
      { role: "assistant", content: "Got it. I have your inbox loaded. What do you need?" },
      // Prior conversation history
      ...history
        .filter((m) => m.content && m.content.trim().length > 0)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
        })),
      // Current message
      { role: "user", content: message },
    ];

    const res = await fetch(GROQ_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages,
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = (await res.json()) as GroqResponse;

    if (data.error) {
      console.error("[agent] Groq error:", data.error);
      return NextResponse.json({ error: data.error.message }, { status: 500 });
    }

    const reply =
      data.choices?.[0]?.message?.content ?? "No response from Groq.";

    return NextResponse.json({ reply });
  } catch (err) {
    console.error("[agent] error:", err);
    return NextResponse.json(
      { error: "Agent failed. Check GROQ_API_KEY in .env." },
      { status: 500 }
    );
  }
}
