import { readFileSync } from "node:fs";
import { join } from "node:path";
import { db } from "@/db";
import { settings, pages, posts } from "@/db/schema";
import { and, desc, eq, inArray } from "drizzle-orm";
import { getCompanyContact, getSiteBrand } from "@/lib/site-settings";

// Knowledge base — AI + SSG service facts Nemo cites verbatim. Loaded once at
// module init; restart the server to pick up edits.
let KNOWLEDGE_BASE = "";
try {
  KNOWLEDGE_BASE = readFileSync(
    join(process.cwd(), "src/lib/chatbot-knowledge.md"),
    "utf8",
  );
} catch {
  KNOWLEDGE_BASE = "";
}

// Mission + seed lessons file — committed, edited by humans. Dynamic lessons
// learned via reflection live in the DB (see src/lib/nemo-reflect.ts).
let NEMO_MD = "";
try {
  NEMO_MD = readFileSync(join(process.cwd(), "NEMO.md"), "utf8");
} catch {
  NEMO_MD = "";
}

export type FaqEntry = { question: string; answer: string };

export type ChatbotSettings = {
  systemPrompt: string;
  faq: FaqEntry[];
};

// Placeholders are substituted at chat-time with admin-saved company facts.
// Supported tokens: {COMPANY_NAME}, {COMPANY_EMAIL}, {COMPANY_UEN}
export const DEFAULT_SYSTEM_PROMPT = `You are **Nemo**, the AI assistant for {COMPANY_NAME}, a Singapore-based provider of AI-powered LMS, TMS, agentic AI, and SSG-compliance services for training providers.

Company facts:
- We build AI-LMS-TMS, a Learning + Training Management platform that is WSQ and TPQA compliant.
- Services split into two tracks: **AI Services** (LMS, TMS, CMS, HRMS, AI Agent Deployment, Full-Stack AI Solutions) and **SSG Services** (ATO Application, TPQA Consultancy, WSQ Course Development).
- Target audience: training providers, L&D managers, adult-learning centres, and any Singapore organisation deploying production AI.
- Contact: {COMPANY_EMAIL}
- UEN: {COMPANY_UEN}

Funnel discipline (read this twice — this is how you behave):
1. **Always answer the visitor's question first** in 2–4 sentences with concrete facts from the Knowledge Base / FAQ / live CMS content. Never reply with a question before you've given useful information.
2. **Then ask AT MOST ONE light follow-up** — a single conversational question that surfaces a qualification signal. Never bullet-list multiple questions. Never repeat the same question twice in a row — if the visitor pivots, follow them.
3. **Friendly contact-detail invitation.** Once you've given a couple of helpful answers (typically by your second or third reply, or sooner if they mention pricing/quote/timeline/demo), warmly offer to have the team follow up — e.g. *"Happy to keep chatting here, and if it's easier, our person in charge can also reach out with more detail — may I grab your email and a contact number?"* Keep it light, one-line, and never block your answer on it. If they share details, thank them briefly and continue. If they decline or ignore, drop it — don't re-ask in the next turn. Never demand contact info before answering.
4. **Never re-ask a question the visitor declined or ignored.** If they say "don't ask", "skip", or just change topic, drop it gracefully and keep helping. Wait at least 2–3 more turns before a *gentle* second invitation, and only if the conversation has clearly warmed up.

Tone:
- Conversational, warm, concise — a knowledgeable colleague, not a brochure or a form.
- Qualification signals to listen for, in priority order, surfaced naturally one at a time:
  1. **Interest in solution** — which specific service catches their attention.
  2. **Business use-case clarity** — what problem or trigger is driving the conversation.
  3. **Budget intent** — whether they have a budget envelope or want indicative ranges.
  4. **Timeline urgency** — when they need to go live, submit, or audit.
  5. **Implementation interest** — end-to-end delivery vs. co-delivery with their team.
- If the visitor surfaces a signal unprompted, acknowledge it and move on — don't restart the list.
- Never invent facts about specific clients, prices, or SLAs. If unsure, offer to connect them with the team at {COMPANY_EMAIL}.

Use the Knowledge Base and FAQ below as authoritative answers when relevant.`;

const KEY_PROMPT = "chat:system_prompt";
const KEY_FAQ = "chat:faq";

// ─── CMS knowledge snippet ──────────────────────────────────────────────────
// Pulls the latest published pages + posts and renders them as a compact KB
// section so Nemo can reference real on-site content (blogs, service pages)
// without us hand-editing chatbot-knowledge.md every time we publish.

type CmsSnippetCache = { text: string; expires: number };
let cmsSnippet: CmsSnippetCache | null = null;
const CMS_TTL_MS = 5 * 60 * 1000; // 5 min — refresh after publishes

function truncate(s: string | null | undefined, n: number): string {
  const v = (s ?? "").trim().replace(/\s+/g, " ");
  return v.length > n ? `${v.slice(0, n - 1)}…` : v;
}

export async function getCmsKnowledgeSnippet(): Promise<string> {
  if (cmsSnippet && cmsSnippet.expires > Date.now()) return cmsSnippet.text;
  try {
    const [pageRows, postRows] = await Promise.all([
      db
        .select({
          slug: pages.slug,
          title: pages.title,
          excerpt: pages.excerpt,
          seoDescription: pages.seoDescription,
        })
        .from(pages)
        .where(eq(pages.status, "published"))
        .orderBy(desc(pages.updatedAt))
        .limit(40),
      db
        .select({
          slug: posts.slug,
          title: posts.title,
          excerpt: posts.excerpt,
          seoDescription: posts.seoDescription,
          publishedAt: posts.publishedAt,
        })
        .from(posts)
        .where(and(eq(posts.status, "published")))
        .orderBy(desc(posts.publishedAt))
        .limit(20),
    ]);

    const pageLines = pageRows
      .map((p) => {
        const desc = truncate(p.excerpt || p.seoDescription, 180);
        return desc
          ? `- **${p.title}** (/${p.slug}) — ${desc}`
          : `- **${p.title}** (/${p.slug})`;
      })
      .join("\n");
    const postLines = postRows
      .map((p) => {
        const desc = truncate(p.excerpt || p.seoDescription, 180);
        return desc
          ? `- **${p.title}** (/blog/${p.slug}) — ${desc}`
          : `- **${p.title}** (/blog/${p.slug})`;
      })
      .join("\n");

    const sections: string[] = [];
    if (pageLines) sections.push(`### On-site pages\n${pageLines}`);
    if (postLines) sections.push(`### Recent blog posts\n${postLines}`);
    const text = sections.join("\n\n");
    cmsSnippet = { text, expires: Date.now() + CMS_TTL_MS };
    return text;
  } catch {
    cmsSnippet = { text: "", expires: Date.now() + CMS_TTL_MS };
    return "";
  }
}

export async function getChatbotSettings(): Promise<ChatbotSettings> {
  try {
    const rows = await db
      .select()
      .from(settings)
      .where(inArray(settings.key, [KEY_PROMPT, KEY_FAQ]));
    let systemPrompt = DEFAULT_SYSTEM_PROMPT;
    let faq: FaqEntry[] = [];
    for (const r of rows) {
      if (r.key === KEY_PROMPT && typeof r.value === "string" && r.value.trim()) {
        systemPrompt = r.value;
      } else if (r.key === KEY_FAQ && Array.isArray(r.value)) {
        faq = (r.value as FaqEntry[]).filter(
          (e) => e && typeof e.question === "string" && typeof e.answer === "string",
        );
      }
    }
    return { systemPrompt, faq };
  } catch {
    return { systemPrompt: DEFAULT_SYSTEM_PROMPT, faq: [] };
  }
}

export async function saveChatbotSettings(input: ChatbotSettings): Promise<void> {
  const prompt = input.systemPrompt.trim() || DEFAULT_SYSTEM_PROMPT;
  const faq = input.faq
    .map((e) => ({ question: e.question.trim(), answer: e.answer.trim() }))
    .filter((e) => e.question && e.answer);

  await db
    .insert(settings)
    .values({ key: KEY_PROMPT, value: prompt as unknown as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: prompt as unknown as object, updatedAt: new Date() },
    });
  await db
    .insert(settings)
    .values({ key: KEY_FAQ, value: faq as unknown as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: faq as unknown as object, updatedAt: new Date() },
    });
}

export function buildSystemPrompt(
  s: ChatbotSettings,
  learnedLessons: string[] = [],
  cmsSnippetText = "",
): string {
  const parts = [s.systemPrompt];
  if (NEMO_MD.trim()) {
    parts.push(`--- NEMO.MD (mission + seed lessons) ---\n${NEMO_MD.trim()}`);
  }
  if (KNOWLEDGE_BASE.trim()) {
    parts.push(`--- KNOWLEDGE BASE ---\n${KNOWLEDGE_BASE.trim()}`);
  }
  if (cmsSnippetText.trim()) {
    parts.push(
      `--- LIVE CMS CONTENT (pages + recent posts — link to these when relevant) ---\n${cmsSnippetText.trim()}`,
    );
  }
  if (learnedLessons.length) {
    const text = learnedLessons.map((l, i) => `${i + 1}. ${l}`).join("\n");
    parts.push(`--- LEARNED LESSONS (apply these to lift the lead score) ---\n${text}`);
  }
  if (s.faq.length) {
    const faqText = s.faq
      .map((e, i) => `Q${i + 1}: ${e.question}\nA${i + 1}: ${e.answer}`)
      .join("\n\n");
    parts.push(`--- FAQ ---\n${faqText}`);
  }
  return parts.join("\n\n");
}

/**
 * Substitute {COMPANY_NAME} / {COMPANY_EMAIL} / {COMPANY_UEN} placeholders in the
 * chatbot system prompt with admin-saved company settings. Use this at chat-time
 * before passing the prompt to the Claude Agent SDK.
 */
export async function renderSystemPrompt(prompt: string): Promise<string> {
  const [brand, contact] = await Promise.all([getSiteBrand(), getCompanyContact()]);
  return prompt
    .replaceAll("{COMPANY_NAME}", brand.fullName)
    .replaceAll("{COMPANY_EMAIL}", contact.email)
    .replaceAll("{COMPANY_UEN}", brand.uen || "");
}
