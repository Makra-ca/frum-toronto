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
