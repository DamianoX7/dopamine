// Re-open a saved Single: edit details, artwork, lyrics, trim, Voice Sync and volumes.
// The originals are untouched; if the mix changed, a new final WAV is rendered.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { navigate, addNavigationGuard } from '../core/router.js';
import { toast } from '../core/toast.js';
import { putBlob, getBlob } from '../core/db.js';
import { loadStems, renderMixToWav } from '../audio/mixer.js';
import { getSingle, updateSingle, deleteBlobsIfUnreferenced } from '../library.js';
import { refreshSingle } from '../player.js';
import { revokeBlobUrl } from '../blobUrls.js';
import { button, notice, spinner, field, emptyState, pageHead } from '../ui/common.js';
import { createArtworkPicker } from '../ui/artworkPicker.js';
import { createMixEditor } from '../ui/mixEditor.js';
import { createLyricsPanel } from '../ui/lyrics.js';

const MIX_KEYS = ['trimStart', 'trimEnd', 'voiceSyncOffset', 'backingVolume', 'voiceVolume'];

export function mountEditSingle(root, { id }) {
  const single = getSingle(id);
  const el = h('div', { class: 'cv screen edit-single' });
  root.append(el);
  if (!single) {
    el.append(emptyState('🔍', '싱글을 찾을 수 없어요', '삭제됐을 수 있어요.', button('내 커버로 가기', { variant: 'soft', onClick: () => navigate('/music') })));
    return () => el.remove();
  }

  let destroyed = false;
  let saving = false;
  let editor = null;
  let stems = null;

  const titleIn = h('input', { class: 'input', type: 'text', maxLength: 120, value: single.title || '' });
  const origIn = h('input', { class: 'input', type: 'text', maxLength: 120, value: single.originalArtist || '' });
  const coverIn = h('input', { class: 'input', type: 'text', maxLength: 120, value: single.coverArtist || '' });
  const descIn = h('textarea', { class: 'input', rows: 3, maxLength: 2000 });
  descIn.value = single.description || '';
  const picker = createArtworkPicker({
    artworkId: single.artworkId,
    design: single.artworkDesign || null,
    getDefaults: () => ({ title: titleIn.value.trim(), artist: coverIn.value.trim() || origIn.value.trim() }),
    seed: single.title,
  });
  const lyrics = createLyricsPanel({ value: single.lyrics || '', compact: true });
  const editorSlot = h('div', { class: 'editor-slot' }, h('section', { class: 'card' }, spinner('원본 녹음을 불러오는 중…')));
  const errorSlot = h('div');
  const overlay = h('div', { class: 'saving-overlay', hidden: true }, h('div', { class: 'saving-box' }, spinner(''), h('p', null, '바꾼 내용을 저장하는 중…')));

  (async () => {
    try {
      const [voiceBlob, backingBlob] = await Promise.all([getBlob(single.voiceStemId), single.backingStemId ? getBlob(single.backingStemId) : null]);
      stems = await loadStems({ voiceBlob, backingBlob, backingKind: single.backingStemKind, backingOffset: single.backingOffset });
      if (destroyed) return;
      editor = createMixEditor({
        stems,
        settings: Object.fromEntries(MIX_KEYS.map((k) => [k, single[k]])),
        sourceType: single.sourceType,
        latencyEstimateMs: single.latencyEstimateMs,
      });
      editorSlot.replaceChildren(editor.el);
    } catch (err) {
      if (!destroyed) editorSlot.replaceChildren(notice('warn', `원본 녹음을 불러오지 못해서(${err.message}) 정보만 고칠 수 있어요.`));
    }
  })();

  const removeGuard = addNavigationGuard(() => (saving ? '잠시만요 — 바꾼 내용을 저장하는 중이에요.' : null));
  const onUnload = (e) => { if (saving) { e.preventDefault(); e.returnValue = ''; } };
  window.addEventListener('beforeunload', onUnload);

  const saveBtn = button('변경 내용 저장', { variant: 'primary', icon: 'check', size: 'lg', block: true });
  saveBtn.addEventListener('click', async () => {
    const title = titleIn.value.trim();
    if (!title) {
      errorSlot.replaceChildren(notice('error', '커버 제목을 적어 주세요.'));
      titleIn.focus();
      return;
    }
    saving = true;
    overlay.hidden = false;
    saveBtn.disabled = true;
    errorSlot.replaceChildren();
    if (editor) editor.pause();
    const cleanup = [];
    try {
      const patch = {
        title,
        originalArtist: origIn.value.trim(),
        coverArtist: coverIn.value.trim(),
        description: descIn.value.trim(),
        lyrics: lyrics.getValue(),
      };
      if (editor && stems) {
        const settings = editor.getSettings();
        const changed = MIX_KEYS.some((k) => Math.abs((settings[k] || 0) - (single[k] || 0)) > 1e-6);
        if (changed) {
          const out = await renderMixToWav(stems, settings);
          patch.audioId = await putBlob(out.blob, { kind: 'final' });
          Object.assign(patch, out.settings, { duration: out.duration, channels: out.channels, exportGain: out.gain, mimeType: 'audio/wav' });
          cleanup.push(single.audioId);
        }
      }
      const art = picker.getValue();
      if (art.changed) {
        if (art.blob) {
          patch.artworkId = await putBlob(art.blob, { kind: 'artwork' });
          patch.artworkDesign = art.design || null;
        } else if (art.removed) {
          patch.artworkId = null;
          patch.artworkDesign = null;
        }
        if (single.artworkId) {
          cleanup.push(single.artworkId);
          revokeBlobUrl(single.artworkId);
        }
      }
      await updateSingle(id, patch);
      await deleteBlobsIfUnreferenced(cleanup);
      if (patch.audioId) refreshSingle(id);
      saving = false;
      toast('저장했어요', { type: 'ok' });
      navigate(`/single/${id}`, { replace: true });
    } catch (err) {
      saving = false;
      overlay.hidden = true;
      saveBtn.disabled = false;
      errorSlot.replaceChildren(notice('error', err.message || '바꾼 내용을 저장하지 못했어요.', { title: '저장되지 않았어요' }));
    }
  });

  el.append(
    pageHead('✏️ 커버 편집', { back: () => navigate(`/single/${id}`), backLabel: '취소' }),
    h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, icon('edit'), '정보'),
      h('div', { class: 'single-form' },
        h('div', { class: 'single-art' }, h('div', { class: 'field-label' }, '커버 그림'), picker.el),
        h('div', { class: 'form' },
          field('제목', titleIn),
          field('원곡 아티스트', origIn),
          field('커버 아티스트', coverIn),
          field('설명', descIn)))),
    editorSlot,
    lyrics.el,
    errorSlot,
    h('div', { class: 'step-actions' },
      saveBtn,
      button('취소', { variant: 'ghost', onClick: () => navigate(`/single/${id}`) })),
    overlay,
  );

  return () => {
    destroyed = true;
    removeGuard();
    window.removeEventListener('beforeunload', onUnload);
    if (editor) editor.destroy();
    picker.destroy();
    el.remove();
  };
}
