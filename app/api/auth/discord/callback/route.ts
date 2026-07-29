import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { exchangeDiscordCodeForUser, verifyDiscordState } from "@/lib/discord-oauth";
import { getEnv } from "@/lib/env";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const appBase = getEnv("NEXT_PUBLIC_APP_URL") || "http://localhost:3000";
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");

  if (!code || !state) return NextResponse.redirect(`${appBase}/me?discord=missing_params`);
  const payload = verifyDiscordState(state);
  if (!payload) return NextResponse.redirect(`${appBase}/me?discord=invalid_state`);

  let user;
  try {
    user = await exchangeDiscordCodeForUser(code);
  } catch (err) {
    await log("error", "auth/discord/callback", "Discord exchange failed", { error: (err as Error).message });
    return NextResponse.redirect(`${appBase}/me?discord=exchange_failed`);
  }

  // Conflict check — same Discord id linked to a different wallet
  const conflict = await prisma.discordConnection.findFirst({
    where: { discord_id: user.id, NOT: { wallet_address: payload.wallet } },
  });
  if (conflict) return NextResponse.redirect(`${appBase}/me?discord=already_linked`);

  await prisma.discordConnection.upsert({
    where: { wallet_address: payload.wallet },
    update: {
      discord_id: user.id, discord_username: user.username,
      discord_avatar_url: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
      revoked_at: null,
    },
    create: {
      wallet_address: payload.wallet,
      discord_id: user.id, discord_username: user.username,
      discord_avatar_url: user.avatar
        ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`
        : null,
    },
  });
  await log("info", "auth/discord/callback", "Discord linked", { wallet: payload.wallet, discordId: user.id });
  return NextResponse.redirect(`${appBase}/me?discord=linked`);
}
