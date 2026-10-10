// Step 6 — Create Single: artwork + title/artist/description, then render & save.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { getPrefs } from '../core/prefs.js';
import { formatTime, formatBytes } from '../core/util.js';
import { suggestMetadata } from '../youtube.js';
import { button, notice, spinner, field, badge } from '../ui/common.js';
import { createArtworkPicker } from '../ui/artworkPicker.js';
import * as C from './controller.js';

export function createSingleStep(s0) {
  const draft = s0.draft;
  const sug = suggestMetadata(draft.videoTitle || '', draft.videoAuthor || '');
  const titleIn = h('input', { class: 'input', type: 'text', maxLength: 120, value: sug.title || '', placeholder: '노래 제목', required: true });
  const origIn = h('input', { class: 'input', type: 'text', maxLength: 120, value: sug.originalArtist || '', placeholder: '원곡은 누가 불렀나요?' });
  const coverIn = h('input', { class: 'input', type: 'text', maxLength: 120, value: getPrefs().coverArtist || '', placeholder: '내 아티스트 이름' });
  const descIn = h('textarea', { class: 'input', rows: 3, maxLength: 2000, placeholder: '이 커버에 대한 짧은 메모 (선택)' });
  const picker = createArtworkPicker({
    getDefaults: () => ({ title: titleIn.value.trim(), artist: coverIn.value.trim() || origIn.value.trim() }),
    seed: titleIn.value,
  });
  const formError = h('p', { class: 'form-error', role: 'alert' });
  const saveError = h('div');
  const overlay = h('div', { class: 'saving-overlay', hidden: true }, h('div', { class: 'saving-box' }, spinner(''), h('p', null, '커버를 믹스하고 저장하는 중…'), h('p', { class: 'small muted' }, '싱크, 음량, 자르기 설정을 반영해 최종 WAV를 만들고 있어요.')));

  const settings = draft.settings;
  const dur = Math.max(0, settings.trimEnd - settings.trimStart);
  const channels = draft.mode === 'speaker' ? 1 : draft.mode === 'upload' && s0.upload.channels === 1 ? 1 : 2;
  const estBytes = dur * draft.sampleRate * channels * 2;
  const problems = C.saveProblems(draft);
  const incomplete = problems.length > 0;

  const saveBtn = button('최종 커버 저장', { variant: 'primary', icon: 'check', size: 'lg', block: true });
  saveBtn.addEventListener('click', async () => {
    const title = titleIn.value.trim();
    if (!title) {
      formError.textContent = '커버 제목을 적어 주세요.';
      titleIn.focus();
      return;
    }
    formError.textContent = '';
    await C.saveSingle({
      meta: {
        title,
        originalArtist: origIn.value.trim(),
        coverArtist: coverIn.value.trim(),
        description: descIn.value.trim(),
      },
      artwork: picker.getValue(),
    });
  });

  const lyricLines = (s0.lyrics || '').split('\n').filter((l) => l.trim()).length;
  const el = h('div', { class: 'step step-single' },
    h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, icon('disc'), '싱글 만들기'),
      incomplete ? notice('warn', `${problems.join(' ')} 미완성으로 표시되어 저장돼요.`) : null,
      h('div', { class: 'single-form' },
        h('div', { class: 'single-art' }, h('div', { class: 'field-label' }, '커버 그림'), picker.el),
        h('div', { class: 'form' },
          field('제목', titleIn),
          field('원곡 아티스트', origIn),
          field('커버 아티스트', coverIn),
          field('설명', descIn),
          formError))),
    h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, icon('info'), '저장되는 내용'),
      h('dl', { class: 'cv-kv' },
        h('dt', null, '길이'), h('dd', null, formatTime(dur)),
        h('dt', null, '파일'), h('dd', null, `WAV (16-bit PCM), ${channels === 1 ? '모노' : '스테레오'} · 약 ${formatBytes(estBytes)}`),
        h('dt', null, '믹스'), h('dd', null, draft.mode === 'speaker'
          ? `음량 ${Math.round(settings.voiceVolume * 100)}%`
          : `🎵 ${Math.round(settings.backingVolume * 100)}% · 🎤 ${Math.round(settings.voiceVolume * 100)}% · ⏱ ${settings.voiceSyncOffset} ms`),
        h('dt', null, '가사'), h('dd', null, lyricLines ? `${lyricLines}줄` : '없음'),
        h('dt', null, '원본'), h('dd', null, '그대로 보관돼서 나중에 싱크, 음량, 자르기를 다시 고칠 수 있어요')),
      incomplete ? badge('미완성 녹음', 'warn') : null,
      h('p', { class: 'small muted' }, '모든 것은 이 기기에만 저장돼요.')),
    saveError,
    h('div', { class: 'step-actions' },
      saveBtn,
      button('믹스 & 자르기로', { variant: 'ghost', icon: 'back', onClick: () => C.backToEdit() })),
    overlay,
  );

  function update(s) {
    const saving = s.state === 'saving';
    overlay.hidden = !saving;
    saveBtn.disabled = saving;
    for (const input of [titleIn, origIn, coverIn, descIn]) input.disabled = saving;
    saveError.replaceChildren(...(s.saveError ? [notice('error', s.saveError, { title: '저장하지 못했어요' })] : []));
  }

  update(s0);
  return { el, update, destroy: () => picker.destroy() };
}
