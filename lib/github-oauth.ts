// GitHub OAuth helper. Server-side only — access tokens never leave the
// backend. The signed state cookie binds the OAuth callback to the wallet
// that started the flow, so a stranger cannot complete a callback against
// someone else's wallet.

import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getEnv, requireEnv } from "./env";

const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

interface StatePayload {
  wallet: string;
  nonce: string;
  exp: number; // epoch ms
}

function signingSecret(): string {
  // Reuse INDEXER_SECRET as the HMAC key if a dedicated OAUTH_STATE_SECRET
  // is not set. Either is fine — what matters is that it is server-only.
  return (
    getEnv("INDEXER_SECRET") ||
    requireEnv("VERIFIER_PRIVATE_KEY") // last resort; always present
  );
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf)
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromB64url(s: string): Buffer {
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

export function buildState(wallet: string): string {
  const payload: StatePayload = {
    wallet: wallet.toLowerCase(),
    nonce: randomBytes(16).toString("hex"),
    exp: Date.now() + STATE_TTL_MS,
  };
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(
    createHmac("sha256", signingSecret()).update(body).digest()
  );
  return `${body}.${sig}`;
}

export function verifyState(state: string): StatePayload | null {
  const [body, sig] = state.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", signingSecret())
    .update(body)
    .digest();
  const provided = fromB64url(sig);
  if (expected.length !== provided.length) return null;
  if (!timingSafeEqual(expected, provided)) return null;

  let payload: StatePayload;
  try {
    payload = JSON.parse(fromB64url(body).toString("utf-8"));
  } catch {
    return null;
  }
  if (!payload.wallet || !payload.exp || Date.now() > payload.exp) return null;
  return payload;
}

export function authorizeUrl(state: string): string {
  const clientId = requireEnv("GITHUB_OAUTH_CLIENT_ID");
  const redirect = requireEnv("GITHUB_OAUTH_REDIRECT_URI");
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirect,
    scope: "read:user",
    state,
    allow_signup: "true",
  });
  return `https://github.com/login/oauth/authorize?${params.toString()}`;
}

export interface GithubUser {
  id: number;
  login: string;
  avatar_url: string;
  html_url: string;
}

export async function exchangeCodeForUser(code: string): Promise<GithubUser> {
  const clientId = requireEnv("GITHUB_OAUTH_CLIENT_ID");
  const clientSecret = requireEnv("GITHUB_OAUTH_CLIENT_SECRET");
  const redirect = requireEnv("GITHUB_OAUTH_REDIRECT_URI");

  // 1. Exchange code → access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirect,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Token exchange failed: HTTP ${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    error?: string;
    error_description?: string;
  };
  if (!tokenJson.access_token) {
    throw new Error(
      `Token exchange failed: ${tokenJson.error_description || tokenJson.error || "no access_token"}`
    );
  }

  // 2. Fetch the user with that token. Discard the token immediately —
  // we only ever need to know the GitHub identity.
  const userRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });
  if (!userRes.ok) {
    throw new Error(`GitHub /user failed: HTTP ${userRes.status}`);
  }
  const user = (await userRes.json()) as GithubUser;
  return user;
}
