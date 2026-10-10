// The covers on every device: when the site runs on server.py (see js/sync.js for the progress
// half), singles and albums are compared with the server's copy and the newer edit of each wins.
// Audio and artwork are uploaded before the record that uses them; in the other direction only
// the records travel, and a device downloads a cover's audio when it first plays it (core/db.js).
// The unsaved draft take stays on the device it was recorded on.

import { library, loadLibrary, singleBlobIds, albumBlobIds, deleteBlobsIfUnreferenced, readGone, writeGone } from './library.js';
import { dbGetAll, dbPut, dbDelete, getLocalBlob, getBlobInfo } from './core/db.js';

const sync = window.Sync;
const host = window.CoverHost;
const blobIds = { singles: singleBlobIds, albums: albumBlobIds };

let running = false;
let again = false;

async function json(res) {
  if (!res.ok) throw new Error(`sync ${res.status}`);
  return res.json();
}

async function uploadBlobs(ids) {
  if (!ids.length) return;
  const { missing } = await json(await sync.api('blobs/missing', { method: 'POST', json: { ids } }));
  for (const id of missing) {
    const blob = await getLocalBlob(id);
    if (!blob) continue; // this device never downloaded it, and the server lost it: nothing to send
    const info = await getBlobInfo(id);
    const kind = encodeURIComponent((info && info.kind) || 'misc');
    await json(await sync.api(`blob/${id}?kind=${kind}`, { method: 'PUT', body: blob, type: blob.type || 'application/octet-stream', timeout: 900000 }));
  }
}

async function compare() {
  const { records } = await json(await sync.api('library'));
  const local = new Map();
  for (const store of ['singles', 'albums']) {
    for (const rec of await dbGetAll(store)) local.set(`${store}:${rec.id}`, { store, id: rec.id, updatedAt: rec.updatedAt || 0, data: rec });
  }
  const gone = readGone();
  const seen = new Set();
  const send = [];
  const dropped = [];
  let pulled = false;

  for (const r of records) {
    const key = `${r.store}:${r.id}`;
    const mine = local.get(key);
    seen.add(key);
    if (r.deleted) {
      delete gone[key];
      if (!mine) continue;
      if (mine.updatedAt > r.updatedAt) send.push(mine); // edited here after it was deleted elsewhere: it lives
      else {
        await dbDelete(r.store, r.id);
        dropped.push(...blobIds[r.store](mine.data));
        pulled = true;
      }
    } else if (!mine && gone[key] >= r.updatedAt) {
      send.push({ store: r.store, id: r.id, updatedAt: gone[key], deleted: true });
    } else if (!mine || mine.updatedAt < r.updatedAt) {
      await dbPut(r.store, r.data);
      delete gone[key];
      pulled = true;
    } else if (mine.updatedAt > r.updatedAt) {
      send.push(mine);
    }
  }
  for (const [key, mine] of local) if (!seen.has(key)) send.push(mine);
  // deleted here before the server ever heard of it: nothing to tell
  for (const key of Object.keys(gone)) if (!seen.has(key)) delete gone[key];

  if (send.length) {
    await uploadBlobs([...new Set(send.filter((r) => !r.deleted).flatMap((r) => blobIds[r.store](r.data)))]);
    await json(await sync.api('library', { method: 'POST', json: { records: send } }));
    send.filter((r) => r.deleted).forEach((r) => delete gone[`${r.store}:${r.id}`]);
  }
  writeGone(gone);

  if (pulled) {
    host.pulling = true;
    try {
      await loadLibrary();
    } finally {
      host.pulling = false;
    }
    await deleteBlobsIfUnreferenced(dropped);
  }
  if (!sync.libraryReady) {
    sync.libraryReady = true;
    host.onLibrary(library.get(), false);
  }
}

export async function syncLibrary() {
  if (!sync || !sync.on || sync.status === 'locked') return;
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      await compare();
    } while (again);
  } catch (err) {
    if (err.code !== 'locked') console.warn('[sync] covers not synced yet', err);
  } finally {
    running = false;
  }
}

if (sync) sync.syncLibrary = syncLibrary;
