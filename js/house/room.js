// The house itself: one room on a slab, its floor, four walls, a door on the right with a
// little porch outside it, and a window on the back wall. It is seen like a doll's house —
// the walls on the side she looks from fold down out of the way (cut), so that whichever way
// she turns it she looks in. Behind the window is Incheon: the sky as it is right now over the
// city (the sun, the evening, tonight's moon and its phase), its weather right now, the
// season on the tree outside, the lights of the flats at night — painted on a canvas, seen
// through the glass with a little depth to it. In the day a patch of sunlight comes in through
// the window and lies on the floor where the real sun puts it (the window faces south, as a
// flat in Korea does), with the shadow of the window's cross in it; at night, the moon's.
//
// The room's own measure: the middle of the floor at the origin, +X to the right, +Z to the
// front (towards her), the floor at y = 0. Its walls are named by where they stand: back,
// front, left, right. Along each wall `u` is the distance from its middle: x on the back and
// the front wall, z on the left and the right one.
import * as THREE from '../vendor/three.module.min.js';
import { V, TAU, rng, roundBox, MAT, wallpaper, floorTexture, heart } from './shapes.js';
import { CELL } from './furniture.js';

export const WALL_H = 1.8;
export const WALL_T = 0.12;
const STUB = 0.13; //                  how much of a wall is left when it folds out of the way
export const ROOMS = [
  { w: 6, d: 4.5 },
  { w: 7.5, d: 5.5 },
  { w: 9, d: 6.5 },
];
const DOOR = { w: 0.72, h: 1.46, back: 0.9 }; //        on the right wall; its middle `back` from the front corner
const WIN = { w: 1.6, y0: 0.56, y1: 1.46, at: -0.12 }; // on the back wall; its middle `at` × the width from the middle
export const SHADOW_LAYER = 2; //                       what only the sunbeam's shadow sees (the walls as they stand, cut or not)

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const snap = (v) => Math.round(v / CELL) * CELL;
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/** Where everything of the room is, for a size of it (0, 1, 2). */
export function roomSpec(size = 0) {
  const r = ROOMS[clamp(size | 0, 0, ROOMS.length - 1)];
  const doorU = snap(r.d / 2 - DOOR.back);
  const winU = snap(r.w * WIN.at);
  return {
    size,
    w: r.w,
    d: r.d,
    door: { wall: 'right', u: doorU, w: DOOR.w, h: DOOR.h },
    win: { wall: 'back', u: winU, w: WIN.w, y0: WIN.y0, y1: WIN.y1 },
    // the way in: nothing may stand there (the floor just inside the door)
    clear: { x0: r.w / 2 - 1.0, x1: r.w / 2, z0: doorU - 0.55, z1: doorU + 0.55 },
    switch: { wall: 'right', u: doorU - 0.66, y: 1.02 },
    // on the walls, what cannot be hung over: the window (and its curtains), the door, the light switch
    keepOff: [
      { wall: 'back', u0: winU - WIN.w / 2 - 0.42, u1: winU + WIN.w / 2 + 0.42, y0: WIN.y0 - 0.16, y1: WIN.y1 + 0.24 },
      { wall: 'right', u0: doorU - DOOR.w / 2 - 0.08, u1: doorU + DOOR.w / 2 + 0.08, y0: 0, y1: DOOR.h + 0.1 },
      { wall: 'right', u0: doorU - 0.66 - 0.08, u1: doorU - 0.66 + 0.08, y0: 0.9, y1: 1.14 },
    ],
  };
}

/** A wall's frame: how long it is, where a point on it is (u along it, y up — `off` out from it into the room), the way it faces. */
export function wallFrame(spec, wall) {
  const { w, d } = spec;
  const f = {
    back: { len: w, yaw: 0, at: (u, y, off = 0) => V(u, y, -d / 2 + off), out: V(0, 0, -1) },
    front: { len: w, yaw: Math.PI, at: (u, y, off = 0) => V(u, y, d / 2 - off), out: V(0, 0, 1) },
    left: { len: d, yaw: Math.PI / 2, at: (u, y, off = 0) => V(-w / 2 + off, y, u), out: V(-1, 0, 0) },
    right: { len: d, yaw: -Math.PI / 2, at: (u, y, off = 0) => V(w / 2 - off, y, u), out: V(1, 0, 0) },
  }[wall];
  return f;
}
/* (the wall's own x for a `u` along it: its geometry is drawn with +X to the right as seen from inside the room) */
const localX = { back: 1, front: -1, left: -1, right: 1 };

// ------------------------------------------------------------------ the window's view

/*
 * What is out there, painted: { sky: Moon.now() (dark, gold, blue, sun, sunAz, moon), weather: { kind, level }, season,
 * hour }. The window faces south: east is to the left, west to the right; the sun and the moon stand across the picture
 * by their bearing, and up it by how high they are (squeezed in, so that they show).
 */
function paintView(g, W, H, v) {
  const s = v.sky || { gold: 0, blue: 0, dark: false, sun: 40, sunAz: 0, moon: null };
  const kind = (v.weather && v.weather.kind) || 'clear';
  const grey = kind === 'rain' ? 0.6 : kind === 'cloudy' ? 0.35 : kind === 'snow' ? 0.4 : kind === 'wind' ? 0.3 : 0;
  const night = s.dark ? 1 : s.blue;
  const gold = s.gold * (1 - night);
  const mix = (a, b, t) => {
    const ca = new THREE.Color(a);
    return '#' + ca.lerp(new THREE.Color(b), clamp(t, 0, 1)).getHexString();
  };
  const greyed = (c) => mix(c, kind === 'rain' ? '#8f97a8' : '#b9bfcc', grey * (1 - night * 0.6));
  // the sky: day → a sunset's gold → the blue of the evening → night
  let top = mix('#7fbfff', '#ff9e7a', gold);
  let low = mix('#d6efff', '#ffd59e', gold);
  top = mix(top, '#141b44', night);
  low = mix(low, s.dark ? '#2b3670' : '#e88aa3', night);
  const sky = g.createLinearGradient(0, 0, 0, H * 0.72);
  sky.addColorStop(0, greyed(top));
  sky.addColorStop(1, greyed(low));
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);
  const rnd = rng(77);
  // stars, on a clear night
  if (night > 0.3 && grey < 0.5) {
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = (night - 0.3) * rnd.range(0.4, 1) * (1 - grey);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(rnd() * W, rnd() * H * 0.6, rnd.range(0.6, 1.8), 0, TAU);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  const across = (az) => W / 2 + (az / (Math.PI / 2)) * W * 0.62; // (south in the middle, east to the left)
  const upTo = (alt) => H * 0.66 - clamp(alt / 50, 0, 1) * H * 0.56;
  // the sun
  if (!s.dark && s.sun > -2) {
    const x = across(s.sunAz);
    const y = upTo(s.sun);
    const r = W * 0.035;
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 5);
    halo.addColorStop(0, `rgba(255, 244, 214, ${0.8 * (1 - grey)})`);
    halo.addColorStop(1, 'rgba(255, 244, 214, 0)');
    g.fillStyle = halo;
    g.fillRect(x - r * 5, y - r * 5, r * 10, r * 10);
    g.globalAlpha = 1 - grey * 0.9;
    g.fillStyle = gold > 0.3 ? '#ffb46a' : '#fff6dc';
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
    g.globalAlpha = 1;
  }
  // the moon, in tonight's phase, its lit side towards the sun
  const m = s.moon;
  if (m && m.up && night > 0.15) {
    const x = across(m.az);
    const y = upTo((m.alt * 180) / Math.PI);
    const r = W * 0.032;
    const a = m.limb ? Math.atan2(-m.limb[1], m.limb[0]) : 0;
    g.save();
    g.globalAlpha = Math.min(1, night * 1.4) * (1 - grey * 0.85);
    const halo = g.createRadialGradient(x, y, 0, x, y, r * 4);
    halo.addColorStop(0, `rgba(230, 236, 255, ${0.35 * m.fraction})`);
    halo.addColorStop(1, 'rgba(230, 236, 255, 0)');
    g.fillStyle = halo;
    g.fillRect(x - r * 4, y - r * 4, r * 8, r * 8);
    g.translate(x, y);
    g.rotate(a);
    g.fillStyle = 'rgba(60, 70, 110, 0.55)';
    g.beginPath();
    g.arc(0, 0, r, 0, TAU);
    g.fill();
    const k = 1 - 2 * m.fraction;
    g.fillStyle = '#fbf6e2';
    g.beginPath();
    g.arc(0, 0, r, -Math.PI / 2, Math.PI / 2);
    g.ellipse(0, 0, Math.max(0.001, Math.abs(k) * r), r, 0, Math.PI / 2, -Math.PI / 2, k > 0);
    g.fill();
    g.restore();
  }
  // clouds
  const clouds = kind === 'clear' ? 3 : 8;
  for (let i = 0; i < clouds; i++) {
    const x = rnd() * W;
    const y = rnd.range(0.08, 0.42) * H;
    const k = rnd.range(0.6, 1.2) * (kind === 'clear' ? 0.7 : 1.1);
    const c = mix(mix('#ffffff', '#ffd7c0', gold), '#4a5288', night * 0.85);
    g.fillStyle = greyed(c);
    g.globalAlpha = kind === 'clear' ? 0.75 : 0.9;
    for (const [dx, dy, r] of [[0, 0, 34], [36, 8, 26], [-36, 9, 24], [14, -16, 22], [-14, -14, 20]]) {
      g.beginPath();
      g.arc(x + dx * k * (W / 1024), y + dy * k * (W / 1024), r * k * (W / 1024), 0, TAU);
      g.fill();
    }
  }
  g.globalAlpha = 1;
  // the city: low hills, Songdo's towers by the sea — the tallest, the Northeast Asia Trade Tower, its top cut on a
  // slant — rows of flats; their windows lit at night
  const far = greyed(mix(mix('#a9b9dc', '#c99aa8', gold), '#272e5c', night));
  const near = greyed(mix(mix('#8ea2cf', '#b07f95', gold), '#1d2350', night));
  g.fillStyle = far;
  g.beginPath();
  g.moveTo(0, H * 0.7);
  for (let x = 0; x <= W; x += W / 16) g.lineTo(x, H * 0.67 - Math.sin(x / W * 5.3 + 1) * H * 0.03);
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.fill();
  const base = H * 0.68;
  const tower = (x, w, h, slant = 0) => {
    g.beginPath();
    g.moveTo(x - w / 2, base);
    g.lineTo(x - w * 0.42, base - h);
    g.lineTo(x + w * 0.42, base - h + slant);
    g.lineTo(x + w / 2, base);
    g.closePath();
    g.fill();
    return base - h;
  };
  g.fillStyle = mix(far, near, 0.25);
  for (const [dx, w, h] of [[-0.075, 0.03, 0.15], [-0.045, 0.024, 0.19], [0.04, 0.028, 0.17], [0.07, 0.022, 0.13], [0.1, 0.03, 0.1]]) tower(W * (0.675 + dx), W * w, H * h);
  const tx = W * 0.675;
  g.fillStyle = far;
  const peak = tower(tx, W * 0.038, H * 0.27, H * 0.035);
  if (night > 0.4) {
    // its windows, and the red light on its top
    g.fillStyle = `rgba(255, 226, 170, ${0.7 * night})`;
    for (let y = peak + H * 0.04; y < base - H * 0.02; y += H * 0.022) for (const k of [-0.25, 0, 0.25]) if (rnd() < 0.55) g.fillRect(tx + k * W * 0.03 - 1.5, y, 3, 2);
    g.fillStyle = '#ff4f5f';
    g.beginPath();
    g.arc(tx - W * 0.012, peak, 2.4, 0, TAU);
    g.fill();
  }
  const lights = night > 0.35;
  for (let row = 0; row < 2; row++) {
    let x = -rnd() * 60;
    while (x < W) {
      const bw = rnd.range(W * 0.06, W * 0.11);
      const bh = rnd.range(H * 0.12, H * 0.26) * (row ? 1.25 : 1);
      const base = H * (row ? 1.02 : 0.86);
      g.fillStyle = row ? near : mix(far, near, 0.5);
      g.fillRect(x, base - bh, bw, bh + 4);
      // the flats' windows
      const cols = Math.max(2, Math.floor(bw / 14));
      const rows = Math.floor(bh / 14);
      for (let i = 0; i < cols; i++)
        for (let j = 1; j < rows; j++) {
          const lit = lights && rnd() < 0.42;
          if (!lit && !(!lights && rnd() < 0.15)) continue;
          g.fillStyle = lit ? `rgba(255, ${rnd() < 0.3 ? 236 : 214}, ${rnd() < 0.3 ? 196 : 150}, ${0.85 * night})` : 'rgba(255, 255, 255, 0.18)';
          g.fillRect(x + 4 + i * ((bw - 8) / cols), base - bh + j * 14, ((bw - 8) / cols) * 0.55, 6);
        }
      x += bw + rnd.range(4, 22);
    }
  }
  // a branch of the tree outside, in its season
  const season = v.season || 'autumn';
  g.strokeStyle = night > 0.5 ? '#2a2230' : '#6b4a3a';
  g.lineCap = 'round';
  const branch = [[W * 1.02, H * 0.12, W * 0.78, H * 0.2, 16], [W * 0.86, H * 0.17, W * 0.72, H * 0.08, 8], [W * 0.8, H * 0.19, W * 0.66, H * 0.3, 7], [W * 0.92, H * 0.15, W * 0.86, H * 0.36, 6]];
  for (const [x0, y0, x1, y1, lw] of branch) {
    g.lineWidth = lw * (W / 1024);
    g.beginPath();
    g.moveTo(x0, y0);
    g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 - 10, x1, y1);
    g.stroke();
  }
  const leaves = { spring: ['#ffc2d6', '#ffe0ea', '#ff9fbd'], summer: ['#5fae5a', '#7cc56c', '#4a9a50'], autumn: ['#f28a3a', '#e8572f', '#f5b642'], winter: ['#ffffff', '#eef4ff', '#dfe8f8'] }[season] || ['#5fae5a'];
  const dim = 1 - night * 0.55;
  for (let i = 0; i < (season === 'winter' ? 26 : 70); i++) {
    const t = rnd();
    const b = branch[Math.floor(rnd() * branch.length)];
    const x = b[0] + (b[2] - b[0]) * t + rnd.range(-18, 18) * (W / 1024);
    const y = b[1] + (b[3] - b[1]) * t + rnd.range(-14, 14) * (W / 1024);
    g.globalAlpha = dim;
    g.fillStyle = rnd.pick(leaves);
    g.beginPath();
    if (season === 'winter') g.ellipse(x, y - 3, 9 * (W / 1024), 4 * (W / 1024), 0, 0, TAU);
    else g.ellipse(x, y, 8 * (W / 1024), 5.5 * (W / 1024), rnd() * TAU, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

const VIEW_VERTEX = /* glsl */ `
varying vec2 vUv;
varying vec3 vWorld;
void main() {
  vUv = uv;
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;

const VIEW_FRAGMENT = /* glsl */ `
uniform sampler2D uView;
uniform float uTime;
uniform float uRain;
uniform float uSnow;
uniform float uNight;
uniform vec3 uRight;
uniform vec3 uOut;
varying vec2 vUv;
varying vec3 vWorld;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rain(vec2 uv, float t, float k) {
  vec2 p = uv * vec2(34.0, 5.0) * k;
  p.y += t * 6.5;
  p.x += p.y * 0.06;
  vec2 id = floor(p);
  vec2 f = fract(p);
  float h = hash(id);
  float line = smoothstep(0.07, 0.0, abs(f.x - h)) * smoothstep(0.0, 0.35, f.y) * smoothstep(1.0, 0.55, f.y);
  return line * step(0.55, hash(id + 7.31));
}
float snow(vec2 uv, float t, float k) {
  vec2 p = uv * vec2(9.0, 6.0) * k;
  p.y += t * 0.55 * k;
  p.x += sin(p.y * 1.7 + t * 0.9 + k) * 0.18;
  vec2 id = floor(p);
  vec2 f = fract(p) - 0.5;
  vec2 o = vec2(hash(id), hash(id + 3.17)) - 0.5;
  float d = length(f - o * 0.55);
  return smoothstep(0.13, 0.05, d) * step(0.35, hash(id + 1.73));
}
void main() {
  // a little depth: the view shifts as she looks through the window from one side or the other
  vec3 eye = normalize(vWorld - cameraPosition);
  vec2 shift = vec2(dot(eye, uRight), eye.y) * vec2(0.16, 0.12);
  vec2 uv = vec2(0.5) + (vUv - 0.5) * 0.74 + shift;
  vec3 col = texture2D(uView, uv).rgb;
  // what is falling outside
  vec2 q = vec2(vUv.x * 1.6, vUv.y);
  float r = (rain(q, uTime, 1.0) * 0.7 + rain(q + 0.37, uTime * 1.3, 1.6) * 0.45) * uRain;
  col = mix(col, vec3(0.86, 0.9, 1.0), r * 0.55);
  float s = (snow(q, uTime, 1.0) + snow(q + 0.5, uTime * 0.8, 1.7) * 0.7) * uSnow;
  col = mix(col, vec3(1.0), clamp(s, 0.0, 1.0) * 0.9);
  // the glass: a cool sheen across it, brighter at a slant
  float sheen = smoothstep(0.0, 1.0, 1.0 - abs(vUv.x - vUv.y * 0.6 - 0.15) * 3.0) * 0.08;
  float slant = pow(1.0 - abs(dot(eye, -uOut)), 3.0) * 0.18;
  col += vec3(0.85, 0.92, 1.0) * (sheen + slant) * (1.0 - uNight * 0.6);
  gl_FragColor = vec4(col, 1.0);
  #include <colorspace_fragment>
}`;

// ------------------------------------------------------------------ the room

export class Room {
  constructor(world) {
    this.world = world;
    this.group = new THREE.Group();
    this.spec = null;
    this.walls = {}; //  name → { pivot, items, shown (0 … 1), want, mesh }
    this.wallId = 'cream';
    this.floorId = 'wood';
    this.taps = []; //   what can be tapped of the room itself: the window, the door, the light switch
    this.doorOpen = 0;
    this.doorWant = 0;
    this.switchOn = true;
    this.viewKey = '';
    this.time = 0;

    // the materials the walls and the floor wear
    this.wallMat = new THREE.MeshStandardMaterial({ map: wallpaper('cream'), roughness: 0.92 });
    this.edgeMat = new THREE.MeshStandardMaterial({ color: '#fbf4ec', roughness: 0.85 });
    this.floorMat = new THREE.MeshStandardMaterial({ map: floorTexture('wood').clone(), roughness: 0.68 });
    this.slabMat = new THREE.MeshStandardMaterial({ color: '#f4e6d8', roughness: 0.9 });
    this.trimMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 });

    // the window's view, painted
    this.viewCanvas = document.createElement('canvas');
    this.viewCanvas.width = 1024;
    this.viewCanvas.height = 640;
    this.viewTex = new THREE.CanvasTexture(this.viewCanvas);
    this.viewTex.colorSpace = THREE.SRGBColorSpace;
    this.viewTex.anisotropy = 4;
    this.viewMat = new THREE.ShaderMaterial({
      uniforms: {
        uView: { value: this.viewTex },
        uTime: { value: 0 },
        uRain: { value: 0 },
        uSnow: { value: 0 },
        uNight: { value: 0 },
        uRight: { value: V(1, 0, 0) },
        uOut: { value: V(0, 0, -1) },
      },
      vertexShader: VIEW_VERTEX,
      fragmentShader: VIEW_FRAGMENT,
    });

    // the sunbeam: a spotlight from out there through the window; only the walls as they stand (layer 2) and what is in
    // the room throw shadows in it
    this.beam = new THREE.SpotLight('#fff1d6', 0, 0, 0.3, 0.35, 0);
    this.beam.castShadow = true;
    this.beam.shadow.mapSize.setScalar(world.coarse ? 1024 : 2048);
    this.beam.shadow.bias = -0.0006;
    this.beam.shadow.normalBias = 0.02;
    this.beam.shadow.camera.near = 2;
    this.beam.shadow.camera.far = 14;
    this.beam.shadow.camera.layers.enable(SHADOW_LAYER);
    this.group.add(this.beam, this.beam.target);

    // a soft shadow under the house, on nothing
    const shadowTex = (() => {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const grad = g.createRadialGradient(64, 64, 10, 64, 64, 64);
      grad.addColorStop(0, 'rgba(90, 60, 80, 0.32)');
      grad.addColorStop(1, 'rgba(90, 60, 80, 0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, 128, 128);
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      return t;
    })();
    this.under = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
    this.under.rotation.x = -Math.PI / 2;
    this.under.position.y = -0.32;
    this.under.renderOrder = -1;
    this.group.add(this.under);
  }

  /** Build the room for `spec` (roomSpec): everything but what stands in it. */
  build(spec) {
    this.spec = spec;
    const old = this.shell;
    if (old) {
      this.group.remove(old);
      old.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
      });
    }
    const shell = (this.shell = new THREE.Group());
    this.group.add(shell);
    this.taps = [];
    const { w, d } = spec;
    const T = WALL_T;

    // the slab, its floor on top
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w + 2 * T, 0.24, d + 2 * T), [this.slabMat, this.slabMat, this.floorMat, this.slabMat, this.slabMat, this.slabMat]);
    slab.position.y = -0.12;
    slab.receiveShadow = true;
    shell.add(slab);
    this.floorMat.map.repeat.set(w + 2 * T, d + 2 * T);
    this.floorMat.map.needsUpdate = true;
    this.under.scale.set((w + 2 * T) * 1.7, (d + 2 * T) * 1.9, 1);

    // the porch outside the door, and a mat on it that says welcome
    const porch = new THREE.Group();
    const pz = spec.door.u;
    const step = new THREE.Mesh(roundBox(0.95, 0.2, 1.3, 0.03), this.slabMat);
    step.position.set(w / 2 + T + 0.47, -0.1, pz);
    step.receiveShadow = true;
    const mat = new THREE.Mesh(roundBox(0.55, 0.012, 0.85, 0.01), new THREE.MeshStandardMaterial({ map: this.welcome(), roughness: 1 }));
    mat.position.set(w / 2 + T + 0.38, 0.006, pz);
    mat.rotation.y = -Math.PI / 2;
    mat.receiveShadow = true;
    porch.add(step, mat);
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.085, 0.2, 18), new THREE.MeshStandardMaterial({ color: '#e99a63', roughness: 0.8 }));
    pot.position.set(w / 2 + T + 0.75, 0.1, pz - 0.48);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.15, 1), new THREE.MeshStandardMaterial({ color: '#6fbf6a', roughness: 0.8, flatShading: true }));
    bush.position.set(w / 2 + T + 0.75, 0.3, pz - 0.48);
    pot.castShadow = bush.castShadow = true;
    porch.add(pot, bush);
    shell.add(porch);

    // the walls
    for (const name of ['back', 'front', 'left', 'right']) this.buildWall(name, shell);
    this.buildWindow();
    this.buildDoor();
    this.buildSwitch();
    this.setWallpaper(this.wallId);
  }

  /** The doormat: "어서 와" in its weave. */
  welcome() {
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const g = c.getContext('2d');
    g.fillStyle = '#c9965f';
    g.fillRect(0, 0, 256, 160);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = Math.random() < 0.5 ? 'rgba(120, 80, 40, 0.18)' : 'rgba(255, 230, 190, 0.16)';
      g.fillRect(Math.random() * 256, Math.random() * 160, 2, 2);
    }
    g.fillStyle = '#7a4a3a';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '700 46px Jua, sans-serif';
    g.fillText('어서 와 💗', 128, 84);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }

  /* One wall: a board with its holes (the window, the door), its skirting and its cornice — on a pivot at its foot, so
     that it can fold down — and the same board again for the sun's shadow, standing whatever the camera does. */
  buildWall(name, shell) {
    const spec = this.spec;
    const T = WALL_T;
    const f = wallFrame(spec, name);
    const len = name === 'back' || name === 'front' ? spec.w + 2 * T : spec.d;
    const shape = new THREE.Shape();
    shape.moveTo(-len / 2, 0);
    shape.lineTo(len / 2, 0);
    shape.lineTo(len / 2, WALL_H);
    shape.lineTo(-len / 2, WALL_H);
    shape.closePath();
    const lx = localX[name];
    if (name === 'back') {
      const { u, w, y0, y1 } = spec.win;
      const hole = new THREE.Path();
      hole.moveTo(lx * u - w / 2, y0);
      hole.lineTo(lx * u - w / 2, y1);
      hole.lineTo(lx * u + w / 2, y1);
      hole.lineTo(lx * u + w / 2, y0);
      hole.closePath();
      shape.holes.push(hole);
    }
    if (name === 'right') {
      const { u, w, h } = spec.door;
      const hole = new THREE.Path();
      hole.moveTo(lx * u - w / 2, 0.0001);
      hole.lineTo(lx * u - w / 2, h);
      hole.lineTo(lx * u + w / 2, h);
      hole.lineTo(lx * u + w / 2, 0.0001);
      hole.closePath();
      shape.holes.push(hole);
    }
    const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false, curveSegments: 1 });
    geo.translate(0, 0, -T);
    const pivot = new THREE.Group();
    const at = f.at(0, 0);
    pivot.position.copy(at);
    pivot.rotation.y = f.yaw;
    const mesh = new THREE.Mesh(geo, [this.wallMat, this.edgeMat]);
    mesh.receiveShadow = true;
    pivot.add(mesh);
    // the skirting board, and the cornice along the top
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(len, 0.1, 0.022), this.trimMat);
    skirt.position.set(0, 0.05, 0.011);
    skirt.receiveShadow = true;
    const top = new THREE.Mesh(new THREE.BoxGeometry(len, 0.05, 0.03), this.trimMat);
    top.position.set(0, WALL_H - 0.025, 0.015);
    pivot.add(skirt, top);
    if (name === 'right') {
      // (no skirting across the doorway)
      skirt.geometry.dispose();
      const { u, w } = spec.door;
      const a = lx * u - w / 2 + len / 2;
      const b = len / 2 - (lx * u + w / 2);
      skirt.geometry = new THREE.BoxGeometry(a, 0.1, 0.022);
      skirt.position.x = -len / 2 + a / 2;
      const skirt2 = new THREE.Mesh(new THREE.BoxGeometry(b, 0.1, 0.022), this.trimMat);
      skirt2.position.set(len / 2 - b / 2, 0.05, 0.011);
      pivot.add(skirt2);
    }
    shell.add(pivot);
    // the shadow's wall
    const ghost = new THREE.Mesh(geo, MAT.dark);
    ghost.position.copy(pivot.position);
    ghost.rotation.copy(pivot.rotation);
    ghost.castShadow = true;
    ghost.layers.set(SHADOW_LAYER);
    shell.add(ghost);
    // what hangs on the wall goes here: it is not folded with it (only hidden)
    const items = new THREE.Group();
    shell.add(items);
    const was = this.walls[name];
    this.walls[name] = { name, pivot, mesh, items, len, out: f.out, shown: was ? was.shown : 1, want: was ? was.want : 1 };
    pivot.scale.y = Math.max(STUB / WALL_H, this.walls[name].shown);
  }

  buildWindow() {
    const spec = this.spec;
    const { u, w, y0, y1 } = spec.win;
    const wall = this.walls.back;
    const T = WALL_T;
    const h = y1 - y0;
    const frame = new THREE.Group();
    const wood = this.trimMat;
    const bar = (bw, bh, bd, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, bd), wood);
      m.position.set(x, y, z);
      m.castShadow = true;
      m.layers.enable(SHADOW_LAYER);
      frame.add(m);
      return m;
    };
    const F = 0.045;
    bar(w + 2 * F, F, T + 0.02, 0, y1 + F / 2, -T / 2);
    bar(w + 2 * F, F, T + 0.02, 0, y0 - F / 2, -T / 2);
    bar(F, h, T + 0.02, -w / 2 - F / 2, (y0 + y1) / 2, -T / 2);
    bar(F, h, T + 0.02, w / 2 + F / 2, (y0 + y1) / 2, -T / 2);
    // the cross of the window
    bar(0.035, h, 0.04, 0, (y0 + y1) / 2, -T / 2);
    bar(w, 0.035, 0.04, 0, y0 + h * 0.58, -T / 2);
    // the sill, inside
    const sill = bar(w + 0.2, 0.035, 0.13, 0, y0 - 0.035, 0.045);
    sill.layers.disable(SHADOW_LAYER);
    // the glass, with the view behind it
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w, h), this.viewMat);
    glass.position.set(0, (y0 + y1) / 2, -T / 2 - 0.005);
    glass.userData.tap = 'window';
    frame.add(glass);
    this.taps.push(glass);
    this.glass = glass;
    frame.position.copy(wallFrame(spec, 'back').at(u, 0));
    wall.pivot.parent.add(frame);
    this.windowFrame = frame;
    // the curtains, and their rod (these hang with the things on the wall: they are hidden, not folded, with it)
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, w + 0.82, 10), new THREE.MeshStandardMaterial({ color: '#e9c26a', roughness: 0.3, metalness: 0.7 }));
    rod.rotation.z = Math.PI / 2;
    rod.position.set(u, y1 + 0.13, -spec.d / 2 + 0.07);
    wall.items.add(rod);
    for (const s of [-1, 1]) {
      const c = this.curtain(h + 0.42);
      c.position.set(u + s * (w / 2 + 0.2), y1 + 0.12, -spec.d / 2 + 0.07);
      c.scale.x = s;
      wall.items.add(c);
    }
    this.uniformsFor(wall);
  }

  /* A curtain, gathered and tied back: soft folds that hang from the rod and narrow to the tie. (Hangs from its top.) */
  curtain(len) {
    const geo = new THREE.PlaneGeometry(0.4, len, 14, 18);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      const y = p.getY(i) - len / 2; // 0 at the top … −len at the bottom
      const t = -y / len;
      const tie = Math.exp(-Math.pow((t - 0.62) / 0.16, 2));
      const nx = x * (1 - 0.55 * tie) + 0.06 * tie; // (gathered to the outside)
      p.setXYZ(i, nx, y, Math.sin((x + 0.2) * 34) * 0.025 * (1 - 0.6 * tie) + 0.02);
    }
    geo.computeVertexNormals();
    const mat = new THREE.MeshStandardMaterial({ color: '#ffe3ec', roughness: 0.95, side: THREE.DoubleSide });
    const m = new THREE.Mesh(geo, mat);
    m.receiveShadow = true; // (it throws no shadow of its own: in the sunbeam it would lie on the wall as a dark blot)
    const g = new THREE.Group();
    g.add(m);
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.016, 6, 16), new THREE.MeshStandardMaterial({ color: '#ff8fb2', roughness: 0.5 }));
    tie.position.set(0.04, -len * 0.62, 0.03);
    tie.scale.set(1, 0.5, 1);
    g.add(tie);
    return g;
  }

  uniformsFor(wall) {
    const f = wallFrame(this.spec, wall.name);
    this.viewMat.uniforms.uOut.value.copy(f.out);
    this.viewMat.uniforms.uRight.value.set(1, 0, 0);
  }

  buildDoor() {
    const spec = this.spec;
    const { u, w, h } = spec.door;
    const wall = this.walls.right;
    const f = wallFrame(spec, 'right');
    // the frame round the doorway
    const trim = new THREE.Group();
    const T = WALL_T;
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, h + 0.06, T + 0.03), this.trimMat);
      m.position.set(s * (w / 2 + 0.03), (h + 0.06) / 2, -T / 2);
      trim.add(m);
    }
    const lintel = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, 0.06, T + 0.03), this.trimMat);
    lintel.position.set(0, h + 0.03, -T / 2);
    trim.add(lintel);
    trim.position.copy(f.at(u, 0));
    trim.rotation.y = f.yaw;
    wall.pivot.parent.add(trim);
    this.doorTrim = trim;
    // the door: hinged at its back edge, it opens into the room — back towards the back wall, so that whoever is on the
    // step outside shows through the doorway
    const hinge = new THREE.Group();
    hinge.position.copy(f.at(u - w / 2, 0, 0.02));
    hinge.rotation.y = f.yaw;
    const leaf = new THREE.Group();
    const board = new THREE.Mesh(roundBox(w - 0.02, h - 0.02, 0.045, 0.015), new THREE.MeshStandardMaterial({ color: '#ff9cbc', roughness: 0.55 }));
    board.position.set((w - 0.02) / 2, (h - 0.02) / 2 + 0.005, -0.03);
    board.castShadow = true;
    board.layers.enable(SHADOW_LAYER);
    leaf.add(board);
    const panel = new THREE.Mesh(roundBox(w - 0.2, h * 0.36, 0.01, 0.008), new THREE.MeshStandardMaterial({ color: '#ffb3c9', roughness: 0.55 }));
    panel.position.set((w - 0.02) / 2, h * 0.3, -0.006);
    leaf.add(panel);
    const pane = new THREE.Mesh(new THREE.CircleGeometry(0.11, 24), new THREE.MeshStandardMaterial({ color: '#cfe8ff', roughness: 0.1, emissive: '#cfe8ff', emissiveIntensity: 0.25 }));
    pane.position.set((w - 0.02) / 2, h * 0.76, -0.006);
    leaf.add(pane);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.025, 12, 10), new THREE.MeshStandardMaterial({ color: '#e9c26a', roughness: 0.3, metalness: 0.8 }));
    knob.position.set(w - 0.1, h * 0.48, 0.0);
    leaf.add(knob);
    // a heart wreath on it
    const wreath = new THREE.Mesh(heart(0.16, 0.025), new THREE.MeshStandardMaterial({ color: '#7cc56c', roughness: 0.7 }));
    wreath.position.set((w - 0.02) / 2, h * 0.57, 0.0);
    leaf.add(wreath);
    hinge.add(leaf);
    board.userData.tap = 'door';
    this.taps.push(board);
    wall.items.add(hinge);
    this.door = hinge;
  }

  buildSwitch() {
    const spec = this.spec;
    const s = spec.switch;
    const f = wallFrame(spec, s.wall);
    const g = new THREE.Group();
    const plate = new THREE.Mesh(roundBox(0.09, 0.13, 0.016, 0.008), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.4 }));
    plate.position.z = 0.008;
    plate.userData.tap = 'switch';
    const nub = new THREE.Mesh(roundBox(0.03, 0.05, 0.02, 0.008), new THREE.MeshStandardMaterial({ color: '#ffb3c9', roughness: 0.4 }));
    nub.position.z = 0.02;
    nub.userData.tap = 'switch';
    g.add(plate, nub);
    g.position.copy(f.at(s.u, s.y));
    g.rotation.y = f.yaw;
    this.walls[s.wall].items.add(g);
    this.taps.push(plate, nub);
    this.nub = nub;
  }

  setWallpaper(id) {
    this.wallId = id;
    this.wallMat.map = wallpaper(id);
    this.wallMat.needsUpdate = true;
  }

  setFloor(id) {
    this.floorId = id;
    const old = this.floorMat.map;
    this.floorMat.map = floorTexture(id).clone();
    this.floorMat.map.needsUpdate = true;
    if (this.spec) this.floorMat.map.repeat.set(this.spec.w + 2 * WALL_T, this.spec.d + 2 * WALL_T);
    if (old) old.dispose();
    this.floorMat.needsUpdate = true;
  }

  /** The light switch by the door, up or down (the room's light on or off). */
  setSwitch(on) {
    this.switchOn = !!on;
    if (this.nub) {
      this.nub.position.y = on ? 0.022 : -0.022;
      this.nub.rotation.x = on ? -0.25 : 0.25;
    }
  }

  /* ----- the walls that fold out of the way ----- */

  /** Fold down the walls on the side she looks from (`cam`: where the camera is); `now`: at once. */
  cut(cam, dt, now = false) {
    const v = V(cam.x, 0, cam.z);
    if (v.lengthSq() < 1e-6) return;
    v.normalize();
    for (const name in this.walls) {
      const wall = this.walls[name];
      const facing = v.dot(wall.out);
      // (with some give either way, so that a wall seen side-on does not flicker)
      if (facing > 0.34) wall.want = 0;
      else if (facing < 0.2) wall.want = 1;
      wall.shown = now ? wall.want : damp(wall.shown, wall.want, 7, dt);
      wall.pivot.scale.y = Math.max(STUB / WALL_H, wall.shown);
      wall.items.visible = wall.shown > 0.55;
    }
    const back = this.walls.back;
    this.windowFrame.visible = back.shown > 0.55;
    this.doorTrim.visible = this.walls.right.shown > 0.4;
  }

  /** Is that wall standing (and what hangs on it showing)? */
  standing(name) {
    const w = this.walls[name];
    return !!w && w.shown > 0.55;
  }

  /* ----- the view, the light that comes in ----- */

  /**
   * What is out there now: { sky (Moon.now()), weather: { kind, level }, season }. The view is painted again only when it
   * would look different (the sky moves slowly: every few minutes).
   */
  setView(v) {
    const s = v.sky || {};
    const m = s.moon || {};
    const key = [s.dark, Math.round((s.gold || 0) * 20), Math.round((s.blue || 0) * 20), Math.round(s.sun || 0), Math.round((s.sunAz || 0) * 30), m.up, Math.round((m.alt || 0) * 30), Math.round((m.az || 0) * 30), Math.round((m.fraction || 0) * 40), v.weather && v.weather.kind, v.season].join('|');
    this.viewState = v;
    if (key !== this.viewKey) {
      this.viewKey = key;
      paintView(this.viewCanvas.getContext('2d'), this.viewCanvas.width, this.viewCanvas.height, v);
      this.viewTex.needsUpdate = true;
    }
    const kind = v.weather ? v.weather.kind : 'clear';
    const level = v.weather ? v.weather.level || 0 : 0;
    this.rain = kind === 'rain' ? Math.max(0.35, level) : 0;
    this.snow = kind === 'snow' ? Math.max(0.35, level) : 0;
    this.viewMat.uniforms.uNight.value = s.dark ? 1 : s.blue || 0;
    this.aimBeam(v);
  }

  /*
   * The patch of light from the window: where the sun (or the moon) is, the room's south being behind its back wall —
   * its bearing across, its height down. Nothing when it is behind the house, too low, or hidden by cloud.
   */
  aimBeam(v) {
    const s = v.sky || {};
    const kind = v.weather ? v.weather.kind : 'clear';
    const cloud = kind === 'clear' ? 1 : kind === 'cloudy' ? 0.3 : kind === 'wind' ? 0.6 : 0.05;
    let alt = 0;
    let az = 0;
    let power = 0;
    let color = '#fff1d6';
    if (!s.dark && s.sun > 1) {
      alt = (s.sun * Math.PI) / 180;
      az = s.sunAz || 0;
      power = 6.5 * Math.min(1, s.sun / 12) * cloud;
      color = s.gold > 0.4 ? '#ffc58a' : '#fff1d6';
    } else if (s.dark && s.moon && s.moon.up && s.moon.alt > 0.05) {
      alt = s.moon.alt;
      az = s.moon.az;
      power = 1.6 * s.moon.fraction * cloud;
      color = '#c9d4ff';
    }
    // (from the south, westwards: in the room, south is −Z and west is +X)
    const dir = V(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
    if (dir.z > -0.12 || alt < 0.05) power = 0; // (the sun is round the back of the house, or on the horizon)
    alt = Math.max(alt, 0.08);
    const spec = this.spec;
    const mid = wallFrame(spec, 'back').at(spec.win.u, (spec.win.y0 + spec.win.y1) / 2, -WALL_T / 2);
    this.beam.position.copy(mid).addScaledVector(dir, 7);
    this.beam.target.position.copy(mid);
    this.beam.color.set(color);
    this.beamPower = power;
  }

  /* ----- the door ----- */

  openDoor(open) {
    this.doorWant = open ? 1 : 0;
  }

  update(dt, t) {
    this.time = t;
    this.viewMat.uniforms.uTime.value = t;
    this.viewMat.uniforms.uRain.value = damp(this.viewMat.uniforms.uRain.value, this.rain || 0, 1, dt);
    this.viewMat.uniforms.uSnow.value = damp(this.viewMat.uniforms.uSnow.value, this.snow || 0, 1, dt);
    // (the light stays, at nothing when there is no sun: switching it off would have every material built again — but its
    // shadow is not drawn while it gives no light)
    this.beam.intensity = damp(this.beam.intensity, this.beamPower || 0, 1.5, dt);
    if (this.beam.intensity < 0.005) this.beam.intensity = 0;
    this.beam.shadow.autoUpdate = this.beam.intensity > 0;
    this.doorOpen = damp(this.doorOpen, this.doorWant, 3.2, dt);
    if (this.door) this.door.rotation.y = wallFrame(this.spec, 'right').yaw - this.doorOpen * 1.65; // (into the room)
  }

  /** Where the door is, inside and out: where she comes in from, and the first step in. */
  doorway() {
    const spec = this.spec;
    return { outside: V(spec.w / 2 + WALL_T + 0.55, 0, spec.door.u), inside: V(spec.w / 2 - 0.55, 0, spec.door.u) };
  }
}
