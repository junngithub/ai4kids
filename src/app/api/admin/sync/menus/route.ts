import { NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { menus, menuItems } from "@/db/schema";
import { syncAuthorized } from "@/lib/sync-auth";

const itemSchema = z.object({
  label: z.string().min(1).max(255),
  href: z.string().min(1).max(2000),
  sortOrder: z.number().int().min(0).max(9999).optional(),
  openInNewTab: z.boolean().optional(),
});

const payloadSchema = z.object({
  location: z.enum(["header", "footer"]),
  items: z.array(itemSchema).min(1).max(50),
});

export async function POST(req: Request) {
  if (!(await syncAuthorized(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await req.json().catch(() => null);
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { location, items } = parsed.data;

  const [menu] = await db
    .select()
    .from(menus)
    .where(eq(menus.location, location))
    .limit(1);
  if (!menu) {
    return NextResponse.json(
      { error: `No menu found for location='${location}'` },
      { status: 404 },
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(menuItems).where(eq(menuItems.menuId, menu.id));
    await tx.insert(menuItems).values(
      items.map((it, i) => ({
        menuId: menu.id,
        label: it.label,
        href: it.href,
        sortOrder: it.sortOrder ?? i,
        openInNewTab: it.openInNewTab ?? false,
      })),
    );
  });

  return NextResponse.json({ ok: true, location, replaced: items.length });
}
