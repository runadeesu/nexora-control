import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { assertCanManageGuild } from "@/lib/discord";
import { ensureCategories } from "@/lib/manage";

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ guildId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { guildId } = await context.params;

  try {
    const body = (await request.json()) as { name?: string };
    const name = (body.name || "").trim().slice(0, 64);
    if (name.length < 2) {
      return NextResponse.json({ error: "ゲーム名を2文字以上入力してください" }, { status: 400 });
    }

    await assertCanManageGuild(session.accessToken, guildId);
    const categoryName = `🎮 ${name.toUpperCase()}`;
    const result = await ensureCategories(guildId, [
      {
        name: categoryName,
        channels: [
          { name: "news", type: 0, topic: `${name} の公式ニュース` },
          { name: "chat", type: 0, topic: `${name} コミュニティチャット` },
          { name: "feedback", type: 0, topic: `${name} へのフィードバック` },
          { name: "screenshots-clips", type: 0, topic: `${name} のスクリーンショット・クリップ` },
        ],
      },
    ]);

    return NextResponse.json({ ok: true, categoryName, created: result.created, existing: result.existing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Game category creation failed" },
      { status: 500 },
    );
  }
}
