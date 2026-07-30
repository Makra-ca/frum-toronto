/**
 * Moves the unattributed legacy blog posts to a "FrumToronto Archive" author and
 * publishes them.
 *
 *   npx tsx scripts/legacy-import/publish-archive-posts.ts            # dry run
 *   npx tsx scripts/legacy-import/publish-archive-posts.ts --commit
 *
 * Background: 283 imported posts carried no author email on the old site, so the
 * import parked them on admin@frumtoronto.com and fix-blog-authorship.ts
 * unpublished them pending a decision. The decision: publish them under a named
 * archive account rather than "admin", which to a reader looks like an oversight
 * on 283 Torah posts.
 *
 * The archive account has no password, so it cannot be logged into. It exists
 * purely to own content, which is why it also gets no subscriber row — nothing is
 * ever emailed to it.
 *
 * Reversible: re-hide with
 *   UPDATE blog_posts SET is_active = false WHERE author_id = <archive id>;
 */
import { announce, chunk, connectTarget, parseOptions } from "./lib";

const ARCHIVE_EMAIL = "archive@frumtoronto.com";
const ARCHIVE_FIRST = "FrumToronto";
const ARCHIVE_LAST = "Archive";

async function main() {
  const opts = parseOptions();
  const target = connectTarget(opts.useTest);
  announce("PUBLISH UNATTRIBUTED LEGACY POSTS AS 'FRUMTORONTO ARCHIVE'", opts, target);

  const [admin] = (await target.sql.query(
    `SELECT id FROM users WHERE email = 'admin@frumtoronto.com' LIMIT 1`
  )) as { id: number }[];
  if (!admin) throw new Error("admin@frumtoronto.com not found");

  const pending = (await target.sql.query(
    `SELECT COUNT(*)::int n,
            COUNT(*) FILTER (WHERE is_active)::int visible
       FROM blog_posts
      WHERE old_id IS NOT NULL AND author_id = $1`,
    [admin.id]
  )) as { n: number; visible: number }[];

  console.log("PLAN");
  console.log(`  posts on the admin placeholder : ${pending[0].n}`);
  console.log(`  of those currently visible     : ${pending[0].visible}`);
  console.log(`  -> reassign to "${ARCHIVE_FIRST} ${ARCHIVE_LAST}" <${ARCHIVE_EMAIL}> and publish`);

  const [existingArchive] = (await target.sql.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [ARCHIVE_EMAIL]
  )) as { id: number }[];
  console.log(
    existingArchive
      ? `  archive account already exists (user ${existingArchive.id})`
      : `  archive account will be created`
  );

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }
  if (pending[0].n === 0) {
    console.log("\nNothing to do.");
    return;
  }

  let archiveId = existingArchive?.id;
  if (!archiveId) {
    // No password: this account owns content and must not be loggable into.
    const created = (await target.sql.query(
      `INSERT INTO users (email, first_name, last_name, role, is_active, email_verified)
       VALUES ($1, $2, $3, 'member', true, NOW())
       ON CONFLICT (email) DO NOTHING
       RETURNING id`,
      [ARCHIVE_EMAIL, ARCHIVE_FIRST, ARCHIVE_LAST]
    )) as { id: number }[];
    archiveId = created[0]?.id;
    if (!archiveId) {
      const [again] = (await target.sql.query(
        `SELECT id FROM users WHERE email = $1`,
        [ARCHIVE_EMAIL]
      )) as { id: number }[];
      archiveId = again?.id;
    }
    console.log(`  created archive account -> user ${archiveId}`);
  }
  if (!archiveId) throw new Error("could not resolve the archive account");

  const ids = (
    (await target.sql.query(
      `SELECT id FROM blog_posts WHERE old_id IS NOT NULL AND author_id = $1`,
      [admin.id]
    )) as { id: number }[]
  ).map((r) => r.id);

  let moved = 0;
  for (const slice of chunk(ids, 300)) {
    await target.sql.query(
      `UPDATE blog_posts SET author_id = $1, is_active = true WHERE id = ANY($2::int[])`,
      [archiveId, slice]
    );
    moved += slice.length;
    console.log(`  reassigned + published ${moved}/${ids.length}`);
  }

  const after = (await target.sql.query(
    `SELECT COUNT(*)::int n, COUNT(*) FILTER (WHERE is_active)::int visible
       FROM blog_posts WHERE author_id = $1`,
    [archiveId]
  )) as { n: number; visible: number }[];

  const stillAdmin = (await target.sql.query(
    `SELECT COUNT(*)::int n FROM blog_posts WHERE old_id IS NOT NULL AND author_id = $1`,
    [admin.id]
  )) as { n: number }[];

  console.log("\nAFTER");
  console.log(`  archive account owns : ${after[0].n} posts, ${after[0].visible} visible`);
  console.log(`  still on admin       : ${stillAdmin[0].n}`);
  console.log(
    `\nDONE. Re-hide with: UPDATE blog_posts SET is_active = false WHERE author_id = ${archiveId};`
  );
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
