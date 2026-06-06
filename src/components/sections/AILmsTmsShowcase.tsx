import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { AI_LMS_TMS_FEATURES } from "@/lib/site-content";
import { HiCheckCircle, HiCpuChip } from "react-icons/hi2";

export function AILmsTmsShowcase() {
  return (
    <section id="ai-lms-tms" className="relative pt-4 pb-6 overflow-hidden">
      <div className="glow-blob" style={{ bottom: "-20%", left: "30%", width: 600, height: 600, background: "radial-gradient(circle, #5C00E5 0%, transparent 70%)", opacity: 0.35 }} />
      <Container className="relative">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-14 items-center">
          <div>
            <div className="kicker mb-5">[ FLAGSHIP PRODUCT ]</div>
            <h2 className="font-display text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold leading-[1.05]">
              AI-powered integrated <span className="gradient-text">LMS &amp; TMS</span>{" "}
              for WSQ training providers.
            </h2>
            <p className="mt-6 text-(--color-muted) text-lg max-w-xl">
              One platform for course delivery, learner tracking, attendance, certification, and
              audit-ready reporting — supercharged by AI for course creation, marking, and
              learner support.
            </p>
            <ul className="mt-8 space-y-3.5">
              {AI_LMS_TMS_FEATURES.map((f) => (
                <li key={f} className="flex gap-3">
                  <HiCheckCircle className="text-(--color-cyan) shrink-0 mt-1 w-5 h-5" />
                  <span className="text-white/85">{f}</span>
                </li>
              ))}
            </ul>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link href="#contact" className="btn-primary">Request a demo</Link>
              <Link href="/real-clients" className="btn-secondary">Real Clients</Link>
              <Link
                href="https://github.com/alfredang/AI-LMS-TMS"
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
            <div className="relative glass p-8 overflow-hidden">
              <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-(--color-cyan) to-transparent" />
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-(--color-purple) to-(--color-cyan) flex items-center justify-center">
                  <HiCpuChip className="text-white w-5 h-5" />
                </div>
                <div>
                  <div className="kicker">[ INTEGRATIONS ]</div>
                  <div className="font-display font-bold text-lg">Ready on day one</div>
                </div>
              </div>
              <div className="space-y-3">
                {[
                  { label: "WSQ + TPQA", desc: "Compliant submission & audit trails" },
                  { label: "SSG API", desc: "TPGateway, MySkillsFuture, attendance" },
                  { label: "50+ EdTools", desc: "Flashcard, Padlet, Whiteboard, Live Q&A…", href: "/edtools" },
                  { label: "Google Meet · Zoom · Teams", desc: "Native live-class integration" },
                  { label: "Auto Enrolment + Invoicing", desc: "SkillsFuture claim workflows" },
                  { label: "Claude Code Agent", desc: "Authoring, marking, learner support" },
                ].map((item) => {
                  const inner = (
                    <>
                      <div>
                        <div className="font-display font-bold text-white">{item.label}</div>
                        <div className="text-xs text-(--color-muted) mt-0.5">{item.desc}</div>
                      </div>
                      <span className="text-(--color-green) font-mono text-xs whitespace-nowrap">
                        {item.href ? "Browse →" : "✓ READY"}
                      </span>
                    </>
                  );
                  const classes =
                    "flex items-center justify-between gap-3 px-4 py-3 rounded-lg bg-white/3 border border-white/8 hover:border-(--color-cyan)/40 transition";
                  return item.href ? (
                    <Link key={item.label} href={item.href} className={`${classes} cursor-pointer`}>
                      {inner}
                    </Link>
                  ) : (
                    <div key={item.label} className={classes}>
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
