"use client";

import { useState } from "react";
import {
  FaFacebookF,
  FaLinkedinIn,
  FaWhatsapp,
  FaXTwitter,
} from "react-icons/fa6";
import { HiLink, HiEnvelope } from "react-icons/hi2";

type Props = {
  url: string;
  title: string;
};

export function ShareButtons({ url, title }: Props) {
  const [copied, setCopied] = useState(false);
  const encUrl = encodeURIComponent(url);
  const encTitle = encodeURIComponent(title);

  const targets = [
    {
      key: "linkedin",
      label: "LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encUrl}`,
      Icon: FaLinkedinIn,
    },
    {
      key: "x",
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${encUrl}&text=${encTitle}`,
      Icon: FaXTwitter,
    },
    {
      key: "facebook",
      label: "Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encUrl}`,
      Icon: FaFacebookF,
    },
    {
      key: "whatsapp",
      label: "WhatsApp",
      href: `https://api.whatsapp.com/send?text=${encTitle}%20${encUrl}`,
      Icon: FaWhatsapp,
    },
    {
      key: "email",
      label: "Email",
      href: `mailto:?subject=${encTitle}&body=${encUrl}`,
      Icon: HiEnvelope,
    },
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="kicker mr-1">Share</span>
      {targets.map(({ key, label, href, Icon }) => (
        <a
          key={key}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={label}
          className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/3 text-white/70 hover:text-(--color-cyan) hover:border-(--color-cyan)/50 hover:bg-(--color-cyan)/5 transition"
        >
          <Icon className="w-4 h-4" />
        </a>
      ))}
      <button
        type="button"
        onClick={copy}
        aria-label="Copy link"
        className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-white/10 bg-white/3 text-white/70 hover:text-(--color-cyan) hover:border-(--color-cyan)/50 hover:bg-(--color-cyan)/5 transition"
      >
        <HiLink className="w-4 h-4" />
      </button>
      {copied && (
        <span className="text-xs text-(--color-cyan) font-mono">Copied!</span>
      )}
    </div>
  );
}
