// My Covers — the saved singles and albums.
import { h } from '../core/dom.js';
import { navigate } from '../core/router.js';
import { formatTime, formatBytes } from '../core/util.js';
import { library } from '../library.js';
import { player, playSingle, toggle } from '../player.js';
import { button, iconButton, artworkEl, badge, segmented, emptyState, pageHead, SOURCE_INFO } from '../ui/common.js';
import { openAlbumForm } from '../ui/albumSheets.js';

export function singleRow(s, { onPlay } = {}) {
  const ps = player.get();
  const isCurrent = ps.singleId === s.id;
  const playing = isCurrent && ps.playing;
  return h('li', { class: `track-row${isCurrent ? ' is-current' : ''}` },
    h('button', { class: 'track-open', type: 'button', onClick: () => navigate(`/single/${s.id}`), 'aria-label': `${s.title || '싱글'} 열기` },
      artworkEl(s.artworkId, { size: 'sm', seed: s.title }),
      h('span', { class: 'track-text' },
        h('span', { class: 'track-title' }, s.title || '제목 없는 커버'),
        h('span', { class: 'track-sub' }, [s.coverArtist || s.originalArtist || '', formatTime(s.duration)].filter(Boolean).join(' · ')),
        h('span', { class: 'track-badges' },
          badge(SOURCE_INFO[s.sourceType] ? SOURCE_INFO[s.sourceType].label : '커버'),
          s.backingCaptured === false || s.voiceDetected === false ? badge('미완성', 'warn') : null))),
    iconButton(playing ? 'pause' : 'play', playing ? `${s.title} 일시정지` : `${s.title} 재생`, {
      variant: 'primary', cls: 'track-play',
      onClick: () => (isCurrent ? toggle() : (onPlay ? onPlay(s) : playSingle(s.id))),
    }));
}

export function mountMusic(root, params) {
  const tab = params.tab === 'albums' ? 'albums' : 'singles';
  const el = h('div', { class: 'cv screen music' });
  root.append(el);
  const storageLine = h('p', { class: 'small muted storage-line' });

  async function paintStorage() {
    try {
      if (!navigator.storage || !navigator.storage.estimate) return;
      const est = await navigator.storage.estimate();
      const persisted = navigator.storage.persisted ? await navigator.storage.persisted() : false;
      storageLine.textContent = `이 기기에서 ${formatBytes(est.usage || 0)} 사용 중${est.quota ? ` (이 사이트가 쓸 수 있는 약 ${formatBytes(est.quota)} 중)` : ''}.${persisted ? ' 저장 공간은 자동 정리로부터 보호되고 있어요.' : ''}`;
    } catch { /* optional */ }
  }

  function render() {
    const { singles, albums, loaded } = library.get();
    const tabs = segmented([
      { value: 'singles', label: `💿 싱글 (${singles.length})` },
      { value: 'albums', label: `📀 앨범 (${albums.length})` },
    ], tab, (v) => navigate(v === 'albums' ? '/music/albums' : '/music', { replace: true }), { ariaLabel: '라이브러리 구분' });

    let body;
    if (!loaded) body = h('p', { class: 'muted' }, '불러오는 중…');
    else if (tab === 'singles') {
      body = singles.length
        ? h('ul', { class: 'track-list' }, singles.map((s) => singleRow(s, { onPlay: (x) => playSingle(x.id, { queue: singles.map((q) => q.id) }) })))
        : h('div', { class: 'card' }, emptyState('💿', '아직 커버가 없어요', '노래를 녹음해서 싱글로 저장하면 진짜 발매곡처럼 여기에 나타나요.', button('노래 부르기', { variant: 'primary', icon: 'mic', onClick: () => navigate('/studio') })));
    } else {
      body = h('div', null,
        h('div', { class: 'row-wrap section-actions' }, button('새 앨범', { variant: 'primary', icon: 'plus', onClick: async () => { const a = await openAlbumForm(); if (a) navigate(`/album/${a.id}`); } })),
        albums.length
          ? h('div', { class: 'album-grid' }, albums.map((a) => h('button', { class: 'album-card', type: 'button', onClick: () => navigate(`/album/${a.id}`) },
            artworkEl(a.artworkId, { size: 'fill', seed: a.title, emoji: '💿' }),
            h('span', { class: 'album-title' }, a.title),
            h('span', { class: 'album-sub' }, [a.artist, `${a.trackIds.length} track${a.trackIds.length === 1 ? '' : 's'}`].filter(Boolean).join(' · ')))))
          : h('div', { class: 'card' }, emptyState('📀', '아직 앨범이 없어요', '싱글을 앨범으로 묶어 보세요. 앨범에 추가해도 싱글이 복사되지는 않아요.')));
    }
    const total = singles.reduce((sum, s) => sum + (s.duration || 0), 0);
    const sub = singles.length
      ? `커버 ${singles.length}곡 · 내 목소리 ${formatTime(total)}`
      : '나만의 작은 디스코그래피.';
    el.replaceChildren(pageHead('💿 내 커버', { sub }), tabs.el, body, storageLine);
  }

  const unsubs = [library.subscribe(render), player.subscribe((() => {
    let last = '';
    return (s) => { const sig = `${s.singleId}|${s.playing}`; if (sig !== last) { last = sig; render(); } };
  })())];
  render();
  paintStorage();
  return () => { unsubs.forEach((u) => u()); el.remove(); };
}
