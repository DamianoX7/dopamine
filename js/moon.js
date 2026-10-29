'use strict';
/* ==================================================================
   🌙 The moon — the real one, over the foxes' world.

   The sky over the foxes is the sky over Incheon. The sun goes down
   when it goes down there: the light turns gold, then blue, and from
   dusk it is night in the foxes' world — the lamps are lit, the
   fireflies are out (the foxes themselves stay up until midnight, as
   ever: js/pet.js, Pet.mood). The moon is tonight's moon: as full as
   it is, up when it is up, tilted the way it is. Nothing is looked
   up: it is all worked out from the clock, with a short form of the
   textbook formulas (good to a few minutes).

   At night a button over the foxes' world turns the view up to the
   sky (js/fox/world.js: gaze; js/fox/heavens.js draws it): the moon
   among the stars, and the foxes looking up at it with her.

   And on the night of the full moon Lorelei calls her: the foxes sing
   to the moon together, and she makes a wish (if the foxes are asleep
   already: quietly, just the two of them). Once a full moon, from dusk
   until dawn. Her wishes are kept (State.moon.wishes), and can be read
   again under the moon.
   ================================================================== */

// where the sky is (Incheon); the sun this many degrees under the horizon: night — and this high over it: the light begins
// to turn gold; what she is given for a wish; how long a wish may be
const MOON = { lat: 37.4563, lng: 126.7052, dark: -4, gold: 8, coins: 30, wish: 60 };
const SYNODIC = 29.530588853; // days from one full moon to the next, on the average

/* What the moon is called, by how much of it is lit — and whether it is growing. */
const MOON_PHASES = {
  new: { emoji: '🌑', name: '삭' },
  waxingCrescent: { emoji: '🌒', name: '초승달' },
  firstQuarter: { emoji: '🌓', name: '상현달' },
  waxingGibbous: { emoji: '🌔', name: '차오르는 달' },
  full: { emoji: '🌕', name: '보름달' },
  waningGibbous: { emoji: '🌖', name: '기우는 달' },
  lastQuarter: { emoji: '🌗', name: '하현달' },
  waningCrescent: { emoji: '🌘', name: '그믐달' },
};

/*
   What Lorelei says on the night of the full moon. `moonLines` in js/config.js replaces any part of it, in your own
   words. A part with several versions ([[…], […]]) has one of them on each full moon, in turn: the story comes round
   every month. {nick} = what she is called; {next} = the night of the next full moon ("11월 24일"); {when} = the moment
   the moon is quite full ("오늘 오후 1시 12분").
*/
const MOON_LINES = {
  call: ['{nick}! 하늘 좀 봐! 🌕', '오늘 보름달 떴어! 🌕'], // (over her head, before the window opens)
  hello: [
    ['앗, 왔구나! 마침 잘 왔어.', '오늘 밤은 보름달이 뜨는 날이거든 🌕'],
    ['기다리고 있었어! 오늘 무슨 날인지 알아?', '바로 보름달 뜨는 날이야 🌕'],
    ['왔구나! 오늘 밤 유난히 밝지 않아?', '보름달이 떴거든 🌕'],
  ],
  look: [['저기 봐, 진짜 동그랗지?'], ['저 달 좀 봐. 오늘따라 더 환해.'], ['저기! 꼭 쟁반 같지?']], // (the view turns up to the moon)
  exactPast: ['달이 딱 꽉 찬 건 {when}이었대.'],
  exactSoon: ['달이 딱 꽉 차는 건 {when}이래.'],
  howl: [['여우들은 보름달이 뜨면 다 같이 노래를 불러.', '들어 봐!'], ['쉿, 여우들이 노래하려나 봐.'], ['여우들도 보름달이 반가운가 봐.', '잘 들어 봐!']], // (…and they sing)
  sung: [['멋지지? 달한테 인사한 거야 🎶'], ['헤헤, 오늘따라 목청이 좋네 🎶'], ['달님도 들었을 거야 🎶']],
  asleep: ['쉿… 여우들은 벌써 꿈나라야.', '오늘은 우리 둘이서만 조용히 보자.'], // (instead, when the foxes are asleep)
  alone: ['여우들이 있었으면 같이 노래했을 텐데…', '오늘은 우리 둘이서 보자.'], //    (…or nobody is at home)
  wishAsk: ['보름달한테 소원을 빌면 이루어진대.', '너도 하나 빌어 봐. 무슨 소원 빌래?'], // (her wish: a few words, or kept to herself)
  wished: ['좋은 소원이다!', '보름달이 꼭 들어줄 거야 ✨'],
  kept: ['마음속으로 빌었구나.', '말 안 해도 보름달은 다 알아 ✨'],
  next: ['다음 보름달은 {next}이야.', '그때 또 같이 보자!'],
  bye: ['오늘 밤 달이 참 예쁘다. 잘 자, {nick}! 🌙'],
};

/* The sky's arithmetic: where the sun and the moon stand, seen from Incheon (after Meeus, Astronomical Algorithms — the larger terms only). */
const Astro = (() => {
  const RAD = Math.PI / 180;
  const TILT = 23.4397 * RAD; // of the earth's axis
  const { sin, cos, tan, asin, atan2 } = Math;
  const days = (ms) => ms / 86400000 - 10957.5; // since noon on the 1st of January 2000
  const ra = (l, b) => atan2(sin(l) * cos(TILT) - tan(b) * sin(TILT), cos(l));
  const dec = (l, b) => asin(sin(b) * cos(TILT) + cos(b) * sin(TILT) * sin(l));
  const wrap = (a) => a - 2 * Math.PI * Math.floor((a + Math.PI) / (2 * Math.PI)); // into -π … π

  /** The sun's longitude along the ecliptic (from the equinox of the day, as the moon's is). */
  const sunLon = (d) => {
    const M = RAD * (357.52911 + 0.98560028 * d);
    return RAD * (280.46646 + 0.98564736 * d + (1.914602 - 0.000000132 * d) * sin(M) + 0.019993 * sin(2 * M) + 0.000289 * sin(3 * M) - 0.00569);
  };

  /** The moon's longitude and latitude along the ecliptic, and how far away it is (km). */
  const moonAt = (d) => {
    const L = RAD * (218.3164477 + 13.17639648 * d);
    const D = RAD * (297.8501921 + 12.19074912 * d); // how far it is from the sun
    const S = RAD * (357.5291092 + 0.98560028 * d); //  the sun's anomaly
    const M = RAD * (134.9633964 + 13.06499295 * d); // …and the moon's
    const F = RAD * (93.272095 + 13.22935024 * d);
    const l = L + RAD * (6.288774 * sin(M) + 1.274027 * sin(2 * D - M) + 0.658314 * sin(2 * D) + 0.213618 * sin(2 * M) - 0.185116 * sin(S) - 0.114332 * sin(2 * F)
      + 0.058793 * sin(2 * D - 2 * M) + 0.057066 * sin(2 * D - S - M) + 0.053322 * sin(2 * D + M) + 0.045758 * sin(2 * D - S) - 0.040923 * sin(S - M) - 0.03472 * sin(D) - 0.030383 * sin(S + M));
    const b = RAD * (5.128122 * sin(F) + 0.280602 * sin(M + F) + 0.277693 * sin(M - F) + 0.173237 * sin(2 * D - F) + 0.055413 * sin(2 * D - M + F) + 0.046271 * sin(2 * D - M - F));
    const dist = 385000.56 - 20905.355 * cos(M) - 3699.111 * cos(2 * D - M) - 2955.968 * cos(2 * D) - 569.925 * cos(2 * M);
    return { l, b, dist };
  };

  /** Where in the sky a body at right ascension `a` and declination `de` stands: { alt, az } (az from the south, westwards). */
  const place = (d, a, de) => {
    const phi = RAD * MOON.lat;
    const H = RAD * (280.46061837 + 360.98564736629 * d + MOON.lng) - a; // (the sidereal time there, less where it stands)
    return { alt: asin(sin(phi) * sin(de) + cos(phi) * cos(de) * cos(H)), az: atan2(sin(H), cos(H) * sin(phi) - tan(de) * cos(phi)) };
  };

  /** …as an arrow in the sky round her: east, north, up. */
  const arrow = ({ alt, az }) => [-sin(az) * cos(alt), -cos(az) * cos(alt), sin(alt)];
  const dot = (p, q) => p[0] * q[0] + p[1] * q[1] + p[2] * q[2];
  const cross = (p, q) => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const unit = (p) => {
    const n = Math.hypot(p[0], p[1], p[2]) || 1;
    return [p[0] / n, p[1] / n, p[2] / n];
  };

  return {
    RAD,
    wrap,

    sun(ms) {
      const d = days(ms);
      const l = sunLon(d);
      return place(d, ra(l, 0), dec(l, 0));
    },

    /** The moon: where it stands (alt, az), how much of it is lit and on which side, which way its north is. */
    moon(ms) {
      const d = days(ms);
      const m = moonAt(d);
      const ls = sunLon(d);
      const pos = place(d, ra(m.l, m.b), dec(m.l, m.b));
      const lag = wrap(m.l - ls); // how far it is round from the sun: 0 new, ±π full; more than 0 while it grows
      const psi = Math.acos(cos(m.b) * cos(lag)); // (…as an angle in space)
      const i = atan2(149598000 * sin(psi), m.dist - 149598000 * cos(psi)); // the angle sun – moon – earth
      // which way its lit side and its north are, as she looks at it: the sun, and the pole of the ecliptic (the moon's
      // own north is all but that), taken across the face of it — right, up
      const to = arrow(pos);
      const up = unit(dot(to, [0, 0, 1]) > 0.9999 ? [0, 1, 0] : [-to[0] * to[2], -to[1] * to[2], 1 - to[2] * to[2]]);
      const right = cross(to, up);
      const across = (p) => {
        const k = dot(p, to);
        const q = [p[0] - k * to[0], p[1] - k * to[1], p[2] - k * to[2]];
        const n = Math.hypot(dot(q, right), dot(q, up)) || 1;
        return [dot(q, right) / n, dot(q, up) / n];
      };
      const sun = arrow(place(d, ra(ls, 0), dec(ls, 0)));
      const pole = arrow(place(d, RAD * 270, RAD * 66.5607));
      return {
        alt: pos.alt,
        az: pos.az,
        dist: m.dist,
        fraction: (1 + cos(i)) / 2,
        phase: ((lag / (2 * Math.PI)) + 1) % 1, // 0 new, 0.5 full
        waxing: lag > 0,
        limb: across(sun),
        north: across(pole),
      };
    },

    /** How far round the moon is from being full (radians): 0 full, more than 0 after it. */
    sinceFull(ms) {
      const d = days(ms);
      return wrap(moonAt(d).l - sunLon(d) - Math.PI);
    },

    /** The moment it is full that is nearest to `ms`. */
    fullNear(ms) {
      let t = ms;
      for (let n = 0; n < 6; n++) t -= (this.sinceFull(t) / (2 * Math.PI)) * SYNODIC * 86400000;
      return t;
    },

    /** How high over the horizon it must stand to be up (the moon is near: its parallax lifts the line), degrees. */
    horizon(body, ms) {
      if (body === 'sun') return -0.833;
      const parallax = Math.asin(6378.14 / moonAt(days(ms)).dist) / RAD;
      return 0.7275 * parallax - 0.5667;
    },
  };
})();

const Moon = {
  skew: 0, //    (for trying things out: a clock that is put forward — see test)
  playing: false, //    Lorelei and the foxes have the full moon, right now
  rehearsing: false, // he has asked to be shown how it will be (nothing of it is kept)
  timer: 0,
  litWas: null, // whether it was night, and the moon up, when the foxes' world last looked (see FoxRoom.sky)

  time() {
    return Date.now() + this.skew;
  },

  /* The night `t` belongs to — the evening's date: the small hours, and the morning, are the night before. */
  night(t = this.time()) {
    return dateKey(new Date(t - 12 * 3600000));
  },

  /* …and the night the moon of `full` (a moment) is full in: the one whose midnight is nearest to it. */
  nightOf(full) {
    const d = new Date(full);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + (d.getHours() >= 12 ? 1 : 0)).getTime();
    return this.night(midnight - 3600000);
  },

  /* Is it the night of the full moon? */
  fullNight(t = this.time()) {
    return this.nightOf(Astro.fullNear(t)) === this.night(t);
  },

  /* The next full moon's night, from tonight on: { at (the moment it is full), night ('YYYY-MM-DD') }. */
  nextFull(t = this.time()) {
    let at = Astro.fullNear(t);
    if (this.nightOf(at) < this.night(t)) at = Astro.fullNear(at + SYNODIC * 86400000);
    return { at, night: this.nightOf(at) };
  },

  /* …the one after tonight's. */
  afterThis(t = this.time()) {
    const n = this.nextFull(t);
    return n.night === this.night(t) ? this.nextFull(n.at + 3 * 86400000) : n;
  },

  /*
     The sky as it is now: { dark, gold, blue, sun, moon }.
     dark  is it night in the foxes' world? (the sun MOON.dark° under the horizon — or the site's late-night mode is on)
     gold  how far the light has turned to a sunset's, 0 … 1 (the sun MOON.gold° high … on the horizon)
     blue  …and from that on to the night's, 0 … 1 (the sun on the horizon … MOON.dark° under it)
     sun   how high the sun is (°) — sunAz: which way it is (radians: from the south, westwards)
     moon  { up, alt, az (radians: from the south, westwards), fraction, phase, waxing, age, id, name, emoji, limb, north, full }
           limb, north: which way its lit side and its north are, as she looks at it ([right, up])
  */
  now(t = this.time()) {
    const at = Astro.sun(t);
    const sun = at.alt / Astro.RAD;
    const s = State.settings.lateNight; // (the site's late-night mode, as js/main.js has it — at the time asked about)
    const dark = s === 'on' || (s === 'auto' && isLateNightHour(new Date(t))) || sun < MOON.dark;
    const gold = dark ? 1 : clamp((MOON.gold - sun) / MOON.gold, 0, 1);
    const blue = dark ? 1 : clamp(-sun / -MOON.dark, 0, 1);
    return { dark, gold, blue, sun, sunAz: at.az, moon: this.moon(t) };
  },

  moon(t = this.time()) {
    const m = Astro.moon(t);
    const full = this.fullNight(t);
    const id = this.phaseId(m.fraction, m.waxing, full);
    return {
      up: m.alt / Astro.RAD > Astro.horizon('moon', t),
      alt: m.alt,
      az: m.az,
      fraction: m.fraction,
      phase: m.phase,
      waxing: m.waxing,
      age: m.phase * SYNODIC,
      id,
      name: MOON_PHASES[id].name,
      emoji: MOON_PHASES[id].emoji,
      limb: m.limb,
      north: m.north,
      full,
    };
  },

  phaseId(fraction, waxing, full) {
    if (full) return 'full'; // (the night of the full moon: only then is it called so — the night before, it is all but full)
    if (fraction < 0.025) return 'new';
    if (Math.abs(fraction - 0.5) < 0.07) return waxing ? 'firstQuarter' : 'lastQuarter';
    if (fraction < 0.5) return waxing ? 'waxingCrescent' : 'waningCrescent';
    return waxing ? 'waxingGibbous' : 'waningGibbous';
  },

  /* Is it night in the foxes' world? */
  dark() {
    return this.now().dark;
  },

  /* …in the dark of the full moon's night, at `t`? (Then the sky is clear, or nearly: js/weather.js.) */
  fullDark(t = this.time()) {
    return this.fullNight(t) && this.now(t).dark;
  },

  /* When the moon (or the sun: `body`) next rises and sets, within a day and a bit: { rise, set } (moments, or null). */
  riseSet(body = 'moon', t = this.time()) {
    const alt = (ms) => (body === 'sun' ? Astro.sun(ms).alt : Astro.moon(ms).alt) / Astro.RAD - Astro.horizon(body, ms);
    const STEP = 10 * 60000;
    const out = { rise: null, set: null };
    let a = alt(t);
    for (let ms = t + STEP; ms <= t + 30 * 3600000 && !(out.rise && out.set); ms += STEP) {
      const b = alt(ms);
      if ((a <= 0) !== (b <= 0)) {
        const at = ms - STEP + (STEP * a) / (a - b);
        if (b > 0 && !out.rise) out.rise = at;
        if (b <= 0 && !out.set) out.set = at;
      }
      a = b;
    }
    return out;
  },

  /* "밤 10시 3분", "새벽 2시" — the time of a moment as she would say it. */
  clock(at) {
    const d = new Date(at);
    const h = d.getHours();
    const part = h < 5 ? '새벽' : h < 9 ? '아침' : h < 12 ? '오전' : h < 18 ? '오후' : h < 21 ? '저녁' : '밤';
    return `${part} ${h % 12 || 12}시${d.getMinutes() ? ` ${d.getMinutes()}분` : ''}`;
  },

  /* …and when it is still to come: "새벽 3시", "내일 오후 12시 29분" (the small hours after midnight are still tonight). */
  soon(at, t = this.time()) {
    const days = daysBetween(dateKey(new Date(t)), dateKey(new Date(at)));
    return `${days >= 1 && !(days === 1 && new Date(at).getHours() < 5) ? '내일 ' : ''}${this.clock(at)}`;
  },

  /* …or by the calendar, before or after: "오늘 오후 1시 12분", "어제 밤 11시". */
  when(at, t = this.time()) {
    const days = daysBetween(dateKey(new Date(t)), dateKey(new Date(at)));
    return `${{ '-1': '어제 ', 0: '오늘 ', 1: '내일 ' }[days] || ''}${this.clock(at)}`;
  },

  /* "11월 24일" */
  date(key) {
    const [, m, d] = key.split('-').map(Number);
    return `${m}월 ${d}일`;
  },

  /* The emoji for the sky at night, on the chip over the foxes' world: tonight's moon — or stars, while it is down. */
  emoji() {
    const m = this.moon();
    return m.up && m.id !== 'new' ? m.emoji : '✨';
  },

  /* A sentence about the moon, for whoever taps that chip at night. */
  describe() {
    const t = this.time();
    const m = this.moon(t);
    const rs = this.riseSet('moon', t);
    let s;
    if (m.id === 'new') s = '오늘은 달이 해와 같은 쪽에 있어서 보이지 않는 밤이에요. 대신 별이 잘 보여요.';
    else if (m.up) s = `오늘 밤 달은 ${josa(m.name, '이에요/예요')}.${rs.set ? ` ${this.soon(rs.set, t)}에 져요.` : ''}`;
    else s = `오늘 달은 ${josa(m.name, '이에요/예요')}.${rs.rise ? ` 달은 ${this.soon(rs.rise, t)}에 떠요.` : ''}`;
    const next = this.nextFull(t);
    if (m.full) s += ' 오늘은 보름달 뜨는 날이에요! 🌕';
    else s += ` 보름달까지 ${Math.max(1, daysBetween(this.night(t), next.night))}일 남았어요.`;
    return s;
  },

  /* The card over the night sky (FoxRoom.gazeCard): tonight's moon, in a few words. */
  card() {
    const t = this.time();
    const m = this.moon(t);
    const rs = this.riseSet('moon', t);
    const left = daysBetween(this.night(t), this.nextFull(t).night);
    const until = m.full ? '오늘은 보름달 뜨는 날!' : `보름달까지 ${left}일`;
    let head;
    let lines;
    if (m.id === 'new') {
      head = `${m.emoji} 달이 쉬는 밤 (삭)`;
      lines = ['달이 해와 같은 쪽에 있어서 보이지 않아요', '별이 제일 잘 보이는 밤이에요 ✨'];
    } else if (m.up) {
      head = `${m.emoji} ${m.name}`;
      lines = [`달의 ${Math.round(m.fraction * 100)}%가 빛나요 · ${until}`, rs.set ? `${this.soon(rs.set, t)}에 져요` : ''];
    } else if (rs.rise && this.night(rs.rise) === this.night(t)) {
      head = '✨ 달이 아직 안 떴어요';
      lines = [`${this.soon(rs.rise, t)}에 ${josa(m.name, '이/가')} 떠요`, until];
    } else {
      head = '✨ 오늘 밤 달은 벌써 졌어요';
      lines = [rs.rise ? `다시 뜨는 건 ${this.soon(rs.rise, t)}` : '', until];
    }
    return `<b>${esc(head)}</b>${lines.filter(Boolean).map((l) => `<small>${esc(l)}</small>`).join('')}`;
  },

  /* Her wishes, the newest first. */
  showWishes() {
    const list = State.moon.wishes.slice().reverse();
    const year = String(new Date().getFullYear());
    const day = (key) => (key.startsWith(year) ? this.date(key) : `${key.slice(0, 4)}년 ${this.date(key)}`);
    const ov = UI.open(
      `<div class="juke moon-wishes">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 class="juke-title">🌕 보름달에 빈 소원 <small>${list.length}</small></h2>
        <p class="hint">보름달 뜨는 밤마다 하나씩 빌었어요.</p>
        <ul class="wish-list">${list.map((w) => `<li><span class="wish-day">${esc(day(w.night))}</span><span class="wish-text">${w.text ? esc(w.text) : '<i>마음속으로 빈 소원</i>'}</span></li>`).join('')}</ul>
        <div class="dialog-actions one"><button class="btn soft" data-ov-cancel>닫기</button></div>
      </div>`,
      { cls: 'is-juke', label: '보름달에 빈 소원' }
    );
    $('[data-ov-cancel]', ov.panel).addEventListener('click', () => UI.close(ov));
  },

  /* The card on Home on the night of the full moon, until she has made her wish. */
  cardHtml() {
    if (!this.waiting()) return '';
    return `<button class="card moon-card" data-action="fox-open">
      <span class="moon-ico" aria-hidden="true">🌕</span>
      <span class="moon-text"><b>오늘 밤은 보름달이에요</b><small>여우 세상에서 ${esc(josa(OWNER_NAME, '이/가'))} 기다려요 · 같이 소원 빌어요</small></span>
      <span class="chev" aria-hidden="true">›</span>
    </button>`;
  },

  /* …and the fox says so, once a full moon. */
  hail() {
    const night = this.night();
    if (!this.waiting() || State.moon.hailed === night) return;
    State.moon.hailed = night;
    Store.save();
    setTimeout(() => {
      if (!Router.is('home') || UI.stack.length) return;
      if (!Pet.home().length) UI.toast('오늘 밤은 보름달이에요! 여우 세상에서 같이 봐요 🌕', { icon: '🌕', ms: 4200 });
      else UI.petPop('오늘 보름달 떴어! 같이 보러 가자 🌕');
    }, 1600);
  },

  /* What to say when the sky has just turned while she is watching (or nothing): the sun gone down, come up; the moon risen. */
  news(was, now) {
    if (!was) return null;
    if (now.dark !== was.dark) return now.dark ? { icon: '🌙', text: '해가 졌어요. 여우 세상에 밤이 왔어요.' } : { icon: '🌅', text: '해가 떴어요. 좋은 아침이에요!' };
    if (now.dark && now.up && !was.up) return { icon: this.moon().emoji, text: '달이 떴어요!' };
    return null;
  },

  // ---------------------------------------------------------------- the night of the full moon

  /* Is there a full moon for her tonight — up, in the dark, and not yet wished on? (Not before the foxes' world opened, nor before her first hello.) */
  waiting() {
    const t = this.time();
    if (!this.fullNight(t)) return false;
    const sky = this.now(t);
    return sky.dark && sky.moon.up && State.onboarded && State.pet.introduced && !Opening.shut() && State.moon.night !== this.night(t) && !Cloud.writer;
  },

  /* One of a part's versions, the same all night (a different one each full moon). */
  lines(key) {
    const mine = (CFG.moonLines || {})[key];
    let list = mine && mine.length ? [].concat(mine) : MOON_LINES[key];
    if (Array.isArray(list[0])) list = list[Math.floor(keyToUTC(this.night()) / (SYNODIC * 86400000)) % list.length];
    const t = this.time();
    const names = { nick: State.user.nickname || '너', next: this.date(this.afterThis(t).night), when: this.when(Astro.fullNear(t), t) };
    return list.map((s) => String(s).replace(/\{(nick|next|when)(?::([^}]+))?\}/g, (m, who, pair) => (pair ? josa(names[who], pair) : names[who])));
  },

  /* The story, page by page (js/talk.js), with what the foxes' world is to show at each. */
  pages() {
    const show = (step) => OwnerSays.show(step);
    const L = (key) => this.lines(key);
    const cued = (list, cue) => list.map((text, i) => (i ? text : { text, cue }));
    const t = this.time();
    const awake = Pet.home().length ? (Pet.mood() === 'sleepy' ? 'asleep' : 'awake') : 'alone';
    const asking = L('wishAsk');
    const ask = asking.pop();
    // (a wish she wrote down — or kept to herself: what follows goes by it)
    const wished = L('wished');
    const kept = L('kept');
    const after = Array.from({ length: Math.max(wished.length, kept.length) }, (x, i) => (wish) => {
      const text = (wish ? wished : kept)[i];
      return text == null ? null : i ? text : { text, cue: () => show('wish') };
    });
    return [
      ...L('hello'),
      ...cued(L('look'), () => show('gaze')),
      ...L(Astro.fullNear(t) < t ? 'exactPast' : 'exactSoon'),
      ...(awake === 'awake' ? [...L('howl'), { rest: 5200, cue: () => this.howl() }, ...L('sung')] : L(awake)),
      ...asking,
      { text: ask, write: { placeholder: '소원을 적어 보세요', ok: '소원 빌기 🌕', skip: '마음속으로 빌게', max: MOON.wish } },
      ...after,
      ...L('next'),
      ...L('bye').map((text, i, all) => (i === all.length - 1 ? { text, cue: () => show('wave') } : text)),
    ];
  },

  /* The foxes sing to the moon: what is seen (js/fox/world.js) and heard. */
  howl() {
    OwnerSays.show('howl');
    if (OwnerSays.live) Sfx.play('howl');
  },

  /* The night of the full moon. (`rehearsal`: only to see how it will be — nothing is kept.) Resolves true when it was told to the end. */
  async begin({ rehearsal = false } = {}) {
    const ov = FoxRoom.ov;
    if (this.playing || OwnerSays.on || Talk.on || !ov || UI.top() !== ov) return false;
    if (!rehearsal && !this.waiting()) return false;
    if (Chat.calling) Chat.heard('off'); // (she was waiting to say something else: that can wait)
    this.playing = true;
    clearTimeout(this.timer);
    FoxRoom.presentChip();
    let said = null;
    try {
      if (!(await OwnerSays.enter(pick(this.lines('call'))))) return false;
      said = await OwnerSays.talk(this.pages());
    } finally {
      this.playing = false;
      OwnerSays.leave();
      FoxRoom.presentChip();
    }
    if (!said) return false;
    if (rehearsal) {
      UI.toast('여기까지가 미리 보기예요. 아무것도 저장되지 않았어요 — 진짜는 보름달 뜨는 밤에!', { icon: '👀', ms: 5200 });
      return true;
    }
    this.give(said.find((x) => typeof x === 'string') || '');
    return true;
  },

  /* Her wish is kept, and she is given something for it. */
  give(text) {
    const night = this.night();
    State.moon.night = night;
    State.moon.wishes.push({ night, text: String(text || '').trim().slice(0, MOON.wish), at: Date.now() });
    State.moon.looked += 1; // (she looked up at it, too)
    Diary.note('moon');
    Game.reward({ coins: MOON.coins });
    Store.saveNow();
    Game.checkAchievements();
    FoxRoom.presentChip();
    Sfx.play('reward');
    UI.toast(`보름달에 소원을 빌었어요 🌕 코인 +${MOON.coins}`, { icon: '🌕', kind: 'gold', ms: 4200 });
  },

  /* She has come into the foxes' world: on the night of the full moon, Lorelei calls before long. */
  arrive() {
    clearTimeout(this.timer);
    if (!this.waiting() || this.rehearsing || Present.rehearsing || Meet.rehearsing || Chat.rehearsing || Halloween.rehearsing || Christmas.rehearsing) return; // (he is looking at how something will be)
    const ov = FoxRoom.ov;
    const tryIt = () => {
      if (FoxRoom.ov !== ov || !this.waiting()) return;
      // (not over a letter she is reading, the shop, the camera — nor before what the other days have to say)
      const others = Present.waiting() || Halloween.waiting() || Christmas.waiting() || Chat.calling || Chat.playing || Halloween.playing || Christmas.playing;
      if (!this.playing && !OwnerSays.on && !others && UI.top() === ov && !FoxRoom.tab && !FoxRoom.photoOn && !FoxRoom.gazeOn) return void this.begin();
      this.timer = setTimeout(tryIt, 2000);
    };
    this.timer = setTimeout(tryIt, 3200);
  },

  /* …and has left it. */
  left() {
    clearTimeout(this.timer);
  },

  /* For him (나 → 설정 → 메시지 편집): what it is, and when the next one is. */
  note() {
    const her = esc(josa(OWNER_NAME, '이/가'));
    const next = this.nextFull();
    const when = next.night === this.night() ? '오늘 밤' : `${this.date(next.night)} 밤`;
    const done = State.moon.night === this.night() ? ' 오늘 밤 소원은 벌써 빌었어요 🌕 (이 기기 기준)' : '';
    return `여우 세상의 하늘은 인천의 진짜 하늘이에요. 해가 지면 밤이 되고, 달은 실제 모양 그대로 실제 시각에 떠요. 보름달 뜨는 밤에 여우 세상에 들어가면 ${her} 불러서 여우들이 달에게 노래하고, 같이 소원을 빌어요 — 끝나면 코인 ${MOON.coins}개. 다음 보름달은 ${when}이에요.${done}`;
  },

  /*
     For trying things out (index.html?debug=1, in the console):
       Moon.test('full')               the night of the next full moon, at half past nine
       Moon.test({ at: '2026-10-31T22:30' })   any moment
       Moon.test({ hour: 19.5 })       today, at half past seven in the evening
       Moon.test()                     back to now
  */
  test(what) {
    let at = null;
    if (what === 'full') {
      const n = this.nextFull(Date.now());
      const [y, m, d] = n.night.split('-').map(Number);
      at = new Date(y, m - 1, d, 21, 30).getTime();
    } else if (what && what.at) at = new Date(what.at).getTime();
    else if (what && what.hour != null) {
      const d = new Date();
      at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), Math.floor(what.hour), Math.round((what.hour % 1) * 60)).getTime();
    }
    this.skew = at == null ? 0 : at - Date.now();
    Pet.refresh();
    FoxRoom.sky();
    FoxHost.sync();
    return this.now();
  },

  /* He would like to see the night of the full moon (나 → 설정 → 메시지 편집 → 보름달). */
  async rehearse() {
    this.rehearsing = true;
    const skew = this.skew;
    try {
      this.test('full');
      if (!FoxRoom.ov) {
        await FoxRoom.open({ early: true }); // (his to look at, even before the foxes' world has opened for her)
        await sleep(600);
      }
      FoxRoom.sky();
      await sleep(900);
      return await this.begin({ rehearsal: true });
    } finally {
      this.rehearsing = false;
      this.skew = skew;
      FoxRoom.sky();
      FoxHost.sync();
    }
  },
};

Actions['moon-rehearse'] = async () => {
  await Router.go('#/home');
  Moon.rehearse();
};
