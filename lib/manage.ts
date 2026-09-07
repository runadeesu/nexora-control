import { botDiscordFetch, DiscordChannel, DiscordRole } from "./discord";
import { CategorySpec, P, RoleSpec, STAFF_ROLE_NAMES } from "./blueprint";

export type EnsureResult = { created: number; existing: number };

export async function getGuildRoles(guildId: string) {
  return botDiscordFetch<DiscordRole[]>(`/guilds/${guildId}/roles`);
}

export async function getGuildChannels(guildId: string) {
  return botDiscordFetch<DiscordChannel[]>(`/guilds/${guildId}/channels`);
}

export async function ensureRoles(guildId: string, specs: RoleSpec[]) {
  let roles = await getGuildRoles(guildId);
  let created = 0;
  let existing = 0;
  const result = new Map<string, DiscordRole>();

  for (const spec of [...specs].reverse()) {
    let role = roles.find((r) => r.name === spec.name && !r.managed);
    if (!role) {
      role = await botDiscordFetch<DiscordRole>(`/guilds/${guildId}/roles`, {
        method: "POST",
        body: JSON.stringify({
          name: spec.name,
          permissions: spec.permissions.toString(),
          color: spec.color,
          hoist: !!spec.hoist,
          mentionable: false,
        }),
      });
      roles.push(role);
      created++;
    } else {
      existing++;
    }
    result.set(spec.name, role);
  }

  const desiredLowToHigh = [...specs];
  await botDiscordFetch(`/guilds/${guildId}/roles`, {
    method: "PATCH",
    body: JSON.stringify(
      desiredLowToHigh.map((spec, index) => ({
        id: result.get(spec.name)!.id,
        position: index + 1,
      })),
    ),
  }).catch(() => undefined);

  return { created, existing, roles: result };
}

function staffOverwrites(guildId: string, roles: DiscordRole[]) {
  const allow = (P.VIEW_CHANNEL | P.SEND_MESSAGES | P.READ_MESSAGE_HISTORY).toString();
  return [
    { id: guildId, type: 0, allow: "0", deny: P.VIEW_CHANNEL.toString() },
    ...roles
      .filter((r) => STAFF_ROLE_NAMES.includes(r.name))
      .map((r) => ({ id: r.id, type: 0, allow, deny: "0" })),
  ];
}

export async function ensureCategory(
  guildId: string,
  spec: CategorySpec,
  channels: DiscordChannel[],
  roles: DiscordRole[],
) {
  let category = channels.find((c) => c.type === 4 && c.name === spec.name);
  let created = false;
  if (!category) {
    category = await botDiscordFetch<DiscordChannel>(`/guilds/${guildId}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: spec.name,
        type: 4,
        permission_overwrites: spec.privateStaff ? staffOverwrites(guildId, roles) : undefined,
      }),
    });
    channels.push(category);
    created = true;
  }
  return { category, created };
}

export async function ensureChannel(
  guildId: string,
  categoryId: string,
  spec: { name: string; type: 0 | 2; topic?: string },
  channels: DiscordChannel[],
) {
  let channel = channels.find(
    (c) => c.parent_id === categoryId && c.type === spec.type && c.name === spec.name,
  );
  let created = false;
  if (!channel) {
    channel = await botDiscordFetch<DiscordChannel>(`/guilds/${guildId}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: spec.name,
        type: spec.type,
        parent_id: categoryId,
        topic: spec.type === 0 ? spec.topic || undefined : undefined,
      }),
    });
    channels.push(channel);
    created = true;
  }
  return { channel, created };
}

export async function ensureCategories(guildId: string, specs: CategorySpec[]) {
  const [channels, roles] = await Promise.all([getGuildChannels(guildId), getGuildRoles(guildId)]);
  let created = 0;
  let existing = 0;
  const byName = new Map<string, DiscordChannel>();

  for (const categorySpec of specs) {
    const categoryResult = await ensureCategory(guildId, categorySpec, channels, roles);
    if (categoryResult.created) created++;
    else existing++;
    byName.set(categorySpec.name, categoryResult.category);

    for (const channelSpec of categorySpec.channels) {
      const channelResult = await ensureChannel(
        guildId,
        categoryResult.category.id,
        channelSpec,
        channels,
      );
      if (channelResult.created) created++;
      else existing++;
      byName.set(channelSpec.name, channelResult.channel);
    }
  }

  return { created, existing, byName };
}

export async function ensureMessage(channelId: string, marker: string, content: string) {
  const recent = await botDiscordFetch<Array<{ id: string; content: string; author: { bot?: boolean } }>>(
    `/channels/${channelId}/messages?limit=25`,
  ).catch(() => []);
  const exists = recent.some((m) => m.author?.bot && m.content.includes(marker));
  if (exists) return false;
  await botDiscordFetch(`/channels/${channelId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
  return true;
}
