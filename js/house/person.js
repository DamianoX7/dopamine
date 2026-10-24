// Somebody in the house: Lorelei when she comes round (guest.js), and the girl who lives there
// (resident.js). Each has a simple mind — a list of things to do, one after the other, and when
// it runs out, something else — and the same things to do: walk somewhere round what stands in
// the way, look at a thing, sit on the sofa swinging her legs, lie down in bed and sleep, dance
// to the record, turn and wave when she is tapped, say what she thinks (the app has the lines) —
// and hold things in her hands (a bag, a phone, a bowl), upright whatever her arm does.
// The animator is Lorelei's (../fox/lorelei.js): everybody in the house is built on her bones.
import * as THREE from '../vendor/three.module.min.js';
import { LoreleiAnimator, LORELEI_POSES } from '../fox/lorelei.js';
import { disposeTree } from '../fox/kit.js';
import { V } from './shapes.js';

const WALK = 0.62; //   how fast she walks (world units a second)
const TURN = 5.5; //    …and turns (radians a second)
const HIPS = 0.507; //  her hips above her feet, standing
const Y_AXIS = V(0, 1, 0);
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
export const angle = (a) => Math.atan2(Math.sin(a), Math.cos(a));
export const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const ease = (k) => k * k * (3 - 2 * k);

// sitting on something: on a chair or a sofa (her feet hang a little above the floor), and on something low (a beanbag)
const POSES = {
  chair: { ...LORELEI_POSES.stand, hy: -0.105, hz: -0.01, lean: -0.04, tL: 1.42, tR: 1.42, kL: 1.45, kR: 1.45, fL: 0.15, fR: 0.15, sL: 0.08, sR: 0.08, aLf: 0.55, aRf: 0.55, eL: 0.75, eR: 0.75, aLo: -0.02, aRo: -0.02, nrx: 0, hdx: -0.05, walk: 0 },
  low: { ...LORELEI_POSES.stand, hy: -0.2, hz: -0.02, lean: -0.1, tL: 1.25, tR: 1.25, kL: 0.95, kR: 0.95, fL: -0.2, fR: -0.2, sL: 0.12, sR: 0.12, aLf: 0.45, aRf: 0.45, eL: 0.6, eR: 0.6, aLo: 0.05, aRo: 0.05, walk: 0 },
  // looking at something before her, her hands behind her back
  look: { ...LORELEI_POSES.stand, aLf: -0.35, aRf: -0.35, eL: 0.5, eR: 0.5, aLo: -0.05, aRo: -0.05, lean: 0.03 },
  // lying on her back, asleep: her hands on her middle, her head a little to one side
  lie: { ...LORELEI_POSES.stand, aLf: 0.35, aRf: 0.35, eL: 1.2, eR: 1.2, aLo: -0.12, aRo: -0.12, hdz: 0.18, hdx: 0.1, nrx: 0.08, fL: 0.35, fR: 0.35, walk: 0 },
};
export const pose = (name) => POSES[name] || LORELEI_POSES[name] || LORELEI_POSES.stand;

export class Person {
  constructor(world, who) {
    this.world = world;
    this.who = who; //       'guest' (Lorelei), 'me' (the girl who lives here), 'rider' (the courier): whose lines, whose bubble
    this.rig = null;
    this.anim = null;
    this.on = false; //      she is in the house
    this.tasks = [];
    this.task = null;
    this.seat = null; //     the seat she is on: { at, yaw, h }
    this.abed = null; //     …or the bed she is lying in: { foot, yaw, h }
    this.last = null; //     what she did last (not the same thing twice running)
    this.lastSay = -99;
    this.dance = 0; //       how much she is dancing (0 … 1)
    this.props = { L: null, R: null }; // what she has in her hands
  }

  /** Give her a body (a rig as Lorelei's): the animator moves it. Where she was, she stays. */
  setRig(rig) {
    const a = this.anim;
    if (this.rig) {
      // (what she has in her hands she keeps, in her new ones)
      const held = { L: this.drop('L'), R: this.drop('R') };
      this.world.scene.remove(this.rig.group);
      this.rig.dispose();
      this.held = held;
    }
    this.rig = rig;
    const anim = (this.anim = new LoreleiAnimator(rig));
    if (a) {
      anim.pos.copy(a.pos);
      anim.yaw = a.yaw;
      anim.air = a.air;
      anim.pitch = a.pitch;
      anim.target = a.target;
      anim.mood.eyes = a.mood.eyes;
      anim.snap();
    }
    rig.group.visible = this.on;
    rig.group.traverse((o) => {
      if (o.isMesh) {
        o.castShadow = true;
        o.userData.person = this.who;
      }
    });
    this.world.scene.add(rig.group);
    if (this.held) {
      for (const side of ['L', 'R']) if (this.held[side]) this.hold(side, this.held[side].object, this.held[side].off);
      this.held = null;
    }
  }

  get pos() {
    return this.anim.pos;
  }

  /** Where her head is (for her speech bubble). */
  headPoint(out = V()) {
    return this.anim.headPoint(out);
  }

  /* ----- what she says ----- */

  /** She says something about `kind` (the app has the lines). → how long it shows, in seconds (0: she had nothing to say). */
  say(kind, ms) {
    const text = this.world.host.line(this.who, kind);
    if (!text) return 0;
    this.lastSay = this.world.time;
    const long = ms || Math.min(6000, 2200 + text.length * 70);
    this.world.say(text, long, this.who);
    return long / 1000;
  }

  /* ----- what she has in her hands ----- */

  /** `object` in her hand (`side`: 'L' or 'R'), at her palm (and `off` from it): upright, turned the way she faces. */
  hold(side, object, off = null) {
    this.drop(side);
    if (!this.rig) return;
    object.position.copy(this.rig.dims.palm);
    if (off) object.position.add(off);
    object.traverse((o) => {
      if (o.isMesh) o.userData.person = this.who;
    });
    this.rig.bones[`hand${side}`].add(object);
    this.props[side] = { object, off };
    this.upright();
  }

  /** …taken out of her hand again (→ it, or null). */
  drop(side) {
    const p = this.props[side];
    if (!p) return null;
    if (p.object.parent) p.object.parent.remove(p.object);
    this.props[side] = null;
    return p;
  }

  /** Both hands empty (what was in them thrown away). */
  dropAll() {
    for (const side of ['L', 'R']) {
      const p = this.drop(side);
      if (p) disposeTree(p.object);
    }
    if (this.anim) this.anim.hands.L = this.anim.hands.R = null;
  }

  /* (whatever her arms do, what is in her hands stays upright, turned as she is) */
  upright() {
    for (const side of ['L', 'R']) {
      const p = this.props[side];
      if (!p || !p.object.parent) continue;
      p.object.parent.getWorldQuaternion(_q).invert();
      _q2.setFromAxisAngle(Y_AXIS, this.anim.yaw);
      p.object.quaternion.copy(_q).multiply(_q2);
    }
  }

  /* ----- what she does ----- */

  /** Something else to do, now that she has done what she was doing (the girl's own). */
  plan() {
    this.tasks.push({ do: 'wait', t: 2 });
  }

  /** A thing to do, picked from `list` ({ weight }) by its weight. */
  choose(list) {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let u = Math.random() * total;
    for (const x of list) if ((u -= x.weight) <= 0) return x;
    return list[list.length - 1];
  }

  /** Walk to a thing and do there what it is for: sit on it, look at it. */
  goTo(c) {
    this.last = c.uid || c.kind;
    if (c.seat) return this.tasks.push({ do: 'sit', seat: c.seat, t: c.t || 14 + Math.random() * 14, line: c.line || 'sit' });
    this.tasks.push({ do: 'walk', to: c.at }, { do: 'look', at: c.face, t: c.t || 4 + Math.random() * 4, line: c.line || c.kind, pose: c.pose || 'look' });
  }

  /** She was tapped: she turns to whoever is looking on and waves — from where she sits, if she is sitting. */
  tapped() {
    this.waveTo(null, 'tap');
  }

  /**
   * She turns to `at` (a point — null: whoever is looking on) and waves, saying `line`; sitting, she waves from where she
   * sits; then she goes on with what she was doing. `after`: not now but in so many seconds (the other one is still talking).
   */
  waveTo(at, line, after = 0, tries = 0) {
    if (!this.on) return;
    if (after > 0) {
      this.pending = { at, line, when: this.world.time + after, tries };
      return;
    }
    const t = this.task;
    // (in the middle of something that will not wait — or sitting down, getting up: in a moment, if it is for somebody)
    const later = () => line !== 'tap' && tries < 6 && (this.pending = { at, line, when: this.world.time + 0.8, tries: tries + 1 });
    if (t && (t.do === 'greet' || t.do === 'wave' || t.do === 'door' || t.do === 'twirl')) return void later();
    if (t && (t.do === 'sit' || t.do === 'lie')) {
      // (sat, she waves where she is; asleep, she stirs)
      if ((t.phase === 'sat' || t.phase === 'lying') && t.waveAt == null) {
        t.waveAt = t.age;
        this.say(t.do === 'lie' ? 'sleepy' : line);
      } else if (t.phase !== 'sat' && t.phase !== 'lying') later();
      return;
    }
    // whatever she was doing, she does once she has waved (from where she has got to)
    if (t) {
      t.path = null;
      t.posed = false;
      t.age = 0;
      this.tasks.unshift(t);
      this.anim.look = null;
      this.anim.lookW = 0;
      this.anim.setPose('stand', 6);
    }
    this.tasks.unshift({ do: 'wave', at, line });
    this.task = null;
  }

  /** (for the girl's own tasks: true once it is done — undefined, if it is not one of hers) */
  own() {
    return undefined;
  }

  /** (she waved: what it was for) */
  waved() {}

  update(dt) {
    if (!this.on || !this.rig) return;
    const a = this.anim;
    if (this.pending && this.world.time >= this.pending.when) {
      const p = this.pending;
      this.pending = null;
      this.waveTo(p.at, p.line, 0, p.tries || 0);
    }
    if (!this.task) {
      if (!this.tasks.length) this.plan();
      this.task = this.tasks.shift() || { do: 'wait', t: 1 };
      this.task.age = 0;
    }
    const t = this.task;
    t.age += dt;
    let done = false;
    a.speed = 0;
    a.yawRate = 0;
    switch (t.do) {
      case 'wait':
        done = t.age >= t.t;
        break;
      case 'door':
        this.world.room.openDoor(t.open);
        done = t.age > 0.55;
        break;
      case 'walk':
        done = this.walk(t, dt);
        break;
      case 'face': {
        const c = t.at || this.world.camera.position;
        done = this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), dt);
        break;
      }
      case 'pose':
        if (!t.posed) {
          t.posed = true;
          a.setPose(t.pose, t.rate || 5);
          if (t.line) this.say(t.line);
        }
        if (t.age > t.t) {
          a.setPose('stand', 5);
          done = true;
        }
        break;
      case 'greet':
      case 'wave': {
        // (turned to her — or to whoever she waves at — a wave; seated, she waves from where she sits)
        const c = t.at || this.world.camera.position;
        const turned = this.seat ? true : this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), dt);
        if (turned && !t.waved) {
          t.waved = true;
          t.from = t.age;
          if (!this.seat) a.setPose('wave', 7);
          this.say(t.line, t.do === 'greet' ? 3800 : undefined);
          this.waved(t.line);
        }
        if (t.waved) {
          const k = t.age - t.from;
          if (this.seat) {
            a.add.aRo = Math.min(1, k * 4) * 1.4 * (k < 1.8 ? 1 : 0);
            a.add.eR = Math.min(1, k * 4) * 1.6 * (k < 1.8 ? 1 : 0);
          }
          a.add.aRt = Math.sin(k * 11) * 0.25 * (k < 1.8 ? 1 : 0);
          if (k > 1.9) {
            a.still();
            if (!this.seat) a.setPose('stand', 6);
            done = true;
          }
        }
        if (t.age > 6) done = true;
        break;
      }
      case 'say':
        this.say(t.line);
        done = true;
        break;
      case 'until':
        // (waiting for something — `test()` — facing `at`, if there is something to face; `onStart()` once it begins)
        if (!t.began) {
          t.began = true;
          if (t.onStart) t.onStart();
        }
        if (t.at) this.turnTo(Math.atan2(t.at.x - a.pos.x, t.at.z - a.pos.z), dt);
        done = t.test() || (t.max && t.age > t.max);
        break;
      case 'look': {
        const turned = this.turnTo(Math.atan2(t.at.x - a.pos.x, t.at.z - a.pos.z), dt);
        if (turned) {
          if (!t.posed) {
            t.posed = true;
            a.setPose(t.pose, 5);
            if (this.world.time - this.lastSay > 9 && Math.random() < 0.75) this.say(t.line);
          }
          a.look = t.at;
          a.lookW = damp(a.lookW, 1, 4, dt);
        }
        if (t.age > t.t) {
          a.setPose('stand', 5);
          a.look = null;
          a.lookW = 0;
          done = true;
        }
        break;
      }
      case 'dance':
        done = this.dancing(t, dt);
        break;
      case 'sit':
        done = this.sit(t, dt);
        break;
      case 'stand':
        done = this.standUp(t, dt);
        break;
      case 'lie':
        done = this.lie(t, dt);
        break;
      default: {
        const mine = this.own(t, dt);
        if (mine === null) return; // (gone)
        done = mine === undefined ? true : mine;
      }
    }
    if (t.do !== 'dance' && this.dance > 0) {
      this.dance = damp(this.dance, 0, 5, dt);
      if (this.dance < 0.02) {
        this.dance = 0;
        a.still();
      }
    }
    if (done) this.task = null;
    a.update(dt);
    this.upright();
  }

  /** Turn on the spot towards `yaw`; true once she faces it. */
  turnTo(yaw, dt) {
    const a = this.anim;
    const d = angle(yaw - a.yaw);
    const step = Math.sign(d) * Math.min(Math.abs(d), TURN * dt);
    a.yaw += step;
    a.yawRate = step / Math.max(dt, 1e-4);
    return Math.abs(d) < 0.06;
  }

  /** Walk to `t.to` round whatever stands in the way (straight there, if `direct`). */
  walk(t, dt) {
    const a = this.anim;
    if (!t.path) t.path = t.direct ? [t.to.clone()] : this.world.path(a.pos, t.to) || [t.to.clone()];
    const next = t.path[0];
    if (!next) return true;
    const dx = next.x - a.pos.x;
    const dz = next.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 0.05) {
      t.path.shift();
      return !t.path.length;
    }
    const want = Math.atan2(dx, dz);
    const off = Math.abs(angle(want - a.yaw));
    this.turnTo(want, dt);
    const speed = WALK * Math.max(0, Math.cos(Math.min(off, Math.PI / 2))) ** 2;
    const step = Math.min(dist, speed * dt);
    a.pos.x += (dx / dist) * step;
    a.pos.z += (dz / dist) * step;
    a.speed = speed;
    if (t.age > 25) return true; // (she cannot get there: never mind)
    return false;
  }

  /** On the sofa (or a chair, the bed, a beanbag): to the front of it, turned round, sat down — for a while — and up again. */
  sit(t, dt) {
    const a = this.anim;
    const s = t.seat;
    if (!t.phase) {
      t.front = s.at.clone().add(V(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar(0.34));
      t.walk = { do: 'walk', to: t.front, age: 0 };
      t.phase = 'go';
    }
    if (t.phase === 'go') {
      t.walk.age += dt;
      if (this.walk(t.walk, dt)) t.phase = 'turn';
      return false;
    }
    if (t.phase === 'turn') {
      if (this.turnTo(s.yaw, dt)) {
        t.phase = 'down';
        t.k = 0;
        a.target = pose(s.h < 0.3 ? 'low' : 'chair');
        a.rate = 7;
        this.seat = s;
      }
      return false;
    }
    if (t.phase === 'down') {
      t.k = Math.min(1, t.k + dt / 0.55);
      const k = ease(t.k);
      a.pos.lerpVectors(t.front, s.at, k);
      a.air = k * this.lift(s);
      if (t.k >= 1) {
        t.phase = 'sat';
        t.sat = t.age;
        if (this.world.time - this.lastSay > 6) this.say(t.line);
      }
      return false;
    }
    if (t.phase === 'sat') {
      // her legs swing; tapped, she waves where she sits
      const k = t.age - t.sat;
      a.add.kL = Math.sin(k * 2.3) * 0.16;
      a.add.kR = Math.sin(k * 2.3 + 2.4) * 0.16;
      this.waveSeated(t);
      if (k > t.t || this.leaving()) {
        t.phase = 'up';
        t.k = 0;
        a.still();
        a.setPose('stand', 6);
      }
      return false;
    }
    // up again
    t.k = Math.min(1, t.k + dt / 0.5);
    const k = ease(t.k);
    a.pos.lerpVectors(s.at, t.front, k);
    a.air = (1 - k) * this.lift(s);
    if (t.k >= 1) {
      a.air = 0;
      this.seat = null;
      return true;
    }
    return false;
  }

  /* (tapped while she sits, or lies: a wave of her right hand) */
  waveSeated(t) {
    if (t.waveAt == null) return;
    const a = this.anim;
    const w = t.age - t.waveAt;
    const on = w < 1.8 ? Math.min(1, w * 4) : Math.max(0, 1 - (w - 1.8) * 4);
    a.add.aRo = 1.4 * on;
    a.add.eR = 1.6 * on;
    a.add.aRt = Math.sin(w * 11) * 0.25 * on;
    if (w > 2.1) {
      t.waveAt = null;
      a.add.aRo = a.add.eR = a.add.aRt = 0;
    }
  }

  /** (is she on her way out? — then she gets up from wherever she is) */
  leaving() {
    return false;
  }

  /* How far up she is sat on `s`: her hips a little above the seat. */
  lift(s) {
    const hips = HIPS + pose(s.h < 0.3 ? 'low' : 'chair').hy;
    return Math.max(-0.04, s.h + 0.045 - hips);
  }

  standUp(t, dt) {
    const a = this.anim;
    if (this.abed) return this.getUp(t, dt);
    if (!this.seat) return true;
    const s = this.seat;
    if (!t.front) {
      t.front = s.at.clone().add(V(Math.sin(s.yaw), 0, Math.cos(s.yaw)).multiplyScalar(0.34));
      t.k = 0;
      a.still();
      a.setPose('stand', 6);
    }
    t.k = Math.min(1, t.k + dt / 0.5);
    const k = ease(t.k);
    a.pos.lerpVectors(s.at, t.front, k);
    a.air = (1 - k) * this.lift(s);
    if (t.k >= 1) {
      a.air = 0;
      this.seat = null;
      return true;
    }
    return false;
  }

  /**
   * Into bed: to the side of it, and in — on her back, her head on the pillow — asleep until `t.until` (world time) or
   * she is woken; then up again. `t.bed`: { foot (where her feet are, lying), side (where she gets in), yaw, h }.
   * `t.now`: she is asleep in it already (the house was opened in the night).
   */
  lie(t, dt) {
    const a = this.anim;
    const b = t.bed;
    if (!t.phase) {
      if (t.now) {
        this.abed = b;
        a.pos.copy(b.foot);
        a.yaw = b.yaw;
        a.pitch = -Math.PI / 2;
        a.air = b.h;
        a.target = pose('lie');
        a.rate = 20;
        a.mood.eyes = 'sleep';
        a.snap();
        t.phase = 'lying';
        t.sleep = t.age;
      } else {
        t.walk = { do: 'walk', to: b.side, age: 0 };
        t.phase = 'go';
      }
    }
    if (t.phase === 'go') {
      t.walk.age += dt;
      if (this.walk(t.walk, dt)) {
        t.phase = 'in';
        t.k = 0;
        t.from = { pos: a.pos.clone(), yaw: a.yaw };
        this.abed = b;
        a.target = pose('lie');
        a.rate = 4;
        if (this.world.time - this.lastSay > 4) this.say('bed');
      }
      return false;
    }
    if (t.phase === 'in') {
      t.k = Math.min(1, t.k + dt / 1.1);
      const k = ease(t.k);
      a.pos.lerpVectors(t.from.pos, b.foot, k);
      a.yaw = t.from.yaw + angle(b.yaw - t.from.yaw) * k;
      a.pitch = (-Math.PI / 2) * ease(Math.max(0, (t.k - 0.15) / 0.85));
      a.air = b.h * Math.sin(k * Math.PI * 0.5) + 0.06 * Math.sin(k * Math.PI);
      if (t.k >= 1) {
        t.phase = 'lying';
        t.sleep = t.age;
        a.mood.eyes = 'sleep';
      }
      return false;
    }
    if (t.phase === 'lying') {
      this.waveSeated(t);
      // Zzz…
      if ((t.zz = (t.zz || 0) - dt) <= 0) {
        t.zz = 2.2 + Math.random();
        if (this.world.fx) this.world.fx.emit('💤', this.headPoint(V()).add(V(0, 0.12, 0)), { size: 0.12, rise: 0.18, life: 2.4 });
      }
      if (this.world.time > (t.until || Infinity) || t.wake) {
        t.phase = 'out';
        t.k = 0;
        a.mood.eyes = 'open';
        a.setPose('stand', 4);
      }
      return false;
    }
    // up and out of it
    return this.getUp(t, dt);
  }

  getUp(t, dt) {
    const a = this.anim;
    const b = this.abed;
    if (!b) return true;
    if (t.phase !== 'out') {
      t.phase = 'out';
      t.k = 0;
    }
    if (t.k === 0) {
      a.mood.eyes = 'open';
      a.setPose('stand', 4);
    }
    t.k = Math.min(1, t.k + dt / 1.0);
    const k = ease(t.k);
    a.pos.lerpVectors(b.foot, b.side, k);
    a.pitch = (-Math.PI / 2) * (1 - ease(Math.min(1, t.k / 0.8)));
    a.air = b.h * (1 - k);
    if (t.k >= 1) {
      a.pitch = 0;
      a.air = 0;
      this.abed = null;
      return true;
    }
    return false;
  }

  /** Dancing to the record: a sway of her hips, her arms up and down, a bob. */
  dancing(t, dt) {
    const a = this.anim;
    const c = this.world.camera.position;
    this.turnTo(Math.atan2(c.x - a.pos.x, c.z - a.pos.z), dt * 0.4);
    this.dance = damp(this.dance, 1, 3, dt);
    const beat = this.world.beat(); // (0 … 1 through each beat of the song, if it is known; otherwise a steady one)
    const b = beat.phase * Math.PI * 2;
    const d = this.dance;
    const bar = Math.floor(beat.count / 4) % 4; // (what the arms do changes every bar)
    a.add.tilt = Math.sin(b) * 0.07 * d;
    a.add.twist = Math.sin(b * 0.5) * 0.12 * d;
    a.add.hy = -Math.abs(Math.sin(b)) * 0.02 * d;
    a.add.hdz = Math.sin(b + 0.6) * 0.1 * d;
    a.add.hdx = -0.06 * d;
    a.add.kL = Math.max(0, Math.sin(b)) * 0.25 * d;
    a.add.kR = Math.max(0, -Math.sin(b)) * 0.25 * d;
    a.add.aLo = (bar === 1 || bar === 3 ? 2.2 : 0.5 + Math.max(0, Math.sin(b)) * 0.6) * d;
    a.add.aRo = (bar === 1 || bar === 2 ? 2.2 : 0.5 + Math.max(0, -Math.sin(b)) * 0.6) * d;
    a.add.eL = 0.6 * d;
    a.add.eR = 0.6 * d;
    a.mood.smile = d;
    if (t.age > t.t || !this.world.musicOn()) {
      a.still();
      a.mood.smile = 0;
      this.dance = 0;
      return true;
    }
    return false;
  }

  /* ----- light ----- */

  /** She is lit in her own colours, as bright as the room is (as in the foxes' world: lorelei.js, dress). */
  light(color, sun) {
    if (!this.rig) return;
    const lit = this.rig.light;
    lit.uLight.value.copy(color);
    lit.uSun.value = sun;
  }

  /** The meshes a tap can find her by. */
  meshes() {
    const out = [];
    if (this.rig && this.on) this.rig.group.traverse((o) => o.isMesh && out.push(o));
    return out;
  }
}
