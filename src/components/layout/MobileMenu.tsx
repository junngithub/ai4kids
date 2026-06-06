"use client";

import Link from "next/link";
import { useState } from "react";

type MenuLink = {
  label: string;
  href: string;
  openInNewTab?: boolean | null;
};

export function MobileMenu({ links }: { links: MenuLink[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center justify-center w-10 h-10 rounded-md border border-(--color-border) bg-white/5 hover:bg-white/10 transition"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="pointer-events-none"
        >
          {open ? (
            <>
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="18" y1="6" x2="6" y2="18" />
            </>
          ) : (
            <>
              <line x1="4" y1="7" x2="20" y2="7" />
              <line x1="4" y1="12" x2="20" y2="12" />
              <line x1="4" y1="17" x2="20" y2="17" />
            </>
          )}
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-16 bg-(--color-bg) border-b border-(--color-border) shadow-lg">
          <nav className="flex flex-col p-4 gap-1 max-h-[calc(100vh-4rem)] overflow-y-auto">
            {links.map((l) => (
              <Link
                key={l.href + l.label}
                href={l.href}
                target={l.openInNewTab ? "_blank" : undefined}
                rel={l.openInNewTab ? "noopener noreferrer" : undefined}
                onClick={() => setOpen(false)}
                className="px-4 py-3 text-base text-white/90 hover:text-white hover:bg-white/5 rounded-md transition"
              >
                {l.label}
              </Link>
            ))}
            <Link
              href="/#contact"
              onClick={() => setOpen(false)}
              className="mt-2 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-white/5 border border-(--color-cyan)/40 text-base text-(--color-cyan) hover:bg-(--color-cyan)/10 transition"
            >
              Get a quote
              <span aria-hidden>→</span>
            </Link>
          </nav>
        </div>
      )}
    </div>
  );
}
