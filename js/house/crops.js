// 베란다 텃밭 — what grows in the planter boxes on the veranda (veranda.js), each as it is now: the seeds just sown, the
// first two round leaves, a plant coming on, its flowers, and what there is to pick — red-edged lettuce in two heads, a
// row of spring onions, a cherry tomato up its cane, strawberries hanging over the side. A box left dry droops (and
// comes back when it is watered). Each plant is built afresh when it has grown a step (k, in fortieths) — one mesh of
// leaves and one of what is glossy; where what can be picked is, her hand goes (picks()), and once she has it, it is gone
// (take()).
//
// And what she tends them with — the watering can, the basket she picks into, a packet of seeds, the little stake with
// the name on it — and what she picks, to hold (at the girls' measure, in the frame of her hand: food.js).
//
// The plants stand in the room's measure (she is 1.3 tall) on the soil of their box at y = 0, the box's front to +Z.
import * as THREE from '../vendor/three.module.min.js';
import { MAT, V, TAU, rng, paintTexture } from './shapes.js';
import { piece, mark } from './dishkit.js';

const C = (hex) => new THREE.Color(hex);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ease = (k) => k * k * (3 - 2 * k);
/* 0 before `a`, 1 after `b`, and in between a straight way up */
const step = (a, b, k) => clamp((k - a) / (b - a), 0, 1);
const IDENT = new THREE.Matrix4();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _p = V();
const _n = V();
const _nm = new THREE.Matrix3();
const _c = new THREE.Color();

/*
 * Many small shapes as one mesh (as kit.js's Batch) — but coloured by where on its own piece a point is: by the piece's
 * uv (on a leaf, u across it and v up it; on a stem, u along it), so that a leaf can be pale at its stalk and red at its
 * edge, a spring onion white at its root.
 */
class Bunch {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
  }

  /** `geo` (used up) placed by `matrix`, coloured `color`: a hex, or (u, v) → a THREE.Color. */
  add(geo, matrix, color) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position;
    const N = g.attributes.normal;
    const UV = g.attributes.uv;
    _nm.getNormalMatrix(matrix);
    const one = typeof color === 'function' ? null : C(color);
    for (let i = 0; i < P.count; i++) {
      _p.fromBufferAttribute(P, i).applyMatrix4(matrix);
      this.pos.push(_p.x, _p.y, _p.z);
      _n.fromBufferAttribute(N, i).applyMatrix3(_nm).normalize();
      this.nor.push(_n.x, _n.y, _n.z);
      const c = one || color(UV ? UV.getX(i) : 0, UV ? UV.getY(i) : 0);
      this.col.push(c.r, c.g, c.b);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }

  mesh(material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    const m = new THREE.Mesh(g, material);
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  }

  get empty() {
    return !this.pos.length;
  }
}

/* A place and a turn: at `at`, turned `yaw` round the upright, its top tipped `tilt` out (away along −Z, as it faces). */
function placed(at, yaw, tilt, roll = 0, s = 1) {
  return _m.compose(_p.set(...at), _q.setFromEuler(_e.set(-tilt, yaw, roll, 'YXZ')), _n.set(s, s, s)).clone();
}

/*
 * A leaf: a sheet bent into shape — `len` long up +Y from where its stalk joins at the origin, its face to +Z; `width(v)`
 * its half-width (in lengths) along it, v from 0 at the stalk to 1 at the tip; `cup` how far its sides come up, `curl`
 * how far it arches back as it goes (radians, stalk to tip), `ruffle` how wavy its edge is. Its uv stays as the plane's.
 */
function leafGeo(len, width, { cup = 0.3, curl = 0, ruffle = 0, nu = 6, nv = 8, seed = 0 } = {}) {
  const g = new THREE.PlaneGeometry(1, 1, nu, nv);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const u = P.getX(i) * 2; // −1 … 1 across
    const v = P.getY(i) + 0.5; // 0 … 1 up
    const hw = width(v) * len;
    // the midrib: an arc, back from the face as it goes up (its radius len / curl)
    const a = curl * v;
    let y = v * len;
    let z = 0;
    if (Math.abs(curl) > 1e-3) {
      const r = len / curl;
      y = Math.sin(a) * r;
      z = -(1 - Math.cos(a)) * r;
    }
    // across it: the sides up (and wavy at the edge), along the face's normal there
    const lift = cup * u * u * hw + ruffle * Math.sin(v * 31 + u * 2 + seed) * u ** 4 * hw;
    P.setXYZ(i, u * hw, y + lift * Math.sin(a), z + lift * Math.cos(a));
  }
  g.computeVertexNormals();
  return g;
}

/* Where on such a leaf, at v up it, its midrib is (in its own frame) — where a hand goes for it. */
function alongLeaf(len, curl, v) {
  if (Math.abs(curl) < 1e-3) return V(0, v * len, 0);
  const r = len / curl;
  return V(0, Math.sin(curl * v) * r, -(1 - Math.cos(curl * v)) * r);
}

// (the leaves' outlines: half-width along them)
const W_LETTUCE = (v) => 0.62 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(v, 1.25))), 0.5) * (0.2 + 0.8 * Math.min(1, v * 2.5));
const W_ROUND = (v) => 0.42 * Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.6);
const W_BERRY = (v) => 0.36 * Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.75) * (1 + 0.1 * Math.abs(Math.sin(v * Math.PI * 6)));
const W_TOMATO = (v) => 0.27 * Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.8) * (1 + 0.14 * Math.abs(Math.sin(v * Math.PI * 4)));
const W_SEPAL = (v) => 0.3 * Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(v, 0.7))), 0.9);

/* A stem through `pts` (a little curve), `r` thick. Its uv: u along it, from the first point to the last. */
function stem(B, pts, r, color, seg = 10) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => (p.isVector3 ? p : V(...p))));
  B.add(new THREE.TubeGeometry(curve, seg, r, 5, false), IDENT, color);
  return curve;
}

/* A cylinder `h` tall from its foot, bent over sideways (`lean` at its top, along x) and drooping (`droop`, out along −Z:
   the way placed() tips it), thinner at the top — a spring onion, a cane. Its uv: v up it. */
function bentRod(rBottom, rTop, h, lean, droop, seg = 7) {
  const g = new THREE.CylinderGeometry(rTop, rBottom, h, 7, seg);
  const P = g.attributes.position;
  for (let i = 0; i < P.count; i++) {
    const y = P.getY(i) + h / 2;
    const t = y / h;
    P.setXYZ(i, P.getX(i) + lean * t * t * h, y - droop * 0.45 * t ** 3 * h, P.getZ(i) - droop * t ** 3 * h);
  }
  g.computeVertexNormals();
  return g;
}

/* A flower: `n` petals round a middle, its face up and a little out towards `yaw`. */
function flower(B, G, at, yaw, { r = 0.012, n = 5, petal = '#ffffff', middle = '#ffd23f', tilt = 0.5 } = {}) {
  const m = placed(at, yaw, tilt);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    const g = new THREE.CircleGeometry(r * 0.55, 8);
    g.scale(1, 1.25, 1);
    g.translate(0, r * 0.62, 0);
    g.rotateZ(a);
    g.rotateX(-Math.PI / 2 + 0.25);
    B.add(g, m, petal);
  }
  const mid = new THREE.SphereGeometry(r * 0.38, 8, 6);
  mid.scale(1, 0.55, 1);
  G.add(mid, m, middle);
}

/* The seeds just sown: a few, pale on the soil, where each plant will come up. */
function seeds(B, spots, rnd) {
  for (const [x, z] of spots)
    for (let i = 0; i < 3; i++) {
      const g = new THREE.SphereGeometry(0.006, 6, 4);
      g.scale(1, 0.55, 0.7);
      B.add(g, placed([x + rnd.range(-0.022, 0.022), 0.003, z + rnd.range(-0.02, 0.02)], rnd() * TAU, 0), '#efe2c4');
    }
}

/* The first two round leaves (as everything comes up, until its own leaves take over), `s` grown. */
function sprout(B, x, z, s, wilt, rnd, color = '#9ad66a') {
  const h = 0.012 + 0.03 * s;
  const lean = (rnd() - 0.5) * 0.3;
  stem(B, [[x, 0, z], [x + lean * h * 0.3, h * 0.6, z], [x + lean * h * 0.4, h, z]], 0.0028 + 0.0016 * s, '#b9e08a', 4);
  const yaw = rnd() * TAU;
  for (const side of [0, Math.PI]) {
    const g = leafGeo(0.016 + 0.024 * s, W_ROUND, { cup: 0.4, curl: 0.4 + wilt });
    B.add(g, placed([x + lean * h * 0.4, h, z], yaw + side, 1.05 + wilt * 0.5), (u, v) => _c.set(color).lerp(C('#d9efb0'), 0.4 * (1 - v)));
  }
}

const DULL = C('#b2ab64'); // (a dry leaf goes this way)

// ------------------------------------------------------------------ 🥬 lettuce: two heads of red-edged leaves

function lettuce({ k, ripe, wilt, taken }, rnd) {
  const B = new Bunch();
  const G = new Bunch();
  const picks = [];
  const heads = [[-0.135, 0.008], [0.135, -0.004]];
  if (k < 0.06) {
    seeds(B, heads, rnd);
    return { B, G, picks };
  }
  const g = ease(step(0.06, 1, k)); // (how grown: 0 … 1)
  if (k < 0.4) heads.forEach(([x, z]) => sprout(B, x, z, step(0.06, 0.3, k), wilt, rnd));
  if (k < 0.16) return { B, G, picks };
  // the leaves of both heads, oldest (outermost) first — the ones she picks first: the old ones lie out and flop over, the
  // young ones stand up in the heart, cupped round it
  const n = Math.round(4 + 8 * step(0.16, 1, k));
  const big = 0.035 + 0.125 * g;
  const pale = C('#f2f9d8');
  const green = C('#86cc58');
  const bright = C('#b4e27a');
  const red = C('#b23a62');
  const leaves = [];
  for (let i = 0; i < n; i++) for (let h = 0; h < 2; h++) leaves.push({ i, h, age: 1 - i / n });
  leaves.forEach((l, j) => {
    if (ripe && j < taken) return; // (picked)
    const [x, z] = heads[l.h];
    const theta = l.i * 2.39996 + l.h * 1.7 + rnd() * 0.3;
    const len = big * (0.45 + 0.55 * l.age) * (0.9 + 0.2 * rnd());
    const tilt = 0.12 + 1.1 * l.age * (0.5 + 0.5 * g) + wilt * 0.5 * l.age;
    const curl = -0.5 + 1.3 * l.age + wilt * 0.9;
    const geo = leafGeo(len, W_LETTUCE, { cup: 0.55, curl, ruffle: 0.11, nu: 10, nv: 16, seed: j });
    const at = [x + Math.sin(theta) * 0.008 * l.age, 0.004, z + Math.cos(theta) * 0.008 * l.age];
    const m = placed(at, theta, tilt);
    // (the older a leaf, the redder its frilly edge: red-leaf lettuce, as it grows on a veranda)
    B.add(geo, m, (u, v) => {
      const edge = Math.abs(u * 2 - 1);
      const c = _c.copy(pale).lerp(green, Math.min(1, v * 2)).lerp(bright, 0.35 * (1 - l.age));
      c.lerp(red, clamp(edge ** 1.5 * v * (0.35 + 0.65 * l.age), 0, 0.85));
      if (edge < 0.09) c.lerp(pale, 0.5);
      if (wilt) c.lerp(DULL, wilt * 0.5);
      return c;
    });
    if (ripe && picks.length < 3 - taken) picks.push(alongLeaf(len, curl, 0.55).applyMatrix4(m));
  });
  return { B, G, picks };
}

// ------------------------------------------------------------------ 🌿 spring onions: a row of them

function leek({ k, ripe, wilt, taken }, rnd) {
  const B = new Bunch();
  const G = new Bunch();
  const picks = [];
  const xs = [-0.18, -0.06, 0.06, 0.18];
  if (k < 0.06) {
    seeds(B, xs.map((x) => [x, 0]), rnd);
    return { B, G, picks };
  }
  const H = 0.04 + 0.36 * ease(step(0.06, 1, k));
  const cut = ripe ? taken * 2 : 0; // (cut two at a time, from the left)
  const white = C('#f6f4e6');
  const light = C('#a8dc7e');
  const dark = C('#3f9a46');
  const color = (base) => (u, v) => {
    const c = v < base ? _c.copy(white).lerp(light, step(base * 0.7, base, v)) : _c.copy(light).lerp(dark, step(base, 1, v));
    if (wilt) c.lerp(DULL, wilt * 0.45 * v);
    return c;
  };
  xs.forEach((x, i) => {
    const z = (rnd() - 0.5) * 0.04;
    if (i < cut) {
      // cut: a stub of white, the green just showing
      B.add(bentRod(0.017, 0.016, 0.03, 0, 0, 2), placed([x, 0, z], 0, 0), color(0.7));
      return;
    }
    // the white shaft, and out of its top a fan of hollow green leaves, bending away (and flopping, when it is dry)
    const h = H * (0.86 + 0.18 * rnd());
    const shaft = h * 0.4;
    B.add(bentRod(0.018, 0.0135, shaft, 0, 0, 3), placed([x, 0, z], 0, 0), color(0.75));
    const fan = h < 0.08 ? 1 : 3;
    const yaw0 = rnd() * TAU;
    for (let f = 0; f < fan; f++) {
      const len = (h - shaft) * (f ? 0.82 + 0.25 * rnd() : 1.05) + 0.02;
      const yaw = yaw0 + (f / fan) * TAU + rnd() * 0.5;
      const geo = bentRod(0.0105, 0.0022, len, 0, (f ? 0.4 : 0.12) + wilt * 0.45);
      B.add(geo, placed([x, shaft * 0.92, z], yaw, f ? 0.3 + 0.18 * rnd() : 0.06), color(0.08));
    }
  });
  if (ripe) for (let p = taken; p < 2; p++) picks.push(V((xs[p * 2] + xs[p * 2 + 1]) / 2, 0.05, 0));
  return { B, G, picks };
}

// ------------------------------------------------------------------ 🍅 a cherry tomato, up its cane

function tomato({ k, ripe, wilt, taken }, rnd) {
  const B = new Bunch();
  const G = new Bunch();
  const picks = [];
  const at = [0, 0.012];
  if (k < 0.06) {
    seeds(B, [at], rnd);
    return { B, G, picks };
  }
  if (k < 0.3) sprout(B, at[0], at[1], step(0.06, 0.25, k), wilt, rnd, '#8fcf62');
  if (k < 0.14) return { B, G, picks };
  const g = ease(step(0.14, 0.86, k));
  const H = 0.05 + 0.48 * g;
  // the cane (once there is something to tie to it), and the twine
  const cane = [0.03, -0.035];
  if (k > 0.24) {
    B.add(bentRod(0.0055, 0.0045, 0.62, 0, 0, 4), placed([cane[0], 0, cane[1]], 0, 0), (u, v) => _c.set('#d9b56a').lerp(C('#c39a52'), Math.abs(Math.sin(v * 21)) > 0.95 ? 0.8 : 0));
    for (const y of [0.18, 0.36].filter((y) => y < H)) G.add(new THREE.TorusGeometry(0.012, 0.0022, 4, 10), placed([cane[0] - 0.006, y, cane[1] + 0.004], 0, Math.PI / 2), '#fff6e6');
  }
  // the stem: up, weaving round the cane a little
  const pts = [];
  for (let i = 0; i <= 6; i++) {
    const t = i / 6;
    pts.push(V(at[0] + Math.sin(t * 5.5) * 0.02 * t, t * H, at[1] + Math.cos(t * 4.5) * 0.012 * t - 0.012 * t));
  }
  const curve = stem(B, pts, 0.0065 + 0.0025 * g, (u) => _c.set('#7fb84f').lerp(C('#5f9a3f'), u), 12);
  // the leaves: up the stem, each a stalk with leaflets along it, drooping when dry
  const n = Math.round(3 + 8 * step(0.14, 0.86, k));
  const leafC = (u, v) => {
    const c = _c.set('#47903f').lerp(C('#7cc06a'), 0.45 * v);
    if (wilt) c.lerp(DULL, wilt * 0.5);
    return c;
  };
  for (let i = 0; i < n; i++) {
    const t = (i + 0.6) / (n + 0.4);
    const base = curve.getPoint(t * 0.95);
    const yaw = i * 2.4 + rnd() * 0.4;
    const len = (0.06 + 0.085 * g) * (1.1 - 0.4 * t);
    const out = V(Math.sin(yaw), 0, Math.cos(yaw));
    const droop = 0.25 + wilt * 0.6;
    const tip = base.clone().addScaledVector(out, len).add(V(0, len * (0.25 - droop), 0));
    const mid = base.clone().addScaledVector(out, len * 0.55).add(V(0, len * 0.18, 0));
    stem(B, [base, mid, tip], 0.0028, '#6fae4a', 5);
    const leaflets = [[0.45, 1], [0.45, -1], [0.8, 1], [0.8, -1], [1, 0]];
    for (const [f, side] of leaflets) {
      const p = f < 1 ? base.clone().lerp(mid, f / 0.55 > 1 ? 1 : f / 0.55).lerp(tip, Math.max(0, f - 0.55) / 0.45) : tip;
      const lyaw = yaw + side * 1.05;
      const geo = leafGeo(len * 0.5 * (f < 1 ? 0.85 : 1), W_TOMATO, { cup: 0.35, curl: 0.5 + wilt });
      B.add(geo, placed([p.x, p.y, p.z], lyaw, 1.25 + droop * 0.4), leafC);
    }
  }
  // its flowers, and then its fruit: two trusses
  const trusses = [0.48, 0.74].map((t) => curve.getPoint(t));
  const fruitK = step(0.72, 1, k);
  if (k > 0.56 && k < 0.92) {
    trusses.forEach((p, j) => {
      for (let i = 0; i < 3; i++) {
        const yaw = j * 2.7 + i * 0.9;
        flower(B, G, [p.x + Math.sin(yaw) * 0.03, p.y - 0.008 - i * 0.006, p.z + Math.cos(yaw) * 0.03], yaw, { r: 0.0085, n: 5, petal: '#ffd23f', middle: '#f2a43a', tilt: 1.2 });
      }
    });
  }
  if (k >= 0.72) {
    // (green, then turning, then red — the size coming as they colour)
    const r = 0.013 + 0.021 * ease(Math.min(1, fruitK * 1.25));
    const color = ripe ? C('#e8382f') : fruitK < 0.75 ? C('#86c046').lerp(C('#a9d35a'), fruitK / 0.75) : C('#f5a23a').lerp(C('#e8572f'), (fruitK - 0.75) / 0.25);
    let f = 0;
    trusses.forEach((p, j) => {
      const yaw = j * 2.7 + 0.6;
      const out = V(Math.sin(yaw), 0, Math.cos(yaw));
      const hang = p.clone().addScaledVector(out, 0.045).add(V(0, -0.02, 0));
      stem(B, [p, p.clone().addScaledVector(out, 0.03).add(V(0, 0.01, 0)), hang], 0.0022, '#6fae4a', 4);
      const count = j ? 2 : 3;
      for (let i = 0; i < count; i++, f++) {
        if (ripe && f < taken) continue; // (picked)
        const off = V(Math.sin(yaw + i * 1.9) * r * 1.3, -r * (1.1 + i * 0.9), Math.cos(yaw + i * 1.9) * r * 1.3);
        const c = hang.clone().add(off);
        const geo = new THREE.SphereGeometry(r, 14, 10);
        geo.scale(1, 0.9, 1);
        G.add(geo, placed([c.x, c.y, c.z], 0, 0), color);
        for (let s = 0; s < 5; s++) B.add(leafGeo(r * 0.75, W_SEPAL, { cup: 0.2, curl: -0.6 }), placed([c.x, c.y + r * 0.82, c.z], (s / 5) * TAU, 1.35), '#5f9a3f');
        if (ripe) picks.push(c);
      }
    });
  }
  return { B, G, picks };
}

// ------------------------------------------------------------------ 🍓 strawberries: two plants, the berries hanging out

function strawberry({ k, ripe, wilt, taken }, rnd) {
  const B = new Bunch();
  const G = new Bunch();
  const picks = [];
  const crowns = [[-0.145, -0.012], [0.145, -0.012]];
  if (k < 0.06) {
    seeds(B, crowns, rnd);
    return { B, G, picks };
  }
  if (k < 0.32) crowns.forEach(([x, z]) => sprout(B, x, z, step(0.06, 0.26, k), wilt, rnd, '#7fc456'));
  if (k < 0.15) return { B, G, picks };
  const g = ease(step(0.15, 0.7, k));
  const leafC = (u, v) => {
    const c = _c.set('#3f8a4c').lerp(C('#68b25a'), 0.45 * v + 0.25 * (1 - Math.abs(u * 2 - 1)));
    if (wilt) c.lerp(DULL, wilt * 0.5);
    return c;
  };
  crowns.forEach(([x, z], h) => {
    // the leaves: on long stalks out from the crown, three toothed leaflets at each end
    const n = Math.round(2 + 5 * step(0.15, 0.7, k));
    for (let i = 0; i < n; i++) {
      const yaw = i * 2.39996 + h * 0.9;
      const out = V(Math.sin(yaw), 0, Math.cos(yaw));
      const len = (0.04 + 0.09 * g) * (0.8 + 0.3 * rnd());
      const droop = wilt * 0.6;
      const tip = V(x, 0, z).addScaledVector(out, len * 0.7).add(V(0, len * (0.85 - droop), 0));
      const mid = V(x, 0, z).addScaledVector(out, len * 0.25).add(V(0, len * 0.6, 0));
      stem(B, [V(x, 0, z), mid, tip], 0.0026, '#7cb84f', 5);
      for (const side of [-1, 0, 1]) {
        const geo = leafGeo((0.026 + 0.026 * g) * (side ? 0.9 : 1), W_BERRY, { cup: 0.45, curl: 0.35 + wilt });
        B.add(geo, placed([tip.x, tip.y, tip.z], yaw + side * 0.85, 1.1 + droop * 0.5 + Math.abs(side) * 0.15), leafC);
      }
    }
    // flowers on their own stalks, then the berries (white-green, blushing, red): one out over the front of the box, one
    // over its side — far enough to hang outside it
    const fk = step(0.7, 1, k);
    for (let i = 0; i < 2; i++) {
      const yaw = (h ? 1 : -1) * (i ? 1.45 : 0.25);
      const out = V(Math.sin(yaw), 0, Math.cos(yaw));
      const reach = (i ? 0.19 : 0.18) * (0.55 + 0.45 * g);
      const end = V(x, 0, z).addScaledVector(out, reach).add(V(0, 0.03, 0));
      const top = V(x, 0, z).addScaledVector(out, reach * 0.45).add(V(0, 0.05 + 0.025 * g, 0));
      if (k > 0.52 && k < 0.84) {
        const bloom = V(x, 0, z).addScaledVector(out, reach * 0.7).add(V(0, 0.075, 0));
        stem(B, [V(x, 0.01, z), top, bloom], 0.0022, '#7cb84f', 5);
        flower(B, G, [bloom.x, bloom.y, bloom.z], yaw, { r: 0.013, n: 5, petal: '#ffffff', middle: '#ffd23f', tilt: 0.7 });
      }
      if (k < 0.7) continue;
      const j = h * 2 + i;
      if (ripe && j < taken) continue; // (picked)
      stem(B, [V(x, 0.01, z), top, end], 0.0022, '#7cb84f', 5);
      const L = 0.022 + 0.026 * ease(fk);
      const R = L * 0.42;
      const prof = [[0, 0], [0.32, 0.12], [0.62, 0.32], [0.9, 0.58], [1.0, 0.78], [0.88, 0.93], [0.5, 1.0], [0.001, 1.02]].map(([r, y]) => new THREE.Vector2(r * R, y * L));
      const color = ripe ? C('#e3263f') : fk < 0.6 ? C('#e6f0c2').lerp(C('#f4f2d8'), fk / 0.6) : C('#f6d6c8').lerp(C('#ef5c66'), (fk - 0.6) / 0.4);
      const berry = V(end.x, end.y - L - 0.004, end.z);
      G.add(new THREE.LatheGeometry(prof, 14), placed([berry.x, berry.y, berry.z], 0, 0), (u, v) => _c.copy(color).lerp(C('#fff4e0'), ripe ? 0 : 0.15 * (1 - v)));
      for (let s = 0; s < 6; s++) B.add(leafGeo(R * 1.15, W_SEPAL, { cup: 0.2, curl: -0.5 }), placed([berry.x, berry.y + L * 0.98, berry.z], (s / 6) * TAU, 1.45), '#4f9a4a');
      if (ripe) picks.push(berry.clone().add(V(0, L * 0.5, 0)));
    }
  });
  return { B, G, picks };
}

const BUILD = { lettuce, leek, tomato, strawberry };
const TALL = { lettuce: 0.012, leek: 0.03, tomato: 0.022, strawberry: 0.01 }; // (how far each sways in the wind)
const PIECES = { lettuce: 3, leek: 2, tomato: 5, strawberry: 4 }; // (what there is to pick on it, once it is ripe)

/**
 * A plant of `id` (lettuce, leek, tomato, strawberry) in a box: set({ k, ripe, wilt }) as it is now (k: 0 … 1 grown;
 * wilt: 0 … 1 dry) — built again only when that has changed enough to show. picks(): where what can be picked is (local),
 * the next first; take(): one of them is picked.
 */
export function makeCrop(id, seed = 1) {
  const object = new THREE.Group();
  const build = BUILD[id];
  let meshes = [];
  let key = '';
  let state = { k: 0, ripe: false, wilt: 0, taken: 0 };
  let picks = [];
  const phase = (seed % 97) * 0.13;
  const rebuild = () => {
    meshes.forEach((m) => {
      object.remove(m);
      m.geometry.dispose();
    });
    meshes = [];
    const r = build(state, rng(seed));
    for (const [b, mat] of [[r.B, MAT.leaf], [r.G, MAT.gloss]]) if (!b.empty) meshes.push(b.mesh(mat));
    meshes.forEach((m) => object.add(m));
    picks = r.picks;
  };
  return {
    object,
    id,
    set({ k = 0, ripe = false, wilt = 0 } = {}) {
      const q = { k: ripe ? 1 : Math.min(0.99, Math.round(k * 40) / 40), ripe: !!ripe, wilt: Math.round(clamp(wilt, 0, 1) * 4) / 4 };
      const next = `${q.k}|${q.ripe}|${q.wilt}`;
      if (next === key) return;
      key = next;
      state = { ...q, taken: 0 };
      rebuild();
    },
    picks: () => picks.slice(),
    /** How many there are to pick when it is ripe. */
    pieces: PIECES[id],
    take() {
      if (!state.ripe || !picks.length) return;
      state.taken += 1;
      rebuild();
    },
    update(dt, t, wind = 1) {
      const a = TALL[id] * wind;
      object.rotation.z = Math.sin(t * 1.3 + phase) * a;
      object.rotation.x = Math.cos(t * 0.9 + phase * 1.7) * a * 0.6;
    },
    dispose() {
      meshes.forEach((m) => m.geometry.dispose());
      meshes = [];
    },
  };
}

// ------------------------------------------------------------------ what she picks, in her hand

/**
 * What she has picked, held up in her hand (at the girls' measure, in the frame of her hand: +Y up, +Z the way she faces):
 * a lettuce leaf, two spring onions, a cherry tomato, a strawberry.
 */
export function makeProduce(id) {
  const object = new THREE.Group();
  const at = new THREE.Group();
  at.position.set(0, 0.01, 0.022);
  object.add(at);
  const B = new Bunch();
  const G = new Bunch();
  if (id === 'lettuce') {
    B.add(leafGeo(0.085, W_LETTUCE, { cup: 0.6, curl: 0.5, ruffle: 0.22 }), placed([0, -0.01, 0], 0, 0.5), (u, v) => _c.set('#e6f4c2').lerp(C('#7fc456'), Math.min(1, v * 1.7)).lerp(C('#a3365c'), clamp(Math.abs(u * 2 - 1) ** 2 * v * 0.7, 0, 0.7)));
  } else if (id === 'leek') {
    const white = C('#f6f4e6');
    for (const s of [-1, 1]) B.add(bentRod(0.007, 0.0035, 0.2, s * 0.02, 0), placed([s * 0.005, -0.03, 0], 0, 0.3), (u, v) => (v < 0.25 ? white : _c.set('#a8dc7e').lerp(C('#3f9a46'), (v - 0.25) / 0.75)));
  } else if (id === 'tomato') {
    const geo = new THREE.SphereGeometry(0.019, 14, 10);
    geo.scale(1, 0.9, 1);
    G.add(geo, IDENT, '#e8382f');
    for (let s = 0; s < 5; s++) B.add(leafGeo(0.014, W_SEPAL, { cup: 0.2, curl: -0.6 }), placed([0, 0.016, 0], (s / 5) * TAU, 1.35), '#5f9a3f');
  } else {
    const L = 0.045;
    const R = L * 0.42;
    const prof = [[0, 0], [0.32, 0.12], [0.62, 0.32], [0.9, 0.58], [1.0, 0.78], [0.88, 0.93], [0.5, 1.0], [0.001, 1.02]].map(([r, y]) => new THREE.Vector2(r * R, y * L));
    G.add(new THREE.LatheGeometry(prof, 14), placed([0, -0.012, 0], 0, 0), '#e3263f');
    for (let s = 0; s < 6; s++) B.add(leafGeo(R * 1.15, W_SEPAL, { cup: 0.2, curl: -0.5 }), placed([0, -0.012 + L * 0.98, 0], (s / 6) * TAU, 1.45), '#4f9a4a');
  }
  if (!B.empty) at.add(B.mesh(MAT.leaf));
  if (!G.empty) at.add(G.mesh(MAT.gloss));
  return { object };
}

// ------------------------------------------------------------------ what she tends them with

/**
 * The watering can (her right hand): mint, round, a long spout with a rose on the end. Held by the handle over its top, it
 * hangs below her hand; `tilt(k)` tips it forward round her hand (0 … 1) to water — `rose` is where the water comes out.
 */
export function makeCan(color = '#8fd6c0') {
  const object = new THREE.Group();
  const tip = new THREE.Group();
  object.add(tip);
  const can = new THREE.Group();
  can.position.set(0, -0.082, 0.004);
  tip.add(can);
  const body = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0.35 });
  const dark = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, 0, -0.18), roughness: 0.4, metalness: 0.3 });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    can.add(m);
    return m;
  };
  add(new THREE.CylinderGeometry(0.029, 0.034, 0.058, 22), body, 0, 0.029, 0);
  add(new THREE.SphereGeometry(0.029, 22, 8, 0, TAU, 0, Math.PI / 2), body, 0, 0.058, 0).scale.set(1, 0.38, 1);
  add(new THREE.TorusGeometry(0.0315, 0.0025, 6, 24), dark, 0, 0.058, 0, Math.PI / 2);
  add(new THREE.TorusGeometry(0.0335, 0.0025, 6, 24), dark, 0, 0.002, 0, Math.PI / 2);
  // the spout, out from low on its front and up — and the rose on its end
  const from = V(0, 0.014, 0.03);
  const to = V(0, 0.078, 0.104);
  const mid = from.clone().lerp(to, 0.5);
  const dir = to.clone().sub(from);
  const spout = add(new THREE.CylinderGeometry(0.0042, 0.0062, dir.length(), 10), body, mid.x, mid.y, mid.z);
  spout.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize());
  const rose = add(new THREE.CylinderGeometry(0.0115, 0.005, 0.014, 14), dark, to.x, to.y, to.z);
  rose.quaternion.copy(spout.quaternion);
  // the handles: one over the top, one up its back
  add(new THREE.TorusGeometry(0.028, 0.0034, 6, 18, Math.PI), dark, 0, 0.066, -0.004, 0, Math.PI / 2);
  add(new THREE.TorusGeometry(0.018, 0.003, 6, 14, Math.PI), dark, 0, 0.036, -0.033, 0, Math.PI / 2, -Math.PI / 2);
  // a heart on its side
  const heart = piece(new THREE.CircleGeometry(0.008, 12), '#ff8fb2', { at: [0.0335, 0.03, 0.002], rot: [0, Math.PI / 2, 0] });
  can.add(heart);
  const out = mark(to.x, to.y + 0.003, to.z + 0.006);
  can.add(out);
  return {
    object,
    rose: out,
    /** (on the floor: where its foot is, below where she would hold it) */
    foot: 0.082,
    tilt(k) {
      tip.rotation.x = k * 0.95;
    },
  };
}

/**
 * The basket she picks into (her left hand): woven, a handle arching over it — and what she has picked, piling up in it
 * (put(id)). It hangs below her hand by its handle.
 */
export function makeBasket() {
  const object = new THREE.Group();
  object.userData.basket = true; // (in her hand when she comes in: to the fridge with it — world.js)
  const hang = new THREE.Group();
  hang.position.set(0, -0.085, 0.004);
  object.add(hang);
  const weave = paintTexture(64, (g, S) => {
    g.fillStyle = '#c9965f';
    g.fillRect(0, 0, S, S);
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? '#e2b77a' : '#b98250';
        g.fillRect(x * 8 + 1, y * 8 + 1, 6, 6);
      }
  });
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping;
  weave.repeat.set(4, 1);
  const wicker = new THREE.MeshStandardMaterial({ map: weave, roughness: 0.85, side: THREE.DoubleSide });
  const prof = [[0.034, 0], [0.042, 0.004], [0.05, 0.03], [0.054, 0.046]].map(([r, y]) => new THREE.Vector2(r, y));
  const body = new THREE.Mesh(new THREE.LatheGeometry(prof, 20), wicker);
  body.castShadow = true;
  hang.add(body);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), wicker);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.002;
  hang.add(floor);
  const rimMat = new THREE.MeshStandardMaterial({ color: '#a8743f', roughness: 0.8 });
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.054, 0.0035, 6, 24), rimMat);
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.046;
  hang.add(rim);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.0035, 6, 18, Math.PI), rimMat);
  handle.position.y = 0.046;
  handle.castShadow = true;
  hang.add(handle);
  // a pink gingham cloth over one side of it
  const cloth = new THREE.Mesh(
    new THREE.CircleGeometry(0.03, 3),
    new THREE.MeshStandardMaterial({
      map: paintTexture(32, (g, S) => {
        g.fillStyle = '#fff4f7';
        g.fillRect(0, 0, S, S);
        g.fillStyle = 'rgba(255, 127, 168, 0.55)';
        for (let i = 0; i < 4; i++) {
          g.fillRect(i * 8 + 2, 0, 4, S);
          g.fillRect(0, i * 8 + 2, S, 4);
        }
      }),
      roughness: 0.95,
      side: THREE.DoubleSide,
    })
  );
  cloth.position.set(0.038, 0.044, 0.012);
  cloth.rotation.set(-0.3, 0.4, -1.0);
  hang.add(cloth);
  const inside = new THREE.Group();
  inside.position.y = 0.012;
  hang.add(inside);
  const mouth = mark(0, 0.05, 0);
  hang.add(mouth);
  const rnd = rng(31);
  let n = 0;
  return {
    object,
    /** Where she drops what she has picked into it. */
    mouth,
    put(id) {
      const p = makeProduce(id).object;
      const a = rnd() * TAU;
      const r = rnd.range(0, 0.03);
      p.position.set(Math.cos(a) * r, Math.min(0.03, 0.004 * n) - 0.02, Math.sin(a) * r);
      p.rotation.set(rnd.range(-0.6, 0.6), rnd() * TAU, rnd.range(-0.6, 0.6));
      p.scale.setScalar(0.7);
      inside.add(p);
      n++;
    },
    get count() {
      return n;
    },
  };
}

/** A packet of seeds (her right hand, as she sows): paper, the picture of what will grow on its front. */
export function makeSeeds(emoji, color = '#ffe3a8') {
  const object = new THREE.Group();
  const face = paintTexture(64, (g, S) => {
    g.fillStyle = color;
    g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(255, 255, 255, 0.7)';
    g.fillRect(0, 0, S, S * 0.16);
    g.font = `${S * 0.55}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(emoji, S / 2, S * 0.58);
  });
  const paper = new THREE.MeshStandardMaterial({ color: '#fbf3e4', roughness: 0.9 });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.05, 0.003), [paper, paper, paper, paper, new THREE.MeshStandardMaterial({ map: face, roughness: 0.9 }), paper]);
  m.position.set(0, 0.02, 0.02);
  m.rotation.x = -0.35;
  m.castShadow = true;
  object.add(m);
  return { object };
}

/** The little stake with the name of what is sown on it, stuck in the soil at the back of the box (the room's measure). */
export function makeStake(emoji, name) {
  const object = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: '#d9b07a', roughness: 0.8 });
  const stick = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.15, 0.004), wood);
  stick.position.y = 0.03;
  stick.castShadow = true;
  object.add(stick);
  const label = paintTexture(128, (g, S) => {
    g.clearRect(0, 0, S, S);
    g.fillStyle = '#fffaf2';
    const r = 18;
    g.beginPath();
    g.moveTo(r, S * 0.22);
    g.arcTo(S, S * 0.22, S, S * 0.78, r);
    g.arcTo(S, S * 0.78, 0, S * 0.78, r);
    g.arcTo(0, S * 0.78, 0, S * 0.22, r);
    g.arcTo(0, S * 0.22, S, S * 0.22, r);
    g.fill();
    g.strokeStyle = '#ffb3c9';
    g.lineWidth = 5;
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${S * 0.24}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    g.fillText(emoji, S * 0.17, S * 0.51);
    g.fillStyle = '#6b4a3a';
    g.font = `${name.length > 2 ? S * 0.18 : S * 0.21}px Jua, sans-serif`;
    g.fillText(name, S * 0.62, S * 0.53);
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.1), new THREE.MeshStandardMaterial({ map: label, transparent: true, roughness: 0.8, side: THREE.DoubleSide, alphaTest: 0.05 }));
  sign.position.set(0, 0.108, 0.003);
  sign.castShadow = true;
  object.add(sign);
  object.rotation.z = -0.08;
  return { object };
}
