/**
 * Booking lifecycle: confirm a seat → email a PayNow QR → mark paid, plus the
 * agentic auto-close that fires when a class reaches its max students.
 */
import { db } from "@/db";
import { bookings, classes, programs, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { generatePayNowQrDataUrl } from "@/lib/paynow";
import { getPayNowConfig } from "@/lib/portal-settings";
import { sendEmail } from "@/lib/email";
import { askClaude } from "@/lib/ai";
import { formatPrice } from "@/lib/portal-content";

/** Short human-ish reference, e.g. AIK-7F3K9Q. Deterministic given a seed. */
export function genPaymentRef(seed: number): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let n = seed * 2654435761; // knuth multiplicative hash
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += alphabet[Math.abs(n) % alphabet.length];
    n = Math.floor(n / alphabet.length) + (i + 1) * 7919;
  }
  return `AIK-${out}`;
}

type FullBooking = {
  booking: typeof bookings.$inferSelect;
  klass: typeof classes.$inferSelect;
  program: typeof programs.$inferSelect;
  parent: typeof users.$inferSelect;
  learner: typeof users.$inferSelect;
};

async function loadBooking(bookingId: number): Promise<FullBooking | null> {
  const [b] = await db.select().from(bookings).where(eq(bookings.id, bookingId)).limit(1);
  if (!b) return null;
  const [k] = await db.select().from(classes).where(eq(classes.id, b.classId)).limit(1);
  if (!k) return null;
  const [p] = await db.select().from(programs).where(eq(programs.id, k.programId)).limit(1);
  const [parent] = await db.select().from(users).where(eq(users.id, b.parentId)).limit(1);
  const [learner] = await db.select().from(users).where(eq(users.id, b.learnerId)).limit(1);
  if (!p || !parent || !learner) return null;
  return { booking: b, klass: k, program: p, parent, learner };
}

function paynowEmailHtml(opts: {
  parentName: string;
  learnerName: string;
  className: string;
  schedule: string;
  amount: string;
  reference: string;
  qrDataUrl: string;
  payeeName: string;
  uen: string;
}): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#1f2937">
    <h2 style="color:#ff6b6b">🎉 Your class is confirmed!</h2>
    <p>Hi ${opts.parentName},</p>
    <p>Great news — a spot for <strong>${opts.learnerName}</strong> in
       <strong>${opts.className}</strong> is confirmed.</p>
    <table style="margin:12px 0;font-size:15px">
      <tr><td style="padding:2px 8px;color:#6b7280">Schedule</td><td>${opts.schedule}</td></tr>
      <tr><td style="padding:2px 8px;color:#6b7280">Amount</td><td><strong>${opts.amount}</strong></td></tr>
      <tr><td style="padding:2px 8px;color:#6b7280">Reference</td><td><strong>${opts.reference}</strong></td></tr>
    </table>
    <p>Please complete payment with the PayNow QR below to lock in the seat:</p>
    <div style="text-align:center;margin:16px 0">
      <img src="${opts.qrDataUrl}" alt="PayNow QR" width="240" height="240" style="border:1px solid #eee;border-radius:12px"/>
      <div style="font-size:13px;color:#6b7280;margin-top:6px">
        Pay to ${opts.payeeName} (UEN ${opts.uen})<br/>Reference: ${opts.reference}
      </div>
    </div>
    <p style="font-size:13px;color:#6b7280">Once we receive payment, the booking is fully secured.
       Reply to this email if you have any questions. See you in class! 🚀</p>
  </div>`;
}

/**
 * Confirm a booking: assign price + payment reference, mark awaiting_payment,
 * take a seat, email the PayNow QR, and auto-close the class if it's now full.
 * Returns { qrDataUrl, reference } so the UI can show the QR immediately even
 * if email delivery isn't configured.
 */
export async function confirmBooking(
  bookingId: number,
): Promise<{ ok: boolean; reference?: string; qrDataUrl?: string; error?: string }> {
  const fb = await loadBooking(bookingId);
  if (!fb) return { ok: false, error: "Booking not found" };
  const { booking, klass, program, parent, learner } = fb;

  if (booking.status === "paid" || booking.status === "confirmed") {
    return { ok: false, error: "Booking already confirmed" };
  }
  if (klass.status === "closed" || klass.status === "cancelled") {
    return { ok: false, error: "Class is not open for bookings" };
  }
  if (klass.seatsTaken >= klass.maxStudents) {
    return { ok: false, error: "Class is full" };
  }

  const amountCents = klass.priceCents || program.priceCents || 0;
  const reference = booking.paymentRef || genPaymentRef(booking.id);

  await db
    .update(bookings)
    .set({
      status: "awaiting_payment",
      amountCents,
      paymentRef: reference,
      updatedAt: new Date(),
    })
    .where(eq(bookings.id, bookingId));

  const newSeats = klass.seatsTaken + 1;
  await db
    .update(classes)
    .set({ seatsTaken: newSeats, updatedAt: new Date() })
    .where(eq(classes.id, klass.id));

  // PayNow QR
  let qrDataUrl: string | undefined;
  const paynow = await getPayNowConfig();
  if (paynow && amountCents > 0) {
    qrDataUrl = await generatePayNowQrDataUrl({
      uen: paynow.uen,
      amountCents,
      reference,
      merchantName: paynow.payeeName,
    });
    // Email the parent (best-effort).
    if (parent.email) {
      try {
        await sendEmail({
          to: parent.email,
          subject: `🎉 ${learner.name}'s spot in ${klass.title} is confirmed — pay with PayNow`,
          html: paynowEmailHtml({
            parentName: parent.name,
            learnerName: learner.name,
            className: klass.title,
            schedule: klass.schedule ?? "TBA",
            amount: formatPrice(amountCents),
            reference,
            qrDataUrl,
            payeeName: paynow.payeeName,
            uen: paynow.uen,
          }),
        });
      } catch (e) {
        console.warn("[booking] PayNow email failed (Gmail not configured?)", e);
      }
    }
  }

  // Agentic auto-close when the class hits capacity.
  if (newSeats >= klass.maxStudents) {
    await closeClassWhenFull(klass.id);
  }

  return { ok: true, reference, qrDataUrl };
}

export async function markBookingPaid(bookingId: number): Promise<void> {
  await db
    .update(bookings)
    .set({ status: "paid", paidAt: new Date(), updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
}

export async function cancelBooking(bookingId: number): Promise<void> {
  const fb = await loadBooking(bookingId);
  if (!fb) return;
  const { booking, klass } = fb;
  await db
    .update(bookings)
    .set({ status: "cancelled", updatedAt: new Date() })
    .where(eq(bookings.id, bookingId));
  // Free the seat if it had been taken.
  if (["awaiting_payment", "confirmed", "paid"].includes(booking.status)) {
    const seats = Math.max(0, klass.seatsTaken - 1);
    await db
      .update(classes)
      .set({
        seatsTaken: seats,
        status: klass.status === "full" ? "open" : klass.status,
        updatedAt: new Date(),
      })
      .where(eq(classes.id, klass.id));
  }
}

/**
 * The "agentic workflow to close the class when max students is reached".
 * Deterministically flips the class to `full` (stops new bookings), then uses
 * Claude to draft a tailored summary for the admin + a cheerful note. Both the
 * close and notifications are best-effort and never block the booking flow.
 */
export async function closeClassWhenFull(classId: number): Promise<void> {
  const [klass] = await db.select().from(classes).where(eq(classes.id, classId)).limit(1);
  if (!klass) return;
  if (klass.status === "open" || klass.status === "full") {
    await db
      .update(classes)
      .set({ status: "full", updatedAt: new Date() })
      .where(eq(classes.id, classId));
  }

  const [program] = await db.select().from(programs).where(eq(programs.id, klass.programId)).limit(1);
  const seatHolders = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.classId, classId)))
    .catch(() => []);
  const active = seatHolders.filter((b) =>
    ["awaiting_payment", "confirmed", "paid"].includes(b.status),
  );
  const paid = active.filter((b) => b.status === "paid").length;

  // Agentic step: draft an admin summary. Degrades to a deterministic note.
  const aiSummary = await askClaude(
    `You are the operations assistant for a kids' AI school. A class just filled up.
Write a short, friendly internal summary email (3-4 sentences) for the admin team.
Class: "${klass.title}" (${program?.title ?? "program"}).
Schedule: ${klass.schedule ?? "TBA"}. Capacity: ${klass.maxStudents}.
Bookings: ${active.length} active, ${paid} already paid, ${active.length - paid} awaiting PayNow payment.
Remind the team to chase unpaid PayNow references and to consider opening another cohort.`,
    { model: "haiku" },
  );

  const summary =
    aiSummary ??
    `Class "${klass.title}" is now FULL (${klass.maxStudents} seats). ` +
      `${active.length} active bookings, ${paid} paid, ${active.length - paid} awaiting payment. ` +
      `Chase unpaid PayNow references and consider opening another cohort.`;

  // Email the admin (the seed admin). Best-effort.
  const adminEmail = process.env.ADMIN_EMAIL;
  if (adminEmail) {
    try {
      await sendEmail({
        to: adminEmail,
        subject: `📕 Class full: ${klass.title}`,
        html: `<div style="font-family:Arial,sans-serif;color:#1f2937">
          <h3 style="color:#a855f7">Class auto-closed — it's full! 🎊</h3>
          <p>${summary.replace(/\n/g, "<br/>")}</p>
        </div>`,
      });
    } catch (e) {
      console.warn("[booking] admin full-class email failed", e);
    }
  }
  console.log(`[booking] class ${classId} closed (full). Summary: ${summary}`);
}
