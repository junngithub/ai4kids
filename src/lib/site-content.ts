import {
  HiAcademicCap,
  HiBookOpen,
  HiSparkles,
  HiShieldCheck,
  HiCpuChip,
  HiBuildingOffice2,
  HiCodeBracket,
  HiChartBar,
  HiRocketLaunch,
  HiClipboardDocumentList,
  HiBuildingLibrary,
  HiCheckBadge,
  HiNewspaper,
  HiUserGroup,
  HiBolt,
} from "react-icons/hi2";

export const SERVICES = [
  {
    id: "course-dev",
    icon: HiClipboardDocumentList,
    title: "Course Development",
    description:
      "End-to-end development of accredited courses across Singapore's training frameworks — competency mapping, lesson plans, assessments and submission packages.",
    features: [
      "WSQ course development",
      "CASL course development",
      "IBF-STS / FTS course development",
      "PWM course development",
    ],
    accent: "blue" as const,
    href: "/wsq-course-development",
    category: "ssg" as const,
  },
  {
    id: "ato",
    icon: HiBuildingLibrary,
    title: "ATO Application",
    description:
      "Become an Approved Training Organisation (ATO) — we prepare your QMS, policies and SOPs and walk you through the SSG application from start to finish.",
    features: [
      "QMS, policies & SOPs",
      "ATO submission package",
      "Pre-audit gap assessment",
      "Audit-readiness coaching",
    ],
    accent: "blue" as const,
    href: "/ssg-ato-application",
    category: "ssg" as const,
  },
  {
    id: "tpqa",
    icon: HiCheckBadge,
    title: "TPQA Consultancy",
    description:
      "Stay TPQA-compliant year-round. We run mock audits, fix gaps in your training-operations evidence, and prepare your team for the live SSG audit.",
    features: [
      "Mock TPQA audit",
      "Evidence & documentation review",
      "Gap remediation roadmap",
      "On-site audit support",
    ],
    accent: "cyan" as const,
    href: "/tpqa-consultancy",
    category: "ssg" as const,
  },
  {
    id: "tms",
    icon: HiAcademicCap,
    title: "Training Management System",
    description:
      "Streamline your entire training lifecycle with our comprehensive TMS platform. From scheduling to certification, manage it all in one place.",
    features: [
      "Self-hosted on your domain — you own the data",
      "Course scheduling & management",
      "Enrollment & registration workflows",
      "Reporting & analytics dashboards",
      "Scalable for institutions of any size",
    ],
    accent: "blue" as const,
    href: "/training-management-system",
    category: "ai" as const,
  },
  {
    id: "lms",
    icon: HiBookOpen,
    title: "Learning Management System",
    description:
      "Deliver engaging, interactive learning experiences with our AI-enhanced LMS. Built for modern learners and educators alike.",
    features: [
      "Self-hosted on your domain — you own the data",
      "Interactive eLearning delivery",
      "Assessment & progress tracking",
      "Instructor dashboards & analytics",
      "Cloud-based multi-tenant platform",
    ],
    accent: "cyan" as const,
    href: "/learning-management-system",
    category: "ai" as const,
  },
  {
    id: "ai",
    icon: HiSparkles,
    title: "Full Stack AI-Enabled Solutions",
    description:
      "Production AI systems, automations and bespoke software — from agentic workflows to full-stack web tools and mobile apps.",
    features: [
      "Agentic AI · n8n · Claude Code · OpenCLAW",
      "Harness Systems integration",
      "Bespoke full-stack web tools across frameworks",
      "Native and cross-platform mobile apps",
    ],
    accent: "purple" as const,
    href: "/ai-solutions",
    category: "ai" as const,
  },
  {
    id: "cms",
    icon: HiNewspaper,
    title: "Content Management System",
    description:
      "Self-hosted, AI-powered CMS built for lead generation and SEO — every page is a funnel, every route is search-indexed.",
    features: [
      "Self-hosted on your domain — own the data",
      "AI authoring with Claude Agent SDK",
      "SEO + JSON-LD baked into every route",
      "Source-tagged lead capture forms",
    ],
    accent: "blue" as const,
    href: "/content-management-system",
    category: "ai" as const,
  },
  {
    id: "hr",
    icon: HiUserGroup,
    title: "HR Management System",
    description:
      "Modern HRMS — payroll, leave, expense, appraisal, training and onboarding — built on Next.js with Singapore CPF + IRAS-ready payroll.",
    features: [
      "Payroll · CPF · IRAS-ready",
      "Leave + expense workflows",
      "Performance appraisal & 360°",
      "Self-hosted, white-labeled",
    ],
    accent: "cyan" as const,
    href: "/hr-management-system",
    category: "ai" as const,
  },
  {
    id: "ai-agent",
    icon: HiBolt,
    title: "AI Agent Deployment",
    description:
      "Production deployment of agentic AI — OpenClaw, Hermes Agent, Nebula and bespoke Claude agents wired into your existing systems.",
    features: [
      "OpenClaw · Hermes Agent · Nebula",
      "Custom Claude Agent SDK builds",
      "Webhook + n8n + API integration",
      "Observability + cost guardrails",
    ],
    accent: "purple" as const,
    href: "/ai-agent-deployment",
    category: "ai" as const,
  },
];

export const WHY_CHOOSE_US = [
  { icon: HiShieldCheck, title: "Secure & Scalable", description: "Enterprise-grade security with infrastructure that scales alongside your growth.", accent: "blue" as const },
  { icon: HiCpuChip, title: "AI Integration", description: "Cutting-edge AI capabilities woven seamlessly into every solution we deliver.", accent: "purple" as const },
  { icon: HiBuildingOffice2, title: "Enterprise Ready", description: "Robust architecture built for organizations of any size, from startups to enterprises.", accent: "cyan" as const },
  { icon: HiCodeBracket, title: "Custom Development", description: "Tailored solutions engineered to fit your unique business requirements.", accent: "blue" as const },
  { icon: HiChartBar, title: "Data-Driven Insights", description: "Actionable analytics and intelligent reporting to power smarter decisions.", accent: "purple" as const },
  { icon: HiRocketLaunch, title: "Fast Deployment", description: "Rapid implementation with agile methodology. Go live faster without compromising quality.", accent: "cyan" as const },
];

export const AI_LMS_TMS_FEATURES = [
  "WSQ and TPQA compliant out of the box",
  "Fully SSG API integrated — TPGateway, MySkillsFuture, attendance & enrolment",
  "50+ EdTools for trainers — quizzes, polls, breakouts, AI tutor, code sandbox",
  "Native integration with Google Meet, Zoom, and Microsoft Teams",
  "Auto enrolment, invoicing, and SkillsFuture claim workflows",
  "CP & Courseware Generator — agent-built lesson plans, decks, and assessments",
  "Claude Code-powered AI agent — content authoring, marking, and learner support",
];
