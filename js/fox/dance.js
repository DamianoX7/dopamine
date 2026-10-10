// How the foxes dance when one of her covers plays. The app listens to the recording first
// (js/cover/audio/beat.js: where its beats fall, how loud each moment is); the world keeps
// time with it and picks a move for every eight beats (world.js: tune). Here is what each move
// looks like — a function of the beat, laid over a pose — and the two behaviours that use
// them: `party` (gather round the radio, listen, dance) and `lullaby` (the same, at night).
import { V, clamp, TAU } from './kit.js';
import { wrapAngle } from './animator.js';

const REST = { wag: 0, ears: 0, mouth: 0, pant: 0, chew: 0, eyes: 'open', breath: 1, shake: 0, wiggle: 0, tailUp: 0 };
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const frac = (x) => x - Math.floor(x);
const hit = (ph, sharp = 5) => Math.exp(-sharp * ph); //       1 on the beat, then dying away
const arc = (k) => (k > 0 && k < 1 ? 4 * k * (1 - k) : 0); //  up and down again: a jump
const side = (b) => Math.sin(Math.PI * b); //                  to the left on one beat, to the right on the next
const ease = (k) => {
  k = clamp(k, 0, 1);
  return k * k * (3 - 2 * k);
};

// ------------------------------------------------------------------ keeping time

/** Which beat of the cover the moment `t` (seconds) falls on: 12.5 = halfway from its 13th beat to its 14th. */
export function beatAt(beats, t) {
  const n = beats ? beats.length : 0;
  if (n < 2) return t * 1.8;
  if (t <= beats[0]) return (t - beats[0]) / (beats[1] - beats[0]);
  if (t >= beats[n - 1]) return n - 1 + (t - beats[n - 1]) / (beats[n - 1] - beats[n - 2]);
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (beats[mid] <= t) lo = mid;
    else hi = mid;
  }
  return lo + (t - beats[lo]) / (beats[hi] - beats[lo]);
}

/** One of the cover's curves (how loud, how lively: bytes, `step` seconds apart) at the moment `t`, 0 … 1. */
export function curveAt(curve, step, t) {
  if (!curve || !curve.length) return 0.5;
  const x = clamp(t / step, 0, curve.length - 1);
  const i = Math.floor(x);
  const j = Math.min(curve.length - 1, i + 1);
  return (curve[i] + (curve[j] - curve[i]) * (x - i)) / 255;
}

/** The move for the next eight beats: gentle while the song is quiet, wild when it is in full swing. */
export function pickMove(energy, last, count, reduce) {
  if (reduce) return last === 'nod' ? 'sway' : 'nod';
  const pool = energy < 0.34 ? ['nod', 'sway', 'nod'] : energy < 0.64 ? ['sway', 'bop', 'paws', 'wiggle', 'bop'] : ['hop', 'spin', 'paws', 'bop', 'wiggle', 'roll', 'hop'];
  if (energy >= 0.64 && count >= 3) pool.push('wave', 'wave');
  const choices = pool.filter((m) => m !== last);
  return choices[Math.floor(Math.random() * choices.length)];
}

// ------------------------------------------------------------------ the moves
//
// d = { a: its animator, S: its size, b: beats since the move began, n: whole ones, ph: 0 … 1 within
// the beat, e: how lively the song is (0 … 1), level: how loud right now, i: its place in the
// line, face: the way to her, dt }. A move sets the pose and writes what comes on top of it
// (a.add, a.lift, a.air, a.yaw…) for this frame; everything is cleared before the next one.

/** Turn (back) towards `yaw`, stepping round if it is on its feet. */
function faceTo(d, yaw, rate = 7) {
  const a = d.a;
  const off = wrapAngle(yaw - a.yaw);
  const step = clamp(off, -rate * d.dt, rate * d.dt);
  a.yaw += step;
  a.yawRate = Math.abs(off) > 0.02 ? step / Math.max(d.dt, 1e-4) : 0;
}

export const MOVES = {
  // sitting: the head nods to the beat and tilts from side to side, the tail keeps time
  nod(d) {
    const { a, b, ph } = d;
    faceTo(d, d.face);
    a.setPose('sit', 6);
    const h = hit(ph, 4.5);
    a.add.nrx = 0.2 * h * (0.7 + 0.5 * d.e);
    a.add.hdx = 0.1 * h;
    a.add.hdz = 0.17 * side(b);
    a.add.ts = 0.3 * side(b);
    a.add.earB = 0.25 * h;
    a.mood.wag = 0.35;
  },

  // standing: the whole fox leans left, then right, a front paw coming off the ground each time
  sway(d) {
    const { a, b } = d;
    faceTo(d, d.face);
    a.setPose('stand', 7);
    const s = side(b);
    a.add.hx = 0.04 * s;
    a.add.hrz = -0.17 * s;
    a.add.hry = 0.12 * s;
    a.add.cry = -0.14 * s;
    a.add.nry = 0.12 * s;
    a.add.hdz = 0.24 * s;
    a.add.hy = -0.022 * (1 - Math.abs(s));
    a.add.ts = 0.35 * s;
    a.lift[0] = 0.055 * Math.max(0, -s);
    a.lift[2] = 0.055 * Math.max(0, s);
    a.mood.wag = 0.4;
  },

  // a dip on every beat, marching on the spot
  bop(d) {
    const { a, ph, n } = d;
    faceTo(d, d.face);
    a.setPose('stand', 8);
    const h = hit(ph, 5);
    a.add.hy = -0.05 * h;
    a.add.nrx = 0.2 * h;
    a.add.hdx = -0.08 * h;
    a.add.earB = 0.35 * h;
    a.add.tl = 0.3 * h;
    const up = arc(ph * 1.7);
    const left = n % 2 === 0;
    a.lift[left ? 0 : 2] = 0.075 * up;
    a.lift[left ? 3 : 1] = 0.045 * up;
    a.add.hrz = (left ? 1 : -1) * 0.05 * up;
    a.mood.wag = 0.75;
    a.mood.pant = d.e > 0.55 ? 1 : 0;
  },

  // up on its haunches, waving its front paws in turn
  paws(d) {
    const { a, b, ph } = d;
    faceTo(d, d.face);
    a.setPose('beg', 7);
    const s = side(b);
    a.lift[0] = 0.07 * Math.max(0, s) - 0.03 * Math.max(0, -s);
    a.lift[2] = 0.07 * Math.max(0, -s) - 0.03 * Math.max(0, s);
    a.add.cry = 0.16 * s;
    a.add.hdz = 0.2 * s;
    a.add.hy = -0.016 * hit(ph, 5);
    a.add.ts = 0.25 * s;
    a.mood.wag = 1;
    a.mood.pant = 1;
    a.mood.eyes = 'happy';
  },

  // chest down, rump up and wiggling — and on every fourth beat a spring into the air
  wiggle(d) {
    const { a, b, ph, n } = d;
    faceTo(d, d.face);
    a.mood.wag = 1;
    if (n % 4 === 3 && ph < 0.6) {
      a.setPose('hop', 14);
      a.air = 0.15 * d.S * arc(ph / 0.6);
      return;
    }
    a.setPose('bow', 9);
    const s = Math.sin(TAU * b);
    a.add.hry = 0.2 * s;
    a.add.hrz = 0.08 * s;
    a.add.ts = 0.45 * s;
    a.add.nrx = 0.1 * hit(ph, 5);
    a.mood.tailUp = 0.15;
  },

  // a jump on every beat: to the left, back, to the right, back
  hop(d) {
    const { a, ph, n } = d;
    const T = 0.6;
    const seq = [0, 1, 0, -1];
    const from = seq[((n % 4) + 4) % 4];
    const to = seq[(((n + 1) % 4) + 4) % 4];
    const k = ph / T;
    if (k < 1) {
      a.setPose('hop', 14);
      a.air = (0.17 + 0.07 * d.e) * d.S * arc(k);
      a.yaw = d.face + 0.7 * (from + (to - from) * ease(k));
      a.add.earB = 0.4 * arc(k);
    } else {
      a.setPose('stand', 12);
      a.yaw = d.face + 0.7 * to;
      a.add.hy = -0.045 * hit((ph - T) / (1 - T), 4);
    }
    a.yawRate = 0;
    a.mood.wag = 1;
    a.mood.pant = 1;
  },

  // every two beats a leap with a full turn in the air, one way and then the other
  spin(d) {
    const { a, b } = d;
    const c = b % 2;
    const dir = Math.floor(b / 2) % 2 ? -1 : 1;
    const T = 0.9;
    if (c < T) {
      const k = c / T;
      a.setPose('hop', 14);
      a.air = (0.24 + 0.06 * d.e) * d.S * arc(k);
      a.yaw = d.face + dir * TAU * ease(k);
      a.add.earB = 0.5;
    } else {
      a.setPose('stand', 12);
      a.yaw = d.face;
      a.add.hy = -0.05 * hit((c - T) / (2 - T), 3);
      a.add.nrx = 0.15 * hit(d.ph, 5);
    }
    a.yawRate = 0;
    a.mood.wag = 1;
    a.mood.pant = 1;
    a.mood.tailUp = 0.3;
  },

  // a wave down the line: each fox jumps half a beat after the one before it
  wave(d) {
    const { a } = d;
    faceTo(d, d.face);
    const c = (((d.b - d.i * 0.5) % 4) + 4) % 4;
    if (c < 1) {
      const k = c / 0.8;
      if (k < 1) {
        a.setPose('hop', 14);
        a.air = 0.24 * d.S * arc(k);
        a.mood.mouth = 0.5;
        a.add.earB = 0.4;
      } else a.setPose('stand', 12);
      a.mood.wag = 1;
    } else {
      a.setPose('sit', 8);
      a.add.nrx = 0.16 * hit(d.ph, 4.5);
      a.add.hdz = 0.12 * side(d.b);
      a.mood.wag = 0.5;
    }
  },

  // down, over onto its back and round, up again — one way, then the other
  roll(d) {
    const { a, b } = d;
    faceTo(d, d.face);
    const c = b % 4;
    const dir = Math.floor(b / 4) % 2 ? -1 : 1;
    a.pivot = 0.15;
    if (c < 1) {
      a.setPose('lie', 9);
      a.mood.wag = 0.6;
    } else if (c < 3) {
      a.setPose('lie', 9);
      a.roll = dir * TAU * ease((c - 1) / 2);
      a.mood.eyes = 'happy';
      a.mood.mouth = 0.4;
    } else {
      a.setPose('stand', 9);
      a.add.hy = -0.03 * hit(c - 3, 3);
      a.mood.wag = 1;
      a.mood.pant = 1;
    }
  },

  // one of them sings along: head back, and its mouth opens with her voice
  sing(d) {
    const { a, b } = d;
    faceTo(d, d.face);
    a.setPose('howl', 6);
    a.mood.eyes = 'happy';
    a.mood.mouth = clamp(0.2 + 0.85 * d.level, 0, 1);
    a.add.hdz = 0.1 * side(b);
    a.add.ts = 0.22 * side(b);
    a.mood.wag = 0.5;
  },
};

// ------------------------------------------------------------------ the behaviours (mixed into the Brain)

export const DANCING = {
  /** One of her covers is playing: to its place by the radio, a moment of listening — then it dances for as long as the music plays. */
  *party() {
    const a = this.a;
    const w = this.w;
    let T = w.tune;
    if (!T || !T.on) return;
    this.close = true;
    let at = w.partySpot(this.fox);
    let far = Math.hypot(at.x - a.pos.x, at.z - a.pos.z);
    if (far > 0.15) {
      a.mood.tailUp = 0.3;
      yield* this.goTo(at.x, at.z, { speed: far > 1.1 * this.S ? 'run' : 'trot', stop: 0.08, timeout: 7 });
      a.mood.tailUp = 0;
    }
    // it sits down and listens first: ears up, head on one side — until it has the beat
    const radio = w.things.radio.object.position;
    if (!T.ready) {
      yield* this.turnTo(Math.atan2(radio.x - a.pos.x, radio.z - a.pos.z), 6);
      a.setPose('sit', 6);
      this.watch = null;
      a.look = V(radio.x, 0.15, radio.z);
      a.lookW = 0.7;
      let t = 0;
      const lead = 2.2 + 0.25 * this.place();
      while ((T = w.tune) && T.on && (t < lead || !T.ready) && t < 7) {
        t += yield;
        a.add.hdz = 0.26 * Math.sin(t * 1.7 + this.place());
        a.mood.wag = 0.35;
        a.mood.ears = -0.25;
      }
      a.still();
    }
    this.lookAtYou(0.85);
    // …and now it dances, facing her
    const d = { a, S: this.S, b: 0, n: 0, ph: 0, e: 0.5, level: 0, i: 0, face: 0, dt: 0.016 };
    let note = -1;
    let away = 0;
    while ((T = w.tune) && T.on) {
      const dt = yield;
      a.still();
      a.level();
      a.air = 0;
      Object.assign(a.mood, REST);
      // shoved off its spot (a fox came through, she put something down there): back to it
      at = w.partySpot(this.fox);
      far = Math.hypot(at.x - a.pos.x, at.z - a.pos.z);
      away = far > 0.3 * this.S + 0.12 ? away + dt : 0;
      if (away > 0.5) {
        a.setPose('stand', 9);
        yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.08, timeout: 4 });
        this.lookAtYou(0.85);
        away = 0;
        continue;
      }
      const b = T.beat - T.moveAt;
      d.b = b;
      d.n = Math.floor(b);
      d.ph = b - d.n;
      d.e = T.energy;
      d.level = T.level;
      d.i = w.partyPlace(this.fox);
      d.face = this.toCamera();
      d.dt = Math.max(dt, 1e-3);
      const singing = T.singer === this.fox;
      (singing ? MOVES.sing : MOVES[T.move] || MOVES.nod)(d);
      // notes from the one that sings along
      if (singing && Math.floor(T.beat) !== note) {
        note = Math.floor(T.beat);
        w.fx.emit(note % 2 ? '🎵' : '🎶', a.nosePoint(V()), { size: 0.13, rise: 0.55, life: 1.4, drift: 0.3 });
      }
    }
    a.still();
    a.level();
    a.air = 0;
    Object.assign(a.mood, REST);
    a.setPose('stand', 9);
    yield* this.turnTo(this.toCamera(), 7);
    // the music stopped: it sits and waits to see whether there is more
    a.setPose('sit', 6);
    this.lookAtYou(0.9);
    a.mood.wag = 0.5;
    for (let t = 0; t < 2.6 && !(w.tune && w.tune.on); ) t += yield;
  },

  /** A cover at night: too sleepy to dance — it lies down by the music and listens, its tail keeping time. */
  *lullaby() {
    const a = this.a;
    const w = this.w;
    let T = w.tune;
    if (!T || !T.on) return;
    this.close = true;
    const at = w.partySpot(this.fox);
    if (Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.15) yield* this.goTo(at.x, at.z, { speed: 'walk', stop: 0.08, timeout: 10 });
    yield* this.turnTo(this.toCamera() + rand(-0.5, 0.5), 4);
    a.setPose('lie', 4);
    this.lookAtYou(0.4);
    a.mood.breath = 0.7;
    let t = 0;
    let note = 2 + this.place();
    while ((T = w.tune) && T.on) {
      t += yield;
      const s = Math.sin((Math.PI * T.beat) / 2);
      a.add.hdz = 0.14 * s;
      a.add.ts = 0.25 * s;
      a.add.nrx = 0.05 * hit(frac(T.beat), 3);
      a.mood.wag = 0.25;
      a.mood.eyes = t > 3 ? 'happy' : 'open';
      if (t > note) {
        note = t + 4 + w.foxes.length;
        w.fx.emit('🎵', this.headTop(), { size: 0.1, rise: 0.3, life: 1.8, drift: 0.12 });
      }
    }
    a.still();
    a.mood.eyes = 'open';
    yield* this.wait(1.5);
  },
};
