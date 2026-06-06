import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-amber-100 bg-cream/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 font-fun text-xl font-700 text-slate-800">
          <span className="text-2xl" aria-hidden>🤖</span>
          <span>
            AI <span className="text-coral">Kids</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 font-fun font-500 text-slate-600 md:flex">
          <Link href="/programs" className="transition hover:text-coral">Programs</Link>
          <Link href="/#how" className="transition hover:text-coral">How it works</Link>
          <Link href="/#ages" className="transition hover:text-coral">Ages 4–16</Link>
          <Link href="/contact" className="transition hover:text-coral">Contact</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/login"
            className="rounded-full px-4 py-2 font-fun font-600 text-slate-600 transition hover:bg-amber-100"
          >
            Log in
          </Link>
          <Link
            href="/programs"
            className="rounded-full bg-coral px-4 py-2 font-fun font-700 text-white shadow-md shadow-coral/30 transition hover:scale-105"
          >
            Book a class
          </Link>
        </div>
      </div>
    </header>
  );
}
