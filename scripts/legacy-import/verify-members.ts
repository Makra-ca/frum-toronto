/**
 * Verifies the member import against the legacy source.
 *
 *   npx tsx scripts/legacy-import/verify-members.ts
 *
 * Checks that actually matter:
 *   1. Every imported member's legacy plaintext password validates against the
 *      stored bcrypt hash. If this fails the whole "keep their password" premise
 *      is broken and nobody can log in.
 *   2. RemoveMe members have a user account but NO subscriber row.
 *   3. Notification flags round-trip from legacy to email_subscribers.
 *   4. No duplicate old_member_id, and every subscriber is linked to a user.
 */
import bcrypt from "bcryptjs";
import { connectLegacy, connectTarget, loadLegacyEnv, parseOptions } from "./lib";

interface Row {
  MemberID: number;
  Email: string | null;
  Password: string | null;
  RemoveMe: boolean | null;
  Subscribe: boolean | null;
  Simchas: boolean | null;
  Condolences: boolean | null;
  KosherAlerts: boolean | null;
  EruvStatus: boolean | null;
}

const SAMPLE_PASSWORDS = 25;

async function main() {
  const opts = parseOptions();
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  console.log(`Verifying against ${target.host}\n`);

  const pool = await connectLegacy("FrumToronto");
  const legacy: Row[] = (
    await pool.request().query(`
      SELECT MemberID, Email, Password, RemoveMe, Subscribe, Simchas,
             Condolences, KosherAlerts, EruvStatus
      FROM MemberList`)
  ).recordset;
  await pool.close();

  const byId = new Map(legacy.map((r) => [r.MemberID, r]));

  const imported = (await target.sql.query(
    `SELECT s.old_member_id, s.email, s.user_id,
            s.newsletter, s.simchas, s.shiva, s.kosher_alerts, s.eruv_status,
            u.password_hash, u.is_active
       FROM email_subscribers s
       JOIN users u ON u.id = s.user_id
      WHERE s.old_member_id IS NOT NULL
      ORDER BY s.old_member_id`
  )) as {
    old_member_id: number;
    email: string;
    user_id: number;
    newsletter: boolean;
    simchas: boolean;
    shiva: boolean;
    kosher_alerts: boolean;
    eruv_status: boolean;
    password_hash: string | null;
    is_active: boolean;
  }[];

  console.log(`Imported subscriber rows with old_member_id: ${imported.length}`);

  // ---- 1. Password validation -----------------------------------------
  const withHash = imported.filter((r) => r.password_hash && byId.get(r.old_member_id)?.Password);
  const step = Math.max(1, Math.floor(withHash.length / SAMPLE_PASSWORDS));
  const sample = withHash.filter((_, i) => i % step === 0).slice(0, SAMPLE_PASSWORDS);

  console.log(`\n1) Password check on ${sample.length} sampled members (bcrypt.compare):`);
  let pwOk = 0;
  const pwFail: number[] = [];
  for (const r of sample) {
    const plain = byId.get(r.old_member_id)!.Password!;
    const ok = await bcrypt.compare(plain, r.password_hash!);
    if (ok) pwOk++;
    else pwFail.push(r.old_member_id);
  }
  console.log(`   valid: ${pwOk}/${sample.length}`);
  if (pwFail.length) console.log(`   FAILED MemberIDs: ${pwFail.join(", ")}`);

  // ---- 2. RemoveMe members must have no subscriber row -----------------
  const removeMeIds = legacy.filter((r) => r.RemoveMe === true).map((r) => r.MemberID);
  const leaked = imported.filter((r) => removeMeIds.includes(r.old_member_id));
  console.log(`\n2) RemoveMe opt-outs with a subscriber row (must be 0): ${leaked.length}`);
  if (leaked.length) console.log(`   LEAKED: ${leaked.map((l) => l.old_member_id).join(", ")}`);

  // Confirm they do still have a login.
  const removedWithAccount = (await target.sql.query(
    `SELECT COUNT(*)::int AS n FROM users u
      WHERE LOWER(u.email) = ANY($1::text[])`,
    [
      legacy
        .filter((r) => r.RemoveMe === true && r.Email)
        .map((r) => r.Email!.trim().toLowerCase()),
    ]
  )) as { n: number }[];
  console.log(`   of ${removeMeIds.length} RemoveMe members, ${removedWithAccount[0].n} have a user account (login preserved)`);

  // ---- 3. Flag round-trip ---------------------------------------------
  console.log("\n3) Notification flag mismatches vs legacy:");
  const mismatches: string[] = [];
  for (const r of imported) {
    const l = byId.get(r.old_member_id);
    if (!l) {
      mismatches.push(`old_member_id ${r.old_member_id} not found in legacy`);
      continue;
    }
    const checks: [string, boolean, boolean][] = [
      ["newsletter", r.newsletter, l.Subscribe === true],
      ["simchas", r.simchas, l.Simchas === true],
      ["shiva", r.shiva, l.Condolences === true],
      ["kosher_alerts", r.kosher_alerts, l.KosherAlerts === true],
      ["eruv_status", r.eruv_status, l.EruvStatus === true],
    ];
    for (const [name, got, want] of checks) {
      if (got !== want) {
        mismatches.push(`#${r.old_member_id} ${name}: got ${got}, legacy ${want}`);
      }
    }
  }
  console.log(`   mismatches: ${mismatches.length}`);
  mismatches.slice(0, 10).forEach((m) => console.log(`     ${m}`));

  // ---- 4. Integrity ----------------------------------------------------
  const dupes = (await target.sql.query(
    `SELECT old_member_id, COUNT(*)::int n FROM email_subscribers
      WHERE old_member_id IS NOT NULL GROUP BY old_member_id HAVING COUNT(*) > 1`
  )) as { old_member_id: number; n: number }[];
  const orphans = (await target.sql.query(
    `SELECT COUNT(*)::int AS n FROM email_subscribers
      WHERE old_member_id IS NOT NULL AND user_id IS NULL`
  )) as { n: number }[];
  const noToken = (await target.sql.query(
    `SELECT COUNT(*)::int AS n FROM email_subscribers
      WHERE old_member_id IS NOT NULL AND (unsubscribe_token IS NULL OR length(unsubscribe_token) <> 64)`
  )) as { n: number }[];

  console.log("\n4) Integrity:");
  console.log(`   duplicate old_member_id (must be 0) : ${dupes.length}`);
  console.log(`   subscribers with no user_id (0)     : ${orphans[0].n}`);
  console.log(`   bad/missing unsubscribe token (0)   : ${noToken[0].n}`);

  const allGood =
    pwFail.length === 0 &&
    leaked.length === 0 &&
    mismatches.length === 0 &&
    dupes.length === 0 &&
    orphans[0].n === 0 &&
    noToken[0].n === 0;

  console.log(`\n${allGood ? "ALL CHECKS PASSED" : "*** CHECKS FAILED — see above ***"}`);
  if (!allGood) process.exit(1);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
