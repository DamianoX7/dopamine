// What every dish is made of (food.js: the courier's; snacks.js: the convenience store's and the café's; meals.js: what
// she cooks herself): small shapes that can come and go as she eats, marks to find a place on a dish by, clear plastic,
// bowls turned on a lathe — and pieces eaten one after another.
import * as THREE from '../vendor/three.module.min.js';
import { Batch, MAT } from './shapes.js';

/* One small shape as a mesh of its own (so that it can come and go as she eats), in a shared material. */
export function piece(geometry, color, { at = [0, 0, 0], rot = [0, 0, 0], scale = 1, mat = 'paint', flat = false } = {}) {
  const m = new Batch().add(geometry, { color, flat }).mesh(MAT[mat]);
  m.position.set(...at);
  m.rotation.set(...rot);
  if (Array.isArray(scale)) m.scale.set(...scale);
  else m.scale.setScalar(scale);
  return m;
}

/* An empty point to find a place on the dish by (where it goes to her mouth; the top of the bowl; a chopstick's tip). */
export function mark(x, y, z) {
  const o = new THREE.Object3D();
  o.position.set(x, y, z);
  return o;
}

/* Clear plastic: the cup, its lid. */
export function clear(opacity = 0.3) {
  return new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0, transparent: true, opacity, depthWrite: false });
}

/* A bowl turned on a lathe: its outside up from `foot` to the rim, and its inside back down (radius, height pairs). */
export function bowlGeometry(profile, seg = 28) {
  return new THREE.LatheGeometry(
    profile.map(([r, y]) => new THREE.Vector2(r, y)),
    seg
  );
}

/* Pieces that are eaten one after another: of `list`, as many show as `k` (1 … 0) leaves. */
export function eatAway(list, k) {
  const n = Math.ceil(list.length * Math.max(0, Math.min(1, k)) - 1e-6);
  list.forEach((m, i) => (m.visible = i < n));
}

/* A label painted on a canvas (a cup's sleeve, a wrapper, a carton's front), as a texture. */
export function labelTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}
