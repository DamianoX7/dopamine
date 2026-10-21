'use strict';
/* ==================================================================
   💬 Chat — now and then Lorelei has something to say to her.

   Like a neighbour in Animal Crossing: she comes to the front of the
   foxes' world, waves and calls (a bubble over her head, as ever) —
   and waits, a speech mark over her head. A tap on her, or on the chip
   that says so, and she has her say in the window along the bottom
   (js/talk.js): about the hour, the weather, the foxes, her songs, the
   days of the two of them — sometimes with a question, sometimes with
   something small to give, sometimes with a word from him. Left alone,
   she lets it be and tries another day.

   Not on every visit, not too often, and never twice running about the
   same thing. She does not speak up before she has said her first
   hello (js/meet.js), nor while she has a present to give
   (js/present.js) or, on Halloween, her game still to play
   (js/halloween.js) — at Christmas, her present (js/christmas.js).
   ================================================================== */

const CHAT_REST = 90 * 60000; //  at least this long between two chats
const CHAT_A_DAY = 4; //          …and no more than this many a day
const CHAT_CHANCE = 0.6; //       on a visit where she could: how likely she does
const CHAT_LOOK = 5 * 60000; //   …and on a long visit it is seen again this often whether she has something to say
const CHAT_RECENT = 6; //         what she has spoken of lately is not spoken of again (so many chats back)

/* What she calls over her head when she would like a word, and what she says if nobody comes. */
const CHAT_CALLS = {
  call: ['저기, 잠깐만! 💬', '{nick}! 할 말이 있어 💬', '있잖아~ 💬', '{nick}, 이리 와 봐! 💬'],
  later: ['바쁜가 보네. 다음에 얘기하자!', '괜찮아, 나중에 얘기해!'],
};

/*
   What she talks about. Each: `when(c)` — does it fit now? (c: see Chat.context) · `w` how often, among those that fit ·
   `must` — it is said the first chance there is (a birthday, a long time away) · `say(c)` the pages, as js/talk.js
   takes them · `after(c)` what follows once it was heard to the end (a gift…).
   In the text: {nick} = what she is called, {fox} = her fox, {me} = Lorelei — each also with the ending that fits the
   name ({fox:이/가}); a topic may bring words of its own ({name}, {days}…) in what say() returns as `words`.
*/
const CHAT_TOPICS = [
  // ---- days that are said first
  {
    id: 'back',
    must: true,
    when: (c) => c.gap >= 3,
    say: () => ['어, {nick:이다/다}! 오랜만이야!', '여우들이 많이 보고 싶어 했어. …사실 나도.', '앞으로는 자주 놀러 와. 약속!'],
  },
  {
    id: 'birthday',
    must: true,
    when: (c) => !!c.birthday,
    say: () => ['{nick}! 오늘 생일이라며? 생일 축하해!! 🎂', '여우들이랑 같이 준비했어. 작지만 받아 줘!', '오늘은 네가 주인공이야. 좋은 하루 보내 💗'],
    after: () => Chat.give(100),
  },
  {
    id: 'ourday',
    must: true,
    when: (c) => !!c.ourDay,
    say: (c) => ({ words: { name: c.ourDay.name }, pages: ['{nick}, 오늘이 너희 {name:이라며/라며}?', '축하해! 여우들도 꼬리 흔들면서 축하한대.', '오늘은 둘이서 맛있는 거 먹어 💗'] }),
  },
  {
    id: 'holiday',
    must: true,
    when: (c) => !!c.holiday,
    say: (c) => ({ words: { name: c.holiday.name }, pages: ['오늘 {name:이네/네}! ' + c.holiday.emoji, '뭐 특별한 계획 있어?', '뭘 하든 즐거운 하루였으면 좋겠다.'] }),
  },
  // ---- days of theirs
  {
    id: 'soon',
    w: 2,
    when: (c) => !!c.soon,
    say: (c) => ({
      words: { name: c.soon.name, n: String(c.soon.n) },
      pages: ['참, {name}까지 {n}일 남았더라.', { text: '뭐 할지 정했어?', ask: ['응, 다 정했지!', '아직… 고민 중이야'] }, (a) => (a ? '천천히 정해. 뭘 하든 좋은 날이 될 거야.' : '오, 기대되겠다! 나중에 얘기해 줘.')],
    }),
  },
  {
    id: 'days',
    w: 1,
    when: (c) => c.days > 1,
    say: (c) => ({ words: { days: fmtNum(c.days) }, pages: ['너희 벌써 {days}일째라며?', '시간 진짜 빠르다. 그치?', '앞으로도 쭉 응원할게!'] }),
  },
  // ---- the hour
  {
    id: 'morning',
    w: 3,
    when: (c) => c.hour >= 5 && c.hour < 11,
    say: () => ['좋은 아침! 일찍 왔네.', { text: '아침은 먹었어?', ask: ['응, 먹었어!', '아직…'] }, (a) => (a ? '안 돼~ 뭐라도 꼭 챙겨 먹어. 약속!' : '잘했어! 든든해야 하루가 잘 풀려.')],
  },
  {
    id: 'lunch',
    w: 3,
    when: (c) => c.hour >= 11 && c.hour < 14,
    say: () => [
      { text: '점심시간이네. 뭐 먹었어?', ask: ['맛있는 거!', '대충 때웠어', '아직 안 먹었어'] },
      (a) => ['좋겠다! 듣기만 해도 배고파졌어.', '에이, 저녁은 꼭 맛있는 걸로 먹어.', '얼른 가서 먹고 와! 여우들은 내가 보고 있을게.'][a || 0],
    ],
  },
  {
    id: 'evening',
    w: 3,
    when: (c) => c.hour >= 18 && c.hour < 22,
    say: () => [
      { text: '오늘 하루 어땠어?', ask: ['좋았어!', '그냥 그랬어', '좀 힘들었어…'] },
      (a) => ['다행이다! 네가 웃으면 여우들 꼬리도 같이 올라가.', '그런 날도 있지. 여기서 좀 쉬다 가.', '고생했어… 오늘은 여우들이랑 푹 쉬어.'][a || 0],
      (a) => (a === 2 ? '내일은 분명 더 좋은 날일 거야.' : null),
    ],
  },
  {
    id: 'late',
    w: 3,
    when: (c) => c.hour >= 22 || c.hour < 5,
    say: () => ['늦었는데 아직 안 잤어?', '여우들은 슬슬 졸린가 봐. 하품하는 것 좀 봐.', '너도 너무 늦게 자지는 마. 알았지?'],
  },
  // ---- the weather
  {
    id: 'rain',
    w: 3,
    when: (c) => c.sky === 'rain',
    say: () => [{ text: '비 온다. 빗소리 듣는 거 좋아해?', ask: ['좋아해', '별로야'] }, (a) => (a ? '그렇구나. 금방 그칠 거야. 그치면 웅덩이가 생기는데, 여우들이 엄청 좋아해!' : '나도! 우산 쓰고 듣는 빗소리가 제일 좋아.')],
  },
  {
    id: 'snow',
    w: 3,
    when: (c) => c.sky === 'snow',
    say: () => ['눈이다! 여우들 뛰는 것 좀 봐.', '눈 오는 날엔 따뜻하게 입고 다녀야 해. 감기 걸리면 안 돼!'],
  },
  {
    id: 'clear',
    w: 1,
    when: (c) => c.sky === 'clear' && c.hour >= 9 && c.hour < 18,
    say: () => ['오늘 날씨 진짜 좋다!', '이런 날엔 여우들이 낮잠을 제일 잘 자.', '너도 잠깐 햇볕 좀 쬐고 와.'],
  },
  // ---- the foxes
  {
    id: 'hungry',
    w: 4,
    when: (c) => c.fullness < 35 && c.home && !c.gifted,
    say: () => ['있잖아, {fox:이/가} 아까부터 밥그릇만 쳐다봐.', '이번엔 내가 한 끼 챙겨 줄게.', '대신 다음엔 네가 주는 거다!'],
    after: () => Chat.treat(),
  },
  {
    id: 'happy',
    w: 2,
    when: (c) => c.happiness > 75 && c.home,
    say: () => ['{fox} 요즘 기분 최고야.', '네가 자주 와 줘서 그런가 봐. 고마워!'],
  },
  {
    id: 'lonely',
    w: 3,
    when: (c) => c.happiness < 40 && c.home,
    say: () => ['{fox:이/가} 조금 심심했나 봐.', '같이 놀아 주면 금방 풀릴 거야. 쓰다듬어 주는 것도 좋아해!'],
  },
  {
    id: 'away',
    w: 3,
    when: (c) => !!c.away,
    say: (c) => ({ words: { away: c.away }, pages: ['{away:이/가} 지금쯤 어디까지 갔을까?', '걱정 마. 분명 좋은 걸 물고 돌아올 거야.'] }),
  },
  {
    id: 'friend',
    w: 1,
    when: (c) => c.foxes === 1 && c.coins >= 150,
    say: () => ['상점 구경해 봤어?', '새 친구들이 기다리고 있던데. {fox:도/도} 친구가 생기면 좋아할 거야.'],
  },
  // ---- her songs
  {
    id: 'sang',
    w: 4,
    when: (c) => c.sangToday,
    say: () => ['오늘 노래 불렀지? 여기까지 들렸어!', '여우들이 귀를 쫑긋 세우고 듣더라.', '다음 곡도 기대할게.'],
  },
  {
    id: 'sing',
    w: 2,
    when: (c) => c.covers > 0 && c.unsung >= 3,
    say: () => ['요즘은 노래 안 불러?', '여우들이 네 노래 기다리고 있어. …나도!'],
  },
  {
    id: 'firstsong',
    w: 2,
    when: (c) => c.covers === 0,
    say: () => ['아직 노래는 안 불러 봤지?', '한 곡 부르면 여우들한테 들려줄 수 있어.', '궁금하다, 네 목소리!'],
  },
  // ---- a word from him
  {
    id: 'relay',
    w: 3,
    when: (c) => c.messages > 0,
    say: (c) => {
      const all = Messages.all();
      const got = !c.rehearsal ? Messages.open() : all.length ? { msg: pick(all) } : null; // (shown to him, it is not opened)
      if (!got) return ['…어? 무슨 말을 하려고 했더라. 다음에 생각나면 말해 줄게!'];
      return { words: { him: c.him }, pages: ['아, 맞다! {him:이/가} 전해 달라던 말이 있었어.', ...Chat.quote(got.msg.text), '…라고 했어. 좋겠다~ 💗'] };
    },
    after: () => {
      Game.reward({ dopamine: 5 });
      Game.track('message');
    },
  },
  // ---- something small to give
  {
    id: 'gift',
    w: 2,
    when: (c) => !c.gifted,
    say: () => ['{nick}, 손 내밀어 봐.', '산책하다가 주웠어. 반짝이길래 너 주려고 챙겨 놨지!', '여우들 간식 사 줘.'],
    after: () => Chat.give(randInt(15, 30)),
  },
  // ---- this and that
  {
    id: 'tail',
    w: 1,
    when: () => true,
    say: () => ['그거 알아? 여우는 기분이 좋으면 꼬리를 살랑살랑 흔들어.', '{fox:도/도} 너만 보면 그래. 잘 봐 봐!'],
  },
  {
    id: 'blanket',
    w: 1,
    when: () => true,
    say: () => ['여우 꼬리는 이불 대신이야. 추우면 돌돌 말고 자거든.', '보고 있으면 나까지 졸려…'],
  },
  {
    id: 'ears',
    w: 1,
    when: () => true,
    say: () => ['여우는 귀가 엄청 밝아. 네 발소리도 다 알아들어.', '그래서 네가 오면 제일 먼저 달려가는 거야.'],
  },
  {
    id: 'stars',
    w: 1,
    when: () => true,
    say: () => ['나 어제 별 보다가 마당에서 잠들었어.', '눈 떠 보니까 여우들이 다 내 옆에 붙어 있더라. 따뜻했어.'],
  },
  {
    id: 'clouds',
    w: 1,
    when: () => true,
    say: () => ['가끔은 그냥 풀밭에 누워서 구름만 봐.', '너도 가끔은 아무것도 안 하는 시간을 가져 봐. 생각보다 좋아.'],
  },
  {
    id: 'season',
    w: 1,
    when: () => true,
    say: () => [{ text: '갑자기 궁금한데… 너는 여름이 좋아, 겨울이 좋아?', ask: ['여름!', '겨울!'] }, (a) => (a ? '눈 오는 날 여우들 뛰는 거 꼭 봐야 돼. 진짜 귀여워.' : '여름밤 산책, 최고지! 여우들도 밤바람을 좋아해.')],
  },
  {
    id: 'taste',
    w: 1,
    when: () => true,
    say: () => [{ text: '단 거랑 짠 거 중에 뭐가 더 좋아?', ask: ['단 거!', '짠 거!', '둘 다!'] }, (a) => ['역시! 달콤한 게 최고지.', '오, 어른 입맛이네.', '욕심쟁이~ 근데 나도 그래.'][a || 0]],
  },
  {
    id: 'cheer',
    w: 2,
    when: () => true,
    say: () => ['요즘 열심히 지내는 것 같아서 보기 좋아.', '힘들 땐 여기 와서 쉬다 가.', '여우들도 나도 항상 여기 있으니까.'],
  },
];

const Chat = {
  topic: null, //   what she will speak of this visit
  calling: false, // she has come forward and waits to be tapped
  playing: false, // she is having her say
  rehearsing: false, // he has asked to be shown how it will be (nothing of it is kept)
  gap: 0, //        how many days she had not been in the foxes' world when she came in this time
  timer: 0,
  watch: 0,

  /** Her chats so far: { at: when the last one was, day + today: how many on which day, last: what about, gift: the day she last gave something, seen: when she was last in the foxes' world }. */
  get log() {
    return State.pet.chat;
  },

  /* ----- now ----- */

  /** What there is to talk about right now. */
  context() {
    const p = State.pet;
    const today = dateKey();
    const on = Days.on(today);
    const mine = (e) => e.kind === 'own' && /내\s*생일/.test(e.name); // (her birthday, as js/config.js writes it: from her side)
    const next = Days.upcoming(8).find((e) => e.key > today && (e.kind === 'ours' || e.kind === 'own') && !/열리는 날/.test(e.name));
    const hundred = `${PRESENT.day}일`; // (that day is Lorelei's own to speak of: js/present.js)
    const trip = Pet.trip();
    const last = State.singing.lastRecordingDate;
    return {
      hour: new Date().getHours(),
      sky: Weather.now(FoxHost.scene()).kind,
      gap: this.gap,
      birthday: on.find(mine) || null,
      ourDay: on.find((e) => e.kind === 'ours' && e.name !== hundred && !/열리는 날|시작한 날/.test(e.name)) || null,
      // (Halloween and Christmas the foxes' world keeps itself — js/halloween.js, js/christmas.js: she does not speak of them as of any other day)
      holiday: on.find((e) => (e.kind === 'year' && !(Halloween.on() && /핼러윈/.test(e.name)) && !(Christmas.on() && /크리스마스/.test(e.name))) || (e.kind === 'own' && !mine(e))) || null,
      soon: next && daysBetween(today, next.key) <= 7 ? { name: mine(next) ? '네 생일' : next.name, n: daysBetween(today, next.key) } : null, // ("내 생일" is hers: from Lorelei's mouth it is "네 생일")
      days: Days.count() || 0,
      fullness: p.fullness,
      happiness: p.happiness,
      home: Pet.home().length > 0,
      foxes: p.foxes.length,
      coins: State.dopamine.coins,
      away: trip && Pet.away(trip.fox) ? Pet.nameOf(trip.fox) : '',
      sangToday: Game.sangToday(),
      covers: Music.released().length,
      unsung: last ? daysBetween(last, today) : 0,
      messages: Messages.all().length,
      him: CFG.boyfriendName || '네 남자친구',
      gifted: this.log.gift === today,
    };
  },

  /** May she speak up at all on this visit? */
  may() {
    const log = this.log;
    if (!State.onboarded || !State.pet.introduced || Present.waiting() || Halloween.waiting() || Christmas.waiting() || !FoxHost.api || FoxHost.failed) return false;
    if (this.notHers()) return false;
    if (Pet.mood() === 'sleepy') return false; // (late at night she lets the foxes sleep)
    if (Date.now() - log.at < CHAT_REST) return false;
    return !(log.day === dateKey() && log.today >= CHAT_A_DAY);
  },

  /** Is this not a visit of hers? (The foxes' world has not opened for her yet — js/opening.js — or he is looking at how something will be.) */
  notHers() {
    return Opening.shut() || this.rehearsing || Meet.rehearsing || Present.rehearsing || Halloween.rehearsing || Christmas.rehearsing;
  },

  /** Is the foxes' world hers to speak up in just now? (Not over the shop, the camera, a song that is playing.) */
  clear() {
    const ov = FoxRoom.ov;
    return !!ov && UI.top() === ov && !FoxRoom.tab && !FoxRoom.photoOn && !OwnerSays.on && !Talk.on && !Meet.playing && !Present.playing && !Halloween.playing && !Christmas.playing && !CoverHost.tune();
  },

  /** One of the things that fit — the ones that are said first before the rest, none that she spoke of lately. */
  pickTopic(c = this.context()) {
    const own = (CFG.ownerChats || []).filter((x) => x && x.length).map((pages, i) => ({ id: `own${i}`, w: 2, when: () => true, say: () => [].concat(pages) }));
    const fits = CHAT_TOPICS.concat(own).filter((t) => !this.log.last.includes(t.id) && t.when(c));
    const first = fits.filter((t) => t.must);
    if (first.length) return first[0];
    const pool = fits.filter((t) => !t.must);
    let at = Math.random() * pool.reduce((sum, t) => sum + (t.w || 1), 0);
    return pool.find((t) => (at -= t.w || 1) < 0) || pool[pool.length - 1] || null;
  },

  /** Her words with the names in them. */
  fill(text, words = {}) {
    const names = Object.assign({ nick: State.user.nickname || '너', me: OWNER_NAME, fox: Pet.nameOf(State.pet.species) }, words);
    return String(text).replace(/\{(\w+)(?::([^}]+))?\}/g, (m, who, pair) => (who in names ? (pair ? josa(names[who], pair) : names[who]) : m));
  },

  line(key) {
    return this.fill(pick(CHAT_CALLS[key]));
  },

  /** Somebody else's words, in quotes — a long message a page at a time, cut where a line or a sentence ends. */
  quote(text, most = 60) {
    const pages = [];
    let page = '';
    for (const line of String(text).split(/\n+/).map((s) => s.trim()).filter(Boolean)) {
      (line.match(/[^.!?…~]*[.!?…~]+[^\s.!?…~]{0,2}\s*|[^.!?…~]+$/g) || [line]).forEach((part, i) => {
        const join = page && !i ? '\n' : ''; // (a line of its own stays one — three to a page at most)
        if (page && ((page + join + part).trim().length > most || (join && page.split('\n').length >= 3))) {
          pages.push(page.trim());
          page = part;
        } else page += join + part;
      });
    }
    if (page.trim()) pages.push(page.trim());
    if (!pages.length) return [];
    pages[0] = `“${pages[0]}`;
    pages[pages.length - 1] += '”';
    return pages;
  },

  /** A topic → the pages js/talk.js takes, with the names filled in (also in what is answered, and in what follows an answer). */
  pages(topic, c) {
    const said = topic.say(c);
    const { pages, words } = Array.isArray(said) ? { pages: said, words: {} } : said;
    const page = (p) => {
      if (p == null || p === false) return p;
      if (typeof p === 'string') return this.fill(p, words);
      if (typeof p === 'function') return (answer, all) => page(p(answer, all));
      return Object.assign({}, p, { text: this.fill(p.text, words), ask: p.ask ? p.ask.map((a) => this.fill(a, words)) : undefined });
    };
    return pages.map(page);
  },

  /* ----- a visit ----- */

  /* She has come into the foxes' world: perhaps Lorelei will have something to say before long — and, should she stay
     a long while, again later. (`quiet`: she has just been talked to at length — the first hello — so not at once.) */
  arrive({ quiet = false } = {}) {
    clearTimeout(this.timer);
    clearInterval(this.watch);
    this.calling = false;
    this.topic = null;
    FoxRoom.chatChip();
    if (this.notHers()) return;
    this.gap = this.log.seen ? (Date.now() - this.log.seen) / 86400000 : 0;
    this.log.seen = Date.now();
    Store.save();
    this.watch = setInterval(() => this.consider(), CHAT_LOOK);
    if (!quiet) this.consider();
  },

  /* Has she something to say just now? Then she comes forward with it in a little while. */
  consider() {
    if (this.topic || this.calling || this.playing || !FoxRoom.ov || !this.may()) return;
    const topic = this.pickTopic();
    if (!topic || (!topic.must && Math.random() > CHAT_CHANCE)) return;
    this.plan(topic, topic.must ? randInt(6, 9) : randInt(25, 60));
  },

  /* In `secs` she comes forward with `topic` — or a little later, if the moment is not hers. */
  plan(topic, secs) {
    const ov = FoxRoom.ov;
    this.topic = topic;
    let tries = 0;
    const tryIt = () => {
      if (FoxRoom.ov !== ov || this.topic !== topic || this.calling || this.playing || FoxHost.failed) return;
      const shown = this.rehearsing; // (he asked to be shown: she does not wait for her moment, nor for the right weather)
      if (!shown && !topic.when(this.context())) {
        // (what she meant to say does not fit any more — it has stopped raining, the fox was fed: something else, or nothing)
        this.topic = null;
        return void this.consider();
      }
      if (this.clear() && FoxHost.api && FoxHost.api.hail(this.line('call'), this.line('later'), shown)) {
        this.calling = true;
        return void FoxRoom.chatChip();
      }
      if (++tries < 30) this.timer = setTimeout(tryIt, shown ? 2000 : 8000); // (for some minutes: then not this time)
      else {
        this.topic = null;
        this.rehearsing = false;
      }
    };
    clearTimeout(this.timer);
    this.timer = setTimeout(tryIt, secs * 1000);
  },

  /* What the 3D side has to tell (js/fox/keeper.js: hailYou — js/fox/world.js: update). */
  heard(what) {
    if (!this.calling) return;
    if (what === 'call') return void Sfx.play('pop'); // (she is there, and calls)
    const topic = this.topic;
    this.calling = false;
    FoxRoom.chatChip();
    if (what === 'off') {
      // she was called away while she waited (the shop was opened, a picture is being taken): she tries again in a while
      if (topic) this.plan(topic, 20);
      return;
    }
    // nobody came: another time (but not at once, should she come back in a minute)
    this.topic = null;
    if (this.rehearsing) return void (this.rehearsing = false);
    this.log.at = Date.now() - CHAT_REST + 20 * 60000;
    Store.save();
  },

  /* She was tapped (or the chip was): Lorelei has her say. Resolves true when it was heard to the end.
     (A rehearsal — see test — is only to see how it will be: nothing is kept, nothing given.) */
  async begin() {
    const topic = this.topic;
    const ov = FoxRoom.ov;
    if (!this.calling || !topic || this.playing || OwnerSays.on || Talk.on || !ov || UI.top() !== ov) return false;
    this.calling = false;
    this.playing = true;
    FoxRoom.chatChip();
    const rehearsal = this.rehearsing;
    const c = Object.assign(this.context(), { rehearsal });
    let told = false;
    try {
      if (!(await OwnerSays.enter(null))) return false;
      told = !!(await OwnerSays.talk(this.pages(topic, c)));
    } finally {
      this.playing = false;
      this.topic = null;
      this.rehearsing = false;
      OwnerSays.leave();
    }
    if (!told) return false;
    if (rehearsal) {
      UI.toast(`여기까지가 미리 보기예요. 아무것도 저장되지 않았어요${topic.after ? ' (진짜로는 여기서 작은 선물도 줘요)' : ''}.`, { icon: '👀', ms: 5200 });
      return true;
    }
    const log = this.log;
    const today = dateKey();
    log.today = log.day === today ? log.today + 1 : 1;
    log.day = today;
    log.at = Date.now();
    log.last = [topic.id].concat(log.last.filter((id) => id !== topic.id)).slice(0, CHAT_RECENT);
    Store.save();
    if (topic.after) topic.after(c);
    return true;
  },

  /* The foxes' world was left. */
  left() {
    clearTimeout(this.timer);
    clearInterval(this.watch);
    this.calling = false;
    this.topic = null;
    if (!this.notHers()) {
      this.log.seen = Date.now();
      Store.save();
    }
    this.rehearsing = false;
  },

  /* ----- what she gives ----- */

  /** A few coins out of her pocket. */
  give(coins) {
    this.log.gift = dateKey();
    Game.reward({ coins });
    Sfx.play('coin');
    UI.toast(`${josa(OWNER_NAME, '이/가')} 코인 ${coins}개를 줬어요!`, { icon: '🪙', kind: 'gold', ms: 3400 });
    Store.save();
  },

  /** A meal for the foxes, on her. */
  treat() {
    const p = State.pet;
    this.log.gift = dateKey();
    p.fullness = Math.min(100, p.fullness + 30);
    p.happiness = Math.min(100, p.happiness + 5);
    Sfx.play('pop');
    Pet.care('feed', p.out);
    Pet.refresh();
    FoxHost.act('feed');
    UI.toast(`${josa(OWNER_NAME, '이/가')} 여우들에게 밥을 챙겨 줬어요.`, { icon: '🍖', ms: 3200 });
    Store.save();
  },

  /* ----- his side ----- */

  /** For him (나 → 설정 → 메시지 편집): what this is. */
  note() {
    const her = esc(josa(OWNER_NAME, '이/가'));
    return `여우 세상에 있으면 가끔 ${her} 앞으로 나와서 말을 걸어요. 눌러 주면 대화창으로 이야기해요 — 시간, 날씨, 여우들, 노래, 기념일 얘기, 가끔은 질문이나 작은 선물, 그리고 랜덤 메시지 중 하나를 대신 전해 주기도 해요. 하루에 많아야 ${CHAT_A_DAY}번, 한 번 이야기하면 한동안은 쉬어요.`;
  },

  /*
     For trying it out (index.html?debug=1, in the console; or 나 → 설정 → 메시지 편집 → 로렐라이의 수다):
       Chat.test()           she comes forward with something to say, now — as a rehearsal: nothing is saved
       Chat.test('evening')  …with that topic (the ids are in CHAT_TOPICS)
  */
  async test(id) {
    if (this.playing || OwnerSays.on || Talk.on) return null;
    this.rehearsing = true;
    if (!FoxRoom.ov) {
      await FoxRoom.open({ early: true }); // (his to look at, even before the foxes' world has opened for her)
      await sleep(600);
    }
    if (!FoxRoom.ov || !FoxHost.api || FoxHost.failed) {
      // (without the 3D view there is no Lorelei to come forward)
      this.rehearsing = false;
      if (FoxRoom.ov) UI.toast(`이 기기에서는 3D 여우 세상을 열 수 없어서 ${josa(OWNER_NAME, '이/가')} 나오지 않아요.`, { icon: '🙈', ms: 4200 });
      return null;
    }
    const topic = (id && CHAT_TOPICS.find((t) => t.id === id)) || this.pickTopic() || CHAT_TOPICS.find((t) => t.id === 'cheer');
    this.calling = false;
    FoxHost.api.unhail();
    FoxRoom.chatChip();
    this.plan(topic, 2);
    return topic.id;
  },
};

Object.assign(Actions, {
  'fox-chat': () => Chat.begin(),
  'chat-rehearse': async () => {
    await Router.go('#/home');
    Chat.test();
  },
});
