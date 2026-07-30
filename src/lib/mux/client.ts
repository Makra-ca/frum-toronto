// MUX API client using fetch (no npm package dependency)
// Uses Basic auth with MUX_TOKEN_ID and MUX_TOKEN_SECRET

const MUX_API_BASE = "https://api.mux.com";

function getMuxAuthHeader(): string {
  const tokenId = process.env.MUX_TOKEN_ID;
  const tokenSecret = process.env.MUX_TOKEN_SECRET;

  if (!tokenId || !tokenSecret) {
    throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET must be set");
  }

  const credentials = Buffer.from(`${tokenId}:${tokenSecret}`).toString("base64");
  return `Basic ${credentials}`;
}

export interface MuxDirectUpload {
  id: string;
  url: string;
  status: string;
  cors_origin: string;
  new_asset_settings: {
    playback_policy: string[];
  };
}

export interface MuxAsset {
  id: string;
  status: string;
  playback_ids?: Array<{
    id: string;
    policy: string;
  }>;
}

/**
 * Creates a MUX direct upload URL for a business video.
 * Returns the upload URL and upload ID.
 */
export async function createDirectUpload(): Promise<{ uploadUrl: string; uploadId: string }> {
  const authHeader = getMuxAuthHeader();

  const response = await fetch(`${MUX_API_BASE}/video/v1/uploads`, {
    method: "POST",
    headers: {
      Authorization: authHeader,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      cors_origin: "*",
      new_asset_settings: {
        playback_policy: ["public"],
        max_resolution_tier: "1080p",
      },
      timeout: 3600,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MUX create upload failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  const upload: MuxDirectUpload = data.data;

  return {
    uploadUrl: upload.url,
    uploadId: upload.id,
  };
}

/**
 * Deletes a MUX asset by asset ID.
 */
export async function deleteAsset(assetId: string): Promise<void> {
  const authHeader = getMuxAuthHeader();

  const response = await fetch(`${MUX_API_BASE}/video/v1/assets/${assetId}`, {
    method: "DELETE",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok && response.status !== 404) {
    const error = await response.text();
    throw new Error(`MUX delete asset failed: ${response.status} ${error}`);
  }
}

/**
 * Gets a MUX asset by asset ID.
 */
export async function getAsset(assetId: string): Promise<MuxAsset> {
  const authHeader = getMuxAuthHeader();

  const response = await fetch(`${MUX_API_BASE}/video/v1/assets/${assetId}`, {
    method: "GET",
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`MUX get asset failed: ${response.status} ${error}`);
  }

  const data = await response.json();
  return data.data as MuxAsset;
}

/** An asset as returned by the list endpoint — a superset of MuxAsset. */
export interface MuxAssetSummary extends MuxAsset {
  created_at?: string;
  duration?: number;
  upload_id?: string;
  /** Present on assets that failed processing. */
  errors?: { type?: string; messages?: string[] };
}

/**
 * Lists every asset in the Mux account, following cursor pagination.
 *
 * `GET /video/v1/assets` returns at most `limit` per call plus a `next_cursor`.
 * The loop is bounded by maxPages so a pagination bug can't spin forever against
 * a billed API.
 *
 * Needs only "Mux Video Read" on the access token. Note that view counts and
 * watch time are **Mux Data**, a separate permission this does not cover.
 */
export async function listAssets(options?: {
  limit?: number;
  maxPages?: number;
}): Promise<MuxAssetSummary[]> {
  const authHeader = getMuxAuthHeader();
  const limit = options?.limit ?? 100;
  const maxPages = options?.maxPages ?? 100;

  const all: MuxAssetSummary[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`${MUX_API_BASE}/video/v1/assets?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MUX list assets failed: ${response.status} ${error}`);
    }

    const body = await response.json();
    // Guard rather than assume. The two list endpoints are NOT consistent:
    // /video/v1/assets returns `data: []` when empty, but /video/v1/uploads
    // returns `data: {}` — an object. Spreading that throws
    // "Spread syntax requires ...iterable[Symbol.iterator] to be a function".
    const batch: MuxAssetSummary[] = Array.isArray(body?.data) ? body.data : [];
    all.push(...batch);

    cursor = body.next_cursor || undefined;
    // Mux stops sending a cursor at the end; a short page also means the end.
    if (!cursor || batch.length < limit) break;
  }

  return all;
}

/** A direct upload as returned by the list endpoint. */
export interface MuxUploadSummary {
  id: string;
  status: string;
  created_at?: string;
  asset_id?: string;
  timeout?: number;
  error?: { type?: string; message?: string };
}

/**
 * Lists direct uploads. Useful for spotting uploads that were created but never
 * completed, which leave a `mux_upload_id` on the business row with no asset.
 */
export async function listUploads(options?: {
  limit?: number;
  maxPages?: number;
}): Promise<MuxUploadSummary[]> {
  const authHeader = getMuxAuthHeader();
  const limit = options?.limit ?? 100;
  const maxPages = options?.maxPages ?? 100;

  const all: MuxUploadSummary[] = [];
  let cursor: string | undefined;

  for (let page = 0; page < maxPages; page++) {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);

    const response = await fetch(`${MUX_API_BASE}/video/v1/uploads?${params.toString()}`, {
      method: "GET",
      headers: { Authorization: authHeader },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MUX list uploads failed: ${response.status} ${error}`);
    }

    const body = await response.json();
    const batch: MuxUploadSummary[] = Array.isArray(body?.data) ? body.data : [];
    all.push(...batch);

    cursor = body.next_cursor || undefined;
    if (!cursor || batch.length < limit) break;
  }

  return all;
}
