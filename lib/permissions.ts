export const PERMISSION_DEFS = [
  { key: "VIEW_CHANNEL", label: "チャンネルを見る", bit: 1n << 10n, channel: true, role: true },
  { key: "SEND_MESSAGES", label: "メッセージを送る", bit: 1n << 11n, channel: true, role: true },
  { key: "MANAGE_MESSAGES", label: "メッセージを管理", bit: 1n << 13n, channel: true, role: true },
  { key: "EMBED_LINKS", label: "埋め込みリンク", bit: 1n << 14n, channel: true, role: true },
  { key: "ATTACH_FILES", label: "ファイル添付", bit: 1n << 15n, channel: true, role: true },
  { key: "READ_MESSAGE_HISTORY", label: "履歴を見る", bit: 1n << 16n, channel: true, role: true },
  { key: "CONNECT", label: "VCに接続", bit: 1n << 20n, channel: true, role: true },
  { key: "SPEAK", label: "VCで話す", bit: 1n << 21n, channel: true, role: true },
  { key: "KICK_MEMBERS", label: "メンバーをキック", bit: 1n << 1n, channel: false, role: true },
  { key: "BAN_MEMBERS", label: "メンバーをBAN", bit: 1n << 2n, channel: false, role: true },
  { key: "MANAGE_CHANNELS", label: "チャンネル管理", bit: 1n << 4n, channel: true, role: true },
  { key: "MANAGE_GUILD", label: "サーバー管理", bit: 1n << 5n, channel: false, role: true },
  { key: "MANAGE_ROLES", label: "ロール管理", bit: 1n << 28n, channel: false, role: true },
  { key: "MODERATE_MEMBERS", label: "メンバーをタイムアウト", bit: 1n << 40n, channel: false, role: true },
] as const;

export const CHANNEL_PERMISSION_MASK = PERMISSION_DEFS
  .filter((p) => p.channel)
  .reduce((acc, p) => acc | p.bit, 0n);

export const ROLE_PERMISSION_MASK = PERMISSION_DEFS
  .filter((p) => p.role)
  .reduce((acc, p) => acc | p.bit, 0n);

export function permissionPayload() {
  return PERMISSION_DEFS.map((p) => ({
    key: p.key,
    label: p.label,
    bit: p.bit.toString(),
    channel: p.channel,
    role: p.role,
  }));
}
