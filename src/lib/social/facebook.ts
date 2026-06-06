/**
 * Facebook Page posting via Graph API v20.
 * Docs: https://developers.facebook.com/docs/graph-api/reference/page/feed
 *
 * For text-only or text+link posts, POST to /{page-id}/feed.
 * For photo posts, POST to /{page-id}/photos with the public image URL
 * (Graph fetches it directly — no multi-step upload required).
 */

import { getCredential } from "@/lib/secrets";

const GRAPH_BASE = "https://graph.facebook.com/v20.0";

export type FacebookPostResult = {
  externalId: string;
  externalUrl: string;
};

export async function postToFacebook(opts: {
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
}): Promise<FacebookPostResult> {
  const token = await getCredential("facebook_page_access_token");
  const pageId = await getCredential("facebook_page_id");
  if (!token || !pageId) {
    throw new Error(
      "Facebook credentials missing (facebook_page_access_token + facebook_page_id).",
    );
  }

  if (opts.imageUrl) {
    const params = new URLSearchParams({
      access_token: token,
      url: opts.imageUrl,
      caption:
        opts.linkUrl && !opts.content.includes(opts.linkUrl)
          ? `${opts.content}\n\n${opts.linkUrl}`
          : opts.content,
    });
    const res = await fetch(`${GRAPH_BASE}/${pageId}/photos`, {
      method: "POST",
      body: params,
    });
    if (!res.ok) {
      throw new Error(
        `Facebook photo post failed: ${res.status} ${await res.text()}`,
      );
    }
    const json = (await res.json()) as { id: string; post_id?: string };
    const externalId = json.post_id ?? json.id;
    return {
      externalId,
      externalUrl: `https://www.facebook.com/${externalId}`,
    };
  }

  // Text + optional link only.
  const params = new URLSearchParams({
    access_token: token,
    message: opts.content,
  });
  if (opts.linkUrl) params.set("link", opts.linkUrl);

  const res = await fetch(`${GRAPH_BASE}/${pageId}/feed`, {
    method: "POST",
    body: params,
  });
  if (!res.ok) {
    throw new Error(
      `Facebook feed post failed: ${res.status} ${await res.text()}`,
    );
  }
  const json = (await res.json()) as { id: string };
  return {
    externalId: json.id,
    externalUrl: `https://www.facebook.com/${json.id}`,
  };
}
