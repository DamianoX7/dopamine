// What key a song is in, by ear: how much of each of the twelve notes sounds in it (its chroma), held against how much
// of each a major key and a minor key has (Krumhansl and Kessler's profiles) — the best fit of the twenty-four is the
// key. Read off the same thinned-out recording the beat is found in (beat.js), a frame at a time.

// how much each note of the scale belongs, from the keynote up (C major / C minor)
const MAJOR = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR = [6.33, 2.68, 3.52, 5.38, 2.6, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
const N = 4096; //       samples to a frame (a third of a second, at about 11 kHz)
const FRAMES = 160; //   at most this many, spread over the song
const LOW = 65; //       the notes heard, Hz: from C2…
const HIGH = 2000; //    …to well into the singing

/** In place: the spectrum of `re` (`im` zero to begin with). */
function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = (-2 * Math.PI) / len;
    const wr = Math.cos(a);
    const wi = Math.sin(a);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const p = i + k;
        const q = p + len / 2;
        const tr = re[q] * cr - im[q] * ci;
        const ti = re[q] * ci + im[q] * cr;
        re[q] = re[p] - tr;
        im[q] = im[p] - ti;
        re[p] += tr;
        im[p] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
}

/** How well two sets of twelve go together (Pearson's r). */
function fit(a, b) {
  const ma = a.reduce((s, v) => s + v, 0) / 12;
  const mb = b.reduce((s, v) => s + v, 0) / 12;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < 12; i++) {
    num += (a[i] - ma) * (b[i] - mb);
    da += (a[i] - ma) ** 2;
    db += (b[i] - mb) ** 2;
  }
  return da && db ? num / Math.sqrt(da * db) : 0;
}

/**
 * The key of the recording `x` (mono, `rate` samples a second): { tonic (0 = C … 11 = B), mode ('major' or 'minor'),
 * strength (how sure: the fit, 0 … 1) } — or null if there is too little of it, or nothing but silence.
 */
export function keyOf(x, rate) {
  const frames = Math.floor(x.length / N);
  if (frames < 4) return null;
  const every = Math.max(1, Math.floor(frames / FRAMES));
  const win = new Float64Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (N - 1));
  // which note each bin of the spectrum is (C = 0)
  const lo = Math.ceil((LOW * N) / rate);
  const hi = Math.min(N / 2 - 1, Math.floor((HIGH * N) / rate));
  const note = new Int8Array(N / 2);
  for (let k = lo; k <= hi; k++) note[k] = (((Math.round(69 + 12 * Math.log2((k * rate) / N / 440)) % 12) + 12) % 12);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const chroma = new Float64Array(12);
  let heard = 0;
  for (let f = 0; f < frames; f += every) {
    let energy = 0;
    for (let i = 0; i < N; i++) {
      const s = x[f * N + i];
      re[i] = s * win[i];
      im[i] = 0;
      energy += s * s;
    }
    if (energy / N < 1e-6) continue; // (a quiet moment says nothing)
    fft(re, im);
    const frame = new Float64Array(12);
    for (let k = lo; k <= hi; k++) frame[note[k]] += Math.sqrt(re[k] * re[k] + im[k] * im[k]);
    // (each moment counts the same, loud or soft)
    const total = frame.reduce((s, v) => s + v, 0);
    if (!total) continue;
    for (let c = 0; c < 12; c++) chroma[c] += frame[c] / total;
    heard++;
  }
  if (heard < 3) return null;
  let best = null;
  for (let tonic = 0; tonic < 12; tonic++) {
    for (const [mode, profile] of [['major', MAJOR], ['minor', MINOR]]) {
      const r = fit(chroma, Array.from({ length: 12 }, (_, c) => profile[(c - tonic + 12) % 12]));
      if (!best || r > best.r) best = { tonic, mode, r };
    }
  }
  return best.r > 0 ? { tonic: best.tonic, mode: best.mode, strength: Math.round(best.r * 1000) / 1000 } : null;
}
