/**
 * LinkedIn UGC posting via REST API.
 * Docs: https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 *
 * Flow for an image post:
 *   1. POST /rest/images?action=initializeUpload  — get a single-use upload URL
 *   2. PUT the binary to the upload URL
 *   3. POST /rest/posts with the returned image URN in the media block
 *
 * For a text+link-only post, step 1/2 are skipped and the post body just
 * references the link as content text — LinkedIn auto-renders an OpenGraph
 * card from the URL.
 */

import { getCredential } from "@/lib/secrets";

const REST_BASE = "https://api.linkedin.com/rest";
// LinkedIn retires monthly versions after ~12 months — bump this every
// few quarters. Format YYYYMM. Check active versions at
// https://learn.microsoft.com/en-us/linkedin/marketing/versioning
const REST_VERSION = "202604";

export type LinkedInPostResult = {
  externalId: string;
  externalUrl: string;
};

async function uploadImage(
  accessToken: string,
  authorUrn: string,
  imageUrl: string,
): Promise<string> {
  const initRes = await fetch(`${REST_BASE}/images?action=initializeUpload`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": REST_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      initializeUploadRequest: { owner: authorUrn },
    }),
  });
  if (!initRes.ok) {
    throw new Error(
      `LinkedIn image init failed: ${initRes.status} ${await initRes.text()}`,
    );
  }
  const init = (await initRes.json()) as {
    value: { uploadUrl: string; image: string };
  };

  const imgRes = await fetch(imageUrl);
  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image ${imageUrl}: ${imgRes.status}`);
  }
  const imgBuf = Buffer.from(await imgRes.arrayBuffer());

  const upRes = await fetch(init.value.uploadUrl, {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: imgBuf,
  });
  if (!upRes.ok) {
    throw new Error(
      `LinkedIn image upload failed: ${upRes.status} ${await upRes.text()}`,
    );
  }
  return init.value.image;
}

export async function postToLinkedIn(opts: {
  content: string;
  imageUrl?: string | null;
  linkUrl?: string | null;
}): Promise<LinkedInPostResult> {
  const accessToken = await getCredential("linkedin_access_token");
  const authorUrn = await getCredential("linkedin_author_urn");
  if (!accessToken || !authorUrn) {
    throw new Error(
      "LinkedIn credentials missing (linkedin_access_token + linkedin_author_urn).",
    );
  }

  const commentary =
    opts.linkUrl && !opts.content.includes(opts.linkUrl)
      ? `${opts.content}\n\n${opts.linkUrl}`
      : opts.content;

  const body: Record<string, unknown> = {
    author: authorUrn,
    commentary,
    visibility: "PUBLIC",
    distribution: {
      feedDistribution: "MAIN_FEED",
      targetEntities: [],
      thirdPartyDistributionChannels: [],
    },
    lifecycleState: "PUBLISHED",
    isReshareDisabledByAuthor: false,
  };

  if (opts.imageUrl) {
    const imageUrn = await uploadImage(accessToken, authorUrn, opts.imageUrl);
    body.content = {
      media: { id: imageUrn, altText: "" },
    };
  }

  const res = await fetch(`${REST_BASE}/posts`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "LinkedIn-Version": REST_VERSION,
      "X-Restli-Protocol-Version": "2.0.0",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(
      `LinkedIn post failed: ${res.status} ${await res.text()}`,
    );
  }
  // LinkedIn returns the new post URN in the x-restli-id header.
  const urn = res.headers.get("x-restli-id") ?? "";
  // Build a viewable URL — works for both share URNs and ugcPost URNs.
  const externalUrl = urn
    ? `https://www.linkedin.com/feed/update/${encodeURIComponent(urn)}/`
    : "https://www.linkedin.com/";
  return { externalId: urn, externalUrl };
}
