import { h } from '../core/dom.js';

/** Live level meter driven by real AnalyserNode peaks (−60…0 dBFS). */
export function createMeter({ label, emoji = '' }) {
  const fill = h('div', { class: 'meter-fill' });
  const bar = h('div', { class: 'vu', role: 'meter', 'aria-label': `${label} 레벨`, 'aria-valuemin': '-60', 'aria-valuemax': '0' }, fill);
  const dbEl = h('span', { class: 'meter-db' }, '—');
  const el = h('div', { class: 'meter-row' },
    h('span', { class: 'meter-label' }, emoji ? h('span', { 'aria-hidden': 'true' }, `${emoji} `) : null, label),
    bar,
    dbEl,
  );
  let shown = 0;
  let lastText = 0;
  let maxRecent = -100;

  function set(peak) {
    const db = peak > 0.00001 ? 20 * Math.log10(peak) : -100;
    const p = Math.max(0, Math.min(100, ((db + 60) / 60) * 100));
    shown = p > shown ? p : shown * 0.82 + p * 0.18;
    fill.style.clipPath = `inset(0 ${(100 - shown).toFixed(1)}% 0 0)`;
    el.classList.toggle('is-hot', db > -2);
    maxRecent = Math.max(maxRecent, db);
    const now = performance.now();
    if (now - lastText > 250) {
      dbEl.textContent = maxRecent <= -60 ? '—' : `${Math.round(maxRecent)} dB`;
      bar.setAttribute('aria-valuenow', String(Math.max(-60, Math.round(maxRecent))));
      maxRecent = -100;
      lastText = now;
    }
  }

  function reset() {
    shown = 0;
    fill.style.clipPath = 'inset(0 100% 0 0)';
    dbEl.textContent = '—';
  }

  reset();
  return { el, set, reset };
}
