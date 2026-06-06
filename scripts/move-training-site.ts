import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { menus, menuItems } from "../src/db/schema";

async function main() {
  // Reset header — no Training Site
  const [header] = await db
    .select()
    .from(menus)
    .where(eq(menus.location, "header"))
    .limit(1);
  if (!header) throw new Error("Header menu not found");
  const headerItems = [
    { label: "LMS/TMS", href: "/#ai-lms-tms" },
    { label: "e-Learning", href: "/#e-learning" },
    { label: "CMS", href: "/#cms" },
    { label: "Services", href: "/#services" },
    { label: "Portfolio", href: "https://github.com/alfredang?tab=repositories" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/#contact" },
  ];
  await db.delete(menuItems).where(eq(menuItems.menuId, header.id));
  await db.insert(menuItems).values(
    headerItems.map((it, i) => ({
      menuId: header.id,
      label: it.label,
      href: it.href,
      sortOrder: i,
    })),
  );
  console.log(`Header reset (${headerItems.length} items, no Training Site)`);

  // Add Training Site to footer
  const [footer] = await db
    .select()
    .from(menus)
    .where(eq(menus.location, "footer"))
    .limit(1);
  if (!footer) throw new Error("Footer menu not found");
  const existing = await db
    .select()
    .from(menuItems)
    .where(eq(menuItems.menuId, footer.id));
  const dup = existing.find((e) => e.label === "Training Site");
  if (dup) {
    console.log("Training Site already in footer");
    process.exit(0);
  }
  const [created] = await db
    .insert(menuItems)
    .values({
      menuId: footer.id,
      label: "Training Site",
      href: "https://www.tertiarycourses.com.sg/",
      sortOrder: existing.length,
    })
    .returning();
  console.log(`Added ${created.label} → footer at position ${created.sortOrder}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
