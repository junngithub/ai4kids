import Link from "next/link";
import { db } from "@/db";
import { programs, classes, bookings, users } from "@/db/schema";
import { sql, eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [
    [progCount],
    [classCount],
    [openClassCount],
    [bookingCount],
    [awaitingCount],
    [paidCount],
    [kidCount],
    [parentCount],
  ] = await Promise.all([
    db.select({ n: sql<number>`count(*)::int` }).from(programs),
    db.select({ n: sql<number>`count(*)::int` }).from(classes),
    db.select({ n: sql<number>`count(*)::int` }).from(classes).where(eq(classes.status, "open")),
    db.select({ n: sql<number>`count(*)::int` }).from(bookings),
    db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(eq(bookings.status, "awaiting_payment")),
    db.select({ n: sql<number>`count(*)::int` }).from(bookings).where(eq(bookings.status, "paid")),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "learner")),
    db.select({ n: sql<number>`count(*)::int` }).from(users).where(eq(users.role, "parent")),
  ]);

  const recent = await db
    .select({
      id: bookings.id,
      status: bookings.status,
      ref: bookings.paymentRef,
      createdAt: bookings.createdAt,
      learner: users.name,
      className: classes.title,
    })
    .from(bookings)
    .innerJoin(classes, eq(bookings.classId, classes.id))
    .innerJoin(users, eq(bookings.learnerId, users.id))
    .orderBy(desc(bookings.createdAt))
    .limit(8)
    .catch(() => []);

  const stats = [
    { label: "Programs", value: progCount.n, href: "/admin/programs" },
    { label: "Classes", value: classCount.n, href: "/admin/classes" },
    { label: "Open classes", value: openClassCount.n, href: "/admin/classes" },
    { label: "Bookings", value: bookingCount.n, href: "/admin/bookings" },
    { label: "Awaiting payment", value: awaitingCount.n, href: "/admin/bookings" },
    { label: "Paid", value: paidCount.n, href: "/admin/bookings" },
    { label: "Kids", value: kidCount.n, href: "/admin/people" },
    { label: "Parents", value: parentCount.n, href: "/admin/people" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-white">AI Kids — Admin</h1>
      <p className="mt-1 text-sm text-[var(--color-muted)]">Manage programs, classes, bookings and accounts.</p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {stats.map((s) => (
          <Link
            key={s.label}
            href={s.href}
            className="rounded-xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"
          >
            <div className="text-3xl font-bold text-cyan">{s.value}</div>
            <div className="text-sm text-[var(--color-muted)]">{s.label}</div>
          </Link>
        ))}
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Recent bookings</h2>
          <Link href="/admin/bookings" className="text-sm text-cyan hover:underline">View all →</Link>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/5 text-left text-[var(--color-muted)]">
              <tr>
                <th className="px-4 py-2">Ref</th>
                <th className="px-4 py-2">Kid</th>
                <th className="px-4 py-2">Class</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="text-white">
              {recent.length === 0 ? (
                <tr><td colSpan={4} className="px-4 py-6 text-center text-[var(--color-muted)]">No bookings yet.</td></tr>
              ) : (
                recent.map((b) => (
                  <tr key={b.id} className="border-t border-white/5">
                    <td className="px-4 py-2 font-mono text-xs">{b.ref}</td>
                    <td className="px-4 py-2">{b.learner}</td>
                    <td className="px-4 py-2">{b.className}</td>
                    <td className="px-4 py-2">{b.status}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
