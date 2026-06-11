import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { cardSessionPlayers } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal-session";
import { getCardSessionByCode, buildCardState } from "@/lib/card-session";

const schema = z.object({ code: z.string().min(2).max(12) });

// Heartbeat + poll in one cheap call (~1s polling cadence on the client).
export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid payload" }, { status: 400 });

  const game = await getCardSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No such game" }, { status: 404 });

  const learnerId = Number(session.id);
  await db
    .update(cardSessionPlayers)
    .set({ lastSeen: new Date() })
    .where(
      and(
        eq(cardSessionPlayers.sessionId, game.id),
        eq(cardSessionPlayers.learnerId, learnerId),
      ),
    );

  return NextResponse.json({ state: await buildCardState(game, learnerId) });
}
