// Entry point of the 3D pet. The app (classic scripts) reaches it through FoxHost in
// js/pet.js — the same arrangement as the recording studio and CoverHost: the app owns the
// pets' state (which foxes are out, what they wear, where they live, how they feel), this
// side draws it.
import { World } from './world.js';

const host = window.FoxHost;
let world = null;
let broken = false;

/** The world is only built when it is first shown (it needs WebGL; without it the app keeps its plain card). */
function ensure() {
  if (!world && !broken) {
    try {
      world = new World(host);
      world.apply(host.look());
    } catch (err) {
      broken = true;
      world = null;
      console.error('[fox] could not start the 3D view', err);
      host.fail();
    }
  }
  return world;
}

host.register({
  mount(stage, opts) {
    const w = ensure();
    if (!w) return;
    w.apply(host.look());
    w.mount(stage, opts);
  },
  unmount: () => world && world.unmount(),
  /** The pets' state changed (or `look` is a preview from the shop). */
  sync: (look) => world && world.apply(look || host.look()),
  /** The weather as it is now (the app keeps the clock): { kind, level, wet … } — see js/weather.js. */
  weather: (sky) => world && world.setWeather(sky),
  /** A reaction; `id` = the fox it is about (otherwise the one she is with, or all of them). */
  act: (name, id) => world && world.act(name, id),
  say: (text, ms, id) => world && world.say(text, ms, world.byId(id)),
  hush: () => world && world.hush(),
  /** Lorelei turns to whoever is looking on, waves and says `line`. */
  owner: (line) => world && world.ownerHello(line),
  /** Lorelei would like a word: she comes forward, calls `line` and waits to be tapped (`bye`: what she says if she is not; `now`: whatever she is doing). → false if she cannot just now. */
  hail: (line, bye, now) => !!(world && world.hail(line, bye, now)),
  unhail: () => world && world.unhail(),
  /** Lorelei's present, a step of its story at a time: 'call', 'speak', 'show', 'give', 'open', 'end' — see World.present. */
  present: (step, arg) => world && world.present(step, arg),
  /** She slid the view away over the country: back to her fox. */
  lookBack: () => world && world.lookBack(),
  /**
   * The shop opened — on its foxes, outfits or habitats ('shop'), or on the yard ('yard') — or
   * closed (null). `inset` = how many pixels of the view it covers, { right } or { bottom }.
   */
  frame: (mode, inset) => world && world.setMode(mode, inset),
  /** Turn a thing in the yard an eighth of a turn; false if there is no room for that. */
  turnDecor: (id) => !!world && world.turnDecor(id),
  snapshot(kind, id, opts) {
    const w = ensure();
    return w ? w.snapshot(kind, id, opts) : '';
  },
  foxOnPage: (id) => (world ? world.foxOnPage(id) : null),
  /** A fox has a new id (a kit that grew up); the next sync() gives it its grown body. */
  rename: (from, to) => world && world.rename(from, to),
  /** Where the waiting letter is: 'none', 'box', 'fetching' or 'fox' — and which fox has it. */
  mail: () => (world ? world.mail : 'none'),
  courier: () => (world && world.letter ? world.letter.fox.id : null),
  /** Photo mode on or off; how the family should pose; the picture itself (a canvas). */
  photo: (on) => world && world.photo(on),
  pose: (name) => world && world.setPose(name),
  /** The photo booth's viewfinder ({ x, y, w, h } px of the view, or null): the family is framed in it, and a picture can be of just that. */
  finder: (rect) => world && world.setFinder(rect),
  capture: (long, rect) => (world ? world.capture(long, rect) : null),
});

// index.html?debug=1 — a handle for poking around in the console
if (new URLSearchParams(location.search).has('debug')) window.foxWorld = () => ensure();
