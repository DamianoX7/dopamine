// Shared Web Audio helpers used by the recording engine, the preview player and the renderer.

export function getAudioContextClass() {
  return window.AudioContext || window.webkitAudioContext || null;
}

export function getOfflineContextClass() {
  return window.OfflineAudioContext || window.webkitOfflineAudioContext || null;
}

const LIMITER = { threshold: -1, knee: 0, ratio: 20, attack: 0.002, release: 0.1 };
// Web Audio compressors add automatic make-up gain of (1 / curve(0 dBFS))^0.6. With a hard
// knee, curve(0 dBFS) = threshold + (0 − threshold) / ratio (dB). We undo it so that signals
// below the threshold pass at exactly unity gain ("100%" really means 100%).
const MAKEUP_DB = -0.6 * (LIMITER.threshold + (0 - LIMITER.threshold) / LIMITER.ratio);
export const LIMITER_COMPENSATION = Math.pow(10, -MAKEUP_DB / 20);

/**
 * Safety limiter so loud mixes (e.g. 200% + 200%) don't hard-clip. Unity gain below −1 dBFS.
 * Used identically in the live take, the preview and the final render.
 * Returns { input, output } nodes.
 */
export function createLimiter(ctx) {
  const c = ctx.createDynamicsCompressor();
  c.threshold.value = LIMITER.threshold;
  c.knee.value = LIMITER.knee;
  c.ratio.value = LIMITER.ratio;
  c.attack.value = LIMITER.attack;
  c.release.value = LIMITER.release;
  const trim = ctx.createGain();
  trim.gain.value = LIMITER_COMPENSATION;
  c.connect(trim);
  return { input: c, output: trim };
}

export function startRendering(ctx) {
  return new Promise((resolve, reject) => {
    ctx.oncomplete = (e) => resolve(e.renderedBuffer);
    try {
      const p = ctx.startRendering();
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    } catch (err) {
      reject(err);
    }
  });
}

const latencyCache = new Map();
/**
 * The limiter looks ahead a few milliseconds, which delays its output. Measure that delay
 * (in frames) once per sample rate with an impulse, so renders can remove it exactly.
 */
export async function limiterLatencyFrames(sampleRate) {
  if (latencyCache.has(sampleRate)) return latencyCache.get(sampleRate);
  const Off = getOfflineContextClass();
  const len = Math.round(sampleRate * 0.05);
  const ctx = new Off(1, len, sampleRate);
  const buf = ctx.createBuffer(1, len, sampleRate);
  buf.getChannelData(0)[0] = 0.25;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const lim = createLimiter(ctx);
  src.connect(lim.input);
  lim.output.connect(ctx.destination);
  src.start(0);
  const out = await startRendering(ctx);
  const d = out.getChannelData(0);
  let idx = 0;
  let max = 0;
  for (let i = 0; i < d.length; i++) {
    const v = Math.abs(d[i]);
    if (v > max) { max = v; idx = i; }
  }
  latencyCache.set(sampleRate, idx);
  return idx;
}

/** decodeAudioData that works with both the callback (old Safari) and promise forms. */
export function decodeAudio(ctx, arrayBuffer) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const ok = (buf) => { if (!settled) { settled = true; resolve(buf); } };
    const fail = (err) => { if (!settled) { settled = true; reject(err || new Error('오디오를 해석하지 못했어요.')); } };
    try {
      const p = ctx.decodeAudioData(arrayBuffer, ok, fail);
      if (p && typeof p.then === 'function') p.then(ok, fail);
    } catch (err) {
      fail(err);
    }
  });
}

/** Decode an encoded file to AudioBuffer at a specific sample rate (independent of any device). */
export async function decodeToRate(arrayBuffer, sampleRate) {
  const Off = getOfflineContextClass();
  if (!Off) throw new Error('이 브라우저는 오프라인 오디오 처리를 지원하지 않아요.');
  const ctx = new Off(2, 1, sampleRate);
  return decodeAudio(ctx, arrayBuffer);
}

export function makeAudioBuffer(channels, sampleRate) {
  const n = Math.max(1, channels.length);
  const length = Math.max(1, channels[0] ? channels[0].length : 1);
  let buf;
  try {
    buf = new AudioBuffer({ length, numberOfChannels: n, sampleRate });
  } catch {
    const Off = getOfflineContextClass();
    buf = new Off(n, length, sampleRate).createBuffer(n, length, sampleRate);
  }
  channels.forEach((data, i) => {
    if (typeof buf.copyToChannel === 'function') buf.copyToChannel(data, i);
    else buf.getChannelData(i).set(data);
  });
  return buf;
}

/**
 * Start `src` so that buffer position `bufferPos` sounds at context time `when`, for at
 * most `maxDur` seconds. Negative positions start later (silence first). Returns false
 * when nothing of the buffer falls inside the window (the source is then never started).
 */
export function scheduleBuffer(src, when, bufferPos, maxDur) {
  const bufDur = src.buffer ? src.buffer.duration : 0;
  let start = when;
  let offset = bufferPos;
  let dur = maxDur;
  if (offset < 0) {
    start = when - offset;
    dur = maxDur + offset;
    offset = 0;
  }
  if (!(dur > 0.0005) || offset >= bufDur) return false;
  dur = Math.min(dur, bufDur - offset);
  src.start(start, offset, dur);
  return true;
}

/** Current peak (0..1) of an AnalyserNode's time-domain signal. */
export function analyserPeak(analyser, buf) {
  if (!analyser) return 0;
  if (typeof analyser.getFloatTimeDomainData === 'function') {
    analyser.getFloatTimeDomainData(buf);
    let m = 0;
    for (let i = 0; i < buf.length; i++) {
      const v = buf[i] < 0 ? -buf[i] : buf[i];
      if (v > m) m = v;
    }
    return m;
  }
  const bytes = new Uint8Array(analyser.fftSize);
  analyser.getByteTimeDomainData(bytes);
  let m = 0;
  for (let i = 0; i < bytes.length; i++) m = Math.max(m, Math.abs(bytes[i] - 128) / 128);
  return m;
}
