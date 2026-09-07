"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type PermissionDef = { key: string; label: string; bit: string; channel: boolean; role: boolean };
type Overwrite = { id: string; type: 0 | 1; allow: string; deny: string };
type Channel = {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  topic: string;
  nsfw: boolean;
  rate_limit_per_user: number;
  bitrate: number;
  user_limit: number;
  permission_overwrites: Overwrite[];
};
type Role = {
  id: string;
  name: string;
  position: number;
  managed: boolean;
  permissions: string;
  color: number;
  hoist: boolean;
  mentionable: boolean;
  everyone: boolean;
  editable: boolean;
};
type GuildSettings = {
  id: string;
  name: string;
  verification_level: number;
  default_message_notifications: number;
  explicit_content_filter: number;
  afk_channel_id: string | null;
  afk_timeout: number;
  system_channel_id: string | null;
  preferred_locale: string;
  description: string;
};
type ManageData = {
  guild: GuildSettings;
  channels: Channel[];
  roles: Role[];
  permissions: PermissionDef[];
  botTopRolePosition: number;
};

type Tab = "server" | "channels" | "permissions" | "roles";

function hasBit(value: string, bit: string) {
  return (BigInt(value || "0") & BigInt(bit)) !== 0n;
}

function colorHex(color: number) {
  return `#${Math.max(0, Math.min(0xffffff, color)).toString(16).padStart(6, "0")}`;
}

function channelTypeName(type: number) {
  if (type === 4) return "CATEGORY";
  if (type === 2 || type === 13) return "VOICE";
  if (type === 5) return "ANNOUNCEMENT";
  if (type === 15) return "FORUM";
  if (type === 16) return "MEDIA";
  return "TEXT";
}

export default function AdvancedManager({ guildId }: { guildId: string }) {
  const [data, setData] = useState<ManageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("channels");
  const [selectedChannelId, setSelectedChannelId] = useState("");
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [permissionRoleId, setPermissionRoleId] = useState("");
  const [guildDraft, setGuildDraft] = useState<GuildSettings | null>(null);
  const [channelDraft, setChannelDraft] = useState<Channel | null>(null);
  const [roleDraft, setRoleDraft] = useState<Role | null>(null);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelType, setNewChannelType] = useState("0");
  const [newChannelParent, setNewChannelParent] = useState("");
  const [newRoleName, setNewRoleName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/guilds/${guildId}/manage`, { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "管理データを取得できませんでした");
      const next = json as ManageData;
      setData(next);
      setGuildDraft(next.guild);
      setSelectedChannelId((current) => next.channels.some((c) => c.id === current) ? current : next.channels.find((c) => c.type !== 4)?.id || next.channels[0]?.id || "");
      setSelectedRoleId((current) => next.roles.some((r) => r.id === current) ? current : next.roles.find((r) => r.editable)?.id || next.roles[0]?.id || "");
      setPermissionRoleId((current) => next.roles.some((r) => r.id === current) ? current : next.roles.find((r) => r.everyone)?.id || next.roles[0]?.id || "");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "読み込みに失敗しました");
    } finally {
      setLoading(false);
    }
  }, [guildId]);

  useEffect(() => { void load(); }, [load]);

  const selectedChannel = useMemo(() => data?.channels.find((c) => c.id === selectedChannelId) || null, [data, selectedChannelId]);
  const selectedRole = useMemo(() => data?.roles.find((r) => r.id === selectedRoleId) || null, [data, selectedRoleId]);
  const categories = useMemo(() => data?.channels.filter((c) => c.type === 4) || [], [data]);
  const voiceChannels = useMemo(() => data?.channels.filter((c) => c.type === 2) || [], [data]);
  const textChannels = useMemo(() => data?.channels.filter((c) => [0, 5].includes(c.type)) || [], [data]);
  const channelPermissions = useMemo(() => data?.permissions.filter((p) => p.channel) || [], [data]);
  const rolePermissions = useMemo(() => data?.permissions.filter((p) => p.role) || [], [data]);

  useEffect(() => { setChannelDraft(selectedChannel ? { ...selectedChannel } : null); }, [selectedChannel]);
  useEffect(() => { setRoleDraft(selectedRole ? { ...selectedRole } : null); }, [selectedRole]);

  async function action(name: string, payload: Record<string, unknown>) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/guilds/${guildId}/manage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, ...payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "操作に失敗しました");
      setMessage("変更をDiscordへ反映しました。");
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作に失敗しました");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function permissionState(channel: Channel, roleId: string, bit: string): "allow" | "deny" | "inherit" {
    const overwrite = channel.permission_overwrites.find((o) => o.id === roleId && o.type === 0);
    if (!overwrite) return "inherit";
    if (hasBit(overwrite.allow, bit)) return "allow";
    if (hasBit(overwrite.deny, bit)) return "deny";
    return "inherit";
  }

  async function saveGuild(event: FormEvent) {
    event.preventDefault();
    if (!guildDraft) return;
    await action("guild.update", guildDraft as unknown as Record<string, unknown>);
  }

  async function saveChannel(event: FormEvent) {
    event.preventDefault();
    if (!channelDraft) return;
    await action("channel.update", {
      channelId: channelDraft.id,
      name: channelDraft.name,
      topic: channelDraft.topic,
      nsfw: channelDraft.nsfw,
      rate_limit_per_user: channelDraft.rate_limit_per_user,
      user_limit: channelDraft.user_limit,
      parent_id: channelDraft.parent_id,
    });
  }

  async function createChannel(event: FormEvent) {
    event.preventDefault();
    if (!newChannelName.trim()) return;
    const ok = await action("channel.create", {
      name: newChannelName,
      type: Number(newChannelType),
      parent_id: newChannelType === "4" ? null : newChannelParent || null,
    });
    if (ok) setNewChannelName("");
  }

  async function saveRole(event: FormEvent) {
    event.preventDefault();
    if (!roleDraft || !roleDraft.editable) return;
    const permissionChanges: Record<string, boolean> = {};
    for (const perm of rolePermissions) permissionChanges[perm.key] = hasBit(roleDraft.permissions, perm.bit);
    await action("role.update", {
      roleId: roleDraft.id,
      name: roleDraft.name,
      color: roleDraft.color,
      hoist: roleDraft.hoist,
      mentionable: roleDraft.mentionable,
      permissionChanges,
    });
  }

  function setRolePermission(bit: string, enabled: boolean) {
    setRoleDraft((current) => {
      if (!current) return current;
      let p = BigInt(current.permissions || "0");
      const b = BigInt(bit);
      p = enabled ? p | b : p & ~b;
      return { ...current, permissions: p.toString() };
    });
  }

  async function createRole(event: FormEvent) {
    event.preventDefault();
    if (!newRoleName.trim()) return;
    const ok = await action("role.create", { name: newRoleName });
    if (ok) setNewRoleName("");
  }

  if (loading && !data) return <section className="panel manager-panel">管理パネルを読み込み中…</section>;
  if (!data) return <section className="panel manager-panel"><p>{message || "管理パネルを読み込めませんでした。"}</p><button className="button ghost" onClick={() => void load()}>再読み込み</button></section>;

  return (
    <section className="panel manager-panel">
      <div className="panel-heading manager-heading">
        <div>
          <p className="section-number">04</p>
          <h2>Server Manager</h2>
          <p>Discordを開かずに、チャンネル・権限・役職・サーバー設定を変更できます。</p>
        </div>
        <button className="button ghost" type="button" onClick={() => void load()} disabled={busy}>再読み込み</button>
      </div>

      <div className="manager-tabs" role="tablist" aria-label="Discord settings">
        {([
          ["channels", "チャンネル"],
          ["permissions", "権限"],
          ["roles", "役職"],
          ["server", "サーバー"],
        ] as Array<[Tab, string]>).map(([id, label]) => (
          <button key={id} type="button" className={tab === id ? "active" : ""} onClick={() => setTab(id)}>{label}</button>
        ))}
      </div>

      {message ? <div className="manager-message" role="status">{message}</div> : null}

      {tab === "channels" ? (
        <div className="manager-grid">
          <aside className="manager-list">
            <div className="mini-title">CHANNELS</div>
            {data.channels.map((channel) => (
              <button key={channel.id} type="button" className={selectedChannelId === channel.id ? "active" : ""} onClick={() => setSelectedChannelId(channel.id)}>
                <span>{channel.type === 4 ? "▾" : channel.type === 2 ? "◉" : "#"}</span>
                <span>{channel.name}</span>
                <small>{channelTypeName(channel.type)}</small>
              </button>
            ))}
          </aside>

          <div className="manager-editor">
            {channelDraft ? (
              <form onSubmit={saveChannel} className="settings-form">
                <div className="editor-head"><div><div className="mini-title">EDIT CHANNEL</div><h3>{channelDraft.name}</h3></div><span className="type-badge">{channelTypeName(channelDraft.type)}</span></div>
                <label>名前<input value={channelDraft.name} maxLength={100} onChange={(e) => setChannelDraft({ ...channelDraft, name: e.target.value })} /></label>
                {[0, 5, 15, 16].includes(channelDraft.type) ? <label>トピック<textarea value={channelDraft.topic} maxLength={channelDraft.type === 15 || channelDraft.type === 16 ? 4096 : 1024} onChange={(e) => setChannelDraft({ ...channelDraft, topic: e.target.value })} /></label> : null}
                {channelDraft.type !== 4 ? <label>カテゴリー<select value={channelDraft.parent_id || ""} onChange={(e) => setChannelDraft({ ...channelDraft, parent_id: e.target.value || null })}><option value="">カテゴリーなし</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label> : null}
                {[0, 5, 15, 16].includes(channelDraft.type) ? <label>低速モード<select value={channelDraft.rate_limit_per_user} onChange={(e) => setChannelDraft({ ...channelDraft, rate_limit_per_user: Number(e.target.value) })}><option value={0}>OFF</option><option value={5}>5秒</option><option value={10}>10秒</option><option value={30}>30秒</option><option value={60}>1分</option><option value={300}>5分</option><option value={3600}>1時間</option></select></label> : null}
                {[2, 13].includes(channelDraft.type) ? <label>VC人数制限<input type="number" min={0} max={channelDraft.type === 13 ? 10000 : 99} value={channelDraft.user_limit} onChange={(e) => setChannelDraft({ ...channelDraft, user_limit: Number(e.target.value) })} /></label> : null}
                {channelDraft.type !== 4 ? <label className="check-row"><input type="checkbox" checked={channelDraft.nsfw} onChange={(e) => setChannelDraft({ ...channelDraft, nsfw: e.target.checked })} /><span>年齢制限（NSFW）</span></label> : null}
                <div className="editor-actions"><button className="button primary" disabled={busy}>変更を保存</button><button className="button danger" type="button" disabled={busy} onClick={() => { if (confirm(`「${channelDraft.name}」を削除しますか？この操作は元に戻せません。`)) void action("channel.delete", { channelId: channelDraft.id }); }}>削除</button></div>
              </form>
            ) : null}

            <form onSubmit={createChannel} className="quick-create">
              <div className="mini-title">CREATE CHANNEL</div>
              <div className="triple-row"><input placeholder="新しいチャンネル名" value={newChannelName} onChange={(e) => setNewChannelName(e.target.value)} /><select value={newChannelType} onChange={(e) => setNewChannelType(e.target.value)}><option value="0">テキスト</option><option value="2">ボイス</option><option value="4">カテゴリー</option></select><button className="button primary" disabled={busy || !newChannelName.trim()}>作成</button></div>
              {newChannelType !== "4" ? <select value={newChannelParent} onChange={(e) => setNewChannelParent(e.target.value)}><option value="">カテゴリーなし</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select> : null}
            </form>
          </div>
        </div>
      ) : null}

      {tab === "permissions" ? (
        <div className="permissions-editor">
          <div className="permission-pickers">
            <label>チャンネル<select value={selectedChannelId} onChange={(e) => setSelectedChannelId(e.target.value)}>{data.channels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>ロール<select value={permissionRoleId} onChange={(e) => setPermissionRoleId(e.target.value)}>{data.roles.filter((r) => !r.managed).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></label>
          </div>
          <p className="permission-help">継承＝サーバー/カテゴリーの設定を使用。許可・拒否はこのチャンネルだけ上書きします。</p>
          <div className="permission-table">
            {selectedChannel && permissionRoleId ? channelPermissions.map((perm) => {
              const state = permissionState(selectedChannel, permissionRoleId, perm.bit);
              return <div className="permission-row" key={perm.key}><span>{perm.label}</span><div className="tri-state">{(["inherit", "allow", "deny"] as const).map((value) => <button key={value} type="button" className={state === value ? `active ${value}` : ""} disabled={busy} onClick={() => void action("channel.permission", { channelId: selectedChannel.id, roleId: permissionRoleId, bit: perm.bit, state: value })}>{value === "inherit" ? "継承" : value === "allow" ? "許可" : "拒否"}</button>)}</div></div>;
            }) : null}
          </div>
        </div>
      ) : null}

      {tab === "roles" ? (
        <div className="manager-grid">
          <aside className="manager-list roles-list"><div className="mini-title">ROLES</div>{data.roles.filter((r) => !r.everyone).map((role) => <button key={role.id} type="button" className={selectedRoleId === role.id ? "active" : ""} onClick={() => setSelectedRoleId(role.id)}><span className="role-dot" style={{ background: colorHex(role.color) }} /><span>{role.name}</span><small>{role.editable ? "EDIT" : role.managed ? "BOT" : "LOCKED"}</small></button>)}</aside>
          <div className="manager-editor">
            {roleDraft ? <form onSubmit={saveRole} className="settings-form"><div className="editor-head"><div><div className="mini-title">EDIT ROLE</div><h3>{roleDraft.name}</h3></div>{!roleDraft.editable ? <span className="type-badge locked">BOTより上位</span> : null}</div>{!roleDraft.editable ? <p className="warning-box">このロールはNEXORA Botより上位、またはDiscord管理ロールなのでサイトから編集できません。手動で作る Administrator ロールもここに該当します。</p> : null}<label>ロール名<input value={roleDraft.name} disabled={!roleDraft.editable} onChange={(e) => setRoleDraft({ ...roleDraft, name: e.target.value })} /></label><label>カラー<div className="color-row"><input type="color" value={colorHex(roleDraft.color)} disabled={!roleDraft.editable} onChange={(e) => setRoleDraft({ ...roleDraft, color: parseInt(e.target.value.slice(1), 16) })} /><code>{colorHex(roleDraft.color).toUpperCase()}</code></div></label><div className="switches"><label className="check-row"><input type="checkbox" checked={roleDraft.hoist} disabled={!roleDraft.editable} onChange={(e) => setRoleDraft({ ...roleDraft, hoist: e.target.checked })} /><span>メンバー一覧で分けて表示</span></label><label className="check-row"><input type="checkbox" checked={roleDraft.mentionable} disabled={!roleDraft.editable} onChange={(e) => setRoleDraft({ ...roleDraft, mentionable: e.target.checked })} /><span>メンション可能</span></label></div><div className="role-permissions"><div className="mini-title">SERVER PERMISSIONS</div>{rolePermissions.map((perm) => <label className="permission-toggle" key={perm.key}><span>{perm.label}</span><input type="checkbox" disabled={!roleDraft.editable} checked={hasBit(roleDraft.permissions, perm.bit)} onChange={(e) => setRolePermission(perm.bit, e.target.checked)} /></label>)}</div>{roleDraft.editable ? <div className="editor-actions"><button className="button primary" disabled={busy}>変更を保存</button><button className="button danger" type="button" disabled={busy} onClick={() => { if (confirm(`「${roleDraft.name}」を削除しますか？`)) void action("role.delete", { roleId: roleDraft.id }); }}>削除</button></div> : null}</form> : null}
            <form onSubmit={createRole} className="quick-create"><div className="mini-title">CREATE ROLE</div><div className="form-row"><input placeholder="新しいロール名" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} /><button className="button primary" disabled={busy || !newRoleName.trim()}>作成</button></div></form>
          </div>
        </div>
      ) : null}

      {tab === "server" && guildDraft ? (
        <form onSubmit={saveGuild} className="settings-form server-settings">
          <div className="mini-title">SERVER SETTINGS</div>
          <label>サーバー名<input value={guildDraft.name} maxLength={100} onChange={(e) => setGuildDraft({ ...guildDraft, name: e.target.value })} /></label>
          <div className="two-col"><label>認証レベル<select value={guildDraft.verification_level} onChange={(e) => setGuildDraft({ ...guildDraft, verification_level: Number(e.target.value) })}><option value={0}>なし</option><option value={1}>低</option><option value={2}>中</option><option value={3}>高</option><option value={4}>最高</option></select></label><label>不適切コンテンツフィルター<select value={guildDraft.explicit_content_filter} onChange={(e) => setGuildDraft({ ...guildDraft, explicit_content_filter: Number(e.target.value) })}><option value={0}>無効</option><option value={1}>ロールなしのメンバー</option><option value={2}>全メンバー</option></select></label></div>
          <div className="two-col"><label>デフォルト通知<select value={guildDraft.default_message_notifications} onChange={(e) => setGuildDraft({ ...guildDraft, default_message_notifications: Number(e.target.value) })}><option value={0}>すべてのメッセージ</option><option value={1}>メンションのみ</option></select></label><label>AFKタイムアウト<select value={guildDraft.afk_timeout} onChange={(e) => setGuildDraft({ ...guildDraft, afk_timeout: Number(e.target.value) })}><option value={60}>1分</option><option value={300}>5分</option><option value={900}>15分</option><option value={1800}>30分</option><option value={3600}>1時間</option></select></label></div>
          <div className="two-col"><label>AFKチャンネル<select value={guildDraft.afk_channel_id || ""} onChange={(e) => setGuildDraft({ ...guildDraft, afk_channel_id: e.target.value || null })}><option value="">なし</option>{voiceChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><label>システムメッセージチャンネル<select value={guildDraft.system_channel_id || ""} onChange={(e) => setGuildDraft({ ...guildDraft, system_channel_id: e.target.value || null })}><option value="">なし</option>{textChannels.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label></div>
          <button className="button primary large" disabled={busy}>サーバー設定を保存</button>
        </form>
      ) : null}
    </section>
  );
}
