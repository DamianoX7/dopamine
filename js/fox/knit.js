// A sweater for a fox, with a picture of hers knitted into it (js/knit.js keeps her pictures and paints the knitting:
// KnitArt). It is knitted to fit the fox that wears it: a skin of its own a little way out from the coat — over the
// fur, pressed flat under it — from the waist to the neck and down over the tops of the forelegs, ribbed at the neck,
// the hem and the cuffs, and moved by the same bones as the coat. It is laid over the lofts rig.js notes for it (the
// torso, the forelegs), as far as the kind's `knit` says (species.js): the hem higher up under the belly than over the
// back. Her picture goes on the back, its top towards the head, as she sees it from behind (or all over, as a pattern).
import * as THREE from '../vendor/three.module.min.js';

const COVER = 0.85; //   how flat the fur lies under it (1 = flat on the skin)
const FLAT = 0.5; //     how far out the knitting is from the skin: this much of the fur's length there…
const THICK = 0.0035; // …and as thick as this (model units)
const ROLL = 0.0055; //  how far the ribbing at the neck, the hem and the cuffs stands out from the rest
const FADE = 1.6; //     the fur stands up again over this many rings of the coat past its edges
const CSUB = 3; //       columns of the knitting to a column of the coat
const RSUB = 2; //       rows of it to a ring of the coat
const BAND = { collar: 1.7, hem: 1.2, cuff: 1 }; // how wide the ribbing is (rings of the coat)
const AROUND = 80; //    stitches round the chest — fewer on a fox with too short a back for her picture
const IDENTITY = new THREE.Matrix4();
const TAU = Math.PI * 2;
const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const cr = (p0, p1, p2, p3, t) => 0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

const art = () => window.KnitArt;
/** Is this something to wear a sweater by? ('knit3', 'knit3@2' — the picture's id, and how many times it was drawn on) */
export const isKnit = (id) => /^knit/.test(String(id));

// ------------------------------------------------------------------ the coat under it

/** One loft of the coat (rig.js: lofts), to be read anywhere between its rings and columns. */
function coatOf(rig, loft) {
  const a = rig.coat.attributes;
  const { base, segs, rings } = loft;
  return {
    segs,
    rings,
    sub: loft.sub,
    P: a.position.array,
    N: a.normal.array,
    I: a.skinIndex.array,
    W: a.skinWeight.array,
    F: a.aFur.array,
    at: (r, j) => base + Math.min(rings - 1, Math.max(0, r)) * segs + (((j % segs) + segs) % segs),
  };
}

const _row = [0, 0, 0, 0];
const _bones = new Map();

/** The coat at ring `rf`, column `jf` (both may fall between): where it is (smoothly), which way it faces, its bones, how long its fur is. */
function onCoat(c, rf, jf) {
  const r0 = Math.floor(rf);
  const j0 = Math.floor(jf);
  const tr = rf - r0;
  const tj = jf - j0;
  const p = new THREE.Vector3();
  for (let k = 0; k < 3; k++) {
    for (let m = 0; m < 4; m++) {
      const r = r0 - 1 + m;
      _row[m] = cr(c.P[c.at(r, j0 - 1) * 3 + k], c.P[c.at(r, j0) * 3 + k], c.P[c.at(r, j0 + 1) * 3 + k], c.P[c.at(r, j0 + 2) * 3 + k], tj);
    }
    p.setComponent(k, cr(_row[0], _row[1], _row[2], _row[3], tr));
  }
  // …the rest from the four points round it
  const corners = [
    [c.at(r0, j0), (1 - tr) * (1 - tj)],
    [c.at(r0, j0 + 1), (1 - tr) * tj],
    [c.at(r0 + 1, j0), tr * (1 - tj)],
    [c.at(r0 + 1, j0 + 1), tr * tj],
  ];
  const n = new THREE.Vector3();
  let fur = 0;
  _bones.clear();
  for (const [v, w] of corners) {
    n.x += c.N[v * 3] * w;
    n.y += c.N[v * 3 + 1] * w;
    n.z += c.N[v * 3 + 2] * w;
    fur += c.F[v] * w;
    for (let k = 0; k < 4; k++) {
      const bw = c.W[v * 4 + k] * w;
      if (bw > 0) _bones.set(c.I[v * 4 + k], (_bones.get(c.I[v * 4 + k]) || 0) + bw);
    }
  }
  n.normalize();
  const top = [..._bones.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
  const skin = [0, 0, 0, 0, 0, 0, 0, 0];
  top.forEach(([b, w], k) => {
    skin[k] = b;
    skin[4 + k] = w / sum;
  });
  return { p, n, skin, fur };
}

/** How the kind wears it, in rings of the coat: { body: [loft, hem(jf), collar], sleeves: [[loft, from, to]] } — or null. */
function fitOf(rig) {
  const fit = rig.species.knit;
  const torso = rig.lofts.find((l) => l.part === 'torso');
  if (!fit || !torso) return null;
  const s = torso.sub;
  const hem = (jf) => s * (fit.hemTop + (fit.hemBelly - fit.hemTop) * Math.pow((1 - Math.sin((jf / torso.segs) * TAU)) / 2, 1.5)); // (s = 1 is "up": rig.js loft)
  return {
    body: { loft: torso, hem, collar: s * fit.collar },
    sleeves: rig.lofts.filter((l) => l.part === 'legF').map((loft) => ({ loft, from: loft.sub * fit.sleeveFrom, to: loft.sub * fit.sleeve })),
  };
}

const covered = new WeakSet();

/** Where the fur of this fox lies flat under its sweater (the coat's aCover, rig.js) — worked out once a fox. */
function pressFur(rig, fit) {
  if (covered.has(rig)) return;
  covered.add(rig);
  const attr = rig.coat.attributes.aCover;
  const out = attr.array;
  const { loft, hem, collar } = fit.body;
  for (let r = 0; r < loft.rings; r++) {
    for (let j = 0; j < loft.segs; j++) {
      const h = hem(j);
      out[loft.base + r * loft.segs + j] = COVER * smooth(h - FADE, h, r) * smooth(collar + FADE, collar, r);
    }
  }
  for (const { loft, from, to } of fit.sleeves) {
    for (let r = 0; r < loft.rings; r++) {
      const k = COVER * smooth(from - FADE, from, r) * smooth(to + FADE * 0.75, to, r);
      for (let j = 0; j < loft.segs; j++) out[loft.base + r * loft.segs + j] = k;
    }
  }
  attr.needsUpdate = true;
}

// ------------------------------------------------------------------ the knitting

/**
 * The knitting over one part of the coat, as a grid: rows from one edge to the other, columns all round from its seam
 * and back to it (the last column is the first again — its pictures meet there). `where(i, k)` → [rf, jf, lift].
 */
function grid(c, rows, cols, where, furLen) {
  const pts = [];
  for (let i = 0; i <= rows; i++) {
    for (let k = 0; k <= cols; k++) {
      const [rf, jf, lift] = where(i, k);
      const q = onCoat(c, rf, jf);
      q.p.addScaledVector(q.n, furLen * q.fur * FLAT + THICK + lift);
      pts.push(q);
    }
  }
  const at = (i, k) => pts[Math.min(rows, Math.max(0, i)) * (cols + 1) + Math.min(cols, Math.max(0, k))];
  // which way the knitting faces, from the knitting itself (round the seam it carries on into the other side)
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let i = 0; i <= rows; i++) {
    for (let k = 0; k <= cols; k++) {
      const kl = k === 0 ? cols - 1 : k - 1;
      const kr = k === cols ? 1 : k + 1;
      a.subVectors(at(i, kr).p, at(i, kl).p);
      b.subVectors(at(i + 1, k).p, at(i - 1, k).p);
      const q = at(i, k);
      const n = new THREE.Vector3().crossVectors(a, b).normalize();
      q.face = n.dot(q.n) < 0 ? n.negate() : n;
    }
  }
  // how far along each row and down each column (for laying the stitches out evenly)
  for (let i = 0; i <= rows; i++) {
    let s = 0;
    for (let k = 0; k <= cols; k++) {
      if (k) s += at(i, k).p.distanceTo(at(i, k - 1).p);
      at(i, k).round = s;
    }
  }
  for (let k = 0; k <= cols; k++) {
    let l = 0;
    for (let i = 0; i <= rows; i++) {
      if (i) l += at(i, k).p.distanceTo(at(i - 1, k).p);
      at(i, k).down = l;
    }
  }
  return { rows, cols, at };
}

/** The vertices and triangles of the knitting, a strip of rows at a time (each strip its own vertices: its stitches are laid out apart). */
class Garment {
  constructor() {
    this.pos = [];
    this.nrm = [];
    this.uv = [];
    this.skinI = [];
    this.skinW = [];
    this.idx = [];
    this.count = 0;
  }

  /** Rows `i0` … `i1` of grid `g`; `uv(q, i, k)` → [x, y] in stitches of the knitting (KnitArt.ATLAS). */
  strip(g, i0, i1, uv) {
    const A = art().ATLAS;
    const W = A.around;
    const H = A.rows + A.sleeveRows + A.ribRows;
    const first = this.count;
    for (let i = i0; i <= i1; i++) {
      for (let k = 0; k <= g.cols; k++) {
        const q = g.at(i, k);
        const [x, y] = uv(q, i, k);
        this.pos.push(q.p.x, q.p.y, q.p.z);
        this.nrm.push(q.face.x, q.face.y, q.face.z);
        this.uv.push(x / W, 1 - y / H);
        this.skinI.push(q.skin[0], q.skin[1], q.skin[2], q.skin[3]);
        this.skinW.push(q.skin[4], q.skin[5], q.skin[6], q.skin[7]);
        this.count++;
      }
    }
    // (the triangles face out of the knitting — which way round that is depends on which way the coat's rings go)
    const C = g.cols + 1;
    const P = this.pos;
    const e1 = new THREE.Vector3();
    const e2 = new THREE.Vector3();
    let out = 0;
    for (let i = 0; i < i1 - i0; i++) {
      for (let k = 0; k < g.cols; k++) {
        const a = first + i * C + k;
        e1.set(P[(a + C) * 3] - P[a * 3], P[(a + C) * 3 + 1] - P[a * 3 + 1], P[(a + C) * 3 + 2] - P[a * 3 + 2]);
        e2.set(P[(a + 1) * 3] - P[a * 3], P[(a + 1) * 3 + 1] - P[a * 3 + 1], P[(a + 1) * 3 + 2] - P[a * 3 + 2]);
        const n = e1.cross(e2);
        out += n.x * this.nrm[a * 3] + n.y * this.nrm[a * 3 + 1] + n.z * this.nrm[a * 3 + 2];
      }
    }
    for (let i = 0; i < i1 - i0; i++) {
      for (let k = 0; k < g.cols; k++) {
        const a = first + i * C + k;
        const b = a + 1;
        if (out >= 0) this.idx.push(a, a + C, b, b, a + C, b + C);
        else this.idx.push(a, b, a + C, b, b + C, a + C);
      }
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinW, 4));
    g.setIndex(this.idx);
    return g;
  }
}

/** The ribbing stands out from the knitting, and tucks in at its very edge (t = 0 at the edge … 1 where it meets the rest). */
const roll = (t, base) => (t <= 0 ? -0.45 * base : ROLL * (0.55 + 0.45 * Math.sin(Math.PI * Math.min(1, 0.25 + t))));

/** The sweater's shape on this fox — a new geometry each time (the mesh that wears it disposes of it) — or null if the kind wears none. */
function shape(rig) {
  const fit = fitOf(rig);
  if (!fit) return null;
  pressFur(rig, fit);
  const A = art().ATLAS;
  const G = art().G;
  const furLen = rig.furUniforms.uFurLen.value;
  const out = new Garment();

  // the body: from the edge of the collar (row 0) to the edge of the hem, round from the seam under the belly
  const { loft, hem, collar } = fit.body;
  const c = coatOf(rig, loft);
  const cols = c.segs * CSUB;
  const seam = (c.segs * 3) / 4; // (the column under the belly)
  const jOf = (k) => seam + k / CSUB;
  const nC = Math.ceil(BAND.collar * RSUB);
  const nH = Math.ceil(BAND.hem * RSUB);
  const nB = Math.max(4, Math.ceil((collar - BAND.collar - (hem(c.segs / 4) + BAND.hem)) * RSUB));
  const rows = nC + nB + nH;
  const out0 = furLen * FLAT; // (roughly how far out the knitting is: for tucking its edges in)
  const body = grid(
    c,
    rows,
    cols,
    (i, k) => {
      const jf = jOf(k);
      const top = collar;
      const bot = hem(jf);
      if (i <= nC) return [top - (i / nC) * BAND.collar, jf, roll(i / nC, out0)];
      if (i >= nC + nB) {
        const t = (rows - i) / nH;
        return [bot + t * BAND.hem, jf, roll(t, out0)];
      }
      const t = (i - nC) / nB;
      return [top - BAND.collar - t * (top - BAND.collar - bot - BAND.hem), jf, 0];
    },
    furLen
  );
  // the size of a stitch on this fox: AROUND of them round its chest — unless its back is too short for her picture
  let girth = 0;
  for (let i = nC; i <= nC + nB; i++) girth = Math.max(girth, body.at(i, cols).round);
  const topK = cols / 2; // (the column along the spine)
  const back = body.at(nC + nB, topK).down - body.at(nC, topK).down;
  const stitch = Math.max(girth / A.around, Math.min(girth / AROUND, back / (G + 6)));
  const mid = (body.at(nC, topK).down + body.at(nC + nB, topK).down) / 2;
  const across = (q, i) => A.around / 2 + (q.round - body.at(i, topK).round) / stitch;
  const clampX = (x, w) => Math.min(w - 0.2, Math.max(0.2, x));
  const rib = (y0, y) => A.rows + A.sleeveRows + Math.min(A.ribRows - 0.2, Math.max(0.2, y - y0));
  out.strip(body, 0, nC, (q, i) => [clampX(across(q, i), A.around), rib(0, q.down / stitch)]);
  out.strip(body, nC, nC + nB, (q, i) => [clampX(across(q, i), A.around), Math.min(A.rows - 0.2, Math.max(0.2, A.rows / 2 + (q.down - mid) / stitch))]);
  out.strip(body, nC + nB, rows, (q, i, k) => [clampX(across(q, i), A.around), rib(body.at(nC + nB, k).down / stitch, q.down / stitch)]);

  // the sleeves: from inside the body down to the cuff, round from the seam behind the leg
  for (const s of fit.sleeves) {
    const lc = coatOf(rig, s.loft);
    const scols = lc.segs * CSUB;
    const sseam = (lc.segs * 3) / 4;
    const nS = Math.max(2, Math.ceil((s.to - s.from - BAND.cuff) * RSUB));
    const nF = Math.ceil(BAND.cuff * RSUB);
    const sl = grid(
      lc,
      nS + nF,
      scols,
      (i, k) => {
        const jf = sseam + k / CSUB;
        if (i <= nS) return [s.from + (i / nS) * (s.to - s.from - BAND.cuff), jf, 0];
        const t = (nS + nF - i) / nF;
        return [s.to - t * BAND.cuff, jf, roll(t, out0)];
      },
      furLen
    );
    const front = scols / 2;
    const round = (q, i, w) => w / 2 + (q.round - sl.at(i, front).round) / stitch;
    out.strip(sl, 0, nS, (q, i) => [clampX(round(q, i, A.sleeveAround), A.sleeveAround), A.rows + Math.min(A.sleeveRows - 0.2, Math.max(0.2, 0.5 + q.down / stitch))]);
    out.strip(sl, nS, nS + nF, (q, i, k) => [clampX(round(q, i, A.around), A.around), rib(sl.at(nS, k).down / stitch, q.down / stitch)]);
  }
  return out.geometry();
}

// ------------------------------------------------------------------ the yarn

const knitted = new Map(); // picture id → { rev, canvas, map }: one texture for every fox that wears it
let bumps = null;

/** The knitting of a picture (painted again when she has drawn on it since). */
function textureOf(design) {
  let t = knitted.get(design.id);
  if (!t) {
    const canvas = art().atlas(design);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = 4;
    map.userData.shared = true; // (kit.js: disposeTree leaves it — other foxes may be wearing it)
    t = { rev: design.rev, canvas, map };
    knitted.set(design.id, t);
  } else if (t.rev !== design.rev) {
    art().atlas(design, t.canvas);
    t.rev = design.rev;
    t.map.needsUpdate = true;
  }
  return t.map;
}

/** …and its stitches standing out: the same for every picture. */
function bumpMap() {
  if (!bumps) {
    bumps = new THREE.CanvasTexture(art().relief());
    bumps.anisotropy = 4;
  }
  return bumps;
}

/** She has drawn on a picture (or it was put away): the foxes wearing it show it as it is now. */
export function repaint(design) {
  if (design && knitted.has(design.id)) textureOf(design);
}

/** A picture that is no more (or the one she was drawing, put away). */
export function unknit(id) {
  const t = knitted.get(id);
  if (!t) return;
  t.map.dispose();
  knitted.delete(id);
}

/** Only the knitting of what the foxes wear is kept (`worn`: everything they wear, 'knit3@2' and all). */
export function keepKnits(worn) {
  const on = new Set(worn.filter(isKnit).map((id) => String(id).split('@')[0]));
  for (const id of [...knitted.keys()]) if (!on.has(id)) unknit(id);
}

/**
 * The sweater `id` ('knit3' or 'knit3@2') for this fox: { object, bone: null, skinned: true } — its own skin over the
 * coat, on the fox's own bones — or null (no such picture, or a kind that wears no sweater).
 */
export function makeKnit(id, rig) {
  const host = window.FoxHost;
  const design = host && host.knitOf ? host.knitOf(String(id).split('@')[0]) : null;
  if (!design || !art()) return null;
  const geometry = shape(rig);
  if (!geometry) return null;
  const mat = new THREE.MeshLambertMaterial({ map: textureOf(design), bumpMap: bumpMap(), bumpScale: 1.2 });
  const mesh = new THREE.SkinnedMesh(geometry, mat);
  mesh.name = 'sweater';
  mesh.bind(rig.skeleton, IDENTITY); // (made in the coat's own space, as the coat was: rig.js)
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return { object: mesh, bone: null, skinned: true };
}
