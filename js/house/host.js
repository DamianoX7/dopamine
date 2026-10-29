// Entry point of the house's 3D side. The app (classic scripts) reaches it through HouseHost
// in js/house.js, as it reaches the foxes through FoxHost: the app keeps what is hers (what
// stands where, which picture is in which frame, the record on the turntable), this side
// draws it and says what she did to it.
import { HouseWorld } from './world.js';

const host = window.HouseHost;
let world = null;
let broken = false;

/** The world is only built when it is first shown (it needs WebGL; without it the house says it cannot open here). */
function ensure() {
  if (!world && !broken) {
    try {
      world = new HouseWorld(host);
      world.apply(host.look());
    } catch (err) {
      broken = true;
      world = null;
      console.error('[house] could not start the 3D view', err);
      host.fail();
    }
  }
  return world;
}

host.register({
  mount(stage) {
    const w = ensure();
    if (!w) return;
    w.apply(host.look());
    w.mount(stage);
  },
  unmount: () => world && world.unmount(),
  /** What she has changed (or is trying out in the shop). */
  sync: (look) => world && world.apply(look || host.look()),
  /** The picture in a frame (an image or a canvas — or null: empty again). */
  photo: (uid, img) => world && world.setPhoto(uid, img),
  /** An album on a poster: { art (image), title, artist } — or null. */
  poster: (uid, v) => world && world.setPoster(uid, v),
  /** The record on the turntable: { disc (canvas of it: js/lp.js), art (its sleeve), playing, progress 0 … 1 } — or null. */
  record: (v) => world && world.setRecord(v),
  /** The colours of the records she has pressed, for their spines in the cabinet. */
  spines: (colors) => world && world.setSpines(colors),
  /** The last page of her diary (a canvas: js/diary.js), open on the desk. */
  page: (canvas) => world && world.setDiaryPage(canvas),
  /** Where something new could go — { x, z, r } or { wall, u, y } — or null if there is no room for it. */
  findSpot: (id) => (world ? world.findSpot(id) : null),
  /** …against a wall, its back to it (a kitchen) — or null. */
  findWallSpot: (id) => (world ? world.findWallSpot(id) : null),
  /** A quarter turn for a thing on the floor: its new place, or null if there is no room to turn it. */
  turn: (uid) => (world ? world.turn(uid) : null),
  /** Where a thing is on the screen (px of the stage), for the buttons that float by it. */
  onPage: (uid) => (world ? world.onPage(uid) : null),
  /** The camera: closer to a thing; back to how it was; how much of the view the shop covers ({ right } or { bottom }, px). */
  focus: (uid) => world && world.focus(uid),
  home: () => world && world.home(),
  inset: (o) => world && world.setInset(o),
  /** Lorelei: she comes round (and stays `stay` seconds), she goes; is she here? */
  arrive: (stay) => world && world.guest.arrive(stay),
  leave: (now) => world && world.guest.leave(now),
  guestHere: () => !!(world && world.guest.on),
  /** Something to eat (js/delivery.js): she has ordered it — out comes her phone; it is here — the courier comes to the door (→ false if
   *  he cannot now); is somebody at the door; is she busy with it (the courier at the door, or eating). */
  order: (o) => world && world.order(o),
  deliver: (o) => (world ? world.deliver(o) : false),
  doorBusy: () => !!(world && world.doorBusy()),
  eating: () => !!(world && world.stage && world.me.busyEating()),
  /** Out of the door (js/town.js): she goes out (→ false if she cannot now); where to on the street; is she in the middle
   *  of something there (what: 'till', 'eat', 'cafe', 'sing', 'home' — or null); at the store's till with what she has
   *  paid for, eating at its window, ordering at the café, singing at the karaoke (and its end), on a swing; a word from her. */
  goOut: () => !!(world && world.stage && world.goOut()),
  townGo: (place) => !!(world && world.where === 'town' && world.town.go(place)),
  townBusy: () => (world && world.where === 'town' ? world.town.busy : null),
  townCheckout: (items) => !!(world && world.where === 'town' && world.town.checkout(items)),
  townEatHere: (ids) => !!(world && world.where === 'town' && world.town.eatHere(ids)),
  townCafe: (o) => !!(world && world.where === 'town' && world.town.cafeOrder(o)),
  townSing: (song) => !!(world && world.where === 'town' && world.town.sing(song)),
  townSingEnd: () => world && world.town && world.town.singEnd(),
  townSwing: () => !!(world && world.where === 'town' && world.town.swingNow()),
  townSay: (line) => world && world.where === 'town' && world.town.me && world.town.me.say(line),
  /** The village bus (js/bus.js): she takes it to the foxes' village (→ false if she cannot now); the bus she has come
   *  home on comes along (once the ride's screen has gone); off it again at the kerb (the ride could not be). And straight
   *  out onto the street, on that bus: the house was opened by the ride. */
  townBus: () => !!(world && world.where === 'town' && world.town.busOut()),
  townBusIn: () => !!(world && world.where === 'town' && world.town.busIn()),
  townBusBack: () => world && world.where === 'town' && world.town.busBack(),
  arriveByBus: () => !!(world && world.stage && world.arriveByBus()),
  /** 뭉치, the white cat (js/cat.js): out on the street this time, at spot `i`, trusting her this much; a meow to be found by;
   *  how far it trusts her now; she goes to it, feeds it a churu, strokes it, takes it home — and, at home, strokes it. */
  townCat: (i, trust) => !!(world && world.where === 'town' && world.town.catAppear(i, trust)),
  townCatCall: () => world && world.where === 'town' && world.town.catCall(),
  townCatTrust: (n) => world && world.town && world.town.catTrustIs(n),
  townCatGo: () => !!(world && world.where === 'town' && world.town.catGo()),
  townCatFeed: () => !!(world && world.where === 'town' && world.town.catFeed()),
  townCatPet: () => !!(world && world.where === 'town' && world.town.catPet()),
  townCatAdopt: () => !!(world && world.where === 'town' && world.town.catAdopt()),
  catPet: () => !!(world && world.stage && world.where !== 'town' && world.catPet()),
  /** The kitchen: she cooks `recipe` (→ false: no kitchen), does a step's act, how hot and how done it is, the end of it;
   *  something out of the fridge to eat. */
  cookStart: (r) => !!(world && world.stage && world.me.cook(r)),
  cookAct: (act, item, n, step, final) => world && world.me.cooking && world.me.cooking.act(act, item, n, step, final),
  cookLevel: (heat, done) => world && world.me.cooking && world.me.cooking.level(heat, done),
  cookEnd: (r) => world && world.me.cooking && world.me.cooking.end(r),
  eatSnack: (id) => world && world.stage && world.me.eatSnack(id),
  /** Pictures for the shop: a thing on its own; a wallpaper's or a floor's swatch. */
  thumb: (id) => (ensure() ? world.thumb(id) : ''),
  swatch: (kind, id) => (ensure() ? world.swatch(kind, id) : ''),
  foodThumb: (id) => (ensure() ? world.foodThumb(id) : ''),
  ingThumb: (id) => (ensure() ? world.ingThumb(id) : ''),
  /** The room as it is now, a picture (a canvas). */
  capture: (long) => (world ? world.capture(long) : null),
});

// index.html?debug=1 — a handle for poking around in the console
if (new URLSearchParams(location.search).has('debug')) window.houseWorld = () => ensure();
