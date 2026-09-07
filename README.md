# NEXORA Control

NEXORA STUDIOS向けのDiscordサーバー自動構築・管理サイトです。Vercel + Next.js 16で動きます。

## できること

- Discord OAuthログイン
- 管理権限のあるサーバーだけ表示
- NEXORA Manager Botのインストール導線
- ワンクリックで標準ロールを自動作成
- INFORMATION / GAMES / DEVELOPMENT / COMMUNITY / FEEDBACK / TESTING / VOICE / STAFF ONLY を自動作成
- Welcome / Rulesの初期メッセージを自動投稿
- 同じ構成を再実行しても不足分だけ補充（同名項目をむやみに重複作成しない）
- ゲーム名を入力するだけで専用カテゴリー + news / chat / feedback / screenshots-clips を自動作成
- Bot Tokenはサーバー側のみ。ブラウザには公開しません

## 重要: Discordサーバー本体の新規作成について

Discordの現行公式APIには、Bot/OAuthアプリがユーザーの代わりに新規Guild（サーバー）を作る公開エンドポイントがありません。
そのため最初の空サーバー作成だけはDiscordアプリ側で1回行います。カテゴリーやチャンネルは作らなくて大丈夫です。
空サーバー作成後はNEXORA Controlが残りを一括で構築します。

## 1. Discord Developer PortalでApplicationを作成

1. Discord Developer PortalでNew Applicationを作る
2. `OAuth2` で Redirect URL に以下を登録
   - 開発: `http://localhost:3000/api/auth/callback`
   - 本番: `https://YOUR-DOMAIN.vercel.app/api/auth/callback`
3. `Bot` からBotを作成し、Tokenを取得
4. Bot Tokenは絶対に公開・Git commitしない

このアプリが要求するBot権限はAdministratorではなく、以下の最小構成です。

- Create Instant Invite
- Manage Channels
- Manage Guild
- View Channel
- Send Messages
- Embed Links
- Read Message History
- Manage Roles

## 2. Environment Variables

`.env.example` を `.env.local` にコピーして入力します。

```bash
cp .env.example .env.local
```

必要な値:

```env
DISCORD_CLIENT_ID=
DISCORD_CLIENT_SECRET=
DISCORD_BOT_TOKEN=
NEXT_PUBLIC_APP_URL=http://localhost:3000
SESSION_SECRET=
```

`SESSION_SECRET` は32文字以上のランダム文字列を推奨します。

## 3. ローカル起動

```bash
npm install
npm run dev
```

## 4. Vercel

Vercel Project Settings -> Environment Variables に同じ4つの秘密値と `NEXT_PUBLIC_APP_URL` を設定してDeployします。
本番URLが決まったら、Discord Developer PortalのRedirect URLと `NEXT_PUBLIC_APP_URL` を同じ本番URLに合わせます。

## セキュリティ

- Discord Bot Token / Client Secret / Session Secretを `NEXT_PUBLIC_` にしない
- `.env.local` をGitに追加しない
- Botロールは自動作成するNEXORAロールより上に置く（Manage Rolesの階層制限のため）
- Founder / Administratorロールは強い権限を持つため、信頼できるユーザーだけに割り当てる

## v1.1 Advanced Server Manager

NEXORA Control now includes a full mobile-friendly Discord management panel:

- Channel settings: name, topic, category, slowmode, NSFW, voice user limit
- Create and delete text/voice/category channels
- Per-role channel permission overrides with Inherit / Allow / Deny
- Role editor: name, color, hoist, mentionable, server permissions
- Create/delete editable roles
- Server settings: verification level, explicit content filter, default notifications, AFK channel/timeout, system channel
- Administrator is intentionally NOT auto-created. Create the Administrator role manually in Discord.

After upgrading, use the Bot install/permission update link once so the existing NEXORA bot role receives the expanded non-Administrator permissions required to manage these settings.
