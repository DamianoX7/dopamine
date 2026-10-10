// Lyrics window: the user types/pastes their own lyrics. Nothing is fetched automatically.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { getPrefs, setPrefs } from '../core/prefs.js';
import { clamp } from '../core/util.js';

export function createLyricsPanel({ value = '', onInput = null, title = '가사', compact = false } = {}) {
  let size = clamp(getPrefs().lyricsSize || 20, 14, 34);
  let locked = false;

  const textarea = h('textarea', {
    class: 'lyrics-text',
    placeholder: '가사를 여기에 붙여 넣거나 적어 주세요 ♪\n\n이 녹음과 함께 저장돼요.',
    spellcheck: false,
    'aria-label': '가사',
  });
  textarea.value = value;
  const reader = h('div', { class: 'lyrics-read', tabIndex: 0, 'aria-label': '가사' });
  reader.hidden = true;

  const applySize = () => {
    el.style.setProperty('--lyrics-size', `${size}px`);
  };
  const smaller = h('button', { class: 'btn icon small soft', type: 'button', 'aria-label': '가사 글자 작게', title: '글자 작게' }, h('span', { class: 'a-small' }, 'A'));
  const bigger = h('button', { class: 'btn icon small soft', type: 'button', 'aria-label': '가사 글자 크게', title: '글자 크게' }, h('span', { class: 'a-big' }, 'A'));
  smaller.addEventListener('click', () => { size = clamp(size - 2, 14, 34); setPrefs({ lyricsSize: size }); applySize(); });
  bigger.addEventListener('click', () => { size = clamp(size + 2, 14, 34); setPrefs({ lyricsSize: size }); applySize(); });

  const modeBtn = h('button', { class: 'btn small soft', type: 'button' });
  const paintMode = () => {
    modeBtn.replaceChildren(icon(locked ? 'edit' : 'lyrics', { size: 16 }), h('span', null, locked ? '편집' : '읽기 모드'));
    modeBtn.setAttribute('aria-pressed', String(locked));
    textarea.hidden = locked;
    reader.hidden = !locked;
    if (locked) reader.textContent = textarea.value || '아직 가사가 없어요 — 편집을 눌러 추가해 보세요.';
  };
  modeBtn.addEventListener('click', () => { locked = !locked; paintMode(); });

  textarea.addEventListener('input', () => { if (onInput) onInput(textarea.value); });

  const el = h('section', { class: `card lyrics-card${compact ? ' is-compact' : ''}` },
    h('div', { class: 'lyrics-head' },
      h('h2', { class: 'card-title' }, icon('lyrics'), title),
      h('div', { class: 'lyrics-tools' }, smaller, bigger, modeBtn)),
    h('div', { class: 'lyrics-paper' }, textarea, reader),
  );
  applySize();
  paintMode();

  return {
    el,
    getValue: () => textarea.value,
    setValue(v) { textarea.value = v; if (locked) reader.textContent = v; },
    /** Read mode avoids popping up the phone keyboard while singing. */
    setLocked(v) { locked = !!v; paintMode(); },
  };
}
