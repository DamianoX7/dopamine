'use strict';
/* ==================================================================
   ✨ Our constellations — the days worth remembering, as stars.

   In the night sky over the foxes' world (js/moon.js: when she looks
   up), four constellations grow, a star at a time: the days of the
   two of them (the day they began, the 100th, their anniversaries,
   birthdays), her songs (the first cover, every so many after it,
   her first album and record), the foxes' world (the night it
   opened, Halloween and Christmas there, the full moons she wished
   on, the first dream) — and every achievement she has. Each is
   joined to the one before it, the way a constellation is drawn
   (js/fox/heavens.js), so they take a shape of their own as the days
   go by. A new one comes out with a twinkle the first time she looks
   up after it; a tap on one tells that day: what it was, and what she
   did then, as far as it was kept.
   ================================================================== */

// the constellations, and where in the sky each one is (left or right of the moon, high or low)
const STAR_GROUPS = [
  { id: 'us', name: '우리 자리', emoji: '💑', at: 'lt' },
  { id: 'songs', name: '노래 자리', emoji: '🎤', at: 'rt' },
  { id: 'foxes', name: '여우 자리', emoji: '🦊', at: 'lb' },
  { id: 'gems', name: '보물 자리', emoji: '🏆', at: 'rb' },
];
const STARS_MAX = 28; //                 at most this many in a constellation (the first, and the newest)
const COVER_MARKS = [5, 10, 20, 30, 50, 75, 100, 150, 200]; // the covers that are a star of their own
// the nights of the year in the foxes' world (Stars.keep): what the star is called
const STAR_NIGHTS = { halloween: ['핼러윈 사탕 놀이', '🎃'], christmas: ['크리스마스 선물', '🎄'] };

const Stars = {
  shown: null, // the star whose day is up
  came: 0, //    how many came out since she looked up

  /* Every star there is so far, the oldest first: { id, group, day, at, title, emoji, big }. A star of a moment has
     the diary's day (js/diary.js: the small hours belong to the day before); one of a date, that date. */
  all() {
    const out = [];
    const today = dateKey();
    const add = (group, id, day, title, emoji, big = false, at = null) => day && day <= today && out.push({ id: `${group}:${id}`, group, day, at: at || keyToLocalNoon(day), title, emoji, big });
    const moment = (group, id, at, title, emoji, big = false) => add(group, id, Diary.dayOf(at), title, emoji, big, at);
    // the two of them
    const start = Days.start;
    if (start) {
      for (const d of Days.between(start, today)) {
        if (d.kind === 'year' || (d.kind === 'ours' && Opening.at && d.key === dateKey(new Date(Opening.at)))) continue;
        add('us', d.key + d.name, d.key, d.name, d.emoji, d.kind === 'ours' && (d.key === start || /^(\d*00일|\d+주년)$/.test(d.name)));
      }
    }
    // her songs: the first, every so many after it, her first album and record
    const covers = Music.all().sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
    covers.forEach((c, i) => {
      const at = +new Date(c.createdAt);
      if (i === 0) moment('songs', c.id, at, `첫 커버 ‘${c.title}’`, '🎤', true);
      else if (COVER_MARKS.includes(i + 1)) moment('songs', c.id, at, `${i + 1}번째 커버 ‘${c.title}’`, '💿', i + 1 >= 10);
    });
    const albums = Music.albums().slice().sort((a, b) => a.createdAt - b.createdAt);
    if (albums[0]) moment('songs', albums[0].id, albums[0].createdAt, `첫 앨범 ‘${albums[0].title}’`, '📀', true);
    const lps = Object.entries(State.lp).filter(([, v]) => v && v.at).sort((a, b) => a[1].at - b[1].at);
    if (lps[0]) {
      const album = albums.find((a) => a.id === lps[0][0]);
      moment('songs', `lp${lps[0][0]}`, lps[0][1].at, `첫 LP${album ? ` ‘${album.title}’` : ''}`, '💿');
    }
    // the foxes' world
    if (Opening.at && !Opening.shut()) moment('foxes', 'open', Opening.at, '여우 세상이 열린 날', '🔓', true);
    const nights = { ...State.stars.nights };
    if (State.halloween.year) nights[`halloween${State.halloween.year}`] = nights[`halloween${State.halloween.year}`] || `${State.halloween.year}-10-31`; // (from before they were kept)
    if (State.christmas.year) nights[`christmas${State.christmas.year}`] = nights[`christmas${State.christmas.year}`] || `${State.christmas.year}-12-24`;
    Object.entries(nights).forEach(([id, day]) => {
      const [title, emoji] = STAR_NIGHTS[id.replace(/\d+$/, '')] || [];
      if (title) add('foxes', id, day, title, emoji);
    });
    State.moon.wishes.forEach((w) => add('foxes', `wish${w.night}`, w.night, '보름달 소원', '🌕', false, w.at));
    const dreams = Object.keys(State.dreams.list).sort();
    if (dreams[0]) add('foxes', 'dream', dreams[0], '첫 꿈 이야기', '💭', false, State.dreams.list[dreams[0]].at);
    // …and everything she has achieved
    ACHIEVEMENTS.forEach((a) => {
      const at = State.achievements[a.id] ? +new Date(State.achievements[a.id]) : 0;
      if (at) moment('gems', a.id, at, a.name, a.emoji);
    });
    return out.sort((a, b) => a.at - b.at);
  },

  /* A night of the year in the foxes' world has been had (js/halloween.js, js/christmas.js — they keep only the last
     one): its star stays. */
  keep(kind, year) {
    const id = `${kind}${year}`;
    if (State.stars.nights[id]) return;
    State.stars.nights[id] = Diary.today();
    Store.save();
  },

  /* The constellations as the sky shows them (js/fox/heavens.js): each its stars in the order they came — `n`, which
     of all the stars it is by its day (the new ones come out in that order). */
  look() {
    if (Opening.shut()) return [];
    const seen = new Set(State.stars.seen);
    const all = this.all().map((s, n) => ({ ...s, n }));
    return STAR_GROUPS.map((g) => {
      let list = all.filter((s) => s.group === g.id);
      if (list.length > STARS_MAX) list = [list[0]].concat(list.slice(-(STARS_MAX - 1)));
      return { id: g.id, name: g.name, emoji: g.emoji, at: g.at, stars: list.map((s) => ({ id: s.id, n: s.n, big: s.big, fresh: !seen.has(s.id) })) };
    }).filter((g) => g.stars.length);
  },

  count() {
    return this.look().reduce((n, g) => n + g.stars.length, 0);
  },

  /* …and how many of them she has not seen come out yet (the 🌙 button has a spark on it). */
  fresh() {
    return this.look().reduce((n, g) => n + g.stars.filter((s) => s.fresh).length, 0);
  },

  /* For the card over the sky: "✨ 우리 별자리 · 별 23개" (and how many came out just now) — and, until she has, what a tap does. */
  lines() {
    const n = this.count();
    if (!n) return [];
    const out = [`✨ 우리 별자리 · 별 ${n}개${this.came ? ` · 새 별 ${this.came}개!` : ''}`];
    if (!State.stars.tapped) out.push('별을 누르면 그날 이야기가 나와요');
    return out;
  },

  /* The 3D side: these came out in front of her (as she looked up herself, each with a soft bell). */
  saw(ids) {
    const fresh = ids.filter((id) => !State.stars.seen.includes(id));
    if (!fresh.length) return;
    State.stars.seen.push(...fresh);
    this.came += fresh.length;
    Store.save();
    if (!FoxRoom.gazeOn) return;
    Sfx.play('twinkle');
    FoxRoom.gazeCard();
  },

  /* …and she tapped one: that day, in a card along the bottom of the sky (on nothing: the card goes). */
  tapped(id) {
    const ov = FoxRoom.ov;
    if (!ov || !FoxRoom.gazeOn) return;
    const s = id && this.all().find((x) => x.id === id);
    if (!s) return void this.hide();
    this.shown = id;
    Sfx.play('pop');
    const el = $('[data-fg-memory]', ov.panel);
    el.innerHTML = this.card(s);
    el.hidden = false;
    if (!State.stars.tapped) {
      State.stars.tapped = Date.now();
      Store.save();
      Game.checkAchievements();
      FoxRoom.gazeCard();
    }
  },

  hide() {
    this.shown = null;
    const el = FoxRoom.ov && $('[data-fg-memory]', FoxRoom.ov.panel);
    if (el) el.hidden = true;
  },

  /* She looks up, or back down: the card goes, and the count of new stars starts again. */
  leave() {
    this.hide();
    this.came = 0;
  },

  /* What a star's day was: the day itself, which day of theirs it was — and what she did, as far as it was kept. */
  card(s) {
    const [y, m, d] = s.day.split('-').map(Number);
    const n = Days.count(s.day);
    const g = STAR_GROUPS.find((x) => x.id === s.group);
    return `<div class="fm-head">
        <span class="fm-emoji" aria-hidden="true">${s.emoji}</span>
        <span class="fm-title"><i>${esc(g.name)}의 별</i><b>${esc(s.title)}</b><small>${y}년 ${m}월 ${d}일 (${WEEKDAYS[weekdayOf(s.day)]})${n > 0 ? ` · 우리가 만난 지 ${fmtNum(n)}일째` : ''}</small></span>
        <button class="fm-close" data-action="star-close" aria-label="닫기">✕</button>
      </div>
      <ul class="fm-lines">${this.dayLines(s).map((l) => `<li><span aria-hidden="true">${l.e}</span>${esc(l.t)}</li>`).join('')}</ul>`;
  },

  dayLines(s) {
    const day = s.day;
    const out = [];
    const page = State.diary.pages[day];
    if (page && (page.mood || page.note)) out.push({ e: page.mood || '📔', t: page.note ? `그날의 일기: “${page.note}”` : '그날 일기를 썼어요' });
    if (State.diary.log[day]) {
      // (a day with nothing in it, the diary calls a quiet one: that is not worth a star's telling)
      const told = Diary.lines(day);
      if (!(told.length === 2 && told[0].e === '☁️')) told.slice(0, 4).forEach((l) => out.push(l));
    } else {
      // (the record of the day is long gone: what is kept of it elsewhere)
      Music.all().filter((c) => Diary.dayOf(+new Date(c.createdAt)) === day).slice(0, 2).forEach((c) => out.push({ e: '💿', t: `‘${c.title}’ 커버를 발매했어요` }));
      const ach = Diary.achievementsOn(day);
      if (ach.length) out.push({ e: '🏆', t: ach.length === 1 ? `업적 ‘${ach[0].name}’ 달성!` : `업적 ‘${ach[0].name}’ 외 ${ach.length - 1}개 달성!` });
    }
    const dream = State.dreams.list[day];
    if (dream) out.push({ e: '💭', t: `${Pet.nameOf(dream.fox)}의 꿈: ‘${dream.title}’` });
    State.moon.wishes.filter((w) => w.night === day).forEach((w) => out.push({ e: '🌕', t: w.text ? `보름달에 빈 소원: “${w.text}”` : '보름달에 마음속으로 소원을 빌었어요' }));
    if (!out.length) out.push({ e: '✨', t: s.group === 'us' ? '우리 둘만 아는 날이에요' : '이날은 별빛으로만 남아 있어요' });
    return out.slice(0, 6);
  },
};

/* Noon of a date, local time (a star that has only a day, not a moment). */
const keyToLocalNoon = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d, 12).getTime();
};

Object.assign(Actions, {
  'star-close': () => Stars.hide(),
});
