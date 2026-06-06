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

  const res = await db
    .update(menuItems)
    .set({ label: "SSG Services" })
    .where(and(eq(menuItems.menuId, menu.id), eq(menuItems.label, "Services")));
  console.log("Updated:", res);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
