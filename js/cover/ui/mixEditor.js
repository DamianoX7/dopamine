// Mix & trim editor over the real stems: Voice Sync, Backing/Voice volume, trim, solo.
// Every control changes the actual audio graph (preview) and the same settings are used
// for the offline render when saving.

import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatTime, debounce } from '../core/util.js';
import { MixPreview, SYNC_RANGE_MS, MIN_SELECTION } from '../audio/mixer.js';
import { computePeaks, suggestTrim } from '../audio/analysis.js';
import { createTrimWaveform } from './waveform.js';
import { createSlider } from './slider.js';
import { button, iconButton, segmented, notice } from './common.js';

const pctFormat = (v) => `${Math.round(v)}%`;
const msFormat = (v) => (v === 0 ? '0 ms' : `${v > 0 ? '+' : '−'}${Math.abs(v)} ms`);

export function createMixEditor({ stems, settings, sourceType = 'tab', latencyEstimateMs = null, onChange = null }) {
  const preview = new MixPreview(stems, settings);
  const dual = stems.dual;
  const D = stems.duration;

  const bins = 1400;
  const voicePeaks = computePeaks(stems.voice, bins, 0, D);
  const backingPeaks = dual ? computePeaks(stems.backing, bins, stems.backingOffset, D) : null;

  const emit = () => { if (onChange) onChange({ ...preview.settings }); };

  // ---------------------------------------------------------------- waveform + transport
  const wave = createTrimWaveform({
    duration: D,
    backingPeaks,
    voicePeaks,
    settings: preview.settings,
    dual,
    onInput: (trim) => paintTrim(trim),
    onCommit: (trim) => { preview.setSettings(trim); emit(); },
    onSeek: (t) => preview.seek(t),
  });

  const playIcon = h('span', { class: 'play-icon' }, icon('play', { size: 26 }));
  const playBtn = h('button', { class: 'btn primary round', type: 'button', 'aria-label': '선택 구간 재생' }, playIcon);
  playBtn.addEventListener('click', () => preview.toggle());
  const restartBtn = iconButton('restart', '선택 구간 처음부터 재생', { variant: 'soft', onClick: () => preview.play(preview.settings.trimStart) });
  const posEl = h('span', { class: 'time-now' }, '0:00.0');
  const selEl = h('span', { class: 'muted small' });

  // ---------------------------------------------------------------- trim controls
  const startVal = h('span', { class: 'trim-val' });
  const endVal = h('span', { class: 'trim-val' });
  const nudgeTrim = (which, delta) => {
    const s = preview.settings;
    const patch = which === 'start' ? { trimStart: s.trimStart + delta } : { trimEnd: s.trimEnd + delta };
    preview.setSettings(patch);
    wave.update(preview.settings);
    paintTrim(preview.settings);
    emit();
  };
  const setAtPlayhead = (which) => {
    const p = preview.position;
    const s = preview.settings;
    if (which === 'start' && p < s.trimEnd - MIN_SELECTION) preview.setSettings({ trimStart: p });
    if (which === 'end' && p > s.trimStart + MIN_SELECTION) preview.setSettings({ trimEnd: p });
    wave.update(preview.settings);
    paintTrim(preview.settings);
    emit();
  };
  const trimBox = (label, valEl, which) => h('div', { class: 'trim-box' },
    h('div', { class: 'trim-box-head' }, h('span', { class: 'trim-label' }, label), valEl),
    h('div', { class: 'trim-box-btns' },
      iconButton('back', `${label} 0.1초 앞으로`, { size: 'sm', variant: 'soft', onClick: () => nudgeTrim(which, -0.1) }),
      iconButton('forward', `${label} 0.1초 뒤로`, { size: 'sm', variant: 'soft', onClick: () => nudgeTrim(which, 0.1) }),
      button('재생 위치로', { size: 'sm', variant: 'soft', onClick: () => setAtPlayhead(which) }),
    ));

  const autoBtn = button('무음 자동 자르기', {
    icon: 'wand', size: 'sm', variant: 'soft',
    onClick: () => {
      const s = preview.settings;
      const sug = suggestTrim(dual ? [backingPeaks, voicePeaks] : [voicePeaks], dual ? [s.backingVolume, s.voiceVolume] : [s.voiceVolume], D);
      if (!sug) { autoNote.textContent = '앞뒤에서 뚜렷한 무음을 찾지 못했어요.'; return; }
      preview.setSettings(sug);
      wave.update(preview.settings);
      paintTrim(preview.settings);
      autoNote.textContent = `소리가 시작하고 끝나는 곳에 맞춰 잘랐어요 (${formatTime(sug.trimStart, { tenths: true })} – ${formatTime(sug.trimEnd, { tenths: true })}).`;
      emit();
    },
  });
  const resetTrimBtn = button('자르기 초기화', {
    icon: 'restart', size: 'sm', variant: 'ghost',
    onClick: () => {
      preview.setSettings({ trimStart: 0, trimEnd: D });
      wave.update(preview.settings);
      paintTrim(preview.settings);
      autoNote.textContent = '';
      emit();
    },
  });
  const autoNote = h('p', { class: 'small muted', 'aria-live': 'polite' });

  function paintTrim(t) {
    startVal.textContent = formatTime(t.trimStart, { tenths: true });
    endVal.textContent = formatTime(t.trimEnd, { tenths: true });
    selEl.textContent = `선택 구간 ${formatTime(t.trimEnd - t.trimStart, { tenths: true })} / 전체 ${formatTime(D, { tenths: true })}`;
  }

  // ---------------------------------------------------------------- sync
  let syncSlider = null;
  let syncBlock = null;
  // Dragging the sync slider re-aligns the playing voice; batch those restarts. Anything that
  // reads the settings flushes the pending value first, so a quick "Save" never loses it.
  const restartDebounced = debounce((v) => { preview.setSettings({ voiceSyncOffset: v }); emit(); }, 60);
  if (dual) {
    syncSlider = createSlider({
      label: '목소리 싱크',
      emoji: '⏱',
      min: -SYNC_RANGE_MS,
      max: SYNC_RANGE_MS,
      step: 10,
      nudge: 10,
      value: preview.settings.voiceSyncOffset,
      centered: true,
      format: msFormat,
      hint: '목소리가 박자보다 늦게 들리나요? 왼쪽으로 옮기세요. 빠르면 오른쪽으로. 재생하면서 들으며 맞춰 보세요.',
      onInput: (v) => {
        wave.update({ voiceSyncOffset: v });
        restartDebounced(v);
      },
    });
    const suggestion = sourceType === 'upload' && latencyEstimateMs && latencyEstimateMs >= 15
      ? h('div', { class: 'sync-suggest' },
        h('span', { class: 'small' }, `녹음하는 동안 기기가 알려 준 오디오 지연은 약 ${latencyEstimateMs} ms예요.`),
        button(`−${Math.min(SYNC_RANGE_MS, Math.round(latencyEstimateMs / 10) * 10)} ms 적용해 보기`, {
          size: 'sm', variant: 'soft',
          onClick: () => {
            const v = -Math.min(SYNC_RANGE_MS, Math.round(latencyEstimateMs / 10) * 10);
            syncSlider.setValue(v);
            wave.update({ voiceSyncOffset: v });
            preview.setSettings({ voiceSyncOffset: v });
            emit();
          },
        }))
      : null;
    const zeroBtn = button('0 ms로 되돌리기', {
      size: 'sm', variant: 'ghost',
      onClick: () => { syncSlider.setValue(0); wave.update({ voiceSyncOffset: 0 }); preview.setSettings({ voiceSyncOffset: 0 }); emit(); },
    });
    syncBlock = h('div', { class: 'editor-block' }, syncSlider.el, h('div', { class: 'row-wrap' }, zeroBtn), suggestion);
  }

  // ---------------------------------------------------------------- volumes
  const backingSlider = dual ? createSlider({
    label: '반주', emoji: '🎵', min: 0, max: 200, step: 5, nudge: 5,
    value: Math.round(preview.settings.backingVolume * 100), format: pctFormat,
    onInput: (v) => { preview.setSettings({ backingVolume: v / 100 }); wave.update(preview.settings); emit(); },
  }) : null;
  const voiceSlider = createSlider({
    label: dual ? '목소리' : '녹음 음량', emoji: dual ? '🎤' : '🎚', min: 0, max: 200, step: 5, nudge: 5,
    value: Math.round(preview.settings.voiceVolume * 100), format: pctFormat,
    onInput: (v) => { preview.setSettings({ voiceVolume: v / 100 }); wave.update(preview.settings); emit(); },
  });
  const solo = dual ? segmented([
    { value: 'mix', label: '믹스' },
    { value: 'backing', label: '🎵 반주만' },
    { value: 'voice', label: '🎤 목소리만' },
  ], 'mix', (v) => preview.setSolo(v), { ariaLabel: '들을 소리' }) : null;

  // ---------------------------------------------------------------- layout
  const el = h('div', { class: 'mix-editor' },
    h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, icon('scissors'), '자르기'),
      h('p', { class: 'small muted' }, dual
        ? '보라색 = 반주, 분홍색 = 내 목소리. 손잡이를 끌어 원하는 부분만 남기고, 파형을 누르면 그 위치로 이동해요.'
        : '손잡이를 끌어 원하는 부분만 남기고, 파형을 누르면 그 위치로 이동해요.'),
      wave.el,
      h('div', { class: 'transport' }, playBtn, restartBtn, h('div', { class: 'transport-times' }, posEl, selEl)),
      h('div', { class: 'trim-grid' }, trimBox('시작', startVal, 'start'), trimBox('끝', endVal, 'end')),
      h('div', { class: 'row-wrap' }, autoBtn, resetTrimBtn),
      autoNote,
    ),
    dual ? h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, icon('clock'), '목소리 싱크'),
      syncBlock,
    ) : h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, icon('clock'), '목소리 싱크'),
      notice('info', '이 녹음은 스피커 + 마이크 방식이라 노래와 목소리가 같은 마이크 녹음에 들어 있어요. 따로 옮기거나 음량을 맞출 수는 없지만, 전체 음량과 자르기는 조절할 수 있어요.'),
    ),
    h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, icon('sliders'), dual ? '밸런스' : '음량'),
      backingSlider ? backingSlider.el : null,
      voiceSlider.el,
      solo ? h('div', { class: 'editor-block' }, h('div', { class: 'small muted', style: 'margin-bottom:6px' }, '들어 보기:'), solo.el) : null,
      h('p', { class: 'small muted' }, '바꾼 내용은 바로 들어 볼 수 있고, 저장할 때 적용돼요. 원본 녹음은 그대로 남아서 나중에 다시 바꿀 수 있어요.'),
    ),
  );

  // ---------------------------------------------------------------- live updates
  let raf = 0;
  const frame = () => {
    const p = preview.position;
    wave.setPosition(p);
    posEl.textContent = formatTime(p, { tenths: true });
    raf = preview.playing ? requestAnimationFrame(frame) : 0;
  };
  const offPreview = preview.on(() => {
    const playing = preview.playing;
    playIcon.replaceChildren(icon(playing ? 'pause' : 'play', { size: 26 }));
    playBtn.setAttribute('aria-label', playing ? '일시정지' : '선택 구간 재생');
    if (playing && !raf) raf = requestAnimationFrame(frame);
    if (!playing) frame();
  });
  paintTrim(preview.settings);
  frame();

  return {
    el,
    preview,
    /** Apply any pending (debounced) change and report the current settings. */
    flush() { restartDebounced.flush(); },
    getSettings() {
      restartDebounced.flush();
      return { ...preview.settings };
    },
    pause() {
      restartDebounced.flush();
      preview.pause();
    },
    destroy() {
      restartDebounced.flush();
      cancelAnimationFrame(raf);
      offPreview();
      wave.destroy();
      preview.dispose();
    },
  };
}
