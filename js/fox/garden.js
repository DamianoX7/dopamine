// The song garden: round the yard, a flower for every cover she has released (js/garden.js says which flower: its kind
// by how fast the song goes, its colour by its key, its size by how often it has been listened to). They grow in rows
// along the back and the sides of the yard, the first one in the middle of the back and the rest out from it to either
// side in turn — the front stays open. They nod in the breeze, bend aside for a fox that goes through, open up the
// first time she sees them, bounce when she taps one (the app says which song it is), and the flower of the song that
// is playing dances to it.
import * as THREE from '../vendor/three.module.min.js';
import { V, rng, Batch, TAU, clamp } from './kit.js';

const SPACE = 0.27; //                   between two flowers along a row
const ROWS = [1.12, 1.28, 1.44]; //      how far out each row is (of the yard's size)…
const REACH = 0.64 * Math.PI; //         …and how far round from the back of it, to either side (the front stays open)
const BLOOM = 1.8; //                    seconds it takes a new one to open
const LEAF = ['#3d7f34', '#5fae4b'];
const MAT = new THREE.MeshLambertMaterial({ vertexColors: true }); // (all of them: the colours are in the flowers themselves)
const _c = new THREE.Color();
const _d = new THREE.Color();
const _v = V();
const tint = (color, to, k) => '#' + _c.set(color).lerp(_d.set(to), k).getHexString();

/** A petal (a stretched, flattened ball) on the flower's face: `n` of them round its middle, `out` from it. */
function petals(b, n, out, y, size, scale, tilt, color, r, twist = 0) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + twist + (r() - 0.5) * 0.12;
    b.add(new THREE.SphereGeometry(size, 7, 5), {
      at: [Math.sin(a) * out, y, Math.cos(a) * out],
      rot: [tilt, a, 0, 'YXZ'],
      scale,
      color,
      flat: true,
    });
  }
}

/** The leaves along a stem `h` high. */
function leaves(b, r, h, n, size, s) {
  for (let i = 0; i < n; i++) {
    const a = r() * TAU;
    const y = h * (0.18 + 0.3 * i);
    b.add(new THREE.SphereGeometry(size * s, 6, 4), { at: [Math.sin(a) * size * s * 1.1, y, Math.cos(a) * size * s * 1.1], rot: [0.9, a, 0, 'YXZ'], scale: [0.55, 1.5, 0.16], color: LEAF, flat: true });
  }
}

/*
   The flowers. Each makes its face (on `head`: up from the top of the stem) and says how tall its stem is, and how far
   its face turns towards whoever looks on (`face`, radians from looking straight up).
*/
const KINDS = {
  rose: {
    h: 0.17,
    face: 0.35,
    head(b, c, r) {
      b.add(new THREE.SphereGeometry(0.016, 7, 5), { at: [0, 0.022, 0], scale: [1, 1.15, 1], color: tint(c, '#3a0a22', 0.35), flat: true });
      petals(b, 5, 0.012, 0.02, 0.022, [0.95, 0.85, 0.34], 0.35, tint(c, '#3a0a22', 0.15), r);
      petals(b, 6, 0.023, 0.014, 0.027, [1, 0.75, 0.3], 0.85, c, r, 0.3);
      petals(b, 7, 0.033, 0.008, 0.03, [1, 0.6, 0.28], 1.2, tint(c, '#ffffff', 0.12), r, 0.6);
    },
  },
  tulip: {
    h: 0.2,
    face: 0.1,
    head(b, c, r) {
      petals(b, 5, 0.013, 0.036, 0.03, [0.62, 1.45, 0.42], 0.24, [tint(c, '#2a0018', 0.3), c], r);
      b.add(new THREE.SphereGeometry(0.012, 6, 4), { at: [0, 0.02, 0], color: '#ffe08a' });
    },
  },
  daisy: {
    h: 0.16,
    face: 0.55,
    head(b, c, r) {
      b.add(new THREE.SphereGeometry(0.016, 8, 6), { at: [0, 0.006, 0], scale: [1, 0.45, 1], color: '#ffcf3f', flat: true });
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * TAU + (r() - 0.5) * 0.1;
        b.add(new THREE.SphereGeometry(0.02, 6, 4), { at: [Math.sin(a) * 0.031, 0.003, Math.cos(a) * 0.031], rot: [0, a + Math.PI / 2, 0.1], scale: [1.45, 0.16, 0.4], color: tint('#ffffff', c, 0.32), flat: true });
      }
    },
  },
  cosmos: {
    h: 0.24,
    face: 0.6,
    head(b, c, r) {
      b.add(new THREE.SphereGeometry(0.011, 7, 5), { at: [0, 0.006, 0], scale: [1, 0.6, 1], color: '#ffc928', flat: true });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + (r() - 0.5) * 0.15;
        b.add(new THREE.SphereGeometry(0.026, 7, 4), { at: [Math.sin(a) * 0.033, 0.002, Math.cos(a) * 0.033], rot: [0, a + Math.PI / 2, 0.12], scale: [1.35, 0.14, 0.78], color: c, flat: true });
      }
    },
  },
  sunflower: {
    h: 0.32,
    face: 1.0,
    stem: 0.01,
    head(b, c, r, minor) {
      const gold = minor ? tint('#fff2b0', c, 0.25) : tint('#ffc531', c, 0.18);
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * TAU + (r() - 0.5) * 0.1;
        b.add(new THREE.SphereGeometry(0.03, 6, 4), { at: [Math.sin(a) * 0.064, 0.002, Math.cos(a) * 0.064], rot: [0, a + Math.PI / 2, 0.08], scale: [1.5, 0.14, 0.55], color: gold, flat: true });
      }
      b.add(new THREE.CylinderGeometry(0.048, 0.05, 0.016, 16), { at: [0, 0.006, 0], color: '#5a3416', flat: true });
      b.add(new THREE.CylinderGeometry(0.028, 0.03, 0.018, 12), { at: [0, 0.008, 0], color: '#7a4a1e', flat: true });
    },
  },
  // (a song not listened to yet: a bud, until it is known what it will be)
  bud: {
    h: 0.12,
    face: 0.05,
    head(b, c) {
      b.add(new THREE.SphereGeometry(0.02, 7, 5), { at: [0, 0.024, 0], scale: [0.75, 1.35, 0.75], color: ['#7fbf5a', tint('#ffd6e4', c, 0.3)], flat: true });
    },
  },
};

/** One flower: its stem and leaves, and its face on top, which nods. → { object, head, h } */
function makeFlower(kind, color, minor, seed) {
  const K = KINDS[kind] || KINDS.bud;
  const r = rng(seed);
  const h = K.h * (0.9 + 0.2 * r());
  const plant = new Batch();
  plant.add(new THREE.CylinderGeometry(K.stem || 0.006, (K.stem || 0.006) * 1.4, h, 5, 1, true), { at: [0, h / 2, 0], color: LEAF });
  leaves(plant, r, h, kind === 'sunflower' ? 3 : 2, kind === 'sunflower' ? 0.034 : 0.024, 1);
  const face = new Batch();
  K.head(face, color, r, minor);
  const object = new THREE.Group();
  object.add(plant.mesh(MAT));
  const head = new THREE.Group();
  head.position.y = h;
  const tilt = new THREE.Group();
  tilt.rotation.x = K.face; // (its face turned towards whoever looks on: +z)
  tilt.add(face.mesh(MAT));
  head.add(tilt);
  object.add(head);
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = o.receiveShadow = true;
  });
  return { object, head, h };
}

export class SongGarden {
  constructor(world) {
    this.w = world;
    this.group = new THREE.Group();
    this.group.name = 'song-garden';
    world.scene.add(this.group);
    this.list = []; //  [{ id, kind, color, size, fresh, … what makes it: object, head, h, k (0 … 1 open), hop, nod, x, z }]
    this.key = '';
  }

  /** The flowers as the app has them now: [{ id, kind, color, minor, size, fresh }] (the oldest first). → whether anything changed. */
  set(list) {
    const key = list.map((f) => `${f.id}:${f.kind}:${f.color}:${f.size.toFixed(2)}`).join('|');
    if (key === this.key) return false;
    this.key = key;
    const had = new Map(this.list.map((f) => [f.id, f]));
    this.list = list.map((f, i) => {
      const old = had.get(f.id);
      if (old && old.kind === f.kind && old.color === f.color) {
        had.delete(f.id);
        old.size = f.size;
        return old;
      }
      // (a new one — or one that has changed: a bud that has found out what it is)
      if (old) this.drop(old);
      had.delete(f.id);
      const made = makeFlower(f.kind, f.color, f.minor, (hashOf(f.id) + i) >>> 0);
      this.group.add(made.object);
      return { ...f, ...made, k: f.fresh && f.kind !== 'bud' ? 0 : 1, hop: 0, nod: hashOf(f.id) % 100, x: 0, z: 0, told: !f.fresh };
    });
    had.forEach((f) => this.drop(f));
    this.place();
    return true;
  }

  drop(f) {
    this.group.remove(f.object);
    f.object.traverse((o) => o.geometry && o.geometry.dispose());
  }

  /** Where each one stands: rows round the back and the sides of the yard, from the middle of the back outwards — a place where something of the country stands is passed over. */
  place() {
    const w = this.w;
    const env = w.env;
    if (!env) return;
    const b = env.bounds;
    const R = env.range;
    const spots = [];
    for (let row = 0; row < ROWS.length && spots.length < this.list.length; row++) {
      const rx = b.rx * ROWS[row];
      const rz = b.rz * ROWS[row];
      const per = SPACE / Math.sqrt((rx * rx + rz * rz) / 2);
      const off = row % 2 ? per / 2 : 0; // (each row between the flowers of the one before)
      for (let i = 0; spots.length < this.list.length && i * per + off <= REACH; i++) {
        for (const side of i || off ? [1, -1] : [1]) {
          const a = Math.PI + side * (i * per + off);
          const x = b.cx + Math.sin(a) * rx;
          const z = b.cz + Math.cos(a) * rz;
          if (Math.hypot((x - R.cx) / R.rx, (z - R.cz) / R.rz) > 0.97) continue;
          if (env.wilds.some((o) => Math.hypot(x - o.x, z - o.z) < o.r + 0.07)) continue;
          spots.push([x, z]);
          if (spots.length >= this.list.length) break;
        }
      }
    }
    this.list.forEach((f, i) => {
      const at = spots[i];
      f.object.visible = !!at;
      if (!at) return;
      [f.x, f.z] = at;
      f.object.position.set(f.x, 0, f.z);
      f.object.rotation.y = (hashOf(f.id) % 628) / 100 * 0.15; // (not all quite the same way)
    });
  }

  /** The flower she tapped (a ray), if any: the nearest whose face is close enough to it. */
  hit(ray) {
    let best = null;
    let near = 0.0225; // (a fingertip's width round its face)
    for (const f of this.list) {
      if (!f.object.visible) continue;
      _v.set(f.x, f.h * f.size + 0.02, f.z);
      const d = ray.distanceSqToPoint(_v) / (f.size * f.size);
      if (d < near) {
        near = d;
        best = f;
      }
    }
    return best;
  }

  /** Every frame: the breeze, a fox going through, a tap, the opening of a new one, the song that is playing. */
  update(dt, t) {
    const w = this.w;
    const wind = 1 + 2.5 * Math.max(w.sky.sand, w.sky.rain * 0.6);
    const tune = w.tune && w.tune.on ? w.tune.id : null;
    for (const f of this.list) {
      if (!f.object.visible) continue;
      if (f.k < 1) {
        // opening: up out of the ground, the face last — then a sparkle, and the app is told
        f.k = Math.min(1, f.k + dt / BLOOM);
        if (f.k >= 1 && !f.told) {
          f.told = true;
          w.fx.emit('✨', _v.set(f.x, f.h * f.size + 0.05, f.z), { n: 6, spread: 0.08, rise: 0.35, life: 1.1, size: 0.09 });
          w.host.onBloom && w.host.onBloom(f.id);
        }
      }
      const grow = f.k < 1 ? f.k * f.k * (3 - 2 * f.k) : 1;
      const open = clamp((f.k - 0.45) / 0.55, 0, 1);
      f.hop = Math.max(0, f.hop - dt * 1.6);
      const bounce = Math.sin(f.hop * Math.PI * 3) * f.hop;
      const dance = tune === f.id ? Math.sin(t * 7) : 0;
      f.object.scale.set(f.size, f.size * (grow + 0.12 * bounce + 0.05 * dance), f.size);
      f.head.scale.setScalar(0.2 + 0.8 * open);
      // the breeze; a fox brushing by pushes it aside
      let ax = 0;
      let az = 0;
      for (const fox of w.foxes) {
        const dx = f.x - fox.anim.pos.x;
        const dz = f.z - fox.anim.pos.z;
        const d = Math.hypot(dx, dz);
        if (d < 0.16 && d > 1e-3) {
          ax += (dx / d) * (0.16 - d) * 4;
          az += (dz / d) * (0.16 - d) * 4;
        }
      }
      f.object.rotation.z = -ax * 0.9 + 0.06 * wind * Math.sin(t * 1.3 + f.nod) + 0.25 * dance;
      f.object.rotation.x = az * 0.9 + 0.03 * wind * Math.sin(t * 1.1 + f.nod * 1.7);
      if (dance && Math.random() < dt * 1.2) w.fx.emit(Math.random() < 0.5 ? '🎵' : '🎶', _v.set(f.x, f.h * f.size + 0.06, f.z), { size: 0.1, rise: 0.4, life: 1.2, drift: 0.2 });
    }
  }

  /** Tapped: a bounce and a note. */
  poke(f) {
    f.hop = 1;
    this.w.fx.emit('🎵', _v.set(f.x, f.h * f.size + 0.06, f.z), { size: 0.12, rise: 0.45, life: 1.2, drift: 0.15 });
  }

  /** The new ones, not opened yet. */
  get fresh() {
    return this.list.filter((f) => f.object.visible && f.k < 1);
  }
}

/** A number for a cover's id, the same every time. */
function hashOf(id) {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return h >>> 0;
}
