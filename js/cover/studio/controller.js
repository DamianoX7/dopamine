// Studio session controller: one recording session as an explicit state machine.
//
//   idle ─► preparing ─► ready ─► recording ─► stopping ─► processing ─► review ─► editing ─► saving ─► saved
//             ▲  │         │                                              │  ▲        │
//             │  └─────────┘ (back to setup)                              │  └────────┘
//             └──────────────────────── retake (discard take) ◄───────────┘
//
// "idle" only exists while the studio screen is closed: opening it goes straight to GET READY
// (preparing), where the song, the recording mode and the microphone are all set up.
//
// Guards: nothing can start while another transition is running, the source can't change
// while recording, and navigation/unload is blocked while audio is being captured or saved.

import { createStore } from '../core/store.js';
import { getPrefs, setPrefs, getSession, setSession, clearSession } from '../core/prefs.js';
import { addNavigationGuard } from '../core/router.js';
import { putBlob, getBlob } from '../core/db.js';
import { debounce } from '../core/util.js';
import { claimAudioFocus, releaseAudioFocus } from '../core/audioFocus.js';
import { MSG } from '../messages.js';
import { detectCapabilities, probeMixedRecording } from '../audio/capabilities.js';
import { RecordingEngine, listMicrophones, micPermissionState } from '../audio/engine.js';
import { loadStems, renderMixToWav, normalizeSettings } from '../audio/mixer.js';
import { levelVerdict } from '../audio/analysis.js';
import { looksLikeAudioFile } from '../audio/mime.js';
import { parseYouTubeUrl, YouTubePlayer, YT_STATE, youtubeErrorMessage, isEmbedBlocked } from '../youtube.js';
import { saveDraft, getDraft, discardDraft, releaseDraftRecord, createSingle } from '../library.js';

const BUSY = new Set(['recording', 'stopping', 'processing', 'saving']);
const EMPTY_YT = { input: '', videoId: null, url: null, startSeconds: 0, status: 'none', error: null, errorCode: null, title: '', author: '', duration: 0, playerState: -1 };

function initialState(keep = {}) {
  const prefs = getPrefs();
  const session = getSession();
  return {
    state: 'idle',
    step: 'prepare', // prepare | record | review | edit | single | saved
    starting: false,
    caps: detectCapabilities(),
    probe: { status: 'idle' },
    yt: { ...EMPTY_YT, input: session.youtubeUrl || '' },
    mode: null, // 'tab' | 'upload' | 'speaker'
    tabSource: null, // 'this-tab' | 'other-tab' | 'system' once the user picks one (see tabSourceFor)
    listening: prefs.listening === 'speaker' ? 'speaker' : 'headphones',
    mic: { state: 'idle' },
    micDevices: [],
    tab: { state: 'idle' },
    upload: { state: 'idle' },
    previewing: false,
    speakerAck: false,
    headphonesCard: !prefs.headphoneTipDismissed,
    mix: { backingVolume: prefs.backingVolume, voiceVolume: prefs.voiceVolume, syncMs: prefs.syncMs },
    listen: { backingListen: prefs.backingListen, voiceMonitor: false },
    mutedVideo: !!prefs.mutedVideoWithUpload,
    startAt: 0,
    fileStartAt: 0,
    lyrics: session.lyrics || '',
    warnings: [],
    error: null,
    notice: null,
    draft: null,
    savedSingleId: null,
    saveError: null,
    ...keep,
  };
}

export const studio = createStore(initialState());
const get = () => studio.get();
const set = (patch) => studio.set(patch);

let engine = null;
let yt = null;
let ytHost = null;
let watchTimer = null;
let autoStopTimer = null;
let recordingUsesYt = false;
let uploadFile = null;   // File/Blob the user picked (kept in memory for retakes)
let uploadBuffer = null; // decoded AudioBuffer
let uploadBlobId = null; // stored copy (created on the first take that uses it)
let stemsCache = null;

// Something else (mini-player, another preview) wants the speakers → stop the test-listen.
const studioOwner = { pause: () => stopUploadPreview() };

// ------------------------------------------------------------------ guards

addNavigationGuard((next) => {
  const s = get();
  if (next.name === 'studio') return null;
  if (s.state === 'recording') return '스튜디오를 나가기 전에 녹음을 멈춰 주세요.';
  if (BUSY.has(s.state) || s.starting) return '잠시만요 — 녹음을 저장하는 중이에요.';
  return null;
});

window.addEventListener('beforeunload', (e) => {
  const s = get();
  if (BUSY.has(s.state) || s.starting) {
    e.preventDefault();
    e.returnValue = '';
  }
});

studio.subscribe((s) => {
  // Dopamine World hides its tab bar, mini-player and HUD while this class is on.
  document.body.classList.toggle('recording', s.state === 'recording' || s.state === 'stopping' || s.starting);
});

// An AudioContext made outside a tap (the mic reconnecting when the studio opens) starts out
// suspended in some browsers; the first tap or key press anywhere wakes it up.
for (const type of ['click', 'keydown']) {
  window.addEventListener(type, () => {
    if (engine && engine.ctx && engine.ctx.state === 'suspended') engine.primeContext();
  }, { capture: true, passive: true });
}

// ------------------------------------------------------------------ helpers

export const getEngine = () => engine;
export const getYouTube = () => yt;
export const isBusy = () => BUSY.has(get().state) || get().starting;
export const effectiveListening = (s = get()) => (s.mode === 'speaker' ? 'speaker' : s.listening);
const echoCancelFor = (mode, listening) => mode !== 'speaker' && listening === 'speaker';

/**
 * Desktop Audio: where the song plays. The player on this page when a video is loaded in it,
 * otherwise another tab — unless the user chose something that is possible right now.
 */
export function tabSourceFor(s = get()) {
  if (s.tabSource === 'other-tab' || s.tabSource === 'system') return s.tabSource;
  return s.yt.status === 'ready' ? 'this-tab' : 'other-tab';
}

/** Does pressing Record start the player on this page (so the take and the song begin together)? */
export function drivesVideo(s = get()) {
  return s.yt.status === 'ready' && (s.mode === 'speaker' || (s.mode === 'tab' && s.tab.source === 'this-tab'));
}

function addWarning(id, type, text) {
  const s = get();
  if (s.warnings.some((w) => w.id === id)) return;
  set({ warnings: [...s.warnings, { id, type, text }] });
}

function removeWarning(id) {
  const s = get();
  if (s.warnings.some((w) => w.id === id)) set({ warnings: s.warnings.filter((w) => w.id !== id) });
}

function ensureEngine() {
  if (!engine || engine.state === 'disposed' || engine.state === 'done') {
    if (engine) engine.dispose();
    const s = get();
    engine = new RecordingEngine({ mimeType: s.caps.preferredMimeType });
    engine.on(onEngineEvent);
    engine.setMix(s.mix);
    engine.setMonitor({ mode: s.mode, ...s.listen });
    if (uploadBuffer) engine.upload = { buffer: uploadBuffer, name: uploadFile ? uploadFile.name : '반주 파일' };
  }
  return engine;
}

function disposeEngine() {
  if (engine) {
    engine.dispose();
    engine = null;
  }
}

const persistPrefs = debounce((patch) => setPrefs(patch), 400);
const persistSession = debounce((patch) => setSession(patch), 400);
const persistDraftDebounced = debounce(async () => {
  const s = get();
  if (s.draft && (s.state === 'review' || s.state === 'editing')) {
    try { set({ draft: await saveDraft(s.draft) }); } catch (err) { console.warn('[studio] draft save failed', err); }
  }
}, 500);

// ------------------------------------------------------------------ engine events

function onEngineEvent(type, detail) {
  const s = get();
  switch (type) {
    case 'mic-ended':
      if (s.state === 'recording') stopRecording({ code: 'mic-ended', message: MSG.micEnded });
      else set({ mic: { state: 'error', message: '마이크 연결이 끊어졌어요. 다시 허용해 주세요.' } });
      break;
    case 'tab-ended':
      if (s.state === 'recording') stopRecording({ code: 'tab-ended', message: MSG.tabEnded });
      else if (s.tab.state === 'ready') set({ tab: { state: 'ended', message: MSG.tabLost } });
      break;
    case 'context-state':
      if (s.state === 'recording' && detail !== 'running') stopRecording({ code: 'audio-interrupted', message: MSG.audioInterrupted });
      break;
    case 'recorder-error':
      if (s.state === 'recording') stopRecording({ code: 'recorder-error', message: MSG.recordingFailed });
      break;
    case 'max-length':
      if (s.state === 'recording') stopRecording({ code: 'max-length', message: MSG.maxLength });
      break;
    case 'backing-ended':
      if (s.state === 'recording') scheduleAutoStop('반주가 끝나서 녹음을 멈췄어요.');
      break;
    case 'preview-ended':
      if (s.previewing) set({ previewing: false });
      break;
    case 'mic-muted':
      if (s.state === 'recording') addWarning('mic-muted', 'warn', '시스템이 마이크를 음소거했어요 (예: 전화가 왔거나 다른 앱이 오디오를 가져갔어요).');
      break;
    case 'mic-unmuted':
      removeWarning('mic-muted');
      break;
    default:
      break;
  }
}

// ------------------------------------------------------------------ YouTube

function makeYouTube() {
  return new YouTubePlayer({
    onReady: (info) => {
      const s = get();
      set({ yt: { ...s.yt, status: 'ready', error: null, title: info.title, author: info.author, duration: info.duration } });
    },
    onState: (state) => {
      const s = get();
      const patch = { ...s.yt, playerState: state };
      if (yt && (!s.yt.title || !s.yt.duration)) {
        const info = yt.info();
        patch.title = s.yt.title || info.title;
        patch.author = s.yt.author || info.author;
        patch.duration = s.yt.duration || info.duration;
      }
      set({ yt: patch });
      if (s.state === 'recording' && recordingUsesYt) {
        if (state === YT_STATE.PLAYING || state === YT_STATE.BUFFERING) removeWarning('yt-not-started');
        if (state === YT_STATE.ENDED && s.mode !== 'upload') scheduleAutoStop('노래가 끝나서 녹음을 멈췄어요.');
      }
    },
    onError: ({ code }) => {
      const s = get();
      set({ yt: { ...s.yt, status: 'error', error: youtubeErrorMessage(code), errorCode: code } });
    },
  });
}

export function attachYouTubeHost(host) {
  ytHost = host;
  if (!yt) yt = makeYouTube();
  const s = get();
  if (s.yt.videoId && (s.yt.status === 'loading' || s.yt.status === 'ready')) {
    set({ yt: { ...s.yt, status: 'loading', playerState: -1 } });
    yt.load(host, s.yt.videoId, { startSeconds: s.yt.startSeconds });
  }
}

export function detachYouTubeHost() {
  if (yt) yt.destroy();
  yt = null;
  ytHost = null;
}

export function setYouTubeInput(text) {
  const s = get();
  set({ yt: { ...s.yt, input: text, error: s.yt.status === 'invalid' ? null : s.yt.error, status: s.yt.status === 'invalid' ? 'none' : s.yt.status } });
  persistSession({ youtubeUrl: text });
}

export function loadYouTube() {
  const s = get();
  if (BUSY.has(s.state)) return false;
  const parsed = parseYouTubeUrl(s.yt.input);
  if (!parsed) {
    if (yt) yt.destroy();
    set({ yt: { ...EMPTY_YT, input: s.yt.input, status: 'invalid', error: MSG.invalidYouTube } });
    return false;
  }
  persistSession.flush();
  setSession({ youtubeUrl: s.yt.input });
  set({
    yt: { ...EMPTY_YT, input: s.yt.input, videoId: parsed.videoId, url: parsed.url, startSeconds: parsed.startSeconds, status: 'loading' },
    startAt: parsed.startSeconds,
  });
  if (ytHost) {
    if (!yt) yt = makeYouTube();
    yt.load(ytHost, parsed.videoId, { startSeconds: parsed.startSeconds });
  }
  return true;
}

export function clearYouTube() {
  const s = get();
  if (BUSY.has(s.state) || s.starting) return;
  if (yt) yt.destroy();
  persistSession.cancel();
  set({ yt: { ...EMPTY_YT, input: '' }, startAt: 0 });
  setSession({ youtubeUrl: '' });
}

/** A link whose video exists but may not be embedded: it still names the song (opened in another tab). */
export const embedBlocked = (s = get()) => s.yt.status === 'error' && isEmbedBlocked(s.yt.errorCode) && !!s.yt.url;

/** The YouTube page for the current link, at the link's start time. */
export function youtubeWatchUrl(s = get()) {
  if (!s.yt.url) return null;
  return s.yt.startSeconds > 0 ? `${s.yt.url}&t=${Math.floor(s.yt.startSeconds)}s` : s.yt.url;
}

// ------------------------------------------------------------------ prepare

function autoMode(s) {
  // Desktop Chrome/Edge can record what the computer plays (this page, another tab or every
  // app). Everywhere else an uploaded file is the clean option.
  return s.caps.displayAudio === 'likely' ? 'tab' : 'upload';
}

/** The studio screen opened: a closed session starts (and an open one continues) at GET READY. */
export function enterStudio() {
  const s = get();
  if (s.state === 'idle') {
    const keep = s.mode && !(s.mode === 'speaker' && !['ready', 'loading'].includes(s.yt.status));
    set({ state: 'preparing', step: 'prepare', mode: keep ? s.mode : autoMode(s), error: null });
  }
  if (get().state !== 'preparing') return;
  runProbe(); // reports a missing recording feature right away; the real test waits for the mic
  autoRequestMic();
}

async function runProbe() {
  const s = get();
  if (s.probe.status === 'ok' || s.probe.status === 'running') return;
  if (!s.caps.audioContext || !s.caps.mediaStreamDestination || !s.caps.audioWorklet || !s.caps.mediaRecorder) {
    set({ probe: { status: 'fail', message: MSG.unsupportedMethod } });
    return;
  }
  if (!s.caps.preferredMimeType) {
    set({ probe: { status: 'fail', message: MSG.unsupportedFormat } });
    return;
  }
  if (!engine || !engine.ctx) return;
  set({ probe: { status: 'running' } });
  const res = await probeMixedRecording(engine.ctx, s.caps.preferredMimeType);
  if (res.ok) set({ probe: { status: 'ok', mimeType: res.mimeType, size: res.size, decodable: res.decodable } });
  else if (res.reason === 'suspended') set({ probe: { status: 'idle' } });
  else set({ probe: { status: 'fail', reason: res.reason, message: res.reason === 'format' ? MSG.unsupportedFormat : MSG.unsupportedMethod } });
}

async function autoRequestMic() {
  const s = get();
  if (s.mic.state === 'granted' || s.mic.state === 'requesting') return;
  if ((await micPermissionState()) === 'granted') requestMic();
}

export async function requestMic() {
  const s = get();
  if (!['preparing', 'ready'].includes(s.state)) return;
  if (!s.caps.secureContext) { set({ mic: { state: 'unsupported', message: MSG.insecure } }); return; }
  ensureEngine();
  set({ mic: { state: 'requesting' } });
  const res = await engine.requestMic({ listening: effectiveListening(s), mode: s.mode, deviceId: getPrefs().micDeviceId });
  if (!engine || !['preparing', 'ready'].includes(get().state)) return;
  set({ mic: res });
  if (res.state === 'granted') {
    const devices = await listMicrophones();
    set({ micDevices: devices.map((d, i) => ({ id: d.deviceId, label: d.label || `마이크 ${i + 1}` })) });
    if (get().probe.status !== 'ok') runProbe();
  }
}

export function selectMic(deviceId) {
  setPrefs({ micDeviceId: deviceId });
  requestMic();
}

export function selectMode(mode) {
  const s = get();
  if (!['preparing', 'ready'].includes(s.state) || s.mode === mode || s.starting) return;
  if (engine) {
    if (s.mode === 'tab') engine.releaseTab();
    engine.stopPreview();
    engine.setMonitor({ mode });
  }
  const refreshMic = s.mic.state === 'granted'
    && echoCancelFor(s.mode, effectiveListening(s)) !== echoCancelFor(mode, mode === 'speaker' ? 'speaker' : s.listening);
  set({ mode, state: 'preparing', step: 'prepare', tab: s.mode === 'tab' ? { state: 'idle' } : s.tab, previewing: false, error: null });
  if (refreshMic) requestMic();
}

export function setListening(listening) {
  const s = get();
  if (s.listening === listening || !['preparing', 'ready'].includes(s.state)) return;
  setPrefs({ listening });
  const refreshMic = s.mic.state === 'granted' && s.mode !== 'speaker' && echoCancelFor(s.mode, s.listening) !== echoCancelFor(s.mode, listening);
  const listen = listening === 'speaker' ? { ...s.listen, voiceMonitor: false } : s.listen;
  set({ listening, listen });
  if (engine) engine.setMonitor(listen);
  if (refreshMic) requestMic();
}

/** Desktop Audio: choose where the song plays. A different place needs a new share. */
export function setTabSource(source) {
  const s = get();
  if (s.state !== 'preparing' || s.starting || s.tab.state === 'requesting') return;
  if (engine) engine.releaseTab();
  set({ tabSource: source, tab: { state: 'idle' }, error: null });
}

/** Call directly from the tap handler — getDisplayMedia needs the user activation. */
export async function requestTab() {
  const s = get();
  if (!['preparing', 'ready'].includes(s.state) || s.mode !== 'tab') return;
  ensureEngine();
  const source = tabSourceFor(s);
  set({ tab: { state: 'requesting', source } });
  const res = await engine.requestTabAudio({ source });
  if (!engine) return;
  if (get().mode !== 'tab') { // the mode changed while the browser's dialog was open
    engine.releaseTab();
    return;
  }
  // The browser's dialog has the last word on what is shared; keep the choice in step with it.
  set(res.state === 'ready' && res.source !== 'this-tab' ? { tab: res, tabSource: res.source } : { tab: res });
}

export async function uploadBacking(file) {
  const s = get();
  if (!['preparing', 'ready'].includes(s.state) || !file) return;
  if (!looksLikeAudioFile(file)) {
    set({ upload: { state: 'error', name: file.name, message: MSG.notAudio } });
    return;
  }
  ensureEngine();
  engine.stopPreview();
  set({ upload: { state: 'decoding', name: file.name, size: file.size }, previewing: false });
  try {
    const info = await engine.loadUpload(file);
    uploadFile = file;
    uploadBuffer = engine.upload.buffer;
    uploadBlobId = null;
    set({ upload: { state: 'ready', name: file.name, size: file.size, duration: info.duration, channels: info.channels }, fileStartAt: 0 });
  } catch (err) {
    console.warn('[studio] decode failed', err);
    set({ upload: { state: 'error', name: file.name, message: MSG.decodeFailed } });
  }
}

/** Re-load the uploaded track from storage (after a page reload) for a retake. */
async function restoreUpload(blobId, name) {
  const blob = await getBlob(blobId);
  if (!blob) return;
  const file = blob instanceof File ? blob : new File([blob], name || '반주 파일', { type: blob.type });
  ensureEngine();
  set({ upload: { state: 'decoding', name: file.name, size: file.size } });
  try {
    const info = await engine.loadUpload(file);
    uploadFile = file;
    uploadBuffer = engine.upload.buffer;
    uploadBlobId = blobId;
    set({ upload: { state: 'ready', name: file.name, size: file.size, duration: info.duration, channels: info.channels } });
  } catch {
    set({ upload: { state: 'error', name: file.name, message: MSG.decodeFailed } });
  }
}

export function toggleUploadPreview() {
  const s = get();
  if (!engine || s.upload.state !== 'ready' || s.state === 'recording') return;
  if (s.previewing) {
    stopUploadPreview();
    return;
  }
  claimAudioFocus(studioOwner);
  engine.primeContext();
  engine.setMonitor({ mode: 'upload', ...s.listen });
  if (engine.startPreview(s.fileStartAt)) set({ previewing: true });
}

function stopUploadPreview() {
  if (engine) engine.stopPreview();
  if (get().previewing) set({ previewing: false });
}

export function ackSpeaker(v) { set({ speakerAck: !!v }); }

export function dismissHeadphonesCard() {
  setPrefs({ headphoneTipDismissed: true });
  set({ headphonesCard: false });
}

export function readiness(s = get()) {
  const missing = [];
  if (s.probe.status === 'fail') missing.push(s.probe.message);
  if (s.mic.state !== 'granted') missing.push('마이크 허용하기');
  if (s.mode === 'tab' && s.tab.state !== 'ready') missing.push('노래 소리 공유하기');
  if (s.mode === 'upload' && s.upload.state !== 'ready') missing.push('반주 파일 올리기');
  if (s.mode === 'speaker') {
    if (s.yt.status !== 'ready') missing.push('먼저 유튜브 영상 불러오기');
    if (!s.speakerAck) missing.push('스피커 방식 안내 확인하기');
  }
  return { ok: missing.length === 0, missing };
}

export async function continueToRecord() {
  const s = get();
  if (s.state !== 'preparing') return;
  if (get().probe.status !== 'ok') {
    if (engine) engine.primeContext();
    await runProbe();
  }
  const r = readiness(get());
  if (!r.ok) {
    set({ error: r.missing[0] });
    return;
  }
  stopUploadPreview();
  const cur = get();
  engine.setMix(cur.mix);
  engine.setMonitor({ mode: cur.mode, ...cur.listen });
  set({ state: 'ready', step: 'record', error: null });
  claimAudioFocus(studioOwner); // pauses the mini-player
}

export function backToPrepare() {
  const s = get();
  if (s.state !== 'ready' || s.starting) return;
  set({ state: 'preparing', step: 'prepare', error: null });
}

// ------------------------------------------------------------------ record-screen settings

export function setMix(patch) {
  const s = get();
  if (s.state === 'recording' || s.state === 'stopping') return; // locked while recording
  const mix = { ...s.mix, ...patch };
  set({ mix });
  if (engine) engine.setMix(mix);
  persistPrefs({ backingVolume: mix.backingVolume, voiceVolume: mix.voiceVolume, syncMs: mix.syncMs });
}

export function setListen(patch) {
  const s = get();
  const listen = { ...s.listen, ...patch };
  if (effectiveListening(s) === 'speaker') listen.voiceMonitor = false;
  set({ listen });
  if (engine) engine.setMonitor(listen);
  if (patch.backingListen !== undefined) persistPrefs({ backingListen: listen.backingListen });
}

export function setStartAt(sec) {
  if (get().state === 'recording') return;
  set({ startAt: Math.max(0, sec || 0) });
}

export function setFileStartAt(sec) {
  const s = get();
  if (s.state === 'recording') return;
  const max = s.upload.duration ? Math.max(0, s.upload.duration - 1) : 0;
  set({ fileStartAt: Math.min(max, Math.max(0, sec || 0)) });
}

export function setMutedVideo(v) {
  setPrefs({ mutedVideoWithUpload: !!v });
  set({ mutedVideo: !!v });
}

export function setLyrics(text) {
  const s = get();
  set({ lyrics: text, draft: s.draft ? { ...s.draft, lyrics: text } : s.draft });
  persistSession({ lyrics: text });
  if (s.draft) persistDraftDebounced();
}

// ------------------------------------------------------------------ recording

export async function startRecording() {
  const s = get();
  if (s.state !== 'ready' || s.starting) return;
  const r = readiness(s);
  if (!r.ok) {
    set({ error: r.missing[0] });
    return;
  }
  claimAudioFocus(studioOwner);
  set({ starting: true, error: null, warnings: [], notice: null });

  // The player on this page only starts when it is the song being recorded (or a muted
  // lyrics video); a song in another tab or app is started by the singer.
  const useYt = !!(yt && yt.ready && s.yt.status === 'ready' && (drivesVideo(s) || (s.mode === 'upload' && s.mutedVideo)));
  if (useYt) {
    if (s.mode === 'upload') yt.mute();
    else yt.unMute();
    // Reset to the start position. (On a never-played video seekTo would start playback,
    // so in that case the seek happens together with play, right after the recorder starts.)
    const st = yt.getState();
    if (st === YT_STATE.PLAYING || st === YT_STATE.PAUSED || st === YT_STATE.ENDED || st === YT_STATE.BUFFERING) {
      yt.pause();
      yt.seekTo(s.startAt);
    }
  }

  try {
    await ensureEngine().start({
      mode: s.mode,
      startAt: s.fileStartAt,
      onBackingPlay: useYt ? () => { yt.seekTo(s.startAt); yt.play(); } : null,
    });
  } catch (err) {
    console.warn('[studio] start failed', err);
    set({ starting: false, error: err.message || MSG.recordingFailed });
    if (engine && err.code === 'mic') set({ mic: { state: 'error', message: MSG.micLost } });
    if (engine && err.code === 'tab') set({ tab: { state: 'ended', message: MSG.tabLost } });
    return;
  }
  recordingUsesYt = useYt;
  set({ state: 'recording', starting: false });
  startWatch();
}

function startWatch() {
  stopWatch();
  let silentSince = null;
  watchTimer = setInterval(() => {
    const s = get();
    if (s.state !== 'recording' || !engine) return;
    const t = engine.elapsed();
    const lv = engine.getLevels();
    if (s.mode === 'tab') {
      if (lv.backing < 0.002) {
        if (silentSince === null) silentSince = t;
        if (t - silentSince > 5) {
          addWarning('backing-silent', 'warn', s.tab.source === 'this-tab' ? MSG.silentThisTab : s.tab.source === 'system' ? MSG.silentSystem : MSG.silentOtherTab);
        }
      } else {
        silentSince = null;
        removeWarning('backing-silent');
      }
    }
    if (recordingUsesYt && yt && t > 3.5) {
      const st = yt.getState();
      if (st === YT_STATE.UNSTARTED || st === YT_STATE.CUED) addWarning('yt-not-started', 'info', '영상이 아직 시작되지 않았어요. 유튜브 플레이어의 ▶를 눌러 노래를 시작해 주세요.');
      else removeWarning('yt-not-started');
    }
  }, 500);
  document.addEventListener('visibilitychange', onVisibility);
}

function stopWatch() {
  clearInterval(watchTimer);
  watchTimer = null;
  document.removeEventListener('visibilitychange', onVisibility);
}

function onVisibility() {
  const s = get();
  // Mobile browsers suspend background pages, which silently breaks a recording.
  if (document.hidden && s.state === 'recording' && s.caps.isMobile) {
    stopRecording({ code: 'background', message: MSG.backgrounded });
  }
}

function scheduleAutoStop(message) {
  if (autoStopTimer) return;
  addWarning('auto-stop', 'info', '노래가 끝났어요 — 녹음을 멈추는 중…');
  autoStopTimer = setTimeout(() => {
    autoStopTimer = null;
    if (get().state === 'recording') stopRecording({ code: 'song-ended', message, benign: true });
  }, 2000);
}

export async function stopRecording(interruption = null) {
  const s = get();
  if (s.state !== 'recording' || !engine) return;
  clearTimeout(autoStopTimer);
  autoStopTimer = null;
  stopWatch();
  set({ state: 'stopping' });
  let result = null;
  try {
    result = await engine.stop(interruption);
  } catch (err) {
    console.error('[studio] stop failed', err);
  }
  // Stop backing playback (the tracks were already stopped by the engine).
  if (recordingUsesYt && yt) {
    yt.pause();
    if (s.mode === 'upload') yt.unMute();
  }
  recordingUsesYt = false;
  set({ state: 'processing' });

  const failed = (message) => {
    disposeEngine();
    releaseAudioFocus(studioOwner);
    set({ state: 'preparing', step: 'prepare', error: message, mic: { state: 'idle' }, tab: { state: 'idle' }, warnings: [] });
  };
  if (!result || !result.frames) { failed(MSG.recordingFailed); return; }
  if (!result.take || !result.take.size) { failed(`${MSG.recordingFailed} (${MSG.emptyRecording})`); return; }

  try {
    const draft = await persistDraft(result, get());
    disposeEngine();
    releaseAudioFocus(studioOwner);
    set({
      state: 'review',
      step: 'review',
      draft,
      warnings: [],
      mic: { state: 'idle' },
      tab: { state: 'idle' },
      notice: interruption ? { type: interruption.benign ? 'info' : 'warn', text: interruption.message } : null,
    });
  } catch (err) {
    console.error('[studio] saving take failed', err);
    failed(err.message || MSG.storageFull);
  }
}

async function persistDraft(result, s) {
  // One unsaved take at a time: a new recording replaces the previous draft.
  await discardDraft({ keep: uploadBlobId ? [uploadBlobId] : [] });
  const takeId = await putBlob(result.take, { kind: 'take' });
  const voiceStemId = await putBlob(result.voiceWav, { kind: 'stem-voice' });
  let backingStemId = null;
  let backingStemKind = 'none';
  if (result.mode === 'tab' && result.backingWav) {
    backingStemId = await putBlob(result.backingWav, { kind: 'stem-backing' });
    backingStemKind = 'recorded';
  } else if (result.mode === 'upload') {
    if (!uploadBlobId) uploadBlobId = await putBlob(uploadFile, { kind: 'backing-upload' });
    backingStemId = uploadBlobId;
    backingStemKind = 'uploaded';
  }
  // A link that couldn't be embedded still says which song this is (it played in another tab).
  const hasSong = s.yt.status === 'ready' || embedBlocked(s);
  return saveDraft({
    createdAt: Date.now(),
    mode: result.mode,
    tabSource: result.mode === 'tab' ? s.tab.source || null : null,
    listening: effectiveListening(s),
    youtubeUrl: hasSong ? s.yt.url : null,
    youtubeVideoId: hasSong ? s.yt.videoId : null,
    videoTitle: s.yt.title || '',
    videoAuthor: s.yt.author || '',
    lyrics: s.lyrics,
    takeId,
    takeMime: result.takeMime,
    takeSize: result.take.size,
    voiceStemId,
    backingStemId,
    backingStemKind,
    backingOffset: result.backingOffset,
    backingFileName: result.mode === 'upload' ? s.upload.name || null : null,
    sampleRate: result.sampleRate,
    duration: result.duration,
    stats: result.stats,
    voiceVerdict: levelVerdict(result.stats.voice),
    backingVerdict: result.mode === 'speaker' ? null : levelVerdict(result.stats.backing),
    checks: result.checks,
    latencyEstimateMs: result.latencyEstimateMs,
    interruption: result.interruption ? { code: result.interruption.code, message: result.interruption.message } : null,
    settings: {
      voiceSyncOffset: result.mix.syncMs || 0,
      backingVolume: result.mix.backingVolume,
      voiceVolume: result.mix.voiceVolume,
      trimStart: 0,
      trimEnd: result.duration,
    },
    selfCheck: null, // speaker mode: 'both' | 'voice-only'
    incompleteAck: false,
  });
}

// ------------------------------------------------------------------ review / edit / save

/** Is the backing verifiably in the recording? true | false | null (unknown yet) */
export function backingCaptured(draft) {
  if (!draft) return null;
  if (draft.mode === 'speaker') return draft.selfCheck === 'both' ? true : draft.selfCheck === 'voice-only' ? false : null;
  return draft.backingVerdict !== 'silent';
}

/** Problems that need an explicit "save anyway" before this can become a Single. */
export function saveProblems(draft) {
  const out = [];
  if (!draft) return out;
  if (backingCaptured(draft) === false) out.push(MSG.backingMissing);
  if (draft.voiceVerdict === 'silent') out.push(MSG.voiceMissing);
  return out;
}

export function updateDraft(patch, { immediate = false } = {}) {
  const s = get();
  if (!s.draft) return;
  set({ draft: { ...s.draft, ...patch } });
  persistDraftDebounced();
  if (immediate) persistDraftDebounced.flush();
}

export function setDraftSettings(settings) {
  const s = get();
  if (!s.draft) return;
  updateDraft({ settings: { ...s.draft.settings, ...settings } });
}

export function loadDraftStems(draft = get().draft) {
  if (!draft) return Promise.reject(new Error('편집할 녹음이 없어요.'));
  const key = `${draft.voiceStemId}|${draft.backingStemId}|${draft.backingOffset}`;
  if (stemsCache && stemsCache.key === key) return stemsCache.promise;
  const promise = (async () => {
    const [voiceBlob, backingBlob] = await Promise.all([getBlob(draft.voiceStemId), draft.backingStemId ? getBlob(draft.backingStemId) : null]);
    return loadStems({ voiceBlob, backingBlob, backingKind: draft.backingStemKind, backingOffset: draft.backingOffset });
  })();
  stemsCache = { key, promise };
  promise.catch(() => { if (stemsCache && stemsCache.key === key) stemsCache = null; });
  return promise;
}

export function toEdit() {
  const s = get();
  if (s.state !== 'review' && s.state !== 'editing') return;
  set({ state: 'editing', step: 'edit' });
}

export function toSingleForm() {
  const s = get();
  if (s.state !== 'review' && s.state !== 'editing') return;
  set({ state: 'editing', step: 'single', saveError: null });
}

export function backToReview() {
  const s = get();
  if (s.state !== 'editing') return;
  set({ state: 'review', step: 'review' });
}

export function backToEdit() {
  const s = get();
  if (s.state !== 'editing') return;
  set({ step: 'edit' });
}

export async function retake() {
  const s = get();
  if (s.state !== 'review' && s.state !== 'editing') return;
  const draft = s.draft;
  stemsCache = null;
  // Create the new AudioContext inside this tap.
  try { ensureEngine().primeContext(); } catch { /* reported by prepare */ }
  await discardDraft({ keep: uploadBlobId ? [uploadBlobId] : [] });
  set({ state: 'preparing', step: 'prepare', draft: null, notice: null, error: null, warnings: [], mic: { state: 'idle' }, tab: { state: 'idle' }, speakerAck: s.speakerAck });
  if (!uploadBuffer && draft && draft.backingStemKind === 'uploaded' && draft.backingStemId) {
    restoreUpload(draft.backingStemId, draft.backingFileName);
  }
  runProbe();
  autoRequestMic();
}

export async function saveSingle({ meta, artwork }) {
  const s = get();
  const draft = s.draft;
  if (!draft || (s.state !== 'review' && s.state !== 'editing')) return null;
  persistDraftDebounced.cancel();
  set({ state: 'saving', saveError: null });
  try {
    const stems = await loadDraftStems(draft);
    const settings = normalizeSettings(draft.settings, stems);
    const out = await renderMixToWav(stems, settings);
    const audioId = await putBlob(out.blob, { kind: 'final' });
    const artworkId = artwork && artwork.blob ? await putBlob(artwork.blob, { kind: 'artwork' }) : null;
    const single = await createSingle({
      title: meta.title,
      originalArtist: meta.originalArtist,
      coverArtist: meta.coverArtist,
      description: meta.description,
      artworkId,
      artworkDesign: artworkId && artwork.design ? artwork.design : null,
      audioId,
      mimeType: 'audio/wav',
      youtubeUrl: draft.youtubeUrl,
      sourceType: draft.mode,
      duration: out.duration,
      trimStart: settings.trimStart,
      trimEnd: settings.trimEnd,
      voiceSyncOffset: settings.voiceSyncOffset,
      backingVolume: settings.backingVolume,
      voiceVolume: settings.voiceVolume,
      lyrics: get().lyrics,
      // Non-destructive sources so the cover can be re-edited later.
      originalTakeId: draft.takeId,
      originalTakeMimeType: draft.takeMime,
      voiceStemId: draft.voiceStemId,
      backingStemId: draft.backingStemId,
      backingStemKind: draft.backingStemKind,
      backingOffset: draft.backingOffset,
      backingFileName: draft.backingFileName,
      recordingDuration: draft.duration,
      sampleRate: draft.sampleRate,
      channels: out.channels,
      listening: draft.listening,
      backingCaptured: backingCaptured(draft),
      voiceDetected: draft.voiceVerdict !== 'silent',
      stats: draft.stats,
      latencyEstimateMs: draft.latencyEstimateMs,
      exportGain: out.gain,
    });
    await releaseDraftRecord();
    stemsCache = null;
    setPrefs({ coverArtist: meta.coverArtist || getPrefs().coverArtist, syncMs: settings.voiceSyncOffset });
    if (navigator.storage && typeof navigator.storage.persist === 'function') navigator.storage.persist().catch(() => {});
    clearSession();
    set({ state: 'saved', step: 'saved', savedSingleId: single.id, draft: null });
    return single;
  } catch (err) {
    console.error('[studio] save failed', err);
    set({ state: 'editing', saveError: err.message || '싱글을 저장하지 못했어요.' });
    return null;
  }
}

// ------------------------------------------------------------------ session lifecycle

/** Start over. sameSong keeps the YouTube link, lyrics and uploaded track. */
export function newCover({ sameSong = false } = {}) {
  const s = get();
  if (isBusy()) return;
  stemsCache = null;
  disposeEngine();
  stopWatch();
  if (sameSong) {
    set(initialState({
      caps: s.caps, probe: s.probe, yt: s.yt, lyrics: s.lyrics, mode: s.mode, tabSource: s.tabSource,
      upload: uploadBuffer ? s.upload : { state: 'idle' },
      startAt: s.startAt, fileStartAt: s.fileStartAt, speakerAck: s.speakerAck,
    }));
    setSession({ youtubeUrl: s.yt.input, lyrics: s.lyrics });
  } else {
    uploadFile = null;
    uploadBuffer = null;
    uploadBlobId = null;
    if (yt) yt.destroy();
    clearSession();
    set(initialState({ caps: s.caps, probe: s.probe, yt: { ...EMPTY_YT }, lyrics: '' }));
  }
  if (ytHost) enterStudio(); // still on the studio screen: straight back to GET READY
}

export async function resumeDraft() {
  if (isBusy()) return false;
  const draft = await getDraft();
  if (!draft) return false;
  const s = get();
  stemsCache = null;
  disposeEngine();
  const ytState = draft.youtubeVideoId
    ? { ...EMPTY_YT, input: draft.youtubeUrl || '', url: draft.youtubeUrl, videoId: draft.youtubeVideoId, status: 'loading', title: draft.videoTitle || '', author: draft.videoAuthor || '' }
    : s.yt;
  if (draft.backingStemKind !== 'uploaded' || draft.backingStemId !== uploadBlobId) {
    uploadFile = null;
    uploadBuffer = null;
    uploadBlobId = null;
  }
  set(initialState({
    caps: s.caps,
    probe: s.probe,
    state: 'review',
    step: 'review',
    draft,
    mode: draft.mode,
    lyrics: draft.lyrics || '',
    yt: ytState,
    upload: draft.backingStemKind === 'uploaded' ? { state: 'idle', name: draft.backingFileName } : { state: 'idle' },
  }));
  return true;
}

/** Throw away an unsaved take from an earlier session. */
export async function discardSavedDraft() {
  if (isBusy()) return;
  const s = get();
  if (s.state === 'review' || s.state === 'editing') {
    stemsCache = null;
    await discardDraft({ keep: uploadBlobId ? [uploadBlobId] : [] });
    set({ state: 'idle', step: 'prepare', draft: null, notice: null });
    if (ytHost) enterStudio();
  } else {
    await discardDraft({ keep: uploadBlobId ? [uploadBlobId] : [] });
  }
}

/** Studio view unmounted: release devices; keep text, choices and any saved take. */
export function onLeave() {
  const s = get();
  stopUploadPreview();
  if (s.state === 'preparing' || s.state === 'ready') {
    disposeEngine();
    // With a song chosen the setup counts as in progress; otherwise the next visit starts fresh.
    const started = !!s.yt.videoId || s.upload.state === 'ready';
    set({ state: started ? 'preparing' : 'idle', step: 'prepare', mic: { state: 'idle' }, tab: { state: 'idle' }, previewing: false, error: null });
  }
  stemsCache = null;
  detachYouTubeHost();
  releaseAudioFocus(studioOwner);
}
