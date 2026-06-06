import "./globals.css";
import type { Metadata } from "next";
import {
  Inter,
  Exo_2,
  JetBrains_Mono,
  Fredoka,
  Nunito,
} from "next/font/google";
import { WhatsAppButton } from "@/components/ui/WhatsAppButton";
import { getWhatsAppNumber } from "@/lib/portal-settings";

// Admin/blog (inherited) typography
const inter = Inter({ subsets: ["latin"], variable: "--font-sans-import", display: "swap" });
const exo2 = Exo_2({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-display-import",
  display: "swap",
});
const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono-import",
  display: "swap",
});
// Playful kids/public typography
const fredoka = Fredoka({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-fun-import",
  display: "swap",
});
const nunito = Nunito({
  subsets: ["latin"],
  weight: ["400", "600", "700", "800"],
  variable: "--font-round-import",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3080";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AI Kids Academy — Fun AI Learning for Ages 4–16",
    template: "%s | AI Kids Academy",
  },
  description:
    "Where kids learn AI by making things — AI storytelling, coding, game design, phonics, escape rooms and free games. Live classes + a gamified learning playground for ages 4–16.",
  keywords:
    "AI for kids, kids coding Singapore, AI storytelling for children, kids game development, AI phonics, coding classes for kids, STEM enrichment Singapore",
  openGraph: {
    type: "website",
    siteName: "AI Kids Academy",
    locale: "en_SG",
    url: SITE_URL,
  },
  robots: { index: true, follow: true },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const whatsapp = await getWhatsAppNumber().catch(() => null);

  return (
    <html
      lang="en"
      className={`${inter.variable} ${exo2.variable} ${mono.variable} ${fredoka.variable} ${nunito.variable}`}
    >
      <body className="min-h-screen antialiased font-round text-slate-800">
        {children}
        {whatsapp ? <WhatsAppButton number={whatsapp} /> : null}
      </body>
    </html>
  );
}
