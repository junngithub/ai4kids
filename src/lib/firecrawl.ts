/**
 * Thin wrapper around the Firecrawl scrape API. Used by AI Assist to fetch
 * URLs the admin pastes into a prompt (e.g. competitor pages, course
 * landing pages) and turn them into clean markdown context for Claude.
 */
import { getCredential } from "./secrets";

type FirecrawlResponse = {
  success?: boolean;
  data?: { markdown?: string; metadata?: { title?: string; description?: string } };
  error?: string;
};

const URL_RE = /https?:\/\/[^\s)]+/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_RE);
  if (!matches) return [];
  return Array.from(new Set(matches.map((u) => u.replace(/[.,;:!?)]+$/, ""))));
}

export async function scrapeUrl(url: string): Promise<{ markdown: string; title?: string } | null> {
  const apiKey = await getCredential("firecrawl_api_key");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      console.warn(`[firecrawl] ${url} → HTTP ${res.status}`);
      return null;
    }
    const json = (await res.json()) as FirecrawlResponse;
    const md = json.data?.markdown?.trim();
    if (!md) return null;
    return { markdown: md, title: json.data?.metadata?.title };
  } catch (e) {
    console.warn(`[firecrawl] ${url} threw`, e instanceof Error ? e.message : e);
    return null;
  }
}

/** Scrape up to N URLs in parallel and return a compact context block. */
export async function buildUrlContext(text: string, maxUrls = 3, maxCharsPerUrl = 6000): Promise<string> {
  const urls = extractUrls(text).slice(0, maxUrls);
  if (urls.length === 0) return "";
  const results = await Promise.all(urls.map((u) => scrapeUrl(u).then((r) => ({ url: u, r }))));
  const blocks: string[] = [];
  for (const { url, r } of results) {
    if (!r) continue;
    const body = r.markdown.slice(0, maxCharsPerUrl);
    const truncated = r.markdown.length > maxCharsPerUrl ? "\n…[truncated]" : "";
    blocks.push(`<reference url="${url}"${r.title ? ` title="${r.title.replace(/"/g, "'")}"` : ""}>\n${body}${truncated}\n</reference>`);
  }
  if (blocks.length === 0) return "";
  return `REFERENCE_CONTENT (scraped from URLs in the topic — use as primary source material, do not just rephrase):\n${blocks.join("\n\n")}\n\n`;
}
