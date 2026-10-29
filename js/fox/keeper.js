// What Lorelei does — the girl the foxes belong to (lorelei.js is how she looks and moves).
// She has a fox's brain for getting about: the same way of walking to a place round what
// stands in the yard and round the foxes, of turning, waiting, looking. What she does with it
// is her own: she strolls about the yard, kneels down by a fox and strokes it, calls one over,
// sits a while (and a fox comes and lies against her), stretches. When the foxes are fed it is
// she who brings the food to the bowl; when they are played with, she throws the ball. She
// waves when someone comes to see them, and when a fox sets off exploring; she is in the
// family picture; she puts up an umbrella in the rain, sways to a cover, dozes at night.
//
// To the rest of the world she is one more creature in the yard: `world.owner`, with a `rig`,
// an `anim` and this as her `brain` — so a fox can follow her, visit her, snuggle up to her as
// it would another fox.
import { Brain } from './brain.js';
import { V, clamp, TAU } from './kit.js';
import { wrapAngle } from './animator.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
// what she can be called away from by a fox that wants something of her
const IDLE = new Set(['linger', 'amble', 'sitAwhile', 'stretchUp']);
const HAIL_WAIT = 40; // seconds she waits to be tapped when she has something to say (hailYou)
// which of her poses goes with each way the family can pose for a picture (js/pet.js: PHOTO_POSES)
const PICTURE = { sit: 'peace', smile: 'cheer', lie: 'sit', bow: 'peace', proud: 'proud', mix: 'peace' };

export class Keeper extends Brain {
  constructor(world, me) {
    super(world, me);
    this.pace = 1.5; //     (her size on the ground is a fox's: this makes her stroll and her jog a girl's)
    this.tall = me.rig.size; // how large she is drawn: what she reaches, and how near she comes, goes by it
    this.stroking = false; // her hand is on the fox she knelt down by
    this.hello = 0; //      when she last said something to whoever is looking on
    this.side = 1; //       where she stands by the others (1: on their left; a visitor from the house takes the other side, visitor.js)
  }

  /** The foxes' games are not for her. */
  get free() {
    return false;
  }

  /** Nothing she could not leave off for a fox. */
  get idle() {
    return !this.asleep && !this.w.showcaseOn && !this.w.photoOn && IDLE.has(this.doing);
  }

  begin(name, args) {
    super.begin(name, args);
    const a = this.a;
    a.mood.smile = 0;
    a.mood.blush = 0;
    a.reach = null;
    a.holds = null;
    this.stroking = false;
  }

  update(dt) {
    // her umbrella goes up with the first drops, and down when it is over — or while her hands are full (world.present:
    // the parcel, a fox she is showing)
    const g = this.doing === 'presentIt' ? this.w.gifting : null;
    const full = !!g && (g.step === 'show' || g.step === 'give' || g.step === 'open' || (g.step === 'meet' && g.t < 2.8));
    this.a.umbrella = this.w.sky.rain > 0.2 && !full;
    super.update(dt);
  }

  /** As a fox is kept in the yard and out of what stands in it — and she does not walk over the foxes' bed. */
  keepInside() {
    super.keepInside();
    if (this.a.air > 0.02) return;
    const bed = this.w.things.bed.object;
    const p = this.a.pos;
    const r = this.w.things.bed.radius * bed.scale.x + 0.12 * this.tall;
    const d = Math.hypot(p.x - bed.position.x, p.z - bed.position.z);
    if (d >= r) return;
    const b = this.w.env.bounds;
    const ang = d > 0.01 ? Math.atan2(p.x - bed.position.x, p.z - bed.position.z) : Math.atan2(b.cx - bed.position.x, b.cz - bed.position.z);
    const step = Math.min(r - d, 0.02 + (r - d) * 0.3);
    p.x += Math.sin(ang) * step;
    p.z += Math.cos(ang) * step;
  }

  // ---------------------------------------------------------------- choosing

  choose() {
    const w = this.w;
    const st = w.state;
    if (w.photoOn) return ['poseForPicture'];
    if (w.showcaseOn) return ['standBy'];
    if (w.tune && w.tune.on) return [st.mood === 'sleepy' ? 'sleep' : 'swayAlong'];
    if (st.mood === 'sleepy') return ['sleep'];
    if (w.gazing === 'moon') return ['moonGaze'];
    const sky = w.sky;
    if (sky.sand > 0.25) return ['braveWind'];
    const wet = sky.rain > 0.2 || sky.wet > 0.4; // (nobody kneels in a puddle)
    const table = [];
    const add = (name, weight, ...args) => weight > 0 && table.push([name, weight, args]);
    add('linger', 2);
    add('amble', 2.2);
    add('stretchUp', 0.45);
    add('sitAwhile', wet ? 0 : 1.3);
    const one = wet ? null : this.foxToPet();
    if (one) {
      add('petOne', 1.3, one);
      add('callOne', 0.5, one);
    }
    table.forEach((row) => row[0] === this.last && (row[1] *= 0.3));
    let pick = Math.random() * table.reduce((s, row) => s + row[1], 0);
    const row = table.find((x) => (pick -= x[1]) < 0) || table[0];
    this.last = row[0];
    return [row[0], row[2]];
  }

  /** A fox that would hold still for her: in the yard, awake, with nothing much to do — the nearer the likelier. */
  foxToPet() {
    let best = null;
    let top = 0;
    for (const f of this.w.foxes) {
      const b = f.brain;
      if (b.asleep || b.stray || b.using || b.sheltered || f.anim.air > 0.02 || !(b.free || (b.doing === 'strokedBy' && b.target === this.fox))) continue; // (not one the other girl is stroking)
      const v = (0.4 + Math.random()) / (0.6 + this.distTo(f));
      if (v > top) {
        top = v;
        best = f;
      }
    }
    return best;
  }

  // ---------------------------------------------------------------- on her own

  /** Standing about: a look at a fox, at the sky, at whoever is looking on. */
  *linger(sec = rand(2.5, 5)) {
    const a = this.a;
    // (not with her back to whoever is looking on, for long)
    if (Math.abs(wrapAngle(this.toCamera() - a.yaw)) > 1.25) yield* this.turnTo(this.toCamera() + rand(-0.8, 0.8), 3.5);
    this.loose = true;
    a.setPose('stand', 5);
    let t = 0;
    let next = 0;
    const at = V();
    while (t < sec) {
      const dt = yield;
      t += dt;
      if (t < next) continue;
      next = t + rand(1.2, 2.4);
      const pick = Math.random();
      const fox = this.w.foxes[Math.floor(Math.random() * this.w.foxes.length)];
      a.mood.smile = 0;
      if (pick < 0.4 && fox) {
        this.lookAt(fox, 0.9);
        a.mood.smile = 1;
      } else if (pick < 0.8) this.lookAtYou(0.85);
      else {
        const ang = a.yaw + rand(-1.2, 1.2);
        at.set(a.pos.x + Math.sin(ang) * 2, rand(0.5, 1.6), a.pos.z + Math.cos(ang) * 2);
        this.watch = null;
        a.look = at;
        a.lookW = 0.8;
      }
    }
  }

  /** A stroll to somewhere else in the yard. */
  *amble() {
    const p = this.randomPoint(0.8);
    yield* this.goTo(p.x, p.z, { speed: 'walk', stop: 0.1, timeout: 12 });
    yield* this.linger(rand(1, 2.2));
  }

  /** Arms up, a long stretch on her toes. */
  *stretchUp() {
    const a = this.a;
    yield* this.turnTo(this.toCamera() + rand(-0.6, 0.6), 4);
    a.setPose('stretch', 3.5);
    a.mood.eyes = 'closed';
    yield* this.wait(1.7);
    a.mood.eyes = 'open';
    a.mood.smile = 1;
    a.setPose('stand', 4);
    yield* this.wait(0.9);
  }

  /** Down on her knees for a while, watching the foxes. (One of them may come and lie against her: brain.js, snuggle.) */
  *sitAwhile(sec = rand(8, 14)) {
    const a = this.a;
    yield* this.settle();
    yield* this.turnTo(this.toCamera() + rand(-0.6, 0.6), 4);
    a.setPose('sit', 4);
    yield* this.wait(0.8);
    let t = 0;
    let next = 0;
    while (t < sec) {
      const dt = yield;
      t += dt;
      if (t < next) continue;
      next = t + rand(1.5, 3);
      // whoever has come up close gets her eyes, and a smile
      const near = this.w.foxes.filter((f) => this.distTo(f) < 0.8).sort((p, q) => this.distTo(p) - this.distTo(q))[0];
      const fox = near || this.w.foxes[Math.floor(Math.random() * this.w.foxes.length)];
      a.mood.smile = near ? 1 : 0;
      a.mood.eyes = near && Math.random() < 0.5 ? 'happy' : 'open';
      if (fox && (near || Math.random() < 0.6)) this.lookAt(fox, 0.9);
      else this.lookAtYou(0.8);
    }
    a.mood.eyes = 'open';
    a.setPose('stand', 4);
    yield* this.wait(0.7);
  }

  /** A wind full of sand: an arm before her face until it is over. */
  *braveWind() {
    const a = this.a;
    yield* this.turnTo(0.6, 4); // (her back half to it: it blows from the west)
    a.setPose('shield', 5);
    a.mood.eyes = 'closed';
    while (this.w.sky.sand > 0.25) yield;
    a.mood.eyes = 'open';
    a.setPose('stand', 4);
    yield* this.wait(0.6);
  }

  // ---------------------------------------------------------------- with the foxes

  /** Where to kneel by a fox: at its side (`left` = 1 or -1), a little ahead, so that her hand comes to its head; she then faces it. */
  kneelBy(fox, left) {
    const f = fox.anim;
    const gap = 0.2 * fox.rig.scale + 0.25 * this.tall;
    const ang = f.yaw + left * 1.15;
    return this.clampPoint(f.pos.x + Math.sin(ang) * gap, f.pos.z + Math.cos(ang) * gap, 1);
  }

  /** Over to a fox, down on her knees beside it, and her hand goes over its head and back, again and again. */
  *petOne(fox = this.foxToPet()) {
    if (!fox) return void (yield* this.linger());
    const a = this.a;
    const w = this.w;
    this.target = fox;
    this.stroking = false;
    fox.brain.do('strokedBy', this.fox); // it waits for her
    this.lookAt(fox, 0.8);
    a.mood.smile = 1;
    // (to its left or its right, whichever she comes from)
    const left = Math.sin(fox.anim.yaw - Math.atan2(a.pos.x - fox.anim.pos.x, a.pos.z - fox.anim.pos.z)) < 0 ? 1 : -1;
    yield* this.goTo(0, 0, { speed: this.distTo(fox) > 1.4 ? 'trot' : 'walk', stop: 0.1, timeout: 8, skip: fox, moving: () => this.kneelBy(fox, left) });
    if (!w.foxes.includes(fox) || this.distTo(fox) > 0.5 + 0.3 * this.tall || fox.brain.doing !== 'strokedBy') return; // it was called away
    this.skip = fox;
    yield* this.turnTo(this.angleTo(fox), 6);
    a.setPose('pet', 5);
    yield* this.wait(0.55);
    const head = V();
    const at = V();
    const sec = rand(3.5, 6);
    let heart = 0.3;
    this.stroking = true;
    for (let t = 0; t < sec && w.foxes.includes(fox) && fox.brain.doing === 'strokedBy'; ) {
      t += yield;
      // from between its ears back over its neck
      fox.anim.headPoint(head);
      const back = 0.5 - 0.5 * Math.cos(t * 4.2);
      at.set(head.x - Math.sin(fox.anim.yaw) * 0.09 * fox.rig.scale * back, head.y + 0.012 - 0.03 * fox.rig.scale * back, head.z - Math.cos(fox.anim.yaw) * 0.09 * fox.rig.scale * back);
      a.reach = { side: 'R', point: at };
      a.mood.eyes = t > 1.2 && Math.sin(t * 0.9) > 0.2 ? 'happy' : 'open';
      if (t > heart) {
        heart = t + rand(0.8, 1.3);
        w.fx.emit(['💗', '💕', '✨'][Math.floor(Math.random() * 3)], head, { n: 2, spread: 0.14, rise: 0.5, life: 1.1, size: 0.12 });
      }
    }
    this.stroking = false;
    a.reach = null;
    a.mood.eyes = 'open';
    this.skip = null;
    yield* this.wait(0.5);
    a.setPose('stand', 4);
    yield* this.wait(0.8);
  }

  /** "Come here!" — a wave to a fox across the yard; it comes running, and is stroked for it. */
  *callOne(fox = this.foxToPet()) {
    if (!fox || this.distTo(fox) < 0.9) return void this.then('petOne', fox);
    const a = this.a;
    yield* this.turnTo(this.angleTo(fox), 6);
    this.lookAt(fox, 0.9);
    a.setPose('wave', 8);
    a.mood.smile = 1;
    a.mood.mouth = 0.7;
    this.say(this.w.host.ownerLine('call', fox.id), 2400);
    const to = this.beside(this.fox, 0, 0.5); // (half a step in front of her)
    if (fox.brain.free) fox.brain.do('comeTo', to.x, to.z);
    for (let t = 0; t < 1.1; ) {
      t += yield;
      a.add.eR = Math.sin(t * 11) * 0.35;
    }
    a.still();
    a.mood.mouth = 0;
    a.setPose('stand', 6);
    for (let t = 0; t < 4 && this.distTo(fox) > 0.8 && fox.brain.doing === 'comeTo'; ) t += yield;
    if (this.distTo(fox) < 1.1) this.then('petOne', fox);
  }

  /** The side of the bowl to pour from: wherever no fox has its place. */
  byBowl() {
    const w = this.w;
    const bowl = w.things.bowl;
    const c = bowl.object.position;
    const d = bowl.radius * bowl.object.scale.x + 0.24 * this.tall;
    const places = w.foxes.map((f) => f.brain.besideBowl());
    let best = null;
    let top = -1;
    for (let k = 0; k < 12; k++) {
      const ang = (k / 12) * TAU;
      const p = V(c.x + Math.sin(ang) * d, 0, c.z + Math.cos(ang) * d);
      if (!this.inYard(p, 1) || this.blocked(p, 0.1, bowl)) continue;
      // (as far from the foxes' places as can be — and rather from behind the bowl, so that she is seen from in front)
      const v = places.reduce((m, q) => Math.min(m, Math.hypot(q.x - p.x, q.z - p.z)), 2) - 0.12 * Math.cos(ang);
      if (v > top) {
        top = v;
        best = p;
      }
    }
    return best || this.clampPoint(c.x, c.z - d, 1);
  }

  /** The foxes are fed: she carries the bag to the bowl and tips it out (only then is there anything in it — world.serving). */
  *serve() {
    const a = this.a;
    const w = this.w;
    const bowl = w.things.bowl;
    const c = bowl.object.position;
    this.close = true;
    a.holds = 'bag';
    a.setPose('carry', 9);
    a.mood.smile = 1;
    if (Math.random() < 0.7) this.say(w.host.ownerLine('feed'), 2200);
    const at = this.byBowl();
    const far = Math.hypot(at.x - a.pos.x, at.z - a.pos.z);
    yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.07, timeout: 3 + far * 1.2, ignore: bowl });
    yield* this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), 8);
    a.look = c;
    a.lookW = 0.8;
    a.setPose('pour', 8);
    yield* this.wait(0.4);
    w.fillBowl();
    const hand = V();
    for (let t = 0, next = 0; t < 0.75; ) {
      t += yield;
      if (t < next) continue;
      next = t + 0.09;
      a.handPoint('R', hand);
      w.fx.emit('🟤', hand.lerp(c, 0.35).setY(hand.y - 0.05), { n: 2, spread: 0.035, rise: -0.1, life: 0.42, size: 0.035, gravity: 2.4 });
    }
    a.setPose('carry', 6);
    yield* this.wait(0.45);
    a.holds = null;
    a.setPose('stand', 5);
    // a step back, and she watches them eat
    const back = this.clampPoint(a.pos.x - Math.sin(a.yaw) * 0.45 * this.tall, a.pos.z - Math.cos(a.yaw) * 0.45 * this.tall, 0.98);
    yield* this.goTo(back.x, back.z, { speed: 'walk', stop: 0.1, timeout: 3 });
    yield* this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), 5);
    a.look = c;
    a.lookW = 0.7;
    a.mood.smile = 1;
    for (let t = 0; t < 7 && w.feast; ) {
      t += yield;
      a.mood.eyes = Math.sin(t * 1.1) > 0.55 ? 'happy' : 'open';
    }
    a.mood.eyes = 'open';
  }

  /** The foxes are played with: she draws back her arm and throws the ball across the yard (world.pitching, until it flies). */
  *tossBall() {
    const a = this.a;
    const w = this.w;
    const ball = w.things.ball;
    // across the yard, to where there is room for it to land
    let to = this.randomPoint(0.75);
    for (let k = 0; k < 6; k++) {
      const p = this.randomPoint(0.75);
      const want = (q) => Math.abs(Math.hypot(q.x - a.pos.x, q.z - a.pos.z) - 1.9);
      if (want(p) < want(to)) to = p;
    }
    this.watch = null;
    a.lookW = 0;
    yield* this.turnTo(Math.atan2(to.x - a.pos.x, to.z - a.pos.z), 9);
    a.setPose('windup', 10);
    a.mood.smile = 1;
    const hand = V();
    ball.object.visible = true;
    const hold = () => ball.object.position.copy(a.handPoint('R', hand));
    for (let t = 0; t < 0.42; ) {
      t += yield;
      hold();
    }
    if (Math.random() < 0.7) this.say(w.host.ownerLine('play'), 1800);
    a.setPose('fling', 18);
    a.mood.mouth = 0.8;
    for (let t = 0; t < 0.11; ) {
      t += yield;
      hold();
    }
    w.throwBall(a.handPoint('R', hand), to);
    yield* this.wait(0.45);
    a.mood.mouth = 0;
    a.setPose('stand', 5);
    a.look = ball.object.position;
    a.lookW = 0.85;
    for (let t = 0; t < 9 && w.foxes.some((f) => f.brain.busyWith('playBall')); ) t += yield;
    yield* this.clapHands(1.2);
  }

  /** A fox sets off exploring (or somebody is to be waved at): she waves after it. */
  *waveAt(o) {
    const a = this.a;
    const face = () => (o ? this.angleTo(o) : this.toCamera());
    yield* this.turnTo(face(), 6);
    if (o) this.lookAt(o, 0.9);
    else this.lookAtYou(1);
    a.setPose('wave', 8);
    a.mood.smile = 1;
    for (let t = 0; t < 2.6 && !(o && o.gone); ) {
      t += yield;
      a.add.eR = Math.sin(t * 10) * 0.36;
      if (Math.abs(wrapAngle(face() - a.yaw)) > 0.6) a.yaw += clamp(wrapAngle(face() - a.yaw), -0.05, 0.05);
    }
    a.still();
    a.setPose('stand', 5);
    yield* this.wait(0.5);
  }

  /** Something good happened: she claps her hands. */
  *clapHands(sec = 1.6) {
    const a = this.a;
    yield* this.turnTo(this.toCamera(), 7);
    this.lookAtYou(0.9);
    a.setPose('clap', 9);
    a.mood.smile = 1;
    a.mood.eyes = 'happy';
    for (let t = 0; t < sec; ) {
      t += yield;
      const k = Math.max(0, Math.sin(t * 15));
      a.add.aLo = a.add.aRo = 0.16 * k;
      a.add.hy = 0.006 * k;
    }
    a.still();
    a.mood.eyes = 'open';
    a.setPose('stand', 5);
    yield* this.wait(0.5);
  }

  // ---------------------------------------------------------------- with whoever is looking on

  /** Somebody has come to see the foxes (or has tapped her): she turns, waves, and may say something. (`after`: not before the view has opened.) */
  *helloYou(line, after = 0) {
    const a = this.a;
    if (after) yield* this.wait(after);
    yield* this.turnTo(this.toCamera(), 8);
    this.lookAtYou(1);
    a.setPose('wave', 8);
    a.mood.smile = 1;
    if (line) {
      a.mood.mouth = 0.7;
      this.say(line, 3000);
    }
    for (let t = 0; t < 1.8; ) {
      t += yield;
      a.add.eR = Math.sin(t * 11) * 0.36;
      if (t > 0.9) a.mood.mouth = 0;
      a.mood.eyes = t > 0.5 && t < 1.5 ? 'happy' : 'open';
    }
    a.still();
    a.setPose('stand', 5);
    yield* this.wait(1.1);
  }

  /**
   * She would like a word with whoever is looking on (world.hail): to the front of the yard, a wave and a call — and
   * there she waits to be tapped, a speech mark over her head now and then. If nobody does, never mind: another time.
   */
  *hailYou(line) {
    const a = this.a;
    const w = this.w;
    const h = w.hailing;
    if (!h) return;
    this.close = true;
    const front = w.env.spots.front;
    const at = w.clearOf(this.clampPoint(front.x + 0.12, front.z - 0.55, 0.92), 0.3);
    if (Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.35) yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.1, timeout: 6 });
    if (w.hailing !== h) return;
    yield* this.turnTo(this.toCamera(), 8);
    this.lookAtYou(1);
    a.setPose('wave', 8);
    a.mood.smile = 1;
    if (line) {
      a.mood.mouth = 0.7;
      this.say(line, 3200);
    }
    w.host.onHail('call');
    for (let t = 0; t < 1.5 && w.hailing === h; ) {
      t += yield;
      a.add.eR = Math.sin(t * 11) * 0.36;
      if (t > 0.9) a.mood.mouth = 0;
    }
    a.still();
    a.mood.mouth = 0;
    a.setPose('stand', 5);
    const mark = V();
    for (let t = 0, next = 0.5, again = 11; t < HAIL_WAIT && w.hailing === h; ) {
      const dt = yield;
      t += dt;
      // she keeps facing whoever she is waiting for
      const off = wrapAngle(this.toCamera() - a.yaw);
      if (Math.abs(off) > 0.45) a.yaw += clamp(off, -2 * dt, 2 * dt);
      a.mood.smile = 1;
      if (t > again) {
        // (…and waves again now and then, in case she was not seen)
        a.setPose('wave', 8);
        a.add.eR = Math.sin(t * 11) * 0.3;
        if (t > again + 1.2) {
          a.still();
          a.setPose('stand', 5);
          again += 12;
        }
      }
      if (t < next) continue;
      next = t + 2.6;
      a.headPoint(mark).y += 0.1 * this.tall;
      w.fx.emit('💬', mark, { n: 1, spread: 0.02, rise: 0.22, life: 1.9, size: 0.24 * this.tall, drift: 0.02 });
    }
    if (w.hailing !== h) return; // (she was tapped — the conversation begins — or it was called off)
    w.hailing = null;
    w.host.onHail('gone');
    if (h.bye) this.say(h.bye, 2400);
    a.setPose('wave', 8);
    for (let t = 0; t < 1.1; ) {
      t += yield;
      a.add.eR = Math.sin(t * 11) * 0.3;
    }
    a.still();
    a.setPose('stand', 5);
    yield* this.wait(0.6);
  }

  /**
   * She has a present for whoever is looking on (world.present — the app tells the story, a step at a time). To the
   * front of the yard, a wave and a call; she says what she has to say; at its turn the parcel is in her hands, then
   * held out and put down before her, where it opens. She stays by it until the story is over.
   */
  *presentIt(line) {
    const a = this.a;
    const w = this.w;
    const g = w.gifting;
    if (!g) return;
    const box = w.parcel.object;
    this.close = true;
    // where she can be seen, with room before her
    const front = w.env.spots.front;
    const at = w.clearOf(this.clampPoint(front.x + 0.12, front.z - 0.55, 0.92), 0.3);
    if (Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.35) yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.1, timeout: 6 });
    if (w.gifting !== g) return;
    yield* this.turnTo(this.toCamera(), 8);
    this.lookAtYou(1);
    a.mood.smile = 1;
    if (line) {
      // (without one she has called already — hailYou — and was tapped: no second wave)
      a.setPose('wave', 8);
      a.mood.mouth = 0.7;
      this.say(line, 2600);
      for (let t = 0; t < 1.25 && w.gifting === g; ) {
        t += yield;
        a.add.eR = Math.sin(t * 11) * 0.36;
        if (t > 0.8) a.mood.mouth = 0;
      }
      a.still();
      a.mood.mouth = 0;
      a.setPose('stand', 5);
    }
    g.ready = true;
    w.host.onPresent('ready');

    const left = V();
    const right = V();
    const hold = () => {
      // the parcel between her hands (it is measured from its foot)
      a.handPoint('L', left);
      a.handPoint('R', right);
      box.position.copy(left).add(right).multiplyScalar(0.5);
      box.position.x += Math.sin(a.yaw) * 0.035;
      box.position.z += Math.cos(a.yaw) * 0.035;
      box.position.y -= w.parcel.height * 0.5 * box.scale.y;
      box.rotation.set(0, a.yaw, 0);
    };
    const from = V();
    let t = 0;
    let was = 'call';
    while (w.gifting === g && g.step !== 'end') {
      const dt = yield;
      t += dt;
      // she keeps facing whoever she is talking to (or, while they look up at it, the moon: world.gaze); her mouth goes while she speaks
      const off = wrapAngle((w.gazing ? this.moonward() : this.toCamera()) - a.yaw);
      if (Math.abs(off) > (w.gazing ? 0.1 : 0.45)) a.yaw += clamp(off, -2 * dt, 2 * dt);
      a.mood.mouth = g.speaking ? 0.18 + 0.55 * Math.abs(Math.sin(t * 12)) : 0;
      a.mood.smile = 1;
      if (g.step !== was) {
        was = g.step;
        if (g.step === 'show') w.fx.emit('✨', a.handPoint('R', V()).setY(0.75 * this.tall), { n: 7, spread: 0.2, rise: 0.5, life: 1, size: 0.13 });
      }
      if (g.step === 'show') {
        // there it is, in her hands
        a.setPose('carry', 8);
        box.visible = true;
        g.shown = Math.min(1, g.shown + dt * 3.2);
        box.scale.setScalar(g.shown * (1 + 0.28 * Math.sin(g.shown * Math.PI)));
        hold();
        a.mood.eyes = g.t > 0.5 && g.t < 1.6 ? 'happy' : 'open';
      } else if (g.step === 'give') {
        if (g.t < 0.55) {
          // held out…
          a.setPose('offer', 9);
          box.visible = true;
          box.scale.setScalar(1);
          hold();
          from.copy(box.position);
          g.at.set(a.pos.x + Math.sin(a.yaw) * 0.62, 0, a.pos.z + Math.cos(a.yaw) * 0.62);
          // (a fox that sits just there makes room)
          for (const f of w.foxes) {
            if (Math.hypot(f.anim.pos.x - g.at.x, f.anim.pos.z - g.at.z) < 0.42 && f.brain.doing !== 'comeTo') f.brain.do('comeTo', g.at.x + (f.anim.pos.x < g.at.x ? -0.62 : 0.62), g.at.z + 0.04);
          }
        } else if (g.t < 1.05) {
          // …and put down before her
          const k = (g.t - 0.55) / 0.5;
          const e = k * k * (3 - 2 * k);
          a.setPose('bend', 7);
          box.position.lerpVectors(from, g.at, e);
          box.position.y += 0.07 * Math.sin(Math.PI * k);
          a.look = g.at;
          a.lookW = 0.9;
        } else {
          if (!g.down) {
            g.down = true;
            box.position.copy(g.at);
            w.thump(g.at);
          }
          a.setPose('clap', 5);
          a.look = g.at;
          a.lookW = 0.6;
        }
      } else if (g.step === 'open') {
        // …it is open: a clap for whoever was in it
        a.setPose('clap', 9);
        a.mood.eyes = g.t < 2.2 ? 'happy' : 'open';
        const k = g.t < 2 ? Math.max(0, Math.sin(g.t * 15)) : 0;
        a.add.aLo = a.add.aRo = 0.16 * k;
        if (g.t > 2.6) {
          a.setPose('stand', 4);
          const fox = g.fox && w.foxes.includes(g.fox) ? g.fox : null;
          if (fox && Math.sin(t * 0.7) > 0) this.lookAt(fox, 0.9);
          else this.lookAtYou(0.9);
        }
      } else if (g.step === 'meet') {
        // "…and this is the one": a hand towards it and a look — then back to whoever she is talking to
        const fox = g.fox && w.foxes.includes(g.fox) ? g.fox : null;
        if (g.t < 2.6) {
          a.setPose('show', 7);
          // (a glance down at it, not a bow over it: her face stays to be seen)
          if (fox && g.t < 1.5) this.lookAt(fox, 0.5);
          else this.lookAtYou(1);
          a.mood.eyes = g.t > 0.7 && g.t < 1.9 ? 'happy' : 'open';
        } else {
          a.setPose('stand', 5);
          this.lookAtYou(1);
        }
      } else if (g.step === 'costume') {
        // "look at them!": a hand towards the foxes, a glance at them
        if (g.t < 2.4) {
          a.setPose('show', 7);
          if (g.t < 1.4 && w.foxes.length) this.lookAt(w.foxes[Math.floor(t * 0.8) % w.foxes.length], 0.5);
          else this.lookAtYou(1);
          a.mood.eyes = g.t > 0.5 && g.t < 1.9 ? 'happy' : 'open';
        } else {
          a.setPose('stand', 5);
          this.lookAtYou(1);
        }
      } else if (g.step === 'tree') {
        // "…and the tree": a hand towards it, a look at it — then back to whoever she is talking to
        const tree = w.tree && w.tree.object.position;
        if (g.t < 2.4) {
          a.setPose('show', 7);
          if (tree && g.t < 1.5) {
            a.look = V(tree.x, 0.8 * this.tall, tree.z);
            a.lookW = 0.6;
          } else this.lookAtYou(1);
          a.mood.eyes = g.t > 0.5 && g.t < 1.9 ? 'happy' : 'open';
        } else {
          a.setPose('stand', 5);
          this.lookAtYou(1);
        }
      } else if (g.step === 'wish') {
        // her hands together and her eyes shut: a wish (under the moon she kneels again after it)
        a.setPose(g.t < 2.6 ? 'clap' : w.gazing ? 'sit' : 'stand', 6);
        a.mood.eyes = g.t > 0.3 && g.t < 2.4 ? 'happy' : 'open';
        this.lookAtYou(1);
      } else if (g.step === 'hat' || g.step === 'treat' || g.step === 'trick') {
        // her hat — or sweets for everyone, or the trick: she claps and laughs
        a.setPose(g.step === 'treat' && g.t < 0.9 ? 'offer' : g.t < 2.2 ? 'clap' : 'stand', 8);
        a.mood.eyes = g.t < 2 ? 'happy' : 'open';
        const k = g.t > 0.4 && g.t < 2 ? Math.max(0, Math.sin(g.t * 15)) : 0;
        a.add.aLo = a.add.aRo = 0.16 * k;
        this.lookAtYou(1);
      } else if (g.step === 'gaze') {
        // "look!": a hand up towards the moon — then down on her knees with the foxes, looking at it (she is twice
        // their height: standing, she would be all there is to see)
        a.setPose(g.t < 2.2 ? 'show' : 'sit', 5);
        a.mood.eyes = g.t > 0.5 && g.t < 1.9 ? 'happy' : 'open';
      } else if (g.step === 'howl') {
        // the foxes sing to it: she listens, smiling
        a.setPose('sit', 5);
        a.mood.eyes = g.t > 0.8 && g.t < 4 ? 'happy' : 'open';
      } else if (g.step === 'wave') {
        if (g.t < 1.7) {
          a.setPose('wave', 8);
          a.add.eR = Math.sin(g.t * 11) * 0.36;
          a.mood.eyes = g.t > 0.4 && g.t < 1.4 ? 'happy' : 'open';
        } else {
          a.still();
          a.setPose('stand', 5);
        }
      }
      if (w.gazing) this.lookAtMoon(0.9); // (whatever she does meanwhile, under the moon her eyes are on it)
    }
    a.still();
    a.mood.mouth = 0;
    a.mood.eyes = 'open';
    a.setPose('stand', 5);
    yield* this.wait(0.4);
  }

  /** She looks up at the night sky (world.gaze): Lorelei comes and stands at the end of the foxes' row, and looks up at the moon with them. */
  *moonGaze() {
    const a = this.a;
    const w = this.w;
    const g = w.gazeView;
    if (!g) return;
    this.close = true;
    const dx = Math.sin(g.az);
    const dz = -Math.cos(g.az);
    // (a little further off than the foxes, kneeling: she is twice as tall as they are)
    const out = (-0.46 - 0.16 * Math.min(4, w.foxes.length)) * this.side;
    const to = w.clearOf(this.clampPoint(g.x + dz * -out + dx * 0.6, g.z + dx * out + dz * 0.6, 0.92), 0.3);
    if (Math.hypot(to.x - a.pos.x, to.z - a.pos.z) > 0.2) yield* this.goTo(to.x, to.z, { speed: 'walk', stop: 0.1, timeout: 7 });
    yield* this.turnTo(this.moonward() + 0.15 * this.side, 4);
    a.setPose('sit', 4);
    this.lookAtMoon(0.9);
    for (let t = 0; w.gazing; ) {
      t += yield;
      a.mood.smile = 1;
      a.mood.eyes = t % 7 > 5.6 && t % 7 < 6.6 ? 'happy' : 'open';
    }
    a.mood.eyes = 'open';
    a.setPose('stand', 4);
  }

  /** She is taking pictures: Lorelei stands behind the foxes — or beside the only one — and poses with them. */
  *poseForPicture() {
    const a = this.a;
    const w = this.w;
    this.close = true;
    let pose = '';
    let settled = false;
    let dt = 0.016;
    while (w.photoOn) {
      const at = w.photoSpot(this.fox);
      if (!settled || Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.16) {
        a.setPose('stand', 8);
        a.air = 0;
        a.lookW = 0;
        yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.08, timeout: 6 });
        yield* this.turnTo(this.toCamera(), 7);
        settled = true;
        pose = '';
      }
      // the camera goes round them: she keeps facing it
      const off = wrapAngle(this.toCamera() - a.yaw);
      a.yaw += clamp(off, -3 * dt, 3 * dt);
      const want = w.pose;
      if (want !== pose) {
        pose = want;
        a.air = 0;
        this.lookAtYou(1);
        a.mood.smile = 1;
        a.mood.eyes = pose === 'smile' || pose === 'bow' ? 'happy' : 'open';
        a.mood.mouth = pose === 'smile' ? 0.8 : 0;
        if (pose !== 'jump') a.setPose(PICTURE[pose] || 'peace', 7);
      }
      if (pose === 'jump') {
        // all together, again and again
        const k = (w.time % 1.25) / 0.44;
        a.air = k < 1 ? 4 * 0.2 * this.tall * k * (1 - k) : 0;
        a.setPose(k < 1 ? 'hop' : 'cheer', 14);
        a.mood.eyes = 'happy';
        a.mood.mouth = 0.8;
      }
      dt = yield;
    }
    a.air = 0;
  }

  /** The shop is open on the foxes: she stands back and looks on. */
  *standBy() {
    const a = this.a;
    const w = this.w;
    const b = w.env.bounds;
    const at = this.clampPoint(b.cx - 0.9 * this.side, b.cz - 0.98, 0.95);
    if (Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.25) yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.1, timeout: 6 });
    yield* this.turnTo(Math.atan2(b.cx - a.pos.x, b.cz + 0.1 - a.pos.z), 5);
    a.mood.smile = 1;
    for (let t = 0, next = 0; w.showcaseOn; ) {
      t += yield;
      if (t < next) continue;
      next = t + rand(1.5, 3);
      if (w.focus && Math.random() < 0.7) this.lookAt(w.focus, 0.9);
      else this.lookAtYou(0.8);
    }
  }

  /** One of her covers is playing: by the side of the radio she sways to it, and claps on the beat. */
  *swayAlong() {
    const a = this.a;
    const w = this.w;
    const radio = w.things.radio.object.position;
    const at = this.clampPoint(radio.x - 0.75 * this.side, radio.z - 0.06, 0.98);
    this.close = true;
    if (Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.2) yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.09, timeout: 7 });
    yield* this.turnTo(this.toCamera(), 6);
    this.lookAtYou(0.8);
    a.setPose('clap', 5);
    a.mood.smile = 1;
    let T;
    while ((T = w.tune) && T.on && !w.photoOn && !w.showcaseOn) {
      const dt = yield;
      a.still();
      const beat = T.ready ? T.beat : w.time * 1.8;
      const swing = Math.sin(beat * Math.PI);
      const hit = Math.pow(Math.max(0, Math.cos(beat * TAU)), 6); // the moment of each beat
      a.add.tilt = 0.07 * swing;
      a.add.srz = -0.06 * swing;
      a.add.hdz = 0.1 * swing;
      a.add.hy = -0.012 * hit;
      a.add.kL = a.add.kR = 0.18 * hit;
      a.add.tL = a.add.tR = 0.09 * hit;
      a.add.aLo = a.add.aRo = 0.17 * (1 - hit);
      a.mood.eyes = Math.sin(beat * 0.39) > 0.6 ? 'happy' : 'open';
      // (pushed off her place: back to it)
      if (Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.4) {
        a.still();
        yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.09, timeout: 4 });
        yield* this.turnTo(this.toCamera(), 6);
        this.lookAtYou(0.8);
        a.setPose('clap', 5);
      } else a.yaw += clamp(wrapAngle(this.toCamera() - a.yaw), -2 * dt, 2 * dt);
    }
    a.still();
    a.mood.eyes = 'open';
  }

  // ---------------------------------------------------------------- at night

  /** Night: down on her knees by the foxes' bed, and she nods off. */
  *sleep() {
    const a = this.a;
    const w = this.w;
    const bed = w.things.bed.object.position;
    const b = w.env.bounds;
    // beside the bed, on the side of the middle of the yard
    const ang = Math.atan2(b.cx - bed.x, b.cz - bed.z) + 0.9;
    const d = w.things.bed.radius * w.things.bed.object.scale.x + 0.36 * this.tall;
    const at = w.clearOf(this.clampPoint(bed.x + Math.sin(ang) * d, bed.z + Math.cos(ang) * d, 0.96), 0.3);
    if (Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.3) yield* this.goTo(at.x, at.z, { speed: 'walk', stop: 0.1, timeout: 9 });
    yield* this.turnTo(this.toCamera() + rand(-0.4, 0.4), 4);
    a.lookW = 0;
    a.setPose('sit', 4);
    yield* this.wait(1.2);
    a.setPose('doze', 1.6);
    a.mood.eyes = 'closed';
    a.mood.breath = 0.6;
    this.asleep = true;
    let t = 0;
    let z = 2.5;
    while (w.state.mood === 'sleepy') {
      t += yield;
      a.add.hdx = 0.07 * Math.sin(t * 0.8) + 0.05 * Math.max(0, Math.sin(t * 0.31));
      if (t > z) {
        z = t + rand(3.2, 5);
        w.fx.emit('💤', a.headPoint(V()), { size: 0.15, rise: 0.22, life: 2.2, drift: 0.12 });
      }
    }
  }

  /** Woken (it is morning; or the foxes are fed in the middle of the night): eyes open, up, a stretch. */
  *wake() {
    const a = this.a;
    a.still();
    a.mood.eyes = 'half';
    a.setPose('sit', 4);
    yield* this.wait(0.6);
    a.mood.eyes = 'open';
    a.setPose('stand', 5);
    yield* this.wait(0.5);
  }
}
