import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { generateAndStoreKidImage } from "@/lib/gemini-image";

export const maxDuration = 60;

// Illustrate one Story Builder page on demand. The reader shows an emoji header
// while this loads (and if it returns null), so illustrations are a progressive
// enhancement — the story is fully readable without them. The prompt is run
// through the kid-safe templating in generateAndStoreKidImage.
const schema = z.object({ text: z.string().min(1).max(400) });

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const url = await generateAndStoreKidImage(parsed.data.text, "watercolor", `learn/story/${session.id}`);
  return NextResponse.json({ url });
}
