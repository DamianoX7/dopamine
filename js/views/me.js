'use strict';
/* ==================================================================
   💗 Me — profile, artist journey, statistics, achievements, Cover
   Wrapped, letters, the pet's room, settings & the message editor.
   ================================================================== */

const THEMES = [
  { id: 'pink', name: '핑크', swatch: 'linear-gradient(135deg,#ffd1e6,#ff7fb5)' },
  { id: 'lavender', name: '라벤더', swatch: 'linear-gradient(135deg,#e6dcff,#a78bfa)' },
  { id: 'peach', name: '피치', swatch: 'linear-gradient(135deg,#ffe4d1,#ff9f7a)' },
  { id: 'night', name: '밤', swatch: 'linear-gradient(135deg,#2a1850,#8b5cf6)' },
];

const SPECIAL_LABELS = {
  firstCover: '첫 커버를 완성했을 때',
  covers5: '커버 5곡째',
  covers10: '커버 10곡째',
  covers20: '커버 20곡째',
  covers50: '커버 50곡째',
  rare: '레어 커버가 나왔을 때',
  lateNight: '늦은 밤에 만든 커버',
  streak7: '7일 연속 노래',
  album: '첫 앨범',
};

function subHead(title) {
  return `<header class="page-head compact"><a class="back-btn" href="#/me">‹ 나</a><h1>${title}</h1><span></span></header>`;
}

/* ------------------------------------------------------------------
   🚪 The door of the boyfriend-only pages (편지 쓰기, 메시지 편집).
   It opens with the passcode of js/config.js (doorPin), and closes behind him: as soon as he leaves those pages, and
   when the page goes out of sight — a phone put down, another app — so that whoever picks the device up next does
   not find them open. What he was writing is kept (the draft).
   It keeps curious eyes out; it is no safe: the passcode is in a file that her browser is sent as it is.
   ------------------------------------------------------------------ */
const DOOR_TRIES_KEY = 'dopamineWorld.doorTries.v1'; // { n, until }: wrong passcodes in a row, and when the next one may be tried
const DOOR_TRIES = 5; //         so many wrong ones in a row, and the door wants a pause:
const DOOR_WAIT = 30000; //      half a minute, twice as long after every further five…
const DOOR_WAIT_MAX = 600000; // …up to ten minutes

const behindDoor = () => /^#\/me\/(write|messages)\b/.test(location.hash);

const Door = {
  isOpen: false,
  mem: null,

  pin() {
    return String(CFG.doorPin == null ? '' : CFG.doorPin).trim();
  },

  /** What a page behind the door shows while it is shut. */
  html(title, heading, hint, back = '돌아가기') {
    const pin = this.pin();
    return `<section class="me-sub">
      ${subHead(title)}
      <div class="card center">
        <div class="empty-icon" aria-hidden="true">🙈</div>
        <h2>${heading}</h2>
        <p class="hint">${hint}</p>
        ${
          pin
            ? `<form class="door" data-door>
                <label class="hint" for="door-pin">🔒 남자친구만 아는 비밀번호로 열려요.</label>
                <input id="door-pin" class="ob-input door-pin" data-input="door-pin" type="text" ${/^\d+$/.test(pin) ? 'inputmode="numeric" pattern="[0-9]*"' : ''} maxlength="40" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false">
                <button class="btn primary" type="submit">🔑 열기</button>
                <a class="btn ghost" href="#/me/settings">${back}</a>
              </form>`
            : `<button class="btn primary" data-action="bf-unlock">제가 남자친구예요 — 열기</button>
               <a class="btn ghost" href="#/me/settings">${back}</a>`
        }
      </div>
    </section>`;
  },

  /** The door on the page: "열기", or the keyboard's enter, tries what has been typed. */
  mount(root) {
    const form = $('[data-door]', root);
    if (!form) return;
    const input = $('#door-pin', form);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.knock(input);
    });
    // (not on a phone: the keypad would jump up over the page before anyone has asked for it)
    if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) input.focus({ preventScroll: true });
  },

  /** Wrong passcodes in a row and the moment the next one may be tried — kept where a reload does not forget them. */
  tries() {
    let t = this.mem;
    try {
      t = JSON.parse(localStorage.getItem(DOOR_TRIES_KEY)) || t;
    } catch (e) {
      /* no storage: counted as long as the page is open */
    }
    return { n: (t && +t.n) || 0, until: (t && +t.until) || 0 };
  },

  keepTries(t) {
    this.mem = t;
    try {
      if (t) localStorage.setItem(DOOR_TRIES_KEY, JSON.stringify(t));
      else localStorage.removeItem(DOOR_TRIES_KEY);
    } catch (e) {
      /* no storage */
    }
  },

  /** How long the door still wants to be left alone, in ms (0: it may be tried). */
  wait() {
    const t = this.tries();
    const ms = t.until - Date.now();
    if (ms <= DOOR_WAIT_MAX) return Math.max(0, ms);
    this.keepTries({ n: t.n, until: Date.now() + DOOR_WAIT_MAX }); // the clock has been set back since: never longer than the longest pause
    return DOOR_WAIT_MAX;
  },

  /** A passcode has been typed in at the door. */
  knock(input) {
    const typed = input.value.trim();
    if (!typed) return void input.focus();
    let wait = this.wait();
    if (!wait && typed === this.pin()) {
      this.keepTries(null);
      this.isOpen = true;
      Sfx.play('pop');
      Router.refresh();
      return;
    }
    if (!wait) {
      const n = this.tries().n + 1;
      wait = n % DOOR_TRIES ? 0 : Math.min(DOOR_WAIT_MAX, DOOR_WAIT * 2 ** (n / DOOR_TRIES - 1));
      this.keepTries({ n, until: wait ? Date.now() + wait : 0 });
    }
    input.value = '';
    input.classList.remove('miss');
    void input.offsetWidth; // (so that it shakes again)
    input.classList.add('miss');
    Sfx.play('error');
    UI.toast(wait ? `여러 번 틀렸어요. ${fmtDuration(Math.ceil(wait / 1000))} 뒤에 다시 해 보세요` : '비밀번호가 맞지 않아요', { icon: '🔑' });
  },

  /** Shuts it. Where he is still on one of its pages, nothing of what was behind it stays on the screen. */
  shut() {
    if (!this.isOpen || Cloud.writer) return; // (on his login it stands open: that login has said who he is)
    this.isOpen = false;
    PostDesk.list = null;
    if (!behindDoor()) return; // (he has left: another view is on its way)
    // The page is the door again, and a dialog of those pages — a letter being previewed, "보내기 취소?" — goes:
    // out of sight at once, as closing takes a moment that a page put away may not be given.
    const dialogs = UI.stack.filter((ov) => !ov.opts.full && !ov.opts.locked);
    dialogs.forEach((ov) => (ov.el.style.display = 'none'));
    dialogs.reverse().reduce((p, ov) => p.then(() => UI.close(ov)), Promise.resolve());
    const typing = document.activeElement;
    if (typing && typing !== document.body && typing.blur) typing.blur(); // (a message he was changing is saved, as when he taps elsewhere)
    Router.refresh();
  },
};

Door.isOpen = Cloud.writer;
window.addEventListener('hashchange', () => {
  if (!behindDoor()) Door.shut();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) Door.shut();
});

function statTile(label, value, sub = '') {
  return `<div class="stat-tile"><div class="stat-label">${label}</div><div class="stat-value">${value}</div>${sub ? `<div class="stat-sub">${sub}</div>` : ''}</div>`;
}

/* ------------------------------------------------------------------
   Statistics
   ------------------------------------------------------------------ */
const SOURCE_LABELS = { tab: '🖥️ 데스크톱 오디오', upload: '🎵 반주 파일', speaker: '🔊 스피커 + 마이크' };

const Stats = {
  compute() {
    const covers = Music.released();
    const songs = Music.songs();
    const mostPlayed = covers.filter((c) => c.plays > 0).sort((a, b) => b.plays - a.plays)[0] || null;
    const songScore = (so) => so.covers.reduce((sum, c) => sum + c.plays + 1, 0);
    const favSong = songs.slice().sort((a, b) => songScore(b) - songScore(a))[0] || null;
    const sources = {};
    covers.forEach((c) => {
      if (c.sourceType) sources[c.sourceType] = (sources[c.sourceType] || 0) + 1;
    });
    return {
      covers: covers.length,
      singing: State.singing.totalSeconds,
      favSong,
      streak: Game.displayStreak(),
      longestStreak: State.singing.longestStreak,
      mostPlayed,
      recordings: State.singing.totalRecordings,
      onDevice: covers.reduce((sum, c) => sum + c.duration, 0),
      albums: Music.albums().length,
      songs: songs.length,
      longest: Math.max(State.singing.longestTake || 0, ...covers.map((c) => c.rawDuration)),
      withArtwork: covers.filter((c) => c.hasArtwork).length,
      sources: Object.entries(sources),
    };
  },

  weekHtml() {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = dateKey(d);
      days.push({ key, label: i === 0 ? '오늘' : d.toLocaleDateString('ko-KR', { weekday: 'short' }), min: (State.singing.days[key] || 0) / 60 });
    }
    const max = Math.max(...days.map((d) => d.min));
    const scale = max > 0 ? max : 1;
    const maxIdx = max > 0 ? days.findIndex((d) => d.min === max) : -1;
    const fmt = (m) => (m < 1 ? `${Math.round(m * 60)}초` : `${m.toFixed(m < 10 ? 1 : 0)}분`);
    return `<div class="card chart-card">
      <h2 class="card-title">노래한 시간 · 최근 7일</h2>
      <div class="week-chart">
        ${days
          .map(
            (d, i) => `<button class="wk-col ${i === maxIdx ? 'show' : ''}" data-action="wk-tap" title="${d.label}: ${fmt(d.min)}" aria-label="${d.label}: ${fmt(d.min)} 노래함">
              <span class="wk-plot"><span class="wk-bar" style="height:${d.min > 0 ? Math.max(3, (d.min / scale) * 100).toFixed(1) : 0}%"><span class="wk-val">${fmt(d.min)}</span></span></span>
              <span class="wk-day">${d.label}</span></button>`
          )
          .join('')}
      </div>
      <p class="hint center">${max === 0 ? '이번 주엔 아직 노래를 안 했어요 — 한 곡이면 달라져요 🎤' : '요일을 누르면 시간을 볼 수 있어요.'}</p>
    </div>`;
  },

  barsHtml(title, entries, labelOf) {
    if (!entries.length) return '';
    const max = Math.max(...entries.map(([, n]) => n));
    return `<div class="card">
      <h2 class="card-title">${title}</h2>
      <ul class="hbars">${entries
        .sort((a, b) => b[1] - a[1])
        .map(
          ([k, n]) => `<li><span class="hb-label">${labelOf(k)}</span>
            <span class="hb-track"><i style="width:${((n / max) * 100).toFixed(1)}%"></i></span><span class="hb-num">${n}</span></li>`
        )
        .join('')}</ul>
    </div>`;
  },
};

/* ------------------------------------------------------------------
   🎁 Cover Wrapped — a story-style recap (monthly or all time)
   ------------------------------------------------------------------ */
const Wrapped = {
  data(period) {
    const now = new Date();
    const inRange = (iso) => {
      if (period === 'all') return true;
      const d = new Date(iso);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    };
    const covers = Music.released().filter((c) => inRange(c.releasedAt));
    const prefix = period === 'all' ? '' : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const secs = Object.entries(State.singing.days)
      .filter(([k]) => k.startsWith(prefix))
      .reduce((s, [, v]) => s + v, 0);
    const top = (arr, key) => {
      const m = {};
      arr.forEach((x) => {
        const k = key(x);
        if (k) m[k] = (m[k] || 0) + 1;
      });
      return Object.entries(m).sort((a, b) => b[1] - a[1])[0];
    };
    const partOfDay = (iso) => {
      const h = new Date(iso).getHours();
      return h < 5 ? '🌙 심야' : h < 12 ? '🌤️ 아침' : h < 18 ? '☀️ 오후' : '🌆 저녁';
    };
    const when = top(covers, (c) => partOfDay(c.createdAt));
    const song = top(covers, (c) => c.songId);
    const how = top(covers, (c) => c.sourceType);
    const so = song ? covers.find((c) => c.songId === song[0]) : null;
    return {
      period,
      periodLabel: period === 'all' ? '전체 기간' : now.toLocaleDateString('ko-KR', { month: 'long', year: 'numeric' }),
      nickname: State.user.nickname || '나',
      songs: covers.length,
      time: fmtDuration(secs),
      when: when ? when[0] : '✨ 언제든',
      topSong: so ? so.title.toUpperCase() : '—',
      topSongCount: song ? song[1] : 0,
      how: (how && SOURCE_LABELS[how[0]]) || '🎤 나만의 방식',
    };
  },

  open() {
    const monthCount = Music.released().filter((c) => new Date(c.createdAt).getMonth() === new Date().getMonth() && new Date(c.createdAt).getFullYear() === new Date().getFullYear()).length;
    this.period = monthCount ? 'month' : 'all';
    this.i = 0;
    this.ov = UI.open('<div class="wrapped" data-wrapped></div>', {
      full: true,
      cls: 'is-wrapped',
      label: '커버 결산',
      onClose: () => (this.ov = null),
    });
    this.ov.panel.addEventListener('click', (e) => {
      if (e.target.closest('[data-w-next]')) return this.go(1);
      if (e.target.closest('[data-w-prev]')) return this.go(-1);
      const per = e.target.closest('[data-w-period]');
      if (per) {
        this.period = per.dataset.wPeriod;
        return this.render();
      }
      if (e.target.closest('[data-w-save]')) return this.save(false);
      if (e.target.closest('[data-w-share]')) return this.save(true);
      if (e.target.closest('button, a, input')) return;
      const r = this.ov.panel.getBoundingClientRect();
      this.go(e.clientX < r.left + r.width * 0.3 ? -1 : 1);
    });
    this.render();
  },

  slides(d) {
    return [
      { emoji: '✨', html: `<p class="w-kicker">나의 커버 결산</p><h2 class="w-big">${esc(d.periodLabel)}</h2>
          <div class="seg w-seg" role="radiogroup" aria-label="기간">
            <button class="seg-btn ${d.period === 'month' ? 'on' : ''}" role="radio" aria-checked="${d.period === 'month'}" data-w-period="month">이번 달</button>
            <button class="seg-btn ${d.period === 'all' ? 'on' : ''}" role="radio" aria-checked="${d.period === 'all'}" data-w-period="all">전체 기간</button></div>
          <p class="w-hint">눌러서 시작 →</p>` },
      { emoji: '🎤', html: `<p class="w-kicker">${d.period === 'all' ? '지금까지 발매한 커버' : '이번 달에 발매한 커버'}</p><h2 class="w-big">${d.songs}곡</h2>` },
      { emoji: '⏱️', html: `<p class="w-kicker">노래한 시간</p><h2 class="w-big">${esc(d.time)}</h2><p class="w-sub">동안 불렀어요</p>` },
      { emoji: '🕰️', html: `<p class="w-kicker">가장 자주 노래한 시간대</p><h2 class="w-big">${esc(d.when)}</h2>` },
      { emoji: '💿', html: `<p class="w-kicker">가장 많이 커버한 노래</p><h2 class="w-big">${esc(d.topSong)}</h2>${d.topSongCount ? `<p class="w-sub">커버 ${d.topSongCount}개</p>` : ''}` },
      { emoji: '🎛️', html: `<p class="w-kicker">녹음하는 방식</p><h2 class="w-big">${esc(d.how)}</h2>` },
      {
        emoji: '💗',
        html: `<p class="w-kicker">✨ ${esc(d.nickname)} · ${esc(d.periodLabel)} ✨</p>
          <ul class="w-summary">
            <li><span>발매한 커버</span><b>${d.songs}곡</b></li>
            <li><span>노래한 시간</span><b>${esc(d.time)}</b></li>
            <li><span>좋아하는 시간대</span><b>${esc(d.when)}</b></li>
            <li><span>최다 커버곡</span><b>${esc(d.topSong)}</b></li>
            <li><span>녹음 방식</span><b>${esc(d.how)}</b></li>
          </ul>
          <div class="w-actions">
            <button class="btn primary" data-w-save>⬇️ 이미지로 저장</button>
            ${navigator.share && isCoarsePointer() ? '<button class="btn soft" data-w-share>📤 공유</button>' : ''}
          </div>`,
      },
    ];
  },

  render() {
    if (!this.ov) return;
    const d = this.data(this.period);
    const slides = this.slides(d);
    this.count = slides.length;
    this.i = clamp(this.i, 0, slides.length - 1);
    const s = slides[this.i];
    if (this.i === slides.length - 1 && !this.viewedOnce) {
      this.viewedOnce = true;
      State.statistics.wrappedViewed += 1;
      Store.save();
      Game.checkAchievements();
    }
    this.ov.panel.innerHTML = `<div class="wrapped w-${this.i}">
      <div class="w-progress" aria-hidden="true">${slides.map((_, k) => `<i class="${k < this.i ? 'past' : k === this.i ? 'now' : ''}"></i>`).join('')}</div>
      <button class="icon-btn w-close" data-action="close-overlay" aria-label="결산 닫기">✕</button>
      <div class="w-slide" aria-live="polite"><div class="w-emoji" aria-hidden="true">${s.emoji}</div>${s.html}</div>
      <div class="w-nav">
        <button class="btn ghost" data-w-prev ${this.i === 0 ? 'disabled' : ''}>‹ 이전</button>
        <span class="w-count">${this.i + 1} / ${slides.length}</span>
        <button class="btn ghost" data-w-next ${this.i === slides.length - 1 ? 'disabled' : ''}>다음 ›</button>
      </div>
    </div>`;
  },

  go(dir) {
    const n = clamp(this.i + dir, 0, (this.count || 7) - 1);
    if (n === this.i) return;
    this.i = n;
    Sfx.play('pop');
    this.render();
  },

  async save(share) {
    const d = this.data(this.period);
    const blob = await Art.wrappedCard(d);
    const name = `커버 결산 - ${safeFileName(d.periodLabel)}.png`;
    if (share && canShareFile(blob, name)) {
      shareFile(blob, name, '나의 커버 결산').catch(() => offerFile(blob, name, { icon: '🎁', title: '결산 이미지가 준비됐어요!', text: '내가 고른 곳에만 저장돼요.', image: true }));
    } else {
      offerFile(blob, name, { icon: '🎁', title: '결산 이미지가 준비됐어요!', text: '내가 고른 곳에만 저장돼요 — 어디에도 올라가지 않아요.', image: true });
    }
  },
};

/* ------------------------------------------------------------------
   Views
   ------------------------------------------------------------------ */
Views.me = {
  tab: 'me',
  render(params) {
    const sub = params[0];
    if (['stats', 'achievements', 'letters', 'settings', 'messages', 'write'].includes(sub)) return this[sub]();
    return this.main();
  },

  mount(root, params) {
    $$('input[type=range]', root).forEach(styleRange);
    if (params[0] === 'settings') this.fillStorage();
    Door.mount(root);
    if (params[0] === 'write' && Door.isOpen) PostDesk.load();
    if (params[0] === 'pet') {
      // an old link to the pet's room: it is the fox's world now
      history.replaceState(null, '', '#/me');
      Router.hash = '#/me';
      FoxRoom.open();
    }
  },

  main() {
    const u = State.user;
    const d = State.dopamine;
    const n = Music.released().length;
    const cur = Game.title();
    const next = Game.nextTitle();
    const achDone = ACHIEVEMENTS.filter((a) => State.achievements[a.id]).length;
    const wrappedOpen = n >= 3;
    const initial = Array.from((u.nickname || '♡').trim())[0] || '♡';
    return `<section class="me">
      <div class="card profile-card">
        <div class="avatar" aria-hidden="true">${esc(initial.toUpperCase())}</div>
        <div class="profile-text">
          <h1>${esc(u.nickname || '나')}</h1>
          <p class="hint">${cur.emoji} ${esc(cur.name)} · Lv ${d.level}</p>
          <p class="hint">아티스트 이름: ${esc(u.artistName || u.nickname || '—')}</p>
        </div>
        <a class="icon-btn" href="#/me/settings" aria-label="프로필 수정">✏️</a>
      </div>

      <div class="kpi-row">
        ${statTile('도파민', fmtCompact(d.points))}
        ${statTile('코인', fmtCompact(d.coins))}
        ${statTile('레벨', d.level, `${d.xp}/${Game.xpToNext(d.level)} XP`)}
      </div>

      <div class="card journey-card">
        <h2 class="card-title">🎖️ 아티스트 여정</h2>
        <ol class="journey">${TITLES.slice(1)
          .map(
            (t) => `<li class="${n >= t.min ? 'got' : ''}">
              <span class="j-emoji" aria-hidden="true">${t.emoji}</span>
              <span class="j-text"><b>${t.name}</b><small>커버 ${t.min}곡</small></span>
              <span class="j-check">${n >= t.min ? '✓<span class="sr-only"> 달성</span>' : '<span class="sr-only">잠김</span>'}</span></li>`
          )
          .join('')}</ol>
        ${
          next
            ? `${meterHtml(n - cur.min, next.min - cur.min, `${next.name}까지`)}
               <p class="hint">커버 ${next.min - n}곡만 더 만들면 ${next.emoji} ${next.name}! (재미로 붙이는 칭호예요)</p>`
            : '<p class="hint">최고 칭호에 올랐어요: 👑 도파민 레전드!</p>'
        }
      </div>

      <nav class="me-links" aria-label="나 메뉴">
        <a class="me-link card" href="#/me/stats"><span class="ml-icon" aria-hidden="true">📊</span><span class="ml-text"><b>통계</b><small>커버 ${n}곡 · 노래 ${fmtDuration(State.singing.totalSeconds)}</small></span><span class="chev" aria-hidden="true">›</span></a>
        <a class="me-link card" href="#/me/achievements"><span class="ml-icon" aria-hidden="true">🏆</span><span class="ml-text"><b>업적</b><small>${ACHIEVEMENTS.length}개 중 ${achDone}개 달성</small></span><span class="chev" aria-hidden="true">›</span></a>
        ${
          wrappedOpen
            ? '<button class="me-link card" data-action="open-wrapped"><span class="ml-icon" aria-hidden="true">🎁</span><span class="ml-text"><b>커버 결산</b><small>스토리로 보는 나의 노래 기록</small></span><span class="chev" aria-hidden="true">›</span></button>'
            : `<div class="me-link card is-locked"><span class="ml-icon" aria-hidden="true">🔒</span><span class="ml-text"><b>커버 결산</b><small>커버 3곡부터 열려요 (${n}/3)</small></span></div>`
        }
        <a class="me-link card" href="#/diary"><span class="ml-icon" aria-hidden="true">📔</span><span class="ml-text"><b>일기장</b><small>${
          Object.keys(State.diary.pages).length ? `하루 끝 한 장 · ${Object.keys(State.diary.pages).length}장` : `${OPENS_AT}가 되면 오늘의 한 장이 열려요`
        }</small></span><span class="chev" aria-hidden="true">›</span></a>
        <a class="me-link card" href="#/me/letters"><span class="ml-icon" aria-hidden="true">💌</span><span class="ml-text"><b>편지</b><small>${Post.waiting().length ? `새 편지 ${Post.waiting().length}통이 도착했어요!` : `${Messages.all().length}개 중 ${Messages.collected().length}개 발견${Post.kept().length ? ` · 받은 편지 ${Post.kept().length}통` : ''}`}</small></span><span class="chev" aria-hidden="true">›</span></a>
        ${
          Opening.shut()
            ? `<button class="me-link card is-locked" data-action="opening-tell"><span class="ml-icon" aria-hidden="true">🔒</span><span class="ml-text"><b>노래방 · 여우 키우기</b><small>${esc(Opening.whenText())}에 열려요 (${esc(Opening.leftText())})</small></span></button>`
            : `<button class="me-link card" data-action="fox-open"><span class="ml-icon" aria-hidden="true">🦊</span><span class="ml-text"><b>${esc(State.pet.name)} 만나러 가기</b><small>여우 키우기 · 마당 꾸미기 · 커버 들려주기</small></span><span class="chev" aria-hidden="true">›</span></button>`
        }
        ${Opening.shut() ? '' : this.albumLink()}
        <a class="me-link card" href="#/me/settings"><span class="ml-icon" aria-hidden="true">⚙️</span><span class="ml-text"><b>설정</b><small>소리, 테마, 심야 모드, 저장 공간</small></span><span class="chev" aria-hidden="true">›</span></a>
      </nav>
    </section>`;
  },

  albumLink() {
    return `<button class="me-link card" data-action="photo-album"><span class="ml-icon" aria-hidden="true">📷</span><span class="ml-text"><b>여우 사진첩</b><small>${State.statistics.photos ? `지금까지 ${fmtNum(State.statistics.photos)}장 찍었어요` : '여우 세상에서 찍은 사진이 모여요'}</small></span><span class="chev" aria-hidden="true">›</span></button>`;
  },

  stats() {
    const s = Stats.compute();
    return `<section class="me-sub">
      ${subHead('📊 통계')}
      <div class="stat-grid">
        ${statTile('🎤 전체 커버', fmtNum(s.covers))}
        ${statTile('⏱️ 총 노래 시간', fmtDuration(s.singing))}
        ${statTile('💿 최애곡', s.favSong ? esc(s.favSong.title) : '—')}
        ${statTile('🔥 노래 연속 기록', `${s.streak}일`, `최장 ${s.longestStreak}일`)}
        ${statTile('🎧 가장 많이 들은 커버', s.mostPlayed ? esc(s.mostPlayed.title) : '—', s.mostPlayed ? `${s.mostPlayed.plays}번 재생` : '')}
        ${statTile('🎙️ 녹음 횟수', fmtNum(s.recordings))}
        ${statTile('⌛ 이 기기의 커버 길이', fmtDuration(s.onDevice))}
        ${statTile('📀 앨범', fmtNum(s.albums))}
        ${statTile('🎵 노래', fmtNum(s.songs))}
        ${statTile('📏 가장 긴 녹음', s.longest ? fmtTime(s.longest) : '—')}
        ${statTile('🎨 그림이 있는 커버', `${s.covers}개 중 ${s.withArtwork}개`)}
        ${statTile('🎮 게임 횟수', fmtNum(State.statistics.gamesPlayed))}
      </div>
      ${Stats.weekHtml()}
      ${Stats.barsHtml('🎛️ 녹음하는 방식', s.sources, (k) => SOURCE_LABELS[k] || esc(k))}
      <div class="card">
        <h2 class="card-title">✨ 소소한 숫자들</h2>
        <ul class="kv">
          <li><span>🎧 내 커버를 들은 횟수</span><b>${fmtNum(State.statistics.listens)}</b></li>
          <li><span>💌 열어 본 메시지</span><b>${fmtNum(State.statistics.messagesOpened)}</b></li>
          <li><span>🦊 ${esc(josa(State.pet.name, '을/를'))} 쓰다듬은 횟수</span><b>${fmtNum(State.statistics.petTaps)}</b></li>
          <li><span>🍀 행운의 버튼을 누른 횟수</span><b>${fmtNum(State.statistics.luckySpins)}</b></li>
          <li><span>✨ 레어 이벤트</span><b>${fmtNum(State.statistics.rareEvents)}</b></li>
          <li><span>🔮 찾은 비밀</span><b>${fmtNum(State.statistics.secretEvents)}</b></li>
        </ul>
      </div>
    </section>`;
  },

  achievements() {
    const done = ACHIEVEMENTS.filter((a) => State.achievements[a.id]).length;
    return `<section class="me-sub">
      ${subHead('🏆 업적')}
      <div class="card">
        <p>${ACHIEVEMENTS.length}개 중 <b>${done}</b>개 달성 · 하나마다 +25 🪙</p>
        ${meterHtml(done, ACHIEVEMENTS.length, '달성한 업적')}
      </div>
      <ul class="ach-grid">${ACHIEVEMENTS.map((a) => {
        const at = State.achievements[a.id];
        return `<li class="ach ${at ? 'got' : 'locked'}">
          <span class="ach-emoji" aria-hidden="true">${at ? a.emoji : '🔒'}</span>
          <b>${esc(a.name)}</b><small>${esc(a.desc)}${a.gift ? `<span class="ach-gift">🎁 ${esc(Present.reward(!!at))}</span>` : ''}</small>
          <span class="ach-state">${at ? `✓ ${fmtDate(at)}` : '잠김'}</span></li>`;
      }).join('')}</ul>
    </section>`;
  },

  /* ✍️ The desk he writes his letters at (js/post.js). */
  write() {
    return PostDesk.html();
  },

  letters() {
    const got = Messages.collected();
    const total = Messages.all().length;
    const kept = Post.kept();
    return `<section class="me-sub">
      ${subHead('💌 편지')}
      ${Post.cardHtml()}
      ${
        kept.length
          ? `<section class="section">
        <h2 class="section-title">📮 받은 편지 <small>(${kept.length})</small></h2>
        <div class="post-kept">${kept
          .map((l) => `<button class="paper is-post" data-action="post-read" data-id="${esc(l.id)}"><small>${fmtDateLong(l.at)}</small><span>${esc(l.text.replace(/\s+/g, ' ').slice(0, 90))}${l.text.length > 90 ? '…' : ''}</span></button>`)
          .join('')}</div>
      </section>
      <h2 class="section-title">💌 모은 메시지</h2>`
          : ''
      }
      <div class="card letters-head">
        <p>메시지 ${total}개 중 <b>${got.length}</b>개 발견${total > got.length ? ` · 아직 ${total - got.length}개가 숨어 있어요` : ' · 전부 찾았어요! 💗'}</p>
        <button class="btn primary" data-action="open-message">💌 메시지 열기</button>
      </div>
      ${
        got.length
          ? `<div class="letter-grid">${got.map((m) => `<button class="paper" data-action="read-letter" data-id="${esc(m.id)}"><span>${esc(m.text)}</span></button>`).join('')}</div>`
          : `<div class="card">${emptyState('💌', '아직 편지가 없어요', '첫 메시지를 열어 보세요 — 여기에 차곡차곡 모여요.')}</div>`
      }
    </section>`;
  },

  settings() {
    const s = State.settings;
    const u = State.user;
    return `<section class="me-sub">
      ${subHead('⚙️ 설정')}
      <div class="card">
        <h2 class="card-title">👤 프로필</h2>
        <label class="field"><span>닉네임</span><input data-input="set-nickname" maxlength="24" value="${esc(u.nickname)}"></label>
        <label class="field"><span>아티스트 이름 (커버에 표시돼요)</span><input data-input="set-artist" maxlength="40" value="${esc(u.artistName)}"></label>
      </div>
      <div class="card">
        <h2 class="card-title">🎨 화면과 소리</h2>
        <div class="set-row"><span>효과음</span>
          <button class="switch ${s.soundEnabled ? 'on' : ''}" role="switch" aria-checked="${s.soundEnabled}" data-action="toggle-sound" aria-label="효과음"><i></i></button></div>
        <div class="set-row"><span>움직임 줄이기</span>
          <button class="switch ${s.reduceMotion ? 'on' : ''}" role="switch" aria-checked="${s.reduceMotion}" data-action="toggle-motion" aria-label="움직임 줄이기"><i></i></button></div>
        <div class="set-row"><span>여우 세상을 전체 화면으로 열기</span>
          <button class="switch ${s.foxFullscreen ? 'on' : ''}" role="switch" aria-checked="${s.foxFullscreen}" data-action="toggle-foxfull" aria-label="여우 세상을 전체 화면으로 열기"><i></i></button></div>
        <div class="set-block"><span id="theme-label">테마</span>
          <div class="theme-row" role="radiogroup" aria-labelledby="theme-label">${THEMES.map(
            (t) => `<button class="theme-sw ${s.theme === t.id ? 'on' : ''}" role="radio" aria-checked="${s.theme === t.id}" data-action="set-theme" data-v="${t.id}">
              <i style="background:${t.swatch}"></i><span>${t.name}</span></button>`
          ).join('')}</div></div>
        <div class="set-block"><span id="ln-label">🌙 심야 스튜디오 (00:00–05:00)</span>
          <div class="seg" role="radiogroup" aria-labelledby="ln-label">${[
            ['auto', '자동'],
            ['on', '항상'],
            ['off', '끄기'],
          ]
            .map(([v, l]) => `<button class="seg-btn ${s.lateNight === v ? 'on' : ''}" role="radio" aria-checked="${s.lateNight === v}" data-action="set-latenight" data-v="${v}">${l}</button>`)
            .join('')}</div></div>
        <div class="set-block"><span id="season-label">🍃 여우 세상의 계절</span>
          <div class="seg" role="radiogroup" aria-labelledby="season-label">${[['auto', '달력대로']]
            .concat(SEASONS.map((x) => [x.id, x.name]))
            .map(([v, l]) => `<button class="seg-btn ${(s.season || 'auto') === v ? 'on' : ''}" role="radio" aria-checked="${(s.season || 'auto') === v}" data-action="set-season" data-v="${v}">${l}</button>`)
            .join('')}</div>
          <p class="hint">숲속 풀밭과 농장은 계절을 따라 모습이 바뀌어요. ‘달력대로’면 오늘 날짜의 계절(지금은 ${Weather.seasonDef(Weather.calendar()).name})이에요.</p></div>
      </div>
      <div class="card">
        <h2 class="card-title">💌 메시지</h2>
        <p class="hint">남자친구 전용 공간이에요: 편지를 써서 보내고, 랜덤 메시지와 기념 메시지를 쓰고, 고치고, 지울 수 있어요.</p>
        <div class="chip-row">
          <a class="btn primary" href="#/me/write">✍️ 편지 쓰기</a>
          <a class="btn soft" href="#/me/messages">✏️ 메시지 편집</a>
        </div>
      </div>
      ${
        Gate.on
          ? `<div class="card">
        <h2 class="card-title">🔑 로그인</h2>
        <p class="hint">이 기기는 로그인되어 있어요. 로그아웃해도 노래와 진행 상황은 이 기기에 그대로 남아 있어요.</p>
        ${Cloud.on ? `<ul class="kv"><li><span>${Cloud.writer ? '편지 쓰는 계정' : '로그인한 계정'}</span><b>${esc(Cloud.cfg.email)}</b></li></ul>` : ''}
        <button class="btn soft" data-action="gate-leave">로그아웃</button>
      </div>`
          : ''
      }
      <div class="card">
        <h2 class="card-title">💾 저장 공간과 개인정보</h2>
        <ul class="kv" data-storage><li><span>저장 공간 확인 중…</span></li></ul>
        <p class="hint">${
          Sync.on
            ? '진행 상황과 커버는 이 기기와 우리 서버에 함께 저장돼서, 휴대폰과 컴퓨터에서 같은 내용이 보여요. 그 밖의 곳으로는 나가지 않아요.'
            : Sync.cloud
            ? '진행 상황은 이 기기와 우리만 열 수 있는 클라우드(Supabase)에 함께 저장돼서, 휴대폰과 컴퓨터에서 같은 내용이 보여요. 남자친구의 편지도 거기를 거쳐 와요. 녹음과 커버는 이 기기 밖으로 나가지 않아요.'
            : Cloud.writer
            ? '보낸 편지는 우리만 열 수 있는 클라우드(Supabase)를 거쳐 그녀의 기기로 가요. 그 밖의 것(진행 상황, 녹음, 커버)은 이 기기 밖으로 나가지 않아요.'
            : '녹음은 직접 내려받거나 공유하지 않는 한 이 기기 밖으로 나가지 않아요. 계정도, 업로드도, 추적도 없어요.'
        }</p>
        <p class="hint">팁: 아이폰에서는 “홈 화면에 추가”를 해 두면 Safari가 녹음을 더 잘 보관해요. 아끼는 커버는 내려받아서 오래오래 간직하세요.</p>
      </div>
      <div class="card">
        <h2 class="card-title">🔮 언젠가는</h2>
        <p class="hint">아래 기능은 전용 서버나 AI가 필요해서 이 버전에는 <b>없어요</b> — 없는 걸 있는 척하지 않으려고 적어 둬요:</p>
        <ul class="future">
          <li>AI 보컬 보정 & 마스터링</li><li>음정 보정 (오토튠)</li><li>자동 화음</li>
          <li>보컬 / 반주 분리</li><li>AI 반주 생성</li></ul>
      </div>
      <div class="card danger-zone">
        <h2 class="card-title">⚠️ 초기화</h2>
        <button class="btn soft wide" data-action="reset-progress">↺ 게임 진행 초기화 (녹음은 유지)</button>
        <button class="btn danger wide" data-action="reset-all">🗑️ 모두 삭제</button>
      </div>
    </section>`;
  },

  messages() {
    if (!Door.isOpen) return Door.html('💌 남자친구 전용', '쉿… 여기는 메시지를 쓰는 곳이에요.', '여기를 열면 모든 메시지가 한꺼번에 보여요 — 하나씩 찾는 게 더 재밌답니다.', '안 볼래요, 돌아가기');
    const list = Messages.all();
    const sp = CFG.specialMessages || {};
    return `<section class="me-sub">
      ${subHead('💌 메시지 편집')}
      <div class="card">
        <h2 class="card-title">✍️ 편지 써서 보내기</h2>
        <p class="hint">아래의 메시지는 무작위로 하나씩 열려요. 따로 전하고 싶은 말은 편지로 써서 보내면 여우가 물어다 줘요.</p>
        ${Cloud.writer ? '<p class="hint">⚠️ 편지 쓰는 로그인에서 고친 메시지는 이 기기에만 남고, 그녀에게는 가지 않아요. 미리 보기는 그대로 볼 수 있어요.</p>' : ''}
        <a class="btn primary" href="#/me/write">✍️ 편지 쓰기</a>
      </div>
      <div class="card">
        <h2 class="card-title">🔒 여는 날</h2>
        <p class="hint">${Opening.noteHtml()}</p>
        ${
          Opening.at && Date.now() < Opening.at
            ? `<div class="set-row"><span>이 기기에서만 미리 열어 두기</span>
          <button class="switch ${Opening.early ? 'on' : ''}" role="switch" aria-checked="${Opening.early}" data-action="opening-early" aria-label="이 기기에서만 미리 열어 두기"><i></i></button></div>
        <p class="hint">켜 두면 이 기기에서는 지금부터 열려 있어요. 다른 기기에는 아무 영향이 없어요.</p>`
            : ''
        }
      </div>
      <div class="card">
        <h2 class="card-title">👋 ${esc(OWNER_NAME)}의 첫인사</h2>
        <p class="hint">${Meet.note()}</p>
        <p class="hint">미리 보기는 처음 온 사람에게 하듯 처음부터 끝까지 보여 주지만, 아무것도 저장되지 않아요(이름 짓기는 건너뛰어요). ${esc(josa(OWNER_NAME, '이/가'))} 하는 말은 <code>js/config.js</code>의 <code>meetLines</code>로 바꿀 수 있어요.</p>
        <button class="btn soft" data-action="meet-rehearse">👀 미리 보기</button>
      </div>
      <div class="card">
        <h2 class="card-title">💬 ${esc(OWNER_NAME)}의 수다</h2>
        <p class="hint">${Chat.note()}</p>
        <p class="hint">미리 보기는 볼 때마다 다른 이야기를 보여 주고, 아무것도 저장되지 않아요. 직접 넣고 싶은 이야기는 <code>js/config.js</code>의 <code>ownerChats</code>에 적으면 돼요.</p>
        <button class="btn soft" data-action="chat-rehearse">👀 미리 보기</button>
      </div>
      <div class="card">
        <h2 class="card-title">🎁 100일 선물</h2>
        <p class="hint">${Present.note()}</p>
        <p class="hint">미리 보기는 여우 세상에서 처음부터 끝까지 그대로 보여 주지만, 아무것도 저장되지 않아요. 로렐라이가 하는 말은 <code>js/config.js</code>의 <code>presentLines</code>로 바꿀 수 있어요.</p>
        <button class="btn soft" data-action="present-rehearse">👀 미리 보기</button>
      </div>
      <div class="card">
        <h2 class="card-title">🎃 핼러윈</h2>
        <p class="hint">${Halloween.note()}</p>
        <p class="hint">미리 보기는 마당이 핼러윈으로 꾸며진 채 처음부터 끝까지 보여 주지만, 아무것도 저장되지 않아요. ${esc(josa(OWNER_NAME, '이/가'))} 하는 말은 <code>js/config.js</code>의 <code>halloweenLines</code>로 바꿀 수 있어요.</p>
        <button class="btn soft" data-action="halloween-rehearse">👀 미리 보기</button>
      </div>
      <div class="card">
        <h2 class="card-title">🎄 크리스마스</h2>
        <p class="hint">${Christmas.note()}</p>
        <p class="hint">미리 보기는 마당이 크리스마스로 꾸며진 채 (계절이 바뀌는 곳이면 눈 오는 겨울로) 처음부터 끝까지 보여 주지만, 아무것도 저장되지 않아요. ${esc(josa(OWNER_NAME, '이/가'))} 하는 말은 <code>js/config.js</code>의 <code>christmasLines</code>로 바꿀 수 있어요.</p>
        <button class="btn soft" data-action="christmas-rehearse">👀 미리 보기</button>
      </div>
      <div class="card">
        <h2 class="card-title">＋ 새 메시지</h2>
        <textarea class="msg-new" data-msg-new rows="2" maxlength="280" placeholder="다정한 한마디를 적어 보세요…"></textarea>
        <button class="btn primary" data-action="msg-add">메시지 추가</button>
      </div>
      <div class="card">
        <h2 class="card-title">랜덤 메시지 <small>(${list.length})</small></h2>
        <ul class="msg-list">${list
          .map(
            (m) => `<li>
              <textarea rows="2" maxlength="280" data-change="msg-edit" data-id="${esc(m.id)}" aria-label="메시지">${esc(m.text)}</textarea>
              <button class="icon-btn small" data-action="msg-delete" data-id="${esc(m.id)}" aria-label="메시지 삭제">🗑️</button></li>`
          )
          .join('')}</ul>
        <p class="hint">바꾼 내용은 자동으로 저장돼요. 기본 메시지는 <code>js/config.js</code>에 있어요.</p>
      </div>
      <div class="card">
        <h2 class="card-title">✨ 특별 메시지</h2>
        ${Object.keys(SPECIAL_LABELS)
          .map(
            (k) => `<label class="field"><span>${SPECIAL_LABELS[k]}</span>
              <input data-change="special-edit" data-key="${k}" maxlength="200" value="${esc(State.messages.special[k] || '')}" placeholder="${esc(sp[k] || '')}"></label>`
          )
          .join('')}
        <p class="hint">비워 두면 회색으로 보이는 기본 문구가 쓰여요.</p>
      </div>
      <button class="btn ghost wide" data-action="msg-reset">↺ 모든 메시지를 기본값으로</button>
    </section>`;
  },

  async fillStorage() {
    const ul = $('[data-storage]');
    if (!ul) return;
    const rows = [];
    rows.push(`<li><span>녹음 저장 방식</span><b>${DB.isPersistent() ? 'IndexedDB ✓' : '임시 (메모리에만) ⚠️'}</b></li>`);
    rows.push(`<li><span>이 기기의 커버</span><b>${Music.released().length}곡</b></li>`);
    if (Sync.live) {
      const state = {
        ok: Sync.cloud ? '<b>진행 상황 켜짐 ✓</b>' : '<b>켜짐 ✓</b>',
        offline: '<b>서버에 연결할 수 없어요 ⚠️</b>',
        locked: '<button class="btn soft small" data-action="sync-unlock">🔑 비밀번호 입력</button>',
      }[Sync.status];
      rows.push(`<li><span>다른 기기와 동기화</span>${state}</li>`);
    }
    try {
      if (navigator.storage && navigator.storage.estimate) {
        const est = await navigator.storage.estimate();
        rows.push(`<li><span>사용 중인 공간</span><b>${fmtBytes(est.usage || 0)}${est.quota ? ` / ${fmtBytes(est.quota)}` : ''}</b></li>`);
      }
      let persisted = null;
      if (navigator.storage && navigator.storage.persisted) persisted = await navigator.storage.persisted();
      if (persisted === true) rows.push('<li><span>자동 정리로부터 보호</span><b>보호 중 🔒</b></li>');
      else if (persisted === false && navigator.storage.persist) {
        rows.push('<li><span>자동 정리로부터 보호</span><button class="btn soft small" data-action="request-persist">🔒 내 녹음 보호하기</button></li>');
      }
    } catch (e) {
      /* estimate not available */
    }
    if (ul.isConnected) ul.innerHTML = rows.join('');
  },
};

/* ------------------------------------------------------------------
   Actions
   ------------------------------------------------------------------ */
Object.assign(Actions, {
  'open-wrapped': () => Wrapped.open(),
  'wk-tap': (el) => {
    $$('.wk-col').forEach((c) => c.classList.toggle('show', c === el));
  },
  'read-letter': (el) => {
    const m = Messages.all().find((x) => x.id === el.dataset.id);
    if (!m) return;
    Sfx.play('heart');
    UI.open(
      `<div class="message-modal">${letterHtml(m.text, { cls: 'big' })}
        <div class="dialog-actions one"><button class="btn primary" data-action="close-overlay">💗 닫기</button></div></div>`,
      { cls: 'is-dialog', label: '편지' }
    );
  },
  'toggle-sound': () => {
    State.settings.soundEnabled = !State.settings.soundEnabled;
    Store.save();
    UI.updateHud();
    if (State.settings.soundEnabled) Sfx.play('pop');
    if (Router.is('me')) Router.refresh();
  },
  'toggle-foxfull': () => {
    State.settings.foxFullscreen = !State.settings.foxFullscreen;
    Store.save();
    Router.refresh();
  },
  'toggle-motion': () => {
    State.settings.reduceMotion = !State.settings.reduceMotion;
    Store.save();
    Theme.apply();
    Router.refresh();
  },
  'set-theme': (el) => {
    State.settings.theme = el.dataset.v;
    Store.save();
    Theme.apply();
    Router.refresh();
  },
  'set-latenight': (el) => {
    State.settings.lateNight = el.dataset.v;
    Store.save();
    Theme.apply();
    Router.refresh();
  },
  'set-season': (el) => {
    State.settings.season = el.dataset.v;
    Store.save();
    Pet.refresh(); // (the foxes' world, if it is drawn, changes its season)
    Router.refresh();
  },
  'request-persist': async () => {
    let ok = false;
    try {
      ok = await navigator.storage.persist();
    } catch (e) {
      ok = false;
    }
    UI.toast(ok ? '녹음이 보호되고 있어요 🔒' : '브라우저가 허용하지 않았어요 — 홈 화면에 추가하거나 북마크해 두면 도움이 돼요.', { icon: ok ? '🔒' : 'ℹ️', ms: 3600 });
    Views.me.fillStorage();
  },
  'sync-unlock': () => Sync.askKey(),
  'reset-progress': async () => {
    const ok = await UI.confirm({
      icon: '↺',
      title: '게임 진행을 초기화할까요?',
      text: '도파민, XP, 코인, 레벨, 업적, 미션, 그리고 여우와 여우의 물건들이 처음으로 돌아가요. 커버, 앨범, 메시지는 그대로 남아요.',
      ok: '초기화',
      danger: true,
    });
    if (!ok) return;
    Store.resetProgress();
    Game.ensureDaily();
    UI.lastDopa = 0;
    UI.updateHud();
    Pet.thumbCache = {};
    UI.toast('초기화했어요 — 새로운 시작 ✨', { icon: '↺' });
    Router.go('#/home');
  },
  'reset-all': async () => {
    const ok = await UI.confirm({
      icon: '🗑️',
      title: '모두 삭제할까요?',
      text: Sync.on
        ? '이 기기와 서버에 있는 녹음, 커버, 앨범, 진행 상황, 설정이 전부 지워져요. 다른 기기에 남아 있는 것은 그 기기에서도 지워야 사라져요. 되돌릴 수 없어요.'
        : '이 기기에 있는 녹음, 커버, 앨범, 진행 상황, 설정이 전부 지워져요. 간직할 것은 먼저 내려받아 두세요. 되돌릴 수 없어요.',
      ok: '모두 삭제',
      danger: true,
    });
    if (!ok) return;
    const sure = await UI.confirm({ icon: '⚠️', title: '정말 삭제할까요?', text: '마지막 확인이에요 — 모든 녹음이 사라져요.', ok: '네, 전부 삭제해요', danger: true });
    if (!sure) return;
    CoverHost.stopAll();
    await Store.resetAll();
    window.onbeforeunload = null;
    location.hash = '#/home';
    location.reload();
  },
  'bf-unlock': () => {
    if (Door.pin()) return; // (no passcode in js/config.js: the door opens with a tap)
    Door.isOpen = true;
    Router.refresh();
  },
  'msg-add': () => {
    const ta = $('[data-msg-new]');
    const text = ta ? ta.value.trim() : '';
    if (!text) {
      UI.toast('먼저 메시지를 적어 주세요 💌', { icon: '✏️' });
      return;
    }
    Messages.add(text);
    UI.toast('메시지를 추가했어요 💌', { icon: '💌' });
    Router.refresh();
  },
  'msg-delete': async (el) => {
    const ok = await UI.confirm({ icon: '🗑️', title: '이 메시지를 삭제할까요?', ok: '삭제', danger: true });
    if (!ok) return;
    Messages.remove(el.dataset.id);
    Router.refresh();
  },
  'msg-reset': async () => {
    const ok = await UI.confirm({ icon: '↺', title: '모든 메시지를 기본값으로 되돌릴까요?', text: '직접 쓴 메시지와 고친 내용이 사라지고, 기본 메시지가 돌아와요.', ok: '되돌리기', danger: true });
    if (!ok) return;
    Messages.resetToDefaults();
    Router.refresh();
  },
});

Object.assign(Inputs, {
  // A passcode of digits is tried as soon as it is as long as the real one: a phone's number pad has no "go" key, and
  // it covers "열기". (One of letters waits for the button — it may still be in the middle of being composed.)
  'door-pin': (el) => {
    const pin = Door.pin();
    if (/^\d+$/.test(pin) && el.value.trim().length >= pin.length) Door.knock(el);
  },
  'set-nickname': (el) => {
    const old = State.user.nickname;
    State.user.nickname = el.value.trim().slice(0, 24);
    if (!State.user.artistName || State.user.artistName === old) {
      State.user.artistName = State.user.nickname;
      const a = $('[data-input="set-artist"]');
      if (a) a.value = State.user.artistName;
    }
    Store.save();
  },
  'set-artist': (el) => {
    State.user.artistName = el.value.trim().slice(0, 40);
    Store.save();
  },
});

Object.assign(Changes, {
  'msg-edit': (el) => {
    const text = el.value.trim();
    if (!text) return;
    Messages.update(el.dataset.id, text);
    UI.toast('저장했어요', { icon: '✓', ms: 1200 });
  },
  'special-edit': (el) => {
    State.messages.special[el.dataset.key] = el.value.trim();
    Store.save();
    UI.toast('저장했어요', { icon: '✓', ms: 1200 });
  },
});

/* 🔑 The published site (js/gate.js): log out on this device. */
Actions['gate-leave'] = async () => {
  if (await UI.confirm({ icon: '🔑', title: '로그아웃할까요?', text: `이 기기에서만 로그아웃해요. 다시 들어오려면 ${Gate.email ? '이메일과' : '아이디와'} 비밀번호가 필요해요.`, ok: '로그아웃' })) Gate.leave();
};
