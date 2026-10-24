'use strict';
/* ==================================================================
   🎤 Studio & 💿 covers — the bridge to the recording studio in
   js/cover/ (ES modules: capturing the song and the voice, mixing,
   singles & albums in IndexedDB "cover-studio").

   Those modules render the Studio, My Covers, single and album pages
   and the mini-player. This file gives the rest of the app what it
   needs from them:
     • CoverHost — mounts their views, forwards takes / releases /
       listens to the game, and lends them toasts & dialogs
     • Music     — a read-only list of the saved covers for Home, Me,
       achievements and challenges
   ================================================================== */

const CoverHost = {
  api: null, //     set by js/cover/host.js once the modules have loaded
  failed: false,
  lib: { singles: [], albums: [], loaded: false },
  pending: null, // a view waiting for the modules: { name, root, params }
  quiet: false, //  a take is being recorded — no UI sounds, no pet pop-ups
  pulling: false, // covers saved on another device are being added (js/cover/sync.js)
  fromSurprise: false,

  /* ----- views ----- */
  register(api) {
    this.api = api;
    const p = this.pending;
    this.pending = null;
    if (p && p.root.isConnected) api.mount(p.name, p.root, p.params);
  },

  fail() {
    this.failed = true;
    const p = this.pending;
    if (p && p.root.isConnected) p.root.innerHTML = this.failHtml();
  },

  failHtml() {
    return `<div class="card">${emptyState('😢', '스튜디오를 불러오지 못했어요', '인터넷 연결을 확인하고 페이지를 새로 고쳐 주세요. 녹음하려면 최신 브라우저(Chrome, Edge, Safari, Firefox)가 필요해요.')}</div>`;
  },

  mount(name, root, params) {
    if (this.api) this.api.mount(name, root, params);
    else if (this.failed) root.innerHTML = this.failHtml();
    else this.pending = { name, root, params };
  },

  unmount() {
    this.pending = null;
    if (this.api) this.api.unmount();
  },

  /* The modules replaced the URL without a hashchange (tabs inside My Covers). */
  rerender() {
    Router.render(true);
  },

  /* Why leaving for the view `name` isn't allowed right now (recording / saving), or null. */
  blockedReason(name) {
    return this.api ? this.api.blockedReason(name) : null;
  },

  /* ----- what the modules borrow from the app ----- */
  toast(message, type = 'info', ms) {
    UI.toast(message, { icon: { ok: '✅', warn: '⚠️', error: '😢', info: '✨' }[type] || '✨', ms: ms || (type === 'error' ? 4200 : 2800) });
  },

  confirm(o) {
    return UI.confirm(o);
  },

  setQuiet(on) {
    this.quiet = !!on;
    if (this.quiet) Radio.watch(this.player()); // (the radio goes off for the recording: js/radio.js)
  },

  /* ----- what the modules report ----- */
  /* The library changed. `saving` = a cover is being saved right now: onRelease() follows and celebrates it. */
  onLibrary(lib, saving) {
    const before = this.lib;
    this.lib = { singles: lib.singles || [], albums: lib.albums || [], loaded: !!lib.loaded };
    if (!this.lib.loaded || saving) return;
    // forget play counts & rare marks of covers that were deleted
    // (not before the server's covers have arrived: on a new device they are still on their way)
    if (!Sync.on || Sync.libraryReady) {
      const ids = new Set(this.lib.singles.map((s) => s.id));
      Object.keys(State.coverMeta).forEach((id) => {
        if (!ids.has(id)) delete State.coverMeta[id];
      });
    }
    // an album that arrived from another device was already celebrated there
    if (before.loaded && !this.pulling && this.lib.albums.length > before.albums.length) Game.onAlbum();
    else Game.checkAchievements();
    if (Router.is('home') || (Router.is('me') && !UI.stack.length)) Router.refresh();
  },

  onTake(take) {
    take.fromSurprise = this.fromSurprise;
    this.fromSurprise = false;
    Game.onTake(take);
  },

  onRelease(single) {
    Game.onRelease(Music.toCover(single));
  },

  onListen(id) {
    const meta = State.coverMeta[id] || (State.coverMeta[id] = {});
    meta.plays = (meta.plays || 0) + 1;
    Game.onListen();
  },

  onPlayer(p) {
    $$('[data-action="play-cover"]').forEach((b) => {
      const on = p.singleId === b.dataset.id && p.playing;
      b.classList.toggle('is-playing', on);
      const label = b.querySelector('[data-play-icon]');
      if (label) label.textContent = on ? '❚❚' : '▶';
    });
    FoxRoom.tune(p); // in the foxes' world it is shown over the view — and they dance to it
    Radio.watch(p); // …and the radio goes off when something else is put on (js/radio.js)
  },

  /* A cover has played to its end. */
  onEnded(id) {
    Radio.ended(id);
    LP.ended(id);
  },

  /* The album page: this album as a record, on the turntable (js/lp.js). */
  openLP(id) {
    LP.open(id);
  },
  lpPressed(id) {
    return LP.pressed(id);
  },

  /* ----- helpers for the app's own pages ----- */
  play(id, queue) {
    if (this.api) this.api.play(id, queue || null);
  },

  /* Play this cover (and after it the others of `queue`): if it was paused it goes on — it is never stopped by this. */
  start(id, queue) {
    if (this.api) this.api.start(id, queue || null);
  },

  stopAll() {
    if (this.api) this.api.stop();
  },

  /* What is in the player: { singleId, playing, time, duration, loading, error }. */
  player() {
    return this.api ? this.api.playerState() : { singleId: null, playing: false, time: 0, duration: 0 };
  },

  /* For the foxes, who dance to the covers: which one is playing ({ id, on }; on: false = paused), where it is (seconds), and its beat. */
  tune() {
    const p = this.player();
    return p.singleId ? { id: p.singleId, on: !!p.playing } : null;
  },
  clock() {
    return this.api ? this.api.clock() : 0;
  },
  beats(id) {
    return this.api ? this.api.beats(id) : null;
  },
  /* …and how fast it goes, and in what key: a promise (js/garden.js). */
  traits(id) {
    return this.api && this.api.traits ? this.api.traits(id).catch(() => null) : Promise.resolve(null);
  },

  /* Fill <span data-cover-art="<id>"> placeholders with the cover's artwork, and show which cover is playing. */
  hydrateArt(root) {
    if (!this.api) return;
    $$('[data-cover-art]', root).forEach((slot) => {
      if (slot.dataset.hydrated === '1') return;
      slot.dataset.hydrated = '1';
      slot.replaceChildren(this.api.artwork(slot.dataset.coverArt, { size: 'fill' }));
    });
    this.onPlayer(this.api.playerState());
  },
};
window.CoverHost = CoverHost;

/* ------------------------------------------------------------------
   The saved covers, as the game and the Home / Me pages see them.
   Each single of the library is one cover; covers with the same title
   and original artist count as the same song.
   ------------------------------------------------------------------ */
const Music = {
  toCover(s) {
    const meta = State.coverMeta[s.id] || {};
    const iso = new Date(s.createdAt).toISOString();
    const raw = s.recordingDuration || s.duration || 0;
    return {
      id: s.id,
      title: s.title || '제목 없는 커버',
      coverArtist: s.coverArtist || '',
      originalArtist: s.originalArtist || '',
      duration: s.duration || 0,
      rawDuration: raw,
      createdAt: iso,
      releasedAt: iso,
      sourceType: s.sourceType || '',
      songId: `${normTitle(s.title)}|${normTitle(s.originalArtist)}`,
      hasArtwork: !!s.artworkId,
      hasLyrics: !!(s.lyrics && s.lyrics.trim()),
      trimmed: (s.trimStart || 0) > 0.05 || (s.trimEnd || raw) < raw - 0.05,
      lateNight: isLateNightHour(new Date(s.createdAt)),
      plays: meta.plays || 0,
      rare: !!meta.rare,
    };
  },
  all() {
    return CoverHost.lib.singles.map((s) => this.toCover(s));
  },
  /* Newest first. Every saved single is a released cover. */
  released() {
    return this.all();
  },
  get(id) {
    const s = CoverHost.lib.singles.find((x) => x.id === id);
    return s ? this.toCover(s) : null;
  },
  songs() {
    const map = new Map();
    this.all().forEach((c) => {
      const so = map.get(c.songId) || { id: c.songId, title: c.title, originalArtist: c.originalArtist, covers: [] };
      so.covers.push(c);
      map.set(c.songId, so);
    });
    return Array.from(map.values());
  },
  takesOf(songId) {
    return this.all().filter((c) => c.songId === songId);
  },
  albums() {
    return CoverHost.lib.albums;
  },
  continueListening() {
    return this.all()[0] || null;
  },
};

/* ------------------------------------------------------------------
   Views — placeholders that the studio modules fill with live DOM.
   ------------------------------------------------------------------ */
function coverView(name, tab) {
  return {
    tab,
    live: true, // updates itself; Router.refresh() must not rebuild it (that would drop the mic)
    render: () => `<section class="cover-host"><div class="card cover-loading"><div class="spinner" aria-hidden="true"></div><p class="hint">불러오는 중…</p></div></section>`,
    mount(root, params) {
      if (name === 'studio' && document.body.classList.contains('late-night') && !State.statistics.lateNightVisit) {
        State.statistics.lateNightVisit = true;
        Store.save();
        Game.checkAchievements();
      }
      CoverHost.mount(name, $('.cover-host', root), params);
    },
    unmount: () => CoverHost.unmount(),
  };
}

Views.studio = coverView('studio', 'studio');
Views.covers = coverView('music', 'covers'); //   #/covers  ·  #/covers/albums
Views.single = coverView('single', 'covers'); //  #/single/<id>  ·  #/single/<id>/edit
Views.album = coverView('album', 'covers'); //    #/album/<id>

Object.assign(Actions, {
  'play-cover': (el) => CoverHost.play(el.dataset.id, el.dataset.queue ? el.dataset.queue.split(',') : null),
  'open-cover': (el) => Router.go(`#/single/${el.dataset.id}`),
});
