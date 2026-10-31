// 둘의 집 — the house, on the whole screen: one room seen like a doll's house, everything in
// it where she put it. A finger turns it round (the walls on her side fold away), two fingers
// or the wheel bring it closer. A tap on a thing does what that thing is for — the record
// player plays her LPs, the diary on the desk opens, the frames show her pictures, the window
// tells her about tonight's sky — and in the shop's arranging mode a touch picks a thing up and
// moves it about the floor (or along the walls), a square of the floor at a time.
//
// The light is the light of the hour: the day through the window, a patch of sun on the floor
// where the real sun puts it, the gold of the evening, the night — and then the lamps she has,
// and the light by the door, which she can switch off.
//
// Who is in it: the girl who lives there (resident.js), Lorelei when she comes round (guest.js),
// and the courier at the door with something she ordered (courier.js).
//
// And out of the front door is the street round the corner (town.js): the same screen shows it while she is out — the
// convenience store, the café, the coin karaoke, the park — and the house again when she comes home.
import * as THREE from '../vendor/three.module.min.js';
import { FUR_SUN } from '../fox/rig.js';
import { disposeTree } from '../fox/kit.js';
import { V, wallpaper, floorTexture } from './shapes.js';
import { FURNITURE, CELL, makeFurniture } from './furniture.js';
import { Room, roomSpec, wallFrame, WALL_H } from './room.js';
import { Veranda } from './veranda.js';
import { Guest } from './guest.js';
import { Resident } from './resident.js';
import { Courier } from './courier.js';
import { makeFood } from './food.js';
import { makeIngredient } from './meals.js';
import { Fx } from './fx.js';
import { Town } from './town.js';
import { Cat } from './cat.js';
import { CatPlay } from './catplay.js';

const FOV = 32;
const YAW = -0.62; //            where the camera stands at first: in front, a little to the left…
const YAW_TALL = -1.16; //       (…further round to the left on a screen held upright: the room's long side runs up it)
const PITCH = 0.86; //           …looking down this steeply
const PITCH_TALL = 0.98; //      (…and a little more on a screen held upright)
const PITCH_MIN = 0.4;
const PITCH_MAX = 1.32;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.22;
const LAMPS = 4; //              how many of her lamps really light the room (the others only glow)
const TAP = 9; //                how far a finger may move and still tap (px)
const _v = V();
const _w = V();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _floor = new THREE.Plane(V(0, 1, 0), 0);
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));

export class HouseWorld {
  constructor(host) {
    this.host = host;
    this.time = 0;
    this.stage = null;
    this.raf = 0;
    this.onScreen = true;
    this.quality = 0;
    this.frames = 0;
    this.slowFrames = 0;
    this.graceUntil = 0;

    const canvas = (this.canvas = document.createElement('canvas'));
    canvas.className = 'house-canvas';
    const context = canvas.getContext('webgl2', { alpha: false, antialias: true, depth: true, stencil: false, powerPreference: 'default' });
    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false, powerPreference: 'default' }));
    this.coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(this.pixelRatio);
    renderer.toneMapping = THREE.NeutralToneMapping;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#ffe6f0');
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.3, 80);
    this.view = { yaw: YAW, pitch: PITCH, zoom: 1, target: V(0, 0.45, 0) }; // what she asked for…
    this.cam = { yaw: YAW, pitch: PITCH, zoom: 1, target: V(0, 0.45, 0), dist: 12 }; // …and where the camera is, on its way there
    this.fit = 12; //            how far away the camera stands for the whole room to show
    this.inset = { right: 0, bottom: 0 };
    this.margin = { top: 0, bottom: 0 }; // (what of the view the buttons over it take, top and bottom: the room is fitted between them)

    // the light of the room: the sky's (hemisphere), a light from above that casts the shadows (the day; at night, the
    // light by the door), and her lamps
    this.hemi = new THREE.HemisphereLight('#fff7ee', '#d9c6b0', 1.2);
    this.key = new THREE.DirectionalLight('#fffaf0', 1.5);
    this.key.castShadow = true;
    this.key.shadow.mapSize.setScalar(this.coarse ? 1536 : 2048);
    Object.assign(this.key.shadow.camera, { left: -6.5, right: 6.5, top: 6.5, bottom: -6.5, near: 1, far: 30 });
    this.key.shadow.bias = -0.0006;
    this.key.shadow.normalBias = 0.025;
    this.key.position.set(-3.2, 9, 4.2);
    scene.add(this.hemi, this.key, this.key.target);
    this.lamps = [];
    // (always there, if unlit: a light that comes and goes would have every material in the room built again)
    for (let i = 0; i < LAMPS; i++) {
      const l = new THREE.PointLight('#ffc98a', 0, 3, 1.6);
      scene.add(l);
      this.lamps.push(l);
    }
    this.makeEnvironment();

    this.room = new Room(this);
    scene.add(this.room.group);
    this.items = new Map(); // uid → { uid, id, it, place, kind, bounce }
    this.media = { photos: new Map(), posters: new Map(), record: null, spines: [], page: null };
    this.look = null;
    this.spec = null;
    this.grid = null;
    this.guest = new Guest(this); //  Lorelei, when she comes round
    this.me = new Resident(this); //    …and the girl who lives here
    this.courier = new Courier(this); // …and at the door, now and then, the courier
    this.cat = new Cat(this); //        …and 뭉치, the white cat: a stray on the street, then (taken home) hers (cat.js)
    this.catHome = false; //            (whether it lives here: the app's — look.cat)
    this.play = null; //                 the game she is playing with it (catplay.js)
    this.catAte = -999; //               when it last went to its bowls, and last asked for its dinner
    this.catAsked = -999;
    this.food = null; //                 what she has ordered and is waiting for (the app's: { order })
    this.fx = new Fx(scene);
    this.bubbles = { guest: { el: null, until: 0 }, me: { el: null, until: 0 }, rider: { el: null, until: 0 }, clerk: { el: null, until: 0 }, barista: { el: null, until: 0 }, cat: { el: null, until: 0 } }; // what each of them says, over their head
    this.where = 'home'; //            …or 'town': she is out (and the street is shown)
    this.town = null; //               (built the first time she goes out)
    this.veranda = null; //            …and the veranda outside the window, the first time she steps out on it (veranda.js)
    this.going = false; //             (on her way out of the door)
    this.showcaseOn = false; //         the girl is being dressed: the camera comes close to her
    this.viewWas = null;
    this.lit = { dark: 0, light: true }; // how dark it is outside (0 … 1), and whether the room's light is on
    this.held = null; //   (arranging) the thing she has picked
    this.drag = null; //   …and is moving: { entry, dx, dz, ok, last }
    this.edit = false;
    this.pointer = { down: false, x: 0, y: 0, moved: false, id: -1 };
    this.fingers = new Map();
    this.pinch = null;
    this.thumbs = new Map();

    // what shows round a thing she is moving: a frame on the floor (or on the wall), white where it may go, red where it may not
    const mk = () => {
      const g = new THREE.Group();
      const m = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9, depthWrite: false });
      for (let i = 0; i < 4; i++) g.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), m));
      g.userData.mat = m;
      g.visible = false;
      g.renderOrder = 20;
      scene.add(g);
      return g;
    };
    this.outline = mk();

    this.tick = this.tick.bind(this);
    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e, true));
    canvas.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        if (this.where === 'town') this.town.zoomAt(Math.exp(e.deltaY * 0.0012), e.clientX, e.clientY);
        else if (this.where === 'veranda') this.veranda.zoomAt(Math.exp(e.deltaY * 0.0012), e.clientX, e.clientY);
        else this.zoomAt(Math.exp(e.deltaY * 0.0012), e.clientX, e.clientY);
      },
      { passive: false }
    );
    canvas.addEventListener('webglcontextlost', (e) => e.preventDefault());
    canvas.addEventListener('webglcontextrestored', () => this.wake());
    document.addEventListener('visibilitychange', () => this.wake());
  }

  /** A soft lit room to reflect in the glossy things (the mugs, the fridge, the record). */
  makeEnvironment() {
    const room = new THREE.Scene();
    const shell = new THREE.Mesh(new THREE.SphereGeometry(10, 24, 12), new THREE.MeshBasicMaterial({ side: THREE.BackSide, vertexColors: true }));
    const pos = shell.geometry.attributes.position;
    const col = new Float32Array(pos.count * 3);
    const top = new THREE.Color('#fff3ea');
    const low = new THREE.Color('#9a7f74');
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 10;
      _c.copy(low).lerp(top, clamp(y * 0.8 + 0.5, 0, 1));
      col.set([_c.r, _c.g, _c.b], i * 3);
    }
    shell.geometry.setAttribute('color', new THREE.BufferAttribute(col, 3));
    room.add(shell);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(2.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 5.6, 5) }));
    lamp.position.set(-5, 7, 3);
    room.add(lamp);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(room, 0.03).texture;
    this.scene.environmentIntensity = 0.5;
    pmrem.dispose();
    shell.geometry.dispose();
    shell.material.dispose();
    lamp.geometry.dispose();
    lamp.material.dispose();
  }

  // ---------------------------------------------------------------- mounting & the loop

  mount(stage) {
    if (this.stage === stage) return;
    this.unmount();
    this.stage = stage;
    this.where = 'home';
    this.going = false;
    stage.prepend(this.canvas);
    for (const who in this.bubbles) this.bubbles[who].el = stage.querySelector(`[data-house-bubble="${who}"]`);
    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(stage);
    this.io = new IntersectionObserver((entries) => {
      this.onScreen = entries[entries.length - 1].isIntersecting;
      this.wake();
    });
    this.io.observe(stage);
    this.onScreen = true;
    this.resize();
    this.view.yaw = this.yaw0();
    this.view.pitch = this.pitch0();
    this.view.zoom = 1;
    this.view.target.set(0, 0.45, 0);
    Object.assign(this.cam, { yaw: this.view.yaw + 0.5, pitch: this.view.pitch - 0.12, zoom: 1.25 }); // (it swings in, as she arrives)
    this.cam.target.copy(this.view.target);
    this.me.enter();
    this.catEnter();
    this.grace(1500);
    this.wake();
  }

  unmount() {
    if (this.play) this.play.end(true);
    if (!this.stage) return;
    this.ro.disconnect();
    this.io.disconnect();
    this.canvas.remove();
    this.stage = null;
    for (const who in this.bubbles) this.bubbles[who].el = null;
    this.pointer.down = false;
    this.fingers.clear();
    this.pinch = null;
    this.drag = null;
    this.guest.leave(true);
    this.cat.hide();
    this.courier.vanish(true);
    if (this.where === 'town') this.backHome(true);
    if (this.where === 'veranda') this.fromVeranda(true);
    if (this.me.cooking) this.me.cooking.abandon();
    this.going = false;
    this.me.on = false;
    this.setShowcase(false);
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  resize() {
    if (!this.stage) return;
    const w = Math.max(2, this.stage.clientWidth);
    const h = Math.max(2, this.stage.clientHeight);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    if (this.town) this.town.resize(w, h);
    if (this.veranda) this.veranda.resize(w, h);
    this.frameView();
    this.fitRoom();
    this.place(0, true);
    this.draw();
  }

  wake() {
    if (this.raf || !this.stage || document.hidden || !this.onScreen) return;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  }

  tick(now) {
    this.raf = 0;
    if (!this.stage || document.hidden || !this.onScreen) return;
    const real = (now - this.last) / 1000;
    this.last = now;
    this.update(Math.min(0.05, Math.max(0, real)));
    this.draw();
    this.watchSpeed(real, now);
    this.raf = requestAnimationFrame(this.tick);
  }

  /* On a device that can't keep up: fewer pixels, then smaller shadows. */
  watchSpeed(real, now) {
    if (real > 0.1 || now < this.graceUntil || this.quality >= 2) return;
    this.frames++;
    if (real > 0.034) this.slowFrames++;
    if (this.frames < 150) return;
    const crawling = this.slowFrames > 95;
    this.frames = this.slowFrames = 0;
    if (!crawling) return;
    this.quality++;
    this.pixelRatio = this.quality === 1 ? Math.min(this.pixelRatio, 1.5) : 1;
    if (this.quality === 2) {
      this.key.shadow.mapSize.setScalar(1024);
      if (this.key.shadow.map) {
        this.key.shadow.map.dispose();
        this.key.shadow.map = null;
      }
    }
    this.resize();
  }

  grace(ms = 900) {
    this.graceUntil = performance.now() + ms;
    this.frames = this.slowFrames = 0;
  }

  draw() {
    if (this.where === 'town' && this.town) this.renderer.render(this.town.scene, this.town.camera);
    else if (this.where === 'veranda' && this.veranda) this.renderer.render(this.veranda.scene, this.veranda.camera);
    else this.renderer.render(this.scene, this.camera);
  }

  /** The camera that is showing: the house's, or the street's. */
  get viewCamera() {
    if (this.where === 'veranda' && this.veranda) return this.veranda.camera;
    return this.where === 'town' && this.town ? this.town.camera : this.camera;
  }

  // ---------------------------------------------------------------- what is shown

  /** Bring the house in line with the app's: see host.look() in js/house.js. */
  apply(look) {
    const prev = this.look;
    this.look = look;
    const spec = roomSpec(look.size);
    if (!this.spec || this.spec.size !== spec.size) {
      this.spec = spec;
      this.room.build(spec);
      // (the things on the walls hang in the walls' new groups)
      this.items.forEach((e) => e.kind === 'wall' && this.hang(e));
      this.fitRoom();
    }
    if (!prev || prev.wall !== look.wall) this.room.setWallpaper(look.wall);
    if (!prev || prev.floor !== look.floor) this.room.setFloor(look.floor);
    this.setItems(look.items);
    this.setEdit(!!look.edit, look.held || null);
    this.room.setSwitch(look.light);
    this.lit.light = !!look.light;
    this.room.setView({ sky: look.sky, weather: look.weather, season: look.season });
    this.setLight();
    this.forEach('mail', (it) => it.set('mail', look.mail));
    this.forEach('calendar', (it) => it.set('calendar', look.calendar));
    this.forEach('magnets', (it) => it.set('magnets', look.magnets || 0));
    this.forEach('ready', (it) => it.set('ready', look.diaryReady));
    this.radioOn = !!look.radio;
    this.items.forEach((e) => e.id === 'radio' && e.it.set('on', this.radioOn));
    this.setGift(!!look.gift);
    this.food = look.food || null;
    this.items.forEach((e) => e.id === 'cat-bowl' && e.it.set('bowl', look.cat));
    this.grid = null;
    // the girl who lives here: dressed as the app has her (built again when anything changed — then she gives a twirl)
    if (look.me && look.me.look) {
      const anew = this.me.setLook(look.me.look);
      if (anew && this.stage) this.me.twirl();
      if (this.stage && !this.me.on) this.me.enter();
    }
    this.setShowcase(!!(look.me && look.me.showcase));
    const home = !!(look.cat && look.cat.adopted);
    if (home !== this.catHome) {
      this.catHome = home;
      if (this.stage && this.where !== 'town' && home && !this.cat.on) this.catEnter();
    }
    if (this.town) this.town.setLook(look);
    if (this.veranda) this.veranda.setLook(look);
  }

  /* Every thing that can be told `what` (a set() that knows it), with its id. */
  forEach(what, fn) {
    const KNOWS = { mail: ['mailbox'], calendar: ['calendar'], magnets: ['fridge'], ready: ['desk'] };
    this.items.forEach((e) => KNOWS[what].includes(e.id) && e.it.set && fn(e.it, e));
  }

  /** The things as the app has them: [{ uid, id, x, z, r } or { uid, id, wall, u, y }]. New ones are built, gone ones go, the rest move. */
  setItems(list) {
    const keep = new Set();
    for (const p of list) {
      if (!FURNITURE[p.id]) continue;
      keep.add(p.uid);
      let e = this.items.get(p.uid);
      if (!e || e.id !== p.id) {
        if (e) this.drop(e);
        const it = makeFurniture(p.id, { seed: hash(p.uid) });
        if (!it) continue;
        e = { uid: p.uid, id: p.id, it, kind: it.def.kind, place: null, bounce: 0, lift: 0 };
        it.object.traverse((o) => (o.userData.uid = p.uid));
        this.items.set(p.uid, e);
        if (e.kind !== 'wall') this.scene.add(it.object);
        this.restore(e);
      }
      // (the one she is moving keeps where her finger has it)
      if (this.drag && this.drag.entry === e) continue;
      e.place = e.kind === 'wall' ? { wall: p.wall, u: p.u, y: p.y } : { x: p.x, z: p.z, r: p.r || 0 };
      this.position(e);
    }
    this.items.forEach((e, uid) => !keep.has(uid) && this.drop(e));
  }

  drop(e) {
    if (e.it.object.parent) e.it.object.parent.remove(e.it.object);
    disposeTree(e.it.object);
    this.items.delete(e.uid);
    if (this.held === e.uid) this.held = null;
  }

  /* What the app gave a thing to show (a picture, a record) goes back on it when it is built again. */
  restore(e) {
    const m = this.media;
    if ((e.id === 'frame' || e.id === 'frame-tall') && m.photos.has(e.uid)) e.it.set('photo', m.photos.get(e.uid));
    if (e.id === 'poster' && m.posters.has(e.uid)) e.it.set('poster', m.posters.get(e.uid));
    if (e.id === 'record') {
      e.it.set('record', m.record);
      e.it.set('spines', m.spines);
    }
    if (e.id === 'desk' && m.page) e.it.set('page', m.page);
  }

  /** Put a thing where its place says. */
  position(e) {
    const p = e.place;
    const o = e.it.object;
    if (e.kind === 'wall') {
      this.hang(e);
      const f = wallFrame(this.spec, p.wall);
      o.position.copy(f.at(p.u, p.y));
      o.rotation.set(0, f.yaw, 0);
    } else {
      o.position.set(p.x, 0, p.z);
      o.rotation.set(0, (p.r || 0) * (Math.PI / 2), 0);
    }
  }

  /* A thing for the wall hangs in its wall's group (so that it hides when the wall folds away). */
  hang(e) {
    const wall = this.room.walls[e.place ? e.place.wall : 'back'];
    if (wall && e.it.object.parent !== wall.items) wall.items.add(e.it.object);
  }

  /* ----- what the app sends that is too big for look() ----- */

  setPhoto(uid, img) {
    if (img) this.media.photos.set(uid, img);
    else this.media.photos.delete(uid);
    const e = this.items.get(uid);
    if (e && e.it.set) e.it.set('photo', img || null);
  }

  setPoster(uid, v) {
    if (v) this.media.posters.set(uid, v);
    else this.media.posters.delete(uid);
    const e = this.items.get(uid);
    if (e && e.it.set) e.it.set('poster', v || null);
  }

  /** The record on the turntable: { disc (canvas), art (image), playing, progress } — or null. */
  setRecord(v) {
    this.media.record = v;
    this.items.forEach((e) => e.id === 'record' && e.it.set('record', v));
  }

  setSpines(colors) {
    this.media.spines = colors || [];
    this.items.forEach((e) => e.id === 'record' && e.it.set('spines', this.media.spines));
  }

  setDiaryPage(canvas) {
    this.media.page = canvas || null;
    this.items.forEach((e) => e.id === 'desk' && e.it.set('page', this.media.page));
  }

  /* A present of a day worth remembering, waiting by the door: a parcel to tap. */
  setGift(on) {
    if (on && !this.parcel) {
      const g = new THREE.Group();
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.3, 0.36), new THREE.MeshStandardMaterial({ color: '#ff8fbd', roughness: 0.55 }));
      box.position.y = 0.15;
      const lid = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.07, 0.4), new THREE.MeshStandardMaterial({ color: '#ff6fa8', roughness: 0.5 }));
      lid.position.y = 0.33;
      const ribbonMat = new THREE.MeshStandardMaterial({ color: '#fffaf1', roughness: 0.5 });
      const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.41, 0.375, 0.07), ribbonMat);
      r1.position.y = 0.185;
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.375, 0.41), ribbonMat);
      r2.position.y = 0.185;
      const bow = new THREE.Group();
      for (const s of [-1, 1]) {
        const loop = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.02, 8, 16), ribbonMat);
        loop.position.set(s * 0.06, 0.4, 0);
        loop.rotation.set(0, 0, s * 0.5);
        bow.add(loop);
      }
      g.add(box, lid, r1, r2, bow);
      g.traverse((o) => {
        if (o.isMesh) {
          o.castShadow = o.receiveShadow = true;
          o.userData.tap = 'gift';
        }
      });
      this.scene.add(g);
      this.parcel = g;
    }
    if (this.parcel) {
      this.parcel.visible = on;
      const door = this.room.doorway();
      this.parcel.position.set(door.inside.x - 0.25, 0, door.inside.z - 0.5);
    }
  }

  // ---------------------------------------------------------------- the light of the hour

  /** How the room is lit: by the day, the evening, the night outside — and at night by its light (if it is on) and her lamps. */
  setLight() {
    const look = this.look;
    if (!look) return;
    const s = look.sky || {};
    const night = s.dark ? 1 : clamp(s.blue || 0, 0, 1);
    const gold = (s.gold || 0) * (1 - night);
    const kind = look.weather ? look.weather.kind : 'clear';
    const grey = kind === 'rain' ? 0.35 : kind === 'cloudy' || kind === 'snow' ? 0.18 : 0;
    const on = !!look.light;
    this.lit.dark = night;
    // the sky's light: from the window by day; by night, the room's own — or almost none, with it off
    const day = (1 - night) * (1 - grey);
    _c.set('#fff7ee').lerp(_c2.set('#ffd8b0'), gold);
    const sky = _c.clone().lerp(_c2.set(on ? '#ffe2c0' : '#56649e'), night);
    const ground = new THREE.Color('#d9c6b0').lerp(_c2.set(on ? '#8a6a58' : '#2c2a44'), night);
    this.hemi.color.copy(sky);
    this.hemi.groundColor.copy(ground);
    this.hemi.intensity = 0.55 + 0.6 * day + (on ? 0.58 * night : 0.04 * night) + (on ? 0.12 : 0);
    // the light from above: the day (and the light on the ceiling, a little) — at night, the ceiling light alone
    this.key.color.set('#fffaf0').lerp(_c2.set('#ffd9a8'), Math.max(gold * 0.6, on ? night : 0));
    if (!on) this.key.color.lerp(_c2.set('#9fb0ff'), night);
    this.key.intensity = 0.25 + 1.15 * day + (on ? 1.05 * night : 0.12 * night);
    // what is round the house: the pink of the day, the gold of the evening, the deep blue of the night
    this.scene.background.set('#ffe6f0').lerp(_c2.set('#ffd2c4'), gold).lerp(_c2.set('#1c2147'), night * 0.92);
    this.scene.environmentIntensity = 0.5 - 0.25 * night;
    this.lampsLit();
  }

  /* Which of her lamps are on: at night by themselves, unless she switched one off (or on, by day). */
  lampsLit() {
    const look = this.look || {};
    const manual = look.lamps || {};
    const dark = this.lit.dark > 0.45;
    const lights = [];
    this.items.forEach((e) => {
      const L = e.it.light;
      if (!L) return;
      const m = manual[e.uid];
      const on = m === undefined ? dark : !!m;
      e.it.set('on', on);
      e.lit = on;
      if (on) lights.push(e);
    });
    // (the big lamps light the room for real; the rest only glow)
    lights.sort((a, b) => (a.it.light.small ? 1 : 0) - (b.it.light.small ? 1 : 0));
    this.lamps.forEach((l, i) => {
      const e = lights[i];
      if (!e) {
        l.intensity = 0;
        return;
      }
      const L = e.it.light;
      e.it.object.updateMatrixWorld(true);
      l.position.copy(V(...L.at).applyMatrix4(e.it.object.matrixWorld));
      l.color.set(L.color);
      l.distance = L.range;
      l.intensity = L.power * (1.2 + 1.6 * this.lit.dark);
    });
  }

  // ---------------------------------------------------------------- every frame

  update(dt) {
    this.time += dt;
    const t = this.time;
    if (this.where === 'town') {
      this.town.update(dt);
      this.placeBubbles();
      return;
    }
    if (this.where === 'veranda') {
      this.veranda.update(dt);
      this.placeBubbles();
      return;
    }
    this.placeCamera(dt);
    this.room.cut(this.camera.position, dt);
    this.room.update(dt, t);
    const ctx = { dark: this.lit.dark, fx: (g, at) => this.fx.emit(g, at) };
    this.items.forEach((e) => {
      if (e.it.update) e.it.update(dt, t, ctx);
      // (a tapped thing gives a little bounce; one picked up to move floats)
      if (e.bounce > 0) {
        e.bounce = Math.max(0, e.bounce - dt * 2.6);
        const k = Math.sin(e.bounce * Math.PI * 2.5) * e.bounce * 0.07;
        e.it.object.scale.set(1 + k, 1 - k, 1 + k);
      }
      const lift = this.held === e.uid && e.kind === 'floor' ? 0.06 + Math.sin(t * 4) * 0.015 : 0;
      e.lift = damp(e.lift, lift, 10, dt);
      if (e.kind !== 'wall') e.it.object.position.y = e.lift;
    });
    if (this.parcel && this.parcel.visible) {
      this.parcel.rotation.y = Math.sin(t * 1.4) * 0.12;
      this.parcel.position.y = Math.abs(Math.sin(t * 2.6)) * 0.03;
    }
    this.fx.update(dt);
    // the two of them: lit as the room is, and the way the light falls — and out of each other's way
    _c.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.32).add(_c2.copy(this.key.color).multiplyScalar(this.key.intensity * 0.2));
    const grey = (_c.r + _c.g + _c.b) / 3;
    _c.lerp(_c2.setScalar(Math.max(grey, 0.6)), 0.45);
    const sun = clamp(this.key.intensity / 1.6, 0.25, 1);
    FUR_SUN.value.copy(this.key.position).sub(this.key.target.position).normalize();
    for (const who of [this.me, this.guest, this.courier]) {
      if (!who.on) continue;
      who.light(_c, sun);
      who.update(dt);
    }
    if (this.play) this.play.update(dt);
    if (this.cat.on && this.cat.world === this) this.cat.update(dt);
    // (she is done with 뭉치: the camera goes back — frameCat)
    if (this.catFramed && !(this.me.task && (this.me.task.do === 'petCat' || this.me.task.do === 'feedCat'))) {
      this.catFramed = false;
      this.frameAt(null);
    }
    this.makeRoom();
    // (being dressed: the camera stays with her)
    if (this.showcaseOn && this.me.on) this.view.target.set(this.me.pos.x, 0.62, this.me.pos.z);
    this.updateOutline();
    this.placeBubbles();
  }

  /* The two of them do not walk through each other: standing too close, each steps aside a little. */
  makeRoom() {
    const a = this.me;
    const b = this.guest;
    if (!a.on || !b.on || a.seat || a.abed || b.seat || b.abed) return;
    const dx = b.pos.x - a.pos.x;
    const dz = b.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    const R = 0.3;
    if (d >= R || d < 1e-4) return;
    const push = (R - d) * 0.5;
    a.pos.x -= (dx / d) * push;
    a.pos.z -= (dz / d) * push;
    b.pos.x += (dx / d) * push;
    b.pos.z += (dz / d) * push;
  }

  // ---------------------------------------------------------------- the camera

  /**
   * Where the room is drawn: some of the screen may be covered — by the shop's drawer (`right` or `bottom`: the view
   * is moved out of its way), and by the buttons along the top and the bottom (`top`, `low`: the room is fitted between).
   */
  setInset(inset) {
    const o = inset || {};
    this.inset = { right: o.right || 0, bottom: o.bottom || 0 };
    this.margin = { top: o.top || 0, bottom: o.low || 0 };
    this.frameView();
    this.fitRoom();
  }

  /* The view is moved so that the room is in the middle of what shows between the buttons (and beside the drawer). */
  frameView() {
    if (!this.stage) return;
    const w = Math.max(2, this.stage.clientWidth);
    const h = Math.max(2, this.stage.clientHeight);
    const right = this.inset.right;
    const bottom = Math.max(this.inset.bottom, this.margin.bottom);
    const top = this.margin.top;
    const dy = (bottom - top) / 2; //  (up, px)
    const dx = right / 2; //           (to the left, px)
    this.camera.aspect = w / h;
    for (const cam of [this.camera, this.town && this.town.camera, this.veranda && this.veranda.camera].filter(Boolean)) {
      cam.aspect = w / h;
      if (dx || dy) cam.setViewOffset(w + 2 * dx, h + 2 * Math.abs(dy), 2 * dx, dy > 0 ? 2 * dy : 0, w, h);
      else cam.clearViewOffset();
      cam.updateProjectionMatrix();
    }
    // (what shows, in the camera's −1 … 1)
    this.band = { top: 1 - (2 * top) / h, low: -1 + (2 * bottom) / h, right: 1 - (2 * right) / w };
  }

  /** How far away the camera has to be for all of the room to show, from where it looks (searched for, a corner at a time). */
  fitRoom() {
    if (!this.spec || !this.stage) return;
    const { w, d } = this.spec;
    const pts = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) for (const y of [0, WALL_H * 0.85]) pts.push(V((sx * (w + 0.3)) / 2, y, (sz * (d + 0.3)) / 2));
    const cam = this.camera;
    const target = V(0, 0.45, 0);
    const b = this.band || { top: 1, low: -1, right: 1 };
    let lo = 3;
    let hi = 40;
    for (let i = 0; i < 22; i++) {
      const dist = (lo + hi) / 2;
      this.aim(cam, this.yaw0(), this.pitch0(), dist, target);
      cam.updateMatrixWorld(true);
      const inside = pts.every((p) => {
        _v.copy(p).project(cam);
        return _v.x > -0.93 && _v.x < b.right - 0.07 && _v.y < b.top - 0.05 && _v.y > b.low + 0.05 && _v.z < 1;
      });
      if (inside) hi = dist;
      else lo = dist;
    }
    this.fit = hi;
  }

  aim(cam, yaw, pitch, dist, target) {
    cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(target);
  }

  placeCamera(dt, now = false) {
    const v = this.view;
    const c = this.cam;
    const k = now ? 1 : 1 - Math.exp(-dt * 6);
    c.yaw += angle(v.yaw - c.yaw) * k;
    c.pitch += (v.pitch - c.pitch) * k;
    c.zoom += (v.zoom - c.zoom) * k;
    c.target.lerp(v.target, k);
    this.aim(this.camera, c.yaw, c.pitch, this.fit * c.zoom, c.target);
  }

  place(dt, now) {
    this.placeCamera(dt, now);
    this.room.cut(this.camera.position, dt, now);
  }

  /** She brought the room closer or sent it further away (k < 1: closer), round the point under (x, y) on the screen. */
  zoomAt(k, x, y) {
    const v = this.view;
    const before = v.zoom;
    v.zoom = clamp(v.zoom * k, ZOOM_MIN, ZOOM_MAX);
    const p = this.floorAt(x, y);
    if (p && v.zoom < before) {
      // (closer: towards what is under her fingers)
      const f = 1 - v.zoom / before;
      v.target.x += (p.x - v.target.x) * f;
      v.target.z += (p.z - v.target.z) * f;
    }
    this.keepTarget();
  }

  keepTarget() {
    const v = this.view;
    if (!this.spec) return;
    // (the further away, the closer to the middle the view must stay)
    const k = clamp((ZOOM_MAX - v.zoom) / (ZOOM_MAX - ZOOM_MIN), 0, 1);
    v.target.x = clamp(v.target.x, (-this.spec.w / 2) * k, (this.spec.w / 2) * k);
    v.target.z = clamp(v.target.z, (-this.spec.d / 2) * k, (this.spec.d / 2) * k);
    if (v.zoom > 0.98) v.target.set(v.target.x * 0.9, 0.45, v.target.z * 0.9);
  }

  /** Where the camera stands at first, for this screen. */
  yaw0() {
    return this.camera.aspect < 0.78 ? YAW_TALL : YAW;
  }

  pitch0() {
    return this.camera.aspect < 0.78 ? PITCH_TALL : PITCH;
  }

  /** Back to how it was when she came in. */
  home() {
    if (this.where === 'town') return this.town.home();
    if (this.where === 'veranda') return this.veranda.home();
    Object.assign(this.view, { yaw: this.yaw0(), pitch: this.pitch0(), zoom: 1 });
    this.view.target.set(0, 0.45, 0);
  }

  /** Bring a thing into view, closer (when it is tapped: the sheet that opens covers the bottom of the screen). */
  focus(uid) {
    const e = this.items.get(uid);
    if (!e) return;
    const o = e.it.object;
    o.updateMatrixWorld(true);
    _v.setFromMatrixPosition(o.matrixWorld);
    this.view.target.set(_v.x * 0.7, 0.45, _v.z * 0.7);
    this.view.zoom = Math.min(this.view.zoom, 0.72);
  }

  // ---------------------------------------------------------------- touching it

  ndc(x, y) {
    const r = this.canvas.getBoundingClientRect();
    _ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    return _ndc;
  }

  ray(x, y) {
    this.camera.updateMatrixWorld(true);
    _ray.setFromCamera(this.ndc(x, y), this.camera);
    return _ray;
  }

  floorAt(x, y, h = 0) {
    _floor.constant = -h;
    const p = this.ray(x, y).ray.intersectPlane(_floor, V());
    return p;
  }

  /** What is under (x, y): { kind: 'item' | 'guest' | 'window' | 'door' | 'switch' | 'gift', uid, point } — or null. */
  pick(x, y) {
    const ray = this.ray(x, y);
    const targets = [];
    this.items.forEach((e) => {
      if (e.kind === 'wall' && !(e.it.object.parent && e.it.object.parent.visible)) return;
      targets.push(e.it.object);
    });
    if (this.parcel && this.parcel.visible) targets.push(this.parcel);
    targets.push(...this.room.taps.filter((m) => this.visibleUp(m)));
    targets.push(...this.guest.meshes(), ...this.me.meshes(), ...this.courier.meshes(), ...(this.cat.world === this ? this.cat.meshes() : []));
    const hits = ray.intersectObjects(targets, true).filter((h) => this.visibleUp(h.object) && h.object.type !== 'Sprite');
    // (one of the two — even half hidden, in bed, behind the sofa — or a fingertip from her: she is who was meant, not the furniture)
    if (!this.edit) {
      const who = hits.find((h) => h.object.userData.person);
      if (who) return { kind: who.object.userData.person, point: who.point };
      const near = this.nearPerson(x, y);
      if (near) return { kind: near, point: null };
    }
    // (a thing on a rug: the thing, not the rug)
    for (const h of hits) {
      const o = h.object;
      if (o.userData.person) continue; // (arranging: the two of them are not in the way of the furniture)
      if (o.userData.tap) return { kind: o.userData.tap, point: h.point };
      const uid = o.userData.uid;
      if (uid) {
        const e = this.items.get(uid);
        if (e && e.kind === 'rug' && hits.some((x) => x.object.userData.uid && x.object.userData.uid !== uid && this.items.get(x.object.userData.uid).kind !== 'rug')) continue;
        return { kind: 'item', uid, point: h.point };
      }
    }
    return null;
  }

  visibleUp(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }

  /** Which of the two is within a fingertip of (x, y) on the screen, from her feet to the top of her head — or null. (Seen from up here they are small.) */
  nearPerson(x, y, reach = 22) {
    const r = this.canvas.getBoundingClientRect();
    const onPage = (p) => {
      p.project(this.camera);
      return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
    };
    let best = null;
    let bd = reach;
    for (const who of [this.me, this.guest, this.courier, this.cat]) {
      if (!who.on || !who.rig || (who === this.cat && who.world !== this)) continue;
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
    this.canvas.setPointerCapture(e.pointerId);
    if (this.where === 'town') return this.town.onDown(e);
    if (this.where === 'veranda') return this.veranda.onDown(e);
    if (this.play) return this.play.onDown(e);
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.fingers.size === 2) {
      // two fingers: closer and further, and sliding the view
      const [a, b] = [...this.fingers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.view.zoom, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
      this.pointer.down = false;
      this.cancelDrag();
      return;
    }
    if (this.fingers.size > 2) return;
    this.pointer = { down: true, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, id: e.pointerId, t: performance.now() };
    // arranging: a touch on the thing she has picked takes hold of it
    if (this.edit) {
      const hit = this.pick(e.clientX, e.clientY);
      if (hit && hit.kind === 'item' && hit.uid === this.held) this.beginDrag(this.items.get(hit.uid), e);
    }
  }

  onMove(e) {
    if (this.where === 'town') return this.town.onMove(e);
    if (this.where === 'veranda') return this.veranda.onMove(e);
    if (this.play) return this.play.onMove(e);
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
      // …and the middle of the two fingers slides the room
      const p0 = this.floorAt(this.pinch.mx, this.pinch.my);
      const p1 = this.floorAt(mx, my);
      if (p0 && p1) {
        this.view.target.x -= (p1.x - p0.x) * 0.9;
        this.view.target.z -= (p1.z - p0.z) * 0.9;
      }
      this.pinch.mx = mx;
      this.pinch.my = my;
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
    if (this.drag) return this.dragTo(e);
    // turning the room round, and tilting it
    this.view.yaw -= dx * 0.0085;
    this.view.pitch = clamp(this.view.pitch + dy * 0.0052, PITCH_MIN, PITCH_MAX);
  }

  onUp(e, cancelled = false) {
    if (this.where === 'town') return this.town.onUp(e, cancelled);
    if (this.where === 'veranda') return this.veranda.onUp(e, cancelled);
    if (this.play) return this.play.onUp(e);
    this.fingers.delete(e.pointerId);
    if (this.fingers.size < 2) this.pinch = null;
    const p = this.pointer;
    if (!p.down || e.pointerId !== p.id) return;
    p.down = false;
    if (this.drag) return this.endDrag(cancelled);
    if (cancelled || p.moved) return;
    const hit = this.pick(e.clientX, e.clientY);
    if (this.edit) {
      if (hit && hit.kind === 'item') {
        const it = this.items.get(hit.uid);
        if (it && it.it.def.fixed) return void this.host.onTap('fixed', hit.uid);
        this.host.onPick(hit.uid);
      } else this.host.onPick(null);
      return;
    }
    if (!hit) return;
    if (hit.kind === 'item') {
      const it = this.items.get(hit.uid);
      if (it) {
        it.bounce = 1;
        if (it.it.poke) it.it.poke();
      }
    }
    if (hit.kind === 'guest') {
      this.guest.tapped();
      return this.host.onTap('guest');
    }
    if (hit.kind === 'me') {
      this.me.tapped();
      return this.host.onTap('me');
    }
    if (hit.kind === 'rider') {
      this.courier.tapped();
      return this.host.onTap('rider');
    }
    if (hit.kind === 'cat') return this.host.onTap('cat');
    this.host.onTap(hit.kind, hit.uid || null);
  }

  // ---------------------------------------------------------------- arranging

  setEdit(on, held) {
    this.edit = on;
    if (!on) this.cancelDrag();
    this.held = on ? held : null;
  }

  /** The ground a thing takes where it is (or would be): its rectangle on the floor. */
  footprint(id, x, z, r) {
    const def = FURNITURE[id];
    const turned = r % 2 === 1;
    const w = turned ? def.d : def.w;
    const d = turned ? def.w : def.d;
    return { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2, w, d };
  }

  /** Could `id` stand at x, z, turned r quarters? (The room's floor, nothing in the way of anything — a rug can lie under things — and the way in clear.) */
  fits(id, x, z, r, but = null) {
    const spec = this.spec;
    const def = FURNITURE[id];
    const f = this.footprint(id, x, z, r);
    const e = 1e-4;
    if (f.x0 < -spec.w / 2 - e || f.x1 > spec.w / 2 + e || f.z0 < -spec.d / 2 - e || f.z1 > spec.d / 2 + e) return false;
    if (def.kind === 'rug') return true;
    const c = spec.clear;
    if (f.x1 > c.x0 + e && f.x0 < c.x1 - e && f.z1 > c.z0 + e && f.z0 < c.z1 - e) return false;
    for (const o of this.items.values()) {
      if (o.uid === but || o.kind !== 'floor' || !o.place) continue;
      const g = this.footprint(o.id, o.place.x, o.place.z, o.place.r);
      if (f.x1 > g.x0 + e && f.x0 < g.x1 - e && f.z1 > g.z0 + e && f.z0 < g.z1 - e) return false;
    }
    if (this.parcel && this.parcel.visible) {
      const p = this.parcel.position;
      if (p.x > f.x0 - 0.2 && p.x < f.x1 + 0.2 && p.z > f.z0 - 0.2 && p.z < f.z1 + 0.2) return false;
    }
    return true;
  }

  /** Could `id` hang on `wall` at u, y? (On the wall, clear of the window, the door, the switch and the other things there.) */
  fitsWall(id, wall, u, y, but = null) {
    const spec = this.spec;
    const def = FURNITURE[id];
    const len = wall === 'back' || wall === 'front' ? spec.w : spec.d;
    const a = { u0: u - def.w / 2, u1: u + def.w / 2, y0: y - def.h / 2, y1: y + def.h / 2 };
    if (a.u0 < -len / 2 + 0.06 || a.u1 > len / 2 - 0.06 || a.y0 < 0.18 || a.y1 > WALL_H - 0.08) return false;
    const over = (b) => a.u1 > b.u0 + 0.01 && a.u0 < b.u1 - 0.01 && a.y1 > b.y0 + 0.01 && a.y0 < b.y1 - 0.01;
    if (spec.keepOff.some((b) => b.wall === wall && over(b))) return false;
    for (const o of this.items.values()) {
      if (o.uid === but || o.kind !== 'wall' || !o.place || o.place.wall !== wall) continue;
      const d = FURNITURE[o.id];
      if (over({ u0: o.place.u - d.w / 2, u1: o.place.u + d.w / 2, y0: o.place.y - d.h / 2, y1: o.place.y + d.h / 2 })) return false;
    }
    return true;
  }

  /* x or z of a thing's middle, so that its edges are on the grid. */
  snap(v, size) {
    const edge = Math.round((v - size / 2) / CELL) * CELL;
    return edge + size / 2;
  }

  /** A place for something new: near the middle of the room (or on a wall she can see) — or null, if there is none. */
  findSpot(id) {
    const def = FURNITURE[id];
    if (!def || !this.spec) return null;
    const spec = this.spec;
    if (def.kind === 'wall') {
      const walls = ['back', 'right', 'left', 'front'].sort((a, b) => (this.room.standing(b) ? 1 : 0) - (this.room.standing(a) ? 1 : 0));
      for (const wall of walls) {
        const len = wall === 'back' || wall === 'front' ? spec.w : spec.d;
        for (const y of [1.25, 1.0, 1.45, 0.8]) {
          for (let k = 0; k <= len / CELL; k++) {
            const u = this.snap(((k % 2 ? 1 : -1) * Math.ceil(k / 2) * CELL) + 0, def.w);
            if (this.fitsWall(id, wall, u, y)) return { wall, u, y };
          }
        }
      }
      return null;
    }
    const tries = [];
    for (let x = -spec.w / 2; x <= spec.w / 2; x += CELL) for (let z = -spec.d / 2; z <= spec.d / 2; z += CELL) tries.push([x, z]);
    tries.sort((a, b) => Math.hypot(a[0], a[1] * 1.2) - Math.hypot(b[0], b[1] * 1.2));
    for (const r of [0, 1, 2, 3]) {
      const f = this.footprint(id, 0, 0, r);
      for (const [x, z] of tries) {
        const sx = this.snap(x, f.w);
        const sz = this.snap(z, f.d);
        if (this.fits(id, sx, sz, r)) return { x: sx, z: sz, r };
      }
    }
    return null;
  }

  /** A place for `id` with its back against a wall (the back wall first, then the sides), facing into the room — or null. */
  findWallSpot(id) {
    const def = FURNITURE[id];
    if (!def || !this.spec) return null;
    const { w, d } = this.spec;
    const tries = [];
    // (r: 0 faces +Z, its back to the back wall; 1 faces +X, its back to the left wall; 3 faces −X, its back to the right)
    for (let x = -w / 2; x <= w / 2; x += CELL) tries.push({ x, z: -d / 2 + def.d / 2, r: 0, k: Math.abs(x) });
    for (let z = -d / 2; z <= d / 2; z += CELL) tries.push({ x: -w / 2 + def.d / 2, z, r: 1, k: 1 + Math.abs(z) });
    for (let z = -d / 2; z <= d / 2; z += CELL) tries.push({ x: w / 2 - def.d / 2, z, r: 3, k: 2 + Math.abs(z) });
    tries.sort((a, b) => a.k - b.k);
    for (const t of tries) {
      const f = this.footprint(id, 0, 0, t.r);
      const x = this.snap(t.x, f.w);
      const z = this.snap(t.z, f.d);
      if (this.fits(id, x, z, t.r)) return { x, z, r: t.r };
    }
    return null;
  }

  /** The camera over to `at` (a point in the room), closer (and from `o.yaw`, `o.pitch`) — and back to how it was (null),
   *  unless she has moved it meanwhile. */
  frameAt(at, zoom = 0.5, o = {}) {
    const v = this.view;
    if (at) {
      if (this.showcaseOn) return;
      if (!this.atView) this.atView = { was: { zoom: v.zoom, target: v.target.clone(), yaw: v.yaw, pitch: v.pitch } };
      const a = this.atView;
      a.zoom = Math.min(v.zoom, zoom);
      a.target = V(at.x, Math.max(0.45, at.y || 0), at.z);
      v.zoom = a.zoom;
      v.target.copy(a.target);
      if (o.yaw != null) v.yaw = o.yaw;
      if (o.pitch != null) v.pitch = o.pitch;
      a.yaw = v.yaw;
      a.pitch = v.pitch;
      return;
    }
    const d = this.atView;
    this.atView = null;
    if (!d || Math.abs(v.zoom - d.zoom) > 0.01 || v.target.distanceTo(d.target) > 0.01 || Math.abs(angle(v.yaw - d.yaw)) > 0.01) return;
    v.zoom = d.was.zoom;
    v.target.copy(d.was.target);
    v.yaw = d.was.yaw;
    v.pitch = d.was.pitch;
  }

  /** She is down by 뭉치, petting it or holding out a treat: the camera comes down close to the two of them, from its side
   *  of them — where its face shows — and goes back when she is done (update), unless she has moved it meanwhile. */
  frameCat(cat) {
    if (this.showcaseOn || this.where === 'town' || !cat.on) return;
    const v = this.view;
    const look = cat.anim.yaw; // (it faces her)
    // (almost from the side, a little before it: she is not in front of it then)
    const yaw = [look + 1.35, look - 1.35].reduce((a, b) => (Math.abs(angle(a - v.yaw)) <= Math.abs(angle(b - v.yaw)) ? a : b));
    const h = cat.headPoint(V());
    this.frameAt(V(h.x * 0.65 + this.me.pos.x * 0.35, h.y, h.z * 0.65 + this.me.pos.z * 0.35), 0.26, { yaw, pitch: 0.52 });
    this.catFramed = true;
  }

  /** Turn the thing a quarter round (on the spot — or as near to it as it fits). → its new place, or null. */
  turn(uid) {
    const e = this.items.get(uid);
    if (!e || e.kind === 'wall' || !e.place) return null;
    const r = ((e.place.r || 0) + 1) % 4;
    const f = this.footprint(e.id, 0, 0, r);
    const near = [];
    for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) near.push([dx * CELL, dz * CELL]);
    near.sort((a, b) => Math.hypot(...a) - Math.hypot(...b));
    for (const [dx, dz] of near) {
      const x = this.snap(e.place.x + dx, f.w);
      const z = this.snap(e.place.z + dz, f.d);
      if (this.fits(e.id, x, z, r, uid)) return { x, z, r };
    }
    return null;
  }

  beginDrag(entry, ev) {
    if (!entry || !entry.place || entry.it.def.fixed) return;
    const at = entry.kind === 'wall' ? null : this.floorAt(ev.clientX, ev.clientY);
    this.drag = { entry, dx: at ? entry.place.x - at.x : 0, dz: at ? entry.place.z - at.z : 0, ok: true, start: { ...entry.place }, good: { ...entry.place } };
  }

  dragTo(ev) {
    const d = this.drag;
    const e = d.entry;
    if (e.kind === 'wall') {
      // along the walls: the one under her finger (of those standing), the place on it
      const ray = this.ray(ev.clientX, ev.clientY);
      let best = null;
      for (const name of ['back', 'front', 'left', 'right']) {
        if (!this.room.standing(name)) continue;
        const f = wallFrame(this.spec, name);
        const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(f.out.clone().negate(), f.at(0, 0));
        const p = ray.ray.intersectPlane(plane, V());
        if (!p) continue;
        const len = f.len;
        const u = name === 'back' || name === 'front' ? p.x : p.z;
        if (Math.abs(u) > len / 2 + 0.3 || p.y < -0.2 || p.y > WALL_H + 0.3) continue;
        const dist = p.distanceTo(ray.ray.origin);
        if (!best || dist < best.dist) best = { name, u, y: p.y, dist };
      }
      if (!best) return;
      const def = e.it.def;
      const len = best.name === 'back' || best.name === 'front' ? this.spec.w : this.spec.d;
      const u = clamp(this.snap(best.u, def.w), -len / 2 + def.w / 2 + 0.06, len / 2 - def.w / 2 - 0.06);
      const y = clamp(Math.round(best.y / 0.05) * 0.05, def.h / 2 + 0.18, WALL_H - def.h / 2 - 0.08);
      e.place = { wall: best.name, u, y };
      d.ok = this.fitsWall(e.id, best.name, u, y, e.uid);
      if (d.ok) d.good = { ...e.place };
      this.position(e);
      return;
    }
    const p = this.floorAt(ev.clientX, ev.clientY);
    if (!p) return;
    const r = e.place.r || 0;
    const f = this.footprint(e.id, 0, 0, r);
    const x = clamp(this.snap(p.x + d.dx, f.w), -this.spec.w / 2 + f.w / 2, this.spec.w / 2 - f.w / 2);
    const z = clamp(this.snap(p.z + d.dz, f.d), -this.spec.d / 2 + f.d / 2, this.spec.d / 2 - f.d / 2);
    if (x === e.place.x && z === e.place.z) return;
    e.place = { x, z, r };
    d.ok = this.fits(e.id, x, z, r, e.uid);
    if (d.ok) d.good = { ...e.place };
    this.position(e);
  }

  endDrag(cancelled) {
    const d = this.drag;
    this.drag = null;
    if (!d) return;
    const e = d.entry;
    if (cancelled) {
      e.place = d.start;
      this.position(e);
      return;
    }
    // (let go where it cannot stand: it goes back to the last place on the way that it could)
    if (!d.ok) {
      e.place = d.good;
      this.position(e);
      this.host.onRefuse(e.uid);
    }
    if (JSON.stringify(d.start) !== JSON.stringify(e.place)) this.host.onPlace(e.uid, { ...e.place });
  }

  cancelDrag() {
    if (!this.drag) return;
    const e = this.drag.entry;
    e.place = this.drag.start;
    this.position(e);
    this.drag = null;
  }

  /* The frame round the thing she has picked: on the floor round its ground, or on the wall round it. */
  updateOutline() {
    const o = this.outline;
    const e = this.held && this.items.get(this.held);
    if (!this.edit || !e || !e.place) {
      o.visible = false;
      return;
    }
    o.visible = true;
    const ok = !this.drag || this.drag.ok;
    o.userData.mat.color.set(ok ? '#ffffff' : '#ff4f6b');
    o.userData.mat.opacity = 0.65 + 0.3 * Math.sin(this.time * 5);
    const T = 0.03;
    const [a, b, c, dd] = o.children;
    if (e.kind === 'wall') {
      const def = e.it.def;
      const f = wallFrame(this.spec, e.place.wall);
      o.position.copy(f.at(e.place.u, e.place.y, 0.012));
      o.rotation.set(0, f.yaw, 0);
      const w = def.w + 0.08;
      const h = def.h + 0.08;
      a.scale.set(w, T, 0.01);
      a.position.set(0, h / 2, 0);
      b.scale.set(w, T, 0.01);
      b.position.set(0, -h / 2, 0);
      c.scale.set(T, h, 0.01);
      c.position.set(-w / 2, 0, 0);
      dd.scale.set(T, h, 0.01);
      dd.position.set(w / 2, 0, 0);
      return;
    }
    const f = this.footprint(e.id, e.place.x, e.place.z, e.place.r || 0);
    o.position.set((f.x0 + f.x1) / 2, 0.012, (f.z0 + f.z1) / 2);
    o.rotation.set(0, 0, 0);
    a.scale.set(f.w, 0.01, T);
    a.position.set(0, 0, -f.d / 2);
    b.scale.set(f.w, 0.01, T);
    b.position.set(0, 0, f.d / 2);
    c.scale.set(T, 0.01, f.d);
    c.position.set(-f.w / 2, 0, 0);
    dd.scale.set(T, 0.01, f.d);
    dd.position.set(f.w / 2, 0, 0);
  }

  /** Where a thing is on the screen (px of the stage) — for the buttons that float by it. */
  onPage(uid) {
    const e = this.items.get(uid);
    if (!e || !this.stage) return null;
    const o = e.it.object;
    o.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(o);
    _v.set((box.min.x + box.max.x) / 2, box.max.y + 0.08, (box.min.z + box.max.z) / 2).project(this.camera);
    return { x: ((_v.x + 1) / 2) * this.stage.clientWidth, y: ((1 - _v.y) / 2) * this.stage.clientHeight };
  }

  // ---------------------------------------------------------------- Lorelei's way about the room

  /* The floor as squares, open or not: shut under her things (and a little round them), outside the room. */
  makeGrid() {
    const spec = this.spec;
    const nx = Math.round(spec.w / CELL);
    const nz = Math.round(spec.d / CELL);
    const open = new Uint8Array(nx * nz).fill(1);
    const pad = 0.16;
    this.items.forEach((e) => {
      if (e.kind !== 'floor' || !e.place) return;
      const f = this.footprint(e.id, e.place.x, e.place.z, e.place.r || 0);
      for (let i = 0; i < nx; i++)
        for (let j = 0; j < nz; j++) {
          const x = -spec.w / 2 + (i + 0.5) * CELL;
          const z = -spec.d / 2 + (j + 0.5) * CELL;
          if (x > f.x0 - pad && x < f.x1 + pad && z > f.z0 - pad && z < f.z1 + pad) open[i + j * nx] = 0;
        }
    });
    // (a square from the walls)
    for (let i = 0; i < nx; i++) {
      open[i] = 0;
      open[i + (nz - 1) * nx] = 0;
    }
    for (let j = 0; j < nz; j++) {
      open[j * nx] = 0;
      open[nx - 1 + j * nx] = 0;
    }
    this.grid = { nx, nz, open };
    return this.grid;
  }

  cellOf(p) {
    const g = this.grid || this.makeGrid();
    return [clamp(Math.floor((p.x + this.spec.w / 2) / CELL), 0, g.nx - 1), clamp(Math.floor((p.z + this.spec.d / 2) / CELL), 0, g.nz - 1)];
  }

  centre(i, j) {
    return V(-this.spec.w / 2 + (i + 0.5) * CELL, 0, -this.spec.d / 2 + (j + 0.5) * CELL);
  }

  /** The open square nearest to `p`. */
  nearestOpen(p) {
    const g = this.grid || this.makeGrid();
    const [ci, cj] = this.cellOf(p);
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < g.nx; i++)
      for (let j = 0; j < g.nz; j++) {
        if (!g.open[i + j * g.nx]) continue;
        const d = (i - ci) ** 2 + (j - cj) ** 2;
        if (d < bd) {
          bd = d;
          best = [i, j];
        }
      }
    return best;
  }

  /** A way from `from` to `to` round her things: points to walk to (A* over the squares, then cut short where it can be). */
  path(from, to) {
    const g = this.grid || this.makeGrid();
    const s = this.nearestOpen(from);
    const t = this.nearestOpen(to);
    if (!s || !t) return null;
    const key = (i, j) => i + j * g.nx;
    const open = [[s[0], s[1], 0, 0]];
    const came = new Map();
    const cost = new Map([[key(s[0], s[1]), 0]]);
    const h = (i, j) => Math.hypot(i - t[0], j - t[1]);
    let found = false;
    let guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k][3] < open[bi][3]) bi = k;
      const [i, j] = open.splice(bi, 1)[0];
      if (i === t[0] && j === t[1]) {
        found = true;
        break;
      }
      for (let di = -1; di <= 1; di++)
        for (let dj = -1; dj <= 1; dj++) {
          if (!di && !dj) continue;
          const ni = i + di;
          const nj = j + dj;
          if (ni < 0 || nj < 0 || ni >= g.nx || nj >= g.nz || !g.open[key(ni, nj)]) continue;
          if (di && dj && (!g.open[key(i + di, j)] || !g.open[key(i, j + dj)])) continue; // (no cutting a corner)
          const c = cost.get(key(i, j)) + (di && dj ? 1.414 : 1);
          if (c < (cost.has(key(ni, nj)) ? cost.get(key(ni, nj)) : Infinity)) {
            cost.set(key(ni, nj), c);
            came.set(key(ni, nj), key(i, j));
            open.push([ni, nj, c, c + h(ni, nj)]);
          }
        }
    }
    if (!found) return null;
    const cells = [];
    for (let k = key(t[0], t[1]); k !== undefined; k = came.get(k)) {
      cells.push([k % g.nx, Math.floor(k / g.nx)]);
      if (k === key(s[0], s[1])) break;
    }
    cells.reverse();
    // (straight on wherever she can see her way)
    const pts = [];
    let a = 0;
    while (a < cells.length - 1) {
      let b = cells.length - 1;
      while (b > a + 1 && !this.clearLine(cells[a], cells[b])) b--;
      pts.push(this.centre(...cells[b]));
      a = b;
    }
    if (!this.grid.open[key(t[0], t[1])] || to.distanceTo(this.centre(...t)) < CELL * 1.5) pts.push(to.clone());
    return pts;
  }

  clearLine(a, b) {
    const g = this.grid;
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 2);
    for (let k = 0; k <= n; k++) {
      const i = Math.round(a[0] + ((b[0] - a[0]) * k) / n);
      const j = Math.round(a[1] + ((b[1] - a[1]) * k) / n);
      if (!g.open[i + j * g.nx]) return false;
    }
    return true;
  }

  /** Somewhere open to stand, anywhere in the room. */
  randomFree() {
    const g = this.grid || this.makeGrid();
    const list = [];
    for (let i = 0; i < g.nx; i++) for (let j = 0; j < g.nz; j++) if (g.open[i + j * g.nx]) list.push([i, j]);
    if (!list.length) return null;
    const [i, j] = list[Math.floor(Math.random() * list.length)];
    return this.centre(i, j);
  }

  /**
   * What she might go and do: a seat to sit on, a thing to stand by and look at — each with where she stands, what she
   * looks at, and what kind of thing it is (for what she says about it).
   */
  spots() {
    const out = [];
    const spec = this.spec;
    const KINDS = {
      record: 'record', desk: 'desk', plant: 'plant', cactus: 'plant', bear: 'bear', kitchen: 'kitchen', fridge: 'fridge',
      bookshelf: 'books', wardrobe: 'wardrobe', mic: 'mic', radio: 'radio', table: 'table', cake: 'gift', bouquet: 'gift',
      balloons: 'gift', choco: 'gift', 'xmas-tree': 'tree', pumpkin: 'pumpkin', lamp: 'lamp',
    };
    this.items.forEach((e) => {
      const it = e.it;
      const o = it.object;
      if (!e.place) return;
      o.updateMatrixWorld(true);
      const yaw = e.kind === 'wall' ? wallFrame(spec, e.place.wall).yaw : (e.place.r || 0) * (Math.PI / 2);
      if (it.seats) {
        for (const s of it.seats) {
          const at = V(s.x, 0, s.z).applyMatrix4(o.matrixWorld);
          at.y = 0;
          out.push({ kind: 'sit', uid: `${e.uid}:${s.x}`, seat: { at, yaw: yaw + s.yaw, h: s.y }, line: e.id.startsWith('bed') ? 'bed' : 'sit', weight: 1.4 });
        }
      }
      if (e.kind === 'wall') {
        if (!['frame', 'frame-tall', 'poster', 'calendar', 'clock'].includes(e.id)) return;
        if (!this.room.standing(e.place.wall)) return;
        const f = wallFrame(spec, e.place.wall);
        const at = f.at(e.place.u, 0, 0.62);
        const kind = e.id.startsWith('frame') ? (this.media.photos.has(e.uid) ? 'frame' : 'frame-empty') : e.id;
        out.push({ kind, uid: e.uid, at, face: f.at(e.place.u, e.place.y), line: kind, weight: kind === 'frame' ? 1.6 : 0.8 });
        return;
      }
      if (it.spot && KINDS[e.id]) {
        const at = V(it.spot.x, 0, it.spot.z).applyMatrix4(o.matrixWorld);
        at.y = 0;
        const face = V(0, 0.6, 0).applyMatrix4(o.matrixWorld);
        const kind = e.id === 'record' && it.playing ? 'music' : KINDS[e.id];
        out.push({ kind: KINDS[e.id], uid: e.uid, at, face, line: kind, weight: e.id === 'record' ? 1.2 : 1, pose: e.id === 'bear' ? 'carry' : 'look' });
      }
    });
    // the window
    if (this.room.standing('back')) {
      const f = wallFrame(spec, 'back');
      out.push({ kind: 'window', uid: 'window', at: f.at(spec.win.u, 0, 0.7), face: f.at(spec.win.u, 1.0, -1), line: 'window', weight: 1.6 });
    }
    return out.filter((s) => !s.at || this.reachable(s.at));
  }

  /** Is that seat taken — by the other of the two? */
  taken(seat, who) {
    const other = who === this.me ? this.guest : this.me;
    if (!other.on) return false;
    const on = other.seat || (other.task && other.task.do === 'sit' && other.task.seat);
    return !!(on && on.at.distanceTo(seat.at) < 0.05);
  }

  /** Her bed: where her feet are when she lies in it (her head on the pillow), the side she gets in from, which way it lies, how high she lies. */
  bed() {
    for (const e of this.items.values()) {
      if (!e.id.startsWith('bed') || !e.place) continue;
      const o = e.it.object;
      o.updateMatrixWorld(true);
      const flat = (p) => {
        p.applyMatrix4(o.matrixWorld);
        p.y = 0;
        return p;
      };
      const g = this.grid || this.makeGrid();
      const sides = [V(1.0, 0, 0.3), V(-1.0, 0, 0.3), V(0, 0, 1.4)].map(flat);
      const side = sides.find((p) => {
        const [i, j] = this.cellOf(p);
        return g.open[i + j * g.nx];
      });
      return { foot: flat(V(0, 0, 0.55)), side: side || sides[2], yaw: (e.place.r || 0) * (Math.PI / 2), h: 0.415 };
    }
    return null;
  }

  /** What has happened that she might go and look at: a letter waiting, a present by the door (each a key: a new one is new). */
  events() {
    const look = this.look || {};
    return { mail: look.mailKey || null, gift: look.giftKey || null };
  }

  /** Where to stand to look at the thing `id` (the first of them), and what to look at. */
  spotOf(id) {
    for (const e of this.items.values()) {
      if (e.id !== id || !e.place) continue;
      if (e.kind === 'wall') {
        const f = wallFrame(this.spec, e.place.wall);
        return { at: f.at(e.place.u, 0, 0.6), face: f.at(e.place.u, e.place.y) };
      }
      const o = e.it.object;
      o.updateMatrixWorld(true);
      const sp = e.it.spot || { x: 0, z: 0.6 };
      const at = V(sp.x, 0, sp.z).applyMatrix4(o.matrixWorld);
      at.y = 0;
      return { at, face: V(0, 0.5, 0).applyMatrix4(o.matrixWorld) };
    }
    return null;
  }

  /** …and the present waiting by the door. */
  parcelSpot() {
    if (!this.parcel || !this.parcel.visible) return null;
    const p = this.parcel.position;
    const at = this.near(V(p.x, 0, p.z), 0.45);
    return at ? { at, face: V(p.x, 0.15, p.z) } : null;
  }

  /** An open place on the floor about `r` from `p`. */
  near(p, r) {
    const g = this.grid || this.makeGrid();
    let best = null;
    let bd = Infinity;
    for (let i = 0; i < g.nx; i++)
      for (let j = 0; j < g.nz; j++) {
        if (!g.open[i + j * g.nx]) continue;
        const c = this.centre(i, j);
        const d = Math.abs(c.distanceTo(p) - r);
        if (d < bd) {
          bd = d;
          best = c;
        }
      }
    return best;
  }

  /** Where she stands while she is being dressed: in the open, towards the camera from the middle of the room. */
  showSpot() {
    const c = this.camera.position;
    const p = V(c.x, 0, c.z).normalize().multiplyScalar(0.6);
    const cell = this.nearestOpen(p);
    return cell ? this.centre(...cell) : p;
  }

  /** The girl is being dressed (or no longer): she comes forward, and the camera comes down close to her. */
  setShowcase(on) {
    if (on === this.showcaseOn) return;
    this.showcaseOn = on;
    this.me.setShowcase(on);
    if (on) {
      this.viewWas = { ...this.view, target: this.view.target.clone() };
      this.view.zoom = 0.36;
      this.view.pitch = 0.5;
    } else if (this.viewWas) {
      Object.assign(this.view, this.viewWas);
      this.view.target = this.viewWas.target;
      this.viewWas = null;
    }
  }

  /* ----- something to eat (js/delivery.js) ----- */

  /** Is she waiting for something she ordered (it is on its way, or the courier is at the door)? */
  foodWaiting() {
    return !!((this.food && this.food.order) || this.courier.on);
  }

  /** Is somebody at the door, or going through it? (One at a time: Lorelei and the courier wait for each other.) */
  doorBusy() {
    if (this.where !== 'home' || this.going) return true; // (she is out — or on the veranda — or on her way)
    const g = this.guest;
    const t = g.task;
    const coming = g.on && ((t && (t.do === 'door' || t.do === 'greet' || (t.do === 'walk' && t.direct))) || g.tasks.some((x) => x.do === 'door'));
    return this.courier.on || g.going || coming;
  }

  /**
   * The courier at the door: the camera comes over to the doorway (on) — and goes back to how it was (off), unless she
   * has moved it meanwhile.
   */
  frameDoor(on) {
    const v = this.view;
    if (on) {
      if (this.doorView || this.showcaseOn || !this.spec) return;
      const s = this.spec;
      this.doorView = { was: { zoom: v.zoom, target: v.target.clone() }, zoom: Math.min(v.zoom, 0.55), target: V(s.w / 2 - 0.3, 0.62, s.door.u - 0.05) };
      v.zoom = this.doorView.zoom;
      v.target.copy(this.doorView.target);
      return;
    }
    const d = this.doorView;
    this.doorView = null;
    if (!d || Math.abs(v.zoom - d.zoom) > 0.01 || v.target.distanceTo(d.target) > 0.01) return;
    v.zoom = d.was.zoom;
    v.target.copy(d.was.target);
  }

  /** She has ordered `order` ({ id, name }): her phone. */
  order(order) {
    if (this.stage) this.me.ordered(order);
  }

  /** It is here: the courier comes up to the door. */
  deliver(order) {
    if (!this.stage || this.courier.on || this.where !== 'home' || this.going) return false;
    this.courier.come(order);
    return true;
  }

  /* ----- out of the door: the street (town.js) ----- */

  /** She goes out: to the door, and out of it — then the street is shown, with her on it. → false if she cannot now. */
  goOut() {
    if (!this.stage || this.where !== 'home' || this.going || this.courier.on || this.guest.on) return false;
    this.going = true;
    this.me.leaveHouse();
    return true;
  }

  /** (she is out of the door: the street, a moment's fade between) */
  enterTown() {
    this.fade(() => {
      if (!this.stage) return;
      if (!this.town) {
        this.town = new Town(this);
        this.town.resize(this.stage.clientWidth, this.stage.clientHeight);
        this.frameView();
      }
      if (this.look) this.town.setLook(this.look);
      this.where = 'town';
      this.going = false;
      this.room.openDoor(false); // (the door shut behind her)
      this.hush('me');
      this.town.show(this.me);
      this.grace(2500);
      this.host.onTown('out');
    });
  }

  /* ----- 뭉치, at home (cat.js) ----- */

  /** An open place on the floor near `p`. */
  freeNear(p) {
    const cell = this.nearestOpen(p);
    return cell ? this.centre(...cell) : p.clone();
  }

  /** When the house is shown: where it is — asleep on her bed by her feet, if she is asleep in it; somewhere about
   *  the room otherwise. */
  catEnter() {
    const cat = this.cat;
    if (!this.catHome || !this.stage) return;
    cat.setWorld(this);
    const bed = this.bed();
    if (bed && this.me.asleepNow && this.me.asleepNow()) {
      const at = this.catOnBed(bed);
      cat.show(at, bed.yaw + Math.PI * 0.6, bed.h, [{ do: 'sleep', until: () => !this.me.abed && !(this.me.task && this.me.task.do === 'lie') }]);
      return;
    }
    const at = this.randomFree() || V(0, 0, 0);
    cat.show(at, Math.random() * Math.PI * 2, 0, [{ do: 'stretch' }]);
  }

  /** On her bed, at her feet (the side away from where she gets in). */
  catOnBed(bed) {
    const f = bed.foot;
    return V(f.x + Math.sin(bed.yaw + Math.PI / 2) * 0.18, 0, f.z + Math.cos(bed.yaw + Math.PI / 2) * 0.18);
  }

  /** Home with her for the first time (she has just taken it in, js/cat.js): in at the door behind her, a look round —
   *  its new home — and a word. */
  catComeIn() {
    const cat = this.cat;
    this.catHome = true;
    cat.setWorld(this);
    const door = this.room.doorway();
    cat.show(door.outside.clone().add(V(0.25, 0, 0)), -Math.PI / 2, 0, [
      { do: 'wait', t: 1.1 },
      { do: 'walk', to: door.inside.clone().add(V(-0.35, 0, 0.2)), direct: true },
      { do: 'sit', t: 1.6 },
      { do: 'meow', line: 'new_home' },
      { do: 'call', fn: () => this.host.onCat && this.host.onCat('home') },
    ]);
  }

  /** She comes in at the door: it comes to meet her there. */
  catGreet() {
    const cat = this.cat;
    if (!cat.on || cat.world !== this) return this.catEnter();
    const door = this.room.doorway();
    cat.do([{ do: 'walk', to: door.inside.clone().add(V(-0.45, 0, 0.15)), fast: true }, { do: 'meow', line: 'welcome', at: door.inside }, { do: 'rub', t: 3 }]);
  }

  /**
   * What it does next, at home (cat.js asks when it has done all it was doing): asleep on her bed at her feet while she
   * sleeps; otherwise a stroll, the window, a nap — on the floor, or up on her bed — a groom, a stretch, after her when
   * she is on the move, round her legs now and then.
   */
  planCat(cat) {
    const me = this.me;
    const bed = this.bed();
    const T = cat.tasks;
    if (bed && me.on && (me.abed || (me.task && me.task.do === 'lie'))) {
      const at = this.catOnBed(bed);
      const there = Math.hypot(cat.pos.x - at.x, cat.pos.z - at.z) < 0.12 && cat.perch > 0.3;
      if (!there) {
        const below = this.freeNear(at.clone().add(V(Math.sin(bed.yaw + Math.PI / 2) * 0.45, 0, Math.cos(bed.yaw + Math.PI / 2) * 0.45)));
        T.push({ do: 'walk', to: below }, { do: 'hop', to: at, h: bed.h });
      }
      T.push({ do: 'sleep', until: () => !(me.abed || (me.task && me.task.do === 'lie')) });
      return;
    }
    const r = Math.random();
    // its bowls, every so often — or, empty, it goes and sits by them and says so
    const bowl = this.catBowls();
    const full = (this.look && this.look.cat) || {};
    if (bowl && this.time - this.catAte > 110 && Math.random() < 0.5 && (full.food > 0.03 || full.water > 0.03)) {
      this.catAte = this.time;
      const dish = full.food > 0.03 && (full.water <= 0.03 || Math.random() < 0.65) ? 'food' : 'water';
      return void T.push(...this.toBowl(bowl[dish]), { do: 'bowl', what: dish, t: 5 + Math.random() * 4 });
    }
    if (bowl && full.food <= 0.03 && this.time - this.catAsked > 70) {
      this.catAsked = this.time;
      return void T.push(...this.toBowl(bowl.food), { do: 'meow', line: 'hungry' }, { do: 'sit', t: 4 });
    }
    // its tower: up it, a floor at a time, to the top; a while up there; and down — or a good scratch at the post
    const tower = this.catTower();
    if (tower && Math.random() < 0.4) {
      if (Math.random() < 0.3) return void T.push({ do: 'walk', to: tower.post.at }, { do: 'walk', to: tower.post.close, direct: true, stop: 0.02 }, { do: 'face', at: tower.post.face }, { do: 'scratch', t: 3 + Math.random() * 2 });
      T.push({ do: 'walk', to: tower.below });
      for (const p of tower.perches) T.push({ do: 'hop', to: p.at, h: p.h, of: tower.uid });
      T.push(Math.random() < 0.5 ? { do: 'sleep', t: 16 + Math.random() * 18 } : { do: 'loaf', t: 10 + Math.random() * 12 }, { do: 'hop', to: tower.below, h: 0 });
      return;
    }
    const spots = this.spots();
    const win = spots.find((s) => s.kind === 'window');
    const walking = me.on && me.task && me.task.do === 'walk';
    if (walking && r < 0.3) return void T.push({ do: 'follow', t: 6 + Math.random() * 6 });
    if (me.on && !walking && r < 0.4 && Math.hypot(me.pos.x - cat.pos.x, me.pos.z - cat.pos.z) < 2.5 && this.time - (this.catRubbed || -99) > 40) {
      this.catRubbed = this.time;
      return void T.push({ do: 'walk', to: this.freeNear(me.pos.clone().add(V(0.3, 0, 0.2))), fast: true }, { do: 'rub', t: 3.2 });
    }
    if (win && r < 0.55) return void T.push({ do: 'walk', to: win.at.clone() }, { do: 'look', at: win.face.clone(), t: 8 + Math.random() * 10 });
    if (bed && r < 0.68) {
      const at = this.catOnBed(bed);
      const below = this.freeNear(at.clone().add(V(Math.sin(bed.yaw + Math.PI / 2) * 0.45, 0, Math.cos(bed.yaw + Math.PI / 2) * 0.45)));
      return void T.push({ do: 'walk', to: below }, { do: 'hop', to: at, h: bed.h }, { do: 'sleep', t: 18 + Math.random() * 20 }, { do: 'stretch' });
    }
    if (r < 0.78) return void T.push({ do: 'groom', t: 3 + Math.random() * 3 });
    if (r < 0.86) return void T.push({ do: 'loaf', t: 10 + Math.random() * 12 });
    if (r < 0.9) return void T.push({ do: 'stretch' });
    const p = this.randomFree();
    if (p) T.push({ do: 'walk', to: p }, { do: 'sit', t: 3 + Math.random() * 4 });
  }

  /** She pets it (it was tapped — js/cat.js): she goes to it and strokes it, and it leans into her hand. → false if she
   *  cannot now. */
  catPet() {
    const cat = this.cat;
    const me = this.me;
    if (!this.catFree()) return false;
    const toHer = Math.atan2(me.pos.x - cat.pos.x, me.pos.z - cat.pos.z);
    const kneel = this.freeNear(cat.pos.clone().add(V(Math.sin(toHer) * 0.42, 0, Math.cos(toHer) * 0.42)));
    me.redo([{ do: 'walk', to: kneel }, { do: 'face', at: cat.pos.clone() }, { do: 'petCat', cat, t: 3.6 }]); // (up from where she sits, first)
    cat.do([{ do: 'wait', t: 0.2 }, { do: 'face', at: kneel }, { do: 'petted', t: 99 }]);
    return true;
  }

  /** Can she see to it now — is it here, and she up (or only sitting), with nothing on her hands? */
  catFree() {
    const cat = this.cat;
    const me = this.me;
    return !(!cat.on || cat.world !== this || !me.on || me.abed || me.cooking || me.busyEating() || this.play || this.doorBusy());
  }

  /** A churu at home: she holds it out, as on the street (out of the fridge: js/cat.js). */
  catFeed() {
    const cat = this.cat;
    const me = this.me;
    if (!this.catFree()) return false;
    const toHer = Math.atan2(me.pos.x - cat.pos.x, me.pos.z - cat.pos.z);
    const kneel = this.freeNear(cat.pos.clone().add(V(Math.sin(toHer) * 0.46, 0, Math.cos(toHer) * 0.46)));
    me.redo([{ do: 'walk', to: kneel }, { do: 'face', at: cat.pos.clone() }, { do: 'feedCat', cat, t: 4.6, done: () => this.host.onCat('churu') }]);
    return true;
  }

  /** The hunting game (catplay.js). → false if she cannot now. */
  catPlay() {
    if (!this.catFree()) return false;
    const play = new CatPlay(this);
    if (!play.begin()) return false;
    this.play = play;
    return true;
  }

  catPlayStop() {
    if (this.play) this.play.end();
  }

  /** (it is over: the finger is the room's again) */
  playEnded(play) {
    if (this.play === play) this.play = null;
    this.pointer.down = false;
    this.fingers.clear();
  }

  /** Where its two bowls are: where to stand at each, and what to look at — or null if they are not out. */
  catBowls() {
    for (const e of this.items.values()) {
      if (e.id !== 'cat-bowl' || !e.place) continue;
      const o = e.it.object;
      o.updateMatrixWorld(true);
      const flat = (x, z) => {
        const p = V(x, 0, z).applyMatrix4(o.matrixWorld);
        p.y = 0;
        return p;
      };
      const side = this.openAt(flat(0, 0.62)) ? 1 : -1; // (from its front — or from behind, if it stands with its front to a wall)
      const dish = (s) => ({ at: this.freeNear(flat(s.x, 0.62 * side)), close: flat(s.x, 0.31 * side), face: flat(s.x, 0).setY(0.05) });
      return { food: dish(e.it.spot), water: dish(e.it.drink), her: this.freeNear(flat(0, 0.62 * side)) };
    }
    return null;
  }

  /** Is `p` open floor? */
  openAt(p) {
    const g = this.grid || this.makeGrid();
    const [i, j] = this.cellOf(p);
    return i >= 0 && j >= 0 && i < g.nx && j < g.nz && !!g.open[i + j * g.nx];
  }

  /** Its way to one of its bowls: up to it, its nose over it. */
  toBowl(dish) {
    return [{ do: 'walk', to: dish.at }, { do: 'walk', to: dish.close, direct: true, stop: 0.02 }, { do: 'face', at: dish.face }];
  }

  /** Its tower: where to jump up from, its three floors from the bottom up, its scratching post — or null. */
  catTower() {
    for (const e of this.items.values()) {
      if (e.id !== 'cat-tower' || !e.place) continue;
      const o = e.it.object;
      o.updateMatrixWorld(true);
      const flat = (x, z) => {
        const p = V(x, 0, z).applyMatrix4(o.matrixWorld);
        p.y = 0;
        return p;
      };
      const side = this.openAt(flat(0, 0.62)) ? 1 : -1;
      const below = this.freeNear(flat(e.it.spot.x, e.it.spot.z * side));
      if (!this.reachable(below)) return null;
      return {
        uid: e.uid,
        below,
        perches: e.it.perches.map((p) => ({ at: flat(p.x, p.z), h: p.h })),
        post: { at: this.freeNear(flat(e.it.post.x, 0.62 * side)), close: flat(e.it.post.x, 0.46 * side), face: flat(e.it.post.x, e.it.post.z * side).setY(0.3) },
      };
    }
    return null;
  }

  /** She sees to its bowls (`what`: 'food', 'water'): over to them, down on her knees, a pour — and it comes running. → false if she cannot now. */
  catFill(what) {
    const bowl = this.catBowls();
    if (!bowl || !this.catFree()) return false;
    const me = this.me;
    me.redo([
      { do: 'walk', to: bowl.her },
      { do: 'face', at: bowl[what].face },
      {
        do: 'pour',
        what,
        t: 2,
        done: () => {
          this.host.onCat('filled', what);
          const b = this.catBowls();
          if (!b || !this.cat.on || this.cat.world !== this) return;
          this.catAte = this.time;
          this.cat.do([{ do: 'walk', to: b[what].at, fast: true }, ...this.toBowl(b[what]).slice(1), { do: 'bowl', what, t: 6 }]);
        },
      },
    ]);
    return true;
  }

  /** She has come home on the bus (js/bus.js): the street at once — no door, no fade, the ride's screen is over it all —
   *  with her on the bus, which comes along when the app says (town.busIn). */
  arriveByBus() {
    if (!this.stage || this.where === 'town') return false;
    if (!this.town) {
      this.town = new Town(this);
      this.town.resize(this.stage.clientWidth, this.stage.clientHeight);
      this.frameView();
    }
    if (this.look) this.town.setLook(this.look);
    this.where = 'town';
    this.going = false;
    this.hush('me');
    this.town.show(this.me, 'bus');
    this.grace(2500);
    this.host.onTown('out', 'bus');
    return true;
  }

  /** She is in at her own door: the house again — and she comes in. */
  enterHome() {
    this.fade(() => this.backHome(false));
  }

  backHome(quiet) {
    if (this.where !== 'town') return;
    const me = this.me;
    this.town.hide();
    this.where = 'home';
    this.going = false;
    me.world = this;
    me.walkSpeed = undefined;
    this.scene.add(me.rig.group);
    this.hush('me');
    // 뭉치: come home with her, just taken in — or here already, and up to the door to meet her
    const cat = this.cat;
    const along = cat.on && cat.world === this.town && cat.following;
    if (cat.world === this.town) cat.hide();
    cat.following = false;
    if (quiet) {
      if (along) this.catHome = true;
      return;
    }
    me.comeIn();
    if (along) this.catComeIn(true);
    else if (this.catHome) this.catGreet();
    this.grace(1500);
    this.host.onTown('home');
  }

  /* A soft fade over the view while one is swapped for the other. */
  fade(swap) {
    const el = this.stage;
    if (!el) return swap();
    el.classList.add('is-fading');
    setTimeout(() => {
      try {
        swap();
      } finally {
        setTimeout(() => this.stage && this.stage.classList.remove('is-fading'), 60);
      }
    }, 340);
  }

  sound(name) {
    if (this.host.sound) this.host.sound(name);
  }

  reachable(p) {
    const g = this.grid || this.makeGrid();
    const [i, j] = this.cellOf(p);
    return !!g.open[i + j * g.nx] || !!this.nearestOpen(p);
  }

  musicOn() {
    return !!(this.look && this.look.tune && this.look.tune.on);
  }

  /** Where the song that is playing is in its beat: { phase 0 … 1, count } (a steady 100 bpm if its beat is not known). */
  beat() {
    const tune = this.look && this.look.tune;
    const sec = this.host.clock ? this.host.clock() : this.time;
    const beats = tune && this.host.beats ? this.host.beats(tune.id) : null;
    if (beats && beats.length > 2) {
      let i = 0;
      while (i < beats.length - 1 && beats[i + 1] <= sec) i++;
      const a = beats[i];
      const b = beats[i + 1] || a + 0.6;
      return { phase: clamp((sec - a) / Math.max(0.2, b - a), 0, 1), count: i };
    }
    const bpm = 100;
    const x = (sec * bpm) / 60;
    return { phase: x % 1, count: Math.floor(x) };
  }

  /* ----- what they say: a bubble over her head ----- */

  say(text, ms = 3000, who = 'guest') {
    const b = this.bubbles[who];
    if (!b || !b.el) return;
    b.el.textContent = text;
    b.el.hidden = false;
    b.el.classList.remove('pop');
    void b.el.offsetWidth;
    b.el.classList.add('pop');
    b.until = this.time + ms / 1000;
    b.said = this.time;
  }

  hush(who = 'guest') {
    const b = this.bubbles[who];
    if (b && b.el) b.el.hidden = true;
    if (b) b.until = 0;
  }

  placeBubbles() {
    this.placeBubble('guest', this.guest);
    this.placeBubble('me', this.me);
    this.placeBubble('rider', this.courier);
    this.placeBubble('cat', this.cat);
    if (this.town) {
      this.placeBubble('clerk', this.town.clerk);
      this.placeBubble('barista', this.town.barista);
    }
    // (talking at once, close together: what was said first goes up over what was said after)
    const shown = Object.values(this.bubbles)
      .filter((b) => b.el && !b.el.hidden && b.at)
      .sort((a, b) => (b.said || 0) - (a.said || 0));
    for (let i = 1; i < shown.length; i++) {
      const b = shown[i];
      let moved = false;
      for (let j = 0; j < i; j++) {
        const n = shown[j];
        const apart = Math.abs(b.at.x - n.at.x) - (b.at.w + n.at.w) / 2;
        const across = b.at.y > n.at.y - n.at.h - 6 && b.at.y - b.at.h < n.at.y; // (the one over the other, up the screen)
        if (apart < 4 && across) {
          b.at.y = n.at.y - n.at.h - 6;
          moved = true;
        }
      }
      if (moved) b.el.style.transform = `translate(${Math.round(b.at.x)}px, ${Math.round(b.at.y)}px) translate(-50%, -100%)`;
    }
  }

  placeBubble(who, person) {
    const b = this.bubbles[who];
    if (!b.el || b.el.hidden) return;
    if (this.where === 'veranda' && who !== 'me') return this.hush(who); // (out on the veranda, only she is there to speak)
    // (one in the house while the street is shown — or one on the street while the house is — is not there to speak)
    const here = who === 'cat' ? person.world === (this.where === 'town' ? this.town : this) : this.where === 'town' ? who === 'me' || who === 'clerk' || who === 'barista' : who !== 'clerk' && who !== 'barista';
    if (this.time > b.until || !person.on || !here) return this.hush(who);
    const p = person.headPoint(_w).add(_v.set(0, person.abed ? 0.2 : 0.16, 0)).project(this.viewCamera);
    const W = this.stage.clientWidth;
    const half = (b.el.offsetWidth || 120) / 2;
    const x = ((p.x + 1) / 2) * W;
    const cx = clamp(x, half + 8, W - half - 8);
    const y = Math.max(((1 - p.y) / 2) * this.stage.clientHeight, (b.el.offsetHeight || 40) + 70);
    b.el.style.setProperty('--tail', `${Math.round(clamp(50 + ((x - cx) / (2 * half)) * 100, 12, 88))}%`);
    b.el.style.transform = `translate(${Math.round(cx)}px, ${Math.round(y)}px) translate(-50%, -100%)`;
    b.at = { x: cx, y, w: half * 2, h: b.el.offsetHeight || 40 };
  }

  // ---------------------------------------------------------------- pictures for the shop

  /** A thing on its own (a little turned, softly lit, on pink): a picture for the shop's list. */
  thumb(id, size = 132) {
    const key = `${id}:${size}`;
    if (this.thumbs.has(key)) return this.thumbs.get(key);
    const it = makeFurniture(id, { seed: 3 });
    if (!it) return '';
    if (it.set) {
      it.set('on', true);
      if (id === 'calendar') it.set('calendar', { y: 2026, m: 11, d: 28, count: 100, marks: [] });
    }
    if (it.update) it.update(0.016, 2, { dark: 0.6 });
    const wall = it.def.kind === 'wall';
    if (!wall) it.object.rotation.y = -0.55;
    return this.picture(key, it.object, size, wall);
  }

  /** A dish of the delivery menu (food.js), for the menu. */
  foodThumb(id, size = 132) {
    const key = `food:${id}:${size}`;
    if (this.thumbs.has(key)) return this.thumbs.get(key);
    const f = makeFood(id);
    if (!f) return '';
    f.object.rotation.y = -0.45;
    return this.picture(key, f.object, size, false, 0.32, 0.006);
  }

  /** Something to cook with (meals.js), for the convenience store's shelves. */
  ingThumb(id, size = 132) {
    const key = `ing:${id}:${size}`;
    if (this.thumbs.has(key)) return this.thumbs.get(key);
    const g = makeIngredient(id);
    g.object.rotation.y = -0.45;
    return this.picture(key, g.object, size, false, 0.4, 0.006);
  }

  /* A thing on its own, softly lit on pink, as a small picture (kept: it is drawn once). */
  picture(key, object, size, wall = false, up = 0.5, pad = 0.04) {
    this.grace();
    const r = this.renderer;
    const keep = { w: this.canvas.width, h: this.canvas.height, ratio: r.getPixelRatio() };
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#fff0f6');
    scene.environment = this.scene.environment;
    scene.environmentIntensity = 0.5;
    const hemi = new THREE.HemisphereLight('#ffffff', '#f0d6e0', 1.8);
    const sun = new THREE.DirectionalLight('#fff6ea', 1.6);
    sun.position.set(-2, 4, 3);
    scene.add(hemi, sun, object);
    object.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(object);
    const centre = box.getCenter(V());
    const dim = box.getSize(V());
    const camera = new THREE.PerspectiveCamera(26, 1, 0.05, 40);
    const R = Math.max(dim.x, dim.y, dim.z) * 0.62 + pad;
    const dist = R / Math.tan((13 * Math.PI) / 180);
    if (wall) camera.position.set(centre.x, centre.y + dist * 0.08, centre.z + dist);
    else camera.position.set(centre.x + dist * 0.25, centre.y + dist * up, centre.z + dist * 0.83);
    camera.lookAt(centre);
    r.setPixelRatio(1);
    r.setSize(size * 2, size * 2, false);
    r.render(scene, camera);
    const out = document.createElement('canvas');
    out.width = out.height = size;
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.canvas, 0, 0, size, size);
    const url = out.toDataURL('image/webp', 0.9);
    disposeTree(object);
    r.setPixelRatio(keep.ratio);
    r.setSize(keep.w / keep.ratio, keep.h / keep.ratio, false);
    if (this.stage) this.draw();
    this.thumbs.set(key, url);
    return url;
  }

  /** A swatch of a wallpaper or a floor (a picture of its texture). */
  swatch(kind, id) {
    const tex = kind === 'wall' ? wallpaper(id) : floorTexture(id);
    const img = tex.image;
    const c = document.createElement('canvas');
    c.width = c.height = 96;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0, img.width / (kind === 'wall' ? 1 : 2), img.height / (kind === 'wall' ? 1 : 2), 0, 0, 96, 96);
    return c.toDataURL('image/webp', 0.9);
  }

  /** The room as it is now, a picture (for her photo album). */
  capture(long = 1440) {
    if (!this.stage) return null;
    const r = this.renderer;
    const keep = { w: this.canvas.width, h: this.canvas.height, ratio: r.getPixelRatio() };
    const w = this.stage.clientWidth;
    const h = this.stage.clientHeight;
    const k = long / Math.max(w, h);
    const outline = this.outline.visible;
    this.outline.visible = false;
    r.setPixelRatio(1);
    r.setSize(Math.round(w * k), Math.round(h * k), false);
    if (this.where === 'town') r.render(this.town.scene, this.town.camera);
    else if (this.where === 'veranda') r.render(this.veranda.scene, this.veranda.camera);
    else r.render(this.scene, this.camera);
    const out = document.createElement('canvas');
    out.width = Math.round(w * k);
    out.height = Math.round(h * k);
    out.getContext('2d').drawImage(this.canvas, 0, 0);
    this.outline.visible = outline;
    r.setPixelRatio(keep.ratio);
    r.setSize(keep.w / keep.ratio, keep.h / keep.ratio, false);
    this.draw();
    return out;
  }

  // ---------------------------------------------------------------- out onto the veranda (veranda.js)

  /** She goes out onto the veranda: to the window, and out through it — then the veranda is shown, with her on it.
   *  → false if she cannot now. */
  goVeranda() {
    if (!this.stage || this.where !== 'home' || this.going || this.courier.on || this.guest.on || this.me.cooking) return false;
    this.going = true;
    const f = wallFrame(this.spec, 'back');
    const by = f.at(this.spec.win.u, 0, 0.5);
    this.me.redo([{ do: 'say', line: 'veranda_go' }, { do: 'walk', to: this.near(by, 0) || by }, { do: 'face', at: f.at(this.spec.win.u, 1.0, -1) }, { do: 'until', test: () => (this.enterVeranda(), true) }, { do: 'wait', t: 5 }]);
    return true;
  }

  /** (she is out of the window-door: the veranda, a moment's fade between) */
  enterVeranda() {
    this.fade(() => {
      if (!this.stage) return;
      if (!this.veranda) {
        this.veranda = new Veranda(this);
        this.veranda.resize(this.stage.clientWidth, this.stage.clientHeight);
        this.frameView();
      }
      if (this.look) this.veranda.setLook(this.look);
      this.where = 'veranda';
      this.going = false;
      this.hush('me');
      this.veranda.show(this.me);
      this.grace(2500);
      this.host.onVeranda('out');
    });
  }

  /** She is in at the window-door again: the house. */
  leaveVeranda() {
    this.fade(() => this.fromVeranda(false));
  }

  fromVeranda(quiet) {
    if (this.where !== 'veranda') return;
    const me = this.me;
    this.veranda.hide();
    this.where = 'home';
    this.going = false;
    me.world = this;
    me.walkSpeed = undefined;
    this.scene.add(me.rig.group);
    this.hush('me');
    if (quiet) return;
    // in by the window, and on into the room — what she picked, in the basket on her arm, to the fridge
    const f = wallFrame(this.spec, 'back');
    const by = f.at(this.spec.win.u, 0, 0.45);
    const a = me.anim;
    a.pos.copy(this.near(by, 0) || by);
    a.yaw = 0;
    a.pitch = 0;
    a.air = 0;
    a.look = null;
    a.lookW = 0;
    a.still();
    a.setPose('stand', 30);
    a.snap();
    me.on = true;
    me.rig.group.visible = true;
    me.seat = me.abed = null;
    const basket = me.props.L && me.props.L.object.userData.basket;
    const spot = basket && (this.spotOf('fridge') || this.spotOf('kitchen'));
    me.tasks = [{ do: 'wait', t: 0.4 }];
    if (basket) me.tasks.push(...(spot ? [{ do: 'walk', to: spot.at }, { do: 'look', at: spot.face, t: 2.2, line: 'put_away', pose: 'bend' }] : []), { do: 'unbag' });
    me.task = null;
    this.grace(1500);
    this.host.onVeranda('in');
  }
}

/* A number from a string (to seed the look of a thing: the books on a shelf, the leaves of a plant). */
function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
