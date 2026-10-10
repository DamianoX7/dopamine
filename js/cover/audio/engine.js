// RecordingEngine — real audio capture.
//
//   Backing source ──► backingIn ─┬─► analyser (meter)
//   (tab / system capture         ├─► backingMix(gain) ─► backingDelay ─┐
//    or uploaded file)            ├─► monitor(gain) ─► speakers (upload mode only)
//                                 └─► stem worklet input 0              │
//                                                                       ├─► limiter ─► MediaStreamDestination ─► MediaRecorder
//   Microphone ───────► voiceIn ──┬─► analyser (meter)                  │         (the "as recorded" take)
//                                 ├─► voiceMix(gain) ─► voiceDelay ─────┘
//                                 ├─► voiceMonitor(gain, off by default) ─► speakers
//                                 └─► stem worklet input 1
//
// The worklet keeps the raw, sample-aligned stems (voice + backing), which is what makes
// Voice Sync, separate volumes and trim possible afterwards without touching the originals.

import { MSG } from '../messages.js';
import { floatToInt16, pcm16PartsToWav } from './wav.js';
import { withTimeout } from '../core/util.js';
import { getAudioContextClass, createLimiter, decodeAudio, analyserPeak } from './graph.js';

const WORKLET_URL = new URL('./stem-recorder-worklet.js', import.meta.url).href;
export const MAX_RECORDING_SECONDS = 15 * 60;
export const CAPTURE_HANDLE = `cover-studio-${Math.random().toString(36).slice(2, 10)}`;

// Chromium Capture Handle: lets us tell whether the tab the user shared is this one.
let captureHandleSet = false;
try {
  if (navigator.mediaDevices && typeof navigator.mediaDevices.setCaptureHandleConfig === 'function') {
    navigator.mediaDevices.setCaptureHandleConfig({ handle: CAPTURE_HANDLE, exposeOrigin: true, permittedOrigins: [location.origin] });
    captureHandleSet = true;
  }
} catch { /* optional API */ }

const DISPLAY_AUDIO = { echoCancellation: false, noiseSuppression: false, autoGainControl: false, suppressLocalAudioPlayback: false };

/**
 * What the browser is asked to offer for each place the song can play. The video track is
 * only there because browsers don't share audio alone; it is never recorded.
 */
function displayMediaOptions(source) {
  const video = { frameRate: { ideal: 5, max: 15 } };
  const options = { audio: DISPLAY_AUDIO, surfaceSwitching: 'exclude' };
  if (source === 'other-tab') {
    // The picker opens on its tab list, without this tab and without whole screens.
    Object.assign(options, { video: { ...video, displaySurface: 'browser' }, selfBrowserSurface: 'exclude', monitorTypeSurfaces: 'exclude' });
  } else if (source === 'system') {
    // The picker opens on "Entire Screen" with its system-audio switch (off until the user turns it on).
    Object.assign(options, { video: { ...video, displaySurface: 'monitor' }, systemAudio: 'include', windowAudio: 'system', monitorTypeSurfaces: 'include' });
  } else {
    Object.assign(options, { video, preferCurrentTab: true, selfBrowserSurface: 'include' });
  }
  if (source !== 'this-tab' && typeof window.CaptureController === 'function') {
    try {
      // Stay on this page instead of jumping to the tab or window that was just shared.
      const controller = new window.CaptureController();
      controller.setFocusBehavior('no-focus-change');
      options.controller = controller;
    } catch { /* optional API */ }
  }
  return options;
}

export class EngineError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'EngineError';
    this.code = code;
  }
}

function micError(err) {
  const name = err && err.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError' || name === 'SecurityError') {
    return { state: 'denied', message: MSG.micDenied, help: MSG.micDeniedHelp };
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return { state: 'notfound', message: MSG.micNotFound };
  }
  if (name === 'NotReadableError' || name === 'TrackStartError' || name === 'AbortError') {
    return { state: 'unavailable', message: MSG.micBusy };
  }
  if (name === 'TypeError' || name === 'NotSupportedError') return { state: 'unsupported', message: MSG.micUnsupported };
  return { state: 'error', message: MSG.micError, detail: name || String(err) };
}

function tabError(err) {
  const name = err && err.name;
  const text = String((err && err.message) || '');
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    if (/system/i.test(text)) {
      return { state: 'error', message: '운영체제가 이 브라우저의 화면/탭 공유를 막았어요. 시스템 개인정보 보호 설정(화면 기록)에서 허용한 뒤 다시 시도해 주세요.' };
    }
    return { state: 'cancelled', message: MSG.tabCancelled };
  }
  if (name === 'InvalidStateError') return { state: 'error', message: MSG.tabGestureNeeded };
  if (name === 'NotSupportedError' || name === 'TypeError' || name === 'NotFoundError') {
    return { state: 'unsupported', message: MSG.unsupportedMethod };
  }
  return { state: 'error', message: MSG.tabError, detail: name };
}

export class RecordingEngine {
  constructor({ mimeType }) {
    this.mimeType = mimeType;
    this.ctx = null;
    this.state = 'idle'; // idle | recording | stopping | processing | done | disposed
    this.listeners = new Set();
    this.mic = null;     // { stream, track, node, settings }
    this.tab = null;     // { stream, track, video, node }
    this.upload = null;  // { buffer, name }
    this.previewSrc = null;
    this.workletReady = null;
    this.mix = { backingVolume: 1, voiceVolume: 1, syncMs: 0 };
    this.monitorSettings = { mode: null, backingListen: 0.9, voiceMonitor: false };
  }

  on(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  emit(type, detail) {
    for (const fn of [...this.listeners]) {
      try { fn(type, detail); } catch (err) { console.error('[engine] listener failed', err); }
    }
  }

  // ---------------------------------------------------------------- context & graph

  /** Create/resume the AudioContext. Call synchronously inside a user gesture (iOS). */
  primeContext() {
    if (this.state === 'disposed') throw new EngineError('disposed', '녹음 세션이 닫혔어요.');
    if (!this.ctx) {
      const AC = getAudioContextClass();
      if (!AC) throw new EngineError('unsupported', MSG.unsupportedMethod);
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.buildGraph();
      this.ctx.onstatechange = () => this.emit('context-state', this.ctx && this.ctx.state);
    }
    if (this.ctx.state !== 'running') {
      try { this.ctx.resume().catch(() => {}); } catch { /* ignore */ }
    }
    return this.ctx;
  }

  async ensureRunning() {
    this.primeContext();
    if (this.ctx.state !== 'running') {
      try { await withTimeout(this.ctx.resume(), 2000); } catch { /* ignore */ }
    }
    return this.ctx.state === 'running';
  }

  buildGraph() {
    const ctx = this.ctx;
    this.backingIn = ctx.createGain();
    this.voiceIn = ctx.createGain();
    this.backingAnalyser = ctx.createAnalyser();
    this.voiceAnalyser = ctx.createAnalyser();
    this.backingAnalyser.fftSize = 2048;
    this.voiceAnalyser.fftSize = 2048;
    this.levelBuf = new Float32Array(2048);

    this.backingMix = ctx.createGain();
    this.voiceMix = ctx.createGain();
    this.backingDelay = ctx.createDelay(1);
    this.voiceDelay = ctx.createDelay(1);
    this.limiter = createLimiter(ctx);
    this.mixDest = ctx.createMediaStreamDestination();

    this.monitor = ctx.createGain();
    this.monitor.gain.value = 0;
    this.voiceMonitor = ctx.createGain();
    this.voiceMonitor.gain.value = 0;
    // Keeps the worklet pulled on every engine; outputs digital silence.
    this.sink = ctx.createGain();
    this.sink.gain.value = 0;

    this.backingIn.connect(this.backingAnalyser);
    this.voiceIn.connect(this.voiceAnalyser);
    this.backingIn.connect(this.backingMix);
    this.backingMix.connect(this.backingDelay);
    this.backingDelay.connect(this.limiter.input);
    this.voiceIn.connect(this.voiceMix);
    this.voiceMix.connect(this.voiceDelay);
    this.voiceDelay.connect(this.limiter.input);
    this.limiter.output.connect(this.mixDest);
    this.backingIn.connect(this.monitor);
    this.monitor.connect(ctx.destination);
    this.voiceIn.connect(this.voiceMonitor);
    this.voiceMonitor.connect(ctx.destination);
    this.sink.connect(ctx.destination);

    this.applyMix();
    this.applyMonitor();
  }

  loadWorklet() {
    if (!this.ctx.audioWorklet || typeof window.AudioWorkletNode !== 'function') {
      return Promise.reject(new EngineError('unsupported', MSG.unsupportedMethod));
    }
    if (!this.workletReady) {
      this.workletReady = this.ctx.audioWorklet.addModule(WORKLET_URL).catch((err) => {
        this.workletReady = null;
        console.error('[engine] worklet failed to load', err);
        throw new EngineError('worklet', `${MSG.unsupportedMethod} (the audio processor could not be loaded)`);
      });
    }
    return this.workletReady;
  }

  setMix(patch) {
    this.mix = { ...this.mix, ...patch };
    this.applyMix();
  }

  applyMix() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const s = (this.mix.syncMs || 0) / 1000;
    this.backingMix.gain.setTargetAtTime(this.mix.backingVolume, t, 0.01);
    this.voiceMix.gain.setTargetAtTime(this.mix.voiceVolume, t, 0.01);
    // Negative sync = voice earlier = delay the backing instead (a delay can't go negative).
    this.backingDelay.delayTime.setValueAtTime(Math.max(0, -s), t);
    this.voiceDelay.delayTime.setValueAtTime(Math.max(0, s), t);
  }

  /** What the singer hears through this page (only used with an uploaded backing track). */
  setMonitor(patch) {
    this.monitorSettings = { ...this.monitorSettings, ...patch };
    this.applyMonitor();
  }

  applyMonitor() {
    if (!this.ctx) return;
    const { mode, backingListen, voiceMonitor } = this.monitorSettings;
    const t = this.ctx.currentTime;
    this.monitor.gain.setTargetAtTime(mode === 'upload' ? backingListen : 0, t, 0.01);
    this.voiceMonitor.gain.setTargetAtTime(mode === 'upload' && voiceMonitor ? 1 : 0, t, 0.01);
  }

  // ---------------------------------------------------------------- microphone

  async requestMic({ listening = 'headphones', mode = 'upload', deviceId = '' } = {}) {
    if (!window.isSecureContext) return { state: 'unsupported', message: MSG.insecure };
    const md = navigator.mediaDevices;
    if (!md || typeof md.getUserMedia !== 'function') return { state: 'unsupported', message: MSG.micUnsupported };
    this.primeContext();
    this.releaseMic();

    // Singing sounds best with browser voice processing OFF. Echo cancellation only helps
    // when a digital backing is playing out of a speaker (it may remove some bleed).
    // In Speaker + Mic mode it must stay OFF, because the mic is supposed to hear the song.
    const echoCancellation = mode !== 'speaker' && listening === 'speaker';
    const base = { echoCancellation, noiseSuppression: false, autoGainControl: false };
    // Safari (16.4+): ask for a session that plays and records at the same time.
    setAudioSessionType('play-and-record');
    let stream;
    try {
      stream = await md.getUserMedia({ audio: deviceId ? { ...base, deviceId: { exact: deviceId } } : base, video: false });
    } catch (err) {
      if (deviceId && err && (err.name === 'OverconstrainedError' || err.name === 'NotFoundError')) {
        try {
          stream = await md.getUserMedia({ audio: base, video: false });
        } catch (err2) {
          return micError(err2);
        }
      } else {
        return micError(err);
      }
    }
    if (this.state === 'disposed' || !this.ctx) {
      stream.getTracks().forEach((t) => t.stop());
      return { state: 'idle' };
    }
    const track = stream.getAudioTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      return { state: 'notfound', message: MSG.micNotFound };
    }
    const node = this.ctx.createMediaStreamSource(stream);
    node.connect(this.voiceIn);
    const settings = typeof track.getSettings === 'function' ? track.getSettings() : {};
    const onEnded = () => this.emit('mic-ended');
    const onMute = () => this.emit('mic-muted');
    const onUnmute = () => this.emit('mic-unmuted');
    track.addEventListener('ended', onEnded);
    track.addEventListener('mute', onMute);
    track.addEventListener('unmute', onUnmute);
    this.mic = { stream, track, node, settings, off: () => {
      track.removeEventListener('ended', onEnded);
      track.removeEventListener('mute', onMute);
      track.removeEventListener('unmute', onUnmute);
    } };
    return {
      state: 'granted',
      label: track.label || '마이크',
      deviceId: settings.deviceId || '',
      echoCancellation: settings.echoCancellation,
    };
  }

  releaseMic() {
    if (!this.mic) return;
    this.mic.off();
    try { this.mic.node.disconnect(); } catch { /* ignore */ }
    this.mic.stream.getTracks().forEach((t) => t.stop());
    this.mic = null;
  }

  micLive() {
    return !!(this.mic && this.mic.track.readyState === 'live');
  }

  // ---------------------------------------------------------------- tab / system audio

  /**
   * Capture the song's sound where it plays. `source`:
   *   'this-tab'   the player on this page (one-click "Allow … to see this tab?" prompt)
   *   'other-tab'  a different browser tab
   *   'system'     everything the computer plays
   * Must be called directly from a click/tap handler (getDisplayMedia needs user activation).
   * The result's `source` is what really got shared — the user chooses in the browser's dialog.
   */
  async requestTabAudio({ source = 'this-tab' } = {}) {
    const md = navigator.mediaDevices;
    if (!md || typeof md.getDisplayMedia !== 'function') return { state: 'unsupported', message: MSG.tabUnavailable };
    this.releaseTab();
    let pending;
    try {
      // Called before any await so the user activation is still valid.
      pending = md.getDisplayMedia(displayMediaOptions(source));
    } catch (err) {
      return tabError(err);
    }
    this.primeContext();
    let stream;
    try {
      stream = await pending;
    } catch (err) {
      return tabError(err);
    }
    if (this.state === 'disposed' || !this.ctx) {
      stream.getTracks().forEach((t) => t.stop());
      return { state: 'idle' };
    }
    const video = stream.getVideoTracks()[0] || null;
    const surface = video && video.getSettings ? video.getSettings().displaySurface || null : null;
    const audioTracks = stream.getAudioTracks();
    // Never assume the promise resolving means audio was shared.
    if (!audioTracks.length) {
      stream.getTracks().forEach((t) => t.stop());
      const message = surface === 'browser' ? MSG.noAudioTab : surface ? MSG.noAudioSystem : MSG.noAudioTrack;
      return { state: 'no-audio', source, surface, message };
    }
    const track = audioTracks[0];
    // Is the shared tab this one? Only our own tab answers with the capture handle set above.
    let selfCapture = null;
    if (surface === 'browser' && captureHandleSet && typeof video.getCaptureHandle === 'function') {
      try {
        const handle = video.getCaptureHandle();
        selfCapture = !!handle && handle.handle === CAPTURE_HANDLE;
      } catch { /* optional API */ }
    }
    let captured = source;
    if (surface === 'monitor' || surface === 'window') captured = 'system'; // screens and windows only come with system audio
    else if (selfCapture !== null) captured = selfCapture ? 'this-tab' : 'other-tab';
    else if (surface === 'browser' && source === 'system') captured = 'other-tab';
    const node = this.ctx.createMediaStreamSource(new MediaStream([track]));
    node.connect(this.backingIn);
    const onEnded = () => this.emit('tab-ended');
    track.addEventListener('ended', onEnded);
    if (video) video.addEventListener('ended', onEnded);
    this.tab = { stream, track, video, node, off: () => {
      track.removeEventListener('ended', onEnded);
      if (video) video.removeEventListener('ended', onEnded);
    } };
    return { state: 'ready', source: captured, surface, label: track.label || '', selfCapture };
  }

  releaseTab() {
    if (!this.tab) return;
    this.tab.off();
    try { this.tab.node.disconnect(); } catch { /* ignore */ }
    this.tab.stream.getTracks().forEach((t) => t.stop());
    this.tab = null;
  }

  tabLive() {
    return !!(this.tab && this.tab.track.readyState === 'live');
  }

  // ---------------------------------------------------------------- uploaded backing

  async loadUpload(file) {
    this.primeContext();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await decodeAudio(this.ctx, arrayBuffer);
    if (!buffer || !(buffer.duration > 0)) throw new Error('empty');
    this.stopPreview();
    this.upload = { buffer, name: file.name };
    return { duration: buffer.duration, channels: buffer.numberOfChannels, sampleRate: buffer.sampleRate };
  }

  clearUpload() {
    this.stopPreview();
    this.upload = null;
  }

  /** Test-listen to the uploaded track through the monitor path (not recorded). */
  startPreview(startAt = 0) {
    if (!this.upload || this.state === 'recording') return false;
    this.primeContext();
    this.stopPreview();
    const src = this.ctx.createBufferSource();
    src.buffer = this.upload.buffer;
    src.connect(this.backingIn);
    src.onended = () => {
      if (this.previewSrc === src) {
        this.previewSrc = null;
        this.emit('preview-ended');
      }
    };
    src.start(0, Math.min(Math.max(0, startAt), Math.max(0, this.upload.buffer.duration - 0.05)));
    this.previewSrc = src;
    return true;
  }

  stopPreview() {
    const src = this.previewSrc;
    if (!src) return;
    this.previewSrc = null;
    try { src.stop(); } catch { /* ignore */ }
    src.disconnect();
    this.emit('preview-ended');
  }

  // ---------------------------------------------------------------- recording

  /**
   * Start recording. Sequence (as synchronous as the browser allows):
   * mic ready → backing ready → [caller already reset the YouTube position] →
   * mixed stream + stem worklet → MediaRecorder.start() → backing playback → timer.
   */
  async start({ mode, startAt = 0, onBackingPlay = null } = {}) {
    if (this.state === 'recording' || this.state === 'stopping' || this.state === 'processing') {
      throw new EngineError('busy', '이미 녹음하는 중이에요.');
    }
    if (typeof MediaRecorder !== 'function') throw new EngineError('unsupported', MSG.unsupportedMethod);
    if (!this.mimeType) throw new EngineError('format', MSG.unsupportedFormat);
    const running = await this.ensureRunning();
    if (!running) throw new EngineError('suspended', MSG.audioSuspended);
    if (!this.micLive()) throw new EngineError('mic', MSG.micLost);
    if (mode === 'tab' && !this.tabLive()) throw new EngineError('tab', MSG.tabLost);
    if (mode === 'upload' && !this.upload) throw new EngineError('upload', '먼저 반주 파일을 올려 주세요.');
    await this.loadWorklet();
    this.stopPreview();
    this.mode = mode;
    this.setMonitor({ mode });
    const ctx = this.ctx;

    const worklet = new AudioWorkletNode(ctx, 'stem-recorder', {
      numberOfInputs: 2,
      numberOfOutputs: 1,
      outputChannelCount: [1],
      channelCount: 2,
      channelCountMode: 'explicit',
      channelInterpretation: 'speakers',
      processorOptions: { keepBacking: mode === 'tab', chunkFrames: 8192 },
    });
    this.stem = { voice: [], backing: [], frames: 0, vPeak: 0, vSum: 0, bPeak: 0, bSum: 0 };
    this.workletDone = null;
    worklet.port.onmessage = (e) => this.onWorkletMessage(e.data);
    this.backingIn.connect(worklet, 0, 0);
    this.voiceIn.connect(worklet, 0, 1);
    worklet.connect(this.sink);
    this.worklet = worklet;

    let recorder;
    try {
      recorder = new MediaRecorder(this.mixDest.stream, { mimeType: this.mimeType, audioBitsPerSecond: 160000 });
    } catch {
      try {
        recorder = new MediaRecorder(this.mixDest.stream, { mimeType: this.mimeType });
      } catch {
        this.disposeWorklet();
        throw new EngineError('format', MSG.unsupportedFormat);
      }
    }
    this.recChunks = [];
    recorder.ondataavailable = (e) => { if (e.data && e.data.size > 0) this.recChunks.push(e.data); };
    recorder.onerror = (e) => {
      console.error('[engine] MediaRecorder error', e && (e.error || e));
      this.emit('recorder-error', e && e.error);
    };

    let src = null;
    if (mode === 'upload') {
      src = ctx.createBufferSource();
      src.buffer = this.upload.buffer;
      src.connect(this.backingIn);
      src.onended = () => {
        if (this.recordSource === src && this.state === 'recording') this.emit('backing-ended');
      };
    }

    this.checks = {
      micTrack: this.micLive(),
      backingTrack: mode === 'tab' ? this.tabLive() : mode === 'upload' ? !!this.upload : null,
      mixedStream: this.mixDest.stream.getAudioTracks().some((t) => t.readyState === 'live'),
    };

    const lead = 0.12;
    const startFrame = Math.ceil((ctx.currentTime + lead) * ctx.sampleRate);
    const startTime = startFrame / ctx.sampleRate;
    worklet.port.postMessage({ type: 'start', frame: startFrame });
    try {
      recorder.start(1000);
    } catch (err) {
      console.error('[engine] MediaRecorder.start failed', err);
      if (src) src.disconnect();
      this.disposeWorklet();
      throw new EngineError('failed', MSG.recordingFailed);
    }
    this.backingOffset = 0;
    if (src) {
      const offset = Math.min(Math.max(0, startAt), Math.max(0, this.upload.buffer.duration - 0.05));
      src.start(startTime, offset);
      this.backingOffset = offset;
    }
    this.recorder = recorder;
    this.recordSource = src;
    this.startTime = startTime;
    this.startFrame = startFrame;
    this.interruption = null;
    this.state = 'recording';
    this.maxTimer = setTimeout(() => this.emit('max-length'), (MAX_RECORDING_SECONDS + lead) * 1000);
    if (onBackingPlay) {
      try { onBackingPlay(); } catch (err) { console.warn('[engine] backing start callback failed', err); }
    }
  }

  onWorkletMessage(msg) {
    if (!msg || !this.stem) return;
    if (msg.type === 'chunk') {
      const s = this.stem;
      const n = msg.frames;
      s.voice.push(floatToInt16(msg.voice, new Int16Array(n)));
      if (msg.backL) {
        const inter = new Int16Array(n * 2);
        floatToInt16(msg.backL, inter, 0, 2);
        floatToInt16(msg.backR, inter, 1, 2);
        s.backing.push(inter);
      }
      s.frames += n;
      if (msg.vPeak > s.vPeak) s.vPeak = msg.vPeak;
      if (msg.bPeak > s.bPeak) s.bPeak = msg.bPeak;
      s.vSum += msg.vSum;
      s.bSum += msg.bSum;
    } else if (msg.type === 'done') {
      if (this.workletDone) this.workletDone(msg.totalFrames);
    }
  }

  elapsed() {
    if (this.state !== 'recording' || !this.ctx) return 0;
    return Math.max(0, this.ctx.currentTime - this.startTime);
  }

  getLevels() {
    if (!this.ctx) return { backing: 0, voice: 0 };
    return {
      backing: analyserPeak(this.backingAnalyser, this.levelBuf),
      voice: analyserPeak(this.voiceAnalyser, this.levelBuf),
    };
  }

  /** Rough device round-trip latency (output + input), if the browser reports it. */
  estimateLatencyMs() {
    if (!this.ctx) return null;
    const out = (this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0);
    const input = (this.mic && this.mic.settings && this.mic.settings.latency) || 0;
    const total = out + input;
    return total > 0.003 ? Math.round(total * 1000) : null;
  }

  /**
   * Stop: MediaRecorder + worklet stop → mic tracks → display tracks → backing playback.
   * Resolves with the assembled result (take Blob + stems + stats).
   */
  async stop(interruption = null) {
    if (this.state !== 'recording') return null;
    this.state = 'stopping';
    this.interruption = interruption;
    clearTimeout(this.maxTimer);
    const ctx = this.ctx;
    const recorder = this.recorder;

    const workletDone = new Promise((resolve) => { this.workletDone = resolve; });
    const stopFrame = Math.max(this.startFrame, Math.floor(ctx.currentTime * ctx.sampleRate));
    this.worklet.port.postMessage({ type: 'stop', frame: stopFrame });
    const recorderStopped = recorder.state === 'inactive'
      ? Promise.resolve()
      : new Promise((resolve) => recorder.addEventListener('stop', resolve, { once: true }));
    try { if (recorder.state !== 'inactive') recorder.stop(); } catch (err) { console.warn('[engine] recorder.stop', err); }
    // If the audio thread was interrupted the worklet can't answer; keep what we have.
    await Promise.all([withTimeout(workletDone, 2500), withTimeout(recorderStopped, 4000)]);

    this.releaseMic();
    this.releaseTab();
    if (this.recordSource) {
      try { this.recordSource.stop(); } catch { /* ignore */ }
      this.recordSource.disconnect();
      this.recordSource = null;
    }
    this.state = 'processing';
    const result = this.assemble();
    this.disposeWorklet();
    this.state = 'done';
    return result;
  }

  assemble() {
    const ctx = this.ctx;
    const sr = ctx.sampleRate;
    const s = this.stem;
    const mime = (this.recorder && this.recorder.mimeType) || this.mimeType;
    const take = new Blob(this.recChunks || [], { type: mime });
    const frames = s.frames;
    return {
      mode: this.mode,
      sampleRate: sr,
      frames,
      duration: frames / sr,
      take,
      takeMime: mime,
      voiceWav: pcm16PartsToWav(s.voice, 1, sr),
      backingWav: this.mode === 'tab' ? pcm16PartsToWav(s.backing, 2, sr) : null,
      backingOffset: this.backingOffset,
      stats: {
        voice: { peak: s.vPeak, rms: frames ? Math.sqrt(s.vSum / frames) : 0 },
        backing: { peak: s.bPeak, rms: frames ? Math.sqrt(s.bSum / frames) : 0 },
      },
      checks: { ...this.checks, recordedBlob: take.size > 0 },
      latencyEstimateMs: this.estimateLatencyMs(),
      interruption: this.interruption,
      mix: { ...this.mix },
    };
  }

  disposeWorklet() {
    if (!this.worklet) return;
    try { this.backingIn.disconnect(this.worklet); } catch { /* ignore */ }
    try { this.voiceIn.disconnect(this.worklet); } catch { /* ignore */ }
    try { this.worklet.disconnect(); } catch { /* ignore */ }
    this.worklet.port.onmessage = null;
    this.worklet = null;
  }

  /** Release every device and close the AudioContext. */
  dispose() {
    if (this.state === 'disposed') return;
    clearTimeout(this.maxTimer);
    this.stopPreview();
    if (this.recorder && this.recorder.state !== 'inactive') {
      try { this.recorder.stop(); } catch { /* ignore */ }
    }
    if (this.recordSource) {
      try { this.recordSource.stop(); } catch { /* ignore */ }
      this.recordSource = null;
    }
    this.releaseMic();
    this.releaseTab();
    this.disposeWorklet();
    if (this.mixDest) this.mixDest.stream.getTracks().forEach((t) => t.stop());
    if (this.ctx) {
      this.ctx.onstatechange = null;
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
    this.stem = null;
    this.recChunks = null;
    this.upload = null;
    this.state = 'disposed';
    this.listeners.clear();
    setAudioSessionType('auto');
  }
}

function setAudioSessionType(type) {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== type) navigator.audioSession.type = type;
  } catch { /* optional API */ }
}

export async function listMicrophones() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((d) => d.kind === 'audioinput' && d.deviceId);
  } catch {
    return [];
  }
}

export async function micPermissionState() {
  try {
    if (!navigator.permissions || !navigator.permissions.query) return 'unknown';
    const status = await navigator.permissions.query({ name: 'microphone' });
    return status.state; // 'granted' | 'denied' | 'prompt'
  } catch {
    return 'unknown';
  }
}
