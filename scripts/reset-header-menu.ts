import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { menus, menuItems } from "../src/db/schema";

const ITEMS = [
  { label: "Home", href: "/" },
  { label: "SSG Services", href: "/#ssg-services" },
  { label: "AI Services", href: "/#ai-services" },
  { label: "AI Chatbots", href: "/ai-chatbot-portfolio" },
  { label: "LMS/TMS", href: "/#ai-lms-tms" },
  { label: "e-Learning", href: "/#e-learning" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

async function main() {
  const [menu] = await db
    .select()
    .from(menus)
    .where(eq(menus.location, "header"))
    .limit(1);
  if (!menu) throw new Error("Header menu not found");

  await db.delete(menuItems).where(eq(menuItems.menuId, menu.id));
  await db.insert(menuItems).values(
    ITEMS.map((it, i) => ({
      menuId: menu.id,
      label: it.label,
      href: it.href,
      sortOrder: i,
    })),
  );
  console.log(`Header menu rewritten with ${ITEMS.length} items:`);
  for (const it of ITEMS) console.log(`  ${it.label} → ${it.href}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
