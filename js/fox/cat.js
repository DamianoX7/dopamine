// 뭉치 — the white cat of 우리 동네, that she can take home (js/cat.js). Not any cat in particular, but a real one: a young
// white cat, soft and compact, with a deep chest and a round rump, a short thick neck in a ruff of fur, slim straight legs
// on round paws and a long soft tail. A round head with its features low on it; large round eyes, olive-yellow; a short nose,
// small and pink; plump whisker pads and a small chin close under them. Big soft ears, pink inside.
//
// It is built on a fox's bones (rig.js: `own`) — so that it walks, sits, lies down, sleeps, stretches and leans into a
// hand as the foxes do. What it makes itself is its body, its head, its face and its tail.
//
// Its head is one skin over a few round shapes run smoothly together (PARTS), found along rays out from the middle of it
// — so that all that is on the face (eyes, nose, mouth, whiskers) is laid on it where it belongs. The skin is cut along
// the line of the mouth (SEAM): below it the lower jaw opens, to meow.
//
// Measures are the rig's (+Z forward, +Y up, +X its left); it is drawn at `size`.
import * as THREE from '../vendor/three.module.min.js';
import { V, clamp, lerp, TAU, rng, paintTexture } from './kit.js';

const DEG = Math.PI / 180;
const smooth = (a, b, x) => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const catmull = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

// ------------------------------------------------------------------ the head

// O, the middle of its skull — what all of the head is measured from — is set as the bones are (`own.joints`). The head
// and the face are made in measures of their own and drawn `K` of that size on the rig. From O: where the head turns on
// the neck (in the rig's measures), and where the lower jaw turns (in the head's).
const HEAD = { y: 0.42, z: 0.28 };
const K = 1.3;
const PIVOT = [0, -0.04, -0.04];
const HINGE = [0, -0.05, -0.02];

// The head is these, run smoothly together: [x, y, z, half the width, the height, the depth] (x ≠ 0: one each side). A
// round skull; the cheeks, widest a little under the eyes; the muzzle, and on it the two whisker pads; a small chin close
// under them; the brows over the eyes; the throat under it all, and the nape behind.
const PARTS = [
  [0, 0.006, -0.008, 0.064, 0.06, 0.066],
  [0, -0.022, 0.004, 0.075, 0.04, 0.054],
  [0, -0.04, 0.042, 0.033, 0.02, 0.03],
  [0.0148, -0.0475, 0.0605, 0.0158, 0.0118, 0.0138],
  [0, -0.0615, 0.046, 0.0135, 0.0085, 0.0125],
  [0.024, 0.012, 0.026, 0.022, 0.012, 0.016],
  [0, -0.042, -0.02, 0.05, 0.034, 0.046],
  [0, -0.02, -0.044, 0.054, 0.046, 0.04],
];
// the bridge of the nose, from between the eyes down to the nose: round, thinner as it goes — [x, y, z, radius] at its ends
const BRIDGE = [
  [0, 0.012, 0.05, 0.0145],
  [0, -0.03, 0.066, 0.0088],
];
const NOSE_PAD = [0, -0.0345, 0.0695, 0.0082, 0.0056, 0.006]; // (the nose stands a little proud of it all)
const BLEND = 0.012; //                                          how far two parts are run together

function ellipsoid(x, y, z, e) {
  const px = (x - e[0]) / e[3];
  const py = (y - e[1]) / e[4];
  const pz = (z - e[2]) / e[5];
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  const k1 = Math.sqrt((px / e[3]) ** 2 + (py / e[4]) ** 2 + (pz / e[5]) ** 2);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(e[3], e[4], e[5]);
}
function cone(x, y, z, [a, b]) {
  const ex = b[0] - a[0];
  const ey = b[1] - a[1];
  const ez = b[2] - a[2];
  const t = clamp(((x - a[0]) * ex + (y - a[1]) * ey + (z - a[2]) * ez) / (ex * ex + ey * ey + ez * ez), 0, 1);
  return Math.hypot(x - a[0] - ex * t, y - a[1] - ey * t, z - a[2] - ez * t) - lerp(a[3], b[3], t);
}
const smin = (a, b, k) => {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
};

/** How far (x, y, z) — from O — is outside the head (less than nothing: inside it). */
function field(x, y, z) {
  let d = 1;
  for (const e of PARTS) {
    d = smin(d, ellipsoid(x, y, z, e), BLEND);
    if (e[0]) d = smin(d, ellipsoid(-x, y, z, e), BLEND);
  }
  d = smin(d, cone(x, y, z, BRIDGE), BLEND);
  return smin(d, ellipsoid(x, y, z, NOSE_PAD), 0.003);
}

/** How far out from O the skin is, along (dx, dy, dz) (one long). */
function reach(dx, dy, dz) {
  let t = 0.26;
  let prev = t;
  let d = field(dx * t, dy * t, dz * t);
  for (let k = 0; d > 0 && k < 300; k++) {
    prev = t;
    t -= Math.max(d * 0.85, 0.0003);
    d = field(dx * t, dy * t, dz * t);
  }
  let lo = t;
  let hi = prev;
  for (let k = 0; k < 18; k++) {
    const m = (lo + hi) / 2;
    if (field(dx * m, dy * m, dz * m) < 0) lo = m;
    else hi = m;
  }
  return (lo + hi) / 2;
}

/** The point of the skin over (or under) `p`, seen from O. */
const onSkin = (p, out = V()) => {
  out.copy(p).normalize();
  return out.multiplyScalar(reach(out.x, out.y, out.z));
};

/** Which way the skin faces at `p`. */
function normalAt(p, out = V()) {
  const e = 0.0004;
  return out
    .set(field(p.x + e, p.y, p.z) - field(p.x - e, p.y, p.z), field(p.x, p.y + e, p.z) - field(p.x, p.y - e, p.z), field(p.x, p.y, p.z + e) - field(p.x, p.y, p.z - e))
    .normalize();
}

// Where the skin is cut for the mouth, round the head: how far below level it is (seen from O, in degrees) how far round
// from straight ahead — a plain curve from corner to corner under the whisker pads; past them, the way the jaw goes, back
// and under the head. Above it, the head; below it, the lower jaw.
const SEAM = [
  [0, -41],
  [7, -41],
  [11, -40.5],
  [14, -38.9],
  [16.5, -37],
  [19, -38],
  [30, -43],
  [50, -50],
  [70, -58],
  [100, -69],
  [140, -78],
  [180, -80],
];
// The line of the lips: up to the groove under the nose in the middle, along the bottom of each pad, its ends turned a
// little up. (Along the pads it lies on the cut; the mouth opens under it.)
const LIPS = [
  [0, -34.5],
  [3, -37.6],
  [7, -40.4],
  [11, -40.4],
  [14, -38.8],
  [16.5, -36.8],
];
const LIP = 16.5; //   the corners of the mouth, how far round from straight ahead
/** How far below level `table` is, `phi` round from straight ahead. */
function rowAt(table, phi) {
  const a = Math.abs(phi) / DEG;
  let i = 0;
  while (i < table.length - 2 && a > table[i + 1][0]) i++;
  const t = clamp((a - table[i][0]) / (table[i + 1][0] - table[i][0]), 0, 1);
  const row = (k) => table[clamp(k, 0, table.length - 1)][1];
  return catmull(row(i - 1), row(i), row(i + 1), row(i + 2), t) * DEG;
}
const seamAt = (phi) => rowAt(SEAM, phi);
const lipAt = (phi) => rowAt(LIPS, phi);

// Its eyes: the middle of each, as it is seen from in front; which way it looks (turned out, lifted); the opening, wide
// and nearly round — half as wide, half as high, its outer corner a little raised (`slant`); the ball behind it — how
// large, how far it stands out of the face, the iris on it.
const EYE = { x: 0.0305, y: -0.0055, turn: 0.26, lift: 0.06, a: 0.0172, b: 0.0144, slant: 0.06, R: 0.03, bulge: 0.0044, iris: 0.018 };

/** The rim of an eye's opening, `t` (0 … 1) round from its outer corner by way of the top: [out, up] from its middle. */
function almond(t) {
  const beta = t * TAU;
  const u = Math.cos(beta); // (1: the outer corner, -1: the inner)
  const w = Math.max(0, 1 - u * u);
  // (the upper lid a little flatter than the lower, and highest towards the nose)
  const v = Math.sin(beta) >= 0 ? EYE.b * Math.pow(w, 0.5) * (1 - 0.05 * u) : -EYE.b * Math.pow(w, 0.5) * (1 + 0.02 * u);
  const x = u * EYE.a;
  const c = Math.cos(EYE.slant);
  const s = Math.sin(EYE.slant);
  return [x * c - v * s, x * s + v * c];
}

// how far the rim is from the middle of the eye, each way round (a degree at a time)
const RIM = (() => {
  const n = 720;
  const pts = [];
  for (let k = 0; k < n; k++) pts.push(almond(k / n));
  const out = new Float32Array(360);
  for (let d = 0; d < 360; d++) {
    const dx = Math.cos((d + 0.5) * DEG);
    const dy = Math.sin((d + 0.5) * DEG);
    for (let k = 0; k < n; k++) {
      const [x0, y0] = pts[k];
      const [x1, y1] = pts[(k + 1) % n];
      const ex = x1 - x0;
      const ey = y1 - y0;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-14) continue;
      const t = (x0 * ey - y0 * ex) / den;
      const s = (x0 * dy - y0 * dx) / den;
      if (t > 0 && s >= 0 && s <= 1) out[d] = Math.max(out[d], t);
    }
  }
  return out;
})();

/** How far out (`out`, `up`) is from the middle of an eye, in rims: 1 is on its rim. */
function rimAt(out, up) {
  let a = Math.atan2(up, out) / DEG - 0.5;
  if (a < 0) a += 360;
  const i = Math.floor(a);
  const f = a - i;
  return Math.hypot(out, up) / (RIM[i % 360] * (1 - f) + RIM[(i + 1) % 360] * f);
}

/** A point round eye `e`'s opening, `t` (0 … 1) round it and `s` rims out: on the ball (`ball`), or else just over the
 *  skin of the face; `n`: which way it faces. */
function rimPoint(e, t, s, ball, out, n) {
  const [ox, oy] = almond(t);
  const lx = e.sg * ox * s;
  const ly = oy * s;
  if (ball) {
    const R = EYE.R + 0.0009;
    out.copy(e.E).addScaledVector(e.X, lx).addScaledVector(e.Y, ly).addScaledVector(e.n, Math.sqrt(Math.max(0, R * R - lx * lx - ly * ly)));
    n.copy(out).sub(e.E).normalize();
    return out;
  }
  onSkin(out.copy(e.S).addScaledVector(e.X, lx).addScaledVector(e.Y, ly), out);
  normalAt(out, n);
  return out.addScaledVector(n, 0.0003);
}

/** Each eye (its left, then its right): `S` the middle of its opening on the face, `n` which way it looks, `X` (to its
 *  left) and `Y` (up) across it, `E` the middle of the ball. All from O. */
let EYES = null;
function eyeData() {
  if (!EYES) {
    EYES = [1, -1].map((sg) => {
      const S = onSkin(V(sg * EYE.x, EYE.y, 0.062));
      const n = V(sg * Math.sin(EYE.turn) * Math.cos(EYE.lift), Math.sin(EYE.lift), Math.cos(EYE.turn) * Math.cos(EYE.lift));
      const Y = V(0, 1, 0).addScaledVector(n, -n.y).normalize();
      const X = V().crossVectors(Y, n);
      return { sg, S, n, X, Y, E: S.clone().addScaledVector(n, EYE.bulge - EYE.R) };
    });
  }
  return EYES;
}

// Its nose: a small rounded triangle on the pad at the end of the bridge — how wide, how far its top and its point are
// from its middle, how round its corners.
const NOSE = { y: -0.0352, w: 0.0094, top: 0.0052, bottom: -0.0066, round: 0.0028 };

/** How far (x, y) — across the nose and up it, from its middle — is outside it. */
function noseShape(x, y) {
  const smax = (a, b, k) => {
    const h = Math.max(k - Math.abs(a - b), 0) / k;
    return Math.max(a, b) + h * h * k * 0.25;
  };
  const top = y - NOSE.top + 0.0012 * (x / NOSE.w) ** 2; // (its top a little rounded)
  const rise = NOSE.top - NOSE.bottom;
  const len = Math.hypot(rise, NOSE.w);
  const left = ((y - NOSE.bottom) * -NOSE.w - x * rise) / len;
  const right = ((y - NOSE.bottom) * -NOSE.w + x * rise) / len;
  return smax(smax(top, left, NOSE.round), right, NOSE.round);
}

/** The nose: `C` its middle on the skin, `n` which way it faces, `X` across it, `Y` up it — and `at(p)`: how far out
 *  from its middle a point of the head is, in noses (1 is on its edge). */
let NOSE_AT = null;
function noseData() {
  if (!NOSE_AT) {
    const C = onSkin(V(0, NOSE.y, 0.09));
    const n = normalAt(C);
    const X = V(1, 0, 0).addScaledVector(n, -n.x).normalize();
    const Y = V().crossVectors(n, X);
    const edge = new Float32Array(360);
    for (let d = 0; d < 360; d++) {
      const dx = Math.cos(d * DEG);
      const dy = Math.sin(d * DEG);
      let lo = 0;
      let hi = 0.02;
      for (let k = 0; k < 24; k++) {
        const m = (lo + hi) / 2;
        if (noseShape(dx * m, dy * m) < 0) lo = m;
        else hi = m;
      }
      edge[d] = lo;
    }
    const q = V();
    NOSE_AT = {
      C,
      n,
      X,
      Y,
      edge: (a) => {
        let d = a / DEG;
        if (d < 0) d += 360;
        const i = Math.floor(d);
        const f = d - i;
        return edge[i % 360] * (1 - f) + edge[(i + 1) % 360] * f;
      },
      at(p) {
        q.copy(p).sub(C);
        const x = q.dot(X);
        const y = q.dot(Y);
        return Math.hypot(x, y) / this.edge(Math.atan2(y, x)) + Math.max(0, -q.dot(n) - 0.004) * 400; // (not through the head)
      },
    };
  }
  return NOSE_AT;
}

// An ear, from its root on the skull: how far it leans out and back; how far out from straight ahead its hollow opens;
// how high it is, how wide at the root to its inner edge and to its outer; how deep its hollow is.
const EAR = { x: 0.063, y: 0.053, z: -0.012, out: 0.42, back: 0.1, open: 0.42, high: 0.076, inner: 0.03, outer: 0.037, deep: 0.018 };

const INK = {
  // its eyes: olive-yellow, a little greener round the pupil, darker at the edge
  iris: [
    [0, '#7c7a4e'],
    [0.3, '#8f8858'],
    [0.62, '#998d5e'],
    [0.9, '#766c46'],
    [1, '#575038'],
  ],
  limbus: '#4f4733',
  white: '#d8cfc5',
  pupil: [0.02, 0.016, 0.018],
  rim: '#3c3035', //     the rims of its eyes
  lidPink: '#d9c6cb',
  fold: '#e4dcdf', //    the skin at the edge of the opening, where the lids go in
  corner: '#c7aab0', //  the inner corners of its eyes
  nose: '#dba6ae',
  noseEdge: '#c3949c',
  noseLight: '#eac3c8',
  nostril: '#b46f7c',
  lip: '#b8959e', //     the line of its mouth
  lipSkin: '#e9dbdf',
  bridge: '#ecdfe4',
  mouth: '#6e3341', //   inside it
  tongue: '#da8191',
  tooth: '#f7f3ec',
};

export const MUNGCHI = {
  size: 0.76,
  leg: 0.62,
  legR: 1,
  girth: 1,
  bodyLen: 0.64,
  neck: 0.55,
  head: 1,
  skull: 1,
  crown: 1,
  boxy: 0,
  jowl: 0,
  ruff: 0,
  muzzle: 0.5,
  snout: 1,
  eye: 1,
  lids: 0,
  earH: EAR.high,
  earW: EAR.inner + EAR.outer,
  earRound: 0,
  earSpread: EAR.out,
  earSet: 1,
  tailLen: 0.74,
  tailR: 0.4,
  tails: 1,
  tailFan: 1.05,
  tailLift: 0,
  fur: 0.46,
  tipAmt: 0,
  // (whiter and cooler than white is: the light indoors and on the street is warm)
  colors: {
    coat: '#f3f4f8',
    back: '#eceef3',
    belly: '#fbfbfd',
    sock: '#f4f5f9',
    earBack: '#f1f2f6',
    earIn: '#f2c6cf',
    earTip: '#f1f2f6',
    tailTip: '#f3f4f8',
    nose: INK.nose,
    eye: '#141012',
    tongue: INK.tongue,
    tip: '#ffffff',
  },
  extra: { earDeep: '#e6a9b7' },
  // Its chin is a little up in all of them: it looks up at us, as we look down at it. It sits upright with its tail round
  // its side, lies as a loaf with its paws tucked under, and sleeps so with its chin on its paws (the rest are every fox's: animator.js).
  poses: {
    // (standing, its tail up, the end of it bent over)
    stand: { nrx: -0.3, hdx: -0.12, tl: 0.6, tc: 0.1, ts: 0.05 },
    sit: { hy: -0.168, hz: -0.022, hrx: -0.74, srx: 0.14, crx: 0.12, nrx: 0.32, hdx: -0.24, hdz: 0.06, tl: 0.72, tc: 0, ts: 0.62, ffx: 0.05, ffz: 0.05, hfx: 0.09, hfz: 0.2 },
    // (sitting so, its head up into her hand and turned in it, its ears a little back)
    pet: { hy: -0.168, hz: -0.022, hrx: -0.74, srx: 0.14, crx: 0.12, nrx: 0.14, hdx: -0.12, hdz: 0.3, tl: 0.72, tc: 0, ts: 0.62, earB: 0.35, earD: 0.15, ffx: 0.05, ffz: 0.05, hfx: 0.09, hfz: 0.2 },
    lie: { hy: -0.16, hrx: -0.03, crx: -0.05, nrx: -0.12, hdx: -0.24, hdz: 0.05, tl: 0.3, tc: 0.02, ts: 0.5, ffx: 0.052, ffz: 0.1, hfx: 0.095, hfz: 0.1 },
    // (a loaf, its chin down on its paws and its head a little on one side, its tail round it)
    sleep: { hy: -0.168, hrx: -0.02, sry: 0.12, cry: 0.14, crx: 0.08, nrx: 1, nry: 0.05, hdx: -1.3, hdy: 0.05, hdz: 0.24, tl: 0.3, tc: 0, ts: 0.74, earB: 0.1, earD: 0.08, ffx: 0.05, ffz: 0.1, hfx: 0.095, hfz: 0.1 },
    eat: { hy: -0.02, hrx: 0.16, nrx: 0.36, hdx: 0.1, tl: 0.5, tc: 0.1, earB: 0.1 },
  },

  own: {
    /** The head forward of the chest on a short neck; the ears on top of it, set wide; the legs under the body. */
    joints({ J, LJ, tailDefs, yB, zH, zC }) {
      HEAD.y = yB + 0.13;
      HEAD.z = zC + 0.144;
      J.neck.set(0, yB + 0.055, zC + 0.075);
      J.head.set(0, HEAD.y + PIVOT[1], HEAD.z + PIVOT[2]);
      J.jaw.set(0, HEAD.y + HINGE[1] * K, HEAD.z + HINGE[2] * K);
      J.earL.set(EAR.x, HEAD.y + EAR.y, HEAD.z + EAR.z);
      J.earR.set(-EAR.x, HEAD.y + EAR.y, HEAD.z + EAR.z);
      for (const side of ['L', 'R']) for (const key in LJ[side]) LJ[side][key].x *= 0.9;
      tailDefs[0].base.set(0, yB + 0.03, zH - 0.116);
    },

    /** A cat's trunk: a round rump, a deep chest, the belly drawn up before the hind legs; then the neck, in a ruff of fur. */
    torso(kit) {
      const { coat, col, C, yB, zH, zS, zC } = kit;
      const color = (i) => col.copy(C.coat).lerp(C.back, smooth(0.5, 1, i.s) * 0.6).lerp(C.belly, smooth(-0.15, -0.7, i.s));
      coat.loft(
        [
          { c: V(0, yB + 0.016, zH - 0.128), rx: 0.02, ry: 0.02, w: { hips: 1 }, fur: 0.8 },
          { c: V(0, yB + 0.016, zH - 0.114), rx: 0.068, ry: 0.064, ryB: 0.068, w: { hips: 1 }, fur: 0.9 },
          { c: V(0, yB + 0.014, zH - 0.066), rx: 0.1, ry: 0.094, ryB: 0.104, w: { hips: 1 }, fur: 1 },
          { c: V(0, yB + 0.01, zH + 0.005), rx: 0.108, ry: 0.104, ryB: 0.116, w: { hips: 0.75, spine: 0.25 }, fur: 1 },
          { c: V(0, yB + 0.004, zS - 0.024), rx: 0.106, ry: 0.104, ryB: 0.122, w: { hips: 0.25, spine: 0.75 }, fur: 1 },
          { c: V(0, yB + 0.002, zS + 0.05), rx: 0.105, ry: 0.104, ryB: 0.128, w: { spine: 0.6, chest: 0.4 }, fur: 1 },
          { c: V(0, yB + 0.008, zC), rx: 0.1, ry: 0.104, ryB: 0.132, w: { chest: 1 }, fur: 1.05 },
          { c: V(0, yB + 0.02, zC + 0.056), rx: 0.09, ry: 0.098, ryB: 0.118, w: { chest: 1 }, fur: 1.15 },
          { c: V(0, yB + 0.044, zC + 0.09), rx: 0.076, ry: 0.076, ryB: 0.092, w: { chest: 0.7, neck: 0.3 }, fur: 1.1 },
          { c: V(0, yB + 0.08, zC + 0.11), rx: 0.062, ry: 0.058, w: { chest: 0.2, neck: 0.8 }, fur: 1 },
          { c: V(0, yB + 0.092, zC + 0.108), rx: 0.05, ry: 0.04, w: { neck: 0.6, head: 0.4 }, fur: 0.85 },
        ],
        { segs: 20, sub: 3, comb: -1, droop: 0.3, part: 'torso', color }
      );
    },

    /** Slim straight legs that come out of the body, the hind ones broad at the thigh; small round paws with their toes. */
    legs(kit) {
      const { coat, col, C, LJ, J, zH, zC } = kit;
      const legColor = (i) => col.copy(C.coat).lerp(C.sock, smooth(0.36, 0.6, i.v));
      const pawColor = () => col.copy(C.sock);
      const sY = J.chest.y - 0.04; // (the shoulder)
      const hY = J.hips.y - 0.025; //  (the hip)
      const mid = (a, b, t = 0.5) => a + (b - a) * t;
      const toes = (x, z, bone) => {
        for (const k of [-1, 0, 1]) coat.blob(V(x + k * 0.0158, 0.0122 - 0.0015 * Math.abs(k), z - 0.004 * Math.abs(k)), 0.0108, 0.0106, 0.0122, { w: { [bone]: 1 }, furLen: 0.5, color: pawColor, segs: 8 });
      };
      for (const side of ['L', 'R']) {
        const j = LJ[side];
        const U = `fU${side}`;
        const Lo = `fL${side}`;
        const Pw = `fP${side}`;
        const x = j.fU.x;
        const eY = j.fL.y;
        coat.loft(
          [
            { c: V(x * 0.78, sY + 0.06, zC + 0.02), rx: 0.038, ry: 0.043, w: { chest: 0.85, [U]: 0.15 }, fur: 0.9 },
            { c: V(x * 0.92, sY + 0.012, zC + 0.026), rx: 0.04, ry: 0.049, w: { chest: 0.4, [U]: 0.6 }, fur: 0.85 },
            { c: V(x, mid(sY, eY), zC + 0.016), rx: 0.036, ry: 0.043, w: { [U]: 1 }, fur: 0.8 },
            { c: V(x, eY, zC + 0.006), rx: 0.031, ry: 0.034, ryB: 0.036, w: { [U]: 0.5, [Lo]: 0.5 }, fur: 0.75 },
            { c: V(x, mid(eY, j.fP.y), zC + 0.018), rx: 0.0275, ry: 0.029, w: { [Lo]: 1 }, fur: 0.7 },
            { c: V(x, 0.052, zC + 0.028), rx: 0.0255, ry: 0.027, w: { [Lo]: 0.5, [Pw]: 0.5 }, fur: 0.66 },
            { c: V(x, 0.026, zC + 0.036), rx: 0.03, ry: 0.033, ryB: 0.027, w: { [Pw]: 1 }, fur: 0.62 },
            { c: V(x, 0.006, zC + 0.04), rx: 0.026, ry: 0.029, ryB: 0.023, w: { [Pw]: 1 }, fur: 0.6 },
          ],
          { segs: 12, sub: 2, comb: 1, color: legColor, part: 'legF' }
        );
        coat.blob(V(x, 0.018, zC + 0.058), 0.032, 0.019, 0.037, { w: { [Pw]: 1 }, furLen: 0.6, color: pawColor });
        toes(x, zC + 0.089, Pw);

        const T = `hT${side}`;
        const Sh = `hS${side}`;
        const F = `hF${side}`;
        const Hp = `hP${side}`;
        const hx = j.hT.x;
        const kY = j.hS.y;
        const oY = j.hF.y;
        coat.loft(
          [
            { c: V(hx * 0.72, hY + 0.06, zH - 0.008), rx: 0.046, ry: 0.066, w: { hips: 0.85, [T]: 0.15 }, fur: 0.95 },
            { c: V(hx * 0.9, hY + 0.002, zH + 0.004), rx: 0.054, ry: 0.078, ryB: 0.072, w: { hips: 0.35, [T]: 0.65 }, fur: 0.95 },
            { c: V(hx, mid(hY, kY, 0.55), zH + 0.03), rx: 0.046, ry: 0.06, w: { [T]: 1 }, fur: 0.9 },
            { c: V(hx, kY, zH + 0.05), rx: 0.034, ry: 0.038, ryB: 0.042, w: { [T]: 0.5, [Sh]: 0.5 }, fur: 0.8 },
            { c: V(hx, mid(kY, oY), zH + 0.004), rx: 0.029, ry: 0.031, ryB: 0.033, w: { [Sh]: 1 }, fur: 0.75 },
            { c: V(hx, oY, zH - 0.044), rx: 0.025, ry: 0.027, ryB: 0.029, w: { [Sh]: 0.5, [F]: 0.5 }, fur: 0.7 },
            { c: V(hx, mid(oY, j.hP.y, 0.55), zH - 0.034), rx: 0.024, ry: 0.025, w: { [F]: 1 }, fur: 0.66 },
            { c: V(hx, 0.04, zH - 0.026), rx: 0.0255, ry: 0.0275, ryB: 0.026, w: { [F]: 0.5, [Hp]: 0.5 }, fur: 0.64 },
            { c: V(hx, 0.02, zH - 0.02), rx: 0.03, ry: 0.033, ryB: 0.027, w: { [Hp]: 1 }, fur: 0.62 },
            { c: V(hx, 0.004, zH - 0.018), rx: 0.026, ry: 0.029, ryB: 0.023, w: { [Hp]: 1 }, fur: 0.6 },
          ],
          { segs: 12, sub: 2, comb: 1, color: legColor }
        );
        coat.blob(V(hx, 0.018, zH - 0.002), 0.032, 0.019, 0.037, { w: { [Hp]: 1 }, furLen: 0.6, color: pawColor });
        toes(hx, zH + 0.029, Hp);
      }
    },

    /** A long soft tail, round all the way, a little thicker towards its end, the end rounded off. */
    tail(kit) {
      const { coat, col, C, tails, tailLen } = kit;
      tails.forEach((tail, t) => {
        const n = tail.bones.length;
        const name = (i) => `tail${t}_${Math.min(n - 1, Math.max(0, i))}`;
        const keys = [
          [-0.06, 0.034],
          [0.02, 0.035],
          [0.14, 0.036],
          [0.32, 0.038],
          [0.52, 0.04],
          [0.72, 0.04],
          [0.87, 0.036],
          [0.95, 0.028],
          [0.99, 0.014],
          [1, 0.003],
        ].map(([v, r]) => {
          const u = Math.max(0, v) * n - 0.5;
          const i0 = Math.floor(u);
          const f = u - i0;
          const w = {};
          w[name(i0)] = (w[name(i0)] || 0) + (1 - f);
          w[name(i0 + 1)] = (w[name(i0 + 1)] || 0) + f;
          if (v < 0.04) w.hips = 0.6;
          return { c: tail.def.base.clone().addScaledVector(tail.dir, v * tailLen), rx: r, ry: r, w, fur: 1.15 * Math.min(1, r / 0.03) };
        });
        coat.loft(keys, { segs: 12, sub: 2, comb: 1, color: () => col.copy(C.coat) });
      });
    },

    /**
     * The head: one skin all the way round, closer together over the face, cut along the line of the
     * mouth — the rows above it are the head's, those below the lower jaw's, and the two rows along the cut are one
     * until it opens (`welds`). Inside the rim of each eye the skin sinks in, under the ball. Then the ears.
     */
    head(kit) {
      const { coat, col, C, J } = kit;
      const O = V(0, HEAD.y, HEAD.z);
      const eyes = eyeData();
      const nose = noseData();
      const P = V();
      const A = V();
      const dir = V();
      const comb = V();
      const FROM = V(0, -0.03, 0.11); // (its fur lies back from in front of its nose)
      const bridge = new THREE.Color(INK.bridge);
      const lipSkin = new THREE.Color(INK.lipSkin);
      const corner = new THREE.Color(INK.corner);
      const SEGS = 96;
      const UP = 46;
      const LO = 16;
      const round = [];
      for (let j = 0; j < SEGS; j++) {
        const u = j / SEGS;
        const a = TAU * u - 0.5 * Math.sin(TAU * u); // (closer together in front)
        round.push(a > Math.PI ? a - TAU : a);
      }
      /** A point of the skin: `phi` round from straight ahead (towards its left), `theta` up from level; `low`: below the
       *  cut, on the lower jaw. */
      const put = (phi, theta, low) => {
        const ct = Math.cos(theta);
        dir.set(ct * Math.sin(phi), Math.sin(theta), ct * Math.cos(phi));
        let t = reach(dir.x, dir.y, dir.z);
        let eye = 9;
        for (const e of eyes) {
          P.copy(dir).multiplyScalar(t).sub(e.S);
          const s = rimAt(e.sg * P.dot(e.X), P.dot(e.Y));
          eye = Math.min(eye, s);
          if (s < 1.2) {
            const b = dir.dot(e.E);
            const disc = b * b - e.E.lengthSq() + EYE.R * EYE.R;
            if (disc > 0) t = lerp(t, Math.min(t, b + Math.sqrt(disc) - 0.0016), smooth(1.16, 1.06, s));
          }
        }
        P.copy(dir).multiplyScalar(t);
        const { x, y, z } = P;
        // its fur: short on the face, none on the nose or round the eyes; fuller on the cheeks, the crown, under the chin
        const front = smooth(0, 0.05, z);
        const cheek = smooth(0.045, 0.072, Math.abs(x)) * smooth(0.015, -0.03, y);
        const muzzle = smooth(0.035, 0.065, z) * smooth(0, -0.025, y);
        const under = smooth(-0.04, -0.07, y) * smooth(0.03, -0.01, z);
        const seam = Math.min(Math.abs(theta - seamAt(phi)), Math.abs(theta - lipAt(phi))) / DEG;
        const lips = Math.abs(phi) < (LIP + 8) * DEG ? smooth(1.2, 3.6, seam) : 1; // (bare along the lips)
        const fur = (lerp(0.72, 0.58, front) + 0.3 * cheek - 0.12 * muzzle + 0.34 * under) * smooth(1.1, 2.2, eye) * smooth(1.05, 1.8, nose.at(P)) * lips;
        // white — a little pink showing through on the bridge of the nose, on its lips, in the corners of its eyes
        col.copy(C.coat);
        col.lerp(bridge, 0.7 * smooth(0.008, 0.002, Math.abs(x)) * smooth(0.002, -0.016, y) * smooth(-0.034, -0.027, y) * front);
        const lip = smooth(4, 0, seam) * smooth(LIP + 3, LIP - 5, Math.abs(phi) / DEG);
        col.lerp(lipSkin, 0.5 * lip);
        if (low) col.lerp(corner, 0.75 * smooth(5, 1, (seamAt(phi) - theta) / DEG) * smooth(LIP + 3, LIP - 5, Math.abs(phi) / DEG)); // (inside the lower lip)
        col.lerp(corner, smooth(1.12, 1, eye));
        comb.copy(P).sub(FROM).normalize();
        // below the cut, in front: the lower jaw, all of a piece (towards the throat and the back of the head, the head
        // again). Its lip comes down furthest in the middle, and not at all at the corners of the mouth, so that the mouth
        // opens round; further back the skin only stretches.
        const before = smooth((LIP + 3) * DEG, 4 * DEG, Math.abs(phi));
        const jaw = low ? smooth(-95 * DEG, -72 * DEG, theta) * smooth(80 * DEG, 50 * DEG, Math.abs(phi)) * (before + (1 - before) * smooth(0, 10 * DEG, seamAt(phi) - theta)) : 0;
        A.copy(P).multiplyScalar(K).add(O);
        const i = coat.vert(A, col, { head: 1 - jaw, jaw }, Math.max(0, fur), comb, O);
        // (round the eyes, shaded as the face it is, not as it sinks into the socket: no crease round the rims)
        if (eye < 1.6) coat.normals.set(i, normalAt(P, V()));
        return i;
      };
      const upper = coat.count;
      for (let i = 0; i < UP; i++) {
        const s = i / (UP - 1);
        const f = s * (0.62 + 0.38 * s); // (the rows closer together over the face)
        for (const phi of round) {
          const from = seamAt(phi);
          put(phi, from + (88 * DEG - from) * f, false);
        }
      }
      const lower = coat.count;
      for (let i = 0; i < LO; i++) {
        const s = i / (LO - 1);
        for (const phi of round) put(phi, -88 * DEG + (seamAt(phi) + 88 * DEG) * s, true);
      }
      const grid = (base, rows) => {
        for (let r = 0; r < rows - 1; r++) {
          for (let j = 0; j < SEGS; j++) {
            const a = base + r * SEGS + j;
            const b = base + r * SEGS + ((j + 1) % SEGS);
            coat.idx.push(a, b, a + SEGS, b, b + SEGS, a + SEGS);
          }
        }
      };
      grid(upper, UP);
      grid(lower, LO);
      col.copy(C.coat);
      const crown = coat.vert(V(0, reach(0, 1, 0) * K, 0).add(O), col, { head: 1 }, 0.55, V(0, 0.2, -1).normalize(), O);
      const bottom = coat.vert(V(0, -reach(0, -1, 0) * K, 0).add(O), col, { head: 0.85, jaw: 0.15 }, 0.8, V(0, -0.3, -1).normalize(), O);
      const top = upper + (UP - 1) * SEGS;
      for (let j = 0; j < SEGS; j++) {
        const k = (j + 1) % SEGS;
        coat.idx.push(crown, top + j, top + k, bottom, lower + k, lower + j);
        coat.welds.push([upper + j, lower + (LO - 1) * SEGS + j]);
      }

      // ---- round each eye: the skin from the ball up over the rim and out onto the face — a part of the coat, so that its
      // short fur comes right up to the eye; shaded as the skin it lies on, not as it is folded. (What is dark at the rim of
      // an open eye is drawn over it — `face`; shut, nothing is left round the lids.)
      for (const e of eyes) {
        const N = 72;
        const SC = [1, 1, 1.015, 1.04, 1.1, 1.18, 1.28];
        const FUR = [0, 0, 0, 0.03, 0.08, 0.15, 0.22];
        const first = coat.count;
        SC.forEach((s, r) => {
          col.copy(C.coat);
          for (let k = 0; k < N; k++) {
            rimPoint(e, k / N, s, r === 0, P, dir);
            comb.copy(P).sub(FROM).normalize();
            coat.normals.set(coat.vert(A.copy(P).multiplyScalar(K).add(O), col, { head: 1 }, FUR[r], comb, O), dir.clone());
          }
        });
        for (let r = 0; r < SC.length - 1; r++) {
          for (let k = 0; k < N; k++) {
            const a = first + r * N + k;
            const b = first + r * N + ((k + 1) % N);
            if (e.sg > 0) coat.idx.push(a, a + N, b, b, a + N, b + N);
            else coat.idx.push(a, b, a + N, b, b + N, a + N);
          }
        }
      }

      // ---- the ears: a cupped shell, thin at its edges, its tip rounded off, its hollow opening forward and out; pink and
      // bare inside, deeper in the middle, white hair along the inner edge of the hollow and round the rim; furred behind
      for (const side of ['L', 'R']) {
        const sg = side === 'L' ? 1 : -1;
        const bone = `ear${side}`;
        const root = J[bone].clone();
        const up = V(sg * Math.sin(EAR.out), Math.cos(EAR.out), -Math.sin(EAR.back)).normalize();
        const fwd = V(sg * Math.sin(EAR.open), 0, Math.cos(EAR.open));
        fwd.addScaledVector(up, -fwd.dot(up)).normalize();
        const across = V().crossVectors(up, fwd).multiplyScalar(sg).normalize(); // (out, away from the middle of the head)
        const mid = root.clone().addScaledVector(up, EAR.high * 0.4);
        const ROWS = 20;
        const U = 12;
        const RING = 2 * U;
        const first = coat.count;
        for (let r = 0; r < ROWS; r++) {
          const h = (r / (ROWS - 1)) * 0.985; // (the tip is a point of its own)
          const lift = -0.012 + h * (EAR.high + 0.012);
          const wI = EAR.inner * Math.pow(Math.cos((h * Math.PI) / 2), 0.72) * (1 + 0.12 * Math.sin(Math.PI * h));
          const wO = EAR.outer * Math.pow(Math.cos((h * Math.PI) / 2), 0.68) * (1 + 0.22 * Math.sin(Math.PI * h));
          const deep = EAR.deep * Math.pow(1 - h, 0.9);
          const thick = 0.006 * (1 - h) + 0.0018;
          const weights = h < 0.14 ? { head: 0.6, [bone]: 0.4 } : h < 0.28 ? { head: 0.25, [bone]: 0.75 } : { [bone]: 1 };
          for (let c = 0; c < RING; c++) {
            // round the ring: its hollow from the inner edge to the outer (c ≤ U), then its back, the other way
            const back = c > U;
            const u = back ? (RING - c) / U : c / U;
            const edge = c === 0 || c === U;
            const bow = Math.pow(Math.sin(Math.PI * u), 0.8);
            let d = deep * bow;
            if (back) d += thick * (0.35 + 0.65 * Math.pow(Math.sin(Math.PI * u), 0.5));
            else if (edge) d += thick * 0.4;
            const x = lerp(-wI, wO, u) + (edge ? (c ? 1 : -1) * thick * 0.25 : 0);
            P.copy(root).addScaledVector(up, lift).addScaledVector(across, x).addScaledVector(fwd, -d);
            let fur;
            if (back) {
              col.copy(C.earBack);
              fur = 0.8 * (1 - 0.4 * h);
            } else {
              const rim = Math.max(smooth(0.16, 0.02, u), smooth(0.86, 0.98, u), smooth(0.86, 0.975, h));
              const tuft = smooth(0.4, 0.12, u) * smooth(0.6, 0.18, h);
              col.copy(C.earIn).lerp(C.earDeep, smooth(0.62, 0.05, h) * bow * 0.8);
              col.lerp(C.coat, Math.max(rim, tuft * 0.55));
              fur = edge ? 0.5 : Math.max(0.6 * tuft, 0.4 * rim);
            }
            coat.vert(P, col, weights, fur, up, mid);
          }
        }
        col.copy(C.earTip);
        const tip = coat.vert(root.clone().addScaledVector(up, EAR.high + 0.002).addScaledVector(fwd, -0.001), col, { [bone]: 1 }, 0.4, up, mid);
        const tris = [];
        for (let r = 0; r < ROWS - 1; r++) {
          for (let c = 0; c < RING; c++) {
            const a = first + r * RING + c;
            const b = first + r * RING + ((c + 1) % RING);
            tris.push(a, b, a + RING, b, b + RING, a + RING);
          }
        }
        const last = first + (ROWS - 1) * RING;
        for (let c = 0; c < RING; c++) tris.push(last + c, last + ((c + 1) % RING), tip);
        // (the hollow faces forward: turn them all if the first of its faces does not)
        const p = (i) => V(coat.pos[i * 3], coat.pos[i * 3 + 1], coat.pos[i * 3 + 2]);
        const a0 = first + 4 * RING + U / 2;
        const face = V().crossVectors(p(a0 + 1).sub(p(a0)), p(a0 + RING).sub(p(a0)));
        if (face.dot(fwd) < 0) for (let i = 0; i < tris.length; i += 3) [tris[i + 1], tris[i + 2]] = [tris[i + 2], tris[i + 1]];
        coat.idx.push(...tris);
      }

      return {
        dims: {
          noseTip: nose.C.clone().addScaledVector(nose.n, 0.002).multiplyScalar(K).add(O).sub(J.head),
          crown: V(0, reach(0, 1, 0), -0.004).multiplyScalar(K).add(O).sub(J.head),
          eyeLine: HEAD.y + EYE.y * K - J.head.y,
          neckR: 0.05,
          nod: 0.9,
        },
      };
    },

    /**
     * Its face, laid on the skin of the head. Each eye is a glossy ball in the opening (the iris painted on it, the pupil
     * a tall oval that opens in the dark: `pupil`), with dark rims round it and lids that close over it — a blink; both
     * lids meeting in a calm line when it is content, the upper down over it asleep (`set`). The nose a small raised
     * rounded triangle, pale pink, with its nostrils; the groove down from it, and the line of the mouth — inside it the mouth, two small teeth
     * and the tongue. White whiskers out of the pads, over the eyes and on the cheeks.
     */
    face(kit) {
      const { bones, J, C } = kit;
      const made = [];
      const keep = (x) => (made.push(x), x);
      const O = V(0, HEAD.y, HEAD.z);
      // (all that is on the face is made from O, in the head's measures)
      const measured = (bone, at) => {
        const g = new THREE.Group();
        g.position.copy(O).sub(at);
        g.scale.setScalar(K);
        bone.add(g);
        return g;
      };
      const head = measured(bones.head, J.head);
      const jaw = measured(bones.jaw, J.jaw);
      const onHead = (o) => (head.add(o), o);
      const onJaw = (o) => (jaw.add(o), o);
      const n = V();
      /** On top of what it lies on, whatever the distance. */
      const laid = (mat) => Object.assign(mat, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });

      /** Geometry from points and triangles — its faces all turned the way `out(middle of a face)` says. */
      const geometry = (pos, idx, { colors, uv, out, normals } = {}) => {
        if (out) {
          let sum = 0;
          const a = V();
          const b = V();
          const c = V();
          for (let i = 0; i < idx.length; i += 3) {
            a.fromArray(pos, idx[i] * 3);
            b.fromArray(pos, idx[i + 1] * 3).sub(a);
            c.fromArray(pos, idx[i + 2] * 3).sub(a);
            const f = V().crossVectors(b, c);
            sum += f.dot(out(a.clone().add(b.multiplyScalar(1 / 3)).add(c.multiplyScalar(1 / 3))));
          }
          if (sum < 0) for (let i = 0; i < idx.length; i += 3) [idx[i + 1], idx[i + 2]] = [idx[i + 2], idx[i + 1]];
        }
        const g = keep(new THREE.BufferGeometry());
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        if (colors) g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
        g.setIndex(idx);
        if (normals) g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        else g.computeVertexNormals();
        return g;
      };
      const skinOut = (p) => normalAt(p, V());

      /** A fine line along `line` (points on the skin) — `width(t)` to either side, `lift(t)` off the skin. */
      const ribbon = (line, width, lift) => {
        const pos = [];
        const idx = [];
        const tan = V();
        const side = V();
        const q = V();
        line.forEach((p, i) => {
          tan.copy(line[Math.min(line.length - 1, i + 1)]).sub(line[Math.max(0, i - 1)]).normalize();
          normalAt(p, n);
          side.crossVectors(n, tan).normalize();
          const t = i / (line.length - 1);
          const w = width(t);
          const up = lift(t);
          for (const k of [-1, 0, 1]) {
            q.copy(p).addScaledVector(side, w * k).addScaledVector(n, up * (k ? 0.75 : 1));
            pos.push(q.x, q.y, q.z);
          }
          if (i) {
            for (let k = 0; k < 2; k++) {
              const a = (i - 1) * 3 + k;
              const b = i * 3 + k;
              idx.push(a, b, a + 1, a + 1, b, b + 1);
            }
          }
        });
        return geometry(pos, idx, { out: skinOut });
      };

      // ---- the eyes
      const eyeMat = keep(new THREE.MeshPhysicalMaterial({ map: keep(irisTexture()), roughness: 0.45, clearcoat: 1, clearcoatRoughness: 0.05 }));
      const pupil = { value: new THREE.Vector2(0.1, 0.165) };
      eyeMat.onBeforeCompile = (shader) => {
        shader.uniforms.uPupil = pupil;
        shader.fragmentShader =
          'uniform vec2 uPupil;\n' +
          shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#include <map_fragment>
            {
              float pupil = 1.0 - smoothstep(0.82, 1.0, length((vMapUv - 0.5) / uPupil));
              diffuseColor.rgb = mix(diffuseColor.rgb, vec3(${INK.pupil.join(', ')}), pupil);
            }`
          );
      };
      const ballGeo = keep(new THREE.SphereGeometry(EYE.R, 48, 32));
      {
        // (the iris laid on the front of the ball as if from in front)
        const p = ballGeo.attributes.position;
        const uv = ballGeo.attributes.uv;
        for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5 + p.getX(i) / (2 * EYE.R), 0.5 + p.getY(i) / (2 * EYE.R));
      }
      const lidMat = keep(new THREE.MeshLambertMaterial({ vertexColors: true }));
      const glintGeo = keep(new THREE.CircleGeometry(0.0027, 20));
      glintGeo.scale(1, 0.75, 1);
      const glintMat = keep(new THREE.MeshBasicMaterial({ map: keep(glintTexture()), transparent: true, depthWrite: false, opacity: 0.92 }));
      const RL = EYE.R + 0.0003; // (the lids, just over the ball)
      const FULL = Math.asin(almond(0.25)[1] / RL) + Math.asin(-almond(0.75)[1] / RL); // how far they turn to shut
      const tint = new THREE.Color();

      /** A lid: its rim along the top of the opening (or the bottom), and the lid itself the rim turned on round the ball.
       *  Shaded as the skin it shuts into, not as the ball it lies on: shut, it is a part of the face. */
      const lidGeometry = (e, upper) => {
        const N = 30;
        // (how far round the ball each row is from the lid's edge: close together there — a thin dark line, a little pink)
        const TURN = [0, 0.03, 0.07, 0.14, 0.26, 0.44, 0.68, 0.96, 1.26, 1.6];
        const ROWS = TURN.length;
        const R = upper ? RL + 0.00012 : RL; // (the upper over the lower, where they meet)
        const pos = [];
        const colors = [];
        const normals = [];
        const idx = [];
        const shut = (upper ? 0.62 : -0.5) * FULL;
        const cs = Math.cos(shut);
        const sn = Math.sin(shut);
        const q = V();
        for (let r = 0; r < ROWS; r++) {
          const g = (upper ? -1 : 1) * TURN[r];
          // (white as the fur round it is in the light: its tips are a little brighter than the skin — rig.js `furAo`)
          if (r === 0) tint.set(INK.rim);
          else if (r === 1) tint.set(INK.lidPink);
          else tint.copy(C.coat).multiplyScalar(1.02);
          for (let k = 0; k <= N; k++) {
            const [ox, oy] = almond(upper ? (0.5 * k) / N : 0.5 + (0.5 * k) / N);
            const lx = e.sg * ox * 1.08; // (its ends tuck in under the corners)
            const lz = Math.sqrt(Math.max(0, R * R - lx * lx - oy * oy));
            const y = oy * Math.cos(g) - lz * Math.sin(g);
            const z = oy * Math.sin(g) + lz * Math.cos(g);
            pos.push(lx, y, z);
            colors.push(tint.r, tint.g, tint.b);
            // (the skin's normal where this point is when the lid is shut, turned back as the lid is turned)
            q.copy(e.E).addScaledVector(e.X, lx).addScaledVector(e.Y, y * cs - z * sn).addScaledVector(e.n, y * sn + z * cs);
            normalAt(q, n);
            const ny = n.dot(e.Y);
            const nz = n.dot(e.n);
            normals.push(n.dot(e.X), ny * cs + nz * sn, nz * cs - ny * sn);
          }
        }
        for (let r = 0; r < ROWS - 1; r++) {
          for (let k = 0; k < N; k++) {
            const a = r * (N + 1) + k;
            idx.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1);
          }
        }
        return geometry(pos, idx, { colors, normals, out: (c) => c });
      };

      /** The dark rim of an eye along the top of its opening (or the bottom): from the ball up over the edge and a hair's
       *  breadth out onto the face, over the skin there. Only while that lid is up: a lid down over the eye has a dark
       *  edge of its own, and above it is fur — and shut, nothing dark is left round the lids, not even at the inner
       *  corner, where the face stands higher than they do. */
      const linerMat = laid(keep(new THREE.MeshLambertMaterial({ vertexColors: true })));
      const liner = (e, upper) => {
        const N = 36;
        const pos = [];
        const colors = [];
        const normals = [];
        const idx = [];
        const q = V();
        for (const [s, ball, ink] of [
          [1, true, INK.rim],
          [1.03, false, INK.rim],
          [1.07, false, INK.fold],
        ]) {
          tint.set(ink);
          for (let k = 0; k <= N; k++) {
            rimPoint(e, (upper ? 0 : 0.5) + (0.5 * k) / N, s, ball, q, n);
            pos.push(q.x, q.y, q.z);
            normals.push(n.x, n.y, n.z);
            colors.push(tint.r, tint.g, tint.b);
          }
        }
        for (let r = 0; r < 2; r++) {
          for (let k = 0; k < N; k++) {
            const a = r * (N + 1) + k;
            const b = a + 1;
            const c = a + N + 1;
            if (e.sg > 0) idx.push(a, c, b, b, c, c + 1);
            else idx.push(a, b, c, b, c + 1, c);
          }
        }
        return onHead(new THREE.Mesh(geometry(pos, idx, { colors, normals }), linerMat));
      };

      const basis = new THREE.Matrix4();
      const eyes = eyeData().map((e) => {
        const eye = new THREE.Group();
        eye.position.copy(e.E);
        eye.quaternion.setFromRotationMatrix(basis.makeBasis(e.X, e.Y, e.n));
        onHead(eye);
        const ball = new THREE.Mesh(ballGeo, eyeMat);
        const lids = [true, false].map((upper) => new THREE.Mesh(lidGeometry(e, upper), lidMat));
        const rims = [liner(e, true), liner(e, false)];
        // a light in it (from above, a little to the right of it — to the left as one looks at it)
        const glint = new THREE.Mesh(glintGeo, glintMat);
        const at = V(-0.2, 0.2, 0.96).normalize();
        glint.position.copy(at).multiplyScalar(EYE.R + 0.0001);
        glint.quaternion.setFromUnitVectors(V(0, 0, 1), at);
        eye.add(ball, ...lids, glint);
        return {
          eye,
          ball,
          glint,
          lid: lids[0],
          /** `mode`: 'open', 'sleep', or else content; `k`: how far a blink has come, 0 … 0.9. */
          set(mode, k) {
            let up = 0.03 + k * 0.78; // (open, its lids are the rims of the opening)
            let lo = k * 0.22;
            if (mode === 'sleep') {
              up = 0.8;
              lo = 0.26;
            } else if (mode !== 'open') {
              up = Math.max(up, 0.58);
              lo = Math.max(lo, 0.48);
            }
            lids[0].rotation.x = up * FULL;
            lids[1].rotation.x = -lo * FULL;
            // (shut, they come out over the dark rims of the opening: a shut eye is a line in the fur, not an outline)
            const over = 1 + 0.1 * smooth(0.45, 0.75, up);
            lids[0].scale.setScalar(over);
            lids[1].scale.setScalar(over);
            rims[0].visible = up < 0.25;
            rims[1].visible = lo < 0.15;
            glint.visible = up < 0.4;
          },
        };
      });

      // ---- the nose: a little raised, moist; lighter on top, darker at its edge
      const nd = noseData();
      const noseMesh = (() => {
        const RINGS = 7;
        const AROUND = 48;
        const pos = [];
        const colors = [];
        const idx = [];
        const q = V();
        const dome = (f) => 0.0004 + 0.0009 * (1 - f * f);
        const edge = new THREE.Color(INK.noseEdge);
        const light = new THREE.Color(INK.noseLight);
        const point = (x, y, f) => {
          onSkin(q.copy(nd.C).addScaledVector(nd.X, x).addScaledVector(nd.Y, y), q);
          q.addScaledVector(normalAt(q, n), dome(f));
          pos.push(q.x, q.y, q.z);
          tint.set(INK.nose).lerp(edge, smooth(0.55, 1, f));
          tint.lerp(light, 0.6 * smooth(0, 0.8, y / NOSE.top) * (1 - f * 0.7));
          colors.push(tint.r, tint.g, tint.b);
        };
        point(0, 0, 0);
        for (let r = 1; r <= RINGS; r++) {
          const f = r / RINGS;
          for (let k = 0; k < AROUND; k++) {
            const a = (k / AROUND) * TAU;
            const e = nd.edge(a) * f;
            point(Math.cos(a) * e, Math.sin(a) * e, f);
          }
        }
        for (let k = 0; k < AROUND; k++) idx.push(0, 1 + k, 1 + ((k + 1) % AROUND));
        for (let r = 1; r < RINGS; r++) {
          for (let k = 0; k < AROUND; k++) {
            const a = 1 + (r - 1) * AROUND + k;
            const b = 1 + (r - 1) * AROUND + ((k + 1) % AROUND);
            idx.push(a, a + AROUND, b, b, a + AROUND, b + AROUND);
          }
        }
        const mat = laid(keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4 })));
        const mesh = onHead(new THREE.Mesh(geometry(pos, idx, { colors, out: skinOut }), mat));
        // its nostrils, curling up and out at its sides
        const nostrilMat = laid(keep(new THREE.MeshLambertMaterial({ color: INK.nostril })));
        for (const sg of [1, -1]) {
          // (round from its middle and how far out to its edge: from low by its point, up and out along its side)
          const way = [
            [-72, 0.42],
            [-48, 0.62],
            [-28, 0.76],
            [-8, 0.8],
          ];
          const spot = ([a, f]) => {
            const r = ((sg > 0 ? a : 180 - a) * DEG) % TAU;
            const e = nd.edge(r < 0 ? r + TAU : r) * f;
            return nd.C.clone().addScaledVector(nd.X, Math.cos(r) * e).addScaledVector(nd.Y, Math.sin(r) * e);
          };
          const line = smoothLine(way.map((w) => onSkin(spot(w))), 4);
          const lift = (t) => dome(lerp(way[0][1], way[3][1], t)) + 0.00018;
          onHead(new THREE.Mesh(ribbon(line, (t) => 0.00042 * (1 - 0.65 * t), lift), nostrilMat));
        }
        return mesh;
      })();

      // ---- the mouth: the groove down from the nose, the line of the lips, and inside, what shows when it opens
      const lipMat = laid(keep(new THREE.MeshLambertMaterial({ color: INK.lip })));
      const lipPoint = (phi) => {
        const th = lipAt(phi);
        const d = V(Math.cos(th) * Math.sin(phi), Math.sin(th), Math.cos(th) * Math.cos(phi));
        return d.multiplyScalar(reach(d.x, d.y, d.z));
      };
      const lips = [];
      for (let k = 0; k <= 72; k++) lips.push(lipPoint(lerp(-LIP, LIP, k / 72) * DEG));
      const lipWidth = (t) => 0.00012 + 0.00028 * Math.pow(Math.sin(Math.PI * t), 0.5);
      onHead(new THREE.Mesh(ribbon(lips, lipWidth, () => 0.0002), lipMat));
      {
        const from = nd.C.clone().addScaledVector(nd.Y, NOSE.bottom + 0.0006);
        const to = lipPoint(0);
        const line = [];
        for (let k = 0; k <= 10; k++) line.push(onSkin(from.clone().lerp(to, k / 10)));
        onHead(new THREE.Mesh(ribbon(line, () => 0.00022, () => 0.0002), lipMat));
      }
      // (inside, dark: the roof of it on the head, its floor on the jaw — whatever shows between the lips is one or the other)
      const insideGeo = keep(new THREE.SphereGeometry(1, 20, 14));
      const insideMat = keep(new THREE.MeshLambertMaterial({ color: INK.mouth, side: THREE.BackSide }));
      const roof = new THREE.Mesh(insideGeo, insideMat);
      roof.scale.set(0.032, 0.0145, 0.024);
      roof.position.set(0, -0.0455, 0.046);
      onHead(roof);
      const floor = new THREE.Mesh(insideGeo, insideMat);
      floor.scale.set(0.024, 0.0065, 0.022);
      floor.position.set(0, -0.0575, 0.04);
      onJaw(floor);
      const throat = new THREE.Mesh(insideGeo, keep(new THREE.MeshLambertMaterial({ color: INK.mouth })));
      throat.scale.set(0.034, 0.019, 0.016);
      throat.position.set(0, -0.046, 0.024);
      onHead(throat);
      const toothGeo = keep(new THREE.ConeGeometry(0.00085, 0.0032, 8));
      const toothMat = keep(new THREE.MeshStandardMaterial({ color: INK.tooth, roughness: 0.35 }));
      for (const sg of [1, -1]) {
        const fang = new THREE.Mesh(toothGeo, toothMat);
        fang.rotation.x = Math.PI;
        fang.position.set(sg * 0.0095, -0.0578, 0.0625);
        onHead(fang);
      }
      const tongue = new THREE.Mesh(keep(new THREE.SphereGeometry(1, 14, 10)), keep(new THREE.MeshStandardMaterial({ color: INK.tongue, roughness: 0.5 })));
      tongue.scale.set(0.0092, 0.0026, 0.0115);
      tongue.position.set(0, -0.0585, 0.0445);
      onJaw(tongue);
      tongue.userData.rest = tongue.position.clone();
      tongue.userData.out = 0.008;

      // ---- whiskers: four rows of two on each pad, fanned, bending down and back towards their tips, fading out; three
      // over each eye, two on each cheek
      const wp = [];
      const wc = [];
      const hair = (root, dir, len, droop) => {
        const STEPS = 9;
        let px = root.x;
        let py = root.y;
        let pz = root.z;
        let pa = 0.9;
        for (let k = 1; k <= STEPS; k++) {
          const t = k / STEPS;
          const x = root.x + dir.x * len * t;
          const y = root.y + dir.y * len * t - droop * t * t;
          const z = root.z + dir.z * len * t - 0.25 * droop * t * t;
          const a = 0.9 * (1 - 0.82 * t);
          wp.push(px, py, pz, x, y, z);
          wc.push(1, 1, 1, pa, 1, 1, 1, a);
          px = x;
          py = y;
          pz = z;
          pa = a;
        }
      };
      for (const sg of [1, -1]) {
        for (let row = 0; row < 4; row++) {
          for (let c = 0; c < 2; c++) {
            const root = onSkin(V(sg * (0.0085 + 0.0062 * c + 0.0012 * row), -0.0425 - 0.0034 * row, 0.09));
            root.addScaledVector(normalAt(root, n), -0.0004);
            const len = [0.078, 0.086, 0.082, 0.072][row] + 0.005 * c;
            hair(root, V(sg, [0.2, 0.06, -0.08, -0.2][row] - 0.03 * c, [0.5, 0.34][c]).normalize(), len, 0.14 * len);
          }
        }
        for (const [x, y, len] of [
          [0.018, 0.022, 0.03],
          [0.024, 0.023, 0.034],
          [0.03, 0.022, 0.03],
        ]) {
          hair(onSkin(V(sg * x, y, 0.08)), V(sg * 0.5, 0.75, 0.45).normalize(), len, 0.08 * len);
        }
        for (const [y, len] of [
          [-0.012, 0.04],
          [-0.02, 0.035],
        ]) {
          hair(onSkin(V(sg * 0.07, y, 0.025)), V(sg * 0.9, 0.15, -0.3).normalize(), len, 0.1 * len);
        }
      }
      const wg = keep(new THREE.BufferGeometry());
      wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3));
      wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 4));
      const whiskerMat = keep(new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
      const whiskers = onHead(new THREE.LineSegments(wg, whiskerMat));

      bones.head.traverse((o) => o.isMesh && (o.castShadow = false));
      bones.jaw.traverse((o) => o.isMesh && (o.castShadow = false));
      return {
        eyes,
        nose: noseMesh,
        tongue,
        whiskers,
        /** How wide its pupils are: 0 narrow (in the light) … 1 round (in the dark, or when it is excited). */
        pupil(k) {
          pupil.value.set(lerp(0.075, 0.2, k), lerp(0.15, 0.215, k));
        },
        /** How large it is seen (pixels to a unit of its own): its whiskers — a pixel wide however far it is — fade out
         *  as it gets smaller, or from afar they are a white moustache. */
        near(px) {
          whiskerMat.opacity = clamp((px - 150) / 1000, 0.06, 1);
        },
        dispose: () => made.forEach((x) => x.dispose()),
      };
    },
  },
};

/** `pts` with `steps` more points between each two (a Catmull-Rom curve through them), each put back on the skin. */
function smoothLine(pts, steps) {
  const out = [];
  const at = (i) => pts[clamp(i, 0, pts.length - 1)];
  for (let i = 0; i < pts.length - 1; i++) {
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const p = V(
        catmull(at(i - 1).x, at(i).x, at(i + 1).x, at(i + 2).x, t),
        catmull(at(i - 1).y, at(i).y, at(i + 1).y, at(i + 2).y, t),
        catmull(at(i - 1).z, at(i).z, at(i + 1).z, at(i + 2).z, t)
      );
      out.push(onSkin(p, p));
    }
  }
  out.push(pts[pts.length - 1].clone());
  return out;
}

/** The eye, painted on the front of the ball: the iris olive-yellow with fine streaks out from the middle, a darker ring
 *  at its edge; round it the white, what little of it shows. (The pupil is drawn over it: `uPupil`.) */
function irisTexture() {
  const rnd = rng(17);
  return paintTexture(256, (g, S) => {
    const c = S / 2;
    const R = (EYE.iris / (2 * EYE.R)) * S;
    const white = g.createRadialGradient(c, c, R, c, c, S / 2);
    white.addColorStop(0, INK.white);
    white.addColorStop(1, '#9f948f');
    g.fillStyle = white;
    g.fillRect(0, 0, S, S);
    const fill = g.createRadialGradient(c, c, 0, c, c, R);
    for (const [at, color] of INK.iris) fill.addColorStop(at, color);
    g.fillStyle = fill;
    g.beginPath();
    g.arc(c, c, R, 0, TAU);
    g.fill();
    g.lineCap = 'round';
    for (let k = 0; k < 140; k++) {
      const a = rnd() * TAU;
      const r0 = R * (0.18 + 0.12 * rnd());
      const r1 = R * (0.55 + 0.4 * rnd());
      g.strokeStyle = rnd() < 0.5 ? `rgba(226, 214, 140, ${0.1 + 0.15 * rnd()})` : `rgba(84, 76, 36, ${0.08 + 0.14 * rnd()})`;
      g.lineWidth = 0.8 + 1.6 * rnd();
      g.beginPath();
      g.moveTo(c + Math.cos(a) * r0, c + Math.sin(a) * r0);
      g.lineTo(c + Math.cos(a + 0.05) * r1, c + Math.sin(a + 0.05) * r1);
      g.stroke();
    }
    const ring = g.createRadialGradient(c, c, R * 0.86, c, c, R * 1.03);
    ring.addColorStop(0, 'rgba(79, 71, 51, 0)');
    ring.addColorStop(0.6, INK.limbus);
    ring.addColorStop(1, 'rgba(79, 71, 51, 0)');
    g.fillStyle = ring;
    g.beginPath();
    g.arc(c, c, R * 1.03, 0, TAU);
    g.fill();
    const lid = g.createLinearGradient(0, c - R, 0, c - R * 0.1);
    lid.addColorStop(0, 'rgba(38, 32, 26, 0.62)');
    lid.addColorStop(1, 'rgba(38, 32, 26, 0)');
    g.fillStyle = lid;
    g.fillRect(0, 0, S, S);
    const halo = g.createRadialGradient(c, c, R * 0.05, c, c, R * 0.42);
    halo.addColorStop(0, 'rgba(206, 196, 120, 0.55)');
    halo.addColorStop(1, 'rgba(206, 196, 120, 0)');
    g.fillStyle = halo;
    g.beginPath();
    g.arc(c, c, R * 0.42, 0, TAU);
    g.fill();
  });
}

/** A soft round light, for the shine on an eye. */
function glintTexture() {
  return paintTexture(64, (g, S) => {
    const f = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
    f.addColorStop(0, 'rgba(255, 255, 255, 1)');
    f.addColorStop(0.45, 'rgba(255, 255, 255, 0.85)');
    f.addColorStop(1, 'rgba(255, 255, 255, 0)');
    g.fillStyle = f;
    g.fillRect(0, 0, S, S);
  });
}
