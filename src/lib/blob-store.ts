import { BlobNotFoundError, BlobPreconditionFailedError, get, head, put } from "@vercel/blob";
import { sanitizeState } from "./inventory";
import { seedState } from "./seed";
import { mergeSharedSave, type SharedSave } from "./shared-save";
import type { InventoryState } from "./types";

export const BLOB_PATH = "inventory/state.json";

export function blobConfigured(): boolean {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN);
}

interface StoredBlob {
  state: InventoryState | null;
  etag: string | null;
}

async function readBlob(): Promise<StoredBlob> {
  try {
    await head(BLOB_PATH);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return { state: null, etag: null };
    throw error;
  }

  const result = await get(BLOB_PATH, { access: "private", useCache: false });
  if (!result || result.statusCode !== 200) return { state: null, etag: null };
  const text = await new Response(result.stream).text();
  if (!text) return { state: null, etag: result.blob.etag };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    return { state: null, etag: result.blob.etag };
  }
  return { state: sanitizeState(parsed), etag: result.blob.etag };
}

async function writeBlob(state: InventoryState, etag: string | null): Promise<void> {
  await put(BLOB_PATH, JSON.stringify(state), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
    ...(etag ? { ifMatch: etag } : {}),
  });
}

export async function readBlobState(): Promise<InventoryState | null> {
  const stored = await readBlob();
  return stored.state;
}

/** Read the shared list, or store the seed the first time the blob is missing. */
export async function loadBlobState(): Promise<InventoryState> {
  const stored = await readBlob();
  if (stored.state) return stored.state;
  const seed = seedState();
  try {
    await writeBlob(seed, stored.etag);
  } catch (error) {
    if (!(error instanceof BlobPreconditionFailedError)) throw error;
  }
  return (await readBlob()).state ?? seed;
}

/** Merge this phone's edits onto the latest blob, retrying if someone else saved first. */
export async function saveBlobState(save: SharedSave): Promise<InventoryState> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const stored = await readBlob();
    const next = stored.state ? mergeSharedSave(stored.state, save) : save.state;
    try {
      await writeBlob(next, stored.etag);
      return next;
    } catch (error) {
      lastError = error;
      if (error instanceof BlobPreconditionFailedError) continue;
      throw error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Could not save the shared list.");
}
