// What a fox decides to do. Every behaviour is a little script (a generator) that runs one
// step per frame: wander, sniff, sit, nap, pounce at a butterfly — or answer you: come where
// you tapped, lean into a pat, eat, chase the ball, sing. The mood (hungry, sleepy, happy…)
// comes from the game state and changes what the fox feels like doing.
//
// Each fox has its own brain. Where several live together they also mind each other: they
// step round one another, share the bowl and the bed, touch noses, play chase; kits trot
// after the grown-ups and curl up against them. One of them fetches his letters from the
// mailbox, and when she takes pictures they all line up and pose.
//
// And they mind Lorelei, the girl they belong to (keeper.js — her brain is one of these, with
// doings of her own): they wait for her hand when she comes to stroke them, for the food she
// brings, for the ball she throws; they trot after her, go up for a sniff, lie down against her.
//
// Four kinds of behaviour live in files of their own and are mixed in at the bottom: what a
// fox does with the things in the yard (yardlife.js), how it dances to her covers (dance.js),
// how it goes off exploring and comes home with a gift (trips.js), and what it does about the
// weather — taking cover from the rain, playing in the puddles and in the snow (weatherlife.js).
import { V, clamp, TAU } from './kit.js';
import { wrapAngle } from './animator.js';
import { YARDLIFE } from './yardlife.js';
import { DANCING } from './dance.js';
import { TRIPS } from './trips.js';
import { WEATHERLIFE } from './weatherlife.js';

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const SPEED = { walk: 0.34, trot: 0.9, run: 1.9 }; // body lengths per second
const REACH = 0.57; // how far ahead of its middle a fox's nose is (model units)
const BODY = [[-0.22, 0.125], [0.12, 0.125], [0.42, 0.1]]; // rump, shoulders, head: how far ahead of its middle, and how wide (model units)
export const PAD = 0.16; //   how far its middle keeps from the things in the yard on its way round them (model units)
export const ASIDE = 0.2; //  …and from the bowl, the bed, the scenery
const RING = 10; //  how many corners there are to turn at round each of those
const LEAD = 0.3; // …and how far short of a corner it begins to turn (its nose is well ahead of its middle)

const CALM = { wag: 0, ears: 0, mouth: 0, pant: 0, chew: 0, eyes: 'open', breath: 1, shake: 0, wiggle: 0, tailUp: 0 };
const KNIT_YAW = Math.PI + 0.4; // the fox she knits a sweater for: its back to where the view is first, a little turned (world.js: knitOn)

// what a fox can be called away from by another fox
const FREE = new Set(['wander', 'lookAbout', 'sitAwhile', 'lieAwhile', 'sniffAbout', 'groom', 'yawn', 'stretch', 'shake', 'mope', 'follow', 'visit', 'greetBack', 'snuggle', 'nuzzle', 'lookOn']);
const RESTING = new Set(['sitAwhile', 'lieAwhile', 'groom', 'snuggle', 'sleep', 'mope', 'strokedBy']);
// …and what it finishes first, whatever the weather does
const INTENT = new Set(['fetchLetter', 'present', 'bringGift', 'eat', 'playBall', 'party', 'lullaby', 'strike', 'model', 'depart', 'alight', 'wake', 'petted', 'greet', 'arrive', 'unwrapped', 'lookOn', 'stepUp', 'sing', 'takeCover', 'moonGaze']);

export class Brain {
  constructor(world, fox) {
    this.w = world;
    this.fox = fox;
    this.a = fox.anim;
    this.S = fox.rig.scale;
    this.baby = fox.baby;
    this.pace = fox.baby ? 1.18 : 1; // a kit scampers
    this.script = null;
    this.doing = '';
    this.last = '';
    this.queue = [];
    this.petUntil = 0;
    this.asleep = false;
    this.watch = null; // another fox this one keeps its eyes on
    this.eye = V();
    this.skip = null; //  a fox it means to get close to (so it isn't steered or nudged away from it)
    this.target = null; // the fox it is following, visiting or lying against
    this.close = false; // on its way to a place the family shares (the bowl, the bed, a line-up): nobody nudges it aside
    this.loose = false; // standing about: it steps aside for a fox that comes through
    this.ate = 1; //      its share of the bowl: 0 = untouched … 1 = eaten
    this.using = null; // the thing in the yard it is on or in (the swing, the house): it gets off before anything else
    this.way = null; //   …and where it gets off to
    this.touch = null; // a thing in the yard it is busy with (drinking at the pond, about to jump on the bench): it may lean into that one
    this.net = null; //   what its ways through the yard have to lead round, and where they may turn (see plan)
    this.driven = false; // its legs carried it somewhere this frame (goTo, a few steps into its house)
    this.sheltered = false; // it is under cover: the rain does not reach it
    this.pool = null; //  the puddle it is playing in, or on its way to (one fox to a puddle)
    this.beyond = 0; //   it may leave the yard (for cover under a tree, to roam the country): asked for afresh every frame
    this.stray = false; // …and is out there now: it may stay until it comes back in
  }

  get reduce() {
    return this.w.state.reduce;
  }

  /** Can another fox draw it into a game right now? */
  get free() {
    return !this.asleep && !this.w.showcaseOn && !this.w.photoOn && FREE.has(this.doing);
  }

  /** Will it drop what it is doing when the weather turns? */
  get heedful() {
    return !this.asleep && !this.w.showcaseOn && !this.w.photoOn && !INTENT.has(this.doing);
  }

  /** Doing this, or about to (still waking up for it). */
  busyWith(name) {
    return this.doing === name || this.queue.some((q) => q[0] === name);
  }

  // ---------------------------------------------------------------- running scripts

  update(dt) {
    if (!this.script) {
      const next = this.queue.shift() || this.choose();
      this.begin(next[0], next[1]);
    }
    if (this.watch) this.watch.anim.headPoint(this.eye);
    let r;
    try {
      r = this.script.next(dt);
    } catch (err) {
      console.error('[fox] behaviour failed:', this.doing, err);
      r = { done: true };
    }
    if (r.done) this.script = null;
    // (called away in mid-stride — to cheer, to pose — it does not go on running on the spot)
    if (!this.driven && this.a.speed) this.a.speed = Math.abs(this.a.speed) < 0.02 ? 0 : damp(this.a.speed, 0, 10, dt);
    this.driven = false;
    this.keepInside();
  }

  begin(name, args = []) {
    const a = this.a;
    const on = this.using;
    if (on && name !== 'wake') {
      // off the swing, out of the house… first: what it meant to do comes after that
      // (a fox that wakes up in its house stays in it while it yawns and stretches)
      const out = this.w.clearOf(this.way || a.pos, 0.14 * this.S);
      this.queue.unshift([name, args]);
      name = 'alight';
      args = [this.clampPoint(out.x, out.z, 1), a.air, a.pitch, on.def.use === 'den'];
      this.using = null;
    }
    if (!this.using) this.w.unclaim(this.fox);
    a.setPose('stand', 6);
    a.look = null;
    a.lookW = 0;
    a.noseY = null;
    a.yawRate = 0;
    a.air = 0;
    a.level();
    a.still();
    Object.assign(a.mood, CALM);
    this.asleep = false;
    this.watch = null;
    this.skip = null;
    this.target = null;
    this.touch = null;
    this.close = false;
    this.loose = false;
    this.sheltered = false;
    this.pool = null;
    if (this.w.ballBusy === this.fox) this.w.ballBusy = null;
    this.doing = name;
    this.script = this[name](...args);
  }

  /** Drop what the fox is doing and do this instead (a tap, a treat, a pat). */
  do(name, ...args) {
    if (this.asleep && name !== 'sleep') {
      // woken up: a sleepy stretch first
      this.queue = [[name, args]];
      this.begin('wake');
      return;
    }
    this.queue = [];
    this.begin(name, args);
  }

  /** After the current behaviour. */
  then(name, ...args) {
    this.queue.push([name, args]);
  }

  /** Stop and choose afresh (the yard changed under its feet). */
  reset() {
    this.queue = [];
    this.script = null;
    this.asleep = false;
  }

  // ---------------------------------------------------------------- choosing

  choose() {
    const w = this.w;
    const st = w.state;
    if (w.photoOn) return ['strike']; //   she is taking pictures: pose
    if (w.showcaseOn) return ['model']; // the shop is open: stay in view and show off
    if (w.tune && w.tune.on) return [st.mood === 'sleepy' ? 'lullaby' : 'party']; // one of her covers is playing
    if (st.mood === 'sleepy') return ['sleep'];
    if (w.gazing === 'moon') return ['moonGaze', [w.foxes.filter((f) => f !== this.fox && f.brain.doing === 'moonGaze').length]]; // she is looking up at the moon: so are they
    const env = w.env;
    const sky = w.sky;
    const kid = this.baby ? 1 : 0;
    // foul weather: under cover, mostly — in the rain a kit (and now and then a grown fox) has a dash through it first
    if (sky.shelterFrom(this.fox)) {
      if (!sky.raining) return ['takeCover'];
      return [this.last !== 'rainRomp' && Math.random() < (kid ? 0.3 : 0.12) ? (this.last = 'rainRomp') : (this.last = 'takeCover')];
    }
    const table = [];
    const add = (name, weight, ...args) => weight > 0 && table.push([name, weight, args]);
    const lively = (st.mood === 'happy' ? 1 : st.mood === 'hungry' ? 0.3 : 0.6) * (1 + 0.5 * kid);
    const still = this.reduce ? 0 : 1;
    add('wander', 2.2);
    add('roam', this.reduce || st.mood === 'hungry' || w.night ? 0 : kid ? 0.4 : 0.9 * lively + 0.2); // (off into the country round the yard)
    add('sitAwhile', kid ? 1 : 1.6);
    add('lieAwhile', st.mood === 'happy' ? 0.7 : 1.5);
    add('sniffAbout', 1.1);
    add('lookAbout', 0.8);
    add('groom', kid ? 0.3 : 0.7);
    add('yawn', st.mood === 'happy' ? 0.3 : 0.7);
    add('stretch', 0.5);
    add('shake', 0.35 * still);
    add('zoomies', 0.9 * lively * still);
    add('chaseTail', 0.6 * lively * still);
    add('playBow', 0.9 * lively);
    add('chaseButterfly', env.butterflies && !w.night && env.fine ? 1.3 * lively * still : 0);
    add('pounceSomewhere', 0.7 * lively * still);
    if (st.mood === 'hungry') {
      add('beg', 3);
      add('mope', 1.2);
    } else if (st.mood !== 'happy') add('mope', 0.5);
    if (w.things.mic.object.visible && !w.foxes.some((f) => f.brain.doing === 'sing')) add('sing', 0.5);
    if (this.pals().length) {
      add('visit', 1.1);
      add('chase', (0.8 + 0.5 * kid) * lively * still);
      add('follow', kid ? 1.5 : 0.3);
      add('snuggle', kid ? 1.3 : 0.5);
      add('pounceTail', (kid ? 0.9 : 0.12) * lively * still);
    }
    // Lorelei: after her when she strolls about, up against her when she kneels down, over for a sniff at her hand
    const her = w.owner;
    if (her && her !== this.fox && !her.brain.asleep) {
      if (her.brain.doing === 'amble') add('follow', kid ? 1.5 : 0.3, her);
      if (her.brain.doing === 'sitAwhile') add('snuggle', 1.4 * this.room(her), her);
      add('nuzzle', 0.3 * this.room(her), her);
    }
    // the things she has put in the yard, as long as no other fox has them
    for (const it of w.decor) {
      const use = !it.trial && it.users.length < (it.def.share || 1) && it.def.use;
      if (!use) continue;
      const fun = use === 'ride' || use === 'bounce';
      add('useDecor', fun ? (0.75 + 0.5 * kid) * lively * still + 0.2 * (1 - still) : use === 'den' ? (st.mood === 'happy' ? 0.45 : 0.8) : use === 'warm' ? (w.night || env.snow ? 1 : 0.5) : 0.55, it);
    }
    // what the weather has left: puddles to jump into after a rain, snowflakes to catch, snow to dive into — and wet fur
    if (sky.puddles.length) {
      add('splash', (2.4 + 1.4 * kid) * lively * (0.4 + 0.6 * still));
      add('lapPuddle', 0.6);
    }
    if (sky.raining) add('rainRomp', 3 * lively * (0.4 + 0.6 * still) + 0.4); // (rain with nowhere to get out of it: then it is for running about in)
    if (sky.snowing) add('catchFlakes', 2.2 * lively + 0.4);
    if (env.snow) add('snowDive', (sky.snowing ? 1.5 : 0.7) * lively * (0.4 + 0.6 * still));
    if (this.fox.wet > 0.3) add('shakeOff', 4 * this.fox.wet);
    // (home from an expedition with a parcel she has not taken yet: back to her with it, now and then)
    if (w.gift && w.gift.fox === this.fox) add('bringGift', 3);
    table.forEach((row) => row[0] === this.last && (row[1] *= 0.25)); // don't repeat yourself
    let pick = Math.random() * table.reduce((s, row) => s + row[1], 0);
    const row = table.find((x) => (pick -= x[1]) < 0) || table[0];
    this.last = row[0];
    return [row[0], row[2]];
  }

  // ---------------------------------------------------------------- helpers

  randomPoint(margin = 0.86) {
    const b = this.w.env.bounds;
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * TAU;
      const k = Math.sqrt(Math.random()) * margin;
      const p = V(b.cx + Math.cos(a) * b.rx * k, 0, b.cz + Math.sin(a) * b.rz * k);
      if (!this.blocked(p, 0.12) && !this.crowded(p)) return p;
    }
    return V(b.cx, 0, b.cz);
  }

  /** What stands in the way: the scenery, the foxes' own things and (unless `yard` is false) what she has put in the yard. */
  solids(ignore, yard = true) {
    const w = this.w;
    const list = w.env.obstacles.slice();
    for (const key of ['bowl', 'bed', 'mic', 'mailbox', 'radio']) {
      const thing = w.things[key];
      if (thing === ignore || !thing.object.visible) continue;
      list.push({ x: thing.object.position.x, z: thing.object.position.z, r: thing.radius * thing.object.scale.x });
    }
    if (yard) for (const o of w.decorSolids) if (o.item !== ignore) list.push(o);
    return list;
  }

  blocked(p, pad, ignore = null) {
    return this.solids(ignore).some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + pad);
  }

  /** Would this fox be on top of another one there? (`but` = one that doesn't count) */
  crowded(p, but = null) {
    const mine = 0.26 * this.S;
    const c = [];
    const her = this.w.owner;
    if (her && her !== this.fox && her !== but && Math.hypot(p.x - her.anim.pos.x, p.z - her.anim.pos.z) < 0.16 + mine) return true; // (…or on top of Lorelei)
    return this.w.foxes.some((f) => {
      if (f === this.fox || f === but) return false;
      this.w.shape(f, c);
      for (let i = 0; i < 9; i += 3) if (Math.hypot(p.x - c[i], p.z - c[i + 1]) < c[i + 2] + mine) return true;
      return false;
    });
  }

  /** Before sitting or lying down: find a spot of its own. */
  *settle() {
    const a = this.a;
    if (!this.crowded(a.pos)) return;
    for (let i = 0; i < 10; i++) {
      const ang = Math.random() * TAU;
      const d = rand(0.35, 0.9) * (0.5 + 0.5 * this.S);
      const p = this.clampPoint(a.pos.x + Math.sin(ang) * d, a.pos.z + Math.cos(ang) * d, 0.92);
      if (this.crowded(p) || this.blocked(p, 0.12)) continue;
      yield* this.goTo(p.x, p.z, { speed: 'walk', timeout: 4 });
      return;
    }
  }

  keepInside() {
    if (this.fox.away) return; // off exploring: out through the bushes it goes
    const w = this.w;
    const b = w.env.bounds;
    const p = this.a.pos;
    const k = Math.hypot((p.x - b.cx) / (b.rx * 1.04), (p.z - b.cz) / (b.rz * 1.04));
    const out = (c, r) => {
      const d = Math.hypot(p.x - c.x, p.z - c.z);
      if (d >= r) return;
      // out the way it is already leaning (towards the middle of the yard if it is dead centre)
      const ang = d > 0.01 ? Math.atan2(p.x - c.x, p.z - c.z) : Math.atan2(b.cx - c.x, b.cz - c.z);
      const step = Math.min(r - d, 0.02 + (r - d) * 0.3);
      p.x += Math.sin(ang) * step;
      p.z += Math.cos(ang) * step;
    };
    if (k <= 1) this.stray = false;
    else if (this.beyond > 0 || this.stray) {
      // under a tree out of the rain, off roaming — on its way there, or back: that is allowed.
      // As far as the country goes, and round what stands in it (but under cover it sits close up to that).
      this.stray = true;
      const R = w.env.range;
      const far = Math.hypot((p.x - R.cx) / R.rx, (p.z - R.cz) / R.rz);
      if (far > 1) {
        p.x = R.cx + (p.x - R.cx) / far;
        p.z = R.cz + (p.z - R.cz) / far;
      }
      if (!this.sheltered && this.a.air <= 0.02) for (const o of w.env.wilds) out(o, o.r + 0.1 * this.S);
    } else {
      p.x = b.cx + (p.x - b.cx) / k;
      p.z = b.cz + (p.z - b.cz) / k;
    }
    if (this.beyond > 0) this.beyond--;
    // …and not standing in the bowl, on the microphone or in the mailbox (a leap may pass over them)
    if (this.a.air > 0.02) return;
    for (const key of ['bowl', 'mic', 'mailbox', 'radio']) {
      const thing = w.things[key];
      if (thing.object.visible) out(thing.object.position, thing.radius * thing.object.scale.x + 0.1 * this.S);
    }
    // …nor in what she has put in the yard, with any part of itself — but for the thing it is on, in or busy with
    const fs = Math.sin(this.a.yaw) * this.S;
    const fc = Math.cos(this.a.yaw) * this.S;
    for (const o of w.decorSolids) {
      if (o.item === this.using || o.item === this.touch) continue;
      for (const [ahead, wide] of BODY) {
        const x = p.x + fs * ahead;
        const z = p.z + fc * ahead;
        const need = o.r + wide * this.S;
        const d = Math.hypot(x - o.x, z - o.z);
        if (d >= need) continue;
        const ang = d > 0.01 ? Math.atan2(x - o.x, z - o.z) : Math.atan2(b.cx - o.x, b.cz - o.z);
        const step = Math.min(need - d, 0.02 + (need - d) * 0.3);
        p.x += Math.sin(ang) * step;
        p.z += Math.cos(ang) * step;
      }
    }
  }

  clampPoint(x, z, margin = 0.96) {
    const b = this.w.env.bounds;
    const k = Math.hypot((x - b.cx) / (b.rx * margin), (z - b.cz) / (b.rz * margin));
    return k > 1 ? V(b.cx + (x - b.cx) / k, 0, b.cz + (z - b.cz) / k) : V(x, 0, z);
  }

  /** As near (x, z) as a fox can stand out in the country: no further than that goes, and not in what stands there. */
  landAt(x, z) {
    const R = this.w.env.range;
    const k = Math.hypot((x - R.cx) / (R.rx * 0.97), (z - R.cz) / (R.rz * 0.97));
    const p = k > 1 ? V(R.cx + (x - R.cx) / k, 0, R.cz + (z - R.cz) / k) : V(x, 0, z);
    for (const o of this.w.env.wilds) {
      const need = o.r + 0.3 * this.S;
      const d = Math.hypot(p.x - o.x, p.z - o.z);
      if (d >= need) continue;
      // (out of it on the side of the yard, if she tapped right on its middle)
      const ang = d > 0.01 ? Math.atan2(p.x - o.x, p.z - o.z) : Math.atan2(-o.x, -o.z);
      p.x = o.x + Math.sin(ang) * need;
      p.z = o.z + Math.cos(ang) * need;
    }
    return p;
  }

  /** Somewhere out in the country, away from the yard, where nothing stands. */
  farPoint() {
    const R = this.w.env.range;
    const b = this.w.env.bounds;
    for (let i = 0; i < 30; i++) {
      const a = Math.random() * TAU;
      const k = Math.sqrt(Math.random()) * 0.9;
      const p = V(R.cx + Math.cos(a) * R.rx * k, 0, R.cz + Math.sin(a) * R.rz * k);
      if (Math.hypot((p.x - b.cx) / b.rx, (p.z - b.cz) / b.rz) < 1.5) continue;
      if (this.w.env.wilds.some((o) => Math.hypot(p.x - o.x, p.z - o.z) < o.r + 0.4 * this.S)) continue;
      return p;
    }
    return null;
  }

  toCamera() {
    const c = this.w.camera.position;
    return Math.atan2(c.x - this.a.pos.x, c.z - this.a.pos.z);
  }

  lookAtYou(w = 0.85) {
    this.watch = null;
    this.a.look = this.w.camera.position;
    this.a.lookW = w;
  }

  /** Which way the moon is, while she looks up at it (world.gaze) — as a yaw. */
  moonward() {
    const g = this.w.gazeView;
    return g ? Math.atan2(Math.sin(g.az), -Math.cos(g.az)) : this.a.yaw;
  }

  /** Eyes on the moon. */
  lookAtMoon(w = 1) {
    this.watch = null;
    this.a.look = this.w.moonAt;
    this.a.lookW = w;
  }

  headTop() {
    return this.a.headPoint(V());
  }

  say(text, ms) {
    this.w.say(text, ms, this.fox);
  }

  /** Where this fox comes in the family (who gets which place at the bowl, round the bed…). */
  place() {
    return Math.max(0, this.w.foxes.indexOf(this.fox));
  }

  // ----- the others

  pals(all = false) {
    return this.w.foxes.filter((f) => f !== this.fox && (all || !f.brain.asleep));
  }

  /** One of the others — the likeliest by `score(fox)` (higher is better, 0 = never), with some luck. */
  pal(score) {
    let best = null;
    let top = 0;
    for (const f of this.pals()) {
      const v = (score ? score(f) : 1) * (0.4 + Math.random());
      if (v > top) {
        top = v;
        best = f;
      }
    }
    return best;
  }

  distTo(o) {
    return Math.hypot(o.anim.pos.x - this.a.pos.x, o.anim.pos.z - this.a.pos.z);
  }

  /** How welcome one more fox is around `o`: less, the more of them are after it already. */
  room(o) {
    return 1 / (1 + 3 * this.w.foxes.filter((f) => f !== this.fox && f.brain.target === o).length);
  }

  angleTo(o) {
    return Math.atan2(o.anim.pos.x - this.a.pos.x, o.anim.pos.z - this.a.pos.z);
  }

  /** Keep the eyes on another fox. */
  lookAt(o, w = 0.8) {
    this.watch = o;
    o.anim.headPoint(this.eye);
    this.a.look = this.eye;
    this.a.lookW = w;
  }

  /** A point `gap` away from another fox, `ang` round it from its nose (π/2 = at its left side, π = behind). */
  beside(o, ang, gap) {
    const a = o.anim.yaw + ang;
    return this.clampPoint(o.anim.pos.x + Math.sin(a) * gap, o.anim.pos.z + Math.cos(a) * gap, 1);
  }

  *wait(sec) {
    let t = 0;
    while (t < sec) t += yield;
  }

  *turnTo(yaw, rate = 5) {
    const a = this.a;
    let t = 0;
    while (t < 1.6) {
      const dt = yield;
      t += dt;
      const d = wrapAngle(yaw - a.yaw);
      if (Math.abs(d) < 0.05) break;
      const step = clamp(d, -rate * dt, rate * dt);
      a.yaw += step;
      a.yawRate = step / Math.max(dt, 1e-4);
    }
    a.yawRate = 0;
  }

  // ----- finding the way

  /**
   * What a way has to lead round in a yard with things of hers in it: those, the scenery and
   * the foxes' own things (all but `ignore`) — each a circle, grown by the room this fox's
   * middle needs from it. And the corners a way may turn at: points about each circle, and
   * where two of those rings cross, as far as they lie on free ground. (Kept until something
   * moves.)
   */
  plan(ignore = null) {
    const w = this.w;
    const mic = w.things.mic.object.visible;
    const radio = w.things.radio.object.visible;
    const net = this.net;
    if (net && net.yard === w.decorSolids && net.ignore === ignore && net.mic === mic && net.radio === radio) return net;
    const S = this.S;
    const walls = w.decorSolids.map((o) => ({ x: o.x, z: o.z, R: o.r + PAD * S }));
    for (const o of this.solids(ignore, false)) walls.push({ x: o.x, z: o.z, R: o.r + ASIDE * S });
    const rings = walls.map((o) => o.R / Math.cos(Math.PI / RING) + 0.02);
    const nodes = [];
    const add = (x, z) => {
      if (this.inYard({ x, z }, 1.02) && !walls.some((o) => Math.hypot(x - o.x, z - o.z) < o.R - 1e-3)) nodes.push({ x, z });
    };
    walls.forEach((c, i) => {
      const r = rings[i];
      for (let n = 0; n < RING; n++) add(c.x + Math.sin((n / RING) * TAU) * r, c.z + Math.cos((n / RING) * TAU) * r);
      for (let j = i + 1; j < walls.length; j++) {
        const o = walls[j];
        const d = Math.hypot(o.x - c.x, o.z - c.z);
        if (d < 1e-6 || d >= r + rings[j] || d <= Math.abs(r - rings[j])) continue;
        const along = (r * r - rings[j] * rings[j] + d * d) / (2 * d);
        const off = Math.sqrt(Math.max(0, r * r - along * along));
        const ux = (o.x - c.x) / d;
        const uz = (o.z - c.z) / d;
        add(c.x + ux * along + uz * off, c.z + uz * along - ux * off);
        add(c.x + ux * along - uz * off, c.z + uz * along + ux * off);
      }
    });
    return (this.net = { yard: w.decorSolids, ignore, mic, radio, walls, nodes });
  }

  /**
   * Is the straight stretch from `p` to `q` clear of the `walls`? Where one end of it is close
   * up to one already (a fox that has just got off the bench, a place by the bowl), the
   * stretch may lead away from it there — but not on past its middle.
   */
  clearWay(p, q, walls) {
    const dx = q.x - p.x;
    const dz = q.z - p.z;
    const len2 = dx * dx + dz * dz;
    for (const o of walls) {
      const px = p.x - o.x;
      const pz = p.z - o.z;
      // (the point of the stretch nearest the middle of this circle)
      const k = len2 > 1e-9 ? clamp(-(px * dx + pz * dz) / len2, 0, 1) : 0;
      const near = Math.hypot(px + dx * k, pz + dz * k);
      if (near < o.R && near < Math.min(Math.hypot(px, pz), Math.hypot(q.x - o.x, q.z - o.z)) - 0.02) return false;
    }
    return true;
  }

  /**
   * The way to a point: [a corner, …, the point itself] — the shortest there is from corner to
   * corner (A*). Straight at it where nothing is in the way (and in a yard with nothing of
   * hers in it: there the fox leans away from what it passes, see goTo). Where no way leads
   * there at all, it ends at the corner nearest the point that one does lead to.
   */
  route(to, ignore = null, from = this.a.pos) {
    if (!this.w.decorSolids.length) return [to];
    const { walls, nodes } = this.plan(ignore);
    if (this.clearWay(from, to, walls)) return [to];
    const n = nodes.length; // (the point itself is number n)
    const at = (i) => (i < n ? nodes[i] : to);
    const far = new Float32Array(n + 1).fill(Infinity); // how far it is to each by the best way found so far
    const left = new Float32Array(n + 1); //               …and from there on, as the crow flies
    const via = new Int16Array(n + 1).fill(-1);
    const state = new Uint8Array(n + 1); //                1 = to be looked at, 2 = done
    for (let i = 0; i <= n; i++) left[i] = Math.hypot(to.x - at(i).x, to.z - at(i).z);
    for (let i = 0; i < n; i++) {
      if (!this.clearWay(from, nodes[i], walls)) continue;
      far[i] = Math.hypot(nodes[i].x - from.x, nodes[i].z - from.z);
      state[i] = 1;
    }
    let end = -1;
    for (;;) {
      let cur = -1;
      for (let i = 0; i <= n; i++) if (state[i] === 1 && (cur < 0 || far[i] + left[i] < far[cur] + left[cur])) cur = i;
      if (cur < 0) break;
      state[cur] = 2;
      if (cur === n) {
        end = n;
        break;
      }
      const c = nodes[cur];
      for (let j = 0; j <= n; j++) {
        if (state[j] === 2) continue;
        const q = at(j);
        const d = far[cur] + Math.hypot(q.x - c.x, q.z - c.z);
        if (d >= far[j] || !this.clearWay(c, q, walls)) continue;
        far[j] = d;
        via[j] = cur;
        state[j] = 1;
      }
    }
    if (end < 0) {
      // no way there: as near as one leads — or, shut in where it stands, straight at it and what happens happens
      for (let i = 0; i < n; i++) if (state[i] === 2 && (end < 0 || left[i] < left[end])) end = i;
      if (end < 0 || left[end] > Math.hypot(to.x - from.x, to.z - from.z) - 0.15) return [to];
    }
    const path = [at(end)];
    for (let i = via[end]; i >= 0; i = via[i]) path.unshift(nodes[i]);
    return path;
  }

  /**
   * Walk, trot or run to a point: round what stands in the yard (route) and round the other
   * foxes (all but `skip`, the one it is going to), leaning away from them as it passes.
   */
  *goTo(x, z, { speed = 'walk', stop = 0.06, ignore = null, timeout = 9, moving = null, skip = null, beyond = false, leg = false } = {}) {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    if ((beyond || this.stray) && !moving && !leg) {
      // out in the country: round whatever stands in the way, from one place to turn at to the next — then on to where it is going
      const went = Math.hypot(x - a.pos.x, z - a.pos.z);
      for (const by of w.wayThrough(a.pos, { x, z })) {
        yield* this.goTo(by.x, by.z, { speed: speed === 'walk' ? 'trot' : speed, stop: 0.3, ignore, timeout: 4 + went * 1.6, skip, beyond: true, leg: true });
      }
    }
    if (this.stray && !beyond) {
      // home from out in the country: not at a stroll, and it is given the time the way takes
      if (speed === 'walk') speed = 'trot';
      timeout = Math.max(timeout, 5 + Math.hypot(x - a.pos.x, z - a.pos.z) * 2.2);
    }
    const top = SPEED[this.reduce && speed === 'run' ? 'trot' : speed] * S * this.pace;
    const turnRate = speed === 'walk' ? 3.2 : 5.5;
    const solids = this.solids(ignore, false);
    this.skip = skip;
    let t = 0;
    let want = 0;
    let lean = 0;
    let dist = 0;
    if (!moving && !beyond) {
      // somewhere all of it can stand: clear of the things in the yard (but for the one it is going to use)
      const free = w.clearOf({ x, z }, 0.5 * S, this.touch || ignore);
      const inside = this.clampPoint(free.x, free.z, 1);
      x = inside.x;
      z = inside.z;
    }
    // …and the way there, corner by corner. It is looked for again when the yard changes under
    // its feet, and as whatever it is after moves on.
    const to = { x, z };
    const ahead = { x, z };
    let net = w.decorSolids.length ? this.plan(ignore) : null;
    let path = this.route(to, ignore);
    let planned = 0;
    if (path.length > 1) {
      // (a long way round takes longer)
      let len = 0;
      path.forEach((p, i) => (len += Math.hypot(p.x - (i ? path[i - 1].x : a.pos.x), p.z - (i ? path[i - 1].z : a.pos.z))));
      timeout *= clamp(len / Math.max(0.2, Math.hypot(x - a.pos.x, z - a.pos.z)), 1, 2.5);
    }
    // (where it was a moment ago: wedged in somewhere, it gives up)
    let mark = 0;
    let mx = a.pos.x;
    let mz = a.pos.z;
    let still = 0;
    // (…and whether its last step took it anywhere: up against something, it does not run on the spot)
    let fromX = a.pos.x;
    let fromZ = a.pos.z;
    let stride = 0;
    let held = 0;
    // lean away from anything solid just ahead
    const mind = (ox, oz, r, k = 1) => {
      ox -= a.pos.x;
      oz -= a.pos.z;
      const od = Math.hypot(ox, oz);
      const reach = r + ASIDE * S;
      if (od > reach + 0.45 || od > dist) return;
      const side = Math.sin(want) * oz - Math.cos(want) * ox; //  > 0: the obstacle is to the right
      const ahead = (Math.sin(want) * ox + Math.cos(want) * oz) / (od || 1);
      if (ahead < 0.2 || Math.abs(side) > reach) return;
      lean += (side > 0 ? 1 : -1) * clamp((reach + 0.45 - od) / 0.45, 0, 1) * 1.2 * k;
    };
    for (;;) {
      const dt = yield;
      t += dt;
      if (beyond) this.beyond = 2; // (out of the yard, if that is where it leads)
      if (moving) {
        const m = moving();
        to.x = m.x;
        to.z = m.z;
      }
      const now = w.decorSolids.length ? this.plan(ignore) : null;
      if (now !== net || (now && moving && t - planned > 0.3)) {
        net = now;
        path = this.route(to, ignore);
        planned = t;
      }
      // on to the next corner as soon as the way to it lies open — seen from a little further on,
      // where its nose is: it turns before that pokes into whatever stands beyond the corner
      while (path.length > 1) {
        const cx = path[0].x - a.pos.x;
        const cz = path[0].z - a.pos.z;
        const cd = Math.hypot(cx, cz);
        const k = Math.min(1, (LEAD * S) / Math.max(cd, 1e-6));
        ahead.x = a.pos.x + cx * k;
        ahead.z = a.pos.z + cz * k;
        if (cd > 0.1 * S + 0.04 && !this.clearWay(ahead, path[1], net.walls) && !this.clearWay(a.pos, path[1], net.walls)) break;
        path.shift();
      }
      const last = path.length === 1;
      const dx = path[0].x - a.pos.x;
      const dz = path[0].z - a.pos.z;
      dist = Math.hypot(dx, dz);
      if ((last && dist < stop * S) || t > timeout) break;
      held = stride > 1e-4 && Math.hypot(a.pos.x - fromX, a.pos.z - fromZ) < 0.4 * stride ? held + dt : 0;
      if (held > 0.3 && last && dist < 0.6 * S) break; // as near as it can get
      if (t - mark > 0.7) {
        still = Math.hypot(a.pos.x - mx, a.pos.z - mz) < 0.04 * S ? still + 1 : 0;
        if (still > 1) break;
        mark = t;
        mx = a.pos.x;
        mz = a.pos.z;
      }
      want = Math.atan2(dx, dz);
      lean = 0;
      // (in a yard with nothing of hers in it there is no way to find: it steps round the bowl, the bed and the scenery as it meets them)
      if (!net) for (const o of solids) mind(o.x, o.z, o.r);
      // …and out in the country, after something that moves (there is no way laid out to that), round whatever stands there
      if (this.stray && moving) for (const o of w.env.wilds) mind(o.x, o.z, o.r);
      // the other foxes, rump and shoulders of each — less and less as this one nears where it is going
      const near = last ? clamp(dist / (0.7 * S), 0, 1) : 1;
      for (const f of w.foxes) {
        if (f === this.fox || f === skip || f.anim.air > 0.02) continue;
        if (beyond && f.brain.sheltered) continue; // (under cover everyone sits close: it squeezes in among them)
        const fs = Math.sin(f.anim.yaw) * f.rig.scale;
        const fc = Math.cos(f.anim.yaw) * f.rig.scale;
        mind(f.anim.pos.x - fs * 0.2, f.anim.pos.z - fc * 0.2, 0.13 * f.rig.scale, near);
        mind(f.anim.pos.x + fs * 0.3, f.anim.pos.z + fc * 0.3, 0.13 * f.rig.scale, near);
      }
      // …and Lorelei
      const her = w.owner;
      if (her && her !== this.fox && her !== skip && her.anim.air < 0.02) mind(her.anim.pos.x, her.anim.pos.z, 0.16, near);
      want += clamp(lean, -1.35, 1.35);
      const d = wrapAngle(want - a.yaw);
      const step = clamp(d, -turnRate * dt, turnRate * dt);
      a.yaw += step;
      a.yawRate = step / Math.max(dt, 1e-4);
      const facing = Math.max(0, Math.cos(d));
      // (it slows down for where it is going — not for a corner on the way)
      const target = Math.abs(d) > 1.7 ? 0 : top * (0.2 + 0.8 * facing * facing) * (last && !leg ? clamp(dist / (0.4 * S), 0.3, 1) : 1) * (held > 0.12 ? 0.3 : 1);
      a.speed = damp(a.speed, target, held > 0.12 ? 14 : 5, dt);
      this.driven = true;
      fromX = a.pos.x;
      fromZ = a.pos.z;
      stride = a.speed * dt;
      a.pos.x += Math.sin(a.yaw) * a.speed * dt;
      a.pos.z += Math.cos(a.yaw) * a.speed * dt;
    }
    if (leg) return; // (a place to turn at on the way: on it goes)
    while (a.speed > 0.03) {
      const dt = yield;
      if (beyond) this.beyond = 2;
      a.speed = damp(a.speed, 0, 12, dt);
      this.driven = true;
      a.yawRate = damp(a.yawRate, 0, 12, dt);
      a.pos.x += Math.sin(a.yaw) * a.speed * dt;
      a.pos.z += Math.cos(a.yaw) * a.speed * dt;
    }
    a.speed = 0;
    a.yawRate = 0;
  }

  /** The fox's leap: up in an arc, down nose-first onto `to`. */
  *leap(to, height = 0.42) {
    const a = this.a;
    const from = a.pos.clone();
    const T = 0.56;
    let t = 0;
    a.speed = 0;
    while (t < T) {
      const dt = yield;
      t += dt;
      const k = Math.min(1, t / T);
      a.pos.lerpVectors(from, to, k);
      a.air = 4 * height * this.S * k * (1 - k);
      a.setPose(k < 0.5 ? 'leap' : 'dive', 12);
    }
    a.air = 0;
    a.pos.copy(to);
    a.setPose('bow', 16);
    this.w.thump(a.nosePoint(V()));
    yield* this.wait(0.38);
  }

  // ---------------------------------------------------------------- on its own

  /**
   * Off into the country round the yard: to a place or two out there — a look about, a sniff
   * at the ground, a sit in the sun — and home again.
   */
  *roam() {
    const a = this.a;
    const stops = 1 + (Math.random() < 0.45 ? 1 : 0);
    for (let i = 0; i < stops; i++) {
      const p = this.farPoint();
      if (!p) break;
      const far = Math.hypot(p.x - a.pos.x, p.z - a.pos.z);
      yield* this.goTo(p.x, p.z, { speed: Math.random() < (this.w.state.mood === 'happy' ? 0.45 : 0.15) ? 'run' : 'trot', beyond: true, stop: 0.12, timeout: 6 + far * 2.2 });
      const pick = Math.random();
      if (pick < 0.4) {
        a.setPose('sniff', 5);
        yield* this.wait(rand(1.4, 2.6));
        a.setPose('stand', 5);
      } else if (pick < 0.7) yield* this.lookAbout(rand(1.5, 3));
      else {
        yield* this.turnTo(this.toCamera() + rand(-0.7, 0.7), 4);
        a.setPose('sit', 5);
        yield* this.wait(rand(2.5, 5));
        a.setPose('stand', 5);
      }
    }
    const home = this.randomPoint(0.7);
    yield* this.goTo(home.x, home.z, { speed: 'trot', timeout: 8 + Math.hypot(home.x - a.pos.x, home.z - a.pos.z) * 2.2 });
    yield* this.lookAbout(rand(0.6, 1.4));
  }

  *wander() {
    const p = this.randomPoint();
    yield* this.goTo(p.x, p.z, { speed: Math.random() < (this.w.state.mood === 'happy' ? 0.5 : 0.2) + (this.baby ? 0.25 : 0) ? 'trot' : 'walk' });
    yield* this.lookAbout(rand(0.8, 2.2));
  }

  *lookAbout(sec = rand(1.5, 3)) {
    const a = this.a;
    this.loose = true;
    a.setPose(Math.random() < 0.5 ? 'alert' : 'stand');
    let t = 0;
    let next = 0;
    const target = V();
    while (t < sec) {
      const dt = yield;
      t += dt;
      if (t >= next) {
        next = t + rand(0.6, 1.4);
        if (Math.random() < 0.4) this.lookAtYou(0.8);
        else {
          const ang = a.yaw + rand(-1.3, 1.3);
          target.set(a.pos.x + Math.sin(ang) * 2, rand(0.1, 0.7), a.pos.z + Math.cos(ang) * 2);
          this.watch = null;
          a.look = target;
          a.lookW = 0.9;
        }
      }
    }
  }

  *sitAwhile(sec = rand(4, 8)) {
    const a = this.a;
    yield* this.settle();
    yield* this.turnTo(this.toCamera() + rand(-0.7, 0.7), 4);
    a.setPose('sit', 5);
    this.lookAtYou(0.8);
    yield* this.wait(0.9);
    if (Math.random() < 0.4 / this.w.foxes.length) this.say(this.w.host.moodLine(), 3200);
    let t = 0;
    while (t < sec) {
      const dt = yield;
      t += dt;
      a.mood.wag = this.w.state.mood === 'happy' ? 0.35 + 0.3 * Math.max(0, Math.sin(t * 0.9)) : 0;
      if (Math.random() < dt * 0.25) this.lookAtYou(Math.random() < 0.7 ? 0.85 : 0.1);
    }
  }

  *lieAwhile(sec = rand(5, 10)) {
    const a = this.a;
    yield* this.settle();
    yield* this.turnTo(this.toCamera() + rand(-1, 1), 4);
    a.setPose('lie', 4.5);
    this.lookAtYou(0.6);
    let t = 0;
    while (t < sec) {
      const dt = yield;
      t += dt;
      if (Math.random() < dt * 0.2) this.lookAtYou(Math.random() < 0.6 ? 0.7 : 0);
    }
  }

  *sniffAbout() {
    const a = this.a;
    for (let i = 0; i < 2 + Math.floor(Math.random() * 2); i++) {
      const p = this.randomPoint();
      a.setPose('sniff', 5);
      a.noseY = 0.05;
      yield* this.goTo(p.x, p.z, { speed: 'walk' });
      let t = 0;
      const sec = rand(0.8, 1.6);
      while (t < sec) {
        const dt = yield;
        t += dt;
        a.noseY = 0.035 + Math.max(0, Math.sin(t * 16)) * 0.012;
      }
    }
    a.noseY = null;
    a.setPose('alert');
    yield* this.wait(0.6);
  }

  *groom() {
    const a = this.a;
    yield* this.settle();
    a.setPose('lie', 5);
    yield* this.wait(1);
    a.noseY = 0.07;
    a.mood.chew = 0.7;
    a.mood.eyes = 'happy';
    yield* this.wait(rand(2, 3.4));
    a.mood.chew = 0;
    a.mood.eyes = 'open';
    a.noseY = null;
    yield* this.wait(0.7);
  }

  *yawn() {
    const a = this.a;
    a.setPose('alert', 3);
    yield* this.wait(0.3);
    a.mood.mouth = 1;
    a.mood.eyes = 'happy';
    a.mood.ears = 0.6;
    yield* this.wait(1.25);
    a.mood.mouth = 0;
    a.mood.eyes = 'open';
    a.mood.ears = 0;
    yield* this.wait(0.5);
  }

  *stretch() {
    const a = this.a;
    a.setPose('bow', 3.5);
    a.mood.ears = 0.5;
    a.mood.eyes = 'happy';
    yield* this.wait(1.5);
    a.mood.eyes = 'open';
    a.setPose('alert', 5);
    yield* this.wait(0.6);
  }

  *shake() {
    const a = this.a;
    if (this.fox.wet > 0.12) return void (yield* this.shakeOff()); // (wet from the rain or a puddle: drops fly)
    a.mood.shake = 1;
    a.mood.eyes = 'happy';
    yield* this.wait(0.85);
    a.mood.shake = 0;
    a.mood.eyes = 'open';
    yield* this.wait(0.4);
  }

  *zoomies() {
    const a = this.a;
    a.mood.tailUp = 0.3;
    for (let i = 0; i < 3 + Math.floor(Math.random() * 2); i++) {
      const p = this.randomPoint(0.95);
      yield* this.goTo(p.x, p.z, { speed: 'run', stop: 0.3, timeout: 4 });
    }
    a.mood.pant = 1;
    a.mood.wag = 0.6;
    this.lookAtYou();
    yield* this.wait(2);
  }

  *chaseTail() {
    const a = this.a;
    yield* this.settle();
    const dir = Math.random() < 0.5 ? 1 : -1;
    a.setPose(dir > 0 ? 'spinL' : 'spinR', 6);
    let t = 0;
    const sec = rand(1.8, 2.8);
    while (t < sec) {
      const dt = yield;
      t += dt;
      const rate = 6.2 * dir * Math.min(1, t * 2) * Math.min(1, (sec - t) * 3);
      a.yaw += rate * dt;
      a.yawRate = rate;
    }
    a.yawRate = 0;
    a.setPose('stand');
    a.mood.shake = 0.5;
    yield* this.wait(0.5);
    a.mood.shake = 0;
    this.lookAtYou();
    yield* this.wait(0.7);
  }

  *playBow() {
    const a = this.a;
    yield* this.turnTo(this.toCamera(), 5);
    a.setPose('bow', 8);
    a.mood.wag = 1;
    this.lookAtYou(0.6);
    yield* this.wait(1.3);
    yield* this.hop(0.16);
    yield* this.wait(0.3);
  }

  *pounceSomewhere() {
    const a = this.a;
    const ang = a.yaw + rand(-0.9, 0.9);
    const d = rand(0.55, 0.8) * this.S;
    const to = this.clampPoint(a.pos.x + Math.sin(ang) * d, a.pos.z + Math.cos(ang) * d, 0.9);
    if (this.crowded(to) || this.blocked(to, 0.12 * this.S)) return void (yield* this.playBow());
    yield* this.pounce(to);
    a.noseY = 0.04;
    a.setPose('sniff', 6);
    yield* this.wait(0.8);
    a.noseY = null;
  }

  /** Stalk, wiggle, leap. */
  *pounce(to) {
    const a = this.a;
    yield* this.turnTo(Math.atan2(to.x - a.pos.x, to.z - a.pos.z), 6);
    a.setPose('crouch', 7);
    this.watch = null;
    a.look = to;
    a.lookW = 0.5;
    yield* this.wait(0.45);
    a.mood.wiggle = 1;
    yield* this.wait(0.55);
    a.mood.wiggle = 0;
    a.lookW = 0;
    yield* this.leap(to);
    a.setPose('stand', 8);
  }

  *chaseButterfly() {
    const a = this.a;
    const list = this.w.env.butterflies;
    if (!list || !list.length) return;
    const fly = list[Math.floor(Math.random() * list.length)].at;
    a.look = fly;
    a.lookW = 0.9;
    a.setPose('alert');
    yield* this.wait(0.6);
    const near = () => this.clampPoint(fly.x, fly.z, 0.9);
    yield* this.goTo(0, 0, { speed: 'trot', stop: 0.75, timeout: 3.5, moving: near });
    const to = near();
    if (Math.hypot(to.x - a.pos.x, to.z - a.pos.z) < 1.1 * this.S && !this.crowded(to) && !this.blocked(to, 0.12 * this.S)) yield* this.pounce(to);
    a.look = fly;
    a.lookW = 0.9;
    a.mood.wag = 0.5;
    yield* this.wait(1.1);
  }

  *beg() {
    const a = this.a;
    const bowl = this.w.things.bowl;
    const at = this.besideBowl();
    this.close = true;
    yield* this.goTo(at.x, at.z, { speed: 'walk' });
    yield* this.turnTo(Math.atan2(bowl.object.position.x - a.pos.x, bowl.object.position.z - a.pos.z), 5);
    a.setPose('sniff', 5);
    a.noseY = 0.09;
    yield* this.wait(1.1);
    a.noseY = null;
    yield* this.turnTo(this.toCamera(), 4);
    a.setPose('sit', 5);
    a.mood.ears = 0.4;
    this.lookAtYou(0.9);
    yield* this.wait(0.8);
    if (Math.random() < 1.6 / this.w.foxes.length) this.say(this.w.host.line('hungry'), 3400);
    yield* this.wait(rand(3, 5));
  }

  *mope() {
    const a = this.a;
    yield* this.settle();
    yield* this.turnTo(this.toCamera() + rand(-0.6, 0.6), 3);
    a.setPose('sad', 3.5);
    a.mood.breath = 0.7;
    this.lookAtYou(0.5);
    yield* this.wait(1.6);
    if (Math.random() < 0.5 / this.w.foxes.length) this.say(this.w.host.moodLine(), 3200);
    yield* this.wait(rand(3.5, 6));
  }

  /** Its place for the night: the bed for one of them, the others curled up round it. */
  sleepSpot() {
    const w = this.w;
    const bed = w.things.bed;
    const c = bed.object.position;
    // (where there is a house, the fox she is with has that; the bed is for the next one)
    const housed = w.house() ? w.denFox : null;
    if (!w.foxes.includes(w.bedFox) || w.bedFox === housed) w.bedFox = w.foxes.find((f) => f !== housed) || null;
    if (this.fox === w.bedFox) return { x: c.x, z: c.z, yaw: 0.9 };
    // the others lie round the bed, each curled towards it and with as much of the ring as its size needs,
    // starting from the side that faces the yard
    const rest = w.foxes.filter((f) => f !== w.bedFox);
    const b = w.env.bounds;
    const R = bed.radius * bed.object.scale.x;
    const out = (f) => R + 0.2 * f.rig.scale + 0.06;
    const arc = (f) => (0.78 * f.rig.scale + 0.12) / out(f);
    const fit = Math.min(1, (TAU * 0.97) / rest.reduce((s, f) => s + arc(f), 0));
    let ang = Math.atan2(b.cx - c.x, b.cz - c.z) - (rest.reduce((s, f) => s + arc(f), 0) * fit) / 2;
    for (const f of rest) {
      if (f === this.fox) {
        ang += (arc(f) * fit) / 2;
        break;
      }
      ang += arc(f) * fit;
    }
    const at = this.clampPoint(c.x + Math.sin(ang) * out(this.fox), c.z + Math.cos(ang) * out(this.fox), 1);
    return { x: at.x, z: at.z, yaw: ang + Math.PI / 2 };
  }

  *sleep() {
    const a = this.a;
    this.close = true;
    // the one that has the house sleeps in its doorway…
    const house = this.w.denFor(this.fox);
    let housed = this.using === house && !!house;
    if (house && !housed && this.w.claim(house, this.fox)) {
      yield* this.yawn();
      housed = yield* this.intoDen(house, 'walk');
      if (!housed) this.w.denFox = null; // no way in: with the others, then
    }
    let dry = null;
    if (housed) {
      yield* this.wait(1.2);
      a.mood.breath = 0.5;
      a.mood.eyes = 'sleep';
      a.noseY = 0.06;
    } else {
      // …the others on the bed and round it — or, on a wet night, each in its place under cover
      dry = this.w.sky.shelterFrom(this.fox) ? this.w.coverFor(this.fox) : null;
      const at = dry ? { x: dry.x, z: dry.z, yaw: dry.yaw + 0.9 } : this.sleepSpot();
      if (Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.12) {
        yield* this.yawn();
        if (dry) yield* this.toCover(dry, 'walk');
        else yield* this.goTo(at.x, at.z, { speed: 'walk', ignore: this.w.things.bed, stop: 0.05 });
      }
      if (dry && this.fox.wet > 0.15) yield* this.shakeOff(); // (nobody goes to sleep wet)
      yield* this.turnTo(at.yaw, 3); // on the bed: curled with its face towards you
      a.setPose('sleep', 2.6);
      a.mood.breath = 0.5;
      yield* this.wait(1.6);
      a.mood.eyes = 'sleep';
      a.noseY = 0.075;
    }
    this.asleep = true;
    this.sheltered = housed || !!dry;
    let t = 0;
    let z = 1.5 + this.place() * 0.6;
    while (this.w.state.mood === 'sleepy') {
      const dt = yield;
      t += dt;
      if (dry) this.beyond = 2;
      if (t > z) {
        z = t + 2.4 + this.w.foxes.length * 0.4;
        this.w.fx.emit('💤', this.headTop(), { size: 0.15 * (0.6 + 0.4 * this.S), rise: 0.22, life: 2.2, drift: 0.12 });
      }
    }
    yield* this.wake();
  }

  *wake() {
    const a = this.a;
    this.asleep = false;
    a.mood.eyes = 'open';
    a.noseY = null;
    if (this.using) {
      // in its house: a yawn in the doorway, and out it comes
      a.setPose('den', 3);
      this.lookAtYou(0.6);
      yield* this.wait(0.9);
      a.mood.mouth = 1;
      a.mood.eyes = 'happy';
      yield* this.wait(1.2);
      a.mood.mouth = 0;
      a.mood.eyes = 'open';
      yield* this.wait(0.4);
      return;
    }
    a.setPose('lie', 3);
    this.lookAtYou(0.6);
    yield* this.wait(0.9);
    yield* this.yawn();
    yield* this.stretch();
  }

  // ---------------------------------------------------------------- with each other

  /** Go up to another fox and touch noses. */
  *visit(o = this.pal((f) => this.room(f))) {
    if (!o) return;
    const a = this.a;
    this.target = o;
    const gap = REACH * (o.rig.scale + this.S) + 0.04;
    this.lookAt(o, 0.7);
    yield* this.goTo(0, 0, { speed: this.baby ? 'trot' : 'walk', stop: 0.12, timeout: 6, moving: () => this.beside(o, 0, gap) });
    if (this.distTo(o) > gap + 0.45 * this.S) return; // it wandered off
    yield* this.turnTo(this.angleTo(o), 5);
    if (o.brain.free) o.brain.do('greetBack', this.fox);
    yield* this.sniffNose(o, rand(1.8, 2.8));
  }

  *greetBack(o) {
    yield* this.turnTo(this.angleTo(o), 5);
    yield* this.sniffNose(o, rand(1.4, 2.2));
  }

  *sniffNose(o, sec) {
    const a = this.a;
    const nose = V();
    this.lookAt(o, 0.6);
    a.mood.wag = 0.8;
    let t = 0;
    while (t < sec) {
      t += yield;
      a.noseY = clamp(o.anim.nosePoint(nose).y / this.S, 0.08, 0.62) + Math.max(0, Math.sin(t * 15)) * 0.01;
    }
    a.noseY = null;
    yield* this.wait(0.4);
  }

  /** "Catch me!" — a play bow at another fox; if it is up for it, it runs and this one gives chase. */
  *chase(o = this.pal((f) => (f.brain.free ? 2 : 0.3) / (0.5 + this.distTo(f)))) {
    if (!o) return;
    const a = this.a;
    this.lookAt(o, 0.8);
    yield* this.goTo(0, 0, { speed: 'trot', stop: 0.15, timeout: 4, moving: () => this.beside(o, 0, REACH * (o.rig.scale + this.S) + 0.25) });
    yield* this.turnTo(this.angleTo(o), 6);
    a.setPose('bow', 8);
    a.mood.wag = 1;
    yield* this.wait(0.9);
    if (!o.brain.free) return void (yield* this.hop(0.14));
    o.brain.do('flee', this.fox);
    a.setPose('stand', 9);
    a.mood.tailUp = 0.3;
    const until = this.w.time + 7;
    const heels = () => this.beside(o, Math.PI, 0.35 * o.rig.scale + REACH * this.S + 0.05); // right behind its tail
    while (o.brain.doing === 'flee' && this.w.time < until) {
      yield* this.goTo(0, 0, { speed: 'run', stop: 0.3, timeout: 1.4, moving: heels });
      yield;
    }
    yield* this.turnTo(this.angleTo(o), 6);
    this.lookAt(o, 0.8);
    a.mood.pant = 1;
    a.mood.wag = 0.8;
    yield* this.wait(1.6);
  }

  *flee(o) {
    const a = this.a;
    a.mood.tailUp = 0.3;
    for (let i = 0; i < 3; i++) {
      // the far side of the yard from the one behind
      let to = this.randomPoint(0.94);
      for (let k = 0; k < 3; k++) {
        const p = this.randomPoint(0.94);
        if (Math.hypot(p.x - o.anim.pos.x, p.z - o.anim.pos.z) > Math.hypot(to.x - o.anim.pos.x, to.z - o.anim.pos.z)) to = p;
      }
      yield* this.goTo(to.x, to.z, { speed: 'run', stop: 0.3, timeout: 3.2 });
    }
    yield* this.turnTo(this.angleTo(o), 6);
    this.lookAt(o, 0.8);
    a.setPose('bow', 8);
    a.mood.wag = 1;
    yield* this.wait(0.8);
    a.setPose('stand', 8);
    a.mood.pant = 1;
    yield* this.wait(1.2);
  }

  /** Trot along behind another fox for a while (what kits do all day). */
  *follow(o = this.pal((f) => (f.baby ? 0.3 : 1) * (f.brain.doing === 'follow' ? 0.1 : 1) * this.room(f))) {
    if (!o) return;
    const a = this.a;
    this.target = o;
    const side = Math.random() < 0.5 ? 0.6 : -0.6;
    const gap = 0.35 * o.rig.scale + REACH * this.S + 0.12; // nose a little behind its tail
    const at = () => this.beside(o, Math.PI + side, gap);
    const until = this.w.time + rand(6, 11);
    this.lookAt(o, 0.5);
    while (this.w.time < until && !o.brain.asleep) {
      const p = at();
      const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z);
      if (d > 0.3 * this.S + 0.08) yield* this.goTo(0, 0, { speed: d > 1.2 * this.S ? 'run' : 'trot', stop: 0.25, timeout: 1.2, moving: at });
      else yield;
      this.lookAt(o, 0.5);
    }
    yield* this.turnTo(this.angleTo(o), 4);
    a.setPose('sit', 5);
    a.mood.wag = 0.4;
    yield* this.wait(rand(1.5, 3));
  }

  /** Lie down against another fox that is resting. */
  *snuggle(o = this.pal((f) => (RESTING.has(f.brain.doing) ? 3 : 0) * (this.baby && !f.baby ? 2 : 1) * this.room(f))) {
    if (!o) return void (yield* this.lieAwhile());
    const a = this.a;
    this.target = o;
    const gap = 0.15 * o.rig.scale + 0.14 * this.S;
    const at = (side) => this.beside(o, (side * Math.PI) / 2 - 0.25 * side, gap);
    // whichever side nobody is lying on yet
    let side = Math.random() < 0.5 ? 1 : -1;
    if (this.crowded(at(side), o)) side = -side;
    if (this.crowded(at(side), o)) return void (yield* this.lieAwhile());
    this.lookAt(o, 0.5);
    yield* this.goTo(0, 0, { speed: 'walk', stop: 0.07, timeout: 7, skip: o, moving: () => at(side) });
    if (this.distTo(o) > gap + 0.3 * this.S || !RESTING.has(o.brain.doing)) return; // it got up and left
    yield* this.turnTo(o.anim.yaw + rand(-0.35, 0.35), 3.5); // the same way round
    this.skip = null; // settled: from here on it is in the way like anyone else
    a.setPose('lie', 4);
    a.lookW = 0;
    yield* this.wait(1.2);
    a.mood.eyes = 'happy';
    a.mood.breath = 0.7;
    const until = this.w.time + rand(6, 12);
    while (this.w.time < until && this.distTo(o) < gap + 0.3 * this.S) yield;
    a.mood.eyes = 'open';
    yield* this.wait(0.5);
  }

  /** A kit's favourite game: stalk a grown-up's tail and jump on it. */
  *pounceTail(o = this.pal((f) => (f.baby ? 0.2 : 1) * (f.anim.speed < 0.05 ? 1 : 0) * this.room(f))) {
    if (!o) return;
    const a = this.a;
    this.target = o;
    const tail = o.rig.tails[Math.floor(o.rig.tails.length / 2)].bones;
    const tip = V();
    const target = () => {
      tip.setFromMatrixPosition(tail[tail.length - 1].matrixWorld);
      return this.clampPoint(tip.x, tip.z, 1);
    };
    this.lookAt(o, 0.4);
    yield* this.goTo(0, 0, { speed: 'walk', stop: 0.7, timeout: 6, skip: o, moving: target });
    const to = target();
    if (o.anim.speed > 0.05 || Math.hypot(to.x - a.pos.x, to.z - a.pos.z) > 1.1 * this.S) return;
    yield* this.pounce(to);
    if (o.brain.free) o.brain.do('startled', this.fox);
    a.mood.wag = 1;
    yield* this.wait(0.9);
  }

  *startled(o) {
    const a = this.a;
    yield* this.hop(0.12);
    yield* this.turnTo(this.angleTo(o), 7);
    this.lookAt(o, 0.9);
    a.mood.ears = 0.3;
    yield* this.wait(1.3);
  }

  /**
   * Lorelei is coming over to stroke it: it sits and waits for her, eyes on her — and when her
   * hand is on its head it leans into it, eyes shut, for as long as she goes on (keeper.js: petOne).
   */
  *strokedBy(o) {
    const a = this.a;
    const hers = () => o.brain.doing === 'petOne' && o.brain.target === this.fox;
    a.speed = 0;
    a.setPose('sit', 6);
    this.lookAt(o, 0.9);
    a.mood.wag = 0.7;
    yield; // (she has only just made up her mind)
    for (let t = 0; hers() && !o.brain.stroking && t < 10; ) t += yield;
    if (!hers() || !o.brain.stroking) return;
    a.setPose('pet', 6);
    a.mood.eyes = 'happy';
    a.mood.wag = 1;
    a.lookW = 0.3;
    while (hers() && o.brain.stroking) yield;
    a.mood.eyes = 'open';
    a.setPose('sit', 5);
    this.lookAt(o, 0.9);
    a.mood.wag = 0.6;
    yield* this.wait(1.4);
  }

  /** Up to Lorelei, a sniff at her hand, a look up at her — and if she has nothing else to do, she kneels down and strokes it. */
  *nuzzle(o) {
    const a = this.a;
    this.target = o;
    const gap = 0.3 * this.S + 0.22;
    this.lookAt(o, 0.7);
    yield* this.goTo(0, 0, { speed: this.baby ? 'trot' : 'walk', stop: 0.1, timeout: 6, skip: o, moving: () => this.beside(o, 0.5, gap) });
    if (this.distTo(o) > gap + 0.4 * this.S) return; // she walked on
    yield* this.turnTo(this.angleTo(o), 5);
    const hand = V();
    a.mood.wag = 0.8;
    for (let t = 0; t < 1.6; ) {
      t += yield;
      a.noseY = clamp(o.anim.nosePoint(hand).y / this.S, 0.1, 0.62);
    }
    a.noseY = null;
    if (o.brain.idle && Math.random() < 0.6) return void o.brain.do('petOne', this.fox);
    a.setPose('sit', 5);
    this.lookAt(o, 0.9);
    a.mood.wag = 1;
    yield* this.wait(rand(1.5, 2.5));
  }

  /** Someone else is being petted: come and sit close, looking hopeful. */
  *wantPets(o) {
    const a = this.a;
    const cam = this.w.camera.position;
    const ang = Math.atan2(cam.x - o.anim.pos.x, cam.z - o.anim.pos.z) + (Math.random() < 0.5 ? 1.25 : -1.25);
    const d = 0.24 * o.rig.scale + 0.2 * this.S;
    const to = this.clampPoint(o.anim.pos.x + Math.sin(ang) * d, o.anim.pos.z + Math.cos(ang) * d);
    this.close = true;
    yield* this.goTo(to.x, to.z, { speed: 'trot', skip: o, stop: 0.08, timeout: 5 });
    yield* this.turnTo(this.toCamera(), 5);
    this.skip = null;
    a.setPose('sit', 5);
    this.lookAtYou(0.9);
    a.mood.wag = 0.8;
    yield* this.wait(0.5);
    this.say(this.w.host.line('jealous'), 2600);
    yield* this.wait(rand(2.5, 4));
  }

  /** Another fox is singing: sit and listen. */
  *listen(o) {
    const a = this.a;
    yield* this.settle();
    yield* this.turnTo(this.angleTo(o), 5);
    a.setPose('sit', 5);
    this.lookAt(o, 0.9);
    let t = 0;
    let heart = rand(1, 2.5);
    while (t < 6 && (t < 1.5 || o.brain.busyWith('sing'))) {
      t += yield;
      a.mood.wag = 0.4 + 0.3 * Math.sin(t * 2.2);
      if (t > heart) {
        heart = t + rand(1.4, 2.6);
        this.w.fx.emit('💗', this.headTop(), { size: 0.1, rise: 0.4, life: 1.1 });
      }
    }
  }

  /** A fox that has just come to live here (or is back from a rest) runs in and says hello. */
  *arrive() {
    const a = this.a;
    const b = this.w.env.bounds;
    a.mood.tailUp = 0.3;
    const to = this.clampPoint(b.cx + rand(-0.45, 0.45), b.cz + rand(0.05, 0.4), 0.8);
    yield* this.goTo(to.x, to.z, { speed: 'run', stop: 0.14, timeout: 6 });
    yield* this.turnTo(this.toCamera(), 7);
    this.lookAtYou();
    a.mood.wag = 1;
    yield* this.hop(0.2);
    a.mood.pant = 1;
    yield* this.wait(1.6);
  }

  /**
   * Lorelei has something to show (world.present): over to her side — beside her, not between her and whoever is
   * looking on — and there it sits and watches: her, and then whoever comes out of the parcel.
   */
  *lookOn(place = 0) {
    const a = this.a;
    const w = this.w;
    const her = w.owner;
    this.close = true;
    const side = place % 2 ? 1 : -1;
    const out = 0.66 + 0.44 * Math.floor(place / 2);
    const spot = () => {
      const yaw = her.anim.yaw;
      return this.clampPoint(her.anim.pos.x + Math.cos(yaw) * side * out - Math.sin(yaw) * 0.08, her.anim.pos.z - Math.sin(yaw) * side * out - Math.cos(yaw) * 0.08, 1);
    };
    yield* this.wait(0.25 + 0.14 * place);
    this.lookAt(her, 0.8);
    yield* this.goTo(0, 0, { speed: 'trot', stop: 0.12, timeout: 7, moving: spot });
    yield* this.turnTo(this.toCamera() - side * 0.5, 6);
    a.setPose('sit', 5);
    let hops = w.gifting ? w.gifting.hops : 0;
    let howls = w.gifting ? w.gifting.howls : 0;
    let up = false; // (turned to the moon, while she looks up at it: world.gaze)
    for (let t = 0, next = 0; w.gifting && t < 120; ) {
      t += yield;
      if (!!w.gazing !== up) {
        // the moon — and the view turned up to it: everyone faces it (and back to her when it is over)
        up = !!w.gazing;
        a.setPose('stand', 6);
        yield* this.turnTo(up ? this.moonward() + side * 0.12 : this.toCamera() - side * 0.5, 4);
        a.setPose(up ? 'gaze' : 'sit', 5);
      }
      if (up) {
        this.lookAtMoon(1);
        a.mood.wag = 0.25 + 0.15 * Math.sin(t * 1.4);
        if (w.gifting && w.gifting.howls !== howls) {
          howls = w.gifting.howls;
          yield* this.howlAt(place);
        }
        continue;
      }
      a.mood.wag = 0.45 + 0.25 * Math.sin(t * 2.2);
      if (w.gifting && w.gifting.hops !== hops) {
        // (something to jump for — trick or treat: world.present)
        hops = w.gifting.hops;
        yield* this.wait(0.08 * place);
        a.mood.eyes = 'happy';
        this.lookAtYou(0.9);
        yield* this.hop(0.2);
        yield* this.hop(0.14);
        a.mood.eyes = 'open';
        a.setPose('sit', 5);
      }
      if (t < next) continue;
      next = t + rand(1.4, 2.8);
      const born = w.gifting && w.gifting.fox;
      if (born && w.foxes.includes(born) && born !== this.fox) this.lookAt(born, 0.9);
      else this.lookAt(her, 0.85);
    }
  }

  /** A song for the full moon: nose to the sky, a long "아우우—" (the app plays it). `i`: its place in the choir — they come in one after another. */
  *howlAt(i = 0) {
    const a = this.a;
    yield* this.wait(0.15 * i);
    a.setPose('howl', 5);
    a.mood.eyes = 'happy';
    for (let t = 0; t < 3.5; ) {
      t += yield;
      a.mood.mouth = t < 0.35 ? (t / 0.35) * 0.85 : t > 3.1 ? 0.6 * (3.5 - t) / 0.4 : 0.6 + 0.22 * Math.sin(t * 3.4 + i);
      a.mood.wag = 0.3;
    }
    a.mood.mouth = 0;
    a.setPose(this.w.gazing ? 'gaze' : 'sit', 4);
    yield* this.wait(0.7);
    a.mood.eyes = 'open';
  }

  /**
   * She looks up at the night sky (world.gaze): to a place in a row across the view, the moon before it — the first in
   * the middle, then to either side — and there it sits, nose up, for as long as she looks.
   */
  *moonGaze(place = 0) {
    const a = this.a;
    const w = this.w;
    const g = w.gazeView;
    if (!g) return;
    this.close = true;
    const dx = Math.sin(g.az);
    const dz = -Math.cos(g.az);
    const side = place % 2 ? -1 : 1;
    const out = 0.36 * Math.ceil(place / 2) * side;
    const back = 0.18 * (place % 3); // (not quite a row: a little before and behind one another)
    const to = this.clampPoint(g.x + dz * -out + dx * (0.3 - back), g.z + dx * out + dz * (0.3 - back), 0.9);
    yield* this.wait(0.15 * place);
    if (Math.hypot(to.x - a.pos.x, to.z - a.pos.z) > 0.12 * this.S) yield* this.goTo(to.x, to.z, { speed: 'trot', stop: 0.08, timeout: 6 });
    yield* this.turnTo(this.moonward() + (Math.random() - 0.5) * 0.3, 5);
    a.setPose('gaze', 4);
    this.lookAtMoon(1);
    for (let t = 0, next = rand(3, 6); w.gazing; ) {
      t += yield;
      a.mood.wag = 0.2 + 0.12 * Math.sin(t * 1.3 + place);
      if (t < next) continue;
      // now and then a glance at the one beside it, and back up
      next = t + rand(4, 8);
      const pal = this.pals().find((f) => f.brain.doing === 'moonGaze');
      if (pal) {
        a.setPose('sit', 4);
        this.lookAt(pal, 0.7);
        yield* this.wait(rand(0.8, 1.4));
        a.setPose('gaze', 4);
        this.lookAtMoon(1);
      }
    }
    a.setPose('stand', 5);
  }

  /**
   * It was Lorelei's present (world.present): out of the parcel it pops — small as it was packed, and its full size by
   * the time it comes down — looks about, and sits there by her while it is spoken of.
   */
  *unwrapped() {
    const a = this.a;
    const w = this.w;
    const S = this.S;
    const body = this.fox.rig.group;
    this.close = true;
    a.mood.wag = 1;
    a.mood.eyes = 'happy';
    a.setPose('hop', 14);
    for (let t = 0; t < 0.62; ) {
      t += yield;
      const k = Math.min(1, t / 0.62);
      body.scale.setScalar(S * (0.3 + 0.7 * k * (2 - k)));
      a.air = 4 * 0.42 * S * k * (1 - k) + 0.1 * (1 - k); // (it comes up out of the box)
    }
    body.scale.setScalar(S);
    a.air = 0;
    a.setPose('stand', 12);
    w.thump(a.pos);
    yield* this.turnTo(this.toCamera(), 8);
    this.lookAtYou(1);
    yield* this.hop(0.15);
    a.mood.eyes = 'open';
    a.mood.pant = 1;
    yield* this.wait(0.9);
    a.setPose('sit', 5);
    a.mood.pant = 0;
    for (let t = 0, next = 1.2; t < 40 && w.gifting; ) {
      t += yield;
      a.mood.wag = 0.6 + 0.3 * Math.sin(t * 2.4);
      if (t < next) continue;
      next = t + rand(1.4, 2.6);
      if (Math.random() < 0.45) this.lookAt(w.owner, 0.9);
      else this.lookAtYou(0.95);
    }
  }

  /**
   * Lorelei is telling somebody about it (world.present: 'meet'): up to her it goes — in front of her and a little to
   * her left, where it can be seen — gives a hop, and sits there, pleased with itself, for as long as she speaks.
   */
  *stepUp() {
    const a = this.a;
    const w = this.w;
    const her = w.owner;
    this.close = true;
    const spot = () => {
      const yaw = her.anim.yaw;
      return this.clampPoint(her.anim.pos.x + Math.sin(yaw) * 0.46 + Math.cos(yaw) * 0.36, her.anim.pos.z + Math.cos(yaw) * 0.46 - Math.sin(yaw) * 0.36, 1);
    };
    this.lookAt(her, 0.8);
    yield* this.goTo(0, 0, { speed: 'trot', stop: 0.1, timeout: 6, moving: spot });
    yield* this.turnTo(this.toCamera(), 8);
    this.lookAtYou(1);
    a.mood.wag = 1;
    a.mood.eyes = 'happy';
    yield* this.hop(0.15);
    a.mood.eyes = 'open';
    a.setPose('sit', 5);
    for (let t = 0, next = 1.6; w.gifting && t < 180; ) {
      t += yield;
      a.mood.wag = 0.6 + 0.3 * Math.sin(t * 2.4);
      if (t < next) continue;
      next = t + rand(1.6, 3);
      if (Math.random() < 0.4) this.lookAt(her, 0.9);
      else this.lookAtYou(0.95);
    }
  }

  // ---------------------------------------------------------------- his letters

  /** A letter is waiting in the mailbox: run and get it, then bring it to her. */
  *fetchLetter() {
    const a = this.a;
    const w = this.w;
    const box = w.things.mailbox;
    const c = box.object.position;
    const b = w.env.bounds;
    this.close = true;
    a.mood.tailUp = 0.3;
    // up to its door, from the yard's side
    const ang = Math.atan2(b.cx - c.x, b.cz - c.z);
    const d = box.radius + REACH * this.S * 0.8;
    yield* this.goTo(c.x + Math.sin(ang) * d, c.z + Math.cos(ang) * d, { speed: 'run', ignore: box, stop: 0.06, timeout: 8 });
    yield* this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), 6);
    a.setPose('alert', 6);
    a.noseY = Math.min(0.5, box.slot / this.S); // a kit has to stretch for it
    a.mood.wag = 0.6;
    yield* this.wait(0.8);
    w.pickLetter(this.fox);
    a.noseY = null;
    yield* this.hop(0.12);
    yield* this.present();
  }

  /** Sit in front of her with the letter until she takes it — or, after a good while, carry on with it in its mouth. */
  *present() {
    const a = this.a;
    const w = this.w;
    const front = w.env.spots.front;
    this.close = true;
    yield* this.goTo(front.x, front.z, { speed: 'trot', stop: 0.1, timeout: 8 });
    yield* this.turnTo(this.toCamera(), 6);
    a.setPose('sit', 5);
    this.lookAtYou(0.95);
    let t = 0;
    let next = 0.4;
    while (w.letter && w.letter.fox === this.fox && t < 28) {
      t += yield;
      a.mood.wag = 0.6 + 0.3 * Math.sin(t * 2.4);
      if (t > next) {
        next = t + 9;
        this.say(w.host.line('letter'), 3400);
      }
      if (Math.abs(wrapAngle(this.toCamera() - a.yaw)) > 0.3) yield* this.turnTo(this.toCamera(), 3);
    }
  }

  // ---------------------------------------------------------------- pictures

  /** She is taking pictures: go to its place in the family picture and hold the pose she asked for, eyes on the camera. */
  *strike() {
    const a = this.a;
    const w = this.w;
    this.close = true;
    let pose = '';
    let settled = false;
    let dt = 0.016;
    while (w.photoOn) {
      const at = w.photoSpot(this.fox);
      if (!settled || Math.hypot(at.x - a.pos.x, at.z - a.pos.z) > 0.14) {
        a.setPose('stand', 8);
        Object.assign(a.mood, CALM);
        a.air = 0;
        a.lookW = 0;
        yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.08, timeout: 6 });
        yield* this.turnTo(this.toCamera(), 7);
        settled = true;
        pose = '';
      }
      // she walks round with the camera: keep facing it
      const off = wrapAngle(this.toCamera() - a.yaw);
      a.yaw += clamp(off, -3 * dt, 3 * dt);
      const want = w.poseFor(this.fox);
      if (want !== pose) {
        pose = want;
        Object.assign(a.mood, CALM);
        a.air = 0;
        this.lookAtYou(0.95);
        if (pose === 'sit') a.mood.wag = 0.4;
        else if (pose === 'smile') Object.assign(a.mood, { eyes: 'happy', pant: 1, wag: 0.8 });
        else if (pose === 'bow') a.mood.wag = 1;
        else if (pose === 'proud') Object.assign(a.mood, { tailUp: 0.45, ears: -0.2 });
        else if (pose === 'howl') Object.assign(a.mood, { eyes: 'happy', mouth: 0.7 });
        if (pose !== 'jump') a.setPose({ sit: 'sit', smile: 'sit', lie: 'lie', bow: 'bow', proud: 'alert', howl: 'howl' }[pose] || 'sit', 7);
      }
      if (pose === 'jump') {
        // all together, again and again — she picks the moment
        const k = ((w.time + 0.02 * this.place()) % 1.25) / 0.44;
        a.air = k < 1 ? 4 * 0.26 * this.S * k * (1 - k) : 0;
        a.setPose(k < 1 ? 'hop' : 'stand', 14);
        a.mood.wag = 1;
        a.mood.pant = 1;
      }
      dt = yield;
    }
    a.air = 0;
  }

  // ---------------------------------------------------------------- with you

  *greet() {
    const a = this.a;
    const front = this.w.env.spots.front;
    const i = this.place();
    const x = front.x + [0, -0.55, 0.55, -1.05, 1.05, 0][i % 6];
    const z = front.z - (i ? 0.12 + 0.1 * (i % 2) : 0) - (i > 4 ? 0.5 : 0);
    this.close = true;
    a.mood.tailUp = 0.3;
    yield* this.goTo(x, z, { speed: 'run', stop: 0.12, timeout: 6 });
    yield* this.turnTo(this.toCamera(), 7);
    this.lookAtYou();
    a.mood.wag = 1;
    if (this.fox === this.w.lead) this.say(this.w.host.line('greet'), 3000);
    yield* this.hop(0.2);
    yield* this.hop(0.14);
    a.mood.pant = 1;
    yield* this.wait(1.6);
  }

  *hop(h = 0.18) {
    const a = this.a;
    const T = 0.36;
    let t = 0;
    a.setPose('hop', 14);
    while (t < T) {
      const dt = yield;
      t += dt;
      const k = Math.min(1, t / T);
      a.air = 4 * h * this.S * k * (1 - k);
    }
    a.air = 0;
    a.setPose('stand', 12);
    yield* this.wait(0.12);
  }

  /** You tapped the ground: come over, then look up at you. */
  *comeTo(x, z) {
    const a = this.a;
    const d = Math.hypot(x - a.pos.x, z - a.pos.z);
    const far = d > 0.9 * this.S;
    a.look = V(x, 0.1, z);
    a.lookW = 0.6;
    // (she may have tapped out in the country: then it leaves the yard for that)
    yield* this.goTo(x, z, { speed: this.w.state.mood === 'sleepy' ? 'walk' : far ? 'run' : 'trot', stop: 0.09, beyond: !this.inYard({ x, z }, 0.98), timeout: 9 + d * 1.5 });
    yield* this.turnTo(this.toCamera(), 5);
    this.lookAtYou();
    a.mood.wag = 0.7;
    yield* this.wait(1.4);
    a.setPose('sit', 5);
    yield* this.wait(rand(1.5, 3));
  }

  /**
   * The shop is open: sit facing you for as long as it stays open. (While she knits it a sweater, the fox she is
   * dressing stands with its back to where you look from — her picture is on its back — and you walk round it.)
   */
  *model() {
    const a = this.a;
    const w = this.w;
    let t = 0;
    let settled = false;
    let turned = false;
    this.close = true;
    while (w.showcaseOn) {
      const back = w.knitOn && this.fox === w.focus;
      // its place changes when the shop turns to another fox
      const at = w.modelSpot(this.fox);
      const off = Math.hypot(at.x - a.pos.x, at.z - a.pos.z);
      if (!settled || off > 0.16 || back !== turned) {
        if (off > 0.1) {
          a.setPose('stand', 8);
          a.mood.wag = 0;
          a.lookW = 0;
          yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.1, timeout: 5 });
        }
        turned = back;
        if (back) {
          a.setPose('stand', 6);
          yield* this.turnTo(KNIT_YAW, 4);
          a.lookW = 0;
        } else {
          yield* this.turnTo(this.toCamera(), 6);
          a.setPose('sit', 5);
          this.lookAtYou(0.9);
        }
        settled = true;
      }
      const dt = yield;
      t += dt;
      a.mood.wag = 0.35 + 0.3 * Math.max(0, Math.sin(t * 1.1 + this.place()));
      if (back) {
        // (and now and then it looks round over its shoulder, as if to see how it looks)
        if (Math.random() < dt * 0.22) this.lookAtYou(Math.random() < 0.5 ? 0.45 : 0);
        if (Math.abs(wrapAngle(KNIT_YAW - a.yaw)) > 0.3) yield* this.turnTo(KNIT_YAW, 3);
      } else if (Math.abs(wrapAngle(this.toCamera() - a.yaw)) > 0.25) yield* this.turnTo(this.toCamera(), 3);
    }
  }

  /** A pat: lean into the hand, eyes shut, tail going. More pats keep it going. */
  *petted() {
    const a = this.a;
    this.petUntil = this.w.time + 1.5;
    a.speed = 0;
    a.setPose('pet', 7);
    a.mood.eyes = 'happy';
    a.mood.wag = 1;
    this.lookAtYou(0.5);
    const face = this.toCamera();
    while (this.w.time < this.petUntil) {
      const dt = yield;
      const d = wrapAngle(face - a.yaw);
      const step = clamp(d, -2.5 * dt, 2.5 * dt);
      a.yaw += step;
      a.yawRate = step / Math.max(dt, 1e-4);
    }
    a.yawRate = 0;
    a.mood.eyes = 'open';
    a.setPose('sit', 5);
    this.lookAtYou();
    a.mood.wag = 0.5;
    yield* this.wait(1.2);
  }

  /** Called for every pat (the first one starts `petted`). */
  pat() {
    const w = this.w;
    w.fx.emit(['💗', '💕', '💖', '✨'][Math.floor(Math.random() * 4)], this.headTop(), { n: 3, spread: 0.16, rise: 0.5, life: 1.1, size: 0.13 });
    if (this.using && !this.asleep) return; // on the swing, in its house: it enjoys the pat where it is
    if (this.doing === 'petted' && this.script) this.petUntil = w.time + 1.5;
    else this.do('petted');
    // "me too!" — now and then one of the others comes over
    if (w.time > (w.envyAt || 0) && Math.random() < 0.3) {
      const o = this.pal((f) => (f.brain.free ? 1 : 0));
      if (o) {
        w.envyAt = w.time + 9;
        o.brain.do('wantPets', this.fox);
      }
    }
  }

  besideBowl() {
    const w = this.w;
    const bowl = w.things.bowl;
    const c = bowl.object.position;
    const b = w.env.bounds;
    // one fox stands on the side of the bowl nearer the middle, so it faces outwards over it;
    // a family sits all round it (the world moves the bowl in from the edge for them)
    const n = w.foxes.length;
    const ang = Math.atan2(b.cx - c.x, b.cz - c.z) + (this.place() / n) * TAU;
    const d = 0.37 * this.S + 0.06 + (n > 1 ? bowl.radius * bowl.object.scale.x * 0.3 : 0);
    // (round to the next side that is free, if something of hers stands in this one)
    const at = V();
    for (const off of [0, 0.5, -0.5, 1, -1, 1.6, -1.6, 2.4, -2.4]) {
      at.set(c.x + Math.sin(ang + off) * d, 0, c.z + Math.cos(ang + off) * d);
      if (!this.blocked(at, 0.08 * this.S, bowl)) break;
    }
    return at;
  }

  *eat() {
    const a = this.a;
    const w = this.w;
    const bowl = w.things.bowl;
    const at = this.besideBowl();
    this.watch = null;
    this.close = true;
    a.look = bowl.object.position;
    a.lookW = 0.7;
    yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.05, timeout: 7 });
    yield* this.turnTo(Math.atan2(bowl.object.position.x - a.pos.x, bowl.object.position.z - a.pos.z), 6);
    if (w.serving) {
      // the bowl is still empty — Lorelei is on her way with the food: it sits and waits, eyes on her
      a.setPose('sit', 6);
      a.mood.wag = 0.9;
      while (w.serving) {
        this.lookAt(w.owner, 0.9);
        yield;
      }
      this.watch = null;
      yield* this.wait(0.12 * this.place());
    }
    a.lookW = 0;
    a.setPose('eat', 6);
    a.noseY = 0.085;
    a.mood.wag = 0.5;
    yield* this.wait(0.6);
    a.mood.chew = 1;
    let t = 0;
    let crumb = 0;
    const sec = 3.4;
    while (t < sec) {
      const dt = yield;
      t += dt;
      this.ate = t / sec; // the world empties the bowl as everyone eats their share
      if (t > crumb) {
        crumb = t + 0.45;
        w.fx.emit('🟤', a.nosePoint(V()), { n: 2, spread: 0.07, rise: 0.25, life: 0.5, size: 0.035, gravity: 1.6 });
      }
    }
    this.ate = 1;
    a.mood.chew = 0;
    a.noseY = null;
    a.setPose('alert', 5);
    yield* this.turnTo(this.toCamera(), 5);
    this.lookAtYou();
    a.mood.mouth = 0.5;
    a.mood.pant = 1;
    a.mood.wag = 1;
    w.fx.emit('💗', this.headTop(), { n: 2, spread: 0.12, rise: 0.45, life: 1.1, size: 0.13 });
    yield* this.wait(1.5);
  }

  /** The ball is thrown in: run it down, pounce, knock it about. Whoever gets there first has it for that go. */
  *playBall() {
    const a = this.a;
    const w = this.w;
    const ball = w.things.ball;
    this.watch = null;
    a.look = ball.object.position;
    a.lookW = 1;
    a.setPose('alert', 9);
    a.mood.tailUp = 0.35;
    a.mood.wag = 0.6;
    // (Lorelei has the ball: eyes on her until she lets it fly)
    while (w.pitching) {
      this.lookAt(w.owner, 0.95);
      a.mood.wag = 1;
      yield;
    }
    this.watch = null;
    a.look = ball.object.position;
    a.lookW = 1;
    yield* this.wait(0.35 + this.place() * 0.08);
    for (let round = 0; round < 3; round++) {
      const spot = () => this.clampPoint(ball.object.position.x, ball.object.position.z, 0.94);
      yield* this.goTo(0, 0, { speed: 'run', stop: 0.62, timeout: 5, moving: spot });
      if (w.ballBusy && w.ballBusy !== this.fox) {
        // someone else got there first: bounce about until it comes loose
        a.mood.wag = 1;
        yield* this.hop(0.14);
        yield* this.wait(rand(0.25, 0.6));
        continue;
      }
      w.ballBusy = this.fox;
      if (this.reduce) {
        yield* this.goTo(0, 0, { speed: 'trot', stop: 0.3, timeout: 3, moving: spot });
      } else {
        const to = spot();
        if (Math.hypot(to.x - a.pos.x, to.z - a.pos.z) < 1.2 * this.S) yield* this.pounce(to);
      }
      a.look = ball.object.position;
      a.lookW = 1;
      if (round < 2 || w.foxes.length > 1) {
        // a knock with the nose sends it off again
        const ang = Math.atan2(w.env.bounds.cx - a.pos.x, w.env.bounds.cz - a.pos.z) + rand(-0.9, 0.9);
        w.kickBall(ang, rand(1.5, 2.2), rand(1.2, 1.9));
        a.setPose('alert', 9);
        yield* this.wait(0.3);
      }
      w.ballBusy = null;
    }
    yield* this.turnTo(this.toCamera(), 6);
    this.lookAtYou();
    a.mood.wag = 1;
    a.mood.pant = 1;
    yield* this.hop(0.16);
    yield* this.wait(1.4);
  }

  *sing() {
    const a = this.a;
    const w = this.w;
    const mic = w.things.mic;
    if (mic.object.visible) {
      const p = mic.object.position;
      w.fitMic(this.fox.rig);
      yield* this.goTo(p.x, p.z - 0.3 * this.S, { speed: 'trot', ignore: mic, stop: 0.05 });
      yield* this.turnTo(0, 6);
    } else yield* this.turnTo(this.toCamera(), 6);
    this.pals().forEach((f) => f.brain.free && f.brain.do('listen', this.fox));
    a.setPose('howl', 5);
    a.mood.eyes = 'happy';
    yield* this.wait(0.6);
    let t = 0;
    let note = 0;
    while (t < 3.4) {
      const dt = yield;
      t += dt;
      a.mood.mouth = 0.55 + Math.sin(t * 5.5) * 0.35;
      if (t > note) {
        note = t + 0.42;
        w.fx.emit(Math.random() < 0.5 ? '🎵' : '🎶', a.nosePoint(V()), { size: 0.15, rise: 0.55, life: 1.5, drift: 0.3 });
      }
    }
    a.mood.mouth = 0;
    a.mood.eyes = 'open';
    a.setPose('sit', 5);
    this.lookAtYou();
    a.mood.wag = 0.8;
    yield* this.wait(1.2);
  }

  /** Something good happened (a cover released, a level gained). */
  *cheer() {
    const a = this.a;
    yield* this.wait(this.place() * 0.12);
    yield* this.turnTo(this.toCamera(), 7);
    this.lookAtYou();
    a.mood.wag = 1;
    a.mood.tailUp = 0.4;
    this.w.fx.emit('✨', this.headTop(), { n: 5, spread: 0.3, rise: 0.6, life: 1.2, size: 0.13 });
    if (!this.reduce) {
      // a hop with a full turn
      const T = 0.5;
      let t = 0;
      const from = a.yaw;
      a.setPose('hop', 14);
      while (t < T) {
        const dt = yield;
        t += dt;
        const k = Math.min(1, t / T);
        a.air = 4 * 0.24 * this.S * k * (1 - k);
        a.yaw = from + TAU * (k * k * (3 - 2 * k));
      }
      a.air = 0;
      a.yaw = from;
      a.setPose('stand', 12);
    }
    yield* this.hop(0.16);
    a.mood.pant = 1;
    yield* this.wait(1.3);
  }

  *joy() {
    yield* this.wait(this.place() * 0.1);
    yield* this.turnTo(this.toCamera(), 6);
    this.lookAtYou();
    this.a.mood.wag = 1;
    yield* this.hop(0.15);
    yield* this.wait(0.9);
  }
}

Object.assign(Brain.prototype, YARDLIFE, DANCING, TRIPS, WEATHERLIFE);
