'use strict';
/* ==================================================================
   📔 하루 끝 한 장 — a page of a diary for every day.

   What she does on the site is noted down a day at a time (Diary.note
   and friends, called from where it happens): the songs she sang, the
   games, the foxes she patted and fed, the pictures she took, his
   letters… From 22:00 that day's page is ready — Home says so: her
   day, written out on a page of a notebook. She picks how the day felt,
   puts stickers on it (js/stickers.js), a line of her own if she likes,
   and it is kept (State.diary.pages). A day of the diary runs from
   05:00 to 05:00: what she does after midnight still belongs to the
   evening before.

   Once a month is over its pages become a little album, "10월의 우리":
   she is told so, and it opens from her diary (나 → 일기장, #/diary).

   A page is drawn on a canvas (Diary.paint) — on the screen and in the
   pictures she saves — and only what she wrote, chose and stuck on is
   kept, with the lines as they were written: the record of what she
   did is thrown away after DIARY_LOG_DAYS days.
   ================================================================== */

const DIARY_DAY_STARTS = 5; // a day of the diary runs from 05:00…
const DIARY_OPENS = 22; //     …and its page is ready from 22:00
const DIARY_LOG_DAYS = 40; //  what she did is kept this long for pages not written yet
const DIARY_MISSED = 6; //     a day she did not write: it can still be written for this many days
const PAGE_W = 1080;
const PAGE_H = 1440;
const HAND = (size) => `700 ${size}px Gaegu, Jua, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`; // her handwriting
const OPENS_AT = `밤 ${DIARY_OPENS > 12 ? DIARY_OPENS - 12 : DIARY_OPENS}시`; // '밤 10시'

const MOODS = [
  { e: '😊', name: '좋았어요' },
  { e: '🥰', name: '설렜어요' },
  { e: '😆', name: '신났어요' },
  { e: '😌', name: '편안했어요' },
  { e: '😴', name: '피곤했어요' },
  { e: '😐', name: '그저 그랬어요' },
  { e: '😢', name: '슬펐어요' },
  { e: '😤', name: '속상했어요' },
];

/* ‘제목’을 · ‘제목’이 — a name in quotes, and the particle that goes after it. */
const quoted = (word, pair) => `‘${word}’${josa(word, pair).slice(String(word).trim().length)}`;

const Diary = {
  ov: null, //       the page that is open: its overlay
  drafts: {}, //     day → a page she began and left without keeping it (until the page is reloaded)
  pics: new Map(), // photo id → Promise of { bmp, rec } (for the snapshot on a page)

  /* ----- days ----- */
  /** The day of the diary a moment belongs to ('YYYY-MM-DD'). */
  dayOf(t = Date.now()) {
    return dateKey(new Date(t - DIARY_DAY_STARTS * 3600000));
  },
  today() {
    return this.dayOf();
  },
  /** Is today's page ready — is it evening (or the small hours that still belong to it)? */
  isOpen(now = new Date()) {
    const h = now.getHours();
    return h >= DIARY_OPENS || h < DIARY_DAY_STARTS;
  },
  /** How long until it is: seconds. */
  opensIn(now = new Date()) {
    const at = new Date(now);
    at.setHours(DIARY_OPENS, 0, 0, 0);
    return Math.max(0, Math.round((at - now) / 1000));
  },
  /** '10월 22일 수요일' */
  dayName(day) {
    const [y, m, d] = day.split('-').map(Number);
    return `${y === new Date().getFullYear() ? '' : `${y}년 `}${m}월 ${d}일 ${WEEKDAYS[weekdayOf(day)]}요일`;
  },
  /** Somebody is here whose day it is: she has been welcomed, and it is not his login (js/gate.js). */
  writable() {
    return State.onboarded && !Cloud.writer;
  },

  /* ----- what she did ----- */
  entry() {
    const log = State.diary.log;
    const day = this.today();
    return log[day] || (log[day] = {});
  },
  /** Count something she did today: `kind` goes up by `n`. */
  note(kind, n = 1) {
    if (Cloud.writer) return; // (his login: what he does here is not her day)
    const d = this.entry();
    d[kind] = (d[kind] || 0) + n;
    Store.save();
  },
  /** …and a thing that has a name: a cover she saved, a gift a fox brought (each once, a few of them). */
  add(kind, item) {
    if (Cloud.writer || item == null || item === '') return;
    const d = this.entry();
    const list = d[kind] || (d[kind] = []);
    if (!list.includes(item) && list.length < 8) list.push(item);
    Store.save();
  },
  /** …and which one, of things she does several of (which games). */
  tally(kind, key) {
    if (Cloud.writer) return;
    const d = this.entry();
    const t = d[kind] || (d[kind] = {});
    t[key] = (t[key] || 0) + 1;
    Store.save();
  },
  /** …and a thing of which only the last counts (the newest picture of the day). */
  put(kind, value) {
    if (Cloud.writer) return;
    this.entry()[kind] = value;
    Store.save();
  },

  /* The record of days long gone goes; their pages stay. */
  prune() {
    const oldest = addDays(this.today(), -DIARY_LOG_DAYS);
    Object.keys(State.diary.log).forEach((day) => day < oldest && delete State.diary.log[day]);
  },

  achievementsOn(day) {
    return ACHIEVEMENTS.filter((a) => State.achievements[a.id] && this.dayOf(new Date(State.achievements[a.id]).getTime()) === day);
  },

  /** Her day in words: [{ e: emoji, t: text }] — most worth telling first. */
  lines(day) {
    const d = State.diary.log[day] || {};
    const out = [];
    const add = (e, t) => out.push({ e, t });
    const fox = State.pet.name;
    const times = (n) => (n > 1 ? `${n}번 ` : ''); // ('2번 줬어요', but once is just '줬어요')
    const covers = d.covers || [];
    if (covers.length === 1) add('💿', `${quoted(covers[0], '을/를')} 커버로 발매했어요`);
    else if (covers.length === 2) add('💿', `‘${covers[0]}’, ${quoted(covers[1], '을/를')} 커버로 발매했어요`);
    else if (covers.length) add('💿', `‘${covers[0]}’ 외 ${covers.length - 1}곡을 커버로 발매했어요`);
    if (d.sang) add('🎤', `노래를 ${fmtDuration(d.sang)} 동안 불렀어요${d.takes > 1 ? ` (녹음 ${d.takes}번)` : ''}`);
    if (d.albums) add('📀', '새 앨범을 만들었어요');
    if (d.lps && d.lps.length) add('💿', `${quoted(d.lps[0], '을/를')} LP로 구웠어요`);
    if (d.lp) add('🎶', '턴테이블에 LP를 올려서 들었어요');
    if (d.letters) add('💌', d.letters > 1 ? `편지를 ${d.letters}통 받았어요` : `${CFG.boyfriendName || '남자친구'}의 편지를 받았어요`);
    if (d.radio) add('📻', `여우 라디오로 내 노래를 ${d.radio}곡 들었어요`);
    else if (d.listens) add('🎧', `내 커버를 ${times(d.listens)}들었어요`);
    if (d.pets && d.feeds) add('🦊', `${josa(fox, '을/를')} ${times(d.pets)}쓰다듬고, 밥도 ${times(d.feeds)}줬어요`);
    else if (d.pets) add('🦊', `${josa(fox, '을/를')} ${times(d.pets)}쓰다듬어 줬어요`);
    else if (d.feeds) add('🦊', `${fox}에게 밥을 ${times(d.feeds)}줬어요`);
    else if (d.visits) add('🦊', `여우 세상에 ${josa(fox, '을/를')} 만나러 갔어요`);
    if (d.plays) add('🎾', '여우들이랑 공놀이를 했어요');
    if (d.concerts) add('🪩', '여우들에게 내 커버를 들려줬어요');
    if (d.photos) add('📷', `여우 사진을 ${d.photos}장 찍었어요`);
    if (d.fourcut) add('🎞️', '여우들이랑 네 컷 사진을 찍었어요');
    if (d.knit) add('🧶', '그림을 그려서 여우 스웨터를 떴어요');
    (d.gifts || []).slice(0, 2).forEach((g) => add('🧭', `탐험 간 여우가 ${quoted(g, '을/를')} 물어 왔어요`));
    if (d.houseGuest) add('👧', `${josa(OWNER_NAME, '이/가')} 둘의 집에 놀러 왔어요`);
    const fresh = d.houseNew || [];
    if (fresh.length) add('🛋️', `둘의 집에 ${fresh.length > 1 ? `‘${fresh[0]}’ 외 ${fresh.length - 1}개를` : quoted(fresh[0], '을/를')} 들였어요`);
    else if (d.house) add('🏠', '둘의 집에 들렀어요');
    const wear = d.meWear || [];
    if (wear.length) add('👗', `${wear.length > 1 ? `‘${wear[0]}’ 외 ${wear.length - 1}개를` : quoted(wear[0], '을/를')} 새로 사서 입었어요`);
    const food = d.food || [];
    if (food.length) add('🛵', `${food.length > 1 ? `‘${food[0]}’ 외 ${food.length - 1}개를` : quoted(food[0], '을/를')} 배달시켜 먹었어요`);
    const cooked = d.cook || [];
    if (cooked.length) add('🍳', `${cooked.length > 1 ? `‘${cooked[0]}’ 외 ${cooked.length - 1}가지를` : quoted(cooked[0], '을/를')} 만들어 먹었어요`);
    const shop = d.shop || [];
    if (shop.length) add('🏪', `편의점에서 ${shop.length > 1 ? `‘${shop[0]}’ 외 ${shop.length - 1}개를` : quoted(shop[0], '을/를')} 샀어요`);
    const cafe = d.cafe || [];
    if (cafe.length) add('☕', `카페에서 ${cafe.length > 1 ? `‘${cafe[0]}’ 외 ${cafe.length - 1}잔을` : quoted(cafe[0], '을/를')} 마셨어요`);
    const coin = d.coin || [];
    if (coin.length) add('🎤', `코인노래방에서 ${coin.length > 1 ? `‘${coin[0]}’ 외 ${coin.length - 1}곡을` : quoted(coin[0], '을/를')} 불렀어요`);
    else if (d.townOut && !shop.length && !cafe.length && !d.busRide) add('🏘️', '동네에 산책 나갔어요');
    if (d.catHome) add('🐈', '길고양이 뭉치가 둘의 집 가족이 됐어요');
    else if (d.catMeet) add('🐈', '동네에서 하얀 길고양이 뭉치를 만났어요');
    if (d.busRide) add('🚌', d.busRide > 1 ? `506번 버스를 타고 여우 마을에 ${d.busRide}번 놀러 갔어요` : '506번 버스를 타고 여우 마을에 놀러 갔어요');
    if (d.dream) add('💭', `${d.dream}의 꿈 이야기를 들었어요`);
    if (d.moon) add('🌕', '보름달에 소원을 빌었어요');
    else if (d.gazed) add('🌙', `여우들이랑 밤하늘의 ${josa(d.gazed, '을/를')} 올려다봤어요`);
    if (d.snow) add('⛄', '여우 세상에 눈이 내렸어요');
    else if (d.rain) add('☔', '여우 세상에 비가 내렸어요');
    if (d.games) {
      const by = Object.entries(d.gameBy || {}).sort((a, b) => b[1] - a[1]);
      const top = by.length > 1 && GAMES.find((g) => g.id === by[0][0]);
      add('🎮', `미니게임을 ${d.games}판 했어요${top ? ` (${top.name} ${by[0][1]}판)` : ''}`);
    }
    if (d.mallang) add('🍡', '말랑 놀이터에서 말랑이를 조물조물했어요');
    if (d.messages) add('💌', d.messages > 1 ? `깜짝 메시지를 ${d.messages}개 열어 봤어요` : '깜짝 메시지를 열어 봤어요');
    if (d.levels && d.levels.length) add('⭐', `레벨 ${josa(String(Math.max(...d.levels)), '이/가')} 됐어요`);
    const ach = this.achievementsOn(day);
    if (ach.length) add('🏆', ach.length === 1 ? `업적 ‘${ach[0].name}’ 달성!` : `업적 ‘${ach[0].name}’ 외 ${ach.length - 1}개 달성!`);
    if (!out.length) {
      add('☁️', '오늘은 조용히 쉬어 간 날이에요');
      add('🌙', '내일은 뭐 하고 놀까요?');
    }
    return out;
  },

  /** A few numbers of the day, kept with its page (for the month's album). */
  sumOf(day) {
    const d = State.diary.log[day] || {};
    return { sang: d.sang || 0, covers: (d.covers || []).length, games: d.games || 0, photos: d.photos || 0, pets: d.pets || 0 };
  },

  /** Days she did something on but did not write about, that can still be written: newest first. */
  missed() {
    const today = this.today();
    const out = [];
    for (let i = 1; i <= DIARY_MISSED; i++) {
      const day = addDays(today, -i);
      if (State.diary.log[day] && !State.diary.pages[day]) out.push(day);
    }
    return out;
  },

  /* ----- drawing a page ----- */
  pic(id) {
    if (!id) return Promise.resolve(null);
    if (!this.pics.has(id)) {
      this.pics.set(
        id,
        DB.get('photos', id)
          .then(async (rec) => (rec && rec.blob ? { bmp: await this.bitmap(rec.blob), rec } : null))
          .catch(() => null)
      );
    }
    return this.pics.get(id);
  },

  async bitmap(blob) {
    if (typeof createImageBitmap === 'function') {
      try {
        return await createImageBitmap(blob);
      } catch (e) {
        /* (an older browser: through an <img>) */
      }
    }
    const url = URL.createObjectURL(blob);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  /** Words that fill rows no wider than `widthOf(row)` each (Korean breaks between words; a word too long, between letters). */
  wrap(ctx, text, widthOf) {
    const rows = [];
    let row = '';
    const fits = (s) => Art.handW(ctx, s) <= widthOf(rows.length);
    for (const w of text.split(/\s+/).filter(Boolean)) {
      const next = row ? `${row} ${w}` : w;
      if (fits(next)) {
        row = next;
        continue;
      }
      if (row) rows.push(row);
      row = '';
      for (const ch of Array.from(w)) {
        if (row && !fits(row + ch)) {
          rows.push(row);
          row = ch;
        } else row += ch;
      }
    }
    if (row) rows.push(row);
    return rows;
  },

  /**
   * The page of `day` as `page` has it ({ mood, note, stickers, lines, photo }), on `canvas` — PAGE_W × PAGE_H
   * times `k`. Fonts and the picture are waited for first.
   */
  async paint(canvas, day, page, k = 1) {
    await Art.fontsReady(page.lines.map((l) => l.t).join('') + (page.note || '') + this.dayName(day));
    const pic = page.photo ? await this.pic(page.photo) : null;
    canvas.width = Math.round(PAGE_W * k);
    canvas.height = Math.round(PAGE_H * k);
    const ctx = canvas.getContext('2d');
    ctx.setTransform(k, 0, 0, k, 0, 0);
    this.paper(ctx);
    this.head(ctx, day, page);
    this.body(ctx, page, !!pic);
    if (pic) this.polaroid(ctx, pic);
    ctx.font = HAND(28);
    ctx.fillStyle = 'rgba(120, 90, 120, 0.42)';
    Art.hand(ctx, '📔 하루 끝 한 장 · 도파민 월드', PAGE_W / 2 + 30, PAGE_H - 26, 'center');
    Stickers.paint(ctx, page.stickers, PAGE_W, PAGE_H);
    return canvas;
  },

  /* A page of a notebook: ruled, a margin, a spiral down its left edge. */
  paper(ctx) {
    ctx.fillStyle = '#fffdf6';
    ctx.fillRect(0, 0, PAGE_W, PAGE_H);
    Art.blob(ctx, 880, 120, 520, '#ffe6f0', 0.5);
    Art.blob(ctx, 160, 1320, 520, '#efe6ff', 0.45);
    ctx.strokeStyle = 'rgba(110, 150, 210, 0.24)';
    ctx.lineWidth = 2;
    for (let y = 372; y < PAGE_H - 50; y += 76) {
      ctx.beginPath();
      ctx.moveTo(96, y);
      ctx.lineTo(PAGE_W - 40, y);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255, 110, 150, 0.4)';
    ctx.beginPath();
    ctx.moveTo(122, 0);
    ctx.lineTo(122, PAGE_H);
    ctx.stroke();
    // the spiral: a hole for every turn of the wire, and the wire coming out of it and round the edge of the page
    ctx.lineCap = 'round';
    for (let y = 66; y < PAGE_H - 30; y += 88) {
      ctx.fillStyle = '#d9cbbd';
      ctx.beginPath();
      ctx.ellipse(58, y, 11, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      const coil = () => {
        ctx.beginPath();
        ctx.moveTo(56, y + 2);
        ctx.bezierCurveTo(52, y - 30, 8, y - 36, -6, y - 12);
      };
      ctx.strokeStyle = 'rgba(60, 50, 70, 0.22)';
      ctx.lineWidth = 12;
      ctx.save();
      ctx.translate(2, 4);
      coil();
      ctx.stroke();
      ctx.restore();
      const g = ctx.createLinearGradient(0, y - 34, 0, y + 2);
      g.addColorStop(0, '#f2f2f7');
      g.addColorStop(0.45, '#a9a9b8');
      g.addColorStop(1, '#6f6f80');
      ctx.strokeStyle = g;
      ctx.lineWidth = 9;
      coil();
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(48, y - 18);
      ctx.bezierCurveTo(38, y - 30, 18, y - 31, 6, y - 24);
      ctx.stroke();
    }
    ctx.lineCap = 'butt';
    Art.grain(ctx, Math.max(PAGE_W, PAGE_H), 0.035);
  },

  /* The date, which day of theirs it is, and how the day felt. */
  head(ctx, day, page) {
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#3d2b45';
    const name = this.dayName(day);
    Art.fitHand(ctx, name, HAND, 680, 88, 52);
    Art.hand(ctx, name, 146, 168);
    const n = Days.count(day);
    let y = 236;
    if (n > 0) {
      ctx.font = HAND(48);
      ctx.fillStyle = '#e2507f';
      Art.hand(ctx, `우리 ${fmtNum(n)}일째 💗`, 150, y);
      y += 58;
    }
    const special = Days.on(day);
    if (special.length) {
      const text = `${special[0].emoji} 오늘은 ${special.map((e) => e.name).join(' · ')}`;
      ctx.fillStyle = '#8b5cf6';
      Art.fitHand(ctx, text, HAND, 640, 44, 30);
      Art.hand(ctx, text, 150, y);
    }
    // how the day felt
    const cx = 936;
    const cy = 168;
    ctx.save();
    if (page.mood) {
      ctx.fillStyle = '#ffe3ee';
      ctx.beginPath();
      ctx.arc(cx, cy, 92, 0, Math.PI * 2);
      ctx.fill();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `118px ${EMOJI_FONT}`;
      ctx.fillText(page.mood, cx, cy + 8);
    } else {
      ctx.strokeStyle = '#eab3c9';
      ctx.lineWidth = 5;
      ctx.setLineDash([16, 12]);
      ctx.beginPath();
      ctx.arc(cx, cy, 88, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = HAND(52);
      ctx.fillStyle = '#d58aa8';
      Art.hand(ctx, '기분?', cx, cy + 16, 'center');
    }
    ctx.textBaseline = 'alphabetic';
    ctx.font = HAND(32);
    ctx.fillStyle = '#a58ea8';
    Art.hand(ctx, '오늘의 기분', cx, cy + 134, 'center');
    ctx.restore();
  },

  /* What she did, on the ruled lines — and the line of her own under it. Beside the picture the lines are shorter;
     when there is a lot to tell the hand gets smaller, and if it still does not fit, what matters least is left out. */
  body(ctx, page, pic) {
    const first = 372 - 16; // the baseline of the first row
    const rowH = 76;
    const rows = Math.floor((PAGE_H - 70 - first) / rowH) + 1;
    const textX = 212;
    const widthOf = (row) => (pic && first + row * rowH > 990 ? 676 : PAGE_W - 64) - textX;
    const lay = (size, lines) => {
      ctx.font = HAND(size);
      const out = [];
      let row = 0;
      const put = (emoji, text, color) => {
        const start = row;
        this.wrap(ctx, text, (i) => widthOf(start + i)).forEach((r, i) => out.push({ row: row++, emoji: i ? '' : emoji, text: r, color }));
      };
      lines.forEach((l) => put(l.e, l.t, '#4a3a55'));
      if (page.note) {
        row++;
        put('✏️', page.note, '#e2507f');
      }
      return { size, out, fits: row <= rows };
    };
    let plan = null;
    for (let n = page.lines.length; n > 0 && !(plan && plan.fits); n--) {
      for (const size of [56, 50, 45]) if (!(plan && plan.fits)) plan = lay(size, page.lines.slice(0, n));
    }
    if (!plan) plan = lay(45, []);
    ctx.textAlign = 'left';
    plan.out.forEach((o) => {
      if (o.row >= rows) return; // (a line of her own too long for what is left of the page)
      const y = first + o.row * rowH;
      if (o.emoji) {
        ctx.font = `${Math.round(plan.size * 0.84)}px ${EMOJI_FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(o.emoji, 166, y - 5);
        ctx.textAlign = 'left';
      }
      ctx.font = HAND(plan.size);
      ctx.fillStyle = o.color;
      Art.hand(ctx, o.text, textX, y);
    });
  },

  /* The picture of the day, as a polaroid taped to the page. */
  polaroid(ctx, { bmp, rec }) {
    ctx.save();
    ctx.translate(864, 1188);
    ctx.rotate((4 * Math.PI) / 180);
    const W = 300;
    const H = 362;
    ctx.shadowColor = 'rgba(70, 40, 70, 0.28)';
    ctx.shadowBlur = 22;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-W / 2, -H / 2, W, H);
    ctx.shadowColor = 'transparent';
    const S = 264;
    const side = Math.min(bmp.width, bmp.height);
    ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, -S / 2, -H / 2 + 18, S, S);
    ctx.fillStyle = '#6b5470';
    const names = (rec.names || []).join(' · ');
    const cap = names ? `${names} 📷` : '찰칵! 📷';
    Art.fitHand(ctx, cap, HAND, W - 30, 34, 22);
    Art.hand(ctx, cap, 0, H / 2 - 26, 'center');
    ctx.restore();
    Stickers.paint(ctx, [{ k: 't-pink', x: 856 / PAGE_W, y: 1006 / PAGE_H, s: 0.18, r: -7 }], PAGE_W, PAGE_H);
  },

  /* ----- Home ----- */
  cardHtml() {
    if (!this.writable() || !this.isOpen() || State.diary.pages[this.today()]) return '';
    return `<button class="card diary-card" data-action="diary-today">
      <span class="diary-ico" aria-hidden="true">📔</span>
      <span class="diary-text"><b>오늘의 한 장이 준비됐어요</b><small>오늘 한 일을 일기장에 정리해 뒀어요 · 기분이랑 스티커만 붙이면 끝!</small></span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`;
  },

  /* The evening has come: the fox says so, once. */
  hail() {
    const day = this.today();
    if (!this.writable() || !this.isOpen() || State.diary.pages[day] || State.diary.hailed === day) return;
    State.diary.hailed = day;
    Store.save();
    setTimeout(() => {
      if (!Router.is('home') || UI.stack.length) return;
      if (Opening.shut() || !Pet.home().length) UI.toast('오늘의 한 장이 준비됐어요. 오늘 한 일을 일기장에 정리해 뒀어요!', { icon: '📔', ms: 4200 });
      else UI.petPop('오늘 하루 어땠어? 일기장에 정리해 놨어 📔');
    }, 1400);
  },

  /* A month is over: its pages are an album now — say so (once for each; only the newest is shown). */
  wake() {
    if (!this.writable()) return;
    const now = this.today().slice(0, 7);
    const months = Array.from(new Set(Object.keys(State.diary.pages).map((d) => d.slice(0, 7)))).filter((ym) => ym < now && !State.diary.albums[ym]);
    if (!months.length) return;
    months.forEach((ym) => (State.diary.albums[ym] = Date.now()));
    Store.save();
    Game.checkAchievements();
    const ym = months.sort().pop();
    const n = Object.keys(State.diary.pages).filter((d) => d.startsWith(ym)).length;
    UI.celebrate({
      emoji: '📖',
      title: `${this.monthName(ym)}의 우리`,
      subtitle: `일기 ${n}장이 한 권의 앨범이 됐어요`,
      buttons: [{ label: '📖 펼쳐 보기', primary: true, onClick: () => this.album(ym) }, { label: '나중에 볼게요' }],
    });
  },

  monthName(ym) {
    return `${+ym.slice(5, 7)}월`;
  },

  /* ----- the page she writes ----- */
  /** Open the page of `day` (today's, by default): to write — or, if it is kept, to look at it and stick more on. */
  async open(day = this.today()) {
    if (this.ov || !this.writable()) return;
    if (day === this.today() && !this.isOpen() && !State.diary.pages[day]) {
      UI.toast(`오늘의 한 장은 ${OPENS_AT}에 열려요 (${fmtDuration(this.opensIn())} 남았어요)`, { icon: '📔' });
      return;
    }
    const kept = State.diary.pages[day];
    const live = day === this.today() || !kept; // (a day that is still going on: its lines are written afresh)
    const was = this.drafts[day] || kept;
    const log = State.diary.log[day] || {};
    const page = {
      mood: was ? was.mood : '',
      note: was ? was.note : '',
      stickers: was ? was.stickers.map((s) => ({ ...s })) : [],
      lines: live ? this.lines(day) : kept.lines,
      photo: live ? log.photo || (kept && kept.photo) || '' : kept.photo || '',
    };
    let dirty = !!this.drafts[day];
    let saved = false;
    const ov = (this.ov = UI.open(
      `<div class="diary-ed">
        <header class="de-head">
          <button class="icon-btn" data-action="close-overlay" aria-label="닫기">‹</button>
          <h2>${esc(this.dayName(day).replace(/^\d+년 /, ''))}</h2>
          <button class="icon-btn" data-de-save aria-label="이미지로 저장">⬇️</button>
          <button class="btn primary small" data-de-done>${kept ? '저장' : '완성 ✓'}</button>
        </header>
        <div class="de-stage" data-de-stage>
          <div class="de-page" data-de-page>
            <canvas data-de-canvas aria-label="${esc(this.dayName(day))}의 일기"></canvas>
            <button class="de-mood-hit" data-de-tab="mood" style="left:${((936 - 110) / PAGE_W) * 100}%;top:${((168 - 110) / PAGE_H) * 100}%;width:${(220 / PAGE_W) * 100}%;height:${(220 / PAGE_H) * 100}%" aria-label="오늘의 기분 고르기"></button>
          </div>
        </div>
        <div class="de-tools">
          <div class="seg de-tabs" role="tablist" aria-label="꾸미기">
            <button class="seg-btn" role="tab" data-de-tab="mood">😊 기분</button>
            <button class="seg-btn" role="tab" data-de-tab="stickers">✨ 스티커</button>
            <button class="seg-btn" role="tab" data-de-tab="note">✏️ 한 줄</button>
          </div>
          <div class="de-tray" data-de-tray></div>
        </div>
      </div>`,
      {
        full: true,
        cls: 'is-diary',
        label: `${this.dayName(day)}의 한 장`,
        onClose: () => {
          this.ov = null;
          board.destroy();
          window.removeEventListener('resize', fit);
          if (dirty && !saved) this.drafts[day] = page;
        },
      }
    ));
    const panel = ov.panel;
    const canvas = $('[data-de-canvas]', panel);
    const sheet = $('[data-de-page]', panel);
    const stage = $('[data-de-stage]', panel);
    const tray = $('[data-de-tray]', panel);
    const fit = () => {
      const r = stage.getBoundingClientRect();
      const w = Math.max(160, Math.min(r.width - 24, (r.height - 16) * (PAGE_W / PAGE_H)));
      sheet.style.width = `${Math.round(w)}px`;
      sheet.style.height = `${Math.round((w * PAGE_H) / PAGE_W)}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    let painting = Promise.resolve();
    const repaint = () => (painting = painting.then(() => this.paint(canvas, day, { ...page, stickers: [] }, 1)).catch((e) => console.warn('[Diary] could not draw the page', e)));
    repaint();
    const board = Stickers.board(sheet, page.stickers, { onChange: () => (dirty = true) });

    let tab = '';
    const show = (name) => {
      tab = name;
      $$('[data-de-tab]', panel).forEach((b) => {
        if (!b.classList.contains('seg-btn')) return;
        const on = b.dataset.deTab === name;
        b.classList.toggle('on', on);
        b.setAttribute('aria-selected', String(on));
      });
      if (name === 'mood') {
        tray.innerHTML = `<div class="de-moods" role="radiogroup" aria-label="오늘의 기분">${MOODS.map(
          (m) => `<button class="de-mood ${page.mood === m.e ? 'on' : ''}" role="radio" aria-checked="${page.mood === m.e}" data-mood="${m.e}"><span aria-hidden="true">${m.e}</span><small>${m.name}</small></button>`
        ).join('')}</div>`;
      } else if (name === 'stickers') {
        tray.innerHTML = `${Stickers.trayHtml()}<p class="de-hint">붙인 스티커는 끌어서 옮기고, ↻를 돌리면 크기와 방향이 바뀌어요.</p>`;
      } else {
        tray.innerHTML = `<label class="de-note"><span class="sr-only">오늘의 한 줄</span>
          <input data-de-note maxlength="40" placeholder="오늘을 한 줄로 남겨 볼까요? (안 써도 돼요)" value="${esc(page.note)}" autocomplete="off"></label>`;
        const input = $('[data-de-note]', tray);
        input.addEventListener('input', () => {
          page.note = input.value.replace(/\s+/g, ' ').slice(0, 40);
          dirty = true;
          clearTimeout(this.noteTimer);
          this.noteTimer = setTimeout(repaint, 220);
        });
        input.addEventListener('keydown', (e) => e.key === 'Enter' && input.blur());
      }
    };
    show(page.mood ? 'stickers' : 'mood');
    Stickers.ready().then(() => {
      if (this.ov === ov && tab === 'stickers') show('stickers');
      board.render();
    });

    panel.addEventListener('click', async (e) => {
      const t = e.target.closest('[data-de-tab]');
      if (t) {
        Sfx.play('tap');
        return show(t.dataset.deTab);
      }
      const m = e.target.closest('[data-mood]');
      if (m) {
        page.mood = m.dataset.mood;
        dirty = true;
        Sfx.play('pop');
        show('mood');
        repaint();
        if (page.stickers.length === 0) setTimeout(() => this.ov === ov && tab === 'mood' && show('stickers'), 500);
        return;
      }
      const s = e.target.closest('[data-stk]');
      if (s) return void board.add(s.dataset.stk);
      if (e.target.closest('[data-de-save]')) return this.export(day, page);
      if (e.target.closest('[data-de-done]')) {
        if (!page.mood) {
          show('mood');
          UI.toast('오늘의 기분을 골라 주세요', { icon: '😊' });
          return;
        }
        saved = true;
        this.keep(day, page, !kept);
        delete this.drafts[day];
        UI.close(ov);
      }
    });
  },

  /* The page is kept. The first time, that is worth something. */
  keep(day, page, first) {
    State.diary.pages[day] = {
      mood: page.mood,
      note: page.note,
      stickers: page.stickers.map((s) => ({ k: s.k, x: +s.x.toFixed(4), y: +s.y.toFixed(4), s: +s.s.toFixed(4), r: Math.round(s.r) })),
      lines: page.lines,
      photo: page.photo || '',
      sum: day === this.today() || !(State.diary.pages[day] || {}).sum ? this.sumOf(day) : State.diary.pages[day].sum,
      at: Date.now(),
    };
    if (first) {
      Game.reward({ dopamine: 30, xp: 10, coins: 10 });
      Sfx.play('reward');
      UI.confetti({ count: 50 });
      UI.toast('오늘의 한 장 완성! +30 ✨ +10 🪙', { icon: '📔', kind: 'gold', ms: 3200 });
    } else UI.toast('일기를 저장했어요', { icon: '📔' });
    Store.save();
    Game.checkAchievements();
    if (Router.is('home') || Router.is('diary') || Router.is('calendar')) setTimeout(() => Router.refresh(), 320);
  },

  /** The page as a picture of her own. */
  async export(day, page) {
    const canvas = await this.paint(Art.canvas(1, 1), day, page, 1);
    const blob = await Art.toBlob(canvas);
    offerFile(blob, `하루 끝 한 장 ${day}.png`, { icon: '📔', title: '한 장이 그림으로 준비됐어요!', text: '내가 고른 곳에만 저장돼요 — 어디에도 올라가지 않아요.', image: true });
  },

  /* ----- the month's album: 10월의 우리 ----- */
  async album(ym) {
    if (this.albumOv) return;
    const days = Object.keys(State.diary.pages)
      .filter((d) => d.startsWith(ym))
      .sort();
    if (!days.length) return;
    const pages = days.map((d) => State.diary.pages[d]);
    const moods = {};
    pages.forEach((p) => p.mood && (moods[p.mood] = (moods[p.mood] || 0) + 1));
    const topMood = Object.entries(moods).sort((a, b) => b[1] - a[1])[0];
    const sum = (k) => pages.reduce((s, p) => s + ((p.sum || {})[k] || 0), 0);
    const stats = [
      ['📔 일기', `${days.length}장`],
      topMood ? ['가장 많았던 기분', `${topMood[0]} ${topMood[1]}일`] : null,
      sum('sang') ? ['🎤 노래한 시간', fmtDuration(sum('sang'))] : null,
      sum('covers') ? ['💿 발매한 커버', `${sum('covers')}곡`] : null,
      sum('photos') ? ['📷 여우 사진', `${sum('photos')}장`] : null,
      sum('games') ? ['🎮 미니게임', `${sum('games')}판`] : null,
    ].filter(Boolean);
    const over = ym < this.today().slice(0, 7);
    const title = `${this.monthName(ym)}의 우리`;
    const count = days.length + 2;
    let i = 0;
    const ov = (this.albumOv = UI.open('<div class="dalb" data-dalb></div>', { full: true, cls: 'is-dalb', label: title, onClose: () => (this.albumOv = null) }));
    const root = $('[data-dalb]', ov.panel);
    const slideHtml = () => {
      if (i === 0) {
        return `<div class="dalb-cover">
          <p class="dalb-year">${ym.slice(0, 4)}</p>
          <h2 class="dalb-title">${esc(title)}</h2>
          <div class="dalb-fan" aria-hidden="true">${days
            .slice(-3)
            .map((d, k) => `<canvas data-dalb-fan="${d}" style="--k:${k - 1}"></canvas>`)
            .join('')}</div>
          <ul class="dalb-stats">${stats.map(([a, b]) => `<li><span>${a}</span><b>${esc(b)}</b></li>`).join('')}</ul>
          ${over ? '' : `<p class="dalb-note">이 달이 끝나면 앨범이 완성돼요</p>`}
          <p class="dalb-hint">눌러서 넘겨 보세요 →</p>
        </div>`;
      }
      if (i === count - 1) {
        return `<div class="dalb-end">
          <div class="dalb-heart" aria-hidden="true">💗</div>
          <h2>다음 달의 우리도<br>기대돼요</h2>
          <div class="w-actions"><button class="btn primary" data-dalb-save>⬇️ 앨범 이미지로 저장</button></div>
        </div>`;
      }
      const d = days[i - 1];
      return `<figure class="dalb-page"><canvas data-dalb-page="${d}" aria-label="${esc(this.dayName(d))}의 일기"></canvas></figure>`;
    };
    const render = (dir = 0) => {
      root.innerHTML = `<div class="w-progress" aria-hidden="true">${Array.from({ length: count }, (_, k) => `<i class="${k < i ? 'past' : k === i ? 'now' : ''}"></i>`).join('')}</div>
        <button class="icon-btn dalb-close" data-action="close-overlay" aria-label="앨범 닫기">✕</button>
        <div class="dalb-stage"><div class="dalb-slide ${dir > 0 ? 'turn-next' : dir < 0 ? 'turn-prev' : ''}" aria-live="polite">${slideHtml()}</div></div>
        <div class="w-nav">
          <button class="btn ghost" data-dalb-go="-1" ${i === 0 ? 'disabled' : ''}>‹ 이전</button>
          <span class="w-count">${i + 1} / ${count}</span>
          <button class="btn ghost" data-dalb-go="1" ${i === count - 1 ? 'disabled' : ''}>다음 ›</button>
        </div>`;
      $$('[data-dalb-fan]', root).forEach((c) => this.paint(c, c.dataset.dalbFan, State.diary.pages[c.dataset.dalbFan], 0.24));
      const pc = $('[data-dalb-page]', root);
      if (pc) this.paint(pc, pc.dataset.dalbPage, State.diary.pages[pc.dataset.dalbPage], 0.72);
    };
    const go = (dir) => {
      const n = clamp(i + dir, 0, count - 1);
      if (n === i) return;
      i = n;
      Sfx.play('flip');
      render(dir);
    };
    let x0 = null;
    let swiped = false; // (a swipe turns the page; the click that follows it does not turn another)
    root.addEventListener('pointerdown', (e) => {
      x0 = e.clientX;
      swiped = false;
    });
    root.addEventListener('pointerup', (e) => {
      if (x0 != null && Math.abs(e.clientX - x0) > 60) {
        swiped = true;
        go(e.clientX < x0 ? 1 : -1);
      }
      x0 = null;
    });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-dalb-go]');
      if (b) return go(+b.dataset.dalbGo);
      if (e.target.closest('[data-dalb-save]')) return this.poster(ym, title, days, stats);
      if (e.target.closest('button, a') || swiped) return;
      const r = root.getBoundingClientRect();
      go(e.clientX < r.left + r.width * 0.3 ? -1 : 1);
    });
    render();
  },

  /** The month on one picture: its title, its pages laid out, its numbers. */
  async poster(ym, title, days, stats) {
    const W = 1080;
    const H = 1920;
    const c = Art.canvas(W, H);
    const ctx = c.getContext('2d');
    await Art.fontsReady(title);
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#fff1f7');
    g.addColorStop(0.55, '#f3eaff');
    g.addColorStop(1, '#fff4e8');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    Art.blob(ctx, 900, 200, 420, '#ffc6dd', 0.55);
    Art.blob(ctx, 180, 1700, 460, '#d9c8ff', 0.5);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#b06a8e';
    ctx.font = '700 44px Gaegu, Jua, sans-serif';
    ctx.fillText(ym.slice(0, 4), W / 2, 150);
    ctx.fillStyle = '#3d2b45';
    ctx.font = HAND(124);
    Art.hand(ctx, title, W / 2, 270, 'center');
    const show = days.length > 9 ? days.slice(0, 8) : days;
    const cols = 3;
    const tw = 288;
    const th = (tw * PAGE_H) / PAGE_W;
    const gap = 36;
    const x0 = (W - cols * tw - (cols - 1) * gap) / 2;
    const y0 = 340;
    const tile = Art.canvas(1, 1);
    for (let k = 0; k < show.length + (days.length > 9 ? 1 : 0); k++) {
      const x = x0 + (k % cols) * (tw + gap);
      const y = y0 + Math.floor(k / cols) * (th + gap);
      ctx.save();
      ctx.translate(x + tw / 2, y + th / 2);
      ctx.rotate((((k * 37) % 7) - 3) * 0.006);
      ctx.shadowColor = 'rgba(80, 40, 80, 0.25)';
      ctx.shadowBlur = 18;
      ctx.shadowOffsetY = 6;
      if (k < show.length) {
        await this.paint(tile, show[k], State.diary.pages[show[k]], tw / PAGE_W);
        ctx.drawImage(tile, -tw / 2, -th / 2, tw, th);
      } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-tw / 2, -th / 2, tw, th);
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#c0679a';
        ctx.font = HAND(76);
        Art.hand(ctx, `+${days.length - 8}장`, 0, 24, 'center');
      }
      ctx.restore();
    }
    ctx.fillStyle = '#5a4560';
    const line = stats.map(([a, b]) => `${a} ${b}`).join('  ·  ');
    Art.fitHand(ctx, line, HAND, W - 120, 44, 26);
    Art.hand(ctx, line, W / 2, H - 150, 'center');
    ctx.font = '600 30px Fredoka, Jua, sans-serif';
    ctx.fillStyle = 'rgba(90, 60, 100, 0.7)';
    ctx.fillText('💗 도파민 월드', W / 2, H - 80);
    const blob = await Art.toBlob(c);
    offerFile(blob, `${title} ${ym.slice(0, 4)}.png`, { icon: '📖', title: `${title} 앨범이 준비됐어요!`, text: '내가 고른 곳에만 저장돼요 — 어디에도 올라가지 않아요.', image: true });
  },
};

/* ------------------------------------------------------------------
   📔 #/diary — her diary: today's page, the days she can still write,
   and the pages of every month with its album.
   ------------------------------------------------------------------ */
Views.diary = {
  tab: 'me',

  render() {
    const today = Diary.today();
    const pages = State.diary.pages;
    const kept = pages[today];
    const open = Diary.isOpen();
    const sofar = Diary.lines(today).slice(0, 3);
    const quiet = !State.diary.log[today];
    const todayCard = kept
      ? `<button class="card diary-today is-done" data-action="diary-open" data-day="${today}">
          <span class="dt-mood" aria-hidden="true">${kept.mood}</span>
          <span class="dt-text"><b>오늘의 한 장 완성 ✓</b><small>눌러서 다시 보거나 스티커를 더 붙여요</small></span><span class="chev" aria-hidden="true">›</span></button>`
      : open
        ? `<button class="card diary-today is-ready" data-action="diary-open" data-day="${today}">
          <span class="dt-mood" aria-hidden="true">📔</span>
          <span class="dt-text"><b>오늘의 한 장이 준비됐어요</b><small>기분이랑 스티커만 붙이면 끝!</small></span><span class="chev" aria-hidden="true">›</span></button>`
        : `<div class="card diary-today is-wait">
          <span class="dt-mood" aria-hidden="true">🌙</span>
          <span class="dt-text"><b>오늘의 한 장은 ${OPENS_AT}에 열려요</b><small>${esc(fmtDuration(Diary.opensIn()))} 남았어요 · 그때까지 신나게 놀아요!</small>
          ${quiet ? '' : `<span class="dt-sofar">${sofar.map((l) => `<span>${l.e} ${esc(l.t)}</span>`).join('')}</span>`}</span></div>`;
    const missed = Diary.missed();
    const months = {};
    Object.keys(pages)
      .sort()
      .reverse()
      .forEach((d) => (months[d.slice(0, 7)] = months[d.slice(0, 7)] || []).push(d));
    const nowYm = today.slice(0, 7);
    return `<section class="diary-book">
      <header class="page-head compact"><a class="back-btn" href="#/me">‹ 나</a><h1>📔 일기장</h1><span></span></header>
      ${todayCard}
      ${
        missed.length
          ? `<section class="section"><h2 class="section-title">✏️ 아직 못 쓴 날</h2>
          <div class="chip-row">${missed.map((d) => `<button class="btn soft small" data-action="diary-open" data-day="${d}">${esc(fmtDay(d))} 쓰기</button>`).join('')}</div></section>`
          : ''
      }
      ${
        Object.keys(months).length
          ? Object.entries(months)
              .map(
                ([ym, list]) => `<section class="section">
          <div class="section-head">
            <h2 class="section-title">${ym.slice(0, 4)}년 ${+ym.slice(5, 7)}월 <small>(${list.length}장)</small></h2>
            <button class="btn soft small" data-action="diary-album" data-ym="${ym}">📖 ${ym < nowYm ? `${Diary.monthName(ym)}의 우리` : '만드는 중'}</button>
          </div>
          <div class="diary-grid">${list
            .map(
              (d) => `<button class="diary-thumb" data-action="diary-open" data-day="${d}" aria-label="${esc(Diary.dayName(d))}의 일기 보기">
              <canvas data-diary-thumb="${d}"></canvas><span>${+d.slice(8)}일 ${pages[d].mood}</span></button>`
            )
            .join('')}</div>
        </section>`
              )
              .join('')
          : `<div class="card">${emptyState('📔', '아직 일기가 없어요', `${OPENS_AT}가 되면 오늘 한 일이 일기장 한 장에 정리돼요. 기분이랑 스티커만 붙이면 끝!`)}</div>`
      }
    </section>`;
  },

  async mount(root) {
    // the small pages, one after another (each waits for its fonts and its picture)
    for (const c of $$('[data-diary-thumb]', root)) {
      if (!c.isConnected) return;
      const page = State.diary.pages[c.dataset.diaryThumb];
      if (page) await Diary.paint(c, c.dataset.diaryThumb, page, 0.25).catch(() => {});
    }
  },
};

Object.assign(Actions, {
  'diary-today': () => Diary.open(),
  'diary-open': (el) => Diary.open(el.dataset.day),
  'diary-album': (el) => Diary.album(el.dataset.ym),
});
