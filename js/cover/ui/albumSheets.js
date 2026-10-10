// Album sheets: create/edit album, add a Single to albums, add Singles to an album.
import { h } from '../core/dom.js';
import { openSheet } from '../core/sheet.js';
import { toast } from '../core/toast.js';
import { putBlob } from '../core/db.js';
import { getPrefs } from '../core/prefs.js';
import { formatTime } from '../core/util.js';
import {
  library, getAlbum, createAlbum, updateAlbum, addTracksToAlbum, removeTrackFromAlbum,
  deleteBlobsIfUnreferenced,
} from '../library.js';
import { revokeBlobUrl } from '../blobUrls.js';
import { createArtworkPicker } from './artworkPicker.js';
import { button, field, artworkEl, emptyState } from './common.js';

/** Create (album = null) or edit an album. Resolves with the saved album or null. */
export function openAlbumForm({ album = null, initialTrackIds = [] } = {}) {
  return new Promise((resolve) => {
    let saved = null;
    const titleIn = h('input', { class: 'input', type: 'text', maxLength: 100, value: album ? album.title : '', placeholder: '방구석 세션', required: true });
    const artistIn = h('input', { class: 'input', type: 'text', maxLength: 100, value: album ? album.artist : getPrefs().coverArtist || '', placeholder: '내 아티스트 이름' });
    const descIn = h('textarea', { class: 'input', rows: 3, maxLength: 1000, placeholder: '어떤 앨범인가요?' });
    descIn.value = album ? album.description || '' : '';
    const picker = createArtworkPicker({
      artworkId: album ? album.artworkId : null,
      design: album ? album.artworkDesign || null : null,
      getDefaults: () => ({ title: titleIn.value, artist: artistIn.value }),
      seed: album ? album.title : 'album',
    });
    const errEl = h('p', { class: 'form-error', role: 'alert' });
    const content = h('div', { class: 'form' },
      picker.el,
      field('앨범 제목', titleIn),
      field('아티스트', artistIn),
      field('설명', descIn),
      errEl,
    );
    const cancel = button('취소', { onClick: () => sheet.close() });
    const save = button(album ? '앨범 저장' : '앨범 만들기', {
      variant: 'primary', icon: 'check',
      onClick: async () => {
        const title = titleIn.value.trim();
        if (!title) { errEl.textContent = '앨범 제목을 적어 주세요.'; titleIn.focus(); return; }
        save.disabled = true;
        try {
          const art = picker.getValue();
          let artworkId = album ? album.artworkId : null;
          let artworkDesign = album ? album.artworkDesign || null : null;
          const oldArtwork = artworkId;
          if (art.changed) {
            if (art.blob) { artworkId = await putBlob(art.blob, { kind: 'artwork' }); artworkDesign = art.design || null; }
            else if (art.removed) { artworkId = null; artworkDesign = null; }
          }
          const data = { title, artist: artistIn.value.trim(), description: descIn.value.trim(), artworkId, artworkDesign };
          saved = album ? await updateAlbum(album.id, data) : await createAlbum({ ...data, trackIds: initialTrackIds });
          if (album && oldArtwork && oldArtwork !== artworkId) {
            revokeBlobUrl(oldArtwork);
            await deleteBlobsIfUnreferenced([oldArtwork]);
          }
          sheet.close();
        } catch (err) {
          errEl.textContent = err.message || '앨범을 저장하지 못했어요.';
          save.disabled = false;
        }
      },
    });
    const sheet = openSheet({
      title: album ? '앨범 편집' : '새 앨범',
      content,
      footer: [cancel, save],
      onClose: () => { picker.destroy(); resolve(saved); },
    });
  });
}

/** Toggle which albums contain this Single (no audio is copied). */
export function openAddToAlbumSheet(singleId) {
  const list = h('div', { class: 'pick-list' });
  function render() {
    const albums = library.get().albums;
    list.replaceChildren();
    if (!albums.length) {
      list.append(h('p', { class: 'muted' }, '아직 앨범이 없어요.'));
      return;
    }
    for (const album of albums) {
      const inAlbum = album.trackIds.includes(singleId);
      const box = h('input', { type: 'checkbox', checked: inAlbum });
      box.addEventListener('change', async () => {
        box.disabled = true;
        try {
          if (box.checked) {
            await addTracksToAlbum(album.id, [singleId]);
            toast(`“${album.title}”에 추가했어요`, { type: 'ok' });
          } else {
            await removeTrackFromAlbum(album.id, singleId);
            toast(`“${album.title}”에서 뺐어요`);
          }
        } catch (err) {
          toast(err.message, { type: 'error' });
          box.checked = !box.checked;
        }
        box.disabled = false;
      });
      list.append(h('label', { class: 'pick-row' }, box, artworkEl(album.artworkId, { size: 'xs', seed: album.title, emoji: '💿' }),
        h('span', { class: 'pick-text' }, h('span', { class: 'pick-title' }, album.title), h('span', { class: 'pick-sub' }, `${album.trackIds.length} track${album.trackIds.length === 1 ? '' : 's'}`))));
    }
  }
  render();
  const unsub = library.subscribe(render);
  const newBtn = button('이 싱글로 새 앨범 만들기', {
    icon: 'plus', variant: 'soft',
    onClick: async () => {
      const created = await openAlbumForm({ initialTrackIds: [singleId] });
      if (created) toast(`“${created.title}” 앨범을 만들었어요`, { type: 'ok' });
    },
  });
  const sheet = openSheet({
    title: '앨범에 추가',
    content: h('div', null, list, newBtn),
    footer: [button('완료', { variant: 'primary', onClick: () => sheet.close() })],
    onClose: unsub,
  });
}

/** Pick Singles to append to an album. */
export function openAddTracksSheet(albumId) {
  const album = getAlbum(albumId);
  if (!album) return;
  const candidates = library.get().singles.filter((s) => !album.trackIds.includes(s.id));
  const chosen = new Set();
  const addBtn = button('추가', { variant: 'primary', icon: 'plus', disabled: true });
  const content = candidates.length
    ? h('div', { class: 'pick-list' }, candidates.map((s) => {
      const box = h('input', { type: 'checkbox' });
      box.addEventListener('change', () => {
        if (box.checked) chosen.add(s.id); else chosen.delete(s.id);
        addBtn.disabled = chosen.size === 0;
        addBtn.querySelector('.btn-label').textContent = chosen.size ? `${chosen.size}곡 추가` : '추가';
      });
      return h('label', { class: 'pick-row' }, box, artworkEl(s.artworkId, { size: 'xs', seed: s.title }),
        h('span', { class: 'pick-text' }, h('span', { class: 'pick-title' }, s.title || '제목 없는 커버'),
          h('span', { class: 'pick-sub' }, [s.coverArtist || s.originalArtist, formatTime(s.duration)].filter(Boolean).join(' · '))));
    }))
    : emptyState('🎶', '추가할 곡이 없어요', library.get().singles.length ? '모든 싱글이 이미 이 앨범에 들어 있어요.' : '먼저 싱글을 녹음해서 저장해 주세요.');
  const sheet = openSheet({
    title: `“${album.title}”에 추가`,
    content,
    footer: [button('취소', { onClick: () => sheet.close() }), candidates.length ? addBtn : null],
  });
  addBtn.addEventListener('click', async () => {
    addBtn.disabled = true;
    try {
      // Keep the library's order (newest first) for the picked singles.
      await addTracksToAlbum(albumId, candidates.filter((s) => chosen.has(s.id)).map((s) => s.id));
      toast(`${chosen.size}곡을 추가했어요`, { type: 'ok' });
      sheet.close();
    } catch (err) {
      toast(err.message, { type: 'error' });
      addBtn.disabled = false;
    }
  });
}
