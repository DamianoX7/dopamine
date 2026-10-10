// Step 3 — the recording screen: player + lyrics, live meters, mix controls, RECORD.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatTime, parseTimeInput } from '../core/util.js';
import { MSG } from '../messages.js';
import { SYNC_RANGE_MS } from '../audio/mixer.js';
import { button, notice, spinner, SOURCE_INFO } from '../ui/common.js';
import { createMeter } from '../ui/meter.js';
import { createSlider } from '../ui/slider.js';
import { createLyricsPanel } from '../ui/lyrics.js';
import * as C from './controller.js';

const pctFormat = (v) => `${Math.round(v)}%`;
const msFormat = (v) => (v === 0 ? '0 ms' : `${v > 0 ? '+' : '−'}${Math.abs(v)} ms`);

export function createRecordStep(s0) {
  const mode = s0.mode;
  const speaker = mode === 'speaker';
  // Will pressing Record also start the embedded YouTube player?
  const hasVideo = s0.yt.status === 'ready';
  const drivesVideo = C.drivesVideo(s0);
  const lyrics = createLyricsPanel({ value: s0.lyrics, onInput: (v) => C.setLyrics(v) });

  // ---------------------------------------------------------------- status + record button
  const modePill = h('span', { class: `mode-pill${speaker ? ' is-warn' : ''}` },
    speaker ? '⚠ ' : '● ', SOURCE_INFO[mode] ? SOURCE_INFO[mode].long : '');
  const listenChip = h('span', { class: 'chip-small' });
  const timer = h('div', { class: 'rec-timer', role: 'timer', 'aria-label': '녹음 시간' }, '0:00.0');
  const recLabel = h('span', { class: 'rec-label' }, 'REC');
  const recBtn = h('button', { class: 'rec-btn', type: 'button', 'aria-label': '녹음 시작' }, h('span', { class: 'rec-inner' }));
  const recHint = h('div', { class: 'rec-hint', 'aria-live': 'polite' });
  const warnBox = h('div', { class: 'rec-warnings', 'aria-live': 'polite' });
  const onRecClick = () => {
    const s = C.studio.get();
    if (s.state === 'ready' && !s.starting) C.startRecording();
    else if (s.state === 'recording') C.stopRecording();
  };
  recBtn.addEventListener('click', onRecClick);

  // Phones: when the big button is scrolled away (reading lyrics), a compact dock keeps
  // Record/Stop and the timer within thumb reach.
  const dockTimer = h('span', { class: 'dock-timer' }, '0:00.0');
  const dockLabel = h('span', { class: 'dock-label' }, '준비됨');
  const dockBtn = h('button', { class: 'rec-btn rec-btn-sm', type: 'button', 'aria-label': '녹음 시작' }, h('span', { class: 'rec-inner' }));
  dockBtn.addEventListener('click', onRecClick);
  const dock = h('div', { class: 'rec-dock', hidden: true }, h('div', { class: 'dock-text' }, dockLabel, dockTimer), dockBtn);
  let io = null;
  if (typeof IntersectionObserver === 'function') {
    io = new IntersectionObserver(([entry]) => { dock.hidden = entry.isIntersecting; }, { threshold: 0.4 });
    io.observe(recBtn);
  }

  const meterBacking = speaker ? null : createMeter({ label: '반주', emoji: '🎵' });
  const meterVoice = createMeter({ label: speaker ? '마이크' : '목소리', emoji: '🎤' });

  // ---------------------------------------------------------------- mix controls (locked while recording)
  const backingSlider = speaker ? null : createSlider({
    label: '반주', emoji: '🎵', min: 0, max: 200, step: 5, nudge: 5,
    value: Math.round(s0.mix.backingVolume * 100), format: pctFormat,
    onInput: (v) => C.setMix({ backingVolume: v / 100 }),
  });
  const voiceSlider = createSlider({
    label: speaker ? '마이크 레벨' : '목소리', emoji: speaker ? '🎚' : '🎤', min: 0, max: 200, step: 5, nudge: 5,
    value: Math.round(s0.mix.voiceVolume * 100), format: pctFormat,
    onInput: (v) => C.setMix({ voiceVolume: v / 100 }),
  });
  const syncSlider = speaker ? null : createSlider({
    label: '싱크', emoji: '⏱', min: -SYNC_RANGE_MS, max: SYNC_RANGE_MS, step: 10, nudge: 10, centered: true,
    value: s0.mix.syncMs, format: msFormat,
    hint: '이 녹음에서 목소리를 반주에 맞춰 앞뒤로 옮겨요. 녹음한 뒤에 더 세밀하게 맞출 수 있어요.',
    onInput: (v) => C.setMix({ syncMs: v }),
  });

  // What you hear (upload mode only — can change during recording, never affects the take)
  let listenSlider = null;
  if (mode === 'upload') {
    listenSlider = createSlider({
      label: '귀로 듣는 반주', emoji: '🎧', min: 0, max: 100, step: 5,
      value: Math.round(s0.listen.backingListen * 100), format: (v) => `${v}%`,
      onInput: (v) => C.setListen({ backingListen: v / 100 }),
    });
  }

  // Start position
  const startInput = h('input', { class: 'input input-time', type: 'text', inputMode: 'decimal', autocomplete: 'off', 'aria-label': '시작 위치 (분:초)' });
  const commitStart = () => {
    const v = parseTimeInput(startInput.value);
    if (v === null) { paintStart(C.studio.get()); return; }
    if (mode === 'upload') C.setFileStartAt(v);
    else C.setStartAt(v);
    paintStart(C.studio.get());
  };
  startInput.addEventListener('change', commitStart);
  startInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); startInput.blur(); } });
  const useVideoPos = mode === 'upload' || !hasVideo ? null : button('영상 위치 쓰기', {
    size: 'sm', variant: 'soft', icon: 'clock',
    onClick: () => {
      const yt = C.getYouTube();
      if (yt && yt.ready) C.setStartAt(Math.floor(yt.getCurrentTime()));
      paintStart(C.studio.get());
    },
  });
  const startFromZero = button('처음부터', {
    size: 'sm', variant: 'ghost',
    onClick: () => { if (mode === 'upload') C.setFileStartAt(0); else C.setStartAt(0); paintStart(C.studio.get()); },
  });
  function paintStart(s) {
    if (document.activeElement === startInput) return;
    startInput.value = formatTime(mode === 'upload' ? s.fileStartAt : s.startAt);
  }

  let mutedVideoBox = null;
  if (mode === 'upload' && s0.yt.status === 'ready') {
    mutedVideoBox = h('input', { type: 'checkbox', checked: s0.mutedVideo });
    mutedVideoBox.addEventListener('change', () => C.setMutedVideo(mutedVideoBox.checked));
  }

  const backBtn = button('준비 단계로', { variant: 'ghost', icon: 'back', onClick: () => C.backToPrepare() });

  const controlsCard = h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, icon('sliders'), '녹음 믹스'),
    speaker
      ? notice('warn', MSG.speakerShort)
      : null,
    backingSlider ? backingSlider.el : null,
    voiceSlider.el,
    syncSlider ? syncSlider.el : null,
    speaker ? h('p', { class: 'small muted' }, '스피커 + 마이크 방식에서는 노래와 목소리가 같은 마이크로 들어와서 따로 음량이나 싱크를 맞출 수 없어요.') : null,
  );

  const listenCard = mode === 'upload' ? h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, icon('headphones'), '내가 듣는 소리'),
    listenSlider.el,
    mutedVideoBox ? h('label', { class: 'check' }, mutedVideoBox, '유튜브 영상도 소리 없이 함께 재생 (화면 가사용). 화면만 보여 주는 거라 파일과 딱 맞지 않을 수 있어요.') : null,
  ) : null;

  // The start position only matters when we control playback (uploaded file or embedded video).
  const startCard = mode === 'upload' || drivesVideo ? h('section', { class: 'card' },
    h('h2', { class: 'card-title' }, icon('clock'), mode === 'upload' ? '반주 시작 위치' : '노래 시작 위치'),
    h('div', { class: 'row-wrap' }, startInput, useVideoPos, startFromZero),
    drivesVideo ? h('p', { class: 'small muted' }, '팁: 녹음하기 전에 영상을 한 번 재생해 두면 광고가 미리 지나가요.') : null,
  ) : null;

  const recCard = h('section', { class: 'card rec-card' },
    h('div', { class: 'rec-status-row' }, modePill, listenChip),
    h('div', { class: 'rec-center' },
      h('div', { class: 'rec-timer-row' }, recLabel, timer),
      recBtn,
      recHint),
    h('div', { class: 'meter-block' }, meterBacking ? meterBacking.el : null, meterVoice.el),
    warnBox,
  );

  const el = h('div', { class: 'step step-record' }, recCard, controlsCard, listenCard, startCard, h('div', { class: 'step-actions' }, backBtn), dock);

  // ---------------------------------------------------------------- updates
  let prevState = null;
  let lastWarnSig = '';
  function update(s) {
    const recording = s.state === 'recording';
    const busy = s.starting || s.state === 'stopping' || s.state === 'processing';
    const locked = recording || busy;
    const ready = C.readiness(s).ok;

    for (const b of [recBtn, dockBtn]) {
      b.classList.toggle('is-recording', recording);
      b.classList.toggle('is-busy', busy);
      b.disabled = busy || (!recording && (s.state !== 'ready' || !ready));
      b.setAttribute('aria-label', recording ? '녹음 멈춤' : '녹음 시작');
    }
    dock.classList.toggle('is-live', recording);
    dockLabel.textContent = recording ? '녹음 중' : busy ? '저장 중…' : '준비됨';
    recCard.classList.toggle('is-live', recording);
    el.classList.toggle('is-locked', locked);

    if (s.starting) recHint.replaceChildren(spinner('시작하는 중…'));
    else if (s.state === 'stopping' || s.state === 'processing') recHint.replaceChildren(spinner('녹음을 저장하는 중…'));
    else if (recording) recHint.textContent = '눌러서 멈추기';
    else if (mode === 'upload') recHint.textContent = '눌러서 녹음 — 반주가 바로 시작돼요';
    else if (drivesVideo) recHint.textContent = '눌러서 녹음 — 영상이 자동으로 시작돼요';
    else if (mode === 'tab' && s.tab.source === 'other-tab') recHint.textContent = '눌러서 녹음한 다음, 공유한 탭에서 노래를 시작하세요';
    else recHint.textContent = '눌러서 녹음한 다음, 노래를 시작하세요';

    listenChip.textContent = C.effectiveListening(s) === 'speaker' ? '🔈 스피커' : '🎧 헤드폰';

    for (const sl of [backingSlider, voiceSlider, syncSlider]) if (sl) sl.setDisabled(locked);
    startInput.disabled = locked;
    if (useVideoPos) useVideoPos.disabled = locked;
    startFromZero.disabled = locked;
    backBtn.disabled = locked;
    if (mutedVideoBox) mutedVideoBox.disabled = locked;
    paintStart(s);

    // Lyrics switch to read mode while recording (no phone keyboard popping up).
    if (prevState !== s.state) {
      if (s.state === 'recording') lyrics.setLocked(true);
      else if (prevState === 'recording' || prevState === null) lyrics.setLocked(false);
      prevState = s.state;
    }

    const warnSig = JSON.stringify([s.warnings, s.error, speaker]);
    if (warnSig !== lastWarnSig) {
      lastWarnSig = warnSig;
      const items = s.warnings.map((w) => notice(w.type, w.text));
      if (s.error) items.push(notice('error', s.error));
      warnBox.replaceChildren(...items);
    }
  }

  let raf = 0;
  const loop = () => {
    const eng = C.getEngine();
    const s = C.studio.get();
    if (eng && eng.ctx && eng.state !== 'disposed') {
      const lv = eng.getLevels();
      if (meterBacking) meterBacking.set(lv.backing);
      meterVoice.set(lv.voice);
      const level = String(Math.min(1, lv.voice * 2.5));
      recBtn.style.setProperty('--level', level);
      dockBtn.style.setProperty('--level', level);
      if (s.state === 'recording') timer.textContent = formatTime(eng.elapsed(), { tenths: true });
    }
    if (s.state === 'ready' && !s.starting) timer.textContent = '0:00.0';
    if (!dock.hidden) dockTimer.textContent = timer.textContent;
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  update(s0);
  return {
    el,
    side: lyrics.el,
    update,
    destroy() {
      cancelAnimationFrame(raf);
      if (io) io.disconnect();
    },
  };
}
