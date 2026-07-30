/**
 * Lists the blocked (is_active = false) accounts, so they can be reviewed before
 * anyone decides to unblock them.
 *
 *   npx tsx scripts/legacy-import/verify-blocked-users.ts
 *
 * `is_active = false` is this project's ban flag: it blocks both password and
 * Google sign-in. The legacy import carried it over from MemberList.Active, so
 * most of these are 15-year-old states rather than deliberate decisions.
 */
import "dotenv/config";
import { db } from "../../src/lib/db";
import { users, emailSubscribers } from "../../src/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import {
  buildUserStatusCondition,
  parseUserStatus,
} from "../../src/lib/admin/user-search";

async function main() {
  const condition = buildUserStatusCondition(parseUserStatus("blocked"));

  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      createdAt: users.createdAt,
      hasPassword: sql<boolean>`${users.passwordHash} IS NOT NULL`,
      oldMemberId: emailSubscribers.oldMemberId,
    })
    .from(users)
    .leftJoin(emailSubscribers, eq(emailSubscribers.userId, users.id))
    .where(condition)
    .orderBy(users.id);

  console.log(`Blocked accounts (is_active = false): ${rows.length}\n`);
  console.log(
    "id".padStart(6),
    "name".padEnd(28),
    "email".padEnd(38),
    "pw".padEnd(3),
    "legacy id"
  );
  for (const r of rows) {
    const name = [r.firstName, r.lastName].filter(Boolean).join(" ") || "(no name)";
    console.log(
      String(r.id).padStart(6),
      name.slice(0, 27).padEnd(28),
      r.email.slice(0, 37).padEnd(38),
      (r.hasPassword ? "yes" : "no").padEnd(3),
      r.oldMemberId ?? "(not imported)"
    );
  }

  const imported = rows.filter((r) => r.oldMemberId !== null).length;
  console.log(`\nof these, ${imported} came from the legacy import and ${rows.length - imported} did not.`);
  console.log(
    "Unblock individually in the admin UI: /admin/users?status=blocked, then the Active switch."
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
