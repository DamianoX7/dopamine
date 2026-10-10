// Built-in 1:1 cover designer (background, gradient, pattern shapes, emoji, text).
import { h } from '../core/dom.js';
import { openSheet } from '../core/sheet.js';
import { toast } from '../core/toast.js';
import { renderCover, designToBlob, PRESETS, PATTERNS, EMOJIS, FONTS, randomDesign } from '../artwork.js';
import { button, segmented, field } from './common.js';

const PATTERN_LABELS = { none: '없음', sparkles: '반짝이', stars: '별', dots: '점', hearts: '하트', waves: '물결', rings: '고리' };

/** Resolves { blob, design } or null when cancelled. */
export function openCoverCreator({ design }) {
  return new Promise((resolve) => {
    let d = { showText: true, frame: true, seed: 7, ...design };
    let result = null;
    const canvas = h('canvas', { class: 'creator-canvas', role: 'img', 'aria-label': '커버 미리 보기' });
    let pending = false;
    const redraw = () => {
      if (pending) return;
      pending = true;
      requestAnimationFrame(async () => {
        pending = false;
        await renderCover(canvas, d, 512);
      });
    };
    const update = (patch) => { d = { ...d, ...patch }; syncControls(); redraw(); };

    // Presets
    const presetRow = h('div', { class: 'preset-row' }, PRESETS.map((p) => h('button', {
      class: 'preset', type: 'button', title: p.name,
      style: { background: p.bg === 'gradient' ? `linear-gradient(${p.angle}deg, ${p.colors[0]}, ${p.colors[1]})` : p.colors[0] },
      onClick: () => update({ ...p, title: d.title, artist: d.artist, showText: d.showText, frame: d.frame, seed: d.seed }),
    }, h('span', { 'aria-hidden': 'true' }, p.emoji), h('span', { class: 'sr-only' }, p.name))));

    // Background
    const bgSeg = segmented([{ value: 'gradient', label: '그라데이션' }, { value: 'solid', label: '단색' }], d.bg, (v) => update({ bg: v }), { ariaLabel: '배경 종류' });
    const color1 = h('input', { type: 'color', class: 'color-input', value: d.colors[0], 'aria-label': '배경색 1' });
    const color2 = h('input', { type: 'color', class: 'color-input', value: d.colors[1] || d.colors[0], 'aria-label': '배경색 2' });
    color1.addEventListener('input', () => update({ colors: [color1.value, d.colors[1] || color1.value] }));
    color2.addEventListener('input', () => update({ colors: [d.colors[0], color2.value] }));
    const angle = h('input', { type: 'range', class: 'range', min: 0, max: 360, step: 5, value: d.angle || 0, 'aria-label': '그라데이션 각도' });
    angle.addEventListener('input', () => { angle.style.setProperty('--val', `${(angle.value / 360) * 100}%`); update({ angle: Number(angle.value) }); });

    // Pattern
    const patternRow = h('div', { class: 'chip-row' }, PATTERNS.map((p) => h('button', {
      class: 'chip', type: 'button', dataset: { value: p }, onClick: () => update({ pattern: p }),
    }, PATTERN_LABELS[p])));
    const patternColor = h('input', { type: 'color', class: 'color-input', value: d.patternColor, 'aria-label': '무늬 색' });
    patternColor.addEventListener('input', () => update({ patternColor: patternColor.value }));
    const shuffle = button('무늬 섞기', { size: 'sm', variant: 'soft', icon: 'sparkle', onClick: () => update({ seed: Math.floor(Math.random() * 100000) }) });

    // Emoji
    const emojiRow = h('div', { class: 'emoji-row' }, EMOJIS.map((e) => h('button', {
      class: 'emoji-btn', type: 'button', dataset: { value: e }, 'aria-label': e ? `이모지 ${e}` : '이모지 없음',
      onClick: () => update({ emoji: e }),
    }, e || '∅')));

    // Text
    const showText = h('input', { type: 'checkbox', checked: d.showText !== false });
    showText.addEventListener('change', () => update({ showText: showText.checked }));
    const titleIn = h('input', { class: 'input', type: 'text', value: d.title || '', maxLength: 80, placeholder: '노래 제목' });
    const artistIn = h('input', { class: 'input', type: 'text', value: d.artist || '', maxLength: 80, placeholder: '아티스트' });
    titleIn.addEventListener('input', () => update({ title: titleIn.value }));
    artistIn.addEventListener('input', () => update({ artist: artistIn.value }));
    const fontSeg = segmented(Object.entries(FONTS).map(([value, f]) => ({ value, label: f.label })), d.font, (v) => update({ font: v }), { ariaLabel: '글꼴' });
    const layoutSeg = segmented([{ value: 'top', label: '위' }, { value: 'center', label: '가운데' }, { value: 'bottom', label: '아래' }], d.layout, (v) => update({ layout: v }), { ariaLabel: '글자 위치' });
    const textColor = h('input', { type: 'color', class: 'color-input', value: d.textColor, 'aria-label': '글자 색' });
    textColor.addEventListener('input', () => update({ textColor: textColor.value }));
    const frame = h('input', { type: 'checkbox', checked: !!d.frame });
    frame.addEventListener('change', () => update({ frame: frame.checked }));

    function syncControls() {
      bgSeg.set(d.bg);
      color1.value = d.colors[0];
      color2.value = d.colors[1] || d.colors[0];
      color2.disabled = d.bg !== 'gradient';
      angle.disabled = d.bg !== 'gradient';
      angle.value = String(d.angle || 0);
      angle.style.setProperty('--val', `${((d.angle || 0) / 360) * 100}%`);
      patternRow.querySelectorAll('.chip').forEach((b) => b.classList.toggle('is-on', b.dataset.value === d.pattern));
      patternColor.value = d.patternColor;
      emojiRow.querySelectorAll('.emoji-btn').forEach((b) => b.classList.toggle('is-on', b.dataset.value === d.emoji));
      showText.checked = d.showText !== false;
      if (document.activeElement !== titleIn) titleIn.value = d.title || '';
      if (document.activeElement !== artistIn) artistIn.value = d.artist || '';
      fontSeg.set(d.font);
      layoutSeg.set(d.layout);
      textColor.value = d.textColor;
      frame.checked = !!d.frame;
    }

    const content = h('div', { class: 'creator' },
      h('div', { class: 'creator-preview' }, canvas),
      h('div', { class: 'creator-controls' },
        h('div', { class: 'creator-group' }, h('div', { class: 'group-label' }, '프리셋'), presetRow,
          button('랜덤으로', { size: 'sm', variant: 'soft', icon: 'sparkle', onClick: () => update(randomDesign({ title: d.title, artist: d.artist, showText: d.showText })) })),
        h('div', { class: 'creator-group' }, h('div', { class: 'group-label' }, '배경'), bgSeg.el,
          h('div', { class: 'row-wrap' }, h('label', { class: 'color-field' }, color1, '색 1'), h('label', { class: 'color-field' }, color2, '색 2')),
          h('label', { class: 'field' }, h('span', { class: 'field-label' }, '그라데이션 각도'), angle)),
        h('div', { class: 'creator-group' }, h('div', { class: 'group-label' }, '무늬'), patternRow,
          h('div', { class: 'row-wrap' }, h('label', { class: 'color-field' }, patternColor, '무늬 색'), shuffle)),
        h('div', { class: 'creator-group' }, h('div', { class: 'group-label' }, '장식'), emojiRow),
        h('div', { class: 'creator-group' }, h('div', { class: 'group-label' }, '글자'),
          h('label', { class: 'check' }, showText, '제목과 아티스트 표시'),
          field('커버에 넣을 제목', titleIn),
          field('커버에 넣을 아티스트', artistIn),
          h('div', { class: 'group-sub' }, '글꼴'), fontSeg.el,
          h('div', { class: 'group-sub' }, '위치'), layoutSeg.el,
          h('div', { class: 'row-wrap' }, h('label', { class: 'color-field' }, textColor, '글자 색'), h('label', { class: 'check' }, frame, '테두리'))),
      ),
    );

    const cancel = button('취소', { onClick: () => sheet.close() });
    const use = button('이 커버 쓰기', {
      variant: 'primary', icon: 'check',
      onClick: async () => {
        use.disabled = true;
        try {
          const blob = await designToBlob(d);
          result = { blob, design: d };
          sheet.close();
        } catch (err) {
          toast(err.message || '이미지를 만들지 못했어요.', { type: 'error' });
          use.disabled = false;
        }
      },
    });
    const sheet = openSheet({ title: '커버 디자인하기', content, footer: [cancel, use], wide: true, onClose: () => resolve(result) });
    syncControls();
    redraw();
  });
}
