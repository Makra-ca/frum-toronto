/**
 * Marks the imported legacy members as email-verified.
 *
 *   npx tsx scripts/legacy-import/verify-imported-members.ts            # dry run
 *   npx tsx scripts/legacy-import/verify-imported-members.ts --commit
 *
 * Why: submissions are being gated on `email_verified`, and 3,080 of 3,146
 * accounts are unverified — almost all of them imported members. Without this,
 * turning the gate on would silence essentially the entire community at once.
 *
 * These people were real members of the old site, which had their address on
 * file and mailed them, so that is treated as verification. The timestamp used is
 * their **legacy signup date**, not now(), so the record says "this address was
 * on file since then" rather than implying they clicked a link today.
 *
 * Only rows where email_verified IS NULL are touched, so an existing
 * verification is never overwritten.
 *
 * Reversal: `imported-members.txt` (written by export-imported-members.ts before
 * this ran) records exactly who was verified beforehand, so the change can be
 * undone precisely from that snapshot.
 */
import {
  announce,
  chunk,
  connectLegacy,
  connectTarget,
  loadLegacyEnv,
  parseOptions,
} from "./lib";

async function main() {
  const opts = parseOptions();
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  announce("MARK IMPORTED MEMBERS AS EMAIL-VERIFIED", opts, target);

  const before = (await target.sql.query(
    `SELECT
       COUNT(*)::int AS imported,
       COUNT(*) FILTER (WHERE u.email_verified IS NOT NULL)::int AS already_verified,
       COUNT(*) FILTER (WHERE u.email_verified IS NULL)::int AS to_verify
     FROM users u
     JOIN email_subscribers s ON s.user_id = u.id
     WHERE s.old_member_id IS NOT NULL`
  )) as { imported: number; already_verified: number; to_verify: number }[];

  console.log("BEFORE");
  console.log(`  imported members  : ${before[0].imported}`);
  console.log(`  already verified  : ${before[0].already_verified}`);
  console.log(`  to verify         : ${before[0].to_verify}`);

  // Legacy signup dates, used as the verification timestamp.
  const pool = await connectLegacy("FrumToronto");
  const legacy = (
    await pool.request().query(`SELECT MemberID, CreatedDate, Email FROM MemberList`)
  ).recordset as { MemberID: number; CreatedDate: Date | null; Email: string | null }[];
  await pool.close();
  const legacy0 = legacy;

  const dateByLegacyId = new Map(legacy.map((r) => [r.MemberID, r.CreatedDate]));

  const pending = (await target.sql.query(
    `SELECT u.id, s.old_member_id
       FROM users u
       JOIN email_subscribers s ON s.user_id = u.id
      WHERE s.old_member_id IS NOT NULL AND u.email_verified IS NULL`
  )) as { id: number; old_member_id: number }[];

  const withDate = pending.filter((p) => dateByLegacyId.get(p.old_member_id));
  console.log(
    `\n  of ${pending.length} pending, ${withDate.length} have a legacy signup date; ` +
      `${pending.length - withDate.length} will use the import date as a fallback`
  );

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }

  let done = 0;
  for (const batch of chunk(pending, 200)) {
    const values: unknown[] = [];
    const tuples: string[] = [];
    batch.forEach((p, i) => {
      const b = i * 2;
      tuples.push(`($${b + 1}::int, $${b + 2}::timestamp)`);
      const d = dateByLegacyId.get(p.old_member_id);
      values.push(p.id, (d ?? new Date()).toISOString());
    });

    await target.sql.query(
      `UPDATE users AS u
          SET email_verified = v.verified_at
         FROM (VALUES ${tuples.join(",")}) AS v(id, verified_at)
        WHERE u.id = v.id AND u.email_verified IS NULL`,
      values
    );
    done += batch.length;
    console.log(`  verified ${done}/${pending.length}`);
  }

  // The email opt-outs (RemoveMe on the old site) got a user account but no
  // subscriber row, so old_member_id cannot identify them. They are the same
  // cohort — real members whose address the old site held — so they are matched
  // by email against MemberList instead and verified with the same reasoning.
  const legacyEmails = legacy0
    .map((r) => (r.Email || "").trim().toLowerCase())
    .filter((e) => e.includes("@"));

  const optOutPending = (await target.sql.query(
    `SELECT u.id, LOWER(u.email) AS email
       FROM users u
      WHERE u.email_verified IS NULL
        AND LOWER(u.email) = ANY($1::text[])
        AND NOT EXISTS (SELECT 1 FROM email_subscribers s WHERE s.user_id = u.id)`,
    [legacyEmails]
  )) as { id: number; email: string }[];

  console.log(`\n  legacy members with no subscriber row still unverified: ${optOutPending.length}`);

  if (optOutPending.length > 0) {
    const dateByEmail = new Map(
      legacy0
        .filter((r) => r.Email)
        .map((r) => [r.Email!.trim().toLowerCase(), r.CreatedDate])
    );
    let n = 0;
    for (const batch of chunk(optOutPending, 200)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((p, i) => {
        const b = i * 2;
        tuples.push(`($${b + 1}::int, $${b + 2}::timestamp)`);
        values.push(p.id, (dateByEmail.get(p.email) ?? new Date()).toISOString());
      });
      await target.sql.query(
        `UPDATE users AS u SET email_verified = v.verified_at
           FROM (VALUES ${tuples.join(",")}) AS v(id, verified_at)
          WHERE u.id = v.id AND u.email_verified IS NULL`,
        values
      );
      n += batch.length;
      console.log(`  verified opt-outs ${n}/${optOutPending.length}`);
    }
  }

  const after = (await target.sql.query(
    `SELECT COUNT(*) FILTER (WHERE u.email_verified IS NULL)::int AS still_unverified
       FROM users u JOIN email_subscribers s ON s.user_id = u.id
      WHERE s.old_member_id IS NOT NULL`
  )) as { still_unverified: number }[];

  const whole = (await target.sql.query(
    `SELECT COUNT(*)::int total,
            COUNT(*) FILTER (WHERE email_verified IS NOT NULL)::int verified
       FROM users`
  )) as { total: number; verified: number }[];

  console.log(`\nAFTER`);
  console.log(`  imported still unverified : ${after[0].still_unverified}`);
  console.log(`  whole table verified      : ${whole[0].verified}/${whole[0].total}`);
  console.log(`\nDONE. Reverse from imported-members.txt if needed.`);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
