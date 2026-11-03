'use strict';
/* ==================================================================
   🐈🚌 뭉치, on the bus to the foxes' village.

   At the stop on the street (js/town.js) she can take 뭉치 along: it
   comes trotting down the pavement and gets on ahead of her, it is
   in the bus's window on the ride, and it comes in through the gap
   in the bushes at her heels (js/fox/mungchi.js is what it does
   there). It knows nobody here. A tap on it opens its sheet, and she
   introduces it to the foxes, one at a time and a step a day:

     처음 보는 사이 → 코 인사 → 장난 친구 → 단짝

   The first time it jumps back from the fox's nose; then they touch
   noses and chase round; then it curls up against the fox and they
   sleep side by side — and from then on they do so when they like.
   How far each fox has got is kept in State.house.cat.friends.
   ================================================================== */

/* How far a fox and the cat have got — and what she can do next. */
const CAT_FOX_STEPS = [
  { name: '처음 보는 사이', act: '🐾 인사시키기' },
  { name: '코 인사한 사이', act: '🐾 같이 놀게 하기' },
  { name: '장난 친구', act: '💤 나란히 눕게 하기' },
  { name: '단짝', act: '💤 같이 낮잠' },
];
const CAT_FOX_BEST = CAT_FOX_STEPS.length - 1;
Object.assign(CAT_LINES, {
  village: ['(코를 씰룩씰룩…)', '냐…? (여기가 어디지?)', '(두리번두리번)'],
  startle: ['냥?!', '(화들짝!)', '…!!'],
  fox_tag: ['냥!', '(꼬리를 콕!)', '잡았다냥!'],
  fox_nap: ['골골골…', '(몸을 기대요)', '냐아~'],
  bus_off: ['냐옹!', '(폴짝!)'],
  home_run: ['(먼저 집으로 쪼르르…)', '냐앙~ (집에 가자!)'],
  fox_hello: ['어… 너는 누구야?', '킁킁… 처음 맡는 냄새야!', '하얗고 작다…!'],
  fox_play: ['같이 놀자!', '잡아 봐라~', '여기야 여기!'],
});
Object.assign(TOWN_LINES, {
  bus_cat: ['뭉치야, 먼저 타~ 🐈', '뭉치야 이리 와! 버스 왔어', '천천히 타, 뭉치야~'],
});
Object.assign(BUS_ME_LINES, {
  meet_hello: ['뭉치야, 얘는 {fox}야 😊', '{fox}, 뭉치랑 인사해 볼래?', '무서워하지 마, 친구야 💗'],
  meet_play: ['{fox}랑 놀아 볼래, 뭉치야?', '둘이 벌써 친해졌네? 😊'],
  meet_nap: ['둘이 많이 친해졌다 💗', '쉿… 둘 다 졸린가 봐 🤫'],
  pet_cat: ['뭉치 보들보들해~', '뭉치야, 괜찮아? 💗', '착하다 뭉치~'],
});
BUS_OWNER_LINES.hello_cat = ['어머, {her:아/야}! 뭉치도 데려왔네? 🐈', '뭉치 안녕~ 여우들이랑 잘 지내 보자 💗', '{her:이/가} 고양이 친구도 데려왔다! 🐾'];

const CatTrip = {
  ov: null, // its sheet, while it is open

  state() {
    const c = CatLife.state();
    if (!c.friends) Object.assign(c, { friends: {}, friendDay: {}, trips: 0, rewardDay: '', naps: 0, tripTaught: false });
    return c;
  },

  /** How far it has got with fox `id`. */
  level(id) {
    return this.state().friends[id] || 0;
  },

  /** A kit that grew up is the same fox under another id. */
  renamed(from, to) {
    const c = this.state();
    if (c.friends[from] !== undefined) c.friends[to] = c.friends[from];
    if (c.friendDay[from]) c.friendDay[to] = c.friendDay[from];
    delete c.friends[from];
    delete c.friendDay[from];
  },

  /** Is it here, in the foxes' world (and not on its way out to the bus)? */
  here() {
    return !!(FoxRoom.ov && FoxHost.api && !FoxHost.failed && !BusRide.leaving && FoxHost.api.catHere());
  },

  /** The button that opens its sheet is there for as long as it is. */
  button() {
    const el = FoxRoom.ov && $('[data-fox-cat]', FoxRoom.ov.panel);
    if (el) el.hidden = !this.here();
  },

  /** Off the bus and in, at her heels. */
  arrived() {
    const c = this.state();
    c.trips += 1;
    Diary.note('catTrip');
    Store.save();
    this.button();
    Game.checkAchievements();
    if (c.tripTaught) return;
    c.tripTaught = true;
    setTimeout(() => this.here() && UI.toast(`${CAT_NAME}가 낯설어해요. 🐈 버튼이나 ${CAT_NAME}를 누르면 여우들에게 소개해 줄 수 있어요`, { icon: '🐈', kind: 'gold', ms: 5600 }), 5000);
  },

  /** …and gone (home with her, or the world was shut). */
  left() {
    if (this.ov) UI.close(this.ov);
  },

  /* ----- its sheet ----- */

  sheet() {
    if (!this.here()) return;
    if (this.ov && !this.ov.closed) return this.render();
    Sfx.play('pop');
    Pet.learned();
    const ov = (this.ov = UI.open(`<div class="house-sheet town-sheet cat-sheet" data-cat-trip-sheet></div>`, { cls: 'is-house-sheet is-cat-trip', label: `${CAT_NAME}와 여우들`, onClose: () => (this.ov = null) }));
    ov.panel.addEventListener('click', (e) => {
      const m = e.target.closest('[data-cat-meet]');
      if (m) return this.meet(m.dataset.catMeet);
      if (e.target.closest('[data-cat-pet]')) return this.pet();
      if (e.target.closest('[data-cat-leave]')) UI.close(ov);
    });
    this.render();
    Pet.fillThumbs(ov.panel);
  },

  render() {
    const ov = this.ov;
    if (!ov || ov.closed) return;
    const c = this.state();
    const list = FoxHost.api.catFoxes();
    const today = dateKey();
    const rows = list.map((f) => {
      const n = this.level(f.id);
      const step = CAT_FOX_STEPS[n];
      const done = n < CAT_FOX_BEST && c.friendDay[f.id] === today;
      const why = done ? '내일 또 만나요' : f.asleep ? '쿨쿨 자는 중' : f.ready ? '' : '바쁜 중이에요';
      const hearts = '💗'.repeat(n) + '🤍'.repeat(CAT_FOX_BEST - n);
      return `<li class="cat-friend">
        <span class="fox-avatar is-chip" data-fox-thumb="fox:${esc(f.id)}" aria-hidden="true">${Pet.foxDef(f.id).emoji}</span>
        <div class="cf-who"><b>${esc(Pet.nameOf(f.id))}</b><small>${step.name}</small><i aria-label="친밀도 ${n} / ${CAT_FOX_BEST}">${hearts}</i></div>
        <button class="btn soft" data-cat-meet="${esc(f.id)}" ${why ? 'disabled' : ''}>${why || step.act}</button>
      </li>`;
    });
    const asleep = list.length && list.every((f) => f.asleep);
    const rain = Weather.now(FoxHost.scene()).kind === 'rain';
    const best = list.reduce((m, f) => Math.max(m, this.level(f.id)), 0);
    const hint = !list.length
      ? '마당에 여우가 없어요. 여우가 돌아오면 소개해 줄 수 있어요'
      : asleep
        ? '여우들이 다 자고 있어요. 낮에 다시 오면 소개해 줄 수 있어요 🌙'
        : rain
          ? `${CAT_NAME}가 비를 피해 ${Avatar.name()}의 우산 밑에 있어요. 비가 그치면 소개해 주세요 ☔`
          : best
            ? '여우마다 하루에 한 걸음씩 가까워져요 🐾'
            : `${CAT_NAME}가 아직 낯설어해요. 여우를 한 마리씩 소개해 주세요 🐾`;
    $('[data-cat-trip-sheet]', ov.panel).innerHTML = `<div class="sheet-handle" aria-hidden="true"></div>
      <h2>🐈 ${CAT_NAME}와 여우들</h2>
      <p class="hint">${esc(hint)}</p>
      <ul class="cat-friends">${rows.join('')}</ul>
      <div class="cat-acts"><button class="btn soft" data-cat-pet>✋ ${CAT_NAME} 쓰다듬기</button></div>
      <button class="link-btn store-leave" data-cat-leave>닫기</button>`;
  },

  /** She brings a fox to it. (The sheet goes, so that it can be seen.) */
  meet(id) {
    if (!FoxHost.api || !FoxHost.api.catMeet(id, this.level(id))) return UI.toast('지금은 어려워요. 조금 있다가 다시 해 보세요', { icon: '🐈' });
    Sfx.play('tap');
    if (this.ov) UI.close(this.ov);
  },

  pet() {
    if (!FoxHost.api || !FoxHost.api.catPet()) return UI.toast(`${josa(Avatar.name(), '이/가')} 지금은 바빠요. 조금 있다가 해 주세요 🐈`, { icon: '🐈' });
    Sfx.play('tap');
    if (this.ov) UI.close(this.ov);
  },

  /** How it went (the 3D side says): a step closer, for a fox that has not had its step today. */
  met(id, level, ok) {
    const name = Pet.nameOf(id);
    if (!ok) return void (BusRide.leaving || UI.toast(`${CAT_NAME}와 ${josa(name, '이/가')} 다른 데 정신이 팔렸어요. 다시 소개해 주세요`, { icon: '🐾' }));
    const c = this.state();
    if (level >= CAT_FOX_BEST) {
      c.naps += 1;
      Store.save();
      return UI.toast(`${CAT_NAME}와 ${josa(name, '이/가')} 나란히 잠들었어요 💤`, { icon: '🐈', ms: 3800 });
    }
    if (this.level(id) !== level) return;
    c.friends[id] = level + 1;
    c.friendDay[id] = dateKey();
    Diary.note(level + 1 === CAT_FOX_BEST ? 'catBest' : 'catFox');
    const first = c.rewardDay !== dateKey();
    c.rewardDay = dateKey();
    Store.save();
    if (first) Game.reward({ dopamine: 8, xp: 5, coins: 15 });
    const said = [`${CAT_NAME}와 ${josa(name, '이/가')} 코를 맞댔어요!`, `${CAT_NAME}와 ${josa(name, '이/가')} 장난 친구가 됐어요!`, `${CAT_NAME}와 ${josa(name, '이/가')} 단짝이 됐어요! 나란히 낮잠을 자요`][level];
    Sfx.play(level + 1 === CAT_FOX_BEST ? 'reward' : 'pop');
    if (level + 1 === CAT_FOX_BEST) UI.confetti({ count: 70 });
    UI.toast(`${said}${first ? ' 🪙 +15' : ''}`, { icon: '🐈', kind: level + 1 === CAT_FOX_BEST ? 'gold' : undefined, ms: 4200 });
    Game.checkAchievements();
  },
};
window.CatTrip = CatTrip;

Object.assign(Actions, {
  'fox-cat': () => CatTrip.sheet(),
});
