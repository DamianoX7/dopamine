// Who works on the street (town.js): the girl at the till of the convenience store, in its mint apron, and the woman
// who runs the café, in hers of brown. Built as the girl who lives in the house is (me.js) and moved by the same
// animator; each keeps to her place — behind her counter — and greets whoever comes in, scans what is bought, makes the
// coffee, hands it over, and says what she says (the app has their lines: js/town.js). Tapped, she smiles and says hello.
import { buildMe } from './me.js';
import { Person } from './person.js';
import { V } from './shapes.js';

/* How they look (me.js builds them from it). */
const LOOKS = {
  clerk: {
    skin: '#fde3d6',
    eyes: { color: '#5a4040', shape: 'round' },
    hair: { style: 'pony', bangs: 'full', top: '#4d4249', tip: '#4d4249' },
    top: { kind: 'tee', color: '#ffffff', color2: '#ffffff' },
    bottom: { kind: 'jeans', color: '#56608f' },
    legs: { kind: 'bare' },
    shoes: { kind: 'sneakers', color: '#ffffff' },
    head: { kind: 'none', color: '#36c2a6' },
    apron: '#36c2a6',
  },
  barista: {
    skin: '#f6d2ba',
    eyes: { color: '#4e3c3e', shape: 'soft' },
    hair: { style: 'bun', bangs: 'side', top: '#6b4a3a', tip: '#7a5442' },
    top: { kind: 'blouse', color: '#fffaf0', color2: '#ffffff' },
    bottom: { kind: 'midi', color: '#3a3340' },
    legs: { kind: 'tights', color: '#4c4450' },
    shoes: { kind: 'maryjane', color: '#4c4450' },
    head: { kind: 'none', color: '#7a5038' },
    glasses: { kind: 'round', color: '#6b4a3a' },
    apron: '#8e5b3b',
  },
};

export class Townie extends Person {
  /** `who`: 'clerk' or 'barista'; `post`: where she keeps to ({ at, yaw }). */
  constructor(world, who, post) {
    super(world, who);
    this.post = post;
    this.busy = false; // (doing something for a customer: town.js has her)
  }

  build() {
    if (!this.rig) this.setRig(buildMe(LOOKS[this.who]));
  }

  /** At her post, as the street is shown. */
  place() {
    this.build();
    const a = this.anim;
    a.pos.copy(this.post.at);
    a.yaw = this.post.yaw;
    a.pitch = 0;
    a.air = 0;
    a.still();
    a.setPose('stand', 30);
    a.snap();
    this.rig.group.visible = true;
    this.on = true;
    this.tasks = [];
    this.task = null;
    this.busy = false;
  }

  hide() {
    this.on = false;
    this.tasks = [];
    this.task = null;
    if (this.rig) this.rig.group.visible = false;
  }

  /** Back to her post, facing out. */
  home() {
    this.tasks.push({ do: 'walk', to: this.post.at.clone() }, { do: 'face', at: this.post.at.clone().add(V(Math.sin(this.post.yaw), 0, Math.cos(this.post.yaw))) });
  }

  /* Nothing to do: she stands at her post, looks about now and then, tidies something. */
  plan() {
    const a = this.anim;
    if (a.pos.distanceTo(this.post.at) > 0.08) return this.home();
    const r = Math.random();
    if (r < 0.55) this.tasks.push({ do: 'wait', t: 2 + Math.random() * 3 });
    else if (r < 0.8) {
      const side = this.post.yaw + (Math.random() < 0.5 ? -0.7 : 0.7);
      this.tasks.push({ do: 'face', at: a.pos.clone().add(V(Math.sin(side), 0, Math.cos(side))) }, { do: 'wait', t: 1.5 + Math.random() * 1.5 }, { do: 'face', at: a.pos.clone().add(V(Math.sin(this.post.yaw), 0, Math.cos(this.post.yaw))) });
    } else this.tasks.push({ do: 'pose', pose: 'bend', t: 1.6 });
  }

  tapped() {
    if (!this.on) return;
    if (this.busy) {
      if (this.world.time - this.lastSay > 3) this.say('tap');
      return;
    }
    super.tapped();
  }

  own(t, dt) {
    return this.world.ownTask ? this.world.ownTask(this, t, dt) : undefined;
  }
}
