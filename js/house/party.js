// A day worth remembering in the house (js/days.js: the 100th day, an anniversary, a birthday, the day he comes round):
// bunting along a wall, near the top — a pennant to each letter of what it says ("100일 축하해"), a heart where there is
// a space and one at each end, in her colours. It hangs in that wall's group, so it folds away with it. (The world hangs
// one on the back wall and one on the right: on a phone the back wall is seen side-on, the right one face-on.)
import * as THREE from '../vendor/three.module.min.js';
import { wallFrame, WALL_H } from './room.js';
import { disposeTree } from '../fox/kit.js';

const COLORS = ['#ff9fbd', '#fff3d6', '#ffd27a', '#a8e0c4', '#c9b6ff', '#a9d0f5'];
const INK = ['#8a2f55', '#a0603a', '#8a5a14', '#2f6e55', '#5a3f9a', '#2f5a8a'];
const MAX = 14; // pennants at most

/* A pennant's face: its colour, and its letter (or a heart) near the top, where it is wide. */
function face(ch, i) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = COLORS[i % COLORS.length];
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = ch === '♥' ? '#ff5d8f' : INK[i % INK.length];
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `${ch === '♥' ? 50 : 60}px Jua, "Gowun Dodum", "Nanum Gothic", sans-serif`;
  g.fillText(ch, 64, 42);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/** The bunting for `text` on a wall (`wall`: 'back' or 'right') of the room `spec` (roomSpec): a group in the room's own coordinates. */
export function makeBunting(spec, text, wall = 'back') {
  const chars = [...`♥${String(text).trim()}♥`.replace(/\s+/g, '♥')].slice(0, MAX);
  if (chars.length > MAX - 1) chars[chars.length - 1] = '♥';
  const f = wallFrame(spec, wall);
  const half = f.len / 2 - 0.35;
  const top = WALL_H - 0.06;
  const sag = 0.09;
  const OFF = 0.07; // (out from the wall: in front of what hangs on it)
  const at = (k) => {
    const u = -half + 2 * half * k;
    return f.at(u, top - sag * (1 - (2 * k - 1) ** 2), OFF);
  };
  const group = new THREE.Group();
  group.name = 'bunting';
  // the string
  const pts = [];
  for (let i = 0; i <= 24; i++) pts.push(at(i / 24));
  const string = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.0045, 5, false), new THREE.MeshStandardMaterial({ color: '#c98f8a', roughness: 0.8 }));
  group.add(string);
  // the pennants: evenly along it, each hanging from it, tipped as the string runs
  const n = chars.length;
  const gap = (2 * half) / n;
  const w = Math.min(0.28, gap * 0.86);
  const h = w * 1.15;
  const tri = new THREE.BufferGeometry();
  tri.setAttribute('position', new THREE.Float32BufferAttribute([-w / 2, 0, 0, w / 2, 0, 0, 0, -h, 0], 3));
  tri.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 0.5, 0], 2));
  tri.setAttribute('normal', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 0, 0, 1], 3));
  chars.forEach((ch, i) => {
    const k = (i + 0.5) / n;
    const p = at(k);
    const q = at(Math.min(1, k + 0.01));
    const flag = new THREE.Mesh(tri, new THREE.MeshStandardMaterial({ map: face(ch, i), roughness: 0.85, side: THREE.DoubleSide }));
    flag.position.copy(p);
    flag.rotation.set(0, f.yaw, Math.atan2(q.y - p.y, Math.hypot(q.x - p.x, q.z - p.z)));
    flag.userData.sway = i * 1.7;
    group.add(flag);
  });
  return group;
}

/** (a breath of air: the pennants stir) */
export function swayBunting(group, t) {
  for (const o of group.children) if (o.userData.sway != null) o.rotation.x = Math.sin(t * 1.3 + o.userData.sway) * 0.07;
}

export function dropBunting(group) {
  if (!group) return;
  if (group.parent) group.parent.remove(group);
  disposeTree(group);
}
