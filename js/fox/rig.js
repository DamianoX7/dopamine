// The fox itself: a skeleton, one skinned and vertex-coloured coat grown from "lofts" (rings
// swept along a path), the fur shells drawn over that coat, and the face.
//
// Model space: +Z is forward, +Y is up, +X is the fox's left. Every bone rests without
// rotation, so "rotate about X" always means pitch (positive = nose / toe down and back).
import * as THREE from '../vendor/three.module.min.js';
import { speciesOf } from './species.js';
import { Batch } from './kit.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const DOWN = new THREE.Vector3(0, -1, 0);
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
export const smooth = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const catmull = (p0, p1, p2, p3, t) =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);

export const TAIL_SEGS = 5;
export const FUR_SHELLS = 16;
/** Which way the sun stands (in the world; the world keeps it): a fox looks up the shadow on its fur from a way towards it. */
export const FUR_SUN = { value: new THREE.Vector3(-0.45, 0.85, 0.25) };
const FUR_CLEAR = 0.6; //  …this far (in foxes): past its own head, ears and tail, whichever way it stands
const FUR_GATHER = 0.9; // …and from this near the middle of the fox: 0 = where the hair grows … 1 = one place for all of it

// ------------------------------------------------------------------ the coat mesh

/** Collects the vertices of one skinned mesh: position, colour, bone weights, fur length and lie. */
class CoatBuilder {
  constructor(boneIndex) {
    this.boneIndex = boneIndex;
    this.pos = [];
    this.col = [];
    this.idx = [];
    this.skinI = [];
    this.skinW = [];
    this.fur = [];
    this.comb = [];
    this.core = [];
    this.count = 0;
    this.lofts = []; // the lofts that are a part of the body clothes go over (`part`): where their rings are in the mesh
  }

  vert(p, color, weights, fur, comb, core) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(color.r, color.g, color.b);
    const top = Object.entries(weights)
      .filter(([, w]) => w > 0.001)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    for (let k = 0; k < 4; k++) {
      this.skinI.push(k < top.length ? this.boneIndex[top[k][0]] : 0);
      this.skinW.push(k < top.length ? top[k][1] / sum : 0);
    }
    this.fur.push(fur);
    this.comb.push(comb.x, comb.y, comb.z);
    this.core.push(core.x, core.y, core.z); // (the middle of the body, leg or tail it is on: FUR_VERTEX_SHADOW)
    return this.count++;
  }

  /**
   * Sweeps elliptical rings along a path. Each key: { c, rx, ry, ryB?, rxB?, w, fur?, sq? } — centre,
   * half-width along `side`, half-height towards "up" (ry) and "down" (ryB), bone weights;
   * `rxB` is the half-width of the lower half where that differs, and `sq` (0 … 1) squares the
   * ring off towards its four corners.
   * Keys are smoothed with a Catmull-Rom spline (`sub` rings per key).
   * `color(info)` and `fur(info, base)` are asked for every vertex; info = { v, s, c, P } with
   * v = 0…1 along the path and s / c = sine / cosine of the angle around it (s = 1 is "up").
   * `part` names a part of the body that clothes go over ('torso', 'legF'): its rings are noted
   * (ring r, column j is vertex base + r·segs + j; ring r is key r / sub).
   */
  loft(keys, o) {
    const segs = o.segs || 12;
    const sub = o.sub || 3;
    const side0 = o.side || X_AXIS;
    const n = keys.length;
    keys.forEach((k) => {
      if (k.ryB == null) k.ryB = k.ry;
      if (k.rxB == null) k.rxB = k.rx;
      if (k.fur == null) k.fur = 1;
      if (k.sq == null) k.sq = 0;
    });
    const at = (i) => keys[Math.min(n - 1, Math.max(0, i))];
    const ringAt = (i, f) => {
      const a = at(i - 1);
      const b = at(i);
      const c = at(i + 1);
      const d = at(i + 2);
      const rad = (k) => Math.max(0.0004, catmull(a[k], b[k], c[k], d[k], f));
      const w = {};
      for (const name in b.w) w[name] = (w[name] || 0) + b.w[name] * (1 - f);
      for (const name in c.w) w[name] = (w[name] || 0) + c.w[name] * f;
      return {
        c: V(catmull(a.c.x, b.c.x, c.c.x, d.c.x, f), catmull(a.c.y, b.c.y, c.c.y, d.c.y, f), catmull(a.c.z, b.c.z, c.c.z, d.c.z, f)),
        rx: rad('rx'),
        ry: rad('ry'),
        ryB: rad('ryB'),
        rxB: rad('rxB'),
        w,
        fur: lerp(b.fur, c.fur, f),
        sq: lerp(b.sq, c.sq, f),
        v: (i + f) / (n - 1),
      };
    };
    const rings = [];
    for (let i = 0; i < n - 1; i++) for (let k = 0; k < sub; k++) rings.push(ringAt(i, k / sub));
    rings.push(ringAt(n - 2, 1));

    const R = rings.length;
    const base = this.count;
    if (o.part) this.lofts.push({ part: o.part, base, segs, sub, rings: R });
    const t = V();
    const u = V();
    const s = V();
    const P = V();
    const comb = V();
    const info = { v: 0, s: 0, c: 0, P };
    const frames = [];
    for (let r = 0; r < R; r++) {
      const ring = rings[r];
      t.copy(rings[Math.min(R - 1, r + 1)].c).sub(rings[Math.max(0, r - 1)].c).normalize();
      u.crossVectors(t, side0).normalize();
      s.crossVectors(u, t).normalize();
      comb.copy(t).multiplyScalar(o.comb == null ? 1 : o.comb).addScaledVector(DOWN, o.droop || 0).normalize();
      frames.push(t.clone());
      for (let j = 0; j < segs; j++) {
        const a = (j / segs) * Math.PI * 2;
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        // a squared-off ring is a superellipse: the same width and height, fuller corners
        const e = 1 - 0.5 * ring.sq;
        const px = ring.sq ? Math.sign(ca) * Math.pow(Math.abs(ca), e) : ca;
        const py = ring.sq ? Math.sign(sa) * Math.pow(Math.abs(sa), e) : sa;
        const rx = sa >= 0 ? ring.rx : lerp(ring.rx, ring.rxB, smooth(0, -0.6, sa));
        P.copy(ring.c).addScaledVector(s, rx * px).addScaledVector(u, (sa >= 0 ? ring.ry : ring.ryB) * py);
        info.v = ring.v;
        info.s = sa;
        info.c = ca;
        this.vert(P, o.color(info), ring.w, o.fur ? o.fur(info, ring.fur) : ring.fur, comb, ring.c);
      }
    }
    for (let r = 0; r < R - 1; r++) {
      for (let j = 0; j < segs; j++) {
        const a = base + r * segs + j;
        const b = base + r * segs + ((j + 1) % segs);
        this.idx.push(a, b, a + segs, b, b + segs, a + segs);
      }
    }
    // close both ends with a small fan
    const cap = (r, dir) => {
      const ring = rings[r];
      const first = base + r * segs;
      const avg = new THREE.Color(0, 0, 0);
      for (let j = 0; j < segs; j++) {
        avg.r += this.col[(first + j) * 3] / segs;
        avg.g += this.col[(first + j) * 3 + 1] / segs;
        avg.b += this.col[(first + j) * 3 + 2] / segs;
      }
      P.copy(ring.c).addScaledVector(frames[r], dir * Math.max(ring.rx, ring.ry) * 0.55);
      comb.copy(frames[r]).multiplyScalar(o.comb == null ? 1 : o.comb);
      const centre = this.vert(P, avg, ring.w, ring.fur, comb, ring.c);
      for (let j = 0; j < segs; j++) {
        const a = first + j;
        const b = first + ((j + 1) % segs);
        if (dir < 0) this.idx.push(centre, b, a);
        else this.idx.push(centre, a, b);
      }
    };
    cap(0, -1);
    cap(R - 1, 1);
  }

  /** An ellipsoid lying along Z (toes, puffs). */
  blob(centre, rx, ry, rz, o) {
    const keys = [];
    const m = 5;
    for (let k = 0; k <= m; k++) {
      const a = (k / m) * Math.PI;
      const q = Math.max(0.08, Math.sin(a));
      keys.push({ c: V(centre.x, centre.y, centre.z - Math.cos(a) * rz), rx: rx * q, ry: ry * q, w: o.w, fur: o.furLen == null ? 1 : o.furLen });
    }
    this.loft(keys, { segs: o.segs || 8, sub: 2, color: o.color, comb: o.comb });
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinW, 4));
    g.setAttribute('aFur', new THREE.Float32BufferAttribute(this.fur, 1));
    g.setAttribute('aComb', new THREE.Float32BufferAttribute(this.comb, 3));
    g.setAttribute('aCore', new THREE.Float32BufferAttribute(this.core, 3));
    g.setAttribute('aCover', new THREE.Float32BufferAttribute(new Float32Array(this.count), 1)); // (how much a sweater presses the fur down here: knit.js)
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

// ------------------------------------------------------------------ fur

const FUR_VERTEX_HEAD = /* glsl */ `
attribute float aFur;
attribute vec3 aComb;
attribute vec3 aCore;
attribute float aCover;
uniform float uShell;
uniform float uFurLen;
uniform float uCover;
uniform float uComb;
uniform vec3 uSway;
uniform vec3 uFurSun;
uniform vec3 uFurMid;
varying vec3 vFurP;
varying float vFurK;
`;

// Each shell is the coat pushed out a little further along its normals (and combed along the
// body); the fragment shader then keeps fewer and fewer "strands" the further out a shell is.
// (Under a sweater the fur lies flat: knit.js says where — aCover — and uCover whether one is worn.)
const FUR_VERTEX_BODY = /* glsl */ `
float furH = uShell * uFurLen * aFur * (1.0 - uCover * aCover);
transformed += normal * furH + (aComb * uComb + uSway) * (furH * uShell);
vFurP = position - aComb * (dot(position, aComb) * 0.72); // squash the noise along the lie of the fur → long strands
vFurK = aFur;
`;

// A fox throws its shadow on the ground, and a tree throws one on the fox — but the fox throws none
// on itself, and on its fur a shadow has no fine edge. Looked up in the shadow map where each hair
// is, the head throws a hard, ragged shadow down the back and the body one on the tail, and
// wherever the edge of any shadow crosses long fur it is torn into hatching (every layer of the fur
// has it somewhere else): the coat looks scratchy beside everything else in the yard. So the shadow
// on a hair is looked up from the middle of the body, leg or tail it grows on (`aCore`: the same
// all round it and for every layer; the bones move it along), drawn most of the way in to the
// middle of the fox — the edge of a shadow passes over the whole fox, softly — and from a fox's
// length or so towards the sun: past the fox itself, under whatever else stands in the light.
const FUR_VERTEX_SHADOW = /* glsl */ `
#ifdef USE_SHADOWMAP
  #ifdef USE_SKINNING
    vec3 furAt = (skinMatrix * vec4(aCore, 1.0)).xyz;
  #else
    vec3 furAt = aCore;
  #endif
  worldPosition = modelMatrix * vec4(mix(furAt, uFurMid, ${FUR_GATHER.toFixed(2)}), 1.0);
  worldPosition.xyz += uFurSun * (${FUR_CLEAR.toFixed(2)} * length(modelMatrix[1].xyz)); // (a fox is as large as it is drawn)
#endif
`;

const FUR_FRAGMENT_HEAD = /* glsl */ `
uniform float uShell;
uniform float uDensity;
uniform float uDepth;
uniform vec3 uTipColor;
uniform float uTipAmt;
uniform float uWet;
varying vec3 vFurP;
varying float vFurK;
float furHash(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}
float furNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(furHash(i), furHash(i + vec3(1.0, 0.0, 0.0)), f.x), mix(furHash(i + vec3(0.0, 1.0, 0.0)), furHash(i + vec3(1.0, 1.0, 0.0)), f.x), f.y),
    mix(mix(furHash(i + vec3(0.0, 0.0, 1.0)), furHash(i + vec3(1.0, 0.0, 1.0)), f.x), mix(furHash(i + vec3(0.0, 1.0, 1.0)), furHash(i + vec3(1.0, 1.0, 1.0)), f.x), f.y),
    f.z);
}
`;

const FUR_FRAGMENT_BODY = /* glsl */ `
{
  float furLong = smoothstep(0.14, 0.6, vFurK); // short fur (muzzle, ears, legs) stays solid
  float furN = furNoise(vFurP * uDensity) * 0.8 + furNoise(vFurP * uDensity * 1.9 + 7.1) * 0.2;
  float furTh = mix(0.1, 0.64 + 0.2 * uWet, uShell * uShell) * furLong; // (wet fur clings together: fewer strands stand out)
  diffuseColor.a = uShell <= 0.0 ? 1.0 : clamp(0.5 + (furN - furTh) * 5.0, 0.0, 1.0);
  float furAo = mix(mix(1.0, 1.0 - 0.2 * uDepth, furLong), 1.0 + 0.05 * uDepth, pow(uShell, 0.6)); // darker at the roots, bright at the tips — a little: the coat is soft
  // (the colour of the tips reaches some way down the hair: dark at the roots and pale only at the very tips, a coat is all scales)
  diffuseColor.rgb = mix(diffuseColor.rgb, uTipColor, uTipAmt * mix(0.35, 1.0, smoothstep(0.2, 1.0, uShell)) * furLong) * furAo;
  diffuseColor.rgb *= 1.0 - 0.3 * uWet; // …and is darker
}
`;

function furMaterial(shell, uniforms) {
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  if (shell > 0) {
    mat.alphaTest = 0.5;
    mat.alphaToCoverage = true;
  }
  const own = { uShell: { value: shell } };
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms, own, { uFurSun: FUR_SUN });
    shader.vertexShader =
      FUR_VERTEX_HEAD +
      shader.vertexShader
        .replace('#include <begin_vertex>', `#include <begin_vertex>\n${FUR_VERTEX_BODY}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${FUR_VERTEX_SHADOW}`);
    shader.fragmentShader =
      FUR_FRAGMENT_HEAD + shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${FUR_FRAGMENT_BODY}`);
  };
  return mat;
}

// ------------------------------------------------------------------ the fox

/**
 * Builds a fox of the given kind. Returns the rig the animator drives:
 * { group, bones, legs, tails, face, dims, species, scale, setShells(n), dispose() }.
 */
export function buildFox(speciesId, opts = {}) {
  const sp = speciesOf(speciesId, opts.grown); // `grown`: how far a kit is on its way to a grown fox (0 … 1)
  // A kind that is not a fox out of the same mould (animud.js) makes some of its parts itself — `own.torso(kit)`,
  // `own.legs`, `own.tail`, `own.head`, `own.face` — on the same skeleton, so that it moves like the others.
  const own = sp.own || {};
  const C = {};
  for (const k in sp.colors) C[k] = new THREE.Color(sp.colors[k]);
  for (const k in sp.extra || {}) C[k] = new THREE.Color(sp.extra[k]);
  const col = new THREE.Color();
  const paint = (part, i) => {
    if (sp.paint) {
      i.C = C;
      i.smooth = smooth;
      sp.paint(part, col, i);
    }
    return col;
  };

  // ---- proportions
  const kL = sp.leg;
  const kLR = sp.legR;
  const kR = sp.girth;
  const kX = 1 + (kR - 1) * 0.6; //   legs sit a little wider on a rounder body
  const kB = sp.bodyLen;
  const kH = sp.head;
  const kM = sp.muzzle;
  const kT = sp.snout; //              how thick the muzzle is
  const kS = sp.skull; //              how wide the head is behind the muzzle
  const kC = sp.crown; //              how high the head rises above the eyes
  const kN = (0.6 + 0.4 * kH) * (1.5 - 0.5 * sp.neck); // the neck only partly follows the size of the head; a short neck is a thick one
  const yOff = -(1 - kL) * 0.3; //    shorter legs carry the whole body lower
  const yB = 0.385 + yOff; //         height of the spine
  const zH = -0.2 * kB;
  const zS = -0.02 * kB;
  const zC = 0.16 * kB;

  // ---- joints (model space)
  const J = {
    root: V(0, 0, 0),
    hips: V(0, yB, zH),
    spine: V(0, yB + 0.01, zS),
    chest: V(0, yB + 0.005, zC),
    neck: V(0, yB + 0.06, zC + 0.105),
    head: V(0, yB + 0.06 + 0.13 * sp.neck, zC + 0.105 + 0.095 * sp.neck), // a short neck carries the head low, close to the shoulders
  };
  // a point of the neck, given by how far above and ahead of the neck joint it lies on the red fox
  const onNeck = (y, z) => V(0, lerp(J.neck.y, J.head.y, y / 0.13), lerp(J.neck.z, J.head.z, z / 0.095));
  const inHead = (x, y, z) => V(J.head.x + x * kH, J.head.y + y * kH, J.head.z + (z <= 0.085 ? z : 0.085 + (z - 0.085) * kM) * kH);
  J.jaw = inHead(0, -0.02, 0.045);
  // the ears stand on top of the skull: set further apart (`earSet`) they come to sit lower, on its shoulder
  const skullRim = (x, n) => Math.pow(Math.max(0.02, 1 - Math.pow(x / 0.07, n)), 1 / n);
  const earX = 0.05 * sp.earSet;
  const earY = 0.035 + kC * (0.033 + 0.061 * (skullRim(earX, 2 / (1 - 0.5 * sp.boxy)) - skullRim(0.05, 2)));
  J.earL = inHead(earX * kS, earY, -0.012);
  J.earR = inHead(-earX * kS, earY, -0.012);
  // for painting the parts of the head: where a vertex is in the head's own space (at the red fox's size)
  const _H = V();
  const inHeadSpace = (i) => (i.H = _H.copy(i.P).sub(J.head).divideScalar(kH));

  const fx = 0.078 * kX;
  const hx = 0.085 * kX;
  const shoulderY = yB - 0.04;
  const elbowY = shoulderY - 0.14 * kL;
  const hipY = yB - 0.025;
  const kneeY = hipY - 0.135 * kL;
  const hockY = 0.035 + 0.09 * kL;
  const WRIST_H = 0.048;
  const PAW_H = 0.035;
  const legJoints = (sg) => ({
    fU: V(fx * sg, shoulderY, zC + 0.025),
    fL: V(fx * sg, elbowY, zC + 0.005),
    fP: V(fx * sg, WRIST_H, zC + 0.03),
    hT: V(hx * sg, hipY, zH - 0.005),
    hS: V(hx * sg, kneeY, zH + 0.06),
    hF: V(hx * sg, hockY, zH - 0.05),
    hP: V(hx * sg, PAW_H, zH - 0.025),
  });
  const LJ = { L: legJoints(1), R: legJoints(-1) };

  // ---- tails: one, or a fan of nine
  const tailLen = 0.5 * sp.tailLen;
  const tailSeg = tailLen / TAIL_SEGS;
  const tailDefs = [];
  for (let t = 0; t < sp.tails; t++) {
    const f = sp.tails === 1 ? 0 : (t / (sp.tails - 1)) * 2 - 1; // -1 … 1 across the fan
    const yaw = f * sp.tailFan;
    const lift = sp.tails === 1 ? sp.tailLift : 0.2 + 0.5 * (1 - Math.abs(f)) + (t % 2) * 0.2;
    tailDefs.push({ yaw, lift, f, base: V(yaw * 0.03, yB + (sp.tails === 1 ? 0 : 0.01 + lift * 0.02), zH - 0.135) });
  }
  if (own.joints) own.joints({ J, LJ, tailDefs, yB, zH, zS, zC }); // (it may carry its head, or stand, differently)

  // ---- bones
  const bones = {};
  const boneIndex = {};
  const list = [];
  const addBone = (name, parent, model, local) => {
    const b = new THREE.Bone();
    b.name = name;
    b.userData.model = model.clone();
    if (local) b.position.copy(local);
    else if (parent) b.position.copy(model).sub(bones[parent].userData.model);
    else b.position.copy(model);
    b.userData.rest = b.position.clone();
    if (parent) bones[parent].add(b);
    bones[name] = b;
    boneIndex[name] = list.length;
    list.push(b);
    return b;
  };
  addBone('root', null, J.root);
  addBone('hips', 'root', J.hips);
  addBone('spine', 'hips', J.spine);
  addBone('chest', 'spine', J.chest);
  addBone('neck', 'chest', J.neck);
  addBone('head', 'neck', J.head);
  addBone('jaw', 'head', J.jaw);
  addBone('earL', 'head', J.earL);
  addBone('earR', 'head', J.earR);
  const tails = tailDefs.map((td, t) => {
    const chain = [];
    const dir = V(Math.sin(td.yaw) * Math.cos(td.lift), Math.sin(td.lift), -Math.cos(td.yaw) * Math.cos(td.lift));
    const step = V(0, Math.sin(td.lift) * tailSeg, -Math.cos(td.lift) * tailSeg); // in the base bone's own (yawed) frame
    for (let i = 0; i < TAIL_SEGS; i++) {
      const model = td.base.clone().addScaledVector(dir, tailSeg * i);
      const b = addBone(`tail${t}_${i}`, i ? `tail${t}_${i - 1}` : 'hips', model, i ? step : null);
      if (!i) {
        b.rotation.y = -td.yaw;
        b.userData.restQuat = b.quaternion.clone();
      }
      chain.push(b);
    }
    return { bones: chain, dir, def: td };
  });
  const legs = [];
  for (const side of ['L', 'R']) {
    const j = LJ[side];
    const sg = side === 'L' ? 1 : -1;
    addBone(`fU${side}`, 'chest', j.fU);
    addBone(`fL${side}`, `fU${side}`, j.fL);
    addBone(`fP${side}`, `fL${side}`, j.fP);
    addBone(`hT${side}`, 'hips', j.hT);
    addBone(`hS${side}`, `hT${side}`, j.hS);
    addBone(`hF${side}`, `hS${side}`, j.hF);
    addBone(`hP${side}`, `hF${side}`, j.hP);
    legs.push({
      front: true,
      side: sg,
      girdle: bones.chest,
      chain: [bones[`fU${side}`], bones[`fL${side}`], bones[`fP${side}`]],
      dirs: [j.fL.clone().sub(j.fU), j.fP.clone().sub(j.fL)],
      home: V(j.fP.x, 0, j.fP.z + 0.008),
      ankle: V(0, WRIST_H, -0.008), // from the point of contact up to the wrist
    });
    legs.push({
      front: false,
      side: sg,
      girdle: bones.hips,
      chain: [bones[`hT${side}`], bones[`hS${side}`], bones[`hF${side}`], bones[`hP${side}`]],
      dirs: [j.hS.clone().sub(j.hT), j.hF.clone().sub(j.hS), j.hP.clone().sub(j.hF)],
      home: V(j.hP.x, 0, j.hP.z + 0.006),
      ankle: V(0, PAW_H, -0.006),
    });
  }
  // order: front-left, hind-left, front-right, hind-right
  legs.forEach((leg) => {
    leg.lens = leg.dirs.map((d) => d.length());
    leg.dirs.forEach((d) => d.normalize());
  });

  // ---- the coat
  const coat = new CoatBuilder(boneIndex);
  const R = (v) => v * kR;

  // what a kind needs to make a part of its own: the coat it goes into, the joints it hangs on, the colours
  const kit = { THREE, V, lerp, smooth, coat, bones, J, LJ, C, col, tails, tailLen, yB, zH, zS, zC };

  // torso and neck: one skin from the rump to the back of the head
  if (own.torso) own.torso(kit);
  else {
    coat.loft(
      [
        { c: V(0, yB + 0.005, zH - 0.15), rx: 0.02, ry: 0.02, w: { hips: 1 }, fur: 0.6 },
        { c: V(0, yB + 0.005, zH - 0.125), rx: R(0.062), ry: R(0.06), ryB: R(0.062), w: { hips: 1 }, fur: 0.8 },
        { c: V(0, yB + 0.002, zH - 0.06), rx: R(0.092), ry: R(0.086), ryB: R(0.09), w: { hips: 1 }, fur: 0.85 },
        { c: V(0, yB, zH + 0.03), rx: R(0.098), ry: R(0.088), ryB: R(0.094), w: { hips: 0.75, spine: 0.25 }, fur: 0.8 },
        { c: V(0, yB + 0.004, zS - 0.01), rx: R(0.094), ry: R(0.086), ryB: R(0.088), w: { hips: 0.2, spine: 0.8 }, fur: 0.8 },
        { c: V(0, yB + 0.004, zS + 0.09 * kB), rx: R(0.1), ry: R(0.088), ryB: R(0.104), w: { spine: 0.6, chest: 0.4 }, fur: 0.85 },
        { c: V(0, yB, zC + 0.01), rx: R(0.106), ry: R(0.092), ryB: R(0.118), w: { chest: 1 }, fur: 0.9 },
        { c: V(0, yB + 0.012, zC + 0.075), rx: R(0.096), ry: R(0.09), ryB: R(0.112), w: { chest: 1 }, fur: 1 },
        { c: V(0, yB + 0.05, zC + 0.118), rx: R(0.078), ry: R(0.08), ryB: R(0.09), w: { chest: 0.55, neck: 0.45 }, fur: 1 },
        { c: onNeck(0.045, 0.045), rx: 0.06 * kN, ry: 0.064 * kN, ryB: 0.066 * kN, w: { neck: 1 }, fur: 0.9 },
        { c: onNeck(0.1, 0.075), rx: 0.056 * kN, ry: 0.057 * kN, ryB: 0.058 * kN, w: { neck: 0.5, head: 0.5 }, fur: 0.75 },
        { c: onNeck(0.135, 0.095), rx: 0.045 * kN, ry: 0.045 * kN, w: { head: 1 }, fur: 0.6 },
      ],
      {
        segs: 16,
        sub: 3,
        comb: -1,
        droop: 0.3,
        part: 'torso',
        color: (i) => {
          col.copy(C.coat).lerp(C.back, smooth(0.5, 1, i.s) * 0.6); //             a darker saddle along the spine
          col.lerp(C.belly, smooth(-0.15, -0.7, i.s)); //                           pale underside
          col.lerp(C.belly, smooth(zC + 0.02, zC + 0.09, i.P.z) * smooth(0.1, -0.4, i.s)); // the bib up the chest and throat
          return paint('torso', i);
        },
      }
    );
  }

  // legs
  if (own.legs) own.legs(kit);
  else {
    const legColor = (i) => {
      col.copy(C.coat).lerp(C.sock, smooth(0.36, 0.6, i.v));
      return paint('leg', i);
    };
    const pawColor = (i) => {
      col.copy(C.sock);
      return paint('paw', i);
    };
    const r = (v) => v * kLR;
    for (const side of ['L', 'R']) {
      const j = LJ[side];
      const U = `fU${side}`;
      const Lo = `fL${side}`;
      const Pw = `fP${side}`;
      const z0 = zC;
      coat.loft(
        [
          { c: V(j.fU.x, shoulderY + 0.055, z0 + 0.03), rx: r(0.04), ry: r(0.05), w: { chest: 0.7, [U]: 0.3 }, fur: 0.7 },
          { c: V(j.fU.x, shoulderY, z0 + 0.025), rx: r(0.044), ry: r(0.052), w: { chest: 0.4, [U]: 0.6 }, fur: 0.65 },
          { c: V(j.fU.x, lerp(shoulderY, elbowY, 0.5), z0 + 0.018), rx: r(0.038), ry: r(0.042), ryB: r(0.046), w: { [U]: 1 }, fur: 0.5 },
          { c: V(j.fU.x, elbowY, z0 + 0.005), rx: r(0.03), ry: r(0.032), ryB: r(0.036), w: { [U]: 0.5, [Lo]: 0.5 }, fur: 0.4 },
          { c: V(j.fU.x, lerp(elbowY, WRIST_H, 0.5), z0 + 0.02), rx: r(0.024), ry: r(0.026), ryB: r(0.027), w: { [Lo]: 1 }, fur: 0.22 },
          { c: V(j.fU.x, 0.052, z0 + 0.03), rx: r(0.0215), ry: r(0.024), w: { [Lo]: 0.5, [Pw]: 0.5 }, fur: 0.16 },
          { c: V(j.fU.x, 0.022, z0 + 0.036), rx: r(0.026), ry: r(0.034), ryB: r(0.024), w: { [Pw]: 1 }, fur: 0.12 },
          { c: V(j.fU.x, 0.004, z0 + 0.038), rx: r(0.022), ry: r(0.03), ryB: r(0.02), w: { [Pw]: 1 }, fur: 0.1 },
        ],
        { segs: 10, sub: 2, comb: 1, color: legColor, part: 'legF' }
      );
      coat.blob(V(j.fU.x, 0.016, z0 + 0.054), r(0.027), r(0.016), r(0.034), { w: { [Pw]: 1 }, furLen: 0.12, color: pawColor });

      const T = `hT${side}`;
      const Sh = `hS${side}`;
      const F = `hF${side}`;
      const Hp = `hP${side}`;
      coat.loft(
        [
          { c: V(j.hT.x * 0.92, hipY + 0.05, zH - 0.01), rx: r(0.046), ry: r(0.07), w: { hips: 0.7, [T]: 0.3 }, fur: 0.75 },
          { c: V(j.hT.x, hipY - 0.01, zH), rx: r(0.052), ry: r(0.076), ryB: r(0.07), w: { hips: 0.35, [T]: 0.65 }, fur: 0.7 },
          { c: V(j.hT.x, lerp(hipY, kneeY, 0.55), zH + 0.03), rx: r(0.046), ry: r(0.058), w: { [T]: 1 }, fur: 0.6 },
          { c: V(j.hT.x, kneeY, zH + 0.055), rx: r(0.034), ry: r(0.036), ryB: r(0.042), w: { [T]: 0.5, [Sh]: 0.5 }, fur: 0.45 },
          { c: V(j.hT.x, lerp(kneeY, hockY, 0.5), zH), rx: r(0.027), ry: r(0.029), ryB: r(0.031), w: { [Sh]: 1 }, fur: 0.3 },
          { c: V(j.hT.x, hockY, zH - 0.048), rx: r(0.0225), ry: r(0.024), ryB: r(0.027), w: { [Sh]: 0.5, [F]: 0.5 }, fur: 0.2 },
          { c: V(j.hT.x, lerp(hockY, PAW_H, 0.55), zH - 0.036), rx: r(0.02), ry: r(0.022), w: { [F]: 1 }, fur: 0.16 },
          { c: V(j.hT.x, 0.04, zH - 0.026), rx: r(0.022), ry: r(0.026), ryB: r(0.023), w: { [F]: 0.5, [Hp]: 0.5 }, fur: 0.14 },
          { c: V(j.hT.x, 0.02, zH - 0.02), rx: r(0.026), ry: r(0.034), ryB: r(0.024), w: { [Hp]: 1 }, fur: 0.12 },
          { c: V(j.hT.x, 0.004, zH - 0.018), rx: r(0.022), ry: r(0.03), ryB: r(0.02), w: { [Hp]: 1 }, fur: 0.1 },
        ],
        { segs: 10, sub: 2, comb: 1, color: (i) => (col.copy(C.coat).lerp(C.sock, smooth(0.42, 0.66, i.v)), paint('leg', i)) }
      );
      coat.blob(V(j.hT.x, 0.016, zH - 0.002), r(0.027), r(0.016), r(0.034), { w: { [Hp]: 1 }, furLen: 0.12, color: pawColor });
    }
  }

  // tails
  if (own.tail) own.tail(kit);
  else {
    const tailR = 0.086 * sp.tailR;
    const tailProfile = [
      [-0.08, 0.3],
      [0.05, 0.42],
      [0.2, 0.7],
      [0.4, 0.95],
      [0.58, 1],
      [0.74, 0.86],
      [0.87, 0.58],
      [0.96, 0.27],
      [1, 0.04],
    ];
    tails.forEach((tail, t) => {
      const name = (i) => `tail${t}_${Math.min(TAIL_SEGS - 1, Math.max(0, i))}`;
      const keys = tailProfile.map(([v, k]) => {
        const u = Math.max(0, v) * TAIL_SEGS - 0.5;
        const i0 = Math.floor(u);
        const f = u - i0;
        const w = {};
        w[name(i0)] = (w[name(i0)] || 0) + (1 - f);
        w[name(i0 + 1)] = (w[name(i0 + 1)] || 0) + f;
        if (v < 0.05) w.hips = 0.6;
        return { c: tail.def.base.clone().addScaledVector(tail.dir, v * tailLen), rx: tailR * k, ry: tailR * k, w, fur: 1.25 + 0.5 * k };
      });
      coat.loft(keys, {
        segs: 12,
        sub: 2,
        comb: 1,
        side: V(Math.cos(tail.def.yaw), 0, Math.sin(tail.def.yaw)),
        color: (i) => {
          col.copy(C.coat).lerp(C.back, smooth(0.45, 1, i.s) * 0.5);
          col.lerp(C.belly, smooth(-0.5, -1, i.s) * 0.3);
          col.lerp(C.tailTip, smooth(0.68, 0.8, i.v));
          return paint('tail', i);
        },
      });
    });
  }

  // head, cheeks, jaw and ears (`part` = what a head of its own says about itself: { dims })
  let eyeAt = null;
  let part = null;
  if (own.head) part = own.head(kit);
  else {
    eyeAt = [inHead(0.044, 0.046, 0.079), inHead(-0.044, 0.046, 0.079)];
    const eyeClear = sp.baby ? 1.2 : 1;
    const headKeys = [
      [-0.058, 0.03, 0.018, 0.018, 0.018, 0.5],
      [-0.04, 0.032, 0.052, 0.048, 0.046, 0.55],
      [-0.005, 0.036, 0.074, 0.064, 0.06, 0.55],
      [0.035, 0.032, 0.08, 0.06, 0.064, 0.5],
      [0.072, 0.02, 0.064, 0.046, 0.054, 0.4],
      [0.1, 0.006, 0.045, 0.033, 0.039, 0.22],
      [0.14, -0.002, 0.035, 0.027, 0.03, 0.14],
      [0.176, -0.007, 0.027, 0.022, 0.022, 0.1],
      [0.19, -0.008, 0.014, 0.012, 0.012, 0.08],
    ].map(([z, y, rx, ry, ryB, fur]) => {
      const k = kH * lerp(1, kT, smooth(0.085, 0.14, z)); // the muzzle tapers to its own thickness
      const skull = smooth(0.1, 0.035, z); //  …and this far back it is all skull: wider, flatter, squared off as the kind has it
      const jowl = sp.jowl * smooth(0.1, 0.06, z) * smooth(-0.06, -0.01, z); // heavy cheeks: the face is widest below the eyes
      const wide = rx * k * lerp(1, kS, skull);
      return { c: inHead(0, y, z), rx: wide, rxB: wide * (1 + jowl), ry: ry * k * lerp(1, kC, skull), ryB: ryB * k * (1 + 0.2 * jowl), w: { head: 1 }, fur, sq: sp.boxy * skull };
    });
    coat.loft(headKeys, {
      segs: 16,
      sub: 3,
      comb: -1,
      color: (i) => {
        const z = inHeadSpace(i).z;
        i.muzzle = smooth(0.085, 0.11, z);
        col.copy(C.coat).lerp(C.back, smooth(0.6, 1, i.s) * 0.25);
        col.lerp(C.belly, smooth(0.1, -0.3, i.s) * smooth(0, 0.05, z)); //   cheeks, chin and throat
        col.lerp(C.belly, i.muzzle * smooth(0.78, 0.3, i.s)); //              the sides of the muzzle
        return paint('head', i);
      },
      // keep the fur short around the eyes so it never grows over them (a kit's eyes are larger for its head);
      // heavy cheeks carry a ruff of longer fur
      fur: (i, base) =>
        base *
        smooth(0.016 * kH * eyeClear, 0.04 * kH * eyeClear, Math.min(i.P.distanceTo(eyeAt[0]), i.P.distanceTo(eyeAt[1]))) *
        (1 + 2.2 * sp.jowl * smooth(0.045, 0.085, Math.abs(i.H.x)) * smooth(0.035, -0.005, i.H.y)),
    });

    // cheek ruffs: a tuft pointing out to either side (`ruff` = how big; none at 0)
    const kF = sp.ruff;
    for (const sg of kF ? [1, -1] : []) {
      coat.loft(
        [
          { c: inHead(0.05 * sg * kS, 0.006, 0.034), rx: 0.03 * kH * kF, ry: 0.034 * kH * kF, w: { head: 1 }, fur: 0.8 },
          { c: inHead((0.05 + 0.034 * kF) * sg * kS, -0.006, 0.014), rx: 0.02 * kH * kF, ry: 0.024 * kH * kF, w: { head: 1 }, fur: 1.1 },
          { c: inHead((0.05 + 0.058 * kF) * sg * kS, -0.02, -0.004), rx: 0.003, ry: 0.003, w: { head: 1 }, fur: 0.9 },
        ],
        {
          segs: 8,
          sub: 2,
          comb: 1,
          side: V(0, 0, 1),
          color: (i) => {
            col.copy(C.coat).lerp(C.belly, smooth(0.02, -0.006, inHeadSpace(i).y));
            return paint('cheek', i);
          },
        }
      );
    }

    // lower jaw
    coat.loft(
      [
        [0, -0.004, 0.03, 0.008, 0.014],
        [0.05, -0.006, 0.027, 0.007, 0.013],
        [0.1, -0.007, 0.02, 0.006, 0.01],
        [0.128, -0.007, 0.012, 0.005, 0.007],
      ].map(([z, y, rx, ry, ryB]) => ({ c: inHead(0, -0.02 + 0.012 * (1 - kT) + y, 0.045 + z), rx: rx * kH * kT, ry: ry * kH * kT, ryB: ryB * kH * kT, w: { jaw: 1 }, fur: 0.1 })),
      { segs: 8, sub: 2, comb: -1, color: (i) => (inHeadSpace(i), col.copy(C.belly), paint('jaw', i)) }
    );

    // ears
    const earProfile = (h) =>
      lerp(Math.pow(1 - h, 0.8) * (1 + 0.3 * Math.sin(Math.PI * h)), Math.pow(Math.max(0, Math.cos((h * Math.PI) / 2)), 0.55), sp.earRound);
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      const bone = `ear${side}`;
      const axis = V(Math.sin(sp.earSpread) * sg, Math.cos(sp.earSpread), 0.12).normalize();
      const keys = [-0.12, 0.05, 0.25, 0.5, 0.75, 0.92, 1].map((h) => ({
        c: J[bone].clone().addScaledVector(axis, h * sp.earH),
        rx: (sp.earW / 2) * earProfile(Math.max(0, h)),
        ry: 0.0065 * (1 - 0.6 * Math.max(0, h)),
        w: h < 0 ? { head: 0.6, [bone]: 0.4 } : { [bone]: 1 },
        fur: 0.2,
      }));
      coat.loft(keys, {
        segs: 10,
        sub: 2,
        comb: 1,
        side: V(Math.cos(0.3), 0, -Math.sin(0.3) * sg), // the open side faces forward and a little outward
        color: (i) => {
          const front = smooth(0.12, -0.2, i.s);
          i.front = front; //                                        1 on the open side of the ear, 0 on its back
          col.copy(C.earBack).lerp(C.earIn, front);
          col.lerp(C.belly, front * smooth(0.5, 0.2, i.v) * smooth(0.75, 0.3, Math.abs(i.c)) * 0.8); // pale tufts inside
          col.lerp(C.earTip, smooth(0.72, 0.9, i.v));
          return paint('ear', i);
        },
        fur: (i, base) => base + smooth(0.12, -0.2, i.s) * smooth(0.5, 0.2, i.v) * smooth(0.75, 0.3, Math.abs(i.c)) * 0.75,
      });
    }
  }

  const geometry = coat.geometry();

  // ---- assemble
  const group = new THREE.Group();
  group.name = 'fox';
  group.add(bones.root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);

  const furUniforms = {
    uFurLen: { value: 0.03 * sp.fur },
    uComb: { value: 0.85 },
    uSway: { value: new THREE.Vector3() },
    uFurMid: { value: J.spine.clone() }, // the middle of the fox (where it stands, whatever it is doing: FUR_VERTEX_SHADOW)
    uDensity: { value: opts.density || 170 },
    uDepth: { value: 1 }, //   how much darker the roots are than the tips (less when the fox is drawn small)
    uTipColor: { value: C.tip.clone() },
    uTipAmt: { value: sp.tipAmt },
    uWet: { value: 0 }, //     how wet the coat is: 0 … 1 (the world keeps that — rain, puddles, a good shake)
    uCover: { value: 0 }, //   1 while it wears a sweater: the fur under it lies flat (aCover: knit.js)
  };
  const shells = [];
  for (let i = 0; i < FUR_SHELLS; i++) {
    const mesh = new THREE.SkinnedMesh(geometry, furMaterial(i / (FUR_SHELLS - 1), furUniforms));
    mesh.frustumCulled = false;
    mesh.castShadow = i === 0;
    mesh.receiveShadow = true;
    mesh.renderOrder = i;
    group.add(mesh);
    mesh.bind(skeleton);
    shells.push(mesh);
  }
  if (sp.glow) shells.forEach((m) => m.material.emissive.set('#3a1420'));

  // ---- face: { eyes: [{ eye, ball, glint, lid }], nose, tongue, dispose() } — what the animator moves, and the glasses sit on
  let face;
  if (own.face) face = own.face(kit);
  else {
    const eyeMat = new THREE.MeshStandardMaterial({ color: C.iris || C.eye, roughness: 0.14 });
    const glintMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const lidMat = new THREE.MeshLambertMaterial({ color: C.nose });
    const eyeR = 0.0172 * kH * sp.eye;
    const ballGeo = new THREE.SphereGeometry(eyeR, 16, 12);
    const glintGeo = new THREE.SphereGeometry(eyeR * (sp.lids ? 0.15 : 0.27), 8, 6);
    const lidGeo = new THREE.TorusGeometry(eyeR * 0.82, eyeR * 0.17, 6, 14, Math.PI);
    // Eyelids (`lids`): the eye is no longer a round button but a ball set into the head, looking ahead
    // through the almond-shaped opening between an upper and a lower lid with dark rims. With an `iris`
    // colour the ball takes it and gets a pupil. Lids, rims and pupil are one mesh, the same for both eyes.
    let socketGeo = null;
    let socketMat = null;
    if (sp.lids) {
      const socket = new Batch();
      // each lid is half a shell hinged on the corners of the eye: the upper one, then the lower
      for (const turn of [-0.8 * (1 - sp.lids), Math.PI + (1 - sp.lids)]) {
        socket.add(new THREE.SphereGeometry(eyeR * 1.07, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2), { rot: [turn, 0, 0], color: C.lid || C.coat });
        socket.add(new THREE.TorusGeometry(eyeR * 1.07, eyeR * 0.065, 5, 24), { rot: [turn + Math.PI / 2, 0, 0], color: C.nose });
      }
      if (C.iris) socket.add(new THREE.SphereGeometry(eyeR * 0.36, 12, 8), { at: [0, 0, eyeR * 0.72], color: C.eye });
      socketGeo = socket.geometry();
      socketMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    }
    const eyes = [1, -1].map((sg, k) => {
      const eye = new THREE.Group();
      eye.position.copy(eyeAt[k]).sub(J.head);
      const out = V(0.62 * sg, 0.42, 0.66).normalize();
      eye.quaternion.setFromUnitVectors(V(0, 0, 1), out);
      const ball = new THREE.Mesh(ballGeo, eyeMat);
      ball.scale.set(1, 1.06, 0.72);
      const glint = new THREE.Mesh(glintGeo, glintMat);
      glint.position.set(-0.28 * eyeR * sg, 0.42 * eyeR, 0.56 * eyeR);
      const lid = new THREE.Mesh(lidGeo, lidMat); // the closed eye: "∩" when happy, "∪" when asleep
      lid.position.z = eyeR * 0.5;
      lid.scale.y = 0.62;
      lid.visible = false;
      eye.add(ball, glint, lid);
      if (sp.lids) {
        // a whole ball, sunk into the head; everything on it blinks and closes with it
        ball.scale.z = 1;
        ball.position.z = -0.35 * eyeR;
        // the socket faces ahead and somewhat outward (the skin of the head here faces half sideways), its outer corner raised
        const socket = new THREE.Mesh(socketGeo, socketMat);
        socket.quaternion.copy(eye.quaternion).invert().multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.2, 0.55 * sg, 0.18 * sg, 'YXZ')));
        ball.add(socket);
        glint.position.copy(V(-0.24 * sg, 0.1, 0.95).normalize().multiplyScalar(eyeR)).applyQuaternion(socket.quaternion).add(ball.position);
      }
      bones.head.add(eye);
      return { eye, ball, glint, lid };
    });

    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.0155 * kH * (0.5 + 0.5 * kT), 12, 10), new THREE.MeshStandardMaterial({ color: C.nose, roughness: 0.3 }));
    nose.position.copy(inHead(0, -0.003, 0.189)).sub(J.head);
    nose.scale.set(1.2, 0.92, 1);
    bones.head.add(nose);

    const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshLambertMaterial({ color: C.tongue }));
    tongue.scale.set(0.015 * kH * kT, 0.004 * kH, 0.034 * kH * kM);
    tongue.position.set(0, 0.002 * kH, 0.07 * kH * kM);
    tongue.userData.rest = tongue.position.clone();
    tongue.userData.out = 0.03 * kH; // how far it comes out when the fox pants
    bones.jaw.add(tongue);

    [nose, tongue, ...eyes.flatMap((e) => [e.ball])].forEach((m) => (m.castShadow = false));
    face = {
      eyes,
      nose,
      tongue,
      dispose() {
        [ballGeo, glintGeo, lidGeo, socketGeo, nose.geometry, tongue.geometry].forEach((g) => g && g.dispose());
        [eyeMat, glintMat, lidMat, socketMat, nose.material, tongue.material].forEach((m) => m && m.dispose());
      },
    };
  }
  group.scale.setScalar(sp.size);

  return {
    group,
    bones,
    skeleton,
    legs,
    tails,
    shells,
    species: sp,
    speciesId,
    scale: sp.size,
    headScale: kH,
    muzzle: kM,
    face,
    dims: {
      hipHeight: hipY,
      noseTip: inHead(0, -0.006, 0.2).sub(J.head), // in the head bone's space
      crown: V(0, (0.036 + 0.061 * kC) * kH, 0.012 * kH), // the top of the head, between the ears
      eyeLine: eyeAt ? eyeAt[0].y - J.head.y : 0,
      earBase: J.earL.clone().sub(J.head),
      earH: sp.earH,
      neckR: 0.064 * kN,
      bodyLen: zC + 0.2 - (zH - 0.15),
      nod: 1.1, //                      how far the head can be brought down after the nose (radians)
      ...(part ? part.dims : null), // (a head of its own knows these better)
    },
    furUniforms,
    coat: geometry, //  (the coat, as it is at rest — what a sweater is knitted to fit: knit.js)
    lofts: coat.lofts,
    /**
     * How large it is drawn (device pixels to a unit of the world): its fur is drawn in soft tufts three pixels
     * or so wide whatever that is — finer strands only shimmer — and from afar it is less deep.
     */
    tuneFur(pxPerUnit) {
      furUniforms.uDensity.value = Math.min(160, Math.max(32, pxPerUnit * 0.3)) / sp.size;
      furUniforms.uDepth.value = Math.min(1, Math.max(0.3, (pxPerUnit - 150) / 500));
    },
    setShells(n) {
      // spread the visible shells evenly so the fur keeps its length with fewer layers
      const step = Math.max(1, Math.round((FUR_SHELLS - 1) / Math.max(1, n - 1)));
      shells.forEach((m, i) => (m.visible = i === 0 || (n > 1 && (i % step === 0 || i === FUR_SHELLS - 1))));
    },
    dispose() {
      geometry.dispose();
      shells.forEach((m) => m.material.dispose());
      skeleton.dispose();
      face.dispose();
    },
  };
}
