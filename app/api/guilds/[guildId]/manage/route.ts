import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import {
  assertCanManageGuild,
  botDiscordFetch,
  DiscordChannel,
  DiscordGuild,
  DiscordMember,
  DiscordRole,
  DiscordUser,
} from "@/lib/discord";
import { CHANNEL_PERMISSION_MASK, PERMISSION_DEFS, permissionPayload } from "@/lib/permissions";

export const maxDuration = 60;

function asInt(value: unknown, min: number, max: number, fallback: number) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

async function loadGuildState(guildId: string) {
  const [guild, channels, roles, botUser] = await Promise.all([
    botDiscordFetch<DiscordGuild>(`/guilds/${guildId}`),
    botDiscordFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`),
    botDiscordFetch<DiscordRole[]>(`/guilds/${guildId}/roles`),
    botDiscordFetch<DiscordUser>("/users/@me"),
  ]);
  const botMember = await botDiscordFetch<DiscordMember>(`/guilds/${guildId}/members/${botUser.id}`);
  const botRolePositions = roles
    .filter((role) => botMember.roles.includes(role.id))
    .map((role) => role.position);
  const botTopPosition = Math.max(0, ...botRolePositions);

  return { guild, channels, roles, botTopPosition };
}

function publicChannel(channel: DiscordChannel) {
  return {
    id: channel.id,
    name: channel.name,
    type: channel.type,
    position: channel.position ?? 0,
    parent_id: channel.parent_id,
    topic: channel.topic ?? "",
    nsfw: !!channel.nsfw,
    rate_limit_per_user: channel.rate_limit_per_user ?? 0,
    bitrate: channel.bitrate ?? 64000,
    user_limit: channel.user_limit ?? 0,
    permission_overwrites: channel.permission_overwrites ?? [],
  };
}

function publicRole(role: DiscordRole, guildId: string, botTopPosition: number) {
  return {
    id: role.id,
    name: role.name,
    position: role.position,
    managed: role.managed,
    permissions: role.permissions,
    color: role.color ?? 0,
    hoist: !!role.hoist,
    mentionable: !!role.mentionable,
    everyone: role.id === guildId,
    editable: !role.managed && role.id !== guildId && role.position < botTopPosition,
  };
}

function updateOverwriteBits(
  channel: DiscordChannel,
  roleId: string,
  states: Record<string, unknown>,
) {
  const overwrite = (channel.permission_overwrites || []).find((x) => x.id === roleId && x.type === 0);
  let allow = BigInt(overwrite?.allow || "0");
  let deny = BigInt(overwrite?.deny || "0");

  for (const def of PERMISSION_DEFS) {
    if (!def.channel || !(def.key in states)) continue;
    const state = String(states[def.key]);
    if (!["allow", "deny", "inherit"].includes(state)) continue;
    allow &= ~def.bit;
    deny &= ~def.bit;
    if (state === "allow") allow |= def.bit;
    if (state === "deny") deny |= def.bit;
  }

  return { allow, deny };
}

async function writeRoleOverwrite(channelId: string, roleId: string, allow: bigint, deny: bigint) {
  if (allow === 0n && deny === 0n) {
    await botDiscordFetch(`/channels/${channelId}/permissions/${roleId}`, { method: "DELETE" }).catch(() => undefined);
    return;
  }
  await botDiscordFetch(`/channels/${channelId}/permissions/${roleId}`, {
    method: "PUT",
    body: JSON.stringify({ type: 0, allow: allow.toString(), deny: deny.toString() }),
  });
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ guildId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { guildId } = await context.params;

  try {
    await assertCanManageGuild(session.accessToken, guildId);
    const { guild, channels, roles, botTopPosition } = await loadGuildState(guildId);
    return NextResponse.json({
      guild: {
        id: guild.id,
        name: guild.name,
        verification_level: guild.verification_level ?? 0,
        default_message_notifications: guild.default_message_notifications ?? 1,
        explicit_content_filter: guild.explicit_content_filter ?? 0,
        afk_channel_id: guild.afk_channel_id ?? null,
        afk_timeout: guild.afk_timeout ?? 300,
        system_channel_id: guild.system_channel_id ?? null,
        preferred_locale: guild.preferred_locale ?? "ja",
        description: guild.description ?? "",
      },
      channels: channels
        .filter((channel) => [0, 2, 4, 5, 13, 15, 16].includes(channel.type))
        .map(publicChannel)
        .sort((a, b) => a.position - b.position),
      roles: roles
        .map((role) => publicRole(role, guildId, botTopPosition))
        .sort((a, b) => b.position - a.position),
      permissions: permissionPayload(),
      botTopRolePosition: botTopPosition,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load manager" },
      { status: 403 },
    );
  }
}

type ActionBody = {
  action?: string;
  [key: string]: unknown;
};

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ guildId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { guildId } = await context.params;

  try {
    await assertCanManageGuild(session.accessToken, guildId);
    const body = (await request.json()) as ActionBody;
    const action = String(body.action || "");
    const { channels, roles, botTopPosition } = await loadGuildState(guildId);

    if (action === "guild.update") {
      const payload = {
        name: String(body.name || "").trim().slice(0, 100),
        verification_level: asInt(body.verification_level, 0, 4, 0),
        default_message_notifications: asInt(body.default_message_notifications, 0, 1, 1),
        explicit_content_filter: asInt(body.explicit_content_filter, 0, 2, 0),
        afk_channel_id: body.afk_channel_id ? String(body.afk_channel_id) : null,
        afk_timeout: [60, 300, 900, 1800, 3600].includes(Number(body.afk_timeout))
          ? Number(body.afk_timeout)
          : 300,
        system_channel_id: body.system_channel_id ? String(body.system_channel_id) : null,
      };
      if (payload.name.length < 2) return NextResponse.json({ error: "サーバー名は2文字以上必要です" }, { status: 400 });
      if (payload.afk_channel_id && !channels.some((c) => c.id === payload.afk_channel_id && c.type === 2)) {
        return NextResponse.json({ error: "AFKチャンネルが不正です" }, { status: 400 });
      }
      if (payload.system_channel_id && !channels.some((c) => c.id === payload.system_channel_id && [0, 5].includes(c.type))) {
        return NextResponse.json({ error: "システムチャンネルが不正です" }, { status: 400 });
      }
      await botDiscordFetch(`/guilds/${guildId}`, { method: "PATCH", body: JSON.stringify(payload) });
      return NextResponse.json({ ok: true });
    }

    if (action === "channel.update") {
      const channelId = String(body.channelId || "");
      const channel = channels.find((c) => c.id === channelId);
      if (!channel) return NextResponse.json({ error: "チャンネルが見つかりません" }, { status: 404 });
      const name = String(body.name || "").trim().slice(0, 100);
      if (!name) return NextResponse.json({ error: "チャンネル名を入力してください" }, { status: 400 });
      const payload: Record<string, unknown> = { name };
      if ([0, 5, 15, 16].includes(channel.type)) {
        payload.topic = String(body.topic || "").slice(0, channel.type === 15 || channel.type === 16 ? 4096 : 1024) || null;
        payload.rate_limit_per_user = asInt(body.rate_limit_per_user, 0, 21600, 0);
        payload.nsfw = !!body.nsfw;
      }
      if ([2, 13].includes(channel.type)) {
        payload.user_limit = asInt(body.user_limit, 0, channel.type === 13 ? 10000 : 99, 0);
        payload.nsfw = !!body.nsfw;
      }
      if (![4].includes(channel.type)) {
        const parentId = body.parent_id ? String(body.parent_id) : null;
        if (parentId && !channels.some((c) => c.id === parentId && c.type === 4)) {
          return NextResponse.json({ error: "カテゴリーが不正です" }, { status: 400 });
        }
        payload.parent_id = parentId;
      }
      await botDiscordFetch(`/channels/${channelId}`, { method: "PATCH", body: JSON.stringify(payload) });
      return NextResponse.json({ ok: true });
    }

    if (action === "channel.create") {
      const type = asInt(body.type, 0, 4, 0);
      if (![0, 2, 4].includes(type)) return NextResponse.json({ error: "未対応のチャンネル種類です" }, { status: 400 });
      const name = String(body.name || "").trim().slice(0, 100);
      if (!name) return NextResponse.json({ error: "名前を入力してください" }, { status: 400 });
      const parentId = type === 4 || !body.parent_id ? null : String(body.parent_id);
      if (parentId && !channels.some((c) => c.id === parentId && c.type === 4)) {
        return NextResponse.json({ error: "カテゴリーが不正です" }, { status: 400 });
      }
      const created = await botDiscordFetch<DiscordChannel>(`/guilds/${guildId}/channels`, {
        method: "POST",
        body: JSON.stringify({ name, type, parent_id: parentId }),
      });
      return NextResponse.json({ ok: true, channel: publicChannel(created) });
    }

    if (action === "channel.delete") {
      const channelId = String(body.channelId || "");
      if (!channels.some((c) => c.id === channelId)) return NextResponse.json({ error: "チャンネルが見つかりません" }, { status: 404 });
      await botDiscordFetch(`/channels/${channelId}`, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }

    if (action === "channel.permission") {
      const channelId = String(body.channelId || "");
      const roleId = String(body.roleId || "");
      const bit = BigInt(String(body.bit || "0"));
      const state = String(body.state || "inherit");
      const channel = channels.find((c) => c.id === channelId);
      const role = roles.find((r) => r.id === roleId);
      if (!channel || !role) return NextResponse.json({ error: "チャンネルまたはロールが見つかりません" }, { status: 404 });
      if ((CHANNEL_PERMISSION_MASK & bit) !== bit || bit === 0n) return NextResponse.json({ error: "未対応の権限です" }, { status: 400 });
      if (!["allow", "deny", "inherit"].includes(state)) return NextResponse.json({ error: "権限状態が不正です" }, { status: 400 });

      const def = PERMISSION_DEFS.find((item) => item.channel && item.bit === bit);
      if (!def) return NextResponse.json({ error: "未対応の権限です" }, { status: 400 });
      const { allow, deny } = updateOverwriteBits(channel, roleId, { [def.key]: state });
      await writeRoleOverwrite(channelId, roleId, allow, deny);
      return NextResponse.json({ ok: true, allow: allow.toString(), deny: deny.toString() });
    }

    if (action === "channel.permission.bulk") {
      const roleId = String(body.roleId || "");
      const role = roles.find((r) => r.id === roleId);
      if (!role || role.managed) return NextResponse.json({ error: "ロールが見つかりません" }, { status: 404 });

      const requested = Array.isArray(body.channelIds) ? body.channelIds.map(String) : [];
      const uniqueIds = [...new Set(requested)].slice(0, 100);
      if (!uniqueIds.length) return NextResponse.json({ error: "対象チャンネルを選択してください" }, { status: 400 });
      const selectedChannels = uniqueIds.map((id) => channels.find((c) => c.id === id)).filter(Boolean) as DiscordChannel[];
      if (selectedChannels.length !== uniqueIds.length) return NextResponse.json({ error: "対象に存在しないチャンネルがあります" }, { status: 400 });

      const states = (body.states || {}) as Record<string, unknown>;
      const supportedKeys = new Set(PERMISSION_DEFS.filter((p) => p.channel).map((p) => p.key));
      const cleanStates: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(states)) {
        if (!supportedKeys.has(key as never)) continue;
        const state = String(value);
        if (["allow", "deny", "inherit"].includes(state)) cleanStates[key] = state;
      }
      if (!Object.keys(cleanStates).length) return NextResponse.json({ error: "変更する権限を選択してください" }, { status: 400 });

      for (const channel of selectedChannels) {
        const { allow, deny } = updateOverwriteBits(channel, roleId, cleanStates);
        await writeRoleOverwrite(channel.id, roleId, allow, deny);
      }
      return NextResponse.json({ ok: true, changedChannels: selectedChannels.length });
    }

    if (action === "role.update") {
      const roleId = String(body.roleId || "");
      const role = roles.find((r) => r.id === roleId);
      if (!role || role.managed || role.id === guildId || role.position >= botTopPosition) {
        return NextResponse.json({ error: "このロールはBotより上位のため編集できません" }, { status: 403 });
      }
      let permissions = BigInt(role.permissions || "0");
      const changes = (body.permissionChanges || {}) as Record<string, unknown>;
      for (const def of PERMISSION_DEFS) {
        if (!def.role || !(def.key in changes)) continue;
        if (changes[def.key]) permissions |= def.bit;
        else permissions &= ~def.bit;
      }
      const payload = {
        name: String(body.name || role.name).trim().slice(0, 100) || role.name,
        permissions: permissions.toString(),
        color: asInt(body.color, 0, 0xffffff, role.color || 0),
        hoist: !!body.hoist,
        mentionable: !!body.mentionable,
      };
      await botDiscordFetch(`/guilds/${guildId}/roles/${roleId}`, { method: "PATCH", body: JSON.stringify(payload) });
      return NextResponse.json({ ok: true });
    }

    if (action === "role.create") {
      const name = String(body.name || "").trim().slice(0, 100);
      if (!name) return NextResponse.json({ error: "ロール名を入力してください" }, { status: 400 });
      const role = await botDiscordFetch<DiscordRole>(`/guilds/${guildId}/roles`, {
        method: "POST",
        body: JSON.stringify({ name, permissions: "0", color: 0, hoist: false, mentionable: false }),
      });
      return NextResponse.json({ ok: true, role: publicRole(role, guildId, botTopPosition) });
    }

    if (action === "role.delete") {
      const roleId = String(body.roleId || "");
      const role = roles.find((r) => r.id === roleId);
      if (!role || role.managed || role.id === guildId || role.position >= botTopPosition) {
        return NextResponse.json({ error: "このロールは削除できません" }, { status: 403 });
      }
      await botDiscordFetch(`/guilds/${guildId}/roles/${roleId}`, { method: "DELETE" });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Management action failed" },
      { status: 500 },
    );
  }
}
