import { NextResponse } from "next/server";
import { getTurnstileSiteKey } from "@/lib/turnstile";

export const dynamic = "force-dynamic";

/**
 * Public endpoint — the Turnstile site key is intentionally browser-visible.
 * Returns { siteKey: string | null }. Null = Turnstile is disabled, forms
 * should skip rendering the widget.
 */
export async function GET() {
  const siteKey = await getTurnstileSiteKey();
  return NextResponse.json({ siteKey });
}
