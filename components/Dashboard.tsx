"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import AdvancedManager from "./AdvancedManager";

type User = { id: string; username: string; displayName: string; avatarUrl: string | null };
type Guild = { id: string; name: string; owner: boolean; iconUrl: string | null };
type Me = {
  authenticated: boolean;
  user: User;
  guilds: Guild[];
  createServerUrl: string;
};
type Status = {
  guild: { id: string; name: string };
  botInstalled: boolean;
  installUrl: string;
  counts?: { channels: number; roles: number; nexoraManaged: number };
};
type Progress = { stage: string; label: string; state: "waiting" | "running" | "done" | "error"; detail?: string };

const SETUP_STAGES = [
  ["roles", "役職を作成"],
  ["public1", "案内・ゲーム情報"],
  ["public2", "開発・コミュニティ"],
  ["public3", "フィードバック・テスト・VC"],
  ["staff", "スタッフ専用エリア"],
  ["messages", "Welcome・Rulesを投稿"],
] as const;

function cls(...names: Array<string | false | null | undefined>) {
  return names.filter(Boolean).join(" ");
}

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [me, setMe] = useState<Me | null>(null);
  const [selectedGuildId, setSelectedGuildId] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [statusLoading, setStatusLoading] = useState(false);
  const [building, setBuilding] = useState(false);
  const [progress, setProgress] = useState<Progress[]>(
    SETUP_STAGES.map(([stage, label]) => ({ stage, label, state: "waiting" })),
  );
  const [gameName, setGameName] = useState("");
  const [gameBusy, setGameBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const selectedGuild = useMemo(
    () => me?.guilds.find((g) => g.id === selectedGuildId) || null,
    [me, selectedGuildId],
  );

  const loadMe = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/me", { cache: "no-store" });
      if (!res.ok) {
        setMe(null);
        return;
      }
      const data = (await res.json()) as Me;
      setMe(data);
      setSelectedGuildId((current) => current || data.guilds[0]?.id || "");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadStatus = useCallback(async (guildId: string) => {
    if (!guildId) return;
    setStatusLoading(true);
    setNotice("");
    try {
      const res = await fetch(`/api/guilds/${guildId}/status`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "状態を取得できませんでした");
      setStatus(data as Status);
    } catch (error) {
      setStatus(null);
      setNotice(error instanceof Error ? error.message : "状態を取得できませんでした");
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  useEffect(() => {
    if (selectedGuildId) void loadStatus(selectedGuildId);
    else setStatus(null);
  }, [selectedGuildId, loadStatus]);

  async function buildServer() {
    if (!selectedGuildId || building) return;
    setBuilding(true);
    setNotice("");
    setProgress(SETUP_STAGES.map(([stage, label]) => ({ stage, label, state: "waiting" })));

    for (const [stage, label] of SETUP_STAGES) {
      setProgress((items) => items.map((x) => (x.stage === stage ? { ...x, state: "running" } : x)));
      try {
        const res = await fetch(`/api/guilds/${selectedGuildId}/setup`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `${label} に失敗しました`);
        setProgress((items) =>
          items.map((x) =>
            x.stage === stage
              ? { ...x, state: "done", detail: `新規 ${data.created} / 既存 ${data.existing}` }
              : x,
          ),
        );
      } catch (error) {
        setProgress((items) =>
          items.map((x) =>
            x.stage === stage
              ? { ...x, state: "error", detail: error instanceof Error ? error.message : "失敗" }
              : x,
          ),
        );
        setNotice("途中で止まりました。もう一度押せば不足分だけ続きから補充できます。");
        setBuilding(false);
        return;
      }
    }

    setBuilding(false);
    setNotice("NEXORA STUDIOS Discord構成を同期しました。Discordを開いて確認できます。");
    await loadStatus(selectedGuildId);
  }

  async function addGame(event: FormEvent) {
    event.preventDefault();
    if (!selectedGuildId || gameBusy || gameName.trim().length < 2) return;
    setGameBusy(true);
    setNotice("");
    try {
      const res = await fetch(`/api/guilds/${selectedGuildId}/game`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: gameName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ゲームカテゴリーを作成できませんでした");
      setNotice(`${data.categoryName} を作成しました。news / chat / feedback / screenshots-clips も自動追加済み。`);
      setGameName("");
      await loadStatus(selectedGuildId);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "作成に失敗しました");
    } finally {
      setGameBusy(false);
    }
  }

  return (
    <main className="site-shell">
      <header className="topbar">
        <div className="brand-lockup">
          <Image src="/nexora-logo.svg" alt="NEXORA emblem" width={52} height={52} priority />
          <div>
            <div className="eyebrow">NEXORA STUDIOS</div>
            <div className="brand-title">CONTROL</div>
          </div>
        </div>
        {me ? (
          <div className="account-pill">
            <span>{me.user.displayName}</span>
            <a href="/api/auth/logout">ログアウト</a>
          </div>
        ) : null}
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">DISCORD SERVER OPERATIONS</p>
          <h1>チャンネル作成を、<br />もう手作業でやらない。</h1>
          <p className="hero-text">
            NEXORA用の役職・カテゴリー・テキストチャンネル・VC・スタッフ専用エリア・Welcome・Rulesを一括構築。
            ゲームが増えたらゲーム名を入れるだけで専用エリアも自動生成します。
          </p>
        </div>
        <div className="hero-stamp" aria-label="Create Worlds. Break Limits.">
          <span>CREATE WORLDS.</span>
          <strong>BREAK LIMITS.</strong>
        </div>
      </section>

      {notice ? <div className="notice" role="status">{notice}</div> : null}

      {loading ? (
        <section className="panel loading-panel">Discord接続状態を確認中…</section>
      ) : !me ? (
        <section className="panel auth-panel">
          <div>
            <p className="section-number">01</p>
            <h2>Discordを接続</h2>
            <p>サーバー一覧を取得するためにDiscordでログインします。Botトークンはブラウザには送信されません。</p>
          </div>
          <a className="button primary" href="/api/auth/login">Discordでログイン</a>
        </section>
      ) : (
        <div className="workspace">
          <section className="panel server-panel">
            <div className="panel-heading">
              <div>
                <p className="section-number">01</p>
                <h2>管理するサーバー</h2>
              </div>
              <button type="button" className="button ghost" onClick={() => void loadMe()}>一覧を更新</button>
            </div>

            {me.guilds.length === 0 ? (
              <div className="empty-state">
                <h3>管理できるサーバーがまだありません</h3>
                <p>Discord側で空サーバーを1個だけ作ってください。カテゴリーやチャンネルは作らなくてOKです。</p>
                <a className="button primary" href={me.createServerUrl} target="_blank" rel="noreferrer">Discordを開く</a>
              </div>
            ) : (
              <div className="guild-grid">
                {me.guilds.map((guild) => (
                  <button
                    key={guild.id}
                    type="button"
                    className={cls("guild-card", selectedGuildId === guild.id && "selected")}
                    onClick={() => setSelectedGuildId(guild.id)}
                  >
                    <span className="guild-icon">
                      {guild.iconUrl ? <img src={guild.iconUrl} alt="" /> : guild.name.slice(0, 1).toUpperCase()}
                    </span>
                    <span className="guild-name">{guild.name}</span>
                    <span className="guild-meta">{guild.owner ? "OWNER" : "MANAGER"}</span>
                  </button>
                ))}
              </div>
            )}
          </section>

          {selectedGuild ? (
            <section className="panel action-panel">
              <div className="panel-heading">
                <div>
                  <p className="section-number">02</p>
                  <h2>{selectedGuild.name}</h2>
                </div>
                <div className="status-chip">{statusLoading ? "CHECKING" : status?.botInstalled ? "BOT ONLINE" : "BOT REQUIRED"}</div>
              </div>

              {statusLoading ? (
                <p>Botの状態を確認中…</p>
              ) : status && !status.botInstalled ? (
                <div className="install-block">
                  <div>
                    <h3>NEXORA Manager Botを追加</h3>
                    <p>チャンネル管理・ロール管理など、構築に必要な権限だけを要求します。</p>
                  </div>
                  <a className="button primary" href={status.installUrl} target="_blank" rel="noreferrer">Botをこのサーバーに追加</a>
                  <button type="button" className="button ghost" onClick={() => void loadStatus(selectedGuildId)}>追加したので再確認</button>
                </div>
              ) : status?.botInstalled ? (
                <>
                  <div className="metrics">
                    <div><strong>{status.counts?.channels ?? 0}</strong><span>Channels</span></div>
                    <div><strong>{status.counts?.roles ?? 0}</strong><span>Roles</span></div>
                    <div><strong>{status.counts?.nexoraManaged ?? 0}</strong><span>NEXORA Managed</span></div>
                  </div>

                  <div className="build-block">
                    <div>
                      <h3>NEXORA標準構成を一括構築</h3>
                      <p>再実行しても同名の項目は重複作成せず、不足している部分だけ追加します。</p>
                    </div>
                    <button type="button" className="button primary large" onClick={() => void buildServer()} disabled={building}>
                      {building ? "構築中…" : "NEXORAを一括構築"}
                    </button>
                  </div>

                  <div className="progress-list" aria-live="polite">
                    {progress.map((item, index) => (
                      <div key={item.stage} className={cls("progress-row", item.state)}>
                        <span className="progress-index">{String(index + 1).padStart(2, "0")}</span>
                        <span className="progress-label">{item.label}</span>
                        <span className="progress-state">
                          {item.state === "waiting" ? "—" : item.state === "running" ? "実行中" : item.state === "done" ? item.detail || "完了" : item.detail || "エラー"}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : null}
            </section>
          ) : null}

          {selectedGuild && status?.botInstalled ? (
            <section className="panel game-panel">
              <div>
                <p className="section-number">03</p>
                <h2>新しいゲームを追加</h2>
                <p>ゲーム名だけ入力。専用カテゴリーと4チャンネルを一括で作ります。</p>
              </div>
              <form className="game-form" onSubmit={addGame}>
                <label htmlFor="gameName">GAME TITLE</label>
                <div className="form-row">
                  <input
                    id="gameName"
                    value={gameName}
                    onChange={(event) => setGameName(event.target.value)}
                    placeholder="例: SCOOTER WORLD"
                    maxLength={64}
                  />
                  <button className="button primary" type="submit" disabled={gameBusy || gameName.trim().length < 2}>
                    {gameBusy ? "作成中…" : "ゲームエリアを自動作成"}
                  </button>
                </div>
                <p className="form-hint">自動作成: #news / #chat / #feedback / #screenshots-clips</p>
              </form>
              <a className="discord-link" href={`https://discord.com/channels/${selectedGuildId}`} target="_blank" rel="noreferrer">
                Discordでこのサーバーを開く →
              </a>
            </section>
          ) : null}

          {selectedGuild && status?.botInstalled ? <AdvancedManager guildId={selectedGuildId} /> : null}
        </div>
      )}

      <footer>
        <span>NEXORA STUDIOS</span>
        <span>CREATE WORLDS. BREAK LIMITS.</span>
      </footer>
    </main>
  );
}
