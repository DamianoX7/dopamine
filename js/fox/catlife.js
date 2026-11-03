// A fox and 뭉치, the white cat she brings along on the bus (mungchi.js is the cat's own side). Left to itself a fox goes
// over to have a look; a fox the cat does not know yet keeps its distance and sits and stares, one it knows comes up
// and touches noses. And when she introduces them (world.catMeet) the two of them do what they have got to by now, in
// time with each other: `s` is the scene they share, and `s.beat` the step it has reached. The fox leads it:
//   level 0  it comes up slowly and stops short, a nose at last — and the cat jumps back: 코 인사
//   level 1  noses, a play bow, a run round it with the cat at its heels, a pounce at its tail: 장난 친구
//   level 2  it lies down, the cat goes round it, tail up, and curls up against it, and they sleep: 단짝
//   level 3  …which from then on they do when they feel like it
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const REACH = 0.57; //  how far ahead of its middle a fox's nose is (brain.js)
const CAT_NOSE = 0.2; //  …and the cat's, with its head held out to the other

/** How far apart a fox of size `S` and the cat stand when their noses touch. */
const touching = (S) => REACH * S + CAT_NOSE;

export const CATLIFE = {
  /** The new animal: over for a look. A long look from a little way off, if they have not been introduced. */
  *catCurious(o) {
    const a = this.a;
    const w = this.w;
    const known = w.host.catFriend(this.fox.id) > 0;
    const gap = known ? touching(this.S) : 1.05;
    this.target = o;
    this.lookAt(o, 0.7);
    yield* this.goTo(0, 0, { speed: 'walk', stop: 0.1, timeout: 6, skip: o, moving: () => this.beside(o, 0, gap) });
    if (this.distTo(o) > gap + 0.5 * this.S || !o.brain.came) return; // (it had walked on)
    yield* this.turnTo(this.angleTo(o), 5);
    if (known) {
      if (o.brain.free) o.brain.do('noseBack', this.fox);
      yield* this.sniffNose(o, rand(1.4, 2.2));
      return;
    }
    a.setPose('sit', 5);
    this.lookAt(o, 0.9);
    a.mood.wag = 0.4;
    yield* this.wait(rand(2, 3.5));
  },

  /** Another fox is being introduced to it: this one sits and watches, a little way behind them, not in the way. */
  *watchCat(s, i = 0) {
    const a = this.a;
    const { x, z, dir } = s.spot;
    const at = this.clampPoint(x + dir * (1.5 + 0.5 * (i % 3)), z - 0.5 - 0.3 * (i % 2), 0.92);
    yield* this.goTo(at.x, at.z, { speed: 'trot', stop: 0.12, timeout: 5 });
    yield* this.turnTo(Math.atan2(x - a.pos.x, z - a.pos.z), 5);
    a.setPose('sit', 5);
    this.lookAt(s.cat, 0.8);
    while (s.on && !s.over) {
      yield;
      a.mood.wag = 0.3 * Math.max(0, Math.sin(this.w.time * 2));
    }
  },

  /** She has introduced them (world.catMeet): see above. */
  *meetCat(s) {
    const a = this.a;
    const w = this.w;
    const o = s.cat;
    const touch = touching(this.S);
    // (it does get there, whoever stands in the way: a good way off, at a trot — and after a second try if need be)
    const come = function* (gap) {
      const to = () => this.beside(o, 0, gap);
      const off = () => Math.hypot(to().x - a.pos.x, to().z - a.pos.z);
      for (let i = 0; i < 3 && s.on && off() > 0.1; i++) yield* this.goTo(0, 0, { speed: off() > 1.1 ? 'trot' : 'walk', stop: 0.03, timeout: 9, skip: o, moving: to });
    }.bind(this);
    this.target = o;
    this.close = true;
    this.lookAt(o, 0.8);
    a.setPose('stand', 5);
    for (let t = 0; t < 7 && s.on && !s.set; ) t += yield; // (the cat is going to where they will meet)
    if (s.level === 0) {
      yield* come(0.95);
      s.beat = 'near';
      yield* this.turnTo(this.angleTo(o), 5);
      a.setPose('sit', 5);
      a.mood.wag = 0.5;
      this.say(w.host.catLine('fox_hello'), 2400);
      yield* this.wait(2.2);
      a.setPose('stand', 5);
      yield* come(touch);
      yield* this.turnTo(this.angleTo(o), 5);
      s.beat = 'touch';
      yield* this.sniffNose(o, 1.5);
      s.beat = 'flinch';
      a.setPose('sit', 5);
      this.lookAt(o, 0.9);
      a.mood.wag = 0.7;
      yield* this.wait(2.6);
      return void w.catMet(s, true);
    }
    if (s.level === 1) {
      yield* come(touch);
      yield* this.turnTo(this.angleTo(o), 5);
      s.beat = 'touch';
      yield* this.sniffNose(o, 1.3);
      a.setPose('bow', 8);
      a.mood.wag = 1;
      this.lookAt(o, 0.9);
      s.beat = 'bow';
      this.say(w.host.catLine('fox_play'), 2200);
      yield* this.wait(1.4);
      // off it goes, round and round in front of whoever looks on: the cat comes after
      a.setPose('stand', 9);
      a.mood.tailUp = 0.3;
      s.beat = 'run';
      const c = o.anim.pos.clone();
      if (s.spot) {
        c.x += s.spot.dir * 0.45;
        c.z += 0.3;
      }
      const from = Math.atan2(a.pos.x - c.x, a.pos.z - c.z);
      const dir = Math.random() < 0.5 ? 1 : -1;
      for (let i = 1; i <= 4 && s.on; i++) {
        const ang = from + dir * i * 1.25;
        const p = this.clampPoint(c.x + Math.sin(ang) * 0.85, c.z + Math.cos(ang) * 0.85, 0.94);
        yield* this.goTo(p.x, p.z, { speed: 'trot', stop: 0.25, timeout: 2.4, skip: o });
      }
      a.mood.tailUp = 0;
      a.mood.pant = 1;
      s.beat = 'tag';
      yield* this.wait(1.7);
      yield* this.turnTo(this.angleTo(o), 6);
      a.setPose('sit', 5);
      this.lookAt(o, 0.9);
      a.mood.wag = 0.9;
      yield* this.wait(2);
      return void w.catMet(s, true);
    }
    // down it lies, and waits for the cat to come to it…
    yield* come(0.62);
    yield* this.turnTo(this.toCamera() + 0.9, 4); // (curled up with its face to whoever is looking on, as on its bed)
    a.setPose('lie', 4.5);
    this.lookAt(o, 0.7);
    a.mood.wag = 0.3;
    s.beat = 'rub';
    for (let t = 0; t < 10 && s.on && s.beat !== 'snug'; ) t += yield;
    // …and goes off to sleep with it
    a.mood.wag = 0;
    a.lookW = 0;
    this.watch = null;
    a.setPose('sleep', 2.6);
    a.mood.breath = 0.5;
    yield* this.wait(1.2);
    a.mood.eyes = 'sleep';
    a.noseY = 0.075;
    this.asleep = true;
    yield* this.wait(s.level === 2 ? 6.5 : 4.5);
    w.catMet(s, true);
    for (let t = 0, end = rand(12, 20), z = 1; t < end && s.on && o.brain.doing === 'metBy'; ) {
      t += yield;
      if (t > z) {
        z = t + rand(3, 4.5);
        w.fx.emit('💤', this.headTop(), { size: 0.13, rise: 0.22, life: 2.2, drift: 0.12 });
      }
    }
    yield* this.wake();
  },
};
