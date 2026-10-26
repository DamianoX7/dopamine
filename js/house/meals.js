// What she cooks herself in the little kitchen (js/town.js has the recipes): what is on the hob while she cooks — the
// yellow aluminium pot for noodles and stew, the frying pan for the rest, and what goes into them a step at a time —
// what she holds as she drops it in (an egg, a block of noodles, a slice of ham…), the bowl she beats eggs or batter in,
// and what comes out of it in the end, on a plate or in a bowl, to be eaten as the courier's dishes are (food.js): at
// her palm, a mark to her mouth or a bowl's top for the spoon, `bites`, `left(k)`.
//
// The dishes can come out burnt (or, noodles left too long, swollen): `makeMeal(id, { burnt: true })`.
//
// The cookware stands on the hob in the room's own measure (1.3 = her height). The dishes are at the girls' measure, in
// the frame of the hand that holds them (as food.js).
import * as THREE from '../vendor/three.module.min.js';
import { V, TAU, rng, paintTexture } from './shapes.js';
import { softDotTexture } from '../fox/kit.js';
import { piece, mark, bowlGeometry, eatAway } from './dishkit.js';

const C = (hex) => new THREE.Color(hex);
const CHAR = C('#2a1a12');
/* (a colour, or burnt: its own darkened towards char) */
const burn = (hex, burnt, k = 0.62) => (burnt ? '#' + C(hex).lerp(CHAR, k).getHexString() : hex);

/* A material of its own (for what changes colour as it cooks). */
const own = (color, roughness = 0.5) => new THREE.MeshStandardMaterial({ color, roughness });

/* A plate or a bowl, held in her left hand: `kind` 'plate' (flat, wide), 'bowl' (deep), 'dish' (shallow). */
function crockery(kind, rim = '#ff9cbc') {
  const g = new THREE.Group();
  const prof =
    kind === 'plate'
      ? [[0, 0], [0.04, 0], [0.046, 0.003], [0.062, 0.011], [0.066, 0.014], [0.062, 0.0125], [0.044, 0.005], [0, 0.005]]
      : kind === 'dish'
        ? [[0, 0], [0.034, 0], [0.04, 0.004], [0.056, 0.02], [0.06, 0.023], [0.055, 0.022], [0.04, 0.008], [0, 0.007]]
        : [[0, 0], [0.032, 0], [0.036, 0.004], [0.052, 0.034], [0.056, 0.04], [0.052, 0.039], [0.036, 0.009], [0, 0.008]];
  const top = prof[4][1];
  g.add(piece(bowlGeometry(prof, 30), (q, n) => (q.y > top - 0.0025 && n.y > 0.2 ? C(rim) : C('#fbf8f4')), { mat: 'gloss' }));
  return { group: g, top, r: prof[4][0] };
}

// ------------------------------------------------------------------ the dishes she cooks

/** 🍜 Ramen with an egg: noodles in red broth, the egg's yolk, spring onion, a slice of the seaweed it came with. */
function ramen({ burnt = false } = {}) {
  const object = new THREE.Group();
  const bowl = new THREE.Group();
  bowl.position.set(0, 0.008, 0.026);
  object.add(bowl);
  const c = crockery('bowl', '#e8574a');
  bowl.add(c.group);
  // (left too long, the noodles swell and the broth is gone into them)
  const swollen = burnt;
  const broth = piece(new THREE.CircleGeometry(0.05, 28), swollen ? '#c96a3c' : '#d9472c', { rot: [-Math.PI / 2, 0, 0], mat: 'gloss' });
  const level = swollen ? 0.024 : 0.032;
  broth.position.y = level;
  bowl.add(broth);
  const items = [];
  const rnd = rng(61);
  for (let i = 0; i < 5; i++) {
    const pts = [];
    for (let j = 0; j < 9; j++) pts.push(V(Math.cos(j * 0.8 + i * 1.3) * 0.03, Math.sin(j * 2.3 + i) * 0.003, Math.sin(j * 0.8 + i * 1.3) * 0.03));
    items.push(piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, swollen ? 0.0034 : 0.0022, 4), swollen ? '#f2dca0' : '#f4d27a', { at: [rnd.range(-0.006, 0.006), broth.position.y + 0.002, rnd.range(-0.006, 0.006)], mat: 'gloss' }));
  }
  // the egg: its white set round a soft yolk
  const egg = new THREE.Group();
  egg.add(piece(new THREE.CircleGeometry(0.019, 18), '#fffaf2', { rot: [-Math.PI / 2, 0, 0], scale: [1, 1.2, 1] }));
  egg.add(piece(new THREE.SphereGeometry(0.0085, 12, 8, 0, TAU, 0, Math.PI / 2), '#ffb21f', { at: [0, 0.0006, 0], scale: [1, 0.55, 1], mat: 'gloss' }));
  egg.position.set(0.012, broth.position.y + 0.004, -0.008);
  items.push(egg);
  for (let i = 0; i < 8; i++) {
    const a = rnd() * TAU;
    const r = rnd.range(0, 0.042);
    items.push(piece(new THREE.CylinderGeometry(0.0024, 0.0024, 0.0016, 8), '#4fae4a', { at: [Math.cos(a) * r, broth.position.y + 0.004, Math.sin(a) * r] }));
  }
  items.forEach((m) => {
    m.userData.y0 = m.position.y;
    bowl.add(m);
  });
  const top = mark(0, broth.position.y, 0);
  bowl.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'chopsticks',
    morsel: 'noodles',
    bites: 7,
    top,
    left(k) {
      eatAway(items, k);
      broth.position.y = 0.01 + (level - 0.01) * (0.2 + 0.8 * k);
      top.position.y = broth.position.y;
      items.forEach((m) => (m.position.y = Math.min(m.userData.y0, broth.position.y + 0.003)));
    },
  };
}

/** 🍳 Kimchi fried rice: a mound of red-orange rice with kimchi through it, a fried egg on top, sesame, seaweed. */
function friedrice({ burnt = false } = {}) {
  const object = new THREE.Group();
  const dish = new THREE.Group();
  dish.position.set(0, 0.008, 0.026);
  object.add(dish);
  const c = crockery('dish', '#7fbfe0');
  dish.add(c.group);
  // the rice: a lumpy dome, flecked with kimchi (and, burnt, with black)
  const g = new THREE.SphereGeometry(0.044, 22, 12, 0, TAU, 0, Math.PI / 2);
  const p = g.attributes.position;
  const rnd = rng(67);
  const lumps = new Map();
  for (let i = 0; i < p.count; i++) {
    const key = `${p.getX(i).toFixed(4)},${p.getY(i).toFixed(4)},${p.getZ(i).toFixed(4)}`;
    if (!lumps.has(key)) lumps.set(key, 1 + rnd.range(-0.05, 0.06));
    const k = lumps.get(key);
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.55, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  const flecks = new Map();
  const rice = piece(g, (q) => {
    const key = `${q.x.toFixed(3)},${q.z.toFixed(3)}`;
    if (!flecks.has(key)) flecks.set(key, rnd());
    const f = flecks.get(key);
    const base = C('#e8743a').lerp(C('#f2a25c'), f * 0.6);
    if (f > 0.86) base.set('#c22a1e');
    if (burnt && f < 0.35) base.lerp(CHAR, 0.85);
    return base;
  });
  rice.position.y = 0.006;
  dish.add(rice);
  const egg = new THREE.Group();
  egg.add(piece(new THREE.CircleGeometry(0.026, 22), burn('#fffaf2', burnt, 0.4), { rot: [-Math.PI / 2, 0, 0], scale: [1, 0.85, 1] }));
  egg.add(piece(new THREE.SphereGeometry(0.011, 12, 8, 0, TAU, 0, Math.PI / 2), burnt ? '#c97a1c' : '#ffb21f', { at: [0.003, 0.0008, 0.002], scale: [1, 0.6, 1], mat: 'gloss' }));
  if (burnt) egg.add(piece(new THREE.TorusGeometry(0.024, 0.003, 4, 24), '#5a3a22', { rot: [Math.PI / 2, 0, 0], scale: [1, 0.85, 1] }));
  egg.position.set(0, 0.03, 0);
  egg.rotation.x = -0.12;
  dish.add(egg);
  const bits = [];
  for (let i = 0; i < 14; i++) {
    const a = rnd() * TAU;
    const r = rnd.range(0.01, 0.036);
    const m = piece(new THREE.BoxGeometry(0.0018, 0.0012, 0.0012), i % 3 ? '#fff6dc' : '#1f2a24', { at: [Math.cos(a) * r, 0.024 + 0.006 * Math.cos(r * 40), Math.sin(a) * r], rot: [0, rnd() * TAU, 0] });
    dish.add(m);
    bits.push(m);
  }
  const top = mark(0, 0.026, 0.01);
  dish.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'spoon',
    morsel: 'rice',
    bites: 7,
    top,
    left(k) {
      const s = Math.max(0.06, k);
      rice.scale.set(0.5 + 0.5 * s, s, 0.5 + 0.5 * s);
      rice.visible = k > 0.01;
      egg.visible = k > 0.5;
      egg.position.y = 0.006 + 0.024 * s;
      eatAway(bits, k);
      top.position.y = 0.006 + 0.02 * s;
    },
  };
}

/** 🥪 A ham and cheese toast, cut corner to corner: golden bread, and egg, ham and cheese in between. */
function toast({ burnt = false } = {}) {
  const object = new THREE.Group();
  const half = new THREE.Group();
  half.position.set(0, 0.008, 0.016);
  half.rotation.x = -0.35;
  object.add(half);
  const W = 0.072;
  const tri = new THREE.Shape();
  tri.moveTo(-W / 2, 0);
  tri.lineTo(W / 2, 0);
  tri.lineTo(-W / 2, W);
  tri.closePath();
  const layers = [
    [0.0, 0.007, burn('#e3a352', burnt, 0.75), '#f6dcae'], // bread
    [0.007, 0.004, '#ffd04a', null], // egg
    [0.011, 0.003, '#f29aa6', null], // ham
    [0.014, 0.002, '#ffb83a', null], // cheese
    [0.016, 0.007, burn('#e3a352', burnt, 0.75), '#f6dcae'], // bread
  ];
  const parts = new THREE.Group();
  for (const [z, d, outside, inside] of layers) {
    const g = new THREE.ExtrudeGeometry(tri, { depth: d, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0016, bevelSegments: 2 });
    g.translate(0, 0, z - 0.0115);
    const m = piece(g, (q, n) => (inside && Math.abs(n.z) > 0.5 ? C(outside) : inside ? C(inside).lerp(C(outside), 0.25) : C(outside)), {});
    parts.add(m);
  }
  // the cut face shows the layers; burnt, the crust has black edges
  if (burnt) parts.add(piece(new THREE.BoxGeometry(W * 0.9, 0.002, 0.024), '#3a2418', { at: [0, 0.0006, 0] }));
  half.add(parts);
  const bite = mark(-W / 2 + 0.012, W - 0.016, 0.004);
  half.add(bite);
  return {
    object,
    style: 'hand',
    bites: 4,
    bite,
    left(k) {
      const s = 0.35 + 0.65 * k;
      parts.scale.set(1, s, 1);
      parts.visible = k > 0.01;
      bite.position.y = (W - 0.016) * s;
    },
  };
}

/** 🥚 Rolled omelette, sliced: rounds of yellow rolled up with spring onion and carrot in it, on a little plate. */
function eggroll({ burnt = false } = {}) {
  const object = new THREE.Group();
  const plate = new THREE.Group();
  plate.position.set(0, 0.008, 0.026);
  object.add(plate);
  const c = crockery('plate', '#ffc94a');
  plate.add(c.group);
  // each slice: a short cylinder lying on its side, a spiral painted on its faces
  const spiral = paintTexture(64, (g, S) => {
    g.fillStyle = burnt ? '#c98a3a' : '#ffd96a';
    g.fillRect(0, 0, S, S);
    g.strokeStyle = burnt ? '#7a4a1c' : '#f2b33a';
    g.lineWidth = 3;
    g.beginPath();
    for (let a = 0; a < 18; a += 0.2) {
      const r = a * 1.6;
      g.lineTo(S / 2 + Math.cos(a) * r, S / 2 + Math.sin(a) * r);
    }
    g.stroke();
    const rnd = rng(71);
    for (let i = 0; i < 9; i++) {
      g.fillStyle = i % 2 ? '#4fae4a' : '#ff8a3a';
      g.fillRect(rnd.range(10, 50), rnd.range(10, 50), 4, 4);
    }
  });
  const faceMat = new THREE.MeshStandardMaterial({ map: spiral, roughness: 0.55 });
  const skinMat = own(burnt ? '#a8642a' : '#ffcf4a', 0.5);
  const slices = [];
  // (in a row, each leaning on the one before: their cut faces, rolled up, to be seen)
  for (let i = 0; i < 5; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.0135, 0.0135, 0.012, 18), [skinMat, faceMat, faceMat]);
    m.rotation.set(Math.PI / 2 - 0.55, 0, 0);
    m.position.set(-0.036 + i * 0.018, 0.019, 0.004 - 0.002 * i);
    m.castShadow = true;
    plate.add(m);
    slices.push(m);
  }
  // a dot of ketchup
  plate.add(piece(new THREE.SphereGeometry(0.008, 10, 6, 0, TAU, 0, Math.PI / 2), '#d9233f', { at: [0.03, 0.006, -0.026], scale: [1, 0.5, 1], mat: 'gloss' }));
  const top = mark(0, 0.024, 0);
  plate.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'chopsticks',
    morsel: 'roll',
    bites: 5,
    top,
    left(k) {
      eatAway(slices, k);
      const n = slices.filter((m) => m.visible).length;
      top.position.x = n ? slices[n - 1].position.x : 0;
    },
  };
}

/** 🥞 Pancakes: a stack of three, butter melting on top and syrup running down. */
function pancake({ burnt = false } = {}) {
  const object = new THREE.Group();
  const plate = new THREE.Group();
  plate.position.set(0, 0.008, 0.026);
  object.add(plate);
  const c = crockery('plate', '#9fd9c6');
  plate.add(c.group);
  const stack = [];
  for (let i = 0; i < 3; i++) {
    const g = new THREE.CylinderGeometry(0.036, 0.037, 0.011, 26, 1);
    const m = piece(g, (q, n) => (Math.abs(n.y) > 0.5 ? C(burn('#c97a2c', burnt, 0.7)) : C(burn('#f2c27a', burnt, 0.45))), { at: [0.002 * Math.sin(i * 2), 0.011 + i * 0.011, 0.002 * Math.cos(i * 3)], rot: [0, i, 0] });
    plate.add(m);
    stack.push(m);
  }
  const butter = piece(new THREE.BoxGeometry(0.013, 0.006, 0.013), '#ffe9a0', { at: [0, 0.047, 0], rot: [0, 0.4, 0], mat: 'gloss' });
  plate.add(butter);
  const syrup = piece(new THREE.CylinderGeometry(0.03, 0.03, 0.0015, 22), '#b5651d', { at: [0, 0.0442, 0], mat: 'gloss' });
  plate.add(syrup);
  const top = mark(0.008, 0.046, 0.008);
  plate.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'fork',
    morsel: 'pancake',
    bites: 6,
    top,
    left(k) {
      eatAway(stack, Math.min(1, k * 1.05));
      const n = stack.filter((m) => m.visible).length;
      butter.visible = syrup.visible = n === 3;
      top.position.y = 0.011 + Math.max(0, n - 1) * 0.011 + 0.006;
    },
  };
}

/** 🍲 Budae-jjigae, ladled into a bowl: red broth, ham and sausage, kimchi, noodles, a slice of cheese melting. */
function budae({ burnt = false } = {}) {
  const object = new THREE.Group();
  const bowl = new THREE.Group();
  bowl.position.set(0, 0.008, 0.026);
  object.add(bowl);
  const c = crockery('bowl', '#3a3340');
  bowl.add(c.group);
  // (boiled dry, the broth is low and dark)
  const level = burnt ? 0.02 : 0.031;
  const broth = piece(new THREE.CircleGeometry(0.05, 28), burnt ? '#8a2a14' : '#d63a22', { rot: [-Math.PI / 2, 0, 0], mat: 'gloss' });
  broth.position.y = level;
  bowl.add(broth);
  const items = [];
  const rnd = rng(73);
  for (let i = 0; i < 3; i++) {
    const pts = [];
    for (let j = 0; j < 8; j++) pts.push(V(Math.cos(j * 0.9 + i * 2) * 0.026, Math.sin(j * 2.1) * 0.003, Math.sin(j * 0.9 + i * 2) * 0.026));
    items.push(piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 26, 0.0022, 4), '#f4d27a', { at: [0, level + 0.002, 0], mat: 'gloss' }));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 0.4;
    items.push(piece(new THREE.BoxGeometry(0.018, 0.004, 0.012), '#f29aa6', { at: [Math.cos(a) * 0.026, level + 0.004, Math.sin(a) * 0.026], rot: [0.2, a, 0.1] }));
  }
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * TAU + 1.2;
    items.push(piece(new THREE.CylinderGeometry(0.006, 0.006, 0.004, 12), '#c96a4a', { at: [Math.cos(a) * 0.018, level + 0.004, Math.sin(a) * 0.018], rot: [0.3, 0, 0.2] }));
  }
  for (let i = 0; i < 3; i++) items.push(piece(new THREE.BoxGeometry(0.014, 0.002, 0.01), '#c4251c', { at: [rnd.range(-0.02, 0.02), level + 0.003, rnd.range(-0.02, 0.02)], rot: [0, rnd() * TAU, 0] }));
  // the cheese, melting over the middle
  const cheese = piece(new THREE.BoxGeometry(0.024, 0.0016, 0.024, 4, 1, 4), '#ffc23a', { at: [0, level + 0.006, 0], rot: [0, 0.6, 0], mat: 'gloss' });
  const cp = cheese.geometry.attributes.position;
  for (let i = 0; i < cp.count; i++) cp.setY(i, cp.getY(i) - 0.003 * (Math.abs(cp.getX(i)) + Math.abs(cp.getZ(i))) * 40);
  cheese.geometry.computeVertexNormals();
  items.push(cheese);
  items.forEach((m) => {
    m.userData.y0 = m.position.y;
    bowl.add(m);
  });
  const top = mark(0, level, 0);
  bowl.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'chopsticks',
    morsel: 'noodles',
    bites: 7,
    top,
    left(k) {
      eatAway(items, k);
      broth.position.y = 0.01 + (level - 0.01) * (0.25 + 0.75 * k);
      top.position.y = broth.position.y;
      items.forEach((m) => (m.position.y = Math.min(m.userData.y0, broth.position.y + 0.003)));
    },
  };
}

export const MEALS = { ramen, friedrice, toast, eggroll, pancake, budae };

// ------------------------------------------------------------------ on the hob

/*
 * What is cooking: the pot (noodles, stew) or the pan (the rest), standing on the hob with its base at y = 0, in the
 * room's measure. What is in it shows a step at a time — `stage(i)`: what has gone in by the step `i` of the recipe
 * (js/town.js: RECIPES) — and cooks: `heat(k)` (bubbles, a sizzle: 0 … 1), `done(k)` (0: raw … 1: done … 1.5: burnt).
 * `stir()` jostles it, `flip()` tosses it over (the pan). `over`: a mark above its middle, where things are dropped in.
 */
export function makeCookware(recipe) {
  const pot = recipe === 'ramen' || recipe === 'budae';
  return pot ? makePot(recipe) : makePan(recipe);
}

/* Bubbles that rise and pop in a pot, or spit in a pan: a few soft dots. */
function bubbles(n, r, y, color) {
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.15, transparent: true, opacity: 0.75 });
  const list = [];
  const rnd = rng(79);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), mat);
    const a = rnd() * TAU;
    const d = Math.sqrt(rnd()) * r;
    m.position.set(Math.cos(a) * d, y, Math.sin(a) * d);
    m.userData = { phase: rnd(), speed: rnd.range(0.7, 1.4) };
    g.add(m);
    list.push(m);
  }
  return { group: g, list, mat };
}

function makePot(recipe) {
  const object = new THREE.Group();
  const R = 0.08;
  const H = 0.075;
  // the yellow aluminium pot (양은냄비): hammered, thin, its two black handles
  const metal = new THREE.MeshStandardMaterial({ color: '#e9b947', roughness: 0.32, metalness: 0.65 });
  const prof = [[0.0, 0.0], [R - 0.008, 0.0], [R, 0.006], [R, H], [R + 0.004, H + 0.003], [R - 0.003, H], [R - 0.003, 0.005], [0.0, 0.004]];
  const body = new THREE.Mesh(bowlGeometry(prof, 32), metal);
  body.castShadow = true;
  object.add(body);
  for (const s of [-1, 1]) {
    const h = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.005, 6, 12, Math.PI), new THREE.MeshStandardMaterial({ color: '#2b2427', roughness: 0.5 }));
    h.position.set(s * (R + 0.006), H - 0.012, 0);
    h.rotation.set(0, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2);
    h.castShadow = true;
    object.add(h);
  }
  // inside: water (then broth), and what goes into it
  const soup = new THREE.Mesh(new THREE.CircleGeometry(R - 0.004, 30), own('#cfe6f2', 0.12));
  soup.rotation.x = -Math.PI / 2;
  soup.position.y = H * 0.62;
  object.add(soup);
  const water = C('#cfe6f2');
  const red = C(recipe === 'budae' ? '#d63a22' : '#d9472c');
  const things = {};
  const rnd = rng(83);
  const add = (name, mesh) => {
    mesh.visible = false;
    mesh.userData.y0 = mesh.position.y;
    object.add(mesh);
    (things[name] = things[name] || []).push(mesh);
  };
  // noodles: a tangle (first a block, as it goes in — then loosened)
  for (let i = 0; i < 5; i++) {
    const pts = [];
    for (let j = 0; j < 10; j++) pts.push(V(Math.cos(j * 0.8 + i) * 0.045, Math.sin(j * 2.3 + i) * 0.004, Math.sin(j * 0.8 + i) * 0.045));
    add('noodles', piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 32, 0.0032, 4), '#f4d27a', { at: [rnd.range(-0.01, 0.01), H * 0.62 + 0.003, rnd.range(-0.01, 0.01)], mat: 'gloss' }));
  }
  const egg = new THREE.Group();
  egg.add(piece(new THREE.CircleGeometry(0.026, 18), '#fffaf2', { rot: [-Math.PI / 2, 0, 0], scale: [1, 1.2, 1] }));
  egg.add(piece(new THREE.SphereGeometry(0.011, 12, 8, 0, TAU, 0, Math.PI / 2), '#ffb21f', { at: [0, 0.0008, 0], scale: [1, 0.55, 1], mat: 'gloss' }));
  egg.position.set(0.018, H * 0.62 + 0.006, -0.012);
  add('egg', egg);
  for (let i = 0; i < 4; i++) add('ham', piece(new THREE.BoxGeometry(0.03, 0.005, 0.02), '#f29aa6', { at: [Math.cos(i * 1.6) * 0.04, H * 0.62 + 0.004, Math.sin(i * 1.6) * 0.04], rot: [0.2, i, 0.1] }));
  for (let i = 0; i < 4; i++) add('kimchi', piece(new THREE.BoxGeometry(0.024, 0.003, 0.016), '#c4251c', { at: [Math.cos(i * 1.6 + 0.8) * 0.035, H * 0.62 + 0.003, Math.sin(i * 1.6 + 0.8) * 0.035], rot: [0, i * 1.3, 0] }));
  const cheese = piece(new THREE.BoxGeometry(0.04, 0.002, 0.04, 4, 1, 4), '#ffc23a', { at: [0, H * 0.62 + 0.009, 0], rot: [0, 0.5, 0], mat: 'gloss' });
  add('cheese', cheese);
  for (let i = 0; i < 9; i++) add('leek', piece(new THREE.CylinderGeometry(0.004, 0.004, 0.002, 8), '#4fae4a', { at: [rnd.range(-0.05, 0.05), H * 0.62 + 0.007, rnd.range(-0.05, 0.05)] }));
  const bub = bubbles(16, R - 0.016, H * 0.62, '#ffffff');
  object.add(bub.group);
  // (what has gone in by each step of the recipe: js/town.js has them in the same order)
  const STEPS = recipe === 'budae' ? [['ham', 'kimchi'], ['noodles'], ['cheese', 'leek'], []] : [['noodles'], ['egg', 'leek'], []];
  let heat = 0;
  let doneK = 0;
  let jostle = 0;
  const over = mark(0, H + 0.12, 0);
  object.add(over);
  return {
    object,
    kind: 'pot',
    over,
    stage(i) {
      for (const name in things) things[name].forEach((m) => (m.visible = STEPS.slice(0, i + 1).some((s) => s.includes(name))));
      soup.material.color.copy(water).lerp(red, i >= 0 ? 1 : 0); // (the soup in: red)
    },
    heat(k) {
      heat = k;
    },
    done(k) {
      doneK = k;
      // (too long: the broth boils away, the noodles swell)
      const extra = Math.max(0, k - 1);
      soup.position.y = H * 0.62 - extra * 0.04;
      for (const name in things) things[name].forEach((m) => (m.position.y = m.userData.y0 - extra * 0.04));
      if (things.noodles) things.noodles.forEach((m) => m.scale.set(1 + extra * 0.4, 1 + extra * 0.8, 1 + extra * 0.4));
    },
    stir() {
      jostle = 1;
    },
    flip() {
      jostle = 1;
    },
    update(dt, t) {
      jostle = Math.max(0, jostle - dt * 2.5);
      bub.list.forEach((m) => {
        const u = (t * m.userData.speed + m.userData.phase) % 1;
        const s = heat > 0.15 ? (0.002 + 0.004 * heat) * Math.sin(u * Math.PI) : 0;
        m.scale.setScalar(Math.max(1e-4, s));
        m.position.y = soup.position.y + 0.001;
      });
      for (const name in things)
        things[name].forEach((m, i) => {
          m.position.x += Math.sin(t * 9 + i) * 0.0004 * jostle;
          m.rotation.y += jostle * dt * 2;
        });
      object.userData.done = doneK;
    },
  };
}

function makePan(recipe) {
  const object = new THREE.Group();
  const R = 0.088;
  // the frying pan: black inside, a red outside, a wooden handle
  const prof = [[0.0, 0.0], [R - 0.012, 0.0], [R, 0.016], [R + 0.004, 0.026], [R + 0.001, 0.027], [R - 0.003, 0.018], [R - 0.014, 0.005], [0.0, 0.004]];
  const pan = new THREE.Mesh(bowlGeometry(prof, 32), new THREE.MeshStandardMaterial({ color: '#2d2a2e', roughness: 0.35, metalness: 0.4 }));
  pan.castShadow = true;
  object.add(pan);
  const outside = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.0035, R - 0.011, 0.025, 32, 1, true), new THREE.MeshStandardMaterial({ color: '#e05a5a', roughness: 0.4 }));
  outside.position.y = 0.0135;
  object.add(outside);
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.13, 10), new THREE.MeshStandardMaterial({ color: '#9a6a44', roughness: 0.6 }));
  handle.rotation.z = Math.PI / 2 - 0.12;
  handle.position.set(R + 0.07, 0.03, 0);
  handle.castShadow = true;
  object.add(handle);
  // what is in it: a layer for each recipe, tinted as it cooks
  const food = new THREE.Group(); // (this tosses over when it is flipped)
  food.position.y = 0.006;
  object.add(food);
  const parts = {};
  const tints = []; // [material, raw colour, cooked colour]
  const tinted = (name, geo, raw, cooked, at = [0, 0, 0], rot = [0, 0, 0]) => {
    const mat = own(raw, 0.55);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(...at);
    m.rotation.set(...rot);
    m.castShadow = true;
    m.visible = false;
    food.add(m);
    (parts[name] = parts[name] || []).push(m);
    tints.push([mat, C(raw), C(cooked)]);
    return m;
  };
  const rnd = rng(89);
  if (recipe === 'friedrice') {
    for (let i = 0; i < 6; i++) tinted('kimchi', new THREE.BoxGeometry(0.026, 0.004, 0.018), '#d42a1e', '#a8221a', [Math.cos(i) * 0.04, 0.004, Math.sin(i) * 0.04], [0, i, 0]);
    const g = new THREE.SphereGeometry(0.06, 20, 8, 0, TAU, 0, Math.PI / 2);
    g.scale(1, 0.32, 1);
    tinted('rice', g, '#f8f4ea', '#e8743a', [0, 0.002, 0]);
    const egg = tinted('egg', new THREE.CircleGeometry(0.03, 20), '#fffaf2', '#fff2d8', [0.032, 0.022, 0.02], [-Math.PI / 2, 0, 0]);
    const yolk = new THREE.Mesh(new THREE.SphereGeometry(0.012, 12, 8, 0, TAU, 0, Math.PI / 2), own('#ffb21f', 0.25));
    yolk.scale.set(1, 0.55, 1);
    yolk.rotation.x = Math.PI / 2;
    egg.add(yolk);
  } else if (recipe === 'toast') {
    tinted('egg', new THREE.BoxGeometry(0.07, 0.008, 0.07), '#fff3c4', '#ffd04a', [-0.03, 0.004, 0]);
    tinted('bread', new THREE.BoxGeometry(0.075, 0.012, 0.075), '#f8e6c0', '#d98a3a', [0.035, 0.006, 0]);
    tinted('top', new THREE.BoxGeometry(0.06, 0.004, 0.06), '#f29aa6', '#f29aa6', [0.035, 0.014, 0]);
    tinted('top', new THREE.BoxGeometry(0.058, 0.002, 0.058), '#ffc23a', '#ffb83a', [0.035, 0.017, 0], [0, 0.4, 0]);
  } else if (recipe === 'eggroll') {
    tinted('sheet', new THREE.CylinderGeometry(R - 0.016, R - 0.016, 0.004, 28), '#fff3a0', '#ffd04a', [0, 0.002, 0]);
    const log = tinted('roll', new THREE.CylinderGeometry(0.018, 0.018, 0.11, 18), '#fff3a0', '#ffcf4a', [-0.03, 0.018, 0], [Math.PI / 2, 0, 0]);
    log.userData.grow = true;
    for (let i = 0; i < 8; i++) tinted('sheet', new THREE.BoxGeometry(0.006, 0.003, 0.006), i % 2 ? '#4fae4a' : '#ff8a3a', i % 2 ? '#4fae4a' : '#ff8a3a', [rnd.range(-0.05, 0.05), 0.005, rnd.range(-0.05, 0.05)]);
  } else {
    // pancake: a round of batter; bubbles come up through it; flipped, it is golden
    const g = new THREE.CylinderGeometry(0.058, 0.06, 0.011, 28);
    const cake = tinted('batter', g, '#fbeec8', '#d98a3a', [0, 0.006, 0]);
    cake.userData.flipColor = true;
  }
  const bub = bubbles(recipe === 'pancake' ? 14 : 8, R - 0.03, 0.02, recipe === 'pancake' ? '#f6e2b0' : '#fff7e0');
  bub.group.visible = recipe === 'pancake';
  object.add(bub.group);
  // smoke, when it burns
  const smoke = [];
  const smokeMat = new THREE.SpriteMaterial({ map: softDotTexture(), color: '#4a4048', transparent: true, opacity: 0, depthWrite: false });
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(smokeMat.clone());
    s.userData.phase = i / 6;
    object.add(s);
    smoke.push(s);
  }
  const STEPS = {
    friedrice: [['kimchi'], ['rice'], [], ['egg']],
    toast: [['egg'], ['bread'], [], ['top']],
    eggroll: [[], ['sheet'], ['roll'], []],
    pancake: [[], ['batter'], [], []],
  }[recipe];
  let heat = 0;
  let doneK = 0;
  let jostle = 0;
  let tossing = -1; // (flipping: how far through the toss, 0 … 1)
  let flipped = false;
  let rolled = 0;
  const over = mark(0, 0.14, 0);
  object.add(over);
  const golden = C('#d98a3a');
  return {
    object,
    kind: 'pan',
    over,
    handle,
    stage(i) {
      const shown = new Set(STEPS.slice(0, i + 1).flat());
      for (const name in parts) parts[name].forEach((m) => (m.visible = shown.has(name)));
      // (rolling the omelette: the sheet becomes the roll)
      if (recipe === 'eggroll' && i >= 2) {
        parts.sheet.forEach((m) => (m.visible = false));
        rolled = 1;
      }
    },
    heat(k) {
      heat = k;
    },
    done(k) {
      doneK = k;
      const cook = Math.min(1, k);
      const char = Math.max(0, Math.min(1, (k - 1) * 2));
      for (const [mat, raw, cooked] of tints) mat.color.copy(raw).lerp(cooked, cook).lerp(CHAR, char * 0.8);
      // (a pancake: its underside goes golden first — the top, once it is turned over)
      if (recipe === 'pancake' && !flipped) parts.batter[0].material.color.copy(C('#fbeec8')).lerp(golden, cook * 0.2);
    },
    stir() {
      jostle = 1;
    },
    flip() {
      tossing = 0;
    },
    update(dt, t) {
      jostle = Math.max(0, jostle - dt * 3);
      food.children.forEach((m, i) => {
        m.position.x += Math.sin(t * 14 + i * 2) * 0.0006 * jostle;
        m.position.z += Math.cos(t * 12 + i) * 0.0006 * jostle;
      });
      if (tossing >= 0) {
        tossing = Math.min(1, tossing + dt * 1.8);
        const k = tossing;
        food.position.y = 0.006 + Math.sin(k * Math.PI) * 0.12;
        food.rotation.x = k * Math.PI;
        if (k >= 1) {
          tossing = -1;
          food.rotation.x = 0;
          food.position.y = 0.006;
          flipped = !flipped;
          // (turned over: the golden side up)
          if (recipe === 'pancake') parts.batter[0].material.color.copy(golden).lerp(CHAR, Math.max(0, Math.min(1, (doneK - 1) * 2)) * 0.8);
        }
      }
      if (recipe === 'eggroll' && parts.roll) parts.roll[0].scale.set(0.6 + 0.4 * rolled, 1, 0.6 + 0.4 * rolled);
      bub.list.forEach((m) => {
        const u = (t * m.userData.speed * 0.6 + m.userData.phase) % 1;
        const s = heat > 0.2 && doneK < 0.9 ? 0.003 * Math.sin(u * Math.PI) * heat : 0;
        m.scale.setScalar(Math.max(1e-4, s));
        m.position.y = recipe === 'pancake' ? 0.0125 : 0.012 + 0.006 * Math.sin(u * Math.PI);
      });
      // smoke rises once it has gone too far
      const char = Math.max(0, Math.min(1, (doneK - 1.05) * 3));
      smoke.forEach((s) => {
        const u = (t * 0.45 + s.userData.phase) % 1;
        s.position.set(Math.sin(u * 7 + s.userData.phase * 9) * 0.03, 0.03 + u * 0.32, Math.cos(u * 5) * 0.02);
        s.scale.setScalar(0.05 + u * 0.12);
        s.material.opacity = char * 0.55 * Math.sin(u * Math.PI);
      });
    },
  };
}

// ------------------------------------------------------------------ what she holds as she cooks

/**
 * What she has in her hand to put in (at the girls' measure, in the frame of her hand): an egg, a block of noodles, a
 * slice of ham or of cheese, kimchi, a slice of bread, rice, spring onion, the milk, the pancake mix.
 */
export function makeIngredient(id) {
  const object = new THREE.Group();
  const at = new THREE.Group();
  at.position.set(0, 0.012, 0.024);
  object.add(at);
  switch (id) {
    case 'egg':
      at.add(piece(new THREE.SphereGeometry(0.013, 14, 10), '#fbf1e2', { scale: [1, 1.28, 1] }));
      break;
    case 'noodle':
    case 'noodles': {
      const g = new THREE.BoxGeometry(0.052, 0.012, 0.052, 6, 1, 6);
      const p = g.attributes.position;
      for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) + Math.sin(p.getX(i) * 260) * Math.cos(p.getZ(i) * 240) * 0.002);
      g.computeVertexNormals();
      at.add(piece(g, (q) => C('#f2cf72').lerp(C('#e9b94a'), Math.abs(Math.sin(q.x * 200 + q.z * 150))), { rot: [0.3, 0, 0] }));
      break;
    }
    case 'ham':
      at.add(piece(new THREE.BoxGeometry(0.05, 0.004, 0.034), '#f29aa6', { rot: [0.4, 0, 0] }));
      break;
    case 'cheese':
      at.add(piece(new THREE.BoxGeometry(0.044, 0.002, 0.044), '#ffc23a', { rot: [0.4, 0, 0], mat: 'gloss' }));
      break;
    case 'kimchi': {
      for (let i = 0; i < 4; i++) at.add(piece(new THREE.BoxGeometry(0.03, 0.003, 0.016), i % 2 ? '#c4251c' : '#e8473a', { at: [0, i * 0.003, 0], rot: [0.3, i * 0.8, 0] }));
      break;
    }
    case 'bread':
      at.add(piece(new THREE.BoxGeometry(0.06, 0.06, 0.008), (q, n) => (Math.abs(n.z) > 0.5 ? C('#fbeacd') : C('#d99a52')), { rot: [0.2, 0, 0] }));
      break;
    case 'rice':
      at.add(piece(new THREE.BoxGeometry(0.05, 0.02, 0.036), '#ffffff', { at: [0, -0.004, 0] }));
      at.add(piece(new THREE.SphereGeometry(0.022, 12, 8, 0, TAU, 0, Math.PI / 2), '#fbf8f2', { at: [0, 0.006, 0], scale: [1.1, 0.5, 0.8] }));
      break;
    case 'leek':
      // two short lengths of spring onion: white at the root end, green up the rest
      for (const s of [-1, 1]) at.add(piece(new THREE.CylinderGeometry(0.0055, 0.006, 0.07, 10), (q) => (q.y < -0.012 ? C('#f4f6e8') : C('#4fae4a').lerp(C('#8fd47a'), (q.y + 0.012) / 0.05)), { at: [s * 0.006, 0.0, 0], rot: [0.4, 0, s * 0.1] }));
      break;
    case 'milk':
      at.add(piece(new THREE.BoxGeometry(0.03, 0.06, 0.03), (q) => (q.y > 0.012 ? C('#7fbfe0') : C('#ffffff')), { at: [0, 0.02, 0] }));
      at.add(piece(new THREE.BoxGeometry(0.03, 0.012, 0.006), '#ffffff', { at: [0, 0.055, 0], rot: [0, Math.PI / 4, 0] }));
      break;
    case 'mix':
      at.add(piece(new THREE.BoxGeometry(0.04, 0.056, 0.016), (q) => (q.y > 0.02 ? C('#ffd23f') : C('#ff9a4a')), { at: [0, 0.02, 0] }));
      break;
    default:
      at.add(piece(new THREE.SphereGeometry(0.012, 10, 8), '#ffffff'));
  }
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { object };
}

/** The mixing bowl she beats eggs or stirs batter in (her left hand), and what is in it: egg or batter. */
export function makeMixBowl(what) {
  const object = new THREE.Group();
  const bowl = new THREE.Group();
  bowl.position.set(0, 0.008, 0.028);
  object.add(bowl);
  const c = crockery('bowl', '#ffffff');
  bowl.add(c.group);
  const fill = piece(new THREE.CircleGeometry(0.05, 26), what === 'egg' ? '#ffcf3a' : '#fbe6b8', { at: [0, 0.028, 0], rot: [-Math.PI / 2, 0, 0], mat: 'gloss' });
  bowl.add(fill);
  const swirl = piece(new THREE.TorusGeometry(0.022, 0.002, 4, 24), what === 'egg' ? '#fff3a0' : '#ffffff', { at: [0, 0.0285, 0], rot: [Math.PI / 2, 0, 0] });
  bowl.add(swirl);
  const top = mark(0, 0.03, 0);
  bowl.add(top);
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return {
    object,
    top,
    mix(t) {
      swirl.rotation.z = t * 9;
      swirl.scale.setScalar(0.8 + 0.2 * Math.sin(t * 7));
    },
  };
}

/** The spatula (her right hand, over the pan) and the cooking chopsticks (over the pot). */
export function makeTurner(kind) {
  const object = new THREE.Group();
  const holder = new THREE.Group();
  holder.position.set(0.002, -0.004, 0.006);
  object.add(holder);
  let tip;
  if (kind === 'spatula') {
    holder.add(piece(new THREE.CylinderGeometry(0.0035, 0.004, 0.09, 8), '#ff8fb2', { at: [0, 0.03, 0], mat: 'gloss' }));
    holder.add(piece(new THREE.BoxGeometry(0.032, 0.03, 0.002), '#2d2a2e', { at: [0, 0.088, 0], mat: 'gloss' }));
    tip = mark(0, 0.1, 0);
  } else {
    for (const s of [-1, 1]) holder.add(piece(new THREE.CylinderGeometry(0.0018, 0.0028, 0.14, 6), '#dcb684', { at: [s * 0.003, 0.055, 0], rot: [0, 0, s * 0.03], mat: 'wood' }));
    tip = mark(0, 0.125, 0);
  }
  holder.add(tip);
  holder.rotation.x = 2.3; // (pointing down and forward, into the pan)
  object.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return { object, tip, holder };
}
