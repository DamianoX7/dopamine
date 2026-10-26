// The shops along the street (townmap.js lays them out): 도파민 편의점, the convenience store; 카페 몽글, the café;
// and 반짝 코인노래방, the coin karaoke. Each is a little building with its front of glass and its sign over it, and
// no roof — as the house is a doll's house, the street is a model of one: whichever way she turns it she looks in, its
// walls on her side folding down out of the way (the front stays: it is glass) — and inside, what is in such a shop:
// shelves of snacks and a wall of fridges, a counter with its till; an espresso machine, cakes under glass, little round
// tables; booths with a screen and a disco ball.
//
// A shop is built round its own middle, its front to +Z. What a shop gives back: { group, walls (the ones that fold:
// { pivot, items, out, shown, want }), doors ({ leaves, at, open, kind }), spots (where one stands, sits, waits — in the
// shop's own measure), blocks (what is in the way, for the ground's squares), glow (what lights up at night), taps }.
import * as THREE from '../vendor/three.module.min.js';
import { softDotTexture } from '../fox/kit.js';
import { Parts, V, TAU, rng, roundBox, pole, floorTexture } from './shapes.js';

const C = (hex) => new THREE.Color(hex);
const T = 0.12; //  how thick a wall is
const STUB = 0.12; // …and how much of one is left standing when it folds

/* A canvas, painted, as a texture. */
export function canvasTex(w, h, draw, { repeat = null, aniso = 8 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

/* A soft round glow (at night: a lamp, a sign) — added to the picture, nothing to light. */
export function glowSprite(color, size, opacity = 0) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDotTexture(), color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending }));
  s.scale.setScalar(size);
  s.renderOrder = 8;
  return s;
}

/* Glass: clear, a little blue, a sheen. */
export const GLASS = new THREE.MeshStandardMaterial({ color: '#dff1ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.16, depthWrite: false });
GLASS.userData.shared = true;

/*
 * The shell of a shop: its floor, three walls that fold (back, left, right), and its front — glass panes between slim
 * frames, the door (sliding or swinging) and the sign band over them. `o`: { w, d, h, wall (colour), inside (colour),
 * floor (texture), door: { u, w, kind: 'slide' | 'swing' }, sign (texture), frame (colour), band (height of the sign) }.
 */
function shell(o) {
  const g = new THREE.Group();
  const { w, d, h } = o;
  const walls = [];
  const P = new Parts();
  // the floor (a little proud of the pavement), its tiles or boards
  const floor = new THREE.Mesh(roundBox(w, 0.06, d, 0.02), new THREE.MeshStandardMaterial({ map: o.floor, roughness: 0.7 }));
  floor.position.y = 0.03;
  floor.receiveShadow = true;
  g.add(floor);
  const wallMat = new THREE.MeshStandardMaterial({ color: o.wall, roughness: 0.85 });
  const inMat = new THREE.MeshStandardMaterial({ color: o.inside || o.wall, roughness: 0.9 });
  const trimMat = new THREE.MeshStandardMaterial({ color: o.trim || '#ffffff', roughness: 0.6 });
  // the walls that fold: back, left, right — on a pivot at their foot, as the house's
  const mk = (name, len, at, yaw, out) => {
    const pivot = new THREE.Group();
    pivot.position.copy(at);
    pivot.rotation.y = yaw;
    const geo = new THREE.BoxGeometry(len, h, T);
    geo.translate(0, h / 2, -T / 2);
    const mesh = new THREE.Mesh(geo, [wallMat, wallMat, wallMat, wallMat, inMat, wallMat]);
    mesh.castShadow = mesh.receiveShadow = true;
    pivot.add(mesh);
    // a skirting board inside, a cap along the top
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(len - 0.02, 0.08, 0.02), trimMat);
    skirt.position.set(0, 0.1, 0.01);
    pivot.add(skirt);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(len + 0.02, 0.05, T + 0.04), trimMat);
    cap.position.set(0, h + 0.025, -T / 2);
    pivot.add(cap);
    const items = new THREE.Group();
    g.add(pivot, items);
    const wall = { name, pivot, items, out, shown: 1, want: 1, len };
    walls.push(wall);
    return wall;
  };
  // (each faces into the shop: its inside face is the box's +Z face, turned by `yaw`)
  mk('back', w + 2 * T, V(0, 0.06, -d / 2), 0, V(0, 0, -1));
  mk('left', d, V(-w / 2, 0.06, 0), Math.PI / 2, V(-1, 0, 0));
  mk('right', d, V(w / 2, 0.06, 0), -Math.PI / 2, V(1, 0, 0));
  // the front: posts and rails round panes of glass, the door, the band of the sign
  const front = new THREE.Group();
  front.position.set(0, 0.06, d / 2);
  g.add(front);
  const fr = o.frame || '#3a3a44';
  const doorU = o.door.u;
  const doorW = o.door.w;
  const glassTop = h - (o.band || 0.42);
  const posts = [-w / 2, doorU - doorW / 2, doorU + doorW / 2, w / 2];
  // (more posts between, every metre or so)
  const extra = [];
  for (const [a, b] of [[-w / 2, doorU - doorW / 2], [doorU + doorW / 2, w / 2]]) {
    const n = Math.max(1, Math.round((b - a) / 1.15));
    for (let i = 1; i < n; i++) extra.push(a + ((b - a) * i) / n);
  }
  const f = P.get('metal');
  for (const x of [...posts, ...extra]) f.add(new THREE.BoxGeometry(0.05, glassTop, 0.07), { at: [x, glassTop / 2, -0.03], color: fr });
  f.add(new THREE.BoxGeometry(w + T * 2, 0.06, 0.08), { at: [0, glassTop, -0.03], color: fr });
  f.add(new THREE.BoxGeometry(w, 0.06, 0.08), { at: [0, 0.03, -0.03], color: fr });
  // the panes
  for (const [a, b] of [[-w / 2, doorU - doorW / 2], [doorU + doorW / 2, w / 2]]) {
    if (b - a < 0.05) continue;
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(b - a, glassTop - 0.06), GLASS);
    pane.position.set((a + b) / 2, glassTop / 2 + 0.03, -0.03);
    pane.renderOrder = 3;
    front.add(pane);
  }
  // the sign band over it all: the shop's colour, its sign on it
  const bandH = h - glassTop;
  const band = new THREE.Mesh(roundBox(w + T * 2 + 0.04, bandH, 0.1, 0.02), [new THREE.MeshStandardMaterial({ color: o.bandColor || o.wall, roughness: 0.6 })]);
  band.position.set(0, glassTop + bandH / 2, -0.02);
  band.castShadow = true;
  front.add(band);
  let signMat = null;
  if (o.sign) {
    signMat = new THREE.MeshStandardMaterial({ map: o.sign, roughness: 0.5, emissive: '#ffffff', emissiveMap: o.sign, emissiveIntensity: 0 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(o.signW || w * 0.8, bandH * 0.82), signMat);
    sign.position.set(o.signU || 0, glassTop + bandH / 2, 0.035);
    front.add(sign);
  }
  // the door: two panes that slide apart, or one that swings in
  const doors = [];
  const leaves = [];
  const doorGroup = new THREE.Group();
  doorGroup.position.set(doorU, 0, -0.03);
  front.add(doorGroup);
  const dh = glassTop - 0.06;
  if (o.door.kind === 'slide') {
    for (const s of [-1, 1]) {
      const leaf = new THREE.Group();
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(doorW / 2, dh), GLASS);
      pane.renderOrder = 3;
      pane.position.y = dh / 2 + 0.03;
      leaf.add(pane);
      const rim = new Parts();
      rim.get('metal').add(new THREE.BoxGeometry(doorW / 2, 0.04, 0.03), { at: [0, 0.05, 0], color: fr });
      rim.get('metal').add(new THREE.BoxGeometry(doorW / 2, 0.04, 0.03), { at: [0, dh + 0.01, 0], color: fr });
      rim.get('metal').add(new THREE.BoxGeometry(0.03, dh, 0.03), { at: [s * (doorW / 4 - 0.015), dh / 2 + 0.03, 0], color: fr });
      rim.bake(leaf);
      leaf.position.x = s * (doorW / 4);
      leaf.userData = { side: s, x0: s * (doorW / 4) };
      doorGroup.add(leaf);
      leaves.push(leaf);
    }
  } else {
    const hinge = new THREE.Group();
    hinge.position.x = -doorW / 2;
    const leaf = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(doorW - 0.08, dh - 0.1), GLASS);
    pane.renderOrder = 3;
    pane.position.set(doorW / 2, dh / 2 + 0.03, 0);
    leaf.add(pane);
    const rim = new Parts();
    const m = rim.get('wood');
    for (const [x, y, ww, hh] of [[doorW / 2, 0.05, doorW, 0.06], [doorW / 2, dh + 0.01, doorW, 0.06], [0.02, dh / 2 + 0.03, 0.04, dh], [doorW - 0.02, dh / 2 + 0.03, 0.04, dh]]) m.add(new THREE.BoxGeometry(ww, hh, 0.04), { at: [x, y, 0], color: o.doorColor || fr });
    rim.get('metal').add(new THREE.CylinderGeometry(0.012, 0.012, 0.3, 8), { at: [doorW - 0.1, dh * 0.5, 0.05], color: '#e9c26a' });
    rim.bake(leaf);
    hinge.add(leaf);
    hinge.userData = { swing: true };
    doorGroup.add(hinge);
    leaves.push(hinge);
  }
  doors.push({ leaves, kind: o.door.kind, open: 0, want: 0, local: V(doorU, 0, d / 2), w: doorW });
  P.bake(front);
  front.traverse((m) => {
    if (m.isMesh && m.material !== GLASS) m.castShadow = true;
  });
  return { group: g, walls, doors, front, glassTop, signMat };
}

/* Shelves of things in boxes and bags — rows of colour on each shelf. */
function stock(b, rnd, x0, x1, y, z, depth, facing = 1, palette = null) {
  const colors = palette || ['#ff8fb2', '#ffd23f', '#7fb6ff', '#7fd6a8', '#ff9f5a', '#c9a6ff', '#ffffff', '#e8473a', '#5aa850', '#f2b8d0'];
  let x = x0 + 0.01;
  while (x < x1 - 0.06) {
    const kind = rnd();
    const w = kind < 0.4 ? rnd.range(0.06, 0.09) : kind < 0.75 ? rnd.range(0.05, 0.07) : rnd.range(0.035, 0.045);
    const h = kind < 0.4 ? rnd.range(0.1, 0.16) : kind < 0.75 ? rnd.range(0.08, 0.12) : rnd.range(0.1, 0.14);
    const c = rnd.pick(colors);
    if (kind < 0.75) b.add(new THREE.BoxGeometry(w, h, depth * rnd.range(0.6, 0.9)), { at: [x + w / 2, y + h / 2, z], color: [c, '#' + C(c).lerp(C('#ffffff'), 0.25).getHexString()] });
    else b.add(new THREE.CylinderGeometry(w / 2, w / 2, h, 10), { at: [x + w / 2, y + h / 2, z], color: [c, '#' + C(c).lerp(C('#ffffff'), 0.35).getHexString()] });
    x += w + 0.008;
  }
}

/* A chair (wooden, for the café) — a stool (for the window counter). */
function chair(P, at, yaw, kind = 'chair', color = '#c48c58') {
  const m = new THREE.Matrix4().compose(V(...at), new THREE.Quaternion().setFromAxisAngle(V(0, 1, 0), yaw), V(1, 1, 1));
  const add = (part, geo, o) => {
    const local = new THREE.Matrix4().compose(V(...(o.at || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot || [0, 0, 0]))), V(1, 1, 1));
    P.get(part).add(geo, { matrix: m.clone().multiply(local), color: o.color });
  };
  if (kind === 'stool') {
    add('metal', new THREE.CylinderGeometry(0.02, 0.02, 0.46, 8), { at: [0, 0.25, 0], color: '#c6c7d2' });
    add('metal', new THREE.CylinderGeometry(0.13, 0.15, 0.02, 16), { at: [0, 0.03, 0], color: '#c6c7d2' });
    add('metal', new THREE.TorusGeometry(0.1, 0.008, 6, 16), { at: [0, 0.2, 0], rot: [Math.PI / 2, 0, 0], color: '#c6c7d2' });
    add('gloss', new THREE.CylinderGeometry(0.14, 0.14, 0.05, 18), { at: [0, 0.5, 0], color: color });
    return;
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add('wood', new THREE.CylinderGeometry(0.014, 0.018, 0.42, 6), { at: [sx * 0.15, 0.21, sz * 0.15], color });
  add('wood', roundBox(0.38, 0.04, 0.38, 0.015), { at: [0, 0.44, 0], color });
  add('fabric', roundBox(0.34, 0.03, 0.34, 0.015), { at: [0, 0.475, 0], color: '#ffd0de' });
  add('wood', roundBox(0.38, 0.32, 0.03, 0.012), { at: [0, 0.62, -0.18], color });
}

/* A round table on one leg. */
function roundTable(P, at, r = 0.3, h = 0.52, top = '#fbf6f0') {
  P.get('metal').add(new THREE.CylinderGeometry(0.025, 0.025, h, 8), { at: [at[0], h / 2, at[2]], color: '#3a3a44' });
  P.get('metal').add(new THREE.CylinderGeometry(0.16, 0.18, 0.02, 16), { at: [at[0], 0.01, at[2]], color: '#3a3a44' });
  P.get('gloss').add(new THREE.CylinderGeometry(r, r, 0.035, 26), { at: [at[0], h, at[2]], color: top });
}

// ================================================================== 도파민 편의점

export const STORE = { w: 5.6, d: 4.0, h: 2.15 };

/** The convenience store: glass in front, a till by the door, two islands of snacks, a wall of fridges, ice cream in a
 *  chest, hot water and a microwave at the back, and a counter along the window with two stools to eat at. */
export function buildStore() {
  const { w, d, h } = STORE;
  const sign = canvasTex(1024, 128, (g, W, H) => {
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#36c2a6');
    grad.addColorStop(1, '#22a58c');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    g.fillStyle = '#ff8fb2';
    g.fillRect(0, H * 0.82, W, H * 0.18);
    g.fillStyle = '#ffffff';
    g.textBaseline = 'middle';
    g.font = '700 74px Jua, sans-serif';
    g.textAlign = 'left';
    g.fillText('도파민 편의점', 150, H * 0.43);
    // its mark: a round 24 in a heart's colours
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.arc(78, H * 0.43, 46, 0, TAU);
    g.fill();
    g.fillStyle = '#ff6f9c';
    g.font = '700 50px Fredoka, Jua, sans-serif';
    g.textAlign = 'center';
    g.fillText('24', 78, H * 0.45);
    g.textAlign = 'right';
    g.font = '600 34px Fredoka, Jua, sans-serif';
    g.fillStyle = '#e9fff9';
    g.fillText('DOPAMINE 24', W - 28, H * 0.43);
  });
  const floor = canvasTex(256, 256, (g, W, H) => {
    g.fillStyle = '#e9e6ea';
    g.fillRect(0, 0, W, H);
    const n = 4;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        g.fillStyle = (i + j) % 2 ? '#f7f5f8' : '#f1eef3';
        g.fillRect((i * W) / n + 2, (j * H) / n + 2, W / n - 4, H / n - 4);
      }
  }, { repeat: [w * 1.2, d * 1.2] });
  const s = shell({ w, d, h, wall: '#f7fbfa', inside: '#fbfdfc', trim: '#36c2a6', floor, door: { u: 1.2, w: 0.92, kind: 'slide' }, sign, signW: w * 0.94, band: 0.4, bandColor: '#22a58c', frame: '#5a6170' });
  const g = s.group;
  const P = new Parts();
  const rnd = rng(101);
  const blocks = [];
  // a mint stripe round the inside, at shoulder height
  for (const wall of s.walls) {
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(wall.len - 0.04, 0.08, 0.01), new THREE.MeshStandardMaterial({ color: '#7fd6c4', roughness: 0.6 }));
    stripe.position.set(0, 1.25, 0.006);
    wall.pivot.add(stripe);
  }
  // ---- the wall of fridges, along the back
  const fx0 = -2.72;
  const fx1 = 0.92;
  const fz = -d / 2 + 0.26;
  const F = P.get('paint');
  F.add(roundBox(fx1 - fx0, 1.6, 0.5, 0.02), { at: [(fx0 + fx1) / 2, 0.86, -d / 2 + 0.25], color: ['#e4e8ee', '#f8fafc'] });
  const fridgeIn = P.get('bright');
  const nDoors = 4;
  for (let i = 0; i < nDoors; i++) {
    const x0 = fx0 + 0.05 + ((fx1 - fx0 - 0.1) * i) / nDoors;
    const x1 = fx0 + 0.05 + ((fx1 - fx0 - 0.1) * (i + 1)) / nDoors;
    // its lit inside, the shelves, the bottles
    fridgeIn.add(new THREE.BoxGeometry(x1 - x0 - 0.03, 1.32, 0.02), { at: [(x0 + x1) / 2, 0.86, fz - 0.17], color: '#eef8ff' });
    for (let k = 0; k < 4; k++) {
      const y = 0.26 + k * 0.32;
      P.get('metal').add(new THREE.BoxGeometry(x1 - x0 - 0.03, 0.015, 0.36), { at: [(x0 + x1) / 2, y, fz - 0.01], color: '#c6c7d2' });
      let x = x0 + 0.03;
      while (x < x1 - 0.06) {
        const c = rnd.pick(['#ffd23f', '#ff8fb2', '#7fb6ff', '#7fd6a8', '#ffffff', '#f5c94a', '#e8473a', '#c9a6ff', '#6b3a22']);
        const bh = rnd.range(0.14, 0.24);
        const r = rnd.range(0.025, 0.034);
        P.get('gloss').add(new THREE.CylinderGeometry(r * 0.55, r, bh, 10), { at: [x + r, y + 0.008 + bh / 2, fz + 0.05], color: [c, '#' + C(c).lerp(C('#ffffff'), 0.4).getHexString()] });
        P.get('gloss').add(new THREE.CylinderGeometry(r * 0.45, r * 0.45, 0.03, 8), { at: [x + r, y + 0.008 + bh + 0.015, fz + 0.05], color: '#ffffff' });
        x += r * 2 + 0.012;
      }
    }
    P.get('metal').add(new THREE.BoxGeometry(0.03, 1.4, 0.04), { at: [x0, 0.86, fz + 0.2], color: '#9aa0ae' });
  }
  const fridgeGlass = new THREE.Mesh(new THREE.PlaneGeometry(fx1 - fx0 - 0.1, 1.38), GLASS);
  fridgeGlass.position.set((fx0 + fx1) / 2, 0.86, fz + 0.22);
  fridgeGlass.renderOrder = 3;
  g.add(fridgeGlass);
  blocks.push([fx0, fx1, -d / 2, fz + 0.24]);
  // ---- two islands of snacks
  for (const cx of [-1.52, -0.22]) {
    const z0 = -1.0;
    const z1 = 0.7;
    P.get('paint').add(roundBox(0.46, 0.1, z1 - z0, 0.02), { at: [cx, 0.11, (z0 + z1) / 2], color: '#5a6170' });
    P.get('paint').add(new THREE.BoxGeometry(0.06, 0.76, z1 - z0), { at: [cx, 0.44, (z0 + z1) / 2], color: '#f1f2f6' });
    for (const side of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const y = 0.17 + k * 0.23;
        P.get('metal').add(new THREE.BoxGeometry(0.2, 0.015, z1 - z0), { at: [cx + side * 0.13, y, (z0 + z1) / 2], color: '#e4e6ec' });
        // (the boxes stand along the shelf: build them along x, then turned to run along z)
        const b = P.get('paint');
        let z = z0 + 0.02;
        while (z < z1 - 0.06) {
          const c = rnd.pick(['#ff8fb2', '#ffd23f', '#7fb6ff', '#7fd6a8', '#ff9f5a', '#c9a6ff', '#e8473a', '#f2b8d0', '#ffffff', '#5aa850']);
          const ww = rnd.range(0.05, 0.09);
          const hh = rnd.range(0.08, 0.16);
          b.add(new THREE.BoxGeometry(rnd.range(0.1, 0.15), hh, ww), { at: [cx + side * 0.13, y + 0.008 + hh / 2, z + ww / 2], color: [c, '#' + C(c).lerp(C('#ffffff'), 0.3).getHexString()] });
          z += ww + 0.01;
        }
        // the price strip along the front of the shelf
        P.get('paint').add(new THREE.BoxGeometry(0.005, 0.02, z1 - z0), { at: [cx + side * 0.235, y - 0.005, (z0 + z1) / 2], color: '#ffe066' });
      }
    }
    blocks.push([cx - 0.26, cx + 0.26, z0, z1]);
  }
  // ---- the ice cream chest, against the left wall
  {
    const x0 = -2.76;
    const x1 = -2.28;
    const z0 = -1.15;
    const z1 = 0.15;
    P.get('paint').add(roundBox(x1 - x0, 0.52, z1 - z0, 0.03), { at: [(x0 + x1) / 2, 0.27, (z0 + z1) / 2], color: ['#e4e8ee', '#ffffff'] });
    P.get('paint').add(new THREE.BoxGeometry(0.01, 0.22, z1 - z0 - 0.1), { at: [x1 + 0.002, 0.3, (z0 + z1) / 2], color: '#7fd6c4' });
    const icy = P.get('paint');
    let z = z0 + 0.06;
    while (z < z1 - 0.08) {
      for (let x = x0 + 0.06; x < x1 - 0.06; x += 0.1) icy.add(new THREE.BoxGeometry(0.08, 0.04, 0.07), { at: [x + 0.04, 0.5, z + 0.035], rot: [0, rnd.range(-0.3, 0.3), 0], color: rnd.pick(['#ff8fb2', '#ffd23f', '#7fb6ff', '#6b3a22', '#ffffff', '#7fd6a8']) });
      z += 0.09;
    }
    const lid = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0 - 0.06, z1 - z0 - 0.06), GLASS);
    lid.rotation.x = -Math.PI / 2;
    lid.position.set((x0 + x1) / 2, 0.545, (z0 + z1) / 2);
    g.add(lid);
    blocks.push([x0, x1, z0, z1]);
  }
  // ---- the till: a counter by the door, along the right wall
  {
    const x0 = 1.82;
    const x1 = 2.32;
    const z0 = -1.05;
    const z1 = 0.95;
    P.get('paint').add(roundBox(x1 - x0, 0.6, z1 - z0, 0.02), { at: [(x0 + x1) / 2, 0.31, (z0 + z1) / 2], color: ['#e4e8ee', '#ffffff'] });
    P.get('paint').add(new THREE.BoxGeometry(0.012, 0.32, z1 - z0 - 0.12), { at: [x0 - 0.002, 0.33, (z0 + z1) / 2], color: '#36c2a6' });
    P.get('gloss').add(roundBox(x1 - x0 + 0.06, 0.04, z1 - z0 + 0.04, 0.012), { at: [(x0 + x1) / 2, 0.63, (z0 + z1) / 2], color: '#f6f2ec' });
    // the till (its screen to the clerk), the card reader, sweets in a rack at the front of it
    P.get('dark').add(roundBox(0.22, 0.14, 0.2, 0.02), { at: [2.1, 0.72, -0.05] });
    P.get('bright').add(new THREE.BoxGeometry(0.01, 0.12, 0.17), { at: [2.215, 0.83, -0.05], rot: [0, 0, 0.35], color: '#9fe8ff' });
    P.get('paint').add(roundBox(0.03, 0.15, 0.18, 0.01), { at: [2.2, 0.83, -0.05], rot: [0, 0, 0.35], color: '#3a3a44' });
    P.get('paint').add(roundBox(0.08, 0.04, 0.12, 0.01), { at: [1.95, 0.67, 0.35], color: '#3a3a44' });
    P.get('bright').add(new THREE.BoxGeometry(0.05, 0.006, 0.05), { at: [1.95, 0.695, 0.33], color: '#7fffd0' });
    stock(P.get('paint'), rnd, -0.25, 0.25, 0.65, 0, 0.06);
    const rack = P.get('paint');
    for (let k = 0; k < 3; k++) for (let i = 0; i < 4; i++) rack.add(new THREE.BoxGeometry(0.06, 0.04, 0.05), { at: [1.88, 0.67 + k * 0.05, 0.62 + i * 0.07], color: rnd.pick(['#ff8fb2', '#ffd23f', '#7fb6ff', '#7fd6a8', '#c9a6ff']) });
    // a box of fish cakes in their broth, steaming (from the autumn on)
    P.get('metal').add(roundBox(0.3, 0.12, 0.26, 0.015), { at: [2.05, 0.71, -0.72], color: '#c6c7d2' });
    P.get('paint').add(new THREE.BoxGeometry(0.26, 0.01, 0.22), { at: [2.05, 0.77, -0.72], color: '#c98a4a' });
    for (let i = 0; i < 6; i++) pole(P.get('wood'), [1.95 + (i % 3) * 0.1, 0.76, -0.8 + Math.floor(i / 3) * 0.14], [1.97 + (i % 3) * 0.1, 0.95, -0.82 + Math.floor(i / 3) * 0.14], 0.005, '#e9d2a6', 5);
    blocks.push([x0, x1 + 0.3, z0, z1]);
  }
  // ---- hot water and a microwave, on a little table at the back right
  {
    const x0 = 1.3;
    const x1 = 2.25;
    const z0 = -1.95;
    const z1 = -1.55;
    P.get('paint').add(roundBox(x1 - x0, 0.62, z1 - z0, 0.02), { at: [(x0 + x1) / 2, 0.32, (z0 + z1) / 2], color: '#f1f2f6' });
    P.get('paint').add(roundBox(0.42, 0.24, 0.3, 0.02), { at: [1.55, 0.76, -1.76], color: '#f6f2ec' });
    P.get('dark').add(new THREE.BoxGeometry(0.26, 0.17, 0.01), { at: [1.5, 0.76, -1.605] });
    P.get('paint').add(roundBox(0.06, 0.17, 0.012, 0.004), { at: [1.7, 0.76, -1.605], color: '#c6c7d2' });
    // the hot water: a tall white urn, its red tap
    P.get('gloss').add(roundBox(0.24, 0.42, 0.24, 0.04), { at: [2.04, 0.85, -1.76], color: ['#e4e8ee', '#ffffff'] });
    P.get('gloss').add(roundBox(0.06, 0.05, 0.06, 0.01), { at: [2.04, 0.74, -1.62], color: '#e8473a' });
    P.get('bright').add(new THREE.BoxGeometry(0.09, 0.03, 0.005), { at: [2.04, 0.98, -1.637], color: '#ffcf4a' });
    blocks.push([x0, x1, z0, z1]);
  }
  // ---- the counter along the window, its two stools
  {
    const x0 = -2.7;
    const x1 = -0.45;
    P.get('wood').add(roundBox(x1 - x0, 0.04, 0.32, 0.012), { at: [(x0 + x1) / 2, 0.82, d / 2 - 0.24], color: ['#c48c58', '#e0b381'] });
    for (const x of [x0 + 0.08, x1 - 0.08]) P.get('metal').add(new THREE.BoxGeometry(0.04, 0.8, 0.04), { at: [x, 0.42, d / 2 - 0.3], color: '#c6c7d2' });
    blocks.push([x0, x1, d / 2 - 0.4, d / 2]);
  }
  chair(P, [-2.05, 0, 1.28], 0, 'stool', '#36c2a6');
  chair(P, [-1.1, 0, 1.28], 0, 'stool', '#ff8fb2');
  blocks.push([-2.2, -1.9, 1.13, 1.43], [-1.25, -0.95, 1.13, 1.43]);
  // ---- a poster on the right wall: 1+1
  const poster = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.66),
    new THREE.MeshStandardMaterial({
      map: canvasTex(200, 264, (c, W, H) => {
        c.fillStyle = '#ffe14d';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#e8343c';
        c.font = '700 84px Fredoka, Jua, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('1+1', W / 2, H * 0.36);
        c.font = '700 34px Jua, sans-serif';
        c.fillStyle = '#3a2a40';
        c.fillText('바나나 우유', W / 2, H * 0.66);
        c.fillText('삼각김밥', W / 2, H * 0.82);
      }),
      roughness: 0.6,
    })
  );
  poster.position.set(0.45, 1.35, -d / 2 + 0.07);
  s.walls[0].items.add(poster);
  P.bake(g);
  g.traverse((m) => {
    if (m.isMesh && m.material !== GLASS && !m.material.transparent) m.receiveShadow = true;
  });
  const spots = {
    door: V(1.2, 0, d / 2), //                    (the middle of the doorway)
    outside: V(1.2, 0, d / 2 + 0.7),
    inside: V(1.2, 0, d / 2 - 0.55),
    till: { at: V(1.42, 0, 0.0), yaw: Math.PI / 2, face: V(2.1, 0.75, 0) }, //   where she stands to pay
    clerk: { at: V(2.6, 0, 0.0), yaw: -Math.PI / 2 }, //                       …and the clerk, behind it
    browse: [
      { at: V(-0.88, 0, -1.2), face: V(-0.88, 0.85, -1.9), line: 'store_fridge' },
      { at: V(-0.87, 0, -0.15), face: V(-1.5, 0.45, -0.15), line: 'store_snack' },
      { at: V(0.42, 0, -0.35), face: V(-0.2, 0.45, -0.35), line: 'store_snack' },
      { at: V(-1.98, 0, -0.5), face: V(-2.55, 0.5, -0.5), line: 'store_ice' },
    ],
    water: { at: V(2.04, 0, -1.22), face: V(2.04, 0.75, -1.7) },
    micro: { at: V(1.55, 0, -1.22), face: V(1.55, 0.75, -1.7) },
    stools: [
      { at: V(-2.05, 0, 1.28), yaw: 0, h: 0.52 },
      { at: V(-1.1, 0, 1.28), yaw: 0, h: 0.52 },
    ],
    counterTop: 0.84,
  };
  return { ...s, spots, blocks, kind: 'store' };
}

// ================================================================== 카페 몽글

export const CAFE = { w: 4.0, d: 3.8, h: 2.0 };

/** The café: cream walls, wood under foot, a striped awning, the counter at the back with its espresso machine and a
 *  case of cakes, the menu on the wall over it, two little round tables. */
export function buildCafe() {
  const { w, d, h } = CAFE;
  const sign = canvasTex(1024, 160, (g, W, H) => {
    g.fillStyle = '#7a5038';
    g.fillRect(0, 0, W, H);
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(${i % 2 ? '255,230,200' : '60,30,20'}, 0.05)`;
      g.fillRect(0, (i * H) / 14, W, H / 14);
    }
    g.fillStyle = '#fff3e4';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 86px Jua, sans-serif';
    g.fillText('카페 몽글 ☁', W / 2, H * 0.5);
    g.font = '600 28px Fredoka, Jua, sans-serif';
    g.fillStyle = '#ffd0de';
    g.fillText('COFFEE · DESSERT', W / 2, H * 0.88);
  });
  const s = shell({ w, d, h, wall: '#fff1e6', inside: '#fff7ef', trim: '#ffb3c9', floor: floorTexture('herring').clone(), door: { u: 1.15, w: 0.82, kind: 'swing' }, sign, signW: w * 0.82, band: 0.42, bandColor: '#7a5038', frame: '#7a5038', doorColor: '#7a5038' });
  s.group.children[0].material.map.repeat.set(w + 0.3, d + 0.3);
  s.group.children[0].material.map.needsUpdate = true;
  const g = s.group;
  const P = new Parts();
  const rnd = rng(131);
  const blocks = [];
  // wainscot: pink below, cream above, a rail between
  for (const wall of s.walls) {
    const low = new THREE.Mesh(new THREE.BoxGeometry(wall.len - 0.04, 0.7, 0.012), new THREE.MeshStandardMaterial({ color: '#ffd6e2', roughness: 0.8 }));
    low.position.set(0, 0.42, 0.007);
    wall.pivot.add(low);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(wall.len - 0.04, 0.035, 0.03), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }));
    rail.position.set(0, 0.78, 0.015);
    wall.pivot.add(rail);
  }
  // ---- the counter at the back
  {
    const x0 = -0.55;
    const x1 = 1.88;
    const z0 = -1.5;
    const z1 = -1.02;
    P.get('wood').add(roundBox(x1 - x0, 0.64, z1 - z0, 0.02), { at: [(x0 + x1) / 2, 0.34, (z0 + z1) / 2], color: ['#8e5b3b', '#ad7652'] });
    for (let i = 0; i < 8; i++) P.get('wood').add(new THREE.BoxGeometry(0.012, 0.56, 0.01), { at: [x0 + 0.15 + i * 0.3, 0.34, z1 + 0.002], color: '#7a4a2e' });
    P.get('gloss').add(roundBox(x1 - x0 + 0.06, 0.04, z1 - z0 + 0.06, 0.012), { at: [(x0 + x1) / 2, 0.68, (z0 + z1) / 2], color: '#fbf6f0' });
    // the espresso machine: steel, its pink panels, two cups waiting under it
    P.get('metal').add(roundBox(0.5, 0.36, 0.34, 0.03), { at: [1.35, 0.88, -1.3], color: '#d9dbe2' });
    P.get('gloss').add(roundBox(0.44, 0.12, 0.01, 0.01), { at: [1.35, 0.98, -1.125], color: '#ff9cbc' });
    for (const x of [1.24, 1.46]) {
      P.get('metal').add(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 10), { at: [x, 0.78, -1.17], color: '#3a3a44' });
      P.get('gloss').add(new THREE.CylinderGeometry(0.028, 0.022, 0.05, 12), { at: [x, 0.725, -1.16], color: '#ffffff' });
    }
    P.get('metal').add(new THREE.CylinderGeometry(0.06, 0.07, 0.32, 12), { at: [0.85, 0.86, -1.32], color: '#3a3a44' });
    P.get('gloss').add(new THREE.CylinderGeometry(0.08, 0.05, 0.12, 12), { at: [0.85, 1.07, -1.32], color: '#f2e6da' });
    // the cups, stacked; a jar of straws
    for (let i = 0; i < 5; i++) P.get('gloss').add(new THREE.CylinderGeometry(0.035, 0.028, 0.03, 12), { at: [1.75, 0.715 + i * 0.026, -1.3], color: '#ffffff' });
    P.get('gloss').add(new THREE.CylinderGeometry(0.04, 0.04, 0.1, 12), { at: [0.55, 0.75, -1.2], color: '#cfe8ff' });
    for (let i = 0; i < 6; i++) pole(P.get('gloss'), [0.53 + (i % 3) * 0.02, 0.72, -1.21 + Math.floor(i / 3) * 0.02], [0.52 + (i % 3) * 0.025, 0.88, -1.22 + Math.floor(i / 3) * 0.03], 0.004, i % 2 ? '#ff7fa8' : '#3d6b4f', 5);
    // the case of cakes, under glass
    P.get('wood').add(roundBox(0.7, 0.05, 0.42, 0.01), { at: [-0.18, 0.72, -1.26], color: '#fbf6f0' });
    const cakes = [['#ffd0de', '#ff6f9c'], ['#6b3a22', '#ffffff'], ['#fff3dc', '#ffd23f'], ['#c9e8b0', '#7fae55']];
    cakes.forEach(([a, b], i) => {
      const x = -0.42 + i * 0.16;
      P.get('paint').add(new THREE.CylinderGeometry(0.055, 0.055, 0.07, 3, 1, false, 0, TAU / 6), { at: [x, 0.78, -1.26], rot: [0, -0.5, 0], color: [a, a] });
      P.get('paint').add(new THREE.SphereGeometry(0.014, 8, 6), { at: [x + 0.01, 0.825, -1.24], color: b });
    });
    const dome = new THREE.Mesh(roundBox(0.72, 0.2, 0.44, 0.04), GLASS);
    dome.position.set(-0.18, 0.84, -1.26);
    dome.renderOrder = 3;
    g.add(dome);
    blocks.push([x0, x1, -d / 2, z1]);
  }
  // ---- the menu, on the wall over the counter
  const menu = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 0.62),
    new THREE.MeshStandardMaterial({
      map: canvasTex(600, 248, (c, W, H) => {
        c.fillStyle = '#2f3a34';
        c.fillRect(0, 0, W, H);
        c.strokeStyle = '#c9a27a';
        c.lineWidth = 10;
        c.strokeRect(5, 5, W - 10, H - 10);
        c.fillStyle = '#fff8ea';
        c.textAlign = 'left';
        c.textBaseline = 'middle';
        c.font = '700 34px Jua, sans-serif';
        c.fillText('MENU ☁', 26, 36);
        c.font = '600 27px Jua, sans-serif';
        const items = ['아이스 아메리카노', '딸기 라떼 🍓', '녹차 라떼', '핫초코', '크로플'];
        items.forEach((t, i) => c.fillText(t, 30 + (i > 2 ? 290 : 0), 88 + (i % 3) * 50));
        c.fillStyle = '#ffb3c9';
        c.font = '600 22px Jua, sans-serif';
        c.fillText('오늘의 추천: 딸기 라떼', 300, 213);
      }),
      roughness: 0.8,
    })
  );
  menu.position.set(0.7, 1.42, -d / 2 + 0.07);
  s.walls[0].items.add(menu);
  // ---- a shelf of mugs on the left wall, a plant in the corner, pictures
  const shelfP = new Parts();
  shelfP.get('wood').add(roundBox(0.9, 0.04, 0.2, 0.01), { at: [-w / 2 + 0.11, 1.25, -0.3], rot: [0, Math.PI / 2, 0], color: ['#c48c58', '#e0b381'] });
  ['#ff9cbc', '#ffffff', '#9fd9c6', '#ffd23f', '#c9a6ff'].forEach((c, i) => shelfP.get('gloss').add(new THREE.CylinderGeometry(0.04, 0.036, 0.08, 12), { at: [-w / 2 + 0.12, 1.31, -0.66 + i * 0.18], color: c }));
  shelfP.bake(s.walls[1].items);
  const plant = new Parts();
  plant.get('gloss').add(new THREE.CylinderGeometry(0.13, 0.1, 0.26, 14), { at: [-1.72, 0.19, -1.62], color: '#ffffff' });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * TAU;
    plant.get('leaf').add(new THREE.SphereGeometry(0.11, 8, 6), { at: [-1.72 + Math.cos(a) * 0.08, 0.48 + (i % 3) * 0.1, -1.62 + Math.sin(a) * 0.08], scale: [1, 0.5, 0.7], rot: [0, a, 0.5], color: ['#3f8a4c', '#7cc56c'] });
  }
  plant.bake(g);
  blocks.push([-1.9, -1.5, -1.85, -1.4]);
  // ---- two little round tables, their chairs
  roundTable(P, [-1.15, 0, -0.1]);
  chair(P, [-1.15, 0, -0.56], 0, 'chair');
  chair(P, [-1.15, 0, 0.36], Math.PI, 'chair');
  roundTable(P, [0.15, 0, 0.75]);
  chair(P, [0.15, 0, 0.29], 0, 'chair');
  chair(P, [0.61, 0, 0.75], -Math.PI / 2, 'chair');
  blocks.push([-1.47, -0.83, -0.42, 0.22], [-1.35, -0.95, -0.76, -0.36], [-1.35, -0.95, 0.16, 0.56], [-0.17, 0.47, 0.43, 1.07], [-0.05, 0.35, 0.09, 0.49], [0.41, 0.81, 0.55, 0.95]);
  // little things on the tables: a vase, a candle
  P.get('gloss').add(new THREE.CylinderGeometry(0.03, 0.025, 0.09, 10), { at: [-1.05, 0.585, -0.02], color: '#cfe8ff' });
  P.get('paint').add(new THREE.SphereGeometry(0.03, 8, 6), { at: [-1.05, 0.65, -0.02], color: '#ff8fb2' });
  P.get('gloss').add(new THREE.CylinderGeometry(0.025, 0.025, 0.05, 10), { at: [0.25, 0.565, 0.82], color: '#fff3dc' });
  P.bake(g);
  // ---- the striped awning over the front
  const awn = canvasTex(256, 64, (c, W, H) => {
    for (let i = 0; i < 8; i++) {
      c.fillStyle = i % 2 ? '#ffffff' : '#ff8fb2';
      c.fillRect((i * W) / 8, 0, W / 8, H);
    }
  });
  const awning = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.2, 0.55, 1, 1), new THREE.MeshStandardMaterial({ map: awn, roughness: 0.8, side: THREE.DoubleSide }));
  awning.rotation.x = -Math.PI / 2 + 0.55;
  awning.position.set(0, h - 0.42 - 0.08, d / 2 + 0.27);
  awning.castShadow = true;
  g.add(awning);
  // its scalloped edge
  const scallops = new Parts();
  for (let i = 0; i < 12; i++) scallops.get('fabric').add(new THREE.CircleGeometry(0.09, 10, 0, Math.PI), { at: [-w / 2 - 0.1 + (i + 0.5) * ((w + 0.2) / 12), h - 0.42 - 0.08 - 0.24, d / 2 + 0.5], rot: [0, 0, Math.PI], color: i % 2 ? '#ffffff' : '#ff8fb2' });
  scallops.bake(g);
  g.traverse((m) => {
    if (m.isMesh && m.material !== GLASS && !m.material.transparent) m.receiveShadow = true;
  });
  const spots = {
    door: V(1.15, 0, d / 2),
    outside: V(1.15, 0, d / 2 + 0.7),
    inside: V(1.15, 0, d / 2 - 0.55),
    order: { at: V(1.15, 0, -0.62), yaw: Math.PI, face: V(1.15, 0.8, -1.3) }, // (at the counter)
    barista: { at: V(1.15, 0, -1.72), yaw: 0 },
    machine: { at: V(1.35, 0, -1.72), yaw: Math.PI, face: V(1.35, 0.85, -1.3) },
    pickup: V(1.55, 0.72, -1.1),
    seats: [
      { at: V(-1.15, 0, -0.56), yaw: 0, h: 0.48, table: V(-1.15, 0.54, -0.1) },
      { at: V(0.15, 0, 0.29), yaw: 0, h: 0.48, table: V(0.15, 0.54, 0.75) },
    ],
  };
  return { ...s, spots, blocks, kind: 'cafe' };
}

// ================================================================== 반짝 코인노래방

export const KARAOKE = { w: 3.6, d: 3.8, h: 2.3 };

/** The coin karaoke: dark glass and a neon sign; a little lobby with the coin machine; two booths behind it, each with a
 *  screen, a sofa, a disco ball, lights in every colour. Shut (its shutter down) until the day it opens. */
export function buildKaraoke() {
  const { w, d, h } = KARAOKE;
  const sign = canvasTex(1024, 192, (g, W, H) => {
    g.fillStyle = '#1b1530';
    g.fillRect(0, 0, W, H);
    const neon = (text, x, y, size, color, glow) => {
      g.font = `700 ${size}px Jua, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.shadowColor = glow;
      g.shadowBlur = 26;
      g.fillStyle = color;
      g.fillText(text, x, y);
      g.shadowBlur = 0;
      g.fillStyle = '#ffffff';
      g.globalAlpha = 0.55;
      g.fillText(text, x, y);
      g.globalAlpha = 1;
    };
    neon('반짝 코인노래방', W * 0.55, H * 0.42, 86, '#ff5fa2', '#ff3d8f');
    neon('🎤', W * 0.1, H * 0.45, 90, '#7ff3ff', '#3fd8ff');
    g.font = '600 32px Fredoka, Jua, sans-serif';
    g.fillStyle = '#7ff3ff';
    g.textAlign = 'center';
    g.fillText('1곡 5코인 · 24H', W * 0.55, H * 0.82);
  });
  const floor = canvasTex(128, 128, (c, W, H) => {
    c.fillStyle = '#2a2140';
    c.fillRect(0, 0, W, H);
    const rnd = rng(7);
    for (let i = 0; i < 40; i++) {
      c.fillStyle = rnd.pick(['#ff5fa2', '#7ff3ff', '#ffd23f', '#9b7bff']);
      c.globalAlpha = 0.5;
      c.beginPath();
      c.arc(rnd() * W, rnd() * H, rnd.range(1, 3), 0, TAU);
      c.fill();
    }
    c.globalAlpha = 1;
  }, { repeat: [w, d] });
  const s = shell({ w, d, h, wall: '#2b2446', inside: '#3a2f5c', trim: '#ff5fa2', floor, door: { u: -0.9, w: 0.8, kind: 'swing' }, sign, signW: w * 0.92, band: 0.5, bandColor: '#1b1530', frame: '#1b1530', doorColor: '#1b1530' });
  s.signMat.emissiveIntensity = 0.6;
  const g = s.group;
  const P = new Parts();
  const rnd = rng(151);
  const blocks = [];
  const BOOTH = 0.35; // (the booths' front wall: z)
  // ---- the partitions: a wall across, with two doors; a wall between the two booths
  const part = new THREE.MeshStandardMaterial({ color: '#3a2f5c', roughness: 0.8 });
  const ph = 1.75;
  const across = (x0, x1) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, ph, 0.08), part);
    m.position.set((x0 + x1) / 2, 0.06 + ph / 2, BOOTH);
    m.castShadow = m.receiveShadow = true;
    g.add(m);
  };
  across(-w / 2, -1.25);
  across(-0.55, 0.55);
  across(1.25, w / 2);
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.08, ph, BOOTH + d / 2), part);
  mid.position.set(0, 0.06 + ph / 2, (BOOTH - d / 2) / 2);
  mid.castShadow = mid.receiveShadow = true;
  g.add(mid);
  blocks.push([-w / 2, -1.25, BOOTH - 0.08, BOOTH + 0.08], [-0.55, 0.55, BOOTH - 0.08, BOOTH + 0.08], [1.25, w / 2, BOOTH - 0.08, BOOTH + 0.08], [-0.06, 0.06, -d / 2, BOOTH]);
  // the booths' doors (always a little open: the light from inside spills out)
  for (const x of [-0.9, 0.9]) {
    const hinge = new THREE.Group();
    hinge.position.set(x - 0.35, 0.06, BOOTH);
    const leaf = new Parts();
    leaf.get('paint').add(roundBox(0.68, 1.6, 0.04, 0.01), { at: [0.35, 0.8, 0], color: '#1b1530' });
    leaf.get('bright').add(new THREE.BoxGeometry(0.2, 0.36, 0.045), { at: [0.35, 1.2, 0], color: '#ff9fd0' });
    leaf.bake(hinge);
    hinge.rotation.y = x < 0 ? 0.9 : -0.35;
    g.add(hinge);
  }
  // ---- inside each booth: the screen, a sofa, a little table, the disco ball, lights
  const screens = [];
  for (const sx of [-1, 1]) {
    const cx = sx * 0.9;
    // the screen on the back wall, its lyrics (painted again when a song is on: town.js)
    const sc = document.createElement('canvas');
    sc.width = 512;
    sc.height = 288;
    const tex = new THREE.CanvasTexture(sc);
    tex.colorSpace = THREE.SRGBColorSpace;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.62), new THREE.MeshBasicMaterial({ map: tex }));
    scr.position.set(cx, 1.2, -d / 2 + 0.075);
    g.add(scr);
    P.get('dark').add(roundBox(1.18, 0.7, 0.04, 0.02), { at: [cx, 1.2, -d / 2 + 0.05] });
    screens.push({ canvas: sc, tex, mesh: scr });
    // the sofa along the outer wall
    const sofaX = sx * (w / 2 - 0.2);
    P.get('fabric').add(roundBox(0.34, 0.3, 1.5, 0.06), { at: [sofaX, 0.21, -0.85], color: sx < 0 ? '#ff5fa2' : '#7f6bff' });
    P.get('fabric').add(roundBox(0.12, 0.42, 1.5, 0.05), { at: [sofaX + sx * 0.13, 0.48, -0.85], color: sx < 0 ? '#e0448a' : '#6a56e8' });
    blocks.push([sofaX - 0.2, sofaX + 0.2, -1.62, -0.08]);
    // the table, a tambourine, the songbook
    P.get('gloss').add(roundBox(0.36, 0.04, 0.6, 0.012), { at: [sx * 1.1, 0.4, -0.9], color: '#ffffff' });
    P.get('metal').add(new THREE.CylinderGeometry(0.03, 0.03, 0.36, 8), { at: [sx * 1.1, 0.2, -0.9], color: '#c6c7d2' });
    P.get('paint').add(new THREE.TorusGeometry(0.06, 0.012, 6, 18), { at: [sx * 1.1, 0.43, -0.75], rot: [Math.PI / 2, 0, 0], color: '#ffd23f' });
    P.get('paint').add(roundBox(0.14, 0.02, 0.2, 0.005), { at: [sx * 1.08, 0.43, -1.05], color: '#7ff3ff' });
    blocks.push([sx * 1.1 - 0.2, sx * 1.1 + 0.2, -1.22, -0.58]);
    // neon strips round the top of the walls
    P.get('bright').add(new THREE.BoxGeometry(1.6, 0.025, 0.02), { at: [cx, 1.72, -d / 2 + 0.08], color: sx < 0 ? '#ff5fa2' : '#7ff3ff' });
    P.get('bright').add(new THREE.BoxGeometry(0.02, 0.025, 2.2), { at: [sx * (w / 2 - 0.08), 1.72, -0.75], color: sx < 0 ? '#7ff3ff' : '#ff5fa2' });
  }
  // the disco balls (they turn: town.js)
  const balls = [];
  for (const sx of [-1, 1]) {
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 1), new THREE.MeshStandardMaterial({ color: '#f2f2ff', roughness: 0.15, metalness: 0.9, flatShading: true }));
    ball.position.set(sx * 0.9, 1.62, -0.75);
    ball.castShadow = false;
    g.add(ball);
    balls.push(ball);
  }
  // ---- the lobby: the coin machine, a little sofa, posters
  P.get('paint').add(roundBox(0.42, 1.1, 0.34, 0.03), { at: [1.4, 0.61, 0.62], color: '#ff5fa2' });
  P.get('bright').add(new THREE.BoxGeometry(0.3, 0.24, 0.01), { at: [1.4, 0.92, 0.795], color: '#bff8ff' });
  P.get('metal').add(roundBox(0.16, 0.06, 0.02, 0.01), { at: [1.4, 0.62, 0.795], color: '#ffd23f' });
  blocks.push([1.15, 1.65, 0.42, 0.82]);
  P.get('fabric').add(roundBox(0.9, 0.3, 0.36, 0.06), { at: [0.2, 0.21, 0.62], color: '#7f6bff' });
  blocks.push([-0.3, 0.7, 0.42, 0.82]);
  P.bake(g);
  g.traverse((m) => {
    if (m.isMesh && m.material !== GLASS && !m.material.transparent && m.material.type !== 'MeshBasicMaterial') m.receiveShadow = true;
  });
  // ---- the shutter, down until it opens
  const shutter = new THREE.Group();
  const corr = canvasTex(64, 128, (c, W, H) => {
    for (let i = 0; i < 16; i++) {
      const grad = c.createLinearGradient(0, (i * H) / 16, 0, ((i + 1) * H) / 16);
      grad.addColorStop(0, '#c9ccd6');
      grad.addColorStop(0.5, '#eef0f5');
      grad.addColorStop(1, '#a9adba');
      c.fillStyle = grad;
      c.fillRect(0, (i * H) / 16, W, H / 16);
    }
  }, { repeat: [1, 3] });
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.1, h - 0.5), new THREE.MeshStandardMaterial({ map: corr, roughness: 0.5, metalness: 0.3 }));
  sheet.position.set(0, (h - 0.5) / 2 + 0.06, d / 2 + 0.05);
  shutter.add(sheet);
  const note = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.8),
    new THREE.MeshStandardMaterial({
      map: canvasTex(360, 240, (c, W, H) => {
        c.fillStyle = '#fffaf0';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#ff5fa2';
        c.fillRect(0, 0, W, 56);
        c.fillStyle = '#ffffff';
        c.font = '700 34px Jua, sans-serif';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText('🎤 OPEN 예정', W / 2, 30);
        c.fillStyle = '#3a2a40';
        c.font = '700 40px Jua, sans-serif';
        c.fillText('10월 31일', W / 2, 112);
        c.font = '600 26px Jua, sans-serif';
        c.fillText('조금만 기다려 주세요!', W / 2, 176);
      }),
      roughness: 0.7,
    })
  );
  note.position.set(0.3, 0.95, d / 2 + 0.06);
  note.rotation.z = -0.04;
  shutter.add(note);
  shutter.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  g.add(shutter);
  const spots = {
    door: V(-0.9, 0, d / 2),
    outside: V(-0.9, 0, d / 2 + 0.7),
    inside: V(-0.9, 0, d / 2 - 0.55),
    kiosk: { at: V(1.4, 0, 1.05), yaw: Math.PI, face: V(1.4, 0.9, 0.8) },
    boothDoor: V(-0.9, 0, BOOTH + 0.3),
    booth: { at: V(-0.75, 0, -0.55), yaw: 0 }, //   (she sings facing out, the screen behind her)
    sofa: { at: V(-(w / 2 - 0.2) + 0.15, 0, -0.85), yaw: Math.PI / 2, h: 0.38 },
  };
  return { ...s, spots, blocks, kind: 'karaoke', screens, balls, shutter, booth: BOOTH };
}

export { T as WALL_T, STUB };
