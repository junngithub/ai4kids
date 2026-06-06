import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { db } from "@/db";
import { classes, programs, bookings, parentChildren, users } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { getPortalSession } from "@/lib/portal-session";
import { genPaymentRef } from "@/lib/booking";
import { formatPrice } from "@/lib/portal-content";
import { SiteHeader } from "@/components/public/SiteHeader";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  const cid = Number(classId);
  if (!Number.isFinite(cid)) notFound();

  const session = await getPortalSession();
  if (!session) redirect(`/login?from=/book/${cid}`);
  if (session.role !== "parent") {
    // Only parents book classes.
    redirect("/dashboard");
  }
  const parentId = Number(session.id);

  const [klass] = await db.select().from(classes).where(eq(classes.id, cid)).limit(1);
  if (!klass) notFound();
  const [program] = await db.select().from(programs).where(eq(programs.id, klass.programId)).limit(1);

  // Parent's linked children.
  const kids = await db
    .select({ id: users.id, name: users.name, username: users.username, ageGroup: users.ageGroup })
    .from(parentChildren)
    .innerJoin(users, eq(parentChildren.childId, users.id))
    .where(eq(parentChildren.parentId, parentId));

  const price = klass.priceCents || program?.priceCents || 0;
  const seatsLeft = Math.max(0, klass.maxStudents - klass.seatsTaken);
  const bookable = klass.status === "open" && seatsLeft > 0;

  async function book(formData: FormData) {
    "use server";
    const sess = await getPortalSession();
    if (!sess || sess.role !== "parent") redirect("/login");
    const pId = Number(sess!.id);
    const learnerId = Number(formData.get("learnerId"));

    // Re-validate ownership + availability server-side.
    const [link] = await db
      .select()
      .from(parentChildren)
      .where(and(eq(parentChildren.parentId, pId), eq(parentChildren.childId, learnerId)))
      .limit(1);
    if (!link) redirect(`/book/${cid}?err=child`);

    const [c] = await db.select().from(classes).where(eq(classes.id, cid)).limit(1);
    if (!c || c.status !== "open" || c.seatsTaken >= c.maxStudents) {
      redirect(`/book/${cid}?err=full`);
    }

    const [created] = await db
      .insert(bookings)
      .values({
        classId: cid,
        parentId: pId,
        learnerId,
        status: "pending",
        amountCents: c!.priceCents || price,
        paymentRef: `PENDING-${pId}-${learnerId}-${cid}`,
        notes: String(formData.get("notes") || ""),
      })
      .returning();
    // Replace the placeholder ref with a clean deterministic one.
    await db
      .update(bookings)
      .set({ paymentRef: genPaymentRef(created.id) })
      .where(eq(bookings.id, created.id));

    redirect("/parent/bookings?booked=1");
  }

  return (
    <div className="min-h-screen bg-cream">
      <SiteHeader />
      <div className="mx-auto max-w-lg px-4 py-10">
        <Link href={`/programs/${program?.slug ?? ""}`} className="font-fun text-sm font-600 text-slate-400 hover:text-coral">
          ← Back
        </Link>
        <div className="mt-4 rounded-[2rem] bg-white p-8 shadow-sm ring-1 ring-amber-100">
          <h1 className="font-fun text-2xl font-700 text-slate-900">Book a seat</h1>
          <div className="mt-3 rounded-2xl bg-amber-50 p-4">
            <div className="font-fun font-700 text-slate-800">{klass.title}</div>
            <div className="text-sm text-slate-500">{program?.title}</div>
            <div className="mt-1 text-sm text-slate-500">{klass.schedule ?? "Schedule TBA"}</div>
            <div className="mt-1 font-fun font-700 text-coral">{formatPrice(price)}</div>
            <div className="text-xs text-slate-400">{seatsLeft} seats left</div>
          </div>

          {!bookable ? (
            <p className="mt-6 rounded-2xl bg-coral/10 p-4 text-coral">This class is no longer available.</p>
          ) : kids.length === 0 ? (
            <div className="mt-6 text-center">
              <p className="text-slate-600">You haven't added any children yet.</p>
              <Link
                href="/parent/children/new"
                className="mt-3 inline-block rounded-full bg-sky-500 px-6 py-3 font-fun font-700 text-white shadow"
              >
                + Add your child
              </Link>
            </div>
          ) : (
            <form action={book} className="mt-6 space-y-4">
              <div>
                <label className="font-fun font-600 text-sm text-slate-600">Who is attending?</label>
                <select
                  name="learnerId"
                  required
                  className="mt-1 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-3 font-round text-lg outline-none focus:border-coral"
                >
                  {kids.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.name} {k.ageGroup ? `(ages ${k.ageGroup})` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-fun font-600 text-sm text-slate-600">Anything we should know? (optional)</label>
                <textarea
                  name="notes"
                  rows={2}
                  className="mt-1 w-full rounded-2xl border-2 border-amber-100 bg-amber-50/40 px-4 py-2 font-round outline-none focus:border-coral"
                />
              </div>
              <button className="w-full rounded-2xl bg-coral py-3 font-fun text-lg font-700 text-white shadow-lg shadow-coral/30 transition hover:scale-[1.02]">
                Request booking →
              </button>
              <p className="text-center text-xs text-slate-400">
                We'll confirm the class and email you a PayNow QR to pay.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
