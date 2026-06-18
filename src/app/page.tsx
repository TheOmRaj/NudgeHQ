"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";

// ─── Logo positions ───────────────────────────────────────────────────────────

const LOGOS = [
  { src: "/icons/gmail.svg",          top: "5%",   left: "6%",   size: 36, rotate: -12 },
  { src: "/icons/googlecalendar.svg", top: "7%",   left: "88%",  size: 32, rotate: 8   },
  { src: "/icons/notion.svg",         top: "10%",  left: "18%",  size: 28, rotate: 15  },
  { src: "/icons/todoist.svg",        top: "10%",  left: "75%",  size: 30, rotate: -6  },
  { src: "/icons/hubspot.svg",        top: "15%",  left: "3%",   size: 32, rotate: 10  },
  { src: "/icons/googledrive.svg",    top: "16%",  left: "92%",  size: 34, rotate: -14 },
  { src: "/icons/gmail.svg",          top: "20%",  left: "30%",  size: 26, rotate: 5   },
  { src: "/icons/notion.svg",         top: "22%",  left: "65%",  size: 28, rotate: -8  },
  { src: "/icons/googlecalendar.svg", top: "27%",  left: "8%",   size: 30, rotate: 12  },
  { src: "/icons/todoist.svg",        top: "28%",  left: "85%",  size: 26, rotate: -10 },
  { src: "/icons/hubspot.svg",        top: "33%",  left: "22%",  size: 32, rotate: -5  },
  { src: "/icons/googledrive.svg",    top: "34%",  left: "72%",  size: 30, rotate: 7   },
  { src: "/icons/gmail.svg",          top: "40%",  left: "4%",   size: 28, rotate: 18  },
  { src: "/icons/notion.svg",         top: "41%",  left: "90%",  size: 34, rotate: -15 },
  { src: "/icons/googlecalendar.svg", top: "46%",  left: "35%",  size: 26, rotate: 9   },
  { src: "/icons/todoist.svg",        top: "47%",  left: "60%",  size: 30, rotate: -11 },
  { src: "/icons/hubspot.svg",        top: "53%",  left: "12%",  size: 28, rotate: 6   },
  { src: "/icons/googledrive.svg",    top: "54%",  left: "80%",  size: 32, rotate: -7  },
  { src: "/icons/gmail.svg",          top: "60%",  left: "25%",  size: 30, rotate: -13 },
  { src: "/icons/notion.svg",         top: "61%",  left: "68%",  size: 28, rotate: 14  },
  { src: "/icons/googlecalendar.svg", top: "67%",  left: "5%",   size: 34, rotate: -4  },
  { src: "/icons/todoist.svg",        top: "68%",  left: "88%",  size: 26, rotate: 11  },
  { src: "/icons/hubspot.svg",        top: "73%",  left: "40%",  size: 30, rotate: -9  },
  { src: "/icons/googledrive.svg",    top: "74%",  left: "55%",  size: 28, rotate: 5   },
  { src: "/icons/gmail.svg",          top: "80%",  left: "15%",  size: 32, rotate: 16  },
  { src: "/icons/notion.svg",         top: "81%",  left: "78%",  size: 30, rotate: -12 },
  { src: "/icons/googlecalendar.svg", top: "87%",  left: "3%",   size: 28, rotate: 7   },
  { src: "/icons/todoist.svg",        top: "88%",  left: "92%",  size: 32, rotate: -6  },
  { src: "/icons/hubspot.svg",        top: "93%",  left: "30%",  size: 26, rotate: 13  },
  { src: "/icons/googledrive.svg",    top: "94%",  left: "62%",  size: 34, rotate: -10 },
];

// ─── Individual logo spot ─────────────────────────────────────────────────────

function LogoSpot({
  logo, mouseX, mouseY, hasMovedMouse,
}: {
  logo: typeof LOGOS[0];
  mouseX: number;
  mouseY: number;
  hasMovedMouse: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [opacity, setOpacity] = useState(0);
  const RADIUS = 200;

  useEffect(() => {
    if (!hasMovedMouse || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const elX = rect.left + rect.width / 2;
    const elY = rect.top + rect.height / 2;
    // mouseX/mouseY are client-relative, getBoundingClientRect() is also client-relative
    // so no scroll adjustment needed — this works for both fixed and absolute elements
    const dist = Math.sqrt((mouseX - elX) ** 2 + (mouseY - elY) ** 2);
    const op = Math.max(0, 1 - dist / RADIUS);
    setOpacity(op);
  }, [mouseX, mouseY, hasMovedMouse]);

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        top: logo.top,
        left: logo.left,
        width: logo.size,
        height: logo.size,
        opacity,
        transition: "opacity 0.1s ease",
        transform: `rotate(${logo.rotate}deg)`,
        pointerEvents: "none",
        zIndex: 5,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={logo.src}
        alt=""
        width={logo.size}
        height={logo.size}
        style={{ width: "100%", height: "100%", filter: "invert(1) brightness(10) saturate(0)" }}
      />
    </div>
  );
}

// ─── Counter ──────────────────────────────────────────────────────────────────

function Counter({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      let start = 0;
      const step = Math.ceil(to / 60);
      const t = setInterval(() => {
        start = Math.min(start + step, to);
        setVal(start);
        if (start >= to) clearInterval(t);
      }, 16);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [to]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

// ─── Typewriter ───────────────────────────────────────────────────────────────

function Typewriter({ words }: { words: string[] }) {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);
  useEffect(() => {
    const word = words[idx % words.length]!;
    if (!deleting && displayed.length < word.length) {
      const t = setTimeout(() => setDisplayed(word.slice(0, displayed.length + 1)), 80);
      return () => clearTimeout(t);
    }
    if (!deleting && displayed.length === word.length) {
      const t = setTimeout(() => setDeleting(true), 1800);
      return () => clearTimeout(t);
    }
    if (deleting && displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 40);
      return () => clearTimeout(t);
    }
    if (deleting && displayed.length === 0) {
      setDeleting(false);
      setIdx((i) => i + 1);
    }
  }, [displayed, deleting, idx, words]);
  return (
    <span style={{ color: "#00E5A0" }}>
      {displayed}
      <span style={{
        display: "inline-block", width: 3, height: "0.85em",
        background: "#00E5A0", marginLeft: 4, verticalAlign: "middle",
        animation: "blink 1s step-end infinite",
      }} />
    </span>
  );
}

// ─── Flow Terminal ────────────────────────────────────────────────────────────

function FlowTerminal({ lines, color }: { lines: string[]; color: string }) {
  const [shown, setShown] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry?.isIntersecting) return;
      observer.disconnect();
      let i = 0;
      const t = setInterval(() => {
        i++;
        setShown(i);
        if (i >= lines.length) clearInterval(t);
      }, 500);
    });
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [lines.length]);
  return (
    <div ref={ref} style={{
      background: "#0A0908", border: `1px solid ${color}22`,
      borderRadius: 10, padding: "16px 20px",
      fontFamily: "DM Mono, monospace", fontSize: 12, minHeight: 160,
    }}>
      <div style={{ color: "#3A3830", marginBottom: 12, fontSize: 11 }}>● ● ●</div>
      {lines.slice(0, shown).map((line, i) => (
        <div key={i} style={{
          color: i === shown - 1 ? color : "#4A4840",
          marginBottom: 6, display: "flex", gap: 8, alignItems: "center",
        }}>
          <span style={{ color: "#2A2820" }}>$</span>
          <span>{line}</span>
          {i === shown - 1 && shown < lines.length && (
            <span style={{ width: 6, height: 12, background: color, display: "inline-block", animation: "blink 1s step-end infinite" }} />
          )}
          {i < shown - 1 && <span style={{ marginLeft: "auto", color: "#00C48A", fontSize: 11 }}>✓</span>}
        </div>
      ))}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);
  const [mouseX, setMouseX] = useState(-999);
  const [mouseY, setMouseY] = useState(-999);
  const [hasMovedMouse, setHasMovedMouse] = useState(false);
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", fn);
    return () => window.removeEventListener("scroll", fn);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      setHasMovedMouse(true);
      setMouseX(e.clientX);
      setMouseY(e.clientY);
      if (cursorRef.current) {
        cursorRef.current.style.left = `${e.clientX}px`;
        cursorRef.current.style.top = `${e.clientY}px`;
      }
    };
    window.addEventListener("mousemove", fn);
    return () => window.removeEventListener("mousemove", fn);
  }, []);

  const features = [
    {
      icon: "✉️", title: "Gmail, automated", subtitle: "Inbound email → action in seconds", color: "#00E5A0",
      lines: ["gmail.inbox.watch({ query: 'is:important' })", "todoist.task.create({ title: msg.subject })", "gmail.draft.reply({ tone: 'professional' })", "calendar.block({ duration: '30m' })", "slack.notify({ channel: '#team' })"],
    },
    {
      icon: "📅", title: "Calendar, defended", subtitle: "No more scheduling conflicts", color: "#7AADDC",
      lines: ["calendar.events.watch({ calendarId: 'primary' })", "calendar.conflicts.detect({ window: '7d' })", "gmail.draft.reschedule({ propose: 3 })", "notion.log({ type: 'conflict_history' })"],
    },
    {
      icon: "⚡", title: "Agent, always on", subtitle: "Natural language. Real actions.", color: "#F0A500",
      lines: ["nudge> email john about the Q3 proposal", "nudge> block 2pm for client prep", "nudge> find urgent unread from last week", "nudge> run flow 1 on rahul@acmecorp.in"],
    },
  ];

  const flows = [
    { num: "01", title: "Inbound Client Email", desc: "New important email → Todoist task → Gmail draft → Calendar block → Slack nudge", color: "#00E5A0" },
    { num: "02", title: "Follow-up Tracker", desc: "No reply after 3 days → Notion log → Calendar reminder → Slack nudge → Gmail draft", color: "#7AADDC" },
    { num: "03", title: "Meeting Conflict Resolver", desc: "Invite detected → Calendar checks overlaps → Slack alert → Gmail reschedule draft", color: "#A87DD0" },
    { num: "04", title: "Attachment Handler", desc: "Attachment detected → Approval gate → Google Drive save → Google Docs summary", color: "#F0A500" },
  ];

  const integrations = ["Gmail", "Google Calendar", "Slack", "Notion", "Todoist", "HubSpot", "Google Drive", "Google Docs"];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { background: #0C0B09; color: #EAE8E3; font-family: 'Space Grotesk', -apple-system, sans-serif; overflow-x: hidden; cursor: none; }
        @keyframes blink { 0%,100%{opacity:1}50%{opacity:0} }
        @keyframes pulse-mint { 0%,100%{box-shadow:0 0 0 0 #00E5A040}50%{box-shadow:0 0 0 12px #00E5A000} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)} }
        @keyframes marquee { from{transform:translateX(0)}to{transform:translateX(-50%)} }
        @keyframes grain { 0%,100%{transform:translate(0,0)}25%{transform:translate(-1%,-1%)}50%{transform:translate(1%,1%)}75%{transform:translate(-1%,1%)} }
        .grain-overlay {
          position: fixed; inset: 0; pointer-events: none; z-index: 9998; opacity: 0.04;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          animation: grain 0.3s steps(1) infinite;
        }
        .cursor {
          position: fixed; pointer-events: none; z-index: 99999;
          width: 18px; height: 18px; border-radius: 50%;
          background: rgba(0,229,160,0.12);
          border: 1px solid rgba(0,229,160,0.35);
          transform: translate(-50%, -50%);
          transition: width 0.2s, height 0.2s, background 0.2s;
        }
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2A2820;border-radius:2px}
        a{text-decoration:none;cursor:none}
        button{cursor:none}
      `}</style>

      {/* Grain overlay */}
      <div className="grain-overlay" />

      {/* Custom cursor */}
      <div ref={cursorRef} className="cursor" />

      {/* Page wrapper — logos are absolute inside this so they span the full page */}
      <div style={{ position: "relative" }}>
        {/* Spotlight logos distributed across full page height */}
        {LOGOS.map((logo, i) => (
          <LogoSpot
            key={i}
            logo={logo}
            mouseX={mouseX}
            mouseY={mouseY}
            hasMovedMouse={hasMovedMouse}
          />
        ))}

      {/* Nav */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        padding: "0 48px", height: 56,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: scrolled ? "#0C0B09EE" : "transparent",
        backdropFilter: scrolled ? "blur(12px)" : "none",
        borderBottom: scrolled ? "1px solid #1C1A17" : "none",
        transition: "all 0.3s",
      }}>
        <div style={{ display: "flex", alignItems: "center" }}>
          <Image src="/NudgeHQ_logo.png" alt="NudgeHQ" width={160} height={52} style={{ objectFit: "contain" }} />
        </div>
        <div style={{ display: "flex", gap: 32 }}>
          {["features", "flows", "integrations"].map((id) => (
            <a key={id} href={`#${id}`} style={{ color: "#6B6860", fontSize: 14, transition: "color 0.15s", textTransform: "capitalize" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "#EAE8E3")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "#6B6860")}
            >{id}</a>
          ))}
        </div>
        <button onClick={() => router.push("/dashboard")} style={{
          background: "#00E5A008", color: "#00E5A0",
          border: "none", borderLeft: "2px solid #00E5A0",
          padding: "6px 14px", borderRadius: 0, fontSize: 12, fontWeight: 500,
          transition: "all 0.15s", fontFamily: "DM Mono, monospace",
          letterSpacing: "0.01em",
        }}
          onMouseEnter={(e) => { e.currentTarget.style.background = "#00E5A015"; e.currentTarget.style.paddingLeft = "18px"; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = "#00E5A008"; e.currentTarget.style.paddingLeft = "14px"; }}
        >$ open-app →</button>
      </nav>

      {/* Hero */}
      <section style={{
        minHeight: "100vh", display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center",
        padding: "120px 40px 80px", textAlign: "center", position: "relative",
      }}>
        <div style={{
          position: "absolute", top: "40%", left: "50%", transform: "translate(-50%,-50%)",
          width: 700, height: 700, pointerEvents: "none",
          background: "radial-gradient(circle, #00E5A00A 0%, transparent 70%)",
        }} />

        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#00E5A010", border: "1px solid #00E5A030",
          borderRadius: 20, padding: "5px 14px", marginBottom: 32,
          animation: "fadeUp 0.6s ease forwards",
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00E5A0", display: "inline-block", animation: "pulse-mint 2s infinite" }} />
          <span style={{ fontSize: 12, color: "#00E5A0", fontFamily: "DM Mono, monospace" }}>ChaiCode × Corsair Hackathon</span>
        </div>

        <h1 style={{
          fontSize: "clamp(48px, 8vw, 112px)", fontWeight: 700,
          lineHeight: 1.0, letterSpacing: "-0.03em",
          color: "#EAE8E3", marginBottom: 20,
          animation: "fadeUp 0.7s 0.1s ease both", maxWidth: 900,
        }}>
          Your workflow,<br />
          <Typewriter words={["automated.", "defended.", "nudged.", "unleashed."]} />
        </h1>

        <p style={{
          fontSize: 18, color: "#6B6860", maxWidth: 500,
          lineHeight: 1.65, marginBottom: 40,
          animation: "fadeUp 0.7s 0.2s ease both",
        }}>
          NudgeHQ connects Gmail and Google Calendar to your entire stack — then runs the flows that used to eat your day.
        </p>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center", animation: "fadeUp 0.7s 0.3s ease both" }}>
          <button onClick={() => router.push("/dashboard")} style={{
            background: "#00E5A010", color: "#00E5A0",
            border: "none", borderLeft: "2px solid #00E5A0",
            padding: "14px 24px", borderRadius: 0, fontSize: 14, fontWeight: 500,
            transition: "all 0.2s", fontFamily: "DM Mono, monospace",
            letterSpacing: "0.01em",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#00E5A01A"; e.currentTarget.style.paddingLeft = "30px"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#00E5A010"; e.currentTarget.style.paddingLeft = "24px"; }}
          >$ run-flow --first</button>
          <a href="#features" style={{
            color: "#4A4840", fontSize: 13, padding: "14px 16px",
            borderLeft: "2px solid #2A2820",
            fontFamily: "DM Mono, monospace",
            transition: "all 0.15s", letterSpacing: "0.01em",
          }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#EAE8E3"; (e.currentTarget as HTMLElement).style.borderLeftColor = "#4A4840"; (e.currentTarget as HTMLElement).style.paddingLeft = "22px"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "#4A4840"; (e.currentTarget as HTMLElement).style.borderLeftColor = "#2A2820"; (e.currentTarget as HTMLElement).style.paddingLeft = "16px"; }}
          >$ see-how ↓</a>
        </div>

        <div style={{ display: "flex", gap: 56, marginTop: 80, flexWrap: "wrap", justifyContent: "center", animation: "fadeUp 0.7s 0.4s ease both" }}>
          {[{ n: 9, suf: " apps", label: "connected" }, { n: 4, suf: " flows", label: "automated" }, { n: 100, suf: "%", label: "Corsair-powered" }].map(({ n, suf, label }) => (
            <div key={label} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 40, fontWeight: 700, color: "#EAE8E3", lineHeight: 1 }}><Counter to={n} suffix={suf} /></div>
              <div style={{ fontSize: 11, color: "#4A4840", marginTop: 6, fontFamily: "DM Mono, monospace" }}>{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" style={{ padding: "100px 48px", maxWidth: 1100, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 64 }}>
          <div style={{ fontSize: 11, color: "#00E5A0", fontFamily: "DM Mono, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>WHAT IT DOES</div>
          <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, letterSpacing: "-0.02em" }}>Three things.<br />All automated.</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 20 }}>
          {features.map((f) => (
            <div key={f.title} style={{
              background: "#0F0E0C", border: "1px solid #1C1A17",
              borderRadius: 12, padding: 28, transition: "border-color 0.2s",
            }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = f.color + "44")}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#1C1A17")}
            >
              <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#4A4840", marginBottom: 20, fontFamily: "DM Mono, monospace" }}>{f.subtitle}</div>
              <FlowTerminal lines={f.lines} color={f.color} />
            </div>
          ))}
        </div>
      </section>

      {/* Flows */}
      <section id="flows" style={{ padding: "100px 48px", background: "#0A0908" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: 64 }}>
            <div style={{ fontSize: 11, color: "#00E5A0", fontFamily: "DM Mono, monospace", marginBottom: 12, letterSpacing: "0.1em" }}>AUTOMATION FLOWS</div>
            <h2 style={{ fontSize: "clamp(32px, 4vw, 52px)", fontWeight: 700, letterSpacing: "-0.02em" }}>Four flows.<br />Infinite leverage.</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
            {flows.map((f) => (
              <div key={f.num} style={{
                background: "#0C0B09", border: "1px solid #1C1A17",
                borderRadius: 12, padding: 24,
                transition: "transform 0.2s, border-color 0.2s",
              }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(-4px)"; (e.currentTarget as HTMLElement).style.borderColor = f.color + "44"; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.borderColor = "#1C1A17"; }}
              >
                <div style={{ fontSize: 11, color: f.color, fontFamily: "DM Mono, monospace", marginBottom: 12 }}>Flow {f.num}</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 10 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: "#4A4840", lineHeight: 1.6, fontFamily: "DM Mono, monospace" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Integrations marquee */}
      <section id="integrations" style={{ padding: "80px 0", overflow: "hidden" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{ fontSize: 11, color: "#4A4840", fontFamily: "DM Mono, monospace", letterSpacing: "0.1em" }}>POWERED BY 9 INTEGRATIONS VIA CORSAIR</div>
        </div>
        <div style={{ display: "flex", overflow: "hidden", maskImage: "linear-gradient(to right, transparent, black 10%, black 90%, transparent)" }}>
          <div style={{ display: "flex", gap: 16, animation: "marquee 25s linear infinite", whiteSpace: "nowrap", flexShrink: 0 }}>
            {[...integrations, ...integrations, ...integrations].map((name, i) => (
              <div key={i} style={{
                background: "#0F0E0C", border: "1px solid #1C1A17",
                borderRadius: 8, padding: "10px 20px",
                fontSize: 13, color: "#6B6860", fontWeight: 500, flexShrink: 0,
              }}>{name}</div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: "120px 48px", textAlign: "center" }}>
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          <h2 style={{ fontSize: "clamp(36px, 5vw, 64px)", fontWeight: 700, letterSpacing: "-0.02em", marginBottom: 20, lineHeight: 1.1 }}>
            Stop managing.<br />
            <span style={{ color: "#00E5A0" }}>Start nudging.</span>
          </h2>
          <p style={{ fontSize: 16, color: "#6B6860", marginBottom: 40, lineHeight: 1.65 }}>
            Your inbox is waiting. Your calendar is full. NudgeHQ handles both.
          </p>
          <button onClick={() => router.push("/dashboard")} style={{
            background: "#00E5A010", color: "#00E5A0",
            border: "none", borderLeft: "2px solid #00E5A0",
            padding: "16px 28px", borderRadius: 0, fontSize: 14, fontWeight: 500,
            transition: "all 0.2s", fontFamily: "DM Mono, monospace",
            letterSpacing: "0.01em",
          }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "#00E5A01A"; e.currentTarget.style.paddingLeft = "36px"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "#00E5A010"; e.currentTarget.style.paddingLeft = "28px"; }}
          >$ get-started --free</button>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ padding: "24px 48px", borderTop: "1px solid #1C1A17", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Image src="/NudgeHQ_logo.png" alt="NudgeHQ" width={110} height={36} style={{ objectFit: "contain" }} />
          <span style={{ fontSize: 13, color: "#4A4840" }}>— Your workflow, automated</span>
        </div>
        <span style={{ fontSize: 12, color: "#2A2820", fontFamily: "DM Mono, monospace" }}>Built with Corsair #chaicode</span>
      </footer>
      </div> {/* end page wrapper */}
    </>
  );
}
