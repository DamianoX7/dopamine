// Done — the single is saved. Offer play / album / download / record again.
import { h } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { formatTime } from '../core/util.js';
import { getSingle } from '../library.js';
import { playSingle } from '../player.js';
import { downloadSingle } from '../download.js';
import { button, artworkEl, notice } from '../ui/common.js';
import { openAddToAlbumSheet } from '../ui/albumSheets.js';
import * as C from './controller.js';

export function createSavedStep(s0) {
  const single = getSingle(s0.savedSingleId);
  if (!single) {
    return { el: h('div', { class: 'step' }, notice('warn', '이 싱글을 찾을 수 없어요.'), button('새 커버', { variant: 'primary', onClick: () => C.newCover() })) };
  }
  const el = h('div', { class: 'step step-saved' },
    h('section', { class: 'card saved-card' },
      h('div', { class: 'saved-art' }, artworkEl(single.artworkId, { size: 'lg', seed: single.title, alt: `${single.title} artwork` })),
      h('div', { class: 'saved-text' },
        h('p', { class: 'saved-kicker' }, '🎉 내 커버에 저장했어요'),
        h('h2', { class: 'saved-title' }, single.title),
        h('p', { class: 'muted' }, [single.coverArtist, single.originalArtist ? `originally by ${single.originalArtist}` : ''].filter(Boolean).join(' · ')),
        h('p', { class: 'small muted' }, `${formatTime(single.duration)} · WAV`)),
      h('div', { class: 'saved-actions' },
        button('재생', { variant: 'primary', icon: 'play', onClick: () => playSingle(single.id) }),
        button('앨범에 추가', { variant: 'soft', icon: 'disc', onClick: () => openAddToAlbumSheet(single.id) }),
        button('내려받기', { variant: 'soft', icon: 'download', onClick: () => downloadSingle(single) }),
        button('싱글 열기', { variant: 'ghost', icon: 'forward', onClick: () => navigate(`/single/${single.id}`) }))),
    h('div', { class: 'step-actions' },
      button('이 노래 다시 녹음', { variant: 'soft', icon: 'mic', block: true, onClick: () => C.newCover({ sameSong: true }) }),
      button('새 노래 시작', { variant: 'ghost', icon: 'plus', block: true, onClick: () => C.newCover() })),
  );
  return { el };
}
