// Capability detection layer. Nothing here assumes support — every answer is checked,
// and the parts that can only be known by trying (display audio, recorder output) are
// probed at runtime.
import { canPlay } from './mime.js';
import { sleep, withTimeout } from '../core/util.js';

export const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/aac',
  'audio/ogg;codecs=opus',
];

function isTypeSupported(type) {
  try {
    return typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function'
      && MediaRecorder.isTypeSupported(type);
  } catch {
    return false;
  }
}

function detectPlatform() {
  const ua = navigator.userAgent || '';
  const uaData = navigator.userAgentData;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || (uaData && uaData.mobile === true) || /Mobi/i.test(ua);
  const brands = (uaData && Array.isArray(uaData.brands)) ? uaData.brands.map((b) => b.brand).join(' ') : '';
  const isChromium = /Chromium|Google Chrome|Microsoft Edge|Opera|Brave/i.test(brands) || (/Chrome\//.test(ua) && !/Edg\//.test(ua) && !isIOS) || /Edg\//.test(ua);
  let browser = '이 브라우저';
  if (/Edg\//.test(ua)) browser = 'Edge';
  else if (/SamsungBrowser/i.test(ua)) browser = 'Samsung Internet';
  else if (/Firefox\//.test(ua) || /FxiOS/.test(ua)) browser = 'Firefox';
  else if (/CriOS/.test(ua)) browser = 'Chrome (iOS)';
  else if (/Chrome\//.test(ua)) browser = 'Chrome';
  else if (/Safari\//.test(ua)) browser = 'Safari';
  return { isIOS, isAndroid, isMobile, isChromium, browser };
}

export function detectCapabilities() {
  const md = navigator.mediaDevices;
  const AC = window.AudioContext || window.webkitAudioContext;
  const platform = detectPlatform();
  let supportedConstraints = {};
  try { supportedConstraints = (md && md.getSupportedConstraints && md.getSupportedConstraints()) || {}; } catch { /* ignore */ }

  const hasMediaRecorder = typeof window.MediaRecorder === 'function';
  const recordable = hasMediaRecorder ? MIME_CANDIDATES.filter(isTypeSupported) : [];
  // Prefer a format this browser can also play back, so the review player works.
  const playable = recordable.filter((t) => canPlay(t) !== '');
  const getDisplayMedia = !!(md && typeof md.getDisplayMedia === 'function');

  // Tab/system audio from getDisplayMedia is only implemented by desktop Chromium browsers.
  // `suppressLocalAudioPlayback` is a Chromium-only display-capture constraint, so it is a
  // good hint — but the real answer only comes after the user shares (audio track or not).
  let displayAudio = 'unsupported';
  if (getDisplayMedia) {
    displayAudio = !platform.isMobile && (supportedConstraints.suppressLocalAudioPlayback || platform.isChromium)
      ? 'likely'
      : 'unlikely';
  }

  return {
    ...platform,
    secureContext: window.isSecureContext === true,
    microphone: !!(md && typeof md.getUserMedia === 'function'),
    mediaRecorder: hasMediaRecorder,
    getDisplayMedia,
    displayAudio, // 'likely' | 'unlikely' | 'unsupported'
    audioContext: !!AC,
    audioWorklet: !!AC && 'audioWorklet' in AC.prototype && typeof window.AudioWorkletNode === 'function',
    mediaStreamDestination: !!AC && 'createMediaStreamDestination' in AC.prototype,
    offlineAudioContext: !!(window.OfflineAudioContext || window.webkitOfflineAudioContext),
    supportedMimeTypes: recordable,
    preferredMimeType: playable[0] || recordable[0] || null,
    preferredPlayable: playable.length > 0,
    audioSession: 'audioSession' in navigator,
    indexedDB: 'indexedDB' in window,
  };
}

/**
 * The core requirement check: can this browser actually record a Web Audio mix with
 * MediaRecorder? Records ~0.45 s of a quiet test tone that goes ONLY into a
 * MediaStreamDestination (never to the speakers), then checks the Blob.
 * `ctx` must be running (created/resumed inside a user gesture).
 */
export async function probeMixedRecording(ctx, mimeType) {
  if (typeof MediaRecorder !== 'function') return { ok: false, reason: 'no-mediarecorder' };
  if (!ctx || typeof ctx.createMediaStreamDestination !== 'function') return { ok: false, reason: 'no-destination' };
  if (!mimeType) return { ok: false, reason: 'no-mime' };
  if (ctx.state !== 'running') {
    try { await withTimeout(ctx.resume(), 1500); } catch { /* ignore */ }
    if (ctx.state !== 'running') return { ok: false, reason: 'suspended' };
  }
  const dest = ctx.createMediaStreamDestination();
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  gain.gain.value = 0.1;
  osc.frequency.value = 440;
  osc.connect(gain);
  gain.connect(dest);
  osc.start();
  const cleanup = () => {
    try { osc.stop(); } catch { /* ignore */ }
    osc.disconnect();
    gain.disconnect();
    dest.stream.getTracks().forEach((t) => t.stop());
  };
  let rec;
  try {
    rec = new MediaRecorder(dest.stream, { mimeType });
  } catch (err) {
    cleanup();
    return { ok: false, reason: 'format', error: String(err && err.message) };
  }
  const chunks = [];
  rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  const stopped = new Promise((resolve) => rec.addEventListener('stop', resolve, { once: true }));
  try {
    rec.start();
    await sleep(450);
    rec.stop();
  } catch (err) {
    cleanup();
    return { ok: false, reason: 'start-failed', error: String(err && err.message) };
  }
  await withTimeout(stopped, 3000);
  cleanup();
  const type = rec.mimeType || mimeType;
  const blob = new Blob(chunks, { type });
  if (!blob.size) return { ok: false, reason: 'empty', mimeType: type };
  // Can this browser also decode what it just recorded? (Informational only.)
  let decodable = null;
  try {
    const ab = await blob.arrayBuffer();
    const decoded = await withTimeout(
      new Promise((resolve, reject) => {
        const p = ctx.decodeAudioData(ab, resolve, reject);
        if (p && typeof p.then === 'function') p.then(resolve, reject);
      }),
      3000,
      null,
    );
    decodable = decoded ? decoded.duration > 0.1 : null;
  } catch {
    decodable = false;
  }
  return { ok: true, size: blob.size, mimeType: type, decodable };
}
