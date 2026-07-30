/**
 * Turns the imported members' broadcast email preferences OFF (or restores them).
 *
 *   npx tsx scripts/legacy-import/set-imported-optins.ts --off              # dry run
 *   npx tsx scripts/legacy-import/set-imported-optins.ts --off --commit
 *   npx tsx scripts/legacy-import/set-imported-optins.ts --restore --commit
 *
 * Why: the 2,957 imported subscribers arrived carrying opt-ins they gave to the
 * OLD site — 1,515 newsletter, 1,227 simchas, 1,929 community alerts, some on
 * addresses untouched since 2012. Mailing them without a fresh signal is both a
 * consent problem and a deliverability one (bounces from stale addresses damage
 * the sending domain's reputation).
 *
 * They are not locked out. Anyone can turn these back on themselves at
 * /dashboard/settings (they kept their old password) or via
 * /newsletter/preferences?token=<unsubscribe_token> with no login at all.
 *
 * --restore re-derives the original flags from the legacy MemberList, so this is
 * fully reversible without a backup: the legacy database is the source of truth
 * and is never written to.
 *
 * Only BROADCAST preferences are touched. The three reactive ones —
 * ask_the_rabbi_answered, atr_comment_replies, blog_comment_notifications — stay
 * as they are, because they only fire in response to something the person
 * themselves posts, and silencing those would break a feature rather than
 * respect a consent boundary.
 */
import { connectLegacy, connectTarget, loadLegacyEnv, parseOptions, chunk } from "./lib";

/** Broadcast preferences: sent to many people, unprompted. */
const BROADCAST_COLUMNS = [
  "newsletter",
  "simchas",
  "shiva",
  "kosher_alerts",
  "tehillim",
  "eruv_status",
  "community_alerts",
  "community_events",
] as const;

interface LegacyMember {
  MemberID: number;
  Subscribe: boolean | null;
  Simchas: boolean | null;
  Condolences: boolean | null;
  KosherAlerts: boolean | null;
  Tehillim: boolean | null;
  EruvStatus: boolean | null;
  CommunityNotifications: boolean | null;
}

async function main() {
  const opts = parseOptions();
  const mode = process.argv.includes("--restore")
    ? "restore"
    : process.argv.includes("--off")
      ? "off"
      : null;

  if (!mode) {
    console.error("Specify --off or --restore (add --commit to write).");
    process.exit(1);
  }

  loadLegacyEnv();
  const target = connectTarget(opts.useTest);

  console.log("=".repeat(72));
  console.log(`IMPORTED OPT-INS — ${mode === "off" ? "SWITCH OFF" : "RESTORE FROM LEGACY"}`);
  console.log("=".repeat(72));
  console.log(`Target : ${target.host}`);
  console.log(`Mode   : ${opts.commit ? "COMMIT (will write)" : "DRY RUN (no writes)"}\n`);

  // Current state of the imported rows.
  const before = (await target.sql.query(
    `SELECT
       COUNT(*)::int AS total,
       ${BROADCAST_COLUMNS.map((c) => `COUNT(*) FILTER (WHERE ${c})::int AS ${c}`).join(",\n       ")}
     FROM email_subscribers WHERE old_member_id IS NOT NULL`
  )) as Record<string, number>[];

  console.log("CURRENT opt-ins among imported subscribers:");
  console.log(`  total imported rows : ${before[0].total}`);
  for (const c of BROADCAST_COLUMNS) {
    console.log(`  ${c.padEnd(18)} ${before[0][c]}`);
  }

  if (mode === "off") {
    const affected = (await target.sql.query(
      `SELECT COUNT(*)::int n FROM email_subscribers
        WHERE old_member_id IS NOT NULL
          AND (${BROADCAST_COLUMNS.join(" OR ")})`
    )) as { n: number }[];
    console.log(`\nRows with at least one broadcast opt-in to clear: ${affected[0].n}`);

    if (!opts.commit) {
      console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
      return;
    }

    await target.sql.query(
      `UPDATE email_subscribers
          SET ${BROADCAST_COLUMNS.map((c) => `${c} = false`).join(", ")}
        WHERE old_member_id IS NOT NULL
          AND (${BROADCAST_COLUMNS.join(" OR ")})`
    );
    console.log(`\nDONE. Cleared broadcast opt-ins on ${affected[0].n} imported subscribers.`);
    console.log("They can re-enable at /dashboard/settings or /newsletter/preferences?token=...");
    return;
  }

  // ---- restore ----------------------------------------------------------
  const pool = await connectLegacy("FrumToronto");
  const legacy: LegacyMember[] = (
    await pool.request().query(`
      SELECT MemberID, Subscribe, Simchas, Condolences, KosherAlerts,
             Tehillim, EruvStatus, CommunityNotifications
      FROM MemberList`)
  ).recordset;
  await pool.close();
  console.log(`\nRead ${legacy.length} legacy member rows to restore from.`);

  const importedIds = new Set(
    (
      (await target.sql.query(
        `SELECT old_member_id FROM email_subscribers WHERE old_member_id IS NOT NULL`
      )) as { old_member_id: number }[]
    ).map((r) => r.old_member_id)
  );
  const rows = legacy.filter((m) => importedIds.has(m.MemberID));
  console.log(`Matching imported subscribers: ${rows.length}`);

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }

  let n = 0;
  for (const batch of chunk(rows, 200)) {
    const values: unknown[] = [];
    const tuples: string[] = [];
    batch.forEach((m, i) => {
      const b = i * 8;
      tuples.push(
        `($${b + 1}::int,$${b + 2}::bool,$${b + 3}::bool,$${b + 4}::bool,$${b + 5}::bool,` +
          `$${b + 6}::bool,$${b + 7}::bool,$${b + 8}::bool)`
      );
      values.push(
        m.MemberID,
        m.Subscribe === true,
        m.Simchas === true,
        m.Condolences === true, // legacy "Condolences" is today's shiva list
        m.KosherAlerts === true,
        m.Tehillim === true,
        m.EruvStatus === true,
        m.CommunityNotifications === true
      );
    });

    await target.sql.query(
      `UPDATE email_subscribers AS s
          SET newsletter = v.newsletter,
              simchas = v.simchas,
              shiva = v.shiva,
              kosher_alerts = v.kosher_alerts,
              tehillim = v.tehillim,
              eruv_status = v.eruv_status,
              community_alerts = v.community_alerts
         FROM (VALUES ${tuples.join(",")})
              AS v(old_member_id, newsletter, simchas, shiva, kosher_alerts,
                   tehillim, eruv_status, community_alerts)
        WHERE s.old_member_id = v.old_member_id`,
      values
    );
    n += batch.length;
    console.log(`  restored ${n}/${rows.length}`);
  }

  console.log(`\nDONE. Restored legacy opt-ins on ${n} subscribers.`);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
