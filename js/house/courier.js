// The courier, with what she ordered (the app's js/delivery.js; food.js has the dishes). Up the path to the door he
// comes, a paper bag in his hand, and knocks; she comes to the door — out of bed, off the sofa, whatever she was doing —
// and opens it; and on the doorstep they talk a little as he gives it to her: "주문하신 마라탕 나왔습니다!", "감사합니다~!",
// a word about the weather or the hour, goodbyes. Then off he goes, and she shuts the door and sits down to eat.
//
// He stands outside: through the open door, he is seen as one sees the courier — on the step, in his helmet.
import { buildMe } from './me.js';
import { Person } from './person.js';
import { makeBag } from './food.js';
import { V } from './shapes.js';
import { WALL_T } from './room.js';

/* What he looks like (me.js builds him as it builds her): a yellow helmet over short dark hair, an orange hoodie, jeans. */
const LOOK = {
  skin: '#f6d2ba',
  eyes: { color: '#4e3c3e', shape: 'soft' },
  hair: { style: 'bob', bangs: 'side', top: '#3d3238', tip: '#3d3238' },
  top: { kind: 'hoodie', color: '#ffb547', color2: '#ffffff' },
  bottom: { kind: 'jeans', color: '#56608f' },
  legs: { kind: 'bare' },
  shoes: { kind: 'sneakers', color: '#ffffff' },
  head: { kind: 'helmet', color: '#ffdc4a' },
};

export class Courier extends Person {
  constructor(world) {
    super(world, 'rider');
    this.order = null; //   what he brings: { id, name }
    this.handed = false; // …and whether she has it yet
  }

  build() {
    if (!this.rig) this.setRig(buildMe(LOOK));
  }

  /** Where he walks up from, the step he stands on, where she stands to take it, where he knocks. */
  doorstep() {
    const s = this.world.spec;
    const x = s.w / 2;
    const u = s.door.u;
    return { far: V(x + 1.9, 0, u + 1.6), at: V(x + WALL_T + 0.1, 0, u + 0.03), inside: V(x - 0.3, 0, u - 0.13), knock: V(x + WALL_T * 0.6, 0.78, u + 0.1) };
  }

  /** He is here with `order` ({ id, name }): up to the door, and a knock. */
  come(order) {
    this.build();
    const step = this.doorstep();
    const a = this.anim;
    this.order = order;
    this.handed = false;
    this.knocks = 0;
    a.pos.copy(step.far);
    a.yaw = Math.atan2(step.at.x - step.far.x, step.at.z - step.far.z);
    a.pitch = 0;
    a.air = 0;
    a.still();
    a.setPose('stand', 20);
    a.snap();
    this.rig.group.visible = true;
    this.on = true;
    this.seat = null;
    this.hold('R', makeBag().object);
    this.tasks = [
      { do: 'walk', to: step.at, direct: true },
      { do: 'face', at: step.inside },
      { do: 'scene', beat: 'knock' },
      { do: 'walk', to: step.far, direct: true },
      { do: 'vanish' },
    ];
    this.task = null;
  }

  /** Gone (his round done — or the house was closed: then quietly, at once). */
  vanish(quiet = false) {
    const was = this.on;
    this.on = false;
    this.tasks = [];
    this.task = null;
    this.pending = null;
    this.dropAll();
    if (this.rig) this.rig.group.visible = false;
    this.world.hush('rider');
    this.world.frameDoor(false);
    if (was && !quiet) this.world.host.onDelivery('gone', this.order);
  }

  /** Is he at the door, or on his way to it? (Lorelei waits: one at the door at a time.) */
  busy() {
    return this.on;
  }

  tapped() {
    if (!this.on) return;
    // (in the middle of it, he only says hello; walking up or away, he turns and waves)
    if (this.task && this.task.do === 'scene') {
      if (this.world.time - this.lastSay > 3) this.say('tap');
      return;
    }
    super.tapped();
  }

  own(t, dt) {
    if (t.do === 'vanish') {
      this.vanish();
      return null;
    }
    if (t.do === 'scene') return this.scene(t, dt);
    return undefined;
  }

  /* The knock, and what is said and given on the doorstep, a beat at a time. */
  scene(t, dt) {
    const w = this.world;
    const me = w.me;
    const a = this.anim;
    const step = this.doorstep();
    t.k = (t.k || 0) + dt;
    const next = (beat) => {
      t.beat = beat;
      t.k = 0;
      t.said = 0;
    };
    // (he faces her, if she is there — or the door)
    const face = me.on && t.beat !== 'knock' && t.beat !== 'wait' ? me.pos : step.inside;
    this.turnTo(Math.atan2(face.x - a.pos.x, face.z - a.pos.z), dt);
    switch (t.beat) {
      case 'knock': {
        if (!t.said) {
          this.knocks++;
          t.said = this.say(this.knocks > 1 ? 'knock2' : 'knock') || 1;
          w.host.onDelivery('knock', this.order);
          if (this.knocks === 1 || !me.atDoor) me.answerDoor(this);
          if (this.knocks === 1) w.frameDoor(true); // (the camera comes over to the door)
        }
        // three raps on the door
        const rap = Math.floor(t.k / 0.26);
        a.hands.R = t.k < 0.95 ? step.knock.clone().add(V(rap % 2 ? 0.035 : 0, 0, 0)) : null;
        if (t.k > 1.2) next('wait');
        return false;
      }
      case 'wait':
        // until she has come and opened the door (once more, if she is long about it)
        if (me.atDoor && w.room.doorOpen > 0.8) next('hello');
        else if (t.k > 16) next('knock');
        return false;
      case 'hello':
        if (!t.said) {
          t.said = this.say('hand') || 2;
          a.setPose('carry', 5);
        }
        if (t.k > t.said * 0.8) next('thanks');
        return false;
      case 'thanks':
        if (!t.said) t.said = me.say('thanks') || 2;
        if (t.k > 0.5) me.anim.setPose('offer', 6);
        if (t.k > 0.9) next('give');
        return false;
      case 'give':
        if (!t.said) {
          t.said = 1;
          a.setPose('offer', 6);
        }
        if (t.k > 0.55 && !this.handed) {
          // from his hands into hers
          this.handed = true;
          const bag = this.drop('R');
          if (bag) me.hold('R', bag.object);
          me.anim.setPose('carry', 5);
          w.host.onDelivery('handed', this.order);
        }
        if (t.k > 1.1) {
          a.setPose('stand', 5);
          next('extra');
        }
        return false;
      case 'extra':
        if (!t.said) t.said = this.say('extra') || 2;
        if (t.k > t.said * 0.85) next('bye1');
        return false;
      case 'bye1':
        if (!t.said) t.said = me.say('bye') || 2;
        if (t.k > t.said * 0.7) next('bye2');
        return false;
      case 'bye2':
        if (!t.said) {
          t.said = this.say('bye') || 2;
          a.setPose('wave', 7);
        }
        a.add.aRt = Math.sin(t.k * 11) * 0.25 * (t.k < 1.6 ? 1 : 0);
        if (t.k > 1.8) {
          a.add.aRt = 0;
          a.still();
          a.setPose('stand', 6);
          me.afterDelivery(this.order);
          w.frameDoor(false);
          // (if Lorelei is round, she has something to say about it)
          if (w.guest.on && !w.guest.going) w.guest.waveTo(me.pos, 'food', 1.2);
          return true;
        }
        return false;
      default:
        return true;
    }
  }
}
