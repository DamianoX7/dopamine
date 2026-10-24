'use strict';
/* ==================================================================
   🙋‍♀️ 나 — the girl who lives in 둘의 집: her, as she makes herself.

   She has a name (hers to give: at first, her nickname), a face — her
   skin, the colour and the shape of her eyes — her hair, done as she
   likes and in any colour, and clothes: a top, a skirt or trousers,
   socks, shoes, something in her hair, glasses, a scarf. Her face and
   her hair are hers to change as often as she likes; some clothes she
   has from the start, the rest she buys with her coins (a colour for
   them is free). What she tries on in the shop shows on her at once,
   and goes again unless she buys it.

   The 3D side builds her (js/house/me.js) from what Avatar.look3d()
   says: every colour worked out. What she is wearing is kept in
   State.house.me; and through the day she lives in the house
   (js/house/resident.js), and says a word now and then — to herself.
   ================================================================== */

const AVATAR_SKINS = [
  { id: 'porcelain', name: '뽀얀', hex: '#fdeae2' },
  { id: 'fair', name: '밝은', hex: '#fde3d6' },
  { id: 'warm', name: '따뜻한', hex: '#f6d2ba' },
  { id: 'tan', name: '건강한', hex: '#e4b694' },
];
const AVATAR_EYES = [
  { id: 'brown', name: '갈색', hex: '#7a5c55' },
  { id: 'dark', name: '흑갈색', hex: '#4e3c3e' },
  { id: 'hazel', name: '헤이즐', hex: '#9a7a4a' },
  { id: 'blue', name: '파랑', hex: '#5a7fc0' },
  { id: 'green', name: '초록', hex: '#5c9a6a' },
  { id: 'violet', name: '보라', hex: '#8a6ac0' },
  { id: 'pink', name: '핑크', hex: '#c46f92' },
  { id: 'gray', name: '회색', hex: '#7a8090' },
];
const AVATAR_SHAPES = [
  { id: 'round', name: '동글동글', emoji: '👀' },
  { id: 'soft', name: '순한 눈', emoji: '🥺' },
  { id: 'cat', name: '고양이 눈', emoji: '😼' },
];
const AVATAR_STYLES = [
  { id: 'long', name: '긴 생머리', emoji: '💁‍♀️' },
  { id: 'bob', name: '단발', emoji: '👧' },
  { id: 'pony', name: '포니테일', emoji: '🎀' },
  { id: 'twin', name: '양갈래', emoji: '🐰' },
  { id: 'bun', name: '똥머리', emoji: '🍡' },
];
const AVATAR_BANGS = [
  { id: 'full', name: '일자 앞머리', emoji: '🙂' },
  { id: 'side', name: '옆으로 넘긴', emoji: '😊' },
  { id: 'part', name: '가르마', emoji: '😌' },
];
/* (two colours: from the top of her head to its ends — the same, or another) */
const AVATAR_HAIR = [
  { id: 'black', name: '흑발', top: '#4d4249', tip: '#4d4249' },
  { id: 'choco', name: '초코 브라운', top: '#6b4a3a', tip: '#7a5442' },
  { id: 'brown', name: '밀크 브라운', top: '#9a6e55', tip: '#a87a5e' },
  { id: 'tea', name: '밀크티', top: '#c9a283', tip: '#d8b597' },
  { id: 'blonde', name: '버터 블론드', top: '#f0d9a0', tip: '#f6e5b8' },
  { id: 'ash', name: '애쉬 그레이', top: '#a8a2aa', tip: '#bcb6be' },
  { id: 'pink', name: '체리 핑크', top: '#f2a0b5', tip: '#f7b9c8' },
  { id: 'red', name: '와인 레드', top: '#9a3e4e', tip: '#b2505f' },
  { id: 'lavender', name: '라벤더', top: '#b9a3e0', tip: '#cdbbef' },
  { id: 'mint', name: '민트', top: '#9fd6c4', tip: '#b9e6d6' },
  { id: 'sky', name: '하늘 → 핑크', top: '#a9c8f0', tip: '#f2b6d0' },
  { id: 'peach', name: '복숭아 → 노을', top: '#ffd2b8', tip: '#ff9f8a' },
];
const AVATAR_COLORS = [
  { id: 'white', name: '하양', hex: '#ffffff' },
  { id: 'cream', name: '크림', hex: '#f6e7d4' },
  { id: 'pink', name: '연분홍', hex: '#ffcadb' },
  { id: 'strawberry', name: '딸기', hex: '#ff8fb2' },
  { id: 'red', name: '빨강', hex: '#e8566e' },
  { id: 'yellow', name: '노랑', hex: '#ffe08a' },
  { id: 'mint', name: '민트', hex: '#a8e0c4' },
  { id: 'green', name: '초록', hex: '#7cba7c' },
  { id: 'sky', name: '하늘', hex: '#a9d0f5' },
  { id: 'denim', name: '청', hex: '#6a86b8' },
  { id: 'navy', name: '남색', hex: '#56608f' },
  { id: 'lavender', name: '라벤더', hex: '#c9b6ff' },
  { id: 'brown', name: '갈색', hex: '#9a6e55' },
  { id: 'black', name: '검정', hex: '#4c4450' },
];
/* checked skirts: the colour of the squares, the bands and the thread through them */
const AVATAR_CHECKS = [
  { id: 'check-beige', name: '베이지 체크', hex: '#e8d3b0', band: '#a8805a', line: '#f6ead8' },
  { id: 'check-navy', name: '남색 체크', hex: '#5a6490', band: '#39406a', line: '#d8dcf0' },
  { id: 'check-pink', name: '분홍 체크', hex: '#ffd6e4', band: '#f08fb0', line: '#ffffff' },
  { id: 'check-red', name: '빨강 체크', hex: '#c9475a', band: '#7a2a3a', line: '#f6d36a' },
];
/* What she can wear, slot by slot — price 0: she has it from the start. */
const AVATAR_WEAR = {
  top: [
    { id: 'tee', name: '반팔 티', emoji: '👕', price: 0, color: 'white' },
    { id: 'knit', name: '니트', emoji: '🧶', price: 0, color: 'cream' },
    { id: 'hoodie', name: '후드티', emoji: '🧥', price: 120, color: 'lavender' },
    { id: 'blouse', name: '블라우스', emoji: '👚', price: 100, color: 'white' },
    { id: 'cardigan', name: '카디건', emoji: '🧣', price: 140, color: 'pink' },
    { id: 'dress', name: '원피스', emoji: '👗', price: 180, color: 'mint' },
  ],
  bottom: [
    { id: 'skirt', name: '플리츠 스커트', emoji: '🩰', price: 0, color: 'navy' },
    { id: 'midi', name: '롱스커트', emoji: '🌾', price: 90, color: 'cream' },
    { id: 'jeans', name: '청바지', emoji: '👖', price: 100, color: 'denim' },
    { id: 'shorts', name: '반바지', emoji: '🩳', price: 70, color: 'navy' },
  ],
  legs: [
    { id: 'bare', name: '맨다리', emoji: '🦵', price: 0 },
    { id: 'ankle', name: '발목 양말', emoji: '🧦', price: 0, color: 'white' },
    { id: 'knee', name: '니삭스', emoji: '🧦', price: 0, color: 'white' },
    { id: 'tights', name: '스타킹', emoji: '🩱', price: 50, color: 'black' },
  ],
  shoes: [
    { id: 'slippers', name: '털 슬리퍼', emoji: '🐰', price: 0, color: 'pink' },
    { id: 'sneakers', name: '운동화', emoji: '👟', price: 0, color: 'white' },
    { id: 'maryjane', name: '메리제인', emoji: '👞', price: 90, color: 'black' },
    { id: 'boots', name: '부츠', emoji: '👢', price: 110, color: 'brown' },
  ],
  head: [
    { id: 'none', name: '없음', emoji: '✖️', price: 0 },
    { id: 'heart', name: '하트 핀', emoji: '💗', price: 0, color: 'strawberry' },
    { id: 'ribbon', name: '리본', emoji: '🎀', price: 60, color: 'strawberry' },
    { id: 'headband', name: '머리띠', emoji: '〰️', price: 50, color: 'strawberry' },
    { id: 'catears', name: '고양이 귀', emoji: '🐱', price: 90, color: 'black' },
    { id: 'blossom', name: '벚꽃 핀', emoji: '🌸', price: 70, fixed: true },
    { id: 'beret', name: '베레모', emoji: '🍂', price: 100, fixed: true },
    { id: 'straw', name: '밀짚모자', emoji: '👒', price: 100, fixed: true },
    { id: 'santa', name: '산타 모자', emoji: '🎅', price: 120, fixed: true },
  ],
  glasses: [
    { id: 'none', name: '없음', emoji: '✖️', price: 0 },
    { id: 'round', name: '동그란 안경', emoji: '👓', price: 60, color: 'black' },
  ],
  scarf: [
    { id: 'none', name: '없음', emoji: '✖️', price: 0 },
    { id: 'scarf', name: '목도리', emoji: '🧣', price: 80, fixed: true },
  ],
};
const AVATAR_DEFAULT = {
  skin: 'fair', eyes: 'brown', shape: 'round', style: 'long', bangs: 'full', hair: 'choco',
  top: 'knit', topColor: 'cream', bottom: 'skirt', bottomColor: 'navy', legs: 'knee', legsColor: 'white',
  shoes: 'slippers', shoesColor: 'pink', head: 'none', headColor: 'strawberry', glasses: 'none', glassesColor: 'black', scarf: 'none',
};
/* What she says (to herself) in the house — '{owner}' is Lorelei's name. */
const AVATAR_LINES = {
  hello: ['오늘은 뭐 하고 놀까~', '집이 최고야 💗', '흐흥~ 🎵'],
  morning: ['으음~ 잘 잤다!', '좋은 아침 ☀️', '오늘도 힘내 보자!'],
  stretch: ['으쌰~ 기지개 쭉!', '몸이 찌뿌둥하네~', '하암~'],
  window: ['하늘 예쁘다…', '오늘 날씨 좋다~', '저기 남산타워 보인다'],
  window_night: ['달 떴다 🌙', '밤하늘 예쁘다…', '창밖 불빛 반짝반짝'],
  window_rain: ['비 온다… ☔', '빗소리 좋아~'],
  window_snow: ['눈 온다! ⛄', '밖이 하얘졌어!'],
  sit: ['잠깐 쉬어야지', '아 편하다~', '여기 앉으니까 좋다'],
  bed: ['이제 자야겠다… 💤', '오늘도 수고했어, 나!', '잘 자~'],
  bed_day: ['침대 폭신폭신~', '잠깐만 누워 있을까…', '이불 보송보송하다 ☁️'],
  sleepy: ['음냐… 💤', 'Zzz…', '5분만 더…'],
  desk: ['오늘 일기 써야지 📔', '오늘 뭐 했더라?', '오늘 하루도 기록!'],
  record: ['LP 들을까?', '오늘은 무슨 노래 듣지?', '턴테이블 예쁘다'],
  music: ['이 노래 좋아 🎶', '둠칫둠칫~', '신난다 💃'],
  frame: ['이 사진 잘 나왔다!', '이때 진짜 좋았지 💗'],
  'frame-empty': ['여기에 사진 걸어야지 🖼️'],
  poster: ['내 앨범 포스터 멋지다!'],
  calendar: ['벌써 이렇게 됐네 💗', '다음 기념일 언제더라?'],
  clock: ['벌써 시간이 이렇게!'],
  plant: ['물 줘야겠다 🌱', '쑥쑥 자라라~'],
  bear: ['곰돌이 안녕 🧸', '꼬옥~'],
  kitchen: ['배고프다… 뭐 먹지?', '라면 끓일까?', '오늘은 요리해 볼까 🍳'],
  fridge: ['냉장고에 뭐 있더라~', '자석 또 늘었다!'],
  books: ['이 책 재밌겠다', '오늘은 책 읽어야지 📚'],
  wardrobe: ['오늘 뭐 입지? 👗'],
  mic: ['노래 연습해야지 🎤', '아아, 마이크 테스트~'],
  radio: ['라디오 들을까 📻'],
  table: ['차 한 잔 마셔야지 ☕', '쿠키 하나만…'],
  lamp: ['조명 분위기 좋다'],
  gift: ['선물이다! 🎁', '이게 뭐지? 두근두근'],
  tree: ['트리 반짝반짝 🎄'],
  pumpkin: ['호박 등불 귀여워 🎃'],
  mail: ['편지 왔다! 💌', '누구 편지지? 두근'],
  guest: ['{owner} 왔구나! 어서 와 💗', '{owner}! 반가워 👋'],
  tap: ['앗, 깜짝이야!', '헤헤 😊', '간지러워~', '왜~?', '기분 좋아 💗', '응?'],
  dressed: ['어때, 예뻐? ✨', '새 옷 좋다!', '이거 마음에 들어 💗'],
  // (ordering in: js/delivery.js — '{food}' is what she ordered)
  order: ['{food} 주문 완료! 🛵', '{food} 시켰다~ 빨리 와라!', '오늘은 {food}! 😋'],
  waiting: ['배달 언제 오지…', '{food} 기다리는 중~ 🛵', '배고파… 🥺'],
  hungry: ['배고프다… 떡볶이 먹고 싶다 🥺', '마라탕 땡긴다 🌶️', '버블티 마시고 싶다 🧋', '치킨 먹고 싶다… 🍗'],
  hungry_night: ['야식 먹고 싶다… 🌙', '이 시간에 치킨은 반칙인데… 🍗', '출출하다… 🌙'],
  door: ['네~ 나가요!', '앗 왔다! 잠시만요~', '네에~! 🏃‍♀️'],
  thanks: ['감사합니다~! 💗', '와 빨리 왔다! 감사해요 😊', '우와, 감사합니다!'],
  bye: ['조심히 가세요~ 👋', '수고하세요! 💗', '감사합니다, 안녕히 가세요~'],
  unpack: ['{food} 왔다! 🎉', '짜잔~ {food}! 😋', '잘 먹겠습니다! 🙏'],
  eat_bubbletea: ['쭈욱~ 🧋', '펄 쫀득쫀득해!', '달달하다 💗'],
  eat_tanghulu: ['와작! 🍓', '바삭바삭 달콤해~', '하나 더! 🍓'],
  eat_tteokbokki: ['쫀득쫀득 🍢', '맵다 맵다! 🔥', '역시 떡볶이야!'],
  eat_malatang: ['호로록~ 🍜', '얼얼해 🌶️', '국물 미쳤다…'],
  eat_chicken: ['바삭바삭 🍗', '역시 치킨은 진리야', '겉바속촉!'],
  eat_pizza: ['치즈 쭉~ 🍕', '따끈따끈해!', '피자 최고 😋'],
  done: ['잘 먹었다! 😋', '배불러~ 💗', '행복해… 🥰', '또 시켜 먹어야지!'],
  tap_eat: ['냠냠! 😋', '한 입 줄까? 🥺', '먹는 중이야~'],
};
const AVATAR_TABS = [
  ['face', '😊 얼굴'],
  ['hair', '💇‍♀️ 머리'],
  ['wear', '👗 옷'],
  ['feet', '👟 신발'],
  ['acc', '🎀 소품'],
];
const NAME_MAX = 8;

const Avatar = {
  trying: null, // what she is trying on in the shop (not hers yet): { slot, id }

  me() {
    const h = State.house;
    if (!h.me || typeof h.me !== 'object') h.me = { name: '', named: false, look: {}, owned: [] };
    return h.me;
  },

  /** Her name — hers to give; until she does, her nickname. */
  name() {
    const m = this.me();
    return String(m.name || State.user.nickname || '나').trim() || '나';
  },

  /** What she wears and how she looks (ids), with whatever she is trying on. */
  look() {
    const out = { ...AVATAR_DEFAULT, ...this.me().look };
    // (only what is hers: a thing she no longer has — or never had — is not on her)
    for (const slot in AVATAR_WEAR) if (!this.owns(slot, out[slot])) out[slot] = AVATAR_DEFAULT[slot];
    for (const k in AVATAR_DEFAULT) if (out[k] == null) out[k] = AVATAR_DEFAULT[k];
    if (this.trying) {
      // (what she tries on comes in its own colour, as it will when she has it — unless she has chosen a colour for it)
      const { slot, id } = this.trying;
      const w = this.wear(slot, id);
      out[slot] = id;
      if (w && w.color && !this.me().look[`${slot}Color`]) out[`${slot}Color`] = w.color;
    }
    return out;
  },

  /* Something to wear: its definition, and whether she has it. */
  wear(slot, id) {
    return (AVATAR_WEAR[slot] || []).find((x) => x.id === id) || null;
  },
  owns(slot, id) {
    const w = this.wear(slot, id);
    return !!w && (!w.price || this.me().owned.includes(`${slot}:${id}`));
  },
  color(id, fallback = 'white') {
    return (AVATAR_COLORS.find((c) => c.id === id) || AVATAR_COLORS.find((c) => c.id === fallback) || AVATAR_COLORS[0]).hex;
  },

  /** Her look for the 3D side: every colour worked out (js/house/me.js: LOOK). */
  look3d() {
    const L = this.look();
    const skin = AVATAR_SKINS.find((x) => x.id === L.skin) || AVATAR_SKINS[1];
    const eyes = AVATAR_EYES.find((x) => x.id === L.eyes) || AVATAR_EYES[0];
    const hair = AVATAR_HAIR.find((x) => x.id === L.hair) || AVATAR_HAIR[1];
    const check = AVATAR_CHECKS.find((x) => x.id === L.bottomColor);
    return {
      skin: skin.hex,
      eyes: { color: eyes.hex, shape: L.shape },
      hair: { style: L.style, bangs: L.bangs, top: hair.top, tip: hair.tip },
      top: { kind: L.top, color: this.color(L.topColor, 'cream'), color2: '#ffffff' },
      bottom: { kind: L.bottom, color: check ? check.hex : this.color(L.bottomColor, 'navy'), check: check && L.bottom === 'skirt' ? { band: check.band, line: check.line } : null },
      legs: { kind: L.legs, color: this.color(L.legsColor, 'white') },
      shoes: { kind: L.shoes, color: this.color(L.shoesColor, 'pink') },
      head: { kind: L.head, color: this.color(L.headColor, 'strawberry') },
      glasses: { kind: L.glasses, color: this.color(L.glassesColor, 'black') },
      scarf: L.scarf === 'scarf',
    };
  },

  /* ----- changing it ----- */

  /**
   * She picked something: a face, a hair-do, a colour — hers at once; a thing to wear she has — on; one she has not —
   * tried on, to buy or to take off again.
   */
  pick(slot, id) {
    if (slot in AVATAR_WEAR && !this.owns(slot, id)) {
      this.trying = { slot, id };
      Sfx.play('pop');
      return this.changed();
    }
    const m = this.me();
    m.look = { ...m.look, [slot]: id };
    // (a new thing to wear comes in its own colour the first time)
    const w = slot in AVATAR_WEAR && this.wear(slot, id);
    if (w && w.color && !m.look[`${slot}Color`]) m.look[`${slot}Color`] = w.color;
    if (this.trying && this.trying.slot === slot) this.trying = null;
    Sfx.play('pop');
    Store.save();
    this.changed();
  },

  /** …the thing she has on trial: bought, and hers. */
  buy() {
    const t = this.trying;
    if (!t) return;
    const w = this.wear(t.slot, t.id);
    if (!w || !Pet.spend(w.price)) return;
    const m = this.me();
    if (!m.owned.includes(`${t.slot}:${t.id}`)) m.owned.push(`${t.slot}:${t.id}`);
    this.trying = null;
    Sfx.play('coin');
    Diary.add('meWear', w.name);
    this.pick(t.slot, t.id);
    Game.checkAchievements();
  },

  /** …or taken off again. */
  untry() {
    if (!this.trying) return;
    this.trying = null;
    this.changed();
  },

  changed() {
    HouseHost.sync();
    HouseRoom.renderMe();
  },

  /** Her name: asked for (the first time she comes in, and from the shop). */
  async askName(first = false) {
    const value = await new Promise((resolve) => {
      let done = null;
      const ov = UI.open(
        `<form class="dialog av-name" data-av-form>
          <div class="dialog-icon" aria-hidden="true">🙋‍♀️</div>
          <h2><label for="av-name">${first ? '집에 사는 나에게 이름을 지어 주세요' : '이름 바꾸기'}</label></h2>
          <p>${first ? '둘의 집에서 지내는 내 캐릭터예요. 얼굴도 머리도 옷도 마음대로 꾸밀 수 있어요.' : `${NAME_MAX}글자까지 지을 수 있어요.`}</p>
          <input id="av-name" class="ob-input" maxlength="${NAME_MAX}" value="${esc(this.name())}" placeholder="${esc(this.name())}" autocomplete="off" enterkeyhint="done">
          <div class="dialog-actions ${first ? 'one' : ''}">
            ${first ? '' : '<button class="btn soft" type="button" data-ov-cancel>취소</button>'}
            <button class="btn primary" type="submit">${first ? '이 이름으로 할게요' : '바꾸기'}</button>
          </div>
        </form>`,
        { cls: 'is-dialog', label: '이름 짓기', onClose: () => resolve(done) }
      );
      const input = $('#av-name', ov.panel);
      setTimeout(() => {
        try {
          input.focus();
          input.select();
        } catch (e) {
          /* ignore */
        }
      }, 120);
      $('[data-av-form]', ov.panel).addEventListener('submit', (e) => {
        e.preventDefault();
        done = input.value.trim().slice(0, NAME_MAX);
        UI.close(ov);
      });
      const cancel = $('[data-ov-cancel]', ov.panel);
      if (cancel) cancel.addEventListener('click', () => UI.close(ov));
    });
    const m = this.me();
    if (value) m.name = value;
    if (value || first) m.named = true;
    Store.save();
    HouseRoom.refresh();
    HouseRoom.renderMe();
    HouseHost.sync();
    if (value) UI.toast(`이제 ${josa(value, '이라고/라고')} 불러요 💗`, { icon: '🙋‍♀️' });
  },

  /** What she says to herself about `kind` (the weather outside for the window; the bed by day is not yet for sleeping). */
  line(kind) {
    let k = kind;
    const hour = new Date().getHours();
    if (kind === 'bed' && hour >= 7 && hour < 21) k = 'bed_day';
    if (kind === 'window') {
      const w = House.weather();
      if (w.kind === 'rain') k = 'window_rain';
      else if (w.kind === 'snow') k = 'window_snow';
      else if (Moon.dark()) k = 'window_night';
    }
    const list = AVATAR_LINES[k] || AVATAR_LINES[kind];
    if (!list || !list.length) return '';
    return pick(list)
      .replace(/\{owner\}/g, OWNER_NAME)
      .replace(/\{food\}/g, Delivery.foodName());
  },

  /* ----- the shop ----- */

  sheetHtml(tab) {
    const L = this.look();
    const opt = (slot, x, extra = '') => {
      const on = L[slot] === x.id;
      const priced = slot in AVATAR_WEAR && x.price && !this.owns(slot, x.id);
      return `<button class="av-opt ${on ? 'on' : ''}" data-action="avatar-pick" data-slot="${slot}" data-id="${x.id}" data-sfx="none" aria-pressed="${on}">
        <span class="av-emoji" aria-hidden="true">${x.emoji || ''}</span><b>${esc(x.name)}</b>${priced ? `<small>${x.price} 🪙</small>` : ''}${extra}</button>`;
    };
    const opts = (slot, list) => `<div class="av-opts">${list.map((x) => opt(slot, x)).join('')}</div>`;
    const sw = (slot, list) =>
      `<div class="av-swatches">${list
        .map((c) => {
          const bg = c.top ? `linear-gradient(160deg, ${c.top} 45%, ${c.tip})` : c.band ? `repeating-linear-gradient(90deg, ${c.band} 0 4px, ${c.hex} 4px 11px), ${c.hex}` : c.hex;
          const on = L[slot] === c.id;
          return `<button class="av-swatch ${on ? 'on' : ''}" data-action="avatar-pick" data-slot="${slot}" data-id="${c.id}" data-sfx="none" style="--sw:${bg}" aria-label="${esc(c.name)}" title="${esc(c.name)}" aria-pressed="${on}"></button>`;
        })
        .join('')}</div>`;
    const head = (t, small = '') => `<h3 class="shop-head">${t}${small ? ` <small>${small}</small>` : ''}</h3>`;
    const wearColors = (slot) => {
      const w = this.wear(slot, L[slot]);
      if (!w || !w.color || w.fixed) return '';
      const list = slot === 'bottom' && L.bottom === 'skirt' ? AVATAR_COLORS.concat(AVATAR_CHECKS) : AVATAR_COLORS;
      return sw(`${slot}Color`, list);
    };
    if (tab === 'face')
      return `${head('피부')}${sw('skin', AVATAR_SKINS)}${head('눈 색')}${sw('eyes', AVATAR_EYES)}${head('눈 모양')}${opts('shape', AVATAR_SHAPES)}`;
    if (tab === 'hair') return `${head('머리 모양')}${opts('style', AVATAR_STYLES)}${head('앞머리')}${opts('bangs', AVATAR_BANGS)}${head('머리 색')}${sw('hair', AVATAR_HAIR)}`;
    if (tab === 'wear')
      return `${head('상의', '고르면 색도 바꿀 수 있어요')}${opts('top', AVATAR_WEAR.top)}${wearColors('top')}${
        L.top === 'dress' ? '<p class="hint">원피스를 입으면 하의는 안 보여요.</p>' : `${head('하의')}${opts('bottom', AVATAR_WEAR.bottom)}${wearColors('bottom')}`
      }`;
    if (tab === 'feet') return `${head('양말')}${opts('legs', AVATAR_WEAR.legs)}${wearColors('legs')}${head('신발')}${opts('shoes', AVATAR_WEAR.shoes)}${wearColors('shoes')}`;
    return `${head('머리 장식')}${opts('head', AVATAR_WEAR.head)}${wearColors('head')}${head('안경')}${opts('glasses', AVATAR_WEAR.glasses)}${wearColors('glasses')}${head('목도리')}${opts('scarf', AVATAR_WEAR.scarf)}`;
  },

  /** The bar over the shop while she tries something on: buy it, or take it off. */
  tryHtml() {
    const t = this.trying;
    if (!t) return '';
    const w = this.wear(t.slot, t.id);
    return `<div class="fox-preview">
      <span class="fp-text"><b>${esc(w.name)}</b> 입어 보는 중</span>
      <button class="btn primary small" data-action="avatar-buy">${w.price} 🪙 사기</button>
      <button class="icon-btn small" data-action="avatar-untry" aria-label="벗기">✕</button>
    </div>`;
  },
};

Object.assign(Actions, {
  'avatar-pick': (el) => Avatar.pick(el.dataset.slot, el.dataset.id),
  'avatar-buy': () => Avatar.buy(),
  'avatar-untry': () => Avatar.untry(),
  'avatar-name': () => Avatar.askName(),
  'avatar-tab': (el) => HouseRoom.setMeTab(el.dataset.tab),
  'house-me': () => HouseRoom.setMe(!HouseRoom.meOn),
  'house-me-done': () => HouseRoom.setMe(false),
});
