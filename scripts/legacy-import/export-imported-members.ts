/**
 * Writes a snapshot of every imported member to a text file, so the cohort stays
 * identifiable no matter what later changes to their rows.
 *
 *   npx tsx scripts/legacy-import/export-imported-members.ts
 *   npx tsx scripts/legacy-import/export-imported-members.ts --out=path.txt
 *
 * Taken BEFORE marking the cohort email-verified, so there is a record of what
 * their state was at import time.
 *
 * The file contains ~2,957 real email addresses. It is written to the repo root
 * and added to .gitignore, deliberately: a private repo still means committed
 * PII is effectively permanent in git history.
 */
import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import { connectLegacy, loadLegacyEnv } from "./lib";
import { db } from "../../src/lib/db";
import { users, emailSubscribers } from "../../src/lib/db/schema";
import { eq, isNotNull, asc } from "drizzle-orm";

const outArg = process.argv.find((a) => a.startsWith("--out="));
const outPath = path.resolve(outArg ? outArg.split("=")[1] : "imported-members.txt");

/**
 * --with-passwords additionally writes imported-members-passwords.txt containing
 * each member's original legacy password.
 *
 * A separate file on purpose: the roster above is useful for tracking who came
 * across and can be handled fairly freely, whereas a list of ~2,900 live
 * plaintext passwords should not be casually opened, shared or copied. Keeping
 * them apart means the useful file does not carry the dangerous payload.
 *
 * The plaintext already exists in the legacy MSSQL database, so this creates no
 * new secret — but a flat file is far easier to leak by accident than a database
 * behind credentials. Both files are gitignored.
 */
const withPasswords = process.argv.includes("--with-passwords");
const pwPath = path.resolve("imported-members-passwords.txt");

async function main() {
  const rows = await db
    .select({
      legacyId: emailSubscribers.oldMemberId,
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      isActive: users.isActive,
      emailVerified: users.emailVerified,
      hasPassword: users.passwordHash,
      createdAt: users.createdAt,
      newsletter: emailSubscribers.newsletter,
      simchas: emailSubscribers.simchas,
      shiva: emailSubscribers.shiva,
      kosherAlerts: emailSubscribers.kosherAlerts,
      tehillim: emailSubscribers.tehillim,
      eruvStatus: emailSubscribers.eruvStatus,
      communityAlerts: emailSubscribers.communityAlerts,
    })
    .from(emailSubscribers)
    .innerJoin(users, eq(users.id, emailSubscribers.userId))
    .where(isNotNull(emailSubscribers.oldMemberId))
    .orderBy(asc(emailSubscribers.oldMemberId));

  // Members who opted out of email got a user account but no subscriber row, so
  // the join above misses them. They are still part of the imported cohort.
  const optOuts = await db
    .select({
      userId: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.id));

  const linkedIds = new Set(rows.map((r) => r.userId));
  const importWindowStart = rows.reduce<Date | null>((min, r) => {
    if (!r.createdAt) return min;
    return min === null || r.createdAt < min ? r.createdAt : min;
  }, null);

  // Identify opt-outs by "created during the import window and not linked to a
  // subscriber row". Approximate by design — flagged as such in the file.
  const probableOptOuts = optOuts.filter(
    (u) =>
      !linkedIds.has(u.userId) &&
      importWindowStart !== null &&
      u.createdAt !== null &&
      u.createdAt >= importWindowStart
  );

  const yn = (v: unknown) => (v ? "Y" : "n");
  const lines: string[] = [];

  lines.push("FrumToronto — imported legacy members");
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push("");
  lines.push(
    "Source: FrumToronto.dbo.MemberList, imported 2026-07-29/30. 'legacy' is the " +
      "original MemberID, which is the durable way to identify these people later."
  );
  lines.push(
    "Broadcast email preferences were switched OFF for the whole cohort after import; " +
      "the flags below are the state at export time, not the legacy opt-ins."
  );
  lines.push("");
  lines.push(`Linked members (user + subscriber row): ${rows.length}`);
  lines.push(`Probable email opt-outs (user, no subscriber row): ${probableOptOuts.length}`);
  lines.push("");
  lines.push(
    [
      "legacy".padStart(7),
      "userId".padStart(7),
      "active".padStart(6),
      "verified".padStart(8),
      "pw".padStart(3),
      "news".padStart(4),
      "simc".padStart(4),
      "shiv".padStart(4),
      "kosh".padStart(4),
      "tehi".padStart(4),
      "eruv".padStart(4),
      "calr".padStart(4),
      "email",
    ].join(" ") + "  name"
  );
  lines.push("-".repeat(120));

  for (const r of rows) {
    lines.push(
      [
        String(r.legacyId ?? "").padStart(7),
        String(r.userId).padStart(7),
        yn(r.isActive).padStart(6),
        yn(r.emailVerified).padStart(8),
        yn(r.hasPassword).padStart(3),
        yn(r.newsletter).padStart(4),
        yn(r.simchas).padStart(4),
        yn(r.shiva).padStart(4),
        yn(r.kosherAlerts).padStart(4),
        yn(r.tehillim).padStart(4),
        yn(r.eruvStatus).padStart(4),
        yn(r.communityAlerts).padStart(4),
        r.email,
      ].join(" ") +
        "  " +
        `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim()
    );
  }

  lines.push("");
  lines.push("PROBABLE EMAIL OPT-OUTS (RemoveMe on the old site: account created, no subscriber row)");
  lines.push("Identified by creation time rather than a stored flag, so treat as approximate.");
  lines.push("-".repeat(120));
  for (const u of probableOptOuts) {
    lines.push(
      [String(u.userId).padStart(7), yn(u.isActive).padStart(6), u.email].join(" ") +
        "  " +
        `${u.firstName ?? ""} ${u.lastName ?? ""}`.trim()
    );
  }

  fs.writeFileSync(outPath, lines.join("\n") + "\n", "utf8");

  if (withPasswords) {
    loadLegacyEnv();
    const pool = await connectLegacy("FrumToronto");
    const legacyRows = (
      await pool.request().query(`SELECT MemberID, Email, Password FROM MemberList`)
    ).recordset as { MemberID: number; Email: string | null; Password: string | null }[];
    await pool.close();

    const pwByLegacyId = new Map(legacyRows.map((r) => [r.MemberID, r.Password]));
    const pwByEmail = new Map(
      legacyRows
        .filter((r) => r.Email)
        .map((r) => [r.Email!.trim().toLowerCase(), r.Password])
    );

    const pwLines: string[] = [];
    pwLines.push("FrumToronto — imported members: ORIGINAL LEGACY PASSWORDS");
    pwLines.push(`Generated: ${new Date().toISOString()}`);
    pwLines.push("");
    pwLines.push("*** SENSITIVE — live credentials in plaintext. ***");
    pwLines.push("These are the passwords members are able to log in with right now.");
    pwLines.push("They came from the old site, which stored them unhashed. Many people");
    pwLines.push("reuse passwords, so treat this as a list of working credentials for");
    pwLines.push("other services too, not just this one. Do not email or copy it, and");
    pwLines.push("delete it once you are done. Gitignored.");
    pwLines.push("");
    pwLines.push("legacy".padStart(7) + " " + "userId".padStart(7) + " " + "email".padEnd(38) + " password");
    pwLines.push("-".repeat(110));

    let withPw = 0;
    let withoutPw = 0;
    for (const r of rows) {
      const pw =
        (r.legacyId != null ? pwByLegacyId.get(r.legacyId) : null) ??
        pwByEmail.get(r.email.toLowerCase()) ??
        null;
      if (pw) withPw++;
      else withoutPw++;
      pwLines.push(
        String(r.legacyId ?? "").padStart(7) +
          " " +
          String(r.userId).padStart(7) +
          " " +
          r.email.padEnd(38) +
          " " +
          (pw ?? "(none — must use forgot-password)")
      );
    }

    pwLines.push("");
    pwLines.push("OPT-OUTS (account exists, no subscriber row)");
    pwLines.push("-".repeat(110));
    for (const u of probableOptOuts) {
      const pw = pwByEmail.get(u.email.toLowerCase()) ?? null;
      pwLines.push(
        String(u.userId).padStart(15) +
          " " +
          u.email.padEnd(38) +
          " " +
          (pw ?? "(none — must use forgot-password)")
      );
    }

    fs.writeFileSync(pwPath, pwLines.join("\n") + "\n", "utf8");
    console.log(`Wrote ${pwPath}`);
    console.log(`  with a password      : ${withPw}`);
    console.log(`  no password on file  : ${withoutPw}`);
  }

  console.log(`Wrote ${outPath}`);
  console.log(`  linked members       : ${rows.length}`);
  console.log(`  probable opt-outs    : ${probableOptOuts.length}`);
  console.log(`  currently verified   : ${rows.filter((r) => r.emailVerified).length}`);
  console.log(`  currently active     : ${rows.filter((r) => r.isActive).length}`);
  console.log(`  has a password       : ${rows.filter((r) => r.hasPassword).length}`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
