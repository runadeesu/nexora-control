import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { env } from "@/lib/config";
import { oauthRedirectUri } from "@/lib/discord";

export async function GET() {
  const state = crypto.randomBytes(24).toString("hex");
  const jar = await cookies();
  jar.set("nexora_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url = new URL("https://discord.com/oauth2/authorize");
  url.searchParams.set("client_id", env("DISCORD_CLIENT_ID"));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", oauthRedirectUri());
  url.searchParams.set("scope", "identify guilds");
  url.searchParams.set("state", state);
  url.searchParams.set("prompt", "consent");
  return NextResponse.redirect(url);
}
