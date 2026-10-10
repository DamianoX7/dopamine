// Cached object URLs for stored images (artwork). Revoked when a blob is replaced/deleted.
import { getBlob } from './core/db.js';

const cache = new Map();

export function blobUrl(id) {
  if (!id) return Promise.resolve(null);
  let entry = cache.get(id);
  if (!entry) {
    entry = getBlob(id)
      .then((blob) => (blob ? URL.createObjectURL(blob) : null))
      .catch(() => null);
    cache.set(id, entry);
  }
  return entry;
}

export async function revokeBlobUrl(id) {
  const entry = cache.get(id);
  if (!entry) return;
  cache.delete(id);
  const url = await entry;
  if (url) URL.revokeObjectURL(url);
}
