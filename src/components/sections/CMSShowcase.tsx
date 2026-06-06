import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { HiCheckCircle, HiCpuChip } from "react-icons/hi2";

const FEATURES: string[] = [
  "TipTap rich editor — image upload, slash commands, alt text, draft / published / archived",
  "Pages + Posts CRUD with Categories, Tags, and per-route SEO meta",
  "Filterable + paginated admin tables — search, status filter, color-coded status pills",
  "Visual drag-and-drop menu builder — header + footer menus, DB-driven, no code",
  "AI-assisted Blog and Pages drafting — Claude generates full posts and pages on demand",
  "Lead inbox — every contact-form submission emails sales via Gmail OAuth2",
  "AI chatbot — Claude Agent SDK on your subscription OAuth token",
  "Admin AI Assist — Draft, Rewrite, Summarize, Suggest SEO meta (one click)",
];

const READY_ITEMS: Array<{ label: string; desc: string; href?: string }> = [
  { label: "TipTap Editor", desc: "Rich text · images · slash commands · drafts" },
  { label: "Claude AI Assist", desc: "Draft posts · summarize · SEO meta — one click" },
  { label: "AI Chatbot", desc: "Configurable system prompt + FAQ · OAuth token", href: "/ai-chatbot-portfolio" },
  { label: "Lead Capture", desc: "Contact form → admin inbox + Gmail OAuth2 email" },
  { label: "Encrypted Vault", desc: "AES-256-GCM secrets · never returned to browser" },
  { label: "SEO Built-In", desc: "Per-route metadata · JSON-LD · sitemap · canonical · OG" },
  { label: "WP Migration", desc: "Import SQL dump · rewrite images · 301 redirects" },
];

export function CMSShowcase() {
  return (
    <section id="cms" className="relative py-4 overflow-hidden">
      <div
        className="glow-blob"
        style={{
          top: "-15%",
          left: "10%",
          width: 560,
          height: 560,
          background: "radial-gradient(circle, #5C00E5 0%, transparent 70%)",
          opacity: 0.28,
        }}
      />
      <Container className="relative">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-start">
          <div>
            <div className="kicker mb-5">[ AI-POWERED CMS ]</div>
            <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold leading-[1.05]">
              AI-powered{" "}
              <span className="gradient-text">CMS for organizations</span>.
            </h2>
            <p className="mt-6 text-(--color-muted) text-lg max-w-xl">
              A self-hosted, production-grade CMS platform on Next.js 16, Postgres and
              Drizzle. Bring your Claude subscription OAuth token and get a AI chatbot,
              AI authoring, and a TipTap editor.
            </p>
            <p className="mt-5 font-display font-bold text-xl max-w-xl">
              <span className="gradient-text-warm">
                No recurring cost, No vendor lock-in, Fully Customizable.
              </span>
            </p>
            <ul className="mt-8 space-y-2.5">
              {FEATURES.map((f) => (
                <li key={f} className="flex gap-3 text-sm">
                  <HiCheckCircle className="text-(--color-cyan) shrink-0 mt-0.5 w-5 h-5" />
                  <span className="text-white/85">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="#contact" className="btn-primary">
                Request a demo
              </Link>
              <Link
                href="https://github.com/alfredang/ai-cms"
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View on GitHub →
              </Link>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-(--color-purple)/30 via-transparent to-(--color-cyan)/20 blur-2xl" />
            <div className="relative glass p-6 sm:p-8 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-(--color-cyan) to-transparent" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-(--color-purple) to-(--color-cyan) flex items-center justify-center">
                  <HiCpuChip className="text-white w-5 h-5" />
                </div>
                <div>
                  <div className="kicker">[ PLATFORM PILLARS ]</div>
                  <div className="font-display font-bold text-lg">
                    AI-Powered CMS
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {READY_ITEMS.map((item) => {
                  const inner = (
                    <>
                      <div>
                        <div className="font-display font-bold text-white">{item.label}</div>
                        <div className="text-xs text-(--color-muted) mt-0.5">{item.desc}</div>
                      </div>
                      <span className="text-(--color-green) font-mono text-xs whitespace-nowrap">
                        ✓ READY
                      </span>
                    </>
                  );
                  const cls =
                    "flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-white/3 border border-white/8 hover:border-(--color-cyan)/40 transition";
                  return item.href ? (
                    <Link key={item.label} href={item.href} className={cls}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={item.label} className={cls}>
                      {inner}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
