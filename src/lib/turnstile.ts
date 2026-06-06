import { getCredential } from "./secrets";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export async function getTurnstileSiteKey(): Promise<string | null> {
  return getCredential("turnstile_site_key");
}

export type TurnstileResult =
  | { ok: true }
  | { ok: false; reason: "missing-token" | "verify-failed"; codes?: string[] };

/**
 * Verify a Turnstile token. If no secret is configured, returns ok:true so
 * forms keep working in environments where Turnstile is not set up
 * (e.g. local dev before the admin enters credentials).
 */
export async function verifyTurnstileToken(
  token: string | undefined | null,
  remoteIp?: string | null,
): Promise<TurnstileResult> {
  const secret = await getCredential("turnstile_secret");
  if (!secret) return { ok: true };

  if (!token || typeof token !== "string") {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams();
  body.set("secret", secret);
  body.set("response", token);
  if (remoteIp) body.set("remoteip", remoteIp);

  try {
    const res = await fetch(VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    const data = (await res.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };
    if (data.success) return { ok: true };
    return { ok: false, reason: "verify-failed", codes: data["error-codes"] };
  } catch {
    return { ok: false, reason: "verify-failed" };
  }
}
