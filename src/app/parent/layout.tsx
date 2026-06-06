import Link from "next/link";
import { redirect } from "next/navigation";
import { getPortalSession, isStaff } from "@/lib/portal-session";
import { SignOutButton } from "@/components/portal/SignOutButton";

export default async function ParentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();
  if (!session) redirect("/login?from=/parent");
  if (isStaff(session.role)) redirect("/admin");
  if (session.role !== "parent") redirect("/learn");

  return (
    <div className="min-h-screen bg-cream">
      <header className="sticky top-0 z-40 border-b border-amber-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/parent" className="flex items-center gap-2 font-fun text-lg font-700 text-slate-800">
            <span aria-hidden>👋</span> Parent dashboard
          </Link>
          <nav className="flex items-center gap-5 font-fun font-600 text-slate-500">
            <Link href="/parent" className="hover:text-coral">Home</Link>
            <Link href="/parent/children" className="hover:text-coral">My kids</Link>
            <Link href="/parent/bookings" className="hover:text-coral">Bookings</Link>
            <Link href="/programs" className="hover:text-coral">Book new</Link>
            <SignOutButton />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
