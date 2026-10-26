// What she buys ready to eat: at the convenience store round the corner (a triangle of rice in seaweed, a cup of
// noodles, banana milk, an ice cream cone, a custard pudding, fish cake on a skewer) and at the café (iced americano,
// strawberry latte, green tea latte, hot chocolate, a croffle). Made as food.js makes the courier's dishes: each is
// something she holds as she eats it — at her palm, upright — with a mark where it goes to her mouth (`bite`) or a
// bowl's top (`top`) for a spoon, how many mouthfuls it is, and `left(k)` (1 … 0) for how much of it is left.
//
// At the girls' measure (one unit tall: me.js), in the frame of the hand that holds it: +Y up, +Z the way she faces.
import * as THREE from '../vendor/three.module.min.js';
import { V, TAU, rng, paintTexture } from './shapes.js';
import { piece, mark, clear, bowlGeometry, eatAway, labelTexture } from './dishkit.js';

const C = (hex) => new THREE.Color(hex);

/* A clear cup with a straw — the café's, the bubble tea's: its drink in layers (`layers`: [colour at the bottom, colour
   at the top] as a gradient painted up the inside), ice in it, a flat lid and a straw through it. */
function iced({ low, high, ice = 5, straw = '#3d6b4f', streaks = null, chunks = null, whip = null }) {
  const object = new THREE.Group();
  const cup = new THREE.Group();
  cup.position.set(0, -0.016, 0.034);
  object.add(cup);
  const H = 0.098;
  const R0 = 0.021;
  const R1 = 0.028;
  const tex = paintTexture(128, (g, S) => {
    const grad = g.createLinearGradient(0, S, 0, 0);
    grad.addColorStop(0, low);
    grad.addColorStop(0.45, low);
    grad.addColorStop(0.62, high);
    grad.addColorStop(1, high);
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    if (streaks) {
      const rnd = rng(17);
      for (let i = 0; i < 8; i++) {
        const x = rnd() * S;
        g.strokeStyle = streaks;
        g.globalAlpha = rnd.range(0.35, 0.7);
        g.lineWidth = rnd.range(3, 7);
        g.beginPath();
        g.moveTo(x, S * 0.62);
        g.bezierCurveTo(x + rnd.range(-15, 15), S * 0.5, x + rnd.range(-20, 20), S * 0.3, x + rnd.range(-20, 20), S * rnd.range(0.06, 0.25));
        g.stroke();
      }
      g.globalAlpha = 1;
    }
  });
  const drinkGeo = new THREE.CylinderGeometry(R1 * 0.93, R0 * 0.93, H * 0.84, 20);
  drinkGeo.translate(0, (H * 0.84) / 2, 0);
  const drink = new THREE.Mesh(drinkGeo, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.35 }));
  drink.position.y = -H / 2 + 0.003;
  cup.add(drink);
  // ice: clear cubes floating at the top of it, going down with it
  const cubes = [];
  const rnd = rng(23);
  for (let i = 0; i < ice; i++) {
    const a = (i / ice) * TAU + rnd() * 0.6;
    const r = rnd.range(0.004, R0 * 0.75);
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.012, 0.014), new THREE.MeshStandardMaterial({ color: '#eef8ff', roughness: 0.05, transparent: true, opacity: 0.55, depthWrite: false }));
    m.position.set(Math.cos(a) * r, H * 0.3 + rnd() * 0.01, Math.sin(a) * r);
    m.rotation.set(rnd() * TAU, rnd() * TAU, rnd() * TAU);
    m.userData.y0 = m.position.y;
    cup.add(m);
    cubes.push(m);
  }
  // fruit in the bottom (a strawberry latte's), cream on the top
  const bits = [];
  if (chunks) {
    for (let i = 0; i < 7; i++) {
      const a = rnd() * TAU;
      const r = rnd.range(0, R0 * 0.7);
      const m = piece(new THREE.DodecahedronGeometry(0.0062, 0), chunks, { at: [Math.cos(a) * r, -H / 2 + 0.008 + rnd() * 0.012, Math.sin(a) * r], rot: [rnd(), rnd(), rnd()], mat: 'gloss', flat: true });
      cup.add(m);
      bits.push(m);
    }
  }
  let cream = null;
  if (whip) {
    cream = new THREE.Group();
    for (let i = 0; i < 3; i++) cream.add(piece(new THREE.SphereGeometry(R1 * (0.85 - i * 0.22), 14, 8, 0, TAU, 0, Math.PI / 2), whip, { at: [0, i * 0.008, 0], scale: [1, 0.7, 1] }));
    cream.position.y = H / 2 - 0.002;
    cup.add(cream);
  }
  const shell = new THREE.Mesh(new THREE.CylinderGeometry(R1, R0, H, 24, 1, true), clear(0.3));
  cup.add(shell);
  cup.add(piece(new THREE.CircleGeometry(R0, 20), '#f4eee8', { at: [0, -H / 2, 0], rot: [Math.PI / 2, 0, 0] }));
  // the lid: flat (or domed over cream), and its rim
  const lid = new THREE.Mesh(whip ? new THREE.SphereGeometry(R1 * 1.04, 22, 8, 0, TAU, 0, Math.PI / 2) : new THREE.CylinderGeometry(R1 * 1.04, R1 * 1.04, 0.004, 24), clear(0.4));
  if (whip) lid.scale.y = 0.62;
  lid.position.y = H / 2 + (whip ? 0 : 0.002);
  cup.add(lid);
  cup.add(piece(new THREE.TorusGeometry(R1 * 1.03, 0.0018, 5, 26), '#ffffff', { at: [0, H / 2, 0], rot: [Math.PI / 2, 0, 0], mat: 'gloss' }));
  cup.add(piece(new THREE.CylinderGeometry(0.0034, 0.0034, H * 1.1, 10), straw, { at: [0.005, H * 0.33, -0.002], rot: [0.1, 0, -0.1], mat: 'gloss' }));
  const bite = mark(0.005 + 0.05 * 0.1, H * 0.33 + (H * 1.1) / 2 - 0.003, 0.005);
  cup.add(bite);
  return {
    object,
    style: 'sip',
    bites: 5,
    bite,
    left(k) {
      drink.scale.y = Math.max(0.02, k);
      drink.visible = k > 0.01;
      const top = -H / 2 + 0.003 + H * 0.84 * Math.max(0.02, k);
      cubes.forEach((m) => (m.position.y = Math.min(m.userData.y0, top - 0.004)));
      eatAway(bits, Math.min(1, k * 1.5));
      if (cream) cream.visible = k > 0.6;
    },
  };
}

// ------------------------------------------------------------------ the convenience store

/** 🍙 A tuna-mayo triangle of rice, its seaweed round the bottom, its corner up to her mouth. */
function samgak() {
  const object = new THREE.Group();
  const ball = new THREE.Group();
  ball.position.set(0, 0.006, 0.02);
  ball.rotation.x = -0.32; // (its corner leaning towards her)
  object.add(ball);
  const W = 0.078;
  const H = 0.07;
  const D = 0.03;
  const r = 0.012;
  const tri = new THREE.Shape();
  // a triangle with round corners
  const P = [V(-W / 2, 0), V(W / 2, 0), V(0, H)];
  for (let i = 0; i < 3; i++) {
    const a = P[i];
    const b = P[(i + 1) % 3];
    const c = P[(i + 2) % 3];
    const toB = b.clone().sub(a).normalize();
    const toC = c.clone().sub(a).normalize();
    const s = a.clone().addScaledVector(toC, r);
    const e = a.clone().addScaledVector(toB, r);
    if (i === 0) tri.moveTo(s.x, s.y);
    else tri.lineTo(s.x, s.y);
    tri.quadraticCurveTo(a.x, a.y, e.x, e.y);
  }
  tri.closePath();
  const rice = new THREE.ExtrudeGeometry(tri, { depth: D, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.005, bevelSegments: 3, curveSegments: 6 });
  rice.translate(0, 0, -D / 2);
  const rnd = rng(31);
  const grains = new Map();
  const riceMesh = piece(rice, (q) => {
    const key = `${q.x.toFixed(3)},${q.y.toFixed(3)},${q.z.toFixed(3)}`;
    if (!grains.has(key)) grains.set(key, rnd());
    return C('#fbf8f2').lerp(C('#e9e2d6'), grains.get(key) * 0.5);
  });
  ball.add(riceMesh);
  // the seaweed: a band round the bottom of it, a little proud of the rice
  const band = new THREE.Shape();
  band.moveTo(-W / 2 - 0.004, -0.004);
  band.lineTo(W / 2 + 0.004, -0.004);
  band.lineTo(W * 0.24, H * 0.45);
  band.lineTo(-W * 0.24, H * 0.45);
  band.closePath();
  // (a thin sheet just over the rice: the rice's bevel makes it D + 0.012 deep)
  const nori = new THREE.ExtrudeGeometry(band, { depth: D + 0.0135, bevelEnabled: false });
  nori.translate(0, 0, -(D + 0.0135) / 2);
  const noriMesh = piece(nori, (q) => C('#1f3326').lerp(C('#2f4a36'), Math.sin(q.x * 300) * 0.5 + 0.5), { mat: 'gloss' });
  ball.add(noriMesh);
  // the tuna mayo in the middle, where a bite has been taken (shown once it has)
  const filling = piece(new THREE.SphereGeometry(0.014, 12, 8), '#f0d9a6', { at: [0, H * 0.48, D * 0.32], scale: [1, 0.8, 0.5] });
  filling.visible = false;
  ball.add(filling);
  const bite = mark(0, H - 0.008, 0.006);
  ball.add(bite);
  return {
    object,
    style: 'hand',
    bites: 4,
    bite,
    left(k) {
      const s = 0.4 + 0.6 * k;
      riceMesh.scale.set(1, s, 1);
      noriMesh.scale.set(1, Math.min(1, s * 1.15), 1);
      riceMesh.visible = noriMesh.visible = k > 0.01;
      filling.visible = k < 0.99 && k > 0.2;
      filling.position.y = H * s - 0.012;
      bite.position.y = H * s - 0.008;
    },
  };
}

/** 🍜 A cup of instant noodles: the paper cup, its lid peeled back, the noodles in their broth (three minutes after the
 *  water went in) — held in her left hand, eaten with chopsticks. `wait`: the minutes it stands with its lid on first. */
function cupramen() {
  const object = new THREE.Group();
  const cup = new THREE.Group();
  cup.position.set(0, 0.008, 0.026);
  object.add(cup);
  const H = 0.07;
  const R0 = 0.032;
  const R1 = 0.044;
  const label = labelTexture(256, 96, (g, W, Hh) => {
    g.fillStyle = '#fff7ee';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#e8343c';
    g.fillRect(0, Hh * 0.55, W, Hh * 0.45);
    g.fillStyle = '#ffd23f';
    g.fillRect(0, Hh * 0.52, W, Hh * 0.06);
    g.fillStyle = '#e8343c';
    g.font = '700 34px Jua, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const x of [W * 0.25, W * 0.75]) g.fillText('라면', x, Hh * 0.28);
    g.fillStyle = '#ffffff';
    g.font = '700 20px Jua, sans-serif';
    for (const x of [W * 0.25, W * 0.75]) g.fillText('얼큰한 맛', x, Hh * 0.78);
  });
  label.wrapS = THREE.RepeatWrapping;
  const side = new THREE.Mesh(new THREE.CylinderGeometry(R1, R0, H, 28, 1, true), new THREE.MeshStandardMaterial({ map: label, roughness: 0.6, side: THREE.DoubleSide }));
  cup.add(side);
  cup.add(piece(new THREE.CircleGeometry(R0, 24), '#f4ece2', { at: [0, -H / 2, 0], rot: [Math.PI / 2, 0, 0] }));
  cup.add(piece(new THREE.TorusGeometry(R1, 0.002, 5, 30), '#ffffff', { at: [0, H / 2, 0], rot: [Math.PI / 2, 0, 0] }));
  // the broth, the noodles in it, and what floats on it
  const broth = piece(new THREE.CircleGeometry(R1 * 0.95, 26), '#d9622c', { rot: [-Math.PI / 2, 0, 0], mat: 'gloss' });
  broth.position.y = H * 0.32;
  cup.add(broth);
  const items = [];
  const rnd = rng(41);
  for (let i = 0; i < 4; i++) {
    const pts = [];
    for (let j = 0; j < 9; j++) pts.push(V(Math.cos(j * 0.9 + i) * 0.022, Math.sin(j * 2.1) * 0.003, Math.sin(j * 0.9 + i) * 0.022));
    items.push(piece(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, 0.0022, 4), '#f2d58a', { at: [rnd.range(-0.008, 0.008), H * 0.32 + 0.002, rnd.range(-0.008, 0.008)], mat: 'gloss' }));
  }
  for (let i = 0; i < 6; i++) {
    const a = rnd() * TAU;
    const r = rnd.range(0, 0.03);
    items.push(piece(new THREE.BoxGeometry(0.006, 0.002, 0.006), rnd() < 0.5 ? '#5aa850' : '#ffcf4a', { at: [Math.cos(a) * r, H * 0.32 + 0.004, Math.sin(a) * r], rot: [0, rnd() * TAU, 0] }));
  }
  items.forEach((m) => {
    m.userData.y0 = m.position.y;
    cup.add(m);
  });
  // the lid: peeled back over one side (and shut, while it stands)
  const lidHinge = new THREE.Group();
  lidHinge.position.set(0, H / 2 + 0.001, -R1);
  lidHinge.add(piece(new THREE.CircleGeometry(R1 * 1.04, 26), '#f6f2ea', { at: [0, 0, R1], rot: [-Math.PI / 2, 0, 0] }));
  const tab = piece(new THREE.BoxGeometry(0.012, 0.0008, 0.01), '#e8343c', { at: [0, 0.0006, 2 * R1 + 0.005] });
  lidHinge.add(tab);
  cup.add(lidHinge);
  const top = mark(0, H * 0.32, 0);
  cup.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'chopsticks',
    morsel: 'noodles',
    bites: 6,
    top,
    wait: 3.2, // (the "three minutes", with the lid on: a few seconds of steam)
    /** The lid shut (k = 0) … peeled right back (1). */
    lid(k) {
      lidHinge.rotation.x = -k * 2.2;
    },
    left(k) {
      eatAway(items, k);
      broth.position.y = -H / 2 + 0.006 + (H * 0.32 + H / 2 - 0.006) * (0.25 + 0.75 * k);
      top.position.y = broth.position.y;
      items.forEach((m) => (m.position.y = Math.min(m.userData.y0, broth.position.y + 0.003)));
    },
  };
}

/** 🍌 Banana milk: the round little jar (white, the yellow of the milk showing through), its foil lid, a straw. */
function bananamilk() {
  const object = new THREE.Group();
  const jar = new THREE.Group();
  jar.position.set(0, -0.012, 0.032);
  object.add(jar);
  // the jar's outline: a round belly, a short neck
  const prof = [[0.0, -0.04], [0.017, -0.04], [0.026, -0.033], [0.031, -0.018], [0.031, 0.002], [0.026, 0.018], [0.016, 0.03], [0.014, 0.036], [0.015, 0.04]];
  const shell = new THREE.Mesh(bowlGeometry(prof, 26), new THREE.MeshStandardMaterial({ color: '#fffaf0', roughness: 0.25, transparent: true, opacity: 0.55, depthWrite: false }));
  jar.add(shell);
  // the milk, as high as it is full
  const milkProf = [[0.0, -0.038], [0.016, -0.038], [0.024, -0.032], [0.029, -0.018], [0.029, 0.002], [0.024, 0.017], [0.0, 0.017]];
  const milk = piece(bowlGeometry(milkProf, 22), ['#f5c94a', '#ffe27a']);
  milk.userData.k = 1;
  jar.add(milk);
  // the band of its label, and the foil on top
  const band = labelTexture(256, 48, (g, W, Hh) => {
    g.fillStyle = '#fff4c8';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#4a7a3a';
    g.font = '700 26px Jua, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('바나나맛 우유', W / 2, Hh / 2 + 1);
  });
  jar.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0316, 0.0316, 0.014, 26, 1, true), new THREE.MeshStandardMaterial({ map: band, roughness: 0.5 })));
  jar.add(piece(new THREE.CylinderGeometry(0.0158, 0.0158, 0.002, 18), '#d9dbe2', { at: [0, 0.041, 0], mat: 'metal' }));
  jar.add(piece(new THREE.CylinderGeometry(0.0026, 0.0026, 0.07, 8), '#ffd23f', { at: [0.004, 0.06, 0], rot: [0.08, 0, -0.12], mat: 'gloss' }));
  const bite = mark(0.004 + 0.035 * 0.12, 0.094, 0.003);
  jar.add(bite);
  return {
    object,
    style: 'sip',
    bites: 5,
    bite,
    left(k) {
      milk.scale.y = Math.max(0.05, 0.25 + 0.75 * k);
      milk.position.y = -0.038 * (1 - milk.scale.y);
      milk.visible = k > 0.01;
    },
  };
}

/** 🍦 An ice cream cone: the wafer cone in its paper, a scoop of vanilla, chocolate over it, nuts. */
function icecream() {
  const object = new THREE.Group();
  const cone = new THREE.Group();
  cone.position.set(0, -0.004, 0.018);
  cone.rotation.x = -0.25;
  object.add(cone);
  // the cone (point down), a lattice pressed into it
  const wafer = new THREE.ConeGeometry(0.024, 0.075, 18, 4);
  wafer.rotateX(Math.PI);
  cone.add(piece(wafer, (q) => C('#d79a52').lerp(C('#b9773a'), Math.abs(Math.sin(q.x * 220 + q.y * 160)) > 0.8 ? 0.5 : 0), { at: [0, 0.01, 0] }));
  // its paper sleeve
  const sleeve = new THREE.ConeGeometry(0.0205, 0.044, 18, 1, true);
  sleeve.rotateX(Math.PI);
  cone.add(piece(sleeve, ['#e94a6e', '#ff9fbd'], { at: [0, -0.006, 0], scale: 1.05 }));
  // the scoop, the chocolate, the nuts
  const scoop = new THREE.Group();
  scoop.position.y = 0.05;
  scoop.add(piece(new THREE.SphereGeometry(0.027, 18, 12), '#fff3dc', { scale: [1, 0.9, 1] }));
  scoop.add(piece(new THREE.SphereGeometry(0.0278, 18, 10, 0, TAU, 0, Math.PI * 0.42), '#6b3a22', { mat: 'gloss', scale: [1, 0.92, 1] }));
  const rnd = rng(53);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * TAU;
    const t = rnd.range(0.1, 0.9);
    scoop.add(piece(new THREE.BoxGeometry(0.004, 0.003, 0.004), '#e8c690', { at: [Math.cos(a) * 0.022 * Math.sin(t * 1.2), 0.025 * Math.cos(t * 1.2), Math.sin(a) * 0.022 * Math.sin(t * 1.2)], rot: [rnd(), rnd(), rnd()] }));
  }
  cone.add(scoop);
  const bite = mark(0, 0.074, 0.006);
  cone.add(bite);
  return {
    object,
    style: 'hand',
    bites: 4,
    bite,
    left(k) {
      const s = Math.max(0.15, k);
      scoop.scale.setScalar(s);
      scoop.position.y = 0.034 + 0.016 * s;
      scoop.visible = k > 0.05;
      bite.position.y = 0.04 + 0.034 * s;
    },
  };
}

/** 🍮 A custard pudding in its little clear cup: the custard, the caramel on top — a spoon. */
function pudding() {
  const object = new THREE.Group();
  const cup = new THREE.Group();
  cup.position.set(0, 0.012, 0.026);
  object.add(cup);
  const prof = [[0.0, 0.0], [0.022, 0.0], [0.03, 0.04], [0.031, 0.042]];
  cup.add(new THREE.Mesh(bowlGeometry(prof, 24), clear(0.35)));
  const custard = piece(new THREE.CylinderGeometry(0.028, 0.0215, 0.034, 22), ['#f2c25a', '#fbe08e'], { at: [0, 0.018, 0] });
  cup.add(custard);
  const caramel = piece(new THREE.CylinderGeometry(0.0282, 0.0282, 0.004, 22), '#8a4a1c', { at: [0, 0.036, 0], mat: 'gloss' });
  cup.add(caramel);
  const top = mark(0, 0.036, 0);
  cup.add(top);
  return {
    object,
    style: 'bowl',
    utensil: 'spoon',
    morsel: 'pudding',
    bites: 5,
    top,
    left(k) {
      const h = Math.max(0.05, k);
      custard.scale.y = h;
      custard.position.y = 0.001 + 0.017 * h;
      caramel.visible = k > 0.7;
      custard.visible = k > 0.01;
      top.position.y = 0.002 + 0.034 * h;
    },
  };
}

/** 🍢 Fish cake on a skewer, folded back and forth along it, glistening with broth. */
function odeng() {
  const object = new THREE.Group();
  const stick = new THREE.Group();
  stick.position.set(0, 0, 0.014);
  stick.rotation.x = -0.3;
  object.add(stick);
  stick.add(piece(new THREE.CylinderGeometry(0.0022, 0.0022, 0.2, 6), '#e9d2a6', { at: [0, 0.06, 0], mat: 'wood' }));
  // the sheet of fish cake, folded in waves up the stick
  const folds = [];
  for (let i = 0; i < 4; i++) {
    const g = new THREE.BoxGeometry(0.05, 0.026, 0.004, 6, 1, 1);
    const p = g.attributes.position;
    for (let j = 0; j < p.count; j++) p.setZ(j, p.getZ(j) + Math.sin(p.getX(j) * 70 + i) * 0.005);
    g.computeVertexNormals();
    const m = piece(g, (q, n) => C('#d9a25e').lerp(C('#f0c98a'), 0.4 + 0.3 * n.z), { at: [0, 0.05 + i * 0.024, (i % 2 ? 1 : -1) * 0.002], rot: [0, 0, (i % 2 ? 1 : -1) * 0.12], mat: 'gloss' });
    stick.add(m);
    folds.push(m);
  }
  const bite = mark(0, 0.13, 0.006);
  stick.add(bite);
  return {
    object,
    style: 'stick',
    bites: 4,
    bite,
    hot: true,
    left(k) {
      eatAway(folds, k);
      const n = folds.filter((f) => f.visible).length;
      bite.position.y = 0.05 + Math.max(0, n - 1) * 0.024 + 0.012;
    },
  };
}

// ------------------------------------------------------------------ the café

const americano = () => iced({ low: '#2a170e', high: '#4b2a17', ice: 6, straw: '#2d2a2e' });
const strawberrylatte = () => iced({ low: '#e8384f', high: '#fff3f4', ice: 4, straw: '#ff7fa8', streaks: '#f0606f', chunks: '#d9233f' });
const matchalatte = () => iced({ low: '#fbf7ee', high: '#7fae55', ice: 4, straw: '#3d6b4f' });

/** 🍫 Hot chocolate in a paper cup: its sleeve, the lid with a hole to sip at, a little steam. */
function hotchoco() {
  const object = new THREE.Group();
  const cup = new THREE.Group();
  cup.position.set(0, -0.012, 0.032);
  object.add(cup);
  const H = 0.09;
  cup.add(piece(new THREE.CylinderGeometry(0.027, 0.02, H, 24), ['#f6efe6', '#ffffff']));
  const sleeve = labelTexture(256, 64, (g, W, Hh) => {
    g.fillStyle = '#b98a5c';
    g.fillRect(0, 0, W, Hh);
    g.fillStyle = '#fff3e4';
    g.font = '700 30px Jua, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const x of [W * 0.25, W * 0.75]) g.fillText('몽글 ☁', x, Hh / 2 + 2);
  });
  sleeve.wrapS = THREE.RepeatWrapping;
  cup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.0258, 0.0228, H * 0.38, 24, 1, true), new THREE.MeshStandardMaterial({ map: sleeve, roughness: 0.8 })));
  const lid = new THREE.Group();
  lid.position.y = H / 2;
  lid.add(piece(new THREE.CylinderGeometry(0.0285, 0.0285, 0.007, 24), '#5a3a2c', { mat: 'gloss' }));
  lid.add(piece(new THREE.CylinderGeometry(0.022, 0.026, 0.006, 24), '#5a3a2c', { at: [0, 0.006, 0], mat: 'gloss' }));
  lid.add(piece(new THREE.BoxGeometry(0.008, 0.002, 0.004), '#1e1210', { at: [0, 0.0095, 0.016] }));
  cup.add(lid);
  const bite = mark(0, H / 2 + 0.01, 0.018); // (the hole in the lid, to her lips)
  cup.add(bite);
  return {
    object,
    style: 'sip',
    bites: 5,
    bite,
    hot: true,
    left() {}, // (a paper cup: nobody can see how much is left)
  };
}

/** 🧇 A croffle: a croissant pressed in a waffle iron — a crescent, golden, its squares glazed with sugar — and a little
 *  scoop of vanilla on top. */
function croffle() {
  const object = new THREE.Group();
  const it = new THREE.Group();
  it.position.set(0, 0.004, 0.018);
  it.rotation.x = -0.5;
  object.add(it);
  // the crescent: wide in the middle, its two ends curling in
  const shape = new THREE.Shape();
  shape.moveTo(-0.044, 0.012);
  shape.bezierCurveTo(-0.04, 0.05, 0.04, 0.05, 0.044, 0.012);
  shape.bezierCurveTo(0.036, 0.022, 0.02, 0.006, 0.0, 0.004);
  shape.bezierCurveTo(-0.02, 0.006, -0.036, 0.022, -0.044, 0.012);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.016, bevelEnabled: true, bevelThickness: 0.004, bevelSize: 0.004, bevelSegments: 3, curveSegments: 16 });
  g.translate(0, -0.026, -0.008);
  g.scale(1.1, 1.6, 1);
  const tex = paintTexture(128, (c, S) => {
    c.fillStyle = '#e09a42';
    c.fillRect(0, 0, S, S);
    // the waffle's squares, pressed in: darker grooves, glazed tops
    const n = 9;
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        const x = (i / n) * S;
        const y = (j / n) * S;
        const grad = c.createLinearGradient(x, y, x + S / n, y + S / n);
        grad.addColorStop(0, '#f6c46a');
        grad.addColorStop(1, '#d5862e');
        c.fillStyle = grad;
        c.fillRect(x + 2, y + 2, S / n - 4, S / n - 4);
      }
    c.fillStyle = 'rgba(255, 255, 255, 0.85)';
    const rnd = rng(59);
    for (let i = 0; i < 60; i++) c.fillRect(rnd() * S, rnd() * S, 1.5, 1.5);
  });
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(18, 18);
  const body = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: tex, roughness: 0.4 }));
  body.castShadow = true;
  it.add(body);
  const scoop = piece(new THREE.SphereGeometry(0.014, 14, 10), '#fff6e6', { at: [0.004, 0.026, 0.014], scale: [1, 0.8, 0.9] });
  it.add(scoop);
  it.add(piece(new THREE.TorusGeometry(0.01, 0.0018, 4, 16), '#8a4a1c', { at: [0.004, 0.034, 0.016], rot: [Math.PI / 2 - 0.4, 0, 0], mat: 'gloss' }));
  const bite = mark(0.03, 0.036, 0.006);
  it.add(bite);
  return {
    object,
    style: 'hand',
    bites: 4,
    bite,
    left(k) {
      const s = 0.4 + 0.6 * k;
      body.scale.set(s, 1, 1);
      body.position.x = -0.044 * (1 - s);
      body.visible = k > 0.01;
      scoop.visible = k > 0.55;
      it.children[2].visible = k > 0.55;
      bite.position.x = -0.044 * (1 - s) + 0.03 * s;
    },
  };
}

export const SNACKS = { samgak, cupramen, bananamilk, icecream, pudding, odeng, americano, strawberrylatte, matchalatte, hotchoco, croffle };
