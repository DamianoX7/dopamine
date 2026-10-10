// Non-destructive mixing: the original stems are never modified. The preview plays them
// through Web Audio with the current settings, and the final render uses exactly the same
// graph offline (faster than real time) to produce the saved WAV.
//
// Timeline: recording time r ∈ [0, duration]. Output τ ∈ [0, trimEnd − trimStart].
//   backing sample at buffer position  backingOffset + trimStart + τ
//   voice   sample at buffer position  trimStart + τ − sync          (sync > 0 = voice later)

import { parseWav, encodeWavFromAudioBuffer } from './wav.js';
import {
  getAudioContextClass, getOfflineContextClass, createLimiter, decodeAudio, decodeToRate,
  makeAudioBuffer, scheduleBuffer, startRendering, limiterLatencyFrames,
} from './graph.js';
import { claimAudioFocus, releaseAudioFocus } from '../core/audioFocus.js';
import { clamp } from '../core/util.js';

export const SYNC_RANGE_MS = 300;
export const VOLUME_MAX = 2;
export const MIN_SELECTION = 0.5;

let playbackCtx = null;
export function getPlaybackContext() {
  if (!playbackCtx || playbackCtx.state === 'closed') {
    const AC = getAudioContextClass();
    playbackCtx = new AC({ latencyHint: 'playback' });
  }
  return playbackCtx;
}

export async function wavBlobToBuffer(blob) {
  const ab = await blob.arrayBuffer();
  const parsed = parseWav(ab);
  if (parsed) return makeAudioBuffer(parsed.channels, parsed.sampleRate);
  return decodeAudio(getPlaybackContext(), ab);
}

/**
 * Load stems for editing/rendering.
 * backingKind: 'recorded' (WAV captured from the tab) | 'uploaded' (the user's file) | 'none'
 */
export async function loadStems({ voiceBlob, backingBlob = null, backingKind = 'none', backingOffset = 0 }) {
  if (!voiceBlob) throw new Error('저장 공간에서 목소리 녹음을 찾을 수 없어요.');
  const voice = await wavBlobToBuffer(voiceBlob);
  let backing = null;
  if (backingBlob && backingKind === 'recorded') backing = await wavBlobToBuffer(backingBlob);
  else if (backingBlob && backingKind === 'uploaded') backing = await decodeToRate(await backingBlob.arrayBuffer(), voice.sampleRate);
  return {
    voice,
    backing,
    backingOffset: backingOffset || 0,
    sampleRate: voice.sampleRate,
    duration: voice.duration,
    dual: !!backing, // false = single microphone recording (speaker mode)
  };
}

export function normalizeSettings(s, stems) {
  const D = stems.duration;
  const minSel = Math.min(MIN_SELECTION, D);
  let trimStart = clamp(Number.isFinite(s.trimStart) ? s.trimStart : 0, 0, Math.max(0, D - minSel));
  let trimEnd = clamp(Number.isFinite(s.trimEnd) && s.trimEnd > 0 ? s.trimEnd : D, trimStart + minSel, D);
  if (trimEnd - trimStart < minSel) { trimStart = Math.max(0, trimEnd - minSel); }
  return {
    trimStart,
    trimEnd,
    voiceSyncOffset: clamp(Math.round(s.voiceSyncOffset || 0), -SYNC_RANGE_MS, SYNC_RANGE_MS),
    backingVolume: clamp(Number.isFinite(s.backingVolume) ? s.backingVolume : 1, 0, VOLUME_MAX),
    voiceVolume: clamp(Number.isFinite(s.voiceVolume) ? s.voiceVolume : 1, 0, VOLUME_MAX),
  };
}

/** Real-time preview of the stems with the current mix settings. */
export class MixPreview {
  constructor(stems, settings) {
    this.stems = stems;
    this.settings = normalizeSettings(settings, stems);
    this.solo = 'mix'; // 'mix' | 'backing' | 'voice'
    this.playing = false;
    this.pos = this.settings.trimStart;
    this.listeners = new Set();
    this.ctx = null;
    this.backingSrc = null;
    this.voiceSrc = null;
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type = 'change') {
    for (const fn of [...this.listeners]) fn(type, this);
  }

  ensureGraph() {
    const ctx = getPlaybackContext();
    if (this.ctx === ctx) return;
    this.ctx = ctx;
    this.out = ctx.createGain();
    this.limiter = createLimiter(ctx);
    this.backingGain = ctx.createGain();
    this.voiceGain = ctx.createGain();
    this.backingGain.connect(this.out);
    this.voiceGain.connect(this.out);
    this.out.connect(this.limiter.input);
    this.limiter.output.connect(ctx.destination);
    this.applyGains(true);
  }

  get position() {
    if (!this.playing) return this.pos;
    return clamp(this.startPos + (this.ctx.currentTime - this.startCtx), this.settings.trimStart, this.settings.trimEnd);
  }

  play(from = null) {
    this.ensureGraph();
    const ctx = this.ctx;
    // Called synchronously from the tap handler, so iOS accepts the resume.
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    claimAudioFocus(this);
    const { trimStart, trimEnd } = this.settings;
    let p = from == null ? this.pos : from;
    if (p < trimStart || p >= trimEnd - 0.05) p = trimStart;
    this.stopSources();
    const when = ctx.currentTime + 0.04;
    this.startCtx = when;
    this.startPos = p;
    this.backingSrc = this.makeBacking(when, p);
    this.voiceSrc = this.makeVoice(when, p);
    this.playing = true;
    clearInterval(this.tick);
    this.tick = setInterval(() => {
      if (this.playing && this.position >= this.settings.trimEnd - 0.01) this.finish();
    }, 80);
    this.emit();
  }

  makeBacking(when, p) {
    if (!this.stems.backing) return null;
    const src = this.ctx.createBufferSource();
    src.buffer = this.stems.backing;
    src.connect(this.backingGain);
    if (!scheduleBuffer(src, when, this.stems.backingOffset + p, this.settings.trimEnd - p)) {
      src.disconnect();
      return null;
    }
    return src;
  }

  makeVoice(when, p) {
    const sync = this.stems.dual ? this.settings.voiceSyncOffset / 1000 : 0;
    const src = this.ctx.createBufferSource();
    src.buffer = this.stems.voice;
    src.connect(this.voiceGain);
    if (!scheduleBuffer(src, when, p - sync, this.settings.trimEnd - p)) {
      src.disconnect();
      return null;
    }
    return src;
  }

  stopSources(at = 0) {
    for (const key of ['backingSrc', 'voiceSrc']) {
      const src = this[key];
      if (!src) continue;
      try { src.stop(at); } catch { /* not started */ }
      if (at) setTimeout(() => src.disconnect(), 300);
      else src.disconnect();
      this[key] = null;
    }
  }

  /** Re-align only the voice after a sync change, keeping the backing playing. */
  restartVoice() {
    if (!this.playing) return;
    const when = this.ctx.currentTime + 0.03;
    const p = this.startPos + (when - this.startCtx);
    const old = this.voiceSrc;
    if (old) {
      try { old.stop(when); } catch { /* ignore */ }
      setTimeout(() => old.disconnect(), 300);
    }
    this.voiceSrc = p < this.settings.trimEnd ? this.makeVoice(when, p) : null;
  }

  finish() {
    this.stopSources();
    this.playing = false;
    clearInterval(this.tick);
    this.pos = this.settings.trimStart;
    releaseAudioFocus(this);
    this.emit('ended');
  }

  pause() {
    if (!this.playing) return;
    this.pos = this.position;
    this.stopSources();
    this.playing = false;
    clearInterval(this.tick);
    releaseAudioFocus(this);
    this.emit();
  }

  toggle() {
    if (this.playing) this.pause();
    else this.play();
  }

  seek(p) {
    const { trimStart, trimEnd } = this.settings;
    const target = clamp(p, trimStart, trimEnd);
    if (this.playing) this.play(target);
    else { this.pos = target; this.emit(); }
  }

  setSettings(patch) {
    const prev = this.settings;
    this.settings = normalizeSettings({ ...prev, ...patch }, this.stems);
    const s = this.settings;
    if (this.ctx) this.applyGains();
    if (this.playing) {
      if (prev.trimStart !== s.trimStart || prev.trimEnd !== s.trimEnd) this.play(this.position);
      else if (prev.voiceSyncOffset !== s.voiceSyncOffset) this.restartVoice();
    } else {
      this.pos = clamp(this.pos, s.trimStart, s.trimEnd);
    }
    this.emit();
  }

  setSolo(mode) {
    this.solo = mode;
    if (this.ctx) this.applyGains();
    this.emit();
  }

  applyGains(immediate = false) {
    const bv = this.solo === 'voice' ? 0 : this.settings.backingVolume;
    const vv = this.solo === 'backing' ? 0 : this.settings.voiceVolume;
    if (immediate) {
      this.backingGain.gain.value = bv;
      this.voiceGain.gain.value = vv;
      return;
    }
    const t = this.ctx.currentTime;
    this.backingGain.gain.setTargetAtTime(bv, t, 0.015);
    this.voiceGain.gain.setTargetAtTime(vv, t, 0.015);
  }

  dispose() {
    this.pause();
    clearInterval(this.tick);
    if (this.ctx) {
      try {
        this.out.disconnect();
        this.limiter.input.disconnect();
        this.limiter.output.disconnect();
        this.backingGain.disconnect();
        this.voiceGain.disconnect();
      } catch { /* ignore */ }
    }
    this.listeners.clear();
    releaseAudioFocus(this);
  }
}

/**
 * Render the final mix offline with exactly the preview's graph (plus 12 ms edge fades).
 * The limiter's look-ahead delay is rendered as extra frames and cut off again, so the
 * output starts exactly at trimStart. Returns the frame range to keep.
 */
export async function renderMix(stems, settings) {
  const s = normalizeSettings(settings, stems);
  const Off = getOfflineContextClass();
  if (!Off) throw new Error('이 브라우저는 오디오를 오프라인으로 만들 수 없어요.');
  const sr = stems.sampleRate;
  const dur = s.trimEnd - s.trimStart;
  const frames = Math.max(1, Math.round(dur * sr));
  const latency = await limiterLatencyFrames(sr);
  const lat = latency / sr;
  const channels = stems.backing && stems.backing.numberOfChannels > 1 ? 2 : 1;
  const ctx = new Off(channels, frames + latency, sr);

  const limiter = createLimiter(ctx);
  const fade = ctx.createGain();
  limiter.output.connect(fade);
  fade.connect(ctx.destination);
  const f = Math.min(0.012, dur / 4);
  fade.gain.setValueAtTime(0, 0);
  fade.gain.setValueAtTime(0, lat);
  fade.gain.linearRampToValueAtTime(1, lat + f);
  fade.gain.setValueAtTime(1, lat + Math.max(f, dur - f));
  fade.gain.linearRampToValueAtTime(0, lat + dur);

  if (stems.backing) {
    const g = ctx.createGain();
    g.gain.value = s.backingVolume;
    g.connect(limiter.input);
    const src = ctx.createBufferSource();
    src.buffer = stems.backing;
    src.connect(g);
    scheduleBuffer(src, 0, stems.backingOffset + s.trimStart, dur);
  }
  const vg = ctx.createGain();
  vg.gain.value = s.voiceVolume;
  vg.connect(limiter.input);
  const vsrc = ctx.createBufferSource();
  vsrc.buffer = stems.voice;
  vsrc.connect(vg);
  const sync = stems.dual ? s.voiceSyncOffset / 1000 : 0;
  scheduleBuffer(vsrc, 0, s.trimStart - sync, dur);

  const rendered = await startRendering(ctx);
  let peak = 0;
  for (let c = 0; c < rendered.numberOfChannels; c++) {
    const d = rendered.getChannelData(c);
    for (let i = latency; i < latency + frames; i++) {
      const v = d[i] < 0 ? -d[i] : d[i];
      if (v > peak) peak = v;
    }
  }
  // Safety: never write clipped samples. Only kicks in if the limiter was overrun.
  const gain = peak > 0.999 ? 0.98 / peak : 1;
  return { buffer: rendered, startFrame: latency, frames, peak, gain, settings: s };
}

export async function renderMixToWav(stems, settings) {
  const { buffer, startFrame, frames, peak, gain, settings: s } = await renderMix(stems, settings);
  const blob = encodeWavFromAudioBuffer(buffer, { gain, startFrame, frameCount: frames });
  return { blob, duration: frames / buffer.sampleRate, channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate, peak, gain, settings: s };
}
