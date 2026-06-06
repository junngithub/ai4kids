import { generateHTML } from "@tiptap/html";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import type { JSONContent } from "@tiptap/react";

export function renderTipTapHtml(doc: JSONContent): string {
  return generateHTML(doc, [StarterKit, Link, Image]);
}
