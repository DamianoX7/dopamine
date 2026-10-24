'use strict';
/* ==================================================================
   🎄 Christmas — on Christmas Eve and Christmas Day the foxes' world
   dresses up.

   Both days (and on into the small hours of the next) a tree stands
   at the back of the yard, hung with baubles and wound round with
   lights; the foxes wear Santa hats and reindeer antlers, Lorelei a
   Santa hat and her winter scarf (js/fox/world.js: setChristmas). A
   fox that wears something on its head already keeps it. Where it is
   winter — the meadow and the farm in December — it snows more often
   than not: a white Christmas (js/weather.js). From five in the
   evening the light goes blue and the tree's lights glow.

   And Lorelei has a present for her. She comes to the front and
   calls — a bubble over her head, as ever — and has her say in the
   window along the bottom (js/talk.js): the foxes in their hats, the
   tree, her own hat; then a parcel in red and green, which she puts
   down and which opens; and a wish to make together. At the end there
   is something for her: coins, and the foxes' Santa hat and antlers
   to keep (꾸미기 in the shop), to be worn on any day of the year.
   Once a year — on either of the two days; left in the middle, it
   begins again the next time.
   ================================================================== */

const CHRISTMAS = { days: ['12-24', '12-25'], until: 5, dusk: 17, coins: 150 }; // the days; how late into the next one it lasts; from when it is evening; what she is given
const XMAS_COSTUMES = ['santa', 'antlers']; //                                     what the foxes wear, in turn (js/fox/props.js)

/*
   What Lorelei says. `christmasLines` in js/config.js replaces any of these, part by part.
   {nick} = what she is called; {day} = which day it is (크리스마스이브 or 크리스마스) — {day:이야/야} with the ending that fits.
*/
const CHRISTMAS_LINES = {
  call: ['메리 크리스마스! 🎄', '{nick}! 메리 크리스마스~ 🎅'], // (over her head, before the window opens)
  hello: ['앗, 왔구나! 오늘 무슨 날인지 알지?', '바로 {day:이야/야}! 🎄'],
  costume: ['그래서 여우들도 산타 모자랑 루돌프 뿔로 꾸몄어.', '어때, 진짜 산타 도우미들 같지?'], // (they hop in their hats)
  tree: ['마당에 트리도 세웠어! 여우들이랑 같이 꾸민 거야.', '밤이 되면 불이 반짝반짝 켜져 ✨'], // (its lights flare up)
  hat: ['그리고 나도 산타 모자 써 봤어!'],
  hatAsk: ['잘 어울려?', '완전 산타 같아!', '루돌프 뿔이 더 어울릴걸?'], // a question, and the two things to answer
  hatAnswers: ['헤헤, 오늘만큼은 내가 산타야 🎅', '흥, 그럼 내년엔 루돌프 뿔 써 볼게!'], // …what she says to each
  present: ['산타는 선물을 줘야지! 짜잔 🎁', '자, 열어 봐!'], // (the parcel in her hands; she puts it down, and it opens)
  opened: ['여우들이 쓴 산타 모자랑 루돌프 뿔이야!', '크리스마스가 지나도 상점의 꾸미기에서 언제든 씌워 줄 수 있어.'],
  wishAsk: ['참, 크리스마스엔 소원을 빌어야 해. 너는 무슨 소원 빌래?', '내년에도 같이 크리스마스 보내기', '여우들이랑 오래오래 행복하기', '맛있는 거 잔뜩 먹기'], // the question — and what to answer
  wishAnswers: ['좋은 소원이다! 꼭 이루어질 거야 ⭐', '여우들도 같은 소원일 거야. 그치, 얘들아?', '헤헤, 그건 오늘 바로 이루자! 🍰'], // …what she says to each (stars fall)
  from: ['그리고 네 남자친구가 전해 달래.', '“메리 크리스마스! 올해 크리스마스도 너랑 함께라서 정말 행복해 💗”'],
  bye: ['오늘 밤 따뜻하게 보내. 메리 크리스마스! 🎄'],
};

const Christmas = {
  playing: false, //    Lorelei is giving her present, right now
  rehearsing: false, // he has asked to be shown how it will be (the yard dresses up for it; nothing of it is kept)
  timer: 0,

  /* The Christmas `d` belongs to: its year — or 0, when it is neither Christmas Eve nor Christmas Day. */
  year(d = new Date()) {
    const md = (x) => `${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
    if (CHRISTMAS.days.includes(md(d))) return d.getFullYear();
    const before = new Date(d.getTime() - CHRISTMAS.until * 3600000); // (the small hours belong to the evening before)
    return CHRISTMAS.days.includes(md(before)) ? before.getFullYear() : 0;
  },

  /* Which of the two days it is, as she would say it. */
  day() {
    const d = new Date(Date.now() - CHRISTMAS.until * 3600000);
    return this.year() && d.getMonth() === 11 && d.getDate() === 24 ? '크리스마스이브' : '크리스마스';
  },

  /** Is the foxes' world dressed up? (On the days — or while he is looking at how it will be.) */
  on() {
    return this.rehearsing || !!this.year();
  },

  /** …and is it evening? */
  dusk() {
    const d = new Date();
    return !this.year() || d.getHours() >= CHRISTMAS.dusk || d.getHours() < CHRISTMAS.until;
  },

  /** Does Lorelei have her present still to give this year? (Not before the foxes' world has opened, nor before her first hello.) */
  waiting() {
    const y = this.year();
    return !!y && State.onboarded && State.pet.introduced && !Opening.shut() && State.christmas.year !== y && !Cloud.writer;
  },

  /* The foxes' world as js/pet.js has it (FoxHost.look), dressed for Christmas: for the 3D side. */
  dress(look) {
    if (!this.on()) return look;
    look.christmas = { dusk: this.dusk() };
    let n = 0;
    look.foxes.forEach((f) => {
      if (f.worn.some((id) => HEADWEAR.has(id))) return; // (it has something on its head already: that stays)
      f.worn = f.worn.concat(XMAS_COSTUMES[n++ % XMAS_COSTUMES.length]);
    });
    return look;
  },

  lines(key) {
    const mine = (CFG.christmasLines || {})[key];
    const list = mine && mine.length ? [].concat(mine) : CHRISTMAS_LINES[key];
    const names = { nick: State.user.nickname || '너', day: this.day() };
    return list.map((t) => String(t).replace(/\{(nick|day)(?::([^}]+))?\}/g, (m, who, pair) => (pair ? josa(names[who], pair) : names[who])));
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
    const wishAnswers = L('wishAnswers');
    const [shown, ...given] = L('present');
    return [
      ...L('hello'),
      ...cued(L('costume'), () => show('costume')),
      ...cued(L('tree'), () => show('tree')),
      ...cued(L('hat'), () => show('hat')),
      ask('hatAsk'),
      (answer) => hatAnswers[answer || 0] || hatAnswers[0] || null,
      { text: shown, cue: () => show('show') }, // (the parcel is in her hands)
      ...cued(given, () => show('give')), //       …she puts it down
      { rest: 1500 }, //                            it stirs
      { rest: 2200, cue: () => this.unwrap() }, // …and opens
      ...L('opened'),
      ask('wishAsk'),
      (answer) => {
        const text = wishAnswers[answer || 0] || wishAnswers[0];
        return text ? { text, cue: () => show('wish') } : null;
      },
      ...L('from'),
      ...L('bye').map((text, i, all) => (i === all.length - 1 ? { text, cue: () => show('wave') } : text)),
    ];
  },

  /* The parcel opens: there is nothing in it to come out, only sparkles (and what she is given, at the end). */
  unwrap() {
    if (FoxHost.api && FoxHost.stage) FoxHost.api.present('open', null);
    Sfx.play('levelup');
    UI.confetti({ count: 80 });
  },

  /*
     Lorelei gives her present. (`rehearsal`: only to see how it will be — nothing is kept.) Resolves true when it was
     told to the end.
  */
  async begin({ rehearsal = false } = {}) {
    const ov = FoxRoom.ov;
    if (this.playing || OwnerSays.on || Talk.on || !ov || UI.top() !== ov) return false;
    if (!rehearsal && !this.waiting()) return false;
    if (Chat.calling) Chat.heard('off'); // (she was waiting to say something else: that can wait)
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
      UI.toast('여기까지가 미리 보기예요. 아무것도 저장되지 않았어요 — 진짜는 크리스마스이브와 크리스마스에!', { icon: '👀', ms: 5200 });
      return true;
    }
    await this.give();
    return true;
  },

  /* What she is given: coins, and the Santa hat and the antlers to keep. */
  async give() {
    const p = State.pet;
    State.christmas.year = this.year() || new Date().getFullYear();
    Stars.keep('christmas', State.christmas.year); // (a star of its own in the night sky: js/stars.js)
    XMAS_COSTUMES.forEach((id) => !p.owned.includes(id) && p.owned.push(id));
    Game.reward({ coins: CHRISTMAS.coins });
    Store.saveNow();
    Game.checkAchievements();
    FoxRoom.renderShop();
    FoxRoom.presentChip();
    Pet.refresh();
    FoxHost.act('cheer');
    Sfx.play('levelup');
    UI.confetti({ count: 90 });
    const hats = XMAS_COSTUMES.map((id) => PET_SHOP.find((it) => it.id === id)).filter(Boolean);
    await UI.celebrate({
      emoji: '🎄',
      title: '메리 크리스마스!',
      subtitle: `${josa(OWNER_NAME, '이/가')} 크리스마스 선물을 줬어요.`,
      rewards: { coins: CHRISTMAS.coins },
      extraHtml: `<p class="cel-note">${hats.map((it) => `${it.emoji} ${esc(it.name)}`).join(' · ')} — 상점의 🎀 꾸미기에서 언제든 씌워 줄 수 있어요</p>`,
      buttons: [{ label: '고마워! 🎁', primary: true }],
    });
  },

  /* She has come into the foxes' world: if Lorelei has her present still to give, she calls before long. */
  arrive() {
    clearTimeout(this.timer);
    if (!this.waiting() || this.rehearsing || Present.rehearsing || Meet.rehearsing || Chat.rehearsing || Halloween.rehearsing || Moon.rehearsing) return; // (he is looking at how something will be: the real one keeps)
    const ov = FoxRoom.ov;
    const tryIt = () => {
      if (FoxRoom.ov !== ov || !this.waiting()) return;
      // (not over a letter she is reading, the shop, the camera — nor while the hundredth day's present, or a chat, is still to come)
      if (!this.playing && !OwnerSays.on && !Present.waiting() && !Chat.calling && !Chat.playing && UI.top() === ov && !FoxRoom.tab && !FoxRoom.photoOn && !FoxRoom.gazeOn) return void this.begin();
      this.timer = setTimeout(tryIt, 2000);
    };
    this.timer = setTimeout(tryIt, 2600);
  },

  /* …and has left it. */
  left() {
    clearTimeout(this.timer);
  },

  /* For him (나 → 설정 → 메시지 편집): what it is, and whether she has had it this year. */
  note() {
    const her = esc(josa(OWNER_NAME, '이/가'));
    const y = this.year();
    if (y && State.christmas.year === y) return `올해 크리스마스 선물은 벌써 받았어요 🎄 (이 기기 기준)`;
    return `12월 24일과 25일(다음 날 새벽 ${CHRISTMAS.until}시까지) 마당 뒤쪽에 반짝이는 트리가 서고, 여우들은 산타 모자와 루돌프 뿔을 써요. 겨울인 곳엔 눈이 자주 내리고, 저녁 ${CHRISTMAS.dusk - 12}시부터는 푸른 저녁빛에 트리 불빛이 켜져요. 여우 세상에 들어가면 ${her} 산타 모자를 쓰고 나와 선물 상자를 열어 주고, 같이 소원을 빌어요 — 끝나면 코인 ${CHRISTMAS.coins}개와 산타 모자·루돌프 뿔을 선물로 줘요. (이틀 중 한 번)`;
  },

  /*
     For trying it out (index.html?debug=1, in the console; or 나 → 설정 → 메시지 편집 → 크리스마스):
       Christmas.test()     the yard dresses up and Lorelei gives her present, now — as a rehearsal: nothing is saved.
                            (Where the place follows the year, it is shown in winter, with snow falling.)
  */
  async test() {
    this.rehearsing = true;
    const was = Weather.forced;
    if (!CLIMATES[State.pet.scene]) Weather.forced = { season: 'winter', kind: 'snow', level: 0.55, at: Weather.time() };
    try {
      if (!FoxRoom.ov) {
        await FoxRoom.open({ early: true }); // (his to look at, even before the foxes' world has opened for her)
        await sleep(600);
      }
      FoxRoom.sky();
      FoxHost.sync();
      await sleep(900);
      return await this.begin({ rehearsal: true });
    } finally {
      this.rehearsing = false;
      Weather.forced = was;
      FoxRoom.sky();
      FoxHost.sync();
    }
  },
};

Actions['christmas-rehearse'] = async () => {
  await Router.go('#/home');
  Christmas.test();
};
