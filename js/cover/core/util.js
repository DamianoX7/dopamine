export function uid(prefix = 'id') {
  if (globalThis.crypto && typeof crypto.randomUUID === 'function') return `${prefix}_${crypto.randomUUID()}`;
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`;
}

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

/** 83.4 -> "1:23" (or "1:23.4" with tenths). */
export function formatTime(sec, { tenths = false } = {}) {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  if (tenths) {
    const total = Math.floor(sec * 10 + 1e-6);
    const m = Math.floor(total / 600);
    const s = Math.floor((total % 600) / 10);
    return `${m}:${String(s).padStart(2, '0')}.${total % 10}`;
  }
  const whole = Math.floor(sec + 1e-6);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** "1:23.4" | "83" | "1:02:03" -> seconds, or null when unparseable. */
export function parseTimeInput(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (/^\d+(\.\d+)?$/.test(t)) return parseFloat(t);
  const parts = t.split(':');
  if (parts.length < 2 || parts.length > 3) return null;
  let total = 0;
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (!/^\d+(\.\d+)?$/.test(p)) return null;
    const n = parseFloat(p);
    if (i > 0 && n >= 60) return null;
    total = total * 60 + n;
  }
  return total;
}

export function formatBytes(n) {
  if (!Number.isFinite(n) || n <= 0) return '0 KB';
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function formatDate(ts) {
  try {
    return new Date(ts).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch {
    return '';
  }
}

export function timeAgo(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 60) return '방금 전';
  const m = Math.round(s / 60);
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}시간 전`;
  return formatDate(ts);
}

export function gainToDb(x) {
  return x > 0 ? 20 * Math.log10(x) : -Infinity;
}

export function formatDb(x) {
  const db = gainToDb(x);
  if (!Number.isFinite(db) || db < -90) return '−∞ dB';
  return `${db < 0 ? '−' : '+'}${Math.abs(db).toFixed(0)} dB`;
}

/** Make a string safe to use as a download filename on every OS. */
export function sanitizeFilename(name, fallback = '커버') {
  let s = String(name ?? '')
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/, '');
  if (!s) s = fallback;
  if (/^(con|prn|aux|nul|com\d|lpt\d)$/i.test(s)) s = `${s}_`;
  return s.slice(0, 120).trim();
}

export function debounce(fn, ms) {
  let timer = null;
  let lastArgs = null;
  const debounced = (...args) => {
    lastArgs = args;
    clearTimeout(timer);
    timer = setTimeout(() => { timer = null; fn(...lastArgs); }, ms);
  };
  debounced.flush = () => {
    if (timer) { clearTimeout(timer); timer = null; fn(...lastArgs); }
  };
  debounced.cancel = () => { clearTimeout(timer); timer = null; };
  return debounced;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Resolve with the promise's value, or with `fallback` after `ms`. */
export function withTimeout(promise, ms, fallback = undefined) {
  let timer;
  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    new Promise((resolve) => { timer = setTimeout(() => resolve(fallback), ms); }),
  ]);
}

export const pct = (v) => `${Math.round(v * 100)}%`;
