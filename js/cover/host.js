// Entry point of the recording studio and the covers library inside Dopamine World.
// The app shell (classic scripts: ui.js, game.js …) stays in charge of routing, rewards and
// overlays; it reaches these modules through CoverHost (js/cover-host.js), and they report
// takes, saved covers and listens back to it.
import { openDB } from './core/db.js';
import { blockedReason } from './core/router.js';
import { closeAllSheets } from './core/sheet.js';
import { debounce } from './core/util.js';
import { library, loadLibrary, collectGarbage, getSingle } from './library.js';
import { syncLibrary } from './sync.js';
import { player, playSingle, toggle, closePlayer, clock } from './player.js';
import { beatsOf } from './audio/beat.js';
import { mountMiniPlayer } from './ui/miniPlayer.js';
import { artworkEl } from './ui/common.js';
import { mountStudio } from './studio/view.js';
import * as studioController from './studio/controller.js';
import { mountMusic } from './views/music.js';
import { mountSingle } from './views/single.js';
import { mountAlbum } from './views/album.js';
import { mountEditSingle } from './views/editSingle.js';

const { studio, newCover } = studioController;
const host = window.CoverHost;
const bootTime = Date.now();

// ------------------------------------------------------------------ views

const MOUNTS = {
  studio: (root) => mountStudio(root),
  music: (root, params) => mountMusic(root, { tab: params[0] === 'albums' ? 'albums' : 'singles' }),
  single: (root, params) => (params[1] === 'edit' ? mountEditSingle(root, { id: params[0] }) : mountSingle(root, { id: params[0] })),
  album: (root, params) => mountAlbum(root, { id: params[0] }),
};
let unmountView = null;

function unmount() {
  closeAllSheets();
  if (!unmountView) return;
  try { unmountView(); } catch (err) { console.error('[cover] unmount failed', err); }
  unmountView = null;
}

function mount(name, root, params = []) {
  unmount();
  root.replaceChildren();
  unmountView = MOUNTS[name](root, params) || null;
}

// ------------------------------------------------------------------ events for the game

// A take counts when a recording has just been processed (not when an old draft is reopened);
// a release counts when a single has just been saved.
let lastStudioState = studio.get().state;
studio.subscribe((s) => {
  const prev = lastStudioState;
  lastStudioState = s.state;
  host.setQuiet(s.state === 'recording' || s.state === 'stopping' || s.starting);
  if (prev === s.state) return;
  if (prev === 'processing' && s.state === 'review' && s.draft) host.onTake({ rawDuration: s.draft.duration, mode: s.draft.mode });
  if (prev === 'saving' && s.state === 'saved') {
    const single = getSingle(s.savedSingleId);
    if (single) host.onRelease(single);
  }
});

// While a cover is being saved the library changes in several steps; the game hears about it
// once, through onRelease().
library.subscribe((lib) => host.onLibrary(lib, studio.get().state === 'saving'));

// Every change to the library goes to the server soon after — once a take in progress is done.
const syncSoon = debounce(() => {
  if (['recording', 'stopping', 'processing', 'saving'].includes(studio.get().state)) syncSoon();
  else syncLibrary();
}, 2500);
library.subscribe(syncSoon);

// One listen per time a cover is started (pausing and resuming doesn't count again).
let listenedTo = null;
player.subscribe((p) => {
  if (!p.singleId || (!p.playing && p.time === 0)) listenedTo = null;
  if (p.playing && listenedTo !== p.singleId) {
    listenedTo = p.singleId;
    host.onListen(p.singleId);
  }
  host.onPlayer(p);
});

// ------------------------------------------------------------------ boot

async function boot() {
  try {
    await openDB();
  } catch (err) {
    console.warn('[cover] storage unavailable', err);
  }
  await loadLibrary();
  collectGarbage({ olderThan: bootTime }).catch((err) => console.warn('[cover] cleanup skipped', err));
  mountMiniPlayer(document.getElementById('mini'));
  host.register({
    mount,
    unmount,
    blockedReason,
    studioState: () => studio.get(),
    /** Home's big SING button: a finished session makes room for a new cover. */
    startCover: () => { if (studio.get().state === 'saved') newCover(); },
    play: (id, queue = null) => {
      const p = player.get();
      if (p.singleId === id) toggle();
      else playSingle(id, { queue });
    },
    /** Play this one (from where it was, if it is the one in the player) — never pause it. */
    start: (id, queue = null) => playSingle(id, { queue }),
    stop: () => closePlayer(),
    playerState: () => player.get(),
    /** For the foxes, who dance to the covers: where the one that is playing is (seconds), and its beat once that is known. */
    clock,
    beats: (id) => beatsOf(id),
    artwork: (id, opts) => {
      const s = getSingle(id);
      return artworkEl(s ? s.artworkId : null, { seed: s ? s.title : '', ...opts });
    },
  });
  host.onLibrary(library.get(), false);
  syncLibrary();
  // index.html?debug=1 — handles for tests and for poking around in the console
  if (new URLSearchParams(location.search).has('debug')) window.coverStudio = { studio: studioController, library, player };
}

boot().catch((err) => {
  console.error('[cover] could not start', err);
  host.fail();
});
