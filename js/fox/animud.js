// Animud — a little fox that is nobody's kind but her own: she made it (a model of hers, seen from
// in front, from behind and from the side), and here it is after that model. A head as large as
// the rest of it, wide and round, with a button of a snout low on the face; big ears with tufts
// along their edges; amber eyes under a thick dark lash, a dot of a brow over each; three tufts
// on either cheek and a small one on top; a ruff of fur over the chest; slim straight legs; a
// plume of a tail, rose on top.
//
// It is a fox for the rig all the same (rig.js: `own`): the same bones, so that it walks, sits,
// sleeps, dances and wears things like the others. What it makes itself is its shape — torso and
// ruff, legs, tail, head — and its face.
//
// Measures are the rig's (+Z forward, +Y up, +X its left); it is drawn at `size`.
import * as THREE from '../vendor/three.module.min.js';
import { paintTexture } from './kit.js';

const HEAD = { y: 0.737, z: 0.24, top: 0.18, low: -0.215 }; // the middle of its head, and how far the head reaches above and below it
const PIVOT = { y: HEAD.y - 0.075, z: HEAD.z - 0.02 }; //     …and where the head turns on the neck: inside it
// An ear, as it is seen from in front (the left one; measures from the middle of the head): where it turns, how far it
// leans back, and its two edges — [height, how far out] from the root, inside the head, up to the tip. The outer edge
// stands nearly upright, the inner one comes down to the top of the head on a slant. `tufts`: the little points of
// fur along them — [height, how long, how far it points down (or, on the inner edge, up)].
const EAR = {
  x: 0.17,
  y: 0.12,
  z: -0.03,
  back: 0.11,
  long: 0.31, // (for what goes by the length of an ear: how a picture of the head is framed)
  wide: 0.22,
  lean: 0.44,
  out: [[0, 0.2], [0.04, 0.228], [0.073, 0.249], [0.105, 0.27], [0.136, 0.286], [0.168, 0.295], [0.2, 0.301], [0.231, 0.304], [0.263, 0.306], [0.294, 0.307], [0.326, 0.306], [0.358, 0.3], [0.38, 0.289], [0.393, 0.273]],
  in: [[0, 0.07], [0.06, 0.055], [0.14, 0.05], [0.18, 0.059], [0.2, 0.077], [0.231, 0.097], [0.263, 0.119], [0.294, 0.144], [0.326, 0.176], [0.358, 0.221], [0.382, 0.256], [0.393, 0.273]],
  tufts: { out: [[0.212, 0.026, -0.012], [0.156, 0.024, -0.014]], in: [[0.318, 0.022, 0.014]] },
};
const EAR_ROWS = 30;
const EAR_COLS = 8;
// The head, level by level: [height above its middle, half its width, how far it reaches forward of the middle, how far back].
// Widest at the cheeks, below the middle, and broad still where it sits on the ruff; a smaller dome on top.
const PROFILE = [
  [-0.215, 0.02, 0.02, 0.02],
  [-0.205, 0.085, 0.075, 0.065],
  [-0.18, 0.136, 0.118, 0.1],
  [-0.148, 0.16, 0.14, 0.122],
  [-0.117, 0.184, 0.156, 0.14],
  [-0.085, 0.2, 0.166, 0.152],
  [-0.05, 0.202, 0.168, 0.16],
  [-0.015, 0.2, 0.167, 0.163],
  [0.02, 0.198, 0.163, 0.164],
  [0.055, 0.19, 0.155, 0.16],
  [0.09, 0.172, 0.14, 0.15],
  [0.12, 0.146, 0.118, 0.13],
  [0.148, 0.108, 0.088, 0.098],
  [0.168, 0.062, 0.05, 0.058],
  [0.18, 0.02, 0.018, 0.02],
];
const SNOUT = { h: -0.08, wide: 0.44, high: 0.072, out: 0.06 }; // the snout: how high on the face, how wide (radians round the head) and high, how far out
const FLAT = 0.76; //                   how flat the face is (1 = round as the back of the head)
// its eyes, as they are seen from in front: where (from the middle of the head), how wide and high the opening, and the iris in it
const EYE = { x: 0.1205, y: -0.006, rx: 0.064, ry: 0.062, iris: [0.68, 0.94], in: 0.11, low: 0.06 };
const BROW = { x: 0.063, y: 0.096, rx: 0.0217, ry: 0.0119 };
const RINGS = 36;
const SEGS = 40;

// The ruff, level by level from under the chin down to its point: [height, how far forward its middle is, half its
// width, how far it reaches forward of the middle, how far back, how long its fur]. Widest under the cheeks; from
// there it narrows all the way down to a point between the forelegs, and hangs further forward the lower it is.
const RUFF = [
  [0.628, 0.225, 0.1, 0.09, 0.08, 0.14],
  [0.606, 0.23, 0.15, 0.13, 0.1, 0.22],
  [0.58, 0.233, 0.168, 0.145, 0.112, 0.3],
  [0.542, 0.235, 0.181, 0.153, 0.1, 0.38],
  [0.5, 0.24, 0.187, 0.158, 0.078, 0.38],
  [0.46, 0.25, 0.19, 0.155, 0.062, 0.38],
  [0.425, 0.262, 0.187, 0.145, 0.052, 0.38],
  [0.395, 0.273, 0.173, 0.127, 0.046, 0.38],
  [0.36, 0.286, 0.142, 0.099, 0.04, 0.38],
  [0.328, 0.296, 0.1, 0.078, 0.032, 0.36],
  [0.3, 0.304, 0.057, 0.056, 0.022, 0.34],
  [0.281, 0.308, 0.028, 0.034, 0.014, 0.32],
  [0.266, 0.31, 0.008, 0.01, 0.006, 0.3],
];
// Below the cheeks its fur falls in folds that run together at the point: [where round the ruff (radians from straight
// ahead, towards its left), how wide, how deep (of its thickness there)].
const RUFF_FOLDS = [
  [-0.75, 0.13, 0.085],
  [-0.32, 0.1, 0.07],
  [0.3, 0.11, 0.075],
  [0.85, 0.13, 0.06],
];
const RUFF_SEGS = 40;
// …and behind, over each shoulder, it ends in tufts that stand up and back: from [x, y, z] to [x, y, z], how thick (the left ones).
const RUFF_TUFTS = [
  [0.186, 0.452, 0.235, 0.172, 0.535, 0.15, 0.02],
  [0.188, 0.44, 0.228, 0.18, 0.518, 0.152, 0.02],
  [0.187, 0.428, 0.222, 0.186, 0.498, 0.156, 0.018],
];
// The plume of its tail as it is carried when it stands, station by station from the root backwards (seen from the
// side): [how far behind the root, its top, its underside, the level at which it is widest, half its width there].
// Out of the rump thick, as it is in her picture — no stalk: from the root it swells straight into a lobe that hangs
// below the root and a hump that rises above the back; and from there it thins away backwards to a point that droops.
const PLUME = [
  [0.03, 0.385, 0.27, 0.33, 0.055],
  [0.06, 0.39, 0.252, 0.322, 0.064],
  [0.095, 0.395, 0.228, 0.312, 0.075],
  [0.118, 0.398, 0.207, 0.305, 0.084],
  [0.132, 0.403, 0.192, 0.307, 0.089],
  [0.15, 0.412, 0.178, 0.32, 0.096],
  [0.172, 0.44, 0.168, 0.345, 0.105],
  [0.205, 0.493, 0.162, 0.375, 0.118],
  [0.238, 0.533, 0.162, 0.4, 0.126],
  [0.27, 0.564, 0.176, 0.42, 0.13],
  [0.305, 0.582, 0.194, 0.44, 0.13],
  [0.34, 0.588, 0.22, 0.45, 0.13],
  [0.375, 0.583, 0.246, 0.455, 0.127],
  [0.415, 0.577, 0.268, 0.455, 0.12],
  [0.45, 0.574, 0.29, 0.455, 0.112],
  [0.485, 0.562, 0.313, 0.45, 0.1],
  [0.525, 0.545, 0.333, 0.44, 0.086],
  [0.56, 0.522, 0.343, 0.428, 0.07],
  [0.595, 0.482, 0.347, 0.41, 0.053],
  [0.622, 0.432, 0.348, 0.386, 0.034],
  [0.645, 0.378, 0.345, 0.36, 0.016],
];
const PLUME_TIP = [0.66, 0.342]; // …and its very end: how far behind the root, how high
// (Nothing sticks out of it: the points of fur her picture has on the hump and under the lobe were taken off at his
// asking — the plume is one smooth piece.)
const PLUME_SEGS = 32;
// Its fur is swept back and down, round from the ridge, in folds: [how far behind the root a fold leaves the ridge, how
// deep it is (of the plume's thickness there)] — and how fast they go round (radians for every unit behind the root).
const PLUME_FOLDS = [
  [0.1, 0.05],
  [0.21, 0.06],
  [0.32, 0.06],
  [0.43, 0.05],
];
const PLUME_SWEEP = 5.2;
// What each bone of a tail is turned up by when a fox stands (animator.js, POSES.stand: tl 0.12 — three quarters of
// it on the first bone, a quarter on the second — and tc 0.07 on every one).
const TAIL_STAND = [0.16, 0.1, 0.07, 0.07, 0.07];

const INK = {
  white: '#ebe1df',
  shade: '#ad9da6', //    the white of the eye under the lash
  rim: '#5a3c22',
  iris: ['#6b4d32', '#97744a', '#bf9f60', '#dfcb9c'], // from the top of the iris down
  pupil: '#4a301c',
  lash: '#84706a',
  brow: '#806454',
  nose: '#73594c',
};

const catmull = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** The head at one level: [half-width, forward, back]. */
function level(h) {
  const P = PROFILE;
  const n = P.length;
  if (h <= P[0][0]) return [P[0][1], P[0][2], P[0][3]];
  if (h >= P[n - 1][0]) return [P[n - 1][1], P[n - 1][2], P[n - 1][3]];
  let i = 0;
  while (h > P[i + 1][0]) i++;
  const t = (h - P[i][0]) / (P[i + 1][0] - P[i][0]);
  const at = (k) => P[clamp(k, 0, n - 1)];
  return [1, 2, 3].map((c) => Math.max(0.004, catmull(at(i - 1)[c], at(i)[c], at(i + 1)[c], at(i + 2)[c], t)));
}

/** How far the snout stands out of the face at a place on the head (level `h`, `a` radians round from straight ahead). */
function snout(h, a) {
  const u = Math.hypot(a / SNOUT.wide, (h - SNOUT.h) / (h > SNOUT.h ? SNOUT.high * 1.25 : SNOUT.high));
  if (u >= 1) return 0;
  const k = 1 - u * u;
  return SNOUT.out * k * k;
}

/** A point of the head's skin: level `h`, `a` radians round from straight ahead (towards its left). In the rig's space. */
function skin(h, a, out = new THREE.Vector3()) {
  const [W, F, B] = level(h);
  const s = Math.sin(a);
  const c = Math.cos(a);
  // (in front the ring is a little squared off: a flat face and full cheeks)
  const e = c >= 0 ? FLAT : 1;
  const x = W * Math.sign(s) * Math.pow(Math.abs(s), e);
  const z = (c >= 0 ? F : B) * Math.sign(c) * Math.pow(Math.abs(c), e);
  let wrap = a % (Math.PI * 2);
  if (wrap > Math.PI) wrap -= Math.PI * 2;
  if (wrap < -Math.PI) wrap += Math.PI * 2;
  return out.set(x, HEAD.y + h, HEAD.z + z + snout(h, wrap));
}

/** The skin of the face under a point seen from in front (`x` to its left of the middle, `y` above the middle of the head): how far forward it is. */
function faceZ(x, y) {
  const h = clamp(y, HEAD.low + 0.002, HEAD.top - 0.002);
  const [W, F] = level(h);
  const s = clamp(x / W, -0.999, 0.999);
  // x = W · sin(a)^e  →  a
  const a = Math.asin(Math.sign(s) * Math.pow(Math.abs(s), 1 / FLAT));
  return HEAD.z + F * Math.pow(Math.cos(a), FLAT) + snout(h, a);
}

/** A tuft: a pointed lock of fur from `from` to `to`, `r` thick at its root, flattened (`flat`) across `side`. */
function lock(kit, from, to, r, { w, color, fur = 0.3, flat = 0.62, side = null, bow = null }) {
  const { V, coat } = kit;
  const at = (t) => {
    const p = V().lerpVectors(from, to, t);
    if (bow) p.addScaledVector(bow, Math.sin(t * Math.PI)); // (a lock may curve on its way)
    return p;
  };
  const keys = [
    [-0.25, 0.92],
    [0.06, 1],
    [0.38, 0.76],
    [0.68, 0.46],
    [0.9, 0.18],
    [1, 0.05],
  ].map(([t, k]) => ({ c: at(t), rx: r * k, ry: r * k * flat, w, fur: fur * (0.12 + 0.88 * k) }));
  coat.loft(keys, { segs: 6, sub: 1, comb: 1, side: side || V(1, 0, 0), color });
}

/** A point of fur as thin as a leaf: from the foot `a`–`b` out to `tip`. (Seen from both sides.) */
function flap(kit, a, b, tip, { w, color }) {
  const { coat, V } = kit;
  const mid = V().addVectors(a, b).multiplyScalar(0.5);
  const up = V().subVectors(tip, mid).normalize();
  for (const turn of [false, true]) {
    const i = [a, b, tip].map((p) => coat.vert(p, color(), w, 0, up, mid));
    if (turn) coat.idx.push(i[0], i[2], i[1]);
    else coat.idx.push(i[0], i[1], i[2]);
  }
}

export const ANIMUD = {
  size: 0.66,
  leg: 0.937,
  legR: 1,
  girth: 1.07,
  bodyLen: 0.914,
  neck: 1,
  head: 2.3, //   (what it wears goes by this: a bow, a crown, headphones — and by `eye`, its sunglasses)
  skull: 1,
  crown: 1,
  boxy: 0,
  jowl: 0,
  ruff: 0,
  muzzle: 0.4,
  snout: 1,
  eye: 1.2,
  lids: 0,
  earH: EAR.long,
  earW: EAR.wide,
  earRound: 0,
  earSpread: EAR.lean,
  earSet: 1,
  tailLen: 1.36, // (its bones reach to the end of the plume)
  tailR: 2.16,
  tails: 1,
  tailFan: 1.05,
  tailLift: -0.2,
  fur: 1,
  tipAmt: 0,
  // (paler and bluer than they are to look: the daylight of the foxes' world is warm, and the grass throws green up at them)
  colors: {
    coat: '#fbe8e3',
    back: '#fbe8e3',
    belly: '#fdf0ec',
    sock: '#f6d9d3',
    earBack: '#f9e4de',
    earIn: '#f6d8d1',
    earTip: '#fbe8e3',
    tailTip: '#f4c3bb',
    nose: INK.nose,
    eye: INK.pupil,
    tongue: '#f48aa2',
    tip: '#ffffff',
  },
  // Poses it holds its own way (the rest are every fox's: animator.js). Its head is too large, on too short a neck, to be
  // put to the ground: where a fox stretches its neck down, this one bows a little and brings its chest down instead —
  // and it sleeps sitting on its ruff, nodding.
  poses: {
    eat: { hy: -0.02, hrx: 0.42, srx: 0.05, nrx: 0.12, hdx: 0.1, tl: 0.2, earB: 0.15, locF: 1, flatF: 1, ffx: 0.095, ffz: 0.16 },
    sniff: { hy: -0.03, hrx: 0.26, nrx: 0.14, hdx: 0.1, tl: 0.1, earB: 0.1 },
    sleep: { hry: 0.2, sry: 0.2, cry: 0.2, nry: 0.2, nrx: 0.16, hdy: 0.15, hdx: 0.1, hdz: 0.1, tl: 0.15, tc: 0, ts: 0.9, earB: 0.2, earD: 0.3 },
    howl: { nrx: -0.12, hdx: -0.25 },
  },
  extra: { pink: '#f4c3bb', rose: '#e9a8a0', earDeep: '#ecc0b8', lash: INK.lash, brow: INK.brow },

  own: {
    /** A short neck straight up, the big head low on it; the legs a little further apart; the tail set on high. */
    joints({ J, LJ, tailDefs, yB, zH, zC }) {
      J.neck.set(0, 0.5, zC + 0.045);
      J.head.set(0, PIVOT.y, PIVOT.z);
      J.jaw.set(0, HEAD.y - 0.13, HEAD.z + 0.085);
      J.earL.set(EAR.x, HEAD.y + EAR.y, HEAD.z + EAR.z - 0.01);
      J.earR.set(-EAR.x, HEAD.y + EAR.y, HEAD.z + EAR.z - 0.01);
      for (const side of ['L', 'R']) for (const key in LJ[side]) LJ[side][key].x *= 1.225;
      tailDefs[0].base.set(0, yB - 0.03, zH - 0.062);
    },

    torso(kit) {
      const { V, coat, col, C, J, smooth, yB, zH, zS, zC } = kit;
      const plain = () => col.copy(C.coat);
      // the trunk: small, from the rump to the chest — in a coat about as deep as a red fox's (her picture is smooth, but
      // in the foxes' world, seen from above, a bare trunk looked like lumps)
      coat.loft(
        [
          { c: V(0, yB + 0.004, zH - 0.092), rx: 0.022, ry: 0.022, w: { hips: 1 }, fur: 0.55 },
          { c: V(0, yB + 0.004, zH - 0.072), rx: 0.068, ry: 0.06, ryB: 0.064, w: { hips: 1 }, fur: 0.7 },
          { c: V(0, yB + 0.002, zH - 0.02), rx: 0.1, ry: 0.086, ryB: 0.108, w: { hips: 1 }, fur: 0.85 },
          { c: V(0, yB, zH + 0.06), rx: 0.107, ry: 0.092, ryB: 0.122, w: { hips: 0.7, spine: 0.3 }, fur: 0.9 },
          { c: V(0, yB + 0.002, zS), rx: 0.106, ry: 0.092, ryB: 0.124, w: { hips: 0.2, spine: 0.8 }, fur: 0.9 },
          { c: V(0, yB + 0.004, zS + 0.08), rx: 0.107, ry: 0.094, ryB: 0.126, w: { spine: 0.6, chest: 0.4 }, fur: 0.9 },
          { c: V(0, yB + 0.006, zC), rx: 0.108, ry: 0.096, ryB: 0.124, w: { chest: 1 }, fur: 0.9 },
          { c: V(0, yB + 0.012, zC + 0.06), rx: 0.094, ry: 0.092, ryB: 0.098, w: { chest: 1 }, fur: 0.85 },
          { c: V(0, yB + 0.016, zC + 0.095), rx: 0.05, ry: 0.05, w: { chest: 1 }, fur: 0.75 },
        ],
        { segs: 16, sub: 3, comb: -1, droop: 0.3, color: plain }
      );
      // the neck: up out of the shoulders into the head (the ruff is in front of it)
      coat.loft(
        [
          { c: V(0, yB + 0.02, zC + 0.02), rx: 0.084, ry: 0.084, w: { chest: 1 }, fur: 0.85 },
          { c: V(0, yB + 0.08, zC + 0.03), rx: 0.086, ry: 0.086, w: { chest: 0.6, neck: 0.4 }, fur: 0.85 },
          { c: V(0, J.neck.y + 0.02, J.neck.z), rx: 0.084, ry: 0.084, w: { neck: 1 }, fur: 0.8 },
          { c: V(0, J.head.y - 0.07, J.head.z - 0.01), rx: 0.08, ry: 0.08, w: { neck: 0.5, head: 0.5 }, fur: 0.7 },
          { c: V(0, J.head.y - 0.02, J.head.z), rx: 0.06, ry: 0.06, w: { head: 1 }, fur: 0.5 },
        ],
        { segs: 12, sub: 2, comb: -1, color: plain }
      );
      // the ruff (RUFF): a bib of fur over the chest and round the sides of the neck, cream above and rose below. One
      // skin, ring under ring (closer together in front), with the folds its fur falls in (RUFF_FOLDS) pressed into it.
      const blush = (y) => col.copy(C.coat).lerp(C.pink, 0.5 * smooth(0.62, 0.42, y) + 0.45 * smooth(0.43, 0.35, y));
      const chest = { chest: 1 };
      const TAU = Math.PI * 2;
      const row = (k) => RUFF[clamp(k, 0, RUFF.length - 1)];
      const levels = [];
      for (let i = 0; i < RUFF.length - 1; i++) {
        for (let m = 0; m < 2; m++) levels.push(RUFF[0].map((_, c) => catmull(row(i - 1)[c], row(i)[c], row(i + 1)[c], row(i + 2)[c], m / 2)));
      }
      levels.push(RUFF[RUFF.length - 1]);
      const fold = (a, y) => {
        let deep = 0;
        for (const [at, wide, d] of RUFF_FOLDS) deep += d * Math.exp(-(((a - at) / wide) ** 2));
        return deep * smooth(0.48, 0.39, y);
      };
      const down = V(0, -1, 0);
      const first = coat.count;
      const P = V();
      for (const [y, z, rx, ry, ryB, fur] of levels) {
        const neck = 0.4 * smooth(0.5, 0.58, y);
        const w = neck ? { chest: 1 - neck, neck } : chest;
        const core = V(0, y, z);
        for (let j = 0; j < RUFF_SEGS; j++) {
          // (round from straight ahead by way of its right side; `a`: the same, counted towards its left)
          const t = j / RUFF_SEGS;
          const round = TAU * t - 0.46 * Math.sin(TAU * t);
          const deep = fold(round > Math.PI ? TAU - round : -round, y);
          const c = Math.cos(round);
          P.set(-Math.sin(round) * Math.max(0.0004, rx) * (1 - deep), y, z + c * Math.max(0.0004, c >= 0 ? ry : ryB) * (1 - deep));
          coat.vert(P, blush(y), w, fur * (1 - 6 * deep), down, core);
        }
      }
      const L = levels.length;
      for (let r = 0; r < L - 1; r++) {
        for (let j = 0; j < RUFF_SEGS; j++) {
          const a = first + r * RUFF_SEGS + j;
          const b = first + r * RUFF_SEGS + ((j + 1) % RUFF_SEGS);
          coat.idx.push(a, b, a + RUFF_SEGS, b, b + RUFF_SEGS, a + RUFF_SEGS);
        }
      }
      // …closed on top (inside the head) and at the point
      const [topY, topZ] = levels[0];
      const [endY, endZ] = levels[L - 1];
      const top = coat.vert(V(0, topY + 0.05, topZ), blush(topY), { chest: 0.6, neck: 0.4 }, 0.1, down, V(0, topY, topZ));
      const point = coat.vert(V(0, endY - 0.005, endZ), blush(endY), chest, 0.3, down, V(0, endY, endZ));
      const under = first + (L - 1) * RUFF_SEGS;
      for (let j = 0; j < RUFF_SEGS; j++) {
        const k = (j + 1) % RUFF_SEGS;
        coat.idx.push(top, first + k, first + j, point, under + j, under + k);
      }
      // …and ends in two small points
      for (const sg of [1, -1]) lock(kit, V(sg * 0.012, 0.3, 0.322), V(sg * 0.016, 0.253, 0.318), 0.017, { w: chest, fur: 0.3, flat: 0.6, side: V(1, 0, 0), color: () => blush(0.26) });
      // …and its tufts over the shoulders (RUFF_TUFTS)
      for (const sg of [1, -1]) {
        for (const [x0, y0, z0, x1, y1, z1, r] of RUFF_TUFTS) {
          lock(kit, V(sg * x0, y0, z0), V(sg * x1, y1, z1), r, { w: chest, fur: 0.3, flat: 0.45, side: V(0, 1, 0), color: plain });
        }
      }
    },

    /** Slim legs, as thick at the ankle as at the knee, on round paws; the forelegs broad at the shoulder, where they show beside the ruff. */
    legs(kit) {
      const { V, coat, col, C, LJ, lerp, smooth, zH, zC } = kit;
      // (rosier the nearer the ground: its paws are as rose as the point of its ruff)
      const legColor = (i) => col.copy(C.coat).lerp(C.pink, 0.1 + 0.8 * smooth(0.36, 0, i.P.y));
      const pawColor = () => col.copy(C.coat).lerp(C.pink, 0.9);
      for (const side of ['L', 'R']) {
        const j = LJ[side];
        const U = `fU${side}`;
        const Lo = `fL${side}`;
        const Pw = `fP${side}`;
        const x = j.fU.x;
        const sY = j.fU.y;
        const eY = j.fL.y;
        coat.loft(
          [
            // (the shoulder: broad where it comes out from under the ruff, beside its point)
            { c: V(x, 0.47, zC), rx: 0.046, ry: 0.05, w: { chest: 1 }, fur: 0.7 },
            { c: V(x * 1.08, 0.42, zC + 0.012), rx: 0.06, ry: 0.062, w: { chest: 1 }, fur: 0.7 },
            { c: V(x * 1.1, 0.37, zC + 0.02), rx: 0.062, ry: 0.066, w: { chest: 0.85, [U]: 0.15 }, fur: 0.7 },
            { c: V(x * 1.085, sY, zC + 0.024), rx: 0.057, ry: 0.062, w: { chest: 0.5, [U]: 0.5 }, fur: 0.65 },
            { c: V(x * 1.05, 0.292, zC + 0.026), rx: 0.052, ry: 0.056, w: { chest: 0.2, [U]: 0.8 }, fur: 0.6 },
            { c: V(x, lerp(sY, eY, 0.5), zC + 0.02), rx: 0.042, ry: 0.044, w: { [U]: 1 }, fur: 0.45 },
            { c: V(x, eY, zC + 0.008), rx: 0.033, ry: 0.035, w: { [U]: 0.5, [Lo]: 0.5 }, fur: 0.35 },
            { c: V(x, lerp(eY, j.fP.y, 0.5), zC + 0.02), rx: 0.029, ry: 0.031, w: { [Lo]: 1 }, fur: 0.25 },
            { c: V(x, 0.06, zC + 0.03), rx: 0.027, ry: 0.029, w: { [Lo]: 0.5, [Pw]: 0.5 }, fur: 0.22 },
            { c: V(x, 0.03, zC + 0.038), rx: 0.034, ry: 0.042, ryB: 0.03, w: { [Pw]: 1 }, fur: 0.2 },
            { c: V(x, 0.008, zC + 0.04), rx: 0.032, ry: 0.04, ryB: 0.028, w: { [Pw]: 1 }, fur: 0.15 },
          ],
          { segs: 10, sub: 2, comb: 1, color: legColor }
        );
        coat.blob(V(x, 0.021, zC + 0.06), 0.035, 0.023, 0.04, { w: { [Pw]: 1 }, furLen: 0.15, color: pawColor });

        const T = `hT${side}`;
        const Sh = `hS${side}`;
        const F = `hF${side}`;
        const Hp = `hP${side}`;
        const hx = j.hT.x;
        const hY = j.hT.y;
        const kY = j.hS.y;
        const oY = j.hF.y;
        coat.loft(
          [
            { c: V(hx * 0.92, hY + 0.05, zH - 0.005), rx: 0.044, ry: 0.062, w: { hips: 0.7, [T]: 0.3 }, fur: 0.7 },
            { c: V(hx, hY - 0.01, zH + 0.004), rx: 0.048, ry: 0.062, ryB: 0.058, w: { hips: 0.35, [T]: 0.65 }, fur: 0.65 },
            { c: V(hx, lerp(hY, kY, 0.55), zH + 0.03), rx: 0.042, ry: 0.05, w: { [T]: 1 }, fur: 0.5 },
            { c: V(hx, kY, zH + 0.05), rx: 0.035, ry: 0.037, ryB: 0.039, w: { [T]: 0.5, [Sh]: 0.5 }, fur: 0.35 },
            { c: V(hx, lerp(kY, oY, 0.5), zH + 0.006), rx: 0.03, ry: 0.032, ryB: 0.033, w: { [Sh]: 1 }, fur: 0.25 },
            { c: V(hx, oY, zH - 0.04), rx: 0.028, ry: 0.029, ryB: 0.03, w: { [Sh]: 0.5, [F]: 0.5 }, fur: 0.22 },
            { c: V(hx, lerp(oY, j.hP.y, 0.55), zH - 0.032), rx: 0.027, ry: 0.028, w: { [F]: 1 }, fur: 0.22 },
            { c: V(hx, 0.046, zH - 0.024), rx: 0.028, ry: 0.031, ryB: 0.028, w: { [F]: 0.5, [Hp]: 0.5 }, fur: 0.2 },
            { c: V(hx, 0.028, zH - 0.02), rx: 0.034, ry: 0.042, ryB: 0.03, w: { [Hp]: 1 }, fur: 0.2 },
            { c: V(hx, 0.008, zH - 0.018), rx: 0.032, ry: 0.04, ryB: 0.028, w: { [Hp]: 1 }, fur: 0.15 },
          ],
          { segs: 10, sub: 2, comb: 1, color: legColor }
        );
        coat.blob(V(hx, 0.021, zH), 0.035, 0.023, 0.04, { w: { [Hp]: 1 }, furLen: 0.15, color: pawColor });
      }
    },

    /**
     * A plume (PLUME). It is drawn as it is carried when the fox stands; standing, the bones of a tail are curled a
     * little (TAIL_STAND), and that curl is taken out of every point here — so that it is there again when it stands.
     * Cream below and on its flanks, rose on top, and paler rose towards its end.
     */
    tail(kit) {
      const { V, coat, col, C, tails, tailLen, smooth, lerp } = kit;
      const tail = tails[0];
      const n = tail.bones.length;
      const seg = tailLen / n;
      const turn = (p, a) => V(p.x, p.y * Math.cos(a) - p.z * Math.sin(a), p.y * Math.sin(a) + p.z * Math.cos(a)); // (about the axis from side to side)
      // the bones: where each begins at rest (`j`) and as the fox stands (`q`), turned up by `A` then
      const j = [];
      const q = [];
      const A = [];
      for (let i = 0; i < n; i++) {
        j.push(tail.def.base.clone().addScaledVector(tail.dir, seg * i));
        A.push((i ? A[i - 1] : 0) + TAIL_STAND[Math.min(i, TAIL_STAND.length - 1)]);
        q.push(i ? q[i - 1].clone().add(turn(j[i].clone().sub(j[i - 1]), A[i - 1])) : j[0].clone());
      }
      const root = j[0];
      const reach = root.z - (q[n - 1].z + turn(tail.dir, A[n - 1]).z * seg); // how far behind the root the bones go, standing
      const name = (i) => `tail0_${clamp(i, 0, n - 1)}`;
      /** The bones that carry what is `d` behind the root. */
      const weights = (d) => {
        const u = Math.max(0, d / reach) * n - 0.5;
        const i0 = Math.floor(u);
        const f = u - i0;
        const w = {};
        w[name(i0)] = (w[name(i0)] || 0) + (1 - f);
        w[name(i0 + 1)] = (w[name(i0 + 1)] || 0) + f;
        return w;
      };
      /** A point as it is when the fox stands → where it is at rest, carried by the bones `w`. (`way`: a direction, not a place.) */
      const rest = (P, w, way = false) => {
        const out = V();
        for (const key in w) {
          const i = +key.slice(6);
          out.addScaledVector(way ? turn(P, -A[i]) : turn(P.clone().sub(q[i]), -A[i]).add(j[i]), w[key]);
        }
        return out;
      };
      /** The plume at `d` behind the root: [top, underside, widest level, half-width] — between the stations, smoothly. */
      const station = (d) => {
        let i = 0;
        while (i < PLUME.length - 2 && d > PLUME[i + 1][0]) i++;
        const t = clamp((d - PLUME[i][0]) / (PLUME[i + 1][0] - PLUME[i][0]), 0, 1);
        const at = (k) => PLUME[clamp(k, 0, PLUME.length - 1)];
        return [1, 2, 3, 4].map((c) => clamp(catmull(at(i - 1)[c], at(i)[c], at(i + 1)[c], at(i + 2)[c], t), Math.min(at(i)[c], at(i + 1)[c]), Math.max(at(i)[c], at(i + 1)[c])));
      };
      const sweep = (d) => 0.075 * smooth(0.4, PLUME_TIP[0], d) ** 2; // (its end curls away to the fox's left: from behind, a lobe low on that side)
      const middle = (d, y) => V(sweep(d), y, root.z - d);
      // (round a tail, which points backwards, s = 1 is underneath)
      const tone = (d, y, s) => {
        const up = smooth(-0.3, -0.85, s) * smooth(0.16, 0.3, d); // how near its ridge it is (not where it rises from the root)
        const far = smooth(0.26, 0.42, d); //          how far along the plume it is
        const low = smooth(0.17, 0.26, y); //          (none of the rose at the very bottom)
        return col.copy(C.coat).lerp(C.pink, Math.max(up, far * 0.65) * low).lerp(C.rose, up * smooth(0.5, 0.6, y) * 0.4);
      };

      // rings, upright, from the stalk to just before the tip
      const SUB = 2;
      const stops = [];
      for (let k = 0; k < PLUME.length - 1; k++) for (let m = 0; m < SUB; m++) stops.push(lerp(PLUME[k][0], PLUME[k + 1][0], m / SUB));
      stops.push(PLUME[PLUME.length - 1][0]);
      const R = stops.length;
      const pts = stops.map((d) => {
        const [top, low, mid, wide] = station(d);
        const ring = [];
        for (let k = 0; k < PLUME_SEGS; k++) {
          const a = (k / PLUME_SEGS) * Math.PI * 2;
          const sa = Math.sin(a);
          // the folds: each leaves the ridge at its place and goes round, down either flank, the further back it is
          const round = Math.acos(clamp(-sa, -1, 1)); // (0 on the ridge … π underneath)
          let deep = 0;
          for (const [from, most] of PLUME_FOLDS) {
            const at = 0.35 + PLUME_SWEEP * (d - from);
            deep += most * Math.exp(-(((round - at) / 0.2) ** 2)) * smooth(0.3, 0.42, at) * smooth(2.9, 2.5, at);
          }
          ring.push({ P: V(sweep(d) + Math.cos(a) * wide * (1 - deep), mid - sa * (sa >= 0 ? mid - low : top - mid) * (1 - deep), root.z - d), s: sa, deep });
        }
        return { d, mid, thick: top - low, ring };
      });
      const tip = middle(PLUME_TIP[0], PLUME_TIP[1]);
      const base = coat.count;
      const along = V();
      pts.forEach((stop, r) => {
        const w = weights(stop.d);
        const core = rest(middle(stop.d, stop.mid), w);
        const fur = 0.3 + 0.4 * smooth(0.03, 0.3, stop.thick);
        stop.ring.forEach(({ P, s, deep }, k) => {
          // its fur lies along it, backwards: towards the same place on the next ring (or the tip)
          along.copy(r < R - 1 ? pts[r + 1].ring[k].P : tip).sub(r ? pts[r - 1].ring[k].P : P).normalize();
          coat.vert(rest(P, w), tone(stop.d, P.y, s).multiplyScalar(1 - deep), w, fur * (1 - 5 * deep), rest(along, w, true).normalize(), core);
        });
      });
      for (let r = 0; r < R - 1; r++) {
        for (let k = 0; k < PLUME_SEGS; k++) {
          const a = base + r * PLUME_SEGS + k;
          const b = base + r * PLUME_SEGS + ((k + 1) % PLUME_SEGS);
          coat.idx.push(a, b, a + PLUME_SEGS, b, b + PLUME_SEGS, a + PLUME_SEGS);
        }
      }
      // …closed in front (inside the rump) and at the tip
      const w0 = weights(stops[0]);
      const w1 = weights(PLUME_TIP[0]);
      const back = V(0, 0, -1);
      const front = coat.vert(rest(middle(stops[0] - 0.012, pts[0].mid), w0), tone(0, pts[0].mid, 0), w0, 0.3, rest(back, w0, true), rest(middle(stops[0], pts[0].mid), w0));
      const end = coat.vert(rest(tip, w1), tone(PLUME_TIP[0], PLUME_TIP[1], -1), w1, 0.3, rest(back, w1, true), rest(tip, w1));
      const last = base + (R - 1) * PLUME_SEGS;
      for (let k = 0; k < PLUME_SEGS; k++) {
        const m = (k + 1) % PLUME_SEGS;
        coat.idx.push(front, base + m, base + k, end, last + k, last + m);
      }
    },

    head(kit) {
      const { V, coat, col, C, J, smooth } = kit;
      const core = V(0, HEAD.y, HEAD.z);
      const comb = V(0, -1, -0.25).normalize();
      const w = { head: 1 };
      const TAU = Math.PI * 2;
      // ---- the head: one skin, snout and all — rings from under the chin to the crown, closer together round the face
      const angle = (j) => {
        const t = j / SEGS;
        return TAU * t - 0.46 * Math.sin(TAU * t);
      };
      const P = V();
      const base = coat.count;
      const span = HEAD.top - HEAD.low - 0.012;
      for (let i = 0; i < RINGS; i++) {
        const h = HEAD.low + 0.006 + (span * i) / (RINGS - 1);
        for (let j = 0; j < SEGS; j++) {
          skin(h, angle(j), P);
          const x = P.x;
          const y = P.y - HEAD.y;
          // no fur over its eyes and brows, next to none on the face; short everywhere else
          const eye = Math.min(Math.hypot((Math.abs(x) - EYE.x) / (EYE.rx * 1.22), (y - EYE.y - 0.008) / (EYE.ry * 1.3)), Math.hypot((Math.abs(x) - BROW.x) / (BROW.rx * 1.7), (y - BROW.y) / (BROW.ry * 2.2)));
          const face = smooth(-0.02, 0.1, P.z - HEAD.z - 0.02) * 0.34; // (what is in front of the middle of the head)
          const fur = P.z > HEAD.z ? Math.min(0.42 - face * smooth(HEAD.low, -0.1, y), 0.42 * smooth(0.95, 1.5, eye)) : 0.42;
          coat.vert(P, col.copy(C.coat), w, Math.max(0, fur), comb, core);
        }
      }
      for (let i = 0; i < RINGS - 1; i++) {
        for (let j = 0; j < SEGS; j++) {
          const a = base + i * SEGS + j;
          const b = base + i * SEGS + ((j + 1) % SEGS);
          coat.idx.push(a, b, a + SEGS, b, b + SEGS, a + SEGS);
        }
      }
      const chin = coat.vert(V(0, HEAD.y + HEAD.low, HEAD.z), col.copy(C.coat), w, 0.3, comb, core);
      const crown = coat.vert(V(0, HEAD.y + HEAD.top, HEAD.z), col.copy(C.coat), w, 0.42, comb, core);
      const last = base + (RINGS - 1) * SEGS;
      for (let j = 0; j < SEGS; j++) {
        const k = (j + 1) % SEGS;
        coat.idx.push(chin, base + k, base + j, crown, last + j, last + k);
      }

      // ---- the lower jaw: no more than a chin under the snout, until it opens
      const tip = faceZ(0, SNOUT.h); // how far forward the tip of the snout is
      coat.loft(
        [
          [0, 0.004, 0.044, 0.01, 0.022],
          [0.035, 0.006, 0.036, 0.009, 0.019],
          [0.06, 0.008, 0.026, 0.008, 0.015],
          [0.078, 0.009, 0.016, 0.006, 0.01],
        ].map(([z, y, rx, ry, ryB]) => ({ c: V(0, J.jaw.y + y, J.jaw.z + z), rx, ry, ryB, w: { jaw: 1 }, fur: 0.1 })),
        { segs: 8, sub: 2, comb: -1, color: () => col.copy(C.belly) }
      );

      // ---- three tufts on either cheek, where the head is widest; a small one on top
      const cream = () => col.copy(C.coat);
      for (const sg of [1, -1]) {
        [
          [-0.046, 0.02, 0.058, 0.035],
          [-0.073, -0.002, 0.066, 0.038],
          [-0.098, -0.026, 0.05, 0.034],
        ].forEach(([h, drop, out, r]) => {
          const [W] = level(h);
          const from = V(sg * (W - 0.04), HEAD.y + h, HEAD.z - 0.006);
          const to = V(sg * (W + out), HEAD.y + h + drop, HEAD.z - 0.016);
          lock(kit, from, to, r, { w, fur: 0.3, flat: 0.45, side: V(0, 1, 0.2).normalize(), color: cream });
        });
      }
      [
        [0, 0.038, 0.017],
        [0.016, 0.02, 0.012],
        [-0.014, 0.017, 0.011],
      ].forEach(([x, up, r]) => {
        const from = V(x * 0.7, HEAD.y + HEAD.top - 0.03, HEAD.z + 0.01);
        const to = V(x * 1.6 - 0.004, HEAD.y + HEAD.top + up, HEAD.z - 0.004);
        lock(kit, from, to, r, { w, fur: 0.3, color: cream });
      });

      // ---- the ears: thin shells, hollow in front, cut to their outline as it is seen from in front — tufts and all
      const edge = (table, y) => {
        const n = table.length;
        if (y <= table[0][0]) return table[0][1];
        if (y >= table[n - 1][0]) return table[n - 1][1];
        let i = 0;
        while (y > table[i + 1][0]) i++;
        const at = (k) => table[clamp(k, 0, n - 1)][1];
        return catmull(at(i - 1), at(i), at(i + 1), at(i + 2), (y - table[i][0]) / (table[i + 1][0] - table[i][0]));
      };
      const tipY = EAR.out[EAR.out.length - 1][0];
      const ys = [];
      for (let i = 0; i < EAR_ROWS; i++) ys.push(tipY * (1 - Math.pow(1 - i / (EAR_ROWS - 1), 1.25))); // (closer together towards the tip)
      for (const side of ['L', 'R']) {
        const sg = side === 'L' ? 1 : -1;
        const bone = `ear${side}`;
        const mid = V(sg * 0.19, HEAD.y + 0.22, HEAD.z + EAR.z - 0.02);
        const up = V(0, 1, -EAR.back).normalize();
        const first = coat.count;
        const at = (i, j, back) => first + i * (2 * EAR_COLS) + (back && j > 0 && j < EAR_COLS ? EAR_COLS + j : j);
        ys.forEach((y) => {
          const v = y / tipY;
          const xo = edge(EAR.out, y);
          const xi = Math.min(xo, edge(EAR.in, y));
          const zp = HEAD.z + EAR.z - (y - EAR.y) * EAR.back; // (it leans back a little)
          const cup = 0.02 * Math.pow(Math.sin(Math.PI * clamp(0.12 + 0.88 * v, 0, 1)), 0.6);
          const thick = 0.016 * (1 - 0.6 * v) + 0.004;
          const weights = y < EAR.y - 0.04 ? { head: 0.7, [bone]: 0.3 } : y < EAR.y + 0.03 ? { head: 0.3, [bone]: 0.7 } : { [bone]: 1 };
          for (const back of [false, true]) {
            for (let j = back ? 1 : 0; j <= (back ? EAR_COLS - 1 : EAR_COLS); j++) {
              const u = j / EAR_COLS;
              const bow = Math.pow(Math.sin(Math.PI * u), 0.7);
              P.set(sg * (xo + (xi - xo) * u), HEAD.y + y, zp - cup * bow - (back ? thick * Math.pow(Math.sin(Math.PI * u), 0.5) : 0));
              if (back) col.copy(C.earBack);
              else {
                // hollow and dusky inside, with a pale rim all round
                const rim = Math.max(smooth(0.2, 0.03, u), smooth(0.8, 0.97, u), smooth(0.84, 0.98, v));
                col.copy(C.earIn).lerp(C.earDeep, smooth(0.6, 0.18, v) * bow * 0.6).lerp(C.earBack, rim);
              }
              coat.vert(P, col, weights, 0.2, up, mid);
            }
          }
        });
        for (let i = 0; i < ys.length - 1; i++) {
          for (let j = 0; j < EAR_COLS; j++) {
            for (const back of [false, true]) {
              const a = at(i, j, back);
              const b = at(i, j + 1, back);
              const c = at(i + 1, j, back);
              const d = at(i + 1, j + 1, back);
              // (the front looks ahead, the back behind: each the other way round — and the right ear is the left one mirrored)
              if ((sg > 0) !== back) coat.idx.push(a, c, b, b, c, d);
              else coat.idx.push(a, b, c, b, d, c);
            }
          }
        }
        // …the points of fur along its edges, and a few fine ones in the hollow, at its root
        const plane = (y) => HEAD.z + EAR.z - (y - EAR.y) * EAR.back;
        const bit = (x0, y0, x1, y1, r, color = cream, z = 0) =>
          lock(kit, V(sg * x0, HEAD.y + y0, plane(y0) - 0.008 + z), V(sg * x1, HEAD.y + y1, plane(y1) - 0.006 + z), r, { w: { [bone]: 1 }, fur: 0.16, flat: 0.42, side: V(0, 1, 0), color });
        const point = (table, y, long, slant, way) => {
          const at = (yy, dx = 0) => V(sg * (edge(table, yy) + dx), HEAD.y + yy, plane(yy) - 0.006);
          flap(kit, at(y + 0.017, -way * 0.004), at(y - 0.011, -way * 0.004), at(y + slant, way * long), { w: { [bone]: 1 }, color: cream });
        };
        for (const [y, long, slant] of EAR.tufts.out) point(EAR.out, y, long, slant, 1);
        for (const [y, long, slant] of EAR.tufts.in) point(EAR.in, y, long, slant, -1);
        const dusk = () => col.copy(C.earDeep).multiplyScalar(0.94);
        [
          [0.114, 0.178, 0.124, 0.216],
          [0.14, 0.172, 0.156, 0.226],
          [0.168, 0.168, 0.19, 0.212],
        ].forEach(([x0, y0, x1, y1]) => bit(x0, y0, x1, y1, 0.0055, dusk, -0.007));
      }

      return {
        dims: {
          noseTip: V(0, HEAD.y + SNOUT.h - J.head.y, tip + 0.004 - J.head.z),
          crown: V(0, HEAD.y + HEAD.top - J.head.y, HEAD.z - J.head.z),
          eyeLine: HEAD.y + EYE.y - J.head.y,
          neckR: 0.168,
          scarfAt: V(0, 0.6 - J.neck.y, 0.236 - J.neck.z), // (a scarf lies on top of the ruff, under the chin: in the neck bone's space)
          nod: 0.45, // (a head this large does not go nose to the ground: it bows a little, and the body comes down instead)
        },
      };
    },

    /**
     * Its face lies on the skin of the head: every part of it is made where it is seen from in front, and laid on the
     * skin there. The eyes are low domes with the iris painted on; over each a thick lash that ends in a wing at the
     * outer corner, and a dot of a brow. They close their own way (`set`): a blink brings the lash down over the eye;
     * shut, there is one dark arc — up-curved for a happy face, down-curved in sleep.
     */
    face(kit) {
      const { V, bones, J, C } = kit;
      const made = [];
      const keep = (x) => (made.push(x), x);
      const inHead = (x, y, z) => V(x, HEAD.y + y - J.head.y, z - J.head.z); // (the head bone's space)
      const flat = (color) => keep(new THREE.MeshLambertMaterial({ color }));
      const lashMat = flat(C.lash);
      const browMat = flat(C.brow);

      /** A low dome over an oval of the face: `rise` high in the middle, its rim `sunk` into the skin. Painted by a map, if it is given one. */
      const dome = (cx, cy, rx, ry, rise, sunk, rings = 7, segs = 28) => {
        const z0 = faceZ(cx, cy);
        const pos = [0, 0, rise - sunk];
        const uv = [0.5, 0.5];
        const idx = [];
        for (let k = 1; k <= rings; k++) {
          const r = k / rings;
          for (let m = 0; m < segs; m++) {
            const a = (m / segs) * Math.PI * 2;
            const x = r * Math.cos(a) * rx;
            const y = r * Math.sin(a) * ry;
            pos.push(x, y, faceZ(cx + x, cy + y) - z0 - sunk + rise * Math.pow(Math.max(0, 1 - r * r), 0.6));
            uv.push(0.5 + 0.5 * r * Math.cos(a), 0.5 + 0.5 * r * Math.sin(a));
          }
        }
        for (let m = 0; m < segs; m++) idx.push(0, 1 + m, 1 + ((m + 1) % segs));
        for (let k = 1; k < rings; k++) {
          for (let m = 0; m < segs; m++) {
            const a = 1 + (k - 1) * segs + m;
            const b = 1 + (k - 1) * segs + ((m + 1) % segs);
            idx.push(a, a + segs, b, b, a + segs, b + segs);
          }
        }
        const g = keep(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
      };

      /**
       * A stroke laid on the face: through `points` ([x, y, half its width] from (cx, cy), as seen from in front), a
       * little raised along its middle.
       */
      const stroke = (cx, cy, points, lift = 0.006, steps = 5) => {
        const z0 = faceZ(cx, cy);
        const n = points.length;
        const at = (i) => points[clamp(i, 0, n - 1)];
        const line = [];
        for (let i = 0; i < n - 1; i++) {
          for (let s = 0; s < steps; s++) {
            const t = s / steps;
            line.push([0, 1, 2].map((c) => catmull(at(i - 1)[c], at(i)[c], at(i + 1)[c], at(i + 2)[c], t)));
          }
        }
        line.push(points[n - 1].slice());
        const pos = [];
        const idx = [];
        line.forEach((p, i) => {
          const a = line[Math.max(0, i - 1)];
          const b = line[Math.min(line.length - 1, i + 1)];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const nx = -(b[1] - a[1]) / len;
          const ny = (b[0] - a[0]) / len;
          const w = Math.max(0.0006, p[2]);
          [-1, -0.5, 0, 0.5, 1].forEach((side) => {
            const x = p[0] + nx * w * side;
            const y = p[1] + ny * w * side;
            pos.push(x, y, faceZ(cx + x, cy + y) - z0 + lift * (0.45 + 0.55 * Math.sqrt(1 - side * side)));
          });
          if (i) for (let k = 0; k < 4; k++) idx.push((i - 1) * 5 + k, i * 5 + k, (i - 1) * 5 + k + 1, (i - 1) * 5 + k + 1, i * 5 + k, i * 5 + k + 1);
        });
        const g = keep(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setIndex(idx);
        g.computeVertexNormals();
        return g;
      };

      const eyes = [1, -1].map((sg) => {
        const cx = sg * EYE.x;
        const cy = EYE.y;
        const eye = new THREE.Group();
        eye.position.copy(inHead(cx, cy, faceZ(cx, cy)));
        const map = keep(irisTexture(-sg)); // (the iris sits a little towards the nose)
        const ball = new THREE.Mesh(dome(cx, cy, EYE.rx, EYE.ry, 0.016, 0.004), keep(new THREE.MeshStandardMaterial({ map, roughness: 0.3 })));
        // the lash: from the inner corner up over the eye, and down the outer corner in a wing
        const lash = new THREE.Mesh(
          stroke(
            cx,
            cy,
            [
              [-0.067, 0.014, 0.001],
              [-0.058, 0.039, 0.0038],
              [-0.033, 0.059, 0.006],
              [0, 0.0655, 0.0072],
              [0.03, 0.0615, 0.0082],
              [0.05, 0.051, 0.0092],
              [0.0585, 0.036, 0.0094],
              [0.0595, 0.018, 0.0068],
              [0.057, 0, 0.001],
            ].map(([x, y, w]) => [x * sg, y, w]),
            0.0105
          ),
          lashMat
        );
        // shut: one arc, curved up or down
        const arc = (bend) =>
          new THREE.Mesh(
            stroke(
              cx,
              cy,
              [-1, -0.62, -0.25, 0.15, 0.55, 0.85, 1].map((t) => [t * 0.066 * sg, -0.011 + bend * 0.028 * (1 - t * t), t === -1 || t === 1 ? 0.0014 : 0.008 + 0.002 * t]),
              0.0095
            ),
            lashMat
          );
        const smile = arc(1);
        const sleep = arc(-1);
        smile.visible = sleep.visible = false;
        eye.add(ball, lash, smile, sleep);
        bones.head.add(eye);
        return {
          eye,
          ball,
          glint: lash,
          lid: smile,
          /** `mode`: 'open', or shut — 'sleep' or anything else (a happy face); `k`: how far a blink has come, 0 … 0.9. */
          set(mode, k) {
            const open = mode === 'open';
            ball.visible = lash.visible = open;
            smile.visible = !open && mode !== 'sleep';
            sleep.visible = mode === 'sleep';
            ball.scale.y = 1 - k;
            ball.position.y = -k * EYE.ry * 0.3;
            lash.position.set(0, -k * EYE.ry * 1.02, k * 0.014);
            lash.scale.y = 1 - 0.6 * k;
          },
        };
      });

      // a dot of a brow over each eye
      for (const sg of [1, -1]) {
        const brow = new THREE.Mesh(dome(sg * BROW.x, BROW.y, BROW.rx, BROW.ry, 0.007, 0.002, 4, 18), browMat);
        brow.position.copy(inHead(sg * BROW.x, BROW.y, faceZ(sg * BROW.x, BROW.y)));
        bones.head.add(brow);
      }

      // the nose: a small dark oval on the tip of the snout
      const noseY = SNOUT.h + 0.01;
      const nose = new THREE.Mesh(dome(0, noseY, 0.0195, 0.0125, 0.008, 0.002, 4, 18), keep(new THREE.MeshStandardMaterial({ color: C.nose, roughness: 0.35 })));
      nose.position.copy(inHead(0, noseY, faceZ(0, noseY)));
      bones.head.add(nose);

      const tongue = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 10, 8)), keep(new THREE.MeshLambertMaterial({ color: C.tongue })));
      tongue.scale.set(0.017, 0.005, 0.026);
      tongue.position.set(0, 0.012, 0.03);
      tongue.userData.rest = tongue.position.clone();
      tongue.userData.out = 0.03;
      bones.jaw.add(tongue);

      return { eyes, nose, tongue, dispose: () => made.forEach((x) => x.dispose()) };
    },
  },
};

/** The eye, painted: white, an oval iris — dark at the top, gold below — with its pupil and two lights. `inward`: which way the nose is (1 = to the right of the painting). */
function irisTexture(inward) {
  return paintTexture(256, (g, S) => {
    const c = S / 2;
    g.fillStyle = INK.white;
    g.fillRect(0, 0, S, S);
    // the shade of the lash on the white
    const shade = g.createLinearGradient(0, 0, 0, S * 0.75);
    shade.addColorStop(0, INK.shade);
    shade.addColorStop(1, 'rgba(235,225,223,0)');
    g.fillStyle = shade;
    g.fillRect(0, 0, S, S * 0.75);
    const ix = c + inward * EYE.in * c;
    const iy = c + EYE.low * c;
    const rx = EYE.iris[0] * c;
    const ry = EYE.iris[1] * c;
    const oval = (x, y, a, b) => {
      g.beginPath();
      g.ellipse(x, y, a, b, 0, 0, Math.PI * 2);
    };
    const fill = g.createLinearGradient(0, iy - ry, 0, iy + ry);
    INK.iris.forEach((color, i) => fill.addColorStop([0.04, 0.36, 0.64, 0.97][i], color));
    oval(ix, iy, rx, ry);
    g.fillStyle = fill;
    g.fill();
    // lighter towards the bottom, in a crescent
    g.save();
    oval(ix, iy, rx, ry);
    g.clip();
    const glow = g.createRadialGradient(ix, iy + ry * 0.75, 0, ix, iy + ry * 0.75, ry * 0.8);
    glow.addColorStop(0, 'rgba(255,244,196,0.6)');
    glow.addColorStop(1, 'rgba(255,244,196,0)');
    g.fillStyle = glow;
    g.fillRect(0, 0, S, S);
    g.restore();
    oval(ix, iy, rx - 2, ry - 2);
    g.lineWidth = 5;
    g.strokeStyle = INK.rim;
    g.stroke();
    oval(ix, iy - ry * 0.05, rx * 0.34, ry * 0.36);
    g.fillStyle = INK.pupil;
    g.fill();
    g.fillStyle = '#ffffff';
    oval(ix - rx * 0.3, iy - ry * 0.47, rx * 0.25, ry * 0.19);
    g.fill();
    oval(ix - rx * 0.16, iy - ry * 0.2, rx * 0.09, ry * 0.11);
    g.fill();
  });
}
