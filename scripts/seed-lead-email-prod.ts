/**
 * One-off: push the new lead-email subject template and lead_source_labels
 * map to production, without depending on whatever state the local DB is in.
 *
 * Usage (env via npm script or `set -a; source .env; set +a; ...`):
 *   REMOTE_SYNC_URL=https://www.tertiaryinfotech.com \
 *   SYNC_API_TOKEN=<token> \
 *   npx tsx scripts/seed-lead-email-prod.ts
 *
 * Falls back to ADMIN_EMAIL + ADMIN_PASSWORD Basic auth if no token.
 */

import { LEAD_EMAIL_DEFAULTS, DEFAULT_LEAD_SOURCE_LABELS, LEAD_SOURCE_LABELS_KEY } from "../src/lib/site-settings";

function getAuth(): string {
  const token = process.env.SYNC_API_TOKEN;
  if (token) return `Bearer ${token}`;
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email && password) return `Basic ${Buffer.from(`${email}:${password}`).toString("base64")}`;
  throw new Error("Set SYNC_API_TOKEN or ADMIN_EMAIL+ADMIN_PASSWORD in .env");
}

async function main() {
  const baseUrl = process.env.REMOTE_SYNC_URL?.replace(/\/$/, "");
  if (!baseUrl) throw new Error("REMOTE_SYNC_URL is not set");

  const entries = [
    { key: "lead_email_subject", value: LEAD_EMAIL_DEFAULTS.subject },
    { key: "lead_email_body", value: LEAD_EMAIL_DEFAULTS.body },
    { key: LEAD_SOURCE_LABELS_KEY, value: DEFAULT_LEAD_SOURCE_LABELS },
  ];

  console.log(`Pushing ${entries.length} settings to ${baseUrl}…`);
  for (const e of entries) {
    console.log(`  - ${e.key}`);
  }

  const res = await fetch(`${baseUrl}/api/admin/sync/settings`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: getAuth() },
    body: JSON.stringify({ entries }),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`FAILED ${res.status}: ${text}`);
    process.exit(1);
  }
  console.log(`OK: ${text}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
