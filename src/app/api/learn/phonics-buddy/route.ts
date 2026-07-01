import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { askClaude, isAiConfigured } from "@/lib/ai";

export const maxDuration = 30;

/**
 * The optional Claude-powered "Phonics Buddy": short, kid-friendly hints during a
 * round and warm praise on finishing a world. The client sends a *structured*
 * request (never a raw prompt) and the server templates the wording, so there's
 * no prompt-injection surface. Mirrors the Gemini "Buddy" in the Android app, but
 * uses the Claude Agent SDK per this repo's LLM policy. Degrades to null when no
 * token is configured (the games stay fully playable without it).
 */

const schema = z.union([
  z.object({
    type: z.literal("hint"),
    game: z.enum(["pop", "build", "rhyme", "listen"]),
    word: z.string().min(1).max(24),
    answer: z.string().max(24).optional(),
  }),
  z.object({
    type: z.literal("praise"),
    title: z.string().min(1).max(40),
    subtitle: z.string().min(1).max(60),
    stars: z.number().int().min(1).max(3),
  }),
]);

// GET → whether the Buddy is available, so the client can hide the button.
export async function GET() {
  return NextResponse.json({ enabled: await isAiConfigured() });
}

function buildPrompt(input: z.infer<typeof schema>): string {
  if (input.type === "praise") {
    return (
      `You are a cheerful phonics tutor. A 5-year-old just finished the "${input.title}" ` +
      `phonics game (about ${input.subtitle.toLowerCase()}) with ${input.stars} out of 3 stars. ` +
      `Write ONE short, warm congratulations sentence (max 18 words). No emojis.`
    );
  }
  const base = "You are a cheerful phonics tutor for a 5-year-old child. In ONE short sentence (max 15 words, simple words),";
  switch (input.game) {
    case "pop":
      return `${base} help them hear that the word "${input.word}" starts with the letter "${input.answer ?? ""}". Be warm and playful. No emojis.`;
    case "build":
      return `${base} help them sound out and spell the word "${input.word}" letter by letter. Be warm. No emojis.`;
    case "rhyme":
      return `${base} hint at which word rhymes with "${input.word}" by describing its ending sound, without naming the answer. Be playful. No emojis.`;
    case "listen":
      return `${base} give a fun clue about the word "${input.word}" so they can pick it, without saying the word. Be playful. No emojis.`;
  }
}

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const message = await askClaude(buildPrompt(parsed.data), { model: "haiku" });
  return NextResponse.json({ message });
}
