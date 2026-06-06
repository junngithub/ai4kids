/**
 * Rewrite post #34 (was "Agentic AI Automation with Flowise") into a client
 * engagement recap: custom n8n training delivered for MSIG staff, on-site,
 * by Dr. Alfred Ang — focused on security and finance automation use cases.
 *
 * Also: changes the slug, writes a 301 from the old slug, and regenerates
 * the branded cover image so it no longer references Flowise.
 */
import { db } from "../src/db";
import { posts, redirects } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { getR2Config } from "../src/lib/r2";
import { renderAndUploadCover } from "../src/lib/post-cover";

const OLD_SLUG = "agentic-ai-automation-with-flowise";
const NEW_SLUG = "custom-n8n-training-for-msig-staff";
const TITLE =
  "Custom n8n Training for MSIG Staff — Security & Finance Automation";
const COURSE_URL =
  "https://www.tertiarycourses.com.sg/wsq-agentic-ai-automation-with-n8n.html";
// Training delivered 11 Nov 2025 — noon SGT so the date is unambiguous in any TZ.
const TRAINING_DATE = new Date("2025-11-11T12:00:00+08:00");

const p = (children: any[]) => ({ type: "paragraph", content: children });
const t = (text: string, marks?: any[]) =>
  marks ? { type: "text", text, marks } : { type: "text", text };
const b = (text: string) => t(text, [{ type: "bold" }]);
const link = (text: string, href: string) =>
  t(text, [{ type: "link", attrs: { href } }]);
const h2 = (text: string) => ({
  type: "heading",
  attrs: { level: 2 },
  content: [t(text)],
});
const ul = (items: any[][]) => ({
  type: "bulletList",
  content: items.map((c) => ({
    type: "listItem",
    content: [p(c)],
  })),
});

const content = {
  type: "doc",
  content: [
    p([
      b("TL;DR — "),
      t(
        "Tertiary Infotech Academy delivered a custom n8n training for MSIG staff, on-site at the MSIG office in Singapore, led by ",
      ),
      b("Dr. Alfred Ang"),
      t(
        " — an n8n specialist who has built many practical n8n automations for clients. The programme was scoped tightly around two themes the MSIG teams cared about: ",
      ),
      b("security"),
      t(" and "),
      b("finance"),
      t(" automation use cases. "),
      link(
        "Explore the WSQ Agentic AI Automation with n8n course →",
        COURSE_URL,
      ),
    ]),

    h2("The engagement"),
    ul([
      [
        b("Date delivered. "),
        t("The training was conducted on "),
        b("11 November 2025"),
        t(", on-site at the MSIG office in Singapore."),
      ],
      [
        b("On-site at MSIG. "),
        t(
          "The session was conducted in person at the MSIG office, so staff worked against their own context rather than generic demos.",
        ),
      ],
      [
        b("Custom, not off-the-shelf. "),
        t(
          "The curriculum was built for MSIG — the workflows, integrations and examples mirrored real internal processes.",
        ),
      ],
      [
        b("Hands-on. "),
        t(
          "Every concept was reinforced by building a working n8n workflow live, not slideware.",
        ),
      ],
    ]),

    h2("Why a custom n8n programme"),
    p([
      t(
        "Off-the-shelf automation courses teach the canvas. They rarely teach how an insurance organisation should wire n8n into systems that hold sensitive policy, claims and financial data. The MSIG programme inverted that — every workflow was a deliberate, governed pattern the team could take straight back to production.",
      ),
    ]),

    h2("Key benefits of n8n"),
    ul([
      [
        b("Self-hostable. "),
        t(
          "Run it inside your own network so sensitive policy, claims and financial data never leaves infrastructure you control.",
        ),
      ],
      [
        b("Fair-code & no per-execution tax. "),
        t(
          "Self-hosted n8n has no per-run metering — high-volume automations stay economical at scale.",
        ),
      ],
      [
        b("400+ native integrations. "),
        t(
          "Connect to the systems an insurer already runs, plus a generic HTTP node for anything without a prebuilt connector.",
        ),
      ],
      [
        b("Code when you need it. "),
        t(
          "Drop into JavaScript or Python in a Code node for custom logic, without leaving the visual flow.",
        ),
      ],
      [
        b("Built-in error handling & retries. "),
        t(
          "Error workflows, retries and execution logs make automations operable and auditable in production.",
        ),
      ],
      [
        b("AI-native. "),
        t(
          "First-class LLM, agent and vector nodes — agentic automation without bolting on a separate framework.",
        ),
      ],
    ]),

    h2("Why n8n over Flowise and Langflow"),
    p([
      t(
        "Flowise and Langflow are visual builders aimed primarily at LLM and RAG prototypes. n8n is a general-purpose automation engine that also does AI — which matters when the goal is governed, production workflows wired into real insurance systems, not a chatbot demo.",
      ),
    ]),
    ul([
      [
        b("Scope. "),
        t(
          "Flowise/Langflow centre on LLM chains and agents; n8n orchestrates the whole process — triggers, approvals, system-to-system integration — with AI as one step among many.",
        ),
      ],
      [
        b("Integrations. "),
        t(
          "n8n ships 400+ app connectors out of the box; Flowise and Langflow lean on custom or HTTP calls for most non-LLM systems.",
        ),
      ],
      [
        b("Operations. "),
        t(
          "n8n provides execution history, retries, error workflows and credential management built for running unattended; the LLM-builder tools are lighter on production operability.",
        ),
      ],
      [
        b("Governance & data residency. "),
        t(
          "Self-hosted n8n keeps automation and data within MSIG's boundary — the deciding factor for security and finance workloads.",
        ),
      ],
      [
        b("Cost at scale. "),
        t(
          "No per-execution metering on self-hosted n8n, so reconciliation and reporting jobs that run constantly stay cheap.",
        ),
      ],
    ]),
    p([
      t(
        "Flowise and Langflow remain fine choices for fast LLM prototyping — but for the security and finance automation MSIG needed in production, n8n was the right backbone.",
      ),
    ]),

    h2("Security automation use cases"),
    ul([
      [
        b("Credential hygiene. "),
        t(
          "Storing API keys and tokens in n8n credentials rather than hard-coded nodes, and scoping access per workflow.",
        ),
      ],
      [
        b("Audit trails. "),
        t(
          "Capturing who triggered what, when, and with which payload — so an automation run is reconstructable after the fact.",
        ),
      ],
      [
        b("Webhook hardening. "),
        t(
          "Signature verification, allow-listing and rate-limiting on inbound webhooks before they touch internal systems.",
        ),
      ],
      [
        b("Self-hosted control. "),
        t(
          "Running n8n in an environment MSIG controls, keeping data residency and network boundaries intact.",
        ),
      ],
    ]),

    h2("Finance automation use cases"),
    ul([
      [
        b("Reconciliation. "),
        t(
          "Matching transactions across sources and flagging exceptions for human review instead of manual spreadsheet work.",
        ),
      ],
      [
        b("Report assembly. "),
        t(
          "Pulling figures from multiple systems on a schedule and composing them into a consistent finance report.",
        ),
      ],
      [
        b("Approval routing. "),
        t(
          "Conditional workflows that route finance approvals to the right owner with full status visibility.",
        ),
      ],
      [
        b("Alerting. "),
        t(
          "Threshold-based notifications so anomalies surface in minutes rather than at month-end.",
        ),
      ],
    ]),

    h2("About the trainer"),
    p([
      b("Dr. Alfred Ang"),
      t(
        " is an n8n specialist who has designed and shipped many practical n8n solutions for clients across security, finance and operations. He runs the WSQ-aligned ",
      ),
      link("Agentic AI Automation with n8n", COURSE_URL),
      t(
        " course and tailors private, on-site programmes to an organisation's own systems and risk posture.",
      ),
    ]),

    h2("Bring this to your team"),
    p([
      t(
        "If your team needs n8n training built around your own security and finance workflows — not generic examples — we can scope a custom on-site programme like the one delivered for MSIG. Start with the public ",
      ),
      link("WSQ Agentic AI Automation with n8n course", COURSE_URL),
      t(", or "),
      link(
        "talk to us about a custom programme",
        "/contact?source=blog-n8n-msig",
      ),
      t("."),
    ]),
  ],
};

(async () => {
  const r2 = await getR2Config();
  let featuredImage: string | undefined;
  if (r2) {
    const { url } = await renderAndUploadCover(
      r2,
      TITLE,
      NEW_SLUG,
      "Client Engagement",
    );
    featuredImage = url;
    console.log("New cover:", url);
  } else {
    console.log("R2 not configured — keeping existing featured image.");
  }

  await db
    .update(posts)
    .set({
      slug: NEW_SLUG,
      title: TITLE,
      excerpt:
        "How Tertiary Infotech Academy delivered a custom, on-site n8n training for MSIG staff — led by n8n specialist Dr. Alfred Ang, focused on security and finance automation use cases.",
      content,
      seoTitle:
        "Custom n8n Training for MSIG Staff | Tertiary Infotech Academy",
      seoDescription:
        "A custom on-site n8n training delivered for MSIG staff by Dr. Alfred Ang — security and finance automation use cases, WSQ Agentic AI Automation with n8n.",
      ...(featuredImage ? { featuredImage } : {}),
      publishedAt: TRAINING_DATE,
      createdAt: TRAINING_DATE,
      updatedAt: new Date(),
    })
    .where(eq(posts.id, 34));

  // Preserve the old URL with a 301.
  const from = `/blog/${OLD_SLUG}`;
  const to = `/blog/${NEW_SLUG}`;
  const existing = await db
    .select()
    .from(redirects)
    .where(eq(redirects.fromPath, from));
  if (existing.length === 0) {
    await db.insert(redirects).values({ fromPath: from, toPath: to, statusCode: 301 });
    console.log("301 added:", from, "->", to);
  } else {
    await db
      .update(redirects)
      .set({ toPath: to, statusCode: 301 })
      .where(eq(redirects.fromPath, from));
    console.log("301 updated:", from, "->", to);
  }

  console.log("Post #34 rewritten. New URL: /blog/" + NEW_SLUG);
  process.exit(0);
})();
