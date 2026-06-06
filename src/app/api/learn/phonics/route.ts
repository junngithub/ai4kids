import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import { askClaudeJson } from "@/lib/ai";

export const maxDuration = 30;

type Round = { word: string; emoji: string; options: string[]; answerIndex: number };

const FALLBACK: Round[] = [
  { word: "cat", emoji: "🐱", options: ["cat", "dog", "sun"], answerIndex: 0 },
  { word: "sun", emoji: "☀️", options: ["map", "sun", "cup"], answerIndex: 1 },
  { word: "dog", emoji: "🐶", options: ["pig", "hat", "dog"], answerIndex: 2 },
  { word: "fish", emoji: "🐟", options: ["fish", "frog", "bird"], answerIndex: 0 },
  { word: "star", emoji: "⭐", options: ["moon", "star", "tree"], answerIndex: 1 },
];

export async function GET() {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const rounds =
    (await askClaudeJson<{ rounds: Round[] }>(
      `Create 5 phonics rounds for a young child learning to read.
Return ONLY JSON: {"rounds":[{"word":"<simple word>","emoji":"<one emoji for the word>","options":["<word>","<distractor>","<distractor>"],"answerIndex":<0-2>}]}
Use short, common, decodable words (3-5 letters). Make sure the correct word at answerIndex matches "word".`,
      { model: "haiku" },
    ).then((r) => r?.rounds))?.filter(
      (r) => r && r.options?.[r.answerIndex] === r.word,
    ) ?? null;

  return NextResponse.json({ rounds: rounds && rounds.length >= 3 ? rounds : FALLBACK });
}
