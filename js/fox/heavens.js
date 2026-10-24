// The sky over the foxes' world at night, for when she looks up (world.gaze): the moon as it really is tonight —
// js/moon.js works out how full it is, where it stands, which way its lit side and its north are — the stars, and the
// glow of the sky round them; and a falling star, for a wish. And among the stars, ours (js/stars.js): four
// constellations to either side of the moon, a star for every day worth remembering, each joined to the one before it;
// a tap on one, and the app tells that day. By day nobody looks up, and none of it is drawn.
import * as THREE from '../vendor/three.module.min.js';
import { V, clamp, TAU, rng } from './kit.js';

const RAD = Math.PI / 180;
const R = 60; //          how far off the sky is (it goes along with the camera: nothing in it gets any nearer)
const STARS = 1500;
const MOON_DEG = 7.6; //  how wide the moon looks (degrees) — larger than in life, as it is in a picture
const NAVY = { zenith: '#070b24', horizon: '#26346a', glow: '#c9d6ff', dusk: '#5a3f8c', star: ['#ffffff', '#e4ecff', '#fff4dc', '#cfdcff'] };
// the dark seas on the moon's face — latitude, longitude, how far round they reach (degrees) — in which people here see
// a rabbit pounding rice cakes; and its brightest craters, Tycho (with its rays) first
const SEAS = [
  [20, -55, 16], [5, -58, 14], [32, -47, 12], [-5, -44, 10], [12, -38, 9], // Oceanus Procellarum
  [33, -16, 16], [45, -32, 4], // Imbrium, Sinus Iridum
  [28, 17, 10], [8, 31, 12], [14, 23, 7], // Serenitatis, Tranquillitatis
  [17, 59, 7.5], [-8, 51, 10], [-2, 46, 7], [-15, 35, 5], // Crisium, Fecunditatis, Nectaris
  [-21, -17, 10], [-10, -23, 6], [-24, -39, 5.5], // Nubium, Cognitum, Humorum
  [13, 4, 4], [7, -31, 7], // Vaporum, Insularum
  [56, -30, 6], [57, -10, 6], [56, 10, 6], [55, 30, 5], // Frigoris
];
const CRATERS = [[-43, -11, 1], [10, -20, 0.7], [8, -38, 0.5], [24, -47, 0.8]];
const _c = new THREE.Color();
const _w = V();
const _r = V();
const _u = V();
// our constellations: which side of the moon each one keeps to (-1 the left, 1 the right) and how high (0 level with
// it, 1 below); how far apart their stars are (of the box each is drawn in)
const OUR_PLACES = { lt: [-1, 0], rt: [1, 0], lb: [-1, 1], rb: [1, 1] };
const OUR_STEP = 0.26;
const OUR_GAP = 0.15;
const OUR_DEG = 1.5; //   how wide one of ours looks (degrees) — a bigger one, half as wide again
const OUR_R = R * 0.9 * 0.995; // how far off they are drawn (just in front of the moon's distance)
const LABEL_H = 1.7; //   how high a constellation's name is (in OUR_DEGs)
const LABEL_PX = 88; //   (its letters, on a canvas 128 high)
const LABEL_FONT = `700 ${LABEL_PX}px Gaegu, Jua, cursive`;
const _cam = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
const _p = V();

/** The moon's face, north up, as it is seen from the earth: bright highlands, the grey seas, a few bright craters. */
function paintFace(size = 256) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const g = canvas.getContext('2d');
  const c = size / 2;
  const unit = (lat, lon) => [Math.cos(lat * RAD) * Math.sin(lon * RAD), Math.sin(lat * RAD), Math.cos(lat * RAD) * Math.cos(lon * RAD)];
  const seas = SEAS.map(([lat, lon, reach]) => ({ at: unit(lat, lon), reach: reach * RAD * 1.45 }));
  // point by point: how far into a sea it is — the seas' edges wander a little, so that they are not round
  const img = g.createImageData(size, size);
  const px = img.data;
  const r = rng(2026);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const X = (x + 0.5 - c) / c;
      const Y = (c - y - 0.5) / c;
      const k = (y * size + x) * 4;
      if (X * X + Y * Y > 1) {
        px[k + 3] = 0;
        continue;
      }
      const Z = Math.sqrt(1 - X * X - Y * Y);
      const lat = Math.asin(Y) / RAD;
      const lon = Math.atan2(X, Z) / RAD;
      const wander = 1 + 0.2 * Math.sin(lat * 0.11 + lon * 0.09) + 0.12 * Math.sin(lat * 0.23 - lon * 0.19 + 1.7);
      let sea = 0;
      for (const m of seas) {
        const d = Math.acos(clamp(X * m.at[0] + Y * m.at[1] + Z * m.at[2], -1, 1)) * wander;
        const e = clamp((m.reach - d) / (0.6 * m.reach), 0, 1);
        sea = Math.max(sea, e * e * (3 - 2 * e));
      }
      const grain = (r() - 0.5) * 10;
      const shade = 1 - 0.3 * sea;
      px[k] = clamp(238 * shade + grain, 0, 255);
      px[k + 1] = clamp(234 * shade + grain + 2 * sea, 0, 255);
      px[k + 2] = clamp(223 * shade + grain + 9 * sea, 0, 255);
      px[k + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const at = (lat, lon) => [c + c * Math.cos(lat * RAD) * Math.sin(lon * RAD), c - c * Math.sin(lat * RAD)];
  // bright young craters — and Tycho's rays, out across the southern highlands
  CRATERS.forEach(([lat, lon, k], i) => {
    const [x, y] = at(lat, lon);
    if (!i) {
      g.strokeStyle = 'rgba(255,255,248,0.13)';
      g.lineCap = 'round';
      for (let n = 0; n < 14; n++) {
        const a = r() * TAU;
        const len = c * (0.25 + 0.45 * r());
        g.lineWidth = 0.8 + r() * 1.4;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
        g.stroke();
      }
    }
    const s = c * 0.035 * k;
    const grad = g.createRadialGradient(x, y, 0, x, y, s * 2.4);
    grad.addColorStop(0, 'rgba(255,255,252,0.95)');
    grad.addColorStop(0.4, 'rgba(255,255,250,0.5)');
    grad.addColorStop(1, 'rgba(255,255,250,0)');
    g.fillStyle = grad;
    g.fillRect(x - s * 2.4, y - s * 2.4, s * 4.8, s * 4.8);
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const QUAD_VERTEX = `varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

export class Heavens {
  constructor(world) {
    this.w = world;
    this.sky = null; //  the app's sky (js/moon.js: Moon.now) — the sun, the moon
    this.at = V(0, 0.5, -1).normalize(); // where the moon shows, from the camera (see aim)
    this.shot = null; // a falling star, while it falls: { t, from, to }
    this.group = new THREE.Group();
    this.group.name = 'heavens';
    this.group.visible = false;
    world.scene.add(this.group);
    this.makeDome();
    this.makeStars();
    this.makeMoon();
    this.makeShot();
    // ours (setOurs): the constellations; their stars { id, n, big, sprite, local, group, dir, t (since it came out) };
    // the lines between them (a set for each), their names; the view they are laid out for, and where on the screen
    // (frame: boxes); the star she tapped, and how long ago; the new ones still to come out, how soon one after another,
    // and when the next
    this.ours = { key: '', groups: [], stars: [], lines: [], labels: [], view: '', plan: '', boxes: new Map(), names: 1, starSize: 1, focus: null, focusT: 0, queue: [], pace: 0.45, nextAt: 0 };
    this.oursGroup = new THREE.Group();
    this.group.add(this.oursGroup);
  }

  // ---------------------------------------------------------------- what there is

  /** The sky itself: dark overhead, paler towards the horizon, the last light of the evening low on the side of the sun, a glow round the moon. */
  makeDome() {
    this.dome = new THREE.Mesh(
      new THREE.SphereGeometry(R, 48, 32),
      new THREE.ShaderMaterial({
        uniforms: {
          uZenith: { value: new THREE.Color(NAVY.zenith) },
          uHorizon: { value: new THREE.Color(NAVY.horizon) },
          uGround: { value: new THREE.Color('#1f2a3a') },
          uSun: { value: V(1, -0.2, 0) },
          uDusk: { value: 0 },
          uDuskColor: { value: new THREE.Color(NAVY.dusk) },
          uMoon: { value: V(0, 0.5, -1).normalize() },
          uGlow: { value: 0 },
          uGlowColor: { value: new THREE.Color(NAVY.glow) },
        },
        vertexShader: `varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
        fragmentShader: `uniform vec3 uZenith, uHorizon, uGround, uSun, uDuskColor, uMoon, uGlowColor;
uniform float uDusk, uGlow;
varying vec3 vDir;
void main() {
  vec3 d = normalize(vDir);
  float h = d.y;
  vec3 c = mix(uHorizon, uZenith, pow(clamp(h, 0.0, 1.0), 0.5));
  vec2 round = normalize(d.xz + 1e-5);
  vec2 sun = normalize(uSun.xz + 1e-5);
  c += uDuskColor * uDusk * pow(max(dot(round, sun), 0.0), 2.0) * exp(-max(h, 0.0) * 5.0);
  float m = max(dot(d, uMoon), 0.0);
  c += uGlowColor * uGlow * (pow(m, 60.0) * 0.4 + pow(m, 7.0) * 0.06);
  c = mix(c, uGround, smoothstep(0.0, -0.05, h));
  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
}`,
        side: THREE.BackSide,
        depthWrite: false,
        depthTest: false,
      })
    );
    this.dome.renderOrder = -20; // (first, under everything: the background)
    this.dome.frustumCulled = false;
    this.group.add(this.dome);
  }

  /** The stars: scattered over the sky above the horizon, a few bright ones among many faint, each twinkling in its own time. */
  makeStars() {
    const r = rng(7331);
    const pos = new Float32Array(STARS * 3);
    const size = new Float32Array(STARS);
    const phase = new Float32Array(STARS);
    const color = new Float32Array(STARS * 3);
    const c = new THREE.Color();
    for (let i = 0; i < STARS; i++) {
      const y = 0.03 + 0.97 * Math.pow(r(), 0.85); // (as many low down as high up — a little fewer, through the haze)
      const a = r() * TAU;
      const s = Math.sqrt(1 - y * y);
      pos.set([Math.cos(a) * s * R * 0.95, y * R * 0.95, Math.sin(a) * s * R * 0.95], i * 3);
      const bright = r();
      size[i] = bright > 0.985 ? 4.6 + r() * 1.6 : bright > 0.9 ? 3 + r() : 1.6 + r() * 1.2;
      phase[i] = r();
      c.set(NAVY.star[Math.floor(r() * NAVY.star.length)]);
      color.set([c.r, c.g, c.b], i * 3);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    this.stars = new THREE.Points(
      geo,
      new THREE.ShaderMaterial({
        uniforms: { uTime: { value: 0 }, uFade: { value: 0 }, uPx: { value: 1 } },
        vertexShader: `uniform float uTime, uFade, uPx;
attribute float aSize, aPhase;
attribute vec3 aColor;
varying vec3 vColor;
varying float vA;
void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  float speed = 1.1 + fract(aPhase * 7.31) * 2.4;
  vA = uFade * (0.68 + 0.32 * sin(uTime * speed + aPhase * 6.2832)) * clamp(normalize(position).y * 6.0, 0.0, 1.0);
  vColor = aColor;
  gl_PointSize = aSize * uPx;
}`,
        fragmentShader: `varying vec3 vColor;
varying float vA;
void main() {
  float k = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
  gl_FragColor = vec4(vColor, k * k * vA);
  #include <colorspace_fragment>
}`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.stars.renderOrder = -10;
    this.stars.frustumCulled = false;
    this.group.add(this.stars);
  }

  /** The moon: a disc that faces her, lit on the side the sun is — and the light round it. (Its face is painted the first time she looks up: see update.) */
  makeMoon() {
    this.face = null;
    this.moon = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uFace: { value: null }, uSun: { value: V(0, 0, 1) }, uTurn: { value: 0 }, uAlpha: { value: 1 } },
        vertexShader: QUAD_VERTEX,
        fragmentShader: `uniform sampler2D uFace;
uniform vec3 uSun;
uniform float uTurn, uAlpha;
varying vec2 vUv;
void main() {
  vec2 p = vUv * 2.0 - 1.0; // across the disc as she sees it: right, up
  float r2 = dot(p, p);
  if (r2 > 1.0) discard;
  float z = sqrt(1.0 - r2);
  float lit = smoothstep(-0.03, 0.07, dot(vec3(p, z), uSun));
  // its face, turned so that its north is where it is tonight
  float c = cos(uTurn);
  float s = sin(uTurn);
  vec2 q = vec2(c * p.x - s * p.y, s * p.x + c * p.y);
  vec3 face = texture2D(uFace, q * 0.5 + 0.5).rgb;
  vec3 col = face * (vec3(0.025, 0.03, 0.05) + lit * vec3(1.0, 0.985, 0.94)) * mix(0.8, 1.0, z);
  float edge = smoothstep(1.0, 0.965, sqrt(r2));
  gl_FragColor = vec4(col, edge * uAlpha * max(lit, 0.18));
  #include <colorspace_fragment>
}`,
        transparent: true,
        depthWrite: false,
      })
    );
    this.moon.renderOrder = -8;
    this.moon.frustumCulled = false;
    this.halo = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uGlow: { value: 0 }, uColor: { value: new THREE.Color('#dfe6ff') } },
        vertexShader: QUAD_VERTEX,
        fragmentShader: `uniform float uGlow;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float d = length(vUv * 2.0 - 1.0);
  float a = uGlow * (pow(max(0.0, 1.0 - d), 3.0) * 0.55 + pow(max(0.0, 1.0 - d), 1.3) * 0.1);
  gl_FragColor = vec4(uColor, a);
  #include <colorspace_fragment>
}`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.halo.renderOrder = -9;
    this.halo.frustumCulled = false;
    this.group.add(this.halo, this.moon);
  }

  /** A falling star: a short streak of light, bright at its head. */
  makeShot() {
    this.streak = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.ShaderMaterial({
        uniforms: { uA: { value: 0 } },
        vertexShader: QUAD_VERTEX,
        fragmentShader: `uniform float uA;
varying vec2 vUv;
void main() {
  float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
  float a = uA * pow(vUv.x, 2.2) * pow(across, 3.0);
  gl_FragColor = vec4(vec3(1.0, 0.97, 0.88), a);
  #include <colorspace_fragment>
}`,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
    );
    this.streak.renderOrder = -7;
    this.streak.frustumCulled = false;
    this.streak.visible = false;
    this.group.add(this.streak);
  }

  // ---------------------------------------------------------------- what the app says

  /** The sky as js/moon.js has it now (Moon.now). */
  set(sky) {
    this.sky = sky;
    const m = sky.moon;
    // lit on the side the sun is, as much as it is: the angle sun – moon – earth, from how much of it shows
    const cosI = clamp(2 * m.fraction - 1, -1, 1);
    const sinI = Math.sqrt(1 - cosI * cosI);
    this.moon.material.uniforms.uSun.value.set(m.limb[0] * sinI, m.limb[1] * sinI, cosI);
    this.moon.material.uniforms.uTurn.value = Math.atan2(m.north[0], m.north[1]);
  }

  /** Where the moon shows in the sky she is looking at: towards it, `alt` (radians) over the horizon. */
  aim(az, alt) {
    this.at.set(Math.sin(az) * Math.cos(alt), Math.sin(alt), -Math.cos(az) * Math.cos(alt));
  }

  /** A falling star, somewhere over the moon's side of the sky. */
  shoot() {
    const a = this.at;
    const side = Math.random() < 0.5 ? -1 : 1;
    const flat = Math.atan2(a.x, -a.z) + side * (0.25 + 0.35 * Math.random());
    const from = V(Math.sin(flat), 0, -Math.cos(flat)).multiplyScalar(Math.cos(0.62)).setY(Math.sin(0.62));
    const to = V(Math.sin(flat - side * 0.32), 0, -Math.cos(flat - side * 0.32)).multiplyScalar(Math.cos(0.38)).setY(Math.sin(0.38));
    this.shot = { t: 0, from: from.normalize(), to: to.normalize() };
  }

  // ---------------------------------------------------------------- our constellations

  /**
   * Our constellations as the app has them (js/stars.js: Stars.look): [{ id, name, emoji, at, stars: [{ id, n, big, fresh }] }]
   * — `n`: which it is of all the stars, by its day (the new ones come out in that order, the whole sky's at once).
   */
  setOurs(groups) {
    const O = this.ours;
    const key = JSON.stringify(groups.map((g) => [g.id, g.stars.map((st) => st.id + (st.big ? '*' : ''))]));
    if (key === O.key) return;
    O.key = key;
    O.groups = groups;
    const focused = O.focus && O.focus.id; // (a star she has just tapped goes on pulsing: a new one may have come with it)
    this.oursGroup.children.slice().forEach((o) => {
      this.oursGroup.remove(o);
      if (o.material) {
        if (o.material.map && o.material.map.userData.label) o.material.map.dispose();
        o.material.dispose();
      }
      if (o.geometry) o.geometry.dispose();
    });
    O.stars = [];
    O.lines = [];
    O.labels = [];
    O.focus = null;
    const tex = ourStarTexture();
    for (const g of groups) {
      // a walk across its part of the sky, a star at every step, each a good way from the others and joined to the one
      // before it — or, where the walk cannot go on, somewhere free, joined to the nearest
      const r = rng(hashText(g.id) || 1);
      const pts = [];
      const list = [];
      let x = 0.25 + r() * 0.5;
      let y = 0.25 + r() * 0.5;
      let a = r() * TAU;
      g.stars.forEach((st, i) => {
        let link = i - 1;
        if (i) {
          let found = false;
          for (let n = 0; n < 16 && !found; n++) {
            a += (r() - 0.5) * 2.2;
            const nx = x + Math.cos(a) * OUR_STEP;
            const ny = y + Math.sin(a) * OUR_STEP;
            if (nx < 0.06 || nx > 0.94 || ny < 0.06 || ny > 0.94) continue;
            if (pts.some((q) => Math.hypot(q.x - nx, q.y - ny) < OUR_GAP)) continue;
            x = nx;
            y = ny;
            found = true;
          }
          if (!found) {
            let best = null;
            for (let n = 0; n < 40; n++) {
              const nx = 0.06 + r() * 0.88;
              const ny = 0.06 + r() * 0.88;
              const d = Math.min(...pts.map((q) => Math.hypot(q.x - nx, q.y - ny)));
              if (!best || d > best.d) best = { x: nx, y: ny, d };
            }
            x = best.x;
            y = best.y;
            link = pts.reduce((j, q, k) => (Math.hypot(q.x - x, q.y - y) < Math.hypot(pts[j].x - x, pts[j].y - y) ? k : j), 0);
          }
        }
        pts.push({ x, y, link });
        const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: st.big ? '#fff1c4' : '#fff8e6', transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
        sprite.renderOrder = -6;
        sprite.frustumCulled = false;
        this.oursGroup.add(sprite);
        list.push({ id: st.id, n: st.n, big: st.big, sprite, local: pts[i], group: g, dir: V(0, 1, 0), t: st.fresh ? -1 : 9, phase: r() * TAU, scale: 1 });
      });
      O.stars.push(...list);
      // the lines, each from a star to the one it is joined to: drawn as it comes out (updateOurs)
      const pairs = list.filter((st) => st.local.link >= 0).map((st) => [st, list[st.local.link]]);
      const lines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#ffe7a8', transparent: true, opacity: 0, depthWrite: false }));
      lines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(Math.max(1, pairs.length) * 6), 3));
      lines.geometry.setDrawRange(0, pairs.length * 2);
      lines.renderOrder = -7;
      lines.frustumCulled = false;
      this.oursGroup.add(lines);
      O.lines.push({ mesh: lines, group: g, pairs });
    }
    this.nameOurs();
    // the new ones come out in the order of their days, however many there are the whole sky within a few seconds
    O.queue = O.stars.filter((st) => st.t < 0).sort((p, q) => p.n - q.n);
    O.pace = clamp(6 / O.queue.length, 0.16, 0.45);
    if (focused) O.focus = O.stars.find((st) => st.id === focused) || null;
    // (laid out already — she may be looking up: each stays in its place, a new star in it; only a constellation that
    // is new itself needs them all laid out again)
    const boxes = new Map();
    for (const [g, b] of O.boxes) {
      const now = groups.find((x) => x.id === g.id);
      if (now) boxes.set(now, b);
    }
    O.boxes = boxes;
    O.view = '';
    if (boxes.size !== groups.length) O.plan = '';
  }

  /** Each constellation's name, over it — in the hand the app writes in; should that not have come yet, again once it has. */
  nameOurs() {
    const O = this.ours;
    for (const l of O.labels) {
      this.oursGroup.remove(l.sprite);
      l.sprite.material.map.dispose();
      l.sprite.material.dispose();
    }
    O.labels = O.groups.map((g) => {
      const name = labelTexture(g.name, g.emoji);
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: name, transparent: true, depthWrite: false, opacity: 0 }));
      sprite.renderOrder = -6;
      sprite.frustumCulled = false;
      this.oursGroup.add(sprite);
      return { sprite, group: g, first: O.stars.find((st) => st.group === g), aspect: name.userData.aspect, dir: V(0, 1, 0) };
    });
    const names = O.groups.map((g) => g.name).join('');
    if (names && document.fonts && !document.fonts.check(LABEL_FONT, names)) {
      const groups = O.groups;
      document.fonts.load(LABEL_FONT, names).then(() => {
        if (O.groups !== groups || !document.fonts.check(LABEL_FONT, names)) return;
        this.nameOurs();
        O.view = O.plan = ''; // (as wide as they are now)
      }, () => {});
    }
  }

  /**
   * Where ours go in the sky she will see once she has looked up — `view`: { cam (the camera as it will be then), w, h
   * (px), card: { right, bottom } (px: the card over the sky), session (one each time she looks up), mask(cols, rows)
   * (what stands in the way of the sky: world.skyMask) }. Each constellation has a box of open sky near its place (lay)
   * — worked out once each time she looks up, so that nothing moves while she looks; there on the screen they stay,
   * as the moon goes on.
   */
  frame(view) {
    const O = this.ours;
    if (!O.stars.length) return;
    const cam = view.cam;
    const plan = `${view.session}:${view.w}x${view.h}`;
    const key = `${plan}:${cam.quaternion.toArray().map((x) => x.toFixed(4))}:${cam.fov.toFixed(2)}`;
    if (key === O.view) return;
    O.view = key;
    _cam.fov = cam.fov;
    _cam.aspect = cam.aspect;
    _cam.position.set(0, 0, 0);
    _cam.quaternion.copy(cam.quaternion);
    _cam.updateMatrixWorld(true);
    _cam.updateProjectionMatrix();
    if (plan !== O.plan) {
      O.plan = plan;
      this.lay(view);
    }
    // (from where on the screen to which way that is)
    const toDir = (out, x, y) => out.set((x / view.w) * 2 - 1, 1 - (y / view.h) * 2, 0.5).unproject(_cam).normalize();
    for (const st of O.stars) {
      const b = O.boxes.get(st.group);
      if (b) toDir(st.dir, b.x + st.local.x * b.size, b.y + (1 - st.local.y) * b.size);
    }
    for (const l of O.labels) {
      const b = O.boxes.get(l.group);
      if (b) toDir(l.dir, b.nameX, b.nameY);
    }
  }

  /**
   * …the boxes (px), on a grid over the screen. In the way: the trees and the hills (view.mask), the card, the moon,
   * the edges, along the bottom (the family, her wishes, the day a star tells) — and a little room round them, where
   * a box goes only if there is nowhere else. Each constellation, the largest first, has the free box of its size
   * nearest to where it would like to be (to the side of the moon, level with it or below), its name over it; where
   * they will not all go, all of them a little smaller — and at the smallest each where least is in the way.
   */
  lay(view) {
    const O = this.ours;
    const { w, h } = view;
    const unit = h / 2 / Math.tan((_cam.fov / 2) * RAD); //   (px for a tangent of one, in the middle of the screen)
    const star = 2 * unit * Math.tan((OUR_DEG / 2) * RAD); // (how wide one of ours is, px)
    const cols = Math.max(8, Math.round(w / Math.max(8, Math.min(w, h) / 40)));
    const rows = Math.max(8, Math.round(h / Math.max(8, Math.min(w, h) / 40)));
    const cw = w / cols;
    const ch = h / rows;
    const busy = view.mask(cols, rows);
    const hard = Uint8Array.from(busy);
    const soft = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        if (!busy[y * cols + x]) continue;
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (x + dx >= 0 && x + dx < cols && y + dy >= 0 && y + dy < rows) soft[(y + dy) * cols + x + dx] = 1;
      }
    }
    const block = (grid, x0, y0, x1, y1) => {
      for (let y = Math.max(0, Math.floor(y0 / ch)); y < Math.min(rows, Math.ceil(y1 / ch)); y++) for (let x = Math.max(0, Math.floor(x0 / cw)); x < Math.min(cols, Math.ceil(x1 / cw)); x++) grid[y * cols + x] = 1;
    };
    block(hard, 0, 0, w, 6);
    block(hard, 0, 0, 6, h);
    block(hard, w - 6, 0, w, h);
    block(hard, 0, h - Math.max(200, h * 0.24), w, h);
    block(hard, 0, 0, view.card.right + 4, view.card.bottom + 4);
    block(soft, 0, 0, view.card.right + 1.5 * cw, view.card.bottom + 1.2 * ch); // (it may grow a little)
    const m = this.sky && this.sky.moon;
    _p.copy(this.at).project(_cam);
    const mx = ((_p.x + 1) / 2) * w;
    const my = ((1 - _p.y) / 2) * h;
    if (m && m.up && m.id !== 'new') {
      const disc = unit * Math.tan((MOON_DEG / 2) * RAD);
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
          const d = Math.hypot((x + 0.5) * cw - mx, (y + 0.5) * ch - my);
          if (d < disc * 1.08) hard[y * cols + x] = 1;
          else if (d < disc * 1.3 + cw / 2) soft[y * cols + x] = 1;
        }
      }
    }
    // (how much is in the way in any box at once, hard and soft: tables of sums, made again as each box is taken)
    const sums = [new Int32Array((cols + 1) * (rows + 1)), new Int32Array((cols + 1) * (rows + 1))];
    const grids = [hard, soft];
    const total = () => {
      for (let i = 0; i < 2; i++) {
        const sum = sums[i];
        const grid = grids[i];
        for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) sum[(y + 1) * (cols + 1) + x + 1] = grid[y * cols + x] + sum[y * (cols + 1) + x + 1] + sum[(y + 1) * (cols + 1) + x] - sum[y * (cols + 1) + x];
      }
    };
    const inWay = (i, x, y, nx, ny) => {
      const sum = sums[i];
      return sum[(y + ny) * (cols + 1) + x + nx] - sum[y * (cols + 1) + x + nx] - sum[(y + ny) * (cols + 1) + x] + sum[y * (cols + 1) + x];
    };
    // (off the middle of the screen a thing in the sky is drawn bigger — by so much, at a point px of the screen)
    const tanX = Math.tan((_cam.fov / 2) * RAD) * _cam.aspect;
    const tanY = Math.tan((_cam.fov / 2) * RAD);
    const grow = (X, Y) => Math.sqrt(1 + (((X / w) * 2 - 1) * tanX) ** 2 + ((1 - (Y / h) * 2) * tanY) ** 2);
    const freeHard = hard.slice();
    const order = O.groups.slice().sort((a, b) => b.stars.length - a.stars.length);
    for (let scale = 1, last = false; ; scale *= 0.88) {
      last = scale < 0.55;
      hard.set(freeHard);
      total();
      O.boxes = new Map();
      O.names = Math.max(0.9, Math.min(1, scale * 1.15)); //   (the names a little smaller with them, not much —
      O.starSize = Math.max(0.75, Math.min(1, 0.4 + scale * 0.7)); // and the stars, so that a small one keeps its shape)
      for (const g of order) {
        const label = O.labels.find((l) => l.group === g);
        const nameH = star * LABEL_H * O.names;
        const nameW = nameH * label.aspect;
        const [side, below] = OUR_PLACES[g.at];
        const ax = w * (side < 0 ? 0.2 : 0.8);
        const ay = my + (below ? 0.3 : 0.08) * h;
        const size = star * (2.2 + 1.35 * Math.sqrt(g.stars.length)) * scale;
        let best = null;
        for (let y = 0; y < rows; y++) {
          for (let x = 0; x < cols; x++) {
            // its name over it, and the stars, half a star more all round
            const k = grow(x * cw + size / 2, y * ch + size / 2);
            const bw = Math.max(size + star * k, nameW * k);
            const bh = (nameH + 0.4 * star) * k + size + 0.5 * star * k;
            const nx = Math.ceil(bw / cw);
            const ny = Math.ceil(bh / ch);
            if (x + nx > cols || y + ny > rows) continue;
            const hits = inWay(0, x, y, nx, ny);
            const near = inWay(1, x, y, nx, ny);
            if (!last && (hits || near)) continue;
            const d = hits * 1e5 + near * 60 + Math.hypot(x * cw + bw / 2 - ax, y * ch + bh / 2 - ay);
            if (!best || d < best.d) best = { x, y, nx, ny, d, k, bh };
          }
        }
        if (!best) break;
        const mid = (best.x + best.nx / 2) * cw;
        const top = best.y * ch + (best.ny * ch - best.bh) / 2;
        O.boxes.set(g, { x: mid - size / 2, y: top + (nameH + 0.4 * star) * best.k, size, nameX: mid, nameY: top + (nameH * best.k) / 2 });
        for (let y = best.y; y < best.y + best.ny; y++) for (let x = best.x; x < best.x + best.nx; x++) hard[y * cols + x] = 1;
        total();
      }
      if (O.boxes.size === order.length || last) break;
    }
  }

  /** The star of ours nearest to where she tapped (px, on `rect`), if one is close enough: its id. */
  starAt(x, y, camera, rect) {
    let best = null;
    let near = 30;
    for (const st of this.ours.stars) {
      if (st.t < 0.3) continue;
      _p.copy(st.sprite.position).project(camera);
      if (_p.z > 1) continue;
      const d = Math.hypot(rect.left + ((_p.x + 1) / 2) * rect.width - x, rect.top + ((1 - _p.y) / 2) * rect.height - y);
      if (d < near) {
        near = d;
        best = st;
      }
    }
    return best ? best.id : null;
  }

  /** The star she tapped: it pulses, and its constellation's lines brighten for a while. */
  focus(id) {
    this.ours.focus = this.ours.stars.find((st) => st.id === id) || null;
    this.ours.focusT = 0;
  }

  /**
   * Ours, every frame: they twinkle; the new ones come out one after another once she is looking up, each drawing its
   * line from the star before it, and a constellation's name with its first; the one she tapped pulses. (With less
   * motion asked for, they only fade in, and the one she tapped is bigger for a while.)
   */
  updateOurs(dt, t, k, gloom) {
    const O = this.ours;
    if (!O.stars.length) return;
    const calm = this.w.state.reduce;
    O.focusT += dt;
    let came = null;
    if (O.queue.length && k >= 0.97 && t >= O.nextAt) {
      came = O.queue.shift();
      came.t = 0;
      O.nextAt = t + O.pace;
    }
    if (k < 0.5) O.nextAt = 0; // (looking down: the next is there as soon as she looks up again)
    const fade = k * (1 - 0.85 * gloom);
    for (const st of O.stars) {
      if (st.t < 0) continue;
      st.t += dt;
      const born = clamp(st.t / 0.8, 0, 1);
      const pop = born < 1 && !calm ? 1 + 0.9 * Math.sin(Math.PI * born) : 1;
      const focus = O.focus === st && O.focusT < 4 ? (calm ? 1.3 : 1 + 0.5 * Math.abs(Math.sin(O.focusT * 5)) * (1 - O.focusT / 4)) : 1;
      const tw = 0.78 + 0.22 * Math.sin(t * (1.4 + (st.phase % 1)) + st.phase);
      st.sprite.material.opacity = fade * born * tw;
      st.scale = (st.big ? 1.5 : 1) * pop * focus;
    }
    if (came && this.w.host.onStarsSeen) this.w.host.onStarsSeen([came.id]);
    const lit = O.focus && O.focusT < 4 ? 0.35 * (1 - O.focusT / 4) : 0;
    for (const l of O.lines) {
      const pos = l.mesh.geometry.attributes.position;
      l.pairs.forEach(([st, to], i) => {
        const grow = st.t < 0 ? 0 : calm ? 1 : clamp(st.t / 0.8, 0, 1);
        _p.copy(to.dir).lerp(st.dir, grow * (2 - grow)).multiplyScalar(OUR_R);
        pos.setXYZ(i * 2, to.dir.x * OUR_R, to.dir.y * OUR_R, to.dir.z * OUR_R);
        pos.setXYZ(i * 2 + 1, _p.x, _p.y, _p.z);
      });
      pos.needsUpdate = true;
      l.mesh.material.opacity = fade * (0.3 + (O.focus && O.focus.group === l.group ? lit : 0));
    }
    for (const l of O.labels) l.sprite.material.opacity = fade * 0.75 * clamp(l.first.t / 0.8, 0, 1);
  }

  // ---------------------------------------------------------------- every frame

  /** `k`: how far she has looked up (0 … 1) — the sky is only drawn while she does. */
  update(dt, t, k) {
    const on = k > 0.003 && !!this.sky;
    this.group.visible = on;
    if (!on) return;
    if (!this.face) this.face = this.moon.material.uniforms.uFace.value = paintFace();
    const w = this.w;
    const sky = this.sky;
    const m = sky.moon;
    const gloom = clamp(w.sky.gloom * 1.15, 0, 1); // (cloud over it)
    const shine = m.up ? m.fraction : 0;
    const u = this.dome.material.uniforms;
    // the evening glow: until the sun is well down (astronomical twilight, 18° under)
    u.uDusk.value = clamp((sky.sun + 18) / 14, 0, 1) * (1 - 0.7 * gloom);
    u.uSun.value.set(Math.sin(sky.sunAz), 0, -Math.cos(sky.sunAz));
    u.uGlow.value = shine * shine * (1 - 0.6 * gloom);
    u.uMoon.value.copy(this.at);
    u.uZenith.value.set(NAVY.zenith).lerp(_c.set('#2a3148'), 0.75 * gloom).lerp(_c.set('#121a40'), 0.35 * shine);
    u.uHorizon.value.set(NAVY.horizon).lerp(_c.set('#3c4258'), 0.75 * gloom).lerp(_c.set('#35457e'), 0.3 * shine);
    u.uGround.value.copy(w.scene.background).multiplyScalar(0.7);
    // fewer stars under a bright moon, none through cloud
    const st = this.stars.material.uniforms;
    st.uTime.value = t;
    st.uFade.value = k * (1 - 0.35 * shine) * (1 - gloom);
    st.uPx.value = w.renderer.getPixelRatio();
    this.moon.visible = this.halo.visible = m.up && m.id !== 'new';
    this.moon.material.uniforms.uAlpha.value = k * (1 - 0.82 * gloom);
    this.halo.material.uniforms.uGlow.value = k * (0.35 + 0.65 * shine) * (1 - 0.7 * gloom);
    this.updateOurs(dt, t, k, gloom);
    // the falling star
    const s = this.shot;
    this.streak.visible = !!s;
    if (s) {
      s.t += dt;
      const p = Math.min(1, s.t / 1.1);
      this.streak.material.uniforms.uA.value = 1.5 * k * Math.sin(Math.PI * p) * (1 - 0.8 * gloom);
      s.head = (s.head || V()).copy(s.from).lerp(s.to, p).normalize();
      if (s.t > 1.1) this.shot = null;
    }
  }

  /** Round the camera, wherever it is now (after it has been placed for the frame). */
  place(camera) {
    if (!this.group.visible) return;
    const at = camera.position;
    this.dome.position.copy(at);
    this.stars.position.copy(at);
    const d = R * 0.9;
    const size = 2 * d * Math.tan((MOON_DEG / 2) * RAD);
    this.moon.position.copy(this.at).multiplyScalar(d).add(at);
    this.moon.scale.setScalar(size);
    this.moon.lookAt(at);
    this.halo.position.copy(this.at).multiplyScalar(d * 1.01).add(at);
    this.halo.scale.setScalar(size * 4.6);
    this.halo.lookAt(at);
    // ours, on the sky
    const O = this.ours;
    const unit = 2 * OUR_R * Math.tan((OUR_DEG / 2) * RAD);
    for (const st of O.stars) {
      st.sprite.position.copy(st.dir).multiplyScalar(OUR_R).add(at);
      st.sprite.scale.setScalar(unit * st.scale * O.starSize);
    }
    for (const l of O.labels) {
      l.sprite.position.copy(l.dir).multiplyScalar(OUR_R).add(at);
      l.sprite.scale.set(unit * LABEL_H * O.names * l.aspect, unit * LABEL_H * O.names, 1);
    }
    for (const l of O.lines) l.mesh.position.copy(at);
    const s = this.shot;
    if (s && s.head) {
      // the streak lies along its way, its head where the star is now
      const way = _w.copy(s.to).sub(s.from).normalize();
      const len = d * 0.26;
      this.streak.position.copy(s.head).multiplyScalar(d).addScaledVector(way, -len / 2).add(at);
      this.streak.scale.set(len, d * 0.01, 1);
      this.streak.lookAt(at);
      // (turned in its own plane so that it runs the way the star goes)
      const right = _r.set(1, 0, 0).applyQuaternion(this.streak.quaternion);
      const up = _u.set(0, 1, 0).applyQuaternion(this.streak.quaternion);
      this.streak.rotateZ(Math.atan2(way.dot(up), way.dot(right)));
    }
  }
}

let starTex = null;
/** One of ours: a warm point of light with four soft rays. */
function ourStarTexture() {
  if (starTex) return starTex;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const glow = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  glow.addColorStop(0, 'rgba(255,255,255,1)');
  glow.addColorStop(0.12, 'rgba(255,246,214,0.95)');
  glow.addColorStop(0.35, 'rgba(255,226,150,0.28)');
  glow.addColorStop(1, 'rgba(255,220,140,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, 128, 128);
  for (const [w, h] of [[4, 120], [120, 4]]) {
    const ray = g.createRadialGradient(64, 64, 0, 64, 64, 60);
    ray.addColorStop(0, 'rgba(255,250,232,0.9)');
    ray.addColorStop(1, 'rgba(255,250,232,0)');
    g.fillStyle = ray;
    g.fillRect(64 - w / 2, 64 - h / 2, w, h);
  }
  starTex = new THREE.CanvasTexture(c);
  starTex.colorSpace = THREE.SRGBColorSpace;
  return starTex;
}

/**
 * A constellation's name, written soft — its emoji small before it, the letters a little closer together than the hand
 * has them (there is not much room in the sky) — on a canvas as wide as it is (`userData.aspect`: how much wider than high).
 */
function labelTexture(name, emoji) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  const icon = `${Math.round(LABEL_PX * 0.72)}px sans-serif`;
  g.font = icon;
  const iconW = emoji ? g.measureText(emoji).width + 10 : 0;
  g.font = LABEL_FONT;
  const chars = [...name];
  const step = chars.map((ch) => g.measureText(ch).width * (ch === ' ' ? 0.6 : 0.82));
  c.width = Math.ceil(iconW + step.reduce((a, b) => a + b, 0) + 40);
  c.height = 128;
  // (a canvas that changes size forgets how it was to write)
  g.textBaseline = 'middle';
  g.shadowColor = 'rgba(20, 16, 60, 0.9)';
  g.shadowBlur = 14;
  g.fillStyle = '#fff3d6';
  if (emoji) {
    g.font = icon;
    g.fillText(emoji, 20, 64);
  }
  g.font = LABEL_FONT;
  let x = 20 + iconW;
  chars.forEach((ch, i) => {
    g.fillText(ch, x + (step[i] - g.measureText(ch).width) / 2, 66);
    x += step[i];
  });
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.userData.label = true;
  tex.userData.aspect = c.width / c.height;
  return tex;
}

/** A number for a word, the same every time. */
function hashText(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}
