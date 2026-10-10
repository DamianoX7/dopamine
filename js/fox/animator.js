// Moves one fox. Nothing here is a recorded animation: the spine follows blended poses, the
// feet are planted on the ground and stepped by a gait clock (or tucked where a pose wants
// them), the legs are solved backwards from the feet (IK), and the tail, ears, eyes and breath
// are layered on top. brain.js decides what to do; this file makes it look alive.
import * as THREE from '../vendor/three.module.min.js';
import { TAIL_SEGS } from './rig.js';

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => t * t * (3 - 2 * t);
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
export const wrapAngle = (a) => {
  a = (a + Math.PI) % (Math.PI * 2);
  return a < 0 ? a + Math.PI : a - Math.PI;
};

// ------------------------------------------------------------------ poses
//
// A pose is a flat set of numbers, so two poses blend by plain interpolation.
//   hx, hy, hz        hips offset (model units)                hrx/hry/hrz  hips rotation
//   srx, sry          spine                                    crx, cry     chest
//   nrx, nry, nrz     neck                                     hdx/hdy/hdz  head
//   tl, tc, ts        tail: lift at the base, curl per segment, sweep to the left per segment
//   earB, earD        ears laid back / drooping to the sides
//   locF, locH        0 = feet planted in the world (walking), 1 = feet held where the pose puts them
//   flatF, flatH      forearms / hind feet resting flat on the ground
//   ffx, ffz, ffy     front feet: half-distance apart, ahead of the chest, height
//   hfx, hfz, hfy     hind feet:  half-distance apart, ahead of the hips, height
const BASE = {
  hx: 0, hy: 0, hz: 0, hrx: 0, hry: 0, hrz: 0, srx: 0, sry: 0, crx: 0, cry: 0,
  nrx: 0, nry: 0, nrz: 0, hdx: 0, hdy: 0, hdz: 0,
  tl: 0.12, tc: 0.07, ts: 0, earB: 0, earD: 0,
  locF: 0, locH: 0, flatF: 0, flatH: 0,
  ffx: 0.08, ffz: 0.04, ffy: 0, hfx: 0.09, hfz: -0.02, hfy: 0,
};
const pose = (o) => ({ ...BASE, ...o });

export const POSES = {
  stand: pose({}),
  alert: pose({ nrx: -0.16, hdx: -0.04, tl: 0.5, hy: 0.004 }),
  sit: pose({
    hy: -0.2, hz: -0.03, hrx: -0.62, srx: 0.1, crx: 0.06, nrx: 0.26, hdx: 0.3,
    tl: 0.86, tc: 0.02, ts: 0.34, locF: 1, locH: 1, flatH: 1,
    ffx: 0.07, ffz: 0.045, hfx: 0.125, hfz: 0.2,
  }),
  lie: pose({
    hy: -0.238, hrx: -0.04, crx: -0.04, nrx: -0.2, hdx: 0.22,
    tl: 0.34, tc: 0.03, ts: 0.3, locF: 1, locH: 1, flatF: 1, flatH: 1,
    ffx: 0.075, ffz: 0.2, hfx: 0.13, hfz: 0.17,
  }),
  // curled up asleep, nose to tail (to the fox's left)
  sleep: pose({
    hy: -0.243, hry: 0.45, sry: 0.55, cry: 0.58, nry: 0.7, nrx: 0.3, hdy: 0.5, hdx: 0.2, hdz: 0.25,
    tl: 0.36, tc: 0.0, ts: 0.7, earB: 0.35, earD: 0.2, locF: 1, locH: 1, flatF: 1, flatH: 1,
    ffx: 0.07, ffz: 0.12, hfx: 0.12, hfz: 0.15,
  }),
  // chest down, rump up: "play with me!" — also the landing of a pounce
  bow: pose({
    hy: -0.012, hrx: 0.5, srx: 0.06, nrx: -0.52, hdx: -0.1, tl: 1.25, tc: 0.12,
    locF: 1, flatF: 1, ffx: 0.09, ffz: 0.17,
  }),
  crouch: pose({ hy: -0.105, hrx: 0.1, nrx: 0.42, hdx: -0.42, tl: -0.1, tc: -0.02, earB: 0.3 }),
  eat: pose({ hy: -0.02, hrx: 0.3, nrx: 0.8, hdx: 0.34, tl: 0.3, earB: 0.2 }),
  sniff: pose({ hy: -0.03, hrx: 0.24, nrx: 0.86, hdx: 0.1, tl: 0.2, earB: 0.1 }),
  howl: pose({
    hy: -0.2, hz: -0.03, hrx: -0.66, srx: 0.06, nrx: -0.32, hdx: -0.4, tl: 0.86, ts: 0.3, earB: 0.75,
    locF: 1, locH: 1, flatH: 1, ffx: 0.07, ffz: 0.045, hfx: 0.125, hfz: 0.2,
  }),
  // sitting, leaning into the hand
  pet: pose({
    hy: -0.2, hz: -0.03, hrx: -0.6, srx: 0.1, crx: 0.06, nrx: 0.04, hdx: -0.08, hdz: 0.3, tl: 1.0, ts: 0.2, earB: 0.6, earD: 0.3,
    locF: 1, locH: 1, flatH: 1, ffx: 0.07, ffz: 0.045, hfx: 0.125, hfz: 0.2,
  }),
  sad: pose({ hy: -0.238, nrx: 0.3, hdx: 0.34, tl: 0.2, ts: 0.2, earB: 0.5, earD: 0.55, locF: 1, locH: 1, flatF: 1, flatH: 1, ffx: 0.075, ffz: 0.2, hfx: 0.13, hfz: 0.17 }),
  // in the air: reaching up, then diving nose-first
  leap: pose({ hrx: -0.5, srx: -0.1, nrx: 0.2, hdx: 0.2, tl: 0.7, tc: 0.05, earB: 0.6, locF: 1, locH: 1, ffx: 0.07, ffz: 0.1, ffy: 0.2, hfx: 0.08, hfz: -0.16, hfy: 0.1 }),
  dive: pose({ hrx: 0.72, srx: 0.1, nrx: 0.1, hdx: 0.2, tl: 1.2, tc: 0.1, earB: 0.7, locF: 1, locH: 1, ffx: 0.07, ffz: 0.2, ffy: 0.06, hfx: 0.08, hfz: -0.14, hfy: 0.2 }),
  hop: pose({ hrx: -0.12, nrx: -0.1, tl: 0.9, locF: 1, locH: 1, ffx: 0.08, ffz: 0.06, ffy: 0.06, hfx: 0.09, hfz: -0.05, hfy: 0.05 }),
  // bent round after its own tail
  spinL: pose({ sry: 0.3, cry: 0.42, nry: 0.5, nrx: 0.15, hdy: 0.4, ts: 0.5, tl: 0.5 }),
  spinR: pose({ sry: -0.3, cry: -0.42, nry: -0.5, nrx: 0.15, hdy: -0.4, ts: -0.5, tl: 0.5 }),
  // up on its haunches, front paws in the air: "look at me!" — for dancing
  beg: pose({
    hy: -0.19, hz: -0.05, hrx: -1.02, srx: 0.04, crx: 0.02, nrx: 0.52, hdx: 0.44, tl: 0.9, tc: 0.03, ts: 0.2,
    locF: 1, locH: 1, flatH: 1, ffx: 0.062, ffz: 0.1, ffy: 0.31, hfx: 0.13, hfz: 0.2,
  }),
  // standing on something that is not the ground (a trampoline, a bench): the feet stay under the body
  perch: pose({ locF: 1, locH: 1 }),
  // …and giving at the knees as it comes down on it
  squat: pose({ hy: -0.085, hrx: 0.06, nrx: -0.12, tl: 0.5, earB: 0.3, locF: 1, locH: 1, ffx: 0.085, hfx: 0.1 }),
  // lying in the doorway of its house, chin low, the tail tucked in beside it
  den: pose({
    hy: -0.24, hrx: -0.03, crx: -0.03, nrx: -0.02, hdx: 0.12,
    tl: 0.2, tc: 0.02, ts: 0.95, locF: 1, locH: 1, flatF: 1, flatH: 1,
    ffx: 0.07, ffz: 0.21, hfx: 0.115, hfz: 0.16,
  }),
};
const POSE_KEYS = Object.keys(BASE);

// Gaits: which part of the stride each foot is on the ground for. Order: FL, HL, FR, HR.
const GAITS = {
  walk: { stride: 0.4, duty: 0.62, off: [0.75, 0, 0.25, 0.5], lift: 0.035, bob: 0.004, lower: 0.004 },
  trot: { stride: 0.6, duty: 0.46, off: [0, 0.5, 0.5, 0], lift: 0.05, bob: 0.012, lower: 0.014 },
  run: { stride: 1.05, duty: 0.34, off: [0.52, 0, 0.62, 0.1], lift: 0.075, bob: 0.03, lower: 0.03 },
};

const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qInv = new THREE.Quaternion();
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _e1 = V();
const _e2 = V();
const _e3 = V();
const _a = V();
const _b = V();
const _c = V();
const _d = V();
const _side = V();
const _fwd = V();
const _S = V();
const _T = V();
const _E = V();
const _euler = new THREE.Euler();
const _org = V();
const X = V(1, 0, 0);

/** Orthonormal frame of a bone whose rest direction is `dir` (in the YZ plane): columns X, dir, X × dir. */
function restFrameInverse(dir) {
  const e3 = V().crossVectors(X, dir).normalize();
  return new THREE.Matrix4().makeBasis(X, dir, e3).transpose();
}

export class FoxAnimator {
  constructor(rig) {
    this.rig = rig;
    this.S = rig.scale;
    this.time = Math.random() * 10;
    // a kind may hold some poses its own way (animud.js: a head too large to be put to the ground on a short neck)
    this.poses = {};
    for (const name in rig.species.poses || {}) this.poses[name] = { ...(POSES[name] || POSES.stand), ...rig.species.poses[name] };

    // set by the brain
    this.pos = V();
    this.yaw = 0;
    this.speed = 0; //      forward speed, world units / s
    this.yawRate = 0;
    this.air = 0; //        height of a jump
    this.target = POSES.stand;
    this.rate = 6; //       how fast the pose blends
    this.look = null; //    world point to look at (or null)
    this.lookW = 0;
    this.mood = { wag: 0, ears: 0, mouth: 0, pant: 0, chew: 0, eyes: 'open', breath: 1, shake: 0, wiggle: 0, tailUp: 0 };
    this.noseY = null; //   keep the nose at this height (eating, sniffing, sleeping)
    this.carry = false; //  it has something in its mouth (a letter)
    this.pitch = 0; //      tipped nose-down (radians): on a swing, head over heels
    this.roll = 0; //       …and over onto its side
    this.pivot = 0; //      how high above the ground the point is that it tips about (model units)
    this.add = {}; //       offsets on top of the pose, a frame at a time (same keys): a dance
    this.lift = [0, 0, 0, 0]; // …and feet picked up off the ground (FL, HL, FR, HR; model units)
    this.up = V(0, 1, 0); // the fox's own "up" (straight up, unless it is tipped)

    this.cur = { ...POSES.stand };
    this.eff = { ...POSES.stand }; // the pose as it is shown: `cur` and what a dance adds to it
    this.phase = 0;
    this.gaitName = 'walk';
    this.gait = { ...GAITS.walk, off: GAITS.walk.off.slice() };
    this.vel = V();
    this.prevPos = V();
    this.smYawRate = 0;
    this.nosePitch = 0;
    this.lookYaw = 0;
    this.lookPitch = 0;
    this.blinkT = 1 + Math.random() * 3;
    this.blink = 0;
    this.twitchT = 2;
    this.twitch = [0, 0];
    this.wagPhase = 0;
    this.tailLag = new Array(TAIL_SEGS).fill(0);
    this.mouth = 0;
    this.earsCur = 0;
    this.eyeMode = 'open';
    this.stepSounds = 0;

    this.legs = rig.legs.map((def, i) => ({
      def,
      i,
      inv: def.dirs.map(restFrameInverse),
      plant: V(),
      pos: V(), //        where the foot touches (world)
      lift: 0,
      swing: null,
      swung: false,
      local: 0,
      localPos: V(),
    }));
    this.onStep = null; // (worldPos, legIndex) when a foot lands
    this.snap();
  }

  /** Put every foot under the body (after teleporting or swapping the fox). */
  snap() {
    const g = this.rig.group;
    g.position.set(this.pos.x, this.air, this.pos.z);
    g.rotation.set(0, this.yaw, 0);
    g.updateMatrixWorld(true);
    this.legs.forEach((leg) => {
      leg.plant.copy(leg.def.home).applyMatrix4(g.matrixWorld);
      leg.plant.y = 0;
      leg.pos.copy(leg.plant);
      leg.swing = null;
    });
    this.prevPos.copy(this.pos);
  }

  setPose(name, rate = 6) {
    this.target = this.poses[name] || POSES[name] || POSES.stand;
    this.rate = rate;
  }

  /** Nothing on top of the pose any more (a dance writes its offsets afresh every frame). */
  still() {
    for (const key in this.add) this.add[key] = 0;
    this.lift[0] = this.lift[1] = this.lift[2] = this.lift[3] = 0;
  }

  /** Upright again (after a swing, a somersault). */
  level() {
    this.pitch = this.roll = this.pivot = 0;
  }

  /** World position of the tip of the nose / the top of the head (after update). */
  nosePoint(out = V()) {
    return out.copy(this.rig.dims.noseTip).applyMatrix4(this.rig.bones.head.matrixWorld);
  }
  headPoint(out = V()) {
    return out.copy(this.rig.dims.crown).applyMatrix4(this.rig.bones.head.matrixWorld);
  }

  // ---------------------------------------------------------------- update

  update(dt) {
    const rig = this.rig;
    const B = rig.bones;
    const S = this.S;
    const cur = this.cur;
    const p = this.eff;
    const m = this.mood;
    this.time += dt;
    const t = this.time;

    // -- blend the pose, then lay on top of it what a dance adds
    const k = 1 - Math.exp(-this.rate * dt);
    for (const key of POSE_KEYS) {
      cur[key] += (this.target[key] - cur[key]) * k;
      p[key] = cur[key] + (this.add[key] || 0);
    }

    // -- velocity & gait
    this.vel.copy(this.pos).sub(this.prevPos).divideScalar(Math.max(dt, 1e-4));
    this.prevPos.copy(this.pos);
    const speed = Math.abs(this.speed) / S; // in body lengths, so small foxes take quicker steps
    this.smYawRate = damp(this.smYawRate, this.yawRate, 8, dt);
    const turning = Math.abs(this.smYawRate) * 0.22;
    const eff = Math.max(speed, turning);
    const moving = eff > 0.04 && p.locF < 0.5 && p.locH < 0.5;
    const name = speed > 1.25 ? 'run' : speed > 0.5 ? 'trot' : 'walk';
    if (name !== this.gaitName) this.gaitName = name;
    const G = GAITS[this.gaitName];
    const g = this.gait;
    for (const key of ['stride', 'duty', 'lift', 'bob', 'lower']) g[key] = damp(g[key], G[key], 6, dt);
    for (let i = 0; i < 4; i++) g.off[i] = damp(g.off[i], G.off[i], 5, dt);
    const period = g.stride / Math.max(eff, 0.05);
    if (moving) this.phase = (this.phase + dt / period) % 1;
    const go = moving ? clamp(eff / 0.3, 0, 1) : 0;
    this.go = damp(this.go || 0, go, 8, dt);
    const stridePhase = this.phase * Math.PI * 2;

    // -- root (tipped, it turns about a point `pivot` above its feet, so that it rolls on the spot)
    const grp = rig.group;
    grp.position.set(this.pos.x, this.air, this.pos.z);
    grp.rotation.set(this.pitch, this.yaw, this.roll, 'YXZ');
    this.up.set(0, 1, 0);
    if (this.pitch || this.roll) {
      this.up.applyQuaternion(grp.quaternion);
      const c = this.pivot * S;
      grp.position.x -= this.up.x * c;
      grp.position.y += (1 - this.up.y) * c;
      grp.position.z -= this.up.z * c;
    }

    // -- spine
    const runK = clamp((speed - 0.9) / 0.6, 0, 1) * this.go;
    const bob = Math.cos(stridePhase * 2) * g.bob * this.go;
    const breath = Math.sin(t * (m.pant > 0.3 ? 9 : 1.5 * m.breath)) * (m.pant > 0.3 ? 0.008 : 0.013);
    const shake = m.shake > 0 ? Math.sin(t * 38) * 0.22 * m.shake : 0;
    const wiggle = m.wiggle > 0 ? Math.sin(t * 17) * 0.11 * m.wiggle : 0;
    const sway = Math.sin(stridePhase) * 0.05 * this.go;
    const gallop = Math.sin(stridePhase) * 0.16 * runK;

    B.hips.position.copy(B.hips.userData.rest);
    B.hips.position.x += p.hx;
    B.hips.position.y += p.hy + bob - g.lower * this.go;
    B.hips.position.z += p.hz;
    B.hips.rotation.set(p.hrx + gallop, p.hry + sway - this.smYawRate * 0.03 + wiggle, p.hrz + shake);
    B.spine.rotation.set(p.srx - gallop * 0.5, p.sry - sway * 0.6 + this.smYawRate * 0.03, shake * -0.5);
    B.spine.scale.set(1 + breath, 1 + breath, 1); // only the ribs breathe: the chest undoes it for everything in front
    B.chest.rotation.set(p.crx - gallop * 0.6, p.cry - sway * 0.6 + this.smYawRate * 0.035, -shake * 0.6);
    B.chest.scale.set(1 / (1 + breath), 1 / (1 + breath), 1);

    // -- head: pose + looking + keeping the nose at a height
    let lookYaw = 0;
    let lookPitch = 0;
    if (this.look && this.lookW > 0.01) {
      B.chest.updateWorldMatrix(true, false);
      _a.copy(this.look).sub(_b.setFromMatrixPosition(B.head.matrixWorld));
      _q.setFromRotationMatrix(B.chest.matrixWorld).invert();
      _a.applyQuaternion(_q);
      lookYaw = clamp(Math.atan2(_a.x, _a.z), -1.25, 1.25) * this.lookW;
      const want = -Math.atan2(_a.y, Math.hypot(_a.x, _a.z));
      lookPitch = clamp(want - (p.nrx + p.hdx + p.hrx + p.srx + p.crx), -0.75, 0.75) * this.lookW;
    }
    this.lookYaw = damp(this.lookYaw, lookYaw, 7, dt);
    this.lookPitch = damp(this.lookPitch, lookPitch, 7, dt);
    if (this.noseY != null) {
      const err = this.nosePoint(_a).y - this.noseY * S;
      this.nosePitch = clamp(this.nosePitch + err * 9 * dt, -0.7, rig.dims.nod);
    } else this.nosePitch = damp(this.nosePitch, 0, 6, dt);
    const headBob = Math.sin(stridePhase * 2 + 0.6) * 0.03 * this.go;
    const chew = m.chew > 0 ? Math.sin(t * 13) * 0.06 * m.chew : 0;
    B.neck.rotation.set(p.nrx + this.lookPitch * 0.4 + this.nosePitch * 0.62 + headBob + gallop * 0.35, p.nry + this.lookYaw * 0.42, p.nrz);
    B.head.rotation.set(p.hdx + this.lookPitch * 0.6 + this.nosePitch * 0.38 + chew, p.hdy + this.lookYaw * 0.58, p.hdz + shake * 0.9);

    // -- jaw & tongue
    const panting = m.pant > 0.3 && !this.carry;
    const pant = panting ? 0.2 + Math.sin(t * 9) * 0.05 : 0;
    // something held in the mouth keeps the jaws a little apart, whatever else the fox is up to
    const mouthTarget = this.carry ? 0.3 : Math.max(m.mouth, pant, m.chew > 0 ? 0.12 + Math.sin(t * 13) * 0.12 : 0);
    this.mouth = damp(this.mouth, mouthTarget, 14, dt);
    B.jaw.rotation.x = this.mouth * 0.75;
    const tongue = rig.face.tongue;
    tongue.position.z = tongue.userData.rest.z + (panting ? tongue.userData.out : 0);
    tongue.rotation.x = panting ? 0.35 : 0;

    // -- ears
    this.twitchT -= dt;
    if (this.twitchT < 0) {
      this.twitchT = 1.5 + Math.random() * 5;
      this.twitch[Math.random() < 0.5 ? 0 : 1] = 1;
    }
    this.earsCur = damp(this.earsCur, m.ears, 8, dt);
    [B.earL, B.earR].forEach((ear, i) => {
      this.twitch[i] = Math.max(0, this.twitch[i] - dt * 5);
      const tw = Math.sin(this.twitch[i] * Math.PI) * 0.45;
      const back = clamp(p.earB + this.earsCur + runK * 0.5, -0.3, 1.2);
      const sg = i ? -1 : 1;
      ear.rotation.set(-back * 0.85 - tw * 0.3, tw * sg, -sg * (p.earD * 0.9 + back * 0.25) + shake * 1.5);
    });

    // -- tail
    this.wagPhase += dt * (6 + m.wag * 12);
    for (let i = TAIL_SEGS - 1; i > 0; i--) this.tailLag[i] = damp(this.tailLag[i], this.tailLag[i - 1], 12, dt);
    this.tailLag[0] = damp(this.tailLag[0], clamp(-this.smYawRate * 0.11, -0.5, 0.5), 10, dt);
    const lift = p.tl + m.tailUp + runK * 0.35 + this.go * 0.18;
    rig.tails.forEach((tail, ti) => {
      const fan = tail.def.f || 0;
      const own = ti * 1.7;
      tail.bones.forEach((bone, i) => {
        const along = i / (TAIL_SEGS - 1);
        const wag = Math.sin(this.wagPhase - i * 0.55 + own * 0.4) * m.wag * (0.2 + 0.2 * along);
        const idle = Math.sin(t * 1.3 + i * 0.7 + own) * 0.035 + Math.sin(stridePhase + i * 0.6) * 0.07 * this.go;
        const rx = (i === 0 ? lift * 0.75 : i === 1 ? lift * 0.25 : 0) + p.tc + Math.sin(t * 0.9 + i + own) * 0.02 + (i ? gallop * -0.3 : 0);
        const ry = -(p.ts * (1 - Math.abs(fan) * 0.6)) + wag + idle + this.tailLag[i] + shake * 0.5;
        if (i === 0) {
          _euler.set(rx, ry, 0, 'YXZ');
          bone.quaternion.copy(bone.userData.restQuat).multiply(_q.setFromEuler(_euler));
        } else bone.rotation.set(rx, ry, 0);
      });
    });

    // -- eyes
    this.blinkT -= dt;
    if (this.blinkT < 0) {
      this.blinkT = 1.8 + Math.random() * 4;
      this.blink = 1;
    }
    this.blink = Math.max(0, this.blink - dt * 7);
    const closed = m.eyes !== 'open';
    rig.face.eyes.forEach((e) => {
      if (e.set) return void e.set(m.eyes, Math.sin(this.blink * Math.PI) * 0.9); // (a face of its own shuts its eyes its own way: animud.js)
      e.ball.visible = e.glint.visible = !closed;
      e.lid.visible = closed;
      e.lid.rotation.z = m.eyes === 'sleep' ? Math.PI : 0;
      e.ball.scale.y = 1.06 * (1 - Math.sin(this.blink * Math.PI) * 0.9);
      e.glint.scale.setScalar(this.blink > 0.2 ? 0.01 : 1);
    });

    // -- feet, then legs
    grp.updateMatrixWorld(true);
    this.updateFeet(dt, moving, period, g);
    this.solveLegs();
  }

  // ---------------------------------------------------------------- feet

  updateFeet(dt, moving, period, g) {
    const p = this.eff;
    const S = this.S;
    const root = this.rig.group.matrixWorld;
    // the ground the pose holds the feet on: level under the fox — or tipped with it (the seat of a swing)
    const up = this.up;
    const tipped = up.y < 0.9999;
    _org.copy(this.rig.group.position);
    const lead = moving ? g.duty * period * 0.5 : 0;
    let swinging = 0;
    this.legs.forEach((leg) => (swinging += leg.swing ? 1 : 0));

    this.legs.forEach((leg, i) => {
      const def = leg.def;
      const home = _a.copy(def.home).applyMatrix4(root);
      home.y = 0;

      // where the pose would hold this foot: relative to its girdle, on the ground
      const girdle = def.girdle.matrixWorld;
      _b.setFromMatrixPosition(girdle);
      const fx = (def.front ? p.ffx : p.hfx) * def.side * S;
      const fz = (def.front ? p.ffz : p.hfz) * S;
      const fy = (def.front ? p.ffy : p.hfy) * S;
      if (tipped) {
        _fwd.set(girdle.elements[8], girdle.elements[9], girdle.elements[10]);
        _fwd.addScaledVector(up, -_fwd.dot(up)).normalize();
        _side.crossVectors(up, _fwd);
        const above = _c.copy(_b).sub(_org).dot(up); // how high the girdle is over the fox's own ground
        leg.localPos.copy(_b).addScaledVector(up, fy - above).addScaledVector(_side, fx).addScaledVector(_fwd, fz);
      } else {
        _fwd.set(girdle.elements[8], 0, girdle.elements[10]).normalize();
        _side.set(_fwd.z, 0, -_fwd.x);
        leg.localPos.set(_b.x + _side.x * fx + _fwd.x * fz, this.air + fy, _b.z + _side.z * fx + _fwd.z * fz);
      }
      const local = def.front ? p.locF : p.locH;

      // planted in the world, stepping when the gait (or a foot left behind) asks for it
      if (leg.swing) {
        const sw = leg.swing;
        sw.t = Math.min(1, sw.t + dt / sw.dur);
        _c.copy(home).addScaledVector(this.vel, lead);
        _c.y = 0;
        leg.pos.lerpVectors(sw.from, _c, ease(sw.t));
        leg.lift = Math.sin(sw.t * Math.PI) * sw.h;
        if (sw.t >= 1) {
          leg.plant.copy(_c);
          leg.pos.copy(_c);
          leg.lift = 0;
          leg.swing = null;
          swinging--;
          if (this.onStep && local < 0.5) this.onStep(leg.plant, i);
        }
      } else {
        leg.pos.copy(leg.plant);
        leg.lift = 0;
        const off = home.distanceTo(leg.plant);
        let start = 0;
        if (local > 0.5) {
          // held by the pose: keep the plant following, so getting up starts from here
          leg.plant.copy(leg.localPos).setY(0);
        } else if (moving) {
          const ph = (this.phase + g.off[i]) % 1;
          if (ph >= g.duty) {
            if (!leg.swung) {
              leg.swung = true;
              start = Math.max(0.07, (1 - ph) * period);
            }
          } else leg.swung = false;
          if (!start && off > 0.3 * S) start = 0.1; // left far behind (a sudden turn): catch up
        } else if (off > 0.045 * S && swinging === 0) {
          start = 0.17; // standing: shuffle one foot at a time back under the body
        }
        if (start) {
          leg.swing = { from: leg.plant.clone(), t: 0, dur: start, h: (moving ? g.lift : 0.028) * S };
          swinging++;
        }
      }
      leg.local = local;
    });
  }

  // ---------------------------------------------------------------- legs (IK)

  /** Two bones from S reaching for T; returns the joint between them in _E, the reached point in _T. */
  solve2(S, T, l1, l2, hint) {
    _d.copy(T).sub(S);
    let dist = _d.length();
    const max = (l1 + l2) * 0.999;
    const min = Math.abs(l1 - l2) + 1e-4;
    if (dist < 1e-5) {
      _d.set(0, -1, 0);
      dist = 1e-5;
    }
    _d.divideScalar(dist);
    dist = clamp(dist, min, max);
    _T.copy(S).addScaledVector(_d, dist);
    const a = (l1 * l1 - l2 * l2 + dist * dist) / (2 * dist);
    const h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
    _c.copy(hint).addScaledVector(_d, -hint.dot(_d));
    if (_c.lengthSq() < 1e-8) _c.set(0, 0, 1).addScaledVector(_d, -_d.z);
    _c.normalize();
    _E.copy(S).addScaledVector(_d, a).addScaledVector(_c, h);
  }

  /** World rotation that takes a bone's rest frame to "pointing along dir, hinge along side". */
  aim(out, inv, dir, side) {
    _e2.copy(dir);
    _e1.copy(side).addScaledVector(_e2, -side.dot(_e2)).normalize();
    _e3.crossVectors(_e1, _e2);
    _m.makeBasis(_e1, _e2, _e3).multiply(inv);
    return out.setFromRotationMatrix(_m);
  }

  solveLegs() {
    const p = this.eff;
    const S = this.S;
    const up = this.up;
    const rootQ = this.rig.group.quaternion;
    const hint = V();
    const footDir = V();
    const dir = V();
    const qParent = new THREE.Quaternion();
    const qA = new THREE.Quaternion();
    const qB = new THREE.Quaternion();
    const qC = new THREE.Quaternion();
    const foot = V();

    this.legs.forEach((leg) => {
      const def = leg.def;
      const [b0, b1, b2, b3] = def.chain;
      const flat = def.front ? p.flatF : p.flatH;
      const swingK = leg.lift / (0.05 * S + 1e-6);

      // the foot: blend between its planted spot and where the pose holds it
      foot.copy(leg.pos);
      foot.y = leg.lift;
      if (leg.local > 0.001) foot.lerp(leg.localPos, leg.local);
      if (this.lift[leg.i]) foot.addScaledVector(up, this.lift[leg.i] * S);

      // the girdle's frame
      _m2.extractRotation(def.girdle.matrixWorld);
      qParent.setFromRotationMatrix(_m2);
      _side.set(1, 0, 0).applyQuaternion(qParent);
      _fwd.set(0, 0, 1).applyQuaternion(qParent);
      _S.setFromMatrixPosition(b0.matrixWorld);

      if (def.front) {
        // wrist target; the elbow bends backwards (and down onto the ground when lying)
        _a.copy(foot).addScaledVector(up, lerp(def.ankle.y, 0.026, flat) * S);
        _a.addScaledVector(_fwd, def.ankle.z * S);
        hint.copy(_fwd).multiplyScalar(-1).addScaledVector(up, lerp(-0.15, -1.6, flat));
        this.solve2(_S, _a, def.lens[0] * S, def.lens[1] * S, hint);
        dir.copy(_E).sub(_S).normalize();
        this.aim(qA, leg.inv[0], dir, _side);
        dir.copy(_T).sub(_E).normalize();
        this.aim(qB, leg.inv[1], dir, _side);
        b0.quaternion.copy(_qInv.copy(qParent).invert()).multiply(qA);
        b1.quaternion.copy(_qInv.copy(qA).invert()).multiply(qB);
        // the paw stays level (toes hang a little while the foot is in the air)
        qC.copy(rootQ).multiply(_q2.setFromAxisAngle(X, swingK * 0.55));
        b2.quaternion.copy(_qInv.copy(qB).invert()).multiply(qC);
      } else {
        // the metatarsus keeps its angle (or lies flat, pointing forward); thigh and shin reach for the hock
        footDir.copy(def.dirs[2]).applyQuaternion(rootQ).addScaledVector(_fwd, -0.55 * swingK);
        if (flat > 0.001) {
          _b.copy(_fwd).multiplyScalar(1).addScaledVector(up, -0.1);
          footDir.lerp(_b, flat);
        }
        footDir.normalize();
        _a.copy(foot).addScaledVector(up, lerp(def.ankle.y, 0.03, flat) * S);
        _a.addScaledVector(footDir, -def.lens[2] * S); // the hock
        hint.copy(_fwd).addScaledVector(up, lerp(0.35, 0.1, flat)).addScaledVector(_side, def.side * flat * 0.9); // folded legs splay outwards
        this.solve2(_S, _a, def.lens[0] * S, def.lens[1] * S, hint);
        dir.copy(_E).sub(_S).normalize();
        this.aim(qA, leg.inv[0], dir, _side);
        dir.copy(_T).sub(_E).normalize();
        this.aim(qB, leg.inv[1], dir, _side);
        this.aim(qC, leg.inv[2], footDir, _side);
        b0.quaternion.copy(_qInv.copy(qParent).invert()).multiply(qA);
        b1.quaternion.copy(_qInv.copy(qA).invert()).multiply(qB);
        b2.quaternion.copy(_qInv.copy(qB).invert()).multiply(qC);
        _q.copy(rootQ).multiply(_q2.setFromAxisAngle(X, swingK * 0.4));
        b3.quaternion.copy(_qInv.copy(qC).invert()).multiply(_q);
      }
    });
  }
}
