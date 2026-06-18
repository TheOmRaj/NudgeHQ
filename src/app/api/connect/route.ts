import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { resolveConnectLink } from "corsair";
import { corsair } from "~/server/corsair";

export async function GET(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.redirect(new URL("/sign-in", req.url));
    }

    const plugin = req.nextUrl.searchParams.get("plugin");
    if (!plugin) {
      return NextResponse.json({ error: "plugin param required" }, { status: 400 });
    }

    // Generate a signed state token: encodes plugin + tenantId (userId)
    // resolveConnectLink(corsairInstance, stateToken) → { oauthUrl }
    // But we need to CREATE the state first using the internal helper.
    // The state is: base64url({ plugin, tenantId, iat }) signed with kek
    // We can build this by calling the internal function via the management API,
    // OR we call the CLI auth flow. Instead, we use the Corsair SDK's own
    // resolveConnectLink which takes (corsair, state) — but state must be pre-signed.
    //
    // Looking at the source: ze(plugin, tenantId) builds the payload,
    // Ge(payload, kek) signs it. These are internal.
    // The CLI uses --session to generate the state server-side.
    //
    // Simplest approach: spawn the CLI to get the auth URL, capture it.

    const { execSync } = await import("child_process");

    // Run CLI in listen mode briefly to get the auth URL printed to stdout
    // corsair auth -p gmail -t userId --listen (prints URL then waits for callback)
    // We can't use --listen (blocks), so we use a trick:
    // corsair auth -p gmail -t userId -s <session> -c <code> won't work without code.
    //
    // ACTUAL approach from the source:
    // nt(corsairInstance, stateToken) is resolveConnectLink
    // It calls: Ge(ze(plugin, tenantId), kek) internally
    // ze = encode({ plugin, tenantId, iat }) as base64url
    // Ge = HMAC-SHA256 sign → `${payload}.${sig}`
    // We can replicate this in Node since we have the kek.

    const crypto = await import("crypto");
    const kek = process.env.CORSAIR_KEK!;

    // Replicate ze(plugin, tenantId)
    const payload = Buffer.from(
      JSON.stringify({ plugin, tenantId: userId, iat: Date.now() })
    ).toString("base64url");

    // Replicate Ge(payload, kek) — HMAC-SHA256
    const sig = crypto.createHmac("sha256", kek).update(payload).digest("base64url");
    const state = `${payload}.${sig}`;

    // Now call resolveConnectLink(corsair, state)
    // @ts-ignore
    const { oauthUrl } = await resolveConnectLink(corsair, state);

    return NextResponse.redirect(oauthUrl);
  } catch (err) {
    console.error("[connect] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
