// 베란다 텃밭 — the veranda outside her window, on the same screen as the house (world.js shows one or the other, as it
// does the street). She steps out of the glass door onto it; along its railing stand her planter boxes (two to begin with,
// four at most) and in them what she has sown, as far as it has grown (crops.js). She tends them: fills the watering can
// at the tap and waters them a box at a time; kneels and sows a packet of seeds, and waters them in; kneels and picks what
// is ripe into her basket (a strawberry, now and then, straight into her mouth) — and takes it in, to the fridge. Left to
// herself she looks her plants over, sits on the little stool in the sun, looks out over the railing, stretches.
//
// Its light is the hour's — the real sun over the railing (the veranda faces south, as the window does), the evening, the
// night with the lamp by the door lit and the room glowing through the glass — and the city's weather: rain falls on the
// boxes (it waters them: js/veranda.js), snow. The camera looks at it from out over the railing; the railing on her side
// folds down, as the house's walls do. A finger turns it a little, two bring it closer; a tap on a box, the can, the basket,
// the door does what that is for — on the floor, she walks there.
//
// It is the "world" the girl is in while she is out here (person.js): its time, its camera, its way about, its bubbles —
// and what she does only here (ownTask), and what she does next when left to herself (planFor).
import * as THREE from '../vendor/three.module.min.js';
import { FUR_SUN } from '../fox/rig.js';
import { softDotTexture, disposeTree } from '../fox/kit.js';
import { Batch, MAT, V, TAU, rng, roundBox, paintTexture } from './shapes.js';
import { Fx } from './fx.js';
import { makeCrop, makeCan, makeBasket, makeSeeds, makeStake, makeProduce } from './crops.js';

const W = 3.4; //                 the veranda along the house (x)…
const D = 1.6; //                 …and out from it (z): the house's wall at z = −D/2, the railing at +D/2
const WALL_H = 2.1;
const RAIL_H = 0.84;
const BOX = { w: 0.64, d: 0.3, h: 0.28, legs: 0.08, rim: 0.025 }; // a planter box: its soil `rim` below its top
const SOIL = BOX.legs + BOX.h - BOX.rim; //                          (the soil's height above the floor)
const BOX_X = [-0.39, 0.39, -1.17, 1.17]; //                         where each box stands (the middle two come first)
const BOX_Z = 0.5;
const TEND_Z = 0.05; //           where she stands (or kneels) to tend a box
const DOOR = { x: -1.05, w: 0.92, h: 1.6, walk: -0.84 }; // the glass door: its middle, how wide, how high, where she goes through
const WIN = { x: 0.6, w: 1.1, y0: 0.95, y1: 1.72 }; //       …and the window of the room beside it, over the tap
const TAP = V(0.42, 0.62, -D / 2); // the tap on the wall…
const CAN_AT = V(0.42, 0, -0.6); //  …the watering can under it
const BASKET_AT = V(0.02, 0, -0.62);
const STOOL_AT = V(-0.36, 0, -0.5);
const AC = { x: 1.15, w: 0.74, h: 0.56, d: 0.3 };
const FOV = 30;
const YAW = -0.3; //              (from out over the railing, a little to the left…)
const YAW_TALL = -1.0; //         (…further round on a screen held upright: the boxes in a line up it)
const PITCH = 0.7;
const PITCH_TALL = 0.95;
const ZOOM_MIN = 0.42;
const ZOOM_MAX = 1.2;
const TAP_PX = 9;
const _v = V();
const _w = V();
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _floor = new THREE.Plane(V(0, 1, 0), 0);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const pickOne = (list) => list[Math.floor(Math.random() * list.length)];

/* What she thinks of a box as it is now (the line she says, looking it over). */
const lookLine = (b) => (b.dry ? 'look_dry' : `look_${b.stage}`);

/* Rain, or snow: streaks or flakes falling over the veranda. */
class Falling {
  constructor(scene) {
    const N = 420;
    this.N = N;
    this.rain = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#dfe8ff', transparent: true, opacity: 0.5 }));
    this.rain.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
    this.snow = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ map: softDotTexture(), color: '#ffffff', size: 0.07, transparent: true, depthWrite: false, opacity: 0.95 }));
    this.snow.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
    for (const o of [this.rain, this.snow]) {
      o.frustumCulled = false;
      o.visible = false;
      scene.add(o);
    }
    this.drops = Array.from({ length: N }, () => ({ x: (Math.random() - 0.5) * 5, y: Math.random() * 3.6, z: -0.7 + Math.random() * 3.2, s: 0.7 + Math.random() * 0.6 }));
    this.kind = 'clear';
    this.level = 0;
  }

  set(kind, level) {
    this.kind = kind;
    this.level = kind === 'rain' || kind === 'snow' ? Math.max(0.35, level || 0) : 0;
    this.rain.visible = kind === 'rain';
    this.snow.visible = kind === 'snow';
  }

  update(dt) {
    if (!this.level) return;
    const rain = this.kind === 'rain';
    const n = Math.floor(this.N * this.level);
    const arr = (rain ? this.rain : this.snow).geometry.attributes.position.array;
    for (let i = 0; i < this.N; i++) {
      const d = this.drops[i];
      d.y -= dt * (rain ? 6.5 * d.s : 0.55 * d.s);
      if (!rain) d.x += Math.sin(d.y * 1.7 + i) * dt * 0.2;
      if (d.y < 0) {
        d.y += 3.6;
        d.x = (Math.random() - 0.5) * 5;
        d.z = -0.7 + Math.random() * 3.2;
      }
      const hide = i >= n ? -50 : 0;
      if (rain) arr.set([d.x, d.y + hide, d.z, d.x + 0.015, d.y + 0.2 + hide, d.z], i * 6);
      else arr.set([d.x, d.y + hide, d.z], i * 3);
    }
    (rain ? this.rain : this.snow).geometry.attributes.position.needsUpdate = true;
  }
}

/* A cabbage white: about the boxes on a fine day, fluttering, now and then settling on a leaf for a moment. */
class Butterfly {
  constructor(scene) {
    const g = (this.group = new THREE.Group());
    const wing = new THREE.MeshStandardMaterial({ color: '#fffdf4', roughness: 0.7, side: THREE.DoubleSide });
    const shape = new THREE.CircleGeometry(0.03, 10);
    shape.scale(1, 0.75, 1);
    shape.translate(0.028, 0.004, 0);
    this.wings = [1, -1].map((s) => {
      const pivot = new THREE.Group();
      const m = new THREE.Mesh(shape, wing);
      m.scale.x = s;
      m.rotation.x = -Math.PI / 2;
      const spot = new THREE.Mesh(new THREE.CircleGeometry(0.006, 8), new THREE.MeshBasicMaterial({ color: '#3a3340', side: THREE.DoubleSide }));
      spot.position.set(s * 0.03, 0.001, 0.006);
      spot.rotation.x = -Math.PI / 2;
      pivot.add(m, spot);
      g.add(pivot);
      return pivot;
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.005, 0.03, 3, 6), new THREE.MeshStandardMaterial({ color: '#4a4048', roughness: 0.6 }));
    body.rotation.x = Math.PI / 2;
    g.add(body);
    g.visible = false;
    scene.add(g);
    this.t = Math.random() * 10;
    this.rest = 0;
  }

  update(dt, on, perches) {
    this.group.visible = on;
    if (!on) return;
    this.t += dt;
    const t = this.t;
    let flap = Math.sin(t * 26) * 0.9;
    if (this.rest > 0) {
      // settled on a leaf: its wings up together, opening now and then
      this.rest -= dt;
      flap = 1.25 + Math.sin(t * 3) * 0.2;
    } else {
      const x = Math.sin(t * 0.31) * 1.4 + Math.sin(t * 1.3) * 0.2;
      const z = 0.25 + Math.sin(t * 0.47 + 1) * 0.55;
      const y = 0.85 + Math.sin(t * 0.9) * 0.22 + Math.sin(t * 3.1) * 0.05;
      const p = this.group.position;
      const dx = x - p.x;
      const dz = z - p.z;
      p.set(x, y, z);
      if (Math.abs(dx) + Math.abs(dz) > 1e-4) this.group.rotation.y = Math.atan2(dx, dz);
      // (now and then, down onto something growing)
      if (perches.length && Math.random() < dt * 0.06) {
        const at = pickOne(perches);
        p.copy(at);
        this.rest = 2.5 + Math.random() * 3;
      }
    }
    this.wings[0].rotation.z = flap;
    this.wings[1].rotation.z = -flap;
  }
}

export class Veranda {
  constructor(world) {
    this.world = world;
    this.host = world.host;
    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color('#ffe6f0');
    scene.environment = world.scene.environment;
    scene.environmentIntensity = 0.5;
    this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.2, 60);
    this.view = { yaw: YAW, pitch: PITCH, zoom: 1, target: V(0, 0.55, 0) };
    this.cam = { yaw: YAW, pitch: PITCH, zoom: 1, target: V(0, 0.55, 0) };
    this.fit = 8;
    this.homeAt = V(0, 0.55, 0); //  (where it looks for all of it to sit in the middle of the screen: fitView)
    this.atView = null;

    // the light: the sky's, the sun's (from the south — over the railing — with its shadows), and the lamp by the door
    this.hemi = new THREE.HemisphereLight('#fff7ee', '#d9c6b0', 1.2);
    this.sun = new THREE.DirectionalLight('#fffaf0', 1.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.setScalar(world.coarse ? 1536 : 2048);
    Object.assign(this.sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 1, far: 20 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.02;
    scene.add(this.hemi, this.sun, this.sun.target);
    this.lamp = new THREE.PointLight('#ffc98a', 0, 3.2, 1.6);
    this.lamp.position.set(-0.36, 1.52, -D / 2 + 0.25);
    this.glow = new THREE.PointLight('#ffd9a8', 0, 2.4, 1.4); // (the room, through the glass of the door)
    this.glow.position.set(DOOR.x, 1.0, -D / 2 + 0.35);
    scene.add(this.lamp, this.glow);

    this.fx = new Fx(scene);
    this.falling = new Falling(scene);
    this.butterfly = new Butterfly(scene);
    this.taps = []; //   what a tap can find: the boxes, the can, the basket, the stool, the door, the tap, the air conditioner
    this.build();

    this.me = null; //   the girl, while she is out here
    this.busy = null; // what she is in the middle of: 'water', 'sow', 'pick', 'in' — the app does not take her from it
    this.doorOpen = 0;
    this.doorWant = 0;
    this.lit = { dark: 0 };
    this.pointer = { down: false };
    this.fingers = new Map();
    this.pinch = null;
    // (what the people in it need of a world: person.js)
    this.room = { openDoor: (open) => (this.doorWant = open ? 1 : 0) };
    this.guest = { on: false, going: false, task: null, tasks: [], pos: V() };
    this.bubbles = world.bubbles;
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

  /** (the veranda is open between the wall and the boxes: straight there) */
  path(from, to) {
    return [this.keepIn(to.clone())];
  }

  randomFree() {
    return V(-1.3 + Math.random() * 1.9, 0, -0.38 + Math.random() * 0.5);
  }

  musicOn() {
    return this.world.musicOn();
  }

  beat() {
    return this.world.beat();
  }

  /* A point she can stand on: between the wall and the boxes, clear of the air conditioner. */
  keepIn(p) {
    p.x = clamp(p.x, -W / 2 + 0.2, W / 2 - 0.2);
    p.z = clamp(p.z, -D / 2 + 0.28, TEND_Z + 0.08);
    if (p.x > AC.x - AC.w / 2 - 0.16) p.z = Math.max(p.z, -D / 2 + AC.d + 0.16);
    p.y = 0;
    return p;
  }

  // ---------------------------------------------------------------- building it

  build() {
    const scene = this.scene;
    const group = (this.group = new THREE.Group());
    scene.add(group);
    // the slab, its tiles; a soft shadow under it all
    const tiles = paintTexture(256, (g, S) => {
      g.fillStyle = '#d8c2ad';
      g.fillRect(0, 0, S, S);
      const n = 4;
      const k = S / n;
      const rnd = rng(17);
      for (let i = 0; i < n; i++)
        for (let j = 0; j < n; j++) {
          g.fillStyle = ['#efdfcf', '#ecdccb', '#f2e4d6', '#eadac8'][Math.floor(rnd() * 4)];
          g.fillRect(i * k + 2, j * k + 2, k - 4, k - 4);
          g.fillStyle = 'rgba(255, 255, 255, 0.25)';
          g.fillRect(i * k + 6, j * k + 5, k * 0.35, 3);
        }
    });
    tiles.wrapS = tiles.wrapT = THREE.RepeatWrapping;
    tiles.repeat.set(W / 1.2, D / 1.2);
    const slabMat = new THREE.MeshStandardMaterial({ color: '#f1e3d4', roughness: 0.9 });
    const floorMat = new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.62 });
    const slab = new THREE.Mesh(new THREE.BoxGeometry(W + 0.12, 0.2, D + 0.06), [slabMat, slabMat, floorMat, slabMat, slabMat, slabMat]);
    slab.position.set(0, -0.1, 0.03);
    slab.receiveShadow = true;
    group.add(slab);
    this.floor = slab;
    const shadowTex = paintTexture(128, (g, S) => {
      const grad = g.createRadialGradient(S / 2, S / 2, 8, S / 2, S / 2, S / 2);
      grad.addColorStop(0, 'rgba(90, 60, 80, 0.3)');
      grad.addColorStop(1, 'rgba(90, 60, 80, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, S, S);
    });
    const under = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.6, D * 2.2), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    under.rotation.x = -Math.PI / 2;
    under.position.set(0, -0.3, 0);
    under.renderOrder = -1;
    group.add(under);
    this.buildWall(group);
    this.buildDoor(group);
    this.buildTap(group);
    this.buildAircon(group);
    this.buildStool(group);
    this.buildRailing(group);
    this.buildBoxes(group);
    // the can under the tap, the basket by the stool
    this.can = makeCan();
    this.putCan();
    this.basket = makeBasket();
    this.putBasket();
  }

  /* The house's wall behind it: cream, a line along it at the height of the room's floor, a gutter pipe down its corner. */
  buildWall(group) {
    const shape = new THREE.Shape();
    const L = W + 0.12;
    shape.moveTo(-L / 2, 0);
    shape.lineTo(L / 2, 0);
    shape.lineTo(L / 2, WALL_H);
    shape.lineTo(-L / 2, WALL_H);
    shape.closePath();
    const hole = new THREE.Path();
    const x0 = DOOR.x - DOOR.w / 2;
    const x1 = DOOR.x + DOOR.w / 2;
    hole.moveTo(x0, 0.0001);
    hole.lineTo(x0, DOOR.h);
    hole.lineTo(x1, DOOR.h);
    hole.lineTo(x1, 0.0001);
    hole.closePath();
    shape.holes.push(hole);
    const win = new THREE.Path();
    win.moveTo(WIN.x - WIN.w / 2, WIN.y0);
    win.lineTo(WIN.x - WIN.w / 2, WIN.y1);
    win.lineTo(WIN.x + WIN.w / 2, WIN.y1);
    win.lineTo(WIN.x + WIN.w / 2, WIN.y0);
    win.closePath();
    shape.holes.push(win);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.14, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -0.14);
    const render = paintTexture(256, (g, S) => {
      g.fillStyle = '#f7efe4';
      g.fillRect(0, 0, S, S);
      const rnd = rng(29);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = rnd() < 0.5 ? 'rgba(200, 170, 140, 0.08)' : 'rgba(255, 255, 255, 0.35)';
        g.fillRect(rnd() * S, rnd() * S, 2, 2);
      }
    });
    render.wrapS = render.wrapT = THREE.RepeatWrapping;
    render.repeat.set(1.2, 1.2);
    const wall = new THREE.Mesh(geo, [new THREE.MeshStandardMaterial({ map: render, roughness: 0.95 }), new THREE.MeshStandardMaterial({ color: '#efe4d6', roughness: 0.9 })]);
    wall.position.z = -D / 2;
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);
    const trim = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
    const sill = new THREE.Mesh(roundBox(L, 0.06, 0.05, 0.015), trim);
    sill.position.set(0, WALL_H - 0.03, -D / 2 + 0.02);
    const skirt = new THREE.Mesh(roundBox(L, 0.08, 0.025, 0.008), new THREE.MeshStandardMaterial({ color: '#e2cdb8', roughness: 0.8 }));
    skirt.position.set(0, 0.04, -D / 2 + 0.012);
    skirt.receiveShadow = true;
    group.add(sill, skirt);
    // the drainpipe at the right-hand end
    const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, WALL_H, 12), new THREE.MeshStandardMaterial({ color: '#e9e4de', roughness: 0.5 }));
    pipe.position.set(W / 2 - 0.08, WALL_H / 2, -D / 2 + 0.05);
    pipe.castShadow = true;
    group.add(pipe);
    // the lamp by the door: a little round light in a cage
    const lampBase = new THREE.Mesh(roundBox(0.12, 0.16, 0.04, 0.02), new THREE.MeshStandardMaterial({ color: '#3a3340', roughness: 0.5 }));
    lampBase.position.set(-0.36, 1.52, -D / 2 + 0.02);
    this.bulbMat = new THREE.MeshStandardMaterial({ color: '#fff3dc', roughness: 0.4, emissive: '#ffc77a', emissiveIntensity: 0 });
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 16, 12), this.bulbMat);
    bulb.position.set(-0.36, 1.52, -D / 2 + 0.09);
    bulb.scale.set(1, 1.2, 1);
    group.add(lampBase, bulb);
  }

  /*
   * The glass door into the room: two panes in white frames — the right one slides behind the left to let her through —
   * and behind them the room: its pink wall and curtain, warm when the light in it is on.
   */
  buildDoor(group) {
    const frameMat = new THREE.MeshStandardMaterial({ color: '#fbfbfb', roughness: 0.4, metalness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: '#dff2ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false });
    const z = -D / 2 - 0.07;
    const pane = (x, dz) => {
      const g = new THREE.Group();
      const w = DOOR.w / 2 + 0.02;
      const h = DOOR.h - 0.04;
      const bar = (bw, bh, bx, by) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.03), frameMat);
        m.position.set(bx, by, 0);
        m.castShadow = true;
        g.add(m);
      };
      bar(w, 0.04, 0, h - 0.02);
      bar(w, 0.06, 0, 0.03);
      bar(0.04, h, -w / 2 + 0.02, h / 2);
      bar(0.04, h, w / 2 - 0.02, h / 2);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.06, h - 0.1), glassMat);
      glass.position.set(0, h / 2 + 0.01, 0);
      g.add(glass);
      const handle = new THREE.Mesh(roundBox(0.02, 0.12, 0.02, 0.008), new THREE.MeshStandardMaterial({ color: '#c6c7d2', roughness: 0.3, metalness: 0.8 }));
      handle.position.set(-w / 2 + 0.06, 0.9, 0.025);
      g.add(handle);
      g.position.set(x, 0.02, z + dz);
      group.add(g);
      return g;
    };
    this.fixedPane = pane(DOOR.x - DOOR.w / 4, -0.03);
    this.slidePane = pane(DOOR.x + DOOR.w / 4, 0.02);
    this.slideX = DOOR.x + DOOR.w / 4;
    // the frame round the doorway
    const jamb = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w + 0.1, 0.06, 0.18), frameMat);
    jamb.position.set(DOOR.x, DOOR.h + 0.02, -D / 2 - 0.06);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w + 0.1, 0.025, 0.2), frameMat);
    sill.position.set(DOOR.x, 0.012, -D / 2 - 0.06);
    group.add(jamb, sill);
    // the room behind: its floor, its wallpaper, the curtain drawn to one side
    const inside = paintTexture(256, (g, S) => {
      g.fillStyle = '#ffe9ef';
      g.fillRect(0, 0, S, S);
      g.fillStyle = 'rgba(255, 180, 200, 0.35)';
      for (let x = 8; x < S; x += 32) g.fillRect(x, 0, 10, S);
      g.fillStyle = '#ffd3e0';
      g.fillRect(S * 0.62, 0, S * 0.3, S);
      g.fillStyle = 'rgba(255, 255, 255, 0.35)';
      for (let x = S * 0.64; x < S * 0.9; x += 12) g.fillRect(x, 0, 4, S);
    });
    this.roomMat = new THREE.MeshStandardMaterial({ map: inside, roughness: 0.9, emissive: '#ffcf9a', emissiveIntensity: 0 });
    const back = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w + 0.2, DOOR.h + 0.1), this.roomMat);
    back.position.set(DOOR.x, DOOR.h / 2, -D / 2 - 0.62);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(DOOR.w + 0.2, 0.62), new THREE.MeshStandardMaterial({ color: '#d9a676', roughness: 0.7 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(DOOR.x, 0.002, -D / 2 - 0.31);
    for (const s of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(0.62, DOOR.h + 0.1), this.roomMat);
      side.position.set(DOOR.x + s * (DOOR.w / 2 + 0.1), DOOR.h / 2, -D / 2 - 0.31);
      side.rotation.y = -s * Math.PI / 2;
      group.add(side);
    }
    group.add(back, floor);
    // the window beside it: two panes in a white frame, a sill, the room behind (its curtain, its light)
    const wh = WIN.y1 - WIN.y0;
    const bar = (bw, bh, x, y, z = -D / 2 - 0.07) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.05), frameMat);
      m.position.set(x, y, z);
      m.castShadow = true;
      group.add(m);
    };
    bar(WIN.w + 0.06, 0.04, WIN.x, WIN.y1);
    bar(WIN.w + 0.06, 0.04, WIN.x, WIN.y0);
    bar(0.04, wh, WIN.x - WIN.w / 2, (WIN.y0 + WIN.y1) / 2);
    bar(0.04, wh, WIN.x + WIN.w / 2, (WIN.y0 + WIN.y1) / 2);
    bar(0.035, wh, WIN.x, (WIN.y0 + WIN.y1) / 2, -D / 2 - 0.05);
    const ledge = new THREE.Mesh(roundBox(WIN.w + 0.16, 0.035, 0.1, 0.012), frameMat);
    ledge.position.set(WIN.x, WIN.y0 - 0.02, -D / 2 + 0.03);
    ledge.castShadow = ledge.receiveShadow = true;
    group.add(ledge);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w - 0.04, wh - 0.04), glassMat);
    glass.position.set(WIN.x, (WIN.y0 + WIN.y1) / 2, -D / 2 - 0.06);
    group.add(glass);
    const room = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w + 0.1, wh + 0.1), this.roomMat);
    room.position.set(WIN.x, (WIN.y0 + WIN.y1) / 2, -D / 2 - 0.42);
    group.add(room);
    for (const sx of [-1, 1]) {
      const side = new THREE.Mesh(new THREE.PlaneGeometry(0.36, wh + 0.1), this.roomMat);
      side.position.set(WIN.x + sx * (WIN.w / 2 + 0.05), (WIN.y0 + WIN.y1) / 2, -D / 2 - 0.24);
      side.rotation.y = -sx * Math.PI / 2;
      group.add(side);
    }
    const sillIn = new THREE.Mesh(new THREE.PlaneGeometry(WIN.w + 0.1, 0.36), new THREE.MeshStandardMaterial({ color: '#f6e7dc', roughness: 0.8 }));
    sillIn.rotation.x = -Math.PI / 2;
    sillIn.position.set(WIN.x, WIN.y0 - 0.01, -D / 2 - 0.24);
    group.add(sillIn);
    // (seen from up high the rooms behind would show over the top of the wall, and round its ends: a lid over them and
    // ends to them that are not drawn, only hide — the room is seen through the door and the window, and nowhere else)
    const unseen = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide });
    const deep = 0.7;
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(W + 0.12, deep), unseen);
    lid.rotation.x = -Math.PI / 2;
    lid.position.set(0, WALL_H, -D / 2 - 0.14 - deep / 2);
    lid.renderOrder = -2;
    group.add(lid);
    for (const sx of [-1, 1]) {
      const end = new THREE.Mesh(new THREE.PlaneGeometry(deep, WALL_H), unseen);
      end.rotation.y = Math.PI / 2;
      end.position.set((sx * (W + 0.12)) / 2, WALL_H / 2, -D / 2 - 0.14 - deep / 2);
      end.renderOrder = -2;
      group.add(end);
    }
    // (a tap on the door: back in)
    const hit = new THREE.Mesh(new THREE.BoxGeometry(DOOR.w, DOOR.h, 0.1), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.set(DOOR.x, DOOR.h / 2, -D / 2 - 0.05);
    hit.userData.tap = 'door';
    group.add(hit);
    this.taps.push(hit);
  }

  /* The tap on the wall, its spout down, its handle a little wheel. */
  buildTap(group) {
    const brass = new THREE.MeshStandardMaterial({ color: '#e0b24a', roughness: 0.28, metalness: 0.85 });
    const g = new THREE.Group();
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 16), brass);
    plate.rotation.x = Math.PI / 2;
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.09, 10), brass);
    arm.rotation.x = Math.PI / 2;
    arm.position.z = 0.05;
    const spout = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.014, 0.06, 10), brass);
    spout.position.set(0, -0.025, 0.095);
    const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.026, 0.006, 6, 14), new THREE.MeshStandardMaterial({ color: '#ff8fb2', roughness: 0.4 }));
    wheel.position.set(0, 0.04, 0.06);
    wheel.rotation.x = Math.PI / 2;
    g.add(plate, arm, spout, wheel);
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.tap = 'tap';
      }
    });
    g.position.copy(TAP);
    group.add(g);
    this.taps.push(...g.children);
    this.spoutAt = TAP.clone().add(V(0, -0.06, 0.095));
    // the water from it, while the can is filled
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.008, 1, 8, 1, true), new THREE.MeshStandardMaterial({ color: '#cfeaff', roughness: 0.05, transparent: true, opacity: 0.6, depthWrite: false }));
    this.stream.visible = false;
    group.add(this.stream);
  }

  /* The air conditioner's outdoor unit against the wall (as on every veranda), its fan behind a round grille — and a
     little succulent on top of it. */
  buildAircon(group) {
    const P = new Batch();
    const shell = '#eceef0';
    P.add(roundBox(AC.w, AC.h, AC.d, 0.03), { at: [0, AC.h / 2 + 0.04, 0], color: [shell, '#f8f9fa'] });
    for (let i = 0; i < 9; i++) P.add(new THREE.BoxGeometry(0.2, 0.008, 0.01), { at: [AC.w / 2 - 0.14, 0.14 + i * 0.045, AC.d / 2 + 0.002], color: '#cfd3d8' });
    for (const x of [-AC.w / 2 + 0.08, AC.w / 2 - 0.08]) P.add(new THREE.BoxGeometry(0.06, 0.04, AC.d - 0.04), { at: [x, 0.02, 0], color: '#b9bec5' });
    P.add(new THREE.TorusGeometry(0.19, 0.016, 8, 32), { at: [-0.1, AC.h / 2 + 0.04, AC.d / 2 + 0.005], color: '#d9dde2' });
    const unit = P.mesh(MAT.paint);
    const g = new THREE.Group();
    g.add(unit);
    const grille = new THREE.Mesh(new THREE.CircleGeometry(0.185, 32), new THREE.MeshStandardMaterial({ color: '#4a4f58', roughness: 0.7 }));
    grille.position.set(-0.1, AC.h / 2 + 0.04, AC.d / 2 + 0.003);
    g.add(grille);
    // the fan behind it, turning in the summer
    const fan = new THREE.Group();
    for (let i = 0; i < 3; i++) {
      const blade = new THREE.Mesh(new THREE.CircleGeometry(0.075, 10, 0, 1.4), new THREE.MeshStandardMaterial({ color: '#8b929c', roughness: 0.5, side: THREE.DoubleSide }));
      blade.rotation.z = (i / 3) * TAU;
      fan.add(blade);
    }
    fan.position.set(-0.1, AC.h / 2 + 0.04, AC.d / 2 + 0.006);
    g.add(fan);
    this.fan = fan;
    const bars = new THREE.Mesh(new THREE.RingGeometry(0.06, 0.185, 24, 1), new THREE.MeshBasicMaterial({ color: '#2f333a', wireframe: true, transparent: true, opacity: 0.45 }));
    bars.position.set(-0.1, AC.h / 2 + 0.04, AC.d / 2 + 0.01);
    g.add(bars);
    // its pipes into the wall
    const pipe = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.016, 6, 12, Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.6 }));
    pipe.position.set(-AC.w / 2 - 0.02, AC.h - 0.05, -AC.d / 2 + 0.04);
    pipe.rotation.set(0, Math.PI / 2, 0);
    g.add(pipe);
    // a succulent on top, in a pink pot
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, 0.07, 16), new THREE.MeshStandardMaterial({ color: '#ffb3c9', roughness: 0.5 }));
    pot.position.set(0.18, AC.h + 0.075, 0.02);
    g.add(pot);
    const S = new Batch();
    const rnd = rng(5);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * TAU + rnd() * 0.3;
      const r = i < 6 ? 0.03 : 0.012;
      S.add(new THREE.SphereGeometry(0.018, 8, 6), { at: [0.18 + Math.cos(a) * r, AC.h + 0.125 + (i < 6 ? 0 : 0.012), 0.02 + Math.sin(a) * r], scale: [0.7, 0.5, 1.2], rot: [0.5, -a, 0], color: ['#6fae8a', '#a9d8b8'] });
    }
    g.add(S.mesh(MAT.leaf));
    g.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = o.receiveShadow = true;
        o.userData.tap = 'ac';
      }
    });
    g.position.set(AC.x, 0, -D / 2 + AC.d / 2 + 0.01);
    group.add(g);
    this.taps.push(...g.children);
  }

  /* A little pink plastic stool, as in every bathhouse — to sit on in the sun. */
  buildStool(group) {
    const P = new Batch();
    const pink = ['#ff8fb2', '#ffb3c9'];
    P.add(roundBox(0.32, 0.035, 0.3, 0.015), { at: [0, 0.185, 0], color: pink });
    for (const sx of [-1, 1]) P.add(roundBox(0.03, 0.17, 0.27, 0.01), { at: [sx * 0.13, 0.085, 0], color: pink });
    P.add(new THREE.TorusGeometry(0.035, 0.008, 6, 14), { at: [0, 0.205, 0], rot: [Math.PI / 2, 0, 0], color: '#ff7aa2' });
    const m = P.mesh(MAT.gloss);
    m.userData.tap = 'stool';
    m.position.copy(STOOL_AT);
    group.add(m);
    this.taps.push(m);
    this.seat = { at: STOOL_AT.clone(), yaw: 0.25, h: 0.2 };
  }

  /*
   * The railing round its three open sides: white posts, a rail along the top, glass between — each side on a pivot at its
   * foot, so that the side she looks from can fold down out of the way (as the house's walls do). Fairy lights along the
   * top of the front, lit at night.
   */
  buildRailing(group) {
    const white = '#fbfbfb';
    this.sides = [];
    this.fairy = [];
    const glass = new THREE.MeshStandardMaterial({ color: '#e4f5ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide });
    this.bulbsMat = new THREE.MeshStandardMaterial({ color: '#fff6dc', roughness: 0.3, emissive: '#ffd27a', emissiveIntensity: 0 });
    const side = (len, at, yaw, out, lights) => {
      const pivot = new THREE.Group();
      pivot.position.copy(at);
      pivot.rotation.y = yaw;
      const P = new Batch();
      const n = Math.max(2, Math.round(len / 0.56));
      for (let i = 0; i <= n; i++) P.add(roundBox(0.035, RAIL_H, 0.035, 0.012), { at: [-len / 2 + (i * len) / n, RAIL_H / 2, 0], color: white });
      P.add(roundBox(len + 0.04, 0.05, 0.07, 0.022), { at: [0, RAIL_H, 0], color: white });
      P.add(roundBox(len, 0.03, 0.04, 0.012), { at: [0, 0.09, 0], color: white });
      const posts = P.mesh(MAT.gloss);
      pivot.add(posts);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(len - 0.04, RAIL_H - 0.14), glass);
      pane.position.set(0, RAIL_H / 2 + 0.03, 0);
      pivot.add(pane);
      if (lights) {
        const B = new Batch();
        const k = Math.round(len / 0.16);
        for (let i = 0; i <= k; i++) {
          const x = -len / 2 + (i * len) / k;
          B.add(new THREE.SphereGeometry(0.018, 8, 6), { at: [x, RAIL_H - 0.045 - Math.abs(Math.sin((i / k) * Math.PI * 6)) * 0.035, 0.04], color: ['#ffd23f', '#ff9ec0', '#9fe0ff', '#c9a6ff'][i % 4] });
        }
        const bulbs = B.mesh(this.bulbsMat);
        bulbs.castShadow = false;
        pivot.add(bulbs);
      }
      group.add(pivot);
      this.sides.push({ pivot, out, shown: 1, want: 1 });
    };
    side(W, V(0, 0, D / 2 - 0.02), 0, V(0, 0, 1), true);
    side(D, V(-W / 2 + 0.02, 0, 0), Math.PI / 2, V(-1, 0, 0), false);
    side(D, V(W / 2 - 0.02, 0, 0), -Math.PI / 2, V(1, 0, 0), false);
  }

  /* The four planter boxes (shown as she has them): wooden, on little legs, soil in them — and in it what she has sown,
     with a stake that says what it is. */
  buildBoxes(group) {
    const soilTex = paintTexture(128, (g, S) => {
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, S, S);
      const rnd = rng(41);
      for (let i = 0; i < 700; i++) {
        const v = 150 + Math.floor(rnd() * 105);
        g.fillStyle = `rgba(${v}, ${v - 20}, ${v - 40}, 0.55)`;
        g.beginPath();
        g.arc(rnd() * S, rnd() * S, 0.8 + rnd() * 1.8, 0, TAU);
        g.fill();
      }
    });
    this.boxes = BOX_X.map((x, i) => {
      const g = new THREE.Group();
      g.position.set(x, 0, BOX_Z);
      const P = new Batch();
      const OAK = (p) => _c.set('#c48c58').lerp(_c2.set('#dcae7c'), 0.5 + 0.5 * Math.sin(Math.floor((p.y + 0.01) / 0.07) * 2.7)).clone();
      const { w, d, h, legs } = BOX;
      const y = legs + h / 2;
      P.add(roundBox(w, h, 0.025, 0.008), { at: [0, y, d / 2 - 0.0125], color: OAK });
      P.add(roundBox(w, h, 0.025, 0.008), { at: [0, y, -d / 2 + 0.0125], color: OAK });
      for (const s of [-1, 1]) P.add(roundBox(0.025, h, d - 0.05, 0.008), { at: [s * (w / 2 - 0.0125), y, 0], color: OAK });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) P.add(roundBox(0.045, legs + 0.02, 0.045, 0.01), { at: [sx * (w / 2 - 0.04), (legs + 0.02) / 2, sz * (d / 2 - 0.04)], color: '#a8743f' });
      P.add(new THREE.BoxGeometry(w - 0.04, 0.02, d - 0.04), { at: [0, legs + 0.01, 0], color: '#6b4a34' });
      // a heart burnt into the front
      P.add(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 14), { at: [-0.012, y + 0.02, d / 2 + 0.001], rot: [Math.PI / 2, 0, 0], color: '#9a6236' });
      P.add(new THREE.CylinderGeometry(0.018, 0.018, 0.004, 14), { at: [0.012, y + 0.02, d / 2 + 0.001], rot: [Math.PI / 2, 0, 0], color: '#9a6236' });
      P.add(new THREE.CylinderGeometry(0.003, 0.025, 0.03, 4), { at: [0, y - 0.004, d / 2 + 0.001], rot: [Math.PI, 0, 0], scale: [1.15, 1, 0.13], color: '#9a6236' });
      const body = P.mesh(MAT.wood);
      body.userData.tap = 'box';
      body.userData.box = i;
      g.add(body);
      const soilMat = new THREE.MeshStandardMaterial({ map: soilTex, color: '#a87e5a', roughness: 0.95 });
      const soil = new THREE.Mesh(new THREE.BoxGeometry(w - 0.05, SOIL - legs - 0.02, d - 0.05), soilMat);
      soil.position.set(0, (SOIL + legs + 0.02) / 2, 0);
      soil.receiveShadow = true;
      soil.userData.tap = 'box';
      soil.userData.box = i;
      g.add(soil);
      group.add(g);
      this.taps.push(body, soil);
      g.visible = false;
      return { i, group: g, soilMat, crop: null, cropId: null, stake: null, wet: 0, wetTo: 0, wilt: 0, open: false, hold: false, pop: 0, stage: 'empty', dry: false, plot: null };
    });
  }

  /** Where she stands (or kneels) to tend box `i`, and the middle of its soil. */
  tend(i) {
    return V(BOX_X[i], 0, TEND_Z);
  }

  soilAt(i) {
    return V(BOX_X[i], SOIL, BOX_Z);
  }

  // ---------------------------------------------------------------- the can and the basket, where they are kept

  putCan() {
    const o = this.can.object;
    this.can.tilt(0);
    o.position.copy(CAN_AT).add(V(0, this.can.foot * 1.3, 0));
    o.rotation.set(0, -0.5, 0);
    o.quaternion.setFromEuler(o.rotation);
    o.scale.setScalar(1.3);
    this.scene.add(o);
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.userData.tap = 'can';
        delete m.userData.person;
      }
    });
    this.canHome = true;
  }

  putBasket() {
    if (!this.basket) this.basket = makeBasket();
    const o = this.basket.object;
    o.position.copy(BASKET_AT).add(V(0, 0.085 * 1.3, 0));
    o.rotation.set(0, 0.4, 0);
    o.quaternion.setFromEuler(o.rotation);
    o.scale.setScalar(1.3);
    this.scene.add(o);
    o.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.userData.tap = 'basket';
        delete m.userData.person;
      }
    });
    this.basketHome = true;
  }

  // ---------------------------------------------------------------- shown, or not

  /** The veranda is shown (`me`: the girl, out of the glass door): the camera on it, as it swings in. */
  show(me) {
    this.me = me;
    me.world = this;
    me.dropAll();
    this.scene.add(me.rig.group);
    me.walkSpeed = 0.5;
    if (!this.basketHome) {
      this.basket = null;
      this.putBasket();
    }
    if (!this.canHome) this.putCan();
    const a = me.anim;
    a.pos.set(DOOR.walk, 0, -D / 2 - 0.4);
    a.yaw = 0;
    a.pitch = 0;
    a.air = 0;
    a.look = null;
    a.lookW = 0;
    a.still();
    a.setPose('stand', 30);
    a.snap();
    me.seat = me.abed = null;
    me.tasks = [{ do: 'veranda', step: 'door', open: true }, { do: 'walk', to: V(DOOR.walk, 0, -0.3), direct: true }, { do: 'veranda', step: 'door', open: false }, { do: 'say', line: this.outLine }, { do: 'veranda', step: 'free' }];
    me.task = null;
    this.busy = 'in';
    this.last = null;
    this.fitView();
    Object.assign(this.view, { yaw: this.yaw0(), pitch: this.pitch0(), zoom: 1 });
    this.view.target.copy(this.homeAt);
    Object.assign(this.cam, { yaw: this.view.yaw + 0.35, pitch: this.view.pitch - 0.1, zoom: 1.2 });
    this.cam.target.copy(this.view.target);
    this.atView = null;
    this.placeCamera(0, true);
  }

  /** …and no longer (she has gone in — or the house was closed): what was hers of it goes back where it is kept. */
  hide() {
    const me = this.me;
    if (me) {
      const can = me.props.R && me.props.R.object === this.can.object;
      if (can) {
        me.drop('R');
        this.putCan();
      }
      // (what else is in her hands — the seeds, what she was picking — goes; the basket she takes in with her)
      if (me.props.R) disposeTree(me.drop('R').object);
      me.anim.hands.L = me.anim.hands.R = null;
    }
    if (this.basketOnFloor) {
      // (she was picking: it was on the floor beside her)
      this.scene.remove(this.basket.object);
      disposeTree(this.basket.object);
      this.basket = null;
      this.basketOnFloor = false;
    }
    this.stream.visible = false;
    this.busy = null;
    this.me = null;
    this.atView = null;
    for (const b of this.boxes) b.hold = false;
    if (this.look) this.garden(this.look.veranda);
  }

  // ---------------------------------------------------------------- what the app asks of her out here (js/veranda.js)

  /** Back in through the glass door (→ false if she is in the middle of something). */
  goIn() {
    const me = this.me;
    if (!me || this.busy) return false;
    this.busy = 'in';
    this.send(me, [{ do: 'say', line: 'veranda_in' }, { do: 'walk', to: V(DOOR.walk, 0, -0.32) }, { do: 'face', at: V(DOOR.walk, 1, -D) }, { do: 'veranda', step: 'door', open: true }, { do: 'walk', to: V(DOOR.walk, 0, -D / 2 - 0.42), direct: true }, { do: 'veranda', step: 'in' }]);
    return true;
  }

  /** She waters the boxes `ids`: the can from under the tap, filled; to each box in turn; the can back. */
  water(ids) {
    const me = this.me;
    if (!me || this.busy || !ids.length) return false;
    this.busy = 'water';
    for (const i of ids) this.boxes[i].hold = true; // (dry to look at until she has watered it)
    this.send(me, [...this.wateringTasks(ids), { do: 'veranda', step: 'event', what: 'watered', o: { ids } }, { do: 'veranda', step: 'free' }]);
    return true;
  }

  wateringTasks(ids) {
    const T = [{ do: 'walk', to: V(CAN_AT.x - 0.05, 0, CAN_AT.z + 0.3) }, { do: 'face', at: TAP.clone() }, { do: 'veranda', step: 'grab', what: 'can' }, { do: 'veranda', step: 'fill' }];
    ids.forEach((i, n) => T.push({ do: 'walk', to: this.tend(i) }, { do: 'face', at: this.soilAt(i).setY(0.3).add(V(0, 0, 0.6)) }, { do: 'veranda', step: 'water', box: i, line: n === 0 ? 'water' : n === ids.length - 1 && ids.length > 2 ? 'water_last' : null }));
    T.push({ do: 'walk', to: V(CAN_AT.x - 0.05, 0, CAN_AT.z + 0.3) }, { do: 'face', at: CAN_AT.clone() }, { do: 'veranda', step: 'putdown' }, { do: 'say', line: 'water_done' });
    return T;
  }

  /** She sows `crop` (its id, and what is on the packet) in box `i` — and waters it in. */
  sow(i, crop) {
    const me = this.me;
    if (!me || this.busy) return false;
    this.busy = 'sow';
    const b = this.boxes[i];
    b.hold = true; // (empty to look at until she has sown it)
    this.send(me, [
      { do: 'walk', to: this.tend(i) },
      { do: 'face', at: this.soilAt(i).setY(0).add(V(0, 0, 0.6)) },
      { do: 'veranda', step: 'kneel', box: i },
      { do: 'veranda', step: 'sow', box: i, crop },
      { do: 'veranda', step: 'rise', box: i },
      ...this.wateringTasks([i]),
      { do: 'veranda', step: 'event', what: 'watered', o: { ids: [i], sown: true } },
      { do: 'veranda', step: 'free' },
    ]);
    return true;
  }

  /** She picks what is ripe: `list` [{ i, id, n }] — the basket first, then kneeling at each box, a piece at a time. */
  harvest(list) {
    const me = this.me;
    if (!me || this.busy || !list.length) return false;
    this.busy = 'pick';
    for (const p of list) this.boxes[p.i].hold = true; // (ripe to look at until she has picked it)
    const T = [];
    const holding = me.props.L && me.props.L.object === (this.basket && this.basket.object);
    if (!holding) T.push({ do: 'walk', to: V(BASKET_AT.x, 0, BASKET_AT.z + 0.32) }, { do: 'face', at: BASKET_AT.clone() }, { do: 'veranda', step: 'grab', what: 'basket' });
    let tasted = false;
    for (const p of list) {
      T.push({ do: 'walk', to: this.tend(p.i) }, { do: 'face', at: this.soilAt(p.i).setY(0).add(V(0, 0, 0.6)) }, { do: 'veranda', step: 'kneel', box: p.i, basket: true }, { do: 'say', line: `pick_${p.id}` });
      for (let k = 0; k < p.n; k++) T.push({ do: 'veranda', step: 'pick', box: p.i, id: p.id });
      // (a strawberry, a cherry tomato: the first she tries straight off the plant)
      if (!tasted && (p.id === 'strawberry' || p.id === 'tomato')) {
        tasted = true;
        T.push({ do: 'veranda', step: 'taste', id: p.id });
      }
      T.push({ do: 'veranda', step: 'rise', box: p.i, basket: true }, { do: 'veranda', step: 'event', what: 'picked', o: { i: p.i } });
    }
    T.push({ do: 'face' }, { do: 'say', line: 'pick_done' }, { do: 'veranda', step: 'event', what: 'pickedAll', o: { list } }, { do: 'veranda', step: 'free' });
    this.send(me, T);
    return true;
  }

  /** A walk to a point on the floor (a tap there), if she is free. */
  stroll(p) {
    const me = this.me;
    if (!me || this.busy) return false;
    this.send(me, [{ do: 'walk', to: this.keepIn(p.clone()) }, { do: 'wait', t: 1.5 }]);
    return true;
  }

  /** Down onto the little stool (a tap on it). */
  sitDown() {
    const me = this.me;
    if (!me || this.busy || me.seat) return false;
    this.last = 'stool';
    this.send(me, [{ do: 'sit', seat: this.seat, t: 10 + Math.random() * 6, line: 'veranda_sit' }]);
    return true;
  }

  /* Off she goes to do `tasks`: whatever she was doing she leaves — up from the stool first. */
  send(me, tasks) {
    me.tasks = tasks;
    const t = me.task;
    if (me.seat && t && t.do === 'sit') {
      t.t = 0; // (up, then the rest)
      return;
    }
    me.task = null;
    const a = me.anim;
    a.look = null;
    a.lookW = 0;
    a.hands.R = null;
    a.still();
    a.setPose('stand', 6);
  }

  // ---------------------------------------------------------------- what she does on her own, out here

  /** The line she says as she comes out: the weather, the hour. */
  get outLine() {
    const w = this.look && this.look.weather;
    const kind = w ? w.kind : 'clear';
    if (kind === 'rain') return 'veranda_out_rain';
    if (kind === 'snow') return 'veranda_out_snow';
    return this.lit.dark > 0.5 ? 'veranda_out_night' : 'veranda_out';
  }

  /** Something to do next, when she has done what she was doing (resident.js plan()). */
  planFor(me) {
    const r = Math.random();
    const planted = this.boxes.filter((b) => b.open && b.cropId);
    if (planted.length && r < 0.42 && this.last !== 'box') {
      const b = pickOne(planted);
      this.last = 'box';
      return void me.tasks.push({ do: 'walk', to: this.tend(b.i) }, { do: 'look', at: this.soilAt(b.i).add(V(0, 0.12, 0)), t: 3 + Math.random() * 2.5, line: lookLine(b), pose: 'bend' });
    }
    if (r < 0.6 && this.last !== 'stool') {
      this.last = 'stool';
      return void me.tasks.push({ do: 'sit', seat: this.seat, t: 8 + Math.random() * 8, line: 'veranda_sit' });
    }
    if (r < 0.78 && this.last !== 'view') {
      // over the railing at the end, the city beyond
      this.last = 'view';
      const s = Math.random() < 0.5 ? -1 : 1;
      const at = V(s * (W / 2 - 0.42), 0, s > 0 ? -0.05 : 0.05);
      const dark = this.lit.dark > 0.5;
      const rain = this.look && this.look.weather && this.look.weather.kind === 'rain';
      return void me.tasks.push({ do: 'walk', to: this.keepIn(at) }, { do: 'look', at: V(s * (W / 2 + 2), 1.6, 1.2), t: 4 + Math.random() * 3, line: rain ? 'veranda_view_rain' : dark ? 'veranda_view_night' : 'veranda_view', pose: 'stand' });
    }
    if (this.musicOn() && r < 0.86) {
      this.last = 'dance';
      return void me.tasks.push({ do: 'face' }, { do: 'say', line: 'music' }, { do: 'dance', t: 8 + Math.random() * 8 });
    }
    if (r < 0.9) {
      this.last = 'stretch';
      return void me.tasks.push({ do: 'pose', pose: 'stretch', t: 2, line: 'stretch' });
    }
    const p = this.randomFree();
    this.last = 'wander';
    me.tasks.push({ do: 'walk', to: p }, { do: 'wait', t: 1.5 + Math.random() * 2 });
  }

  /** The things done only out here, a step at a time (→ true when it is done; null: she has gone in; undefined: not ours). */
  ownTask(p, t, dt) {
    if (t.do !== 'veranda') return undefined;
    const a = p.anim;
    switch (t.step) {
      case 'door':
        if (!t.slid) {
          t.slid = true;
          this.doorWant = t.open ? 1 : 0;
          this.world.sound('slide');
        }
        return t.age > 0.5;
      case 'in':
        // she is in: the house again
        this.busy = null;
        this.world.leaveVeranda();
        return null;
      case 'free':
        this.busy = null;
        this.frameAt(null);
        return true;
      case 'event':
        this.host.onVeranda(t.what, t.o);
        return true;
      case 'grab':
        return this.grab(p, t);
      case 'putdown':
        return this.putDown(p, t);
      case 'fill':
        return this.fill(p, t, dt);
      case 'water':
        return this.waterBox(p, t, dt);
      case 'kneel':
        return this.kneel(p, t);
      case 'rise':
        return this.rise(p, t);
      case 'sow':
        return this.sowBox(p, t, dt);
      case 'pick':
        return this.pickOne(p, t);
      case 'taste':
        return this.taste(p, t);
      default:
        a.setPose('stand', 5);
        return true;
    }
  }

  /* Down to the can (or the basket) where it is kept, and up with it in her hand. */
  grab(p, t) {
    const a = p.anim;
    if (!t.bent) {
      t.bent = true;
      a.setPose('bend', 7);
    }
    if (t.age > 0.45 && !t.got) {
      t.got = true;
      if (t.what === 'can') {
        this.canHome = false;
        this.can.object.scale.setScalar(1);
        p.hold('R', this.can.object);
      } else {
        this.basketHome = false;
        this.basket.object.scale.setScalar(1);
        p.hold('L', this.basket.object);
      }
      a.setPose('stand', 6);
    }
    return t.age > 0.8;
  }

  /* …and the can back under the tap. */
  putDown(p, t) {
    const a = p.anim;
    if (!t.bent) {
      t.bent = true;
      a.setPose('bend', 7);
    }
    if (t.age > 0.45 && !t.put) {
      t.put = true;
      const held = p.props.R && p.props.R.object === this.can.object;
      if (held) {
        p.drop('R');
        this.putCan();
      }
      a.setPose('stand', 6);
    }
    return t.age > 0.8;
  }

  /* The can held up under the tap: the water runs into it. */
  fill(p, t, dt) {
    const a = p.anim;
    p.frame();
    a.hands.R = p.reachR.copy(this.spoutAt).add(V(0, -0.04, 0.02));
    a.look = this.spoutAt;
    a.lookW = 1;
    if (!t.began) {
      t.began = true;
      a.setPose('pour', 5);
      this.world.sound('pour');
      p.say('fill');
    }
    const on = t.age > 0.35 && t.age < 1.7;
    this.stream.visible = on;
    if (on) {
      const top = this.spoutAt.y - 0.01;
      const bottom = this.can.object.getWorldPosition(_w).y - 0.05;
      const h = Math.max(0.05, top - bottom);
      this.stream.scale.set(1, h, 1);
      this.stream.position.set(this.spoutAt.x, top - h / 2, this.spoutAt.z);
      if (Math.random() < dt * 8) this.fx.puff(V(this.spoutAt.x, bottom + 0.03, this.spoutAt.z), { color: '#e8f6ff', size: 0.025, rise: 0.08, life: 0.5, opacity: 0.6 });
    }
    if (t.age > 1.9) {
      this.stream.visible = false;
      a.hands.R = null;
      a.look = null;
      a.lookW = 0;
      a.setPose('stand', 5);
      return true;
    }
    return false;
  }

  /* Over a box with the can, tipped: the water comes out of the rose in drops, and the soil goes dark as it takes it. */
  waterBox(p, t, dt) {
    const a = p.anim;
    const b = this.boxes[t.box];
    p.frame();
    if (!t.began) {
      t.began = true;
      a.setPose('pour', 5);
      if (t.line) p.say(t.line);
      this.frameAt(this.soilAt(t.box), 0.62);
    }
    const sweep = Math.sin(t.age * 2.2) * 0.13;
    const over = this.soilAt(t.box).add(V(sweep, 0.26, -0.1));
    a.hands.R = p.reachR.copy(over);
    a.look = this.soilAt(t.box);
    a.lookW = 1;
    const tip = Math.min(1, t.age / 0.4) * (t.age > 2.0 ? Math.max(0, 1 - (t.age - 2.0) / 0.3) : 1);
    this.can.tilt(tip);
    if (tip > 0.6) {
      if (!t.sounded) {
        t.sounded = true;
        this.world.sound('sprinkle');
      }
      const rose = this.can.rose.getWorldPosition(_w);
      for (let i = 0; i < 2; i++) if (Math.random() < dt * 18) this.drop(rose, this.soilAt(t.box).y);
      // the soil takes the water; the leaves lift
      b.wet = Math.min(1, b.wet + dt * 0.7);
      this.soilColor(b);
      if (b.crop && b.wilt > 0 && t.age > 1.2 && !t.revived) {
        t.revived = true;
        b.wilt = 0;
        b.crop.set({ ...(b.shown || {}), wilt: 0 });
      }
    }
    if (t.age > 2.35) {
      this.can.tilt(0);
      a.hands.R = null;
      a.look = null;
      a.lookW = 0;
      a.setPose('stand', 5);
      b.hold = false;
      this.applyBox(b);
      return true;
    }
    return false;
  }

  /* A drop of water, out of the rose and down onto the soil. */
  drop(from, floor) {
    const s = new THREE.Sprite(this.dropMat || (this.dropMat = new THREE.SpriteMaterial({ map: softDotTexture(), color: '#9fd8ff', transparent: true, depthWrite: false })));
    s.position.copy(from).add(V((Math.random() - 0.5) * 0.05, -0.01, (Math.random() - 0.5) * 0.05));
    s.scale.setScalar(0.022);
    this.scene.add(s);
    (this.drops || (this.drops = [])).push({ s, vy: -0.4 - Math.random() * 0.3, vx: (Math.random() - 0.5) * 0.15, vz: 0.1 + Math.random() * 0.15, floor });
  }

  updateDrops(dt) {
    if (!this.drops) return;
    this.drops = this.drops.filter((d) => {
      d.vy -= 4.5 * dt;
      d.s.position.x += d.vx * dt;
      d.s.position.y += d.vy * dt;
      d.s.position.z += d.vz * dt;
      if (d.s.position.y > d.floor) return true;
      this.scene.remove(d.s);
      return false;
    });
  }

  /* Down on her knees at a box (the basket set down beside her, if she is picking). */
  kneel(p, t) {
    const a = p.anim;
    if (!t.began) {
      t.began = true;
      a.setPose('pet', 6);
      a.add.lean = 0.28;
      this.frameAt(this.soilAt(t.box), 0.55);
      if (t.basket && p.props.L && p.props.L.object === this.basket.object) {
        // (the basket on the floor at her left knee)
        p.drop('L');
        const o = this.basket.object;
        p.frame();
        const left = V(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
        const fwd = V(Math.sin(a.yaw), 0, Math.cos(a.yaw));
        o.position.copy(a.pos).addScaledVector(left, 0.26).addScaledVector(fwd, 0.12).add(V(0, 0.085 * 1.3, 0));
        o.rotation.set(0, a.yaw, 0);
        o.quaternion.setFromEuler(o.rotation);
        o.scale.setScalar(1.3);
        this.scene.add(o);
        this.basketOnFloor = true;
      }
    }
    return t.age > 0.6;
  }

  /* …and up again (the basket back in her hand). */
  rise(p, t) {
    const a = p.anim;
    if (!t.began) {
      t.began = true;
      a.add.lean = 0;
      a.hands.R = null;
      a.look = null;
      a.lookW = 0;
      a.setPose('stand', 5);
      if (this.basketOnFloor) {
        this.basketOnFloor = false;
        this.basket.object.scale.setScalar(1);
        p.hold('L', this.basket.object);
      }
      const b = this.boxes[t.box];
      if (b && b.hold && this.busy !== 'sow') {
        b.hold = false;
        this.applyBox(b);
      }
    }
    return t.age > 0.55;
  }

  /* The packet out; a pinch of seeds at three places along the box — and the stake in, that says what is there. */
  sowBox(p, t, dt) {
    const a = p.anim;
    const b = this.boxes[t.box];
    if (!t.packet) {
      t.packet = makeSeeds(t.crop.emoji, t.crop.packet).object;
      p.hold('R', t.packet);
      p.say(`sow_${t.crop.id}`);
    }
    const spots = [-0.16, 0, 0.16];
    const k = Math.min(spots.length - 1, Math.floor(t.age / 0.6));
    const soil = this.soilAt(t.box).add(V(spots[k], 0.06 - Math.abs(Math.sin(t.age * Math.PI / 0.6)) * 0.04, -0.06));
    a.hands.R = p.reachR.copy(soil);
    a.look = this.soilAt(t.box);
    a.lookW = 1;
    if (Math.floor((t.age - dt) / 0.6) !== Math.floor(t.age / 0.6) && t.age < 1.8) {
      this.world.sound('sow');
      for (let i = 0; i < 3; i++) this.fx.puff(soil.clone().add(V((Math.random() - 0.5) * 0.04, -0.03, 0)), { color: '#8a6446', size: 0.02, rise: 0.05, life: 0.6, opacity: 0.7 });
    }
    if (t.age > 1.9) {
      const held = p.drop('R');
      if (held) disposeTree(held.object);
      a.hands.R = null;
      // in it goes: the seeds, and the stake — the soil dry to look at until she has watered them in
      b.hold = false;
      this.applyBox(b);
      b.hold = true;
      b.wet = 0.15;
      this.soilColor(b);
      b.pop = 1;
      this.fx.emit('🌱', this.soilAt(t.box).add(V(0, 0.15, 0)), { size: 0.12, rise: 0.25, life: 1.4 });
      this.host.onVeranda('sown', { i: t.box });
      return true;
    }
    return false;
  }

  /* One piece picked: her hand to it, it comes off (into her hand), over to the basket, and in. */
  pickOne(p, t) {
    const a = p.anim;
    const b = this.boxes[t.box];
    if (!b.crop) return true;
    p.frame();
    if (!t.target) {
      const list = b.crop.picks();
      if (!list.length) return true;
      t.target = b.crop.object.localToWorld(list[0].clone());
    }
    if (!t.got) {
      a.hands.R = p.reachR.copy(t.target);
      a.look = t.target;
      a.lookW = 1;
      if (t.age > 0.45) {
        t.got = true;
        t.age = 0;
        b.crop.take();
        t.piece = makeProduce(t.id).object;
        p.hold('R', t.piece);
        this.world.sound(t.id === 'leek' ? 'snip' : 'pluck');
        this.fx.emit('✨', t.target.clone(), { size: 0.07, rise: 0.15, life: 0.8 });
      }
      return false;
    }
    // over the basket on the floor, and in
    const mouth = this.basket.mouth.getWorldPosition(_w).add(V(0, 0.1, 0));
    a.hands.R = p.reachR.copy(mouth);
    a.look = mouth;
    if (t.age > 0.42) {
      const held = p.drop('R');
      if (held) disposeTree(held.object);
      this.basket.put(t.id);
      a.hands.R = null;
      return true;
    }
    return false;
  }

  /* The first strawberry (or tomato): straight into her mouth — and what she thinks of it. */
  taste(p, t) {
    const a = p.anim;
    p.frame();
    if (!t.piece) {
      t.piece = makeProduce(t.id).object;
      p.hold('R', t.piece);
    }
    const mouth = p.mouth(V());
    if (t.age < 0.9) {
      a.hands.R = p.reachR.copy(mouth).add(V(Math.sin(a.yaw) * 0.05, -0.02, Math.cos(a.yaw) * 0.05));
      a.mood.mouth = t.age > 0.5 ? 0.6 : 0.2;
      return false;
    }
    if (!t.ate) {
      t.ate = true;
      const held = p.drop('R');
      if (held) disposeTree(held.object);
      a.hands.R = null;
      a.mood.smile = 1;
      p.say(`taste_${t.id}`);
      this.fx.emit('💗', p.headPoint(V()).add(V(0, 0.08, 0)), { size: 0.1, rise: 0.3, life: 1.4 });
    }
    a.mood.mouth = 0.2 + 0.25 * Math.max(0, Math.sin(t.age * 15)) * (t.age < 2 ? 1 : 0);
    if (t.age > 2.4) {
      a.mood.mouth = 0;
      a.mood.smile = 0;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- what is out here: the app's (look.veranda)

  /** As the house's apply(): the sky, the city's weather, the year — and the boxes, as the app has them. */
  setLook(look) {
    this.look = look;
    const s = look.sky || {};
    const night = s.dark ? 1 : clamp(s.blue || 0, 0, 1);
    const gold = (s.gold || 0) * (1 - night);
    const kind = look.weather ? look.weather.kind : 'clear';
    const grey = kind === 'rain' ? 0.4 : kind === 'cloudy' || kind === 'snow' ? 0.22 : 0;
    this.lit.dark = night;
    this.falling.set(kind, look.weather && look.weather.level);
    this.kind = kind;
    const day = (1 - night) * (1 - grey);
    _c.set('#fff7ee').lerp(_c2.set('#ffd8b0'), gold).lerp(_c2.set('#4a5898'), night);
    this.hemi.color.copy(_c);
    this.hemi.groundColor.set('#e2cdb8').lerp(_c2.set('#1c2040'), night);
    this.hemi.intensity = 0.6 + 0.75 * day + 0.12 * night;
    // the sun where the real one is (south is out over the railing, towards the camera), or the moon
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
    this.sun.intensity = (0.25 + 1.55 * day) * (1 - night) + 0.35 * night * (s.moon && s.moon.up ? 0.4 + 0.6 * s.moon.fraction : 0.3);
    this.scene.background.set('#ffe6f0').lerp(_c2.set('#ffd2c4'), gold).lerp(_c2.set('#1c2147'), night * 0.92);
    if (kind === 'rain') this.scene.background.lerp(_c2.set('#9aa3b8'), 0.35 * (1 - night));
    this.scene.environmentIntensity = 0.5 - 0.25 * night;
    // the night: the lamp by the door, the fairy lights, the room through the glass (if its light is on)
    const on = night > 0.45 ? 1 : 0;
    const room = look.light ? 1 : 0.15;
    this.bulbMat.emissiveIntensity = 1.4 * on;
    this.bulbsMat.emissiveIntensity = 1.6 * on;
    this.lamp.intensity = 1.6 * on;
    this.roomMat.emissiveIntensity = (0.12 + 0.55 * on) * room;
    this.glow.intensity = 1.2 * on * room;
    this.season = look.season || 'autumn';
    this.garden(look.veranda);
  }

  /** The boxes as the app has them: { open: how many, plots: [{ crop: { id, emoji, short }, k, ripe, wet, wilt, stage, dry } | null] }. */
  garden(v) {
    if (!v) return;
    this.boxes.forEach((b, i) => {
      const open = i < (v.open || 0);
      if (open && !b.open) b.pop = this.me ? 1 : 0; // (a box just bought: in it comes)
      b.open = open;
      b.group.visible = open;
      b.plot = (open && v.plots[i]) || null;
      if (!b.hold) this.applyBox(b);
    });
  }

  /* A box as its plot is now: what grows in it (and its stake), how wet its soil is. */
  applyBox(b) {
    const plot = b.plot;
    const id = plot && plot.crop ? plot.crop.id : null;
    if (id !== b.cropId) {
      if (b.crop) {
        b.group.remove(b.crop.object);
        b.crop.dispose();
        b.crop = null;
      }
      if (b.stake) {
        b.group.remove(b.stake.object);
        disposeTree(b.stake.object);
        b.stake = null;
      }
      b.cropId = id;
      if (id) {
        b.crop = makeCrop(id, 5 + b.i * 31);
        b.crop.object.position.set(0, SOIL, 0);
        Object.assign(b.crop.object.userData, { tap: 'box', box: b.i }); // (what grows in it is the box, to a tap)
        b.group.add(b.crop.object);
        b.stake = makeStake(plot.crop.emoji, plot.crop.short);
        b.stake.object.position.set(-BOX.w / 2 + 0.07, SOIL, -BOX.d / 2 + 0.06);
        b.group.add(b.stake.object);
      }
    }
    b.stage = plot ? plot.stage : 'empty';
    b.dry = !!(plot && plot.dry);
    b.wetTo = plot && plot.wet ? 1 : 0;
    b.wet = b.wetTo; // (as it is now: it is her watering that is seen to darken it)
    b.wilt = plot ? plot.wilt || 0 : 0;
    this.soilColor(b);
    if (b.crop) {
      b.shown = { k: plot.k, ripe: plot.ripe, wilt: b.wilt };
      b.crop.set(b.shown);
    }
  }

  soilColor(b) {
    b.soilMat.color.set('#b08560').lerp(_c.set('#5f4029'), b.wet);
  }

  /** Where there is something to settle on (a leaf, a flower), for the butterfly. */
  perches() {
    return this.boxes.filter((b) => b.open && b.crop && b.shown && b.shown.k > 0.3).map((b) => this.soilAt(b.i).add(V((Math.random() - 0.5) * 0.3, 0.12 + 0.1 * b.shown.k, 0)));
  }

  // ---------------------------------------------------------------- every frame

  update(dt) {
    const t = this.time;
    // (the buttons over the view have changed what of it shows: the camera stands where all of it fits again)
    if (this.world.band !== this.bandWas) {
      this.bandWas = this.world.band;
      this.refit();
    }
    this.placeCamera(dt);
    this.fold(dt);
    // the door slides; the fan turns in the summer
    this.doorOpen = damp(this.doorOpen, this.doorWant, 4, dt);
    this.slidePane.position.x = this.slideX - this.doorOpen * (DOOR.w / 2 - 0.04);
    if (this.season === 'summer') this.fan.rotation.z -= dt * 7;
    // the boxes: what grows sways in the wind; a box just out pops up
    const wind = this.kind === 'rain' ? 1.8 : 1;
    for (const b of this.boxes) {
      if (!b.open) continue;
      if (b.crop) b.crop.update(dt, t, wind);
      if (b.pop > 0) {
        b.pop = Math.max(0, b.pop - dt * 1.6);
        const k = Math.sin(b.pop * Math.PI * 2.5) * b.pop * 0.12;
        b.group.scale.set(1 + k, 1 - k, 1 + k);
      }
    }
    // the sun's shadows over the veranda
    this.sun.target.position.set(0, 0, 0);
    this.sun.position.copy(this.sunDir || V(0.3, 0.8, 0.5)).multiplyScalar(9);
    // the girl: lit as it is out here
    const me = this.me;
    if (me && me.on) {
      _c.copy(this.hemi.color).multiplyScalar(this.hemi.intensity * 0.32).add(_c2.copy(this.sun.color).multiplyScalar(this.sun.intensity * 0.2));
      const grey = (_c.r + _c.g + _c.b) / 3;
      _c.lerp(_c2.setScalar(Math.max(grey, 0.6)), 0.45);
      FUR_SUN.value.copy(this.sunDir || V(0.3, 0.8, 0.5));
      me.light(_c, clamp(this.sun.intensity / 1.8, 0.25, 1));
      me.update(dt);
    }
    const fine = this.lit.dark < 0.4 && (this.kind === 'clear' || this.kind === 'cloudy') && this.season !== 'winter';
    this.butterfly.update(dt, fine, fine ? (this.perchList && t - this.perchAt < 20 ? this.perchList : ((this.perchAt = t), (this.perchList = this.perches()))) : []);
    this.falling.update(dt);
    this.updateDrops(dt);
    this.fx.update(dt);
  }

  /* The railing on her side folds down out of the way (as the house's walls do). */
  fold(dt) {
    const c = this.camera.position;
    _v.set(c.x, 0, c.z).normalize();
    for (const s of this.sides) {
      const facing = _v.dot(s.out);
      if (facing > 0.42) s.want = 0;
      else if (facing < 0.26) s.want = 1;
      s.shown = damp(s.shown, s.want, 7, dt);
      s.pivot.scale.y = Math.max(0.1, s.shown);
    }
  }

  // ---------------------------------------------------------------- the camera

  resize(w, h) {
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.refit();
  }

  /* (…and if it was looking from where it looks at first, it looks from where that is now — the screen held the other
     way, it may be from further round) */
  refit() {
    const v = this.view;
    const was = this.homeView;
    const home = !was || (Math.abs(angle(v.yaw - was.yaw)) < 0.01 && Math.abs(v.pitch - was.pitch) < 0.01 && Math.abs(v.zoom - 1) < 0.01 && v.target.distanceTo(this.homeAt) < 0.01);
    this.fitView();
    if (home) this.home();
  }

  aim(cam, yaw, pitch, dist, target) {
    cam.position.set(target.x + Math.sin(yaw) * Math.cos(pitch) * dist, target.y + Math.sin(pitch) * dist, target.z + Math.cos(yaw) * Math.cos(pitch) * dist);
    cam.lookAt(target);
  }

  /** Where the camera looks from at first, for this screen. */
  yaw0() {
    return this.camera.aspect < 0.78 ? YAW_TALL : YAW;
  }

  pitch0() {
    return this.camera.aspect < 0.78 ? PITCH_TALL : PITCH;
  }

  /** How far away the camera has to be for all of the veranda to show between the buttons (as the house's fitRoom) — and
   *  where it looks, for the veranda to sit in the middle of them (homeAt). */
  fitView() {
    const cam = this.camera;
    const b = this.world.band || { top: 1, low: -1, right: 1 };
    const yaw = this.yaw0();
    const pitch = this.pitch0();
    this.homeView = { yaw, pitch };
    // (the corners of the floor, the top of the door, the wall a little way over it — the top of it may go off the screen,
    // though it is in the middle with the rest if there is room)
    const pts = [];
    const tops = [];
    for (const s of [-1, 1]) {
      pts.push(V((s * W) / 2, 0, D / 2 + 0.05), V((s * W) / 2, 0, -D / 2), V((s * W) / 2, WALL_H * 0.62, -D / 2), V(DOOR.x + (s * DOOR.w) / 2, DOOR.h + 0.1, -D / 2));
      tops.push(V((s * W) / 2, WALL_H, -D / 2));
    }
    const room = { x0: -0.95, x1: b.right - 0.05, y0: b.low + 0.04, y1: b.top - 0.04 };
    const at = this.homeAt.set(0, 0.55, 0);
    const span = (dist, target, all = false) => {
      this.aim(cam, yaw, pitch, dist, target);
      cam.updateMatrixWorld(true);
      const r = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity, z: -Infinity };
      for (const p of all ? [...pts, ...tops] : pts) {
        _v.copy(p).project(cam);
        r.x0 = Math.min(r.x0, _v.x);
        r.x1 = Math.max(r.x1, _v.x);
        r.y0 = Math.min(r.y0, _v.y);
        r.y1 = Math.max(r.y1, _v.y);
        r.z = Math.max(r.z, _v.z);
      }
      r.cx = (r.x0 + r.x1) / 2;
      r.cy = (r.y0 + r.y1) / 2;
      return r;
    };
    const right = V(Math.cos(yaw), 0, -Math.sin(yaw));
    const ahead = V(-Math.sin(yaw), 0, -Math.cos(yaw));
    for (let round = 0; ; round++) {
      let lo = 2;
      let hi = 40;
      for (let i = 0; i < 22; i++) {
        const dist = (lo + hi) / 2;
        const r = span(dist, at);
        if (r.z < 1 && r.x1 - r.x0 < room.x1 - room.x0 && r.y1 - r.y0 < room.y1 - room.y0) hi = dist;
        else lo = dist;
      }
      this.fit = hi;
      if (round === 2) break;
      // (…in the middle of the room for it: how far the view moves for a step to the right, and for one ahead — and the
      // steps that take it there)
      const all = span(hi, at, true);
      const r = span(hi, at);
      const sr = span(hi, _w.copy(at).addScaledVector(right, 0.1));
      const sa = span(hi, _w.copy(at).addScaledVector(ahead, 0.1));
      const xr = (sr.cx - r.cx) / 0.1;
      const xa = (sa.cx - r.cx) / 0.1;
      const yr = (sr.cy - r.cy) / 0.1;
      const ya = (sa.cy - r.cy) / 0.1;
      const ex = clamp((room.x0 + room.x1) / 2 - all.cx, room.x0 - r.x0, room.x1 - r.x1);
      const ey = clamp((room.y0 + room.y1) / 2 - all.cy, room.y0 - r.y0, room.y1 - r.y1);
      const det = xr * ya - xa * yr;
      if (Math.abs(det) < 1e-6) break;
      at.addScaledVector(right, (ex * ya - xa * ey) / det).addScaledVector(ahead, (xr * ey - yr * ex) / det);
      at.x = clamp(at.x, -W / 2, W / 2);
      at.z = clamp(at.z, -D / 2, D / 2);
    }
  }

  placeCamera(dt, now = false) {
    const v = this.view;
    const c = this.cam;
    const k = now ? 1 : 1 - Math.exp(-dt * 5);
    c.yaw += angle(v.yaw - c.yaw) * k;
    c.pitch += (v.pitch - c.pitch) * k;
    c.zoom += (v.zoom - c.zoom) * k;
    c.target.lerp(v.target, k);
    this.aim(this.camera, c.yaw, c.pitch, this.fit * c.zoom, c.target);
  }

  home() {
    Object.assign(this.view, { yaw: this.yaw0(), pitch: this.pitch0(), zoom: 1 });
    this.view.target.copy(this.homeAt);
    this.atView = null;
  }

  /** Closer to `at` (a box she is tending) — and back to how it was (null), unless she has moved the view meanwhile. */
  frameAt(at, zoom = 0.6) {
    const v = this.view;
    if (at) {
      if (!this.atView) this.atView = { was: { zoom: v.zoom, target: v.target.clone() } };
      const a = this.atView;
      a.zoom = Math.min(v.zoom, zoom);
      a.target = V(at.x * 0.8, 0.5, at.z * 0.6);
      v.zoom = a.zoom;
      v.target.copy(a.target);
      return;
    }
    const d = this.atView;
    this.atView = null;
    if (!d || Math.abs(v.zoom - d.zoom) > 0.01 || v.target.distanceTo(d.target) > 0.01) return;
    v.zoom = d.was.zoom;
    v.target.copy(d.was.target);
  }

  keepTarget() {
    const v = this.view;
    v.target.x = clamp(v.target.x, -W / 2, W / 2);
    v.target.z = clamp(v.target.z, -D / 2, D / 2);
    v.target.y = 0.55;
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

  floorAt(x, y) {
    return this.ray(x, y).ray.intersectPlane(_floor, V());
  }

  zoomAt(k, x, y) {
    const v = this.view;
    const before = v.zoom;
    v.zoom = clamp(v.zoom * k, ZOOM_MIN, ZOOM_MAX);
    const p = this.floorAt(x, y);
    if (p && v.zoom < before) {
      const f = 1 - v.zoom / before;
      v.target.x += (p.x - v.target.x) * f;
      v.target.z += (p.z - v.target.z) * f;
    }
    this.atView = null;
    this.keepTarget();
  }

  /** What is under (x, y): { kind, box?, point } — her, a box, the can, the basket, the stool, the door… or the floor. */
  pick(x, y) {
    const ray = this.ray(x, y);
    const targets = [...this.taps];
    if (this.canHome) targets.push(this.can.object);
    if (this.basketHome) targets.push(this.basket.object);
    for (const b of this.boxes) if (b.open && b.crop) targets.push(b.crop.object);
    if (this.me && this.me.on) targets.push(...this.me.meshes());
    const hits = ray.intersectObjects(targets, true).filter((h) => this.visibleUp(h.object) && h.object.type !== 'Sprite');
    const her = hits.find((h) => h.object.userData.person);
    if (her) return { kind: 'me' };
    if (this.me && this.nearHer(x, y)) return { kind: 'me' };
    // (what was hit, or what it is part of: a leaf is its box)
    const tapOf = (o) => {
      for (let q = o; q; q = q.parent) if (q.userData.tap) return q;
      return null;
    };
    for (const h of hits) {
      const o = tapOf(h.object);
      if (o) return { kind: o.userData.tap, box: o.userData.box, point: h.point };
    }
    const f = this.floorAt(x, y);
    return f && Math.abs(f.x) < W / 2 && Math.abs(f.z) < D / 2 ? { kind: 'floor', point: f } : null;
  }

  visibleUp(o) {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  }

  /* Is (x, y) within a fingertip of her, from her feet to the top of her head? (Seen from up here she is small.) */
  nearHer(x, y, reach = 22) {
    const me = this.me;
    const r = this.world.canvas.getBoundingClientRect();
    const onPage = (p) => {
      p.project(this.camera);
      return [r.left + ((p.x + 1) / 2) * r.width, r.top + ((1 - p.y) / 2) * r.height];
    };
    const [hx, hy] = onPage(me.headPoint(_w));
    const [fx, fy] = onPage(_v.copy(me.pos));
    const dx = hx - fx;
    const dy = hy - fy;
    const len = dx * dx + dy * dy;
    const k = len ? clamp(((x - fx) * dx + (y - fy) * dy) / len, 0, 1) : 0;
    return Math.hypot(x - (fx + dx * k), y - (fy + dy * k)) < reach;
  }

  onDown(e) {
    this.fingers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.fingers.size === 2) {
      const [a, b] = [...this.fingers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.view.zoom };
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
      this.view.zoom = clamp(this.pinch.zoom * (this.pinch.d / Math.max(10, Math.hypot(a.x - b.x, a.y - b.y))), ZOOM_MIN, ZOOM_MAX);
      this.atView = null;
      return;
    }
    const p = this.pointer;
    if (!p.down || e.pointerId !== p.id) return;
    const dx = e.clientX - p.x;
    const dy = e.clientY - p.y;
    if (!p.moved && Math.hypot(e.clientX - p.sx, e.clientY - p.sy) > TAP_PX) p.moved = true;
    p.x = e.clientX;
    p.y = e.clientY;
    if (!p.moved) return;
    // (round it a little — not round behind the house)
    this.view.yaw = clamp(this.view.yaw - dx * 0.0085, -1.25, 1.25);
    this.view.pitch = clamp(this.view.pitch + dy * 0.0052, 0.32, 1.3);
    this.atView = null;
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
    if (hit.kind === 'me') {
      if (this.me && !this.busy) this.me.tapped();
      return this.host.onTap('me');
    }
    if (hit.kind === 'floor') {
      if (this.stroll(hit.point)) this.fx.emit('📍', hit.point.clone().add(V(0, 0.12, 0)), { size: 0.12, rise: 0.12, life: 0.9 });
      return;
    }
    if (hit.kind === 'stool') {
      if (this.sitDown()) return;
    }
    this.host.onVeranda('tap', { kind: hit.kind, i: hit.box == null ? null : hit.box });
  }
}
