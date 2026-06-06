import Link from "next/link";
import { db } from "@/db";
import { menus, menuItems } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { Container } from "./Container";
import { MobileMenu } from "./MobileMenu";
import { getSiteBrand, getCompanyContact } from "@/lib/site-settings";
import { FaWhatsapp } from "react-icons/fa6";
import { HiPhone } from "react-icons/hi2";

async function loadMenu() {
  try {
    const [menu] = await db.select().from(menus).where(eq(menus.location, "header")).limit(1);
    if (!menu) return [];
    return db.select().from(menuItems).where(eq(menuItems.menuId, menu.id)).orderBy(asc(menuItems.sortOrder));
  } catch {
    return [];
  }
}

const FALLBACK = [
  { label: "Home", href: "/" },
  { label: "SSG Services", href: "/#ssg-services" },
  { label: "AI Services", href: "/#ai-services" },
  { label: "AI Chatbots", href: "/ai-chatbot-portfolio" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export async function Navbar() {
  const [items, brand, contact] = await Promise.all([
    loadMenu(),
    getSiteBrand(),
    getCompanyContact(),
  ]);
  const links = items.length > 0 ? items : FALLBACK;

  return (
    <header className="sticky top-0 z-50 backdrop-blur-xl bg-(--color-bg)/75 border-b border-(--color-border) relative">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          {brand.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={brand.logoUrl}
              alt={brand.shortName}
              className="w-9 h-9 rounded-md object-contain"
            />
          ) : (
            <span className="w-7 h-7 rounded-md bg-gradient-to-br from-(--color-purple) to-(--color-cyan) shadow-[var(--shadow-glow-cyan)] grid place-items-center text-xs font-mono font-bold">TI</span>
          )}
          <span className="font-display font-bold text-lg tracking-tight">{brand.shortName}</span>
        </Link>
        <nav className="hidden md:flex items-center gap-1">
          {links.map((l) => (
            <Link
              key={l.href + l.label}
              href={l.href}
              target={"openInNewTab" in l && l.openInNewTab ? "_blank" : undefined}
              className="px-3 py-2 text-sm text-white/80 hover:text-white hover:bg-white/5 rounded-md transition"
            >
              {l.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/#contact"
          className="hidden md:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-(--color-cyan)/40 text-sm text-(--color-cyan) hover:bg-(--color-cyan)/10 transition"
        >
          Get a quote
          <span aria-hidden>→</span>
        </Link>

        {/* Mobile quick-actions: phone + WhatsApp icons next to the burger */}
        <div className="md:hidden flex items-center gap-1">
          {contact.tel && (
            <a
              href={`tel:${contact.tel.replace(/\s+/g, "")}`}
              aria-label="Call us"
              className="w-9 h-9 inline-flex items-center justify-center rounded-md text-(--color-cyan) hover:bg-white/5 transition"
            >
              <HiPhone className="w-5 h-5" />
            </a>
          )}
          {contact.whatsapp && (
            <a
              href={`https://wa.me/${contact.whatsapp}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="WhatsApp"
              className="w-9 h-9 inline-flex items-center justify-center rounded-md text-(--color-green) hover:bg-white/5 transition"
            >
              <FaWhatsapp className="w-5 h-5" />
            </a>
          )}
        </div>

        <MobileMenu
          links={links.map((l) => ({
            label: l.label,
            href: l.href,
            openInNewTab: "openInNewTab" in l ? Boolean(l.openInNewTab) : false,
          }))}
        />
      </Container>
    </header>
  );
}
