import { db } from "../src/db";
import { leadBlocklist } from "../src/db/schema";

const SEED = [
  // Common spam-source domains
  { pattern: "*@163.com", kind: "block", reason: "High spam volume" },
  { pattern: "*@126.com", kind: "block", reason: "High spam volume" },
  { pattern: "*@qq.com", kind: "block", reason: "High spam volume" },
  // Known real leads — never auto-spam
  { pattern: "*@haileck.com", kind: "allow", reason: "Hai Leck Holdings — real client" },
  { pattern: "stevenyawhonsing71@*", kind: "allow", reason: "Steve Yaw (Micronet Computer) — real client" },
  // Internal
  { pattern: "*@tertiaryinfotech.com", kind: "allow", reason: "Internal — always allow" },
  { pattern: "*@tertiarycourses.com.sg", kind: "allow", reason: "Internal — always allow" },
];

async function main() {
  for (const row of SEED) {
    await db
      .insert(leadBlocklist)
      .values({ pattern: row.pattern, kind: row.kind, reason: row.reason })
      .onConflictDoNothing();
    console.log(`✓ ${row.kind.padEnd(5)} ${row.pattern}  — ${row.reason}`);
  }
  console.log(`Seeded ${SEED.length} rules`);
}
main().then(() => process.exit(0));
