// 우리 동네 — the street round the corner from 둘의 집, as a model of one on a board: a street across it with a zebra
// crossing or two, pavements either side; along the far one her own house — a cottage with the pink door she knows from
// inside, facing the street — the café, the convenience store, the coin karaoke (townshops.js); on the near side the
// park (swings, a slide, a bench, trees that follow the year), a bus stop, two vending machines, the courier's scooter
// parked by the kerb, a garden with the neighbourhood's big tree; lamp posts, and the wires strung between the poles as
// in any street in Incheon.
//
// buildTown() gives back { group, shops, walls (that fold), doors, grid (the ground as squares: grid.js), places
// (where one goes and stands and sits, in the town's measure), trees, lamps, glows, taps, swings, pigeons, …}. The
// town's measure is the room's: 1.3 = her height; y = 0 is the pavement; +Z towards the camera's first place.
import * as THREE from '../vendor/three.module.min.js';
import { Parts, MAT, V, TAU, rng, roundBox, pole, heart } from './shapes.js';
import { Grid } from './grid.js';
import { buildStore, buildCafe, buildKaraoke, canvasTex, glowSprite, STORE, CAFE, KARAOKE } from './townshops.js';

const C = (hex) => new THREE.Color(hex);

// ------------------------------------------------------------------ where everything is
export const BOARD = { x0: -11, x1: 10.6, z0: -8, z1: 6.8 };
const ROAD = { z0: -1.2, z1: 1.2 };
const WALK_N = { z0: -2.45, z1: -1.2 };
const WALK_S = { z0: 1.2, z1: 2.45 };
export const CROSSINGS = [
  { x0: 3.1, x1: 4.5 }, //   (the store's)
  { x0: -9.05, x1: -7.75 }, // (from her gate to the park's)
];
const AT = {
  store: V(2.6, 0, -4.5),
  cafe: V(-2.6, 0, -4.4),
  karaoke: V(7.6, 0, -4.4),
  home: V(-7.8, 0, -4.7), // her cottage (turned to face the street: its door at x = -8.4)
};
const HOME = { w: 4.0, d: 2.8, h: 1.5, door: -8.4, doorW: 0.72 };
// the bus (bus.js): the middle of the lane it keeps to, on the stop's side of the road — and where its door stands
// when it stops, before the shelter
export const LANE = 0.62;
export const STOP_DOOR = -1.05;
const PARK = { x0: -10.6, x1: -3.95, z0: 2.5, z1: 6.6, gate: [-8.9, -7.9] };

/* Painted ground: grass, the pavement's bricks, the road. */
function groundTextures() {
  const grass = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#8fcf72';
    g.fillRect(0, 0, W, H);
    const rnd = rng(5);
    for (let i = 0; i < 900; i++) {
      g.strokeStyle = rnd() < 0.5 ? 'rgba(70, 140, 70, 0.35)' : 'rgba(190, 235, 150, 0.35)';
      g.lineWidth = 1.5;
      const x = rnd() * W;
      const y = rnd() * H;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + rnd.range(-2, 2), y - rnd.range(3, 7));
      g.stroke();
    }
  }, { repeat: [10, 7] });
  const bricks = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#d9c3bd';
    g.fillRect(0, 0, W, H);
    const rnd = rng(9);
    const bw = W / 4;
    const bh = H / 8;
    for (let j = 0; j < 8; j++)
      for (let i = -1; i < 5; i++) {
        const x = i * bw + (j % 2 ? bw / 2 : 0);
        g.fillStyle = rnd.pick(['#e8cfc8', '#e2c4bd', '#d8b7b2', '#edd8d0', '#c9aaa6']);
        g.fillRect(x + 2, j * bh + 2, bw - 4, bh - 4);
      }
  }, { repeat: [14, 1] });
  const asphalt = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#6d6a74';
    g.fillRect(0, 0, W, H);
    const rnd = rng(13);
    for (let i = 0; i < 2600; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(40, 38, 46, 0.35)' : 'rgba(160, 156, 170, 0.3)';
      g.fillRect(rnd() * W, rnd() * H, 1.6, 1.6);
    }
  }, { repeat: [12, 1.5] });
  const sand = canvasTex(128, 128, (g, W, H) => {
    g.fillStyle = '#f0d9ae';
    g.fillRect(0, 0, W, H);
    const rnd = rng(17);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(190, 150, 100, 0.3)' : 'rgba(255, 245, 220, 0.5)';
      g.fillRect(rnd() * W, rnd() * H, 1.4, 1.4);
    }
  }, { repeat: [3, 2] });
  // (and the grass under snow)
  const snow = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#f4f7fc';
    g.fillRect(0, 0, W, H);
    const rnd = rng(19);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = rnd() < 0.6 ? 'rgba(180, 196, 230, 0.35)' : 'rgba(255, 255, 255, 0.9)';
      g.beginPath();
      g.arc(rnd() * W, rnd() * H, rnd.range(1, 3), 0, TAU);
      g.fill();
    }
  }, { repeat: [10, 7] });
  return { grass, bricks, asphalt, sand, snow };
}

// ------------------------------------------------------------------ trees that follow the year

/*
 * A tree: its trunk and branches, and a crown of soft blobs (vertex colours only shade it: its colour is the season's,
 * on the material, shared by every tree of its kind). kind: 'ginkgo' (the street's: gold in autumn), 'maple' (red in
 * autumn), 'cherry' (pink in spring), 'zelkova' (the neighbourhood's big tree).
 */
const SEASON_COLORS = {
  ginkgo: { spring: '#a8d86a', summer: '#5aa850', autumn: '#ffd23f', winter: null },
  maple: { spring: '#9fd66a', summer: '#4f9e4a', autumn: '#ef5a32', winter: null },
  cherry: { spring: '#ffc2d6', summer: '#5fae5a', autumn: '#f2a03a', winter: null },
  zelkova: { spring: '#9fd66a', summer: '#4f9e4a', autumn: '#e8913a', winter: null },
};
function treeMats() {
  const out = {};
  for (const k in SEASON_COLORS) out[k] = [];
  return out;
}
const crownMat = (kind) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, color: SEASON_COLORS[kind].summer });

function tree(kind, mats, s = 1, seed = 1) {
  const g = new THREE.Group();
  const rnd = rng(seed);
  const P = new Parts();
  const bark = kind === 'cherry' ? ['#5a3a34', '#7a5048'] : kind === 'ginkgo' ? ['#6b5a4a', '#8a7562'] : ['#6b4631', '#8f6247'];
  const trunkH = (kind === 'ginkgo' ? 1.5 : kind === 'zelkova' ? 1.3 : 1.0) * s;
  P.get('wood').add(new THREE.CylinderGeometry(0.06 * s, 0.11 * s, trunkH, 8), { at: [0, trunkH / 2, 0], color: bark });
  // branches (seen in winter, bare)
  const tips = [];
  const nb = kind === 'zelkova' ? 7 : 5;
  for (let i = 0; i < nb; i++) {
    const a = (i / nb) * TAU + rnd() * 0.5;
    const up = kind === 'ginkgo' ? 0.9 : 0.55;
    const from = [0, trunkH * rnd.range(0.7, 0.95), 0];
    const len = (kind === 'zelkova' ? 1.1 : kind === 'ginkgo' ? 0.55 : 0.8) * s * rnd.range(0.8, 1.1);
    const to = [Math.cos(a) * len, from[1] + len * up, Math.sin(a) * len];
    pole(P.get('wood'), from, to, 0.025 * s, bark[0], 5);
    tips.push(to);
  }
  P.bake(g, ownMats());
  // the crown: soft lumps round the branch tips (a ginkgo's narrow, a zelkova's wide)
  const crown = new Parts();
  const lump = (x, y, z, r) => crown.get('c').add(new THREE.IcosahedronGeometry(r, 1), { at: [x, y, z], color: (p, n) => C('#ffffff').lerp(C('#9a9a9a'), 0.45 - 0.45 * n.y + rnd() * 0.12) });
  if (kind === 'ginkgo') {
    for (let i = 0; i < 6; i++) lump(rnd.range(-0.2, 0.2) * s, trunkH + (0.25 + i * 0.18) * s, rnd.range(-0.2, 0.2) * s, (0.42 - i * 0.04) * s);
  } else {
    tips.forEach(([x, y, z]) => lump(x * 0.9, y + 0.05 * s, z * 0.9, (kind === 'zelkova' ? 0.62 : 0.45) * s * rnd.range(0.85, 1.1)));
    lump(0, trunkH + (kind === 'zelkova' ? 0.9 : 0.6) * s, 0, (kind === 'zelkova' ? 0.75 : 0.5) * s);
  }
  const cm = crownMat(kind);
  mats[kind].push(cm);
  const crownMesh = crown.b.c.mesh(cm);
  crownMesh.castShadow = true;
  g.add(crownMesh);
  // snow on the branches, in winter
  const snow = new Parts();
  tips.forEach(([x, y, z]) => snow.get('s').add(new THREE.SphereGeometry(0.06 * s, 6, 4), { at: [x, y + 0.03, z], scale: [1.4, 0.5, 1.4], color: '#ffffff' }));
  const snowMesh = snow.b.s.mesh(new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.9 }));
  snowMesh.visible = false;
  g.add(snowMesh);
  return { group: g, kind, crown: crownMesh, snow: snowMesh, top: trunkH + 1.2 * s };
}

// ------------------------------------------------------------------ her cottage

/* 둘의 집, from outside: cream walls, a pink roof, the pink door with its heart (as it is inside), a window that glows
   at night, a step, the mat that says welcome, a pot by the door, a little fence with a gate. */
function cottage() {
  const g = new THREE.Group();
  const { w, d, h } = HOME;
  const P = new Parts();
  const wallMat = new THREE.MeshStandardMaterial({ color: '#fff4e8', roughness: 0.85 });
  // the walls, with a doorway and a window in the street side (−Z here: it faces the street)
  const front = new THREE.Shape();
  front.moveTo(-w / 2, 0);
  front.lineTo(w / 2, 0);
  front.lineTo(w / 2, h);
  front.lineTo(-w / 2, h);
  front.closePath();
  const du = AT.home.x - HOME.door; // (the door's x, in the cottage's measure: it is turned round to face the street)
  const door = new THREE.Path();
  door.moveTo(du - HOME.doorW / 2, 0.001);
  door.lineTo(du - HOME.doorW / 2, 1.3);
  door.lineTo(du + HOME.doorW / 2, 1.3);
  door.lineTo(du + HOME.doorW / 2, 0.001);
  front.holes.push(door);
  const win = new THREE.Path();
  win.moveTo(-1.45, 0.55);
  win.lineTo(-1.45, 1.15);
  win.lineTo(-0.55, 1.15);
  win.lineTo(-0.55, 0.55);
  front.holes.push(win);
  const fg = new THREE.ExtrudeGeometry(front, { depth: 0.12, bevelEnabled: false });
  const fm = new THREE.Mesh(fg, wallMat);
  fm.rotation.y = Math.PI; // (its outside towards −Z)
  fm.position.set(0, 0, -d / 2 + 0.12);
  fm.castShadow = fm.receiveShadow = true;
  // (turned round, its x is mirrored: the door and the window are cut where they belong from the street)
  fm.scale.x = -1;
  g.add(fm);
  for (const [x, z, ww, dd] of [[0, d / 2 - 0.06, w, 0.12], [-w / 2 + 0.06, 0, 0.12, d], [w / 2 - 0.06, 0, 0.12, d]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(ww, h, dd), wallMat);
    m.position.set(x, h / 2, z);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  }
  // the gable ends and the roof: two slopes of pink tiles
  const roofH = 1.05;
  const gable = new THREE.Shape();
  gable.moveTo(-d / 2, 0);
  gable.lineTo(d / 2, 0);
  gable.lineTo(0, roofH);
  gable.closePath();
  for (const s of [-1, 1]) {
    const gg = new THREE.Mesh(new THREE.ExtrudeGeometry(gable, { depth: 0.12, bevelEnabled: false }), wallMat);
    gg.rotation.y = Math.PI / 2;
    gg.position.set(s > 0 ? w / 2 - 0.12 : -w / 2, h, 0);
    gg.castShadow = true;
    g.add(gg);
  }
  const tiles = canvasTex(128, 128, (c, W, H) => {
    c.fillStyle = '#e88a9a';
    c.fillRect(0, 0, W, H);
    for (let j = 0; j < 8; j++)
      for (let i = 0; i < 8; i++) {
        c.fillStyle = (i + j) % 3 ? '#f29aaa' : '#e07c8e';
        c.beginPath();
        c.arc(i * 16 + (j % 2 ? 8 : 0), j * 16 + 14, 8, Math.PI, 0);
        c.fill();
      }
  }, { repeat: [3, 2] });
  const slope = Math.hypot(d / 2 + 0.25, roofH);
  const ang = Math.atan2(roofH, d / 2 + 0.25);
  for (const s of [-1, 1]) {
    const r = new THREE.Mesh(roundBox(w + 0.4, 0.07, slope, 0.02), new THREE.MeshStandardMaterial({ map: tiles, roughness: 0.7 }));
    r.position.set(0, h + roofH / 2 - 0.02, (s * (d / 2 + 0.25)) / 2);
    r.rotation.x = s * ang;
    r.castShadow = r.receiveShadow = true;
    g.add(r);
  }
  P.get('paint').add(roundBox(w + 0.44, 0.08, 0.1, 0.03), { at: [0, h + roofH + 0.01, 0], color: '#d36a7e' });
  // a chimney
  P.get('paint').add(roundBox(0.28, 0.6, 0.28, 0.02), { at: [1.1, h + roofH * 0.6, 0.5], color: '#f6e2d8' });
  // the window: its frame, curtains, a box of flowers under it
  const glassMat = new THREE.MeshStandardMaterial({ color: '#cfe6ff', roughness: 0.1, emissive: '#ffcf8a', emissiveIntensity: 0 });
  const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.6), glassMat);
  pane.position.set(-1.0, 0.85, -d / 2 + 0.06);
  pane.rotation.y = Math.PI;
  g.add(pane);
  for (const [x, y, ww, hh] of [[-1.0, 1.17, 1.0, 0.05], [-1.0, 0.53, 1.0, 0.05], [-1.47, 0.85, 0.05, 0.66], [-0.53, 0.85, 0.05, 0.66], [-1.0, 0.85, 0.03, 0.6]]) P.get('paint').add(new THREE.BoxGeometry(ww, hh, 0.05), { at: [x, y, -d / 2 - 0.01], color: '#ffffff' });
  for (const x of [-1.32, -0.68]) P.get('fabric').add(new THREE.BoxGeometry(0.2, 0.56, 0.01), { at: [x, 0.86, -d / 2 + 0.07], color: '#ffd0de' });
  P.get('wood').add(roundBox(1.0, 0.12, 0.16, 0.02), { at: [-1.0, 0.46, -d / 2 - 0.08], color: ['#c48c58', '#e0b381'] });
  const rnd = rng(23);
  for (let i = 0; i < 9; i++) P.get('paint').add(new THREE.SphereGeometry(0.04, 8, 6), { at: [-1.4 + i * 0.1, 0.56, -d / 2 - 0.08 + rnd.range(-0.03, 0.03)], color: rnd.pick(['#ff6f9c', '#ffd23f', '#ffffff', '#c9a6ff']) });
  // the door's frame; the door (it swings in), pink, its round window and its heart
  for (const s of [-1, 1]) P.get('paint').add(new THREE.BoxGeometry(0.06, 1.36, 0.16), { at: [du + s * (HOME.doorW / 2 + 0.03), 0.68, -d / 2 + 0.06], color: '#ffffff' });
  P.get('paint').add(new THREE.BoxGeometry(HOME.doorW + 0.12, 0.06, 0.16), { at: [du, 1.33, -d / 2 + 0.06], color: '#ffffff' });
  const hinge = new THREE.Group();
  hinge.position.set(du + HOME.doorW / 2, 0, -d / 2 + 0.06);
  const leaf = new Parts();
  leaf.get('paint').add(roundBox(HOME.doorW - 0.02, 1.28, 0.05, 0.015), { at: [-(HOME.doorW - 0.02) / 2, 0.65, 0], color: '#ff9cbc' });
  leaf.get('paint').add(roundBox(HOME.doorW - 0.2, 0.42, 0.012, 0.008), { at: [-(HOME.doorW - 0.02) / 2, 0.4, -0.03], color: '#ffb3c9' });
  leaf.get('gloss').add(new THREE.CircleGeometry(0.1, 20), { at: [-(HOME.doorW - 0.02) / 2, 1.0, -0.03], rot: [0, Math.PI, 0], color: '#cfe8ff' });
  leaf.get('metal').add(new THREE.SphereGeometry(0.025, 10, 8), { at: [-HOME.doorW + 0.1, 0.62, -0.04], color: '#e9c26a' });
  leaf.get('paint').add(heart(0.14, 0.022), { at: [-(HOME.doorW - 0.02) / 2, 0.78, -0.035], rot: [0, Math.PI, 0], color: '#7cc56c' });
  leaf.bake(hinge);
  g.add(hinge);
  // the step, the mat, a pot of flowers, a nameplate
  P.get('paint').add(roundBox(1.0, 0.1, 0.5, 0.02), { at: [du, 0.05, -d / 2 - 0.25], color: '#f4e6d8' });
  const mat = new THREE.Mesh(
    roundBox(0.6, 0.012, 0.36, 0.008),
    new THREE.MeshStandardMaterial({
      map: canvasTex(256, 160, (c, W, H) => {
        c.fillStyle = '#c9965f';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#7a4a3a';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '700 46px Jua, sans-serif';
        c.fillText('어서 와 💗', W / 2, H / 2 + 4);
      }),
      roughness: 1,
    })
  );
  mat.position.set(du, 0.106, -d / 2 - 0.27);
  mat.rotation.y = Math.PI;
  mat.receiveShadow = true;
  g.add(mat);
  P.get('paint').add(new THREE.CylinderGeometry(0.12, 0.09, 0.22, 14), { at: [du + 0.62, 0.11, -d / 2 - 0.25], color: '#e99a63' });
  P.get('leaf').add(new THREE.IcosahedronGeometry(0.16, 1), { at: [du + 0.62, 0.34, -d / 2 - 0.25], color: ['#3f8a4c', '#7cc56c'], flat: true });
  const plate = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.16),
    new THREE.MeshStandardMaterial({
      map: canvasTex(256, 96, (c, W, H) => {
        c.fillStyle = '#fffaf2';
        c.fillRect(0, 0, W, H);
        c.strokeStyle = '#ff9cbc';
        c.lineWidth = 8;
        c.strokeRect(4, 4, W - 8, H - 8);
        c.fillStyle = '#7a4a5a';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '700 48px Jua, sans-serif';
        c.fillText('둘의 집', W / 2, H / 2 + 3);
      }),
      roughness: 0.6,
    })
  );
  plate.position.set(du - 0.62, 1.05, -d / 2 - 0.005);
  plate.rotation.y = Math.PI;
  g.add(plate);
  // the fence along the street, its gate
  const fence = P.get('paint');
  const fz = -d / 2 - 0.55;
  for (let x = -w / 2 - 0.2; x <= w / 2 + 0.2; x += 0.22) {
    if (x > du - 0.42 && x < du + 0.42) continue;
    fence.add(roundBox(0.06, 0.42, 0.04, 0.012), { at: [x, 0.21, fz], color: '#ffffff' });
    fence.add(new THREE.ConeGeometry(0.035, 0.06, 4), { at: [x, 0.45, fz], rot: [0, Math.PI / 4, 0], color: '#ffffff' });
  }
  for (const y of [0.12, 0.32]) {
    fence.add(new THREE.BoxGeometry(du - 0.42 + w / 2 + 0.2, 0.04, 0.02), { at: [(-w / 2 - 0.2 + du - 0.42) / 2, y, fz + 0.03], color: '#ffffff' });
    fence.add(new THREE.BoxGeometry(w / 2 + 0.2 - du - 0.42, 0.04, 0.02), { at: [(du + 0.42 + w / 2 + 0.2) / 2, y, fz + 0.03], color: '#ffffff' });
  }
  // a garden in front, flowers along the fence
  for (let i = 0; i < 26; i++) {
    const x = rnd.range(-w / 2 - 0.1, w / 2 + 0.1);
    if (Math.abs(x - du) < 0.5) continue;
    P.get('paint').add(new THREE.SphereGeometry(0.035, 6, 5), { at: [x, 0.1, fz + 0.12 + rnd() * 0.15], color: rnd.pick(['#ff6f9c', '#ffd23f', '#ffffff', '#c9a6ff', '#ff9f5a']) });
    P.get('leaf').add(new THREE.ConeGeometry(0.03, 0.1, 4), { at: [x, 0.05, fz + 0.12 + rnd() * 0.15], color: '#5aa850' });
  }
  P.bake(g, ownMats());
  g.traverse((m) => {
    if (m.isMesh) m.receiveShadow = true;
  });
  return { group: g, door: hinge, doorLocal: du, glassMat };
}

/* A copy of the shared materials, for something that has to fade on its own (her cottage, a tree in front of her). */
function ownMats() {
  const out = {};
  for (const k of ['fabric', 'wood', 'paint', 'gloss', 'metal', 'leaf']) out[k] = MAT[k].clone();
  return out;
}

// ------------------------------------------------------------------ the park

function swingSet(P, cx, cz) {
  const half = 0.85;
  const top = 1.6;
  for (const s of [-1, 1])
    for (const t of [-1, 1]) pole(P.get('metal'), [cx + s * half, top, cz], [cx + s * (half + 0.12), 0, cz + t * 0.5], 0.035, '#ff8fb2', 8);
  pole(P.get('metal'), [cx - half - 0.05, top, cz], [cx + half + 0.05, top, cz], 0.035, '#ffd23f', 10);
  const seats = [];
  for (const x of [cx - 0.42, cx + 0.42]) {
    const pivot = new THREE.Group();
    pivot.position.set(x, top, cz);
    const sp = new Parts();
    for (const s of [-1, 1]) sp.get('metal').add(new THREE.CylinderGeometry(0.008, 0.008, 1.1, 5), { at: [s * 0.17, -0.55, 0], color: '#c6c7d2' });
    sp.get('paint').add(roundBox(0.42, 0.04, 0.2, 0.015), { at: [0, -1.1, 0], color: '#7fb6ff' });
    sp.bake(pivot);
    seats.push({ pivot, at: V(x, 0, cz), len: 1.1, top, angle: 0, vel: 0 });
  }
  return seats;
}

function slide(P, cx, cz) {
  // the ladder behind, the platform, the chute down to the front
  for (const s of [-1, 1]) {
    pole(P.get('metal'), [cx + s * 0.2, 0, cz - 0.55], [cx + s * 0.2, 1.05, cz - 0.4], 0.025, '#7fb6ff', 6);
    pole(P.get('metal'), [cx + s * 0.2, 0, cz - 0.15], [cx + s * 0.2, 1.0, cz - 0.15], 0.025, '#7fb6ff', 6);
  }
  for (let i = 1; i < 5; i++) pole(P.get('metal'), [cx - 0.2, i * 0.2, cz - 0.55 + i * 0.03], [cx + 0.2, i * 0.2, cz - 0.55 + i * 0.03], 0.015, '#c6c7d2', 5);
  P.get('paint').add(roundBox(0.5, 0.06, 0.4, 0.02), { at: [cx, 1.0, cz - 0.3], color: '#ffd23f' });
  const len = 1.5;
  const ang = Math.atan2(1.0, 1.2);
  P.get('gloss').add(roundBox(0.42, 0.03, len, 0.012), { at: [cx, 0.52, cz + 0.45], rot: [ang, 0, 0], color: '#ff6f9c' });
  for (const s of [-1, 1]) P.get('gloss').add(roundBox(0.03, 0.1, len, 0.01), { at: [cx + s * 0.21, 0.57, cz + 0.45], rot: [ang, 0, 0], color: '#ff6f9c' });
}

/* A park bench: wooden slats on iron legs. */
function bench(P, cx, cz, yaw, w = 1.2) {
  const m = new THREE.Matrix4().compose(V(cx, 0, cz), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
  const add = (part, geo, at, color, rot = [0, 0, 0]) => P.get(part).add(geo, { matrix: m.clone().multiply(new THREE.Matrix4().compose(V(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), V(1, 1, 1))), color });
  for (const s of [-1, 1]) {
    add('metal', new THREE.BoxGeometry(0.05, 0.4, 0.4), [s * (w / 2 - 0.08), 0.2, -0.02], '#3a3a44');
    add('metal', new THREE.BoxGeometry(0.05, 0.45, 0.05), [s * (w / 2 - 0.08), 0.62, -0.2], '#3a3a44');
  }
  for (let i = 0; i < 3; i++) add('wood', roundBox(w, 0.035, 0.11, 0.01), [0, 0.42, -0.14 + i * 0.12], ['#c48c58', '#e0b381']);
  for (let i = 0; i < 2; i++) add('wood', roundBox(w, 0.1, 0.03, 0.01), [0, 0.6 + i * 0.14, -0.22], ['#c48c58', '#e0b381'], [-0.15, 0, 0]);
}

/* A pigeon: grey, a sheen of green at its neck, pink feet — pecking about. */
function pigeon() {
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const P = new Parts();
  P.get('paint').add(new THREE.SphereGeometry(0.07, 10, 8), { at: [0, 0.09, 0], scale: [0.8, 0.75, 1.25], color: ['#7a7f90', '#a9adbb'] });
  P.get('paint').add(new THREE.ConeGeometry(0.035, 0.1, 6), { at: [0, 0.09, -0.12], rot: [-Math.PI / 2 - 0.3, 0, 0], color: '#5a5e6e' });
  for (const s of [-1, 1]) P.get('paint').add(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 4), { at: [s * 0.025, 0.025, 0.01], color: '#ff8f9f' });
  P.bake(body);
  const head = new THREE.Group();
  head.position.set(0, 0.14, 0.07);
  const H = new Parts();
  H.get('paint').add(new THREE.SphereGeometry(0.04, 10, 8), { at: [0, 0.02, 0.02], color: '#8a8fa0' });
  H.get('gloss').add(new THREE.SphereGeometry(0.042, 10, 8), { at: [0, -0.015, 0.0], scale: [1, 0.7, 1], color: ['#5aa88a', '#a98ac9'] });
  H.get('paint').add(new THREE.ConeGeometry(0.01, 0.03, 5), { at: [0, 0.015, 0.065], rot: [Math.PI / 2, 0, 0], color: '#3a3a44' });
  for (const s of [-1, 1]) H.get('dark').add(new THREE.SphereGeometry(0.007, 6, 4), { at: [s * 0.03, 0.03, 0.04] });
  H.bake(head);
  body.add(head);
  return { group: g, body, head };
}

// ------------------------------------------------------------------ the street's things

function streetLamp(P, x, z, face) {
  pole(P.get('metal'), [x, 0, z], [x, 2.3, z], 0.04, '#3f5a56', 8);
  P.get('metal').add(new THREE.CylinderGeometry(0.09, 0.11, 0.1, 10), { at: [x, 0.05, z], color: '#3f5a56' });
  pole(P.get('metal'), [x, 2.25, z], [x + face * 0.35, 2.4, z], 0.025, '#3f5a56', 6);
  P.get('paint').add(roundBox(0.28, 0.08, 0.16, 0.03), { at: [x + face * 0.42, 2.38, z], color: '#3f5a56' });
  return V(x + face * 0.42, 2.3, z);
}

function utilityPole(P, x, z) {
  pole(P.get('paint'), [x, 0, z], [x, 3.6, z], 0.07, '#b9b7b2', 10);
  for (const y of [3.3, 2.95]) {
    P.get('paint').add(new THREE.BoxGeometry(0.9, 0.06, 0.08), { at: [x, y, z], color: '#8a8984' });
    for (const s of [-0.38, 0, 0.38]) P.get('gloss').add(new THREE.CylinderGeometry(0.03, 0.035, 0.07, 8), { at: [x + s, y + 0.06, z], color: '#ffffff' });
  }
  // a transformer, and the yellow-and-black band at its foot
  P.get('paint').add(new THREE.CylinderGeometry(0.14, 0.14, 0.4, 12), { at: [x, 2.5, z + 0.18], color: '#a9adba' });
  for (let i = 0; i < 4; i++) P.get('paint').add(new THREE.CylinderGeometry(0.073, 0.073, 0.12, 10), { at: [x, 0.3 + i * 0.24, z], color: i % 2 ? '#2b2427' : '#ffd23f' });
  return [V(x - 0.38, 3.36, z), V(x, 3.36, z), V(x + 0.38, 3.36, z), V(x - 0.38, 3.01, z), V(x + 0.38, 3.01, z)];
}

/* The wires between two poles: sagging. */
function wires(group, a, b) {
  const mat = new THREE.LineBasicMaterial({ color: '#3a3a44' });
  for (let k = 0; k < a.length; k++) {
    const pts = [];
    for (let i = 0; i <= 16; i++) {
      const t = i / 16;
      const p = a[k].clone().lerp(b[k], t);
      p.y -= Math.sin(t * Math.PI) * 0.35;
      pts.push(p);
    }
    group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), mat));
  }
}

function vending(P, x, z, color, label) {
  P.get('paint').add(roundBox(0.55, 1.35, 0.45, 0.03), { at: [x, 0.68, z], color: [color, '#' + C(color).lerp(C('#ffffff'), 0.25).getHexString()] });
  P.get('bright').add(new THREE.BoxGeometry(0.44, 0.62, 0.01), { at: [x, 0.95, z - 0.226], color: '#eef8ff' });
  const rnd = rng(label);
  for (let r = 0; r < 3; r++)
    for (let i = 0; i < 5; i++) P.get('gloss').add(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 8), { at: [x - 0.16 + i * 0.08, 0.74 + r * 0.2, z - 0.24], color: rnd.pick(['#ff6f9c', '#ffd23f', '#7fb6ff', '#7fd6a8', '#ffffff', '#e8473a']) });
  P.get('dark').add(new THREE.BoxGeometry(0.4, 0.1, 0.02), { at: [x, 0.25, z - 0.23] });
  P.get('metal').add(roundBox(0.06, 0.1, 0.02, 0.005), { at: [x + 0.18, 0.55, z - 0.235], color: '#c6c7d2' });
}

/* The courier's scooter, parked by the kerb: white and yellow, its box on the back that says 도파민 배달. */
function scooter(group, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  g.rotation.y = 0.15;
  const P = new Parts();
  for (const s of [-1, 1]) {
    P.get('dark').add(new THREE.TorusGeometry(0.14, 0.05, 8, 18), { at: [s * 0.42, 0.15, 0], rot: [0, 0, 0] });
    P.get('metal').add(new THREE.CylinderGeometry(0.06, 0.06, 0.06, 10), { at: [s * 0.42, 0.15, 0], rot: [Math.PI / 2, 0, 0], color: '#c6c7d2' });
  }
  P.get('gloss').add(roundBox(0.7, 0.22, 0.3, 0.08), { at: [0, 0.32, 0], color: '#ffffff' });
  P.get('gloss').add(roundBox(0.18, 0.5, 0.26, 0.06), { at: [0.38, 0.5, 0], rot: [0, 0, -0.25], color: '#ffd23f' });
  pole(P.get('metal'), [0.48, 0.72, -0.24], [0.48, 0.72, 0.24], 0.018, '#3a3a44', 6);
  P.get('fabric').add(roundBox(0.38, 0.08, 0.26, 0.04), { at: [-0.08, 0.47, 0], color: '#3a3a44' });
  P.get('bright').add(new THREE.SphereGeometry(0.04, 10, 8), { at: [0.5, 0.66, 0], color: '#fff6d0' });
  P.bake(g);
  const box = new THREE.Mesh(
    roundBox(0.4, 0.34, 0.38, 0.03),
    new THREE.MeshStandardMaterial({
      map: canvasTex(256, 220, (c, W, H) => {
        c.fillStyle = '#ffd23f';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#ff6f9c';
        c.fillRect(0, H * 0.7, W, H * 0.3);
        c.fillStyle = '#3a2a40';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '700 50px Jua, sans-serif';
        c.fillText('도파민', W / 2, H * 0.3);
        c.fillText('배달 🛵', W / 2, H * 0.52);
      }),
      roughness: 0.6,
    })
  );
  box.position.set(-0.36, 0.7, 0);
  box.rotation.y = Math.PI / 2;
  box.castShadow = true;
  g.add(box);
  g.traverse((m) => {
    if (m.isMesh) {
      m.castShadow = true;
      m.userData.tap = 'scooter';
    }
  });
  group.add(g);
  return g;
}

/* The board under the stop's sign: the stop's name, and the bus that stops here — when it comes (or, before the foxes'
   village has opened, from when it will run: `when`). */
function drawStopBoard(g, W, H, when) {
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, W, H);
  g.fillStyle = '#36c2a6';
  g.fillRect(0, 0, W, H * 0.3);
  g.fillStyle = '#ffffff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `700 ${Math.round(H * 0.17)}px Jua, sans-serif`;
  g.fillText('🚏 말랑공원 앞', W / 2, H * 0.16);
  // the route: its number on a green tag, where it goes
  g.fillStyle = '#3cbf9a';
  g.beginPath();
  g.roundRect(W * 0.06, H * 0.38, W * 0.3, H * 0.2, H * 0.05);
  g.fill();
  g.fillStyle = '#ffffff';
  g.font = `700 ${Math.round(H * 0.15)}px Fredoka, Jua, sans-serif`;
  g.fillText('506', W * 0.21, H * 0.485);
  g.fillStyle = '#3a3340';
  g.font = `700 ${Math.round(H * 0.14)}px Jua, sans-serif`;
  g.fillText('여우마을 🦊', W * 0.67, H * 0.485);
  // …and when it comes, in orange on black
  g.fillStyle = '#1b1820';
  g.fillRect(W * 0.06, H * 0.66, W * 0.88, H * 0.26);
  g.fillStyle = '#ffab2e';
  g.font = `700 ${Math.round(H * (when ? 0.12 : 0.15))}px Jua, sans-serif`;
  g.fillText(when ? `${when} 첫차` : '곧 도착', W / 2, H * 0.795);
}

/* The bus stop: its shelter (a bench under a roof), and by the kerb its sign — a round plate with a bus on it, the board
   of the bus that stops here. Those, and the shelter, can be tapped (`group`: where they go). → { roof (it fades while
   she is under it), redraw(when) }. */
function busStop(P, group, x0, x1, z) {
  const cx = (x0 + x1) / 2;
  const w = x1 - x0;
  for (const s of [-1, 1]) pole(P.get('metal'), [cx + s * (w / 2 - 0.05), 0, z + 0.3], [cx + s * (w / 2 - 0.05), 1.75, z + 0.3], 0.03, '#36c2a6', 6);
  // (its roof on its own, with a material of its own: it fades while she waits under it — see town.js seeThrough)
  const roof = new THREE.Mesh(roundBox(w + 0.2, 0.06, 0.95, 0.03), new THREE.MeshStandardMaterial({ color: '#36c2a6', roughness: 0.26 }));
  roof.position.set(cx, 1.78, z + 0.05);
  roof.rotation.x = 0.08;
  roof.castShadow = roof.receiveShadow = true;
  group.add(roof);
  P.get('metal').add(new THREE.BoxGeometry(w - 0.1, 0.05, 0.05), { at: [cx, 1.2, z + 0.32], color: '#36c2a6' });
  bench(P, cx, z + 0.05, Math.PI, w - 0.6);
  // the sign: a pole and a round plate
  const sx = x0 - 0.25;
  const sz = z - 0.2;
  pole(P.get('metal'), [sx, 0, sz], [sx, 2.1, sz], 0.025, '#3a3a44', 6);
  P.get('gloss').add(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20), { at: [sx, 2.05, sz], rot: [Math.PI / 2, 0, 0], color: '#36c2a6' });
  P.get('paint').add(new THREE.CylinderGeometry(0.14, 0.14, 0.035, 20), { at: [sx, 2.05, sz], rot: [Math.PI / 2, 0, 0], color: '#ffffff' });
  P.get('paint').add(roundBox(0.5, 0.39, 0.03, 0.01), { at: [sx, 1.45, sz + 0.012], color: '#36c2a6' });
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.13, 24),
    new THREE.MeshStandardMaterial({
      map: canvasTex(128, 128, (c, Wc, Hc) => {
        c.fillStyle = '#ffffff';
        c.fillRect(0, 0, Wc, Hc);
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = `${Math.round(Hc * 0.62)}px sans-serif`;
        c.fillText('🚌', Wc / 2, Hc * 0.54);
      }),
      roughness: 0.5,
    })
  );
  face.position.set(sx, 2.05, sz + 0.019);
  const tex = canvasTex(256, 192, (c, Wc, Hc) => drawStopBoard(c, Wc, Hc, ''));
  const board = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.345), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.6 }));
  board.position.set(sx, 1.45, sz + 0.029);
  // (the shelter, as a box nobody sees: a tap on it is a tap on the stop)
  const hit = new THREE.Mesh(new THREE.BoxGeometry(w + 0.6, 1.9, 1.3), new THREE.MeshBasicMaterial({ visible: false }));
  hit.position.set(cx - 0.25, 0.95, z + 0.1);
  for (const m of [face, board, hit]) {
    m.userData.tap = 'bus';
    group.add(m);
  }
  let shown = null;
  return {
    roof,
    redraw(when) {
      if (when === shown) return;
      shown = when;
      drawStopBoard(tex.image.getContext('2d'), tex.image.width, tex.image.height, when);
      tex.needsUpdate = true;
    },
  };
}

// ================================================================== the whole town

export function buildTown() {
  const group = new THREE.Group();
  const tex = groundTextures();
  const P = new Parts();
  const rnd = rng(211);
  const mats = treeMats();
  const lamps = []; //  { at (the bulb), glow }
  const glows = []; //  materials that light up at night: { mat, k (how much) }
  const taps = [];
  const W = BOARD.x1 - BOARD.x0;
  const D = BOARD.z1 - BOARD.z0;
  const cx = (BOARD.x0 + BOARD.x1) / 2;
  const cz = (BOARD.z0 + BOARD.z1) / 2;

  // ---- the board: earth under grass, the road, the pavements
  const earth = new THREE.Mesh(roundBox(W, 0.6, D, 0.06), [new THREE.MeshStandardMaterial({ color: '#b98e6a', roughness: 0.95 })]);
  earth.position.set(cx, -0.36, cz);
  earth.receiveShadow = true;
  group.add(earth);
  const grass = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: tex.grass, roughness: 0.95 }));
  grass.rotation.x = -Math.PI / 2;
  grass.position.set(cx, -0.055, cz);
  grass.receiveShadow = true;
  group.add(grass);
  tex.grass.repeat.set(W / 2.2, D / 2.2);
  tex.snow.repeat.copy(tex.grass.repeat);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(W, ROAD.z1 - ROAD.z0), new THREE.MeshStandardMaterial({ map: tex.asphalt, roughness: 0.9 }));
  road.rotation.x = -Math.PI / 2;
  road.position.set(cx, -0.05, (ROAD.z0 + ROAD.z1) / 2);
  road.receiveShadow = true;
  group.add(road);
  tex.asphalt.repeat.set(W / 1.8, 1.3);
  const brickMat = new THREE.MeshStandardMaterial({ map: tex.bricks, roughness: 0.85 });
  tex.bricks.repeat.set(W / 1.6, 1);
  for (const wk of [WALK_N, WALK_S]) {
    const m = new THREE.Mesh(roundBox(W, 0.06, wk.z1 - wk.z0, 0.015), [brickMat]);
    m.position.set(cx, -0.03, (wk.z0 + wk.z1) / 2);
    m.receiveShadow = true;
    group.add(m);
    // the kerb, along the road
    P.get('paint').add(new THREE.BoxGeometry(W, 0.07, 0.08), { at: [cx, -0.02, wk === WALK_N ? wk.z1 - 0.04 : wk.z0 + 0.04], color: '#e4e0e6' });
  }
  // the road's lines, the zebra crossings, a manhole
  for (const z of [ROAD.z0 + 0.12, ROAD.z1 - 0.12]) for (let x = BOARD.x0 + 0.3; x < BOARD.x1 - 0.5; x += 0.9) P.get('paint').add(new THREE.BoxGeometry(0.5, 0.004, 0.05), { at: [x + 0.25, -0.046, z], color: '#f4f2f0' });
  for (const c of CROSSINGS) for (let x = c.x0 + 0.1; x < c.x1 - 0.1; x += 0.36) P.get('paint').add(new THREE.BoxGeometry(0.2, 0.006, ROAD.z1 - ROAD.z0 - 0.3), { at: [x + 0.1, -0.044, 0], color: '#f8f6f4' });
  P.get('metal').add(new THREE.CylinderGeometry(0.22, 0.22, 0.006, 20), { at: [-2.4, -0.044, 0.3], color: '#4a4850' });
  P.get('metal').add(new THREE.CylinderGeometry(0.22, 0.22, 0.006, 20), { at: [7.0, -0.044, -0.4], color: '#4a4850' });

  // ---- the shops
  const shops = {};
  for (const [name, build] of [['store', buildStore], ['cafe', buildCafe], ['karaoke', buildKaraoke]]) {
    const s = build();
    s.group.position.copy(AT[name]);
    s.group.updateMatrixWorld(true);
    group.add(s.group);
    s.at = AT[name].clone();
    s.name = name;
    shops[name] = s;
    s.group.traverse((m) => {
      if (m.isMesh && !m.userData.tap) m.userData.tap = name;
    });
  }
  // (a sign on the pavement outside the café: today's)
  const aframe = new THREE.Group();
  aframe.position.set(-0.95, 0, -2.0);
  aframe.rotation.y = -0.4;
  const board = canvasTex(160, 220, (c, Wc, Hc) => {
    c.fillStyle = '#2f3a34';
    c.fillRect(0, 0, Wc, Hc);
    c.strokeStyle = '#c9a27a';
    c.lineWidth = 10;
    c.strokeRect(5, 5, Wc - 10, Hc - 10);
    c.fillStyle = '#fff8ea';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = '700 26px Jua, sans-serif';
    c.fillText('오늘의 추천', Wc / 2, 46);
    c.font = '700 34px Jua, sans-serif';
    c.fillStyle = '#ffb3c9';
    c.fillText('딸기 라떼', Wc / 2, 104);
    c.font = '60px sans-serif';
    c.fillText('🍓', Wc / 2, 166);
  });
  const frameMat = new THREE.MeshStandardMaterial({ color: '#8e5b3b', roughness: 0.7 });
  const boardMat = new THREE.MeshStandardMaterial({ map: board, roughness: 0.8 });
  for (const s of [-1, 1]) {
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.62, 0.025), [frameMat, frameMat, frameMat, frameMat, boardMat, boardMat]);
    leaf.position.set(0, 0.3, s * 0.1);
    leaf.rotation.x = s * 0.2;
    leaf.rotation.y = s > 0 ? 0 : Math.PI;
    leaf.castShadow = true;
    aframe.add(leaf);
  }
  group.add(aframe);

  // ---- her cottage
  const home = cottage();
  home.group.position.copy(AT.home);
  home.group.rotation.y = Math.PI; // (built facing −Z: turned, it faces the street)
  group.add(home.group);
  home.group.traverse((m) => {
    if (m.isMesh) m.userData.tap = 'home';
  });
  glows.push({ mat: home.glassMat, k: 1.2, warm: true });

  // ---- the park, across the street: grass, a sandpit with swings and a slide, a bench, trees, a lamp, a fence along the
  // street with its gate opposite her own
  const sandPit = new THREE.Mesh(roundBox(4.2, 0.04, 2.5, 0.4), [new THREE.MeshStandardMaterial({ map: tex.sand, roughness: 1 })]);
  sandPit.position.set(-6.8, -0.035, 5.0);
  sandPit.receiveShadow = true;
  group.add(sandPit);
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    P.get('paint').add(roundBox(0.3, 0.08, 0.12, 0.02), { at: [-6.8 + Math.cos(a) * 2.25, 0.0, 5.0 + Math.sin(a) * 1.4], rot: [0, -a + Math.PI / 2, 0], color: i % 2 ? '#ffffff' : '#ffd0de' });
  }
  const swings = swingSet(P, -7.4, 5.0);
  swings.forEach((s) => {
    group.add(s.pivot);
    s.pivot.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.userData.tap = 'swing';
      }
    });
  });
  slide(P, -5.0, 5.05);
  bench(P, -5.65, 3.2, 0, 1.3);
  const parkFence = P.get('paint');
  for (let x = PARK.x0 + 0.2; x <= PARK.x1; x += 0.3) {
    if (x > PARK.gate[0] && x < PARK.gate[1]) continue;
    parkFence.add(roundBox(0.05, 0.5, 0.05, 0.012), { at: [x, 0.25, PARK.z0], color: '#5aa850' });
  }
  for (const [a, b] of [[PARK.x0 + 0.2, PARK.gate[0]], [PARK.gate[1], PARK.x1]]) for (const y of [0.18, 0.42]) parkFence.add(new THREE.BoxGeometry(b - a, 0.04, 0.03), { at: [(a + b) / 2, y, PARK.z0], color: '#5aa850' });
  for (let z = PARK.z0; z <= PARK.z1 - 0.4; z += 0.3) parkFence.add(roundBox(0.05, 0.5, 0.05, 0.012), { at: [PARK.x1, 0.25, z], color: '#5aa850' });
  for (const y of [0.18, 0.42]) parkFence.add(new THREE.BoxGeometry(0.03, 0.04, PARK.z1 - PARK.z0 - 0.4), { at: [PARK.x1, y, (PARK.z0 + PARK.z1 - 0.4) / 2], color: '#5aa850' });
  // the park's sign at its gate
  pole(P.get('wood'), [PARK.gate[0] - 0.15, 0, PARK.z0 - 0.05], [PARK.gate[0] - 0.15, 0.95, PARK.z0 - 0.05], 0.03, '#8e5b3b', 6);
  const parkSign = new THREE.Mesh(
    new THREE.PlaneGeometry(0.7, 0.3),
    new THREE.MeshStandardMaterial({
      map: canvasTex(280, 120, (c, Wc, Hc) => {
        c.fillStyle = '#7cc56c';
        c.fillRect(0, 0, Wc, Hc);
        c.fillStyle = '#ffffff';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.font = '700 48px Jua, sans-serif';
        c.fillText('말랑 공원 🌳', Wc / 2, Hc / 2 + 3);
      }),
      roughness: 0.7,
      side: THREE.DoubleSide,
    })
  );
  parkSign.position.set(PARK.gate[0] - 0.55, 0.85, PARK.z0 - 0.06);
  group.add(parkSign);
  // flowers inside the fence
  for (let i = 0; i < 40; i++) {
    const x = rnd.range(PARK.x0 + 0.3, PARK.x1 - 0.2);
    if (x > PARK.gate[0] - 0.2 && x < PARK.gate[1] + 0.2) continue;
    if (x > -6.4 && x < -4.85) continue; // (not under the bench)
    P.get('paint').add(new THREE.SphereGeometry(0.035, 6, 5), { at: [x, 0.06, PARK.z0 + 0.2 + rnd() * 0.15], color: rnd.pick(['#ff6f9c', '#ffd23f', '#ffffff', '#c9a6ff', '#ff9f5a']) });
  }
  const pigeons = [];
  for (let i = 0; i < 4; i++) {
    const p = pigeon();
    const home0 = V(-7.0 + rnd.range(-0.6, 0.6), 0, 3.55 + rnd.range(-0.3, 0.3));
    p.group.position.copy(home0);
    p.group.rotation.y = rnd() * TAU;
    p.group.traverse((m) => {
      if (m.isMesh) {
        m.castShadow = true;
        m.userData.tap = 'pigeon';
      }
    });
    group.add(p.group);
    pigeons.push({ ...p, home: home0, t: rnd() * 5, state: 'peck', fly: 0, yaw: p.group.rotation.y });
  }

  // ---- trees: the park's maples and cherries, the street's ginkgos, the neighbourhood's big zelkova
  const trees = [];
  const plant = (kind, x, z, s, seed) => {
    const t = tree(kind, mats, s, seed);
    t.group.position.set(x, 0, z);
    t.group.rotation.y = seed;
    group.add(t.group);
    trees.push({ ...t, x, z, r: 0.25 * s });
    return t;
  };
  plant('maple', -10.1, 3.1, 1.1, 3);
  plant('maple', -4.45, 6.15, 0.95, 4);
  plant('cherry', -10.0, 6.1, 1.0, 5);
  plant('cherry', -8.7, 6.3, 0.9, 6);
  // (behind her cottage)
  plant('cherry', -10.15, -6.6, 1.0, 9);
  plant('maple', -5.5, -6.8, 0.85, 10);
  for (const x of [-3.6, 5.1, 8.7]) {
    plant('ginkgo', x, 1.85, 0.85, 7 + x);
    P.get('paint').add(roundBox(0.6, 0.08, 0.6, 0.02), { at: [x, 0.0, 1.85], color: '#8a7a6e' });
  }
  plant('zelkova', 9.2, 4.9, 1.25, 11);
  // trees and hedges behind the shops, and round the edges of the board
  for (const x of [-0.4, 5.6, 9.9]) plant('maple', x, -7.3, 0.8, 13 + x);
  for (let x = BOARD.x0 + 0.4; x < 9.6; x += 0.5) P.get('leaf').add(new THREE.IcosahedronGeometry(0.28, 1), { at: [x, 0.22, -7.6], scale: [1, 0.8, 0.8], color: ['#3f8a4c', '#6fbf6a'], flat: true });

  // ---- the near side of the street: the bus stop, the vending machines, the scooter, a garden with a bench
  const stop = busStop(P, group, -2.5, 0.1, 2.85);
  vending(P, 1.25, 2.75, '#e8473a', 1);
  vending(P, 1.88, 2.75, '#4a7ad9', 2);
  const scoot = scooter(group, 3.35, 2.8);
  // the garden: a lawn, flowers, the bench under the big tree, a bike in its rack
  for (let i = 0; i < 60; i++) {
    const x = rnd.range(4.2, 10.0);
    const z = rnd.range(3.3, 6.3);
    if (Math.hypot(x - 9.2, z - 4.9) < 0.8 || (x > 6.3 && x < 8.2 && z < 3.9)) continue;
    P.get('paint').add(new THREE.SphereGeometry(0.035, 6, 5), { at: [x, 0.06, z], color: rnd.pick(['#ff6f9c', '#ffd23f', '#ffffff', '#c9a6ff', '#ff9f5a']) });
  }
  for (const [x, z, r] of [[4.6, 5.6, 0.45], [5.6, 6.1, 0.35], [8.0, 6.2, 0.4]]) P.get('leaf').add(new THREE.IcosahedronGeometry(r, 1), { at: [x, r * 0.55, z], scale: [1, 0.75, 1], color: ['#3f8a4c', '#7cc56c'], flat: true });
  bench(P, 7.25, 3.4, Math.PI, 1.3);
  // bike rack and a bike
  for (let i = 0; i < 3; i++) pole(P.get('metal'), [4.6 + i * 0.35, 0, 3.5], [4.6 + i * 0.35, 0.4, 3.5], 0.02, '#c6c7d2', 6);
  for (const s of [-1, 1]) P.get('dark').add(new THREE.TorusGeometry(0.22, 0.025, 6, 20), { at: [4.95 + s * 0.38, 0.22, 3.62], rot: [0, 0, 0] });
  pole(P.get('metal'), [4.6, 0.22, 3.62], [5.05, 0.5, 3.62], 0.02, '#ff8fb2', 6);
  pole(P.get('metal'), [5.05, 0.5, 3.62], [5.33, 0.22, 3.62], 0.02, '#ff8fb2', 6);
  pole(P.get('metal'), [4.85, 0.55, 3.62], [5.0, 0.5, 3.62], 0.02, '#ff8fb2', 6);
  P.get('fabric').add(roundBox(0.16, 0.04, 0.07, 0.015), { at: [4.82, 0.6, 3.62], color: '#3a3a44' });
  pole(P.get('metal'), [5.2, 0.68, 3.48], [5.2, 0.68, 3.76], 0.012, '#3a3a44', 5);

  // ---- lamp posts, poles and their wires, a traffic mirror
  const lampAt = [
    streetLamp(P, -4.85, -1.4, 1),
    streetLamp(P, -0.4, -1.4, 1),
    streetLamp(P, 5.6, -1.4, -1),
    streetLamp(P, -7.6, 1.4, 1),
    streetLamp(P, 0.9, 1.4, -1),
    streetLamp(P, 6.6, 1.4, 1),
    streetLamp(P, -4.35, 2.95, -1), // (in the park)
  ];
  const bulbMat = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#ffd98a', emissiveIntensity: 0, roughness: 0.4 });
  for (const at of lampAt) {
    const bulb = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.03, 0.12), bulbMat);
    bulb.position.copy(at).add(V(0, 0.04, 0));
    group.add(bulb);
    const glow = glowSprite('#ffd98a', 1.6);
    glow.position.copy(at);
    group.add(glow);
    lamps.push({ at, glow });
  }
  glows.push({ mat: bulbMat, k: 2.2 });
  const poleTops = [];
  for (const x of [-9.7, -3.9, 2.55, 9.4]) poleTops.push(utilityPole(P, x, 2.32));
  const wireGroup = new THREE.Group();
  for (let i = 0; i < poleTops.length - 1; i++) wires(wireGroup, poleTops[i], poleTops[i + 1]);
  group.add(wireGroup);
  pole(P.get('metal'), [-4.75, 0, -2.3], [-4.75, 1.9, -2.3], 0.03, '#ff8a3a', 6);
  P.get('metal').add(new THREE.TorusGeometry(0.2, 0.03, 6, 20), { at: [-4.75, 2.0, -2.25], color: '#ff8a3a' });
  P.get('gloss').add(new THREE.SphereGeometry(0.19, 16, 10, 0, TAU, 0, Math.PI / 2), { at: [-4.75, 2.0, -2.23], rot: [Math.PI / 2, 0, 0], scale: [1, 0.35, 1], color: '#e8eef8' });

  P.bake(group);
  group.traverse((m) => {
    if (m.isMesh && m.receiveShadow === false && m.material && m.material.type !== 'MeshBasicMaterial') m.receiveShadow = true;
  });
  // (the karaoke's sign glows at night; so do the café's and the store's signs, a little)
  for (const name in shops) if (shops[name].signMat) glows.push({ mat: shops[name].signMat, k: name === 'karaoke' ? 1.4 : 0.5, base: name === 'karaoke' ? 0.6 : 0 });
  taps.push(scoot);

  // ---- the ground, as squares to find her way over
  const grid = new Grid(BOARD.x0 + 0.2, BOARD.x1 - 0.2, BOARD.z0 + 0.2, BOARD.z1 - 0.2, 0.2);
  // (the road costs more to cross than the pavement, the zebra crossings no more)
  grid.rect(BOARD.x0, BOARD.x1, ROAD.z0, ROAD.z1, { cost: 7 });
  for (const c of CROSSINGS) grid.rect(c.x0, c.x1, ROAD.z0, ROAD.z1, { cost: 1 });
  // the shops: their walls (the door left open), and what stands inside
  for (const name in shops) {
    const s = shops[name];
    const { w, d } = name === 'store' ? STORE : name === 'cafe' ? CAFE : KARAOKE;
    const ox = s.at.x;
    const oz = s.at.z;
    grid.wall(ox - w / 2, oz - d / 2, ox + w / 2, oz - d / 2);
    grid.wall(ox - w / 2, oz - d / 2, ox - w / 2, oz + d / 2);
    grid.wall(ox + w / 2, oz - d / 2, ox + w / 2, oz + d / 2);
    const door = s.spots.door;
    const dw = s.doors[0].w;
    grid.wall(ox - w / 2, oz + d / 2, ox + w / 2, oz + d / 2, 0.14, [[door.x + w / 2 - dw / 2 + 0.05, door.x + w / 2 + dw / 2 - 0.05]]);
    for (const [x0, x1, z0, z1] of s.blocks) grid.rect(ox + x0, ox + x1, oz + z0, oz + z1, { pad: 0.08 });
    if (name === 'karaoke') {
      // the booths' doors (the one she goes in by, open)
      grid.rect(ox - 1.25, ox - 0.55, oz + s.booth - 0.08, oz + s.booth + 0.08, { open: 1 });
    }
  }
  // the cottage (she goes in at her door: on its street side)
  const front = AT.home.z + HOME.d / 2;
  grid.rect(AT.home.x - HOME.w / 2, AT.home.x + HOME.w / 2, AT.home.z - HOME.d / 2, front, { pad: 0.1 });
  grid.rect(HOME.door - 0.25, HOME.door + 0.25, front - 0.5, front + 0.3, { open: 1 });
  // her fence (its gate open), her flower pot
  const fz = front + 0.55;
  grid.rect(AT.home.x - HOME.w / 2 - 0.25, HOME.door - 0.45, fz - 0.05, fz + 0.05, { pad: 0.06 });
  grid.rect(HOME.door + 0.45, AT.home.x + HOME.w / 2 + 0.25, fz - 0.05, fz + 0.05, { pad: 0.06 });
  grid.disc(HOME.door - 0.62, front + 0.25, 0.22);
  // the park: its fence (the gate open), the swings' legs, the slide, the bench, the sign
  grid.rect(PARK.x0, PARK.gate[0], PARK.z0 - 0.04, PARK.z0 + 0.04, { pad: 0.06 });
  grid.rect(PARK.gate[1], PARK.x1, PARK.z0 - 0.04, PARK.z0 + 0.04, { pad: 0.06 });
  grid.rect(PARK.x1 - 0.04, PARK.x1 + 0.04, PARK.z0, PARK.z1, { pad: 0.06 });
  for (const s of [-1, 1]) for (const t of [-1, 1]) grid.disc(-7.4 + s * 0.97, 5.0 + t * 0.5, 0.12);
  grid.rect(-5.3, -4.7, 4.4, 6.0, { pad: 0.04 });
  grid.rect(-6.3, -5.0, 2.95, 3.4);
  grid.disc(PARK.gate[0] - 0.15, PARK.z0 - 0.05, 0.08);
  // trees, lamps, poles, the mirror
  for (const t of trees) grid.disc(t.x, t.z, t.r + 0.08);
  for (const [x, z] of [[-4.85, -1.4], [-0.4, -1.4], [5.6, -1.4], [-7.6, 1.4], [0.9, 1.4], [6.6, 1.4], [-4.35, 2.95], [-4.75, -2.3]]) grid.disc(x, z, 0.12);
  for (const x of [-9.7, -3.9, 2.55, 9.4]) grid.disc(x, 2.32, 0.14);
  for (const x of [-3.6, 5.1, 8.7]) grid.rect(x - 0.3, x + 0.3, 1.55, 2.15);
  // the bus stop, the vending machines, the scooter, the bench, the bike, the hedges, the café's sign
  grid.rect(-2.55, 0.15, 2.95, 3.35);
  grid.rect(-2.85, -2.65, 2.55, 2.75);
  grid.rect(0.95, 2.2, 2.5, 3.0);
  grid.rect(2.85, 3.85, 2.55, 3.05);
  grid.rect(6.55, 7.95, 3.35, 3.75);
  grid.rect(4.3, 5.6, 3.35, 3.8);
  grid.rect(-1.25, -0.65, -2.25, -1.75);
  // (the edges of the board, and behind the shops and her cottage, are not for walking)
  grid.rect(BOARD.x0, 9.7, -8, -6.6);

  // ---- where one goes: in the town's measure
  const toWorld = (shop, p) => V(shop.at.x + p.x, p.y || 0, shop.at.z + p.z);
  const spotW = (shop, sp) => (sp.isVector3 ? toWorld(shop, sp) : { ...sp, at: toWorld(shop, sp.at), face: sp.face ? toWorld(shop, sp.face) : undefined });
  const places = {
    home: {
      door: V(HOME.door, 0, front),
      outside: V(HOME.door, 0, front + 0.45),
      inside: V(HOME.door, 0, front - 0.4),
      gate: V(HOME.door, 0, front + 0.95),
    },
    park: {
      gate: V((PARK.gate[0] + PARK.gate[1]) / 2, 0, PARK.z0 - 0.3),
      inside: V((PARK.gate[0] + PARK.gate[1]) / 2, 0, PARK.z0 + 0.6),
      bench: [
        { at: V(-6.0, 0, 3.2), yaw: 0, h: 0.42 },
        { at: V(-5.3, 0, 3.2), yaw: 0, h: 0.42 },
      ],
      swings: swings.map((s) => ({ ...s, front: V(s.at.x, 0, s.at.z + 0.75) })),
      look: [
        { at: V(-9.55, 0, 3.6), face: V(-10.1, 1.6, 3.1), line: 'park_tree' },
        { at: V(-8.7, 0, 5.75), face: V(-8.7, 1.4, 6.3), line: 'park_tree' },
        { at: V(-7.6, 0, 3.25), face: V(-7.0, 0.1, 3.6), line: 'park_pigeon' },
      ],
    },
    street: {
      bench: [{ at: V(-1.6, 0, 2.85), yaw: Math.PI, h: 0.42 }, { at: V(7.25, 0, 3.4), yaw: Math.PI, h: 0.42 }],
      vending: { at: V(1.56, 0, 2.2), face: V(1.56, 0.9, 2.6) },
      look: [
        { at: V(3.35, 0, 2.15), face: V(3.35, 0.5, 2.8), line: 'scooter' },
        { at: V(9.2, 0, 3.85), face: V(9.2, 1.8, 4.9), line: 'big_tree' },
        { at: V(-0.9, 0, -1.65), face: V(-0.95, 0.4, -2.0), line: 'cafe_sign' },
        { at: V(-2.75, 0, 3.15), face: V(-2.75, 1.45, 2.68), line: 'bus_board' },
      ],
    },
    // the bus stop: where she waits (looking down the road, where it comes from), the kerb by its door when it stands
    // here (`doorX`: along the road; `lane`: the middle of the bus, across it), the step up into it, and in
    bus: {
      wait: V(-1.5, 0, 1.85),
      look: V(-9, 0.9, LANE),
      doorX: STOP_DOOR,
      lane: LANE,
      kerb: V(STOP_DOOR, 0, 1.45),
      step: V(STOP_DOOR, 0, 1.08),
      inside: V(STOP_DOOR, 0, 0.78),
    },
  };
  for (const name in shops) {
    const s = shops[name];
    const sp = {};
    for (const k in s.spots) {
      const v = s.spots[k];
      sp[k] = Array.isArray(v) ? v.map((x) => spotW(s, x)) : typeof v === 'number' ? v : spotW(s, v);
    }
    places[name] = sp;
  }
  return { group, shops, home, places, grid, trees, lamps, glows, taps, swings, pigeons, mats, wires: wireGroup, scooter: scoot, stop, grass, grassTex: tex.grass, snowTex: tex.snow };
}

export { AT as TOWN_AT, HOME as TOWN_HOME, PARK as TOWN_PARK, SEASON_COLORS };
