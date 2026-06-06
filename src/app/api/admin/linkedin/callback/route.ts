/**
 * Step 2 of LinkedIn OAuth — exchange the authorization code for an access
 * token, fetch the OpenID user info to derive the person URN, and store both
 * in the encrypted credentials vault. Then redirect back to the credentials
 * page with a status flag.
 */

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { isAdminRequest } from "@/lib/admin-guard";
import { getCredential, setCredential } from "@/lib/secrets";

const STATE_COOKIE = "li_oauth_state";

function siteBase(): string {
  return (
    process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3070"
  ).replace(/\/$/, "");
}

function back(flag: string, detail?: string): NextResponse {
  const url = new URL(`${siteBase()}/admin/settings/credentials`);
  url.searchParams.set("linkedin", flag);
  if (detail) url.searchParams.set("detail", detail.slice(0, 200));
  return NextResponse.redirect(url.toString());
}

export async function GET(req: Request) {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const u = new URL(req.url);
  const code = u.searchParams.get("code");
  const state = u.searchParams.get("state");
  const err = u.searchParams.get("error");
  if (err) return back("error", err);
  if (!code || !state) return back("error", "missing_code_or_state");

  const c = await cookies();
  const expected = c.get(STATE_COOKIE)?.value;
  c.delete(STATE_COOKIE);
  if (!expected || expected !== state) return back("error", "state_mismatch");

  const clientId = await getCredential("linkedin_client_id");
  const clientSecret = await getCredential("linkedin_client_secret");
  if (!clientId || !clientSecret) return back("error", "missing_client_credentials");

  const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${siteBase()}/api/admin/linkedin/callback`,
      client_id: clientId,
      client_secret: clientSecret,
    }),
  });
  if (!tokenRes.ok) {
    return back("error", `token_exchange_failed_${tokenRes.status}`);
  }
  const tokenJson = (await tokenRes.json()) as {
    access_token: string;
    expires_in: number;
  };
  const accessToken = tokenJson.access_token;
  await setCredential("linkedin_access_token", accessToken);

  // Resolve author URN via OpenID userinfo endpoint.
  const meRes = await fetch("https://api.linkedin.com/v2/userinfo", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (meRes.ok) {
    const me = (await meRes.json()) as { sub?: string };
    if (me.sub) {
      await setCredential("linkedin_author_urn", `urn:li:person:${me.sub}`);
    }
  }

  return back("ok");
}
