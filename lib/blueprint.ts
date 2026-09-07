export const P = {
  CREATE_INSTANT_INVITE: 1n << 0n,
  KICK_MEMBERS: 1n << 1n,
  BAN_MEMBERS: 1n << 2n,
  ADMINISTRATOR: 1n << 3n,
  MANAGE_CHANNELS: 1n << 4n,
  MANAGE_GUILD: 1n << 5n,
  ADD_REACTIONS: 1n << 6n,
  VIEW_CHANNEL: 1n << 10n,
  SEND_MESSAGES: 1n << 11n,
  MANAGE_MESSAGES: 1n << 13n,
  EMBED_LINKS: 1n << 14n,
  ATTACH_FILES: 1n << 15n,
  READ_MESSAGE_HISTORY: 1n << 16n,
  CONNECT: 1n << 20n,
  SPEAK: 1n << 21n,
  MANAGE_ROLES: 1n << 28n,
  MODERATE_MEMBERS: 1n << 40n,
} as const;

export type RoleSpec = {
  name: string;
  permissions: bigint;
  color: number;
  hoist?: boolean;
};

export const ROLES: RoleSpec[] = [
  { name: "🎮 Player", permissions: 0n, color: 0x747f8d },
  { name: "⭐ Early Supporter", permissions: 0n, color: 0xc7a253, hoist: true },
  { name: "🧪 Official Tester", permissions: 0n, color: 0x8a6ccf, hoist: true },
  {
    name: "🔨 Moderator",
    permissions: P.KICK_MEMBERS | P.BAN_MEMBERS | P.MANAGE_MESSAGES | P.MODERATE_MEMBERS,
    color: 0x4f7f68,
    hoist: true,
  },
  { name: "🎬 Content Creator", permissions: 0n, color: 0xb85d72, hoist: true },
  { name: "🎵 Sound Designer", permissions: 0n, color: 0x9670ad, hoist: true },
  { name: "🎨 3D Artist", permissions: 0n, color: 0x9f7549, hoist: true },
  { name: "🛠 Developer", permissions: 0n, color: 0x557da3, hoist: true },
  {
    name: "⚙️ Studio Director",
    permissions:
      P.MANAGE_GUILD |
      P.MANAGE_CHANNELS |
      P.MANAGE_ROLES |
      P.MANAGE_MESSAGES |
      P.KICK_MEMBERS |
      P.BAN_MEMBERS |
      P.MODERATE_MEMBERS,
    color: 0xa77b32,
    hoist: true,
  },
  {
    name: "👑 Founder",
    permissions:
      P.MANAGE_GUILD |
      P.MANAGE_CHANNELS |
      P.MANAGE_ROLES |
      P.MANAGE_MESSAGES |
      P.KICK_MEMBERS |
      P.BAN_MEMBERS |
      P.MODERATE_MEMBERS,
    color: 0xd3a94d,
    hoist: true,
  },
];

export type ChannelSpec = {
  name: string;
  type: 0 | 2;
  topic?: string;
};

export type CategorySpec = {
  name: string;
  privateStaff?: boolean;
  channels: ChannelSpec[];
};

export const STAGES: Record<string, CategorySpec[]> = {
  public1: [
    {
      name: "📌 INFORMATION",
      channels: [
        { name: "welcome", type: 0, topic: "NEXORA STUDIOSへようこそ。まずここから。" },
        { name: "rules", type: 0, topic: "NEXORA STUDIOS Community Rules" },
        { name: "announcements", type: 0, topic: "重要なお知らせ" },
        { name: "studio-news", type: 0, topic: "スタジオ全体のニュース" },
        { name: "roles", type: 0, topic: "ロール案内" },
        { name: "faq", type: 0, topic: "よくある質問" },
      ],
    },
    {
      name: "🎮 GAMES",
      channels: [
        { name: "our-games", type: 0, topic: "NEXORA STUDIOSのゲーム一覧" },
        { name: "upcoming-games", type: 0, topic: "開発中・今後の作品" },
        { name: "release-news", type: 0, topic: "リリース情報" },
        { name: "game-updates", type: 0, topic: "ゲームアップデート情報" },
      ],
    },
  ],
  public2: [
    {
      name: "🛠 DEVELOPMENT",
      channels: [
        { name: "dev-log", type: 0, topic: "開発ログ" },
        { name: "work-in-progress", type: 0, topic: "制作途中の内容" },
        { name: "screenshots", type: 0, topic: "開発スクリーンショット" },
        { name: "concept-art", type: 0, topic: "コンセプトアート" },
        { name: "trailers", type: 0, topic: "トレーラー・映像" },
        { name: "behind-the-scenes", type: 0, topic: "制作の裏側" },
      ],
    },
    {
      name: "💬 COMMUNITY",
      channels: [
        { name: "general", type: 0, topic: "メインコミュニティチャット" },
        { name: "gaming", type: 0, topic: "ゲーム雑談" },
        { name: "screenshots-and-clips", type: 0, topic: "スクショ・クリップ共有" },
        { name: "suggestions", type: 0, topic: "NEXORAへの提案" },
        { name: "off-topic", type: 0, topic: "自由な雑談" },
        { name: "memes", type: 0, topic: "ミーム" },
      ],
    },
  ],
  public3: [
    {
      name: "🐛 FEEDBACK",
      channels: [
        { name: "bug-reports", type: 0, topic: "バグ報告" },
        { name: "game-feedback", type: 0, topic: "ゲームへのフィードバック" },
        { name: "feature-requests", type: 0, topic: "機能リクエスト" },
        { name: "known-issues", type: 0, topic: "確認済みの不具合" },
      ],
    },
    {
      name: "🧪 TESTING",
      channels: [
        { name: "beta-news", type: 0, topic: "ベータ版のお知らせ" },
        { name: "beta-chat", type: 0, topic: "テスター用チャット" },
        { name: "tester-feedback", type: 0, topic: "テスターからのフィードバック" },
      ],
    },
    {
      name: "🎙 VOICE",
      channels: [
        { name: "General", type: 2 },
        { name: "Gaming", type: 2 },
        { name: "Play Together", type: 2 },
        { name: "AFK", type: 2 },
      ],
    },
  ],
  staff: [
    {
      name: "🔒 STAFF ONLY",
      privateStaff: true,
      channels: [
        { name: "staff-chat", type: 0, topic: "スタッフ専用チャット" },
        { name: "studio-planning", type: 0, topic: "スタジオ運営計画" },
        { name: "game-planning", type: 0, topic: "ゲーム企画" },
        { name: "release-planning", type: 0, topic: "リリース計画" },
        { name: "bug-tracking", type: 0, topic: "内部バグ追跡" },
        { name: "moderation", type: 0, topic: "モデレーション" },
        { name: "staff-logs", type: 0, topic: "スタッフログ" },
      ],
    },
  ],
};

export const STAFF_ROLE_NAMES = [
  "👑 Founder",
  "⚙️ Studio Director",
  "🛡 Administrator",
  "🛠 Developer",
  "🎨 3D Artist",
  "🎵 Sound Designer",
  "🎬 Content Creator",
  "🔨 Moderator",
];

export const WELCOME_MESSAGE = `# WELCOME TO NEXORA STUDIOS 🎮\n\nNEXORA STUDIOS公式Discordへようこそ！\n\nNEXORA STUDIOSは、ジャンルに縛られず、さまざまな3Dゲームを制作するインディーゲームスタジオです。\n\n🎮 新作ゲーム情報\n🛠 開発状況\n📸 最新スクリーンショット\n🎬 トレーラー\n🧪 ベータテスト\n🐛 バグ報告\n💡 ゲームへの提案\n💬 プレイヤー同士の交流\n\nまずは **#rules** を確認してください。\n\n**CREATE WORLDS. BREAK LIMITS.**`;

export const RULES_MESSAGE = `# NEXORA STUDIOS — COMMUNITY RULES\n\n**1. 他のメンバーを尊重する**\n暴言、過度な煽り、嫌がらせ、差別的な発言、執拗な攻撃は禁止です。\n\n**2. スパム禁止**\n同じメッセージの連投、無意味な大量メンション、荒らし行為は禁止です。\n\n**3. 不適切なコンテンツは禁止**\nNSFWコンテンツや過度に不快な投稿は禁止です。\n\n**4. 宣伝は許可された場所のみ**\n無断宣伝は禁止です。\n\n**5. ネタバレに配慮する**\n重大なネタバレにはスポイラー表示を使用してください。\n\n**6. バグの悪用禁止**\n重大な不具合は悪用せず **#bug-reports** に報告してください。\n\n**7. 未公開情報を共有しない**\nテスト版・スタッフ限定情報の無断転載は禁止です。\n\n**8. スタッフになりすまさない**\n開発者・スタッフ・モデレーターへのなりすましは禁止です。\n\n**9. Discordの利用規約を守る**\nDiscordの利用規約・コミュニティガイドラインに従ってください。\n\n**10. スタッフの判断に従う**\n必要に応じて警告・ミュート・キック・BAN等を行う場合があります。\n\n**Thank you for being part of NEXORA STUDIOS.**`;
