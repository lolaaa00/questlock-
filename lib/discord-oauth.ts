// Discord OAuth helper, mirroring lib/github-oauth.ts. Server-side only.
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getEnv, requireEnv } from "./env";

const STATE_TTL_MS = 10 * 60 * 1000;

interface StatePayload { wallet: string; nonce: string; exp: number; }

function signingSecret(): string {
  return getEnv("INDEXER_SECRET") || requireEnv("VERIFIER_PRIVATE_KEY");
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/=+$/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}
function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function buildDiscordState(wallet: string): string {
  const payload: StatePayload = {
    wallet: wallet.toLowerCase(),
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(createHmac("sha256", signingSecret()).update(body).digest());
  return `${body}.${sig}`;
}

export function verifyDiscordState(state: string): StatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;
  const expected = createHmac("sha256", signingSecret()).update(body).digest();
  const provided = fromB64url(sig);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;
  try {
    const p = JSON.parse(fromB64url(body).toString("utf-8"));
    if (!p.wallet || !p.exp || Date.now() > p.exp) return null;
    return p as StatePayload;
  } catch { return null; }
}

export function discordAuthorizeUrl(state: string): string {
  const clientId = requireEnv("DISCORD_OAUTH_CLIENT_ID" as never);
  const redirect = requireEnv("DISCORD_OAUTH_REDIRECT_URI" as never);
  const params = new URLSearchParams({
    client_id: clientId, redirect_uri: redirect, response_type: "code",
    scope: "identify", state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface DiscordUser { id: string; username: string; avatar: string | null; }

export async function exchangeDiscordCodeForUser(code: string): Promise<DiscordUser> {
  const clientId = requireEnv("DISCORD_OAUTH_CLIENT_ID" as never);
  const clientSecret = requireEnv("DISCORD_OAUTH_CLIENT_SECRET" as never);
  const redirect = requireEnv("DISCORD_OAUTH_REDIRECT_URI" as never);

  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId, client_secret: clientSecret,
      grant_type: "authorization_code", code, redirect_uri: redirect,
    }),
  });
  if (!tokenRes.ok) throw new Error(`Discord token exchange failed: ${tokenRes.status}`);
  const tokenJson = (await tokenRes.json()) as { access_token?: string };
  if (!tokenJson.access_token) throw new Error("No access_token from Discord");

  const userRes = await fetch("https://discord.com/api/v10/users/@me", {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  if (!userRes.ok) throw new Error(`Discord /users/@me failed: ${userRes.status}`);
  return (await userRes.json()) as DiscordUser;
}
