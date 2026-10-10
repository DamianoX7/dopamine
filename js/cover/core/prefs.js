// Lightweight preferences + studio session text in localStorage.
// Audio and images never go here (they live in IndexedDB).

const PREFS_KEY = 'coverStudio.prefs.v1';
const SESSION_KEY = 'coverStudio.session.v1';

const DEFAULTS = {
  headphoneTipDismissed: false,
  listening: 'headphones', // 'headphones' | 'speaker'
  syncMs: 0,
  backingVolume: 1,
  voiceVolume: 1,
  backingListen: 0.9,
  coverArtist: '',
  lyricsSize: 20,
  micDeviceId: '',
  mutedVideoWithUpload: false,
};

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or disabled: preferences are optional */
  }
}

let cache = null;

export function getPrefs() {
  if (!cache) cache = { ...DEFAULTS, ...(read(PREFS_KEY) || {}) };
  return cache;
}

export function setPrefs(patch) {
  cache = { ...getPrefs(), ...patch };
  write(PREFS_KEY, cache);
  return cache;
}

/** In-progress studio text (YouTube link + lyrics) so a refresh doesn't lose typing. */
export function getSession() {
  return { youtubeUrl: '', lyrics: '', ...(read(SESSION_KEY) || {}) };
}

export function setSession(patch) {
  write(SESSION_KEY, { ...getSession(), ...patch });
}

export function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}
