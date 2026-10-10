'use strict';
/* ==================================================================
   IndexedDB layer — audio blobs are far too big for localStorage.

   DopamineWorldDB
     ├── recordings   { id, blob, mimeType, duration, createdAt }
     ├── backings     { id, blob, name, mimeType, duration, createdAt, size }
     ├── meta         { id: 'state', json }   ← backup copy of the metadata
     └── photos       { id, blob, thumb, w, h, at, scene, names }   ← pictures of the foxes (js/pet.js)

   If IndexedDB is unavailable (blocked, private mode quirks, errors),
   everything falls back to an in-memory store so the app keeps working;
   the UI then warns that recordings won't survive a refresh.
   ================================================================== */
const DB = (() => {
  const NAME = 'DopamineWorldDB';
  const VERSION = 2; // 2: + photos
  const STORES = ['recordings', 'backings', 'meta', 'photos'];
  const mem = { recordings: new Map(), backings: new Map(), meta: new Map(), photos: new Map() };
  let dbPromise = null;
  let persistent = true;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window) || !window.indexedDB) return reject(new Error('IndexedDB unavailable'));
      let req;
      try {
        req = indexedDB.open(NAME, VERSION);
      } catch (e) {
        return reject(e);
      }
      const timer = setTimeout(() => reject(new Error('IndexedDB open timed out')), 5000);
      req.onupgradeneeded = () => {
        const db = req.result;
        STORES.forEach((s) => {
          if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        });
      };
      req.onsuccess = () => {
        clearTimeout(timer);
        const db = req.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      req.onerror = () => {
        clearTimeout(timer);
        reject(req.error || new Error('IndexedDB error'));
      };
    }).catch((err) => {
      console.warn('[DB] falling back to memory:', err);
      persistent = false;
      return null;
    });
    return dbPromise;
  }

  function run(db, store, mode, fn) {
    return new Promise((resolve, reject) => {
      let tx;
      try {
        tx = db.transaction(store, mode);
      } catch (e) {
        return reject(e);
      }
      let result;
      const req = fn(tx.objectStore(store));
      if (req) req.onsuccess = () => (result = req.result);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error || (req && req.error));
      tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
  }

  async function put(store, value) {
    const db = await open();
    if (!db) {
      mem[store].set(value.id, value);
      return;
    }
    try {
      await run(db, store, 'readwrite', (s) => s.put(value));
    } catch (err) {
      if (err && err.name === 'QuotaExceededError') throw Object.assign(new Error('Storage full'), { code: 'quota' });
      // Some older engines can't store Blobs — retry with a plain ArrayBuffer.
      if (value.blob instanceof Blob) {
        const buffer = await blobToArrayBuffer(value.blob);
        const copy = Object.assign({}, value, { blob: null, buffer, mimeType: value.mimeType || value.blob.type });
        await run(db, store, 'readwrite', (s) => s.put(copy));
      } else {
        throw err;
      }
    }
  }

  async function get(store, id) {
    const db = await open();
    let rec = db ? await run(db, store, 'readonly', (s) => s.get(id)) : mem[store].get(id);
    if (rec && !rec.blob && rec.buffer) {
      rec = Object.assign({}, rec, { blob: new Blob([rec.buffer], { type: rec.mimeType || '' }) });
    }
    return rec || null;
  }

  async function del(store, id) {
    const db = await open();
    if (!db) return void mem[store].delete(id);
    await run(db, store, 'readwrite', (s) => s.delete(id));
  }

  async function keys(store) {
    const db = await open();
    if (!db) return Array.from(mem[store].keys());
    return (await run(db, store, 'readonly', (s) => s.getAllKeys())) || [];
  }

  /* Every record of a store (blobs come as handles, so this stays cheap). */
  async function all(store) {
    const db = await open();
    if (!db) return Array.from(mem[store].values());
    return (await run(db, store, 'readonly', (s) => s.getAll())) || [];
  }

  async function clearAll() {
    const db = await open();
    STORES.forEach((s) => mem[s].clear());
    if (!db) return;
    for (const s of STORES) await run(db, s, 'readwrite', (st) => st.clear());
  }

  return { open, put, get, del, keys, all, clearAll, isPersistent: () => persistent };
})();
