// Shared UI pieces for the studio and the covers library. They produce Dopamine World's own
// components (.btn, .chip, .seg, .field, .empty, .spinner — see style.css), so everything
// here follows the app's themes and late-night mode.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { blobUrl } from '../blobUrls.js';

// A destructive action that isn't the main button of its screen stays quiet: red text only.
const VARIANT = { primary: 'primary', soft: 'soft', ghost: 'ghost', danger: 'ghost danger-text', 'danger-solid': 'danger' };
const sizeClass = (size, block) => (size === 'sm' ? 'small' : size === 'lg' ? (block ? 'huge' : 'big') : '');

export function button(label, { variant = '', icon: iconName = null, onClick = null, disabled = false, title = null,
  type = 'button', size = '', block = false, ariaLabel = null, cls = '' } = {}) {
  return h('button', {
    class: ['btn', VARIANT[variant], sizeClass(size, block), block && size !== 'lg' && 'wide', cls],
    type, onClick, disabled, title, 'aria-label': ariaLabel,
  }, iconName ? icon(iconName) : null, label ? h('span', { class: 'btn-label' }, label) : null);
}

export function iconButton(iconName, label, { onClick = null, variant = 'ghost', disabled = false, cls = '', size = '' } = {}) {
  return h('button', {
    class: ['btn', 'icon', VARIANT[variant], sizeClass(size, false), cls],
    type: 'button', onClick, disabled, 'aria-label': label, title: label,
  }, icon(iconName));
}

/** type: 'info' | 'ok' | 'warn' | 'error' */
export function notice(type, body, { title = null, iconName = null, actions = null } = {}) {
  const ic = iconName || { ok: 'check', warn: 'alert', error: 'alert', info: 'info' }[type] || 'info';
  return h('div', { class: `notice notice-${type}`, role: type === 'error' ? 'alert' : null },
    icon(ic, { size: 20, cls: 'notice-icon' }),
    h('div', { class: 'notice-body' },
      title ? h('strong', { class: 'notice-title' }, title) : null,
      body ? h('div', { class: 'notice-text' }, body) : null,
      actions ? h('div', { class: 'notice-actions' }, actions) : null,
    ),
  );
}

export function badge(text, type = '') {
  return h('span', { class: ['chip', type === 'ok' && 'chip-done', type === 'warn' && 'chip-hot'] }, text);
}

export function spinner(label = '') {
  return h('span', { class: 'spinner-wrap' }, h('span', { class: 'spinner small', 'aria-hidden': 'true' }), label ? h('span', null, label) : null);
}

export function field(label, control, { hint = null, cls = '' } = {}) {
  return h('label', { class: `field ${cls}` },
    h('span', null, label),
    control,
    hint ? h('small', { class: 'field-hint' }, hint) : null,
  );
}

/** Segmented control. options: [{ value, label, icon? }]. Returns { el, set(value) }. */
export function segmented(options, value, onChange, { ariaLabel = '', disabled = false } = {}) {
  const buttons = options.map((opt) => h('button', {
    class: 'seg-btn', type: 'button', role: 'radio', 'aria-checked': String(opt.value === value),
    disabled: disabled || opt.disabled,
    onClick: () => { if (opt.value !== current) { set(opt.value); onChange(opt.value); } },
  }, opt.icon ? icon(opt.icon, { size: 18 }) : null, h('span', null, opt.label)));
  const el = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': ariaLabel }, buttons);
  let current = value;
  function set(v) {
    current = v;
    options.forEach((opt, i) => {
      buttons[i].setAttribute('aria-checked', String(opt.value === v));
      buttons[i].classList.toggle('on', opt.value === v);
    });
  }
  set(value);
  return { el, set, setDisabled: (d) => buttons.forEach((b) => { b.disabled = d; }) };
}

const FALLBACK_ART = [
  ['#c9b3fb', '#ffd0e4'], ['#ffe0ec', '#ffb3d1'], ['#d7f7ea', '#b9c8ff'],
  ['#fff1dc', '#ffc2a8'], ['#e7dcff', '#b6e3ff'], ['#ffd6e7', '#e3c8ff'],
];

function hashString(s) {
  let x = 0;
  for (let i = 0; i < s.length; i++) x = (x * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(x);
}

/** Artwork tile: stored image if present, otherwise a soft gradient placeholder. */
export function artworkEl(artworkId, { size = 'md', seed = '', emoji = '🎵', alt = '' } = {}) {
  const [a, b] = FALLBACK_ART[hashString(seed || 'cover') % FALLBACK_ART.length];
  const el = h('div', { class: `cv-art cv-art-${size}`, style: { '--art-a': a, '--art-b': b } },
    h('span', { class: 'cv-art-fallback', 'aria-hidden': 'true' }, emoji));
  if (artworkId) {
    blobUrl(artworkId).then((url) => {
      if (!url) return;
      const img = h('img', { src: url, alt, draggable: false, loading: 'lazy' });
      img.addEventListener('load', () => el.classList.add('has-img'));
      el.append(img);
    });
  }
  return el;
}

export const SOURCE_INFO = {
  tab: { label: '데스크톱 오디오', long: '데스크톱 오디오', icon: 'tab' },
  upload: { label: '반주 파일', long: '반주 파일 업로드', icon: 'file' },
  speaker: { label: '스피커 + 마이크', long: '스피커 + 마이크', icon: 'speaker' },
};

export function emptyState(emoji, title, text, action = null) {
  return h('div', { class: 'empty' },
    h('div', { class: 'empty-icon', 'aria-hidden': 'true' }, emoji),
    h('h3', null, title),
    text ? h('p', null, text) : null,
    action,
  );
}

/** Page header in the app's style: centered title, optional subtitle or "‹ Back" button. */
export function pageHead(title, { sub = null, back = null, backLabel = '뒤로' } = {}) {
  if (back) {
    return h('header', { class: 'page-head compact' },
      h('button', { class: 'back-btn', type: 'button', onClick: back }, `‹ ${backLabel}`),
      h('h1', null, title),
      h('span'));
  }
  return h('header', { class: 'page-head' }, h('h1', null, title), sub ? h('p', { class: 'sub' }, sub) : null);
}

export function card(title, ...children) {
  return h('section', { class: 'card' }, title ? h('h2', { class: 'card-title' }, title) : null, ...children);
}

let volumeTest = null;
/** iOS ignores media element volume; only show volume sliders where they work. */
export function mediaVolumeSettable() {
  if (volumeTest !== null) return volumeTest;
  try {
    const a = document.createElement('audio');
    a.volume = 0.5;
    volumeTest = Math.abs(a.volume - 0.5) < 0.01;
  } catch {
    volumeTest = false;
  }
  return volumeTest;
}
