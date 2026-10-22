// Album detail: play, edit, add singles, reorder (drag & drop / move up / move down), remove.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { confirmDialog } from '../core/sheet.js';
import { toast } from '../core/toast.js';
import { formatTime } from '../core/util.js';
import { library, getAlbum, albumTracks, moveTrack, removeTrackFromAlbum, deleteAlbum } from '../library.js';
import { player, playSingle, toggle } from '../player.js';
import { button, iconButton, artworkEl, emptyState } from '../ui/common.js';
import { openAlbumForm, openAddTracksSheet } from '../ui/albumSheets.js';
import { makeSortable } from '../ui/sortable.js';

export function mountAlbum(root, { id }) {
  const el = h('div', { class: 'cv screen album' });
  root.append(el);
  let unsortable = null;

  async function move(from, to) {
    try { await moveTrack(id, from, to); } catch (err) { toast(err.message, { type: 'error' }); }
  }

  function render() {
    if (unsortable) { unsortable(); unsortable = null; }
    const album = getAlbum(id);
    if (!album) {
      el.replaceChildren(emptyState('🔍', '앨범을 찾을 수 없어요', library.get().loaded ? '삭제됐을 수 있어요.' : '불러오는 중…',
        button('내 커버로 가기', { variant: 'soft', onClick: () => navigate('/music/albums') })));
      return;
    }
    const tracks = albumTracks(album);
    const total = tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const ps = player.get();
    const queue = tracks.map((t) => t.id);
    const albumPlaying = ps.context && ps.context.type === 'album' && ps.context.id === album.id;

    const list = h('ol', { class: 'album-tracks' }, tracks.map((t, i) => {
      const isCurrent = ps.singleId === t.id;
      const playing = isCurrent && ps.playing;
      return h('li', { class: `album-track${isCurrent ? ' is-current' : ''}`, dataset: { id: t.id } },
        h('span', { class: 'track-handle', title: '끌어서 순서 바꾸기', 'aria-hidden': 'true' }, icon('grip', { size: 20 })),
        h('span', { class: 'track-num' }, String(i + 1)),
        h('button', { class: 'track-open', type: 'button', onClick: () => navigate(`/single/${t.id}`) },
          artworkEl(t.artworkId, { size: 'xs', seed: t.title }),
          h('span', { class: 'track-text' },
            h('span', { class: 'track-title' }, t.title || '제목 없는 커버'),
            h('span', { class: 'track-sub' }, [t.coverArtist || t.originalArtist, formatTime(t.duration)].filter(Boolean).join(' · ')))),
        h('div', { class: 'track-tools' },
          iconButton(playing ? 'pause' : 'play', playing ? '일시정지' : `${t.title} 재생`, {
            variant: 'soft', size: 'sm',
            onClick: () => (isCurrent ? toggle() : playSingle(t.id, { queue, context: { type: 'album', id: album.id } })),
          }),
          iconButton('up', `“${t.title}” 위로 옮기기`, { size: 'sm', disabled: i === 0, onClick: () => move(i, i - 1) }),
          iconButton('down', `“${t.title}” 아래로 옮기기`, { size: 'sm', disabled: i === tracks.length - 1, onClick: () => move(i, i + 1) }),
          iconButton('x', `“${t.title}” 이 앨범에서 빼기`, {
            size: 'sm',
            onClick: async () => {
              await removeTrackFromAlbum(album.id, t.id);
              toast(`“${t.title}” 곡을 앨범에서 뺐어요. 싱글은 내 커버에 그대로 있어요.`);
            },
          })));
    }));

    el.replaceChildren(
      h('button', { class: 'back-btn', type: 'button', onClick: () => navigate('/music/albums') }, '‹ 앨범'),
      h('section', { class: 'single-hero' },
        h('div', { class: 'single-hero-art' }, artworkEl(album.artworkId, { size: 'fill', seed: album.title, emoji: '💿', alt: `${album.title} artwork` })),
        h('div', { class: 'single-hero-text' },
          h('p', { class: 'kicker' }, '앨범'),
          h('h1', { class: 'single-title' }, album.title),
          album.artist ? h('p', { class: 'single-artists' }, h('strong', null, album.artist)) : null,
          h('p', { class: 'small muted' }, `${tracks.length}곡 · ${formatTime(total)}`),
          album.description ? h('p', { class: 'description' }, album.description) : null)),
      h('div', { class: 'single-actions' },
        button(albumPlaying && ps.playing ? '일시정지' : '앨범 재생', {
          variant: 'primary', size: 'lg', icon: albumPlaying && ps.playing ? 'pause' : 'play', disabled: !tracks.length,
          onClick: () => (albumPlaying ? toggle() : playSingle(queue[0], { queue, context: { type: 'album', id: album.id } })),
        }),
        button(window.CoverHost.lpPressed(album.id) ? 'LP로 듣기' : 'LP 굽기', {
          variant: 'soft', icon: 'disc', disabled: !tracks.length,
          onClick: () => window.CoverHost.openLP(album.id),
        }),
        button('싱글 추가', { variant: 'soft', icon: 'plus', onClick: () => openAddTracksSheet(album.id) }),
        button('앨범 편집', { variant: 'soft', icon: 'edit', onClick: () => openAlbumForm({ album }) }),
        button('앨범 삭제', {
          variant: 'danger', icon: 'trash',
          onClick: async () => {
            const ok = await confirmDialog({ title: '이 앨범을 삭제할까요?', message: '앨범은 삭제되지만, 싱글은 내 커버에 그대로 남아요.', confirmText: '앨범 삭제', danger: true });
            if (!ok) return;
            await deleteAlbum(album.id);
            toast('앨범을 삭제했어요');
            navigate('/music/albums', { replace: true });
          },
        })),
      tracks.length
        ? h('section', { class: 'card' },
          h('h2', { class: 'card-title' }, icon('music'), '수록곡'),
          h('p', { class: 'small muted' }, '손잡이를 끌거나 화살표를 눌러 순서를 바꿀 수 있어요.'),
          list)
        : emptyState('🎶', '앨범이 비어 있어요', '싱글을 추가해 보세요.', button('싱글 추가', { variant: 'primary', icon: 'plus', onClick: () => openAddTracksSheet(album.id) })),
    );

    unsortable = makeSortable(list, { itemSelector: '.album-track', handleSelector: '.track-handle', onReorder: (from, to) => move(from, to) });
  }

  let lastSig = '';
  const unsubs = [
    library.subscribe(render),
    player.subscribe((ps) => { const sig = `${ps.singleId}|${ps.playing}|${ps.context && ps.context.id}`; if (sig !== lastSig) { lastSig = sig; render(); } }),
  ];
  render();
  return () => { unsubs.forEach((u) => u()); if (unsortable) unsortable(); el.remove(); };
}
