// Persistent bottom mini-player UI.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatTime } from '../core/util.js';
import { navigate } from '../core/router.js';
import { player, toggle, seek, next, prev, closePlayer } from '../player.js';
import { getSingle, library } from '../library.js';
import { artworkEl } from './common.js';

export function mountMiniPlayer(host) {
  const artSlot = h('div', { class: 'mini-art' });
  const titleEl = h('div', { class: 'mini-title' });
  const artistEl = h('div', { class: 'mini-artist' });
  const info = h('button', { class: 'mini-info', type: 'button', 'aria-label': '이 싱글 열기' }, artSlot, h('div', { class: 'mini-text' }, titleEl, artistEl));
  const playIcon = h('span', null, icon('play', { size: 22 }));
  const playBtn = h('button', { class: 'btn icon primary mini-toggle', type: 'button', 'aria-label': '재생' }, playIcon);
  const prevBtn = h('button', { class: 'btn icon ghost small', type: 'button', 'aria-label': '이전 곡' }, icon('prev', { size: 20 }));
  const nextBtn = h('button', { class: 'btn icon ghost small', type: 'button', 'aria-label': '다음 곡' }, icon('next', { size: 20 }));
  const closeBtn = h('button', { class: 'btn icon ghost small mini-close', type: 'button', 'aria-label': '플레이어 닫기' }, icon('x', { size: 18 }));
  const bar = h('input', { type: 'range', class: 'mini-seek', min: 0, max: 1000, step: 1, value: 0, 'aria-label': '재생 위치' });
  const time = h('span', { class: 'mini-time' }, '0:00');
  const err = h('div', { class: 'mini-error', role: 'alert' });

  const el = h('div', { class: 'cv mini-player', hidden: true },
    h('div', { class: 'mini-row' }, info, prevBtn, playBtn, nextBtn, closeBtn),
    h('div', { class: 'mini-row mini-row-2' }, bar, time),
    err,
  );
  host.append(el);

  let artFor = null;
  let seeking = false;

  info.addEventListener('click', () => {
    const id = player.get().singleId;
    if (id) navigate(`/single/${id}`);
  });
  playBtn.addEventListener('click', () => toggle());
  prevBtn.addEventListener('click', () => prev());
  nextBtn.addEventListener('click', () => next());
  closeBtn.addEventListener('click', () => closePlayer());
  bar.addEventListener('input', () => {
    seeking = true;
    const d = player.get().duration;
    if (d > 0) seek((Number(bar.value) / 1000) * d);
  });
  bar.addEventListener('change', () => { seeking = false; });

  function render(s) {
    const single = s.singleId ? getSingle(s.singleId) : null;
    el.hidden = !single;
    document.body.classList.toggle('has-mini', !!single);
    if (!single) return;
    if (artFor !== `${single.id}:${single.artworkId}`) {
      artFor = `${single.id}:${single.artworkId}`;
      artSlot.replaceChildren(artworkEl(single.artworkId, { size: 'xs', seed: single.title }));
    }
    titleEl.textContent = single.title || '제목 없는 커버';
    artistEl.textContent = single.coverArtist || single.originalArtist || '';
    playIcon.replaceChildren(icon(s.playing ? 'pause' : 'play', { size: 22 }));
    playBtn.setAttribute('aria-label', s.playing ? '일시정지' : '재생');
    playBtn.disabled = s.loading || !!s.error;
    const multi = s.queue.length > 1;
    prevBtn.hidden = !multi;
    nextBtn.hidden = !multi;
    nextBtn.disabled = s.index >= s.queue.length - 1;
    const d = s.duration || single.duration || 0;
    if (!seeking) {
      const v = d > 0 ? Math.round((s.time / d) * 1000) : 0;
      bar.value = String(v);
      bar.style.setProperty('--val', `${v / 10}%`);
    }
    time.textContent = `${formatTime(s.time)} / ${formatTime(d)}`;
    err.textContent = s.error || '';
    err.hidden = !s.error;
  }

  player.subscribe(render);
  library.subscribe(() => render(player.get()));
  render(player.get());
}
