/**
 * Copy production's `events` table into the Neon TEST branch.
 *
 * So the admin UI can be exercised against the data it will actually meet —
 * real titles, real timestamps, the real pending queue — rather than fixtures.
 *
 * SAFETY
 * ------
 * The target endpoint is asserted to be the test branch before a single write.
 * Source is opened read-only in practice (SELECT only) and never written.
 * Run: node scripts/sync-events-to-test.mjs
 */
import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

const prodUrl = (() => {
  const env = {};
  config({ path: ".env", processEnv: env });
  return env.DATABASE_URL;
})();

const testUrl = (() => {
  const env = {};
  config({ path: ".env.test", processEnv: env });
  return env.DATABASE_URL;
})();

const TEST_ENDPOINT = "ep-still-block-ahs6wvfm";

if (!prodUrl || !testUrl) {
  throw new Error("Need DATABASE_URL in both .env and .env.test");
}
// The whole safety story in one line. If the test branch is ever recreated,
// this fails loudly rather than writing to production.
if (!testUrl.includes(TEST_ENDPOINT)) {
  throw new Error(`REFUSING: target is not the test branch (${TEST_ENDPOINT})`);
}
if (prodUrl.includes(TEST_ENDPOINT)) {
  throw new Error("REFUSING: source and target are the same branch");
}

const prod = neon(prodUrl);
const test = neon(testUrl);

const events = await prod`SELECT * FROM events ORDER BY id`;
console.log(`read ${events.length} events from production`);

// Foreign keys must resolve on the target or the insert throws. The branch has
// slightly fewer users than production, so any missing reference is nulled and
// reported rather than silently dropping the row.
const testUserIds = new Set(
  (await test`SELECT id FROM users`).map((r) => r.id)
);
const testShulIds = new Set((await test`SELECT id FROM shuls`).map((r) => r.id));

let nulledUsers = 0;
let nulledShuls = 0;

await test`DELETE FROM events`;

for (const e of events) {
  if (e.user_id != null && !testUserIds.has(e.user_id)) {
    e.user_id = null;
    nulledUsers++;
  }
  if (e.shul_id != null && !testShulIds.has(e.shul_id)) {
    e.shul_id = null;
    nulledShuls++;
  }

  const cols = Object.keys(e);
  const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
  const quoted = cols.map((c) => `"${c}"`).join(", ");
  await test.query(
    `INSERT INTO events (${quoted}) VALUES (${placeholders})`,
    cols.map((c) => e[c])
  );
}

// Keep the sequence ahead of the copied ids, or the next insert collides.
await test`SELECT setval('events_id_seq', (SELECT COALESCE(MAX(id), 1) FROM events))`;

const after = await test`SELECT count(*)::int n FROM events`;
const pending = await test`
  SELECT count(*)::int n FROM events WHERE approval_status IN ('pending','pending_edit')`;

console.log(`wrote ${after[0].n} events to the test branch`);
console.log(`  pending: ${pending[0].n}`);
if (nulledUsers) console.log(`  user_id nulled on ${nulledUsers} (submitter absent on branch)`);
if (nulledShuls) console.log(`  shul_id nulled on ${nulledShuls}`);
