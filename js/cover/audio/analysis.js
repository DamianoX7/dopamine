// Real signal analysis on recorded data: levels, silence checks, waveform peaks, auto-trim.

// Peak thresholds (linear). −48 dBFS ≈ digital silence / noise floor; −30 dBFS ≈ clearly audible.
export const SILENT_PEAK = 0.004;
export const QUIET_PEAK = 0.03;

/** 'silent' | 'quiet' | 'ok' from { peak, rms }. */
export function levelVerdict(stats) {
  if (!stats || !(stats.peak > SILENT_PEAK)) return 'silent';
  if (stats.peak < QUIET_PEAK) return 'quiet';
  return 'ok';
}

/** Max-abs peaks of `buffer` between startSec and startSec+durSec, in `bins` columns. */
export function computePeaks(buffer, bins, startSec = 0, durSec = null) {
  const out = new Float32Array(bins);
  if (!buffer || bins <= 0) return out;
  const sr = buffer.sampleRate;
  const total = durSec == null ? buffer.duration - startSec : durSec;
  if (total <= 0) return out;
  const startFrame = Math.round(startSec * sr);
  const perBin = (total * sr) / bins;
  for (let c = 0; c < buffer.numberOfChannels; c++) {
    const d = buffer.getChannelData(c);
    for (let b = 0; b < bins; b++) {
      let s = startFrame + Math.floor(b * perBin);
      let e = startFrame + Math.floor((b + 1) * perBin);
      if (e <= 0 || s >= d.length) continue;
      if (s < 0) s = 0;
      if (e > d.length) e = d.length;
      // Stride inside very wide bins: still exact enough for display and keeps it fast.
      const step = e - s > 4096 ? 2 : 1;
      let m = out[b];
      for (let i = s; i < e; i += step) {
        const v = d[i] < 0 ? -d[i] : d[i];
        if (v > m) m = v;
      }
      out[b] = m;
    }
  }
  return out;
}

/**
 * Suggest trim points where the mix actually has sound.
 * peaks: arrays of equal length covering [0, duration]; gains: matching volume multipliers.
 */
export function suggestTrim(peakSets, gains, duration, { threshold = 0.012, padStart = 0.15, padEnd = 0.4 } = {}) {
  const bins = peakSets[0] ? peakSets[0].length : 0;
  if (!bins || !(duration > 0)) return null;
  const level = (b) => {
    let m = 0;
    peakSets.forEach((p, i) => { if (p) m = Math.max(m, p[b] * (gains[i] ?? 1)); });
    return m;
  };
  let first = -1;
  let last = -1;
  for (let b = 0; b < bins; b++) if (level(b) > threshold) { first = b; break; }
  for (let b = bins - 1; b >= 0; b--) if (level(b) > threshold) { last = b; break; }
  if (first < 0) return null;
  const binDur = duration / bins;
  const start = Math.max(0, first * binDur - padStart);
  const end = Math.min(duration, (last + 1) * binDur + padEnd);
  if (end - start < 0.5) return null;
  return { trimStart: start, trimEnd: end };
}
