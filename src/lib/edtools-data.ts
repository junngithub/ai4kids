/**
 * Authoritative list of EdTools shipped inside the AI-LMS-TMS suite.
 * Source of truth for /edtools and /edtools/[slug] routes.
 * Pulled from https://github.com/alfredang/AI-LMS-TMS README.
 */

export type EdTool = {
  slug: string;
  name: string;
  category: EdToolCategory;
  description: string;
  /** Optional alfredang/<repo> name — used to link to live demo + GitHub. */
  repo?: string;
  /** Live demo URL if a deployed instance exists. */
  demoUrl?: string;
  /** Optional list of features rendered as bullets on the detail page. */
  features?: string[];
  /** Suggested tech-stack chips for the detail page. */
  stack?: string[];
};

export const ED_TOOL_CATEGORIES = [
  "Interactive Classroom",
  "Problem Solving",
  "Cyber Security",
  "Data Analytics",
  "Finance",
  "Statistics & SPC",
  "Sustainability",
  "Blockchain",
] as const;
export type EdToolCategory = (typeof ED_TOOL_CATEGORIES)[number];

export const EDTOOLS: EdTool[] = [
  // Interactive Classroom
  {
    slug: "ice-breaker",
    name: "Ice Breaker",
    category: "Interactive Classroom",
    description: "Engaging icebreaker activities to warm up a class — quick games, prompts, and pair-shares for new cohorts.",
    stack: ["JavaScript", "HTML5", "Real-time"],
    features: [
      "Quick prompts for new cohorts and corporate workshops",
      "Random pair / small-group generator",
      "Single-link join — no learner accounts required",
    ],
  },
  {
    slug: "pinboard",
    name: "Pinboard",
    category: "Interactive Classroom",
    description: "Padlet-style sticky-note canvas for collaborative brainstorming, retrospectives, and idea capture.",
    repo: "pinboard",
    demoUrl: "https://alfredang.github.io/pinboard/",
    stack: ["React", "Real-time", "Drag & drop"],
    features: [
      "Drag-and-drop sticky notes with colour grouping",
      "Real-time multi-user collaboration",
      "Export the board as image / JSON",
    ],
  },
  {
    slug: "break-timer",
    name: "Break Timer",
    category: "Interactive Classroom",
    description: "Musical countdown timer for class breaks — keeps the room in sync, brings everyone back on time.",
    stack: ["JavaScript", "Web Audio API"],
    features: [
      "Visual countdown with configurable break length",
      "Background music playlist that fades on resume",
      "Full-screen presenter mode",
    ],
  },
  {
    slug: "word-cloud",
    name: "Word Cloud",
    category: "Interactive Classroom",
    description: "Live word-cloud generator — learners contribute words on their phones and watch the cloud grow on the projector.",
    repo: "wordcloud",
    stack: ["JavaScript", "Canvas", "WebSocket"],
    features: [
      "Live updates as learners submit",
      "Stopword filtering + size weighting",
      "Export PNG/SVG for reports",
    ],
  },
  {
    slug: "flash-cards",
    name: "Flash Cards",
    category: "Interactive Classroom",
    description: "Digital flashcard system with spaced repetition for vocabulary, terminology, and certification prep.",
    stack: ["React", "LocalStorage", "Spaced repetition"],
    features: [
      "Spaced-repetition review queue",
      "Import flashcards from CSV / spreadsheet",
      "Per-deck progress tracking",
    ],
  },
  {
    slug: "live-qa",
    name: "Live Q&A",
    category: "Interactive Classroom",
    description: "Real-time audience Q&A — learners submit questions and upvote others, trainer answers in priority order.",
    repo: "live-qna",
    demoUrl: "https://alfredang.github.io/live-qna/",
    stack: ["React", "Firebase", "Real-time"],
    features: [
      "Audience upvoting surfaces the best questions",
      "Anonymous mode for sensitive topics",
      "Mark-as-answered + export Q&A log",
    ],
  },
  {
    slug: "whiteboard",
    name: "Whiteboard",
    category: "Interactive Classroom",
    description: "Digital whiteboard for live instruction — drawing, shapes, text, real-time multi-user collaboration.",
    repo: "whiteboard",
    stack: ["Canvas", "WebSocket", "Real-time"],
    features: [
      "Free-hand drawing + shape tools",
      "Multi-user simultaneous editing",
      "Export to PNG / PDF",
    ],
  },
  {
    slug: "padlet",
    name: "Padlet",
    category: "Interactive Classroom",
    description: "Wall-style collaborative posting space for class discussion, resource sharing, and group exhibits.",
    repo: "padlet",
    demoUrl: "https://alfredang.github.io/padlet/",
    stack: ["React", "Real-time", "Media uploads"],
    features: [
      "Sticky-note style posts with image + link attachments",
      "Trainer moderation controls",
      "Export the wall as PDF for assessment",
    ],
  },
  {
    slug: "collaborative-note",
    name: "Collaborative Note",
    category: "Interactive Classroom",
    description: "Shared note-taking workspace — multiple learners write the same document, trainer sees everyone in real time.",
    stack: ["React", "Yjs / CRDT", "WebSocket"],
    features: [
      "Real-time concurrent editing (CRDT-based)",
      "Per-learner cursor and colour tag",
      "Export to Markdown / DOCX",
    ],
  },
  {
    slug: "collaborative-flow",
    name: "Collaborative Flow",
    category: "Interactive Classroom",
    description: "Process flow diagramming tool for groups — drag-and-drop nodes and connectors, ideal for SOP mapping exercises.",
    stack: ["React", "React Flow", "Real-time"],
    features: [
      "Library of flowchart primitives",
      "Multi-user editing of the same diagram",
      "Export to SVG / PNG",
    ],
  },
  {
    slug: "collaborative-kanban",
    name: "Collaborative Kanban",
    category: "Interactive Classroom",
    description: "Board-based task management for group projects — drag cards across columns in real time.",
    repo: "kanban-board",
    stack: ["React", "Real-time", "Drag & drop"],
    features: [
      "Configurable columns (Todo / Doing / Done by default)",
      "Card assignment + colour labels",
      "Multi-user real-time updates",
    ],
  },
  {
    slug: "live-poll",
    name: "Live Poll",
    category: "Interactive Classroom",
    description: "Real-time audience polling with bar-chart results — drop a link, learners vote, results animate live.",
    stack: ["React", "Firebase", "Real-time"],
    features: [
      "Single-choice, multi-choice, ranking, and word-cloud modes",
      "Anonymous voting",
      "Export results to CSV",
    ],
  },
  {
    slug: "mindmaps",
    name: "Mind Maps",
    category: "Interactive Classroom",
    description: "Branching mind-map editor for brainstorming and curriculum planning.",
    stack: ["React", "SVG", "Real-time"],
    features: [
      "Drag-to-add child nodes",
      "Colour-coded branches",
      "Export to PNG / PDF / Markdown outline",
    ],
  },
  {
    slug: "spinning-wheel",
    name: "Spinning Wheel",
    category: "Interactive Classroom",
    description: "Random-selection wheel for cold-calling, fair allocation, or gamified breaks.",
    repo: "spinning-wheel",
    stack: ["JavaScript", "Canvas", "Web Audio"],
    features: [
      "Custom labels with weighted probability",
      "Sound + confetti on selection",
      "Mark-as-used so picks are non-repeating",
    ],
  },

  // Problem Solving
  {
    slug: "five-whys",
    name: "5 Whys",
    category: "Problem Solving",
    description: "Root-cause analysis framework — drill from symptom to systemic cause in five linked questions.",
    stack: ["React", "Print-ready export"],
    features: [
      "Structured 5-Whys form",
      "Save / share analysis sessions",
      "Export the chain as PDF",
    ],
  },
  {
    slug: "fishbone-diagram",
    name: "Fishbone Diagram",
    category: "Problem Solving",
    description: "Ishikawa cause-and-effect diagram editor — categorise root causes across People / Process / Tech / Environment.",
    stack: ["React", "SVG"],
    features: [
      "Customisable cause categories",
      "Drag-and-drop bones and sub-causes",
      "Export PNG / SVG / PDF",
    ],
  },
  {
    slug: "pareto-chart",
    name: "Pareto Chart",
    category: "Problem Solving",
    description: "ABC / 80-20 analysis visualiser — paste in counts, get the cumulative-% Pareto chart instantly.",
    repo: "paretochart",
    stack: ["Streamlit", "Pandas", "Plotly"],
    features: [
      "Paste-in or CSV-upload input",
      "Cumulative % overlay + 80% guide line",
      "Export chart + ranked table",
    ],
  },
  {
    slug: "system-thinking",
    name: "System Thinking",
    category: "Problem Solving",
    description: "Causal-loop diagram editor for systems thinking — model reinforcing and balancing loops.",
    repo: "systemloop",
    stack: ["React", "SVG"],
    features: [
      "Reinforcing + balancing loop notation",
      "Snapshot loops for facilitation",
      "Export to PNG / PDF",
    ],
  },

  // Cyber Security
  {
    slug: "cyberlabs",
    name: "CyberLabs",
    category: "Cyber Security",
    description: "Browser-based cybersecurity simulation environment — run 10+ attack scenarios safely in a sandbox.",
    repo: "cybersecuritysimulator",
    demoUrl: "https://alfredang.github.io/cybersecuritysimulator/",
    stack: ["JavaScript", "Browser sandbox"],
    features: [
      "10 common attack-and-defence scenarios",
      "No setup — runs entirely in the browser",
      "Trainer view of learner attempts",
    ],
  },
  {
    slug: "hacklabs",
    name: "HackLabs",
    category: "Cyber Security",
    description: "Ethical hacking practical-exercises lab — 11 scenario-based exercises for hands-on red-team training.",
    repo: "ethnicalhacking",
    demoUrl: "https://alfredang.github.io/ethnicalhacking/",
    stack: ["JavaScript", "Browser sandbox"],
    features: [
      "11 ethical-hacking scenarios",
      "Step-by-step guided attack flow",
      "Browser-only — zero risk to real systems",
    ],
  },
  {
    slug: "pentest-fauxbank",
    name: "Pentest (FauxBank)",
    category: "Cyber Security",
    description: "Banking cybersecurity pentest lab — fictional bank with realistic vulnerabilities for safe practitioner training.",
    repo: "pentest",
    demoUrl: "https://pentest-fauxbank.vercel.app",
    stack: ["Next.js", "Vercel", "Realistic vulns"],
    features: [
      "Realistic banking web app with known vulns",
      "Walk-through guides + free-form mode",
      "Safe, isolated environment",
    ],
  },

  // Data Analytics
  {
    slug: "pivot-visualization",
    name: "Pivot Visualization",
    category: "Data Analytics",
    description: "Upload a CSV, build pivot tables in the browser, and chart aggregates — no Excel needed.",
    stack: ["Streamlit", "Pandas"],
    features: [
      "Drag-and-drop dimensions + measures",
      "Chart on top of the pivot",
      "Export pivot + chart to PNG / CSV",
    ],
  },
  {
    slug: "anomaly-detection",
    name: "Anomaly Detection",
    category: "Data Analytics",
    description: "Statistical anomaly identifier for operational data — z-score / IQR / isolation-forest in one UI.",
    stack: ["Streamlit", "scikit-learn", "Pandas"],
    features: [
      "Multiple algorithms side-by-side",
      "Tunable thresholds",
      "Annotated chart of flagged points",
    ],
  },
  {
    slug: "factor-analysis",
    name: "Factor Analysis",
    category: "Data Analytics",
    description: "Multifactor statistical analysis tool — eigenvalues, scree plot, loadings, rotation.",
    repo: "mfa",
    stack: ["Streamlit", "Pandas", "FactorAnalyzer"],
    features: [
      "Upload CSV + select variables",
      "Bartlett / KMO sphericity tests",
      "Varimax / oblimin rotation options",
    ],
  },
  {
    slug: "ml-classification",
    name: "ML Classification",
    category: "Data Analytics",
    description: "Train and evaluate classification models in the browser — logistic regression, random forest, gradient boosting.",
    repo: "mlclustering",
    demoUrl: "https://mlclustering-888.streamlit.app/",
    stack: ["Streamlit", "scikit-learn", "Pandas"],
    features: [
      "Side-by-side model comparison",
      "Confusion matrix + ROC curve",
      "Export trained model as pickle",
    ],
  },
  {
    slug: "mock-data-generator",
    name: "Mock Data Generator",
    category: "Data Analytics",
    description: "Generate realistic test datasets — names, addresses, financial figures, time series — straight to CSV.",
    stack: ["Python", "Faker"],
    features: [
      "Pick schema from templates or build custom",
      "Locale-aware (Singapore profiles)",
      "Download as CSV / JSON / Parquet",
    ],
  },

  // Finance
  {
    slug: "tax-calculator",
    name: "Tax Calculator",
    category: "Finance",
    description: "Singapore tax computation — personal and corporate brackets with deductions and reliefs.",
    repo: "novataxsg",
    stack: ["JavaScript", "SG tax brackets"],
    features: [
      "YA 2026 brackets + reliefs",
      "Side-by-side scenario comparison",
      "Shareable computation link",
    ],
  },
  {
    slug: "financial-planning-analysis",
    name: "Financial Planning & Analysis",
    category: "Finance",
    description: "Lightweight FP&A modelling — budgets, forecasts, variance, scenarios.",
    stack: ["Streamlit", "Pandas"],
    features: [
      "Roll-up budgets across cost centres",
      "Driver-based forecasting",
      "Export variance report to PDF",
    ],
  },
  {
    slug: "financial-ratio-calculators",
    name: "Financial Ratio Calculators",
    category: "Finance",
    description: "Compute liquidity, profitability, leverage, and efficiency ratios from a P&L + balance sheet.",
    stack: ["JavaScript", "SG SFRS"],
    features: [
      "Standard ratio set (current, quick, debt-to-equity, ROA, ROE…)",
      "Year-on-year comparison",
      "Industry-benchmark presets",
    ],
  },
  {
    slug: "financial-trend-analysis",
    name: "Financial Trend Analysis",
    category: "Finance",
    description: "Upload financial statements (CSV/Excel), surface trends, ratios, and anomalies in one click.",
    repo: "financialtrend",
    demoUrl: "https://alfredang.github.io/financialtrend/?demo=1",
    stack: ["JavaScript", "Browser-only"],
    features: [
      "Zero-build, runs entirely client-side",
      "Trend + ratio + anomaly views",
      "Demo dataset included",
    ],
  },
  {
    slug: "credit-loan-analysis",
    name: "Credit Loan Analysis",
    category: "Finance",
    description: "Per-loan Expected Loss, Lifetime ECL, and portfolio risk indicators for retail/SME lending.",
    repo: "loancreditanalysi",
    demoUrl: "https://creditloananalysis.streamlit.app/",
    stack: ["Streamlit", "Pandas"],
    features: [
      "Per-loan EL / LGD / PD",
      "Lifetime ECL roll-forward",
      "Portfolio concentration warnings",
    ],
  },

  // Statistics & SPC
  {
    slug: "novastats",
    name: "NovaStats",
    category: "Statistics & SPC",
    description: "Descriptive, correlation, regression, hypothesis, chi-square, and ANOVA in a single browser tool.",
    repo: "novastats",
    demoUrl: "https://alfredang.github.io/novastats/",
    stack: ["JavaScript", "Browser-only"],
    features: [
      "Six statistical workflows in one UI",
      "Paste-in data — no upload needed",
      "Plain-language interpretation alongside output",
    ],
  },
  {
    slug: "novadoe",
    name: "NovaDOE",
    category: "Statistics & SPC",
    description: "Design of Experiments suite — full + fractional factorial, Taguchi, central composite, Box-Behnken, Plackett-Burman, Latin square, response surface.",
    stack: ["JavaScript", "Browser-only"],
    features: [
      "Eight DOE methodologies",
      "Auto-generated run sheet",
      "Response-surface contour plotting",
    ],
  },
  {
    slug: "novaspc",
    name: "NovaSPC",
    category: "Statistics & SPC",
    description: "Statistical Process Control — c, u, np, p, X-mR, X̄-R, X̄-s control charts plus capability and distribution analysis.",
    repo: "novaspc",
    stack: ["JavaScript", "Browser-only"],
    features: [
      "Seven control-chart types",
      "Process capability (Cp, Cpk, Pp, Ppk)",
      "Distribution-fit testing",
    ],
  },

  // Sustainability
  {
    slug: "carbon-footprint-calculator",
    name: "Carbon Footprint Calculator",
    category: "Sustainability",
    description: "Singapore-specific carbon-emissions tracker for organisations — Scope 1, 2, and select Scope 3 categories.",
    repo: "sgcarboncalculator",
    stack: ["JavaScript", "SG grid factors"],
    features: [
      "Singapore-aligned emission factors",
      "Scope 1 / 2 / 3 (partial) input",
      "Export GHG report to PDF",
    ],
  },

  // Blockchain
  {
    slug: "certify-nft",
    name: "Certify NFT",
    category: "Blockchain",
    description: "Issue tamper-proof course certificates as NFTs — anchored to Ethereum, instantly verifiable.",
    repo: "singapore-cert-generator",
    stack: ["Solidity", "Ethereum", "OpenCerts"],
    features: [
      "Batch issuance from learner CSV",
      "Public verification page",
      "Revocation registry",
    ],
  },
  {
    slug: "supply-verify",
    name: "Supply Verify",
    category: "Blockchain",
    description: "Blockchain-anchored supply-chain product identification — provenance, custody, and authenticity in one ledger.",
    repo: "supplyverify",
    demoUrl: "https://alfredang.github.io/supplyverify/",
    stack: ["Solidity", "Ethereum"],
    features: [
      "Mint product identifiers on-chain",
      "Chain-of-custody event log",
      "Consumer-facing verification page",
    ],
  },
];

export function getEdToolBySlug(slug: string): EdTool | undefined {
  return EDTOOLS.find((t) => t.slug === slug);
}

export function getEdToolsGrouped(): Record<EdToolCategory, EdTool[]> {
  const out: Record<EdToolCategory, EdTool[]> = {
    "Interactive Classroom": [],
    "Problem Solving": [],
    "Cyber Security": [],
    "Data Analytics": [],
    Finance: [],
    "Statistics & SPC": [],
    Sustainability: [],
    Blockchain: [],
  };
  for (const t of EDTOOLS) out[t.category].push(t);
  return out;
}
