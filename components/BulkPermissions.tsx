"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PermissionState = "allow" | "deny" | "inherit";
type PermissionDef = { key: string; label: string; bit: string; channel: boolean; role: boolean };
type Overwrite = { id: string; type: 0 | 1; allow: string; deny: string };
type Channel = {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id: string | null;
  permission_overwrites: Overwrite[];
};
type Role = { id: string; name: string; managed: boolean; everyone: boolean };
type ManageData = { channels: Channel[]; roles: Role[]; permissions: PermissionDef[] };
type Template = { name: string; states: Record<string, PermissionState> };

const PRESETS: Array<{ id: string; label: string; description: string; states: Record<string, PermissionState> }> = [
  {
    id: "public",
    label: "公開",
    description: "閲覧・投稿・VC参加を許可",
    states: {
      VIEW_CHANNEL: "allow", SEND_MESSAGES: "allow", EMBED_LINKS: "allow", ATTACH_FILES: "allow",
      READ_MESSAGE_HISTORY: "allow", CONNECT: "allow", SPEAK: "allow",
      MANAGE_MESSAGES: "inherit", MANAGE_CHANNELS: "inherit",
    },
  },
  {
    id: "readonly",
    label: "閲覧のみ",
    description: "見るだけ。投稿とVC参加は禁止",
    states: {
      VIEW_CHANNEL: "allow", SEND_MESSAGES: "deny", EMBED_LINKS: "deny", ATTACH_FILES: "deny",
      READ_MESSAGE_HISTORY: "allow", CONNECT: "deny", SPEAK: "deny",
      MANAGE_MESSAGES: "inherit", MANAGE_CHANNELS: "inherit",
    },
  },
  {
    id: "hidden",
    label: "非表示",
    description: "このロールからチャンネルを隠す",
    states: {
      VIEW_CHANNEL: "deny", SEND_MESSAGES: "inherit", EMBED_LINKS: "inherit", ATTACH_FILES: "inherit",
      READ_MESSAGE_HISTORY: "inherit", CONNECT: "inherit", SPEAK: "inherit",
      MANAGE_MESSAGES: "inherit", MANAGE_CHANNELS: "inherit",
    },
  },
  {
    id: "staff",
    label: "スタッフ",
    description: "閲覧・投稿・メッセージ管理を許可",
    states: {
      VIEW_CHANNEL: "allow", SEND_MESSAGES: "allow", EMBED_LINKS: "allow", ATTACH_FILES: "allow",
      READ_MESSAGE_HISTORY: "allow", CONNECT: "allow", SPEAK: "allow",
      MANAGE_MESSAGES: "allow", MANAGE_CHANNELS: "inherit",
    },
  },
  {
    id: "reset",
    label: "継承に戻す",
    description: "このロールの個別上書きを解除",
    states: {
      VIEW_CHANNEL: "inherit", SEND_MESSAGES: "inherit", EMBED_LINKS: "inherit", ATTACH_FILES: "inherit",
      READ_MESSAGE_HISTORY: "inherit", CONNECT: "inherit", SPEAK: "inherit",
      MANAGE_MESSAGES: "inherit", MANAGE_CHANNELS: "inherit",
    },
  },
];

function hasBit(value: string, bit: string) {
  return (BigInt(value || "0") & BigInt(bit)) !== 0n;
}

function channelIcon(type: number) {
  if (type === 4) return "▾";
  if (type === 2 || type === 13) return "◉";
  return "#";
}

export default function BulkPermissions({ guildId }: { guildId: string }) {
  const [data, setData] = useState<ManageData | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [roleId, setRoleId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [states, setStates] = useState<Record<string, PermissionState>>({});
  const [templateName, setTemplateName] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [matrixPermissionKey, setMatrixPermissionKey] = useState("VIEW_CHANNEL");

  const load = useCallback(async () => {
    const res = await fetch(`/api/guilds/${guildId}/manage`, { cache: "no-store" });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || "権限データを取得できませんでした");
    const next = json as ManageData;
    setData(next);
    setRoleId((current) => next.roles.some((r) => r.id === current) ? current : next.roles.find((r) => r.everyone)?.id || next.roles.find((r) => !r.managed)?.id || "");
    const defs = next.permissions.filter((p) => p.channel);
    setStates((current) => {
      if (Object.keys(current).length) return current;
      return Object.fromEntries(defs.map((p) => [p.key, "inherit"])) as Record<string, PermissionState>;
    });
    if (!defs.some((p) => p.key === matrixPermissionKey)) setMatrixPermissionKey(defs[0]?.key || "VIEW_CHANNEL");
  }, [guildId, matrixPermissionKey]);

  useEffect(() => {
    void load().catch((error) => setMessage(error instanceof Error ? error.message : "読み込みに失敗しました"));
  }, [load]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`nexora-permission-templates:${guildId}`);
      if (raw) setTemplates(JSON.parse(raw) as Template[]);
    } catch {
      setTemplates([]);
    }
  }, [guildId]);

  const channelPermissions = useMemo(() => data?.permissions.filter((p) => p.channel) || [], [data]);
  const categories = useMemo(() => data?.channels.filter((c) => c.type === 4) || [], [data]);
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const selectedRole = useMemo(() => data?.roles.find((r) => r.id === roleId) || null, [data, roleId]);
  const matrixPermission = useMemo(() => channelPermissions.find((p) => p.key === matrixPermissionKey) || channelPermissions[0] || null, [channelPermissions, matrixPermissionKey]);

  function permissionState(channel: Channel, targetRoleId: string, bit: string): PermissionState {
    const overwrite = channel.permission_overwrites.find((o) => o.id === targetRoleId && o.type === 0);
    if (!overwrite) return "inherit";
    if (hasBit(overwrite.allow, bit)) return "allow";
    if (hasBit(overwrite.deny, bit)) return "deny";
    return "inherit";
  }

  function chooseCategory(id: string) {
    setCategoryId(id);
    if (!data) return;
    if (!id) return;
    const ids = data.channels.filter((c) => c.id === id || c.parent_id === id).map((c) => c.id);
    setSelectedIds(ids);
  }

  function toggleChannel(id: string) {
    setSelectedIds((current) => current.includes(id) ? current.filter((x) => x !== id) : [...current, id]);
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    const next = { ...states };
    for (const permission of channelPermissions) next[permission.key] = preset.states[permission.key] || "inherit";
    setStates(next);
    setMessage(`プリセット「${preset.label}」を選択しました。最後に一括適用を押してください。`);
  }

  async function post(payload: Record<string, unknown>, successMessage: string) {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch(`/api/guilds/${guildId}/manage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "操作に失敗しました");
      setMessage(successMessage);
      await load();
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "操作に失敗しました");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function applyBulk() {
    if (!roleId) return setMessage("ロールを選択してください。");
    if (!selectedIds.length) return setMessage("対象チャンネルを選択してください。");
    await post(
      { action: "channel.permission.bulk", roleId, channelIds: selectedIds, states },
      `${selectedIds.length}チャンネルへ一括反映しました。`,
    );
  }

  async function syncCategoryToChildren() {
    if (!data || !roleId || !categoryId) return setMessage("カテゴリーとロールを選択してください。");
    const category = data.channels.find((c) => c.id === categoryId && c.type === 4);
    if (!category) return setMessage("カテゴリーが見つかりません。");
    const children = data.channels.filter((c) => c.parent_id === categoryId).map((c) => c.id);
    if (!children.length) return setMessage("このカテゴリーに子チャンネルがありません。");
    const inherited = Object.fromEntries(channelPermissions.map((p) => [p.key, permissionState(category, roleId, p.bit)])) as Record<string, PermissionState>;
    await post(
      { action: "channel.permission.bulk", roleId, channelIds: children, states: inherited },
      `カテゴリー「${category.name}」の権限を${children.length}チャンネルへ同期しました。`,
    );
  }

  async function setMatrixState(channelId: string, state: PermissionState) {
    if (!matrixPermission || !roleId) return;
    await post(
      { action: "channel.permission", channelId, roleId, bit: matrixPermission.bit, state },
      "権限を変更しました。",
    );
  }

  function saveTemplate() {
    const name = templateName.trim();
    if (!name) return setMessage("テンプレ名を入力してください。");
    const next = [...templates.filter((t) => t.name !== name), { name, states: { ...states } }];
    setTemplates(next);
    localStorage.setItem(`nexora-permission-templates:${guildId}`, JSON.stringify(next));
    setTemplateName("");
    setMessage(`テンプレート「${name}」を保存しました。`);
  }

  function deleteTemplate(name: string) {
    const next = templates.filter((t) => t.name !== name);
    setTemplates(next);
    localStorage.setItem(`nexora-permission-templates:${guildId}`, JSON.stringify(next));
  }

  if (!data) return <div className="warning-box">一括権限エディターを読み込み中… {message}</div>;

  return (
    <div style={{ display: "grid", gap: 18, marginBottom: 26 }}>
      <div className="warning-box">
        <strong>一括権限エディター</strong><br />
        1チャンネルずつ設定しなくても、ロールと複数チャンネルを選んでまとめて反映できます。
      </div>

      {message ? <div className="manager-message" role="status" style={{ margin: 0 }}>{message}</div> : null}

      <div className="settings-form" style={{ border: "1px solid #2f2d28", borderRadius: 14, padding: 16 }}>
        <div className="mini-title">1. ROLE & CHANNELS</div>
        <div className="two-col">
          <label>対象ロール
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              {data.roles.filter((r) => !r.managed).map((role) => <option key={role.id} value={role.id}>{role.everyone ? "@everyone" : role.name}</option>)}
            </select>
          </label>
          <label>カテゴリーを一括選択
            <select value={categoryId} onChange={(e) => chooseCategory(e.target.value)}>
              <option value="">選択しない</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </label>
        </div>

        <div className="editor-actions" style={{ flexWrap: "wrap" }}>
          <button type="button" className="button ghost" onClick={() => setSelectedIds(data.channels.map((c) => c.id))}>全チャンネル選択</button>
          <button type="button" className="button ghost" onClick={() => setSelectedIds(data.channels.filter((c) => c.type !== 4).map((c) => c.id))}>カテゴリー以外を選択</button>
          <button type="button" className="button ghost" onClick={() => setSelectedIds([])}>選択解除</button>
          <button type="button" className="button ghost" disabled={!categoryId || busy} onClick={() => void syncCategoryToChildren()}>カテゴリー権限を子へ同期</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))", gap: 8, maxHeight: 280, overflowY: "auto", padding: 4 }}>
          {data.channels.map((channel) => (
            <label key={channel.id} className="check-row" style={{ minHeight: 44, border: selectedSet.has(channel.id) ? "1px solid #80663c" : "1px solid #2d2b27", borderRadius: 9, padding: "8px 10px", background: selectedSet.has(channel.id) ? "#181611" : "#111" }}>
              <input type="checkbox" checked={selectedSet.has(channel.id)} onChange={() => toggleChannel(channel.id)} />
              <span>{channelIcon(channel.type)} {channel.name}</span>
            </label>
          ))}
        </div>
        <small style={{ color: "var(--muted)" }}>{selectedIds.length}チャンネル選択中 / ロール: {selectedRole?.everyone ? "@everyone" : selectedRole?.name || "-"}</small>
      </div>

      <div className="settings-form" style={{ border: "1px solid #2f2d28", borderRadius: 14, padding: 16 }}>
        <div className="mini-title">2. PRESET</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 8 }}>
          {PRESETS.map((preset) => (
            <button key={preset.id} type="button" className="button ghost" style={{ minHeight: 66, height: "auto", alignItems: "flex-start", flexDirection: "column", paddingBlock: 10 }} onClick={() => applyPreset(preset)}>
              <strong>{preset.label}</strong><small style={{ color: "var(--muted)", fontWeight: 500, textAlign: "left" }}>{preset.description}</small>
            </button>
          ))}
        </div>

        <div className="permission-table">
          {channelPermissions.map((perm) => (
            <div className="permission-row" key={perm.key}>
              <span>{perm.label}</span>
              <div className="tri-state">
                {(["inherit", "allow", "deny"] as const).map((value) => (
                  <button key={value} type="button" className={states[perm.key] === value ? `active ${value}` : ""} onClick={() => setStates((current) => ({ ...current, [perm.key]: value }))}>
                    {value === "inherit" ? "継承" : value === "allow" ? "許可" : "拒否"}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <button type="button" className="button primary large" disabled={busy || !roleId || !selectedIds.length} onClick={() => void applyBulk()}>
          {busy ? "反映中…" : `${selectedIds.length}チャンネルへ一括適用`}
        </button>
      </div>

      <div className="settings-form" style={{ border: "1px solid #2f2d28", borderRadius: 14, padding: 16 }}>
        <div className="mini-title">3. MY TEMPLATES</div>
        <div className="form-row">
          <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} placeholder="例: 開発チーム専用" maxLength={40} />
          <button type="button" className="button ghost" onClick={saveTemplate}>現在の設定を保存</button>
        </div>
        {templates.length ? <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {templates.map((template) => <span key={template.name} style={{ display: "inline-flex", gap: 6 }}><button type="button" className="button ghost" onClick={() => { setStates({ ...template.states }); setMessage(`テンプレート「${template.name}」を読み込みました。`); }}>{template.name}</button><button type="button" className="button danger" aria-label={`${template.name}を削除`} onClick={() => deleteTemplate(template.name)}>×</button></span>)}
        </div> : <small style={{ color: "var(--muted)" }}>保存したテンプレートはこの端末のブラウザに保存されます。</small>}
      </div>

      <div className="settings-form" style={{ border: "1px solid #2f2d28", borderRadius: 14, padding: 16 }}>
        <div className="mini-title">4. PERMISSION MATRIX</div>
        <label>マトリクスで確認する権限
          <select value={matrixPermissionKey} onChange={(e) => setMatrixPermissionKey(e.target.value)}>
            {channelPermissions.map((permission) => <option key={permission.key} value={permission.key}>{permission.label}</option>)}
          </select>
        </label>
        <small style={{ color: "var(--muted)" }}>選択中ロール「{selectedRole?.everyone ? "@everyone" : selectedRole?.name || "-"}」の各チャンネル設定を一覧で変更できます。</small>
        {matrixPermission ? <div className="permission-table" style={{ maxHeight: 420, overflowY: "auto" }}>
          {data.channels.map((channel) => {
            const current = permissionState(channel, roleId, matrixPermission.bit);
            return <div className="permission-row" key={channel.id}><span>{channelIcon(channel.type)} {channel.name}</span><div className="tri-state">{(["inherit", "allow", "deny"] as const).map((value) => <button key={value} type="button" disabled={busy} className={current === value ? `active ${value}` : ""} onClick={() => void setMatrixState(channel.id, value)}>{value === "inherit" ? "継承" : value === "allow" ? "許可" : "拒否"}</button>)}</div></div>;
          })}
        </div> : null}
      </div>
    </div>
  );
}
