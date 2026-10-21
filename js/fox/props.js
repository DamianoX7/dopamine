// The fox's own things — food bowl, ball, bed, microphone, the radio her covers play on — and
// the accessories it wears. Ids match the shop in js/pet.js. (What she buys for the yard is in
// decor.js.)
import * as THREE from '../vendor/three.module.min.js';
import { Batch, V, TAU, lerp, rng, softDotTexture, paintTexture } from './kit.js';

const Z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();
const _c2 = new THREE.Color();
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.5, ...o });
const shadowed = (mesh) => {
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
};

// ------------------------------------------------------------------ things in the habitat

export function makeBowl() {
  const group = new THREE.Group();
  const profile = [
    [0, 0.004], [0.085, 0.004], [0.108, 0.014], [0.114, 0.05], [0.104, 0.056], [0.094, 0.03], [0.07, 0.022], [0, 0.02],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const dish = shadowed(new THREE.Mesh(new THREE.LatheGeometry(profile, 28), std('#ff8fbd', { roughness: 0.32 })));
  // kibble: a little heap of two-tone pellets
  const heap = new Batch();
  const tones = ['#a8642f', '#8f4f24', '#c27a3c', '#b3542b'];
  for (let i = 0; i < 34; i++) {
    const a = i * 2.4;
    const r = 0.012 + (i % 9) * 0.0085;
    heap.add(new THREE.IcosahedronGeometry(0.0125, 0), { at: [Math.cos(a) * r, 0.034 + (1 - r / 0.09) * 0.022, Math.sin(a) * r], rot: [a, a * 2, 0], color: tones[i % 4], flat: true });
  }
  const food = heap.mesh();
  food.castShadow = false;
  group.add(dish, food);
  let level = 0;
  food.visible = false;
  return {
    object: group,
    radius: 0.13,
    get level() {
      return level;
    },
    setLevel(k) {
      level = Math.max(0, Math.min(1, k));
      food.visible = level > 0.02;
      food.scale.set(0.55 + 0.45 * level, level, 0.55 + 0.45 * level);
      food.position.y = 0.02 * (1 - level);
    },
  };
}

export function makeBall() {
  const batch = new Batch();
  const colors = ['#ff6fae', '#ffffff', '#8fd8ff', '#ffffff', '#ffd166', '#ffffff'];
  batch.add(new THREE.SphereGeometry(0.058, 20, 14), {
    color: (p, n) => _c.set(colors[Math.floor(((Math.atan2(n.z, n.x) / TAU + 0.5) * 6) % 6)]),
  });
  const mesh = batch.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 }));
  mesh.visible = false;
  return { object: mesh, radius: 0.058, vel: V(), active: false };
}

export function makeBed() {
  const group = new THREE.Group();
  const batch = new Batch();
  batch.add(new THREE.TorusGeometry(0.3, 0.085, 12, 32), { rot: [Math.PI / 2, 0, 0], at: [0, 0.07, 0], scale: [1, 1, 0.8], color: ['#e779a8', '#ffb3d1'] });
  batch.add(new THREE.SphereGeometry(0.29, 24, 12), { at: [0, 0.03, 0], scale: [1, 0.2, 1], color: ['#f3e4d0', '#fff6ea'] });
  group.add(batch.mesh());
  return { object: group, radius: 0.36 };
}

export function makeMic() {
  const group = new THREE.Group();
  const metal = std('#c9c9d6', { metalness: 0.7, roughness: 0.3 });
  const base = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.014, 24), std('#3a2a45', { roughness: 0.4 })));
  base.position.y = 0.007;
  const pole = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 1, 10), metal));
  const head = new THREE.Group();
  const body = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.013, 0.06, 14), std('#ff6fae', { roughness: 0.35 })));
  body.position.y = -0.03;
  const grille = shadowed(new THREE.Mesh(new THREE.SphereGeometry(0.027, 16, 12), metal));
  grille.position.y = 0.018;
  head.add(body, grille);
  head.rotation.x = -0.9; // leans back towards the singer, who stands behind it and faces the camera
  group.add(base, pole, head);
  return {
    object: group,
    radius: 0.1,
    setHeight(h) {
      pole.scale.y = h;
      pole.position.y = h / 2;
      head.position.set(0, h + 0.012, -0.016);
    },
  };
}

/**
 * The radio one of her covers plays on: it is there while the music is, at the front of the
 * yard, and bobs to the beat. The foxes gather behind it — facing it, and her.
 */
export function makeRadio() {
  const group = new THREE.Group();
  const body = new THREE.Group();
  const b = new Batch();
  b.add(new THREE.BoxGeometry(0.3, 0.17, 0.11), { at: [0, 0.103, 0], color: ['#ff7fae', '#ffc4da'] });
  for (const s of [1, -1]) {
    // a loudspeaker on each side
    b.add(new THREE.CylinderGeometry(0.056, 0.056, 0.012, 20), { at: [0.083 * s, 0.092, 0.056], rot: [Math.PI / 2, 0, 0], color: '#3a2a45' });
    b.add(new THREE.TorusGeometry(0.056, 0.008, 6, 20), { at: [0.083 * s, 0.092, 0.061], color: '#fff6fa' });
    b.add(new THREE.SphereGeometry(1, 10, 8), { at: [0.083 * s, 0.092, 0.063], scale: [0.02, 0.02, 0.009], color: '#ffd166' });
    b.add(new THREE.BoxGeometry(0.05, 0.016, 0.07), { at: [0.1 * s, 0.008, 0], color: '#3a2a45' });
  }
  b.add(new THREE.BoxGeometry(0.076, 0.03, 0.006), { at: [0, 0.156, 0.056], color: '#fff6fa' }); // the dial
  b.add(new THREE.BoxGeometry(0.004, 0.022, 0.004), { at: [0.012, 0.156, 0.06], color: '#ff2d6f' });
  ['#ffffff', '#ffd166', '#8fd8ff', '#c79bff'].forEach((color, i) => b.add(new THREE.BoxGeometry(0.032, 0.012, 0.03), { at: [-0.06 + i * 0.04, 0.194, 0.012], color }));
  b.add(new THREE.TorusGeometry(0.1, 0.01, 6, 18, Math.PI), { at: [0, 0.186, -0.024], color: '#fff6fa' }); // the handle
  b.add(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 5), { at: [0.155, 0.275, -0.035], rot: [0, 0, -0.42], color: '#d9d9e6' }); // the aerial
  b.add(new THREE.SphereGeometry(0.009, 8, 6), { at: [0.196, 0.366, -0.035], color: '#ff4f8b' });
  const mesh = shadowed(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 })));
  body.add(mesh);
  group.add(body);
  group.visible = false;
  let shown = 0;
  let thump = 0;
  return {
    object: group,
    radius: 0.2,
    top: 0.3, // where its notes come out
    /** On a beat. */
    kick(k = 1) {
      thump = Math.max(thump, k);
    },
    update(dt, on) {
      shown += ((on ? 1 : 0) - shown) * (1 - Math.exp(-(on ? 9 : 6) * dt));
      thump *= Math.exp(-9 * dt);
      group.visible = shown > 0.02;
      // it pops up with a little overshoot, and swells on every beat
      const pop = shown * (1 + 0.35 * Math.sin(Math.min(1, shown) * Math.PI));
      body.scale.set(pop * (1 + 0.1 * thump), pop * (1 - 0.08 * thump), pop * (1 + 0.1 * thump));
      body.rotation.z = Math.sin(performance.now() * 0.004) * 0.05 * shown;
    },
  };
}

/** Where his letters arrive: a little mailbox by the yard, its flag up while one is waiting. */
export function makeMailbox() {
  const group = new THREE.Group();
  const post = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.024, 0.3, 10), std('#8a5a3c', { roughness: 0.85 })));
  post.position.y = 0.15;
  // the box lies along Z, its door to the front; a barrel roof over it
  const box = new Batch();
  box.add(new THREE.BoxGeometry(0.14, 0.07, 0.2), { at: [0, 0.335, 0], color: ['#ff5fa2', '#ff8fbd'] });
  box.add(new THREE.CylinderGeometry(0.07, 0.07, 0.2, 20, 1, false, -Math.PI / 2, Math.PI), { at: [0, 0.37, 0], rot: [-Math.PI / 2, 0, 0], color: '#ff8fbd' });
  box.add(new THREE.CircleGeometry(0.052, 20), { at: [0, 0.362, 0.1012], scale: [1, 1.05, 1], color: '#fff6fa' }); // the door
  box.add(new THREE.SphereGeometry(1, 10, 8), { at: [0, 0.372, 0.104], scale: [0.014, 0.013, 0.005], color: '#ff4f8b' }); // …with a heart-red knob
  const body = shadowed(box.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 })));
  const flag = new THREE.Group();
  const arm = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.082, 0.012), std('#f4f4f6', { roughness: 0.4 }));
  arm.position.y = 0.041;
  const pennant = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.034, 0.05), std('#ff3d6e', { roughness: 0.4 }));
  pennant.position.set(0, 0.066, 0.028);
  flag.add(arm, pennant);
  flag.position.set(0.076, 0.345, -0.02);
  flag.rotation.x = Math.PI / 2; // lying along the box: nothing in it
  flag.traverse((o) => (o.castShadow = true));
  group.add(post, body, flag);
  let up = 0;
  return {
    object: group,
    radius: 0.1,
    slot: 0.36, // how high the door is
    setFlag(on) {
      up = on ? 1 : 0;
    },
    update(dt) {
      const want = up ? 0 : Math.PI / 2;
      flag.rotation.x += (want - flag.rotation.x) * (1 - Math.exp(-9 * dt));
    },
  };
}

/** A letter for a fox to carry: held by one edge between its teeth, its face turned up to you. */
export function makeLetter(rig) {
  const k = rig.headScale;
  const g = new THREE.Group();
  const b = new Batch();
  // pink, so that it shows against a white chest as well as a red one
  b.add(new THREE.BoxGeometry(0.118, 0.078, 0.006), { color: '#ff9fc6' });
  for (const s of [1, -1]) b.add(new THREE.BoxGeometry(0.07, 0.0045, 0.002), { at: [0.0285 * s, 0.015, 0.0038], rot: [0, 0, 0.5 * s], color: '#ffffff' }); // the flap
  b.add(new THREE.SphereGeometry(1, 10, 8), { at: [0, -0.003, 0.0044], scale: [0.015, 0.014, 0.004], color: '#ff2d6f' }); // the seal
  const paper = b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }));
  paper.position.y = 0.026; // bitten near its lower edge
  paper.castShadow = true;
  g.add(paper);
  const nose = rig.dims.noseTip;
  g.position.set(0, nose.y - 0.017 * k, nose.z - 0.012 * k);
  g.rotation.x = -0.62;
  return g;
}

/** What a fox brings her from an expedition: a little parcel, carried by its bow. */
export function makeGift(rig) {
  const k = rig.headScale;
  const g = new THREE.Group();
  const b = new Batch();
  const W = 0.066; // the box, hanging below the bow that is between its teeth
  const H = 0.054;
  const y = -(H / 2 + 0.014);
  b.add(new THREE.BoxGeometry(W, H, W), { at: [0, y, 0], color: ['#ff7fb0', '#ffb3d1'] });
  b.add(new THREE.BoxGeometry(W + 0.003, H + 0.003, W * 0.24), { at: [0, y, 0], color: '#fffaf1' }); // the ribbon, round it both ways
  b.add(new THREE.BoxGeometry(W * 0.24, H + 0.003, W + 0.003), { at: [0, y, 0], color: '#fffaf1' });
  for (const s of [1, -1]) b.add(new THREE.SphereGeometry(1, 10, 8), { at: [0.017 * s, -0.006, 0], rot: [0, 0, 0.55 * s], scale: [0.019, 0.011, 0.012], color: '#fffaf1' }); // …and the bow
  b.add(new THREE.SphereGeometry(1, 8, 6), { at: [0, -0.008, 0], scale: [0.008, 0.008, 0.009], color: '#ffe3ee' });
  const parcel = b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }));
  parcel.castShadow = true;
  g.add(parcel);
  const nose = rig.dims.noseTip;
  g.position.set(0, nose.y - 0.02 * k, nose.z - 0.014 * k);
  g.rotation.x = 0.18; // (it swings a little forward of the chin)
  return g;
}

/**
 * A present, wrapped and tied with a bow: what Lorelei has for her on a day of theirs (world.js: present). It is
 * hers to carry, so it is made in the world's own measure. `lid` comes off when it opens. `wrap`: its paper, its lid
 * and its ribbon — pink and white, or (PAPER.christmas) red, green and gold.
 */
export const PAPER = {
  day: { box: ['#ff8fbd', '#ffb9d6'], lid: ['#ff6fa8', '#ff8fbd'], ribbon: '#fffaf1', knot: '#ffe3ee' },
  christmas: { box: ['#c8243a', '#e23d50'], lid: ['#2f8a4e', '#3fa262'], ribbon: '#ffd35a', knot: '#ffe48a' },
};

export function makePresent(wrap = PAPER.day) {
  const group = new THREE.Group();
  const W = 0.2;
  const H = 0.15;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
  const box = new Batch();
  box.add(new THREE.BoxGeometry(W, H, W), { at: [0, H / 2, 0], color: wrap.box });
  box.add(new THREE.BoxGeometry(W + 0.006, H + 0.002, W * 0.2), { at: [0, H / 2, 0], color: wrap.ribbon }); // the ribbon, round it both ways
  box.add(new THREE.BoxGeometry(W * 0.2, H + 0.002, W + 0.006), { at: [0, H / 2, 0], color: wrap.ribbon });
  const body = box.mesh(mat);
  const top = new Batch();
  top.add(new THREE.BoxGeometry(W + 0.024, 0.04, W + 0.024), { at: [0, 0.02, 0], color: wrap.lid });
  top.add(new THREE.BoxGeometry(W + 0.03, 0.042, W * 0.2), { at: [0, 0.02, 0], color: wrap.ribbon });
  top.add(new THREE.BoxGeometry(W * 0.2, 0.042, W + 0.03), { at: [0, 0.02, 0], color: wrap.ribbon });
  for (const s of [1, -1]) top.add(new THREE.SphereGeometry(1, 12, 8), { at: [0.045 * s, 0.064, 0], rot: [0, 0, 0.5 * s], scale: [0.05, 0.028, 0.03], color: wrap.ribbon }); // …and the bow
  top.add(new THREE.SphereGeometry(1, 10, 8), { at: [0, 0.058, 0], scale: [0.02, 0.02, 0.022], color: wrap.knot });
  const lid = new THREE.Group();
  lid.add(top.mesh(mat));
  lid.position.y = H;
  group.add(body, lid);
  group.visible = false;
  return { object: group, body, lid, height: H, radius: 0.15 };
}

// ------------------------------------------------------------------ accessories

function bow(k) {
  const g = new THREE.Group();
  const b = new Batch();
  for (const s of [1, -1]) {
    b.add(new THREE.SphereGeometry(1, 14, 10), { at: [0.03 * s, 0.004, 0], rot: [0, 0, -0.28 * s], scale: [0.03, 0.021, 0.012], color: ['#ff4f9a', '#ff8fbf'] });
    b.add(new THREE.BoxGeometry(0.015, 0.042, 0.005), { at: [0.014 * s, -0.03, -0.002], rot: [0, 0, 0.38 * s], color: '#ff5fa2' });
  }
  b.add(new THREE.SphereGeometry(1, 10, 8), { scale: [0.011, 0.012, 0.013], color: '#e03a84' });
  g.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 })));
  g.scale.setScalar(k);
  return g;
}

function flower(k) {
  const g = new THREE.Group();
  const b = new Batch();
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + 0.3;
    b.add(new THREE.SphereGeometry(1, 10, 8), { at: [Math.cos(a) * 0.017, Math.sin(a) * 0.017, 0], rot: [0, 0, a], scale: [0.016, 0.012, 0.005], color: (p) => _c.set('#ffffff').lerp(new THREE.Color('#ff9ecb'), Math.min(1, Math.hypot(p.x, p.y) / 0.03)) });
  }
  b.add(new THREE.SphereGeometry(0.0085, 10, 8), { at: [0, 0, 0.004], color: '#ffd23f' });
  b.add(new THREE.SphereGeometry(1, 8, 6), { at: [-0.026, -0.022, -0.004], rot: [0, 0, 0.8], scale: [0.016, 0.008, 0.003], color: '#58b368' });
  g.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));
  g.scale.setScalar(k);
  return g;
}

function crown(k) {
  const g = new THREE.Group();
  const gold = std('#ffcc33', { metalness: 0.85, roughness: 0.25, emissive: '#6b4300', emissiveIntensity: 0.45, side: THREE.DoubleSide });
  g.add(shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.031, 0.028, 0.017, 24, 1, true), gold)));
  const gems = ['#ff4f8b', '#6fd3ff', '#b36bff', '#7ee0a3', '#ff4f8b'];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + Math.PI / 2;
    const spike = shadowed(new THREE.Mesh(new THREE.ConeGeometry(0.0095, 0.024, 4), gold));
    spike.position.set(Math.cos(a) * 0.0295, 0.02, Math.sin(a) * 0.0295);
    spike.rotation.y = -a;
    const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.0046, 8, 6), gold);
    pearl.position.set(Math.cos(a) * 0.0295, 0.034, Math.sin(a) * 0.0295);
    const gem = new THREE.Mesh(new THREE.SphereGeometry(0.0052, 8, 6), std(gems[i], { roughness: 0.15, emissive: gems[i], emissiveIntensity: 0.25 }));
    const ga = a + TAU / 10;
    gem.position.set(Math.cos(ga) * 0.03, 0, Math.sin(ga) * 0.03);
    g.add(spike, pearl, gem);
  }
  g.scale.setScalar(k);
  return g;
}

function glasses(rig) {
  const k = rig.headScale;
  const g = new THREE.Group();
  const frame = std('#17131c', { roughness: 0.3 });
  const lensMat = std('#2a1f3a', { roughness: 0.06, metalness: 0.55 });
  const r = 0.0245 * k * rig.species.eye;
  const ends = [];
  rig.face.eyes.forEach((e, i) => {
    const sg = i ? -1 : 1;
    const out = V(0.36 * sg, 0.3, 0.88).normalize();
    const at = e.eye.position.clone().addScaledVector(out, 0.021 * k * rig.species.eye);
    const lens = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(r, r, 0.004, 22), lensMat));
    const rim = new THREE.Mesh(new THREE.TorusGeometry(r, 0.003 * k, 6, 22), frame);
    const q = new THREE.Quaternion().setFromUnitVectors(Z, out);
    rim.quaternion.copy(q);
    lens.quaternion.copy(q).multiply(new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), Math.PI / 2));
    lens.position.copy(at);
    rim.position.copy(at);
    g.add(lens, rim);
    ends.push(at);
    // the arm, back to the ear
    const ear = rig.dims.earBase.clone();
    ear.x *= sg * 1.25;
    ear.y -= 0.03 * k;
    const from = at.clone().add(V(r * 0.95 * sg, 0, -0.004));
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.0026 * k, 0.0026 * k, from.distanceTo(ear), 6), frame);
    arm.position.copy(from).add(ear).multiplyScalar(0.5);
    arm.quaternion.setFromUnitVectors(V(0, 1, 0), ear.clone().sub(from).normalize());
    g.add(arm);
  });
  const bridge = new THREE.Mesh(new THREE.CylinderGeometry(0.003 * k, 0.003 * k, ends[0].distanceTo(ends[1]) - r * 1.7, 6), frame);
  bridge.position.copy(ends[0]).add(ends[1]).multiplyScalar(0.5);
  bridge.position.y += r * 0.25;
  bridge.rotation.z = Math.PI / 2;
  g.add(bridge);
  return g;
}

function headphones(k) {
  const g = new THREE.Group();
  const R = 0.094;
  const white = std('#ffffff', { roughness: 0.4 });
  const pink = std('#ff7fb5', { roughness: 0.38 });
  const band = shadowed(new THREE.Mesh(new THREE.TorusGeometry(R, 0.0085, 8, 28, Math.PI), white));
  g.add(band);
  for (const s of [1, -1]) {
    const cup = shadowed(new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.034, 0.024, 20), pink));
    cup.rotation.z = Math.PI / 2;
    cup.position.set((R + 0.004) * s, -0.004, 0);
    const pad = new THREE.Mesh(new THREE.TorusGeometry(0.027, 0.009, 8, 18), white);
    pad.rotation.y = Math.PI / 2;
    pad.position.set((R - 0.008) * s, -0.004, 0);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.012, 10, 8), white);
    dot.scale.x = 0.4;
    dot.position.set((R + 0.017) * s, -0.004, 0);
    g.add(cup, pad, dot);
  }
  g.scale.setScalar(k);
  return g;
}

function scarf(rig) {
  const g = new THREE.Group();
  const R = rig.dims.neckR + 0.022 * rig.species.fur;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
  const ring = new Batch().add(new THREE.TorusGeometry(R, 0.025, 10, 28), {
    scale: [1, 1, 0.9],
    color: (p) => _c.set(Math.floor(((Math.atan2(p.y, p.x) / TAU + 0.5) * 14) % 2) ? '#ff5a7d' : '#fff4f6'),
  });
  g.add(ring.mesh(mat));
  // halfway up the neck, the ring square to it (its -Y side is the throat) — or where a kind with no neck to speak of wears it
  const up = rig.bones.head.userData.rest.clone();
  g.position.copy(rig.dims.scarfAt || up.clone().multiplyScalar(0.42));
  g.quaternion.setFromUnitVectors(Z, up.normalize());
  // the loose end hangs straight down from the front of the ring
  const end = new Batch()
    .add(new THREE.BoxGeometry(0.046, 0.1, 0.014, 1, 6, 1), { at: [0, -0.05, 0], color: (p) => _c.set(Math.floor((p.y + 1) * 60) % 2 ? '#ff5a7d' : '#fff4f6') })
    .mesh(mat);
  const worldUp = V(0, 1, 0).applyQuaternion(g.quaternion.clone().invert());
  end.quaternion.setFromUnitVectors(V(0, 1, 0), worldUp);
  end.position.set(R * 0.4, -R * 0.96, 0);
  end.rotateZ(0.12);
  g.add(end);
  return g;
}

// ------------------------------------------------------------------ Halloween

/**
 * A pointed witch's hat, its brim `R` across from the middle, the foot of its cone `head` across (what it fits over)
 * and `tall` high: a dark violet cone that bends back at its tip, an orange band round its foot with a gold buckle.
 * Its foot is at the origin, the buckle to +Z. (Lorelei's on Halloween — and the foxes' in miniature.)
 */
export function makeWitchHat(R = 0.2, head = 0.44 * R, tall = 1.45 * R) {
  const k = R / 0.2;
  const T = tall / 0.29; // (how far its tip bends goes with how tall it is)
  const b = new Batch();
  const brim = [[0.07, 0.004], [0.15, -0.004], [0.192, 0.004], [0.2, 0.018], [0.196, 0.022], [0.184, 0.012], [0.15, 0.006], [0.07, 0.012]];
  b.add(new THREE.LatheGeometry(brim.map(([x, y]) => new THREE.Vector2(x * k, y * k)), 40), { color: (p) => _c.set('#33204a').lerp(_c2.set('#4a2f69'), clamp01(Math.hypot(p.x, p.z) / (0.2 * k))) });
  // the cone: up from the brim, and over towards the back as it narrows (the higher, the further)
  const rows = 14;
  const cone = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    cone.push(new THREE.Vector2(head * Math.pow(1 - t, 1.15) + 0.0015 * k, tall * t));
  }
  const spire = new THREE.LatheGeometry(cone, 28);
  const pos = spire.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = pos.getY(i) / tall;
    const bend = Math.pow(Math.max(0, t - 0.35) / 0.65, 2);
    pos.setZ(i, pos.getZ(i) - 0.12 * T * bend);
    pos.setY(i, pos.getY(i) - 0.05 * T * bend);
  }
  spire.computeVertexNormals();
  b.add(spire, { color: ['#3a2553', '#5b3a80'] });
  b.add(new THREE.CylinderGeometry(head * 0.9, head * 1.035, 0.034 * k, 28, 1, true), { at: [0, 0.017 * k, 0], color: '#ff8a2a' }); // the band, round the cone
  b.add(new THREE.BoxGeometry(0.044 * k, 0.034 * k, 0.008 * k), { at: [0, 0.017 * k, head * 1.04], color: '#ffd24a' }); //       …its buckle
  b.add(new THREE.BoxGeometry(0.026 * k, 0.018 * k, 0.009 * k), { at: [0, 0.017 * k, head * 1.05], color: '#3a2553' });
  const mesh = b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75, side: THREE.DoubleSide }));
  const g = new THREE.Group();
  g.add(mesh);
  return g;
}

/**
 * Lorelei's witch's hat (in her head bone's space), tipped a little to her right, away from the tie of her tail. Her
 * hair stands up from her head in a dome, its fringe forward: the cone is wide enough at its foot to go over all of it,
 * and the brim stays clear of the tie below. (Measured off her model: nothing of the hair within 6 mm of the hat.)
 */
export function makeOwnerHat(rig) {
  const hat = makeWitchHat(0.18, 0.11);
  hat.position.copy(rig.dims.crown).add(V(-0.012, -0.0225, 0.004));
  hat.rotation.set(-0.08, 0, 0.14);
  hat.traverse((o) => (o.castShadow = true));
  return hat;
}

/**
 * What Lorelei puts on for the seasons and the days, beside her witch's hat (world.js: dressOwner) — each { object,
 * bone } (her head bone, unless it says), with `more`: [bone, object] that goes with it:
 *   santa   at Christmas: a Santa hat, its point flopping over to her right and back
 *   straw   in summer: a straw hat with a pink ribbon
 *   beret   in autumn: a wine-red beret, tipped to her right
 *   pin     in spring: cherry blossom in her hair, over her right temple
 *   scarf   in winter: a knitted scarf round her neck (her neck bone), its ends down her front (her chest bone)
 * The hats sit where her witch's hat does: over the dome of her hair, clear of the tie of her tail (at the back, on her
 * left). The scarf goes round her neck inside the locks before her ears and her tail of hair, which hang 9.6 cm and
 * more from the middle of it; its ends lie over her top, a little off it. (Measured off her model: in her own measure,
 * 1 = her height.)
 */
export function makeOwnerClothes(rig) {
  const at = rig.dims.crown.clone().add(V(-0.012, -0.0225, 0.004)); // (where her witch's hat sits)
  const hat = (object, rx, rz, lift = 0) => {
    object.position.copy(at);
    object.position.y += lift;
    object.rotation.set(rx, 0, rz);
    object.traverse((o) => (o.castShadow = true));
    return { object, bone: 'head' };
  };
  const out = {
    santa: hat(makeSantaHat(0.112, 0.2, { flop: [-0.8, -0.6], droop: 0.34 }), -0.14, 0.12, -0.01),
    straw: hat(makeStrawHat(0.19, 0.112, 0.08), -0.12, 0.1),
    beret: hat(makeBeret(0.135, 0.07), -0.1, 0.3, -0.004),
  };

  // cherry blossom over her right temple: three flowers and two leaves, on her hair
  const n = V(-0.85, 0.42, 0.31).normalize(); // (straight out of her hair there)
  const P = V(-0.104, 0.205, 0.037).addScaledVector(n, 0.004);
  const u = V().crossVectors(n, V(0, 1, 0)).normalize();
  const v = V().crossVectors(u, n).normalize();
  const flowers = new Batch();
  const spot = (a, b) => P.clone().addScaledVector(u, a).addScaledVector(v, b);
  for (const [a, b, l, w] of [[0.028, -0.016, 0.034, 0.6], [-0.024, -0.025, 0.032, -0.7]]) {
    const q = new THREE.Quaternion().setFromUnitVectors(Z, n).multiply(new THREE.Quaternion().setFromAxisAngle(Z, w));
    flowers.add(new THREE.SphereGeometry(1, 8, 6), { matrix: new THREE.Matrix4().compose(spot(a, b), q, V(l * 0.5, l * 0.2, 0.004)), color: '#62b06a' });
  }
  blossom(flowers, spot(0, 0), n, 0.046, '#ff9ec4', 0.3);
  blossom(flowers, spot(0.03, 0.015), n.clone().add(u.clone().multiplyScalar(0.3)), 0.036, '#ffc6dc', 1.1);
  blossom(flowers, spot(-0.026, 0.02), n.clone().add(u.clone().multiplyScalar(-0.3)), 0.034, '#ffb3d1', 2.2);
  out.pin = { object: flowers.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })), bone: 'head' };

  // the scarf: knitted, cream with red stripes
  const knit = (a) => _c.set('#f7ede2').lerp(_c2.set('#e9dccc'), 0.5 + 0.5 * Math.sin(a * 46)); // (cream, in ribs round it)
  const wool = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
  const ring = new Batch();
  ring.add(lumpy(new THREE.TorusGeometry(0.046, 0.021, 12, 40), 0.08, 7), { rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.94], color: (q) => knit(Math.atan2(q.z, q.x)) });
  ring.add(lumpy(new THREE.TorusGeometry(0.047, 0.014, 10, 36), 0.1, 9), { at: [0.002, 0.016, -0.002], rot: [Math.PI / 2 - 0.12, 0.1, 0], color: (q) => knit(Math.atan2(q.z, q.x) + 0.3) }); // (wound round twice)
  const collar = ring.mesh(wool);
  collar.position.set(0, 0.029, 0.003); // (round her neck, resting on her shoulders: 72.7 cm up her, the front a little lower)
  collar.rotation.x = 0.16;
  // its ends: two flat strips from the front of it, on her left, down over her top — and a fringe at the bottom of each
  const ends = new Batch();
  const strip = (top, bottom, w, yaw, tint) => {
    const len = top.distanceTo(bottom);
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, -1, 0), bottom.clone().sub(top).normalize()).multiply(new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw));
    const mid = top.clone().add(bottom).multiplyScalar(0.5);
    ends.add(lumpy(new THREE.BoxGeometry(w, len, 0.009, 2, 8, 1), 0.04, 11), {
      matrix: new THREE.Matrix4().compose(mid, q, V(1, 1, 1)),
      byFace: true,
      color: (p) => _c.set(Math.floor(((p.y - bottom.y) / len) * 9) % 3 === 1 && p.y < bottom.y + len * 0.55 ? '#d8394a' : tint),
    });
    for (let i = 0; i < 5; i++) {
      const x = (i / 4 - 0.5) * w * 0.85;
      const f = bottom.clone().add(V(x, 0, 0).applyQuaternion(q));
      ends.add(new THREE.CylinderGeometry(0.0022, 0.0018, 0.016, 5), { at: [f.x, f.y - 0.008, f.z], color: tint });
    }
  };
  const chest = V(0, 0.585, 0); // (her chest bone: the ends go with it)
  strip(V(0.03, 0.716, 0.05).sub(chest), V(0.04, 0.628, 0.064).sub(chest), 0.036, 0.12, '#f7ede2');
  strip(V(0.012, 0.712, 0.056).sub(chest), V(0.004, 0.642, 0.07).sub(chest), 0.032, -0.2, '#f3e6d8');
  const tails = ends.mesh(wool);
  out.scarf = { object: collar, bone: 'neck', more: [['chest', tails]] };
  for (const k of ['pin', 'scarf']) out[k].object.traverse((o) => (o.castShadow = true));
  tails.castShadow = true;
  return out;
}

/** 1 on a rib of a pumpkin, 0 in the groove between two (one rib looks straight ahead, to +Z). */
const ribCrest = (x, z, ribs = 8) => Math.pow(Math.abs(Math.cos(((Math.atan2(z, x) - Math.PI / 2) * ribs) / 2)), 0.6);

// A jack-o'-lantern's face — two eyes, a nose and a grin with two teeth — as it looks from in front of a pumpkin one
// unit round (x to the right, y up; it is painted round the ball, see faceTextures).
const FACE = [
  [[-0.46, 0.08], [-0.12, 0.08], [-0.28, 0.4]],
  [[0.12, 0.08], [0.46, 0.08], [0.28, 0.4]],
  [[-0.08, -0.06], [0.08, -0.06], [0, 0.06]],
  [[-0.6, -0.12], [-0.3, -0.2], [-0.21, -0.34], [-0.13, -0.2], [0.13, -0.2], [0.21, -0.34], [0.3, -0.2], [0.6, -0.12], [0.46, -0.38], [0.17, -0.54], [-0.17, -0.54], [-0.46, -0.38]],
];
const faces = {};

/**
 * The face, painted where it falls on a sphere's own texture (three.js: u once round from behind, v from the bottom up):
 * `map` — the colour of the pumpkin, with the face cut out of it dark — and `glow`, where the light inside shows.
 */
function faceTextures(kind) {
  if (faces[kind]) return faces[kind];
  const draw = (cut, rest) =>
    paintTexture(512, (g, s) => {
      g.fillStyle = rest;
      g.fillRect(0, 0, s, s);
      g.fillStyle = cut;
      for (const pts of FACE) {
        g.beginPath();
        pts.forEach(([x, y], i) => {
          const u = 0.25 + Math.asin(clamp01(Math.abs(x) / Math.sqrt(1 - y * y))) * Math.sign(x) / TAU; // (straight ahead, +Z, is a quarter of the way round)
          const v = Math.acos(y) / Math.PI;
          g[i ? 'lineTo' : 'moveTo'](u * s, v * s);
        });
        g.closePath();
        g.fill();
      }
    });
  const lit = kind === 'lit';
  const out = { map: draw(lit ? '#ffcf6a' : '#3a1a08', '#ffffff'), glow: lit ? draw('#ffffff', '#000000') : null };
  for (const t of [out.map, out.glow]) if (t) t.userData.shared = true;
  return (faces[kind] = out);
}

/**
 * A pumpkin, `r` round and not as tall, sitting on the origin: pressed in between its ribs and at the top, with its
 * stalk and a leaf; `face` = 'lit' (a jack-o'-lantern), 'carved', or none. Its face is to +Z.
 */
function pumpkin(r, face = null) {
  const g = new THREE.Group();
  const geo = new THREE.SphereGeometry(1, 40, 20);
  const p = geo.attributes.position;
  const col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const crest = ribCrest(x, z);
    const k = r * (0.88 + 0.12 * crest);
    p.setXYZ(i, x * k, y * r * 0.8 * (1 - 0.2 * Math.pow(Math.abs(y), 8)), z * k);
    _c.set('#cf4a14').lerp(_c2.set('#ff9a2e'), crest);
    col.set([_c.r, _c.g, _c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.computeVertexNormals();
  const tex = face ? faceTextures(face) : null;
  const skin = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, map: tex ? tex.map : null });
  if (tex && tex.glow) Object.assign(skin, { emissive: new THREE.Color('#ffa83a'), emissiveMap: tex.glow, emissiveIntensity: 1 });
  const body = new THREE.Mesh(geo, skin);
  body.position.y = r * 0.78;
  const b = new Batch();
  b.add(new THREE.CylinderGeometry(r * 0.09, r * 0.14, r * 0.36, 7), { at: [r * 0.03, r * 1.52, 0], rot: [0, 0, -0.28], color: ['#5c7a2c', '#7a5a2c'] }); // the stalk
  b.add(new THREE.SphereGeometry(1, 8, 6), { at: [-r * 0.2, r * 1.44, r * 0.06], rot: [0.3, 0, 0.4], scale: [r * 0.26, r * 0.03, r * 0.14], color: '#4f9a3a' }); // …and a leaf
  g.add(body, b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));
  g.userData.skin = skin;
  return g;
}

/**
 * A jack-o'-lantern for the yard on Halloween: its face looks out of the candle-light inside it, which glows round it
 * as night falls (`glow`: 0 by day … 1 in the dark) and flickers. Its face is to +Z.
 */
export function makeLantern(r = 0.085) {
  const group = pumpkin(r, 'lit');
  const skin = group.userData.skin;
  group.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: '#ff9a3c', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.set(0, r * 0.8, r * 0.7);
  halo.scale.setScalar(r * 5.5);
  halo.renderOrder = 6;
  group.add(halo);
  const seed = Math.random() * 100;
  return {
    object: group,
    radius: r,
    update(time, glow) {
      const flicker = 0.86 + 0.08 * Math.sin(time * 9.1 + seed) + 0.06 * Math.sin(time * 23.7 + seed * 2);
      skin.emissiveIntensity = (0.5 + 2.2 * glow) * flicker; // (by day, a yellow face; in the dark, candle-light)
      halo.material.opacity = 0.5 * glow * flicker;
      halo.visible = glow > 0.02;
    },
  };
}

// ------------------------------------------------------------------ Christmas, and clothes for the seasons

/** Knitted and furry things are not perfectly round: each point of `geo` (about its own middle) a little in or out. */
function lumpy(geo, amount, seed = 1) {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    const z = p.getZ(i);
    const k = 1 + amount * Math.sin(x * 91.7 + seed) * Math.sin(y * 73.3 + seed * 2.1) * Math.sin(z * 67.1 + seed * 3.7);
    p.setXYZ(i, x * k, y * k, z * k);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Stripes going round a piece (`n` of each colour from bottom to top, by height `y` from `y0` over `h`). */
const stripes = (a, b, n, y0, h) => (p) => _c.set(Math.floor(((p.y - y0) / h) * n * 2) % 2 ? b : a);

/**
 * A Santa hat: a soft red cone over a thick band of white fur, its point flopping over — `flop` = which way, [x, z] in
 * the hat's own measure, and `droop` how far down it hangs — with a white bobble on the end. The middle of the band is
 * at the origin, `R` round; the cone is `tall` high before its point gives. (Lorelei's at Christmas — and the foxes'.)
 */
export function makeSantaHat(R, tall, { flop = [0, -1], droop = 0.3 } = {}) {
  const f = Math.hypot(flop[0], flop[1]) || 1;
  const fx = flop[0] / f;
  const fz = flop[1] / f;
  const b = new Batch();
  const rows = 16;
  const prof = [];
  for (let i = 0; i <= rows; i++) {
    const t = i / rows;
    prof.push(new THREE.Vector2(R * 0.9 * Math.pow(1 - t, 0.85) + 0.004 * R, tall * t));
  }
  const cone = new THREE.LatheGeometry(prof, 26);
  const p = cone.attributes.position;
  const bend = (t) => Math.pow(Math.max(0, t - 0.3) / 0.7, 1.6); // (the lower part stands; above, it gives more and more)
  for (let i = 0; i < p.count; i++) {
    const k = bend(p.getY(i) / tall);
    p.setXYZ(i, p.getX(i) + fx * 0.62 * tall * k, p.getY(i) - droop * tall * k * k, p.getZ(i) + fz * 0.62 * tall * k);
  }
  cone.computeVertexNormals();
  b.add(cone, { color: ['#c41a30', '#e8384c'] });
  b.add(lumpy(new THREE.TorusGeometry(R, R * 0.22, 10, 32), 0.05), { rot: [Math.PI / 2, 0, 0], color: '#fbf6f2' }); // the band of fur
  b.add(lumpy(new THREE.IcosahedronGeometry(R * 0.34, 2), 0.08, 3), { at: [fx * 0.62 * tall, tall * (1 - droop), fz * 0.62 * tall], color: '#ffffff' }); // …and the bobble
  const g = new THREE.Group();
  g.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, side: THREE.DoubleSide })));
  return g;
}

/** A knitted bobble hat for the winter: a ribbed cuff `R` round, a striped dome over it, a bobble on top. Its foot at the origin. */
function makeBeanie(R, tall) {
  const b = new Batch();
  const cuff = 0.3 * tall;
  b.add(new THREE.CylinderGeometry(R * 1.04, R * 1.07, cuff, 28, 1, true), { at: [0, cuff / 2, 0], byFace: true, color: (q) => _c.set(Math.floor(((Math.atan2(q.z, q.x) / TAU + 0.5) * 28)) % 2 ? '#fff3f6' : '#ffe1ea') }); // (its ribs)
  const dome = new THREE.SphereGeometry(R, 28, 12, 0, TAU, 0, Math.PI / 2);
  b.add(dome, { at: [0, cuff, 0], scale: [1, (tall - cuff) / R, 1], byFace: true, color: stripes('#ff8fb5', '#fff3f6', 2, cuff, tall - cuff) });
  b.add(lumpy(new THREE.IcosahedronGeometry(R * 0.42, 2), 0.1, 5), { at: [0, tall + R * 0.26, 0], color: '#fff6f8' });
  const g = new THREE.Group();
  g.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, side: THREE.DoubleSide })));
  return g;
}

/** A straw hat for the summer: a wide brim `Rb` round, its edge turned down a little; a crown `Rc` round and `Hc` high with a pink ribbon and a bow. Its foot at the origin. */
export function makeStrawHat(Rb, Rc, Hc, ribbon = '#ff7fae') {
  const b = new Batch();
  const th = 0.035 * Rb;
  const droop = 0.06 * Rb;
  const weave = (q) => {
    const r = Math.hypot(q.x, q.z);
    const ring = Math.floor(r / (Rb * 0.08)) + Math.floor(q.y / (Hc * 0.2));
    const spoke = Math.floor(((Math.atan2(q.z, q.x) / TAU + 0.5) * 40));
    return _c.set((ring + spoke) % 2 ? '#ecc985' : '#f4d898');
  };
  const brim = [[Rc * 0.97, th], [Rb * 0.6, th * 0.7], [Rb * 0.94, th * 0.3 - droop * 0.6], [Rb, -droop], [Rb * 0.94, -droop * 0.6 - th * 0.5], [Rb * 0.6, -th * 0.3], [Rc * 0.97, 0]];
  b.add(new THREE.LatheGeometry(brim.map(([x, y]) => new THREE.Vector2(x, y)), 48), { byFace: true, color: weave });
  const crown = [[Rc, 0], [Rc * 0.97, Hc * 0.7], [Rc * 0.86, Hc * 0.95], [Rc * 0.5, Hc * 1.05], [0.001, Hc * 1.07]];
  b.add(new THREE.LatheGeometry(crown.map(([x, y]) => new THREE.Vector2(x, y)), 40), { byFace: true, color: weave });
  b.add(new THREE.CylinderGeometry(Rc * 1.015, Rc * 1.025, Hc * 0.32, 32, 1, true), { at: [0, Hc * 0.17, 0], color: ribbon }); // the ribbon, round the crown
  for (const s of [1, -1]) b.add(new THREE.SphereGeometry(1, 12, 8), { at: [Rc * 1.02, Hc * 0.2, 0.18 * Rc * s], rot: [0.5 * s, 0, 0], scale: [Rc * 0.08, Rc * 0.16, Rc * 0.26], color: ribbon }); // …and its bow, at the side
  b.add(new THREE.SphereGeometry(1, 10, 8), { at: [Rc * 1.04, Hc * 0.2, 0], scale: [Rc * 0.07, Rc * 0.1, Rc * 0.09], color: '#ff5f98' });
  const g = new THREE.Group();
  g.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));
  return g;
}

/** A beret for the autumn: a soft wine-red disc `R` across and `H` high, puffed out over a band, a little stalk on top. Its foot at the origin. */
export function makeBeret(R, H) {
  const b = new Batch();
  const top = [[R * 0.72, H * 0.16], [R * 0.97, H * 0.4], [R, H * 0.55], [R * 0.9, H * 0.8], [R * 0.55, H * 0.98], [0.001, H * 1.02]];
  // (darker round its edge, where the felt turns under; lighter where it is puffed up in the middle)
  b.add(new THREE.LatheGeometry(top.map(([x, y]) => new THREE.Vector2(x, y)), 40), { color: (q) => _c.set('#7f2633').lerp(_c2.set('#bd5263'), clamp01(1 - Math.hypot(q.x, q.z) / R) * 0.9 + clamp01((q.y - H * 0.4) / H) * 0.25) });
  b.add(new THREE.CylinderGeometry(R * 0.73, R * 0.71, H * 0.2, 36, 1, true), { at: [0, H * 0.08, 0], color: '#7a2532' }); // the band
  b.add(new THREE.CylinderGeometry(R * 0.04, R * 0.06, H * 0.22, 8), { at: [0, H * 1.08, 0], color: '#8a2c39' }); //            …and the stalk
  const g = new THREE.Group();
  g.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })));
  return g;
}

/**
 * A blossom of five petals, `size` across, at `at` facing `normal` — into a batch. (`turn`: how far round its petals
 * are; `color`: theirs, paler towards the middle.)
 */
function blossom(b, at, normal, size, color, turn = 0, middle = '#ffd23f') {
  const q = new THREE.Quaternion().setFromUnitVectors(Z, normal.clone().normalize());
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU + turn;
    const spin = new THREE.Quaternion().setFromAxisAngle(Z, a);
    const off = V(Math.cos(a) * size * 0.3, Math.sin(a) * size * 0.3, 0).applyQuaternion(q);
    b.add(new THREE.SphereGeometry(1, 8, 6), { matrix: new THREE.Matrix4().compose(at.clone().add(off), q.clone().multiply(spin), V(size * 0.3, size * 0.21, size * 0.07)), color: (p) => _c.set('#ffffff').lerp(_c2.set(color), clamp01(p.distanceTo(at) / (size * 0.45))) });
  }
  b.add(new THREE.SphereGeometry(size * 0.12, 8, 6), { at: [at.x + normal.x * size * 0.04, at.y + normal.y * size * 0.04, at.z + normal.z * size * 0.04], color: middle });
}

/** A crown of flowers for the spring: blossoms and leaves round a ring (where a fox wears its crown). */
function wreath(k) {
  const b = new Batch();
  const R = 0.037;
  const N = 9;
  for (let i = 0; i < N * 2; i++) {
    const a = ((i + 0.5) / (N * 2)) * TAU;
    b.add(new THREE.SphereGeometry(1, 8, 6), { at: [Math.cos(a) * R, -0.002, Math.sin(a) * R], rot: [0, -a + Math.PI / 2, 0.25], scale: [0.012, 0.004, 0.006], color: '#5fb36a' });
  }
  const colors = ['#ff9ecb', '#ffffff', '#ffc4dc', '#ffb0a8'];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * TAU;
    const at = V(Math.cos(a) * R, 0.004, Math.sin(a) * R);
    blossom(b, at, V(Math.cos(a) * 0.55, 1, Math.sin(a) * 0.55), 0.024, colors[i % colors.length], i * 0.7);
  }
  const g = new THREE.Group();
  g.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 })));
  g.scale.setScalar(k);
  return g;
}

/**
 * Reindeer antlers for Christmas, one in front of each ear: a beam up and back that branches twice, with a little red
 * bow where they stand on its head. (In the head bone's space, at the fox's size.)
 */
function antlers(rig) {
  const k = rig.headScale;
  const b = new Batch();
  const brown = ['#7a4e30', '#b78456'];
  const beam = (a, c, r0, r1) => {
    const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize());
    b.add(new THREE.CylinderGeometry(r1, r0, a.distanceTo(c), 7), { matrix: new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, V(1, 1, 1)), color: brown });
    b.add(new THREE.SphereGeometry(r1, 7, 5), { at: [c.x, c.y, c.z], color: brown[1] });
  };
  const ear = rig.dims.earBase;
  const x0 = Math.max(0.016, Math.abs(ear.x) * 0.5); // (between its ears, in front of them)
  for (const s of [1, -1]) {
    const p0 = V(x0 * s, -0.006, 0);
    const p1 = V((x0 + 0.008) * s, 0.034, -0.006);
    const p2 = V((x0 + 0.02) * s, 0.064, -0.016);
    const p3 = V((x0 + 0.016) * s, 0.088, -0.03);
    beam(p0, p1, 0.009, 0.0075);
    beam(p1, p2, 0.0075, 0.006);
    beam(p2, p3, 0.006, 0.0042);
    beam(p1, V((x0 + 0.004) * s, 0.058, 0.014), 0.0055, 0.004); // (a tine forward)
    beam(p2, V((x0 + 0.042) * s, 0.084, -0.006), 0.0052, 0.0038); // (…and one out to the side)
  }
  for (const s of [1, -1]) b.add(new THREE.SphereGeometry(1, 10, 8), { at: [0.012 * s, -0.002, 0.006], rot: [0, 0, -0.5 * s], scale: [0.012, 0.007, 0.005], color: '#e8344a' }); // the bow
  b.add(new THREE.SphereGeometry(0.005, 8, 6), { at: [0, -0.002, 0.008], color: '#ffd35a' });
  const g = new THREE.Group();
  g.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })));
  g.scale.setScalar(k * 1.1);
  g.position.set(0, rig.dims.crown.y - 0.006 * k, rig.dims.crown.z + 0.006 * k);
  return g;
}

/**
 * A Christmas tree for the yard: a fir in four tiers like the ones in the woods (scenes.js: tree), hung with baubles,
 * wound round with a string of lights, a star on top, presents at its foot (to +Z, towards you). `s` = its size;
 * `snowy`: snow lying on its tiers. Its lights twinkle and glow as it gets dark — update(time, glow): 0 by day … 1 in
 * the dark.
 */
export function makeTree(s = 0.7, snowy = false) {
  const group = new THREE.Group();
  const rnd = rng(2512);
  const b = new Batch();
  b.add(new THREE.CylinderGeometry(0.05 * s, 0.085 * s, 0.6 * s, 7), { at: [0, 0.3 * s, 0], color: ['#6b4631', '#8f6247'], flat: true });
  const tiers = [];
  for (let i = 0; i < 4; i++) {
    const k = i / 3;
    const y = 0.42 * s + i * 0.25 * s;
    const r = lerp(0.42, 0.15, k) * s;
    b.add(new THREE.ConeGeometry(r, 0.44 * s, 8), { at: [0, y, 0], rot: [0, i * 0.7, 0], color: ['#2c7a47', '#58b06a'], flat: true });
    if (snowy) b.add(new THREE.ConeGeometry(lerp(0.3, 0.1, k) * s, 0.2 * s, 8), { at: [0, y + 0.13 * s, 0], rot: [0, i * 0.7 + 0.4, 0], color: ['#e4eefb', '#ffffff'], flat: true });
    tiers.push({ lo: y - 0.22 * s, top: y + 0.22 * s, r });
  }
  const top = tiers[3].top;
  /** How far out the tree is at the height y (the outermost of the tiers there). */
  const out = (y) => tiers.reduce((m, t) => (y >= t.lo && y <= t.top ? Math.max(m, (t.r * (t.top - y)) / (t.top - t.lo)) : m), 0);
  // its presents, at its foot on the side towards you
  const presents = [
    [0.2, 0.24, 0.11, 0.08, '#e23d50', '#ffd35a', 0.3],
    [-0.23, 0.19, 0.12, 0.1, '#3fa262', '#ff5a6a', -0.4],
    [0.0, 0.36, 0.09, 0.07, '#ff8fbd', '#fffaf1', 0.9],
  ];
  for (const [x, z, w, h, paper, ribbon, yaw] of presents) {
    const at = [x * s, (h * s) / 2, z * s];
    b.add(new THREE.BoxGeometry(w * s, h * s, w * s), { at, rot: [0, yaw, 0], color: paper });
    b.add(new THREE.BoxGeometry(w * s * 1.02, h * s * 1.02, w * s * 0.2), { at, rot: [0, yaw, 0], color: ribbon });
    b.add(new THREE.BoxGeometry(w * s * 0.2, h * s * 1.02, w * s * 1.02), { at, rot: [0, yaw, 0], color: ribbon });
    b.add(new THREE.SphereGeometry(1, 8, 6), { at: [x * s, h * s + 0.012 * s, z * s], rot: [0, yaw, 0], scale: [0.028 * s, 0.014 * s, 0.018 * s], color: ribbon });
  }
  group.add(b.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })));
  // the baubles: shiny, hanging all round it
  const balls = new Batch();
  const shades = ['#e8344a', '#ffcf4a', '#ff8fc0', '#dfe4f0', '#5aa7ff'];
  for (let i = 0; i < 20; i++) {
    const t = tiers[i % 4];
    const y = lerp(t.lo + 0.03 * s, lerp(t.lo, t.top, 0.55), rnd());
    const a = rnd() * TAU;
    const r = out(y) * 0.93 + 0.012 * s;
    balls.add(new THREE.SphereGeometry(0.024 * s, 12, 8), { at: [Math.sin(a) * r, y - 0.012 * s, Math.cos(a) * r], color: shades[i % shades.length] });
  }
  group.add(balls.mesh(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.35 })));
  // the string of lights: wound round it from the bottom to the top, in four colours that twinkle each in its own time
  const LIGHTS = ['#fff1c4', '#ff6070', '#ffcf4a', '#7ab8ff'];
  const bulbs = LIGHTS.map(() => new Batch());
  const spots = LIGHTS.map(() => []); // (…and where each is, for the glow round it)
  const N = 40;
  for (let i = 0; i < N; i++) {
    const t = i / (N - 1);
    const y = lerp(tiers[0].lo + 0.06 * s, top - 0.08 * s, t);
    const a = t * TAU * 4.5;
    const r = out(y) * 0.95 + 0.01 * s;
    bulbs[i % LIGHTS.length].add(new THREE.SphereGeometry(0.019 * s, 8, 6), { at: [Math.sin(a) * r, y, Math.cos(a) * r] });
    spots[i % LIGHTS.length].push(Math.sin(a) * (r + 0.01 * s), y, Math.cos(a) * (r + 0.01 * s));
  }
  const lamps = bulbs.map((bb, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: LIGHTS[i], emissive: LIGHTS[i], emissiveIntensity: 0.6, roughness: 0.4 });
    const mesh = bb.mesh(mat);
    mesh.castShadow = false;
    group.add(mesh);
    // a soft glow round each bulb, as it gets dark
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(spots[i], 3));
    const halo = new THREE.PointsMaterial({ map: softDotTexture(), color: LIGHTS[i], size: 0.22 * s, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
    const glow = new THREE.Points(geo, halo);
    glow.renderOrder = 6;
    group.add(glow);
    return { mat, halo };
  });
  // the star on top
  const shape = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU + Math.PI / 2;
    const r = (i % 2 ? 0.032 : 0.075) * s;
    shape[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r);
  }
  const starGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.018 * s, bevelEnabled: true, bevelThickness: 0.006 * s, bevelSize: 0.005 * s, bevelSegments: 1 });
  starGeo.translate(0, 0, -0.009 * s);
  const starMat = new THREE.MeshStandardMaterial({ color: '#ffd34a', emissive: '#ffbf2a', emissiveIntensity: 0.4, metalness: 0.4, roughness: 0.3 });
  const star = new THREE.Mesh(starGeo, starMat);
  star.position.y = top + 0.04 * s;
  star.castShadow = true;
  group.add(star);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color: '#ffd96a', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  halo.position.copy(star.position);
  halo.scale.setScalar(0.42 * s);
  halo.renderOrder = 6;
  group.add(halo);
  group.traverse((o) => {
    if (o.isMesh) o.receiveShadow = true;
  });
  return {
    object: group,
    radius: 0.42 * s,
    height: top + 0.12 * s,
    star,
    update(time, glow) {
      lamps.forEach(({ mat, halo }, i) => {
        const twinkle = 0.62 + 0.38 * Math.sin(time * (1.7 + 0.37 * i) + i * 1.9);
        mat.emissiveIntensity = (0.45 + 2.6 * glow) * twinkle;
        halo.opacity = glow * twinkle;
      });
      starMat.emissiveIntensity = 0.4 + 1.5 * glow;
      halo.material.opacity = 0.75 * glow * (0.9 + 0.1 * Math.sin(time * 2.6));
      halo.visible = glow > 0.02;
    },
  };
}

// ------------------------------------------------------------------ a hat between a fox's ears

// The foxes' Halloween hats, at the red fox's size: how wide each is at a height `h` above its foot — and how far
// back its middle is there (the witch's hat bends back at its tip) — up to how tall it is.
const HATS = {
  witch: { brim: 0.052, head: 0.028, tall: 0.1, width: (h) => (h < 0.006 ? 0.052 : 0.028 * Math.pow(Math.max(0, 1 - h / 0.1), 1.15)), back: (h) => 0.0414 * Math.pow(Math.max(0, h / 0.1 - 0.35) / 0.65, 2) }, // (makeWitchHat: taller than most, so that it shows from afar)
  pumpkin: { r: 0.046, tall: 0.046 * 1.7, width: (h) => 0.046 * Math.sqrt(Math.max(0, 1 - Math.pow((h - 0.036) / 0.037, 2))) + (h > 0.06 ? 0.007 : 0), back: () => 0 }, // (pumpkin: its body, then the stalk)
  // …Christmas (makeSantaHat: its point flops over backwards, away from you) and the seasons
  santa: { R: 0.03, tall: 0.072, width: (h) => (h < 0.007 ? 0.037 : 0.027 * Math.pow(Math.max(0, 1 - h / 0.072), 0.85)), back: (h) => 0.0446 * Math.pow(Math.max(0, h / 0.072 - 0.3) / 0.7, 1.6) },
  beanie: { R: 0.032, tall: 0.046, width: (h) => (h < 0.014 ? 0.034 : h < 0.046 ? 0.032 * Math.sqrt(Math.max(0, 1 - ((h - 0.014) / 0.032) ** 2)) + 0.002 : 0.014), back: () => 0 },
  straw: { Rb: 0.058, Rc: 0.03, Hc: 0.03, tall: 0.033, width: () => 0.031, back: () => 0 }, // (only its crown has to be clear of the ears: they come up through the brim)
  beret: { R: 0.037, H: 0.027, tall: 0.03, width: (h) => (h < 0.004 ? 0.028 : 0.038), back: () => 0 },
};
// …and how each is made, at that size
const HAT_MAKERS = {
  witch: (h) => makeWitchHat(h.brim, h.head, h.tall),
  pumpkin: (h) => pumpkin(h.r, 'carved'),
  santa: (h) => makeSantaHat(h.R, h.tall, { flop: [0, -1], droop: 0.3 }),
  beanie: (h) => makeBeanie(h.R, h.tall),
  straw: (h) => makeStrawHat(h.Rb, h.Rc, h.Hc),
  beret: (h) => makeBeret(h.R, h.H),
};
const HAT_TILT = 0.2; // (tipped forward a little, the way one wears a hat)
const restHeads = new WeakMap(); // fox → its head and its ears at rest (headAndEars)

/** The points of a fox's coat that go with its head, and with its ears, as they are at rest — in the head bone's space. */
function headAndEars(rig) {
  let out = restHeads.get(rig);
  if (out) return out;
  const geo = rig.shells[0].geometry;
  const P = geo.attributes.position;
  const I = geo.attributes.skinIndex;
  const W = geo.attributes.skinWeight;
  const bones = rig.skeleton.bones;
  const iH = bones.indexOf(rig.bones.head);
  const iE = [bones.indexOf(rig.bones.earL), bones.indexOf(rig.bones.earR)];
  const toHead = rig.skeleton.boneInverses[iH];
  out = { head: [], ears: [] };
  for (let i = 0; i < P.count; i++) {
    let h = 0;
    let e = 0;
    for (let j = 0; j < 4; j++) {
      const b = I.getComponent(i, j);
      if (b === iH) h += W.getComponent(i, j);
      else if (iE.includes(b)) e += W.getComponent(i, j);
    }
    if (e >= 0.5) out.ears.push(V().fromBufferAttribute(P, i).applyMatrix4(toHead));
    else if (h >= 0.5) out.head.push(V().fromBufferAttribute(P, i).applyMatrix4(toHead));
  }
  restHeads.set(rig, out);
  return out;
}

/**
 * Where a hat (HATS) can sit on this fox's head without its ears coming through it — fur and all: on top of the head,
 * as large as it is meant to be if there is room between the ears; else a little further forward, in front of them; else
 * a little smaller. → { at, scale }: its foot in the head bone's space, and its size (the head's, or less).
 */
function seatHat(rig, hat) {
  const k = rig.headScale;
  const { head, ears } = headAndEars(rig);
  const fur = 0.03 * rig.species.fur;
  const crown = rig.dims.crown;
  const turn = new THREE.Quaternion().setFromAxisAngle(V(1, 0, 0), -HAT_TILT);
  const l = V();
  let at = null;
  for (let s = 1; s > 0.5; s -= 0.05) {
    const K = k * s;
    const gap = (fur * 0.6 + 0.004) / K; // (between the hat and the ears' bare skin: their fur, and a little)
    for (let dz = 0; dz <= 0.05 * k; dz += 0.005 * k) {
      // the top of the head there, under the middle of the hat — in its fur a little
      const z = crown.z + dz;
      let y = -Infinity;
      for (const p of head) if (Math.abs(p.x) < 0.01 * k && Math.abs(p.z - z) < 0.01 * k) y = Math.max(y, p.y);
      if (y === -Infinity) continue;
      at = V(0, y + fur * 0.3, z);
      const clear = ears.every((p) => {
        l.copy(p).sub(at).applyQuaternion(turn).divideScalar(K);
        return l.y < -0.012 || l.y > hat.tall || Math.hypot(l.x, l.z + hat.back(l.y)) > hat.width(l.y) + gap;
      });
      if (clear) return { at, scale: K };
    }
  }
  return { at: at || crown.clone(), scale: k * 0.5 };
}

/** A hat for a fox (HATS), set between its ears. (A beret is worn tipped to one side.) */
function foxHat(id, rig) {
  const hat = HATS[id];
  const g = HAT_MAKERS[id](hat);
  const { at, scale } = seatHat(rig, hat);
  g.position.copy(at);
  g.rotation.x = HAT_TILT;
  if (id === 'beret') g.rotation.z = -0.3;
  g.scale.setScalar(scale);
  return g;
}

/** Where each accessory sits: [bone, position in that bone's space, direction its +Z should face (or null)]. */
export function makeAccessory(id, rig) {
  const k = rig.headScale;
  const top = rig.dims.crown.y; // the top of the head: what sits on it sits lower on a flat-headed fox
  let object;
  let bone = 'head';
  if (id === 'bow') {
    object = bow(k);
    object.position.set(0.05 * k, top + 0.001 * k, 0.03 * k);
    object.quaternion.setFromUnitVectors(Z, V(0.35, 0.7, 0.62).normalize());
    object.rotateZ(-0.25);
  } else if (id === 'flower') {
    object = flower(k);
    object.position.set(-0.052 * k, top - 0.003 * k, 0.03 * k);
    object.quaternion.setFromUnitVectors(Z, V(-0.42, 0.68, 0.6).normalize());
  } else if (id === 'crown') {
    object = crown(k * 1.3);
    object.position.set(0, top + 0.021 * k, 0.03 * k);
    object.rotation.x = 0.22;
  } else if (id === 'glasses') {
    object = glasses(rig);
  } else if (id === 'headphones') {
    object = headphones(k);
    object.scale.x *= rig.species.skull; // …and the band reaches around a wide one
    object.position.set(0, top - 0.073 * k, -0.034 * k);
    object.rotation.x = -0.18;
  } else if (id === 'scarf') {
    bone = 'neck';
    object = scarf(rig);
  } else if (HATS[id]) {
    object = foxHat(id, rig);
  } else if (id === 'wreath') {
    object = wreath(k * 1.25); // (where its crown would be)
    object.position.set(0, top + 0.006 * k, 0.03 * k);
    object.rotation.x = 0.22;
  } else if (id === 'antlers') {
    object = antlers(rig);
  } else return null;
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { object, bone };
}
