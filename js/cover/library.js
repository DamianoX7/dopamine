// Library: Singles, Albums and the one unsaved draft take. Metadata lives in IndexedDB
// stores; audio/artwork live in the 'blobs' store and are referenced by id.
// Albums only reference Single ids — adding a Single to an Album never copies audio.

import { createStore } from './core/store.js';
import { dbGet, dbGetAll, dbPut, dbDelete, deleteBlob, listBlobMeta } from './core/db.js';
import { uid } from './core/util.js';

export const library = createStore({ singles: [], albums: [], draft: null, loaded: false, error: null });

const bySinglesOrder = (list) => [...list].sort((a, b) => b.createdAt - a.createdAt);
const byAlbumsOrder = (list) => [...list].sort((a, b) => b.createdAt - a.createdAt);

export async function loadLibrary() {
  try {
    const [singles, albums, draft] = await Promise.all([dbGetAll('singles'), dbGetAll('albums'), dbGet('drafts', 'current')]);
    library.set({ singles: bySinglesOrder(singles), albums: byAlbumsOrder(albums), draft: draft || null, loaded: true, error: null });
  } catch (err) {
    console.error('[library] load failed', err);
    library.set({ loaded: true, error: err.message || String(err) });
  }
}

export const getSingle = (id) => library.get().singles.find((s) => s.id === id) || null;
export const getAlbum = (id) => library.get().albums.find((a) => a.id === id) || null;
export const albumTracks = (album) => (album ? album.trackIds.map(getSingle).filter(Boolean) : []);
export const albumsContaining = (singleId) => library.get().albums.filter((a) => a.trackIds.includes(singleId));

// ---------------------------------------------------------------- deletions
// Remembered ("store:id" → when) until the server has heard of them, so that the other
// devices drop the record too instead of bringing it back (see sync.js).

const GONE_KEY = 'dopamineWorld.syncGone.v1';

export function readGone() {
  try {
    return JSON.parse(localStorage.getItem(GONE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function writeGone(gone) {
  try { localStorage.setItem(GONE_KEY, JSON.stringify(gone)); } catch { /* ignore */ }
}

function noteGone(store, id) {
  if (!window.Sync || !window.Sync.on) return;
  const gone = readGone();
  gone[`${store}:${id}`] = Date.now();
  writeGone(gone);
}

// ---------------------------------------------------------------- blob references

export function singleBlobIds(s) {
  return [s.audioId, s.artworkId, s.originalTakeId, s.voiceStemId, s.backingStemId].filter(Boolean);
}
export const albumBlobIds = (a) => [a.artworkId].filter(Boolean);
export const draftBlobIds = (d) => [d.takeId, d.voiceStemId, d.backingStemId].filter(Boolean);

async function referencedBlobIds() {
  const refs = new Set();
  const [singles, albums, drafts] = await Promise.all([dbGetAll('singles'), dbGetAll('albums'), dbGetAll('drafts')]);
  singles.forEach((s) => singleBlobIds(s).forEach((id) => refs.add(id)));
  albums.forEach((a) => albumBlobIds(a).forEach((id) => refs.add(id)));
  drafts.forEach((d) => draftBlobIds(d).forEach((id) => refs.add(id)));
  return refs;
}

/** Delete blobs that no Single/Album/Draft references (e.g. an uploaded track shared by several takes). */
export async function deleteBlobsIfUnreferenced(ids, keep = []) {
  const list = ids.filter(Boolean);
  if (!list.length) return;
  const refs = await referencedBlobIds();
  const keepSet = new Set(keep);
  for (const id of list) {
    if (!refs.has(id) && !keepSet.has(id)) await deleteBlob(id);
  }
}

/**
 * Remove orphaned blobs (left behind by a crash or a closed tab). Only blobs created before
 * `olderThan` are considered, so a recording being saved right now is never touched.
 */
export async function collectGarbage({ olderThan = Date.now() } = {}) {
  const refs = await referencedBlobIds();
  const all = await listBlobMeta();
  let freed = 0;
  for (const b of all) {
    if (!refs.has(b.id) && b.createdAt < olderThan) {
      await deleteBlob(b.id);
      freed += b.size;
    }
  }
  return freed;
}

// ---------------------------------------------------------------- singles

async function putSingle(single) {
  await dbPut('singles', single);
  const rest = library.get().singles.filter((s) => s.id !== single.id);
  library.set({ singles: bySinglesOrder([single, ...rest]) });
  return single;
}

export async function createSingle(data) {
  const now = Date.now();
  return putSingle({ ...data, id: data.id || uid('single'), createdAt: now, updatedAt: now });
}

export async function updateSingle(id, patch) {
  const cur = getSingle(id) || (await dbGet('singles', id));
  if (!cur) throw new Error('그 싱글은 이제 없어요.');
  return putSingle({ ...cur, ...patch, id, updatedAt: Date.now() });
}

export async function deleteSingle(id) {
  const single = getSingle(id) || (await dbGet('singles', id));
  if (!single) return;
  // Remove it from albums (the albums themselves stay).
  for (const album of library.get().albums) {
    if (album.trackIds.includes(id)) {
      await putAlbum({ ...album, trackIds: album.trackIds.filter((t) => t !== id), updatedAt: Date.now() });
    }
  }
  await dbDelete('singles', id);
  noteGone('singles', id);
  library.set({ singles: library.get().singles.filter((s) => s.id !== id) });
  await deleteBlobsIfUnreferenced(singleBlobIds(single));
}

// ---------------------------------------------------------------- albums

async function putAlbum(album) {
  await dbPut('albums', album);
  const rest = library.get().albums.filter((a) => a.id !== album.id);
  library.set({ albums: byAlbumsOrder([album, ...rest]) });
  return album;
}

export async function createAlbum({ title, artist = '', description = '', artworkId = null, trackIds = [] }) {
  const now = Date.now();
  return putAlbum({
    id: uid('album'),
    title: title || '제목 없는 앨범',
    artist,
    description,
    artworkId,
    trackIds: [...new Set(trackIds)],
    createdAt: now,
    updatedAt: now,
  });
}

export async function updateAlbum(id, patch) {
  const cur = getAlbum(id) || (await dbGet('albums', id));
  if (!cur) throw new Error('그 앨범은 이제 없어요.');
  const next = { ...cur, ...patch, id, updatedAt: Date.now() };
  next.trackIds = [...new Set(next.trackIds || [])];
  return putAlbum(next);
}

export async function deleteAlbum(id) {
  const album = getAlbum(id);
  if (!album) return;
  await dbDelete('albums', id);
  noteGone('albums', id);
  library.set({ albums: library.get().albums.filter((a) => a.id !== id) });
  await deleteBlobsIfUnreferenced(albumBlobIds(album));
}

export async function addTracksToAlbum(albumId, singleIds) {
  const album = getAlbum(albumId);
  if (!album) throw new Error('그 앨범은 이제 없어요.');
  const tracks = [...album.trackIds];
  for (const sid of singleIds) if (!tracks.includes(sid)) tracks.push(sid);
  return updateAlbum(albumId, { trackIds: tracks });
}

/** Removes the Single from this Album only; the Single itself is untouched. */
export async function removeTrackFromAlbum(albumId, singleId) {
  const album = getAlbum(albumId);
  if (!album) return null;
  return updateAlbum(albumId, { trackIds: album.trackIds.filter((t) => t !== singleId) });
}

export function reorder(list, from, to) {
  const next = [...list];
  if (from < 0 || from >= next.length || to < 0 || to >= next.length || from === to) return next;
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export async function moveTrack(albumId, from, to) {
  const album = getAlbum(albumId);
  if (!album) return null;
  return updateAlbum(albumId, { trackIds: reorder(album.trackIds, from, to) });
}

// ---------------------------------------------------------------- draft (one unsaved take)

export async function getDraft() {
  return (await dbGet('drafts', 'current')) || null;
}

export async function saveDraft(draft) {
  const record = { ...draft, id: 'current', updatedAt: Date.now() };
  await dbPut('drafts', record);
  library.set({ draft: record });
  return record;
}

/** Delete the draft record and its take/stems (blobs still used elsewhere are kept). */
export async function discardDraft({ keep = [] } = {}) {
  const draft = await getDraft();
  if (!draft) return;
  await dbDelete('drafts', 'current');
  library.set({ draft: null });
  await deleteBlobsIfUnreferenced(draftBlobIds(draft), keep);
}

/** Forget the draft record but keep its blobs (they now belong to a saved Single). */
export async function releaseDraftRecord() {
  await dbDelete('drafts', 'current');
  library.set({ draft: null });
}
