/**
 * Imports the legacy simcha announcements into `simchas`.
 *
 *   npx tsx scripts/legacy-import/simchas.ts                 # dry run
 *   npx tsx scripts/legacy-import/simchas.ts --commit
 *
 * Source: FrumShared.dbo.BlogEntries. The old site had no simcha table — each
 * simcha was a blog post in a category flagged MailerSimchas:
 *
 *   114 Births        8,565      115 Weddings      2,645
 *   116 Bar Mitzvas   2,220      117 Engagements   2,855
 *    29 Simchas         257  (pre-2010, mixed types — classified by keyword)
 *
 * Deliberate choices:
 *
 * - event_date stays NULL. The legacy row records only when the announcement was
 *   *posted*, not when the simcha happened. Copying the post date into a field
 *   the UI labels with a calendar icon would present an inference as a fact. The
 *   post date goes to created_at instead, which is what the page sorts by.
 *
 * - photo_url stays NULL. BlogPicture/BlogPictureURL are empty on all 16,542 rows
 *   (verified). BlogImage holds a generic decorative filename — "MazelTov.JPG",
 *   "NewBabyBoy.JPG", "ring.jpg" — not a family photo, and those files live on
 *   the old server, so mapping them would produce broken images.
 *
 * - Bodies are converted to plain text. The public page renders
 *   {simcha.announcement} as a JSX text child, so legacy "<br />" and "&amp;"
 *   would otherwise be displayed literally.
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
import { classifyMixedSimcha } from "./parse";

interface Entry {
  BlogEntryID: number;
  BlogCategoryID: number;
  Active: boolean | null;
  OnHold: boolean | null;
  BlogEntryDate: number | null;
  BlogEntryTitle: string | null;
  BlogEntryText: string | null;
}

/** Categories whose type is unambiguous from the category itself. */
const DIRECT_CATEGORY_SLUG: Record<number, string> = {
  114: "birth",
  115: "wedding",
  116: "bar-mitzvah",
  117: "engagement",
};

/** Category 29 predates the split into typed categories, so it is mixed. */
const MIXED_CATEGORY = 29;

const ALL_CATEGORIES = [...Object.keys(DIRECT_CATEGORY_SLUG).map(Number), MIXED_CATEGORY];

async function main() {
  const opts = parseOptions();
  loadLegacyEnv();
  const target = connectTarget(opts.useTest);
  announce("LEGACY SIMCHA IMPORT — BlogEntries -> simchas", opts, target);

  // ---- simcha_types slug -> id (never hardcode the ids) -----------------
  const typeRows = (await target.sql.query(
    `SELECT id, slug FROM simcha_types`
  )) as { id: number; slug: string }[];
  const typeIdBySlug = new Map(typeRows.map((r) => [r.slug, r.id]));
  console.log(`simcha_types available: ${[...typeIdBySlug.keys()].join(", ")}\n`);

  const missing = ["birth", "wedding", "bar-mitzvah", "bat-mitzvah", "engagement", "other"].filter(
    (s) => !typeIdBySlug.has(s)
  );
  if (missing.length) throw new Error(`simcha_types missing required slugs: ${missing.join(", ")}`);

  // ---- Read legacy ------------------------------------------------------
  const pool = await connectLegacy("FrumShared");
  const entries: Entry[] = (
    await pool.request().query(`
      SELECT BlogEntryID, BlogCategoryID, Active, OnHold, BlogEntryDate,
             BlogEntryTitle, BlogEntryText
      FROM BlogEntries
      WHERE BlogCategoryID IN (${ALL_CATEGORIES.join(",")})
      ORDER BY BlogEntryDate, BlogEntryID
    `)
  ).recordset;
  await pool.close();
  console.log(`Read ${entries.length} legacy simcha entries.`);

  // ---- Skip anything already imported ----------------------------------
  const existing = (await target.sql.query(
    `SELECT old_id FROM simchas WHERE old_id IS NOT NULL`
  )) as { old_id: number }[];
  const alreadyImported = new Set(existing.map((r) => r.old_id));
  console.log(`Already imported: ${alreadyImported.size}`);

  // --repair re-derives text for rows already present instead of inserting new
  // ones. Needed because the first pass shipped before htmlToText handled
  // Windows-1252 numeric entities, leaving invisible C1 control characters
  // where apostrophes belonged. The legacy source is untouched, so the text can
  // simply be recomputed.
  const repairMode = process.argv.includes("--repair");

  let pending = repairMode
    ? entries.filter((e) => alreadyImported.has(e.BlogEntryID))
    : entries.filter((e) => !alreadyImported.has(e.BlogEntryID));
  if (opts.limit) pending = pending.slice(0, opts.limit);
  if (repairMode) console.log(`REPAIR MODE — recomputing text for ${pending.length} existing rows`);

  // ---- Transform --------------------------------------------------------
  interface Prepared {
    oldId: number;
    typeId: number;
    typeSlug: string;
    familyName: string;
    announcement: string;
    isActive: boolean;
    createdAt: Date;
  }

  const prepared: Prepared[] = [];
  const skipped: { id: number; why: string }[] = [];
  const mixedBreakdown = new Map<string, number>();
  const perCategory = new Map<number, number>();

  for (const e of pending) {
    const title = htmlToLine(e.BlogEntryTitle);
    const body = htmlToText(e.BlogEntryText);

    // Both target columns are NOT NULL. A row with neither a title nor a body
    // carries no information, so it is reported rather than backfilled with
    // invented text.
    if (!title && !body) {
      skipped.push({ id: e.BlogEntryID, why: "empty title and body" });
      continue;
    }

    const slug =
      e.BlogCategoryID === MIXED_CATEGORY
        ? classifyMixedSimcha(title, body)
        : DIRECT_CATEGORY_SLUG[e.BlogCategoryID];

    const typeId = typeIdBySlug.get(slug) ?? typeIdBySlug.get("other")!;
    if (e.BlogCategoryID === MIXED_CATEGORY) {
      mixedBreakdown.set(slug, (mixedBreakdown.get(slug) ?? 0) + 1);
    }
    perCategory.set(e.BlogCategoryID, (perCategory.get(e.BlogCategoryID) ?? 0) + 1);

    const createdAt = oleToTimestamp(e.BlogEntryDate);
    if (!createdAt) {
      skipped.push({ id: e.BlogEntryID, why: "unparseable BlogEntryDate" });
      continue;
    }

    prepared.push({
      oldId: e.BlogEntryID,
      typeId,
      typeSlug: slug,
      familyName: fit(title || body.split("\n")[0], 200),
      announcement: body || title,
      // The old site's Active/OnHold bits decide visibility. Everything here was
      // published on the old site, so approval_status is 'approved' and
      // is_active carries the legacy visibility instead.
      isActive: e.Active !== false && e.OnHold !== true,
      createdAt,
    });
  }

  // ---- Report -----------------------------------------------------------
  console.log("\nPLAN");
  console.log(`  to insert : ${prepared.length}`);
  console.log(`  skipped   : ${skipped.length}`);
  console.log(`  inactive  : ${prepared.filter((p) => !p.isActive).length}`);

  console.log("\n  per legacy category:");
  for (const [cat, n] of [...perCategory.entries()].sort((a, b) => b[1] - a[1])) {
    const label = cat === MIXED_CATEGORY ? "29 (mixed, classified)" : `${cat} -> ${DIRECT_CATEGORY_SLUG[cat]}`;
    console.log(`    ${String(label).padEnd(26)} ${n}`);
  }

  if (mixedBreakdown.size) {
    console.log("\n  category 29 keyword classification:");
    for (const [slug, n] of [...mixedBreakdown.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`    ${slug.padEnd(14)} ${n}`);
    }
  }

  if (skipped.length) {
    console.log("\n  skipped rows:");
    skipped.slice(0, 10).forEach((s) => console.log(`    #${s.id}: ${s.why}`));
  }

  console.log("\n  sample prepared rows:");
  for (const p of prepared.slice(-4)) {
    console.log(`    #${p.oldId} [${p.typeSlug}] ${p.createdAt.toISOString().slice(0, 10)}`);
    console.log(`      family: ${p.familyName}`);
    console.log(`      text  : ${p.announcement.replace(/\n/g, " ⏎ ").slice(0, 150)}`);
  }

  if (!opts.commit) {
    console.log("\nDRY RUN — nothing written. Re-run with --commit to apply.");
    return;
  }
  if (prepared.length === 0) {
    console.log("\nNothing to do.");
    return;
  }

  // ---- Repair path ------------------------------------------------------
  if (repairMode) {
    console.log("\nRepairing text of existing rows...");
    let fixed = 0;
    for (const batch of chunk(prepared, 250)) {
      const values: unknown[] = [];
      const tuples: string[] = [];
      batch.forEach((p, i) => {
        const b = i * 3;
        tuples.push(`($${b + 1}::int, $${b + 2}::text, $${b + 3}::text)`);
        values.push(p.oldId, p.familyName, p.announcement);
      });

      // Only rows whose text actually differs are written, so the row count
      // reported is a real change count rather than a no-op count.
      await target.sql.query(
        `UPDATE simchas AS s
            SET family_name = v.family_name,
                announcement = v.announcement
           FROM (VALUES ${tuples.join(",")}) AS v(old_id, family_name, announcement)
          WHERE s.old_id = v.old_id
            AND (s.family_name <> v.family_name OR s.announcement <> v.announcement)`,
        values
      );
      fixed += batch.length;
      console.log(`  processed ${fixed}/${prepared.length}`);
    }
    console.log(`\nDONE. Repair pass covered ${fixed} rows.`);
    return;
  }

  // ---- Insert -----------------------------------------------------------
  console.log("\nInserting...");
  let done = 0;
  for (const batch of chunk(prepared, 250)) {
    const values: unknown[] = [];
    const tuples: string[] = [];
    batch.forEach((p, i) => {
      const b = i * 7;
      tuples.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5},$${b + 6},$${b + 7})`);
      values.push(
        p.typeId,
        p.familyName,
        p.announcement,
        "approved",
        p.isActive,
        p.createdAt.toISOString(),
        p.oldId
      );
    });

    await target.sql.query(
      `INSERT INTO simchas
         (type_id, family_name, announcement, approval_status, is_active, created_at, old_id)
       VALUES ${tuples.join(",")}
       ON CONFLICT (old_id) WHERE old_id IS NOT NULL DO NOTHING`,
      values
    );
    done += batch.length;
    console.log(`  ${done}/${prepared.length}`);
  }

  console.log(`\nDONE. simchas +${done}`);
}

main().catch((e) => {
  console.error("\nERROR:", e instanceof Error ? e.stack : e);
  process.exit(1);
});
