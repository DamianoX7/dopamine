'use strict';
/* ==================================================================
   💭 The fox's dream — what one of the foxes dreamt last night.

   Every morning (from five o'clock, when the diary's day turns:
   js/diary.js) one of the foxes has dreamt about the day before —
   what she sang, played, gave it to eat, the moon they looked up
   at — all mixed up, the way a dream mixes things: the song she
   covered became a balloon, the treats came down like rain. On Home
   a card says so (and the fox, once); she hears it in the fox's own
   words, a few lines, with a picture drawn then and there: the fox
   asleep on a cloud, and in the bubble over it, the fox again, up to
   its tricks in the dream (its own 3D self, cut out: js/fox/world.js
   cutout) — and in the corner, last night's moon as it really was
   (js/moon.js). The dreams are kept: 나 → 꿈 일기.

   A dream is worked out from the diary's record of the day
   (State.diary.log) with dice thrown by the date, so her phone and
   her computer dream alike. Once she has heard it, what it was is
   kept (State.dreams) — the record of the day is not kept for ever.
   ================================================================== */

const DREAMS_KEPT = 120; // the dream diary keeps this many (the oldest go)
const DREAM_SIZE = 1080; // the picture, px square
// the night round the bubble, and the soft light in it
const DREAM_NIGHT = ['#120f33', '#2e2263', '#5b3f8c'];
const TAU_2D = Math.PI * 2;

/*
   What a fox can dream of. `weight(d, x)`: how likely, from the record of the day (`d`, State.diary.log[night]) and
   what else is known of it (`x`, see Dream.context) — 0: not tonight. `main`: the dream itself, a few versions of it
   ({ title, text, big? }); `twist`: what it brings into a dream about something else ("그러다 …"); `art`: the picture —
   the big thing in the middle of it, the little ones about it, the dream's sky (top, bottom), how the fox is in it.
   {nick} = what she is called, {bf} = him, {fox} = the fox; {song}, {gift} come in quotes; {game}, {moon}, {day},
   {dayEmoji} as the day had them. {name:이/가} — with the particle that fits.
*/
const DREAM_MOTIFS = [
  {
    id: 'halloween',
    weight: (d, x) => (x.md === '10-31' ? 14 : 0),
    main: [{ title: '호박 마차', text: '호박 마차를 타고 밤하늘을 날았어! 박쥐들이 길을 안내해 주고, 별들이 사탕을 뿌려 줬지 🎃' }],
    twist: ['그러다 호박 등불들이 줄지어 나를 따라오기 시작했어!'],
    art: { big: '🎃', bits: ['🦇', '🍬', '👻', '⭐'], sky: ['#2c1340', '#f2994a'], pose: 'hop' },
  },
  {
    id: 'christmas',
    weight: (d, x) => (x.md === '12-24' || x.md === '12-25' ? 14 : 0),
    main: [{ title: '산타 썰매', text: '산타 할아버지 썰매에 올라타서 같이 선물을 나눠 줬어. 루돌프가 내 꼬리가 제일 멋지대 🎄' }],
    twist: ['그러다 하늘에서 선물 상자가 펑펑 떨어졌어!'],
    art: { big: '🎄', bits: ['🎁', '⭐', '❄️', '🔔'], sky: ['#0f3443', '#34e89e'], pose: 'beg' },
  },
  {
    id: 'party',
    weight: (d, x) => (x.day ? 12 : 0),
    main: [{ title: '꿈속 파티', text: '{day:이라/라}서 꿈에서도 파티가 열렸어! 하늘이 온통 {dayEmoji}로 반짝반짝했지' }],
    twist: ['그러다 하늘에서 풍선이 둥실둥실 내려왔어!'],
    art: { big: '🎂', bits: ['🎈', '🎉', '✨', '🎈'], sky: ['#ee9ca7', '#ffdde1'], pose: 'beg' },
  },
  {
    id: 'moonwish',
    weight: (d) => (d.moon ? 10 : 0),
    main: [{ title: '달나라 떡방아', text: '보름달까지 사다리를 놓고 올라갔더니 옥토끼가 떡방아를 찧고 있었어. 같이 찧고 떡도 얻어먹었지 🌕' }],
    twist: ['그때 보름달에서 옥토끼가 손을 흔들어 줬어.'],
    art: { big: '🌕', bits: ['🐰', '🍡', '⭐', '✨'], sky: ['#141e46', '#5b5fa8'], pose: 'hop' },
  },
  {
    id: 'song',
    weight: (d) => ((d.covers || []).length ? 8 : 0),
    main: [
      { title: '음표 징검다리', text: '{nick:이/가} 부른 {song}의 음표들이 하늘에 징검다리처럼 놓여 있었어. 하나씩 밟을 때마다 노래가 흘러나왔지 🎵' },
      { title: '노래 풍선', text: '{song:이/가} 커다란 풍선이 돼서 둥실 떠올랐어. 나는 그 풍선 끈을 꼭 물고 같이 하늘을 날았지 🎈', big: '🎈' },
    ],
    twist: ['그러다 어디선가 {song:이/가} 들려와서 다 같이 따라 불렀어.'],
    art: { big: '🎤', bits: ['🎵', '🎶', '🎼', '✨'], sky: ['#5b4fd0', '#f4a3c4'], pose: 'hop' },
  },
  {
    id: 'letter',
    weight: (d) => (d.letters || d.messages ? 6 : 0),
    main: [{ title: '날아다니는 편지', text: '하늘에서 편지들이 새처럼 날아다녔어. 하나를 콕 물어 보니 {bf:이/가} 쓴 편지였어. 내용은… 비밀이야 🤫' }],
    twist: ['그때 편지 한 통이 나비처럼 날아와서 내 코끝에 살포시 앉았어.'],
    art: { big: '💌', bits: ['💌', '✉️', '💗', '🕊️'], sky: ['#6a4c93', '#ffb5c5'], pose: 'hop' },
  },
  {
    id: 'radio',
    weight: (d) => (d.radio ? 5 : 0),
    main: [{ title: '여우 라디오 DJ', text: '꿈에서 내가 라디오 DJ였어! ‘다음 곡은요~’ 하고 말하는데 목소리가 엄청 멋있었지 📻' }],
    twist: ['그러다 라디오에서 내 이름이 불려서 깜짝 놀랐어!'],
    art: { big: '📻', bits: ['🎵', '🎙️', '✨', '🎶'], sky: ['#2f4f8f', '#f0b27a'], pose: 'beg' },
  },
  {
    id: 'lp',
    weight: (d) => ((d.lps || []).length || d.lp ? 5 : 0),
    main: [{ title: '빙글빙글 LP', text: '집채만 한 LP판이 회전목마처럼 빙글빙글 돌았어. 나는 바늘을 피해서 홈 사이를 신나게 달렸지 💿' }],
    twist: ['그런데 발밑이 LP판처럼 빙글빙글 돌기 시작했어!'],
    art: { big: '💿', bits: ['🎶', '💫', '🎵'], sky: ['#40306b', '#e48fb5'], pose: 'hop' },
  },
  {
    id: 'dance',
    weight: (d) => (d.concerts ? 5 : 0),
    main: [{ title: '여우 무도회', text: '여우들이 전부 반짝이 옷을 입고 무도회를 열었어. {nick} 노래가 나오자 다 같이 빙글빙글 춤을 췄지 🪩' }],
    twist: ['그러자 여우들이 전부 모여서 춤을 추기 시작했어!'],
    art: { big: '🪩', bits: ['🎶', '✨', '🎵', '💫'], sky: ['#2d1b69', '#ff7eb3'], pose: 'beg' },
  },
  {
    id: 'gift',
    weight: (d) => ((d.gifts || []).length ? 5 : 0),
    main: [{ title: '커다란 보물', text: '탐험에서 물어 온 {gift:이/가} 집채만큼 커져 있었어! 그 위에 올라가서 저 멀리까지 구경했지 🧭' }],
    twist: ['그러다 {gift:이/가} 나를 보고 찡긋 윙크를 했어!'],
    art: { big: '🎁', bits: ['🧭', '✨', '🗺️'], sky: ['#1d4e89', '#7ad3c8'], pose: 'beg' },
  },
  {
    id: 'sing',
    weight: (d) => (d.sang && !(d.covers || []).length ? 4 : 0),
    main: [
      { title: '구름 위 노래방', text: '구름 위에 노래방이 있었는데, {nick:이/가} 마이크를 잡자마자 별들이 손뼉을 쳐 줬어 👏' },
      { title: '맨 앞자리', text: '{nick} 노랫소리를 따라가 보니 구름으로 만든 무대가 있었어. 나는 맨 앞자리에서 꼬리를 흔들었지!' },
    ],
    twist: ['그때 {nick} 노랫소리가 들려와서 다 같이 귀를 쫑긋 세웠어.'],
    art: { big: '🎤', bits: ['⭐', '👏', '🎵', '✨'], sky: ['#3d3a8f', '#c98be0'], pose: 'howl' },
  },
  {
    id: 'game',
    weight: (d) => (d.games ? 4 : 0),
    main: [], // (by the game she played most: GAME_DREAMS)
    twist: ['그러다 {game} 속으로 쏙 빨려 들어갔어!'],
    art: { big: '🎮', bits: ['🎮', '⭐', '✨'], sky: ['#22577a', '#80ed99'], pose: 'hop' },
  },
  {
    id: 'feast',
    weight: (d) => (d.feeds ? 4 : 0),
    main: [{ title: '간식 비', text: '하늘에서 간식이 비처럼 쏟아졌어! 입을 크게 벌리고 하나도 안 빼고 다 받아먹었지 🍖' }],
    twist: ['그런데 갑자기 하늘에서 간식이 비처럼 쏟아졌어!'],
    art: { big: '🍖', bits: ['🍖', '🍪', '🍗', '🥕', '🍓'], sky: ['#f08a5d', '#ffd56b'], pose: 'hop' },
  },
  {
    id: 'ball',
    weight: (d) => (d.plays ? 4 : 0),
    main: [{ title: '달이 된 공', text: '공을 쫓아 계속 달렸는데, 공이 점점 커지더니 둥실 떠올라서 달님이 돼 버렸어 🎾' }],
    twist: ['그러다 공이 통통 튀어 오더니 나를 태우고 날아올랐어!'],
    art: { big: '🎾', bits: ['🌙', '⭐', '💨'], sky: ['#355c7d', '#c5e1a5'], pose: 'hop' },
  },
  {
    id: 'gazed',
    weight: (d) => (d.gazed && !d.moon ? 4 : 0),
    main: [{ title: '달님과 숨바꼭질', text: '{moon:이/가} 구름 뒤에 쏙 숨길래 숨바꼭질을 했어. 내가 찾아냈더니 달님이 부끄러워서 발그레해졌어 🌙' }],
    twist: ['고개를 들어 보니 {moon:이/가} 나한테 윙크를 했어.'],
    art: { big: '🌙', bits: ['⭐', '☁️', '✨'], sky: ['#0f2027', '#4b6cb7'], pose: 'sit' },
  },
  {
    id: 'pat',
    weight: (d) => (d.pets ? 3 : 0),
    main: [{ title: '폭신한 손', text: '{nick:이/가} 쓰다듬어 주는 꿈이었는데, 손이 구름처럼 폭신폭신했어. 꼬리가 저절로 살랑살랑 흔들렸지 💗' }],
    twist: ['그때 따뜻한 손이 내 머리를 살살 쓰다듬어 줬어.'],
    art: { big: '💗', bits: ['💗', '💕', '☁️', '✨'], sky: ['#c06c84', '#f8b195'], pose: 'sit' },
  },
  {
    id: 'photo',
    weight: (d) => (d.photos || d.fourcut ? 3 : 0),
    main: [{ title: '사진 속 나라', text: '사진첩을 열었더니 사진 속 내가 튀어나와서 ‘같이 놀자!’ 했어. 나랑 나랑 술래잡기를 했지 📷' }],
    twist: ['그러다 누가 ‘찰칵!’ 하고 사진을 찍었는데, 그게 {nick:이었어/였어}!'],
    art: { big: '📷', bits: ['🖼️', '✨', '📸'], sky: ['#3a6073', '#f7c59f'], pose: 'beg' },
  },
  {
    id: 'knit',
    weight: (d) => (d.knit ? 3 : 0),
    main: [{ title: '털실 뭉치 동산', text: '집채만 한 털실 뭉치 위에서 데굴데굴 굴렀어! 풀려 나온 실이 무지개처럼 저 멀리까지 이어졌지 🧶' }],
    twist: ['그러다 털실이 술술 풀리더니 내 몸을 감싸서 포근한 스웨터가 됐어!'],
    art: { big: '🧶', bits: ['🧵', '💗', '✨'], sky: ['#b06ab3', '#f7bb97'], pose: 'hop' },
  },
  {
    id: 'mallang',
    weight: (d) => (d.mallang ? 3 : 0),
    main: [{ title: '말랑이 산', text: '말랑말랑한 산이 있어서 퐁퐁 뛰어올랐더니 구름까지 닿았어! 내려올 때마다 ‘말랑~’ 소리가 났지 🍡' }],
    twist: ['그런데 땅이 갑자기 말랑말랑해져서 퐁퐁 튀어 올랐어!'],
    art: { big: '🍡', bits: ['🫧', '💗', '☁️'], sky: ['#ff9a8b', '#ffd3a5'], pose: 'hop' },
  },
  {
    id: 'trophy',
    weight: (d, x) => (x.trophy ? 3 : 0),
    main: [{ title: '트로피 수영장', text: '커다란 트로피 안에 들어가서 수영을 했어! 물이 금빛으로 반짝반짝 빛났지 🏆' }],
    twist: ['그러다 하늘에서 금메달이 하나 떨어졌는데, 내 목에 딱 걸렸어!'],
    art: { big: '🏆', bits: ['✨', '🥇', '🌟'], sky: ['#8e6e1f', '#f9d976'], pose: 'beg' },
  },
  {
    id: 'snow',
    weight: (d) => (d.snow ? 3 : 0),
    main: [{ title: '솜사탕 눈', text: '눈송이가 전부 솜사탕이었어! 입을 크게 벌리고 마당을 뛰어다녔지 ❄️' }],
    twist: ['그런데 눈송이가 전부 솜사탕으로 바뀌었어!'],
    art: { big: '⛄', bits: ['❄️', '🍥', '✨'], sky: ['#83a4d4', '#e0eafc'], pose: 'hop' },
  },
  {
    id: 'rain',
    weight: (d) => (d.rain && !d.snow ? 2 : 0),
    main: [{ title: '사탕 비', text: '빗방울이 전부 알록달록한 사탕이었어! 혀를 쏙 내밀고 톡톡 받아먹었지 🍬' }],
    twist: ['그런데 빗방울이 전부 사탕으로 바뀌었어!'],
    art: { big: '☔', bits: ['🍬', '🍭', '💧'], sky: ['#4b79a1', '#a8c0ff'], pose: 'hop' },
  },
  {
    id: 'level',
    weight: (d) => ((d.levels || []).length ? 2 : 0),
    main: [{ title: '반짝이는 별', text: '내가 하늘의 별이 돼서 반짝반짝 빛났어. {nick:이/가} 나를 보고 손을 흔들어 줬지 ⭐' }],
    twist: ['그러다 내 꼬리 끝에서 별빛이 반짝반짝 났어!'],
    art: { big: '⭐', bits: ['✨', '🌟', '💫'], sky: ['#232526', '#7f53ac'], pose: 'beg' },
  },
  {
    id: 'diary',
    weight: (d, x) => (x.page ? 2 : 0),
    main: [{ title: '일기장 속으로', text: '{nick} 일기장 속으로 쏙 들어갔어. 스티커들이 살아 움직여서 같이 놀았지 📔' }],
    twist: ['그러다 일기장 스티커들이 살아 움직이기 시작했어!'],
    art: { big: '📔', bits: ['⭐', '💗', '🌸'], sky: ['#c79081', '#dfa579'], pose: 'hop' },
  },
  {
    id: 'visit',
    weight: (d) => (d.visits ? 1 : 0),
    main: [{ title: '끝없는 마당', text: '{nick:이/가} 놀러 와서 같이 마당을 뛰어다녔어. 꿈속 마당은 끝도 없이 넓었지 🦊' }],
    twist: ['그때 저 멀리서 {nick:이/가} 나를 불렀어!'],
    art: { big: '🏡', bits: ['🌼', '🦋', '✨'], sky: ['#56ab2f', '#a8e063'], pose: 'hop' },
  },
];

/* …a dream of the day she did not come at all. */
const DREAM_MISSED = {
  id: 'missed',
  main: [
    { title: '꿈속 숲', text: '{nick:을/를} 찾아서 꿈속 숲을 헤맸어. 저 멀리서 {nick} 목소리가 들려서 막 달려갔지!' },
    { title: '기다리는 꿈', text: '마당에서 {nick:을/를} 기다리다 깜빡 잠들었는데, 꿈에서도 계속 기다렸어. 오늘은 와 줄 거지? 🥺' },
  ],
  art: { big: '🌲', bits: ['🌙', '🍃', '✨'], sky: ['#134e5e', '#71b280'], pose: 'sit' },
};

/* The game she played most, as a dream (by its id: js/views/arcade.js). */
const GAME_DREAMS = {
  memory: { title: '카드 나라', text: '카드 나라에 갔는데 카드 그림이 전부 내 얼굴이었어! {nick:이랑/랑} 짝을 맞추면서 깔깔 웃었지 🃏', big: '🃏', bits: ['🃏', '⭐', '✨'] },
  reaction: { title: '번개 달리기', text: '번개처럼 빠른 달리기 시합을 했는데, 분홍 깃발이 올라가자마자 내가 1등으로 뛰어나갔어 ⚡', big: '⚡', bits: ['⚡', '🏁', '💨'] },
  colors: { title: '무지개 물감', text: '물감 비가 내려서 내 털이 무지개색이 됐어! {nick:이/가} 보고 배꼽 빠지게 웃었지 🎨', big: '🎨', bits: ['🌈', '🎨', '💧'] },
  numbers: { title: '숫자 별', text: '하늘의 별들이 숫자로 바뀌더니 다 외워 보래. 다 외웠더니 별 하나가 내 꼬리에 쏙 붙었어 🔢', big: '🔢', bits: ['⭐', '✨', '🔢'] },
  lucky: { title: '네잎클로버 들판', text: '네잎클로버가 가득한 들판에서 데굴데굴 굴렀어. 하나 찾을 때마다 좋은 일이 퐁퐁 생겼지 🍀', big: '🍀', bits: ['🍀', '✨', '🌼'] },
  other: { title: '오락실 꿈', text: '오락실 게임 속에 쏙 들어가서 {nick:이랑/랑} 같이 놀았어. 이번엔 내가 이겼다! 🎮', big: '🎮', bits: ['🎮', '⭐', '✨'] },
};

/* When nothing else comes into the dream: something out of nowhere — and what it puts in the picture. */
const DREAM_TWISTS = [
  { text: '그러다 무지개 미끄럼틀이 나타나서 쭉 타고 내려왔어!', bits: ['🌈'] },
  { text: '그런데 갑자기 구름이 폭신한 솜이불로 바뀌었어.', bits: ['☁️'] },
  { text: '그러다 커다란 고래가 하늘을 헤엄쳐 와서 나를 등에 태워 줬어!', bits: ['🐋'] },
  { text: '그러다 나비 떼가 날아와서 나를 둥실 들어 올렸어!', bits: ['🦋'] },
];
const DREAM_OPENERS = ['어젯밤에 엄청 신기한 꿈을 꿨어!', '있잖아, 어젯밤 꿈 얘기 들어 볼래?', '어젯밤 꿈에서 말이야…', '꿈을 꿨는데 너무 웃겨!'];
const DREAM_ENDINGS = {
  any: ['눈을 떠 보니 내 꼬리를 꼭 끌어안고 자고 있었어 🦊💤', '깨고 나서도 기분이 몽글몽글해!', '오늘 밤에도 이어서 꾸고 싶다~ 🌙', '깨 보니 침이 살짝… 이건 비밀이야! 🤫', '꿈이었지만 진짜 같았어. 신기하지?'],
  glad: ['꿈에서도 {nick:이/가} 웃고 있어서 나까지 엄청 행복했어 💗'], //        (her page that day: a good day)
  low: ['꿈에서 {nick:을/를} 꼭 안아 줬어. 오늘은 분명 더 좋은 하루일 거야 💗'], // (…a hard one)
};
const GLAD_MOODS = ['😊', '🥰', '😆'];
const LOW_MOODS = ['😢', '😤', '😴'];
// how the fox is in its dream (js/fox/animator.js POSES) — and its face
const DREAM_POSES = { hop: { eyes: 'happy', mouth: 0.4 }, beg: { eyes: 'happy', mouth: 0.25 }, howl: { eyes: 'happy', mouth: 0.7 }, sit: { eyes: 'happy' } };

const Dream = {
  ov: null, //          the dream that is open (its overlay)
  pics: new Map(), //   night → Promise of its picture (a canvas), drawn once a visit
  owed: false, //       she has heard a new one: what it brings her comes when its screen is closed (see settle)
  listing: false, //    …or once the dream diary, opened from it, is closed

  /* The night the fox has dreamt of by now: the diary's day before today (it turns at five in the morning). */
  night() {
    return addDays(Diary.today(), -1);
  },

  /* Is there a dream she has not heard yet? (The foxes were there last night; not for his login.) */
  due() {
    const night = this.night();
    const [y, m, d] = Diary.today().split('-').map(Number);
    const morning = new Date(y, m - 1, d, DIARY_DAY_STARTS).getTime(); // (when last night was over)
    return State.onboarded && !Cloud.writer && !Opening.shut() && Opening.since() < morning && State.pet.foxes.length > 0 && State.dreams.seen !== night;
  },

  /* Which fox dreamt that night: one of those at home, in turn by the date. */
  dreamer(night) {
    const home = Pet.home();
    return home.length ? home[hashStr(night) % home.length] : State.pet.species;
  },

  /* What else is known of the day, for the dream (see DREAM_MOTIFS). */
  context(night, d) {
    const special = Days.on(night).find((x) => x.kind !== 'ours' || /^\d+(일|주년)$/.test(x.name));
    const [gameId] = Object.entries(d.gameBy || {}).sort((a, b) => b[1] - a[1])[0] || [];
    const game = typeof GAMES !== 'undefined' && GAMES.find((g) => g.id === gameId);
    const giftName = (d.gifts || [])[0];
    const find = giftName && Object.values(TRIP_FINDS).find((f) => f.name === giftName);
    const page = State.diary.pages[night];
    return {
      md: night.slice(5),
      day: special && !['10-31', '12-24', '12-25'].includes(night.slice(5)) ? special.name.replace(/^내 /, `${State.user.nickname || '너'} `) : '',
      dayEmoji: special ? special.emoji : '',
      gameId: gameId || '',
      game: game ? game.name : '미니게임',
      gift: giftName || '',
      giftEmoji: find ? find.emoji : '',
      moon: d.gazed || '달',
      trophy: Diary.achievementsOn(night).length > 0,
      page: !!page,
      mood: page ? page.mood : '',
    };
  },

  /* {nick}, {song:이/가}… → the words. */
  fill(text, x, fox) {
    const names = { nick: State.user.nickname || '너', bf: CFG.boyfriendName || '남자친구', fox: Pet.nameOf(fox), song: x.song, gift: x.gift, game: x.game, moon: x.moon, day: x.day, dayEmoji: x.dayEmoji };
    return String(text).replace(/\{(\w+)(?::([^}]+))?\}/g, (m, key, pair) => {
      const word = names[key] == null ? '' : String(names[key]);
      if (key === 'song' || key === 'gift') return `‘${word}’${pair ? josa(word, pair).slice(word.length) : ''}`;
      return pair ? josa(word, pair) : word;
    });
  },

  /*
     The dream of `night`, for `fox`: { night, fox, title, lines: [opener, dream, twist, ending], art, moon, seed }.
     Worked out afresh from the day's record — the same for the same night, wherever she is.
  */
  recipe(night, fox = this.dreamer(night), d = State.diary.log[night] || {}) {
    const seed = hashStr(`${night}:${fox}`);
    const rnd = mulberry32(seed);
    const x = this.context(night, d);
    x.song = (d.covers || [])[0] || '';
    const weighted = (list) => {
      let u = rnd() * list.reduce((s, c) => s + c.w, 0);
      return list.find((c) => (u -= c.w) < 0) || list[list.length - 1];
    };
    const cands = DREAM_MOTIFS.map((m) => ({ m, w: m.weight(d, x) })).filter((c) => c.w > 0);
    const main = cands.length ? weighted(cands).m : DREAM_MISSED;
    const variant = main.id === 'game' ? GAME_DREAMS[x.gameId] || GAME_DREAMS.other : pick(main.main, rnd);
    const others = cands.filter((c) => c.m !== main && c.m.twist);
    const second = others.length ? weighted(others).m : null;
    const loose = second ? null : pick(DREAM_TWISTS, rnd);
    const twist = second ? pick(second.twist, rnd) : loose.text;
    const endings = GLAD_MOODS.includes(x.mood) ? DREAM_ENDINGS.glad : LOW_MOODS.includes(x.mood) ? DREAM_ENDINGS.low : DREAM_ENDINGS.any;
    const opener = pick(DREAM_OPENERS, rnd);
    const ending = pick(endings, rnd);
    // last night's moon, as it was at midnight (js/moon.js)
    const [y, mo, da] = night.split('-').map(Number);
    const m = Astro.moon(new Date(y, mo - 1, da + 1).getTime());
    const big = variant.big || (main.id === 'party' && x.dayEmoji) || (main.id === 'gift' && x.giftEmoji) || main.art.big;
    return {
      night,
      fox,
      seed,
      motif: main.id,
      title: variant.title,
      lines: [opener, variant.text, twist, ending].map((s) => this.fill(s, x, fox)),
      art: {
        big,
        bits: (variant.bits || main.art.bits).slice(),
        more: second ? second.art.bits.slice(0, 3) : loose.bits.slice(),
        sky: main.art.sky.slice(),
        pose: main.art.pose,
      },
      moon: { f: +m.fraction.toFixed(3), w: m.waxing },
    };
  },

  /* ----- hearing it ----- */

  /*
     The dream of `night` (none: last night's) — kept the first time she hears it. `rehearsal`: only to see how it is (a
     dream of today so far, or `rec`) — nothing is kept.
  */
  async open(night = null, { rehearsal = false, rec = null } = {}) {
    if (this.ov) return;
    if (rehearsal) rec = rec || this.recipe(Diary.today(), State.pet.species, State.diary.log[Diary.today()] || {});
    else if (night && State.dreams.list[night]) rec = State.dreams.list[night];
    else {
      night = this.night();
      rec = State.dreams.list[night] || this.recipe(night);
      if (State.dreams.seen !== night) this.keep(rec);
    }
    const name = Pet.nameOf(rec.fox);
    const ov = (this.ov = UI.open(
      `<div class="dream" data-dream>
        <div class="sheet-handle" aria-hidden="true"></div>
        <header class="dream-head">
          <h2>💭 ${esc(name)}의 꿈</h2>
          <small>${esc(Moon.date(rec.night))} 밤${rehearsal ? ' · 미리 보기' : ''}</small>
        </header>
        <div class="dream-pic" data-dream-pic><p class="dream-wait"><span aria-hidden="true">💤</span> 꿈을 그리는 중…</p></div>
        <div class="dream-story">
          <p class="dream-title">‘${esc(rec.title)}’</p>
          ${rec.lines.map((l, i) => `<p style="--i:${i}">${esc(l)}</p>`).join('')}
        </div>
        <div class="dialog-actions">
          <button class="btn soft" data-dream-save disabled>💾 그림 저장</button>
          ${rehearsal ? '' : '<button class="btn soft" data-dream-list>📖 꿈 일기</button>'}
          <button class="btn ghost" data-ov-cancel>닫기</button>
        </div>
      </div>`,
      {
        cls: 'is-dream',
        label: `${name}의 꿈`,
        onClose: () => {
          this.ov = null;
          if (!this.listing) this.settle();
        },
      }
    ));
    let pic = null;
    ov.panel.addEventListener('click', (e) => {
      const on = (sel) => e.target.closest(sel);
      if (on('[data-ov-cancel]')) UI.close(ov);
      else if (on('[data-dream-list]')) {
        this.listing = true;
        UI.close(ov).then(() => this.list());
      }
      else if (on('[data-dream-save]') && pic) this.save(rec, pic);
    });
    try {
      pic = await this.picture(rec);
    } catch (err) {
      console.warn('[Dream] the picture could not be drawn', err);
    }
    if (this.ov !== ov) return;
    const box = $('[data-dream-pic]', ov.panel);
    if (!pic) return void (box.innerHTML = '<p class="dream-wait">그림은 이 기기에서 그릴 수 없었어요. 이야기만 들려줄게요!</p>');
    box.innerHTML = `<img src="${pic.toDataURL('image/jpeg', 0.9)}" alt="${esc(`${name}의 꿈 그림: ${rec.title}`)}">`;
    $('[data-dream-save]', ov.panel).disabled = false;
  },

  /* She has heard it: it goes in the dream diary (the oldest go when it is full), and counts for her day. */
  keep(rec) {
    State.dreams.seen = rec.night;
    State.dreams.list[rec.night] = { ...rec, at: Date.now() };
    const nights = Object.keys(State.dreams.list).sort();
    nights.slice(0, Math.max(0, nights.length - DREAMS_KEPT)).forEach((n) => delete State.dreams.list[n]);
    Diary.put('dream', Pet.nameOf(rec.fox));
    Store.save();
    this.owed = true;
  },

  /* …and once its screen is closed: a little something for it, and what it counts towards. (Not while it is open: a
     fox's pop-up for an achievement would sit on its buttons.) */
  settle() {
    this.listing = false;
    if (!this.owed) return;
    this.owed = false;
    Game.reward({ dopamine: 10, xp: 5 });
    Store.save();
    Game.checkAchievements();
    if (Router.is('home')) setTimeout(() => Router.refresh(), 300);
  },

  /* The dreams she has heard, the newest first: a tap opens one again. */
  list() {
    const nights = Object.keys(State.dreams.list).sort().reverse();
    const ov = UI.open(
      `<div class="juke dream-list">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 class="juke-title">💭 꿈 일기 <small>${nights.length}</small></h2>
        <p class="hint">${nights.length ? '여우들이 꾼 꿈 이야기예요. 누르면 다시 볼 수 있어요.' : '아침마다 여우가 지난밤 꾼 꿈 이야기를 들려줘요.'}</p>
        <div class="dream-rows">${nights
          .map((n) => {
            const r = State.dreams.list[n];
            return `<button class="dream-row" data-night="${esc(n)}"><span class="dr-day">${esc(Moon.date(n))}</span><span class="dr-text"><b>${esc(r.title)}</b><small>${esc(Pet.nameOf(r.fox))} · ${esc(r.lines[1])}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
          })
          .join('')}</div>
        <div class="dialog-actions one"><button class="btn soft" data-ov-cancel>닫기</button></div>
      </div>`,
      { cls: 'is-juke', label: '꿈 일기', onClose: () => this.settle() }
    );
    ov.panel.addEventListener('click', (e) => {
      const row = e.target.closest('[data-night]');
      if (row) UI.close(ov).then(() => this.open(row.dataset.night));
      else if (e.target.closest('[data-ov-cancel]')) UI.close(ov);
    });
  },

  /* The picture with its story under it, as a file of her own. */
  async save(rec, pic) {
    const c = await this.page(rec, pic);
    const blob = await Art.toBlob(c, 'image/png');
    offerFile(blob, `${Pet.nameOf(rec.fox)}의 꿈 ${rec.night}.png`, { icon: '💭', title: '꿈 그림이 준비됐어요!', text: '내가 고른 곳에만 저장돼요 — 어디에도 올라가지 않아요.', image: true });
  },

  /* ----- the picture ----- */

  /* Drawn once a visit for each night (the fox in it is cut out of its 3D self, and that takes a moment). */
  picture(rec) {
    if (!this.pics.has(rec.night)) this.pics.set(rec.night, this.paint(rec).catch((err) => (this.pics.delete(rec.night), Promise.reject(err))));
    return this.pics.get(rec.night);
  },

  /* The fox twice, as it is now — asleep, and in its dream — or null where there is no 3D. */
  async foxes(rec) {
    if (!(await FoxHost.ready()) || !FoxHost.api || !FoxHost.api.cutout) return [null, null];
    const worn = Pet.outfit(rec.fox).slice();
    const grown = Pet.grown(rec.fox);
    const pose = rec.art.pose;
    return [
      FoxHost.api.cutout(rec.fox, { pose: 'sleep', mood: { eyes: 'sleep' }, worn, grown, size: 512, yaw: -2.2 }),
      FoxHost.api.cutout(rec.fox, { pose, mood: DREAM_POSES[pose] || DREAM_POSES.hop, worn, grown, size: 512, yaw: 0.6 }),
    ];
  },

  async paint(rec) {
    await Art.fontsReady(`${rec.title}${Pet.nameOf(rec.fox)}z`);
    const [sleeper, actor] = await this.foxes(rec).catch(() => [null, null]);
    const S = DREAM_SIZE;
    const c = Art.canvas(S, S);
    const g = c.getContext('2d');
    const rnd = mulberry32(rec.seed);
    const art = rec.art;
    // the night round the dream: deep blue to violet, a glow or two, stars
    const night = g.createLinearGradient(0, 0, 0, S);
    DREAM_NIGHT.forEach((col, i) => night.addColorStop(i / (DREAM_NIGHT.length - 1), col));
    g.fillStyle = night;
    g.fillRect(0, 0, S, S);
    Art.blob(g, 860, 900, 520, '#ff8fc7', 0.22);
    Art.blob(g, 160, 260, 420, '#7f8cff', 0.2);
    for (let i = 0; i < 150; i++) {
      g.fillStyle = `rgba(255,255,255,${0.25 + rnd() * 0.6})`;
      g.beginPath();
      g.arc(rnd() * S, rnd() * S, rnd() < 0.08 ? 2.6 : 1.3, 0, TAU_2D);
      g.fill();
    }
    // last night's moon, up in the corner, as it really was
    this.moonShape(g, 118, 118, 52, rec.moon.f, rec.moon.w);

    // the dream: a cloud of a bubble, a white glow round it, and inside it the dream's own sky
    // (all of it within the picture: the bumps reach out by up to 122 px)
    const B = { x: 615, y: 404, rx: 338, ry: 258 };
    const bumps = Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * TAU_2D + (rnd() - 0.5) * 0.25;
      return { a, x: B.x + Math.cos(a) * B.rx, y: B.y + Math.sin(a) * B.ry, r: 84 + rnd() * 38 };
    });
    const cloud = (k) => {
      g.beginPath();
      g.ellipse(B.x, B.y, B.rx * k, B.ry * k, 0, 0, TAU_2D);
      for (const b of bumps) {
        const x = B.x + (b.x - B.x) * k;
        const y = B.y + (b.y - B.y) * k;
        g.moveTo(x + b.r * k, y);
        g.arc(x, y, b.r * k, 0, TAU_2D);
      }
    };
    g.save();
    g.shadowColor = 'rgba(255, 245, 255, 0.85)';
    g.shadowBlur = 60;
    g.fillStyle = 'rgba(255, 250, 255, 0.96)';
    cloud(1.03);
    g.fill();
    g.restore();
    g.save();
    cloud(1);
    g.clip();
    const sky = g.createLinearGradient(0, B.y - B.ry - 140, 0, B.y + B.ry + 140);
    sky.addColorStop(0, art.sky[0]);
    sky.addColorStop(1, art.sky[1]);
    g.fillStyle = sky;
    g.fillRect(0, 0, S, S);
    Art.blob(g, B.x - 120, B.y - 60, 320, '#ffffff', 0.25);
    for (let i = 0; i < 26; i++) {
      g.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.5})`;
      Art.sparkle(g, B.x + (rnd() - 0.5) * 2 * B.rx, B.y + (rnd() - 0.5) * 2 * B.ry, 4 + rnd() * 10, rnd());
    }
    const emoji = (e, x, y, size, rot = 0, alpha = 1) => {
      g.save();
      g.globalAlpha = alpha;
      g.translate(x, y);
      g.rotate(rot);
      g.font = `${size}px ${EMOJI_FONT}`; // (the emoji font of the stickers: js/stickers.js)
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(e, 0, 0);
      g.restore();
    };
    // the big thing the dream is about, glowing — and the fox beside it, up to its tricks
    const bx = B.x - B.rx * 0.4;
    const by = B.y + 20;
    const ax = B.x + B.rx * 0.34;
    const ay = B.y + 40;
    // (the little things keep clear of both)
    const clear = (x, y) => Math.hypot(x - bx, y - by) > 150 && Math.hypot((x - ax) / 1.1, y - ay) > 175;
    const spot = (y0, y1) => {
      for (let n = 0; n < 40; n++) {
        const x = B.x + (rnd() * 2 - 1) * B.rx * 0.92;
        const y = y0 + rnd() * (y1 - y0);
        if (clear(x, y) && Math.hypot((x - B.x) / B.rx, (y - B.y) / B.ry) < 0.95) return [x, y];
      }
      return null;
    };
    for (let i = 0; i < 8; i++) {
      const at = spot(B.y - B.ry * 0.9, B.y + B.ry * 0.9);
      if (at) emoji(art.bits[i % art.bits.length], at[0], at[1], 46 + rnd() * 46, (rnd() - 0.5) * 0.9, 0.95);
    }
    Art.blob(g, bx, by, 230, '#ffffff', 0.5);
    emoji(art.big, bx, by, 250, -0.12);
    g.save();
    g.translate(ax, ay);
    g.rotate(art.pose === 'hop' ? -0.16 : 0);
    if (actor) g.drawImage(actor, -230, -230, 460, 460);
    else emoji('🦊', 0, 0, 240);
    g.restore();
    // …and what came into the dream from elsewhere, coming down from the top, over everything
    for (let i = 0; i < 6; i++) {
      const at = spot(B.y - B.ry * 0.95, B.y - B.ry * 0.35);
      if (at) emoji(art.more[i % art.more.length], at[0], at[1], 42 + rnd() * 28, (rnd() - 0.5) * 0.8, 0.95);
    }
    g.restore();

    // the dreamer, asleep on a cloud below
    g.fillStyle = 'rgba(255, 250, 255, 0.95)';
    [[150, 1010, 125], [275, 990, 140], [400, 1012, 112], [80, 1040, 92], [480, 1045, 84]].forEach(([x, y, r]) => {
      g.beginPath();
      g.arc(x, y, r, 0, TAU_2D);
      g.fill();
    });
    if (sleeper) g.drawImage(sleeper, 18, 612, 470, 470);
    else emoji('🦊', 250, 900, 200);
    // the little bubbles of its dream, rising from its head to the big one (the last one at its edge)
    const head = { x: 236, y: 788 };
    const toward = bumps.reduce((best, b) => (Math.hypot(b.x - head.x, b.y - head.y) - b.r < Math.hypot(best.x - head.x, best.y - head.y) - best.r ? b : best));
    const gap = Math.hypot(toward.x - head.x, toward.y - head.y) - toward.r;
    const ux = (toward.x - head.x) / (gap + toward.r);
    const uy = (toward.y - head.y) / (gap + toward.r);
    [[0.3, 13], [0.6, 20], [0.88, 29]].forEach(([k, r]) => {
      g.save();
      g.shadowColor = 'rgba(255, 245, 255, 0.8)';
      g.shadowBlur = 18;
      g.fillStyle = 'rgba(255, 250, 255, 0.96)';
      g.beginPath();
      g.arc(head.x + ux * gap * k, head.y + uy * gap * k, r, 0, TAU_2D);
      g.fill();
      g.restore();
    });
    // …and its z z z, drifting up the other way
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    [[150, 760, 40], [116, 708, 52], [84, 648, 64]].forEach(([x, y, s]) => {
      g.font = Art.FONTS.hand(s);
      Art.hand(g, 'z', x, y, 'center');
    });
    // its name, and the dream's
    g.textAlign = 'right';
    g.shadowColor = 'rgba(20, 10, 50, 0.6)';
    g.shadowBlur = 12;
    g.fillStyle = '#ffffff';
    Art.fitHand(g, `‘${rec.title}’`, Art.FONTS.hand, 470, 64, 40);
    const tw = Art.handW(g, `‘${rec.title}’`);
    Art.hand(g, `‘${rec.title}’`, S - 60 - tw, 948);
    g.font = Art.FONTS.hand(36);
    const sub = `${Pet.nameOf(rec.fox)}의 꿈 · ${Moon.date(rec.night)} 밤`;
    g.fillStyle = 'rgba(255, 255, 255, 0.85)';
    Art.hand(g, sub, S - 60 - Art.handW(g, sub), 1008);
    g.shadowColor = 'transparent';
    Art.grain(g, S, 0.035);
    return c;
  },

  /* The moon as it was (`f`: how much of it lit; `w`: growing — lit on the right): a pale disc, and its lit part. */
  moonShape(g, x, y, r, f, w) {
    g.save();
    g.shadowColor = 'rgba(255, 244, 200, 0.75)';
    g.shadowBlur = 36 * f;
    g.fillStyle = 'rgba(255, 246, 214, 0.12)';
    g.beginPath();
    g.arc(x, y, r, 0, TAU_2D);
    g.fill();
    if (f > 0.02) {
      const right = w;
      const k = Math.abs(1 - 2 * f); // (how wide the line between light and dark bulges)
      g.fillStyle = '#fff3cf';
      g.beginPath();
      g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !right);
      g.ellipse(x, y, r * k, r, 0, Math.PI / 2, -Math.PI / 2, (f < 0.5) === right);
      g.closePath();
      g.fill();
    }
    g.restore();
  },

  /* The picture with the story written under it, for saving. */
  async page(rec, pic) {
    const S = DREAM_SIZE;
    const pad = 70;
    const measure = Art.canvas(1, 1).getContext('2d');
    measure.font = Art.FONTS.hand(44);
    const lines = [];
    rec.lines.forEach((text, i) => {
      let line = '';
      for (const word of text.split(' ')) {
        const next = line ? `${line} ${word}` : word;
        if (line && Art.handW(measure, next) > S - pad * 2) {
          lines.push(line);
          line = word;
        } else line = next;
      }
      if (line) lines.push(line);
      if (i < rec.lines.length - 1) lines.push('');
    });
    const H = S + 110 + lines.length * 58 + 80;
    const c = Art.canvas(S, H);
    const g = c.getContext('2d');
    g.fillStyle = '#fffaf0';
    g.fillRect(0, 0, S, H);
    g.drawImage(pic, 0, 0, S, S);
    g.fillStyle = '#7a5a8a';
    g.font = Art.FONTS.hand(52);
    Art.hand(g, `💭 ${Pet.nameOf(rec.fox)}의 꿈 이야기`, pad, S + 90);
    g.fillStyle = '#5a4560';
    g.font = Art.FONTS.hand(44);
    lines.forEach((l, i) => l && Art.hand(g, l, pad, S + 170 + i * 58));
    g.font = '600 28px Fredoka, Jua, sans-serif';
    g.fillStyle = 'rgba(90, 60, 100, 0.6)';
    g.textAlign = 'right';
    g.fillText('💗 도파민 월드', S - pad, H - 36);
    return c;
  },

  /* ----- telling her ----- */

  /* The card on Home: last night's dream, until she has heard it. */
  cardHtml() {
    if (!this.due()) return '';
    const name = Pet.nameOf(this.dreamer(this.night()));
    return `<button class="card dream-card" data-action="dream-open">
      <span class="dream-ico" aria-hidden="true">💭</span>
      <span class="dream-text"><b>${esc(josa(name, '이/가'))} 어젯밤 꿈을 꿨대요</b><small>무슨 꿈이었는지 들어 볼래요?</small></span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`;
  },

  /* …and the fox says so, once a morning. */
  hail() {
    const night = this.night();
    if (!this.due() || State.dreams.hailed === night) return;
    State.dreams.hailed = night;
    Store.save();
    setTimeout(() => {
      if (!Router.is('home') || UI.stack.length) return;
      UI.petPop('어젯밤에 엄청 신기한 꿈 꿨어! 들려줄까? 💭');
    }, 2200);
  },

  /* For him (나 → 설정 → 메시지 편집): what it is. */
  note() {
    const n = Object.keys(State.dreams.list).length;
    return `아침마다(새벽 5시부터) 여우 한 마리가 어젯밤 꾼 꿈 이야기를 들려줘요. 전날 한 일 — 부른 노래, 게임, 편지, 간식, 달 구경, 특별한 날 — 이 뒤섞인 엉뚱한 꿈이고, 여우가 직접 나오는 그림이 한 장 그려져요. ${n ? `지금까지 ${n}개의 꿈을 들었어요 (이 기기 기준).` : ''}`;
  },

  /*
     For trying it out (index.html?debug=1, in the console):
       Dream.test()                          last night's dream, drawn — nothing is kept
       Dream.test({ covers: ['밤편지'], feeds: 2 })   …a dream of a day like that
  */
  test(log = null, night = this.night()) {
    this.pics.delete(night);
    return this.open(null, { rehearsal: true, rec: this.recipe(night, this.dreamer(night), log || State.diary.log[night] || {}) });
  },
};

Object.assign(Actions, {
  'dream-open': () => Dream.open(),
  'dream-list': () => Dream.list(),
  'dream-rehearse': () => Dream.open(null, { rehearsal: true }),
});
