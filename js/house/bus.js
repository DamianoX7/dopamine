// The village bus — 506번, between 우리 동네 and 여우 마을, the foxes' village. A little Seoul 마을버스 as a toy: mint
// with a cream stripe, dark windows all along (lit warm from inside at night), a white roof with its air conditioner,
// the orange LED signs that say where it is going, and the bus mirrors that reach out over its nose like a bug's
// feelers. Its door is at the front on its right, the kerb side: two glass leaves that fold out. Its wheels turn as it
// goes; standing, it shudders with its engine; braking, its nose dips.
//
// In the bus's own frame it faces +x, its right (the door) is +z, and y = 0 is the road under it. The town drives it
// (town.js): where it is, how fast, the door, the light — and it fades in and out where it comes onto the board, and
// leaves it.
import * as THREE from '../vendor/three.module.min.js';
import { Batch, roundBox, tube } from './shapes.js';
import { canvasTex, glowSprite } from './townshops.js';
import { disposeTree } from '../fox/kit.js';

export const BUS = {
  L: 3.7, //       long
  W: 1.12, //      wide
  H: 1.66, //      high (to its roof)
  low: 0.17, //    its floor above the road
  wheel: 0.2, //   the wheels' radius
  door: { x0: 3.7 / 2 - 0.66, x1: 3.7 / 2 - 0.2 }, // the door, along its side
  route: '506',
};
const MINT = '#3cbf9a';
const MINT_DARK = '#2a9c7c';
const CREAM = '#fff1b8';
const ROOF = '#f4fbf8';
const LED = '#ffab2e';

/* The LED sign: black, the route and where it goes in orange dots of light. */
function drawSign(g, W, H, text) {
  g.fillStyle = '#16131a';
  g.fillRect(0, 0, W, H);
  g.textBaseline = 'middle';
  g.shadowColor = LED;
  g.shadowBlur = 10;
  g.fillStyle = LED;
  g.font = `700 ${Math.round(H * 0.62)}px Jua, sans-serif`;
  g.textAlign = 'left';
  g.fillText(BUS.route, H * 0.25, H * 0.54);
  const left = g.measureText(BUS.route).width + H * 0.6;
  g.textAlign = 'center';
  g.fillText(text, left + (W - left) / 2, H * 0.54);
  // (the grid of the dots it is made of)
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(0, 0, 0, 0.35)';
  for (let x = 0; x < W; x += 4) g.fillRect(x, 0, 1, H);
  for (let y = 0; y < H; y += 4) g.fillRect(0, y, W, 1);
}

export class Bus {
  constructor() {
    const { L, W, H, low } = BUS;
    const g = (this.group = new THREE.Group());
    g.visible = false;
    // what fades as it comes onto the board (and is lit at night): its own materials, none shared
    const paint = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42 });
    const glass = new THREE.MeshStandardMaterial({ color: '#2c3c4c', roughness: 0.12, metalness: 0.35, emissive: '#ffd59a', emissiveIntensity: 0 });
    const rubber = new THREE.MeshStandardMaterial({ color: '#2a282e', roughness: 0.85 });
    const chrome = new THREE.MeshStandardMaterial({ color: '#dfe2ea', roughness: 0.25, metalness: 0.8 });
    const lamp = new THREE.MeshStandardMaterial({ color: '#fff6d8', emissive: '#fff1c2', emissiveIntensity: 0.15, roughness: 0.3 });
    const tail = new THREE.MeshStandardMaterial({ color: '#ff4b5c', emissive: '#ff2a3a', emissiveIntensity: 0.2, roughness: 0.4 });
    const inside = new THREE.MeshStandardMaterial({ color: '#4a4152', roughness: 0.9, emissive: '#ffcf8a', emissiveIntensity: 0 });
    this.mats = [paint, glass, rubber, chrome, lamp, tail, inside];
    this.glass = glass;
    this.lamp = lamp;
    this.tail = tail;
    this.inside = inside;

    // the body: what shakes and dips (the wheels stay on the road)
    const body = (this.body = new THREE.Group());
    g.add(body);
    const B = new Batch();
    // mint below, a cream stripe, white round the windows and over the roof
    const shade = (p) => new THREE.Color(p.y < 0.5 ? MINT : p.y < 0.6 ? CREAM : p.y < 0.78 ? MINT : p.y < 1.42 ? '#eef8f4' : ROOF);
    B.add(roundBox(L, H - low, W, 0.15), { at: [0, low + (H - low) / 2, 0], color: shade });
    // the bumpers, front and back
    B.add(roundBox(0.1, 0.16, W + 0.03, 0.04), { at: [L / 2 + 0.01, 0.27, 0], color: '#5b5866' });
    B.add(roundBox(0.1, 0.16, W + 0.03, 0.04), { at: [-L / 2 - 0.01, 0.27, 0], color: '#5b5866' });
    // the air conditioner on the roof, and the step under the door
    B.add(roundBox(1.2, 0.13, 0.74, 0.05), { at: [-0.35, H + 0.05, 0], color: '#dfe7e4' });
    B.add(roundBox(0.5, 0.06, 0.2, 0.02), { at: [(BUS.door.x0 + BUS.door.x1) / 2, 0.19, W / 2 - 0.02], color: '#bfc3cc' });
    // dark round the wheels
    for (const x of [L / 2 - 0.68, -L / 2 + 0.7]) for (const s of [-1, 1]) B.add(new THREE.CylinderGeometry(0.255, 0.255, 0.02, 20, 1, false, 0, Math.PI), { at: [x, 0.2, s * (W / 2 + 0.004)], rot: [Math.PI / 2, Math.PI / 2, 0], color: '#3b3842' });
    // the mirrors that reach out over its nose
    for (const s of [-1, 1]) {
      tube(B, [[L / 2 - 0.04, 1.5, s * (W / 2 - 0.1)], [L / 2 + 0.16, 1.62, s * (W / 2 + 0.02)], [L / 2 + 0.3, 1.5, s * (W / 2 + 0.08)], [L / 2 + 0.33, 1.3, s * (W / 2 + 0.06)]], 0.014, '#3b3842', 16);
      B.add(roundBox(0.05, 0.16, 0.1, 0.02), { at: [L / 2 + 0.33, 1.22, s * (W / 2 + 0.06)], color: '#2a282e' });
    }
    body.add(B.mesh(paint));

    // the windows: all along both sides (on the door side, back of the door), the windscreen, the back window
    const G = new Batch();
    const winY = 1.1;
    const winH = 0.56;
    const side = (z, x0, x1) => G.add(new THREE.BoxGeometry(x1 - x0, winH, 0.012), { at: [(x0 + x1) / 2, winY, z] });
    side(W / 2 + 0.003, -L / 2 + 0.22, BUS.door.x0 - 0.08);
    side(-W / 2 - 0.003, -L / 2 + 0.22, L / 2 - 0.3);
    G.add(new THREE.BoxGeometry(0.012, 0.78, W - 0.18), { at: [L / 2 + 0.004, 1.02, 0] });
    G.add(new THREE.BoxGeometry(0.012, 0.42, W - 0.3), { at: [-L / 2 - 0.004, 1.12, 0] });
    body.add(G.mesh(glass));
    // the pillars between the windows
    const P = new Batch();
    for (let x = -L / 2 + 0.75; x < BUS.door.x0 - 0.2; x += 0.6) P.add(new THREE.BoxGeometry(0.05, winH + 0.02, 0.02), { at: [x, winY, W / 2 + 0.008], color: '#eef8f4' });
    for (let x = -L / 2 + 0.75; x < L / 2 - 0.4; x += 0.6) P.add(new THREE.BoxGeometry(0.05, winH + 0.02, 0.02), { at: [x, winY, -W / 2 - 0.008], color: '#eef8f4' });
    body.add(P.mesh(paint));

    // the doorway (dark — lit at night), and its two glass leaves on hinges at either side
    const dx0 = BUS.door.x0;
    const dx1 = BUS.door.x1;
    const dw = dx1 - dx0;
    const doorway = new THREE.Mesh(new THREE.BoxGeometry(dw, 1.16, 0.01), inside);
    doorway.position.set((dx0 + dx1) / 2, 0.22 + 0.58, W / 2 + 0.002);
    body.add(doorway);
    this.leaves = [];
    for (const [hinge, dir] of [[dx1, -1], [dx0, 1]]) {
      const pivot = new THREE.Group();
      pivot.position.set(hinge, 0.22, W / 2 + 0.012);
      const leaf = new Batch();
      const lw = dw / 2 - 0.006;
      // a mint frame round a pane of glass
      leaf.add(new THREE.BoxGeometry(lw, 0.05, 0.02), { at: [(dir * lw) / 2, 0.025, 0], color: MINT_DARK });
      leaf.add(new THREE.BoxGeometry(lw, 0.05, 0.02), { at: [(dir * lw) / 2, 1.135, 0], color: MINT_DARK });
      leaf.add(new THREE.BoxGeometry(0.035, 1.16, 0.02), { at: [dir * 0.0175, 0.58, 0], color: MINT_DARK });
      leaf.add(new THREE.BoxGeometry(0.035, 1.16, 0.02), { at: [dir * (lw - 0.0175), 0.58, 0], color: MINT_DARK });
      leaf.add(new THREE.BoxGeometry(lw, 0.035, 0.02), { at: [(dir * lw) / 2, 0.5, 0], color: MINT_DARK });
      pivot.add(leaf.mesh(paint));
      const pane = new THREE.Mesh(new THREE.BoxGeometry(lw - 0.06, 1.06, 0.008), glass);
      pane.position.set((dir * lw) / 2, 0.58, 0);
      pivot.add(pane);
      body.add(pivot);
      this.leaves.push({ pivot, dir });
    }

    // the lights: two at the front, red at the back — and at night a glow before each headlight
    const lights = new Batch();
    for (const s of [-1, 1]) lights.add(roundBox(0.04, 0.1, 0.2, 0.02), { at: [L / 2 + 0.03, 0.46, s * (W / 2 - 0.2)] });
    body.add(lights.mesh(lamp));
    const tails = new Batch();
    for (const s of [-1, 1]) tails.add(roundBox(0.04, 0.16, 0.08, 0.02), { at: [-L / 2 - 0.03, 0.5, s * (W / 2 - 0.12)] });
    body.add(tails.mesh(tail));
    this.glows = [-1, 1].map((s) => {
      const glow = glowSprite('#ffe9b0', 0.9);
      glow.position.set(L / 2 + 0.2, 0.46, s * (W / 2 - 0.2));
      body.add(glow);
      return glow;
    });

    // the LED signs: over the windscreen, and on its side over the door
    this.signs = [];
    const sign = (w, h, at, rotY) => {
      const tex = canvasTex(320, 56, (c, cw, ch) => drawSign(c, cw, ch, '여우마을'));
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }));
      mesh.position.set(...at);
      mesh.rotation.y = rotY;
      body.add(mesh);
      this.mats.push(mesh.material);
      this.signs.push(tex);
    };
    sign(W - 0.24, 0.15, [L / 2 + 0.012, 1.5, 0], Math.PI / 2);
    sign(0.92, 0.15, [BUS.door.x0 - 0.62, 1.5, W / 2 + 0.008], 0);
    // the number and a fox, painted on its side
    const decal = canvasTex(256, 96, (c, cw, ch) => {
      c.clearRect(0, 0, cw, ch);
      c.textBaseline = 'middle';
      c.font = `700 ${Math.round(ch * 0.62)}px Fredoka, Jua, sans-serif`;
      c.fillStyle = '#ffffff';
      c.fillText(BUS.route, 8, ch * 0.54);
      c.font = `${Math.round(ch * 0.6)}px sans-serif`;
      c.fillText('🦊', cw - ch * 0.82, ch * 0.54);
    });
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.27), new THREE.MeshStandardMaterial({ map: decal, alphaTest: 0.4, roughness: 0.5 }));
    plate.position.set(-0.28, 0.34, W / 2 + 0.006);
    body.add(plate);
    this.mats.push(plate.material);
    this.decal = plate.material;

    // the wheels (they turn as it goes)
    this.wheels = [];
    for (const x of [L / 2 - 0.68, -L / 2 + 0.7]) {
      for (const s of [-1, 1]) {
        const w = new THREE.Group();
        w.position.set(x, BUS.wheel, s * (W / 2 - 0.02));
        const tyre = new THREE.Mesh(new THREE.CylinderGeometry(BUS.wheel, BUS.wheel, 0.14, 20), rubber);
        tyre.rotation.x = Math.PI / 2;
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.02, 12), chrome);
        hub.rotation.x = Math.PI / 2;
        hub.position.z = s * 0.07;
        // (a spoke, to see it turn)
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.022), rubber);
        spoke.position.z = s * 0.075;
        w.add(tyre, hub, spoke);
        g.add(w);
        this.wheels.push(w);
      }
    }
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.material !== glass && !(o.material && o.material.isMeshBasicMaterial);
      o.receiveShadow = true;
      o.userData.tap = 'bus';
    });
    this.mats.forEach((m) => (m.userData.opacity0 = m.transparent ? m.opacity : 1));
    this.door = 0;
    this.fade = 1;
    this.turned = 0;
    this.shake = 0;
  }

  /** Where it says it is going ('여우마을', '우리동네'). */
  setSign(text) {
    if (text === this.signText) return;
    this.signText = text;
    for (const tex of this.signs) {
      drawSign(tex.image.getContext('2d'), tex.image.width, tex.image.height, text);
      tex.needsUpdate = true;
    }
  }

  /** The door: 0 shut … 1 open (the leaves fold out). */
  setDoor(k) {
    this.door = k;
    for (const l of this.leaves) l.pivot.rotation.y = l.dir * -1.25 * k;
  }

  /** Its lights: 0 by day … 1 at night (the headlights, the tail lights, the windows lit from inside). */
  setNight(k) {
    this.lamp.emissiveIntensity = 0.15 + 2.2 * k;
    this.tail.emissiveIntensity = 0.2 + 1.4 * k;
    this.glass.emissiveIntensity = 0.55 * k;
    this.inside.emissiveIntensity = 0.5 * k;
    this.glows.forEach((s) => (s.material.opacity = 0.55 * k * this.fade));
    this.night = k;
  }

  /** How much of it shows (it fades in where it drives onto the board, and out where it leaves it). */
  setFade(k) {
    if (Math.abs(k - this.fade) < 0.002) return;
    this.fade = k;
    const solid = k > 0.995;
    for (const m of this.mats) {
      const see = !solid || m.userData.opacity0 < 1;
      if (m.transparent !== see) {
        m.transparent = see;
        m.needsUpdate = true;
      }
      m.opacity = m.userData.opacity0 * k;
      m.depthWrite = solid;
    }
    this.glows.forEach((s) => (s.material.opacity = 0.55 * (this.night || 0) * k));
  }

  /** Every frame: it has gone `dist` on (its wheels turn); `accel` (how hard it speeds up or brakes: its nose dips) and
   *  whether its engine runs (it shudders, standing). */
  update(dt, time, dist, accel, idle) {
    this.turned += dist;
    for (const w of this.wheels) w.rotation.z = -this.turned / BUS.wheel;
    this.shake += ((idle ? 1 : 0.25) - this.shake) * Math.min(1, dt * 4);
    this.body.position.y = Math.sin(time * 31) * 0.004 * this.shake + 0.003;
    const tilt = Math.max(-0.03, Math.min(0.03, accel * 0.008)); // (braking, its nose goes down)
    this.body.rotation.z += (tilt - this.body.rotation.z) * Math.min(1, dt * 6);
  }

  dispose() {
    disposeTree(this.group);
  }
}
