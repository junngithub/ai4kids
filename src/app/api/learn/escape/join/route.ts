import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { getSessionByCode, upsertPlayer, buildState } from "@/lib/escape-session";

const schema = z.object({ code: z.string().min(2).max(12) });

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid code" }, { status: 400 });

  const game = await getSessionByCode(parsed.data.code);
  if (!game) return NextResponse.json({ error: "No room with that code" }, { status: 404 });
  if (game.status === "escaped") {
    return NextResponse.json({ error: "That game has already finished" }, { status: 409 });
  }

  const learnerId = Number(session.id);
  await upsertPlayer({ sessionId: game.id, learnerId, name: session.name || "Player" });
  return NextResponse.json({ code: game.code, roomSlug: game.roomSlug, state: await buildState(game, learnerId) });
}
