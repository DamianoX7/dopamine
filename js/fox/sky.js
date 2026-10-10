// The weather, drawn: rain coming down and the rings it makes where it lands, snow, sand on
// the wind; the grey light of an overcast sky and the shadows of its clouds; the wet ground,
// the puddles a rain leaves in the yard — and the rainbow that stands behind it afterwards.
// The app says what the weather is (js/weather.js keeps the clock) — this side shows it,
// easing from one sky to the next. What the foxes do about it is in weatherlife.js.
import * as THREE from '../vendor/three.module.min.js';
import { V, clamp, lerp, TAU, rng, paintTexture, blotches, softDotTexture } from './kit.js';
import { kindOf } from './species.js';

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const RAIN = 1400; //    drops in the air at most
const SNOW = 900; //     …flakes
const SAND = 520; //     …grains
const GUSTS = 300; //    …and streaks of sand on the wind
const RINGS = 64; //     rings on the ground and on the water at a time
const TOP = 6; //        how high the rain starts
const DENSE = 10; //     drops over one square unit of ground when it pours
const FALL = V(0.1, -1, 0.05).normalize(); // rain comes down at a slant
const WIND = V(1, 0, 0.12).normalize(); //    …and the sand blows across
// how overcast each sky is — at least, and more the harder it comes down — and the colour the light takes
const GLOOM = { clear: [0, 0], cloudy: [0.52, 0], rain: [0.5, 0.36], snow: [0.36, 0.26], wind: [0.25, 0.3] };
const SHADE = { clear: 0, cloudy: 0.2, rain: 0.15, snow: 0.1, wind: 0.07 }; // how dark the shadows of the clouds lie on the ground
const TINT = { clear: '#ffffff', cloudy: '#b4c0d2', rain: '#a9b8cf', snow: '#cbd8ea', wind: '#e8cb90' };
// where puddles form, across the yard and front to back (-1 … 1), and how large: the first that are free are the ones
const POOLS = [[-0.45, 0.56, 1], [0.58, -0.1, 0.86], [-0.08, -0.62, 0.92], [-0.75, -0.06, 0.74], [0.36, 0.3, 0.7], [0.4, -0.66, 0.68], [-0.38, -0.2, 0.62]];
const CORNERS = [[-1, -1], [1, -1], [-1, 1], [1, 1]];

const _ray = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const _ground = new THREE.Plane(V(0, 1, 0), 0);
const _p = V();
const _side = V();
const _look = V();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _s = V();
const _c = new THREE.Color();

let streak = null;
/** A drop of rain as it is seen: a streak, bright at its lower end. */
function streakTexture() {
  if (!streak) {
    streak = paintTexture(64, (g, s) => {
      const down = g.createLinearGradient(0, 0, 0, s);
      down.addColorStop(0, 'rgba(255,255,255,0)');
      down.addColorStop(0.75, 'rgba(255,255,255,0.75)');
      down.addColorStop(1, 'rgba(255,255,255,1)');
      g.fillStyle = down;
      g.fillRect(s * 0.3, 0, s * 0.4, s);
    });
    streak.userData.shared = true;
  }
  return streak;
}

/**
 * `count` streaks in one mesh, each a ribbon with a bright leading end. They are laid out
 * afresh every frame, edge on to the camera (layRibbon). Of each one the mesh keeps where its
 * head is, how fast it goes and how long it is (userData.d: x, y, z, speed, length).
 */
function makeRibbons(count, color, speed, length) {
  const uv = new Float32Array(count * 8);
  const index = new Uint16Array(count * 6);
  const d = new Float32Array(count * 5);
  for (let i = 0; i < count; i++) {
    uv.set([0, 1, 1, 1, 0, 0, 1, 0], i * 8); // (its tail, then its head: the bright end)
    index.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4 + 2, i * 4 + 1, i * 4 + 3], i * 6);
    d.set([0, -1, 0, lerp(speed[0], speed[1], Math.random()), lerp(length[0], length[1], Math.random())], i * 5);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 12), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(new THREE.BufferAttribute(index, 1));
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: streakTexture(), color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
  mesh.frustumCulled = false;
  mesh.renderOrder = 40;
  mesh.visible = false;
  mesh.userData = { d, sown: false };
  return mesh;
}

/** Ribbon `i`: its head at (x, y, z), its tail `len` back along `dir`, `wide` to either `side`. */
function layRibbon(pos, i, x, y, z, dir, len, side, wide) {
  const k = i * 12;
  const tx = x - dir.x * len;
  const ty = y - dir.y * len;
  const tz = z - dir.z * len;
  pos[k] = tx - side.x * wide;
  pos[k + 1] = ty - side.y * wide;
  pos[k + 2] = tz - side.z * wide;
  pos[k + 3] = tx + side.x * wide;
  pos[k + 4] = ty + side.y * wide;
  pos[k + 5] = tz + side.z * wide;
  pos[k + 6] = x - side.x * wide;
  pos[k + 7] = y - side.y * wide;
  pos[k + 8] = z - side.z * wide;
  pos[k + 9] = x + side.x * wide;
  pos[k + 10] = y + side.y * wide;
  pos[k + 11] = z + side.z * wide;
}

/** A puddle: water lying in a hollow, its edge wandering in and out (no two alike). */
function makePuddle(seed) {
  const r = rng(seed);
  const ph = [r() * TAU, r() * TAU, r() * TAU];
  const edge = (u) => 1 + 0.17 * Math.sin(2 * u + ph[0]) + 0.11 * Math.sin(3 * u + ph[1]) + 0.06 * Math.sin(5 * u + ph[2]);
  const shape = (grow) => {
    const g = new THREE.CircleGeometry(1, 40);
    const pos = g.attributes.position;
    for (let i = 1; i < pos.count; i++) {
      const u = Math.atan2(pos.getY(i), pos.getX(i));
      const k = edge(u) * grow;
      pos.setXY(i, Math.cos(u) * k, Math.sin(u) * k);
    }
    g.rotateX(-Math.PI / 2);
    return g;
  };
  const group = new THREE.Group();
  // the wet earth round it, then the water
  const rim = new THREE.Mesh(shape(1.16), new THREE.MeshBasicMaterial({ color: '#39414f', transparent: true, opacity: 0, depthWrite: false }));
  rim.position.y = 0.004;
  rim.renderOrder = 1;
  const water = new THREE.Mesh(shape(1), new THREE.MeshStandardMaterial({ color: '#a9c8e6', roughness: 0.05, metalness: 0.55, transparent: true, opacity: 0, depthWrite: false, envMapIntensity: 1.5 }));
  water.position.y = 0.0065;
  water.renderOrder = 1;
  water.receiveShadow = true;
  group.add(rim, water);
  group.visible = false;
  return { group, rim, water, edge, x: 0, z: 0, turn: 0, size: 1, r: 0, k: 0, free: false, on: false };
}

export class Sky {
  constructor(world) {
    this.w = world;
    this.kind = 'clear'; //  what the app says the weather is…
    this.hard = 0; //        …how hard it is coming down (0 … 1), and how wet the ground is
    this.soaked = 0;
    this.rain = 0; //        what is in the air, eased: rain, snow, sand (one fades as the next comes)
    this.snow = 0;
    this.sand = 0;
    this.wet = 0; //         the ground as it shows
    this.gloom = 0; //       how overcast
    this.shade = 0; //       how dark the cloud shadows are
    this.bow = 0; //         how bright the rainbow is
    this.tint = new THREE.Color('#ffffff');
    this.box = { x0: -5, x1: 5, z0: -6, z1: 5 }; // the ground in view (and a little more)
    this.stamp = -1;
    this.group = new THREE.Group();
    this.group.name = 'sky';
    world.scene.add(this.group);
    this.makeRain();
    this.makeSnow();
    this.makeSand();
    this.makeRings();
    this.makeClouds();
    this.makeRainbow();
    this.pools = POOLS.map((p, i) => makePuddle(977 + i * 131));
    this.pools.forEach((p) => this.group.add(p.group));
  }

  // ---------------------------------------------------------------- what the app says

  /** The weather now: { kind, level, wet }. `settle` = show it at once, as if it had long been so (she has only just come). */
  set(sky, settle = false) {
    if (!sky) return false;
    const turned = sky.kind !== this.kind;
    this.kind = sky.kind;
    this.hard = clamp(sky.level || 0, 0, 1);
    this.soaked = clamp(sky.wet || 0, 0, 1);
    if (settle) this.settle();
    return turned;
  }

  /** Everything as it is going to be, at once. */
  settle() {
    this.rain = this.kind === 'rain' ? this.hard : 0;
    this.snow = this.kind === 'snow' ? this.hard : 0;
    this.sand = this.kind === 'wind' ? this.hard : 0;
    this.wet = this.soaked;
    const [least, more] = GLOOM[this.kind] || GLOOM.clear;
    this.gloom = least + more * this.hard;
    this.shade = SHADE[this.kind] || 0;
    this.bow = this.rainbowDue();
    this.tint.set(TINT[this.kind] || TINT.clear);
    this.layout();
    this.pools.forEach((p) => (p.k = p.on ? this.wet : 0));
    this.showPools();
  }

  get raining() {
    return this.kind === 'rain';
  }
  get snowing() {
    return this.kind === 'snow';
  }

  /**
   * Does this fox want to be under cover in this weather? In blowing sand: every one. In the rain too — where
   * there is cover to be had (in the desert there is none, and rain is a feast there). In the snow: only the fox
   * from the desert.
   */
  shelterFrom(fox) {
    if (this.kind === 'wind') return true;
    if (this.kind === 'rain') {
      if (this.w.env.shelters.length) return true;
      // (…but for the house, if she has given them one: for the fox that has it, or gets there first)
      const house = this.w.house();
      return !!house && (house.users.includes(fox) || house.users.length < (house.def.share || 1));
    }
    return this.kind === 'snow' && kindOf(fox.id).startsWith('fennec');
  }

  /** The puddles there are to play in: [{ x, z, r }] — the ones with water enough in them. */
  get puddles() {
    return this.pools.filter((p) => p.on && p.k > 0.45);
  }

  /** The puddle a point of the ground lies in, if any. */
  puddleAt(x, z) {
    for (const p of this.pools) {
      if (!p.on || p.k < 0.2) continue;
      const dx = x - p.x;
      const dz = z - p.z;
      const d = Math.hypot(dx, dz);
      if (d > p.r * 1.35) continue;
      // (in the puddle's own space: it lies turned, and its edge wanders)
      const c = Math.cos(p.turn);
      const s = Math.sin(p.turn);
      if (d < p.r * p.edge(Math.atan2(-(dx * s + dz * c), dx * c - dz * s))) return p;
    }
    return null;
  }

  // ---------------------------------------------------------------- what falls

  makeRain() {
    this.rainMesh = makeRibbons(RAIN, '#e6f0ff', [7, 10], [0.2, 0.4]);
    this.group.add(this.rainMesh);
  }

  /** `count` points adrift in the air, in the patch of ground that is in view — each in one of the `colors`. */
  makePoints(count, size, colors, opacity) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(count * 3), 3));
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      _c.set(colors[i % colors.length]);
      col.set([_c.r, _c.g, _c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const points = new THREE.Points(geo, new THREE.PointsMaterial({ size, map: softDotTexture(), vertexColors: true, transparent: true, opacity: 0, depthWrite: false }));
    points.frustumCulled = false;
    points.renderOrder = 40;
    points.visible = false;
    points.userData = { seed: Float32Array.from({ length: count * 2 }, () => Math.random()), sown: false, full: opacity };
    this.group.add(points);
    return points;
  }

  makeSnow() {
    this.flakes = this.makePoints(SNOW, 0.17, ['#ffffff', '#ffffff', '#f1f6ff'], 0.95);
  }

  makeSand() {
    this.grains = this.makePoints(SAND, 0.11, ['#fff1cf', '#c99c58', '#f6dfae', '#b98a4a'], 0.75);
    this.gusts = makeRibbons(GUSTS, '#fff3d6', [4, 7.5], [0.35, 0.8]);
    this.group.add(this.gusts);
  }

  makeRings() {
    const geo = new THREE.RingGeometry(0.7, 1, 20);
    geo.rotateX(-Math.PI / 2);
    this.ringMesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }), RINGS);
    this.ringMesh.frustumCulled = false;
    this.ringMesh.renderOrder = 3;
    this.rings = Array.from({ length: RINGS }, () => ({ x: 0, z: 0, y: 0.009, size: 0, t: 1, life: 1, bright: 1 }));
    this.ringNext = 0;
    _m.makeScale(0, 0, 0);
    for (let i = 0; i < RINGS; i++) {
      this.ringMesh.setMatrixAt(i, _m);
      this.ringMesh.setColorAt(i, _c.setRGB(0, 0, 0));
    }
    this.group.add(this.ringMesh);
  }

  /** The shadows of the clouds: dark patches drifting over the ground. */
  makeClouds() {
    const tex = paintTexture(256, (g, s) => blotches(g, s, rng(4099), 6, ['#000000'], 44, 100, 0.85), { tile: 6 });
    this.cloudMesh = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshBasicMaterial({ map: tex, color: '#101a2c', transparent: true, opacity: 0, depthWrite: false }));
    this.cloudMesh.rotation.x = -Math.PI / 2;
    this.cloudMesh.position.y = 0.003;
    this.cloudMesh.renderOrder = 1;
    this.cloudMesh.visible = false;
    this.group.add(this.cloudMesh);
  }

  /** The rainbow: half a ring of light standing behind the yard, red outside to violet inside, fading towards its feet. */
  makeRainbow() {
    const bands = ['#000000', '#7a3cff', '#3c6bff', '#35c46a', '#ffe14a', '#ff9a3c', '#ff4a4a', '#000000'];
    const geo = new THREE.RingGeometry(0.82, 1, 64, bands.length - 1, 0, Math.PI);
    const pos = geo.attributes.position;
    const col = new Float32Array(pos.count * 3);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const band = Math.round(((Math.hypot(x, y) - 0.82) / 0.18) * (bands.length - 1));
      const up = Math.pow(clamp(y / 0.5, 0, 1), 0.7); // (nothing of it right down at the ground)
      _c.set(bands[clamp(band, 0, bands.length - 1)]);
      col.set([_c.r * up, _c.g * up, _c.b * up], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.rainbow = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.rainbow.frustumCulled = false;
    this.rainbow.renderOrder = 30;
    this.rainbow.visible = false;
    this.group.add(this.rainbow);
  }

  /** How bright the rainbow ought to be now: it stands while the sun is out on ground still wet from the rain — by day. */
  rainbowDue() {
    const w = this.w;
    return this.kind === 'clear' && !w.night && !(w.env && w.env.snow) ? clamp((this.soaked - 0.35) / 0.3, 0, 1) : 0;
  }

  /** A ring spreading from a point: where a drop lands, where a paw comes down in a puddle. */
  ring(x, z, size = 0.06, life = 0.4, bright = 0.5, y = 0.009) {
    const ring = this.rings[this.ringNext];
    this.ringNext = (this.ringNext + 1) % RINGS;
    Object.assign(ring, { x, z, y, size, life, bright, t: 0 });
  }

  /** Something lands in a puddle: rings, and more of them the bigger the splash. */
  splash(x, z, big = 1) {
    for (let i = 0; i < 2 + Math.round(big * 2); i++) this.ring(x + (Math.random() - 0.5) * 0.12 * big, z + (Math.random() - 0.5) * 0.12 * big, (0.1 + 0.09 * i) * (0.6 + 0.4 * big), 0.7 + 0.25 * i, 0.75);
  }

  // ---------------------------------------------------------------- the puddles

  /**
   * Which of the hollows in the yard hold water: the first few that nothing stands in (the
   * yard changes: a thing is put down where a puddle was, and it drains away).
   */
  layout() {
    const w = this.w;
    const env = w.env;
    if (!env) return;
    this.stamp = w.stamp;
    const b = env.bounds;
    const things = ['bowl', 'bed', 'mailbox', 'mic', 'radio'].map((key) => w.things[key]).filter((t) => t.object.visible || t === w.things.radio);
    const many = 3 + (w.yard > 1.25 ? 1 : 0) + (w.yard > 1.6 ? 1 : 0);
    let n = 0;
    this.pools.forEach((p, i) => {
      const [u, v, size] = POOLS[i];
      p.x = b.cx + u * b.rx;
      p.z = b.cz + v * b.rz;
      p.size = size * 0.34;
      // (its edge wanders out a good third beyond its size. Clear of her things and the foxes' own — well clear of the
      // bed, where they lie down all round it — and of where a fox sits to hand her a letter)
      const reach = p.size * 1.3;
      p.free =
        !w.decorSolids.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + reach) &&
        !env.obstacles.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + reach) &&
        !things.some((t) => Math.hypot(p.x - t.object.position.x, p.z - t.object.position.z) < t.radius * t.object.scale.x + reach + (t === w.things.bed ? 0.5 : 0.1)) &&
        Math.hypot(p.x - env.spots.front.x, p.z - env.spots.front.z) > reach + 0.25;
      p.on = p.free && n < many;
      if (p.on) n++;
      p.turn = i * 1.9;
      p.group.position.set(p.x, 0, p.z);
      p.group.rotation.y = p.turn;
    });
  }

  showPools() {
    for (const p of this.pools) {
      const k = p.k;
      p.group.visible = k > 0.02;
      if (!p.group.visible) continue;
      // it spreads as it fills, and is gone from the edges inwards as it dries
      p.r = p.size * (0.3 + 0.7 * Math.sqrt(k));
      p.group.scale.set(p.r, 1, p.r);
      p.water.material.opacity = 0.84 * clamp(k / 0.25, 0, 1);
      p.rim.material.opacity = 0.2 * clamp(k / 0.15, 0, 1);
    }
  }

  // ---------------------------------------------------------------- every frame

  /** The patch of ground the camera sees, and a little round it. */
  look() {
    const w = this.w;
    const cam = w.camera;
    const c = w.camTarget;
    let x0 = Infinity;
    let x1 = -Infinity;
    let z0 = Infinity;
    let z1 = -Infinity;
    for (const [u, v] of CORNERS) {
      _ray.setFromCamera(_ndc.set(u, v), cam);
      if (!_ray.ray.intersectPlane(_ground, _p)) continue;
      x0 = Math.min(x0, _p.x);
      x1 = Math.max(x1, _p.x);
      z0 = Math.min(z0, _p.z);
      z1 = Math.max(z1, _p.z);
    }
    // (never more than a good way round what the camera looks at: from low down it sees to the horizon)
    const box = this.box;
    box.x0 = clamp(isFinite(x0) ? x0 - 0.6 : -99, c.x - 9, c.x - 2);
    box.x1 = clamp(isFinite(x1) ? x1 + 0.6 : 99, c.x + 2, c.x + 9);
    box.z0 = clamp(isFinite(z0) ? z0 - 0.6 : -99, c.z - 10, c.z - 2);
    box.z1 = clamp(isFinite(z1) ? z1 + 0.6 : 99, c.z + 2, c.z + 9);
    return box;
  }

  update(dt, t) {
    const w = this.w;
    if (!w.env) return;
    const reduce = w.state.reduce;
    // from one sky to the next
    this.rain = damp(this.rain, this.kind === 'rain' ? this.hard : 0, 0.5, dt);
    this.snow = damp(this.snow, this.kind === 'snow' ? this.hard : 0, 0.35, dt);
    this.sand = damp(this.sand, this.kind === 'wind' ? this.hard : 0, 0.4, dt);
    this.wet = damp(this.wet, this.soaked, this.soaked > this.wet ? 0.25 : 0.1, dt);
    const [least, more] = GLOOM[this.kind] || GLOOM.clear;
    this.gloom = damp(this.gloom, least + more * this.hard, 0.45, dt);
    if (this.kind !== 'clear') this.tint.lerp(_c.set(TINT[this.kind] || TINT.clear), 1 - Math.exp(-0.5 * dt));
    this.light();

    // cloud shadows drift over the ground
    this.shade = damp(this.shade, SHADE[this.kind] || 0, 0.4, dt);
    const clouds = this.cloudMesh;
    clouds.visible = this.shade > 0.004;
    if (clouds.visible) {
      clouds.material.opacity = this.shade * (w.night ? 0.5 : 1);
      clouds.material.map.offset.x -= dt * (reduce ? 0.008 : 0.02);
      clouds.material.map.offset.y += dt * 0.004;
      clouds.position.x = w.camTarget.x;
      clouds.position.z = w.camTarget.z;
    }
    // …and after the rain, while the ground is still wet, there is a rainbow behind the yard
    this.bow = damp(this.bow, this.rainbowDue(), 0.35, dt);
    const bow = this.rainbow;
    bow.visible = this.bow > 0.01;
    if (bow.visible) {
      const b = w.env.bounds;
      const R = 1.35 * b.rx;
      bow.scale.setScalar(R);
      bow.position.set(b.cx - 0.12 * b.rx, -0.06 * R, b.cz - b.rz - 1.15 * w.yard);
      bow.material.opacity = 0.34 * this.bow;
    }

    // the ground darkens as it gets wet (snow does not)
    const k = w.env.snow ? 0 : this.wet;
    if (w.env.ground) w.env.ground.material.color.setRGB(1 - 0.27 * k, 1 - 0.23 * k, 1 - 0.17 * k);
    if (w.env.scenery) w.env.scenery.material.color.setRGB(1 - 0.1 * k, 1 - 0.09 * k, 1 - 0.07 * k);

    if (this.stamp !== w.stamp) this.layout();
    for (const p of this.pools) p.k = damp(p.k, p.on ? this.wet : 0, p.on && this.wet > p.k ? 0.5 : 0.35, dt);
    this.showPools();

    const falling = this.rain > 0.02 || this.snow > 0.02 || this.sand > 0.02;
    const box = falling ? this.look() : this.box;
    const thin = (reduce ? 0.4 : 1) * (w.quality >= 2 ? 0.55 : 1); // (a calm view, or a device that can't keep up, gets less of it)
    this.fallRain(dt, box, thin);
    this.fallSnow(dt, t, box, thin);
    this.blowSand(dt, t, box, thin);

    // drops on the puddles, and on a pond if there is one
    if (this.rain > 0.1) {
      for (const p of this.pools) {
        if (p.k > 0.2 && Math.random() < dt * 5 * this.rain) {
          const u = Math.random() * TAU;
          const d = Math.sqrt(Math.random()) * p.r * 0.72;
          this.ring(p.x + Math.cos(u) * d, p.z + Math.sin(u) * d, 0.05 + Math.random() * 0.05, 0.75, 0.55);
        }
      }
      for (const it of w.decor) {
        if (!it.ripple || it.homeless || Math.random() > dt * 7 * this.rain) continue;
        const u = Math.random() * TAU;
        const d = Math.sqrt(Math.random()) * 0.4;
        it.ripple(_p.set(it.object.position.x + Math.cos(u) * d, 0, it.object.position.z + Math.sin(u) * d), 0.35 + Math.random() * 0.25);
      }
    }
    this.spread(dt);
  }

  /** The light of the day (or night) as the habitat has it, under this sky. */
  light() {
    const w = this.w;
    const L = w.lit;
    if (!L) return;
    const g = this.gloom * (w.night ? 0.6 : 1);
    w.sun.intensity = L.sunI * (1 - 0.6 * g);
    w.hemi.intensity = L.hemi * (1 - 0.1 * g);
    w.sun.color.copy(L.sun).lerp(this.tint, 0.55 * g);
    w.hemi.color.copy(L.sky).lerp(this.tint, 0.4 * g);
    w.hemi.groundColor.copy(L.ground).lerp(this.tint, 0.15 * g);
    w.scene.background.copy(L.bg).lerp(this.tint, 0.3 * g);
  }

  fallRain(dt, box, thin) {
    const mesh = this.rainMesh;
    const u = mesh.userData;
    mesh.visible = this.rain > 0.02;
    if (!mesh.visible) return void (u.sown = false);
    const w = this.w;
    const d = u.d;
    const area = (box.x1 - box.x0) * (box.z1 - box.z0 + 4);
    const n = Math.min(RAIN, Math.round(area * DENSE * thin * (0.25 + 0.75 * this.rain)));
    // (seen from above, a drop high up shows over ground further off: so they fall on this side of what is in view, too)
    const cam = w.camera.position;
    const cx = cam.x - w.camTarget.x;
    const cz = cam.z - w.camTarget.z;
    const cl = Math.hypot(cx, cz) || 1;
    const top = Math.min(TOP, cam.y * 0.8); // (it starts below the camera: a drop right in front of the lens is a white bar across the picture)
    const near = (0.4 * w.camDist) ** 2;
    const lean = Math.min(4.5, (top * cl) / Math.max(1, cam.y));
    const x0 = Math.min(box.x0, box.x0 + (cx / cl) * lean);
    const x1 = Math.max(box.x1, box.x1 + (cx / cl) * lean);
    const z0 = Math.min(box.z0, box.z0 + (cz / cl) * lean);
    const z1 = Math.max(box.z1, box.z1 + (cz / cl) * lean);
    w.camera.getWorldDirection(_look);
    _side.crossVectors(FALL, _look).normalize();
    const pos = mesh.geometry.attributes.position.array;
    const sow = !u.sown;
    u.sown = true;
    for (let i = 0; i < n; i++) {
      const j = i * 5;
      let y = d[j + 1];
      if (sow || y < 0 || d[j] < x0 - 1 || d[j] > x1 + 1 || d[j + 2] < z0 - 1 || d[j + 2] > z1 + 1) {
        // it has landed (or is nowhere near any more): a ring where it did, and the next one starts above
        if (!sow && y < 0 && d[j + 2] < box.z1 && d[j] > box.x0 && d[j] < box.x1 && Math.random() < 0.09) this.ring(d[j], d[j + 2], 0.03 + Math.random() * 0.035, 0.3, 0.42);
        d[j] = lerp(x0, x1, Math.random());
        d[j + 2] = lerp(z0, z1, Math.random());
        y = sow ? Math.random() * top : top * (0.85 + 0.15 * Math.random());
      }
      const step = d[j + 3] * dt;
      d[j] += FALL.x * step;
      y += FALL.y * step;
      d[j + 2] += FALL.z * step;
      d[j + 1] = y;
      // (…nor is one drawn that comes close by it)
      const close = (d[j] - cam.x) ** 2 + (y - cam.y) ** 2 + (d[j + 2] - cam.z) ** 2 < near;
      layRibbon(pos, i, d[j], y, d[j + 2], FALL, close ? 0 : d[j + 4], _side, close ? 0 : 0.01);
    }
    mesh.geometry.setDrawRange(0, n * 6);
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.material.opacity = (w.night ? 0.34 : 0.54) * clamp(this.rain * 2.5, 0, 1);
  }

  /** Points that drift through the patch in view, coming round again as they leave it: `move(p, j, seed, speed)` shifts one. */
  drift(points, level, box, high, count, dt, move) {
    points.visible = level > 0.02;
    const u = points.userData;
    if (!points.visible) return void (u.sown = false);
    const pos = points.geometry.attributes.position.array;
    const wx = box.x1 - box.x0 + 1.2;
    const wz = box.z1 - box.z0 + 4;
    const sow = !u.sown;
    u.sown = true;
    for (let i = 0; i < count; i++) {
      const j = i * 3;
      if (sow) {
        pos[j] = box.x0 - 0.6 + Math.random() * wx;
        pos[j + 1] = Math.random() * high;
        pos[j + 2] = box.z0 - 0.6 + Math.random() * wz;
      }
      move(pos, j, u.seed[i * 2], u.seed[i * 2 + 1]);
      // round again: in at the other side, in at the top
      if (pos[j] > box.x1 + 0.6) pos[j] -= wx;
      else if (pos[j] < box.x0 - 0.6) pos[j] += wx;
      if (pos[j + 2] > box.z1 + 3.4) pos[j + 2] -= wz;
      else if (pos[j + 2] < box.z0 - 0.6) pos[j + 2] += wz;
      if (pos[j + 1] < 0) {
        pos[j + 1] += high;
        pos[j] = box.x0 - 0.6 + Math.random() * wx;
      } else if (pos[j + 1] > high) pos[j + 1] -= high;
    }
    points.geometry.setDrawRange(0, count);
    points.geometry.attributes.position.needsUpdate = true;
    points.material.opacity = u.full * clamp(level * 2.5, 0, 1) * (this.w.night ? 0.8 : 1);
  }

  fallSnow(dt, t, box, thin) {
    const n = Math.round(SNOW * thin * (0.3 + 0.7 * this.snow));
    const high = Math.min(3.6, this.w.camera.position.y * 0.55); // (well below the camera: a flake close to the lens is a white blot)
    this.drift(this.flakes, this.snow, box, high, n, dt, (pos, j, a, b) => {
      pos[j] += (Math.sin(t * (0.9 + b) + a * 20) * 0.22 + 0.1) * dt;
      pos[j + 1] -= (0.42 + 0.5 * b) * dt;
      pos[j + 2] += Math.cos(t * (0.7 + a) + b * 20) * 0.14 * dt;
    });
  }

  blowSand(dt, t, box, thin) {
    const n = Math.round(SAND * thin * (0.3 + 0.7 * this.sand));
    this.drift(this.grains, this.sand, box, 1.1, n, dt, (pos, j, a, b) => {
      pos[j] += (2.6 + 2.8 * b) * dt;
      pos[j + 1] += Math.sin(t * (2 + 3 * a) + b * 30) * 0.3 * dt - 0.02 * dt;
      pos[j + 2] += Math.sin(t * 1.3 + a * 30) * 0.25 * dt;
    });
    // …and the gusts that carry the grains: long streaks low over the ground
    const mesh = this.gusts;
    const u = mesh.userData;
    mesh.visible = this.sand > 0.02;
    if (!mesh.visible) return void (u.sown = false);
    const d = u.d;
    const many = Math.round(GUSTS * thin * (0.3 + 0.7 * this.sand));
    const wx = box.x1 - box.x0 + 2.4;
    const wz = box.z1 - box.z0 + 2.4;
    this.w.camera.getWorldDirection(_look);
    _side.crossVectors(WIND, _look).normalize();
    const pos = mesh.geometry.attributes.position.array;
    const sow = !u.sown;
    u.sown = true;
    for (let i = 0; i < many; i++) {
      const j = i * 5;
      if (sow || d[j] > box.x1 + 1.2) {
        // in again on the windward side, somewhere else
        d[j] = sow ? box.x0 - 1.2 + Math.random() * wx : d[j] - wx;
        d[j + 1] = 0.03 + Math.random() * Math.random() * 0.75;
        d[j + 2] = box.z0 - 0.8 + Math.random() * wz;
      }
      const step = d[j + 3] * dt;
      d[j] += WIND.x * step;
      d[j + 2] += WIND.z * step;
      layRibbon(pos, i, d[j], d[j + 1] + Math.sin(t * 3 + i) * 0.02, d[j + 2], WIND, d[j + 4], _side, 0.012);
    }
    mesh.geometry.setDrawRange(0, many * 6);
    mesh.geometry.attributes.position.needsUpdate = true;
    mesh.material.opacity = (this.w.night ? 0.22 : 0.4) * clamp(this.sand * 2.5, 0, 1);
  }

  /** The rings spread and fade. */
  spread(dt) {
    let live = false;
    this.rings.forEach((ring, i) => {
      if (ring.t >= 1) return;
      live = true;
      ring.t = Math.min(1, ring.t + dt / ring.life);
      const k = ring.t;
      const size = k >= 1 ? 0 : ring.size * (0.25 + 0.75 * k);
      _m.compose(_p.set(ring.x, ring.y, ring.z), _q.identity(), _s.set(size, 1, size));
      this.ringMesh.setMatrixAt(i, _m);
      const glow = ring.bright * (1 - k) * (1 - k) * (this.w.night ? 0.6 : 1);
      this.ringMesh.setColorAt(i, _c.setRGB(glow * 0.8, glow * 0.9, glow));
    });
    if (live || this.ringsLive) {
      this.ringMesh.instanceMatrix.needsUpdate = true;
      this.ringMesh.instanceColor.needsUpdate = true;
    }
    this.ringsLive = live;
  }
}
