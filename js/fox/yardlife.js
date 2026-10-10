// What a fox does with the things in the yard (decor.js builds them, world.js keeps them):
// into the house, onto the swing, a drink at the pond, a bounce on the trampoline… Each is a
// behaviour like those in brain.js and is mixed into the Brain there. A fox that is on a thing
// or in it has `using` set; whatever it does next, it gets off first (brain.js: begin, alight).
import { V, clamp, TAU } from './kit.js';
import { wrapAngle } from './animator.js';

const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const ease = (k) => {
  k = clamp(k, 0, 1);
  return k * k * (3 - 2 * k);
};
const AROUND = [0, 0.7, -0.7, 1.4, -1.4, 2.1, -2.1, 2.8, -2.8]; // looking for a free side: the nearest first

export const YARDLIFE = {
  /** Go and use one of the things in the yard — or, if another fox has it, have a look at it. */
  *useDecor(item) {
    const w = this.w;
    const use = item && w.decor.includes(item) && !item.trial && item.def.use;
    if (!use || !w.claim(item, this.fox)) return void (yield* this.inspect(item));
    yield* this[use](item);
  },

  /** Is this point in the yard? */
  inYard(p, margin = 1.02) {
    const b = this.w.env.bounds;
    return Math.hypot((p.x - b.cx) / (b.rx * margin), (p.z - b.cz) / (b.rz * margin)) <= 1;
  },

  /**
   * A free place to stand `gap` from the middle of a thing: on the side this fox is on, or the
   * next one round. `far` = rather on the side away from her, so that it faces her across it.
   */
  sideOf(item, gap, alone = true, far = false) {
    const a = this.a;
    const c = item.object.position;
    const cam = this.w.camera.position;
    const base = far ? Math.atan2(c.x - cam.x, c.z - cam.z) + rand(-0.5, 0.5) : Math.atan2(a.pos.x - c.x, a.pos.z - c.z);
    for (const off of AROUND) {
      const d = typeof gap === 'function' ? gap(base + off) : gap;
      const p = V(c.x + Math.sin(base + off) * d, 0, c.z + Math.cos(base + off) * d);
      if (this.inYard(p) && !this.blocked(p, 0.06, item) && !(alone && this.crowded(p))) return p;
    }
    return null;
  },

  /** Walk to a point by a thing it is going to use; false if it could not get there (or the thing is gone). */
  *reach(p, item, speed = 'trot') {
    const a = this.a;
    if (!p || !this.inYard(p)) return false;
    this.touch = item; // from here on it may come as close to it as it likes
    yield* this.goTo(p.x, p.z, { speed, stop: 0.06, timeout: 8 });
    return this.w.decor.includes(item) && Math.hypot(p.x - a.pos.x, p.z - a.pos.z) < 0.14 * this.S + 0.08;
  },

  /** A jump from where it is to `to`, to land `top` above the ground (onto a seat — or 0: down from one). */
  *jumpTo(to, top = 0, { h = 0.3, T = 0.46, yaw = null } = {}) {
    const a = this.a;
    const from = a.pos.clone();
    const y0 = a.air;
    const yaw0 = a.yaw;
    const pitch0 = a.pitch;
    const turn = yaw == null ? 0 : wrapAngle(yaw - yaw0);
    a.speed = 0;
    a.yawRate = 0;
    let t = 0;
    while (t < T) {
      t += yield;
      const k = Math.min(1, t / T);
      a.pos.lerpVectors(from, to, k);
      a.air = y0 + (top - y0) * k + 4 * h * this.S * k * (1 - k);
      a.pitch = pitch0 * (1 - k);
      a.yaw = yaw0 + turn * ease(k);
      a.setPose(k < 0.5 ? 'leap' : 'hop', 12);
    }
    a.pos.copy(to);
    a.air = top;
    a.pitch = 0;
  },

  /** A few steps straight to a point, whichever way it is facing (backing into its house). */
  *shuffle(to, speed) {
    const a = this.a;
    a.speed = speed;
    for (let t = 0; t < 4; ) {
      const dt = yield;
      t += dt;
      this.driven = true;
      const dx = to.x - a.pos.x;
      const dz = to.z - a.pos.z;
      const d = Math.hypot(dx, dz);
      if (d <= speed * dt) break;
      a.pos.x += (dx / d) * speed * dt;
      a.pos.z += (dz / d) * speed * dt;
    }
    a.pos.x = to.x;
    a.pos.z = to.z;
    a.speed = 0;
  },

  /**
   * Off the thing it was on (or out of it) before it does anything else. `out` = where to;
   * `air` and `pitch` = how it was sitting there; `low` = it has a lintel over its head.
   */
  *alight(out, air, pitch, low) {
    const a = this.a;
    a.air = air; // begin() has set it on the ground: back to where it really is
    a.pitch = pitch;
    const from = a.pos.clone();
    const T = low ? 0.5 : 0.34;
    a.setPose(low ? 'crouch' : 'hop', 12);
    a.speed = low ? 0.5 * this.S : 0;
    let t = 0;
    while (t < T) {
      t += yield;
      this.driven = true;
      const k = Math.min(1, t / T);
      a.pos.lerpVectors(from, out, k);
      a.air = air * (1 - k) + (low ? 0 : 4 * 0.12 * this.S * k * (1 - k));
      a.pitch = pitch * (1 - k);
    }
    a.pos.copy(out);
    a.air = 0;
    a.pitch = 0;
    a.speed = 0;
    a.setPose('stand', 12);
  },

  /** Up to a thing for a sniff and a look at her: it is new, or another fox has it. */
  *inspect(item) {
    const a = this.a;
    const w = this.w;
    if (!item || !w.decor.includes(item)) return;
    const c = item.object.position;
    const to = this.sideOf(item, item.reach + 0.36 * this.S, false);
    if (!to) return void (yield* this.lookAbout(1.2));
    this.watch = null;
    this.touch = item;
    a.look = V(c.x, Math.min(0.3, item.def.h * 0.5), c.z);
    a.lookW = 0.6;
    yield* this.goTo(to.x, to.z, { speed: 'trot', stop: 0.1, timeout: 6 });
    if (!w.decor.includes(item)) return;
    yield* this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), 5);
    a.setPose('sniff', 5);
    const y = clamp(0.14 / this.S, 0.08, 0.4);
    const sec = rand(1.2, 2);
    for (let t = 0; t < sec; ) {
      t += yield;
      a.noseY = y + Math.max(0, Math.sin(t * 15)) * 0.012;
    }
    a.noseY = null;
    a.setPose('alert', 5);
    a.mood.wag = 0.7;
    this.lookAtYou(0.85);
    yield* this.wait(rand(0.9, 1.5));
  },

  /** Something was put down where it stood: a jump to one side, and a good look at it. */
  *scoot(item) {
    const a = this.a;
    const w = this.w;
    const to = w.clearOf(a.pos, 0.2 * this.S + 0.06);
    yield* this.jumpTo(this.clampPoint(to.x, to.z, 1), 0, { h: 0.2, T: 0.36 });
    a.setPose('stand', 12);
    if (!item || !w.decor.includes(item)) return;
    const c = item.object.position;
    yield* this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), 7);
    this.watch = null;
    a.look = V(c.x, Math.min(0.3, item.def.h * 0.5), c.z);
    a.lookW = 0.9;
    a.mood.ears = 0.3;
    yield* this.wait(1.1);
  },

  // ---------------------------------------------------------------- 여우 집

  /** To the door of the house and in, backwards: it ends lying in the doorway, head out. False if it can't get in. */
  *intoDen(item, speed = 'trot') {
    const a = this.a;
    const S = this.S;
    const door = item.def.door;
    const out = item.at(0, door + 0.5 * S + 0.1);
    if (this.blocked(out, 0.04, item) || !(yield* this.reach(out, item, speed))) return false;
    yield* this.turnTo(item.yaw, 5); // its back to the door
    this.using = item;
    this.way = out;
    a.lookW = 0;
    a.setPose('crouch', 8); // low, under the lintel
    yield* this.wait(0.3);
    yield* this.shuffle(item.at(0, door - 0.3 * S), 0.3 * S);
    a.setPose('den', 4);
    return true;
  },

  *outOfDen(item) {
    const a = this.a;
    a.noseY = null;
    a.setPose('crouch', 7);
    yield* this.wait(0.3);
    yield* this.shuffle(this.way || item.at(0, item.def.door + 0.5 * this.S + 0.1), 0.34 * this.S);
    this.using = null;
    this.w.unclaim(this.fox);
    a.setPose('stand', 6);
  },

  /** A while in the house, watching the yard from its doorway. */
  *den(item) {
    const a = this.a;
    const w = this.w;
    if (!(yield* this.intoDen(item))) return void (yield* this.inspect(item));
    this.lookAtYou(0.6);
    yield* this.wait(1);
    const until = w.time + rand(9, 16);
    for (let t = 0; w.time < until && w.decor.includes(item); ) {
      const dt = yield;
      t += dt;
      a.mood.eyes = t % 7 > 4.4 ? 'happy' : 'open'; // dozing off, now and then
      a.mood.wag = t % 7 > 4.4 ? 0 : 0.2;
      if (Math.random() < dt * 0.25) this.lookAtYou(Math.random() < 0.7 ? 0.7 : 0.15);
    }
    a.mood.eyes = 'open';
    w.host.onDecorUse(item.id);
    yield* this.outOfDen(item);
    yield* this.stretch();
  },

  // ---------------------------------------------------------------- 그네

  /** Onto the swing with a jump, and then higher and higher — off again at the top of a swing forwards. */
  *ride(item) {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    // from behind the seat, or from in front of it (then it rides facing the other way)
    let f = 0;
    for (const dir of [1, -1]) {
      const p = item.at(0, -dir * (0.42 + 0.3 * S));
      if (this.inYard(p) && !this.blocked(p, 0.04, item)) {
        if (!(yield* this.reach(p, item))) return;
        f = dir;
        break;
      }
    }
    if (!f) return void (yield* this.inspect(item));
    const yaw = item.yaw + (f > 0 ? 0 : Math.PI);
    yield* this.turnTo(yaw, 6);
    this.using = item;
    const ahead = w.clearOf(item.at(0, f * (0.8 + 0.25 * S)), 0.14 * S, item); // where it will come down again
    this.way = this.clampPoint(ahead.x, ahead.z, 1);
    item.push = 0.06;
    const seat = item.seat(V());
    yield* this.jumpTo(V(seat.x, 0, seat.z), seat.y, { h: 0.2, T: 0.42, yaw });
    a.setPose('sit', 9);
    this.lookAtYou(0.45);
    const follow = () => {
      item.seat(seat);
      a.pos.x = seat.x;
      a.pos.z = seat.z;
      a.air = seat.y;
      a.pitch = -f * item.phi;
    };
    const T = rand(9, 14);
    for (let t = 0; t < T && w.decor.includes(item); ) {
      const dt = yield;
      t += dt;
      item.push = t < T - 2.6 ? Math.min(this.reduce ? 0.3 : 0.6, 0.14 + t * 0.14) : 0.12;
      follow();
      const high = item.amp > 0.4;
      a.mood.ears = clamp(f * Math.cos(item.phase) * item.amp * 1.5, -0.25, 0.7); // laid back as it goes forwards
      a.mood.wag = 0.8;
      a.mood.eyes = high ? 'happy' : 'open';
      a.mood.mouth = high ? 0.45 : 0;
      if (high && Math.random() < dt * 0.6) w.fx.emit('✨', this.headTop(), { spread: 0.1, rise: 0.3, life: 0.8, size: 0.09 });
    }
    // …and off it, as it comes forwards
    for (let i = 0; i < 400 && !(f * item.phi > 0.03 && f * Math.cos(item.phase) > 0); i++) {
      yield;
      follow();
    }
    const to = this.way;
    this.using = null;
    w.unclaim(this.fox);
    Object.assign(a.mood, { ears: 0.5, eyes: 'open', mouth: 0.3 });
    yield* this.jumpTo(to, 0, { h: 0.18, T: 0.44 });
    a.setPose('bow', 16);
    w.thump(a.nosePoint(V()));
    yield* this.wait(0.35);
    a.setPose('stand', 8);
    yield* this.turnTo(this.toCamera(), 6);
    this.lookAtYou();
    Object.assign(a.mood, { ears: 0, mouth: 0, wag: 1, pant: 1 });
    w.host.onDecorUse(item.id);
    yield* this.wait(1.3);
  },

  // ---------------------------------------------------------------- 연못

  /** A drink at the pond — or, when a fish comes by, a paw in the water after it. */
  *drink(item) {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    const c = item.object.position;
    const spot = this.sideOf(item, (ang) => item.rim(c.x + Math.sin(ang), c.z + Math.cos(ang)) + 0.42 * S - 0.05, true, true);
    if (!spot) return void (yield* this.inspect(item));
    if (!(yield* this.reach(spot, item, 'walk'))) return;
    yield* this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), 5);
    const nose = V();
    if (!this.reduce && Math.random() < 0.4) {
      // a fish! down it goes, eyes on it — and a paw in the water
      const fish = item.fish(V());
      fish.y = item.water;
      this.watch = null;
      a.look = fish;
      a.lookW = 0.9;
      a.setPose('crouch', 6);
      for (let t = 0; t < 1.7; ) {
        t += yield;
        item.fish(fish);
        fish.y = item.water;
        a.mood.wiggle = t > 0.9 ? 1 : 0;
      }
      a.mood.wiggle = 0;
      a.lookW = 0;
      a.setPose('bow', 15);
      yield* this.wait(0.17);
      a.nosePoint(nose);
      item.ripple(nose, 1.6);
      w.fx.emit('💦', V(nose.x, 0.08, nose.z), { n: 4, spread: 0.1, rise: 0.5, life: 0.7, size: 0.09, drift: 0.5, gravity: 1.2 });
      yield* this.wait(0.55);
      a.setPose('alert', 7);
      a.mood.shake = 0.8;
      a.mood.eyes = 'happy';
      yield* this.wait(0.55);
      a.mood.shake = 0;
      a.mood.eyes = 'open';
    } else {
      a.setPose('eat', 5);
      a.noseY = (item.water + 0.022) / S;
      a.mood.wag = 0.3;
      yield* this.wait(0.7);
      a.mood.chew = 0.85;
      const sec = rand(2.6, 4);
      for (let t = 0, lap = 0; t < sec; ) {
        t += yield;
        if (t > lap) {
          lap = t + 0.42;
          item.ripple(a.nosePoint(nose), 0.7);
        }
      }
      a.mood.chew = 0;
      a.noseY = null;
      a.setPose('alert', 5);
      // a shake of the head: drops fly
      a.mood.shake = 0.5;
      w.fx.emit('💧', a.nosePoint(nose), { n: 3, spread: 0.08, rise: 0.3, life: 0.6, size: 0.05, gravity: 1.4, drift: 0.4 });
      yield* this.wait(0.45);
      a.mood.shake = 0;
    }
    this.lookAtYou();
    a.mood.wag = 0.8;
    w.host.onDecorUse(item.id);
    yield* this.wait(1.2);
  },

  // ---------------------------------------------------------------- 트램펄린

  /** Onto the trampoline: higher with every bounce, turning in the air — and head over heels on the last one. */
  *bounce(item) {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    const c = item.object.position;
    const from = this.sideOf(item, item.reach + 0.42 * S, false);
    if (!from) return void (yield* this.inspect(item));
    if (!(yield* this.reach(from, item))) return;
    yield* this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), 6);
    this.using = item;
    this.way = from;
    const top = item.top;
    yield* this.jumpTo(V(c.x, 0, c.z), top, { h: 0.22, T: 0.44 });
    const n = this.reduce ? 3 : 5 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n && w.decor.includes(item); i++) {
      const last = i === n - 1;
      const h = (0.2 + 0.085 * i) * (0.6 + 0.4 * S) * (last ? 1.2 : 1);
      const T = 0.42 + 0.14 * Math.sqrt(h / 0.2); // higher takes longer
      const yaw0 = a.yaw;
      const turn = last ? wrapAngle(this.toCamera() - yaw0) : this.reduce ? 0 : (i % 2 ? 1 : -1) * rand(0.6, 1.5);
      const flip = last && !this.reduce;
      for (let t = 0; t < T; ) {
        t += yield;
        const k = Math.min(1, t / T);
        const down = Math.max(0, 1 - Math.min(k, 1 - k) / 0.1); // 1 at the moments it is on the mat
        item.press(down);
        a.air = top + 4 * h * k * (1 - k) - 0.05 * down;
        a.setPose(down > 0.25 ? 'squat' : 'hop', 16);
        a.yaw = yaw0 + turn * ease(k);
        if (flip) {
          a.pivot = 0.3;
          a.pitch = TAU * ease((k - 0.12) / 0.76);
        }
        a.mood.ears = 0.6 * (1 - down);
        a.mood.wag = 1;
        a.mood.mouth = 0.4;
      }
      a.level();
      if (i >= n - 2) w.fx.emit('✨', this.headTop(), { n: last ? 5 : 2, spread: 0.2, rise: 0.45, life: 0.9, size: 0.1 });
    }
    a.air = top;
    this.using = null;
    w.unclaim(this.fox);
    yield* this.jumpTo(from, 0, { h: 0.2, T: 0.42 });
    a.setPose('bow', 16);
    w.thump(a.nosePoint(V()));
    yield* this.wait(0.3);
    a.setPose('stand', 8);
    yield* this.turnTo(this.toCamera(), 6);
    this.lookAtYou();
    Object.assign(a.mood, { ears: 0, mouth: 0, wag: 1, pant: 1 });
    w.host.onDecorUse(item.id);
    yield* this.wait(1.4);
  },

  // ---------------------------------------------------------------- 모닥불

  /** Sit by the fire and watch the flames. */
  *warm(item) {
    const a = this.a;
    const w = this.w;
    const c = item.object.position;
    const spot = this.sideOf(item, item.reach + 0.36 * this.S + 0.1, true, true);
    if (!spot) return void (yield* this.inspect(item));
    if (!(yield* this.reach(spot, item, 'walk'))) return;
    yield* this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), 4);
    a.setPose('sit', 5);
    this.watch = null;
    a.look = V(c.x, 0.2, c.z);
    a.lookW = 0.6;
    a.mood.breath = 0.75;
    const until = w.time + rand(8, 14);
    for (let t = 0; w.time < until && w.decor.includes(item); ) {
      t += yield;
      a.mood.wag = 0.25 + 0.15 * Math.sin(t * 1.3);
      a.mood.eyes = t % 6 > 3.4 ? 'happy' : 'open';
      a.add.hdz = 0.06 * Math.sin(t * 0.8);
    }
    a.still();
    a.mood.eyes = 'open';
    w.host.onDecorUse(item.id);
    yield* this.yawn();
  },

  // ---------------------------------------------------------------- 벤치

  /** Up onto the bench, along it — to sit there, or to lie down. */
  *perch(item) {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    const front = item.at(0, 0.3 + 0.36 * S);
    if (this.blocked(front, 0.04, item) || !(yield* this.reach(front, item))) return void (yield* this.inspect(item));
    yield* this.turnTo(item.yaw + Math.PI, 6);
    this.using = item;
    this.way = front;
    const along = item.yaw + (Math.random() < 0.5 ? 1 : -1) * (Math.PI / 2);
    const lying = Math.random() < 0.45;
    // its middle a little back from the middle of the bench, so that all of it is on
    const seat = item.at(0, 0);
    seat.x -= Math.sin(along) * 0.07 * S;
    seat.z -= Math.cos(along) * 0.07 * S;
    yield* this.jumpTo(seat, item.top, { h: 0.2, T: 0.46, yaw: along });
    a.setPose(lying ? 'lie' : 'sit', 7);
    this.lookAtYou(0.85);
    const until = w.time + rand(8, 15);
    for (let t = 0; w.time < until && w.decor.includes(item); ) {
      const dt = yield;
      t += dt;
      a.mood.wag = 0.3 + 0.2 * Math.max(0, Math.sin(t * 0.9));
      if (Math.random() < dt * 0.25) this.lookAtYou(Math.random() < 0.7 ? 0.85 : 0.2);
    }
    this.using = null;
    w.unclaim(this.fox);
    yield* this.jumpTo(front, 0, { h: 0.14, T: 0.4, yaw: item.yaw });
    a.setPose('stand', 10);
    w.host.onDecorUse(item.id);
    yield* this.wait(0.5);
  },

  // ---------------------------------------------------------------- 꽃밭

  /** Nose into the flowers. Sometimes the pollen tickles. */
  *smell(item) {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    const x = (item.users.indexOf(this.fox) % 2 ? -1 : 1) * 0.17;
    const cam = w.camera.position;
    const away = (dir) => item.at(0, dir).distanceToSquared(cam);
    let spot = null;
    // (from behind them if it can, so that she sees its face over the flowers)
    for (const dir of away(1) > away(-1) ? [1, -1] : [-1, 1]) {
      const p = item.at(x, dir * (0.14 + 0.5 * S));
      if (this.inYard(p) && !this.blocked(p, 0.04, item) && !this.crowded(p)) {
        spot = p;
        break;
      }
    }
    if (!spot) return void (yield* this.inspect(item));
    if (!(yield* this.reach(spot, item, 'walk'))) return;
    const to = item.at(x, 0);
    yield* this.turnTo(Math.atan2(to.x - a.pos.x, to.z - a.pos.z), 5);
    a.setPose('sniff', 5);
    const y = clamp((item.top + 0.02) / S, 0.1, 0.5);
    const sec = rand(2, 3.2);
    for (let t = 0; t < sec; ) {
      t += yield;
      a.noseY = y + Math.max(0, Math.sin(t * 14)) * 0.012;
      a.mood.wag = 0.5;
    }
    a.noseY = null;
    a.setPose('alert', 6);
    if (Math.random() < 0.4) {
      yield* this.wait(0.3);
      a.mood.shake = 0.9;
      a.mood.eyes = 'happy';
      w.fx.emit('🌸', a.nosePoint(V()), { n: 3, spread: 0.1, rise: 0.4, life: 0.9, size: 0.07, drift: 0.4 });
      yield* this.wait(0.42);
      a.mood.shake = 0;
      a.mood.eyes = 'open';
    }
    this.lookAtYou();
    a.mood.wag = 0.8;
    w.host.onDecorUse(item.id);
    yield* this.wait(1.2);
  },
};
