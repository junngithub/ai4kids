import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/db";
import { leads } from "@/db/schema";
import { sendLeadEmail } from "@/lib/email";
import { verifyTurnstileToken } from "@/lib/turnstile";
import { checkBlocklist } from "@/lib/lead-blocklist";
import { computeLeadScore } from "@/lib/lead-score";

const schema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
  phone: z.string().max(50).optional().nullable(),
  company: z.string().min(1).max(255),
  message: z.string().min(1),
  source: z.string().max(100).optional().nullable(),
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

  // Spam blocklist — allow rules win over block rules.
  const verdict = await checkBlocklist(data.email).catch(() => "neutral" as const);
  if (verdict === "block") {
    // Return success so we don't tip off the sender; just don't store or email.
    return NextResponse.json({ ok: true });
  }

  const score = computeLeadScore({
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    company: data.company,
    message: data.message,
  });

  await db.insert(leads).values({
    name: data.name,
    email: data.email,
    phone: data.phone ?? null,
    company: data.company,
    message: data.message,
    source: data.source ?? null,
    score,
  });

  try {
    await sendLeadEmail({
      name: data.name,
      email: data.email,
      phone: data.phone ?? undefined,
      company: data.company,
      message: data.message,
      source: data.source ?? undefined,
    });
  } catch (err) {
    console.error("[contact] email send failed", err);
    // Lead is still saved in DB; don't fail the request
  }

  return NextResponse.json({ ok: true });
}
