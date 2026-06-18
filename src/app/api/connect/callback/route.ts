import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://nudgehq.tech";
const REDIRECT_URI = `${BASE_URL}/api/connect/callback`;

// Direct token exchange with Google — no CLI needed
async function exchangeCodeForTokens(code: string, clientId: string, clientSecret: string) {
  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT_URI,
    grant_type: "authorization_code",
  });

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    scope: string;
    token_type: string;
  }>;
}

// Encrypt a value using AES-256-GCM with the DEK
async function encryptWithDek(value: string, dekHex: string): Promise<string> {
  const crypto = await import("crypto");
  const dek = Buffer.from(dekHex, "base64");
  const iv = crypto.randomBytes(12);
  const authTagLength = 16;
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv, { authTagLength });
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(":");
}

// Decrypt a value using AES-256-GCM with the DEK
async function decryptWithDek(encrypted: string, dekHex: string): Promise<string> {
  const crypto = await import("crypto");
  const [ivB64, tagB64, dataB64] = encrypted.split(":");
  const dek = Buffer.from(dekHex, "base64");
  const iv = Buffer.from(ivB64!, "base64");
  const tag = Buffer.from(tagB64!, "base64");
  const data = Buffer.from(dataB64!, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

// Decrypt DEK using KEK (scrypt-based)
async function decryptDek(encryptedDek: string, kek: string): Promise<string> {
  const crypto = await import("crypto");
  const { promisify } = await import("util");
  const scrypt = promisify(crypto.scrypt);

  const [saltB64, ivB64, tagB64, dataB64] = encryptedDek.split(":");
  const salt = Buffer.from(saltB64!, "base64");
  const iv = Buffer.from(ivB64!, "base64");
  const tag = Buffer.from(tagB64!, "base64");
  const data = Buffer.from(dataB64!, "base64");

  const derivedKey = await scrypt(kek, salt, 32) as Buffer;
  const decipher = crypto.createDecipheriv("aes-256-gcm", derivedKey, iv, { authTagLength: 16 });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export async function GET(req: NextRequest) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

    // Decode state
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

    const kek = process.env.CORSAIR_KEK!;

    // Get integration (contains client_id, client_secret encrypted with integration DEK)
    const integResult = await pool.query(
      "SELECT id, config, dek FROM corsair_integrations WHERE name = $1",
      [plugin]
    );

    if (!integResult.rows[0]) {
      console.error(`[connect/callback] Integration '${plugin}' not found`);
      return NextResponse.redirect(new URL(`/connect?error=integration_not_found`, req.url));
    }

    const integration = integResult.rows[0];
    const integDek = await decryptDek(integration.dek, kek);
    const integConfig = typeof integration.config === "string"
      ? JSON.parse(integration.config)
      : integration.config;

    // Decrypt client credentials
    const clientId = await decryptWithDek(integConfig.client_id, integDek);
    const clientSecret = await decryptWithDek(integConfig.client_secret, integDek);

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code, clientId, clientSecret);

    if (!tokens.refresh_token) {
      console.error("[connect/callback] No refresh token returned — user may need to re-authorize");
      return NextResponse.redirect(new URL(`/connect?error=no_refresh_token&plugin=${plugin}`, req.url));
    }

    // Get or create account row for this tenant + integration
    let accountResult = await pool.query(
      "SELECT id, dek FROM corsair_accounts WHERE tenant_id = $1 AND integration_id = $2",
      [tenantId, integration.id]
    );

    let accountId: string;
    let accountDek: string;

    if (!accountResult.rows[0]) {
      // Create new account + DEK
      const crypto = await import("crypto");
      const { promisify } = await import("util");
      const scrypt = promisify(crypto.scrypt);

      // Generate new DEK
      const newDek = crypto.randomBytes(32).toString("base64");

      // Encrypt DEK with KEK
      const salt = crypto.randomBytes(16);
      const derivedKey = await scrypt(kek, salt, 32) as Buffer;
      const iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv("aes-256-gcm", derivedKey, iv, { authTagLength: 16 });
      const encData = Buffer.concat([cipher.update(newDek, "utf8"), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const encryptedDek = [salt.toString("base64"), iv.toString("base64"), authTag.toString("base64"), encData.toString("base64")].join(":");

      const insertResult = await pool.query(
        `INSERT INTO corsair_accounts (id, tenant_id, integration_id, config, dek, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, '{}', $3, NOW(), NOW())
         RETURNING id`,
        [tenantId, integration.id, encryptedDek]
      );
      accountId = insertResult.rows[0].id;
      accountDek = newDek;
    } else {
      accountId = accountResult.rows[0].id;
      accountDek = await decryptDek(accountResult.rows[0].dek, kek);
    }

    // Encrypt tokens with account DEK and store
    const expiresAt = String(Math.floor(Date.now() / 1000) + tokens.expires_in);
    const encAccessToken = await encryptWithDek(tokens.access_token, accountDek);
    const encRefreshToken = await encryptWithDek(tokens.refresh_token, accountDek);
    const encExpiresAt = await encryptWithDek(expiresAt, accountDek);

    const newConfig = {
      access_token: encAccessToken,
      refresh_token: encRefreshToken,
      expires_at: encExpiresAt,
    };

    await pool.query(
      "UPDATE corsair_accounts SET config = $1, updated_at = NOW() WHERE id = $2",
      [JSON.stringify(newConfig), accountId]
    );

    console.log(`[connect/callback] ✅ Stored tokens for tenant=${tenantId} plugin=${plugin}`);

    // Redirect to next plugin or dashboard
    const connectOrder = ["gmail", "googlecalendar", "googledrive"];
    const currentIndex = connectOrder.indexOf(plugin);
    const nextPlugin = connectOrder[currentIndex + 1];

    if (nextPlugin) {
      return NextResponse.redirect(new URL(`/connect?connected=${plugin}&next=${nextPlugin}`, req.url));
    }

    return NextResponse.redirect(new URL("/dashboard?connected=true", req.url));

  } catch (err) {
    console.error("[connect/callback] fatal error:", err);
    return NextResponse.redirect(new URL(`/connect?error=unknown`, req.url));
  } finally {
    await pool.end();
  }
}
