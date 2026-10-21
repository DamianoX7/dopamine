'use strict';
/* ==================================================================
   The pets — foxes that live in a little 3D world. They react to
   singing, covers, games and level-ups; they get hungry and lonely
   slowly, but never run away or get sick: no punishment, only
   cuddles.

   She starts with one red fox and names it. More foxes — grown ones
   and kits — can be brought home; up to five live in the yard
   together, each with its own name and outfit, the others rest. The
   fox she touched last is the one she is "with": it is the one on
   Home and in the pop-ups, and the one that comes when she taps the
   ground.

   A kit that is cared for grows a little every day and, after some
   days, into a grown fox — unless she would rather it stayed a kit.
   Now and then one of his letters arrives in the mailbox, and a fox
   brings it to her. And she can take pictures of the family
   (js/photos.js keeps the album).

   The yard is hers to arrange: a house, a swing, a pond and more can
   be bought and put where she likes, and the foxes use them. And she
   can play them her covers: they gather round a radio, listen, and
   dance to the beat of the song. And a fox can be sent exploring: it
   is gone for some hours and comes home with a small gift for her —
   one for the gift box (Trip). Their world has seasons and weather
   (js/weather.js keeps that clock): when it rains they run for cover,
   and when it stops they play in the puddles. One fox is not to be
   had in the shop at all: it is a present (js/present.js).

   Home shows a small card. "Meet the fox" opens the foxes' world: a
   loading screen, then the whole screen (FoxRoom) — walk a fox
   around, pet them, feed them, play, and dress them or move house in
   the shop.

   This file owns the pets' state and their shop (which foxes, outfits,
   habitats and things for the yard exist, what they cost, what is
   owned and in use). The 3D side lives in js/fox/ (ES modules) and is
   reached through FoxHost, the same way the recording studio is
   reached through CoverHost. Ids here must match js/fox/species.js,
   props.js, scenes.js and decor.js.
   ================================================================== */

/* The kinds of fox. `nick` = what one is called until she names it. Kits are "<kind>-baby".
   `gift` = not for sale: Animud — the little fox she made herself — is what Lorelei gives her on the hundredth day. */
const FOXES = [
  { id: 'red', emoji: '🦊', name: '붉은여우', nick: '모찌', desc: '호기심 많은 우리 집 첫 여우', price: 0 },
  { id: 'fennec', emoji: '🏜️', name: '사막여우', nick: '모래', desc: '커다란 귀가 매력 포인트', price: 250 },
  { id: 'arctic', emoji: '❄️', name: '북극여우', nick: '눈송이', desc: '눈처럼 하얗고 폭신폭신', price: 250 },
  { id: 'silver', emoji: '🌑', name: '은여우', nick: '밤이', desc: '은빛이 감도는 까만 털', price: 350 },
  { id: 'marble', emoji: '🤍', name: '마블여우', nick: '구름', desc: '하얀 털에 먹물 무늬', price: 400 },
  { id: 'tibetan', emoji: '🏔️', name: '티벳여우', nick: '무던이', desc: '네모난 얼굴에 시큰둥한 눈빛', price: 450 },
  { id: 'gumiho', emoji: '✨', name: '구미호', nick: '달이', desc: '꼬리가 아홉 개인 전설 속 여우', price: 600 },
  { id: 'animud', emoji: '🌸', name: 'Animud', nick: 'Animud', desc: '세상에 단 한 마리뿐인 여우', gift: true },
  { id: 'red-baby', baby: true, emoji: '🍼', name: '아기 붉은여우', nick: '콩이', desc: '어른들을 졸졸 따라다녀요', price: 150 },
  { id: 'fennec-baby', baby: true, emoji: '🍼', name: '아기 사막여우', nick: '쿠키', desc: '귀만 먼저 다 자랐어요', price: 180 },
  { id: 'arctic-baby', baby: true, emoji: '🍼', name: '아기 북극여우', nick: '솜이', desc: '눈덩이처럼 동글동글', price: 180 },
  { id: 'silver-baby', baby: true, emoji: '🍼', name: '아기 은여우', nick: '깜이', desc: '까만 솜뭉치 같아요', price: 220 },
  { id: 'marble-baby', baby: true, emoji: '🍼', name: '아기 마블여우', nick: '두부', desc: '먹물이 살짝 묻었어요', price: 250 },
  { id: 'tibetan-baby', baby: true, emoji: '🍼', name: '아기 티벳여우', nick: '뚱이', desc: '벌써부터 표정이 심드렁', price: 280 },
  { id: 'gumiho-baby', baby: true, emoji: '🍼', name: '아기 구미호', nick: '별이', desc: '꼬리가 아직 세 개뿐', price: 350 },
];
const MAX_OUT = 5; // how many foxes live in the yard together

/* A fox's id is its kind — with "~2", "~3"… when she has more than one of a kind (a kit that grew up beside a grown fox she already had). */
const foxKind = (id) => String(id).split('~')[0];
const isKit = (id) => foxKind(id).endsWith('-baby');

/* What makes a kit grow, by how much (of 100), and how much it can grow in one day: cared for, it takes about five days. */
const GROW = { feed: 8, play: 8, pet: 1, daily: 20 };

const MAIL_EVERY = 4 * 3600000; // a fox brings one of his letters at most this often

const PET_SHOP = [
  { id: 'bow', emoji: '🎀', name: '리본', price: 40 },
  { id: 'flower', emoji: '🌸', name: '꽃', price: 40 },
  { id: 'mic', emoji: '🎤', name: '미니 마이크', price: 60 }, // stands in the yard (State.pet.things), not worn
  { id: 'scarf', emoji: '🧣', name: '목도리', price: 70 },
  { id: 'glasses', emoji: '🕶️', name: '선글라스', price: 90 },
  { id: 'headphones', emoji: '🎧', name: '헤드폰', price: 120 },
  { id: 'crown', emoji: '👑', name: '왕관', price: 200 },
  // (not for sale: Lorelei gives them on Halloween, after trick or treat — js/halloween.js)
  { id: 'witch', emoji: '🧙', name: '마녀 모자', desc: '🎃 핼러윈 선물', gift: true },
  { id: 'pumpkin', emoji: '🎃', name: '호박 모자', desc: '🎃 핼러윈 선물', gift: true },
];

/* (The meadow and the farm follow the year — js/weather.js; the others are one season always.) */
const HABITATS = [
  { id: 'meadow', emoji: '🌿', name: '숲속 풀밭', desc: '계절마다 옷을 갈아입는 풀밭', price: 0 },
  { id: 'desert', emoji: '🏜️', name: '사막', desc: '선인장과 모래 언덕', price: 200 },
  { id: 'arctic', emoji: '❄️', name: '북극', desc: '이글루와 눈사람, 밤엔 오로라', price: 200 },
  { id: 'mountain', emoji: '⛰️', name: '가을 산', desc: '단풍과 돌탑이 있는 산길', price: 200 },
  { id: 'farm', emoji: '🚜', name: '농장', desc: '헛간과 병아리 친구들 · 계절 따라 달라져요', price: 200 },
  { id: 'cherry', emoji: '🌸', name: '벚꽃 동산', desc: '꽃잎이 흩날리는 소풍 자리', price: 250 },
  { id: 'beach', emoji: '🏖️', name: '바닷가', desc: '야자수와 모래성, 밀려오는 파도', price: 300 },
  { id: 'bamboo', emoji: '🎋', name: '대나무 숲', desc: '안개 낀 대숲과 돌길, 밤엔 반딧불', price: 300 },
  { id: 'lavender', emoji: '💜', name: '라벤더 언덕', desc: '보랏빛 꽃밭과 돌아가는 풍차', price: 300 },
  { id: 'hanok', emoji: '🛖', name: '한옥 마당', desc: '기와집과 장독대, 감이 익는 가을', price: 300 },
];

/* Things for the yard (js/fox/decor.js builds them, and knows what a fox does with each). */
const YARD_ITEMS = [
  { id: 'house', emoji: '🏠', name: '여우 집', desc: '들어가서 얼굴만 쏙 · 밤엔 여기서 자요', price: 350 },
  { id: 'swing', emoji: '🎠', name: '그네', desc: '폴짝 올라타서 흔들흔들', price: 260 },
  { id: 'pond', emoji: '🐟', name: '연못', desc: '물도 마시고 물고기도 구경해요', price: 300 },
  { id: 'trampoline', emoji: '🤸', name: '트램펄린', desc: '통통 뛰다가 공중제비', price: 240 },
  { id: 'campfire', emoji: '🔥', name: '모닥불', desc: '둘러앉아 불멍 · 밤엔 환해요', price: 180 },
  { id: 'bench', emoji: '🪑', name: '벤치', desc: '올라가 앉아서 쉬어요', price: 150 },
  { id: 'lamp', emoji: '🏮', name: '가로등', desc: '밤이 되면 불이 켜져요', price: 120 },
  { id: 'flowers', emoji: '🌷', name: '꽃밭', desc: '킁킁, 꽃향기 맡기', price: 90 },
];

/* Where a fox can be sent exploring: how long it is gone (hours), the coins it finds on the way, and what it may
   bring her from there — the last of each is the rare one. */
const TRIP_PLACES = [
  { id: 'field', emoji: '🌼', name: '집 앞 들판', hours: 0.5, coins: [3, 8], finds: ['wildflower', 'strawberry', 'foxtail', 'ladybug', 'clover'] },
  { id: 'forest', emoji: '🌲', name: '깊은 숲', hours: 2, coins: [8, 16], finds: ['acorn', 'mushroom', 'maple', 'grapes', 'owl'] },
  { id: 'river', emoji: '🏞️', name: '강가', hours: 4, coins: [14, 26], finds: ['pebble', 'shell', 'fish', 'bead', 'pearl'] },
  { id: 'peak', emoji: '⛰️', name: '먼 산', hours: 8, coins: [24, 40], finds: ['honey', 'blossom', 'crystal', 'snow', 'star'] },
];

/* The gifts (State.pet.finds counts them). `says` = what the fox tells her about it. */
const TRIP_FINDS = {
  wildflower: { emoji: '🌼', name: '들꽃 한 송이', says: '제일 예쁜 걸로 골라 왔어!' },
  strawberry: { emoji: '🍓', name: '산딸기', says: '하나 먹어 봤는데 달아! 이건 네 거야.' },
  foxtail: { emoji: '🌾', name: '강아지풀', says: '간질간질~ 이걸로 같이 놀자!' },
  ladybug: { emoji: '🐞', name: '무당벌레', says: '풀잎에서 만난 친구야. 인사해!' },
  clover: { emoji: '🍀', name: '네잎클로버', says: '한참 찾았어! 너한테 행운이 올 거야.', rare: true },
  acorn: { emoji: '🌰', name: '도토리', says: '다람쥐가 하나 나눠 줬어!' },
  mushroom: { emoji: '🍄', name: '알록달록 버섯', says: '예쁘지? 먹으면 안 된대!' },
  maple: { emoji: '🍁', name: '단풍잎', says: '제일 빨간 잎이야. 책갈피로 써!' },
  grapes: { emoji: '🍇', name: '머루 한 송이', says: '숲속 깊은 데서 찾았어. 새콤달콤해!' },
  owl: { emoji: '🦉', name: '부엉이 깃털', says: '부엉이 아저씨가 선물로 줬어!', rare: true },
  pebble: { emoji: '⚪', name: '하얀 조약돌', says: '물속에서 제일 반짝이던 돌이야.' },
  shell: { emoji: '🐚', name: '조개껍데기', says: '귀에 대 봐. 물소리가 나!' },
  fish: { emoji: '🐟', name: '은빛 물고기', says: '내가 직접 잡았어! 대단하지?' },
  bead: { emoji: '🔮', name: '유리구슬', says: '강바닥에서 반짝였어. 누가 잃어버렸나 봐.' },
  pearl: { emoji: '🦪', name: '진주', says: '조개가 살짝 보여 줬어. 너 주려고 가져왔어!', rare: true },
  honey: { emoji: '🍯', name: '산꿀', says: '벌들한테 허락받고 가져왔어. 진짜야!' },
  blossom: { emoji: '🌸', name: '산꼭대기 꽃', says: '구름 위에 피어 있었어.' },
  crystal: { emoji: '💎', name: '수정 조각', says: '동굴 안에서 찾았어. 반짝반짝!' },
  snow: { emoji: '❄️', name: '녹지 않는 눈송이', says: '산꼭대기 눈이야. 신기하게 안 녹아!' },
  star: { emoji: '🌠', name: '별똥별 조각', says: '밤하늘에서 떨어지는 걸 물어 왔어!', rare: true },
};

/* "30분", "2시간" */
const tripTime = (hours) => (hours < 1 ? `${Math.round(hours * 60)}분` : `${hours}시간`);

/* What a fox says when js/config.js has no lines of that kind. */
const PET_LINES = {
  recorded: ['오 노래했어?', '방금 노래 들었어!', '목소리 좋다~'],
  released: ['이번 곡 괜찮은데?', '발매 축하해! 🎉'],
  game: ['게임 재밌었어?', '한 판 더?'],
  levelup: ['레벨업! 대박 🎉'],
  achievement: ['업적 달성! 멋지다 ✨'],
  petted: ['헤헤 좋아', '더 쓰다듬어줘~', '기분 최고!', '💗'],
  fed: ['냠냠… 맛있다!', '꼬리가 저절로 흔들려 🍖', '배불러~'],
  played: ['신난다!', '한 번 더!', '공 던져줘!'],
  hungry: ['배고파… 🍖', '간식 하나만…'],
  idle: ['심심해… 노래 불러줘', '오늘 기분 어때?', '같이 놀자!'],
  sleepy: ['졸려… 근데 노래는 듣고 싶어', '새벽 감성이네 🌙'],
  accessory: ['나 어때? 예쁘지?', '패션 완성!'],
  greet: ['왔어?! 보고 싶었어!', '기다렸어!', '오늘도 와줬네 💗'],
  newFox: ['안녕! 잘 부탁해 🦊', '오늘부터 같이 놀자!'],
  newHome: ['우와, 여기 좋다!', '새집 마음에 들어!'],
  jealous: ['나도 쓰다듬어줘!', '나도 나도!', '나는…?'],
  letter: ['편지 왔어! 💌', '이거 너한테 온 거야!', '우편함에 이게 있었어!'],
  grown: ['나 이제 다 컸어!', '짠! 어때, 멋있지?'],
  concert: ['이 노래 좋아! 🎵', '네 목소리다! 💗', '춤추고 싶어져!', '소리 더 크게!'],
  lullaby: ['자장가다… 🌙', '듣다가 잠들 것 같아…'],
  encore: ['앵콜! 앵콜! 🎉', '한 곡 더 들려줘!', '최고의 무대였어! 💗'],
  newThing: ['우와, 이거 뭐야?!', '새 장난감이다!', '마당이 점점 좋아져!'],
  depart: ['다녀올게! 🧭', '선물 가져올게, 기다려!', '탐험 출발!'],
  gift: ['선물 가져왔어! 🎁', '이거 너 주려고 가져왔어!', '짠! 뭐게?'],
  recalled: ['벌써 불렀어? 아직 아무것도 못 찾았는데…', '다음엔 꼭 선물 가져올게!'],
  rain: ['비 온다! 피하자!', '앗, 차가워!', '비다, 비!'],
  shelter: ['비 구경 중이야 ☔', '빗소리 좋다…', '언제 그치려나?'],
  afterRain: ['비 그쳤다!', '웅덩이 생겼어! 💦', '공기가 상쾌해!'],
  puddle: ['첨벙! 💦', '물 튀기기 재밌어!', '한 번 더 뛸래!'],
  snow: ['눈이다! ❄️', '눈송이 잡았다!', '온 세상이 하얘!'],
  cold: ['으으, 추워…', '발 시려…', '따뜻한 데로 갈래…'],
  wind: ['모래바람이야, 눈 감아!', '귀에 모래 들어가…'],
};

const SHOP_KINDS = {
  fox: { list: FOXES, owned: 'foxes', verb: '데려오기', tab: '🦊 여우' },
  acc: { list: PET_SHOP, owned: 'owned', verb: '구매하기', tab: '🎀 꾸미기' },
  scene: { list: HABITATS, owned: 'scenes', verb: '이사하기', tab: '🏞️ 배경', hint: '여우들이 살 곳을 골라요. 어디든 마당 밖으로 넓은 들판이 펼쳐져 있어서, 화면을 밀면 둘러볼 수 있어요. 숲속 풀밭과 농장은 계절을 따라 모습이 바뀌고, 다른 곳은 늘 같은 계절이에요.' },
  yard: { list: YARD_ITEMS, owned: 'decor', verb: '구매하기', tab: '🏡 마당' },
};

/* The girl the foxes belong to (js/fox/lorelei.js, keeper.js). Her name can be changed in js/config.js: ownerName. */
const OWNER_NAME = CFG.ownerName || '로렐라이';
/* What she says: when she is tapped (hello — or what fits the hour, the weather and the day), calling a fox over, feeding, throwing the ball.
   {fox} = the fox it is about (the one she is with, otherwise); {fox!} = the same, called out to; {me} = her name. */
const OWNER_LINES = {
  hello: ['안녕! 오늘도 왔구나 💗', '여우들이 기다리고 있었어!', '{fox} 오늘 기분 좋아 보이지?', '오늘은 뭐 하고 놀까?', '나는 {me}. 여우들이랑 같이 살아!', '여우들 쓰다듬어 주면 좋아해!'],
  hungry: ['여우들이 배고픈가 봐…', '밥 줄 시간이야! 🍖'],
  night: ['쉿… 여우들 자고 있어 🌙', '나도 조금만 잘게… 💤'],
  rain: ['비 오는 날도 좋아 ☔', '우산 챙겨 오길 잘했다!', '여우들은 비를 피하러 갔어.'],
  snow: ['눈이다! 여우들이 신났어 ❄️', '눈사람 만들까?'],
  wind: ['으, 모래바람…!', '눈에 모래 들어가겠어!'],
  alone: ['{fox} 금방 돌아올 거야 🧭', '탐험 간 {fox} 뭘 가져올까?'],
  call: ['{fox!}, 이리 와!', '{fox!}~ 쓰다듬어 줄게!', '{fox!}, 여기야 여기!'],
  halloween: ['해피 핼러윈! 🎃', '마녀 모자 어때? 잘 어울리지?', '사탕 하나 더 먹을래? 🍬', '여우들 변장한 거 너무 귀엽지?', '박쥐다! 🦇 …아, 놀랐어?'], // (on Halloween, js/halloween.js)
  feed: ['밥 먹자~!', '맛있는 거 가져왔어!', '많이 먹어 🍖'],
  play: ['간다~!', '잡아 봐!', '공 간다!'],
};

/* How the family can pose for a picture (js/fox/brain.js: strike). */
const PHOTO_POSES = [
  ['sit', '앉아'],
  ['smile', '활짝'],
  ['lie', '엎드려'],
  ['bow', '장난'],
  ['proud', '늠름'],
  ['jump', '점프'],
  ['mix', '제각각'],
];

const LOADING_TIPS = [
  '바닥을 누르면 여우가 그쪽으로 달려와요',
  '화면을 손가락으로 밀면 마당 밖 넓은 세상을 둘러볼 수 있어요',
  `${josa(OWNER_NAME, '을/를')} 누르면 손을 흔들어 줘요`,
  `먹이는 ${josa(OWNER_NAME, '이/가')} 그릇에 담아 주고, 공도 ${josa(OWNER_NAME, '이/가')} 던져 줘요`,
  '마당 밖 먼 곳을 눌러도 여우가 거기까지 달려가요',
  '여우를 누르거나 문지르면 쓰다듬을 수 있어요',
  '두 손가락이나 마우스 휠로 가까이 볼 수 있어요',
  '밤 12시가 넘으면 여우도 잠자리에 들어요',
  '장식은 여러 개를 함께 걸칠 수 있어요',
  '공놀이를 하면 행복이 쑥쑥 올라요',
  '노래를 녹음하면 여우도 따라 불러요',
  '여우는 다섯 마리까지 함께 지낼 수 있어요',
  '여러 마리일 땐 마지막으로 쓰다듬은 여우가 부르면 달려와요',
  '아기 여우는 어른 여우를 졸졸 따라다녀요',
  '왼쪽 위 이름표를 누르면 여우 이름을 바꿀 수 있어요',
  '아기 여우는 돌봐 주면 며칠에 걸쳐 어른으로 자라요',
  '우편함 깃발이 올라가 있으면 편지가 온 거예요',
  '📷를 누르면 여우들이 포즈를 잡아요',
  '💿 들려주기를 누르면 여우들이 내 커버에 맞춰 춤춰요',
  '상점의 🏡 마당에서 집, 그네, 연못을 사서 놓을 수 있어요',
  '마당에 놓은 그네나 연못을 누르면 여우가 가서 놀아요',
  '🧭를 눌러 여우를 탐험 보내면 선물을 물고 돌아와요',
  '여우 세상에도 계절이 있어요. 풀밭과 농장은 달력을 따라 모습이 바뀌어요',
  '비가 오면 여우들은 집이나 나무 밑으로 비를 피해요',
  '비가 그치면 여우들이 웅덩이에서 첨벙첨벙 놀아요',
  '눈이 오는 날엔 여우들이 눈송이를 잡으려고 폴짝폴짝 뛰어요',
];

const FOX_FACE_KEY = 'dopamineWorld.foxFace.v1';

/* ------------------------------------------------------------------
   FoxHost — the bridge to the 3D world. The modules register an api
   here once they have loaded; without them (or without WebGL) the
   foxes' world still opens, with a still fox.
   ------------------------------------------------------------------ */
const FoxHost = {
  api: null, //     set by js/fox/host.js
  failed: false,
  loading: null,
  stage: null, //   the element the 3D view is shown in (while the foxes' world is open)
  waiters: [],

  /* Fetch the 3D modules (three.js is big, so only when a fox is first needed). */
  load() {
    if (!this.loading) {
      this.loading = import(new URL('js/fox/host.js', document.baseURI).href).catch((err) => {
        console.error('[Pet] the 3D fox could not be loaded', err);
        this.fail();
      });
    }
    return this.loading;
  },

  register(api) {
    this.api = api;
    this.waiters.splice(0).forEach((done) => done(true));
  },

  /* The modules didn't load, or this browser has no WebGL. */
  fail() {
    this.failed = true;
    this.api = null;
    this.waiters.splice(0).forEach((done) => done(false));
    $$('[data-fox-stage]').forEach((el) => el.classList.add('is-flat'));
  },

  /* Resolves true once the 3D side can be used (false if it can't, or after `ms`). */
  ready(ms = 12000) {
    if (this.api) return Promise.resolve(true);
    if (this.failed) return Promise.resolve(false);
    this.load();
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      setTimeout(() => resolve(false), ms);
    });
  },

  mount(stage, opts = {}) {
    this.stage = stage;
    if (this.api) this.api.mount(stage, opts);
    if (!this.api || this.failed) stage.classList.add('is-flat');
  },

  unmount() {
    this.stage = null;
    if (this.api) this.api.unmount();
  },

  /* Are the foxes on screen right now? (then they speak for themselves instead of the pop-up) */
  showing() {
    return !!(this.stage && this.stage.isConnected && FoxRoom.ov && UI.top() === FoxRoom.ov);
  },

  /* The habitat that shows: one she is trying out in the shop, otherwise where they live. */
  scene() {
    const pv = Pet.previewing;
    return pv && pv.kind === 'scene' ? pv.id : State.pet.scene;
  },

  /* What the 3D side should show: the family and the yard as saved, the cover that is playing — plus whatever is being tried out in the shop. */
  look() {
    const p = State.pet;
    const pv = Pet.previewing;
    const trip = Pet.trip();
    const look = {
      foxes: Pet.home().map((id) => ({ id, worn: Pet.outfit(id).slice(), grown: Pet.grown(id) })),
      away: trip && Pet.away(trip.fox) ? [{ id: trip.fox, grown: Pet.grown(trip.fox) }] : [], // out exploring: not in the yard, but it still lives there
      gift: Pet.tripPhase() === 'back' ? trip.fox : null, //                                     …or home again, with a gift in its mouth
      lead: p.species,
      focus: p.species,
      things: p.things.slice(),
      decor: p.yard.map((it) => ({ id: it.id, x: it.x, z: it.z, r: it.r })), // (no x: not one she has placed herself — the 3D side arranges those)
      held: FoxRoom.tab === 'yard' ? Pet.held : null,
      tune: CoverHost.tune(),
      mail: Pet.mailWaiting(),
      scene: p.scene,
      season: Weather.seasonIn(p.scene), // (the meadow and the farm follow the year; the other habitats are one season always)
      sky: Weather.now(p.scene), //         …and the weather there, right now
      night: document.body.classList.contains('late-night'),
      mood: Pet.mood(),
      reduce: reducedMotion(),
    };
    // (Lorelei's present, shown beforehand: the fox is there to be looked at, not hers)
    if (Present.guest && !look.foxes.some((f) => f.id === Present.guest)) look.foxes.push({ id: Present.guest, worn: [], grown: 0, guest: true });
    if (!pv) return Halloween.dress(look); // (on Halloween, in costume)
    if (pv.kind === 'fox') {
      // a fox she doesn't have yet comes to visit
      look.foxes.push({ id: pv.id, worn: [], grown: 0, guest: true });
      look.focus = pv.id;
    } else if (pv.kind === 'scene') {
      look.scene = pv.id;
      look.season = Weather.seasonIn(pv.id);
      look.sky = Weather.now(pv.id);
    } else if (pv.kind === 'yard') {
      // something for the yard, to see how it would look there: hers to move about already
      look.decor.push({ id: pv.id, ...(pv.at || {}), trial: true });
      look.held = pv.id;
    } else if (pv.id === 'mic') look.things.push('mic');
    else {
      const who = look.foxes.find((f) => f.id === p.species) || look.foxes[0];
      if (who) who.worn.push(pv.id);
    }
    return Halloween.dress(look);
  },

  sync() {
    if (this.api && this.stage) this.api.sync(this.look());
  },

  /* `id` = the fox it is about (a pat, a new outfit); without it, the one she is with — or all of them. */
  act(name, id) {
    if (this.api && this.stage) this.api.act(name, id);
  },

  say(text, ms, id) {
    if (!text || !this.stage) return;
    if (this.api && !this.failed) this.api.say(text, ms, id);
    else {
      // the still fox has a plain bubble
      const el = $('[data-fox-bubble]', this.stage);
      if (!el) return;
      el.textContent = text;
      el.hidden = false;
      clearTimeout(this.flatTimer);
      this.flatTimer = setTimeout(() => (el.hidden = true), ms || 2600);
    }
  },

  /* ----- what the 3D side asks of the app ----- */
  onPet: (id) => Pet.pet(id),
  onCommand: () => Pet.learned(),
  onLook: (away) => FoxRoom.lookButton(away), // she slid the view away over the country (or it is back with her fox)
  onOwner: () => Pet.owner(), //                the girl the foxes belong to was tapped
  ownerName: () => OWNER_NAME,
  ownerLine: (kind, id) => Pet.ownerLine(kind, id),
  onMail: () => FoxRoom.mailButton(), //      the letter moved on (mailbox → on its way → in a fox's mouth)
  onLetter: (id) => Pet.takeLetter(id), // she tapped the fox that has it
  onGift: () => Pet.takeGift(), //         …or the one that is back from an expedition with a gift
  onPresent: (what) => OwnerSays.heard(what), // Lorelei has come forward with what she has to say (js/present.js)
  moodLine: () => Pet.moodLine(),
  line: (kind) => Pet.line(kind),
  onDecor: (id, at) => Pet.placed(id, at), //   she has moved or turned a thing in the yard: that is its place from now on
  onDecorFull: (id) => Pet.yardFull(id), //     …or there was no room for it
  onDecorPick: (id) => Pet.hold(id), //         she touched one while arranging the yard
  onDecorUse: () => Pet.yardFun(), //           a fox has had its fun with one
  onPuddle: () => Pet.puddle(), //              …or has jumped into a puddle
  clock: () => CoverHost.clock(), //            where the cover that is playing is (seconds)
  beats: (id) => CoverHost.beats(id), //        …and its beat, once the studio has listened to it
};
window.FoxHost = FoxHost;

const Pet = {
  previewing: null, // { kind, id } — something being tried out in the shop (for the yard: + at, where it stands)
  held: null, //       the thing in the yard she has picked to move
  thumbCache: {},
  faces: {}, //        key → the round portrait of a fox as it looks (drawn this visit)
  asked: {}, //        kit → she was asked about its growing up this visit

  /* Slow, gentle decay while she's away (never below a floor). */
  tick() {
    const p = State.pet;
    const now = Date.now();
    // (before the foxes' world opened — js/opening.js — there was no fox to go hungry)
    const hours = Math.max(0, (now - Math.max(p.lastTick || now, Opening.since())) / 3600000);
    if (hours > 0.01) {
      p.fullness = Math.max(15, p.fullness - hours * 3);
      p.happiness = Math.max(20, p.happiness - hours * 2);
      p.lastTick = now;
      Store.save();
      this.refresh();
    }
    this.tripTick();
  },

  bondLevel() {
    return Math.floor(State.pet.bond / 10) + 1;
  },

  mood() {
    const p = State.pet;
    if (document.body.classList.contains('late-night')) return 'sleepy';
    if (p.fullness < 35) return 'hungry';
    if (p.happiness < 40) return 'idle';
    return p.happiness > 75 ? 'happy' : 'idle';
  },

  line(kind) {
    const mine = (CFG.petLines || {})[kind];
    const lines = mine && mine.length ? mine : PET_LINES[kind];
    return lines && lines.length ? pick(lines) : '';
  },

  moodLine() {
    return this.line({ sleepy: 'sleepy', hungry: 'hungry', happy: 'idle', idle: 'idle' }[this.mood()]);
  },

  /* Something for the foxes' owner to say (OWNER_LINES); `id` = the fox it is about. */
  ownerLine(kind, id = State.pet.species) {
    const mine = (CFG.ownerLines || {})[kind];
    const lines = mine && mine.length ? mine : OWNER_LINES[kind];
    if (!lines || !lines.length) return '';
    const name = this.nameOf(id);
    return pick(lines).replace('{fox!}', josa(name, '아/야')).replace('{fox}', name).replace('{me}', josa(OWNER_NAME, '이야/야'));
  },

  /* She was tapped: a wave, and a word — about the hour, the weather, or the foxes. */
  owner() {
    this.learned();
    if (Present.waiting() && !Present.playing) return void Present.begin(); // she has something for her: that first
    if (Halloween.waiting() && !Halloween.playing) return void Halloween.begin(); // …or it is Halloween: trick or treat
    const sky = Weather.now(FoxHost.scene()).kind;
    const trip = this.trip();
    const kind =
      this.mood() === 'sleepy' ? 'night' : !this.home().length && trip ? 'alone' : sky === 'rain' ? 'rain' : sky === 'snow' ? 'snow' : sky === 'wind' ? 'wind' : this.mood() === 'hungry' && Math.random() < 0.6 ? 'hungry' : Halloween.on() ? 'halloween' : 'hello';
    if (FoxHost.api && !FoxHost.failed) FoxHost.api.owner(this.ownerLine(kind, kind === 'alone' ? trip.fox : State.pet.species));
  },

  /* ----- the family ----- */
  foxDef(id) {
    const kind = foxKind(id);
    return FOXES.find((f) => f.id === kind) || FOXES[0];
  },

  nameOf(id) {
    return State.pet.names[id] || (id === 'red' && CFG.petName) || this.foxDef(id).nick;
  },

  /* What a fox is wearing (the one she is with, unless another is named). */
  outfit(id = State.pet.species) {
    const all = State.pet.outfits;
    return all[id] || (all[id] = []);
  },

  /* Be with another of the foxes that are out. */
  select(id) {
    const p = State.pet;
    if (p.species === id || !p.out.includes(id) || this.away(id)) return;
    p.species = id;
    p.name = this.nameOf(id);
    Store.save();
    this.refresh();
    this.wantFace();
    FoxRoom.renderShop();
  },

  /* Something happened elsewhere in the app: the foxes react (in their world if that is open, else as a pop-up). */
  react(event) {
    const map = {
      recorded: ['recorded', 'sing'],
      released: ['released', 'cheer'],
      game: ['game', 'joy'],
      levelup: ['levelup', 'cheer'],
      achievement: ['achievement', 'cheer'],
    };
    const [kind, act] = map[event] || ['idle', 'joy'];
    if (Opening.shut()) return; // (the foxes are not there yet: js/opening.js)
    State.pet.happiness = Math.min(100, State.pet.happiness + 3);
    Store.save();
    if (!this.home().length) return void this.refresh(); // nobody at home to say anything
    const text = this.line(kind);
    if (FoxHost.showing()) {
      FoxHost.act(act);
      FoxHost.say(text, 3000);
    } else UI.petPop(text, { soft: event === 'achievement' || event === 'game' });
    this.refresh();
  },

  /* ----- growing up ----- */
  /* How far along a kit is, 0 … 100. */
  growth(id) {
    return isKit(id) ? Math.min(100, State.pet.growth[id] || 0) : 0;
  },

  /* …and as its body shows it: a kit grows a step at every quarter of the way (0, ¼, ½, ¾ — then it is ready to grow up).
     One she keeps a kit looks like the little one it was, however far it had grown. */
  grown(id) {
    return State.pet.stay[id] ? 0 : Math.min(3, Math.floor(this.growth(id) / 25)) / 4;
  },

  /* Kits that are out were fed, played with or petted: they grow a little — only so much in one day. */
  care(what, ids) {
    const p = State.pet;
    const today = State.daily.kitCare || (State.daily.kitCare = {});
    let stepped = null;
    let ready = null;
    ids.forEach((id) => {
      if (!isKit(id) || p.stay[id] || !p.foxes.includes(id) || this.away(id)) return;
      const before = this.growth(id);
      const gain = Math.min(GROW[what], GROW.daily - (today[id] || 0), 100 - before);
      if (gain > 0) {
        today[id] = (today[id] || 0) + gain;
        p.growth[id] = before + gain;
        if (Math.floor(p.growth[id] / 25) > Math.floor(before / 25) && p.growth[id] < 100) stepped = id;
      }
      if (this.growth(id) >= 100) ready = ready || id;
    });
    if (stepped) {
      UI.toast(`${josa(this.nameOf(stepped), '이/가')} 조금 자랐어요!`, { icon: '🌱', ms: 3200 });
      this.wantFace();
    }
    if (ready) this.offerGrowUp(ready);
  },

  /* A kit has grown all the way: ask (once a visit, when things have calmed down) whether it should grow up now. */
  offerGrowUp(id, now = false) {
    if (!now && this.asked[id]) return;
    this.asked[id] = true;
    setTimeout(
      () => {
        const p = State.pet;
        if (!p.foxes.includes(id) || this.growth(id) < 100 || p.stay[id] || !FoxRoom.ov || UI.top() !== FoxRoom.ov) return void (this.asked[id] = false);
        const name = this.nameOf(id);
        const adult = this.foxDef(foxKind(id).slice(0, -5));
        const ov = UI.open(
          `<div class="dialog">
            <div class="dialog-icon" aria-hidden="true"><span class="fox-avatar is-mid" data-fox-thumb="fox:${adult.id}">${adult.emoji}</span></div>
            <h2>${esc(josa(name, '이/가'))} 다 자랐어요!</h2>
            <p>이제 어엿한 ${esc(adult.name)}의 모습이 될 수 있어요. 아기 모습이 좋다면 그대로 지내도 돼요.</p>
            <div class="dialog-actions col">
              <button class="btn primary wide" data-grow>🎉 어른이 되기</button>
              <button class="btn soft wide" data-stay>아기 모습으로 지내기</button>
              <button class="btn ghost wide" data-ov-cancel>나중에 정할게요</button>
            </div>
          </div>`,
          { cls: 'is-dialog', label: `${name}의 성장` }
        );
        if (FoxHost.api) this.fillThumb($('[data-fox-thumb]', ov.panel));
        $('[data-ov-cancel]', ov.panel).addEventListener('click', () => UI.close(ov));
        $('[data-stay]', ov.panel).addEventListener('click', () => {
          this.setStay(id, true);
          UI.close(ov);
          UI.toast(`${josa(name, '은/는')} 아기 모습으로 지내요. 이름표에서 언제든 바꿀 수 있어요.`, { icon: '🍼', ms: 3800 });
        });
        $('[data-grow]', ov.panel).addEventListener('click', () => {
          UI.close(ov);
          this.growUp(id);
        });
      },
      now ? 0 : 4200
    );
  },

  /* "Keep it a kit": it is a little kit again and stops growing — until she lets it grow on from where it was. */
  setStay(id, on) {
    const p = State.pet;
    if (on) p.stay[id] = true;
    else delete p.stay[id];
    Store.save();
    this.refresh();
    this.wantFace();
    FoxRoom.renderShop();
    if (!on && this.growth(id) >= 100) this.offerGrowUp(id, true);
  },

  /* The kit becomes a grown fox of its kind — the same fox, with its name and its outfit. */
  growUp(id) {
    const p = State.pet;
    if (!p.foxes.includes(id) || !isKit(id)) return;
    const name = this.nameOf(id);
    const kind = foxKind(id).slice(0, -5);
    let to = kind;
    for (let n = 2; p.foxes.includes(to); n++) to = `${kind}~${n}`;
    const swap = (list) => list.map((x) => (x === id ? to : x));
    p.foxes = swap(p.foxes);
    p.out = swap(p.out);
    p.names[to] = name;
    p.outfits[to] = this.outfit(id);
    ['names', 'outfits', 'growth', 'stay'].forEach((key) => delete p[key][id]);
    delete (State.daily.kitCare || {})[id];
    if (p.trip && p.trip.fox === id) p.trip.fox = to;
    if (p.species === id) {
      p.species = to;
      p.name = name;
    }
    State.statistics.raised = (State.statistics.raised || 0) + 1;
    p.happiness = Math.min(100, p.happiness + 10);
    p.bond += 5;
    Store.save();
    if (FoxHost.api) FoxHost.api.rename(id, to); // the same fox in the yard: its grown body comes with the next sync
    this.refresh();
    FoxRoom.renderShop();
    this.wantFace();
    Sfx.play('levelup');
    UI.confetti({ count: 110 });
    UI.toast(`${josa(name, '이/가')} 어른 ${this.foxDef(to).name}가 됐어요!`, { icon: '🎉', kind: 'gold', ms: 4200 });
    FoxHost.say(this.line('grown'), 3200, to);
    Game.checkAchievements();
  },

  /* ----- his letters ----- */
  /* Is there a letter for a fox to bring? (a letter he wrote and sent — js/post.js — or else one of his messages, every few hours) */
  mailWaiting() {
    if (!this.home().length) return false; // (it waits for a fox to be at home)
    return Post.waiting().length > 0 || (Date.now() - (State.pet.mailAt || 0) >= MAIL_EVERY && Messages.all().length > 0);
  },

  /* Where that letter is: 'none', in the mailbox ('box'), a fox is going for it ('fetching'), or a fox has it ('fox'). */
  mailPhase() {
    if (!this.mailWaiting()) return 'none';
    return FoxHost.api && FoxHost.stage ? FoxHost.api.mail() : 'fox'; // without the 3D view it is simply handed over
  },

  /* The button over the view: send the fox for the letter, or take it. */
  letterTap() {
    const phase = this.mailPhase();
    if (phase === 'box') FoxHost.act('fetch');
    else if (phase === 'fox') this.takeLetter();
  },

  /* She takes the letter from the fox that brought it (`id`): a letter he sent her, if one has come — otherwise one of his messages, opened as always. */
  takeLetter(id) {
    const p = State.pet;
    if (!this.mailWaiting()) return;
    const who = id || (FoxHost.api && FoxHost.api.courier()) || p.species;
    const sent = Post.waiting()[0];
    if (!sent) p.mailAt = Date.now();
    State.statistics.foxLetters = (State.statistics.foxLetters || 0) + 1;
    p.happiness = Math.min(100, p.happiness + 5);
    p.bond += 2;
    Store.save();
    FoxHost.act('letter');
    if (sent) Post.open(sent, { by: this.nameOf(who) });
    this.refresh(); // no letter waiting any more: the mailbox's flag goes down
    FoxRoom.mailButton();
    if (!sent) openMessage(null, { by: this.nameOf(who) });
    Game.checkAchievements();
  },

  /* ----- exploring ----- */
  tripPlace(id) {
    return TRIP_PLACES.find((x) => x.id === id) || null;
  },

  /* The expedition that is under way — or over, with its gift still to be handed to her. */
  trip() {
    const t = State.pet.trip;
    return t && State.pet.out.includes(t.fox) && this.tripPlace(t.place) ? t : null;
  },

  /* 'none', 'away' (a fox is out exploring) or 'back' (it is home again, with a gift for her). */
  tripPhase() {
    const t = this.trip();
    return !t ? 'none' : Date.now() < t.back ? 'away' : 'back';
  },

  away(id) {
    const t = this.trip();
    return !!t && t.fox === id && Date.now() < t.back;
  },

  /* The foxes that are in the yard right now. */
  home() {
    return State.pet.out.filter((id) => !this.away(id));
  },

  /* Is there a fox at home to pet, to feed, to play to? If the only one is out exploring, she is told to wait for it. */
  anyoneHome(what) {
    if (this.home().length) return true;
    Sfx.play('error');
    UI.toast(`${josa(this.nameOf(this.trip().fox), '이/가')} 탐험에서 돌아오면 ${what}`, { icon: '🧭', ms: 3200 });
    return false;
  },

  /* How long until it is back: "1시간 52분", "37분" — "곧". */
  tripLeft() {
    const t = this.trip();
    const min = t ? Math.ceil((t.back - Date.now()) / 60000) : 0;
    if (min <= 0) return '곧';
    return min >= 60 ? `${Math.floor(min / 60)}시간${min % 60 ? ` ${min % 60}분` : ''}` : `${min}분`;
  },

  /* Time passes: a fox that was away is home again. (Asked every minute, when she comes back to the page — and by the foxes' world, on the minute it is due.) */
  tripTick() {
    const phase = this.tripPhase();
    if (this.tripWas === undefined) this.tripWas = phase;
    if (phase === this.tripWas) return void FoxRoom.tripChip();
    const came = this.tripWas === 'away' && phase === 'back';
    this.tripWas = phase;
    this.refresh(); // (in its world it comes running in with its gift)
    FoxRoom.renderShop();
    if (came && FoxHost.showing()) {
      Sfx.play('reward');
      UI.toast(`${josa(this.nameOf(this.trip().fox), '이/가')} 탐험에서 돌아왔어요!`, { icon: '🎁', kind: 'gold', ms: 3600 });
    }
  },

  /* A fox sets off exploring. */
  sendOff(id, placeId) {
    const p = State.pet;
    const place = this.tripPlace(placeId);
    if (!place || this.trip() || !this.home().includes(id)) return false;
    const name = this.nameOf(id);
    const now = Date.now();
    p.trip = { fox: id, place: place.id, at: now, back: now + place.hours * 3600000 };
    this.tripWas = 'away';
    FoxHost.act('depart', id); // (while it is still one of the family in the yard: it runs off, and the others watch it go)
    if (p.species === id && this.home().length) {
      // she is with one of those that stay
      p.species = this.home()[0];
      p.name = this.nameOf(p.species);
    }
    Store.save();
    Sfx.play('pop');
    this.refresh();
    FoxRoom.renderShop();
    FoxRoom.tripWatch();
    this.wantFace();
    UI.toast(`${josa(name, '이/가')} ${josa(place.name, '으로/로')} 탐험을 떠났어요. ${tripTime(place.hours)} 뒤에 돌아와요!`, { icon: '🧭', ms: 3800 });
    return true;
  },

  /* She calls it back before its time: it is home at once — with nothing. */
  async callBack() {
    const t = this.trip();
    if (!t || this.tripPhase() !== 'away') return;
    const name = this.nameOf(t.fox);
    const ok = await UI.confirm({ icon: '🧭', title: `${josa(name, '을/를')} 지금 부를까요?`, text: '지금 돌아오면 선물은 가져오지 못해요.', ok: '불러오기', cancel: '기다릴게요' });
    if (!ok || State.pet.trip !== t || this.tripPhase() !== 'away') return; // (or it came home by itself in the meantime)
    State.pet.trip = null;
    this.tripWas = 'none';
    Store.save();
    this.refresh();
    FoxRoom.renderShop();
    FoxRoom.tripWatch();
    FoxHost.say(this.line('recalled'), 3000, t.fox);
    UI.toast(`${josa(name, '이/가')} 돌아왔어요`, { icon: '🦊' });
  },

  /* What it has brought from there: now and then the rare thing — otherwise one of the others, and rather one she has not got yet. */
  rollFind(place) {
    const have = State.pet.finds;
    if (Math.random() < 0.12) return place.finds[place.finds.length - 1];
    return pick(place.finds.slice(0, -1).flatMap((id) => (have[id] ? [id] : [id, id, id])));
  },

  /* She takes the gift from the fox that brought it: something for the gift box, and the coins it found on the way. */
  takeGift() {
    const p = State.pet;
    const t = this.trip();
    if (!t || this.tripPhase() !== 'back') return;
    const place = this.tripPlace(t.place);
    const id = this.rollFind(place);
    const find = TRIP_FINDS[id];
    const first = !p.finds[id];
    const coins = place.coins[0] + Math.floor(Math.random() * (place.coins[1] - place.coins[0] + 1)) + (find.rare ? 30 : 0);
    p.trip = null;
    this.tripWas = 'none';
    p.finds[id] = (p.finds[id] || 0) + 1;
    State.statistics.trips = (State.statistics.trips || 0) + 1;
    p.happiness = Math.min(100, p.happiness + 8);
    p.bond += 2;
    Store.save();
    FoxHost.act('gift', t.fox);
    this.refresh();
    UI.celebrate({
      emoji: find.emoji,
      title: `${this.nameOf(t.fox)}의 선물: ${find.name}`,
      subtitle: `“${find.says}”`,
      rewards: { coins },
      rare: !!find.rare,
      extraHtml: `<p class="cel-note">${place.emoji} ${esc(place.name)}에서 가져왔어요 · ${first ? '<b>처음 보는 선물!</b>' : `${p.finds[id]}개째`}${find.rare ? ' · 🌟 희귀' : ''}</p>`,
      buttons: [{ label: '고마워! 💗', primary: true }, { label: '🎁 선물 상자 보기', onClick: () => Trip.box() }],
    });
    Game.reward({ coins }); // (after the gift: whatever else that brings — a level, an achievement — is told second)
  },

  /* ----- pictures ----- */
  /* A round portrait of the fox she is with (the Home card, pop-ups, the welcome screen). An emoji until one has been drawn. */
  avatarHtml(cls = '') {
    const url = this.portrait();
    return `<span class="fox-avatar ${cls}" data-fox-avatar aria-hidden="true">${url ? `<img src="${url}" alt="">` : '🦊'}</span>`;
  },

  faceKey() {
    const id = State.pet.species;
    return `${id}@${this.grown(id)}|${this.outfit().join()}`;
  },

  /* The portrait is kept between visits, so showing it never has to start the 3D engine. */
  portrait() {
    const key = this.faceKey();
    if (this.faces[key]) return this.faces[key];
    try {
      const saved = JSON.parse(localStorage.getItem(FOX_FACE_KEY) || 'null');
      if (saved && saved.key === key && saved.url) return (this.faces[key] = saved.url);
    } catch (e) {
      /* no portrait yet */
    }
    return '';
  },

  drawPortrait() {
    if (!FoxHost.api) return '';
    const key = this.faceKey();
    const id = State.pet.species;
    let url = '';
    try {
      url = FoxHost.api.snapshot('fox', id, { worn: this.outfit().slice(), size: 220, grown: this.grown(id) }) || '';
    } catch (e) {
      console.warn('[Pet] portrait failed', e);
    }
    if (!url) return '';
    this.faces[key] = url;
    this.keepFace();
    this.fillAvatars();
    return url;
  },

  keepFace() {
    const key = this.faceKey();
    if (!this.faces[key]) return;
    try {
      localStorage.setItem(FOX_FACE_KEY, JSON.stringify({ key, url: this.faces[key] }));
    } catch (e) {
      /* it will be drawn again next time */
    }
  },

  /* She is with another fox, or it changed clothes or grew: a new portrait, once things have settled. */
  wantFace() {
    clearTimeout(this.faceTimer);
    this.faceTimer = setTimeout(() => {
      if (!this.portrait()) this.drawPortrait();
      else {
        this.keepFace();
        this.fillAvatars();
      }
    }, 700);
  },

  /* Draw the portrait when nothing else is going on (it starts the 3D engine the first time). `now` = don't wait for that. */
  wantPortrait(now = false) {
    if (this.portrait() || FoxHost.failed || (this.portraitTimer && !now)) return;
    clearTimeout(this.portraitTimer);
    this.portraitTimer = setTimeout(
      async () => {
        this.portraitTimer = 0;
        const idle = () => now || (!CoverHost.quiet && !UI.stack.length && Router.is('home'));
        if (this.portrait() || !idle()) return; // not now — the next Home visit asks again
        if (!(await FoxHost.ready())) return;
        if (!this.portrait() && idle()) this.drawPortrait();
      },
      now ? 0 : 1800
    );
  },

  fillAvatars(root = document) {
    const url = this.portrait();
    if (!url) {
      this.wantPortrait();
      return;
    }
    const mark = this.faceKey() + url.length;
    $$('[data-fox-avatar]', root).forEach((el) => {
      if (el.dataset.face === mark) return;
      el.dataset.face = mark;
      el.innerHTML = `<img src="${url}" alt="">`;
    });
  },

  snapshot(kind, id, opts) {
    const key = `${kind}:${id}:${opts.grown || 0}:${(opts.worn || []).join()}:${opts.size}:${opts.season || ''}`;
    if (!this.thumbCache[key] && FoxHost.api) {
      try {
        this.thumbCache[key] = FoxHost.api.snapshot(kind, id, opts) || '';
      } catch (e) {
        console.warn('[Pet] snapshot failed', e);
      }
    }
    return this.thumbCache[key] || '';
  },

  /* The picture for one <span data-fox-thumb="kind:id">: a fox (a kit as far grown as it is), a habitat, a thing for the yard, or the fox she is with wearing an accessory. */
  fillThumb(el) {
    const [kind, id] = el.dataset.foxThumb.split(':');
    const lead = State.pet.species;
    const url =
      kind === 'scene'
        ? this.snapshot('scene', id, { size: 220, season: Weather.seasonIn(id) }) // (as it looks at this time of year)
        : kind === 'yard'
          ? this.snapshot('decor', id, { size: 180 })
          : kind === 'fox'
            ? this.snapshot('fox', id, { size: 180, grown: this.grown(id) })
            : this.snapshot('fox', lead, { worn: [id], size: 180, grown: this.grown(lead) });
    el.classList.add('has-img');
    if (url) el.innerHTML = `<img src="${url}" alt="">`;
  },

  /* Shop pictures are drawn one at a time, so opening the shop never stutters. */
  fillThumbs(root) {
    if (!FoxHost.api || FoxHost.failed) return;
    clearTimeout(this.thumbTimer);
    const next = () => {
      const el = $('[data-fox-thumb]:not(.has-img)', root);
      if (!el || !el.isConnected) return;
      this.fillThumb(el);
      this.thumbTimer = setTimeout(next, 40);
    };
    this.thumbTimer = setTimeout(next, 80);
  },

  /* ----- the card on Home ----- */
  cardHtml() {
    const p = State.pet;
    const mail = this.mailWaiting();
    const trip = this.trip();
    const phase = this.tripPhase();
    const gift = phase === 'back';
    const empty = !this.home().length; // the only fox is out exploring
    const present = Present.waiting(); // Lorelei has something for her
    const spooky = !present && Halloween.waiting(); // …or a game to play: trick or treat
    const says = present ? `${josa(OWNER_NAME, '이/가')} 줄 게 있대요! 🎁` : spooky ? `${josa(OWNER_NAME, '이/가')} 트릭 오어 트릿 하재요! 🎃` : mail ? '우편함에 편지가 왔어!' : gift ? `${josa(this.nameOf(trip.fox), '이/가')} 선물을 물고 돌아왔어!` : empty ? `탐험을 떠났어요 · ${this.tripLeft()} 뒤에 돌아와요` : this.moodLine();
    return `
      <button class="pet-face" data-action="fox-open" aria-label="${esc(p.name)} 만나러 가기">${this.avatarHtml('is-big')}</button>
      <div class="pet-side">
        <div class="pet-name"><b>${esc(p.name)}</b> <span class="chip">유대감 Lv ${this.bondLevel()}</span>${p.out.length > 1 ? ` <span class="chip">🦊 ${p.out.length}마리</span>` : ''}${
          phase === 'away' ? ` <span class="chip">🧭 ${p.out.length > 1 ? `${esc(this.nameOf(trip.fox))} ` : ''}탐험 중</span>` : ''
        } <span class="chip" title="여우 세상의 계절과 날씨">${Weather.chipHtml(p.scene, true)}</span></div>
        <p class="pet-says">${esc(says)}</p>
        ${this.barsHtml()}
      </div>
      <button class="btn primary wide pet-go" data-action="fox-open">${present ? `🎁 ${esc(OWNER_NAME)} 만나러 가기` : spooky ? `🎃 ${esc(OWNER_NAME)} 만나러 가기` : mail ? '💌 편지 받으러 가기' : gift ? '🎁 선물 받으러 가기' : empty ? '🏡 마당 보러 가기' : `🦊 ${esc(p.name)} 만나러 가기`}</button>`;
  },

  barsHtml() {
    const p = State.pet;
    return `<div class="pet-stat"><span>❤️ 행복</span>${meterHtml(p.happiness, 100, '행복')}</div>
      <div class="pet-stat"><span>🍖 포만감</span>${meterHtml(p.fullness, 100, '포만감')}</div>`;
  },

  /* The numbers or the looks changed: bring the Home card and the foxes' world up to date. */
  refresh() {
    $$('[data-pet-card]').forEach((el) => (el.innerHTML = this.cardHtml()));
    FoxRoom.refresh();
    FoxHost.sync();
  },

  /* She has found out how to play with the foxes: the hint can go. */
  learned() {
    if (State.pet.taught) return;
    State.pet.taught = true;
    Store.save();
    $$('[data-fox-tip]').forEach((el) => el.remove());
  },

  /* ----- interactions ----- */
  /* A pat for the fox that was touched (`id`) — touching one of the family is also how she chooses who she is with. */
  pet(id) {
    const p = State.pet;
    if (!id && !this.anyoneHome('쓰다듬어 주세요')) return;
    if (id) this.select(id);
    const who = id || p.species;
    p.happiness = Math.min(100, p.happiness + 4);
    p.bond += 1;
    State.statistics.petTaps += 1;
    Sfx.play('heart');
    if (State.daily.petDopamine < 20) {
      State.daily.petDopamine += 1;
      Game.reward({ dopamine: 1 });
    }
    Game.track('pet');
    this.learned();
    this.care('pet', [who]);
    this.refresh();
    FoxHost.act('pet', who);
    if (Math.random() < 0.45 || FoxHost.failed || !FoxHost.api) FoxHost.say(this.line('petted'), 1800, who);
    if (FoxHost.failed || !FoxHost.api) this.heartBurst(FoxHost.stage);
    Game.checkAchievements();
    Store.save();
  },

  feed(anchor) {
    if (!this.anyoneHome('먹이를 주세요') || !this.spend(5)) return;
    const p = State.pet;
    p.fullness = Math.min(100, p.fullness + 30);
    p.happiness = Math.min(100, p.happiness + 5);
    p.bond += 1;
    Sfx.play('pop');
    UI.floatText('🍖', anchor);
    Game.track('feed');
    this.care('feed', p.out);
    this.refresh();
    FoxHost.act('feed');
    FoxHost.say(this.line('fed'), 2400);
    Store.save();
  },

  play(anchor) {
    if (!this.anyoneHome('같이 놀아 주세요') || !this.spend(10)) return;
    const p = State.pet;
    p.happiness = Math.min(100, p.happiness + 25);
    p.bond += 2;
    Sfx.play('reward');
    UI.floatText('🎾', anchor);
    this.care('play', p.out);
    this.refresh();
    FoxHost.act('play');
    FoxHost.say(this.line('played'), 2200);
    Store.save();
  },

  spend(coins) {
    if (State.dopamine.coins < coins) {
      Sfx.play('error');
      UI.toast(`코인이 ${coins - State.dopamine.coins}개 모자라요 — 게임을 하거나 노래를 불러서 모아 보세요!`, { icon: '🪙' });
      return false;
    }
    State.dopamine.coins -= coins;
    UI.updateHud();
    return true;
  },

  /* ----- name tags ----- */
  /* How a kit is getting on, for its name tag: the bar, what it means, and the switch that keeps it a kit. */
  growBoxHtml(id) {
    const g = this.growth(id);
    const stay = !!State.pet.stay[id];
    return `<div class="grow-box">
      <div class="grow-row"><span>🌱 성장</span>${meterHtml(g, 100, '성장')}<b>${Math.floor(g)}%</b></div>
      <p class="hint" data-grow-hint>${
        stay
          ? '지금은 아기 모습으로 지내요. 끄면 자라던 데서부터 다시 자라요.'
          : g >= 100
            ? '다 자랐어요! 저장하면 어른이 될지 물어봐요.'
            : '먹이를 주고, 놀아 주고, 쓰다듬어 주면 날마다 조금씩 자라서 며칠 뒤엔 어른이 돼요.'
      }</p>
      <div class="set-row"><span id="stay-label">계속 아기로 두기</span>
        <button type="button" class="switch ${stay ? 'on' : ''}" role="switch" aria-checked="${stay}" aria-labelledby="stay-label" data-stay-switch><i></i></button></div>
    </div>`;
  },

  /* A fox's name tag: 'first' (name her first fox, once), 'new' (one that has just come home) or 'edit' (change the name — and, for a kit, whether it stays one). */
  askName(id = State.pet.species, why = 'edit') {
    const p = State.pet;
    const def = this.foxDef(id);
    const cur = this.nameOf(id);
    const edit = why === 'edit';
    const kit = edit && isKit(id);
    const title = { first: '여우에게 이름을 지어 주세요', new: '새 가족의 이름을 지어 주세요', edit: `${cur}의 이름표` }[why];
    const done = (name) => {
      p.names[id] = name;
      if (id === p.species) p.name = name;
      if (why === 'first') p.named = true;
      Store.save();
      this.refresh();
      FoxRoom.renderShop();
    };
    return new Promise((resolve) => {
      const ov = UI.open(
        `<form class="dialog" data-rename>
          <div class="dialog-icon" aria-hidden="true"><span class="fox-avatar is-mid" data-fox-thumb="fox:${id}">${def.emoji}</span></div>
          <h2><label for="fox-name">${esc(title)}</label></h2>
          <p>${edit ? esc(def.name) : '나중에 이름표를 눌러서 언제든 바꿀 수 있어요.'}</p>
          <input id="fox-name" class="ob-input" maxlength="12" value="${why === 'new' ? '' : esc(cur)}" placeholder="${esc(cur)}" autocomplete="off" enterkeyhint="done">
          ${kit ? this.growBoxHtml(id) : ''}
          <div class="dialog-actions ${edit ? '' : 'one'}">
            ${edit ? '<button class="btn soft" type="button" data-ov-cancel>취소</button>' : ''}
            <button class="btn primary" type="submit">${edit ? '저장' : '이 이름으로 할게요'}</button>
          </div>
        </form>`,
        {
          cls: 'is-dialog',
          label: title,
          onClose: () => {
            if (!edit && !p.names[id]) done(cur); // closed without answering: it keeps the name it came with
            else if (why === 'first' && !p.named) done(this.nameOf(id));
            resolve(this.nameOf(id));
          },
        }
      );
      const input = $('#fox-name', ov.panel);
      if (FoxHost.api) this.fillThumb($('[data-fox-thumb]', ov.panel));
      const cancel = $('[data-ov-cancel]', ov.panel);
      if (cancel) cancel.addEventListener('click', () => UI.close(ov));
      const sw = $('[data-stay-switch]', ov.panel);
      if (sw) {
        sw.addEventListener('click', () => {
          const on = !sw.classList.contains('on');
          sw.classList.toggle('on', on);
          sw.setAttribute('aria-checked', String(on));
          Sfx.play('pop');
        });
      }
      $('[data-rename]', ov.panel).addEventListener('submit', (e) => {
        e.preventDefault();
        done(input.value.trim().slice(0, 12) || cur);
        UI.close(ov);
        if (sw) {
          const stay = sw.classList.contains('on');
          if (stay !== !!p.stay[id]) this.setStay(id, stay);
          else if (!stay && this.growth(id) >= 100) this.offerGrowUp(id, true);
        }
      });
      if (!edit || !kit) {
        setTimeout(() => {
          input.focus();
          input.select();
        }, 80);
      }
    });
  },

  /* ----- the yard ----- */
  yardItem(id) {
    return YARD_ITEMS.find((x) => x.id === id) || YARD_ITEMS[0];
  },

  /* Where a thing stands, if it is out. */
  placedAt(id) {
    return State.pet.yard.find((it) => it.id === id) || null;
  },

  /* Arranging the yard takes the 3D view. */
  canYard() {
    if (FoxHost.api && !FoxHost.failed) return true;
    Sfx.play('error');
    UI.toast('이 기기에서는 3D 화면을 쓸 수 없어서 마당을 꾸밀 수 없어요.', { icon: '🏡', ms: 3600 });
    return false;
  },

  /* A thing has the place she gave it: where she moved it to, and how she turned it. (Until then it stands where the 3D side arranges it.) */
  placed(id, at) {
    const pv = this.previewing;
    const it = this.placedAt(id);
    if (it) Object.assign(it, at);
    else if (pv && pv.kind === 'yard' && pv.id === id) pv.at = at;
    else return;
    Store.save();
  },

  /* No room in the yard for one more thing. (The 3D side says so while it is being brought up to date: answer afterwards.) */
  yardFull(id) {
    setTimeout(() => {
      const p = State.pet;
      const pv = this.previewing;
      if (pv && pv.kind === 'yard' && pv.id === id) this.previewing = null;
      p.yard = p.yard.filter((it) => it.id !== id || it.x != null);
      if (this.held === id) this.held = null;
      Store.save();
      this.refresh();
      FoxRoom.renderShop();
      Sfx.play('error');
      UI.toast('마당에 놓을 자리가 없어요. 다른 물건을 옮기거나 넣어 둔 다음 다시 해 보세요.', { icon: '🏡', ms: 3800 });
    }, 0);
  },

  /* Pick one of the things in the yard, to move it (null: let go of it). */
  hold(id) {
    if (id && !this.placedAt(id)) return;
    if (this.held === (id || null)) return;
    this.held = id || null;
    if (id) this.previewing = null;
    this.refresh();
  },

  /* The thing she has picked (or is trying out) turns an eighth of a turn. */
  turnHeld() {
    const pv = this.previewing;
    const id = pv && pv.kind === 'yard' ? pv.id : this.held;
    if (!id || !FoxHost.api) return;
    if (FoxHost.api.turnDecor(id)) Sfx.play('pop');
    else {
      Sfx.play('error');
      UI.toast('여기서는 돌릴 자리가 없어요. 조금 옮긴 다음에 돌려 보세요.', { icon: '🏡' });
    }
  },

  /* …or goes back into storage. */
  storeHeld() {
    const id = this.held;
    if (!id) return;
    State.pet.yard = State.pet.yard.filter((it) => it.id !== id);
    this.held = null;
    Store.save();
    Sfx.play('pop');
    this.refresh();
    FoxRoom.renderShop();
    UI.toast(`${josa(this.yardItem(id).name, '을/를')} 넣어 두었어요`, { icon: '📦' });
  },

  /* A fox has had its fun with something in the yard: a well-kept yard keeps them happy (a little, and only so much a day). */
  yardFun() {
    const d = State.daily;
    if ((d.yardFun || 0) >= 8) return;
    d.yardFun = (d.yardFun || 0) + 1;
    State.pet.happiness = Math.min(100, State.pet.happiness + 1);
    Store.save();
    FoxRoom.refresh();
  },

  /* ----- the weather ----- */
  /* She has seen the foxes in the rain, or in the snow (each counted once a day). */
  skySeen(sky) {
    const key = { rain: 'rainy', snow: 'snowy' }[sky.kind];
    const seen = State.daily.skySeen || (State.daily.skySeen = {});
    if (!key || seen[sky.kind]) return;
    seen[sky.kind] = true;
    State.statistics[key] = (State.statistics[key] || 0) + 1;
    Store.save();
    Game.checkAchievements();
  },

  /* A fox has jumped into a puddle: as good as a toy in the yard. */
  puddle() {
    State.statistics.puddles = (State.statistics.puddles || 0) + 1;
    this.yardFun();
    Store.save();
    Game.checkAchievements();
  },

  /* ----- her covers, played to the foxes ----- */
  /* They have heard a good piece of one (or all of it): they love that. */
  concert() {
    const p = State.pet;
    const d = State.daily;
    State.statistics.concerts = (State.statistics.concerts || 0) + 1;
    if ((d.concerts || 0) < 5) {
      d.concerts = (d.concerts || 0) + 1;
      p.happiness = Math.min(100, p.happiness + 6);
      p.bond += 1;
    }
    Store.save();
    this.refresh();
    Game.checkAchievements();
  },

  /* The cover is over. */
  encore() {
    FoxHost.act('encore');
    FoxHost.say(this.line('encore'), 3000);
  },

  /* ----- the shop: foxes, outfits, habitats and the yard ----- */
  owns(kind, id) {
    return State.pet[SHOP_KINDS[kind].owned].includes(id);
  },

  inUse(kind, id) {
    const p = State.pet;
    if (kind === 'fox') return p.out.includes(id);
    if (kind === 'scene') return p.scene === id;
    if (kind === 'yard') return !!this.placedAt(id);
    return id === 'mic' ? p.things.includes(id) : this.outfit().includes(id);
  },

  /* A tap on a shop item: use it if it is hers, otherwise try it out. */
  shopTap(kind, id) {
    if (kind === 'yard' && !this.canYard()) return;
    if (this.owns(kind, id)) {
      this.previewing = null;
      Sfx.play(this.use(kind, id) === false ? 'error' : 'pop');
      return;
    }
    if (!SHOP_KINDS[kind].list.some((x) => x.id === id && !x.gift)) return; // (nothing of that name — or not for sale)
    const same = this.previewing && this.previewing.kind === kind && this.previewing.id === id;
    this.previewing = same ? null : { kind, id };
    if (kind === 'yard') this.held = null;
    Sfx.play('tap');
    this.refresh();
  },

  cancelPreview() {
    if (!this.previewing) return;
    this.previewing = null;
    this.refresh();
  },

  /* Something of hers: a fox comes out or goes to rest, the family moves house, a thing for the yard is put out (or picked, to move it), the fox she is with puts an accessory on or takes it off. */
  use(kind, id) {
    const p = State.pet;
    let line = '';
    if (kind === 'fox') {
      if (this.away(id)) {
        UI.toast(`${josa(this.nameOf(id), '은/는')} 탐험 중이에요. 돌아오면 쉬게 할 수 있어요.`, { icon: '🧭' });
        return false;
      }
      if (p.out.includes(id)) {
        if (p.out.length < 2) {
          UI.toast('적어도 한 마리는 함께 있어야 해요', { icon: '🦊' });
          return false;
        }
        p.out = p.out.filter((x) => x !== id);
        if (p.species === id) {
          p.species = p.out[0];
          p.name = this.nameOf(p.species);
        }
        UI.toast(`${josa(this.nameOf(id), '이/가')} 쉬러 갔어요`, { icon: '💤' });
      } else {
        if (p.out.length >= MAX_OUT) {
          UI.toast(`함께 지낼 수 있는 건 ${MAX_OUT}마리까지예요. 먼저 한 마리를 쉬게 해 주세요.`, { icon: '🦊', ms: 3600 });
          return false;
        }
        p.out.push(id);
      }
    } else if (kind === 'scene') {
      if (p.scene !== id) line = this.line('newHome');
      p.scene = id;
    } else if (kind === 'yard') {
      if (this.placedAt(id)) this.held = this.held === id ? null : id;
      else {
        p.yard.push({ id }); // (no place of her choosing yet: the 3D side finds it one)
        this.held = id;
      }
    } else if (id === 'mic') {
      p.things = p.things.includes(id) ? p.things.filter((x) => x !== id) : p.things.concat(id);
    } else {
      const worn = this.outfit();
      if (worn.includes(id)) worn.splice(worn.indexOf(id), 1);
      else {
        worn.push(id);
        line = this.line('accessory');
      }
    }
    Store.save();
    this.refresh();
    if (line) {
      FoxHost.act(kind === 'acc' ? 'dress' : 'joy', kind === 'acc' ? p.species : undefined);
      FoxHost.say(line, 2400);
    }
    if (kind === 'fox' || kind === 'acc') this.wantFace();
    Game.checkAchievements();
    FoxRoom.renderShop();
    return true;
  },

  buyPreview() {
    const pv = this.previewing;
    if (!pv) return;
    const def = SHOP_KINDS[pv.kind];
    const item = def.list.find((x) => x.id === pv.id);
    if (!item || item.gift || !this.spend(item.price)) return;
    const p = State.pet;
    p[def.owned].push(item.id);
    this.previewing = null;
    Sfx.play('coin');
    UI.confetti({ count: pv.kind === 'acc' ? 30 : 70 });
    if (pv.kind === 'fox') return this.adopt(item);
    if (pv.kind === 'yard') {
      // it stays where she was trying it out, and is still hers to move
      p.yard.push({ id: item.id, ...(pv.at || {}) });
      this.held = item.id;
      Store.save();
      this.refresh();
      FoxRoom.renderShop();
      UI.toast(`마당에 ${josa(item.name, '을/를')} 놓았어요! 끌어서 옮길 수 있어요.`, { icon: item.emoji, kind: 'gold', ms: 3600 });
      FoxHost.act('newThing', item.id);
      FoxHost.say(this.line('newThing'), 2600);
      Game.checkAchievements();
      return;
    }
    UI.toast(pv.kind === 'scene' ? `${josa(item.name, '으로/로')} 이사했어요!` : item.id === 'mic' ? `마당에 ${josa(item.name, '을/를')} 세웠어요!` : `${p.name}에게 ${josa(item.name, '을/를')} 선물했어요!`, {
      icon: item.emoji,
      kind: 'gold',
      ms: 3200,
    });
    this.use(pv.kind, item.id);
    Store.save();
  },

  /* A fox has just been brought home: it joins the family (if there is room in the yard) and gets its name. */
  async adopt(item) {
    const p = State.pet;
    const room = p.out.length < MAX_OUT;
    if (room) {
      p.out.push(item.id);
      p.species = item.id; // she is with the newcomer now
      p.name = this.nameOf(item.id);
    }
    Store.save();
    Game.checkAchievements();
    this.refresh(); // the fox that came to visit stays: the same one, no longer a guest
    FoxRoom.renderShop();
    FoxHost.act('hello', item.id);
    UI.toast(`${josa(item.name, '이/가')} 우리 집에 왔어요!`, { icon: '🦊', kind: 'gold', ms: 3200 });
    const name = await this.askName(item.id, 'new');
    if (room) FoxHost.say(this.line('newFox'), 2600, item.id);
    else UI.toast(`지금은 ${MAX_OUT}마리가 함께 지내고 있어서 ${josa(name, '은/는')} 쉬고 있어요. 여우 탭에서 바꿔 줄 수 있어요.`, { icon: '💤', ms: 4200 });
    this.wantFace();
  },

  /* One card of the shop: something to buy, or an outfit, a habitat or a thing for the yard of hers. */
  itemHtml(kind, it) {
    const owned = this.owns(kind, it.id);
    const on = this.inUse(kind, it.id);
    const trying = (this.previewing && this.previewing.kind === kind && this.previewing.id === it.id) || (kind === 'yard' && this.held === it.id);
    const mic = kind === 'acc' && it.id === 'mic';
    const states = { fox: ['', ''], acc: mic ? ['✓ 세워 둠', '세우기'] : ['✓ 착용 중', '착용하기'], scene: ['✓ 사는 중', '이사하기'], yard: ['✓ 마당에 있음', '보관 중 · 놓기'] }[kind];
    const state = on ? states[0] : owned ? states[1] : `${it.price} 🪙`;
    return `<button class="shop-item ${kind === 'scene' ? 'is-wide' : ''} ${owned ? 'owned' : ''} ${on ? 'worn' : ''} ${trying ? 'trying' : ''}" data-action="shop-tap" data-kind="${kind}" data-id="${it.id}" data-sfx="none" aria-pressed="${on}">
        <span class="shop-pic" ${mic ? '' : `data-fox-thumb="${kind}:${it.id}"`} aria-hidden="true">${it.emoji}</span>
        <b>${esc(it.name)}</b>
        ${it.desc ? `<span class="shop-desc">${esc(it.desc)}</span>` : ''}
        <small>${state}</small></button>`;
  },

  /* One of her foxes: its picture and name, what kind it is (a kit: how far grown), whether it is out — and a pencil for its name tag. */
  familyHtml(id) {
    const p = State.pet;
    const def = this.foxDef(id);
    const on = p.out.includes(id);
    const name = this.nameOf(id);
    const kit = isKit(id);
    const about = kit ? (p.stay[id] ? `${def.name} · 아기로 지내요` : `${def.name} · 성장 ${Math.floor(this.growth(id))}%`) : def.gift ? `${def.name} · 🎁 선물로 온 아이` : def.name;
    return `<div class="shop-cell">
      <button class="shop-item owned ${on ? 'worn' : ''}" data-action="shop-tap" data-kind="fox" data-id="${id}" data-sfx="none" aria-pressed="${on}">
        <span class="shop-pic" data-fox-thumb="fox:${id}" aria-hidden="true">${def.emoji}</span>
        <b>${esc(name)}</b>
        <span class="shop-desc">${esc(about)}</span>
        ${kit && !p.stay[id] ? `<span class="shop-grow">${meterHtml(this.growth(id), 100, '성장')}</span>` : ''}
        <small>${this.away(id) ? '🧭 탐험 중' : on ? '✓ 함께 지내는 중' : '쉬는 중 · 부르기'}</small></button>
      <button class="shop-edit" data-action="fox-rename" data-id="${id}" aria-label="${esc(name)}의 이름표">✏️</button>
    </div>`;
  },

  shopHtml(kind) {
    const p = State.pet;
    const grid = (html, cls = '') => `<div class="shop-grid ${cls}">${html}</div>`;
    if (kind === 'fox') {
      const family = p.out.concat(p.foxes.filter((id) => !p.out.includes(id))); // the ones in the yard first
      const more = FOXES.filter((f) => !f.gift && !p.foxes.includes(f.id)); // (what is a present is not for sale)
      const cards = (list) => grid(list.map((it) => this.itemHtml('fox', it)).join(''));
      return `<p class="shop-count"><span>함께 지내는 여우</span><b>${p.out.length} / ${MAX_OUT}</b></p>
        <h3 class="shop-head">우리 가족 <small>${p.foxes.length}마리</small></h3>
        <p class="hint">누를 때마다 마당에 나오거나 쉬러 가요. ✏️를 누르면 이름표가 나와요.</p>
        ${grid(family.map((id) => this.familyHtml(id)).join(''))}
        ${
          more.length
            ? `<h3 class="shop-head">새 친구 데려오기</h3>
               <p class="hint">누르면 먼저 만나 볼 수 있어요. 아기 여우는 돌봐 주면 며칠에 걸쳐 어른으로 자라요.</p>
               ${cards(more.filter((f) => !f.baby))}${more.some((f) => f.baby) && more.some((f) => !f.baby) ? '<div class="shop-gap"></div>' : ''}${cards(more.filter((f) => f.baby))}`
            : ''
        }`;
    }
    if (kind === 'acc') {
      const home = this.home();
      const several = home.length > 1;
      const who = several
        ? `<div class="fox-who" role="radiogroup" aria-label="누구를 꾸밀까요?">${home
            .map((id) => {
              const on = id === p.species;
              return `<button class="fox-chip ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-action="fox-select" data-id="${id}"><span class="fox-avatar is-chip" data-fox-thumb="fox:${id}" aria-hidden="true">${this.foxDef(id).emoji}</span><span>${esc(this.nameOf(id))}</span></button>`;
            })
            .join('')}</div>`
        : '';
      const items = PET_SHOP.filter((it) => !it.gift || this.owns(kind, it.id)); // (a present shows once it is hers)
      return `${who}<p class="hint">${several ? `${esc(josa(p.name, '이/가'))} 걸칠 것을 골라요. ` : ''}가진 장식은 누를 때마다 쓰고 벗어요. 여러 개를 함께 걸쳐도 돼요.</p>${grid(items.map((it) => this.itemHtml(kind, it)).join(''))}`;
    }
    if (kind === 'yard') {
      return `<p class="shop-count"><span>마당에 놓은 물건</span><b>${p.yard.length}개</b></p>
        <p class="hint">누르면 마당에 놓여요. 마당에서 끌어서 옮기고, ↻로 돌리거나 넣어 둘 수 있어요. 놓아 두면 여우들이 알아서 가지고 놀아요.</p>
        ${grid(YARD_ITEMS.map((it) => this.itemHtml(kind, it)).join(''))}`;
    }
    return `<p class="hint">${SHOP_KINDS[kind].hint}</p>${grid(HABITATS.map((it) => this.itemHtml(kind, it)).join(''), 'is-scenes')}`;
  },

  previewHtml() {
    const pv = this.previewing;
    const turn = '<button class="icon-btn small" data-action="yard-turn" data-sfx="none" aria-label="돌리기">↻</button>';
    if (!pv) {
      // a thing of hers in the yard that she has picked: move it, turn it, put it away
      if (!this.held || FoxRoom.tab !== 'yard') return '';
      return `<div class="fox-preview">
        <span class="fp-text"><b>${esc(this.yardItem(this.held).name)}</b> 옮기는 중</span>
        ${turn}
        <button class="btn soft small" data-action="yard-store" data-sfx="none">넣어두기</button>
        <button class="btn primary small" data-action="yard-done">완료</button>
      </div>`;
    }
    const def = SHOP_KINDS[pv.kind];
    const item = def.list.find((x) => x.id === pv.id);
    if (!item) return '';
    if (pv.kind === 'yard') {
      return `<div class="fox-preview">
        <span class="fp-text"><b>${esc(item.name)}</b> 미리 보기</span>
        ${turn}
        <button class="btn primary small" data-action="shop-buy">${item.price} 🪙 ${def.verb}</button>
        <button class="icon-btn small" data-action="shop-cancel" aria-label="미리 보기 그만두기">✕</button>
      </div>`;
    }
    return `<div class="fox-preview">
      <span class="fp-text"><b>${esc(item.name)}</b> 미리 보는 중</span>
      <button class="btn primary small" data-action="shop-buy">${item.price} 🪙 ${def.verb}</button>
      <button class="icon-btn small" data-action="shop-cancel" aria-label="미리 보기 그만두기">✕</button>
    </div>`;
  },

  /* Without the 3D view, pats still get their hearts. */
  heartBurst(anchor) {
    if (!anchor || reducedMotion()) return;
    const r = anchor.getBoundingClientRect();
    for (let i = 0; i < 5; i++) {
      const h = document.createElement('div');
      h.className = 'heart-pop';
      h.textContent = pick(['💗', '💕', '💖', '✨']);
      h.style.left = `${r.left + r.width / 2 + (Math.random() - 0.5) * 120}px`;
      h.style.top = `${r.top + r.height * 0.42}px`;
      h.style.setProperty('--dx', `${(Math.random() - 0.5) * 80}px`);
      h.style.animationDelay = `${i * 60}ms`;
      document.body.appendChild(h);
      setTimeout(() => h.remove(), 1400);
    }
  },
};

/* ------------------------------------------------------------------
   FoxRoom — the foxes' world on the whole screen: a loading screen
   first, then the 3D view with the controls laid over it.
   ------------------------------------------------------------------ */
const FoxRoom = {
  ov: null,
  tab: null, //     which shop tab is open (null = shop closed)
  photoOn: false, // she is taking pictures (the controls make way for the camera's)
  pose: 'sit',
  tripTimer: 0, //   while it is open: the time on the expedition chip is brought up to date…
  tripDue: 0, //     …and the fox comes in on the minute it is due
  tuneKey: '', //    the cover the foxes were last told of (and whether it was playing)
  gig: null, //      …and how much of it they have heard: { id, heard, playing, time, duration, said, paid }
  skyTimer: 0, //    while it is open: the weather is looked at every few seconds…
  skyDue: 0, //      …and the moment it may change
  skyWas: null, //   the sky she last saw here: { scene, kind }

  canFullscreen() {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  },
  isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  },
  enterFullscreen() {
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (!request || this.isFullscreen()) return;
    try {
      const p = request.call(el, { navigationUI: 'hide' });
      if (p && p.catch) p.catch(() => {}); // not allowed here (or not from a tap): the view still fills the page
    } catch (e) {
      /* ignore */
    }
  },
  leaveFullscreen() {
    const exit = document.exitFullscreen || document.webkitExitFullscreen;
    if (!exit || !this.isFullscreen()) return;
    try {
      const p = exit.call(document);
      if (p && p.catch) p.catch(() => {});
    } catch (e) {
      /* ignore */
    }
  },

  html() {
    const p = State.pet;
    return `<div class="fox-room" data-fox-room>
      <div class="fox-stage" data-fox-stage role="img" aria-label="여우들과 주인 ${esc(josa(OWNER_NAME, '이/가'))} 사는 곳. 바닥을 누르면 달려오고, 여우를 누르면 쓰다듬을 수 있어요.">
        <div class="fox-wait" aria-hidden="true"><span>🦊</span></div>
        <div class="fox-bubble" data-fox-bubble hidden></div>
      </div>
      <div class="fox-hud">
        <div class="fh-top">
          <button class="fh-btn" data-action="fox-close" aria-label="나가기">‹</button>
          <div class="fh-id">
            <button class="fh-name" data-action="fox-rename" aria-label="여우 이름표 보기"><b data-pet-name>${esc(p.name)}</b><span data-pet-bond>유대감 Lv ${Pet.bondLevel()}</span><i aria-hidden="true">✏️</i></button>
            <div class="fh-bars" data-pet-bars>${Pet.barsHtml()}</div>
          </div>
          <span class="fh-coins" title="코인"><span aria-hidden="true">🪙</span> <b data-live="coins-short">${fmtCompact(State.dopamine.coins)}</b><span class="sr-only"> 코인</span></span>
          ${this.canFullscreen() ? '<button class="fh-btn" data-action="fox-full" aria-label="전체 화면 켜기/끄기">⛶</button>' : ''}
        </div>
        <div class="fh-mid">
          <div class="fox-tune" data-fox-tune hidden></div>
          <button class="fox-mail is-trip" data-action="fox-trip" data-fox-trip hidden></button>
          <button class="fox-mail" data-action="fox-letter" data-fox-mail hidden></button>
          <button class="fox-mail is-present" data-action="fox-present" data-fox-present hidden></button>
          ${p.taught ? '' : '<p class="fox-tip" data-fox-tip>👆 바닥을 누르면 달려와요 · 여우를 쓰다듬어 보세요</p>'}
          <button class="fox-back" data-action="fox-back" data-fox-back hidden><span aria-hidden="true">🦊</span> 여우에게 돌아가기</button>
        </div>
        <button class="fox-cam" data-action="fox-photo" aria-label="사진 찍기"><span aria-hidden="true">📷</span></button>
        <button class="fox-cam is-trip" data-action="fox-trip" data-fox-trip-btn aria-label="탐험 보내기"><span aria-hidden="true">🧭</span></button>
        <button class="fox-sky" data-action="fox-sky" data-fox-sky aria-label="여우 세상의 계절과 날씨"></button>
        <div class="fh-actions">
          <button class="fh-act" data-action="pet-pet" data-sfx="none"><span aria-hidden="true">💗</span><b>쓰다듬기</b></button>
          <button class="fh-act" data-action="pet-feed"><span aria-hidden="true">🍖</span><b>먹이</b><small>5🪙</small></button>
          <button class="fh-act" data-action="pet-play"><span aria-hidden="true">🎾</span><b>놀아주기</b><small>10🪙</small></button>
          <button class="fh-act" data-action="fox-juke"><span aria-hidden="true">💿</span><b>들려주기</b></button>
          <button class="fh-act is-shop" data-action="fox-shop" data-tab="fox"><span aria-hidden="true">🛍️</span><b>상점</b></button>
        </div>
      </div>
      <div class="fox-drawer" data-fox-drawer hidden>
        <div class="fd-head">
          <div class="seg fd-tabs" role="tablist" aria-label="상점">
            ${Object.keys(SHOP_KINDS)
              .map((k) => `<button class="seg-btn" role="tab" data-action="fox-shop" data-tab="${k}">${SHOP_KINDS[k].tab}</button>`)
              .join('')}
          </div>
          <button class="icon-btn small" data-action="fox-shop-close" aria-label="상점 닫기">✕</button>
        </div>
        <div data-fox-preview></div>
        <div class="fd-body" data-fox-shop></div>
      </div>
      <div class="fox-photo" data-fox-photo hidden>
        <div class="fp-top">
          <button class="fh-btn" data-action="photo-exit" aria-label="사진 찍기 끝내기">✕</button>
          <p class="fp-hint">끌어서 돌려 보고, 벌리거나 휠로 당겨 보세요</p>
        </div>
        <div class="fp-poses" role="radiogroup" aria-label="포즈">
          ${PHOTO_POSES.map(([id, name]) => `<button class="fp-pose" role="radio" aria-checked="false" data-action="photo-pose" data-pose="${id}">${name}</button>`).join('')}
        </div>
        <div class="fp-bar">
          <button class="fp-last" data-action="photo-album" data-photo-last aria-label="사진첩 열기"><span aria-hidden="true">🖼️</span></button>
          <button class="fp-shutter" data-action="photo-shoot" data-sfx="none" aria-label="찰칵! 사진 찍기"><i></i></button>
          <span class="fp-side" aria-hidden="true"></span>
        </div>
        <div class="fp-flash" data-photo-flash aria-hidden="true"></div>
      </div>
      <div class="fox-splash" data-fox-splash role="status">
        <div class="fs-fox" aria-hidden="true">🦊</div>
        <h2>${esc(p.name)}에게 가는 중…</h2>
        <div class="fs-bar" aria-hidden="true"><i></i></div>
        <p class="fs-tip">💡 ${esc(pick(LOADING_TIPS))}</p>
      </div>
    </div>`;
  },

  /* Enter the foxes' world. Called from a tap, so the browser lets the page go full screen.
     (`early`: he is looking at how something will be, before it has opened for her — js/opening.js.) */
  async open({ early = false } = {}) {
    if (this.ov) return;
    if (Opening.shut() && !early) return void Opening.tell();
    if (State.settings.foxFullscreen) this.enterFullscreen();
    Pet.tick();
    Pet.previewing = null;
    Pet.asked = {};
    this.tab = null;
    this.photoOn = false;
    Pet.held = null;
    this.tuneKey = '';
    const ov = (this.ov = UI.open(this.html(), { full: true, cls: 'is-fox', label: `${State.pet.name}의 세상`, onClose: () => this.closed() }));
    const panel = ov.panel;
    const splash = $('[data-fox-splash]', panel);
    const bar = $('.fs-bar i', splash);
    const stage = $('[data-fox-stage]', panel);
    const began = performance.now();
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    bar.style.width = '20%';

    const ok = await FoxHost.ready();
    if (this.ov !== ov) return; // left while loading
    bar.style.width = '55%';
    await frame();
    await frame(); // let the loading screen paint before the world is built
    if (this.ov !== ov) return;
    if (ok) FoxHost.mount(stage, { greet: true });
    else {
      FoxHost.stage = stage;
      stage.classList.add('is-flat');
    }
    this.mailButton();
    this.tripChip();
    this.tripWatch();
    this.skyWas = null;
    this.sky();
    this.skyWatch();
    this.tune();
    bar.style.width = '88%';
    await frame();
    await sleep(Math.max(250, 1300 - (performance.now() - began)));
    if (this.ov !== ov) return;
    bar.style.width = '100%';
    await sleep(260);
    splash.classList.add('is-done');
    setTimeout(() => splash.remove(), 520);
    if (!ok) FoxHost.say(Pet.line('greet'), 3000);
    if (!Pet.portrait()) Pet.drawPortrait();
    if (Meet.due()) {
      // her first time here: Lorelei says hello and shows her round (js/meet.js)
      await sleep(700);
      if (this.ov !== ov) return;
      if (UI.top() === ov) await Meet.begin();
      if (this.ov !== ov) return;
    }
    Present.arrive(); // (if Lorelei has something for her, she calls before long)
    Halloween.arrive(); // (…or, on Halloween, to play trick or treat)
    await sleep(900);
    if (this.ov !== ov || UI.top() !== ov) return;
    // the country round the yard is new: say once how to look about in it
    if (ok && !State.pet.toured) {
      State.pet.toured = true;
      Store.save();
      UI.toast('여우 세상이 훨씬 넓어졌어요! 화면을 손가락으로 밀어서 둘러보세요.', { icon: '🗺️', ms: 5200 });
      await sleep(5600);
      if (this.ov !== ov) return;
    }
    // …and so is the girl the foxes belong to
    if (ok && !State.pet.metOwner) {
      State.pet.metOwner = true;
      Store.save();
      UI.toast(`여우들의 주인 ${josa(OWNER_NAME, '이/가')} 왔어요! 눌러서 인사해 보세요.`, { icon: '👧', kind: 'gold', ms: 5200 });
    }
    // a fox from before she could name it herself: ask once
    if (!State.pet.named) await Pet.askName(State.pet.species, 'first');
    // a kit that finished growing while she was away
    const ready = Pet.home().find((id) => Pet.growth(id) >= 100 && !State.pet.stay[id]);
    if (ready && this.ov === ov) Pet.offerGrowUp(ready);
  },

  close() {
    if (this.ov) UI.close(this.ov);
  },

  /* The button that brings the view back to her fox: there while she is looking about the country. */
  lookButton(away) {
    const el = this.ov && $('[data-fox-back]', this.ov.panel);
    if (el) el.hidden = !away;
  },

  closed() {
    this.ov = null;
    this.tab = null;
    this.photoOn = false;
    this.gig = null;
    Pet.previewing = null;
    Pet.held = null;
    clearTimeout(Pet.thumbTimer);
    clearInterval(this.tripTimer);
    clearTimeout(this.tripDue);
    clearInterval(this.skyTimer);
    clearTimeout(this.skyDue);
    Present.left();
    Halloween.left();
    FoxHost.unmount();
    this.leaveFullscreen();
    Pet.refresh();
  },

  /* Open the shop on a tab, switch tabs, or close it (null). */
  setShop(tab) {
    if (!this.ov) return;
    const turned = tab !== this.tab;
    this.tab = tab;
    if (!tab || (turned && Pet.previewing && Pet.previewing.kind === 'yard')) Pet.previewing = null;
    if (tab !== 'yard') Pet.held = null;
    const root = $('[data-fox-room]', this.ov.panel);
    root.classList.toggle('shop-open', !!tab);
    $('[data-fox-drawer]', root).hidden = !tab;
    this.renderShop(turned);
    this.frame();
    FoxHost.sync();
  },

  /* Tell the 3D view which part of the shop is open and how much of the screen it covers: the foxes (or, on its yard tab, the whole yard) stay in the part that shows. */
  frame() {
    if (!this.ov || !FoxHost.api || !FoxHost.stage) return;
    const drawer = $('[data-fox-drawer]', this.ov.panel);
    if (!this.tab) return FoxHost.api.frame(null);
    // (its size as it is laid out: while it slides in, less of it shows than that)
    const side = drawer.offsetHeight > FoxHost.stage.clientHeight * 0.9; // a panel on the right (wide screens) rather than a sheet at the bottom
    FoxHost.api.frame(this.tab === 'yard' ? 'yard' : 'shop', side ? { right: drawer.offsetWidth } : { bottom: drawer.offsetHeight });
  },

  /* `fromTop` = another tab was opened (otherwise the list stays where she had scrolled it). */
  renderShop(fromTop = false) {
    if (!this.ov || !this.tab) return;
    const panel = this.ov.panel;
    $$('.fd-tabs .seg-btn', panel).forEach((b) => {
      const on = b.dataset.tab === this.tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', String(on));
    });
    const body = $('[data-fox-shop]', panel);
    const y = fromTop ? 0 : body.scrollTop;
    body.innerHTML = Pet.shopHtml(this.tab);
    body.scrollTop = y;
    $('[data-fox-preview]', panel).innerHTML = Pet.previewHtml();
    Pet.fillThumbs(body);
  },

  /* The numbers changed: update what is written over the 3D view. */
  refresh() {
    if (!this.ov) return;
    const panel = this.ov.panel;
    $$('[data-pet-name]', panel).forEach((el) => (el.textContent = State.pet.name));
    $$('[data-pet-bond]', panel).forEach((el) => (el.textContent = `유대감 Lv ${Pet.bondLevel()}`));
    $$('[data-pet-bars]', panel).forEach((el) => (el.innerHTML = Pet.barsHtml()));
    this.tripChip();
    this.sky(); // (the habitat that shows may be another now: one she is trying out in the shop)
    if (this.tab) {
      const pv = Pet.previewing || (Pet.held ? { kind: 'yard', id: Pet.held } : null);
      $$('.shop-item', panel).forEach((el) => el.classList.toggle('trying', !!pv && el.dataset.kind === pv.kind && el.dataset.id === pv.id));
      $('[data-fox-preview]', panel).innerHTML = Pet.previewHtml();
    }
  },

  /* The cover in the player, over the view: what is playing, pause and stop. The foxes are told too — they dance to it. */
  tune(p = CoverHost.player()) {
    this.concert(p);
    if (!this.ov) return;
    const el = $('[data-fox-tune]', this.ov.panel);
    const c = p.singleId ? Music.get(p.singleId) : null;
    el.hidden = !c;
    if (!c) el.dataset.id = '';
    else {
      if (el.dataset.id !== c.id) {
        el.dataset.id = c.id;
        el.innerHTML = `<button class="ft-open" data-action="fox-juke" aria-label="${esc(c.title)} — 다른 커버 고르기">${artImg(c, 'ft-art')}<span class="ft-text"><b>${esc(c.title)}</b><small data-ft-state></small></span></button>
          <button class="ft-btn" data-action="tune-toggle" data-ft-toggle></button>
          <button class="ft-btn" data-action="tune-stop" aria-label="그만 듣기">■</button>
          <i class="ft-bar" aria-hidden="true"><i data-ft-bar></i></i>`;
        CoverHost.hydrateArt(el);
      }
      const toggle = $('[data-ft-toggle]', el);
      toggle.textContent = p.playing ? '❚❚' : '▶';
      toggle.setAttribute('aria-label', p.playing ? '일시정지' : '이어서 듣기');
      const sleepy = Pet.mood() === 'sleepy';
      $('[data-ft-state]', el).textContent = p.error ? '재생할 수 없어요' : p.loading ? '불러오는 중…' : p.playing ? (sleepy ? '여우들이 누워서 듣고 있어요' : '여우들이 듣고 있어요') : '잠깐 멈춤';
      const d = p.duration || c.duration || 0;
      $('[data-ft-bar]', el).style.width = `${d ? clamp((p.time / d) * 100, 0, 100).toFixed(1) : 0}%`;
    }
    const key = c ? `${c.id}|${!!p.playing}` : '';
    if (key !== this.tuneKey) {
      this.tuneKey = key;
      FoxHost.sync();
    }
  },

  /* A cover played to the foxes: one of them says what it thinks; after a good piece of it they are the happier for it; and when it is over they want more. */
  concert(p) {
    const now = performance.now();
    let g = this.gig;
    if (g && g.id !== p.singleId) g = this.gig = null;
    if (!this.ov || !p.singleId) return void (this.gig = null);
    if (!g) g = this.gig = { id: p.singleId, heard: 0, at: now, playing: false, time: 0, duration: 0, said: false, paid: false };
    if (g.playing) g.heard += Math.min(1.5, (now - g.at) / 1000);
    g.at = now;
    const over = g.playing && !p.playing && g.duration > 0 && g.time >= g.duration - 1.2;
    g.playing = !!p.playing;
    if (p.playing) {
      g.time = p.time;
      g.duration = p.duration || g.duration;
    }
    if (!g.said && g.heard > 3.5) {
      g.said = true;
      FoxHost.say(Pet.line(Pet.mood() === 'sleepy' ? 'lullaby' : 'concert'), 2800);
    }
    if (!g.paid && (g.heard >= 20 || over)) {
      g.paid = true;
      Pet.concert();
    }
    if (over) {
      this.gig = null;
      Pet.encore();
    }
  },

  /* A fox is out exploring, or back with a gift: said over the view — how long it will be, or "take it". */
  tripChip() {
    if (!this.ov) return;
    const el = $('[data-fox-trip]', this.ov.panel);
    const phase = Pet.tripPhase();
    const t = Pet.trip();
    el.hidden = phase === 'none';
    el.dataset.phase = phase;
    $('[data-fox-trip-btn]', this.ov.panel).classList.toggle('has-gift', phase === 'back');
    if (!t) return;
    const name = esc(Pet.nameOf(t.fox));
    el.innerHTML =
      phase === 'back'
        ? `<span aria-hidden="true">🎁</span><b>${name}의 선물이 왔어요!</b><small>눌러서 받기</small>`
        : `<span aria-hidden="true">🧭</span><b>${name} 탐험 중</b><small>${Pet.tripLeft()} 뒤 도착</small>`;
  },

  /* While the foxes' world is open: the time on that chip counts down, and the fox comes in the moment it is back. */
  tripWatch() {
    clearInterval(this.tripTimer);
    clearTimeout(this.tripDue);
    if (!this.ov) return;
    this.tripTimer = setInterval(() => Pet.tripTick(), 20000);
    const t = Pet.trip();
    if (t && Pet.tripPhase() === 'away') this.tripDue = setTimeout(() => Pet.tripTick(), Math.min(t.back - Date.now() + 300, 2 ** 31 - 1));
  },

  /*
     The season and the weather, written over the view — and passed on to the 3D side, which draws it. When the sky
     changes while she is watching, she is told (the foxes have their own say: js/fox/weatherlife.js).
  */
  sky() {
    if (!this.ov) return;
    const scene = FoxHost.scene();
    const sky = Weather.now(scene);
    const el = $('[data-fox-sky]', this.ov.panel);
    el.innerHTML = Weather.chipHtml(scene);
    el.dataset.kind = sky.kind;
    if (FoxHost.api && FoxHost.stage) FoxHost.api.weather(sky);
    const was = this.skyWas;
    this.skyWas = { scene, kind: sky.kind };
    if (scene === State.pet.scene) Pet.skySeen(sky);
    if (!was || was.scene !== scene || was.kind === sky.kind || UI.top() !== this.ov) return;
    const news = Weather.news(was.kind, sky.kind, sky.wet);
    if (news) UI.toast(news.text, { icon: news.icon, ms: 3400 });
  },

  /* While the foxes' world is open: the puddles dry and the rain eases off little by little, and the sky turns on the minute. */
  skyWatch() {
    clearInterval(this.skyTimer);
    clearTimeout(this.skyDue);
    if (!this.ov) return;
    this.skyTimer = setInterval(() => this.sky(), 8000);
    const turn = () => {
      this.sky();
      this.skyDue = setTimeout(turn, Weather.untilNext() + 300);
    };
    this.skyDue = setTimeout(turn, Weather.untilNext() + 300);
  },

  /* The button for his letter: "have it fetched" while it is in the mailbox, "take it" once a fox has brought it. */
  mailButton() {
    if (!this.ov) return;
    const el = $('[data-fox-mail]', this.ov.panel);
    const phase = Pet.mailPhase();
    el.hidden = phase === 'none';
    el.dataset.phase = phase;
    el.disabled = phase === 'fetching';
    el.innerHTML = {
      box: '<span aria-hidden="true">📮</span><b>편지가 왔어요!</b><small>눌러서 가져오게 하기</small>',
      fetching: '<span aria-hidden="true">🦊</span><b>편지 가지러 가는 중…</b>',
      fox: '<span aria-hidden="true">💌</span><b>편지 받기</b>',
    }[phase] || '';
  },

  /* Lorelei has something to say (js/present.js): the buttons make way for her and her window, and come back afterwards. */
  stageMode(on) {
    if (!this.ov) return;
    $('[data-fox-room]', this.ov.panel).classList.toggle('talk-on', !!on);
    if (on && FoxHost.api) FoxHost.api.hush();
  },

  /* She is speaking of something on the screen (js/meet.js): it shows, lit, though the other buttons are away.
     'actions' the buttons along the bottom · 'shop' · 'camera' · 'trip' the compass · null: nothing any more */
  point(what) {
    if (!this.ov) return;
    const root = $('[data-fox-room]', this.ov.panel);
    if (what) root.dataset.point = what;
    else delete root.dataset.point;
  },

  /* "Lorelei has something for you" (or, on Halloween, a game to play): there for as long as she has — a tap, and she gives it. */
  presentChip() {
    if (!this.ov) return;
    const el = $('[data-fox-present]', this.ov.panel);
    const gift = Present.waiting() && !Present.playing;
    const game = !gift && !Present.playing && Halloween.waiting() && !Halloween.playing;
    el.hidden = !gift && !game;
    if (gift) el.innerHTML = `<span aria-hidden="true">🎁</span><b>${esc(josa(OWNER_NAME, '이/가'))} 줄 게 있대요!</b><small>눌러서 받기</small>`;
    else if (game) el.innerHTML = `<span aria-hidden="true">🎃</span><b>${esc(josa(OWNER_NAME, '이/가'))} 부르고 있어요!</b><small>트릭 오어 트릿</small>`;
  },

  /* Start or stop taking pictures: the shop and the buttons make way, the family poses. */
  setPhoto(on) {
    if (!this.ov || on === this.photoOn) return;
    if (on && !Pet.anyoneHome('사진을 찍어 주세요')) return;
    if (on && (!FoxHost.api || FoxHost.failed)) {
      UI.toast('이 기기에서는 3D 화면을 쓸 수 없어서 사진을 찍을 수 없어요.', { icon: '📷', ms: 3600 });
      return;
    }
    if (on && this.tab) this.setShop(null);
    this.photoOn = on;
    const root = $('[data-fox-room]', this.ov.panel);
    root.classList.toggle('photo-on', on);
    $('[data-fox-photo]', root).hidden = !on;
    if (FoxHost.api) FoxHost.api.photo(on);
    if (on) {
      FoxHost.api.hush();
      this.setPose(this.pose);
      Photos.showLast();
    }
  },

  setPose(pose) {
    this.pose = pose;
    if (!this.ov) return;
    $$('.fp-pose', this.ov.panel).forEach((b) => {
      const on = b.dataset.pose === pose;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    if (FoxHost.api) FoxHost.api.pose(pose);
  },
};

/* ------------------------------------------------------------------
   Juke — "play them one of my covers": the list she picks from.
   The cover plays on the site's own player (js/cover/player.js);
   the foxes' side of it is in js/fox/dance.js.
   ------------------------------------------------------------------ */
const Juke = {
  ov: null,

  rowHtml(c, p) {
    const on = p.singleId === c.id;
    return `<button class="juke-item ${on ? 'on' : ''}" data-juke="${esc(c.id)}" data-sfx="none">
      ${artImg(c, 'juke-art')}
      <span class="juke-text"><b>${esc(c.title)}</b><small>${esc(c.coverArtist || State.user.nickname)} · ${fmtTime(c.duration)}${on ? (p.playing ? ' · 듣는 중' : ' · 잠깐 멈춤') : ''}</small></span>
      <span class="juke-go" aria-hidden="true">${on && p.playing ? '♪' : '▶'}</span></button>`;
  },

  open() {
    if (this.ov || !Pet.anyoneHome('노래를 들려주세요')) return;
    const list = Music.released();
    const p = CoverHost.player();
    const ov = (this.ov = UI.open(
      `<div class="juke">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 class="juke-title">💿 여우들에게 들려주기</h2>
        ${
          list.length
            ? `<p class="hint">커버를 고르면 여우들이 모여서 듣고, 노래 박자에 맞춰 춤춰요.</p>
               <div class="juke-list">${list.map((c) => this.rowHtml(c, p)).join('')}</div>`
            : emptyState('🎤', '아직 들려줄 커버가 없어요', '스튜디오에서 노래를 녹음해 저장하면 여우들에게 들려줄 수 있어요.', '<button class="btn primary" data-juke-sing>🎤 노래 부르러 가기</button>')
        }
        <div class="dialog-actions">
          ${list.length > 1 ? '<button class="btn soft" data-juke-all>🔁 모두 이어서</button>' : ''}
          ${p.singleId ? '<button class="btn soft" data-juke-stop>■ 그만 듣기</button>' : ''}
          <button class="btn ghost" data-ov-cancel>닫기</button>
        </div>
      </div>`,
      { cls: 'is-juke', label: '여우들에게 들려줄 커버 고르기', onClose: () => (this.ov = null) }
    ));
    ov.panel.addEventListener('click', (e) => {
      const on = (sel) => e.target.closest(sel);
      const row = on('[data-juke]');
      if (row) {
        Sfx.play('pop');
        CoverHost.start(row.dataset.juke);
      } else if (on('[data-juke-all]')) CoverHost.start(list[0].id, list.map((c) => c.id));
      else if (on('[data-juke-stop]')) CoverHost.stopAll();
      else if (on('[data-juke-sing]')) return void UI.close(ov).then(() => Actions.sing());
      else if (!on('[data-ov-cancel]')) return;
      UI.close(ov);
    });
  },
};

/* ------------------------------------------------------------------
   Trip — "send a fox exploring": who goes and where to, how the one
   that is away is getting on, and the gift box with everything the
   foxes have brought her. (The fox's side: js/fox/trips.js.)
   ------------------------------------------------------------------ */
const Trip = {
  ov: null,
  who: null, //   the fox she has picked to go
  place: null, // …and where to

  /* How many of the gifts she has: [found, of]. */
  count(ids = Object.keys(TRIP_FINDS)) {
    return [ids.filter((id) => State.pet.finds[id]).length, ids.length];
  },

  html() {
    const p = State.pet;
    const [found, total] = this.count();
    const box = `<button class="btn soft" data-trip-box>🎁 선물 상자 <small>${found}/${total}</small></button>`;
    if (Pet.tripPhase() === 'away') {
      const t = Pet.trip();
      const place = Pet.tripPlace(t.place);
      const name = Pet.nameOf(t.fox);
      return `<div class="juke trip">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 class="juke-title">🧭 ${esc(josa(name, '은/는'))} 탐험 중</h2>
        <div class="trip-now">
          <span class="trip-pic is-big" aria-hidden="true">${place.emoji}</span>
          <p><b>${esc(place.name)}</b>에 갔어요.<br>${esc(Pet.tripLeft())} 뒤에 선물을 물고 돌아와요.</p>
        </div>
        ${meterHtml(clamp(((Date.now() - t.at) / Math.max(1, t.back - t.at)) * 100, 0, 100), 100, '탐험')}
        <div class="dialog-actions">
          ${box}
          <button class="btn soft" data-trip-back>지금 불러오기</button>
        </div>
      </div>`;
    }
    const home = Pet.home();
    if (!home.includes(this.who)) this.who = home.includes(p.species) ? p.species : home[0];
    if (!Pet.tripPlace(this.place)) this.place = TRIP_PLACES[0].id;
    const who =
      home.length > 1
        ? `<div class="fox-who" role="radiogroup" aria-label="누가 갈까요?">${home
            .map((id) => {
              const on = id === this.who;
              return `<button class="fox-chip ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-trip-who="${id}" data-sfx="none"><span class="fox-avatar is-chip" data-fox-thumb="fox:${id}" aria-hidden="true">${Pet.foxDef(id).emoji}</span><span>${esc(Pet.nameOf(id))}</span></button>`;
            })
            .join('')}</div>`
        : '';
    const places = TRIP_PLACES.map((pl) => {
      const on = pl.id === this.place;
      const [got, of] = this.count(pl.finds);
      return `<button class="juke-item ${on ? 'on' : ''}" role="radio" aria-checked="${on}" data-trip-place="${pl.id}" data-sfx="none">
        <span class="trip-pic" aria-hidden="true">${pl.emoji}</span>
        <span class="juke-text"><b>${esc(pl.name)}</b><small>선물 ${of}가지 중 ${got}가지 찾음</small></span>
        <span class="trip-time">${tripTime(pl.hours)}</span></button>`;
    }).join('');
    return `<div class="juke trip">
      <div class="sheet-handle" aria-hidden="true"></div>
      <h2 class="juke-title">🧭 탐험 보내기</h2>
      <p class="hint">여우를 보내 두면 시간이 지난 뒤 작은 선물을 물고 돌아와요. 멀리 갈수록 귀한 선물을 찾아와요.</p>
      ${who}
      <div class="juke-list" role="radiogroup" aria-label="어디로 보낼까요?">${places}</div>
      <div class="dialog-actions">
        ${box}
        <button class="btn primary" data-trip-go>${esc(Pet.nameOf(this.who))} 보내기</button>
      </div>
    </div>`;
  },

  render() {
    if (!this.ov) return;
    this.ov.panel.innerHTML = this.html();
    Pet.fillThumbs(this.ov.panel);
  },

  /* The compass button and the chip: send one off, look after the one that is away — or take what it has brought. */
  open() {
    if (this.ov) return;
    if (Pet.tripPhase() === 'back') return void Pet.takeGift();
    const ov = (this.ov = UI.open(this.html(), { cls: 'is-juke', label: '탐험 보내기', onClose: () => (this.ov = null) }));
    Pet.fillThumbs(ov.panel);
    ov.panel.addEventListener('click', (e) => {
      const on = (sel) => e.target.closest(sel);
      const who = on('[data-trip-who]');
      const place = on('[data-trip-place]');
      if (who || place) {
        if (who) this.who = who.dataset.tripWho;
        else this.place = place.dataset.tripPlace;
        Sfx.play('tap');
        this.render();
      } else if (on('[data-trip-box]')) this.box();
      else if (on('[data-trip-go]')) this.go();
      else if (on('[data-trip-back]')) UI.close(ov).then(() => Pet.callBack());
    });
  },

  async go() {
    const id = this.who;
    const place = this.place;
    if (Pet.home().length < 2) {
      // the yard will be empty: does she mean it?
      const name = Pet.nameOf(id);
      const ok = await UI.confirm({ icon: '🧭', title: `${josa(name, '을/를')} 보낼까요?`, text: `${josa(name, '이/가')} 돌아올 때까지 마당이 비어 있어요.`, ok: '보내기', cancel: '취소' });
      if (!ok) return;
    }
    if (this.ov) await UI.close(this.ov);
    Pet.sendOff(id, place);
  },

  /* The gift box: everything there is to find, place by place — what she has (and how many), and what is still out there. */
  box() {
    const p = State.pet;
    const [found, total] = this.count();
    const cell = (id) => {
      const f = TRIP_FINDS[id];
      const n = p.finds[id] || 0;
      return n
        ? `<div class="find ${f.rare ? 'is-rare' : ''}"><span class="find-pic" aria-hidden="true">${f.emoji}</span><b>${esc(f.name)}</b><small>${f.rare ? '🌟 ' : ''}×${n}</small></div>`
        : `<div class="find is-unknown"><span class="find-pic" aria-hidden="true">?</span><b>???</b><small>${f.rare ? '🌟 희귀' : '아직 못 찾음'}</small></div>`;
    };
    const ov = UI.open(
      `<div class="juke trip-box">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 class="juke-title">🎁 선물 상자 <small>${found} / ${total}</small></h2>
        <p class="hint">${found ? '여우들이 탐험에서 물어다 준 선물이에요.' : '여우를 탐험 보내면 선물을 물고 돌아와요. 하나씩 모아 보세요!'}</p>
        ${TRIP_PLACES.map((pl) => `<h3 class="shop-head">${pl.emoji} ${esc(pl.name)} <small>${tripTime(pl.hours)}</small></h3><div class="find-grid">${pl.finds.map(cell).join('')}</div>`).join('')}
        <div class="dialog-actions one"><button class="btn soft" data-ov-cancel>닫기</button></div>
      </div>`,
      { cls: 'is-juke', label: '선물 상자' }
    );
    $('[data-ov-cancel]', ov.panel).addEventListener('click', () => UI.close(ov));
  },
};

document.addEventListener('fullscreenchange', () => {
  if (FoxRoom.ov) FoxRoom.ov.panel.classList.toggle('is-fullscreen', FoxRoom.isFullscreen());
});
window.addEventListener('resize', () => FoxRoom.frame());

Object.assign(Actions, {
  'fox-open': () => FoxRoom.open(),
  'fox-close': () => FoxRoom.close(),
  'fox-full': () => (FoxRoom.isFullscreen() ? FoxRoom.leaveFullscreen() : FoxRoom.enterFullscreen()),
  'fox-shop': (el) => FoxRoom.setShop(el.dataset.tab),
  'fox-shop-close': () => FoxRoom.setShop(null),
  'fox-rename': (el) => Pet.askName(el.dataset.id || State.pet.species),
  'fox-select': (el) => Pet.select(el.dataset.id),
  'fox-letter': () => Pet.letterTap(),
  'fox-juke': () => Juke.open(),
  'fox-trip': () => Trip.open(),
  'fox-back': () => FoxHost.api && FoxHost.api.lookBack(),
  'fox-sky': () => UI.toast(Weather.describe(FoxHost.scene()), { icon: SKIES[Weather.now(FoxHost.scene()).kind].emoji, ms: 4200 }),
  'tune-toggle': () => {
    const p = CoverHost.player();
    if (p.singleId) CoverHost.play(p.singleId);
  },
  'tune-stop': () => CoverHost.stopAll(),
  'yard-turn': () => Pet.turnHeld(),
  'yard-store': () => Pet.storeHeld(),
  'yard-done': () => Pet.hold(null),
  'fox-photo': () => FoxRoom.setPhoto(true),
  'photo-exit': () => FoxRoom.setPhoto(false),
  'photo-pose': (el) => FoxRoom.setPose(el.dataset.pose),
  'pet-pet': () => Pet.pet(),
  'pet-feed': (el) => Pet.feed(el),
  'pet-play': (el) => Pet.play(el),
  'shop-tap': (el) => Pet.shopTap(el.dataset.kind, el.dataset.id),
  'shop-buy': () => Pet.buyPreview(),
  'shop-cancel': () => Pet.cancelPreview(),
});
