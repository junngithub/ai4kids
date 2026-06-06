// Content + metadata for the 5 dedicated service pages.
// Pages compose this with components/sections/ServicePageTemplate.
//
// Admin can override any of these fields per slug via the `settings` table
// using the key `service_page:<slug>` (JSONB). See getServicePageOverride() in
// site-settings.ts; defaults in this file are the fallback.

export type TimelineStep = {
  /** Short title, e.g. "Discovery", "Quotation". */
  title: string;
  /** Optional duration / status chip (e.g. "Week 0 · free"). */
  duration?: string;
  /** Body copy describing the step. */
  body: string;
  /** Tailwind accent color used for icon/ring/chip. */
  accent?: "cyan" | "blue" | "purple" | "amber" | "green";
};

export type ServicePageContent = {
  slug: string;
  title: string;
  hero: {
    kicker: string;
    /** HTML allowed for accent spans. */
    headlineHtml: string;
    subhead: string;
  };
  meta: {
    title: string;
    description: string;
  };
  /** "Service type" used in Schema.org Service @type. */
  serviceType: string;
  /** Short intro above the timeline section. */
  processIntro?: string;
  /** Process / journey steps with optional visual timeline rendering. */
  timeline?: TimelineStep[];
  benefits: { title: string; body: string }[];
  whatsIncluded: string[];
  faq: { q: string; a: string }[];
  /** Source label sent with the lead form POST. */
  leadSource: string;
};

export const SERVICE_PAGES: Record<string, ServicePageContent> = {
  "training-management-system": {
    slug: "training-management-system",
    title: "Training Management System (TMS)",
    leadSource: "tms-page",
    serviceType: "Training Management System",
    processIntro:
      "From discovery through go-live and SSG integration — predictable, fixed-fee delivery.",
    timeline: [
      { title: "Discovery", duration: "Week 0 · free", accent: "cyan", body: "30-min call. We map your training programs, SSG / TPGateway state, billing flows, and integration points." },
      { title: "Demo & Scoping", duration: "Week 1", accent: "blue", body: "Live TMS walkthrough on your domain with sample data. We agree the integration scope (TPGateway, SSO, accounting)." },
      { title: "Quotation", duration: "Week 2", accent: "purple", body: "Fixed-fee proposal with timeline guarantees. No surprises." },
      { title: "Build & Migrate", duration: "Weeks 3–8", accent: "amber", body: "Deployment on your domain, brand assets applied, SSG / TPGateway integration, data migration from your existing tools." },
      { title: "Go Live", duration: "Week 8+", accent: "green", body: "Hand-off, admin training, runbook, 30-day post-launch support. You own your data and deployment." },
    ],
    hero: {
      kicker: "[ TMS · WSQ · SSG-READY ]",
      headlineHtml:
        '<span class="gradient-text">Training Management System</span> for Singapore training providers.',
      subhead:
        "Streamline your entire training lifecycle — scheduling, enrollment, attendance, e-certificates, SkillsFuture funding claims — in one platform built for WSQ-compliant ATOs.",
    },
    meta: {
      title: "Training Management System (TMS) Singapore — WSQ & SSG-Ready",
      description:
        "End-to-end TMS for Singapore training providers. Course scheduling, enrollment workflows, attendance, e-cert issuance and SSG funding-claim integration. Book a free demo.",
    },
    benefits: [
      {
        title: "Self-hosted on your domain",
        body: "Your TMS, your data, your branding. Deployed to your own infrastructure (Coolify, AWS, Vercel, on-prem) — no SaaS lock-in, no per-seat fees, no vendor exit risk.",
      },
      {
        title: "SSG / TPGateway integration",
        body: "Submit course runs, claim funding and report attendance directly via the TPGateway API — no manual CSV uploads.",
      },
      {
        title: "End-to-end enrollment",
        body: "Public-facing course catalog, online registration, SkillsFuture Credit acceptance, invoicing, and payment reconciliation in one place.",
      },
      {
        title: "Trainer & resource scheduling",
        body: "Capacity-aware scheduling: trainer availability, room bookings, equipment, conflict detection.",
      },
    ],
    whatsIncluded: [
      "Self-hosted deployment on your domain — you own the data and code",
      "Custom-branded TMS with your logo, colors and copy",
      "SSG / TPGateway API integration and course-run submission",
      "Online registration + SkillsFuture Credit + invoice + e-receipt flow",
      "E-attendance via mobile (SSG-compliant) and physical card reader",
      "Trainer / room / equipment scheduling with conflict detection",
      "Self-serve admin: courses, fees, runs, learners, reports",
    ],
    faq: [
      {
        q: "Do you integrate with SSG and SkillsFuture Credit?",
        a: "Yes — course runs are submitted to TPGateway via API; SkillsFuture Credit redemption is handled through the standard SSG learner-facing flow with full audit trail for TPQA.",
      },
      {
        q: "Is the TMS open-source?",
        a: "The core platform is built on our open-source EdTools stack. You own the deployment and the data. We provide professional services for customisation, integration and support.",
      },
      {
        q: "How does the TMS price compare to off-the-shelf SaaS?",
        a: "No per-user, per-transaction or recurring SaaS fees. You pay for build, deployment and optional ongoing support — typically less than 12 months of equivalent SaaS for a mid-size ATO.",
      },
      {
        q: "Can it work alongside our existing accounting / CRM?",
        a: "Yes. Webhooks and REST APIs export invoices, payments and learner records into Xero, QuickBooks, Salesforce, HubSpot and similar systems.",
      },
    ],
  },
  "learning-management-system": {
    slug: "learning-management-system",
    title: "Learning Management System (LMS)",
    leadSource: "lms-page",
    serviceType: "Learning Management System",
    processIntro: "From scoping through course migration to learner go-live.",
    timeline: [
      { title: "Discovery", duration: "Week 0 · free", accent: "cyan", body: "Map your existing courses, learner journeys, certification flow, SSO and integration points." },
      { title: "Demo & Scoping", duration: "Week 1", accent: "blue", body: "Live LMS walkthrough. Confirm SCORM / xAPI requirements, branding, and any custom assessments." },
      { title: "Quotation", duration: "Week 2", accent: "purple", body: "Fixed-fee proposal with migration scope and timeline." },
      { title: "Build & Migrate", duration: "Weeks 3–6", accent: "amber", body: "LMS deployment, course content migration, SCORM import, assessment configuration, instructor training." },
      { title: "Go Live", duration: "Week 6+", accent: "green", body: "Learners onboarded, certificates issued, 30-day support." },
    ],
    hero: {
      kicker: "[ LMS · WSQ · TPQA ]",
      headlineHtml:
        'AI-enhanced <span class="gradient-text">Learning Management System</span> for WSQ delivery.',
      subhead:
        "Deliver interactive eLearning, run assessments, track competency and stay TPQA-ready — without paying per-seat SaaS fees.",
    },
    meta: {
      title: "Learning Management System (LMS) Singapore — AI-Enhanced, WSQ-Ready",
      description:
        "Cloud-based, multi-tenant LMS for Singapore training providers. Interactive eLearning, assessments, instructor dashboards, AI-assisted content creation. Book a free demo.",
    },
    benefits: [
      {
        title: "Self-hosted on your domain",
        body: "Your LMS, your data, your branding. Deployed to your own infrastructure (Coolify, AWS, Vercel, on-prem) — no SaaS lock-in, no per-seat fees, no vendor exit risk.",
      },
      {
        title: "Interactive eLearning delivery",
        body: "SCORM, xAPI, HTML5, video, quizzes and discussions — all rendered on a fast, mobile-first learner UI.",
      },
      {
        title: "Assessment & competency tracking",
        body: "Formative + summative assessments mapped to WSQ Competency Units. Auto-grading + manual moderation workflows.",
      },
      {
        title: "AI content authoring",
        body: "Built-in Claude Agent SDK assist for outlining modules, drafting quiz items, generating summaries and translations.",
      },
    ],
    whatsIncluded: [
      "Self-hosted deployment on your domain — you own the data and code",
      "Custom-branded LMS with your logo, colors and copy",
      "Course authoring (rich text, video, quizzes, SCORM import)",
      "WSQ Competency mapping + assessment plan",
      "E-certificate issuance (with optional blockchain anchoring)",
      "Instructor + admin dashboards with cohort analytics",
      "Single Sign-On (SSO) integration with your existing identity provider",
    ],
    faq: [
      {
        q: "Does it work for SCORM and existing course packages?",
        a: "Yes — full SCORM 1.2 / 2004 and xAPI support. Import existing packages without re-authoring.",
      },
      {
        q: "Can learners use it on mobile?",
        a: "The learner UI is fully responsive; we also ship an optional PWA mode for offline content review.",
      },
      {
        q: "How is data hosted?",
        a: "Default deployment is on a Coolify-managed Singapore region instance with daily backups. Self-hosted on-prem is available for enterprise.",
      },
      {
        q: "Is it open-source?",
        a: "Built on our open-source EdTools stack. You retain full ownership of code and data on your deployment.",
      },
    ],
  },
  "ai-solutions": {
    slug: "ai-solutions",
    title: "AI Solutions",
    leadSource: "ai-solutions-page",
    serviceType: "AI Software Consultancy",
    processIntro: "From discovery to production deployment in agile 2-week sprints.",
    timeline: [
      { title: "Discovery", duration: "Week 0 · free", accent: "cyan", body: "30-min call. We map the use case, success metrics, existing systems and integration constraints." },
      { title: "Workshop", duration: "Week 1", accent: "blue", body: "Half-day technical discovery: architecture, data flow, model selection, security, deployment target." },
      { title: "Quotation", duration: "Week 2", accent: "purple", body: "Fixed-fee proposal with timeline + acceptance criteria per sprint." },
      { title: "Build & Iterate", duration: "Weeks 3+", accent: "amber", body: "2-week sprints with weekly demos. Production-grade Next.js / React Native / Claude agents." },
      { title: "Go Live", duration: "End of project", accent: "green", body: "Production deployment, observability dashboards, runbooks, 30-day post-launch support." },
    ],
    hero: {
      kicker: "[ AGENTIC AI · CLAUDE CODE · BESPOKE ]",
      headlineHtml:
        'Production <span class="gradient-text">Agentic AI</span> and bespoke software for organisations.',
      subhead:
        "From AI-powered admin assistants to internal CRMs to public-facing AI tools — built with Claude Code, n8n, and a 12-year track record in Singapore EdTech.",
    },
    meta: {
      title: "AI Solutions Singapore — Agentic AI, n8n, Claude Code, Bespoke Web & Mobile",
      description:
        "Custom AI agents, automations and full-stack web/mobile apps for Singapore SMEs and training providers. Built with Claude Agent SDK, n8n and modern stacks. Book a free scoping call.",
    },
    benefits: [
      {
        title: "Agentic AI workflows",
        body: "Claude-powered agents that perform real work — draft posts, summarise leads, triage support, fill compliance forms.",
      },
      {
        title: "n8n automation",
        body: "Visual workflow automation connecting Gmail, Slack, GSuite, Stripe, Notion, your CRM and your custom APIs.",
      },
      {
        title: "Bespoke web / mobile apps",
        body: "Production-grade Next.js, React Native and Expo apps. AppStore + Play Store deployment included.",
      },
      {
        title: "Harness Systems integration",
        body: "End-to-end CI/CD, observability, secret management for your AI deployments.",
      },
    ],
    whatsIncluded: [
      "Scoping workshop + technical discovery (1–2 weeks)",
      "Architecture proposal with cost + timeline guarantees",
      "Iterative delivery in 2-week sprints with weekly demos",
      "Production deployment on your infra or our Coolify-managed cluster",
      "Documentation, runbooks and 30-day post-launch support",
    ],
    faq: [
      {
        q: "Do you use OpenAI or Claude?",
        a: "Default is Claude (Anthropic) via the Claude Agent SDK — better at long-horizon tasks, transparent reasoning, and works with your OAuth subscription instead of metered API. We can use OpenAI on request.",
      },
      {
        q: "What's the typical project size?",
        a: "Small workflow automations: 1–2 weeks. Internal tools / dashboards: 4–8 weeks. Full bespoke product: 3+ months. We confirm scope after Discovery.",
      },
      {
        q: "Do you do mobile apps?",
        a: "Yes — Expo + React Native, native iOS / Android. We also handle store submission and review.",
      },
      {
        q: "Can you work with our existing dev team?",
        a: "Yes — we routinely embed with internal teams for pair-programming, code review and Claude-Code training.",
      },
    ],
  },
  "wsq-course-development": {
    slug: "wsq-course-development",
    title: "WSQ Course Development",
    leadSource: "course-dev-page",
    serviceType: "Course Development",
    processIntro: "From competency mapping to SSG submission package — typically 6–10 weeks per course.",
    timeline: [
      { title: "Discovery", duration: "Week 0 · free", accent: "cyan", body: "30-min call. We confirm sector, framework (WSQ / CASL / IBF-STS / PWM), target competencies and audience." },
      { title: "Scoping", duration: "Week 1", accent: "blue", body: "Competency mapping draft, learning outcomes, course structure, assessment strategy." },
      { title: "Quotation", duration: "Week 2", accent: "purple", body: "Fixed-fee proposal scoped to course duration and assessment complexity." },
      { title: "Build", duration: "Weeks 3–8", accent: "amber", body: "Lesson plans, slide decks, assessor guides, trainer guide, industry-engagement evidence pack." },
      { title: "SSG Submission", duration: "Weeks 8–10", accent: "green", body: "Complete Course Application package on TPGateway. We walk you through the submission flow." },
    ],
    hero: {
      kicker: "[ COURSE DEV · WSQ · IBF-STS · PWM ]",
      headlineHtml:
        '<span class="gradient-text">WSQ Course Development</span> end-to-end.',
      subhead:
        "From competency mapping through lesson plans, assessment plans and SSG submission package — for WSQ, CASL, IBF-STS / FTS and PWM frameworks.",
    },
    meta: {
      title: "WSQ Course Development Singapore — Competency Mapping, Lesson Plans, SSG Submission",
      description:
        "End-to-end accredited course development for Singapore training providers. WSQ, CASL, IBF-STS and PWM frameworks. We handle competency mapping, lesson plans and SSG submission.",
    },
    benefits: [
      {
        title: "Framework alignment",
        body: "Courses mapped to WSQ Competency Units, Critical Core Skills (CCS) or IBF-STS competencies depending on your sector.",
      },
      {
        title: "Lesson + assessment plans",
        body: "Hour-by-hour lesson plans, structured assessment plans (formative + summative) and assessor guides.",
      },
      {
        title: "Industry engagement",
        body: "Documented industry consultation and learner-feedback analysis — required artefacts for SSG approval.",
      },
      {
        title: "Submission-ready",
        body: "Full Course Application package compliant with TPGateway requirements; we walk you through the submission.",
      },
    ],
    whatsIncluded: [
      "Competency mapping to WSQ / CASL / IBF-STS / PWM",
      "Course outline + module breakdown",
      "Hour-by-hour lesson plans",
      "Assessment plan + assessor guides",
      "Trainer guide + slide deck",
      "Industry engagement & learner-feedback evidence pack",
      "TPGateway Course Application submission package",
    ],
    faq: [
      {
        q: "Which frameworks do you cover?",
        a: "WSQ, Critical Core Skills (CCS), IBF-STS / FTS, PWM, and CASL. Other frameworks on request.",
      },
      {
        q: "Do you handle CASL courses?",
        a: "Yes — CASL course development is a frequent engagement, including competency mapping and submission to relevant accreditation bodies.",
      },
      {
        q: "How long does course development take?",
        a: "Typical engagement: 6–10 weeks per course depending on length (in-classroom hours), assessment complexity and SME availability.",
      },
      {
        q: "Can you also deliver the course?",
        a: "We focus on development. Through our network we can recommend qualified ACLP-certified trainers if needed.",
      },
    ],
  },
  "content-management-system": {
    slug: "content-management-system",
    title: "Content Management System",
    leadSource: "cms-page",
    serviceType: "Content Management System",
    hero: {
      kicker: "[ CMS · LEAD-GEN · SEO ]",
      headlineHtml:
        '<span class="gradient-text">AI-powered CMS</span> built for lead generation and SEO.',
      subhead:
        "Self-hosted Next.js CMS where every public route ships with JSON-LD, sitemap, canonical, OG, and a source-tagged lead form — wired to a Gmail-OAuth notification pipeline so leads land in sales within seconds.",
    },
    meta: {
      title: "Self-Hosted AI CMS for Singapore — Lead Generation + SEO Built-In",
      description:
        "Customizable Next.js CMS with AI authoring, source-tagged lead forms, sitewide JSON-LD, and a built-in AI chatbot. No vendor lock-in. Book a free demo.",
    },
    processIntro: "From discovery to your custom-branded CMS live on your domain — predictable, fixed-fee.",
    timeline: [
      { title: "Discovery", duration: "Week 0 · free", accent: "cyan", body: "30-min call. We map your content model, traffic goals, lead funnel and existing CMS (WordPress / Webflow / static)." },
      { title: "Demo & Scoping", duration: "Week 1", accent: "blue", body: "Live walkthrough on a staging URL. Confirm migration scope, design direction, integrations." },
      { title: "Quotation", duration: "Week 2", accent: "purple", body: "Fixed-fee proposal with timeline guarantees." },
      { title: "Build & Migrate", duration: "Weeks 3–6", accent: "amber", body: "Custom branding, content migration (incl. WordPress 301 redirects), AI chatbot config, lead-form wiring." },
      { title: "Go Live", duration: "Week 6+", accent: "green", body: "Production deployment, admin training, 30-day support. You own the data, code, and domain." },
    ],
    benefits: [
      { title: "Self-hosted, no lock-in", body: "Your domain, your data, your code. Deploy on Coolify, AWS, Vercel or on-prem. No per-seat SaaS fees." },
      { title: "SEO + JSON-LD on every route", body: "Organization, Article, Service, FAQPage, LocalBusiness schemas auto-injected. Per-route canonical, OG, Twitter, sitemap." },
      { title: "AI authoring built in", body: "Claude Agent SDK drafts, rewrites and summarizes posts in one click — using your subscription OAuth token, no metered API." },
      { title: "Lead funnel by default", body: "Every page has a source-tagged form. Submissions land in /admin/leads + email sales via Gmail OAuth2 — within seconds." },
    ],
    whatsIncluded: [
      "Custom-branded CMS deployed on your domain",
      "TipTap rich editor with image upload + slash commands",
      "Pages + Posts CRUD with Categories, Tags, per-route SEO meta",
      "Visual drag-and-drop menu builder",
      "Sitewide JSON-LD (Organization, Article, Service, FAQPage, BreadcrumbList)",
      "AI chatbot with editable system prompt + FAQ",
      "Admin AI Assist — Draft / Rewrite / Summarize / Suggest SEO meta",
      "Gmail OAuth2 lead-notification pipeline",
      "WordPress migration (SQL dump → posts + 301 redirects)",
    ],
    faq: [
      { q: "How is this different from WordPress?", a: "Next.js performance + native AI authoring + first-class SEO/JSON-LD + no plugin sprawl. The codebase is yours; we don't host you or charge per-seat." },
      { q: "Can you migrate our existing WordPress site?", a: "Yes — scripts/migrate-wp.ts imports a SQL dump, downloads images, preserves Yoast/RankMath SEO and writes 301 redirects." },
      { q: "Is the AI metered?", a: "No. The chatbot and admin AI Assist use your Claude OAuth subscription token via the official Agent SDK — flat subscription, no per-call billing." },
      { q: "Can we customize the design?", a: "Yes — every component is a Next.js Server Component you can edit. We also expose homepage + service-page copy in the admin so non-devs can update without redeploys." },
    ],
  },
  "hr-management-system": {
    slug: "hr-management-system",
    title: "HR Management System",
    leadSource: "hrms-page",
    serviceType: "HR Management System",
    hero: {
      kicker: "[ HRMS · PAYROLL · APPRAISAL ]",
      headlineHtml:
        'Modern <span class="gradient-text">HR Management System</span> for Singapore SMEs.',
      subhead:
        "Self-hosted HRMS — payroll, leave, expense, appraisal, onboarding, training — built on Next.js with Singapore CPF + IRAS-ready payroll workflows.",
    },
    meta: {
      title: "HR Management System (HRMS) Singapore — Payroll, Leave, Expense, Appraisal",
      description:
        "Self-hosted HRMS with CPF / IRAS-ready payroll, leave + expense workflows, performance appraisal and onboarding. Built on Next.js. Book a free demo.",
    },
    processIntro: "From discovery to a custom-branded HRMS live on your domain.",
    timeline: [
      { title: "Discovery", duration: "Week 0 · free", accent: "cyan", body: "30-min call. Headcount, payroll cycle, current HR tools (Talenox / HReasily / Excel), and integration needs." },
      { title: "Workshop", duration: "Week 1", accent: "blue", body: "Map your existing payroll rules, leave policies, claim categories, appraisal cycle and approval workflows." },
      { title: "Quotation", duration: "Week 2", accent: "purple", body: "Fixed-fee proposal with module scope and timeline." },
      { title: "Build & Migrate", duration: "Weeks 3–8", accent: "amber", body: "Custom HRMS deployment, employee data migration, payroll configuration, Xero / accounting integration." },
      { title: "Go Live", duration: "Week 8+", accent: "green", body: "First payroll run with our support, HR admin training, 30-day post-launch support." },
    ],
    benefits: [
      { title: "Singapore payroll, done right", body: "CPF, SDL, FWL, IRAS Form IR8A, IR21, AIS submission — all baked in. We handle the edge cases (PR rates, part-timers, pro-rated bonuses)." },
      { title: "Self-hosted, white-labeled", body: "Your domain, your branding, your data. No per-employee SaaS fees. Deploy on your infra or our managed Coolify cluster." },
      { title: "Leave + expense workflows", body: "Multi-level approval flows, leave balances with carry-forward rules, expense categories with receipt upload and accounting export." },
      { title: "Performance appraisal", body: "Goal-setting, 360-degree feedback, mid-year and year-end review cycles, calibration meetings, with PDF export for HR records." },
    ],
    whatsIncluded: [
      "Custom-branded HRMS on your domain",
      "Payroll module — CPF, SDL, FWL, IRAS-ready",
      "Leave management with policies + balances + carry-forward",
      "Expense claims with receipt upload + accounting export",
      "Performance appraisal — goals, 360°, calibration, PDF export",
      "Onboarding workflow — offer letters, e-signature, doc checklist",
      "Training records + CPD tracking",
      "Employee self-service portal (mobile-friendly)",
      "Accounting integration (Xero, QuickBooks, Sage)",
    ],
    faq: [
      { q: "Is the payroll IRAS-compliant?", a: "Yes — IR8A, IR8S, IR21, AIS submission. We test against the IRAS sandbox during build and walk you through the first AIS submission live." },
      { q: "How does this compare to Talenox / HReasily?", a: "Self-hosted (you own the data), customizable workflows (not just toggles), and one-time engagement fee instead of per-employee per-month forever." },
      { q: "Can it handle our complex approval flows?", a: "Yes — approval chains are configurable per leave type, expense category, and amount threshold. We've built flows up to 5 approval levels." },
      { q: "Does it integrate with our accounting system?", a: "Native integrations with Xero and QuickBooks. CSV export for any other accounting tool." },
    ],
  },
  "ai-agent-deployment": {
    slug: "ai-agent-deployment",
    title: "AI Agent Deployment",
    leadSource: "ai-agent-page",
    serviceType: "AI Agent Deployment",
    hero: {
      kicker: "[ OPENCLAW · HERMES · NEBULA ]",
      headlineHtml:
        'Production <span class="gradient-text">AI Agent</span> deployment for your business.',
      subhead:
        "Deploy OpenClaw, Hermes Agent, Nebula or bespoke Claude Agent SDK builds into your existing systems — webhooks, n8n flows, REST APIs, customer-facing chat. Observability and cost guardrails included.",
    },
    meta: {
      title: "AI Agent Deployment Singapore — OpenClaw, Hermes Agent, Nebula, Claude Agent SDK",
      description:
        "Production deployment of agentic AI — OpenClaw, Hermes, Nebula and custom Claude agents wired into your systems with observability + cost guardrails. Book a free scoping call.",
    },
    processIntro: "From use-case to production-ready agent in 4–6 weeks.",
    timeline: [
      { title: "Discovery", duration: "Week 0 · free", accent: "cyan", body: "30-min call. Define the use case, success metrics, target systems and constraints." },
      { title: "Workshop", duration: "Week 1", accent: "blue", body: "Half-day technical workshop. Agent selection (OpenClaw / Hermes / Nebula / custom), tool integrations, security boundaries." },
      { title: "Quotation", duration: "Week 2", accent: "purple", body: "Fixed-fee proposal with sprint plan and acceptance criteria." },
      { title: "Build & Iterate", duration: "Weeks 3–5", accent: "amber", body: "Agent build with weekly demos. Observability dashboards, cost limits, eval harness." },
      { title: "Go Live", duration: "Week 6", accent: "green", body: "Production deployment, runbooks, on-call handover, 30-day post-launch support." },
    ],
    benefits: [
      { title: "Battle-tested agents", body: "OpenClaw (open-source autonomous agent), Hermes Agent (Singapore-built workflow agent), Nebula (research + planning agent). We pick the right one for your use case." },
      { title: "Custom Claude Agent SDK builds", body: "Bespoke agents on the official Anthropic SDK — tool use, MCP servers, long-horizon planning, with your Claude subscription token (no metered API)." },
      { title: "Integration-first", body: "n8n flows, Slack / Teams bots, webhook endpoints, REST APIs into your CRM / HRMS / accounting / LMS / CMS." },
      { title: "Observability + cost guardrails", body: "Per-agent token usage, latency, error tracing. Daily / monthly cost caps with auto-cutoff. No surprise bills." },
    ],
    whatsIncluded: [
      "Agent selection workshop + architecture proposal",
      "Production deployment of chosen agent stack",
      "Supported AI agents — OpenClaw · Hermes Agent · Nebula · Copilot Studio Agent and others",
      "Model-agnostic selection — Claude Code · Codex · MiniMax · Kimi · DeepSeek · OpenRouter",
      "Connect to multiple channels — WhatsApp · Telegram · Slack · Discord and more",
      "Tools & skills integration — GitHub · Remotion · Hyperframe · Google Workspace · Obsidian and more",
      "30-day post-launch support",
    ],
    faq: [
      { q: "What's OpenClaw, Hermes Agent, Nebula?", a: "OpenClaw is our open-source autonomous coding agent; Hermes is a Singapore-built workflow orchestration agent; Nebula is a research + planning agent. We'll recommend the right one in the Discovery call." },
      { q: "Can we use our existing Anthropic API key?", a: "We strongly recommend a Claude subscription OAuth token (`claude setup-token`) — it's a flat fee instead of per-call billing. The Claude Agent SDK supports both." },
      { q: "How do you prevent runaway costs?", a: "Per-agent and per-tenant token budgets with auto-cutoff, full audit trail in observability dashboards, and an eval harness that runs on every prompt change." },
      { q: "Can you integrate with our existing systems?", a: "Yes — Slack, Teams, Gmail, n8n, webhook endpoints, REST APIs to your CRM / HRMS / accounting / LMS. Custom MCP servers for proprietary tools." },
    ],
  },
  "tpqa-consultancy": {
    slug: "tpqa-consultancy",
    title: "TPQA Consultancy",
    leadSource: "tpqa-page",
    serviceType: "TPQA Consultancy",
    processIntro: "Pre-audit to post-audit — we're with you across all 4 TPQA Criteria.",
    timeline: [
      { title: "Discovery", duration: "Week 0 · free", accent: "cyan", body: "30-min call. Where are you in the TPQA cycle? Any prior audit findings or corrective actions?" },
      { title: "Gap Assessment", duration: "Week 1", accent: "blue", body: "Half-day pre-audit workshop or remote review of your QMS, SOPs, course evidence and outcomes data." },
      { title: "Quotation", duration: "Week 2", accent: "purple", body: "Fixed-fee remediation roadmap with priority-ranked actions per Indicator." },
      { title: "Mock Audit & Fix", duration: "Weeks 3–6", accent: "amber", body: "On-site mock TPQA audit, evidence-pack builds, trainer interview prep, gap closure." },
      { title: "Live SSG Audit", duration: "On-site day", accent: "green", body: "We're on-site during the actual SSG TPQA audit — interview coaching and real-time clarifications." },
    ],
    hero: {
      kicker: "[ TPQA · MOCK AUDIT · COMPLIANCE ]",
      headlineHtml:
        '<span class="gradient-text">TPQA Consultancy</span> — stay compliant year-round.',
      subhead:
        "Mock TPQA audits, evidence-pack remediation, gap-assessment roadmaps and on-site audit support for SSG-registered training providers in Singapore.",
    },
    meta: {
      title: "TPQA Consultancy Singapore — Mock Audits, Compliance Remediation, On-Site Support",
      description:
        "TPQA mock audits, evidence-pack remediation and on-site audit support for SSG-registered training providers. Stay compliant year-round. Free assessment call.",
    },
    benefits: [
      {
        title: "Mock TPQA audit",
        body: "Full half-day mock audit modelled on SSG's actual TPQA process — across all 4 Criteria and 14 Indicators.",
      },
      {
        title: "Evidence & documentation review",
        body: "We review your QMS, SOPs, course administration evidence, learner-management records and outcomes data — gap-list with priority.",
      },
      {
        title: "Gap remediation roadmap",
        body: "Concrete fixes for every gap, ranked by audit-risk. We help you build the missing evidence, not just identify it.",
      },
      {
        title: "On-site audit support",
        body: "We're on-site during the SSG TPQA audit to support your team — interview coaching, evidence presentation, real-time clarifications.",
      },
    ],
    whatsIncluded: [
      "Pre-audit gap-assessment workshop",
      "Mock TPQA audit (half-day on-site or remote)",
      "Detailed gap report with priority-ranked remediation actions",
      "Evidence-pack templates (Criterion 1–4)",
      "Hands-on remediation support (typically 2–6 weeks)",
      "On-site presence during the live SSG TPQA audit",
    ],
    faq: [
      {
        q: "When should we engage a TPQA consultant?",
        a: "Two ideal windows: (a) 3–6 months before your scheduled TPQA audit, or (b) immediately after receiving a corrective action plan to remediate gaps.",
      },
      {
        q: "What if we've already failed a TPQA audit?",
        a: "We've helped recover ATOs from formal Conditional Approval status. Engagement starts with reviewing the SSG corrective-action letter and building a remediation roadmap.",
      },
      {
        q: "Do you cover all 4 TPQA Criteria?",
        a: "Yes — Governance, Course Administration, Outcomes, and Continuous Improvement. We provide evidence templates for each Indicator.",
      },
      {
        q: "Do you provide TPQA training for our internal team?",
        a: "Yes — half-day or full-day workshops for ATO management and adult educators on TPQA Criteria interpretation.",
      },
    ],
  },
};
