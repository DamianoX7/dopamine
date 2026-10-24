// Listens to a finished cover the way a dancer would: where its beats fall, how fast they
// come, and how loud and how lively each moment is. The foxes dance to that (js/fox/dance.js).
// …and what key it is in (key.js): with how fast it goes, that makes its flower in the song
// garden (js/garden.js). Nothing here touches the playback — the saved recording is read once,
// a piece at a time, the first time it is played to them (or planted).
import { getBlob } from '../core/db.js';
import { getSingle } from '../library.js';
import { keyOf } from './key.js';

const RATE = 11025; //  plenty to find a beat in
const done = new Map(); // audio blob id → what was heard (null: it could not be read)
const busy = new Map(); // …→ the listening that is under way

/**
 * What is known of a cover's beat: { bpm, beats (seconds), step, level, energy, key } — `level` (how
 * loud) and `energy` (how lively that part of the song is) are bytes, `step` seconds apart; `key`:
 * see key.js. Null until it has been listened to; asking starts that.
 */
export function beatsOf(singleId) {
  const single = getSingle(singleId);
  if (!single || !single.audioId) return null;
  const key = single.audioId;
  if (done.has(key)) return done.get(key);
  hear(key);
  return null;
}

/** …the same, once it has been listened to: a promise (of null, if it could not be). */
export async function heardOf(singleId) {
  const single = getSingle(singleId);
  if (!single || !single.audioId) return null;
  const key = single.audioId;
  if (!done.has(key)) await hear(key);
  return done.get(key) || null;
}

function hear(key) {
  if (!busy.has(key)) {
    const job = listen(key)
      .catch((err) => {
        console.warn('[beat] could not listen to the cover', err);
        return null;
      })
      .then((heard) => {
        busy.delete(key);
        done.set(key, heard);
        if (done.size > 12) done.delete(done.keys().next().value);
      });
    busy.set(key, job);
  }
  return busy.get(key);
}

async function listen(audioId) {
  const blob = await getBlob(audioId);
  if (!blob) return null;
  const pcm = (await readWav(blob)) || (await decode(blob));
  if (!pcm) return null;
  const heard = analyse(pcm.samples, pcm.rate);
  if (heard) heard.key = keyOf(pcm.samples, pcm.rate);
  return heard;
}

// ------------------------------------------------------------------ reading the recording

/** A 16-bit WAV (what the studio saves), read in pieces and thinned out to one channel at about RATE. */
async function readWav(blob) {
  const head = new DataView(await blob.slice(0, 65536).arrayBuffer());
  const tag = (o) => String.fromCharCode(head.getUint8(o), head.getUint8(o + 1), head.getUint8(o + 2), head.getUint8(o + 3));
  if (head.byteLength < 44 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
  let fmt = null;
  let dataOff = -1;
  let dataLen = 0;
  for (let off = 12; off + 8 <= head.byteLength; ) {
    const id = tag(off);
    const size = head.getUint32(off + 4, true);
    if (id === 'fmt ') fmt = { format: head.getUint16(off + 8, true), channels: head.getUint16(off + 10, true), rate: head.getUint32(off + 12, true), bits: head.getUint16(off + 22, true) };
    else if (id === 'data') {
      dataOff = off + 8;
      dataLen = Math.min(size, blob.size - dataOff);
      break;
    }
    off += 8 + size + (size & 1);
  }
  if (!fmt || dataOff < 0 || fmt.format !== 1 || fmt.bits !== 16 || !fmt.channels || !fmt.rate) return null;
  const nCh = fmt.channels;
  const thin = Math.max(1, Math.round(fmt.rate / RATE)); // frames that become one sample
  const frames = Math.floor(dataLen / (nCh * 2));
  const out = new Float32Array(Math.floor(frames / thin));
  const piece = thin * 262144; // frames read at a time (a few megabytes)
  const per = thin * nCh;
  let o = 0;
  for (let f = 0; f + thin <= frames; f += piece) {
    const n = Math.floor(Math.min(piece, frames - f) / thin) * thin;
    const pcm = new Int16Array(await blob.slice(dataOff + f * nCh * 2, dataOff + (f + n) * nCh * 2).arrayBuffer());
    for (let i = 0; i + per <= pcm.length; ) {
      let s = 0;
      for (let k = 0; k < per; k++) s += pcm[i++];
      out[o++] = s / (per * 32768);
    }
  }
  return { samples: out.subarray(0, o), rate: fmt.rate / thin };
}

/** Anything else the browser can decode (covers are saved as WAV, so this is only a way out). */
async function decode(blob) {
  const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!AC || blob.size > 64e6) return null;
  let ctx = null;
  for (const rate of [RATE, 22050, 44100]) {
    try {
      ctx = new AC(1, 1, rate);
      break;
    } catch {
      ctx = null;
    }
  }
  if (!ctx) return null;
  const data = await blob.arrayBuffer();
  const buf = await new Promise((resolve, reject) => {
    const p = ctx.decodeAudioData(data, resolve, reject);
    if (p && p.then) p.then(resolve, reject);
  });
  const thin = Math.max(1, Math.round(buf.sampleRate / RATE));
  const out = new Float32Array(Math.floor(buf.length / thin));
  for (let c = 0; c < buf.numberOfChannels; c++) {
    const ch = buf.getChannelData(c);
    for (let o = 0, i = 0; o < out.length; o++) {
      let s = 0;
      for (let k = 0; k < thin; k++) s += ch[i++];
      out[o] += s / (thin * buf.numberOfChannels);
    }
  }
  return { samples: out, rate: buf.sampleRate / thin };
}

// ------------------------------------------------------------------ finding the beat

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function percentile(values, q) {
  const sorted = Float32Array.from(values).sort();
  return sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : 0;
}

/** The mean of `v` over `r` values to either side of each one. */
function smooth(v, r) {
  const n = v.length;
  const sum = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) sum[i + 1] = sum[i] + v[i];
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = Math.max(0, i - r);
    const b = Math.min(n, i + r + 1);
    out[i] = (sum[b] - sum[a]) / (b - a);
  }
  return out;
}

export function analyse(x, rate) {
  const HOP = Math.max(32, Math.round(rate / 86)); // a frame: about 12 ms
  const fps = rate / HOP;
  const n = Math.floor(x.length / HOP);
  if (n < fps * 4) return null; // under four seconds: nothing to dance to

  // how loud every frame is — in the bass, in the middle and at the top, and all together
  const bands = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  const loud = new Float32Array(n);
  const aLow = 1 - Math.exp((-2 * Math.PI * 180) / rate);
  const aMid = 1 - Math.exp((-2 * Math.PI * 1800) / rate);
  let low = 0;
  let mid = 0;
  for (let f = 0, i = 0; f < n; f++) {
    let e0 = 0;
    let e1 = 0;
    let e2 = 0;
    let e = 0;
    for (let k = 0; k < HOP; k++, i++) {
      const s = x[i];
      low += aLow * (s - low);
      mid += aMid * (s - mid);
      e0 += low * low;
      e1 += (mid - low) * (mid - low);
      e2 += (s - mid) * (s - mid);
      e += s * s;
    }
    bands[0][f] = e0 / HOP;
    bands[1][f] = e1 / HOP;
    bands[2][f] = e2 / HOP;
    loud[f] = Math.sqrt(e / HOP);
  }

  // how suddenly it gets louder, band by band (a drum, a plucked string, a consonant)…
  const rise = new Float32Array(n);
  [1.6, 1, 0.8].forEach((weight, b) => {
    const eb = bands[b];
    let peak = 0;
    for (let f = 0; f < n; f++) if (eb[f] > peak) peak = eb[f];
    if (!(peak > 0)) return;
    const c = 1000 / peak;
    let prev = Math.log1p(c * eb[0]);
    for (let f = 1; f < n; f++) {
      const cur = Math.log1p(c * eb[f]);
      if (cur > prev) rise[f] += weight * (cur - prev);
      prev = cur;
    }
  });
  // …above what is usual just then: where a beat may be
  const usual = smooth(rise, Math.round(fps * 0.5));
  let onset = new Float32Array(n);
  for (let f = 0; f < n; f++) onset[f] = Math.max(0, rise[f] - usual[f]);
  onset = smooth(onset, 1);
  let power = 0;
  for (let f = 0; f < n; f++) power += onset[f] * onset[f];
  const sd = Math.sqrt(power / n);

  const out = { bpm: 0, beats: new Float32Array(0), duration: x.length / rate, ...curves(loud, fps) };
  if (!(sd > 1e-9)) return out; // silence, or one long note: they keep their own time
  for (let f = 0; f < n; f++) onset[f] /= sd;

  // how fast: the lag at which the song agrees with itself best — and at twice that lag too
  // (a beat, not something between beats), favouring a walking pace over a crawl or a sprint
  const lagMin = Math.max(2, Math.floor((fps * 60) / 200));
  const lagMax = Math.min(Math.ceil((fps * 60) / 55), Math.floor(n / 3));
  if (lagMax <= lagMin + 2) return out;
  const agree = new Float32Array(lagMax * 2 + 1);
  for (let lag = lagMin; lag <= lagMax * 2 && lag < n - 1; lag++) {
    let s = 0;
    for (let f = lag; f < n; f++) s += onset[f] * onset[f - lag];
    agree[lag] = s / (n - lag);
  }
  let best = -1;
  let lag0 = 0;
  for (let lag = lagMin; lag <= lagMax; lag++) {
    const bpm = (fps * 60) / lag;
    const liking = Math.exp(-0.5 * Math.pow(Math.log2(bpm / 112) / 0.7, 2));
    const score = (agree[lag] + 0.5 * agree[lag * 2]) * liking;
    if (score > best) {
      best = score;
      lag0 = lag;
    }
  }
  if (!(best > 0)) return out;
  // (between the frames, by the parabola through the neighbours)
  const ya = agree[lag0 - 1] || 0;
  const yb = agree[lag0];
  const yc = agree[lag0 + 1] || 0;
  const bend = ya - 2 * yb + yc;
  const period = lag0 + (bend < 0 ? clamp((0.5 * (ya - yc)) / bend, -0.5, 0.5) : 0);

  // where: the chain of moments about one period apart that takes in the most onsets
  // (D. Ellis, "Beat Tracking by Dynamic Programming")
  const score = new Float32Array(n);
  const back = new Int32Array(n).fill(-1);
  const near = Math.max(1, Math.round(period / 2));
  const far = Math.round(period * 2);
  for (let f = 0; f < n; f++) {
    let top = 0;
    let from = -1;
    for (let p = Math.max(0, f - far); p <= f - near; p++) {
      const off = Math.log((f - p) / period);
      const v = score[p] - 100 * off * off;
      if (v > top) {
        top = v;
        from = p;
      }
    }
    score[f] = onset[f] + top;
    back[f] = from;
  }
  let last = n - 1;
  for (let f = Math.max(0, n - Math.round(period)); f < n; f++) if (score[f] > score[last]) last = f;
  const frames = [];
  for (let f = last; f >= 0; f = back[f]) frames.push(f);
  frames.reverse();
  if (frames.length < 4) return out;
  out.beats = Float32Array.from(frames, (f) => ((f + 0.5) * HOP) / rate);
  const gaps = [];
  for (let i = 1; i < out.beats.length; i++) gaps.push(out.beats[i] - out.beats[i - 1]);
  out.bpm = 60 / (percentile(gaps, 0.5) || (period * HOP) / rate);
  return out;
}

/** How loud each moment is (against the loud parts of the song) and how lively that stretch of it (against the rest). */
function curves(loud, fps) {
  const GROUP = 4;
  const m = Math.floor(loud.length / GROUP);
  const lv = new Float32Array(m);
  for (let i = 0; i < m; i++) {
    let s = 0;
    for (let k = 0; k < GROUP; k++) s += loud[i * GROUP + k];
    lv[i] = s / GROUP;
  }
  const step = GROUP / fps;
  const top = percentile(lv, 0.95) || 1;
  const level = Uint8Array.from(lv, (v) => Math.round(255 * Math.pow(clamp(v / top, 0, 1), 0.8)));
  // over about three seconds, set against the song as a whole: its quiet verses low, its big moments high
  // (a song that is the same all through sits in the middle)
  const avg = smooth(lv, Math.round(1.5 / step));
  const p15 = percentile(avg, 0.15);
  const p50 = percentile(avg, 0.5);
  const p90 = percentile(avg, 0.9);
  const span = Math.max(p90 - p15, 0.3 * p90, 1e-9);
  const energy = Uint8Array.from(avg, (v) => Math.round(255 * clamp(0.55 + (0.9 * (v - p50)) / span, 0, 1)));
  return { step, level, energy };
}
