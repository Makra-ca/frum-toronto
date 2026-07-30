/**
 * Imports three legacy content categories into `blog_posts`.
 *
 *   npx tsx scripts/legacy-import/blog.ts                 # dry run
 *   npx tsx scripts/legacy-import/blog.ts --commit
 *
 *    44 Message Board       1,366  community bulletins (Rosh Chodesh, DST, ...)
 *    96 Halacha for Today   1,211
 *    45 Parsha Pearls         487
 *
 * Decisions:
 *
 * - Content keeps its HTML. Unlike simchas and kosher alerts, the blog detail
 *   page renders `post.content` through dangerouslySetInnerHTML, so markup is
 *   wanted here — but it must be sanitized first, since this corpus predates any
 *   review and the repo has no sanitizer dependency. See sanitizeLegacyHtml.
 *
 * - Images hosted on www.frumtoronto.com/Local/... and on the old server both
 *   return 404 today, so they are dropped rather than rendered broken. The count
 *   is reported.
 *
 * - blog_posts.author_id is NOT NULL. Legacy authors are matched to existing
 *   users by email; anything unmatched is attributed to the admin account. That
 *   is a placeholder, not a claim of authorship — see the report for the split.
 *
 * - blog_posts.slug is UNIQUE and these titles repeat (Halacha for Today posts
 *   share wording), so slugs are de-duplicated against both the existing table
 *   and the current batch.
 *
 * - Category 44 rows whose title begins with "#" are numbered Ask-the-Rabbi
 *   questions that leaked into the Message Board. They are SKIPPED: that content
 *   belongs in ask_the_rabbi (already migrated from category 98) and importing it
 *   here would duplicate it.
 */
import {
  announce,
  chunk,
  connectLegacy,
  connectTarget,
  fit,
  htmlToLine,
  htmlToText,
  loadLegacyEnv,
  oleToTimestamp,
  parseOptions,
} from "./lib";
import { sanitizeLegacyHtml, slugify } from "./parse";

interface Entry {
  BlogEntryID: number;
  BlogCategoryID: number;
  Active: boolean | null;
  OnHold: boolean | null;
  BlogEntryDate: number | null;
  BlogEntryTitle: string | null;
  BlogEntryText: string | null;
  Email: string | null;
}

const CATEGORIES: Record<number, { name: string; slug: string; order: number }> = {
  44: { name: "Message Board", slug: "message-board", order: 10 },
  96: { name: "Halacha for Today", slug: "halacha-for-today", order: 20 },
  45: { name: "Parsha Pearls", slug: "parsha-pearls", order: 30 },
};

async function main() {
  const opts = parseOptions();
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  announce("LEGACY BLOG IMPORT — BlogEntries(44,96,45) -> blog_posts", opts, target);

  // ---- Resolve the fallback author -------------------------------------
  const admins = (await target.sql.query(
    `SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1`
  )) as { id: number; email: string }[];
  if (admins.length === 0) {
    throw new Error("No admin user exists to own legacy posts (blog_posts.author_id is NOT NULL).");
  }
  const fallbackAuthor = admins[0];
  console.log(`Fallback author: ${fallbackAuthor.email} (id ${fallbackAuthor.id})`);

  // ---- Read legacy ------------------------------------------------------
  const pool = await connectLegacy("FrumShared");
  const catIds = Object.keys(CATEGORIES).join(",");
  const entries: Entry[] = (
    await pool.request().query(`
      SELECT BlogEntryID, BlogCategoryID, Active, OnHold, BlogEntryDate,
             BlogEntryTitle, BlogEntryText, Email
      FROM BlogEntries WHERE BlogCategoryID IN (${catIds})
      ORDER BY BlogEntryDate, BlogEntryID`)
  ).recordset;
  await pool.close();
  console.log(`Read ${entries.length} legacy entries.`);

  // ---- Map legacy author emails to users -------------------------------
  const legacyEmails = [
    ...new Set(
      entries
        .map((e) => (e.Email || "").trim().toLowerCase())
        .filter((e) => e.includes("@"))
    ),
  ];
  const userRows = (await target.sql.query(
    `SELECT id, LOWER(email) AS email FROM users WHERE LOWER(email) = ANY($1::text[])`,
    [legacyEmails]
  )) as { id: number; email: string }[];
  const userIdByEmail = new Map(userRows.map((r) => [r.email, r.id]));
  console.log(
    `Legacy author emails: ${legacyEmails.length}, matched to existing users: ${userIdByEmail.size}`
  );

  // ---- Ensure categories exist ------------------------------------------
  const catIdBySlug = new Map<string, number>();
  for (const cat of Object.values(CATEGORIES)) {
    const found = (await target.sql.query(
      `SELECT id FROM blog_categories WHERE slug = $1`,
      [cat.slug]
    )) as { id: number }[];
    if (found.length) {
      catIdBySlug.set(cat.slug, found[0].id);
    } else if (opts.commit) {
      const created = (await target.sql.query(
        `INSERT INTO blog_categories (name, slug, display_order) VALUES ($1,$2,$3) RETURNING id`,
        [cat.name, cat.slug, cat.order]
      )) as { id: number }[];
      catIdBySlug.set(cat.slug, created[0].id);
      console.log(`  created blog category "${cat.name}"`);
    } else {
      console.log(`  would create blog category "${cat.name}"`);
    }
  }

  // ---- Skip already-imported -------------------------------------------
  const existing = (await target.sql.query(
    `SELECT old_id FROM blog_posts WHERE old_id IS NOT NULL`
  )) as { old_id: number }[];
  const already = new Set(existing.map((r) => r.old_id));
  console.log(`Already imported: ${already.size}`);

  let pending = entries.filter((e) => !already.has(e.BlogEntryID));
  if (opts.limit) pending = pending.slice(0, opts.limit);

  // ---- Existing slugs, to keep the UNIQUE constraint satisfied ----------
  const slugRows = (await target.sql.query(`SELECT slug FROM blog_posts`)) as { slug: string }[];
  const usedSlugs = new Set(slugRows.map((r) => r.slug));

  interface Prepared {
    oldId: number;
    categoryId: number | null;
    title: string;
    slug: string;
    content: string;
    excerpt: string;
    authorId: number;
    matchedAuthor: boolean;
    publishedAt: Date;
    isActive: boolean;
  }

  const prepared: Prepared[] = [];
  const skipped: { id: number; why: string }[] = [];
  let totalRemovedImages = 0;
  let slugCollisions = 0;

  for (const e of pending) {
    const cat = CATEGORIES[e.BlogCategoryID];
    const title = htmlToLine(e.BlogEntryTitle);
    const publishedAt = oleToTimestamp(e.BlogEntryDate);

    if (!publishedAt) {
      skipped.push({ id: e.BlogEntryID, why: "unparseable BlogEntryDate" });
      continue;
    }

    // Numbered Q&A in the Message Board is Ask-the-Rabbi content that already
    // lives in ask_the_rabbi (migrated from category 98).
    if (e.BlogCategoryID === 44 && /^\s*#/.test(title)) {
      skipped.push({ id: e.BlogEntryID, why: `Ask-the-Rabbi stray: ${title.slice(0, 50)}` });
      continue;
    }

    const { html, removedImages } = sanitizeLegacyHtml(e.BlogEntryText);
    totalRemovedImages += removedImages;
    const plain = htmlToText(e.BlogEntryText);

    if (!title && !plain) {
      skipped.push({ id: e.BlogEntryID, why: "empty title and body" });
      continue;
    }

    const effectiveTitle = title || plain.split("\n")[0].slice(0, 120);

    // content is NOT NULL; fall back to the title wrapped as a paragraph so the
    // post still renders rather than being an empty page.
    const content = html || `<p>${effectiveTitle}</p>`;

    // Unique slug: base, then -2, -3, ... Titles repeat across daily posts.
    const base = slugify(effectiveTitle) || `legacy-${e.BlogEntryID}`;
    let slug = fit(base, 300);
    let n = 2;
    if (usedSlugs.has(slug)) slugCollisions++;
    while (usedSlugs.has(slug)) {
      const suffix = `-${n++}`;
      slug = fit(base, 300 - suffix.length) + suffix;
    }
    usedSlugs.add(slug);

    const email = (e.Email || "").trim().toLowerCase();
    const matchedId = userIdByEmail.get(email);

    prepared.push({
      oldId: e.BlogEntryID,
      categoryId: catIdBySlug.get(cat.slug) ?? null,
      title: fit(effectiveTitle, 300),
      slug,
      content,
      excerpt: fit(plain.replace(/\n+/g, " ").slice(0, 300), 500),
      authorId: matchedId ?? fallbackAuthor.id,
      matchedAuthor: matchedId !== undefined,
      publishedAt,
      isActive: e.Active !== false && e.OnHold !== true,
    });
  }

  // ---- Report -----------------------------------------------------------
  const perCat = new Map<number, number>();
  for (const e of pending) perCat.set(e.BlogCategoryID, (perCat.get(e.BlogCategoryID) ?? 0) + 1);

  console.log("\nPLAN");
  console.log(`  to insert : ${prepared.length}`);
  console.log(`  skipped   : ${skipped.length}`);
  console.log(`  inactive  : ${prepared.filter((p) => !p.isActive).length}`);
  console.log(`  slug collisions resolved : ${slugCollisions}`);
  console.log(`  images dropped (dead URL): ${totalRemovedImages}`);

  const matched = prepared.filter((p) => p.matchedAuthor).length;
  console.log(
    `  authorship: ${matched} matched to a real user, ${prepared.length - matched} attributed to ${fallbackAuthor.email} as a placeholder`
  );

  console.log("\n  per legacy category (before skips):");
  for (const [id, n] of perCat.entries()) {
    console.log(`    ${id} ${CATEGORIES[id].name.padEnd(20)} ${n}`);
  }

  const strays = skipped.filter((s) => s.why.startsWith("Ask-the-Rabbi"));
  if (strays.length) {
    console.log(`\n  skipped ${strays.length} Ask-the-Rabbi strays from Message Board:`);
    strays.slice(0, 12).forEach((s) => console.log(`    #${s.id} ${s.why.slice(22)}`));
  }
  const otherSkips = skipped.filter((s) => !s.why.startsWith("Ask-the-Rabbi"));
  if (otherSkips.length) {
    console.log(`\n  other skips (${otherSkips.length}):`);
    otherSkips.slice(0, 10).forEach((s) => console.log(`    #${s.id}: ${s.why}`));
  }

  console.log("\n  sample:");
  for (const p of prepared.slice(-3)) {
    console.log(`    #${p.oldId} ${p.publishedAt.toISOString().slice(0, 10)} author=${p.authorId}${p.matchedAuthor ? "" : " (placeholder)"}`);
    console.log(`      title: ${p.title}`);
    console.log(`      slug : ${p.slug}`);
    console.log(`      html : ${p.content.replace(/\s+/g, " ").slice(0, 110)}`);
  }

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }
  if (prepared.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  console.log("\nInserting...");
  let done = 0;
  for (const batch of chunk(prepared, 150)) {
    const values: unknown[] = [];
    const tuples: string[] = [];
    batch.forEach((p, i) => {
      const b = i * 10;
      tuples.push(
        `($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7},$${b + 8},$${b + 9},$${b + 10})`
      );
      values.push(
        p.title,
        p.slug,
        p.content,
        p.excerpt,
        p.authorId,
        p.categoryId,
        "approved",
        p.publishedAt.toISOString(),
        p.isActive,
        p.oldId
      );
    });
    await target.sql.query(
      `INSERT INTO blog_posts
         (title, slug, content, excerpt, author_id, category_id, approval_status,
          published_at, is_active, old_id)
       VALUES ${tuples.join(",")}
       ON CONFLICT (old_id) WHERE old_id IS NOT NULL DO NOTHING`,
      values
    );
    done += batch.length;
    console.log(`  ${done}/${prepared.length}`);
  }

  console.log(`\nDONE. blog_posts +${done}`);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
