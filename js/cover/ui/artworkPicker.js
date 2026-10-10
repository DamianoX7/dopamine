// Artwork chooser: upload a photo (center-cropped to 1:1) or design one in the built-in creator.
import { h } from '../core/dom.js';
import { toast } from '../core/toast.js';
import { processImageFile, defaultDesign } from '../artwork.js';
import { openCoverCreator } from './coverCreator.js';
import { button, artworkEl, spinner } from './common.js';

/**
 * getDefaults() -> { title, artist } used to prefill the designer.
 * getValue() -> { artworkId, design, blob, removed, changed }
 */
export function createArtworkPicker({ artworkId = null, design = null, getDefaults = () => ({}), seed = '' }) {
  let state = { artworkId, design, blob: null, removed: false, changed: false };
  let previewUrl = null;
  const frame = h('div', { class: 'art-picker-frame' });

  function renderPreview() {
    frame.replaceChildren();
    if (state.blob) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(state.blob);
      frame.append(h('img', { src: previewUrl, alt: '커버 그림 미리 보기' }));
    } else if (state.artworkId && !state.removed) {
      frame.append(artworkEl(state.artworkId, { size: 'fill', seed, alt: '커버 그림' }));
    } else {
      frame.append(h('div', { class: 'art-picker-empty' },
        h('span', { class: 'art-picker-emoji', 'aria-hidden': 'true' }, '🖼️'),
        h('span', null, '아직 그림이 없어요'),
        h('span', { class: 'small muted' }, '정사각형(1:1) 이미지')));
    }
    removeBtn.hidden = !(state.blob || (state.artworkId && !state.removed));
  }

  const fileInput = h('input', { type: 'file', accept: 'image/*', class: 'visually-hidden', tabIndex: -1, 'aria-hidden': 'true' });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files && fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    frame.replaceChildren(h('div', { class: 'art-picker-empty' }, spinner('이미지 준비 중…')));
    try {
      const blob = await processImageFile(file);
      state = { ...state, blob, design: null, removed: false, changed: true };
    } catch (err) {
      toast(err.message || '그 이미지는 쓸 수 없어요.', { type: 'error' });
    }
    renderPreview();
  });

  const uploadBtn = button('이미지 올리기', { icon: 'upload', variant: 'soft', onClick: () => fileInput.click() });
  const designBtn = button('커버 디자인하기', {
    icon: 'palette', variant: 'soft',
    onClick: async () => {
      const defaults = getDefaults() || {};
      const base = state.design || defaultDesign(defaults);
      const res = await openCoverCreator({ design: { ...base, title: defaults.title ?? base.title, artist: defaults.artist ?? base.artist } });
      if (res) {
        state = { ...state, blob: res.blob, design: res.design, removed: false, changed: true };
        renderPreview();
      }
    },
  });
  const removeBtn = button('지우기', {
    icon: 'x', variant: 'ghost', size: 'sm',
    onClick: () => {
      state = { ...state, blob: null, design: null, removed: true, changed: true };
      renderPreview();
    },
  });

  const el = h('div', { class: 'art-picker' },
    frame,
    h('div', { class: 'art-picker-actions' }, uploadBtn, designBtn, removeBtn),
    fileInput,
  );
  renderPreview();

  return {
    el,
    getValue: () => ({ ...state }),
    destroy() { if (previewUrl) URL.revokeObjectURL(previewUrl); },
  };
}
