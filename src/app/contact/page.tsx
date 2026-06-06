import type { Metadata } from "next";
import { Container } from "@/components/layout/Container";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { ContactForm } from "@/components/sections/ContactForm";
import { HiMapPin, HiEnvelope, HiPhone, HiClock } from "react-icons/hi2";
import { FaWhatsapp } from "react-icons/fa";
import { getCompanyContact, getSiteBrand } from "@/lib/site-settings";

export const metadata: Metadata = {
  title: "Contact Us",
  description:
    "Get in touch with Tertiary Infotech Academy — Singapore-based AI-LMS-TMS and SSG ATO consultancy. Phone, email, WhatsApp, and Google Map.",
  keywords:
    "contact Tertiary Infotech Academy, SSG ATO consultancy Singapore, LMS TMS Singapore, Woodlands training provider",
  alternates: { canonical: "/contact" },
  openGraph: {
    type: "website",
    url: "/contact",
    title: "Contact Us — Tertiary Infotech Academy",
    description:
      "Reach Tertiary Infotech Academy by phone, email, WhatsApp. Located in Singapore — Woods Square, Woodlands.",
    locale: "en_SG",
    siteName: "Tertiary Infotech Academy",
    images: [{ url: "/icon-192.png", width: 192, height: 192, alt: "Tertiary Infotech Academy" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Contact Us — Tertiary Infotech Academy",
    description:
      "Reach Tertiary Infotech Academy by phone, email, WhatsApp. Singapore-based.",
    images: ["/icon-192.png"],
  },
};

function formatPhone(raw: string): string {
  const d = raw.replace(/[^\d+]/g, "");
  const m = /^(\+\d{2})(\d{4})(\d+)$/.exec(d);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : raw;
}

function formatWhatsapp(d: string): string {
  const m = /^(\d{2})(\d{4})(\d+)$/.exec(d);
  return m ? `+${m[1]} ${m[2]} ${m[3]}` : `+${d}`;
}

export default async function ContactPage() {
  const [brand, contact] = await Promise.all([getSiteBrand(), getCompanyContact()]);
  const addressQuery = encodeURIComponent(`${brand.fullName}, ${contact.address}`);
  const SITE_URL = "https://www.tertiaryinfotech.com";
  const localBusinessLd = {
    "@context": "https://schema.org",
    "@type": "LocalBusiness",
    "@id": `${SITE_URL}/contact`,
    name: brand.fullName,
    image: brand.logoUrl ? new URL(brand.logoUrl, SITE_URL).toString() : `${SITE_URL}/favicon.ico`,
    url: SITE_URL,
    telephone: contact.tel,
    email: contact.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: contact.address,
      addressCountry: "SG",
    },
    openingHoursSpecification: [
      {
        "@type": "OpeningHoursSpecification",
        dayOfWeek: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        opens: "09:00",
        closes: "18:00",
      },
    ],
  };
  const breadcrumbLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Contact", item: `${SITE_URL}/contact` },
    ],
  };
  return (
    <>
      <Navbar />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(localBusinessLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      <main className="pt-16">
        <section className="py-10">
          <Container>
            <div className="max-w-3xl mb-10">
              <div className="kicker mb-4">[ CONTACT ]</div>
              <h1 className="font-display text-[clamp(2rem,4.5vw,3.25rem)] font-extrabold leading-[1.05]">
                Let&apos;s build something <span className="gradient-text">together</span>.
              </h1>
              <p className="mt-5 text-(--color-muted) text-lg">
                Reach out for a demo, a quote, or a quick conversation. We reply
                within one business day.
              </p>
            </div>

            <div className="grid lg:grid-cols-[1fr_1.2fr] gap-8 mb-12">
              <div className="glass p-7 rounded-2xl space-y-5">
                <div className="flex items-start gap-3">
                  <HiMapPin className="w-5 h-5 mt-0.5 shrink-0 text-(--color-cyan)" />
                  <div>
                    <div className="font-display font-bold text-white mb-1">{brand.fullName}</div>
                    <div className="text-sm text-(--color-muted) leading-relaxed">{contact.address}</div>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <HiPhone className="w-5 h-5 mt-0.5 shrink-0 text-(--color-cyan)" />
                  <div className="text-sm">
                    <a
                      href={`tel:${contact.tel.replace(/\s+/g, "")}`}
                      className="text-white hover:text-(--color-cyan) transition block"
                    >
                      {formatPhone(contact.tel)}
                    </a>
                  </div>
                </div>

                {contact.whatsapp && (
                  <div className="flex items-start gap-3">
                    <FaWhatsapp className="w-5 h-5 mt-0.5 shrink-0 text-(--color-cyan)" />
                    <a
                      href={`https://wa.me/${contact.whatsapp}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-white hover:text-(--color-cyan) transition"
                    >
                      {formatWhatsapp(contact.whatsapp)} (WhatsApp)
                    </a>
                  </div>
                )}

                <div className="flex items-start gap-3">
                  <HiEnvelope className="w-5 h-5 mt-0.5 shrink-0 text-(--color-cyan)" />
                  <a
                    href={`mailto:${contact.supportEmail || contact.email}`}
                    className="text-sm text-white hover:text-(--color-cyan) transition"
                  >
                    {contact.supportEmail || contact.email}
                  </a>
                </div>

                <div className="flex items-start gap-3">
                  <HiClock className="w-5 h-5 mt-0.5 shrink-0 text-(--color-cyan)" />
                  <div className="text-sm text-(--color-muted)">
                    Mon – Fri · 9:00 am – 6:00 pm
                    <br />
                    Closed on weekends &amp; public holidays
                  </div>
                </div>

                {brand.uen && (
                  <div className="pt-2 text-xs text-(--color-muted) font-mono">UEN {brand.uen}</div>
                )}
              </div>

              <div className="relative rounded-2xl overflow-hidden border border-white/10 min-h-[400px]">
                <iframe
                  title="Tertiary Infotech location"
                  src={`https://www.google.com/maps?q=${addressQuery}&output=embed`}
                  width="100%"
                  height="100%"
                  style={{ border: 0, position: "absolute", inset: 0 }}
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
            </div>
          </Container>
        </section>

        <ContactForm />
      </main>
      <Footer />
    </>
  );
}
