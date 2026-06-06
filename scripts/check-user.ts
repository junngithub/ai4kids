import { db } from "../src/db";
import { users } from "../src/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  const u = await db.select().from(users).where(eq(users.email, "angch@tertiaryinfotech.com"));
  console.log(JSON.stringify(u.map(r => ({ id: r.id, email: r.email, name: r.name, role: r.role, pwd_len: r.passwordHash?.length, pwd_prefix: r.passwordHash?.slice(0,7), created: r.createdAt })), null, 2));
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
