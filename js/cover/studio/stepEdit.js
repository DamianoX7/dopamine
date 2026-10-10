// Step 5 — Mix & trim the take (Voice Sync, Backing/Voice volume, trim) + lyrics.
import { h } from '../core/dom.js';
import { button, notice, spinner } from '../ui/common.js';
import { createMixEditor } from '../ui/mixEditor.js';
import { createLyricsPanel } from '../ui/lyrics.js';
import * as C from './controller.js';

export function createEditStep(s0) {
  let destroyed = false;
  let editor = null;
  const draft = s0.draft;
  const body = h('div', { class: 'editor-slot' }, h('section', { class: 'card' }, spinner('트랙을 불러오는 중…')));
  const lyrics = createLyricsPanel({ value: s0.lyrics, onInput: (v) => C.setLyrics(v), compact: true });

  C.loadDraftStems(draft).then((stems) => {
    if (destroyed) return;
    editor = createMixEditor({
      stems,
      settings: draft.settings,
      sourceType: draft.mode,
      latencyEstimateMs: draft.latencyEstimateMs,
      onChange: (settings) => C.setDraftSettings(settings),
    });
    body.replaceChildren(editor.el);
  }).catch((err) => {
    if (!destroyed) body.replaceChildren(notice('error', `편집할 녹음을 불러오지 못했어요: ${err.message}`));
  });

  const el = h('div', { class: 'step step-edit' },
    body,
    lyrics.el,
    h('div', { class: 'step-actions' },
      button('다음: 싱글 만들기', { variant: 'primary', icon: 'forward', size: 'lg', block: true, onClick: () => { if (editor) editor.pause(); C.toSingleForm(); } }),
      button('확인 단계로', { variant: 'ghost', icon: 'back', onClick: () => { if (editor) editor.pause(); C.backToReview(); } })),
  );

  return {
    el,
    destroy() {
      destroyed = true;
      if (editor) editor.destroy();
    },
  };
}
