// Her boyfriend, when he comes round (the app's js/him.js: he planned it from his own login — the day, the hour, a note,
// a present, and how he looks). Up the path to the door he comes and knocks; she leaves whatever she was doing — out of
// bed, off the sofa — and opens it to him, and they say hello. Then he stays a while, and they do things together: sit
// side by side on the sofa, look at a picture on the wall, out of the window, dance to the record that is on, say hello
// to 뭉치 — talking all the while, a word from him and one from her. Before he goes they have their picture taken, side
// by side, and he gives her what he brought (the app shows it, and his note); she sees him to the door, and waves.
//
// He is built as she is (me.js, with a boy's face and build, a little taller); what he can do is person.js. What they say
// is the app's (HouseHost.line('him', …), and HouseHost.himChat(kind): a line of his and her answer to it).
import * as THREE from '../vendor/three.module.min.js';
import { buildMe, ME_SIZE } from './me.js';
import { Person, pose, HIPS } from './person.js';
import { V } from './shapes.js';
import { WALL_T } from './room.js';
import { disposeTree } from '../fox/kit.js';

const TALL = 1.06; //  a little taller than she is
const STAY = 150; //    how long he stays, at most, before it is time for the present and goodbye (seconds)
const GAP = 0.6; //     between one line and the answer to it (seconds)

/* What he brings: a box tied with a ribbon — or, with nothing but his note, an envelope with a heart on it. */
function makeParcel(note) {
  const g = new THREE.Group();
  const mat = (color, rough = 0.55) => new THREE.MeshStandardMaterial({ color, roughness: rough });
  if (note) {
    const env = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.075, 0.008), mat('#fff4f7', 0.7));
    const flap = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.004, 0.0085), mat('#ffc2d4', 0.6));
    flap.position.set(0, 0.012, 0.0005);
    flap.rotation.z = 0;
    const heart = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), mat('#ff6f9c', 0.45));
    heart.scale.set(1, 0.85, 0.35);
    heart.position.set(0, 0.006, 0.006);
    g.add(env, flap, heart);
    g.position.set(0, 0.03, 0.02);
  } else {
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.11, 0.13), mat('#8fc1ff'));
    box.position.y = 0.055;
    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.145, 0.026, 0.145), mat('#6fa8f5', 0.5));
    lid.position.y = 0.12;
    const rib = mat('#fffaf1', 0.5);
    const r1 = new THREE.Mesh(new THREE.BoxGeometry(0.148, 0.136, 0.024), rib);
    r1.position.y = 0.068;
    const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.136, 0.148), rib);
    r2.position.y = 0.068;
    g.add(box, lid, r1, r2);
    for (const s of [-1, 1]) {
      const loop = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.008, 8, 14), rib);
      loop.position.set(s * 0.022, 0.145, 0);
      loop.rotation.set(0, 0, s * 0.5);
      g.add(loop);
    }
    g.position.set(0, -0.05, 0.05);
  }
  g.traverse((o) => {
    if (o.isMesh) o.castShadow = true;
  });
  return g;
}

export class Him extends Person {
  constructor(world) {
    super(world, 'him');
    this.visit = null; //  what he came with: { id, look, name, gift, note }
    this.lookKey = '';
    this.until = 0; //     when it is time for the present, and goodbye (world time)
    this.going = false; // …he is on his way out
    this.phase = ''; //    'coming' (up the path, knocking), 'in' (with her), 'going'
    this.plans = []; //    what they are going to do together, in order
    this.talk = null; //   what they are saying to each other: { pairs, i, next, ready(), done() }
    this.handed = false;
  }

  /** Built as he looks (again only when that changes): a boy's build, a little taller than hers. */
  build(look) {
    const key = JSON.stringify(look);
    if (this.rig && key === this.lookKey) return;
    this.lookKey = key;
    const rig = buildMe({ ...look, boy: true });
    rig.size = ME_SIZE * TALL;
    rig.group.scale.setScalar(ME_SIZE * TALL);
    this.setRig(rig);
  }

  /** (sat down, his hips are where a taller boy's are) */
  lift(s) {
    return Math.max(-0.04, s.h + 0.045 - (HIPS + pose(s.h < 0.3 ? 'low' : 'chair').hy) * TALL);
  }

  /** Where he walks up from, the step he stands on knocking, where she stands to open the door, where his hand knocks. */
  doorstep() {
    const s = this.world.spec;
    const x = s.w / 2;
    const u = s.door.u;
    return { far: V(x + 1.9, 0, u + 1.6), at: V(x + WALL_T + 0.1, 0, u + 0.03), knock: V(x + WALL_T * 0.6, 0.82, u + 0.1) };
  }

  /* ----- his visit ----- */

  /** He has come round (`v`: { id, look, name, gift, note }): up the path, and a knock on the door. */
  arrive(v) {
    this.visit = v;
    this.build(v.look);
    const step = this.doorstep();
    const door = this.world.room.doorway();
    const a = this.anim;
    a.pos.copy(step.far);
    a.yaw = Math.atan2(step.at.x - step.far.x, step.at.z - step.far.z);
    a.pitch = 0;
    a.air = 0;
    a.speed = 0;
    a.still();
    a.setPose('stand', 20);
    a.snap();
    this.rig.group.visible = true;
    this.on = true;
    this.going = false;
    this.handed = false;
    this.phase = 'coming';
    this.seat = null;
    this.talk = null;
    this.pending = null;
    this.plans = [];
    this.until = Infinity;
    this.dropAll();
    this.tasks = [
      { do: 'walk', to: step.at, direct: true },
      { do: 'face', at: door.inside },
      { do: 'knock' },
      { do: 'walk', to: door.inside.clone(), direct: true },
      { do: 'face', at: this.world.me.pos },
      { do: 'hello' },
    ];
    this.task = null;
  }

  /** Gone: out of the door and away — or, the house closed, at once and quietly. */
  vanish(quiet = false) {
    const was = this.on;
    this.on = false;
    this.going = false;
    this.phase = '';
    this.tasks = [];
    this.task = null;
    this.pending = null;
    this.talk = null;
    this.photoOn = false;
    this.seat = null;
    this.dropAll();
    if (this.rig) this.rig.group.visible = false;
    const w = this.world;
    w.hush('him');
    w.frameDoor(false);
    w.frameAt(null);
    if (w.me.withHim === this) w.me.withHim = null;
    if (was) w.host.onHim(quiet ? 'cut' : 'gone', this.visit);
  }

  /** Time to go (the house is being closed: `now`, at once). */
  leave(now = false) {
    if (!this.on) return;
    if (now) return this.vanish(true);
    if (this.going) return;
    this.endTalk();
    this.photoOn = false;
    this.plans = [];
    this.until = 0;
    if (this.phase === 'in') {
      this.tasks = [...(this.seat ? [{ do: 'stand' }] : []), { do: 'bye' }];
      if (this.task && this.task.do === 'sit') this.task.t = 0;
      else this.task = null;
    }
  }

  leaving() {
    return this.going;
  }

  /** At the door, coming or going — or on his way to it (one at the door at a time). */
  busy() {
    return this.on;
  }

  tapped() {
    if (!this.on || this.phase === 'coming') return;
    if (this.talk || (this.task && ['gift', 'photo', 'bye', 'hello'].includes(this.task.do))) {
      if (this.world.time - this.lastSay > 3) this.say('tap');
      return;
    }
    super.tapped();
  }

  /* ----- what they say to each other ----- */

  /** A line of his, as it is (not looked up by kind). → how long it shows (seconds). */
  sayText(text) {
    if (!text) return 0;
    this.lastSay = this.world.time;
    const ms = Math.min(6000, 2200 + text.length * 70);
    this.world.say(text, ms, 'him');
    return ms / 1000;
  }

  /** …and one of hers. */
  herText(text) {
    const me = this.world.me;
    if (!text || !me.on) return 0;
    me.lastSay = this.world.time;
    const ms = Math.min(6000, 2200 + text.length * 70);
    this.world.say(text, ms, 'me');
    return ms / 1000;
  }

  /**
   * They talk about `kind` (the app gives a line of his and her answer — `n` such pairs), once `ready()` (both are where
   * they are to be); then `done()`.
   */
  chat(kind, n, ready, done) {
    const pairs = [];
    for (let i = 0; i < n; i++) {
      const p = this.world.host.himChat(kind, i);
      if (p) pairs.push(p);
    }
    this.talk = { pairs, i: 0, next: 0, started: false, ready, done };
  }

  endTalk() {
    const t = this.talk;
    this.talk = null;
    if (!t) return;
    if (t.done) t.done();
    // (out of whatever pose they held while they talked)
    const me = this.world.me;
    if (!this.seat && this.on) this.anim.setPose('stand', 5);
    if (me.on && !me.seat && !me.abed) me.anim.setPose('stand', 5);
  }

  talking() {
    const t = this.talk;
    if (!t) return;
    const time = this.world.time;
    if (!t.started) {
      if (!t.ready()) return;
      t.started = true;
      t.next = time + 0.6;
    }
    if (time < t.next) return;
    const line = Math.floor(t.i / 2);
    if (line >= t.pairs.length) return this.endTalk();
    const [his, hers] = t.pairs[line];
    const secs = t.i % 2 === 0 ? this.sayText(his) : this.herText(hers);
    t.i++;
    t.next = time + Math.max(1.4, secs * 0.85) + GAP;
  }

  update(dt) {
    if (!this.on || !this.rig) return;
    this.talking();
    super.update(dt);
  }

  /* ----- what they do together ----- */

  /** What there is to do in this house, now: in an order of its own, the picture before the last of them. */
  makePlans() {
    const w = this.world;
    const can = [];
    if (w.seatPair()) can.push('sofa');
    if (w.spots().some((s) => s.kind === 'frame')) can.push('frame');
    if (w.room.standing('back')) can.push('window');
    if (w.musicOn()) can.push('dance');
    if (w.catHome && w.cat.on && w.cat.world === w) can.push('cat');
    for (let i = can.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [can[i], can[j]] = [can[j], can[i]];
    }
    // (with the record on, they dance first; and two or three things at most, the picture just before the last)
    if (can.includes('dance')) can.unshift(...can.splice(can.indexOf('dance'), 1));
    const list = can.slice(0, 3);
    if (!list.length) list.push('look');
    list.splice(Math.max(1, list.length - 1), 0, 'photo');
    return list;
  }

  plan() {
    const w = this.world;
    if (this.phase !== 'in' || this.going) return void this.tasks.push({ do: 'wait', t: 0.5 });
    const next = w.time < this.until ? this.plans.shift() : null;
    if (!next) {
      // (time is up — or there is nothing more to do: what he brought, and goodbye)
      this.until = 0;
      if (this.visit && (this.visit.gift || this.visit.note) && !this.handed) return void this.tasks.push({ do: 'gift' });
      return void this.tasks.push({ do: 'bye' });
    }
    this[`do_${next}`]();
  }

  /** (her: to do `tasks`, with him) */
  her(tasks) {
    const me = this.world.me;
    me.withHim = this;
    me.redo(tasks);
  }

  /**
   * Two places side by side about `at` (before a thing they look at): his and hers — side by side as whoever looks on sees
   * them (across the view, not one behind the other).
   */
  pair(at, face, apart = 0.2) {
    const w = this.world;
    const cam = w.camera.position;
    const f = V(at.x - cam.x, 0, at.z - cam.z).normalize();
    const side = V(-f.z, 0, f.x);
    const one = w.freeNear(at.clone().addScaledVector(side, apart));
    const two = w.freeNear(at.clone().addScaledVector(side, -apart));
    return [one, two];
  }

  /** (waiting where he is, facing `at` in `pose`, while they talk — until they have talked) */
  hold(at, poseName = 'look') {
    return { do: 'until', at, test: () => !this.talk, onStart: () => this.anim.setPose(poseName, 5), max: 60 };
  }

  /** (…and her) */
  herHold(at, poseName = 'look') {
    const me = this.world.me;
    return { do: 'until', at, test: () => !this.talk, onStart: () => me.anim.setPose(poseName, 5), max: 60 };
  }

  /** Both waiting where they are to be (each in an `until`, begun)? */
  inPlace() {
    const me = this.world.me;
    const mine = this.task && this.task.do === 'until' && this.task.began;
    const hers = me.task && me.task.do === 'until' && me.task.began;
    return !!(mine && hers);
  }

  do_sofa() {
    const w = this.world;
    const seats = w.seatPair();
    if (!seats) return this.plan();
    const [mine, hers] = seats;
    this.tasks.push({ do: 'sit', seat: mine, t: 90, line: null });
    this.her([{ do: 'sit', seat: hers, t: 90, line: null }]);
    const me = w.me;
    this.chat(
      'sofa',
      2,
      () => this.task && this.task.do === 'sit' && this.task.phase === 'sat' && me.task && me.task.do === 'sit' && me.task.phase === 'sat',
      () => {
        if (this.task && this.task.do === 'sit') this.task.t = 0;
        if (me.task && me.task.do === 'sit') me.task.t = 0;
      }
    );
  }

  do_frame() {
    const w = this.world;
    const spot = w.spots().filter((s) => s.kind === 'frame').sort(() => Math.random() - 0.5)[0];
    if (!spot) return this.plan();
    const [mine, hers] = this.pair(spot.at, spot.face);
    this.tasks.push({ do: 'walk', to: mine }, this.hold(spot.face));
    this.her([{ do: 'walk', to: hers }, this.herHold(spot.face)]);
    this.chat('frame', 1, () => this.inPlace(), null);
  }

  do_window() {
    const w = this.world;
    const spot = w.spots().find((s) => s.kind === 'window');
    if (!spot) return this.plan();
    const [mine, hers] = this.pair(spot.at, spot.face, 0.22);
    this.tasks.push({ do: 'walk', to: mine }, this.hold(spot.face));
    this.her([{ do: 'walk', to: hers }, this.herHold(spot.face)]);
    this.chat('window', 1, () => this.inPlace(), null);
  }

  do_dance() {
    const w = this.world;
    if (!w.musicOn()) return this.plan();
    const me = w.me;
    const mid = w.showSpot();
    const cam = w.camera.position;
    const [mine, hers] = this.pair(mid, V(cam.x, 0, cam.z), 0.24);
    this.tasks.push({ do: 'walk', to: mine }, { do: 'dance', t: 16 });
    this.her([{ do: 'walk', to: hers }, { do: 'dance', t: 16 }]);
    this.chat('dance', 1, () => this.task && this.task.do === 'dance' && me.task && me.task.do === 'dance', null);
  }

  do_cat() {
    const w = this.world;
    const cat = w.cat;
    if (!(w.catHome && cat.on && cat.world === w)) return this.plan();
    const at = w.near(V(cat.pos.x, 0, cat.pos.z), 0.42) || w.freeNear(cat.pos);
    const by = w.near(V(cat.pos.x, 0, cat.pos.z), 0.62) || w.freeNear(at);
    this.tasks.push({ do: 'walk', to: at }, { do: 'until', at: cat.pos, test: () => !this.talk, onStart: () => this.anim.setPose('pet', 5), max: 40 });
    this.her([{ do: 'walk', to: by }, { do: 'until', at: cat.pos, test: () => !this.talk, onStart: () => w.me.anim.setPose('look', 5), max: 40 }]);
    this.chat('cat', 1, () => this.inPlace(), () => cat.on && w.host.sound('meow'));
  }

  do_look() {
    // (nothing in particular to do together: he looks round the house, and she shows it him)
    const w = this.world;
    const spot = w.spots().filter((s) => !s.seat && s.at).sort(() => Math.random() - 0.5)[0];
    const at = spot ? spot.at : w.randomFree() || w.showSpot();
    const face = spot ? spot.face : w.camera.position;
    const [mine, hers] = this.pair(at, face);
    this.tasks.push({ do: 'walk', to: mine }, this.hold(face));
    this.her([{ do: 'walk', to: hers }, this.herHold(face)]);
    this.chat('look', 1, () => this.inPlace(), null);
  }

  /** Their picture: side by side, facing whoever looks on, a V for victory — and the app keeps it in her album. */
  do_photo() {
    const w = this.world;
    const me = w.me;
    const mid = w.showSpot();
    const cam = w.camera.position;
    const [mine, hers] = this.pair(mid, V(cam.x, 0, cam.z), 0.19);
    this.photoOn = true; // (till their picture is taken: she waits where she is to be, while he gets to his place too)
    this.tasks.push({ do: 'walk', to: mine }, { do: 'photo' });
    this.her([{ do: 'walk', to: hers }, { do: 'until', at: w.camera.position, test: () => !this.photoOn, onStart: () => me.anim.setPose('stand', 5), max: 40 }]);
  }

  /* ----- the beats of his own ----- */

  own(t, dt) {
    const w = this.world;
    const me = w.me;
    const a = this.anim;
    t.k = (t.k || 0) + dt;
    const next = (beat) => {
      t.beat = beat;
      t.k = 0;
      t.said = 0;
    };
    switch (t.do) {
      case 'vanish':
        this.vanish();
        return null;

      case 'knock': {
        // three raps on the door — and again, if she is long about it; then in he comes, once she has opened it
        const step = this.doorstep();
        if (!t.beat) next('rap');
        if (t.beat === 'rap') {
          if (!t.said) {
            t.said = 1;
            t.raps = (t.raps || 0) + 1;
            this.say(t.raps > 1 ? 'knock2' : 'knock');
            w.host.onHim('knock', this.visit);
            if (t.raps === 1) {
              me.welcome(this);
              w.frameDoor(true);
            } else if (!me.atDoor) me.welcome(this);
          }
          const rap = Math.floor(t.k / 0.26);
          a.hands.R = t.k < 0.95 ? step.knock.clone().add(V(rap % 2 ? 0.035 : 0, 0, 0)) : null;
          if (t.k > 1.2) next('wait');
          return false;
        }
        // (she has come, and opened the door)
        if (me.atDoor && w.room.doorOpen > 0.8) return true;
        if (t.k > 16) next('rap');
        return false;
      }

      case 'hello': {
        // hello, both of them — and the door shut behind him
        if (!t.beat) {
          next('his');
          w.room.openDoor(false);
          this.phase = 'in';
        }
        if (t.beat === 'his') {
          if (!t.said) {
            t.said = this.say('hello') || 2;
            a.setPose('wave', 7);
          }
          a.add.aRt = Math.sin(t.k * 11) * 0.25 * (t.k < 1.6 ? 1 : 0);
          if (t.k > Math.max(1.8, t.said * 0.75)) {
            a.add.aRt = 0;
            a.still();
            a.setPose('stand', 6);
            next('hers');
          }
          return false;
        }
        if (t.beat === 'hers') {
          if (!t.said) {
            t.said = this.herText(w.host.line('me', 'him_hello')) || 2;
            me.anim.setPose('cheer', 6);
            me.anim.mood.smile = 1;
            this.hearts();
          }
          if (t.k > Math.max(1.8, t.said * 0.8)) {
            me.anim.setPose('stand', 6);
            me.anim.mood.smile = 0;
            me.atDoor = false;
            w.frameDoor(false);
            w.host.onHim('in', this.visit);
            this.until = w.time + STAY;
            this.plans = this.makePlans();
            return true;
          }
          return false;
        }
        return true;
      }

      case 'photo': {
        // side by side, turned to whoever looks on; "사진 찍자!" — a V — the shutter — "잘 나왔다!"
        const cam = w.camera.position;
        this.turnTo(Math.atan2(cam.x - a.pos.x, cam.z - a.pos.z), dt);
        if (!t.beat) {
          // (she is to be there too)
          const hers = me.task && me.task.do === 'until' && me.task.began;
          if (!hers && t.k < 12) return false;
          next('ask');
          const mid = V((a.pos.x + me.pos.x) / 2, 0.62, (a.pos.z + me.pos.z) / 2);
          w.frameAt(mid, 0.42);
        }
        if (t.beat === 'ask') {
          if (!t.said) t.said = this.sayText(w.host.himChat('photo', 0)[0]) || 2;
          if (t.k > Math.max(1.6, t.said * 0.8)) next('yes');
          return false;
        }
        if (t.beat === 'yes') {
          if (!t.said) {
            t.said = this.herText(w.host.himChat('photo', 0)[1]) || 2;
            a.setPose('peace', 6);
            me.anim.setPose('peace', 6);
            a.mood.smile = me.anim.mood.smile = 1;
          }
          if (t.k > 1.9) next('snap');
          return false;
        }
        if (t.beat === 'snap') {
          if (!t.said) {
            t.said = 1;
            w.host.onHim('photo', this.visit);
          }
          if (t.k > 1.6) {
            a.setPose('stand', 5);
            me.anim.setPose('stand', 5);
            a.mood.smile = me.anim.mood.smile = 0;
            next('after');
          }
          return false;
        }
        if (t.beat === 'after') {
          if (!t.said) t.said = this.sayText(w.host.himChat('photo', 0)[2]) || 2;
          if (t.k > Math.max(1.4, t.said * 0.7)) {
            w.frameAt(null);
            this.photoOn = false;
            return true;
          }
          return false;
        }
        return true;
      }

      case 'gift': {
        // up to her; "선물이야!" — from his hands into hers; the app shows what it is (and his note), and he waits for that
        if (!t.beat) {
          if (!me.on) return true;
          next('go');
          const to = w.near(V(me.pos.x, 0, me.pos.z), 0.46) || w.freeNear(me.pos);
          t.walk = { do: 'walk', to, age: 0 };
          me.withHim = this;
          me.redo([{ do: 'until', at: a.pos, test: () => !(this.task && this.task.do === 'gift'), max: 90 }]);
        }
        if (t.beat === 'go') {
          t.walk.age += dt;
          if (this.walk(t.walk, dt) || t.k > 20) next('face');
          return false;
        }
        if (t.beat === 'face') {
          if (this.turnTo(Math.atan2(me.pos.x - a.pos.x, me.pos.z - a.pos.z), dt) || t.k > 1.5) {
            next('give');
            const mid = V((a.pos.x + me.pos.x) / 2, 0.62, (a.pos.z + me.pos.z) / 2);
            w.frameAt(mid, 0.4);
          }
          return false;
        }
        if (t.beat === 'give') {
          if (!t.said) {
            const box = makeParcel(!this.visit.gift);
            this.hold('R', box);
            a.setPose('offer', 6);
            t.said = this.say(this.visit.gift ? 'gift' : 'note') || 2;
          }
          if (t.k > Math.max(1.8, t.said * 0.85) && !this.handed) {
            this.handed = true;
            const box = this.drop('R');
            if (box) me.hold('R', box.object);
            me.anim.setPose('carry', 5);
            a.setPose('stand', 5);
            next('thanks');
          }
          return false;
        }
        if (t.beat === 'thanks') {
          if (!t.said) {
            t.said = this.herText(w.host.line('me', this.visit.gift ? 'him_gift' : 'him_note')) || 2;
            me.anim.mood.smile = 1;
            this.hearts();
          }
          if (t.k > Math.max(1.6, t.said * 0.85)) {
            next('show');
            w.host.onHim('gift', this.visit);
          }
          return false;
        }
        if (t.beat === 'show') {
          // (the app's window over the house: his present, his note — he waits till she has seen it)
          if (t.k < 1 || w.host.himHold()) return false;
          const held = me.drop('R');
          if (held) disposeTree(held.object);
          me.anim.setPose('stand', 5);
          me.anim.mood.smile = 0;
          w.frameAt(null);
          return true;
        }
        return true;
      }

      case 'bye': {
        // goodbye: to the door, she after him; out he goes, and she waves till the door shuts
        const door = w.room.doorway();
        if (!t.beat) {
          this.going = true;
          this.phase = 'going';
          this.endTalk();
          next('say');
        }
        if (t.beat === 'say') {
          if (!t.said) {
            t.said = this.say('bye') || 2;
            const by = w.freeNear(door.inside.clone().add(V(0.05, 0, 0.45))); // (on the side of the doorway away from the open door)
            me.withHim = this;
            me.redo([{ do: 'walk', to: by }, { do: 'until', at: a.pos, test: () => !this.on, onStart: () => me.anim.setPose('stand', 5), max: 60 }]);
          }
          if (t.k > Math.max(1.6, t.said * 0.8)) {
            next('door');
            t.walk = { do: 'walk', to: door.inside.clone(), age: 0 };
          }
          return false;
        }
        if (t.beat === 'door') {
          t.walk.age += dt;
          if (this.walk(t.walk, dt) || t.k > 25) {
            next('open');
            w.room.openDoor(true);
          }
          return false;
        }
        if (t.beat === 'open') {
          this.turnTo(Math.atan2(me.pos.x - a.pos.x, me.pos.z - a.pos.z), dt);
          if (t.k > 0.5 && !t.said) {
            t.said = this.herText(w.host.line('me', 'him_bye')) || 2;
            me.waveTo(a.pos, 'none');
          }
          if (t.k > 1.4) {
            next('out');
            t.walk = { do: 'walk', to: door.outside.clone().add(V(0.4, 0, 0)), direct: true, age: 0 };
          }
          return false;
        }
        if (t.beat === 'out') {
          t.walk.age += dt;
          if (this.walk(t.walk, dt) || t.k > 10) {
            next('away');
            w.room.openDoor(false);
            t.walk = { do: 'walk', to: this.doorstep().far, direct: true, age: 0 };
          }
          return false;
        }
        if (t.beat === 'away') {
          t.walk.age += dt;
          if (this.walk(t.walk, dt) || t.k > 10) {
            this.vanish();
            return null;
          }
          return false;
        }
        return true;
      }

      default:
        return undefined;
    }
  }

  /** A few hearts between the two of them. */
  hearts() {
    const w = this.world;
    if (!w.fx) return;
    const me = w.me;
    const mid = V((this.pos.x + me.pos.x) / 2, 0, (this.pos.z + me.pos.z) / 2);
    for (let i = 0; i < 5; i++) w.fx.emit(i % 2 ? '💗' : '💕', mid.clone().add(V((Math.random() - 0.5) * 0.35, 0.7 + Math.random() * 0.5, (Math.random() - 0.5) * 0.25)), { size: 0.1, rise: 0.35, life: 1.6 });
  }
}
