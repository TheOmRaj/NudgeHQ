import { NextRequest, NextResponse } from "next/server";
import { corsair } from "~/server/corsair";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      console.error("[connect/callback] OAuth error:", error);
      return NextResponse.redirect(new URL("/connect?error=oauth_denied", req.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/connect?error=missing_params", req.url));
    }

    // Decode state to get plugin + tenantId
    // state = `${payload}.${sig}` where payload = base64url({ plugin, tenantId, iat })
    const payloadPart = state.includes(".") ? state.split(".")[0] : state;
    let plugin: string;
    let tenantId: string;

    try {
      const decoded = JSON.parse(Buffer.from(payloadPart!, "base64url").toString("utf-8"));
      plugin = decoded.plugin;
      tenantId = decoded.tenantId;
    } catch {
      return NextResponse.redirect(new URL("/connect?error=invalid_state", req.url));
    }

    if (!plugin || !tenantId) {
      return NextResponse.redirect(new URL("/connect?error=invalid_state", req.url));
    }

    // Exchange code for tokens using Corsair CLI
    // corsair auth -p gmail -t userId -c code -s state
    const { execSync } = await import("child_process");

    try {
      execSync(
        `npx @corsair-dev/cli auth -p ${plugin} -t ${tenantId} -c "${code}" -s "${state}"`,
        { cwd: process.cwd(), stdio: "pipe", timeout: 30000 }
      );
    } catch (cliErr) {
      console.error("[connect/callback] CLI exchange error:", cliErr);
      return NextResponse.redirect(new URL(`/connect?error=token_exchange_failed&plugin=${plugin}`, req.url));
    }

    // Check if more plugins need connecting
    // After gmail, redirect to connect googlecalendar, then googledrive, then dashboard
    const connectOrder = ["gmail", "googlecalendar", "googledrive"];
    const currentIndex = connectOrder.indexOf(plugin);
    const nextPlugin = connectOrder[currentIndex + 1];

    if (nextPlugin) {
      return NextResponse.redirect(new URL(`/connect?connected=${plugin}&next=${nextPlugin}`, req.url));
    }

    // All done
    return NextResponse.redirect(new URL("/dashboard?connected=true", req.url));
  } catch (err) {
    console.error("[connect/callback] fatal error:", err);
    return NextResponse.redirect(new URL("/connect?error=unknown", req.url));
  }
}
