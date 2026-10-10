// The habitats. Each one paints its own ground, bakes its scenery into a single mesh and
// says how it is lit by day and by night, where the fox's things stand, and what drifts
// through the air. Ids match the shop in js/pet.js.
//
// The meadow and the farm follow the year: they are built for a season ('spring', 'summer',
// 'autumn', 'winter' — the app says which, js/weather.js), the same place in other colours.
// The other habitats are one season always. The weather is not made here (sky.js) — but each
// habitat says where a fox can get out of the rain (`shelters`).
//
// The camera looks down from the south (+Z), so "back" is -Z and things there may be tall;
// whatever stands in front (+Z) has to stay low. The yard — where the foxes live, and where
// her things stand — is an ellipse around (0, -0.3). Round it lies a much wider country
// (`range`): the foxes go roaming in it, and she can slide the view over it with a finger.
// What stands out there is told to the foxes as circles they find their way round (`wilds`).
import * as THREE from '../vendor/three.module.min.js';
import { Batch, V, rng, TAU, lerp, paintTexture, blotches, strokes, dots, softDotTexture, disposeTree } from './kit.js';

const GROUND = [44, 36]; // the ground plane, east–west and north–south (world units): the country, and what a wide monitor sees beyond it
const TILE = 3.8; //        how much ground one painting of it covers
const CENTER_Z = -0.3;
const FAR = { x: 17, north: 14.5, south: 10.5 }; // how far from the yard there is scenery
const CELL = 8.5; //        …baked into one mesh for every patch of ground this wide (what is out of view isn't drawn)
// what the habitat being built has so far: the ground its scenery takes (circles), the places
// kept free for something special, its scenery — and whether it is only for a small picture
const NOW = { foot: [], clear: [], scenery: null, small: false, where: null };
// where she is looking (in the habitat's own measure): what drifts in the air is always about there
const EYE = { x: 0, z: CENTER_Z };
const _c = new THREE.Color();
const _c2 = new THREE.Color();

const NIGHT = { sky: '#9aa9ff', ground: '#232c48', hemi: 1.4, sun: '#c2ceff', sunI: 1.1, pos: [2.6, 6, 2] };
const SNOW = ['#d0e0f4', '#ffffff'];
const SNOW_SOFT = ['#dbe8f8', '#ffffff'];

// What a season leaves out is still "built" — into a batch that keeps nothing, and painted on
// a canvas that takes no paint: the dice are thrown the same in every season, so everything
// else stands where it always does.
const NOTHING = {
  add(geometry) {
    geometry.dispose();
    return this;
  },
};
const BLANK = new Proxy({}, { get: (o, key) => (key === 'createRadialGradient' ? () => ({ addColorStop() {} }) : () => {}), set: () => true });

// ------------------------------------------------------------------ scenery pieces

function groundMesh(paint) {
  const tex = paintTexture(1024, paint, { tile: 1 });
  tex.repeat.set(GROUND[0] / TILE, GROUND[1] / TILE);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GROUND[0], GROUND[1]), new THREE.MeshLambertMaterial({ map: tex }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.z = CENTER_Z;
  mesh.receiveShadow = true;
  return mesh;
}

/** The ground of a habitat that follows the year, painted for one season (`P`) — with the dice thrown as for the season it was first made in. */
function seasonGround(first, P, r, seed) {
  if (P === first) return groundMesh((g, s) => P.paint(g, s, r));
  first.paint(BLANK, 1024, r);
  const own = rng(seed);
  return groundMesh((g, s) => P.paint(g, s, own));
}

/** The scenery of a habitat: what stands by the yard in one mesh, the country round it in one for each patch of ground. */
class Scenery {
  constructor() {
    this.main = new Batch();
    this.cells = new Map();
    this.cur = this.main;
    NOW.scenery = this;
  }

  add(geometry, o) {
    this.cur.add(geometry, o);
    return this;
  }

  /** What is added from now on stands out at (x, z) — or (no place) by the yard again. */
  at(x, z) {
    if (x === undefined) return void (this.cur = this.main);
    const key = `${Math.floor(x / CELL)},${Math.floor(z / CELL)}`;
    if (!this.cells.has(key)) this.cells.set(key, new Batch());
    this.cur = this.cells.get(key);
  }

  /** The mesh by the yard; those of the country hang on it, in the same material (they darken together when it rains). */
  mesh() {
    const mesh = this.main.mesh();
    for (const cell of this.cells.values()) if (cell.pos.length) mesh.add(cell.mesh(mesh.material));
    return mesh;
  }
}

/** Ground that something takes: a fox out roaming walks round it. */
const foot = (x, z, r) => void NOW.foot.push({ x, z, r });
/** …a long thing: circles in a row from one end to the other. */
const footLine = (x1, z1, x2, z2, r) => {
  const n = Math.max(1, Math.ceil(Math.hypot(x2 - x1, z2 - z1) / (1.5 * r)));
  for (let i = 0; i <= n; i++) foot(lerp(x1, x2, i / n), lerp(z1, z2, i / n), r);
};
/** Ground kept free of the scenery that is strewn about: something special stands there. */
const clearing = (x, z, r) => void NOW.clear.push({ x, z, r });
/** Build something as one thing: what it is made of takes no ground of its own. */
const quiet = (fn) => {
  const keep = NOW.foot;
  NOW.foot = [];
  fn();
  NOW.foot = keep;
};

/** A branch from one point to another. */
function limb(b, from, to, rad, color) {
  const a = V(...from);
  const c = V(...to);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize());
  b.add(new THREE.CylinderGeometry(rad * 0.55, rad, a.distanceTo(c), 5), { matrix: new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, V(1, 1, 1)), color, flat: true });
}

/** Snow lying on something: a flattened lump `s` wide, its middle `y` high. */
function snowCap(b, x, y, z, s, flat = 0.4, yaw = 0) {
  b.add(new THREE.IcosahedronGeometry(s, 1), { at: [x, y, z], rot: [0, yaw, 0], scale: [1, flat, 1], color: SNOW, flat: true });
}

/**
 * A tree. `kind: 'pine'` — or a round one, in leaf (`leaves`) or `bare`: its branches where
 * the leaves were, snow lying on them. `snow` / `cap`: snow on a pine. (Whatever it looks
 * like, it takes the same throws of the dice — `snow` alone takes more, as it always did.)
 */
function tree(b, r, x, z, o = {}) {
  const s = o.s || 1;
  const h = (o.h || 1) * s;
  const trunk = o.trunk || (o.bare ? ['#5a4033', '#80604c'] : ['#6b4631', '#8f6247']);
  foot(x, z, 0.11 * s);
  b.add(new THREE.CylinderGeometry(0.05 * s, 0.085 * s, h * 0.6, 7), { at: [x, h * 0.3, z], color: trunk, flat: true });
  const leaves = o.leaves || ['#3c9648', '#74c96f'];
  if (o.kind === 'pine') {
    for (let i = 0; i < 4; i++) {
      const k = i / 3;
      const y = h * 0.42 + i * 0.25 * s;
      const turn = r() * TAU;
      b.add(new THREE.ConeGeometry(lerp(0.42, 0.15, k) * s, 0.44 * s, 8), { at: [x, y, z], rot: [0, turn, 0], color: leaves, flat: true });
      if (o.snow) b.add(new THREE.ConeGeometry(lerp(0.3, 0.1, k) * s, 0.2 * s, 8), { at: [x, y + 0.13 * s, z], rot: [0, r() * TAU, 0], color: ['#e4eefb', '#ffffff'], flat: true });
      else if (o.cap) b.add(new THREE.ConeGeometry(lerp(0.3, 0.1, k) * s, 0.2 * s, 8), { at: [x, y + 0.13 * s, z], rot: [0, turn + 0.4, 0], color: ['#e4eefb', '#ffffff'], flat: true });
    }
    return;
  }
  const n = o.puffs || 5;
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1)) * TAU + r();
    const off = i === 0 ? 0 : 0.27 * s;
    const pr = (i === 0 ? 0.44 : r.range(0.27, 0.36)) * s;
    const at = [x + Math.cos(a) * off, h * 0.66 + (i === 0 ? 0.2 * s : r.range(0, 0.14) * s), z + Math.sin(a) * off];
    const rot = [r() * 3, r() * 3, 0];
    if (!o.bare) {
      b.add(new THREE.IcosahedronGeometry(pr, 1), { at, rot, scale: [1, 0.84, 1], color: leaves, flat: true });
      continue;
    }
    if (i === 0) {
      // the trunk goes on up, a lump of snow in its fork
      limb(b, [x, h * 0.58, z], [x + 0.03 * s, h * 0.98, z - 0.02 * s], 0.045 * s, trunk);
      snowCap(b, x + 0.03 * s, h * 0.99, z - 0.02 * s, 0.1 * s, 0.6, rot[1]);
      continue;
    }
    // a branch out to where the leaves were, and on a little; snow along the end of it
    const end = [x + Math.cos(a) * off * 1.75, at[1] + 0.06 * s, z + Math.sin(a) * off * 1.75];
    limb(b, [x, h * (0.44 + 0.03 * i), z], end, 0.03 * s, trunk);
    snowCap(b, (end[0] + at[0]) / 2, end[1] + 0.012 * s, (end[2] + at[2]) / 2, pr * 0.62, 0.34, rot[1]);
    snowCap(b, end[0], end[1] + 0.02 * s, end[2], pr * 0.34, 0.6, rot[0]);
  }
}

/**
 * Cover under a tree at (x, z) of size `s`: places round the foot of it, each [which way from
 * the trunk (0 = towards whoever is looking on, from the south; + = east), how far out (in
 * tree sizes)] — on the side of the yard, where a fox is seen tucked in under the leaves, and
 * clear of what else stands by the tree. The best place first: a small family takes the first
 * few, which lie well apart; the rest are for squeezing in between. `roof` = what the leaves
 * keep dry.
 */
function under(x, z, s, fan) {
  return {
    roof: { x, z, r: 0.78 * s },
    spots: fan.map(([a, out]) => ({ x: x + Math.sin(a) * out * s, z: z + Math.cos(a) * out * s, yaw: a * 0.75 })),
  };
}

function rock(b, r, x, z, s = 0.2, color = ['#74777f', '#b0b4bc'], snow = false) {
  const rot = [r() * 3, r() * 3, r() * 3];
  const scale = [r.range(0.9, 1.25), r.range(0.55, 0.8), r.range(0.85, 1.15)];
  if (s > 0.1) foot(x, z, s * 0.95); // (a small stone is stepped over)
  b.add(new THREE.IcosahedronGeometry(s, 1), { at: [x, s * 0.4, z], rot, scale, color, flat: true });
  if (!snow) return;
  // (on top of it, however it lies: its height is that of the stretched ball it is, turned)
  const e = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...rot)).elements;
  const top = s * (0.4 + Math.hypot(scale[0] * e[1], scale[1] * e[5], scale[2] * e[9]));
  snowCap(b, x, top - s * 0.12, z, s * 0.7, 0.34, rot[1]);
}

function bush(b, r, x, z, s = 0.22, color = ['#3f9447', '#7ccb72']) {
  if (s > 0.15) foot(x, z, s * 1.1);
  for (let i = 0; i < 3; i++) {
    const a = r() * TAU;
    b.add(new THREE.IcosahedronGeometry(s * r.range(0.7, 1), 1), { at: [x + Math.cos(a) * s * 0.5, s * 0.55, z + Math.sin(a) * s * 0.5], rot: [r() * 3, r() * 3, 0], scale: [1, 0.8, 1], color, flat: true });
  }
}

function flower(b, r, x, z, color, s = 1) {
  b.add(new THREE.CylinderGeometry(0.004 * s, 0.004 * s, 0.07 * s, 3, 1, true), { at: [x, 0.035 * s, z], color: '#4f9a4a' });
  b.add(new THREE.IcosahedronGeometry(0.024 * s, 0), { at: [x, 0.074 * s, z], rot: [0, r() * 3, 0], scale: [1, 0.42, 1], color, flat: true });
  b.add(new THREE.OctahedronGeometry(0.009 * s, 0), { at: [x, 0.082 * s, z], color: '#ffd23f' });
}

function flowerPatch(b, r, x, z, n, colors, spread = 0.25) {
  for (let i = 0; i < n; i++) flower(b, r, x + r.range(-spread, spread), z + r.range(-spread, spread), r.pick(colors), r.range(0.8, 1.3));
}

function mushroom(b, r, x, z, s = 1) {
  b.add(new THREE.CylinderGeometry(0.012 * s, 0.016 * s, 0.05 * s, 6), { at: [x, 0.025 * s, z], color: '#fff3e0' });
  b.add(new THREE.SphereGeometry(0.038 * s, 10, 6, 0, TAU, 0, Math.PI / 2), { at: [x, 0.045 * s, z], scale: [1, 0.8, 1], color: ['#d83b3b', '#ff6b5e'] });
  for (let i = 0; i < 4; i++) {
    const a = r() * TAU;
    b.add(new THREE.SphereGeometry(0.006 * s, 5, 4), { at: [x + Math.cos(a) * 0.022 * s, 0.066 * s, z + Math.sin(a) * 0.022 * s], color: '#ffffff' });
  }
}

function log(b, x, z, yaw, len = 0.7, rad = 0.09, snow = false) {
  footLine(x - Math.cos(yaw) * len * 0.42, z + Math.sin(yaw) * len * 0.42, x + Math.cos(yaw) * len * 0.42, z - Math.sin(yaw) * len * 0.42, rad * 1.1);
  b.add(new THREE.CylinderGeometry(rad, rad, len, 9), { at: [x, rad, z], rot: [0, yaw, Math.PI / 2], color: (p, n) => _c.set(Math.abs(n.y) < 0.3 && Math.abs(n.x * Math.cos(yaw) - n.z * Math.sin(yaw)) > 0.8 ? '#d9b38a' : '#7a5238'), flat: true });
  // (snow along the top of it: a second log, flattened — the cylinder's own x is "up" once it lies down)
  if (snow) b.add(new THREE.CylinderGeometry(rad * 0.86, rad * 0.86, len * 0.94, 9), { at: [x, rad * 1.72, z], rot: [0, yaw, Math.PI / 2], scale: [0.4, 1, 1], color: SNOW, flat: true });
}

function fence(b, x1, z1, x2, z2, color = ['#b98a5e', '#e2bd92'], snow = false) {
  const len = Math.hypot(x2 - x1, z2 - z1);
  const yaw = -Math.atan2(z2 - z1, x2 - x1);
  footLine(x1, z1, x2, z2, 0.06);
  const posts = Math.max(2, Math.round(len / 0.5) + 1);
  for (let i = 0; i < posts; i++) {
    const k = i / (posts - 1);
    b.add(new THREE.BoxGeometry(0.05, 0.34, 0.05), { at: [lerp(x1, x2, k), 0.17, lerp(z1, z2, k)], rot: [0, yaw, 0], color });
    if (snow) b.add(new THREE.BoxGeometry(0.066, 0.03, 0.066), { at: [lerp(x1, x2, k), 0.353, lerp(z1, z2, k)], rot: [0, yaw, 0], color: '#ffffff' });
  }
  for (const y of [0.14, 0.27]) b.add(new THREE.BoxGeometry(len, 0.04, 0.025), { at: [(x1 + x2) / 2, y, (z1 + z2) / 2], rot: [0, yaw, 0], color: color[1] });
  if (snow) b.add(new THREE.BoxGeometry(len, 0.02, 0.034), { at: [(x1 + x2) / 2, 0.298, (z1 + z2) / 2], rot: [0, yaw, 0], color: '#ffffff' });
}

/** Tufts of grass that sway: one instanced mesh. `place()` → [x, z, height] or null. */
function grassField(r, count, place, colors, clock) {
  const pos = [];
  const col = [];
  const nor = [];
  const dark = new THREE.Color(0.55, 0.62, 0.5);
  const light = new THREE.Color(1, 1, 1);
  const push = (x, y, z) => {
    pos.push(x, y, z);
    nor.push(0, 1, 0);
    _c.copy(dark).lerp(light, y);
    col.push(_c.r, _c.g, _c.b);
  };
  for (let k = 0; k < 3; k++) {
    const a = (k / 3) * TAU + 0.4;
    const ox = Math.cos(a);
    const oz = Math.sin(a);
    const px = -oz * 0.12;
    const pz = ox * 0.12;
    const B = [[-px, 0, -pz], [px, 0, pz]];
    const M = [[ox * 0.22 - px * 0.6, 0.55, oz * 0.22 - pz * 0.6], [ox * 0.22 + px * 0.6, 0.55, oz * 0.22 + pz * 0.6]];
    const T = [ox * 0.55, 1, oz * 0.55];
    for (const tri of [[B[0], B[1], M[0]], [B[1], M[1], M[0]], [M[0], M[1], T]]) tri.forEach((v) => push(...v));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = clock;
    shader.vertexShader =
      'uniform float uTime;\n' +
      shader.vertexShader.replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        #ifdef USE_INSTANCING
          float gw = sin(uTime * 1.6 + instanceMatrix[3].x * 2.7 + instanceMatrix[3].z * 3.1) * 0.5 + sin(uTime * 2.9 + instanceMatrix[3].x * 5.3) * 0.2;
          transformed.x += gw * position.y * position.y * 0.3;
          transformed.z += gw * position.y * position.y * 0.14;
        #endif`
      );
  };
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = V(0, 1, 0);
  let n = 0;
  for (let i = 0; i < count * 4 && n < count; i++) {
    const p = place();
    if (!p) continue;
    const w = r.range(0.07, 0.11);
    m.compose(V(p[0], 0, p[1]), q.setFromAxisAngle(up, r() * TAU), V(w, p[2], w));
    mesh.setMatrixAt(n, m);
    mesh.setColorAt(n, _c.set(r.pick(colors)));
    n++;
  }
  mesh.count = n;
  mesh.receiveShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}

/** Things drifting in the air: snow, petals, leaves, pollen, fireflies. One point cloud. */
class Drift {
  constructor(r, o) {
    this.o = { box: [11, 2.4, 10], fall: 0.3, sway: 0.25, wind: 0, size: 0.04, opacity: 0.95, ...o };
    const n = (this.n = o.count);
    this.p = new Float32Array(n * 3);
    this.seed = new Float32Array(n * 2);
    const col = new Float32Array(n * 3);
    const [w, h, d] = this.o.box;
    for (let i = 0; i < n; i++) {
      this.p[i * 3] = r.range(-w / 2, w / 2);
      this.p[i * 3 + 1] = r() * h;
      this.p[i * 3 + 2] = CENTER_Z + r.range(-d / 2, d / 2);
      this.seed[i * 2] = r() * 10;
      this.seed[i * 2 + 1] = r.range(0.6, 1.4);
      _c.set(r.pick(o.colors));
      col.set([_c.r, _c.g, _c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.p, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({
        size: this.o.size,
        map: o.tex || softDotTexture(),
        vertexColors: true,
        transparent: true,
        opacity: this.o.opacity,
        depthWrite: false,
        blending: o.glow ? THREE.AdditiveBlending : THREE.NormalBlending,
      })
    );
    this.points.frustumCulled = false;
    this.r = r;
  }

  update(dt, t) {
    const { box, fall, sway, wind } = this.o;
    const [w, h, d] = box;
    for (let i = 0; i < this.n; i++) {
      const s = this.seed[i * 2];
      const k = this.seed[i * 2 + 1];
      const j = i * 3;
      this.p[j] += (Math.sin(t * 1.3 * k + s) * sway + wind) * dt;
      this.p[j + 2] += Math.cos(t * 0.9 * k + s * 2) * sway * 0.6 * dt;
      this.p[j + 1] -= fall * k * dt;
      if (this.p[j + 1] < 0 || this.p[j + 1] > h) {
        this.p[j + 1] = fall >= 0 ? h : 0;
        this.p[j] = EYE.x + this.r.range(-w / 2, w / 2);
        this.p[j + 2] = EYE.z + this.r.range(-d / 2, d / 2);
      }
      // (it is all about where she is looking: what the view leaves behind comes in again ahead of it)
      const dx = this.p[j] - EYE.x;
      const dz = this.p[j + 2] - EYE.z;
      if (Math.abs(dx) > w / 2) this.p[j] -= Math.round(dx / w) * w;
      if (Math.abs(dz) > d / 2) this.p[j + 2] -= Math.round(dz / d) * d;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
  }
}

const petalTexture = () =>
  paintTexture(48, (g, s) => {
    g.fillStyle = '#fff';
    g.beginPath();
    g.ellipse(s / 2, s / 2, s * 0.42, s * 0.24, 0.6, 0, TAU);
    g.fill();
  });

/** Butterflies: the fox likes to pounce at them. */
function butterflies(r, colors) {
  const group = new THREE.Group();
  // one wing = a large and a small lobe, hinged along the body (x = 0)
  const lobe = (rad, x, z) => {
    const g = new THREE.CircleGeometry(rad, 10);
    g.rotateX(-Math.PI / 2);
    g.scale(1, 1, 0.8);
    g.translate(x, 0, z);
    return g;
  };
  const wing = new Batch().add(lobe(0.03, 0.03, -0.012)).add(lobe(0.021, 0.022, 0.024)).geometry();
  const bodyGeo = new THREE.CylinderGeometry(0.004, 0.004, 0.05, 5);
  bodyGeo.rotateX(Math.PI / 2);
  const dark = new THREE.MeshBasicMaterial({ color: '#3a2a35' });
  const list = colors.map((color) => {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
    const a = new THREE.Mesh(wing, mat);
    const b = new THREE.Mesh(wing, mat);
    b.scale.x = -1;
    g.add(a, b, new THREE.Mesh(bodyGeo, dark));
    group.add(g);
    return { g, a, b, seed: r() * 100, home: V(r.range(-1.3, 1.3), 0, CENTER_Z + r.range(-0.9, 0.8)) };
  });
  return {
    group,
    list,
    update(dt, t) {
      list.forEach((f) => {
        const s = f.seed;
        const x = f.home.x + Math.sin(t * 0.31 + s) * 0.9 + Math.sin(t * 0.83 + s * 2) * 0.3;
        const z = f.home.z + Math.cos(t * 0.27 + s * 3) * 0.6 + Math.sin(t * 0.71 + s) * 0.25;
        const y = 0.3 + Math.sin(t * 1.7 + s) * 0.1 + Math.sin(t * 4.3 + s) * 0.03;
        f.g.rotation.y = Math.atan2(x - f.g.position.x, z - f.g.position.z) + Math.PI;
        f.g.position.set(x, y, z);
        const flap = 0.2 + Math.abs(Math.sin(t * 16 + s)) * 1.0;
        f.a.rotation.z = flap;
        f.b.rotation.z = -flap;
      });
    },
  };
}

/** Standard places for the fox's things; a habitat may move them. */
const SPOTS = () => ({ bowl: V(1.0, 0, 0.42), bed: V(-1.02, 0, -1.02), mic: V(1.05, 0, -0.95), front: V(0, 0, 0.5), mail: V(-1.5, 0, 0.14) });

function habitat(id, r, o) {
  const group = new THREE.Group();
  group.name = `habitat-${id}`;
  const clock = { value: 0 };
  const updaters = [];
  Object.assign(NOW, { foot: [], clear: [], scenery: null, where: null });
  return {
    id,
    group,
    clock,
    updaters,
    bounds: { cx: 0, cz: CENTER_Z, rx: 1.6, rz: 1.12 },
    range: { cx: 0, cz: -0.6, rx: 6.4, rz: 4.2 }, // the country round the yard, as far as the foxes roam and she can look
    wilds: NOW.foot, //  what stands in it: circles { x, z, r }
    spots: SPOTS(),
    obstacles: [],
    ground: null, //   the mesh that is the ground, and the one all the scenery is baked into (they darken when wet)
    scenery: null,
    // where a fox can get out of the rain: [{ spots: [{ x, z, yaw, lie }], via: { x, z } }] — places to sit (or only to lie),
    // the best first, and a point to come by on the way to them, where they can't be walked straight at
    shelters: [],
    litter: null, //   what flies up where a fox lands, other than snow or dust ('🍂')
    prints: null,
    night: { ...NIGHT, ...(o.night || {}) },
    day: o.day,
    nightOnly: [],
    dayOnly: [],
    fairOnly: [], //   …and which of those are only about in fair weather (butterflies, fireflies, pollen)
    dark: false,
    fine: true,
    setNight(on) {
      this.dark = on;
      this.show();
    },
    /** Fair weather — or foul (rain, snow, blowing sand)? */
    setFair(on) {
      if (on === this.fine) return;
      this.fine = on;
      this.show();
    },
    show() {
      const about = (x) => this.fine || !this.fairOnly.includes(x);
      this.nightOnly.forEach((x) => (x.visible = this.dark && about(x)));
      this.dayOnly.forEach((x) => (x.visible = !this.dark && about(x)));
    },
    update(dt, t, world) {
      clock.value = t;
      const k = world.yard || 1;
      EYE.x = world.camTarget ? world.camTarget.x / k : 0;
      EYE.z = world.camTarget ? world.camTarget.z / k : CENTER_Z;
      for (const fn of updaters) fn(dt, t, world);
    },
    dispose() {
      disposeTree(group);
    },
  };
}

/** A random spot around the edge of the yard (outside the fox's ellipse), for scattering scenery. */
const edgeSpot = (r, inner = 1.12, outer = 1.9) => {
  for (let i = 0; i < 20; i++) {
    const x = r.range(-2.6, 2.6);
    const z = CENTER_Z + r.range(-2.3, 1.7);
    const k = Math.hypot(x / 1.42, (z - CENTER_Z) / 1.02);
    if (k > inner && k < outer) return [x, z];
  }
  return [2.4, -2];
};

/** A random spot out in the country, beyond the scenery that was placed by hand — and not where something special stands. */
const farSpot = (r) => {
  const wide = NOW.small ? 8 : FAR.x;
  const north = NOW.small ? 6.6 : FAR.north;
  const south = NOW.small ? 6.2 : FAR.south;
  for (let i = 0; i < 40; i++) {
    const x = r.range(-wide, wide);
    const z = CENTER_Z + r.range(-north, south);
    if (Math.hypot(x / 2.9, (z - CENTER_Z + 0.4) / 2.5) <= 1.1) continue;
    if (NOW.where && !NOW.where(x, z)) continue;
    if (NOW.clear.some((c) => Math.hypot(x - c.x, z - c.z) < c.r)) continue;
    return [x, z];
  }
  return [wide - 1, CENTER_Z - north + 1];
};

/**
 * Fills the country round the yard, so that there is something wherever she looks:
 * `tall(x, z, s)` for the things that stand up (kept out of the ground in front of the yard,
 * where they would hide it, and thin to the south of it), `low(x, z, s)` for the small ones.
 * `nTall` and `nLow` are how many there were round the yard alone: the country takes more.
 */
function surround(r, tall, low, { nTall = 38, nLow = 110, gap = 0.95 } = {}) {
  const b = NOW.scenery;
  const more = NOW.small ? 1 : 4.4;
  const taken = [];
  for (let i = 0, n = 0; i < 900 * more && n < nTall * more; i++) {
    const [x, z] = farSpot(r);
    if (z > CENTER_Z - 0.6 && z < CENTER_Z + 3.4 && Math.abs(x) < 3.5) continue;
    if (z > CENTER_Z + 1.5 && (NOW.small || r() < 0.55)) continue;
    if (taken.some((p) => Math.hypot(p[0] - x, p[1] - z) < gap)) continue;
    taken.push([x, z]);
    b.at(x, z);
    tall(x, z, r.range(0.85, 1.4));
    n++;
  }
  for (let i = 0; i < nLow * more; i++) {
    const [x, z] = farSpot(r);
    b.at(x, z);
    low(x, z, r.range(0.8, 1.35));
  }
  b.at();
}

// ------------------------------------------------------------------ out in the country

/** How many of something the whole country takes, when the ground round the yard alone took `n`. */
const wide = (n) => Math.round(n * (NOW.small ? 1 : 4.4));

/** Something special out in the country, at (x, z): built into the mesh of the ground it stands on. (Left out of a small picture.) */
function place(x, z, fn) {
  if (NOW.small) return;
  NOW.scenery.at(x, z);
  fn();
  NOW.scenery.at();
}

/** A hill of sand or snow, `sx` by `sz` and `h` high: the foxes go round it — unless it is `low` enough to wade through. */
function mound(b, x, z, sx, sz, h, color, low = false) {
  b.add(new THREE.SphereGeometry(1, 20, 10), { at: [x, -0.02, z], scale: [sx, h, sz], color });
  if (low) return;
  const r = Math.min(sx, sz) * 0.6; // (its skirts are for walking on)
  if (sx > sz) footLine(x - (sx - sz) * 0.6, z, x + (sx - sz) * 0.6, z, r);
  else footLine(x, z - (sz - sx) * 0.6, x, z + (sz - sx) * 0.6, r);
}

/** Still water `s` across, stones on its bank, reeds and lily pads — or (`ice`) frozen over. */
function pond(H, b, r, x, z, s, o = {}) {
  const water = new THREE.Mesh(
    new THREE.CircleGeometry(1, 40),
    new THREE.MeshStandardMaterial({ color: o.color || (o.ice ? '#cfe8ff' : '#63b4e8'), roughness: o.ice ? 0.2 : 0.08, metalness: 0.25, transparent: true, opacity: 0.92 })
  );
  water.rotation.x = -Math.PI / 2;
  water.scale.set(s, s * 0.7, 1);
  water.position.set(x, 0.008, z);
  water.receiveShadow = true;
  H.group.add(water);
  clearing(x, z, s + 0.7);
  footLine(x - s * 0.34, z, x + s * 0.34, z, s * 0.68);
  quiet(() => {
    const stone = o.stone || ['#8d9096', '#c4c7cc'];
    const n = Math.round(9 * s) + 5;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + r.range(-0.2, 0.2);
      const size = r.range(0.05, 0.11);
      if (r() < 0.3) continue;
      rock(b, r, x + Math.cos(a) * s * 1.02, z + Math.sin(a) * s * 0.72, size, stone, !!o.ice);
    }
    if (o.ice || o.bare) return;
    // reeds along the far bank
    for (let i = 0; i < 3; i++) {
      const a = Math.PI + 0.4 + r() * (Math.PI - 0.8);
      const px = x + Math.cos(a) * s * 0.88;
      const pz = z + Math.sin(a) * s * 0.6;
      for (let k = 0; k < 5; k++) {
        const h = r.range(0.22, 0.42);
        const qx = px + r.range(-0.08, 0.08);
        const qz = pz + r.range(-0.05, 0.05);
        b.add(new THREE.CylinderGeometry(0.006, 0.008, h, 4), { at: [qx, h / 2, qz], color: '#5c9a48' });
        if (k % 2) b.add(new THREE.CylinderGeometry(0.016, 0.016, 0.08, 6), { at: [qx, h, qz], color: '#7a4a2a' });
      }
    }
    // lily pads
    for (let i = 0; i < Math.round(3 * s) + 1; i++) {
      const a = r() * TAU;
      const d = r.range(0.15, 0.7);
      const px = x + Math.cos(a) * s * d;
      const pz = z + Math.sin(a) * s * 0.7 * d;
      b.add(new THREE.CylinderGeometry(0.075, 0.075, 0.006, 10, 1, false, 0.5, TAU - 0.9), { at: [px, 0.013, pz], rot: [0, r() * 6, 0], color: '#4f9f4a' });
      if (r() < 0.5) b.add(new THREE.IcosahedronGeometry(0.03, 0), { at: [px, 0.03, pz], scale: [1, 0.6, 1], color: o.lily || '#ffb3d1', flat: true });
    }
  });
  return water;
}

/** A field of flowers: an oval `rx` by `rz` full of them. Nothing else grows there — the foxes walk right through. */
function flowerField(b, r, x, z, rx, rz, n, colors, s = 1) {
  clearing(x, z, Math.max(rx, rz) * 0.9);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const k = Math.sqrt(r());
    flower(b, r, x + Math.cos(a) * rx * k, z + Math.sin(a) * rz * k, r.pick(colors), r.range(0.9, 1.5) * s);
  }
}

/** Where trees were felled: stumps, a log or two, mushrooms. */
function stumps(b, r, x, z, snow = false, shroom = b) {
  clearing(x, z, 1.4);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + r();
    const d = r.range(0.35, 0.9);
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d * 0.8;
    const rad = r.range(0.09, 0.15);
    const h = r.range(0.1, 0.2);
    foot(px, pz, rad);
    b.add(new THREE.CylinderGeometry(rad * 0.9, rad * 1.15, h, 9), { at: [px, h / 2, pz], color: ['#6b4631', '#8f6247'], flat: true });
    b.add(new THREE.CylinderGeometry(rad * 0.86, rad * 0.86, 0.01, 9), { at: [px, h + 0.004, pz], color: snow ? '#ffffff' : '#e2c296' });
  }
  log(b, x + 0.25, z + 0.95, 0.2 + r() * 0.4, 0.9, 0.09, snow);
  log(b, x - 1.0, z - 0.2, 1.2 + r() * 0.5, 0.6, 0.07, snow);
  for (let i = 0; i < 6; i++) mushroom(shroom, r, x + r.range(-0.9, 0.9), z + r.range(-0.7, 0.7), r.range(0.8, 1.4));
}

/** A heap of boulders. */
function boulders(b, r, x, z, s, color, snow = false) {
  clearing(x, z, 1.5 * s + 0.4);
  rock(b, r, x, z, 0.55 * s, color, snow);
  for (let i = 0; i < 5; i++) {
    const a = r() * TAU;
    const d = r.range(0.75, 1.3) * s;
    rock(b, r, x + Math.cos(a) * d, z + Math.sin(a) * d * 0.8, r.range(0.14, 0.32) * s, color, snow);
  }
}

/** An open pavilion: a floor on a stone foot, four posts, a roof that comes to a point. */
function pavilion(b, x, z, s = 1, roof = ['#3a3f4a', '#6a7080'], wood = ['#7a4a30', '#a86c48']) {
  clearing(x, z, 1.5 * s);
  foot(x, z, 0.78 * s);
  b.add(new THREE.BoxGeometry(1.2 * s, 0.12 * s, 1.2 * s), { at: [x, 0.06 * s, z], color: ['#9a9da3', '#c9ccd1'] });
  b.add(new THREE.BoxGeometry(1.08 * s, 0.04 * s, 1.08 * s), { at: [x, 0.14 * s, z], color: wood });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.CylinderGeometry(0.04 * s, 0.045 * s, 0.72 * s, 7), { at: [x + sx * 0.46 * s, 0.5 * s, z + sz * 0.46 * s], color: wood });
  b.add(new THREE.BoxGeometry(1.0 * s, 0.05 * s, 1.0 * s), { at: [x, 0.86 * s, z], color: wood });
  b.add(new THREE.ConeGeometry(1.02 * s, 0.44 * s, 4), { at: [x, 1.1 * s, z], rot: [0, Math.PI / 4, 0], color: roof, flat: true });
  b.add(new THREE.SphereGeometry(0.05 * s, 8, 6), { at: [x, 1.34 * s, z], color: roof[1] });
}

/** A camp: a tent, a ring of stones with a fire laid in it, logs to sit on. */
function camp(b, r, x, z, color = ['#e8743b', '#ffb36b']) {
  clearing(x, z, 1.8);
  // the tent: a three-sided prism lying on its side, its ridge towards whoever looks on
  b.add(new THREE.CylinderGeometry(0.5, 0.5, 1.0, 3, 1), { at: [x - 0.55, 0.2, z - 0.45], rot: [-Math.PI / 2, 0.3, 0, 'YXZ'], scale: [1, 1, 0.8], color, flat: true });
  foot(x - 0.55, z - 0.45, 0.52);
  const fx = x + 0.5;
  const fz = z + 0.15;
  foot(fx, fz, 0.22);
  quiet(() => {
    for (let i = 0; i < 7; i++) rock(b, r, fx + Math.cos((i / 7) * TAU) * 0.19, fz + Math.sin((i / 7) * TAU) * 0.19, 0.045, ['#6f727a', '#b4b7be']);
  });
  for (let i = 0; i < 3; i++) b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.26, 5), { at: [fx, 0.06, fz], rot: [0, (i / 3) * Math.PI, 1.25], color: '#5a3d2c' });
  b.add(new THREE.ConeGeometry(0.07, 0.2, 6), { at: [fx, 0.16, fz], color: ['#ff7a1f', '#ffd94a'] });
  log(b, fx + 0.05, fz + 0.55, 0.1, 0.6, 0.07);
  log(b, fx + 0.6, fz - 0.05, 1.45, 0.55, 0.07);
}

/** A windmill, its sails turning. */
function windmill(H, b, x, z, s = 1, o = {}) {
  clearing(x, z, 1.3 * s);
  foot(x, z, 0.5 * s);
  b.add(new THREE.CylinderGeometry(0.3 * s, 0.46 * s, 1.5 * s, 8), { at: [x, 0.75 * s, z], color: o.wall || ['#e4d5ba', '#fff6e6'], flat: true });
  b.add(new THREE.ConeGeometry(0.4 * s, 0.4 * s, 8), { at: [x, 1.7 * s, z], color: o.cap || ['#8f3630', '#c25246'], flat: true });
  b.add(new THREE.BoxGeometry(0.17 * s, 0.32 * s, 0.03 * s), { at: [x, 0.17 * s, z + 0.435 * s], color: '#7a5238' });
  b.add(new THREE.BoxGeometry(0.12 * s, 0.12 * s, 0.03 * s), { at: [x, 0.9 * s, z + 0.355 * s], color: '#5a7fa8' });
  if (o.snow) snowCap(b, x, 1.84 * s, z, 0.2 * s, 0.5);
  const sails = new Batch();
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU;
    sails.add(new THREE.BoxGeometry(0.03 * s, 0.86 * s, 0.02 * s), { at: [Math.sin(a) * 0.43 * s, Math.cos(a) * 0.43 * s, 0], rot: [0, 0, -a], color: '#7a5238' });
    sails.add(new THREE.BoxGeometry(0.2 * s, 0.6 * s, 0.012 * s), { at: [(Math.sin(a) * 0.52 + Math.cos(a) * 0.11) * s, (Math.cos(a) * 0.52 - Math.sin(a) * 0.11) * s, 0], rot: [0, 0, -a], color: o.sail || '#fff6e6' });
  }
  sails.add(new THREE.SphereGeometry(0.06 * s, 8, 6), { color: '#7a5238' });
  const wheel = sails.mesh();
  wheel.position.set(x, 1.5 * s, z + 0.4 * s);
  H.group.add(wheel);
  H.updaters.push((dt) => (wheel.rotation.z -= dt * 0.5));
}

/** A well with a little roof over it. */
function well(b, x, z, snow = false) {
  clearing(x, z, 0.9);
  foot(x, z, 0.3);
  b.add(new THREE.CylinderGeometry(0.24, 0.26, 0.26, 10), { at: [x, 0.13, z], color: ['#8d9096', '#c4c7cc'], flat: true });
  b.add(new THREE.CircleGeometry(0.19, 10), { at: [x, 0.263, z], rot: [-Math.PI / 2, 0, 0], color: '#3d6f96' });
  for (const sx of [-1, 1]) b.add(new THREE.BoxGeometry(0.04, 0.6, 0.04), { at: [x + sx * 0.24, 0.3, z], color: ['#6b4631', '#8f6247'] });
  b.add(new THREE.CylinderGeometry(0.34, 0.34, 0.62, 3, 1), { at: [x, 0.676, z], rot: [-Math.PI / 2, Math.PI / 2, 0, 'YXZ'], scale: [1, 1, 0.45], color: snow ? SNOW : ['#8f3630', '#c25246'], flat: true });
}

/** A haystack. */
function haystack(b, x, z, s = 1, snow = false) {
  foot(x, z, 0.36 * s);
  b.add(new THREE.SphereGeometry(0.38 * s, 10, 8), { at: [x, 0.26 * s, z], scale: [1, 1.1, 1], color: ['#c9a23f', '#f4dc86'], flat: true });
  b.add(new THREE.ConeGeometry(0.3 * s, 0.34 * s, 9), { at: [x, 0.74 * s, z], color: snow ? SNOW : ['#d6b04a', '#f6e39a'], flat: true });
}

/** A scarecrow. */
function scarecrow(b, x, z, shirt = '#4f7fc4') {
  foot(x, z, 0.08);
  b.add(new THREE.BoxGeometry(0.04, 0.85, 0.04), { at: [x, 0.425, z], color: ['#6b4631', '#8f6247'] });
  b.add(new THREE.BoxGeometry(0.72, 0.04, 0.04), { at: [x, 0.62, z], color: '#8f6247' });
  b.add(new THREE.BoxGeometry(0.3, 0.3, 0.1), { at: [x, 0.55, z], color: shirt });
  b.add(new THREE.SphereGeometry(0.1, 10, 8), { at: [x, 0.8, z], color: '#f1dcb2' });
  b.add(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 12), { at: [x, 0.87, z], color: '#c9a23f' });
  b.add(new THREE.ConeGeometry(0.1, 0.14, 10), { at: [x, 0.94, z], color: ['#c9a23f', '#e8cc6a'] });
}

/** A palm: a trunk that leans a little, fronds that droop, coconuts. */
function palm(b, r, x, z, s = 1) {
  foot(x, z, 0.1 * s);
  const yaw = r() * TAU;
  const lean = r.range(0.05, 0.3);
  const n = 6;
  const seg = (1.5 * s) / n;
  let px = x;
  let pz = z;
  let py = 0;
  for (let i = 0; i < n; i++) {
    const k = i / (n - 1);
    b.add(new THREE.CylinderGeometry(lerp(0.065, 0.042, k) * s, lerp(0.085, 0.05, k) * s, seg * 1.1, 7), { at: [px, py + seg / 2, pz], color: i % 2 ? ['#8a6a48', '#a88560'] : ['#9a7852', '#b8956c'], flat: true });
    py += seg;
    px += Math.sin(yaw) * lean * k * 0.14 * s;
    pz += Math.cos(yaw) * lean * k * 0.14 * s;
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU + r() * 0.4;
    const droop = r.range(1.7, 2.1);
    const L = r.range(0.55, 0.78) * s;
    const out = Math.sin(droop) * L * 0.5;
    b.add(new THREE.ConeGeometry(0.12 * s, L, 4), { at: [px + Math.cos(a) * out, py + Math.cos(droop) * L * 0.5, pz - Math.sin(a) * out], rot: [0, a, -droop, 'YZX'], scale: [0.28, 1, 1], color: ['#2f8a4a', '#6fcf6a'], flat: true });
  }
  for (let i = 0; i < 3; i++) b.add(new THREE.SphereGeometry(0.04 * s, 7, 5), { at: [px + Math.cos(i * 2.1) * 0.05 * s, py - 0.06 * s, pz + Math.sin(i * 2.1) * 0.05 * s], color: '#6b4a2e' });
}

/** A clump of bamboo. */
function bamboo(b, r, x, z, s = 1, n = 4) {
  foot(x, z, 0.14 * s);
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const d = i ? r.range(0.07, 0.17) * s : 0;
    const px = x + Math.cos(a) * d;
    const pz = z + Math.sin(a) * d;
    const h = r.range(1.5, 2.3) * s;
    const rad = r.range(0.022, 0.032) * s;
    b.add(new THREE.CylinderGeometry(rad * 0.8, rad, h, 6), { at: [px, h / 2, pz], color: ['#5f9a3c', '#a4d06a'] });
    for (let k = 1; k < 5; k++) b.add(new THREE.CylinderGeometry(rad * 1.25, rad * 1.25, 0.012 * s, 6), { at: [px, (h * k) / 5, pz], color: '#4f8532' });
    for (let k = 0; k < 3; k++) {
      b.add(new THREE.IcosahedronGeometry(r.range(0.1, 0.16) * s, 0), { at: [px + r.range(-0.13, 0.13) * s, h * r.range(0.78, 1.02), pz + r.range(-0.13, 0.13) * s], rot: [r() * 3, r() * 3, 0], scale: [1, 0.5, 1], color: ['#5aa346', '#a9dc7c'], flat: true });
    }
  }
}

/** A cypress: tall and narrow. */
function cypress(b, r, x, z, s = 1) {
  foot(x, z, 0.16 * s);
  b.add(new THREE.CylinderGeometry(0.035 * s, 0.045 * s, 0.25 * s, 6), { at: [x, 0.125 * s, z], color: '#6b4631' });
  b.add(new THREE.SphereGeometry(0.2 * s, 7, 5), { at: [x, 0.32 * s, z], scale: [1, 0.9, 1], color: ['#2a6238', '#3f8050'], flat: true });
  b.add(new THREE.ConeGeometry(0.2 * s, 1.5 * s, 7), { at: [x, 1.0 * s, z], rot: [0, r() * 3, 0], color: ['#2f6a3f', '#5fae6a'], flat: true });
}

/** A bush of lavender in flower (the foxes wade through it). */
function lavender(b, r, x, z, s = 1, color = ['#7a5cc8', '#b79cf0']) {
  b.add(new THREE.IcosahedronGeometry(0.1 * s, 0), { at: [x, 0.05 * s, z], rot: [0, r() * 3, 0], scale: [1, 0.7, 1], color: ['#5d8a55', '#8fb87c'], flat: true });
  b.add(new THREE.IcosahedronGeometry(0.095 * s, 0), { at: [x, 0.13 * s, z], rot: [r() * 3, r() * 3, 0], scale: [1, 0.8, 1], color, flat: true });
  for (let i = 0; i < 4; i++) {
    const a = r() * TAU;
    b.add(new THREE.ConeGeometry(0.026 * s, 0.17 * s, 4), { at: [x + Math.cos(a) * 0.06 * s, 0.22 * s, z + Math.sin(a) * 0.06 * s], rot: [Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35], color, flat: true });
  }
}

/** Rows of it: `rows` of them `len` long, running east–west from (x, z) northwards. */
function lavenderRows(b, r, x, z, len, rows, color) {
  clearing(x + len / 2, z - (rows * 0.34) / 2, Math.max(len / 2, rows * 0.17) + 0.2);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i * 0.17 < len; i++) lavender(b, r, x + i * 0.17 + r.range(-0.02, 0.02), z - j * 0.34 + r.range(-0.02, 0.02), r.range(0.9, 1.25), color);
  }
}

/**
 * A roof: a three-sided prism `len` long lying with its ridge up, `w` wide and `h` high, its foot at height `y`.
 * `yaw` turns the ridge (0 = it runs east–west). `rows` = so many rows of tiles along it (`color` then says which is which).
 */
function roof(b, x, y, z, len, w, h, color, yaw = 0, rows = 0) {
  const R = w / Math.sqrt(3);
  b.add(new THREE.CylinderGeometry(R, R, len, 3, rows || 1), { at: [x, y + h / 3, z], rot: [-Math.PI / 2, Math.PI / 2 + yaw, 0, 'YXZ'], scale: [1, 1, h / (1.5 * R)], color, flat: true, byFace: !!rows });
}

/** A lantern of stone. */
function stoneLantern(b, x, z, stone = ['#8d9096', '#c4c7cc']) {
  foot(x, z, 0.14);
  b.add(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 6), { at: [x, 0.025, z], color: stone, flat: true });
  b.add(new THREE.CylinderGeometry(0.04, 0.05, 0.26, 6), { at: [x, 0.18, z], color: stone, flat: true });
  b.add(new THREE.CylinderGeometry(0.1, 0.07, 0.04, 6), { at: [x, 0.33, z], color: stone, flat: true });
  b.add(new THREE.BoxGeometry(0.12, 0.11, 0.12), { at: [x, 0.405, z], color: '#fff0c2' });
  b.add(new THREE.ConeGeometry(0.16, 0.1, 6), { at: [x, 0.51, z], color: stone, flat: true });
  b.add(new THREE.SphereGeometry(0.025, 8, 6), { at: [x, 0.575, z], color: stone[1] });
}

/** An igloo at (x, z), its way in towards `yaw` (0 = to the south, where she looks on from). */
function igloo(b, x, z, s = 1, yaw = 0) {
  const sx = Math.sin(yaw) * s;
  const cz = Math.cos(yaw) * s;
  foot(x, z, 0.7 * s);
  foot(x + sx * 0.7, z + cz * 0.7, 0.3 * s);
  b.add(new THREE.IcosahedronGeometry(0.72 * s, 2), { at: [x, -0.04 * s, z], scale: [1, 0.86, 1], color: SNOW_SOFT, flat: true });
  b.add(new THREE.CylinderGeometry(0.3 * s, 0.3 * s, 0.5 * s, 10, 1, false, 0, Math.PI), { at: [x + sx * 0.69, 0, z + cz * 0.69], rot: [0, yaw, Math.PI / 2], color: SNOW_SOFT, flat: true });
  b.add(new THREE.CircleGeometry(0.2 * s, 12, 0, Math.PI), { at: [x + sx * 0.945, 0, z + cz * 0.945], rot: [0, yaw, 0], color: '#3a4a6b' });
}

/** A table mountain of red stone. */
function mesa(b, r, x, z, s = 1, color = ['#b8794e', '#e0a878']) {
  clearing(x, z, 1.5 * s);
  foot(x, z, 1.0 * s);
  let y = 0;
  [[1.0, 0.34], [0.84, 0.3], [0.7, 0.26], [0.6, 0.12]].forEach(([rad, h], i) => {
    b.add(new THREE.CylinderGeometry(rad * 0.9 * s, rad * s, h * s, 9), { at: [x + (i % 2 ? 0.04 : -0.03) * s, y + (h * s) / 2, z], rot: [0, r() * 3, 0], scale: [1, 1, 0.8], color: i % 2 ? ['#a9683f', '#cf9565'] : color, flat: true });
    y += h * s;
  });
}

// ------------------------------------------------------------------ the year

const EARTH = { ground: '#2c2836', bg: '#4a3f4a' };
const WINTER_PRINTS = { color: [0.78, 0.84, 0.94], life: 14 };

// The meadow through the year: the light, the ground and the leaves of each season. (Summer is
// the meadow as it was first made: its dice are the ones every season throws.)
const MEADOW = {
  spring: {
    day: { sky: '#ffffff', ground: '#c0e2a0', hemi: 1.98, sun: '#fff3de', sunI: 2.3, pos: [-3.5, 6, 1.6], bg: '#9ed273' },
    night: { ground: '#1f3324', bg: '#2a4e33' },
    paint(g, s, r) {
      g.fillStyle = '#9ed273';
      g.fillRect(0, 0, s, s);
      blotches(g, s, r, 90, ['#b4e389', '#8fcb68', '#c5ec9b', '#84c160'], 70, 240, 0.22);
      blotches(g, s, r, 5, ['#b9a16c'], 30, 70, 0.2);
      strokes(g, s, r, 5200, ['#7dbb57', '#b6e68a', '#6fae4c', '#cdf0a2', '#92cf6b'], 6, 15, 1.7);
      dots(g, s, r, 460, ['#ffffff', '#fff3a8', '#ffd0e4', '#ffe066', '#ffc2dc', '#ffffff'], 1.5, 3, 0.95);
    },
    crowns: [['#63bb56', '#a6e58a'], ['#ffbfd9', '#fff3f8'], ['#7cc95e', '#b8ec94']], // (the second one is in blossom)
    pine: ['#2f8249', '#62ba70'],
    farPine: ['#2f8249', '#62ba70'],
    woods: (u) => (u < 0.36 ? ['#63bb56', '#a6e58a'] : u < 0.66 ? ['#57b05a', '#96dc86'] : u < 0.88 ? ['#ffbfd9', '#fff3f8'] : ['#fff0c2', '#ffffff']),
    bushes: [['#56ad52', '#96dc80'], ['#4ea858', '#8cd68a'], ['#56ad52', '#96dc80']],
    thicket: ['#56ad52', '#96dc80'],
    patches: [['#ffffff', '#ffd0e4', '#fff3a8', '#ff9ecb'], ['#c9a7ff', '#ffffff', '#ffe066'], ['#ffd0e4', '#ffffff', '#ffb26b', '#ff8fa8'], ['#fff3a8', '#ffffff', '#ffe066']],
    wild: ['#ffffff', '#ffd0e4', '#fff3a8', '#c9a7ff', '#ffe066', '#ff9ecb'],
    grass: ['#8fd067', '#a9dc79', '#79bd58', '#bfe890'],
    flies: ['#ffd166', '#ff9ecb', '#ffffff', '#b9e3ff'],
  },
  summer: {
    day: { sky: '#ffffff', ground: '#b6d695', hemi: 1.95, sun: '#fff0d4', sunI: 2.35, pos: [-3.5, 6, 1.6], bg: '#8cc462' },
    night: { ground: '#1f3324', bg: '#27492f' },
    paint(g, s, r) {
      g.fillStyle = '#8cc462';
      g.fillRect(0, 0, s, s);
      blotches(g, s, r, 90, ['#a3d573', '#7ab655', '#b4de86', '#6fae4f'], 70, 240, 0.22);
      blotches(g, s, r, 7, ['#b9a16c'], 30, 70, 0.22);
      strokes(g, s, r, 5200, ['#6aa84a', '#a9dc7d', '#5d9a42', '#c2e894', '#7fbc58'], 6, 15, 1.7);
      dots(g, s, r, 70, ['#ffffff', '#fff3a8', '#ffd0e4'], 1.6, 2.8);
    },
    crowns: [undefined, ['#2f8a4c', '#5fbf6e'], ['#46a04a', '#8bd47a']],
    pine: ['#2c7a47', '#58b06a'],
    woods: (u) => (u < 0.5 ? ['#3c9648', '#74c96f'] : ['#2f8a4c', '#5fbf6e']),
    bushes: [undefined, ['#3a8f52', '#70c47c'], undefined],
    patches: [['#ffffff', '#ffd0e4', '#fff3a8'], ['#c9a7ff', '#ffffff'], ['#ffd0e4', '#ffffff', '#ffb26b'], ['#fff3a8', '#ffffff']],
    wild: ['#ffffff', '#ffd0e4', '#fff3a8', '#c9a7ff'],
    mushrooms: true,
    grass: ['#7fc057', '#9ad06a', '#6aab4b', '#b2df82'],
    flies: ['#ffd166', '#ff9ecb', '#ffffff'],
  },
  autumn: {
    day: { sky: '#fffaf0', ground: '#c6c38c', hemi: 1.86, sun: '#ffe0ad', sunI: 2.5, pos: [-3.9, 5.2, 1.5], bg: '#b4b869' },
    night: { ground: '#2a2e22', bg: '#3f4a35' },
    paint(g, s, r) {
      g.fillStyle = '#b4b869';
      g.fillRect(0, 0, s, s);
      blotches(g, s, r, 90, ['#c6c172', '#a3ad5c', '#d1c57c', '#96a455', '#bfa95f'], 70, 240, 0.23);
      blotches(g, s, r, 12, ['#a98f5c'], 30, 80, 0.22);
      strokes(g, s, r, 4400, ['#8f9d4c', '#c9c874', '#7f8f45', '#d8cf86', '#b3a050'], 6, 14, 1.7, -Math.PI / 2, 0.55, 0.78);
      dots(g, s, r, 560, ['#d9482b', '#f08a24', '#f6c33c', '#b83a1f', '#e9a03a'], 2, 4.2, 0.95);
    },
    crowns: [['#e08a2c', '#f9c04e'], ['#c8452a', '#f4853f'], ['#dba61f', '#ffe27a']],
    pine: ['#2c7445', '#56a868'],
    farPine: ['#2c7445', '#56a868'],
    woods: (u) => (u < 0.3 ? ['#e08a2c', '#f9c04e'] : u < 0.55 ? ['#dba61f', '#ffe27a'] : u < 0.84 ? ['#c8452a', '#f4853f'] : ['#93ad42', '#c8d56c']),
    bushes: [['#a9541f', '#e8923a'], ['#8a8f3d', '#c9c95c'], ['#b3611f', '#eba046']],
    thicket: ['#a9641f', '#e8a03a'],
    patches: [['#ff8fc7', '#ffffff', '#e0569f'], ['#ffffff', '#ffb3da'], ['#ff8fc7', '#ffd166', '#ffffff'], ['#e0569f', '#ffffff']], // cosmos
    wild: ['#ff8fc7', '#ffffff', '#e0569f', '#ffd166'],
    mushrooms: true,
    grass: ['#b5b85c', '#9aa64e', '#c9c36a', '#bf9c4e'],
    litter: '🍂',
  },
  winter: {
    day: { sky: '#f6faff', ground: '#cddcf3', hemi: 1.9, sun: '#fff0dc', sunI: 2.15, pos: [-4.2, 4.6, 2.2], bg: '#eef4fc' },
    night: { sky: '#a9b8ff', ground: '#232f52', hemi: 1.3, bg: '#8e9fc6' },
    paint(g, s, r) {
      g.fillStyle = '#f4f8fe';
      g.fillRect(0, 0, s, s);
      blotches(g, s, r, 64, ['#dfe9f8', '#ffffff', '#d4e2f5', '#ffffff'], 80, 260, 0.17);
      g.globalAlpha = 0.3;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, s, s); // (a veil of white: the patches darken the ground where they overlap)
      g.globalAlpha = 1;
      dots(g, s, r, 380, ['#ffffff', '#f4f9ff'], 0.8, 2, 0.9);
      strokes(g, s, r, 230, ['#cbdcf2'], 20, 60, 1.5, 0.2, 0.25, 0.35);
      strokes(g, s, r, 520, ['#b9b089', '#cfc49a', '#a39a76'], 5, 11, 1.4, -Math.PI / 2, 0.6, 0.7); // dry grass through the snow
    },
    crowns: [undefined, undefined, undefined], // (bare)
    pine: ['#2b6f4a', '#4f9f72'],
    farPine: ['#2b6f4a', '#4f9f72'],
    woods: () => undefined,
    bushes: [SNOW, SNOW, SNOW],
    thicket: SNOW,
    grass: ['#cfc79d', '#b9b08a', '#ded7b0'],
    tufts: 0.3, // how much of the grass shows
    low: 0.7, //   …and how tall
    snow: true,
  },
};

// …and the farm. (Autumn is the farm as it was first made.)
const FARM = {
  spring: {
    day: { sky: '#ffffff', ground: '#cdb58a', hemi: 1.92, sun: '#fff3da', sunI: 2.3, pos: [-3.4, 6, 1.8], bg: '#b8905f' },
    night: EARTH,
    paint(g, s, r) {
      g.fillStyle = '#b8905f';
      g.fillRect(0, 0, s, s);
      blotches(g, s, r, 90, ['#a97f52', '#c9a271', '#9d7449', '#c39a66'], 70, 240, 0.24);
      blotches(g, s, r, 34, ['#a9d977', '#93cb66', '#b9e389'], 40, 120, 0.32);
      strokes(g, s, r, 900, ['#ecd58f', '#e0c377', '#f4e2a6'], 8, 18, 1.6, 0, Math.PI, 0.6);
      strokes(g, s, r, 1900, ['#8fd067', '#b6e68a', '#7dc25a', '#a3dc7a'], 6, 13, 1.6, -Math.PI / 2, 0.5, 0.8);
      dots(g, s, r, 220, ['#8f6a43', '#e9d8ae'], 0.9, 2.4, 0.7);
      dots(g, s, r, 160, ['#ffffff', '#fff3a8', '#ffd0e4'], 1.4, 2.6, 0.95);
    },
    orchard: ['#ffc4d9', '#ffffff'], // apple blossom
    crops: 'sprouts',
    stalks: 'sprouts',
    water: '#8fd3ff',
    thicket: ['#56ad52', '#96dc80'],
    wild: ['#ffffff', '#fff3a8', '#ffb26b', '#ffd0e4'],
    grass: ['#a3d873', '#8fca62', '#bde68c'],
    tufts: 1.25,
  },
  summer: {
    day: { sky: '#ffffff', ground: '#d2bd8c', hemi: 1.92, sun: '#fff2d2', sunI: 2.5, pos: [-3.3, 6.2, 1.8], bg: '#c39f6c' },
    night: EARTH,
    paint(g, s, r) {
      g.fillStyle = '#c39f6c';
      g.fillRect(0, 0, s, s);
      blotches(g, s, r, 90, ['#b98c58', '#d4ae7b', '#ad8150', '#cfa46f'], 70, 240, 0.24);
      blotches(g, s, r, 44, ['#9ccf68', '#86c058', '#b0dc7c'], 50, 130, 0.34);
      strokes(g, s, r, 1300, ['#ecd58f', '#e0c377', '#f4e2a6', '#cdb065'], 8, 20, 1.6, 0, Math.PI, 0.7);
      strokes(g, s, r, 1700, ['#7dbb57', '#a9dc7d', '#6fae4c'], 6, 13, 1.6, -Math.PI / 2, 0.5, 0.8);
      dots(g, s, r, 260, ['#8f6a43', '#e9d8ae'], 0.9, 2.4, 0.7);
    },
    orchard: ['#3f9a47', '#84d273'],
    apples: { color: '#a9d85e', k: 0.8 }, // still green
    crops: 'grown',
    pumpkins: { tones: ['#9cc85a', '#86b548'], k: 0.62 }, // …and so are these, and small
    stalks: 'flowers',
    water: '#8fd3ff',
    wild: ['#ffffff', '#fff3a8', '#ffb26b'],
    grass: ['#8fcf63', '#7abf55', '#a9dd7c'],
    tufts: 1.3,
  },
  autumn: {
    day: { sky: '#ffffff', ground: '#d6b98a', hemi: 1.9, sun: '#fff0cf', sunI: 2.4, pos: [-3.4, 6, 1.8], bg: '#c69d6a' },
    night: EARTH,
    paint(g, s, r) {
      g.fillStyle = '#c69d6a';
      g.fillRect(0, 0, s, s);
      blotches(g, s, r, 90, ['#b98c58', '#d4ae7b', '#ad8150', '#cfa46f'], 70, 240, 0.24);
      blotches(g, s, r, 16, ['#9cc56a', '#86b558'], 40, 110, 0.3);
      strokes(g, s, r, 2400, ['#ecd58f', '#e0c377', '#f4e2a6', '#cdb065'], 8, 20, 1.6, 0, Math.PI, 0.75);
      dots(g, s, r, 260, ['#8f6a43', '#e9d8ae'], 0.9, 2.4, 0.7);
    },
    orchard: ['#a9a43b', '#e4cf5e'], // the leaves are turning
    apples: { color: '#e9433f', k: 1 },
    crops: 'grown',
    pumpkins: { tones: ['#ff8a24', '#f07412'], k: 1 },
    stalks: 'flowers',
    water: '#8fd3ff',
    wild: ['#ffffff', '#fff3a8', '#ffb26b'],
    grass: ['#9cc56a', '#86b558', '#b7d980'],
    litter: null,
  },
  winter: {
    day: { sky: '#f6faff', ground: '#cfdcee', hemi: 1.9, sun: '#fff0dc', sunI: 2.15, pos: [-4.2, 4.6, 2.2], bg: '#edf3fb' },
    night: { sky: '#a9b8ff', ground: '#262c48', hemi: 1.3, bg: '#8794b6' },
    paint(g, s, r) {
      g.fillStyle = '#f4f8fe';
      g.fillRect(0, 0, s, s);
      blotches(g, s, r, 64, ['#dfe9f8', '#ffffff', '#d4e2f5', '#ffffff'], 80, 260, 0.17);
      g.globalAlpha = 0.3;
      g.fillStyle = '#ffffff';
      g.fillRect(0, 0, s, s);
      g.globalAlpha = 1;
      blotches(g, s, r, 10, ['#b99b74'], 30, 80, 0.2); // trodden earth
      dots(g, s, r, 320, ['#ffffff', '#f4f9ff'], 0.8, 2, 0.9);
      strokes(g, s, r, 760, ['#d9c88f', '#c9b57c', '#e6d8a4'], 6, 14, 1.5, 0, Math.PI, 0.7); // straw through the snow
    },
    orchard: undefined, // (bare)
    crops: null,
    stalks: null,
    water: '#dff1ff', // frozen over
    thicket: SNOW,
    grass: ['#d9cf9f', '#c6bb8a', '#e6ddb2'],
    tufts: 0.3,
    low: 0.7,
    snow: true,
  },
};

/** A snowman. */
function snowman(b, sx, sz, scarf = '#ff5a7d') {
  foot(sx, sz, 0.2);
  b.add(new THREE.SphereGeometry(0.2, 14, 10), { at: [sx, 0.17, sz], color: SNOW_SOFT });
  b.add(new THREE.SphereGeometry(0.14, 14, 10), { at: [sx, 0.44, sz], color: SNOW_SOFT });
  b.add(new THREE.ConeGeometry(0.022, 0.1, 6), { at: [sx - 0.1, 0.45, sz + 0.08], rot: [1.2, 0, 0.9], color: '#ff8a3c' });
  for (const [dx, dy] of [[-0.085, 0.5], [-0.035, 0.52]]) b.add(new THREE.SphereGeometry(0.014, 6, 5), { at: [sx + dx - 0.02, dy, sz + 0.11 - (dx + 0.085)], color: '#2a2a35' });
  b.add(new THREE.TorusGeometry(0.105, 0.028, 6, 14), { at: [sx, 0.33, sz], rot: [Math.PI / 2, 0, 0], color: scarf });
  b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), { at: [sx + 0.2, 0.3, sz - 0.05], rot: [0, 0, -1.0], color: '#6b4631' });
  b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 4), { at: [sx - 0.18, 0.3, sz + 0.12], rot: [0.5, 0, 1.0], color: '#6b4631' });
}

// ------------------------------------------------------------------ the habitats

const HABITATS = {
  // 숲속 풀밭 — the red fox's home ground. It follows the year (MEADOW).
  meadow(r, season) {
    const P = MEADOW[season] || MEADOW.summer;
    const snowy = !!P.snow;
    const H = habitat('meadow', r, { day: P.day, night: P.night });
    H.group.add((H.ground = seasonGround(MEADOW.summer, P, r, 8101)));
    const b = new Scenery();
    const crown = (leaves) => (snowy ? { bare: true } : { leaves });
    const bloom = P.patches ? b : NOTHING; // (no flowers in the snow)
    const shroom = P.mushrooms ? b : NOTHING;
    const patch = (i) => (P.patches ? P.patches[i] : SNOW);
    tree(b, r, -1.5, -1.95, { s: 1.25, ...crown(P.crowns[0]) });
    tree(b, r, 2.05, -2.15, { s: 1.05, ...crown(P.crowns[1]) });
    tree(b, r, 0.25, -2.75, { s: 1.15, kind: 'pine', leaves: P.pine, cap: snowy });
    tree(b, r, -2.75, -0.7, { s: 0.95, ...crown(P.crowns[2]) });
    tree(b, r, 2.9, -0.2, { s: 0.9, kind: 'pine', leaves: P.pine, cap: snowy });
    bush(b, r, -2.2, 0.55, 0.24, P.bushes[0]);
    bush(b, r, 2.25, -1.1, 0.26, P.bushes[1]);
    bush(b, r, -0.75, -2.2, 0.22, P.bushes[2]);
    rock(b, r, 2.05, 0.75, 0.2, undefined, snowy);
    rock(b, r, 1.8, 0.98, 0.11, undefined, snowy);
    rock(b, r, -1.95, -1.5, 0.16, undefined, snowy);
    log(b, 1.2, -1.85, 0.35, 0.8, 0.085, snowy);
    mushroom(shroom, r, 0.72, -1.72, 1.1);
    mushroom(shroom, r, 0.86, -1.6, 0.8);
    mushroom(shroom, r, -2.05, 1.05, 1);
    flowerPatch(bloom, r, -1.75, 0.95, 7, patch(0));
    flowerPatch(bloom, r, 1.75, -0.2, 5, patch(1));
    flowerPatch(bloom, r, -0.2, 1.25, 6, patch(2));
    flowerPatch(bloom, r, -1.3, -1.9, 5, patch(3));
    // out in the country: a pond (frozen over in winter), a field of flowers, an old oak, a clearing with stumps
    const q = (i) => rng(8101 + i * 977);
    place(4.9, -1.2, () => pond(H, b, q(1), 4.9, -1.2, 1.15, { ice: snowy }));
    place(-4.8, -0.7, () => flowerField(bloom, q(2), -4.8, -0.7, 1.7, 1.15, 150, P.wild || SNOW));
    place(0.5, -4.4, () => {
      clearing(0.5, -4.4, 1.5);
      tree(b, q(3), 0.5, -4.4, { s: 2.3, puffs: 8, ...crown(P.crowns[0]) });
      flowerPatch(bloom, q(3), 0.1, -3.7, 9, P.wild || SNOW, 0.5);
    });
    place(3.7, -3.8, () => stumps(b, q(4), 3.7, -3.8, snowy, shroom));
    place(-3.7, -3.6, () => boulders(b, q(5), -3.7, -3.6, 0.9, undefined, snowy));
    place(-4.1, 2.0, () => flowerField(bloom, q(6), -4.1, 2.0, 1.3, 0.8, 90, P.wild || SNOW));
    place(4.2, 1.9, () => {
      clearing(4.2, 1.9, 1.2);
      for (const [dx, dz, k] of [[0, 0, 0.3], [0.55, 0.2, 0.24], [-0.5, 0.25, 0.26]]) bush(b, q(7), 4.2 + dx, 1.9 + dz, k, P.bushes[0]);
      log(b, 4.3, 2.6, 0.2, 0.8, 0.08, snowy);
    });
    surround(
      r,
      (x, z, k) => {
        if (r() < 0.72) {
          const pine = r() < 0.3;
          const leaves = P.woods(r());
          tree(b, r, x, z, pine ? { s: k, kind: 'pine', leaves: P.farPine || leaves, cap: snowy } : { s: k, ...crown(leaves) });
        } else bush(b, r, x, z, 0.26 * k, P.thicket);
      },
      (x, z, k) => {
        const pick = r();
        if (pick < 0.4) {
          flowerPatch(bloom, r, x, z, 5, P.wild || SNOW);
          if (snowy) b.add(new THREE.SphereGeometry(1, 12, 8), { at: [x, -0.03, z], scale: [0.3 * k, 0.13 * k, 0.26 * k], color: SNOW }); // a drift, where the flowers will be
        } else if (pick < 0.65) rock(b, r, x, z, 0.14 * k, undefined, snowy);
        else if (pick < 0.85) bush(b, r, x, z, 0.14 * k, P.thicket);
        else mushroom(shroom, r, x, z, k);
      }
    );
    // what only this season has (with dice of its own)
    const own = rng(8101 + (season || 'summer').length * 131 + (season || 's').charCodeAt(1));
    if (P === MEADOW.spring) {
      for (let i = 0; i < 9; i++) flowerPatch(b, own, ...edgeSpot(own, 1.24, 1.9), 6, P.wild, 0.3);
    } else if (P === MEADOW.autumn) {
      for (let i = 0; i < 7; i++) mushroom(b, own, ...edgeSpot(own, 1.3, 1.95), own.range(0.8, 1.3));
      for (let i = 0; i < 4; i++) flowerPatch(b, own, ...edgeSpot(own, 1.24, 1.9), 6, P.wild, 0.28);
    } else if (snowy) {
      for (const [x, z, s] of [[-2.7, 1.25, 0.5], [2.75, -1.25, 0.42], [1.0, -2.6, 0.5], [-0.35, -2.75, 0.36], [2.6, 1.55, 0.4], [-2.9, -1.75, 0.55]]) {
        b.add(new THREE.SphereGeometry(1, 16, 10), { at: [x, -0.05, z], scale: [s, s * 0.42, s * 0.8], color: SNOW });
      }
      snowman(b, 2.45, 0.12, '#5aa9ff');
    }
    H.group.add((H.scenery = b.mesh()));
    const tufts = P.tufts || 1;
    const low = P.low || 1;
    H.group.add(
      grassField(r, Math.round(520 * tufts), () => {
        const x = r.range(-2.9, 2.9);
        const z = CENTER_Z + r.range(-2.5, 1.9);
        const k = Math.hypot(x / 1.42, (z - CENTER_Z) / 1.02);
        if (k < 1 && r() < 0.72) return null;
        return [x, z, (k < 1 ? r.range(0.035, 0.06) : r.range(0.07, 0.15)) * low];
      }, P.grass, H.clock)
    );
    H.group.add(grassField(r, wide(Math.round(620 * tufts)), () => [...farSpot(r), r.range(0.07, 0.16) * low], P.grass, H.clock));
    if (P.flies) {
      const flies = butterflies(r, P.flies);
      H.group.add(flies.group);
      H.dayOnly.push(flies.group);
      H.fairOnly.push(flies.group);
      H.butterflies = flies.list;
      H.updaters.push((dt, t) => flies.update(dt, t));
    }
    if (P === MEADOW.spring || P === MEADOW.summer) {
      // pollen by day — and, on summer nights, fireflies
      const pollen = new Drift(r, { count: 90, colors: ['#fffbd6', '#ffffff'], fall: -0.05, sway: 0.12, size: 0.028, opacity: 0.6, box: [11, 1.4, 10] });
      H.group.add(pollen.points);
      H.dayOnly.push(pollen.points);
      H.fairOnly.push(pollen.points);
      if (P === MEADOW.summer) {
        const glow = new Drift(r, { count: 60, colors: ['#eaff8a', '#c8ff6a'], fall: -0.02, sway: 0.3, size: 0.07, glow: true, box: [11, 0.9, 10] });
        H.group.add(glow.points);
        H.nightOnly.push(glow.points);
        H.fairOnly.push(glow.points);
        H.updaters.push((dt, t) => (pollen.points.visible ? pollen : glow).update(dt, t));
      } else {
        // …in spring a few petals come down from the tree in blossom
        const petals = new Drift(r, { count: 46, colors: ['#ffffff', '#ffe0ee', '#ffc4df'], fall: 0.18, sway: 0.34, wind: 0.08, size: 0.05, tex: petalTexture() });
        H.group.add(petals.points);
        H.updaters.push((dt, t) => {
          if (pollen.points.visible) pollen.update(dt, t);
          petals.update(dt, t);
        });
      }
    } else if (P === MEADOW.autumn) {
      const leaves = new Drift(r, { count: 80, colors: ['#d9482b', '#f08a24', '#f6c33c', '#e9a03a'], fall: 0.22, sway: 0.4, wind: 0.12, size: 0.065, tex: petalTexture() });
      H.group.add(leaves.points);
      H.updaters.push((dt, t) => leaves.update(dt, t));
    }
    H.litter = P.litter || null;
    if (snowy) {
      H.prints = { ...WINTER_PRINTS };
      H.snow = true;
    }
    // out of the rain: under the two trees at the back of the yard
    H.shelters.push(
      under(-1.5, -1.95, 1.25, [[0.54, 0.5], [-0.16, 0.5], [1.24, 0.5], [0.19, 0.66], [0.89, 0.66]]), // (between the rock on its left and the bush behind)
      under(2.05, -2.15, 1.05, [[-0.2, 0.5], [0.45, 0.5], [1.1, 0.5], [-0.62, 0.62]]) //                    (…the log)
    );
    H.obstacles.push({ x: -1.5, z: -1.95, r: 0.12 }, { x: 2.05, z: -2.15, r: 0.1 });
    return H;
  },

  // 사막 — the fennec's dunes
  desert(r) {
    const H = habitat('desert', r, {
      day: { sky: '#fff6e6', ground: '#e9c489', hemi: 1.9, sun: '#ffe6bd', sunI: 2.7, pos: [-3.2, 6, 2.2], bg: '#e9c98b' },
      night: { ground: '#3a3350', bg: '#4a4466', sunI: 1.05 },
    });
    H.group.add(
      (H.ground = groundMesh((g, s) => {
        g.fillStyle = '#e9c98b';
        g.fillRect(0, 0, s, s);
        blotches(g, s, r, 80, ['#f4dca6', '#dcb876', '#efd297', '#d8b06e'], 80, 260, 0.22);
        // wind ripples
        g.strokeStyle = '#cfa868';
        g.lineWidth = 2;
        for (let i = 0; i < 46; i++) {
          const y0 = (i / 46) * s + r.range(-6, 6);
          const ph = r() * 6;
          g.globalAlpha = r.range(0.18, 0.4);
          g.beginPath();
          for (let x = 0; x <= s; x += 16) g.lineTo(x, y0 + Math.sin((x / s) * TAU * 3 + ph) * 7 + Math.sin((x / s) * TAU * 7 + ph) * 2.5);
          g.stroke();
        }
        g.globalAlpha = 1;
        dots(g, s, r, 260, ['#b9925f', '#f8e6bd', '#a98456'], 0.8, 2.4, 0.7);
      }))
    );
    const b = new Scenery();
    const sand = ['#dcb574', '#f3d9a2'];
    for (const [x, z, sx, sz, h] of [[-2.3, -2.5, 1.9, 1.1, 0.5], [1.4, -2.9, 2.3, 1.1, 0.62], [3.2, -1.2, 1.3, 1.5, 0.42], [-3.3, 0.2, 1.2, 1.6, 0.36]]) mound(b, x, z, sx, sz, h, sand);
    const cactus = (x, z, s, arms) => {
      const green = ['#3f9a62', '#74c98a'];
      foot(x, z, 0.2 * s);
      const stem = (px, py, pz, h, rad) => {
        b.add(new THREE.CylinderGeometry(rad, rad, h, 9), { at: [px, py + h / 2, pz], color: green });
        b.add(new THREE.SphereGeometry(rad, 9, 6), { at: [px, py + h, pz], color: green[1] });
      };
      stem(x, 0, z, 0.62 * s, 0.085 * s);
      arms.forEach(([sg, y, h]) => {
        b.add(new THREE.CylinderGeometry(0.05 * s, 0.05 * s, 0.17 * s, 8), { at: [x + sg * 0.11 * s, y * s, z], rot: [0, 0, Math.PI / 2], color: green });
        stem(x + sg * 0.19 * s, y * s - 0.02 * s, z, h * s, 0.05 * s);
      });
      b.add(new THREE.SphereGeometry(0.03 * s, 8, 6), { at: [x + 0.02, 0.7 * s, z + 0.03], scale: [1, 0.7, 1], color: '#ff7fb0' });
    };
    cactus(-1.95, -1.65, 1.35, [[1, 0.3, 0.26], [-1, 0.2, 0.36]]);
    cactus(2.2, -1.75, 1.1, [[-1, 0.26, 0.24]]);
    cactus(-2.55, 0.5, 0.8, [[1, 0.24, 0.2]]);
    // prickly pear
    for (const [x, z] of [[2.15, 0.55], [0.3, -2.2]]) {
      foot(x, z, 0.16);
      for (let i = 0; i < 4; i++) b.add(new THREE.SphereGeometry(0.11, 10, 8), { at: [x + r.range(-0.1, 0.1), 0.1 + i * 0.07, z + r.range(-0.06, 0.06)], rot: [0, r() * 3, r.range(-0.4, 0.4)], scale: [1, 1.25, 0.28], color: ['#4f9f63', '#86cf8f'] });
    }
    const stone = ['#b8794e', '#e0a878'];
    rock(b, r, 1.75, -1.95, 0.3, stone);
    rock(b, r, 1.35, -2.05, 0.17, stone);
    rock(b, r, -2.1, 1.05, 0.2, stone);
    rock(b, r, 2.6, -0.4, 0.24, stone);
    rock(b, r, -0.95, -2.15, 0.14, stone);
    // a bleached branch
    b.add(new THREE.CylinderGeometry(0.02, 0.035, 0.7, 6), { at: [-1.25, 0.04, 1.3], rot: [0, 0.6, 1.5], color: '#e9dcc4', flat: true });
    b.add(new THREE.CylinderGeometry(0.012, 0.02, 0.3, 5), { at: [-1.1, 0.1, 1.2], rot: [0.4, 0.2, 1.0], color: '#e9dcc4', flat: true });
    // out in the country: an oasis under palms, table mountains, a caravan's camp
    const q = (i) => rng(6701 + i * 977);
    place(4.7, 1.6, () => {
      pond(H, b, q(1), 4.7, 1.6, 1.2, { color: '#4fb6c9', stone, lily: '#fff3a8' });
      for (const [dx, dz, k] of [[-1.3, -0.6, 1.15], [1.25, -0.75, 1.0], [0.1, -1.2, 1.3], [1.5, 0.5, 0.85]]) palm(b, q(1), 4.7 + dx, 1.6 + dz, k);
      const tuft = q(8);
      for (let i = 0; i < 26; i++) {
        const a = tuft() * TAU;
        b.add(new THREE.ConeGeometry(0.02, 0.16, 4), { at: [4.7 + Math.cos(a) * 1.4, 0.08, 1.6 + Math.sin(a) * 1.0], color: '#6fb24f' });
      }
    });
    place(-4.6, -2.9, () => mesa(b, q(2), -4.6, -2.9, 1.25, stone));
    place(1.2, -4.6, () => mesa(b, q(3), 1.2, -4.6, 0.9, stone));
    place(-4.4, 1.7, () => camp(b, q(4), -4.4, 1.7, ['#c9552e', '#f2c078']));
    place(4.7, -3.1, () => boulders(b, q(5), 4.7, -3.1, 0.75, stone));
    surround(
      r,
      (x, z, k) => {
        const pick = r();
        if (pick < 0.45) mound(b, x, z, 1.5 * k, 1.1 * k, 0.15 * k, sand, true);
        else if (pick < 0.8) cactus(x, z, 0.9 * k, r() < 0.5 ? [[1, 0.28, 0.24], [-1, 0.2, 0.32]] : [[r() < 0.5 ? 1 : -1, 0.26, 0.24]]);
        else rock(b, r, x, z, 0.3 * k, stone);
      },
      (x, z, k) => {
        if (r() < 0.6) rock(b, r, x, z, 0.12 * k, stone);
        else b.add(new THREE.SphereGeometry(0.1 * k, 10, 8), { at: [x, 0.1 * k, z], rot: [0, r() * 3, r.range(-0.3, 0.3)], scale: [1, 1.25, 0.28], color: ['#4f9f63', '#86cf8f'] });
      },
      { nTall: 30, nLow: 70, gap: 1.6 }
    );
    H.group.add((H.scenery = b.mesh()));
    H.group.add(
      grassField(r, 70, () => {
        const [x, z] = edgeSpot(r, 1.05, 2);
        return [x, z, r.range(0.06, 0.12)];
      }, ['#d7c172', '#c2a95c', '#e6d58a'], H.clock)
    );
    H.group.add(grassField(r, wide(150), () => [...farSpot(r), r.range(0.06, 0.13)], ['#d7c172', '#c2a95c', '#e6d58a'], H.clock));
    // tumbleweed rolling through now and then
    const weed = new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), new THREE.MeshLambertMaterial({ color: '#a8824f', wireframe: true }));
    weed.position.set(-9, 0.13, -1.6);
    H.group.add(weed);
    let next = 6;
    H.updaters.push((dt, t) => {
      if (weed.position.x > 8) {
        if (t > next) {
          weed.position.set(-8, 0.13, CENTER_Z + r.range(-1.7, -1.2));
          next = t + r.range(18, 34);
        }
        return;
      }
      weed.position.x += dt * 0.9;
      weed.position.y = 0.13 + Math.abs(Math.sin(t * 4)) * 0.07;
      weed.rotation.z -= dt * 6;
    });
    const dust = new Drift(r, { count: 100, colors: ['#fff1cf', '#f6dca8'], fall: 0.02, sway: 0.1, wind: 0.35, size: 0.03, opacity: 0.55, box: [11, 0.8, 10] });
    H.group.add(dust.points);
    H.updaters.push((dt, t) => dust.update(dt, t));
    H.prints = { color: [0.8, 0.72, 0.6], life: 9 };
    return H;
  },

  // 북극 — snow, an igloo, and the northern lights at night
  arctic(r) {
    const H = habitat('arctic', r, {
      day: { sky: '#f4f9ff', ground: '#c4dbf8', hemi: 1.95, sun: '#fff5e6', sunI: 2.1, pos: [-3.4, 6, 1.8], bg: '#edf4fe' },
      night: { sky: '#7fe8c8', ground: '#22305a', hemi: 1.25, sun: '#bfd0ff', sunI: 0.9, bg: '#93a9d6' },
    });
    H.group.add(
      (H.ground = groundMesh((g, s) => {
        g.fillStyle = '#edf4fe';
        g.fillRect(0, 0, s, s);
        blotches(g, s, r, 90, ['#dfebfa', '#ffffff', '#d6e6f9', '#f6faff'], 80, 260, 0.25);
        dots(g, s, r, 420, ['#ffffff', '#f4f9ff'], 0.8, 2, 0.9);
        strokes(g, s, r, 160, ['#cfe0f5'], 20, 60, 1.5, 0.2, 0.25, 0.35);
      }))
    );
    const b = new Scenery();
    const snow = ['#dbe8f8', '#ffffff'];
    // igloo
    b.add(new THREE.IcosahedronGeometry(0.72, 2), { at: [-1.75, -0.04, -2.0], scale: [1, 0.86, 1], color: snow, flat: true });
    b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 10, 1, false, 0, Math.PI), { at: [-1.3, 0, -1.48], rot: [0, 0.72, Math.PI / 2], color: snow, flat: true });
    b.add(new THREE.CircleGeometry(0.2, 12, 0, Math.PI), { at: [-1.12, 0, -1.3], rot: [0, 0.72, 0], color: '#3a4a6b' });
    foot(-1.75, -2.0, 0.7);
    foot(-1.28, -1.47, 0.3);
    for (const [x, z, s] of [[2.6, -2.3, 0.9], [0.5, -2.9, 0.75], [-3.0, -0.2, 0.7], [3.0, 0.6, 0.6], [-2.5, 1.2, 0.45]]) mound(b, x, z, s, s * 0.8, s * 0.42, snow);
    tree(b, r, 1.55, -2.45, { s: 1.05, kind: 'pine', snow: true, leaves: ['#2b6b52', '#4f9a78'] });
    tree(b, r, 2.75, -1.25, { s: 0.85, kind: 'pine', snow: true, leaves: ['#2b6b52', '#4f9a78'] });
    // a snowman keeps the fox company
    snowman(b, 2.05, 0.35);
    // out in the country: a frozen lake with a hole to fish through, more igloos, pinnacles of ice, snowmen
    const q = (i) => rng(4409 + i * 977);
    place(4.5, 1.6, () => {
      pond(H, b, q(1), 4.5, 1.6, 1.35, { ice: true, stone: snow });
      b.add(new THREE.CircleGeometry(0.16, 14), { at: [4.9, 0.012, 1.8], rot: [-Math.PI / 2, 0, 0], color: '#2f5f8f' });
      b.add(new THREE.CylinderGeometry(0.008, 0.008, 0.5, 4), { at: [4.7, 0.2, 1.9], rot: [0, 0, -0.9], color: '#7a5238' });
    });
    place(-4.7, -1.6, () => {
      clearing(-4.7, -1.6, 2.0);
      igloo(b, -5.2, -2.0, 1.0, 0.5);
      igloo(b, -3.9, -1.6, 0.75, -0.3);
      snowman(b, -4.6, -0.7, '#5aa9ff');
    });
    place(0.4, -4.4, () => {
      clearing(0.4, -4.4, 1.3);
      foot(0.4, -4.4, 0.75);
    });
    place(-3.9, 2.0, () => {
      clearing(-3.9, 2.0, 1.2);
      snowman(b, -4.2, 1.9, '#7ad06a');
      snowman(b, -3.6, 2.2, '#ffb84a');
      mound(b, -3.9, 1.3, 0.8, 0.5, 0.3, snow);
    });
    place(5.0, -1.5, () => boulders(b, q(5), 5.0, -1.5, 0.7, ['#8a97ab', '#c9d6ea'], true));
    surround(
      r,
      (x, z, k) => {
        if (r() < 0.5) tree(b, r, x, z, { s: 0.95 * k, kind: 'pine', snow: true, leaves: ['#2b6b52', '#4f9a78'] });
        else mound(b, x, z, 0.9 * k, 0.75 * k, 0.16 * k, snow, true);
      },
      (x, z, k) => b.add(new THREE.SphereGeometry(1, 12, 8), { at: [x, -0.03, z], scale: [0.3 * k, 0.13 * k, 0.26 * k], color: snow }),
      { nTall: 34, nLow: 70 }
    );
    H.group.add((H.scenery = b.mesh()));
    // ice: translucent shards and a frozen pool
    const ice = new Batch();
    for (const [x, z, h, s] of [[-2.25, 0.3, 0.55, 0.16], [-2.0, 0.52, 0.34, 0.12], [-2.45, 0.6, 0.26, 0.1], [0.95, -2.2, 0.4, 0.13], [0.72, -2.05, 0.24, 0.1]]) {
      ice.add(new THREE.OctahedronGeometry(1, 0), { at: [x, h * 0.42, z], rot: [r.range(-0.2, 0.2), r() * 3, r.range(-0.2, 0.2)], scale: [s, h, s], color: ['#9fd4ff', '#eaf7ff'], flat: true });
      foot(x, z, s);
    }
    // (the pinnacles of ice in the north: taller than a fox)
    if (!NOW.small) {
      for (const [dx, dz, h, s] of [[0, 0, 1.5, 0.34], [-0.45, 0.2, 0.9, 0.24], [0.42, 0.15, 1.1, 0.26], [0.1, 0.5, 0.55, 0.18], [-0.2, -0.4, 0.75, 0.2]]) {
        ice.add(new THREE.OctahedronGeometry(1, 0), { at: [0.4 + dx, h * 0.42, -4.4 + dz], rot: [r.range(-0.15, 0.15), r() * 3, 0.1], scale: [s, h, s], color: ['#8fc8f8', '#f2fbff'], flat: true });
      }
    }
    const iceMesh = ice.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.82, roughness: 0.12, metalness: 0.1 }));
    H.group.add(iceMesh);
    const pool = new THREE.Mesh(new THREE.CircleGeometry(0.62, 28), new THREE.MeshStandardMaterial({ color: '#bfe4ff', roughness: 0.08, metalness: 0.25, transparent: true, opacity: 0.9 }));
    pool.rotation.x = -Math.PI / 2;
    pool.scale.set(1.25, 0.8, 1);
    pool.position.set(-0.25, 0.006, -2.1);
    pool.receiveShadow = true;
    H.group.add(pool);
    foot(-0.25, -2.1, 0.5);
    // ice dust glittering in the air (the snow that falls is the weather's: sky.js)
    const flakes = new Drift(r, { count: 110, colors: ['#ffffff', '#eaf4ff'], fall: 0.1, sway: 0.16, wind: 0.05, size: 0.03, opacity: 0.8 });
    H.group.add(flakes.points);
    H.updaters.push((dt, t) => flakes.update(dt, t));
    // the aurora colours the night
    H.updaters.push((dt, t, world) => {
      if (world.night) world.hemi.color.setHSL(0.42 + Math.sin(t * 0.25) * 0.14, 0.75, 0.74);
    });
    H.prints = { color: [0.76, 0.83, 0.94], life: 14 };
    H.snow = true;
    // out of the snow: in the lee of the igloo, to either side of its way in
    H.shelters.push({ spots: [{ x: -0.91, z: -1.82, yaw: 0.9 }, { x: -1.69, z: -1.14, yaw: 0.3 }] });
    return H;
  },

  // 산 — an autumn mountainside
  mountain(r) {
    const H = habitat('mountain', r, {
      day: { sky: '#f6fbff', ground: '#b3a57e', hemi: 1.8, sun: '#ffe2b6', sunI: 2.55, pos: [-3.6, 5.6, 1.4], bg: '#a9a877' },
      night: { ground: '#2a2a3a', bg: '#3d4257' },
    });
    H.group.add(
      (H.ground = groundMesh((g, s) => {
        g.fillStyle = '#b3b07e';
        g.fillRect(0, 0, s, s);
        blotches(g, s, r, 90, ['#8f9a5c', '#b9ad88', '#7f8c52', '#c2b48f', '#9aa468'], 70, 240, 0.24);
        strokes(g, s, r, 2600, ['#7d8b4e', '#a3ae6c', '#6f7d45'], 5, 12, 1.6, -Math.PI / 2, 0.6, 0.7);
        dots(g, s, r, 520, ['#8a8a86', '#b5b2a8', '#6f6f6c'], 1.2, 4, 0.8);
        dots(g, s, r, 190, ['#d9482b', '#f08a24', '#f6c33c', '#b83a1f'], 2.2, 4.5, 0.95);
      }))
    );
    const b = new Scenery();
    const gray = ['#6f727a', '#b4b7be'];
    rock(b, r, -2.2, -2.2, 0.62, gray);
    rock(b, r, -1.45, -2.55, 0.4, gray);
    rock(b, r, 2.75, -1.9, 0.55, gray);
    rock(b, r, 2.3, 0.75, 0.24, gray);
    rock(b, r, -2.55, 0.4, 0.3, gray);
    rock(b, r, 0.9, -2.3, 0.2, gray);
    rock(b, r, -2.1, 1.15, 0.13, gray);
    const maple = (x, z, s, leaves) => tree(b, r, x, z, { s, leaves, trunk: ['#4f362b', '#6f4e3e'], puffs: 6 });
    maple(-0.45, -2.2, 1.2, ['#c8371f', '#ff7a3d']);
    maple(1.85, -2.35, 1.05, ['#e07a1c', '#ffc94d']);
    maple(-2.95, -0.9, 0.95, ['#b82f25', '#f0623a']);
    tree(b, r, 3.0, -0.5, { s: 0.95, kind: 'pine', leaves: ['#2f6f4a', '#58a070'] });
    // a stone tower, like the ones hikers build along Korean trails
    let y = 0;
    [[0.15, 0.07], [0.125, 0.06], [0.1, 0.055], [0.08, 0.045], [0.058, 0.04], [0.04, 0.03], [0.026, 0.024]].forEach(([rad, h], i) => {
      b.add(new THREE.IcosahedronGeometry(rad, 1), { at: [2.02 + (i % 2 ? 0.008 : -0.006), y + h * 0.5, -0.92], rot: [0, r() * 3, 0], scale: [1, h / rad, 0.92], color: i % 2 ? ['#77797f', '#a9acb3'] : ['#8a8780', '#bdb9ae'], flat: true });
      y += h * 0.92;
    });
    // trail sign
    b.add(new THREE.BoxGeometry(0.04, 0.42, 0.04), { at: [-1.98, 0.21, -1.42], color: ['#6b4631', '#8f6247'] });
    b.add(new THREE.BoxGeometry(0.3, 0.1, 0.025), { at: [-1.9, 0.36, -1.4], rot: [0, 0.25, 0.04], color: '#d9b38a' });
    bush(b, r, -1.2, 1.35, 0.16, ['#a9541f', '#e8923a']);
    bush(b, r, 1.6, 1.2, 0.15, ['#8a8f3d', '#c9c95c']);
    foot(-1.98, -1.42, 0.06);
    // out in the country: a mountain tarn, a camp, a field of boulders, stone towers along the trail
    const q = (i) => rng(9311 + i * 977);
    const turn = q(9);
    const tower = (tx, tz, k) => {
      let ty = 0;
      foot(tx, tz, 0.17 * k);
      [[0.15, 0.07], [0.125, 0.06], [0.1, 0.055], [0.08, 0.045], [0.058, 0.04], [0.04, 0.03], [0.026, 0.024]].forEach(([rad, h], i) => {
        b.add(new THREE.IcosahedronGeometry(rad * k, 1), { at: [tx + (i % 2 ? 0.008 : -0.006), ty + h * k * 0.5, tz], rot: [0, turn() * 3, 0], scale: [1, h / rad, 0.92], color: i % 2 ? ['#77797f', '#a9acb3'] : ['#8a8780', '#bdb9ae'], flat: true });
        ty += h * k * 0.92;
      });
    };
    place(4.9, -1.4, () => pond(H, b, q(1), 4.9, -1.4, 1.2, { color: '#4f9fc4', stone: gray }));
    place(-4.7, -1.2, () => camp(b, q(2), -4.7, -1.2));
    place(0.3, -4.5, () => boulders(b, q(3), 0.3, -4.5, 1.3, gray));
    place(3.6, 1.9, () => {
      clearing(3.6, 1.9, 1.3);
      for (const [dx, dz, k] of [[0, 0, 1.5], [0.55, 0.3, 1.0], [-0.5, 0.25, 1.2], [0.2, 0.7, 0.8], [-0.2, -0.55, 0.9]]) tower(3.6 + dx, 1.9 + dz, k);
    });
    place(-4.0, 2.1, () => {
      clearing(-4.0, 2.1, 1.2);
      stumps(b, q(5), -4.0, 2.1);
    });
    place(-3.4, -3.7, () => {
      clearing(-3.4, -3.7, 1.5);
      tree(b, q(6), -3.4, -3.7, { s: 2.1, leaves: ['#d9a21c', '#ffe27a'], trunk: ['#4f362b', '#6f4e3e'], puffs: 8 });
    });
    const autumn = [['#c8371f', '#ff7a3d'], ['#e07a1c', '#ffc94d'], ['#b82f25', '#f0623a'], ['#d9a21c', '#ffe27a']];
    surround(
      r,
      (x, z, k) => {
        const pick = r();
        if (pick < 0.5) maple(x, z, k, r.pick(autumn));
        else if (pick < 0.7) tree(b, r, x, z, { s: 0.95 * k, kind: 'pine', leaves: ['#2f6f4a', '#58a070'] });
        else rock(b, r, x, z, 0.5 * k, gray);
      },
      (x, z, k) => {
        if (r() < 0.55) rock(b, r, x, z, 0.14 * k, gray);
        else bush(b, r, x, z, 0.15 * k, r() < 0.5 ? ['#a9541f', '#e8923a'] : ['#8a8f3d', '#c9c95c']);
      }
    );
    H.group.add((H.scenery = b.mesh()));
    H.group.add(
      grassField(r, 190, () => {
        const [x, z] = edgeSpot(r, 1.0, 2.1);
        return [x, z, r.range(0.05, 0.11)];
      }, ['#a8a85a', '#8f9a4c', '#c4b860', '#b98f48'], H.clock)
    );
    H.group.add(grassField(r, wide(380), () => [...farSpot(r), r.range(0.05, 0.12)], ['#a8a85a', '#8f9a4c', '#c4b860', '#b98f48'], H.clock));
    const leaves = new Drift(r, { count: 90, colors: ['#d9482b', '#f08a24', '#f6c33c'], fall: 0.22, sway: 0.4, wind: 0.12, size: 0.065, tex: petalTexture() });
    H.group.add(leaves.points);
    H.updaters.push((dt, t) => leaves.update(dt, t));
    H.spots.mic.set(0.95, 0, -1.0);
    H.obstacles.push({ x: 2.02, z: -0.92, r: 0.26 });
    H.litter = '🍂';
    // out of the rain: under the maples
    H.shelters.push(under(-0.45, -2.2, 1.2, [[0, 0.5], [0.7, 0.5], [-0.7, 0.5], [0.35, 0.66], [-0.35, 0.66]]), under(1.85, -2.35, 1.05, [[-0.35, 0.5], [-1.0, 0.5], [0.25, 0.5]]));
    H.obstacles.push({ x: -0.45, z: -2.2, r: 0.12 }, { x: 1.85, z: -2.35, r: 0.1 });
    return H;
  },

  // 농장 — a barn, a fence, a vegetable patch and three curious chicks. It follows the year (FARM).
  farm(r, season) {
    const P = FARM[season] || FARM.autumn;
    const snowy = !!P.snow;
    const H = habitat('farm', r, { day: P.day, night: P.night });
    H.group.add((H.ground = seasonGround(FARM.autumn, P, r, 4242)));
    const b = new Scenery();
    // barn: hollow, its doors swung wide — in the doorway there is room for a family to sit out the rain
    const bx = -2.05;
    const bz = -2.35;
    const turn = 0.2;
    const cs = Math.cos(turn);
    const sn = Math.sin(turn);
    const BW = 1.5;
    const BH = 0.95;
    const BD = 1.1;
    const T = 0.05;
    const DW = 1.06; // the doorway
    const DH = 0.68;
    const barn = (x, y, z) => [bx + x * cs + z * sn, y, bz - x * sn + z * cs]; // a point of the barn's own space, in the habitat
    const red = (p) => _c.set('#b5332d').lerp(_c2.set('#d9483f'), p.y / BH);
    const part = (w, h, d, x, y, z, color = red, yaw = 0) => b.add(new THREE.BoxGeometry(w, h, d), { at: barn(x, y, z), rot: [0, turn + yaw, 0], color });
    part(BW, BH, T, 0, BH / 2, -BD / 2 + T / 2);
    part(DW, BH - DH, T, 0, (BH + DH) / 2, BD / 2 - T / 2);
    part(DW + 0.13, 0.05, 0.035, 0, DH + 0.025, BD / 2 + 0.012, '#f7ead7');
    part(BW - 2 * T, 0.012, BD - 2 * T, 0, 0.006, 0, ['#8a6a3c', '#b08a52']); // straw on the floor
    for (const sx of [1, -1]) {
      part(T, BH, BD - 2 * T, (sx * (BW - T)) / 2, BH / 2, 0);
      part((BW - DW) / 2, BH, T, (sx * (BW + DW)) / 4, BH / 2, BD / 2 - T / 2);
      part(0.05, DH + 0.03, 0.035, sx * (DW / 2 + 0.012), (DH + 0.03) / 2, BD / 2 + 0.012, '#f7ead7');
      // a door leaf, open as far as it goes
      const open = sx * 0.78;
      const lx = sx * (DW / 2 + 0.03) + Math.sin(open) * 0.265;
      const lz = BD / 2 + 0.02 + Math.cos(open) * 0.265;
      part(0.03, DH * 0.94, 0.53, lx, DH * 0.47, lz, '#8f2f2a', open);
      for (const y of [0.1, 0.5]) part(0.04, 0.04, 0.5, lx, y * 1 + 0.02, lz, '#f7ead7', open);
    }
    // the roof: a three-sided prism laid along the barn, its ridge up
    b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.62, 3, 1), { at: [bx, 1.137, bz], rot: [-Math.PI / 2, Math.PI / 2 + 0.2, 0, 'YXZ'], scale: [1, 1, 0.5], color: ['#6e2622', '#8f3630'], flat: true });
    if (snowy) b.add(new THREE.CylinderGeometry(0.75, 0.75, 1.56, 3, 1), { at: [bx, 1.172, bz], rot: [-Math.PI / 2, Math.PI / 2 + 0.2, 0, 'YXZ'], scale: [0.985, 1, 0.5], color: SNOW, flat: true });
    // (the ground its walls take — the doorway stays open)
    for (const [x1, z1, x2, z2] of [[-BW / 2, -BD / 2, BW / 2, -BD / 2], [-BW / 2, -BD / 2, -BW / 2, BD / 2], [BW / 2, -BD / 2, BW / 2, BD / 2]]) {
      const [ax, , az] = barn(x1, 0, z1);
      const [cx, , cz] = barn(x2, 0, z2);
      footLine(ax, az, cx, cz, 0.1);
    }
    fence(b, -0.95, -2.05, 2.75, -2.05, undefined, snowy);
    fence(b, 2.75, -2.05, 2.75, 0.2, undefined, snowy);
    // hay bales
    const hay = ['#d6b04a', '#f4dc86'];
    foot(1.95, -1.6, 0.26);
    foot(2.3, -1.1, 0.26);
    foot(-0.25, -1.82, 0.22);
    b.add(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 14), { at: [1.95, 0.24, -1.6], rot: [0, 0.4, Math.PI / 2], color: hay });
    b.add(new THREE.CylinderGeometry(0.24, 0.24, 0.36, 14), { at: [2.3, 0.24, -1.1], rot: [0, 1.3, Math.PI / 2], color: hay });
    b.add(new THREE.CylinderGeometry(0.2, 0.2, 0.3, 14), { at: [2.1, 0.62, -1.38], rot: [0, 0.8, Math.PI / 2], color: hay });
    if (snowy) {
      snowCap(b, 2.3, 0.47, -1.1, 0.2, 0.3);
      snowCap(b, 2.1, 0.81, -1.38, 0.18, 0.3);
    }
    // vegetable patch
    const grown = P.crops === 'grown' ? b : NOTHING;
    const sprout = (x, z, s = 1) => {
      for (const k of [-1, 1]) b.add(new THREE.ConeGeometry(0.012 * s, 0.05 * s, 4), { at: [x + k * 0.008 * s, 0.07, z], rot: [0, 0, k * -0.5], color: '#7ccf5e' });
    };
    for (let row = 0; row < 3; row++) {
      const z = 0.55 + row * 0.3;
      b.add(new THREE.BoxGeometry(1.15, 0.05, 0.19), { at: [-1.95, 0.025, z], color: ['#6b4a33', '#8a6244'] });
      if (snowy) b.add(new THREE.BoxGeometry(1.19, 0.035, 0.22, 8, 1, 1), { at: [-1.95, 0.062, z], color: SNOW });
      for (let i = 0; i < 5; i++) {
        const x = -2.42 + i * 0.235;
        if (row === 0) {
          grown.add(new THREE.IcosahedronGeometry(0.075, 1), { at: [x, 0.09, z], rot: [r(), r() * 3, 0], scale: [1, 0.78, 1], color: ['#5aa84f', '#a9e08f'], flat: true });
        } else if (row === 1) {
          grown.add(new THREE.ConeGeometry(0.028, 0.06, 6), { at: [x, 0.07, z], rot: [Math.PI, 0, 0], color: '#ff8a2a' });
          for (let k = 0; k < 3; k++) grown.add(new THREE.ConeGeometry(0.014, 0.1, 4), { at: [x + (k - 1) * 0.02, 0.14, z], rot: [0, 0, (k - 1) * -0.4], color: '#58b04e' });
        } else {
          grown.add(new THREE.SphereGeometry(0.03, 8, 6), { at: [x, 0.11, z], color: '#e9433f' });
          grown.add(new THREE.CylinderGeometry(0.005, 0.005, 0.12, 4), { at: [x, 0.06, z], color: '#4f9a4a' });
        }
        if (P.crops === 'sprouts') sprout(x, z, row === 0 ? 1.2 : 1);
      }
    }
    // pumpkins
    if (P.pumpkins) {
      const [one, other] = P.pumpkins.tones;
      for (const [x, z, s0] of [[1.75, 1.05, 0.13], [2.02, 0.85, 0.1], [1.52, 1.25, 0.085]]) {
        const s = s0 * P.pumpkins.k;
        b.add(new THREE.SphereGeometry(s, 12, 8), { at: [x, s * 0.72, z], scale: [1, 0.74, 1], color: (p, n) => _c.set(Math.floor(((Math.atan2(n.z, n.x) / TAU + 0.5) * 10) % 2) ? one : other) });
        b.add(new THREE.CylinderGeometry(s * 0.1, s * 0.14, s * 0.4, 5), { at: [x, s * 1.5, z], color: '#5a8a3c' });
      }
    }
    // sunflowers along the fence (in spring: what will be sunflowers)
    for (const x of [0.2, 0.75, 1.3]) {
      const h = r.range(0.5, 0.68);
      if (P.stalks === 'flowers') {
        b.add(new THREE.CylinderGeometry(0.012, 0.014, h, 5), { at: [x, h / 2, -1.95], color: '#4f9a4a' });
        b.add(new THREE.CylinderGeometry(0.11, 0.11, 0.02, 12), { at: [x, h, -1.9], rot: [1.15, 0, 0], color: '#ffcf33' });
        b.add(new THREE.CylinderGeometry(0.055, 0.055, 0.03, 10), { at: [x, h + 0.004, -1.893], rot: [1.15, 0, 0], color: '#6b4226' });
        b.add(new THREE.SphereGeometry(0.05, 6, 4), { at: [x + 0.05, h * 0.5, -1.93], scale: [1.4, 0.2, 0.7], color: '#58b04e' });
      } else if (P.stalks === 'sprouts') {
        b.add(new THREE.CylinderGeometry(0.008, 0.01, h * 0.3, 5), { at: [x, h * 0.15, -1.95], color: '#4f9a4a' });
        for (const k of [-1, 1]) b.add(new THREE.SphereGeometry(0.04, 6, 4), { at: [x + k * 0.035, h * 0.3, -1.95], rot: [0, 0, k * 0.5], scale: [1.2, 0.22, 0.7], color: '#6cc45a' });
      }
    }
    // water trough
    b.add(new THREE.BoxGeometry(0.5, 0.14, 0.24), { at: [-0.25, 0.07, -1.82], color: ['#7a5238', '#a37550'] });
    b.add(new THREE.BoxGeometry(0.44, 0.02, 0.18), { at: [-0.25, 0.135, -1.82], color: P.water });
    if (snowy) for (const sx of [1, -1]) b.add(new THREE.BoxGeometry(0.03, 0.02, 0.25), { at: [-0.25 + sx * 0.24, 0.15, -1.82], color: '#ffffff' });
    const fruit = P.apples ? b : NOTHING;
    const apple = P.apples || { color: '#e9433f', k: 1 };
    // out in the country: a windmill, a duck pond, a field with a scarecrow, haystacks, a well
    const q = (i) => rng(4242 + i * 977);
    place(4.9, -2.3, () => windmill(H, b, 4.9, -2.3, 1.3, { snow: snowy }));
    place(-5.0, -0.4, () => pond(H, b, q(1), -5.0, -0.4, 1.1, { ice: snowy }));
    place(4.6, 0.9, () => {
      clearing(4.6, 0.9, 1.7);
      scarecrow(b, 4.6, 0.6);
      for (let row = 0; row < 4; row++) {
        const z = 0.2 + row * 0.42;
        b.add(new THREE.BoxGeometry(2.4, 0.05, 0.2), { at: [4.6, 0.025, z], color: ['#6b4a33', '#8a6244'] });
        if (snowy) b.add(new THREE.BoxGeometry(2.44, 0.035, 0.23), { at: [4.6, 0.062, z], color: SNOW });
        for (let i = 0; i < 10; i++) {
          const x = 3.52 + i * 0.24;
          if (Math.abs(x - 4.6) < 0.15 && row === 1) continue;
          grown.add(new THREE.IcosahedronGeometry(0.075, 1), { at: [x, 0.09, z], rot: [q(2)(), q(2)() * 3, 0], scale: [1, 0.78, 1], color: row % 2 ? ['#5aa84f', '#a9e08f'] : ['#7a4fa0', '#c9a0e8'], flat: true });
          if (P.crops === 'sprouts') sprout(x, z, 1.1);
        }
      }
    });
    place(0.4, -4.5, () => {
      clearing(0.4, -4.5, 1.5);
      haystack(b, 0.4, -4.5, 1.3, snowy);
      haystack(b, 1.2, -4.1, 0.95, snowy);
      haystack(b, -0.4, -4.0, 1.05, snowy);
    });
    place(-3.6, -3.7, () => well(b, -3.6, -3.7, snowy));
    place(-4.2, 2.1, () => flowerField(P.wild ? b : NOTHING, q(6), -4.2, 2.1, 1.3, 0.8, 90, P.wild || SNOW));
    surround(
      r,
      (x, z, k) => {
        const pick = r();
        if (pick < 0.6) {
          // an orchard tree: in blossom, with apples, or bare
          tree(b, r, x, z, snowy ? { s: 0.9 * k, bare: true } : { s: 0.9 * k, leaves: P.orchard });
          for (let i = 0; i < 5; i++) fruit.add(new THREE.SphereGeometry(0.035 * k * apple.k, 6, 5), { at: [x + r.range(-0.3, 0.3) * k, r.range(0.55, 0.85) * k, z + r.range(0.1, 0.34) * k], color: apple.color });
        } else if (pick < 0.85) {
          const yaw = r() * 3;
          b.add(new THREE.CylinderGeometry(0.24 * k, 0.24 * k, 0.36 * k, 14), { at: [x, 0.24 * k, z], rot: [0, yaw, Math.PI / 2], color: hay });
          foot(x, z, 0.26 * k);
          if (snowy) snowCap(b, x, 0.47 * k, z, 0.2 * k, 0.3);
        } else bush(b, r, x, z, 0.25 * k, P.thicket);
      },
      (x, z, k) => {
        if (r() < 0.5) {
          // a short row of cabbages
          const yaw = r() * 3;
          for (let i = -2; i <= 2; i++) {
            const at = [x + Math.cos(yaw) * i * 0.2, 0.06, z + Math.sin(yaw) * i * 0.2];
            grown.add(new THREE.IcosahedronGeometry(0.07 * k, 1), { at, rot: [r(), r() * 3, 0], scale: [1, 0.78, 1], color: ['#5aa84f', '#a9e08f'], flat: true });
            if (P.crops === 'sprouts') sprout(at[0], at[2], 1.1);
            else if (snowy) b.add(new THREE.SphereGeometry(0.075 * k, 8, 6), { at: [at[0], 0.02, at[2]], scale: [1, 0.5, 1], color: SNOW });
          }
        } else flowerPatch(P.wild ? b : NOTHING, r, x, z, 4, P.wild || SNOW);
      },
      { nTall: 30, nLow: 80 }
    );
    H.group.add((H.scenery = b.mesh()));
    // it is dark in the barn
    const liner = new THREE.Mesh(new THREE.BoxGeometry(BW - 2 * T - 0.006, BH - 0.012, BD - 2 * T - 0.006), new THREE.MeshBasicMaterial({ color: '#3b2320', side: THREE.BackSide }));
    liner.position.set(bx, BH / 2 + 0.004, bz);
    liner.rotation.y = turn;
    H.group.add(liner);
    const tufts = P.tufts || 1;
    const low = P.low || 1;
    H.group.add(
      grassField(r, Math.round(150 * tufts), () => {
        const [x, z] = edgeSpot(r, 1.05, 2);
        return z > 0.3 && x < -1.2 ? null : [x, z, r.range(0.05, 0.1) * low];
      }, P.grass, H.clock)
    );
    H.group.add(grassField(r, wide(Math.round(360 * tufts)), () => [...farSpot(r), r.range(0.05, 0.12) * low], P.grass, H.clock));
    // chicks
    const chicks = new THREE.Group();
    const yellow = new THREE.MeshLambertMaterial({ color: '#ffdf5a' });
    const orange = new THREE.MeshLambertMaterial({ color: '#ff9a3c' });
    const dark = new THREE.MeshBasicMaterial({ color: '#2a2020' });
    const list = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), yellow);
      body.position.y = 0.045;
      body.scale.set(1, 0.9, 1.15);
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), yellow);
      head.position.set(0, 0.092, 0.03);
      const beak = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.022, 5), orange);
      beak.rotation.x = Math.PI / 2;
      beak.position.set(0, 0.09, 0.066);
      for (const s of [1, -1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.005, 5, 4), dark);
        eye.position.set(0.016 * s, 0.1, 0.055);
        g.add(eye);
      }
      body.castShadow = head.castShadow = true;
      g.add(body, head, beak);
      g.position.set(r.range(0.4, 1.9), 0, r.range(-1.6, -1.2));
      chicks.add(g);
      list.push({ g, tx: g.position.x, tz: g.position.z, wait: r.range(0, 3), seed: r() * 10 });
    }
    H.group.add(chicks);
    H.updaters.push((dt, t, world) => {
      const k = world.yard || 1; // the habitat is drawn this much larger for a big family; the chicks live in its own measure
      list.forEach((c) => {
        const p = c.g.position;
        // run from a fox that comes too close
        let fox = null;
        for (const f of world.foxes || []) {
          const x = f.anim.pos.x / k;
          const z = f.anim.pos.z / k;
          if (Math.hypot(x - p.x, z - p.z) < 0.6) fox = { x, z };
        }
        if (fox) {
          const a = Math.atan2(p.x - fox.x, p.z - fox.z) + Math.sin(t + c.seed) * 0.6;
          c.tx = Math.max(-0.6, Math.min(2.5, p.x + Math.sin(a) * 0.9));
          c.tz = Math.max(-1.85, Math.min(1.0, p.z + Math.cos(a) * 0.9));
          c.wait = 0;
          c.fast = 1;
        }
        const dx = c.tx - p.x;
        const dz = c.tz - p.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.03 && c.wait <= 0) {
          const sp = c.fast ? 1.2 : 0.28;
          p.x += (dx / d) * Math.min(d, sp * dt);
          p.z += (dz / d) * Math.min(d, sp * dt);
          c.g.rotation.y = Math.atan2(dx, dz);
          p.y = Math.abs(Math.sin(t * (c.fast ? 22 : 12) + c.seed)) * 0.025;
        } else {
          p.y = 0;
          c.fast = 0;
          c.wait -= dt;
          c.g.rotation.x = Math.max(0, Math.sin(t * 5 + c.seed)) * 0.5; // pecking
          if (c.wait < -r.range(1.5, 4)) {
            c.tx = r.range(-0.4, 2.3);
            c.tz = r.range(-1.75, -1.15);
            c.wait = 0;
            c.g.rotation.x = 0;
          }
        }
      });
    });
    H.spots.bed.set(-1.0, 0, -0.95);
    H.spots.mic.set(1.0, 0, -0.75);
    if (snowy) {
      H.prints = { ...WINTER_PRINTS };
      H.snow = true;
    }
    // out of the rain: lying in the doorway of the barn, three in front and two looking out between them
    const door = (x, z) => {
      const [wx, , wz] = barn(x, 0, BD / 2 + z);
      return { x: wx, z: wz, yaw: turn, lie: true };
    };
    const [vx, , vz] = barn(0, 0, BD / 2 + 0.62);
    H.shelters.push({ via: { x: vx, z: vz }, spots: [door(0, -0.02), door(0.34, -0.02), door(-0.34, -0.02), door(0.17, -0.3), door(-0.17, -0.3)] });
    return H;
  },

  // 벚꽃 동산 — petals in the air, a picnic under the trees
  cherry(r) {
    const H = habitat('cherry', r, {
      day: { sky: '#fff6fb', ground: '#cfe6b6', hemi: 2.0, sun: '#ffeedd', sunI: 2.15, pos: [-3.4, 6, 1.8], bg: '#a6d688' },
      night: { sky: '#b0a4ff', ground: '#2a2440', bg: '#4a4470' },
    });
    H.group.add(
      (H.ground = groundMesh((g, s) => {
        g.fillStyle = '#a6d688';
        g.fillRect(0, 0, s, s);
        blotches(g, s, r, 90, ['#b9e29a', '#93c877', '#c6eaa6', '#8ac06e'], 70, 240, 0.22);
        strokes(g, s, r, 4200, ['#84bd68', '#bfe79f', '#77b15d', '#a9d98a'], 6, 14, 1.7);
        dots(g, s, r, 900, ['#ffc4df', '#ffe0ee', '#ff9ecb', '#ffffff'], 1.8, 3.6, 0.95);
      }))
    );
    const b = new Scenery();
    const blossom = (x, z, s) => tree(b, r, x, z, { s, h: 1.05, trunk: ['#3f2a2a', '#5f4040'], leaves: ['#ff9ecb', '#ffe1ef'], puffs: 7 });
    blossom(-1.6, -1.95, 1.4);
    blossom(2.0, -2.3, 1.2);
    blossom(-3.0, -0.3, 1.0);
    blossom(0.2, -3.0, 1.1);
    // stone lantern
    const lx = 2.1;
    const lz = -0.75;
    const stone = ['#8d9096', '#c4c7cc'];
    b.add(new THREE.CylinderGeometry(0.11, 0.13, 0.05, 6), { at: [lx, 0.025, lz], color: stone, flat: true });
    b.add(new THREE.CylinderGeometry(0.04, 0.05, 0.26, 6), { at: [lx, 0.18, lz], color: stone, flat: true });
    b.add(new THREE.CylinderGeometry(0.1, 0.07, 0.04, 6), { at: [lx, 0.33, lz], color: stone, flat: true });
    b.add(new THREE.BoxGeometry(0.12, 0.11, 0.12), { at: [lx, 0.405, lz], color: '#fff0c2' });
    b.add(new THREE.ConeGeometry(0.16, 0.1, 6), { at: [lx, 0.51, lz], color: stone, flat: true });
    b.add(new THREE.SphereGeometry(0.025, 8, 6), { at: [lx, 0.575, lz], color: stone[1] });
    // stepping stones
    for (let i = 0; i < 6; i++) {
      b.add(new THREE.CylinderGeometry(0.13, 0.14, 0.02, 9), { at: [-2.6 + i * 0.36, 0.01, 1.42 - i * 0.07 + Math.sin(i * 1.7) * 0.05], rot: [0, r() * 3, 0], scale: [r.range(0.9, 1.2), 1, r.range(0.8, 1)], color: stone, flat: true });
    }
    // picnic mat with a basket
    const mat = new THREE.PlaneGeometry(0.8, 0.6, 8, 6).toNonIndexed();
    b.add(mat, {
      at: [-2.05, 0.012, 0.55],
      rot: [-Math.PI / 2, 0, 0.25],
      byFace: true,
      color: (p) => {
        // checks in the mat's own frame (it lies turned by 0.25 rad)
        const dx = p.x + 2.05;
        const dz = -(p.z - 0.55);
        const u = dx * Math.cos(0.25) + dz * Math.sin(0.25);
        const v = -dx * Math.sin(0.25) + dz * Math.cos(0.25);
        return _c.set((Math.floor((u + 0.4) / 0.1 + 1e-4) + Math.floor((v + 0.3) / 0.1 + 1e-4)) % 2 ? '#ff8fbd' : '#fff6fa');
      },
    });
    b.add(new THREE.CylinderGeometry(0.1, 0.085, 0.1, 12), { at: [-2.2, 0.06, 0.45], color: ['#b9824f', '#e2b47e'] });
    b.add(new THREE.TorusGeometry(0.085, 0.01, 5, 14, Math.PI), { at: [-2.2, 0.11, 0.45], rot: [0, 0.6, 0], color: '#b9824f' });
    for (const [dx, dz, c] of [[0.18, 0.12, '#ffb3d1'], [0.24, 0.06, '#ffffff'], [0.21, 0.01, '#b8e0a0']]) b.add(new THREE.SphereGeometry(0.026, 8, 6), { at: [-2.05 + dx, 0.04, 0.6 + dz], color: c });
    flowerPatch(b, r, 1.75, 0.95, 8, ['#ff9ecb', '#ffffff', '#ffd0e4']);
    flowerPatch(b, r, -0.6, -2.0, 6, ['#ffffff', '#ffd0e4']);
    flowerPatch(b, r, 2.5, 0.1, 5, ['#ff9ecb', '#fff3a8']);
    foot(-2.2, 0.45, 0.12);
    // out in the country: a pond with a red bridge over it, a pavilion, a walk of stone lanterns, a field of flowers
    const q = (i) => rng(3571 + i * 977);
    const lantern = (x, z) => stoneLantern(b, x, z, stone);
    place(4.9, -1.3, () => {
      pond(H, b, q(1), 4.9, -1.3, 1.25, { lily: '#ff9ecb' });
      // the bridge: half a ring, flattened to an arch and drawn out to a deck
      b.add(new THREE.TorusGeometry(0.95, 0.045, 5, 18, Math.PI), { at: [4.9, 0, -1.3], scale: [1, 0.36, 5.5], color: ['#c93a35', '#e8605a'] });
      for (const sz of [-1, 1]) {
        b.add(new THREE.TorusGeometry(0.95, 0.018, 5, 18, Math.PI), { at: [4.9, 0.16, -1.3 + sz * 0.23], scale: [1, 0.36, 1], color: '#a82c28' });
        for (const k of [-0.8, -0.4, 0, 0.4, 0.8]) b.add(new THREE.BoxGeometry(0.03, 0.2, 0.03), { at: [4.9 + k, 0.34 * Math.sqrt(Math.max(0, 0.9025 - k * k)) + 0.07, -1.3 + sz * 0.23], color: '#a82c28' });
      }
    });
    place(-4.9, -1.5, () => {
      pavilion(b, -4.9, -1.5, 1.15, ['#7a3a4a', '#c06a80']);
      blossom(-6.0, -2.2, 1.2);
      blossom(-3.9, -2.4, 1.0);
    });
    place(0.6, -4.3, () => {
      clearing(0.6, -4.3, 1.7);
      for (let i = 0; i < 5; i++) lantern(-0.6 + i * 0.6, -4.0 - Math.abs(i - 2) * 0.12);
      blossom(0.6, -5.0, 1.7);
    });
    place(-4.1, 2.0, () => flowerField(b, q(4), -4.1, 2.0, 1.4, 0.85, 120, ['#ff9ecb', '#ffffff', '#ffd0e4', '#fff3a8']));
    place(4.1, 2.1, () => {
      clearing(4.1, 2.1, 1.2);
      // a second picnic: a mat and three rice cakes on it
      b.add(new THREE.BoxGeometry(0.9, 0.012, 0.66), { at: [4.1, 0.008, 2.1], rot: [0, -0.3, 0], color: '#ffd0e4' });
      for (const [dx, c] of [[-0.12, '#ffb3d1'], [0, '#ffffff'], [0.12, '#b8e0a0']]) b.add(new THREE.SphereGeometry(0.04, 8, 6), { at: [4.1 + dx, 0.05, 2.1], color: c });
      flowerPatch(b, q(5), 4.8, 2.3, 8, ['#ff9ecb', '#ffffff']);
    });
    surround(
      r,
      (x, z, k) => (r() < 0.78 ? tree(b, r, x, z, { s: 1.05 * k, h: 1.05, trunk: ['#3f2a2a', '#5f4040'], leaves: r() < 0.6 ? ['#ff9ecb', '#ffe1ef'] : ['#ffc4df', '#ffffff'], puffs: 6 }) : bush(b, r, x, z, 0.24 * k, ['#58a85a', '#9fdc8f'])),
      (x, z, k) => {
        const pick = r();
        if (pick < 0.6) flowerPatch(b, r, x, z, 5, ['#ff9ecb', '#ffffff', '#ffd0e4']);
        else if (pick < 0.8) rock(b, r, x, z, 0.13 * k, stone);
        else bush(b, r, x, z, 0.14 * k, ['#58a85a', '#9fdc8f']);
      }
    );
    H.group.add((H.scenery = b.mesh()));
    H.group.add(
      grassField(r, 300, () => {
        const [x, z] = edgeSpot(r, 1.02, 2.1);
        return x < -1.5 && z > 0.1 && z < 1.1 ? null : [x, z, r.range(0.06, 0.12)];
      }, ['#9fd27f', '#b9e29a', '#86c06a'], H.clock)
    );
    H.group.add(grassField(r, wide(520), () => [...farSpot(r), r.range(0.06, 0.13)], ['#9fd27f', '#b9e29a', '#86c06a'], H.clock));
    const petals = new Drift(r, { count: 240, colors: ['#ffc4df', '#ffe0ee', '#ff9ecb', '#ffffff'], fall: 0.2, sway: 0.35, wind: 0.1, size: 0.055, tex: petalTexture() });
    H.group.add(petals.points);
    H.updaters.push((dt, t) => petals.update(dt, t));
    const lamp = new THREE.PointLight('#ffc98a', 0, 2.6, 1.6);
    lamp.position.set(lx, 0.42, lz);
    H.group.add(lamp);
    H.updaters.push((dt, t, world) => (lamp.intensity = world.night ? 2.2 + Math.sin(t * 7) * 0.12 : 0));
    const flies = butterflies(r, ['#ffffff', '#ffd166']);
    H.group.add(flies.group);
    H.dayOnly.push(flies.group);
    H.fairOnly.push(flies.group);
    H.butterflies = flies.list;
    H.updaters.push((dt, t) => flies.update(dt, t));
    H.spots.mic.set(0.95, 0, -1.05);
    H.obstacles.push({ x: lx, z: lz, r: 0.22 });
    H.litter = '🌸';
    // out of the rain: under the blossom
    H.shelters.push(under(-1.6, -1.95, 1.4, [[0.45, 0.5], [-0.2, 0.5], [1.1, 0.5], [0.12, 0.68], [0.78, 0.68]]), under(2.0, -2.3, 1.2, [[-0.3, 0.5], [0.35, 0.5], [-0.95, 0.5], [1.0, 0.5]]));
    H.obstacles.push({ x: -1.6, z: -1.95, r: 0.13 }, { x: 2.0, z: -2.3, r: 0.11 });
    return H;
  },

  // 바닷가 — sand, palms and a parasol; the sea comes in along the south
  beach(r) {
    const H = habitat('beach', r, {
      day: { sky: '#f4fbff', ground: '#f0d9a8', hemi: 2.0, sun: '#fff1cf', sunI: 2.6, pos: [-3.2, 6, 2.2], bg: '#f1dcae' },
      night: { ground: '#33365a', bg: '#4a4f78', sunI: 1.05 },
    });
    // (the water takes the south: the country lies to the north of it)
    H.range = { cx: 0, cz: -1.5, rx: 6.4, rz: 3.6 };
    NOW.where = (x, z) => z < 2.25;
    H.group.add(
      (H.ground = groundMesh((g, s) => {
        g.fillStyle = '#f1dcae';
        g.fillRect(0, 0, s, s);
        blotches(g, s, r, 90, ['#f8e8c0', '#e6cc98', '#f4dfb0', '#e0c690'], 80, 260, 0.22);
        g.strokeStyle = '#dcc08a';
        g.lineWidth = 2;
        for (let i = 0; i < 30; i++) {
          const y0 = (i / 30) * s + r.range(-6, 6);
          const ph = r() * 6;
          g.globalAlpha = r.range(0.12, 0.28);
          g.beginPath();
          for (let x = 0; x <= s; x += 16) g.lineTo(x, y0 + Math.sin((x / s) * TAU * 2 + ph) * 9 + Math.sin((x / s) * TAU * 5 + ph) * 3);
          g.stroke();
        }
        g.globalAlpha = 1;
        dots(g, s, r, 300, ['#c9ac78', '#fff6dc', '#ffd9c9', '#b89a6a'], 0.8, 2.4, 0.7);
      }))
    );
    // the sea: wet sand where it has been, shallows, deep water — and a line of foam that comes and goes
    const strip = (z0, z1, y, material) => {
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(GROUND[0], z1 - z0), material);
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.set(0, y, (z0 + z1) / 2);
      mesh.receiveShadow = true;
      return mesh;
    };
    H.group.add(strip(2.2, 3.4, 0.004, new THREE.MeshLambertMaterial({ color: '#cdb07c' })));
    const tide = new THREE.Group();
    tide.add(
      strip(2.75, 4.4, 0.012, new THREE.MeshStandardMaterial({ color: '#7fe0e4', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.75 })),
      strip(3.7, 19, 0.016, new THREE.MeshStandardMaterial({ color: '#35a8d6', roughness: 0.12, metalness: 0.2, transparent: true, opacity: 0.94 })),
      strip(2.68, 2.8, 0.02, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.9 })),
      strip(3.5, 3.56, 0.02, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5 }))
    );
    H.group.add(tide);
    H.updaters.push((dt, t) => (tide.position.z = Math.sin(t * 0.7) * 0.2 + Math.sin(t * 1.9) * 0.04));
    const b = new Scenery();
    palm(b, r, -1.9, -2.0, 1.35);
    palm(b, r, 2.2, -2.2, 1.2);
    palm(b, r, -3.0, -0.6, 1.0);
    palm(b, r, 3.1, -0.3, 0.9);
    const gray = ['#8d8f96', '#c9ccd2'];
    rock(b, r, -2.35, -1.3, 0.22, gray);
    rock(b, r, -2.05, -1.1, 0.12, gray);
    rock(b, r, 0.4, -2.3, 0.18, gray);
    log(b, 1.05, -1.95, 0.3, 0.9, 0.07);
    // a parasol over a towel
    const stripes = (cx, cz, n, one, other) => (p) => _c.set(Math.floor(((Math.atan2(p.z - cz, p.x - cx) / TAU + 0.5) * n) % 2) ? one : other);
    const parasol = (x, z, one, towel) => {
      foot(x, z, 0.06);
      b.add(new THREE.CylinderGeometry(0.014, 0.014, 0.95, 6), { at: [x, 0.475, z], rot: [0, 0, 0.08], color: '#f4ecd8' });
      b.add(new THREE.ConeGeometry(0.58, 0.2, 10), { at: [x - 0.04, 0.95, z], rot: [0, 0, 0.08], color: stripes(x - 0.04, z, 10, one, '#fff6e6'), flat: true, byFace: true });
      b.add(new THREE.BoxGeometry(0.42, 0.012, 0.8), { at: [x + 0.25, 0.008, z + 0.3], rot: [0, 0.3, 0], color: towel });
    };
    parasol(-2.2, 0.45, '#ff6b6b', '#6fc6ff');
    // a sandcastle
    const castle = (x, z, s) => {
      const sand = ['#dcc088', '#f6e2b4'];
      foot(x, z, 0.3 * s);
      b.add(new THREE.CylinderGeometry(0.26 * s, 0.3 * s, 0.12 * s, 10), { at: [x, 0.06 * s, z], color: sand, flat: true });
      for (const [dx, dz, h] of [[0, 0, 0.34], [-0.17, 0.1, 0.22], [0.17, 0.1, 0.22], [0, -0.17, 0.24]]) {
        b.add(new THREE.CylinderGeometry(0.06 * s, 0.07 * s, h * s, 8), { at: [x + dx * s, (0.12 + h / 2) * s, z + dz * s], color: sand, flat: true });
        b.add(new THREE.ConeGeometry(0.075 * s, 0.1 * s, 8), { at: [x + dx * s, (0.17 + h) * s, z + dz * s], color: sand, flat: true });
      }
      b.add(new THREE.CylinderGeometry(0.004, 0.004, 0.14 * s, 4), { at: [x, 0.62 * s, z], color: '#7a5238' });
      b.add(new THREE.BoxGeometry(0.07 * s, 0.04 * s, 0.004), { at: [x + 0.035 * s, 0.67 * s, z], color: '#ff5a7d' });
    };
    castle(2.25, 0.6, 1);
    // a ball, a board stuck in the sand, a little boat pulled up on the shore
    b.add(new THREE.SphereGeometry(0.09, 14, 10), { at: [1.85, 0.09, 1.2], color: stripes(1.85, 1.2, 6, '#ff6b6b', '#ffffff') });
    foot(2.6, -1.25, 0.12);
    b.add(new THREE.SphereGeometry(1, 12, 10), { at: [2.6, 0.5, -1.25], rot: [0.12, 0.5, 0.1], scale: [0.16, 0.62, 0.035], color: ['#ffb84a', '#fff3a8'] });
    const boat = (x, z, yaw, hull) => {
      footLine(x - Math.cos(yaw) * 0.4, z + Math.sin(yaw) * 0.4, x + Math.cos(yaw) * 0.4, z - Math.sin(yaw) * 0.4, 0.28);
      b.add(new THREE.SphereGeometry(1, 14, 8, 0, TAU, Math.PI / 2, Math.PI / 2), { at: [x, 0.26, z], rot: [0, yaw, 0], scale: [0.75, 0.26, 0.3], color: hull });
      b.add(new THREE.CylinderGeometry(1, 1, 0.02, 14), { at: [x, 0.22, z], rot: [0, yaw, 0], scale: [0.7, 1, 0.27], color: ['#a37550', '#c99a70'] });
      b.add(new THREE.BoxGeometry(0.08, 0.02, 0.5), { at: [x, 0.25, z], rot: [0, yaw, 0], color: '#8a6244' });
    };
    boat(3.4, 1.55, 0.5, ['#3f7fc4', '#8fc4f0']);
    // shells and starfish
    const shell = (x, z, s) => b.add(new THREE.SphereGeometry(0.03 * s, 7, 5), { at: [x, 0.012 * s, z], rot: [0, r() * 3, 0], scale: [1.2, 0.5, 0.9], color: r.pick(['#ffd9c9', '#fff6e6', '#f6b8a8', '#e8d0f0']) });
    const starfish = (x, z, s) => {
      const turn = r() * TAU;
      const color = r.pick(['#ff8a5c', '#ff6b8a', '#ffb84a']);
      for (let i = 0; i < 5; i++) {
        const a = turn + (i / 5) * TAU;
        b.add(new THREE.ConeGeometry(0.016 * s, 0.07 * s, 4), { at: [x + Math.sin(a) * 0.03 * s, 0.01, z + Math.cos(a) * 0.03 * s], rot: [Math.PI / 2, a, 0, 'YXZ'], scale: [1, 1, 0.5], color });
      }
    };
    for (const [x, z] of [[-1.3, 1.25], [0.6, 1.4], [-2.6, -0.1], [1.5, -2.2], [-0.4, -2.0]]) shell(x, z, 1.1);
    for (const [x, z] of [[-0.9, 1.55], [2.7, 0.2], [-2.75, 1.2]]) starfish(x, z, 1.2);
    // out in the country: a lighthouse on the rocks, a row of beach huts, a tide pool, a net and a ball, driftwood
    const q = (i) => rng(2203 + i * 977);
    let lamp = null;
    place(4.9, -3.6, () => {
      boulders(b, q(1), 4.9, -3.4, 0.85, gray);
      foot(4.9, -3.6, 0.5);
      for (let i = 0; i < 4; i++) {
        b.add(new THREE.CylinderGeometry((0.3 - i * 0.03) * 1.0, (0.33 - i * 0.03) * 1.0, 0.44, 12), { at: [4.9, 0.5 + i * 0.44, -3.6], color: i % 2 ? '#fff6f0' : '#e8433f' });
      }
      b.add(new THREE.CylinderGeometry(0.3, 0.3, 0.04, 12), { at: [4.9, 2.06, -3.6], color: '#3a3f4a' });
      b.add(new THREE.CylinderGeometry(0.16, 0.16, 0.24, 8), { at: [4.9, 2.2, -3.6], color: '#fff3a8' });
      b.add(new THREE.ConeGeometry(0.24, 0.2, 8), { at: [4.9, 2.42, -3.6], color: ['#b82f2a', '#e8433f'], flat: true });
      lamp = new THREE.PointLight('#fff0b0', 0, 7, 1.4);
      lamp.position.set(4.9, 2.2, -3.2);
      H.group.add(lamp);
    });
    if (lamp) H.updaters.push((dt, t, world) => (lamp.intensity = world.night ? 5 + Math.sin(t * 1.3) * 2.5 : 0));
    place(0.3, -4.5, () => {
      clearing(0.3, -4.5, 2.0);
      [['#ffb3c6', '#ff7a9a'], ['#a8dcff', '#4f9fe0'], ['#fff3a8', '#f0b83a'], ['#b8f0c8', '#4fb87a']].forEach(([wall, top], i) => {
        const x = -0.9 + i * 0.8;
        const z = -4.5 - (i % 2) * 0.1;
        foot(x, z, 0.4);
        b.add(new THREE.BoxGeometry(0.62, 0.62, 0.6), { at: [x, 0.31, z], color: wall });
        roof(b, x, 0.62, z, 0.7, 0.76, 0.3, top, Math.PI / 2);
        b.add(new THREE.BoxGeometry(0.2, 0.36, 0.02), { at: [x, 0.2, z + 0.305], color: '#fff6e6' });
      });
    });
    place(-4.9, -1.2, () => {
      pond(H, b, q(3), -4.9, -1.2, 1.0, { color: '#58c8d8', stone: gray, bare: true });
      for (const [dx, dz] of [[-1.2, 0.5], [1.15, 0.6], [0.3, 0.95], [-0.5, -0.95]]) starfish(-4.9 + dx, -1.2 + dz, 1.4);
    });
    place(4.7, -0.9, () => {
      clearing(4.7, -0.9, 1.6);
      for (const sx of [-1, 1]) {
        foot(4.7 + sx * 1.0, -0.9, 0.06);
        b.add(new THREE.CylinderGeometry(0.02, 0.02, 0.7, 6), { at: [4.7 + sx * 1.0, 0.35, -0.9], color: '#f4ecd8' });
      }
      footLine(3.8, -0.9, 5.6, -0.9, 0.06);
      b.add(new THREE.BoxGeometry(2.0, 0.26, 0.008), { at: [4.7, 0.55, -0.9], color: (p) => _c.set((Math.floor(p.x / 0.08) + Math.floor(p.y / 0.08)) % 2 ? '#ffffff' : '#dfe8f0') });
      b.add(new THREE.SphereGeometry(0.09, 12, 8), { at: [5.1, 0.09, -0.4], color: stripes(5.1, -0.4, 6, '#ffd23f', '#4f9fe0') });
    });
    place(-4.3, 1.1, () => {
      clearing(-4.3, 1.1, 1.3);
      parasol(-4.5, 0.9, '#4f9fe0', '#ffd23f');
      castle(-3.7, 1.4, 0.8);
    });
    place(4.2, 1.3, () => {
      clearing(4.2, 1.3, 1.0);
      boat(4.9, 1.5, -0.4, ['#e8433f', '#ff9a8a']);
    });
    const dune = ['#e0c690', '#f8e8c0'];
    surround(
      r,
      (x, z, k) => {
        const pick = r();
        if (pick < 0.5) palm(b, r, x, z, k);
        else if (pick < 0.75) {
          mound(b, x, z, 1.1 * k, 0.8 * k, 0.14 * k, dune, true);
          for (let i = 0; i < 9; i++) b.add(new THREE.ConeGeometry(0.018, 0.2 * k, 4), { at: [x + r.range(-0.6, 0.6) * k, 0.14 * k, z + r.range(-0.4, 0.4) * k], rot: [r.range(-0.2, 0.2), 0, r.range(-0.2, 0.2)], color: '#a9b86a' });
        } else rock(b, r, x, z, 0.3 * k, gray);
      },
      (x, z, k) => {
        const pick = r();
        if (pick < 0.45) shell(x, z, k);
        else if (pick < 0.65) starfish(x, z, k);
        else if (pick < 0.85) rock(b, r, x, z, 0.09 * k, gray);
        else for (let i = 0; i < 4; i++) b.add(new THREE.ConeGeometry(0.016, 0.16 * k, 4), { at: [x + r.range(-0.1, 0.1), 0.08 * k, z + r.range(-0.1, 0.1)], color: '#a9b86a' });
      },
      { nTall: 26, nLow: 90, gap: 1.3 }
    );
    H.group.add((H.scenery = b.mesh()));
    // crabs along the shore
    const red = new THREE.MeshLambertMaterial({ color: '#e8533f' });
    const dark = new THREE.MeshBasicMaterial({ color: '#2a2020' });
    const crabs = [];
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), red);
      body.scale.set(1.35, 0.55, 1);
      body.position.y = 0.035;
      body.castShadow = true;
      g.add(body);
      for (const s of [1, -1]) {
        const claw = new THREE.Mesh(new THREE.SphereGeometry(0.02, 7, 5), red);
        claw.position.set(0.06 * s, 0.045, 0.045);
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.007, 5, 4), dark);
        eye.position.set(0.02 * s, 0.07, 0.03);
        g.add(claw, eye);
      }
      H.group.add(g);
      crabs.push({ g, x: r.range(-2.4, 2.4), z: 1.75 + i * 0.16, span: r.range(0.5, 1.1), seed: r() * 10 });
    }
    H.updaters.push((dt, t) => {
      for (const c of crabs) c.g.position.set(c.x + Math.sin(t * 0.3 + c.seed) * c.span, Math.abs(Math.sin(t * 9 + c.seed)) * 0.008, c.z);
    });
    H.group.add(
      grassField(r, 60, () => {
        const [x, z] = edgeSpot(r, 1.15, 2);
        return z > 0.9 ? null : [x, z, r.range(0.06, 0.12)];
      }, ['#b9c47a', '#9aa85a', '#d6d89a'], H.clock)
    );
    H.group.add(grassField(r, wide(110), () => [...farSpot(r), r.range(0.06, 0.13)], ['#b9c47a', '#9aa85a', '#d6d89a'], H.clock));
    H.prints = { color: [0.82, 0.74, 0.6], life: 9 };
    // out of the rain: under the palms, and one under the parasol
    H.shelters.push(under(-1.9, -2.0, 1.2, [[0.5, 0.45], [-0.2, 0.45], [1.1, 0.5]]), under(2.2, -2.2, 1.05, [[-0.3, 0.45], [0.4, 0.45], [-0.95, 0.5]]), { roof: { x: -2.2, z: 0.45, r: 0.5 }, spots: [{ x: -1.9, z: 0.3, yaw: 0.7 }] });
    H.obstacles.push({ x: -1.9, z: -2.0, r: 0.12 }, { x: 2.2, z: -2.2, r: 0.1 });
    return H;
  },

  // 대나무 숲 — tall bamboo, a path of stones, water running into a basin; mist by day, fireflies by night
  bamboo(r) {
    const H = habitat('bamboo', r, {
      day: { sky: '#f2fff4', ground: '#7fae6a', hemi: 1.75, sun: '#f6ffd9', sunI: 2.15, pos: [-3.0, 6.2, 2.0], bg: '#6f9f5c' },
      night: { sky: '#8fc0a8', ground: '#1f2c2a', bg: '#2f4a40' },
    });
    H.group.add(
      (H.ground = groundMesh((g, s) => {
        g.fillStyle = '#6f9f5c';
        g.fillRect(0, 0, s, s);
        blotches(g, s, r, 90, ['#5f9050', '#86b56e', '#587f48', '#94c07a'], 70, 240, 0.24);
        strokes(g, s, r, 2400, ['#5c8f4c', '#8fc078', '#4f8244'], 5, 12, 1.6);
        strokes(g, s, r, 700, ['#d9c98a', '#c9b56a', '#e6dca6'], 7, 14, 2.2, 0, Math.PI, 0.85);
        dots(g, s, r, 240, ['#8a8a80', '#b5b2a8'], 1, 3, 0.7);
      }))
    );
    const b = new Scenery();
    const moss = ['#5f7f55', '#a4c48a'];
    const fern = ['#3f8a45', '#7fc878'];
    const stone = ['#8d9096', '#c4c7cc'];
    for (const [x, z, s, n] of [[-1.7, -2.0, 1.3, 6], [-0.6, -2.6, 1.1, 5], [0.75, -2.65, 1.25, 6], [2.0, -2.1, 1.15, 5], [-2.95, -0.9, 1.0, 5], [3.05, -0.8, 1.05, 5], [-2.6, -2.9, 1.2, 5], [3.0, -2.9, 1.2, 5]]) bamboo(b, r, x, z, s, n);
    rock(b, r, -2.2, -1.25, 0.24, moss);
    rock(b, r, 2.4, 0.7, 0.2, moss);
    rock(b, r, 2.15, 0.95, 0.11, moss);
    rock(b, r, 1.3, -2.0, 0.15, moss);
    bush(b, r, -2.3, 1.05, 0.14, fern);
    bush(b, r, 1.6, 1.3, 0.13, fern);
    bush(b, r, -0.9, -2.0, 0.14, fern);
    stoneLantern(b, 2.1, -0.75, stone);
    // a path of stones leading off into the bamboo
    for (let i = 0; i < 7; i++) {
      b.add(new THREE.CylinderGeometry(0.13, 0.14, 0.02, 9), { at: [0.1 + Math.sin(i * 1.1) * 0.12 + i * 0.04, 0.01, -1.75 - i * 0.36], rot: [0, r() * 3, 0], scale: [r.range(0.9, 1.2), 1, r.range(0.8, 1)], color: stone, flat: true });
    }
    // water runs from a pipe of bamboo into a stone basin
    const wx = -2.2;
    const wz = 0.45;
    foot(wx, wz, 0.26);
    b.add(new THREE.CylinderGeometry(0.2, 0.22, 0.14, 10), { at: [wx, 0.07, wz], color: stone, flat: true });
    b.add(new THREE.CircleGeometry(0.16, 12), { at: [wx, 0.142, wz], rot: [-Math.PI / 2, 0, 0], color: '#5fb0d0' });
    for (const sx of [-1, 1]) b.add(new THREE.CylinderGeometry(0.014, 0.014, 0.44, 6), { at: [wx - 0.26, 0.22, wz + sx * 0.05], color: '#7fae4a' });
    b.add(new THREE.CylinderGeometry(0.022, 0.022, 0.44, 7), { at: [wx - 0.16, 0.36, wz], rot: [0, 0, 1.25], color: ['#7fae4a', '#b4d87a'] });
    b.add(new THREE.CylinderGeometry(0.005, 0.005, 0.2, 4), { at: [wx + 0.04, 0.24, wz], color: '#bfe8ff' });
    // bamboo shoots
    const shoot = (x, z, s) => b.add(new THREE.ConeGeometry(0.04 * s, 0.16 * s, 6), { at: [x, 0.08 * s, z], rot: [0, r() * 3, 0], color: ['#6a4a30', '#c9b56a'], flat: true });
    for (const [x, z] of [[-1.3, -1.85], [1.55, -1.8], [-2.55, 0.1], [2.65, -0.2]]) shoot(x, z, 1.1);
    mushroom(b, r, 0.95, -1.9, 1);
    mushroom(b, r, -1.95, 1.2, 0.9);
    // out in the country: a pavilion for tea, a pond with carp, a ring of mossy stones, a place where the shoots come up
    const q = (i) => rng(5519 + i * 977);
    place(-4.9, -1.5, () => {
      pavilion(b, -4.9, -1.5, 1.15, ['#3f5a4a', '#6f9080']);
      stoneLantern(b, -3.95, -0.75, stone);
    });
    place(4.9, -1.3, () => {
      pond(H, b, q(2), 4.9, -1.3, 1.25, { color: '#4f9f9a', lily: '#ffffff', stone: moss });
      const carp = q(8);
      for (let i = 0; i < 6; i++) {
        const a = carp() * TAU;
        const d = carp.range(0.2, 0.7);
        b.add(new THREE.SphereGeometry(0.05, 8, 5), { at: [4.9 + Math.cos(a) * 1.25 * d, 0.012, -1.3 + Math.sin(a) * 0.87 * d], rot: [0, carp() * 6, 0], scale: [1.6, 0.15, 0.6], color: carp.pick(['#ff8a3c', '#ffffff', '#ffb84a', '#e8433f']) });
      }
    });
    place(0.5, -4.5, () => {
      boulders(b, q(3), 0.5, -4.5, 1.1, moss);
      stoneLantern(b, -0.7, -3.9, stone);
      stoneLantern(b, 1.7, -3.9, stone);
    });
    place(-4.1, 2.0, () => {
      clearing(-4.1, 2.0, 1.2);
      const dice = q(4);
      for (let i = 0; i < 14; i++) shoot(-4.1 + dice.range(-0.9, 0.9), 2.0 + dice.range(-0.6, 0.6), dice.range(0.9, 1.8));
    });
    place(4.1, 2.0, () => {
      clearing(4.1, 2.0, 1.2);
      const dice = q(5);
      for (let i = 0; i < 11; i++) mushroom(b, dice, 4.1 + Math.cos((i / 11) * TAU) * 0.7, 2.0 + Math.sin((i / 11) * TAU) * 0.5, dice.range(1.2, 1.9));
    });
    surround(
      r,
      (x, z, k) => {
        const pick = r();
        if (pick < 0.78) bamboo(b, r, x, z, 1.05 * k, 3 + Math.floor(r() * 2));
        else if (pick < 0.9) rock(b, r, x, z, 0.3 * k, moss);
        else bush(b, r, x, z, 0.22 * k, fern);
      },
      (x, z, k) => {
        const pick = r();
        if (pick < 0.4) bush(b, r, x, z, 0.13 * k, fern);
        else if (pick < 0.6) shoot(x, z, k);
        else if (pick < 0.8) rock(b, r, x, z, 0.1 * k, moss);
        else mushroom(b, r, x, z, k);
      },
      { nTall: 46, nLow: 100, gap: 0.85 }
    );
    H.group.add((H.scenery = b.mesh()));
    H.group.add(
      grassField(r, 260, () => {
        const [x, z] = edgeSpot(r, 1.03, 2.1);
        return [x, z, r.range(0.06, 0.12)];
      }, ['#7fb868', '#5f9a50', '#9fd07f'], H.clock)
    );
    H.group.add(grassField(r, wide(420), () => [...farSpot(r), r.range(0.06, 0.13)], ['#7fb868', '#5f9a50', '#9fd07f'], H.clock));
    // leaves come down; mist lies between the stems by day, and at night there are fireflies
    const leaves = new Drift(r, { count: 46, colors: ['#cfd98a', '#a9c96a', '#e6dca6'], fall: 0.16, sway: 0.34, wind: 0.06, size: 0.055, tex: petalTexture() });
    const mist = new Drift(r, { count: 44, colors: ['#ffffff', '#eaffea'], fall: 0, sway: 0.09, wind: 0.05, size: 1.1, opacity: 0.1, box: [12, 0.6, 10] });
    const glow = new Drift(r, { count: 70, colors: ['#eaff8a', '#c8ff6a'], fall: -0.02, sway: 0.3, size: 0.07, glow: true, box: [11, 0.9, 10] });
    H.group.add(leaves.points, mist.points, glow.points);
    H.dayOnly.push(mist.points);
    H.nightOnly.push(glow.points);
    H.fairOnly.push(glow.points);
    H.updaters.push((dt, t) => {
      leaves.update(dt, t);
      (mist.points.visible ? mist : glow).update(dt, t);
    });
    const lamp = new THREE.PointLight('#ffc98a', 0, 2.6, 1.6);
    lamp.position.set(2.1, 0.42, -0.75);
    H.group.add(lamp);
    H.updaters.push((dt, t, world) => (lamp.intensity = world.night ? 2.2 + Math.sin(t * 7) * 0.12 : 0));
    H.spots.mic.set(0.95, 0, -1.05);
    H.obstacles.push({ x: 2.1, z: -0.75, r: 0.22 });
    H.litter = '🍃';
    // out of the rain: in under the bamboo
    H.shelters.push(under(-1.7, -2.0, 1.2, [[0.5, 0.5], [-0.2, 0.5], [1.15, 0.5], [0.15, 0.68]]), under(2.0, -2.1, 1.1, [[-0.3, 0.5], [0.4, 0.5], [-0.95, 0.5]]));
    H.obstacles.push({ x: -1.7, z: -2.0, r: 0.2 }, { x: 2.0, z: -2.1, r: 0.18 });
    return H;
  },

  // 라벤더 언덕 — rows of lavender in flower, cypresses, beehives and a windmill
  lavender(r) {
    const H = habitat('lavender', r, {
      day: { sky: '#fbf6ff', ground: '#b9a6e0', hemi: 1.95, sun: '#fff0d0', sunI: 2.4, pos: [-3.4, 6, 1.8], bg: '#9fc47c' },
      night: { sky: '#a89cff', ground: '#27223f', bg: '#3f3d66' },
    });
    H.group.add(
      (H.ground = groundMesh((g, s) => {
        g.fillStyle = '#9fc47c';
        g.fillRect(0, 0, s, s);
        blotches(g, s, r, 90, ['#b4d68f', '#8cb86c', '#c2dea0', '#84b064'], 70, 240, 0.22);
        strokes(g, s, r, 3600, ['#7fb060', '#b9dc98', '#74a658', '#a4cf84'], 6, 14, 1.7);
        dots(g, s, r, 500, ['#b79cf0', '#d9c8ff', '#9a7ce0', '#ffffff'], 1.6, 3.2, 0.9);
      }))
    );
    const b = new Scenery();
    const green = ['#5a9a50', '#9fd88a'];
    const violet = ['#7a5cc8', '#b79cf0'];
    const pink = ['#c86aa8', '#f0a8d0'];
    const pale = ['#a890e0', '#e6dcff'];
    lavenderRows(b, r, -2.7, -1.78, 5.4, 4, violet);
    lavenderRows(b, r, -3.7, 1.45, 1.55, 3, violet);
    lavenderRows(b, r, 2.15, 1.5, 1.6, 3, pink);
    tree(b, r, -3.15, -1.2, { s: 1.15, leaves: green });
    tree(b, r, 3.1, -1.45, { s: 1.05, leaves: green });
    cypress(b, r, -3.4, -2.75, 1.25);
    cypress(b, r, 3.5, -2.6, 1.1);
    cypress(b, r, 0.05, -3.4, 1.35);
    cypress(b, r, -1.3, -3.3, 0.95);
    // beehives
    const hive = (x, z, tone) => {
      foot(x, z, 0.16);
      for (const sx of [-1, 1]) b.add(new THREE.BoxGeometry(0.03, 0.08, 0.2), { at: [x + sx * 0.08, 0.04, z], color: '#7a5238' });
      for (let i = 0; i < 3; i++) b.add(new THREE.BoxGeometry(0.24, 0.1, 0.22), { at: [x, 0.13 + i * 0.105, z], color: i % 2 ? '#fff6e6' : tone });
      b.add(new THREE.BoxGeometry(0.29, 0.03, 0.27), { at: [x, 0.405, z], color: '#8a6244' });
      b.add(new THREE.BoxGeometry(0.06, 0.012, 0.01), { at: [x, 0.1, z + 0.112], color: '#3a2a1a' });
    };
    hive(2.3, -0.95, '#ffd98a');
    hive(2.68, -0.62, '#c8b4f4');
    // a basket full of cut lavender
    b.add(new THREE.CylinderGeometry(0.11, 0.09, 0.11, 12), { at: [-2.15, 0.055, 0.55], color: ['#b9824f', '#e2b47e'] });
    b.add(new THREE.TorusGeometry(0.09, 0.01, 5, 14, Math.PI), { at: [-2.15, 0.11, 0.55], rot: [0, 0.6, 0], color: '#b9824f' });
    foot(-2.15, 0.55, 0.12);
    for (let i = 0; i < 7; i++) b.add(new THREE.ConeGeometry(0.018, 0.13, 4), { at: [-2.15 + r.range(-0.06, 0.06), 0.16, 0.55 + r.range(-0.06, 0.06)], rot: [r.range(-0.4, 0.4), 0, r.range(-0.4, 0.4)], color: violet, flat: true });
    rock(b, r, 2.2, 0.75, 0.17);
    flowerPatch(b, r, -1.6, 1.05, 6, ['#ffffff', '#fff3a8']);
    // out in the country: a windmill, a stone cottage, great fields in three colours, a well, sunflowers
    const q = (i) => rng(7333 + i * 977);
    place(4.9, -2.7, () => windmill(H, b, 4.9, -2.7, 1.4, { cap: ['#6a4fa8', '#9a80d8'] }));
    place(-4.9, -2.8, () => {
      clearing(-4.9, -2.8, 1.6);
      footLine(-5.35, -2.8, -4.45, -2.8, 0.55);
      b.add(new THREE.BoxGeometry(1.3, 0.7, 0.9), { at: [-4.9, 0.35, -2.8], color: ['#d9c9a8', '#f4ead2'] });
      roof(b, -4.9, 0.7, -2.8, 1.5, 1.2, 0.5, ['#b85a3a', '#e08a5c']);
      b.add(new THREE.BoxGeometry(0.2, 0.4, 0.03), { at: [-4.9, 0.2, -2.345], color: '#6a4fa8' });
      for (const sx of [-1, 1]) b.add(new THREE.BoxGeometry(0.2, 0.2, 0.03), { at: [-4.9 + sx * 0.4, 0.42, -2.345], color: '#bfe0ff' });
      b.add(new THREE.BoxGeometry(0.16, 0.4, 0.16), { at: [-4.5, 1.1, -2.9], color: '#c9b898' });
    });
    place(-6.3, 0.9, () => lavenderRows(b, q(3), -6.3, 0.9, 2.7, 6, pink));
    place(3.6, 1.2, () => lavenderRows(b, q(4), 3.6, 1.2, 2.6, 5, pale));
    place(-1.3, -4.0, () => lavenderRows(b, q(5), -1.3, -4.0, 2.8, 3, violet));
    place(4.9, -0.7, () => well(b, 4.9, -0.7));
    place(-3.6, 2.6, () => {
      clearing(-3.6, 2.6, 1.0);
      const dice = q(7);
      for (let i = 0; i < 9; i++) {
        const x = -3.6 + dice.range(-0.8, 0.8);
        const z = 2.6 + dice.range(-0.3, 0.3);
        const h = dice.range(0.42, 0.6);
        b.add(new THREE.CylinderGeometry(0.012, 0.014, h, 5), { at: [x, h / 2, z], color: '#4f9a4a' });
        b.add(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), { at: [x, h, z + 0.04], rot: [1.15, 0, 0], color: '#ffcf33' });
        b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 10), { at: [x, h + 0.004, z + 0.047], rot: [1.15, 0, 0], color: '#6b4226' });
      }
    });
    surround(
      r,
      (x, z, k) => {
        const pick = r();
        if (pick < 0.35) cypress(b, r, x, z, k);
        else if (pick < 0.6) tree(b, r, x, z, { s: 0.95 * k, leaves: green });
        else for (let i = 0; i < 7; i++) lavender(b, r, x + r.range(-0.4, 0.4), z + r.range(-0.3, 0.3), r.range(1, 1.4), r() < 0.7 ? violet : pink);
      },
      (x, z, k) => {
        const pick = r();
        if (pick < 0.5) lavender(b, r, x, z, k, r() < 0.75 ? violet : pale);
        else if (pick < 0.8) flowerPatch(b, r, x, z, 4, ['#ffffff', '#fff3a8', '#ffb3d1']);
        else rock(b, r, x, z, 0.12 * k);
      },
      { nTall: 36, nLow: 120 }
    );
    H.group.add((H.scenery = b.mesh()));
    H.group.add(
      grassField(r, 260, () => {
        const [x, z] = edgeSpot(r, 1.03, 2.1);
        return z < -1.5 ? null : [x, z, r.range(0.06, 0.12)];
      }, ['#9fd27f', '#b9e29a', '#86c06a'], H.clock)
    );
    H.group.add(grassField(r, wide(460), () => [...farSpot(r), r.range(0.06, 0.13)], ['#9fd27f', '#b9e29a', '#86c06a'], H.clock));
    const flies = butterflies(r, ['#ffffff', '#d9c8ff', '#ffd166']);
    H.group.add(flies.group);
    H.dayOnly.push(flies.group);
    H.fairOnly.push(flies.group);
    H.butterflies = flies.list;
    const pollen = new Drift(r, { count: 90, colors: ['#fffbd6', '#e6dcff'], fall: -0.05, sway: 0.12, size: 0.028, opacity: 0.6, box: [11, 1.4, 10] });
    const glow = new Drift(r, { count: 50, colors: ['#eaff8a', '#d9c8ff'], fall: -0.02, sway: 0.3, size: 0.07, glow: true, box: [11, 0.9, 10] });
    H.group.add(pollen.points, glow.points);
    H.dayOnly.push(pollen.points);
    H.nightOnly.push(glow.points);
    H.fairOnly.push(pollen.points, glow.points);
    H.updaters.push((dt, t) => {
      flies.update(dt, t);
      (pollen.points.visible ? pollen : glow).update(dt, t);
    });
    H.litter = '💜';
    // out of the rain: under the two trees at either end of the rows
    H.shelters.push(under(-3.15, -1.2, 1.15, [[1.3, 0.5], [0.6, 0.5], [2.0, 0.55]]), under(3.1, -1.45, 1.05, [[-1.3, 0.5], [-0.6, 0.5], [-2.0, 0.55]]));
    H.obstacles.push({ x: -3.15, z: -1.2, r: 0.12 }, { x: 3.1, z: -1.45, r: 0.1 });
    return H;
  },

  // 한옥 마당 — a house under a tiled roof, a stone wall, jars on their stand, a persimmon tree in autumn
  hanok(r) {
    const H = habitat('hanok', r, {
      day: { sky: '#fff9ef', ground: '#d9c7a0', hemi: 1.85, sun: '#ffe6bd', sunI: 2.5, pos: [-3.5, 5.8, 1.6], bg: '#cdbb92' },
      night: { ground: '#2c2836', bg: '#453f4f' },
    });
    H.group.add(
      (H.ground = groundMesh((g, s) => {
        g.fillStyle = '#d3c198';
        g.fillRect(0, 0, s, s);
        blotches(g, s, r, 90, ['#cdb98c', '#e2d2ad', '#c4ae80', '#dccaa2', '#b8b07a'], 70, 250, 0.24);
        strokes(g, s, r, 900, ['#a9a868', '#8f9a58', '#c2b880'], 5, 11, 1.5, -Math.PI / 2, 0.6, 0.6);
        dots(g, s, r, 620, ['#9a927e', '#bdb49c', '#857c6a', '#efe6cc'], 1, 3.4, 0.8);
        dots(g, s, r, 160, ['#d9822b', '#f0b03c', '#c9552e'], 2, 4.2, 0.9);
      }))
    );
    const b = new Scenery();
    const wood = ['#6a4630', '#96684a'];
    const stone = ['#8d9096', '#c4c7cc'];
    const tile = (p) => _c.set(Math.floor((p.x + 20) / 0.09) % 2 ? '#3a3d46' : '#50545f');
    // the house: a stone foot, a wooden floor to sit on, plastered walls with papered doors, and the tiled roof over it all
    const hz = -2.8;
    footLine(-1.55, hz, 1.55, hz, 0.62);
    b.add(new THREE.BoxGeometry(3.4, 0.14, 1.34), { at: [0, 0.07, hz], color: ['#9a958a', '#c9c4b6'] });
    b.add(new THREE.BoxGeometry(3.2, 0.05, 1.2), { at: [0, 0.165, hz], color: wood });
    b.add(new THREE.BoxGeometry(3.1, 0.62, 0.06), { at: [0, 0.5, hz - 0.5], color: '#f4ecd8' });
    for (const sx of [-1, 1]) b.add(new THREE.BoxGeometry(0.06, 0.62, 0.8), { at: [sx * 1.52, 0.5, hz - 0.12], color: '#f4ecd8' });
    b.add(new THREE.BoxGeometry(3.1, 0.62, 0.05), { at: [0, 0.5, hz + 0.05], color: '#f4ecd8' });
    for (let i = 0; i < 5; i++) {
      const x = -1.52 + i * 0.76;
      b.add(new THREE.CylinderGeometry(0.045, 0.05, 0.64, 8), { at: [x, 0.51, hz + 0.52], color: wood });
      if (i === 4) break;
      // a door of paper between each two posts
      b.add(new THREE.BoxGeometry(0.56, 0.5, 0.02), { at: [x + 0.38, 0.46, hz + 0.08], color: '#fff6dc' });
      for (const dx of [-0.28, -0.093, 0.093, 0.28]) b.add(new THREE.BoxGeometry(0.018, 0.5, 0.026), { at: [x + 0.38 + dx, 0.46, hz + 0.082], color: wood[0] });
      for (const dy of [-0.25, -0.08, 0.08, 0.25]) b.add(new THREE.BoxGeometry(0.56, 0.018, 0.026), { at: [x + 0.38, 0.46 + dy, hz + 0.082], color: wood[0] });
    }
    b.add(new THREE.BoxGeometry(3.3, 0.06, 1.24), { at: [0, 0.84, hz], color: wood });
    roof(b, 0, 0.86, hz, 3.9, 1.9, 0.62, tile, 0, 43);
    b.add(new THREE.BoxGeometry(3.96, 0.07, 0.1), { at: [0, 1.5, hz], color: '#5c606a' });
    for (const sx of [-1, 1]) b.add(new THREE.SphereGeometry(0.07, 8, 6), { at: [sx * 1.98, 1.52, hz], color: '#6a6e78' });
    // lanterns of red and blue silk hang from the eaves
    for (const [x, top, low] of [[-1.14, '#e8433f', '#3f6fc4'], [1.14, '#3f6fc4', '#e8433f']]) {
      b.add(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 4), { at: [x, 0.78, hz + 0.7], color: '#3a2a1a' });
      b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8), { at: [x, 0.69, hz + 0.7], color: top });
      b.add(new THREE.CylinderGeometry(0.05, 0.05, 0.07, 8), { at: [x, 0.62, hz + 0.7], color: low });
    }
    // the wall of stones with its cap of tiles (open to the south, and where the paths lead out)
    const wall = (x1, z1, x2, z2) => {
      const len = Math.hypot(x2 - x1, z2 - z1);
      const yaw = -Math.atan2(z2 - z1, x2 - x1);
      const at = (y) => [(x1 + x2) / 2, y, (z1 + z2) / 2];
      footLine(x1, z1, x2, z2, 0.12);
      b.add(new THREE.BoxGeometry(len, 0.4, 0.18, Math.max(2, Math.round(len / 0.14)), 3, 1), { at: at(0.2), rot: [0, yaw, 0], byFace: true, color: (p) => _c.set(['#b9aa8c', '#cfc2a4', '#a89a7c', '#ddd2b6'][Math.abs(Math.floor(p.x * 7.3 + p.y * 11.1 + p.z * 5.7)) % 4]) });
      b.add(new THREE.BoxGeometry(len + 0.06, 0.06, 0.3), { at: at(0.43), rot: [0, yaw, 0], color: '#454852' });
      b.add(new THREE.BoxGeometry(len + 0.06, 0.05, 0.12), { at: at(0.48), rot: [0, yaw, 0], color: '#5c606a' });
    };
    wall(-3.5, -3.75, 1.6, -3.75); // (…and a gateway in the back wall)
    wall(3.0, -3.75, 3.5, -3.75);
    clearing(2.3, -3.7, 1.1);
    wall(-3.5, -3.75, -3.5, -1.3);
    wall(3.5, -3.75, 3.5, -1.9);
    // the stand of jars
    const jx = 2.3;
    const jz = -1.15;
    footLine(jx - 0.25, jz, jx + 0.25, jz, 0.42);
    b.add(new THREE.BoxGeometry(1.15, 0.07, 0.72), { at: [jx, 0.035, jz], color: ['#9a958a', '#c9c4b6'] });
    for (const [dx, dz, s] of [[-0.38, -0.16, 0.17], [-0.04, -0.2, 0.2], [0.34, -0.14, 0.15], [-0.26, 0.16, 0.12], [0.05, 0.18, 0.1], [0.3, 0.2, 0.11], [0.5, 0.02, 0.08]]) {
      b.add(new THREE.SphereGeometry(s, 12, 9), { at: [jx + dx, 0.07 + s * 1.0, jz + dz], scale: [1, 1.12, 1], color: ['#3f2a20', '#7a5038'] });
      b.add(new THREE.CylinderGeometry(s * 0.62, s * 0.7, s * 0.14, 10), { at: [jx + dx, 0.07 + s * 2.1, jz + dz], color: '#5a3a2a' });
      b.add(new THREE.SphereGeometry(s * 0.14, 6, 5), { at: [jx + dx, 0.07 + s * 2.24, jz + dz], color: '#5a3a2a' });
    }
    // a persimmon tree full of fruit, and a pine
    tree(b, r, -2.35, -1.65, { s: 1.3, leaves: ['#c9722a', '#f0a848'], trunk: ['#4f362b', '#6f4e3e'], puffs: 6 });
    for (let i = 0; i < 12; i++) {
      const a = r() * TAU;
      b.add(new THREE.SphereGeometry(0.045, 8, 6), { at: [-2.35 + Math.cos(a) * r.range(0.25, 0.5), r.range(0.72, 1.3), -1.65 + Math.sin(a) * r.range(0.25, 0.5)], scale: [1, 0.85, 1], color: '#ff8a1f' });
    }
    tree(b, r, 2.9, -2.5, { s: 1.15, kind: 'pine', leaves: ['#2f6a4a', '#5a9a70'], trunk: ['#7a4630', '#a86a4a'] });
    stoneLantern(b, -1.95, -0.2 - 1.6, stone);
    // a low platform to sit on in the yard, a tray of persimmons on it; peppers drying on a mat
    const px = -2.3;
    const pz = 0.55;
    footLine(px - 0.2, pz, px + 0.2, pz, 0.36);
    b.add(new THREE.BoxGeometry(0.95, 0.04, 0.62), { at: [px, 0.16, pz], rot: [0, 0.15, 0], color: wood });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.BoxGeometry(0.05, 0.14, 0.05), { at: [px + sx * 0.4, 0.07, pz + sz * 0.24], color: wood[0] });
    b.add(new THREE.CylinderGeometry(0.13, 0.11, 0.03, 12), { at: [px + 0.1, 0.195, pz], color: ['#b9824f', '#e2b47e'] });
    for (const [dx, dz] of [[0.05, 0.03], [0.14, -0.03], [0.12, 0.06]]) b.add(new THREE.SphereGeometry(0.04, 8, 6), { at: [px + dx, 0.24, pz + dz], scale: [1, 0.85, 1], color: '#ff8a1f' });
    b.add(new THREE.CylinderGeometry(0.34, 0.34, 0.012, 16), { at: [2.0, 0.008, 0.85], color: ['#d9c08a', '#e8d4a4'] });
    for (let i = 0; i < 26; i++) {
      const a = r() * TAU;
      const d = Math.sqrt(r()) * 0.3;
      b.add(new THREE.ConeGeometry(0.012, 0.07, 4), { at: [2.0 + Math.cos(a) * d, 0.022, 0.85 + Math.sin(a) * d], rot: [Math.PI / 2, r() * 6, 0, 'YXZ'], color: '#d93a2a' });
    }
    rock(b, r, 2.55, 0.25, 0.16, stone);
    flowerPatch(b, r, -1.55, 1.2, 6, ['#ffd23f', '#ffffff', '#c98ae0']);
    flowerPatch(b, r, 2.75, -0.3, 5, ['#ffd23f', '#ff9a4a']);
    // out in the country: a pavilion by a lotus pond, guardian posts and a pole with a wooden bird, a field of ripe rice, chrysanthemums
    const q = (i) => rng(1907 + i * 977);
    place(4.9, -1.0, () => {
      pond(H, b, q(1), 4.9, -1.0, 1.2, { color: '#5a9a8a', lily: '#ffc4df' });
      pavilion(b, 4.3, -2.85, 1.1, ['#3a3d46', '#6a6e78'], wood);
    });
    place(-5.0, -1.3, () => {
      clearing(-5.0, -1.3, 1.5);
      const post = (x, z, face) => {
        foot(x, z, 0.1);
        b.add(new THREE.CylinderGeometry(0.075, 0.09, 0.95, 8), { at: [x, 0.475, z], color: wood, flat: true });
        b.add(new THREE.BoxGeometry(0.17, 0.2, 0.13), { at: [x, 1.02, z], color: face });
        b.add(new THREE.BoxGeometry(0.2, 0.05, 0.16), { at: [x, 1.14, z], color: '#2a2020' });
        for (const sx of [-1, 1]) b.add(new THREE.SphereGeometry(0.02, 6, 5), { at: [x + sx * 0.04, 1.05, z + 0.067], color: '#2a2020' });
        b.add(new THREE.BoxGeometry(0.08, 0.02, 0.01), { at: [x, 0.97, z + 0.067], color: '#b82f25' });
      };
      post(-5.4, -1.3, '#e8c9a0');
      post(-4.9, -1.2, '#d9b48a');
      // (the pole with the bird on it)
      foot(-4.4, -1.5, 0.05);
      b.add(new THREE.CylinderGeometry(0.014, 0.022, 1.8, 6), { at: [-4.4, 0.9, -1.5], color: wood });
      b.add(new THREE.SphereGeometry(0.07, 8, 6), { at: [-4.4, 1.84, -1.5], scale: [1.7, 0.7, 0.7], color: wood[1] });
      b.add(new THREE.ConeGeometry(0.02, 0.09, 5), { at: [-4.25, 1.86, -1.5], rot: [0, 0, -Math.PI / 2], color: wood[0] });
    });
    const paddy = [];
    place(-4.2, 1.9, () => {
      clearing(-4.2, 1.9, 1.9);
      for (const [x, z, w, d] of [[-4.2, 1.2, 3.1, 0.06], [-4.2, 2.6, 3.1, 0.06], [-5.75, 1.9, 0.06, 1.46], [-2.65, 1.9, 0.06, 1.46]]) b.add(new THREE.BoxGeometry(w, 0.06, d), { at: [x, 0.03, z], color: ['#8a6a48', '#b08c62'] });
      paddy.push(-4.2, 1.9);
    });
    place(0.5, -5.0, () => {
      clearing(0.5, -5.0, 1.2);
      tree(b, q(4), 0.5, -5.0, { s: 2.0, leaves: ['#e0b01c', '#ffe27a'], trunk: ['#4f362b', '#6f4e3e'], puffs: 8 });
    });
    place(4.2, 2.0, () => flowerField(b, q(5), 4.2, 2.0, 1.3, 0.8, 110, ['#ffd23f', '#ffffff', '#c98ae0', '#ff9a4a']));
    const fall = [['#d9a21c', '#ffe27a'], ['#c9722a', '#f0a848'], ['#b8452a', '#e8804a']];
    surround(
      r,
      (x, z, k) => {
        const pick = r();
        if (pick < 0.4) tree(b, r, x, z, { s: k, kind: 'pine', leaves: ['#2f6a4a', '#5a9a70'], trunk: ['#7a4630', '#a86a4a'] });
        else if (pick < 0.82) tree(b, r, x, z, { s: 0.95 * k, leaves: r.pick(fall), trunk: ['#4f362b', '#6f4e3e'] });
        else rock(b, r, x, z, 0.4 * k, stone);
      },
      (x, z, k) => {
        const pick = r();
        if (pick < 0.4) flowerPatch(b, r, x, z, 5, ['#ffd23f', '#ffffff', '#c98ae0']);
        else if (pick < 0.7) rock(b, r, x, z, 0.12 * k, stone);
        else bush(b, r, x, z, 0.14 * k, ['#8a8f3d', '#c9c95c']);
      },
      { nTall: 34, nLow: 100 }
    );
    H.group.add((H.scenery = b.mesh()));
    const dry = ['#b8a85a', '#9a9a4c', '#cdbd6a'];
    H.group.add(
      grassField(r, 130, () => {
        const [x, z] = edgeSpot(r, 1.08, 2.1);
        return z < -1.9 ? null : [x, z, r.range(0.05, 0.1)];
      }, dry, H.clock)
    );
    H.group.add(grassField(r, wide(300), () => [...farSpot(r), r.range(0.05, 0.12)], dry, H.clock));
    // (the rice: ripe, and heavy in the ear)
    if (paddy.length) {
      const dice = q(3);
      H.group.add(grassField(dice, 900, () => [paddy[0] + dice.range(-1.45, 1.45), paddy[1] + dice.range(-0.62, 0.62), dice.range(0.2, 0.3)], ['#d9b84a', '#e8cc6a', '#c9a23f', '#f0d878'], H.clock));
    }
    const leaves = new Drift(r, { count: 70, colors: ['#d9822b', '#f0b03c', '#f6c33c', '#c9552e'], fall: 0.22, sway: 0.4, wind: 0.12, size: 0.065, tex: petalTexture() });
    H.group.add(leaves.points);
    H.updaters.push((dt, t) => leaves.update(dt, t));
    // at night the lanterns under the eaves are lit
    const lamp = new THREE.PointLight('#ffb070', 0, 3.4, 1.5);
    lamp.position.set(0, 0.62, hz + 0.95);
    H.group.add(lamp);
    H.updaters.push((dt, t, world) => (lamp.intensity = world.night ? 3 + Math.sin(t * 6) * 0.15 : 0));
    H.litter = '🍂';
    // out of the rain: under the eaves, along the front of the house — and under the persimmon tree
    const eaves = (x) => ({ x, z: hz + 0.86, yaw: 0, lie: true });
    H.shelters.push({ roof: { x: 0, z: hz + 0.2, r: 1.0 }, spots: [eaves(0), eaves(0.62), eaves(-0.62)] }, { roof: { x: 1.1, z: hz + 0.2, r: 1.0 }, spots: [eaves(1.24)] }, under(-2.35, -1.65, 1.3, [[0.9, 0.5], [0.25, 0.5], [1.5, 0.52]]));
    H.obstacles.push({ x: -2.35, z: -1.65, r: 0.13 }, { x: -1.95, z: -1.8, r: 0.2 });
    return H;
  },
};

export const HABITAT_IDS = Object.keys(HABITATS);

/** A habitat, built — the meadow and the farm for a `season` (the others are the same all year). */
export function buildHabitat(id, season, { small = false } = {}) {
  const key = HABITATS[id] ? id : 'meadow';
  NOW.small = small; // (for a small picture only what stands round the yard is made)
  const H = HABITATS[key](rng(key.length * 7919 + key.charCodeAt(0) * 31), season);
  H.season = season || null;
  return H;
}
