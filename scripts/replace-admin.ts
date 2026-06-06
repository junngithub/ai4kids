import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { users } from "../src/db/schema";

async function main() {
  const newEmail = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  const oldEmail = "admin@tertiaryinfotech.com";
  if (!newEmail || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env");
  }

  await db.delete(users).where(eq(users.email, oldEmail));
  console.log(`Removed ${oldEmail} (if present)`);

  const passwordHash = await bcrypt.hash(password, 10);
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, newEmail))
    .limit(1);
  if (existing) {
    await db
      .update(users)
      .set({ passwordHash, role: "admin", name: "Administrator" })
      .where(eq(users.email, newEmail));
    console.log(`Updated existing admin ${newEmail}`);
  } else {
    const [u] = await db
      .insert(users)
      .values({ email: newEmail, passwordHash, name: "Administrator", role: "admin" })
      .returning();
    console.log(`Created admin id=${u.id} email=${newEmail}`);
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
