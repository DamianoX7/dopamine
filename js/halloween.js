'use strict';
/* ==================================================================
   🎃 Halloween — on the last day of October the foxes' world dresses up.

   All that day (and on into the small hours of the next) the foxes
   wear costumes — a witch's hat, a pumpkin — Lorelei a witch's hat of
   her own, jack-o'-lanterns stand round the yard and bats flit over
   the woods; from five in the evening the light is a sunset's, and
   the lanterns glow (js/fox/world.js: setHalloween). A fox that wears
   something on its head already keeps it: the costume is for the
   others.

   And Lorelei has a game to play: trick or treat. She comes to the
   front and calls — a bubble over her head, as ever — and has her say
   in the window along the bottom (js/talk.js): the foxes in their
   costumes, her hat, and then the question. Sweets, or a trick? Either
   way, at the end there is something for her: coins, and the foxes'
   two hats to keep (꾸미기 in the shop), so that they can be worn on
   any day of the year. Once a year; left in the middle, it begins
   again the next time.

   In 2026 it is the evening the studio and the foxes open (js/opening.js):
   when she comes in, Lorelei first says her hello (js/meet.js) — then
   it is trick or treat.
   ================================================================== */

const HALLOWEEN = { day: '10-31', until: 5, dusk: 17, coins: 100 }; // the day; how late into the next one it lasts; from when it is evening; what she is given
const COSTUMES = ['witch', 'pumpkin']; //                              what the foxes wear, in turn (js/fox/props.js)
const HEADWEAR = new Set(['bow', 'flower', 'crown', 'headphones', 'witch', 'pumpkin']); // what sits on a fox's head: it keeps that on instead

/*
   What Lorelei says. `halloweenLines` in js/config.js replaces any of these, part by part. {nick} = what she is called.
*/
const HALLOWEEN_LINES = {
  call: ['트릭 오어 트릿! 🎃', '해피 핼러윈! 이리 와 봐 🎃'], // (over her head, before the window opens)
  hello: ['앗, 왔구나! 오늘 무슨 날인지 알아?', '바로 핼러윈이야! 🎃'],
  costume: ['그래서 여우들도 다 같이 변장했어.', '마녀 모자에 호박 모자… 어때, 귀엽지?'], // (they hop in their costumes)
  hat: ['그리고 나도 마녀 모자 써 봤어!'],
  hatAsk: ['잘 어울려?', '완전 잘 어울려!', '음… 조금?'], // a question, and the two things to answer
  hatAnswers: ['헤헤, 고마워 💗', '흥, 그래도 오늘은 안 벗을 거야!'], // …what she says to each
  ask: ['그럼 이제… 트릭 오어 트릿! 사탕 줄래, 장난당할래?', '사탕 줄게 🍬', '장난쳐 봐!'], // the question of the day
  treat: ['와아, 사탕이다! 고마워, {nick}!', '여우들아, 하나씩 나눠 먹자~'], // …she gives sweets
  trick: ['좋아, 각오해! 여우들아, 지금이야!', '헤헤, 놀랐지? 장난이야~'], // …or wants the trick
  gift: ['사실 나도 너한테 줄 게 있어.', '여우들이 쓴 모자 두 개, 너 가져! 핼러윈이 지나도 상점의 꾸미기에서 씌워 줄 수 있어.'],
  from: ['그리고 네 남자친구가 전해 달래.', '“해피 핼러윈! 오늘 밤은 마음껏 놀자 💗”'],
  bye: ['그럼 오늘 밤 재밌게 놀자. 해피 핼러윈! 🎃'],
};

const Halloween = {
  playing: false, //    trick or treat, right now
  rehearsing: false, // he has asked to be shown how it will be (the yard dresses up for it; nothing of it is kept)
  timer: 0,

  /* The Halloween `d` belongs to: its year — or 0, when it is not Halloween. */
  year(d = new Date()) {
    const md = `${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
    if (md === HALLOWEEN.day) return d.getFullYear();
    const before = new Date(d.getTime() - HALLOWEEN.until * 3600000); // (the small hours belong to the evening before)
    return `${pad2(before.getMonth() + 1)}-${pad2(before.getDate())}` === HALLOWEEN.day ? before.getFullYear() : 0;
  },

  /** Is the foxes' world dressed up? (On the day — or while he is looking at how it will be.) */
  on() {
    return this.rehearsing || !!this.year();
  },

  /** …and is it the evening of it? */
  dusk() {
    const d = new Date();
    return !this.year() || d.getHours() >= HALLOWEEN.dusk || d.getHours() < HALLOWEEN.until;
  },

  /** Does Lorelei have her game still to play this year? (Not before the foxes' world has opened, nor before her first hello.) */
  waiting() {
    const y = this.year();
    return !!y && State.onboarded && State.pet.introduced && !Opening.shut() && State.halloween.year !== y && !Cloud.writer;
  },

  /* The foxes' world as js/pet.js has it (FoxHost.look), in costume: for the 3D side. */
  dress(look) {
    if (!this.on()) return look;
    look.halloween = { dusk: this.dusk() };
    let n = 0;
    look.foxes.forEach((f) => {
      if (f.worn.some((id) => HEADWEAR.has(id))) return; // (it has something on its head already: that stays)
      f.worn = f.worn.concat(COSTUMES[n++ % COSTUMES.length]);
    });
    return look;
  },

  lines(key) {
    const mine = (CFG.halloweenLines || {})[key];
    const list = mine && mine.length ? [].concat(mine) : HALLOWEEN_LINES[key];
    const nick = State.user.nickname || '너';
    return list.map((t) => String(t).replace(/\{nick(?::([^}]+))?\}/g, (m, pair) => (pair ? josa(nick, pair) : nick)));
  },

  /* The story, page by page (js/talk.js), with what the foxes' world is to show at each. */
  pages() {
    const show = (step) => OwnerSays.show(step);
    const L = (key) => this.lines(key);
    const cued = (list, cue) => list.map((text, i) => (i ? text : { text, cue }));
    const ask = (key) => {
      const [question, ...picks] = L(key);
      return picks.length ? { text: question, ask: picks } : question;
    };
    const hatAnswers = L('hatAnswers');
    // (sweets — the first answer — or the trick: what follows the question goes by it)
    const by = (pick, key, step) => cued(L(key), () => show(step)).map((page) => (answer) => ((answer || 0) === pick ? page : null));
    return [
      ...L('hello'),
      ...cued(L('costume'), () => show('costume')),
      ...cued(L('hat'), () => show('hat')),
      ask('hatAsk'),
      (answer) => hatAnswers[answer || 0] || hatAnswers[0] || null,
      ask('ask'),
      ...by(0, 'treat', 'treat'),
      ...by(1, 'trick', 'trick'),
      ...L('gift'),
      ...L('from'),
      ...L('bye').map((text, i, all) => (i === all.length - 1 ? { text, cue: () => show('wave') } : text)),
    ];
  },

  /*
     Trick or treat. (`rehearsal`: only to see how it will be — nothing is kept.) Resolves true when it was told to
     the end.
  */
  async begin({ rehearsal = false } = {}) {
    const ov = FoxRoom.ov;
    if (this.playing || OwnerSays.on || Talk.on || !ov || UI.top() !== ov) return false;
    if (!rehearsal && !this.waiting()) return false;
    this.playing = true;
    clearTimeout(this.timer);
    FoxRoom.presentChip();
    let told = false;
    try {
      if (!(await OwnerSays.enter(pick(this.lines('call'))))) return false;
      told = !!(await OwnerSays.talk(this.pages()));
    } finally {
      this.playing = false;
      OwnerSays.leave();
      FoxRoom.presentChip();
    }
    if (!told) return false;
    if (rehearsal) {
      UI.toast('여기까지가 미리 보기예요. 아무것도 저장되지 않았어요 — 진짜는 10월 31일 핼러윈에!', { icon: '👀', ms: 5200 });
      return true;
    }
    await this.give();
    return true;
  },

  /* What she is given: coins, and the two hats to keep. */
  async give() {
    const p = State.pet;
    State.halloween.year = this.year() || new Date().getFullYear();
    COSTUMES.forEach((id) => !p.owned.includes(id) && p.owned.push(id));
    Game.reward({ coins: HALLOWEEN.coins });
    Store.saveNow();
    Game.checkAchievements();
    FoxRoom.renderShop();
    FoxRoom.presentChip();
    Pet.refresh();
    FoxHost.act('cheer');
    Sfx.play('levelup');
    UI.confetti({ count: 90 });
    const hats = COSTUMES.map((id) => PET_SHOP.find((it) => it.id === id)).filter(Boolean);
    await UI.celebrate({
      emoji: '🎃',
      title: '해피 핼러윈!',
      subtitle: `${josa(OWNER_NAME, '이/가')} 핼러윈 선물을 줬어요.`,
      rewards: { coins: HALLOWEEN.coins },
      extraHtml: `<p class="cel-note">${hats.map((it) => `${it.emoji} ${esc(it.name)}`).join(' · ')} — 상점의 🎀 꾸미기에서 언제든 씌워 줄 수 있어요</p>`,
      buttons: [{ label: '고마워! 🍬', primary: true }],
    });
  },

  /* She has come into the foxes' world: if Lorelei has her game still to play, she calls before long. */
  arrive() {
    clearTimeout(this.timer);
    if (!this.waiting() || this.rehearsing || Present.rehearsing || Meet.rehearsing) return; // (he is looking at how something will be: the real one keeps)
    const ov = FoxRoom.ov;
    const tryIt = () => {
      if (FoxRoom.ov !== ov || !this.waiting()) return;
      // (not over a letter she is reading, the shop, the camera — nor while the hundredth day's present is still to come)
      if (!this.playing && !OwnerSays.on && !Present.waiting() && UI.top() === ov && !FoxRoom.tab && !FoxRoom.photoOn) return void this.begin();
      this.timer = setTimeout(tryIt, 2000);
    };
    this.timer = setTimeout(tryIt, 2600);
  },

  /* …and has left it. */
  left() {
    clearTimeout(this.timer);
  },

  /* For him (나 → 설정 → 메시지 편집): what it is, and whether she has played it this year. */
  note() {
    const her = esc(josa(OWNER_NAME, '이/가'));
    const y = this.year();
    if (y && State.halloween.year === y) return `올해 핼러윈 놀이는 벌써 했어요 🎃 (이 기기 기준)`;
    return `10월 31일 하루 동안(다음 날 새벽 ${HALLOWEEN.until}시까지) 여우들은 마녀 모자와 호박 모자로 변장하고, 마당에는 호박 등불이, 숲 위로는 박쥐가 날아요. 저녁 ${HALLOWEEN.dusk - 12}시부터는 노을빛이 되고 등불이 켜져요. 여우 세상에 들어가면 ${her} 마녀 모자를 쓰고 나와 “트릭 오어 트릿!”을 해요 — 끝나면 코인 ${HALLOWEEN.coins}개와 여우 모자 두 개를 선물로 줘요.`;
  },

  /*
     For trying it out (index.html?debug=1, in the console; or 나 → 설정 → 메시지 편집 → 핼러윈):
       Halloween.test()     the yard dresses up and Lorelei plays trick or treat, now — as a rehearsal: nothing is saved
  */
  async test() {
    this.rehearsing = true;
    try {
      if (!FoxRoom.ov) {
        await FoxRoom.open({ early: true }); // (his to look at, even before the foxes' world has opened for her)
        await sleep(600);
      }
      FoxHost.sync();
      await sleep(900);
      return await this.begin({ rehearsal: true });
    } finally {
      this.rehearsing = false;
      FoxHost.sync();
    }
  },
};

Actions['halloween-rehearse'] = async () => {
  await Router.go('#/home');
  Halloween.test();
};
