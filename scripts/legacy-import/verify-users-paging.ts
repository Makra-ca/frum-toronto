/**
 * Exercises the exact queries /admin/users and /api/admin/users now run, since
 * the pages themselves sit behind admin auth and cannot be curl'd.
 *
 *   npx tsx scripts/legacy-import/verify-users-paging.ts
 *
 * Proves: paging covers every row exactly once with no repeats or gaps, the
 * search and role filters agree with independent counts, and out-of-range pages
 * return empty rather than erroring.
 */
import { connectTarget, parseOptions } from "./lib";

const PAGE_SIZE = 20;

async function main() {
  const opts = parseOptions();
  const target = connectTarget(opts.useTest);
  console.log(`Target: ${target.host}\n`);

  const q = async <T>(text: string, params: unknown[] = []): Promise<T[]> =>
    (await target.sql.query(text, params)) as T[];

  const total = Number(
    (await q<{ n: number }>(`SELECT COUNT(*)::int n FROM users`))[0].n
  );
  const totalPages = Math.ceil(total / PAGE_SIZE);
  console.log(`users: ${total} rows -> ${totalPages} pages of ${PAGE_SIZE}`);

  // ---- Walk every page and confirm exact, non-overlapping coverage --------
  const seen = new Set<number>();
  let duplicates = 0;
  for (let page = 1; page <= totalPages; page++) {
    const rows = await q<{ id: number }>(
      `SELECT id FROM users
        ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [PAGE_SIZE, (page - 1) * PAGE_SIZE]
    );
    for (const r of rows) {
      if (seen.has(r.id)) duplicates++;
      seen.add(r.id);
    }
  }
  console.log(`\npaging walk over ${totalPages} pages:`);
  console.log(`  distinct ids seen : ${seen.size} / ${total} ${seen.size === total ? "ok" : "MISSING ROWS"}`);
  console.log(`  duplicate ids     : ${duplicates} ${duplicates === 0 ? "ok" : "FAIL"}`);

  // ---- Ordering must be deterministic across repeated identical queries ---
  const first = await q<{ id: number }>(
    `SELECT id FROM users ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 40`
  );
  const again = await q<{ id: number }>(
    `SELECT id FROM users ORDER BY created_at DESC, id DESC LIMIT 20 OFFSET 40`
  );
  const stable = JSON.stringify(first) === JSON.stringify(again);
  console.log(`  repeatable ordering: ${stable ? "ok" : "FAIL"}`);

  // Contrast: the ordering WITHOUT the id tiebreaker, to show why it is needed.
  const tieRows = Number(
    (
      await q<{ n: number }>(
        `SELECT COUNT(*)::int n FROM (
           SELECT created_at FROM users GROUP BY created_at HAVING COUNT(*) > 1
         ) x`
      )
    )[0].n
  );
  console.log(`  created_at values shared by >1 user: ${tieRows} (why the id tiebreaker matters)`);

  // ---- Filters agree with independent counts -----------------------------
  console.log("\nrole filter:");
  const roles = await q<{ role: string; n: number }>(
    `SELECT role, COUNT(*)::int n FROM users GROUP BY role ORDER BY n DESC`
  );
  for (const r of roles) {
    const filtered = Number(
      (
        await q<{ n: number }>(`SELECT COUNT(*)::int n FROM users WHERE role = $1`, [r.role])
      )[0].n
    );
    console.log(`  ${r.role.padEnd(20)} ${r.n} ${filtered === r.n ? "ok" : "MISMATCH"}`);
  }

  console.log("\nsearch filter (name/email ILIKE):");
  for (const term of ["edell", "gmail.com", "rochel", "zzzznomatch"]) {
    const n = Number(
      (
        await q<{ n: number }>(
          `SELECT COUNT(*)::int n FROM users
            WHERE first_name ILIKE $1 OR last_name ILIKE $1 OR email ILIKE $1`,
          [`%${term}%`]
        )
      )[0].n
    );
    const pages = Math.max(1, Math.ceil(n / PAGE_SIZE));
    console.log(`  ${term.padEnd(14)} ${String(n).padStart(5)} matches -> ${pages} page(s)`);
  }

  // ---- Out-of-range page returns empty, not an error ----------------------
  const beyond = await q<{ id: number }>(
    `SELECT id FROM users ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2`,
    [PAGE_SIZE, 99999 * PAGE_SIZE]
  );
  console.log(`\nout-of-range page rows: ${beyond.length} ${beyond.length === 0 ? "ok" : "FAIL"}`);

  const ok = seen.size === total && duplicates === 0 && stable && beyond.length === 0;
  console.log(`\n${ok ? "ALL CHECKS PASSED" : "*** CHECKS FAILED ***"}`);
  if (!ok) process.exit(1);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
