// Cooking, in the little kitchen (furniture.js: the kitchen; meals.js: what is cooked and what with). She goes to the
// hob, puts on her apron, and the pot or the pan goes on the ring, which glows; then she does each step of the recipe
// as the app's little game has her do it (js/town.js): something goes in — out of her hand into the pot — she stirs, she
// beats the eggs in a bowl and pours them in, she rolls them up, she flips the toast; the steam rises, it sizzles, and
// if it is left too long it smokes. At the end she turns the ring off, it comes out of the pan onto a plate, the apron
// comes off, and she carries it to where she eats (resident.js: mealSpot) and eats it.
import * as THREE from '../vendor/three.module.min.js';
import { disposeTree } from '../fox/kit.js';
import { V } from './shapes.js';
import { makeFood } from './food.js';
import { makeCookware, makeIngredient, makeMixBowl, makeTurner } from './meals.js';

const UP = V(0, 1, 0);
const APRON = '#ffb3c9';
const _a = V();
const _b = V();
const _c = V();

export class Cooking {
  /** `me`: the girl (resident.js); `recipe`: { id, tool: 'pot' | 'pan', steps: [{ act, item, kind }] } (js/town.js). */
  constructor(me, recipe) {
    this.me = me;
    this.world = me.world;
    this.recipe = recipe;
    this.phase = 'go';
    this.heat = 0;
    this.done = 0;
    this.acts = []; //   what the app has asked her to do, still to be done: { act, item, n }
    this.doing = null; // …and what she is doing now: { act, item, t }
    this.cookware = null;
    this.turner = null;
    this.bowl = null;
    this.sizzleAt = 0;
  }

  /** The kitchen, and where on it things are (in the world): the hob's free ring, where she stands, the knob. */
  kitchen() {
    for (const e of this.world.items.values()) {
      if (e.id !== 'kitchen' || !e.place) continue;
      const o = e.it.object;
      o.updateMatrixWorld(true);
      const at = (x, y, z) => V(x, y, z).applyMatrix4(o.matrixWorld);
      return { entry: e, hob: at(0.5, 0.613, 0.04), stand: at(0.86, 0, 0.42), knob: at(0.66, 0.48, 0.24), yaw: (e.place.r || 0) * (Math.PI / 2) };
    }
    return null;
  }

  /** To the hob. */
  begin() {
    const k = (this.k = this.kitchen());
    const me = this.me;
    if (!k) return false;
    const stand = k.stand.clone();
    stand.y = 0;
    me.tasks = [{ do: 'walk', to: stand }, { do: 'face', at: k.hob.clone().setY(1) }, { do: 'cook' }];
    const t = me.task;
    if (me.abed && t && t.do === 'lie') t.wake = true;
    else if (me.seat && t && t.do === 'sit') t.t = 0;
    else {
      me.task = null;
      me.anim.look = null;
      me.anim.lookW = 0;
      me.anim.still();
      me.anim.setPose('stand', 6);
    }
    return true;
  }

  /* The ring under the pot, glowing as hot as it is. */
  ring() {
    if (this.glow) return this.glow;
    const m = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.012, 6, 24), new THREE.MeshBasicMaterial({ color: '#ff6a2a', transparent: true, opacity: 0 }));
    m.rotation.x = Math.PI / 2;
    m.position.copy(this.k.hob).add(V(0, 0.004, 0));
    this.world.scene.add(m);
    this.glow = m;
    return m;
  }

  /** (the app's game: something to do — the act of the step `step`; `final`: the step is done with it — and how hot, how done it is) */
  act(act, item, n, step, final) {
    this.acts.push({ act, item, n, step, final });
  }

  level(heat, done) {
    this.heat = heat;
    this.done = done;
  }

  /** The end of it: { burnt, stars }. */
  end(result) {
    this.result = result;
  }

  /** Every frame while she cooks (resident.js: the 'cook' task). → true once it is plated and she is off to eat it. */
  update(dt) {
    const me = this.me;
    const a = me.anim;
    const w = this.world;
    if (!this.k) this.k = this.kitchen();
    if (!this.k) return true;
    this.t = (this.t || 0) + dt;
    if (this.phase === 'go') {
      // the apron on, the pan on the ring, the spatula in her hand
      this.phase = 'apron';
      this.t = 0;
      me.wearApron(APRON);
      if (w.fx) for (let i = 0; i < 5; i++) w.fx.emit('✨', me.pos.clone().add(V((Math.random() - 0.5) * 0.4, 0.3 + Math.random() * 0.8, (Math.random() - 0.5) * 0.3)), { size: 0.09, rise: 0.3, life: 1.1 });
      me.say('cook_start');
      return false;
    }
    if (this.phase === 'apron') {
      if (this.t < 0.7) return false;
      const cw = (this.cookware = makeCookware(this.recipe.id));
      cw.object.position.copy(this.k.hob);
      cw.object.rotation.y = this.k.yaw - 0.35; // (the pan's handle out towards her, on its right)
      cw.stage(-1);
      w.scene.add(cw.object);
      this.ring();
      this.holdTurner();
      this.phase = 'ready';
      this.t = 0;
      w.frameAt(this.k.hob, 0.3, { yaw: this.k.yaw - 0.6, pitch: 1.0 }); // (from in front of the kitchen, a little to its left: into the pan)
      w.host.onCook('ready');
      return false;
    }
    const cw = this.cookware;
    cw.heat(this.heat);
    cw.done(this.done);
    cw.update(dt, w.time);
    this.glow.material.opacity = Math.min(0.9, this.heat * 0.9) * (this.phase === 'off' ? Math.max(0, 1 - this.t * 2) : 1);
    // the sound of it: a sizzle in the pan, bubbles in the pot
    if (this.heat > 0.3 && this.phase === 'ready' && w.time - this.sizzleAt > (this.recipe.tool === 'pan' ? 0.75 : 1.1)) {
      this.sizzleAt = w.time;
      w.sound(this.recipe.tool === 'pan' ? 'sizzle' : 'bubble');
    }
    // steam over the pot; smoke when it burns
    if (w.fx && this.heat > 0.4 && Math.random() < dt * (this.recipe.tool === 'pot' ? 3 : 1.2)) w.fx.puff(cw.over.getWorldPosition(_a).add(V((Math.random() - 0.5) * 0.08, -0.06, 0)));
    if (w.fx && this.done > 1.08 && Math.random() < dt * 5) w.fx.puff(cw.over.getWorldPosition(_a).add(V(0, -0.05, 0)), { color: '#4a4048', size: 0.08, opacity: 0.55 });
    me.frame();
    // her left hand on the pan's handle (a pot: at her side)
    if (this.recipe.tool === 'pan' && cw.handle && !this.bowl) a.hands.L = cw.handle.getWorldPosition(me.reachL).add(V(0, 0.02, 0));
    else if (!this.bowl) a.hands.L = null;
    if (this.phase === 'ready') {
      if (!this.doing && this.acts.length) this.startAct(this.acts.shift());
      if (this.doing) this.doAct(dt);
      else this.idle(dt);
      if (this.result && !this.doing && !this.acts.length) {
        this.phase = 'off';
        this.t = 0;
      }
      return false;
    }
    if (this.phase === 'off') {
      // the knob, the heat off — and what she thinks of it
      a.hands.R = this.k.knob;
      if (!this.said) {
        this.said = true;
        me.say(this.result.burnt ? 'cook_burnt' : 'cook_done');
        if (this.result.burnt && w.fx) for (let i = 0; i < 5; i++) w.fx.puff(cw.over.getWorldPosition(V()).add(V((Math.random() - 0.5) * 0.15, 0, 0)), { color: '#4a4048', size: 0.1, opacity: 0.6, life: 1.8 });
        if (!this.result.burnt && w.fx) w.fx.emit('✨', cw.over.getWorldPosition(V()), { size: 0.1, rise: 0.3, life: 1.2 });
      }
      if (this.t > 1.2) this.plate();
      return this.phase === 'gone';
    }
    return true;
  }

  /* The spatula (or the cooking chopsticks) in her right hand. */
  holdTurner() {
    this.turner = makeTurner(this.recipe.tool === 'pan' ? 'spatula' : 'chopsticks');
    this.me.hold('R', this.turner.object);
  }

  /* Waiting for the next step: the spatula over the pan, moving a little. */
  idle() {
    const me = this.me;
    const over = this.cookware.over.getWorldPosition(_a);
    const k = Math.sin(this.world.time * 2.2);
    me.anim.hands.R = me.reachR.copy(over).add(V(0.05 * k, -0.02, 0.02));
    me.anim.look = this.cookware.object.getWorldPosition(_b).add(V(0, 0.05, 0));
    me.anim.lookW = 1;
  }

  startAct(o) {
    const me = this.me;
    this.doing = { ...o, t: 0 };
    const cw = this.cookware;
    if (o.act === 'add') {
      // the turner down, the thing in her hand
      const held = me.drop('R');
      if (held) disposeTree(held.object);
      this.item = makeIngredient(o.item === 'egg' ? 'egg' : o.item);
      me.hold('R', this.item.object);
    } else if (o.act === 'beat' || o.act === 'pour') {
      if (!this.bowl) {
        this.bowl = makeMixBowl(o.item === 'egg' ? 'egg' : 'batter');
        me.hold('L', this.bowl.object);
      }
    } else if (o.act === 'flip') cw.flip();
    else if (o.act === 'stir' || o.act === 'roll') cw.stir();
  }

  doAct(dt) {
    const me = this.me;
    const a = me.anim;
    const d = this.doing;
    const cw = this.cookware;
    const w = this.world;
    d.t += dt;
    const over = cw.over.getWorldPosition(_a);
    a.look = cw.object.getWorldPosition(_b).add(V(0, 0.05, 0));
    a.lookW = 1;
    if (d.act === 'add') {
      // over the pot, and in it goes
      a.hands.R = me.reachR.copy(over).add(V(0, 0.04, 0));
      if (d.t > 0.45 && this.item) {
        const held = me.drop('R');
        if (held) {
          const o = held.object;
          o.getWorldPosition(_c);
          w.scene.add(o);
          o.position.copy(_c);
          o.scale.setScalar(me.rig.size);
          this.falling = { o, y0: _c.y, t: 0 };
        }
        this.item = null;
        this.landed = false;
      }
      if (this.falling) {
        const f = this.falling;
        f.t += dt;
        f.o.position.y = f.y0 - 4 * f.t * f.t;
        if (f.o.position.y < this.k.hob.y + 0.03) {
          w.scene.remove(f.o);
          disposeTree(f.o);
          this.falling = null;
          cw.stage(d.step);
          w.sound(this.recipe.tool === 'pan' ? 'sizzle' : 'pour');
          this.holdTurner();
        }
      }
      if (d.t > 1.0 && !this.falling && !this.item) this.doing = null;
      return;
    }
    if (d.act === 'stir' || d.act === 'roll') {
      // round and round, and (rolling) pushed along
      const k = d.t * 14;
      a.hands.R = me.reachR.copy(over).add(V(Math.cos(k) * 0.05, -0.03, Math.sin(k) * 0.04));
      if (d.t > 0.35) {
        this.doing = null;
        if (d.final) cw.stage(d.step);
      }
      return;
    }
    if (d.act === 'beat') {
      // the bowl before her chest; the chopsticks whisking round it
      const S = me.rig.size;
      const rest = me.rig.bones.chest.getWorldPosition(_c).addScaledVector(V(Math.sin(a.yaw), 0, Math.cos(a.yaw)), 0.17 * S).addScaledVector(UP, -0.08 * S);
      a.hands.L = me.reachL.copy(rest);
      const k = d.t * 22;
      a.hands.R = me.reachR.copy(rest).add(V(Math.cos(k) * 0.03 * S, 0.06 * S, Math.sin(k) * 0.03 * S));
      if (this.bowl) this.bowl.mix(w.time);
      if (d.t > 0.3) {
        this.doing = null;
        if (d.final) cw.stage(d.step);
      }
      return;
    }
    if (d.act === 'pour') {
      // the bowl over the pan, tipped — and it is in
      if (this.bowl) a.hands.L = me.reachL.copy(over).add(V(0, 0.02, 0));
      if (d.t > 0.7 && this.bowl) {
        const held = me.drop('L');
        if (held) disposeTree(held.object);
        this.bowl = null;
        cw.stage(d.step);
        w.sound('sizzle');
      }
      if (d.t > 1.0) this.doing = null;
      return;
    }
    if (d.act === 'flip') {
      // a flick of the spatula, up and over
      a.hands.R = me.reachR.copy(over).add(V(0, 0.04 + Math.sin(Math.min(1, d.t / 0.4) * Math.PI) * 0.1, 0));
      if (d.t > 0.9) {
        this.doing = null;
        cw.stage(d.step);
      }
      return;
    }
    if (d.act === 'done') {
      a.hands.R = me.reachR.copy(this.k.knob);
      if (d.t > 0.5) {
        this.doing = null;
        cw.stage(d.step);
      }
      return;
    }
    this.doing = null;
  }

  /** Done: off the hob onto a plate — the apron off — and to where she eats it. */
  plate() {
    const me = this.me;
    const w = this.world;
    const cw = this.cookware;
    w.scene.remove(cw.object);
    disposeTree(cw.object);
    if (this.glow) {
      w.scene.remove(this.glow);
      this.glow.geometry.dispose();
      this.glow.material.dispose();
      this.glow = null;
    }
    me.dropAll();
    me.anim.look = null;
    me.anim.lookW = 0;
    const dish = makeFood(this.recipe.id, { burnt: !!this.result.burnt });
    if (dish) me.hold('R', dish.object);
    me.anim.setPose('carry', 5);
    me.wearApron(null);
    this.phase = 'gone';
    me.cooking = null;
    w.frameAt(null);
    // to a seat that faces whoever looks on (as with what the courier brings), and eat it
    const spot = me.mealSpot();
    const meal = { meal: this.recipe.id, burnt: !!this.result.burnt, source: 'cook' };
    me.tasks = spot.seat
      ? [{ do: 'sit', seat: spot.seat, t: 600, line: null, ...meal }]
      : spot.kneel
        ? [{ do: 'walk', to: spot.kneel.at }, { do: 'face', at: spot.kneel.face }, { do: 'eat', kneel: true, ...meal }]
        : [...(spot.stand ? [{ do: 'walk', to: spot.stand }] : []), { do: 'face' }, { do: 'eat', ...meal }];
  }

  /** The house was closed, or she was taken from it: everything off the hob, the apron off. */
  abandon() {
    const w = this.world;
    if (this.cookware) {
      w.scene.remove(this.cookware.object);
      disposeTree(this.cookware.object);
      this.cookware = null;
    }
    if (this.glow) {
      w.scene.remove(this.glow);
      this.glow = null;
    }
    if (this.falling) {
      w.scene.remove(this.falling.o);
      this.falling = null;
    }
    this.me.dropAll();
    if (this.me.apron) this.me.wearApron(null);
    this.me.cooking = null;
    w.frameAt(null);
  }
}
