import { NextResponse } from "next/server";
import { z } from "zod";
import { isAdminRequest } from "@/lib/admin-guard";
import { runClaudeAssist } from "@/lib/ai/claude";
import { db } from "@/db";
import { categories, tags } from "@/db/schema";
import { asc } from "drizzle-orm";

const schema = z.object({
  mode: z.enum([
    "generate_full_post",
    "enhance_post",
    "generate_blog_draft",
    "improve_seo",
    "summarize",
    "suggest_meta",
    "rewrite",
  ]),
  context: z.string().min(1).max(20000),
});

/**
 * Pull existing categories + tags from the DB and inject them into the user
 * context so Claude prefers reusing them over inventing new ones.
 */
async function enrichContextForFullPost(userContext: string): Promise<string> {
  const [cats, allTags] = await Promise.all([
    db.select().from(categories).orderBy(asc(categories.name)),
    db.select().from(tags).orderBy(asc(tags.name)),
  ]);
  const catLines = cats.map((c) => `  - ${c.slug} — ${c.name}`).join("\n") || "  (none yet)";
  const tagLines = allTags.map((t) => `  - ${t.slug} — ${t.name}`).join("\n") || "  (none yet)";
  return `EXISTING_CATEGORIES (prefer reusing one of these slugs):
${catLines}

EXISTING_TAGS (prefer reusing 3-6 of these slugs):
${tagLines}

${userContext}`;
}

export async function POST(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  try {
    const context =
      parsed.data.mode === "generate_full_post"
        ? await enrichContextForFullPost(parsed.data.context)
        : parsed.data.context;
    const text = await runClaudeAssist(parsed.data.mode, context);
    return NextResponse.json({ text });
  } catch (err) {
    console.error("[ai/assist] error", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
