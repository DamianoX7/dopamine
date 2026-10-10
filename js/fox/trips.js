// Expeditions: a fox goes off into the woods for some hours (the app keeps the time) and comes
// home with a little parcel in its mouth for her. Here is the fox's side of that — how it
// leaves, how the others watch it go, how it brings her the parcel. Each is a behaviour like
// those in brain.js and is mixed into the Brain there; the world lets the fox out of the yard
// and back in (world.js: sendOff, homecoming).
import { clamp } from './kit.js';
import { wrapAngle } from './animator.js';

const damp = (cur, target, rate, dt) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

export const TRIPS = {
  /** Off it goes: a look back at her, then to the gap in the bushes (`gate`: where, and which way is out) and away through it. */
  *depart(gate) {
    const a = this.a;
    yield* this.turnTo(this.toCamera(), 7);
    this.lookAtYou();
    a.mood.wag = 1;
    this.say(this.w.host.line('depart'), 2600);
    yield* this.hop(0.18);
    yield* this.wait(0.8);
    a.mood.wag = 0;
    a.mood.tailUp = 0.35;
    a.lookW = 0;
    yield* this.goTo(gate.x, gate.z, { speed: this.reduce ? 'trot' : 'run', stop: 0.3, timeout: 10 });
    // …and on, out of the yard: nothing keeps it in now (keepInside)
    const top = (this.reduce ? 0.9 : 1.9) * this.S * this.pace;
    for (let t = 0; t < 1.8; ) {
      const dt = yield;
      t += dt;
      const turn = clamp(wrapAngle(gate.yaw - a.yaw), -6 * dt, 6 * dt);
      a.yaw += turn;
      a.yawRate = turn / Math.max(dt, 1e-4);
      a.speed = damp(a.speed, top, 5, dt);
      this.driven = true;
      a.pos.x += Math.sin(a.yaw) * a.speed * dt;
      a.pos.z += Math.cos(a.yaw) * a.speed * dt;
    }
    this.fox.gone = true; // (the world takes it out of the picture)
    yield* this.wait(30);
  },

  /** One of the family is off exploring: watch it go, tail wagging. */
  *seeOff(o) {
    const a = this.a;
    yield* this.wait(0.15 + 0.12 * this.place());
    yield* this.turnTo(this.angleTo(o), 6);
    a.setPose('alert', 6);
    this.lookAt(o, 0.9);
    a.mood.wag = 0.8;
    for (let t = 0; t < 4.5 && !o.gone; ) {
      t += yield;
      if (Math.abs(wrapAngle(this.angleTo(o) - a.yaw)) > 0.5) yield* this.turnTo(this.angleTo(o), 4);
    }
    a.mood.wag = 0;
  },

  /**
   * Home again, with a parcel for her: up to where the foxes meet her, and there it sits and
   * holds it out — for a while; then it carries on, parcel and all, and comes back to her with
   * it now and then, until she takes it. `fresh` = it has only just come in through the bushes.
   */
  *bringGift(fresh = false) {
    const a = this.a;
    const w = this.w;
    const front = w.env.spots.front;
    this.close = true;
    a.mood.tailUp = 0.35;
    yield* this.goTo(front.x, front.z, { speed: fresh && !this.reduce ? 'run' : 'trot', stop: 0.1, timeout: 10 });
    yield* this.turnTo(this.toCamera(), 6);
    a.mood.tailUp = 0;
    a.setPose('sit', 5);
    this.lookAtYou(0.95);
    let next = 0.4;
    for (let t = 0; t < 26 && w.gift && w.gift.fox === this.fox; ) {
      t += yield;
      a.mood.wag = 0.7 + 0.3 * Math.sin(t * 2.6);
      if (t > next) {
        next = t + 8;
        this.say(w.host.line('gift'), 3200);
      }
      if (Math.abs(wrapAngle(this.toCamera() - a.yaw)) > 0.3) yield* this.turnTo(this.toCamera(), 3);
    }
  },
};
