import { db } from "../src/db";
import { posts, postTags } from "../src/db/schema";
import { renderTipTapHtml } from "../src/lib/tiptap-html";
import { eq, and } from "drizzle-orm";

const COURSE = "https://www.tertiarycourses.com.sg/wsq-agentic-ai-automation-with-n8n.html";

const p = (text: string, marks?: any[]) =>
  ({ type: "paragraph", content: [{ type: "text", text, ...(marks ? { marks } : {}) }] });

const rich = (parts: any[]) => ({ type: "paragraph", content: parts });
const t = (text: string, marks?: any[]) => ({ type: "text", text, ...(marks ? { marks } : {}) });
const link = (href: string, ext = false) =>
  ({ type: "link", attrs: { href, ...(ext ? { target: "_blank" } : {}) } });
const bold = { type: "bold" };
const h = (level: number, text: string) =>
  ({ type: "heading", attrs: { level }, content: [{ type: "text", text }] });
const ul = (items: string[]) => ({
  type: "bulletList",
  content: items.map((i) => ({
    type: "listItem",
    content: [{ type: "paragraph", content: [{ type: "text", text: i }] }],
  })),
});

const doc = {
  type: "doc",
  content: [
    rich([
      t("TL;DR — ", [bold]),
      t(
        "In December 2025 Tertiary Infotech Academy ran a one-day on-site n8n workshop for 40 NTU staff — mostly developers — covering n8n fundamentals, AI agents, guardrails, security and webhooks. n8n has become an industry-standard automation layer because it is open-source, self-hostable and pairs visual workflows with real AI agents. ",
      ),
      t("Run this workshop for your team →", [bold, link("/contact?source=blog-n8n-ntu-top")]),
    ]),

    h(2, "The engagement: a one-day n8n workshop for NTU"),
    p(
      "On 18 December 2025, Tertiary Infotech Academy delivered a full-day, on-site n8n workshop to 40 staff from Nanyang Technological University (NTU). The cohort was predominantly developers, so we ran the day hands-on rather than slide-heavy — every participant built and debugged live workflows on their own n8n instance.",
    ),
    ul([
      "Format: one full day, on-site, instructor-led with live builds.",
      "Cohort: 40 NTU staff, mostly software developers and technical engineers.",
      "Outcome: every participant shipped a working agentic workflow by end of day.",
      "Stack: self-hosted n8n + LLM agent nodes + webhook triggers.",
    ]),

    h(2, "What we covered"),
    { type: "orderedList", content: [
      { type: "listItem", content: [p("n8n fundamentals."), p("Nodes, the execution model, data shape between steps, expressions, and visual debugging of every payload.")] },
      { type: "listItem", content: [p("AI agents in n8n."), p("Wiring LLM and agent nodes, tool calling, memory, and orchestrating multi-step reasoning inside a deterministic workflow.")] },
      { type: "listItem", content: [p("Guardrails."), p("Validating model output against a schema, human-in-the-loop approval steps, retries, and safe fallbacks when an agent goes off-track.")] },
      { type: "listItem", content: [p("Security."), p("Credential handling, secrets isolation, scoping connector permissions, and keeping data inside NTU's own infrastructure on a self-hosted instance.")] },
      { type: "listItem", content: [p("Webhooks in n8n."), p("Inbound webhook triggers, signature verification, request/response patterns, and exposing a workflow as an API endpoint other systems can call.")] },
    ] },

    h(2, "Why n8n is widely used in the industry"),
    p(
      "n8n keeps showing up in production automation stacks for a few concrete reasons:",
    ),
    ul([
      "Open-source and self-hostable — no vendor lock-in and no data-residency drama, which matters for universities and enterprises.",
      "400+ prebuilt connectors (Gmail, Slack, Notion, HTTP, databases, CRMs) so most integrations are wiring, not coding.",
      "First-class AI agent and LLM nodes — you can drop reasoning into an otherwise deterministic pipeline.",
      "Visual debugging — every step's input and output is inspectable, which is what makes the automations sustainable to operate.",
      "Code when you need it — JavaScript/Python function nodes for the 10% the no-code path can't express.",
    ]),

    h(2, "Why this format works for developer teams"),
    p(
      "Developers do not need a tool tour — they need to know where the edges are. So the NTU day was built around failure modes: what happens when an agent hallucinates a tool argument, how to verify a webhook signature, how to keep credentials out of logs, and how to make a workflow idempotent. By covering guardrails and security alongside the happy path, the team left able to put n8n into production rather than just demo it.",
    ),

    h(2, "FAQ"),
    h(3, "Can you run this for our organisation?"),
    rich([
      t("Yes. This was a customised corporate workshop. We scope the agenda to your stack and run it on-site or virtually. "),
      t("Talk to us about corporate training →", [link("/contact?source=blog-n8n-ntu-faq")]),
    ]),
    h(3, "Is there a public, SSG-funded version?"),
    rich([
      t("Yes — the "),
      t("WSQ Agentic AI Automation with n8n", [link(COURSE, true)]),
      t(
        " course at Tertiary Courses Singapore is the public, fundable on-ramp covering the same core material.",
      ),
    ]),
    h(3, "Do participants need prior n8n experience?"),
    p(
      "No. We start from fundamentals and ramp quickly — a developer audience typically reaches the agent and webhook material by mid-morning.",
    ),

    h(2, "Run an n8n workshop for your team"),
    rich([
      t(
        "Tertiary Infotech Academy delivers customised n8n and agentic AI workshops for Singapore organisations. Explore the public ",
      ),
      t("WSQ Agentic AI Automation with n8n", [link(COURSE, true)]),
      t(" course, or "),
      t("book a corporate training scoping call →", [bold, link("/contact?source=blog-n8n-ntu-foot")]),
      t("."),
    ]),
  ],
};

async function main() {
  const html = renderTipTapHtml(doc as any);

  await db
    .update(posts)
    .set({
      title: "n8n Workshop for NTU: A One-Day Agentic AI Automation Training for 40 Developers",
      excerpt:
        "In December 2025 Tertiary Infotech Academy delivered a one-day n8n workshop to 40 NTU staff — mostly developers — covering AI agents, guardrails, security and webhooks, and why n8n is now an industry-standard automation layer.",
      seoTitle:
        "n8n Workshop for NTU — One-Day Agentic AI Automation Training | Tertiary Infotech Academy",
      seoDescription:
        "How Tertiary Infotech Academy ran a one-day n8n workshop for 40 NTU developers in December 2025 — n8n, AI agents, guardrails, security and webhooks — and why n8n is widely used in industry.",
      content: doc as any,
      contentHtml: html,
      publishedAt: new Date("2025-12-18T02:00:00.000Z"),
      updatedAt: new Date(),
    })
    .where(eq(posts.slug, "agentic-ai-automation-with-n8n"));

  // Add "Corporate Training" tag (id 6) if not already linked
  const existing = await db
    .select()
    .from(postTags)
    .where(and(eq(postTags.postId, 32), eq(postTags.tagId, 6)));
  if (existing.length === 0) {
    await db.insert(postTags).values({ postId: 32, tagId: 6 });
  }

  console.log("Updated post 32. HTML length:", html.length);
}

main().then(() => process.exit(0));
