'use strict';
/* ==================================================================
   💙 그가 놀러 오는 날 — her boyfriend comes round to 둘의 집.

   From his own login (the one he writes his letters with: js/post.js)
   he makes himself — his face, his hair, his clothes, all free: he is
   not the one who plays — and says when he will come round: now, or
   on a day and at an hour; with a note, and a small present if he
   likes; and whether she may know of it beforehand (the calendar shows
   the day, D-3…) or not (a surprise).

   On her side, once the hour has come and she is in the house — or
   comes into it — he knocks, she opens the door to him, and they spend
   a while together (js/house/him.js); before he goes they have their
   picture taken, and he gives her what he brought: it goes into the
   house's 보관함, and his note is kept with the letters in the
   mailbox. Had she not been in the house that day, he came all the
   same: what he brought waits for her at the door, with his note.

   A visit goes where his letters go: the table `visits` in Supabase
   on the published site (tools/supabase.sql), server.py's api/visits,
   or — opened any other way (Live Server) — into this browser, where
   her side finds it at once.
   ================================================================== */

/* His hair: short, or in a perm; a fringe swept to one side, down over his brow, or parted. (me.js: SHORT_CAP) */
const HIM_STYLES = [
  { id: 'short', name: '짧은 머리', emoji: '💇‍♂️' },
  { id: 'perm', name: '펌', emoji: '🌀' },
];
const HIM_BANGS = [
  { id: 'side', name: '옆으로 넘긴', emoji: '😊' },
  { id: 'full', name: '내린 앞머리', emoji: '🙂' },
  { id: 'part', name: '가르마', emoji: '😎' },
];
/* What he can wear — all of it his (no prices: he does not play for coins). */
const HIM_WEAR = {
  top: [
    { id: 'shirt', name: '셔츠', emoji: '👔', color: 'white' },
    { id: 'tee', name: '반팔 티', emoji: '👕', color: 'navy' },
    { id: 'knit', name: '니트', emoji: '🧶', color: 'brown' },
    { id: 'hoodie', name: '후드티', emoji: '🧥', color: 'sky' },
    { id: 'cardigan', name: '카디건', emoji: '🧣', color: 'cream' },
  ],
  bottom: [
    { id: 'jeans', name: '긴 바지', emoji: '👖', color: 'denim' },
    { id: 'shorts', name: '반바지', emoji: '🩳', color: 'cream' },
  ],
  legs: [
    { id: 'ankle', name: '양말', emoji: '🧦', color: 'white' },
    { id: 'bare', name: '맨발', emoji: '🦶' },
  ],
  shoes: [
    { id: 'sneakers', name: '운동화', emoji: '👟', color: 'white' },
    { id: 'boots', name: '부츠', emoji: '🥾', color: 'brown' },
    { id: 'slippers', name: '슬리퍼', emoji: '🩴', color: 'navy' },
  ],
  head: [
    { id: 'none', name: '없음', emoji: '✖️' },
    { id: 'beret', name: '베레모', emoji: '🍂', fixed: true },
    { id: 'santa', name: '산타 모자', emoji: '🎅', fixed: true },
  ],
  glasses: [
    { id: 'none', name: '없음', emoji: '✖️' },
    { id: 'round', name: '동그란 안경', emoji: '👓', color: 'black' },
  ],
  scarf: [
    { id: 'none', name: '없음', emoji: '✖️' },
    { id: 'scarf', name: '목도리', emoji: '🧣', fixed: true },
  ],
};
const HIM_DEFAULT = {
  skin: 'warm', eyes: 'dark', shape: 'soft', style: 'short', bangs: 'side', hair: 'black',
  top: 'shirt', topColor: 'white', bottom: 'jeans', bottomColor: 'denim', legs: 'ankle', legsColor: 'white',
  shoes: 'sneakers', shoesColor: 'white', head: 'none', glasses: 'none', glassesColor: 'black', scarf: 'none',
};
const HIM_TABS = [
  ['face', '😊 얼굴'],
  ['hair', '💇‍♂️ 머리'],
  ['wear', '👕 옷'],
  ['feet', '👟 신발'],
  ['acc', '👓 소품'],
];

/* What he can bring her: things for the house (they go into its 보관함) — or nothing but his note. */
const HIM_GIFTS = [
  { id: 'bouquet', emoji: '💐', name: '꽃다발' },
  { id: 'cake', emoji: '🎂', name: '케이크' },
  { id: 'choco', emoji: '🍫', name: '하트 초콜릿' },
  { id: 'balloons', emoji: '🎈', name: '풍선' },
  { id: 'bear', emoji: '🧸', name: '곰 인형' },
  { id: 'cactus', emoji: '🌵', name: '꼬마 선인장' },
  { id: 'garland', emoji: '✨', name: '가랜드 전구' },
];
const HIM_NOTE_MAX = 300;
const HIM_NAME_MAX = 8;

/* What he says in her house. '{call}' is her name as one calls her ("소미야"), '{me}' her name, '{nick}' her nickname. */
const HIM_LINES = {
  knock: ['똑똑! 나야 💙', '똑똑똑~ {call}, 나 왔어!', '계세요~? 💙'],
  knock2: ['{call}~ 문 열어 줘! 💙', '똑똑! 나 밖에 있어~'],
  hello: ['{call}, 보고 싶어서 왔어 💙', '짜잔! 놀러 왔지 😊', '나 왔어! 집 진짜 예쁘다~', '안녕! 오늘 시간 비워 뒀지? 💙'],
  tap: ['응? 왜~? 😊', '헤헤', '{me} 집 진짜 좋다', '여기 오니까 좋다 💙', '나 여기 있어~'],
  gift: ['이거 선물이야! 🎁 마음에 들었으면 좋겠다', '짠! 너 주려고 가져왔어 🎁', '선물이야 💙 쪽지도 같이 넣었어'],
  note: ['이거 쪽지야 💌 이따 읽어 봐', '할 말이 있어서 써 왔어 💌'],
  bye: ['이제 가 볼게! 또 올게 💙', '오늘 진짜 즐거웠어. 잘 있어 👋', '아쉽다… 금방 또 올게 💙'],
  bye_night: ['늦었다! 푹 자, 잘 자 🌙', '오늘 고마웠어. 좋은 꿈 꿔 💙'],
};
/* …and what she says to him (the girl who lives there: js/avatar.js has her other lines) */
Object.assign(AVATAR_LINES, {
  him_door: ['누구세요~? 앗! 💙', '헉, 왔다! 잠깐만~ 🏃‍♀️', '네에~ 나가요!'],
  him_hello: ['왔구나! 보고 싶었어 💗', '어서 와! 💗', '우와, 진짜 왔네! 💗'],
  him_gift: ['우와, 고마워! 💗', '헉… 진짜? 너무 좋아 🥹', '감동이야… 고마워 💗'],
  him_note: ['쪽지? 고마워 💗 이따 읽을게', '꺄, 쪽지다! 💌'],
  him_bye: ['조심히 가! 또 와 💗', '오늘 고마워! 👋', '도착하면 연락해 💗'],
});
/* What they talk about, doing something together: a line of his, and her answer to it. */
const HIM_CHATS = {
  sofa: [
    ['요즘 많이 바빴지?', '응… 그래도 오늘 와 줘서 좋아 💗'],
    ['여기 앉으니까 편하다~', '그치? 내가 고른 소파야 😊'],
    ['오늘 뭐 했어?', '너 오기만 기다렸지 💗'],
    ['밥은 잘 챙겨 먹고 있어?', '응! 너도 잘 먹어 🍚'],
    ['다음에 같이 영화 보자 🎬', '좋아! 팝콘은 네가 사 오기 🍿'],
    ['여우들은 잘 지내?', '응! 다들 엄청 귀여워 🦊'],
  ],
  frame: [
    ['이 사진 우리 진짜 잘 나왔다', '이때 진짜 좋았지 💗'],
    ['이 사진 언제 찍은 거지?', '기억 안 나? 이날 엄청 웃었잖아 😆'],
    ['액자에 걸어 두니까 더 예쁘다', '매일 보려고 걸어 놨지 💗'],
  ],
  window: [
    ['밖에 하늘 예쁘다', '그치? 같이 보니까 더 좋다 💗'],
    ['창밖에 송도 보인다!', '밤에 보면 더 예뻐 ✨'],
  ],
  window_night: [
    ['달 떴다 🌙', '같이 보니까 더 예쁘다 💗'],
    ['밤에 보니까 불빛 엄청 예쁘다', '그치? 내가 좋아하는 풍경이야 ✨'],
  ],
  window_rain: [['비 온다 ☔ 우산 챙겨 올걸', '그럼 좀 더 있다 가 💗']],
  window_snow: [['눈 온다! ⛄', '나중에 같이 눈사람 만들자!']],
  dance: [
    ['이 노래 좋다! 같이 출래? 💃', '좋아! 🎶'],
    ['네 노래 나오니까 신난다', '헤헤, 같이 춤추자 💗'],
  ],
  cat: [
    ['뭉치야 안녕! 🐈', '뭉치가 너 좋아하나 봐 💗'],
    ['뭉치 털 진짜 보들보들하다', '내가 매일 빗어 줘 😊'],
  ],
  look: [
    ['집 구경해도 돼?', '물론이지! 천천히 봐 💗'],
    ['집 진짜 예쁘게 꾸몄다', '헤헤, 열심히 꾸몄어 ✨'],
  ],
  // (their picture: his "let's", her yes, and what he says after the shutter)
  photo: [['우리 사진 찍자! 📷', '좋아! 브이~ ✌️', '잘 나왔다! 💙']],
};

const HIM_DRAFT_KEY = 'dopamineWorld.visitDraft.v1'; //     what he is in the middle of planning: { on, time, note, gift, surprise }
const HIM_PENDING_KEY = 'dopamineWorld.visitPending.v1'; // a visit on its way to the box, until it has said that it has it
const HIM_EVERY = 5 * 60000; //      how often her devices look in the box…
const HIM_EVERY_HOUSE = 60000; //    …and while she is in the house (he may have said "now")
const HIM_LATE = 4 * 3600000; //     a visit at a late hour still lasts this long (past midnight, if need be)

/* ------------------------------------------------------------------
   HimLook — how he looks: kept on his device (State.him), sent with
   every visit he plans.
   ------------------------------------------------------------------ */
const HimLook = {
  tab: 'face',

  me() {
    if (!State.him || typeof State.him !== 'object') State.him = { name: '', look: {} };
    return State.him;
  },

  /** His name in her house: his own, or as config.js has it — or simply 남자친구. */
  name() {
    return String(this.me().name || CFG.boyfriendName || '남자친구').trim().slice(0, HIM_NAME_MAX) || '남자친구';
  },

  /** What he wears (ids), every slot filled in, nothing unknown. */
  look(ids = this.me().look) {
    return HimLook.clean(ids);
  },

  /** A look as it came (from his device, or from the box): only what there is, the rest as HIM_DEFAULT. */
  clean(ids) {
    const src = ids && typeof ids === 'object' ? ids : {};
    const out = { ...HIM_DEFAULT };
    const has = (list, id) => list.some((x) => x.id === id);
    if (has(AVATAR_SKINS, src.skin)) out.skin = src.skin;
    if (has(AVATAR_EYES, src.eyes)) out.eyes = src.eyes;
    if (has(AVATAR_SHAPES, src.shape)) out.shape = src.shape;
    if (has(HIM_STYLES, src.style)) out.style = src.style;
    if (has(HIM_BANGS, src.bangs)) out.bangs = src.bangs;
    if (has(AVATAR_HAIR, src.hair)) out.hair = src.hair;
    for (const slot in HIM_WEAR) {
      if (has(HIM_WEAR[slot], src[slot])) out[slot] = src[slot];
      if (has(AVATAR_COLORS, src[`${slot}Color`])) out[`${slot}Color`] = src[`${slot}Color`];
    }
    return out;
  },

  /** …for the 3D side (js/house/me.js: LOOK): every colour worked out, and a boy's face and build. */
  look3d(ids) {
    const L = this.clean(ids);
    const skin = AVATAR_SKINS.find((x) => x.id === L.skin) || AVATAR_SKINS[2];
    const eyes = AVATAR_EYES.find((x) => x.id === L.eyes) || AVATAR_EYES[1];
    const hair = AVATAR_HAIR.find((x) => x.id === L.hair) || AVATAR_HAIR[0];
    const color = (slot, fallback) => Avatar.color(L[`${slot}Color`] || (this.wear(slot, L[slot]) || {}).color, fallback);
    return {
      skin: skin.hex,
      eyes: { color: eyes.hex, shape: L.shape },
      hair: { style: L.style, bangs: L.bangs, top: hair.top, tip: hair.tip },
      top: { kind: L.top, color: color('top', 'white'), color2: '#f4efe9' },
      bottom: { kind: L.bottom, color: color('bottom', 'denim'), check: null },
      legs: { kind: L.legs, color: color('legs', 'white') },
      shoes: { kind: L.shoes, color: color('shoes', 'white') },
      head: { kind: L.head, color: '#56608f' },
      glasses: { kind: L.glasses, color: color('glasses', 'black') },
      scarf: L.scarf === 'scarf',
      boy: true,
    };
  },

  wear(slot, id) {
    return (HIM_WEAR[slot] || []).find((x) => x.id === id) || null;
  },

  /** He picked something: on at once (a new thing to wear in its own colour, unless he has chosen one for it). */
  pick(slot, id) {
    const m = this.me();
    m.look = { ...this.look(), [slot]: id };
    const w = slot in HIM_WEAR && this.wear(slot, id);
    if (w && w.color) m.look[`${slot}Color`] = w.color;
    Sfx.play('pop');
    Store.save();
    VisitDesk.lookChanged();
  },

  /** …a colour for what he has on. */
  color(slot, id) {
    const m = this.me();
    m.look = { ...this.look(), [slot]: id };
    Sfx.play('pop');
    Store.save();
    VisitDesk.lookChanged();
  },

  async askName() {
    const value = await new Promise((resolve) => {
      let done = null;
      const ov = UI.open(
        `<form class="dialog av-name" data-him-name>
          <div class="dialog-icon" aria-hidden="true">💙</div>
          <h2><label for="him-name">그녀 집에서 불릴 이름</label></h2>
          <p>말풍선 위에 이 이름이 보여요. ${HIM_NAME_MAX}글자까지 돼요.</p>
          <input id="him-name" class="ob-input" maxlength="${HIM_NAME_MAX}" value="${esc(this.name())}" autocomplete="off" enterkeyhint="done">
          <div class="dialog-actions">
            <button class="btn soft" type="button" data-ov-cancel>취소</button>
            <button class="btn primary" type="submit">바꾸기</button>
          </div>
        </form>`,
        { cls: 'is-dialog', label: '이름 바꾸기', onClose: () => resolve(done) }
      );
      const input = $('#him-name', ov.panel);
      $('[data-him-name]', ov.panel).addEventListener('submit', (e) => {
        e.preventDefault();
        done = input.value.trim().slice(0, HIM_NAME_MAX);
        UI.close(ov);
      });
      $('[data-ov-cancel]', ov.panel).addEventListener('click', () => UI.close(ov));
    });
    if (!value) return;
    this.me().name = value;
    Store.save();
    Router.refresh();
  },

  /* The options of one tab, as her drawer in the house has them (js/avatar.js: sheetHtml). */
  sheetHtml(tab) {
    const L = this.look();
    const opt = (slot, x) => {
      const on = L[slot] === x.id;
      return `<button class="av-opt ${on ? 'on' : ''}" data-action="him-pick" data-slot="${slot}" data-id="${x.id}" data-sfx="none" aria-pressed="${on}">
        <span class="av-emoji" aria-hidden="true">${x.emoji || ''}</span><b>${esc(x.name)}</b></button>`;
    };
    const opts = (slot, list) => `<div class="av-opts">${list.map((x) => opt(slot, x)).join('')}</div>`;
    const sw = (slot, list, action = 'him-pick') =>
      `<div class="av-swatches">${list
        .map((c) => {
          const bg = c.top ? `linear-gradient(160deg, ${c.top} 45%, ${c.tip})` : c.hex;
          const on = L[slot] === c.id;
          return `<button class="av-swatch ${on ? 'on' : ''}" data-action="${action}" data-slot="${slot}" data-id="${c.id}" data-sfx="none" style="--sw:${bg}" aria-label="${esc(c.name)}" title="${esc(c.name)}" aria-pressed="${on}"></button>`;
        })
        .join('')}</div>`;
    const head = (t, small = '') => `<h3 class="shop-head">${t}${small ? ` <small>${small}</small>` : ''}</h3>`;
    const wearColors = (slot) => {
      const w = this.wear(slot, L[slot]);
      return w && w.color && !w.fixed ? sw(`${slot}Color`, AVATAR_COLORS, 'him-color') : '';
    };
    if (tab === 'face') return `${head('피부')}${sw('skin', AVATAR_SKINS)}${head('눈 색')}${sw('eyes', AVATAR_EYES)}${head('눈 모양')}${opts('shape', AVATAR_SHAPES)}`;
    if (tab === 'hair') return `${head('머리 모양')}${opts('style', HIM_STYLES)}${head('앞머리')}${opts('bangs', HIM_BANGS)}${head('머리 색')}${sw('hair', AVATAR_HAIR)}`;
    if (tab === 'wear') return `${head('상의', '고르면 색도 바꿀 수 있어요')}${opts('top', HIM_WEAR.top)}${wearColors('top')}${head('하의')}${opts('bottom', HIM_WEAR.bottom)}${wearColors('bottom')}`;
    if (tab === 'feet') return `${head('양말')}${opts('legs', HIM_WEAR.legs)}${wearColors('legs')}${head('신발')}${opts('shoes', HIM_WEAR.shoes)}${wearColors('shoes')}`;
    return `${head('모자')}${opts('head', HIM_WEAR.head)}${head('안경')}${opts('glasses', HIM_WEAR.glasses)}${wearColors('glasses')}${head('목도리')}${opts('scarf', HIM_WEAR.scarf)}`;
  },
};

/* ------------------------------------------------------------------
   HisVisit — his visits: planned (his side), and come (hers).
   ------------------------------------------------------------------ */
const HisVisit = {
  fetching: null,
  lastFetch: 0,
  tries: 0,
  playing: null, //  the visit going on in the house right now (or a rehearsal of one: { test: true })
  told: '', //       the visit she was told about (that he is at the door), so as to say it once
  timer: 0,

  /** Where visits go and come from: as letters (js/post.js) — 'server', 'cloud' or 'here'. */
  box() {
    return Post.box();
  },

  /** Is this one of her devices — the ones he comes round to? */
  hers() {
    return Post.hers() && !Cloud.writer;
  },

  state() {
    const h = State.house;
    if (!h.him || typeof h.him !== 'object') h.him = { list: [], met: 0 };
    if (!Array.isArray(h.him.list)) h.him.list = [];
    return h.him;
  },

  /* ----- her side: the visits that have come to her ----- */

  list() {
    return this.state().list;
  },

  /** When a visit is over, if she has not been in: the end of its day — or, at a late hour, a few hours on. */
  endOf(v) {
    const d = new Date(v.at);
    d.setHours(24, 0, 0, 0);
    return Math.max(d.getTime(), v.at + HIM_LATE);
  },

  /** The visit whose hour has come and that is not over: he is at her door (the oldest first). */
  due(now = Date.now()) {
    if (!this.hers()) return null;
    return this.list()
      .filter((v) => !v.came && !v.opened && v.at <= now && now < this.endOf(v))
      .sort((a, b) => a.at - b.at)[0] || null;
  },

  /** What he left at her door: a visit she was not in for (or one cut short — the house closed before he gave it her). */
  left(now = Date.now()) {
    if (!this.hers()) return null;
    return this.list()
      .filter((v) => !v.opened && (v.came ? !this.playing || this.playing.id !== v.id : now >= this.endOf(v)) && (v.gift || v.note || !v.came))
      .sort((a, b) => a.at - b.at)[0] || null;
  },

  /** Ones still to come that she may know of, the soonest first. */
  coming(now = Date.now()) {
    if (!this.hers()) return [];
    return this.list()
      .filter((v) => !v.surprise && !v.came && !v.opened && now < v.at)
      .sort((a, b) => a.at - b.at);
  },

  /** For the calendar (js/days.js): the days he will come (not a surprise) and the days he came. */
  days(from, to) {
    const out = [];
    for (const v of this.list()) {
      const key = dateKey(new Date(v.at));
      if (key < from || key > to) continue;
      const who = josa(v.name || '남자친구', '이/가');
      // (once it has happened — she saw him, or what he left, or it is over — it is the day he came; before, if she may know)
      if (v.came || v.opened || Date.now() >= this.endOf(v)) out.push({ key, name: `${who} 놀러 온 날`, emoji: '💙', kind: 'visit' });
      else if (!v.surprise) out.push({ key, name: `${who} 오는 날`, emoji: '💙', kind: 'visit' });
    }
    return out;
  },

  /** His name, if he comes round on `day` (and she may know it: not a surprise — or it has happened) — or ''. */
  today(day = dateKey()) {
    const v = this.list().find((x) => dateKey(new Date(x.at)) === day && (!x.surprise || x.came || x.opened));
    return v ? v.name : '';
  },

  /** "오늘 저녁 7시" / "11월 28일 (토) 오후 7시" */
  when(at) {
    const d = new Date(at);
    const key = dateKey(d);
    const h = d.getHours();
    const m = d.getMinutes();
    const part = h < 5 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '저녁';
    const hour = `${part} ${h % 12 || 12}시${m ? ` ${m}분` : ''}`;
    const today = dateKey();
    const day = key === today ? '오늘' : key === addDays(today, 1) ? '내일' : fmtDay(key);
    return `${day} ${hour}`;
  },

  /** A visit as it came from the box (or from his device): what of it is sound. → null if it is not a visit. */
  clean(r, via) {
    if (!r || typeof r.id !== 'string' || !/^[A-Za-z0-9_-]{1,80}$/.test(r.id)) return null;
    const at = +r.at;
    if (!(at > 0)) return null;
    let look = r.look;
    if (typeof look === 'string') {
      try {
        look = JSON.parse(look);
      } catch (e) {
        look = {};
      }
    }
    look = look && typeof look === 'object' ? look : {};
    const name = String(r.name || look.name || '').trim().slice(0, HIM_NAME_MAX);
    return {
      id: r.id,
      at,
      note: typeof r.note === 'string' ? wellFormed(r.note.slice(0, HIM_NOTE_MAX)) : '',
      gift: HIM_GIFTS.some((g) => g.id === r.gift) ? r.gift : '',
      look: HimLook.clean(look),
      name: name || CFG.boyfriendName || '남자친구',
      surprise: !!r.surprise,
      sent: +r.sent || Date.now(),
      seen: +r.seen || 0,
      how: r.how === 'met' || r.how === 'missed' ? r.how : '',
      via,
    };
  },

  /** The box's visits as they are now: new ones come in, ones he called off before she saw him go. */
  take(remote) {
    const st = this.state();
    const fresh = (Array.isArray(remote) ? remote : []).map((r) => this.clean(r, this.box())).filter(Boolean);
    const ids = new Set(fresh.map((v) => v.id));
    let changed = false;
    for (const r of fresh) {
      const have = st.list.find((v) => v.id === r.id);
      if (!have) {
        // (one she has seen on another device of hers is seen here too)
        if (r.seen) Object.assign(r, { came: r.how === 'met' ? r.seen : 0, opened: r.seen, told: true });
        st.list.push(r);
        changed = true;
      } else if (!have.came && !have.opened && (have.at !== r.at || have.note !== r.note || have.gift !== r.gift || have.surprise !== r.surprise || JSON.stringify(have.look) !== JSON.stringify(r.look))) {
        Object.assign(have, { at: r.at, note: r.note, gift: r.gift, look: r.look, name: r.name, surprise: r.surprise });
        changed = true;
      } else if (r.seen && !have.opened && !(this.playing && this.playing.id === have.id)) {
        Object.assign(have, { came: have.came || (r.how === 'met' ? r.seen : 0), opened: r.seen, told: true });
        changed = true;
      }
    }
    const kept = st.list.filter((v) => v.via === 'here' || v.came || v.opened || ids.has(v.id));
    if (kept.length !== st.list.length) {
      st.list = kept;
      changed = true;
    }
    if (changed) {
      Store.save();
      this.changed();
    }
    this.report(fresh);
  },

  /** Tells the box which of them she has seen (him, or what he left), so that he can see it where he planned them. */
  report(remote) {
    if (this.box() === 'here' || !this.hers()) return;
    const known = remote ? new Map(remote.map((v) => [v.id, v])) : null;
    for (const v of this.list()) {
      if (v.via === 'here' || v.told) continue;
      const seen = v.came || v.opened;
      if (!seen) continue;
      if (known && !known.has(v.id)) continue;
      if (known && known.get(v.id).seen) {
        v.told = true;
        continue;
      }
      this.call(`visits/${encodeURIComponent(v.id)}/seen`, { method: 'POST', json: { seen, how: v.came ? 'met' : 'missed' } })
        .then(() => {
          v.told = true;
          Store.save();
        })
        .catch(() => {});
    }
  },

  async fetch(now) {
    if (this.box() === 'here' || !this.hers() || document.hidden) return;
    const every = HouseRoom.ov ? HIM_EVERY_HOUSE : HIM_EVERY;
    if (!now && Date.now() - this.lastFetch < every) return;
    if (this.fetching) return this.fetching;
    this.lastFetch = Date.now();
    this.fetching = this.call('visits')
      .then((out) => this.take(out.visits || []))
      .catch(() => {}) // (not there just now — or the table is not made yet: tools/supabase.sql)
      .finally(() => (this.fetching = null));
    return this.fetching;
  },

  /** What her side shows changed: the house (its card, the present at the door), the calendar on Home. */
  changed() {
    HouseRoom.refresh();
    HouseHost.sync();
    if (Router.is('home') || Router.is('calendar')) Router.refresh();
  },

  /**
   * Every so often (and as soon as she is in the house): a visit whose hour has come — he knocks, if he can come in now;
   * if she is not in the house, she is told that he is at the door (once).
   */
  tick() {
    this.fetch(false);
    const v = this.due();
    if (!v) return;
    if (HouseRoom.ov) return void this.knock(v);
    if (this.told !== v.id && State.onboarded) {
      this.told = v.id;
      Sfx.play('knock');
      UI.toast(`${josa(v.name, '이/가')} 집 앞에 왔어요! 🏠 ${HOUSE_NAME}에 들어가 보세요`, { icon: '💙', kind: 'gold', ms: 6000 });
      if (Router.is('home')) Router.refresh();
    }
  },

  /** He knocks — when nothing is in the way: the room not being arranged or her being dressed, no window over it, Lorelei gone. */
  knock(v) {
    if (!HouseRoom.ov || !HouseHost.api || this.playing) return false;
    if (HouseRoom.editOn || HouseRoom.meOn || UI.top() !== HouseRoom.ov || !Avatar.me().named) return false;
    if (HouseHost.api.himHere()) return false;
    if (HouseHost.api.guestHere()) {
      HouseHost.api.leave(); // (Lorelei sees there is somebody at the door: she goes, and leaves them to it)
      return false;
    }
    const ok = HouseHost.api.himArrive({ id: v.id, look: HimLook.look3d(v.look), name: v.name, gift: v.gift, note: v.note });
    if (ok) {
      this.playing = v;
      HouseRoom.setHimName(v.name);
    }
    return ok;
  },

  /* What happens in the house (js/house/him.js), a beat at a time. */
  said(what, w) {
    const v = this.playing && w && this.playing.id === w.id ? this.playing : null;
    if (!v) return;
    const test = !!v.test;
    if (what === 'knock') {
      Sfx.play('knock');
      if (!v.came) {
        UI.toast(`똑똑! ${josa(v.name, '이/가')} 놀러 왔어요 💙`, { icon: '🚪', kind: 'gold', ms: 3600 });
        if (!test) {
          v.came = Date.now();
          this.state().met = (this.state().met || 0) + 1;
          Diary.note('himVisit');
          Store.save();
          this.report();
          Game.checkAchievements();
        } else v.came = Date.now();
      }
      return;
    }
    if (what === 'photo') {
      if (test) return void UI.toast('미리 보기라서 사진은 간직하지 않아요 📷', { icon: '📷' });
      House.snap({ toast: `${josa(v.name, '과/와')} 같이 찍은 사진을 사진첩에 간직했어요 💙`, names: [v.name, Avatar.name()] });
      return;
    }
    if (what === 'gift') return void this.receive(v);
    if (what === 'gone' || what === 'cut') {
      this.playing = null;
      if (v.came && !v.opened && !v.gift && !v.note) v.opened = Date.now(); // (he brought nothing: there is nothing to wait at the door)
      if (!test) Store.save();
      this.changed();
      HouseRoom.refresh();
    }
  },

  /** What he brought: into the 보관함 (always — a present of his is never turned into coins), and his note shown and kept. */
  receive(v) {
    const first = !v.opened;
    if (first) v.opened = Date.now();
    const gift = v.gift && HIM_GIFTS.find((g) => g.id === v.gift);
    const item = gift && House.item(gift.id);
    if (first && !v.test) {
      if (item) {
        State.house.stored.push(item.id);
        Diary.add('houseNew', item.name);
      }
      Store.save();
      this.report();
      HouseHost.sync();
      HouseRoom.refresh();
      Game.checkAchievements();
    }
    const note = v.note ? `<div class="him-note"><p>${esc(v.note)}</p><small>— 💙 ${esc(v.name)}</small></div>` : '';
    if (item) {
      UI.celebrate({
        emoji: gift.emoji,
        title: `${v.name}의 선물`,
        subtitle: v.test ? '미리 보기예요 — 선물은 보관함에 들어가지 않아요' : `${josa(item.name, '이/가')} 보관함에 들어왔어요!`,
        extraHtml: note,
        buttons: v.test ? [{ label: '고마워 💗', primary: true }] : [{ label: '🛋️ 지금 놓아 보기', primary: true, onClick: () => HouseRoom.ov && !HouseHost.api.himHere() && (HouseRoom.setEdit(true), House.putOut(item.id)) }, { label: '고마워 💗' }],
      });
    } else if (v.note) this.openNote(v);
  },

  /** His note on its paper: who it is from, and the day he came. */
  openNote(v) {
    Sfx.play('heart');
    UI.open(
      `<div class="message-modal">
        <div class="env-anim" aria-hidden="true">💙</div>
        <p class="new-badge">📝 ${esc(josa(v.name, '이/가'))} 두고 간 쪽지</p>
        <div class="letter is-post big him-letter">
          <div class="letter-from">💙 ${esc(v.name)}의 쪽지</div>
          <p class="letter-text">${esc(v.note)}</p>
          <div class="letter-date">${fmtDateLong(v.at)}</div>
        </div>
        <div class="dialog-actions one"><button class="btn primary" data-action="close-overlay">💗 고마워</button></div>
      </div>`,
      { cls: 'is-dialog is-post', label: '남자친구가 두고 간 쪽지' }
    );
  },

  /** The notes he left, the newest first (for the mailbox in the house). */
  notes() {
    return this.list()
      .filter((v) => v.note && v.opened)
      .sort((a, b) => b.at - a.at);
  },

  /** What he left at her door, as the house's present by the door has it (js/house.js: giftWaiting). */
  parcel() {
    const v = this.left();
    if (!v) return null;
    const gift = v.gift && HIM_GIFTS.find((g) => g.id === v.gift);
    return { key: `him:${v.id}`, id: gift ? gift.id : 'note', event: { emoji: '💙', name: `${v.name}의`, kind: 'visit' }, him: v };
  },

  /** …she opens it. (One with nothing in it — he came while she was out, and brought nothing — only says he came.) */
  openParcel(v) {
    if (v.gift || v.note) return this.receive(v);
    v.opened = Date.now();
    Store.save();
    this.report();
    this.changed();
    UI.toast(`${josa(v.name, '이/가')} 다녀갔어요 💙`, { icon: '🏠' });
  },

  /** A word on the house's card on Home (or ''): he is at the door; he came and left something; he comes today. */
  cardNote() {
    const v = this.due();
    if (v) return { text: `💙 ${josa(v.name, '이/가')} 집 앞에 와 있어요!`, hot: true };
    const left = this.left();
    if (left) return { text: `💙 ${josa(left.name, '이/가')} 다녀갔어요. 문 앞에 뭔가 두고 갔어요`, hot: true };
    const next = this.coming()[0];
    if (next && dateKey(new Date(next.at)) === dateKey()) return { text: `💙 ${this.when(next.at)}에 ${josa(next.name, '이/가')} 놀러 와요`, hot: false };
    return null;
  },

  /** The house has opened: a word about what he left — and, if his hour has come, his knock a little after. */
  entered() {
    this.fetch(true);
    const left = this.left();
    if (left && !this.due()) setTimeout(() => HouseRoom.ov && UI.toast(`${josa(left.name, '이/가')} 다녀갔대요! 문 앞을 봐요 💙`, { icon: '🎁', ms: 4200 }), 2600);
  },

  /** The house has closed: a visit going on is cut short (what he brought waits at the door). */
  closed() {
    const v = this.playing;
    this.playing = null;
    if (v && !v.test) Store.save();
  },

  /* ----- his side: planning them ----- */

  call(path, o = {}) {
    if (this.box() === 'cloud') return Cloud.visits(path, o);
    return Post.call(path, o); // (server.py answers api/visits as it answers api/letters)
  },

  draft() {
    try {
      const d = JSON.parse(localStorage.getItem(HIM_DRAFT_KEY) || '{}');
      return {
        on: /^\d{4}-\d{2}-\d{2}$/.test(d.on) ? d.on : '',
        time: /^\d{2}:\d{2}$/.test(d.time) ? d.time : '19:00',
        note: typeof d.note === 'string' ? d.note : '',
        gift: HIM_GIFTS.some((g) => g.id === d.gift) ? d.gift : '',
        surprise: !!d.surprise,
      };
    } catch (e) {
      return { on: '', time: '19:00', note: '', gift: '', surprise: false };
    }
  },

  keepDraft(d) {
    try {
      if (d) localStorage.setItem(HIM_DRAFT_KEY, JSON.stringify(d));
      else localStorage.removeItem(HIM_DRAFT_KEY);
    } catch (e) {
      /* private mode: the draft lives as long as the page */
    }
  },

  pending() {
    try {
      const p = JSON.parse(localStorage.getItem(HIM_PENDING_KEY) || 'null');
      return p && typeof p.id === 'string' ? p : null;
    } catch (e) {
      return this.onItsWay || null;
    }
  },

  keepPending(v) {
    this.onItsWay = v;
    try {
      if (v) localStorage.setItem(HIM_PENDING_KEY, JSON.stringify(v));
      else localStorage.removeItem(HIM_PENDING_KEY);
    } catch (e) {
      /* private mode */
    }
  },

  /** Plans a visit ({ at, note, gift, surprise }) with how he looks now. Resolves the box it went into; throws as Post.call does. */
  async send(plan) {
    const look = { ...HimLook.look(), name: HimLook.name() };
    const body = { at: plan.at, note: wellFormed(String(plan.note || '').slice(0, HIM_NOTE_MAX)), gift: plan.gift || '', surprise: !!plan.surprise, look, name: look.name };
    if (this.box() === 'here') {
      const v = this.clean({ ...body, id: uid('v'), sent: Date.now() }, 'here');
      this.state().list.push(v);
      Store.save();
      this.changed();
      return 'here';
    }
    // (sent again after an answer that got lost: the same visit — with the same id — not a second one)
    const was = this.pending();
    const same = was && was.at === body.at && was.note === body.note && was.gift === body.gift && was.surprise === body.surprise;
    const v = same ? was : { ...body, id: uid('v'), sent: Date.now() };
    this.keepPending(v);
    await this.call('visits', { method: 'POST', json: v });
    this.keepPending(null);
    if (this.hers()) this.fetch(true);
    return this.box();
  },

  /** Calls one off, as long as she has not seen him yet. */
  async unsend(id) {
    if (this.box() !== 'here') await this.call(`visits/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const st = this.state();
    const before = st.list.length;
    st.list = st.list.filter((v) => v.id !== id || v.came || v.opened);
    if (st.list.length !== before) {
      Store.save();
      this.changed();
    }
  },

  /** What he has planned, the newest first, each with whether she has seen him. */
  async sent() {
    if (this.box() === 'here') return this.list().slice().sort((a, b) => b.at - a.at);
    const out = await this.call('visits');
    return (Array.isArray(out.visits) ? out.visits : [])
      .map((r) => this.clean(r, this.box()))
      .filter(Boolean)
      .sort((a, b) => b.at - a.at);
  },

  /* ----- a rehearsal: what she would see, in the house on this device, nothing saved ----- */

  async test(o = {}) {
    if (!HouseRoom.ov) {
      await HouseRoom.open();
      await sleep(400);
    }
    const end = Date.now() + 20000;
    while (Date.now() < end) {
      const v = { id: `test_${Date.now().toString(36)}`, at: Date.now(), note: o.note || '', gift: o.gift || '', look: HimLook.look(), name: HimLook.name(), test: true };
      if (HouseRoom.ov && HouseHost.api && UI.top() === HouseRoom.ov && Avatar.me().named) {
        this.playing = null;
        if (this.knock(v)) return true;
      }
      await sleep(700);
    }
    UI.toast('지금은 미리 볼 수 없어요. 집에서 하던 걸 끝내고 다시 해 보세요', { icon: '👀' });
    return false;
  },

  start() {
    this.fetch(true);
    this.timer = setInterval(() => this.tick(), 15000);
    document.addEventListener('visibilitychange', () => document.hidden || this.tick());
    setTimeout(() => this.tick(), 1500);
  },

  /** His lines (and, with `him_` kinds, hers): the placeholders filled in. */
  line(kind) {
    let k = kind;
    if (kind === 'bye') {
      const h = new Date().getHours();
      if (h >= 22 || h < 5) k = 'bye_night';
    }
    const list = HIM_LINES[k] || HIM_LINES[kind];
    if (!list || !list.length) return '';
    return this.fill(pick(list));
  },

  fill(text) {
    const me = Avatar.name();
    return String(text)
      .replace(/\{call\}/g, josa(me, '아/야'))
      .replace(/\{me\}/g, me)
      .replace(/\{nick\}/g, State.user.nickname || '너')
      .replace(/\{him\}/g, (this.playing && this.playing.name) || HimLook.name());
  },

  /** A line of his about doing `kind` together, and her answer — `i` of the visit's talk about it (each pair once a visit). */
  chat(kind, i = 0) {
    let k = kind;
    if (kind === 'window') {
      const w = House.weather();
      if (w.kind === 'rain') k = 'window_rain';
      else if (w.kind === 'snow') k = 'window_snow';
      else if (Moon.dark()) k = 'window_night';
    }
    const list = HIM_CHATS[k] || HIM_CHATS[kind];
    if (!list || !list.length) return null;
    const v = this.playing || {};
    // (a different pair each time within one visit; which pairs, the visit's own)
    const start = hashStr(`${v.id || ''}:${k}`) % list.length;
    return list[(start + i) % list.length].map((t) => this.fill(t));
  },

  /** His name, while he is round in the house — or ''. */
  here() {
    return HouseHost.api && HouseHost.api.himHere() ? (this.playing && this.playing.name) || HimLook.name() : '';
  },

  /** While a window of the app is over the house (his present, his note), he waits. */
  holding() {
    return !!HouseRoom.ov && UI.top() !== HouseRoom.ov;
  },
};

/* ------------------------------------------------------------------
   🏠 놀러 가기 — #/me/visit, behind the same door as his letters
   (Door in js/views/me.js): how he looks (turned round in 3D), and
   his visit — when, a note, a present, a surprise or not.
   ------------------------------------------------------------------ */
const VisitDesk = {
  list: null, //   what he has planned so far (null: not fetched yet), or { error }
  busy: false,
  portrait: null,
  loading: null,

  html() {
    if (!Door.isOpen) return Door.html('🏠 놀러 가기', '쉿… 여기는 남자친구만 들어오는 곳이에요.', '남자친구가 아바타를 꾸미고, 그녀의 집에 놀러 갈 날을 정하는 곳이에요.');
    if (Post.box() === 'cloud' && !Cloud.writer) {
      return `<section class="me-sub visit-desk">
        ${subHead('🏠 놀러 가기')}
        <div class="card center">
          <div class="empty-icon" aria-hidden="true">💙</div>
          <h2>놀러 가기는 남자친구 로그인으로 해요</h2>
          <p class="hint">이 기기는 그녀의 로그인으로 들어와 있어요. 남자친구가 자기 로그인으로 들어온 기기에서 정하면, 그날 이 기기의 집으로 놀러 와요.</p>
        </div>
      </section>`;
    }
    const d = HisVisit.draft();
    const today = dateKey();
    const tab = HimLook.tab;
    const where = Post.box() === 'cloud'
      ? '약속하면 그녀가 로그인한 기기로 가요. 그 시간에 그녀가 집에 들어와 있으면 노크하고, 없었으면 문 앞에 선물과 쪽지를 두고 와요.'
      : Post.box() === 'server'
        ? '약속하면 저장 서버를 거쳐 그녀의 기기로 가요.'
        : '이 브라우저 안에서만 오가요 (클라우드로 연 공개 사이트에서는 그녀의 기기로 가요).';
    return `<section class="me-sub visit-desk">
      ${subHead('🏠 놀러 가기')}
      <div class="card him-card">
        <div class="him-stage" data-him-stage aria-label="내 아바타 미리 보기. 손가락으로 돌려 볼 수 있어요" role="img"><span class="him-wait" aria-hidden="true">💙</span></div>
        <button class="av-name-row" data-action="him-name"><span aria-hidden="true">💙</span><b>${esc(HimLook.name())}</b><small>이름 바꾸기 ✏️</small></button>
        <div class="seg fd-tabs him-tabs" role="tablist" aria-label="아바타 꾸미기">
          ${HIM_TABS.map(([id, label]) => `<button class="seg-btn ${id === tab ? 'on' : ''}" role="tab" aria-selected="${id === tab}" data-action="him-tab" data-tab="${id}">${label}</button>`).join('')}
        </div>
        <div class="him-opts" data-him-opts>${HimLook.sheetHtml(tab)}</div>
      </div>
      <div class="card him-plan">
        <div class="set-block"><span id="him-when">📅 언제 갈까요?</span>
          <div class="seg" role="radiogroup" aria-labelledby="him-when">
            <button class="seg-btn ${d.on ? '' : 'on'}" role="radio" aria-checked="${!d.on}" data-action="him-when" data-v="now">지금 바로</button>
            <button class="seg-btn ${d.on ? 'on' : ''}" role="radio" aria-checked="${!!d.on}" data-action="him-when" data-v="day">날짜 정하기</button>
          </div>
          ${d.on ? `<div class="him-day"><input class="ob-input" type="date" data-change="him-day" min="${today}" value="${esc(d.on)}" aria-label="놀러 갈 날짜">
            <input class="ob-input" type="time" data-change="him-time" value="${esc(d.time)}" aria-label="놀러 갈 시간"></div>
            <p class="hint">${esc(HisVisit.when(this.atOf(d)))}에 노크해요. 그날 밤 12시까지(늦은 시간이면 네 시간 동안) 그녀가 집에 들어오면 만나요.</p>` : '<p class="hint">그녀가 지금 집에 있으면 1분 안에 노크해요. 오늘 안에 들어오면 만나요.</p>'}
        </div>
        <label class="card-title" for="him-note">💌 쪽지 <small>(없어도 돼요)</small></label>
        <textarea id="him-note" class="post-text him-note-input" data-him-note data-input="him-note" rows="4" maxlength="${HIM_NOTE_MAX}" placeholder="선물이랑 같이 건넬 짧은 쪽지">${esc(d.note)}</textarea>
        <p class="post-count hint"><span data-him-count>${d.note.length}</span> / ${HIM_NOTE_MAX}자</p>
        <h3 class="shop-head">🎁 선물</h3>
        <div class="av-opts him-gifts">
          <button class="av-opt ${d.gift ? '' : 'on'}" data-action="him-gift" data-id="" aria-pressed="${!d.gift}"><span class="av-emoji" aria-hidden="true">💌</span><b>쪽지만</b></button>
          ${HIM_GIFTS.map((g) => `<button class="av-opt ${d.gift === g.id ? 'on' : ''}" data-action="him-gift" data-id="${g.id}" aria-pressed="${d.gift === g.id}"><span class="av-emoji" aria-hidden="true">${g.emoji}</span><b>${esc(g.name)}</b></button>`).join('')}
        </div>
        <p class="hint">선물은 그녀 집의 보관함에 들어가요.</p>
        <div class="set-block"><span id="him-surprise">🤫 미리 알려 줄까요?</span>
          <div class="seg" role="radiogroup" aria-labelledby="him-surprise">
            <button class="seg-btn ${d.surprise ? '' : 'on'}" role="radio" aria-checked="${!d.surprise}" data-action="him-surprise" data-v="0">달력에 표시</button>
            <button class="seg-btn ${d.surprise ? 'on' : ''}" role="radio" aria-checked="${d.surprise}" data-action="him-surprise" data-v="1">깜짝 방문</button>
          </div>
          <p class="hint">${d.surprise ? '그 시간까지 그녀는 몰라요. 노크 소리로 알게 돼요.' : '그녀의 달력과 홈에 그날이 보여요 (D-3처럼).'}</p>
        </div>
        <p class="hint">${where}</p>
        <div class="dialog-actions">
          <button class="btn soft" data-action="him-preview">👀 미리 보기</button>
          <button class="btn primary" data-action="him-send">💙 놀러 가기</button>
        </div>
      </div>
      <div class="card">
        <h2 class="card-title">📮 약속한 방문</h2>
        <div data-him-sent>${this.sentHtml()}</div>
      </div>
      <a class="btn ghost wide" href="#/me/write">✍️ 편지 쓰기로</a>
    </section>`;
  },

  /** When the draft says (ms) — now, if it says no day. */
  atOf(d) {
    if (!d.on) return Date.now();
    const [y, m, day] = d.on.split('-').map(Number);
    const [hh, mm] = d.time.split(':').map(Number);
    return new Date(y, m - 1, day, hh, mm, 0, 0).getTime();
  },

  sentHtml() {
    const list = this.list;
    if (!list) return '<p class="hint">불러오는 중…</p>';
    if (list.error === 'locked') return '<p class="hint">서버 비밀번호를 넣으면 보여요. 편지 쓰기에서 한 번 넣어 주세요.</p>';
    if (list.error === 'missing') return '<p class="hint">⚠️ 클라우드에 방문 표(visits)가 아직 없어요. Supabase의 SQL Editor에서 tools/supabase.sql을 한 번 실행해 주세요.</p>';
    if (list.error) return `<p class="hint">지금은 ${Post.boxName()}에 닿지 않아요. 잠시 뒤에 다시 열어 주세요.</p>`;
    if (!list.length) return '<p class="hint">아직 약속한 방문이 없어요.</p>';
    const now = Date.now();
    return `<ul class="post-sent">${list
      .slice(0, 20)
      .map((v) => {
        const gift = v.gift && HIM_GIFTS.find((g) => g.id === v.gift);
        const met = v.how === 'met' || (v.via === 'here' && v.came);
        const missed = v.how === 'missed' || (v.via === 'here' && !v.came && v.opened);
        const state = met
          ? '<span class="chip chip-done">✓ 만났어요</span>'
          : missed
            ? '<span class="chip chip-done">✓ 다녀갔어요</span>'
            : v.at > now
              ? `<span class="chip">${v.surprise ? '🤫 깜짝' : '📅 약속'}</span>`
              : now < HisVisit.endOf(v)
                ? '<span class="chip chip-hot">🚪 그녀를 기다리는 중</span>'
                : '<span class="chip">🎁 문 앞에 두고 옴</span>';
        const seen = met || missed;
        return `<li>
          <div class="post-row">
            <span class="post-meta">${esc(HisVisit.when(v.at))} ${state}</span>
            <span class="post-peek">${gift ? `${gift.emoji} ${esc(gift.name)}` : '💌 쪽지만'}${v.note ? ` · ${esc(v.note.replace(/\s+/g, ' ').slice(0, 40))}` : ''}</span>
          </div>
          ${seen ? '' : `<button class="icon-btn small" data-action="him-unsend" data-id="${esc(v.id)}" aria-label="이 방문 취소">🗑️</button>`}
        </li>`;
      })
      .join('')}</ul>`;
  },

  async load() {
    if (Post.box() === 'cloud' && !Cloud.writer) return;
    try {
      this.list = await HisVisit.sent();
    } catch (e) {
      this.list = { error: /relation|does not exist|PGRST205|404/.test(String(e.message)) ? 'missing' : e.code || 'offline' };
    }
    const el = $('[data-him-sent]');
    if (el) el.innerHTML = this.sentHtml();
  },

  /** The page is up: his figure in 3D, turning, and what he has planned. */
  mount(root) {
    if (!Door.isOpen || (Post.box() === 'cloud' && !Cloud.writer)) return;
    this.load();
    const stage = $('[data-him-stage]', root);
    if (!stage) return;
    if (this.portrait) return void this.portrait.attach(stage); // (the page drawn again: the same figure, in its new place)
    const look = () => HimLook.look3d(HimLook.look());
    if (!this.loading) this.loading = import(new URL('js/house/portrait.js', document.baseURI).href).catch((err) => console.error('[him] the 3D figure could not be loaded', err));
    this.loading.then((mod) => {
      if (!mod || !stage.isConnected || this.portrait) return;
      try {
        this.portrait = mod.mountPortrait(stage, look());
      } catch (err) {
        console.warn('[him] no 3D figure here', err);
      }
    });
  },

  /** …and gone (another page): the figure's WebGL goes with it. */
  drop() {
    if (this.portrait) this.portrait.dispose();
    this.portrait = null;
  },

  lookChanged() {
    const box = $('[data-him-opts]');
    if (box) box.innerHTML = HimLook.sheetHtml(HimLook.tab);
    if (this.portrait) this.portrait.set(HimLook.look3d(HimLook.look()));
  },

  read() {
    const ta = $('[data-him-note]');
    const d = HisVisit.draft();
    return { ...d, note: (ta ? ta.value : d.note).trim() };
  },

  keep(changes) {
    const ta = $('[data-him-note]');
    HisVisit.keepDraft({ ...HisVisit.draft(), note: ta ? ta.value : HisVisit.draft().note, ...changes });
  },

  async send() {
    if (this.busy) return;
    const d = this.read();
    const at = this.atOf(d);
    if (d.on && at < Date.now() - 60000) return UI.toast('그 시간은 이미 지났어요. 날짜나 시간을 다시 골라 주세요', { icon: '📅' });
    this.busy = true;
    try {
      await HisVisit.send({ at: d.on ? at : Date.now(), note: d.note, gift: d.gift, surprise: d.surprise });
      HisVisit.keepDraft({ ...HisVisit.draft(), note: '', gift: '' });
      Sfx.play('reward');
      UI.toast(d.on ? `${HisVisit.when(at)}에 놀러 가기로 했어요 💙` : '지금 놀러 가요! 그녀가 집에 있으면 곧 노크해요 💙', { icon: '🏠', ms: 4200 });
      this.list = null;
      Router.refresh();
    } catch (e) {
      const missing = /relation|does not exist|PGRST205|404/.test(String(e.message));
      UI.toast(missing ? '클라우드에 방문 표가 아직 없어요. tools/supabase.sql을 먼저 실행해 주세요' : e.code === 'offline' ? `지금은 ${Post.boxName()}에 닿지 않아요. 잠시 뒤에 다시 해 주세요` : '약속을 보내지 못했어요. 잠시 뒤에 다시 해 주세요', { icon: '⚠️', ms: 5200 });
    } finally {
      this.busy = false;
    }
  },
};

Object.assign(Actions, {
  'him-tab': (el) => {
    HimLook.tab = el.dataset.tab;
    $$('[data-action="him-tab"]').forEach((b) => {
      b.classList.toggle('on', b.dataset.tab === HimLook.tab);
      b.setAttribute('aria-selected', String(b.dataset.tab === HimLook.tab));
    });
    const box = $('[data-him-opts]');
    if (box) box.innerHTML = HimLook.sheetHtml(HimLook.tab);
  },
  'him-pick': (el) => HimLook.pick(el.dataset.slot, el.dataset.id),
  'him-color': (el) => HimLook.color(el.dataset.slot, el.dataset.id),
  'him-name': () => HimLook.askName(),
  'him-when': (el) => {
    const d = HisVisit.draft();
    VisitDesk.keep({ on: el.dataset.v === 'day' ? d.on || dateKey() : '' });
    Router.refresh();
  },
  'him-gift': (el) => {
    VisitDesk.keep({ gift: el.dataset.id || '' });
    $$('[data-action="him-gift"]').forEach((b) => {
      const on = (b.dataset.id || '') === (el.dataset.id || '');
      b.classList.toggle('on', on);
      b.setAttribute('aria-pressed', String(on));
    });
    Sfx.play('pop');
  },
  'him-surprise': (el) => {
    VisitDesk.keep({ surprise: el.dataset.v === '1' });
    Router.refresh();
  },
  'him-send': () => VisitDesk.send(),
  'him-preview': () => {
    const d = VisitDesk.read();
    HisVisit.test({ note: d.note, gift: d.gift });
  },
  'him-unsend': async (el) => {
    const ok = await UI.confirm({ icon: '🗑️', title: '이 방문을 취소할까요?', text: '아직 그녀가 보기 전이라서 취소할 수 있어요.', ok: '방문 취소', danger: true });
    if (!ok) return;
    try {
      await HisVisit.unsend(el.dataset.id);
      UI.toast('방문을 취소했어요', { icon: '🗑️' });
    } catch (e) {
      UI.toast(e.code === 'refused' ? '그사이에 그녀가 봐서 취소할 수 없어요' : `지금은 ${Post.boxName()}에 닿지 않아요`, { icon: '⚠️' });
    }
    VisitDesk.load();
  },
  'him-note-open': (el) => {
    const v = HisVisit.list().find((x) => x.id === el.dataset.id);
    if (v) HisVisit.openNote(v);
  },
});

Object.assign(Inputs, {
  'him-note': (el) => {
    VisitDesk.keep({});
    const n = $('[data-him-count]');
    if (n) n.textContent = el.value.length;
  },
});

Object.assign(Changes, {
  'him-day': (el) => {
    VisitDesk.keep({ on: /^\d{4}-\d{2}-\d{2}$/.test(el.value) ? el.value : HisVisit.draft().on });
    Router.refresh();
  },
  'him-time': (el) => {
    VisitDesk.keep({ time: /^\d{2}:\d{2}$/.test(el.value) ? el.value : HisVisit.draft().time });
    Router.refresh();
  },
});

// (off the page: his figure's canvas goes)
window.addEventListener('hashchange', () => {
  if (!/^#\/me\/visit\b/.test(location.hash)) VisitDesk.drop();
});
