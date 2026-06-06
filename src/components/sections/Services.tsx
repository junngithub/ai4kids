import Link from "next/link";
import { Container } from "@/components/layout/Container";
import { SERVICES } from "@/lib/site-content";
import { getHomepageCopy } from "@/lib/site-settings";
import { HiArrowRight } from "react-icons/hi2";

const accentMap: Record<string, { glow: string; text: string; line: string }> = {
  blue: {
    glow: "rgba(89,235,253,0.35)",
    text: "text-(--color-cyan)",
    line: "from-(--color-cyan) to-transparent",
  },
  cyan: {
    glow: "rgba(1,201,130,0.35)",
    text: "text-(--color-green)",
    line: "from-(--color-green) to-transparent",
  },
  purple: {
    glow: "rgba(92,0,229,0.45)",
    text: "text-(--color-purple-light)",
    line: "from-(--color-purple) to-transparent",
  },
};

type Service = (typeof SERVICES)[number];

function ServiceCard({ s }: { s: Service }) {
  const Icon = s.icon;
  const a = accentMap[s.accent];
  const href = "href" in s ? (s.href as string | undefined) : undefined;
  const learnMore = (
    <span
      className={`inline-flex items-center gap-2 text-sm font-mono ${a.text} ${
        href ? "group-hover:gap-3 transition-all" : ""
      }`}
    >
      Learn more <HiArrowRight className="w-3.5 h-3.5" />
    </span>
  );
  return (
    <article key={s.id} className="card-hover glass p-7 relative overflow-hidden group">
      <div className={`absolute top-0 inset-x-0 h-px bg-gradient-to-r ${a.line}`} />
      <div
        className="absolute -top-12 -right-12 w-40 h-40 rounded-full opacity-0 group-hover:opacity-60 transition duration-500"
        style={{ background: `radial-gradient(circle, ${a.glow} 0%, transparent 70%)` }}
      />
      <Icon className={`w-9 h-9 ${a.text} mb-5`} />
      <h3 className="font-display font-bold text-xl text-white mb-3">{s.title}</h3>
      <p className="text-sm text-(--color-muted) mb-5 leading-relaxed">{s.description}</p>
      <ul className="space-y-2 mb-6">
        {s.features.map((f) => (
          <li key={f} className="text-sm text-white/80 flex gap-2.5">
            <span className={`${a.text} font-mono mt-0.5`}>▸</span>
            <span>{f}</span>
          </li>
        ))}
      </ul>
      {href ? (
        <Link
          href={href}
          aria-label={`Learn more about ${s.title}`}
          className="absolute inset-0"
        >
          <span className="sr-only">Learn more about {s.title}</span>
        </Link>
      ) : null}
      {learnMore}
    </article>
  );
}

export async function Services() {
  const copy = await getHomepageCopy();
  const ssg = SERVICES.filter((s) => "category" in s && s.category === "ssg");
  const ai = SERVICES.filter((s) => "category" in s && s.category === "ai");

  return (
    <>
      {/* SSG Services — rendered first */}
      <section id="ssg-services" className="relative py-4 scroll-mt-20">
        <Container>
          <div className="max-w-5xl mb-8 ml-auto text-right">
            <div className="kicker mb-4">{copy.ssgKicker}</div>
            <h2
              className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05]"
              dangerouslySetInnerHTML={{ __html: copy.ssgHeadlineHtml }}
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {ssg.map((s) => (
              <ServiceCard key={s.id} s={s} />
            ))}
          </div>
        </Container>
      </section>

      {/* AI Services — rendered below */}
      <section id="ai-services" className="relative py-10 scroll-mt-20">
        <Container>
          <div className="max-w-5xl mb-8">
            <div className="kicker mb-4">{copy.aiKicker}</div>
            <h2
              className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05]"
              dangerouslySetInnerHTML={{ __html: copy.aiHeadlineHtml }}
            />
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            {ai.map((s) => (
              <ServiceCard key={s.id} s={s} />
            ))}
          </div>
        </Container>
      </section>

      {/* Keep the old #services anchor working for legacy links. */}
      <span id="services" className="sr-only" aria-hidden />
    </>
  );
}
