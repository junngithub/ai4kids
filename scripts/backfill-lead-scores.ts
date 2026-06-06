import { db } from "../src/db";
import { leads } from "../src/db/schema";
import { eq } from "drizzle-orm";
import { computeLeadScore } from "../src/lib/lead-score";

async function main() {
  const rows = await db.select().from(leads);
  let updated = 0;
  for (const l of rows) {
    const score = computeLeadScore({
      name: l.name,
      email: l.email,
      phone: l.phone,
      company: l.company,
      message: l.message,
    });
    if (l.score !== score) {
      await db.update(leads).set({ score }).where(eq(leads.id, l.id));
      updated++;
    }
  }
  console.log(`Backfilled ${updated}/${rows.length} lead scores.`);
}
main().then(() => process.exit(0));
