'use strict';
/* ==================================================================
   🐈 뭉치 — the white stray of 우리 동네, made after her own cat.

   Now and then (not often) it is out on the street when she goes out:
   on a bench, by the store's door, under the big tree, by her gate. A
   meow, and there it is. At first it is wary of her — ears back,
   crouched. A churu from the store (🐾 고양이 tab) wins it round a
   little; once it lets her, she can stroke it. Met again another day,
   it knows her — and when it trusts her enough she can take it home:
   it follows her to her door and in, and from then on it lives in 둘의
   집 with her (js/house/cat.js: what it does there).
   ================================================================== */

const CAT_NAME = '뭉치';
const CAT_FULL = 5; //   how far it can come to trust her
const CAT_PET_AT = 2; // …far enough to let her stroke it
const CAT_HOME_AT = 4; // …far enough to go home with her
/* What it says (in its bubble). */
const CAT_LINES = {
  meow: ['냐옹~', '냥!', '미야옹…'],
  hi: ['냐아~', '냥냥!', '(꼬리를 바짝 세웠어요)'],
  rub: ['골골골…', '냐아앙~', '(다리에 몸을 비벼요)'],
  purr: ['골골골골…', '그르릉~', '(눈을 지그시 감았어요)'],
  wary: ['…!', '(귀를 젖히고 쳐다봐요)', '…?'],
  eat: ['할짝할짝…', '냠냠냠 🐟', '(츄르를 핥아요)'],
  yes: ['냐옹!', '(꼬리를 세우고 따라와요)'],
  new_home: ['냐아… (새 집이다!)', '(두리번두리번)'],
  welcome: ['냐앙~ (어서 와!)', '냥냥!'],
};
/* …and what she says to it (the town's lines: js/town.js meLine). */
Object.assign(TOWN_LINES, {
  cat_noticed: ['어? 어디서 고양이 소리 나는데…? 🐈', '냐옹…? 고양이다!'],
  cat_spot: ['안녕… 하얀 고양이네? 🐈', '무서워하지 마~ 괜찮아'],
  cat_hi: ['뭉치야~ 또 만났네! 💗', '뭉치야 안녕~'],
  cat_feed: ['츄르 먹을래? 🐟', '자, 맛있는 거야~'],
  cat_pet: ['보들보들해… 💗', '착하다 뭉치~', '골골송 들린다 😊'],
  cat_adopt: ['뭉치야, 우리 집에 가자! 🏠', '이제 우리 같이 살자 💗'],
});
CLERK_LINES.tap.push('요즘 하얀 길고양이가 동네에 가끔 보여요 🐈');
/* (on the store's shelves: what it likes best) */
STORE_ITEMS.push({ id: 'churu', kind: 'cat', emoji: '🐟', name: '고양이 츄르', price: 6, desc: '길고양이도 좋아하는 간식' });

const CatLife = {
  here: false, //    it is out on the street this time
  enc: null, //      …and what has happened between them this time: { fed, petted, met }
  ov: null, //       its sheet, while it is open
  force: false, //   (he wants it out there next time: CatLife.test())

  state() {
    const h = State.house;
    if (!h.cat || typeof h.cat !== 'object') h.cat = { trust: 0, meets: 0, adopted: false, at: null, miss: 0, fed: 0, pets: 0 };
    return h.cat;
  },
  adopted() {
    return !!this.state().adopted;
  },
  /** Has she met it (the store keeps churu for it from then on)? */
  known() {
    return this.state().meets > 0 || this.adopted();
  },
  churu() {
    return TownLife.have('churu');
  },

  /* ----- out of the door: is it out there this time? ----- */

  /** She has gone out (js/town.js wentOut). Not often: a fifth of the time or so, more the longer it has been. */
  outing() {
    const c = this.state();
    this.here = false;
    this.enc = null;
    if (c.adopted || !HouseHost.api) return;
    const chance = Math.min(0.7, (c.meets ? 0.25 : 0.2) + 0.1 * (c.miss || 0));
    if (!this.force && Math.random() >= chance) {
      c.miss = (c.miss || 0) + 1;
      Store.save();
      return;
    }
    this.force = false;
    c.miss = 0;
    Store.save();
    if (!HouseHost.api.townCat(Math.floor(Math.random() * 6), c.trust)) return;
    this.here = true;
    this.enc = { fed: false, petted: false, met: false };
    // a meow, to be found by
    setTimeout(() => {
      if (!this.here || !TownLife.out || !HouseHost.api) return;
      HouseHost.api.townCatCall();
      setTimeout(() => this.here && TownLife.out && HouseHost.api && HouseHost.api.townSay('cat_noticed'), 900);
      UI.toast('어디선가 냐옹 소리가 들려요… 🐈', { icon: '🐾', ms: 3600 });
    }, 4200);
  },

  /** She is home again (or the house was shut): it stays out there. */
  left() {
    this.here = false;
    this.enc = null;
    if (this.ov) UI.close(this.ov);
  },

  /* ----- a tap on it ----- */

  tapped() {
    const api = HouseHost.api;
    if (!api) return;
    if (this.adopted() && !TownLife.out) {
      if (!api.catPet()) UI.toast(`${josa(Avatar.name(), '이/가')} 지금은 바빠요. 조금 있다가 쓰다듬어요 🐈`, { icon: '🐈' });
      return;
    }
    if (!this.here || !TownLife.out) return;
    if (api.townBusy()) return UI.toast(TownLife.busyText(), { icon: '⏳' });
    TownLife.closeSheets();
    if (!api.townCatGo()) return;
    TownLife.place = 'cat';
    TownLife.hud();
  },

  /** What the 3D side says: she is down by it ('catNear'), it has eaten the churu ('catFed'), been stroked ('catPetted'),
   *  come in at her door with her ('home'). */
  said(what) {
    if (what === 'catNear') return this.near();
    if (what === 'catFed') return this.fed();
    if (what === 'catPetted') return this.petted();
    if (what === 'home') return this.home();
  },

  near() {
    const c = this.state();
    if (this.enc && !this.enc.met) {
      this.enc.met = true;
      c.meets = (c.meets || 0) + 1;
      Diary.note('catMeet');
      Store.save();
      Game.checkAchievements();
    }
    this.sheet();
  },

  /* ----- its sheet: how it is with her, and what she can do ----- */

  sheet() {
    if (this.ov && !this.ov.closed) return this.render();
    Sfx.play('pop');
    TownLife.closeSheets();
    const ov = (this.ov = TownLife.sheet(`<div class="house-sheet town-sheet cat-sheet" data-cat-sheet></div>`, CAT_NAME));
    ov.opts.onClose = () => {
      this.ov = null;
      requestAnimationFrame(() => HouseRoom.inset());
      // (she gets up and leaves it be — unless she is taking it home)
      if (!this.going && TownLife.out && TownLife.place === 'cat') TownLife.go('street');
      this.going = false;
    };
    ov.panel.addEventListener('click', (e) => {
      if (e.target.closest('[data-cat-feed]')) return this.feed();
      if (e.target.closest('[data-cat-store]')) {
        UI.close(ov);
        return TownLife.go('store');
      }
      if (e.target.closest('[data-cat-pet]')) return this.pet();
      if (e.target.closest('[data-cat-home]')) return this.adopt();
      if (e.target.closest('[data-cat-leave]')) UI.close(ov);
    });
    this.render();
  },

  render() {
    const ov = this.ov;
    if (!ov || ov.closed) return;
    const root = $('[data-cat-sheet]', ov.panel);
    const c = this.state();
    const e = this.enc || {};
    const busy = HouseHost.api && HouseHost.api.townBusy();
    const hearts = '💗'.repeat(c.trust) + '🤍'.repeat(CAT_FULL - c.trust);
    const first = c.meets <= 1 && c.trust < 2;
    const n = this.churu();
    const hint =
      c.trust >= CAT_HOME_AT
        ? `${CAT_NAME}가 ${josa(Avatar.name(), '을/를')} 많이 좋아해요. 둘의 집 가족으로 맞을 수 있어요 🏠`
        : e.fed && c.trust >= CAT_PET_AT && !e.petted
          ? '츄르를 맛있게 먹었어요! 이제 쓰다듬어도 괜찮대요 ✋'
          : e.fed || e.petted
            ? '오늘은 이만큼 친해졌어요. 다음에 또 만나면 더 가까워질 거예요 🐾'
            : c.trust < CAT_PET_AT
              ? '아직 경계하고 있어요. 츄르를 주면 마음을 열지도 몰라요 🐟'
              : `${CAT_NAME}가 ${josa(Avatar.name(), '을/를')} 알아보고 꼬리를 세웠어요!`;
    root.innerHTML = `<div class="sheet-handle" aria-hidden="true"></div>
      <h2>🐈 ${first ? '하얀 길고양이' : `길고양이 ${CAT_NAME}`}</h2>
      ${first ? `<p class="cat-name-note">동네 사람들은 ‘${CAT_NAME}’라고 불러요</p>` : ''}
      <div class="cat-trust" aria-label="친밀도 ${c.trust} / ${CAT_FULL}"><span>친밀도</span><b aria-hidden="true">${hearts}</b></div>
      <p class="hint">${esc(hint)}</p>
      <div class="cat-acts">
        ${
          n
            ? `<button class="btn soft" data-cat-feed ${e.fed || busy ? 'disabled' : ''}>🐟 츄르 주기 <small>${e.fed ? '배불러요' : `${n}개`}</small></button>`
            : `<button class="btn soft" data-cat-store>🏪 츄르 사 오기 <small>편의점</small></button>`
        }
        <button class="btn soft" data-cat-pet ${c.trust < CAT_PET_AT || busy ? 'disabled' : ''}>✋ 쓰다듬기${c.trust < CAT_PET_AT ? ' <small>아직 무서워해요</small>' : ''}</button>
        ${c.trust >= CAT_HOME_AT ? `<button class="btn primary" data-cat-home ${busy ? 'disabled' : ''}>🏠 우리 집에 데려가기</button>` : ''}
      </div>
      <button class="link-btn store-leave" data-cat-leave>👋 이제 갈게</button>`;
  },

  /** 🐟: a churu out of the fridge (she bought it at the store) — she holds it out, it licks it up. */
  feed() {
    const api = HouseHost.api;
    const e = this.enc;
    if (!api || !e || e.fed || !this.churu()) return;
    if (!api.townCatFeed()) return UI.toast(TownLife.busyText(), { icon: '⏳' });
    const h = TownLife.state();
    h.pantry.churu -= 1;
    if (!h.pantry.churu) delete h.pantry.churu;
    Store.save();
    Sfx.play('tap');
    this.render();
  },

  fed() {
    const c = this.state();
    if (this.enc && !this.enc.fed) {
      this.enc.fed = true;
      c.trust = Math.min(CAT_FULL, c.trust + 2);
      c.fed = (c.fed || 0) + 1;
      Store.save();
      if (HouseHost.api) HouseHost.api.townCatTrust(c.trust);
      UI.toast(`${CAT_NAME}가 츄르를 다 먹었어요! 💗 친밀도가 올랐어요`, { icon: '🐟' });
    }
    this.render();
  },

  /** ✋: she strokes it (it lets her, once it trusts her a little). */
  pet() {
    const api = HouseHost.api;
    const c = this.state();
    if (!api || !this.enc || c.trust < CAT_PET_AT) return;
    if (!api.townCatPet()) return UI.toast(TownLife.busyText(), { icon: '⏳' });
    this.render();
  },

  petted() {
    const c = this.state();
    c.pets = (c.pets || 0) + 1;
    if (this.enc && !this.enc.petted) {
      this.enc.petted = true;
      c.trust = Math.min(CAT_FULL, c.trust + 1);
      if (HouseHost.api) HouseHost.api.townCatTrust(c.trust);
      if (c.trust >= CAT_HOME_AT) setTimeout(() => UI.toast(`${CAT_NAME}가 ${josa(Avatar.name(), '을/를')} 가족처럼 믿게 됐어요 🏠`, { icon: '🐈', kind: 'gold', ms: 4200 }), 400);
    }
    Store.save();
    this.render();
  },

  /** 🏠: home with her — it follows her to her door and in. */
  async adopt() {
    const c = this.state();
    if (c.trust < CAT_HOME_AT || !HouseHost.api) return;
    const ok = await UI.confirm({ icon: '🐈', title: `${CAT_NAME}를 가족으로 맞을까요?`, text: `${CAT_NAME}가 ${josa(Avatar.name(), '을/를')} 따라 둘의 집에 가서 함께 살아요.`, ok: '🏠 데려가기', cancel: '조금 더 생각할래요' });
    if (!ok || !this.here || !TownLife.out) return;
    this.going = true;
    if (this.ov) UI.close(this.ov);
    if (!HouseHost.api.townCatAdopt()) {
      this.going = false;
      return UI.toast('지금은 데려갈 수 없어요. 잠깐 뒤에 다시 해 보세요', { icon: '🐈' });
    }
    c.adopted = true;
    c.at = Date.now();
    this.here = false;
    Store.save();
    TownLife.place = 'street';
    TownLife.hud();
  },

  /** In at her door with her: its new home. */
  home() {
    Diary.note('catHome');
    Sfx.play('reward');
    UI.confetti({ count: 70 });
    UI.toast(`${CAT_NAME}가 둘의 집 가족이 됐어요! 🐈 눌러서 쓰다듬어 줄 수 있어요`, { icon: '🏠', kind: 'gold', ms: 5200 });
    HouseHost.sync();
    Game.checkAchievements();
  },

  /* ----- what is said ----- */

  line(kind) {
    const list = CAT_LINES[kind];
    return list && list.length ? pick(list) : '';
  },

  /** (For trying it out — index.html?debug=1: it is out on the street the next time she goes out.) */
  test() {
    this.force = true;
    return '다음에 동네에 나가면 뭉치가 있어요';
  },
};
window.CatLife = CatLife;

/* Its voice: a meow (up and down, through an "ee"–"ow" of a mouth), and a purr. */
Object.assign(Sfx.sounds, {
  meow: (c, o, t) => {
    const src = c.createOscillator();
    const src2 = c.createOscillator();
    const f = c.createBiquadFilter();
    const g = c.createGain();
    src.type = 'sawtooth';
    src2.type = 'triangle';
    for (const s of [src, src2]) {
      s.frequency.setValueAtTime(560, t);
      s.frequency.linearRampToValueAtTime(860, t + 0.16);
      s.frequency.linearRampToValueAtTime(700, t + 0.34);
      s.frequency.exponentialRampToValueAtTime(430, t + 0.55);
    }
    f.type = 'bandpass';
    f.Q.value = 3;
    f.frequency.setValueAtTime(2400, t);
    f.frequency.linearRampToValueAtTime(1500, t + 0.3);
    f.frequency.linearRampToValueAtTime(900, t + 0.55);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.05);
    g.gain.setValueAtTime(0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    src.connect(f);
    src2.connect(f);
    f.connect(g);
    g.connect(o);
    src.start(t);
    src2.start(t);
    src.stop(t + 0.62);
    src2.stop(t + 0.62);
  },
  purr: Object.assign(
    (c, o, t) => {
      const len = 1.8;
      const n = c.createBufferSource();
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) {
        const s = i / c.sampleRate;
        d[i] = (Math.random() * 2 - 1) * (0.55 + 0.45 * Math.sin(s * Math.PI * 2 * 24)) * Math.min(1, s * 4) * Math.min(1, (len - s) * 3);
      }
      n.buffer = buf;
      const f = c.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = 260;
      const g = c.createGain();
      g.gain.value = 0.9;
      n.connect(f);
      f.connect(g);
      g.connect(o);
      n.start(t);
    },
    { ms: 2200 }
  ),
});

