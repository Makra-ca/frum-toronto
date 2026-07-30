/**
 * Reconciles what exists in Mux against what the database thinks exists.
 *
 *   npx tsx scripts/mux/audit-mux-assets.ts
 *   npx tsx scripts/mux/audit-mux-assets.ts --json     # machine-readable
 *
 * READ-ONLY. It never deletes anything in Mux or in the database — the point is
 * to see the damage before deciding, and deleting a business's only promo video
 * because a webhook was slow is not recoverable.
 *
 * Four classes of problem, each with a different cause and fix:
 *
 *   1. ORPHAN IN MUX      — asset exists in Mux, no business references it.
 *                           Burning storage. Usually a failed webhook, or a
 *                           business row deleted without deleting the asset.
 *   2. DEAD REFERENCE     — business has a mux_asset_id that Mux does not know.
 *                           Public listing shows a broken player.
 *   3. STUCK UPLOAD       — mux_upload_id set, no asset, and older than the
 *                           3600s upload window the client requests. Abandoned.
 *   4. STATUS DRIFT       — the business row's video_status disagrees with the
 *                           asset's real status in Mux (e.g. row says "ready",
 *                           Mux says "errored").
 *
 * Needs MUX_TOKEN_ID and MUX_TOKEN_SECRET with **Mux Video Read**. View counts
 * and watch time are Mux Data, a separate permission this does not use.
 */
import "dotenv/config";
import { db } from "../../src/lib/db";
import { businesses } from "../../src/lib/db/schema";
import { isNotNull, or } from "drizzle-orm";
import { listAssets, listUploads } from "../../src/lib/mux/client";

const asJson = process.argv.includes("--json");

/** The upload window the client requests, in ms. */
const UPLOAD_TIMEOUT_MS = 3600 * 1000;

function requireCredentials() {
  const missing = ["MUX_TOKEN_ID", "MUX_TOKEN_SECRET"].filter((k) => !process.env[k]);
  if (missing.length) {
    console.error(
      `Missing ${missing.join(" and ")}.\n` +
        `Add them to .env (Mux dashboard -> Settings -> Access Tokens, with Mux Video Read).`
    );
    process.exit(1);
  }
}

async function main() {
  requireCredentials();

  // Only rows that claim some Mux state.
  const rows = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      slug: businesses.slug,
      assetId: businesses.muxAssetId,
      uploadId: businesses.muxUploadId,
      playbackId: businesses.muxPlaybackId,
      videoStatus: businesses.videoStatus,
      videoApprovalStatus: businesses.videoApprovalStatus,
      updatedAt: businesses.updatedAt,
    })
    .from(businesses)
    .where(or(isNotNull(businesses.muxAssetId), isNotNull(businesses.muxUploadId)));

  if (!asJson) {
    console.log("=".repeat(72));
    console.log("MUX ASSET AUDIT (read-only)");
    console.log("=".repeat(72));
    console.log(`Businesses with any Mux state: ${rows.length}`);
  }

  const [assets, uploads] = await Promise.all([listAssets(), listUploads()]);

  const assetById = new Map(assets.map((a) => [a.id, a]));
  const uploadById = new Map(uploads.map((u) => [u.id, u]));

  const dbAssetIds = new Set(rows.map((r) => r.assetId).filter((v): v is string => !!v));

  // 1. In Mux, unreferenced by any business.
  const orphansInMux = assets.filter((a) => !dbAssetIds.has(a.id));

  // 2. Referenced by a business, unknown to Mux.
  const deadReferences = rows.filter((r) => r.assetId && !assetById.has(r.assetId));

  // 3. Upload started, never became an asset, past the upload window.
  const now = Date.now();
  const stuckUploads = rows.filter((r) => {
    if (r.assetId || !r.uploadId) return false;
    const upload = uploadById.get(r.uploadId);
    // Mux timestamps are seconds-since-epoch strings on this endpoint.
    const createdMs = upload?.created_at ? Number(upload.created_at) * 1000 : null;
    const reference = createdMs ?? (r.updatedAt ? new Date(r.updatedAt).getTime() : null);
    if (reference === null) return true; // no way to date it — surface it
    return now - reference > UPLOAD_TIMEOUT_MS;
  });

  // 4. Row status disagrees with Mux.
  const statusDrift = rows.flatMap((r) => {
    if (!r.assetId) return [];
    const asset = assetById.get(r.assetId);
    if (!asset) return []; // already counted as a dead reference
    const expected = r.videoStatus === "ready" ? "ready" : null;
    if (expected && asset.status !== expected) {
      return [{ row: r, muxStatus: asset.status }];
    }
    if (r.videoStatus !== "ready" && asset.status === "ready") {
      return [{ row: r, muxStatus: asset.status }];
    }
    return [];
  });

  const summary = {
    muxAssets: assets.length,
    muxUploads: uploads.length,
    businessesWithMuxState: rows.length,
    orphansInMux: orphansInMux.length,
    deadReferences: deadReferences.length,
    stuckUploads: stuckUploads.length,
    statusDrift: statusDrift.length,
  };

  if (asJson) {
    console.log(
      JSON.stringify(
        {
          summary,
          orphansInMux: orphansInMux.map((a) => ({
            assetId: a.id,
            status: a.status,
            createdAt: a.created_at,
            durationSeconds: a.duration,
            uploadId: a.upload_id,
          })),
          deadReferences: deadReferences.map((r) => ({
            businessId: r.id,
            name: r.name,
            assetId: r.assetId,
            videoStatus: r.videoStatus,
          })),
          stuckUploads: stuckUploads.map((r) => ({
            businessId: r.id,
            name: r.name,
            uploadId: r.uploadId,
          })),
          statusDrift: statusDrift.map((d) => ({
            businessId: d.row.id,
            name: d.row.name,
            dbStatus: d.row.videoStatus,
            muxStatus: d.muxStatus,
          })),
        },
        null,
        2
      )
    );
    return;
  }

  console.log(`Assets in Mux                 : ${summary.muxAssets}`);
  console.log(`Direct uploads in Mux         : ${summary.muxUploads}`);
  console.log("");
  console.log(`1. Orphans in Mux (no business): ${summary.orphansInMux}`);
  console.log(`2. Dead references (no asset)  : ${summary.deadReferences}`);
  console.log(`3. Stuck uploads (>1h, no asset): ${summary.stuckUploads}`);
  console.log(`4. Status drift vs Mux         : ${summary.statusDrift}`);

  const section = (title: string, lines: string[]) => {
    if (lines.length === 0) return;
    console.log(`\n${title}`);
    console.log("-".repeat(72));
    lines.slice(0, 40).forEach((l) => console.log("  " + l));
    if (lines.length > 40) console.log(`  … and ${lines.length - 40} more`);
  };

  section(
    "1. ORPHANS IN MUX — billed storage nothing points at",
    orphansInMux.map(
      (a) =>
        `${a.id}  status=${a.status}  ${a.duration ? Math.round(a.duration) + "s" : "?"}` +
        (a.created_at ? `  created=${new Date(Number(a.created_at) * 1000).toISOString().slice(0, 10)}` : "")
    )
  );

  section(
    "2. DEAD REFERENCES — public listing would show a broken player",
    deadReferences.map((r) => `business ${r.id} "${r.name}"  asset=${r.assetId}  status=${r.videoStatus}`)
  );

  section(
    "3. STUCK UPLOADS — started, never completed, past the 1h window",
    stuckUploads.map((r) => `business ${r.id} "${r.name}"  upload=${r.uploadId}`)
  );

  section(
    "4. STATUS DRIFT — row and Mux disagree",
    statusDrift.map(
      (d) => `business ${d.row.id} "${d.row.name}"  db=${d.row.videoStatus}  mux=${d.muxStatus}`
    )
  );

  const clean =
    summary.orphansInMux === 0 &&
    summary.deadReferences === 0 &&
    summary.stuckUploads === 0 &&
    summary.statusDrift === 0;

  console.log(`\n${clean ? "Nothing to clean up." : "Review the sections above before deleting anything."}`);
  if (!clean) {
    console.log("Nothing was changed. Deletions are deliberate, one at a time:");
    console.log("  Mux side : deleteAsset(assetId) in src/lib/mux/client.ts");
    console.log("  DB side  : clear mux_asset_id / mux_upload_id / mux_playback_id on the business");
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("ERROR:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
