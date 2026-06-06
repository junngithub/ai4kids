import { NextResponse } from "next/server";
import { z } from "zod";
import { getPortalSession } from "@/lib/portal-session";
import { askClaudeJson } from "@/lib/ai";
import { recordCompletion } from "@/lib/activities";

export const maxDuration = 60;

const schema = z.object({ prompt: z.string().min(1).max(300) });

type Story = {
  title: string;
  scenes: { text: string; emojis: string }[];
};

// Offline fallback so the activity always works in a demo.
function fallbackStory(prompt: string): Story {
  return {
    title: `The Adventure of ${prompt.slice(0, 40)}`,
    scenes: [
      { text: `Once upon a time, a brave hero set off because of ${prompt}.`, emojis: "🌅🧒✨" },
      { text: "Along the way they met a friendly robot who loved to help.", emojis: "🤖🤝🌟" },
      { text: "Together they solved the puzzle and saved the day! The end.", emojis: "🧩🎉🏆" },
    ],
  };
}

export async function POST(req: Request) {
  const session = await getPortalSession();
  if (!session || session.role !== "learner") {
    return NextResponse.json({ error: "Learners only" }, { status: 403 });
  }
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Tell me what to write about!" }, { status: 400 });

  const ageGroup = "kids";
  const story =
    (await askClaudeJson<Story>(
      `Write a short, wholesome 3-scene illustrated story for ${ageGroup} about: "${parsed.data.prompt}".
Return ONLY JSON of the form:
{"title": string, "scenes": [{"text": "2-3 simple sentences", "emojis": "2-4 emojis that illustrate the scene"}, ... exactly 3 scenes]}
Keep language simple, positive, and age-appropriate. No scary or unsafe content.`,
      { model: "haiku" },
    )) ?? fallbackStory(parsed.data.prompt);

  // Score: reward longer, complete stories (capped).
  const words = story.scenes.reduce((n, s) => n + s.text.split(/\s+/).length, 0);
  const score = Math.min(100, 40 + Math.round(words / 2));

  await recordCompletion({
    learnerId: Number(session.id),
    activitySlug: "ai-storytelling",
    score,
    metadata: { prompt: parsed.data.prompt, story },
  });

  return NextResponse.json({ story, score });
}
