/**
 * Step 1 of LinkedIn OAuth — redirect the admin to LinkedIn's authorize URL.
 *
 * Uses the linkedin_client_id stored in the credentials vault. A short-lived
 * signed state cookie carries CSRF protection; the callback compares it to
 * the `state` LinkedIn echoes back.
 *
 * Scopes:
 *   - openid + profile  → resolves the author URN via /v2/userinfo
 *   - w_member_social    → publish posts to the connected user's feed
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import { isAdminRequest } from "@/lib/admin-guard";
import { getCredential } from "@/lib/secrets";

const STATE_COOKIE = "li_oauth_state";
const STATE_TTL_SECONDS = 600;

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3070"
  ).replace(/\/$/, "");
}

export async function GET() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clientId = await getCredential("linkedin_client_id");
  if (!clientId) {
    return NextResponse.redirect(
      `${siteBase()}/admin/settings/credentials?linkedin=missing_client_id`,
    );
  }

  const state = crypto.randomBytes(24).toString("hex");
  const c = await cookies();
  c.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: siteBase().startsWith("https://"),
    sameSite: "lax",
    path: "/",
    maxAge: STATE_TTL_SECONDS,
  });

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: `${siteBase()}/api/admin/linkedin/callback`,
    state,
    scope: "openid profile w_member_social",
  });
  return NextResponse.redirect(
    `https://www.linkedin.com/oauth/v2/authorization?${params.toString()}`,
  );
}
