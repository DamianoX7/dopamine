// 뭉치, the white cat (../fox/cat.js is how it looks; js/cat.js is the app's side of it: how it is met, befriended and
// taken home). Out on the street a stray, at one of its places — a bench, the store's door, under the big tree; wary of
// her at first, then glad of her. Taken home it lives in the house with her: it strolls about, sits at the window,
// grooms, stretches, naps on the rug or up on her bed, follows her about, rubs against her legs — and at night it
// sleeps on the bed at her feet.
//
// It is one creature, on a fox's bones (rig.js, animator.js), in whichever world it is in now — the house's or the
// street's — and either supplies what it needs of a world: its scene, its time, a way from here to there (`path`), a
// bubble to speak in (`say`), its sparkles (`fx`), its people (`me`). A list of things to do, one after the other; when
// it runs out, the world says what next (`planCat`).
import * as THREE from '../vendor/three.module.min.js';
import { buildFox } from '../fox/rig.js';
import { FoxAnimator, wrapAngle } from '../fox/animator.js';
import { disposeTree } from '../fox/kit.js';

const WALK = 0.34; //  how fast it pads along (world units a second)
const TROT = 0.68; //  …and trots, to come to her
const TURN = 6; //     how fast it turns (radians a second)
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const ease = (k) => k * k * (3 - 2 * k);
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const _v = V();
const _w = V();

/** A churu: a soft stick of cat treat, white with a pink band, held out tip first. (In the frame of her hand, at her measure.) */
export function makeChuru() {
  const g = new THREE.Group();
  const stick = new THREE.Group();
  stick.position.set(0, -0.02, 0.02);
  stick.rotation.x = 1.1;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.024, 0.09, 0.008), new THREE.MeshStandardMaterial({ color: '#fbf6f2', roughness: 0.45 }));
  body.position.y = -0.04;
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.0245, 0.022, 0.0085), new THREE.MeshStandardMaterial({ color: '#ff8fb2', roughness: 0.5 }));
  band.position.y = -0.03;
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.006), new THREE.MeshStandardMaterial({ color: '#f3d9a8', roughness: 0.6 }));
  tip.position.y = -0.09;
  stick.add(body, band, tip);
  g.add(stick);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

export class Cat {
  constructor(world) {
    this.world = world;
    this.who = 'cat';
    this.rig = null;
    this.anim = null;
    this.on = false;
    this.tasks = [];
    this.task = null;
    this.abed = null; // (for the bubble: not lying in a bed as she does)
    this.perch = 0; //  how high it is standing or lying (on a bench, on the bed)
    this.lastSay = -99;
  }

  /** Its body (built the first time it is wanted). */
  build() {
    if (this.rig) return;
    const rig = (this.rig = buildFox('mungchi'));
    rig.tuneFur(360);
    rig.setShells(8);
    rig.group.traverse((o) => {
      if (o.isMesh || o.isLineSegments) o.userData.person = 'cat';
    });
    this.anim = new FoxAnimator(rig);
    rig.group.visible = false;
  }

  /** Into a world (the house's, or the street's) — out of the one it was in. */
  setWorld(world) {
    this.build();
    if (this.rig.group.parent) this.rig.group.parent.remove(this.rig.group);
    this.world = world;
    world.scene.add(this.rig.group);
  }

  /** There, turned `yaw`, `h` up (on something), doing `tasks` — shown. */
  show(at, yaw = 0, h = 0, tasks = []) {
    this.build();
    const a = this.anim;
    a.pos.set(at.x, 0, at.z);
    a.yaw = yaw;
    a.air = this.perch = h;
    a.speed = 0;
    a.look = null;
    a.lookW = 0;
    a.mood.eyes = 'open';
    a.mood.ears = 0;
    a.mood.wag = 0;
    a.mood.chew = 0;
    a.mood.mouth = 0;
    a.mood.breath = 1;
    a.still();
    a.setPose(h > 0.05 ? 'lie' : 'sit', 30);
    a.snap();
    this.tasks = tasks.slice();
    this.task = null;
    this.on = true;
    this.rig.group.visible = true;
  }

  hide() {
    this.on = false;
    this.tasks = [];
    this.task = null;
    if (this.rig) this.rig.group.visible = false;
  }

  get pos() {
    return this.anim.pos;
  }

  headPoint(out = V()) {
    return this.anim.headPoint(out);
  }

  meshes() {
    const out = [];
    if (this.rig && this.on) this.rig.group.traverse((o) => o.isMesh && out.push(o));
    return out;
  }

  /** Drop what it is doing and do this (`now`: these tasks, in place of all the rest). */
  do(tasks) {
    this.tasks = tasks.slice();
    this.task = null;
  }

  /** Something it says (the app has the lines: js/cat.js) — in its bubble. → how long it shows (seconds). */
  say(kind, ms) {
    const text = this.world.host.line('cat', kind);
    if (!text) return 0;
    this.lastSay = this.world.time;
    const long = ms || 2400;
    this.world.say(text, long, 'cat');
    return long / 1000;
  }

  /** Hearts (or notes, or Zzz) over its head. */
  fx(glyph, n = 1) {
    if (!this.world.fx) return;
    for (let i = 0; i < n; i++) this.world.fx.emit(glyph, this.headPoint(_w).clone().add(V((Math.random() - 0.5) * 0.12, 0.06, 0)), { size: 0.09, rise: 0.3, life: 1.3 });
  }

  // ---------------------------------------------------------------- every frame

  update(dt) {
    if (!this.on || !this.rig) return;
    const a = this.anim;
    if (!this.task) {
      if (!this.tasks.length) {
        if (this.world.planCat) this.world.planCat(this);
        if (!this.tasks.length) this.tasks.push({ do: 'sit', t: 2 });
      }
      this.task = this.tasks.shift();
      this.task.age = 0;
    }
    const t = this.task;
    t.age += dt;
    a.speed = 0;
    a.yawRate = 0;
    let done = false;
    try {
      done = this.run(t, dt);
    } catch (err) {
      console.error('[cat]', t.do, err);
      done = true;
    }
    if (done) {
      if (t.end) t.end();
      this.task = null;
    }
    a.update(dt);
    this.lookOfFace(t, dt);
  }

  /** What of its face shows, at the size it is seen and in the light it is in: its whiskers fade out with the distance
   *  (they are a pixel wide however far it is), its pupils open in the dark — and at something to eat. */
  lookOfFace(t, dt) {
    const face = this.rig.face;
    const cam = this.world.camera;
    if (!face.near || !cam) return;
    const px = innerHeight / (2 * Math.tan((cam.fov * Math.PI) / 360) * cam.position.distanceTo(this.headPoint(_v)));
    face.near(px * this.rig.scale);
    const lit = this.world.lit || { dark: 0 };
    const want = clamp(0.22 + 0.7 * lit.dark * (lit.light === false ? 1 : 0.6) + (t.do === 'eat' ? 0.3 : 0), 0, 1);
    this.pupil = damp(this.pupil == null ? want : this.pupil, want, 2, dt);
    face.pupil(this.pupil);
  }

  /** Turn towards `yaw`; true once it faces it. */
  turnTo(yaw, dt) {
    const a = this.anim;
    const d = wrapAngle(yaw - a.yaw);
    const step = clamp(d, -TURN * dt, TURN * dt);
    a.yaw += step;
    a.yawRate = step / Math.max(dt, 1e-4);
    return Math.abs(d) < 0.08;
  }

  /** A step towards `to` at `speed`: true once it is there. */
  stepTo(to, speed, dt, stop = 0.04) {
    const a = this.anim;
    const dx = to.x - a.pos.x;
    const dz = to.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    if (d < stop) return true;
    const want = Math.atan2(dx, dz);
    const off = Math.abs(wrapAngle(want - a.yaw));
    this.turnTo(want, dt);
    const v = speed * Math.max(0, Math.cos(Math.min(off, Math.PI / 2))) ** 2 * clamp(d / 0.15, 0.35, 1);
    const s = Math.min(d, v * dt);
    a.pos.x += (dx / d) * s;
    a.pos.z += (dz / d) * s;
    a.speed = v;
    return false;
  }

  /** Off whatever it is up on (a bench, the bed): a hop down, a little way out from it. */
  hopDownFirst() {
    if (this.perch < 0.05) return false;
    const a = this.anim;
    const out = a.pos.clone().add(V(Math.sin(a.yaw) * 0.32, 0, Math.cos(a.yaw) * 0.32));
    const free = this.world.freeNear ? this.world.freeNear(out) : out;
    this.tasks.unshift(this.task);
    this.task = { do: 'hop', to: free, h: 0, age: 0 };
    return true;
  }

  /* One thing to do, a frame of it: → true when it is done. */
  run(t, dt) {
    const a = this.anim;
    const w = this.world;
    switch (t.do) {
      case 'wait':
        a.setPose(this.perch > 0.05 ? 'perch' : 'stand', 6);
        return t.age > t.t;

      case 'walk': {
        // (down off a bench or the bed first)
        if (this.perch > 0.05 && !t.checked) {
          t.checked = true;
          if (this.hopDownFirst()) return false;
        }
        if (!t.path) t.path = (t.direct ? null : w.path(a.pos, t.to)) || [t.to.clone()];
        a.setPose('stand', 6);
        const next = t.path[0];
        if (!next) return true;
        if (this.stepTo(next, t.fast ? TROT : WALK, dt, t.path.length > 1 ? 0.08 : t.stop || 0.04)) {
          t.path.shift();
          if (!t.path.length) return true;
        }
        return t.age > (t.max || 30);
      }

      case 'face': {
        const at = t.at || w.camera.position;
        return this.turnTo(Math.atan2(at.x - a.pos.x, at.z - a.pos.z), dt) || t.age > 1.5;
      }

      case 'sit':
      case 'loaf': {
        if (!t.posed) {
          t.posed = true;
          a.setPose(t.do === 'loaf' ? 'lie' : 'sit', 4);
          a.mood.eyes = 'open';
          t.next = rand(1, 2.5);
        }
        // a look about now and then — at her, at the camera, at nothing
        if (t.age > t.next) {
          t.next = t.age + rand(1.5, 3.5);
          const r = Math.random();
          const me = w.me;
          if (r < 0.35 && me && me.on) {
            a.look = _v.copy(me.headPoint(V())).clone();
            a.lookW = 0.7;
          } else if (r < 0.6) {
            a.look = w.camera.position;
            a.lookW = 0.6;
          } else {
            a.look = null;
            a.lookW = 0;
          }
          a.mood.eyes = Math.random() < 0.25 ? 'happy' : 'open'; // (a slow blink: all is well)
        }
        if (t.at) this.turnTo(Math.atan2(t.at.x - a.pos.x, t.at.z - a.pos.z), dt);
        if (t.age > t.t) {
          a.look = null;
          a.lookW = 0;
          a.mood.eyes = 'open';
          return true;
        }
        return false;
      }

      case 'look': {
        // sitting, looking at something (out of the window): its tail twitching now and then
        if (!t.posed) {
          if (!this.turnTo(Math.atan2(t.at.x - a.pos.x, t.at.z - a.pos.z), dt)) return false;
          t.posed = true;
          a.setPose('sit', 4);
          a.look = t.at;
          a.lookW = 0.9;
        }
        a.mood.wag = Math.max(0, Math.sin(t.age * 0.9)) * 0.25;
        if (t.age > t.t) {
          a.look = null;
          a.lookW = 0;
          a.mood.wag = 0;
          return true;
        }
        return false;
      }

      case 'sleep': {
        if (!t.posed) {
          t.posed = true;
          a.setPose('sleep', 2.5);
          a.mood.eyes = 'sleep';
          a.mood.breath = 0.55;
          a.look = null;
          a.lookW = 0;
          t.z = 3;
        }
        if (t.age > t.z) {
          t.z = t.age + rand(3.5, 5.5);
          this.fx('💤');
        }
        const wake = t.until ? t.until() : t.age > t.t;
        if (wake) {
          a.mood.eyes = 'open';
          a.mood.breath = 1;
          a.setPose(this.perch > 0.05 ? 'lie' : 'sit', 3);
          return true;
        }
        return false;
      }

      case 'groom': {
        // sitting, a forepaw up to its mouth, licked — then over the ear
        if (!t.posed) {
          t.posed = true;
          a.setPose('sit', 5);
        }
        const k = t.age;
        a.lift[0] = 0.07 * clamp(k * 3, 0, 1) * clamp((t.t - k) * 3, 0, 1);
        a.add.nrx = 0.35 * clamp(k * 3, 0, 1) * clamp((t.t - k) * 3, 0, 1);
        a.add.hdx = 0.2 + Math.sin(k * 14) * 0.08;
        a.add.hdz = 0.25 * Math.sin(k * 0.8);
        a.mood.eyes = 'happy';
        if (k > t.t) {
          a.still();
          a.mood.eyes = 'open';
          return true;
        }
        return false;
      }

      case 'stretch': {
        if (!t.posed) {
          t.posed = true;
          a.setPose('bow', 4);
          a.mood.eyes = 'happy';
          a.mood.mouth = 0.3;
        }
        if (t.age > 0.9) a.mood.mouth = 0;
        if (t.age > 1.8) {
          a.setPose('stand', 4);
          a.mood.eyes = 'open';
          return true;
        }
        return false;
      }

      case 'hop': {
        // up onto something (`h` high: a bench, the bed) — or down: an arc from where it is
        if (!t.from) {
          t.from = a.pos.clone();
          t.h0 = this.perch;
          const yaw = Math.atan2(t.to.x - a.pos.x, t.to.z - a.pos.z);
          if (!this.turnTo(yaw, dt)) {
            t.from = null;
            return false;
          }
          a.setPose('crouch', 10);
          t.wind = 0;
        }
        if (t.wind < 0.25) {
          t.wind += dt;
          return false;
        }
        t.k = (t.k || 0) + dt / 0.5;
        const k = Math.min(1, t.k);
        a.pos.lerpVectors(t.from, t.to, ease(k));
        a.pos.y = 0;
        const top = Math.max(t.h0, t.h) + 0.12;
        a.air = t.h0 + (t.h - t.h0) * k + 4 * (top - Math.max(t.h0, t.h)) * k * (1 - k) * 0.7;
        a.setPose(k < 0.5 ? 'leap' : 'perch', 12);
        if (k >= 1) {
          a.air = this.perch = t.h;
          a.setPose(t.h > 0.05 ? 'perch' : 'stand', 8);
          return true;
        }
        return false;
      }

      case 'follow': {
        // after her, a little behind — and when she stops, round her legs
        const me = t.who || w.me;
        if (!me || !me.on) return true;
        const p = me.pos;
        const d = Math.hypot(p.x - a.pos.x, p.z - a.pos.z);
        if (d > (t.keep || 0.42)) {
          a.setPose('stand', 6);
          const to = _v.set(p.x, 0, p.z);
          this.stepTo(to, d > 1.2 ? TROT : WALK * 1.15, dt, t.keep || 0.42);
          t.still = 0;
        } else {
          t.still = (t.still || 0) + dt;
          this.turnTo(Math.atan2(p.x - a.pos.x, p.z - a.pos.z), dt);
          a.setPose('stand', 5);
          a.mood.wag = 0.3;
          a.mood.wiggle = t.still > 0.6 ? 0.6 : 0;
        }
        if (t.until && t.until()) {
          a.mood.wiggle = 0;
          return true;
        }
        return !t.until && t.age > (t.t || 10);
      }

      case 'rub': {
        // round her legs, tail up, leaning into her — purring
        const me = t.who || w.me;
        if (!me || !me.on) return true;
        if (!t.ang) {
          t.ang = Math.atan2(a.pos.x - me.pos.x, a.pos.z - me.pos.z);
          this.say('rub');
        }
        t.ang += dt * 1.6;
        const r = 0.28;
        const to = _v.set(me.pos.x + Math.sin(t.ang) * r, 0, me.pos.z + Math.cos(t.ang) * r);
        a.setPose('stand', 6);
        a.mood.tailUp = 0.6;
        a.mood.eyes = 'happy';
        this.stepTo(to, WALK, dt, 0.02);
        if (Math.random() < dt * 1.5) this.fx('💗');
        if (t.age > (t.t || 3.5)) {
          a.mood.tailUp = 0;
          a.mood.eyes = 'open';
          return true;
        }
        return false;
      }

      case 'wary': {
        // crouched, ears back, eyes on her: not sure about her yet
        const me = t.who || w.me;
        if (!t.posed) {
          t.posed = true;
          a.setPose('crouch', 6);
          a.mood.ears = 0.8;
          this.say('wary');
        }
        if (me && me.on) {
          a.look = _v.copy(me.headPoint(V())).clone();
          a.lookW = 0.9;
          this.turnTo(Math.atan2(me.pos.x - a.pos.x, me.pos.z - a.pos.z), dt);
        }
        if (t.age > t.t || (t.until && t.until())) {
          a.mood.ears = 0;
          a.look = null;
          a.lookW = 0;
          a.setPose('sit', 4);
          return true;
        }
        return false;
      }

      case 'eat': {
        // a treat out of her hand: nose down to it, chewing
        if (!t.posed) {
          t.posed = true;
          a.setPose('eat', 6);
          a.mood.chew = 1;
          a.mood.eyes = 'happy';
          this.say('eat');
        }
        if (Math.random() < dt * 1.2) this.fx(Math.random() < 0.5 ? '💗' : '✨');
        if (t.age > t.t) {
          a.mood.chew = 0;
          a.mood.eyes = 'open';
          a.setPose('sit', 5);
          return true;
        }
        return false;
      }

      case 'petted': {
        // leaning into her hand, eyes shut, purring
        if (!t.posed) {
          t.posed = true;
          a.setPose(this.perch > 0.05 ? 'lie' : 'pet', 5);
          a.mood.eyes = 'happy';
          this.say('purr');
          if (w.host.sound) w.host.sound('purr');
        }
        if (Math.random() < dt * 1.6) this.fx('💗');
        if (t.age > t.t) {
          a.mood.eyes = 'open';
          a.setPose(this.perch > 0.05 ? 'lie' : 'sit', 4);
          return true;
        }
        return false;
      }

      case 'meow': {
        if (!t.said) {
          t.said = true;
          a.mood.mouth = 0.36;
          this.say(t.line || 'meow');
          if (w.host.sound) w.host.sound('meow');
          if (t.at) this.turnTo(Math.atan2(t.at.x - a.pos.x, t.at.z - a.pos.z), dt);
        }
        if (t.age > 0.5) a.mood.mouth = 0;
        return t.age > 1.1;
      }

      case 'call':
        // (a word to the app: something has happened)
        if (t.fn) t.fn();
        return true;

      default:
        return true;
    }
  }

  dispose() {
    if (!this.rig) return;
    if (this.rig.group.parent) this.rig.group.parent.remove(this.rig.group);
    this.rig.dispose();
    disposeTree(this.rig.group);
    this.rig = null;
  }
}
