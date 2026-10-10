// Waveform of the real recorded stems with draggable trim handles and a playhead.
import { h } from '../core/dom.js';
import { clamp, formatTime } from '../core/util.js';
import { MIN_SELECTION } from '../audio/mixer.js';

export function createTrimWaveform({ duration, backingPeaks = null, voicePeaks, settings, dual, onInput, onCommit, onSeek }) {
  const canvas = h('canvas', { class: 'wave-canvas', 'aria-hidden': 'true' });
  const shadeL = h('div', { class: 'wave-shade wave-shade-l' });
  const shadeR = h('div', { class: 'wave-shade wave-shade-r' });
  const playhead = h('div', { class: 'wave-playhead', 'aria-hidden': 'true' });
  const handleS = h('div', { class: 'trim-handle trim-start', role: 'slider', tabIndex: 0, 'aria-label': '자르기 시작점' }, h('span', { class: 'trim-knob' }));
  const handleE = h('div', { class: 'trim-handle trim-end', role: 'slider', tabIndex: 0, 'aria-label': '자르기 끝점' }, h('span', { class: 'trim-knob' }));
  const el = h('div', { class: 'wave' }, canvas, shadeL, shadeR, playhead, handleS, handleE);

  let s = { ...settings };
  let pos = s.trimStart;
  const D = Math.max(0.001, duration);
  const pctOf = (t) => (clamp(t, 0, D) / D) * 100;

  function draw() {
    const w = el.clientWidth;
    const hgt = el.clientHeight;
    if (!w || !hgt) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, hgt);
    const mid = hgt / 2;
    const half = mid - 6;
    const bins = voicePeaks.length;
    const styles = getComputedStyle(el);
    const backingColor = styles.getPropertyValue('--wave-backing').trim() || '#b9a2f5';
    const voiceColor = styles.getPropertyValue('--wave-voice').trim() || '#f27fb2';

    const colPeak = (peaks, x, shiftSec = 0) => {
      const t0 = (x / w) * D - shiftSec;
      const t1 = ((x + 1) / w) * D - shiftSec;
      let b0 = Math.floor((t0 / D) * bins);
      let b1 = Math.ceil((t1 / D) * bins);
      if (b1 <= 0 || b0 >= bins) return 0;
      b0 = Math.max(0, b0);
      b1 = Math.min(bins, Math.max(b0 + 1, b1));
      let m = 0;
      for (let b = b0; b < b1; b++) if (peaks[b] > m) m = peaks[b];
      return m;
    };

    if (backingPeaks) {
      ctx.fillStyle = backingColor;
      for (let x = 0; x < w; x++) {
        const a = Math.min(1, colPeak(backingPeaks, x) * s.backingVolume) * half;
        if (a > 0.3) ctx.fillRect(x, mid - a, 1, a * 2);
      }
    }
    ctx.fillStyle = voiceColor;
    ctx.globalAlpha = backingPeaks ? 0.85 : 1;
    const shift = dual ? s.voiceSyncOffset / 1000 : 0;
    for (let x = 0; x < w; x++) {
      const a = Math.min(1, colPeak(voicePeaks, x, shift) * s.voiceVolume) * half;
      if (a > 0.3) ctx.fillRect(x, mid - a, 1, a * 2);
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(58,45,85,0.12)';
    ctx.fillRect(0, mid - 0.5, w, 1);
  }

  function layout() {
    const a = pctOf(s.trimStart);
    const b = pctOf(s.trimEnd);
    shadeL.style.width = `${a}%`;
    shadeR.style.left = `${b}%`;
    handleS.style.left = `${a}%`;
    handleE.style.left = `${b}%`;
    playhead.style.left = `${pctOf(pos)}%`;
    handleS.setAttribute('aria-valuemin', '0');
    handleS.setAttribute('aria-valuemax', String(Math.round(s.trimEnd * 10) / 10));
    handleS.setAttribute('aria-valuenow', String(Math.round(s.trimStart * 10) / 10));
    handleS.setAttribute('aria-valuetext', formatTime(s.trimStart, { tenths: true }));
    handleE.setAttribute('aria-valuemin', String(Math.round(s.trimStart * 10) / 10));
    handleE.setAttribute('aria-valuemax', String(Math.round(D * 10) / 10));
    handleE.setAttribute('aria-valuenow', String(Math.round(s.trimEnd * 10) / 10));
    handleE.setAttribute('aria-valuetext', formatTime(s.trimEnd, { tenths: true }));
  }

  const xToTime = (clientX) => {
    const r = el.getBoundingClientRect();
    return clamp(((clientX - r.left) / r.width) * D, 0, D);
  };

  function applyEdge(which, t, commit) {
    const minSel = Math.min(MIN_SELECTION, D);
    if (which === 'start') s.trimStart = clamp(t, 0, s.trimEnd - minSel);
    else s.trimEnd = clamp(t, s.trimStart + minSel, D);
    layout();
    if (onInput) onInput({ trimStart: s.trimStart, trimEnd: s.trimEnd });
    if (commit && onCommit) onCommit({ trimStart: s.trimStart, trimEnd: s.trimEnd });
  }

  function bindHandle(handle, which) {
    handle.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      e.stopPropagation();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add('is-dragging');
      const move = (ev) => applyEdge(which, xToTime(ev.clientX), false);
      const up = () => {
        handle.classList.remove('is-dragging');
        handle.removeEventListener('pointermove', move);
        handle.removeEventListener('pointerup', up);
        handle.removeEventListener('pointercancel', up);
        if (onCommit) onCommit({ trimStart: s.trimStart, trimEnd: s.trimEnd });
      };
      handle.addEventListener('pointermove', move);
      handle.addEventListener('pointerup', up);
      handle.addEventListener('pointercancel', up);
    });
    handle.addEventListener('keydown', (e) => {
      const stepSec = e.shiftKey ? 1 : 0.1;
      const cur = which === 'start' ? s.trimStart : s.trimEnd;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); applyEdge(which, cur - stepSec, true); }
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); applyEdge(which, cur + stepSec, true); }
    });
  }
  bindHandle(handleS, 'start');
  bindHandle(handleE, 'end');

  el.addEventListener('click', (e) => {
    if (e.target === handleS || e.target === handleE || handleS.contains(e.target) || handleE.contains(e.target)) return;
    if (onSeek) onSeek(xToTime(e.clientX));
  });

  const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => draw()) : null;
  if (ro) ro.observe(el);
  else window.addEventListener('resize', draw);
  requestAnimationFrame(() => { draw(); layout(); });
  layout();

  return {
    el,
    update(next) {
      const redraw = next.backingVolume !== s.backingVolume || next.voiceVolume !== s.voiceVolume || next.voiceSyncOffset !== s.voiceSyncOffset;
      s = { ...s, ...next };
      layout();
      if (redraw) draw();
    },
    setPosition(t) {
      pos = t;
      playhead.style.left = `${pctOf(t)}%`;
    },
    destroy() {
      if (ro) ro.disconnect();
      else window.removeEventListener('resize', draw);
    },
  };
}
