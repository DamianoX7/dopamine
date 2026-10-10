// What the foxes do about the weather (sky.js draws it, the app keeps its clock): run for
// cover when it rains — into the house, under a tree, into the barn — and sit it out there;
// come out when it is over, and jump into the puddles it has left; snap at snowflakes and
// dive nose first into the snow; curl up with their backs to blowing sand. Each is a
// behaviour like those in brain.js and is mixed into the Brain there. Where a fox can get out
// of the rain, the habitat says (scenes.js: shelters) and the world hands out (coverFor).
import { V } from './kit.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const AROUND = [0, 0.7, -0.7, 1.4, -1.4, 2.3, -2.3, Math.PI]; // looking for a free side: the nearest first

export const WEATHERLIFE = {
  // ---------------------------------------------------------------- rain

  /**
   * Out of the weather: into the house if that is free, else to its place under cover — and
   * there it stays, watching it come down, until it is over. Where there is no cover at all it
   * makes itself small where it is. `startled` = it has only just begun.
   */
  *takeCover(startled = false) {
    const a = this.a;
    const w = this.w;
    const sky = w.sky;
    const kind = sky.kind;
    const mine = this.fox === w.lead;
    if (startled) {
      // the first drops: a look up at the sky
      yield* this.wait(rand(0.1, 0.8));
      a.setPose('alert', 7);
      this.watch = null;
      a.look = V(a.pos.x + Math.sin(a.yaw) * 0.5, 2.4, a.pos.z + Math.cos(a.yaw) * 0.5);
      a.lookW = 0.9;
      a.mood.ears = 0.5;
      if (mine) this.say(w.host.line(kind === 'wind' ? 'wind' : kind === 'snow' ? 'cold' : 'rain'), 2400);
      yield* this.wait(rand(0.6, 1));
      a.lookW = 0;
    }
    a.mood.ears = 0.35;
    // (from the cold, the fire is the place to be)
    const fire = kind === 'snow' ? w.decor.find((it) => it.def.use === 'warm' && !it.trial && !it.homeless) : null;
    if (fire && w.claim(fire, this.fox)) return void (yield* this.warm(fire));
    const speed = this.reduce ? 'trot' : 'run';
    const house = w.house();
    let housed = !!house && this.using === house;
    if (house && !housed && w.claim(house, this.fox)) housed = yield* this.intoDen(house, speed);
    let spot = housed ? null : w.coverFor(this.fox);
    let under = housed;
    if (spot) under = yield* this.toCover(spot, speed);
    const curled = !under && kind === 'wind';
    if (!housed) {
      if (under) yield* this.turnTo(spot.yaw, 6);
      else yield* this.settle();
      if (this.fox.wet > 0.15) yield* this.shakeOff();
      if (curled) {
        // nothing to get behind: its back to the wind, nose under its tail, eyes shut
        yield* this.turnTo(Math.PI / 2 + rand(-0.3, 0.3), 5);
        a.setPose('sleep', 4);
        a.mood.eyes = 'happy';
        a.mood.ears = 0;
      } else {
        a.setPose(!under ? 'sad' : spot.lie || this.baby || Math.random() < 0.35 ? 'lie' : 'sit', 5);
        a.mood.ears = under ? 0.1 : 0.4;
      }
    } else a.mood.ears = 0.1;
    this.sheltered = under;
    a.mood.breath = 0.8;
    const up = V();
    let gaze = rand(1.5, 3.5);
    let talk = rand(5, 12) + this.place() * 3;
    let check = 1;
    for (let t = 0; sky.kind === kind && sky.shelterFrom(this.fox); ) {
      const dt = yield;
      t += dt;
      if (spot) this.beyond = 2;
      if (t > gaze && !curled) {
        // watching the rain; a look at her; a little doze
        gaze = t + rand(2.5, 6);
        const pick = Math.random();
        a.mood.eyes = 'open';
        if (pick < 0.4) this.lookAtYou(0.8);
        else if (pick < 0.75 || !under) {
          this.watch = null;
          a.look = up.set(a.pos.x + Math.sin(a.yaw + rand(-0.8, 0.8)) * 1.2, rand(0.5, 1.6), a.pos.z + Math.cos(a.yaw) * 1.2);
          a.lookW = 0.8;
        } else {
          a.lookW = 0;
          a.mood.eyes = 'happy';
        }
      }
      a.mood.wag = a.look === w.camera.position && under ? 0.25 : 0;
      if (t > talk) {
        talk = t + rand(16, 30);
        if (Math.random() < 0.8 / w.foxes.length + (mine ? 0.3 : 0)) this.say(w.host.line(kind === 'wind' ? 'wind' : kind === 'rain' && this.sheltered ? 'shelter' : 'cold'), 3000);
      }
      if (t > check && spot) {
        // the yard has grown, or shrunk: its place is somewhere else now
        check = t + 1;
        const now = w.coverFor(this.fox);
        if (now && Math.hypot(now.x - spot.x, now.z - spot.z) > 0.15) {
          spot = now;
          a.setPose('stand', 6);
          this.sheltered = yield* this.toCover(spot, 'trot');
          yield* this.turnTo(spot.yaw, 5);
          a.setPose(spot.lie || this.baby ? 'lie' : 'sit', 5);
        }
      }
    }
    // it is over: out it comes, with a stretch and a look about — and back into the yard
    this.sheltered = false;
    a.mood.eyes = 'open';
    a.mood.ears = 0;
    a.mood.breath = 1;
    yield* this.wait(rand(0.2, 1.6));
    if (housed && w.decor.includes(house)) yield* this.outOfDen(house);
    else a.setPose('stand', 6);
    if (mine && kind === 'rain') this.say(w.host.line('afterRain'), 2800);
    yield* this.stretch();
    if (!housed) {
      const p = this.randomPoint(0.72);
      yield* this.goTo(p.x, p.z, { speed: 'trot', timeout: 9 });
    }
    yield* this.lookAbout(rand(0.8, 1.6));
  },

  /**
   * To a place under cover (it may lie outside the yard), by the way that leads to it. False if it did not get
   * there — nor anywhere else under that roof.
   */
  *toCover(spot, speed = 'run') {
    const a = this.a;
    this.beyond = 2;
    this.close = true; // (squeezing in among the others: they are not stepped round, nor does anyone push it away)
    if (spot.via && Math.hypot(spot.x - a.pos.x, spot.z - a.pos.z) > Math.hypot(spot.x - spot.via.x, spot.z - spot.via.z) + 0.1) {
      yield* this.goTo(spot.via.x, spot.via.z, { speed, beyond: true, stop: 0.25, timeout: 9 });
      speed = 'trot';
    }
    yield* this.goTo(spot.x, spot.z, { speed, beyond: true, stop: 0.05, timeout: 9 });
    if (Math.hypot(spot.x - a.pos.x, spot.z - a.pos.z) < 0.2 * this.S + 0.1) return true;
    return !!spot.roof && Math.hypot(spot.roof.x - a.pos.x, spot.roof.z - a.pos.z) < spot.roof.r;
  },

  /** Shake the water out of its fur: drops fly. */
  *shakeOff() {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    a.setPose('stand', 9);
    a.mood.shake = 1;
    a.mood.eyes = 'happy';
    const wet = this.fox.wet > 0.12;
    for (let t = 0, next = 0; t < 0.95; ) {
      t += yield;
      if (wet && t > next) {
        next = t + 0.15;
        w.fx.emit('💧', V(a.pos.x, 0.32 * S, a.pos.z), { n: 2, spread: 0.2 * S, rise: 0.4, life: 0.55, size: 0.05, drift: 1.1, gravity: 1.8 });
      }
    }
    a.mood.shake = 0;
    a.mood.eyes = 'open';
    this.fox.wet *= 0.2;
    yield* this.wait(0.35);
  },

  /** Not everyone minds the rain: a dash through it — through a puddle, if there is one — and a jump at the drops. */
  *rainRomp() {
    const a = this.a;
    const w = this.w;
    a.mood.tailUp = 0.3;
    a.mood.ears = 0.3;
    for (let i = 0; i < 2 + (this.baby ? 1 : 0); i++) {
      const pool = this.puddle();
      const p = pool && Math.random() < 0.7 ? this.clampPoint(pool.x, pool.z, 0.94) : this.randomPoint(0.9);
      yield* this.goTo(p.x, p.z, { speed: this.reduce ? 'trot' : 'run', stop: 0.25, timeout: 5 });
      if (w.sky.puddleAt(a.pos.x, a.pos.z)) this.wade(1);
    }
    yield* this.turnTo(this.toCamera(), 6);
    this.watch = null;
    a.look = V(a.pos.x + Math.sin(a.yaw) * 0.4, 2, a.pos.z + Math.cos(a.yaw) * 0.4);
    a.lookW = 0.9;
    a.mood.mouth = 0.8; // catching drops
    a.mood.wag = 1;
    yield* this.hop(0.2);
    yield* this.wait(0.9);
    a.mood.mouth = 0;
    this.lookAtYou();
    yield* this.wait(0.6);
  },

  // ---------------------------------------------------------------- puddles

  /** One of the puddles nobody is in, or on the way to: the nearer, the likelier. */
  puddle() {
    const a = this.a;
    let best = null;
    let top = 0;
    for (const p of this.w.sky.puddles) {
      if (this.w.foxes.some((f) => f !== this.fox && f.brain.pool === p) || this.crowded(V(p.x, 0, p.z))) continue;
      const v = (0.4 + Math.random()) / (0.6 + Math.hypot(p.x - a.pos.x, p.z - a.pos.z));
      if (v > top) {
        top = v;
        best = p;
      }
    }
    return best;
  },

  /** Its feet are in a puddle: rings on the water, drops in the air, and it is the wetter for it. */
  wade(big = 1) {
    const a = this.a;
    const w = this.w;
    w.sky.splash(a.pos.x, a.pos.z, big);
    w.fx.emit(big > 1 ? '💦' : '💧', V(a.pos.x, 0.08, a.pos.z), { n: Math.round(2 + 3 * big), spread: 0.16 * big, rise: 0.45 + 0.25 * big, life: 0.7, size: big > 1 ? 0.1 : 0.06, drift: 0.9, gravity: 2.2 });
    this.fox.wet = Math.min(1, this.fox.wet + 0.25 * big);
  },

  /** A puddle! Up to it, a wiggle — and in with all four feet. A stamp or two, then out and a good shake. */
  *splash(p = this.puddle()) {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    if (!p) return void (yield* this.lookAbout(1.2));
    this.pool = p; // (it is this fox's for now)
    // from a little way off, on the side this fox is on (or the next one round)
    const ang = Math.atan2(a.pos.x - p.x, a.pos.z - p.z);
    const d = p.r + 0.6 * S;
    let from = null;
    for (const off of AROUND) {
      const q = V(p.x + Math.sin(ang + off) * d, 0, p.z + Math.cos(ang + off) * d);
      if (this.inYard(q, 0.99) && !this.blocked(q, 0.1 * S) && !this.crowded(q)) {
        from = q;
        break;
      }
    }
    if (!from) return void (yield* this.lookAbout(1.2));
    const to = V(p.x, 0, p.z);
    this.watch = null;
    a.look = to;
    a.lookW = 0.7;
    a.mood.tailUp = 0.3;
    yield* this.goTo(from.x, from.z, { speed: 'trot', stop: 0.12, timeout: 7 });
    // (dried up meanwhile, someone sitting in it — or no getting near it)
    if (!w.sky.puddles.includes(p) || this.crowded(to) || Math.hypot(to.x - a.pos.x, to.z - a.pos.z) > d + 0.5 * S) return void (yield* this.lookAbout(1));
    if (this.reduce) yield* this.goTo(to.x, to.z, { speed: 'walk', stop: 0.05, timeout: 4 });
    else yield* this.pounce(to);
    this.wade(1.5);
    if (Math.random() < 1.2 / w.foxes.length) this.say(w.host.line('puddle'), 2200);
    a.mood.wag = 1;
    a.mood.mouth = 0.4;
    // stamping about in it
    for (let i = 0, n = this.reduce ? 1 : 2 + Math.floor(Math.random() * 3); i < n && w.sky.puddles.includes(p); i++) {
      yield* this.hop(rand(0.1, 0.17));
      this.wade(0.8);
      if (i < n - 1) yield* this.turnTo(a.yaw + rand(-1.2, 1.2), 7);
    }
    yield* this.turnTo(this.toCamera(), 6);
    this.lookAtYou();
    a.mood.pant = 1;
    yield* this.wait(0.9);
    Object.assign(a.mood, { pant: 0, mouth: 0 });
    // out of it, and the water out of its fur
    yield* this.goTo(from.x, from.z, { speed: 'trot', stop: 0.15, timeout: 4 });
    yield* this.shakeOff();
    w.host.onPuddle();
    this.lookAtYou();
    a.mood.wag = 0.8;
    yield* this.wait(1);
  },

  /** A drink out of a puddle. */
  *lapPuddle(p = this.puddle()) {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    if (!p) return void (yield* this.sniffAbout());
    this.pool = p;
    const ang = Math.atan2(a.pos.x - p.x, a.pos.z - p.z);
    const d = p.r * 0.8 + 0.4 * S;
    let at = null;
    for (const off of AROUND) {
      const q = V(p.x + Math.sin(ang + off) * d, 0, p.z + Math.cos(ang + off) * d);
      if (this.inYard(q, 0.99) && !this.blocked(q, 0.08 * S) && !this.crowded(q)) {
        at = q;
        break;
      }
    }
    if (!at) return void (yield* this.sniffAbout());
    yield* this.goTo(at.x, at.z, { speed: 'walk', stop: 0.06, timeout: 7 });
    if (!w.sky.puddles.includes(p) || Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.3 * S) return;
    yield* this.turnTo(Math.atan2(p.x - a.pos.x, p.z - a.pos.z), 5);
    a.setPose('eat', 5);
    a.noseY = 0.03 / S;
    a.mood.wag = 0.3;
    yield* this.wait(0.7);
    a.mood.chew = 0.85;
    const nose = V();
    const sec = rand(2.2, 3.4);
    for (let t = 0, lap = 0; t < sec; ) {
      t += yield;
      if (t > lap) {
        lap = t + 0.45;
        a.nosePoint(nose);
        w.sky.ring(nose.x, nose.z, 0.1, 0.9, 0.7);
      }
    }
    a.mood.chew = 0;
    a.noseY = null;
    a.setPose('alert', 5);
    a.mood.shake = 0.5;
    w.fx.emit('💧', a.nosePoint(nose), { n: 3, spread: 0.08, rise: 0.3, life: 0.6, size: 0.05, gravity: 1.4, drift: 0.4 });
    yield* this.wait(0.45);
    a.mood.shake = 0;
    this.lookAtYou();
    a.mood.wag = 0.7;
    yield* this.wait(1.1);
  },

  // ---------------------------------------------------------------- snow

  /** It has begun to snow: a look up — and after the flakes. */
  *snowJoy() {
    const a = this.a;
    yield* this.wait(rand(0.1, 0.9));
    a.setPose('alert', 7);
    this.watch = null;
    a.look = V(a.pos.x + Math.sin(a.yaw) * 0.5, 2.4, a.pos.z + Math.cos(a.yaw) * 0.5);
    a.lookW = 0.9;
    a.mood.wag = 0.8;
    if (this.fox === this.w.lead) this.say(this.w.host.line('snow'), 2600);
    yield* this.wait(rand(0.7, 1.2));
    yield* this.catchFlakes();
  },

  /** Snowflakes are for catching: eyes on one as it comes down, and a jump at it, jaws wide. */
  *catchFlakes() {
    const a = this.a;
    const w = this.w;
    const up = V();
    this.watch = null;
    a.setPose('alert', 6);
    a.look = up;
    for (let i = 0, n = this.reduce ? 1 : 2 + Math.floor(Math.random() * 3); i < n; i++) {
      const to = a.yaw + rand(-1.1, 1.1);
      up.set(a.pos.x + Math.sin(to) * 0.5, 1.7, a.pos.z + Math.cos(to) * 0.5);
      a.lookW = 0.95;
      yield* this.turnTo(to, 5);
      yield* this.wait(rand(0.35, 0.8));
      a.mood.mouth = 0.9;
      a.mood.ears = 0.4;
      yield* this.hop(rand(0.2, 0.3));
      a.mood.mouth = 0;
      a.mood.ears = 0;
      w.fx.emit('❄️', a.nosePoint(V()), { spread: 0.03, rise: 0.2, life: 0.6, size: 0.07, gravity: 0.6 });
      // …tasting it
      a.mood.chew = 0.6;
      a.mood.wag = 1;
      yield* this.wait(0.45);
      a.mood.chew = 0;
    }
    yield* this.turnTo(this.toCamera(), 6);
    this.lookAtYou();
    a.mood.pant = 1;
    yield* this.wait(1.2);
  },

  /** Something under the snow? Head cocked, listening — then up, and in nose first. Out again with snow all over its face. */
  *snowDive() {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    const ang = a.yaw + rand(-0.9, 0.9);
    const d = rand(0.55, 0.8) * S;
    const to = this.clampPoint(a.pos.x + Math.sin(ang) * d, a.pos.z + Math.cos(ang) * d, 0.9);
    if (this.crowded(to) || this.blocked(to, 0.12 * S)) return void (yield* this.playBow());
    yield* this.turnTo(Math.atan2(to.x - a.pos.x, to.z - a.pos.z), 6);
    a.setPose('alert', 6);
    this.watch = null;
    a.look = to;
    a.lookW = 0.85;
    for (let t = 0; t < 1.5; ) {
      t += yield;
      a.add.hdz = 0.38 * Math.sin(Math.min(t, 1.2) * 2.6); // cocked one way, then the other
    }
    a.still();
    if (this.reduce) yield* this.goTo(to.x, to.z, { speed: 'walk', stop: 0.3, timeout: 3 });
    else yield* this.pounce(to);
    // head down in it, rump up, tail going
    a.setPose('bow', 10);
    a.noseY = 0.012;
    a.mood.wag = 1;
    a.mood.wiggle = 0.5;
    w.fx.emit('❄️', a.nosePoint(V()), { n: 5, spread: 0.16, rise: 0.5, life: 0.8, size: 0.085, drift: 0.7, gravity: 1.3 });
    yield* this.wait(rand(0.9, 1.5));
    a.noseY = null;
    a.mood.wiggle = 0;
    a.setPose('alert', 8);
    yield* this.wait(0.25);
    a.mood.shake = 0.8;
    a.mood.eyes = 'happy';
    w.fx.emit('❄️', this.headTop(), { n: 3, spread: 0.1, rise: 0.3, life: 0.6, size: 0.06, drift: 0.8, gravity: 1.2 });
    yield* this.wait(0.5);
    a.mood.shake = 0;
    a.mood.eyes = 'open';
    yield* this.turnTo(this.toCamera(), 6);
    this.lookAtYou();
    a.mood.wag = 0.8;
    yield* this.wait(1.1);
  },
};
