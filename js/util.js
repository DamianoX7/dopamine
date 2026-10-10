'use strict';
/* Small helpers shared by every module. */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ESC_MAP[c]);

const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const dbToGain = (db) => Math.pow(10, db / 20);

/* ---------- formatting ---------- */
function fmtTime(sec) {
  sec = Math.max(0, Math.floor(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

function fmtDuration(sec) {
  sec = Math.round(sec || 0);
  if (sec < 60) return `${sec}초`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h) return m ? `${h}시간 ${m}분` : `${h}시간`;
  return s && m < 10 ? `${m}분 ${s}초` : `${m}분`;
}

const fmtNum = (n) => Math.round(n || 0).toLocaleString('ko-KR');

function fmtCompact(n) {
  n = Math.round(n || 0);
  if (Math.abs(n) < 10000) return fmtNum(n);
  if (Math.abs(n) < 1e8) return (n / 1e4).toFixed(n < 1e5 ? 1 : 0).replace(/\.0$/, '') + '만';
  return (n / 1e8).toFixed(1).replace(/\.0$/, '') + '억';
}

function fmtBytes(b) {
  if (!b) return '0 KB';
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / 1024 / 1024).toFixed(1)} MB`;
  return `${(b / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

/* Korean particles depend on the last sound of the word before them:
   josa('모찌', '이/가') → '모찌가' · josa('리본', '을/를') → '리본을' · josa('사막', '으로/로') → '사막으로' */
function josa(word, pair) {
  const text = String(word == null ? '' : word).trim();
  const [closed, open] = pair.split('/');
  const ch = text.slice(-1);
  const code = ch.charCodeAt(0);
  let final = false; // does it end in a consonant (받침)?
  let rieul = false;
  if (code >= 0xac00 && code <= 0xd7a3) {
    final = (code - 0xac00) % 28 !== 0;
    rieul = (code - 0xac00) % 28 === 8;
  } else if (/[0-9]/.test(ch)) {
    final = '013678'.includes(ch);
    rieul = '178'.includes(ch);
  } else if (/[a-z]/i.test(ch)) {
    final = !/[aeiouwyhdfjsvxz]/i.test(ch); // (a word that ends in d, s, f… is read with a vowel after it: Animud → 애니머드)
    rieul = /[lr]/i.test(ch);
  }
  if (closed === '으로') return text + (final && !rieul ? '으로' : '로');
  return text + (final ? closed : open);
}

/* ---------- local dates (streaks & dailies use the device's local day) ---------- */
function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function keyToUTC(key) {
  const [y, m, d] = key.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
}
const daysBetween = (a, b) => Math.round((keyToUTC(b) - keyToUTC(a)) / 86400000);

function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const diff = daysBetween(dateKey(d), dateKey());
  if (diff === 0) return '오늘';
  if (diff === 1) return '어제';
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}
const fmtDateLong = (iso) => new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });

/* ---------- randomness ---------- */
function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (arr, rnd = Math.random) => arr[Math.floor(rnd() * arr.length)];
const randInt = (lo, hi, rnd = Math.random) => lo + Math.floor(rnd() * (hi - lo + 1));
function shuffle(arr, rnd = Math.random) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const newSeed = () => Math.floor(Math.random() * 2147483647);

/* ---------- functions ---------- */
function debounce(fn, ms) {
  let t;
  const d = (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
  d.flush = (...args) => {
    clearTimeout(t);
    fn(...args);
  };
  return d;
}

const normTitle = (s) => String(s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const safeFileName = (s) => String(s || '').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 70) || '내 커버';

/* ---------- environment ---------- */
const isLateNightHour = (d = new Date()) => d.getHours() < 5;
const isCoarsePointer = () => !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
const isAppleWebKit = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ||
  (/Safari/.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|Firefox|FxiOS/.test(navigator.userAgent));
const isKakaoInApp = () => /KAKAOTALK/i.test(navigator.userAgent);
const isInAppBrowser = () => /KAKAOTALK|Instagram|FBAN|FBAV|Line\/|NAVER\(inapp|DaumApps|everytimeApp/i.test(navigator.userAgent);
function reducedMotion() {
  const os = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  return os || !!(typeof State !== 'undefined' && State.settings && State.settings.reduceMotion);
}

/* ---------- files ---------- */
function blobToArrayBuffer(blob) {
  if (blob.arrayBuffer) return blob.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error);
    fr.readAsArrayBuffer(blob);
  });
}

function canShareFile(blob, name) {
  try {
    if (!navigator.canShare || !window.File || !isCoarsePointer()) return false;
    return navigator.canShare({ files: [new File([blob], name, { type: blob.type })] });
  } catch (e) {
    return false;
  }
}

async function shareFile(blob, name, title) {
  try {
    await navigator.share({ files: [new File([blob], name, { type: blob.type })], title });
    return true;
  } catch (e) {
    if (e && e.name === 'AbortError') return false;
    throw e;
  }
}
