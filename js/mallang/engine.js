/* ==================================================================
   말랑 놀이터 — the toys themselves: squishies (말랑이) and wax-cracking
   balls (왁뿌볼). A soft body worked out on the CPU and drawn with plain
   WebGL (no three.js), every sound synthesized, so there is nothing to
   load. Lengths are in ball radii; the table is y = 0.

   This is the toy of cover-studio/da.html, unchanged; what is around it
   on the screen (js/mallang/playground.js) is Dopamine World's.
   ================================================================== */

// ------------------------------------------------------------------ small maths

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const rand = Math.random;

function rng(seed) {
  let a = seed | 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Smooth noise, 0…1, for lumps. */
function noise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const h = (a, b, c) => {
    let n = (Math.imul(a, 374761393) + Math.imul(b, 668265263) + Math.imul(c, 1440662683)) | 0;
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  };
  let fx = x - xi, fy = y - yi, fz = z - zi;
  fx *= fx * (3 - 2 * fx);
  fy *= fy * (3 - 2 * fy);
  fz *= fz * (3 - 2 * fz);
  const near = lerp(lerp(h(xi, yi, zi), h(xi + 1, yi, zi), fx), lerp(h(xi, yi + 1, zi), h(xi + 1, yi + 1, zi), fx), fy);
  const far = lerp(lerp(h(xi, yi, zi + 1), h(xi + 1, yi, zi + 1), fx), lerp(h(xi, yi + 1, zi + 1), h(xi + 1, yi + 1, zi + 1), fx), fy);
  return lerp(near, far, fz);
}

const V = {
  add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
  sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
  mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
  dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
  cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
  len: (a) => Math.hypot(a[0], a[1], a[2]),
  norm: (a) => {
    const l = Math.hypot(a[0], a[1], a[2]) || 1;
    return [a[0] / l, a[1] / l, a[2] / l];
  },
};

// 3×3 matrices as nine numbers, row by row
const M3 = {
  ident: () => [1, 0, 0, 0, 1, 0, 0, 0, 1],
  mul(a, b) {
    const o = new Array(9);
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3] * b[c] + a[r * 3 + 1] * b[3 + c] + a[r * 3 + 2] * b[6 + c];
    return o;
  },
  apply: (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]],
  applyT: (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]],
  inv(m) {
    const [a, b, c, d, e, f, g, h, i] = m;
    const A = e * i - f * h, B = f * g - d * i, C = d * h - e * g;
    const det = a * A + b * B + c * C || 1e-9;
    return [A / det, (c * h - b * i) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, (c * d - a * f) / det, C / det, (b * g - a * h) / det, (a * e - b * d) / det];
  },
  axisAngle(u, t) {
    const [x, y, z] = u, c = Math.cos(t), s = Math.sin(t), k = 1 - c;
    return [c + x * x * k, x * y * k - z * s, x * z * k + y * s, y * x * k + z * s, c + y * y * k, y * z * k - x * s, z * x * k - y * s, z * y * k + x * s, c + z * z * k];
  },
  /** The shortest turn that takes unit vector a onto b. */
  arc(a, b) {
    const c = V.dot(a, b);
    if (c < -0.9999) return M3.axisAngle(V.norm(V.cross(a, Math.abs(a[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0])), Math.PI);
    const [x, y, z] = V.cross(a, b), k = 1 / (1 + c);
    return [c + x * x * k, x * y * k - z, x * z * k + y, y * x * k + z, c + y * y * k, y * z * k - x, z * x * k - y, z * y * k + x, c + z * z * k];
  },
  /** Squares a turn up again after many small ones have been multiplied into it. */
  ortho(m) {
    const a = V.norm([m[0], m[3], m[6]]);
    let b = [m[1], m[4], m[7]];
    b = V.norm(V.sub(b, V.mul(a, V.dot(a, b))));
    const c = V.cross(a, b);
    return [a[0], b[0], c[0], a[1], b[1], c[1], a[2], b[2], c[2]];
  },
  gl: (m) => new Float32Array([m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]),
};

function mul4(a, b) {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
}

/** '#rrggbb' as linear light, which is what the shaders work in. */
const lin = (hex) => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.pow(c / 255, 2.2));
};

// ------------------------------------------------------------------ the toys

/* depth   how far a finger sinks in            sink    how quickly
   k, g    [frequency, damping ratio] of the skin and of the body as a whole: above 1 it creeps back, below 1 it wobbles
   kappa   how briskly a poke travels on as a ripple   visc   how soon ripples die
   stick   how far the skin follows a finger before it slips   pull   how far it stretches before it snaps away
   face    1: a mochi's little face   2: a fox, markings and all   3: what is printed on a stick of butter
   wide    how many times wider than a ball it is: the camera draws back that far
   look    [how steeply the camera looks down on it (degrees), how high above the table its middle is]: a flat toy is seen from higher up
   voice   what it sounds like in the hand ('crunch': it crackles for as long as it is being worked) */
const TOYS = [
  {
    id: 'fox', name: '여우 말랑이', shape: 'fox', roll: false, knot: false,
    base: '#ee8a45', deep: '#ff5a26', gloss: 0.42, trans: 0.5, clear: 0, powder: 0.2, glitter: 0, face: 2, paint: 0, pore: 0,
    depth: 0.42, sink: 0.1, k: [14, 0.5], g: [10.5, 0.42], kappa: 2400, visc: 26, bulge: 0.22, lobe: 0.72,
    squash: 0.2, poisson: 0.5, stretch: 0.18, stick: 0.3, pull: 1.1, sit: 0.95, voice: 'sticky',
    bg: '#ecf6e6', floor: '#dcefd2', accent: '#f08a3e', dot: ['#ffc48f', '#ee7a2c'],
    hint: '귀랑 꼬리도 당겨 보세요 · 바닥을 옆으로 밀면 뒤돌아요', // its tail is behind it, out of sight from the front
  },
  {
    id: 'mochi', name: '찹쌀떡 모찌', shape: 'mochi', roll: false, knot: false,
    base: '#fff4f2', deep: '#ff97ae', gloss: 0.38, trans: 0.8, clear: 0, powder: 0.3, glitter: 0, face: 1, paint: 0, pore: 0,
    depth: 0.46, sink: 0.1, k: [15, 0.5], g: [11, 0.42], kappa: 2600, visc: 26, bulge: 0.24, lobe: 0.95,
    squash: 0.22, poisson: 0.5, stretch: 0.2, stick: 0.3, pull: 1.2, sit: 0.95, voice: 'sticky',
    bg: '#ffe6ec', floor: '#ffd6df', accent: '#ff7fa6', dot: ['#fff4f2', '#ffb3c4'],
  },
  {
    id: 'water', name: '반짝 물방울', shape: 'ball', roll: true, knot: true,
    base: '#8fdcff', deep: '#39b2ff', gloss: 1, trans: 0.9, clear: 1, powder: 0, glitter: 1, face: 0, paint: 0, pore: 0,
    depth: 0.4, sink: 0.07, k: [26, 0.14], g: [15, 0.13], kappa: 5200, visc: 9, bulge: 0.3, lobe: 0.9,
    squash: 0.24, poisson: 0.5, stretch: 0.14, stick: 0.1, pull: 0.6, sit: 0.94, voice: 'wet',
    bg: '#e2f5ff', floor: '#cdecff', accent: '#3fb3f2', dot: ['#c9f0ff', '#4dbbff'],
  },
  {
    id: 'peach', name: '복숭아 스퀴시', shape: 'peach', roll: false, knot: false,
    base: '#ffd9a8', deep: '#ff8f7a', gloss: 0.06, trans: 0.12, clear: 0, powder: 1, glitter: 0, face: 0, paint: 1, pore: 1,
    depth: 0.5, sink: 0.12, k: [5, 3.4], g: [4.5, 3.2], kappa: 260, visc: 40, bulge: 0, lobe: 0.8,
    squash: 0.16, poisson: 0.12, stretch: 0.05, stick: 0.12, pull: 0.25, sit: 0.985, voice: 'foam',
    bg: '#fff1de', floor: '#ffe3c6', accent: '#ff8a70', dot: ['#ffe1b0', '#ff8f86'],
  },
  {
    id: 'dough', name: '쫀득 도우볼', shape: 'ball', roll: true, knot: true,
    base: '#cdbcff', deep: '#8c6dff', gloss: 0.9, trans: 0.35, clear: 0, powder: 0, glitter: 0, face: 0, paint: 0, pore: 0,
    depth: 0.56, sink: 0.14, k: [6.5, 2.3], g: [6, 1.9], kappa: 900, visc: 40, bulge: 0.34, lobe: 1,
    squash: 0.28, poisson: 0.5, stretch: 0.24, stick: 0.4, pull: 1.5, sit: 0.94, voice: 'thick',
    bg: '#eee7ff', floor: '#ded2ff', accent: '#9a7bff', dot: ['#e2d8ff', '#9a7bff'],
  },
  {
    // 비누 말랑이 (크런치 비누 슬랑이): a white bar of "soap" with a waist, full of something that crunches
    id: 'soap', name: '비누 말랑이', shape: 'soap', roll: false, knot: false,
    base: '#fbfcfb', deep: '#9fd4ff', gloss: 0.38, trans: 0.4, clear: 0, powder: 0.1, glitter: 0, face: 0, paint: 0, pore: 0,
    depth: 0.34, sink: 0.13, k: [5, 2.6], g: [6, 1.7], kappa: 500, visc: 40, bulge: 0.3, lobe: 0.85,
    squash: 0.24, poisson: 0.5, stretch: 0.13, stick: 0.22, pull: 0.7, sit: 0.97, voice: 'crunch', wide: 1.2, look: [47, 0.5],
    bg: '#e4f7f3', floor: '#d2efe9', accent: '#35b7a5', dot: ['#ffffff', '#a7e3d8'],
    hint: '꾹꾹 누르면 바삭바삭 소리가 나요 · 꽉 쥐어도 돼요',
  },
];

// what is under the wax: clay in a clear skin, tied off with a knot
const INSIDE = {
  shape: 'ball', roll: true, knot: true, gloss: 0.92, trans: 0.4, clear: 0, powder: 0, glitter: 0, face: 0, paint: 0, pore: 0,
  depth: 0.5, sink: 0.11, k: [9, 1.2], g: [8.5, 0.95], kappa: 1400, visc: 36, bulge: 0.3, lobe: 0.95,
  squash: 0.26, poisson: 0.5, stretch: 0.2, stick: 0.32, pull: 1.1, sit: 0.94, voice: 'thick', wax: true,
};
const WAXES = [
  { id: 'cotton', name: '솜사탕', waxA: '#ffc3dc', waxB: '#b6dcff', base: '#ff9fc4', deep: '#ff5c98', bg: '#ffe8f1', floor: '#ffd7e6', accent: '#ff79ae', dot: ['#ffc3dc', '#b6dcff'] },
  { id: 'milk', name: '딸기우유', waxA: '#fff7f3', waxB: '#ffc6d4', base: '#ff8fae', deep: '#ff4f86', bg: '#ffeaee', floor: '#ffd9e0', accent: '#ff7798', dot: ['#fff7f3', '#ffb0c4'] },
  { id: 'soda', name: '소다', waxA: '#bfe6ff', waxB: '#eaf8ff', base: '#62c3ff', deep: '#2f9bff', bg: '#e4f4ff', floor: '#cfeaff', accent: '#44aef5', dot: ['#eaf8ff', '#8fd3ff'] },
  { id: 'choco', name: '초코', waxA: '#5b3a2b', waxB: '#7b5038', base: '#ffe9c6', deep: '#ffb163', bg: '#f6e9dc', floor: '#ecd9c6', accent: '#a9714c', dot: ['#8a5a3f', '#4e3024'] },
  { id: 'lemon', name: '레몬', waxA: '#fff1a6', waxB: '#fffbe4', base: '#ffdc55', deep: '#ffb400', bg: '#fff8dc', floor: '#fff0bb', accent: '#f2b705', dot: ['#fffbe4', '#ffe066'] },
  {
    // 버터 왁뿌볼: not a ball at all, but a stick-of-butter 말랑이 dipped in pale wax thin enough (see) for the print on it to show through
    id: 'butter', name: '버터', shape: 'butter', knot: false, face: 3, gloss: 0.22, trans: 0.5, powder: 0.12, depth: 0.3, lobe: 0.8, sit: 0.97, wide: 1.35, look: [47, 0.42], see: 0.5,
    waxA: '#fffdf7', waxB: '#fff8e8', base: '#ffeb96', deep: '#ffc44a', bg: '#eef3f8', floor: '#e0e8f1', accent: '#3f82c9', dot: ['#fff1b8', '#f7b52e'],
  },
].map((w) => ({ ...INSIDE, ...w }));

// where a fox keeps its parts, as directions from its middle (the left ear, cheek and paw mirror the right ones)
const FOX = (() => {
  const ear = V.norm([0.5, 0.8, 0.12]), earU = V.norm(V.cross([0, 0, 1], ear)); // earU runs across the ear, earV through it from back to front
  return { ear, earU, earV: V.cross(ear, earU), snout: V.norm([0, 0.3, 0.954]), cheek: V.norm([0.72, 0.02, 0.69]), tail: V.norm([0, -0.08, -1]), paw: V.norm([0.3, -0.52, 0.8]) };
})();

/** The outline of a toy: for a direction from its middle, the point of skin that lies that way. */
function shapeAt(kind, x, y, z) {
  if (kind === 'fox') {
    const d = [x, y, z], m = [Math.abs(x), y, z];
    const bump = (v, to, size, spread) => size * Math.exp(-(1 - V.dot(v, to)) / (spread * spread));
    let r = 1 + bump(m, FOX.snout, 0.16, 0.17) + bump(m, FOX.cheek, 0.07, 0.22) + bump(m, FOX.paw, 0.1, 0.13) + bump(d, FOX.tail, 0.62, 0.26);
    if (V.dot(m, FOX.ear) > 0.8) {
      // ears: tall points, thinner from front to back than they are wide
      const a = Math.hypot(V.dot(m, FOX.earU), V.dot(m, FOX.earV) / 0.62);
      r += 0.62 * Math.max(0, 1 - a / 0.3) ** 1.25;
    }
    const w = 1.05 + 0.08 * Math.max(0, -y);
    return [x * w * r, y * 0.86 * r, z * w * r];
  }
  if (kind === 'mochi') {
    const w = 1.08 + 0.07 * Math.max(0, -y);
    return [x * w, y * 0.8, z * w];
  }
  if (kind === 'peach') {
    const tip = Math.exp(-(1 - y) * 9);
    const crease = Math.exp(-(x * x) / 0.02) * smooth(-0.2, 0.4, z) * (1 - 0.4 * y * y);
    const r = 1 + 0.17 * tip - 0.08 * crease;
    return [x * r, y * r * 0.97, z * r];
  }
  if (kind === 'soap') {
    // a bar of soap: an oblong pillow, squarer than an oval both from above and from the side, and drawn in at the waist
    const flat = Math.pow(Math.pow(Math.abs(x), 4) + Math.pow(Math.abs(z), 4), 0.25);
    const k = Math.pow(Math.pow(flat, 2.6) + Math.pow(Math.abs(y), 2.6), -1 / 2.6), s = PROPORTIONS.soap;
    return [x * k * s[0], y * k * s[1], z * k * s[2] * waist(x * k)];
  }
  if (kind === 'butter') return stick(x, y, z, false);
  return [x, y, z];
}
const PROPORTIONS = { ball: [1, 1, 1], mochi: [1.1, 0.8, 1.1], peach: [1, 1.03, 1], fox: [1.08, 0.86, 1.08], soap: [1.34, 0.5, 0.86], butter: [1.5, 0.4, 0.5] };
// Toys that lie flat. A round toy's skin faces straight out from its middle, near enough for everything done here; theirs does not.
const SLAB = { soap: true, butter: true };
const EDGE = 0.1; // how far the edges of a stick of butter are rounded off
const waist = (x) => 1 - 0.15 * Math.exp(-(x * x) / 0.16); // how far a bar of soap is drawn in, along its length (−1…1)

/** A stick of butter is a box with its edges rounded off: the point of it that lies in a direction from its middle, or (facing) which way its skin faces there. */
function stick(x, y, z, facing) {
  const [hx, hy, hz] = PROPORTIONS.butter, m = Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
  const q = [(x / m) * hx, (y / m) * hy, (z / m) * hz]; // on the box as it would be with sharp edges
  const c = [clamp(q[0], EDGE - hx, hx - EDGE), clamp(q[1], EDGE - hy, hy - EDGE), clamp(q[2], EDGE - hz, hz - EDGE)];
  const n = V.norm(V.sub(q, c));
  return facing ? n : V.add(c, V.mul(n, EDGE));
}

/** Which way the skin of a toy faces, at the point of its outline that lies in a direction from its middle. */
function facing(kind, x, y, z) {
  if (!SLAB[kind]) return [x, y, z];
  if (kind === 'butter') return stick(x, y, z, true);
  // found from two short steps along the skin
  const u = V.norm(V.cross(Math.abs(y) < 0.9 ? [0, 1, 0] : [1, 0, 0], [x, y, z])), v = V.cross([x, y, z], u), e = 2e-3;
  const at = (s, t) => {
    const d = V.norm([x + u[0] * s + v[0] * t, y + u[1] * s + v[1] * t, z + u[2] * s + v[2] * t]);
    return shapeAt(kind, d[0], d[1], d[2]);
  };
  return V.norm(V.cross(V.sub(at(e, 0), at(-e, 0)), V.sub(at(0, e), at(0, -e))));
}

// ------------------------------------------------------------------ sound

/* Everything heard is filtered noise and a few sine blips: a crack is a
   bright snap, the plate giving way, and a scatter of tiny grains. */
const Sound = {
  ctx: null,
  lend: null, // () => the AudioContext to play through
  bus: null,
  noise: null,
  on: true,
  busy: [],

  /* Dopamine World has one AudioContext for everything (AudioSys in js/audio.js): the playground lends it. */
  open() {
    if (this.ctx) return this.ctx;
    this.ctx = (this.lend && this.lend()) || null;
    if (this.ctx) this.plumb(this.ctx);
    return this.ctx;
  },

  /* Everything goes out through one gain and a soft clip: a whole shell breaking is many sounds on top of
     each other. (Not a compressor node: it takes so long to open up that it swallows sounds this short.) */
  plumb(ctx) {
    const soft = ctx.createWaveShaper(), curve = new Float32Array(1025);
    for (let i = 0; i < 1025; i++) curve[i] = Math.tanh((i / 512 - 1) * 1.2) / Math.tanh(1.2);
    soft.curve = curve;
    soft.oversample = '2x';
    this.bus = ctx.createGain();
    this.bus.gain.value = 0.7;
    this.bus.connect(soft);
    soft.connect(ctx.destination);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = rand() * 2 - 1;
  },

  /* Browsers only allow audio after a tap — every press on the toy calls this. */
  wake() {
    const ctx = this.open();
    if (ctx && ctx.state !== 'running') {
      try {
        const p = ctx.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* sound is optional */
      }
    }
  },

  live() {
    return this.on && this.ctx && this.ctx.state === 'running';
  },

  /** One place in the stereo field for a whole sound. */
  at(pan) {
    const ctx = this.ctx;
    if (!ctx.createStereoPanner) return this.bus;
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1) * 0.7;
    p.connect(this.bus);
    return p;
  },

  /** True while there is room for more grains: a whole shell going at once must not turn into a roar. */
  room(n) {
    const now = this.ctx.currentTime;
    this.busy = this.busy.filter((t) => now - t < 0.09);
    if (this.busy.length > 70) return false;
    for (let i = 0; i < n; i++) this.busy.push(now);
    return true;
  },

  grain(t, f, q, dur, vol, to, type = 'bandpass', attack = 0.002) {
    const ctx = this.ctx, src = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this.noise;
    flt.type = type;
    flt.frequency.setValueAtTime(f, t);
    flt.Q.value = q;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(vol * 0.02, t + attack + dur);
    g.gain.linearRampToValueAtTime(0, t + attack + dur + 0.004);
    src.connect(flt);
    flt.connect(g);
    g.connect(to);
    src.start(t, rand() * 1.6, attack + dur + 0.03);
    return flt;
  },

  tone(t, f0, f1, dur, vol, to, type = 'sine') {
    const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.006);
    g.gain.exponentialRampToValueAtTime(vol * 0.02, t + dur);
    g.gain.linearRampToValueAtTime(0, t + dur + 0.004);
    o.connect(g);
    g.connect(to);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  /** Wax breaking. size 0…1: a chip … a whole plate. */
  crack(size, pan, delay = 0) {
    if (!this.live()) return;
    const bits = 3 + Math.round(size * 8);
    if (!this.room(bits + 2)) return;
    const t = this.ctx.currentTime + 0.004 + delay, to = this.at(pan);
    this.grain(t, 3800 + rand() * 2600, 0.7, 0.012, 0.35 + 0.75 * size, to, 'highpass');
    this.grain(t, lerp(2600, 1300, size) * (0.85 + 0.3 * rand()), 1.3, 0.025 + 0.05 * size, 0.9 + 1.9 * size, to);
    for (let i = 0; i < bits; i++) {
      this.grain(t + 0.012 + rand() * (0.04 + 0.13 * size), 2400 + rand() * 5200, 2 + rand() * 3, 0.006 + rand() * 0.016, Math.max(0.2, 1.1 - 0.08 * i) * (0.4 + rand() * 0.6) * (0.5 + size), to);
    }
    if (size > 0.45) this.tone(t, 170, 85, 0.07, 0.4 * size, to);
  },

  /** A crumb or a shard landing on the table. */
  tick(pan, vol) {
    if (!this.live() || !this.room(1)) return;
    this.grain(this.ctx.currentTime + 0.004, 3200 + rand() * 3000, 3, 0.009, vol * 3, this.at(pan));
  },

  /** A finger going in. */
  squish(pan, voice, amount = 1) {
    if (!this.live()) return;
    const t = this.ctx.currentTime + 0.004, to = this.at(pan);
    if (voice === 'foam') {
      this.grain(t, 1800, 0.6, 0.12, 0.22 * amount, to, 'bandpass', 0.03);
      return;
    }
    const thick = voice === 'thick', crunchy = voice === 'crunch'; // a crunchy one is mostly heard crackling (see crunch): the finger itself goes in quietly
    const f = this.grain(t, thick ? 520 : crunchy ? 600 : 760, 1.2, 0.15, (thick ? 1.25 : crunchy ? 0.5 : 0.75) * amount, to, 'lowpass', 0.02);
    f.frequency.exponentialRampToValueAtTime(240, t + 0.16);
    if (voice === 'wet') {
      this.tone(t + 0.02, 420 + rand() * 200, 900, 0.05, 0.12, to);
      this.tone(t + 0.07, 520 + rand() * 300, 1150, 0.04, 0.09, to);
    }
  },

  /** Sticky skin letting go of a finger. */
  pop(pan, vol = 1, pitch = 1) {
    if (!this.live()) return;
    const t = this.ctx.currentTime + 0.004, to = this.at(pan);
    this.tone(t, 240 * pitch, 640 * pitch, 0.06, 0.42 * vol, to);
    this.grain(t, 2600, 0.8, 0.006, 0.12 * vol, to, 'highpass');
  },

  blub(pan) {
    if (!this.live()) return;
    const t = this.ctx.currentTime + 0.004, to = this.at(pan);
    this.tone(t, 300 + rand() * 80, 620, 0.07, 0.32, to);
    this.tone(t + 0.06, 380 + rand() * 120, 800, 0.05, 0.2, to);
  },

  /** A stretched bit getting away and slapping back. */
  snap(pan) {
    if (!this.live()) return;
    const t = this.ctx.currentTime + 0.004, to = this.at(pan);
    this.tone(t, 190, 480, 0.07, 0.55, to);
    this.grain(t, 1600, 0.8, 0.035, 0.9, to, 'lowpass');
  },

  /** Foam drawing its air back in. */
  air(dur) {
    if (!this.live()) return;
    this.grain(this.ctx.currentTime + 0.004, 2400, 0.5, dur, 0.06, this.bus, 'bandpass', 0.18);
  },

  /** A crunchy filling being worked: n tiny crackles over the next moment (within), and now and then a bubble going. */
  crunch(pan, n, within = 0.03) {
    if (!this.live() || n < 1 || !this.room(n)) return;
    const t = this.ctx.currentTime + 0.004, to = this.at(pan);
    for (let i = 0; i < n; i++) {
      const at = t + rand() * within;
      if (rand() < 0.2) this.tone(at, 520 + rand() * 480, 1150 + rand() * 650, 0.016 + rand() * 0.02, 0.12 + rand() * 0.2, to);
      else this.grain(at, 1700 * Math.pow(4.2, rand()), 2.5 + rand() * 5, 0.004 + rand() * 0.011, 0.8 + rand() * 1.6, to);
    }
  },

  thud(v) {
    if (!this.live()) return;
    const t = this.ctx.currentTime + 0.004;
    this.tone(t, 120, 52, 0.16, 0.6 * v, this.bus);
    this.grain(t, 380, 0.7, 0.06, 1.2 * v, this.bus, 'lowpass');
  },

  pour() {
    if (!this.live()) return;
    const t = this.ctx.currentTime + 0.004;
    const f = this.grain(t, 700, 0.8, 0.75, 0.32, this.bus, 'lowpass', 0.25);
    f.frequency.exponentialRampToValueAtTime(1500, t + 0.9);
    for (let i = 0; i < 5; i++) this.tone(t + 0.15 + rand() * 0.7, 350 + rand() * 300, 800 + rand() * 300, 0.05, 0.08, this.bus);
  },

  tap() {
    if (!this.live()) return;
    this.tone(this.ctx.currentTime + 0.004, 740, 0, 0.07, 0.1, this.bus);
  },

  /** Two soft notes: something is finished. */
  chime() {
    if (!this.live()) return;
    const t = this.ctx.currentTime + 0.004;
    this.tone(t, 784, 0, 0.18, 0.16, this.bus, 'triangle');
    this.tone(t + 0.12, 1175, 0, 0.34, 0.16, this.bus, 'triangle');
  },
};

let buzzed = 0;
function buzz(ms) {
  const now = performance.now();
  if (!navigator.vibrate || now - buzzed < 45) return;
  if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return; // not allowed before the first whole tap
  buzzed = now;
  try {
    navigator.vibrate(ms);
  } catch (e) {
    /* not every phone lets a page do this */
  }
}

// ------------------------------------------------------------------ shapes to build from

/** A ball of even triangles, and which points each point touches. */
function icosphere(level) {
  const t = (1 + Math.sqrt(5)) / 2;
  const v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(V.norm);
  let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
  for (let l = 0; l < level; l++) {
    const mids = new Map(), next = [];
    const mid = (a, b) => {
      const key = a < b ? a * 65536 + b : b * 65536 + a;
      let m = mids.get(key);
      if (m === undefined) {
        m = v.length;
        v.push(V.norm(V.add(v[a], v[b])));
        mids.set(key, m);
      }
      return m;
    };
    for (const [a, b, c] of f) {
      const ab = mid(a, b), bc = mid(b, c), ca = mid(c, a);
      next.push([a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]);
    }
    f = next;
  }
  const n = v.length, dir = new Float32Array(n * 3), idx = new Uint16Array(f.length * 3), around = Array.from({ length: n }, () => []);
  v.forEach((p, i) => dir.set(p, i * 3));
  f.forEach((tri, i) => {
    idx.set(tri, i * 3);
    for (let k = 0; k < 3; k++) {
      const p = tri[k], q = tri[(k + 1) % 3];
      if (!around[p].includes(q)) around[p].push(q);
      if (!around[q].includes(p)) around[q].push(p);
    }
  });
  const nbr = new Uint16Array(n * 6); // the twelve corners have five neighbours: they count themselves as the sixth
  around.forEach((list, i) => {
    for (let k = 0; k < 6; k++) nbr[i * 6 + k] = k < list.length ? list[k] : i;
  });
  return { n, dir, idx, nbr };
}

/** Smooth normals for a mesh, summed from its faces. */
function faceNormals(pos, idx, out) {
  out.fill(0);
  for (let f = 0; f < idx.length; f += 3) {
    const a = idx[f] * 3, b = idx[f + 1] * 3, c = idx[f + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    out[a] += nx; out[a + 1] += ny; out[a + 2] += nz;
    out[b] += nx; out[b + 1] += ny; out[b + 2] += nz;
    out[c] += nx; out[c + 1] += ny; out[c + 2] += nz;
  }
}

/** The knot where the clear skin is tied off: a pinched, lumpy little bulb, standing on y = 0. */
function knotMesh() {
  const g = icosphere(2), pos = new Float32Array(g.n * 3), nrm = new Float32Array(g.n * 3);
  for (let i = 0; i < g.n; i++) {
    const x = g.dir[i * 3], y = g.dir[i * 3 + 1], z = g.dir[i * 3 + 2];
    const waist = 0.5 + 0.5 * smooth(-0.9, -0.1, y);
    const lump = 1 + 0.3 * (noise3(x * 2.4 + 5, y * 2.4, z * 2.4) - 0.5);
    pos.set([x * 0.105 * waist * lump, (y + 0.7) * 0.085, z * 0.105 * waist * lump], i * 3);
  }
  faceNormals(pos, g.idx, nrm);
  return { pos, nrm, idx: g.idx };
}

/** Keeps the part of a polygon where a·u + b·v ≤ c. */
function clip(poly, a, b, c) {
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length];
    const dp = a * p[0] + b * p[1] - c, dq = a * q[0] + b * q[1] - c;
    if (dp <= 0) out.push(p);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) {
      const t = dp / (dp - dq);
      out.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]);
    }
  }
  return out;
}

// ------------------------------------------------------------------ the soft body

/* The skin is a ball of points. Each has a place it belongs (its place on
   the toy's outline, moved with the body as a whole) and an offset from it
   that behaves like a damped spring tied to its neighbours — so a poke
   springs back, and travels on as a wobble. A finger is a hard limit: the
   skin under it cannot be further out than the finger lets it. */
class Squish {
  constructor(level) {
    Object.assign(this, icosphere(level));
    const n3 = this.n * 3;
    this.rest = new Float32Array(n3); //  the outline
    this.base = new Float32Array(n3); //  the outline, posed: where each point belongs right now
    this.off = new Float32Array(n3); //   how far it is from there
    this.vel = new Float32Array(n3);
    this.tgt = new Float32Array(n3); //   where the offset wants to settle (bulges round a finger)
    this.drag = new Float32Array(n3); //  skin carried along by a finger that grips it
    this.w = new Float32Array(n3);
    this.pos = new Float32Array(n3);
    this.nrm = new Float32Array(n3);
    this.free = new Float32Array(this.n).fill(1); // 0 under unbroken wax, which holds the skin still
    this.freeTo = new Float32Array(this.n).fill(1);
    this.C = [0, 1, 0]; //    the middle
    this.Q = M3.ident(); //   which way it is turned
    this.A = M3.ident(); //   turned, then squashed: outline → world
    this.Ai = M3.ident();
    this.E = new Float32Array(6); //  how the whole body is squashed (xx yy zz xy xz yz)
    this.Ev = new Float32Array(6);
    this.lean = [0, 0];
    this.leanV = [0, 0];
    this.lift = 0; //         height above the table, when hopping or being swapped
    this.liftV = 0;
    this.tossed = false;
    this.spin = [0, 0, 0];
    this.give = 1; //         how much the body as a whole may deform (unbroken wax: not at all)
    this.limb = new Int32Array(0); // points that stick out (ears, a tail), and how loosely each follows the body (0…1)
    this.lag = new Float32Array(0);
    this.was = new Float32Array(0); //  where those points belonged last frame, and how fast that was moving
    this.wasV = new Float32Array(0);
    this.settled = true; //   nothing has moved since: there is no last frame to compare with
    this.wake = true;
    this.calm = false;
    this.events = [];
    this.out = this.dir; //   which way the skin faces at each point of the outline (a round toy's: straight out from its middle)
    this.span = new Float32Array(this.n); // how near a line of sight must pass each point to count as touching it, squared
    this.turning = false; //  a hand is turning it over on the table
    this.tipV = 0; //         how fast it is falling over onto its side
    this.flow = 0; //         how fast the skin is on the move, all in all
    this.grain = 1.6 * Math.sqrt((16 * Math.PI) / (Math.sqrt(3) * (2 * this.n - 4))); // a little more than the gap between points
    this.shape = 'ball';
    this.scale = PROPORTIONS.ball;
    this.reset('ball');
    let top = 0;
    const k = V.norm([0.22, 0.9, -0.38]);
    for (let i = 0, best = -2; i < this.n; i++) {
      const d = this.dir[i * 3] * k[0] + this.dir[i * 3 + 1] * k[1] + this.dir[i * 3 + 2] * k[2];
      if (d > best) {
        best = d;
        top = i;
      }
    }
    this.knot = top; // the point of skin the knot grows from
  }

  reset(shape) {
    this.shape = shape;
    this.scale = PROPORTIONS[shape];
    const slab = !!SLAB[shape], limb = [], lag = [];
    for (let i = 0, j = 0; i < this.n; i++, j += 3) {
      const d = [this.dir[j], this.dir[j + 1], this.dir[j + 2]], at = shapeAt(shape, d[0], d[1], d[2]);
      this.rest.set(at, j);
      // anything standing well clear of the body's own roundness is a limb (the corners of a slab are just its corners)
      const out = V.len(at) / Math.hypot(d[0] * this.scale[0], d[1] * this.scale[1], d[2] * this.scale[2]) - 1.08;
      if (out > 0 && !slab) {
        limb.push(i);
        lag.push(Math.min(0.8, out * 1.6));
      }
    }
    this.out = this.dir;
    this.span.fill(this.grain * this.grain);
    if (slab) {
      // its skin faces wherever its sides do; and its points lie further apart along it than across, so some must be easier to hit
      const { n, rest, nbr } = this, out = (this.out = new Float32Array(n * 3));
      faceNormals(rest, this.idx, out);
      for (let i = 0, j = 0, q = 0; i < n; i++, j += 3, q += 6) {
        const l = Math.hypot(out[j], out[j + 1], out[j + 2]) || 1;
        out[j] /= l;
        out[j + 1] /= l;
        out[j + 2] /= l;
        let far = 0;
        for (let k = 0; k < 6; k++) {
          const p = nbr[q + k] * 3;
          far = Math.max(far, (rest[p] - rest[j]) ** 2 + (rest[p + 1] - rest[j + 1]) ** 2 + (rest[p + 2] - rest[j + 2]) ** 2);
        }
        this.span[i] = Math.max(this.span[i], far * 0.4);
      }
    }
    this.tipV = this.flow = 0;
    this.limb = Int32Array.from(limb);
    this.lag = Float32Array.from(lag);
    this.was = new Float32Array(limb.length * 3);
    this.wasV = new Float32Array(limb.length * 3);
    this.settled = true;
    this.off.fill(0);
    this.vel.fill(0);
    this.E.fill(0);
    this.Ev.fill(0);
    this.lean = [0, 0];
    this.leanV = [0, 0];
    this.spin = [0, 0, 0];
    this.Q = M3.ident();
    this.tossed = false;
    this.wake = true;
  }

  /** Where a point of the outline is in the world, before anything local happens to it. */
  posed(r) {
    return V.add(this.C, M3.apply(this.A, r));
  }

  /** The direction, from the toy's middle, of the bit of skin nearest a point in the world. */
  toRest(p) {
    const q = M3.apply(this.Ai, V.sub(p, this.C)), s = this.scale;
    if (this.shape === 'soap') q[2] /= waist(q[0] / s[0]);
    return V.norm([q[0] / s[0], q[1] / s[1], q[2] / s[2]]);
  }

  /** Which way, in the world, the skin faces in a direction from the toy's middle (as the toy is posed, before anything local happens to it). */
  outward(a) {
    if (!SLAB[this.shape]) return V.norm(M3.apply(this.A, a));
    return V.norm(M3.applyT(this.Ai, facing(this.shape, a[0], a[1], a[2])));
  }

  /** Keeps loose bits out of the toy: where a point that is inside it (or within gap of it) should be instead and which way is out, or null if it is clear. */
  bar(p, gap) {
    if (this.shape !== 'butter') {
      // a ball
      const out = V.sub(p, this.C), far = V.len(out);
      if (far >= 1 + gap || far < 1e-4) return null;
      const n = V.mul(out, 1 / far);
      return { pos: V.add(this.C, V.mul(n, 1 + gap)), n };
    }
    // a box with rounded edges, taken in its own frame
    const q = M3.apply(this.Ai, V.sub(p, this.C)), h = this.scale;
    const d = [Math.abs(q[0]) - h[0] + EDGE, Math.abs(q[1]) - h[1] + EDGE, Math.abs(q[2]) - h[2] + EDGE];
    const o = [Math.max(d[0], 0), Math.max(d[1], 0), Math.max(d[2], 0)], ol = V.len(o);
    const far = ol + Math.min(Math.max(d[0], d[1], d[2]), 0) - EDGE; // how far outside its skin
    if (far >= gap) return null;
    const n = [0, 0, 0];
    if (ol > 1e-6) for (let i = 0; i < 3; i++) n[i] = (q[i] < 0 ? -o[i] : o[i]) / ol;
    else {
      // well inside: out through the nearest side
      const i = d[0] > d[1] ? (d[0] > d[2] ? 0 : 2) : d[1] > d[2] ? 1 : 2;
      n[i] = q[i] < 0 ? -1 : 1;
    }
    return { pos: V.add(this.C, M3.apply(this.A, V.add(q, V.mul(n, gap - far)))), n: V.norm(M3.applyT(this.Ai, n)) };
  }

  /** The point of skin a line of sight meets first, or -1. outline: on the toy as it would be with no finger pushing or pulling at it. */
  under(o, d, outline) {
    const { n, pos, base, drag, span } = this;
    let hit = -1, near = Infinity;
    for (let i = 0, j = 0; i < n; i++, j += 3) {
      const x = (outline ? base[j] - drag[j] : pos[j]) - o[0];
      const y = (outline ? base[j + 1] - drag[j + 1] : pos[j + 1]) - o[1];
      const z = (outline ? base[j + 2] - drag[j + 2] : pos[j + 2]) - o[2];
      const t = x * d[0] + y * d[1] + z * d[2];
      if (t < near && t > 0 && x * x + y * y + z * z - t * t < span[i]) {
        near = t;
        hit = i;
      }
    }
    return hit;
  }

  toss() {
    this.liftV = 30;
    this.tossed = true;
    this.wake = true;
  }

  /** Rolls it under a finger: ax round the upright axis, ay towards the viewer. */
  roll(ax, ay) {
    this.Q = M3.ortho(M3.mul(M3.mul(M3.axisAngle([0, 1, 0], ax), M3.axisAngle([1, 0, 0], ay)), this.Q));
    this.wake = true;
  }

  /** Turns it of its own accord (R: a turn in the world), and what its skin was doing turns with it. */
  turn(R) {
    const { off, vel } = this;
    this.Q = M3.ortho(M3.mul(R, this.Q));
    for (let j = 0; j < off.length; j += 3) {
      const ox = off[j], oy = off[j + 1], oz = off[j + 2], vx = vel[j], vy = vel[j + 1], vz = vel[j + 2];
      off[j] = R[0] * ox + R[1] * oy + R[2] * oz;
      off[j + 1] = R[3] * ox + R[4] * oy + R[5] * oz;
      off[j + 2] = R[6] * ox + R[7] * oy + R[8] * oz;
      vel[j] = R[0] * vx + R[1] * vy + R[2] * vz;
      vel[j + 1] = R[3] * vx + R[4] * vy + R[5] * vz;
      vel[j + 2] = R[6] * vx + R[7] * vy + R[8] * vz;
    }
  }

  /** One frame. Returns false when nothing moved. */
  step(dt, toy, touches, grip) {
    const { n, out: way, rest, base, off, vel, tgt, drag, w, free, nbr, E, Ev } = this;
    const n3 = n * 3;
    if (this.calm && !this.wake && !touches.length && grip < 0.001) {
      this.settled = true;
      this.flow = 0;
      return false;
    }
    this.wake = false;

    // ---- the body as a whole: squashed along each push, drawn out along each pull
    const Et = [0, 0, 0, 0, 0, 0];
    let lx = 0, lz = 0, held = grip > 0.01;
    const along = (u, s) => {
      const a = s * (1 + toy.poisson), b = s * toy.poisson;
      Et[0] += a * u[0] * u[0] - b;
      Et[1] += a * u[1] * u[1] - b;
      Et[2] += a * u[2] * u[2] - b;
      Et[3] += a * u[0] * u[1];
      Et[4] += a * u[0] * u[2];
      Et[5] += a * u[1] * u[2];
    };
    // a push that no other finger pushes back against moves the toy; one that is opposed squeezes it
    let net = 0;
    for (const t of touches) {
      if (t.pr < 0.001 || t.fist) continue;
      lx += t.dir[0] * t.pr * 0.1;
      lz += t.dir[2] * t.pr * 0.1;
      net += Math.hypot(t.dir[0], t.dir[2]) * t.pr;
    }
    const opposed = net > 1e-4 ? clamp(1 - Math.hypot(lx, lz) / (net * 0.1), 0, 1) : 0;
    for (const t of touches) {
      if (t.pr > 0.001 && !t.fist) {
        const s = toy.squash * t.pr * this.give, side = Math.hypot(t.dir[0], t.dir[2]);
        along([0, 1, 0], -s * Math.max(0.65, -t.dir[1])); // the table is underneath, so mostly it flattens
        if (side * opposed > 1e-3) along([t.dir[0] / side, 0, t.dir[2] / side], -s * side * opposed);
      }
      const dl = V.len(t.d);
      if (dl > 1e-4) {
        along(V.mul(t.d, 1 / dl), toy.stretch * dl);
        lx += t.d[0] * 0.2;
        lz += t.d[2] * 0.2;
      }
      if (t.live) held = true;
    }
    if (grip > 0.001) {
      // a fist round it: thinner, and taller
      const s = 0.24 * grip * this.give;
      Et[0] -= s;
      Et[2] -= s;
      Et[1] += 1.4 * s;
    }
    // while a hand is on it the body simply follows; let go, and it answers in its own time
    const om = held ? Math.max(toy.g[0], 15) : toy.g[0], ze = held ? Math.max(toy.g[1], 0.8) : toy.g[1];
    let stir = 0;
    for (let i = 0; i < 6; i++) {
      const to = clamp(Et[i], -0.5, 0.8);
      Ev[i] += (om * om * (to - E[i]) - 2 * ze * om * Ev[i]) * dt;
      E[i] += Ev[i] * dt;
      stir += Math.abs(Ev[i]) + Math.abs(to - E[i]);
    }
    for (let i = 0; i < 2; i++) {
      const to = i ? lz : lx;
      this.leanV[i] += (om * om * (to - this.lean[i]) - 2 * ze * om * this.leanV[i]) * dt;
      this.lean[i] += this.leanV[i] * dt;
      stir += Math.abs(this.leanV[i]);
    }

    // ---- hopping, and landing with a squash
    if (this.lift > 0 || this.liftV > 0) {
      if (!this.tossed) this.liftV -= 42 * dt;
      this.lift += this.liftV * dt;
      stir += 1;
      if (this.lift <= 0) {
        const hit = -this.liftV;
        this.lift = 0;
        this.liftV = hit > 1.5 ? hit * 0.2 : 0;
        if (hit > 1.5) {
          const s = Math.min(hit * 0.4, 4.5) * this.give;
          Ev[1] -= s;
          Ev[0] += s * 0.5;
          Ev[2] += s * 0.5;
          this.events.push({ type: 'land', hit });
        }
      }
    }

    // ---- still turning after a flick
    const slab = !!SLAB[this.shape];
    if (slab && Math.hypot(this.spin[0], this.spin[2]) < 3) this.spin[0] = this.spin[2] = 0; // a slab no longer tumbling fast drops onto a side (below); spun flat on the table, it carries on
    const sp = V.len(this.spin);
    if (sp > 0.02) {
      this.turn(M3.axisAngle(V.mul(this.spin, 1 / sp), sp * dt));
      this.spin = V.mul(this.spin, Math.exp(-3.2 * dt));
      stir += 1;
    } else this.spin = [0, 0, 0];

    // ---- a slab does not balance on an edge or stand on its end: let go of, it tips over onto the nearest of its long sides
    if (slab && !this.turning && !this.spin[0] && !this.spin[2]) {
      const Q = this.Q, side = Math.abs(Q[4]) >= Math.abs(Q[5]) ? [0, Q[4] > 0 ? -1 : 1, 0] : [0, 0, Q[5] > 0 ? -1 : 1];
      const now = M3.apply(Q, side), axis = V.cross(now, [0, -1, 0]), s = V.len(axis), left = Math.atan2(s, -now[1]);
      if (left > 1e-4) {
        this.tipV += 38 * dt;
        const by = Math.min(left, this.tipV * dt);
        this.turn(M3.axisAngle(V.mul(axis, 1 / s), by));
        stir += 1;
        if (by === left) {
          // down, with a slap
          const hit = this.tipV * 0.45, k = Math.min(hit * 0.4, 4.5) * this.give;
          Ev[1] -= k;
          Ev[0] += k * 0.5;
          Ev[2] += k * 0.5;
          if (hit > 1.5) this.events.push({ type: 'land', hit });
          this.tipV = 0;
        }
      } else this.tipV = 0;
    } else this.tipV = 0;

    // squash = exp(E), near enough
    const [a, b, c, d, e, f] = E;
    const sxy = d + 0.5 * (a * d + d * b + e * f), sxz = e + 0.5 * (a * e + d * f + e * c), syz = f + 0.5 * (d * e + b * f + f * c);
    const S = [1 + a + 0.5 * (a * a + d * d + e * e), sxy, sxz, sxy, 1 + b + 0.5 * (d * d + b * b + f * f), syz, sxz, syz, 1 + c + 0.5 * (e * e + f * f + c * c)];
    const A = (this.A = M3.mul(S, this.Q));
    this.Ai = M3.inv(A);
    const [a0, a1, a2, a3, a4, a5, a6, a7, a8] = A;

    // it sits on the table, sunk in a little under its own weight
    let low = 0;
    for (let j = 0; j < n3; j += 3) {
      const y = a3 * rest[j] + a4 * rest[j + 1] + a5 * rest[j + 2];
      if (y < low) low = y;
    }
    const cx = this.lean[0], cy = -low * toy.sit + this.lift, cz = this.lean[1];
    this.C = [cx, cy, cz];

    // ---- ears and tails are slow to follow: as the body moves off they are left behind a moment, then flop after it
    const { limb, lag, was, wasV } = this, first = this.settled;
    for (let q = 0, m = 0; q < limb.length; q++) {
      const j = limb[q] * 3, x = rest[j], y = rest[j + 1], z = rest[j + 2];
      for (let c = 0; c < 3; c++, m++) {
        const now = this.C[c] + A[c * 3] * x + A[c * 3 + 1] * y + A[c * 3 + 2] * z, v = first ? 0 : (now - was[m]) / dt;
        if (!first) vel[j + c] -= clamp(v - wasV[m], -8, 8) * lag[q];
        was[m] = now;
        wasV[m] = v;
      }
    }
    this.settled = false;

    // ---- what each touch does to the skin round it
    tgt.fill(0);
    drag.fill(0);
    for (const t of touches) {
      t.near.length = 0;
      const ax = t.ra[0], ay = t.ra[1], az = t.ra[2], dx = t.d[0], dy = t.d[1], dz = t.d[2];
      const lobe2 = toy.lobe * toy.lobe, w2 = t.w * t.w, ring2 = w2 * 5.76, far2 = Math.max(lobe2, ring2);
      const pulls = dx * dx + dy * dy + dz * dz > 1e-9, swell = toy.bulge * toy.depth * t.pr;
      for (let i = 0, j = 0; i < n; i++, j += 3) {
        const ex = rest[j] - ax, ey = rest[j + 1] - ay, ez = rest[j + 2] - az, d2 = ex * ex + ey * ey + ez * ez;
        if (d2 > far2) continue;
        if (d2 < w2 && t.live) t.near.push(i, 1 - smooth(0, 1, Math.sqrt(d2) / t.w));
        const fr = free[i];
        if (fr < 0.001) continue;
        if (pulls && d2 < lobe2) {
          const k = 1 - d2 / lobe2, g = k * k * fr;
          drag[j] += dx * g;
          drag[j + 1] += dy * g;
          drag[j + 2] += dz * g;
        }
        if (swell > 0 && d2 < ring2) {
          // what the finger pushed aside rises in a ring round it
          const u = Math.sqrt(d2) / t.w;
          if (u > 0.5) {
            const up = swell * smooth(0.5, 1.15, u) * (1 - smooth(1.15, 2.4, u)) * fr;
            tgt[j] += (a0 * way[j] + a1 * way[j + 1] + a2 * way[j + 2]) * up;
            tgt[j + 1] += (a3 * way[j] + a4 * way[j + 1] + a5 * way[j + 2]) * up;
            tgt[j + 2] += (a6 * way[j] + a7 * way[j + 1] + a8 * way[j + 2]) * up;
          }
        }
      }
    }
    for (let j = 0; j < n3; j += 3) {
      const x = rest[j], y = rest[j + 1], z = rest[j + 2];
      base[j] = cx + a0 * x + a1 * y + a2 * z + drag[j];
      base[j + 1] = cy + a3 * x + a4 * y + a5 * z + drag[j + 1];
      base[j + 2] = cz + a6 * x + a7 * y + a8 * z + drag[j + 2];
    }

    // ---- the skin itself
    const steps = dt > 0.02 ? 3 : 2, h = dt / steps;
    const k = toy.k[0] * toy.k[0], cd = 2 * toy.k[1] * toy.k[0], kap = toy.kappa, visc = toy.visc, sixth = 1 / 6;
    let energy = 0;
    for (let s = 0; s < steps; s++) {
      for (let j = 0; j < n3; j++) w[j] = kap * (off[j] - tgt[j]) + visc * vel[j];
      for (let i = 0, j = 0, q = 0; i < n; i++, j += 3, q += 6) {
        const p0 = nbr[q] * 3, p1 = nbr[q + 1] * 3, p2 = nbr[q + 2] * 3, p3 = nbr[q + 3] * 3, p4 = nbr[q + 4] * 3, p5 = nbr[q + 5] * 3;
        vel[j] += ((w[p0] + w[p1] + w[p2] + w[p3] + w[p4] + w[p5]) * sixth - w[j] - k * (off[j] - tgt[j]) - cd * vel[j]) * h;
        vel[j + 1] += ((w[p0 + 1] + w[p1 + 1] + w[p2 + 1] + w[p3 + 1] + w[p4 + 1] + w[p5 + 1]) * sixth - w[j + 1] - k * (off[j + 1] - tgt[j + 1]) - cd * vel[j + 1]) * h;
        vel[j + 2] += ((w[p0 + 2] + w[p1 + 2] + w[p2 + 2] + w[p3 + 2] + w[p4 + 2] + w[p5 + 2]) * sixth - w[j + 2] - k * (off[j + 2] - tgt[j + 2]) - cd * vel[j + 2]) * h;
      }
      for (let j = 0; j < n3; j++) off[j] += vel[j] * h;
      // fingers: the skin under one is pushed in at least as deep as the finger is
      for (const t of touches) {
        if (!t.live || t.pr < 0.001) continue;
        const depth = toy.depth * t.pr * (t.fist ? 0.62 : 1), px = t.dir[0], py = t.dir[1], pz = t.dir[2], near = t.near;
        for (let q = 0; q < near.length; q += 2) {
          const i = near[q], j = i * 3, want = depth * near[q + 1] * free[i];
          const have = off[j] * px + off[j + 1] * py + off[j + 2] * pz;
          if (have >= want) continue;
          const add = want - have;
          off[j] += px * add;
          off[j + 1] += py * add;
          off[j + 2] += pz * add;
          const out = vel[j] * px + vel[j + 1] * py + vel[j + 2] * pz;
          if (out < 0) {
            vel[j] -= px * out;
            vel[j + 1] -= py * out;
            vel[j + 2] -= pz * out;
          }
        }
      }
      // the table
      for (let j = 1; j < n3; j += 3) {
        const y = base[j] + off[j];
        if (y < 0) {
          off[j] -= y;
          if (vel[j] < 0) vel[j] = 0;
        }
      }
    }
    const pos = this.pos;
    for (let j = 0; j < n3; j++) {
      pos[j] = base[j] + off[j];
      energy += vel[j] * vel[j];
    }
    faceNormals(pos, this.idx, this.nrm);
    this.flow = Math.sqrt(energy / n);
    this.calm = !held && stir < 2e-4 && energy < 1e-7 * n;
    return true;
  }
}

// ------------------------------------------------------------------ the wax

const THICK = 0.042; //   how thick the wax goes on
const UNDER = 1.004; //   its underside, just clear of the skin
const GRAVITY = 30;
const STUCK = 1, LOOSE = 2, LYING = 3, GONE = 4;

/* A coat of wax, already divided into the shards it will break into.
   Unbroken, the shards make one shell that holds the ball rigid. Where it
   is pressed the shell cracks into plates of a few shards, which ride on
   the skin; a plate bent too far breaks up into its shards; and a shard
   that has been bent, shaken or rubbed enough comes off and falls. */
class Shell {
  constructor(ball) {
    this.ball = ball;
    this.count = 0; //  shards
    this.whole = 0; //  …still part of the unbroken shell
    this.stuck = 0; //  …cracked but still on the ball
    this.bodies = [];
    this.events = [];
    this.cover = new Uint16Array(ball.n); // the shard over each point of skin
    this.soft = false; //  still setting: cannot crack yet
    this.wet = 0;
    this.pour = -9; //     how far down the fresh wax has run (-9: all the way)
    this.stamp = 0;
    this.dirty = false;
    this.busy = false; //  something is still falling, opening or shrinking away
    this.strain = 0;
  }

  clear() {
    this.count = this.whole = this.stuck = 0;
    this.bodies = [];
    this.idx = new Uint16Array(0);
    this.stamp++;
  }

  /** A fresh coat, with its own way of breaking. */
  build(seed) {
    const rnd = rng(seed), ball = this.ball, shape = ball.shape, slab = !!SLAB[shape];
    // everything is laid out by direction from the toy's middle; these give the point of its skin that way, and how the skin faces there
    const at = (u) => shapeAt(shape, u[0], u[1], u[2]), faces = (u) => facing(shape, u[0], u[1], u[2]);

    // where the shards are: darts of mixed sizes, so they come big and small
    const seeds = [], spots = [];
    for (let tries = 0; tries < 12000 && seeds.length < 230; tries++) {
      const y = rnd() * 2 - 1, a = rnd() * TAU, s = Math.sqrt(1 - y * y);
      const d = [s * Math.cos(a), y, s * Math.sin(a)], p = at(d);
      const r = (slab ? 0.19 : 0.15) + 0.2 * rnd() * rnd();
      if (spots.every((q) => (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 + (q[2] - p[2]) ** 2 > r * r)) {
        seeds.push(d);
        spots.push(p);
      }
    }
    const m = (this.count = seeds.length);

    const P = [], N = [], K = [], I = [];
    const put = (p, nr, kind) => {
      P.push(p[0], p[1], p[2]);
      N.push(nr[0], nr[1], nr[2]);
      K.push(kind);
    };
    // the wax went on unevenly
    const thick = (u) => THICK * (0.78 + 0.5 * noise3(u[0] * 2.3 + (seed % 89), u[1] * 2.3, u[2] * 2.3));
    const cuts = slab ? 4 : 2; // how finely a shard is cut up to follow the skin under it: round a corner takes more
    this.v0 = new Uint32Array(m);
    this.v1 = new Uint32Array(m);
    this.mid = new Float32Array(m * 3); //  the middle of each shard, as a direction…
    this.spot = new Float32Array(m * 3); // …and as a point of the outline
    this.span = new Float32Array(m);
    this.seeds = new Float32Array(m * 3);

    for (let i = 0; i < m; i++) {
      const s = seeds[i];
      this.seeds.set(s, i * 3);
      // each shard is the patch nearer its own dart than any other: cut it out of the plane that touches the ball there
      const near = [];
      for (let j = 0; j < m; j++) if (j !== i) near.push([V.dot(s, seeds[j]), j]);
      near.sort((p, q) => q[0] - p[0]);
      const e1 = V.norm(V.cross(Math.abs(s[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0], s)), e2 = V.cross(s, e1);
      let poly = [[-2, -2], [2, -2], [2, 2], [-2, 2]];
      for (let k = 0; k < Math.min(slab ? 90 : 40, near.length); k++) {
        const q = seeds[near[k][1]];
        const cut = clip(poly, V.dot(e1, q), V.dot(e2, q), 1 - near[k][0]);
        if (cut.length < 3) break;
        poly = cut;
      }
      poly = poly.filter((p, k) => {
        const q = poly[(k + 1) % poly.length];
        return Math.hypot(p[0] - q[0], p[1] - q[1]) > 2e-3;
      });
      const rim = poly.map(([u, v]) => V.norm([s[0] + u * e1[0] + v * e2[0], s[1] + u * e1[1] + v * e2[1], s[2] + u * e1[2] + v * e2[2]]));
      const c = V.norm(rim.reduce(V.add, [0, 0, 0])), k = rim.length, spot = at(c);
      this.mid.set(c, i * 3);
      this.spot.set(spot, i * 3);
      this.span[i] = Math.max(...rim.map((p) => V.len(V.sub(at(p), spot))));

      // top and underside: rings of points from the middle out to the rim, near enough to one another to follow the curve
      const fan = [c];
      for (let ring = 1; ring <= cuts; ring++) {
        for (let j = 0; j < k; j++) {
          const p = rim[j], q = rim[(j + 1) % k];
          for (let t = 0; t < ring; t++) {
            const a = (ring - t) / cuts, b = t / cuts, o = 1 - a - b;
            fan.push(V.norm([c[0] * o + p[0] * a + q[0] * b, c[1] * o + p[1] * a + q[1] * b, c[2] * o + p[2] * a + q[2] * b]));
          }
        }
      }
      const skin = fan.map(at), face = fan.map(faces), deep = fan.map(thick);
      this.v0[i] = K.length;
      for (let side = 0; side < 2; side++) {
        const first = K.length;
        const nth = (ring, q) => (ring ? first + 1 + (k * ring * (ring - 1)) / 2 + (q % (k * ring)) : first); // the q-th point round a ring
        fan.forEach((u, f) => put(V.add(skin[f], V.mul(face[f], side ? UNDER - 1 : deep[f])), side ? V.mul(face[f], -1) : face[f], side));
        for (let ring = 1; ring <= cuts; ring++) {
          for (let j = 0; j < k; j++) {
            for (let t = 0; t < ring; t++) {
              const x = nth(ring - 1, j * (ring - 1) + t), y = nth(ring, j * ring + t), z = nth(ring, j * ring + t + 1);
              side ? I.push(x, z, y) : I.push(x, y, z);
              if (t < ring - 1) {
                const x2 = nth(ring - 1, j * (ring - 1) + t + 1);
                side ? I.push(x, x2, z) : I.push(x, z, x2);
              }
            }
          }
        }
      }
      // the broken edge all the way round
      const loop = [];
      for (let j = 0; j < k; j++) {
        const p = rim[j], q = rim[(j + 1) % k];
        for (let t = 0; t < cuts; t++) {
          const b = t / cuts, u = V.norm([p[0] + (q[0] - p[0]) * b, p[1] + (q[1] - p[1]) * b, p[2] + (q[2] - p[2]) * b]);
          loop.push({ at: at(u), out: faces(u), deep: thick(u) });
        }
      }
      for (let j = 0; j < loop.length; j++) {
        const p = loop[j], q = loop[(j + 1) % loop.length], first = K.length;
        const nr = V.norm(V.cross(V.sub(q.at, p.at), V.add(p.out, q.out)));
        put(V.add(p.at, V.mul(p.out, p.deep)), nr, 2);
        put(V.add(p.at, V.mul(p.out, UNDER - 1)), nr, 2);
        put(V.add(q.at, V.mul(q.out, UNDER - 1)), nr, 2);
        put(V.add(q.at, V.mul(q.out, q.deep)), nr, 2);
        I.push(first, first + 1, first + 2, first, first + 2, first + 3);
      }
      this.v1[i] = K.length;
    }
    this.rest = new Float32Array(P);
    this.face = new Float32Array(N);
    this.kind = new Float32Array(K);
    this.idx = new Uint16Array(I);
    this.pos = new Float32Array(P.length);
    this.nrm = new Float32Array(P.length);

    // plates: the handfuls of shards the shell first cracks into
    const G = Math.max(1, Math.round(m / 4.5)), centres = [];
    for (let i = 0; i < G; i++) {
      const y = 1 - (2 * (i + 0.5)) / G, r = Math.sqrt(1 - y * y), a = i * 2.39996;
      centres.push(at(V.norm([r * Math.cos(a) + (rnd() - 0.5) * 0.3, y + (rnd() - 0.5) * 0.3, r * Math.sin(a) + (rnd() - 0.5) * 0.3])));
    }
    this.plate = new Uint16Array(m);
    this.plates = centres.map(() => []);
    this.yield = centres.map(() => 0.04 + 0.11 * rnd()); // how much squashing of the whole ball a plate stands
    this.hard = new Float32Array(m); //  how near a finger must come to crack it (a factor)
    this.snap = new Float32Array(m); //  how far out of line with its plate before it breaks away
    for (let i = 0; i < m; i++) {
      let best = 0, near = Infinity;
      for (let g = 0; g < G; g++) {
        const d = (this.spot[i * 3] - centres[g][0]) ** 2 + (this.spot[i * 3 + 1] - centres[g][1]) ** 2 + (this.spot[i * 3 + 2] - centres[g][2]) ** 2;
        if (d < near) {
          near = d;
          best = g;
        }
      }
      this.plate[i] = best;
      this.plates[best].push(i);
      this.hard[i] = 0.8 + 0.5 * rnd();
      this.snap[i] = 0.03 + 0.024 * rnd();
    }

    // which shard lies over each point of skin, and the point each shard rides on
    const { seeds: sd, mid } = this, pick = new Float32Array(m).fill(-2);
    this.anchor = new Uint16Array(m);
    for (let i = 0, j = 0; i < ball.n; i++, j += 3) {
      const x = ball.dir[j], y = ball.dir[j + 1], z = ball.dir[j + 2];
      let over = 0, best = -2;
      for (let c = 0, q = 0; c < m; c++, q += 3) {
        const d = x * sd[q] + y * sd[q + 1] + z * sd[q + 2];
        if (d > best) {
          best = d;
          over = c;
        }
      }
      this.cover[i] = over;
      const d = x * mid[over * 3] + y * mid[over * 3 + 1] + z * mid[over * 3 + 2];
      if (d > pick[over]) {
        pick[over] = d;
        this.anchor[over] = i;
      }
    }

    this.body = new Array(m).fill(null);
    this.bodies = [];
    this.whole = m;
    this.stuck = 0;
    this.events.length = 0;
    this.soft = false;
    this.wet = 0;
    this.pour = -9;
    this.dirty = true;
    this.stamp++;
    this.write();
  }

  /** Is there still wax on the skin in this direction? */
  waxAt(a) {
    if (!this.whole && !this.stuck) return false;
    const sd = this.seeds;
    let over = 0, best = -2;
    for (let c = 0, q = 0; c < this.count; c++, q += 3) {
      const d = a[0] * sd[q] + a[1] * sd[q + 1] + a[2] * sd[q + 2];
      if (d > best) {
        best = d;
        over = c;
      }
    }
    const b = this.body[over];
    return !b || b.kind === STUCK;
  }

  emit(type, shard, size) {
    const a = this.anchor[shard] * 3, ball = this.ball;
    this.events.push({ type, size, pos: [ball.pos[a], ball.pos[a + 1], ball.pos[a + 2]], n: V.norm([ball.nrm[a], ball.nrm[a + 1], ball.nrm[a + 2]]) });
  }

  /** Shards that now move as one piece. */
  piece(cells, root, loose) {
    const a = this.anchor[root] * 3, ball = this.ball;
    const up = [ball.out[a], ball.out[a + 1], ball.out[a + 2]];
    const b = {
      kind: STUCK, cells, root,
      pref: [ball.rest[a], ball.rest[a + 1], ball.rest[a + 2]], up, // the point of the outline it rides on, and which way the skin faces there
      pos: [0, 0, 0], rot: M3.ident(), scale: 1,
      axis: V.norm(V.cross(up, [rand() - 0.5, rand() - 0.5, rand() - 0.5])), // it settles a little askew, which is what shows the crack
      tilt: cells.length > 1 ? 0.012 + 0.03 * rand() : 0.03 + 0.07 * rand(),
      rise: 0.002 + 0.008 * rand(),
      open: 0,
      hold: 0.3 + 1.7 * rand() * rand(), // how well it sticks
      loose,
      vel: [0, 0, 0], ang: [0, 0, 0], away: null, fresh: true,
    };
    for (const c of cells) this.body[c] = b;
    this.bodies.push(b);
    return b;
  }

  /** The shell gives way: a plate comes free of it. */
  crack(g) {
    const cells = this.plates[g].filter((c) => !this.body[c]);
    if (!cells.length) return;
    const centre = V.norm(cells.reduce((s, c) => V.add(s, [this.mid[c * 3], this.mid[c * 3 + 1], this.mid[c * 3 + 2]]), [0, 0, 0]));
    let root = cells[0], best = -2;
    for (const c of cells) {
      const d = centre[0] * this.mid[c * 3] + centre[1] * this.mid[c * 3 + 1] + centre[2] * this.mid[c * 3 + 2];
      if (d > best) {
        best = d;
        root = c;
      }
    }
    this.piece(cells, root, 0);
    this.whole -= cells.length;
    this.stuck += cells.length;
    this.dirty = true;
    this.emit('crack', root, cells.length);
  }

  /** A finger on the shell: it cracks under it at once, and further out the harder it is pressed. */
  press(t) {
    const reach = 0.15 + 0.42 * t.pr + 0.12 * Math.min(1, t.hold / 1.5), spot = this.spot;
    for (let c = 0, q = 0; c < this.count; c++, q += 3) {
      if (this.body[c]) continue;
      const d = Math.hypot(spot[q] - t.ra[0], spot[q + 1] - t.ra[1], spot[q + 2] - t.ra[2]);
      if (d < reach * this.hard[c]) this.crack(this.plate[c]);
    }
  }

  /** A cracked piece, riding on the skin. */
  ride(b, dt, touches) {
    const ball = this.ball, a = this.anchor[b.root] * 3;
    const n = V.norm([ball.nrm[a], ball.nrm[a + 1], ball.nrm[a + 2]]);
    const at = b.pref, was = M3.apply(ball.Q, b.up);
    b.open = Math.min(1, b.open + dt * 11);
    b.rot = M3.mul(M3.arc(was, n), M3.mul(ball.Q, M3.axisAngle(b.axis, b.tilt * b.open)));
    const rise = b.rise * b.open;
    b.pos = [ball.pos[a] + n[0] * rise, ball.pos[a + 1] + n[1] * rise, ball.pos[a + 2] + n[2] * rise];

    // a plate is stiff and the skin is not: shards the skin has moved out from under break away from it
    if (b.cells.length > 1) {
      const r = b.rot;
      for (let i = b.cells.length - 1; i >= 0; i--) {
        const c = b.cells[i];
        if (c === b.root) continue;
        const m = this.anchor[c] * 3;
        const x = ball.rest[m] - at[0], y = ball.rest[m + 1] - at[1], z = ball.rest[m + 2] - at[2];
        const miss = Math.hypot(
          ball.pos[m] - b.pos[0] - r[0] * x - r[1] * y - r[2] * z,
          ball.pos[m + 1] - b.pos[1] - r[3] * x - r[4] * y - r[5] * z,
          ball.pos[m + 2] - b.pos[2] - r[6] * x - r[7] * y - r[8] * z
        );
        if (miss > this.snap[c] + b.rise) {
          b.cells.splice(i, 1);
          this.piece([c], c, b.loose + 0.2 * rand());
          this.emit('chip', c, 1);
        }
      }
    }

    // bending, shaking, stretching and rubbing all work it loose
    // (a flat side does not bend when the whole toy is squeezed, as a round one does: there it is the skin stretching under the wax that does it)
    const bend = 1 - V.dot(n, was) + (SLAB[ball.shape] ? this.strain * this.strain * 0.18 : 0);
    const shake = Math.hypot(ball.vel[a], ball.vel[a + 1], ball.vel[a + 2]);
    const pulled = Math.hypot(ball.drag[a], ball.drag[a + 1], ball.drag[a + 2]);
    let rub = 0, pinned = false;
    for (const t of touches) {
      if (!t.live) continue;
      const d = Math.hypot(at[0] - t.ra[0], at[1] - t.ra[1], at[2] - t.ra[2]);
      if (d < 0.5) {
        rub += (1 - smooth(0.12, 0.5, d)) * t.slide;
        if (d < t.w * 0.55 && t.pr > 0.3) pinned = true; // …but not while a finger holds it down
      }
    }
    if (pinned && b.cells.length === 1) {
      // right under the fingertip there is nowhere to go: it is ground to crumbs
      b.crush = (b.crush || 0) + dt;
      if (b.crush > 0.06 + b.hold * 0.12) return this.crumble(b);
    }
    b.loose += dt * (bend * 6 + shake * 0.2 + pulled * 2.5 + rub * 0.9 + (this.whole + this.stuck < this.count * 0.04 ? 2 : 0));
    if (b.loose > b.hold && !pinned) this.shed(b, n);
  }

  /** It comes off, and from here on it is a thing of its own. */
  shed(b, n) {
    const ball = this.ball, a = this.anchor[b.root] * 3;
    this.stuck -= b.cells.length;
    this.dirty = true;
    this.adrift(b);
    const kick = 0.5 + 1.8 * rand();
    b.vel = [n[0] * kick + ball.vel[a] * 0.6 + (rand() - 0.5) * 0.9, n[1] * kick + ball.vel[a + 1] * 0.6 + 0.6 * rand(), n[2] * kick + ball.vel[a + 2] * 0.6 + (rand() - 0.5) * 0.9];
    b.ang = [(rand() - 0.5) * 14, (rand() - 0.5) * 14, (rand() - 0.5) * 14];
    this.emit('shed', b.root, b.cells.length);
  }

  crumble(b) {
    this.stuck -= b.cells.length;
    this.dirty = true;
    this.emit('crush', b.root, 1);
    b.kind = GONE;
    b.fresh = true;
  }

  /** Makes a piece turn about its own middle instead of the point of skin it rode on. */
  adrift(b) {
    let c = [0, 0, 0];
    for (const i of b.cells) c = V.add(c, [this.mid[i * 3], this.mid[i * 3 + 1], this.mid[i * 3 + 2]]);
    c = V.norm(c); // which way its middle lies
    const shape = this.ball.shape, at = shapeAt(shape, c[0], c[1], c[2]);
    b.face = facing(shape, c[0], c[1], c[2]);
    b.reach = Math.max(...b.cells.map((i) => Math.hypot(this.spot[i * 3] - at[0], this.spot[i * 3 + 1] - at[1], this.spot[i * 3 + 2] - at[2]) + this.span[i]));
    c = V.add(at, V.mul(b.face, THICK * 0.5));
    b.pos = V.add(b.pos, M3.apply(b.rot, V.sub(c, b.pref)));
    b.pref = c;
    b.kind = LOOSE;
  }

  /** A loose piece in the air: it falls, bounces off the ball, tips over on the table and lies flat. */
  fly(b, dt) {
    const ball = this.ball;
    b.vel[1] -= GRAVITY * dt;
    b.pos = V.add(b.pos, V.mul(b.vel, dt));
    const turn = V.len(b.ang);
    if (turn > 1e-3) b.rot = M3.ortho(M3.mul(M3.axisAngle(V.mul(b.ang, 1 / turn), turn * dt), b.rot));

    const bar = ball.bar(b.pos, 0.03 + b.reach * 0.3);
    if (bar) {
      const into = V.dot(b.vel, bar.n);
      b.pos = bar.pos;
      if (into < 0) b.vel = V.sub(b.vel, V.mul(bar.n, into * 1.25));
    }

    const up = M3.apply(b.rot, b.face);
    const low = b.pos[1] - b.reach * Math.sqrt(Math.max(0, 1 - up[1] * up[1])) - 0.02;
    if (low < 0) {
      const hit = -b.vel[1];
      b.pos[1] -= low;
      if (hit > 0) {
        if (b.cells.length > 1 && hit > 1.6) return this.burst(b);
        b.vel[1] = hit * 0.25;
        if (hit > 0.9 && !b.away) this.events.push({ type: 'tick', pos: b.pos, size: b.reach });
      }
      const grip = Math.exp(-7 * dt);
      b.vel[0] *= grip;
      b.vel[2] *= grip;
      b.ang = V.mul(b.ang, Math.exp(-9 * dt));
      const axis = V.cross(up, [0, up[1] < 0 ? -1 : 1, 0]), s = V.len(axis);
      if (s > 1e-3) {
        const tip = Math.asin(Math.min(1, s));
        b.rot = M3.mul(M3.axisAngle(V.mul(axis, 1 / s), Math.min(tip, (2 + 10 * tip) * dt)), b.rot);
      }
      if (s < 0.06 && V.len(b.vel) < 0.5 && hit < 0.6) this.settle(b);
    }
    if (Math.abs(b.pos[0]) > 12 || Math.abs(b.pos[2]) > 12) b.kind = GONE;
    b.fresh = true;
  }

  /** A plate landing hard goes to pieces. */
  burst(b) {
    for (const c of b.cells) {
      const p = this.piece([c], c, 9);
      p.rot = b.rot;
      p.pos = b.pos;
      p.pref = b.pref;
      p.open = 1;
      this.adrift(p);
      const fling = V.sub(p.pos, b.pos);
      p.vel = [b.vel[0] * 0.6 + fling[0] * 5 + (rand() - 0.5), 0.8 + rand() * 1.6, b.vel[2] * 0.6 + fling[2] * 5 + (rand() - 0.5)];
      p.ang = [(rand() - 0.5) * 12, (rand() - 0.5) * 12, (rand() - 0.5) * 12];
    }
    this.events.push({ type: 'smash', pos: b.pos, size: b.cells.length });
    b.cells = [];
    b.kind = GONE;
  }

  settle(b) {
    const up = M3.apply(b.rot, b.face), axis = V.cross(up, [0, up[1] < 0 ? -1 : 1, 0]), s = V.len(axis);
    if (s > 1e-4) b.rot = M3.mul(M3.axisAngle(V.mul(axis, 1 / s), Math.asin(Math.min(1, s))), b.rot);
    // let it down until its lowest point touches
    let low = Infinity;
    const r = b.rot, rest = this.rest;
    for (const c of b.cells) {
      for (let j = this.v0[c] * 3, end = this.v1[c] * 3; j < end; j += 3) {
        const y = r[3] * (rest[j] - b.pref[0]) + r[4] * (rest[j + 1] - b.pref[1]) + r[5] * (rest[j + 2] - b.pref[2]);
        if (y < low) low = y;
      }
    }
    b.pos[1] = 0.002 - low;
    b.vel = [0, 0, 0];
    b.kind = LYING;
    b.fresh = true;
  }

  /** Clears the table (and whatever still clings to the ball): each piece shrinks away. */
  sweep() {
    for (const b of this.bodies) if (b.kind !== GONE && b.away === null) b.away = -rand() * 0.15;
    this.busy = true;
  }

  /** One frame. */
  update(dt, touches) {
    const ball = this.ball, E = ball.E;
    const strain = (this.strain = Math.sqrt(E[0] * E[0] + E[1] * E[1] + E[2] * E[2] + 2 * (E[3] * E[3] + E[4] * E[4] + E[5] * E[5]))); // how far the toy as a whole is squashed
    if (this.whole && !this.soft) {
      for (const t of touches) if (t.live && t.pr > 0.02) this.press(t);
      // once enough has broken for the ball to be squashed at all, squashing it finishes off the rest
      if (strain > 0.03) for (let g = 0; g < this.plates.length; g++) if (strain > this.yield[g]) this.crack(g);
    }
    let busy = false;
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.kind === STUCK) this.ride(b, dt, touches);
      else if (b.kind === LOOSE) this.fly(b, dt);
      if (b.kind === LOOSE || (b.kind === STUCK && b.open < 1) || (b.away !== null && b.kind !== GONE)) busy = true;
      if (b.away !== null && b.kind !== GONE) {
        b.away += dt;
        b.scale = 1 - smooth(0, 0.22, b.away);
        b.fresh = true;
        if (b.scale <= 0) {
          if (b.kind === STUCK) this.stuck -= b.cells.length;
          b.kind = GONE;
        }
      }
    }
    if (this.bodies.length > 40 && this.bodies.some((b) => b.kind === GONE && !b.fresh)) this.bodies = this.bodies.filter((b) => b.kind !== GONE || b.fresh || b.cells.length);

    // skin is free to move where the shell over it has broken
    if (this.dirty) {
      this.dirty = false;
      const to = ball.freeTo, tmp = ball.w, nbr = ball.nbr, n = ball.n;
      for (let i = 0; i < n; i++) to[i] = this.body[this.cover[i]] ? 1 : 0;
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < n; i++) tmp[i] = to[i];
        for (let i = 0, q = 0; i < n; i++, q += 6) to[i] = 0.5 * tmp[i] + (tmp[nbr[q]] + tmp[nbr[q + 1]] + tmp[nbr[q + 2]] + tmp[nbr[q + 3]] + tmp[nbr[q + 4]] + tmp[nbr[q + 5]]) / 12;
      }
      for (let i = 0; i < n; i++) to[i] = smooth(0.12, 0.85, to[i]);
      this.easing = 0.4;
    }
    if (this.easing > 0) {
      this.easing -= dt;
      const free = ball.free, to = ball.freeTo, k = 1 - Math.exp(-25 * dt);
      for (let i = 0; i < ball.n; i++) free[i] += (to[i] - free[i]) * k;
      ball.wake = busy = true;
    }
    this.busy = busy;
    this.write();
  }

  /** Puts every shard where its piece is. */
  write() {
    const { ball, pos, nrm, rest, face } = this;
    for (let c = 0; c < this.count; c++) {
      const b = this.body[c];
      let px, py, pz, rx = 0, ry = 0, rz = 0, m, s = 1, on = 1;
      if (!b) {
        [px, py, pz] = ball.C;
        m = ball.A;
      } else {
        if (b.kind >= LYING && !b.fresh) continue;
        if (b.kind === GONE) {
          pos.fill(0, this.v0[c] * 3, this.v1[c] * 3);
          continue;
        }
        [px, py, pz] = b.pos;
        [rx, ry, rz] = b.pref;
        m = b.rot;
        s = b.scale;
        if (b.kind !== STUCK) on = 0.25; // a piece that has left the toy is marked by its normals coming short: nothing shows through it any more (see FS_SHELL)
      }
      const m0 = m[0], m1 = m[1], m2 = m[2], m3 = m[3], m4 = m[4], m5 = m[5], m6 = m[6], m7 = m[7], m8 = m[8];
      for (let j = this.v0[c] * 3, end = this.v1[c] * 3; j < end; j += 3) {
        const x = (rest[j] - rx) * s, y = (rest[j + 1] - ry) * s, z = (rest[j + 2] - rz) * s;
        pos[j] = px + m0 * x + m1 * y + m2 * z;
        pos[j + 1] = py + m3 * x + m4 * y + m5 * z;
        pos[j + 2] = pz + m6 * x + m7 * y + m8 * z;
        const nx = face[j], ny = face[j + 1], nz = face[j + 2];
        nrm[j] = (m0 * nx + m1 * ny + m2 * nz) * on;
        nrm[j + 1] = (m3 * nx + m4 * ny + m5 * nz) * on;
        nrm[j + 2] = (m6 * nx + m7 * ny + m8 * nz) * on;
      }
    }
    for (const b of this.bodies) b.fresh = false;
  }
}

// ------------------------------------------------------------------ crumbs

/** Specks of wax that fly off where it cracks, and stay on the table. */
class Crumbs {
  constructor(max) {
    this.max = max;
    this.p = new Float32Array(max * 4); // x y z, size
    this.v = new Float32Array(max * 3);
    this.on = new Uint8Array(max); //     1 in the air, 2 lying
    this.next = 0;
    this.fading = 0;
  }

  burst(pos, n, count, speed) {
    for (let i = 0; i < count; i++) {
      const k = this.next, j = k * 4, q = k * 3;
      this.next = (k + 1) % this.max;
      this.p[j] = pos[0] + (rand() - 0.5) * 0.18;
      this.p[j + 1] = Math.max(0.02, pos[1] + (rand() - 0.5) * 0.18);
      this.p[j + 2] = pos[2] + (rand() - 0.5) * 0.18;
      this.p[j + 3] = 0.009 + 0.034 * rand() ** 3;
      const s = speed * (0.3 + rand());
      this.v[q] = n[0] * s + (rand() - 0.5) * 1.6;
      this.v[q + 1] = n[1] * s + rand() * 1.2;
      this.v[q + 2] = n[2] * s + (rand() - 0.5) * 1.6;
      this.on[k] = 1;
    }
  }

  sweep() {
    this.fading = 0.45;
  }

  update(dt, ball) {
    const { p, v, on } = this, C = ball.C, round = ball.shape !== 'butter';
    if (this.fading > 0) {
      this.fading -= dt;
      const k = Math.exp(-9 * dt);
      for (let j = 3; j < p.length; j += 4) p[j] *= k;
      if (this.fading <= 0) {
        on.fill(0);
        for (let j = 3; j < p.length; j += 4) p[j] = 0;
      }
    }
    for (let k = 0; k < this.max; k++) {
      if (on[k] !== 1) continue;
      const j = k * 4, q = k * 3;
      v[q + 1] -= GRAVITY * dt;
      p[j] += v[q] * dt;
      p[j + 1] += v[q + 1] * dt;
      p[j + 2] += v[q + 2] * dt;
      const x = p[j] - C[0], y = p[j + 1] - C[1], z = p[j + 2] - C[2], far = Math.hypot(x, y, z);
      const bar = round ? null : ball.bar([p[j], p[j + 1], p[j + 2]], 0.04);
      if (bar) {
        // off the toy
        const into = v[q] * bar.n[0] + v[q + 1] * bar.n[1] + v[q + 2] * bar.n[2];
        p[j] = bar.pos[0];
        p[j + 1] = bar.pos[1];
        p[j + 2] = bar.pos[2];
        if (into < 0) {
          v[q] -= bar.n[0] * into * 1.2;
          v[q + 1] -= bar.n[1] * into * 1.2;
          v[q + 2] -= bar.n[2] * into * 1.2;
        }
      } else if (round && far < 1.04 && far > 1e-4) {
        // off the ball
        const s = 1.04 / far, into = (v[q] * x + v[q + 1] * y + v[q + 2] * z) / far;
        p[j] = C[0] + x * s;
        p[j + 1] = C[1] + y * s;
        p[j + 2] = C[2] + z * s;
        if (into < 0) {
          v[q] -= (x / far) * into * 1.2;
          v[q + 1] -= (y / far) * into * 1.2;
          v[q + 2] -= (z / far) * into * 1.2;
        }
      }
      if (p[j + 1] < p[j + 3]) {
        p[j + 1] = p[j + 3];
        if (v[q + 1] < -1.4) {
          v[q + 1] *= -0.3;
          v[q] *= 0.55;
          v[q + 2] *= 0.55;
        } else on[k] = 2;
      }
    }
  }
}

// ------------------------------------------------------------------ drawing

const PITCH = (32 * Math.PI) / 180; // how steeply the table is looked down on (unless the toy has a look of its own)
const AWAY = 9.5;
const AIM = 0.85; //                   the camera looks at the middle of the toy
const KEY = V.norm([-0.55, 0.8, 0.22]); // the window: up and to the left
const FILL = V.norm([0.75, 0.35, 0.55]);
const SHADE = 512; //                  the shadow picture
const SHADE_RECT = [0.9, -0.3, 1 / 4.6, 1 / 4.6]; // the patch of table it covers: middle x z, 1 / half-size

const GLSL_NOISE = `
  float hash13(vec3 p) { p = fract(p * .1031); p += dot(p, p.zyx + 31.32); return fract((p.x + p.y) * p.z); }
  float vnoise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
    float a = mix(hash13(i), hash13(i + vec3(1, 0, 0)), f.x), b = mix(hash13(i + vec3(0, 1, 0)), hash13(i + vec3(1, 1, 0)), f.x);
    float c = mix(hash13(i + vec3(0, 0, 1)), hash13(i + vec3(1, 0, 1)), f.x), d = mix(hash13(i + vec3(0, 1, 1)), hash13(i + vec3(1, 1, 1)), f.x);
    return mix(mix(a, b, f.y), mix(c, d, f.y), f.z);
  }
  float fbm(vec3 p) { return .5 * vnoise(p) + .3 * vnoise(p * 2.1 + 9.2) + .2 * vnoise(p * 4.3 + 23.7); }
`;

// the room the toys are lit by: a soft window up to the left, a strip of light on the right, pale walls
const GLSL_LIGHT = `
  uniform vec3 uCam, uKey, uFill, uFloor, uSky;
  float pane(vec3 R, vec3 L, vec2 size, float soft) {
    float d = dot(R, L);
    if (d < .05) return 0.;
    vec3 X = normalize(cross(vec3(0., 1., 0.), L)), Y = cross(L, X);
    vec2 q = abs(vec2(dot(R, X), dot(R, Y)) / d);
    vec2 e = 1. - smoothstep(size - soft, size + soft, q);
    return e.x * e.y;
  }
  vec3 room(vec3 R) { return mix(uFloor * .9, uSky, smoothstep(-.3, .4, R.y)); }
  vec3 bumped(vec3 N, vec3 P, float h, float amt) {
  #ifdef BUMP
    vec3 dx = dFdx(P), dy = dFdy(P), r1 = cross(dy, N), r2 = cross(N, dx);
    float det = dot(dx, r1);
    return normalize(abs(det) * N - amt * sign(det) * (dFdx(h) * r1 + dFdy(h) * r2));
  #else
    return N;
  #endif
  }
`;

const VS_SOFT = `
  attribute vec3 aPos, aNrm, aRest, aDir;
  uniform mat4 uVP; uniform mat3 uM; uniform vec3 uT;
  varying vec3 vPos, vNrm, vRest, vDir;
  void main() {
    vPos = uM * aPos + uT; vNrm = uM * aNrm; vRest = aRest; vDir = aDir;
    gl_Position = uVP * vec4(vPos, 1.);
  }
`;

const glsl = (v) => `vec3(${v.map((c) => c.toFixed(4)).join(', ')})`;

// what is printed along the top of a stick of butter, in two blues (the picture itself is drawn in View.label: red is one ink, green the other)
const GLSL_PRINT = `
  uniform sampler2D uLabel;
  const vec3 STICK = ${glsl(PROPORTIONS.butter)}, INK_A = ${glsl(lin('#2a69b3'))}, INK_B = ${glsl(lin('#6b9bd1'))};
  vec2 ink(vec3 p, float blur) { // p: a place on the outline. blur: seen through wax, the print is soft
    return texture2D(uLabel, p.xz / (2. * STICK.xz) + .5, blur).rg * smoothstep(STICK.y - .05, STICK.y - .01, p.y);
  }
  vec3 printed(vec3 base, vec2 k) { return mix(mix(base, INK_A, k.x), INK_B, k.y); }
`;
const FS_SOFT = `
  precision highp float;
  varying vec3 vPos, vNrm, vRest, vDir; // vRest: its place on the outline; vDir: which way that is from the middle
  uniform vec3 uBase, uDeep; // its colour, and the colour of light that has been through it
  uniform vec4 uMat; //         gloss, translucency, clearness, powder
  uniform vec4 uFx; //          glitter, face (1 mochi, 2 fox, 3 the print on a stick of butter), peach paint, pores
  const vec3 EAR = ${glsl(FOX.ear)}, EAR_U = ${glsl(FOX.earU)}, EAR_V = ${glsl(FOX.earV)}, TAIL = ${glsl(FOX.tail)}, PAW = ${glsl(FOX.paw)};
  uniform mat3 uRot; //         outline → world
  uniform float uTime;
  ${GLSL_NOISE}
  ${GLSL_LIGHT}
  ${GLSL_PRINT}
  void main() {
    vec3 N = normalize(vNrm), V = normalize(uCam - vPos), r = normalize(vRest);
    if (uFx.w > 0.) N = bumped(N, vPos, vnoise(vRest * 40.) + .5 * vnoise(vRest * 85.), .004 * uFx.w);
    float ndv = max(dot(N, V), 0.), gloss = uMat.x, print = 0.; // print: where eyes and the like are painted on
    vec3 base = uBase;

    if (uFx.z > 0.) { // a peach: cream below, blushing where the sun caught it
      float b = dot(r, vec3(.38, .8, .12)) + .34 * (fbm(r * 2.6) - .5);
      float blush = smoothstep(-.3, .85, b);
      base = mix(vec3(1., .8, .47), vec3(.97, .36, .33), blush);
      base = mix(base, vec3(.86, .15, .21), smoothstep(.55, 1., blush) * .55);
      base *= .95 + .1 * vnoise(vRest * 60.);
    }
    if (uFx.y > 2.5) { // a stick of butter says what it is
      vec2 k = ink(vRest, 0.);
      base = printed(base, k);
      print = max(k.x, k.y) * .7;
    } else if (uFx.y > 1.5) { // a fox: russet, with white cheeks and bib, dark ear tips and paws, and a white tip to its tail
      vec3 d = normalize(vDir), m = vec3(abs(d.x), d.y, d.z);
      vec3 q = vec3(d.x, d.y * .913 - d.z * .407, d.y * .407 + d.z * .913); // its face, too, looks up at whoever is looking down
      vec2 p = vec2(abs(q.x), q.y);
      vec3 white = vec3(1., .91, .81), dark = vec3(.023, .01, .009);
      base *= mix(1., .8, smoothstep(.1, .9, d.y - d.z * .5)); // darker along the back
      // white cheeks rise either side of the russet that runs down to the nose, and white goes on down the front
      float line = min(-.12 + 1.05 * p.x, .09) - .55 * smoothstep(.45, .95, p.x);
      float mask = smoothstep(-.025, .025, line - q.y) * smoothstep(-.1, .2, q.z);
      base = mix(base, white, mask);
      base = mix(base, vec3(1., .42, .4), (1. - smoothstep(.3, 1., length((p - vec2(.37, -.03)) / vec2(.12, .075)))) * .4 * mask);
      base = mix(base, white, 1. - smoothstep(.2, .27, acos(clamp(dot(d, TAIL), -1., 1.)) + .05 * (vnoise(d * 11.) - .5)));
      base = mix(base, dark, 1. - smoothstep(.13, .17, acos(clamp(dot(m, PAW), -1., 1.))));
      if (dot(m, EAR) > .8) { // ears: pale inside, dark at the tip and all down the back
        float du = dot(m, EAR_U), dv = dot(m, EAR_V), a = length(vec2(du, dv / .62)), up = 1. - a / .3;
        float front = smoothstep(-.02, .05, dv);
        float inside = front * smoothstep(.08, .16, up) * (1. - smoothstep(.6, .7, up)) * (1. - smoothstep(.45, .6, abs(du) / max(a, .001)));
        base = mix(base, vec3(1., .69, .6), inside);
        base = mix(base, dark, max(smoothstep(.66, .76, up), (1. - front) * smoothstep(.1, .3, up)));
      }
      if (q.z > .2) { // eyes a little slanted, a nose on the end of the snout, a small mouth under it
        vec2 l = p - vec2(.21, .13);
        float eye = 1. - smoothstep(.86, 1.08, length(vec2(l.x * .94 + l.y * .34, l.y * .94 - l.x * .34) / vec2(.06, .051)));
        float nose = 1. - smoothstep(.85, 1.1, length((p - vec2(0., -.1)) / vec2(.052, .036)));
        float lip = (1. - smoothstep(.006, .0105, abs(length(p - vec2(.032, -.165)) - .032))) * step(q.y, -.165) * step(p.x, .066);
        print = max(max(eye, nose), lip);
        base = mix(base, dark, print);
        base = mix(base, vec3(1.), 1. - smoothstep(.6, 1.1, length((p - vec2(.196, .16)) / .017)));
        base = mix(base, vec3(1.), (1. - smoothstep(.5, 1.1, length((p - vec2(.012, -.088)) / vec2(.02, .01)))) * .55);
      }
    } else if (uFx.y > 0.) { // a face, looking up at whoever is looking down: two eyes, a little mouth, pink cheeks
      vec3 q = vec3(r.x, r.y * .913 - r.z * .407, r.y * .407 + r.z * .913);
      if (q.z > .2) {
        vec2 p = vec2(abs(q.x), q.y);
        float cheek = 1. - smoothstep(.3, 1., length((p - vec2(.37, -.07)) / vec2(.13, .08)));
        base = mix(base, vec3(1., .36, .46), cheek * .45);
        float eye = 1. - smoothstep(.86, 1.08, length((p - vec2(.2, .06)) / vec2(.044, .056)));
        float lip = (1. - smoothstep(.006, .0105, abs(length(p - vec2(.031, -.04)) - .031))) * step(q.y, -.04) * step(p.x, .064);
        print = max(eye, lip);
        base = mix(base, vec3(.05, .025, .04), print);
        base = mix(base, vec3(1.), 1. - smoothstep(.6, 1.1, length((p - vec2(.186, .083)) / .015)));
      }
    }

    float ndl = dot(N, uKey), wrap = mix(.3, .8, uMat.y);
    float dif = pow(clamp((ndl + wrap) / (1. + wrap), 0., 1.), 1.2);
    float fil = clamp(dot(N, uFill) * .5 + .5, 0., 1.);
    float ao = mix(.55, 1., smoothstep(0., .7, vPos.y)); // the table is close underneath
    vec3 amb = mix(uFloor, uSky, N.y * .5 + .5);
    vec3 col = base * (dif * .6 + fil * .1 + amb * .3 * ao);

    // light that has travelled through the body comes out coloured: at thin edges, and where the lit side ends
    float edge = pow(1. - ndv, 2.2);
    float turn = smoothstep(-.7, 0., ndl) * (1. - smoothstep(0., .6, ndl));
    col += uDeep * uMat.y * (edge * .55 + turn * .35) * ao;

    if (uMat.z > 0.) { // clear gel: the table shows through its middle, and light gathers on the far side
      col = mix(col, uFloor * mix(vec3(1.), uBase, .6) * 1.05, uMat.z * pow(ndv, 1.5) * .55);
      float pool = pow(max(dot(N, normalize(V * .6 - uKey)), 0.), 3.);
      col += (uDeep * pool * .9 + pool * pool * .35) * uMat.z;
    }
    if (uFx.x > 0.) { // glitter, at three depths inside
      vec3 Vo = V * uRot, H = normalize(uKey + V);
      float spark = 0.;
      for (int k = 0; k < 3; k++) {
        float fk = float(k);
        vec3 p = (vRest - Vo * (.05 + .1 * fk)) * (15. + 4. * fk);
        vec3 id = floor(p) + fk * 7.;
        float h = hash13(id);
        vec3 o = vec3(hash13(id + 1.3), hash13(id + 2.7), hash13(id + 4.1)) - .5;
        float flake = smoothstep(.17, .05, length(fract(p) - .5 - o * .6)) * step(.5, h);
        float flash = pow(max(dot(normalize(o + N * .35), H), 0.), 24.);
        spark += flake * (flash * 3. + .1) * mix(.6, 1., .5 + .5 * sin(uTime * (1.5 + 3. * h) + h * 40.));
      }
      col += spark * uFx.x * mix(vec3(1.), uDeep, .3);
    }

    vec3 R = reflect(-V, N);
    float F = .04 + .96 * pow(1. - ndv, 5.);
    vec3 spec = vec3(pane(R, uKey, vec2(.2, .26), mix(.2, .035, gloss))) * mix(.1, 1.1, gloss);
    spec += pane(R, uFill, vec2(.07, .3), mix(.25, .05, gloss)) * .25 * gloss * gloss + room(R) * F * mix(.2, .9, gloss);
    col = col * (1. - .5 * F * gloss) + spec * (1. - .8 * uMat.w) * (1. - .85 * print); // a face is not to be lost under a highlight
    col += uSky * uMat.w * pow(1. - ndv, 3.) * .12; // powder catches the light at the edge
    gl_FragColor = vec4(pow(max(col, 0.), vec3(1. / 2.2)), 1.);
  }
`;

const VS_SHELL = `
  attribute vec3 aPos, aNrm, aRest; attribute float aKind;
  uniform mat4 uVP;
  varying vec3 vPos, vNrm, vRest; varying float vKind;
  void main() { vPos = aPos; vNrm = aNrm; vRest = aRest; vKind = aKind; gl_Position = uVP * vec4(aPos, 1.); }
`;

const FS_SHELL = `
  precision highp float;
  varying vec3 vPos, vNrm, vRest; varying float vKind; // 0 top, 1 underside, 2 broken edge
  uniform vec3 uWaxA, uWaxB, uInner;
  uniform mat3 uRot;
  uniform float uWet, uPour, uSee; // uSee: how much of what is under the wax shows through it
  ${GLSL_NOISE}
  ${GLSL_LIGHT}
  ${GLSL_PRINT}
  void main() {
    vec3 r = normalize(vRest);
    vec2 seen = uSee > 0. ? ink(vRest, 2.) : vec2(0.); // what is printed on the toy under the wax
    float on = step(.4, length(vNrm)); // a piece that has left the toy comes with its normals short (Shell.write): there is nothing under it
    if (uPour > -2.) { // being poured: the wax runs down from the top, in drips
      vec3 up = uRot * r;
      vec2 a = normalize(up.xz + 1e-4);
      if (up.y < uPour + .22 * vnoise(vec3(a * 2.6, 3.)) + .08 * vnoise(vec3(a * 9., 1.))) discard;
    }
    vec3 N = normalize(vNrm), V = normalize(uCam - vPos);
    // two colours of wax, swirled together
    vec3 w = r * 1.05 + 2.4 * vec3(vnoise(r * 1.2 + 4.), vnoise(r * 1.2 + 9.), vnoise(r * 1.2 + 14.));
    float swirl = .8 * vnoise(w * 1.15) + .2 * vnoise(w * 3.1 + 5.);
    vec3 wax = mix(uWaxA, uWaxB, smoothstep(.43, .57, swirl));
    if (vKind < .5) {
      N = bumped(N, vPos, vnoise(r * 4.5) + .4 * vnoise(r * 11.), .012);
      wax = mix(wax, uInner, .07 + .06 * vnoise(r * 7.)); // thin wax lets what is inside tint it
      // …and wax that went on clear lets it be seen: more where it went on thinly, and most while it is still liquid
      wax = mix(wax, printed(uInner, seen), min(1., uSee * on * (.85 + .3 * vnoise(r * 5. + 3.)) * (1. + .5 * uWet)));
    } else if (vKind < 1.5) wax = mix(wax * .93, uInner, .22);
    else wax = mix(wax, vec3(1.), .4); // a fresh break is pale
    wax *= mix(1., .86, uWet);
    float ndv = max(dot(N, V), 0.), ndl = dot(N, uKey);
    float dif = clamp((ndl + .42) / 1.42, 0., 1.);
    float fil = clamp(dot(N, uFill) * .5 + .5, 0., 1.);
    float ao = mix(.5, 1., smoothstep(0., .6, vPos.y));
    vec3 amb = mix(uFloor, uSky, N.y * .5 + .5);
    vec3 col = wax * (dif * .74 + fil * .12 + amb * .34 * ao);
    col += wax * mix(vec3(1.), uInner, .5) * pow(1. - ndv, 2.5) * .12;
    vec3 R = reflect(-V, N);
    float F = .04 + .96 * pow(1. - ndv, 5.);
    // set wax is satin; still liquid, it shines
    col += vec3(pane(R, uKey, vec2(.2, .26), mix(.3, .04, uWet))) * mix(.1, 1., uWet) + room(R) * F * mix(.22, .95, uWet) * .7;
    gl_FragColor = vec4(pow(max(col, 0.), vec3(1. / 2.2)), 1.);
  }
`;

const VS_FLOOR = `
  attribute vec2 aPos;
  uniform mat4 uVP;
  varying vec3 vPos;
  void main() { vPos = vec3(aPos.x, 0., aPos.y); gl_Position = uVP * vec4(vPos, 1.); }
`;

const FS_FLOOR = `
  precision highp float;
  varying vec3 vPos;
  uniform sampler2D uShade;
  uniform vec4 uRect;
  uniform vec3 uFloor, uBg, uDark;
  uniform vec4 uSpot; // where the toy stands (x z), how wide the dark under it is, how dark
  uniform vec3 uLong; // which way a long toy lies on the table (x z), and how many times longer than wide the dark under it is
  uniform vec4 uGlow; // a clear toy throws a bright patch into its own shadow (x z, size, strength)
  float hash12(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
  void main() {
    float s = texture2D(uShade, (vPos.xz - uRect.xy) * uRect.zw * .5 + .5).r;
    float d = length(vPos.xz);
    vec3 col = uFloor * (1. + .12 * exp(-d * d / 9.));
    col = mix(col, uDark, s * .6);
    vec2 q = vPos.xz - uSpot.xy;
    q -= uLong.xy * dot(q, uLong.xy) * (1. - 1. / uLong.z);
    col *= 1. - uSpot.w * exp(-dot(q, q) / (uSpot.z * uSpot.z));
    vec2 g = vPos.xz - uGlow.xy;
    col += uFloor * uGlow.w * exp(-dot(g, g) / uGlow.z);
    col = mix(col, uBg, smoothstep(5., 24., d + max(0., -vPos.z) * .8)); // no horizon: the table fades into the backdrop
    gl_FragColor = vec4(pow(col, vec3(1. / 2.2)) + (hash12(gl_FragCoord.xy) - .5) / 255., 1.);
  }
`;

// shadows: everything is flattened onto the table along the light, seen from straight above
const VS_SHADOW = `
  attribute vec3 aPos;
  uniform vec3 uKey; uniform vec4 uRect;
  void main() {
    vec2 q = aPos.xz - uKey.xz * (max(aPos.y, 0.) / uKey.y);
    gl_Position = vec4((q - uRect.xy) * uRect.zw, 0., 1.);
  }
`;
const FS_WHITE = `precision mediump float; void main() { gl_FragColor = vec4(1.); }`;

const VS_BLUR = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() { vUv = aPos * .5 + .5; gl_Position = vec4(aPos, 0., 1.); }
`;
const FS_BLUR = `
  precision mediump float;
  varying vec2 vUv;
  uniform sampler2D uTex; uniform vec2 uStep;
  void main() {
    float s = texture2D(uTex, vUv).r * .227;
    s += (texture2D(uTex, vUv + uStep * 1.385).r + texture2D(uTex, vUv - uStep * 1.385).r) * .316;
    s += (texture2D(uTex, vUv + uStep * 3.231).r + texture2D(uTex, vUv - uStep * 3.231).r) * .0703;
    gl_FragColor = vec4(s);
  }
`;

const VS_CRUMB = `
  attribute vec4 aP;
  uniform mat4 uVP; uniform float uPx;
  varying float vSeed;
  void main() {
    vSeed = fract(aP.w * 9973.); // its size is the one thing about a crumb that never changes
    gl_Position = uVP * vec4(aP.xyz, 1.);
    gl_PointSize = aP.w * uPx / gl_Position.w;
    if (gl_PointSize < .6) gl_Position = vec4(2., 2., 2., 1.); // a point is never drawn smaller than a pixel, so one that should be is put out of sight
  }
`;
const FS_CRUMB = `
  precision mediump float;
  uniform vec3 uColA, uColB;
  varying float vSeed;
  void main() {
    // each one a little chip with its own corners, turned its own way
    float a = vSeed * 6.2832, c = cos(a), s = sin(a);
    vec2 p = gl_PointCoord * 2. - 1., q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
    float d = max(abs(q.x) * (1.15 + .6 * fract(vSeed * 7.)), abs(q.y) * (1.5 + fract(vSeed * 13.)));
    if (max(d, abs(q.x + q.y) * (.9 + .5 * fract(vSeed * 29.))) > 1.) discard;
    vec3 col = mix(uColA, uColB, step(.55, fract(vSeed * 3.)));
    gl_FragColor = vec4(col * (.93 - .1 * p.y + .1 * fract(vSeed * 17.)), 1.);
  }
`;

class View {
  constructor(canvas) {
    const opts = { antialias: true, alpha: false, powerPreference: 'high-performance' };
    const gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts);
    if (!gl) throw new Error('no webgl');
    this.gl = gl;
    this.canvas = canvas;
    const bump = gl.getExtension('OES_standard_derivatives') ? '#extension GL_OES_standard_derivatives : enable\n#define BUMP\n' : '';
    this.pSoft = this.program(VS_SOFT, bump + FS_SOFT, ['aPos', 'aNrm', 'aRest', 'aDir']);
    this.pShell = this.program(VS_SHELL, bump + FS_SHELL, ['aPos', 'aNrm', 'aRest', 'aKind']);
    this.pFloor = this.program(VS_FLOOR, FS_FLOOR, ['aPos']);
    this.pShadow = this.program(VS_SHADOW, FS_WHITE, ['aPos']);
    this.pBlur = this.program(VS_BLUR, FS_BLUR, ['aPos']);
    this.pCrumb = this.program(VS_CRUMB, FS_CRUMB, ['aP']);
    this.shade = [this.target(SHADE), this.target(SHADE)];
    this.floor = this.buffer(new Float32Array([-60, -60, 60, -60, -60, 60, 60, 60]));
    this.whole = this.buffer(new Float32Array([-1, -1, 3, -1, -1, 3]));
    const knot = knotMesh();
    this.knot = { pos: this.buffer(knot.pos), nrm: this.buffer(knot.nrm), idx: this.buffer(knot.idx, true), count: knot.idx.length };
    this.shellStamp = -1;
    this.col = null;
    this.to = null;
    this.label();

    const self = this;
    this.cam = {
      eye: [0, 0, 0], fwd: [0, 0, -1], right: [1, 0, 0], up: [0, 1, 0],
      vp: new Float32Array(16), w: 1, h: 1, f: 1, shift: 0, side: 0, px: 100, pitch: PITCH, aim: AIM,
      /** px: how many pixels the toy's radius should take; shift, side: where on the screen its middle goes (−1 bottom … 1 top, −1 left … 1 right);
          pitch, aim: how steeply the table is looked down on, and how high above it the middle of the toy is. */
      set(w, h, px, shift, side = 0, pitch = this.pitch, aim = this.aim) {
        Object.assign(this, { w, h, px, shift, side, pitch, aim, f: (px * AWAY) / (h / 2) });
        this.eye = [0, aim + AWAY * Math.sin(pitch), AWAY * Math.cos(pitch)];
        this.fwd = [0, -Math.sin(pitch), -Math.cos(pitch)];
        this.up = [0, Math.cos(pitch), -Math.sin(pitch)];
        const { eye: e, right: r, up: u, fwd: fw, f } = this, near = 0.5, far = 140;
        const view = [r[0], u[0], -fw[0], 0, r[1], u[1], -fw[1], 0, r[2], u[2], -fw[2], 0, -V.dot(r, e), -V.dot(u, e), V.dot(fw, e), 1];
        const proj = [f / (w / h), 0, 0, 0, 0, f, 0, 0, -side, -shift, (far + near) / (near - far), -1, 0, 0, (2 * far * near) / (near - far), 0];
        this.vp = mul4(proj, view);
        self.gl.viewport(0, 0, self.canvas.width, self.canvas.height);
      },
      /** The line of sight through a point of the page. */
      ray(x, y) {
        const dx = (((2 * x) / this.w - 1 - this.side) * (this.w / this.h)) / this.f, dy = (1 - (2 * y) / this.h - this.shift) / this.f;
        return { o: this.eye, d: V.norm([this.right[0] * dx + this.up[0] * dy + this.fwd[0], this.right[1] * dx + this.up[1] * dy + this.fwd[1], this.right[2] * dx + this.up[2] * dy + this.fwd[2]]) };
      },
    };
  }

  /** What is printed on the stick of butter, drawn once into a picture: red for the darker ink, green for the lighter. */
  label() {
    const gl = this.gl, c = document.createElement('canvas'), g = c.getContext('2d'), [hx, , hz] = PROPORTIONS.butter;
    c.width = 1024;
    c.height = 256;
    g.fillStyle = '#000';
    g.fillRect(0, 0, 1024, 256);
    g.scale(1024 / ((256 * hx) / hz), 1); // the top of the stick, 256 from back to front and as long as that makes it
    const write = (text, x, y, size, ink, fit) => {
      g.font = `bold ${size}px "Helvetica Neue", Helvetica, Arial, sans-serif`;
      g.fillStyle = ink;
      g.fillText(text, x, y, fit);
    };
    write('4', 112, 172, 116, '#0f0');
    write('OZ.', 181, 172, 50, '#0f0');
    write('NET WT. (113 G)', 106, 208, 19, '#0f0', 160);
    write('BUTTER', 310, 172, 112, '#f00', 362);
    g.textAlign = 'center';
    write('SALTED', 491, 74, 17, '#f00');

    gl.activeTexture(gl.TEXTURE1); // it keeps a unit to itself: the shadow picture comes and goes on the first
    gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const sharp = gl.getExtension('EXT_texture_filter_anisotropic'); // the print is looked at from low down
    if (sharp) gl.texParameterf(gl.TEXTURE_2D, sharp.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(sharp.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.activeTexture(gl.TEXTURE0);
    for (const prog of [this.pSoft, this.pShell]) {
      gl.useProgram(prog.p);
      gl.uniform1i(prog.u.uLabel, 1);
    }
  }

  program(vs, fs, attrs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    attrs.forEach((name, i) => gl.bindAttribLocation(p, i, name));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {};
    for (let i = 0, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS); i < n; i++) {
      const name = gl.getActiveUniform(p, i).name;
      u[name] = gl.getUniformLocation(p, name);
    }
    return { p, u };
  }

  buffer(data, index, live) {
    const gl = this.gl, b = gl.createBuffer(), kind = index ? gl.ELEMENT_ARRAY_BUFFER : gl.ARRAY_BUFFER;
    gl.bindBuffer(kind, b);
    gl.bufferData(kind, data, live ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW);
    return b;
  }

  fill(b, data) {
    const gl = this.gl;
    gl.bindBuffer(gl.ARRAY_BUFFER, b);
    gl.bufferSubData(gl.ARRAY_BUFFER, 0, data);
  }

  target(size) {
    const gl = this.gl, tex = gl.createTexture(), fb = gl.createFramebuffer();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, size, size, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fb };
  }

  /** Picks a program and the buffers its attributes read, in order. */
  use(prog, bufs) {
    const gl = this.gl;
    gl.useProgram(prog.p);
    for (let i = 0; i < 4; i++) {
      if (i < bufs.length) {
        gl.bindBuffer(gl.ARRAY_BUFFER, bufs[i][0]);
        gl.enableVertexAttribArray(i);
        gl.vertexAttribPointer(i, bufs[i][1], gl.FLOAT, false, 0, 0);
      } else gl.disableVertexAttribArray(i);
    }
    return prog.u;
  }

  light(u) {
    const gl = this.gl;
    gl.uniformMatrix4fv(u.uVP, false, this.cam.vp);
    gl.uniform3fv(u.uCam, this.cam.eye);
    gl.uniform3fv(u.uKey, KEY);
    gl.uniform3fv(u.uFill, FILL);
    gl.uniform3fv(u.uFloor, this.col.floor);
    gl.uniform3f(u.uSky, 1, 1, 1);
  }

  /** The ball's buffers, made once; its outline goes up again whenever the toy changes shape. */
  fit(ball) {
    if (!this.bPos) {
      this.bPos = this.buffer(ball.pos, false, true);
      this.bNrm = this.buffer(ball.nrm, false, true);
      this.bRest = this.buffer(ball.rest, false, true);
      this.bDir = this.buffer(ball.dir);
      this.bIdx = this.buffer(ball.idx, true);
    } else this.fill(this.bRest, ball.rest);
  }

  /** The colours of the room follow the toy. */
  tint(toy, now) {
    const floor = lin(toy.floor), deep = lin(toy.deep), see = toy.trans * 0.6;
    this.to = { bg: lin(toy.bg), floor, dark: floor.map((c, i) => c * lerp(0.5, 0.45 + 0.45 * deep[i], see)), base: lin(toy.base), deep };
    if (now || !this.col) this.col = JSON.parse(JSON.stringify(this.to));
    if (toy.wax) this.wax = { a: lin(toy.waxA), b: lin(toy.waxB), see: toy.see || 0 };
  }

  draw(app, dt) {
    const gl = this.gl, { ball, shell, crumbs, toy } = app, cam = this.cam, col = this.col;
    for (const key in col) for (let i = 0; i < 3; i++) col[key][i] = damp(col[key][i], this.to[key][i], 7, dt);

    if (app.moved) {
      this.fill(this.bPos, ball.pos);
      this.fill(this.bNrm, ball.nrm);
    }
    const waxed = shell.count > 0;
    if (waxed) {
      if (this.shellStamp !== shell.stamp) {
        this.shellStamp = shell.stamp;
        for (const b of [this.sPos, this.sNrm, this.sRest, this.sKind, this.sIdx]) if (b) gl.deleteBuffer(b);
        this.sPos = this.buffer(shell.pos, false, true);
        this.sNrm = this.buffer(shell.nrm, false, true);
        this.sRest = this.buffer(shell.rest);
        this.sKind = this.buffer(shell.kind);
        this.sIdx = this.buffer(shell.idx, true);
      } else if (app.moved || shell.busy) {
        this.fill(this.sPos, shell.pos);
        this.fill(this.sNrm, shell.nrm);
      }
    }
    if (!this.bCrumb) this.bCrumb = this.buffer(crumbs.p, false, true);
    else this.fill(this.bCrumb, crumbs.p);

    // ---- 1. where the light does not reach, seen from above, then blurred
    gl.bindFramebuffer(gl.FRAMEBUFFER, this.shade[0].fb);
    gl.viewport(0, 0, SHADE, SHADE);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.CULL_FACE);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    let u = this.use(this.pShadow, [[this.bPos, 3]]);
    gl.uniform3fv(u.uKey, KEY);
    gl.uniform4fv(u.uRect, SHADE_RECT);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bIdx);
    gl.drawElements(gl.TRIANGLES, ball.idx.length, gl.UNSIGNED_SHORT, 0);
    if (waxed) {
      this.use(this.pShadow, [[this.sPos, 3]]);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sIdx);
      gl.drawElements(gl.TRIANGLES, shell.idx.length, gl.UNSIGNED_SHORT, 0);
    }
    for (const [from, to, x, y] of [[0, 1, 1, 0], [1, 0, 0, 1]]) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.shade[to].fb);
      u = this.use(this.pBlur, [[this.whole, 2]]);
      gl.bindTexture(gl.TEXTURE_2D, this.shade[from].tex);
      gl.uniform1i(u.uTex, 0);
      gl.uniform2f(u.uStep, (x * 1.7) / SHADE, (y * 1.7) / SHADE);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    }

    // ---- 2. the picture
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clearColor(...col.bg.map((c) => Math.pow(c, 1 / 2.2)), 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);

    u = this.use(this.pFloor, [[this.floor, 2]]);
    gl.uniformMatrix4fv(u.uVP, false, cam.vp);
    gl.bindTexture(gl.TEXTURE_2D, this.shade[0].tex);
    gl.uniform1i(u.uShade, 0);
    gl.uniform4fv(u.uRect, SHADE_RECT);
    gl.uniform3fv(u.uFloor, col.floor);
    gl.uniform3fv(u.uBg, col.bg);
    gl.uniform3fv(u.uDark, col.dark);
    const near = 1 - smooth(0, 1.4, ball.lift); // the dark right under it goes as it leaves the table
    let across = 0.62, lie = [1, 0, 1];
    if (SLAB[ball.shape]) {
      // a slab lies along the table, and the dark under it is as long as it is
      const Q = ball.Q, h = ball.scale, l = Math.hypot(Q[0], Q[6]);
      across = 1.1 * (h[1] * Math.hypot(Q[1], Q[7]) + h[2] * Math.hypot(Q[2], Q[8]));
      if (l > 0.2) lie = [Q[0] / l, Q[6] / l, Math.max(1, (h[0] * l) / across)];
    }
    gl.uniform4f(u.uSpot, ball.C[0], ball.C[2], across, 0.3 * near);
    gl.uniform3fv(u.uLong, lie);
    const reach = ball.C[1] / KEY[1];
    gl.uniform4f(u.uGlow, ball.C[0] - KEY[0] * reach, ball.C[2] - KEY[2] * reach, 0.1, toy.clear * 0.55 * near);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    gl.enable(gl.CULL_FACE);
    u = this.use(this.pSoft, [[this.bPos, 3], [this.bNrm, 3], [this.bRest, 3], [this.bDir, 3]]);
    this.light(u);
    gl.uniformMatrix3fv(u.uM, false, M3.gl(M3.ident()));
    gl.uniform3f(u.uT, 0, 0, 0);
    gl.uniform3fv(u.uBase, col.base);
    gl.uniform3fv(u.uDeep, col.deep);
    gl.uniform4f(u.uMat, toy.gloss, toy.trans, toy.clear, toy.powder);
    gl.uniform4f(u.uFx, toy.glitter, toy.face, toy.paint, toy.pore);
    gl.uniformMatrix3fv(u.uRot, false, M3.gl(ball.Q));
    gl.uniform1f(u.uTime, app.time);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.bIdx);
    gl.drawElements(gl.TRIANGLES, ball.idx.length, gl.UNSIGNED_SHORT, 0);

    if (toy.knot) {
      // the knot stands on its bit of skin, poking out through any wax
      const k = ball.knot * 3, n = V.norm([ball.nrm[k], ball.nrm[k + 1], ball.nrm[k + 2]]), out = waxed && shell.whole + shell.stuck > 0 ? 0.03 : -0.012;
      u = this.use(this.pSoft, [[this.knot.pos, 3], [this.knot.nrm, 3], [this.knot.pos, 3], [this.knot.pos, 3]]);
      gl.uniformMatrix3fv(u.uM, false, M3.gl(M3.arc([0, 1, 0], n)));
      gl.uniform3f(u.uT, ball.pos[k] + n[0] * out, ball.pos[k + 1] + n[1] * out, ball.pos[k + 2] + n[2] * out);
      gl.uniform3fv(u.uBase, col.base.map((c) => lerp(c, 1, 0.75)));
      gl.uniform4f(u.uMat, 1, 0.9, 0.7, 0);
      gl.uniform4f(u.uFx, 0, 0, 0, 0);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.knot.idx);
      gl.drawElements(gl.TRIANGLES, this.knot.count, gl.UNSIGNED_SHORT, 0);
    }

    if (waxed) {
      u = this.use(this.pShell, [[this.sPos, 3], [this.sNrm, 3], [this.sRest, 3], [this.sKind, 1]]);
      this.light(u);
      gl.uniform3fv(u.uWaxA, this.wax.a);
      gl.uniform3fv(u.uWaxB, this.wax.b);
      gl.uniform3fv(u.uInner, col.base);
      gl.uniformMatrix3fv(u.uRot, false, M3.gl(ball.Q));
      gl.uniform1f(u.uWet, shell.wet);
      gl.uniform1f(u.uPour, shell.pour);
      gl.uniform1f(u.uSee, this.wax.see);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.sIdx);
      gl.drawElements(gl.TRIANGLES, shell.idx.length, gl.UNSIGNED_SHORT, 0);

      u = this.use(this.pCrumb, [[this.bCrumb, 4]]);
      gl.uniformMatrix4fv(u.uVP, false, cam.vp);
      gl.uniform1f(u.uPx, cam.f * this.canvas.height);
      gl.uniform3fv(u.uColA, this.wax.a.map((c) => Math.pow(c * 0.8 + 0.2, 1 / 2.2)));
      gl.uniform3fv(u.uColB, this.wax.b.map((c) => Math.pow(c * 0.8 + 0.2, 1 / 2.2)));
      gl.drawArrays(gl.POINTS, 0, crumbs.max);
    }
  }
}

export { TAU, clamp, lerp, smooth, damp, rand, V, M3, TOYS, WAXES, SLAB, PITCH, AIM, shapeAt, Sound, buzz, Squish, Shell, Crumbs, View };
