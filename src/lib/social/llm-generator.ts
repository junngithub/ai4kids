/**
 * LLM-driven LinkedIn + Facebook post copy generation.
 * Uses the Claude Agent SDK (OAuth subscription) via the shared wrapper —
 * NEVER a direct Anthropic Messages API call (see HARD POLICY in CLAUDE.md).
 *
 * Falls back to the deterministic generator if the SDK is unavailable
 * (token missing, network error) so blog publishing is never blocked.
 */

import { runClaudeWithSystemPrompt } from "@/lib/ai/claude";

const LINKEDIN_SYSTEM = `You are an expert LinkedIn ghost-writer for Dr. Alfred Ang at Tertiary Infotech Academy (Singapore). Your job is to turn a blog post into a high-engagement LinkedIn post that reads like a senior practitioner sharing a practical insight — never like a press release.

OUTPUT RULES — follow exactly:
- Plain text only. NO markdown (no **bold**, no ##, no bullet symbols other than ✅ or ➡).
- Length: 1500–2500 characters total. Hard ceiling 2900 (LinkedIn cuts at 3000).
- Structure:
  1. Hook line — one short sentence with a leading emoji (🚀 / 🎯 / ⚡ / 🤖 / 📊 — pick what fits). Must make the reader want to keep reading.
  2. Blank line.
  3. 2–3 short paragraphs setting up the problem and what the post covers. Single-sentence paragraphs are fine. White space matters.
  4. Blank line, then a transition line like "Here's what's inside:" or "What we cover:" or "The 5-stage breakdown:"
  5. 4–6 ✅ bullets summarising the key takeaways (one line each, lead with a noun/verb, no full stops at end).
  6. Blank line.
  7. One sentence framing the business value or "so what" for Singapore L&D / training / AI-deployment audiences.
  8. Blank line.
  9. CTA line: "🔗 Read the full breakdown → <URL>"
  10. Blank line.
  11. Hashtag line: 6–10 hashtags, PascalCase, mix of broad (#AI #ML) + niche (#HermesAgent #ClaudeCode) + brand (#TertiaryInfotechAcademy #Singapore).

TONE RULES:
- Editorial and practical. Never "Discover how", "Unlock", "Industry-leading", "Revolutionary", "Cutting-edge", "Game-changer".
- British / Singapore English spelling (organisation, utilise, programme).
- Lead with the reader's problem, not the company.
- No em-dash-followed-by-soft-rephrase tic.
- Avoid corporate filler ("in conclusion", "let's dive in", "in today's fast-paced world").

OUTPUT FORMAT:
Return ONLY the post body — no preamble, no quotation marks, no "Here's your LinkedIn post:" wrapper. The very first character should be the leading emoji of the hook line.`;

const FACEBOOK_SYSTEM = `You are writing a Facebook Page post for Tertiary Infotech Academy (Singapore). The blog post will be provided. Turn it into a concise Facebook post.

OUTPUT RULES:
- Plain text only.
- Length: 300–600 characters total.
- Structure:
  1. Hook sentence with a leading emoji.
  2. 1–2 sentence summary of the key insight.
  3. Blank line, then the URL on its own line.
  4. Blank line, then 2–3 hashtags (PascalCase).
- Tone: editorial, practical. No marketing hype.
- British / Singapore English spelling.

Return ONLY the post body — no preamble, no quotation marks. Start with the leading emoji.`;

type GenInput = {
  title: string;
  excerpt: string;
  bodyPlainText: string;
  url: string;
  tagSlugs: string[];
};

function buildUserContext(input: GenInput, platform: "LinkedIn" | "Facebook"): string {
  const tagLine = input.tagSlugs.length > 0 ? input.tagSlugs.join(", ") : "(no tags)";
  // Clip the body to keep the prompt small but representative.
  const body = input.bodyPlainText.slice(0, 6000);
  return `Generate a ${platform} post for this blog article.

BLOG_TITLE: ${input.title}

BLOG_URL: ${input.url}

BLOG_EXCERPT: ${input.excerpt}

BLOG_TAGS (use as hashtag inspiration): ${tagLine}

BLOG_BODY (plain-text, may be truncated):
${body}`;
}

export async function generateLinkedInPostLLM(input: GenInput): Promise<string | null> {
  try {
    const out = await runClaudeWithSystemPrompt(
      LINKEDIN_SYSTEM,
      buildUserContext(input, "LinkedIn"),
      "social-linkedin",
    );
    const cleaned = out.trim();
    if (cleaned.length < 200) return null; // suspiciously short — fall back
    return cleaned;
  } catch (e) {
    console.warn("[social/llm] LinkedIn generation failed, falling back:", e);
    return null;
  }
}

export async function generateFacebookPostLLM(input: GenInput): Promise<string | null> {
  try {
    const out = await runClaudeWithSystemPrompt(
      FACEBOOK_SYSTEM,
      buildUserContext(input, "Facebook"),
      "social-facebook",
    );
    const cleaned = out.trim();
    if (cleaned.length < 100) return null;
    return cleaned;
  } catch (e) {
    console.warn("[social/llm] Facebook generation failed, falling back:", e);
    return null;
  }
}
