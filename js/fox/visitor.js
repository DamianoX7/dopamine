// The girl from the house (js/house/me.js: the one she named and dresses), come on the bus to see the foxes (js/bus.js).
// She gets off out of sight and comes in through the gap in the bushes — the foxes that are awake run to meet her,
// Lorelei waves — and stays a while: she strolls about the yard, kneels down by a fox and strokes it, sits and watches
// them, sways to a cover by the radio, stands beside Lorelei in the family picture, looks up at the moon with them; in
// the rain her clear umbrella from the store goes up. When the bus is to take her home she says goodbye and goes out
// the way she came.
//
// She has Lorelei's way of getting about and most of what Lorelei does (keeper.js) — none of her chores: the bowl, the
// ball, the presents are Lorelei's. To the world she is `world.visitor`: never one of `foxes`, never the owner.
import * as THREE from '../vendor/three.module.min.js';
import { Keeper } from './keeper.js';
import { LoreleiAnimator } from './lorelei.js';
import { Batch } from './kit.js';
import { buildMe } from '../house/me.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
// what a fox may call her away from (to stroke it)
const IDLE = new Set(['linger', 'amble', 'stretchUp', 'sitAwhile']);

/** Her, as the world keeps its creatures: { id, rig, anim, brain } — built from how she looks (js/avatar.js: look3d). */
export function makeVisitor(world, look) {
  const rig = buildMe(look);
  const anim = new LoreleiAnimator(rig);
  rig.group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  umbrella(rig.umbrella);
  const me = { id: '~me', rig, anim, brain: null, baby: false, guest: false, wet: 0, isVisitor: true, away: true, gone: false };
  me.brain = new Visitor(world, me);
  return me;
}

/* A clear plastic umbrella, the kind the convenience store sells when it starts to rain: in her hand, for the rain here. */
function umbrella(group) {
  const b = new Batch();
  const col = new THREE.Color();
  const rib = (p) => col.set(Math.abs(Math.sin(Math.atan2(p.z, p.x) * 4)) < 0.12 ? '#ffffff' : '#e8f4ff');
  b.add(new THREE.ConeGeometry(0.33, 0.13, 16, 1, true), { at: [0, 0.5, 0], color: rib, byFace: true });
  const canopy = b.mesh(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 0.5, depthWrite: false }));
  canopy.castShadow = false;
  const s = new Batch();
  s.add(new THREE.CylinderGeometry(0.006, 0.006, 0.6, 5), { at: [0, 0.27, 0], color: '#dfe6ee' });
  s.add(new THREE.SphereGeometry(0.012, 8, 6), { at: [0, 0.575, 0], color: '#ffffff' });
  s.add(new THREE.TorusGeometry(0.022, 0.007, 5, 10, Math.PI), { at: [0.022, -0.03, 0], rot: [Math.PI, 0, 0], color: '#f2f4f8' });
  group.add(canopy, s.mesh(new THREE.MeshLambertMaterial({ vertexColors: true })));
  group.position.set(0, -0.025, 0.01);
}

export class Visitor extends Keeper {
  constructor(world, me) {
    super(world, me);
    this.side = -1; // (Lorelei's other side)
    this.came = false; // she is in, and has been met
  }

  /** Nothing she could not leave off for a fox that comes up to her. */
  get idle() {
    return this.came && !this.fox.leaving && !this.asleep && !this.w.showcaseOn && !this.w.photoOn && IDLE.has(this.doing);
  }

  choose() {
    const w = this.w;
    const st = w.state;
    if (w.photoOn) return ['poseForPicture'];
    if (w.showcaseOn) return ['standBy'];
    if (w.tune && w.tune.on) return ['swayAlong'];
    if (w.gazing === 'moon') return ['moonGaze'];
    if (w.sky.sand > 0.25) return ['braveWind'];
    if (st.mood === 'sleepy') return ['sitAwhile', [rand(12, 20)]]; // (the foxes are asleep: she sits by them, quietly)
    const wet = w.sky.rain > 0.2 || w.sky.wet > 0.4;
    const table = [];
    const add = (name, weight, ...args) => weight > 0 && table.push([name, weight, args]);
    add('linger', 2);
    add('amble', 2.1);
    add('stretchUp', 0.35);
    add('sitAwhile', wet ? 0 : 1.2);
    const one = wet ? null : this.foxToPet();
    if (one) add('petOne', 1.6, one);
    table.forEach((row) => row[0] === this.last && (row[1] *= 0.3));
    let pick = Math.random() * table.reduce((s, row) => s + row[1], 0);
    const row = table.find((x) => (pick -= x[1]) < 0) || table[0];
    this.last = row[0];
    return [row[0], row[2]];
  }

  /** …and as she kneels down by one, now and then a word for it. */
  *petOne(fox = this.foxToPet()) {
    if (fox && Math.random() < 0.5) this.say(this.w.host.visitLine('pet', fox.id), 2400);
    yield* super.petOne(fox);
  }

  /**
   * Off the bus, out of sight, she comes to the gap in the bushes (`gate`: where it is, and which way is out) and in, a
   * few steps into the yard — there she stops, and the foxes run to meet her (world.visitIn); a wave, and a word.
   */
  *comeIn(gate) {
    const a = this.a;
    const w = this.w;
    const me = this.fox;
    me.away = true; // (nothing keeps her out of the yard, or in it, until she is in)
    a.mood.smile = 1;
    yield* this.goTo(gate.x, gate.z, { speed: 'walk', stop: 0.2, timeout: 9, beyond: true });
    me.away = false;
    this.stray = false;
    const b = w.env.bounds;
    const to = this.clampPoint(gate.x + (b.cx - gate.x) * 0.42, gate.z + (b.cz - gate.z) * 0.42, 0.85);
    yield* this.goTo(to.x, to.z, { speed: 'walk', stop: 0.12, timeout: 4 });
    w.visitIn();
    yield* this.turnTo(this.toCamera(), 5);
    this.lookAtYou(0.9);
    a.setPose('wave', 8);
    a.mood.smile = 1;
    this.say(w.host.visitLine(w.state.mood === 'sleepy' ? 'arrive_night' : 'arrive'), 3000);
    for (let t = 0; t < 1.8; ) {
      t += yield;
      a.add.eR = Math.sin(t * 11) * 0.36;
      a.mood.eyes = t > 0.4 && t < 1.4 ? 'happy' : 'open';
    }
    a.still();
    a.mood.eyes = 'open';
    a.setPose('stand', 5);
    this.came = true;
    yield* this.wait(0.8);
  }

  /** The bus is coming for her: goodbye — a wave to whoever looks on — to the gap in the bushes, and away. */
  *goHome(gate) {
    const a = this.a;
    const w = this.w;
    yield* this.turnTo(this.toCamera(), 7);
    this.lookAtYou(1);
    a.setPose('wave', 8);
    a.mood.smile = 1;
    this.say(w.host.visitLine('bye'), 2600);
    for (let t = 0; t < 1.7; ) {
      t += yield;
      a.add.eR = Math.sin(t * 11) * 0.36;
    }
    a.still();
    a.setPose('stand', 5);
    a.lookW = 0;
    yield* this.goTo(gate.x, gate.z, { speed: 'walk', stop: 0.25, timeout: 10 });
    this.fox.away = true;
    // …and on, out of the yard, a little way into the country (out there the bus waits, out of sight)
    const out = this.landAt(gate.x + Math.sin(gate.yaw) * 1.4, gate.z + Math.cos(gate.yaw) * 1.4);
    yield* this.goTo(out.x, out.z, { speed: 'walk', stop: 0.25, timeout: 6, beyond: true });
    this.fox.gone = true;
    yield* this.wait(30);
  }
}

