/**
 * Post #34 — rebuild the *rendered* article (contentHtml) as an n8n-centric
 * piece, reusing the strong structure + internal links of the original
 * production Flowise guide (recovered from the live page). Also keeps the
 * ProseMirror `content` in sync via htmlToTipTap, sets the 11 Nov 2025
 * training date, refreshes SEO fields, and removes the stale Flowise /
 * LangChain tags + keywords.
 *
 * Why this script and not update-n8n-msig-post.ts: the blog renders
 * `post.contentHtml`, which that earlier script never touched. This one
 * targets the field that actually shows on the page.
 */
import { db } from "../src/db";
import { posts, postTags } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { htmlToTipTap } from "../src/lib/tiptap-from-html";

const TRAINING_DATE = new Date("2025-11-11T12:00:00+08:00");
const COURSE_URL =
  "https://www.tertiarycourses.com.sg/wsq-agentic-ai-automation-with-n8n.html";

const FLOWISE_TAG_ID = 116;
const LANGCHAIN_TAG_ID = 114;
const N8N_TAG_ID = 111;
const CORPORATE_TRAINING_TAG_ID = 6;

const TITLE =
  "Custom n8n Training for MSIG Staff — Security & Finance Automation";

const contentHtml = `<p><strong>TL;DR —</strong> Tertiary Infotech Academy delivered a custom <strong>n8n</strong> training for <strong>MSIG</strong> staff on <strong>11 November 2025</strong>, on-site at the MSIG office in Singapore, led by <strong>Dr. Alfred Ang</strong>. The programme was scoped tightly around two themes the MSIG teams cared about — <strong>security</strong> and <strong>finance</strong> automation — using their own systems rather than generic demos. <a href="/contact?source=blog-n8n-msig" title="Scope a custom n8n training — book a consultation with Tertiary Infotech Academy">Scope a custom n8n training →</a></p>

<h2>Key benefits of n8n</h2>
<ul>
  <li><strong>Self-hostable</strong> on a Singapore VPS — sensitive policy, claims and financial data never leaves infrastructure MSIG controls.</li>
  <li><strong>Fair-code, no per-execution tax</strong> — self-hosted n8n has no per-run metering, so high-volume reconciliation and reporting jobs stay economical.</li>
  <li><strong>400+ native integrations</strong> plus a generic HTTP node for anything without a prebuilt connector.</li>
  <li><strong>Code when you need it</strong> — drop into JavaScript or Python in a Code node without leaving the visual flow.</li>
  <li><strong>Built-in error handling</strong> — retries, error workflows and execution logs make automations operable and auditable in production.</li>
  <li><strong>AI-native</strong> — first-class LLM, agent and vector nodes, so agentic automation needs no separate framework bolted on.</li>
</ul>

<h2>What we delivered for MSIG</h2>
<p>The session was conducted in person at the MSIG office on 11 November 2025, so staff worked against their own context. Every concept was reinforced by building a working n8n workflow live, not slideware.</p>
<ol>
  <li><strong>Security automation.</strong> Credential hygiene, audit trails, webhook hardening and self-hosted control — automations wired into internal systems with governance intact.</li>
  <li><strong>Finance automation.</strong> Reconciliation, scheduled report assembly, conditional approval routing and threshold alerting — replacing manual spreadsheet work.</li>
  <li><strong>Curriculum mapped to real work.</strong> We covered the WSQ skills-mapping context in the <a href="/blog/why-skills-mapping-is-becoming-essential-for-training-providers-in-2025" title="skills mapping post — Why Skills Mapping Is Becoming Essential For Training Providers In 2025 — Tertiary Infotech Academy blog">skills mapping post</a>.</li>
</ol>

<h2>Why n8n over Flowise and Langflow</h2>
<p>Flowise and Langflow are visual builders aimed mainly at LLM and RAG prototypes. n8n is a general-purpose automation engine that also does AI — which is what matters when the goal is governed, production workflows wired into real insurance systems, not a chatbot demo.</p>
<table>
  <thead>
    <tr><th>Dimension</th><th>n8n</th><th>Flowise</th><th>Langflow</th></tr>
  </thead>
  <tbody>
    <tr><td>Best at</td><td>Production workflows with LLM steps</td><td>Agents exposed as APIs</td><td>Prompt-chain / RAG prototypes</td></tr>
    <tr><td>Integrations</td><td>400+ native connectors out of the box</td><td>Mostly custom / HTTP</td><td>Mostly custom / HTTP</td></tr>
    <tr><td>Production operability</td><td>Retries, error workflows, execution history</td><td>Lighter</td><td>Lighter</td></tr>
    <tr><td>Governance &amp; data residency</td><td>Self-hosted, full control</td><td>Self-hostable</td><td>Self-hostable</td></tr>
    <tr><td>Cost at scale</td><td>No per-execution metering</td><td>Varies</td><td>Varies</td></tr>
  </tbody>
</table>
<p>Flowise and Langflow remain fine for fast LLM prototyping — but for the security and finance automation MSIG needed in production, n8n was the right backbone. For broader context, see our <a href="/blog/openclaw-vs-hermes-vs-paperclip-ai-agent-comparison" title="agent stack comparison — OpenClaw Vs Hermes Vs Paperclip AI Agent Comparison — Tertiary Infotech Academy blog">agent stack comparison</a> for the production-grade agent layer that sits above any of these builders.</p>

<h2>FAQ</h2>

<h3>Why n8n instead of Flowise or Langflow for an insurer?</h3>
<p>Insurance automation is rarely "just an LLM call" — it is triggers, approvals and system-to-system integration with strict data residency. n8n orchestrates the whole process with AI as one step among many, self-hosted inside MSIG's boundary.</p>

<h3>What should the team learn?</h3>
<p>The <a href="${COURSE_URL}" target="_blank" rel="noopener noreferrer" title="WSQ Agentic AI Automation with n8n — Tertiary Courses Singapore">WSQ Agentic AI Automation with n8n course</a> at Tertiary Courses Singapore covers this stack, plus the broader <a href="https://www.tertiarycourses.com.sg/ai-courses-singapore.html" target="_blank" rel="noopener noreferrer" title="AI Courses Singapore — Tertiary Courses Singapore">AI courses</a>.</p>

<h2>What to do next</h2>
<ol>
  <li><strong>Define one workflow.</strong> One job, one data source, one output.</li>
  <li><strong>Book a call.</strong> <a href="/contact?source=blog-n8n-call" title="Book a call — book a consultation with Tertiary Infotech Academy">Book a call →</a></li>
  <li><strong>Scope a custom programme.</strong> <a href="/contact?source=blog-n8n-quote" title="Request a quote — book a consultation with Tertiary Infotech Academy">Request a quote →</a></li>
</ol>

<p><em>Tertiary Infotech Academy delivers custom n8n training and builds n8n automations for Singapore teams — see our <a href="/ai-agent-deployment?source=blog-n8n-foot" title="AI agent deployment, Tertiary Infotech Academy">AI agent deployment</a> service.</em></p>`;

(async () => {
  const content = htmlToTipTap(contentHtml) as unknown as object;

  await db
    .update(posts)
    .set({
      title: TITLE,
      contentHtml,
      content,
      excerpt:
        "Tertiary Infotech Academy delivered a custom on-site n8n training for MSIG staff on 11 Nov 2025 — led by Dr. Alfred Ang, focused on security and finance automation, plus why n8n beats Flowise and Langflow for production.",
      seoTitle: "Custom n8n Training for MSIG Staff | Tertiary Infotech Academy",
      seoDescription:
        "A custom on-site n8n training delivered for MSIG staff on 11 Nov 2025 by Dr. Alfred Ang — security and finance automation, key n8n benefits, and why n8n beats Flowise and Langflow.",
      seoKeywords:
        "n8n training Singapore, n8n automation, agentic AI automation, n8n vs Flowise, n8n vs Langflow, workflow automation Singapore",
      publishedAt: TRAINING_DATE,
      createdAt: TRAINING_DATE,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, 34));

  // Drop stale Flowise + LangChain tag chips.
  await db
    .delete(postTags)
    .where(
      and(eq(postTags.postId, 34), eq(postTags.tagId, FLOWISE_TAG_ID)),
    );
  await db
    .delete(postTags)
    .where(
      and(eq(postTags.postId, 34), eq(postTags.tagId, LANGCHAIN_TAG_ID)),
    );

  // Ensure the n8n tag is attached.
  const existing = await db
    .select()
    .from(postTags)
    .where(and(eq(postTags.postId, 34), eq(postTags.tagId, N8N_TAG_ID)));
  if (existing.length === 0) {
    await db.insert(postTags).values({ postId: 34, tagId: N8N_TAG_ID });
  }

  // Ensure the Corporate Training tag is attached.
  const ctExisting = await db
    .select()
    .from(postTags)
    .where(
      and(
        eq(postTags.postId, 34),
        eq(postTags.tagId, CORPORATE_TRAINING_TAG_ID),
      ),
    );
  if (ctExisting.length === 0) {
    await db
      .insert(postTags)
      .values({ postId: 34, tagId: CORPORATE_TRAINING_TAG_ID });
  }

  console.log("Post #34 rewritten (contentHtml + content + SEO + tags).");
  process.exit(0);
})();
