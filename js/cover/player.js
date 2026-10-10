// Persistent bottom player. One <audio> element lives outside the page views, so playback
// continues while you move around the library. It plays the saved final mix of a Single.

import { createStore } from './core/store.js';
import { getBlob } from './core/db.js';
import { getSingle, getAlbum } from './library.js';
import { claimAudioFocus, releaseAudioFocus } from './core/audioFocus.js';
import { blobUrl } from './blobUrls.js';
import { wavHeader } from './audio/wav.js';

export const player = createStore({
  singleId: null,
  queue: [],
  index: -1,
  context: null, // { type: 'album', id } when playing an album
  playing: false,
  time: 0,
  duration: 0,
  loading: false,
  error: null,
});

const audio = new Audio();
audio.preload = 'auto';
let currentUrl = null;
let unlockUrl = null;
const owner = { pause: () => pause() };

audio.addEventListener('timeupdate', () => { if (player.get().singleId) player.set({ time: audio.currentTime }); });
audio.addEventListener('loadedmetadata', () => {
  if (player.get().singleId && Number.isFinite(audio.duration)) player.set({ duration: audio.duration });
});
audio.addEventListener('play', () => { if (player.get().singleId) player.set({ playing: true }); });
audio.addEventListener('pause', () => { if (player.get().singleId) player.set({ playing: false }); });
audio.addEventListener('ended', () => { if (player.get().singleId) next({ auto: true }); });
audio.addEventListener('error', () => {
  if (!player.get().singleId) return;
  player.set({ playing: false, loading: false, error: '이 브라우저에서는 이 녹음을 재생할 수 없어요.' });
});

// iOS only lets a media element start without a tap once it has been started by a tap.
// Prime our element on the first touch with a few milliseconds of silence.
function unlock() {
  document.removeEventListener('pointerdown', unlock, true);
  if (player.get().singleId || audio.src) return;
  const header = wavHeader({ numChannels: 1, sampleRate: 8000, dataBytes: 800 });
  unlockUrl = URL.createObjectURL(new Blob([header, new Int16Array(400)], { type: 'audio/wav' }));
  audio.src = unlockUrl;
  const p = audio.play();
  const done = () => {
    if (!player.get().singleId) {
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
    }
    URL.revokeObjectURL(unlockUrl);
    unlockUrl = null;
  };
  if (p && typeof p.then === 'function') p.then(done, done);
  else done();
}
document.addEventListener('pointerdown', unlock, true);

async function loadAt(queue, index, context, autoplay) {
  const id = queue[index];
  const single = getSingle(id);
  if (!single) return;
  player.set({ singleId: id, queue, index, context, loading: true, error: null, time: 0, duration: single.duration || 0 });
  let blob = null;
  try { blob = await getBlob(single.audioId); } catch { blob = null; }
  if (player.get().singleId !== id) return; // user moved on meanwhile
  if (!blob) {
    player.set({ loading: false, playing: false, error: '이 싱글의 오디오 파일을 저장 공간에서 찾을 수 없어요.' });
    return;
  }
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = URL.createObjectURL(blob);
  audio.src = currentUrl;
  player.set({ loading: false });
  updateMediaSession(single, context);
  if (autoplay) play();
}

/** Play a Single; pass `queue` (ids) to continue through an album. */
export function playSingle(id, { queue = null, context = null } = {}) {
  const q = queue && queue.length ? queue : [id];
  const index = Math.max(0, q.indexOf(id));
  const s = player.get();
  if (s.singleId === id && !s.error && audio.src) {
    player.set({ queue: q, index, context });
    play();
    return;
  }
  loadAt(q, index, context, true);
}

export function play() {
  if (!player.get().singleId || !audio.src) return;
  claimAudioFocus(owner);
  const p = audio.play();
  if (p && typeof p.catch === 'function') {
    p.catch((err) => {
      if (err && err.name === 'NotAllowedError') player.set({ playing: false });
      else if (err && err.name !== 'AbortError') player.set({ playing: false, error: '이 브라우저에서 재생하지 못했어요.' });
    });
  }
}

export function pause() {
  audio.pause();
  releaseAudioFocus(owner);
}

/** Where the Single that is playing is right now (seconds) — finer than the store's `time`, for keeping in step with it. */
export function clock() {
  return player.get().singleId && audio.src ? audio.currentTime : 0;
}

export function toggle() {
  if (audio.paused) play();
  else pause();
}

export function seek(t) {
  if (!audio.src) return;
  try { audio.currentTime = Math.max(0, Math.min(t, audio.duration || t)); } catch { /* ignore */ }
  player.set({ time: audio.currentTime });
}

export function next({ auto = false } = {}) {
  const { queue, index, context } = player.get();
  if (index < queue.length - 1) loadAt(queue, index + 1, context, true);
  else if (auto) {
    player.set({ playing: false, time: 0 });
    try { audio.currentTime = 0; } catch { /* ignore */ }
  }
}

export function prev() {
  const { queue, index, context } = player.get();
  if (audio.currentTime > 3 || index <= 0) seek(0);
  else loadAt(queue, index - 1, context, true);
}

export function closePlayer() {
  pause();
  audio.removeAttribute('src');
  audio.load();
  if (currentUrl) URL.revokeObjectURL(currentUrl);
  currentUrl = null;
  player.set({ singleId: null, queue: [], index: -1, context: null, playing: false, time: 0, duration: 0, error: null });
  if ('mediaSession' in navigator) navigator.mediaSession.metadata = null;
}

/** Called after a Single is edited (new audio) or deleted. */
export function refreshSingle(id, { deleted = false } = {}) {
  const s = player.get();
  if (deleted) {
    if (s.singleId === id) closePlayer();
    else if (s.queue.includes(id)) {
      const queue = s.queue.filter((q) => q !== id);
      player.set({ queue, index: queue.indexOf(s.singleId) });
    }
    return;
  }
  if (s.singleId === id) {
    const wasPlaying = !audio.paused;
    loadAt(s.queue, s.index, s.context, wasPlaying);
  }
}

function updateMediaSession(single, context) {
  if (!('mediaSession' in navigator) || typeof window.MediaMetadata !== 'function') return;
  const album = context && context.type === 'album' ? getAlbum(context.id) : null;
  const meta = {
    title: single.title || '제목 없는 커버',
    artist: single.coverArtist || single.originalArtist || '',
    album: album ? album.title : '도파민 월드',
  };
  navigator.mediaSession.metadata = new MediaMetadata(meta);
  if (single.artworkId) {
    blobUrl(single.artworkId).then((url) => {
      if (url && player.get().singleId === single.id) {
        navigator.mediaSession.metadata = new MediaMetadata({ ...meta, artwork: [{ src: url, sizes: '1024x1024', type: 'image/jpeg' }] });
      }
    });
  }
}

if ('mediaSession' in navigator) {
  const set = (action, fn) => { try { navigator.mediaSession.setActionHandler(action, fn); } catch { /* unsupported */ } };
  set('play', () => play());
  set('pause', () => pause());
  set('previoustrack', () => prev());
  set('nexttrack', () => next());
  set('seekto', (d) => { if (d && Number.isFinite(d.seekTime)) seek(d.seekTime); });
}
