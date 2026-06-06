import { redirect } from "next/navigation";
import { getPortalSession, isStaff } from "@/lib/portal-session";

/** Role dispatcher landed on after any login. */
export default async function DashboardDispatch() {
  const session = await getPortalSession();
  if (!session) redirect("/login");
  if (isStaff(session.role)) redirect("/admin");
  if (session.role === "parent") redirect("/parent");
  redirect("/learn");
}
