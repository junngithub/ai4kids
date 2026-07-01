import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { askClaudeJson } from "@/lib/ai";
import { HEROES, PLACES, OBJECTS, MOODS, buildStory, type Story, type Choice } from "@/lib/story-builder/templates";

export const maxDuration = 45;

// The child sends the *indices* of their picks (0–3 in each list), so there's no
// free-text to sanitize — we resolve them to the known Choice sets server-side.
const schema = z.object({
  hero: z.number().int().min(0).max(HEROES.length - 1),
  place: z.number().int().min(0).max(PLACES.length - 1),
  object: z.number().int().min(0).max(OBJECTS.length - 1),
  mood: z.number().int().min(0).max(MOODS.length - 1),
});

type BranchJson = { emoji?: string; label?: string; pages?: string[] };
type StoryJson = { pre?: string[]; problem?: string; choiceA?: BranchJson; choiceB?: BranchJson };

/** Ask Claude for a fresh branching story in the same shape, else null. */
async function generateWithClaude(h: Choice, p: Choice, o: Choice, m: Choice): Promise<Story | null> {
  const json = await askClaudeJson<StoryJson>(
    `Write a short, gentle, G-rated adventure story for a child aged 7 to 9.
Ingredients to use:
- Hero: ${h.name} ${h.emoji}
- Place: ${p.name} ${p.emoji}
- Magic item: ${o.name} ${o.emoji}
- Tone/mood: ${m.name}

The story branches: the child reads a few pages, hits a friendly problem, then picks one of two ways to solve it. Return ONLY JSON of exactly this shape:
{"pre":["page","page","page"],"problem":"one page that introduces a friendly obstacle and ends with the question: What should the ${h.name} do?","choiceA":{"emoji":"${o.emoji}","label":"Use the ${o.name}","pages":["solve it with the ${o.name}'s magic","a happy celebration","a warm ending that says The End!"]},"choiceB":{"emoji":"🤝","label":"Call for friends","pages":["solve it by asking friends for help","a happy celebration","a warm ending that says The End!"]}}
Rules: each page is 1 to 2 short sentences. Keep it positive, kind, and age-appropriate — no violence, scariness, or romance. Weave the emojis into the sentences. "pre" must have exactly 3 pages; each "pages" exactly 3.`,
    { model: "haiku" },
  );
  if (!json) return null;
  const branch = (b: BranchJson | undefined, fallbackEmoji: string, fallbackLabel: string) => ({
    emoji: b?.emoji?.trim() || fallbackEmoji,
    label: b?.label?.trim() || fallbackLabel,
    pages: (b?.pages ?? []).map((s) => String(s).trim()).filter(Boolean),
  });
  const pre = (json.pre ?? []).map((s) => String(s).trim()).filter(Boolean);
  const problem = String(json.problem ?? "").trim();
  const choiceA = branch(json.choiceA, o.emoji, `Use the ${o.name}`);
  const choiceB = branch(json.choiceB, "🤝", "Call for friends");
  if (pre.length < 1 || !problem || choiceA.pages.length < 1 || choiceB.pages.length < 1) return null;
  return { pre, problem, choiceA, choiceB };
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
  const h = HEROES[parsed.data.hero];
  const p = PLACES[parsed.data.place];
  const o = OBJECTS[parsed.data.object];
  const m = MOODS[parsed.data.mood];

  const story = (await generateWithClaude(h, p, o, m)) ?? buildStory(h, p, o, m);
  return NextResponse.json({ story });
}
