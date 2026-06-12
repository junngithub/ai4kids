import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { sendLeadEmail, sendEmail } from "@/lib/email";
import { getSiteBrand, getLeadEmailConfig } from "@/lib/site-settings";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkBlocklist } from "@/lib/lead-blocklist";
import { computeLeadScore } from "@/lib/lead-score";
import { AGE_BANDS } from "@/lib/portal-content";

/**
 * "Book a free trial" lead magnet. A free-trial request is stored as a regular
 * `leads` row with `source = "free-trial"` (so it shows up in /admin/leads
 * alongside the rest), with the child's name + age band folded into the message.
 * On success it fires the usual admin alert AND a friendly acknowledgement email
 * back to the parent. Mirrors the spam guards (Turnstile + blocklist) of
 * /api/contact.
 */
const AGE_SLUGS = AGE_BANDS.map((b) => b.slug) as [string, ...string[]];

const schema = z.object({
  parentName: z.string().min(1).max(255),
  parentEmail: z.string().email().max(255),
  parentPhone: z.string().max(50).optional().nullable(),
  childName: z.string().min(1).max(255),
  childAge: z.enum(AGE_SLUGS),
  message: z.string().max(4000).optional().nullable(),
  turnstileToken: z.string().max(2048).optional().nullable(),
});

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const data = parsed.data;

  const ip =
    req.headers.get("cf-connecting-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    null;
  const captcha = await verifyTurnstileToken(data.turnstileToken, ip);
  if (!captcha.ok) {
    return NextResponse.json(
      { error: "Captcha verification failed", reason: captcha.reason },
      { status: 400 },
    );
  }

  // Spam blocklist — allow rules win over block rules. Blocked senders get a
  // success response (so we don't tip them off) but nothing is stored or sent.
  const verdict = await checkBlocklist(data.parentEmail).catch(() => "neutral" as const);
  if (verdict === "block") {
    return NextResponse.json({ ok: true });
  }

  const band = AGE_BANDS.find((b) => b.slug === data.childAge);
  const ageLabel = band ? `${band.slug} · ${band.label}` : data.childAge;
  const note = (data.message ?? "").trim();
  // Fold the child's details into the lead message so /admin/leads shows them.
  const composedMessage = `Free trial request\nChild: ${data.childName} (age ${ageLabel})${
    note ? `\n\nMessage:\n${note}` : ""
  }`;

  const score = computeLeadScore({
    name: data.parentName,
    email: data.parentEmail,
    phone: data.parentPhone ?? null,
    company: null,
    message: composedMessage,
  });

  await db.insert(leads).values({
    name: data.parentName,
    email: data.parentEmail,
    phone: data.parentPhone ?? null,
    company: null,
    message: composedMessage,
    source: "free-trial",
    score,
  });

  // Admin alert — reuse the configured lead-notification template/recipient.
  try {
    await sendLeadEmail({
      name: data.parentName,
      email: data.parentEmail,
      phone: data.parentPhone ?? undefined,
      company: data.childName, // surfaces the child in the {COMPANY} slot
      message: composedMessage,
      source: "free-trial",
    });
  } catch (err) {
    console.error("[free-trial] admin email failed", err);
  }

  // Parent acknowledgement — best-effort, never fails the request.
  try {
    const [brand, cfg] = await Promise.all([getSiteBrand(), getLeadEmailConfig()]);
    await sendEmail({
      to: data.parentEmail,
      replyTo: cfg.to,
      fromName: brand.shortName,
      subject: `We got your free trial request 🎉`,
      html: ackHtml({
        brandName: brand.shortName,
        parentName: data.parentName,
        childName: data.childName,
        ageLabel,
      }),
    });
  } catch (err) {
    console.error("[free-trial] parent ack email failed", err);
  }

  return NextResponse.json({ ok: true });
}

function ackHtml(opts: {
  brandName: string;
  parentName: string;
  childName: string;
  ageLabel: string;
}): string {
  const esc = (s: string) =>
    s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#1e293b;line-height:1.6">
  <h2 style="color:#ff6b6b;margin:0 0 8px">Thanks, ${esc(opts.parentName)}! 🎉</h2>
  <p>We've received your <strong>free trial</strong> request for <strong>${esc(opts.childName)}</strong> (age ${esc(opts.ageLabel)}).</p>
  <p>One of our team will reach out within <strong>1 business day</strong> to find a class time that suits you. Spaces are small and fill up fast, so we'll be in touch soon!</p>
  <p style="margin-top:24px">See you in class,<br/><strong>${esc(opts.brandName)}</strong></p>
</div>`;
}
