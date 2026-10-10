// The fox's own things — food bowl, ball, bed, microphone, the radio her covers play on — and
// the accessories it wears. Ids match the shop in js/pet.js. (What she buys for the yard is in
// decor.js.)
import * as THREE from '../vendor/three.module.min.js';
import { Batch, V, TAU } from './kit.js';

const Z = new THREE.Vector3(0, 0, 1);
const _c = new THREE.Color();
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
 * hers to carry, so it is made in the world's own measure. `lid` comes off when it opens.
 */
export function makePresent() {
  const group = new THREE.Group();
  const W = 0.2;
  const H = 0.15;
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 });
  const box = new Batch();
  box.add(new THREE.BoxGeometry(W, H, W), { at: [0, H / 2, 0], color: ['#ff8fbd', '#ffb9d6'] });
  box.add(new THREE.BoxGeometry(W + 0.006, H + 0.002, W * 0.2), { at: [0, H / 2, 0], color: '#fffaf1' }); // the ribbon, round it both ways
  box.add(new THREE.BoxGeometry(W * 0.2, H + 0.002, W + 0.006), { at: [0, H / 2, 0], color: '#fffaf1' });
  const body = box.mesh(mat);
  const top = new Batch();
  top.add(new THREE.BoxGeometry(W + 0.024, 0.04, W + 0.024), { at: [0, 0.02, 0], color: ['#ff6fa8', '#ff8fbd'] });
  top.add(new THREE.BoxGeometry(W + 0.03, 0.042, W * 0.2), { at: [0, 0.02, 0], color: '#fffaf1' });
  top.add(new THREE.BoxGeometry(W * 0.2, 0.042, W + 0.03), { at: [0, 0.02, 0], color: '#fffaf1' });
  for (const s of [1, -1]) top.add(new THREE.SphereGeometry(1, 12, 8), { at: [0.045 * s, 0.064, 0], rot: [0, 0, 0.5 * s], scale: [0.05, 0.028, 0.03], color: '#fffaf1' }); // …and the bow
  top.add(new THREE.SphereGeometry(1, 10, 8), { at: [0, 0.058, 0], scale: [0.02, 0.02, 0.022], color: '#ffe3ee' });
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
  } else return null;
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { object, bone };
}
