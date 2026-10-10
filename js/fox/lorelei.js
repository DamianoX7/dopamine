// Lorelei — the girl the foxes belong to. She is made after three pictures of a model of her —
// from in front, from behind, from her left: four heads tall, a round face with large brown
// eyes, fair hair that turns salmon towards its ends — a fringe, a lock before each ear, and a
// great tail tied high at the back of her head on the left, down to her hip — an olive cardigan
// with wide sleeves over a dark brown top, a short checked skirt in pleats, bare legs, soft
// brown boots. What is where, and how large, was measured off those pictures.
//
// Like the foxes she is a skeleton with one skinned, vertex-coloured mesh grown from "lofts"
// (rings swept along a path). Her head is a mesh of its own on the head bone, with her face
// painted on a canvas and laid over the front of it (paintFace). She is not lit as the scenery
// is: softly, the side of her turned from the sun a shade darker and cooler, a rim of light
// where she turns away from the eye (dress) — and what is too fine to model is drawn by the
// same shader: the strands of her hair, the check of her skirt, the ribs of her cuffs.
//
// This file is how she looks and how she moves (poses that blend, a walk worked out from how
// fast she is going, an arm that reaches for a point in the world, hair that swings behind).
// What she does is in keeper.js.
//
// Model space as for the foxes: +Z forward, +Y up, +X her left. She is one unit tall.
import * as THREE from '../vendor/three.module.min.js';
import { smooth, FUR_SUN } from './rig.js';
import { Batch } from './kit.js';

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const catmull = (p0, p1, p2, p3, t) =>
  0.5 * (2 * p1 + (p2 - p0) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (3 * p1 - p0 - 3 * p2 + p3) * t * t * t);
/** A bump round `at`: 1 there, gone `up` above it or `down` below. */
const bump = (x, at, up, down = up) => Math.exp(-(((x - at) / (x > at ? up : down)) ** 2));

/** How large she is drawn (her model is one unit tall): the foxes come up to her hip. */
export const LORELEI_SIZE = 1.3;

// Her colours, picked by eye against the pictures of her. The dark ones are a good deal lighter and greyer here than
// they come out: the way the picture is toned for the screen deepens whatever is dark.
const INK = {
  skin: '#fde6dc',
  skinDeep: '#f3c2b4', //   skin in its own shade: under her chin, under her skirt, inside a cuff
  skinRose: '#f9bdb4', //   her knees, her finger tips
  hair: '#f5d6c0',
  hairLight: '#fde9da',
  hairDeep: '#e3b8a0', //   between two locks, and underneath
  hairMid: '#fbc4b1', //    where it turns salmon…
  hairTip: '#f4b09f', //    …and its ends
  cardigan: '#7c7b69',
  cardiganDeep: '#636254',
  top: '#5d524a',
  topDeep: '#4c443f',
  skirt: '#544741', //      the check of her skirt: its light squares, the bands between them, where two bands cross, the thread through them
  skirtBand: '#48403c',
  skirtDeep: '#403a38',
  skirtLine: '#6e5f58',
  boot: '#7d644b',
  bootDeep: '#685645',
  sole: '#514741',
};

// ------------------------------------------------------------------ how she is lit, and what is drawn on her

// Every vertex of her body says what it is made of (`aTex.w`), and where on its ring it is:
const PLAIN = 0; //  cloth, leather
const CHECK = 1; //  her skirt: squares round it (by the angle) and down it (aTex.z)
const HAIR = 2; //   strands along the lock (the angle round it; aTex.xy is as long as the lock is thick there)
const RIBS = 3; //   knitted ribs: aTex.z of them round the ring
const SKIN = 4;
const CHECKS = 14; // how many squares go round her skirt (and as many pleats)

const DRESS_VERTEX_HEAD = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uMid;
uniform float uClear;
#ifdef LORELEI_TEX
  attribute vec4 aTex;
  varying vec4 vTex;
#endif
#ifdef LORELEI_FACE
  attribute vec3 aFace;
  varying vec3 vFace;
#endif
`;

// She throws her shadow on the ground, and a tree throws one on her — but she throws none on herself: at her size the
// sun's shadow map is far too coarse for it (her head would lay a ragged blot on her shoulders). So, as for the foxes'
// fur (rig.js), the shadow on her is looked up near the middle of her and from her own height towards the sun: she
// walks into the shade of a tree all at once, softly.
const DRESS_VERTEX_SHADOW = /* glsl */ `
#ifdef USE_SHADOWMAP
  worldPosition.xyz = mix(worldPosition.xyz, uMid, 0.85) + uSunDir * uClear;
#endif
`;

/** A colour as the shader writes it. */
const lin = (hex) => {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(4)}, ${c.g.toFixed(4)}, ${c.b.toFixed(4)})`;
};

const DRESS_FRAGMENT_HEAD = /* glsl */ `
uniform vec3 uLight;
uniform float uSun;
#ifdef LORELEI_TEX
  varying vec4 vTex;
#endif
#ifdef LORELEI_FACE
  uniform sampler2D uFaceMap;
  uniform vec3 uSkin;
  varying vec3 vFace;
#endif
// what a height drawn on a surface (h, in the surface's own measure) does to which way it faces
vec3 lorBump(vec3 n, vec3 toEye, float h) {
  vec3 sx = dFdx(toEye);
  vec3 sy = dFdy(toEye);
  vec3 r1 = cross(sy, n);
  vec3 r2 = cross(n, sx);
  float det = dot(sx, r1);
  if (abs(det) < 1e-14) return n;
  return normalize(n + (dFdx(h) * r1 + dFdy(h) * r2) / det);
}
`;

// (after the colour of the vertex is known)
const DRESS_FRAGMENT_COLOR = /* glsl */ `
float lorMode = 0.0;
float lorHigh = 0.0; // a height drawn on the surface: strands, ribs
#ifdef LORELEI_FACE
  lorMode = ${SKIN}.0;
  // her face is painted on skin of the colour uSkin: what the painting changes of that, it changes of the vertex's colour
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * texture2D(uFaceMap, vFace.xy).rgb / uSkin, vFace.z);
#endif
#ifdef LORELEI_TEX
  lorMode = floor(vTex.w + 0.5);
  float lorThick = length(vTex.xy);
  vec2 lorDir = vTex.xy / max(lorThick, 1e-5);
  float lorAng = atan(lorDir.y, lorDir.x);
  float lorStep = max(length(dFdx(lorDir)), length(dFdy(lorDir))); // how far round the ring one pixel goes
  if (lorMode == ${CHECK}.0) {
    float u = lorAng / 6.2831853 * ${CHECKS}.0;
    float v = vTex.z;
    float wu = lorStep / 6.2831853 * ${CHECKS}.0 + 1e-4;
    float wv = fwidth(v) + 1e-4;
    float du = abs(fract(u) - 0.5) * 2.0; // 0 in the middle of a square … 1 on the line between two
    float dv = abs(fract(v) - 0.5) * 2.0;
    float bu = smoothstep(0.52 - wu, 0.52 + wu, du);
    float bv = smoothstep(0.52 - wv, 0.52 + wv, dv);
    vec3 check = mix(${lin(INK.skirt)}, ${lin(INK.skirtBand)}, max(bu, bv));
    check = mix(check, ${lin(INK.skirtDeep)}, bu * bv);
    float lu = smoothstep(0.9 - wu, 0.9 + wu, du) * (1.0 - smoothstep(0.5, 1.6, wu * 12.0));
    float lv = smoothstep(0.9 - wv, 0.9 + wv, dv) * (1.0 - smoothstep(0.5, 1.6, wv * 12.0));
    check = mix(check, ${lin(INK.skirtLine)}, max(lu * (1.0 - bv), lv * (1.0 - bu)) * 0.6);
    diffuseColor.rgb *= check;
  } else if (lorMode == ${HAIR}.0) {
    // strands, broad and fine — none finer than the picture can show
    float w = sin(vTex.z * 2.3) * 0.6;
    float f1 = 1.0 - smoothstep(0.35, 1.1, lorStep * 5.0);
    float f2 = 1.0 - smoothstep(0.35, 1.1, lorStep * 11.0);
    float f3 = 1.0 - smoothstep(0.35, 1.1, lorStep * 23.0);
    float h = 0.5 * f1 * sin(lorAng * 5.0 + w + 1.3) + 0.3 * f2 * sin(lorAng * 11.0 - w * 1.7 + 4.1) + 0.2 * f3 * sin(lorAng * 23.0 + vTex.z * 1.1);
    lorHigh = h * lorThick * 0.05;
    diffuseColor.rgb *= 1.0 + 0.045 * h;
  } else if (lorMode == ${RIBS}.0) {
    float h = (0.5 + 0.5 * cos(lorAng * vTex.z)) * (1.0 - smoothstep(0.35, 1.1, lorStep * vTex.z));
    lorHigh = h * 0.0014;
    diffuseColor.rgb *= 0.9 + 0.12 * h;
  }
  // the inside of her clothes
  if (!gl_FrontFacing && lorMode != ${HAIR}.0 && lorMode != ${SKIN}.0) diffuseColor.rgb *= 0.55;
#endif
`;

const DRESS_FRAGMENT_NORMAL = /* glsl */ `
if (lorHigh != 0.0) normal = lorBump(normal, vViewPosition, lorHigh);
`;

// Her own colours, as bright as the day is (uLight): full where the sun is on her, a shade darker and cooler where she
// is turned from it or stands in a shadow — softly from the one to the other, round her; a little darker again where
// a surface is turned down, away from the sky (under her chin, under a lock, under a sleeve); and a rim of light
// where a surface turns away from the eye.
const DRESS_FRAGMENT_LIGHT = /* glsl */ `
{
  float ndl = 0.0;
  #if NUM_DIR_LIGHTS > 0
    ndl = dot(normal, directionalLights[0].direction);
  #endif
  float open = 1.0;
  #if defined(USE_SHADOWMAP) && NUM_DIR_LIGHT_SHADOWS > 0
    open = getShadow(directionalShadowMap[0], directionalLightShadows[0].shadowMapSize, directionalLightShadows[0].shadowIntensity, directionalLightShadows[0].shadowBias, directionalLightShadows[0].shadowRadius, vDirectionalShadowCoord[0]);
  #endif
  float soft = lorMode == ${SKIN}.0 ? 1.0 : 0.0;
  float sunny = smoothstep(-0.5, 0.8, ndl) * open * uSun;
  float sky = 0.5 + 0.5 * dot(normal, normalize((viewMatrix * vec4(0.0, 1.0, 0.0, 0.0)).xyz));
  vec3 shade = mix(vec3(0.76, 0.715, 0.78), vec3(0.89, 0.8, 0.82), soft);
  vec3 lit = diffuseColor.rgb * uLight * mix(shade, vec3(1.05), sunny) * mix(mix(0.8, 0.9, soft), 1.0, smoothstep(0.0, 0.7, sky));
  float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
  lit += diffuseColor.rgb * uLight * rim * mix(0.24, 0.14, soft) * (0.35 + 0.65 * sunny);
  outgoingLight = lit;
}
#include <envmap_fragment>
`;

/** Makes a material hers: lit as she is, and drawing what the vertices ask for (`defines`: LORELEI_TEX for her body, LORELEI_FACE for her head). */
function dress(material, uniforms, defines) {
  material.defines = { ...(material.defines || {}), ...defines };
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader =
      DRESS_VERTEX_HEAD +
      shader.vertexShader
        .replace('#include <begin_vertex>', '#include <begin_vertex>\n#ifdef LORELEI_TEX\n  vTex = aTex;\n#endif\n#ifdef LORELEI_FACE\n  vFace = aFace;\n#endif')
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>\n${DRESS_VERTEX_SHADOW}`);
    shader.fragmentShader =
      DRESS_FRAGMENT_HEAD +
      shader.fragmentShader
        .replace('#include <color_fragment>', `#include <color_fragment>\n${DRESS_FRAGMENT_COLOR}`)
        .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>\n${DRESS_FRAGMENT_NORMAL}`)
        .replace('#include <envmap_fragment>', DRESS_FRAGMENT_LIGHT);
  };
  return material;
}

// ------------------------------------------------------------------ the mesh

/** Collects the vertices of one skinned mesh: position, colour, bone weights, and what the shader is to draw there (aTex). */
class Skin {
  constructor(boneIndex) {
    this.boneIndex = boneIndex;
    this.pos = [];
    this.col = [];
    this.tex = [];
    this.idx = [];
    this.skinI = [];
    this.skinW = [];
    this.count = 0;
  }

  /** Bone weights as a vertex has them — its four heaviest, made to add up to one: [index × 4, weight × 4]. */
  slots(weights) {
    const top = Object.entries(weights)
      .filter(([, w]) => w > 0.001)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);
    const sum = top.reduce((s, [, w]) => s + w, 0) || 1;
    const out = [0, 0, 0, 0, 0, 0, 0, 0];
    top.forEach(([name, w], k) => {
      if (!(name in this.boneIndex)) throw new Error(`lorelei: no bone "${name}"`);
      out[k] = this.boneIndex[name];
      out[4 + k] = w / sum;
    });
    return out;
  }

  vert(p, color, slots, tex) {
    this.pos.push(p.x, p.y, p.z);
    this.col.push(color.r, color.g, color.b);
    this.skinI.push(slots[0], slots[1], slots[2], slots[3]);
    this.skinW.push(slots[4], slots[5], slots[6], slots[7]);
    this.tex.push(tex[0], tex[1], tex[2], tex[3]);
    return this.count++;
  }

  /**
   * Sweeps rings along a path, as the foxes' coats are made (rig.js). Each key: { c, rx, ry, ryB?, w, up? } —
   * centre, half-width along `side`, half-height towards "up" (ry) and "down" (ryB), bone weights. With `side` = X
   * and a path that leads downwards, "up" is forward: rx is the half-width, ry the depth in front, ryB behind.
   * A key's `up` says which way "up" is there, where one `side` will not do for the whole path (a lock laid round
   * her head). Keys are joined by a spline, `sub` rings to a key (a number, or a function of the key).
   *
   * `n` squares the rings off (2 = an ellipse; `nB`: their lower halves, where that differs); `angles` says where
   * on the ring its vertices are, where they are not to be spread evenly; `arc: [from, to]` sweeps only part of
   * each ring (an open sheet: a cardigan); `open` leaves the ends without a cap; `frame: { t, u, s }` keeps every
   * ring level instead of square to the path; `warp(P, info)` may move a vertex out of its ring. `color(info)` is
   * asked for every vertex: info = { v, len, s, c, a, P, ring, r, j } with v = 0…1 along the path (by keys), len =
   * how far along it, a = the angle round it, s / c its sine / cosine, r / j which ring and which vertex of it.
   * `mode` is what the shader draws there (PLAIN, CHECK, HAIR…), `tz(info)` its third number — or `tex(info, out)`
   * writes all three. Returns { base, per, R, rings } — vertex (r, j) is base + r * per + j.
   */
  loft(keys, o) {
    const segs = o.segs || 12;
    const side0 = o.side || X_AXIS;
    const arc = o.arc || null;
    const n = keys.length;
    const pw = 2 / (o.n || 2);
    const pwB = 2 / (o.nB || o.n || 2);
    const mode = o.mode || PLAIN;
    keys.forEach((k) => {
      if (k.ryB == null) k.ryB = k.ry;
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
        w,
        up: b.up && c.up ? b.up.clone().lerp(c.up, f).normalize() : null,
        v: (i + f) / (n - 1),
        len: 0,
      };
    };
    const rings = [];
    for (let i = 0; i < n - 1; i++) {
      const sub = typeof o.sub === 'function' ? o.sub(i) : o.sub || 3;
      for (let k = 0; k < sub; k++) rings.push(ringAt(i, k / sub));
    }
    rings.push(ringAt(n - 2, 1));

    const angles = o.angles || Array.from({ length: arc ? segs + 1 : segs }, (_, j) => (arc ? lerp(arc[0], arc[1], j / segs) : (j / segs) * TAU));
    const per = angles.length;
    const R = rings.length;
    const base = this.count;
    const t = V();
    const u = V();
    const s = V();
    const P = V();
    const info = { v: 0, len: 0, s: 0, c: 0, a: 0, P, ring: null, r: 0, j: 0 };
    const tex = [0, 0, 0, mode];
    for (let r = 0; r < R; r++) {
      const ring = rings[r];
      if (r) ring.len = rings[r - 1].len + ring.c.distanceTo(rings[r - 1].c);
      if (o.frame) {
        t.copy(o.frame.t);
        u.copy(o.frame.u);
        s.copy(o.frame.s);
      } else {
        t.copy(rings[Math.min(R - 1, r + 1)].c).sub(rings[Math.max(0, r - 1)].c).normalize();
        if (ring.up) u.copy(ring.up).addScaledVector(t, -t.dot(ring.up)).normalize();
        else u.crossVectors(t, side0).normalize();
        s.crossVectors(u, t).normalize();
      }
      ring.t = t.clone();
      ring.u = u.clone();
      ring.s = s.clone();
      ring.slots = this.slots(ring.w);
      const thick = mode === HAIR ? Math.sqrt((ring.rx * (ring.ry + ring.ryB)) / 2) : 1;
      for (let j = 0; j < per; j++) {
        const a = angles[j];
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const q = sa >= 0 ? pw : pwB;
        P.copy(ring.c)
          .addScaledVector(s, ring.rx * Math.sign(ca) * Math.abs(ca) ** q)
          .addScaledVector(u, (sa >= 0 ? ring.ry : ring.ryB) * Math.sign(sa) * Math.abs(sa) ** q);
        info.v = ring.v;
        info.len = ring.len;
        info.s = sa;
        info.c = ca;
        info.a = a;
        info.ring = ring;
        info.r = r;
        info.j = j;
        if (o.warp) o.warp(P, info);
        const color = o.color(info);
        if (o.tex) o.tex(info, tex);
        else {
          tex[0] = ca * thick;
          tex[1] = sa * thick;
          tex[2] = o.tz ? o.tz(info) : ring.v;
        }
        this.vert(P, color, ring.slots, tex);
      }
    }
    for (let r = 0; r < R - 1; r++) {
      for (let j = 0; j < (arc ? per - 1 : per); j++) {
        const a = base + r * per + j;
        const b = base + r * per + ((j + 1) % per);
        this.idx.push(a, b, a + per, b, b + per, a + per);
      }
    }
    const made = { base, per, R, rings };
    if (arc || o.open) return made;
    // close both ends with a small fan
    const cap = (r, dir, k) => {
      const ring = rings[r];
      const first = base + r * per;
      const avg = new THREE.Color(0, 0, 0);
      for (let j = 0; j < per; j++) {
        avg.r += this.col[(first + j) * 3] / per;
        avg.g += this.col[(first + j) * 3 + 1] / per;
        avg.b += this.col[(first + j) * 3 + 2] / per;
      }
      // (the middle of the ring as it came out — a warp may have moved it)
      P.set(0, 0, 0);
      for (let j = 0; j < per; j++) {
        P.x += this.pos[(first + j) * 3] / per;
        P.y += this.pos[(first + j) * 3 + 1] / per;
        P.z += this.pos[(first + j) * 3 + 2] / per;
      }
      P.addScaledVector(ring.t, dir * Math.max(ring.rx, ring.ry) * k);
      const centre = this.vert(P, avg, ring.slots, [0, 0, this.tex[first * 4 + 2], mode]);
      for (let j = 0; j < per; j++) {
        const a = first + j;
        const b = first + ((j + 1) % per);
        if (dir < 0) this.idx.push(centre, b, a);
        else this.idx.push(centre, a, b);
      }
    };
    const k = o.cap == null ? 0.55 : o.cap;
    cap(0, -1, o.capTop == null ? k : o.capTop);
    cap(R - 1, 1, k);
    return made;
  }

  /**
   * A lock of hair: a loft through `pts`, `wide[i]` across and `thin` (one number, or one a point) through, drawn
   * out to a point. `w`: bone weights, or a function of how far along it is (0 … 1); `ups`: which way each point's
   * flat side faces; `under`: how much of its thickness is on the side turned from that (lying on her head: little).
   */
  lock(pts, wide, thin, o) {
    const m = pts.length;
    return this.loft(
      pts.map((p, i) => {
        const ry = Math.max(0.001, Math.min((Array.isArray(thin) ? thin[i] : thin) / 2, wide[i] * 0.5));
        return { c: p, rx: Math.max(0.0012, wide[i] / 2), ry, ryB: ry * (o.under == null ? 1 : o.under), w: typeof o.w === 'function' ? o.w(i / (m - 1), i) : o.w, up: o.ups ? o.ups[i] : null };
      }),
      { segs: o.segs || 10, sub: o.sub || 4, side: o.side || X_AXIS, color: o.color, cap: o.cap == null ? 0.6 : o.cap, capTop: o.capTop, mode: HAIR, n: o.n, warp: o.warp, tz: (i) => (o.seed || 0) + i.len * 30 }
    );
  }

  /**
   * A sheet of nu × nv vertices, all on the bones `w`: `at(iu, iv, out)` gives vertex (iu, iv) its place (out.P), its
   * colour (out.color) and what the shader draws there (out.tex: its first three numbers). It faces the way that has
   * iu running to the left and iv downwards.
   */
  patch(nu, nv, w, mode, at) {
    const base = this.count;
    const slots = this.slots(w);
    const out = { P: V(), color: new THREE.Color(), tex: [0, 0, 0, mode] };
    for (let iv = 0; iv < nv; iv++) {
      for (let iu = 0; iu < nu; iu++) {
        at(iu, iv, out);
        this.vert(out.P, out.color, slots, out.tex);
      }
    }
    for (let iv = 0; iv < nv - 1; iv++) {
      for (let iu = 0; iu < nu - 1; iu++) {
        const a = base + iv * nu + iu;
        this.idx.push(a, a + nu, a + 1, a + 1, a + nu, a + nu + 1);
      }
    }
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(this.skinI, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(this.skinW, 4));
    g.setAttribute('aTex', new THREE.Float32BufferAttribute(this.tex, 4));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    return g;
  }
}

// rings that stay level, whatever the path through their middles does
const LEVEL = { t: V(0, -1, 0), u: V(0, 0, 1), s: V(1, 0, 0) };

/**
 * A body of level rings one above the other — her head, the cap of her hair. `rows`, from the top down:
 * [height, half-width, depth in front, depth behind, how far forward its middle is], about `at`; `n` squares the rings
 * off in front, `nB` behind. It can be made into a mesh (keys, for a loft with `frame: LEVEL`) and asked where its
 * surface is.
 */
class Rings {
  constructor(rows, at, n = 2, nB = n) {
    this.rows = rows;
    this.at = at;
    this.n = n;
    this.nB = nB;
  }

  keys(w) {
    return this.rows.map(([y, rx, rf, rb, z]) => ({ c: V(this.at.x, this.at.y + y, this.at.z + z), rx, ry: rf, ryB: rb, w }));
  }

  /** The ring at the height y: { rx, rf, rb, zc } — or null, above the top and below the bottom. */
  ring(y) {
    const rows = this.rows;
    const yy = y - this.at.y;
    const last = rows.length - 1;
    if (yy > rows[0][0] || yy < rows[last][0]) return null;
    let i = 0;
    while (i < last - 1 && rows[i + 1][0] > yy) i++;
    const val = (k, f) => catmull(rows[Math.max(0, i - 1)][k], rows[i][k], rows[i + 1][k], rows[Math.min(last, i + 2)][k], f);
    // (the rings of the mesh are evenly spaced between two rows, not evenly high: find how far between them y is)
    let lo = 0;
    let hi = 1;
    for (let k = 0; k < 18; k++) {
      const mid = (lo + hi) / 2;
      if (val(0, mid) > yy) lo = mid;
      else hi = mid;
    }
    const f = (lo + hi) / 2;
    return { rx: Math.max(0.0004, val(1, f)), rf: Math.max(0.0004, val(2, f)), rb: Math.max(0.0004, val(3, f)), zc: this.at.z + val(4, f) };
  }

  inside(x, y, z) {
    const r = this.ring(y);
    if (!r) return false;
    const n = z >= r.zc ? this.n : this.nB;
    return (Math.abs(x - this.at.x) / r.rx) ** n + (Math.abs(z - r.zc) / (z >= r.zc ? r.rf : r.rb)) ** n <= 1;
  }

  /** How far from `from` (a point inside) the surface is, going the way of `dir`. */
  reach(from, dir) {
    let lo = 0;
    let hi = 0.4;
    for (let k = 0; k < 22; k++) {
      const mid = (lo + hi) / 2;
      if (this.inside(from.x + dir.x * mid, from.y + dir.y * mid, from.z + dir.z * mid)) lo = mid;
      else hi = mid;
    }
    return lo;
  }
}

// ------------------------------------------------------------------ her face

// The middle of her head is 0.856 up; what is where in it is given from there. The painting of her face covers it from
// temple to temple, and from under her chin up to her brow.
const HEAD_Y = 0.856;
const FACE = { half: 0.1, top: 0.03, bottom: -0.125 };
const FACE_PX = 512; // across (it is as much higher as the face is)
// Where things are in her face — measured off the picture of her from in front: her eyes a third of her face wide
// each, far apart, as high as they are wide but for a quarter; each iris turned a little to her nose; her brows thin
// and a little lower at their inner ends; a small mouth, low.
const EYE = { x: 0.053, y: -0.0272, w: 0.0264, up: 0.0164, down: 0.019, iris: 0.0178, turn: 0.009 }; // its middle; half its width; how far the lids are from the middle; the iris
const MOUTH = { x: 0.0015, y: -0.0842 };
const NOSE_Y = -0.0552;

/** A point of a curve with two handles (p0 … p3: [x, y]) at t. */
const curve = (p0, p1, p2, p3, t) => {
  const u = 1 - t;
  return [u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]];
};

/**
 * Her face, painted as it is in the picture: `eyes` = 'open', 'half' (a blink on its way), 'closed' or 'happy' (shut
 * in a smile); `mouth` = 'flat' (as she is there: small, a little parted), 'smile', 'open' or 'o'. On skin of her
 * own colour: the shader takes what differs from that (dress).
 */
function paintFace(eyes, mouth, blush) {
  const canvas = document.createElement('canvas');
  const k = FACE_PX / (2 * FACE.half); // pixels to a unit, the same both ways
  canvas.width = FACE_PX;
  canvas.height = Math.round((FACE.top - FACE.bottom) * k);
  const g = canvas.getContext('2d');
  const X = (x) => (x + FACE.half) * k; //  (her left is on the right of the painting: that is how she is seen from in front)
  const Y = (y) => (FACE.top - y) * k;
  g.fillStyle = INK.skin;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const soft = (x, y, rx, ry, rgb, alpha) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.save();
    g.translate(X(x), Y(y));
    g.scale(rx * k, ry * k);
    g.fillStyle = grad;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  };

  // the shadow of her fringe on her brow; a flush on her cheeks; the shade under her nose and her lip
  const shade = g.createLinearGradient(0, Y(FACE.top), 0, Y(-0.006));
  shade.addColorStop(0, 'rgba(238, 198, 186, 0.36)');
  shade.addColorStop(1, 'rgba(238, 198, 186, 0)');
  g.fillStyle = shade;
  g.fillRect(0, 0, canvas.width, Y(-0.006));
  for (const sg of [-1, 1]) soft(sg * 0.058, -0.066, 0.03, 0.016, '255, 150, 150', 0.2 + 0.34 * blush);
  soft(-0.0015, NOSE_Y - 0.005, 0.0075, 0.0042, '224, 172, 158', 0.5);
  soft(MOUTH.x, MOUTH.y - 0.009, 0.009, 0.0035, '226, 160, 146', 0.35);

  const lash = '#84695f';
  const { w, up, down } = EYE;
  for (const sg of [-1, 1]) {
    // in the eye's own measure: dx > 0 = towards her temple, dy > 0 = up
    const P = ([dx, dy]) => [X(sg * (EYE.x + dx)), Y(EYE.y + dy)];
    const to = (pt) => g.lineTo(...P(pt));
    const poly = (pts) => {
      g.beginPath();
      g.moveTo(...P(pts[0]));
      pts.forEach(to);
      g.closePath();
    };
    const inner = [-w, -0.0015];
    const outer = [w, 0.003];

    if (eyes === 'closed' || eyes === 'happy') {
      // shut: one bold line that hangs (asleep, a blink) or arches (a smile), heavier towards her temple, two lashes at its end
      const mid = eyes === 'happy' ? up * 0.62 : -down * 0.6;
      const a = eyes === 'happy' ? [-w, -0.005] : [-w, -0.003];
      const b = eyes === 'happy' ? [w, -0.006] : [w, -0.001];
      const line = [];
      for (let i = 0; i <= 24; i++) line.push(curve(a, [-0.45 * w, mid * 1.32], [0.5 * w, mid * 1.32], b, i / 24));
      const thick = (i) => 0.0022 + 0.003 * smooth(0, 16, i);
      const dir = eyes === 'happy' ? 1 : -1;
      const band = line.slice();
      for (let i = 24; i >= 0; i--) band.push([line[i][0], line[i][1] + dir * thick(i)]);
      g.fillStyle = lash;
      poly(band);
      g.fill();
      poly([b, [b[0] + 0.0055, b[1] + dir * 0.0052], [b[0] - 0.003, b[1] + dir * 0.005]]);
      g.fill();
      poly([line[20], [line[20][0] + 0.0052, line[20][1] + dir * 0.0088], [line[17][0], line[17][1] + dir * 0.004]]);
      g.fill();
      continue;
    }

    const open = eyes === 'half' ? 0.42 : 1;
    const lid = up * open - (1 - open) * 0.002;
    // the upper lid: steep at the inner corner, a broad arch over the eye, down round the outer corner
    const top = [0.02 * w, lid];
    const upper = [];
    for (let i = 0; i <= 16; i++) upper.push(curve(inner, [-0.96 * w, lid * 0.5], [-0.56 * w, lid], top, i / 16));
    for (let i = 1; i <= 16; i++) upper.push(curve(top, [0.52 * w, lid], [0.94 * w, lid * 0.82 + 0.002], outer, i / 16));
    // …and the lower one: a bowl, deepest under the middle
    const low = [0.06 * w, -down];
    const lower = [];
    for (let i = 0; i <= 16; i++) lower.push(curve(outer, [1.0 * w, -down * 0.62], [0.62 * w, -down], low, i / 16));
    for (let i = 1; i <= 16; i++) lower.push(curve(low, [-0.5 * w, -down], [-0.93 * w, -down * 0.5], inner, i / 16));

    g.save();
    poly([...upper, ...lower]);
    g.clip();
    // the white of it
    g.fillStyle = '#eadcd6';
    g.fillRect(X(sg * EYE.x) - 1.4 * w * k, Y(EYE.y + 0.03), 2.8 * w * k, 0.06 * k);
    // the iris: large, a dusky brown — dark under the lid, lighter and rosier below — turned a little to her nose
    const ix = X(sg * (EYE.x - EYE.turn));
    const iy = Y(EYE.y - 0.0012);
    const ir = EYE.iris * k;
    const iris = g.createLinearGradient(0, iy - ir, 0, iy + ir);
    iris.addColorStop(0, '#75605d');
    iris.addColorStop(0.32, '#816865');
    iris.addColorStop(0.6, '#9d817c');
    iris.addColorStop(0.84, '#b49690');
    iris.addColorStop(1, '#c4aaa3');
    g.fillStyle = iris;
    g.beginPath();
    g.arc(ix, iy, ir, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(96, 72, 72, 0.5)';
    g.lineWidth = 0.0018 * k;
    g.beginPath();
    g.arc(ix, iy, ir - 0.0009 * k, 0, TAU);
    g.stroke();
    // (the light that comes through it at the bottom: soft, no edge to it)
    const glow = g.createRadialGradient(ix, iy + ir * 0.7, 0, ix, iy + ir * 0.7, ir * 0.8);
    glow.addColorStop(0, 'rgba(236, 190, 178, 0.6)');
    glow.addColorStop(1, 'rgba(236, 190, 178, 0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(ix, iy, ir, 0, TAU);
    g.fill();
    // the pupil
    g.fillStyle = '#5c4846';
    g.beginPath();
    g.arc(ix, iy - ir * 0.04, ir * 0.53, 0, TAU);
    g.fill();
    // the shade of the lid and its lashes on the eye
    const under = g.createLinearGradient(0, Y(EYE.y + lid), 0, Y(EYE.y + lid - 0.012));
    under.addColorStop(0, 'rgba(104, 78, 78, 0.5)');
    under.addColorStop(1, 'rgba(104, 78, 78, 0)');
    g.fillStyle = under;
    g.fillRect(X(sg * EYE.x) - 1.4 * w * k, Y(EYE.y + lid), 2.8 * w * k, 0.012 * k);
    // the lights in it (on the same side in both eyes: the light comes from one place)
    g.fillStyle = 'rgba(255, 252, 248, 0.8)';
    g.beginPath();
    g.arc(ix - ir * 0.36, iy - ir * 0.38, ir * 0.115, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255, 252, 248, 0.4)';
    g.beginPath();
    g.arc(ix + ir * 0.4, iy + ir * 0.44, ir * 0.055, 0, TAU);
    g.fill();
    g.restore();

    // the upper lashes: one bold band, thin at the inner corner, heavy where it comes down round the outer one — and out past it
    const thick = (i) => (0.002 + 0.0036 * smooth(0, 11, i) + 0.0026 * smooth(18, 32, i)) * (0.55 + 0.45 * open);
    const band = upper.slice();
    band.push(lower[3], [w * 1.07, lower[3][1] + 0.002], [w * 1.25, outer[1] + 0.0045 * open]);
    for (let i = upper.length - 1; i >= 0; i--) {
      const lean = smooth(21, 32, i); // (outwards from the lid: up, and at the outer end out to the side as well)
      band.push([upper[i][0] + thick(i) * 1.2 * lean, upper[i][1] + thick(i) * (1 - 0.35 * lean)]);
    }
    g.fillStyle = lash;
    poly(band);
    g.fill();
    // (two lashes that stand out of it)
    poly([[w * 0.97, lid * 0.72 + 0.003], [w * 1.2, lid * 0.72 + 0.0105 * open], [w * 1.1, lid * 0.45 + 0.004]]);
    g.fill();
    poly([[w * 0.78, lid * 0.9 + 0.003], [w * 0.98, lid * 0.9 + 0.0098 * open], [w * 0.93, lid * 0.8 + 0.003]]);
    g.fill();
    // …and the lower lid: a hint of a line, firmer towards the outer corner
    g.strokeStyle = 'rgba(170, 128, 116, 0.32)';
    g.lineWidth = 0.0012 * k;
    g.beginPath();
    g.moveTo(...P(lower[4]));
    for (let i = 5; i <= 26; i++) to(lower[i]);
    g.stroke();
    g.strokeStyle = 'rgba(132, 105, 95, 0.6)';
    g.lineWidth = 0.0018 * k;
    g.beginPath();
    g.moveTo(...P(lower[2]));
    for (let i = 3; i <= 8; i++) to(lower[i]);
    g.stroke();
  }

  // her eyebrows: thin, fair brown, a little lower towards her nose (they show between the locks of her fringe)
  g.fillStyle = 'rgba(166, 124, 100, 0.9)';
  const lift = eyes === 'happy' ? 0.003 : 0;
  for (const sg of [-1, 1]) {
    const a = [0.025, 0.0072 + lift];
    const b = [0.069, 0.0152 + lift];
    const mid = [0.048, 0.0138 + lift];
    g.beginPath();
    g.moveTo(X(sg * a[0]), Y(a[1] + 0.002));
    g.quadraticCurveTo(X(sg * mid[0]), Y(mid[1] + 0.0025), X(sg * b[0]), Y(b[1] + 0.0007));
    g.lineTo(X(sg * b[0]), Y(b[1] - 0.0007));
    g.quadraticCurveTo(X(sg * mid[0]), Y(mid[1] - 0.0018), X(sg * a[0]), Y(a[1] - 0.002));
    g.closePath();
    g.fill();
  }

  // her mouth: small; as she is in the picture, a little parted
  const mx = MOUTH.x;
  const my = MOUTH.y;
  const lip = '#c98f8a';
  g.strokeStyle = lip;
  if (mouth === 'open' || mouth === 'o') {
    const wide = mouth === 'o' ? 0.0062 : 0.0135;
    g.fillStyle = '#9a4650';
    g.beginPath();
    if (mouth === 'o') g.ellipse(X(mx), Y(my - 0.003), wide * k, 0.0075 * k, 0, 0, TAU);
    else {
      g.moveTo(X(mx - wide), Y(my + 0.0035));
      g.quadraticCurveTo(X(mx), Y(my + 0.0055), X(mx + wide), Y(my + 0.0035));
      g.quadraticCurveTo(X(mx), Y(my - 0.026), X(mx - wide), Y(my + 0.0035));
    }
    g.fill();
    g.fillStyle = '#f0949a';
    g.beginPath();
    g.ellipse(X(mx), Y(my - (mouth === 'o' ? 0.0068 : 0.0108)), wide * 0.5 * k, 0.0034 * k, 0, 0, TAU);
    g.fill();
    g.lineWidth = 0.0018 * k;
    g.beginPath();
    if (mouth === 'o') g.ellipse(X(mx), Y(my - 0.003), wide * k, 0.0075 * k, 0, 0, TAU);
    else {
      g.moveTo(X(mx - wide), Y(my + 0.0035));
      g.quadraticCurveTo(X(mx), Y(my + 0.0055), X(mx + wide), Y(my + 0.0035));
    }
    g.stroke();
  } else if (mouth === 'smile') {
    g.lineWidth = 0.002 * k;
    g.beginPath();
    g.moveTo(X(mx - 0.0125), Y(my + 0.0022));
    g.quadraticCurveTo(X(mx), Y(my - 0.0075), X(mx + 0.0125), Y(my + 0.0022));
    g.stroke();
    soft(mx, my - 0.0062, 0.0062, 0.0026, '240, 150, 152', 0.75);
  } else {
    // the lower lip, rosy; the line between her lips, with the dip of the upper one in its middle; a little dark where they part
    soft(mx, my - 0.003, 0.0072, 0.004, '240, 156, 156', 0.9);
    g.fillStyle = 'rgba(176, 108, 106, 0.8)';
    g.beginPath();
    g.ellipse(X(mx + 0.0008), Y(my - 0.0005), 0.003 * k, 0.001 * k, 0, 0, TAU);
    g.fill();
    g.lineWidth = 0.0014 * k;
    g.beginPath();
    g.moveTo(X(mx - 0.0074), Y(my - 0.0002));
    g.bezierCurveTo(X(mx - 0.004), Y(my + 0.0016), X(mx - 0.0015), Y(my + 0.0012), X(mx), Y(my + 0.0003));
    g.bezierCurveTo(X(mx + 0.0015), Y(my + 0.0012), X(mx + 0.004), Y(my + 0.0016), X(mx + 0.0074), Y(my - 0.0002));
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ------------------------------------------------------------------ Lorelei

// Her head — [height, half-width, depth in front, depth behind, how far forward its middle is], about (0, HEAD_Y, 0):
// widest at her eyes and not much less at her cheeks, rounding in to a small chin; the skull above is all under her hair.
// Her face is flat across, from one cheek to the other, and turns back only at her temples (HEAD_N squares the rings
// off in front; behind they are round).
const HEAD = [
  [0.116, 0.012, 0.012, 0.012, -0.006],
  [0.106, 0.047, 0.046, 0.051, -0.006],
  [0.084, 0.0735, 0.073, 0.0815, -0.006],
  [0.051, 0.089, 0.09, 0.1, -0.005],
  [0.012, 0.094, 0.0985, 0.106, -0.004],
  [-0.022, 0.0925, 0.1, 0.104, -0.003],
  [-0.046, 0.0895, 0.0995, 0.09, -0.002],
  [-0.066, 0.083, 0.0975, 0.072, 0],
  [-0.084, 0.071, 0.092, 0.052, 0.002],
  [-0.099, 0.053, 0.083, 0.038, 0.005],
  [-0.11, 0.0335, 0.068, 0.0345, 0.009],
  [-0.1165, 0.014, 0.046, 0.016, 0.018],
];
const HEAD_N = 4.4;
const HEAD_NB = 2.25;
// …and the cap of her hair: a ball a good deal larger than her head — all round the crown, then only behind her ears
// (in front it stops under her fringe), and in under itself at the nape.
const CAP = [
  [0.138, 0.014, 0.014, 0.014, -0.004],
  [0.13, 0.056, 0.054, 0.058, -0.004],
  [0.11, 0.09, 0.087, 0.094, -0.004],
  [0.078, 0.108, 0.1, 0.113, -0.004],
  [0.04, 0.116, 0.088, 0.118, -0.006],
  [0.008, 0.119, 0.05, 0.11, -0.016],
  [-0.022, 0.119, 0.012, 0.09, -0.036],
  [-0.052, 0.109, 0.006, 0.064, -0.046],
  [-0.076, 0.092, 0.006, 0.033, -0.046],
  [-0.096, 0.064, 0.006, 0.012, -0.04],
];
const CAP_N = 2.12;
// Her tail of hair: tied high at the back of her head, on the left; up and out of the tie, over, and down behind her
// left shoulder to her hip — [x, y, z, half its width, half its depth] along its middle.
const TAIL = [
  [0.045, 0.905, -0.07, 0.03, 0.03],
  [0.072, 0.928, -0.1, 0.04, 0.036],
  [0.098, 0.936, -0.13, 0.056, 0.042],
  [0.124, 0.916, -0.148, 0.072, 0.05],
  [0.14, 0.865, -0.158, 0.088, 0.064],
  [0.143, 0.78, -0.162, 0.098, 0.066],
  [0.144, 0.69, -0.146, 0.1, 0.066],
  [0.15, 0.605, -0.13, 0.09, 0.046],
  [0.164, 0.53, -0.122, 0.072, 0.034],
  [0.184, 0.46, -0.128, 0.05, 0.022],
  [0.178, 0.41, -0.138, 0.026, 0.012],
  [0.167, 0.375, -0.14, 0.004, 0.004],
];
const TAIL_BONES = [1.6, 3.6, 5.2, 6.8, 8.6]; // where along it (in rows) it bends

/**
 * Builds her. Returns the rig her animator drives:
 * { group, bones, skeleton, mesh, head, face, tail, dims, light, scale, umbrella, bag, dispose() }.
 */
export function buildLorelei() {
  const ink = {};
  for (const k in INK) ink[k] = new THREE.Color(INK[k]);
  const col = new THREE.Color();

  // ---- joints (model space)
  const J = {
    root: V(0, 0, 0),
    hips: V(0, 0.39, 0),
    spine: V(0, 0.485, 0),
    chest: V(0, 0.585, 0),
    neck: V(0, 0.698, -0.002),
    head: V(0, 0.742, 0),
  };
  const armJ = (sg) => ({ arm: V(sg * 0.094, 0.67, -0.004), fore: V(sg * 0.1063, 0.5476, -0.002), hand: V(sg * 0.1181, 0.4302, 0.003) });
  const legJ = (sg) => ({ thigh: V(sg * 0.051, 0.365, 0.002), shin: V(sg * 0.0565, 0.23, -0.008), foot: V(sg * 0.063, 0.042, -0.028) });
  // the tail's path: its middle at each row, and which way "across" (s) and "in front" (u) are there
  const tailRows = TAIL.map(([x, y, z, hw, hd]) => ({ p: V(x, y, z), hw, hd }));
  tailRows.forEach((row, k) => {
    row.t = tailRows[Math.min(TAIL.length - 1, k + 1)].p.clone().sub(tailRows[Math.max(0, k - 1)].p).normalize();
    row.u = V().crossVectors(row.t, X_AXIS).normalize();
    row.s = V().crossVectors(row.u, row.t).normalize();
  });
  const tailAt = (k) => {
    const i = clamp(Math.floor(k), 0, TAIL.length - 2);
    const f = clamp(k - i, 0, 1);
    const a = tailRows[i];
    const b = tailRows[i + 1];
    return { p: a.p.clone().lerp(b.p, f), u: a.u.clone().lerp(b.u, f).normalize(), s: a.s.clone().lerp(b.s, f).normalize(), hw: lerp(a.hw, b.hw, f), hd: lerp(a.hd, b.hd, f) };
  };

  // ---- bones
  const bones = {};
  const boneIndex = {};
  const list = [];
  const addBone = (name, parent, model) => {
    const b = new THREE.Bone();
    b.name = name;
    b.userData.model = model.clone();
    if (parent) b.position.copy(model).sub(bones[parent].userData.model);
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
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1;
    const a = armJ(sg);
    const l = legJ(sg);
    addBone(`arm${side}`, 'chest', a.arm);
    addBone(`fore${side}`, `arm${side}`, a.fore);
    addBone(`hand${side}`, `fore${side}`, a.hand);
    addBone(`thigh${side}`, 'hips', l.thigh);
    addBone(`shin${side}`, `thigh${side}`, l.shin);
    addBone(`foot${side}`, `shin${side}`, l.foot);
  }
  const tail = TAIL_BONES.map((k, i) => addBone(`pony${i}`, i ? `pony${i - 1}` : 'head', tailAt(k).p).name);
  addBone('lockL', 'head', V(0.102, 0.838, 0.022));
  addBone('lockR', 'head', V(-0.102, 0.834, 0.022));
  /** The bones a point of the tail goes with, `k` rows along it: her head as far as the tie, then each bone from where it bends. */
  const tailW = (k) => {
    const f = TAIL_BONES.map((at) => smooth(at - 0.7, at + 0.9, k));
    const w = { head: 1 - f[0] };
    f.forEach((v, i) => (w[`pony${i}`] = v - (f[i + 1] || 0)));
    return w;
  };

  // ---- the mesh
  const skin = new Skin(boneIndex);

  // her neck
  skin.loft(
    [
      { c: V(0, 0.762, 0.003), rx: 0.027, ry: 0.027, w: { head: 1 } },
      { c: V(0, 0.738, 0.001), rx: 0.0262, ry: 0.0262, w: { head: 0.5, neck: 0.5 } },
      { c: V(0, 0.716, -0.002), rx: 0.0268, ry: 0.0265, w: { neck: 1 } },
      { c: V(0, 0.696, -0.003), rx: 0.03, ry: 0.028, w: { neck: 0.4, chest: 0.6 } },
    ],
    // (in the shade of her chin)
    { segs: 16, sub: 3, open: true, mode: SKIN, color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.25 + 0.5 * smooth(0.71, 0.742, i.P.y) * smooth(-0.6, 0.5, i.s)) }
  );
  // her body under the cardigan: her collarbones bare, the brown top down to her waist (and on, in the dark under her skirt)
  const NECKLINE = 9; // which ring of it the neckline of her top is: a round scoop, below her collarbones in front, higher behind and at her shoulders
  skin.loft(
    [
      { c: V(0, 0.718, -0.003), rx: 0.024, ry: 0.024, w: { neck: 1 } },
      { c: V(0, 0.7055, -0.003), rx: 0.045, ry: 0.033, ryB: 0.035, w: { neck: 0.35, chest: 0.65 } },
      { c: V(0, 0.686, -0.002), rx: 0.0695, ry: 0.043, ryB: 0.043, w: { chest: 1 } },
      { c: V(0, 0.65, 0), rx: 0.0675, ry: 0.05, ryB: 0.045, w: { chest: 1 } },
      { c: V(0, 0.595, 0.001), rx: 0.0634, ry: 0.051, ryB: 0.043, w: { chest: 1 } },
      { c: V(0, 0.54, 0.001), rx: 0.059, ry: 0.047, ryB: 0.042, w: { chest: 0.45, spine: 0.55 } },
      { c: V(0, 0.495, 0), rx: 0.061, ry: 0.048, ryB: 0.046, w: { spine: 0.6, hips: 0.4 } },
      { c: V(0, 0.445, 0), rx: 0.066, ry: 0.052, ryB: 0.054, w: { hips: 1 } },
      { c: V(0, 0.408, 0), rx: 0.058, ry: 0.047, ryB: 0.049, w: { hips: 1 } },
    ],
    {
      segs: 40,
      sub: (i) => (i < 2 ? NECKLINE : 3),
      n: 2.15,
      cap: 0.15,
      // (the rings near the neckline dip in front and rise at her shoulders, so that one of them is the neckline)
      warp: (P, i) => (P.y += (0.0056 - 0.0062 * i.s + 0.0074 * Math.cos(2 * i.a)) * Math.max(0, 1 - Math.abs(i.r - NECKLINE) / NECKLINE)),
      color: (i) => {
        if (i.r <= NECKLINE) return col.copy(ink.skin).lerp(ink.skinDeep, 0.3 + 0.3 * smooth(NECKLINE - 4, NECKLINE, i.r));
        col.copy(ink.top).lerp(ink.topDeep, clamp(0.45 * smooth(0.045, 0.064, Math.abs(i.P.x)) + 0.35 * smooth(0.55, 0.49, i.P.y), 0, 1)); // (in the shade of her cardigan at the sides)
        return col.lerp(ink.skirtDeep, smooth(0.47, 0.44, i.P.y));
      },
    }
  );

  // the skirt: short, checked, in pleats that open towards the hem; it swings with her legs
  const pleat = (a) => {
    const f = ((((a / TAU) * CHECKS) % 1) + 1) % 1;
    return f < 0.86 ? f / 0.86 : (1 - f) / 0.14; // out along a pleat, and back in at its fold
  };
  const skirt = skin.loft(
    [
      { c: V(0, 0.512, 0), rx: 0.057, ry: 0.046, ryB: 0.042, w: { spine: 0.6, hips: 0.4 } },
      { c: V(0, 0.497, 0), rx: 0.0645, ry: 0.053, ryB: 0.051, w: { hips: 1 } },
      { c: V(0, 0.458, 0), rx: 0.079, ry: 0.069, ryB: 0.069, w: { hips: 1 } },
      { c: V(0, 0.41, 0.004), rx: 0.093, ry: 0.082, ryB: 0.078, w: { hips: 0.7, thighL: 0.15, thighR: 0.15 } },
      { c: V(0, 0.366, 0.006), rx: 0.102, ry: 0.09, ryB: 0.084, w: { hips: 0.5, thighL: 0.25, thighR: 0.25 } },
    ],
    {
      segs: CHECKS * 6,
      sub: 4,
      open: true,
      mode: CHECK,
      tz: (i) => (0.5 - i.ring.c.y) / 0.034, // (squares as high as they are wide half-way down)
      warp: (P, i) => {
        const d = 0.1 * smooth(0.1, 1, i.v) * (pleat(i.a) - 0.45);
        P.x += (P.x - i.ring.c.x) * d;
        P.z += (P.z - i.ring.c.z) * d;
      },
      // (darker in the folds, and up under her top)
      color: (i) => col.setScalar(1 - 0.3 * smooth(0.5, 0.05, pleat(i.a)) * smooth(0.1, 0.7, i.v) - 0.2 * smooth(0.2, 0, i.v)),
    }
  );
  // (each side of its hem goes with the leg under it)
  for (let k = skirt.base; k < skin.count; k++) {
    const slot = (name) => [0, 1, 2, 3].find((q) => skin.skinW[k * 4 + q] > 0 && skin.skinI[k * 4 + q] === boneIndex[name]);
    const l = slot('thighL');
    const r = slot('thighR');
    if (l == null || r == null) continue;
    const both = skin.skinW[k * 4 + l] + skin.skinW[k * 4 + r];
    skin.skinW[k * 4 + l] = both * smooth(-0.04, 0.04, skin.pos[k * 3]);
    skin.skinW[k * 4 + r] = both - skin.skinW[k * 4 + l];
  }

  // legs: bare from her skirt to her boots (she stands with her feet a little back, and a little apart)
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1;
    const T = `thigh${side}`;
    const Sh = `shin${side}`;
    const F = `foot${side}`;
    skin.loft(
      [
        { c: V(sg * 0.0505, 0.425, 0.004), rx: 0.0365, ry: 0.039, w: { hips: 0.6, [T]: 0.4 } },
        { c: V(sg * 0.0525, 0.36, 0.002), rx: 0.0365, ry: 0.0385, w: { [T]: 1 } },
        { c: V(sg * 0.0548, 0.29, -0.002), rx: 0.034, ry: 0.036, w: { [T]: 1 } },
        { c: V(sg * 0.0565, 0.232, -0.008), rx: 0.0318, ry: 0.034, ryB: 0.0325, w: { [T]: 0.5, [Sh]: 0.5 } },
        { c: V(sg * 0.0582, 0.19, -0.013), rx: 0.03, ry: 0.0315, w: { [Sh]: 1 } },
        { c: V(sg * 0.06, 0.13, -0.019), rx: 0.0275, ry: 0.0295, w: { [Sh]: 1 } },
      ],
      {
        segs: 16,
        sub: 3,
        mode: SKIN,
        // (in the shade of her skirt at the top; a little rosy at the knee)
        color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, clamp(0.75 * smooth(0.335, 0.39, i.P.y) + 0.25 * smooth(0.3, -0.7, i.s) + 0.6 * smooth(0.21, 0.194, i.P.y), 0, 1)).lerp(ink.skinRose, 0.3 * bump(i.P.y, 0.236, 0.02) * smooth(0.2, 0.9, i.s)),
      }
    );

    // her boots: soft and wide, slouching in two folds over the ankle; a round toe; a dark sole
    const bx = (y) => sg * lerp(0.065, 0.0592, y / 0.2); // (where the middle of the boot is at the height y…
    const bz = (y) => lerp(-0.028, -0.0125, smooth(0.06, 0.2, y)); //                              …and how far back)
    const fold = (P, i) => {
      // (no fold runs level, nor is it the same all the way round)
      const y = i.ring.c.y;
      const k = (0.07 * bump(y, 0.1, 0.02) + 0.06 * bump(y, 0.065, 0.016)) * Math.sin(i.a * 2 + sg * 0.8 + y * 30) + 0.03 * bump(y, 0.15, 0.03) * Math.sin(i.a * 3 + sg);
      P.x += (P.x - i.ring.c.x) * k;
      P.z += (P.z - i.ring.c.z) * k;
      P.y += 0.006 * bump(y, 0.085, 0.05) * Math.sin(i.a + 1.2 * sg);
    };
    const leather = (i) => col.copy(ink.boot).lerp(ink.bootDeep, clamp(0.6 * bump(i.ring.c.y, 0.1, 0.011) + 0.5 * bump(i.ring.c.y, 0.065, 0.009) + 0.3 * smooth(0.2, -0.8, i.s), 0, 1)).lerp(ink.sole, smooth(0.015, 0.008, i.P.y));
    const shaft = (rows, w) => rows.map(([y, rx, ry, ryB], k) => ({ c: V(bx(y), y, bz(y)), rx, ry, ryB: ryB || ry, w: w(y, k) }));
    // (its rim, and the dark inside it round her leg)
    skin.loft(shaft([[0.197, 0.043, 0.0445], [0.1958, 0.039, 0.0405], [0.189, 0.0345, 0.036], [0.169, 0.03, 0.032]], () => ({ [Sh]: 1 })), {
      segs: 18,
      sub: 2,
      open: true,
      color: (i) => col.copy(ink.boot).lerp(ink.sole, smooth(0.05, 0.5, i.v)),
    });
    skin.loft(
      shaft(
        [
          [0.197, 0.043, 0.0445],
          [0.182, 0.045, 0.0468],
          [0.148, 0.0445, 0.046],
          [0.118, 0.046, 0.0476],
          [0.1, 0.043, 0.0446],
          [0.083, 0.047, 0.05, 0.048],
          [0.065, 0.0445, 0.0485, 0.046],
          [0.043, 0.0475, 0.052, 0.048],
          [0.016, 0.0478, 0.052, 0.048],
          [0.003, 0.0445, 0.048, 0.045],
        ],
        (y) => ({ [Sh]: smooth(0.045, 0.095, y), [F]: 1 - smooth(0.045, 0.095, y) })
      ),
      { segs: 20, sub: 3, n: 2.2, cap: 0.04, capTop: 0, warp: fold, color: leather }
    );
    // (the foot of it)
    skin.loft(
      [
        { c: V(bx(0.03), 0.03, -0.064), rx: 0.028, ry: 0.03, ryB: 0.028, w: { [F]: 1 } },
        { c: V(bx(0.034), 0.034, -0.028), rx: 0.0445, ry: 0.046, ryB: 0.034, w: { [F]: 1 } },
        { c: V(bx(0.034), 0.034, 0.018), rx: 0.0475, ry: 0.041, ryB: 0.034, w: { [F]: 1 } },
        { c: V(bx(0.032), 0.032, 0.058), rx: 0.047, ry: 0.035, ryB: 0.032, w: { [F]: 1 } },
        { c: V(bx(0.03), 0.03, 0.088), rx: 0.039, ry: 0.029, ryB: 0.03, w: { [F]: 1 } },
        { c: V(bx(0.028), 0.028, 0.102), rx: 0.02, ry: 0.017, ryB: 0.02, w: { [F]: 1 } },
      ],
      {
        segs: 20,
        sub: 3,
        n: 2.25,
        cap: 0.5,
        warp: (P) => (P.y = Math.max(P.y, 0.0015)),
        color: (i) => col.copy(ink.boot).lerp(ink.bootDeep, 0.35 * smooth(0.2, -0.7, i.s)).lerp(ink.sole, smooth(0.015, 0.008, i.P.y)),
      }
    );
  }

  // the cardigan: a sheet round her shoulders and down over her hips, open in front — soft, a size too large: it
  // stands well off her in front, and hangs wider the lower it gets
  const GAP = 0.5; // half the opening, as an angle round her
  const A0 = Math.PI / 2 + GAP;
  const A1 = Math.PI / 2 - GAP + TAU;
  const nearEdge = (a) => Math.min(a - A0, A1 - a); // how far round from the nearer of its two front edges
  const folds = (i) => Math.sin(i.a * 5 + 1.1) * smooth(0.3, 0.85, i.v) * smooth(0, 0.5, nearEdge(i.a));
  const HEM = { rx: 0.134, ry: 0.122, ryB: 0.088, z: 0.008 };
  const coat = skin.loft(
    [
      { c: V(0, 0.719, -0.008), rx: 0.041, ry: 0.016, ryB: 0.04, w: { chest: 0.6, neck: 0.4 } },
      { c: V(0, 0.71, -0.004), rx: 0.077, ry: 0.05, ryB: 0.054, w: { chest: 1 } },
      { c: V(0, 0.69, 0), rx: 0.104, ry: 0.076, ryB: 0.064, w: { chest: 1 } },
      { c: V(0, 0.645, 0.004), rx: 0.111, ry: 0.098, ryB: 0.068, w: { chest: 1 } },
      { c: V(0, 0.555, 0.006), rx: 0.118, ry: 0.108, ryB: 0.074, w: { chest: 0.45, spine: 0.55 } },
      { c: V(0, 0.47, 0.008), rx: 0.128, ry: 0.117, ryB: 0.082, w: { spine: 0.4, hips: 0.6 } },
      { c: V(0, 0.424, HEM.z), rx: HEM.rx, ry: HEM.ry, ryB: HEM.ryB, w: { hips: 1 } },
    ],
    {
      segs: 40,
      sub: 4,
      n: 2.2,
      arc: [A0, A1],
      warp: (P, i) => {
        // (at her neck it is open from one side of it to the other: its front edges come down over her collarbones and in towards her chest)
        const open = lerp(1.3, GAP, smooth(0, 0.3, i.v));
        const a = 1.5 * Math.PI + (i.a - 1.5 * Math.PI) * ((Math.PI - open) / (Math.PI - GAP));
        const ca = Math.cos(a);
        const sa = Math.sin(a);
        const r = i.ring;
        P.copy(r.c)
          .addScaledVector(r.s, r.rx * Math.sign(ca) * Math.abs(ca) ** (2 / 2.2))
          .addScaledVector(r.u, (sa >= 0 ? r.ry : r.ryB) * Math.sign(sa) * Math.abs(sa) ** (2 / 2.2));
        // (lower down the cloth hangs in soft folds)
        const k = 0.022 * folds(i);
        P.x += (P.x - r.c.x) * k;
        P.z += (P.z - r.c.z) * k;
      },
      color: (i) => col.copy(ink.cardigan).lerp(ink.cardiganDeep, clamp(0.3 * (0.5 - 0.5 * folds(i)) * smooth(0.3, 0.85, i.v) + 0.25 * smooth(0.3, -0.8, i.s) * smooth(0.5, 1, i.v), 0, 1)),
    }
  );
  // (its knitted hem)
  skin.loft(
    [[0.427, 0.0005], [0.418, 0.004], [0.402, 0.0045], [0.392, 0.0015], [0.3895, -0.004]].map(([y, d]) => ({ c: V(0, y, HEM.z), rx: HEM.rx + d, ry: HEM.ry + d, ryB: HEM.ryB + d, w: { hips: 1 } })),
    { segs: 40, sub: 2, n: 2.2, arc: [A0, A1], mode: RIBS, tz: () => 110, color: (i) => col.copy(ink.cardigan).lerp(ink.cardiganDeep, 0.15 + 0.5 * smooth(0.5, 1, i.v)) }
  );
  // (the band round its neck and down both front edges: the cloth has an edge, it is not a leaf)
  {
    const edge = [];
    const at = (r, j) => {
      const q = (coat.base + r * coat.per + j) * 3;
      const p = V(skin.pos[q], skin.pos[q + 1], skin.pos[q + 2]);
      edge.push({ c: p, rx: 0.006, ry: 0.005, w: coat.rings[r].w, up: V(p.x, 0, p.z + 0.02).normalize() });
    };
    for (let r = coat.R - 1; r > 0; r -= 2) at(r, 0);
    for (let j = 0; j < coat.per; j += 2) at(0, j);
    for (let r = 2; r < coat.R; r += 2) at(r, coat.per - 1);
    // (…and on down the ends of the hem)
    const tip = (p) => ({ c: V(p.x, 0.394, p.z + 0.003), rx: 0.006, ry: 0.005, w: { hips: 1 }, up: V(p.x, 0, p.z).normalize() });
    edge.unshift(tip(edge[0].c));
    edge.push(tip(edge[edge.length - 1].c));
    skin.loft(edge, { segs: 8, sub: 1, cap: 0.6, color: (i) => col.copy(ink.cardigan).lerp(ink.cardiganDeep, 0.12 + 0.3 * smooth(0.2, -0.8, i.s)) });
  }
  // …its sleeves — wide, the cuff turned back — and her hands in them
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1;
    const A = `arm${side}`;
    const Fo = `fore${side}`;
    const H = `hand${side}`;
    const { fore: elbow, hand: wrist } = armJ(sg);
    // (where the middle of the sleeve is at the height y, below her elbow)
    const armX = (y) => lerp(elbow.x, wrist.x, (elbow.y - y) / (elbow.y - wrist.y));
    skin.loft(
      [
        { c: V(sg * 0.068, 0.7, -0.004), rx: 0.03, ry: 0.04, w: { chest: 0.75, [A]: 0.25 } },
        { c: V(sg * 0.095, 0.678, -0.004), rx: 0.044, ry: 0.048, w: { chest: 0.3, [A]: 0.7 } },
        { c: V(sg * 0.1015, 0.615, -0.003), rx: 0.039, ry: 0.0425, w: { [A]: 1 } },
        { c: V(elbow.x, elbow.y, -0.002), rx: 0.0345, ry: 0.0375, w: { [A]: 0.5, [Fo]: 0.5 } },
        { c: V(armX(0.503), 0.503, 0), rx: 0.033, ry: 0.0358, w: { [Fo]: 1 } },
        { c: V(armX(0.466), 0.466, 0.002), rx: 0.0335, ry: 0.036, w: { [Fo]: 1 } },
      ],
      {
        segs: 18,
        sub: 4,
        open: true,
        // (it creases in the crook of her arm)
        warp: (P, i) => {
          const k = 0.035 * Math.sin(i.v * 34) * bump(i.v, 0.6, 0.2) * smooth(-0.2, 0.6, i.s);
          P.x += (P.x - i.ring.c.x) * k;
          P.z += (P.z - i.ring.c.z) * k;
        },
        color: (i) => col.copy(ink.cardigan).lerp(ink.cardiganDeep, clamp(0.22 * (0.5 + 0.5 * Math.sin(i.v * 34)) * bump(i.v, 0.6, 0.2) + 0.3 * smooth(0.3, -0.8, sg * i.c), 0, 1)),
      }
    );
    // (the cuff: a knitted band, thicker than the sleeve; and the dark inside of it)
    skin.loft(
      [[0.469, 0.0335], [0.4645, 0.0368], [0.448, 0.038], [0.436, 0.0374], [0.4315, 0.0348]].map(([y, r]) => ({ c: V(armX(y), y, 0.002 + (0.466 - y) * 0.05), rx: r, ry: r * 1.06, w: { [Fo]: 1 } })),
      { segs: 18, sub: 2, open: true, mode: RIBS, tz: () => 36, color: (i) => col.copy(ink.cardigan).lerp(ink.cardiganDeep, 0.15 + 0.3 * smooth(0.3, -0.8, sg * i.c)) }
    );
    skin.loft(
      [[0.4315, 0.0348], [0.4335, 0.0298], [0.446, 0.0235], [0.466, 0.017]].map(([y, r]) => ({ c: V(armX(y), y, 0.003), rx: r, ry: r * 1.06, w: { [Fo]: 1 } })),
      { segs: 18, sub: 2, open: true, color: (i) => col.copy(ink.cardigan).lerp(ink.cardiganDeep, smooth(0, 0.5, i.v)).multiplyScalar(1 - 0.3 * smooth(0.1, 0.9, i.v)) }
    );
    // her wrist and palm…
    const hx = wrist.x + sg * 0.001;
    skin.loft(
      [
        { c: V(armX(0.462), 0.462, 0.003), rx: 0.0108, ry: 0.012, w: { [Fo]: 1 } },
        { c: V(armX(0.435), 0.435, 0.004), rx: 0.0104, ry: 0.0128, w: { [Fo]: 0.4, [H]: 0.6 } },
        { c: V(hx, 0.418, 0.0052), rx: 0.0086, ry: 0.0172, w: { [H]: 1 } },
        { c: V(hx, 0.402, 0.006), rx: 0.008, ry: 0.018, w: { [H]: 1 } },
        { c: V(hx, 0.394, 0.006), rx: 0.0062, ry: 0.0164, w: { [H]: 1 } },
      ],
      { segs: 12, sub: 2, n: 2.3, mode: SKIN, cap: 0.3, color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.7 * smooth(0.44, 0.452, i.P.y)) }
    );
    // …four fingers, a little apart and curled in, and her thumb
    const tipped = (i) => col.copy(ink.skin).lerp(ink.skinRose, 0.45 * smooth(0.5, 1, i.v));
    [[0.0118, 0.025], [0.004, 0.029], [-0.0038, 0.027], [-0.0112, 0.021]].forEach(([dz, long]) => {
      const z = 0.006 + dz;
      skin.loft(
        [
          { c: V(hx, 0.399, z), rx: 0.0038, ry: 0.0039, w: { [H]: 1 } },
          { c: V(hx - sg * 0.0006, 0.399 - long * 0.5, z + dz * 0.1), rx: 0.0037, ry: 0.0038, w: { [H]: 1 } },
          { c: V(hx - sg * 0.0034, 0.399 - long, z + dz * 0.22), rx: 0.003, ry: 0.0031, w: { [H]: 1 } },
        ],
        { segs: 7, sub: 2, mode: SKIN, cap: 0.8, color: tipped }
      );
    });
    skin.loft(
      [
        { c: V(hx - sg * 0.0006, 0.424, 0.018), rx: 0.0046, ry: 0.0048, w: { [H]: 1 } },
        { c: V(hx - sg * 0.0014, 0.411, 0.029), rx: 0.0042, ry: 0.0044, w: { [H]: 1 } },
        { c: V(hx - sg * 0.0032, 0.398, 0.035), rx: 0.0033, ry: 0.0034, w: { [H]: 1 } },
      ],
      { segs: 7, sub: 2, mode: SKIN, cap: 0.8, color: tipped }
    );
  }

  // ---- her hair
  const headAt = V(0, HEAD_Y, 0);
  const head = new Rings(HEAD, headAt, HEAD_N, HEAD_NB);
  const cap = new Rings(CAP, headAt, CAP_N);
  const HM = V(0, HEAD_Y + 0.02, -0.006); // a point well inside both: what lies on her head is placed looking out from here
  const outwards = (az, el) => V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el)); // (az: 0 = to the front, + = to her left; el: up)
  const reach = (dir) => Math.max(head.reach(HM, dir), cap.reach(HM, dir));
  /** A point on her head (hair or skin, whichever is outermost), `lift` off it: ['s', az°, el°, lift] looking out from the middle — or ['f', x, y, lift] as seen from in front (y from the middle of her head). */
  const onHead = ([kind, a, b, lift]) => {
    let dir;
    if (kind === 's') dir = outwards(a * DEG, b * DEG);
    else {
      // (which way out of the middle a point of the front is that is seen at (x, y): tried, and tried again)
      let r = 0.11;
      for (let k = 0; k < 10; k++) {
        const el = Math.asin(clamp((HEAD_Y + b - HM.y) / r, -1, 1));
        const az = Math.asin(clamp(a / (r * Math.cos(el)), -1, 1));
        dir = outwards(az, el);
        r = reach(dir);
      }
    }
    return { p: HM.clone().addScaledVector(dir, reach(dir) + lift), up: dir };
  };
  // (fair on top; salmon the lower it hangs)
  const dyed = (y) => smooth(0.83, 0.56, y);
  const hairInk = (i, turn = 0) => {
    const low = clamp(dyed(i.P.y) + turn, 0, 1);
    return col.copy(ink.hair).lerp(ink.hairMid, smooth(0, 0.62, low)).lerp(ink.hairTip, smooth(0.55, 1, low));
  };
  // the cap of it, drawn back to where it is tied: its strands all run there
  const TIE = tailRows[1].p.clone().sub(HM).normalize();
  const tieA = V().crossVectors(TIE, Y_AXIS).normalize();
  const tieB = V().crossVectors(TIE, tieA).normalize();
  const dirTo = V();
  skin.loft(cap.keys({ head: 1 }), {
    segs: 48,
    sub: 3,
    n: CAP_N,
    frame: LEVEL,
    cap: 0.15,
    mode: HAIR,
    tex: (i, tex) => {
      dirTo.copy(i.P).sub(HM).normalize();
      const ang = Math.atan2(dirTo.dot(tieB), dirTo.dot(tieA));
      const thick = 0.13 * Math.sqrt(Math.max(0, 1 - dirTo.dot(TIE) ** 2)) + 0.004;
      tex[0] = Math.cos(ang) * thick;
      tex[1] = Math.sin(ang) * thick;
      tex[2] = 3;
    },
    color: (i) => {
      const y = i.P.y - HEAD_Y;
      col.copy(ink.hair).lerp(ink.hairLight, 0.4 * smooth(0.05, 0.12, y));
      // (deeper towards the nape, and in the shade behind her cheeks)
      return col.lerp(ink.hairDeep, clamp(0.6 * smooth(-0.01, -0.09, y) + 0.5 * smooth(-0.3, 0.3, i.s) * smooth(0.03, -0.02, y), 0, 1));
    },
  });

  // Her fringe, and the hair over her temples: one sheet of hair that lies on her head, combed out to both sides
  // from a parting — a little to her left of the middle, from the crown forward to where her brow shows. EDGE is
  // where it ends, from behind her right ear round her brow to behind her left: the points of its locks (1) and the
  // nicks between them (0) — ['s', az°, el°] looking out from the middle of her head, or ['f', x, y] as seen from in
  // front; a fifth number bends the edge from that one to the next (1: straight; more: a broad lock, a narrow nick).
  // Over her right brow it hangs in three broad locks that end just above it; a lock and a thin strand come down
  // between her eyes; to her left of those a triangle of brow is bare, and the hair is swept in one lock to the temple.
  const EDGE = [
    ['s', -104, 4, 0],
    ['s', -90, -10, 1],
    ['s', -78, 8, 0],
    ['f', -0.089, -0.022, 1],
    ['f', -0.085, 0.014, 0],
    ['f', -0.075, 0.008, 1],
    ['f', -0.061, 0.017, 0],
    ['f', -0.046, 0.008, 1],
    ['f', -0.033, 0.016, 0],
    ['f', -0.019, 0, 1],
    ['f', -0.012, 0.01, 0],
    ['f', -0.0045, -0.004, 1],
    ['f', 0.004, 0.013, 0, 0.7],
    ['f', 0.012, -0.011, 1, 0.6],
    ['f', 0.019, 0.062, 0, 1],
    ['f', 0.073, -0.007, 1],
    ['f', 0.083, 0.006, 0],
    ['f', 0.091, -0.02, 1],
    ['s', 78, 8, 0],
    ['s', 90, -10, 1],
    ['s', 104, 4, 0],
  ];
  {
    const PER = 8; //      vertices from one of those to the next
    const ROWS = 16; //    …and from the parting to the edge
    const THICK = 0.02;
    const part = [onHead(['s', 25, 84, 0]).up, onHead(['f', 0.022, 0.07, 0]).up]; // the parting: from the crown to her brow
    // (each of them as a way out of the middle of her head: how far round, how far up)
    const ends = EDGE.map((e) => {
      const d = onHead([e[0], e[1], e[2], 0]).up;
      return { az: Math.atan2(d.x, d.z), el: Math.asin(d.y) };
    });
    const NU = (EDGE.length - 1) * PER + 1;
    const dA = V();
    const dB = V();
    const dir = V();
    skin.patch(NU, ROWS + 1, { head: 1 }, HAIR, (iu, iv, out) => {
      const i = Math.min(EDGE.length - 2, Math.floor(iu / PER));
      const f = iu / PER - i;
      const nick = EDGE[i][3] ? f : 1 - f; // 0: down the middle of a lock … 1: between two
      const tip = ends[EDGE[i][3] ? i : i + 1];
      const gap = ends[EDGE[i][3] ? i + 1 : i];
      const under = iv >= ROWS; //            (its last row turns in under its edge)
      const v = under ? 0.96 : iv / (ROWS - 1);
      // where this hair ends, and where on the parting it grows: the further forward, the nearer to it it ends
      dB.copy(outwards(lerp(ends[i].az, ends[i + 1].az, f), lerp(tip.el, gap.el, nick ** (EDGE[i][4] || 1.5))));
      dA.copy(part[0]).lerp(part[1], smooth(0.11, 0.015, Math.abs(dB.x * 0.12 - 0.02))).normalize();
      dir.copy(dA).lerp(dB, v).normalize();
      const side = smooth(0, 1.6, Math.min(iu, NU - 1 - iu) / PER); // (behind her ears it runs out flat into the rest of her hair)
      const crease = nick ** 5 * smooth(0.1, 0.4, v); // (between two locks: a narrow furrow, nearly all the way from the parting)
      const flank = 1 - 0.5 * smooth(0.5, 0.85, Math.abs(dB.x)); // (thinner over her temples than over her brow)
      const thin = 1 - 0.74 * smooth(0.5, 1, v); // (it thins out to its points, and lies down on her brow)
      const lift = under ? 0 : THICK * smooth(0, 0.3, v) * thin * (1 - 0.4 * crease) * flank * (0.25 + 0.75 * side);
      out.P.copy(HM).addScaledVector(dir, reach(dir) + lift);
      out.color.copy(ink.hair).lerp(ink.hairLight, 0.3 * (1 - nick) * bump(v, 0.5, 0.3)).lerp(ink.hairDeep, under ? 0.8 : 0.85 * crease);
      // (strands run down it: nine turns of the shader's ring from one ear to the other)
      const th = (iu / (NU - 1)) * TAU * 9;
      out.tex[0] = Math.cos(th) * 0.0035; // (shallow ones: a fringe is combed)
      out.tex[1] = Math.sin(th) * 0.0035;
      out.tex[2] = 2 + v * 2;
    });
  }
  // the locks before her ears, down her cheeks: on her right a long one, thin at its end, to her shoulder; on her left a shorter one
  const hung = (side) => (v) => ({ head: 1 - smooth(0.25, 0.75, v), [side]: smooth(0.25, 0.75, v) });
  const sideInk = (turn) => (i) => hairInk(i, turn).lerp(ink.hairLight, 0.2 * smooth(0.6, 0, Math.abs(i.c)) * smooth(0, 1, i.s)).lerp(ink.hairDeep, 0.45 * smooth(0.5, 1, Math.abs(i.c)));
  skin.lock(
    [V(-0.094, 0.872, 0.03), V(-0.1, 0.84, 0.018), V(-0.103, 0.8, 0.012), V(-0.102, 0.764, 0.016), V(-0.098, 0.732, 0.026), V(-0.094, 0.708, 0.034), V(-0.092, 0.694, 0.04)],
    [0.02, 0.03, 0.03, 0.022, 0.013, 0.008, 0.002],
    0.012,
    { side: V(0.25, 0, 1).normalize(), w: hung('lockR'), seed: 31, color: sideInk(0.12) }
  );
  skin.lock([V(0.094, 0.872, 0.03), V(0.1, 0.84, 0.018), V(0.103, 0.8, 0.012), V(0.102, 0.768, 0.016), V(0.097, 0.746, 0.026)], [0.022, 0.032, 0.032, 0.024, 0.003], 0.013, {
    side: V(-0.25, 0, 1).normalize(),
    w: hung('lockL'),
    seed: 37,
    color: sideInk(0.08),
  });

  // The tail itself: one great lock — not round but lobed: broad tresses lie side by side in it and wind a little
  // as they go down — and a few tresses of their own beside it.
  const tailInk = (deep) => (i) => {
    const t = dyed(i.P.y);
    col.copy(ink.hair).lerp(ink.hairMid, smooth(0.02, 0.6, t)).lerp(ink.hairTip, smooth(0.6, 1, t));
    return col.lerp(ink.hairLight, 0.2 * smooth(0.2, 1, -i.s) * (1 - t)).lerp(ink.hairDeep, clamp(deep + 0.35 * smooth(0.1, 1, i.s), 0, 1) * 0.6);
  };
  const lobes = (i) => {
    const a = i.a + i.len * 1.6;
    return (0.055 * Math.cos(3 * a + 0.6) + 0.03 * Math.cos(5 * a + 2.1) + 0.016 * Math.cos(8 * a)) * smooth(0.02, 0.2, i.len);
  };
  const body = tailInk(0);
  skin.loft(
    tailRows.map((row, k) => ({ c: row.p, rx: row.hw, ry: row.hd, w: tailW(k) })),
    {
      segs: 40,
      sub: 5,
      cap: 0.4,
      mode: HAIR,
      tz: (i) => 3 + i.len * 30,
      warp: (P, i) => {
        const k = lobes(i);
        P.x += (P.x - i.ring.c.x) * k;
        P.y += (P.y - i.ring.c.y) * k;
        P.z += (P.z - i.ring.c.z) * k;
      },
      color: (i) => body(i).lerp(ink.hairDeep, 0.5 * smooth(0.02, -0.1, lobes(i))),
    }
  );
  const END = TAIL.length - 1;
  /** A tress beside it: where across the tail it keeps (`off`: to the outside, behind), how much of the tail's thickness it has, from which row to which; `rise` lifts it where the tail comes over, `stray` is where its point ends up, off the tail's. */
  const tress = ({ off, size, from = 0, to = END, stray = [0, 0, 0], rise = 0, bow = 0, seed, deep = 0, segs = 12 }) => {
    const keys = [];
    const n = Math.ceil((to - from) * 1.5);
    for (let q = 0; q <= n; q++) {
      const k = lerp(from, to, q / n);
      const row = tailAt(k);
      const end = smooth(to - 2.4, to, k); // (drawn out to a point over its last stretch)
      const out = smooth(0.6, 2.8, k) * (1 + bow * bump(k, 4.6, 2.2)); // (all of them come out of the one tie)
      const c = row.p
        .clone()
        .addScaledVector(row.s, off[0] * row.hw * out + stray[0] * end)
        .addScaledVector(row.u, -off[1] * row.hd * out - stray[2] * end);
      c.y += stray[1] * end + rise * bump(k, 3, 1.6);
      const thin = to < END ? 1 - end : 1; // (one that ends before the tail does comes to a point of its own)
      keys.push({ c, rx: Math.max(0.0025, row.hw * size * thin), ry: Math.max(0.0025, row.hd * size * thin), w: tailW(k) });
    }
    skin.loft(keys, { segs, sub: 3, cap: 0.5, mode: HAIR, tz: (i) => seed + i.len * 30, color: tailInk(deep) });
  };
  tress({ off: [-0.4, 0.25], size: 0.5, from: 0.4, to: 8, rise: 0.014, seed: 7 });
  tress({ off: [0.3, 0.92], size: 0.18, from: 1.6, to: 6.8, bow: 0.15, seed: 13 }); // (one that bows out behind the rest)
  tress({ off: [0.7, 0.1], size: 0.22, from: 6, to: 10.6, stray: [0.03, 0.022, 0], seed: 5 });
  // a strand that has come loose of the tie, down her back, its end curled
  skin.lock(
    [V(0.064, 0.91, -0.094), V(0.058, 0.862, -0.126), V(0.052, 0.782, -0.106), V(0.05, 0.694, -0.084), V(0.052, 0.596, -0.088), V(0.058, 0.516, -0.099), V(0.07, 0.468, -0.105), V(0.085, 0.451, -0.102)],
    [0.008, 0.009, 0.008, 0.0075, 0.007, 0.006, 0.005, 0.002],
    0.006,
    { segs: 6, sub: 4, seed: 41, w: (v) => (v < 0.2 ? { head: 1 } : v < 0.35 ? { head: 0.4, chest: 0.6 } : v < 0.6 ? { chest: 1 } : v < 0.8 ? { chest: 0.4, spine: 0.6 } : { spine: 0.5, hips: 0.5 }), color: (i) => hairInk(i, 0.05) }
  );

  const geometry = skin.geometry();

  // ---- assemble
  const group = new THREE.Group();
  group.name = 'lorelei';
  group.add(bones.root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  // how bright the day is (`uLight`), how much of a sun there is in it (`uSun`: 0 … 1) — the world keeps both; where
  // she is (`uMid`: her animator keeps it) and where the sun stands, for the shadow she walks into
  const light = { uLight: { value: new THREE.Color(1, 1, 1) }, uSun: { value: 1 }, uMid: { value: V(0, 0.6, 0) }, uSunDir: FUR_SUN, uClear: { value: 0.9 * LORELEI_SIZE } };
  const material = dress(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), light, { LORELEI_TEX: 1 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = false; // (the shader looks up her shadow itself: dress)
  group.add(mesh);
  mesh.bind(skeleton);

  // ---- her head, a mesh of its own on the head bone: skin, with her face painted on the front of it
  const hs = new Skin({ head: 0 });
  // (finer in front, where her face is, than behind, where her hair hides it)
  const faceAngles = Array.from({ length: 64 }, (_, j) => (j / 64) * TAU + 0.45 * Math.cos((j / 64) * TAU));
  const paintAt = (i, tex) => {
    tex[0] = (i.P.x + FACE.half) / (2 * FACE.half);
    tex[1] = (i.P.y - HEAD_Y - FACE.bottom) / (FACE.top - FACE.bottom);
    tex[2] = smooth(0.06, 0.2, i.s); // (how much of the painting shows: all of it in front, none of it behind)
  };
  hs.loft(head.keys({ head: 1 }), {
    angles: faceAngles,
    sub: (i) => (i < 3 ? 3 : 5),
    n: HEAD_N,
    nB: HEAD_NB,
    frame: LEVEL,
    cap: 0.1,
    capTop: 0.3,
    mode: SKIN,
    tex: paintAt,
    // the shape of her face in profile: a small nose, turned up; her lips; a round chin
    warp: (P, i) => {
      const y = P.y - HEAD_Y;
      const f = Math.max(0, i.s);
      P.z += f * (0.005 * bump(P.x, 0, 0.045) * smooth(-0.105, -0.07, y) + 0.0115 * bump(P.x, 0, 0.0105) * bump(y, NOSE_Y, 0.024, 0.0075) + 0.0024 * bump(P.x, 0, 0.013) * bump(y, MOUTH.y - 0.001, 0.007) + 0.002 * bump(P.x, 0, 0.02) * bump(y, -0.108, 0.008));
    },
    color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.55 * smooth(-0.1, -0.118, i.P.y - HEAD_Y) + 0.3 * smooth(0.2, -0.5, i.s)),
  });
  // her ears (close to her head: from in front the locks before them hide them)
  for (const sg of [-1, 1]) {
    hs.loft(
      [
        { c: V(sg * 0.08, 0.806, -0.008), rx: 0.027, ry: 0.0125, w: { head: 1 } },
        { c: V(sg * 0.094, 0.807, -0.014), rx: 0.0275, ry: 0.012, w: { head: 1 } },
        { c: V(sg * 0.1, 0.808, -0.019), rx: 0.022, ry: 0.0075, w: { head: 1 } },
      ],
      { segs: 14, sub: 3, side: Y_AXIS, cap: 0.35, mode: SKIN, tex: (i, tex) => (tex[0] = tex[1] = tex[2] = 0), color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.25 + 0.4 * smooth(0.55, 1, i.v)) }
    );
  }
  const headGeo = new THREE.BufferGeometry();
  const hp = new Float32Array(hs.pos.length);
  for (let i = 0; i < hs.pos.length; i += 3) {
    hp[i] = hs.pos[i] - J.head.x; // (in the measure of the bone it is on)
    hp[i + 1] = hs.pos[i + 1] - J.head.y;
    hp[i + 2] = hs.pos[i + 2] - J.head.z;
  }
  const face3 = new Float32Array(hs.count * 3);
  for (let i = 0; i < hs.count; i++) face3.set([hs.tex[i * 4], hs.tex[i * 4 + 1], hs.tex[i * 4 + 2]], i * 3);
  headGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3));
  headGeo.setAttribute('color', new THREE.Float32BufferAttribute(hs.col, 3));
  headGeo.setAttribute('aFace', new THREE.BufferAttribute(face3, 3));
  headGeo.setIndex(hs.idx);
  headGeo.computeVertexNormals();
  const faces = new Map(); // 'eyes|mouth|blush' → the painting, made when first shown
  const faceMap = { value: null };
  const headMat = dress(new THREE.MeshLambertMaterial({ vertexColors: true }), { ...light, uFaceMap: faceMap, uSkin: { value: ink.skin.clone() } }, { LORELEI_FACE: 1 });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.castShadow = true;
  bones.head.add(headMesh);
  const face = {
    key: '',
    show(eyes, mouth, blush = 0) {
      const key = `${eyes}|${mouth}|${blush ? 1 : 0}`;
      if (key === this.key) return;
      this.key = key;
      if (!faces.has(key)) faces.set(key, paintFace(eyes, mouth, blush ? 1 : 0));
      faceMap.value = faces.get(key);
    },
  };
  face.show('open', 'flat');

  // ---- what she may have in her hands
  // an umbrella, for the rain (it stays upright whatever her arm does)
  const umbrella = new THREE.Group();
  {
    const b = new Batch();
    const panel = (p) => col.set(Math.floor(((Math.atan2(p.z, p.x) / TAU + 1) * 8) % 2) ? '#ff9ecb' : '#fff3f8');
    b.add(new THREE.ConeGeometry(0.33, 0.13, 8, 1, true), { at: [0, 0.5, 0], color: panel, flat: true, byFace: true });
    b.add(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 5), { at: [0, 0.27, 0], color: '#f4ecd8' });
    b.add(new THREE.SphereGeometry(0.014, 8, 6), { at: [0, 0.575, 0], color: '#ff7fb0' });
    b.add(new THREE.TorusGeometry(0.022, 0.007, 5, 10, Math.PI), { at: [0.022, -0.03, 0], rot: [Math.PI, 0, 0], color: '#ff7fb0' });
    const m = b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    umbrella.add(m);
  }
  umbrella.visible = false;
  bones.handL.add(umbrella);
  umbrella.position.set(0, -0.025, 0.01);
  // a bag of food, for the bowl
  const bag = new THREE.Group();
  {
    const b = new Batch();
    b.add(new THREE.BoxGeometry(0.085, 0.11, 0.05), { at: [0, 0.055, 0], color: ['#c99a62', '#e6c08a'] });
    b.add(new THREE.BoxGeometry(0.09, 0.02, 0.03), { at: [0, 0.118, 0], color: '#d9ab70' });
    b.add(new THREE.CircleGeometry(0.022, 12), { at: [0, 0.058, 0.0256], color: '#fff3e0' });
    b.add(new THREE.CircleGeometry(0.01, 8), { at: [0, 0.054, 0.0262], color: '#e8743b' });
    for (const [dx, dy] of [[-0.012, 0.014], [0, 0.019], [0.012, 0.014]]) b.add(new THREE.CircleGeometry(0.005, 6), { at: [dx, 0.058 + dy, 0.0262], color: '#e8743b' });
    bag.add(b.mesh());
  }
  bag.visible = false;
  bones.handR.add(bag);
  bag.position.set(0.02, -0.11, 0.04);

  group.scale.setScalar(LORELEI_SIZE);

  return {
    group,
    bones,
    skeleton,
    mesh,
    head: headMesh,
    face,
    tail, //       the bones of her tail of hair, from the tie down
    umbrella,
    bag,
    scale: 1, //   how much room she takes on the ground, as foxes go (the brain's measure — not how tall she is)
    size: LORELEI_SIZE,
    light, //      how she is lit: the world keeps `uLight` and `uSun`, her animator `uMid` (see dress)
    rest: {
      // which way her arms hang, and how long their parts are
      arm: { L: armJ(1), R: armJ(-1) },
      leg: { L: legJ(1), R: legJ(-1) },
    },
    dims: {
      height: 1,
      crown: V(0, 1.004 - J.head.y, 0), //             the top of her head, in the head bone's space
      eyes: V(0, HEAD_Y + EYE.y - J.head.y, 0.1), //   …and between her eyes
      palm: V(0, -0.03, 0.01), //                      the palm of a hand, in the hand bone's space
    },
    dispose() {
      geometry.dispose();
      material.dispose();
      skeleton.dispose();
      headGeo.dispose();
      headMat.dispose();
      faces.forEach((t) => t.dispose());
      [umbrella, bag].forEach((g) =>
        g.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material) o.material.dispose();
        })
      );
    },
  };
}

// ------------------------------------------------------------------ poses
//
// A pose is a flat set of numbers, so two poses blend by plain interpolation.
//   hy, hz            hips offset                         lean, twist, tilt   hips: bowing forward, turned, tipped sideways
//   srx, sry, srz     spine          crx, cry, crz  chest          nrx, nry, nrz  neck          hdx, hdy, hdz  head
//   aLf, aLo, aLt     her left arm: raised forward, raised out to the side, turned about itself (so that the elbow bends upwards)
//   eL, wL            …its elbow bent, its wrist                  (aRf … wR: her right arm)
//   tL, sL, kL, fL    her left leg: the thigh forward, splayed out; the knee bent; the toes pointed    (tR … fR: her right)
//   walk              1 = arms and legs follow her steps; 0 = they stay as the pose has them
const BASE = {
  hy: 0, hz: 0, lean: 0, twist: 0, tilt: 0,
  srx: 0, sry: 0, srz: 0, crx: 0, cry: 0, crz: 0, nrx: 0, nry: 0, nrz: 0, hdx: 0, hdy: 0, hdz: 0,
  aLf: 0, aLo: 0.05, aLt: 0, eL: 0.14, wL: 0, aRf: 0, aRo: 0.05, aRt: 0, eR: 0.14, wR: 0,
  tL: 0, sL: 0, kL: 0, fL: 0, tR: 0, sR: 0, kR: 0, fR: 0,
  walk: 1,
};
const pose = (o) => ({ ...BASE, ...o });
// kneeling, sitting back on her heels
const KNEEL = { hy: -0.25, hz: -0.01, lean: 0.05, tL: 1.1, tR: 1.1, kL: 2.66, kR: 2.66, fL: 1.5, fR: 1.5, sL: 0.1, sR: 0.1, walk: 0 };

export const LORELEI_POSES = {
  // (her chin a little up: whoever looks on, looks down on her)
  stand: pose({ nrx: -0.05, hdx: -0.1 }),
  // kneeling, her hands in her lap
  sit: pose({ ...KNEEL, aLf: 0.24, aRf: 0.24, eL: 0.55, eR: 0.55, aLo: -0.03, aRo: -0.03 }),
  // …nodding off
  doze: pose({ ...KNEEL, lean: 0.12, srx: 0.1, nrx: 0.3, hdx: 0.26, hdz: 0.12, aLf: 0.24, aRf: 0.24, eL: 0.55, eR: 0.55, aLo: -0.03, aRo: -0.03 }),
  // …one hand out to a fox (the arm itself reaches where it has to)
  pet: pose({ ...KNEEL, lean: 0.22, srx: 0.08, nrx: 0.12, aLf: 0.4, eL: 1.0, aLo: -0.06, aRf: 0.9, eR: 0.5 }),
  // an arm up, to wave
  wave: pose({ aRo: 1.5, aRt: 1.57, eR: 1.9, tilt: -0.03, srz: 0.04, hdz: 0.08 }),
  // both arms up
  cheer: pose({ aLo: 2.55, aRo: 2.55, eL: 0.25, eR: 0.25, lean: -0.05, hdx: -0.12 }),
  // …and stretching: a long one, up on her toes
  stretch: pose({ aLo: 2.95, aRo: 2.95, eL: 0.05, eR: 0.05, lean: -0.09, srx: -0.06, hdx: -0.25, fL: 0.5, fR: 0.5, hy: 0.018, walk: 0 }),
  // hands together in front of her (to clap; holding something)
  clap: pose({ aLf: 0.95, aRf: 0.95, eL: 1.25, eR: 1.25, aLo: -0.22, aRo: -0.22 }),
  carry: pose({ aLf: 0.55, aRf: 0.55, eL: 1.45, eR: 1.45, aLo: -0.16, aRo: -0.16 }),
  // …and holding it out to somebody
  offer: pose({ aLf: 1.12, aRf: 1.12, eL: 0.62, eR: 0.62, aLo: -0.13, aRo: -0.13, lean: 0.1, hdx: -0.06 }),
  // bent over the bowl, tipping the bag out
  pour: pose({ lean: 0.5, srx: 0.16, nrx: 0.18, hdx: 0.1, aLf: 0.75, aRf: 0.8, eL: 0.9, eR: 0.75, aLo: -0.2, aRo: -0.18, wR: 0.9, kL: 0.24, kR: 0.24, tL: 0.12, tR: 0.12, hy: -0.012, walk: 0 }),
  // the ball: drawn back, then let go
  windup: pose({ aRf: -0.95, aRo: 0.55, eR: 1.3, cry: -0.42, sry: -0.2, twist: -0.12, lean: -0.06, aLf: 0.5, eL: 0.6, tL: 0.22, tR: -0.18, kR: 0.2, walk: 0 }),
  fling: pose({ aRf: 2.0, aRo: 0.2, eR: 0.15, cry: 0.4, sry: 0.2, twist: 0.1, lean: 0.2, aLf: -0.4, eL: 0.5, tL: -0.2, tR: 0.26, kL: 0.3, walk: 0 }),
  // for a picture: two fingers by her cheek; a hand on her hip
  peace: pose({ aRo: 0.95, aRt: 1.57, eR: 2.45, hdz: 0.14, tilt: -0.04, srz: 0.05, aLo: 0.75, aLt: -1.57, eL: 1.5 }),
  proud: pose({ aLo: 0.75, aLt: -1.57, eL: 1.5, aRo: 0.75, aRt: -1.57, eR: 1.5, lean: -0.04, hdx: -0.08 }),
  // in the air
  hop: pose({ tL: 0.5, tR: 0.3, kL: 0.9, kR: 0.7, aLo: 1.9, aRo: 1.9, eL: 0.4, eR: 0.4, walk: 0 }),
  // an arm before her face (the wind is full of sand)
  shield: pose({ aRf: 1.35, aRo: -0.35, eR: 2.0, hdx: 0.16, nrx: 0.08, lean: 0.06 }),
  // looking down at something at her feet, hands on her knees
  bend: pose({ lean: 0.42, srx: 0.14, nrx: 0.1, aLf: 0.55, aRf: 0.55, eL: 0.3, eR: 0.3, kL: 0.22, kR: 0.22, tL: 0.1, tR: 0.1, hy: -0.01, walk: 0 }),
};
const POSE_KEYS = Object.keys(BASE);

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qp = new THREE.Quaternion();
const _a = V();
const _b = V();
const _c = V();
const _d = V();
const _e = V();
const _euler = new THREE.Euler();

/** Moves her. Has the foxes' animator's handles (pos, yaw, speed, setPose, look, mood…), so the same brain can drive both. */
export class LoreleiAnimator {
  constructor(rig) {
    this.rig = rig;
    this.S = rig.size;
    this.time = Math.random() * 10;

    // set by the brain
    this.pos = V();
    this.yaw = 0;
    this.speed = 0; //      forward speed, world units / s
    this.yawRate = 0;
    this.air = 0; //        height of a jump
    this.target = LORELEI_POSES.stand;
    this.rate = 6; //       how fast the pose blends
    this.look = null; //    world point to look at (or null)
    this.lookW = 0;
    // (the foxes' moods are here too, for the brain they share; hers are eyes, mouth, smile and blush)
    this.mood = { wag: 0, ears: 0, mouth: 0, pant: 0, chew: 0, eyes: 'open', breath: 1, shake: 0, wiggle: 0, tailUp: 0, smile: 0, blush: 0 };
    this.noseY = null;
    this.pitch = 0;
    this.roll = 0;
    this.pivot = 0;
    this.add = {}; //       offsets on top of the pose, a frame at a time (same keys): a wave, a clap, a dance
    this.reach = null; //   { side: 'L' | 'R', point } — that hand goes to this point in the world, as far as her arm is long
    this.umbrella = false; // she has her umbrella up
    this.holds = null; //   'bag': what she has in her hands

    this.cur = { ...LORELEI_POSES.stand };
    this.eff = { ...LORELEI_POSES.stand };
    this.phase = 0;
    this.go = 0;
    this.run = 0;
    this.prevPos = V();
    this.vel = V();
    this.smYawRate = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.blinkT = 1 + Math.random() * 3;
    this.blink = 0;
    this.reachW = { L: 0, R: 0 };
    this.umb = 0;
    // her hair swings on springs: [angle, speed] fore-and-aft and side to side
    this.sway = { x: 0, vx: 0, z: 0, vz: 0, lagX: rig.tail.map(() => 0), lagZ: rig.tail.map(() => 0) };
    this.lastSpeed = 0;
    this.lastBob = 0;
    this.onStep = null; // (worldPos) when a foot comes down
    this.stepped = [false, false];
    const R = rig.rest;
    this.len = {
      upper: R.arm.L.fore.clone().sub(R.arm.L.arm).length(),
      fore: R.arm.L.hand.clone().sub(R.arm.L.fore).length() + 0.04, // (to her palm)
    };
    this.restDir = {
      L: [R.arm.L.fore.clone().sub(R.arm.L.arm).normalize(), R.arm.L.hand.clone().sub(R.arm.L.fore).normalize()],
      R: [R.arm.R.fore.clone().sub(R.arm.R.arm).normalize(), R.arm.R.hand.clone().sub(R.arm.R.fore).normalize()],
    };
    this.snap();
  }

  snap() {
    const g = this.rig.group;
    g.position.set(this.pos.x, this.air, this.pos.z);
    g.rotation.set(0, this.yaw, 0);
    g.updateMatrixWorld(true);
    this.rig.light.uMid.value.setFromMatrixPosition(this.rig.bones.chest.matrixWorld);
    this.prevPos.copy(this.pos);
    this.lastSpeed = this.speed;
  }

  setPose(name, rate = 6) {
    this.target = LORELEI_POSES[name] || LORELEI_POSES.stand;
    this.rate = rate;
  }

  /** Nothing on top of the pose any more. */
  still() {
    for (const key in this.add) this.add[key] = 0;
  }

  level() {
    this.pitch = this.roll = this.pivot = 0;
  }

  /** World position of the top of her head / of her right hand (what a fox comes to sniff at) / of a hand. */
  headPoint(out = V()) {
    return out.copy(this.rig.dims.crown).applyMatrix4(this.rig.bones.head.matrixWorld);
  }
  nosePoint(out = V()) {
    return this.handPoint('R', out);
  }
  handPoint(side, out = V()) {
    return out.copy(this.rig.dims.palm).applyMatrix4(this.rig.bones[`hand${side}`].matrixWorld);
  }
  eyePoint(out = V()) {
    return out.copy(this.rig.dims.eyes).applyMatrix4(this.rig.bones.head.matrixWorld);
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    const rig = this.rig;
    const B = rig.bones;
    const cur = this.cur;
    const p = this.eff;
    const m = this.mood;
    this.time += dt;
    const t = this.time;

    // -- blend the pose, then lay on top of it what a gesture adds; with her umbrella up, her left arm holds it
    const k = 1 - Math.exp(-this.rate * dt);
    for (const key of POSE_KEYS) {
      cur[key] += (this.target[key] - cur[key]) * k;
      p[key] = cur[key] + (this.add[key] || 0);
    }
    this.umb = damp(this.umb, this.umbrella ? 1 : 0, 6, dt);
    if (this.umb > 0.01) {
      const u = this.umb;
      p.aLf = lerp(p.aLf, 0.62, u);
      p.aLo = lerp(p.aLo, 0.02, u);
      p.aLt = lerp(p.aLt, 0, u);
      p.eL = lerp(p.eL, 2.05, u);
    }
    rig.umbrella.visible = this.umb > 0.5;
    rig.bag.visible = this.holds === 'bag';

    // -- how fast she is going, and her steps
    this.vel.copy(this.pos).sub(this.prevPos).divideScalar(Math.max(dt, 1e-4));
    this.prevPos.copy(this.pos);
    const speed = Math.abs(this.speed) / this.S;
    this.smYawRate = damp(this.smYawRate, this.yawRate, 8, dt);
    const eff = Math.max(speed, Math.abs(this.smYawRate) * 0.07);
    const moving = eff > 0.03 && p.walk > 0.5;
    this.run = damp(this.run, clamp((speed - 0.75) / 0.5, 0, 1), 6, dt);
    const run = this.run;
    const stride = lerp(0.6, 1.02, run); // how far two steps take her
    if (moving) this.phase = (this.phase + (dt * Math.max(eff, 0.12)) / stride) % 1;
    this.go = damp(this.go, moving ? clamp(eff / 0.22, 0, 1) : 0, moving ? 8 : 5, dt);
    const go = this.go * p.walk;
    const cyc = this.phase * TAU;
    const sn = Math.sin(cyc);
    const cs = Math.cos(cyc);
    const swing = lerp(0.46, 0.78, run) * go; //                 how far her thighs swing
    const bend = lerp(0.75, 1.5, run) * go; //                   …how far the knee of the leg that comes forward bends
    const bob = -Math.abs(sn) * lerp(0.008, 0.02, run) * go + lerp(0.004, 0.012, run) * go;
    const breath = Math.sin(t * 1.7 * m.breath) * 0.012;

    // -- root
    const grp = rig.group;
    grp.position.set(this.pos.x, this.air, this.pos.z);
    grp.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');

    // -- hips and spine
    B.hips.position.copy(B.hips.userData.rest);
    B.hips.position.y += p.hy + bob;
    B.hips.position.z += p.hz;
    B.hips.rotation.set(p.lean + lerp(0.03, 0.2, run) * go, p.twist + sn * 0.09 * go - this.smYawRate * 0.02, p.tilt + cs * 0.03 * go, 'YXZ');
    B.spine.rotation.set(p.srx, p.sry - sn * 0.07 * go, p.srz - cs * 0.02 * go);
    B.chest.rotation.set(p.crx + breath * 0.6, p.cry - sn * 0.09 * go, p.crz);
    B.chest.scale.set(1 + breath * 0.5, 1, 1 + breath);

    // -- arms: as the pose has them; walking, they swing against her legs
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      const sw = -sg * sn * lerp(0.42, 0.75, run) * go;
      const f = p[`a${side}f`] + sw;
      const out = p[`a${side}o`] + go * 0.02;
      const el = p[`e${side}`] + go * lerp(0.12, 1.15, run) + Math.max(0, sw) * 0.3;
      B[`arm${side}`].rotation.set(-f, sg * p[`a${side}t`], sg * out, 'ZXY');
      B[`fore${side}`].rotation.set(-el, 0, 0);
      B[`hand${side}`].rotation.set(-p[`w${side}`], 0, 0);
      B[`arm${side}`].quaternion.normalize();
    }

    // -- legs
    [['L', sn, cs], ['R', -sn, -cs]].forEach(([side, s, c], i) => {
      const sg = side === 'L' ? 1 : -1;
      // (the knee bends while that leg comes forward, and is straight again when the foot comes down in front)
      const knee = p[`k${side}`] + bend * Math.max(0, c) * Math.max(0, c) + go * 0.06;
      B[`thigh${side}`].rotation.set(-(p[`t${side}`] + swing * s + bend * 0.25 * Math.max(0, c)), 0, sg * p[`s${side}`], 'ZXY');
      B[`shin${side}`].rotation.set(knee, 0, 0);
      B[`foot${side}`].rotation.set(p[`f${side}`] + go * (0.2 * Math.max(0, -s) - 0.25 * Math.max(0, s) * Math.max(0, -c)), 0, 0);
      // the foot comes down as the leg is furthest forward
      const down = moving && s > 0.9;
      if (down && !this.stepped[i] && this.onStep) {
        B[`foot${side}`].updateWorldMatrix(true, false);
        this.onStep(_a.setFromMatrixPosition(B[`foot${side}`].matrixWorld).setY(0));
      }
      this.stepped[i] = down;
    });

    // -- head: pose + looking
    let lookYaw = 0;
    let lookPitch = 0;
    if (this.look && this.lookW > 0.01) {
      B.chest.updateWorldMatrix(true, false);
      _a.copy(this.look).sub(_b.setFromMatrixPosition(B.head.matrixWorld));
      _a.y -= 0.078 * this.S; // (her eyes are above where her head turns)
      B.chest.getWorldQuaternion(_q).invert();
      _a.applyQuaternion(_q);
      lookYaw = clamp(Math.atan2(_a.x, _a.z), -1.15, 1.15) * this.lookW;
      lookPitch = clamp(-Math.atan2(_a.y, Math.hypot(_a.x, _a.z)) - (p.nrx + p.hdx), -0.62, 0.6) * this.lookW;
    }
    this.lookYaw = damp(this.lookYaw, lookYaw, 6, dt);
    this.lookPitch = damp(this.lookPitch, lookPitch, 6, dt);
    const nod = Math.sin(cyc * 2 + 0.5) * 0.015 * go;
    B.neck.rotation.set(p.nrx + this.lookPitch * 0.4 + nod, p.nry + this.lookYaw * 0.4, p.nrz, 'YXZ');
    B.head.rotation.set(p.hdx + this.lookPitch * 0.6, p.hdy + this.lookYaw * 0.6, p.hdz + Math.sin(t * 0.7) * 0.012, 'YXZ');

    // -- a hand that reaches for a point: her arm bends at the elbow as it has to
    grp.updateMatrixWorld(true);
    rig.light.uMid.value.setFromMatrixPosition(B.chest.matrixWorld); // (where she is: her shadow is looked up from there)
    for (const side of ['L', 'R']) {
      const want = this.reach && this.reach.side === side ? 1 : 0;
      const w = (this.reachW[side] = damp(this.reachW[side], want, want ? 7 : 5, dt));
      if (w > 0.005 && this.reach && this.reach.side === side) this.solveArm(side, this.reach.point, w);
      else if (w > 0.005 && this.lastReach) this.solveArm(side, this.lastReach, w);
    }
    if (this.reach) this.lastReach = (this.lastReach || V()).copy(this.reach.point);

    // -- her hair: the tail hangs behind her left shoulder — it trails when she walks, swings out as she turns, bounces with her step
    const s = this.sway;
    const acc = (this.speed - this.lastSpeed) / Math.max(dt, 1e-3);
    this.lastSpeed = this.speed;
    const dBob = (bob - this.lastBob) / Math.max(dt, 1e-3);
    this.lastBob = bob;
    const driveX = clamp(this.speed * 4 + acc * 1.0, -8, 8) + clamp(dBob * 10, -4, 4); // (+ = back, away from her)
    const driveZ = this.smYawRate * 2.2 + Math.sin(t * 0.9) * 0.3; //                     (+ = to her left)
    const h = Math.min(dt, 0.033);
    s.vx += (driveX - 38 * s.x - 7 * s.vx) * h;
    s.x = clamp(s.x + s.vx * h, -0.1, 0.7); // (not forwards: her back is there)
    s.vz += (driveZ - 46 * s.z - 6 * s.vz) * h;
    s.z = clamp(s.z + s.vz * h, -0.4, 0.4);
    const links = rig.tail.length;
    for (let i = links - 1; i > 0; i--) {
      s.lagX[i] = damp(s.lagX[i], s.lagX[i - 1], 14, dt);
      s.lagZ[i] = damp(s.lagZ[i], s.lagZ[i - 1], 14, dt);
    }
    s.lagX[0] = s.x;
    s.lagZ[0] = s.z;
    // (and it hangs: what her head tips, the tail takes back — and when she turns her head, it does not swing all the way round with it)
    const tipX = B.head.rotation.x + B.neck.rotation.x + p.lean * 0.6;
    const tipZ = B.head.rotation.z + p.tilt;
    const turned = B.head.rotation.y + B.neck.rotation.y;
    rig.tail.forEach((name, i) => {
      const share = i ? 0.24 : 0.36;
      B[name].rotation.set(s.lagX[i] * share * 1.6 - (i < 2 ? tipX * 0.42 : 0), i ? 0 : -turned * 0.55, s.lagZ[i] * share * 1.4 - (i < 2 ? tipZ * 0.4 : 0) + (i === links - 1 ? Math.sin(t * 1.3) * 0.03 : 0));
    });
    B.lockL.rotation.set(s.lagX[1] * 0.4 - tipX * 0.5, 0, s.lagZ[1] * 0.3 - tipZ * 0.5);
    B.lockR.rotation.set(s.lagX[1] * 0.4 - tipX * 0.5, 0, s.lagZ[1] * 0.3 - tipZ * 0.5);

    // -- her umbrella stands upright in her hand; the bag hangs from it
    if (rig.umbrella.visible) {
      B.handL.getWorldQuaternion(rig.umbrella.quaternion).invert().multiply(_q.setFromAxisAngle(X_AXIS, -0.1));
    }

    // -- her face
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blinkT = 2 + Math.random() * 4;
      this.blink = 1;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const eyes = m.eyes === 'sleep' ? 'closed' : m.eyes !== 'open' ? m.eyes : this.blink > 0.66 ? 'half' : this.blink > 0.3 ? 'closed' : this.blink > 0 ? 'half' : 'open';
    const mouth = m.mouth > 0.6 ? 'open' : m.mouth > 0.25 ? 'o' : m.smile > 0.4 || m.eyes === 'happy' ? 'smile' : 'flat';
    rig.face.show(eyes, mouth, m.blush > 0.5);
  }

  /** Two bones from her shoulder reaching for a point: where the elbow goes, and how both are turned (blended in by `w`). */
  solveArm(side, point, w) {
    const B = this.rig.bones;
    const sg = side === 'L' ? 1 : -1;
    const arm = B[`arm${side}`];
    const fore = B[`fore${side}`];
    const l1 = this.len.upper * this.S;
    const l2 = this.len.fore * this.S;
    arm.updateWorldMatrix(true, false);
    const S = _a.setFromMatrixPosition(arm.matrixWorld);
    const D = _b.copy(point).sub(S);
    let dist = D.length();
    if (dist < 1e-5) return;
    D.divideScalar(dist);
    dist = clamp(dist, Math.abs(l1 - l2) + 0.004, (l1 + l2) * 0.985);
    const along = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    const off = Math.sqrt(Math.max(0, l1 * l1 - along * along));
    // the elbow: below the line from shoulder to hand, and a little out to her side
    B.chest.getWorldQuaternion(_qp);
    const hint = _c.set(sg * 0.5, -1, -0.35).applyQuaternion(_qp);
    hint.addScaledVector(D, -hint.dot(D)).normalize();
    const E = _d.copy(S).addScaledVector(D, along).addScaledVector(hint, off);
    const T = _e.copy(S).addScaledVector(D, dist);
    // the upper arm, in the chest's own frame
    const [rest1, rest2] = this.restDir[side];
    _q.copy(_qp).invert();
    const d1 = _c.copy(E).sub(S).normalize().applyQuaternion(_q);
    _q2.setFromUnitVectors(rest1, d1);
    arm.quaternion.slerp(_q2, w);
    arm.updateWorldMatrix(false, false);
    // …and the forearm, in the upper arm's
    arm.getWorldQuaternion(_q).invert();
    const d2 = _c.copy(T).sub(E).normalize().applyQuaternion(_q);
    _q2.setFromUnitVectors(rest2, d2);
    fore.quaternion.slerp(_q2, w);
    arm.updateWorldMatrix(false, true);
  }
}
