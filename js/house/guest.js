// Lorelei, when she comes round. She knocks, the door opens, and she comes in, says hello to
// whoever is looking on, and then makes herself at home for a while: looks out of the window,
// at the pictures on the wall, sits on the sofa swinging her legs, dances when a record is on
// — and says what she thinks of it now and then (the app has her lines). Tapped, she turns and
// waves. When her visit is over she says goodbye and goes out the way she came.
//
// She is the same girl as in the foxes' world (../fox/lorelei.js); what she can do is person.js.
import { buildLorelei } from '../fox/lorelei.js';
import { V } from './shapes.js';
import { Person } from './person.js';

export class Guest extends Person {
  constructor(world) {
    super(world, 'guest');
    this.until = 0; //      when her visit is over (world time)
    this.going = false; //  …and she is on her way out
  }

  build() {
    if (!this.rig) this.setRig(buildLorelei());
  }

  /* ----- her visit ----- */

  /** She comes round: a knock, the door, in she comes. `stay`: how long she stays (seconds). */
  arrive(stay = 180) {
    this.build();
    const door = this.world.room.doorway();
    const a = this.anim;
    a.pos.copy(door.outside);
    a.yaw = -Math.PI / 2; // (facing in through the door)
    a.air = 0;
    a.pitch = 0;
    a.speed = 0;
    a.setPose('stand', 20);
    a.snap();
    this.rig.group.visible = true;
    this.on = true;
    this.going = false;
    this.seat = null;
    this.until = this.world.time + stay;
    this.tasks = [
      { do: 'wait', t: 0.9 },
      { do: 'door', open: true },
      { do: 'wait', t: 0.5 },
      { do: 'walk', to: door.inside.clone(), direct: true },
      { do: 'door', open: false },
      { do: 'greet', line: 'hello' },
    ];
    this.task = null;
    this.world.host.onGuest('arrive');
  }

  /** Her visit is over: goodbye, and out of the door. (`now`: she is simply gone — the house was closed.) */
  leave(now = false) {
    if (!this.on) return;
    if (now) return this.vanish();
    if (this.going) return;
    this.going = true;
    const door = this.world.room.doorway();
    this.tasks = [
      ...(this.seat ? [{ do: 'stand' }] : []),
      { do: 'greet', line: 'bye' },
      { do: 'walk', to: door.inside.clone() },
      { do: 'door', open: true },
      { do: 'wait', t: 0.35 },
      { do: 'walk', to: door.outside.clone().add(V(0.5, 0, 0)), direct: true },
      { do: 'door', open: false },
      { do: 'vanish' },
    ];
    this.task = null;
    this.world.host.onGuest('leaving');
  }

  vanish() {
    this.on = false;
    this.going = false;
    this.pending = null;
    this.tasks = [];
    this.task = null;
    this.seat = null;
    if (this.rig) this.rig.group.visible = false;
    this.world.room.openDoor(false);
    this.world.hush('guest');
    this.world.host.onGuest('gone');
  }

  leaving() {
    return this.going;
  }

  tapped() {
    if (this.going) return;
    super.tapped();
  }

  waved(line) {
    this.world.host.onGuest(line === 'hello' ? 'hello' : line === 'bye' ? 'bye' : 'wave');
  }

  own(t) {
    if (t.do === 'vanish') {
      this.vanish();
      return null;
    }
    return undefined;
  }

  /* ----- what she does ----- */

  plan() {
    const w = this.world;
    if (!this.going && w.time > this.until) return this.leave();
    const music = w.musicOn();
    const choices = w
      .spots()
      .filter((s) => s.uid !== this.last && !(s.seat && w.taken(s.seat, this)))
      .map((s) => ({ ...s, weight: (s.weight || 1) * (music && s.kind === 'record' ? 4 : 1) }));
    if (music && Math.random() < 0.45) choices.push({ kind: 'dance', weight: 3 });
    choices.push({ kind: 'wander', weight: 0.8 });
    const c = this.choose(choices);
    if (c.kind === 'dance') {
      this.last = 'dance';
      this.tasks.push({ do: 'face' }, { do: 'say', line: 'music' }, { do: 'dance', t: 9 + Math.random() * 8 });
      return;
    }
    if (c.kind === 'wander') {
      this.last = 'wander';
      const p = w.randomFree();
      if (p) this.tasks.push({ do: 'walk', to: p }, { do: 'wait', t: 1.5 + Math.random() * 2.5 });
      else this.tasks.push({ do: 'wait', t: 2 });
      return;
    }
    this.goTo(c);
  }
}
