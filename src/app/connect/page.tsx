"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PLUGINS = [
  {
    id: "gmail",
    name: "Gmail",
    icon: "/icons/gmail.svg",
    description: "Read, search, and draft emails",
  },
  {
    id: "googlecalendar",
    name: "Google Calendar",
    icon: "/icons/googlecalendar.svg",
    description: "View and create calendar events",
  },
  {
    id: "googledrive",
    name: "Google Drive",
    icon: "/icons/googledrive.svg",
    description: "Save attachments and files",
  },
];

function ConnectPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const connected = searchParams.get("connected");
  const next = searchParams.get("next");
  const error = searchParams.get("error");

  const [connectedPlugins, setConnectedPlugins] = useState<string[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    if (connected) {
      setConnectedPlugins((prev) =>
        prev.includes(connected) ? prev : [...prev, connected]
      );
    }
  }, [connected]);

  // Auto-redirect to next plugin if coming back from OAuth
  useEffect(() => {
    if (next && connected) {
      // Small delay so user sees success state
      const timer = setTimeout(() => {
        setIsConnecting(true);
        window.location.href = `/api/connect?plugin=${next}`;
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [next, connected]);

  const handleConnect = (pluginId: string) => {
    setIsConnecting(true);
    window.location.href = `/api/connect?plugin=${pluginId}`;
  };

  const allConnected = PLUGINS.every((p) => connectedPlugins.includes(p.id));

  useEffect(() => {
    if (allConnected) {
      router.push("/dashboard");
    }
  }, [allConnected, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0A0908",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "'Space Grotesk', sans-serif",
        padding: "2rem",
      }}
    >
      {/* Logo */}
      <div style={{ marginBottom: "2.5rem", textAlign: "center" }}>
        <img src="/NudgeHQ_logo.png" alt="NudgeHQ" style={{ height: 40, marginBottom: 16 }} />
        <h1 style={{ color: "#fff", fontSize: "1.75rem", fontWeight: 700, margin: 0 }}>
          Connect your accounts
        </h1>
        <p style={{ color: "#888", marginTop: 8, fontSize: "0.95rem" }}>
          NudgeHQ needs access to your Google workspace to automate your flows.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          style={{
            background: "rgba(255,80,80,0.1)",
            border: "1px solid rgba(255,80,80,0.3)",
            borderRadius: 8,
            padding: "12px 20px",
            color: "#ff6b6b",
            marginBottom: 24,
            fontSize: "0.9rem",
          }}
        >
          {error === "oauth_denied"
            ? "You denied access. Please connect to use NudgeHQ."
            : error === "token_exchange_failed"
            ? "Token exchange failed. Please try again."
            : "Something went wrong. Please try again."}
        </div>
      )}

      {/* Plugin cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 16, width: "100%", maxWidth: 480 }}>
        {PLUGINS.map((plugin, index) => {
          const isConnected = connectedPlugins.includes(plugin.id);
          const isCurrent = !connected
            ? index === 0
            : next === plugin.id && !isConnected;
          const isPending = !isConnected && !isCurrent;

          return (
            <div
              key={plugin.id}
              style={{
                background: isConnected
                  ? "rgba(0,229,160,0.08)"
                  : isCurrent
                  ? "rgba(255,255,255,0.05)"
                  : "rgba(255,255,255,0.02)",
                border: `1px solid ${
                  isConnected
                    ? "rgba(0,229,160,0.4)"
                    : isCurrent
                    ? "rgba(255,255,255,0.15)"
                    : "rgba(255,255,255,0.06)"
                }`,
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 16,
                transition: "all 0.2s",
              }}
            >
              <img
                src={plugin.icon}
                alt={plugin.name}
                style={{ width: 36, height: 36, opacity: isPending ? 0.4 : 1 }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ color: isPending ? "#555" : "#fff", fontWeight: 600, fontSize: "0.95rem" }}>
                  {plugin.name}
                </div>
                <div style={{ color: "#666", fontSize: "0.82rem", marginTop: 2 }}>
                  {plugin.description}
                </div>
              </div>
              {isConnected ? (
                <div
                  style={{
                    color: "#00E5A0",
                    fontSize: "0.85rem",
                    fontWeight: 600,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>✓</span> Connected
                </div>
              ) : isCurrent ? (
                <button
                  onClick={() => handleConnect(plugin.id)}
                  disabled={isConnecting}
                  style={{
                    background: "#00E5A0",
                    color: "#0A0908",
                    border: "none",
                    borderRadius: 8,
                    padding: "8px 18px",
                    fontWeight: 700,
                    fontSize: "0.85rem",
                    cursor: isConnecting ? "not-allowed" : "pointer",
                    opacity: isConnecting ? 0.7 : 1,
                    fontFamily: "'Space Grotesk', sans-serif",
                    whiteSpace: "nowrap",
                  }}
                >
                  {isConnecting ? "Redirecting…" : "Connect →"}
                </button>
              ) : (
                <div style={{ color: "#444", fontSize: "0.85rem" }}>Pending</div>
              )}
            </div>
          );
        })}
      </div>

      <p style={{ color: "#444", fontSize: "0.8rem", marginTop: 32, textAlign: "center", maxWidth: 380 }}>
        Your credentials are encrypted and stored securely. NudgeHQ never stores your emails.
      </p>
    </div>
  );
}

import { Suspense } from "react";
export default function ConnectPage() {
  return (
    <Suspense fallback={null}>
      <ConnectPageInner />
    </Suspense>
  );
}
