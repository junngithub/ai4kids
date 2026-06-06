import { db } from "@/db";
import { leadBlocklist } from "@/db/schema";

/**
 * Matches a glob-style pattern (* and ?) against an email, case-insensitive.
 * "foo@bar.com" — exact email
 * "*@bar.com"   — any email at bar.com
 * "spam*@*"     — any email starting with "spam"
 */
export function matchesPattern(pattern: string, email: string): boolean {
  const p = pattern.trim().toLowerCase();
  const e = email.trim().toLowerCase();
  if (!p) return false;
  const re = new RegExp(
    "^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$",
  );
  return re.test(e);
}

export type BlocklistVerdict = "allow" | "block" | "neutral";

export async function checkBlocklist(email: string): Promise<BlocklistVerdict> {
  const rows = await db.select().from(leadBlocklist);
  // Allow rules override block rules — whitelist beats blacklist.
  for (const r of rows.filter((r) => r.kind === "allow")) {
    if (matchesPattern(r.pattern, email)) return "allow";
  }
  for (const r of rows.filter((r) => r.kind === "block")) {
    if (matchesPattern(r.pattern, email)) return "block";
  }
  return "neutral";
}
