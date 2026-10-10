// IndexedDB storage: binary data (audio, artwork) + library records.
import { uid } from './util.js';
import { MSG } from '../messages.js';

const DB_NAME = 'cover-studio';
const DB_VERSION = 1;
export const STORES = ['blobs', 'singles', 'albums', 'drafts'];

let dbPromise = null;

export class StorageError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'StorageError';
    this.cause = cause;
  }
}

function mapError(err) {
  if (err instanceof StorageError) return err;
  const name = err && err.name;
  if (name === 'QuotaExceededError' || (err && /quota/i.test(err.message || ''))) {
    return new StorageError(MSG.storageFull, err);
  }
  return new StorageError(`이 기기의 저장 공간에 저장하지 못했어요 (${name || '알 수 없는 오류'}).`, err);
}

export function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (!('indexedDB' in window) || !window.indexedDB) {
      reject(new StorageError(MSG.storageUnavailable));
      return;
    }
    let req;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (err) {
      reject(new StorageError(MSG.storageUnavailable, err));
      return;
    }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const name of STORES) {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => { db.close(); dbPromise = null; };
      resolve(db);
    };
    req.onerror = () => { dbPromise = null; reject(new StorageError(MSG.storageUnavailable, req.error)); };
  });
  return dbPromise;
}

function reqPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new DOMException('Transaction aborted', 'AbortError'));
  });
}

export async function dbGet(store, id) {
  const db = await openDB();
  return reqPromise(db.transaction(store, 'readonly').objectStore(store).get(id));
}

export async function dbGetAll(store) {
  const db = await openDB();
  return reqPromise(db.transaction(store, 'readonly').objectStore(store).getAll());
}

export async function dbPut(store, value) {
  const db = await openDB();
  try {
    const tx = db.transaction(store, 'readwrite');
    tx.objectStore(store).put(value);
    await txDone(tx);
  } catch (err) {
    throw err && err.name === 'DataCloneError' ? err : mapError(err);
  }
  return value;
}

export async function dbDelete(store, id) {
  const db = await openDB();
  const tx = db.transaction(store, 'readwrite');
  tx.objectStore(store).delete(id);
  await txDone(tx);
}

/** Store a Blob. Falls back to an ArrayBuffer for engines that can't clone Blobs into IDB. */
export async function putBlob(blob, { kind = 'misc', id = uid('blob') } = {}) {
  const record = { id, kind, type: blob.type, size: blob.size, createdAt: Date.now(), blob };
  try {
    await dbPut('blobs', record);
  } catch (err) {
    if (err && err.name === 'DataCloneError') {
      const buffer = await blob.arrayBuffer();
      await dbPut('blobs', { ...record, blob: null, buffer });
    } else {
      throw mapError(err);
    }
  }
  return id;
}

/** Only what this device holds. */
export async function getLocalBlob(id) {
  if (!id) return null;
  const rec = await dbGet('blobs', id);
  if (!rec) return null;
  if (rec.blob instanceof Blob) return rec.blob;
  if (rec.buffer) return new Blob([rec.buffer], { type: rec.type || '' });
  return null;
}

// Covers saved on another device arrive as records only; their audio and artwork are fetched
// from the server the first time they are needed here, and kept (see ../sync.js).
const fetching = new Map();

function fetchRemoteBlob(id) {
  const sync = window.Sync;
  if (!sync || !sync.on || sync.status === 'locked') return null;
  if (!fetching.has(id)) {
    const job = (async () => {
      try {
        const res = await sync.api(`blob/${id}`, { timeout: 600000 });
        if (!res.ok) return null;
        const blob = await res.blob();
        try {
          await putBlob(blob, { id, kind: res.headers.get('X-DW-Kind') || 'misc' });
        } catch (err) {
          console.warn('[db] could not keep a downloaded blob', err);
        }
        return blob;
      } catch (err) {
        return null;
      } finally {
        fetching.delete(id);
      }
    })();
    fetching.set(id, job);
  }
  return fetching.get(id);
}

export async function getBlob(id) {
  return (await getLocalBlob(id)) || (id ? fetchRemoteBlob(id) : null);
}

export async function getBlobInfo(id) {
  if (!id) return null;
  const rec = await dbGet('blobs', id);
  return rec ? { id: rec.id, kind: rec.kind, type: rec.type, size: rec.size, createdAt: rec.createdAt } : null;
}

export async function deleteBlob(id) {
  if (!id) return;
  try { await dbDelete('blobs', id); } catch (err) { console.warn('[db] deleteBlob failed', err); }
}

/** All blob ids with sizes (no Blob payloads are read into memory by the caller). */
export async function listBlobMeta() {
  const db = await openDB();
  const out = [];
  await new Promise((resolve, reject) => {
    const req = db.transaction('blobs', 'readonly').objectStore('blobs').openCursor();
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) { resolve(); return; }
      const v = cursor.value;
      out.push({ id: v.id, kind: v.kind, size: v.size || 0, createdAt: v.createdAt || 0 });
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
  return out;
}
