// Everything that can stand in the house, or hang on its walls. Each piece is built here at
// Lorelei's measure (she is 1.3 tall, her knees at 0.3, her hips at 0.5): a seat is as high
// as her knees, a desk as her hips. A piece stands on the floor at the origin with its front
// to +Z; a thing for the wall hangs with its back on the wall (z = 0), its middle at the origin.
//
// FURNITURE[id] = { w, d, h, kind: 'floor' | 'rug' | 'wall', build(opts) }. w × d is the ground
// it takes (in whole squares of the floor's grid, CELL), before it is turned. build() gives
// { object, seats?, spot?, light?, set?(what, value), update?(dt, time, ctx) }: where Lorelei
// can sit (local: x, z, y = the seat's height, yaw = the way she faces), where she stands to look
// at it, the light it gives, what the app can change on it (a photo, a record, a letter in the
// box), and how it moves.
import * as THREE from '../vendor/three.module.min.js';
import { makeTree, makeLantern } from '../fox/props.js';
import { softDotTexture } from '../fox/kit.js';
import { Batch, Parts, MAT, V, TAU, rng, roundBox, pole, tube, heart, fabric, paintTexture } from './shapes.js';

export const CELL = 0.25; // the floor's grid

const _c = new THREE.Color();
/** A colour a little lighter (k > 0) or darker (k < 0). */
const tone = (hex, k) => '#' + _c.set(hex).offsetHSL(0, 0, k).getHexString();

const OAK = ['#c48c58', '#e0b381'];
const WALNUT = ['#8e5b3b', '#ad7652'];
const WHITE = ['#ece4dd', '#ffffff'];
const CREAM = ['#e7d6c1', '#fbf2e6'];
const GOLD = '#e9c26a';
const STEEL = '#c6c7d2';
const INK = '#3a3340';
const LEAF = ['#3f8a4c', '#7cc56c'];

/* Four legs at the corners of w × d, h tall. */
function legs(b, w, d, h, r = 0.022, color = OAK, taper = 0.75) {
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.add(new THREE.CylinderGeometry(r * taper, r, h, 8), { at: [(sx * w) / 2, h / 2, (sz * d) / 2], color });
}

/** A soft glow round a light (a sprite that adds to the picture: no lamp in the shader). */
function glow(color, size) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  s.renderOrder = 8;
  return s;
}

/** A canvas to paint on, as a texture. */
function canvasTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** What a frame shows before she has chosen a picture for it. */
function emptyPhoto(w, h) {
  return canvasTexture(w, h, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#ffe4ee');
    grad.addColorStop(1, '#fff6e9');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.globalAlpha = 0.5;
    g.font = `${Math.round(Math.min(W, H) * 0.34)}px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('📷', W / 2, H / 2 - H * 0.04);
    g.globalAlpha = 0.7;
    g.fillStyle = '#d97a9c';
    g.font = `700 ${Math.round(Math.min(W, H) * 0.1)}px Jua, sans-serif`;
    g.fillText('사진을 골라 주세요', W / 2, H * 0.8);
  });
}

/** A picture (an image or a canvas) cut to fill w × h as a cover does: the middle of it, as much as fits. */
export function coverTexture(img, aspect, px = 512) {
  const w = aspect >= 1 ? px : Math.round(px * aspect);
  const h = aspect >= 1 ? Math.round(px / aspect) : px;
  return canvasTexture(w, h, (g, W, H) => {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const k = Math.max(W / iw, H / ih);
    const sw = W / k;
    const sh = H / k;
    g.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, 0, 0, W, H);
  });
}

// ------------------------------------------------------------------ seats

function sofa(colors) {
  const [lo, hi] = colors;
  const P = new Parts();
  const f = P.get('fabric');
  const W = 1.44;
  const D = 0.68;
  legs(P.get('wood'), W - 0.14, D - 0.14, 0.075, 0.022, WALNUT);
  f.add(roundBox(W, 0.17, D, 0.05), { at: [0, 0.16, 0], color: [tone(lo, -0.08), lo] });
  for (const sx of [-1, 1]) f.add(roundBox(0.6, 0.12, 0.52, 0.055), { at: [sx * 0.305, 0.295, 0.06], color: [lo, hi] });
  f.add(roundBox(W - 0.08, 0.4, 0.18, 0.08), { at: [0, 0.44, -0.245], rot: [-0.09, 0, 0], color: [lo, hi] });
  for (const sx of [-1, 1]) f.add(roundBox(0.16, 0.29, D, 0.075), { at: [sx * (W / 2 - 0.08), 0.345, 0], color: [lo, hi] });
  // a cushion and a heart
  f.add(roundBox(0.27, 0.25, 0.09, 0.05), { at: [-0.43, 0.45, -0.1], rot: [-0.28, 0.3, 0.12], color: ['#f6eee7', '#ffffff'] });
  f.add(heart(0.26, 0.07), { at: [0.44, 0.47, -0.11], rot: [-0.28, -0.3, -0.05], color: ['#ff6f9c', '#ff94b6'] });
  return {
    object: P.bake(new THREE.Group()),
    seats: [{ x: -0.3, z: 0.1, y: 0.355, yaw: 0 }, { x: 0.3, z: 0.1, y: 0.355, yaw: 0 }],
    spot: { x: 0, z: 0.7, yaw: Math.PI },
  };
}

function armchair(colors) {
  const [lo, hi] = colors;
  const P = new Parts();
  const f = P.get('fabric');
  const W = 0.84;
  const D = 0.7;
  legs(P.get('wood'), W - 0.16, D - 0.16, 0.08, 0.022, WALNUT);
  f.add(roundBox(W, 0.17, D, 0.05), { at: [0, 0.165, 0], color: [tone(lo, -0.08), lo] });
  f.add(roundBox(0.54, 0.12, 0.54, 0.055), { at: [0, 0.3, 0.06], color: [lo, hi] });
  f.add(roundBox(W - 0.02, 0.52, 0.17, 0.08), { at: [0, 0.5, -0.255], rot: [-0.1, 0, 0], color: [lo, hi] });
  for (const sx of [-1, 1]) f.add(roundBox(0.15, 0.3, D, 0.07), { at: [sx * (W / 2 - 0.075), 0.35, 0], color: [lo, hi] });
  f.add(roundBox(0.25, 0.22, 0.08, 0.05), { at: [0, 0.46, -0.13], rot: [-0.25, 0, 0.08], color: ['#f6eee7', '#ffffff'] });
  return { object: P.bake(new THREE.Group()), seats: [{ x: 0, z: 0.1, y: 0.36, yaw: 0 }], spot: { x: 0, z: 0.62, yaw: Math.PI } };
}

function chair() {
  const P = new Parts();
  const w = P.get('wood');
  legs(w, 0.34, 0.32, 0.28, 0.018, OAK);
  w.add(roundBox(0.42, 0.045, 0.4, 0.02), { at: [0, 0.3, 0], color: OAK });
  for (const sx of [-1, 1]) pole(w, [sx * 0.17, 0.3, -0.17], [sx * 0.17, 0.68, -0.2], 0.016, OAK);
  w.add(roundBox(0.42, 0.15, 0.035, 0.015), { at: [0, 0.61, -0.195], rot: [-0.08, 0, 0], color: OAK });
  P.get('fabric').add(roundBox(0.36, 0.04, 0.34, 0.018), { at: [0, 0.34, 0.01], color: ['#f59bbb', '#ffc4d6'] });
  return { object: P.bake(new THREE.Group()), seats: [{ x: 0, z: 0.03, y: 0.36, yaw: 0 }] };
}

function beanbag() {
  const P = new Parts();
  const g = new THREE.IcosahedronGeometry(0.36, 4);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i);
    let y = p.getY(i);
    let z = p.getZ(i);
    const r2 = (x * x + z * z) / 0.13;
    // squashed, flat underneath, and a hollow sat into on top (towards the back it stays higher)
    y = y * 0.62;
    if (y > 0) y -= 0.1 * Math.exp(-r2 * 1.6) * (z > -0.05 ? 1 : 0.4);
    if (y < -0.12) y = -0.12 - (y + 0.12) * 0.15;
    const bulge = 1 + 0.06 * Math.sin(x * 23 + z * 17) * Math.sin(y * 19);
    p.setXYZ(i, x * bulge, y + 0.135, z * bulge);
  }
  g.computeVertexNormals();
  P.get('fabric').add(g, { color: ['#a693e0', '#cbbcf6'] });
  return { object: P.bake(new THREE.Group()), seats: [{ x: 0, z: 0.04, y: 0.26, yaw: 0 }], spot: { x: 0, z: 0.6, yaw: Math.PI } };
}

// ------------------------------------------------------------------ the bed

function bed(quilt) {
  const P = new Parts();
  const w = P.get('wood');
  const W = 1.44;
  const L = 1.94;
  legs(w, W - 0.1, L - 0.1, 0.07, 0.025, OAK);
  w.add(roundBox(W, 0.15, L, 0.03), { at: [0, 0.14, 0], color: OAK });
  // the headboard: a board with a round top
  const s = new THREE.Shape();
  s.moveTo(-W / 2, 0);
  s.lineTo(W / 2, 0);
  s.lineTo(W / 2, 0.5);
  s.quadraticCurveTo(W / 2, 0.78, 0, 0.8);
  s.quadraticCurveTo(-W / 2, 0.78, -W / 2, 0.5);
  const hb = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2, curveSegments: 16 });
  w.add(hb, { at: [0, 0.1, -L / 2 + 0.01], color: OAK });
  w.add(heart(0.16, 0.03), { at: [0, 0.7, -L / 2 + 0.09], color: ['#ff7fa8', '#ff9cbc'] });
  const f = P.get('fabric');
  f.add(roundBox(W - 0.06, 0.13, L - 0.1, 0.05), { at: [0, 0.275, 0.02], color: ['#f2ede8', '#ffffff'] });
  for (const sx of [-1, 1]) f.add(roundBox(0.52, 0.12, 0.32, 0.055), { at: [sx * 0.34, 0.39, -L / 2 + 0.27], rot: [-0.32, 0, 0], color: ['#f4ece6', '#ffffff'] });
  f.add(roundBox(W + 0.02, 0.065, 0.16, 0.03), { at: [0, 0.37, -0.12], color: ['#f2ede8', '#ffffff'] }); // (the sheet, turned down over the quilt)
  const group = P.bake(new THREE.Group());
  // the quilt: patterned, over the top and down the sides
  const mat = new THREE.MeshStandardMaterial({ map: fabric(quilt.id, quilt.colors), roughness: 0.95 });
  const top = new THREE.Mesh(roundBox(W + 0.03, 0.05, 1.18, 0.025), mat);
  top.position.set(0, 0.365, 0.33);
  const sides = [-1, 1].map((sx) => {
    const m = new THREE.Mesh(roundBox(0.035, 0.22, 1.18, 0.015), mat);
    m.position.set(sx * (W / 2 + 0.01), 0.27, 0.33);
    return m;
  });
  const foot = new THREE.Mesh(roundBox(W + 0.03, 0.22, 0.035, 0.015), mat);
  foot.position.set(0, 0.27, L / 2 - 0.02);
  for (const m of [top, ...sides, foot]) {
    m.castShadow = m.receiveShadow = true;
    group.add(m);
  }
  return { object: group, seats: [{ x: 0, z: L / 2 - 0.16, y: 0.4, yaw: 0 }], spot: { x: 0, z: L / 2 + 0.45, yaw: Math.PI } };
}

// ------------------------------------------------------------------ the desk, and her diary on it

/* The paper of a diary page she has not written (or an empty one): lines, and a heart in the corner. */
function linedPage(w, h, left) {
  return canvasTexture(w, h, (g, W, H) => {
    g.fillStyle = '#fffaf2';
    g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(150, 170, 220, 0.5)';
    g.lineWidth = 2;
    for (let y = H * 0.16; y < H * 0.95; y += H / 16) {
      g.beginPath();
      g.moveTo(W * 0.08, y);
      g.lineTo(W * 0.92, y);
      g.stroke();
    }
    g.fillStyle = left ? '#ffb3c9' : '#ffd27a';
    g.font = `${Math.round(H * 0.08)}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    g.fillText(left ? '💗' : '✨', W * (left ? 0.08 : 0.8), H * 0.11);
  });
}

function desk() {
  const P = new Parts();
  const w = P.get('wood');
  const p = P.get('paint');
  w.add(roundBox(0.96, 0.04, 0.46, 0.015), { at: [0, 0.48, 0], color: OAK });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) p.add(roundBox(0.04, 0.46, 0.04, 0.01), { at: [sx * 0.44, 0.23, sz * 0.19], color: WHITE });
  p.add(roundBox(0.3, 0.27, 0.42, 0.02), { at: [0.29, 0.33, 0], color: WHITE });
  p.add(roundBox(0.27, 0.005, 0.01, 0.002), { at: [0.29, 0.33, 0.212], color: '#d8cfc7' });
  P.get('metal').add(new THREE.SphereGeometry(0.016, 10, 8), { at: [0.29, 0.39, 0.215], color: GOLD });
  P.get('metal').add(new THREE.SphereGeometry(0.016, 10, 8), { at: [0.29, 0.27, 0.215], color: GOLD });
  // a desk lamp at the back on the left
  const m = P.get('gloss');
  m.add(new THREE.CylinderGeometry(0.06, 0.07, 0.022, 20), { at: [-0.36, 0.511, -0.14], color: ['#ff9cbc', '#ffb9d0'] });
  pole(m, [-0.36, 0.52, -0.14], [-0.33, 0.74, -0.1], 0.01, '#ff9cbc');
  pole(m, [-0.33, 0.74, -0.1], [-0.22, 0.79, -0.02], 0.01, '#ff9cbc');
  const group = P.bake(new THREE.Group());
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#ff9cbc', roughness: 0.35, emissive: '#ffd9a0', emissiveIntensity: 0, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.085, 0.09, 20, 1, true), shadeMat);
  shade.position.set(-0.21, 0.755, -0.01);
  shade.rotation.z = 0.35;
  shade.castShadow = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: '#d9d2c6' }));
  bulb.position.set(-0.2, 0.725, -0.01);
  const halo = glow('#ffcf8a', 0.45);
  halo.position.set(-0.19, 0.69, 0);
  group.add(shade, bulb, halo);

  // her diary: open, its right page the last one she wrote
  const book = new THREE.Group();
  book.position.set(-0.03, 0.502, 0.06);
  book.rotation.y = 0.12;
  const cover = new THREE.Mesh(roundBox(0.42, 0.014, 0.28, 0.006), new THREE.MeshStandardMaterial({ color: '#ff8fb2', roughness: 0.7 }));
  cover.position.y = 0.007;
  cover.castShadow = cover.receiveShadow = true;
  book.add(cover);
  const pageGeo = new THREE.PlaneGeometry(0.195, 0.26);
  pageGeo.rotateX(-Math.PI / 2);
  const leftMat = new THREE.MeshStandardMaterial({ map: linedPage(256, 340, true), roughness: 0.9 });
  const rightMat = new THREE.MeshStandardMaterial({ map: linedPage(256, 340, false), roughness: 0.9 });
  const blank = rightMat.map;
  const left = new THREE.Mesh(pageGeo, leftMat);
  left.position.set(-0.1, 0.019, 0);
  left.rotation.z = 0.06;
  const right = new THREE.Mesh(pageGeo, rightMat);
  right.position.set(0.1, 0.019, 0);
  right.rotation.z = -0.06;
  left.receiveShadow = right.receiveShadow = true;
  book.add(left, right);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.16, 8), new THREE.MeshStandardMaterial({ color: '#7fb6ff', roughness: 0.4 }));
  pen.rotation.set(Math.PI / 2, 0, 0.5);
  pen.position.set(0.24, 0.012, 0.03);
  book.add(pen);
  const sparkle = glow('#ffe7a0', 0.32);
  sparkle.position.set(0.05, 0.12, 0);
  book.add(sparkle);
  group.add(book);
  let lit = false;
  let ready = false;
  return {
    object: group,
    spot: { x: -0.05, z: 0.55, yaw: Math.PI },
    light: { at: [-0.2, 0.7, 0], color: '#ffd9a0', power: 0.55, range: 1.8, small: true },
    set(what, v) {
      if (what === 'on') {
        lit = !!v;
        shadeMat.emissiveIntensity = lit ? 0.8 : 0;
        bulb.material.color.set(lit ? '#fff4d6' : '#d9d2c6');
      } else if (what === 'page') {
        // (a canvas of the last page she wrote: js/diary.js paints it)
        const old = rightMat.map;
        rightMat.map = v ? coverTexture(v, 0.195 / 0.26, 420) : blank;
        if (old !== blank && old !== rightMat.map) old.dispose();
        rightMat.needsUpdate = true;
      } else if (what === 'ready') ready = !!v;
    },
    update(dt, t) {
      halo.material.opacity = lit ? 0.55 : 0;
      sparkle.material.opacity = ready ? 0.55 + 0.35 * Math.sin(t * 3.1) : 0;
    },
  };
}

// ------------------------------------------------------------------ the record cabinet and its turntable

/* The arm of the turntable: its angle for the needle at `rho` from the middle of the record (the arm is `len` long, its pivot at `px`, `pz` from the middle). */
function armAngle(rho, px, pz, len) {
  let best = 0;
  let err = Infinity;
  for (let a = 0; a > -1.6; a -= 0.004) {
    const x = px + len * Math.sin(a);
    const z = pz + len * Math.cos(a);
    const e = Math.abs(Math.hypot(x, z) - rho);
    if (e < err) {
      err = e;
      best = a;
    }
  }
  return best;
}

function record() {
  const P = new Parts();
  const w = P.get('wood');
  const W = 1.2;
  const D = 0.44;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pole(w, [sx * (W / 2 - 0.08), 0, sz * (D / 2 - 0.07)], [sx * (W / 2 - 0.06), 0.06, sz * (D / 2 - 0.06)], 0.016, WALNUT);
  w.add(roundBox(W, 0.44, D, 0.025), { at: [0, 0.28, 0], color: WALNUT });
  // two cubbies in the front for the records, a board between them
  for (const sx of [-1, 1]) w.add(new THREE.BoxGeometry(0.54, 0.36, 0.01), { at: [sx * 0.285, 0.28, D / 2 + 0.002], color: ['#3a2622', '#4e332c'] });
  w.add(roundBox(0.03, 0.38, 0.02, 0.008), { at: [0, 0.28, D / 2 + 0.006], color: WALNUT });
  // the turntable on top: its plinth, the platter, the arm's pivot; and a stand for the sleeve
  const p = P.get('paint');
  p.add(roundBox(0.62, 0.07, 0.4, 0.02), { at: [-0.22, 0.535, 0], color: CREAM });
  const m = P.get('metal');
  m.add(new THREE.CylinderGeometry(0.028, 0.032, 0.03, 14), { at: [-0.22 + 0.22, 0.585, -0.13], color: STEEL });
  m.add(new THREE.CylinderGeometry(0.012, 0.012, 0.02, 10), { at: [-0.22 + 0.25, 0.58, 0.14], color: STEEL }); // (the rest the arm lies on)
  P.get('gloss').add(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 12), { at: [-0.22 + 0.24, 0.576, 0.17], color: '#ff6fa0' }); // (its light)
  pole(m, [0.36, 0.5, -0.06], [0.36, 0.64, -0.1], 0.006, STEEL);
  m.add(roundBox(0.24, 0.012, 0.03, 0.005), { at: [0.36, 0.508, 0.05], color: STEEL });
  const group = P.bake(new THREE.Group());

  const cx = -0.22;
  const spin = new THREE.Group();
  spin.position.set(cx, 0.575, 0);
  const platter = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.175, 0.016, 48), new THREE.MeshStandardMaterial({ color: '#c9c9d6', roughness: 0.3, metalness: 0.7 }));
  platter.castShadow = platter.receiveShadow = true;
  spin.add(platter);
  const discGeo = new THREE.CircleGeometry(0.168, 64);
  discGeo.rotateX(-Math.PI / 2);
  const vinyl = canvasTexture(256, 256, (g, S) => {
    g.fillStyle = '#16141a';
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, TAU);
    g.fill();
    g.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    for (let r = S * 0.2; r < S * 0.49; r += 3) {
      g.beginPath();
      g.arc(S / 2, S / 2, r, 0, TAU);
      g.stroke();
    }
    g.fillStyle = '#ff8fb2';
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.17, 0, TAU);
    g.fill();
  });
  const discMat = new THREE.MeshStandardMaterial({ map: vinyl, roughness: 0.32, metalness: 0.1, transparent: true });
  const disc = new THREE.Mesh(discGeo, discMat);
  disc.position.y = 0.0095;
  disc.receiveShadow = true;
  spin.add(disc);
  const spindle = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.03, 8), new THREE.MeshStandardMaterial({ color: STEEL, metalness: 0.8, roughness: 0.3 }));
  spindle.position.y = 0.02;
  spin.add(spindle);
  group.add(spin);

  // the arm: from its pivot towards the front, a headshell at its end
  const PX = 0.22;
  const PZ = -0.13;
  const LEN = 0.25;
  const arm = new THREE.Group();
  arm.position.set(cx + PX, 0.6, PZ);
  const ab = new Batch();
  pole(ab, [0, 0, -0.04], [0, 0, LEN - 0.03], 0.0065, STEEL);
  ab.add(roundBox(0.03, 0.012, 0.05, 0.004), { at: [-0.006, -0.004, LEN - 0.01], rot: [0, -0.35, 0], color: INK });
  ab.add(new THREE.CylinderGeometry(0.016, 0.016, 0.03, 10), { at: [0, 0, -0.05], rot: [Math.PI / 2, 0, 0], color: INK });
  const armMesh = ab.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 }));
  arm.add(armMesh);
  group.add(arm);
  const REST = 0.06;
  const ON = { from: armAngle(0.155, PX, PZ, LEN), to: armAngle(0.07, PX, PZ, LEN) };
  arm.rotation.y = REST;

  // the sleeve of the album that is on, on its stand
  const sleeveMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });
  const plain = canvasTexture(128, 128, (g, S) => {
    const grad = g.createLinearGradient(0, 0, S, S);
    grad.addColorStop(0, '#ffb3c9');
    grad.addColorStop(1, '#ffe0a8');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    g.font = `${S * 0.5}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('💿', S / 2, S / 2);
  });
  sleeveMat.map = plain;
  const sleeve = new THREE.Mesh(roundBox(0.24, 0.24, 0.008, 0.004), [null, null, null, null, null, null].map((x, i) => (i === 4 ? sleeveMat : new THREE.MeshStandardMaterial({ color: '#f3ece6', roughness: 0.7 }))));
  sleeve.position.set(0.36, 0.635, -0.05);
  sleeve.rotation.x = -0.3;
  sleeve.castShadow = true;
  group.add(sleeve);

  // the records in the cubbies: a spine for every one she has pressed, in its colour
  const spines = new THREE.Group();
  group.add(spines);
  const spineMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
  let playing = false;
  let progress = 0;
  let speed = 0;
  let note = 1;
  const self = {
    object: group,
    spot: { x: -0.1, z: 0.6, yaw: Math.PI },
    get playing() {
      return playing;
    },
    set(what, v) {
      if (what === 'record') {
        // { disc: canvas of the record (js/lp.js), art: the album's artwork (an image), playing, progress 0 … 1 } — or null
        if (v && v.disc !== self.discSrc) {
          self.discSrc = v.disc;
          const old = discMat.map;
          discMat.map = v.disc ? new THREE.CanvasTexture(v.disc) : vinyl;
          discMat.map.colorSpace = THREE.SRGBColorSpace;
          discMat.map.anisotropy = 4;
          if (old !== vinyl) old.dispose();
          discMat.needsUpdate = true;
        }
        if (!v || v.art !== self.artSrc) {
          self.artSrc = v ? v.art : null;
          const old = sleeveMat.map;
          sleeveMat.map = v && v.art ? coverTexture(v.art, 1, 256) : plain;
          if (old !== plain) old.dispose();
          sleeveMat.needsUpdate = true;
        }
        playing = !!(v && v.playing);
        progress = v ? v.progress || 0 : 0;
      } else if (what === 'spines') {
        // the colours of her records' vinyl: [{ base, edge }]
        spines.children.splice(0).forEach((o) => o.geometry.dispose());
        if (!v.length) return;
        const b = new Batch();
        const rnd = rng(7);
        const n = Math.min(v.length, 22);
        for (let i = 0; i < n; i++) {
          // (the left cubby first, from its left; eleven to a cubby)
          const x = (i < 11 ? -0.285 : 0.285) - 0.21 + (i % 11) * 0.042;
          const c = v[i];
          b.add(roundBox(0.02, 0.32, 0.03, 0.006), { at: [x + rnd.range(-0.004, 0.004), 0.28, 0.222], rot: [0, 0, rnd.range(-0.05, 0.05)], color: [tone(c, -0.1), c] });
        }
        const mesh = b.mesh(spineMat);
        spines.add(mesh);
      }
    },
    update(dt, t, ctx) {
      speed += ((playing ? 3.49 : 0) - speed) * (1 - Math.exp(-dt * (playing ? 2.5 : 1.6)));
      spin.rotation.y -= speed * dt;
      const target = playing ? ON.from + (ON.to - ON.from) * Math.min(1, Math.max(0, progress)) : REST;
      arm.rotation.y += (target - arm.rotation.y) * (1 - Math.exp(-dt * 3));
      // while it plays: little notes come up out of it, to the beat if there is one
      if (playing && ctx && ctx.fx) {
        note -= dt;
        if (note <= 0) {
          note = 0.9 + Math.random() * 0.7;
          ctx.fx(Math.random() < 0.5 ? '♪' : '♫', group.localToWorld(V(cx + (Math.random() - 0.5) * 0.2, 0.68, 0.05)));
        }
      }
    },
  };
  return self;
}

// ------------------------------------------------------------------ tables, shelves, wardrobe

function table() {
  const P = new Parts();
  const w = P.get('wood');
  w.add(roundBox(0.92, 0.05, 0.44, 0.045), { at: [0, 0.28, 0], color: OAK });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) pole(w, [sx * 0.36, 0.26, sz * 0.15], [sx * 0.4, 0, sz * 0.18], 0.017, WALNUT);
  // a mug, a book, a plate of biscuits
  const g = P.get('gloss');
  g.add(new THREE.CylinderGeometry(0.035, 0.032, 0.075, 16), { at: [0.24, 0.343, 0.03], color: ['#ffd1e0', '#ffffff'] });
  g.add(new THREE.TorusGeometry(0.022, 0.007, 6, 12), { at: [0.275, 0.345, 0.03], rot: [0, 0, 0], color: '#ffffff' });
  P.get('dark').add(new THREE.CylinderGeometry(0.03, 0.03, 0.002, 14), { at: [0.24, 0.378, 0.03] });
  P.get('paint').add(roundBox(0.2, 0.032, 0.14, 0.006), { at: [-0.18, 0.321, -0.02], rot: [0, 0.35, 0], color: ['#7fa8e8', '#9fc0f2'] });
  P.get('paint').add(roundBox(0.19, 0.022, 0.13, 0.004), { at: [-0.18, 0.317, -0.02], rot: [0, 0.35, 0], color: '#fffaf1' });
  g.add(new THREE.CylinderGeometry(0.075, 0.06, 0.012, 20), { at: [0.02, 0.311, 0.04], color: '#ffffff' });
  for (const [x, z] of [[-0.01, 0.02], [0.04, 0.06], [0.03, 0.01]]) P.get('wood').add(new THREE.CylinderGeometry(0.024, 0.024, 0.012, 14), { at: [x, 0.323, z], color: ['#d79a55', '#e8b56f'] });
  return { object: P.bake(new THREE.Group()), spot: { x: 0, z: 0.5, yaw: Math.PI } };
}

function bookshelf(seed) {
  const P = new Parts();
  const w = P.get('wood');
  const Z = -0.07; // (it stands against the wall behind it)
  const D = 0.34;
  for (const sx of [-1, 1]) w.add(roundBox(0.035, 1.38, D, 0.012), { at: [sx * 0.465, 0.69, Z], color: WHITE });
  for (const y of [0.03, 0.42, 0.82, 1.22, 1.375]) w.add(roundBox(0.96, 0.03, D, 0.01), { at: [0, y, Z], color: WHITE });
  P.get('paint').add(new THREE.BoxGeometry(0.92, 1.36, 0.01), { at: [0, 0.69, Z - D / 2 + 0.01], color: ['#ffd9e4', '#ffe9ef'] });
  const rnd = rng(seed || 3);
  const books = P.get('paint');
  const colors = ['#ff9fbd', '#9fc8ff', '#ffd27a', '#a8e0c4', '#c9b6ff', '#ffb38a', '#f4f0ea', '#8a8fd6'];
  for (const y of [0.045, 0.435, 0.835]) {
    let x = -0.43;
    while (x < 0.42) {
      if (rnd() < 0.12) {
        x += 0.07;
        continue;
      }
      const t = rnd.range(0.022, 0.05);
      const h = rnd.range(0.2, 0.31);
      const lean = rnd() < 0.08 ? 0.25 : 0;
      if (x + t > 0.44) break;
      const c = rnd.pick(colors);
      books.add(roundBox(t, h, rnd.range(0.2, 0.26), 0.005), { at: [x + t / 2 + (lean ? 0.04 : 0), y + h / 2 + 0.002, Z + 0.02], rot: [0, 0, lean], color: [tone(c, -0.06), c] });
      x += t + (lean ? 0.08 : 0.004);
    }
  }
  // on the top shelf: a little plant, a framed heart, a tiny fox
  const g = P.get('gloss');
  g.add(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 14), { at: [-0.3, 1.275, Z + 0.02], color: ['#f1e6dc', '#ffffff'] });
  P.get('leaf').add(new THREE.IcosahedronGeometry(0.065, 1), { at: [-0.3, 1.36, Z + 0.02], scale: [1, 0.85, 1], color: LEAF });
  P.get('paint').add(roundBox(0.14, 0.17, 0.02, 0.006), { at: [0.05, 1.32, Z - 0.06], rot: [-0.12, 0, 0], color: GOLD });
  P.get('paint').add(new THREE.BoxGeometry(0.1, 0.13, 0.004), { at: [0.05, 1.32, Z - 0.048], rot: [-0.12, 0, 0], color: '#ffe9ef' });
  P.get('paint').add(heart(0.06, 0.008), { at: [0.05, 1.32, Z - 0.044], rot: [-0.12, 0, 0], color: '#ff6f9c' });
  fox(P, [0.3, 1.24, Z + 0.03], 0.55);
  return { object: P.bake(new THREE.Group()), spot: { x: 0, z: 0.55, yaw: Math.PI } };
}

/* A tiny fox figurine (for a shelf): sitting, its tail round its feet. */
function fox(P, at, k = 1, yaw = -0.4) {
  const b = P.get('gloss');
  const [x, y, z] = at;
  const o = (dx, dy, dz) => [x + (dx * Math.cos(yaw) + dz * Math.sin(yaw)) * k, y + dy * k, z + (-dx * Math.sin(yaw) + dz * Math.cos(yaw)) * k];
  b.add(new THREE.SphereGeometry(0.06, 12, 10), { at: o(0, 0.06, 0), scale: [k, k * 1.15, k], color: ['#e8792f', '#f59a4a'] });
  b.add(new THREE.SphereGeometry(0.048, 12, 10), { at: o(0, 0.15, 0.02), scale: k, color: ['#ef8a3a', '#f8a85a'] });
  b.add(new THREE.SphereGeometry(0.03, 10, 8), { at: o(0, 0.14, 0.06), scale: k, color: '#fff2e6' });
  for (const s of [-1, 1]) b.add(new THREE.ConeGeometry(0.02, 0.05, 6), { at: o(s * 0.028, 0.2, 0.01), rot: [0, 0, -s * 0.25], scale: k, color: '#e8792f' });
  b.add(new THREE.SphereGeometry(0.035, 10, 8), { at: o(0.05, 0.03, 0.05), scale: [k * 1.4, k * 0.8, k * 0.9], color: ['#e8792f', '#fff2e6'] });
  P.get('dark').add(new THREE.SphereGeometry(0.007, 6, 6), { at: o(0, 0.153, 0.085), scale: k });
}

function wardrobe() {
  const P = new Parts();
  const p = P.get('paint');
  const D = 0.48;
  legs(P.get('wood'), 0.84, D - 0.1, 0.06, 0.02, OAK);
  p.add(roundBox(0.96, 1.46, D, 0.03), { at: [0, 0.79, 0], color: ['#bfe6d8', '#dff4ec'] });
  p.add(roundBox(1.0, 0.06, D + 0.04, 0.02), { at: [0, 1.53, 0], color: ['#f6f1ec', '#ffffff'] });
  for (const sx of [-1, 1]) {
    p.add(roundBox(0.43, 1.3, 0.02, 0.012), { at: [sx * 0.232, 0.8, D / 2 + 0.006], color: ['#c9ece0', '#e9f8f2'] });
    P.get('metal').add(new THREE.SphereGeometry(0.02, 10, 8), { at: [sx * 0.04, 0.82, D / 2 + 0.03], color: GOLD });
    P.get('gloss').add(heart(0.09, 0.012), { at: [sx * 0.232, 1.26, D / 2 + 0.02], color: '#ff9cbc' });
  }
  return { object: P.bake(new THREE.Group()), spot: { x: 0, z: 0.7, yaw: Math.PI } };
}

// ------------------------------------------------------------------ the kitchen, the fridge

function kitchen() {
  const P = new Parts();
  const p = P.get('paint');
  const W = 1.46;
  const D = 0.46;
  const Z = -0.02;
  P.get('dark').add(new THREE.BoxGeometry(W - 0.06, 0.05, D - 0.06), { at: [0, 0.025, Z] });
  p.add(roundBox(W, 0.52, D, 0.02), { at: [0, 0.31, Z], color: CREAM });
  for (let i = 0; i < 3; i++) {
    const x = (i - 1) * 0.49;
    p.add(roundBox(0.46, 0.44, 0.02, 0.012), { at: [x, 0.31, Z + D / 2 + 0.006], color: ['#ffd0de', '#ffe5ec'] });
    P.get('metal').add(roundBox(0.1, 0.014, 0.014, 0.005), { at: [x, 0.47, Z + D / 2 + 0.026], color: GOLD });
  }
  P.get('gloss').add(roundBox(W + 0.04, 0.04, D + 0.04, 0.012), { at: [0, 0.59, Z], color: ['#f2efec', '#ffffff'] });
  // the sink, its tap; the hob, a kettle on it
  P.get('dark').add(new THREE.BoxGeometry(0.38, 0.004, 0.28), { at: [-0.4, 0.612, Z + 0.02] });
  P.get('metal').add(roundBox(0.4, 0.008, 0.3, 0.004), { at: [-0.4, 0.609, Z + 0.02], color: STEEL });
  tube(P.get('metal'), [[-0.4, 0.61, Z - 0.17], [-0.4, 0.74, Z - 0.17], [-0.4, 0.76, Z - 0.1], [-0.4, 0.7, Z - 0.04]], 0.011, STEEL, 12);
  for (const [x, z] of [[0.28, Z - 0.06], [0.5, Z + 0.06]]) P.get('dark').add(new THREE.TorusGeometry(0.07, 0.012, 6, 20), { at: [x, 0.613, z], rot: [Math.PI / 2, 0, 0] });
  for (const x of [0.26, 0.36, 0.46, 0.56]) P.get('metal').add(new THREE.CylinderGeometry(0.016, 0.016, 0.02, 10), { at: [x, 0.5, Z + D / 2 + 0.03], rot: [Math.PI / 2, 0, 0], color: '#f2efec' });
  const g = P.get('gloss');
  g.add(new THREE.SphereGeometry(0.075, 16, 12), { at: [0.28, 0.68, Z - 0.06], scale: [1, 0.82, 1], color: ['#ff8fb2', '#ffb3c9'] });
  pole(g, [0.32, 0.68, Z - 0.06], [0.39, 0.72, Z - 0.06], 0.012, '#ff8fb2');
  g.add(new THREE.SphereGeometry(0.015, 8, 6), { at: [0.28, 0.745, Z - 0.06], color: '#ffffff' });
  // the tiles behind, and a shelf with jars on it
  const group = P.bake(new THREE.Group());
  const tiles = new THREE.Mesh(roundBox(W, 0.6, 0.03, 0.01), new THREE.MeshStandardMaterial({ map: wallTiles(), roughness: 0.4 }));
  tiles.position.set(0, 0.91, Z - D / 2 + 0.015);
  tiles.castShadow = tiles.receiveShadow = true;
  group.add(tiles);
  const S = new Parts();
  S.get('wood').add(roundBox(1.2, 0.03, 0.18, 0.01), { at: [0, 1.12, Z - D / 2 + 0.12], color: OAK });
  const jar = ['#ffd27a', '#a8e0c4', '#ffb3c9', '#c9b6ff'];
  for (let i = 0; i < 4; i++) {
    const x = -0.42 + i * 0.16;
    S.get('gloss').add(new THREE.CylinderGeometry(0.045, 0.045, 0.12, 14), { at: [x, 1.195, Z - D / 2 + 0.12], color: ['#f4f0ea', '#ffffff'] });
    S.get('paint').add(new THREE.CylinderGeometry(0.047, 0.047, 0.025, 14), { at: [x, 1.267, Z - D / 2 + 0.12], color: jar[i] });
  }
  S.get('leaf').add(new THREE.IcosahedronGeometry(0.08, 1), { at: [0.45, 1.22, Z - D / 2 + 0.12], scale: [1, 0.8, 1], color: LEAF });
  S.get('gloss').add(new THREE.CylinderGeometry(0.05, 0.04, 0.07, 12), { at: [0.45, 1.17, Z - D / 2 + 0.12], color: '#ffffff' });
  S.bake(group);
  return { object: group, spot: { x: 0.1, z: 0.6, yaw: Math.PI } };
}

let tilesTex = null;
function wallTiles() {
  if (!tilesTex) {
    tilesTex = paintTexture(256, (g, S) => {
      g.fillStyle = '#dcd6d6';
      g.fillRect(0, 0, S, S);
      const k = S / 6;
      for (let i = 0; i < 6; i++)
        for (let j = 0; j < 4; j++) {
          g.fillStyle = (i + j) % 5 === 0 ? '#ffd0de' : '#fbfaf8';
          g.fillRect(i * k + 2, (j * S) / 4 + 2, k - 4, S / 4 - 4);
        }
    });
    tilesTex.userData.shared = true;
  }
  return tilesTex;
}

function fridge(colors) {
  const [lo, hi] = colors;
  const P = new Parts();
  const W = 0.64;
  const D = 0.6;
  legs(P.get('metal'), W - 0.12, D - 0.12, 0.04, 0.018, STEEL);
  const g = P.get('gloss');
  g.add(roundBox(W, 1.38, D, 0.09), { at: [0, 0.73, 0], color: [lo, hi] });
  P.get('dark').add(new THREE.BoxGeometry(W - 0.04, 0.008, 0.01), { at: [0, 0.98, D / 2 + 0.001] });
  for (const [y, h] of [[0.83, 0.2], [1.13, 0.14]]) P.get('metal').add(roundBox(0.028, h, 0.03, 0.01), { at: [W / 2 - 0.08, y, D / 2 + 0.02], color: STEEL });
  P.get('metal').add(roundBox(0.16, 0.03, 0.006, 0.004), { at: [0, 1.36, D / 2 + 0.002], color: STEEL });
  const group = P.bake(new THREE.Group());
  // her magnets: one for everything she has achieved (as many as there is room for)
  const magnets = new THREE.Group();
  group.add(magnets);
  const magMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 });
  let shown = -1;
  return {
    object: group,
    spot: { x: 0, z: 0.6, yaw: Math.PI },
    set(what, n) {
      if (what !== 'magnets' || n === shown) return;
      shown = n;
      magnets.children.splice(0).forEach((o) => o.geometry.dispose());
      if (!n) return;
      const b = new Batch();
      const rnd = rng(42);
      const colors = ['#ff6f9c', '#ffd23f', '#7fb6ff', '#7fd6a8', '#c9a6ff', '#ff9f5a', '#ffffff'];
      const cells = [];
      for (let y = 0; y < 9; y++) for (let x = 0; x < 4; x++) cells.push([x, y]);
      for (let i = cells.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [cells[i], cells[j]] = [cells[j], cells[i]];
      }
      for (let i = 0; i < Math.min(n, cells.length); i++) {
        const [cx, cy] = cells[i];
        const x = -0.2 + cx * 0.115 + rnd.range(-0.02, 0.02);
        const y = 0.36 + cy * 0.115 + (cy >= 5 ? 0.04 : 0) + rnd.range(-0.02, 0.02);
        const c = rnd.pick(colors);
        const kind = i % 4;
        const at = [x, y, D / 2 + 0.008];
        if (kind === 0) b.add(heart(0.05, 0.012), { at, rot: [0, 0, rnd.range(-0.4, 0.4)], color: c });
        else if (kind === 1) b.add(new THREE.CylinderGeometry(0.022, 0.022, 0.012, 14), { at, rot: [Math.PI / 2, 0, 0], color: c });
        else if (kind === 2) b.add(new THREE.OctahedronGeometry(0.026, 0), { at, scale: [1, 1, 0.35], rot: [0, 0, rnd()], color: c, flat: true });
        else b.add(roundBox(0.04, 0.03, 0.012, 0.005), { at, rot: [0, 0, rnd.range(-0.4, 0.4)], color: c });
      }
      magnets.add(b.mesh(magMat));
    },
  };
}

// ------------------------------------------------------------------ lights

function lamp() {
  const P = new Parts();
  const g = P.get('gloss');
  g.add(new THREE.CylinderGeometry(0.12, 0.13, 0.03, 24), { at: [0, 0.015, 0], color: ['#ff9cbc', '#ffb9d0'] });
  pole(P.get('metal'), [0, 0.03, 0], [0, 1.05, 0], 0.012, GOLD);
  const group = P.bake(new THREE.Group());
  const shadeMat = new THREE.MeshStandardMaterial({ color: '#fff1dc', roughness: 0.9, emissive: '#ffc77a', emissiveIntensity: 0, side: THREE.DoubleSide });
  const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.21, 0.26, 28, 1, true), shadeMat);
  shade.position.y = 1.09;
  shade.castShadow = true;
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), new THREE.MeshBasicMaterial({ color: '#d9d2c6' }));
  bulb.position.y = 1.0;
  const halo = glow('#ffc77a', 0.95);
  halo.position.y = 1.02;
  group.add(shade, bulb, halo);
  let lit = false;
  return {
    object: group,
    light: { at: [0, 0.98, 0], color: '#ffc98a', power: 1.0, range: 3.2 },
    set(what, v) {
      if (what !== 'on') return;
      lit = !!v;
      shadeMat.emissiveIntensity = lit ? 0.75 : 0;
      bulb.material.color.set(lit ? '#fff6dc' : '#d9d2c6');
    },
    update() {
      halo.material.opacity = lit ? 0.5 : 0;
    },
  };
}

// ------------------------------------------------------------------ plants

function monstera(seed) {
  const P = new Parts();
  const g = P.get('gloss');
  g.add(new THREE.CylinderGeometry(0.15, 0.115, 0.26, 24), { at: [0, 0.13, 0], color: ['#f0e7de', '#ffffff'] });
  g.add(new THREE.TorusGeometry(0.15, 0.014, 6, 28), { at: [0, 0.26, 0], rot: [Math.PI / 2, 0, 0], color: '#ffffff' });
  P.get('wood').add(new THREE.CylinderGeometry(0.14, 0.14, 0.01, 20), { at: [0, 0.245, 0], color: '#6b4a34' });
  const rnd = rng(seed || 5);
  const leaf = leafShape();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + rnd.range(-0.3, 0.3);
    const out = rnd.range(0.12, 0.28);
    const up = rnd.range(0.45, 0.82);
    const tip = [Math.cos(a) * out, up, Math.sin(a) * out];
    tube(P.get('leaf'), [[0, 0.24, 0], [tip[0] * 0.3, up * 0.65, tip[2] * 0.3], tip], 0.008, '#4f9a4a', 10);
    const s = rnd.range(0.2, 0.27);
    // (out along `a`, tipped over so that its face is to the sky)
    const m = new THREE.Matrix4().compose(V(...tip), new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.9 + rnd.range(-0.25, 0.25), -a - Math.PI / 2, rnd.range(-0.3, 0.3), 'YXZ')), V(s, s, s));
    P.get('leaf').add(leaf.clone(), { matrix: m, color: LEAF });
  }
  return { object: P.bake(new THREE.Group()), spot: { x: 0, z: 0.5, yaw: Math.PI } };
}

/* A monstera leaf: a heart from its stalk, with slits cut in from its edge. (Its stalk at the origin, the leaf up along +Y.) */
let leafGeo = null;
function leafShape() {
  if (leafGeo) return leafGeo;
  const s = new THREE.Shape();
  const pts = [];
  for (let i = 0; i <= 40; i++) {
    const t = (i / 40) * TAU;
    let x = Math.sin(t) * 0.5;
    const y = 0.5 - Math.cos(t) * 0.5;
    if (y < 0.12) x *= 0.6 + y * 3; // (narrower where it meets the stalk)
    // the slits: every other step along the edge goes in
    const slit = i > 3 && i < 37 && i % 6 === 3 ? 0.62 : 1;
    pts.push(new THREE.Vector2(x * slit + (slit < 1 ? Math.sign(x) * 0.02 : 0), y * (slit < 1 ? 0.96 : 1)));
  }
  s.setFromPoints(pts);
  leafGeo = new THREE.ShapeGeometry(s, 4);
  return leafGeo;
}

function cactus() {
  const P = new Parts();
  P.get('gloss').add(new THREE.CylinderGeometry(0.075, 0.06, 0.1, 18), { at: [0, 0.05, 0], color: ['#ff9cbc', '#ffbcd2'] });
  const l = P.get('leaf');
  l.add(new THREE.CapsuleGeometry(0.05, 0.13, 6, 14), { at: [0, 0.2, 0], color: ['#4f9a4a', '#7cc56c'] });
  l.add(new THREE.CapsuleGeometry(0.025, 0.05, 4, 10), { at: [0.06, 0.22, 0], rot: [0, 0, -0.6], color: ['#4f9a4a', '#7cc56c'] });
  P.get('paint').add(new THREE.IcosahedronGeometry(0.022, 0), { at: [0, 0.31, 0], color: '#ff6f9c', flat: true });
  return { object: P.bake(new THREE.Group()) };
}

// ------------------------------------------------------------------ friends, toys, music

function bear() {
  const P = new Parts();
  const f = P.get('fabric');
  const FUR = ['#c99a6c', '#e6c39a'];
  f.add(new THREE.SphereGeometry(0.21, 20, 16), { at: [0, 0.23, -0.02], scale: [1, 1.08, 0.92], color: FUR });
  f.add(new THREE.SphereGeometry(0.12, 16, 12), { at: [0, 0.23, 0.12], scale: [1, 1.1, 0.5], color: '#f3dcc0' });
  f.add(new THREE.SphereGeometry(0.17, 20, 16), { at: [0, 0.53, 0], color: FUR });
  for (const s of [-1, 1]) {
    f.add(new THREE.SphereGeometry(0.065, 12, 10), { at: [s * 0.13, 0.66, -0.02], scale: [1, 1, 0.6], color: FUR });
    f.add(new THREE.SphereGeometry(0.035, 10, 8), { at: [s * 0.13, 0.66, 0.012], scale: [1, 1, 0.4], color: '#f3dcc0' });
    f.add(new THREE.CapsuleGeometry(0.06, 0.12, 4, 10), { at: [s * 0.2, 0.28, 0.07], rot: [0.9, 0, s * 0.5], color: FUR });
    f.add(new THREE.CapsuleGeometry(0.075, 0.1, 4, 10), { at: [s * 0.11, 0.08, 0.15], rot: [Math.PI / 2, 0, 0], color: FUR });
    f.add(new THREE.SphereGeometry(0.06, 10, 8), { at: [s * 0.11, 0.08, 0.25], scale: [1, 1, 0.35], color: '#f3dcc0' });
    P.get('dark').add(new THREE.SphereGeometry(0.018, 8, 6), { at: [s * 0.06, 0.56, 0.155] });
  }
  f.add(new THREE.SphereGeometry(0.075, 14, 10), { at: [0, 0.49, 0.13], scale: [1, 0.8, 0.8], color: '#f3dcc0' });
  P.get('dark').add(new THREE.SphereGeometry(0.024, 8, 6), { at: [0, 0.515, 0.19], scale: [1.2, 0.9, 1] });
  // a bow at its neck
  const g = P.get('gloss');
  for (const s of [-1, 1]) g.add(new THREE.ConeGeometry(0.05, 0.09, 10), { at: [s * 0.05, 0.39, 0.15], rot: [0, 0, s * (Math.PI / 2)], color: '#ff6f9c' });
  g.add(new THREE.SphereGeometry(0.025, 10, 8), { at: [0, 0.39, 0.16], color: '#ff8fb2' });
  const group = P.bake(new THREE.Group());
  let squish = 0;
  return {
    object: group,
    spot: { x: 0, z: 0.55, yaw: Math.PI },
    poke() {
      squish = 1;
    },
    update(dt) {
      squish = Math.max(0, squish - dt * 2.2);
      const k = Math.sin(squish * Math.PI * 3) * squish * 0.12;
      group.scale.set(1 + k, 1 - k, 1 + k);
    },
  };
}

function mic() {
  const P = new Parts();
  const m = P.get('metal');
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.5;
    pole(m, [0, 0.18, 0], [Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2], 0.01, INK);
  }
  pole(m, [0, 0.18, 0], [0, 1.02, 0], 0.012, INK);
  pole(m, [0, 1.02, 0], [0, 1.1, 0.12], 0.009, INK);
  const g = P.get('gloss');
  g.add(new THREE.CylinderGeometry(0.02, 0.016, 0.12, 12), { at: [0, 1.13, 0.15], rot: [0.6, 0, 0], color: ['#ff8fb2', '#ffb3c9'] });
  m.add(new THREE.SphereGeometry(0.038, 16, 12), { at: [0, 1.19, 0.19], color: '#e6e6ee' });
  tube(P.get('dark'), [[0, 1.08, 0.12], [0.03, 0.8, 0.02], [0.05, 0.4, 0.03], [0.12, 0.02, 0.15], [0.3, 0.005, 0.2]], 0.006, INK, 20);
  const group = P.bake(new THREE.Group());
  const halo = glow('#ffd0e4', 0.35);
  halo.position.set(0, 1.19, 0.19);
  group.add(halo);
  return {
    object: group,
    spot: { x: 0, z: 0.5, yaw: Math.PI },
    update(dt, t) {
      halo.material.opacity = 0.25 + 0.2 * Math.sin(t * 2.4);
    },
  };
}

function radio() {
  const P = new Parts();
  const w = P.get('wood');
  w.add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 28), { at: [0, 0.42, 0], color: OAK });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.3;
    pole(w, [Math.cos(a) * 0.12, 0.41, Math.sin(a) * 0.12], [Math.cos(a) * 0.17, 0, Math.sin(a) * 0.17], 0.014, OAK);
  }
  const g = P.get('gloss');
  g.add(roundBox(0.34, 0.2, 0.15, 0.045), { at: [0, 0.535, 0], color: ['#ff9cbc', '#ffbcd2'] });
  P.get('paint').add(roundBox(0.3, 0.035, 0.14, 0.012), { at: [0, 0.645, 0], color: CREAM });
  P.get('dark').add(new THREE.CircleGeometry(0.065, 24), { at: [-0.075, 0.53, 0.0765] });
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    P.get('metal').add(new THREE.SphereGeometry(0.006, 6, 4), { at: [-0.075 + Math.cos(a) * 0.04, 0.53 + Math.sin(a) * 0.04, 0.079], color: STEEL });
  }
  for (const y of [0.57, 0.5]) P.get('metal').add(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12), { at: [0.09, y, 0.08], rot: [Math.PI / 2, 0, 0], color: '#fff6ea' });
  pole(P.get('metal'), [0.12, 0.66, -0.04], [0.22, 0.9, -0.08], 0.005, STEEL);
  P.get('metal').add(new THREE.SphereGeometry(0.012, 8, 6), { at: [0.22, 0.9, -0.08], color: STEEL });
  const group = P.bake(new THREE.Group());
  const dial = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.03), new THREE.MeshBasicMaterial({ color: '#7a6a5a' }));
  dial.position.set(0.04, 0.6, 0.0765);
  group.add(dial);
  let on = false;
  let note = 0;
  return {
    object: group,
    spot: { x: 0, z: 0.5, yaw: Math.PI },
    set(what, v) {
      if (what === 'on') {
        on = !!v;
        dial.material.color.set(on ? '#ffd27a' : '#7a6a5a');
      }
    },
    update(dt, t, ctx) {
      if (!on || !ctx || !ctx.fx) return;
      note -= dt;
      if (note <= 0) {
        note = 1.1 + Math.random() * 0.8;
        ctx.fx('♪', group.localToWorld(V(-0.07, 0.62, 0.09)));
      }
    },
  };
}

// ------------------------------------------------------------------ rugs

function roundRug(colors) {
  const tex = fabric('rings', colors);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 0.012, 56), new THREE.MeshStandardMaterial({ map: tex, roughness: 1 }));
  mesh.position.y = 0.006;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  return { object: group };
}

function stripeRug(colors) {
  const tex = fabric('stripes', colors);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 1 });
  const mesh = new THREE.Mesh(roundBox(1.9, 0.014, 1.12, 0.006, 2), mat);
  mesh.position.y = 0.007;
  mesh.receiveShadow = true;
  const group = new THREE.Group();
  group.add(mesh);
  const b = new Batch();
  for (const sx of [-1, 1]) for (let i = 0; i < 22; i++) b.add(new THREE.BoxGeometry(0.06, 0.004, 0.012), { at: [sx * 0.98, 0.003, -0.53 + (i * 1.06) / 21], color: '#fff6ea' });
  const fringe = b.mesh(MAT.fabric);
  fringe.castShadow = false;
  group.add(fringe);
  return { object: group };
}

// ------------------------------------------------------------------ on the walls

function frame(W, H, wood) {
  const P = new Parts();
  P.get(wood ? 'wood' : 'paint').add(roundBox(W, H, 0.035, 0.012), { at: [0, 0, 0.018], color: wood ? OAK : WHITE });
  const group = P.bake(new THREE.Group());
  const iw = W - 0.08;
  const ih = H - 0.08;
  const empty = emptyPhoto(256, Math.round((256 * ih) / iw));
  const mat = new THREE.MeshStandardMaterial({ map: empty, roughness: 0.55 });
  const photo = new THREE.Mesh(new THREE.PlaneGeometry(iw, ih), mat);
  photo.position.z = 0.0365;
  photo.receiveShadow = true;
  group.add(photo);
  return {
    object: group,
    aspect: iw / ih,
    set(what, v) {
      if (what !== 'photo') return;
      // (an image or a canvas — or null: the empty frame again)
      const old = mat.map;
      mat.map = v ? coverTexture(v, iw / ih, 512) : empty;
      if (old !== empty && old !== mat.map) old.dispose();
      mat.needsUpdate = true;
    },
  };
}

function clock() {
  const group = new THREE.Group();
  const P = new Parts();
  P.get('gloss').add(new THREE.TorusGeometry(0.19, 0.024, 10, 40), { at: [0, 0, 0.03], color: ['#ff8fb2', '#ffb3c9'] });
  P.get('gloss').add(new THREE.CylinderGeometry(0.19, 0.19, 0.03, 40), { at: [0, 0, 0.015], rot: [Math.PI / 2, 0, 0], color: '#ffd6e4' });
  P.bake(group);
  const face = canvasTexture(256, 256, (g, S) => {
    g.fillStyle = '#fffaf3';
    g.beginPath();
    g.arc(S / 2, S / 2, S / 2, 0, TAU);
    g.fill();
    g.fillStyle = '#5a4a5a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `700 ${S * 0.13}px Fredoka, Jua, sans-serif`;
    for (const [n, a] of [[12, 0], [3, 0.25], [6, 0.5], [9, 0.75]]) g.fillText(String(n), S / 2 + Math.sin(a * TAU) * S * 0.36, S / 2 - Math.cos(a * TAU) * S * 0.36 + S * 0.01);
    for (let i = 0; i < 12; i++) {
      if (i % 3 === 0) continue;
      const a = (i / 12) * TAU;
      g.beginPath();
      g.arc(S / 2 + Math.sin(a) * S * 0.38, S / 2 - Math.cos(a) * S * 0.38, S * 0.014, 0, TAU);
      g.fill();
    }
  });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.18, 40), new THREE.MeshStandardMaterial({ map: face, roughness: 0.5 }));
  disc.position.z = 0.031;
  group.add(disc);
  const hand = (len, wid, color, z) => {
    const g = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(wid, len, 0.006), new THREE.MeshStandardMaterial({ color, roughness: 0.4 }));
    m.position.y = len / 2 - 0.015;
    g.add(m);
    g.position.z = z;
    group.add(g);
    return g;
  };
  const hour = hand(0.1, 0.016, '#5a4a5a', 0.036);
  const minute = hand(0.145, 0.011, '#5a4a5a', 0.04);
  const second = hand(0.155, 0.004, '#ff5f8f', 0.044);
  const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 12), new THREE.MeshStandardMaterial({ color: '#ff5f8f' }));
  pin.rotation.x = Math.PI / 2;
  pin.position.z = 0.046;
  group.add(pin);
  return {
    object: group,
    update() {
      const d = new Date();
      const s = d.getSeconds() + d.getMilliseconds() / 1000;
      const m = d.getMinutes() + s / 60;
      const h = (d.getHours() % 12) + m / 60;
      second.rotation.z = -(s / 60) * TAU;
      minute.rotation.z = -(m / 60) * TAU;
      hour.rotation.z = -(h / 12) * TAU;
    },
  };
}

/* The page of the calendar: the month, its days with today ringed (and the days worth remembering marked), and how many days they have been together. */
export function paintCalendar(g, W, H, cal) {
  g.fillStyle = '#fffdf8';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#ff8fb2';
  g.fillRect(0, 0, W, H * 0.2);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${H * 0.085}px Jua, sans-serif`;
  g.fillText(cal.count > 0 ? `우리 ${cal.count}일째 💗` : `${cal.m}월`, W / 2, H * 0.105);
  g.fillStyle = '#5a4a5a';
  g.font = `700 ${H * 0.075}px Jua, sans-serif`;
  g.fillText(`${cal.m}월`, W / 2, H * 0.27);
  const first = new Date(cal.y, cal.m - 1, 1).getDay();
  const days = new Date(cal.y, cal.m, 0).getDate();
  const cw = W / 7;
  const top = H * 0.36;
  const ch = (H * 0.6) / 6;
  g.font = `600 ${H * 0.045}px Fredoka, Jua, sans-serif`;
  for (let d = 1; d <= days; d++) {
    const i = first + d - 1;
    const x = (i % 7) * cw + cw / 2;
    const y = top + Math.floor(i / 7) * ch + ch / 2;
    if (d === cal.d) {
      g.fillStyle = '#ff6f9c';
      g.beginPath();
      g.arc(x, y, Math.min(cw, ch) * 0.46, 0, TAU);
      g.fill();
    } else if ((cal.marks || []).includes(d)) {
      g.fillStyle = '#ffd6e4';
      g.beginPath();
      g.arc(x, y, Math.min(cw, ch) * 0.42, 0, TAU);
      g.fill();
    }
    g.fillStyle = d === cal.d ? '#ffffff' : i % 7 === 0 ? '#e0607f' : '#5a4a5a';
    g.fillText(String(d), x, y + 1);
  }
}

function calendar() {
  const group = new THREE.Group();
  const P = new Parts();
  P.get('paint').add(roundBox(0.4, 0.54, 0.012, 0.006), { at: [0, -0.02, 0.008], color: WHITE });
  for (let i = 0; i < 6; i++) P.get('metal').add(new THREE.TorusGeometry(0.012, 0.003, 6, 12), { at: [-0.15 + i * 0.06, 0.25, 0.016], color: STEEL });
  tube(P.get('dark'), [[-0.12, 0.25, 0.004], [0, 0.33, 0.002], [0.12, 0.25, 0.004]], 0.002, INK, 8);
  P.get('metal').add(new THREE.SphereGeometry(0.01, 8, 6), { at: [0, 0.33, 0.004], color: GOLD });
  P.bake(group);
  const canvas = document.createElement('canvas');
  canvas.width = 300;
  canvas.height = 380;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const page = new THREE.Mesh(new THREE.PlaneGeometry(0.37, 0.47), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 }));
  page.position.set(0, -0.04, 0.015);
  group.add(page);
  let key = '';
  return {
    object: group,
    set(what, cal) {
      if (what !== 'calendar' || !cal) return;
      const k = JSON.stringify(cal);
      if (k === key) return;
      key = k;
      paintCalendar(canvas.getContext('2d'), canvas.width, canvas.height, cal);
      tex.needsUpdate = true;
    },
  };
}

function garland() {
  const group = new THREE.Group();
  const P = new Parts();
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const t = i / 12;
    pts.push([(t - 0.5) * 1.56, 0.14 - Math.sin(t * Math.PI) * 0.24, 0.035 + Math.sin(t * Math.PI) * 0.03]);
  }
  const curve = tube(P.get('dark'), pts, 0.004, INK, 40);
  P.bake(group);
  const colors = ['#ff6f9c', '#ffd23f', '#9fd8ff', '#fff6dc', '#a8e0c4'];
  const bulbs = [];
  for (let i = 0; i < 11; i++) {
    const p = curve.getPoint((i + 0.5) / 11);
    const c = colors[i % colors.length];
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), new THREE.MeshBasicMaterial({ color: c }));
    m.scale.y = 1.3;
    m.position.copy(p).add(V(0, -0.03, 0.005));
    const h = glow(c, 0.16);
    h.position.copy(m.position);
    group.add(m, h);
    bulbs.push({ m, h, c: new THREE.Color(c), seed: i * 1.7 });
  }
  return {
    object: group,
    update(dt, t, ctx) {
      const dark = ctx ? ctx.dark : 0;
      for (const b of bulbs) {
        const tw = 0.75 + 0.25 * Math.sin(t * 2.2 + b.seed);
        b.m.material.color.copy(b.c).multiplyScalar(0.55 + 0.45 * Math.max(dark, 0.25) * tw);
        b.h.material.opacity = 0.65 * dark * tw;
      }
    },
  };
}

function poster() {
  const group = new THREE.Group();
  const empty = canvasTexture(300, 400, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#ffd6e4');
    grad.addColorStop(1, '#fff2d9');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ff6f9c';
    g.textAlign = 'center';
    g.font = `${W * 0.3}px "Segoe UI Emoji", "Apple Color Emoji", sans-serif`;
    g.fillText('💿', W / 2, H * 0.48);
    g.font = `700 ${W * 0.075}px Jua, sans-serif`;
    g.fillText('나의 앨범 포스터', W / 2, H * 0.78);
  });
  const mat = new THREE.MeshStandardMaterial({ map: empty, roughness: 0.75 });
  const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.58, 0.78), mat);
  paper.position.z = 0.004;
  paper.receiveShadow = true;
  group.add(paper);
  const tape = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6, transparent: true, opacity: 0.7 });
  for (const [x, y, r] of [[-0.27, 0.37, 0.7], [0.27, 0.37, -0.7], [-0.27, -0.37, -0.7], [0.27, -0.37, 0.7]]) {
    const t = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.03), tape);
    t.position.set(x, y, 0.006);
    t.rotation.z = r;
    group.add(t);
  }
  return {
    object: group,
    set(what, v) {
      if (what !== 'poster') return;
      // { art: the album's artwork (an image), title, artist } — or null
      const old = mat.map;
      mat.map = v
        ? canvasTexture(300, 400, (g, W, H) => {
            g.fillStyle = '#fffaf3';
            g.fillRect(0, 0, W, H);
            if (v.art) {
              const iw = v.art.naturalWidth || v.art.width;
              const ih = v.art.naturalHeight || v.art.height;
              const s = Math.min(iw, ih);
              g.drawImage(v.art, (iw - s) / 2, (ih - s) / 2, s, s, W * 0.08, W * 0.08, W * 0.84, W * 0.84);
            } else {
              g.fillStyle = '#ffd6e4';
              g.fillRect(W * 0.08, W * 0.08, W * 0.84, W * 0.84);
            }
            g.fillStyle = '#4a3a4a';
            g.textAlign = 'center';
            g.font = `700 ${W * 0.075}px Jua, sans-serif`;
            g.fillText(String(v.title || '').slice(0, 16), W / 2, W * 1.04);
            g.fillStyle = '#9a7a8a';
            g.font = `600 ${W * 0.055}px Jua, sans-serif`;
            g.fillText(String(v.artist || '').slice(0, 20), W / 2, W * 1.15);
          })
        : empty;
      if (old !== empty) old.dispose();
      mat.needsUpdate = true;
    },
  };
}

function wallShelf() {
  const P = new Parts();
  P.get('wood').add(roundBox(0.9, 0.035, 0.22, 0.01), { at: [0, -0.1, 0.11], color: OAK });
  for (const sx of [-1, 1]) P.get('metal').add(roundBox(0.02, 0.1, 0.16, 0.005), { at: [sx * 0.32, -0.16, 0.08], color: GOLD });
  const g = P.get('gloss');
  g.add(new THREE.CylinderGeometry(0.05, 0.04, 0.08, 14), { at: [-0.3, -0.04, 0.11], color: ['#ffd0de', '#ffffff'] });
  P.get('leaf').add(new THREE.IcosahedronGeometry(0.07, 1), { at: [-0.3, 0.04, 0.11], scale: [1, 0.8, 1], color: LEAF });
  for (let i = 0; i < 3; i++) P.get('paint').add(roundBox(0.03, 0.17 - i * 0.02, 0.14, 0.004), { at: [-0.12 + i * 0.035, -0.0 - i * 0.01, 0.1], color: ['#9fc8ff', '#ffd27a', '#c9b6ff'][i] });
  fox(P, [0.08, -0.08, 0.12], 0.5, 0.3);
  g.add(new THREE.CylinderGeometry(0.035, 0.035, 0.09, 14), { at: [0.3, -0.035, 0.11], color: ['#fff6ea', '#ffffff'] });
  const group = P.bake(new THREE.Group());
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }));
  flame.scale.y = 1.8;
  flame.position.set(0.3, 0.028, 0.11);
  const halo = glow('#ffb54a', 0.3);
  halo.position.copy(flame.position);
  group.add(flame, halo);
  return {
    object: group,
    update(dt, t, ctx) {
      const dark = ctx ? ctx.dark : 0;
      flame.visible = dark > 0.2;
      halo.material.opacity = 0.6 * dark * (0.85 + 0.15 * Math.sin(t * 13));
    },
  };
}

function mailbox() {
  const P = new Parts();
  const g = P.get('gloss');
  g.add(roundBox(0.3, 0.34, 0.15, 0.06), { at: [0, 0, 0.075], color: ['#ff8fb2', '#ffb3c9'] });
  P.get('dark').add(roundBox(0.18, 0.02, 0.01, 0.006), { at: [0, 0.09, 0.152] });
  P.get('paint').add(heart(0.09, 0.012), { at: [0, -0.04, 0.155], color: '#ffffff' });
  const group = P.bake(new THREE.Group());
  const flag = new THREE.Group();
  flag.position.set(0.16, -0.05, 0.08);
  const fb = new Batch();
  fb.add(new THREE.BoxGeometry(0.012, 0.16, 0.012), { at: [0, 0.08, 0], color: STEEL });
  fb.add(new THREE.BoxGeometry(0.01, 0.06, 0.07), { at: [0, 0.14, 0.035], color: '#ff4f7b' });
  flag.add(fb.mesh(MAT.gloss));
  group.add(flag);
  const letter = new THREE.Mesh(roundBox(0.15, 0.09, 0.008, 0.003), new THREE.MeshStandardMaterial({ color: '#fffaf1', roughness: 0.7 }));
  letter.position.set(0, 0.13, 0.15);
  letter.rotation.x = -0.2;
  const seal = new THREE.Mesh(heart(0.035, 0.004), new THREE.MeshBasicMaterial({ color: '#ff4f7b' }));
  seal.position.set(0, 0.0, 0.006);
  letter.add(seal);
  group.add(letter);
  const halo = glow('#ffd6e4', 0.4);
  halo.position.set(0, 0.12, 0.17);
  group.add(halo);
  let waiting = false;
  let up = 0;
  return {
    object: group,
    set(what, v) {
      if (what === 'mail') waiting = !!v;
    },
    update(dt, t) {
      up += ((waiting ? 1 : 0) - up) * (1 - Math.exp(-dt * 4));
      flag.rotation.z = -1.45 * (1 - up);
      letter.visible = up > 0.05;
      letter.position.y = 0.09 + 0.05 * up + (waiting ? Math.sin(t * 3) * 0.006 : 0);
      halo.material.opacity = waiting ? 0.45 + 0.25 * Math.sin(t * 3) : 0;
    },
  };
}

// ------------------------------------------------------------------ the presents of the days worth remembering

function cake() {
  const P = new Parts();
  const w = P.get('wood');
  w.add(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 28), { at: [0, 0.4, 0], color: WHITE });
  pole(w, [0, 0, 0], [0, 0.4, 0], 0.025, WHITE);
  w.add(new THREE.CylinderGeometry(0.12, 0.14, 0.02, 20), { at: [0, 0.01, 0], color: WHITE });
  const g = P.get('gloss');
  g.add(new THREE.CylinderGeometry(0.17, 0.17, 0.004, 28), { at: [0, 0.417, 0], color: '#ffffff' });
  P.get('paint').add(new THREE.CylinderGeometry(0.15, 0.15, 0.11, 28), { at: [0, 0.475, 0], color: ['#ffd0de', '#fff4f7'] });
  P.get('paint').add(new THREE.CylinderGeometry(0.1, 0.1, 0.09, 24), { at: [0, 0.575, 0], color: ['#fff4f7', '#ffffff'] });
  for (const [r, y, n] of [[0.15, 0.53, 14], [0.1, 0.62, 10]]) for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    g.add(new THREE.SphereGeometry(0.018, 8, 6), { at: [Math.cos(a) * r, y, Math.sin(a) * r], color: '#ffffff' });
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    g.add(new THREE.SphereGeometry(0.022, 10, 8), { at: [Math.cos(a) * 0.12, 0.545, Math.sin(a) * 0.12], scale: [1, 1.2, 1], color: '#e8344f' });
  }
  P.get('paint').add(new THREE.CylinderGeometry(0.008, 0.008, 0.08, 8), { at: [0, 0.66, 0], color: ['#ff8fb2', '#ffffff'] });
  const group = P.bake(new THREE.Group());
  const flame = new THREE.Mesh(new THREE.SphereGeometry(0.013, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffcf6a' }));
  flame.scale.y = 1.8;
  flame.position.set(0, 0.718, 0);
  const halo = glow('#ffb54a', 0.35);
  halo.position.copy(flame.position);
  group.add(flame, halo);
  return {
    object: group,
    spot: { x: 0, z: 0.45, yaw: Math.PI },
    update(dt, t) {
      flame.scale.set(1 + 0.1 * Math.sin(t * 17), 1.8 + 0.25 * Math.sin(t * 11), 1);
      halo.material.opacity = 0.45 + 0.1 * Math.sin(t * 13);
    },
  };
}

function bouquet() {
  const P = new Parts();
  P.get('wood').add(new THREE.CylinderGeometry(0.16, 0.18, 0.36, 20), { at: [0, 0.18, 0], color: WHITE });
  const glass = new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55 });
  const group = new THREE.Group();
  const vase = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, 0.24, 20, 1, true), glass);
  vase.position.y = 0.48;
  group.add(vase);
  const rnd = rng(9);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU;
    const out = rnd.range(0.02, 0.1);
    const top = [Math.cos(a) * out * 1.6, rnd.range(0.66, 0.8), Math.sin(a) * out * 1.6];
    tube(P.get('leaf'), [[Math.cos(a) * out * 0.3, 0.4, Math.sin(a) * out * 0.3], top], 0.005, '#4f9a4a', 6);
    const c = rnd.pick(['#e8344f', '#ff6f9c', '#ff9cbc', '#ffffff']);
    P.get('fabric').add(new THREE.IcosahedronGeometry(0.04, 1), { at: top, scale: [1, 0.85, 1], color: [tone(c, -0.12), c] });
    P.get('leaf').add(new THREE.SphereGeometry(0.03, 6, 4), { at: [top[0] * 1.1, top[1] - 0.06, top[2] * 1.1], scale: [1.4, 0.4, 0.8], color: LEAF });
  }
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU;
    P.get('fabric').add(new THREE.SphereGeometry(0.008, 5, 4), { at: [Math.cos(a) * rnd.range(0.04, 0.13), rnd.range(0.64, 0.82), Math.sin(a) * rnd.range(0.04, 0.13)], color: '#ffffff' });
  }
  P.bake(group);
  return { object: group, spot: { x: 0, z: 0.45, yaw: Math.PI } };
}

function balloons() {
  const P = new Parts();
  P.get('gloss').add(roundBox(0.12, 0.1, 0.12, 0.02), { at: [0, 0.05, 0], color: ['#ffd27a', '#ffe3a8'] });
  const group = P.bake(new THREE.Group());
  const list = [];
  const colors = ['#ff6f9c', '#ffd23f', '#ffffff', '#c9a6ff', '#ff9cbc'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const top = V(Math.cos(a) * 0.16, 1.2 + (i % 3) * 0.14, Math.sin(a) * 0.16);
    const b = new Batch();
    b.add(new THREE.SphereGeometry(0.13, 20, 16), { at: [0, 0.14, 0], scale: [1, 1.18, 1], color: colors[i] });
    b.add(new THREE.ConeGeometry(0.02, 0.03, 8), { at: [0, -0.005, 0], color: colors[i] });
    const ball = b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.2 }));
    ball.position.copy(top);
    group.add(ball);
    const str = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.1, 0), top]), new THREE.LineBasicMaterial({ color: '#ffffff' }));
    group.add(str);
    list.push({ ball, str, top, seed: i * 1.3 });
  }
  return {
    object: group,
    update(dt, t) {
      for (const b of list) {
        const x = b.top.x + Math.sin(t * 0.8 + b.seed) * 0.03;
        const z = b.top.z + Math.cos(t * 0.7 + b.seed) * 0.03;
        const y = b.top.y + Math.sin(t * 1.1 + b.seed) * 0.02;
        b.ball.position.set(x, y, z);
        const p = b.str.geometry.attributes.position;
        p.setXYZ(1, x, y, z);
        p.needsUpdate = true;
      }
    },
  };
}

function choco() {
  const P = new Parts();
  P.get('wood').add(new THREE.CylinderGeometry(0.18, 0.18, 0.03, 24), { at: [0, 0.32, 0], color: OAK });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.2;
    pole(P.get('wood'), [Math.cos(a) * 0.1, 0.31, Math.sin(a) * 0.1], [Math.cos(a) * 0.15, 0, Math.sin(a) * 0.15], 0.013, OAK);
  }
  const g = P.get('gloss');
  g.add(heart(0.3, 0.09), { at: [0, 0.4, 0.02], rot: [-Math.PI / 2, 0, 0], color: ['#c8243a', '#e8344f'] });
  g.add(heart(0.31, 0.02), { at: [0, 0.455, 0.02], rot: [-Math.PI / 2, 0, 0], color: ['#e8344f', '#ff5a6a'] });
  P.get('fabric').add(new THREE.BoxGeometry(0.3, 0.012, 0.03), { at: [0, 0.468, 0.0], color: '#ffd35a' });
  for (const s of [-1, 1]) P.get('fabric').add(new THREE.TorusGeometry(0.03, 0.01, 6, 12), { at: [s * 0.03, 0.485, 0.0], rot: [0, 0, s * 0.6], color: '#ffd35a' });
  return { object: P.bake(new THREE.Group()), spot: { x: 0, z: 0.45, yaw: Math.PI } };
}

function xmasTree() {
  const t = makeTree(0.92, false);
  return {
    object: t.object,
    spot: { x: 0, z: 0.75, yaw: Math.PI },
    update(dt, time, ctx) {
      t.update(time, ctx ? Math.max(0.35, ctx.dark) : 0.35);
    },
  };
}

function pumpkin() {
  const l = makeLantern(0.16);
  return {
    object: l.object,
    spot: { x: 0, z: 0.5, yaw: Math.PI },
    update(dt, time, ctx) {
      l.update(time, ctx ? Math.max(0.3, ctx.dark) : 0.3);
    },
  };
}

// ------------------------------------------------------------------ 뭉치's own things

/** Its two bowls on a mat: dry food and water. set('bowl', { food, water }): how full they are (0 … 1). */
function catBowl() {
  const P = new Parts();
  P.get('paint').add(roundBox(0.68, 0.016, 0.34, 0.008), { at: [0, 0.008, 0], color: ['#f7c9d6', '#ffe0e8'] });
  const g = P.get('gloss');
  for (const [x, color] of [
    [-0.165, ['#ff9cbc', '#ffc4d6']],
    [0.165, ['#8fd3e8', '#c2ecf6']],
  ]) {
    g.add(new THREE.CylinderGeometry(0.115, 0.135, 0.075, 30, 1, true), { at: [x, 0.054, 0], color });
    g.add(new THREE.TorusGeometry(0.11, 0.009, 8, 30), { at: [x, 0.092, 0], rot: [Math.PI / 2, 0, 0], color: '#fff6f2' });
    g.add(new THREE.CylinderGeometry(0.1, 0.1, 0.004, 26), { at: [x, 0.03, 0], color: '#fff6f2' });
  }
  const group = P.bake(new THREE.Group());
  // the food: little brown stars of it, in a heap
  const K = new Parts();
  const rnd = rng(7);
  for (let i = 0; i < 90; i++) {
    const a = rnd() * TAU;
    const r = Math.sqrt(rnd()) * 0.092;
    K.get('paint').add(new THREE.IcosahedronGeometry(0.0115, 0), { at: [Math.cos(a) * r, 0.012 + (1 - r / 0.1) * 0.03 + rnd() * 0.012, Math.sin(a) * r], rot: [rnd() * 3, rnd() * 3, 0], color: rnd() < 0.5 ? '#a9703f' : '#c98f58', flat: true });
  }
  const heap = K.bake(new THREE.Group());
  heap.position.set(-0.165, 0.028, 0);
  group.add(heap);
  const water = new THREE.Mesh(new THREE.CircleGeometry(0.1, 28), new THREE.MeshStandardMaterial({ color: '#a6e2f5', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.85 }));
  water.rotation.x = -Math.PI / 2;
  water.position.set(0.165, 0.08, 0);
  group.add(water);
  const fill = (o) => {
    const f = o || { food: 0, water: 0 };
    heap.visible = f.food > 0.02;
    heap.scale.set(0.8 + 0.2 * f.food, 0.25 + 0.9 * f.food, 0.8 + 0.2 * f.food);
    water.visible = f.water > 0.02;
    water.position.y = 0.04 + 0.042 * f.water;
  };
  fill(null);
  return {
    object: group,
    spot: { x: -0.165, z: 0.42, yaw: Math.PI },
    drink: { x: 0.165, z: 0.42 },
    set(what, v) {
      if (what === 'bowl') fill(v);
    },
  };
}

/** A cat tower: three round cushions, one over the other, on rope-wound posts; a ball on a string to bat at. */
function catTower() {
  const P = new Parts();
  P.get('wood').add(roundBox(0.72, 0.04, 0.72, 0.02), { at: [0, 0.02, 0], color: CREAM });
  const SISAL = ['#c9a878', '#e3c79c'];
  const rope = (x, z, y0, y1) => {
    const w = P.get('paint');
    const n = Math.round((y1 - y0) / 0.018);
    for (let i = 0; i < n; i++) w.add(new THREE.TorusGeometry(0.052, 0.0095, 6, 18), { at: [x, y0 + (i + 0.5) * 0.018, z], rot: [Math.PI / 2, 0, 0], color: i % 2 ? SISAL : ['#bd9a6a', '#d6b98d'] });
    w.add(new THREE.CylinderGeometry(0.05, 0.05, y1 - y0, 14), { at: [x, (y0 + y1) / 2, z], color: '#b89567' });
  };
  rope(-0.17, -0.17, 0.04, 0.4);
  rope(0.17, 0.12, 0.04, 0.74);
  rope(-0.14, -0.1, 0.4, 1.06);
  const cushion = (x, z, y, r, color) => {
    P.get('wood').add(new THREE.CylinderGeometry(r, r, 0.03, 32), { at: [x, y - 0.03, z], color: CREAM });
    P.get('paint').add(new THREE.CylinderGeometry(r - 0.012, r - 0.002, 0.042, 32), { at: [x, y, z], color });
    P.get('paint').add(new THREE.TorusGeometry(r - 0.012, 0.022, 10, 36), { at: [x, y + 0.022, z], rot: [Math.PI / 2, 0, 0], color });
  };
  const PINK = ['#f59bbb', '#ffc4d6'];
  const MINT = ['#9fd9c6', '#c9efe2'];
  cushion(-0.1, 0.12, 0.42, 0.25, PINK);
  cushion(0.13, -0.08, 0.76, 0.24, MINT);
  cushion(-0.08, 0.02, 1.08, 0.27, PINK);
  pole(P.get('metal'), [0.13, 0.72, 0.15], [0.17, 0.5, 0.18], 0.004, '#fff6ea');
  P.get('paint').add(new THREE.SphereGeometry(0.035, 14, 10), { at: [0.175, 0.47, 0.185], color: ['#ffd27a', '#ffe6ad'] });
  return {
    object: P.bake(new THREE.Group()),
    spot: { x: 0, z: 0.6, yaw: Math.PI },
    perches: [
      { x: -0.1, z: 0.12, h: 0.46 },
      { x: 0.13, z: -0.08, h: 0.8 },
      { x: -0.08, z: 0.02, h: 1.12 },
    ],
    post: { x: 0.17, z: 0.2 },
  };
}

// ------------------------------------------------------------------ the list

const SOFA = { pink: ['#f59bbb', '#ffc4d6'], cream: ['#e6d5c1', '#f8efe3'], sage: ['#9cc29c', '#c7e2c2'] };

export const FURNITURE = {
  sofa: { w: 1.5, d: 0.75, h: 0.72, kind: 'floor', build: () => sofa(SOFA.pink) },
  'sofa-cream': { w: 1.5, d: 0.75, h: 0.72, kind: 'floor', build: () => sofa(SOFA.cream) },
  'sofa-sage': { w: 1.5, d: 0.75, h: 0.72, kind: 'floor', build: () => sofa(SOFA.sage) },
  armchair: { w: 1.0, d: 0.75, h: 0.8, kind: 'floor', build: () => armchair(['#e8b84a', '#f6d27a']) },
  'armchair-pink': { w: 1.0, d: 0.75, h: 0.8, kind: 'floor', build: () => armchair(SOFA.pink) },
  chair: { w: 0.5, d: 0.5, h: 0.7, kind: 'floor', build: chair },
  beanbag: { w: 0.75, d: 0.75, h: 0.45, kind: 'floor', build: beanbag },
  bed: { w: 1.5, d: 2.0, h: 0.85, kind: 'floor', build: () => bed({ id: 'gingham', colors: ['#ff9fbd', '#ffffff'] }) },
  'bed-star': { w: 1.5, d: 2.0, h: 0.85, kind: 'floor', build: () => bed({ id: 'stars', colors: ['#ffd45e', '#3c4378'] }) },
  desk: { w: 1.0, d: 0.5, h: 0.8, kind: 'floor', build: desk },
  record: { w: 1.25, d: 0.5, h: 0.7, kind: 'floor', build: record },
  table: { w: 1.0, d: 0.5, h: 0.38, kind: 'floor', build: table },
  bookshelf: { w: 1.0, d: 0.5, h: 1.4, kind: 'floor', build: (o) => bookshelf(o.seed) },
  wardrobe: { w: 1.0, d: 0.5, h: 1.56, kind: 'floor', build: wardrobe },
  kitchen: { w: 1.5, d: 0.5, h: 1.25, kind: 'floor', build: kitchen },
  fridge: { w: 0.75, d: 0.75, h: 1.42, kind: 'floor', build: () => fridge(['#9fd9c6', '#c9efe2']) },
  lamp: { w: 0.5, d: 0.5, h: 1.25, kind: 'floor', build: lamp },
  plant: { w: 0.5, d: 0.5, h: 0.95, kind: 'floor', build: (o) => monstera(o.seed) },
  cactus: { w: 0.25, d: 0.25, h: 0.35, kind: 'floor', build: cactus },
  bear: { w: 0.5, d: 0.5, h: 0.72, kind: 'floor', build: bear },
  mic: { w: 0.5, d: 0.5, h: 1.25, kind: 'floor', build: mic },
  radio: { w: 0.5, d: 0.5, h: 0.9, kind: 'floor', build: radio },
  rug: { w: 1.5, d: 1.5, h: 0.02, kind: 'rug', build: () => roundRug(['#ffb5c9', '#fff4f7', '#ffd9a3']) },
  'rug-mint': { w: 1.5, d: 1.5, h: 0.02, kind: 'rug', build: () => roundRug(['#a8e0c4', '#f4fbf7', '#ffe3a8']) },
  'rug-stripe': { w: 2.0, d: 1.25, h: 0.02, kind: 'rug', build: () => stripeRug(['#ff9fbd', '#fff6ea', '#ffd27a']) },
  frame: { w: 0.55, h: 0.45, kind: 'wall', build: () => frame(0.55, 0.45, true) },
  'frame-tall': { w: 0.36, h: 0.8, kind: 'wall', build: () => frame(0.36, 0.8, false) },
  clock: { w: 0.44, h: 0.44, kind: 'wall', build: clock },
  calendar: { w: 0.42, h: 0.66, kind: 'wall', build: calendar },
  garland: { w: 1.6, h: 0.4, kind: 'wall', build: garland },
  poster: { w: 0.6, h: 0.8, kind: 'wall', build: poster },
  shelf: { w: 0.9, h: 0.36, kind: 'wall', build: wallShelf },
  mailbox: { w: 0.34, h: 0.4, kind: 'wall', fixed: true, build: mailbox },
  cake: { w: 0.5, d: 0.5, h: 0.75, kind: 'floor', build: cake },
  bouquet: { w: 0.5, d: 0.5, h: 0.85, kind: 'floor', build: bouquet },
  balloons: { w: 0.5, d: 0.5, h: 1.6, kind: 'floor', build: balloons },
  choco: { w: 0.5, d: 0.5, h: 0.5, kind: 'floor', build: choco },
  'xmas-tree': { w: 0.75, d: 0.75, h: 1.4, kind: 'floor', build: xmasTree },
  pumpkin: { w: 0.5, d: 0.5, h: 0.35, kind: 'floor', build: pumpkin },
  'cat-bowl': { w: 0.75, d: 0.5, h: 0.1, kind: 'floor', build: catBowl },
  'cat-tower': { w: 0.75, d: 0.75, h: 1.2, kind: 'floor', build: catTower },
};

/** Build one: its object (marked with what it is, for taps), and the rest of what it can do. */
export function makeFurniture(id, opts = {}) {
  const def = FURNITURE[id];
  if (!def) return null;
  const it = def.build(opts);
  it.def = def;
  it.object.traverse((o) => {
    if (o.isMesh && def.kind === 'rug') o.castShadow = false;
    if (o.isMesh) o.receiveShadow = true;
  });
  return it;
}
