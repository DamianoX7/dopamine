'use strict';
/* ==================================================================
   🏠 둘의 집 — a home of their own, on the whole screen.

   One room, seen like a doll's house (the 3D side is js/house/), and
   what is hers on the site has its place in it: the LPs she has
   pressed stand in the record cabinet and play on its turntable, her
   pictures hang in the frames on the walls, her diary lies open on the
   desk, his letters come to the mailbox by the door, the calendar on
   the wall counts their days, the fridge wears a magnet for every
   achievement — and through the window is Incheon as it is right now:
   its sky (js/moon.js) and its weather (CityWeather, below). She arranges it herself: furniture, wallpaper, the floor,
   bought with her coins, moved about a square at a time. On a day
   worth remembering a present waits by the door. And now and then
   Lorelei knocks, and comes in for a while.

   And she lives there herself: a girl she has made, named and dressed
   as she likes (js/avatar.js), who sleeps in the bed at night and goes
   about the house through the day — and orders in now and then: the
   courier knocks with it (js/delivery.js). She goes out, too: round the
   corner are a convenience store, a café, a coin karaoke and a park —
   and what she buys there to cook with, she cooks in the kitchen
   (js/town.js).

   What she has and where it stands is State.house; the pictures and
   the records stay where they are kept (js/photos.js, the studio).
   ================================================================== */

const HOUSE_NAME = String(CFG.houseName || '').trim() || '둘의 집';

/* What can be in the house: cat 'floor' (가구) or 'wall' (벽 꾸미기). unique: one only. gift: only a day worth remembering brings it. */
const HOUSE_ITEMS = [
  { id: 'record', emoji: '💿', name: '레코드장', cat: 'floor', price: 180, unique: true, desc: '내 LP를 틀어요' },
  { id: 'desk', emoji: '📔', name: '책상', cat: 'floor', price: 120, unique: true, desc: '일기장이 펼쳐져 있어요' },
  { id: 'sofa', emoji: '🛋️', name: '딸기 소파', cat: 'floor', price: 160 },
  { id: 'sofa-cream', emoji: '🛋️', name: '크림 소파', cat: 'floor', price: 160 },
  { id: 'sofa-sage', emoji: '🛋️', name: '세이지 소파', cat: 'floor', price: 160 },
  { id: 'armchair', emoji: '💺', name: '머스터드 의자', cat: 'floor', price: 110 },
  { id: 'armchair-pink', emoji: '💺', name: '분홍 안락의자', cat: 'floor', price: 110 },
  { id: 'chair', emoji: '🪑', name: '원목 의자', cat: 'floor', price: 50 },
  { id: 'beanbag', emoji: '🫧', name: '라벤더 빈백', cat: 'floor', price: 90 },
  { id: 'bed', emoji: '🛏️', name: '깅엄 침대', cat: 'floor', price: 220 },
  { id: 'bed-star', emoji: '🌙', name: '별밤 침대', cat: 'floor', price: 240 },
  { id: 'table', emoji: '☕', name: '티 테이블', cat: 'floor', price: 70 },
  { id: 'bookshelf', emoji: '📚', name: '책장', cat: 'floor', price: 130 },
  { id: 'wardrobe', emoji: '🚪', name: '민트 옷장', cat: 'floor', price: 150 },
  { id: 'kitchen', emoji: '🍳', name: '미니 주방', cat: 'floor', price: 260 },
  { id: 'fridge', emoji: '🧊', name: '레트로 냉장고', cat: 'floor', price: 200, desc: '업적마다 자석이 붙어요' },
  { id: 'lamp', emoji: '💡', name: '스탠드 조명', cat: 'floor', price: 80, desc: '밤이면 저절로 켜져요' },
  { id: 'plant', emoji: '🪴', name: '몬스테라', cat: 'floor', price: 70 },
  { id: 'cactus', emoji: '🌵', name: '꼬마 선인장', cat: 'floor', price: 30 },
  { id: 'bear', emoji: '🧸', name: '곰 인형', cat: 'floor', price: 90 },
  { id: 'mic', emoji: '🎤', name: '마이크 스탠드', cat: 'floor', price: 100, desc: '누르면 노래하러 가요' },
  { id: 'radio', emoji: '📻', name: '레트로 라디오', cat: 'floor', price: 120, desc: '여우 라디오가 나와요' },
  { id: 'rug', emoji: '🩷', name: '딸기 러그', cat: 'floor', price: 60 },
  { id: 'rug-mint', emoji: '💚', name: '민트 러그', cat: 'floor', price: 60 },
  { id: 'rug-stripe', emoji: '🧡', name: '줄무늬 러그', cat: 'floor', price: 80 },
  { id: 'frame', emoji: '🖼️', name: '가로 액자', cat: 'wall', price: 40, desc: '사진첩의 사진을 걸어요' },
  { id: 'frame-tall', emoji: '🖼️', name: '세로 액자', cat: 'wall', price: 40, desc: '네 컷 사진이 쏙 들어가요' },
  { id: 'poster', emoji: '💿', name: '앨범 포스터', cat: 'wall', price: 60, desc: '내 앨범 그림으로 만들어요' },
  { id: 'clock', emoji: '🕰️', name: '벽시계', cat: 'wall', price: 50 },
  { id: 'calendar', emoji: '📅', name: '우리 달력', cat: 'wall', price: 50, desc: '만난 지 며칠째인지 알려 줘요' },
  { id: 'garland', emoji: '✨', name: '가랜드 전구', cat: 'wall', price: 70, desc: '밤이면 반짝여요' },
  { id: 'shelf', emoji: '🕯️', name: '벽 선반', cat: 'wall', price: 60 },
  { id: 'mailbox', emoji: '📮', name: '우편함', cat: 'wall', fixed: true, gift: true },
  // what the days worth remembering bring
  { id: 'cake', emoji: '🎂', name: '기념일 케이크', cat: 'floor', gift: true },
  { id: 'bouquet', emoji: '💐', name: '꽃다발', cat: 'floor', gift: true },
  { id: 'balloons', emoji: '🎈', name: '생일 풍선', cat: 'floor', gift: true },
  { id: 'choco', emoji: '🍫', name: '하트 초콜릿', cat: 'floor', gift: true },
  { id: 'xmas-tree', emoji: '🎄', name: '크리스마스트리', cat: 'floor', gift: true },
  { id: 'pumpkin', emoji: '🎃', name: '호박 등불', cat: 'floor', gift: true },
];

const HOUSE_WALLS = [
  { id: 'cream', name: '크림', price: 0 },
  { id: 'stripe', name: '딸기 줄무늬', price: 90 },
  { id: 'mint', name: '민트 체크', price: 90 },
  { id: 'cloud', name: '구름', price: 110 },
  { id: 'flower', name: '꽃무늬', price: 110 },
  { id: 'heart', name: '하트 도트', price: 110 },
  { id: 'wood', name: '우드 패널', price: 120 },
  { id: 'starry', name: '별밤', price: 130 },
];
const HOUSE_FLOORS = [
  { id: 'wood', name: '원목 마루', price: 0 },
  { id: 'herring', name: '헤링본', price: 120 },
  { id: 'tile', name: '하얀 타일', price: 100 },
  { id: 'check', name: '딸기 체크', price: 110 },
  { id: 'carpet', name: '핑크 카펫', price: 110 },
  { id: 'jangpan', name: '노란 장판', price: 90 },
];
/* How big the house is: it can be made bigger twice. */
const HOUSE_SIZES = [
  { name: '아늑한 원룸', price: 0 },
  { name: '조금 넓은 집', price: 500 },
  { name: '넓은 집', price: 1000 },
];

/* How it is furnished the first time (the small room: 6 × 4.5 — the door on the right, the window at the back). */
const HOUSE_SEED = [
  { id: 'bed', x: 2.25, z: -1.25, r: 0 },
  { id: 'desk', x: 0.75, z: -2.0, r: 0 },
  { id: 'chair', x: 0.75, z: -1.5, r: 2 },
  { id: 'record', x: -2.375, z: -2.0, r: 0 },
  { id: 'plant', x: -1.5, z: -2.0, r: 0 },
  { id: 'rug', x: -1.5, z: 0, r: 0 },
  { id: 'sofa', x: -2.625, z: 0, r: 1 },
  { id: 'table', x: -1.5, z: 0, r: 1 },
  { id: 'lamp', x: -2.75, z: 1.25, r: 0 },
  { id: 'frame', wall: 'back', u: 0.875, y: 1.22 },
  { id: 'frame-tall', wall: 'back', u: 1.55, y: 1.32 },
  { id: 'clock', wall: 'back', u: -2.35, y: 1.38 },
  { id: 'calendar', wall: 'right', u: -0.45, y: 1.2 },
  { id: 'mailbox', wall: 'right', u: 0.2, y: 1.05 },
];

const HOUSE_TIPS = [
  '손가락으로 밀면 집을 빙 돌려 볼 수 있어요',
  '두 손가락이나 마우스 휠로 가까이 볼 수 있어요',
  '레코드장을 누르면 내 LP를 턴테이블에 올려요',
  '액자를 누르면 사진첩의 사진을 걸 수 있어요',
  '책상 위 일기장을 누르면 일기장이 열려요',
  '편지가 오면 문 옆 우편함 깃발이 올라가요',
  '창밖은 지금 인천 하늘이에요. 날씨도, 해 지는 시간도, 오늘 밤 달 모양도 진짜예요',
  '해가 비치는 날엔 창문으로 들어온 햇빛이 바닥에 내려앉아요',
  '🛋️ 꾸미기에서 가구를 사고, 끌어서 옮길 수 있어요',
  '문 옆 스위치를 누르면 불을 끄고 켤 수 있어요',
  '기념일엔 문 앞에 선물이 도착해요',
  '냉장고에는 업적마다 자석이 하나씩 붙어요',
  `가끔 ${josa(OWNER_NAME, '이/가')} 놀러 와요`,
  '🛵 버튼으로 배달 음식을 시켜 줄 수 있어요. 배달원이 문을 두드려요',
  '🏘️ 동네 버튼을 누르면 편의점, 카페, 코인노래방, 공원에 갈 수 있어요',
  '편의점에서 재료를 사 오면 🍳 부엌에서 요리할 수 있어요. 타이밍 맞추기!',
  '코인노래방에서는 내 커버를 직접 불러요 🎤 마지막엔 점수도 나와요',
  '🌱 버튼을 누르면 창밖 베란다 텃밭에 나가요. 상추, 대파, 방울토마토, 딸기를 키워요',
  '베란다 텃밭은 흙이 촉촉한 동안 자라요. 비가 오면 저절로 물이 돼요 ☔',
];

/* What Lorelei says when she comes round — and about what she sees. ('{name}' = her nickname) */
const HOUSE_LINES = {
  first: ['우와, 여기가 {name} 집이구나! 진짜 예쁘다 💗', '집들이 왔어! 구경해도 돼?'],
  hello: ['똑똑, 나 왔어! 🙋‍♀️', '놀러 왔어! 잠깐 있다 가도 돼?', '지나가다 들렀어 💗', '안녕! 오늘 집 분위기 좋다~'],
  window: ['창밖 하늘 예쁘다…', '저기 남산타워 보인다!', '오늘 하늘 기억해 둘래', '창가 자리가 명당이네!'],
  window_night: ['밤하늘 봐! 달 떴어 🌙', '창밖 불빛이 반짝반짝해', '여우들도 지금 이 하늘 보고 있을까?'],
  window_rain: ['비 오는 날엔 집이 최고야 ☔', '빗소리 좋다…'],
  window_snow: ['눈 온다! ⛄', '창밖이 하얘졌어!'],
  frame: ['이 사진 정말 잘 나왔다!', '이때 생각난다 💗', '사진 속 얼굴들 너무 귀여워'],
  'frame-empty': ['여기엔 어떤 사진 걸 거야?', '빈 액자네! 예쁜 사진 걸어 줘'],
  poster: ['네 앨범 포스터다! 멋있어', '이 앨범 나도 좋아해 💿'],
  calendar: ['벌써 이렇게 됐구나 💗', '다음 기념일은 언제야?'],
  clock: ['시간 진짜 빨리 간다', '똑딱똑딱…'],
  record: ['LP 한 장 틀어 줄래?', '레코드판 소리 좋아해', '이 턴테이블 예쁘다!'],
  music: ['이 노래 좋다! 🎶', '같이 춤추자~ 💃', '네 목소리 최고야!', '음악 있으니까 더 좋다'],
  sit: ['아~ 푹신하다', '잠깐 앉아도 되지?', '여기 앉으니까 편하다 💗'],
  bed: ['침대 폭신폭신해…', '눕고 싶다~ 💤'],
  desk: ['일기 쓰는 책상이구나 📔', '오늘은 무슨 일기 쓸 거야?'],
  plant: ['식물이 잘 자라고 있네 🌱', '물 줬어?'],
  bear: ['곰돌이 안아 봐도 돼? 🧸', '얘 이름 뭐야?'],
  kitchen: ['다음엔 같이 요리하자 🍳', '맛있는 냄새 나는 것 같아'],
  fridge: ['자석 엄청 많다! 대단해', '냉장고에 간식 있어?'],
  books: ['책 많다! 하나 추천해 줘', '이 책 재밌어 보여'],
  wardrobe: ['옷장 구경해도 돼? 👗'],
  mic: ['노래 한 곡 불러 줘! 🎤', '마이크 보니까 설렌다'],
  radio: ['라디오 틀어 볼까? 📻'],
  table: ['차 한 잔 할까? ☕', '쿠키 하나 먹어도 돼?'],
  lamp: ['조명 분위기 좋다'],
  gift: ['이거 기념일 선물이지? 예쁘다 💝', '특별한 날이었구나!'],
  tree: ['트리 반짝반짝해 🎄'],
  pumpkin: ['호박 등불 귀엽다 🎃'],
  tap: ['응? 불렀어? 💗', '헤헤, 안녕!', '나 여기 있어~', '오늘도 반가워!', '왜~? 😊'],
  meet: ['{me}! 잘 지냈어? 💗', '{me}, 안녕! 오늘 옷 예쁘다 ✨', '{me}! 보고 싶었어 👋', '놀러 왔어, {me}!'], // (to the girl who lives here: '{me}' is her name)
  food: ['와, {food}! 맛있겠다~ 😋', '맛있는 냄새 난다~', '나도 한 입만…! 🥺'], // (what she has ordered has come: '{food}')
  bye: ['이제 여우들한테 가 봐야겠다. 또 올게! 👋', '잘 놀다 가! 다음에 또 봐 💗', '오늘 즐거웠어! 안녕~'],
};
const GUEST_EVERY = 90 * 60000; // she comes at most this often…
const GUEST_DAY = 2; //            …and at most this many times a day

/* ------------------------------------------------------------------
   CityWeather — the weather outside the window is Incheon's, right now:
   asked of Open-Meteo (free, no key; nothing of hers is sent — only
   where Incheon is), every 20 minutes while the house is open. When it
   cannot be had, the window shows the weather of her world instead
   (js/weather.js).
   ------------------------------------------------------------------ */
const CITY_URL = 'https://api.open-meteo.com/v1/forecast?latitude=37.4563&longitude=126.7052&current=temperature_2m,weather_code,precipitation&timezone=Asia%2FSeoul';
/* WMO weather codes → what the window shows, what it is called, its emoji */
const CITY_CODES = [
  [[0], 'clear', '맑음', '☀️'],
  [[1], 'clear', '대체로 맑음', '🌤️'],
  [[2], 'cloudy', '구름 조금', '⛅'],
  [[3], 'cloudy', '흐림', '☁️'],
  [[45, 48], 'cloudy', '안개', '🌫️'],
  [[51, 53, 55, 56, 57], 'rain', '이슬비', '🌦️'],
  [[61, 63, 66, 80, 81], 'rain', '비', '🌧️'],
  [[65, 67, 82], 'rain', '많은 비', '🌧️'],
  [[71, 73, 77, 85], 'snow', '눈', '🌨️'],
  [[75, 86], 'snow', '많은 눈', '❄️'],
  [[95, 96, 99], 'rain', '천둥번개', '⛈️'],
];

const CityWeather = {
  data: null, // { kind, level, name, emoji, temp, at }
  loading: null,

  /** Incheon's weather as it was last heard (within the hour) — or null. */
  now() {
    return this.data && Date.now() - this.data.at < 3600000 ? this.data : null;
  },

  /** Ask for it again if it is more than 20 minutes old. → whether there is something new. */
  load() {
    if (this.loading) return this.loading;
    if (this.data && Date.now() - this.data.at < 20 * 60000) return Promise.resolve(false);
    const ctl = window.AbortController ? new AbortController() : null;
    const timer = setTimeout(() => ctl && ctl.abort(), 6000);
    this.loading = fetch(CITY_URL, ctl ? { signal: ctl.signal } : {})
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        const c = j && j.current;
        if (!c || typeof c.weather_code !== 'number') return false;
        const row = CITY_CODES.find((x) => x[0].includes(c.weather_code)) || CITY_CODES[2];
        const falls = row[1] === 'rain' || row[1] === 'snow';
        this.data = { kind: row[1], level: falls ? clamp(0.4 + (c.precipitation || 0) * 0.5, 0.4, 1) : 0, wet: 0, name: row[2], emoji: row[3], temp: Math.round(c.temperature_2m), at: Date.now() };
        return true;
      })
      .catch(() => false)
      .finally(() => {
        clearTimeout(timer);
        this.loading = null;
      });
    return this.loading;
  },
};

/* ------------------------------------------------------------------
   HouseHost — the bridge to the 3D side (as FoxHost is to the foxes').
   ------------------------------------------------------------------ */
const HouseHost = {
  api: null, //   set by js/house/host.js
  failed: false,
  loading: null,
  stage: null,
  waiters: [],

  load() {
    if (!this.loading) {
      this.loading = import(new URL('js/house/host.js', document.baseURI).href).catch((err) => {
        console.error('[House] the 3D house could not be loaded', err);
        this.fail();
      });
    }
    return this.loading;
  },

  register(api) {
    this.api = api;
    this.waiters.splice(0).forEach((done) => done(true));
  },

  fail() {
    this.failed = true;
    this.api = null;
    this.waiters.splice(0).forEach((done) => done(false));
  },

  ready(ms = 12000) {
    if (this.api) return Promise.resolve(true);
    if (this.failed) return Promise.resolve(false);
    this.load();
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      setTimeout(() => resolve(false), ms);
    });
  },

  look: () => House.look(),

  sync() {
    if (this.api && this.stage) this.api.sync(this.look());
  },

  /* ----- what the 3D side tells the app ----- */
  onTap: (kind, uid) => House.tapped(kind, uid), //   she tapped a thing (or the window, the door, the switch, Lorelei, a present)
  onPick: (uid) => House.pick(uid), //                 (arranging) she picked a thing to move — or none
  onPlace: (uid, place) => House.placed(uid, place), // …and put it down somewhere else
  onRefuse: () => House.refused(), //                  …where it cannot stand
  onGuest: (what) => House.guestSaid(what), //         Lorelei: 'hello', 'wave', 'bye', 'leaving', 'gone'
  line: (who, kind) => (who === 'guest' ? House.guestLine(kind) : who === 'rider' ? Delivery.riderLine(kind) : who === 'cat' ? CatLife.line(kind) : who === 'clerk' || who === 'barista' ? TownLife.line(who, kind) : TownLife.meLine(kind)), // what Lorelei ('guest'), the girl ('me'), the courier ('rider') — or the girl at the store's till, the woman at the café — says about `kind`
  onDelivery: (what, o) => Delivery.said(what, o), //  the courier: 'knock', 'handed', 'gone'
  onMeal: (source, id) => (source === 'delivery' ? Delivery.said('done', { id }) : TownLife.ate(source, id)), // she has eaten it all: what the courier brought, what she bought, what she cooked
  onTown: (what, o) => TownLife.said(what, o), //       out of the door: 'out', 'arrive', 'paid', 'singing', 'sung', 'home'
  onCat: (what) => CatLife.said(what), //               뭉치: 'home' (in at the door with her, just taken home)
  onTownTap: (kind) => TownLife.tapped(kind), //         …a tap on the street: a shop, her house, the swings…
  onCook: (what) => TownLife.cookSaid(what), //          the kitchen: 'ready' (she is at the hob)
  onVeranda: (what, o) => VerandaLife.said(what, o), //  the veranda: 'out', 'in', 'sown', 'watered', 'pickedAll', 'tap' (js/veranda.js)
  sound: (name) => Sfx.play(name),
  clock: () => CoverHost.clock(), //                   (where the song is, and its beat: she dances to it)
  beats: (id) => CoverHost.beats(id),
};
window.HouseHost = HouseHost;

/* ------------------------------------------------------------------
   House — what is hers in it, and what she does with it.
   ------------------------------------------------------------------ */
const House = {
  held: null, //    (arranging) the thing she has picked: its uid
  preview: null, // a wallpaper or a floor she is looking at in the shop: { wall } or { floor }
  disc: null, //    the record on the turntable, drawn: { id, disc (canvas), art (image), album }
  firstVisit: false,
  guestTimer: 0,

  item(id) {
    return HOUSE_ITEMS.find((x) => x.id === id);
  },
  /** How many of `id` she has: standing in the house, and put away. */
  placedCount(id) {
    return State.house.items.filter((x) => x.id === id).length;
  },
  storedCount(id) {
    return State.house.stored.filter((x) => x === id).length;
  },
  owned(id) {
    return this.placedCount(id) + this.storedCount(id);
  },
  entry(uid) {
    return State.house.items.find((x) => x.uid === uid);
  },
  newUid() {
    return `h${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;
  },

  /** The first time she comes in, the house is furnished. → true if it was just now. */
  furnish() {
    const h = State.house;
    if (h.made) return false;
    h.made = Date.now();
    h.items = HOUSE_SEED.map((it) => ({ uid: this.newUid(), ...it }));
    Store.save();
    Game.checkAchievements();
    return true;
  },

  /** What the 3D side should show. */
  look() {
    const h = State.house;
    const pv = this.preview || {};
    const today = dateKey();
    return {
      size: h.size,
      wall: pv.wall || h.wall,
      floor: pv.floor || h.floor,
      items: h.items.map((it) => ({ ...it })),
      edit: HouseRoom.editOn,
      held: HouseRoom.editOn ? this.held : null,
      light: h.light,
      lamps: { ...h.lamps },
      mail: Post.waiting().length > 0,
      mailKey: Post.waiting().map((l) => l.id).join(',') || null,
      diaryReady: Diary.writable() && Diary.isOpen() && !State.diary.pages[Diary.today()],
      gift: !!this.giftWaiting(),
      giftKey: (this.giftWaiting() || {}).key || null,
      me: { look: Avatar.look3d(), showcase: HouseRoom.meOn },
      food: { order: (Delivery.pending() || {}).id || null },
      shut: Opening.shut(), // (the coin karaoke on the street opens with the studio — and the bus to the foxes runs from then)
      opens: Opening.shut() ? BusRide.firstBus() : '',
      cat: { adopted: CatLife.adopted() }, // (뭉치 lives here: js/cat.js)
      calendar: this.calendar(today),
      magnets: Object.keys(State.achievements).length,
      tune: CoverHost.tune(),
      radio: Radio.on,
      sky: Moon.now(),
      weather: this.weather(),
      season: Weather.calendar(), // (Incheon's: the calendar's)
      reduce: reducedMotion(),
      veranda: VerandaLife.look(), // (the planter boxes out on the veranda, and what grows in them)
    };
  },

  /** The weather outside the window: Incheon's, if it could be had — otherwise her world's (the meadow follows the year). */
  weather() {
    return CityWeather.now() || Weather.now('meadow');
  },

  /** "☁️ 인천 15° · 흐림" — over the view (her world's weather, if Incheon's could not be had). */
  skyChip() {
    const w = CityWeather.now();
    if (!w) return Weather.chipHtml('meadow');
    const emoji = w.kind === 'clear' && Moon.dark() ? Moon.emoji() : w.emoji;
    return `<span aria-hidden="true">${emoji}</span> 인천 ${w.temp}° <i aria-hidden="true">·</i> ${esc(w.name)}`;
  },

  /** The page of the calendar on the wall: this month, today, the days worth remembering in it, and how many days it has been. */
  calendar(today = dateKey()) {
    const [y, m, d] = today.split('-').map(Number);
    const first = `${y}-${pad2(m)}-01`;
    const last = `${y}-${pad2(m)}-${pad2(new Date(y, m, 0).getDate())}`;
    const marks = Days.between(first, last).map((e) => +e.key.slice(8));
    return { y, m, d, count: Days.count(today) || 0, marks };
  },

  /* ----- the things she taps ----- */

  tapped(kind, uid) {
    if (!State.house.taught) {
      State.house.taught = true;
      Store.save();
      const tip = HouseRoom.ov && $('[data-house-tip]', HouseRoom.ov.panel);
      if (tip) tip.remove();
    }
    if (kind === 'window') return this.windowCard();
    if (kind === 'switch') return this.switchLight();
    if (kind === 'gift') return this.openGift();
    if (kind === 'guest' || kind === 'me' || kind === 'rider') return; // (they turn and wave: the 3D side has done it)
    if (kind === 'cat') return CatLife.tapped(); // (뭉치: she goes and strokes it — js/cat.js)
    if (kind === 'door') {
      Sfx.play('tap');
      if (HouseHost.api && HouseHost.api.guestHere()) return UI.toast(`${josa(OWNER_NAME, '이/가')} 놀러 와 있어요 💗`, { icon: '🚪' });
      return UI.menu('🚪 현관문', [{ icon: '🏘️', label: '동네로 나가기', onClick: () => TownLife.goOut() }]);
    }
    if (kind === 'fixed') return UI.toast('우편함은 문 옆에 붙어 있어서 옮길 수 없어요', { icon: '📮' });
    const it = this.entry(uid);
    if (!it) return;
    switch (it.id) {
      case 'record':
        return this.recordSheet();
      case 'desk':
        return this.diarySheet();
      case 'frame':
      case 'frame-tall':
        return this.frameSheet(uid);
      case 'poster':
        return this.posterSheet(uid);
      case 'mailbox':
        return this.mailSheet();
      case 'calendar':
        return this.calendarCard();
      case 'clock':
        Sfx.play('tap');
        return UI.toast(`지금은 ${Moon.clock(Date.now())}이에요`, { icon: '🕰️' });
      case 'lamp':
        return this.switchLamp(uid);
      case 'mic':
        Sfx.play('pop');
        if (Opening.shut()) return Opening.tell();
        return Actions.sing();
      case 'radio':
        if (Radio.on) Radio.stop();
        else Radio.start({ screen: false });
        return setTimeout(() => HouseHost.sync(), 300);
      case 'fridge':
        return TownLife.kitchenSheet('fridge');
      case 'kitchen':
        return TownLife.kitchenSheet('cook');
      case 'bed':
      case 'bed-star': {
        const h = new Date().getHours();
        Sfx.play('pop');
        return UI.toast(h >= 22 || h < 5 ? '오늘도 수고 많았어요. 잘 자요 💤' : h < 11 ? '좋은 아침이에요! 기지개 쭉 ☀️' : '폭신폭신… 낮잠 자기 딱 좋겠어요', { icon: '🛏️' });
      }
      default:
        Sfx.play('pop');
    }
  },

  /* The light by the door (the switch, or the 💡 over the view). */
  switchLight() {
    const h = State.house;
    h.light = !h.light;
    Sfx.play('tap');
    Store.save();
    HouseHost.sync();
    HouseRoom.refresh();
    if (Moon.dark()) UI.toast(h.light ? '불을 켰어요 💡' : '불을 껐어요. 달빛이랑 조명만 남았어요 🌙', { icon: h.light ? '💡' : '🌙' });
  },

  /* A lamp: on, off (by itself it comes on when it gets dark — once she has switched it, it stays as she left it). */
  switchLamp(uid) {
    const h = State.house;
    const auto = h.lamps[uid] === undefined;
    const on = auto ? Moon.dark() : !!h.lamps[uid];
    h.lamps[uid] = !on;
    Sfx.play('tap');
    Store.save();
    HouseHost.sync();
  },

  /* ----- the record player ----- */

  /** Her pressed LPs, newest first (as the record player needs them). */
  lps() {
    return Object.keys(State.lp)
      .map((id) => LP.info(id))
      .filter((a) => a && a.tracks.length)
      .sort((a, b) => (State.lp[b.id].at || 0) - (State.lp[a.id].at || 0));
  },

  async recordSheet() {
    Sfx.play('pop');
    const albums = this.lps();
    if (!albums.length) {
      if (Opening.shut()) return UI.alert({ icon: '💿', title: '레코드장이 아직 비어 있어요', text: `${Opening.whenText()}에 스튜디오가 열리면, 앨범을 LP로 구워서 여기에 꽂을 수 있어요.` });
      const go = await UI.confirm({ icon: '💿', title: '레코드장이 아직 비어 있어요', text: '내 커버에서 앨범을 열고 💿 LP로 굽기를 누르면, 그 LP가 여기 꽂혀서 턴테이블로 들을 수 있어요.', ok: '💿 내 앨범 보러 가기', cancel: '나중에' });
      if (go) Router.go('#/covers');
      return;
    }
    const p = CoverHost.player();
    const on = this.disc && this.disc.album.tracks.some((t) => t.id === p.singleId) && p.playing ? this.disc.id : null;
    const ov = UI.open(
      `<div class="house-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>💿 레코드장</h2>
        <p class="hint">LP를 고르면 턴테이블에 올라가서 처음부터 흘러나와요.</p>
        <div class="house-lps">${albums
          .map(
            (a) => `<button class="house-lp ${a.id === on ? 'on' : ''}" data-house-lp="${esc(a.id)}">
              <span class="hl-art">${a.artworkId ? `<img data-art-id="${esc(a.artworkId)}" alt="">` : '<i aria-hidden="true">💿</i>'}<i class="hl-vinyl" style="--vinyl:${esc(LP.color(a.id).base)}" aria-hidden="true"></i></span>
              <b>${esc(a.title)}</b><small>${a.tracks.length}곡 · ${fmtTime(a.total)}</small></button>`
          )
          .join('')}</div>
        <div class="dialog-actions ${on ? '' : 'one'}">
          ${on ? '<button class="btn soft" data-house-lp-stop>⏹ 멈추기</button>' : ''}
          <button class="btn primary" data-house-lp-big>🎛️ 턴테이블 크게 보기</button>
        </div>
      </div>`,
      { cls: 'is-house-sheet', label: '레코드장' }
    );
    $$('[data-art-id]', ov.panel).forEach((img) => CoverHost.api && CoverHost.api.artUrl(img.dataset.artId).then((url) => url && (img.src = url)));
    ov.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-house-lp]');
      if (b) {
        UI.close(ov);
        this.playLP(b.dataset.houseLp);
      } else if (e.target.closest('[data-house-lp-stop]')) {
        CoverHost.stopAll();
        UI.close(ov);
      } else if (e.target.closest('[data-house-lp-big]')) {
        UI.close(ov);
        LP.open((this.disc && this.disc.id) || albums[0].id);
      }
    });
  },

  /** On the turntable it goes, the arm comes over, and the album plays from its first song. */
  async playLP(id) {
    const album = LP.info(id);
    if (!album || !album.tracks.length) return;
    State.house.record = id;
    State.statistics.houseLP = (State.statistics.houseLP || 0) + 1;
    Diary.note('lp');
    Store.save();
    await this.sendRecord();
    const ids = album.tracks.map((t) => t.id);
    setTimeout(() => {
      if (HouseRoom.ov) CoverHost.start(ids[0], ids);
    }, 650);
    Game.checkAchievements();
  },

  /* The record on the turntable to the 3D side: drawn as js/lp.js draws it, with its sleeve. */
  async sendRecord() {
    const api = HouseHost.api;
    if (!api) return;
    const id = State.house.record;
    const album = id && State.lp[id] && LP.info(id);
    if (!album) {
      this.disc = null;
      api.record(null);
      return;
    }
    if (!this.disc || this.disc.id !== id || this.disc.color !== LP.color(id).id) {
      const disc = await LP.record(album, LP.color(id));
      const art = album.artworkId ? await LP.image(album.artworkId) : null;
      this.disc = { id, disc, art, album, color: LP.color(id).id };
    }
    this.recordState();
  },

  /** …and whether it is playing, and how far it has got (the arm goes in as it plays). */
  recordState() {
    const api = HouseHost.api;
    const d = this.disc;
    if (!api || !d) return;
    const p = CoverHost.player();
    const t = d.album.tracks.find((x) => x.id === p.singleId);
    const playing = !!(t && p.playing);
    const progress = t && d.album.total ? (t.at + (p.time || 0)) / d.album.total : 0;
    api.record({ disc: d.disc, art: d.art, playing, progress });
  },

  /* The records in the cabinet: one spine for every LP, in its vinyl's colour. */
  sendSpines() {
    if (!HouseHost.api) return;
    const colors = this.lps()
      .reverse()
      .map((a) => {
        const c = LP.color(a.id);
        return c.clear ? '#dfe4ee' : c.marble ? '#ffc8dd' : c.base;
      });
    HouseHost.api.spines(colors);
  },

  /* ----- the diary on the desk ----- */

  async diarySheet() {
    Sfx.play('pop');
    if (!Diary.writable()) return UI.toast('일기장은 그녀만 쓸 수 있어요 📔', { icon: '📔' });
    const today = Diary.today();
    const ready = Diary.isOpen() && !State.diary.pages[today];
    const done = !!State.diary.pages[today];
    const days = Object.keys(State.diary.pages).sort().reverse().slice(0, 6);
    const ov = UI.open(
      `<div class="house-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>📔 일기장</h2>
        ${
          ready
            ? '<button class="btn primary huge" data-house-diary-today>✍️ 오늘의 한 장 쓰기</button>'
            : `<p class="hint">${done ? '오늘의 한 장은 벌써 썼어요 💗' : `오늘의 한 장은 ${OPENS_AT}에 열려요 (${fmtDuration(Diary.opensIn())} 남았어요). 그때까지 한 일이 차곡차곡 모여요.`}</p>`
        }
        ${days.length ? `<div class="house-pages">${days.map((d) => `<button class="house-page" data-house-diary-day="${d}"><canvas data-page="${d}" width="10" height="13"></canvas><small>${esc(fmtDay(d))}</small></button>`).join('')}</div>` : '<p class="hint">아직 쓴 일기가 없어요. 첫 장을 쓰면 여기 책상 위 일기장에 펼쳐져요.</p>'}
        <div class="dialog-actions one"><button class="btn soft" data-house-diary-all>📖 일기장 전체 보기</button></div>
      </div>`,
      { cls: 'is-house-sheet', label: '일기장' }
    );
    for (const c of $$('canvas[data-page]', ov.panel)) {
      const d = c.dataset.page;
      Diary.paint(c, d, State.diary.pages[d], 0.16).catch(() => {});
    }
    ov.panel.addEventListener('click', (e) => {
      if (e.target.closest('[data-house-diary-today]')) {
        UI.close(ov);
        Diary.open();
      } else if (e.target.closest('[data-house-diary-day]')) {
        UI.close(ov);
        Diary.open(e.target.closest('[data-house-diary-day]').dataset.houseDiaryDay);
      } else if (e.target.closest('[data-house-diary-all]')) Router.go('#/diary');
    });
  },

  /* The last page she wrote, open on the desk. */
  async sendPage() {
    const api = HouseHost.api;
    if (!api) return;
    const days = Object.keys(State.diary.pages).sort();
    const day = days[days.length - 1];
    if (!day) return api.page(null);
    if (this.pageDay === day && this.pageAt === State.diary.pages[day].at) return;
    this.pageDay = day;
    this.pageAt = State.diary.pages[day].at;
    try {
      const c = document.createElement('canvas');
      await Diary.paint(c, day, State.diary.pages[day], 0.4);
      api.page(c);
    } catch (e) {
      api.page(null);
    }
  },

  /* ----- the frames, the posters ----- */

  async frameSheet(uid) {
    Sfx.play('pop');
    const list = await Photos.all();
    if (!list.length) {
      return UI.alert({
        icon: '🖼️',
        title: '걸 사진이 아직 없어요',
        text: Opening.shut()
          ? `${Opening.whenText()}에 여우 세상이 열리면 📷로 사진을 찍을 수 있어요. 오른쪽 위 📷로 이 방을 찍어서 걸어도 돼요!`
          : '여우 세상에서 📷를 눌러 사진을 찍으면 여기에 걸 수 있어요. 오른쪽 위 📷로 이 방을 찍어서 걸어도 돼요!',
      });
    }
    const cur = State.house.photos[uid];
    const it = this.entry(uid);
    const ov = UI.open(
      `<div class="house-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>🖼️ 어떤 사진을 걸까요?</h2>
        <p class="hint">${it && it.id === 'frame-tall' ? '세로 액자예요. 네 컷 사진이 잘 어울려요.' : '고른 사진이 액자에 걸려요. 액자 모양에 맞게 가운데가 보여요.'}</p>
        <div class="house-photos">${list
          .slice(0, 60)
          .map((r) => `<button class="house-photo ${r.id === cur ? 'on' : ''} ${r.kind === 'four' ? 'is-four' : ''}" data-house-photo="${esc(r.id)}"><img src="${r.thumb}" alt=""></button>`)
          .join('')}</div>
        <div class="dialog-actions ${cur ? '' : 'one'}">
          ${cur ? '<button class="btn soft" data-house-photo-clear>비우기</button><button class="btn soft" data-house-photo-view>🔍 크게 보기</button>' : '<button class="btn soft" data-ov-close>닫기</button>'}
        </div>
      </div>`,
      { cls: 'is-house-sheet', label: '액자에 걸 사진' }
    );
    ov.panel.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-house-photo]');
      if (b) {
        State.house.photos[uid] = b.dataset.housePhoto;
        Store.save();
        Sfx.play('pop');
        UI.close(ov);
        await this.sendPhoto(uid);
        UI.toast('액자에 사진을 걸었어요 🖼️', { icon: '🖼️' });
      } else if (e.target.closest('[data-house-photo-clear]')) {
        delete State.house.photos[uid];
        Store.save();
        UI.close(ov);
        this.sendPhoto(uid);
      } else if (e.target.closest('[data-house-photo-view]')) {
        const rec = list.find((r) => r.id === cur);
        if (rec) Photos.view(rec);
      } else if (e.target.closest('[data-ov-close]')) UI.close(ov);
    });
  },

  /** A frame's picture to the 3D side (the full picture, if it is on this device — pictures are kept on the device they were taken on). */
  async sendPhoto(uid) {
    const api = HouseHost.api;
    if (!api) return;
    const id = State.house.photos[uid];
    const rec = id ? await DB.get('photos', id).catch(() => null) : null;
    if (!rec) return api.photo(uid, null);
    try {
      const img = rec.blob && window.createImageBitmap ? await createImageBitmap(rec.blob) : await loadImage(rec.thumb);
      api.photo(uid, img);
    } catch (e) {
      api.photo(uid, null);
    }
  },

  async posterSheet(uid) {
    Sfx.play('pop');
    const albums = Music.albums().filter((a) => a.artworkId || a.trackIds.length);
    if (!albums.length) {
      return UI.alert({ icon: '💿', title: '아직 앨범이 없어요', text: Opening.shut() ? `${Opening.whenText()}에 스튜디오가 열리면 커버를 모아 앨범을 만들 수 있어요. 그 앨범 그림이 포스터가 돼요.` : '내 커버에서 앨범을 만들면, 그 앨범 그림으로 포스터를 걸 수 있어요.' });
    }
    const cur = State.house.posters[uid];
    const ov = UI.open(
      `<div class="house-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>💿 어떤 앨범 포스터를 걸까요?</h2>
        <div class="house-lps">${albums
          .map((a) => `<button class="house-lp ${a.id === cur ? 'on' : ''}" data-house-poster="${esc(a.id)}"><span class="hl-art">${a.artworkId ? `<img data-art-id="${esc(a.artworkId)}" alt="">` : '<i aria-hidden="true">💿</i>'}</span><b>${esc(a.title)}</b></button>`)
          .join('')}</div>
      </div>`,
      { cls: 'is-house-sheet', label: '앨범 포스터' }
    );
    $$('[data-art-id]', ov.panel).forEach((img) => CoverHost.api && CoverHost.api.artUrl(img.dataset.artId).then((url) => url && (img.src = url)));
    ov.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-house-poster]');
      if (!b) return;
      State.house.posters[uid] = b.dataset.housePoster;
      Store.save();
      UI.close(ov);
      this.sendPoster(uid);
    });
  },

  async sendPoster(uid) {
    const api = HouseHost.api;
    if (!api) return;
    const a = Music.albums().find((x) => x.id === State.house.posters[uid]);
    if (!a) return api.poster(uid, null);
    const info = LP.info(a.id);
    const art = info && info.artworkId ? await LP.image(info.artworkId) : null;
    api.poster(uid, { art, title: a.title, artist: (info && info.artist) || '' });
  },

  /* ----- the mailbox, the calendar, the window ----- */

  mailSheet() {
    Sfx.play('pop');
    if (Post.waiting().length) return void Post.open();
    const kept = Post.kept();
    if (!kept.length) return UI.toast('우편함이 비어 있어요. 편지가 오면 깃발이 올라가요 💌', { icon: '📮' });
    const ov = UI.open(
      `<div class="house-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>📮 우편함</h2>
        <p class="hint">받은 편지 ${kept.length}통 · 누르면 다시 읽어요</p>
        <div class="house-letters">${kept
          .slice(0, 20)
          .map((l) => `<button class="house-letter" data-house-letter="${esc(l.id)}"><span aria-hidden="true">💌</span><b>${esc(l.text.slice(0, 40))}${l.text.length > 40 ? '…' : ''}</b><small>${esc(fmtDateLong(l.at))}</small></button>`)
          .join('')}</div>
      </div>`,
      { cls: 'is-house-sheet', label: '우편함' }
    );
    ov.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-house-letter]');
      if (!b) return;
      const l = kept.find((x) => x.id === b.dataset.houseLetter);
      UI.close(ov);
      if (l) Post.open(l);
    });
  },

  calendarCard() {
    Sfx.play('pop');
    const today = dateKey();
    const n = Days.count(today);
    const now = Days.on(today);
    const next = Days.upcoming(8).find((e) => e.key > today);
    UI.celebrate({
      emoji: '📅',
      title: n > 0 ? `우리가 만난 지 ${fmtNum(n)}일째` : '우리 달력',
      subtitle: now.length ? `오늘은 ${now.map((e) => e.name).join(' · ')}!` : next ? `다음은 ${next.emoji} ${next.name} · ${dLabel(daysBetween(today, next.key))}` : '',
      buttons: [{ label: '📅 달력 크게 보기', onClick: () => Router.go('#/calendar') }, { label: '닫기', primary: true }],
    });
  },

  windowCard() {
    Sfx.play('pop');
    const s = Moon.now();
    const city = CityWeather.now();
    const w = this.weather();
    const sky = SKIES[w.kind] || SKIES.clear;
    const name = city ? city.name : sky.name;
    const sun = Moon.riseSet('sun');
    const now = city ? `지금 인천은 ${josa(name, '이에요/예요')} (${city.temp}°).` : `지금 창밖은 ${josa(name, '이에요/예요')}.`;
    let text;
    if (s.dark) text = `${now} ${Moon.describe()}`;
    else text = `${now}${sun.set ? ` 오늘 해는 ${Moon.clock(sun.set)}에 져요.` : ''}${s.gold > 0.3 ? ' 노을이 지고 있어요 🌇' : ''}`;
    const icon = s.dark ? Moon.emoji() : city ? city.emoji : sky.emoji;
    const title = s.dark ? '창밖은 인천의 밤하늘' : '창밖은 지금 인천 하늘';
    // (out there is the veranda: she can step out onto it — js/veranda.js)
    if (!VerandaLife.out && !VerandaLife.whyNot()) return UI.confirm({ icon, title, text, ok: '🌱 베란다로', cancel: '닫기' }).then((go) => go && VerandaLife.go());
    UI.alert({ icon, title, text });
  },

  /* ----- arranging ----- */

  pick(uid) {
    this.held = uid;
    HouseHost.sync();
    HouseRoom.selBar();
  },

  placed(uid, place) {
    const it = this.entry(uid);
    if (!it) return;
    for (const k of ['x', 'z', 'r', 'wall', 'u', 'y']) delete it[k];
    Object.assign(it, place);
    Store.save();
    HouseHost.sync();
  },

  refused() {
    Sfx.play('error');
    UI.toast('거기에는 놓을 수 없어요. 다른 물건이나 문 앞을 피해 주세요', { icon: '🙅' });
  },

  /** From the shop: one of hers that is put away comes out; one she has not got, she can buy. */
  async buy(id) {
    const it = this.item(id);
    if (!it) return;
    if (this.storedCount(id)) return this.putOut(id);
    if (it.gift) return UI.toast('기념일에 선물로 오는 거예요 🎁', { icon: '🎁' });
    if (it.unique && this.owned(id)) return UI.toast('이미 집에 있어요', { icon: it.emoji });
    const spot = HouseHost.api ? HouseHost.api.findSpot(id) : null;
    const ok = await UI.confirm({
      icon: it.emoji,
      title: `${josa(it.name, '을/를')} 들일까요?`,
      text: `🪙 ${it.price} 코인이에요. ${spot ? '놓은 다음 끌어서 옮길 수 있어요.' : '지금은 놓을 자리가 없어서 보관함에 넣어 둘게요.'}`,
      ok: `${it.price} 🪙 사기`,
    });
    if (!ok || !Pet.spend(it.price)) return;
    Sfx.play('coin');
    Diary.add('houseNew', it.name);
    if (spot) {
      const uid = this.newUid();
      State.house.items.push({ uid, id, ...spot });
      this.held = uid;
    } else State.house.stored.push(id);
    Store.save();
    HouseHost.sync();
    HouseRoom.renderShop();
    HouseRoom.selBar();
    Game.checkAchievements();
  },

  /** One that is put away goes back into the room (where there is room for it). */
  putOut(id) {
    const spot = HouseHost.api ? HouseHost.api.findSpot(id) : null;
    if (!spot) {
      Sfx.play('error');
      return UI.toast('놓을 자리가 없어요. 다른 물건을 옮기거나 넣어 두세요', { icon: '📦' });
    }
    const i = State.house.stored.indexOf(id);
    if (i < 0) return;
    State.house.stored.splice(i, 1);
    const uid = this.newUid();
    State.house.items.push({ uid, id, ...spot });
    this.held = uid;
    Sfx.play('pop');
    Store.save();
    HouseHost.sync();
    HouseRoom.renderShop();
    HouseRoom.selBar();
  },

  /** Put the thing she has picked away (it goes to the 보관함, its picture or poster with it). */
  store(uid = this.held) {
    const h = State.house;
    const i = h.items.findIndex((x) => x.uid === uid);
    if (i < 0) return;
    const it = h.items[i];
    if ((this.item(it.id) || {}).fixed) return;
    h.items.splice(i, 1);
    h.stored.push(it.id);
    delete h.photos[uid];
    delete h.posters[uid];
    delete h.lamps[uid];
    this.held = null;
    Sfx.play('pop');
    Store.save();
    HouseHost.sync();
    HouseRoom.renderShop();
    HouseRoom.selBar();
  },

  turn(uid = this.held) {
    const it = this.entry(uid);
    if (!it || it.wall || !HouseHost.api) return;
    const p = HouseHost.api.turn(uid);
    if (!p) {
      Sfx.play('error');
      return UI.toast('돌릴 자리가 없어요. 조금 옮긴 다음 돌려 보세요', { icon: '↻' });
    }
    Object.assign(it, p);
    Sfx.play('tap');
    Store.save();
    HouseHost.sync();
  },

  async setWall(id) {
    const def = HOUSE_WALLS.find((x) => x.id === id);
    if (!def) return;
    const h = State.house;
    if (h.walls.includes(id)) {
      h.wall = id;
      Sfx.play('pop');
      Store.save();
      HouseHost.sync();
      return HouseRoom.renderShop();
    }
    this.preview = { wall: id };
    HouseHost.sync();
    const ok = await UI.confirm({ icon: '🎨', title: `${josa(def.name, '으로/로')} 도배할까요?`, text: `🪙 ${def.price} 코인이에요. 지금 벽에 미리 발라 봤어요.`, ok: `${def.price} 🪙 바꾸기` });
    this.preview = null;
    if (ok && Pet.spend(def.price)) {
      h.walls.push(id);
      h.wall = id;
      Sfx.play('coin');
      Diary.add('houseNew', `${def.name} 벽지`);
      Store.save();
    }
    HouseHost.sync();
    HouseRoom.renderShop();
  },

  async setFloor(id) {
    const def = HOUSE_FLOORS.find((x) => x.id === id);
    if (!def) return;
    const h = State.house;
    if (h.floors.includes(id)) {
      h.floor = id;
      Sfx.play('pop');
      Store.save();
      HouseHost.sync();
      return HouseRoom.renderShop();
    }
    this.preview = { floor: id };
    HouseHost.sync();
    const ok = await UI.confirm({ icon: '🪵', title: `바닥을 ${josa(def.name, '으로/로')} 깔까요?`, text: `🪙 ${def.price} 코인이에요. 지금 바닥에 미리 깔아 봤어요.`, ok: `${def.price} 🪙 바꾸기` });
    this.preview = null;
    if (ok && Pet.spend(def.price)) {
      h.floors.push(id);
      h.floor = id;
      Sfx.play('coin');
      Diary.add('houseNew', `${def.name} 바닥`);
      Store.save();
    }
    HouseHost.sync();
    HouseRoom.renderShop();
  },

  /** A bigger house: its walls move out, and everything stays where it stood. */
  async grow() {
    const h = State.house;
    const next = HOUSE_SIZES[h.size + 1];
    if (!next) return;
    const ok = await UI.confirm({ icon: '🏡', title: `${josa(next.name, '으로/로')} 넓힐까요?`, text: `🪙 ${next.price} 코인이에요. 벽이 바깥으로 넓어지고, 놓아 둔 물건은 그 자리에 그대로 있어요.`, ok: `${next.price} 🪙 넓히기` });
    if (!ok || !Pet.spend(next.price)) return;
    h.size += 1;
    Sfx.play('levelup');
    UI.confetti({ count: 80 });
    Diary.add('houseNew', next.name);
    Store.save();
    HouseHost.sync();
    HouseRoom.renderShop();
    Game.checkAchievements();
    UI.toast(`집이 ${josa(next.name, '이/가')} 됐어요! 🏡`, { icon: '🏡', kind: 'gold' });
  },

  /* ----- the presents of the days worth remembering ----- */

  /** What a day brings: the 100th day a cake, an anniversary flowers, a birthday balloons… (or nothing). */
  giftOf(e) {
    if (e.kind === 'ours' && /^\d+일$/.test(e.name)) return 'cake';
    if (e.kind === 'ours' && /주년$/.test(e.name)) return 'bouquet';
    if (e.kind === 'own') return 'balloons';
    if (['발렌타인데이', '화이트데이', '빼빼로데이'].includes(e.name)) return 'choco';
    if (e.name === '로즈데이') return 'bouquet';
    if (e.name === '핼러윈') return 'pumpkin';
    if (e.name.startsWith('크리스마스')) return 'xmas-tree';
    return null;
  },

  /** A present waiting by the door — of today, or of yesterday if she was not here then: { key, id, event }. */
  giftWaiting() {
    if (!State.house.made) return null;
    const today = dateKey();
    for (const day of [today, addDays(today, -1)]) {
      for (const e of Days.on(day)) {
        const id = this.giftOf(e);
        if (id && !State.house.gifts[`${day}:${id}`]) return { key: `${day}:${id}`, id, event: e };
      }
    }
    return null;
  },

  openGift() {
    const g = this.giftWaiting();
    if (!g) return;
    State.house.gifts[g.key] = Date.now();
    this.give(g.id, `${g.event.emoji} ${g.event.name} 선물`);
  },

  /** Something comes into the house as a present: it goes to the 보관함 (if she has one already: coins instead). */
  give(id, title) {
    const def = this.item(id);
    if (!def) return;
    const have = this.owned(id) > 0;
    Sfx.play('reward');
    UI.confetti({ count: 90 });
    if (have) Game.reward({ coins: 100 });
    else State.house.stored.push(id);
    Diary.add('houseNew', def.name);
    Store.save();
    HouseHost.sync();
    HouseRoom.refresh();
    UI.celebrate({
      emoji: def.emoji,
      title,
      subtitle: have ? `${josa(def.name, '이/가')} 벌써 있어서 코인 100개로 받았어요 🪙` : `${josa(def.name, '이/가')} 보관함에 들어왔어요!`,
      buttons: have ? [{ label: '고마워 💗', primary: true }] : [{ label: '🛋️ 지금 놓아 보기', primary: true, onClick: () => HouseRoom.ov && (HouseRoom.setEdit(true), this.putOut(id)) }, { label: '나중에' }],
    });
  },

  /* ----- Lorelei ----- */

  /** Is she coming round this time? (Never before she has met her in the foxes' world, nor at night; twice a day at most.) */
  guestDue() {
    const g = State.house.guest;
    if (!State.pet.introduced || Opening.shut()) return false;
    const hour = new Date().getHours();
    if (hour < 9 || hour >= 23) return false;
    if (!g.met) return true; // (her first visit: the housewarming)
    const today = dateKey();
    if (g.day === today && g.today >= GUEST_DAY) return false;
    if (Date.now() - g.at < GUEST_EVERY) return false;
    return Math.random() < 0.4;
  },

  /** A knock at the door — and in she comes (when the room is not being arranged, and nothing else is open over it). */
  knock(tries = 0) {
    this.guestTimer = 0;
    if (!HouseRoom.ov || !HouseHost.api || !State.pet.introduced || Opening.shut()) return;
    if (HouseRoom.editOn || HouseRoom.meOn || UI.top() !== HouseRoom.ov || HouseHost.api.doorBusy()) {
      if (tries < 8) this.guestTimer = setTimeout(() => this.knock(tries + 1), 7000);
      return;
    }
    const g = State.house.guest;
    const today = dateKey();
    this.firstVisit = !g.met;
    g.today = g.day === today ? g.today + 1 : 1;
    g.day = today;
    g.at = Date.now();
    g.met = true;
    g.visits = (g.visits || 0) + 1;
    Diary.note('houseGuest');
    Store.save();
    Sfx.play('knock');
    UI.toast(this.firstVisit ? `똑똑! ${josa(OWNER_NAME, '이/가')} 집들이에 왔어요!` : `똑똑! ${josa(OWNER_NAME, '이/가')} 놀러 왔어요`, { icon: '🚪', kind: 'gold', ms: 3600 });
    HouseHost.api.arrive(this.firstVisit ? 160 : 110 + Math.random() * 100);
    Game.checkAchievements();
  },

  guestSaid(what) {
    if (what === 'hello' && this.firstVisit) {
      // her housewarming present
      this.firstVisit = false;
      setTimeout(() => {
        if (!HouseRoom.ov) return;
        this.give('bouquet', `${OWNER_NAME}의 집들이 선물`);
      }, 3600);
    }
    if (what === 'gone') HouseRoom.refresh();
  },

  guestLine(kind) {
    const lines = { ...HOUSE_LINES, ...(CFG.houseLines || {}) };
    let k = kind;
    if (kind === 'hello' && this.firstVisit) k = 'first';
    if (kind === 'window') {
      const w = this.weather();
      if (w.kind === 'rain') k = 'window_rain';
      else if (w.kind === 'snow') k = 'window_snow';
      else if (Moon.dark()) k = 'window_night';
    }
    const list = lines[k] || lines[kind];
    if (!list || !list.length) return '';
    return pick(list)
      .replace(/\{name\}/g, State.user.nickname || '너')
      .replace(/\{me\}/g, Avatar.name())
      .replace(/\{food\}/g, Delivery.foodName());
  },

  /* ----- a picture of the room ----- */

  async snap() {
    if (!HouseHost.api || this.snapping) return;
    this.snapping = true;
    try {
      if ((await DB.keys('photos')).length >= PHOTO_MAX) {
        UI.toast(`사진첩이 가득 찼어요 (${PHOTO_MAX}장). 지난 사진을 정리하면 다시 찍을 수 있어요.`, { icon: '📷', ms: 4200 });
        return;
      }
      const canvas = HouseHost.api.capture(1440);
      if (!canvas) return;
      Sfx.play('shutter');
      const flash = HouseRoom.ov && $('[data-house-flash]', HouseRoom.ov.panel);
      if (flash && !reducedMotion()) {
        flash.classList.remove('go');
        void flash.offsetWidth;
        flash.classList.add('go');
      }
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.9));
      if (!blob) throw new Error('the picture could not be encoded');
      const rec = { id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`, blob, thumb: Photos.thumbOf(canvas), w: canvas.width, h: canvas.height, at: Date.now(), kind: 'house', scene: '', names: [] };
      await DB.put('photos', rec);
      Photos.last = rec;
      UI.toast('우리 집 사진을 사진첩에 간직했어요 📷 액자에 걸 수도 있어요', { icon: '📷' });
    } catch (err) {
      console.warn('[House] could not keep the picture', err);
      UI.toast('사진을 간직하지 못했어요. 다시 찍어 볼까요?', { icon: '📷' });
    } finally {
      this.snapping = false;
    }
  },

  /* ----- what the 3D side needs that is not in look() ----- */

  async sendAll() {
    if (!HouseHost.api) return;
    this.sendSpines();
    await this.sendRecord();
    for (const it of State.house.items) {
      if (it.id === 'frame' || it.id === 'frame-tall') this.sendPhoto(it.uid);
      else if (it.id === 'poster') this.sendPoster(it.uid);
    }
    this.sendPage();
  },

  /* ----- the card on Home ----- */

  cardHtml() {
    if (!State.onboarded && !Cloud.writer) return ''; // (his login has no onboarding: the house is there for him too — what he does in it stays on his device)
    const h = State.house;
    const gift = this.giftWaiting();
    const mail = Post.waiting().length;
    const fresh = h.made && !((h.town && h.town.outs) || (h.cook && Object.keys(h.cook.made || {}).length));
    const sprout = h.made && !fresh && !(h.veranda && h.veranda.made); // (the veranda: there, and she has not been out on it yet)
    const garden = h.made && VerandaLife.note(); //                       (…or something on it is ripe, or dry)
    const note = !h.made
      ? '새로 생겼어요! 우리 집에 들어가 볼까요?'
      : fresh
        ? '🏘️ 동네와 🍳 부엌이 새로 생겼어요!'
        : sprout
        ? '🌱 창밖 베란다에 텃밭이 새로 생겼어요!'
        : gift
        ? `${gift.event.emoji} 문 앞에 ${gift.event.name} 선물이 와 있어요`
        : garden
        ? garden
        : mail
          ? '💌 우편함에 편지가 와 있어요'
          : Moon.dark()
            ? `${Moon.emoji()} 창밖에 인천의 밤하늘이 보여요`
            : '오늘도 집에 들러 볼까요?';
    return `<button class="card house-card ${!h.made || gift || fresh || sprout ? 'is-new' : ''}" data-action="house-open" aria-label="${esc(HOUSE_NAME)}에 들어가기">
      <span class="house-ico" aria-hidden="true">🏠</span>
      <span class="house-text"><b>${esc(HOUSE_NAME)}</b><small>${esc(note)}</small></span>
      ${!h.made || fresh || sprout ? '<span class="chip chip-hot">NEW</span>' : ''}
      <span class="chev" aria-hidden="true">›</span>
    </button>`;
  },
};

/* An image from a URL (a data URL), once it is loaded. */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/* ------------------------------------------------------------------
   HouseRoom — the house on the whole screen, and what is laid over it.
   ------------------------------------------------------------------ */
const HouseRoom = {
  ov: null,
  editOn: false,
  tab: 'floor', // the shop's tab: 'floor', 'wall', 'room', 'box'
  meOn: false, //  the girl is being dressed (her drawer is open)…
  meTab: 'face', // …on this tab: 'face', 'hair', 'wear', 'feet', 'acc'
  skyTimer: 0,
  loop: null,

  html() {
    return `<div class="fox-room house-room" data-house-room>
      <div class="house-stage" data-house-stage role="img" aria-label="${esc(HOUSE_NAME)}. 손가락으로 집을 돌려 보고, 물건을 누르면 쓸 수 있어요.">
        <div class="house-wait" aria-hidden="true"><span>🏠</span></div>
        <div class="fox-bubble house-bubble" data-house-bubble="guest" data-who="${esc(OWNER_NAME)}" hidden></div>
        <div class="fox-bubble house-bubble is-me" data-house-bubble="me" data-who="${esc(Avatar.name())}" hidden></div>
        <div class="fox-bubble house-bubble is-rider" data-house-bubble="rider" data-who="🛵 ${RIDER_NAME}" hidden></div>
        <div class="fox-bubble house-bubble is-clerk" data-house-bubble="clerk" data-who="🏪 편의점 알바생" hidden></div>
        <div class="fox-bubble house-bubble is-barista" data-house-bubble="barista" data-who="☕ 카페 사장님" hidden></div>
        <div class="fox-bubble house-bubble is-cat" data-house-bubble="cat" data-who="🐈 뭉치" hidden></div>
      </div>
      <div class="fox-hud house-hud">
        <div class="fh-top">
          <button class="fh-btn" data-action="house-close" aria-label="나가기">‹</button>
          <div class="fh-id house-id"><b>🏠 ${esc(HOUSE_NAME)}</b><span data-house-sky></span></div>
          <span class="fh-coins" title="코인"><span aria-hidden="true">🪙</span> <b data-live="coins-short">${fmtCompact(State.dopamine.coins)}</b><span class="sr-only"> 코인</span></span>
          ${FoxRoom.canFullscreen() ? '<button class="fh-btn" data-action="house-full" aria-label="전체 화면 켜기/끄기">⛶</button>' : ''}
        </div>
        <div class="fh-mid">
          <div class="fox-tune" data-house-tune hidden></div>
          <button class="fox-mail" data-action="house-mail" data-house-mail hidden><span aria-hidden="true">💌</span> <b>편지가 왔어요</b><small>우편함을 눌러 보세요</small></button>
          <button class="fox-mail is-present" data-action="house-gift" data-house-gift hidden></button>
          <button class="fox-mail is-food" data-action="house-food" data-house-food hidden></button>
          <button class="fox-mail is-garden" data-action="house-veranda" data-house-garden hidden></button>
          ${State.house.taught ? '' : '<p class="fox-tip" data-house-tip>👆 물건을 눌러 보세요 · 손가락으로 밀면 집이 돌아가요</p>'}
        </div>
        <button class="fox-cam" data-action="house-snap" aria-label="방 사진 찍기"><span aria-hidden="true">📷</span></button>
        <button class="fox-cam is-light" data-action="house-light" data-house-light aria-label="불 켜기 끄기"><span aria-hidden="true">💡</span></button>
        <button class="fox-cam is-home" data-action="house-home" aria-label="처음 보던 곳으로 돌아가기"><span aria-hidden="true">🔄</span></button>
        <button class="fox-cam is-food" data-action="house-food" aria-label="배달 시키기"><span aria-hidden="true">🛵</span></button>
        <button class="fox-cam is-cook" data-action="house-kitchen" aria-label="부엌"><span aria-hidden="true">🍳</span></button>
        <button class="fox-cam is-veranda" data-action="house-veranda" data-house-veranda aria-label="베란다 텃밭"><span aria-hidden="true">🌱</span></button>
        <div class="fh-actions">
          <button class="fh-act" data-action="house-lp"><span aria-hidden="true">💿</span><b>LP 듣기</b></button>
          <button class="fh-act" data-action="house-diary"><span aria-hidden="true">📔</span><b>일기장</b></button>
          <button class="fh-act" data-action="house-mailbox"><span aria-hidden="true">📮</span><b>우편함</b></button>
          <button class="fh-act is-me" data-action="house-me"><span aria-hidden="true">🙋‍♀️</span><b data-me-name>${esc(Avatar.name())}</b></button>
          <button class="fh-act is-out ${(State.house.town && State.house.town.outs) ? '' : 'is-new'}" data-action="house-out"><span aria-hidden="true">🏘️</span><b>동네</b></button>
          <button class="fh-act is-shop" data-action="house-edit"><span aria-hidden="true">🛋️</span><b>꾸미기</b></button>
        </div>
        ${TownLife.hudHtml()}
        ${VerandaLife.hudHtml()}
      </div>
      <div class="fox-drawer house-drawer" data-house-drawer hidden>
        <div class="fd-head">
          <div class="seg fd-tabs" role="tablist" aria-label="꾸미기">
            <button class="seg-btn" role="tab" data-action="house-tab" data-tab="floor">🛋️ 가구</button>
            <button class="seg-btn" role="tab" data-action="house-tab" data-tab="wall">🖼️ 벽</button>
            <button class="seg-btn" role="tab" data-action="house-tab" data-tab="room">🎨 집</button>
            <button class="seg-btn" role="tab" data-action="house-tab" data-tab="box">📦 보관함</button>
          </div>
          <button class="btn primary small" data-action="house-edit-done">완료</button>
        </div>
        <div class="fd-body" data-house-shop></div>
      </div>
      <div class="fox-drawer house-drawer house-me" data-house-me hidden>
        <div class="fd-head">
          <div class="seg fd-tabs" role="tablist" aria-label="나 꾸미기">
            ${AVATAR_TABS.map(([tab, label]) => `<button class="seg-btn" role="tab" data-action="avatar-tab" data-tab="${tab}">${label}</button>`).join('')}
          </div>
          <button class="btn primary small" data-action="house-me-done">완료</button>
        </div>
        <button class="av-name-row" data-action="avatar-name"><span aria-hidden="true">🙋‍♀️</span><b data-me-name>${esc(Avatar.name())}</b><small>이름 바꾸기 ✏️</small></button>
        <div data-house-me-try></div>
        <div class="fd-body" data-house-me-body></div>
      </div>
      <div class="house-sel" data-house-sel hidden>
        <button class="hs-btn" data-action="house-turn" data-house-turn aria-label="돌리기">↻</button>
        <button class="hs-btn" data-action="house-store" aria-label="보관함에 넣기">📦</button>
        <button class="hs-btn is-ok" data-action="house-drop" aria-label="다 옮겼어요">✓</button>
      </div>
      <div class="fp-flash house-flash" data-house-flash aria-hidden="true"></div>
      <div class="fox-splash" data-house-splash role="status">
        <div class="fs-fox" aria-hidden="true">🏠</div>
        <h2>${esc(HOUSE_NAME)}으로 가는 중…</h2>
        <div class="fs-bar" aria-hidden="true"><i></i></div>
        <p class="fs-tip">💡 ${esc(pick(HOUSE_TIPS.filter((tip) => State.pet.introduced || !tip.includes(OWNER_NAME))))}</p>
      </div>
    </div>`;
  },

  /** Into the house. (From a tap: the browser lets the page go full screen.) `bus`: she has come home on the bus from the
   *  foxes' village (js/bus.js) — the street is shown at once, and when the ride's screen has gone the bus brings her. */
  async open({ bus = false } = {}) {
    if (this.ov) return;
    if (State.settings.foxFullscreen) FoxRoom.enterFullscreen();
    this.editOn = false;
    this.meOn = false;
    Avatar.trying = null;
    this.tuneKey = '';
    House.held = null;
    House.preview = null;
    const first = !State.house.made;
    const ov = (this.ov = UI.open(this.html(), { full: true, cls: 'is-fox is-house', label: HOUSE_NAME, onClose: () => this.closed() }));
    const panel = ov.panel;
    const splash = $('[data-house-splash]', panel);
    const bar = $('.fs-bar i', splash);
    const stage = $('[data-house-stage]', panel);
    const began = performance.now();
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    bar.style.width = '20%';
    House.furnish();
    if (!Cloud.writer) Diary.note('house');
    const ok = await HouseHost.ready();
    if (this.ov !== ov) return;
    if (!ok) {
      splash.remove();
      UI.close(ov);
      UI.alert({ icon: '🏠', title: '이 기기에서는 집을 열 수 없어요', text: '3D 화면을 보여 줄 수 없는 브라우저예요. 다른 브라우저나 기기에서 열어 주세요.' });
      return;
    }
    bar.style.width = '55%';
    await frame();
    await frame();
    if (this.ov !== ov) return;
    HouseHost.stage = stage;
    HouseHost.api.mount(stage);
    if (bus) HouseHost.api.arriveByBus();
    this.inset();
    House.sendAll();
    this.refresh();
    this.onResize = () => requestAnimationFrame(() => this.inset());
    window.addEventListener('resize', this.onResize);
    const city = () =>
      CityWeather.load().then((fresh) => {
        if (!fresh || this.ov !== ov) return;
        HouseHost.sync();
        this.refresh();
      });
    city();
    this.skyTimer = setInterval(() => {
      HouseHost.sync();
      this.refresh();
      city();
    }, 20000);
    this.loop = Loop.add(() => this.frame());
    bar.style.width = '88%';
    await frame();
    await sleep(Math.max(250, 1200 - (performance.now() - began)));
    if (this.ov !== ov) return;
    bar.style.width = '100%';
    await sleep(240);
    splash.classList.add('is-done');
    setTimeout(() => splash.remove(), 520);
    if (bus) {
      // (the ride's screen is still over the street: when it has gone, the bus comes along with her on it)
      BusRide.ready('town');
      await BusRide.landed();
      if (this.ov !== ov) return;
      HouseHost.api.townBusIn();
    }
    Game.checkAchievements();
    if (!Avatar.me().named) {
      // (the girl who lives here: she gives her a name before anything else)
      await sleep(first ? 1100 : 700);
      if (this.ov !== ov) return;
      await Avatar.askName(true);
      if (this.ov !== ov) return;
    }
    if (first) {
      await sleep(700);
      if (this.ov !== ov) return;
      UI.toast(`${HOUSE_NAME}에 온 걸 환영해요! 물건을 눌러 보고, 🛋️ 꾸미기로 마음대로 바꿔 보세요`, { icon: '🏠', kind: 'gold', ms: 5600 });
    } else if (!State.house.town.news) {
      State.house.town.news = true;
      Store.save();
      await sleep(900);
      if (this.ov !== ov) return;
      UI.toast('새로 생겼어요! 🏘️ 동네에 나가 편의점·카페·노래방·공원에 가고, 🍳 부엌에서 요리도 해요', { icon: '🏘️', kind: 'gold', ms: 6000 });
    } else if (!VerandaLife.state().news) {
      VerandaLife.state().news = true;
      Store.save();
      await sleep(900);
      if (this.ov !== ov) return;
      UI.toast('새로 생겼어요! 🌱 창밖 베란다에 텃밭이 있어요. 🌱 버튼이나 창문을 눌러 나가 봐요', { icon: '🌱', kind: 'gold', ms: 6000 });
    }
    if (House.guestDue()) House.guestTimer = setTimeout(() => House.knock(), (first ? 9000 : 6000) + Math.random() * 9000);
  },

  close() {
    if (this.ov) UI.close(this.ov);
  },

  closed() {
    this.ov = null;
    this.editOn = false;
    this.meOn = false;
    Avatar.trying = null;
    House.held = null;
    House.preview = null;
    clearInterval(this.skyTimer);
    Delivery.closed();
    TownLife.closed();
    VerandaLife.closed();
    clearTimeout(House.guestTimer);
    House.guestTimer = 0;
    if (this.loop) this.loop();
    this.loop = null;
    if (this.onResize) window.removeEventListener('resize', this.onResize);
    this.onResize = null;
    if (HouseHost.api) HouseHost.api.unmount();
    HouseHost.stage = null;
    if (!BusRide.switching) FoxRoom.leaveFullscreen(); // (on the bus to the foxes: it is full screen there too)
    if (Router.is('home')) Router.refresh();
  },

  /** Every frame while it is open: the buttons by the thing she is moving follow it, and the record's arm goes in as it plays. */
  frame() {
    if (!this.ov) return;
    const now = performance.now();
    if (!this.recAt || now - this.recAt > 500) {
      this.recAt = now;
      House.recordState();
      this.tuneChip();
      Delivery.tick();
    }
    const sel = $('[data-house-sel]', this.ov.panel);
    if (!sel || sel.hidden || !House.held || !HouseHost.api) return;
    const p = HouseHost.api.onPage(House.held);
    if (!p) return;
    sel.style.transform = `translate(${Math.round(p.x)}px, ${Math.round(p.y)}px) translate(-50%, -100%)`;
  },

  /* ----- what is written over the view ----- */

  refresh() {
    if (!this.ov) return;
    const panel = this.ov.panel;
    const sky = $('[data-house-sky]', panel);
    if (sky) sky.innerHTML = House.skyChip();
    const mail = $('[data-house-mail]', panel);
    if (mail) mail.hidden = this.editOn || !Post.waiting().length;
    const g = House.giftWaiting();
    const gift = $('[data-house-gift]', panel);
    if (gift) {
      gift.hidden = this.editOn || !g;
      if (g) gift.innerHTML = `<span aria-hidden="true">🎁</span> <b>${esc(g.event.name)} 선물이 왔어요</b><small>문 앞 상자를 눌러 보세요</small>`;
    }
    const light = $('[data-house-light]', panel);
    if (light) light.classList.toggle('is-off', !State.house.light);
    $$('[data-me-name]', panel).forEach((el) => (el.textContent = Avatar.name()));
    const bubble = $('[data-house-bubble="me"]', panel);
    if (bubble) bubble.dataset.who = Avatar.name();
    this.tuneChip();
    Delivery.chip();
    VerandaLife.chip();
  },

  /* The song on the turntable (or anywhere): what it is, pause, stop. */
  tuneChip() {
    if (!this.ov) return;
    const el = $('[data-house-tune]', this.ov.panel);
    if (!el) return;
    const p = CoverHost.player();
    const c = p.singleId && Music.get(p.singleId);
    if (!c || this.editOn) {
      el.hidden = true;
      el.dataset.id = '';
      return;
    }
    const key = `${c.id}:${p.playing}`;
    if (el.dataset.key !== key) {
      el.dataset.key = key;
      el.innerHTML = `<span class="ft-open"><span class="ft-art">${artImg(c)}</span><span class="ft-text"><b>${esc(c.title)}</b><small>${p.playing ? '🎶 흘러나오는 중' : '잠깐 멈춤'}</small></span></span>
        <button class="ft-btn" data-action="house-tune-play" aria-label="${p.playing ? '잠깐 멈추기' : '이어서 듣기'}">${p.playing ? '❚❚' : '▶'}</button>
        <button class="ft-btn" data-action="house-tune-stop" aria-label="멈추기">■</button>
        <span class="ft-bar"><i data-house-tune-bar></i></span>`;
      CoverHost.hydrateArt(el);
    }
    const bar = $('[data-house-tune-bar]', el);
    if (bar) bar.style.width = `${p.duration ? Math.min(100, (p.time / p.duration) * 100) : 0}%`;
    el.hidden = false;
  },

  /** The player changed (CoverHost.onPlayer — as often as its time moves on): the turntable and the chip follow; when a song
   *  starts or stops, the 3D side is told (Lorelei dances while something is on). */
  tune(p = CoverHost.player()) {
    if (!this.ov) return;
    TownLife.tune(p);
    House.recordState();
    this.tuneChip();
    const key = `${p.singleId || ''}:${!!p.playing}`;
    if (key === this.tuneKey) return;
    this.tuneKey = key;
    HouseHost.sync();
  },

  /* ----- arranging ----- */

  setEdit(on) {
    if (!this.ov) return;
    if (on && (TownLife.out || TownLife.cooking)) return UI.toast(TownLife.out ? '동네에 나가 있어요. 집에 돌아와서 꾸며요 🏠' : '요리하는 중이에요 🍳', { icon: '🛋️' });
    if (on && this.meOn) this.setMe(false);
    this.editOn = !!on;
    if (!on) {
      House.held = null;
      House.preview = null;
    }
    const root = $('[data-house-room]', this.ov.panel);
    root.classList.toggle('shop-open', this.editOn);
    $('[data-house-drawer]', root).hidden = !this.editOn;
    if (on) this.renderShop(true);
    this.selBar();
    this.refresh();
    HouseHost.sync();
    requestAnimationFrame(() => this.inset());
  },

  /* Tell the 3D side what of the view the buttons and the drawer cover, so that the room shows between them (or beside the drawer). */
  inset() {
    if (!this.ov || !HouseHost.api) return;
    const panel = this.ov.panel;
    const stage = $('[data-house-stage]', panel);
    const sr = stage.getBoundingClientRect();
    const bar = $('.house-hud .fh-top', panel);
    const cook = $('[data-house-cook]', panel);
    const acts = cook && !cook.hidden ? cook : $(TownLife.out ? '.house-hud .town-acts' : VerandaLife.out ? '.house-hud .veranda-acts' : '.house-hud .fh-actions', panel);
    const top = bar ? bar.getBoundingClientRect().bottom - sr.top + 6 : 0;
    const low = acts && acts.offsetHeight ? sr.bottom - acts.getBoundingClientRect().top + 6 : 0;
    if (!this.editOn && !this.meOn) return HouseHost.api.inset({ top, low });
    const drawer = $(this.meOn ? '[data-house-me]' : '[data-house-drawer]', panel);
    const side = drawer.offsetHeight > stage.clientHeight * 0.9;
    HouseHost.api.inset(side ? { right: drawer.offsetWidth, top, low } : { bottom: drawer.offsetHeight, top });
  },

  setTab(tab) {
    this.tab = tab;
    this.renderShop(true);
  },

  renderShop(fromTop = false) {
    if (!this.ov || !this.editOn) return;
    const panel = this.ov.panel;
    $$('.house-drawer .seg-btn', panel).forEach((b) => {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    const body = $('[data-house-shop]', panel);
    const y = fromTop ? 0 : body.scrollTop;
    body.innerHTML = this.shopHtml(this.tab);
    body.scrollTop = y;
    this.fillThumbs(body);
  },

  shopHtml(tab) {
    const h = State.house;
    const grid = (html, cls = '') => `<div class="shop-grid ${cls}">${html}</div>`;
    const card = (it) => {
      const placed = House.placedCount(it.id);
      const stored = House.storedCount(it.id);
      const state = stored ? `📦 ${stored}개 · 놓기` : it.unique && placed ? '✓ 집에 있어요' : `${it.price} 🪙`;
      return `<button class="shop-item ${stored ? 'owned' : ''} ${placed ? 'worn' : ''}" data-action="house-buy" data-id="${it.id}" data-sfx="none">
        <span class="shop-pic" data-house-thumb="${it.id}" aria-hidden="true">${it.emoji}</span>
        <b>${esc(it.name)}</b>${it.desc ? `<span class="shop-desc">${esc(it.desc)}</span>` : ''}
        <small>${state}</small></button>`;
    };
    if (tab === 'floor' || tab === 'wall') {
      const list = HOUSE_ITEMS.filter((it) => it.cat === tab && !it.gift);
      return `<p class="hint">${tab === 'floor' ? '누르면 집에 들어와요. 놓인 물건을 누르면 끌어서 옮기고, ↻로 돌리고, 📦로 넣어 둘 수 있어요.' : '벽에 거는 것들이에요. 놓인 걸 누르고 끌면 벽을 따라 옮겨져요.'}</p>${grid(list.map(card).join(''))}`;
    }
    if (tab === 'box') {
      const ids = Array.from(new Set(h.stored));
      if (!ids.length) return '<p class="hint">보관함이 비어 있어요. 집에 놓인 물건을 누르고 📦를 누르면 여기에 넣어 둘 수 있어요. 기념일 선물도 여기로 와요.</p>';
      return `<p class="hint">누르면 다시 집에 놓여요.</p>${grid(ids.map((id) => card(House.item(id))).join(''))}`;
    }
    // the house itself: its walls, its floor, how big it is
    const sw = (kind, list, cur, owned) =>
      grid(
        list
          .map((x) => {
            const own = owned.includes(x.id);
            return `<button class="shop-item ${own ? 'owned' : ''} ${x.id === cur ? 'worn' : ''}" data-action="${kind === 'wall' ? 'house-wall' : 'house-floor'}" data-id="${x.id}" data-sfx="none">
              <span class="shop-pic is-swatch" data-house-swatch="${kind}:${x.id}" aria-hidden="true"></span>
              <b>${esc(x.name)}</b><small>${x.id === cur ? '✓ 쓰는 중' : own ? '바꾸기' : `${x.price} 🪙`}</small></button>`;
          })
          .join('')
      );
    const next = HOUSE_SIZES[h.size + 1];
    return `<h3 class="shop-head">🏠 집 크기 <small>${esc(HOUSE_SIZES[h.size].name)}</small></h3>
      ${next ? `<button class="house-grow" data-action="house-grow"><span aria-hidden="true">🏡</span><span><b>${esc(next.name)}으로 넓히기</b><small>벽이 바깥으로 넓어져요 · 물건은 그대로</small></span><b class="hg-price">${next.price} 🪙</b></button>` : '<p class="hint">가장 넓은 집이에요 🏡</p>'}
      <h3 class="shop-head">🎨 벽지</h3>${sw('wall', HOUSE_WALLS, h.wall, h.walls)}
      <h3 class="shop-head">🪵 바닥</h3>${sw('floor', HOUSE_FLOORS, h.floor, h.floors)}`;
  },

  /* The shop's pictures are drawn one at a time, so that opening it never stutters. */
  fillThumbs(root) {
    clearTimeout(this.thumbTimer);
    const api = HouseHost.api;
    if (!api) return;
    const next = () => {
      const el = $('[data-house-thumb]:not(.has-img), [data-house-swatch]:not(.has-img)', root);
      if (!el || !el.isConnected) return;
      el.classList.add('has-img');
      let url = '';
      if (el.dataset.houseThumb) url = api.thumb(el.dataset.houseThumb);
      else {
        const [kind, id] = el.dataset.houseSwatch.split(':');
        url = api.swatch(kind, id);
      }
      if (url) el.innerHTML = `<img src="${url}" alt="">`;
      this.thumbTimer = setTimeout(next, 30);
    };
    this.thumbTimer = setTimeout(next, 60);
  },

  /* ----- dressing the girl ----- */

  /** Her drawer open (she comes forward, the camera comes close) — or shut again (what she was only trying on, she takes off). */
  setMe(on) {
    if (!this.ov) return;
    // (not while the courier is at the door, nor while she is eating: her hands are full)
    if (on && TownLife.out) return UI.toast('동네에 나가 있어요. 집에 돌아와서 꾸며요 🏠', { icon: '🙋‍♀️' });
    if (on && HouseHost.api && HouseHost.api.eating()) return UI.toast(TownLife.cooking ? `${josa(Avatar.name(), '이/가')} 요리하는 중이에요 🍳` : `${josa(Avatar.name(), '이/가')} 먹는 중이에요 😋 다 먹으면 꾸밀 수 있어요`, { icon: '🛵' });
    if (on && this.editOn) this.setEdit(false);
    this.meOn = !!on;
    if (!on) Avatar.trying = null;
    const root = $('[data-house-room]', this.ov.panel);
    root.classList.toggle('shop-open', this.meOn || this.editOn);
    $('[data-house-me]', root).hidden = !this.meOn;
    if (on) this.renderMe(true);
    this.refresh();
    HouseHost.sync();
    requestAnimationFrame(() => this.inset());
  },

  setMeTab(tab) {
    this.meTab = tab;
    this.renderMe(true);
  },

  /* `fromTop` = another tab was opened (otherwise the list stays where she had scrolled it). */
  renderMe(fromTop = false) {
    if (!this.ov) return;
    this.refresh();
    if (!this.meOn) return;
    const panel = this.ov.panel;
    $$('.house-me .seg-btn', panel).forEach((b) => {
      const on = b.dataset.tab === this.meTab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    $('[data-house-me-try]', panel).innerHTML = Avatar.tryHtml();
    const body = $('[data-house-me-body]', panel);
    const y = fromTop ? 0 : body.scrollTop;
    body.innerHTML = Avatar.sheetHtml(this.meTab);
    body.scrollTop = y;
  },

  /* The buttons by the thing she has picked: turn it, put it away, done. */
  selBar() {
    if (!this.ov) return;
    const sel = $('[data-house-sel]', this.ov.panel);
    const it = this.editOn && House.held && House.entry(House.held);
    sel.hidden = !it;
    if (!it) return;
    $('[data-house-turn]', sel).hidden = !!it.wall;
    this.frame();
  },
};

Object.assign(Actions, {
  'house-open': () => HouseRoom.open(),
  'house-close': () => HouseRoom.close(),
  'house-full': () => (FoxRoom.isFullscreen() ? FoxRoom.leaveFullscreen() : FoxRoom.enterFullscreen()),
  'house-edit': () => HouseRoom.setEdit(!HouseRoom.editOn),
  'house-edit-done': () => HouseRoom.setEdit(false),
  'house-tab': (el) => HouseRoom.setTab(el.dataset.tab),
  'house-buy': (el) => House.buy(el.dataset.id),
  'house-wall': (el) => House.setWall(el.dataset.id),
  'house-floor': (el) => House.setFloor(el.dataset.id),
  'house-grow': () => House.grow(),
  'house-turn': () => House.turn(),
  'house-store': () => House.store(),
  'house-drop': () => House.pick(null),
  'house-light': () => House.switchLight(),
  'house-snap': () => House.snap(),
  'house-home': () => HouseHost.api && HouseHost.api.home(),
  'house-lp': () => House.recordSheet(),
  'house-diary': () => House.diarySheet(),
  'house-mailbox': () => House.mailSheet(),
  'house-mail': () => House.mailSheet(),
  'house-gift': () => House.openGift(),
  'house-tune-play': () => {
    const p = CoverHost.player();
    if (p.singleId) CoverHost.play(p.singleId);
  },
  'house-tune-stop': () => CoverHost.stopAll(),
});
