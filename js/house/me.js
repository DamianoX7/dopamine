// 나 — the girl who lives in the house: her, as she makes herself. She is built the way Lorelei
// is (../fox/lorelei.js: a skeleton, one skinned mesh grown from rings, her head a mesh of its own
// with her face painted on it, lit by the same shader) and on the same bones — so Lorelei's
// animator moves her, and Lorelei's hats fit her head — but how she looks is hers to choose: her
// hair (how it is done, its fringe, its colour), her eyes, her skin, and what she wears, from her
// top to her shoes, and what she has in her hair.
//
// buildMe(look) makes her as `look` says (see LOOK below: every colour already worked out — the
// app keeps the names and the prices). Changing anything builds her again.
//
// Model space as Lorelei's: +Z forward, +Y up, +X her left; she is one unit tall, drawn ME_SIZE.
import * as THREE from '../vendor/three.module.min.js';
import { smooth, FUR_SUN } from '../fox/rig.js';
import { Batch } from '../fox/kit.js';
import { makeOwnerClothes } from '../fox/props.js';
import { Skin, Rings, dress, LEVEL, PLAIN, CHECK, HAIR, RIBS, SKIN, CHECKS, HEAD, HEAD_N, HEAD_NB, CAP, CAP_N, HEAD_Y, FACE, FACE_PX, EYE, MOUTH, NOSE_Y, curve, bump, LORELEI_SIZE } from '../fox/lorelei.js';

export const ME_SIZE = LORELEI_SIZE;

const X_AXIS = new THREE.Vector3(1, 0, 0);
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;
const DEG = Math.PI / 180;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** How she looks when nobody has chosen yet (and what fills in what a look leaves out). */
export const LOOK = {
  skin: '#fde6dc',
  eyes: { color: '#7a5c55', shape: 'round' }, //                         shape: round, soft (gentle, a little drooping), cat (lifted at the corners)
  hair: { style: 'long', bangs: 'full', top: '#6b4a3a', tip: '#7a5442' }, // style: long, bob, pony, twin, bun · bangs: full, side, part
  top: { kind: 'knit', color: '#f6e7d4', color2: '#ffffff' }, //             kind: tee, knit, hoodie, blouse, cardigan, dress
  bottom: { kind: 'skirt', color: '#56608f', check: null }, //               kind: skirt, midi, jeans, shorts · check: { band, line } for a checked skirt
  legs: { kind: 'knee', color: '#ffffff' }, //                               kind: bare, ankle, knee, tights
  shoes: { kind: 'slippers', color: '#ffb7cc' }, //                          kind: slippers, sneakers, maryjane, boots
  head: { kind: 'none', color: '#ff7fa8' }, //                               kind: none, ribbon, heart, blossom, headband, catears, beret, straw, santa
  glasses: { kind: 'none', color: '#5c4a58' }, //                            kind: none, round
  scarf: false,
};

/** A look with nothing left out. */
export function fullLook(look = {}) {
  const out = {};
  for (const k in LOOK) {
    const d = LOOK[k];
    const v = look[k];
    out[k] = d && typeof d === 'object' ? { ...d, ...(v && typeof v === 'object' ? v : {}) } : v === undefined ? d : v;
  }
  return out;
}

const C = (hex) => new THREE.Color(hex);
/** Her colours, worked out from what she chose: each with a darker shade (for the folds, the underside, the shadow of a sleeve). */
function inks(look) {
  const shade = (hex, k = 0.16) => C(hex).lerp(C('#3a2a40'), k);
  const skin = C(look.skin);
  const ink = {
    skin,
    skinDeep: skin.clone().lerp(C('#c9847a'), 0.28),
    skinRose: skin.clone().lerp(C('#f2908f'), 0.32),
    hair: C(look.hair.top),
    hairLight: C(look.hair.top).lerp(C('#ffffff'), 0.22),
    hairDeep: shade(look.hair.top, 0.24),
    hairTip: C(look.hair.tip || look.hair.top),
    top: C(look.top.color),
    topDeep: shade(look.top.color),
    top2: C(look.top.color2 || '#ffffff'),
    top2Deep: shade(look.top.color2 || '#ffffff', 0.12),
    bottom: C(look.bottom.color),
    bottomDeep: shade(look.bottom.color, 0.2),
    sock: C(look.legs.color),
    sockDeep: shade(look.legs.color, 0.14),
    shoe: C(look.shoes.color),
    shoeDeep: shade(look.shoes.color, 0.2),
    sole: C(look.shoes.kind === 'boots' ? '#514741' : look.shoes.kind === 'maryjane' ? '#4e4148' : '#f4efe9'),
    acc: C(look.head.color),
  };
  return ink;
}

// ------------------------------------------------------------------ her face

/**
 * Her face, painted (as Lorelei's is, ../fox/lorelei.js: paintFace) in her own colours: the skin, the irises, the brows
 * of the colour of her hair, and eyes of the shape she chose. `eyes`: 'open', 'half', 'closed', 'happy'; `mouth`:
 * 'flat', 'smile', 'open', 'o'.
 */
function paintFace(look, eyes, mouth, blush) {
  const canvas = document.createElement('canvas');
  const k = FACE_PX / (2 * FACE.half);
  canvas.width = FACE_PX;
  canvas.height = Math.round((FACE.top - FACE.bottom) * k);
  const g = canvas.getContext('2d');
  const X = (x) => (x + FACE.half) * k;
  const Y = (y) => (FACE.top - y) * k;
  g.fillStyle = look.skin;
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  const soft = (x, y, rx, ry, rgb, alpha) => {
    const grad = g.createRadialGradient(0, 0, 0, 0, 0, 1);
    grad.addColorStop(0, `rgba(${rgb}, ${alpha})`);
    grad.addColorStop(1, `rgba(${rgb}, 0)`);
    g.save();
    g.translate(X(x), Y(y));
    g.scale(rx * k, ry * k);
    g.fillStyle = grad;
    g.fillRect(-1, -1, 2, 2);
    g.restore();
  };
  const rgb = (c) => `${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}`;
  const skin = C(look.skin);
  skin.convertLinearToSRGB();
  const deep = C(look.skin).lerp(C('#c9847a'), 0.35);
  deep.convertLinearToSRGB();

  // the shade of her fringe on her brow (where it lies on it), a flush on her cheeks, the shade under her nose and lip
  if (look.hair.bangs !== 'part') {
    const shade = g.createLinearGradient(0, Y(FACE.top), 0, Y(-0.006));
    shade.addColorStop(0, `rgba(${rgb(deep)}, 0.3)`);
    shade.addColorStop(1, `rgba(${rgb(deep)}, 0)`);
    g.fillStyle = shade;
    g.fillRect(0, 0, canvas.width, Y(-0.006));
  }
  for (const sg of [-1, 1]) soft(sg * 0.058, -0.066, 0.03, 0.016, '255, 150, 150', 0.22 + 0.34 * blush);
  soft(-0.0015, NOSE_Y - 0.005, 0.0075, 0.0042, rgb(deep), 0.45);
  soft(MOUTH.x, MOUTH.y - 0.009, 0.009, 0.0035, rgb(deep), 0.32);

  const iris = C(look.eyes.color);
  iris.convertLinearToSRGB();
  const tint = (k2, toward) => {
    const c = iris.clone().lerp(toward, k2);
    return `rgb(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)})`;
  };
  const DARK = new THREE.Color(0.18, 0.12, 0.14);
  const LIGHT = new THREE.Color(1, 0.86, 0.84);
  const lash = '#5e4a4a';
  // the shape of her eyes: how high their outer corners are, and how her lids arch
  const shape = look.eyes.shape;
  const outerY = shape === 'cat' ? 0.0085 : shape === 'soft' ? -0.0035 : 0.003;
  const arch = shape === 'cat' ? 0.86 : shape === 'soft' ? 1.04 : 1;
  const { w, up, down } = EYE;
  for (const sg of [-1, 1]) {
    const P = ([dx, dy]) => [X(sg * (EYE.x + dx)), Y(EYE.y + dy)];
    const to = (pt) => g.lineTo(...P(pt));
    const poly = (pts) => {
      g.beginPath();
      g.moveTo(...P(pts[0]));
      pts.forEach(to);
      g.closePath();
    };
    const inner = [-w, -0.0015];
    const outer = [w, outerY];

    if (eyes === 'closed' || eyes === 'happy') {
      const mid = eyes === 'happy' ? up * 0.62 : -down * 0.6;
      const a = eyes === 'happy' ? [-w, -0.005] : [-w, -0.003];
      const b = eyes === 'happy' ? [w, -0.006 + outerY * 0.5] : [w, -0.001 + outerY * 0.5];
      const line = [];
      for (let i = 0; i <= 24; i++) line.push(curve(a, [-0.45 * w, mid * 1.32], [0.5 * w, mid * 1.32], b, i / 24));
      const thick = (i) => 0.0022 + 0.003 * smooth(0, 16, i);
      const dir = eyes === 'happy' ? 1 : -1;
      const band = line.slice();
      for (let i = 24; i >= 0; i--) band.push([line[i][0], line[i][1] + dir * thick(i)]);
      g.fillStyle = lash;
      poly(band);
      g.fill();
      poly([b, [b[0] + 0.0055, b[1] + dir * 0.0052], [b[0] - 0.003, b[1] + dir * 0.005]]);
      g.fill();
      continue;
    }

    const open = eyes === 'half' ? 0.42 : 1;
    const lid = up * open * arch - (1 - open) * 0.002;
    const top = [0.02 * w, lid];
    const upper = [];
    for (let i = 0; i <= 16; i++) upper.push(curve(inner, [-0.96 * w, lid * 0.5], [-0.56 * w, lid], top, i / 16));
    for (let i = 1; i <= 16; i++) upper.push(curve(top, [0.52 * w, lid], [0.94 * w, lid * 0.82 + 0.002 + outerY * 0.4], outer, i / 16));
    const low = [0.06 * w, -down];
    const lower = [];
    for (let i = 0; i <= 16; i++) lower.push(curve(outer, [1.0 * w, -down * 0.62 + outerY * 0.3], [0.62 * w, -down], low, i / 16));
    for (let i = 1; i <= 16; i++) lower.push(curve(low, [-0.5 * w, -down], [-0.93 * w, -down * 0.5], inner, i / 16));

    g.save();
    poly([...upper, ...lower]);
    g.clip();
    g.fillStyle = '#eee2dc';
    g.fillRect(X(sg * EYE.x) - 1.4 * w * k, Y(EYE.y + 0.03), 2.8 * w * k, 0.06 * k);
    // the iris, in her colour: dark under the lid, lighter and warmer below
    const ix = X(sg * (EYE.x - EYE.turn));
    const iy = Y(EYE.y - 0.0012);
    const ir = EYE.iris * k;
    const grad = g.createLinearGradient(0, iy - ir, 0, iy + ir);
    grad.addColorStop(0, tint(0.45, DARK));
    grad.addColorStop(0.32, tint(0.25, DARK));
    grad.addColorStop(0.6, tint(0, DARK));
    grad.addColorStop(0.84, tint(0.25, LIGHT));
    grad.addColorStop(1, tint(0.4, LIGHT));
    g.fillStyle = grad;
    g.beginPath();
    g.arc(ix, iy, ir, 0, TAU);
    g.fill();
    g.strokeStyle = tint(0.55, DARK);
    g.globalAlpha = 0.55;
    g.lineWidth = 0.0018 * k;
    g.beginPath();
    g.arc(ix, iy, ir - 0.0009 * k, 0, TAU);
    g.stroke();
    g.globalAlpha = 1;
    const glow = g.createRadialGradient(ix, iy + ir * 0.7, 0, ix, iy + ir * 0.7, ir * 0.8);
    glow.addColorStop(0, `rgba(255, 236, 228, 0.45)`);
    glow.addColorStop(1, 'rgba(255, 236, 228, 0)');
    g.fillStyle = glow;
    g.beginPath();
    g.arc(ix, iy, ir, 0, TAU);
    g.fill();
    g.fillStyle = tint(0.7, DARK);
    g.beginPath();
    g.arc(ix, iy - ir * 0.04, ir * 0.52, 0, TAU);
    g.fill();
    const under = g.createLinearGradient(0, Y(EYE.y + lid), 0, Y(EYE.y + lid - 0.012));
    under.addColorStop(0, 'rgba(90, 64, 70, 0.5)');
    under.addColorStop(1, 'rgba(90, 64, 70, 0)');
    g.fillStyle = under;
    g.fillRect(X(sg * EYE.x) - 1.4 * w * k, Y(EYE.y + lid), 2.8 * w * k, 0.012 * k);
    g.fillStyle = 'rgba(255, 252, 248, 0.85)';
    g.beginPath();
    g.arc(ix - ir * 0.36, iy - ir * 0.38, ir * 0.13, 0, TAU);
    g.fill();
    g.fillStyle = 'rgba(255, 252, 248, 0.45)';
    g.beginPath();
    g.arc(ix + ir * 0.4, iy + ir * 0.44, ir * 0.06, 0, TAU);
    g.fill();
    g.restore();

    // the upper lashes: thin at the inner corner, heavy where they come down round the outer one
    const thick = (i) => (0.002 + 0.0036 * smooth(0, 11, i) + 0.0026 * smooth(18, 32, i)) * (0.55 + 0.45 * open);
    const band = upper.slice();
    band.push(lower[3], [w * 1.07, lower[3][1] + 0.002], [w * 1.25, outer[1] + 0.0045 * open]);
    for (let i = upper.length - 1; i >= 0; i--) {
      const lean = smooth(21, 32, i);
      band.push([upper[i][0] + thick(i) * 1.2 * lean, upper[i][1] + thick(i) * (1 - 0.35 * lean)]);
    }
    g.fillStyle = lash;
    poly(band);
    g.fill();
    poly([[w * 0.97, lid * 0.72 + 0.003 + outerY * 0.5], [w * 1.2, lid * 0.72 + 0.0105 * open + outerY], [w * 1.1, lid * 0.45 + 0.004 + outerY * 0.5]]);
    g.fill();
    g.strokeStyle = 'rgba(150, 110, 104, 0.4)';
    g.lineWidth = 0.0013 * k;
    g.beginPath();
    g.moveTo(...P(lower[4]));
    for (let i = 5; i <= 26; i++) to(lower[i]);
    g.stroke();
  }

  // her brows, a shade of her hair, a little lower towards her nose
  const brow = C(look.hair.top).lerp(C('#3a2a2a'), 0.35);
  brow.convertLinearToSRGB();
  g.fillStyle = `rgba(${rgb(brow)}, 0.88)`;
  const lift = eyes === 'happy' ? 0.003 : 0;
  const browTilt = shape === 'soft' ? -0.0025 : shape === 'cat' ? 0.002 : 0;
  for (const sg of [-1, 1]) {
    const a = [0.025, 0.0072 + lift - browTilt * 0.5];
    const b = [0.069, 0.0152 + lift + browTilt];
    const mid = [0.048, 0.0138 + lift];
    g.beginPath();
    g.moveTo(X(sg * a[0]), Y(a[1] + 0.0021));
    g.quadraticCurveTo(X(sg * mid[0]), Y(mid[1] + 0.0026), X(sg * b[0]), Y(b[1] + 0.0008));
    g.lineTo(X(sg * b[0]), Y(b[1] - 0.0008));
    g.quadraticCurveTo(X(sg * mid[0]), Y(mid[1] - 0.0019), X(sg * a[0]), Y(a[1] - 0.0021));
    g.closePath();
    g.fill();
  }

  // her mouth
  const mx = MOUTH.x;
  const my = MOUTH.y;
  g.strokeStyle = '#c98f8a';
  if (mouth === 'open' || mouth === 'o') {
    const wide = mouth === 'o' ? 0.0062 : 0.0135;
    g.fillStyle = '#9a4650';
    g.beginPath();
    if (mouth === 'o') g.ellipse(X(mx), Y(my - 0.003), wide * k, 0.0075 * k, 0, 0, TAU);
    else {
      g.moveTo(X(mx - wide), Y(my + 0.0035));
      g.quadraticCurveTo(X(mx), Y(my + 0.0055), X(mx + wide), Y(my + 0.0035));
      g.quadraticCurveTo(X(mx), Y(my - 0.026), X(mx - wide), Y(my + 0.0035));
    }
    g.fill();
    g.fillStyle = '#f0949a';
    g.beginPath();
    g.ellipse(X(mx), Y(my - (mouth === 'o' ? 0.0068 : 0.0108)), wide * 0.5 * k, 0.0034 * k, 0, 0, TAU);
    g.fill();
  } else if (mouth === 'smile') {
    g.lineWidth = 0.002 * k;
    g.beginPath();
    g.moveTo(X(mx - 0.0125), Y(my + 0.0022));
    g.quadraticCurveTo(X(mx), Y(my - 0.0075), X(mx + 0.0125), Y(my + 0.0022));
    g.stroke();
    soft(mx, my - 0.0062, 0.0062, 0.0026, '240, 150, 152', 0.75);
  } else {
    soft(mx, my - 0.003, 0.0072, 0.004, '240, 156, 156', 0.85);
    g.lineWidth = 0.0014 * k;
    g.beginPath();
    g.moveTo(X(mx - 0.0074), Y(my - 0.0002));
    g.bezierCurveTo(X(mx - 0.004), Y(my + 0.0016), X(mx - 0.0015), Y(my + 0.0012), X(mx), Y(my + 0.0003));
    g.bezierCurveTo(X(mx + 0.0015), Y(my + 0.0012), X(mx + 0.004), Y(my + 0.0016), X(mx + 0.0074), Y(my - 0.0002));
    g.stroke();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

// ------------------------------------------------------------------ her hair, as she has it done

// The fringes: where the sheet of hair over her brow ends, from behind her right ear round to behind her left — the
// points of its locks (1) and the nicks between them (0), as in Lorelei's (../fox/lorelei.js: EDGE): ['s', az°, el°]
// looking out from the middle of her head, or ['f', x, y] as seen from in front; a fifth number shapes the lock.
const BANGS = {
  // cut straight across, just over her brows
  full: [
    ['s', -104, 4, 0],
    ['s', -90, -14, 1],
    ['s', -78, 6, 0],
    ['f', -0.089, -0.03, 1],
    ['f', -0.082, -0.002, 0],
    ['f', -0.072, -0.008, 1],
    ['f', -0.06, 0.011, 0],
    ['f', -0.047, 0.0, 1, 1.2],
    ['f', -0.034, 0.012, 0],
    ['f', -0.021, 0.001, 1, 1.2],
    ['f', -0.008, 0.012, 0],
    ['f', 0.005, 0.0, 1, 1.2],
    ['f', 0.018, 0.012, 0],
    ['f', 0.031, 0.001, 1, 1.2],
    ['f', 0.044, 0.012, 0],
    ['f', 0.057, 0.0, 1, 1.2],
    ['f', 0.069, 0.011, 0],
    ['f', 0.08, -0.006, 1],
    ['f', 0.084, 0.006, 0],
    ['f', 0.089, -0.03, 1],
    ['s', 78, 6, 0],
    ['s', 90, -14, 1],
    ['s', 104, 4, 0],
  ],
  // swept to one side from a parting (as Lorelei's)
  side: [
    ['s', -104, 4, 0],
    ['s', -90, -10, 1],
    ['s', -78, 8, 0],
    ['f', -0.089, -0.022, 1],
    ['f', -0.085, 0.014, 0],
    ['f', -0.075, 0.008, 1],
    ['f', -0.061, 0.017, 0],
    ['f', -0.046, 0.008, 1],
    ['f', -0.033, 0.016, 0],
    ['f', -0.019, 0, 1],
    ['f', -0.012, 0.01, 0],
    ['f', -0.0045, -0.004, 1],
    ['f', 0.004, 0.013, 0, 0.7],
    ['f', 0.012, -0.011, 1, 0.6],
    ['f', 0.019, 0.062, 0, 1],
    ['f', 0.073, -0.007, 1],
    ['f', 0.083, 0.006, 0],
    ['f', 0.091, -0.02, 1],
    ['s', 78, 8, 0],
    ['s', 90, -10, 1],
    ['s', 104, 4, 0],
  ],
  // parted in the middle, her brow bare: the hair goes back from it to both sides, over her temples
  part: [
    ['s', -104, 4, 0],
    ['s', -90, -12, 1],
    ['s', -78, 6, 0],
    ['f', -0.088, -0.03, 1],
    ['f', -0.086, 0.012, 0],
    ['f', -0.076, 0.026, 1, 1.1],
    ['f', -0.062, 0.042, 0],
    ['f', -0.044, 0.05, 1, 1.1],
    ['f', -0.026, 0.06, 0],
    ['f', -0.009, 0.064, 1, 1.1],
    ['f', 0.0, 0.074, 0, 0.8],
    ['f', 0.009, 0.064, 1, 1.1],
    ['f', 0.026, 0.06, 0],
    ['f', 0.044, 0.05, 1, 1.1],
    ['f', 0.062, 0.042, 0],
    ['f', 0.076, 0.026, 1, 1.1],
    ['f', 0.086, 0.012, 0],
    ['f', 0.088, -0.03, 1],
    ['s', 78, 6, 0],
    ['s', 90, -12, 1],
    ['s', 104, 4, 0],
  ],
};

// The tails of the styles that have one: [x, y, z, half its width, half its depth] along its middle, from the tie down.
const PONY = [
  [0, 0.928, -0.088, 0.026, 0.026],
  [0, 0.95, -0.118, 0.036, 0.033],
  [0, 0.946, -0.148, 0.048, 0.04],
  [0, 0.912, -0.168, 0.058, 0.046],
  [0, 0.852, -0.176, 0.064, 0.05],
  [0, 0.772, -0.172, 0.064, 0.05],
  [0, 0.694, -0.16, 0.058, 0.045],
  [0, 0.624, -0.148, 0.048, 0.036],
  [0, 0.574, -0.143, 0.034, 0.026],
  [0, 0.546, -0.144, 0.016, 0.012],
  [0, 0.532, -0.145, 0.004, 0.004],
];
const TWIN = (sg) => [
  [sg * 0.094, 0.9, -0.052, 0.022, 0.022],
  [sg * 0.122, 0.906, -0.07, 0.032, 0.028],
  [sg * 0.146, 0.888, -0.088, 0.04, 0.034],
  [sg * 0.158, 0.844, -0.1, 0.046, 0.038],
  [sg * 0.162, 0.776, -0.106, 0.048, 0.04],
  [sg * 0.16, 0.708, -0.104, 0.045, 0.037],
  [sg * 0.155, 0.644, -0.1, 0.038, 0.03],
  [sg * 0.151, 0.598, -0.098, 0.028, 0.021],
  [sg * 0.149, 0.572, -0.098, 0.013, 0.01],
  [sg * 0.148, 0.562, -0.098, 0.003, 0.003],
];
// long hair: as a bob (below), round her head and open in front — and on down behind her shoulders, past them
const LONG = [
  [0.03, 0.123, 0.074, 0.121, -0.012],
  [-0.01, 0.126, 0.064, 0.121, -0.018],
  [-0.05, 0.126, 0.05, 0.116, -0.024],
  [-0.09, 0.123, 0.034, 0.106, -0.036],
  [-0.13, 0.12, 0.022, 0.094, -0.054],
  [-0.17, 0.123, 0.02, 0.07, -0.076],
  [-0.23, 0.125, 0.018, 0.052, -0.086],
  [-0.3, 0.121, 0.016, 0.042, -0.087],
  [-0.36, 0.111, 0.014, 0.033, -0.089],
  [-0.41, 0.092, 0.012, 0.024, -0.093],
  [-0.44, 0.064, 0.008, 0.012, -0.095],
];
// a bob: level rings round her head, from her temples down to her chin, open in front — [height, half-width, in front, behind, forward]
const BOB = [
  [0.03, 0.123, 0.074, 0.121, -0.012],
  [-0.01, 0.126, 0.064, 0.121, -0.018],
  [-0.05, 0.125, 0.054, 0.114, -0.021],
  [-0.088, 0.118, 0.044, 0.102, -0.02],
  [-0.115, 0.108, 0.036, 0.092, -0.015],
  [-0.13, 0.097, 0.03, 0.082, -0.01],
];
const TAIL_K = [1.6, 3.4, 5.0, 6.6, 8.2]; // where along a tail (in rows) its bones are
const LONG_K = [4.4, 5.6, 6.8, 8.0, 9.2]; // …and down long hair (its rows: below her chin it swings)

/* The rows of a tail as a path: its middle at each row, and which way across and in front are there. */
function rowsOf(table) {
  const rows = table.map(([x, y, z, hw, hd, hb]) => ({ p: V(x, y, z), hw, hd, hb: hb == null ? hd : hb }));
  rows.forEach((row, k) => {
    row.t = rows[Math.min(rows.length - 1, k + 1)].p.clone().sub(rows[Math.max(0, k - 1)].p).normalize();
    row.u = V().crossVectors(row.t, X_AXIS).normalize();
    row.s = V().crossVectors(row.u, row.t).normalize();
  });
  const at = (k) => {
    const i = clamp(Math.floor(k), 0, rows.length - 2);
    const f = clamp(k - i, 0, 1);
    const a = rows[i];
    const b = rows[i + 1];
    return { p: a.p.clone().lerp(b.p, f), hw: lerp(a.hw, b.hw, f), hd: lerp(a.hd, b.hd, f) };
  };
  return { rows, at };
}

// ------------------------------------------------------------------ her

/**
 * Builds her as `look` says. Returns a rig as Lorelei's (so LoreleiAnimator moves her): { group, bones, skeleton, mesh,
 * head, face, tail, tail2, umbrella, bag, size, light, rest, dims, look, dispose() }.
 */
export function buildMe(lookIn) {
  const look = fullLook(lookIn);
  const ink = inks(look);
  const col = new THREE.Color();
  const style = look.hair.style;
  const top = look.top.kind;
  const dressOn = top === 'dress';
  const bottom = dressOn ? 'dress' : look.bottom.kind;
  const lowShoes = look.shoes.kind !== 'boots';

  // ---- joints (as Lorelei's)
  const J = { root: V(0, 0, 0), hips: V(0, 0.39, 0), spine: V(0, 0.485, 0), chest: V(0, 0.585, 0), neck: V(0, 0.698, -0.002), head: V(0, 0.742, 0) };
  const armJ = (sg) => ({ arm: V(sg * 0.094, 0.67, -0.004), fore: V(sg * 0.1063, 0.5476, -0.002), hand: V(sg * 0.1181, 0.4302, 0.003) });
  const legJ = (sg) => ({ thigh: V(sg * 0.051, 0.365, 0.002), shin: V(sg * 0.0565, 0.23, -0.008), foot: V(sg * 0.063, 0.042, -0.028) });

  // ---- bones
  const bones = {};
  const boneIndex = {};
  const list = [];
  const addBone = (name, parent, model) => {
    const b = new THREE.Bone();
    b.name = name;
    b.userData.model = model.clone();
    if (parent) b.position.copy(model).sub(bones[parent].userData.model);
    else b.position.copy(model);
    b.userData.rest = b.position.clone();
    if (parent) bones[parent].add(b);
    bones[name] = b;
    boneIndex[name] = list.length;
    list.push(b);
    return b;
  };
  addBone('root', null, J.root);
  addBone('hips', 'root', J.hips);
  addBone('spine', 'hips', J.spine);
  addBone('chest', 'spine', J.chest);
  addBone('neck', 'chest', J.neck);
  addBone('head', 'neck', J.head);
  for (const side of ['L', 'R']) {
    const sg = side === 'L' ? 1 : -1;
    const a = armJ(sg);
    const l = legJ(sg);
    addBone(`arm${side}`, 'chest', a.arm);
    addBone(`fore${side}`, `arm${side}`, a.fore);
    addBone(`hand${side}`, `fore${side}`, a.hand);
    addBone(`thigh${side}`, 'hips', l.thigh);
    addBone(`shin${side}`, `thigh${side}`, l.shin);
    addBone(`foot${side}`, `shin${side}`, l.foot);
  }
  // the bones her hair swings on: along a tail (two, for twin tails), or down long hair — or, where there is none to
  // swing, at the back of her head (the animator turns them all the same)
  const hairPath = style === 'pony' ? rowsOf(PONY) : style === 'twin' ? rowsOf(TWIN(1)) : style === 'long' ? rowsOf(LONG.map(([y, rx, rf, rb, z]) => [0, HEAD_Y + y, z - rb * 0.5, rx, rb * 0.5])) : rowsOf(PONY.slice(0, 3));
  const ks = style === 'long' ? LONG_K : style === 'twin' || style === 'pony' ? TAIL_K : [0.5, 0.8, 1.1, 1.4, 1.7];
  const tail = ks.map((k, i) => addBone(`pony${i}`, i ? `pony${i - 1}` : 'head', hairPath.at(k).p).name);
  let tail2 = null;
  let path2 = null;
  if (style === 'twin') {
    path2 = rowsOf(TWIN(-1));
    tail2 = TAIL_K.map((k, i) => addBone(`twin${i}`, i ? `twin${i - 1}` : 'head', path2.at(k).p).name);
  }
  addBone('lockL', 'head', V(0.102, 0.838, 0.022));
  addBone('lockR', 'head', V(-0.102, 0.834, 0.022));
  /** The bones a point `k` rows along a chain goes with: her head as far as the tie, then each bone from where it bends. */
  const chainW = (names, at) => (k) => {
    const f = at.map((a) => smooth(a - 0.7, a + 0.9, k));
    const w = { head: 1 - f[0] };
    f.forEach((v, i) => (w[names[i]] = v - (f[i + 1] || 0)));
    return w;
  };

  const skin = new Skin(boneIndex);

  // ---- her neck
  skin.loft(
    [
      { c: V(0, 0.762, 0.003), rx: 0.027, ry: 0.027, w: { head: 1 } },
      { c: V(0, 0.738, 0.001), rx: 0.0262, ry: 0.0262, w: { head: 0.5, neck: 0.5 } },
      { c: V(0, 0.716, -0.002), rx: 0.0268, ry: 0.0265, w: { neck: 1 } },
      { c: V(0, 0.696, -0.003), rx: 0.03, ry: 0.028, w: { neck: 0.4, chest: 0.6 } },
    ],
    { segs: 16, sub: 3, open: true, mode: SKIN, color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.25 + 0.5 * smooth(0.71, 0.742, i.P.y) * smooth(-0.6, 0.5, i.s)) }
  );

  // ---- her body, in her top (as Lorelei's is under her cardigan — a little fuller in a knit or a hoodie)
  const BODY = [
    [0.718, 0.024, 0.024, 0.024, { neck: 1 }],
    [0.7055, 0.045, 0.033, 0.035, { neck: 0.35, chest: 0.65 }],
    [0.686, 0.0695, 0.043, 0.043, { chest: 1 }],
    [0.65, 0.0675, 0.05, 0.045, { chest: 1 }],
    [0.595, 0.0634, 0.051, 0.043, { chest: 1 }],
    [0.54, 0.059, 0.047, 0.042, { chest: 0.45, spine: 0.55 }],
    [0.495, 0.061, 0.048, 0.046, { spine: 0.6, hips: 0.4 }],
    [0.445, 0.066, 0.052, 0.054, { hips: 1 }],
    [0.408, 0.058, 0.047, 0.049, { hips: 1 }],
  ];
  const bulk = { knit: 1.12, hoodie: 1.15, cardigan: 1.0, tee: 1.03, blouse: 1.02, dress: 1.02 }[top] || 1;
  const long = top === 'knit' || top === 'hoodie'; // (a top that comes down over the waist of her skirt or her trousers: they are hidden under it)
  /** Her body in her top at the height y: [half-width, in front, behind]. */
  const bodyAt = (y) => {
    const rows = BODY;
    let i = 0;
    while (i < rows.length - 2 && rows[i + 1][0] > y) i++;
    const a = rows[i];
    const b = rows[i + 1];
    const f = clamp((a[0] - y) / (a[0] - b[0]), 0, 1);
    return [lerp(a[1], b[1], f) * bulk, lerp(a[2], b[2], f) * bulk, lerp(a[3], b[3], f) * bulk];
  };
  /** A ring of something worn below her top, at the height y: under a long top, inside it; over a short one, clearly outside it. */
  const below = (y, rx, ry, ryB) => {
    if (long && y > 0.445) return [rx * 0.86, ry * 0.86, ryB * 0.86];
    if (y < 0.44) return [rx, ry, ryB];
    const [bx, by, bb] = bodyAt(y);
    return [Math.max(rx, bx + 0.005), Math.max(ry, by + 0.005), Math.max(ryB, bb + 0.005)];
  };
  const knitted = top === 'knit';
  const topInk = top === 'cardigan' ? [ink.top2, ink.top2Deep] : [ink.top, ink.topDeep];
  const NECKLINE = top === 'knit' || top === 'hoodie' ? 4 : 9; // (a knit and a hoodie come up round the base of her neck)
  skin.loft(
    BODY.map(([y, rx, ry, ryB, w], r) => {
      const k = r >= 2 ? bulk : 1 + (bulk - 1) * 0.5 * r;
      return { c: V(0, y, r >= 3 ? 0.001 * (bulk - 1) * 20 : 0), rx: rx * k, ry: ry * k, ryB: ryB * k, w };
    }),
    {
      segs: 40,
      sub: (i) => (i < 2 ? NECKLINE : 3),
      n: 2.15,
      cap: 0.15,
      mode: knitted ? RIBS : PLAIN,
      tz: () => 64, // (a knit: ribs all round it)
      warp: (P, i) => (P.y += (0.0056 - 0.0062 * i.s + 0.0074 * Math.cos(2 * i.a)) * Math.max(0, 1 - Math.abs(i.r - NECKLINE) / NECKLINE)),
      color: (i) => {
        if (i.r <= NECKLINE && NECKLINE > 4) return col.copy(ink.skin).lerp(ink.skinDeep, 0.3 + 0.3 * smooth(NECKLINE - 4, NECKLINE, i.r));
        return col.copy(topInk[0]).lerp(topInk[1], clamp(0.4 * smooth(0.045, 0.07, Math.abs(i.P.x)) + 0.3 * smooth(0.55, 0.47, i.P.y) + 0.2 * smooth(0.3, -0.7, i.s), 0, 1));
      },
    }
  );
  // the neckband of a knit, the rim of a hoodie's neck; the collar of a blouse or a dress
  if (top === 'knit' || top === 'hoodie') {
    skin.loft(
      [[0.724, 0.03, 0.03], [0.719, 0.034, 0.033], [0.708, 0.038, 0.036], [0.7, 0.036, 0.034]].map(([y, rx, ry]) => ({ c: V(0, y, 0.001), rx, ry, w: { neck: 0.6, chest: 0.4 } })),
      { segs: 32, sub: 2, open: true, mode: top === 'knit' ? RIBS : PLAIN, tz: () => 48, color: () => col.copy(ink.top).lerp(ink.topDeep, 0.15) }
    );
  }
  if (top === 'blouse' || top === 'dress') collar(ink.top2, ink.acc);
  if (top === 'hoodie') hood();
  if (top === 'cardigan') cardigan();
  // a hem round her hips (over her skirt or her trousers)
  if (top === 'knit' || top === 'hoodie') {
    const HEM = { rx: 0.079 * bulk, ry: 0.064 * bulk, ryB: 0.066 * bulk };
    skin.loft(
      [[0.452, 0], [0.444, 0.004], [0.428, 0.0055], [0.421, 0.004], [0.418, 0.0005]].map(([y, d]) => ({ c: V(0, y, 0.002), rx: HEM.rx + d, ry: HEM.ry + d, ryB: HEM.ryB + d, w: { hips: 1 } })),
      { segs: 40, sub: 2, open: true, mode: RIBS, tz: () => 90, color: (i) => col.copy(ink.top).lerp(ink.topDeep, 0.2 + 0.2 * smooth(0.3, -0.7, i.s)) }
    );
    // (and the knit — or the hoodie — falls to it: a loose band from her waist to the hem)
    skin.loft(
      [[0.5, 0.069, 0.056, 0.054], [0.475, 0.077, 0.063, 0.063], [0.452, 0.079, 0.064, 0.066]].map(([y, rx, ry, ryB]) => ({ c: V(0, y, 0.002), rx: rx * bulk, ry: ry * bulk, ryB: ryB * bulk, w: { spine: smooth(0.44, 0.5, y) * 0.5, hips: 1 - smooth(0.44, 0.5, y) * 0.5 } })),
      { segs: 40, sub: 3, open: true, mode: knitted ? RIBS : PLAIN, tz: () => 64, color: (i) => col.copy(ink.top).lerp(ink.topDeep, 0.25 + 0.2 * smooth(0.3, -0.7, i.s)) }
    );
  }
  if (top === 'hoodie') pocket();

  // ---- below: a skirt, a long skirt, trousers, shorts — or the skirt of her dress
  if (bottom === 'skirt' || bottom === 'dress' || bottom === 'midi') skirt(bottom);
  else trousers(bottom === 'shorts');

  // ---- her legs, her socks, her shoes
  for (const side of ['L', 'R']) legAndShoe(side);

  // ---- her arms: sleeves as her top has them, and her hands
  for (const side of ['L', 'R']) arm(side);

  // ---- her hair
  const head = new Rings(HEAD, V(0, HEAD_Y, 0), HEAD_N, HEAD_NB);
  hair();

  const geometry = skin.geometry();

  // ---- assemble
  const group = new THREE.Group();
  group.name = 'me';
  group.add(bones.root);
  group.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton(list);
  const light = { uLight: { value: new THREE.Color(1, 1, 1) }, uSun: { value: 1 }, uMid: { value: V(0, 0.6, 0) }, uSunDir: FUR_SUN, uClear: { value: 0.9 * ME_SIZE } };
  // (a checked skirt: its squares, the bands between them, where two cross, the thread through them)
  const ck = look.bottom.check;
  const checks = {
    uCkA: { value: ink.bottom.clone() },
    uCkB: { value: ck ? C(ck.band) : ink.bottomDeep.clone() },
    uCkC: { value: ck ? C(ck.band).lerp(C('#2a2030'), 0.25) : ink.bottomDeep.clone() },
    uCkD: { value: ck ? C(ck.line) : ink.bottom.clone() },
  };
  const material = dress(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), { ...light, ...checks }, { LORELEI_TEX: 1 });
  const mesh = new THREE.SkinnedMesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  group.add(mesh);
  mesh.bind(skeleton);

  // ---- her head: Lorelei's shape, her own face
  const hs = new Skin({ head: 0 });
  const faceAngles = Array.from({ length: 64 }, (_, j) => (j / 64) * TAU + 0.45 * Math.cos((j / 64) * TAU));
  hs.loft(head.keys({ head: 1 }), {
    angles: faceAngles,
    sub: (i) => (i < 3 ? 3 : 5),
    n: HEAD_N,
    nB: HEAD_NB,
    frame: LEVEL,
    cap: 0.1,
    capTop: 0.3,
    mode: SKIN,
    tex: (i, tex) => {
      tex[0] = (i.P.x + FACE.half) / (2 * FACE.half);
      tex[1] = (i.P.y - HEAD_Y - FACE.bottom) / (FACE.top - FACE.bottom);
      tex[2] = smooth(0.06, 0.2, i.s);
    },
    warp: (P, i) => {
      const y = P.y - HEAD_Y;
      const f = Math.max(0, i.s);
      P.z += f * (0.005 * bump(P.x, 0, 0.045) * smooth(-0.105, -0.07, y) + 0.0115 * bump(P.x, 0, 0.0105) * bump(y, NOSE_Y, 0.024, 0.0075) + 0.0024 * bump(P.x, 0, 0.013) * bump(y, MOUTH.y - 0.001, 0.007) + 0.002 * bump(P.x, 0, 0.02) * bump(y, -0.108, 0.008));
    },
    color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.55 * smooth(-0.1, -0.118, i.P.y - HEAD_Y) + 0.3 * smooth(0.2, -0.5, i.s)),
  });
  for (const sg of [-1, 1]) {
    hs.loft(
      [
        { c: V(sg * 0.08, 0.806, -0.008), rx: 0.027, ry: 0.0125, w: { head: 1 } },
        { c: V(sg * 0.094, 0.807, -0.014), rx: 0.0275, ry: 0.012, w: { head: 1 } },
        { c: V(sg * 0.1, 0.808, -0.019), rx: 0.022, ry: 0.0075, w: { head: 1 } },
      ],
      { segs: 14, sub: 3, side: Y_AXIS, cap: 0.35, mode: SKIN, tex: (i, tex) => (tex[0] = tex[1] = tex[2] = 0), color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.25 + 0.4 * smooth(0.55, 1, i.v)) }
    );
  }
  const headGeo = new THREE.BufferGeometry();
  const hp = new Float32Array(hs.pos.length);
  for (let i = 0; i < hs.pos.length; i += 3) {
    hp[i] = hs.pos[i] - J.head.x;
    hp[i + 1] = hs.pos[i + 1] - J.head.y;
    hp[i + 2] = hs.pos[i + 2] - J.head.z;
  }
  const face3 = new Float32Array(hs.count * 3);
  for (let i = 0; i < hs.count; i++) face3.set([hs.tex[i * 4], hs.tex[i * 4 + 1], hs.tex[i * 4 + 2]], i * 3);
  headGeo.setAttribute('position', new THREE.BufferAttribute(hp, 3));
  headGeo.setAttribute('color', new THREE.Float32BufferAttribute(hs.col, 3));
  headGeo.setAttribute('aFace', new THREE.BufferAttribute(face3, 3));
  headGeo.setIndex(hs.idx);
  headGeo.computeVertexNormals();
  const faces = new Map();
  const faceMap = { value: null };
  const headMat = dress(new THREE.MeshLambertMaterial({ vertexColors: true }), { ...light, uFaceMap: faceMap, uSkin: { value: ink.skin.clone() } }, { LORELEI_FACE: 1 });
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.castShadow = true;
  bones.head.add(headMesh);
  const face = {
    key: '',
    show(eyes, mouth, blush = 0) {
      const key = `${eyes}|${mouth}|${blush ? 1 : 0}`;
      if (key === this.key) return;
      this.key = key;
      if (!faces.has(key)) faces.set(key, paintFace(look, eyes, mouth, blush ? 1 : 0));
      faceMap.value = faces.get(key);
    },
  };
  face.show('open', 'flat');

  // ---- what she has in her hair, on her nose, round her neck
  const extras = [];
  const wearOn = (bone, object) => {
    object.traverse((o) => {
      if (o.isMesh) o.castShadow = true;
    });
    bones[bone].add(object);
    extras.push(object);
  };
  accessories();

  // (the animator looks for an umbrella and a bag in her hands, as Lorelei has: she has neither)
  const umbrella = new THREE.Group();
  const bag = new THREE.Group();
  umbrella.visible = bag.visible = false;
  bones.handL.add(umbrella);
  bones.handR.add(bag);

  group.scale.setScalar(ME_SIZE);
  return {
    group,
    bones,
    skeleton,
    mesh,
    head: headMesh,
    face,
    tail,
    tail2,
    umbrella,
    bag,
    scale: 1,
    size: ME_SIZE,
    light,
    look,
    rest: { arm: { L: armJ(1), R: armJ(-1) }, leg: { L: legJ(1), R: legJ(-1) } },
    dims: { height: 1, crown: V(0, 1.004 - J.head.y, 0), eyes: V(0, HEAD_Y + EYE.y - J.head.y, 0.1), palm: V(0, -0.03, 0.01) },
    dispose() {
      geometry.dispose();
      material.dispose();
      skeleton.dispose();
      headGeo.dispose();
      headMat.dispose();
      faces.forEach((t) => t.dispose());
      extras.forEach((g) =>
        g.traverse((o) => {
          if (o.geometry) o.geometry.dispose();
          if (o.material && !(o.material.userData && o.material.userData.shared)) o.material.dispose();
        })
      );
    },
  };

  // ================================================================== the parts (they share what is above)

  /* A blouse's or a dress's collar: two round white flaps over her collarbones — and on a blouse, a little bow between them. */
  function collar(cloth, bow) {
    for (const sg of [-1, 1]) {
      const pts = [V(sg * 0.006, 0.705, 0.04), V(sg * 0.022, 0.708, 0.038), V(sg * 0.038, 0.71, 0.03), V(sg * 0.05, 0.712, 0.016)];
      skin.loft(
        pts.map((p, k) => ({ c: p, rx: [0.012, 0.018, 0.017, 0.012][k], ry: 0.003, w: { chest: 0.7, neck: 0.3 }, up: V(sg * 0.2, 0.5, 1).normalize() })),
        { segs: 12, sub: 3, cap: 0.7, color: () => col.copy(cloth) }
      );
    }
    if (top !== 'blouse') return;
    for (const sg of [-1, 1])
      skin.loft(
        [V(0, 0.7, 0.048), V(sg * 0.012, 0.703, 0.05), V(sg * 0.02, 0.698, 0.049)].map((p, k) => ({ c: p, rx: [0.004, 0.009, 0.006][k], ry: 0.004, w: { chest: 1 } })),
        { segs: 10, sub: 3, cap: 0.6, color: () => col.copy(bow) }
      );
    skin.loft([V(0, 0.704, 0.049), V(0, 0.698, 0.05)].map((p) => ({ c: p, rx: 0.0045, ry: 0.004, w: { chest: 1 } })), { segs: 10, sub: 2, cap: 0.8, color: () => col.copy(bow).multiplyScalar(0.9) });
  }

  /* A hoodie's hood, lying soft on her shoulders behind her neck; its two strings down her front. */
  function hood() {
    skin.loft(
      [
        { c: V(0, 0.772, -0.058), rx: 0.03, ry: 0.014, ryB: 0.02, w: { neck: 0.5, chest: 0.5 } },
        { c: V(0, 0.758, -0.07), rx: 0.07, ry: 0.024, ryB: 0.032, w: { chest: 1 } },
        { c: V(0, 0.72, -0.076), rx: 0.084, ry: 0.028, ryB: 0.036, w: { chest: 1 } },
        { c: V(0, 0.675, -0.072), rx: 0.074, ry: 0.026, ryB: 0.03, w: { chest: 1 } },
        { c: V(0, 0.64, -0.064), rx: 0.04, ry: 0.016, ryB: 0.016, w: { chest: 1 } },
      ],
      { segs: 24, sub: 3, cap: 0.5, color: (i) => col.copy(ink.top).lerp(ink.topDeep, 0.25 + 0.35 * smooth(0.2, -0.8, -i.s)) }
    );
    for (const sg of [-1, 1])
      skin.loft(
        [V(sg * 0.018, 0.705, 0.04), V(sg * 0.02, 0.67, 0.058), V(sg * 0.021, 0.632, 0.062), V(sg * 0.022, 0.612, 0.062)].map((p, k) => ({ c: p, rx: k === 3 ? 0.004 : 0.0022, ry: k === 3 ? 0.004 : 0.0022, w: { chest: 1 } })),
        { segs: 6, sub: 2, cap: 0.6, color: () => col.set('#fbf7f2') }
      );
  }

  /* …and the pocket across its front. */
  function pocket() {
    skin.loft(
      [0.528, 0.522, 0.49, 0.462, 0.456].map((y, k) => ({ c: V(0, y, 0.064 * bulk + 0.004), rx: [0.034, 0.05, 0.055, 0.056, 0.05][k], ry: [0.002, 0.004, 0.004, 0.004, 0.002][k], w: { spine: 0.5, hips: 0.5 } })),
      { segs: 20, sub: 2, n: 2.6, cap: 0.3, color: (i) => col.copy(ink.top).lerp(ink.topDeep, 0.15 + 0.4 * smooth(0.2, -0.6, i.s)) }
    );
  }

  /* A cardigan over her top: Lorelei's, open in front, its sleeves wide and turned back at the cuff (arm() makes them). */
  function cardigan() {
    const GAP = 0.5;
    const A0 = Math.PI / 2 + GAP;
    const A1 = Math.PI / 2 - GAP + TAU;
    const nearEdge = (a) => Math.min(a - A0, A1 - a);
    const folds = (i) => Math.sin(i.a * 5 + 1.1) * smooth(0.3, 0.85, i.v) * smooth(0, 0.5, nearEdge(i.a));
    const HEM = { rx: 0.128, ry: 0.116, ryB: 0.084, z: 0.008 };
    skin.loft(
      [
        { c: V(0, 0.719, -0.008), rx: 0.041, ry: 0.016, ryB: 0.04, w: { chest: 0.6, neck: 0.4 } },
        { c: V(0, 0.71, -0.004), rx: 0.077, ry: 0.05, ryB: 0.054, w: { chest: 1 } },
        { c: V(0, 0.69, 0), rx: 0.104, ry: 0.076, ryB: 0.064, w: { chest: 1 } },
        { c: V(0, 0.645, 0.004), rx: 0.108, ry: 0.094, ryB: 0.066, w: { chest: 1 } },
        { c: V(0, 0.555, 0.006), rx: 0.113, ry: 0.102, ryB: 0.072, w: { chest: 0.45, spine: 0.55 } },
        { c: V(0, 0.47, 0.008), rx: 0.122, ry: 0.111, ryB: 0.08, w: { spine: 0.4, hips: 0.6 } },
        { c: V(0, 0.43, HEM.z), rx: HEM.rx, ry: HEM.ry, ryB: HEM.ryB, w: { hips: 1 } },
      ],
      {
        segs: 40,
        sub: 4,
        n: 2.2,
        arc: [A0, A1],
        warp: (P, i) => {
          const open = lerp(1.3, GAP, smooth(0, 0.3, i.v));
          const a = 1.5 * Math.PI + (i.a - 1.5 * Math.PI) * ((Math.PI - open) / (Math.PI - GAP));
          const ca = Math.cos(a);
          const sa = Math.sin(a);
          const r = i.ring;
          P.copy(r.c)
            .addScaledVector(r.s, r.rx * Math.sign(ca) * Math.abs(ca) ** (2 / 2.2))
            .addScaledVector(r.u, (sa >= 0 ? r.ry : r.ryB) * Math.sign(sa) * Math.abs(sa) ** (2 / 2.2));
          const k = 0.022 * folds(i);
          P.x += (P.x - r.c.x) * k;
          P.z += (P.z - r.c.z) * k;
        },
        color: (i) => col.copy(ink.top).lerp(ink.topDeep, clamp(0.3 * (0.5 - 0.5 * folds(i)) * smooth(0.3, 0.85, i.v) + 0.25 * smooth(0.3, -0.8, i.s) * smooth(0.5, 1, i.v), 0, 1)),
      }
    );
    skin.loft(
      [[0.433, 0.0005], [0.424, 0.004], [0.408, 0.0045], [0.398, 0.0015], [0.3955, -0.004]].map(([y, d]) => ({ c: V(0, y, HEM.z), rx: HEM.rx + d, ry: HEM.ry + d, ryB: HEM.ryB + d, w: { hips: 1 } })),
      { segs: 40, sub: 2, n: 2.2, arc: [A0, A1], mode: RIBS, tz: () => 110, color: (i) => col.copy(ink.top).lerp(ink.topDeep, 0.15 + 0.5 * smooth(0.5, 1, i.v)) }
    );
  }

  /* A skirt: short and pleated (checked, if she chose a check) — or long and flared, or the skirt of her dress. */
  function skirt(kind) {
    const pleat = (a) => {
      const f = ((((a / TAU) * CHECKS) % 1) + 1) % 1;
      return f < 0.86 ? f / 0.86 : (1 - f) / 0.14;
    };
    const checked = kind === 'skirt' && !!look.bottom.check;
    const cloth = kind === 'dress' ? [ink.top, ink.topDeep] : [ink.bottom, ink.bottomDeep];
    const rows =
      kind === 'midi'
        ? [
            [0.512, 0.057, 0.046, 0.042, { spine: 0.6, hips: 0.4 }],
            [0.497, 0.0645, 0.053, 0.051, { hips: 1 }],
            [0.44, 0.085, 0.075, 0.074, { hips: 1 }],
            [0.35, 0.11, 0.098, 0.094, { hips: 0.55, thighL: 0.225, thighR: 0.225 }],
            [0.25, 0.128, 0.114, 0.108, { hips: 0.35, thighL: 0.2, thighR: 0.2, shinL: 0.125, shinR: 0.125 }],
            [0.17, 0.138, 0.122, 0.116, { hips: 0.25, thighL: 0.15, thighR: 0.15, shinL: 0.225, shinR: 0.225 }],
          ]
        : kind === 'dress'
          ? [
              [0.53, 0.061, 0.05, 0.045, { spine: 0.7, hips: 0.3 }],
              [0.505, 0.066, 0.056, 0.053, { spine: 0.3, hips: 0.7 }],
              [0.458, 0.084, 0.074, 0.072, { hips: 1 }],
              [0.4, 0.103, 0.092, 0.088, { hips: 0.7, thighL: 0.15, thighR: 0.15 }],
              [0.345, 0.116, 0.104, 0.098, { hips: 0.5, thighL: 0.25, thighR: 0.25 }],
            ]
          : [
              [0.512, 0.057, 0.046, 0.042, { spine: 0.6, hips: 0.4 }],
              [0.497, 0.0645, 0.053, 0.051, { hips: 1 }],
              [0.458, 0.079, 0.069, 0.069, { hips: 1 }],
              [0.41, 0.093, 0.082, 0.078, { hips: 0.7, thighL: 0.15, thighR: 0.15 }],
              [0.366, 0.102, 0.09, 0.084, { hips: 0.5, thighL: 0.25, thighR: 0.25 }],
            ];
    const flare = kind === 'midi' ? 0.06 : kind === 'dress' ? 0.07 : 0.1;
    const made = skin.loft(
      rows.map(([y, rx0, ry0, ryB0, w]) => {
        const [rx, ry, ryB] = kind === 'dress' ? [rx0, ry0, ryB0] : below(y, rx0, ry0, ryB0);
        return { c: V(0, y, 0.004 * smooth(0.5, 0.36, y)), rx, ry, ryB, w };
      }),
      {
        segs: CHECKS * 6,
        sub: 4,
        open: true,
        mode: checked ? CHECK : PLAIN,
        tz: (i) => (0.5 - i.ring.c.y) / 0.034,
        warp: (P, i) => {
          const hidden = long ? smooth(0.43, 0.39, i.ring.c.y) : 1; // (under a knit or a hoodie, the pleats open below its hem)
          const d = flare * hidden * smooth(0.1, 1, i.v) * ((kind === 'skirt' ? pleat(i.a) : 0.5 + 0.5 * Math.sin(i.a * 9)) - 0.45);
          P.x += (P.x - i.ring.c.x) * d;
          P.z += (P.z - i.ring.c.z) * d;
        },
        color: (i) => {
          const fold = kind === 'skirt' ? 0.3 * smooth(0.5, 0.05, pleat(i.a)) : 0.22 * (0.5 - 0.5 * Math.sin(i.a * 9));
          const k = fold * smooth(0.1, 0.7, i.v) + 0.2 * smooth(0.2, 0, i.v);
          if (checked) return col.setScalar(1 - k);
          return col.copy(cloth[0]).lerp(cloth[1], clamp(k * 1.6, 0, 1));
        },
      }
    );
    // (each side of its hem goes with the leg under it)
    for (let q = made.base; q < skin.count; q++) {
      for (const [a, b] of [['thighL', 'thighR'], ['shinL', 'shinR']]) {
        const slot = (name) => [0, 1, 2, 3].find((s) => skin.skinW[q * 4 + s] > 0 && skin.skinI[q * 4 + s] === boneIndex[name]);
        const l = slot(a);
        const r = slot(b);
        if (l == null || r == null) continue;
        const both = skin.skinW[q * 4 + l] + skin.skinW[q * 4 + r];
        skin.skinW[q * 4 + l] = both * smooth(-0.04, 0.04, skin.pos[q * 3]);
        skin.skinW[q * 4 + r] = both - skin.skinW[q * 4 + l];
      }
    }
    // (a waistband on a skirt — under a long top it would not show)
    if (kind !== 'dress' && !long)
      skin.loft(
        [[0.524, 0.0575, 0.047, 0.043], [0.513, 0.059, 0.048, 0.044], [0.502, 0.0625, 0.051, 0.048]].map(([y, a, b, c]) => {
          const [rx, ry, ryB] = below(y, a, b, c);
          return { c: V(0, y, 0), rx: rx + 0.002, ry: ry + 0.002, ryB: ryB + 0.002, w: { spine: 0.5, hips: 0.5 } };
        }),
        { segs: 40, sub: 2, open: true, color: () => (checked ? col.copy(ink.bottom).lerp(ink.bottomDeep, 0.3) : col.copy(ink.bottom).lerp(ink.bottomDeep, 0.25)) }
      );
  }

  /* Trousers — long ones of denim, or shorts: round her hips, and down each leg. */
  function trousers(short) {
    const denim = (i, k = 0) => col.copy(ink.bottom).lerp(ink.bottomDeep, clamp(k + 0.3 * smooth(0.3, -0.8, i.s) + 0.25 * bump(Math.abs(i.c), 1, 0.15), 0, 1));
    skin.loft(
      [
        [0.522, 0.0585, 0.048, 0.044, { spine: 0.5, hips: 0.5 }],
        [0.505, 0.064, 0.052, 0.05, { hips: 1 }],
        [0.46, 0.073, 0.059, 0.063, { hips: 1 }],
        [0.425, 0.073, 0.058, 0.063, { hips: 1 }],
        [0.402, 0.064, 0.05, 0.056, { hips: 1 }],
      ].map(([y, a, b, c, w]) => {
        const [rx, ry, ryB] = below(y, a, b, c);
        return { c: V(0, y, 0), rx, ry, ryB, w };
      }),
      { segs: 40, sub: 3, cap: 0.3, color: (i) => denim(i) }
    );
    // (its waistband — under a long top it would not show)
    if (!long)
      skin.loft(
        [[0.53, 0.0585, 0.0485, 0.0445], [0.518, 0.0605, 0.05, 0.047], [0.506, 0.0645, 0.0525, 0.0505]].map(([y, a, b, c]) => {
          const [rx, ry, ryB] = below(y, a, b, c);
          return { c: V(0, y, 0), rx: rx + 0.002, ry: ry + 0.002, ryB: ryB + 0.002, w: { spine: 0.5, hips: 0.5 } };
        }),
        { segs: 40, sub: 2, open: true, color: (i) => denim(i, 0.2) }
      );
    for (const side of ['L', 'R']) {
      const sg = side === 'L' ? 1 : -1;
      const T = `thigh${side}`;
      const Sh = `shin${side}`;
      const keys = [
        { c: V(sg * 0.038, 0.445, 0.004), rx: 0.046, ry: 0.05, w: { hips: 0.8, [T]: 0.2 } },
        { c: V(sg * 0.046, 0.4, 0.003), rx: 0.043, ry: 0.046, w: { hips: 0.35, [T]: 0.65 } },
        { c: V(sg * 0.0515, 0.36, 0.002), rx: 0.0405, ry: 0.0425, w: { hips: 0.1, [T]: 0.9 } },
        { c: V(sg * 0.0535, 0.32, -0.001), rx: 0.0385, ry: 0.041, w: { [T]: 1 } },
      ];
      if (!short)
        keys.push(
          { c: V(sg * 0.0565, 0.232, -0.008), rx: 0.0355, ry: 0.038, w: { [T]: 0.5, [Sh]: 0.5 } },
          { c: V(sg * 0.0585, 0.16, -0.015), rx: 0.034, ry: 0.036, w: { [Sh]: 1 } },
          { c: V(sg * 0.0605, 0.085, -0.021), rx: 0.0355, ry: 0.0375, w: { [Sh]: 1 } },
          { c: V(sg * 0.061, 0.062, -0.022), rx: 0.0362, ry: 0.0382, w: { [Sh]: 1 } }
        );
      skin.loft(keys, { segs: 18, sub: 3, open: true, color: (i) => denim(i, short ? 0 : 0.1 * smooth(0.25, 0.1, i.P.y)) });
      // (a turned-up hem)
      const end = keys[keys.length - 1];
      skin.loft(
        [[0.004, 0], [0.0045, -0.008], [0.0035, -0.016]].map(([d, dy]) => ({ c: V(end.c.x, end.c.y + dy + 0.006, end.c.z), rx: end.rx + d, ry: end.ry + d, w: end.w })),
        { segs: 18, sub: 2, open: true, color: (i) => denim(i, -0.12) }
      );
    }
  }

  /* A leg: bare (or in socks, in tights) from what she wears above it down to her shoes — and the shoe. */
  function legAndShoe(side) {
    const sg = side === 'L' ? 1 : -1;
    const T = `thigh${side}`;
    const Sh = `shin${side}`;
    const F = `foot${side}`;
    const legs = look.legs.kind;
    // where the leg shows from (under a skirt, shorts) and down to (the shoe)
    const from = bottom === 'jeans' ? null : bottom === 'midi' ? 0.2 : 0.425;
    const to = lowShoes ? 0.05 : 0.13;
    // the colour of a point of the leg: skin — or the sock up to its top, or the tights all the way
    const sockTop = legs === 'knee' ? 0.258 : legs === 'ankle' ? 0.088 : legs === 'tights' ? 1 : -1;
    if (from != null) {
      const rows = [
        [0.425, sg * 0.0505, 0.004, 0.0365, 0.039, { hips: 0.6, [T]: 0.4 }],
        [0.36, sg * 0.0525, 0.002, 0.0365, 0.0385, { [T]: 1 }],
        [0.29, sg * 0.0548, -0.002, 0.034, 0.036, { [T]: 1 }],
        [0.232, sg * 0.0565, -0.008, 0.0318, 0.034, { [T]: 0.5, [Sh]: 0.5 }],
        [0.19, sg * 0.0582, -0.013, 0.03, 0.0315, { [Sh]: 1 }],
        [0.13, sg * 0.06, -0.019, 0.0275, 0.0295, { [Sh]: 1 }],
        [0.085, sg * 0.0615, -0.022, 0.025, 0.027, { [Sh]: 1 }],
        [0.05, sg * 0.063, -0.024, 0.0245, 0.0265, { [Sh]: 0.4, [F]: 0.6 }],
      ].filter(([y]) => y <= from + 1e-6 && y >= to - 1e-6);
      skin.loft(
        rows.map(([y, x, z, rx, ry, w]) => ({ c: V(x, y, z), rx: rx * (legs === 'tights' || y < sockTop ? 1.03 : 1), ry: ry * (legs === 'tights' || y < sockTop ? 1.03 : 1), w })),
        {
          segs: 16,
          sub: 3,
          mode: legs === 'tights' ? PLAIN : SKIN,
          color: (i) => {
            if (i.P.y < sockTop) return col.copy(ink.sock).lerp(ink.sockDeep, clamp(0.3 * smooth(0.3, -0.7, i.s) + 0.3 * smooth(sockTop - 0.01, sockTop, i.P.y), 0, 1));
            return col.copy(ink.skin).lerp(ink.skinDeep, clamp(0.75 * smooth(from - 0.09, from - 0.035, i.P.y) + 0.25 * smooth(0.3, -0.7, i.s), 0, 1)).lerp(ink.skinRose, 0.3 * bump(i.P.y, 0.236, 0.02) * smooth(0.2, 0.9, i.s));
          },
        }
      );
      // (the top of a sock: a band round the leg)
      if (sockTop > 0 && sockTop < from) {
        const y = sockTop;
        const x = sg * lerp(0.0565, 0.063, smooth(0.232, 0.05, y));
        const z = lerp(-0.008, -0.024, smooth(0.232, 0.05, y));
        const r = lerp(0.033, 0.026, smooth(0.232, 0.05, y));
        skin.loft(
          [[y + 0.008, r + 0.0018], [y + 0.004, r + 0.0032], [y - 0.006, r + 0.0032], [y - 0.01, r + 0.0018]].map(([yy, rr]) => ({ c: V(x, yy, z), rx: rr, ry: rr * 1.06, w: { [y > 0.2 ? T : Sh]: 0.3, [Sh]: 0.7 } })),
          { segs: 16, sub: 2, mode: RIBS, tz: () => 28, color: () => col.copy(ink.sock).lerp(ink.sockDeep, 0.1) }
        );
      }
    }
    shoe(side, sg, Sh, F);
  }

  /* A shoe: soft slouching boots (Lorelei's), sneakers, Mary Janes, fluffy slippers. */
  function shoe(side, sg, Sh, F) {
    const kind = look.shoes.kind;
    const bx = (y) => sg * lerp(0.065, 0.0592, y / 0.2);
    const bz = (y) => lerp(-0.028, -0.0125, smooth(0.06, 0.2, y));
    const upper = (i, k = 0) => col.copy(ink.shoe).lerp(ink.shoeDeep, clamp(k + 0.35 * smooth(0.2, -0.7, i.s), 0, 1));
    const soleIn = (i) => smooth(0.016, 0.009, i.P.y);
    if (kind === 'boots') {
      const fold = (P, i) => {
        const y = i.ring.c.y;
        const k = (0.07 * bump(y, 0.1, 0.02) + 0.06 * bump(y, 0.065, 0.016)) * Math.sin(i.a * 2 + sg * 0.8 + y * 30) + 0.03 * bump(y, 0.15, 0.03) * Math.sin(i.a * 3 + sg);
        P.x += (P.x - i.ring.c.x) * k;
        P.z += (P.z - i.ring.c.z) * k;
        P.y += 0.006 * bump(y, 0.085, 0.05) * Math.sin(i.a + 1.2 * sg);
      };
      const shaft = (rows, w) => rows.map(([y, rx, ry, ryB], k) => ({ c: V(bx(y), y, bz(y)), rx, ry, ryB: ryB || ry, w: w(y, k) }));
      skin.loft(shaft([[0.197, 0.043, 0.0445], [0.1958, 0.039, 0.0405], [0.189, 0.0345, 0.036], [0.169, 0.03, 0.032]], () => ({ [Sh]: 1 })), {
        segs: 18,
        sub: 2,
        open: true,
        color: (i) => col.copy(ink.shoe).lerp(ink.sole, smooth(0.05, 0.5, i.v)),
      });
      skin.loft(
        shaft(
          [[0.197, 0.043, 0.0445], [0.182, 0.045, 0.0468], [0.148, 0.0445, 0.046], [0.118, 0.046, 0.0476], [0.1, 0.043, 0.0446], [0.083, 0.047, 0.05, 0.048], [0.065, 0.0445, 0.0485, 0.046], [0.043, 0.0475, 0.052, 0.048], [0.016, 0.0478, 0.052, 0.048], [0.003, 0.0445, 0.048, 0.045]],
          (y) => ({ [Sh]: smooth(0.045, 0.095, y), [F]: 1 - smooth(0.045, 0.095, y) })
        ),
        { segs: 20, sub: 3, n: 2.2, cap: 0.04, capTop: 0, warp: fold, color: (i) => upper(i, 0.6 * bump(i.ring.c.y, 0.1, 0.011) + 0.5 * bump(i.ring.c.y, 0.065, 0.009)).lerp(ink.sole, soleIn(i)) }
      );
    }
    // the foot of the shoe (every kind has one): round at the toe, its sole
    const foot = {
      boots: [[0.03, -0.064, 0.028, 0.03, 0.028], [0.034, -0.028, 0.0445, 0.046, 0.034], [0.034, 0.018, 0.0475, 0.041, 0.034], [0.032, 0.058, 0.047, 0.035, 0.032], [0.03, 0.088, 0.039, 0.029, 0.03], [0.028, 0.102, 0.02, 0.017, 0.02]],
      sneakers: [[0.034, -0.066, 0.026, 0.034, 0.03], [0.04, -0.03, 0.04, 0.044, 0.036], [0.038, 0.016, 0.043, 0.038, 0.036], [0.034, 0.056, 0.043, 0.033, 0.034], [0.03, 0.086, 0.036, 0.027, 0.03], [0.026, 0.1, 0.018, 0.016, 0.018]],
      maryjane: [[0.028, -0.062, 0.024, 0.026, 0.024], [0.03, -0.028, 0.036, 0.033, 0.028], [0.029, 0.016, 0.038, 0.028, 0.027], [0.026, 0.054, 0.038, 0.024, 0.025], [0.023, 0.082, 0.031, 0.02, 0.022], [0.021, 0.096, 0.015, 0.012, 0.015]],
      slippers: [[0.034, -0.066, 0.03, 0.03, 0.03], [0.038, -0.03, 0.046, 0.042, 0.038], [0.04, 0.016, 0.05, 0.044, 0.04], [0.038, 0.058, 0.05, 0.04, 0.038], [0.034, 0.09, 0.043, 0.033, 0.034], [0.03, 0.106, 0.022, 0.018, 0.022]],
    }[kind];
    skin.loft(
      foot.map(([y, z, rx, ry, ryB]) => ({ c: V(bx(y), y, z), rx, ry, ryB, w: { [F]: 1 } })),
      {
        segs: 20,
        sub: 3,
        n: 2.25,
        cap: 0.5,
        warp: (P) => (P.y = Math.max(P.y, 0.0015)),
        color: (i) => {
          if (kind === 'sneakers') {
            // (white sole and toe cap round a coloured upper)
            const sole = smooth(0.022, 0.016, i.P.y) + 0.8 * smooth(0.07, 0.09, i.P.z) * smooth(0.04, 0.03, i.P.y);
            return upper(i).lerp(ink.sole, clamp(sole, 0, 1));
          }
          if (kind === 'slippers') return col.copy(ink.shoe).lerp(C('#ffffff'), 0.25 * smooth(0, 1, i.s)).lerp(ink.shoeDeep, 0.3 * smooth(0.2, -0.7, i.s)).lerp(C('#e9dfd8'), smooth(0.012, 0.006, i.P.y));
          return upper(i).lerp(ink.sole, soleIn(i));
        },
      }
    );
    if (kind === 'sneakers') {
      // the collar round the ankle, and the laces
      skin.loft(
        [[0.078, 0.03, 0.032], [0.072, 0.033, 0.035], [0.058, 0.035, 0.038]].map(([y, rx, ry]) => ({ c: V(bx(y), y, -0.03), rx, ry, w: { [Sh]: 0.3, [F]: 0.7 } })),
        { segs: 18, sub: 2, open: true, color: (i) => upper(i, 0.15) }
      );
      for (const z of [-0.004, 0.012, 0.028])
        skin.loft([V(bx(0.05) - 0.018, 0.05 - z * 0.25, z), V(bx(0.05) + 0.018, 0.05 - z * 0.25, z)].map((c) => ({ c: c.clone(), rx: 0.0025, ry: 0.0025, w: { [F]: 1 } })), { segs: 6, sub: 1, cap: 0.6, side: Y_AXIS, color: () => col.set('#fbf8f4') });
    }
    if (kind === 'maryjane') {
      // a strap over her instep, with a button
      skin.loft(
        [V(bx(0.03) + 0.032, 0.026, -0.006), V(bx(0.04) + 0.012, 0.046, -0.004), V(bx(0.04) - 0.012, 0.046, -0.004), V(bx(0.03) - 0.032, 0.026, -0.006)].map((c) => ({ c, rx: 0.006, ry: 0.0025, w: { [F]: 1 }, up: V(0, 1, 0.3).normalize() })),
        { segs: 8, sub: 3, cap: 0.6, color: () => col.copy(ink.shoe).lerp(ink.shoeDeep, 0.15) }
      );
      // (and the top of a white sock or her foot shows round the ankle)
    }
    if (kind === 'slippers') {
      // a fluffy cuff round the opening — and two little ears on the toe
      skin.loft(
        [[0.052, 0.034, 0.036], [0.046, 0.04, 0.042], [0.036, 0.042, 0.045]].map(([y, rx, ry]) => ({ c: V(bx(y), y, -0.026), rx, ry, w: { [F]: 1 } })),
        { segs: 18, sub: 2, open: true, mode: RIBS, tz: () => 60, color: () => col.copy(ink.shoe).lerp(C('#ffffff'), 0.55) }
      );
      for (const s of [-1, 1])
        skin.loft(
          [V(bx(0.06) + s * 0.016, 0.06, 0.05), V(bx(0.08) + s * 0.024, 0.088, 0.044), V(bx(0.09) + s * 0.026, 0.098, 0.04)].map((c, k) => ({ c, rx: [0.009, 0.008, 0.002][k], ry: [0.004, 0.0035, 0.002][k], w: { [F]: 1 }, up: V(0, 0, 1) })),
          { segs: 8, sub: 3, cap: 0.6, color: () => col.copy(ink.shoe).lerp(C('#ffffff'), 0.4) }
        );
    }
  }

  /* An arm: the sleeve of her top (short, puffed, long and fitted, a cardigan's wide one), the arm where it is bare, her hand. */
  function arm(side) {
    const sg = side === 'L' ? 1 : -1;
    const A = `arm${side}`;
    const Fo = `fore${side}`;
    const H = `hand${side}`;
    const { arm: shoulder, fore: elbow, hand: wrist } = armJ(sg);
    const armX = (y) => (y > elbow.y ? lerp(shoulder.x, elbow.x, (shoulder.y - y) / (shoulder.y - elbow.y)) : lerp(elbow.x, wrist.x, (elbow.y - y) / (elbow.y - wrist.y)));
    const armZ = (y) => (y > elbow.y ? -0.004 : lerp(-0.002, 0.003, (elbow.y - y) / (elbow.y - wrist.y)));
    const sleeve = { tee: 'short', blouse: 'puff', dress: 'puff', knit: 'long', hoodie: 'long', cardigan: 'wide' }[top] || 'long';
    const cloth = (i, k = 0) => col.copy(ink.top).lerp(ink.topDeep, clamp(k + 0.3 * smooth(0.3, -0.8, sg * i.c), 0, 1));
    const wA = (y) => (y > 0.66 ? { chest: 0.6, [A]: 0.4 } : y > elbow.y + 0.02 ? { [A]: 1 } : y > elbow.y - 0.02 ? { [A]: 0.5, [Fo]: 0.5 } : { [Fo]: 1 });
    // the bare arm, from where the sleeve ends to her wrist
    const bareFrom = sleeve === 'short' ? 0.625 : sleeve === 'puff' ? 0.615 : null;
    if (bareFrom != null) {
      const ys = [bareFrom + 0.01, 0.6, elbow.y, 0.5, 0.466].filter((y) => y <= bareFrom + 0.011);
      skin.loft(
        ys.map((y) => ({ c: V(armX(y), y, armZ(y)), rx: lerp(0.024, 0.0175, smooth(0.62, 0.47, y)), ry: lerp(0.026, 0.019, smooth(0.62, 0.47, y)), w: wA(y) })),
        { segs: 14, sub: 3, open: true, mode: SKIN, color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.3 * smooth(0.3, -0.8, sg * i.c) + 0.2 * smooth(bareFrom - 0.02, bareFrom, i.P.y)) }
      );
    }
    if (sleeve === 'short') {
      skin.loft(
        [
          { c: V(sg * 0.05, 0.694, -0.004), rx: 0.024, ry: 0.032, w: { chest: 0.85, [A]: 0.15 } },
          { c: V(sg * 0.07, 0.698, -0.004), rx: 0.03, ry: 0.038, w: { chest: 0.75, [A]: 0.25 } },
          { c: V(sg * 0.094, 0.68, -0.004), rx: 0.037, ry: 0.041, w: { chest: 0.3, [A]: 0.7 } },
          { c: V(armX(0.645), 0.645, -0.004), rx: 0.032, ry: 0.035, w: { [A]: 1 } },
          { c: V(armX(0.622), 0.622, -0.004), rx: 0.0305, ry: 0.0335, w: { [A]: 1 } },
        ],
        { segs: 18, sub: 3, open: true, color: (i) => cloth(i) }
      );
    } else if (sleeve === 'puff') {
      skin.loft(
        [
          { c: V(sg * 0.05, 0.694, -0.004), rx: 0.024, ry: 0.032, w: { chest: 0.85, [A]: 0.15 } },
          { c: V(sg * 0.07, 0.7, -0.004), rx: 0.03, ry: 0.038, w: { chest: 0.75, [A]: 0.25 } },
          { c: V(sg * 0.096, 0.684, -0.004), rx: 0.046, ry: 0.048, w: { chest: 0.3, [A]: 0.7 } },
          { c: V(armX(0.65), 0.65, -0.004), rx: 0.044, ry: 0.046, w: { [A]: 1 } },
          { c: V(armX(0.625), 0.625, -0.004), rx: 0.029, ry: 0.031, w: { [A]: 1 } },
        ],
        {
          segs: 20,
          sub: 4,
          open: true,
          warp: (P, i) => {
            const k = 0.05 * Math.sin(i.a * 8) * bump(i.v, 0.55, 0.3);
            P.x += (P.x - i.ring.c.x) * k;
            P.z += (P.z - i.ring.c.z) * k;
          },
          color: (i) => cloth(i, 0.15 * (0.5 - 0.5 * Math.sin(i.a * 8)) * bump(i.v, 0.55, 0.3)),
        }
      );
      // (a band round the end of it)
      skin.loft(
        [[0.629, 0.03], [0.624, 0.0315], [0.617, 0.03]].map(([y, r]) => ({ c: V(armX(y), y, -0.004), rx: r, ry: r * 1.07, w: { [A]: 1 } })),
        { segs: 16, sub: 1, open: true, color: () => col.copy(top === 'dress' ? ink.top2 : ink.top).lerp(ink.topDeep, 0.1) }
      );
    } else {
      // long sleeves — fitted (a knit, a hoodie), or a cardigan's, wide, with the cuff turned back
      const wide = sleeve === 'wide';
      const r0 = wide ? 1 : top === 'knit' ? 0.92 : 0.95;
      skin.loft(
        [
          { c: V(sg * 0.05, 0.694, -0.004), rx: 0.024 * r0, ry: 0.032 * r0, w: { chest: 0.85, [A]: 0.15 } },
          { c: V(sg * 0.07, 0.698, -0.004), rx: 0.03 * r0, ry: 0.04 * r0, w: { chest: 0.75, [A]: 0.25 } },
          { c: V(sg * 0.095, 0.678, -0.004), rx: 0.044 * r0, ry: 0.048 * r0, w: { chest: 0.3, [A]: 0.7 } },
          { c: V(sg * 0.1015, 0.615, -0.003), rx: 0.039 * r0, ry: 0.0425 * r0, w: { [A]: 1 } },
          { c: V(elbow.x, elbow.y, -0.002), rx: 0.0345 * r0, ry: 0.0375 * r0, w: { [A]: 0.5, [Fo]: 0.5 } },
          { c: V(armX(0.503), 0.503, 0), rx: (wide ? 0.033 : 0.029) * r0, ry: (wide ? 0.0358 : 0.032) * r0, w: { [Fo]: 1 } },
          { c: V(armX(0.47), 0.47, 0.002), rx: (wide ? 0.0335 : 0.026) * r0, ry: (wide ? 0.036 : 0.0285) * r0, w: { [Fo]: 1 } },
        ],
        {
          segs: 18,
          sub: 4,
          open: true,
          mode: top === 'knit' ? RIBS : PLAIN,
          tz: () => 30,
          warp: (P, i) => {
            const k = 0.035 * Math.sin(i.v * 34) * bump(i.v, 0.6, 0.2) * smooth(-0.2, 0.6, i.s);
            P.x += (P.x - i.ring.c.x) * k;
            P.z += (P.z - i.ring.c.z) * k;
          },
          color: (i) => cloth(i, 0.22 * (0.5 + 0.5 * Math.sin(i.v * 34)) * bump(i.v, 0.6, 0.2)),
        }
      );
      // the cuff: knitted, thicker than the sleeve
      const cr = wide ? 1 : 0.8;
      skin.loft(
        [[0.473, 0.0335], [0.4685, 0.0368], [0.452, 0.038], [0.44, 0.0374], [0.4355, 0.0348]].map(([y, r]) => ({ c: V(armX(y), y, 0.002 + (0.466 - y) * 0.05), rx: r * cr, ry: r * 1.06 * cr, w: { [Fo]: 1 } })),
        { segs: 18, sub: 2, open: true, mode: RIBS, tz: () => 36, color: (i) => col.copy(ink.top).lerp(ink.topDeep, 0.15 + 0.3 * smooth(0.3, -0.8, sg * i.c)) }
      );
      skin.loft(
        [[0.4355, 0.0348], [0.4375, 0.0298], [0.45, 0.0235], [0.47, 0.017]].map(([y, r]) => ({ c: V(armX(y), y, 0.003), rx: r * cr, ry: r * 1.06 * cr, w: { [Fo]: 1 } })),
        { segs: 18, sub: 2, open: true, color: (i) => col.copy(ink.top).lerp(ink.topDeep, smooth(0, 0.5, i.v)).multiplyScalar(1 - 0.3 * smooth(0.1, 0.9, i.v)) }
      );
    }
    // her wrist and palm, four fingers and her thumb (as Lorelei's)
    const hx = wrist.x + sg * 0.001;
    skin.loft(
      [
        { c: V(armX(0.462), 0.462, 0.003), rx: 0.0108, ry: 0.012, w: { [Fo]: 1 } },
        { c: V(armX(0.435), 0.435, 0.004), rx: 0.0104, ry: 0.0128, w: { [Fo]: 0.4, [H]: 0.6 } },
        { c: V(hx, 0.418, 0.0052), rx: 0.0086, ry: 0.0172, w: { [H]: 1 } },
        { c: V(hx, 0.402, 0.006), rx: 0.008, ry: 0.018, w: { [H]: 1 } },
        { c: V(hx, 0.394, 0.006), rx: 0.0062, ry: 0.0164, w: { [H]: 1 } },
      ],
      { segs: 12, sub: 2, n: 2.3, mode: SKIN, cap: 0.3, color: (i) => col.copy(ink.skin).lerp(ink.skinDeep, 0.5 * smooth(0.44, 0.452, i.P.y)) }
    );
    const tipped = (i) => col.copy(ink.skin).lerp(ink.skinRose, 0.45 * smooth(0.5, 1, i.v));
    [[0.0118, 0.025], [0.004, 0.029], [-0.0038, 0.027], [-0.0112, 0.021]].forEach(([dz, long]) => {
      const z = 0.006 + dz;
      skin.loft(
        [
          { c: V(hx, 0.399, z), rx: 0.0038, ry: 0.0039, w: { [H]: 1 } },
          { c: V(hx - sg * 0.0006, 0.399 - long * 0.5, z + dz * 0.1), rx: 0.0037, ry: 0.0038, w: { [H]: 1 } },
          { c: V(hx - sg * 0.0034, 0.399 - long, z + dz * 0.22), rx: 0.003, ry: 0.0031, w: { [H]: 1 } },
        ],
        { segs: 7, sub: 2, mode: SKIN, cap: 0.8, color: tipped }
      );
    });
    skin.loft(
      [
        { c: V(hx - sg * 0.0006, 0.424, 0.018), rx: 0.0046, ry: 0.0048, w: { [H]: 1 } },
        { c: V(hx - sg * 0.0014, 0.411, 0.029), rx: 0.0042, ry: 0.0044, w: { [H]: 1 } },
        { c: V(hx - sg * 0.0032, 0.398, 0.035), rx: 0.0033, ry: 0.0034, w: { [H]: 1 } },
      ],
      { segs: 7, sub: 2, mode: SKIN, cap: 0.8, color: tipped }
    );
  }

  /* Her hair: the cap of it, her fringe, the locks before her ears — and the rest as she has it done. */
  function hair() {
    const headAt = V(0, HEAD_Y, 0);
    const cap = new Rings(CAP, headAt, CAP_N);
    const HM = V(0, HEAD_Y + 0.02, -0.006);
    const outwards = (az, el) => V(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
    const reach = (dir) => Math.max(head.reach(HM, dir), cap.reach(HM, dir));
    const onHead = ([kind, a, b, lift]) => {
      let dir;
      if (kind === 's') dir = outwards(a * DEG, b * DEG);
      else {
        let r = 0.11;
        for (let k = 0; k < 10; k++) {
          const el = Math.asin(clamp((HEAD_Y + b - HM.y) / r, -1, 1));
          const az = Math.asin(clamp(a / (r * Math.cos(el)), -1, 1));
          dir = outwards(az, el);
          r = reach(dir);
        }
      }
      return { p: HM.clone().addScaledVector(dir, reach(dir) + lift), up: dir };
    };
    // (its colour: the top of her head the colour she chose, down to its ends the other one — the same, if it is one)
    const tipAt = (y) => smooth(0.83, 0.5, y);
    const hairInk = (i, turn = 0) => {
      const low = clamp(tipAt(i.P.y) + turn, 0, 1);
      return col.copy(ink.hair).lerp(ink.hairTip, smooth(0.1, 1, low));
    };
    // the cap: its strands run to where it is tied — or, loose, down to the nape
    const TIE =
      style === 'pony'
        ? V(0, 0.928, -0.088).sub(HM).normalize()
        : style === 'bun'
          ? V(0, 1.0, -0.04).sub(HM).normalize()
          : style === 'twin'
            ? V(0, -0.2, -1).normalize()
            : V(0, -0.55, -1).normalize();
    const tieA = V().crossVectors(TIE, Y_AXIS).normalize();
    const tieB = V().crossVectors(TIE, tieA).normalize();
    const dirTo = V();
    skin.loft(cap.keys({ head: 1 }), {
      segs: 48,
      sub: 3,
      n: CAP_N,
      frame: LEVEL,
      cap: 0.15,
      mode: HAIR,
      tex: (i, tex) => {
        dirTo.copy(i.P).sub(HM).normalize();
        const ang = Math.atan2(dirTo.dot(tieB), dirTo.dot(tieA));
        const thick = 0.13 * Math.sqrt(Math.max(0, 1 - dirTo.dot(TIE) ** 2)) + 0.004;
        tex[0] = Math.cos(ang) * thick;
        tex[1] = Math.sin(ang) * thick;
        tex[2] = 3;
      },
      color: (i) => {
        const y = i.P.y - HEAD_Y;
        col.copy(ink.hair).lerp(ink.hairLight, 0.35 * smooth(0.05, 0.12, y));
        return col.lerp(ink.hairDeep, clamp(0.55 * smooth(-0.01, -0.09, y) + 0.45 * smooth(-0.3, 0.3, i.s) * smooth(0.03, -0.02, y), 0, 1));
      },
    });

    // her fringe: one sheet of hair over her brow and her temples, from a parting to its edge
    {
      const EDGE = BANGS[look.hair.bangs] || BANGS.full;
      const PER = 8;
      const ROWS = 16;
      const THICK = 0.02;
      const partX = look.hair.bangs === 'side' ? 0.022 : 0.002;
      // (the parting: from the crown forward — a straight-cut fringe is combed down from well back on her head)
      const front = { side: 0.07, part: 0.085, full: 0.1 }[look.hair.bangs] || 0.07;
      const part = [onHead(['s', look.hair.bangs === 'side' ? 25 : 0, 84, 0]).up, onHead(['f', partX, front, 0]).up];
      const ends = EDGE.map((e) => {
        const d = onHead([e[0], e[1], e[2], 0]).up;
        return { az: Math.atan2(d.x, d.z), el: Math.asin(d.y) };
      });
      const NU = (EDGE.length - 1) * PER + 1;
      const dA = V();
      const dB = V();
      const dir = V();
      skin.patch(NU, ROWS + 1, { head: 1 }, HAIR, (iu, iv, out) => {
        const i = Math.min(EDGE.length - 2, Math.floor(iu / PER));
        const f = iu / PER - i;
        const nick = EDGE[i][3] ? f : 1 - f;
        const tip = ends[EDGE[i][3] ? i : i + 1];
        const gap = ends[EDGE[i][3] ? i + 1 : i];
        const under = iv >= ROWS;
        const v = under ? 0.96 : iv / (ROWS - 1);
        dB.copy(outwards(lerp(ends[i].az, ends[i + 1].az, f), lerp(tip.el, gap.el, nick ** (EDGE[i][4] || 1.5))));
        // (where on the parting this hair grows: straight-cut and parted fringes from the middle, a side fringe as Lorelei's)
        const toward = look.hair.bangs === 'side' ? smooth(0.11, 0.015, Math.abs(dB.x * 0.12 - 0.02)) : smooth(0.6, 0.0, Math.abs(dB.x));
        dA.copy(part[0]).lerp(part[1], toward).normalize();
        dir.copy(dA).lerp(dB, v).normalize();
        const side = smooth(0, 1.6, Math.min(iu, NU - 1 - iu) / PER);
        const crease = nick ** 5 * smooth(0.1, 0.4, v);
        const flank = 1 - 0.5 * smooth(0.5, 0.85, Math.abs(dB.x));
        const thin = 1 - 0.74 * smooth(0.5, 1, v);
        const lift = under ? 0 : THICK * smooth(0, 0.3, v) * thin * (1 - 0.4 * crease) * flank * (0.25 + 0.75 * side);
        out.P.copy(HM).addScaledVector(dir, reach(dir) + lift);
        out.color.copy(ink.hair).lerp(ink.hairLight, 0.3 * (1 - nick) * bump(v, 0.5, 0.3)).lerp(ink.hairDeep, under ? 0.8 : (look.hair.bangs === 'side' ? 0.85 : 0.45) * crease);
        const th = (iu / (NU - 1)) * TAU * 9;
        out.tex[0] = Math.cos(th) * 0.0035;
        out.tex[1] = Math.sin(th) * 0.0035;
        out.tex[2] = 2 + v * 2;
      });
    }

    // the locks before her ears (not with a bob: it hangs over them)
    if (style !== 'bob') {
      const long = style === 'long';
      const hung = (bone) => (v) => ({ head: 1 - smooth(0.25, 0.75, v), [bone]: smooth(0.25, 0.75, v) });
      for (const sg of [-1, 1]) {
        const pts = long
          ? [V(sg * 0.094, 0.872, 0.03), V(sg * 0.102, 0.84, 0.018), V(sg * 0.106, 0.8, 0.014), V(sg * 0.108, 0.756, 0.022), V(sg * 0.1, 0.71, 0.04), V(sg * 0.09, 0.66, 0.05), V(sg * 0.084, 0.62, 0.052)]
          : [V(sg * 0.094, 0.872, 0.03), V(sg * 0.1, 0.84, 0.018), V(sg * 0.103, 0.8, 0.012), V(sg * 0.101, 0.766, 0.016), V(sg * 0.097, 0.742, 0.026)];
        const wide = long ? [0.022, 0.034, 0.036, 0.034, 0.03, 0.02, 0.003] : [0.022, 0.032, 0.032, 0.022, 0.003];
        skin.lock(pts, wide, 0.012, { side: V(-sg * 0.25, 0, 1).normalize(), w: hung(sg > 0 ? 'lockL' : 'lockR'), seed: sg > 0 ? 37 : 31, color: (i) => hairInk(i, 0.05).lerp(ink.hairDeep, 0.4 * smooth(0.5, 1, Math.abs(i.c))) });
      }
    }

    // …and the rest of it
    const lobes = (i, k = 1) => {
      const a = i.a + i.len * 1.6;
      return k * (0.055 * Math.cos(3 * a + 0.6) + 0.03 * Math.cos(5 * a + 2.1) + 0.016 * Math.cos(8 * a)) * smooth(0.02, 0.2, i.len);
    };
    const tailInk = (deep) => (i) => {
      const t = tipAt(i.P.y);
      col.copy(ink.hair).lerp(ink.hairTip, smooth(0.05, 0.9, t));
      return col.lerp(ink.hairLight, 0.18 * smooth(0.2, 1, -i.s) * (1 - t)).lerp(ink.hairDeep, clamp(deep + 0.35 * smooth(0.1, 1, i.s), 0, 1) * 0.6);
    };
    const tailLoft = (path, wOf) => {
      const body = tailInk(0);
      skin.loft(
        path.rows.map((row, k) => ({ c: row.p, rx: row.hw, ry: row.hd, w: wOf(k) })),
        {
          segs: 36,
          sub: 5,
          cap: 0.4,
          mode: HAIR,
          tz: (i) => 3 + i.len * 30,
          warp: (P, i) => {
            const k = lobes(i);
            P.x += (P.x - i.ring.c.x) * k;
            P.y += (P.y - i.ring.c.y) * k;
            P.z += (P.z - i.ring.c.z) * k;
          },
          color: (i) => body(i).lerp(ink.hairDeep, 0.5 * smooth(0.02, -0.1, lobes(i))),
        }
      );
    };
    /* A hair tie round a tail where it is tied: a soft knitted band in the colour of what she has in her hair. */
    const scrunchie = (at, along, r) => {
      const n = along.clone().normalize();
      const up = Math.abs(n.y) > 0.9 ? X_AXIS : Y_AXIS;
      skin.loft(
        [-1, -0.4, 0.4, 1].map((s, k) => ({ c: at.clone().addScaledVector(n, s * r * 0.45), rx: r * [0.8, 1.15, 1.15, 0.8][k], ry: r * [0.8, 1.15, 1.15, 0.8][k], w: { head: 1 }, up: V().crossVectors(n, up).normalize() })),
        {
          segs: 20,
          sub: 2,
          cap: 0.2,
          mode: RIBS,
          tz: () => 18,
          warp: (P, i) => {
            const k = 0.12 * Math.sin(i.a * 6);
            P.addScaledVector(V().subVectors(P, i.ring.c), k);
          },
          color: () => col.copy(look.head.kind === 'none' ? C('#ff9cbc') : ink.acc),
        }
      );
    };

    if (style === 'pony') {
      tailLoft(hairPath, chainW(tail, TAIL_K));
      scrunchie(V(0, 0.93, -0.092), V(0, 0.4, -1), 0.03);
    } else if (style === 'twin') {
      tailLoft(hairPath, chainW(tail, TAIL_K));
      tailLoft(path2, chainW(tail2, TAIL_K));
      for (const sg of [-1, 1]) scrunchie(V(sg * 0.098, 0.902, -0.055), V(sg * 1, 0.1, -0.6), 0.026);
    } else if (style === 'bun') {
      // a round bun at the back of the crown, its strands wound round it
      const at = V(0, 0.995, -0.05);
      skin.loft(
        [0.058, 0.052, 0.036, 0.012, -0.02, -0.04, -0.052, -0.056].map((dy, k) => {
          const r = Math.sqrt(Math.max(0, 0.058 ** 2 - (dy - 0.001) ** 2));
          return { c: at.clone().add(V(0, dy, 0)), rx: Math.max(0.004, r), ry: Math.max(0.004, r * 0.96), w: { head: 1 } };
        }),
        {
          segs: 32,
          sub: 3,
          frame: LEVEL,
          cap: 0.5,
          mode: HAIR,
          tz: (i) => 4 + i.v * 6,
          warp: (P, i) => {
            const k = 0.06 * Math.cos(i.a * 3 + i.v * 7);
            P.x += (P.x - i.ring.c.x) * k;
            P.z += (P.z - i.ring.c.z) * k;
          },
          color: (i) => col.copy(ink.hair).lerp(ink.hairLight, 0.25 * smooth(0, 1, i.s)).lerp(ink.hairDeep, 0.35 * (0.5 + 0.5 * Math.cos(i.a * 3 + i.v * 7))),
        }
      );
      scrunchie(V(0, 0.948, -0.042), V(0, 1, 0.15), 0.036);
    } else if (style === 'long') {
      // round her head like a bob, then down behind her shoulders: in tresses, longer in the middle than at the sides
      const w = chainW(tail, LONG_K);
      const OPEN = 1.0;
      skin.loft(
        LONG.map(([y, rx, rf, rb, z], k) => ({ c: V(0, HEAD_Y + y, z), rx, ry: rf, ryB: rb, w: w(k) })),
        {
          segs: 44,
          sub: (i) => (i < 4 ? 3 : 4),
          frame: LEVEL,
          arc: [Math.PI / 2 + OPEN, Math.PI / 2 - OPEN + TAU],
          n: 2.3,
          mode: HAIR,
          tex: (i, tex) => {
            const a = i.a + 0.9 * Math.sin(i.v * 2);
            tex[0] = Math.cos(a * 7) * 0.012;
            tex[1] = Math.sin(a * 7) * 0.012;
            tex[2] = 2 + i.v * 6;
          },
          warp: (P, i) => {
            const k = 0.045 * Math.sin(i.a * 9 + 1 + i.v * 2) * smooth(0.2, 0.6, i.v);
            P.x += (P.x - i.ring.c.x) * k;
            P.z += (P.z - i.ring.c.z) * k;
            // (the ends: longer in the middle of her back than at the sides)
            P.y -= 0.03 * smooth(0.7, 1, i.v) * Math.max(0, -Math.sin(i.a)) ** 2;
          },
          color: (i) => col.copy(ink.hair).lerp(ink.hairTip, smooth(0.25, 1, i.v)).lerp(ink.hairDeep, 0.22 * (0.5 - 0.5 * Math.sin(i.a * 9 + 1 + i.v * 2)) * smooth(0.2, 0.6, i.v) + 0.2 * smooth(0.0, 0.2, i.v) * smooth(0.3, -0.3, Math.sin(i.a))),
        }
      );
    } else if (style === 'bob') {
      // a bob: down round her head to her chin, open in front, turned in at its ends
      const bob = new Rings(BOB, V(0, HEAD_Y, 0), 2.3);
      const OPEN = 1.0;
      skin.loft(bob.keys({ head: 1 }), {
        segs: 44,
        sub: 3,
        frame: LEVEL,
        arc: [Math.PI / 2 + OPEN, Math.PI / 2 - OPEN + TAU],
        n: 2.3,
        mode: HAIR,
        tex: (i, tex) => {
          const a = i.a + 0.9 * Math.sin(i.v * 2);
          tex[0] = Math.cos(a * 7) * 0.012;
          tex[1] = Math.sin(a * 7) * 0.012;
          tex[2] = 2 + i.v * 4;
        },
        warp: (P, i) => {
          // (a little fuller at the sides, and in at the ends)
          const k = 0.04 * Math.sin(i.a * 9 + 1) * smooth(0.3, 1, i.v) - 0.06 * smooth(0.75, 1, i.v);
          P.x += (P.x - i.ring.c.x) * k;
          P.z += (P.z - i.ring.c.z) * k;
        },
        color: (i) => col.copy(ink.hair).lerp(ink.hairTip, smooth(0.2, 1, i.v)).lerp(ink.hairDeep, 0.3 * smooth(0.6, 1, i.v) + 0.25 * (0.5 - 0.5 * Math.sin(i.a * 9 + 1))),
      });
    }
  }

  /* What she has in her hair (one thing), her glasses, her scarf. */
  function accessories() {
    const kind = look.head.kind;
    const lorelei = ['beret', 'straw', 'santa', 'blossom'].includes(kind) || look.scarf ? makeOwnerClothes({ dims: { crown: V(0, 1.004 - J.head.y, 0) } }) : null;
    const accMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 });
    const at = (x, y, z) => V(x, y, z).sub(J.head); // (in the head bone's measure)
    if (kind === 'beret' || kind === 'straw' || kind === 'santa') {
      const item = lorelei[kind];
      // (over her bun, if she has one, the hat sits a little higher)
      if (style === 'bun') item.object.position.y += 0.03;
      wearOn('head', item.object);
    } else if (kind === 'blossom') {
      wearOn('head', lorelei.pin.object);
    } else if (kind === 'ribbon') {
      // a bow: on the tie of a ponytail or a bun, on both of twin tails — or on the top of her head, to one side
      const b = new Batch();
      const bow = (p, yaw, k = 1) => {
        const m = new THREE.Matrix4().compose(p, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, yaw, 0)), V(k, k, k));
        for (const s of [-1, 1]) {
          const loop = new THREE.TorusGeometry(0.024, 0.009, 8, 16);
          loop.scale(1, 0.62, 0.7);
          loop.rotateZ(s * 0.35);
          loop.translate(s * 0.026, 0, 0);
          loop.applyMatrix4(m);
          b.add(loop, { color: ink.acc.getHex() });
          const end = new THREE.BoxGeometry(0.012, 0.03, 0.004);
          end.rotateZ(s * 0.35);
          end.translate(s * 0.012, -0.022, 0);
          end.applyMatrix4(m);
          b.add(end, { color: ink.acc.getHex() });
        }
        const knot = new THREE.SphereGeometry(0.011, 10, 8);
        knot.applyMatrix4(m);
        b.add(knot, { color: C(look.head.color).lerp(C('#3a2a40'), 0.1).getHex() });
      };
      if (style === 'pony') bow(at(0, 0.945, -0.105), Math.PI, 1);
      else if (style === 'bun') bow(at(0, 0.955, -0.075), Math.PI, 1);
      else if (style === 'twin') for (const sg of [-1, 1]) bow(at(sg * 0.108, 0.912, -0.062), sg * 0.9, 0.8);
      else bow(at(0.07, 0.96, 0.03), 0.5, 0.9);
      wearOn('head', b.mesh(accMat));
    } else if (kind === 'heart') {
      // a heart-shaped pin over her left temple
      const s = new THREE.Shape();
      s.moveTo(0, -0.012);
      s.bezierCurveTo(0.016, 0.001, 0.012, 0.016, 0, 0.007);
      s.bezierCurveTo(-0.012, 0.016, -0.016, 0.001, 0, -0.012);
      const g = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.002, bevelSegments: 2 });
      const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: look.head.color, roughness: 0.3 }));
      m.position.copy(at(0.082, 0.905, 0.062));
      m.lookAt(at(0.082, 0.905, 0.062).add(V(0.55, 0.3, 0.75)));
      wearOn('head', m);
    } else if (kind === 'headband' || kind === 'catears') {
      // a band over the crown from behind one ear to behind the other, just behind her fringe — with a cat's ears on
      // it, for the cat ears
      const b = new Batch();
      const R = 0.124;
      const RY = R * 1.2; // (over the top of her fringe, as high as it lies on her head)
      const TILT = 0.24;
      const Y0 = HEAD_Y - J.head.y + 0.02;
      const Z0 = -0.015;
      const arc = new THREE.TorusGeometry(R, 0.0065, 8, 40, Math.PI * 1.06);
      arc.rotateZ(-0.03);
      arc.scale(1, RY / R, 1);
      arc.rotateX(-TILT);
      arc.translate(0, Y0, Z0);
      b.add(arc, { color: ink.acc.getHex() });
      /** A point on the band, `th` round from its top (+ = to her left). */
      const onBand = (th) => V(R * Math.sin(th), Y0 + RY * Math.cos(th) * Math.cos(TILT), Z0 - RY * Math.cos(th) * Math.sin(TILT));
      if (kind === 'catears') {
        for (const sg of [-1, 1]) {
          const p = onBand(sg * 0.5);
          const ear = new THREE.ConeGeometry(0.032, 0.052, 4);
          ear.scale(1, 1, 0.45);
          ear.rotateZ(-sg * 0.45);
          ear.rotateX(-TILT * 0.5);
          ear.translate(p.x + sg * 0.008, p.y + 0.018, p.z);
          b.add(ear, { color: ink.acc.getHex(), flat: true });
          const inner = new THREE.ConeGeometry(0.019, 0.033, 4);
          inner.scale(1, 1, 0.3);
          inner.rotateZ(-sg * 0.45);
          inner.rotateX(-TILT * 0.5);
          inner.translate(p.x + sg * 0.007, p.y + 0.015, p.z + 0.007);
          b.add(inner, { color: '#ffc4d6', flat: true });
        }
      }
      wearOn('head', b.mesh(accMat));
    }
    if (look.glasses.kind === 'round') {
      // round glasses: two rims before her eyes, a bridge, and the arms back to her ears
      const b = new Batch();
      const y = HEAD_Y + EYE.y - J.head.y + 0.001;
      const z = 0.104;
      for (const sg of [-1, 1]) {
        const rim = new THREE.TorusGeometry(0.026, 0.0028, 6, 28);
        rim.translate(sg * EYE.x, y, z);
        b.add(rim, { color: look.glasses.color });
        const temple = new THREE.CylinderGeometry(0.002, 0.002, 0.11, 5);
        temple.rotateX(Math.PI / 2);
        temple.translate(sg * 0.098, y + 0.006, z - 0.055);
        b.add(temple, { color: look.glasses.color });
      }
      const bridge = new THREE.TorusGeometry(0.009, 0.0024, 5, 10, Math.PI);
      bridge.translate(0, y + 0.004, z + 0.002);
      b.add(bridge, { color: look.glasses.color });
      const mesh = b.mesh(accMat);
      mesh.castShadow = false;
      bones.head.add(mesh);
      extras.push(mesh);
      // (and the glass, a faint sheen)
      const glass = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.05, metalness: 0, transparent: true, opacity: 0.12, depthWrite: false });
      for (const sg of [-1, 1]) {
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.024, 24), glass);
        lens.position.set(sg * EYE.x, y, z + 0.001);
        bones.head.add(lens);
        extras.push(lens);
      }
    }
    if (look.scarf) {
      const s = lorelei.scarf;
      wearOn(s.bone, s.object);
      for (const [bone, o] of s.more || []) wearOn(bone, o);
    }
    // (what of Lorelei's she is not wearing goes again)
    if (lorelei)
      for (const id in lorelei) {
        const it = lorelei[id];
        const used = (id === kind || (id === 'pin' && kind === 'blossom') || (id === 'scarf' && look.scarf));
        if (used) continue;
        for (const o of [it.object, ...(it.more || []).map((m) => m[1])])
          o.traverse((q) => {
            if (q.geometry) q.geometry.dispose();
            if (q.material && !(q.material.userData && q.material.userData.shared)) q.material.dispose();
          });
      }
  }
}
