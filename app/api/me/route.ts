import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { getManageableGuilds, guildIconUrl, userDiscordFetch } from "@/lib/discord";

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ authenticated: false }, { status: 401 });

  try {
    const [user, guilds] = await Promise.all([
      userDiscordFetch<{ id: string; username: string; global_name: string | null; avatar: string | null }>(
        "/users/@me",
        session.accessToken,
      ),
      getManageableGuilds(session.accessToken),
    ]);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        username: user.username,
        displayName: user.global_name || user.username,
        avatarUrl: user.avatar
          ? `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=96`
          : null,
      },
      guilds: guilds.map((g) => ({
        id: g.id,
        name: g.name,
        owner: g.owner,
        iconUrl: guildIconUrl(g),
      })),
      createServerUrl: "https://discord.com/channels/@me",
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
