// 나 — the girl who lives in the house (me.js makes her, as she has made herself). She is
// always there: asleep in bed when it is night outside, up with the morning, and through the
// day she does as one does at home — looks out of the window, sits on the sofa, writes at the
// desk in the evening, puts on a record and dances to it, goes to the mailbox when a letter has
// come and to the door when there is a present, says hello to Lorelei when she comes round.
// Tapped, she turns and waves (asleep, she stirs). Dressed anew, she gives a twirl. While she is
// being dressed she stands where she can be seen, and waits.
import { buildMe } from './me.js';
import { Person } from './person.js';
import { V } from './shapes.js';

const SLEEP_FROM = 23.5; // she goes to bed at half past eleven…
const WAKE_AT = 7; //       …and is up at seven

/** The hour now, with its minutes (13.5 = half past one). */
const hourNow = () => {
  const d = new Date();
  return d.getHours() + d.getMinutes() / 60;
};

export class Resident extends Person {
  constructor(world) {
    super(world, 'me');
    this.lookKey = '';
    this.showcase = false; // she is being dressed: she stands still and looks at whoever is dressing her
    this.seen = {}; //       what she has already gone to see: the letter, the present
    this.metGuest = false; // …and whether she has said hello to Lorelei this visit
  }

  /** Dress her as `look` says (she is built again only when it changes). → true if she was dressed anew. */
  setLook(look) {
    const key = JSON.stringify(look);
    if (key === this.lookKey) return false;
    const first = !this.lookKey;
    this.lookKey = key;
    this.setRig(buildMe(look));
    return !first;
  }

  asleepNow() {
    const h = hourNow();
    return h >= SLEEP_FROM || h < WAKE_AT;
  }

  /** Seconds until she wakes up. */
  untilWake() {
    const h = hourNow();
    const left = h < WAKE_AT ? WAKE_AT - h : 24 - h + WAKE_AT;
    return left * 3600;
  }

  /** She is there when the house is shown: in bed asleep, in the night (if there is a bed) — otherwise somewhere in the room, up and about. */
  enter() {
    if (!this.rig) return;
    this.on = true;
    this.rig.group.visible = true;
    this.tasks = [];
    this.task = null;
    this.seat = null;
    this.abed = null;
    this.metGuest = false;
    this.pending = null;
    const a = this.anim;
    a.pitch = 0;
    a.air = 0;
    a.mood.eyes = 'open';
    a.look = null;
    a.lookW = 0;
    a.still();
    a.setPose('stand', 30);
    const bed = this.asleepNow() && this.world.bed();
    if (bed) this.tasks.push({ do: 'lie', bed, now: true, until: this.world.time + this.untilWake() });
    else {
      a.pos.copy(this.world.randomFree() || V());
      const c = this.world.camera.position;
      a.yaw = Math.atan2(c.x - a.pos.x, c.z - a.pos.z);
      this.tasks.push({ do: 'wait', t: 1.2 }, { do: 'pose', pose: 'stretch', t: 1.8, line: hourNow() < 11 ? 'morning' : 'hello' });
    }
    a.snap();
  }

  /** She is being dressed (or no longer): she comes forward and stands facing the camera. */
  setShowcase(on) {
    if (this.showcase === on) return;
    this.showcase = on;
    if (!this.on) return;
    if (on) {
      // (whatever she was doing: up from her seat, out of bed — then forward)
      const up = this.seat || this.abed ? [{ do: 'stand' }] : [];
      this.tasks = [...up, { do: 'walk', to: this.world.showSpot() }, { do: 'face' }];
      if (!this.seat && !this.abed) this.task = null;
      else if (this.task && (this.task.do === 'lie' || this.task.do === 'sit')) {
        this.task.wake = true;
        this.task.t = 0;
      }
      this.anim.look = null;
      this.anim.lookW = 0;
    } else this.tasks = [];
  }

  /** Dressed anew: a twirl, and a word about it. */
  twirl() {
    if (!this.on || this.seat || this.abed) return;
    this.tasks.unshift({ do: 'twirl' });
    if (this.task && this.task.do !== 'twirl') {
      this.task.path = null;
      this.task.age = 0;
      this.tasks.splice(1, 0, this.task);
      this.task = null;
    }
  }

  /** Lorelei is in — past the door, and has said hello to whoever is looking on — and the girl has not been to say hello to her yet. */
  guestToMeet() {
    const g = this.world.guest;
    if (!g.on || g.going || this.metGuest) return false;
    const t = g.task;
    return !!t && !['wait', 'door', 'greet'].includes(t.do) && !(t.do === 'walk' && t.direct);
  }

  update(dt) {
    this.noticeGuest();
    const t = this.task;
    if (t && t.follow && t.follow.on) t.follow.headPoint(t.at); // (looking at Lorelei: wherever she has got to)
    super.update(dt);
  }

  /** Lorelei has come in: whatever she was doing (unless she is asleep, or being dressed), she leaves it to go and say hello. */
  noticeGuest() {
    if (!this.on || this.showcase || this.abed || !this.guestToMeet()) return;
    const t = this.task;
    if (t && ['wave', 'greet', 'twirl', 'lie', 'stand'].includes(t.do)) return; // (that first)
    this.tasks = [];
    if (!t) return; // (what she does next is up to plan(): that is going over to her)
    if (t.do === 'sit' && this.seat) {
      t.t = 0; // (sitting down or sat: up again first)
      return;
    }
    const a = this.anim;
    a.look = null;
    a.lookW = 0;
    a.setPose('stand', 6);
    this.task = null;
  }

  /** (she waved: at Lorelei, who turns to her and waves back once she has had her say) */
  waved(line) {
    if (line !== 'guest' || this.world.guest.going) return;
    const b = this.world.bubbles.me;
    this.world.guest.waveTo(this.pos, 'meet', Math.max(0.6, b.until - this.world.time + 0.2));
  }

  own(t, dt) {
    if (t.do !== 'twirl') return undefined;
    const a = this.anim;
    if (!t.from) {
      t.from = a.yaw;
      a.setPose('cheer', 6);
      if (this.world.fx) for (let i = 0; i < 5; i++) this.world.fx.emit('✨', a.pos.clone().add(V((Math.random() - 0.5) * 0.5, 0.3 + Math.random() * 0.9, (Math.random() - 0.5) * 0.3)), { size: 0.1, rise: 0.3, life: 1.2 });
    }
    const k = Math.min(1, t.age / 0.8);
    a.yaw = t.from + k * k * (3 - 2 * k) * Math.PI * 2;
    a.mood.smile = 1;
    if (t.age > 0.8 && !t.said) {
      t.said = true;
      this.say('dressed');
    }
    if (t.age > 1.7) {
      a.setPose('stand', 5);
      a.mood.smile = 0;
      return true;
    }
    return false;
  }

  /* ----- her day ----- */

  plan() {
    const w = this.world;
    if (this.showcase) {
      this.tasks.push({ do: 'face' }, { do: 'wait', t: 1.5 });
      return;
    }
    // the night: to bed
    if (this.asleepNow()) {
      const bed = w.bed();
      if (bed) return void this.tasks.push({ do: 'lie', bed, until: w.time + this.untilWake() });
    }
    // what has happened: a letter, a present — Lorelei at the door
    const ev = w.events();
    if (ev.mail && this.seen.mail !== ev.mail) {
      this.seen.mail = ev.mail;
      const s = w.spotOf('mailbox');
      if (s) return void this.tasks.push({ do: 'walk', to: s.at }, { do: 'look', at: s.face, t: 3.2, line: 'mail', pose: 'look' });
    }
    if (ev.gift && this.seen.gift !== ev.gift) {
      this.seen.gift = ev.gift;
      const s = w.parcelSpot();
      if (s) return void this.tasks.push({ do: 'walk', to: s.at }, { do: 'look', at: s.face, t: 3.2, line: 'gift', pose: 'bend' });
    }
    const guest = w.guest;
    if (this.guestToMeet()) {
      this.metGuest = true;
      const near = w.near(guest.pos, 0.55) || guest.pos.clone();
      return void this.tasks.push(
        { do: 'walk', to: near },
        { do: 'wave', at: guest.pos, line: 'guest' },
        { do: 'look', at: guest.headPoint(V()), follow: guest, t: 5, pose: 'stand' } // (…and stays to hear what she says back)
      );
    }
    if (!guest.on) this.metGuest = false;
    // and the rest: what there is to do at home, by the time of day
    const h = hourNow();
    const music = w.musicOn();
    const by = {
      morning: { kitchen: 3, fridge: 2, window: 2.2, plant: 1.5 },
      day: { books: 1.6, plant: 1.4, mic: 1.5, window: 1.3, bear: 1.2 },
      evening: { desk: 3, sit: 1.5, bed: 1.6, frame: 1.4, books: 1.3 },
    }[h < 11 ? 'morning' : h < 20 ? 'day' : 'evening'];
    const choices = w
      .spots()
      .filter((s) => s.uid !== this.last && !(s.seat && w.taken(s.seat, this)))
      .map((s) => ({ ...s, weight: (s.weight || 1) * (by[s.line] || by[s.kind] || 1) * (music && s.kind === 'record' ? 4 : 1) }));
    if (music && Math.random() < 0.5) choices.push({ kind: 'dance', weight: 3 });
    choices.push({ kind: 'wander', weight: 0.6 }, { kind: 'stretch', weight: 0.35 });
    const c = this.choose(choices);
    if (c.kind === 'dance') {
      this.last = 'dance';
      this.tasks.push({ do: 'face' }, { do: 'say', line: 'music' }, { do: 'dance', t: 10 + Math.random() * 10 });
      return;
    }
    if (c.kind === 'wander') {
      this.last = 'wander';
      const p = w.randomFree();
      if (p) this.tasks.push({ do: 'walk', to: p }, { do: 'wait', t: 1.5 + Math.random() * 3 });
      else this.tasks.push({ do: 'wait', t: 2 });
      return;
    }
    if (c.kind === 'stretch') {
      this.last = 'stretch';
      this.tasks.push({ do: 'pose', pose: 'stretch', t: 2, line: 'stretch' });
      return;
    }
    this.goTo(c);
  }
}
