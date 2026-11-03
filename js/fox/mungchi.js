// 뭉치, the white cat from the house (../house/cat.js), come along on the bus. It gets off behind her and in through the
// gap in the bushes at her heels, and it does not know this place: while it has no friend here it stays close to her
// and flattens its ears at any fox that comes near. She introduces them, one fox at a time and a step a day (js/cattrip.js;
// catlife.js has the fox's side of what they do), and the better it knows them the further it goes from her side: it
// pads about, and plays with the ones it knows, and with a best friend it lies down and sleeps. When she goes home it
// goes ahead of her to the bus.
//
// It is a creature of the yard, as Lorelei and the girl are, on a fox's bones and with a fox's way of getting about
// (brain.js) — `world.mungchi`, never one of `foxes`, here only for as long as she is.
import { buildFox } from './rig.js';
import { FoxAnimator, wrapAngle } from './animator.js';
import { Brain } from './brain.js';
import { V, clamp, TAU } from './kit.js';
import { faceInLight } from '../house/cat.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
// what it can be called away from (by a fox that comes up for a sniff, by a fox it does not know)
const FREE = new Set(['heel', 'padAbout', 'catSit', 'catLoaf', 'catGroom', 'catStretch', 'atHerFeet', 'rubHer']);
const _v = V();

/** The cat, as the world keeps its creatures: { id, rig, anim, brain }. (Not in the scene yet.) */
export function makeMungchi(world) {
  const rig = buildFox('mungchi');
  rig.size = 0.9; // (how much room it takes up among the others: world.giveWay)
  rig.group.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  const anim = new FoxAnimator(rig);
  const me = { id: '~cat', rig, anim, brain: null, baby: false, guest: false, wet: 0, isCat: true, away: true, leaving: false };
  me.brain = new CatBrain(world, me);
  return me;
}

export class CatBrain extends Brain {
  constructor(world, me) {
    super(world, me);
    this.pace = 1.3; //    (a cat's stride is shorter than a fox's: it goes as it does at home)
    this.came = false; //  it is in, at her side
    this.side = Math.random() < 0.5 ? 1 : -1; // which side of her it keeps to
    this.check = 0; //     (when it last looked round for strange foxes)
  }

  get free() {
    return this.came && !this.w.showcaseOn && !this.w.photoOn && FREE.has(this.doing);
  }

  /** How well it knows a fox: 0 not at all … 3 a best friend. */
  level(fox) {
    return this.w.host.catFriend(fox.id);
  }

  update(dt) {
    this.check -= dt;
    if (this.check < 0 && this.free) {
      this.check = 0.25;
      const near = this.w.foxes.find((f) => !f.brain.asleep && this.level(f) === 0 && this.distTo(f) < 0.72);
      if (near) this.do('wary', near);
    }
    super.update(dt);
  }

  /** After it has moved: what of its face shows. */
  look(dt) {
    faceInLight(this.fox.rig, this, this.a.headPoint(_v), this.w.camera, { dark: this.w.night ? 1 : 0, light: false }, 0, dt);
  }

  /** Whatever the family is doing together, it goes along with it: to its place in the picture, otherwise to her feet. */
  join(name) {
    if (this.came && !this.fox.leaving) this.do(name === 'poseForPicture' ? name : 'atHerFeet');
  }

  /** Where it stays when it stays by her: at her heels, a little back from her side. */
  herSide() {
    return this.beside(this.w.visitor, this.side * 1.9, 0.36);
  }

  /** A fox it knows well enough (`min`), near enough and with nothing to do. */
  friend(min) {
    let best = null;
    let top = 0;
    for (const f of this.w.foxes) {
      const b = f.brain;
      if (b.asleep || b.stray || b.using || !b.free || this.level(f) < min || this.distTo(f) > 3) continue;
      const v = (0.4 + Math.random()) / (0.6 + this.distTo(f));
      if (v > top) {
        top = v;
        best = f;
      }
    }
    return best;
  }

  choose() {
    const w = this.w;
    const sky = w.sky;
    if (!w.visitor) return ['catSit', [2]];
    if (w.photoOn) return ['poseForPicture'];
    if (w.showcaseOn || (w.tune && w.tune.on) || w.gazing === 'moon' || sky.rain > 0.2 || sky.sand > 0.25) return ['atHerFeet']; // (in the rain: under her umbrella)
    if (w.state.mood === 'sleepy') return ['napByHer'];
    const best = w.foxes.reduce((m, f) => Math.max(m, this.level(f)), 0);
    const table = [];
    const add = (name, weight, ...args) => weight > 0 && table.push([name, weight, args]);
    add('heel', best ? 0.9 : 2.6);
    add('padAbout', 0.4 + 0.8 * best);
    add('catSit', 1.2);
    add('catLoaf', 1);
    add('catGroom', 0.9);
    add('catStretch', 0.4);
    add('rubHer', 0.5);
    if (!w.meeting) {
      const pal = this.friend(2);
      if (pal) add('friendly', 1.5, pal, 1);
      const nap = this.friend(3);
      if (nap) add('friendly', 1.4, nap, 3);
    }
    table.forEach((row) => row[0] === this.last && (row[1] *= 0.3));
    let pick = Math.random() * table.reduce((s, row) => s + row[1], 0);
    const row = table.find((x) => (pick -= x[1]) < 0) || table[0];
    this.last = row[0];
    if (row[0] !== 'friendly') return [row[0], row[2]];
    // (a game, or a nap, of their own accord: as when she introduced them, only that nobody looks on)
    const s = w.catScene(row[2][0], row[2][1], true);
    return s ? ['metBy', [s]] : ['catSit'];
  }

  // ---------------------------------------------------------------- on its own

  /** Sitting, or lying, having a look about: at her, at whoever is looking on, at nothing. */
  *idly(sec) {
    const a = this.a;
    const w = this.w;
    let next = rand(1, 2.5);
    for (let t = 0; t < sec; ) {
      t += yield;
      if (t < next) continue;
      next = t + rand(1.5, 3.5);
      const r = Math.random();
      if (r < 0.35 && w.visitor) this.lookAt(w.visitor, 0.7);
      else if (r < 0.6) this.lookAtYou(0.6);
      else {
        this.watch = null;
        a.look = null;
        a.lookW = 0;
      }
      a.mood.eyes = Math.random() < 0.25 ? 'happy' : 'open'; // (a slow blink: all is well)
    }
    a.mood.eyes = 'open';
  }

  /** To her side, and there it sits. */
  *heel(sec = rand(3, 6)) {
    yield* this.goTo(0, 0, { speed: 'walk', stop: 0.1, timeout: 6, moving: () => this.herSide() });
    this.a.setPose('sit', 4);
    yield* this.idly(sec);
  }

  /** A stroll, as far from her as it dares by now. */
  *padAbout() {
    const v = this.w.visitor;
    const best = this.w.foxes.reduce((m, f) => Math.max(m, this.level(f)), 0);
    const ang = Math.random() * TAU;
    const d = rand(0.45, 0.8 + 0.5 * best);
    const p = this.clampPoint(v.anim.pos.x + Math.sin(ang) * d, v.anim.pos.z + Math.cos(ang) * d, 0.9);
    yield* this.goTo(p.x, p.z, { speed: 'walk', stop: 0.08, timeout: 7 });
    this.a.setPose('stand', 5);
    yield* this.idly(rand(1, 2.2));
  }

  *catSit(sec = rand(3, 7)) {
    yield* this.settle();
    yield* this.turnTo(this.toCamera() + rand(-0.8, 0.8), 4);
    this.a.setPose('sit', 4);
    yield* this.idly(sec);
  }

  *catLoaf(sec = rand(4, 8)) {
    yield* this.settle();
    yield* this.turnTo(this.toCamera() + rand(-1, 1), 4);
    this.a.setPose('lie', 4);
    yield* this.idly(sec);
  }

  /** A forepaw up to its mouth, licked — then over the ear. */
  *catGroom(sec = rand(2.4, 4)) {
    const a = this.a;
    yield* this.settle();
    a.setPose('sit', 5);
    a.mood.eyes = 'happy';
    for (let t = 0; t < sec; ) {
      t += yield;
      const k = clamp(t * 3, 0, 1) * clamp((sec - t) * 3, 0, 1);
      a.lift[0] = 0.07 * k;
      a.add.nrx = 0.35 * k;
      a.add.hdx = 0.2 + Math.sin(t * 14) * 0.08;
      a.add.hdz = 0.25 * Math.sin(t * 0.8);
    }
    a.still();
    a.mood.eyes = 'open';
  }

  *catStretch() {
    const a = this.a;
    a.setPose('bow', 4);
    a.mood.eyes = 'happy';
    a.mood.mouth = 0.3;
    yield* this.wait(0.9);
    a.mood.mouth = 0;
    yield* this.wait(0.9);
    a.setPose('stand', 4);
    a.mood.eyes = 'open';
    yield* this.wait(0.4);
  }

  /** Round her legs, tail up, leaning into her. */
  *rubHer() {
    const a = this.a;
    const w = this.w;
    const v = w.visitor;
    this.target = v;
    yield* this.goTo(0, 0, { speed: 'walk', stop: 0.1, timeout: 6, skip: v, moving: () => this.herSide() });
    a.mood.tailUp = 0.6;
    a.mood.eyes = 'happy';
    if (Math.random() < 0.5) this.say(w.host.catLine('rub'), 2200);
    const from = this.angleFrom(v);
    const at = w.time;
    const dir = this.side;
    yield* this.goTo(0, 0, {
      speed: 'walk',
      stop: 0.03,
      timeout: 3.4,
      skip: v,
      moving: () => {
        const ang = from + dir * (w.time - at) * 1.6;
        return this.clampPoint(v.anim.pos.x + Math.sin(ang) * 0.27, v.anim.pos.z + Math.cos(ang) * 0.27, 1);
      },
    });
    w.fx.emit('💗', this.headTop(), { size: 0.09, rise: 0.3, life: 1.3 });
    a.mood.tailUp = 0;
    a.mood.eyes = 'open';
  }

  /** Which way round `o` it is. */
  angleFrom(o) {
    return Math.atan2(this.a.pos.x - o.anim.pos.x, this.a.pos.z - o.anim.pos.z);
  }

  /** At her feet, for as long as whatever is going on goes on: the shop, a cover, the moon, the rain. */
  *atHerFeet() {
    const a = this.a;
    const w = this.w;
    for (let t = 0; t < 30 && w.visitor; ) {
      if (this.distTo(w.visitor) > 0.6 || t === 0) {
        a.setPose('stand', 6);
        yield* this.goTo(0, 0, { speed: 'trot', stop: 0.08, timeout: 4, moving: () => this.herSide() });
        yield* this.turnTo(this.toCamera() + this.side * 0.4, 5);
      }
      a.setPose('sit', 4);
      if (w.tune && w.tune.on) a.mood.wag = 0.3 + 0.2 * Math.sin(w.time * 3);
      if (w.gazing === 'moon') this.lookAtMoon(0.8);
      t += yield;
    }
  }

  /** The foxes are asleep: curled up at her feet. */
  *napByHer() {
    const a = this.a;
    const w = this.w;
    yield* this.goTo(0, 0, { speed: 'walk', stop: 0.1, timeout: 6, moving: () => this.herSide() });
    yield* this.turnTo(this.toCamera() + rand(-0.35, 0.35), 4);
    a.setPose('sleep', 2.5);
    a.mood.eyes = 'sleep';
    a.mood.breath = 0.55;
    for (let t = 0, z = 3, v = w.visitor; t < 40 && w.state.mood === 'sleepy' && v && v.anim.speed < 0.3; ) {
      t += yield;
      if (t > z) {
        z = t + rand(3.5, 5.5);
        w.fx.emit('💤', this.headTop(), { size: 0.09, rise: 0.3, life: 1.3 });
      }
    }
    a.mood.eyes = 'open';
    a.setPose('sit', 3);
    yield* this.wait(0.6);
  }

  // ---------------------------------------------------------------- the bus

  /** Off the bus behind her (`gate`: the gap in the bushes), in, and up to her side. */
  *comeIn(gate) {
    const a = this.a;
    const w = this.w;
    const me = this.fox;
    me.away = true;
    yield* this.goTo(gate.x, gate.z, { speed: 'trot', stop: 0.2, timeout: 9, beyond: true });
    me.away = false;
    this.stray = false;
    if (w.visitor) {
      yield* this.goTo(0, 0, { speed: 'trot', stop: 0.1, timeout: 5, moving: () => this.herSide() });
      yield* this.turnTo(this.toCamera() + this.side * 0.5, 5);
    }
    this.came = true;
    a.setPose('sit', 5);
    a.mood.ears = 0.5; // (so many new smells)
    this.say(w.host.catLine('village'), 2400);
    yield* this.idly(2.4);
    a.mood.ears = 0;
  }

  /** The bus is coming for her: ahead of her to the gap in the bushes, and out. */
  *goHome(gate) {
    const a = this.a;
    const me = this.fox;
    this.came = false;
    a.mood.tailUp = 0.3;
    yield* this.goTo(gate.x, gate.z, { speed: 'trot', stop: 0.25, timeout: 8 });
    me.away = true;
    const out = this.landAt(gate.x + Math.sin(gate.yaw) * 1.5, gate.z + Math.cos(gate.yaw) * 1.5);
    yield* this.goTo(out.x, out.z, { speed: 'trot', stop: 0.25, timeout: 6, beyond: true });
    yield* this.wait(30);
  }

  // ---------------------------------------------------------------- the others

  /** A fox it does not know has come too close: down, ears back, eyes on it. */
  *wary(o) {
    const a = this.a;
    const w = this.w;
    yield* this.turnTo(this.angleTo(o), 7);
    a.setPose('crouch', 6);
    a.mood.ears = 0.8;
    this.lookAt(o, 0.9);
    if (w.time - (this.warned || -99) > 14) {
      this.warned = w.time;
      this.say(w.host.catLine('wary'), 2200);
    }
    for (let t = 0; t < 6 && this.distTo(o) < 0.95 && !o.brain.asleep; ) {
      const dt = yield;
      t += dt;
      this.facing(o, dt);
    }
    a.mood.ears = 0;
    a.setPose('sit', 4);
    yield* this.wait(0.8);
    if (w.visitor) yield* this.heel(rand(1, 2));
  }

  /** (Turning after something as it moves.) */
  facing(o, dt) {
    const a = this.a;
    a.yaw += clamp(wrapAngle(this.angleTo(o) - a.yaw), -4 * dt, 4 * dt);
  }

  /** A fox it knows has come up for a sniff. */
  *noseBack(o) {
    const a = this.a;
    yield* this.turnTo(this.angleTo(o), 5);
    this.lookAt(o, 0.6);
    a.mood.eyes = 'happy';
    yield* this.nose(o, rand(1.4, 2));
    a.mood.eyes = 'open';
    a.setPose('sit', 5);
    yield* this.wait(0.6);
  }

  /** Its nose up to `o`'s. */
  *nose(o, sec, until = null) {
    const a = this.a;
    const at = V();
    for (let t = 0; t < sec && !(until && until()); ) {
      t += yield;
      a.noseY = clamp(o.anim.nosePoint(at).y / this.S, 0.08, 0.62) + Math.max(0, Math.sin(t * 15)) * 0.008;
    }
    a.noseY = null;
  }

  /** Stroked by her (keeper.js: petOne): it waits for her hand and leans into it, eyes shut, purring. */
  *strokedBy(o) {
    const a = this.a;
    const w = this.w;
    const hers = () => o.brain.doing === 'petOne' && o.brain.target === this.fox;
    this.target = o;
    a.setPose('sit', 6);
    this.lookAt(o, 0.9);
    yield;
    for (let t = 0; hers() && !o.brain.stroking && t < 10; ) t += yield;
    if (!hers() || !o.brain.stroking) return;
    a.setPose('pet', 5);
    a.mood.eyes = 'happy';
    a.lookW = 0.3;
    this.say(w.host.catLine('purr'), 2400);
    w.host.sound('purr');
    while (hers() && o.brain.stroking) yield;
    a.mood.eyes = 'open';
    a.setPose('sit', 5);
    yield* this.wait(0.8);
  }

  /** With a fox (catlife.js has the fox's side, and what happens when). */
  *metBy(s) {
    const a = this.a;
    const w = this.w;
    const f = s.fox;
    const live = () => s.on && w.foxes.includes(f);
    // (she has brought them together: to where they will be seen best, side on. Of their own accord, it just turns to it.)
    const turn = (dt) => s.spot || this.facing(f, dt);
    this.target = f;
    this.skip = f;
    if (s.spot) {
      yield* this.goTo(s.spot.x, s.spot.z, { speed: 'walk', stop: 0.07, timeout: 5, skip: f });
      yield* this.turnTo((s.spot.dir * Math.PI) / 2, 6);
      s.set = true;
    } else yield* this.turnTo(this.angleTo(f), 7);
    this.lookAt(f, 0.9);
    if (s.level === 0) {
      a.setPose('crouch', 6);
      a.mood.ears = 0.8;
      this.say(w.host.catLine('wary'), 2200);
      while (live() && s.beat !== 'touch') turn(yield);
      // …it holds still. A nose. And away!
      a.setPose('stand', 5);
      a.mood.ears = 0.4;
      yield* this.nose(f, 1.1, () => !live());
      yield* this.jumpBack();
      a.setPose('sit', 6);
      a.mood.ears = 0.25;
      this.lookAt(f, 0.9);
      this.say(w.host.catLine('startle'), 2200);
      w.host.sound('meow');
      while (live() && !s.over) yield;
      a.mood.ears = 0;
      return void (yield* this.wait(0.5));
    }
    if (s.level === 1) {
      a.setPose('sit', 5);
      while (live() && s.beat !== 'touch') turn(yield);
      a.setPose('stand', 5);
      yield* this.nose(f, 4, () => !live() || s.beat === 'bow');
      a.setPose('crouch', 6);
      a.mood.wiggle = 0.8;
      while (live() && s.beat === 'bow') turn(yield);
      a.mood.wiggle = 0;
      a.setPose('stand', 8);
      a.mood.tailUp = 0.3;
      const heels = () => this.beside(f, Math.PI, 0.45 * f.rig.scale + 0.3);
      while (live() && s.beat === 'run') {
        yield* this.goTo(0, 0, { speed: 'run', stop: 0.2, timeout: 1, skip: f, moving: heels });
        yield;
      }
      a.mood.tailUp = 0;
      if (live()) {
        // its tail! a pounce, and a paw at it
        const tip = this.beside(f, Math.PI, 0.5 * f.rig.scale + 0.1);
        yield* this.turnTo(Math.atan2(tip.x - a.pos.x, tip.z - a.pos.z), 8);
        yield* this.leap(tip, 0.16);
        this.say(w.host.catLine('fox_tag'), 2000);
        a.setPose('sit', 6);
        for (let t = 0; t < 1.4; ) {
          t += yield;
          a.lift[0] = 0.1 * Math.max(0, Math.sin(t * 9));
        }
        a.still();
        w.fx.emit('💗', this.headTop(), { size: 0.1, rise: 0.4, life: 1.2 });
      }
      while (live() && !s.over) yield;
      return void (yield* this.wait(0.3));
    }
    // it comes round the fox that has lain down, tail up, leaning into it — and curls up against it
    a.setPose('sit', 5);
    while (live() && s.beat !== 'rub') turn(yield);
    if (!live()) return;
    a.setPose('stand', 6);
    a.mood.tailUp = 0.6;
    a.mood.eyes = 'happy';
    this.say(w.host.catLine('fox_nap'), 2400);
    const from = this.angleFrom(f);
    const at = w.time;
    const dir = Math.random() < 0.5 ? 1 : -1;
    const r = 0.26 * f.rig.scale + 0.2;
    yield* this.goTo(0, 0, {
      speed: 'walk',
      stop: 0.04,
      timeout: 3.6,
      skip: f,
      moving: () => {
        const ang = from + dir * (w.time - at) * 1.4;
        return this.clampPoint(f.anim.pos.x + Math.sin(ang) * r, f.anim.pos.z + Math.cos(ang) * r, 1);
      },
    });
    w.fx.emit('💗', this.headTop(), { size: 0.1, rise: 0.4, life: 1.2 });
    a.mood.tailUp = 0;
    // (into the curve of it, on the side of whoever is looking on: the fox lies round it)
    const snug = () => {
      const ang = Math.atan2(w.camera.position.x - f.anim.pos.x, w.camera.position.z - f.anim.pos.z);
      const d = 0.3 * f.rig.scale + 0.08;
      return this.clampPoint(f.anim.pos.x + Math.sin(ang) * d, f.anim.pos.z + Math.cos(ang) * d, 1);
    };
    yield* this.goTo(0, 0, { speed: 'walk', stop: 0.05, timeout: 4, skip: f, moving: snug });
    yield* this.turnTo(this.toCamera() + rand(-0.35, 0.35), 3.5);
    this.watch = null;
    a.look = null;
    a.lookW = 0;
    a.setPose('sleep', 2.5);
    a.mood.eyes = 'sleep';
    a.mood.breath = 0.55;
    s.beat = 'snug';
    for (let t = 0, z = 2.2, h = 1; live() && f.brain.doing === 'meetCat'; ) {
      t += yield;
      if (t > z) {
        z = t + rand(3.5, 5.5);
        w.fx.emit('💤', this.headTop(), { size: 0.09, rise: 0.3, life: 1.6 });
      }
      if (t > h) {
        h = t + rand(2.4, 4);
        w.fx.emit('💗', this.headTop(), { size: 0.09, rise: 0.35, life: 1.2 });
      }
    }
    a.mood.eyes = 'open';
    a.mood.breath = 1;
    a.setPose('sit', 3);
    yield* this.wait(0.8);
  }

  /** …with a start: a little way back, in the air, still facing what gave it the fright. */
  *jumpBack() {
    const a = this.a;
    const from = a.pos.clone();
    const to = this.clampPoint(a.pos.x - Math.sin(a.yaw) * 0.26, a.pos.z - Math.cos(a.yaw) * 0.26, 0.97);
    a.setPose('leap', 14);
    a.noseY = null;
    for (let t = 0; t < 0.34; ) {
      t += yield;
      const k = Math.min(1, t / 0.34);
      a.pos.lerpVectors(from, to, k);
      a.air = 4 * 0.11 * k * (1 - k);
    }
    a.air = 0;
    a.pos.copy(to);
  }

  /** She is taking pictures: to its place at the end of the row, sitting, eyes on the camera. */
  *poseForPicture() {
    const a = this.a;
    const w = this.w;
    this.close = true;
    let settled = false;
    let dt = 0.016;
    while (w.photoOn) {
      const at = w.photoSpot(this.fox);
      if (!settled || Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.16) {
        a.setPose('stand', 8);
        a.lookW = 0;
        yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.08, timeout: 6 });
        yield* this.turnTo(this.toCamera(), 7);
        settled = true;
      }
      a.yaw += clamp(wrapAngle(this.toCamera() - a.yaw), -3 * dt, 3 * dt);
      a.setPose(w.pose === 'lie' ? 'lie' : 'sit', 6);
      a.mood.eyes = w.pose === 'smile' ? 'happy' : 'open';
      this.lookAtYou(1);
      dt = yield;
    }
    a.mood.eyes = 'open';
  }
}
