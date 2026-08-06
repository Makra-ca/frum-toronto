/**
 * Marks existing OAuth (Google) signups as email-verified.
 *
 *   npx tsx scripts/backfill-oauth-email-verified.ts            # dry run
 *   npx tsx scripts/backfill-oauth-email-verified.ts --commit
 *   npx tsx scripts/backfill-oauth-email-verified.ts --commit --test
 *
 * Why: Auth.js core hardcodes `emailVerified: null` when it creates a user
 * from an OAuth profile (handle-login.js), overriding what our Google
 * provider's profile() returns. So every Google signup landed unverified, and
 * since the submission gate went in (assertCanPost) those accounts have been
 * unable to post anything at all.
 *
 * src/lib/auth/oauth-email-verification.ts fixes this going forward, from
 * events.linkAccount. This script covers the accounts created before it.
 *
 * The timestamp used is each account's own `created_at` — the moment Google
 * signed them in and vouched for the address — not now(), so the record says
 * when we actually learned the address was good.
 *
 * Only rows where email_verified IS NULL are touched, so an existing
 * verification (e.g. a legacy-import date) is never overwritten.
 *
 * Reversal: the dry run prints the exact ids; re-null them with
 *   UPDATE users SET email_verified = NULL WHERE id IN (...);
 */
import { announce, connectTarget, parseOptions } from "./legacy-import/lib";

// Providers whose own verification we accept as proof of the mailbox.
// `credentials` is deliberately absent: a password signup proves nothing
// about the address until they click the link we email them.
const TRUSTED_PROVIDERS = ["google"];

interface Row {
  id: number;
  email: string;
  created_at: Date;
  provider: string;
}

async function main() {
  const opts = parseOptions();
  const target = connectTarget(opts.useTest);
  announce("BACKFILL OAUTH EMAIL VERIFICATION", opts, target);

  const rows = (await target.sql`
    SELECT DISTINCT ON (u.id) u.id, u.email, u.created_at, a.provider
    FROM users u
    JOIN accounts a ON a.user_id = u.id
    WHERE u.email_verified IS NULL
      AND a.provider = ANY(${TRUSTED_PROVIDERS})
    ORDER BY u.id
  `) as Row[];

  if (rows.length === 0) {
    console.log("Nothing to do — no unverified OAuth accounts.");
    return;
  }

  console.log(`${rows.length} unverified OAuth account(s):\n`);
  for (const row of rows) {
    console.log(
      `  #${String(row.id).padEnd(6)} ${row.email.padEnd(36)} ${row.provider}  ` +
        `signed up ${new Date(row.created_at).toISOString().slice(0, 10)}`
    );
  }
  console.log("");

  if (!opts.commit) {
    console.log("DRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }

  // One statement, still guarded on IS NULL so a concurrent verification
  // (someone clicking a resend link right now) wins rather than being clobbered.
  const updated = (await target.sql`
    UPDATE users
    SET email_verified = created_at
    WHERE id = ANY(${rows.map((r) => r.id)})
      AND email_verified IS NULL
    RETURNING id
  `) as { id: number }[];

  console.log(`Verified ${updated.length} account(s).`);

  const remaining = (await target.sql`
    SELECT COUNT(*)::int AS n
    FROM users u
    JOIN accounts a ON a.user_id = u.id
    WHERE u.email_verified IS NULL AND a.provider = ANY(${TRUSTED_PROVIDERS})
  `) as { n: number }[];

  console.log(`Remaining unverified OAuth accounts: ${remaining[0].n}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
