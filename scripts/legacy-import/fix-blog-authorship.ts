/**
 * Credits legacy blog posts to their real authors, and hides the ones with no
 * identifiable author.
 *
 *   npx tsx scripts/legacy-import/fix-blog-authorship.ts            # dry run
 *   npx tsx scripts/legacy-import/fix-blog-authorship.ts --commit
 *
 * Background: the blog import set author_id from the legacy `Email` field where a
 * matching account existed, and fell back to admin@frumtoronto.com otherwise.
 * That left 416 posts credited to admin. Looking at what those rows actually
 * carried:
 *
 *   283  no author email at all (272 empty string + 11 NULL)
 *   123  benolamhaba@koshernet.com
 *    10  one-off addresses
 *
 * So per Daniel's decision:
 *   - the 133 with a real address get an account created and the credit
 *   - the 283 with no author are UNPUBLISHED (is_active = false) pending a
 *     conversation with the client about whether they should appear at all
 *
 * Accounts created here have no password and no subscriber row, so nothing is
 * emailed and nobody can log in until they use forgot-password — which now works
 * for password-less accounts with no OAuth link.
 */
import {
  announce,
  chunk,
  connectLegacy,
  connectTarget,
  loadLegacyEnv,
  parseOptions,
} from "./lib";

interface LegacyEntry {
  BlogEntryID: number;
  Email: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const opts = parseOptions();
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  announce("FIX LEGACY BLOG AUTHORSHIP", opts, target);

  // The posts currently sitting on the admin placeholder.
  const placeholder = (await target.sql.query(
    `SELECT id FROM users WHERE email = 'admin@frumtoronto.com' LIMIT 1`
  )) as { id: number }[];
  if (placeholder.length === 0) throw new Error("admin@frumtoronto.com not found");
  const adminId = placeholder[0].id;

  const rows = (await target.sql.query(
    `SELECT id, old_id FROM blog_posts
      WHERE old_id IS NOT NULL AND author_id = $1`,
    [adminId]
  )) as { id: number; old_id: number }[];
  console.log(`Posts credited to the admin placeholder: ${rows.length}`);

  // What each one's legacy author email was.
  const pool = await connectLegacy("FrumShared");
  const ids = rows.map((r) => r.old_id);
  const legacyByOldId = new Map<number, string | null>();

  for (const slice of chunk(ids, 400)) {
    const res = (
      await pool
        .request()
        .query(
          `SELECT BlogEntryID, Email FROM BlogEntries WHERE BlogEntryID IN (${slice.join(",")})`
        )
    ).recordset as LegacyEntry[];
    for (const r of res) legacyByOldId.set(r.BlogEntryID, r.Email);
  }
  await pool.close();

  // Split into "has a real author address" and "has none".
  const withAuthor: { postId: number; email: string }[] = [];
  const withoutAuthor: number[] = [];

  for (const r of rows) {
    const raw = (legacyByOldId.get(r.old_id) || "").trim().toLowerCase();
    if (raw && EMAIL_RE.test(raw)) withAuthor.push({ postId: r.id, email: raw });
    else withoutAuthor.push(r.id);
  }

  const byEmail = new Map<string, number[]>();
  for (const w of withAuthor) {
    byEmail.set(w.email, [...(byEmail.get(w.email) ?? []), w.postId]);
  }

  console.log("\nPLAN");
  console.log(`  posts with a real author address : ${withAuthor.length} across ${byEmail.size} address(es)`);
  for (const [email, posts] of [...byEmail.entries()].sort((a, b) => b[1].length - a[1].length)) {
    console.log(`      ${String(posts.length).padStart(4)}  ${email}`);
  }
  console.log(`  posts with NO author address     : ${withoutAuthor.length}  -> will be unpublished`);

  // Which of those addresses already have accounts?
  const existing = (await target.sql.query(
    `SELECT id, LOWER(email) AS email FROM users WHERE LOWER(email) = ANY($1::text[])`,
    [[...byEmail.keys()]]
  )) as { id: number; email: string }[];
  const userIdByEmail = new Map(existing.map((e) => [e.email, e.id]));
  const toCreate = [...byEmail.keys()].filter((e) => !userIdByEmail.has(e));

  console.log(`\n  accounts already existing : ${userIdByEmail.size}`);
  console.log(`  accounts to create        : ${toCreate.length}`);
  toCreate.forEach((e) => console.log(`      ${e}`));

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }

  // ---- create the missing author accounts -------------------------------
  for (const email of toCreate) {
    // Name is unknown; the local part is the least-wrong placeholder and is
    // editable in the admin UI.
    const created = (await target.sql.query(
      `INSERT INTO users (email, first_name, last_name, role, is_active, email_verified)
       VALUES ($1, $2, $3, 'member', true, NOW())
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [email, email.split("@")[0].slice(0, 100), "(legacy author)"]
    )) as { id: number }[];

    if (created.length > 0) {
      userIdByEmail.set(email, created[0].id);
      console.log(`  created account for ${email} -> user ${created[0].id}`);
    } else {
      const again = (await target.sql.query(
        `SELECT id FROM users WHERE LOWER(email) = $1`,
        [email]
      )) as { id: number }[];
      if (again.length) userIdByEmail.set(email, again[0].id);
    }
  }

  // ---- reassign the credited posts --------------------------------------
  let reassigned = 0;
  for (const [email, postIds] of byEmail.entries()) {
    const authorId = userIdByEmail.get(email);
    if (!authorId) {
      console.log(`  SKIPPED ${email}: no account could be resolved`);
      continue;
    }
    for (const slice of chunk(postIds, 300)) {
      await target.sql.query(
        `UPDATE blog_posts SET author_id = $1 WHERE id = ANY($2::int[])`,
        [authorId, slice]
      );
      reassigned += slice.length;
    }
  }
  console.log(`\n  reassigned ${reassigned} posts to their real authors`);

  // ---- unpublish the unattributed --------------------------------------
  let hidden = 0;
  for (const slice of chunk(withoutAuthor, 300)) {
    await target.sql.query(
      `UPDATE blog_posts SET is_active = false WHERE id = ANY($1::int[])`,
      [slice]
    );
    hidden += slice.length;
  }
  console.log(`  unpublished ${hidden} posts with no identifiable author`);

  const summary = (await target.sql.query(
    `SELECT u.email, COUNT(*)::int n,
            COUNT(*) FILTER (WHERE p.is_active)::int visible
       FROM blog_posts p JOIN users u ON u.id = p.author_id
      WHERE p.old_id IS NOT NULL
      GROUP BY u.email ORDER BY n DESC LIMIT 8`
  )) as { email: string; n: number; visible: number }[];

  console.log("\nAFTER — imported posts by author (visible/total):");
  summary.forEach((s) => console.log(`  ${String(s.visible).padStart(5)}/${String(s.n).padEnd(5)} ${s.email}`));

  console.log(
    "\nTo re-publish the unattributed ones later:\n" +
      "  UPDATE blog_posts SET is_active = true\n" +
      "   WHERE old_id IS NOT NULL AND is_active = false AND author_id = " + adminId + ";"
  );
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
