// 사냥 놀이 — she plays with 뭉치 (at home, once it lives with her: js/cat.js is the app's side). She takes out a wand with a
// feather on a string, and a finger moves the feather about the floor. It moves like something alive, and 뭉치 is at once all
// eyes: it creeps up, crouched; near enough, it stops, its pupils wide, and wiggles its behind — and pounces. Still there, the
// feather is caught. Whisked away in time, it has missed, and wants it all the more. A good game is a bit of both: `joy` fills
// up with teasing it, and most of all with its catches — and is only full once it has caught something.
//
// CatPlay is one game: the feather, the wand and the string in the room, and the cat's side of it (`catFrame`, a frame of its
// task 'hunt': house/cat.js). Her side is the task 'wand' (resident.js). The world hands it the finger.
import * as THREE from '../vendor/three.module.min.js';
import { damp } from './person.js';
import { V } from './shapes.js';
import { wrapAngle } from '../fox/animator.js';
import { disposeTree } from '../fox/kit.js';

const ease = (k) => k * k * (3 - 2 * k);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

const TIME = 45; //       how long a game lasts at most (seconds)
const WAND = 0.95; //     how long the wand is
const REACH = 2.3; //     how far from her the feather can go
const CLEAR = 0.72; //    …and how near (or the cat lands in her lap, out of sight)
const SPRING = 2.6; //    how far from it 뭉치 begins to creep
const NEAR = 0.62; //     …how far it pounces from
const LEAP = 0.95; //     …how far it can pounce
const CAUGHT = 0.17; //   …and how near the feather must be where it lands
const FLIGHT = 0.36; //   how long a pounce takes

/** The feather on its string: pink and blue, with a little bell. Its middle is at the origin, a little off the floor. */
function makeFeather() {
  const g = new THREE.Group();
  const leaf = new THREE.SphereGeometry(1, 12, 8);
  const COLORS = ['#ff8fb2', '#7fd0ee', '#ffd27a'];
  [-0.5, 0, 0.5].forEach((a, i) => {
    const m = new THREE.Mesh(leaf, new THREE.MeshStandardMaterial({ color: COLORS[i], roughness: 0.75 }));
    m.scale.set(0.034, 0.012, 0.12);
    m.position.set(Math.sin(a) * 0.09, 0.016, Math.cos(a) * 0.09);
    m.rotation.y = a;
    m.castShadow = true;
    g.add(m);
  });
  const bell = new THREE.Mesh(new THREE.SphereGeometry(0.03, 14, 10), new THREE.MeshStandardMaterial({ color: '#f0c24e', metalness: 0.6, roughness: 0.3 }));
  bell.position.y = 0.024;
  bell.castShadow = true;
  g.add(bell);
  return g;
}

export class CatPlay {
  constructor(world) {
    this.world = world;
    this.cat = world.cat;
    this.me = world.me;
    this.phase = 'go'; // 'go' (she gets ready), 'play', 'over'
    this.mode = 'watch'; // what the cat is at: 'watch', 'stalk', 'ready', 'pounce', 'caught', 'miss'
    this.t = 0; //         how long it has been at it
    this.time = 0; //      how long the game has gone on
    this.joy = 0; //       how much fun it is having: 0 … 100
    this.catches = 0;
    this.misses = 0;
    this.counted = 0; //   (misses that have already gone towards a catch)
    this.keen = 0; //      how much it wants the feather now: 0 … 1
    this.still = 0; //     how long the feather has not moved
    this.down = false; //  (her finger is on it)
    this.pos = V(); //     the feather
    this.aim = V(); //     …where her finger has it
    this.was = V();
    this.speed = 0;
    this.said = -9;
    this.tell = 0;
  }

  /** She goes to a clear place near it, and the cat stops what it is doing. → false if there is no room. */
  begin() {
    const w = this.world;
    const cat = this.cat;
    const spot = w.near(cat.pos, 1.05);
    if (!spot) return false;
    this.me.redo([{ do: 'walk', to: spot }, { do: 'wand', play: this }]);
    cat.do([{ do: 'hunt', play: this }]);
    return true;
  }

  /** She has taken out the wand: the feather goes down between the two of them. */
  start() {
    const w = this.world;
    const scene = w.scene;
    this.feather = makeFeather();
    this.rod = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.011, 1, 8), new THREE.MeshStandardMaterial({ color: '#c48c58', roughness: 0.5 }));
    this.rod.castShadow = true;
    this.line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new Array(12).fill(0).map(() => V())), new THREE.LineBasicMaterial({ color: '#7a6a7a' }));
    this.line.frustumCulled = false;
    scene.add(this.feather, this.rod, this.line);
    const d = V().subVectors(this.cat.pos, this.me.pos).setY(0);
    const len = d.length() || 1;
    this.pos.copy(this.me.pos).addScaledVector(d, Math.min(0.6, len * 0.5) / len).setY(0);
    this.settle(this.pos);
    this.aim.copy(this.pos);
    this.was.copy(this.pos);
    const mid = V().addVectors(this.me.pos, this.cat.pos).multiplyScalar(0.5);
    w.frameAt(mid, 0.36);
    this.phase = 'play';
    w.host.onCat('playOn');
    this.report();
  }

  // ---------------------------------------------------------------- her finger

  /** (x, y) on the screen, where the feather is to go: on the open floor, as far as the string goes. */
  finger(e) {
    const w = this.world;
    const p = w.floorAt(e.clientX, e.clientY, 0.02);
    if (!p) return;
    p.y = 0;
    const d = V().subVectors(p, this.me.pos);
    const far = d.length();
    if (far > REACH) p.copy(this.me.pos).addScaledVector(d, REACH / far);
    else if (far < CLEAR) p.copy(this.me.pos).addScaledVector(far > 0.01 ? d : d.set(0, 0, 1), CLEAR / (far > 0.01 ? far : 1));
    this.settle(p);
    this.aim.copy(p);
  }

  /** `p`, or the nearest open floor to it (it does not go through the furniture). */
  settle(p) {
    const w = this.world;
    const g = w.grid || w.makeGrid();
    const [i, j] = w.cellOf(p);
    if (g.open[i + j * g.nx]) return p;
    const c = w.nearestOpen(p);
    if (c) p.copy(w.centre(...c));
    p.y = 0;
    return p;
  }

  onDown(e) {
    if (this.phase !== 'play') return;
    this.down = true;
    this.finger(e);
  }

  onMove(e) {
    if (this.down && this.phase === 'play') this.finger(e);
  }

  onUp() {
    this.down = false;
  }

  // ---------------------------------------------------------------- every frame

  update(dt) {
    if (this.phase === 'over') return;
    const me = this.me;
    // (she was called away — to the door, say: the game is over)
    if (!(me.on && ((me.task && me.task.do === 'wand') || me.tasks.some((x) => x.do === 'wand')))) return this.end(true);
    if (this.phase !== 'play') return;
    this.time += dt;
    const pinned = this.mode === 'caught';
    if (!pinned) this.pos.lerp(this.aim, 1 - Math.exp(-13 * dt));
    this.speed = damp(this.speed, this.pos.distanceTo(this.was) / Math.max(dt, 1e-3), 12, dt);
    this.was.copy(this.pos);
    // it wants something that moves as prey moves: quick darts and pauses. A thing left lying is soon only a feather.
    const moving = this.speed > 0.1;
    this.still = moving ? 0 : this.still + dt;
    if (moving) this.keen = Math.min(1, this.keen + dt * clamp(this.speed, 0.3, 2) * 0.9);
    else if (this.still > 2.5) this.keen = Math.max(0, this.keen - dt * 0.14);
    const hop = moving ? Math.abs(Math.sin(this.time * 15)) * 0.03 : 0;
    this.feather.position.set(this.pos.x, 0.012 + hop, this.pos.z);
    if (moving) this.feather.rotation.y = damp(this.feather.rotation.y, this.feather.rotation.y + wrapAngle(Math.atan2(this.aim.x - this.pos.x, this.aim.z - this.pos.z) - this.feather.rotation.y), 8, dt);
    this.feather.rotation.z = pinned ? 0.5 : Math.sin(this.time * 7) * 0.08;
    this.drawWand();
    // (the camera goes along: the middle of the feather, the cat and her)
    const w = this.world;
    const at = w.atView;
    if (at) {
      const x = (this.pos.x + this.cat.pos.x + me.pos.x) / 3;
      const z = (this.pos.z + this.cat.pos.z + me.pos.z) / 3;
      w.view.target.x = damp(w.view.target.x, x, 2, dt);
      w.view.target.z = damp(w.view.target.z, z, 2, dt);
      w.keepTarget();
      at.target.copy(w.view.target);
    }
    if (this.time >= TIME) return this.end();
    this.tell -= dt;
    if (this.tell <= 0) this.report();
  }

  /** The wand from her hand, up and out towards the feather; the string from its tip, sagging a little. */
  drawWand() {
    const me = this.me;
    const hand = me.rig.bones.handR.getWorldPosition(V());
    const out = V().subVectors(this.pos, hand).setY(0);
    const far = out.length() || 1;
    out.divideScalar(far);
    const lift = clamp(0.5 - far * 0.12, 0.22, 0.5) + (this.down ? Math.sin(this.time * 9) * 0.02 : 0);
    const tip = hand.clone().addScaledVector(out, WAND * Math.cos(lift)).setY(hand.y + WAND * Math.sin(lift));
    const rod = this.rod;
    rod.position.lerpVectors(hand, tip, 0.5);
    rod.scale.set(1, hand.distanceTo(tip), 1);
    rod.quaternion.setFromUnitVectors(V(0, -1, 0), V().subVectors(tip, hand).normalize());
    const a = this.line.geometry.attributes.position;
    const n = a.count - 1;
    const p = V();
    const end = this.feather.position;
    const sag = Math.max(0, 0.16 - this.speed * 0.05);
    for (let i = 0; i <= n; i++) {
      const k = i / n;
      p.lerpVectors(tip, end, k);
      p.y = Math.max(0.012, p.y - sag * 4 * k * (1 - k));
      a.setXYZ(i, p.x, p.y, p.z);
    }
    a.needsUpdate = true;
  }

  /** How it is going, for the bar over the view. */
  report(hint = null) {
    this.tell = 0.2;
    this.world.host.onCat('playTick', { joy: this.joy, catches: this.catches, left: Math.max(0, TIME - this.time), hint });
  }

  to(mode) {
    this.mode = mode;
    this.t = 0;
    const a = this.cat.anim;
    a.mood.wiggle = 0;
    a.mood.eyes = 'open';
    a.mood.ears = 0;
    a.add.hdx = 0;
    a.noseY = null;
  }

  /** …a word from it (not all the time). */
  say(kind) {
    if (this.world.time - this.said < 4) return;
    this.said = this.world.time;
    this.cat.say(kind, 1300);
  }

  /** A frame of the cat's game (its task 'hunt'): → true when the game is over. */
  catFrame(task, dt) {
    const cat = this.cat;
    const a = cat.anim;
    if (this.phase === 'over') return this.catDone();
    if (!task.down) {
      task.down = true;
      if (cat.hopDownFirst()) return false;
      a.setPose('sit', 6);
    }
    a.look = this.phase === 'play' ? V(this.pos.x, 0.05, this.pos.z) : this.me.headPoint(V());
    a.lookW = 0.95;
    if (this.phase !== 'play') {
      cat.turnTo(Math.atan2(this.me.pos.x - a.pos.x, this.me.pos.z - a.pos.z), dt);
      return false;
    }
    this.t += dt;
    const dx = this.pos.x - a.pos.x;
    const dz = this.pos.z - a.pos.z;
    const d = Math.hypot(dx, dz);
    const yaw = Math.atan2(dx, dz);
    switch (this.mode) {
      case 'watch':
        // (sitting up, watching it — its tail twitching, the more it wants it)
        a.setPose('sit', 6);
        a.mood.wag = this.keen * 0.35;
        cat.turnTo(yaw, dt);
        if (this.keen > 0.22 && this.t > 0.4) this.to('stalk');
        break;
      case 'stalk': {
        // low to the ground, one paw at a time — quicker, if it has got far away
        a.setPose('crouch', 7);
        a.mood.wag = 0.15;
        if (d < NEAR) {
          this.to('ready');
          this.wait = rand(0.8, 1.5);
          this.say('stalk');
          this.report('ready');
          break;
        }
        const w = this.world;
        if (!w.grid) w.makeGrid();
        if (!w.clearLine(w.cellOf(a.pos), w.cellOf(this.pos))) {
          // (round what is in the way)
          task.at = (task.at || 0) - dt;
          if (task.at <= 0 || !task.way || !task.way.length) {
            task.at = 0.5;
            task.way = w.path(a.pos, this.pos) || [];
          }
          if (task.way[0] && cat.stepTo(task.way[0], 0.62, dt, 0.08)) task.way.shift();
        } else cat.stepTo(this.pos, d > 1.3 ? 0.62 : 0.3, dt, 0.02);
        if (this.keen < 0.08) this.to('watch');
        break;
      }
      case 'ready':
        // quite still, but for its behind
        a.setPose('crouch', 9);
        a.mood.wag = 0;
        a.mood.wiggle = 0.45 + 0.55 * clamp(this.t / this.wait, 0, 1);
        cat.turnTo(yaw, dt);
        if (d > 1) this.to('stalk');
        else if (this.t > this.wait) {
          this.to('pounce');
          const far = Math.min(d + 0.04, LEAP);
          this.from = a.pos.clone();
          this.land = V(a.pos.x + (dx / (d || 1)) * far, 0, a.pos.z + (dz / (d || 1)) * far);
          this.world.sound('pop');
        }
        break;
      case 'pounce': {
        const k = Math.min(1, this.t / FLIGHT);
        a.pos.lerpVectors(this.from, this.land, ease(k));
        a.pos.y = 0;
        a.air = 4 * 0.17 * k * (1 - k);
        a.setPose(k < 0.45 ? 'leap' : 'perch', 16);
        a.yaw = yaw;
        if (k >= 1) {
          a.air = 0;
          if (this.pos.distanceTo(a.pos) < CAUGHT + 0.08) this.caught();
          else this.missed();
        }
        break;
      }
      case 'caught':
        // both paws on it, and its teeth in it — it will not let go at once
        a.setPose('crouch', 10);
        a.mood.eyes = 'happy';
        a.add.hdx = 0.28 + Math.sin(this.t * 16) * 0.12;
        if (this.t > 1.5) {
          this.to('watch');
          this.keen = Math.max(this.keen, 0.5);
          // (she draws it out from under it)
          const away = V().subVectors(this.me.pos, this.pos).setY(0).normalize();
          this.aim.copy(this.pos).addScaledVector(away, 0.5);
          this.settle(this.aim);
          if (this.joy >= 100) this.end();
        }
        break;
      case 'miss':
        // where did it go? — its tail lashing
        a.setPose('crouch', 7);
        a.mood.wag = 0.7;
        cat.turnTo(yaw, dt);
        if (this.t > 0.8) {
          this.to('stalk');
          this.keen = Math.max(this.keen, 0.6);
        }
        break;
    }
    return false;
  }

  caught() {
    this.catches += 1;
    this.joy = Math.min(100, this.joy + 30 + 6 * Math.min(3, this.misses - this.counted));
    this.counted = this.misses;
    this.to('caught');
    this.pos.copy(this.cat.anim.pos).add(V(Math.sin(this.cat.anim.yaw) * 0.14, 0, Math.cos(this.cat.anim.yaw) * 0.14));
    this.aim.copy(this.pos);
    this.world.host.sound('reward');
    this.cat.fx('💗', 3);
    this.say('caught');
    this.report('caught');
  }

  missed() {
    this.misses += 1;
    // (a good tease is one that was close; it will not fill up for good without a catch)
    const close = this.pos.distanceTo(this.cat.anim.pos) < 0.7;
    this.joy = Math.min(this.catches ? 100 : 75, this.joy + (close ? 14 : 8));
    this.to('miss');
    this.say('miss');
    this.report('miss');
  }

  /** The game is over (`broken`: she was called away, or the house was shut). */
  end(broken = false) {
    if (this.phase === 'over') return;
    const played = this.phase === 'play';
    this.phase = 'over';
    const c = this.catches;
    const stars = !c ? 1 : c >= 2 && this.misses >= 2 ? 3 : 2;
    const scene = this.world.scene;
    for (const o of [this.feather, this.rod, this.line]) {
      if (!o) continue;
      scene.remove(o);
      disposeTree(o);
      if (o === this.line) {
        o.geometry.dispose();
        o.material.dispose();
      }
    }
    const a = this.me.anim;
    a.reach = null;
    a.look = null;
    a.lookW = 0;
    this.world.frameAt(null);
    this.world.playEnded(this);
    this.world.host.onCat('played', { stars, catches: c, misses: this.misses, joy: this.joy, played, broken });
  }

  /** The cat's end of it: all as it was, and (if it was fun) a wash. */
  catDone() {
    const cat = this.cat;
    const a = cat.anim;
    this.to('watch');
    a.look = null;
    a.lookW = 0;
    a.air = cat.perch;
    a.mood.wag = 0;
    a.setPose('sit', 5);
    if (this.catches) {
      cat.fx('💗', 2);
      cat.tasks = [{ do: 'meow', line: 'played' }, { do: 'groom', t: 3.5 }];
    }
    return true;
  }
}
