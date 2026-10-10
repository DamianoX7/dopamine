// The things she can put in the yard: a house, a swing, a pond, a trampoline… Each one is
// built here and says how much ground it takes (circles: for finding it a place and for
// stepping round it) and what a fox can do with it — yardlife.js has the fox's side of that.
// Ids match the shop in js/pet.js.
//
// A thing's own space: it stands on the ground at the origin, its front towards +Z.
import * as THREE from '../vendor/three.module.min.js';
import { Batch, V, TAU, rng, softDotTexture } from './kit.js';

const _c = new THREE.Color();
const _c2 = new THREE.Color();
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const mix = (a, b, t) => _c.set(a).lerp(_c2.set(b), Math.min(1, Math.max(0, t)));

const WOOD = ['#b98556', '#e6bc8c'];
const CREAM = ['#f3e2cd', '#fffaf1'];
const PINK = ['#ff7fa8', '#ffb6cf'];
const STONE = ['#858a94', '#c8ccd3'];

const box = (b, w, h, d, at, color, rot = [0, 0, 0]) => b.add(new THREE.BoxGeometry(w, h, d), { at, rot, color });

/** A round pole from one point to another. */
function pole(b, from, to, r, color, seg = 7, flat = false) {
  const a = V(...from);
  const c = V(...to);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize());
  const m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, V(1, 1, 1));
  b.add(new THREE.CylinderGeometry(r, r, a.distanceTo(c), seg), { matrix: m, color, flat });
}

function heart(size) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5 * size);
  s.bezierCurveTo(0.62 * size, 0.02 * size, 0.46 * size, 0.64 * size, 0, 0.27 * size);
  s.bezierCurveTo(-0.46 * size, 0.64 * size, -0.62 * size, 0.02 * size, 0, -0.5 * size);
  return s;
}

/** A soft light that needs no lamp in the shader: a glowing dot that is added to the picture. */
function glow(color, size) {
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
  sprite.scale.setScalar(size);
  sprite.renderOrder = 6;
  return sprite;
}

// ------------------------------------------------------------------ 여우 집

function house() {
  const group = new THREE.Group();
  const b = new Batch();
  const W = 0.7; //    outside, left to right
  const D = 0.82; //   front to back
  const H = 0.46; //   height of the walls
  const RISE = 0.3; // …and of the roof above them
  const T = 0.035;
  const DW = 0.36; //  the doorway
  const DH = 0.4;
  const wall = ['#ffd6ba', '#fff1e1'];
  // front and back: one board each, up into the gable — the front with the doorway cut out of it
  const face = (door) => {
    const s = new THREE.Shape();
    s.moveTo(-W / 2, 0);
    if (door) {
      s.lineTo(-DW / 2, 0);
      s.lineTo(-DW / 2, DH - DW / 2);
      s.absarc(0, DH - DW / 2, DW / 2, Math.PI, 0, true);
      s.lineTo(DW / 2, 0);
    }
    s.lineTo(W / 2, 0);
    s.lineTo(W / 2, H);
    s.lineTo(0, H + RISE);
    s.lineTo(-W / 2, H);
    return new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 10 });
  };
  b.add(face(true), { at: [0, 0, D / 2 - T], color: wall });
  b.add(face(false), { at: [0, 0, -D / 2], color: wall });
  for (const sx of [1, -1]) box(b, T, H, D - 2 * T, [(sx * (W - T)) / 2, H / 2, 0], wall);
  // the roof: two slabs of shingles, with eaves all round
  const slope = Math.atan2(RISE, W / 2);
  const len = Math.hypot(W / 2, RISE) + 0.1;
  const deep = D + 0.16;
  for (const sx of [1, -1]) {
    b.add(new THREE.BoxGeometry(len, 0.036, deep, 6, 1, 1), {
      at: [(sx * Math.cos(slope) * len) / 2, H + RISE + 0.02 - (Math.sin(slope) * len) / 2, 0],
      rot: [0, 0, -sx * slope],
      byFace: true,
      color: (p) => _c.set(Math.floor((H + RISE + 0.04 - p.y) / 0.062) % 2 ? '#ff7fa8' : '#f0608f'),
    });
  }
  box(b, 0.075, 0.03, deep + 0.012, [0, H + RISE + 0.024, 0], '#fff4f8');
  // a white frame round the doorway, a heart over it, a step in front of it
  b.add(new THREE.TorusGeometry(DW / 2 + 0.014, 0.016, 6, 14, Math.PI), { at: [0, DH - DW / 2, D / 2 + 0.004], color: '#ffffff' });
  for (const sx of [1, -1]) box(b, 0.03, DH - DW / 2, 0.03, [sx * (DW / 2 + 0.014), (DH - DW / 2) / 2, D / 2 + 0.004], '#ffffff');
  b.add(new THREE.ExtrudeGeometry(heart(0.11), { depth: 0.014, bevelEnabled: false, curveSegments: 8 }), { at: [0, H + 0.11, D / 2], color: '#ff4f8b' });
  box(b, 0.46, 0.022, 0.15, [0, 0.011, D / 2 + 0.085], WOOD);
  // a flowerpot by the door
  b.add(new THREE.CylinderGeometry(0.045, 0.034, 0.07, 8), { at: [0.3, 0.035, D / 2 + 0.07], color: ['#c9703f', '#e99a63'] });
  b.add(new THREE.IcosahedronGeometry(0.05, 1), { at: [0.3, 0.1, D / 2 + 0.07], scale: [1, 0.8, 1], color: ['#4f9a4a', '#8fd67a'], flat: true });
  for (const [dx, dy, dz, col] of [[0.02, 0.135, 0.02, '#ffffff'], [-0.025, 0.125, -0.01, '#ff9ecb'], [0.005, 0.13, -0.03, '#ffd23f']]) {
    b.add(new THREE.IcosahedronGeometry(0.016, 0), { at: [0.3 + dx, dy, D / 2 + 0.07 + dz], color: col, flat: true });
  }
  box(b, W - 2 * T, 0.008, D - 2 * T, [0, 0.004, 0], '#5a4048');
  group.add(b.mesh());
  // it is dark inside
  const liner = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * T - 0.004, H - 0.012, D - 2 * T - 0.004), new THREE.MeshBasicMaterial({ color: '#3a2531', side: THREE.BackSide }));
  liner.position.y = H / 2 + 0.004;
  group.add(liner);
  return { object: group };
}

// ------------------------------------------------------------------ 그네

function swing() {
  const group = new THREE.Group();
  const b = new Batch();
  const H = 1.2; //      height of the beam
  const X = 0.5; //      half its length
  const SPLAY = 0.36; // how far the legs stand apart, front to back
  const SEAT = 0.25; //  top of the seat above the ground
  const L = H - SEAT;
  for (const sx of [1, -1]) {
    for (const sz of [1, -1]) {
      pole(b, [sx * X, H + 0.02, 0], [sx * (X + 0.05), 0, sz * SPLAY], 0.027, CREAM);
      b.add(new THREE.SphereGeometry(0.037, 8, 6), { at: [sx * (X + 0.05), 0.02, sz * SPLAY], color: '#ff8fb5' });
    }
    pole(b, [sx * (X + 0.03), 0.44, -SPLAY * 0.62], [sx * (X + 0.03), 0.44, SPLAY * 0.62], 0.018, CREAM);
    b.add(new THREE.SphereGeometry(0.042, 8, 6), { at: [sx * (X + 0.07), H, 0], color: '#ff8fb5' });
  }
  pole(b, [-X - 0.07, H, 0], [X + 0.07, H, 0], 0.032, CREAM, 8);
  group.add(b.mesh());
  // what hangs from the beam turns about it: a broad seat on four ropes
  const hang = new THREE.Group();
  hang.position.y = H;
  const s = new Batch();
  box(s, 0.36, 0.03, 0.6, [0, -L - 0.015, 0], PINK);
  for (const sx of [1, -1]) {
    box(s, 0.022, 0.034, 0.6, [sx * 0.18, -L + 0.004, 0], '#fff4f8');
    for (const sz of [1, -1]) pole(s, [sx * 0.2, 0, 0], [sx * 0.18, -L, sz * 0.23], 0.009, '#d8c29a', 5);
  }
  hang.add(s.mesh());
  group.add(hang);
  return {
    object: group,
    phi: 0, //    how far it has swung (radians, towards its front)
    amp: 0.03,
    phase: Math.random() * TAU,
    push: 0, //   how high the fox on it wants to go
    /** Where the top of the seat is now (world) — a fox sits there. */
    seat(out = V()) {
      this.at(0, L * Math.sin(this.phi), out);
      out.y = H - L * Math.cos(this.phi);
      return out;
    },
    update(dt) {
      // a fox swings it high; left alone it barely stirs in the wind
      this.amp = damp(this.amp, this.users.length ? this.push : 0.03, this.users.length ? 1.1 : 0.45, dt);
      this.phase += (dt * TAU) / 1.95;
      this.phi = this.amp * Math.sin(this.phase);
      hang.rotation.x = -this.phi;
    },
  };
}

// ------------------------------------------------------------------ 연못

function pond() {
  const group = new THREE.Group();
  const r = rng(4711);
  const RX = 0.5;
  const RZ = 0.38;
  const b = new Batch();
  // the bed, deeper towards the middle
  b.add(new THREE.CircleGeometry(1, 40), { at: [0, 0.008, 0], rot: [-Math.PI / 2, 0, 0], scale: [RX, RZ, 1], color: (p) => mix('#1c6d8c', '#63c3da', Math.pow(Math.hypot(p.x / RX, p.z / RZ), 2)) });
  // stones along the bank
  const N = 19;
  for (let i = 0; i < N; i++) {
    const u = (i / N) * TAU + r.range(-0.07, 0.07);
    const s = r.range(0.042, 0.072);
    b.add(new THREE.IcosahedronGeometry(s, 1), {
      at: [Math.cos(u) * (RX + 0.012), s * 0.34, Math.sin(u) * (RZ + 0.012)],
      rot: [r() * 3, r() * 3, r() * 3],
      scale: [r.range(0.95, 1.3), r.range(0.5, 0.72), r.range(0.9, 1.2)],
      color: i % 5 === 2 ? ['#9a8f86', '#d3c9bd'] : STONE,
      flat: true,
    });
  }
  // lily pads, one in flower
  const pads = [[-0.2, 0.1, 0.085, 0.4], [0.24, -0.12, 0.07, 2.2], [0.08, 0.2, 0.055, 4.1]];
  for (const [x, z, s, yaw] of pads) {
    b.add(new THREE.CircleGeometry(s, 14, 0.25, TAU - 0.5), { at: [x, 0.034, z], rot: [-Math.PI / 2, 0, yaw], color: (p) => mix('#4fae62', '#86d68c', Math.hypot(p.x - x, p.z - z) / s) });
  }
  const [lx, lz] = pads[0];
  for (let i = 0; i < 8; i++) {
    const u = (i / 8) * TAU;
    b.add(new THREE.SphereGeometry(1, 8, 6), { at: [lx + Math.cos(u) * 0.022, 0.05, lz + Math.sin(u) * 0.022], rot: [0, -u, 0.75, 'YXZ'], scale: [0.03, 0.006, 0.013], color: i % 2 ? '#ffb3d1' : '#ff8fbd' });
  }
  b.add(new THREE.SphereGeometry(0.011, 8, 6), { at: [lx, 0.052, lz], color: '#ffd23f' });
  // reeds at the back
  for (const [x, z, h] of [[-0.3, -0.33, 0.3], [-0.24, -0.37, 0.38], [-0.36, -0.29, 0.24]]) {
    pole(b, [x, 0, z], [x + 0.01, h, z], 0.006, '#5f9a4c', 5);
    b.add(new THREE.CylinderGeometry(0.014, 0.014, 0.07, 6), { at: [x + 0.01, h + 0.02, z], color: '#7a5238' });
  }
  group.add(b.mesh());
  // two koi going round under the water
  const fishes = [['#ff7a2f', '#ffffff'], ['#ffffff', '#ff5a3c']].map(([body, patch], i) => {
    const f = new Batch();
    f.add(new THREE.SphereGeometry(1, 10, 6), { scale: [0.019, 0.009, 0.05], color: (p) => _c.set((i ? p.z > 0.012 || (p.z < -0.012 && p.z > -0.03) : p.z > 0.022) ? patch : body) });
    f.add(new THREE.ConeGeometry(0.02, 0.034, 4), { at: [0, 0, -0.058], rot: [Math.PI / 2, 0, 0], scale: [1, 1, 0.35], color: i ? patch : body });
    const mesh = new THREE.Mesh(f.geometry(), new THREE.MeshBasicMaterial({ vertexColors: true }));
    mesh.position.y = 0.018;
    group.add(mesh);
    return { mesh, seed: i * 2.6 + 0.4, dir: i ? -1 : 1 };
  });
  const water = new THREE.Mesh(new THREE.CircleGeometry(1, 40), new THREE.MeshStandardMaterial({ color: '#9fe3ff', roughness: 0.05, metalness: 0.35, transparent: true, opacity: 0.5, depthWrite: false }));
  water.rotation.x = -Math.PI / 2;
  water.scale.set(RX * 0.99, RZ * 0.99, 1);
  water.position.y = 0.03;
  water.renderOrder = 1;
  group.add(water);
  // rings on the water where a nose or a paw touches it
  const ringGeo = new THREE.RingGeometry(0.72, 1, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const rings = Array.from({ length: 7 }, () => {
    const mesh = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, depthWrite: false }));
    mesh.position.y = 0.036;
    mesh.renderOrder = 3;
    mesh.visible = false;
    group.add(mesh);
    return { mesh, t: 9, size: 1 };
  });
  let next = 0;
  let idle = 1.5;
  const ripple = (x, z, size = 1) => {
    // kept on the water
    const k = Math.hypot(x / (RX * 0.86), z / (RZ * 0.86));
    if (k > 1) {
      x /= k;
      z /= k;
    }
    const ring = rings[next++ % rings.length];
    ring.t = 0;
    ring.size = size;
    ring.mesh.position.x = x;
    ring.mesh.position.z = z;
    ring.mesh.visible = true;
  };
  return {
    object: group,
    water: 0.03,
    /** How far it is from the middle to the bank, towards a point of the world. */
    rim(wx, wz) {
      const p = this.object.position;
      const c = Math.cos(this.yaw);
      const s = Math.sin(this.yaw);
      const dx = wx - p.x;
      const dz = wz - p.z;
      const u = Math.atan2(dx * s + dz * c, dx * c - dz * s);
      return 1 / Math.hypot(Math.cos(u) / RX, Math.sin(u) / RZ);
    },
    /** A ring on the water at a point of the world (a nose, a paw). */
    ripple(at, size = 1) {
      const p = this.object.position;
      const c = Math.cos(this.yaw);
      const s = Math.sin(this.yaw);
      ripple((at.x - p.x) * c - (at.z - p.z) * s, (at.x - p.x) * s + (at.z - p.z) * c, size);
    },
    /** Where one of the koi is (world). */
    fish(out = V()) {
      const m = fishes[0].mesh.position;
      return this.at(m.x, m.z, out);
    },
    update(dt, t) {
      fishes.forEach((f) => {
        const a = t * 0.42 * f.dir + f.seed;
        const x = Math.cos(a) * RX * (0.5 + 0.12 * Math.sin(t * 0.31 + f.seed));
        const z = Math.sin(a) * RZ * (0.48 + 0.14 * Math.cos(t * 0.23 + f.seed * 2));
        f.mesh.rotation.y = Math.atan2(x - f.mesh.position.x, z - f.mesh.position.z) + Math.sin(t * 7 + f.seed) * 0.22;
        f.mesh.position.x = x;
        f.mesh.position.z = z;
      });
      // now and then a fish comes up
      idle -= dt;
      if (idle < 0) {
        idle = 1.6 + Math.random() * 3.4;
        const m = fishes[Math.random() < 0.5 ? 0 : 1].mesh.position;
        ripple(m.x, m.z, 0.6);
      }
      rings.forEach((ring) => {
        if (ring.t >= 1) return void (ring.mesh.visible = false);
        ring.t += dt / 1.3;
        const k = Math.min(1, ring.t);
        ring.mesh.scale.setScalar((0.025 + 0.15 * k) * ring.size);
        ring.mesh.material.opacity = (1 - k) * 0.75;
      });
    },
  };
}

// ------------------------------------------------------------------ 트램펄린

function trampoline() {
  const group = new THREE.Group();
  const b = new Batch();
  const R = 0.52;
  const TOP = 0.2;
  for (let i = 0; i < 6; i++) {
    const u = (i / 6) * TAU + 0.3;
    pole(b, [Math.cos(u) * (R - 0.03), TOP, Math.sin(u) * (R - 0.03)], [Math.cos(u) * (R + 0.01), 0, Math.sin(u) * (R + 0.01)], 0.015, ['#b7bfd3', '#e6eaf4'], 6);
  }
  b.add(new THREE.TorusGeometry(R - 0.045, 0.05, 8, 32), {
    at: [0, TOP, 0],
    rot: [Math.PI / 2, 0, 0],
    scale: [1, 1, 0.5],
    color: (p) => _c.set(Math.floor(((Math.atan2(p.z, p.x) / TAU + 0.5) * 8) % 8) % 2 ? '#ff8fb5' : '#8fc9ff'),
  });
  group.add(b.mesh());
  const mat = new THREE.Mesh(new THREE.CircleGeometry(R - 0.07, 30), new THREE.MeshLambertMaterial({ color: '#4a4163' }));
  mat.rotation.x = -Math.PI / 2;
  mat.position.y = TOP - 0.004;
  mat.receiveShadow = true;
  group.add(mat);
  let dip = 0;
  let want = 0;
  return {
    object: group,
    top: TOP,
    /** The mat gives under a fox that comes down on it (0 … 1). */
    press(k) {
      want = k;
    },
    update(dt) {
      dip = damp(dip, want, 22, dt);
      want = 0;
      mat.position.y = TOP - 0.004 - 0.06 * dip;
    },
  };
}

// ------------------------------------------------------------------ 모닥불

function campfire() {
  const group = new THREE.Group();
  const r = rng(977);
  const b = new Batch();
  b.add(new THREE.CircleGeometry(0.17, 14), { at: [0, 0.006, 0], rot: [-Math.PI / 2, 0, 0], color: '#3b3136' });
  for (let i = 0; i < 9; i++) {
    const u = (i / 9) * TAU;
    const s = r.range(0.04, 0.056);
    b.add(new THREE.IcosahedronGeometry(s, 1), { at: [Math.cos(u) * 0.185, s * 0.45, Math.sin(u) * 0.185], rot: [r() * 3, r() * 3, r() * 3], scale: [1.15, 0.7, 1], color: STONE, flat: true });
  }
  const bark = ['#5c3d2a', '#8a5f42'];
  for (let i = 0; i < 5; i++) {
    const u = (i / 5) * TAU + 0.4;
    pole(b, [Math.cos(u) * 0.13, 0.015, Math.sin(u) * 0.13], [-Math.cos(u) * 0.03, 0.2, -Math.sin(u) * 0.03], 0.024, bark, 6, true);
  }
  group.add(b.mesh());
  const flames = [[0.088, 0.3, '#ff6a1c'], [0.062, 0.23, '#ffad2e'], [0.036, 0.15, '#fff0a0']].map(([rad, h, color], i) => {
    const mesh = new THREE.Mesh(new THREE.ConeGeometry(rad, h, 6), new THREE.MeshBasicMaterial({ color }));
    mesh.position.y = 0.045 + h / 2;
    mesh.userData.h = h;
    group.add(mesh);
    return mesh;
  });
  const light = new THREE.PointLight('#ffae66', 0, 2.8, 1.5);
  light.position.y = 0.34;
  const halo = glow('#ff9a4a', 0.95);
  halo.position.y = 0.2;
  group.add(light, halo);
  let spark = 1;
  return {
    object: group,
    update(dt, t, world) {
      // (rain beats the fire down — it hisses and steams, but never quite goes out)
      const rain = world.sky ? world.sky.rain : 0;
      const burn = 1 - 0.7 * rain;
      flames.forEach((m, i) => {
        const k = (1 + 0.2 * Math.sin(t * 11 + i * 2.1) + 0.1 * Math.sin(t * 23 + i)) * burn;
        const wide = 0.55 + 0.45 * burn;
        m.scale.set((1 - 0.1 * Math.sin(t * 9 + i)) * wide, k, (1 - 0.1 * Math.cos(t * 8 + i * 2)) * wide);
        m.position.y = 0.045 + (m.userData.h * k) / 2;
        m.rotation.y += dt * (1.4 + i);
        m.rotation.z = 0.07 * Math.sin(t * 5.3 + i * 1.7);
      });
      const flicker = (1 + 0.12 * Math.sin(t * 9.1) + 0.07 * Math.sin(t * 23.7)) * burn;
      light.intensity = (world.night ? 3 : 0.9) * flicker;
      halo.material.opacity = (world.night ? 0.5 : 0.2) * flicker;
      spark -= dt;
      if (spark < 0 && world.fx) {
        spark = 0.5 + Math.random() * 1.4;
        const p = this.object.position;
        if (rain > 0.3) world.fx.emit('💨', V(p.x, 0.3, p.z), { spread: 0.06, rise: 0.4, life: 1.1, size: 0.09, drift: 0.25 });
        else world.fx.emit('✨', V(p.x, 0.32, p.z), { spread: 0.05, rise: 0.5, life: 0.9, size: 0.045, drift: 0.2 });
      }
    },
  };
}

// ------------------------------------------------------------------ 벤치

function bench() {
  const group = new THREE.Group();
  const b = new Batch();
  const W = 0.98;
  const TOP = 0.2;
  for (const z of [-0.105, 0.005, 0.115]) box(b, W, 0.024, 0.1, [0, TOP - 0.012, z], WOOD);
  for (const sx of [1, -1]) {
    const x = sx * (W / 2 - 0.07);
    box(b, 0.045, TOP - 0.02, 0.045, [x, (TOP - 0.02) / 2, 0.125], CREAM);
    box(b, 0.045, 0.5, 0.045, [x, 0.25, -0.15], CREAM, [-0.1, 0, 0]);
    box(b, 0.04, 0.035, 0.26, [x, TOP - 0.045, -0.01], CREAM);
  }
  for (const y of [0.31, 0.42]) box(b, W, 0.075, 0.022, [0, y, -0.17 - (y - 0.2) * 0.1], WOOD, [-0.1, 0, 0]);
  // a cushion along it
  b.add(new THREE.BoxGeometry(0.86, 0.03, 0.27, 6, 1, 1), { at: [0, TOP + 0.015, 0.005], byFace: true, color: (p) => _c.set(Math.floor((p.x + 0.43) / 0.1433) % 2 ? '#ffb6cf' : '#fff4f8') });
  group.add(b.mesh());
  return { object: group, top: TOP + 0.03 };
}

// ------------------------------------------------------------------ 가로등

function lamp() {
  const group = new THREE.Group();
  const b = new Batch();
  const iron = ['#3f3a55', '#6a6488'];
  b.add(new THREE.CylinderGeometry(0.05, 0.068, 0.05, 8), { at: [0, 0.025, 0], color: iron });
  b.add(new THREE.CylinderGeometry(0.017, 0.024, 0.8, 8), { at: [0, 0.45, 0], color: iron });
  b.add(new THREE.SphereGeometry(0.03, 8, 6), { at: [0, 0.855, 0], color: iron[1] });
  b.add(new THREE.CylinderGeometry(0.052, 0.04, 0.016, 6), { at: [0, 0.878, 0], color: iron });
  b.add(new THREE.ConeGeometry(0.092, 0.075, 6), { at: [0, 1.057, 0], color: iron, flat: true });
  b.add(new THREE.SphereGeometry(0.014, 6, 5), { at: [0, 1.1, 0], color: iron[1] });
  for (let i = 0; i < 6; i++) {
    const u = (i / 6) * TAU + TAU / 12;
    pole(b, [Math.cos(u) * 0.046, 0.884, Math.sin(u) * 0.046], [Math.cos(u) * 0.066, 1.022, Math.sin(u) * 0.066], 0.005, iron[0], 4);
  }
  group.add(b.mesh());
  const glass = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.043, 0.136, 6), new THREE.MeshBasicMaterial({ color: '#fff6dc' }));
  glass.position.y = 0.953;
  const light = new THREE.PointLight('#ffd08a', 0, 3, 1.5);
  light.position.y = 0.94;
  const halo = glow('#ffd27a', 0.8);
  halo.position.y = 0.95;
  group.add(glass, light, halo);
  let on = -1;
  return {
    object: group,
    update(dt, t, world) {
      const k = world.night ? 1 : 0;
      if (k !== on) {
        on = k;
        glass.material.color.set(k ? '#ffe9a3' : '#fff8e6');
      }
      light.intensity = k * (2.5 + Math.sin(t * 6.3) * 0.1);
      halo.material.opacity = k * 0.6;
    },
  };
}

// ------------------------------------------------------------------ 꽃밭

function flowers() {
  const group = new THREE.Group();
  const r = rng(303);
  const b = new Batch();
  const W = 0.74;
  const D = 0.28;
  const H = 0.11;
  box(b, W, H, D, [0, H / 2, 0], WOOD);
  for (const sx of [1, -1]) box(b, 0.035, H + 0.012, D + 0.012, [sx * (W / 2 - 0.01), (H + 0.012) / 2, 0], ['#a5744a', '#d3a877']);
  box(b, W - 0.05, 0.02, D - 0.05, [0, H, 0], '#684832');
  const tones = [['#ff5f97', '#ff9dc0'], ['#ffc928', '#ffe680'], ['#f4f4ff', '#ffffff'], ['#ff7f50', '#ffb08a'], ['#b07cff', '#d7b8ff']];
  let n = 0;
  for (const z of [-0.062, 0.062]) {
    for (let i = 0; i < 5; i++) {
      const x = -0.27 + i * 0.135 + (z > 0 ? 0.03 : -0.03) + r.range(-0.012, 0.012);
      const h = r.range(0.13, 0.19);
      pole(b, [x, H, z], [x + r.range(-0.012, 0.012), H + h, z], 0.006, '#4f9a4a', 5);
      b.add(new THREE.SphereGeometry(0.031, 7, 6), { at: [x, H + h + 0.02, z], scale: [1, 1.28, 1], color: tones[(n++ * 2 + (z > 0 ? 1 : 0)) % tones.length], flat: true });
      b.add(new THREE.SphereGeometry(1, 6, 4), { at: [x + 0.022, H + 0.05, z], rot: [0, r() * 3, 0.9], scale: [0.036, 0.008, 0.014], color: '#62b35a' });
    }
  }
  group.add(b.mesh());
  // a butterfly that never leaves them (by day)
  const fly = new THREE.Group();
  const wingGeo = new THREE.CircleGeometry(0.026, 8);
  wingGeo.rotateX(-Math.PI / 2);
  wingGeo.translate(0.024, 0, 0);
  const wingMat = new THREE.MeshBasicMaterial({ color: '#ffe066', side: THREE.DoubleSide });
  const left = new THREE.Mesh(wingGeo, wingMat);
  const right = new THREE.Mesh(wingGeo, wingMat);
  right.scale.x = -1;
  fly.add(left, right);
  group.add(fly);
  return {
    object: group,
    top: H + 0.19,
    update(dt, t, world) {
      fly.visible = !world.night;
      if (!fly.visible) return;
      const x = Math.sin(t * 0.7) * 0.26;
      const z = Math.sin(t * 1.3) * 0.08;
      fly.rotation.y = Math.atan2(x - fly.position.x, z - fly.position.z) + Math.PI / 2;
      fly.position.set(x, H + 0.3 + Math.sin(t * 2.1) * 0.04, z);
      const flap = 0.15 + Math.abs(Math.sin(t * 17)) * 1.05;
      left.rotation.z = flap;
      right.rotation.z = -flap;
    },
  };
}

// ------------------------------------------------------------------ what each one is like

/**
 * solid   circles of ground it takes: [x, z, radius] in its own space
 * h       how tall it is (a ball rolls over what is lower than itself)
 * area    how much the yard grows to make room for it
 * use     what a fox does with it (a behaviour in yardlife.js), `share` = how many at a time
 * turn    how it stands when she first puts it down (eighths of a turn)
 * home    …and where: the free place nearest this one (across the yard and front to back, -1 … 1)
 * view    for its picture in the shop: [how far the camera stands off, the height it looks at]
 */
export const DECOR = {
  house: { build: house, solid: [[0, -0.18, 0.4], [0, 0.17, 0.4]], h: 0.76, area: 0.85, use: 'den', door: 0.41, turn: 0, home: [0.1, -0.62], view: [3.0, 0.34] },
  swing: { build: swing, solid: [[-0.53, 0, 0.17], [0.53, 0, 0.17], [0, 0, 0.3]], h: 1.2, area: 1.0, use: 'ride', turn: 0, home: [0.55, -0.3], view: [3.3, 0.58] },
  pond: { build: pond, solid: [[-0.15, 0, 0.39], [0.15, 0, 0.39]], h: 0.12, area: 0.9, use: 'drink', share: 3, turn: 0, home: [-0.42, 0.36], view: [2.4, 0.02] },
  trampoline: { build: trampoline, solid: [[0, 0, 0.54]], h: 0.26, area: 1.0, use: 'bounce', turn: 0, home: [0.45, 0.4], view: [2.7, 0.1] },
  campfire: { build: campfire, solid: [[0, 0, 0.23]], h: 0.3, area: 0.5, use: 'warm', share: 4, turn: 0, home: [0, -0.05], view: [1.5, 0.12] },
  bench: { build: bench, solid: [[-0.27, -0.02, 0.25], [0.27, -0.02, 0.25]], h: 0.46, area: 0.55, use: 'perch', turn: 0, home: [-0.3, -0.72], view: [2.4, 0.2] },
  lamp: { build: lamp, solid: [[0, 0, 0.08]], h: 1.05, area: 0.1, use: null, turn: 0, home: [0.72, -0.5], view: [2.6, 0.55] },
  flowers: { build: flowers, solid: [[-0.2, 0, 0.19], [0.2, 0, 0.19]], h: 0.3, area: 0.38, use: 'smell', share: 2, turn: 0, home: [0.32, 0.7], view: [1.9, 0.14] },
};

export const DECOR_IDS = Object.keys(DECOR);

/** One of the things, built: { id, def, object, users, at(x, z) … } — the world gives it its place. */
export function makeDecor(id) {
  const def = DECOR[id];
  if (!def) return null;
  const item = { id, def, x: 0, z: 0, r: 0, yaw: 0, users: [], trial: false, ...def.build() };
  /** A point of its own space, in the world (on the ground). */
  item.at = (x, z, out = V()) => {
    const c = Math.cos(item.yaw);
    const s = Math.sin(item.yaw);
    const p = item.object.position;
    return out.set(p.x + x * c + z * s, 0, p.z - x * s + z * c);
  };
  item.reach = Math.max(...def.solid.map(([x, z, r]) => Math.hypot(x, z) + r)); // everything of it is within this of its middle
  item.object.traverse((o) => {
    if (o.isMesh && o.material.isMeshLambertMaterial) o.castShadow = true;
  });
  return item;
}
