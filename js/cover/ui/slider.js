import { h } from '../core/dom.js';
import { iconButton } from './common.js';
import { clamp } from '../core/util.js';

/**
 * Labeled range slider with big touch target and optional −/+ nudge buttons.
 * `centered` draws the fill from 0 (for bipolar values like Voice Sync).
 */
export function createSlider({
  label, emoji = '', min, max, step = 1, value, format = String, onInput = null, onChange = null,
  nudge = 0, centered = false, hint = null, disabled = false, id = null,
}) {
  const valueEl = h('output');
  const input = h('input', {
    type: 'range', class: centered ? 'range-centered' : null,
    min, max, step, value, disabled, id, 'aria-label': label,
  });
  const minus = nudge ? iconButton('minus', `${label} 줄이기`, { size: 'sm', variant: 'soft', onClick: () => bump(-nudge) }) : null;
  const plus = nudge ? iconButton('plus', `${label} 늘리기`, { size: 'sm', variant: 'soft', onClick: () => bump(nudge) }) : null;
  const el = h('div', { class: 'slider-block' },
    h('div', { class: 'slider-row' },
      h('span', { class: 'slider-label' }, emoji ? h('span', { 'aria-hidden': 'true' }, `${emoji} `) : null, label),
      valueEl),
    h('div', { class: 'slider-controls' }, minus, input, plus),
    hint ? h('p', { class: 'hint' }, hint) : null,
  );

  function paint() {
    const v = Number(input.value);
    const text = format(v);
    valueEl.textContent = text;
    input.setAttribute('aria-valuetext', text);
    const p = ((v - min) / (max - min)) * 100;
    if (centered) {
      const c = ((0 - min) / (max - min)) * 100;
      input.style.setProperty('--from', `${Math.min(p, c)}%`);
      input.style.setProperty('--to', `${Math.max(p, c)}%`);
    } else {
      input.style.setProperty('--val', `${p}%`);
    }
  }

  function bump(delta) {
    const v = clamp(Number(input.value) + delta, min, max);
    input.value = String(v);
    paint();
    if (onInput) onInput(Number(input.value));
    if (onChange) onChange(Number(input.value));
  }

  input.addEventListener('input', () => { paint(); if (onInput) onInput(Number(input.value)); });
  input.addEventListener('change', () => { if (onChange) onChange(Number(input.value)); });
  paint();
  setDisabled(disabled);

  function setDisabled(d) {
    input.disabled = !!d;
    if (minus) minus.disabled = !!d;
    if (plus) plus.disabled = !!d;
    el.classList.toggle('is-disabled', !!d);
  }

  return {
    el,
    input,
    get value() { return Number(input.value); },
    setValue(v) { input.value = String(v); paint(); },
    setDisabled,
  };
}
