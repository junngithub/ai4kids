/**
 * One-off: write Gmail OAuth credentials into the encrypted `settings` vault.
 * Reads values from environment so secrets stay out of the script source.
 *
 *   GMAIL_CLIENT_ID=... \
 *   GMAIL_CLIENT_SECRET=... \
 *   GMAIL_REFRESH_TOKEN=... \
 *   GMAIL_USER=sales@tertiarycoures.com.sg \
 *   npx tsx --env-file=.env scripts/set-gmail-creds.ts
 */
import { setCredential, type CredentialKey } from "@/lib/secrets";

const entries: Array<[CredentialKey, string | undefined]> = [
  ["gmail_user", process.env.GMAIL_USER],
  ["gmail_client_id", process.env.GMAIL_CLIENT_ID],
  ["gmail_client_secret", process.env.GMAIL_CLIENT_SECRET],
  ["gmail_refresh_token", process.env.GMAIL_REFRESH_TOKEN],
];

async function main() {
  for (const [key, value] of entries) {
    if (!value) {
      console.log(`skip ${key} — not provided`);
      continue;
    }
    await setCredential(key, value);
    console.log(`wrote cred:${key} (${value.length} chars)`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
