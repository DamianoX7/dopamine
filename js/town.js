'use strict';
/* ==================================================================
   🏘️ 우리 동네 & 🍳 요리 — out of the door of 둘의 집, and back in
   the kitchen.

   The girl who lives in the house (js/avatar.js) goes out: round the
   corner is a street (the 3D side: js/house/town.js) with 도파민
   편의점, the convenience store — snacks to eat at its window, the
   things to cook with to take home — 카페 몽글, the café, 반짝
   코인노래방, where she sings her own covers in a booth, and 말랑
   공원, the park with its swings and its pigeons. What she buys to
   cook with goes into the fridge (State.house.pantry), and in the
   kitchen she cooks it: a recipe a step at a time, each step a tap at
   the right moment (or quick taps: beating eggs, stirring) — too late
   and it burns. What she makes, and how well, goes in the recipe
   book (State.house.cook). Then she sits down and eats it.
   ================================================================== */

const STORE_NAME = '도파민 편의점';
const CAFE_NAME = '카페 몽글';
const KARAOKE_NAME = '반짝 코인노래방';
const PARK_NAME = '말랑 공원';
const SONG_PRICE = 5;

/* The store's shelves: what goes home to cook with (kind 'ing'), and what she eats as it is (kind 'snack' — at the
   window, or at home, out of the fridge). `n`: how many she gets for the price. `months`: only in those months. */
const STORE_ITEMS = [
  { id: 'noodle', kind: 'ing', emoji: '🍜', name: '봉지라면', price: 6 },
  { id: 'egg', kind: 'ing', emoji: '🥚', name: '계란 2알', unit: '계란', price: 5, n: 2 },
  { id: 'rice', kind: 'ing', emoji: '🍚', name: '즉석밥', price: 5 },
  { id: 'kimchi', kind: 'ing', emoji: '🥬', name: '김치', price: 5 },
  { id: 'ham', kind: 'ing', emoji: '🥫', name: '캔햄', price: 8 },
  { id: 'cheese', kind: 'ing', emoji: '🧀', name: '슬라이스 치즈', price: 4 },
  { id: 'bread', kind: 'ing', emoji: '🍞', name: '식빵', price: 6 },
  { id: 'milk', kind: 'ing', emoji: '🥛', name: '우유', price: 4 },
  { id: 'mix', kind: 'ing', emoji: '🥞', name: '핫케이크 가루', price: 7 },
  { id: 'leek', kind: 'ing', emoji: '🌿', name: '대파', price: 3 },
  { id: 'samgak', kind: 'snack', emoji: '🍙', name: '참치마요 삼각김밥', price: 8, desc: '편의점의 기본' },
  { id: 'cupramen', kind: 'snack', emoji: '🍜', name: '컵라면', price: 10, desc: '뜨거운 물 붓고 3분' },
  { id: 'bananamilk', kind: 'snack', emoji: '🍌', name: '바나나 우유', price: 6, desc: '달달한 단지 우유' },
  { id: 'icecream', kind: 'snack', emoji: '🍦', name: '콘 아이스크림', price: 7 },
  { id: 'pudding', kind: 'snack', emoji: '🍮', name: '커스터드 푸딩', price: 7 },
  { id: 'odeng', kind: 'snack', emoji: '🍢', name: '어묵꼬치', price: 8, desc: '추운 날엔 따끈하게', months: [10, 11, 12, 1, 2, 3] },
];

/* The café's menu. */
const CAFE_MENU = [
  { id: 'americano', emoji: '🧊', name: '아이스 아메리카노', price: 15, desc: '시원하고 깔끔하게' },
  { id: 'strawberrylatte', emoji: '🍓', name: '딸기 라떼', price: 20, desc: '오늘의 추천!' },
  { id: 'matchalatte', emoji: '🍵', name: '녹차 라떼', price: 18, desc: '쌉싸름하고 고소하게' },
  { id: 'hotchoco', emoji: '🍫', name: '핫초코', price: 18, desc: '따뜻하고 달달하게' },
  { id: 'croffle', emoji: '🧇', name: '크로플', price: 22, desc: '바삭한 크루아상 와플' },
];

/*
 * What she can cook: what it needs from the fridge, the pot or the pan, and its steps — each a tap at the right moment
 * (kind 'time': a marker runs along a gauge, `zone` is just right, `speed` how many seconds it takes to the end) or quick
 * taps (kind 'mash': `n` of them in `time` seconds). `act`: what she does in the kitchen (js/house/kitchen.js): 'add'
 * (`item` into the pot), 'stir', 'flip', 'beat' (eggs or batter, in a bowl), 'pour' (it, into the pan), 'roll', 'done'
 * (off the heat). The last step decides it: too late, and it is burnt — `fail` is what it is then.
 */
const RECIPES = [
  {
    id: 'ramen', emoji: '🍜', name: '계란 라면', fail: '퍼진 라면', need: { noodle: 1, egg: 1 }, tool: 'pot',
    steps: [
      { kind: 'time', act: 'add', item: 'noodle', label: '🍜 면 넣기', hint: '물이 보글보글 끓을 때 면을 넣어요', gauge: '물 온도', zone: [0.62, 0.84], speed: 3.2 },
      { kind: 'time', act: 'add', item: 'egg', label: '🥚 계란 넣기', hint: '면이 반쯤 풀렸을 때 계란을 톡!', gauge: '면 익힘', zone: [0.42, 0.64], speed: 3.0 },
      { kind: 'time', act: 'done', label: '🔥 불 끄기', hint: '꼬들꼬들할 때 불을 꺼요', gauge: '꼬들 → 퍼짐', zone: [0.56, 0.78], speed: 3.6 },
    ],
  },
  {
    id: 'friedrice', emoji: '🍳', name: '김치볶음밥', fail: '탄 볶음밥', need: { rice: 1, kimchi: 1, egg: 1 }, tool: 'pan',
    steps: [
      { kind: 'time', act: 'add', item: 'kimchi', label: '🥬 김치 넣기', hint: '팬이 달궈지면 김치부터 볶아요', gauge: '팬 온도', zone: [0.6, 0.82], speed: 3.0 },
      { kind: 'time', act: 'add', item: 'rice', label: '🍚 밥 넣기', hint: '김치가 반짝반짝해지면 밥을!', gauge: '김치 볶음', zone: [0.5, 0.72], speed: 3.0 },
      { kind: 'mash', act: 'stir', label: '🥄 볶기', hint: '밥이 눌어붙지 않게 열심히 볶아요!', n: 8, time: 3.4 },
      { kind: 'time', act: 'add', item: 'egg', label: '🍳 계란 올리기', hint: '노릇해지면 계란 프라이를 올려 완성!', gauge: '노릇노릇', zone: [0.55, 0.76], speed: 3.4, last: true },
    ],
  },
  {
    id: 'toast', emoji: '🥪', name: '햄치즈 토스트', fail: '탄 토스트', need: { bread: 1, ham: 1, cheese: 1, egg: 1 }, tool: 'pan',
    steps: [
      { kind: 'time', act: 'add', item: 'egg', label: '🥚 계란 부치기', hint: '버터가 녹으면 계란을 깨 넣어요', gauge: '팬 온도', zone: [0.58, 0.8], speed: 2.8 },
      { kind: 'time', act: 'add', item: 'bread', label: '🍞 빵 굽기', hint: '계란이 하얘지면 옆에 빵을', gauge: '계란 익힘', zone: [0.48, 0.7], speed: 2.8 },
      { kind: 'time', act: 'flip', label: '🔄 뒤집기', hint: '아랫면이 노릇할 때 뒤집어요!', gauge: '노릇노릇', zone: [0.55, 0.75], speed: 2.6 },
      { kind: 'time', act: 'add', item: 'cheese', label: '🧀 햄·치즈 올리기', hint: '치즈가 녹을 때 완성!', gauge: '치즈 녹이기', zone: [0.56, 0.78], speed: 3.2, last: true },
    ],
  },
  {
    id: 'eggroll', emoji: '🥚', name: '계란말이', fail: '탄 계란말이', need: { egg: 2, leek: 1 }, tool: 'pan',
    steps: [
      { kind: 'mash', act: 'beat', item: 'egg', label: '🥢 계란 풀기', hint: '파 송송, 계란을 톡톡 풀어요!', n: 8, time: 3.2 },
      { kind: 'time', act: 'pour', item: 'egg', label: '🍳 붓기', hint: '팬이 달궈지면 얇게 부어요', gauge: '팬 온도', zone: [0.58, 0.8], speed: 3.0 },
      { kind: 'mash', act: 'roll', label: '🌀 돌돌 말기', hint: '찢어지지 않게 돌돌돌!', n: 5, time: 3.0 },
      { kind: 'time', act: 'done', label: '✨ 완성', hint: '노릇해지면 꺼내요', gauge: '노릇노릇', zone: [0.55, 0.76], speed: 3.2, last: true },
    ],
  },
  {
    id: 'pancake', emoji: '🥞', name: '핫케이크', fail: '탄 핫케이크', need: { mix: 1, milk: 1, egg: 1 }, tool: 'pan',
    steps: [
      { kind: 'mash', act: 'beat', item: 'mix', label: '🥣 반죽 섞기', hint: '가루, 우유, 계란을 휘휘 섞어요!', n: 9, time: 3.4 },
      { kind: 'time', act: 'pour', item: 'mix', label: '🍳 반죽 붓기', hint: '팬이 달궈지면 동그랗게!', gauge: '팬 온도', zone: [0.58, 0.8], speed: 3.0 },
      { kind: 'time', act: 'flip', label: '🔄 뒤집기', hint: '보글보글 구멍이 생기면 뒤집어요!', gauge: '굽기', zone: [0.56, 0.76], speed: 3.2 },
      { kind: 'time', act: 'done', label: '🍯 완성', hint: '노릇노릇할 때 접시에!', gauge: '노릇노릇', zone: [0.55, 0.74], speed: 3.0, last: true },
    ],
  },
  {
    id: 'budae', emoji: '🍲', name: '부대찌개', fail: '졸아든 부대찌개', need: { noodle: 1, ham: 1, kimchi: 1, cheese: 1 }, tool: 'pot',
    steps: [
      { kind: 'time', act: 'add', item: 'ham', label: '🥫 햄·김치 넣기', hint: '육수가 끓으면 햄이랑 김치를!', gauge: '육수 온도', zone: [0.6, 0.82], speed: 3.0 },
      { kind: 'time', act: 'add', item: 'noodle', label: '🍜 라면 사리', hint: '국물이 빨개지면 사리 투하!', gauge: '보글보글', zone: [0.5, 0.72], speed: 3.0 },
      { kind: 'time', act: 'add', item: 'cheese', label: '🧀 치즈 올리기', hint: '면이 풀리면 치즈 한 장!', gauge: '면 익힘', zone: [0.46, 0.68], speed: 2.8 },
      { kind: 'time', act: 'done', label: '🔥 불 끄기', hint: '치즈가 녹아내릴 때 불 끄기!', gauge: '졸이기', zone: [0.55, 0.76], speed: 3.4 },
    ],
  },
];
RECIPES.forEach((r) => (r.steps[r.steps.length - 1].last = true));

/* What the girl says out there, and in the kitchen ('{item}': what she is having; seasons: '…_spring' etc.). */
const TOWN_LINES = {
  go_out: ['잠깐 나갔다 올게~ 🚶‍♀️', '동네 한 바퀴 돌고 와야지', '바람 쐬러 가자~'],
  out: ['바깥 공기 좋다~', '어디부터 갈까?', '오늘 동네 분위기 좋다 🏘️'],
  out_rain: ['비 오네… ☔ 그래도 나왔다!', '빗소리 좋다~'],
  out_snow: ['눈이다! ⛄', '뽀드득 뽀드득~'],
  out_night: ['밤산책 좋다 🌙', '가로등 불빛 예쁘다'],
  home: ['다녀왔습니다~ 🏠', '역시 집이 최고야', '집 도착!'],
  put_away: ['냉장고에 쏙~ 🧊', '장 본 거 정리 끝!', '요리 재료 든든하다 💪'],
  store_fridge: ['뭐 마시지? 🥤', '바나나 우유 있다!', '음료 종류 진짜 많다'],
  store_snack: ['과자 뭐 사지…', '신상이다! 👀', '1+1이네? 🤔'],
  store_ice: ['아이스크림 먹고 싶다 🍦', '이거 맛있어 보인다'],
  pay: ['코인으로 할게요 🪙', '여기요~', '계산해 주세요!'],
  bag_yes: ['네, 주세요!', '봉투 하나 주세요~'],
  water: ['뜨거운 물 콸콸~', '3분만 기다리자 ⏱️'],
  cup_ready: ['3분 됐다! 😋', '이제 먹어도 되겠다'],
  order_cafe: ['{item} 한 잔 주세요! ☕', '{item} 하나요~', '저 {item} 주세요!'],
  thanks_cafe: ['감사합니다~ 💗', '와 예쁘다!', '잘 마실게요!'],
  cafe_menu: ['뭐 마시지~', '딸기 라떼 맛있겠다', '크로플도 먹고 싶다…'],
  karaoke_shut: ['아직 안 열었네… {opens}에 연대!', '오픈하면 꼭 와야지 🎤'],
  karaoke_wait: ['무슨 노래 부르지? 🎤', '목 풀어야지~ 아아~', '오늘 목 상태 좋은데?'],
  score: ['헤헤, 잘 불렀다! 🎤', '목 풀렸다~', '한 곡 더 할까?'],
  score_100: ['100점!!! 💯', '역시 나야~ 🎤✨'],
  swing: ['그네 타야지~', '와아~ 🎐'],
  swing_high: ['높이 높이~! 🌤️', '바람 시원해!', '꺄~ 신난다!'],
  park_tree: ['나무 냄새 좋다 🌳', '여기 공기 맑다'],
  park_tree_spring: ['벚꽃 예쁘다 🌸', '꽃잎 날린다~'],
  park_tree_summer: ['나무 그늘 시원하다 🌳', '매미 소리 들리는 것 같아'],
  park_tree_autumn: ['단풍 예쁘다 🍁', '낙엽 밟는 소리 좋아~', '가을이다 🍂'],
  park_tree_winter: ['나뭇가지에 눈 쌓였다 ❄️', '나무도 춥겠다…'],
  park_pigeon: ['비둘기다! 🐦', '구구구~', '안녕 비둘기야~'],
  park_bench: ['잠깐 쉬었다 가자', '공원 좋다~', '햇살 따뜻하다'],
  scooter: ['배달 오토바이다! 🛵', '오늘도 배달 수고하세요~'],
  big_tree: ['우리 동네 큰 나무 🌳', '여기 그늘 좋다'],
  cafe_sign: ['오늘의 추천은 딸기 라떼래 🍓'],
  // eating
  eat_samgak: ['냠! 참치마요 최고 🍙', '역시 삼각김밥!'],
  eat_cupramen: ['후루룩~ 🍜', '편의점 컵라면이 제일 맛있어'],
  eat_bananamilk: ['쪽~ 달달해 🍌', '바나나 우유는 진리야'],
  eat_icecream: ['차가워! 🍦', '녹기 전에 얼른~'],
  eat_pudding: ['푸딩 탱글탱글 🍮', '달콤해~'],
  eat_odeng: ['따끈따끈 🍢', '국물 생각난다~'],
  eat_americano: ['시원하다~ 🧊', '정신 번쩍!'],
  eat_strawberrylatte: ['딸기 진짜 많다 🍓', '달콤해~ 💗'],
  eat_matchalatte: ['고소하다 🍵', '녹차 향 좋아~'],
  eat_hotchoco: ['따뜻해~ 🍫', '몸이 사르르 녹는다'],
  eat_croffle: ['바삭바삭! 🧇', '겉바속촉이다'],
  // cooking
  cook_start: ['오늘은 내가 요리사! 👩‍🍳', '{item} 만들어 볼까?', '앞치마 착용 완료!'],
  cook_good: ['완벽해! ✨', '좋았어~', '오 잘했다!'],
  cook_ok: ['괜찮아, 괜찮아~', '음… 이 정도면 뭐!'],
  cook_burnt: ['앗! 탔다… 😭', '으앗 연기 나!', '조금… 많이 탔다 😅'],
  cook_done: ['{item} 완성! 😋', '짜잔~ {item}!', '맛있겠다~'],
  eat_burnt: ['그래도 내가 만든 거니까… 😅', '탄 맛도 맛이지 뭐!'],
  eat_ramen: ['후루룩~ 🍜', '라면엔 역시 계란!'],
  eat_friedrice: ['고소하다~ 🍳', '김치볶음밥 최고'],
  eat_toast: ['바삭바삭 🥪', '치즈 쭉~'],
  eat_eggroll: ['부드럽다~ 🥚', '계란말이 성공!'],
  eat_pancake: ['폭신폭신 🥞', '시럽 듬뿍~'],
  eat_budae: ['얼큰하다 🍲', '햄이 쫄깃해!'],
  fridge: ['냉장고에서 하나 꺼내 먹어야지 🧊', '{item} 먹을까?'],
};
/* …and the people on the street: the girl at the store's till, the woman at the café ('{item}', '{n}', '{price}'). */
const CLERK_LINES = {
  hello: ['어서 오세요~ 도파민 편의점입니다!', '어서 오세요! 😊', '안녕하세요~'],
  total: ['{n}개 해서 {price}코인입니다~', '총 {price}코인입니다!'],
  bag: ['봉투 필요하세요?', '봉투 드릴까요?'],
  thanks: ['감사합니다~ 안녕히 가세요!', '맛있게 드세요~ 또 오세요!'],
  bye: ['또 오세요~ 👋', '안녕히 가세요~'],
  tap: ['네~ 필요한 거 있으세요?', '오늘 1+1 많아요!', '천천히 둘러보세요~'],
};
const BARISTA_LINES = {
  hello: ['어서 오세요~ 카페 몽글입니다 ☁', '어서 오세요! 오늘 딸기 라떼 맛있어요 🍓'],
  ok: ['네~ {item} 하나요! 잠시만요 😊', '{item} 금방 만들어 드릴게요!'],
  ready: ['주문하신 {item} 나왔습니다~', '{item} 나왔어요! 맛있게 드세요 💗'],
  bye: ['또 오세요~ ☁', '좋은 하루 보내세요!'],
  tap: ['오늘 날씨에 딱 맞는 음료 있어요~', '크로플 방금 구웠어요!', '천천히 쉬다 가세요 ☁'],
};

const TownLife = {
  out: false, //      she is out (the street is shown)
  place: 'street', // …at: 'street', 'store', 'cafe', 'karaoke', 'park'
  basket: {}, //      the store: what she has picked (id → how many)
  bag: null, //       …paid for, to eat (ids) — at the window, or home
  item: '', //        what she is having (for the lines: '{item}')
  till: null, //      what is being paid for at the till: { n, price }
  song: null, //      what she is singing: { id, title }
  cooking: null, //   the recipe she is cooking, and how it goes

  /* ----- what is hers ----- */

  state() {
    const h = State.house;
    if (!h.pantry || typeof h.pantry !== 'object') h.pantry = {};
    if (!h.cook || typeof h.cook !== 'object') h.cook = { made: {}, best: {}, burnt: 0, kitchen: false };
    if (!h.town || typeof h.town !== 'object') h.town = { outs: 0, shops: 0, cafe: {}, sung: 0, swings: 0 };
    return h;
  },
  storeItem: (id) => STORE_ITEMS.find((x) => x.id === id) || null,
  cafeItem: (id) => CAFE_MENU.find((x) => x.id === id) || null,
  recipe: (id) => RECIPES.find((x) => x.id === id) || null,
  /** On the shelves this month? */
  inSeason(it) {
    return !it.months || it.months.includes(new Date().getMonth() + 1);
  },
  have(id) {
    return this.state().pantry[id] || 0;
  },
  /** Can she cook it: everything it needs in the fridge? */
  canCook(r) {
    return Object.entries(r.need).every(([id, n]) => this.have(id) >= n);
  },
  /** What she has that is ready to eat (at home: out of the fridge). */
  snacks() {
    return STORE_ITEMS.filter((it) => it.kind === 'snack' && this.have(it.id) > 0);
  },
  itemName() {
    return this.item || '';
  },

  /* ----- out of the door, and home again ----- */

  /** Can she go out now? (Not in the middle of something at home — and not while Lorelei is visiting.) → why not, or ''. */
  whyNot() {
    const api = HouseHost.api;
    if (!api || !HouseRoom.ov) return '…';
    if (Delivery.pending()) return `🛵 ${josa(Delivery.foodName(), '이/가')} 오고 있어요. 받고 나서 나갈 수 있어요`;
    if (Delivery.busy() || api.eating()) return `${josa(Avatar.name(), '이/가')} 먹는 중이에요 😋 다 먹고 나갈 수 있어요`;
    if (this.cooking) return `${josa(Avatar.name(), '이/가')} 요리하는 중이에요 🍳`;
    if (api.guestHere()) return `${josa(OWNER_NAME, '이/가')} 놀러 와 있어요. ${josa(OWNER_NAME, '이랑/랑')} 놀고 나서 나가요 💗`;
    if (api.doorBusy()) return '현관에 누가 있어요. 잠깐만 기다려 주세요';
    return '';
  },

  /** Out she goes (the 🏘️ button, the door) — asleep, up first (the store is open all night). */
  goOut() {
    const why = this.whyNot();
    if (why) return UI.toast(why, { icon: '🏘️' });
    if (HouseRoom.editOn) HouseRoom.setEdit(false);
    if (HouseRoom.meOn) HouseRoom.setMe(false);
    if (!HouseHost.api.goOut()) return UI.toast('지금은 나갈 수 없어요. 잠깐 뒤에 다시 해 보세요', { icon: '🏘️' });
    Sfx.play('pop');
  },

  /** The 3D side: she is out ('out'), has come somewhere ('arrive'), has paid ('paid'), sings ('singing'), has sung
   *  ('sung'), is home ('home'). */
  said(what, o) {
    if (what === 'out') return this.wentOut();
    if (what === 'home') return this.cameHome();
    if (what === 'arrive') return this.arrived(o);
    if (what === 'paid') return this.paid();
    if (what === 'singing') return this.singing(o);
    if (what === 'sung') return this.sung(o);
    if (what === 'wander') {
      this.place = 'street';
      this.closeSheets();
      this.hud();
    }
  },

  wentOut() {
    const t = this.state().town;
    t.outs = (t.outs || 0) + 1;
    t.news = true;
    if (HouseRoom.ov) $$('.fh-act.is-out', HouseRoom.ov.panel).forEach((b) => b.classList.remove('is-new'));
    this.out = true;
    this.place = 'street';
    Diary.note('townOut');
    Store.save();
    this.hud();
    Game.checkAchievements();
    // (what she says out of the door: the weather, the hour)
    const w = House.weather();
    setTimeout(() => {
      const line = w.kind === 'rain' ? 'out_rain' : w.kind === 'snow' ? 'out_snow' : Moon.dark() ? 'out_night' : null;
      if (line && HouseHost.api && this.out) HouseHost.api.townSay(line);
    }, 2600);
    if (!State.house.town.taught) {
      State.house.town.taught = true;
      Store.save();
      setTimeout(() => this.out && UI.toast('아래 버튼으로 갈 곳을 고르거나, 길을 누르면 그쪽으로 걸어가요', { icon: '🏘️', ms: 5200 }), 1800);
    }
  },

  cameHome() {
    this.out = false;
    this.place = 'street';
    // (what she bought to eat at home and has not eaten: into the fridge)
    this.keepBag();
    this.basket = {};
    this.hud();
    HouseRoom.refresh();
  },

  /** She has been sent somewhere: 'store', 'cafe', 'karaoke', 'park', 'home'. */
  go(place) {
    if (!this.out || !HouseHost.api) return;
    const api = HouseHost.api;
    if (api.townBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    if (place === 'park' && this.place === 'park') return UI.toast(`${PARK_NAME}에 있어요 🌳 그네를 누르면 그네를 타요`, { icon: '🌳' });
    if (place === this.place && place !== 'home' && place !== 'street') return this.arrived(place);
    if (!api.townGo(place)) return;
    this.place = place === 'home' ? 'street' : place;
    Sfx.play('tap');
    if (place !== 'home') this.closeSheets();
    this.hud();
  },

  busyText() {
    const api = HouseHost.api;
    const b = api && api.townBusy();
    return b === 'till' ? '계산하는 중이에요 🧾' : b === 'eat' ? '먹는 중이에요 😋' : b === 'cafe' ? '음료 기다리는 중이에요 ☕' : b === 'sing' ? '노래하는 중이에요 🎤' : b === 'home' ? '집에 들어가는 중이에요 🏠' : '잠깐만요!';
  },

  /** A tap on the street: a shop, her house, the swings, the scooter, a pigeon. */
  tapped(kind) {
    if (kind === 'store' || kind === 'cafe' || kind === 'karaoke' || kind === 'park' || kind === 'home') return this.go(kind);
    if (kind === 'swing') {
      if (this.place !== 'park') return this.go('park');
      return HouseHost.api && HouseHost.api.townSwing();
    }
    if (kind === 'scooter') return UI.toast('도파민 배달 오토바이예요 🛵 오늘도 열심히 배달 중!', { icon: '🛵' });
    if (kind === 'pigeon') return UI.toast('구구구… 비둘기가 모이를 찾고 있어요 🐦', { icon: '🐦' });
  },

  arrived(place) {
    this.place = place;
    this.hud();
    if (place === 'store') return this.storeSheet();
    if (place === 'cafe') return this.cafeSheet();
    if (place === 'karaoke') return Opening.shut() ? UI.toast(`${KARAOKE_NAME}은 ${Opening.whenText()}에 문을 열어요 🎤`, { icon: '🎤', ms: 3600 }) : this.karaokeSheet();
    if (place === 'park') {
      State.house.town.parks = (State.house.town.parks || 0) + 1;
      Store.save();
      return UI.toast(`${PARK_NAME}에 왔어요 🌳 그네를 누르면 그네를 타요`, { icon: '🌳' });
    }
  },

  closeSheets() {
    for (const ov of [...UI.stack]) if (ov.opts && /is-town-sheet/.test(ov.opts.cls || '')) UI.close(ov);
  },

  /** A sheet open over the bottom of the view: the view moves up out of its way, so that she shows above it. */
  sheet(html, label) {
    const ov = UI.open(html, { cls: 'is-house-sheet is-town-sheet', label, onClose: () => requestAnimationFrame(() => HouseRoom.inset()) });
    this.lift(ov);
    return ov;
  },

  lift(ov) {
    requestAnimationFrame(() => {
      if (!ov || ov.closed || !HouseHost.api || !HouseRoom.ov) return;
      const panel = HouseRoom.ov.panel;
      const stage = $('[data-house-stage]', panel);
      const bar = $('.house-hud .fh-top', panel);
      if (!stage) return;
      const sr = stage.getBoundingClientRect();
      const top = bar ? bar.getBoundingClientRect().bottom - sr.top + 6 : 0;
      // (only a sheet along the bottom of a phone's screen: on a wide one it opens in the middle, over the view)
      const r = ov.panel.getBoundingClientRect();
      if (r.width < sr.width * 0.9) return;
      const h = ov.panel.offsetHeight; // (the laid-out size: it is still sliding up)
      HouseHost.api.inset({ bottom: Math.min(h, sr.height * 0.7), top });
    });
  },

  /* ----- 도파민 편의점 ----- */

  storeTab: 'snack',

  storeSheet() {
    if (!this.out || this.place !== 'store') return;
    Sfx.play('pop');
    this.closeSheets();
    const ov = this.sheet(`<div class="house-sheet town-sheet" data-store-sheet></div>`, STORE_NAME);
    this.storeOv = ov;
    this.renderStore();
    this.lift(ov);
    ov.panel.addEventListener('click', (e) => {
      const tab = e.target.closest('[data-store-tab]');
      if (tab) {
        this.storeTab = tab.dataset.storeTab;
        Sfx.play('tap');
        return this.renderStore();
      }
      const plus = e.target.closest('[data-store-add]');
      if (plus) return this.toBasket(plus.dataset.storeAdd, 1);
      const minus = e.target.closest('[data-store-less]');
      if (minus) return this.toBasket(minus.dataset.storeLess, -1);
      if (e.target.closest('[data-store-pay]')) return this.pay();
      if (e.target.closest('[data-store-leave]')) {
        UI.close(ov);
        return this.go('street');
      }
    });
  },

  renderStore() {
    const ov = this.storeOv;
    if (!ov || ov.closed) return;
    const root = $('[data-store-sheet]', ov.panel);
    const y = $('.store-grid', root) ? $('.store-grid', root).scrollTop : 0;
    const list = STORE_ITEMS.filter((it) => it.kind === (this.storeTab === 'ing' ? 'ing' : 'snack') && this.inSeason(it));
    const n = Object.values(this.basket).reduce((s, x) => s + x, 0);
    const total = this.basketTotal();
    root.innerHTML = `<div class="sheet-handle" aria-hidden="true"></div>
      <h2>🏪 ${esc(STORE_NAME)}</h2>
      <div class="seg store-tabs" role="tablist">
        <button class="seg-btn ${this.storeTab !== 'ing' ? 'on' : ''}" role="tab" data-store-tab="snack">🍙 바로 먹을 것</button>
        <button class="seg-btn ${this.storeTab === 'ing' ? 'on' : ''}" role="tab" data-store-tab="ing">🥚 요리 재료</button>
      </div>
      <p class="hint">${this.storeTab === 'ing' ? '재료는 집 냉장고에 들어가요. 🍳 부엌에서 요리할 수 있어요.' : '창가 자리에서 먹고 가거나, 집에 가져갈 수 있어요.'}</p>
      <div class="store-grid">${list
        .map((it) => {
          const k = this.basket[it.id] || 0;
          const have = this.have(it.id);
          return `<div class="store-item ${k ? 'on' : ''}">
            <button class="si-pic" data-store-add="${it.id}" aria-label="${esc(it.name)} 담기"><span data-town-thumb="${it.kind}:${it.id}">${it.emoji}</span>${k ? `<i class="si-n">${k}</i>` : ''}</button>
            <b>${esc(it.name)}</b>
            ${it.desc ? `<span class="si-desc">${esc(it.desc)}</span>` : ''}
            <small>${it.price} 🪙${have ? ` · 냉장고 ${have}` : ''}</small>
            <div class="si-step">${k ? `<button class="si-btn" data-store-less="${it.id}" aria-label="빼기">−</button>` : ''}<button class="si-btn is-add" data-store-add="${it.id}" aria-label="담기">＋</button></div>
          </div>`;
        })
        .join('')}</div>
      <div class="store-bar">
        <span class="sb-basket"><span aria-hidden="true">🧺</span> ${n ? `<b>${n}개</b> · ${total} 🪙` : '장바구니가 비어 있어요'}</span>
        <button class="btn primary" data-store-pay ${n ? '' : 'disabled'}>${n ? `${total} 🪙 계산하기` : '계산하기'}</button>
      </div>
      <button class="link-btn store-leave" data-store-leave>🚪 가게에서 나가기</button>`;
    const grid = $('.store-grid', root);
    grid.scrollTop = y;
    this.thumbs(root);
  },

  toBasket(id, d) {
    const it = this.storeItem(id);
    if (!it) return;
    const k = Math.max(0, Math.min(9, (this.basket[id] || 0) + d));
    if (k) this.basket[id] = k;
    else delete this.basket[id];
    Sfx.play(d > 0 ? 'pop' : 'tap');
    this.renderStore();
  },

  basketTotal() {
    return Object.entries(this.basket).reduce((s, [id, k]) => s + ((this.storeItem(id) || {}).price || 0) * k, 0);
  },

  /** 계산하기: the coins, then at the till in 3D — what is to cook with goes into the fridge at once; what is to eat, she decides. */
  pay() {
    const api = HouseHost.api;
    const entries = Object.entries(this.basket).filter(([id, k]) => k > 0 && this.storeItem(id));
    if (!api || !entries.length) return;
    if (api.townBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    const total = this.basketTotal();
    if (!Pet.spend(total)) return;
    Sfx.play('coin');
    const h = this.state();
    const snacks = [];
    const names = [];
    for (const [id, k] of entries) {
      const it = this.storeItem(id);
      names.push(it.name);
      if (it.kind === 'ing') h.pantry[id] = (h.pantry[id] || 0) + k * (it.n || 1);
      else for (let i = 0; i < k; i++) snacks.push(id);
    }
    h.town.shops = (h.town.shops || 0) + 1;
    h.town.spent = (h.town.spent || 0) + total;
    names.forEach((nm) => Diary.add('shop', nm));
    this.bag = snacks.length ? snacks : null;
    this.till = { n: entries.reduce((s, [, k]) => s + k, 0), price: total };
    this.basket = {};
    Store.save();
    if (this.storeOv) UI.close(this.storeOv);
    api.townCheckout(entries.map(([id, k]) => ({ id, n: k })));
    Game.checkAchievements();
  },

  /** Paid: what she bought to eat — here, at the window, or at home? */
  async paid() {
    const bag = this.bag;
    if (!bag || !bag.length) return UI.toast('장 본 건 집 냉장고에 넣어 둘게요 🧊', { icon: '🛍️' });
    const names = bag.map((id) => this.storeItem(id).name);
    const ok = await UI.confirm({
      icon: '🪑',
      title: '여기서 먹고 갈까요?',
      text: `${names.slice(0, 3).join(', ')}${names.length > 3 ? ` 외 ${names.length - 3}개` : ''} — 창가 자리에서 먹을 수 있어요. 집에 가져가면 냉장고에 넣어 둘게요.`,
      ok: '🪑 여기서 먹기',
      cancel: '🏠 집에 가져가기',
    });
    if (this.bag !== bag) return;
    if (ok && HouseHost.api && this.out) {
      // (three at most, at one sitting: the rest go home)
      const here = bag.slice(0, 3);
      this.bag = bag.slice(3);
      this.keepBag();
      HouseHost.api.townEatHere(here);
    } else {
      this.keepBag();
      UI.toast('냉장고에 넣어 둘게요 🧊 집에서 꺼내 먹을 수 있어요', { icon: '🛍️' });
    }
  },

  /* What she bought to eat but has not: into the fridge. */
  keepBag() {
    if (!this.bag || !this.bag.length) return;
    const h = this.state();
    this.bag.forEach((id) => (h.pantry[id] = (h.pantry[id] || 0) + 1));
    this.bag = null;
    Store.save();
  },

  /* ----- 카페 몽글 ----- */

  cafeSheet() {
    if (!this.out || this.place !== 'cafe') return;
    Sfx.play('pop');
    this.closeSheets();
    const done = this.state().town.cafe || {};
    const ov = this.sheet(
      `<div class="house-sheet town-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>☕ ${esc(CAFE_NAME)}</h2>
        <p class="hint">고르면 사장님이 만들어 줘요. 자리에 앉아서 마시고 가요.</p>
        <div class="food-menu">${CAFE_MENU.map((it) => `<button class="food-item" data-cafe="${it.id}">
            <span class="food-pic" data-town-thumb="snack:${it.id}" aria-hidden="true">${it.emoji}</span>
            <b>${esc(it.name)}</b><span class="food-desc">${esc(it.desc || '')}</span>
            <small><b>${it.price} 🪙</b></small>
            ${done[it.id] ? `<i class="food-ate">${done[it.id]}번 마셨어요</i>` : ''}
          </button>`).join('')}</div>
        <button class="link-btn store-leave" data-cafe-leave>🚪 카페에서 나가기</button>
      </div>`,
      CAFE_NAME
    );
    this.thumbs(ov.panel);
    ov.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-cafe]');
      if (b) {
        UI.close(ov);
        return this.cafeOrder(b.dataset.cafe);
      }
      if (e.target.closest('[data-cafe-leave]')) {
        UI.close(ov);
        this.go('street');
      }
    });
  },

  cafeOrder(id) {
    const it = this.cafeItem(id);
    const api = HouseHost.api;
    if (!it || !api) return;
    if (api.townBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    if (!Pet.spend(it.price)) return;
    Sfx.play('coin');
    this.item = it.name;
    api.townCafe({ id, name: it.name });
  },

  /* ----- 반짝 코인노래방 ----- */

  karaokeSheet() {
    if (!this.out || this.place !== 'karaoke') return;
    Sfx.play('pop');
    this.closeSheets();
    const covers = Music.all();
    const ov = this.sheet(
      `<div class="house-sheet town-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>🎤 ${esc(KARAOKE_NAME)}</h2>
        <p class="hint">${covers.length ? `내 커버를 골라요. 한 곡에 ${SONG_PRICE} 🪙 · 부스에서 ${josa(Avatar.name(), '이/가')} 불러요!` : '아직 부를 내 커버가 없어요. 스튜디오에서 첫 커버를 녹음하면 여기서 부를 수 있어요.'}</p>
        ${covers.length ? `<div class="town-songs">${covers.slice(0, 40).map((c) => `<button class="town-song" data-song="${esc(c.id)}"><span class="ts-art">${artImg(c)}</span><span class="ts-text"><b>${esc(c.title)}</b><small>${esc(c.originalArtist || '내 커버')}</small></span><span class="ts-go">${SONG_PRICE} 🪙</span></button>`).join('')}</div>` : ''}
        <div class="dialog-actions one"><button class="btn soft" data-karaoke-studio>🎙️ 스튜디오에서 새로 녹음하기</button></div>
        <button class="link-btn store-leave" data-karaoke-leave>🚪 노래방에서 나가기</button>
      </div>`,
      KARAOKE_NAME
    );
    CoverHost.hydrateArt(ov.panel);
    ov.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-song]');
      if (b) {
        UI.close(ov);
        return this.sing(b.dataset.song);
      }
      if (e.target.closest('[data-karaoke-studio]')) {
        UI.close(ov);
        return Actions.sing();
      }
      if (e.target.closest('[data-karaoke-leave]')) {
        UI.close(ov);
        this.go('street');
      }
    });
  },

  sing(id) {
    const c = Music.get(id);
    const api = HouseHost.api;
    if (!c || !api) return;
    if (api.townBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    if (!Pet.spend(SONG_PRICE)) return;
    Sfx.play('coin');
    this.song = { id, title: c.title };
    api.townSing(this.song);
  },

  /** In the booth, the mic in her hand: on goes her song. */
  singing(song) {
    if (!song) return;
    CoverHost.stopAll();
    setTimeout(() => {
      if (this.song && this.song.id === song.id) {
        CoverHost.start(song.id);
        this.songStarted = Date.now();
      }
    }, 400);
  },

  /** (the player changed: her song has ended, or was stopped — the score comes up) */
  tune(p) {
    if (!this.song || !this.songStarted || Date.now() - this.songStarted < 1500) return;
    if (p.singleId === this.song.id && p.playing) return;
    if (p.singleId === this.song.id && p.duration && p.time < p.duration - 0.6 && !p.ended) return; // (paused for a moment)
    this.songStarted = 0;
    if (HouseHost.api) HouseHost.api.townSingEnd();
  },

  sung(o) {
    const song = this.song;
    this.song = null;
    this.songStarted = 0;
    CoverHost.stopAll();
    if (!song) return;
    const t = this.state().town;
    t.sung = (t.sung || 0) + 1;
    t.best = Math.max(t.best || 0, (o && o.score) || 0);
    Diary.add('coin', song.title);
    Store.save();
    Game.checkAchievements();
    if (o && o.score) setTimeout(() => UI.toast(`🎤 ${o.score}점! ${o.score >= 100 ? '완벽한 무대였어요 💯' : '최고의 무대였어요 👏'}`, { icon: '🎤', kind: 'gold', ms: 3600 }), 300);
  },

  /* ----- what is eaten: at the window, at the café, at home ----- */

  /** She has eaten something (it is all gone): `source` 'store', 'cafe', 'snack' (at home, out of the fridge), 'cook'. */
  ate(source, id) {
    const t = this.state().town;
    if (source === 'cafe') {
      t.cafe = t.cafe || {};
      t.cafe[id] = (t.cafe[id] || 0) + 1;
      const it = this.cafeItem(id);
      if (it) Diary.add('cafe', it.name);
    } else if (source === 'store' || source === 'snack') {
      t.ate = t.ate || {};
      t.ate[id] = (t.ate[id] || 0) + 1;
      const it = this.storeItem(id);
      if (it) Diary.add('snack', it.name);
    }
    if (source === 'cook') this.cooking = null;
    if (source === 'cook' || source === 'snack') {
      this.eating = null;
      HouseRoom.refresh();
    }
    Store.save();
    Game.checkAchievements();
  },

  /** At home: something out of the fridge, to eat as it is. */
  eatSnack(id) {
    const api = HouseHost.api;
    const it = this.storeItem(id);
    if (!api || !it || !this.have(id)) return;
    const why = this.whyNotCook(true);
    if (why) return UI.toast(why, { icon: '🧊' });
    const h = this.state();
    h.pantry[id] -= 1;
    if (!h.pantry[id]) delete h.pantry[id];
    Store.save();
    this.item = it.name;
    this.eating = id;
    api.eatSnack(id);
    Sfx.play('pop');
  },

  /* ----- 🍳 the kitchen ----- */

  /** Why she cannot cook (or eat) now — or ''. */
  whyNotCook(snack = false) {
    const api = HouseHost.api;
    if (!api || !HouseRoom.ov) return '…';
    if (this.out) return '밖에 나가 있어요. 집에 돌아와서 해요 🏠';
    if (this.cooking) return '요리하는 중이에요 🍳';
    if (this.eating || Delivery.busy() || api.eating()) return `${josa(Avatar.name(), '이/가')} 먹는 중이에요 😋`;
    if (api.doorBusy()) return '현관에 누가 와 있어요. 잠깐만요!';
    if (!snack && api.guestHere()) return `${josa(OWNER_NAME, '이/가')} 놀러 와 있어요 💗 ${josa(OWNER_NAME, '이/가')} 가면 요리해요`;
    return '';
  },

  kitchenTab: 'cook',

  /** The kitchen's sheet: the recipes (what each needs, what she has), the fridge (what she can eat as it is). */
  kitchenSheet(tab) {
    if (tab) this.kitchenTab = tab;
    Sfx.play('pop');
    const ov = this.sheet(`<div class="house-sheet town-sheet" data-kitchen-sheet></div>`, '부엌');
    this.kitchenOv = ov;
    this.renderKitchen();
    this.lift(ov);
    ov.panel.addEventListener('click', (e) => {
      const tb = e.target.closest('[data-kitchen-tab]');
      if (tb) {
        this.kitchenTab = tb.dataset.kitchenTab;
        Sfx.play('tap');
        return this.renderKitchen();
      }
      const r = e.target.closest('[data-cook]');
      if (r && !r.disabled) {
        UI.close(ov);
        return this.cook(r.dataset.cook);
      }
      const sn = e.target.closest('[data-snack]');
      if (sn) {
        UI.close(ov);
        return this.eatSnack(sn.dataset.snack);
      }
      if (e.target.closest('[data-kitchen-shop]')) {
        UI.close(ov);
        return this.goOut();
      }
    });
  },

  renderKitchen() {
    const ov = this.kitchenOv;
    if (!ov || ov.closed) return;
    const root = $('[data-kitchen-sheet]', ov.panel);
    const h = this.state();
    const fridge = Object.entries(h.pantry).filter(([, n]) => n > 0);
    const ings = fridge.filter(([id]) => (this.storeItem(id) || {}).kind === 'ing');
    const snacks = this.snacks();
    const tabs = `<div class="seg store-tabs" role="tablist">
        <button class="seg-btn ${this.kitchenTab === 'cook' ? 'on' : ''}" data-kitchen-tab="cook">🍳 요리하기</button>
        <button class="seg-btn ${this.kitchenTab === 'fridge' ? 'on' : ''}" data-kitchen-tab="fridge">🧊 냉장고${snacks.length ? ` <i class="tab-dot">${snacks.reduce((s, it) => s + this.have(it.id), 0)}</i>` : ''}</button>
      </div>`;
    let body;
    if (this.kitchenTab === 'fridge') {
      body = `<h3 class="shop-head">🍙 바로 먹을 수 있어요</h3>
        ${snacks.length ? `<div class="food-menu">${snacks.map((it) => `<button class="food-item" data-snack="${it.id}"><span class="food-pic" data-town-thumb="snack:${it.id}" aria-hidden="true">${it.emoji}</span><b>${esc(it.name)}</b><small>${this.have(it.id)}개 · 꺼내 먹기</small></button>`).join('')}</div>` : '<p class="hint">편의점에서 먹을 걸 사서 집에 가져오면 여기 있어요.</p>'}
        <h3 class="shop-head">🥚 요리 재료</h3>
        ${ings.length ? `<div class="fridge-chips">${ings.map(([id, n]) => `<span class="fridge-chip"><span aria-hidden="true">${this.storeItem(id).emoji}</span>${esc(this.storeItem(id).unit || this.storeItem(id).name)} <b>${n}</b></span>`).join('')}</div>` : '<p class="hint">재료가 없어요. 🏪 편의점에서 사 올 수 있어요.</p>'}
        <div class="dialog-actions one"><button class="btn soft" data-kitchen-shop>🏪 편의점에 장 보러 가기</button></div>`;
    } else {
      body = `<p class="hint">재료가 다 있으면 만들 수 있어요. 타이밍 맞춰 누르면 별 세 개!</p>
        <div class="recipe-list">${RECIPES.map((r) => {
          const can = this.canCook(r);
          const best = h.cook.best[r.id] || 0;
          const made = h.cook.made[r.id] || 0;
          return `<button class="recipe ${can ? 'can' : ''}" data-cook="${r.id}" ${can ? '' : 'disabled'}>
            <span class="rc-pic" data-town-thumb="snack:${r.id}" aria-hidden="true">${r.emoji}</span>
            <span class="rc-text"><b>${esc(r.name)}</b>
              <span class="rc-need">${Object.entries(r.need).map(([id, n]) => {
                const it = this.storeItem(id);
                const ok = this.have(id) >= n;
                return `<span class="rc-ing ${ok ? 'ok' : ''}">${it.emoji}${n > 1 ? `×${n}` : ''}</span>`;
              }).join('')}</span>
              <small>${made ? `${'⭐'.repeat(best)}${'☆'.repeat(3 - best)} · ${made}번 만들었어요` : '아직 안 만들어 봤어요'}</small></span>
            <span class="rc-go">${can ? '만들기' : '재료 부족'}</span>
          </button>`;
        }).join('')}</div>
        <div class="dialog-actions one"><button class="btn soft" data-kitchen-shop>🏪 편의점에 장 보러 가기</button></div>`;
    }
    root.innerHTML = `<div class="sheet-handle" aria-hidden="true"></div><h2>🍳 부엌</h2>${tabs}${body}`;
    this.thumbs(root);
  },

  /** She cooks `id`: the kitchen first (if there is none: one is given — a present to start her cooking with). */
  async cook(id) {
    const r = this.recipe(id);
    const api = HouseHost.api;
    if (!r || !api) return;
    const why = this.whyNotCook();
    if (why) return UI.toast(why, { icon: '🍳' });
    if (!this.canCook(r)) return UI.toast('재료가 부족해요. 🏪 편의점에서 사 올 수 있어요', { icon: '🥚' });
    if (!(await this.kitchenReady())) return;
    if (this.whyNotCook()) return;
    // the ingredients come out of the fridge
    const h = this.state();
    for (const [ing, n] of Object.entries(r.need)) {
      h.pantry[ing] -= n;
      if (h.pantry[ing] <= 0) delete h.pantry[ing];
    }
    Store.save();
    this.item = r.name;
    this.cooking = { r, step: -1, points: 0, max: 0, burnt: false, k: 0, taps: 0, phase: 'walk' };
    if (HouseRoom.editOn) HouseRoom.setEdit(false);
    if (HouseRoom.meOn) HouseRoom.setMe(false);
    api.cookStart({ id: r.id, tool: r.tool, steps: r.steps.map((s) => ({ act: s.act, item: s.item || null, kind: s.kind })) });
    HouseRoom.refresh();
  },

  /** Is there a kitchen in the house? (Put away: out it comes. Never had one: here is one.) → whether she can cook now. */
  async kitchenReady() {
    if (State.house.items.some((x) => x.id === 'kitchen')) return true;
    if (House.storedCount('kitchen')) {
      const ok = await UI.confirm({ icon: '🍳', title: '미니 주방을 꺼내 놓을까요?', text: '요리하려면 부엌이 있어야 해요. 보관함에 있는 미니 주방을 집에 놓을게요.', ok: '🍳 꺼내 놓기' });
      if (!ok) return false;
      House.putOut('kitchen');
      House.held = null;
      HouseHost.sync();
      return State.house.items.some((x) => x.id === 'kitchen');
    }
    const spot = HouseHost.api && (HouseHost.api.findWallSpot('kitchen') || HouseHost.api.findSpot('kitchen'));
    if (!spot) {
      UI.alert({ icon: '🍳', title: '부엌을 놓을 자리가 없어요', text: '🛋️ 꾸미기에서 물건을 조금 옮기거나 넣어 두면, 미니 주방을 놓을 수 있어요.' });
      return false;
    }
    const ok = await UI.confirm({ icon: '🎁', title: '미니 주방을 선물할게요!', text: `${josa(Avatar.name(), '이/가')} 요리를 시작하는 기념으로 미니 주방이 집에 들어와요. 놓은 다음 꾸미기에서 옮길 수 있어요.`, ok: '🍳 받기', cancel: '나중에' });
    if (!ok) return false;
    State.house.items.push({ uid: House.newUid(), id: 'kitchen', ...spot });
    this.state().cook.kitchen = true;
    Diary.add('houseNew', '미니 주방');
    Store.save();
    HouseHost.sync();
    Sfx.play('reward');
    UI.confetti({ count: 60 });
    await sleep(500);
    return true;
  },

  /* The cooking game: she is at the hob ('ready') — then each step: a gauge to tap at the right moment, or taps to do
     quickly; the 3D side does what each step is. */
  cookSaid(what) {
    const c = this.cooking;
    if (!c) return;
    if (what === 'ready') {
      c.phase = 'play';
      this.cookPanel(true);
      this.nextStep();
    }
  },

  nextStep() {
    const c = this.cooking;
    c.step += 1;
    const s = c.r.steps[c.step];
    if (!s) return this.finishCook();
    c.k = 0;
    c.taps = 0;
    c.tapped = false;
    c.max += 2;
    c.t0 = performance.now();
    this.renderCook();
    cancelAnimationFrame(this.cookRaf);
    const tick = () => {
      if (!this.cooking || this.cooking !== c) return;
      const step = c.r.steps[c.step];
      if (!step) return;
      const dt = (performance.now() - c.t0) / 1000;
      if (step.kind === 'time') {
        c.k = Math.min(1.05, dt / step.speed);
        if (HouseHost.api) HouseHost.api.cookLevel(this.heatOf(step, c.k), this.doneOf(step, c.k));
        if (c.k >= 1.05 && !c.tapped) return this.stepTap(true);
      } else {
        c.k = Math.min(1, dt / step.time);
        if (HouseHost.api) HouseHost.api.cookLevel(0.7, 0.4 + 0.1 * c.step);
        if (c.k >= 1 && !c.tapped) return this.stepTap(true);
      }
      this.gauge();
      this.cookRaf = requestAnimationFrame(tick);
    };
    this.cookRaf = requestAnimationFrame(tick);
  },

  /* (how hot it is, how done — for the pot or the pan in 3D) */
  heatOf(step, k) {
    return Math.min(1, 0.35 + k * 0.75);
  },
  doneOf(step, k) {
    if (!step.last) return 0.25 + 0.35 * k;
    // the last step: done at its zone's middle, burnt past it
    const mid = (step.zone[0] + step.zone[1]) / 2;
    return k <= mid ? 0.6 + 0.4 * (k / mid) : 1 + (k - mid) * 1.8;
  },

  /** A tap on the step's button (or the gauge ran out: `late`). */
  stepTap(late = false) {
    const c = this.cooking;
    if (!c || c.phase !== 'play') return;
    const s = c.r.steps[c.step];
    if (!s || c.tapped) return;
    if (s.kind === 'mash' && !late) {
      c.taps += 1;
      Sfx.play('tap');
      if (HouseHost.api) HouseHost.api.cookAct(s.act, s.item, c.taps, c.step, c.taps >= s.n);
      this.gauge();
      if (c.taps < s.n) return;
    }
    if (s.kind === 'mash' && late && HouseHost.api) HouseHost.api.cookAct(s.act, s.item, c.taps, c.step, true); // (time ran out: the step is over all the same)
    c.tapped = true;
    cancelAnimationFrame(this.cookRaf);
    let pts = 0;
    let verdict;
    if (s.kind === 'mash') {
      pts = c.taps >= s.n ? 2 : c.taps >= s.n / 2 ? 1 : 0;
      verdict = pts === 2 ? 'perfect' : pts ? 'good' : 'slow';
    } else {
      const k = c.k;
      const [a, b] = s.zone;
      if (k >= a && k <= b) pts = 2;
      else if (k >= a - 0.12 && k <= b + 0.1) pts = 1;
      verdict = pts === 2 ? 'perfect' : k < a ? (pts ? 'early' : 'tooEarly') : pts ? 'late' : 'tooLate';
      if (s.last && (late || k > b + 0.12)) c.burnt = true;
      if (HouseHost.api) HouseHost.api.cookAct(s.act, s.item, 1, c.step, true);
    }
    c.points += pts;
    this.verdict(verdict, s);
    setTimeout(() => this.cooking === c && this.nextStep(), s.last ? 900 : 1100);
  },

  verdict(v, s) {
    const text = { perfect: '완벽해요! ✨', good: '좋아요!', early: '조금 일렀어요', late: '조금 늦었어요', tooEarly: '너무 일렀어요…', tooLate: s.last ? '앗, 너무 늦었어요!' : '앗, 늦었어요!', slow: '조금 느렸어요' }[v];
    const el = HouseRoom.ov && $('[data-cook-verdict]', HouseRoom.ov.panel);
    if (el) {
      el.textContent = text;
      el.className = `cook-verdict is-${v}`;
      void el.offsetWidth;
      el.classList.add('show');
    }
    Sfx.play(v === 'perfect' ? 'match' : v === 'good' || v === 'early' || v === 'late' ? 'pop' : 'error');
  },

  finishCook() {
    const c = this.cooking;
    c.phase = 'end';
    cancelAnimationFrame(this.cookRaf);
    const share = c.max ? c.points / c.max : 0;
    const stars = c.burnt ? 0 : share >= 0.85 ? 3 : share >= 0.55 ? 2 : 1;
    c.stars = stars;
    const h = this.state();
    h.cook.made[c.r.id] = (h.cook.made[c.r.id] || 0) + 1;
    h.cook.best[c.r.id] = Math.max(h.cook.best[c.r.id] || 0, stars);
    if (c.burnt) h.cook.burnt = (h.cook.burnt || 0) + 1;
    Diary.add('cook', c.burnt ? c.r.fail : c.r.name);
    Store.save();
    this.cookPanel(false);
    if (HouseHost.api) HouseHost.api.cookEnd({ id: c.r.id, burnt: c.burnt, stars });
    Game.checkAchievements();
    UI.toast(c.burnt ? `앗… ${josa(c.r.fail, '이/가')} 됐어요 😅 그래도 맛있게 먹을게요!` : `${c.r.emoji} ${c.r.name} 완성! ${'⭐'.repeat(stars)}`, { icon: c.burnt ? '🔥' : '🍳', kind: c.burnt ? '' : 'gold', ms: 3600 });
  },

  /* The panel over the bottom of the view while she cooks: the step, its gauge, its button. */
  cookPanel(on) {
    const panel = HouseRoom.ov && $('[data-house-cook]', HouseRoom.ov.panel);
    if (!panel) return;
    panel.hidden = !on;
    $('[data-house-room]', HouseRoom.ov.panel).classList.toggle('cook-on', on);
    if (on) this.renderCook();
    requestAnimationFrame(() => HouseRoom.inset());
  },

  renderCook() {
    const c = this.cooking;
    const panel = HouseRoom.ov && $('[data-house-cook]', HouseRoom.ov.panel);
    if (!c || !panel) return;
    const s = c.r.steps[c.step];
    if (!s) return;
    panel.innerHTML = `<div class="cook-head"><b>${c.r.emoji} ${esc(c.r.name)}</b><span class="cook-dots">${c.r.steps.map((x, i) => `<i class="${i < c.step ? 'done' : i === c.step ? 'now' : ''}"></i>`).join('')}</span></div>
      <p class="cook-hint">${esc(s.hint)}</p>
      ${s.kind === 'time'
        ? `<div class="cook-gauge" aria-hidden="true"><span class="cg-zone" style="left:${s.zone[0] * 100}%;width:${(s.zone[1] - s.zone[0]) * 100}%"></span><span class="cg-mark" data-cook-mark></span><small class="cg-label">${esc(s.gauge || '')}</small></div>`
        : `<div class="cook-gauge is-mash" aria-hidden="true"><span class="cg-fill" data-cook-fill></span><span class="cg-time" data-cook-time></span><small class="cg-label">${s.n}번 톡톡!</small></div>`}
      <button class="btn primary huge cook-btn" data-action="cook-tap">${esc(s.label)}</button>
      <p class="cook-verdict" data-cook-verdict aria-live="polite"></p>`;
    this.gauge();
  },

  gauge() {
    const c = this.cooking;
    const panel = HouseRoom.ov && $('[data-house-cook]', HouseRoom.ov.panel);
    if (!c || !panel) return;
    const s = c.r.steps[c.step];
    if (!s) return;
    if (s.kind === 'time') {
      const m = $('[data-cook-mark]', panel);
      if (m) m.style.left = `${Math.min(100, c.k * 100)}%`;
    } else {
      const f = $('[data-cook-fill]', panel);
      if (f) f.style.width = `${Math.min(100, (c.taps / s.n) * 100)}%`;
      const t = $('[data-cook-time]', panel);
      if (t) t.style.width = `${Math.max(0, 100 - c.k * 100)}%`;
    }
  },

  /* ----- the house's buttons, while she is out ----- */

  /** The house's view shows the house, or the street: its buttons and its name follow. */
  hud() {
    const ov = HouseRoom.ov;
    if (!ov) return;
    const root = $('[data-house-room]', ov.panel);
    root.classList.toggle('in-town', this.out);
    const name = $('.house-id b', ov.panel);
    if (name) name.textContent = this.out ? '🏘️ 우리 동네' : `🏠 ${HOUSE_NAME}`;
    $$('[data-town-act]', ov.panel).forEach((b) => b.classList.toggle('on', b.dataset.townAct === this.place));
    requestAnimationFrame(() => HouseRoom.inset());
  },

  hudHtml() {
    return `<div class="fh-actions town-acts">
        <button class="fh-act is-home" data-action="town-go" data-town-act="home"><span aria-hidden="true">🏠</span><b>집으로</b></button>
        <button class="fh-act" data-action="town-go" data-town-act="store"><span aria-hidden="true">🏪</span><b>편의점</b></button>
        <button class="fh-act" data-action="town-go" data-town-act="cafe"><span aria-hidden="true">☕</span><b>카페</b></button>
        <button class="fh-act" data-action="town-go" data-town-act="karaoke"><span aria-hidden="true">🎤</span><b>노래방</b></button>
        <button class="fh-act" data-action="town-go" data-town-act="park"><span aria-hidden="true">🌳</span><b>공원</b></button>
      </div>
      <div class="cook-panel" data-house-cook hidden></div>`;
  },

  /** The house was closed (out or not, she is home next time; what she was cooking is lost — not its ingredients' worth). */
  closed() {
    this.keepBag();
    cancelAnimationFrame(this.cookRaf);
    if (this.cooking && this.cooking.phase !== 'end') {
      // (closed in the middle of cooking: what went in comes back to the fridge)
      const h = this.state();
      for (const [ing, n] of Object.entries(this.cooking.r.need)) h.pantry[ing] = (h.pantry[ing] || 0) + n;
      Store.save();
    }
    if (this.song) CoverHost.stopAll();
    this.out = false;
    this.place = 'street';
    this.basket = {};
    this.song = null;
    this.songStarted = 0;
    this.cooking = null;
    this.eating = null;
  },

  /* ----- the lines ----- */

  /** What the girl says about `kind` — the street's lines, and the kitchen's (with the season, the weather) — or hers (avatar.js). */
  meLine(kind) {
    let k = kind;
    if (kind === 'park_tree') k = `park_tree_${Weather.calendar()}`;
    const list = TOWN_LINES[k] || TOWN_LINES[kind];
    if (!list) return Avatar.line(kind);
    const opens = new Date(Opening.at || Date.now());
    return pick(list)
      .replace(/\{item\}/g, this.item || '')
      .replace(/\{owner\}/g, OWNER_NAME)
      .replace(/\{opens\}/g, `${opens.getMonth() + 1}월 ${opens.getDate()}일`);
  },

  /** …and the people on the street. */
  line(who, kind) {
    const list = (who === 'clerk' ? CLERK_LINES : BARISTA_LINES)[kind];
    if (!list || !list.length) return '';
    const till = this.till || { n: 1, price: 0 };
    return pick(list).replace(/\{item\}/g, this.item || '').replace(/\{n\}/g, till.n).replace(/\{price\}/g, till.price);
  },

  /* The pictures of the shelves and the menu (one at a time, as the shop's are drawn: opening never stutters). */
  thumbs(root) {
    const api = HouseHost.api;
    if (!api) return;
    const next = () => {
      const el = $('[data-town-thumb]:not(.has-img)', root);
      if (!el || !el.isConnected) return;
      el.classList.add('has-img');
      const [kind, id] = el.dataset.townThumb.split(':');
      const url = kind === 'ing' ? api.ingThumb(id) : api.foodThumb(id);
      if (url) el.innerHTML = `<img src="${url}" alt="">`;
      setTimeout(next, 30);
    };
    setTimeout(next, 60);
  },
};

/* (the street's sounds: the store's door chime, the scanner's beep, water poured, the grinder, wings, a fanfare) */
Object.assign(Sfx.sounds, {
  chime: (c, o, t) => {
    Sfx.tone(c, o, t, 1318.5, 0.4, { type: 'sine', vol: 0.35 });
    Sfx.tone(c, o, t + 0.22, 1046.5, 0.6, { type: 'sine', vol: 0.35 });
  },
  beep: (c, o, t) => Sfx.tone(c, o, t, 2350, 0.07, { type: 'square', vol: 0.12 }),
  pour: (c, o, t) => {
    const n = c.createBufferSource();
    const len = 1.4;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.min(1, i / 2000) * Math.min(1, (d.length - i) / 6000);
    n.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 900;
    f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.value = 0.5;
    n.connect(f);
    f.connect(g);
    g.connect(o);
    n.start(t);
  },
  grind: (c, o, t) => {
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(140, t);
    osc.frequency.linearRampToValueAtTime(180, t + 0.9);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    osc.connect(g);
    g.connect(o);
    osc.start(t);
    osc.stop(t + 1.05);
  },
  flap: (c, o, t) => [0, 0.08, 0.16, 0.24].forEach((d) => Sfx.tone(c, o, t + d, 300, 0.05, { type: 'triangle', vol: 0.2, glide: 180 })),
  fanfare: (c, o, t) => [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((f, i) => Sfx.tone(c, o, t + i * 0.11, f, 0.26, { type: 'triangle', vol: 0.45 })),
  sizzle: (c, o, t) => {
    const n = c.createBufferSource();
    const len = 0.6;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.3 ? 1 : 0.3) * Math.min(1, (d.length - i) / 3000);
    n.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'highpass';
    f.frequency.value = 2500;
    const g = c.createGain();
    g.gain.value = 0.35;
    n.connect(f);
    f.connect(g);
    g.connect(o);
    n.start(t);
  },
});

Object.assign(Actions, {
  'house-out': () => TownLife.goOut(),
  'town-go': (el) => TownLife.go(el.dataset.townAct),
  'house-kitchen': () => TownLife.kitchenSheet(),
  'cook-tap': () => TownLife.stepTap(),
});
