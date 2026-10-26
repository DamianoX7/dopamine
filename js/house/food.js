// What the courier brings (courier.js) and what she eats it with. Each dish is something she holds in her hand as she
// eats it — at her palm, upright whatever her arm does (person.js, hold) — with a mark where it goes to her mouth (`bite`:
// the straw, the top strawberry, the tip of the slice), how many mouthfuls it is, and `left(k)`: how much of it is left
// (1 … 0: the tea goes down the cup, the strawberries come off the stick one by one, the soup goes down the bowl). A dish
// in a bowl is held in her left hand and eaten with chopsticks or a pick in her right (`utensil`; its `tip` goes into the
// bowl at `top`, and up to her mouth with a mouthful on it).
//
// Also the paper bag it comes in, and her phone to order it with. At the girls' measure — one unit tall (me.js) — and
// in the frame of the hand that holds it: +Y up, +Z the way she faces, the origin at her palm.
import * as THREE from '../vendor/three.module.min.js';
import { Batch, MAT, V, TAU, rng, paintTexture, heart } from './shapes.js';
import { piece, mark, clear, bowlGeometry, eatAway } from './dishkit.js';
import { SNACKS } from './snacks.js';
import { MEALS } from './meals.js';

const C = (hex) => new THREE.Color(hex);

// ------------------------------------------------------------------ the dishes

/** 🧋 A brown-sugar bubble tea: clear cup, the tea and its syrup streaks, black pearls, a domed lid, a fat pink straw. */
function bubbletea() {
  const object = new THREE.Group();
  const cup = new THREE.Group();
  cup.position.set(0, -0.02, 0.034); // (her hand round its middle: the cup a little in front)
  object.add(cup);
  const H = 0.092;
  const R0 = 0.021;
  const R1 = 0.027;
  // the tea, as high as it is full (its streaks of syrup painted down the inside of the cup)
  const streaks = paintTexture(128, (g, S) => {
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#e9c9a0');
    grad.addColorStop(0.55, '#d8a874');
    grad.addColorStop(1, '#8a4f2a');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    const rnd = rng(7);
    for (let i = 0; i < 9; i++) {
      const x = rnd() * S;
      g.strokeStyle = `rgba(110, 58, 28, ${rnd.range(0.35, 0.7)})`;
      g.lineWidth = rnd.range(3, 7);
      g.beginPath();
      g.moveTo(x, S);
      g.bezierCurveTo(x + rnd.range(-20, 20), S * 0.6, x + rnd.range(-25, 25), S * 0.4, x + rnd.range(-30, 30), S * rnd.range(0.05, 0.35));
      g.stroke();
    }
  });
  const teaGeo = new THREE.CylinderGeometry(R1 * 0.93, R0 * 0.93, H * 0.82, 20);
  teaGeo.translate(0, (H * 0.82) / 2, 0); // (its foot at 0: it is made shorter from the top)
  const tea = new THREE.Mesh(teaGeo, new THREE.MeshStandardMaterial({ map: streaks, roughness: 0.4 }));
  tea.position.y = -H / 2 + 0.003;
  cup.add(tea);
  // the pearls, at the bottom
  const pearls = [];
  const rnd = rng(3);
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU;
    const r = rnd.range(0, R0 * 0.72);
    const m = piece(new THREE.SphereGeometry(0.0062, 8, 6), '#2b1a14', { at: [Math.cos(a) * r, -H / 2 + 0.008 + (i > 8 ? 0.009 : 0) + rnd() * 0.004, Math.sin(a) * r], mat: 'gloss' });
    cup.add(m);
    pearls.push(m);
  }
  // the cup, its sleeve with a heart, the lid
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R1, R0, H, 24, 1, true), clear(0.32));
  cup.add(shell);
  const base = piece(new THREE.CircleGeometry(R0, 20), '#f4eee8', { at: [0, -H / 2, 0], rot: [Math.PI / 2, 0, 0] });
  cup.add(base);
  const sleeve = piece(new THREE.CylinderGeometry(R1 * 0.985 + 0.0012, R0 * 1.02 + 0.0012, H * 0.34, 24, 1, true), '#ffb3cb', { at: [0, -H * 0.06, 0] });
  cup.add(sleeve);
  const logo = piece(heart(0.016, 0.002), '#ffffff', { at: [0, -H * 0.06, R1 * 0.93 + 0.0035], scale: 1 });
  cup.add(logo);
  const lid = new THREE.Mesh(new THREE.SphereGeometry(R1 * 1.04, 22, 8, 0, TAU, 0, Math.PI / 2), clear(0.38));
  lid.scale.y = 0.55;
  lid.position.y = H / 2;
  cup.add(lid);
  cup.add(piece(new THREE.TorusGeometry(R1 * 1.03, 0.0018, 5, 26), '#ffffff', { at: [0, H / 2, 0], rot: [Math.PI / 2, 0, 0], mat: 'gloss' }));
  // the straw: through the lid, a little to one side, leaning
  const straw = piece(new THREE.CylinderGeometry(0.0052, 0.0052, H * 1.12, 10), ['#ff6f9c', '#ff8fb2'], { at: [0.004, H * 0.32, -0.002], rot: [0.12, 0, -0.08], mat: 'gloss' });
  cup.add(straw);
  const bite = mark(0.004 + 0.05 * 0.08, H * 0.32 + (H * 1.12) / 2 - 0.004, 0.006);
  cup.add(bite);
  return {
    object,
    style: 'sip',
    bites: 6,
    bite,
    left(k) {
      tea.scale.y = Math.max(0.02, k);
      tea.visible = k > 0.01;
      eatAway(pearls, Math.min(1, k * 1.6)); // (the last sips are the pearls)
    },
  };
}

/** 🍓 Strawberry tanghulu: four candied strawberries on a stick, glassy with sugar. */
function tanghulu() {
  const object = new THREE.Group();
  const stick = new THREE.Group();
  stick.position.set(0, 0, 0.012);
  stick.rotation.x = -0.28; // (leaning towards her)
  object.add(stick);
  stick.add(piece(new THREE.CylinderGeometry(0.0026, 0.0026, 0.19, 6), '#e9d2a6', { at: [0, 0.055, 0], mat: 'wood' }));
  const berries = [];
  for (let i = 0; i < 4; i++) {
    const y = 0.052 + i * 0.028;
    const g = new THREE.SphereGeometry(0.0148, 14, 10);
    // (a strawberry: rounder at the shoulder, narrower at the tip)
    const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) {
      const yy = p.getY(j);
      const k = 1 - Math.max(0, yy / 0.0148) * 0.28;
      p.setX(j, p.getX(j) * k);
      p.setZ(j, p.getZ(j) * k);
      p.setY(j, yy * 1.15);
    }
    g.computeVertexNormals();
    const berry = piece(g, (q) => C('#ff3a55').lerp(C('#c4142f'), Math.max(0, -q.y / 0.017) * 0.5 + (Math.sin(q.x * 900) * Math.sin(q.z * 900) > 0.6 ? 0.25 : 0)), { at: [0, y, 0], rot: [Math.PI, i * 1.3, 0], mat: 'gloss' });
    stick.add(berry);
    berries.push(berry);
  }
  const bite = mark(0, 0.136, 0.006);
  stick.add(bite);
  return {
    object,
    style: 'stick',
    bites: 4,
    bite,
    left(k) {
      eatAway(berries, k);
      const n = berries.filter((b) => b.visible).length;
      bite.position.y = 0.052 + Math.max(0, n - 1) * 0.028; // (the top one that is left)
    },
  };
}

/** 🍗 A fried drumstick: golden and craggy, held by its bone. */
function chicken() {
  const object = new THREE.Group();
  const leg = new THREE.Group();
  leg.position.set(0, -0.004, 0.014);
  leg.rotation.x = -0.42; // (the meat leaning towards her)
  object.add(leg);
  leg.add(piece(new THREE.CylinderGeometry(0.0055, 0.0065, 0.05, 8), '#f6eadc', { at: [0, 0.0, 0] }));
  for (const s of [-1, 1]) leg.add(piece(new THREE.SphereGeometry(0.0075, 8, 6), '#fbf3ea', { at: [s * 0.005, -0.026, 0] }));
  // the meat: a lumpy egg of batter
  const g = new THREE.IcosahedronGeometry(0.03, 2);
  const p = g.attributes.position;
  const rnd = rng(11);
  const bumps = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    if (!bumps.has(key)) bumps.set(key, 1 + rnd.range(-0.07, 0.1));
    const k = bumps.get(key);
    const y = p.getY(i);
    const narrow = y < 0 ? 1 + (y / 0.03) * 0.35 : 1; // (narrowing down to the bone)
    p.setXYZ(i, p.getX(i) * k * narrow, y * k * 1.5, p.getZ(i) * k * narrow * 0.92);
  }
  g.computeVertexNormals();
  const meat = piece(g, (q, n) => C('#c26a22').lerp(C('#efb257'), 0.35 + 0.4 * Math.max(0, n.y) + (Math.sin(q.x * 700 + q.y * 500) > 0.5 ? 0.15 : 0)), { at: [0, 0.062, 0], mat: 'paint', flat: true });
  leg.add(meat);
  const bite = mark(0, 0.088, 0.008);
  leg.add(bite);
  return {
    object,
    style: 'hand',
    bites: 4,
    bite,
    left(k) {
      const s = 0.4 + 0.6 * k;
      meat.scale.set(s, 0.5 + 0.5 * k, s);
      meat.position.y = 0.032 + 0.03 * k;
      meat.visible = k > 0.01;
      bite.position.y = 0.04 + 0.048 * k;
    },
  };
}

/** 🍕 A slice of pepperoni pizza, the tip up and over towards her mouth. */
function pizza() {
  const object = new THREE.Group();
  const slice = new THREE.Group();
  slice.position.set(0, 0.0, 0.016);
  slice.rotation.x = -1.05; // (lying back: the cheese up, the tip away from her hand)
  object.add(slice);
  const L = 0.115;
  const W = 0.078;
  const shape = new THREE.Shape();
  shape.moveTo(-W / 2, 0);
  shape.quadraticCurveTo(0, -0.008, W / 2, 0);
  shape.lineTo(0, L);
  shape.closePath();
  const dough = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.0015, bevelSize: 0.0015, bevelSegments: 1 });
  dough.translate(0, 0, -0.006);
  const top = new THREE.ExtrudeGeometry(shape, { depth: 0.0018, bevelEnabled: false });
  top.scale(0.9, 0.92, 1);
  top.translate(0, 0.006, 0.0002);
  const b = new Batch();
  b.add(dough, { color: '#e8b56a' });
  b.add(top, { color: (q) => C('#ffd25e').lerp(C('#ffe9a8'), Math.sin(q.x * 400) * Math.sin(q.y * 300) > 0.3 ? 0.6 : 0) });
  b.add(new THREE.CylinderGeometry(0.0072, 0.0072, W * 1.02, 10).rotateZ(Math.PI / 2).translate(0, -0.001, -0.001), { color: ['#c98a45', '#e3ad66'] });
  for (const [x, y] of [[-0.014, 0.022], [0.016, 0.03], [0, 0.058], [-0.004, 0.085]]) b.add(new THREE.CylinderGeometry(0.0085, 0.0085, 0.0016, 14).rotateX(Math.PI / 2).translate(x, y, 0.0028), { color: '#c8423c' });
  const mesh = b.mesh(MAT.paint);
  slice.add(mesh);
  const bite = mark(0, L * 0.82, 0.004);
  slice.add(bite);
  return {
    object,
    style: 'hand',
    bites: 4,
    bite,
    left(k) {
      const s = 0.38 + 0.62 * k;
      mesh.scale.set(1, s, 1); // (eaten from the tip down)
      mesh.visible = k > 0.01;
      bite.position.y = L * 0.82 * s;
    },
  };
}

/** 🌶️ Tteokbokki in a green snack-bar bowl: rice cakes and fish cakes in red sauce, half a boiled egg, spring onion. */
function tteokbokki() {
  const object = new THREE.Group();
  const bowl = new THREE.Group();
  bowl.position.set(0, 0.012, 0.022);
  object.add(bowl);
  const profile = [[0.0, 0.0], [0.038, 0.0], [0.05, 0.006], [0.058, 0.024], [0.06, 0.027], [0.055, 0.026], [0.046, 0.009], [0.034, 0.006], [0.0, 0.006]];
  bowl.add(piece(bowlGeometry(profile), (q, n) => (n.y > 0.4 && q.y > 0.004 ? C('#e6f5ea') : C('#4fae6e')), { mat: 'gloss' }));
  // the pattern round the rim (that green melamine has)
  bowl.add(piece(new THREE.TorusGeometry(0.0575, 0.0016, 4, 40), '#ffffff', { at: [0, 0.0262, 0], rot: [Math.PI / 2, 0, 0], mat: 'gloss' }));
  const sauce = piece(new THREE.CircleGeometry(0.05, 28), '#e0452c', { rot: [-Math.PI / 2, 0, 0], mat: 'gloss' });
  bowl.add(sauce);
  const items = [];
  const rnd = rng(5);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU;
    const r = rnd.range(0.008, 0.034);
    const m = piece(new THREE.CapsuleGeometry(0.0062, 0.022, 3, 8), ['#f06a46', '#f7a283'], { at: [Math.cos(a) * r, 0.02 + rnd() * 0.004, Math.sin(a) * r], rot: [Math.PI / 2 + rnd.range(-0.3, 0.3), 0, rnd() * TAU], mat: 'gloss' });
    items.push(m);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.6;
    const g = new THREE.CylinderGeometry(0.014, 0.014, 0.003, 3);
    items.push(piece(g, '#f0c58e', { at: [Math.cos(a) * 0.026, 0.022, Math.sin(a) * 0.026], rot: [0.3, rnd() * TAU, 0.2], flat: true }));
  }
  // half a boiled egg, cut side up
  const egg = new THREE.Group();
  egg.add(piece(new THREE.SphereGeometry(0.012, 12, 8, 0, TAU, Math.PI / 2, Math.PI / 2), '#fffaf2', { scale: [1, 0.9, 1.3] }));
  egg.add(piece(new THREE.CircleGeometry(0.012, 16), '#fffaf2', { at: [0, 0.0003, 0], rot: [-Math.PI / 2, 0, 0], scale: [1, 1.3, 1] }));
  egg.add(piece(new THREE.CircleGeometry(0.0062, 14), '#ffc93a', { at: [0, 0.0008, 0], rot: [-Math.PI / 2, 0, 0] }));
  egg.position.set(-0.012, 0.024, -0.014);
  items.push(egg);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * TAU;
    const r = rnd.range(0, 0.04);
    items.push(piece(new THREE.CylinderGeometry(0.0022, 0.0022, 0.002, 6), '#58b04f', { at: [Math.cos(a) * r, 0.0255, Math.sin(a) * r] }));
  }
  items.forEach((m) => bowl.add(m));
  const top = mark(0, 0.02, 0);
  bowl.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'pick',
    morsel: 'cake',
    bites: 7,
    top,
    left(k) {
      eatAway(items, k);
      sauce.position.y = 0.008 + 0.01 * k;
    },
  };
}

/** 🍜 Malatang in a takeaway bowl: red chilli broth glinting with oil, noodles, bok choy, mushrooms, fish balls, tofu skin. */
function malatang() {
  const object = new THREE.Group();
  const bowl = new THREE.Group();
  bowl.position.set(0, 0.01, 0.024);
  object.add(bowl);
  const profile = [[0.0, 0.0], [0.036, 0.0], [0.04, 0.003], [0.055, 0.042], [0.058, 0.046], [0.054, 0.045], [0.04, 0.008], [0.03, 0.005], [0.0, 0.005]];
  bowl.add(piece(bowlGeometry(profile), (q) => (q.y > 0.038 ? C('#e8344f') : C('#fbf7f2')), { mat: 'gloss' }));
  const oil = paintTexture(128, (g, S) => {
    g.fillStyle = '#c8301c';
    g.fillRect(0, 0, S, S);
    const rnd = rng(9);
    for (let i = 0; i < 70; i++) {
      g.fillStyle = rnd() < 0.7 ? `rgba(255, 150, 60, ${rnd.range(0.35, 0.8)})` : `rgba(90, 10, 5, ${rnd.range(0.3, 0.6)})`;
      g.beginPath();
      g.arc(rnd() * S, rnd() * S, rnd.range(1.5, 6), 0, TAU);
      g.fill();
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = '#f6e7c8';
      g.beginPath();
      g.ellipse(rnd() * S, rnd() * S, 1.6, 1, rnd() * TAU, 0, TAU);
      g.fill();
    }
  });
  const soup = new THREE.Mesh(new THREE.CircleGeometry(0.052, 28), new THREE.MeshStandardMaterial({ map: oil, roughness: 0.2 }));
  soup.rotation.x = -Math.PI / 2;
  bowl.add(soup);
  const items = [];
  const rnd = rng(13);
  const at = (r0, r1, y) => {
    const a = rnd() * TAU;
    const r = rnd.range(r0, r1);
    return [Math.cos(a) * r, y, Math.sin(a) * r];
  };
  // glass noodles: loops lying in the broth
  for (let i = 0; i < 3; i++) {
    const c = at(0, 0.022, 0.041);
    const pts = [];
    for (let j = 0; j < 7; j++) pts.push(V(Math.cos(j * 1.1 + i) * 0.016, Math.sin(j * 2.3) * 0.002, Math.sin(j * 1.1 + i) * 0.016));
    items.push(piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.0018, 4), '#efe2c4', { at: c, mat: 'gloss' }));
  }
  // bok choy leaves
  for (let i = 0; i < 2; i++) {
    const leaf = piece(new THREE.SphereGeometry(0.016, 10, 6), ['#f2f7e6', '#5fae4f'], { at: at(0.012, 0.03, 0.042), rot: [0.2, rnd() * TAU, Math.PI / 2], scale: [0.35, 1.25, 0.9] });
    items.push(leaf);
  }
  // fish balls, tofu skin, mushrooms
  for (let i = 0; i < 3; i++) items.push(piece(new THREE.SphereGeometry(0.0072, 10, 8), '#fbf6ee', { at: at(0.008, 0.034, 0.042) }));
  for (let i = 0; i < 2; i++) items.push(piece(new THREE.CylinderGeometry(0.005, 0.005, 0.02, 8), '#f2d79a', { at: at(0.01, 0.032, 0.043), rot: [Math.PI / 2, 0, rnd() * TAU] }));
  for (let i = 0; i < 2; i++) {
    const m = new THREE.Group();
    m.add(piece(new THREE.SphereGeometry(0.008, 10, 6, 0, TAU, 0, Math.PI / 2), '#8b5a3c', { scale: [1, 0.6, 1] }));
    m.add(piece(new THREE.CylinderGeometry(0.0025, 0.003, 0.006, 6), '#f4ead8', { at: [0, -0.003, 0] }));
    m.position.set(...at(0.012, 0.032, 0.044));
    items.push(m);
  }
  // the sesame and chilli on top
  for (let i = 0; i < 6; i++) items.push(piece(new THREE.BoxGeometry(0.004, 0.0012, 0.0025), '#a8241a', { at: at(0, 0.044, 0.0442), rot: [0, rnd() * TAU, 0] }));
  items.forEach((m) => bowl.add(m));
  const top = mark(0, 0.036, 0);
  bowl.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'chopsticks',
    morsel: 'noodles',
    bites: 8,
    top,
    left(k) {
      eatAway(items, k);
      soup.position.y = 0.012 + 0.03 * k;
      top.position.y = soup.position.y + 0.004;
      // (what floats goes down with the broth)
      items.forEach((m) => (m.position.y = Math.min(m.userData.y0 == null ? (m.userData.y0 = m.position.y) : m.userData.y0, soup.position.y + 0.004)));
    },
  };
}

const DISHES = { bubbletea, tanghulu, chicken, pizza, tteokbokki, malatang, ...SNACKS, ...MEALS };
export const FOOD_IDS = Object.keys(DISHES);

/** A dish (see above — and snacks.js, meals.js), or null if there is no such thing. `opts`: { burnt } for what she cooked. */
export function makeFood(id, opts = {}) {
  const make = DISHES[id];
  if (!make) return null;
  const f = make(opts);
  f.id = id;
  f.object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  f.left(1);
  return f;
}

/**
 * What a dish in a bowl (or on a plate) is eaten with: chopsticks, a pick, a spoon or a fork — its tip, and the mouthful
 * that goes up on it. `aim(k)`: how it points, from down into the bowl (0) to back at her mouth (1).
 */
export function makeUtensil(kind, morsel) {
  const object = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.set(0.004, -0.004, 0.006);
  object.add(holder);
  const len = kind === 'pick' ? 0.085 : kind === 'spoon' || kind === 'fork' ? 0.1 : 0.115;
  if (kind === 'pick') holder.add(piece(new THREE.CylinderGeometry(0.0022, 0.0034, len, 6), '#ff8fb2', { at: [0, len / 2 - 0.012, 0], mat: 'gloss' }));
  else if (kind === 'spoon' || kind === 'fork') {
    // a little steel spoon or fork, its handle flattened
    holder.add(piece(new THREE.BoxGeometry(0.006, len * 0.72, 0.0022), '#d9dbe2', { at: [0, len * 0.36 - 0.014, 0], mat: 'metal' }));
    if (kind === 'spoon') holder.add(piece(new THREE.SphereGeometry(0.0085, 12, 8, 0, TAU, 0, Math.PI / 2), '#e4e6ec', { at: [0, len - 0.02, 0.001], rot: [-Math.PI / 2, 0, 0], scale: [1, 1.35, 0.42], mat: 'metal' }));
    else for (let i = 0; i < 4; i++) holder.add(piece(new THREE.BoxGeometry(0.0013, 0.016, 0.0013), '#e4e6ec', { at: [(i - 1.5) * 0.0025, len - 0.022, 0], mat: 'metal' }));
  } else for (const s of [-1, 1]) holder.add(piece(new THREE.CylinderGeometry(0.0016, 0.0026, len, 6), '#dcb684', { at: [s * 0.003, len / 2 - 0.015, 0], rot: [0, 0, s * 0.03], mat: 'wood' }));
  const tip = mark(0, len - 0.015, 0);
  holder.add(tip);
  // the mouthful: noodles hanging from the chopsticks, a rice cake on the pick, a spoonful, a forkful
  const bite = new THREE.Group();
  bite.position.copy(tip.position);
  if (morsel === 'noodles') {
    for (let i = 0; i < 3; i++) {
      const pts = [V(0, 0, 0), V((i - 1) * 0.004, 0.006, 0.012), V((i - 1) * 0.006, 0.002, 0.026), V((i - 1) * 0.005, -0.004, 0.034)];
      bite.add(piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 10, 0.0016, 4), '#efe2c4', { mat: 'gloss' }));
    }
  } else if (morsel === 'rice') bite.add(piece(new THREE.SphereGeometry(0.0075, 10, 6), '#e8743a', { at: [0, -0.004, 0.003], scale: [1, 0.6, 1.2] }));
  else if (morsel === 'pudding') bite.add(piece(new THREE.SphereGeometry(0.0072, 10, 6), '#f6cf6a', { at: [0, -0.004, 0.003], scale: [1, 0.6, 1.2], mat: 'gloss' }));
  else if (morsel === 'pancake') bite.add(piece(new THREE.CylinderGeometry(0.009, 0.009, 0.007, 3), (q, n) => (Math.abs(n.y) > 0.5 ? C('#c97a2c') : C('#f2c27a')), { at: [0, 0.006, 0], rot: [Math.PI / 2, 0, 0] }));
  else if (morsel === 'roll') bite.add(piece(new THREE.CylinderGeometry(0.0095, 0.0095, 0.011, 14), '#ffcf4a', { rot: [0, 0, Math.PI / 2] }));
  else bite.add(piece(new THREE.CapsuleGeometry(0.0062, 0.02, 3, 8), ['#f06a46', '#f7a283'], { rot: [0, 0, Math.PI / 2], mat: 'gloss' }));
  bite.visible = false;
  holder.add(bite);
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const aim = (k) => (holder.rotation.x = 2.55 + (-1.3 - 2.55) * k); // (down and forward into the bowl … back and up at her mouth)
  aim(0);
  return { object, tip, bite, aim };
}

/** The paper bag it comes in: kraft paper, its top folded over and stapled, rope handles, a pink heart sticker. */
export function makeBag() {
  const object = new THREE.Group();
  const b = new Batch();
  const W = 0.07;
  const H = 0.082;
  const D = 0.044;
  b.add(new THREE.BoxGeometry(W, H, D), { at: [0, -0.026 - H / 2, 0], color: ['#b98a55', '#d6aa72'] });
  b.add(new THREE.BoxGeometry(W * 1.01, 0.012, D * 1.02), { at: [0, -0.026 - 0.006, 0], color: '#c99a62' });
  for (const s of [-1, 1]) {
    const loop = new THREE.TorusGeometry(0.016, 0.0016, 4, 14, Math.PI);
    loop.translate(0, -0.026, s * 0.012);
    b.add(loop, { color: '#f4ead8' });
  }
  object.add(b.mesh(MAT.paint));
  const sticker = piece(heart(0.022, 0.002), '#ff7fa8', { at: [0, -0.026 - H * 0.48, D / 2 + 0.0016], mat: 'gloss' });
  object.add(sticker);
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { object };
}

/** Her phone: pink, its screen lit (the delivery app), held up before her to order. */
export function makePhone() {
  const object = new THREE.Group();
  const phone = new THREE.Group();
  phone.position.set(0, 0.03, 0.018);
  phone.rotation.x = -0.55; // (its screen turned up towards her face)
  object.add(phone);
  phone.add(piece(new THREE.BoxGeometry(0.034, 0.064, 0.0065), '#ff9ec0', { mat: 'gloss' }));
  const screen = paintTexture(64, (g, S) => {
    g.fillStyle = '#fff7fa';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#ff7fa8';
    g.fillRect(0, 0, S, S * 0.22);
    g.fillStyle = '#ffd3e2';
    for (let i = 0; i < 3; i++) g.fillRect(S * 0.12, S * (0.32 + i * 0.22), S * 0.76, S * 0.15);
  });
  const glassFace = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.058), new THREE.MeshBasicMaterial({ map: screen }));
  glassFace.position.z = -0.0034; // (the screen faces her: away from the way she faces)
  glassFace.rotation.y = Math.PI;
  phone.add(glassFace);
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { object };
}
