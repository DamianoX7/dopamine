/* ==================================================================
   말랑 놀이터 — the playground: fingers, buttons, the meter and the
   hint around the toy of js/mallang/engine.js. The app (classic
   scripts) reaches it through Mallang in js/mallang.js — the same
   arrangement as the foxes and FoxHost: the app owns the screen it is
   shown on, the sound switch, the theme and what is remembered; this
   side plays.
   ================================================================== */
import { clamp, lerp, smooth, damp, rand, V, M3, TOYS, WAXES, SLAB, PITCH, AIM, shapeAt, Sound, buzz, Squish, Shell, Crumbs, Glitter, View } from './engine.js';

// where the fingers of a squeezing hand go: four round the middle, and the thumb on top
const FIST = [[-0.82, 0.12, 0.56], [0.82, 0.05, 0.57], [-0.6, 0.1, -0.79], [0.62, 0.22, -0.76], [0.05, 0.86, 0.5]];
const STONE = 1.15; // colder than this (see freeze), a toy is frozen too hard to crush: 짱돌
const SIDEWAYS = '(orientation: landscape) and (max-height: 520px)'; // a phone on its side (the same words as in mallang.css)

/** Keeps a pointer's moves coming to the element it went down on, even after it wanders off it. */
const capture = (el, e) => {
  try {
    el.setPointerCapture(e.pointerId);
  } catch (err) {
    /* a pointer that is already gone: nothing to hold on to */
  }
};

/** Two '#rrggbb' colours, t of the way from a to b. */
const blend = (a, b, t) => {
  const m = parseInt(a.slice(1), 16), n = parseInt(b.slice(1), 16);
  const ch = (s) => Math.round(lerp((m >> s) & 255, (n >> s) & 255, t));
  return '#' + ((1 << 24) | (ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).slice(1);
};

class Playground {
  /**
   * root: the element of Mallang.html() in js/mallang.js.
   * host: { audio() → AudioContext, soundOn(), kept() → { mode, soft, wax }, keep(o), room() → { wall, floor, own }, active() }
   */
  constructor(root, host) {
    this.root = root;
    this.host = host;
    this.offs = [];
    this.touches = []; //   fingers on the toy, and for a moment after they leave, what they left behind
    this.pointers = new Map();
    this.grip = 0;
    this.gripping = false;
    this.time = 0;
    this.seed = (Date.now() % 100000) + 7;
    this.swap = false;
    this.coat = null;
    this.done = false; //   the wax is all off
    this.nudged = false; // …and before that, the hint about the bits still clinging on has been given
    this.hintFor = 0;
    this.shown = -1;
    this.lens = null; //    where the camera is to be, for this screen and this toy (see resize)…
    this.seen = null; //    …and how far it has got with what the toy asks of it: it eases there
    this.crunch = 0; //     crackles a crunchy toy still owes (see crackle), and how long since it last let some out
    this.since = 0;
    this.clear = 1; //      how much of a coat of clear wax is still clear, not yet slush (see crunchy)
    this.cold = 0; //       how cold the toy is: 1 after ten minutes in the freezer, 2 left in too long (see freeze); it warms up again
    this.freezer = null; // in the freezer now: { t }
    this.box = { left: 0, top: 0, width: 1, height: 1 };

    this.stage = this.$('stage');
    this.view = new View(this.stage); // throws where there is no WebGL
    // phones with few cores get a coarser skin: at their size it looks the same
    const coarse = matchMedia('(pointer: coarse)').matches && (navigator.hardwareConcurrency || 8) <= 4;
    this.ball = new Squish(coarse ? 4 : 5);
    this.shell = new Shell(this.ball);
    this.crumbs = new Crumbs(700);
    this.glitter = new Glitter();

    const kept = host.kept() || {};
    Sound.lend = host.audio;
    Sound.on = host.soundOn();
    this.mode = kept.mode === 'wax' ? 'wax' : 'soft';
    this.last = { soft: TOYS.find((t) => t.id === kept.soft) || TOYS[0], wax: WAXES.find((t) => t.id === kept.wax) || WAXES[0] };
    this.wire();
    this.wear(this.last[this.mode], true);
    this.ball.lift = 5; // it drops in
    this.ball.liftV = -5;
    this.resize();
    this.say(this.hello(), 6);
    this.raf = requestAnimationFrame((t) => {
      this.then = t;
      this.frame(t);
    });
  }

  $(name) {
    return this.root.querySelector(`[data-mg="${name}"]`);
  }

  on(target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.offs.push(() => target.removeEventListener(type, fn, opts));
  }

  /** The playground is being closed: nothing of it may go on running. */
  destroy() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.dead = true;
    this.offs.splice(0).forEach((off) => off());
    if (this.watch) this.watch.disconnect();
    this.touches.length = 0;
    this.pointers.clear();
    // browsers only keep so many WebGL pictures alive: hand this one back
    const lose = this.view.gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  }

  // ---- buttons

  wire() {
    const stage = this.stage;
    this.on(stage, 'pointerdown', (e) => this.down(e));
    this.on(stage, 'pointermove', (e) => this.move(e));
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.on(stage, type, (e) => this.up(e));
    this.on(stage, 'contextmenu', (e) => e.preventDefault());
    this.on(window, 'gesturestart', (e) => e.preventDefault()); // Safari would zoom the page under two fingers
    // browsers only allow sound after a tap, and some only count the end of one
    for (const type of ['pointerup', 'touchend', 'click', 'keydown']) this.on(this.root, type, () => Sound.wake(), true);
    this.on(window, 'resize', () => this.resize());
    this.on(window, 'orientationchange', () => setTimeout(() => this.dead || this.resize(), 250));
    this.on(window, 'blur', () => this.dropAll());
    if (window.ResizeObserver) {
      this.watch = new ResizeObserver(() => this.resize()); // the dock grows a row with the wax meter
      this.watch.observe(this.root);
      this.watch.observe(this.$('dock'));
    }

    this.tabs = [...this.root.querySelectorAll('[data-mode]')];
    for (const tab of this.tabs) {
      this.on(tab, 'click', () => {
        Sound.wake();
        if (tab.dataset.mode !== this.mode) this.choose(this.last[tab.dataset.mode]);
      });
    }
    const grip = this.$('grip');
    const hold = (on) => {
      grip.classList.toggle('held', on);
      this.squeeze(on);
    };
    this.on(grip, 'pointerdown', (e) => {
      e.preventDefault();
      capture(grip, e);
      hold(true);
    });
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) this.on(grip, type, () => hold(false));
    this.on(window, 'keydown', (e) => {
      if (e.code === 'Space' && !e.repeat && this.host.active()) {
        e.preventDefault();
        hold(true);
      }
    });
    this.on(window, 'keyup', (e) => {
      if (e.code !== 'Space' || !this.gripping) return;
      e.preventDefault(); // or it would also press whichever button was clicked last
      hold(false);
    });
    this.on(this.$('recoat'), 'click', () => {
      Sound.wake();
      this.recoat();
    });
    this.on(this.$('chill'), 'click', () => {
      Sound.wake();
      this.freeze();
    });
  }

  /** The row of toys for the kind that is showing. */
  chips() {
    const row = this.$('chips');
    row.textContent = '';
    for (const toy of this.mode === 'wax' ? WAXES : TOYS) {
      const chip = document.createElement('button');
      chip.className = 'mg-chip';
      chip.type = 'button';
      chip.setAttribute('aria-pressed', toy === this.next ? 'true' : 'false');
      chip.innerHTML = `<i style="--a:${toy.dot[0]};--b:${toy.dot[1]}"></i>${toy.name}`;
      chip.addEventListener('click', () => {
        Sound.wake();
        this.choose(toy);
      });
      row.appendChild(chip);
    }
    // on a phone the row is longer than the dock is wide: the one that is chosen is brought to the middle of it
    const chosen = row.querySelector('[aria-pressed=true]');
    if (chosen) {
      row.scrollLeft = chosen.offsetLeft - row.offsetLeft - (row.clientWidth - chosen.offsetWidth) / 2;
      row.scrollTop = chosen.offsetTop - row.offsetTop - (row.clientHeight - chosen.offsetHeight) / 2;
    }
    for (const tab of this.tabs) {
      const on = tab.dataset.mode === this.mode;
      tab.classList.toggle('on', on);
      tab.setAttribute('aria-selected', on ? 'true' : 'false');
    }
    this.$('recoat').hidden = this.$('meter').hidden = this.mode !== 'wax';
    this.$('recoat').textContent = this.next.slush ? `새 ${this.next.name}` : '다시 코팅'; // clear wax gone to slush cannot be put back: there are more in the box
    this.$('chill').hidden = !this.next.chill;
  }

  save() {
    this.host.keep({ mode: this.mode, soft: this.last.soft.id, wax: this.last.wax.id });
  }

  /** The app's sound switch was turned. */
  setSound(on) {
    Sound.on = on;
    Sound.wake();
    Sound.tap();
  }

  /** What to try first with the toy that has just arrived. */
  hello() {
    const toy = this.toy;
    if (toy.slush) return '꾹 누르면 사각사각 부서져요 · 꽉 쥐어도 돼요';
    if (toy.wax) return '꾹 눌러서 왁스를 바사삭 깨 보세요';
    return toy.hint || (toy.roll ? '꾹 누르고, 쭉 당겨 보세요 · 바닥을 밀면 굴러가요' : '꾹 누르고, 쭉 당겨 보세요');
  }

  say(text, secs) {
    const hint = this.$('hint');
    if (text) hint.textContent = text;
    hint.classList.toggle('on', secs > 0);
    this.hintFor = secs;
  }

  /** Fits the picture to the screen, and to the toy: a long one is seen from further off, so that it has the same room at its ends, and a flat one from higher up. */
  resize() {
    if (this.dead) return;
    const box = (this.box = this.root.getBoundingClientRect());
    const w = Math.max(1, box.width), h = Math.max(1, box.height), dpr = Math.min(devicePixelRatio || 1, 2), { wide: long = 1, look } = this.next;
    const cw = Math.round(w * dpr), ch = Math.round(h * dpr);
    if (this.stage.width !== cw || this.stage.height !== ch) {
      this.stage.width = cw;
      this.stage.height = ch;
    }
    const dock = this.$('dock');
    const to = (this.lens = { w, h, across: 0, room: 0, shift: 0, side: 0, long, pitch: look ? (look[0] * Math.PI) / 180 : PITCH, aim: look ? look[1] : AIM });
    if (matchMedia(SIDEWAYS).matches) {
      // a phone on its side: the dock is at the right, the hint along the bottom, and the toy gets what is left
      const wide = dock.getBoundingClientRect().left - box.left, top = 6, room = h - top - 46;
      Object.assign(to, { across: wide * 0.3, room: room * 0.33, shift: 1 - (2 * (top + room * 0.5)) / h, side: wide / w - 1 });
    } else {
      // the toy goes in the room between the title and the dock
      const top = 64, room = Math.max(160, h - top - dock.offsetHeight - 24);
      Object.assign(to, { across: w * 0.32, room: room * 0.33, shift: 1 - (2 * (top + room * 0.46)) / h });
    }
    if (!this.seen) this.seen = { long: to.long, pitch: to.pitch, aim: to.aim };
    this.point();
  }

  /** Points the camera: what follows from the screen (lens) is there at once; what follows from the toy it has only got so far towards (seen). */
  point() {
    const { w, h, across, room, shift, side } = this.lens, { long, pitch, aim } = this.seen;
    this.view.cam.set(w, h, clamp(Math.min(across / long, room), 60, 300), shift, side, pitch, aim);
  }

  // ---- changing toys

  /** The toy in the room of the app's theme: the walls and the table are the theme's, with a breath of the toy's own colour. */
  dressed(toy) {
    const room = this.host.room();
    return Object.assign(Object.create(toy), { bg: blend(room.wall, toy.bg, room.own), floor: blend(room.floor, toy.floor, room.own) });
  }

  /** The theme changed (night fell, or another one was picked): the room follows. */
  retint() {
    if (!this.dead) this.view.tint(this.dressed(this.toy));
  }

  /** Another toy, please: this one is tossed up out of sight and the next drops in. */
  choose(toy) {
    if (toy === this.next && !this.swap) return;
    this.next = toy;
    this.mode = toy.wax ? 'wax' : 'soft';
    this.last[this.mode] = toy;
    this.chips();
    this.resize();
    this.save();
    Sound.tap();
    this.freezer = null; // (taken out of the freezer to make room, if it was in there)
    if (this.swap) return;
    this.swap = true;
    this.coat = null;
    this.dropAll();
    this.ball.toss();
    this.shell.sweep();
    this.crumbs.sweep();
  }

  wear(toy, now) {
    const { ball, shell } = this;
    this.toy = this.next = toy;
    this.cold = 0;
    ball.reset(toy.shape);
    if (toy.slush) {
      // a coat of clear wax is no shell of shards: it is the skin itself, and goes to slush where it is worked (see crunchy)
      shell.clear();
      ball.free.fill(1);
      ball.freeTo.fill(1);
      this.glitter.scatter(this.seed++, ball, toy.core);
      this.clear = 1;
    } else if (toy.wax) {
      shell.build(this.seed++);
      ball.free.fill(0);
    } else {
      shell.clear();
      ball.free.fill(1);
      ball.freeTo.fill(1);
    }
    this.view.fit(ball);
    this.view.tint(this.dressed(toy), now);
    this.done = this.nudged = false;
    this.shown = -1;
    this.chips();
  }

  /** A new coat of wax: the table is cleared, the wax runs down over the ball, then sets. (Clear wax gone to slush cannot be: a new one
      comes out of the box instead.) */
  recoat() {
    if (this.coat || this.swap || this.freezer || !this.toy.wax) return;
    if (this.toy.slush) {
      this.swap = true; // tossed away, and the same again drops in, new
      this.dropAll();
      this.ball.toss();
      Sound.tap();
      return;
    }
    this.coat = { t: 0, step: 0 };
    this.dropAll();
    this.shell.sweep();
    this.crumbs.sweep();
    Sound.tap();
    this.say('왁스를 다시 입히는 중…', 3);
  }

  coating(dt) {
    const c = this.coat, shell = this.shell;
    c.t += dt;
    if (c.step === 0 && c.t > 0.3) {
      c.step = 1;
      this.ball.liftV = 7;
      this.ball.wake = true;
    }
    if (c.step === 1 && c.t > 0.42) {
      c.step = 2;
      shell.build(this.seed++);
      shell.soft = true;
      shell.wet = 1;
      this.done = this.nudged = false;
      Sound.pour();
    }
    if (c.step === 2) {
      shell.pour = lerp(1.5, -1.7, smooth(0.42, 1.3, c.t));
      if (c.t > 1.3) {
        c.step = 3;
        shell.pour = -9;
        this.say('굳는 중…', 2);
      }
    }
    if (c.step === 3) {
      shell.wet = 1 - smooth(1.3, 2.5, c.t);
      if (c.t > 2.5) {
        shell.wet = 0;
        shell.soft = false;
        this.coat = null;
        Sound.chime();
        this.say('다 굳었어요! 꾹 눌러서 깨 보세요', 4);
      }
    }
  }

  /** Ten minutes in the freezer (a moment, here): cold, it crunches louder, but left in too long it is as hard as a stone (짱돌) until it
      has warmed up a little. */
  freeze() {
    if (this.freezer || this.swap || this.coat || !this.toy.chill) return;
    this.freezer = { t: 0 };
    this.dropAll();
    this.ball.toss();
    Sound.tap();
    this.say(this.cold > 0.5 ? '또 얼려요? 너무 오래 얼리면 짱돌이 돼요…' : '냉동실에서 10분만 얼릴게요…', 3);
  }

  freezing(dt) {
    const f = this.freezer, ball = this.ball;
    f.t += dt;
    if (ball.lift > 5) {
      // in the freezer: well out of sight, and too high up to throw a shadow on the table
      ball.lift = 12;
      ball.liftV = 0;
    }
    if (f.t < 1.8 || ball.lift < 5) return;
    this.freezer = null;
    this.cold = Math.min(2, this.cold + 1);
    ball.tossed = false; // and out it comes
    ball.lift = 5;
    ball.liftV = -6;
    this.say(this.cold > 1.5 ? '너무 오래 얼려서 짱돌이 됐어요! 손으로 주물러서 녹여 주세요' : '꽁꽁! 차가우면 더 사각사각해요', 5);
  }

  /** Out of the freezer it warms up again: by itself on the table, and sooner in a hand. */
  thaw(dt) {
    let warm = 1 / 50;
    for (const t of this.touches) if (t.live) warm += t.fist ? 1 / 120 : 1 / 60;
    const was = this.cold;
    this.cold = Math.max(0, this.cold - warm * dt);
    if (was > STONE && this.cold <= STONE) this.say('이제 부서질 만큼 녹았어요!', 3);
  }

  /** Clear wax going to slush. Round each finger it goes by as much as the finger has just gone in or slid (and a little all the while it is
      held down); squeezing the whole toy works it all; and where it has gone white, the edge of it creeps on a little way, as cracks do. */
  crunchy(dt) {
    const { ball } = this, crush = ball.crush, nbr = ball.nbr, n = ball.n;
    const give = 1 - smooth(STONE, STONE + 0.45, this.cold); // (frozen hard, it will not)
    for (const t of this.touches) {
      if (!t.live) continue;
      const did = (Math.abs(t.pr - t.felt) * 1.1 + t.slide * dt * 0.8 + t.pr * dt * 0.08) * give;
      t.felt = t.pr;
      for (let q = 0; q < t.near.length; q += 2) crush[t.near[q]] = Math.min(1, crush[t.near[q]] + did * t.near[q + 1]);
    }
    const E = ball.E, squeezed = Math.sqrt(E[0] * E[0] + E[1] * E[1] + E[2] * E[2] + 2 * (E[3] * E[3] + E[4] * E[4] + E[5] * E[5])) * dt * 0.35 * give;
    let gone = 0;
    for (let i = 0, q = 0; i < n; i++, q += 6) {
      const near = (crush[nbr[q]] + crush[nbr[q + 1]] + crush[nbr[q + 2]] + crush[nbr[q + 3]] + crush[nbr[q + 4]] + crush[nbr[q + 5]]) / 6;
      const c = (crush[i] = Math.min(1, crush[i] + squeezed + Math.max(0, near - crush[i] - 0.15) * Math.min(1, dt * 3)));
      gone += smooth(0.05, 0.85, c);
    }
    this.clear = 1 - gone / n;
  }

  // ---- fingers (x, y: a place in the playground, in pixels from its top left corner)

  /** The direction, from the toy's middle, of the bit of skin under a point (or nothing, off the toy). */
  pick(x, y) {
    const { ball } = this, ray = this.view.cam.ray(x, y), i = ball.under(ray.o, ray.d, false) * 3;
    return i < 0 ? null : [ball.dir[i], ball.dir[i + 1], ball.dir[i + 2]];
  }

  /** Is a point over the toy — over where it stands, not over skin a finger has pulled out from it? */
  over(x, y) {
    const ray = this.view.cam.ray(x, y);
    return this.ball.under(ray.o, ray.d, true) >= 0;
  }

  pan(pos) {
    return clamp(pos[0] / 2.6, -1, 1);
  }

  touch(a, x, y, kind) {
    const t = {
      live: true, gone: false, fist: false, x, y,
      a, ra: shapeAt(this.toy.shape, a[0], a[1], a[2]), // the bit of skin it holds: its direction, and its place on the outline
      w: kind === 'touch' ? 0.36 : 0.32, //                how wide the dent is
      pr: 0, hold: 0, //                                   how far in it has sunk (0…1), and for how long
      d: [0, 0, 0], dv: [0, 0, 0], //                      how far it has dragged that bit of skin
      dir: [0, 0, -1], near: [], slide: 0, over: true, waxy: false,
      heard: 0, felt: 0, //                                how far in it was when last listened to (see crackle), and when it last crushed (see crunchy)
    };
    t.waxy = !!this.toy.wax && this.shell.waxAt(a);
    if (this.cold > STONE) Sound.thud(0.2); // frozen as hard as a stone: a finger only knocks on it
    else if (!t.waxy) Sound.squish(this.pan(this.ball.posed(t.ra)), this.toy.voice);
    this.touches.push(t);
    if (this.hintFor > 1.2) this.hintFor = 1.2;
    if (this.cold > STONE && this.hintFor <= 0) this.say('꽁꽁 얼었어요! 손으로 주무르면 녹아요', 3);
    return t;
  }

  /** A finger leaves: 'up' lifted, 'snap' the skin got away from it, 'off' it slid off the wax. */
  letGo(t, how) {
    if (!t.live) return;
    t.live = false;
    t.gone = how !== 'up';
    const pan = this.pan(this.ball.posed(t.ra)), voice = this.toy.voice;
    if (how === 'snap') {
      Sound.snap(pan);
      buzz(18);
    } else if (how === 'up' && !t.waxy && t.pr > 0.45) {
      if (voice === 'sticky') Sound.pop(pan);
      else if (voice === 'wet') Sound.blub(pan);
      else if (voice === 'foam') Sound.air(1.5);
      else if (voice !== 'crunch') Sound.pop(pan, 0.5, 0.7); // (a crunchy one is heard filling out again instead: see crackle)
    }
  }

  dropAll() {
    for (const t of this.touches) t.live = false;
    this.pointers.clear();
    this.gripping = false;
    this.stage.classList.remove('down');
    this.$('grip').classList.remove('held');
  }

  down(e) {
    e.preventDefault();
    Sound.wake();
    capture(this.stage, e);
    this.stage.classList.add('down');
    const x = e.clientX - this.box.left, y = e.clientY - this.box.top;
    const a = this.swap || this.freezer ? null : this.pick(x, y);
    // on the toy it is a finger; anywhere else it rolls the toy round
    this.pointers.set(e.pointerId, a ? this.touch(a, x, y, e.pointerType) : { rolling: true, x, y, t: performance.now() });
  }

  move(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    const x = e.clientX - this.box.left, y = e.clientY - this.box.top;
    if (p.rolling) {
      const k = 1 / this.view.cam.px, ax = (x - p.x) * k, ay = this.toy.roll ? (y - p.y) * k : 0;
      const now = performance.now(), dt = Math.max(0.004, (now - p.t) / 1000);
      Object.assign(p, { x, y, t: now });
      this.ball.roll(ax, ay);
      this.flick = [lerp(this.flick ? this.flick[0] : 0, ay / dt, 0.5), lerp(this.flick ? this.flick[1] : 0, ax / dt, 0.5), 0];
    } else if (p.gone) {
      // it got away: take hold again wherever the pointer is on it now
      const a = this.swap || this.freezer ? null : this.pick(x, y);
      if (a) this.pointers.set(e.pointerId, this.touch(a, x, y, e.pointerType));
    } else {
      p.x = x;
      p.y = y;
    }
  }

  up(e) {
    const p = this.pointers.get(e.pointerId);
    if (!p) return;
    this.pointers.delete(e.pointerId);
    if (!this.pointers.size) this.stage.classList.remove('down');
    if (p.rolling) {
      if (this.flick && performance.now() - p.t < 80) this.ball.spin = this.flick; // a flick keeps it turning
      this.flick = null;
      this.ball.wake = true;
    } else this.letGo(p, 'up');
  }

  /** A whole hand round it, for as long as the button is held. */
  squeeze(on) {
    if (on === this.gripping || (on && (this.swap || this.freezer))) return;
    this.gripping = on;
    if (on) {
      Sound.wake();
      for (const f of FIST) {
        const a = V.norm(M3.applyT(this.ball.Q, V.norm(f)));
        this.touches.push({ live: true, gone: false, fist: true, a, ra: shapeAt(this.toy.shape, a[0], a[1], a[2]), w: 0.52, pr: 0, hold: 0, d: [0, 0, 0], dv: [0, 0, 0], dir: V.mul(a, -1), near: [], slide: 0, over: true, waxy: false, heard: 0, felt: 0 });
      }
      if (this.cold > STONE) Sound.thud(0.3);
      else if (!this.toy.wax || !this.shell.whole) Sound.squish(0, this.toy.voice, 1.5);
      if (this.hintFor > 1.2) this.hintFor = 1.2;
    } else {
      let deep = 0;
      for (const t of this.touches) {
        if (t.fist && t.live) {
          t.live = false;
          deep = Math.max(deep, t.pr);
        }
      }
      const voice = this.toy.voice;
      if (deep > 0.45 && (!this.toy.wax || !this.shell.whole) && voice !== 'crunch' && this.cold <= STONE) voice === 'foam' ? Sound.air(1.5) : voice === 'wet' ? Sound.blub(0) : Sound.pop(0, 0.7, 0.8);
    }
  }

  /** Works out, for this frame, what every finger is doing to the toy. */
  feel(dt) {
    const { ball, toy } = this, cam = this.view.cam;
    for (let i = this.touches.length - 1; i >= 0; i--) {
      const t = this.touches[i];
      if (!t.live) {
        // gone: the dent is the skin's own business now, and a pulled bit springs back
        t.pr = damp(t.pr, 0, 24, dt);
        let left = t.pr;
        for (let k = 0; k < 3; k++) {
          t.dv[k] += (-toy.g[0] * toy.g[0] * t.d[k] - 2 * toy.g[1] * toy.g[0] * t.dv[k]) * dt;
          t.d[k] += t.dv[k] * dt;
          left += Math.abs(t.d[k]) + Math.abs(t.dv[k]) * 0.1;
        }
        if (left < 0.002) this.touches.splice(i, 1);
        continue;
      }
      t.hold += dt;
      if (t.fist) {
        t.dir = V.mul(V.norm(M3.apply(ball.A, t.a)), -1);
        t.pr = damp(t.pr, 1, 1 / toy.sink, dt);
        continue;
      }
      // the finger is on the screen; the skin it holds is wherever the toy has put it
      const ray = cam.ray(t.x, t.y), at = ball.posed(t.ra);
      const finger = V.add(ray.o, V.mul(ray.d, V.dot(V.sub(at, ray.o), cam.fwd) / V.dot(ray.d, cam.fwd)));
      let pull = V.sub(finger, at);
      const len = V.len(pull);
      t.waxy = !!toy.wax && this.shell.waxAt(t.a);
      const stick = t.waxy ? 0.03 : toy.stick;
      t.over = this.over(t.x, t.y);
      t.slide = 0;
      if (t.over && len > stick) {
        // still on the toy: the skin slips, and the finger keeps hold of it a little way behind
        const a = ball.toRest(V.sub(finger, V.mul(pull, stick / len)));
        t.slide = V.len(V.sub(a, t.a)) / dt;
        t.a = a;
        t.ra = shapeAt(toy.shape, a[0], a[1], a[2]);
        pull = V.mul(pull, stick / len);
      } else if (!t.over && len > (t.waxy ? 0.05 : toy.pull)) {
        // off the edge: the skin stretches after it, until it snaps away
        this.letGo(t, t.waxy ? 'off' : 'snap');
        continue;
      }
      for (let k = 0; k < 3; k++) t.d[k] = damp(t.d[k], pull[k], 40, dt);
      const n = ball.outward(t.a);
      t.dir = V.norm([ray.d[0] * 0.2 - n[0] * 0.8, ray.d[1] * 0.2 - n[1] * 0.8, ray.d[2] * 0.2 - n[2] * 0.8]);
      t.pr = damp(t.pr, t.over ? 1 : 0.1, 1 / toy.sink, dt);
    }
  }

  /** A crunchy toy crackles for as long as something in it is on the move: a finger going in or sliding, a dent filling out again.
      (Clear wax goes 사각사각, the less the more of it has gone to slush; frozen hard, it does not at all.) */
  crackle(dt) {
    const { ball, toy } = this, how = toy.slush ? (0.2 + 0.8 * this.clear) * (1 - smooth(STONE, STONE + 0.45, this.cold)) : 1;
    let work = ball.flow * dt * 380 * how, at = 0, weight = 0;
    for (const t of this.touches) {
      if (t.live) {
        const did = (Math.abs(t.pr - t.heard) * toy.depth * (t.fist ? 26 : 60) + t.slide * dt * t.pr * 30) * how;
        work += did;
        at += this.pan(ball.posed(t.ra)) * did;
        weight += did;
      }
      t.heard = t.pr;
    }
    this.crunch += work;
    this.since += dt;
    if (this.since < 0.03) return; // they are let out a few at a time, over the moment that follows
    const n = Math.min(Math.floor(this.crunch), 14);
    if (n > 0) {
      Sound.crunch(weight > 0 ? at / weight : this.pan(ball.C), n, this.since, toy.slush ? 1 : 0, Math.min(1, this.cold));
      if (n > 5) buzz(8);
    }
    this.crunch = Math.min(this.crunch - n, 6);
    this.since = 0;
  }

  /** Turns what happened this frame into sound, crumbs and a buzz. */
  hear() {
    const { ball, shell, crumbs } = this;
    for (const ev of ball.events) if (ev.type === 'land') Sound.thud(clamp(ev.hit / 9, 0.2, 1));
    ball.events.length = 0;
    let late = 0;
    for (const ev of shell.events) {
      const pan = this.pan(ev.pos);
      if (ev.type === 'crack') {
        Sound.crack(clamp(ev.size / 6, 0.2, 1), pan, late);
        crumbs.burst(ev.pos, ev.n, 2 + ev.size, 1.6);
        buzz(12);
        late += 0.012 + rand() * 0.02; // a shell going all at once is heard as a run of cracks, not one bang
      } else if (ev.type === 'chip') {
        Sound.crack(0.1 + rand() * 0.12, pan, late);
        crumbs.burst(ev.pos, ev.n, 2, 1.2);
        buzz(6);
        late += 0.008 + rand() * 0.016;
      } else if (ev.type === 'crush') {
        Sound.crack(0.08 + rand() * 0.1, pan, late);
        crumbs.burst(ev.pos, ev.n, 7, 0.9);
        buzz(6);
        late += 0.01 + rand() * 0.02;
      } else if (ev.type === 'shed') crumbs.burst(ev.pos, ev.n, 1, 0.8);
      else if (ev.type === 'smash') {
        Sound.crack(0.25, pan, 0);
        crumbs.burst(ev.pos, [0, 1, 0], 3, 1.4);
      } else if (ev.type === 'tick') Sound.tick(pan, 0.04 + 0.1 * rand());
    }
    shell.events.length = 0;
  }

  /** The meter and the hint. */
  tell(dt) {
    const { toy, shell } = this;
    if (toy.slush) {
      // the meter is how much of the clear wax is still clear
      const pct = Math.round(this.clear * 100);
      if (pct !== this.shown) {
        this.shown = pct;
        this.$('meterText').textContent = `왁스 ${pct}%`;
        this.$('meterBar').style.width = pct + '%';
      }
      this.$('recoat').disabled = pct > 97 || !!this.freezer;
      if (!this.done && pct <= 2) {
        this.done = true;
        Sound.chime();
        this.say('다 부쉈어요! 이제 마음껏 주물러 보세요', 5);
      }
    } else if (toy.wax && shell.count) {
      const pct = Math.round(((shell.whole + shell.stuck) / shell.count) * 100);
      if (pct !== this.shown) {
        this.shown = pct;
        this.$('meterText').textContent = `왁스 ${pct}%`;
        this.$('meterBar').style.width = pct + '%';
      }
      this.$('recoat').disabled = pct > 97 || !!this.coat;
      if (!this.done && !this.coat && shell.whole + shell.stuck === 0) {
        this.done = true;
        Sound.chime();
        this.say('다 깼어요! 이제 마음껏 주물러 보세요', 5);
      } else if (!this.nudged && !this.coat && !shell.whole && shell.stuck > shell.count * 0.1 && !this.touches.length) {
        // cracked all over, but most of it still clinging on
        this.nudged = true;
        this.say(`남은 조각은 문지르거나 꽉 쥐면 떨어져요 · 바닥을 밀면 ${SLAB[toy.shape] ? '뒤집혀요' : '굴러가요'}`, 6);
      }
    }
    if (toy.chill) this.$('chill').disabled = !!this.freezer || this.swap;
    if (this.hintFor > 0 && (this.hintFor -= dt) <= 0) this.$('hint').classList.remove('on');
  }

  frame(now) {
    if (this.dead) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    const dt = clamp((now - this.then) / 1000, 0.001, 0.033);
    this.then = now;
    this.time += dt;
    const { ball, shell, toy } = this;

    if (this.swap && ball.lift > 5) {
      // out of sight: change it for the next one, which falls in
      this.wear(this.next);
      ball.lift = 5;
      ball.liftV = -6;
      this.swap = false;
      this.say(toy === this.toy && !toy.slush ? '' : this.hello(), 5); // (the same one again, gone to slush: a new one out of the box)
    }
    if (this.freezer) this.freezing(dt);
    if (this.coat) this.coating(dt);
    this.grip = damp(this.grip, this.gripping ? 1 : 0, this.gripping ? 9 : 14, dt);
    this.feel(dt);
    if (this.cold > 0 && !this.freezer) this.thaw(dt);
    // cold, it is firmer, and frozen hard it hardly gives at all; clear wax not yet gone to slush holds it a little firm too
    ball.stiff = Math.min(0.95, 0.9 * smooth(STONE, STONE + 0.45, this.cold) + 0.15 * Math.min(1, this.cold) + (this.toy.slush ? 0.3 * this.clear : 0));
    ball.give = (this.toy.slush ? 0.6 + 0.4 * (1 - this.clear) : this.toy.wax && shell.count ? smooth(0.4, 0.95, 1 - shell.whole / shell.count) : 1) * (1 - ball.stiff);
    let turning = false;
    for (const p of this.pointers.values()) if (p.rolling) turning = true;
    if (ball.turning && !turning) ball.wake = true; // let go of, however that came about: it may have been left standing on an edge
    ball.turning = turning;
    this.moved = ball.step(dt, this.toy, this.touches, this.grip);
    if (this.toy.slush) this.crunchy(dt);
    if (this.toy.voice === 'crunch') this.crackle(dt);
    if (this.toy.wax && (this.moved || shell.busy)) shell.update(dt, this.touches);
    this.crumbs.update(dt, ball);
    this.hear();
    this.tell(dt);
    const to = this.lens, at = this.seen;
    if (at.long !== to.long || at.pitch !== to.pitch || at.aim !== to.aim) {
      // another toy has come: the camera eases to where that one is best seen from
      const there = Math.abs(at.long - to.long) < 1e-3 && Math.abs(at.pitch - to.pitch) < 2e-4 && Math.abs(at.aim - to.aim) < 1e-3;
      for (const k of ['long', 'pitch', 'aim']) at[k] = there ? to[k] : damp(at[k], to[k], 6, dt);
      this.point();
    }
    this.view.draw(this, dt);
  }
}

window.Mallang.register({
  /** Starts the toy in `root`; throws where it cannot be drawn. */
  start: (root, host) => new Playground(root, host),
});

// index.html?debug=1 — handles for poking around in the console (the same names as the standalone page's)
if (new URLSearchParams(location.search).has('debug')) window.__sound = Sound;
