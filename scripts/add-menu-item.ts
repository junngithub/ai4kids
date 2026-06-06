import { and, eq } from "drizzle-orm";
import { db } from "../src/db";
import { menus, menuItems } from "../src/db/schema";

async function main() {
  const [menu] = await db
    .select()
    .from(menus)
    .where(eq(menus.location, "header"))
    .limit(1);
  if (!menu) throw new Error("Header menu not found");

  const label = "e-Learning";
  const href = "/#e-learning";

  const existing = await db
    .select()
    .from(menuItems)
    .where(and(eq(menuItems.menuId, menu.id), eq(menuItems.label, label)))
    .limit(1);
  if (existing.length) {
    await db
      .update(menuItems)
      .set({ href })
      .where(eq(menuItems.id, existing[0].id));
    console.log(`Updated ${label} → ${href}`);
    process.exit(0);
  }

  const all = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.menuId, menu.id));
  const lms = all.find((i) => i.label.toLowerCase().includes("lms"));
  const insertOrder = lms ? lms.sortOrder + 1 : all.length;
  for (const it of all) {
    if (it.sortOrder >= insertOrder) {
      await db
        .update(menuItems)
        .set({ sortOrder: it.sortOrder + 1 })
        .where(eq(menuItems.id, it.id));
    }
  }
  const [created] = await db
    .insert(menuItems)
    .values({ menuId: menu.id, label, href, sortOrder: insertOrder })
    .returning();
  console.log(`Added ${created.label} → ${created.href} at position ${created.sortOrder}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
