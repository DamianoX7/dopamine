// What the house is built from: rounded boxes (nothing in a home has sharp corners), the few
// materials everything in it shares, and the painted textures — the wallpapers and floors she
// can choose from, the rugs, the quilts. The fox world's kit (../fox/kit.js) does the rest:
// Batch bakes the small shapes of a piece of furniture into a mesh or two.
import * as THREE from '../vendor/three.module.min.js';
import { Batch, V, TAU, rng, paintTexture } from '../fox/kit.js';

export { Batch, V, TAU, rng, paintTexture };

const _p = V();
const _in = V();
const _d = V();

/**
 * A box with rounded edges and corners, centred on the origin: the faces stay flat, and every
 * edge is a quarter round of radius `r` (`s` steps of it). The faces keep their texture
 * coordinates, so a rounded box can wear a pattern as well as a colour.
 */
export function roundBox(w, h, d, r = 0.03, s = 3) {
  const half = [w / 2, h / 2, d / 2];
  r = Math.max(0.0005, Math.min(r, half[0] * 0.98, half[1] * 0.98, half[2] * 0.98));
  const n = 2 * s + 1;
  const g = new THREE.BoxGeometry(1, 1, 1, n, n, n);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  // along each axis: s steps through the rounding, one across the flat, s steps through the rounding again
  const at = (c, a) => {
    const k = Math.round((c + 0.5) * n);
    const H = half[a];
    return k <= s ? -H + (r * k) / s : H - (r * (n - k)) / s;
  };
  for (let i = 0; i < pos.count; i++) {
    _p.set(at(pos.getX(i), 0), at(pos.getY(i), 1), at(pos.getZ(i), 2));
    _in.set(Math.max(-half[0] + r, Math.min(half[0] - r, _p.x)), Math.max(-half[1] + r, Math.min(half[1] - r, _p.y)), Math.max(-half[2] + r, Math.min(half[2] - r, _p.z)));
    _d.copy(_p).sub(_in);
    const len = _d.length();
    if (len > 1e-6) {
      _d.multiplyScalar(1 / len);
      _p.copy(_in).addScaledVector(_d, r);
      nor.setXYZ(i, _d.x, _d.y, _d.z);
    }
    pos.setXYZ(i, _p.x, _p.y, _p.z);
  }
  g.computeBoundingBox();
  g.computeBoundingSphere();
  return g;
}

/** A disc lying flat (a cylinder with rounded rims would be overdone for a tabletop: a plain one, softly bevelled). */
export function disc(r, h, seg = 32) {
  return new THREE.CylinderGeometry(r, r, h, seg);
}

/** A pole from one point to another (a table leg, a lamp's stem). */
export function pole(b, from, to, r, color, seg = 10, flat = false) {
  const a = V(...from);
  const c = V(...to);
  const q = new THREE.Quaternion().setFromUnitVectors(V(0, 1, 0), c.clone().sub(a).normalize());
  const m = new THREE.Matrix4().compose(a.clone().add(c).multiplyScalar(0.5), q, V(1, 1, 1));
  b.add(new THREE.CylinderGeometry(r, r, a.distanceTo(c), seg), { matrix: m, color, flat });
}

/** A tube along a curve through `pts` (a string of lights, a hanger's wire, a stem). */
export function tube(b, pts, r, color, seg = 24) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => V(...p)));
  b.add(new THREE.TubeGeometry(curve, seg, r, 6, false), { color });
  return curve;
}

export function heartShape(size) {
  const s = new THREE.Shape();
  s.moveTo(0, -0.5 * size);
  s.bezierCurveTo(0.62 * size, 0.02 * size, 0.46 * size, 0.64 * size, 0, 0.27 * size);
  s.bezierCurveTo(-0.46 * size, 0.64 * size, -0.62 * size, 0.02 * size, 0, -0.5 * size);
  return s;
}

/** A soft heart, a little puffed (a cushion, a box): extruded with a rounded bevel. */
export function heart(size, depth) {
  const g = new THREE.ExtrudeGeometry(heartShape(size), { depth, bevelEnabled: true, bevelThickness: depth * 0.45, bevelSize: size * 0.06, bevelSegments: 3, curveSegments: 14 });
  g.translate(0, 0, -depth / 2);
  return g;
}

// ------------------------------------------------------------------ materials

/* Shared by everything in the house (they live as long as the page does: see disposeTree). */
const keep = (m) => {
  m.userData.shared = true;
  return m;
};
export const MAT = {
  fabric: keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96 })),
  wood: keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.62 })),
  paint: keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })),
  gloss: keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.26 })),
  metal: keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.7 })),
  leaf: keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide })),
  dark: keep(new THREE.MeshBasicMaterial({ color: '#2b2230' })),
  bright: keep(new THREE.MeshBasicMaterial({ vertexColors: true })), // (bulbs, a lit screen: as bright by night as by day)
};

/** The batches of a piece of furniture, one per material — baked into meshes once it is all there. */
export class Parts {
  constructor() {
    this.b = {};
  }

  get(kind) {
    return this.b[kind] || (this.b[kind] = new Batch());
  }

  /** Every batch that has something in it, as a mesh in `group` (shadows both ways, unless it glows). */
  bake(group, own = {}) {
    for (const kind in this.b) {
      const mat = own[kind] || MAT[kind];
      const mesh = this.b[kind].mesh(mat);
      if (kind === 'bright' || kind === 'dark') mesh.castShadow = mesh.receiveShadow = false;
      mesh.userData.kind = kind;
      group.add(mesh);
    }
    return group;
  }
}

// ------------------------------------------------------------------ textures

const cache = new Map();
/* A painted texture, made once and kept (they are the same for every wall that wears them). */
function once(key, size, draw, tile = 0) {
  if (cache.has(key)) return cache.get(key);
  const tex = paintTexture(size, draw, { tile });
  tex.userData.shared = true;
  if (!tile) tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

const noise = (g, S, rnd, n, colors, alpha, rMin = 0.5, rMax = 1.6) => {
  for (let i = 0; i < n; i++) {
    g.globalAlpha = alpha * rnd.range(0.4, 1);
    g.fillStyle = rnd.pick(colors);
    g.beginPath();
    g.arc(rnd() * S, rnd() * S, rnd.range(rMin, rMax), 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
};

function heartPath(g, x, y, s) {
  g.beginPath();
  g.moveTo(x, y + 0.5 * s);
  g.bezierCurveTo(x + 0.62 * s, y - 0.02 * s, x + 0.46 * s, y - 0.64 * s, x, y - 0.27 * s);
  g.bezierCurveTo(x - 0.46 * s, y - 0.64 * s, x - 0.62 * s, y - 0.02 * s, x, y + 0.5 * s);
}

function star(g, x, y, R, r = R * 0.45, n = 5) {
  g.beginPath();
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const k = i % 2 ? r : R;
    g[i ? 'lineTo' : 'moveTo'](x + Math.cos(a) * k, y + Math.sin(a) * k);
  }
  g.closePath();
}

/* A tiny five-petalled flower. */
function flower(g, x, y, r, petal, middle) {
  g.fillStyle = petal;
  for (let i = 0; i < 5; i++) {
    const a = (i * TAU) / 5;
    g.beginPath();
    g.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.48, 0, TAU);
    g.fill();
  }
  g.fillStyle = middle;
  g.beginPath();
  g.arc(x, y, r * 0.36, 0, TAU);
  g.fill();
}

/* The wallpapers: one tile of each is a unit of wall square. */
export const WALLPAPERS = {
  cream: (g, S) => {
    g.fillStyle = '#fbf1e4';
    g.fillRect(0, 0, S, S);
    const rnd = rng(11);
    for (let x = 0; x < S; x += S / 16) {
      g.fillStyle = 'rgba(214, 186, 150, 0.08)';
      g.fillRect(x, 0, S / 64, S);
    }
    noise(g, S, rnd, 900, ['#e9d6bd', '#fffaf2'], 0.25);
  },
  stripe: (g, S) => {
    g.fillStyle = '#fff2f6';
    g.fillRect(0, 0, S, S);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = '#ffc9da';
      g.fillRect((i * S) / 8, 0, S / 16, S);
      g.fillStyle = 'rgba(255, 255, 255, 0.7)';
      g.fillRect((i * S) / 8 + S / 16 + S / 64, 0, S / 128, S);
    }
    noise(g, S, rng(12), 500, ['#ffffff', '#f6c0d2'], 0.18);
  },
  mint: (g, S) => {
    g.fillStyle = '#eefaf4';
    g.fillRect(0, 0, S, S);
    const k = S / 8;
    for (let i = 0; i < 8; i++) {
      g.fillStyle = 'rgba(126, 206, 172, 0.32)';
      g.fillRect(i * k, 0, k / 2, S);
      g.fillRect(0, i * k, S, k / 2);
    }
    noise(g, S, rng(13), 500, ['#ffffff', '#bfe8d6'], 0.2);
  },
  cloud: (g, S) => {
    const grad = g.createLinearGradient(0, 0, 0, S);
    grad.addColorStop(0, '#bfe2ff');
    grad.addColorStop(1, '#d9eeff');
    g.fillStyle = grad;
    g.fillRect(0, 0, S, S);
    const rnd = rng(14);
    for (let i = 0; i < 6; i++) {
      const x = ((i % 3) + (i > 2 ? 0.5 : 0)) * (S / 3) + rnd.range(-10, 10);
      const y = (i > 2 ? 0.72 : 0.25) * S + rnd.range(-12, 12);
      g.fillStyle = 'rgba(255, 255, 255, 0.92)';
      for (const [dx, dy, r] of [[0, 0, 22], [24, 6, 17], [-24, 7, 16], [10, -12, 15], [-10, -10, 13]]) {
        for (const wx of [0, S, -S]) {
          g.beginPath();
          g.arc(x + dx * (S / 256) + wx, y + dy * (S / 256), r * (S / 256), 0, TAU);
          g.fill();
        }
      }
    }
  },
  flower: (g, S) => {
    g.fillStyle = '#fff8ee';
    g.fillRect(0, 0, S, S);
    const rnd = rng(15);
    const k = S / 6;
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++) {
        const x = i * k + (j % 2 ? k / 2 : 0) + rnd.range(-4, 4);
        const y = j * k + k / 2 + rnd.range(-4, 4);
        g.strokeStyle = '#9fcf8f';
        g.lineWidth = S / 200;
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + k * 0.12, y + k * 0.22, x + k * 0.05, y + k * 0.36);
        g.stroke();
        flower(g, x, y, k * 0.16, rnd() < 0.5 ? '#ff9fbe' : '#ffc5d8', '#ffd96a');
      }
  },
  starry: (g, S) => {
    g.fillStyle = '#2f3566';
    g.fillRect(0, 0, S, S);
    const rnd = rng(16);
    noise(g, S, rnd, 140, ['#ffffff', '#cfd6ff'], 0.55, 0.6, 1.4);
    const k = S / 4;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = rnd() < 0.3 ? '#ffe7a3' : '#ffd45e';
        star(g, i * k + (j % 2 ? k / 2 : 0) + k / 4, j * k + k / 2, k * 0.12);
        g.fill();
      }
  },
  wood: (g, S) => {
    const rnd = rng(17);
    const boards = 5;
    for (let i = 0; i < boards; i++) {
      const tone = ['#d9a877', '#d29d6b', '#ddb083', '#cf9a68', '#d6a574'][i];
      g.fillStyle = tone;
      g.fillRect((i * S) / boards, 0, S / boards, S);
      for (let k = 0; k < 14; k++) {
        g.strokeStyle = 'rgba(120, 72, 38, 0.13)';
        g.lineWidth = rnd.range(0.6, 1.6);
        const x = (i * S) / boards + rnd() * (S / boards);
        g.beginPath();
        g.moveTo(x, 0);
        g.bezierCurveTo(x + rnd.range(-6, 6), S / 3, x + rnd.range(-6, 6), (2 * S) / 3, x + rnd.range(-3, 3), S);
        g.stroke();
      }
      g.fillStyle = 'rgba(90, 52, 26, 0.35)';
      g.fillRect(((i + 1) * S) / boards - 1.5, 0, 1.5, S);
    }
  },
  heart: (g, S) => {
    g.fillStyle = '#ffd9e6';
    g.fillRect(0, 0, S, S);
    const k = S / 5;
    for (let i = 0; i < 5; i++)
      for (let j = 0; j < 5; j++) {
        g.fillStyle = 'rgba(255, 255, 255, 0.85)';
        heartPath(g, i * k + (j % 2 ? k / 2 : 0) + k / 4, j * k + k / 2, k * 0.34);
        g.fill();
      }
  },
};

export function wallpaper(id) {
  return once(`wall:${id}`, 256, WALLPAPERS[id] || WALLPAPERS.cream);
}

/* The floors: one tile is a unit of floor square. */
export const FLOORS = {
  wood: (g, S) => {
    const rnd = rng(21);
    const rows = 6;
    const h = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -rnd() * S * 0.6;
      while (x < S) {
        const len = rnd.range(S * 0.45, S * 0.9);
        const tone = rnd.pick(['#d4a26f', '#cd9a66', '#dcae7c', '#c99462', '#d8a873']);
        for (const wx of [0, S]) {
          g.fillStyle = tone;
          g.fillRect(x - wx, r * h, len, h);
          g.fillStyle = 'rgba(255, 238, 210, 0.16)';
          g.fillRect(x - wx, r * h + 1, len, h * 0.18);
        }
        for (let k = 0; k < 4; k++) {
          g.strokeStyle = 'rgba(110, 66, 34, 0.12)';
          g.lineWidth = 1;
          const y = r * h + rnd() * h;
          g.beginPath();
          g.moveTo(x, y);
          g.bezierCurveTo(x + len / 3, y + rnd.range(-3, 3), x + (2 * len) / 3, y + rnd.range(-3, 3), x + len, y);
          g.stroke();
        }
        g.fillStyle = 'rgba(86, 50, 24, 0.4)';
        g.fillRect(x, r * h, 1.4, h);
        x += len;
      }
      g.fillStyle = 'rgba(86, 50, 24, 0.45)';
      g.fillRect(0, (r + 1) * h - 1.2, S, 1.2);
    }
  },
  herring: (g, S) => {
    g.fillStyle = '#c7925e';
    g.fillRect(0, 0, S, S);
    const rnd = rng(22);
    const L = S / 4;
    const W = L / 3;
    for (let i = -2; i < 10; i++)
      for (let j = -2; j < 10; j++) {
        const x = i * W * 2 + j * W;
        const y = j * W * 2 - i * W;
        const tone = rnd.pick(['#d9a874', '#cf9b67', '#dfb184', '#c8935f']);
        g.save();
        g.translate(x, y);
        g.rotate(Math.PI / 4 + (j % 2 ? Math.PI / 2 : 0));
        g.fillStyle = tone;
        g.fillRect(0, 0, L, W);
        g.strokeStyle = 'rgba(86, 50, 24, 0.45)';
        g.lineWidth = 1.2;
        g.strokeRect(0, 0, L, W);
        g.restore();
      }
  },
  tile: (g, S) => {
    g.fillStyle = '#d9d4d3';
    g.fillRect(0, 0, S, S);
    const k = S / 4;
    const rnd = rng(23);
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        const t = rnd.range(0.94, 1);
        g.fillStyle = `rgb(${Math.round(250 * t)}, ${Math.round(248 * t)}, ${Math.round(246 * t)})`;
        g.fillRect(i * k + 1.5, j * k + 1.5, k - 3, k - 3);
        g.fillStyle = 'rgba(255, 255, 255, 0.5)';
        g.fillRect(i * k + 3, j * k + 3, k * 0.5, k * 0.08);
      }
  },
  check: (g, S) => {
    const k = S / 4;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = (i + j) % 2 ? '#ffd0df' : '#fff7f9';
        g.fillRect(i * k, j * k, k, k);
      }
    noise(g, S, rng(24), 400, ['#ffffff', '#f3b6c9'], 0.2);
  },
  carpet: (g, S) => {
    g.fillStyle = '#f6c2d2';
    g.fillRect(0, 0, S, S);
    noise(g, S, rng(25), 5000, ['#ffd6e2', '#e9a9bd', '#fbe0e8'], 0.45, 0.5, 1.3);
  },
  jangpan: (g, S) => {
    g.fillStyle = '#ecc77a';
    g.fillRect(0, 0, S, S);
    const rnd = rng(26);
    noise(g, S, rnd, 2500, ['#f3d491', '#dfb664', '#f7dea6'], 0.35, 0.4, 1.2);
    // the faint squares of a floor of 장판, and its sheen
    const k = S / 2;
    g.strokeStyle = 'rgba(160, 112, 40, 0.25)';
    g.lineWidth = 1.4;
    for (let i = 0; i <= 2; i++) {
      g.beginPath();
      g.moveTo(i * k, 0);
      g.lineTo(i * k, S);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * k);
      g.lineTo(S, i * k);
      g.stroke();
    }
  },
};

export function floorTexture(id) {
  return once(`floor:${id}`, 512, FLOORS[id] || FLOORS.wood);
}

/** Patterns for fabric: a quilt, a rug, a cushion. */
export const FABRICS = {
  gingham: (g, S, [a, b] = ['#ffb3c9', '#ffffff']) => {
    g.fillStyle = b;
    g.fillRect(0, 0, S, S);
    const k = S / 8;
    g.globalAlpha = 0.55;
    g.fillStyle = a;
    for (let i = 0; i < 8; i += 2) {
      g.fillRect(i * k, 0, k, S);
      g.fillRect(0, i * k, S, k);
    }
    g.globalAlpha = 1;
  },
  stars: (g, S, [a, b] = ['#ffd45e', '#3c4378']) => {
    g.fillStyle = b;
    g.fillRect(0, 0, S, S);
    const rnd = rng(31);
    const k = S / 4;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = a;
        star(g, i * k + (j % 2 ? k / 2 : k / 4) + rnd.range(-4, 4), j * k + k / 2, k * 0.16);
        g.fill();
      }
    noise(g, S, rnd, 60, ['#ffffff'], 0.6, 0.6, 1.2);
  },
  hearts: (g, S, [a, b] = ['#ff7fa8', '#fff1f5']) => {
    g.fillStyle = b;
    g.fillRect(0, 0, S, S);
    const k = S / 4;
    for (let i = 0; i < 4; i++)
      for (let j = 0; j < 4; j++) {
        g.fillStyle = a;
        heartPath(g, i * k + (j % 2 ? k / 2 : k / 4) + k / 4, j * k + k / 2, k * 0.3);
        g.fill();
      }
  },
  stripes: (g, S, [a, b, c] = ['#ff9fbd', '#fff6ea', '#ffd27a']) => {
    const bands = [a, b, c, b];
    for (let i = 0; i < 8; i++) {
      g.fillStyle = bands[i % 4];
      g.fillRect(0, (i * S) / 8, S, S / 8);
    }
    noise(g, S, rng(32), 1500, ['#ffffff', '#000000'], 0.05, 0.4, 1);
  },
  rings: (g, S, [a, b, c] = ['#ffb5c9', '#fff4f7', '#ffd9a3']) => {
    const cx = S / 2;
    const bands = [a, b, c, b, a, b];
    for (let i = 0; i < bands.length; i++) {
      g.fillStyle = bands[i];
      g.beginPath();
      g.arc(cx, cx, (S / 2) * (1 - i / bands.length), 0, TAU);
      g.fill();
    }
    g.fillStyle = '#ff7fa8';
    heartPath(g, cx, cx, S * 0.14);
    g.fill();
    noise(g, S, rng(33), 1600, ['#ffffff', '#000000'], 0.05, 0.4, 1);
  },
};

export function fabric(id, colors) {
  return once(`fabric:${id}:${(colors || []).join(',')}`, 256, (g, S) => FABRICS[id](g, S, colors));
}
