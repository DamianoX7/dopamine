// 나 — the girl who lives in the house (me.js makes her, as she has made herself). She is
// always there: asleep in bed when it is night outside, up with the morning, and through the
// day she does as one does at home — looks out of the window, sits on the sofa, writes at the
// desk in the evening, puts on a record and dances to it, goes to the mailbox when a letter has
// come and to the door when there is a present, says hello to Lorelei when she comes round.
// Tapped, she turns and waves (asleep, she stirs). Dressed anew, she gives a twirl. While she is
// being dressed she stands where she can be seen, and waits.
//
// And she orders food (js/delivery.js): out comes her phone; when the courier knocks (courier.js)
// she goes to the door — out of bed if need be — takes it from him, and sits down to eat it, a
// mouthful at a time: the straw to her lips, the chopsticks from the bowl to her mouth.
//
// And she goes out (town.js): to the door and out of it, into the street round the corner — where the street tells her
// what to do (its planFor, its ownTask) — and home again with what she bought, which she puts away in the fridge.
import { buildMe } from './me.js';
import { Person, damp } from './person.js';
import { makeFood, makeUtensil, makePhone } from './food.js';
import { Cooking } from './kitchen.js';
import { disposeTree } from '../fox/kit.js';
import { V } from './shapes.js';
import { makeChuru } from './cat.js';

const SLEEP_FROM = 23.5; // she goes to bed at half past eleven…
const WAKE_AT = 7; //       …and is up at seven
const UP = V(0, 1, 0);
const _c = V();
const _f = V();
const _l = V();
const _p = V();
const _q = V();
const _w = V();
const _e = V();
const _r = V();

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
    this.phone = null; //    ordering something: { t, object }
    this.door = null; //     the courier she is answering the door to
    this.atDoor = false; //  …and she is there, the door open
    this.hint = -99; //      when she last said she was hungry, or that it was taking long
    this.reachR = V(); //    where her hands go (eating, ordering)
    this.reachL = V();
    this.apron = null; //    (cooking: an apron over her clothes — its colour)
    this.cooking = null; //  …and how it is going (kitchen.js)
    this.baseLook = null;
    this.apronOn = '';
  }

  /** Dress her as `look` says (she is built again only when it changes — or her apron goes on or off). → true if she was dressed anew. */
  setLook(look) {
    this.baseLook = look;
    const key = JSON.stringify(look);
    const changed = key !== this.lookKey;
    if (!changed && (this.apron || '') === this.apronOn) return false;
    const first = !this.lookKey;
    this.lookKey = key;
    this.apronOn = this.apron || '';
    this.setRig(buildMe(this.apron ? { ...look, apron: this.apron } : look));
    return changed && !first;
  }

  /** An apron on (`color`) — or off again (null). */
  wearApron(color) {
    this.apron = color || null;
    if (this.baseLook) this.setLook(this.baseLook);
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
    this.dropAll();
    this.phone = null;
    this.door = null;
    this.atDoor = false;
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

  /** She cooks `recipe` (js/town.js): to the kitchen, her apron on, the pan on the hob… (kitchen.js). → false if there is no kitchen. */
  cook(recipe) {
    if (this.cooking) this.cooking.abandon();
    this.endPhone();
    const c = new Cooking(this, recipe);
    if (!c.begin()) return false;
    this.cooking = c;
    return true;
  }

  /** Something out of the fridge, to eat as it is (`id`: snacks.js): to the fridge for it — a cup of noodles to the kettle — then where she eats. */
  eatSnack(id) {
    this.endPhone();
    const w = this.world;
    const fridge = w.spotOf('fridge') || w.spotOf('kitchen');
    const kettle = id === 'cupramen' && w.spotOf('kitchen');
    const spot = this.mealSpot();
    const meal = { meal: id, source: 'snack' };
    const eat = spot.seat
      ? [{ do: 'sit', seat: spot.seat, t: 600, line: null, ...meal }]
      : spot.kneel
        ? [{ do: 'walk', to: spot.kneel.at }, { do: 'face', at: spot.kneel.face }, { do: 'eat', kneel: true, ...meal }]
        : [...(spot.stand ? [{ do: 'walk', to: spot.stand }] : []), { do: 'face' }, { do: 'eat', ...meal }];
    this.tasks = [
      { do: 'say', line: 'fridge' },
      ...(fridge ? [{ do: 'walk', to: fridge.at }, { do: 'look', at: fridge.face, t: 1.4, line: null, pose: 'bend' }] : []),
      ...(kettle ? [{ do: 'walk', to: kettle.at }, { do: 'face', at: kettle.face }, { do: 'pose', pose: 'pour', t: 1.6 }] : []),
      ...eat,
    ];
    const t = this.task;
    if (this.abed && t && t.do === 'lie') t.wake = true;
    else if (this.seat && t && t.do === 'sit') t.t = 0;
    else {
      this.task = null;
      this.anim.look = null;
      this.anim.lookW = 0;
      this.anim.still();
      this.anim.setPose('stand', 6);
    }
  }

  /** She goes out (world.js goOut): up from what she was doing, to the door, and out of it — and the street is shown. */
  leaveHouse() {
    const door = this.world.room.doorway();
    this.endPhone();
    this.tasks = [{ do: 'say', line: 'go_out' }, { do: 'walk', to: door.inside.clone() }, { do: 'face', at: door.outside.clone() }, { do: 'door', open: true }, { do: 'walk', to: door.outside.clone().add(V(0.35, 0, 0)), direct: true }, { do: 'out' }, { do: 'wait', t: 5 }];
    const t = this.task;
    if (this.abed && t && t.do === 'lie') t.wake = true;
    else if (this.seat && t && t.do === 'sit') t.t = 0;
    else {
      this.task = null;
      const a = this.anim;
      a.look = null;
      a.lookW = 0;
      a.still();
      a.setPose('stand', 6);
    }
  }

  /** …and back in at the door (the street has her no more): what she bought goes into the fridge (or by the kitchen). */
  comeIn() {
    const door = this.world.room.doorway();
    const a = this.anim;
    this.on = true;
    this.rig.group.visible = true;
    this.seat = this.abed = null;
    a.pos.copy(door.outside).add(V(0.35, 0, 0));
    a.yaw = -Math.PI / 2;
    a.pitch = 0;
    a.air = 0;
    a.look = null;
    a.lookW = 0;
    a.still();
    a.setPose('stand', 30);
    a.snap();
    const bag = this.props.L && this.props.L.object.userData.shopBag;
    const spot = bag && (this.world.spotOf('fridge') || this.world.spotOf('kitchen'));
    this.tasks = [{ do: 'door', open: true }, { do: 'wait', t: 0.3 }, { do: 'walk', to: door.inside.clone(), direct: true }, { do: 'door', open: false }, { do: 'say', line: 'home' }];
    if (bag) this.tasks.push(...(spot ? [{ do: 'walk', to: spot.at }, { do: 'look', at: spot.face, t: 2.2, line: 'put_away', pose: 'bend' }] : []), { do: 'unbag' });
    this.task = null;
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
    if (this.phone) this.usePhone(dt);
    if (t && t.meal && ((t.do === 'sit' && t.phase === 'sat') || t.do === 'eat') && this.eat(t, dt)) {
      t.meal = null;
      if (t.do === 'sit') t.t = 0; // (and up again)
    }
    super.update(dt);
  }

  /**
   * Down by 뭉치 (house world catPet, or the stray on the street), her hand over its head and down its back, again and
   * again — standing, if it is up on something. When she is done, so is it (its 'petted').
   */
  petCat(t, dt) {
    const a = this.anim;
    const cat = t.cat;
    if (!cat || !cat.on) return true;
    if (!t.posed) {
      t.posed = true;
      a.setPose(cat.perch > 0.2 ? 'bend' : 'pet', 5);
      if (t.line !== null) this.say(t.line || 'cat_pet');
      if (this.world.frameCat) this.world.frameCat(cat); // (at home, the camera comes down to the two of them)
    }
    const head = cat.headPoint(_p);
    const yaw = cat.anim.yaw;
    const back = 0.5 - 0.5 * Math.cos(t.age * 4.2);
    a.reach = { side: 'R', point: _q.set(head.x - Math.sin(yaw) * 0.07 * back, head.y + 0.012 - 0.012 * back, head.z - Math.cos(yaw) * 0.07 * back) };
    a.mood.smile = 1;
    if (t.age < t.t) return false;
    a.reach = null;
    a.setPose('stand', 5);
    if (cat.task && cat.task.do === 'petted') cat.task.t = 0;
    if (t.done) t.done();
    return true;
  }

  /** Down by it, a churu (a stick of cat treat) held out to it — it comes and licks it up; she holds it for it. */
  feedCat(t, dt) {
    const a = this.anim;
    const cat = t.cat;
    if (!cat || !cat.on) return true;
    if (!t.posed) {
      t.posed = true;
      a.setPose(cat.perch > 0.2 ? 'bend' : 'pet', 5);
      this.hold('R', makeChuru());
      this.say('cat_feed');
      if (this.world.frameCat) this.world.frameCat(cat);
      // where her hand will be: before her, low — and it comes to it
      const f = V(Math.sin(a.yaw), 0, Math.cos(a.yaw));
      t.hand = V(a.pos.x + f.x * 0.36, cat.perch + 0.16, a.pos.z + f.z * 0.36);
      const stand = V(a.pos.x + f.x * 0.52, 0, a.pos.z + f.z * 0.52);
      if (cat.perch > 0.2) cat.do([{ do: 'face', at: a.pos.clone() }, { do: 'eat', t: t.t - 0.6 }]);
      else cat.do([{ do: 'walk', to: stand, direct: true, stop: 0.03 }, { do: 'face', at: a.pos.clone() }, { do: 'eat', t: t.t - 1.4 }]);
    }
    a.reach = { side: 'R', point: _q.copy(t.hand).add(_r.set(0, Math.sin(t.age * 3) * 0.006, 0)) };
    a.mood.smile = 1;
    if (t.age < t.t) return false;
    a.reach = null;
    const held = this.drop('R');
    if (held) disposeTree(held.object);
    a.setPose('stand', 5);
    if (t.done) t.done();
    return true;
  }

  /** Is she busy with something to eat — the courier at the door, or eating it? */
  busyEating() {
    return !!(this.door || this.cooking || (this.task && this.task.meal) || this.tasks.some((x) => x.meal));
  }

  /** Lorelei has come in: whatever she was doing (unless she is asleep, or being dressed), she leaves it to go and say hello. */
  noticeGuest() {
    if (!this.on || this.showcase || this.abed || this.busyEating() || !this.guestToMeet()) return;
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

  tapped() {
    if (!this.on || this.atDoor) return;
    const t = this.task;
    if (t && t.meal && t.food) {
      // (eating: she only says something, her hands full)
      if (this.world.time - this.lastSay > 2.5) this.say('tap_eat');
      return;
    }
    super.tapped();
  }

  /* ----- something to eat ----- */

  /** She has ordered (`order`: { id, name }): out comes her phone — out of bed first, if she was asleep. */
  ordered(order) {
    if (!this.on) return;
    this.phone = { t: 0, order, object: null };
    const t = this.task;
    if (this.abed && t && t.do === 'lie') t.wake = true;
  }

  usePhone(dt) {
    const p = this.phone;
    const a = this.anim;
    if (!this.on || !this.rig) return this.endPhone();
    if (this.abed) return; // (once she is up)
    if (!p.object) {
      p.object = makePhone().object;
      this.hold('R', p.object);
    }
    p.t += dt;
    // her phone up before her, below her face; she looks at it, and taps it
    this.frame();
    const tap = p.t > 0.6 && p.t < 1.8 ? Math.abs(Math.sin(p.t * 16)) * 0.008 : 0;
    a.hands.R = this.reachR.copy(_c).addScaledVector(_f, 0.19 * this.S).addScaledVector(UP, (0.07 + tap) * this.S).addScaledVector(_l, -0.02 * this.S);
    a.look = p.object.getWorldPosition(_w);
    a.lookW = damp(a.lookW, 1, 6, dt);
    if (p.t > 1.5 && !p.said) {
      p.said = true;
      this.say('order');
    }
    if (p.t > 2.8) this.endPhone();
  }

  endPhone() {
    const p = this.phone;
    this.phone = null;
    if (!p) return;
    const held = this.props.R;
    if (held && p.object && held.object === p.object) {
      this.drop('R');
      disposeTree(p.object);
    }
    if (this.anim) {
      this.anim.hands.R = null;
      this.anim.look = null;
      this.anim.lookW = 0;
    }
  }

  /* (where she is, for her hands: her chest, which way is forward, which way is her left, how big she is) */
  frame() {
    const a = this.anim;
    this.rig.bones.chest.getWorldPosition(_c);
    _f.set(Math.sin(a.yaw), 0, Math.cos(a.yaw));
    _l.set(Math.cos(a.yaw), 0, -Math.sin(a.yaw));
    this.S = this.rig.size;
  }

  /** …her mouth (in the world). */
  mouth(out) {
    return this.rig.bones.head.localToWorld(out.copy(this.rig.dims.eyes).add(_q.set(0, -0.072, 0.03)));
  }

  /** The courier has knocked: whatever she is doing — asleep, sitting, dancing — she goes to the door and opens it. */
  answerDoor(courier) {
    if (!this.on) return;
    const step = courier.doorstep();
    this.endPhone();
    this.door = courier;
    this.atDoor = false;
    const go = [
      { do: 'say', line: 'door' },
      { do: 'walk', to: step.inside },
      { do: 'face', at: step.at },
      { do: 'door', open: true },
      { do: 'until', at: courier.pos, test: () => !courier.on, onStart: () => (this.atDoor = true), max: 120 },
    ];
    const t = this.task;
    const a = this.anim;
    this.tasks = go;
    if (this.abed && t && t.do === 'lie') t.wake = true; // (out of bed first)
    else if (this.seat && t && t.do === 'sit') t.t = 0; // (up first)
    else if (!(t && t.do === 'stand')) {
      this.task = null;
      a.look = null;
      a.lookW = 0;
      a.still();
      a.setPose('stand', 6);
    }
  }

  /** He has gone: she shuts the door, and sits down to eat it where she can be seen eating it. */
  afterDelivery(order) {
    this.atDoor = false;
    this.door = null;
    const spot = this.mealSpot();
    const eat = spot.seat
      ? [{ do: 'sit', seat: spot.seat, t: 600, line: null, meal: order.id }]
      : spot.kneel
        ? [{ do: 'walk', to: spot.kneel.at }, { do: 'face', at: spot.kneel.face }, { do: 'eat', meal: order.id, kneel: true }]
        : [...(spot.stand ? [{ do: 'walk', to: spot.stand }] : []), { do: 'face' }, { do: 'eat', meal: order.id }];
    this.tasks = [{ do: 'door', open: false }, { do: 'wait', t: 0.25 }, ...eat];
    this.task = null;
  }

  /*
   * Where she eats, so that she is seen eating — facing whoever looks on: a seat that faces this way (by the tea table,
   * if she can; not the bed, if she can help it); or else, kneeling on the floor at the tea table, on the side of it away
   * from the camera; or else standing in the open. → { seat } | { kneel: { at, face } } | { stand } | {}.
   */
  mealSpot() {
    const w = this.world;
    const cam = w.camera.position;
    const table = w.spotOf('table');
    const near = table ? table.face : this.pos;
    const toward = (at, yaw) => {
      const dx = cam.x - at.x;
      const dz = cam.z - at.z;
      const d = Math.hypot(dx, dz) || 1;
      return (Math.sin(yaw) * dx + Math.cos(yaw) * dz) / d; // (1: facing the camera)
    };
    const seats = w
      .spots()
      .filter((s) => s.seat && !w.taken(s.seat, this) && toward(s.seat.at, s.seat.yaw) > 0.3)
      .map((s) => ({ seat: s.seat, score: s.seat.at.distanceTo(near) * 0.6 - toward(s.seat.at, s.seat.yaw) + (s.line === 'bed' ? 2.5 : 0) }))
      .sort((p, q) => p.score - q.score);
    if (seats.length && seats[0].score < 2) return { seat: seats[0].seat };
    if (table) {
      // (the far side of the tea table from the camera, facing it)
      const t = [...w.items.values()].find((e) => e.id === 'table' && e.place);
      const c = t ? t.it.object.getWorldPosition(V()) : table.face.clone();
      c.y = 0;
      const away = V(c.x - cam.x, 0, c.z - cam.z).normalize();
      const cell = w.nearestOpen(c.clone().addScaledVector(away, 0.42));
      if (cell) {
        const at = w.centre(...cell);
        if (at.distanceTo(c) < 1.0) return { kneel: { at, face: V(cam.x, 0, cam.z).lerp(c, 0.5) } };
      }
    }
    // (or else in the open, towards the middle of the room — not by the door where she took it)
    const cell = w.nearestOpen(V(0, 0, 0));
    return cell ? { stand: w.centre(...cell) } : {};
  }

  /**
   * Eating it, a mouthful at a time: the bag opened, what was in it in her hands (a bowl in her left and chopsticks in
   * her right), and then each time up to her mouth and down again — the straw to her lips, a bite, the chopsticks from
   * the bowl. → true when it is all gone.
   */
  eat(t, dt) {
    const a = this.anim;
    const w = this.world;
    if (!t.food) {
      const bag = this.drop('R');
      if (bag) disposeTree(bag.object);
      const f = (t.food = makeFood(t.meal, { burnt: !!t.burnt }));
      if (!f) return true;
      if (f.style === 'bowl') {
        this.hold('L', f.object);
        t.ut = makeUtensil(f.utensil, f.morsel);
        this.hold('R', t.ut.object);
      } else this.hold('R', f.object);
      t.n = 0;
      t.ph = f.wait ? 'steep' : 'rest'; // (a cup of noodles stands with its lid on for its three minutes first)
      if (f.wait) f.lid(0);
      t.pk = 0;
      t.wait = 1.3;
      t.aim = 0;
      if (t.kneel) a.setPose('sit', 4); // (down on her knees at the low table)
      else if (!this.seat) a.setPose('stand', 5);
      a.look = null;
      a.lookW = 0;
      if (w.fx) for (let i = 0; i < 4; i++) w.fx.emit('✨', a.pos.clone().add(V((Math.random() - 0.5) * 0.4, 0.5 + Math.random() * 0.5, (Math.random() - 0.5) * 0.3)), { size: 0.09, rise: 0.25, life: 1.1 });
      this.say(t.source && t.source !== 'delivery' ? (t.burnt ? 'eat_burnt' : `eat_${t.meal}`) : 'unpack');
      return false;
    }
    const f = t.food;
    const bowl = f.style === 'bowl';
    this.frame();
    const S = this.S;
    const wrist = this.rig.bones.handR.getWorldPosition(_w);
    // where her hands rest: the bowl before her in her left, her right hand by it (or with what she holds, before her)
    const rest = _p.copy(_c).addScaledVector(_f, 0.17 * S).addScaledVector(UP, (bowl ? -0.05 : -0.07) * S).addScaledVector(_l, (bowl ? -0.035 : -0.04) * S);
    if (bowl) a.hands.L = this.reachL.copy(_c).addScaledVector(_f, 0.17 * S).addScaledVector(UP, -0.12 * S).addScaledVector(_l, 0.035 * S);
    t.pk += dt;
    const target = this.reachR;
    // (the hand goes where it must for the straw, the bite, the chopsticks' tip to be at `to` — her arm reaches with her palm,
    // a little past her wrist: js/fox/lorelei.js, solveArm)
    const palm = _e.copy(wrist).sub(this.rig.bones.foreR.getWorldPosition(_r)).normalize().multiplyScalar(0.04 * S).add(wrist);
    const toward = (mark, to) => target.copy(palm).sub(mark.getWorldPosition(_r)).add(to);
    // (something hot: it steams)
    if ((f.hot || f.wait) && w.fx && Math.random() < dt * (t.ph === 'steep' ? 4 : 1.2)) w.fx.puff((f.bite || f.top).getWorldPosition(V()).add(V(0, 0.05, 0)));
    if (t.ph === 'steep') {
      target.copy(rest);
      if (t.pk > f.wait) {
        t.ph = 'open';
        t.pk = 0;
        this.say('cup_ready');
      }
    } else if (t.ph === 'open') {
      target.copy(rest);
      f.lid(Math.min(1, t.pk / 0.6));
      if (t.pk > 0.8) {
        t.ph = 'rest';
        t.pk = 0;
      }
    } else if (t.ph === 'rest') {
      target.copy(rest);
      if (t.pk > t.wait) {
        t.ph = bowl ? 'dip' : 'up';
        t.pk = 0;
      }
    } else if (t.ph === 'dip') {
      // the chopsticks down into the bowl
      t.aim = damp(t.aim, 0, 10, dt);
      toward(t.ut.tip, f.top.getWorldPosition(V()).addScaledVector(UP, 0.004 * S));
      if (t.pk > 0.55) {
        t.ut.bite.visible = true;
        t.ph = 'up';
        t.pk = 0;
      }
    } else if (t.ph === 'up' || t.ph === 'bite') {
      // up to her mouth: the straw, the top strawberry, the tip of the slice, the mouthful on the chopsticks
      t.aim = damp(t.aim, 1, 8, dt);
      toward(bowl ? t.ut.tip : f.bite, this.mouth(V()));
      if (t.ph === 'up') {
        a.mood.mouth = f.style === 'sip' ? 0.4 : 0.3;
        if (t.pk > 0.6) {
          t.ph = 'bite';
          t.pk = 0;
        }
      } else {
        a.mood.mouth = f.style === 'sip' ? 0.45 : 0.72;
        if (t.pk > (f.style === 'sip' ? 0.9 : 0.35)) {
          t.n++;
          f.left(1 - t.n / f.bites);
          if (bowl) t.ut.bite.visible = false;
          if ((t.n === 1 && (!t.source || t.source === 'delivery')) || (t.n === Math.ceil(f.bites / 2) && Math.random() < 0.8)) this.say(t.burnt ? 'eat_burnt' : `eat_${f.id}`);
          if (w.fx && t.n === 2) w.fx.emit(f.id === 'malatang' || f.id === 'tteokbokki' ? '🔥' : '💗', this.mouth(V()).addScaledVector(UP, 0.06), { size: 0.08, rise: 0.25, life: 1.2 });
          t.ph = 'down';
          t.pk = 0;
        }
      }
    } else if (t.ph === 'down') {
      target.copy(rest);
      t.aim = damp(t.aim, 0, 6, dt);
      if (t.pk > 0.5) {
        if (t.n >= f.bites) {
          // all gone
          this.dropAll();
          a.mood.mouth = 0;
          a.mood.smile = 1;
          t.smile = true;
          this.say('done');
          if (w.fx) w.fx.emit('💗', a.pos.clone().addScaledVector(UP, 1.15), { size: 0.12, rise: 0.3, life: 1.6 });
          w.host.onMeal(t.source || 'delivery', f.id);
          setTimeout(() => (a.mood.smile = 0), 1800);
          if (t.kneel) a.setPose('stand', 4); // (and up again)
          return true;
        }
        t.ph = 'rest';
        t.pk = 0;
        t.wait = 0.7 + Math.random() * 0.8;
      }
    }
    if (t.ut) t.ut.aim(t.aim);
    // chewing, after a bite
    if (t.ph === 'down' || (t.ph === 'rest' && t.pk < 0.9 && t.n > 0)) a.mood.mouth = f.style === 'sip' ? 0 : 0.2 + 0.25 * Math.max(0, Math.sin(t.pk * 15));
    a.hands.R = target;
    return false;
  }

  /** (she waved: at Lorelei, who turns to her and waves back once she has had her say) */
  waved(line) {
    if (line !== 'guest' || this.world.guest.going) return;
    const b = this.world.bubbles.me;
    this.world.guest.waveTo(this.pos, 'meet', Math.max(0.6, b.until - this.world.time + 0.2));
  }

  own(t, dt) {
    if (this.world.ownTask) {
      const r = this.world.ownTask(this, t, dt); // (out in the street: what is done only there)
      if (r !== undefined) return r;
    }
    if (t.do === 'petCat') return this.petCat(t, dt);
    if (t.do === 'feedCat') return this.feedCat(t, dt);
    if (t.do === 'eat') return !t.meal; // (eating standing up: see update)
    if (t.do === 'out') {
      this.world.enterTown();
      return true;
    }
    if (t.do === 'cook') return !this.cooking || this.cooking.update(dt);
    if (t.do === 'unbag') {
      const p = this.drop('L');
      if (p) disposeTree(p.object);
      return true;
    }
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
    if (w.planFor) return w.planFor(this); // (out in the street: town.js)
    if (this.showcase) {
      this.tasks.push({ do: 'face' }, { do: 'wait', t: 1.5 });
      return;
    }
    // the night: to bed (unless she is waiting for something to eat)
    const food = w.foodWaiting();
    if (this.asleepNow() && !food) {
      const bed = w.bed();
      if (bed) return void this.tasks.push({ do: 'lie', bed, until: w.time + this.untilWake() });
    }
    // waiting for it: now and then, she says it is taking long — or, at the hours one is hungry, that she is
    const h0 = hourNow();
    if (w.time - this.hint > (food ? 22 : 100) && Math.random() < (food ? 0.35 : 0.15)) {
      const meal = (h0 >= 11.5 && h0 < 13.5) || (h0 >= 18 && h0 < 20) || h0 >= 22 || h0 < 1;
      if (food || meal) {
        this.hint = w.time;
        this.tasks.push({ do: 'say', line: food ? 'waiting' : h0 >= 22 || h0 < 1 ? 'hungry_night' : 'hungry' });
      }
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
