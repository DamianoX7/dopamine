// 우리 동네 — the street round the corner, on the same screen as the house (world.js shows one or the other). The
// girl who lives in the house (resident.js) comes out of her front door into it, and goes where she is sent: to the
// convenience store (she browses, pays at the till — "봉투 필요하세요?" — and eats at the window, or takes it home), the
// café (she orders, the coffee is made, she drinks it at a little table), the coin karaoke (she sings one of her own
// covers in a booth, the disco ball turning; a score comes up at the end), the park (the swings, the bench, the
// pigeons), and home again. Left to herself she strolls, sits, looks at things. The camera goes with her; a finger
// turns the street round, two bring it closer; a tap on the ground sends her there, a tap on a shop takes her in.
//
// Its light is the hour's, as the house's is: the real sun across the street (and its shadows), the evening, the night
// with the lamps lit and the shops' windows bright — and Incheon's weather: rain, snow; the trees as the year has them.
//
// The town is the "world" the people in it see (person.js): it has their time, their camera, their way about (grid.js)
// and the bubbles they speak in (the house's). What they do here that they do nowhere else is ownTask() below.
import * as THREE from '../vendor/three.module.min.js';
import { FUR_SUN } from '../fox/rig.js';
import { softDotTexture, disposeTree } from '../fox/kit.js';
import { buildTown, BOARD, SEASON_COLORS, TOWN_PARK } from './townmap.js';
import { Townie } from './townfolk.js';
import { Fx } from './fx.js';
import { V } from './shapes.js';
import { makeFood } from './food.js';
import { pose } from './person.js';
import { Bus, BUS } from './bus.js';

const FOV = 38;
const YAW = -0.3; //        where the camera looks from at first: in front, a little to the left…
const YAW_TALL = -0.22; //  (…on a screen held upright, the street's length up it)
const PITCH = 0.95;
const PITCH_MIN = 0.32;
const PITCH_MAX = 1.36;
const DIST = 15; //         (how far away the camera is at zoom 1 — on a screen held upright, further: it is narrow)
const DIST_TALL = 21;
const ZOOM0 = 1;
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 1.8;
const TAP = 9;
const WALK_OUT = 0.86; //   (out of doors she walks a little brisker than about the house)
// the village bus (bus.js): how fast it goes along the street, how hard it brakes for the stop and pulls away from it;
// how far it has gone again when the ride begins (js/bus.js: the screen of the ride covers the street)
const BUS_TOP = 5.2;
const BUS_BRAKE = 2.4;
const BUS_PULL = 2.3;
const BUS_AWAY = 6.5;
const _v = V();
const _w = V();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _ground = new THREE.Plane(V(0, 1, 0), 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (k) => k * k * (3 - 2 * k);

/* Rain, or snow: streaks or flakes falling round where the camera looks. */
class Weather {
  constructor(scene) {
    const N = 900;
    this.N = N;
    const pos = new Float32Array(N * 6);
    this.rain = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.55 }));
    this.rain.geometry.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.rain.frustumCulled = false;
    this.rain.visible = false;
    const sp = new Float32Array(N * 3);
    this.snow = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: softDotTexture(), color: '#ffffff', size: 0.13, transparent: true, depthWrite: false, opacity: 0.95 }));
    this.snow.geometry.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.snow.frustumCulled = false;
    this.snow.visible = false;
    this.drops = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 18, y: Math.random() * 7, z: (Math.random() - 0.5) * 18, s: 0.7 + Math.random() * 0.6 }));
    scene.add(this.rain, this.snow);
    this.kind = 'clear';
    this.level = 0;
  }

  set(kind, level) {
    this.kind = kind;
    this.level = kind === 'rain' || kind === 'snow' ? Math.max(0.35, level || 0) : 0;
    this.rain.visible = kind === 'rain';
    this.snow.visible = kind === 'snow';
  }

  update(dt, at) {
    if (!this.level) return;
    const n = Math.floor(this.N * this.level);
    const rain = this.kind === 'rain';
    const arr = (rain ? this.rain : this.snow).geometry.attributes.position.array;
    for (let i = 0; i < this.N; i++) {
      const d = this.drops[i];
      d.y -= dt * (rain ? 9 * d.s : 0.8 * d.s);
      if (!rain) d.x += Math.sin(d.y * 1.7 + i) * dt * 0.3;
      if (d.y < 0) {
        d.y += 7;
        d.x = (Math.random() - 0.5) * 18;
        d.z = (Math.random() - 0.5) * 18;
      }
      const x = at.x + d.x;
      const z = at.z + d.z;
      const hide = i >= n ? -50 : 0;
      if (rain) {
        arr.set([x, d.y + hide, z, x + 0.02, d.y + 0.32 + hide, z], i * 6);
      } else arr.set([x, d.y + hide, z], i * 3);
    }
    (rain ? this.rain : this.snow).geometry.attributes.position.needsUpdate = true;
  }
}

/* Leaves coming down off the trees in the autumn — petals off the cherry trees in the spring. */
class Falling {
  constructor(scene, trees) {
    this.trees = trees;
    const N = 70;
    this.N = N;
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    this.points = new THREE.Points(this.geo, new THREE.PointsMaterial({ map: softDotTexture(), size: 0.08, vertexColors: true, transparent: true, depthWrite: false }));
    this.points.frustumCulled = false;
    this.points.visible = false;
    scene.add(this.points);
    this.parts = [];
    this.season = '';
  }

  set(season) {
    if (season === this.season) return;
    this.season = season;
    const from = season === 'autumn' ? this.trees.filter((t) => t.kind !== 'cherry') : season === 'spring' ? this.trees.filter((t) => t.kind === 'cherry') : [];
    this.points.visible = from.length > 0;
    this.from = from;
    const col = this.geo.attributes.color.array;
    this.parts = Array.from({ length: this.N }, (_, i) => {
      const t = from[i % Math.max(1, from.length)];
      const c = new THREE.Color(season === 'spring' ? (i % 3 ? '#ffd0e0' : '#ffffff') : t && t.kind === 'ginkgo' ? '#ffd23f' : i % 2 ? '#ef5a32' : '#f2a03a');
      col.set([c.r, c.g, c.b], i * 3);
      return { t, y: Math.random(), ph: Math.random() * 6, r: Math.random() };
    });
    this.geo.attributes.color.needsUpdate = true;
  }

  update(dt, time) {
    if (!this.points.visible) return;
    const pos = this.geo.attributes.position.array;
    this.parts.forEach((p, i) => {
      if (!p.t) return;
      p.y -= dt * 0.12;
      if (p.y < 0) {
        p.y = 1;
        p.r = Math.random();
      }
      const top = p.t.top;
      const a = p.r * 6.28;
      const rad = 0.3 + p.r * 0.7;
      pos.set([p.t.x + Math.cos(a) * rad + Math.sin(time * 1.3 + p.ph) * 0.25 * (1 - p.y), p.y * top, p.t.z + Math.sin(a) * rad + Math.cos(time + p.ph) * 0.2 * (1 - p.y)], i * 3);
    });
    this.geo.attributes.position.needsUpdate = true;
  }
}

export class Town {
  constructor(world) {
    this.world = world;
    this.host = world.host;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#ffe6f0');
    scene.environment = world.scene.environment;
    scene.environmentIntensity = 0.5;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.3, 120);
    this.view = { yaw: YAW, pitch: PITCH, zoom: ZOOM0, target: V(0, 0.6, 0) };
    this.cam = { yaw: YAW, pitch: PITCH, zoom: ZOOM0, target: V(0, 0.6, 0) };
    this.follow = 0; // (she has moved the view herself: it stays where she put it this long)

    // the light: as the house's — the sky's, the sun's (with its shadows), four lamps, a spotlight (unlit) — so that what
    // the two share is drawn the same way in both
    this.hemi = new THREE.HemisphereLight('#fff7ee', '#c9d8b0', 1.2);
    this.sun = new THREE.DirectionalLight('#fffaf0', 1.8);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(world.coarse ? 1536 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    scene.add(this.hemi, this.sun, this.sun.target);
    this.lamps = [];
    for (let i = 0; i < 4; i++) {
      const l = new THREE.PointLight('#ffc98a', 0, 6, 1.4);
      scene.add(l);
      this.lamps.push(l);
    }
    this.spot = new THREE.SpotLight('#ffffff', 0, 6, 0.4, 0.4, 1);
    this.spot.castShadow = true;
    this.spot.shadow.autoUpdate = false;
    scene.add(this.spot, this.spot.target);

    const map = (this.map = buildTown());
    scene.add(map.group);
    this.places = map.places;
    this.grid = map.grid;
    this.fx = new Fx(scene);
    this.weather = new Weather(scene);
    this.falling = new Falling(scene, map.trees);
    this.clerk = new Townie(this, 'clerk', this.places.store.clerk);
    this.barista = new Townie(this, 'barista', this.places.cafe.barista);
    this.me = null; //          the girl, while she is out (resident.js)
    this.place = 'street'; //   where she has been sent: 'street', 'store', 'cafe', 'karaoke', 'park', 'home'
    this.busy = null; //        what is going on that she must not be taken from (paying, eating, singing…)
    this.homeDoor = 0;
    this.homeWant = 0;
    this.karaokeOpen = false;
    this.singing = null; //     { id, title, t, beat } — at the karaoke
    this.lit = { dark: 0 };
    this.pointer = { down: false };
    this.fingers = new Map();
    this.pinch = null;
    // (what the people in it need of a world: person.js)
    this.room = { openDoor: () => {} };
    this.guest = { on: false, going: false, task: null, tasks: [], pos: V() };
    this.bubbles = world.bubbles;
    // what can be tapped: the shops, her house, the swings, the scooter… (marked when the town was built)
    this.tapTargets = [];
    map.group.traverse((o) => {
      if (o.isMesh && o.userData.tap) this.tapTargets.push(o);
    });
    // what can stand between the camera and her: her cottage, the trees, the bus stop's roof — it fades while it does
    this.fadeables = [map.home.group, ...map.trees.map((t) => t.group), map.stop.roof].map((group) => {
      const mats = new Set();
      const meshes = [];
      group.traverse((o) => {
        if (!o.isMesh) return;
        meshes.push(o);
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => mats.add(m));
      });
      mats.forEach((m) => (m.userData.opacity0 = m.transparent ? m.opacity : 1));
      return { group, meshes, mats: [...mats], k: 1, want: 1 };
    });
    // the karaoke's roof, while it is shut (it would show its booths from above)
    const k = map.shops.karaoke;
    this.karaokeRoof = new THREE.Mesh(new THREE.BoxGeometry(3.6 + 0.3, 0.12, 3.8 + 0.3), new THREE.MeshStandardMaterial({ color: '#2b2446', roughness: 0.8 }));
    this.karaokeRoof.position.set(k.at.x, 2.36, k.at.z);
    this.karaokeRoof.castShadow = this.karaokeRoof.receiveShadow = true;
    this.karaokeRoof.userData.tap = 'karaoke';
    scene.add(this.karaokeRoof);
    this.tapTargets.push(this.karaokeRoof);
    // the village bus to the foxes: off the board until it is wanted (see coach)
    this.bus = new Bus();
    scene.add(this.bus.group);
    this.bus.group.traverse((o) => o.isMesh && this.tapTargets.push(o));
    this.coach = null; // …on its way: { phase: 'hold' | 'come' | 'stop' | 'go' | 'gone', x, v, door, t, to: 'fox' | 'town', boarded, off }
    this.busLook = V(); // (where she looks while it comes)
  }

  get time() {
    return this.world.time;
  }

  get coarse() {
    return this.world.coarse;
  }

  // ---------------------------------------------------------------- what the people in it ask of it (person.js)

  say(text, ms, who) {
    this.world.say(text, ms, who);
  }

  hush(who) {
    this.world.hush(who);
  }

  path(from, to) {
    return this.grid.path(from, to);
  }

  musicOn() {
    return !!this.singing;
  }

  beat() {
    return this.world.beat();
  }

  randomFree() {
    return this.grid.randomNear(this.me ? this.me.pos : null, 3);
  }

  // ---------------------------------------------------------------- shown, or not

  /** The town is shown (`me`: the girl, out of her door — or, `by` 'bus', on the bus from the foxes' village): the
   *  street's people at their posts, the camera on her. */
  show(me, by = 'door') {
    this.me = me;
    me.world = this;
    this.scene.add(me.rig.group);
    me.walkSpeed = WALK_OUT;
    this.clerk.place();
    this.barista.place();
    this.place = 'street';
    this.busy = null;
    this.coach = null;
    this.stray = null; //  (뭉치: whether it is out here this time is the app's to say — catAppear)
    this.catTrust = 0;
    const H = this.places.home;
    const B = this.places.bus;
    const a = me.anim;
    a.pitch = 0;
    a.air = 0;
    a.still();
    a.setPose('stand', 30);
    me.seat = me.abed = null;
    me.task = null;
    this.homeDoor = 0;
    this.homeWant = 0;
    let at = H.gate;
    if (by === 'bus') {
      // she is on the bus: out of sight until it has stopped and its door is open — then she gets off (it waits off the
      // board until the app says: busIn)
      a.pos.copy(B.inside);
      a.yaw = 0;
      me.rig.group.visible = false;
      me.tasks = [{ do: 'town', step: 'alight' }, { do: 'walk', to: B.wait.clone(), direct: true }, { do: 'town', step: 'seeOff' }, { do: 'face' }, { do: 'say', line: 'bus_home' }];
      this.busy = 'bus';
      this.coach = { phase: 'hold', x: this.busFrom(), v: BUS_TOP, door: 0, t: 0, to: 'town' };
      this.bus.setSign('우리동네');
      at = B.kerb;
    } else {
      // she comes out of her front door
      a.pos.copy(H.inside);
      a.yaw = 0; // (out of her door, towards the street)
      me.tasks = [{ do: 'town', step: 'homeDoor', open: true }, { do: 'walk', to: H.outside.clone(), direct: true }, { do: 'town', step: 'homeDoor', open: false }, { do: 'walk', to: H.gate.clone() }, { do: 'say', line: 'out' }];
    }
    a.snap();
    // the camera: by her door (or the stop), as it swings in
    const tall = this.camera.aspect < 0.78;
    Object.assign(this.view, { yaw: tall ? YAW_TALL : YAW, pitch: PITCH, zoom: ZOOM0 });
    this.view.target.set(at.x, 0.6, at.z);
    Object.assign(this.cam, { yaw: this.view.yaw + 0.4, pitch: this.view.pitch - 0.1, zoom: ZOOM0 * 1.25 });
    this.cam.target.copy(this.view.target);
    this.follow = 0;
    this.placeCamera(0, true);
  }

  /** …and no longer (she has gone in at her door — or the house was closed). */
  hide() {
    this.clerk.hide();
    this.barista.hide();
    this.stopSinging();
    this.busy = null;
    this.coach = null;
    this.bus.group.visible = false;
    if (this.me) this.me.rig.group.visible = true; // (she was on the bus)
    this.me = null;
    for (const s of this.map.swings) {
      s.rider = null;
      s.pivot.rotation.x = 0;
    }
    if (this.stash) {
      this.scene.remove(this.stash.object);
      disposeTree(this.stash.object);
      this.stash = null;
    }
  }

  // ---------------------------------------------------------------- where she goes (the app sends her: js/town.js)

  /** Is she in the middle of something that may not be broken off (paying, eating, singing, going in at her door)? */
  occupied() {
    return !!this.busy;
  }

  /** Off she goes: 'store', 'cafe', 'karaoke', 'park', 'home' — or a point on the ground. */
  go(place) {
    const me = this.me;
    if (!me || this.busy) return false;
    const P = this.places;
    this.prevPlace = this.place;
    this.place = typeof place === 'string' ? place : 'street';
    this.follow = 0;
    if (place && place.isVector3) {
      this.send(me, [{ do: 'walk', to: place.clone() }]);
      return true;
    }
    let tasks;
    if (place === 'store' || place === 'cafe') {
      const s = P[place];
      tasks = [{ do: 'walk', to: s.outside.clone() }, { do: 'walk', to: s.inside.clone(), direct: true }, { do: 'town', step: 'enter', shop: place }];
    } else if (place === 'karaoke') {
      const s = P.karaoke;
      tasks = this.karaokeOpen
        ? [{ do: 'walk', to: s.outside.clone() }, { do: 'walk', to: s.inside.clone(), direct: true }, { do: 'walk', to: s.kiosk.at.clone() }, { do: 'face', at: s.kiosk.face }, { do: 'town', step: 'enter', shop: 'karaoke' }]
        : [{ do: 'walk', to: s.outside.clone() }, { do: 'face', at: s.door.clone().add(V(0, 1, 0)) }, { do: 'town', step: 'shut' }];
    } else if (place === 'park') {
      tasks = [{ do: 'walk', to: P.park.gate.clone() }, { do: 'walk', to: P.park.inside.clone() }, { do: 'town', step: 'arrive', place: 'park' }];
    } else if (place === 'bus') {
      // to the bus stop: there she looks down the road, where the bus comes from
      tasks = [{ do: 'walk', to: P.bus.wait.clone() }, { do: 'face', at: P.bus.look.clone() }, { do: 'town', step: 'arrive', place: 'bus' }];
    } else if (place === 'street') {
      // out of the shop she is in (or just a step along the pavement)
      const shop = P[this.prevPlace];
      const out = shop && shop.outside ? shop.outside.clone().add(V(0, 0, 0.5)) : this.grid.randomNear(me.pos, 1.5);
      if (!out) return false;
      tasks = [{ do: 'walk', to: out }, { do: 'face' }];
    } else if (place === 'home') {
      tasks = [{ do: 'walk', to: P.home.gate.clone() }, { do: 'walk', to: P.home.outside.clone() }, { do: 'face', at: P.home.door.clone().add(V(0, 1, 0)) }, { do: 'town', step: 'homeDoor', open: true }, { do: 'walk', to: P.home.inside.clone(), direct: true }, { do: 'town', step: 'gone' }];
      this.busy = 'home';
    } else return false;
    this.send(me, tasks);
    return true;
  }

  /* Off she goes to do `tasks`: whatever she was doing she leaves — but off a swing, or up from a seat, first. */
  send(me, tasks) {
    me.tasks = tasks;
    const t = me.task;
    if (t && t.do === 'town' && t.step === 'swing') {
      t.stop = true; // (it slows, and she gets off: then the rest)
      return;
    }
    if (me.seat && t && t.do === 'sit') {
      t.t = 0; // (up, then the rest)
      return;
    }
    me.task = null;
    const a = me.anim;
    a.look = null;
    a.lookW = 0;
    a.still();
    a.setPose('stand', 6);
  }

  /** On a swing in the park (the one that is free). */
  swingNow() {
    const me = this.me;
    if (!me || this.busy) return false;
    const swing = this.places.park.swings.find((s) => !s.rider);
    if (!swing) return false;
    this.place = 'park';
    this.last = 'swing';
    this.send(me, [{ do: 'walk', to: swing.front.clone() }, { do: 'town', step: 'swing', swing, t: 12 + Math.random() * 6 }]);
    return true;
  }

  /** At the till: she has paid for `items` ([{ id, n, name }]) — she takes them to the counter, they are scanned, bagged. */
  checkout(items) {
    const me = this.me;
    if (!me || this.place !== 'store') return false;
    const S = this.places.store;
    this.busy = 'till';
    this.send(me, [{ do: 'walk', to: S.till.at.clone() }, { do: 'face', at: S.till.face }, { do: 'town', step: 'till', items }]);
    return true;
  }

  /** …and eats what she bought to eat here (`ids`), at the counter by the window (a cup of noodles: hot water first). */
  eatHere(ids) {
    const me = this.me;
    if (!me || !ids.length) return false;
    const S = this.places.store;
    this.busy = 'eat';
    const tasks = [{ do: 'town', step: 'stash' }];
    ids.forEach((id, i) => {
      const stool = S.stools[i % S.stools.length];
      if (id === 'cupramen') tasks.push({ do: 'walk', to: S.water.at.clone() }, { do: 'face', at: S.water.face }, { do: 'town', step: 'water' });
      tasks.push({ do: 'sit', seat: stool, t: 600, line: null, meal: id, source: 'store' });
    });
    tasks.push({ do: 'town', step: 'unstash' }, { do: 'town', step: 'free' });
    this.send(me, tasks);
    return true;
  }

  /** At the café: she orders `id` ({ id, name }), it is made, she drinks it at a table. */
  cafeOrder(o) {
    const me = this.me;
    if (!me || this.place !== 'cafe') return false;
    const C = this.places.cafe;
    this.busy = 'cafe';
    this.send(me, [{ do: 'walk', to: C.order.at.clone() }, { do: 'face', at: C.order.face }, { do: 'town', step: 'order', order: o }]);
    return true;
  }

  /** At the karaoke: she goes into the booth and sings `song` ({ id, title }) — the app plays it. */
  sing(song) {
    const me = this.me;
    if (!me || this.place !== 'karaoke' || !this.karaokeOpen) return false;
    const K = this.places.karaoke;
    this.busy = 'sing';
    this.send(me, [{ do: 'walk', to: K.boothDoor.clone() }, { do: 'walk', to: K.booth.at.clone() }, { do: 'face', at: K.booth.at.clone().add(V(0, 0, 1)) }, { do: 'town', step: 'sing', song }]);
    return true;
  }

  /** The song is over (or she stopped it): a score on the screen, a bow — and out of the booth. */
  singEnd() {
    const t = this.me && this.me.task;
    if (t && t.do === 'town' && t.step === 'sing') t.end = true;
    else this.stopSinging();
  }

  stopSinging() {
    this.singing = null;
    if (this.me) {
      const p = this.me.props.R;
      if (p && p.object.userData.mic) disposeTree(this.me.drop('R').object);
    }
  }

  // ---------------------------------------------------------------- the village bus

  /** Where it comes from (off the board, to the left: it keeps to the right of the road, as at home) and goes to. */
  busFrom() {
    return BOARD.x0 - BUS.L / 2 - 0.1;
  }

  busTo() {
    return BOARD.x1 + BUS.L / 2 + 0.1;
  }

  /** Where it stands at the stop: its door before the shelter. */
  busStopX() {
    return this.places.bus.doorX - (BUS.door.x0 + BUS.door.x1) / 2;
  }

  /** She takes the bus to the foxes' village: it is on its way at once; she waits for it at the kerb, gets on when its
   *  door opens (her card to the reader: beep) — and off it goes, with her. The app is told once it has gone a way
   *  (host.onTown('bus')): the ride itself is its. → false if she cannot now. */
  busOut() {
    const me = this.me;
    if (!me || this.busy) return false;
    const B = this.places.bus;
    this.place = 'bus';
    this.busy = 'bus';
    this.follow = 0;
    this.coach = { phase: 'come', x: this.busFrom(), v: BUS_TOP, door: 0, t: 0, to: 'fox' };
    this.bus.setSign('여우마을');
    this.world.sound('busCome');
    this.send(me, [{ do: 'walk', to: B.wait.clone() }, { do: 'face', at: B.look.clone() }, { do: 'town', step: 'busWait' }, { do: 'walk', to: B.kerb.clone(), direct: true }, { do: 'town', step: 'board' }]);
    return true;
  }

  /** The bus she is on (show: 'bus') comes along now (the app: the ride's screen has gone). */
  busIn() {
    const c = this.coach;
    if (!c || c.phase !== 'hold') return false;
    c.phase = 'come';
    c.t = 0;
    this.world.sound('busCome');
    return true;
  }

  /** (The ride could not be: she is off it again, at the kerb — as if she had changed her mind.) */
  busBack() {
    const me = this.me;
    this.coach = null;
    this.bus.group.visible = false;
    this.busy = null;
    if (!me) return;
    const B = this.places.bus;
    me.rig.group.visible = true;
    me.anim.pos.copy(B.kerb);
    me.anim.air = 0;
    me.anim.yaw = 0;
    me.anim.setPose('stand', 30);
    me.anim.snap();
    me.task = null;
    me.tasks = [{ do: 'face' }];
    this.place = 'street';
  }

  /*
   * The bus along the street: on its way to the stop (braking for it), standing there with its door open while she gets
   * on (or off), pulling away — and off the board. It fades in where it comes onto the board, and out where it leaves.
   */
  updateCoach(dt) {
    const c = this.coach;
    const bus = this.bus;
    if (!c || c.phase === 'hold') {
      bus.group.visible = false;
      return;
    }
    const lane = this.places.bus.lane;
    const stopX = this.busStopX();
    const v0 = c.v;
    c.t += dt;
    if (c.phase === 'come') {
      // (only ever slower: as fast as it can go and still stop at the stop)
      const left = stopX - c.x;
      c.v = Math.min(c.v, BUS_TOP, Math.sqrt(2 * BUS_BRAKE * Math.max(0, left)) + 0.12);
      c.x = Math.min(stopX, c.x + c.v * dt);
      if (c.x >= stopX - 0.002) {
        c.x = stopX;
        c.v = 0;
        c.phase = 'stop';
        c.t = 0;
        this.world.sound('busHiss');
      }
    } else if (c.phase === 'stop') {
      // its door opens a moment after it stops; shuts when she is on (or off); and a moment later it pulls away
      const done = c.to === 'fox' ? c.boarded : c.off;
      const want = done ? 0 : c.t > 0.45 ? 1 : 0;
      if (want !== c.want) {
        c.want = want;
        this.world.sound('busDoor');
      }
      c.door = clamp(c.door + (want ? 1 : -1) * dt * 1.9, 0, 1);
      if (done && c.door <= 0) {
        c.shut = (c.shut || 0) + dt;
        if (c.shut > 0.35) {
          c.phase = 'go';
          c.t = 0;
          this.world.sound('busGo');
        }
      }
    } else if (c.phase === 'go') {
      c.v = Math.min(BUS_TOP * 1.15, c.v + BUS_PULL * dt);
      c.x += c.v * dt;
      if (c.to === 'fox' && !c.told && c.x > stopX + BUS_AWAY) {
        c.told = true;
        this.host.onTown('bus');
      }
      if (c.x > this.busTo()) {
        // off the board: gone (with her on it, the street waits for the ride to take her away)
        this.coach = c.to === 'fox' ? { ...c, phase: 'gone' } : null;
        bus.group.visible = false;
        return;
      }
    } else return void (bus.group.visible = false); // ('gone')
    bus.group.visible = true;
    bus.group.position.set(c.x, 0, lane);
    bus.setDoor(ease(c.door));
    const L = BUS.L;
    bus.setFade(Math.min(clamp((c.x + L / 2 - BOARD.x0) / L, 0, 1), clamp((BOARD.x1 - (c.x - L / 2)) / L, 0, 1)));
    bus.update(dt, this.time, c.v * dt, (c.v - v0) / Math.max(dt, 1e-4), c.phase === 'stop');
  }

  // ---------------------------------------------------------------- 뭉치, the white stray (cat.js; the app's: js/cat.js)

  /** Where it may be found: on the bench at the bus stop, on the park's bench, by the store's door, under the big tree,
   *  by her own gate, on the park's grass. (`h`: how high up it is.) */
  catSpots() {
    const P = this.places;
    return [
      { at: V(-0.72, 0, 2.92), yaw: Math.PI + 0.3, h: 0.44 },
      { at: V(-5.65, 0, 3.17), yaw: 0.25, h: 0.44 },
      { at: P.store.outside.clone().add(V(0.8, 0, -0.12)), yaw: 0.4, h: 0 },
      { at: V(8.7, 0, 4.25), yaw: -0.5, h: 0 },
      { at: P.home.gate.clone().add(V(0.9, 0, 0.12)), yaw: 0.3, h: 0 },
      { at: V(-6.7, 0, 4.4), yaw: 0.6, h: 0 },
    ];
  }

  /** An open place on the ground near `p`. */
  freeNear(p) {
    const cell = this.grid.nearestOpen(p);
    return cell ? this.grid.centre(...cell) : p.clone();
  }

  /** It is out on the street this time (the app has rolled for it): at its spot `i`; how far it trusts her (0 … 5). */
  catAppear(i, trust) {
    const cat = this.world.cat;
    const s = this.catSpots()[i % 6];
    this.stray = s;
    this.catTrust = trust;
    cat.setWorld(this);
    cat.following = false;
    cat.show(s.at, s.yaw, s.h, []);
    return true;
  }

  /** …a meow, to be found by. */
  catCall() {
    const cat = this.world.cat;
    if (cat.on && cat.world === this) cat.do([{ do: 'meow' }]);
  }

  /** What it does next, out here (cat.js asks): after her, taken home; wary of her if she comes near (and it does not
   *  know her yet), glad of her if it does; otherwise at its spot — a loaf, a groom, a nap, a look about. */
  planCat(cat) {
    const T = cat.tasks;
    const me = this.me;
    const s = this.stray;
    if (cat.following) return void T.push({ do: 'follow', until: () => !cat.following });
    const d = me && me.on ? Math.hypot(me.pos.x - cat.pos.x, me.pos.z - cat.pos.z) : 99;
    if (d < 1.4 && this.place !== 'cat' && this.catTrust < 2) return void T.push({ do: 'wary', t: 4, until: () => !this.me || Math.hypot(this.me.pos.x - cat.pos.x, this.me.pos.z - cat.pos.z) > 2 });
    if (d < 1.6 && this.place !== 'cat' && this.catTrust >= 2 && !this.busy && cat.perch < 0.05 && Math.random() < 0.5) {
      return void T.push({ do: 'walk', to: this.freeNear(me.pos.clone().add(V(0.3, 0, 0.2))), fast: true }, { do: 'rub', t: 3 });
    }
    if (!s) return void T.push({ do: 'sit', t: 3 });
    if (Math.hypot(cat.pos.x - s.at.x, cat.pos.z - s.at.z) > 0.25 || Math.abs(cat.perch - s.h) > 0.05) {
      if (s.h > 0.05) {
        const below = this.freeNear(s.at.clone().add(V(Math.sin(s.yaw) * 0.45, 0, Math.cos(s.yaw) * 0.45)));
        T.push({ do: 'walk', to: below }, { do: 'hop', to: s.at.clone(), h: s.h });
      } else T.push({ do: 'walk', to: s.at.clone() });
    }
    const r = Math.random();
    T.push(r < 0.3 ? { do: 'loaf', t: 6 + Math.random() * 8 } : r < 0.55 ? { do: 'groom', t: 3 + Math.random() * 3 } : r < 0.7 ? { do: 'sleep', t: 8 + Math.random() * 10 } : { do: 'sit', t: 4 + Math.random() * 5 });
  }

  /** She goes to it (a tap on it): down by it — it is wary of her, or comes to her. → false if she cannot now. */
  catGo() {
    const me = this.me;
    const cat = this.world.cat;
    if (!me || this.busy || !cat.on || cat.world !== this) return false;
    const toHer = Math.atan2(me.pos.x - cat.pos.x, me.pos.z - cat.pos.z);
    const kneel = this.freeNear(cat.pos.clone().add(V(Math.sin(toHer) * 0.46, 0, Math.cos(toHer) * 0.46)));
    this.place = 'cat';
    this.follow = 0;
    this.busy = 'cat';
    this.send(me, [{ do: 'walk', to: kneel }, { do: 'face', at: cat.pos.clone() }, { do: 'town', step: 'catNear' }]);
    cat.do(this.catTrust < 2 ? [{ do: 'wary', t: 3.5 }] : [{ do: 'face', at: kneel }, { do: 'meow', line: 'hi' }, { do: 'sit', t: 3 }]);
    return true;
  }

  /** She holds out a churu: it comes and licks it up. */
  catFeed() {
    const me = this.me;
    const cat = this.world.cat;
    if (!me || this.busy || !cat.on || cat.world !== this) return false;
    this.busy = 'cat';
    this.place = 'cat';
    this.send(me, [{ do: 'face', at: cat.pos.clone() }, { do: 'feedCat', cat, t: 4.6, done: () => ((this.busy = null), this.host.onTown('catFed')) }]);
    return true;
  }

  /** She strokes it: it leans into her hand. */
  catPet() {
    const me = this.me;
    const cat = this.world.cat;
    if (!me || this.busy || !cat.on || cat.world !== this) return false;
    this.busy = 'cat';
    this.place = 'cat';
    const at = me.pos.clone();
    cat.do([{ do: 'face', at }, { do: 'petted', t: 99 }]);
    this.send(me, [{ do: 'face', at: cat.pos.clone() }, { do: 'petCat', cat, t: 3.6, done: () => ((this.busy = null), this.host.onTown('catPetted')) }]);
    return true;
  }

  /** How far it trusts her now (it has been fed, stroked: js/cat.js). */
  catTrustIs(n) {
    this.catTrust = n;
  }

  /** She takes it home: "뭉치야, 우리 집에 가자!" — it comes along after her, home she goes, and in it comes behind her
   *  (world.js backHome: catComeIn). */
  catAdopt() {
    const me = this.me;
    const cat = this.world.cat;
    if (!me || !cat.on || cat.world !== this) return false;
    this.busy = null;
    cat.following = true;
    cat.do([{ do: 'meow', line: 'yes' }, { do: 'follow', until: () => !cat.following }]);
    if (!this.go('home')) return false;
    me.tasks.unshift({ do: 'say', line: 'cat_adopt' }, { do: 'wait', t: 1.4 });
    return true;
  }

  setKaraokeOpen(open) {
    if (open === this.karaokeOpen) return;
    this.karaokeOpen = open;
    const k = this.map.shops.karaoke;
    k.shutter.visible = !open;
    this.karaokeRoof.visible = !open;
  }

  // ---------------------------------------------------------------- what she does on her own, out here

  /** Something to do next, when she has done what she was sent to do (resident.js plan()). */
  planFor(me) {
    const P = this.places;
    const r = Math.random();
    const near = (p) => me.pos.distanceTo(p) < 5;
    const cat = this.world.cat;
    if (this.place === 'cat' && cat.on && cat.world === this) {
      // (by 뭉치, while she makes up her mind what to do: down by it, her eyes on it)
      return void me.tasks.push({ do: 'look', at: cat.headPoint(V()).clone(), t: 3, line: null, pose: cat.perch > 0.2 ? 'bend' : 'pet' });
    }
    if (this.place === 'store') {
      const b = P.store.browse[Math.floor(Math.random() * P.store.browse.length)];
      return void me.tasks.push({ do: 'walk', to: b.at.clone() }, { do: 'look', at: b.face, t: 3 + Math.random() * 3, line: b.line, pose: 'look' });
    }
    if (this.place === 'cafe') {
      return void me.tasks.push({ do: 'look', at: P.cafe.order.face.clone().add(V(-0.3, 0.7, 0)), t: 4, line: 'cafe_menu', pose: 'look' }, { do: 'wait', t: 2 });
    }
    if (this.place === 'karaoke') {
      if (!this.karaokeOpen) return void me.tasks.push({ do: 'wait', t: 2 });
      return void me.tasks.push({ do: 'look', at: P.karaoke.kiosk.face, t: 4, line: 'karaoke_wait', pose: 'look' });
    }
    if (this.place === 'park') {
      const swing = P.park.swings.find((s) => !s.rider);
      if (r < 0.32 && swing && this.last !== 'swing') {
        this.last = 'swing';
        return void me.tasks.push({ do: 'walk', to: swing.front.clone() }, { do: 'town', step: 'swing', swing, t: 9 + Math.random() * 8 });
      }
      if (r < 0.58 && this.last !== 'bench') {
        this.last = 'bench';
        const seat = P.park.bench[Math.floor(Math.random() * 2)];
        return void me.tasks.push({ do: 'sit', seat, t: 8 + Math.random() * 8, line: 'park_bench' });
      }
      const l = P.park.look[Math.floor(Math.random() * P.park.look.length)];
      this.last = l.line;
      return void me.tasks.push({ do: 'walk', to: l.at.clone() }, { do: 'look', at: l.face, t: 3 + Math.random() * 3, line: l.line, pose: l.line === 'park_pigeon' ? 'bend' : 'look' });
    }
    if (this.place === 'bus') {
      // at the bus stop: an eye down the road, where it will come from — or a sit on the bench under the shelter
      if (r < 0.35 && this.last !== 'busBench') {
        this.last = 'busBench';
        return void me.tasks.push({ do: 'sit', seat: P.street.bench[0], t: 6 + Math.random() * 5, line: 'bus_wait' });
      }
      this.last = 'busLook';
      return void me.tasks.push({ do: 'walk', to: P.bus.wait.clone() }, { do: 'look', at: P.bus.look, t: 3 + Math.random() * 2, line: 'bus_wait', pose: 'look' });
    }
    // on the street: a look at something near, a sit on a bench, a little stroll — or she waits a moment
    const looks = P.street.look.filter((l) => near(l.at));
    if (r < 0.3 && looks.length) {
      const l = looks[Math.floor(Math.random() * looks.length)];
      return void me.tasks.push({ do: 'walk', to: l.at.clone() }, { do: 'look', at: l.face, t: 3 + Math.random() * 2, line: l.line, pose: 'look' });
    }
    const bench = P.street.bench.find((b) => near(b.at));
    if (r < 0.45 && bench) return void me.tasks.push({ do: 'sit', seat: bench, t: 6 + Math.random() * 6, line: 'sit' });
    if (r < 0.75) {
      const p = this.grid.randomNear(me.pos, 2.5);
      if (p) return void me.tasks.push({ do: 'walk', to: p }, { do: 'wait', t: 1.5 + Math.random() * 2 });
    }
    me.tasks.push({ do: 'face' }, { do: 'wait', t: 2 + Math.random() * 2 });
  }

  /**
   * The things done only out here — a step of a visit: the door of her house; going into a shop and being greeted; the
   * till; hot water for her noodles; ordering at the café; the swing; the karaoke. → true when it is done (undefined:
   * not one of these).
   */
  ownTask(p, t, dt) {
    if (t.do !== 'town') return undefined;
    const me = this.me;
    const a = p.anim;
    const step = t.step;
    if (step === 'homeDoor') {
      this.homeWant = t.open ? 1 : 0;
      return t.age > 0.5;
    }
    if (step === 'gone') {
      // she is in: the house again
      this.busy = null;
      this.world.enterHome();
      return null;
    }
    if (step === 'free') {
      this.busy = null;
      return true;
    }
    if (step === 'arrive') {
      this.host.onTown('arrive', t.place);
      return true;
    }
    if (step === 'shut') {
      if (!t.said) {
        t.said = true;
        p.say('karaoke_shut');
        a.setPose('look', 5);
        this.host.onTown('arrive', 'karaoke');
      }
      if (t.age > 3) {
        a.setPose('stand', 5);
        return true;
      }
      return false;
    }
    if (step === 'enter') {
      // in at the door — and whoever works here says hello
      const staff = t.shop === 'store' ? this.clerk : t.shop === 'cafe' ? this.barista : null;
      if (!t.greeted) {
        t.greeted = true;
        if (t.shop === 'store') this.world.sound('chime');
        if (staff) staff.waveTo(p.pos.clone(), 'hello');
        else this.world.sound('coin');
      }
      if (t.age > (staff ? 1.4 : 0.6)) {
        this.host.onTown('arrive', t.shop);
        return true;
      }
      return false;
    }
    if (step === 'busWait' || step === 'board' || step === 'alight' || step === 'seeOff') return this.busTask(p, t, dt);
    if (step === 'catNear') {
      // down by 뭉치: a word to it — and the app asks what she will do (js/cat.js)
      const cat = this.world.cat;
      if (!t.said) {
        t.said = true;
        a.setPose(cat.perch > 0.2 ? 'bend' : 'pet', 5);
        p.say(this.catTrust < 1 ? 'cat_spot' : 'cat_hi');
      }
      if (t.age < 1.2) return false;
      this.busy = null;
      this.host.onTown('catNear');
      return true;
    }
    if (step === 'till') return this.till(p, t, dt);
    if (step === 'stash') {
      // (the bag goes on the counter by the window while she eats)
      const bag = p.drop('L');
      this.stash = bag;
      if (bag) {
        const S = this.places.store;
        bag.object.position.copy(S.stools[0].at).add(V(0.45, 0.86, 0.48));
        bag.object.rotation.set(0, 0, 0);
        bag.object.scale.setScalar(p.rig.size);
        this.scene.add(bag.object);
      }
      return true;
    }
    if (step === 'unstash') {
      const bag = this.stash;
      this.stash = null;
      if (bag) {
        bag.object.scale.setScalar(1);
        p.hold('L', bag.object);
      }
      return true;
    }
    if (step === 'water') {
      // a cup of noodles, under the hot water tap
      if (!t.cup) {
        t.cup = makeFood('cupramen');
        t.cup.lid(0.5);
        p.hold('R', t.cup.object);
        a.setPose('pour', 4);
        this.world.sound('pour');
      }
      if (t.age > 0.6 && t.age < 2.2 && Math.random() < dt * 5) this.puff(t.cup.object.getWorldPosition(_v).add(V(0, 0.12, 0)));
      if (t.age > 2.4) {
        p.say('water');
        const held = p.drop('R');
        if (held) disposeTree(held.object);
        a.setPose('stand', 5);
        return true;
      }
      return false;
    }
    if (step === 'order') return this.order(p, t, dt);
    if (step === 'swing') return this.swing(p, t, dt);
    if (step === 'sing') return this.singTask(p, t, dt);
    return true;
  }

  /*
   * The till, a beat at a time: she puts the basket down; the clerk scans each thing (a beep); "N점 해서 M코인입니다";
   * she pays; "봉투 필요하세요?" — "네, 주세요!"; the clerk bags it and hands it over; "감사합니다, 또 오세요~".
   */
  till(p, t, dt) {
    const c = this.clerk;
    const a = p.anim;
    t.k = (t.k || 0) + dt;
    const next = (beat) => {
      t.beat = beat;
      t.k = 0;
      t.said = 0;
    };
    if (!t.beat) {
      next('basket');
      c.busy = true;
      c.tasks = [];
      c.task = { do: 'wait', t: 99, age: 0 };
      t.basket = makeBasket();
      p.hold('R', t.basket);
      a.setPose('carry', 6);
    }
    const S = this.places.store;
    c.turnTo(Math.atan2(p.pos.x - c.pos.x, p.pos.z - c.pos.z), dt);
    switch (t.beat) {
      case 'basket':
        if (t.k > 0.7) {
          // (the basket on the counter)
          const held = p.drop('R');
          if (held) {
            held.object.position.set(S.till.face.x - 0.2, S.counterTop, S.till.face.z + 0.25);
            held.object.rotation.set(0, Math.PI / 2, 0);
            held.object.scale.setScalar(p.rig.size);
            this.scene.add(held.object);
            t.onCounter = held.object;
          }
          a.setPose('stand', 6);
          next('scan');
          t.n = 0;
        }
        return false;
      case 'scan': {
        // a beep for each thing, the clerk's hand going over the scanner
        const total = t.items.reduce((s, it) => s + (it.n || 1), 0);
        const each = Math.min(0.42, 2.6 / Math.max(1, total));
        c.anim.hands.R = c.anim.hands.R || V();
        c.anim.hands.R.set(S.till.face.x + 0.05, S.counterTop + 0.08 + Math.abs(Math.sin(t.k * 8)) * 0.05, S.till.face.z + 0.12 - (t.k % each) * 0.4);
        if (t.k > (t.n + 1) * each && t.n < total) {
          t.n++;
          this.world.sound('beep');
        }
        if (t.n >= total && t.k > total * each + 0.4) {
          c.anim.hands.R = null;
          next('total');
        }
        return false;
      }
      case 'total':
        if (!t.said) t.said = c.say('total') || 2;
        if (t.k > t.said * 0.85) next('pay');
        return false;
      case 'pay':
        if (!t.said) {
          t.said = p.say('pay') || 1.6;
          a.setPose('offer', 6);
        }
        if (t.k > 0.8 && !t.paid) {
          t.paid = true;
          this.world.sound('coin');
          a.setPose('stand', 6);
        }
        if (t.k > Math.max(1.4, t.said * 0.8)) next('bag');
        return false;
      case 'bag':
        if (!t.said) t.said = c.say('bag') || 2;
        if (t.k > t.said * 0.85) next('yes');
        return false;
      case 'yes':
        if (!t.said) t.said = p.say('bag_yes') || 1.6;
        if (t.k > t.said * 0.8) next('give');
        return false;
      case 'give':
        if (!t.said) {
          t.said = 1;
          c.anim.setPose('offer', 6);
          if (t.onCounter) {
            this.scene.remove(t.onCounter);
            disposeTree(t.onCounter);
            t.onCounter = null;
          }
        }
        if (t.k > 0.6 && !t.handed) {
          t.handed = true;
          p.hold('L', makeShopBag());
          a.setPose('stand', 6);
          c.anim.setPose('stand', 6);
        }
        if (t.k > 1.0) next('thanks');
        return false;
      case 'thanks':
        if (!t.said) t.said = c.say('thanks') || 2;
        if (t.k > t.said * 0.7) {
          c.busy = false;
          c.task = null;
          c.waveTo(p.pos.clone(), 'bye');
          this.busy = null;
          this.host.onTown('paid');
          return true;
        }
        return false;
      default:
        return true;
    }
  }

  /*
   * On and off the bus: waiting for it at the kerb (her eyes on it as it comes, until it stands there with its door
   * open); up its step, her card to the reader — beep — and in (out of sight: she goes where it goes); or, come home on
   * it, out of its door and down onto the pavement — and from there she waves it off, until it has gone.
   */
  busTask(p, t, dt) {
    const a = p.anim;
    const c = this.coach;
    const B = this.places.bus;
    if (t.step === 'seeOff') {
      if (!c || c.phase === 'gone') {
        a.look = null;
        a.lookW = 0;
        a.still();
        a.setPose('stand', 6);
        this.busy = null;
        return true;
      }
      this.busLook.set(c.x + 1.4, 1.0, B.lane);
      a.look = this.busLook;
      a.lookW = damp(a.lookW, 0.85, 4, dt);
      p.turnTo(Math.atan2(this.busLook.x - a.pos.x, this.busLook.z - a.pos.z), dt);
      if (c.phase === 'go' && !t.waved) {
        t.waved = t.age;
        a.setPose('wave', 7);
      }
      if (t.waved) {
        const k = t.age - t.waved;
        a.add.aRt = Math.sin(k * 11) * 0.25 * (k < 2.4 ? 1 : 0);
        if (k > 2.4 && !t.down) {
          t.down = true;
          a.still();
          a.setPose('stand', 6);
        }
      }
      return t.age > 16;
    }
    if (t.step === 'busWait') {
      if (!c) return true;
      if (c.phase === 'come') {
        this.busLook.set(c.x + 1, 0.9, B.lane);
        a.look = this.busLook;
        a.lookW = damp(a.lookW, 0.85, 4, dt);
      }
      if (!t.said && t.age > 0.6) {
        t.said = true;
        p.say('bus_wait');
      }
      if (c.phase === 'stop' && c.door > 0.85) {
        a.look = null;
        a.lookW = 0;
        return true;
      }
      return t.age > 20; // (should it never come)
    }
    t.k = (t.k || 0) + dt;
    if (t.step === 'board') {
      if (!t.k0) {
        t.k0 = 1;
        t.from = a.pos.clone();
      }
      p.turnTo(Math.PI, dt);
      if (t.k < 0.55) {
        // up onto its step
        const k = ease(t.k / 0.55);
        a.pos.lerpVectors(t.from, B.step, k);
        a.air = 0.07 * k;
        a.speed = 0.45;
        return false;
      }
      if (!t.beeped) {
        t.beeped = true;
        a.setPose('offer', 8);
        this.world.sound('beep');
        p.say('bus_card');
      }
      if (t.k < 1.15) return false;
      if (!t.posed) {
        t.posed = true;
        a.setPose('stand', 6);
      }
      // …and in
      const k = Math.min(1, (t.k - 1.15) / 0.5);
      a.pos.lerpVectors(B.step, B.inside, k);
      a.speed = 0.45;
      if (k >= 1 && p.rig.group.visible) {
        p.rig.group.visible = false;
        this.world.hush('me');
        if (c) c.boarded = true;
      }
      return false; // (on board: where the bus goes, she goes)
    }
    // ('alight') on the bus until its door is open
    if (!t.out) {
      if (c && !(c.phase === 'stop' && c.door > 0.85)) return false;
      t.out = true;
      t.k = 0;
      p.rig.group.visible = true;
      a.pos.copy(B.inside);
      a.yaw = 0;
      a.air = 0.07;
      a.snap();
      return false;
    }
    const k = Math.min(1, t.k / 1.0);
    if (k < 0.4) a.pos.lerpVectors(B.inside, B.step, k / 0.4);
    else {
      const k2 = ease((k - 0.4) / 0.6);
      a.pos.lerpVectors(B.step, B.kerb, k2);
      a.air = 0.07 * (1 - k2);
    }
    a.speed = 0.45;
    if (k < 1) return false;
    a.air = 0;
    if (c) c.off = true; // (its door shuts, and off it goes: she sees it off — busy until it has gone)
    return true;
  }

  /* The café: she orders; the owner makes it at the machine, brings it over — she takes it to a table and drinks it. */
  order(p, t, dt) {
    const b = this.barista;
    const C = this.places.cafe;
    t.k = (t.k || 0) + dt;
    const next = (beat) => {
      t.beat = beat;
      t.k = 0;
      t.said = 0;
    };
    if (!t.beat) {
      next('ask');
      b.busy = true;
      b.tasks = [];
      b.task = { do: 'wait', t: 99, age: 0 };
    }
    switch (t.beat) {
      case 'ask':
        b.turnTo(Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z), dt);
        if (!t.said) t.said = p.say('order_cafe') || 2;
        if (t.k > t.said * 0.85) next('ok');
        return false;
      case 'ok':
        b.turnTo(Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z), dt);
        if (!t.said) {
          t.said = b.say('ok') || 2;
          this.world.sound('coin');
        }
        if (t.k > t.said * 0.8) {
          // to the machine
          b.task = null;
          b.tasks = [{ do: 'walk', to: C.machine.at.clone() }, { do: 'face', at: C.machine.face }, { do: 'pose', pose: 'pour', t: 3.2 }, { do: 'walk', to: C.barista.at.clone() }, { do: 'face', at: p.pos.clone() }, { do: 'wait', t: 99 }];
          next('making');
          this.world.sound('grind');
        }
        return false;
      case 'making':
        // (steam from the machine while it is made; she waits, looking at the menu)
        if (b.task && b.task.do === 'pose' && Math.random() < dt * 4) this.puff(_v.copy(C.machine.face).add(V(0, 0.25, 0.05)));
        if (!t.looked) {
          t.looked = true;
          p.anim.look = C.order.face.clone().add(V(-0.4, 0.7, -0.5));
          p.anim.lookW = 1;
        }
        if (b.task && b.task.do === 'wait' && b.task.t === 99 && b.tasks.length === 0) next('ready');
        if (t.k > 14) next('ready');
        return false;
      case 'ready':
        p.anim.look = null;
        p.anim.lookW = 0;
        b.turnTo(Math.atan2(p.pos.x - b.pos.x, p.pos.z - b.pos.z), dt);
        if (!t.said) {
          t.said = b.say('ready') || 2;
          t.cup = makeFood(t.order.id);
          if (t.cup) b.hold('R', t.cup.object);
          b.anim.setPose('offer', 6);
        }
        if (t.k > 0.9 && !t.handed && t.cup) {
          t.handed = true;
          b.drop('R');
          disposeTree(t.cup.object);
          b.anim.setPose('stand', 6);
        }
        if (t.k > t.said * 0.8) next('thanks');
        return false;
      case 'thanks':
        if (!t.said) t.said = p.say('thanks_cafe') || 1.6;
        if (t.k > t.said * 0.6) {
          b.busy = false;
          b.task = null;
          b.tasks = [];
          // to a table, and drink it
          const seat = C.seats[0];
          p.tasks = [{ do: 'sit', seat, t: 600, line: null, meal: t.order.id, source: 'cafe' }, { do: 'town', step: 'free' }];
          return true;
        }
        return false;
      default:
        return true;
    }
  }

  /* On a swing: sat on it, swinging higher, a little higher — for a while; slowing; off again. */
  swing(p, t, dt) {
    const a = p.anim;
    const s = t.swing;
    if (!t.phase) {
      t.phase = 'turn';
      s.rider = p;
    }
    if (t.phase === 'turn') {
      if (p.turnTo(0, dt)) {
        t.phase = 'sit';
        t.k = 0;
        a.target = pose('chair');
        a.rate = 7;
        p.say('swing');
      }
      return false;
    }
    if (t.phase === 'sit') {
      t.k = Math.min(1, t.k + dt / 0.5);
      const k = ease(t.k);
      a.pos.lerpVectors(s.front, V(s.at.x, 0, s.at.z), k);
      a.air = k * (s.top - s.len + 0.05 - 0.45);
      if (t.k >= 1) {
        t.phase = 'swing';
        t.k = 0;
      }
      return false;
    }
    if (t.phase === 'swing') {
      t.k += dt;
      // (her hands up on the chains; her legs out going forward, tucked going back)
      const amp = Math.min(0.62, 0.15 + t.k * 0.09) * (t.stop || t.k > t.t ? Math.max(0, 1 - (t.k - (t.stopAt || (t.stopAt = t.k))) / 2.5) : 1);
      const th = Math.sin(t.k * 2.6) * amp;
      s.angle = th;
      s.pivot.rotation.x = th;
      const r = s.len - 0.04;
      a.pos.set(s.at.x, 0, s.at.z + Math.sin(th) * r);
      a.air = s.top - Math.cos(th) * r + 0.02 - 0.45;
      a.pitch = th * 0.6;
      a.add.aLf = a.add.aRf = 1.2;
      a.add.eL = a.add.eR = 1.0;
      a.add.kL = a.add.kR = -Math.cos(t.k * 2.6) * 0.5 * (amp / 0.62);
      a.mood.smile = 1;
      if (t.k > 1.5 && !t.said2 && amp > 0.4) {
        t.said2 = true;
        p.say('swing_high');
      }
      if (amp < 0.02 && (t.stop || t.k > t.t)) {
        t.phase = 'off';
        t.k = 0;
        a.add.aLf = a.add.aRf = a.add.eL = a.add.eR = a.add.kL = a.add.kR = 0;
        a.pitch = 0;
        a.mood.smile = 0;
        a.setPose('stand', 6);
      }
      return false;
    }
    // off it, and a step forward
    t.k = Math.min(1, t.k + dt / 0.5);
    const k = ease(t.k);
    a.pos.lerpVectors(V(s.at.x, 0, s.at.z), s.front, k);
    a.air = (1 - k) * (s.top - s.len + 0.05 - 0.45);
    s.pivot.rotation.x *= 1 - k;
    if (t.k >= 1) {
      a.air = 0;
      s.rider = null;
      s.pivot.rotation.x = 0;
      return true;
    }
    return false;
  }

  /* In the booth: she sings (the app plays her cover), the mic to her lips, moving to it — the lyrics scroll on the
     screen behind her; when it ends, a score comes up, a bow, and out. */
  singTask(p, t, dt) {
    const a = p.anim;
    const K = this.map.shops.karaoke;
    if (!t.began) {
      t.began = true;
      this.singing = { title: t.song.title, t: 0, score: 0 };
      p.hold('R', makeMic());
      a.setPose('stand', 6);
      this.host.onTown('singing', t.song);
    }
    const s = this.singing;
    if (!s) return true;
    s.t += dt;
    if (!t.end) {
      // the mic to her mouth, her other hand out; she sways — to the beat
      p.frame();
      a.hands.R = p.mouth(_w).addScaledVector(V(Math.sin(a.yaw), 0, Math.cos(a.yaw)), 0.05 * p.rig.size).add(V(0, -0.03, 0));
      const b = this.world.beat();
      const ph = b.phase * Math.PI * 2;
      a.add.tilt = Math.sin(ph) * 0.06;
      a.add.hdz = Math.sin(ph + 0.6) * 0.08;
      a.add.aLo = 0.6 + Math.max(0, Math.sin(ph)) * 0.5;
      a.add.eL = 0.7;
      a.add.kL = Math.max(0, Math.sin(ph)) * 0.2;
      a.add.kR = Math.max(0, -Math.sin(ph)) * 0.2;
      a.mood.mouth = 0.25 + 0.45 * Math.abs(Math.sin(s.t * 7.3)) * (0.6 + 0.4 * Math.sin(s.t * 1.7));
      a.mood.smile = 0.6;
      if (Math.random() < dt * 1.6) this.fx.emit(Math.random() < 0.5 ? '♪' : '♫', p.headPoint(V()).add(V((Math.random() - 0.5) * 0.3, 0.1, 0.1)), { size: 0.12, rise: 0.4, life: 1.6 });
      this.drawScreen(K.screens[0], s);
      return false;
    }
    // the end: the score, a cheer, the mic down, out of the booth
    if (!t.endAt) {
      t.endAt = s.t;
      s.score = 86 + Math.floor(Math.random() * 15);
      a.hands.R = null;
      a.add = {};
      a.mood.mouth = 0;
      a.setPose('cheer', 6);
      this.world.sound('fanfare');
      this.host.onTown('sung', { score: s.score, title: s.title });
      for (let i = 0; i < 6; i++) this.fx.emit(i % 2 ? '✨' : '🎉', p.headPoint(V()).add(V((Math.random() - 0.5) * 0.6, 0.1 + Math.random() * 0.3, 0)), { size: 0.12, rise: 0.35, life: 1.6 });
    }
    this.drawScreen(K.screens[0], s);
    if (s.t - t.endAt > 1.4 && !t.said) {
      t.said = true;
      p.say(s.score >= 100 ? 'score_100' : 'score');
      a.setPose('stand', 6);
    }
    if (s.t - t.endAt > 4) {
      this.stopSinging();
      this.drawScreen(K.screens[0], null);
      p.tasks = [{ do: 'walk', to: this.places.karaoke.boothDoor.clone() }, { do: 'walk', to: this.places.karaoke.kiosk.at.clone() }, { do: 'town', step: 'free' }];
      return true;
    }
    return false;
  }

  /* The booth's screen: the song's title and the lyrics' bars scrolling (it is her own song: what she sings is hers) —
     and the score at the end. */
  drawScreen(sc, s) {
    if (!sc) return;
    const now = this.time;
    if (sc.last && now - sc.last < 0.12) return;
    sc.last = now;
    const g = sc.canvas.getContext('2d');
    const W = sc.canvas.width;
    const H = sc.canvas.height;
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#2b1a5a');
    grad.addColorStop(1, '#5a1a4a');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (!s) {
      g.fillStyle = '#7ff3ff';
      g.font = '700 46px Jua, sans-serif';
      g.fillText('🎤 반짝 노래방', W / 2, H / 2);
      sc.tex.needsUpdate = true;
      return;
    }
    if (s.score) {
      g.fillStyle = '#ffd23f';
      g.font = '700 120px Fredoka, Jua, sans-serif';
      g.fillText(`${s.score}점`, W / 2, H * 0.48);
      g.fillStyle = '#ffffff';
      g.font = '700 34px Jua, sans-serif';
      g.fillText(s.score >= 100 ? '완벽해요! 💯' : '최고의 무대! 👏', W / 2, H * 0.82);
      sc.tex.needsUpdate = true;
      return;
    }
    g.fillStyle = '#ffffff';
    g.font = '700 34px Jua, sans-serif';
    g.fillText(`♪ ${s.title}`, W / 2, 40);
    // the lyrics, as bars that fill up in pink as the words go by
    const line = Math.floor(s.t / 3.2);
    const k = (s.t % 3.2) / 3.2;
    for (let i = 0; i < 2; i++) {
      const y = H * 0.55 + i * 70;
      const w = W * (0.55 + 0.25 * Math.abs(Math.sin((line + i) * 1.7)));
      g.fillStyle = 'rgba(255, 255, 255, 0.85)';
      g.fillRect((W - w) / 2, y - 16, w, 32);
      if (i === 0) {
        g.fillStyle = '#ff5fa2';
        g.fillRect((W - w) / 2, y - 16, w * k, 32);
      }
    }
    sc.tex.needsUpdate = true;
  }

  /* Steam: a soft white puff rising. */
  puff(at) {
    this.fx.puff(at);
  }

  // ---------------------------------------------------------------- the light of the hour, the weather, the year

  /** As the house's apply(): the sky over Incheon, its weather, the season — and whether the karaoke is open yet. */
  setLook(look) {
    const s = look.sky || {};
    const night = s.dark ? 1 : clamp(s.blue || 0, 0, 1);
    const gold = (s.gold || 0) * (1 - night);
    const kind = look.weather ? look.weather.kind : 'clear';
    const grey = kind === 'rain' ? 0.4 : kind === 'cloudy' || kind === 'snow' ? 0.22 : 0;
    this.lit.dark = night;
    this.weather.set(kind, look.weather && look.weather.level);
    const day = (1 - night) * (1 - grey);
    // the sky's light, the ground's
    _c.set('#fff7ee').lerp(_c2.set('#ffd8b0'), gold).lerp(_c2.set('#4a5898'), night);
    this.hemi.color.copy(_c);
    this.hemi.groundColor.set('#c9d8b0').lerp(_c2.set('#1c2040'), night);
    this.hemi.intensity = 0.55 + 0.75 * day + 0.12 * night; // (at night the street is lit by its lamps and its shops)
    // the sun — where the real one is (south is towards the camera: the shops' fronts face it) — or the moon
    let alt = 0.9;
    let az = 0;
    if (!s.dark && s.sun > 0) {
      alt = clamp((s.sun * Math.PI) / 180, 0.2, 1.3);
      az = s.sunAz || 0;
    } else if (s.moon && s.moon.up) {
      alt = clamp(s.moon.alt, 0.25, 1.3);
      az = s.moon.az || 0;
    }
    this.sunDir = V(-Math.sin(az) * Math.cos(alt), Math.sin(alt), Math.cos(az) * Math.cos(alt)).normalize();
    this.sun.color.set('#fffaf0').lerp(_c2.set('#ffc890'), gold).lerp(_c2.set('#9fb0ff'), night);
    this.sun.intensity = (0.25 + 1.6 * day) * (1 - night) + 0.35 * night * (s.moon && s.moon.up ? 0.4 + 0.6 * s.moon.fraction : 0.3);
    this.scene.background.set('#ffe6f0').lerp(_c2.set('#ffd2c4'), gold).lerp(_c2.set('#1c2147'), night * 0.92);
    if (kind === 'rain') this.scene.background.lerp(_c2.set('#9aa3b8'), 0.35 * (1 - night));
    this.scene.environmentIntensity = 0.5 - 0.25 * night;
    // the year: the trees' colours (bare, with snow on them, in the winter)
    const season = look.season || 'autumn';
    if (season !== this.season) {
      this.season = season;
      for (const k in SEASON_COLORS) {
        const c = SEASON_COLORS[k][season];
        this.map.mats[k].forEach((m) => m.color.set(c || '#ffffff'));
      }
      this.map.trees.forEach((t) => {
        t.crown.visible = !!SEASON_COLORS[t.kind][season];
        t.snow.visible = season === 'winter';
      });
      this.falling.set(season);
    }
    // (snow lying on the grass, while it snows — the grass greener again when it stops)
    const snowy = kind === 'snow' ? 1 : 0;
    if (snowy !== this.snowy) {
      this.snowy = snowy;
      const g = this.map.grass.material;
      g.map = snowy ? this.map.snowTex : this.map.grassTex;
      g.needsUpdate = true;
    }
    // the night: the lamps, the signs, the windows
    const on = night > 0.45 ? 1 : 0;
    this.lampsOn = on;
    this.bus.setNight(on);
    this.map.stop.redraw(look.shut ? look.opens || '' : '');
    this.map.lamps.forEach((l) => (l.glow.material.opacity = on * 0.55));
    for (const g of this.map.glows) {
      const k = g.base || 0;
      g.mat.emissiveIntensity = k + (g.warm ? (look.light ? g.k : 0.2) : g.k) * on;
    }
    this.setKaraokeOpen(!look.shut);
    this.homeLight = !!look.light;
  }

  /* Which lamps really light it (four): at night, the shops' insides and the street lamp nearest her. */
  lampsLit() {
    const on = this.lampsOn;
    const S = this.map.shops;
    const her = this.me ? this.me.pos : this.view.target;
    let nearest = null;
    let nd = Infinity;
    for (const l of this.map.lamps) {
      const d = Math.hypot(l.at.x - her.x, l.at.z - her.z);
      if (d < nd) {
        nd = d;
        nearest = l;
      }
    }
    const set = (l, at, color, power, range) => {
      l.position.copy(at);
      l.color.set(color);
      l.intensity = power;
      l.distance = range;
    };
    set(this.lamps[0], V(S.store.at.x, 1.7, S.store.at.z), '#f2fbff', on ? 1.6 : 0.25, 5.5);
    set(this.lamps[1], V(S.cafe.at.x, 1.6, S.cafe.at.z), '#ffd29a', on ? 1.5 : 0.2, 4.5);
    set(this.lamps[2], V(S.karaoke.at.x - 0.9, 1.5, S.karaoke.at.z - 0.7), '#ff6fb8', this.karaokeOpen ? (on ? 1.6 : 0.8) + (this.singing ? 0.6 * Math.abs(Math.sin(this.time * 4)) : 0) : 0, 3.2);
    if (nearest) set(this.lamps[3], V(nearest.at.x, nearest.at.y - 0.1, nearest.at.z), '#ffd98a', on ? 1.4 : 0, 5);
  }

  // ---------------------------------------------------------------- every frame

  update(dt) {
    const t = this.time;
    this.updateCoach(dt);
    // the camera with her (unless she has just moved it herself) — or with the bus she is on
    this.follow = Math.max(0, this.follow - dt);
    const c = this.coach;
    const riding = c && c.boarded && (c.phase === 'stop' || c.phase === 'go');
    if (this.me && this.follow <= 0) {
      const p = riding ? _w.set(c.x + 1.2, 0, this.places.bus.lane) : this.me.pos;
      this.view.target.x = damp(this.view.target.x, p.x, 2.2, dt);
      this.view.target.z = damp(this.view.target.z, p.z, 2.2, dt);
      this.view.target.y = 0.6;
    }
    this.placeCamera(dt);
    this.fold(dt);
    this.seeThrough(dt);
    this.doors(dt);
    this.lampsLit();
    // the sun's shadows, round where the camera looks
    const tg = this.cam.target;
    this.sun.target.position.set(tg.x, 0, tg.z);
    this.sun.position.copy(this.sun.target.position).addScaledVector(this.sunDir || V(0.3, 0.8, 0.5), 18);
    // the park: the swings settle, the pigeons peck — and fly off when she comes near
    for (const s of this.map.swings) {
      if (s.rider) continue;
      s.pivot.rotation.x = damp(s.pivot.rotation.x, 0, 1.5, dt);
    }
    this.pigeons(dt, t);
    // the karaoke's disco balls, the booth's screen
    this.map.shops.karaoke.balls.forEach((b, i) => (b.rotation.y = t * (i ? 0.6 : 0.9)));
    // the people: lit as the street is
    _c.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.32).add(_c2.copy(this.sun.color).multiplyScalar(this.sun.intensity * 0.2));
    const grey = (_c.r + _c.g + _c.b) / 3;
    _c.lerp(_c2.setScalar(Math.max(grey, 0.6)), 0.45);
    const sun = clamp(this.sun.intensity / 1.8, 0.25, 1);
    FUR_SUN.value.copy(this.sunDir || V(0.3, 0.8, 0.5));
    for (const who of [this.me, this.clerk, this.barista]) {
      if (!who || !who.on) continue;
      who.light(_c, sun);
      who.update(dt);
    }
    const cat = this.world.cat;
    if (cat.on && cat.world === this) cat.update(dt); // (뭉치, the stray: cat.js)
    this.weather.update(dt, tg);
    this.falling.update(dt, t);
    this.fx.update(dt);
  }

  /* The walls of the shops on her side fold down, as the house's do (their fronts are glass: those stay). */
  fold(dt) {
    const cam = this.camera.position;
    for (const name in this.map.shops) {
      const shop = this.map.shops[name];
      const shut = name === 'karaoke' && !this.karaokeOpen;
      _v.set(cam.x - shop.at.x, 0, cam.z - shop.at.z).normalize();
      for (const wall of shop.walls) {
        const facing = _v.dot(wall.out);
        if (shut) wall.want = 1;
        else if (facing > 0.3) wall.want = 0;
        else if (facing < 0.16) wall.want = 1;
        wall.shown = damp(wall.shown, wall.want, 7, dt);
        wall.pivot.scale.y = Math.max(0.06, wall.shown);
        wall.items.visible = wall.shown > 0.55;
      }
    }
  }

  /* Her cottage, a tree — whatever stands between the camera and her (her head, her feet) fades to let her be seen. */
  seeThrough(dt) {
    const me = this.me;
    const cam = this.camera.position;
    if (me && me.rig.group.visible) {
      const pts = [me.headPoint(_w).clone(), me.pos.clone().add(V(0, 0.3, 0))];
      for (const f of this.fadeables) {
        f.want = 1;
        for (const p of pts) {
          _ray.set(cam, p.clone().sub(cam).normalize());
          _ray.far = cam.distanceTo(p) - 0.2;
          if (_ray.intersectObjects(f.meshes, false).length) f.want = 0.22;
        }
        _ray.far = Infinity;
      }
    } else for (const f of this.fadeables) f.want = 1; // (she is on the bus: nothing to see her through)
    for (const f of this.fadeables) {
      const k = damp(f.k, f.want, 8, dt);
      if (Math.abs(k - f.k) < 1e-4 && k === f.want) continue;
      f.k = Math.abs(k - f.want) < 0.005 ? f.want : k;
      const solid = f.k > 0.995;
      for (const m of f.mats) {
        const see = !solid || m.userData.opacity0 < 1;
        if (m.transparent !== see) {
          m.transparent = see;
          m.needsUpdate = true; // (an opaque material's shader ignores its opacity)
        }
        m.opacity = m.userData.opacity0 * f.k;
        m.depthWrite = solid;
      }
    }
  }

  /* The doors: a shop's opens by itself when somebody is at it; her own, when she opens it. */
  doors(dt) {
    const who = [this.me, this.clerk, this.barista].filter((p) => p && p.on);
    for (const name in this.map.shops) {
      const shop = this.map.shops[name];
      const d = shop.doors[0];
      const at = _v.copy(d.local).add(shop.at);
      const near = who.some((p) => Math.hypot(p.pos.x - at.x, p.pos.z - at.z) < 1.0) && !(name === 'karaoke' && !this.karaokeOpen);
      d.want = near ? 1 : 0;
      d.open = damp(d.open, d.want, 5, dt);
      if (d.kind === 'slide') d.leaves.forEach((leaf) => (leaf.position.x = leaf.userData.x0 + leaf.userData.side * d.open * (d.w / 2 - 0.04)));
      else d.leaves.forEach((leaf) => (leaf.rotation.y = -d.open * 1.4));
    }
    this.homeDoor = damp(this.homeDoor, this.homeWant, 3.5, dt);
    this.map.home.door.rotation.y = this.homeDoor * 1.5;
  }

  pigeons(dt, t) {
    const me = this.me;
    for (const p of this.map.pigeons) {
      const g = p.group;
      const near = me && Math.hypot(me.pos.x - g.position.x, me.pos.z - g.position.z) < 1.1;
      if (p.state === 'peck') {
        p.t += dt;
        // a peck, a step, a turn
        p.head.rotation.x = Math.max(0, Math.sin(p.t * 5)) * 0.9 * (Math.sin(p.t * 0.7) > 0 ? 1 : 0);
        if (Math.sin(p.t * 0.9 + p.yaw) > 0.97) {
          p.yaw += (Math.random() - 0.5) * 1.5;
          g.rotation.y = p.yaw;
        }
        g.position.x += Math.sin(p.yaw) * dt * 0.05 * (Math.sin(p.t * 2) > 0.5 ? 1 : 0);
        g.position.z += Math.cos(p.yaw) * dt * 0.05 * (Math.sin(p.t * 2) > 0.5 ? 1 : 0);
        if (g.position.distanceTo(p.home) > 0.7) {
          p.yaw = Math.atan2(p.home.x - g.position.x, p.home.z - g.position.z);
          g.rotation.y = p.yaw;
        }
        if (near) {
          p.state = 'fly';
          p.fly = 0;
          p.dir = V(g.position.x - me.pos.x, 0, g.position.z - me.pos.z).normalize();
          if (!this.flapped || t - this.flapped > 2) {
            this.flapped = t;
            this.world.sound('flap');
          }
        }
      } else if (p.state === 'fly') {
        p.fly += dt;
        g.position.addScaledVector(p.dir, dt * 1.8);
        g.position.y = Math.min(4, p.fly * 2.2);
        g.rotation.y = Math.atan2(p.dir.x, p.dir.z);
        p.body.rotation.z = Math.sin(t * 30) * 0.15;
        if (p.fly > 2.2) {
          g.visible = false;
          p.state = 'away';
          p.fly = 0;
        }
      } else {
        p.fly += dt;
        if (p.fly > 12 && !(me && Math.hypot(me.pos.x - p.home.x, me.pos.z - p.home.z) < 2.5)) {
          g.visible = true;
          g.position.copy(p.home);
          p.state = 'peck';
          p.body.rotation.z = 0;
        }
      }
    }
  }

  // ---------------------------------------------------------------- the camera

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  aim(cam, yaw, pitch, dist, target) {
    cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(target);
  }

  placeCamera(dt, now = false) {
    const v = this.view;
    const c = this.cam;
    const k = now ? 1 : 1 - Math.exp(-dt * 5);
    c.yaw += angle(v.yaw - c.yaw) * k;
    c.pitch += (v.pitch - c.pitch) * k;
    c.zoom += (v.zoom - c.zoom) * k;
    c.target.lerp(v.target, k);
    this.aim(this.camera, c.yaw, c.pitch, (this.camera.aspect < 0.78 ? DIST_TALL : DIST) * c.zoom, c.target);
  }

  keepTarget() {
    const v = this.view;
    v.target.x = clamp(v.target.x, BOARD.x0 + 1, BOARD.x1 - 1);
    v.target.z = clamp(v.target.z, BOARD.z0 + 1, BOARD.z1 - 1);
  }

  home() {
    const tall = this.camera.aspect < 0.78;
    Object.assign(this.view, { yaw: tall ? YAW_TALL : YAW, pitch: PITCH, zoom: ZOOM0 });
    this.follow = 0;
  }

  ndc(x, y) {
    const r = this.world.canvas.getBoundingClientRect();
    _ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    return _ndc;
  }

  ray(x, y) {
    this.camera.updateMatrixWorld(true);
    _ray.setFromCamera(this.ndc(x, y), this.camera);
    return _ray;
  }

  groundAt(x, y) {
    return this.ray(x, y).ray.intersectPlane(_ground, V());
  }

  zoomAt(k, x, y) {
    const v = this.view;
    const before = v.zoom;
    v.zoom = clamp(v.zoom * k, ZOOM_MIN, ZOOM_MAX);
    const p = this.groundAt(x, y);
    if (p && v.zoom < before) {
      const f = 1 - v.zoom / before;
      v.target.x += (p.x - v.target.x) * f;
      v.target.z += (p.z - v.target.z) * f;
      this.follow = 4;
    }
    this.keepTarget();
  }

  /** What is under (x, y): { kind, point } — a shop, her house, the swings… one of the people — or the ground. */
  pick(x, y) {
    const ray = this.ray(x, y);
    const people = [this.me, this.clerk, this.barista, this.world.cat].filter((p) => p && p.on && (p !== this.world.cat || p.world === this));
    const targets = [...this.tapTargets];
    for (const p of people) targets.push(...p.meshes());
    const hits = ray.intersectObjects(targets, false).filter((h) => this.visibleUp(h.object) && h.object.type !== 'Sprite' && h.object.type !== 'Line');
    const who = hits.find((h) => h.object.userData.person);
    if (who) return { kind: who.object.userData.person, point: who.point };
    const near = this.nearPerson(x, y, people);
    if (near) return { kind: near, point: null };
    const hit = hits.find((h) => h.object.userData.tap);
    if (hit) return { kind: hit.object.userData.tap, point: hit.point };
    const g = this.groundAt(x, y);
    return g ? { kind: 'ground', point: g } : null;
  }

  visibleUp(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }

  nearPerson(x, y, people, reach = 22) {
    const r = this.world.canvas.getBoundingClientRect();
    const onPage = (p) => {
      p.project(this.camera);
      return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
    };
    let best = null;
    let bd = reach;
    for (const who of people) {
      const [hx, hy] = onPage(who.headPoint(_w));
      const [fx, fy] = onPage(_v.copy(who.pos));
      const dx = hx - fx;
      const dy = hy - fy;
      const len = dx * dx + dy * dy;
      const k = len ? clamp(((x - fx) * dx + (y - fy) * dy) / len, 0, 1) : 0;
      const d = Math.hypot(x - (fx + dx * k), y - (fy + dy * k));
      if (d < bd) {
        bd = d;
        best = who.who;
      }
    }
    return best;
  }

  onDown(e) {
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.fingers.size === 2) {
      const [a, b] = [...this.fingers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.view.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      this.pointer.down = false;
      return;
    }
    if (this.fingers.size > 2) return;
    this.pointer = { down: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId };
  }

  onMove(e) {
    const f = this.fingers.get(e.pointerId);
    if (f) {
      f.x = e.clientX;
      f.y = e.clientY;
    }
    if (this.pinch && this.fingers.size === 2) {
      const [a, b] = [...this.fingers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2;
      this.view.zoom = clamp(this.pinch.zoom * (this.pinch.d / Math.max(10, d)), ZOOM_MIN, ZOOM_MAX);
      const p0 = this.groundAt(this.pinch.mx, this.pinch.my);
      const p1 = this.groundAt(mx, my);
      if (p0 && p1) {
        this.view.target.x -= p1.x - p0.x;
        this.view.target.z -= p1.z - p0.z;
      }
      this.pinch.mx = mx;
      this.pinch.my = my;
      this.follow = 5;
      this.keepTarget();
      return;
    }
    const p = this.pointer;
    if (!p.down || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > TAP) p.moved = true;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!p.moved) return;
    this.view.yaw -= dx * 0.0085;
    this.view.pitch = clamp(this.view.pitch + dy * 0.0052, PITCH_MIN, PITCH_MAX);
  }

  onUp(e, cancelled = false) {
    this.fingers.delete(e.pointerId);
    if (this.fingers.size < 2) this.pinch = null;
    const p = this.pointer;
    if (!p.down || e.pointerId !== p.id) return;
    p.down = false;
    if (cancelled || p.moved) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (!hit) return;
    if (hit.kind === 'me' && this.me) {
      this.me.tapped();
      return this.host.onTap('me');
    }
    if (hit.kind === 'clerk') return this.clerk.tapped();
    if (hit.kind === 'barista') return this.barista.tapped();
    // the ground: she walks there (if she is free to) — the park's ground takes her to the park
    if (hit.kind === 'ground') {
      const q = hit.point;
      if (q.x < TOWN_PARK.x1 && q.z > TOWN_PARK.z0 && q.z < TOWN_PARK.z1 && this.place !== 'park') return this.host.onTownTap('park');
      if (!this.busy && this.me && this.grid.isOpen(q)) {
        this.go(q);
        this.host.onTown('wander'); // (out of wherever she was: the app's buttons follow)
        this.fx.emit('📍', q.clone().add(V(0, 0.15, 0)), { size: 0.14, rise: 0.15, life: 0.9 });
      }
      return;
    }
    this.host.onTownTap(hit.kind);
  }
}

/* What she carries round the shop: a basket in the store's mint. (In the frame of her hand, at her measure.) */
function makeBasket() {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#36c2a6', roughness: 0.5 });
  const box = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.08), mat);
  box.position.set(0, -0.06, 0.03);
  g.add(box);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.005, 4, 12, Math.PI), mat);
  handle.position.set(0, -0.03, 0.03);
  g.add(handle);
  const items = ['#ff8fb2', '#ffd23f', '#7fb6ff'];
  items.forEach((c, i) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.04, 0.03), new THREE.MeshStandardMaterial({ color: c, roughness: 0.5 }));
    m.position.set(-0.035 + i * 0.035, -0.03, 0.03);
    g.add(m);
  });
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

/* …and the plastic bag the clerk hands her: white, the store's mint and pink on it. */
function makeShopBag() {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.05, 12, 10), new THREE.MeshStandardMaterial({ color: '#f8fbfa', roughness: 0.4 }));
  body.scale.set(1.1, 1.25, 0.7);
  body.position.set(0, -0.085, 0.01);
  g.add(body);
  const band = new THREE.Mesh(new THREE.SphereGeometry(0.0505, 12, 6, 0, Math.PI * 2, Math.PI * 0.45, Math.PI * 0.12), new THREE.MeshStandardMaterial({ color: '#36c2a6', roughness: 0.5 }));
  band.scale.copy(body.scale);
  band.position.copy(body.position);
  g.add(band);
  for (const s of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 4, 10, Math.PI), new THREE.MeshStandardMaterial({ color: '#f8fbfa', roughness: 0.4 }));
    loop.position.set(s * 0.012, -0.025, 0.01);
    g.add(loop);
  }
  g.userData.shopBag = true;
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

/* The karaoke's microphone: black, its silver head. */
function makeMic() {
  const g = new THREE.Group();
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.006, 0.07, 10), new THREE.MeshStandardMaterial({ color: '#2b2427', roughness: 0.4 }));
  handle.position.set(0, 0.01, 0.01);
  g.add(handle);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), new THREE.MeshStandardMaterial({ color: '#d9dbe2', roughness: 0.3, metalness: 0.8 }));
  head.position.set(0, 0.05, 0.01);
  g.add(head);
  g.userData.mic = true;
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}
