// YouTube: safe URL parsing + the official IFrame Player API.
// No scraping, no media extraction — audio is only ever captured through user-authorised
// browser capture APIs.

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

const bareHost = (host) => host.toLowerCase().replace(/^www\./, '');

function isYouTubeHost(host) {
  const h = bareHost(host);
  return h === 'youtu.be'
    || h === 'youtube.com' || h.endsWith('.youtube.com')
    || h === 'youtube-nocookie.com' || h.endsWith('.youtube-nocookie.com');
}

/** "90" | "90s" | "1m30s" | "1h2m3s" -> seconds */
export function parseStartTime(value) {
  if (!value) return 0;
  const v = String(value).trim();
  if (/^\d+(\.\d+)?s?$/.test(v)) return Math.floor(parseFloat(v));
  const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(v);
  if (m && (m[1] || m[2] || m[3])) return (+m[1] || 0) * 3600 + (+m[2] || 0) * 60 + (+m[3] || 0);
  return 0;
}

/**
 * Parse a YouTube URL (or bare 11-char video id).
 * Returns { videoId, startSeconds, url } or null.
 */
export function parseYouTubeUrl(input, depth = 0) {
  if (typeof input !== 'string' || depth > 2) return null;
  let text = input.trim();
  if (!text || text.length > 2048) return null;
  if (ID_RE.test(text)) return { videoId: text, startSeconds: 0, url: `https://www.youtube.com/watch?v=${text}` };
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) text = `https://${text.replace(/^\/+/, '')}`;
  let url;
  try { url = new URL(text); } catch { return null; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
  if (!isYouTubeHost(url.hostname)) return null;

  const segments = url.pathname.split('/').filter(Boolean);
  let id = null;
  if (bareHost(url.hostname) === 'youtu.be') {
    id = segments[0] || null;
  } else if (segments[0] === 'watch') {
    id = url.searchParams.get('v');
  } else if (['embed', 'shorts', 'live', 'v', 'e'].includes(segments[0])) {
    id = segments[1] || null;
  } else if (segments[0] === 'attribution_link') {
    const inner = url.searchParams.get('u');
    if (inner) return parseYouTubeUrl(`https://www.youtube.com${inner.startsWith('/') ? '' : '/'}${inner}`, depth + 1);
  } else if (!segments.length && url.searchParams.get('v')) {
    id = url.searchParams.get('v');
  }
  if (!id || !ID_RE.test(id)) return null;

  let start = url.searchParams.get('t') || url.searchParams.get('start');
  if (!start && url.hash) {
    const hm = /(?:^#|&)t=([^&]+)/.exec(url.hash);
    if (hm) start = hm[1];
  }
  return { videoId: id, startSeconds: parseStartTime(start), url: `https://www.youtube.com/watch?v=${id}` };
}

/** Suggest title/artist from a video title like "Artist - Song (Official Video)". */
export function suggestMetadata(videoTitle = '', channel = '') {
  const clean = (s) => s
    .replace(/[([](?:official|lyric|lyrics|audio|video|mv|m\/v|hd|4k|visualizer|karaoke|instrumental|inst\.?|backing track|mr|with lyrics)[^)\]]*[)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const t = clean(videoTitle);
  const m = /^(.+?)\s+[-–—|]\s+(.+)$/.exec(t);
  if (m) return { originalArtist: m[1].trim(), title: m[2].trim() };
  const ch = String(channel || '').replace(/\s*-\s*Topic$/i, '').replace(/VEVO$/i, '').trim();
  return { originalArtist: ch, title: t };
}

// ------------------------------------------------------------------ IFrame API loader

let apiPromise = null;

export function loadYouTubeApi({ timeout = 15000 } = {}) {
  if (window.YT && typeof window.YT.Player === 'function') return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => fail(new Error('timeout')), timeout);
    function fail(err) {
      clearTimeout(timer);
      apiPromise = null;
      script.remove();
      reject(err);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      clearTimeout(timer);
      if (typeof prev === 'function') { try { prev(); } catch { /* ignore */ } }
      resolve(window.YT);
    };
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => fail(new Error('network'));
    document.head.append(script);
  });
  return apiPromise;
}

export const YT_STATE = { UNSTARTED: -1, ENDED: 0, PLAYING: 1, PAUSED: 2, BUFFERING: 3, CUED: 5 };

/** The video exists, but its owner doesn't allow it to play inside other sites (very common for music videos). */
export const isEmbedBlocked = (code) => code === 101 || code === 150;

export function youtubeErrorMessage(code) {
  switch (code) {
    case 2: return '유튜브 링크가 올바르지 않은 것 같아요 (잘못된 영상 ID).';
    case 5: return '이 영상은 삽입된 플레이어에서 재생할 수 없어요.';
    case 100: return '영상을 찾을 수 없어요 — 비공개이거나 삭제됐을 수 있어요.';
    case 101:
    case 150: return '영상 주인이 다른 사이트에서의 재생을 허용하지 않아요. 같은 노래의 다른 영상(예: MR/노래방 버전)을 써 보거나, 반주 파일을 올려 주세요.';
    case 152:
    case 153: return '유튜브가 이 페이지에서 플레이어를 불러오지 않았어요. 페이지를 새로 고친 뒤 다시 시도해 주세요.';
    case 'timeout': return '유튜브 플레이어를 불러오는 데 너무 오래 걸려요. 인터넷 연결을 확인하고 다시 시도해 주세요.';
    case 'network': return '유튜브 플레이어를 불러오지 못했어요. 인터넷 연결이나 광고 차단 프로그램을 확인해 주세요 — 아니면 반주 파일을 올려도 돼요.';
    default: return `유튜브 플레이어에서 오류가 났어요 (${code}).`;
  }
}

/** Thin wrapper around YT.Player with a load timeout and safe method calls. */
export class YouTubePlayer {
  constructor({ onReady, onState, onError } = {}) {
    this.handlers = { onReady, onState, onError };
    this.player = null;
    this.ready = false;
    this.loadToken = 0;
  }

  async load(host, videoId, { startSeconds = 0 } = {}) {
    this.destroy();
    const token = ++this.loadToken;
    let YT;
    try {
      YT = await loadYouTubeApi();
    } catch (err) {
      if (token === this.loadToken) this.handlers.onError?.({ code: err.message === 'timeout' ? 'timeout' : 'network' });
      return;
    }
    if (token !== this.loadToken || !host.isConnected) return;
    const target = document.createElement('div');
    host.replaceChildren(target);
    this.readyTimer = setTimeout(() => {
      if (token === this.loadToken && !this.ready) this.handlers.onError?.({ code: 'timeout' });
    }, 20000);
    this.player = new YT.Player(target, {
      videoId,
      width: '100%',
      height: '100%',
      playerVars: {
        playsinline: 1,
        rel: 0,
        start: Math.max(0, Math.floor(startSeconds)),
        enablejsapi: 1,
        origin: window.location.origin,
        iv_load_policy: 3,
      },
      events: {
        onReady: () => {
          if (token !== this.loadToken) return;
          clearTimeout(this.readyTimer);
          this.ready = true;
          this.handlers.onReady?.(this.info());
        },
        onStateChange: (e) => { if (token === this.loadToken) this.handlers.onState?.(e.data); },
        onError: (e) => {
          if (token !== this.loadToken) return;
          clearTimeout(this.readyTimer);
          this.handlers.onError?.({ code: e.data });
        },
      },
    });
  }

  info() {
    let data = {};
    try { data = (this.player && this.player.getVideoData && this.player.getVideoData()) || {}; } catch { /* ignore */ }
    return { title: data.title || '', author: data.author || '', duration: this.getDuration() };
  }

  call(method, ...args) {
    if (!this.player || !this.ready || typeof this.player[method] !== 'function') return undefined;
    try { return this.player[method](...args); } catch (err) {
      console.warn(`[youtube] ${method} failed`, err);
      return undefined;
    }
  }

  play() { this.call('playVideo'); }
  pause() { this.call('pauseVideo'); }
  seekTo(sec) { this.call('seekTo', Math.max(0, sec), true); }
  mute() { this.call('mute'); }
  unMute() { this.call('unMute'); }
  setVolume(v) { this.call('setVolume', v); }
  getState() { const s = this.call('getPlayerState'); return typeof s === 'number' ? s : YT_STATE.UNSTARTED; }
  getCurrentTime() { return Number(this.call('getCurrentTime')) || 0; }
  getDuration() { return Number(this.call('getDuration')) || 0; }

  destroy() {
    this.loadToken++;
    clearTimeout(this.readyTimer);
    if (this.player) {
      try { this.player.destroy(); } catch { /* ignore */ }
    }
    this.player = null;
    this.ready = false;
  }
}
