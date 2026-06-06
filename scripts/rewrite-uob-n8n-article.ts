/**
 * Post #33 — rebuild the Langflow guide into an n8n-centric piece on the
 * custom 2-day n8n training delivered for UOB staff (7 staff) by
 * Dr. Alfred Ang on 23 Jul 2025. Keeps `content` (ProseMirror) in sync via
 * htmlToTipTap, sets the 23 Jul 2025 training timestamp, refreshes SEO, and
 * swaps the stale Langflow / LangChain / visual-builder tags for n8n.
 *
 * The blog renders `post.contentHtml`, so that is the field this targets.
 */
import { db } from "../src/db";
import { posts, postTags } from "../src/db/schema";
import { eq, and } from "drizzle-orm";
import { htmlToTipTap } from "../src/lib/tiptap-from-html";

const POST_ID = 33;
const TRAINING_DATE = new Date("2025-07-23T12:00:00+08:00");
const COURSE_URL =
  "https://www.tertiarycourses.com.sg/wsq-agentic-ai-automation-with-n8n.html";

const LANGFLOW_TAG_ID = 113;
const LANGCHAIN_TAG_ID = 114;
const VISUAL_BUILDER_TAG_ID = 115;
const N8N_TAG_ID = 111;

const TITLE =
  "Custom n8n Training for UOB Staff — Banking Workflow Automation";

const contentHtml = `<p><strong>TL;DR —</strong> Tertiary Infotech Academy delivered a <strong>two-day customised n8n training</strong> for <strong>7 UOB staff</strong> on <strong>23 July 2025</strong>, led by <strong>Dr. Alfred Ang</strong>. The programme was scoped tightly around banking workflow automation — built against UOB's own use cases rather than generic demos. <a href="/contact?source=blog-n8n-uob" title="Scope a custom n8n training — book a consultation with Tertiary Infotech Academy">Scope a custom n8n training →</a></p>

<h2>Key benefits of n8n</h2>
<ul>
  <li><strong>Self-hostable</strong> on infrastructure the bank controls — sensitive customer, transaction and KYC data never leaves the boundary.</li>
  <li><strong>Fair-code, no per-execution tax</strong> — self-hosted n8n has no per-run metering, so high-volume reconciliation and reporting jobs stay economical at bank scale.</li>
  <li><strong>400+ native integrations</strong> plus a generic HTTP node for any internal or vendor system without a prebuilt connector.</li>
  <li><strong>Code when you need it</strong> — drop into JavaScript or Python in a Code node without leaving the visual flow.</li>
  <li><strong>Built-in error handling</strong> — retries, error workflows and execution logs make automations operable and auditable in production.</li>
  <li><strong>AI-native</strong> — first-class LLM, agent and vector nodes, so agentic automation needs no separate framework bolted on.</li>
</ul>

<h2>Why n8n is useful for the banking industry</h2>
<p>Banking automation is rarely "just an LLM call" — it is triggers, approval chains and system-to-system integration under strict data-residency and audit requirements. n8n fits that reality:</p>
<ul>
  <li><strong>Data residency &amp; governance.</strong> Self-hosted inside the bank's network, so regulated data (MAS TRM, PDPA) stays in environments the bank governs — no third-party SaaS processing customer records.</li>
  <li><strong>Auditability.</strong> Every execution is logged with inputs, outputs and errors — the evidence trail internal audit and compliance expect.</li>
  <li><strong>Reconciliation &amp; reporting.</strong> Scheduled jobs that pull from core systems, reconcile ledgers and assemble regulatory reports without manual spreadsheet handling.</li>
  <li><strong>Conditional approval routing.</strong> Threshold-based escalation and maker-checker style approval flows modelled directly in the workflow.</li>
  <li><strong>Cost at scale.</strong> No per-execution metering, so high-volume back-office automation does not become a runaway line item.</li>
  <li><strong>AI where it adds value.</strong> Document extraction, summarisation and triage as one governed step inside a larger process — not an ungoverned chatbot.</li>
</ul>

<h2>What we delivered for UOB</h2>
<p>The session ran over two full days, with 7 UOB staff, conducted by Dr. Alfred Ang on 23 July 2025. Every concept was reinforced by building a working n8n workflow live, not slideware.</p>
<ol>
  <li><strong>n8n foundations.</strong> Self-hosting, credentials, triggers, the HTTP node and the Code node — the building blocks of governed automation.</li>
  <li><strong>Banking workflow automation.</strong> Reconciliation, scheduled report assembly, conditional approval routing and threshold alerting — replacing manual back-office work.</li>
  <li><strong>Agentic AI steps.</strong> Adding LLM and agent nodes for document extraction and triage as a controlled step within a larger workflow.</li>
  <li><strong>Operability.</strong> Error workflows, retries and execution history so automations are auditable and supportable in production.</li>
</ol>

<h2>n8n vs Flowise vs Langflow</h2>
<p>Flowise and Langflow are visual builders aimed mainly at LLM and RAG prototypes. n8n is a general-purpose automation engine that also does AI — which is what matters when the goal is governed, production workflows wired into real banking systems, not a chatbot demo.</p>
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
<p>Flowise and Langflow remain fine for fast LLM prototyping — but for the banking workflow automation UOB needed in production, n8n was the right backbone. For broader context, see our <a href="/blog/openclaw-vs-hermes-vs-paperclip-ai-agent-comparison" title="agent stack comparison — OpenClaw Vs Hermes Vs Paperclip AI Agent Comparison — Tertiary Infotech Academy blog">agent stack comparison</a> for the production-grade agent layer that sits above any of these builders.</p>

<h2>FAQ</h2>

<h3>Why n8n instead of Flowise or Langflow for a bank?</h3>
<p>Banking automation is rarely "just an LLM call" — it is triggers, approvals and system-to-system integration with strict data residency. n8n orchestrates the whole process with AI as one step among many, self-hosted inside the bank's boundary.</p>

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
        "Tertiary Infotech Academy delivered a two-day customised n8n training for 7 UOB staff on 23 Jul 2025 — led by Dr. Alfred Ang, focused on banking workflow automation, plus why n8n is useful for the banking industry.",
      seoTitle: "Custom n8n Training for UOB Staff | Tertiary Infotech Academy",
      seoDescription:
        "A two-day customised n8n training delivered for 7 UOB staff on 23 Jul 2025 by Dr. Alfred Ang — banking workflow automation, why n8n suits the banking industry, and n8n vs Flowise vs Langflow.",
      seoKeywords:
        "n8n training Singapore, n8n banking automation, agentic AI automation, n8n vs Flowise, n8n vs Langflow, workflow automation banking",
      publishedAt: TRAINING_DATE,
      createdAt: TRAINING_DATE,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, POST_ID));

  // Drop stale Langflow / LangChain / visual-builder tag chips.
  for (const tagId of [LANGFLOW_TAG_ID, LANGCHAIN_TAG_ID, VISUAL_BUILDER_TAG_ID]) {
    await db
      .delete(postTags)
      .where(and(eq(postTags.postId, POST_ID), eq(postTags.tagId, tagId)));
  }

  // Ensure the n8n tag is attached.
  const existing = await db
    .select()
    .from(postTags)
    .where(and(eq(postTags.postId, POST_ID), eq(postTags.tagId, N8N_TAG_ID)));
  if (existing.length === 0) {
    await db.insert(postTags).values({ postId: POST_ID, tagId: N8N_TAG_ID });
  }

  console.log("Post #33 rewritten (contentHtml + content + SEO + tags).");
  process.exit(0);
})();
