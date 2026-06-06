/**
 * Rebuild posts.content (TipTap JSON) from posts.contentHtml so the admin
 * rich-text editor renders the full body. Was needed because the bulk
 * insert scripts used during the WP rewrite stuffed the rich HTML only
 * into contentHtml, leaving content as a single-paragraph stub.
 *
 * Run once: `npx tsx --env-file=.env scripts/rehydrate-post-content.ts`
 */
import { parse, HTMLElement, Node, NodeType } from "node-html-parser";
import { db } from "../src/db";
import { posts } from "../src/db/schema";
import { eq } from "drizzle-orm";

type TT =
  | { type: "doc"; content: TT[] }
  | { type: "paragraph"; content?: TT[] }
  | { type: "heading"; attrs: { level: number }; content?: TT[] }
  | { type: "bulletList"; content: TT[] }
  | { type: "orderedList"; content: TT[] }
  | { type: "listItem"; content: TT[] }
  | { type: "blockquote"; content: TT[] }
  | { type: "table"; content: TT[] }
  | { type: "tableRow"; content: TT[] }
  | { type: "tableHeader"; content: TT[] }
  | { type: "tableCell"; content: TT[] }
  | { type: "horizontalRule" }
  | { type: "hardBreak" }
  | { type: "text"; text: string; marks?: { type: string; attrs?: Record<string, unknown> }[] };

function inlineNodes(el: Node, inheritedMarks: { type: string; attrs?: Record<string, unknown> }[] = []): TT[] {
  const out: TT[] = [];
  for (const child of el.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      const text = child.rawText.replace(/\s+/g, " ");
      if (text.trim().length === 0 && out.length === 0) continue;
      out.push(inheritedMarks.length ? { type: "text", text, marks: [...inheritedMarks] } : { type: "text", text });
      continue;
    }
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const e = child as HTMLElement;
    const tag = e.tagName?.toLowerCase();
    if (!tag) continue;
    switch (tag) {
      case "br":
        out.push({ type: "hardBreak" });
        break;
      case "strong":
      case "b":
        out.push(...inlineNodes(e, [...inheritedMarks, { type: "bold" }]));
        break;
      case "em":
      case "i":
        out.push(...inlineNodes(e, [...inheritedMarks, { type: "italic" }]));
        break;
      case "code":
        out.push(...inlineNodes(e, [...inheritedMarks, { type: "code" }]));
        break;
      case "a": {
        const href = e.getAttribute("href") ?? "#";
        const target = e.getAttribute("target");
        const attrs: Record<string, unknown> = { href };
        if (target) attrs.target = target;
        out.push(...inlineNodes(e, [...inheritedMarks, { type: "link", attrs }]));
        break;
      }
      case "span":
        out.push(...inlineNodes(e, inheritedMarks));
        break;
      default:
        out.push(...inlineNodes(e, inheritedMarks));
    }
  }
  return out.filter((n) => n.type !== "text" || (n as { text: string }).text.length > 0);
}

function blockNodes(parent: HTMLElement): TT[] {
  const out: TT[] = [];
  for (const child of parent.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      const text = child.rawText.trim();
      if (text) out.push({ type: "paragraph", content: [{ type: "text", text }] });
      continue;
    }
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const e = child as HTMLElement;
    const tag = e.tagName?.toLowerCase();
    if (!tag) continue;
    switch (tag) {
      case "h1":
      case "h2":
      case "h3":
      case "h4":
      case "h5":
      case "h6": {
        const level = Math.max(1, Math.min(6, Number(tag[1])));
        const inline = inlineNodes(e);
        if (inline.length) out.push({ type: "heading", attrs: { level }, content: inline });
        break;
      }
      case "p": {
        const inline = inlineNodes(e);
        out.push(inline.length ? { type: "paragraph", content: inline } : { type: "paragraph" });
        break;
      }
      case "blockquote": {
        const inner = blockNodes(e);
        if (inner.length) out.push({ type: "blockquote", content: inner });
        break;
      }
      case "ul": {
        const items: TT[] = [];
        for (const li of e.querySelectorAll("li")) {
          if (li.parentNode !== e) continue;
          const inner = blockNodes(li);
          items.push({
            type: "listItem",
            content: inner.length ? inner : [{ type: "paragraph", content: inlineNodes(li) }],
          });
        }
        if (items.length) out.push({ type: "bulletList", content: items });
        break;
      }
      case "ol": {
        const items: TT[] = [];
        for (const li of e.querySelectorAll("li")) {
          if (li.parentNode !== e) continue;
          const inner = blockNodes(li);
          items.push({
            type: "listItem",
            content: inner.length ? inner : [{ type: "paragraph", content: inlineNodes(li) }],
          });
        }
        if (items.length) out.push({ type: "orderedList", content: items });
        break;
      }
      case "table": {
        const rows: TT[] = [];
        const trs = e.querySelectorAll("tr");
        for (const tr of trs) {
          const cells: TT[] = [];
          for (const c of tr.childNodes) {
            if (c.nodeType !== NodeType.ELEMENT_NODE) continue;
            const ce = c as HTMLElement;
            const t = ce.tagName?.toLowerCase();
            if (t !== "td" && t !== "th") continue;
            const inline = inlineNodes(ce);
            const content: TT[] = inline.length
              ? [{ type: "paragraph", content: inline }]
              : [{ type: "paragraph" }];
            cells.push({ type: t === "th" ? "tableHeader" : "tableCell", content });
          }
          if (cells.length) rows.push({ type: "tableRow", content: cells });
        }
        if (rows.length) out.push({ type: "table", content: rows });
        break;
      }
      case "hr":
        out.push({ type: "horizontalRule" });
        break;
      case "div":
      case "section":
      case "article":
      case "main":
        out.push(...blockNodes(e));
        break;
      case "figure":
      case "img":
      case "iframe":
      case "video":
      case "audio":
        // Drop media for now (TipTap image schema is not configured here).
        break;
      default: {
        // Treat unknown blocks as a paragraph of their inline content.
        const inline = inlineNodes(e);
        if (inline.length) out.push({ type: "paragraph", content: inline });
      }
    }
  }
  return out;
}

function htmlToTipTap(html: string): TT {
  const root = parse(`<root>${html}</root>`);
  const content = blockNodes(root.firstChild as HTMLElement);
  return { type: "doc", content: content.length ? content : [{ type: "paragraph" }] };
}

async function main() {
  const all = await db.select().from(posts);
  let fixed = 0;
  for (const p of all) {
    const html = (p.contentHtml ?? "").trim();
    if (!html) continue;
    // Only rehydrate if current content is a stub (no doc blocks beyond one paragraph)
    const cur = p.content as { content?: unknown[] } | null;
    const blocks = Array.isArray(cur?.content) ? cur!.content!.length : 0;
    const looksStub = blocks <= 1;
    if (!looksStub) continue;
    const doc = htmlToTipTap(html);
    await db
      .update(posts)
      .set({ content: doc, updatedAt: new Date() })
      .where(eq(posts.id, p.id));
    console.log(`✓ #${p.id} ${p.slug} — ${doc.content.length} blocks`);
    fixed++;
  }
  console.log(`Rehydrated ${fixed}/${all.length} posts.`);
}
main().then(() => process.exit(0));
