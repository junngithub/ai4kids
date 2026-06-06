/**
 * Admin-only diagnostic: try to send a test lead email and return the actual
 * error (or success). The public /api/contact swallows email errors so the
 * lead is still saved — this endpoint surfaces the underlying Gmail OAuth /
 * SMTP failure so an admin can fix it.
 */
import { NextResponse } from "next/server";
import { isAdminRequest } from "@/lib/admin-guard";
import { sendLeadEmail } from "@/lib/email";
import { getLeadEmailConfig } from "@/lib/site-settings";

export async function POST() {
  if (!(await isAdminRequest())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let recipient: string | null = null;
  try {
    const cfg = await getLeadEmailConfig();
    recipient = cfg.to;
    await sendLeadEmail({
      name: "Test (Admin diagnostic)",
      email: recipient,
      company: "Tertiary Infotech Academy",
      message:
        "If you can read this, the Gmail OAuth pipeline is working. Triggered from /admin/settings/credentials test button.",
      source: "admin-test-email",
    });
    return NextResponse.json({ ok: true, sentTo: recipient });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack?.split("\n").slice(0, 5).join("\n") : undefined;
    return NextResponse.json({ ok: false, recipient, error: message, stack }, { status: 500 });
  }
}
