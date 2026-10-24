'use strict';
/* ==================================================================
   💑 Our days — how many days the two of you have been together (the
   card on Home), and the calendar of the days worth remembering:
   the 100th day, the anniversaries, White Day, Christmas…

   Nothing is saved: everything is worked out from `startDate` in
   js/config.js (that day is day 1) and the device's own date. Days of
   your own (birthdays…) go in `specialDays` there.
   ================================================================== */

/* Every year, 'MM-DD'. */
const YEARLY_DAYS = [
  { date: '01-01', name: '새해 첫날', emoji: '🎍' },
  { date: '02-14', name: '발렌타인데이', emoji: '🍫' },
  { date: '03-14', name: '화이트데이', emoji: '🍬' },
  { date: '05-14', name: '로즈데이', emoji: '🌹' },
  { date: '06-14', name: '키스데이', emoji: '💋' },
  { date: '10-31', name: '핼러윈', emoji: '🎃' },
  { date: '11-11', name: '빼빼로데이', emoji: '🥢' },
  { date: '12-24', name: '크리스마스이브', emoji: '🎄' },
  { date: '12-25', name: '크리스마스', emoji: '🎅' },
  { date: '12-31', name: '올해의 마지막 날', emoji: '🎆' },
];
const DAY_MARKS = [50].concat(Array.from({ length: 100 }, (_, i) => (i + 1) * 100)); // the 50th day, then every hundredth
const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const pad2 = (n) => String(n).padStart(2, '0');
const addDays = (key, n) => {
  const d = new Date(keyToUTC(key) + n * 86400000);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
};
const weekdayOf = (key) => new Date(keyToUTC(key)).getUTCDay();
/** '2026-11-28' → '11월 28일 (토)'; with the year when it is not this one. */
const fmtDay = (key) => {
  const [y, m, d] = key.split('-').map(Number);
  return `${y === new Date().getFullYear() ? '' : `${y}년 `}${m}월 ${d}일 (${WEEKDAYS[weekdayOf(key)]})`;
};
const dLabel = (diff) => (diff === 0 ? 'D-DAY' : `D-${diff}`);

const Days = {
  /** The day they became a couple ('YYYY-MM-DD'), or null if config.js has none. */
  get start() {
    const s = String(CFG.startDate || '').trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(keyToUTC(s)) ? s : null;
  },

  /** Which day of theirs a date is: the first day is 1 (0 or less: before it; null: no start date). */
  count(key = dateKey()) {
    return this.start ? daysBetween(this.start, key) + 1 : null;
  },

  /** Everything worth remembering from one date to another (both included), in order: [{ key, name, emoji, kind }]. */
  between(from, to) {
    const out = [];
    const add = (key, name, emoji, kind) => key >= from && key <= to && out.push({ key, name, emoji, kind });
    const y0 = +from.slice(0, 4), y1 = +to.slice(0, 4);
    const own = (CFG.specialDays || []).filter((s) => s && /^\d{2}-\d{2}$/.test(s.date) && s.name);
    for (let y = y0; y <= y1; y++) {
      for (const s of own) add(`${y}-${s.date}`, s.name, s.emoji || '🎂', 'own');
      for (const s of YEARLY_DAYS) add(`${y}-${s.date}`, s.name, s.emoji, 'year');
    }
    if (Opening.at) add(dateKey(new Date(Opening.at)), '노래방과 여우가 열리는 날', '🔓', 'ours'); // (js/opening.js)
    const start = this.start;
    if (start) {
      add(start, '우리가 시작한 날', '💑', 'ours');
      for (const n of DAY_MARKS) add(addDays(start, n - 1), `${n}일`, n % 1000 === 0 ? '🏆' : n % 100 === 0 ? '💯' : '💗', 'ours');
      for (let y = Math.max(y0, +start.slice(0, 4) + 1); y <= y1; y++) {
        const md = start.slice(5) === '02-29' && new Date(y, 1, 29).getMonth() !== 1 ? '02-28' : start.slice(5);
        add(`${y}-${md}`, `${y - +start.slice(0, 4)}주년`, '💐', 'ours');
      }
    }
    const rank = { ours: 0, own: 1, year: 2 };
    return out.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : rank[a.kind] - rank[b.kind]));
  },

  on(key) {
    return this.between(key, key);
  },

  /** The next days to look forward to, today included. */
  upcoming(n = 6) {
    const today = dateKey();
    return this.between(today, addDays(today, 500)).slice(0, n);
  },

  /* ----- Home: the card ----- */
  cardHtml() {
    const today = dateKey();
    const n = this.count(today);
    const now = this.on(today);
    const next = this.upcoming(8).find((e) => e.key > today);
    if (n == null && !next) return '';
    const main =
      n > 0
        ? `<span class="eyebrow">💑 우리가 만난 지</span><span class="days-num"><b>${fmtNum(n)}</b>일째</span>`
        : `<span class="eyebrow">📅 기념일 달력</span><span class="days-num is-small">다가오는 날</span>`;
    const side = now.length
      ? `<span class="days-next is-today"><span class="days-emoji" aria-hidden="true">${now[0].emoji}</span><b>오늘은 ${esc(now[0].name)}!</b></span>`
      : next
        ? `<span class="days-next"><small>${next.emoji} ${esc(next.name)}</small><b>${dLabel(daysBetween(today, next.key))}</b><small>${fmtDay(next.key)}</small></span>`
        : '';
    return `<button class="card days-card ${now.length ? 'is-today' : ''}" data-action="days-open" aria-label="기념일 달력 열기">
      <span class="days-main">${main}</span>${side}<span class="chev" aria-hidden="true">›</span>
    </button>`;
  },

  /* A day worth remembering has come: say so once, the first time she is on Home that day. */
  hail() {
    if (!State.onboarded || State.daily.daysHailed) return;
    const now = this.on(dateKey());
    if (!now.length) return;
    State.daily.daysHailed = true;
    Store.save();
    const n = this.count();
    const gift = Present.due() && !Present.has(); // (Lorelei has something for her: js/present.js)
    UI.celebrate({
      emoji: now[0].emoji,
      title: `오늘은 ${now.map((e) => e.name).join(' · ')}!`,
      subtitle: n > 0 ? `우리가 만난 지 ${fmtNum(n)}일째 되는 날이에요 💗` : '',
      extraHtml: (gift ? `<p class="cel-note">🎁 여우 세상에서 ${esc(josa(OWNER_NAME, '이/가'))} 기다리고 있대요!</p>` : '') + (House.giftWaiting() ? `<p class="cel-note">🏠 ${esc(HOUSE_NAME)} 문 앞에도 선물이 와 있어요!</p>` : ''),
      buttons: gift
        ? [{ label: `🎁 ${OWNER_NAME} 만나러 가기`, primary: true, onClick: () => FoxRoom.open() }, { label: '📅 달력 보기', onClick: () => Router.go('#/calendar') }]
        : [{ label: '📅 달력 보기', onClick: () => Router.go('#/calendar') }, { label: '신난다! 💗', primary: true }],
    });
  },
};

/* ------------------------------------------------------------------
   📅 #/calendar — a month at a time, the day that is picked, and what
   is coming up.
   ------------------------------------------------------------------ */
Views.calendar = {
  tab: 'home',
  ym: null, //  the month that shows, 'YYYY-MM'
  sel: null, // the day that is picked

  render(params, opts = {}) {
    const today = dateKey();
    if (!opts.refresh || !this.ym) {
      this.ym = today.slice(0, 7);
      this.sel = today;
    }
    const [y, m] = this.ym.split('-').map(Number);
    const first = `${this.ym}-01`;
    const size = new Date(y, m, 0).getDate();
    const last = `${this.ym}-${pad2(size)}`;
    const byDay = {};
    Days.between(first, last).forEach((e) => (byDay[e.key] = byDay[e.key] || []).push(e));

    let cells = '<i></i>'.repeat(weekdayOf(first));
    for (let d = 1; d <= size; d++) {
      const key = `${this.ym}-${pad2(d)}`;
      const evs = byDay[key] || [];
      const page = State.diary.pages[key]; // (a day she wrote in her diary shows how it felt: js/diary.js)
      const cls = [key === today ? 'is-today' : '', key === this.sel ? 'is-sel' : '', evs.length ? 'has-day' : '', page ? 'has-page' : '', weekdayOf(key) === 0 ? 'is-sun' : ''].join(' ');
      const label = `${m}월 ${d}일${evs.length ? ', ' + evs.map((e) => e.name).join(', ') : ''}${page ? ', 일기 있음' : ''}`;
      cells += `<button class="cal-day ${cls}" data-action="cal-pick" data-key="${key}" data-sfx="none" aria-label="${esc(label)}" aria-pressed="${key === this.sel}">
        <b>${d}</b><span aria-hidden="true">${evs.length ? evs[0].emoji : page ? page.mood : ''}</span></button>`;
    }

    const n = Days.count(today);
    const hero =
      n > 0
        ? `<div class="card cal-hero"><span class="eyebrow">💑 우리가 만난 지</span><div class="days-num"><b>${fmtNum(n)}</b>일째</div>
            <p class="hint">${Days.start.split('-').map(Number).map((v, i) => v + '년월일'[i]).join(' ')}부터 함께하고 있어요</p></div>`
        : '';
    const up = Days.upcoming(6);

    return `<section class="calendar">
      <header class="page-head compact"><a class="back-btn" href="#/home">‹ 홈</a><h1>📅 기념일 달력</h1><span></span></header>
      ${hero}
      <div class="card cal-card">
        <div class="cal-nav">
          <button class="icon-btn small" data-action="cal-nav" data-step="-1" aria-label="이전 달">‹</button>
          <h2>${y}년 ${m}월</h2>
          <button class="icon-btn small" data-action="cal-nav" data-step="1" aria-label="다음 달">›</button>
          ${this.ym === today.slice(0, 7) && this.sel === today ? '' : '<button class="btn soft small cal-now" data-action="cal-today">오늘</button>'}
        </div>
        <div class="cal-week" aria-hidden="true">${WEEKDAYS.map((w, i) => `<span class="${i ? '' : 'is-sun'}">${w}</span>`).join('')}</div>
        <div class="cal-grid">${cells}</div>
        ${this.pickedHtml()}
      </div>
      <section class="section">
        <h2 class="section-title">🎉 다가오는 날</h2>
        <div class="card cal-list">${up
          .map((e) => {
            const diff = daysBetween(today, e.key);
            return `<button class="cal-row" data-action="cal-goto" data-key="${e.key}">
              <span class="cal-emoji" aria-hidden="true">${e.emoji}</span>
              <span class="cal-text"><b>${esc(e.name)}</b><small>${fmtDay(e.key)}</small></span>
              <span class="chip ${diff === 0 ? 'chip-hot' : ''}">${dLabel(diff)}</span></button>`;
          })
          .join('')}</div>
      </section>
    </section>`;
  },

  /* The day that is picked: which day of theirs it is, and what it is. */
  pickedHtml() {
    const key = this.sel;
    if (!key || key.slice(0, 7) !== this.ym) return '';
    const today = dateKey();
    const n = Days.count(key);
    const diff = daysBetween(today, key);
    const when = diff === 0 ? '오늘' : diff > 0 ? `${fmtNum(diff)}일 뒤` : `${fmtNum(-diff)}일 전`;
    const evs = Days.on(key);
    const page = State.diary.pages[key];
    const write = !page && Diary.missed().includes(key);
    return `<div class="cal-picked">
      <p class="cal-picked-head"><b>${fmtDay(key)}</b><span>${when}${n > 0 ? ` · 우리 ${fmtNum(n)}일째` : ''}</span></p>
      ${
        evs.length
          ? evs.map((e) => `<p class="cal-picked-day"><span aria-hidden="true">${e.emoji}</span> ${esc(e.name)}</p>`).join('')
          : '<p class="hint">기념일은 없지만, 함께라서 좋은 날이에요.</p>'
      }
      ${page || write ? `<button class="btn soft small cal-page-link" data-action="diary-open" data-day="${key}">📔 ${page ? `이날의 일기 보기 ${page.mood}` : '이날의 일기 쓰기'}</button>` : ''}
    </div>`;
  },

  show(key) {
    this.ym = key.slice(0, 7);
    this.sel = key;
    Router.refresh();
  },
};

Object.assign(Actions, {
  'days-open': () => Router.go('#/calendar'),
  'cal-nav': (el) => {
    const v = Views.calendar;
    const [y, m] = v.ym.split('-').map(Number);
    const d = new Date(y, m - 1 + Number(el.dataset.step), 1);
    v.ym = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
    Router.refresh();
  },
  'cal-today': () => Views.calendar.show(dateKey()),
  'cal-pick': (el) => Views.calendar.show(el.dataset.key),
  'cal-goto': (el) => {
    Views.calendar.show(el.dataset.key);
    const card = $('.cal-card');
    if (card) card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  },
});
