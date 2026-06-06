import Link from "next/link";
import {
  HiMagnifyingGlass,
  HiChatBubbleLeftRight,
  HiDocumentText,
  HiRocketLaunch,
  HiCheckBadge,
} from "react-icons/hi2";
import { Container } from "@/components/layout/Container";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ServiceLeadForm } from "@/components/sections/ServiceLeadForm";
import type { ServicePageContent, TimelineStep } from "@/lib/service-pages";

const STEP_ICONS = [
  HiMagnifyingGlass, // Discovery
  HiChatBubbleLeftRight, // Workshop / Consultation
  HiDocumentText, // Quotation
  HiRocketLaunch, // Build / Migrate
  HiCheckBadge, // Go Live / Outcome
];

const STEP_ACCENT: Record<NonNullable<TimelineStep["accent"]>, { ring: string; iconText: string; chip: string; line: string }> = {
  cyan: {
    ring: "border-(--color-cyan)/40",
    iconText: "text-(--color-cyan)",
    chip: "bg-(--color-cyan)/10 text-(--color-cyan)",
    line: "from-(--color-cyan)",
  },
  blue: {
    ring: "border-(--color-cyan)/40",
    iconText: "text-(--color-cyan)",
    chip: "bg-(--color-cyan)/10 text-(--color-cyan)",
    line: "from-(--color-cyan)",
  },
  purple: {
    ring: "border-(--color-purple)/50",
    iconText: "text-(--color-purple-light)",
    chip: "bg-(--color-purple)/15 text-(--color-purple-light)",
    line: "from-(--color-purple)",
  },
  amber: {
    ring: "border-(--color-amber)/50",
    iconText: "text-(--color-amber)",
    chip: "bg-(--color-amber)/10 text-(--color-amber)",
    line: "from-(--color-amber)",
  },
  green: {
    ring: "border-(--color-green)/50",
    iconText: "text-(--color-green)",
    chip: "bg-(--color-green)/10 text-(--color-green)",
    line: "from-(--color-green)",
  },
};

/** Render a full service landing page from a ServicePageContent config. */
export function ServicePageTemplate({ content }: { content: ServicePageContent }) {
  const SITE_URL = "https://www.tertiaryinfotech.com";
  const pageUrl = `${SITE_URL}/${content.slug}`;

  const serviceLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    serviceType: content.serviceType,
    name: content.title,
    provider: {
      "@type": "Organization",
      name: "Tertiary Infotech Academy",
      url: SITE_URL,
    },
    areaServed: { "@type": "Country", name: "Singapore" },
    description: content.meta.description,
    url: pageUrl,
  };

  const faqLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Services", item: `${SITE_URL}/#services` },
      { "@type": "ListItem", position: 3, name: content.title, item: pageUrl },
    ],
  };

  return (
    <>
      <Navbar />
      <main>
        {/* Hero */}
        <section className="relative py-10 md:py-14 overflow-hidden">
          <div
            className="glow-blob"
            style={{
              top: "-10%",
              left: "-5%",
              width: 520,
              height: 520,
              background: "radial-gradient(circle, #5C00E5 0%, transparent 70%)",
            }}
          />
          <div
            className="glow-blob"
            style={{
              top: "20%",
              right: "-10%",
              width: 480,
              height: 480,
              background: "radial-gradient(circle, rgba(89,235,253,0.45) 0%, transparent 70%)",
            }}
          />
          <Container>
            <div className="grid lg:grid-cols-12 gap-8 items-start relative">
              <div className="lg:col-span-7">
                <div className="kicker mb-4">{content.hero.kicker}</div>
                <h1
                  className="font-display text-[clamp(2.25rem,5.2vw,3.75rem)] font-extrabold leading-[1.04] mb-5"
                  dangerouslySetInnerHTML={{ __html: content.hero.headlineHtml }}
                />
                <p className="text-(--color-muted) text-lg max-w-2xl mb-6">{content.hero.subhead}</p>
                <div className="flex flex-wrap gap-3">
                  <a href="#book" className="btn-primary">
                    Book a consultation →
                  </a>
                  <a
                    href="#whats-included"
                    className="inline-flex items-center gap-2 px-5 py-3 rounded-lg border border-white/15 text-white/85 hover:border-(--color-cyan)/50 hover:text-(--color-cyan) transition"
                  >
                    What's included
                  </a>
                </div>
              </div>
              <div className="lg:col-span-5 lg:sticky lg:top-24">
                <div id="book" className="scroll-mt-24">
                  <div className="kicker mb-3">[ START HERE ]</div>
                  <ServiceLeadForm
                    source={content.leadSource}
                    buttonLabel="Book my consultation →"
                    compact
                  />
                </div>
              </div>
            </div>
          </Container>
        </section>

        {/* Benefits */}
        <section className="relative py-10">
          <Container>
            <div className="max-w-3xl mb-8">
              <div className="kicker mb-3">[ WHY US ]</div>
              <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-tight">
                What you get with our <span className="gradient-text">{content.title}</span>.
              </h2>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {content.benefits.map((b) => (
                <div key={b.title} className="glass card-hover p-6 relative overflow-hidden">
                  <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-(--color-cyan) to-transparent" />
                  <h3 className="font-display font-bold text-lg mb-2">{b.title}</h3>
                  <p className="text-sm text-(--color-muted) leading-relaxed">{b.body}</p>
                </div>
              ))}
            </div>
          </Container>
        </section>

        {/* Timeline / process */}
        {content.timeline && content.timeline.length > 0 && (
          <section id="process" className="relative py-10 scroll-mt-20">
            <Container>
              <div className="max-w-3xl mb-10">
                <div className="kicker mb-3">[ OUR PROCESS ]</div>
                <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-tight">
                  {content.timeline.length}-step path to{" "}
                  <span className="gradient-text">{content.title}</span>.
                </h2>
                {content.processIntro && (
                  <p className="text-(--color-muted) mt-3">{content.processIntro}</p>
                )}
              </div>

              {/* Desktop horizontal timeline */}
              <div className="hidden lg:block relative">
                <div className="absolute top-12 left-0 right-0 h-px bg-gradient-to-r from-(--color-cyan)/60 via-(--color-purple)/60 to-(--color-green)/60" />
                <ol
                  className="grid relative gap-4"
                  style={{ gridTemplateColumns: `repeat(${content.timeline.length}, minmax(0,1fr))` }}
                >
                  {content.timeline.map((s, i) => {
                    const Icon = STEP_ICONS[i] ?? HiRocketLaunch;
                    const a = STEP_ACCENT[s.accent ?? "cyan"];
                    return (
                      <li key={`${s.title}-${i}`} className="relative">
                        <div
                          className={`relative z-10 mx-auto w-24 h-24 rounded-2xl glass border ${a.ring} flex items-center justify-center mb-5`}
                        >
                          <Icon className={`w-10 h-10 ${a.iconText}`} />
                          <span className="absolute -bottom-2 -right-2 w-7 h-7 rounded-full bg-(--color-bg) border border-white/15 text-xs font-mono flex items-center justify-center text-white/80">
                            {i + 1}
                          </span>
                        </div>
                        <div className="text-center">
                          {s.duration && (
                            <span
                              className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-mono ${a.chip} mb-2`}
                            >
                              {s.duration}
                            </span>
                          )}
                          <h3 className="font-display font-bold text-lg mb-2">{s.title}</h3>
                          <p className="text-sm text-(--color-muted) leading-relaxed">{s.body}</p>
                        </div>
                      </li>
                    );
                  })}
                </ol>
              </div>

              {/* Mobile vertical timeline */}
              <ol className="lg:hidden relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-gradient-to-b before:from-(--color-cyan)/60 before:via-(--color-purple)/60 before:to-(--color-green)/60">
                {content.timeline.map((s, i) => {
                  const Icon = STEP_ICONS[i] ?? HiRocketLaunch;
                  const a = STEP_ACCENT[s.accent ?? "cyan"];
                  return (
                    <li key={`${s.title}-${i}`} className="relative">
                      <div
                        className={`absolute -left-8 top-1 w-7 h-7 rounded-full glass border ${a.ring} flex items-center justify-center`}
                      >
                        <Icon className={`w-3.5 h-3.5 ${a.iconText}`} />
                      </div>
                      <div className="glass p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono ${a.chip}`}>
                            Step {i + 1}
                          </span>
                          {s.duration && (
                            <span className="text-[11px] font-mono text-(--color-muted)">
                              {s.duration}
                            </span>
                          )}
                        </div>
                        <h3 className="font-display font-bold text-base mb-1.5">{s.title}</h3>
                        <p className="text-sm text-(--color-muted) leading-relaxed">{s.body}</p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </Container>
          </section>
        )}

        {/* What's included */}
        <section id="whats-included" className="relative py-10 scroll-mt-20">
          <Container>
            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div>
                <div className="kicker mb-3">[ WHAT WE DELIVER ]</div>
                <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-tight mb-4">
                  Everything you need, <span className="gradient-text-warm">in one engagement</span>.
                </h2>
              </div>
              <ul className="space-y-3">
                {content.whatsIncluded.map((line) => (
                  <li key={line} className="flex gap-3">
                    <span className="text-(--color-green) font-mono mt-0.5">✓</span>
                    <span className="text-white/90">{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Container>
        </section>

        {/* FAQ */}
        <section className="relative py-10">
          <Container className="max-w-4xl">
            <div className="mb-8">
              <div className="kicker mb-3">[ FAQ ]</div>
              <h2 className="font-display text-[clamp(1.75rem,3.5vw,2.5rem)] font-extrabold leading-tight">
                Common questions about {content.title}.
              </h2>
            </div>
            <div className="space-y-3">
              {content.faq.map((f) => (
                <details
                  key={f.q}
                  className="glass p-5 group [&_summary::-webkit-details-marker]:hidden"
                >
                  <summary className="cursor-pointer flex justify-between items-center gap-4">
                    <span className="font-display font-semibold text-base text-white">{f.q}</span>
                    <span className="text-(--color-cyan) font-mono text-lg transition group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <p className="text-sm text-(--color-muted) leading-relaxed mt-3">{f.a}</p>
                </details>
              ))}
            </div>
          </Container>
        </section>

        {/* Final CTA */}
        <section className="relative py-10 overflow-hidden">
          <div
            className="glow-blob"
            style={{
              top: "10%",
              left: "0",
              width: 480,
              height: 480,
              background: "radial-gradient(circle, #5C00E5 0%, transparent 70%)",
            }}
          />
          <Container className="max-w-4xl relative">
            <div className="text-center mb-8">
              <div className="kicker mb-3">[ GET STARTED ]</div>
              <h2 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-extrabold leading-[1.05] mb-4">
                Ready to start? <span className="gradient-text">Talk to a consultant.</span>
              </h2>
              <p className="text-(--color-muted) text-lg">
                Free 30-minute consultation. We'll tell you what's realistic before you spend a
                dollar.
              </p>
            </div>
            <ServiceLeadForm source={content.leadSource} />
            <p className="mt-5 text-center text-xs text-(--color-muted) font-mono">
              [{" "}
              <Link href="/#services" className="hover:text-(--color-cyan)">
                See all services
              </Link>{" "}
              ]
            </p>
          </Container>
        </section>
      </main>
      <Footer />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(serviceLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
    </>
  );
}
