'use strict';
/* ==================================================================
   🚌 506번 — the village bus between 우리 동네 and 여우 마을.

   At the stop on the street (js/town.js) the girl who lives in the
   house takes the bus to the foxes: it comes along, she gets on, it
   pulls away (js/house/town.js) — and then the ride: the view going
   by the window, the stops on the way, the chime and "이번 정류장은
   여우 마을입니다", while the foxes' world is made ready behind it.
   There she gets off out of sight and comes in through the gap in
   the bushes, and the foxes run to meet her; Lorelei waves
   (js/fox/visitor.js). Home the same way: 🚌 in the foxes' world, she
   says goodbye and goes out to the bus, and it puts her down at the
   stop on the street.
   ================================================================== */

const BUS_ROUTE = '506';
/* What she says in the foxes' world ('{fox}': the fox it is about; '{owner}': Lorelei). */
const BUS_ME_LINES = {
  arrive: ['여우들아, 나 왔어! 🦊', '도착~! 여우 마을이다 🌳', '안녕 얘들아~ 보고 싶었어 💗'],
  arrive_night: ['쉿… 다들 자고 있네 🌙', '밤의 여우 마을이다… 조용히 놀다 가야지 🤫'],
  tap: ['헤헤 👋', '여우 마을 좋다~', '오늘 여기 오길 잘했다!', '{owner}, 여우들이랑 놀러 왔어~', '여우들 진짜 귀엽다 💗'],
  tap_rain: ['비 오는 여우 마을도 좋다 ☔', '우산 사 오길 잘했다~'],
  tap_night: ['밤하늘 예쁘다 🌙', '여우들 자는 거 너무 귀여워…'],
  pet: ['{fox} 보들보들해~', '{fox} 착하다 💗', '쓰담쓰담~', '{fox}, 나 기억하지?'],
  bye: ['이제 가 볼게~ 또 올게! 👋', '얘들아 안녕~ 또 놀러 올게!', '버스 왔다! 안녕~ 🚌'],
};
/* …and what Lorelei says to her ('{her}': her name — '{her:이/가}' with its particle). */
const BUS_OWNER_LINES = {
  hello: ['어서 와, {her:아/야}! 버스 타고 왔구나 🚌', '{her:이/가} 왔다! 얘들아, 손님 왔어~ 🦊', '{her:아/야}, 놀러 와 줘서 고마워 💗'],
  bye: ['조심히 가, {her:아/야}! 또 놀러 와 👋', '다음에 또 와~ 여우들이 기다릴 거야!'],
};
/* The view out of the window on the way, a stretch at a time — from the town to the foxes' village (on the way home,
   the other way round): what goes by in the middle of the view, and down by the road. */
const BUS_VIEWS = [
  { mid: ['🏠', '🏡', '🏪', '🌳', '🏢', '🏠', '🌳', '🏡'], near: ['🌱', '🌷', '🌿', '🌱'] },
  { mid: ['🌲', '🍁', '🌳', '🌲', '🍂', '🌲', '🍁'], near: ['🍂', '🍄', '🌿', '🍁'] },
  { mid: ['🌾', '🌸', '🌳', '🌾', '🌼', '🪨', '🌾'], near: ['💧', '🌼', '🌱', '🌸'] },
  { mid: ['🌲', '🦊', '🌳', '🌼', '🍄', '🦊', '🌲', '🌸'], near: ['🌼', '🍄', '🌷', '🌿'] },
];
const RIDE_T = 5.2; //      seconds the ride takes, at least (more if the world it goes to is not ready yet)
const RIDE_MAX = 18; //     …and at most: the bus gets there all the same
const RIDE_WAIT = 0.86; //  how far it gets while that world is still being made ready

const BusRide = {
  ov: null, //         the ride's screen, while it is on
  to: null, //         where to: 'fox' (the foxes' village) or 'town' (우리 동네)
  switching: false, // (the one world is shut and the other opened under the screen: full screen is kept)
  here: false, //      the world it goes to is ready (ready())
  landers: [], //      what waits for the screen to go (landed())
  visiting: false, //  the girl from the house is in the foxes' world
  leaving: false, //   …and on her way out to the bus

  /** '10월 31일': when the first bus runs (the foxes' village opens: js/opening.js). */
  firstBus() {
    const d = new Date(Opening.at || Date.now());
    return `${d.getMonth() + 1}월 ${d.getDate()}일`;
  },

  /** The stops on the way (the town's first, on the way to the foxes). */
  stops(to) {
    const list = [BUS_STOP_NAME, '단풍 숲길', '반짝 시냇가', FOX_VILLAGE];
    return to === 'town' ? list.reverse() : list;
  },

  /* ----- the ride ----- */

  /** Off she goes: the ride's screen comes over the world she leaves, which is shut under it, and the one she goes to
   *  is opened; when that is ready (and the ride has taken its time) the bus gets there and the screen goes. */
  async go(to) {
    if (this.ov) return;
    if (to === 'fox' && Opening.shut()) {
      // (not before the foxes' village opens — the stop said so: off the bus again)
      if (HouseHost.api) HouseHost.api.townBusBack();
      return void Opening.tell();
    }
    this.to = to;
    this.here = false;
    this.bell = false;
    if (to === 'fox') {
      const t = TownLife.state().town;
      t.rides = (t.rides || 0) + 1;
      Diary.note('busRide');
      Store.save();
    }
    const ov = (this.ov = UI.open(this.html(to), { full: true, noHistory: true, locked: true, cls: 'is-ride', label: `${BUS_ROUTE}번 버스` }));
    ov.panel.addEventListener('click', (e) => e.target.closest('[data-ride-bell]') && this.ring());
    this.hum(true);
    try {
      this.scene(ov);
    } catch (err) {
      console.error('[bus] the ride could not be shown', err);
    }
    // (whatever happens on the way, it gets there: the screen never stays over her world)
    clearTimeout(this.watchdog);
    this.watchdog = setTimeout(() => this.finish(ov), (RIDE_MAX + 8) * 1000);
    await sleep(480); // (until the screen is over all of it)
    if (this.ov !== ov) return;
    this.switching = true;
    try {
      if (to === 'fox') {
        HouseRoom.close();
        FoxRoom.open({ bus: true });
      } else {
        FoxRoom.close();
        HouseRoom.open({ bus: true });
      }
    } finally {
      this.switching = false;
    }
  },

  /** The world it goes to is there (FoxRoom.open, HouseRoom.open — `kind`: which). */
  ready(kind) {
    if (this.ov && kind === this.to) this.here = true;
  },

  /** → a promise: the ride's screen has gone (at once, if there is none). */
  landed() {
    if (!this.ov) return Promise.resolve();
    return new Promise((resolve) => this.landers.push(resolve));
  },

  /** The 하차벨: ding-dong — "정차합니다" lights up (and once it is there, the bus is a little quicker about it). */
  ring() {
    if (this.bell || !this.ov) return;
    this.bell = true;
    Sfx.play('busBell');
    const b = $('[data-ride-bell]', this.ov.panel);
    if (b) b.classList.add('on');
    const led = $('[data-ride-stop]', this.ov.panel);
    if (led) led.hidden = false;
  },

  /* The screen: the sky (the hour's, the weather's), hills, what goes by the window, the road — and the bus on it, her
     in its window; over it the LED of where it goes and the line of its stops, under it what the bus says. */
  html(to) {
    const sky = Moon.now() || {};
    const w = House.weather() || {};
    const cls = [`to-${to}`, sky.dark ? 'is-night' : (sky.gold || 0) > 0.4 ? 'is-dusk' : '', w.kind === 'rain' ? 'is-rain' : w.kind === 'snow' ? 'is-snow' : ''].join(' ');
    const stops = this.stops(to);
    const dest = to === 'fox' ? '여우마을' : '우리동네';
    return `<div class="ride ${cls}" data-ride>
      <div class="ride-sky" aria-hidden="true"><i class="ride-sun"></i><div class="ride-layer" data-ride-layer="far"></div></div>
      <div class="ride-hills" aria-hidden="true"><i data-ride-hills></i></div>
      <div class="ride-layer ride-mid" data-ride-layer="mid" aria-hidden="true"></div>
      <div class="ride-road" aria-hidden="true"><i data-ride-lines></i></div>
      <div class="ride-bus" data-ride-bus aria-hidden="true">${this.busSvg(dest)}</div>
      <div class="ride-layer ride-near" data-ride-layer="near" aria-hidden="true"></div>
      <div class="ride-weather" aria-hidden="true"></div>
      <header class="ride-top">
        <div class="ride-led"><b>${BUS_ROUTE}</b><span>${to === 'fox' ? '🦊' : '🏘️'} ${dest}행</span><em data-ride-stop hidden>정차합니다</em></div>
        <ol class="ride-stops" aria-label="정류장">${stops.map((s, i) => `<li data-ride-at="${i}" class="${i === 0 ? 'past' : ''}"><i></i><span>${esc(s)}</span></li>`).join('')}</ol>
      </header>
      <p class="ride-say" data-ride-say aria-live="polite">${BUS_ROUTE}번 ${dest}행입니다. 출발합니다~ 🚌</p>
      <button class="ride-bell" data-ride-bell aria-label="하차벨 누르기"><span aria-hidden="true">🔔</span><small>하차벨</small></button>
    </div>`;
  },

  /* The bus from the side, going to the right: her in the window by its door, her hair and her skin as she has them. */
  busSvg(dest) {
    const L = Avatar.look3d();
    const skin = L.skin;
    const hair = L.hair.top;
    const tip = L.hair.tip || hair;
    const wheel = (x) => `<g transform="translate(${x} 99)"><g data-ride-wheel><circle r="15" fill="#2a282e"/><circle r="7.5" fill="#dfe2ea"/><rect x="-1.6" y="-13" width="3.2" height="26" rx="1.2" fill="#2a282e"/></g></g>`;
    return `<svg viewBox="0 0 244 118" class="rb-svg">
      <ellipse cx="122" cy="113" rx="104" ry="5" fill="rgba(20, 10, 30, 0.22)"/>
      <rect x="12" y="14" width="214" height="86" rx="18" fill="#3cbf9a"/>
      <path d="M30 14 H208 Q226 14 226 32 V36 H12 V32 Q12 14 30 14 Z" fill="#f4fbf8"/>
      <rect x="12" y="68" width="214" height="8" fill="#fff1b8"/>
      <rect x="24" y="38" width="128" height="26" rx="5" fill="#2c3c4c" class="rb-glass"/>
      <g fill="#eef8f4"><rect x="55" y="37" width="4" height="28"/><rect x="87" y="37" width="4" height="28"/><rect x="119" y="37" width="4" height="28"/></g>
      <g transform="translate(138 55)">
        <path d="M-10 9 Q-11 -9 0 -10 Q11 -9 10 9 Z" fill="${tip}"/>
        <circle r="8.2" cy="-1" fill="${skin}"/>
        <path d="M-8.6 -1.5 Q-9 -10.5 0 -10.6 Q9 -10.5 8.6 -1.5 Q5 -6.5 -1 -5.4 Q-6 -5 -8.6 -1.5 Z" fill="${hair}"/>
        <circle cx="-3" cy="0" r="1.15" fill="#3a2a35"/><circle cx="3.2" cy="0" r="1.15" fill="#3a2a35"/>
        <ellipse cx="-5" cy="2.6" rx="1.8" ry="1" fill="#ff8fb2" opacity="0.55"/><ellipse cx="5.2" cy="2.6" rx="1.8" ry="1" fill="#ff8fb2" opacity="0.55"/>
        <path d="M-1.6 3.3 Q0.2 4.8 1.9 3.3" stroke="#a5435f" stroke-width="0.9" fill="none" stroke-linecap="round"/>
      </g>
      <rect x="158" y="38" width="26" height="58" rx="3" fill="#2a9c7c"/>
      <rect x="161" y="41" width="9" height="52" rx="1.5" fill="#2c3c4c" class="rb-glass"/><rect x="172" y="41" width="9" height="52" rx="1.5" fill="#2c3c4c" class="rb-glass"/>
      <path d="M190 38 H214 Q226 38 226 50 V66 H190 Z" fill="#2c3c4c" class="rb-glass"/>
      <rect x="152" y="18" width="68" height="12" rx="2" fill="#16131a"/>
      <text x="186" y="27.4" text-anchor="middle" font-size="8.5" fill="#ffab2e" font-family="Jua, sans-serif">${BUS_ROUTE} ${dest}</text>
      <text x="82" y="93" font-size="14" fill="#ffffff" font-family="Fredoka, Jua, sans-serif" font-weight="700">${BUS_ROUTE}</text>
      <text x="125" y="93" font-size="12">🦊</text>
      <rect x="218" y="80" width="9" height="9" rx="2.5" fill="#fff6d8" class="rb-lamp"/>
      <rect x="11" y="78" width="5" height="12" rx="2" fill="#ff4b5c"/>
      <path d="M222 22 Q238 16 238 32 V38" stroke="#3b3842" stroke-width="2.6" fill="none" stroke-linecap="round"/>
      <rect x="235" y="36" width="6" height="11" rx="2" fill="#2a282e"/>
      ${wheel(60)}${wheel(186)}
    </svg>`;
  },

  /*
   * The ride, a frame at a time: what goes by the window (each thing on its own, at the speed its distance gives it —
   * from the stretch of the way the bus is on), the wheels, the bus's bounce, the stops passed — until it is there.
   */
  scene(ov) {
    const panel = ov.panel;
    const root = $('[data-ride]', panel);
    const layers = {};
    this.p = 0; // (how far along the way it is: 0 … 1)
    const W = () => root.clientWidth || 360;
    // the things that go by: far (clouds, or the stars), the middle of the view, down by the road
    const make = (name, n, sizes, speed, pick) => {
      const el = $(`[data-ride-layer="${name}"]`, root);
      const items = [];
      for (let i = 0; i < n; i++) {
        const s = document.createElement('span');
        el.appendChild(s);
        const it = { el: s, x: (i / n) * W() * 1.2 + Math.random() * 40, size: sizes[0] + Math.random() * (sizes[1] - sizes[0]) };
        s.style.fontSize = `${it.size}px`;
        s.textContent = pick();
        items.push(it);
      }
      layers[name] = { items, speed, pick };
    };
    const stretch = () => {
      const i = Math.min(3, Math.floor(this.p * 4));
      return BUS_VIEWS[this.to === 'town' ? 3 - i : i];
    };
    const night = root.classList.contains('is-night');
    if (night) make('far', 9, [9, 16], 10, () => '✦');
    else make('far', 5, [26, 40], 14, () => '☁️');
    make('mid', 9, [42, 64], 120, () => pick(stretch().mid));
    make('near', 10, [20, 30], 270, () => pick(stretch().near));
    const hills = $('[data-ride-hills]', root);
    const lines = $('[data-ride-lines]', root);
    const bus = $('[data-ride-bus]', root);
    const wheels = $$('[data-ride-wheel]', root);
    const say = $('[data-ride-say]', root);
    const marks = $$('[data-ride-at]', root);
    const stops = this.stops(this.to);
    let t = 0;
    let speed = 1; // (1: under way; down to 0 as it pulls in)
    let road = 0;
    let turn = 0;
    let told = 0; //   the stops passed, and said
    let end = 0; //    when it got there
    let last = performance.now();
    const tick = (now) => {
      if (this.ov !== ov) return;
      try {
        step(now);
      } catch (err) {
        console.error('[bus] the ride stopped', err);
        this.finish(ov);
      }
    };
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      t += dt;
      // how far along: as quick as the ride takes — but not into the last stretch until that world is ready
      const lost = this.to === 'fox' ? !FoxRoom.ov : !HouseRoom.ov;
      if (t > 1 && lost && !this.here) return void this.finish(ov, true); // (it was shut under the screen: nothing to get to)
      const rate = (this.bell && this.here ? 2.2 : 1) / RIDE_T;
      this.p = Math.min(this.here || t > RIDE_MAX ? 1 : RIDE_WAIT, this.p + rate * dt);
      // the stops on the way: each one said as it is passed — and the last, where it pulls in
      const at = Math.min(stops.length - 1, Math.floor(this.p * (stops.length - 1) + 0.02));
      if (at > told) {
        told = at;
        marks.forEach((m, i) => m.classList.toggle('past', i <= at));
        if (at < stops.length - 1) {
          say.textContent = `이번 정류장은 ${stops[at]}입니다. 다음 정류장은 ${stops[at + 1]}입니다.`;
          Sfx.play('busChime');
        }
      }
      if (this.p >= 1 && !end) {
        end = t;
        say.textContent = `이번 정류장은 ${stops[stops.length - 1]}, ${stops[stops.length - 1]}입니다. ${this.to === 'fox' ? '🦊' : '🏘️'} 내리실 때 조심하세요~`;
        marks.forEach((m) => m.classList.add('past'));
        Sfx.play('busChime');
        this.hum(false);
        setTimeout(() => Sfx.play('busHiss'), 650);
      }
      if (end) speed = Math.max(0, 1 - (t - end) / 0.9);
      const move = speed * dt;
      const w = W();
      for (const name in layers) {
        const L = layers[name];
        for (const it of L.items) {
          it.x -= L.speed * move;
          if (it.x < -it.size * 1.5) {
            // (round again, from the right, as what comes next on the way)
            it.x = w + Math.random() * 80;
            it.el.textContent = L.pick();
          }
          it.el.style.transform = `translateX(${it.x.toFixed(1)}px)`;
        }
      }
      road = (road + 320 * move) % 64;
      lines.style.transform = `translateX(${-road.toFixed(1)}px)`;
      hills.style.transform = `translateX(${(-(t * 22 * (end ? 0 : 1)) % 400).toFixed(1)}px)`;
      turn += 520 * move;
      wheels.forEach((g) => g.setAttribute('transform', `rotate(${turn % 360})`));
      const bob = speed * (Math.sin(t * 11) * 1.4 + Math.sin(t * 4.3) * 0.8);
      bus.style.transform = `translateY(${bob.toFixed(2)}px) rotate(${(-0.35 * speed * Math.sin(t * 2.1)).toFixed(2)}deg)`;
      if (end && t - end > 1.5) return void this.finish(ov);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  /** There: the screen goes — and what waited for it goes on (the girl gets off). */
  finish(ov, lost = false) {
    if (this.ov !== ov) return;
    this.ov = null;
    clearTimeout(this.watchdog);
    this.hum(false);
    UI.close(ov);
    this.landers.splice(0).forEach((done) => done());
    if (lost) return;
    // the foxes' world: she gets off, out of sight, and comes in through the gap in the bushes
    if (this.to === 'fox' && FoxRoom.ov && FoxHost.api && !FoxHost.failed) {
      this.visiting = FoxHost.api.visit(Avatar.look3d());
      setTimeout(() => FoxRoom.ov && Sfx.play('busGo'), 1600); // (the bus goes on, out of sight)
    }
  },

  /* ----- in the foxes' world ----- */

  /** The 3D side: she is in, and has been met ('in'); she is out of the yard and away to the bus ('gone'). */
  visitSaid(what) {
    if (what === 'in') {
      const h = TownLife.state().town;
      if (!h.busTaught) {
        h.busTaught = true;
        Store.save();
        setTimeout(() => FoxRoom.ov && UI.toast(`${josa(Avatar.name(), '이/가')} 버스를 타고 놀러 왔어요! 🚌 버튼을 누르면 동네로 돌아가요`, { icon: '🚌', kind: 'gold', ms: 5200 }), 2600);
      }
      Game.checkAchievements();
      return;
    }
    if (what === 'gone' && this.leaving) {
      clearTimeout(this.leaveTimer);
      this.leaving = false;
      this.visiting = false;
      this.go('town');
    }
  },

  /** She was tapped: a wave, and a word. */
  tapped() {
    Pet.learned();
    if (FoxHost.api && !FoxHost.failed) FoxHost.api.visitHello(this.line('tap'));
  },

  /** 🚌 in the foxes' world: home on the bus — if she came on it, she says goodbye and goes out to it first. */
  leaveFox() {
    if (this.ov || this.leaving || !FoxRoom.ov) return;
    Sfx.play('tap');
    if (this.visiting && FoxHost.api && !FoxHost.failed && FoxHost.api.visitLeave()) {
      this.leaving = true;
      clearTimeout(this.leaveTimer);
      this.leaveTimer = setTimeout(() => this.visitSaid('gone'), 11000); // (should she never get out of the yard)
      return;
    }
    this.visiting = false;
    this.go('town');
  },

  /** The foxes' world was shut (with the girl in it, she has gone home with it). */
  left(kind) {
    if (kind !== 'fox') return;
    this.visiting = false;
    this.leaving = false;
    clearTimeout(this.leaveTimer);
  },

  /* ----- what is said ----- */

  /** Hers, in the foxes' world (`id`: the fox it is about). */
  line(kind, id) {
    const w = Weather.now(FoxHost.scene()).kind;
    const k = kind === 'tap' ? (Pet.mood() === 'sleepy' || Moon.dark() ? (Math.random() < 0.5 ? 'tap_night' : 'tap') : w === 'rain' ? 'tap_rain' : 'tap') : kind;
    const list = BUS_ME_LINES[k] || BUS_ME_LINES[kind];
    if (!list) return '';
    return pick(list)
      .replace(/\{fox\}/g, Pet.nameOf(id || State.pet.species))
      .replace(/\{owner\}/g, OWNER_NAME);
  },

  /** …and Lorelei's to her. */
  ownerLine(kind) {
    const list = BUS_OWNER_LINES[kind];
    if (!list) return '';
    const name = Avatar.name();
    return pick(list)
      .replace(/\{her:([^}]+)\}/g, (m, p) => josa(name, p))
      .replace(/\{her\}/g, name);
  },

  /* ----- the bus's sounds ----- */

  /** Its engine, all the way (a low rumble, a little uneven) — on or off. */
  hum(on) {
    const h = this.humming;
    if (!on) {
      if (!h) return;
      this.humming = null;
      try {
        const t = h.ctx.currentTime;
        h.out.gain.cancelScheduledValues(t);
        h.out.gain.setValueAtTime(h.out.gain.value, t);
        h.out.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
        setTimeout(() => {
          h.nodes.forEach((n) => {
            try {
              n.stop();
            } catch (e) {
              /* ignore */
            }
          });
          h.out.disconnect();
        }, 700);
      } catch (e) {
        /* sound is optional */
      }
      return;
    }
    if (h || !State.settings.soundEnabled || (typeof CoverHost !== 'undefined' && CoverHost.quiet)) return;
    const ctx = AudioSys.resume();
    if (!ctx) return;
    try {
      const out = ctx.createGain();
      out.gain.value = 0.0001;
      out.connect(ctx.destination);
      const len = 2;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buf;
      noise.loop = true;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 180;
      noise.connect(lp);
      lp.connect(out);
      const motor = ctx.createOscillator();
      motor.type = 'sawtooth';
      motor.frequency.value = 46;
      const wob = ctx.createOscillator();
      wob.frequency.value = 0.7;
      const wobGain = ctx.createGain();
      wobGain.gain.value = 3;
      wob.connect(wobGain);
      wobGain.connect(motor.frequency);
      const mg = ctx.createGain();
      mg.gain.value = 0.25;
      const mlp = ctx.createBiquadFilter();
      mlp.type = 'lowpass';
      mlp.frequency.value = 160;
      motor.connect(mlp);
      mlp.connect(mg);
      mg.connect(out);
      noise.start();
      motor.start();
      wob.start();
      out.gain.exponentialRampToValueAtTime(0.09, ctx.currentTime + 0.8);
      this.humming = { ctx, out, nodes: [noise, motor, wob] };
    } catch (e) {
      /* sound is optional */
    }
  },
};
window.BusRide = BusRide;

/* (noise, filtered: the bus's breath — its brakes' hiss, its doors) */
function busNoise(c, o, t, dur, { type = 'highpass', freq = 2000, vol = 0.4, fade = 1 } = {}) {
  const n = c.createBufferSource();
  const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.min(1, i / 600) * Math.pow(1 - i / d.length, fade);
  n.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  const g = c.createGain();
  g.gain.value = vol;
  n.connect(f);
  f.connect(g);
  g.connect(o);
  n.start(t);
}

/* …and its engine for a moment: coming along and slowing down, pulling away. */
function busEngine(c, o, t, dur, from, to, vol) {
  const osc = c.createOscillator();
  const lp = c.createBiquadFilter();
  const g = c.createGain();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.linearRampToValueAtTime(to, t + dur);
  lp.type = 'lowpass';
  lp.frequency.value = 220;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.4);
  g.gain.setValueAtTime(vol, t + dur - 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(lp);
  lp.connect(g);
  g.connect(o);
  osc.start(t);
  osc.stop(t + dur + 0.05);
}

Object.assign(Sfx.sounds, {
  busCome: Object.assign((c, o, t) => busEngine(c, o, t, 3.4, 70, 42, 0.5), { ms: 3800 }),
  busGo: Object.assign((c, o, t) => busEngine(c, o, t, 3.2, 40, 82, 0.5), { ms: 3600 }),
  busHiss: (c, o, t) => busNoise(c, o, t, 0.55, { freq: 2600, vol: 0.5, fade: 2 }),
  busDoor: (c, o, t) => {
    busNoise(c, o, t, 0.4, { freq: 1800, vol: 0.35, fade: 1.5 });
    Sfx.tone(c, o, t + 0.05, 1568, 0.12, { type: 'square', vol: 0.08 });
    Sfx.tone(c, o, t + 0.2, 1568, 0.12, { type: 'square', vol: 0.08 });
  },
  // the 하차벨: ding-dong
  busBell: (c, o, t) => {
    Sfx.tone(c, o, t, 1318.5, 0.5, { type: 'sine', vol: 0.4 });
    Sfx.tone(c, o, t + 0.26, 1046.5, 0.7, { type: 'sine', vol: 0.4 });
  },
  // the chime before the stop is said
  busChime: Object.assign(
    (c, o, t) => [783.99, 987.77, 1174.66, 1567.98].forEach((f, i) => Sfx.tone(c, o, t + i * 0.13, f, 0.5, { type: 'triangle', vol: 0.28 })),
    { ms: 1600 }
  ),
});

Object.assign(Actions, {
  'fox-bus': () => BusRide.leaveFox(),
});
