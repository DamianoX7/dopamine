// Single detail page.
import { h, setChildren } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { navigate } from '../core/router.js';
import { confirmDialog } from '../core/sheet.js';
import { toast } from '../core/toast.js';
import { formatTime, formatDate } from '../core/util.js';
import { MSG } from '../messages.js';
import { mimeLabel } from '../audio/mime.js';
import { library, getSingle, deleteSingle, albumsContaining } from '../library.js';
import { player, playSingle, toggle, refreshSingle } from '../player.js';
import { downloadSingle, shareSingle, canShareFiles, singleFilename } from '../download.js';
import { button, artworkEl, badge, notice, emptyState, SOURCE_INFO } from '../ui/common.js';
import { openAddToAlbumSheet } from '../ui/albumSheets.js';

export function mountSingle(root, { id }) {
  const el = h('div', { class: 'cv screen single' });
  root.append(el);

  function render() {
    const s = getSingle(id);
    if (!s) {
      el.replaceChildren(emptyState('🔍', '싱글을 찾을 수 없어요', library.get().loaded ? '삭제됐을 수 있어요.' : '불러오는 중…',
        button('내 커버로 가기', { variant: 'soft', onClick: () => navigate('/music') })));
      return;
    }
    const ps = player.get();
    const isCurrent = ps.singleId === s.id;
    const playing = isCurrent && ps.playing;
    const albums = albumsContaining(s.id);
    const incomplete = s.backingCaptured === false || s.voiceDetected === false;

    const del = async () => {
      const ok = await confirmDialog({
        title: '이 싱글을 삭제할까요?',
        message: `“${s.title}” 싱글과 그 녹음이 이 기기에서 삭제돼요.${albums.length ? ' 들어 있던 앨범에서도 빠져요.' : ''}`,
        confirmText: '삭제', danger: true,
      });
      if (!ok) return;
      refreshSingle(s.id, { deleted: true });
      await deleteSingle(s.id);
      toast('싱글을 삭제했어요');
      navigate('/music', { replace: true });
    };

    setChildren(el,
      h('button', { class: 'back-btn', type: 'button', onClick: () => (history.length > 1 ? history.back() : navigate('/music')) }, '‹ 뒤로'),
      h('section', { class: 'single-hero' },
        h('div', { class: 'single-hero-art' }, artworkEl(s.artworkId, { size: 'fill', seed: s.title, alt: `${s.title} artwork` })),
        h('div', { class: 'single-hero-text' },
          h('p', { class: 'kicker' }, '싱글'),
          h('h1', { class: 'single-title' }, s.title || '제목 없는 커버'),
          h('p', { class: 'single-artists' },
            s.coverArtist ? h('span', null, '커버 ', h('strong', null, s.coverArtist)) : null,
            s.coverArtist && s.originalArtist ? ' · ' : null,
            s.originalArtist ? h('span', null, '원곡 ', h('strong', null, s.originalArtist)) : null),
          h('p', { class: 'small muted' }, `${formatTime(s.duration)} · ${formatDate(s.createdAt)}`),
          h('div', { class: 'row-wrap' },
            badge(SOURCE_INFO[s.sourceType] ? SOURCE_INFO[s.sourceType].long : '커버'),
            incomplete ? badge(s.backingCaptured === false ? '목소리만 — 반주가 담기지 않았어요' : '목소리가 감지되지 않았어요', 'warn') : null))),
      h('div', { class: 'single-actions' },
        button(playing ? '일시정지' : '재생', { variant: 'primary', size: 'lg', icon: playing ? 'pause' : 'play', onClick: () => (isCurrent ? toggle() : playSingle(s.id)) }),
        button('편집', { variant: 'soft', icon: 'edit', onClick: () => navigate(`/single/${s.id}/edit`) }),
        button('앨범에 추가', { variant: 'soft', icon: 'disc', onClick: () => openAddToAlbumSheet(s.id) }),
        button('내려받기', { variant: 'soft', icon: 'download', onClick: () => downloadSingle(s), title: singleFilename(s) }),
        canShareFiles() ? button('공유', { variant: 'soft', icon: 'share', onClick: () => shareSingle(s) }) : null,
        button('삭제', { variant: 'danger', icon: 'trash', onClick: del })),
      incomplete ? notice('warn', s.backingCaptured === false ? MSG.backingMissing : MSG.voiceMissing, { title: '미완성 녹음' }) : null,
      s.description ? h('section', { class: 'card' }, h('p', { class: 'description' }, s.description)) : null,
      h('details', { class: 'card lyrics-details', open: !!s.lyrics && s.lyrics.length < 1200 },
        h('summary', { class: 'card-title' }, icon('lyrics'), '가사'),
        s.lyrics ? h('div', { class: 'lyrics-view' }, s.lyrics) : h('p', { class: 'muted' }, '저장된 가사가 없어요. 편집에서 추가해 보세요.')),
      albums.length ? h('section', { class: 'card' },
        h('h2', { class: 'card-title' }, icon('disc'), '수록 앨범'),
        h('div', { class: 'row-wrap' }, albums.map((a) => button(a.title, { variant: 'soft', size: 'sm', icon: 'disc', onClick: () => navigate(`/album/${a.id}`) })))) : null,
      h('details', { class: 'card' },
        h('summary', { class: 'card-title' }, icon('info'), '녹음 정보'),
        h('dl', { class: 'cv-kv' },
          h('dt', null, '녹음 방식'), h('dd', null, SOURCE_INFO[s.sourceType] ? SOURCE_INFO[s.sourceType].long : '—'),
          s.youtubeUrl ? [h('dt', null, '유튜브'), h('dd', null, h('a', { href: s.youtubeUrl, target: '_blank', rel: 'noopener noreferrer' }, s.youtubeUrl))] : null,
          s.backingFileName ? [h('dt', null, '반주 파일'), h('dd', null, s.backingFileName)] : null,
          s.sourceType !== 'speaker' ? [h('dt', null, '목소리 싱크'), h('dd', null, `${s.voiceSyncOffset} ms`)] : null,
          s.sourceType !== 'speaker' ? [h('dt', null, '반주 / 목소리'), h('dd', null, `${Math.round(s.backingVolume * 100)}% / ${Math.round(s.voiceVolume * 100)}%`)] : [h('dt', null, '음량'), h('dd', null, `${Math.round(s.voiceVolume * 100)}%`)],
          h('dt', null, '자르기'), h('dd', null, `${formatTime(s.trimStart, { tenths: true })} – ${formatTime(s.trimEnd, { tenths: true })} / 전체 ${formatTime(s.recordingDuration, { tenths: true })}`),
          h('dt', null, '저장된 파일'), h('dd', null, `${mimeLabel(s.mimeType)} · ${s.channels === 1 ? '모노' : '스테레오'} · ${s.sampleRate} Hz`),
          h('dt', null, '원본 녹음'), h('dd', null, mimeLabel(s.originalTakeMimeType))),
        h('div', { class: 'row-wrap' }, button('원본 녹음 내려받기', { variant: 'ghost', size: 'sm', icon: 'download', onClick: () => downloadSingle(s, { original: true }) })),
        h('p', { class: 'small muted' }, MSG.downloadRights)),
    );
  }

  let lastSig = '';
  const unsubs = [
    library.subscribe(render),
    player.subscribe((ps) => { const sig = `${ps.singleId}|${ps.playing}`; if (sig !== lastSig) { lastSig = sig; render(); } }),
  ];
  render();
  return () => { unsubs.forEach((u) => u()); el.remove(); };
}
