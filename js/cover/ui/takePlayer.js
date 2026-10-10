// Player for the actual recorded file (the MediaRecorder Blob) — no placeholder audio.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatTime } from '../core/util.js';
import { canPlay, mimeLabel } from '../audio/mime.js';
import { claimAudioFocus, releaseAudioFocus } from '../core/audioFocus.js';
import { iconButton, notice, mediaVolumeSettable } from './common.js';
import { MSG } from '../messages.js';

export function createTakePlayer({ blob, mimeType, knownDuration = 0 }) {
  const type = mimeType || blob.type;
  const playable = canPlay(type) !== '';
  const audio = new Audio();
  audio.preload = 'auto';
  const url = URL.createObjectURL(blob);
  let duration = knownDuration || 0;
  let fixingDuration = false;
  let destroyed = false;

  const playIcon = h('span', { class: 'play-icon' }, icon('play', { size: 26 }));
  const playBtn = h('button', { class: 'btn primary round', type: 'button', 'aria-label': '재생' }, playIcon);
  const restartBtn = iconButton('restart', '처음부터 다시', { variant: 'soft' });
  const timeEl = h('span', { class: 'time-now' }, '0:00');
  const durEl = h('span', { class: 'time-total' }, formatTime(duration));
  const seek = h('input', { type: 'range', class: 'range-thin', min: 0, max: 1000, step: 1, value: 0, 'aria-label': '재생 위치' });
  const volWrap = h('div', { class: 'take-volume' });
  const status = h('div', { class: 'take-status' });

  if (mediaVolumeSettable()) {
    const vol = h('input', { type: 'range', class: 'range-thin', min: 0, max: 100, step: 1, value: 100, 'aria-label': '재생 음량' });
    vol.style.setProperty('--val', '100%');
    vol.addEventListener('input', () => {
      audio.volume = Number(vol.value) / 100;
      vol.style.setProperty('--val', `${vol.value}%`);
    });
    volWrap.append(icon('volume', { size: 18 }), vol);
  } else {
    volWrap.append(icon('volume', { size: 18 }), h('span', { class: 'muted small' }, '기기의 음량 버튼을 이용해 주세요'));
  }

  const el = h('div', { class: 'take-player' },
    h('div', { class: 'take-row' }, playBtn,
      h('div', { class: 'take-main' },
        seek,
        h('div', { class: 'take-times' }, timeEl, h('span', { class: 'muted' }, ' / '), durEl))),
    h('div', { class: 'take-row take-row-2' }, restartBtn, volWrap),
    h('div', { class: 'take-meta small muted' }, `${mimeLabel(type)} 형식으로 녹음됨 · ${(blob.size / (1024 * 1024)).toFixed(1)} MB`),
    status,
  );

  if (!playable) {
    status.append(notice('warn', `${MSG.playbackUnsupported(type)} 그래도 아래에서 믹스하고, 자르고, 커버를 저장할 수 있어요 — 저장된 싱글은 어디서나 재생되는 WAV 파일이에요.`));
    playBtn.disabled = true;
    restartBtn.disabled = true;
    seek.disabled = true;
  }

  const owner = { pause: () => audio.pause() };

  function setDuration(d) {
    if (Number.isFinite(d) && d > 0) {
      duration = d;
      durEl.textContent = formatTime(d);
    }
  }

  function paint() {
    const t = audio.currentTime || 0;
    timeEl.textContent = formatTime(t);
    const v = duration > 0 ? Math.min(1000, Math.round((t / duration) * 1000)) : 0;
    seek.value = String(v);
    seek.style.setProperty('--val', `${v / 10}%`);
  }

  audio.addEventListener('loadedmetadata', () => {
    // Chrome's MediaRecorder WebM files have no duration header: seek far to make the
    // browser compute it, then come back to the start.
    if (!Number.isFinite(audio.duration)) {
      fixingDuration = true;
      try { audio.currentTime = 1e7; } catch { fixingDuration = false; }
    } else {
      setDuration(audio.duration);
    }
  });
  audio.addEventListener('durationchange', () => {
    if (Number.isFinite(audio.duration)) {
      setDuration(audio.duration);
      if (fixingDuration) {
        fixingDuration = false;
        try { audio.currentTime = 0; } catch { /* ignore */ }
      }
    }
  });
  audio.addEventListener('timeupdate', () => { if (!fixingDuration) paint(); });
  audio.addEventListener('play', () => { playIcon.replaceChildren(icon('pause', { size: 26 })); playBtn.setAttribute('aria-label', '일시정지'); });
  audio.addEventListener('pause', () => { playIcon.replaceChildren(icon('play', { size: 26 })); playBtn.setAttribute('aria-label', '재생'); });
  audio.addEventListener('ended', () => { releaseAudioFocus(owner); paint(); });
  audio.addEventListener('error', () => {
    if (destroyed || !playable) return;
    status.replaceChildren(notice('warn', `${MSG.playbackUnsupported(type)} 그래도 아래에서 믹스하고, 자르고, 커버를 저장할 수 있어요.`));
    playBtn.disabled = true;
  });

  playBtn.addEventListener('click', () => {
    if (audio.paused) {
      claimAudioFocus(owner);
      const p = audio.play();
      if (p && p.catch) p.catch((err) => { if (err && err.name !== 'AbortError') console.warn('[take] play failed', err); });
    } else {
      audio.pause();
    }
  });
  restartBtn.addEventListener('click', () => {
    try { audio.currentTime = 0; } catch { /* ignore */ }
    paint();
    if (audio.paused) {
      claimAudioFocus(owner);
      audio.play().catch(() => {});
    }
  });
  seek.addEventListener('input', () => {
    if (duration > 0) {
      try { audio.currentTime = (Number(seek.value) / 1000) * duration; } catch { /* ignore */ }
      paint();
    }
  });

  if (playable) audio.src = url;

  return {
    el,
    pause: () => audio.pause(),
    destroy() {
      destroyed = true;
      audio.pause();
      releaseAudioFocus(owner);
      audio.removeAttribute('src');
      audio.load();
      URL.revokeObjectURL(url);
    },
  };
}
