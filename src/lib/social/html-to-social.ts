/**
 * Convert a blog post's contentHtml into well-formed plain text suitable for
 * a LinkedIn or Facebook post body. Strips tags, normalises whitespace,
 * preserves paragraph + list structure, and clips to a max character count
 * on a paragraph boundary (so we never cut mid-sentence).
 */

const BLOCK_CLOSE = /<\/(p|h[1-6]|li|div|tr|blockquote)>/gi;
const LIST_ITEM = /<li[^>]*>/gi;
const HEADING_OPEN = /<h[1-6][^>]*>/gi;
const PARAGRAPH_OPEN = /<p[^>]*>/gi;
const ANY_TAG = /<[^>]+>/g;

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
  "&mdash;": "—",
  "&ndash;": "–",
  "&hellip;": "…",
  "&rarr;": "→",
  "&larr;": "←",
};

function decodeEntities(s: string): string {
  let out = s;
  for (const [k, v] of Object.entries(ENTITIES)) {
    out = out.split(k).join(v);
  }
  // Numeric entities (&#1234; / &#x4a;)
  out = out.replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
  out = out.replace(/&#x([0-9a-f]+);/gi, (_, n) =>
    String.fromCharCode(parseInt(n, 16)),
  );
  return out;
}

/**
 * Pull H2 headings out of a blog post — these map nicely to the bullet
 * "what's inside" section of a LinkedIn post.
 */
export function extractH2Headings(html: string): string[] {
  if (!html) return [];
  const out: string[] = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const text = decodeEntities(m[1].replace(ANY_TAG, "")).trim();
    if (text) out.push(text);
  }
  return out;
}

/**
 * Pull the first paragraph (text inside the first <p> tag) of a blog post —
 * this is the "hook" / opening summary that introduces the piece.
 */
export function extractFirstParagraph(html: string): string {
  if (!html) return "";
  const m = /<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
  if (!m) return "";
  return decodeEntities(m[1].replace(ANY_TAG, "")).trim();
}

/** Strip HTML → plain text while preserving paragraph + bullet structure. */
export function htmlToPlainText(html: string): string {
  if (!html) return "";
  let s = html;
  s = s.replace(LIST_ITEM, "\n• ");
  s = s.replace(HEADING_OPEN, "\n\n");
  s = s.replace(PARAGRAPH_OPEN, "\n\n");
  s = s.replace(BLOCK_CLOSE, "\n");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  s = s.replace(ANY_TAG, "");
  s = decodeEntities(s);
  // Collapse runs of whitespace but keep paragraph breaks.
  s = s.replace(/[ \t]+/g, " ");
  s = s.replace(/ *\n */g, "\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}

/**
 * Take the first N paragraphs (joined by blank lines) up to maxChars,
 * cutting on a paragraph boundary so the text never ends mid-sentence.
 * Returns the clipped text with an ellipsis if anything was dropped.
 */
export function clipToParagraphs(
  text: string,
  opts: { maxChars: number; maxParagraphs?: number },
): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const max = opts.maxParagraphs ?? Infinity;
  const kept: string[] = [];
  let total = 0;
  for (let i = 0; i < paras.length && kept.length < max; i++) {
    const p = paras[i];
    if (total + p.length + 2 > opts.maxChars) break;
    kept.push(p);
    total += p.length + 2;
  }
  if (kept.length === 0) {
    // Single paragraph too long — hard-cut on a sentence boundary.
    const first = paras[0] ?? "";
    const sentences = first.split(/(?<=[.!?])\s+/);
    let buf = "";
    for (const s of sentences) {
      if (buf.length + s.length + 1 > opts.maxChars) break;
      buf += (buf ? " " : "") + s;
    }
    return buf + (buf.length < first.length ? " …" : "");
  }
  const out = kept.join("\n\n");
  return out + (kept.length < paras.length ? "\n\n…" : "");
}
