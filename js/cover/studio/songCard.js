// GET READY, top of the screen — the optional song link. A YouTube link plays the song in the
// player on this page; a song that plays somewhere else (or an uploaded file) needs no link.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { toast } from '../core/toast.js';
import { confirmDialog } from '../core/sheet.js';
import { formatTime, timeAgo } from '../core/util.js';
import { MSG } from '../messages.js';
import { library } from '../library.js';
import { button, notice, spinner, badge } from '../ui/common.js';
import * as C from './controller.js';

export function createSongCard(s0) {
  const input = h('input', {
    class: 'input input-lg', type: 'url', inputMode: 'url', autocomplete: 'off', spellcheck: false,
    placeholder: '유튜브 링크를 붙여 넣으세요…', 'aria-label': '유튜브 링크', value: s0.yt.input,
  });
  const load = () => {
    C.setYouTubeInput(input.value.trim());
    C.loadYouTube();
  };
  input.addEventListener('input', () => C.setYouTubeInput(input.value));
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); load(); } });

  const pasteBtn = navigator.clipboard && typeof navigator.clipboard.readText === 'function'
    ? button('붙여넣기', {
      icon: 'paste', variant: 'soft',
      onClick: async () => {
        try {
          const text = (await navigator.clipboard.readText()).trim();
          if (!text) { toast('클립보드가 비어 있어요.'); return; }
          input.value = text;
          load();
        } catch {
          input.focus();
          toast('입력란에 링크를 붙여 넣어 주세요 (길게 누르기 → 붙여넣기).');
        }
      },
    })
    : null;
  const loadBtn = button('불러오기', { variant: 'primary', onClick: load });
  const status = h('div', { class: 'yt-status', 'aria-live': 'polite' });
  const draftSlot = h('div', { class: 'draft-slot' });

  const el = h('div', { class: 'song-side' },
    draftSlot,
    h('section', { class: 'card song-card' },
      h('h2', { class: 'card-title' }, icon('link'), '부를 노래', badge('선택')),
      h('p', { class: 'muted' }, '유튜브 링크를 붙여 넣으면 여기서 바로 따라 부를 수 있어요 — 노래방(MR) 버전이 가장 좋아요. 노래를 다른 곳에서 틀거나 반주 파일을 올릴 거라면 링크는 없어도 돼요.'),
      h('div', { class: 'url-row' }, input, h('div', { class: 'url-btns' }, pasteBtn, loadBtn)),
      status,
      h('p', { class: 'small muted' }, 'youtube.com/watch?v=…, youtu.be/…, Shorts, 라이브, music.youtube.com 링크를 쓸 수 있어요. 영상은 유튜브 공식 플레이어로 재생돼요.'),
    ),
  );

  const openOnYouTube = () => {
    const url = C.youtubeWatchUrl();
    if (url) window.open(url, '_blank', 'noopener');
    C.selectMode('tab'); // the tab that just opened is recorded with Desktop Audio → Another tab
  };
  const removeBtn = () => button('링크 지우기', {
    size: 'sm', variant: 'ghost', icon: 'x',
    onClick: () => { C.clearYouTube(); input.value = ''; },
  });

  let lastSig = '';
  function update(s) {
    const d = library.get().draft;
    const sig = `${s.yt.status}|${s.yt.errorCode}|${s.yt.error}|${s.yt.title}|${d ? d.updatedAt : ''}|${!!s.draft}|${s.caps.displayAudio}`;
    if (document.activeElement !== input && input.value !== s.yt.input) input.value = s.yt.input;
    if (sig === lastSig) return;
    lastSig = sig;

    status.replaceChildren();
    if (s.yt.status === 'loading') status.append(spinner('유튜브 플레이어를 불러오는 중…'));
    else if (s.yt.status === 'ready') {
      status.append(notice('ok', s.yt.title ? `불러옴: ${s.yt.title}` : '영상을 불러왔어요. 준비 완료!', { actions: [removeBtn()] }));
    } else if (s.yt.status === 'invalid') status.append(notice('error', s.yt.error));
    else if (C.embedBlocked(s)) {
      const desktop = s.caps.displayAudio === 'likely';
      status.append(notice('warn', desktop ? MSG.embedBlockedDesktop : MSG.embedBlockedOther, {
        title: MSG.embedBlockedTitle,
        actions: [
          desktop ? button('유튜브에서 열기', { size: 'sm', variant: 'primary', icon: 'forward', onClick: openOnYouTube }) : null,
          removeBtn(),
        ],
      }));
    } else if (s.yt.status === 'error') {
      status.append(notice('error', s.yt.error, {
        actions: [
          button('다시 시도', { size: 'sm', variant: 'soft', onClick: () => C.loadYouTube() }),
          removeBtn(),
        ],
      }));
    }

    draftSlot.replaceChildren();
    if (d && !s.draft) {
      draftSlot.append(notice('info', `${timeAgo(d.createdAt)}에 녹음하고 저장하지 않은 녹음이 있어요 (${formatTime(d.duration)}). 새로 녹음하면 그 녹음은 사라져요.`, {
        title: '저장하지 않은 녹음',
        actions: [
          button('그 녹음 이어서 하기', { size: 'sm', variant: 'primary', onClick: () => C.resumeDraft() }),
          button('버리기', {
            size: 'sm', variant: 'ghost',
            onClick: async () => {
              const ok = await confirmDialog({ title: '저장하지 않은 녹음을 버릴까요?', message: '그 녹음이 이 기기에서 삭제돼요.', confirmText: '버리기', danger: true });
              if (ok) await C.discardSavedDraft();
            },
          }),
        ],
      }));
    }
  }

  const unsub = library.subscribe(() => update(C.studio.get()));
  update(s0);
  return { el, update, destroy: unsub };
}
