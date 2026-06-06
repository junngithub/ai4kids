import { XMLParser } from "fast-xml-parser";
import { YoutubeTranscript } from "youtube-transcript";

export type YtVideo = {
  videoId: string;
  title: string;
  url: string;
  description?: string;
  publishedAt?: string;
};

const xml = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

/**
 * Resolve a YouTube @handle (e.g. "@lev-selector") to a channel_id (UCxxxx).
 * Uses the public channel page — no API key needed.
 */
export async function resolveChannelId(handle: string): Promise<string> {
  const h = handle.replace(/^@/, "");
  const res = await fetch(`https://www.youtube.com/@${h}`, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; TertiaryBlogBot/1.0)" },
  });
  if (!res.ok) throw new Error(`YouTube channel page returned ${res.status} for @${h}`);
  const html = await res.text();
  const m = html.match(/"channelId":"(UC[\w-]{20,})"/) ||
    html.match(/<meta itemprop="identifier" content="(UC[\w-]{20,})"/) ||
    html.match(/channel\/(UC[\w-]{20,})/);
  if (!m) throw new Error(`Could not extract channel_id from @${h} page`);
  return m[1];
}

/** Fetch up to `limit` most recent videos from a channel via public RSS. */
export async function getRecentVideos(channelId: string, limit = 15): Promise<YtVideo[]> {
  const url = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 (compatible; TertiaryBlogBot/1.0)" },
  });
  if (!res.ok) throw new Error(`YouTube RSS returned ${res.status} for ${channelId}`);
  const body = await res.text();
  const parsed = xml.parse(body);
  const raw = parsed?.feed?.entry;
  const entries = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const out: YtVideo[] = [];
  for (const e of entries.slice(0, limit)) {
    const videoId: string | undefined = e?.["yt:videoId"];
    const title: string | undefined = e?.title;
    if (!videoId || !title) continue;
    out.push({
      videoId,
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      description: e?.["media:group"]?.["media:description"],
      publishedAt: e?.published,
    });
  }
  return out;
}

/** Fetch the single newest video from a channel via the public RSS feed. */
export async function getLatestVideo(channelId: string): Promise<YtVideo> {
  const [first] = await getRecentVideos(channelId, 1);
  if (!first) throw new Error("RSS feed has no entries");
  return first;
}

/**
 * Fetch the transcript for a video. Returns an empty string if no transcript
 * is available (private, disabled captions, or none auto-generated).
 */
export async function getTranscript(videoId: string): Promise<string> {
  try {
    const segments = await YoutubeTranscript.fetchTranscript(videoId);
    return segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim();
  } catch (err) {
    console.warn(`[youtube] transcript fetch failed for ${videoId}:`, err);
    return "";
  }
}
