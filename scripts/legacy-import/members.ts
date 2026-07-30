/**
 * Imports the 3,307 legacy members from FrumToronto.dbo.MemberList into
 * `users` + linked `email_subscribers`.
 *
 *   npx tsx scripts/legacy-import/members.ts                 # dry run
 *   npx tsx scripts/legacy-import/members.ts --commit        # write
 *   npx tsx scripts/legacy-import/members.ts --limit=50 --commit
 *
 * Decisions baked in here, all of them deliberate:
 *
 * - Legacy passwords are stored in PLAINTEXT. They are bcrypt-hashed at cost 12
 *   on the way in — identical to /api/auth/register — so members can log in
 *   with the password they already know and the plaintext is never persisted.
 *
 * - RemoveMe=1 members (156) asked the old site to stop emailing them. They get
 *   a user account so their login still works, but NO email_subscribers row at
 *   all, which is what actually guarantees they receive nothing. Honouring that
 *   opt-out matters more than completeness of the subscriber list.
 *
 * - `newsletter` is set explicitly from the legacy Subscribe flag rather than
 *   left to its column default of TRUE. Relying on the default would silently
 *   opt in the ~1,674 members who never subscribed.
 *
 * - 141 emails appear on more than one member row (177 surplus rows). The newest
 *   row wins; the rest are reported, not merged. Merging notification flags
 *   across rows could re-enable something a member had deliberately turned off.
 *
 * - FrumToronto.dbo.Members (12 rows, with Admin/SuperAdmin bits) is NOT touched.
 *   Creating admin accounts is a security decision, not a migration one.
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import {
  announce,
  chunk,
  connectLegacy,
  connectTarget,
  fit,
  loadLegacyEnv,
  parseOptions,
} from "./lib";

interface LegacyMember {
  MemberID: number;
  Active: boolean | null;
  RemoveMe: boolean | null;
  Trusted: boolean | null;
  Confirmed: boolean | null;
  CreatedDate: Date | null;
  FirstName: string | null;
  LastName: string | null;
  Email: string | null;
  Password: string | null;
  PhoneNumber: string | null;
  CellPhone: string | null;
  Subscribe: boolean | null;
  Simchas: boolean | null;
  Condolences: boolean | null;
  KosherAlerts: boolean | null;
  Tehillim: boolean | null;
  EruvStatus: boolean | null;
  CommunityNotifications: boolean | null;
}

const BCRYPT_COST = 12; // matches src/app/api/auth/register/route.ts
const HASH_CONCURRENCY = 8;

// A deliberately permissive check — the goal is to exclude junk like "" and
// "none", not to adjudicate RFC 5322.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(raw: string | null): string | null {
  if (!raw) return null;
  const e = raw.trim().toLowerCase();
  return EMAIL_RE.test(e) ? e : null;
}

function pickPhone(m: LegacyMember): string | null {
  const raw = (m.PhoneNumber || m.CellPhone || "").trim();
  return raw ? fit(raw, 20) : null; // users.phone is varchar(20)
}

async function hashAll(passwords: (string | null)[]): Promise<(string | null)[]> {
  const out: (string | null)[] = new Array(passwords.length).fill(null);
  let cursor = 0;

  async function worker() {
    while (cursor < passwords.length) {
      const i = cursor++;
      const pw = passwords[i];
      if (pw && pw.length > 0) {
        out[i] = await bcrypt.hash(pw, BCRYPT_COST);
      }
      if (i > 0 && i % 250 === 0) {
        console.log(`    hashed ${i}/${passwords.length}`);
      }
    }
  }

  await Promise.all(Array.from({ length: HASH_CONCURRENCY }, worker));
  return out;
}

async function main() {
  const opts = parseOptions();
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  announce("LEGACY MEMBER IMPORT — MemberList -> users + email_subscribers", opts, target);

  const pool = await connectLegacy("FrumToronto");

  const rows: LegacyMember[] = (
    await pool.request().query(`
      SELECT MemberID, Active, RemoveMe, Trusted, Confirmed, CreatedDate,
             FirstName, LastName, Email, Password, PhoneNumber, CellPhone,
             Subscribe, Simchas, Condolences, KosherAlerts, Tehillim,
             EruvStatus, CommunityNotifications
      FROM MemberList
      ORDER BY MemberID
    `)
  ).recordset;
  await pool.close();

  console.log(`Read ${rows.length} legacy member rows.\n`);

  // ---- Filter to rows with a usable email -------------------------------
  const skippedNoEmail: LegacyMember[] = [];
  const usable: { m: LegacyMember; email: string }[] = [];
  for (const m of rows) {
    const email = normalizeEmail(m.Email);
    if (!email) skippedNoEmail.push(m);
    else usable.push({ m, email });
  }

  // ---- Deduplicate by email, newest row wins ---------------------------
  const byEmail = new Map<string, { m: LegacyMember; email: string }>();
  const droppedDuplicates: { email: string; keptId: number; droppedId: number }[] = [];

  for (const cand of usable) {
    const existing = byEmail.get(cand.email);
    if (!existing) {
      byEmail.set(cand.email, cand);
      continue;
    }
    const newer =
      (cand.m.CreatedDate?.getTime() ?? 0) > (existing.m.CreatedDate?.getTime() ?? 0) ||
      ((cand.m.CreatedDate?.getTime() ?? 0) === (existing.m.CreatedDate?.getTime() ?? 0) &&
        cand.m.MemberID > existing.m.MemberID);
    const keep = newer ? cand : existing;
    const drop = newer ? existing : cand;
    byEmail.set(cand.email, keep);
    droppedDuplicates.push({
      email: cand.email,
      keptId: keep.m.MemberID,
      droppedId: drop.m.MemberID,
    });
  }

  // ---- Exclude emails that already exist in the target -----------------
  const existingRows = (await target.sql.query(
    `SELECT LOWER(email) AS email FROM users`
  )) as { email: string }[];
  const existingEmails = new Set(existingRows.map((r) => r.email));

  const existingSubRows = (await target.sql.query(
    `SELECT old_member_id FROM email_subscribers WHERE old_member_id IS NOT NULL`
  )) as { old_member_id: number }[];
  const alreadyImported = new Set(existingSubRows.map((r) => r.old_member_id));

  let candidates = [...byEmail.values()].filter(
    (c) => !existingEmails.has(c.email) && !alreadyImported.has(c.m.MemberID)
  );
  const skippedExisting = byEmail.size - candidates.length;

  if (opts.limit) candidates = candidates.slice(0, opts.limit);

  const optedOut = candidates.filter((c) => c.m.RemoveMe === true);

  // ---- Report ----------------------------------------------------------
  console.log("PLAN");
  console.log(`  legacy rows read            : ${rows.length}`);
  console.log(`  skipped, no/invalid email   : ${skippedNoEmail.length}`);
  console.log(`  duplicate rows collapsed    : ${droppedDuplicates.length}`);
  console.log(`  skipped, already in target  : ${skippedExisting}`);
  console.log(`  -> users to create          : ${candidates.length}`);
  console.log(`  -> subscribers to create    : ${candidates.length - optedOut.length}`);
  console.log(`     (${optedOut.length} RemoveMe members get an account but no subscriber row)`);

  const withPassword = candidates.filter((c) => (c.m.Password || "").length > 0).length;
  console.log(`  with a legacy password      : ${withPassword}`);
  console.log(`  no password (reset needed)  : ${candidates.length - withPassword}`);

  const prefTotals = {
    newsletter: 0,
    simchas: 0,
    shiva: 0,
    kosherAlerts: 0,
    tehillim: 0,
    eruvStatus: 0,
    communityAlerts: 0,
  };
  for (const c of candidates) {
    if (c.m.RemoveMe === true) continue;
    if (c.m.Subscribe) prefTotals.newsletter++;
    if (c.m.Simchas) prefTotals.simchas++;
    if (c.m.Condolences) prefTotals.shiva++;
    if (c.m.KosherAlerts) prefTotals.kosherAlerts++;
    if (c.m.Tehillim) prefTotals.tehillim++;
    if (c.m.EruvStatus) prefTotals.eruvStatus++;
    if (c.m.CommunityNotifications) prefTotals.communityAlerts++;
  }
  console.log("\n  resulting opt-ins (people who will receive each type):");
  for (const [k, v] of Object.entries(prefTotals)) {
    console.log(`    ${k.padEnd(16)} ${v}`);
  }

  if (droppedDuplicates.length) {
    console.log("\n  sample collapsed duplicates (kept -> dropped MemberID):");
    for (const d of droppedDuplicates.slice(0, 8)) {
      console.log(`    ${d.email.padEnd(38)} ${d.keptId} -> ${d.droppedId}`);
    }
  }

  console.log("\n  sample of rows to insert:");
  for (const c of candidates.slice(0, 5)) {
    console.log(
      `    #${c.m.MemberID} ${c.email} | ${c.m.FirstName || ""} ${c.m.LastName || ""} | ` +
        `active=${c.m.Active !== false} removeMe=${c.m.RemoveMe === true} trusted=${c.m.Trusted === true}`
    );
  }

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }
  if (candidates.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  // ---- Hash passwords --------------------------------------------------
  console.log(`\nHashing ${withPassword} passwords at bcrypt cost ${BCRYPT_COST}...`);
  const hashes = await hashAll(candidates.map((c) => c.m.Password));
  console.log("  hashing complete.");

  // ---- Insert users ----------------------------------------------------
  console.log("\nInserting users...");
  const emailToId = new Map<string, number>();
  let userCount = 0;

  for (const batch of chunk(candidates.map((c, i) => ({ c, hash: hashes[i] })), 200)) {
    const values: unknown[] = [];
    const tuples: string[] = [];

    batch.forEach(({ c, hash }, i) => {
      const b = i * 8;
      tuples.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8})`
      );
      values.push(
        c.email,
        hash,
        c.m.FirstName ? fit(c.m.FirstName.trim(), 100) : null,
        c.m.LastName ? fit(c.m.LastName.trim(), 100) : null,
        pickPhone(c.m),
        c.m.Active !== false,
        c.m.Trusted === true,
        // Confirmed on the old site was a real email confirmation, so it carries
        // over and those members skip re-verification. The legacy schema records
        // only the fact, not the moment, so their signup date is the honest
        // approximation for *when* — CreatedDate is a datetime column here, not
        // one of the OLE floats used elsewhere in this database.
        c.m.Confirmed === true ? c.m.CreatedDate ?? new Date() : null
      );
    });

    const inserted = (await target.sql.query(
      `INSERT INTO users
         (email, password_hash, first_name, last_name, phone, is_active, is_trusted, email_verified)
       VALUES ${tuples.join(",")}
       ON CONFLICT (email) DO NOTHING
       RETURNING id, email`,
      values
    )) as { id: number; email: string }[];

    for (const r of inserted) emailToId.set(r.email.toLowerCase(), r.id);
    userCount += inserted.length;
    console.log(`  users inserted: ${userCount}/${candidates.length}`);
  }

  // ---- Insert subscribers ---------------------------------------------
  const subscriberRows = candidates.filter((c) => c.m.RemoveMe !== true);
  console.log(`\nInserting ${subscriberRows.length} email_subscribers...`);
  let subCount = 0;

  for (const batch of chunk(subscriberRows, 200)) {
    const values: unknown[] = [];
    const tuples: string[] = [];
    let n = 0;

    for (const c of batch) {
      const userId = emailToId.get(c.email);
      if (!userId) continue; // user insert was skipped by ON CONFLICT
      const b = n * 16;
      n++;
      tuples.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},` +
          `$${b + 9},$${b + 10},$${b + 11},$${b + 12},$${b + 13},$${b + 14},$${b + 15},$${b + 16})`
      );
      values.push(
        userId,
        c.email,
        c.m.FirstName ? fit(c.m.FirstName.trim(), 50) : null,
        c.m.LastName ? fit(c.m.LastName.trim(), 50) : null,
        c.m.Subscribe === true, // newsletter — explicit, never the column default
        c.m.Simchas === true,
        c.m.Condolences === true, // legacy "Condolences" is today's shiva list
        c.m.KosherAlerts === true,
        c.m.Tehillim === true,
        c.m.EruvStatus === true,
        c.m.CommunityNotifications === true, // -> community_alerts
        false, // community_events: no legacy equivalent, so left off
        c.m.Active !== false,
        crypto.randomBytes(32).toString("hex"),
        c.m.MemberID,
        false // business_deals
      );
    }

    if (n === 0) continue;

    await target.sql.query(
      `INSERT INTO email_subscribers
         (user_id, email, first_name, last_name, newsletter, simchas, shiva,
          kosher_alerts, tehillim, eruv_status, community_alerts, community_events,
          is_active, unsubscribe_token, old_member_id, business_deals)
       VALUES ${tuples.join(",")}
       ON CONFLICT (email) DO NOTHING`,
      values
    );
    subCount += n;
    console.log(`  subscribers inserted: ${subCount}/${subscriberRows.length}`);
  }

  console.log(`\nDONE. users +${userCount}, email_subscribers +${subCount}`);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
