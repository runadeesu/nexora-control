import { BOT_PERMISSION_BITS, DISCORD_API, env, publicAppUrl } from "./config";

export type DiscordGuild = {
  id: string;
  name: string;
  icon: string | null;
  owner?: boolean;
  owner_id?: string;
  permissions?: string;
  verification_level?: number;
  default_message_notifications?: number;
  explicit_content_filter?: number;
  afk_channel_id?: string | null;
  afk_timeout?: number;
  system_channel_id?: string | null;
  system_channel_flags?: number;
  preferred_locale?: string;
  description?: string | null;
  features?: string[];
};

export type DiscordOverwrite = {
  id: string;
  type: 0 | 1;
  allow: string;
  deny: string;
};

export type DiscordChannel = {
  id: string;
  guild_id?: string;
  name: string;
  type: number;
  position?: number;
  parent_id: string | null;
  topic?: string | null;
  nsfw?: boolean;
  rate_limit_per_user?: number;
  bitrate?: number;
  user_limit?: number;
  permission_overwrites?: DiscordOverwrite[];
};

export type DiscordRole = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  permissions: string;
  color?: number;
  hoist?: boolean;
  mentionable?: boolean;
};

export type DiscordUser = { id: string; username: string; bot?: boolean };
export type DiscordMember = { roles: string[]; user?: DiscordUser };

const ADMINISTRATOR = 1n << 3n;
const MANAGE_GUILD = 1n << 5n;

export function canManageGuild(guild: DiscordGuild) {
  const p = BigInt(guild.permissions || "0");
  return guild.owner || (p & ADMINISTRATOR) !== 0n || (p & MANAGE_GUILD) !== 0n;
}

export async function userDiscordFetch<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${DISCORD_API}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Discord user API failed (${res.status})`);
  return res.json() as Promise<T>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function botDiscordFetch<T = unknown>(
  path: string,
  init: RequestInit = {},
  attempts = 4,
): Promise<T> {
  let last: Response | null = null;
  for (let i = 0; i < attempts; i++) {
    const res = await fetch(`${DISCORD_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bot ${env("DISCORD_BOT_TOKEN")}`,
        "Content-Type": "application/json",
        "X-Audit-Log-Reason": encodeURIComponent("Managed by NEXORA Control"),
        ...(init.headers || {}),
      },
      cache: "no-store",
    });
    last = res;
    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as { retry_after?: number };
      await sleep(Math.max(400, Math.ceil((body.retry_after ?? 1) * 1000)));
      continue;
    }
    if (res.status === 204) return undefined as T;
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Discord bot API failed (${res.status}): ${text.slice(0, 500)}`);
    }
    return res.json() as Promise<T>;
  }
  throw new Error(`Discord bot API rate limited (${last?.status ?? "unknown"})`);
}

export async function getManageableGuilds(accessToken: string) {
  const guilds = await userDiscordFetch<DiscordGuild[]>("/users/@me/guilds", accessToken);
  return guilds.filter(canManageGuild);
}

export async function assertCanManageGuild(accessToken: string, guildId: string) {
  const guilds = await getManageableGuilds(accessToken);
  const guild = guilds.find((g) => g.id === guildId);
  if (!guild) throw new Error("You do not have permission to manage this server");
  return guild;
}

export function guildIconUrl(guild: DiscordGuild) {
  return guild.icon
    ? `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=128`
    : null;
}

export function botInstallUrl(guildId: string) {
  const clientId = env("DISCORD_CLIENT_ID");
  const u = new URL("https://discord.com/oauth2/authorize");
  u.searchParams.set("client_id", clientId);
  u.searchParams.set("scope", "bot applications.commands");
  u.searchParams.set("permissions", BOT_PERMISSION_BITS);
  u.searchParams.set("guild_id", guildId);
  u.searchParams.set("disable_guild_select", "true");
  u.searchParams.set("integration_type", "0");
  return u.toString();
}

export function oauthRedirectUri() {
  return `${publicAppUrl()}/api/auth/callback`;
}
