'use strict';
/* ==================================================================
   🎁 Present — on a day of theirs, Lorelei has something for her.

   The hundredth day: a fox that no shop has — Animud, the little fox
   she made herself (js/fox/animud.js). It comes with the achievement
   "백일" (js/game.js), and it is Lorelei who hands it over, in the
   foxes' world: she calls — a bubble over her head, as ever — and
   then says what she has to say in a window along the bottom of the
   screen (js/talk.js), the way a neighbour does in Animal Crossing.
   At its turn there is a parcel in her hands; she puts it down, and
   out comes the fox.

   Nothing is kept for it that was not kept already: the present is
   still to be given as long as the achievement is hers and the fox
   is not. (A day late, a week late: it waits.)
   ================================================================== */

const PRESENT = { fox: 'animud', day: 100, achievement: 'hundred_days' };

/*
   What Lorelei says. `presentLines` in js/config.js replaces any of these, part by part.
   {days} = which day of theirs it is; {fox} = what the fox is called — {fox:이야/야} with the ending that fits its name.
*/
const PRESENT_LINES = {
  call: ['잠깐만! 줄 게 있어 🎁', '여기야 여기! 줄 게 있어 🎁'], // (over her head, before the window opens)
  hello: ['앗, 왔구나! 기다리고 있었어.'],
  today: ['오늘이 무슨 날인지 알지?', '너희 둘이 만난 지 딱 {days}일째 되는 날이잖아!'], // on the day itself
  late: ['너희 둘이 만난 지 벌써 {days}일째라며?', '100일, 조금 늦었지만 축하해!'], // …or after it
  have: ['그래서 말인데… 너한테 줄 게 있어.'], // (the parcel is in her hands)
  ask: ['뭔지 궁금하지?', '뭔데 뭔데?!', '설마… 선물?'], // a question, and the two things to answer
  answers: ['후후, 기대해도 좋아.', '딩동댕! 눈치 빠르네.'], // …what she says to each
  from: ['사실 이건 네 남자친구가 몰래 부탁한 거야.', '100일 되는 날 꼭 전해 달라고 했거든.'],
  give: ['자, 받아!'], // (she puts it down, and it opens)
  after: [
    '짠! 어디서 많이 본 아이지?',
    '맞아. 네가 만든 그 아이, {fox:이야/야}!',
    '상점에서는 데려올 수 없는, 세상에 딱 한 마리뿐인 여우야.',
    '오늘부터 여기서 같이 살 거니까, 많이 예뻐해 줘 💗',
    '그리고… {days}일 축하해! 앞으로도 여우들이랑 같이 응원할게.',
  ],
};

/*
   Lorelei has the floor. In the foxes' world the buttons make way; she comes to the front and calls — a bubble over
   her head, as ever — and what she has to say comes in the window along the bottom (js/talk.js). It is how she gives
   her present (below) and how she says her first hello (js/meet.js).
*/
const OwnerSays = {
  on: false, //    she has the floor right now
  ov: null, //     …in this opening of the foxes' world
  live: false, //  …which is the 3D one (not the still picture of a device without it)
  ready: null, //  called when she has come forward and waved

  /** Is the foxes' world she began in still open? */
  here() {
    return !!this.ov && FoxRoom.ov === this.ov;
  },

  /* She steps forward and calls `line`. → false if the foxes' world was left meanwhile. */
  async enter(line) {
    this.ov = FoxRoom.ov;
    this.on = true;
    this.live = !!(FoxHost.api && !FoxHost.failed && FoxHost.stage);
    FoxRoom.setPhoto(false);
    if (FoxRoom.tab) FoxRoom.setShop(null);
    Pet.previewing = null;
    Pet.held = null;
    FoxRoom.stageMode(true);
    if (this.live) {
      const came = new Promise((resolve) => (this.ready = resolve));
      FoxHost.api.present('call', line);
      await Promise.race([came, sleep(7000)]);
      if (this.here()) await sleep(500);
    }
    return this.here();
  },

  /* A step of what the 3D side shows meanwhile (js/fox/world.js: present). */
  show(step, arg) {
    if (this.live && this.here() && FoxHost.api && FoxHost.stage) FoxHost.api.present(step, arg);
  },

  /* She has her say. → the answers that were given, or null if she was not heard to the end. */
  async talk(pages) {
    const said = await Talk.run(pages, { who: OWNER_NAME, tint: '#ff7aa8', voice: 1.2, speaking: (on) => this.show('speak', on) });
    return said && this.here() ? said : null;
  },

  /* …and that was it: the buttons are back. */
  leave() {
    this.ready = null;
    this.on = false;
    if (FoxHost.api) FoxHost.api.present('end');
    if (this.here()) {
      FoxRoom.point(null);
      FoxRoom.stageMode(false);
    }
    this.ov = null;
  },

  /* What the 3D side has to tell (js/fox/world.js: present). */
  heard(what) {
    if (what === 'ready' && this.ready) this.ready();
  },

  /* The foxes' world was left while she was coming forward: that is over at once, so that it can begin again next time. */
  left() {
    if (this.ready) this.ready();
  },
};

const Present = {
  playing: false, //    she is being given it right now
  rehearsal: false, //  …or shown how it will be (nothing of it is kept)
  rehearsing: false, // he has asked to be shown (from then until it is over: the real one does not begin meanwhile)
  guest: null, //       a rehearsal: the fox that is in the yard for it, without being hers
  told: null, //        …and the day of theirs it speaks of (otherwise: today's)
  rested: null, //      the fox that went to rest to make room for the new one
  timer: 0,

  /* Which day of theirs the story speaks of. */
  days() {
    return this.told != null ? this.told : Days.count();
  },

  /* Is the day there, or past? (By the calendar, whatever is being rehearsed.) */
  due() {
    const n = Days.count();
    return n != null && n >= PRESENT.day;
  },

  /* Has she got the fox? */
  has() {
    return State.pet.foxes.some((id) => foxKind(id) === PRESENT.fox);
  },

  /* Does Lorelei still have it for her? */
  waiting() {
    return State.onboarded && !!State.achievements[PRESENT.achievement] && !this.has();
  },

  /* The day may have come: the achievement is hers, and the foxes' card on Home says that Lorelei is waiting. */
  wake() {
    if (!State.onboarded || this.has() || !this.due()) return;
    const was = this.waiting();
    Game.checkAchievements();
    if (!was && this.waiting()) {
      Pet.refresh();
      setTimeout(() => !this.playing && this.waiting() && !FoxHost.showing() && UI.toast(`${josa(OWNER_NAME, '이/가')} 줄 게 있대요! 여우 세상으로 가 보세요.`, { icon: '🎁', kind: 'gold', ms: 5200 }), 2600);
    }
  },

  lines(key) {
    const mine = (CFG.presentLines || {})[key];
    const list = mine && mine.length ? [].concat(mine) : PRESENT_LINES[key];
    const name = Pet.foxDef(PRESENT.fox).name;
    const days = fmtNum(this.days() || PRESENT.day);
    return list.map((t) =>
      String(t)
        .replace(/\{days\}/g, days)
        .replace(/\{fox:([^}]+)\}/g, (m, pair) => josa(name, pair))
        .replace(/\{fox\}/g, name)
    );
  },

  /* The story, page by page (js/talk.js), with what the foxes' world is to show at each. */
  pages() {
    const show = (step, arg) => OwnerSays.show(step, arg);
    const L = (key) => this.lines(key);
    const cued = (list, cue) => list.map((text, i) => (i ? text : { text, cue }));
    const [question, ...picks] = L('ask');
    const answers = L('answers');
    return [
      ...L('hello'),
      ...L(this.days() === PRESENT.day ? 'today' : 'late'),
      ...cued(L('have'), () => show('show')),
      picks.length ? { text: question, ask: picks } : question,
      (answer) => answers[answer || 0] || answers[0] || null,
      ...L('from'),
      ...cued(L('give'), () => show('give')),
      { rest: 1700 }, // she puts it down; it stirs
      { rest: 2500, cue: () => this.unwrap() }, // …and there it is
      ...L('after'),
    ];
  },

  /*
     Lorelei gives it to her. (`rehearsal`: only to see how it will be — the fox is a guest for as long as it takes,
     and nothing is saved.) Resolves true when it was told to the end.
  */
  async begin({ rehearsal = false, days = null } = {}) {
    const ov = FoxRoom.ov;
    if (this.playing || OwnerSays.on || Talk.on || !ov || UI.top() !== ov) return false;
    if (!rehearsal && !this.waiting()) return false;
    this.playing = true;
    this.rehearsal = rehearsal;
    this.told = rehearsal ? days : null;
    clearTimeout(this.timer);
    FoxRoom.presentChip();
    let told = false;
    try {
      // she comes to the front and calls; then she has her say
      if (!(await OwnerSays.enter(pick(this.lines('call'))))) return false; // (she left while she was being called: it keeps — see left())
      told = !!(await OwnerSays.talk(this.pages()));
    } finally {
      this.playing = false;
      OwnerSays.leave();
    }
    if (!told || rehearsal) {
      // (a rehearsal leaves nothing behind — nor does a story that was not told to its end)
      const shown = this.guest;
      this.guest = null;
      this.rehearsal = false;
      this.told = null;
      if (shown) Pet.refresh();
      FoxRoom.presentChip();
    }
    if (!told) return false;
    if (rehearsal) {
      UI.toast('여기까지가 미리 보기예요. 아무것도 저장되지 않았어요 — 진짜 선물은 100일째 되는 날에!', { icon: '👀', ms: 5200 });
      return true;
    }
    await this.welcome();
    return true;
  },

  /* The parcel opens: the fox is hers (or, in a rehearsal, there to be looked at). */
  unwrap() {
    const id = PRESENT.fox;
    if (FoxHost.api && FoxHost.stage) FoxHost.api.present('open', id); // (it comes out of the parcel with the sync that follows)
    if (this.rehearsal) this.guest = id;
    else this.give();
    Sfx.play('levelup');
    UI.confetti({ count: 110 });
    Pet.refresh();
  },

  give() {
    const p = State.pet;
    const id = PRESENT.fox;
    if (this.has()) return;
    p.foxes.push(id);
    // room for it in the yard: if they are five already, one of the others goes to rest for now
    this.rested = null;
    if (p.out.length >= MAX_OUT) {
      this.rested = p.out.slice().reverse().find((x) => x !== p.species && !Pet.away(x)) || p.out[p.out.length - 1];
      p.out = p.out.filter((x) => x !== this.rested);
    }
    p.out.push(id);
    p.species = id; // she is with the newcomer now
    p.name = Pet.nameOf(id);
    p.happiness = Math.min(100, p.happiness + 10);
    p.bond += 5;
    Store.saveNow();
  },

  /* It is hers: said once more, with its picture — and then it gets its name. */
  async welcome() {
    const id = PRESENT.fox;
    const def = Pet.foxDef(id);
    const days = this.days();
    Game.checkAchievements();
    FoxRoom.renderShop();
    FoxHost.act('hello', id);
    const url = Pet.snapshot('fox', id, { size: 180, grown: 0 });
    await UI.celebrate({
      emoji: '🎁',
      title: `${OWNER_NAME}의 선물: ${def.name}`,
      subtitle: `우리가 만난 지 ${fmtNum(days || PRESENT.day)}일, 세상에 하나뿐인 여우가 가족이 됐어요.`,
      rare: true,
      extraHtml: `<div class="present-pic"><span class="fox-avatar is-big" aria-hidden="true">${url ? `<img src="${url}" alt="">` : def.emoji}</span></div>
        <p class="cel-note">🏆 업적 ‘백일’의 선물이에요 · 상점에서는 만날 수 없어요</p>`,
      buttons: [{ label: '고마워! 💗', primary: true }],
    });
    if (!this.has()) return;
    const name = await Pet.askName(id, 'new');
    if (State.pet.out.includes(id)) FoxHost.say(Pet.line('newFox'), 2600, id);
    if (this.rested && State.pet.foxes.includes(this.rested)) UI.toast(`마당이 꽉 차서 ${josa(Pet.nameOf(this.rested), '은/는')} 잠깐 쉬러 갔어요. 여우 탭에서 다시 부를 수 있어요.`, { icon: '💤', ms: 4800 });
    else UI.toast(`${josa(name, '이/가')} 우리 집에 왔어요!`, { icon: def.emoji, kind: 'gold', ms: 3400 });
    this.rested = null;
    Pet.wantFace();
    FoxRoom.presentChip();
  },

  /* She has come into the foxes' world: if Lorelei has it for her still, she calls before long. */
  arrive() {
    FoxRoom.presentChip();
    clearTimeout(this.timer);
    if (!this.waiting() || this.rehearsing) return; // (he is looking at how it will be: the real one keeps)
    const ov = FoxRoom.ov;
    const tryIt = () => {
      if (FoxRoom.ov !== ov || !this.waiting()) return;
      // (not over a letter she is reading, the shop, the camera, Lorelei's first hello: when she is back with the foxes)
      if (!this.playing && !OwnerSays.on && UI.top() === ov && !FoxRoom.tab && !FoxRoom.photoOn) return void this.begin();
      this.timer = setTimeout(tryIt, 2000);
    };
    this.timer = setTimeout(tryIt, 1400);
  },

  /* …and has left it. */
  left() {
    clearTimeout(this.timer);
    this.guest = null;
    this.told = null;
    OwnerSays.left(); // (Lorelei was calling her: that is over at once, so that it can begin again when she is back)
  },

  /* The line under the achievement about what comes with it (나 → 업적). */
  reward(got) {
    if (!got) return '특별한 선물이 있어요';
    return this.has() ? `${OWNER_NAME}의 선물: ${Pet.foxDef(PRESENT.fox).name}` : `${josa(OWNER_NAME, '이/가')} 선물을 들고 기다려요`;
  },

  /* For him (나 → 설정 → 메시지 편집): what is planned, and how far off it is. */
  note() {
    const name = Pet.foxDef(PRESENT.fox).name;
    const her = esc(josa(OWNER_NAME, '이/가'));
    const fox = `‘${esc(name)}’${josa(name, '을/를').slice(name.length)}`; // (its name in quotes, and the ending that goes with it)
    if (this.has()) return `‘${esc(name)}’ — 이미 전해졌어요 💗`;
    if (!Days.start) return '<code>js/config.js</code>에 <code>startDate</code>(사귀기 시작한 날)가 없어서, 100일이 언제인지 알 수 없어요.';
    if (this.due()) return `100일이 됐어요. 여우 세상에 들어가면 ${her} 상점에 없는 여우 ${fox} 전해 줘요.`;
    const key = addDays(Days.start, PRESENT.day - 1);
    return `우리가 만난 지 100일째 되는 날(${fmtDay(key)}, ${dLabel(daysBetween(dateKey(), key))})부터, 여우 세상에 들어가면 ${her} 상점에 없는 여우 ${fox} 선물로 줘요. 업적 ‘백일’과 함께예요.`;
  },

  /*
     For trying it out (index.html?debug=1, in the console; or 나 → 설정 → 메시지 편집 → 100일 선물):
       Present.test()        Lorelei gives her present, now — as a rehearsal: nothing is saved
       Present.test(100)     …as it will be on that day of theirs (103: a few days late)
  */
  async test(days = PRESENT.day) {
    this.rehearsing = true;
    try {
      if (!FoxRoom.ov) {
        await FoxRoom.open({ early: true }); // (his to look at, even before the foxes' world has opened for her)
        await sleep(600);
      }
      return await this.begin({ rehearsal: true, days });
    } finally {
      this.rehearsing = false;
    }
  },
};

Object.assign(Actions, {
  'fox-present': () => Present.begin(),
  'present-rehearse': async () => {
    await Router.go('#/home');
    Present.test();
  },
});
