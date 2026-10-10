// Small building kit shared by the habitats and the fox's things: seeded randomness, painted
// canvas textures, emoji sprites, and a batch that bakes many little shapes into one mesh.
import * as THREE from '../vendor/three.module.min.js';

export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const TAU = Math.PI * 2;

export function rng(seed) {
  let a = seed | 0;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.range = (lo, hi) => lo + (hi - lo) * next();
  next.pick = (arr) => arr[Math.floor(next() * arr.length)];
  return next;
}

// ------------------------------------------------------------------ textures

/** A square canvas texture. `draw(g, size)` paints it; `tile` makes it repeat. */
export function paintTexture(size, draw, { tile = 0 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d'), size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  if (tile) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(tile, tile);
  }
  return tex;
}

/** Calls `fn(x, y)` at every wrapped copy of (x, y) that could reach into the tile, so textures tile seamlessly. */
export function wrapped(size, x, y, reach, fn) {
  for (const dx of [0, x < reach ? size : x > size - reach ? -size : null]) {
    if (dx === null) continue;
    for (const dy of [0, y < reach ? size : y > size - reach ? -size : null]) {
      if (dy === null) continue;
      fn(x + dx, y + dy);
    }
  }
}

/** Soft colour patches. */
export function blotches(g, size, rnd, count, colors, rMin, rMax, alpha) {
  for (let i = 0; i < count; i++) {
    const r = rnd.range(rMin, rMax);
    const color = rnd.pick(colors);
    wrapped(size, rnd() * size, rnd() * size, r, (x, y) => {
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, color);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.globalAlpha = alpha;
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    });
  }
  g.globalAlpha = 1;
}

/** Short strokes: blades of grass, straw, scratches. `spread` = how far the angle strays from `angle`. */
export function strokes(g, size, rnd, count, colors, lenMin, lenMax, width, angle = -Math.PI / 2, spread = 0.5, alpha = 0.8) {
  g.lineCap = 'round';
  for (let i = 0; i < count; i++) {
    const len = rnd.range(lenMin, lenMax);
    const a = angle + (rnd() - 0.5) * 2 * spread;
    g.strokeStyle = rnd.pick(colors);
    g.globalAlpha = alpha * rnd.range(0.5, 1);
    g.lineWidth = width * rnd.range(0.6, 1.3);
    wrapped(size, rnd() * size, rnd() * size, len, (x, y) => {
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      g.stroke();
    });
  }
  g.globalAlpha = 1;
}

export function dots(g, size, rnd, count, colors, rMin, rMax, alpha = 1) {
  for (let i = 0; i < count; i++) {
    const r = rnd.range(rMin, rMax);
    g.fillStyle = rnd.pick(colors);
    g.globalAlpha = alpha * rnd.range(0.6, 1);
    wrapped(size, rnd() * size, rnd() * size, r, (x, y) => {
      g.beginPath();
      g.ellipse(x, y, r, r * rnd.range(0.6, 1), rnd() * 3, 0, TAU);
      g.fill();
    });
  }
  g.globalAlpha = 1;
}

const glyphCache = new Map();
/** A sprite material showing an emoji or a short piece of text. */
export function glyphMaterial(glyph, color) {
  const key = glyph + (color || '');
  if (glyphCache.has(key)) return glyphCache.get(key);
  const tex = paintTexture(96, (g, s) => {
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${color ? '700 ' : ''}${s * 0.7}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", Jua, sans-serif`;
    if (color) g.fillStyle = color;
    g.fillText(glyph, s / 2, s / 2 + s * 0.04);
  });
  tex.userData.shared = true;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
  mat.userData.shared = true; // kept for the whole session (see disposeTree)
  glyphCache.set(key, mat);
  return mat;
}

let softDot = null;
/** A round, soft-edged dot for point clouds (snow, pollen, fireflies). */
export function softDotTexture() {
  if (!softDot) {
    softDot = paintTexture(64, (g, s) => {
      const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
      grad.addColorStop(0, 'rgba(255,255,255,1)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.75)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, s, s);
    });
    softDot.userData.shared = true;
  }
  return softDot;
}

// ------------------------------------------------------------------ batch

const _n = V();
const _p = V();
const _ab = V();
const _cb = V();
const _nm = new THREE.Matrix3();
const _c = new THREE.Color();
const _c2 = new THREE.Color();

/**
 * Bakes any number of geometries (moved, scaled, coloured) into one vertex-coloured mesh, so
 * a whole habitat costs a single draw call. Colours: a hex, or [bottom, top] for a gradient
 * over the height of the piece, or a function (position, normal) → THREE.Color. `rot` may end
 * with an Euler order ('YXZ').
 */
export class Batch {
  constructor() {
    this.pos = [];
    this.nor = [];
    this.col = [];
  }

  add(geometry, { at = [0, 0, 0], rot = [0, 0, 0], scale = 1, color = '#ffffff', flat = false, byFace = false, matrix = null } = {}) {
    const m = matrix || new THREE.Matrix4().compose(V(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), Array.isArray(scale) ? V(...scale) : V(scale, scale, scale));
    const g = geometry.index ? geometry.toNonIndexed() : geometry;
    const src = g.attributes.position;
    const srcN = g.attributes.normal;
    _nm.getNormalMatrix(m);
    const start = this.pos.length;
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < src.count; i++) {
      _p.fromBufferAttribute(src, i).applyMatrix4(m);
      this.pos.push(_p.x, _p.y, _p.z);
      lo = Math.min(lo, _p.y);
      hi = Math.max(hi, _p.y);
      if (!flat && srcN) {
        _n.fromBufferAttribute(srcN, i).applyMatrix3(_nm).normalize();
        this.nor.push(_n.x, _n.y, _n.z);
      }
    }
    if (flat || !srcN) {
      for (let i = start; i < this.pos.length; i += 9) {
        _p.set(this.pos[i], this.pos[i + 1], this.pos[i + 2]);
        _ab.set(this.pos[i + 3], this.pos[i + 4], this.pos[i + 5]).sub(_p);
        _cb.set(this.pos[i + 6], this.pos[i + 7], this.pos[i + 8]).sub(_p);
        _n.crossVectors(_ab, _cb).normalize();
        for (let k = 0; k < 3; k++) this.nor.push(_n.x, _n.y, _n.z);
      }
    }
    const grad = Array.isArray(color);
    if (grad) {
      _c.set(color[0]);
      _c2.set(color[1]);
    } else if (typeof color !== 'function') _c.set(color);
    for (let i = start; i < this.pos.length; i += 3) {
      if (typeof color === 'function') {
        // byFace: one colour per triangle, asked at its centre (crisp checks and stripes)
        const j = byFace ? start + Math.floor((i - start) / 9) * 9 : i;
        if (byFace) _p.set((this.pos[j] + this.pos[j + 3] + this.pos[j + 6]) / 3, (this.pos[j + 1] + this.pos[j + 4] + this.pos[j + 7]) / 3, (this.pos[j + 2] + this.pos[j + 5] + this.pos[j + 8]) / 3);
        else _p.set(this.pos[i], this.pos[i + 1], this.pos[i + 2]);
        _n.set(this.nor[j], this.nor[j + 1], this.nor[j + 2]);
        const c = color(_p, _n);
        this.col.push(c.r, c.g, c.b);
      } else if (grad) {
        const t = hi > lo ? (this.pos[i + 1] - lo) / (hi - lo) : 0;
        this.col.push(lerp(_c.r, _c2.r, t), lerp(_c.g, _c2.g, t), lerp(_c.b, _c2.b, t));
      } else this.col.push(_c.r, _c.g, _c.b);
    }
    if (g !== geometry) g.dispose();
    geometry.dispose();
    return this;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }

  mesh(material) {
    const mesh = new THREE.Mesh(this.geometry(), material || new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    return mesh;
  }
}

/** Frees the geometries, materials and textures of everything below `root`. */
export function disposeTree(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      if (m.userData && m.userData.shared) return;
      if (m.map && !m.map.userData.shared) m.map.dispose();
      m.dispose();
    });
  });
}
