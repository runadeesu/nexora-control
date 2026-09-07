import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { env, publicAppUrl } from "@/lib/config";
import { oauthRedirectUri } from "@/lib/discord";
import { setSession } from "@/lib/session";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const expected = jar.get("nexora_oauth_state")?.value;
  jar.delete("nexora_oauth_state");

  if (!code || !state || !expected || state !== expected) {
    return NextResponse.redirect(`${publicAppUrl()}/?error=oauth_state`);
  }

  const body = new URLSearchParams({
    client_id: env("DISCORD_CLIENT_ID"),
    client_secret: env("DISCORD_CLIENT_SECRET"),
    grant_type: "authorization_code",
    code,
    redirect_uri: oauthRedirectUri(),
  });

  const tokenRes = await fetch("https://discord.com/api/v10/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
    cache: "no-store",
  });

  if (!tokenRes.ok) {
    return NextResponse.redirect(`${publicAppUrl()}/?error=oauth_token`);
  }

  const token = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  await setSession({
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
    expiresAt: Date.now() + Math.max(60, token.expires_in - 60) * 1000,
  });

  return NextResponse.redirect(`${publicAppUrl()}/`);
}
