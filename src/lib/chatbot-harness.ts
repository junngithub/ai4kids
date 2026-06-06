/**
 * Lightweight chatbot harness — FAQ-first fast path.
 *
 * Answers common questions instantly from the admin-configured FAQ before
 * the request ever reaches the Claude Agent SDK. The SDK still handles
 * anything not matched, but most visitor questions (greeting, services,
 * contact, pricing) are deterministic and don't need an LLM call.
 *
 * We deliberately do NOT use the public Anthropic Messages API or any
 * pay-per-call API key — the only LLM path in this app is the Claude
 * Agent SDK with a subscription OAuth token.
 */
import type { FaqEntry } from "@/lib/chatbot-settings";

/** Try to answer instantly from the FAQ. Returns null on no confident match. */
export function tryFaqMatch(message: string, faq: FaqEntry[]): string | null {
  const q = message.trim().toLowerCase();
  if (q.length < 2 || faq.length === 0) return null;

  // 1) Substring either direction — stored question contained in the user's
  //    message, or the user's message contained in the stored question.
  for (const entry of faq) {
    const stored = entry.question.trim().toLowerCase();
    if (!stored) continue;
    if (q.includes(stored) || stored.includes(q)) return entry.answer;
  }

  // 2) Token overlap — ≥ 60% of stored-question tokens appear in the user's
  //    message. Tokens shorter than 3 chars are ignored to avoid noise.
  const userTokens = new Set(q.split(/\W+/).filter((t) => t.length > 2));
  if (userTokens.size === 0) return null;
  let best: { score: number; answer: string } | null = null;
  for (const entry of faq) {
    const tokens = entry.question.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
    if (tokens.length === 0) continue;
    const hit = tokens.filter((t) => userTokens.has(t)).length;
    const score = hit / tokens.length;
    if (score >= 0.6 && (!best || score > best.score)) {
      best = { score, answer: entry.answer };
    }
  }
  return best?.answer ?? null;
}

// ─── Product catalog quick answers ──────────────────────────────────────────
//
// Most visitor questions are "do you have X?" or "what is X?" for our core
// products. Answer those instantly with a short blurb + CTA — far faster than
// spawning the Claude Agent SDK, and the CTA nudges them into the lead flow.

type CatalogEntry = {
  keywords: string[];
  answer: string;
};

const PRODUCT_CATALOG: CatalogEntry[] = [
  {
    keywords: ["tms", "training management system", "training-management"],
    answer:
      "Yes — our **TMS (Training Management System)** handles course catalogues, trainer rostering, learner enrolment, attendance, certificates, SSG TPGateway sync and invoicing. Self-hosted, no per-user fees. Want a quick **demo** or a **quote**?",
  },
  {
    keywords: ["lms", "learning management system", "learning-management"],
    answer:
      "Yes — our **LMS (Learning Management System)** ships with 50+ classroom EdTools (Padlet, Whiteboard, Live Q&A, CyberLabs, NovaStats…), Moodle-compatible course delivery, assessments, and AI tutor. Self-hosted, WSQ-aligned. Want a **demo** or a **quote**?",
  },
  {
    keywords: ["ssg ato", "ssg-ato", "ssg application", "ato application"],
    answer:
      "Yes — we run a full **SSG ATO application** service: gap-assessment, policy docs, evidence pack, TPGateway setup, and a mock TPQA audit. 6–10 weeks typical. Want to **book a consultation**?",
  },
  {
    keywords: ["tpqa", "tpqa audit", "audit"],
    answer:
      "Yes — we offer **TPQA consultancy**: mock audits, gap closure, policy & procedure templates, and we sit in on the actual TPQA visit. Want to **book a free scoping call**?",
  },
  {
    keywords: ["wsq course", "course development", "courseware"],
    answer:
      "Yes — end-to-end **WSQ course development**: competency mapping, lesson plans, assessment plans, trainer guides, and SSG submission. 6–10 weeks per course. Want a **quote**?",
  },
  {
    keywords: ["ai agent", "agentic", "claude agent", "agent deployment"],
    answer:
      "Yes — we deploy production **Agentic AI**: OpenClaw, Hermes, Nebula, or bespoke Claude Agent SDK builds wired into your inbox, CRM, n8n flows or chat. Self-hosted, OAuth-subscription auth (no metered API). Want a **scoping call**?",
  },
  {
    keywords: ["ai solution", "full-stack ai", "ai consultancy"],
    answer:
      "Yes — **AI Solutions** covers bespoke web/mobile apps, agentic workflows, n8n automation, and AI Harness Systems. Built with Claude Code, Next.js, React Native. Want a **free 30-min scoping call**?",
  },
  {
    keywords: ["cms", "content management"],
    answer:
      "Yes — we deploy a **self-hosted CMS** (this site runs on it): Next.js + Drizzle + Postgres, AI-assisted writing, lead capture, sync API. Open-source, no SaaS fees. Want a **demo**?",
  },
  {
    keywords: ["hrms", "hr management", "human resource"],
    answer:
      "Yes — our **HRMS** covers leave, claims, payroll prep, appraisals, training records and SSG funding tracking. Self-hosted, SG-compliant. Want a **demo** or a **quote**?",
  },
  {
    keywords: ["chatbot", "ai chatbot", "nemo"],
    answer:
      "Yes — **Nemo** (the one you're talking to) is our open-source chatbot framework. Plugs into your CMS, FAQ, and lead pipeline. Want to **deploy one on your site**?",
  },
  {
    keywords: ["price", "pricing", "how much", "cost", "fee"],
    answer:
      "Pricing depends on scope — most engagements are fixed-fee after a free scoping call. LMS/TMS from S$15k/yr self-hosted with no per-user fees; bespoke AI agents from S$8k. Want a **quote** for your use case?",
  },
];

export function tryProductCatalog(message: string): string | null {
  const lower = message.trim().toLowerCase();
  if (lower.length < 2) return null;
  for (const entry of PRODUCT_CATALOG) {
    for (const kw of entry.keywords) {
      // Match as a whole token / substring; avoid matching inside longer words
      // by checking word boundaries for short keywords.
      if (kw.length <= 4) {
        const re = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
        if (re.test(lower)) return entry.answer;
      } else if (lower.includes(kw)) {
        return entry.answer;
      }
    }
  }
  return null;
}

/** Canned replies for one-word greetings — instant, no LLM needed. */
const GREETING_REGEX = /^(hi|hello|hey|yo|hola|sup|good\s*(morning|afternoon|evening))[!\.\?]*$/i;
export function tryGreeting(message: string, brand: string): string | null {
  if (!GREETING_REGEX.test(message.trim())) return null;
  return `Hi there! I'm Nemo, an AI assistant for ${brand}. Ask me about our SSG service, LMS, TMS, AI solutions, or anything else — happy to help.

If you'd like a quote, demo, or to speak to our team, just say so and I'll take a few details.`;
}

// ─── Lead-capture flow ──────────────────────────────────────────────────────
//
// Nemo doubles as a lead magnet. When a visitor expresses intent (quote,
// demo, pricing, contact, consultation, speak to a human…), we walk them
// through Name → Email → Phone and post the result to /api/contact under
// source="nemo". State is recovered each turn by inspecting the recent
// conversation, so the API stays stateless.

export type Msg = { role: "user" | "model"; content: string };

// Strong contact intent only — these signal "the visitor wants to be reached".
// Pricing / cost / interested / budget questions are answered first via the
// catalog or SDK, NOT auto-captured, so the funnel goes: answer → qualify →
// then ask for name + email when the visitor wants follow-up.
const INTENT_KEYWORDS = [
  "send me a quote",
  "send me quote",
  "send a quote",
  "request a quote",
  "get a quote",
  "quote please",
  "quotation",
  "proposal",
  "rfp",
  "tender",
  "book a demo",
  "schedule a demo",
  "schedule a call",
  "book a call",
  "book a meeting",
  "schedule a meeting",
  "speak to someone",
  "speak to your team",
  "talk to someone",
  "talk to sales",
  "contact me",
  "call me back",
  "follow up with me",
  "follow-up with me",
  "engage your team",
  "engage you",
  "ready to buy",
  "ready to engage",
  "sign me up",
];

// Soft refusal — visitor doesn't want to share the current field.
const REFUSAL_REGEX =
  /^\s*(no|nope|nah|don'?t ask|stop asking|skip|not now|not yet|later|maybe later|no thanks|won'?t share|can'?t share)\b/i;

// Question pivot — visitor asked something instead of answering the prompt.
// We must NOT re-ask the same prompt; we must answer the question first.
function looksLikeQuestion(msg: string): boolean {
  const t = msg.trim();
  if (!t) return false;
  if (/\?$/.test(t)) return true;
  if (
    /^(what|how|can you|could you|tell me|do you|does|why|when|where|which|who|is there|are there|is it|are you)\b/i.test(
      t,
    )
  )
    return true;
  // Product mentions count as a topic pivot during capture.
  if (
    /\b(tms|lms|cms|hrms|ato|tpqa|wsq|ssg|chatbot|ai agent|agentic|n8n|claude|pricing|price|cost|feature|integration|self[- ]?host)\b/i.test(
      t,
    )
  )
    return true;
  return false;
}

const NAME_PROMPT =
  "Happy to help — could I get your **name** so I can pass this to the right person on our team?";
const EMAIL_PROMPT = "Thanks {name}. What's the best **email** to follow up on?";
const PHONE_PROMPT =
  "Got it. And a **mobile / contact number** (with country code if possible)? — type _skip_ if you'd rather not share.";
const DONE_TEMPLATE =
  "Thanks {name} — I've sent your details to our team at angch@tertiaryinfotech.com. Expect a reply within 1 business day. Anything else you'd like to ask in the meantime?";

export type LeadField = "name" | "email" | "phone" | null;

export type LeadCaptureState = {
  active: boolean;
  details: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  awaiting: LeadField;
  startedTurn: number; // index in history where the flow began
};

/** True if the visitor's latest message should preempt a capture re-prompt. */
export function shouldYieldCapture(message: string): boolean {
  return looksLikeQuestion(message);
}

/** True if the visitor refused to share the current capture field. */
export function isRefusal(message: string): boolean {
  return REFUSAL_REGEX.test(message.trim());
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
// Allow +, spaces, dashes, parens, dots; require at least 7 digits.
const PHONE_REGEX = /(\+?\d[\d\s().-]{6,}\d)/;

function detectIntent(text: string): boolean {
  const lower = text.toLowerCase();
  return INTENT_KEYWORDS.some((kw) => lower.includes(kw));
}

function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_REGEX);
  return m ? m[0] : null;
}

function extractPhone(text: string): string | null {
  const m = text.match(PHONE_REGEX);
  if (!m) return null;
  const digits = m[0].replace(/[^\d]/g, "");
  if (digits.length < 7) return null;
  return m[0].trim();
}

// Words that disqualify a string from being a name — pronouns, verbs, question
// words, refusals, common chatter. Anything containing these is treated as a
// sentence / question rather than a name.
const NON_NAME_WORD =
  /\b(you|u|me|my|we|our|us|they|them|i|am|is|are|was|were|be|been|have|has|had|do|does|did|don'?t|won'?t|can'?t|cannot|not|never|please|sorry|thanks|thank|hi|hello|hey|yes|no|ok|okay|sure|skip|stop|wait|why|how|what|when|where|which|who|whom|whose|tell|ask|asked|asking|answer|answered|give|gave|send|sent|need|needs|want|wants|like|liked|know|knew|would|should|could|might|may|will|shall|just|really|very|too|also|already|still|now|here|there|that|this|those|these|but|and|or|so|because|though|than|then)\b/i;

function extractName(text: string): string | null {
  // Treat the whole user line as the name when we're explicitly waiting for
  // it. Strip common framings like "i'm …", "my name is …", "this is …".
  let stripped = text
    .trim()
    .replace(/^(hi|hello|hey)[,!\.\s]*/i, "")
    .replace(/^(my name is|i am|i'm|im|this is|it'?s|name[:\s]*)\s*/i, "")
    .replace(/[.!?]+$/, "")
    .trim();
  if (!stripped) return null;
  // Reject if it looks like an email or phone — those are different fields.
  if (EMAIL_REGEX.test(stripped) || PHONE_REGEX.test(stripped)) return null;
  if (stripped.length > 40 || stripped.length < 2) return null;
  // Reject if contains digits — names don't.
  if (/\d/.test(stripped)) return null;
  // Reject if it's a sentence/question — pronoun/verb/question word present.
  if (NON_NAME_WORD.test(stripped)) return null;
  // Names are usually 1–4 short tokens.
  const tokens = stripped.split(/\s+/);
  if (tokens.length > 4) return null;
  if (tokens.some((t) => t.length > 20)) return null;
  // Optional: title-case it so the email prompt reads naturally.
  stripped = tokens
    .map((t) => (t.length > 1 ? t[0].toUpperCase() + t.slice(1) : t.toUpperCase()))
    .join(" ");
  return stripped;
}

/**
 * Walk back through history to reconstruct the current capture state.
 * The model side stores prompts containing markers (NAME_PROMPT etc) — the
 * presence of a prompt and the following user reply tells us which slot is
 * filled or pending.
 */
export function buildCaptureState(history: Msg[], latestUserMsg: string): LeadCaptureState {
  const all: Msg[] = [...history, { role: "user", content: latestUserMsg }];
  const state: LeadCaptureState = {
    active: false,
    details: null,
    name: null,
    email: null,
    phone: null,
    awaiting: null,
    startedTurn: -1,
  };

  for (let i = 0; i < all.length; i++) {
    const m = all[i];
    if (m.role === "user" && !state.active && detectIntent(m.content)) {
      // Activate capture and ask for the name immediately. Qualification
      // happens in surrounding conversation, not via a forced checklist.
      state.active = true;
      state.awaiting = "name";
      state.startedTurn = i;
      // Stash the intent message as "details" so the lead summary has context.
      state.details = m.content.trim();
      continue;
    }
    if (!state.active) continue;

    if (m.role === "model") {
      // Detect which slot the model just asked about by the prompt marker.
      if (m.content.includes("could I get your **name**")) state.awaiting = "name";
      else if (m.content.includes("best **email**")) state.awaiting = "email";
      else if (m.content.includes("**mobile / contact number**")) state.awaiting = "phone";
    } else if (state.awaiting) {
      // If the visitor pivoted to a question or refusal, don't advance state —
      // the caller will answer the question / handle the refusal instead of
      // re-asking the same field.
      if (looksLikeQuestion(m.content) || REFUSAL_REGEX.test(m.content.trim())) {
        continue;
      }
      if (state.awaiting === "name") {
        const v = extractName(m.content);
        if (v) {
          state.name = v;
          state.awaiting = state.email ? (state.phone ? null : "phone") : "email";
        }
      } else if (state.awaiting === "email") {
        const v = extractEmail(m.content);
        if (v) {
          state.email = v;
          state.awaiting = state.phone ? null : "phone";
        }
      } else if (state.awaiting === "phone") {
        if (/^\s*skip\s*$/i.test(m.content)) {
          state.phone = null;
          state.awaiting = null;
        } else {
          const v = extractPhone(m.content);
          if (v) {
            state.phone = v;
            state.awaiting = null;
          }
        }
      }
    }
  }

  return state;
}

export function nextCapturePrompt(state: LeadCaptureState): string | null {
  if (!state.active) return null;
  if (state.awaiting === "name") return NAME_PROMPT;
  if (state.awaiting === "email") return EMAIL_PROMPT.replace("{name}", state.name ?? "there");
  if (state.awaiting === "phone") return PHONE_PROMPT;
  return null;
}

export function captureDoneMessage(state: LeadCaptureState): string {
  return DONE_TEMPLATE.replace("{name}", state.name ?? "there");
}

export function buildLeadMessageFromHistory(history: Msg[]): string {
  // The "message" stored on the lead is the conversation summary so the
  // recipient sees what the visitor actually asked Nemo.
  const lines = history
    .filter((m) => m.content.trim())
    .slice(-20)
    .map((m) => `${m.role === "user" ? "Visitor" : "Nemo"}: ${m.content.trim()}`);
  return lines.join("\n");
}
