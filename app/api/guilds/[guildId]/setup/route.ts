import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { assertCanManageGuild } from "@/lib/discord";
import { ROLES, RULES_MESSAGE, STAGES, WELCOME_MESSAGE } from "@/lib/blueprint";
import { ensureCategories, ensureMessage, ensureRoles, getGuildChannels } from "@/lib/manage";

const ALLOWED = new Set(["roles", "public1", "public2", "public3", "staff", "messages"]);

export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ guildId: string }> },
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Login required" }, { status: 401 });
  const { guildId } = await context.params;

  let body: { stage?: string } = {};
  try {
    body = await request.json();
  } catch {}
  const stage = body.stage || "";
  if (!ALLOWED.has(stage)) {
    return NextResponse.json({ error: "Invalid setup stage" }, { status: 400 });
  }

  try {
    await assertCanManageGuild(session.accessToken, guildId);

    if (stage === "roles") {
      const result = await ensureRoles(guildId, ROLES);
      return NextResponse.json({ ok: true, stage, created: result.created, existing: result.existing });
    }

    if (stage === "messages") {
      const channels = await getGuildChannels(guildId);
      const welcome = channels.find((c) => c.name === "welcome" && c.type === 0);
      const rules = channels.find((c) => c.name === "rules" && c.type === 0);
      if (!welcome || !rules) {
        return NextResponse.json({ error: "welcome/rules channels are missing" }, { status: 409 });
      }
      const [welcomePosted, rulesPosted] = await Promise.all([
        ensureMessage(welcome.id, "WELCOME TO NEXORA STUDIOS", WELCOME_MESSAGE),
        ensureMessage(rules.id, "NEXORA STUDIOS — COMMUNITY RULES", RULES_MESSAGE),
      ]);
      return NextResponse.json({
        ok: true,
        stage,
        created: Number(welcomePosted) + Number(rulesPosted),
        existing: Number(!welcomePosted) + Number(!rulesPosted),
      });
    }

    if (stage === "staff") {
      await ensureRoles(guildId, ROLES);
    }

    const specs = STAGES[stage];
    if (!specs) return NextResponse.json({ error: "Unknown stage" }, { status: 400 });
    const result = await ensureCategories(guildId, specs);
    return NextResponse.json({ ok: true, stage, created: result.created, existing: result.existing });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Setup failed" },
      { status: 500 },
    );
  }
}
