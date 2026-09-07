import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  assertCanManageGuild,
  botDiscordFetch,
  botInstallUrl,
  DiscordChannel,
  DiscordRole,
} from "@/lib/discord";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ guildId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Login required" }, { status: 401 });

  const { guildId } = await context.params;
  try {
    const guild = await assertCanManageGuild(session.accessToken, guildId);
    const botGuild = await botDiscordFetch<{ id: string; name: string }>(`/guilds/${guildId}`).catch(() => null);

    if (!botGuild) {
      return NextResponse.json({
        guild: { id: guild.id, name: guild.name },
        botInstalled: false,
        installUrl: botInstallUrl(guildId),
      });
    }

    const [channels, roles] = await Promise.all([
      botDiscordFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`),
      botDiscordFetch<DiscordRole[]>(`/guilds/${guildId}/roles`),
    ]);

    const managedChannels = channels.filter(
      (c) =>
        c.name.startsWith("📌") ||
        c.name.startsWith("🎮") ||
        c.name.startsWith("🛠") ||
        c.name.startsWith("💬") ||
        c.name.startsWith("🐛") ||
        c.name.startsWith("🧪") ||
        c.name.startsWith("🎙") ||
        c.name.startsWith("🔒") ||
        [
          "welcome",
          "rules",
          "announcements",
          "studio-news",
          "roles",
          "faq",
          "our-games",
          "upcoming-games",
          "release-news",
          "game-updates",
          "dev-log",
          "work-in-progress",
          "screenshots",
          "concept-art",
          "trailers",
          "behind-the-scenes",
          "general",
          "gaming",
          "screenshots-and-clips",
          "suggestions",
          "off-topic",
          "memes",
          "bug-reports",
          "game-feedback",
          "feature-requests",
          "known-issues",
          "beta-news",
          "beta-chat",
          "tester-feedback",
          "staff-chat",
          "studio-planning",
          "game-planning",
          "release-planning",
          "bug-tracking",
          "moderation",
          "staff-logs",
        ].includes(c.name),
    );

    return NextResponse.json({
      guild: { id: guild.id, name: guild.name },
      botInstalled: true,
      installUrl: botInstallUrl(guildId),
      counts: {
        channels: channels.length,
        roles: roles.length,
        nexoraManaged: managedChannels.length,
      },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed" }, { status: 403 });
  }
}
