"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { UserButton } from "@clerk/nextjs";
import { api } from "~/trpc/react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Email {
  id: string;
  threadId?: string;
  from: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  body: string;
  timestamp: number;
  isRead: boolean;
  labels: string[];
  hasAttachment: boolean;
  priority?: "urgent" | "normal" | "low";
}

interface CalEvent {
  id: string;
  title: string;
  hour: number;
  durationMin: number;
  color: string;
  textColor: string;
  autoBlocked?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function initials(name: string) {
  return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
}

function avatarBg(name: string) {
  const palette = ["#00E5A0", "#00B880", "#00C48A", "#C0562E", "#1E8FA0"];
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length]!;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_EMAILS: Email[] = [
  {
    id: "1", from: "Rahul Mehta", fromEmail: "rahul@acmecorp.in",
    subject: "Q3 proposal — need sign-off by Friday",
    snippet: "Following up on the proposal we sent last week. The board meets Friday...",
    body: "Hi,\n\nFollowing up on the proposal we sent last week. The board meets Friday and we need your sign-off on the commercial terms before then.\n\nCould you review sections 3 and 4 specifically?\n\nBest,\nRahul",
    timestamp: Date.now() - 1000 * 60 * 20, isRead: false,
    labels: ["INBOX", "IMPORTANT"], hasAttachment: true,
  },
  {
    id: "2", from: "Priya Sharma", fromEmail: "priya@venturebloom.io",
    subject: "Intro call — Thursday 3PM works?",
    snippet: "Loved what you're building with NudgeHQ. Would love to connect...",
    body: "Hey!\n\nLoved what you're building with NudgeHQ. Does Thursday at 3PM IST work for a quick intro call?\n\nI'm the founder of VentureBloom — we work with early-stage SaaS teams on GTM.\n\nLooking forward!\nPriya",
    timestamp: Date.now() - 1000 * 60 * 107, isRead: false,
    labels: ["INBOX"], hasAttachment: false,
  },
  {
    id: "3", from: "GitHub", fromEmail: "noreply@github.com",
    subject: "[TheOmRaj/nudgehq] PR #12: Corsair webhook handler",
    snippet: "A new pull request has been opened by TheOmRaj...",
    body: "PR #12 opened by TheOmRaj\n\nfeat: add Corsair webhook handler\n\nView on GitHub →",
    timestamp: Date.now() - 1000 * 60 * 60 * 2, isRead: true,
    labels: ["INBOX"], hasAttachment: false,
  },
  {
    id: "4", from: "Ankit Verma", fromEmail: "ankit@growthstack.co",
    subject: "Partnership opportunity — GrowthStack integration",
    snippet: "We've been following your work and think there's a great opportunity...",
    body: "Hi Om,\n\nWe've been following your work and think there's a great opportunity for NudgeHQ to integrate with our platform.\n\nGrowthStack serves 2,000+ SMBs and we're building an automation marketplace.\n\nOpen to a call this week?\n\nAnkit",
    timestamp: Date.now() - 1000 * 60 * 60 * 19, isRead: true,
    labels: ["INBOX"], hasAttachment: false,
  },
  {
    id: "5", from: "Neon Database", fromEmail: "no-reply@neon.tech",
    subject: "nudgehq-db approaching free tier limit",
    snippet: "Your project has used 85% of free tier compute hours this month...",
    body: "Your Neon project nudgehq-db has used 85% of the free tier compute hours this month.\n\nConsider upgrading to avoid interruptions.",
    timestamp: Date.now() - 1000 * 60 * 60 * 24, isRead: true,
    labels: ["INBOX"], hasAttachment: false,
  },
];

const BASE_EVENTS: CalEvent[] = [
  { id: "e1", title: "Standup — Engineering", hour: 9, durationMin: 30, color: "#1E3248", textColor: "#7AADDC" },
  { id: "e2", title: "Client call — Rahul Mehta", hour: 11, durationMin: 60, color: "#2E1E40", textColor: "#A87DD0" },
  { id: "e3", title: "NudgeHQ demo prep", hour: 14, durationMin: 60, color: "#1E3028", textColor: "#6DB87A" },
];

const AUTO_BLOCKED_EVENT: CalEvent = {
  id: "auto", title: "⚡ Auto-blocked by Flow 1", hour: 15, durationMin: 30,
  color: "#00E5A0", textColor: "#0C0B09", autoBlocked: true,
};

const HOURS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const HOUR_H = 52;

function fmtHour(h: number) {
  if (h === 12) return "12 PM";
  if (h > 12) return `${h - 12} PM`;
  return `${h} AM`;
}

// ─── Dots loader ──────────────────────────────────────────────────────────────

function Dots() {
  const [d, setD] = useState(".");
  useEffect(() => {
    const t = setInterval(() => setD((v) => (v.length >= 3 ? "." : v + ".")), 380);
    return () => clearInterval(t);
  }, []);
  return <>{d}</>;
}

// ─── Flow Toast ───────────────────────────────────────────────────────────────

function FlowToast({ email, onDone }: { email: Email; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const steps = [
    { icon: "📋", label: "Creating Todoist task" },
    { icon: "✉️", label: "Drafting Gmail reply" },
    { icon: "📅", label: "Blocking time on Calendar" },
    { icon: "💬", label: "Notifying Slack" },
    { icon: "✅", label: "Flow complete" },
  ];

  useEffect(() => {
    if (step < steps.length - 1) {
      const t = setTimeout(() => setStep((s) => s + 1), 850);
      return () => clearTimeout(t);
    } else {
      const t = setTimeout(onDone, 2200);
      return () => clearTimeout(t);
    }
  }, [step]);

  return (
    <div style={{
      position: "fixed", bottom: 24, right: 24,
      background: "#161410", border: "1px solid #2A2820",
      borderRadius: 12, padding: "14px 18px", minWidth: 270,
      zIndex: 1000, boxShadow: "0 8px 40px rgba(0,0,0,0.7)",
    }}>
      <div style={{ fontSize: 10, color: "#6B6860", fontFamily: "DM Mono, monospace", marginBottom: 6 }}>
        Flow 1 — Inbound Client Email
      </div>
      <div style={{ fontSize: 11, color: "#6B6860", marginBottom: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {email.subject}
      </div>
      {steps.map((s, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: 8, padding: "4px 0",
          opacity: i <= step ? 1 : 0.25, transition: "opacity 0.3s",
        }}>
          <span style={{ fontSize: 13, width: 18 }}>{s.icon}</span>
          <span style={{
            fontSize: 12,
            color: i < step ? "#00E5A0"
              : i === step && step < steps.length - 1 ? "#00E5A0"
                : step === steps.length - 1 && i === step ? "#00C48A"
                  : "#6B6860",
          }}>{s.label}</span>
          {i < step && <span style={{ marginLeft: "auto", color: "#00C48A", fontSize: 11 }}>✓</span>}
          {i === step && step < steps.length - 1 && (
            <span style={{ marginLeft: "auto", color: "#00E5A0", fontFamily: "DM Mono, monospace", fontSize: 12 }}>
              <Dots />
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Email list item ──────────────────────────────────────────────────────────

function EmailItem({
  email, selected, onClick, onFlow,
}: {
  email: Email; selected: boolean; onClick: () => void; onFlow: () => void;
}) {
  const [hov, setHov] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: "10px 12px", cursor: "pointer",
        background: selected ? "#1C1A16" : hov ? "#131210" : "transparent",
        borderLeft: selected ? "2px solid #00E5A0" : "2px solid transparent",
        transition: "background 0.1s", position: "relative",
      }}
    >
      <div style={{ display: "flex", gap: 8 }}>
        <div style={{
          width: 28, height: 28, borderRadius: "50%",
          background: avatarBg(email.from), flexShrink: 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 9, fontWeight: 700, color: "#fff", marginTop: 1,
        }}>
          {initials(email.from)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
            <span style={{
              fontSize: 12, fontWeight: email.isRead ? 400 : 600,
              color: email.isRead ? "#777" : "#EAE8E3",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 110,
            }}>{email.from}</span>
            <span style={{ fontSize: 10, color: "#555", fontFamily: "DM Mono, monospace", flexShrink: 0 }}>
              {formatTime(email.timestamp)}
            </span>
          </div>
          <div style={{
            fontSize: 11, color: email.isRead ? "#555" : "#AAA",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", marginBottom: 2,
          }}>{email.subject}</div>
          {email.priority && email.priority !== "normal" && (
            <div style={{ marginBottom: 2 }}>
              <span style={{
                fontSize: 9, fontFamily: "DM Mono, monospace",
                padding: "1px 6px", borderRadius: 4, fontWeight: 600,
                ...(email.priority === "urgent"
                  ? { background: "rgba(220,38,38,0.15)", color: "#F87171", border: "1px solid rgba(220,38,38,0.25)" }
                  : { background: "rgba(0,229,160,0.08)", color: "#00E5A0", border: "1px solid rgba(0,229,160,0.2)" }
                ),
              }}>
                {email.priority === "urgent" ? "⚠ urgent" : "↓ low"}
              </span>
            </div>
          )}
          <div style={{ fontSize: 10, color: "#3A3830", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {email.snippet}
          </div>
        </div>
      </div>
      {hov && (
        <button
          onClick={(e) => { e.stopPropagation(); onFlow(); }}
          style={{
            position: "absolute", right: 10, bottom: 8,
            background: "#00E5A0", color: "#0C0B09",
            border: "none", fontSize: 10, fontWeight: 700,
            padding: "2px 8px", borderRadius: 20, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 3,
          }}
        >
          ⚡ Run Flow
        </button>
      )}
    </div>
  );
}

// ─── Calendar ─────────────────────────────────────────────────────────────────

function Calendar({ events, selectedDate, onDateChange }: {
  events: CalEvent[];
  selectedDate: Date;
  onDateChange: (d: Date) => void;
}) {
  const today = new Date();
  const displayDate = selectedDate;
  const dateLabel = displayDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const dayOfWeek = today.getDay(); // 0=Sun

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <div style={{
        padding: "14px 16px 10px", borderBottom: "1px solid #1C1A17",
        flexShrink: 0, display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#EAE8E3" }}>
            {displayDate.toDateString() === today.toDateString() ? "Today" : displayDate.toLocaleDateString("en-US", { weekday: "long" })}
          </div>
          <div style={{ fontSize: 11, color: "#6B6860", fontFamily: "DM Mono, monospace" }}>{dateLabel}</div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["M", "T", "W", "T", "F"].map((d, i) => {
            const isToday = dayOfWeek >= 1 && dayOfWeek <= 5 && i === dayOfWeek - 1;
            const dayNum = today.getDate() - (dayOfWeek - 1) + i;
            const thisDate = new Date(today);
            thisDate.setDate(dayNum);
            const isSelected = selectedDate.toDateString() === thisDate.toDateString();
            return (
              <div key={i} onClick={() => onDateChange(new Date(thisDate))}
                style={{ textAlign: "center", minWidth: 28, cursor: "pointer" }}>
                <div style={{ fontSize: 9, color: isSelected ? "#00E5A0" : "#3A3830", marginBottom: 2, fontFamily: "DM Mono, monospace" }}>{d}</div>
                <div style={{
                  width: 24, height: 24, borderRadius: "50%",
                  background: isSelected ? "#00E5A0" : "transparent",
                  color: isSelected ? "#0A0908" : "#3A3830",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: isSelected ? 700 : 400, margin: "0 auto",
                  transition: "all 0.15s",
                }}>
                  {dayNum}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
        {HOURS.map((h) => {
          const evs = events.filter((e) => e.hour === h);
          return (
            <div key={h} style={{ display: "flex", height: HOUR_H, borderTop: "1px solid #1A1815" }}>
              <div style={{
                width: 48, flexShrink: 0, padding: "5px 8px 0 0",
                fontSize: 9, color: "#444", fontFamily: "DM Mono, monospace", textAlign: "right",
              }}>
                {fmtHour(h)}
              </div>
              <div style={{ flex: 1, position: "relative", paddingRight: 12 }}>
                {evs.map((ev) => (
                  <div key={ev.id} style={{
                    position: "absolute", top: 2, left: 4, right: 0,
                    height: Math.max((ev.durationMin / 60) * HOUR_H - 3, 18),
                    background: ev.color,
                    borderRadius: 4, padding: "4px 8px",
                    overflow: "hidden",
                    boxShadow: ev.autoBlocked ? `0 0 0 1px ${ev.color}` : "none",
                  }}>
                    <span style={{
                      fontSize: 10, fontWeight: ev.autoBlocked ? 700 : 500,
                      color: ev.textColor, whiteSpace: "nowrap",
                      overflow: "hidden", textOverflow: "ellipsis", display: "block",
                    }}>
                      {ev.title}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Email detail ─────────────────────────────────────────────────────────────

function EmailDetail({ email, onFlow }: { email: Email; onFlow: () => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 10px", borderBottom: "1px solid #1C1A17", flexShrink: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#EAE8E3", marginBottom: 8, lineHeight: 1.3 }}>
          {email.subject}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <div style={{
              width: 28, height: 28, borderRadius: "50%",
              background: avatarBg(email.from),
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 9, fontWeight: 700, color: "#fff",
            }}>
              {initials(email.from)}
            </div>
            <div>
              <div style={{ fontSize: 12, color: "#EAE8E3", fontWeight: 500 }}>{email.from}</div>
              <div style={{ fontSize: 10, color: "#6B6860", fontFamily: "DM Mono, monospace" }}>{email.fromEmail}</div>
            </div>
          </div>
          <button
            onClick={onFlow}
            style={{
              background: "#00E5A0", color: "#0C0B09",
              border: "none", padding: "5px 12px", borderRadius: 20,
              fontSize: 11, fontWeight: 700, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 4,
            }}
          >
            ⚡ Run Flow
          </button>
        </div>
      </div>
      <div style={{
        flex: 1, overflowY: "auto", padding: "14px 16px",
        fontSize: 13, color: "#B0ADA8", lineHeight: 1.75, whiteSpace: "pre-wrap",
      }}>
        {email.body}
      </div>
      <div style={{ padding: "10px 16px", borderTop: "1px solid #1C1A17", display: "flex", gap: 6, flexShrink: 0 }}>
        <input
          placeholder="Quick reply..."
          style={{
            flex: 1, background: "#131210", border: "1px solid #221F1A",
            borderRadius: 6, padding: "7px 10px", color: "#EAE8E3",
            fontSize: 12, outline: "none", fontFamily: "'Space Grotesk',sans-serif",
          }}
        />
        <button style={{
          background: "#00E5A0", color: "#0C0B09", border: "none",
          padding: "7px 14px", borderRadius: 6, fontSize: 12, cursor: "pointer",
        }}>Reply</button>
      </div>
    </div>
  );
}

// ─── Command Palette ──────────────────────────────────────────────────────────

interface Message {
  role: "user" | "assistant";
  text: string;
  loading?: boolean;
}

function CommandPalette({ open, onClose, emails }: { open: boolean; onClose: () => void; emails: Email[] }) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", text: "What do you want to do? Try: \"email John\", \"find urgent emails\", \"block 2pm for a meeting\"" },
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    const userMsg: Message = { role: "user", text };
    const loadingMsg: Message = { role: "assistant", text: "", loading: true };
    setMessages((prev) => [...prev, userMsg, loadingMsg]);

    try {
      const history = messages
        .filter((m) => !m.loading && m.text && m.text.trim().length > 0)
        .slice(1)
        .map((m) => ({ role: m.role, content: m.text }));

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          emailContext: emails.slice(0, 10).map((e) => ({
            id: e.id, from: e.from, subject: e.subject, snippet: e.snippet,
          })),
          history,
        }),
      });
      const data = await res.json() as { reply: string };
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", text: data.reply },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev.slice(0, -1),
        { role: "assistant", text: "Agent error — check that ANTHROPIC_API_KEY is set in .env and /api/agent exists." },
      ]);
    }
  }

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.7)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        paddingTop: "15vh",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, background: "#131210",
          border: "1px solid #2A2820", borderRadius: 14,
          overflow: "hidden", boxShadow: "0 24px 64px rgba(0,0,0,0.8)",
          display: "flex", flexDirection: "column", maxHeight: "60vh",
        }}
      >
        {/* Header */}
        <div style={{
          padding: "12px 16px", borderBottom: "1px solid #1C1A17",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 16 }}>⚡</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#EAE8E3" }}>NudgeHQ Agent</span>
          <kbd style={{
            marginLeft: "auto", background: "#1C1A17", border: "1px solid #2A2820",
            borderRadius: 4, padding: "1px 6px", fontSize: 10,
            color: "#555", fontFamily: "DM Mono, monospace",
          }}>esc</kbd>
        </div>

        {/* Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {messages.map((msg, i) => (
            <div key={i} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{
                maxWidth: "80%",
                background: msg.role === "user" ? "#2A3F35" : "#1C1A16", color: msg.role === "user" ? "#00E5A0" : "#C8C6C0",
                padding: "8px 12px", borderRadius: 10,
                fontSize: 13, lineHeight: 1.55,
                fontStyle: msg.loading ? "italic" : "normal",
              }}>
                {msg.loading ? <Dots /> : msg.text}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div style={{
          padding: "10px 12px", borderTop: "1px solid #1C1A17",
          display: "flex", gap: 8,
        }}>
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); if (e.key === "Escape") onClose(); }}
            placeholder="Email John, find urgent emails, block 2pm..."
            style={{
              flex: 1, background: "#0A0908", border: "1px solid #2A2820",
              borderRadius: 8, padding: "9px 12px", color: "#EAE8E3",
              fontSize: 13, outline: "none", fontFamily: "'Space Grotesk',sans-serif",
            }}
          />
          <button
            onClick={send}
            style={{
              background: "#00E5A0", color: "#0C0B09",
              border: "none", padding: "9px 16px", borderRadius: 8,
              fontSize: 13, fontWeight: 700, cursor: "pointer",
            }}
          >
            ↵
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const router = useRouter();
  const [emails, setEmails] = useState<Email[]>([]);
  const [selected, setSelected] = useState<Email | null>(null);
  const [calEvents, setCalEvents] = useState<CalEvent[]>([]);
  const [flowEmail, setFlowEmail] = useState<Email | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [activeNav, setActiveNav] = useState("inbox");
  const [cmdOpen, setCmdOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());

  // Debounce search — only fires Corsair query after 500ms pause
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(t);
  }, [search]);

  // Real Gmail data via tRPC + Corsair
  const gmailQuery = api.gmail.list.useQuery(
    { limit: 20, query: "in:inbox" },
    { refetchOnWindowFocus: false }
  );

  // Selected email is used directly — full data already in list
  const selectedWithBody = selected;

  // Real Calendar data via tRPC + Corsair — refetches when date changes
  const calendarQuery = api.calendar.listToday.useQuery(
    { date: selectedDate.toISOString() },
    { refetchOnWindowFocus: false }
  );

  // Sync Gmail into state
  useEffect(() => {
    if (gmailQuery.data?.emails) {
      setEmails(gmailQuery.data.emails);
    }
  }, [gmailQuery.data]);

  // Sync Calendar into state, preserve auto-blocked events
  useEffect(() => {
    if (calendarQuery.data) {
      const realEvents = calendarQuery.data.events.map((ev: any, i: number) => {
        const colors = [
          { color: "#1E3248", textColor: "#7AADDC" },
          { color: "#2E1E40", textColor: "#A87DD0" },
          { color: "#1E3028", textColor: "#6DB87A" },
        ];
        const c = colors[i % colors.length]!;
        return {
          id: ev.id,
          title: ev.title,
          hour: ev.hour,
          durationMin: ev.durationMin,
          color: c.color,
          textColor: c.textColor,
        };
      });
      setCalEvents((prev) => {
        const autoBlocked = prev.filter((e) => e.id === "auto");
        // If no real events today, show nothing (not demo data)
        return [...realEvents, ...autoBlocked];
      });
    }
  }, [calendarQuery.data]);

  const loading = gmailQuery.isLoading;

  async function runFlow(email: Email) {
    setFlowEmail(email);

    try {
      const res = await fetch("/api/flows/flow1", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          emailId: email.id,
          threadId: email.threadId,
          from: email.from,
          fromEmail: email.fromEmail,
          subject: email.subject,
          snippet: email.snippet,
          slackChannel: "#general",
        }),
      });

      const data = await res.json() as {
        success: boolean;
        message: string;
        results: Record<string, unknown>;
        errors?: Record<string, string>;
      };

      console.log("[flow1] result:", data);

      // Add auto-blocked calendar event if calendar succeeded
      if (data.results?.calendar) {
        setCalEvents((prev) => {
          if (prev.find((e) => e.id === "auto")) return prev;
          return [...prev, AUTO_BLOCKED_EVENT];
        });
      }
    } catch (err) {
      console.error("[flow1] error:", err);
      // Still show animation even if API fails
      setCalEvents((prev) => {
        if (prev.find((e) => e.id === "auto")) return prev;
        return [...prev, AUTO_BLOCKED_EVENT];
      });
    }
  }

  const onKey = useCallback((e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setCmdOpen((v) => !v); return; }
    const idx = emails.findIndex((em) => em.id === selected?.id);
    if (e.key === "j") setSelected(emails[Math.min(idx + 1, emails.length - 1)] ?? null);
    if (e.key === "k") setSelected(emails[Math.max(idx - 1, 0)] ?? null);
    if (e.key === "r" && selected) runFlow(selected);
    if (e.key === "u" && selected) setEmails((prev) => prev.map((em) => em.id === selected.id ? { ...em, isRead: !em.isRead } : em));
    if (e.key === "c") setCmdOpen(true);
    if (e.key === "1") setActiveNav("inbox");
    if (e.key === "2") setActiveNav("calendar");
    if (e.key === "3") setActiveNav("flows");
    if (e.key === "Escape") { setSelected(null); setCmdOpen(false); }
  }, [emails, selected]);

  useEffect(() => {
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onKey]);

  // Corsair-powered search — only active when user has typed something
  const searchQuery = api.gmail.search.useQuery(
    { query: debouncedSearch },
    { enabled: debouncedSearch.trim().length > 1, refetchOnWindowFocus: false }
  );

  const filtered = debouncedSearch.trim().length > 1
    ? (searchQuery.data?.emails ?? [])
    : emails;
  const unread = emails.filter((e) => !e.isRead).length;

  const navItems = [
    {
      id: "inbox", label: "Inbox",
      svg: <><polyline points="22 12 16 12 14 15 10 15 8 12 2 12" /><path d="M5.45 5.11L2 12v6a2 2 0 002 2h16a2 2 0 002-2v-6l-3.45-6.89A2 2 0 0016.76 4H7.24a2 2 0 00-1.79 1.11z" /></>
    },
    {
      id: "calendar", label: "Calendar",
      svg: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>
    },
    {
      id: "flows", label: "Flows",
      svg: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600&family=DM+Mono:wght@400;500&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html,body{background:#0A0908;color:#EAE8E3;font-family:'Space Grotesk',-apple-system,sans-serif;height:100%;overflow:hidden}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2A2820;border-radius:2px}
        input::placeholder{color:#3A3830}
        button{font-family:'Space Grotesk',sans-serif}
      `}</style>

      <div style={{ display: "flex", height: "100vh", background: "#0A0908" }}>

        {/* Sidebar */}
        <aside style={{
          width: 56, background: "#0A0908", borderRight: "1px solid #1A1815",
          display: "flex", flexDirection: "column", alignItems: "center",
          paddingTop: 16, paddingBottom: 16, gap: 4, flexShrink: 0,
        }}>
          <div
            style={{ marginBottom: 16, flexShrink: 0, padding: "0 4px", cursor: "pointer" }}
            onClick={() => router.push("/")}
            title="Go to home"
          >
            <Image src="/NudgeHQ_logo.png" alt="NudgeHQ" width={40} height={40} style={{ objectFit: "contain" }} />
          </div>

          {navItems.map(({ id, label, svg }) => (
            <button key={id} title={label} onClick={() => setActiveNav(id)} style={{
              width: 36, height: 36, borderRadius: 8, border: "none",
              background: activeNav === id ? "#1C1A17" : "transparent",
              color: activeNav === id ? "#EAE8E3" : "#444",
              cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
            }}
              onMouseEnter={(e) => { if (activeNav !== id) { (e.currentTarget as HTMLElement).style.color = "#AAA"; (e.currentTarget as HTMLElement).style.background = "#131210"; } }}
              onMouseLeave={(e) => { if (activeNav !== id) { (e.currentTarget as HTMLElement).style.color = "#444"; (e.currentTarget as HTMLElement).style.background = "transparent"; } }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                {svg}
              </svg>
            </button>
          ))}

          <div style={{ flex: 1 }} />
          <UserButton
            appearance={{
              elements: {
                avatarBox: { width: 32, height: 32 },
                userButtonPopoverCard: { background: "#131210", border: "1px solid #2A2820" },
              }
            }}
          />
        </aside>

        {/* Email list — only in inbox view */}
        {activeNav === "inbox" && <div style={{
          width: 260, borderRight: "1px solid #1A1815",
          display: "flex", flexDirection: "column", flexShrink: 0, background: "#0A0908",
        }}>
          <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid #1A1815", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#EAE8E3" }}>Inbox</span>
              {unread > 0 && (
                <span style={{
                  background: "#00E5A0", color: "#0C0B09",
                  fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 8,
                }}>{unread}</span>
              )}
              {searchQuery.isLoading && debouncedSearch.trim().length > 1 && (
                <span style={{ fontSize: 9, color: "#555", fontFamily: "DM Mono, monospace", marginLeft: "auto" }}>
                  searching<Dots />
                </span>
              )}
            </div>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search..."
              style={{
                width: "100%", background: "#131210", border: "1px solid #221F1A",
                borderRadius: 6, padding: "6px 10px", color: "#EAE8E3",
                fontSize: 11, outline: "none",
              }}
            />
          </div>

          <div style={{ flex: 1, overflowY: "auto" }}>
            {loading && (
              <div style={{ padding: "8px 0" }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} style={{ padding: "10px 12px", display: "flex", gap: 8, opacity: 1 - i * 0.15 }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: "#1C1A17", flexShrink: 0,
                    }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 10, background: "#1C1A17", borderRadius: 4, marginBottom: 6, width: "60%" }} />
                      <div style={{ height: 9, background: "#161410", borderRadius: 4, marginBottom: 4, width: "90%" }} />
                      <div style={{ height: 8, background: "#131210", borderRadius: 4, width: "75%" }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!loading && filtered.map((email: Email) => (
              <EmailItem
                key={email.id}
                email={email}
                selected={selected?.id === email.id}
                onClick={() => {
                  setSelected(email);
                  setEmails((prev) => prev.map((e) => e.id === email.id ? { ...e, isRead: true } : e));
                }}
                onFlow={() => runFlow(email)}
              />
            ))}
          </div>

          <div style={{
            padding: "8px 12px", borderTop: "1px solid #1A1815",
            display: "flex", gap: 8, flexShrink: 0,
          }}>
            {[["j/k", "nav"], ["r", "flow"], ["u", "read"], ["c", "agent"], ["1-3", "views"], ["esc", "close"]].map(([k, l]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <kbd style={{
                  background: "#1C1A17", border: "1px solid #2A2820", borderRadius: 3,
                  padding: "0 4px", fontSize: 9, color: "#444", fontFamily: "DM Mono, monospace",
                }}>{k}</kbd>
                <span style={{ fontSize: 9, color: "#333" }}>{l}</span>
              </div>
            ))}
          </div>
        </div>}

        {/* Email detail — always visible */}
        <div style={{
          width: 300, borderRight: "1px solid #1A1815",
          display: "flex", flexDirection: "column", flexShrink: 0, background: "#0A0908",
        }}>
          {activeNav === "flows" ? (
            <div style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              <div style={{ fontSize: 11, color: "#00E5A0", fontFamily: "DM Mono, monospace", marginBottom: 8, letterSpacing: "0.1em" }}>FLOWS</div>
              {[
                { num: "01", title: "Inbound Email", color: "#00E5A0" },
                { num: "02", title: "Follow-up Tracker", color: "#7AADDC" },
                { num: "03", title: "Conflict Resolver", color: "#A87DD0" },
                { num: "04", title: "Attachment Handler", color: "#F0A500" },
              ].map((f) => (
                <div key={f.num} style={{ padding: "12px 0", borderBottom: "1px solid #1A1815" }}>
                  <div style={{ fontSize: 10, color: f.color, fontFamily: "DM Mono, monospace", marginBottom: 4 }}>Flow {f.num}</div>
                  <div style={{ fontSize: 13, color: "#EAE8E3", fontWeight: 500 }}>{f.title}</div>
                  <div style={{ fontSize: 10, color: "#00E5A0", marginTop: 4 }}>● Active</div>
                </div>
              ))}
            </div>
          ) : selected ? (
            <EmailDetail email={selectedWithBody!} onFlow={() => runFlow(selected)} />
          ) : (
            <div
              onClick={() => setCmdOpen(true)}
              style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                color: "#333", gap: 8, cursor: "pointer",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#111009")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <kbd style={{
                background: "#1C1A17", border: "1px solid #2A2820", borderRadius: 6,
                padding: "6px 12px", fontSize: 18, color: "#444", fontFamily: "DM Mono, monospace",
              }}>⌘K</kbd>
              <span style={{ fontSize: 11, color: "#333" }}>Open agent</span>
            </div>
          )}
        </div>

        {/* Calendar — full width in calendar view, sidebar in inbox/flows view */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
          <Calendar events={calEvents} selectedDate={selectedDate} onDateChange={setSelectedDate} />
        </div>

        {/* Flows full view — overlays when flows nav active */}
        {activeNav === "flows" && false && (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden auto", padding: 32 }}>
            <div style={{ fontSize: 11, color: "#00E5A0", fontFamily: "DM Mono, monospace", marginBottom: 8, letterSpacing: "0.1em" }}>AUTOMATION FLOWS</div>
            <h2 style={{ fontSize: 22, fontWeight: 600, color: "#EAE8E3", marginBottom: 24 }}>Active flows</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
              {[
                { num: "01", title: "Inbound Client Email", desc: "Email detected → Todoist task → Gmail draft → Calendar block → Slack nudge", color: "#00E5A0", active: true },
                { num: "02", title: "Follow-up Tracker", desc: "No reply after 3 days → Notion log → Calendar reminder → Gmail follow-up draft", color: "#7AADDC", active: true },
                { num: "03", title: "Meeting Conflict Resolver", desc: "Invite detected → Calendar conflict check → Notion log → Gmail reschedule draft", color: "#A87DD0", active: true },
                { num: "04", title: "Attachment Handler", desc: "Attachment detected → Gmail fetch → Google Drive save → Slack notify", color: "#F0A500", active: true },
              ].map((f) => (
                <div key={f.num} style={{
                  background: "#0F0E0C", border: `1px solid ${f.color}22`,
                  borderRadius: 12, padding: 24,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: f.color, fontFamily: "DM Mono, monospace" }}>Flow {f.num}</span>
                    <span style={{ fontSize: 10, color: "#00E5A0", background: "#00E5A010", border: "1px solid #00E5A030", padding: "2px 8px", borderRadius: 10 }}>● Active</span>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#EAE8E3", marginBottom: 8 }}>{f.title}</div>
                  <div style={{ fontSize: 12, color: "#4A4840", lineHeight: 1.6, fontFamily: "DM Mono, monospace" }}>{f.desc}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {flowEmail && (
        <FlowToast email={flowEmail} onDone={() => setFlowEmail(null)} />
      )}

      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} emails={emails} />
    </>
  );
}
