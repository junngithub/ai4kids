/**
 * Per-feature toggles for the social posting pipeline.
 * Stored as JSON booleans in the existing `settings` table — no schema
 * change needed.
 */
import { db } from "@/db";
import { settings } from "@/db/schema";
import { eq } from "drizzle-orm";

const AUTO_PUBLISH_KEY = "social:auto_publish";

export async function getSocialAutoPublish(): Promise<boolean> {
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.key, AUTO_PUBLISH_KEY))
    .limit(1);
  return row?.value === true;
}

export async function setSocialAutoPublish(enabled: boolean): Promise<void> {
  await db
    .insert(settings)
    .values({ key: AUTO_PUBLISH_KEY, value: enabled as unknown as object })
    .onConflictDoUpdate({
      target: settings.key,
      set: { value: enabled as unknown as object, updatedAt: new Date() },
    });
}
