'use strict';
/* ==================================================================
   The seasons and the weather of the foxes' world.

   The season follows the calendar — or what she has chosen in the
   settings. The meadow and the farm change with it: blossom in
   spring, deep green in summer, red and gold leaves in autumn, snow
   in winter. The other habitats are one season all year round: the
   cherry hill is always in bloom, the mountain always in its autumn
   leaves, the desert hot and dry, the arctic deep in snow.

   The weather changes every few minutes: clear, clouded over, rain —
   snow in winter and in the arctic, blowing sand in the desert.
   Nothing of it is saved. It is worked out from the clock, so her
   phone and her computer have the same sky.

   This file only keeps the time. js/fox/sky.js draws what it says
   (the rain, the puddles it leaves, the grey light), and
   js/fox/weatherlife.js is what the foxes do about it: run for cover
   when it rains, splash through the puddles when it has stopped,
   snap at snowflakes.
   ================================================================== */

const SEASONS = [
  { id: 'spring', emoji: '🌸', name: '봄' },
  { id: 'summer', emoji: '🌿', name: '여름' },
  { id: 'autumn', emoji: '🍂', name: '가을' },
  { id: 'winter', emoji: '❄️', name: '겨울' },
];

const SKIES = {
  clear: { emoji: '☀️', name: '맑음', now: '하늘이 맑아요.' },
  cloudy: { emoji: '☁️', name: '흐림', now: '구름이 잔뜩 꼈어요.' },
  rain: { emoji: '🌧️', name: '비', now: '비가 와요. 여우들은 비를 피하고 있어요.', on: '비가 내리기 시작했어요', off: '비가 그쳤어요' },
  snow: { emoji: '🌨️', name: '눈', now: '눈이 내려요. 여우들이 신났어요!', on: '눈이 내려요!', off: '눈이 그쳤어요' },
  wind: { emoji: '🌬️', name: '모래바람', now: '모래바람이 불어요. 여우들이 몸을 웅크리고 있어요.', on: '모래바람이 불기 시작했어요', off: '바람이 잦아들었어요' },
};

/* The habitats that are one season all year round, and the weather they have (ODDS). The others follow the calendar. */
const CLIMATES = {
  cherry: { season: 'spring', label: '늘 봄' },
  desert: { season: 'summer', label: '늘 여름', odds: 'dry' },
  mountain: { season: 'autumn', label: '늘 가을' },
  beach: { season: 'summer', label: '늘 여름' },
  bamboo: { season: 'spring', label: '늘 봄' },
  lavender: { season: 'summer', label: '늘 여름' },
  hanok: { season: 'autumn', label: '늘 가을' },
  arctic: { season: 'winter', label: '늘 겨울', odds: 'polar' },
};

/* How often the sky is how (parts in a hundred). In this order: the worse the weather, the higher the throw it takes. */
const ODDS = {
  spring: { clear: 54, cloudy: 22, rain: 24 },
  summer: { clear: 50, cloudy: 20, rain: 30 },
  autumn: { clear: 58, cloudy: 22, rain: 20 },
  winter: { clear: 46, cloudy: 20, snow: 34 },
  dry: { clear: 70, wind: 24, rain: 6 },
  polar: { clear: 40, cloudy: 16, snow: 44 },
};

const SPELL = 10 * 60000; // the sky is thrown afresh this often (two throws alike: it simply stays as it is)
const DRY = 9 * 60000; //    how long the puddles take to dry up once the rain has stopped

const Weather = {
  forced: null, // (for trying things out: Weather.test)
  skew: 0, //      …and a clock that is put forward

  time() {
    return Date.now() + this.skew;
  },

  /* The season by the calendar. */
  calendar(d = new Date(this.time())) {
    const m = d.getMonth();
    return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter';
  },

  /* …or the one she has chosen (settings). */
  season() {
    if (this.forced && this.forced.season) return this.forced.season;
    const s = State.settings.season;
    return SEASONS.some((x) => x.id === s) ? s : this.calendar();
  },

  /* The season a habitat is in: the meadow and the farm follow the year, the others are always the same. */
  seasonIn(scene = State.pet.scene) {
    const c = CLIMATES[scene];
    return c ? c.season : this.season();
  },

  /* The sky in one spell of weather (they are numbered from the beginning of time), for a table of odds. */
  roll(n, odds) {
    let u = mulberry32(Math.imul(n, 0x9e3779b1) >>> 0)() * 100;
    for (const kind in odds) if ((u -= odds[kind]) < 0) return kind;
    return 'clear';
  },

  /*
     The weather where the foxes live, right now: { season, kind, level, wet, since, left }.
     kind   'clear', 'cloudy', 'rain', 'snow' or 'wind'
     level  how hard it is coming down, 0 … 1 (it comes on and eases off over half a minute)
     wet    how wet the ground is, 0 … 1: soaked while it rains, drying for some minutes afterwards
     since  how long the sky has been like this (seconds), left: how long it will stay so
  */
  now(scene = State.pet.scene) {
    const t = this.time();
    const season = this.seasonIn(scene);
    const odds = ODDS[(CLIMATES[scene] || {}).odds || season];
    const n = Math.floor(t / SPELL);
    const kind = this.roll(n, odds);
    let from = n;
    while (from > n - 12 && this.roll(from - 1, odds) === kind) from--;
    let to = n + 1;
    while (to < n + 12 && this.roll(to, odds) === kind) to++;
    const since = (t - from * SPELL) / 1000;
    const left = (to * SPELL - t) / 1000;
    const falls = kind === 'rain' || kind === 'snow' || kind === 'wind';
    const level = falls ? clamp(since / 25, 0.12, 1) * clamp(left / 20, 0.15, 1) : 0;
    let wet = 0;
    if (kind === 'rain') wet = clamp(since / 50, 0.1, 1);
    else {
      // when did it last rain?
      let k = n - 1;
      while (k > n - 3 && this.roll(k, odds) !== 'rain') k--;
      if (this.roll(k, odds) === 'rain') wet = clamp(1 - (t - (k + 1) * SPELL) / DRY, 0, 1);
    }
    const sky = { season, kind, level, wet, since, left };
    if (!this.forced) return sky;
    // (tried out by hand: whatever was asked for, as if it had been so for a while)
    const f = this.forced;
    const kindNow = f.kind || kind;
    const hard = kindNow === 'rain' || kindNow === 'snow' || kindNow === 'wind';
    return {
      season,
      kind: kindNow,
      level: f.level != null ? f.level : hard ? 1 : 0,
      wet: f.wet != null ? f.wet : kindNow === 'rain' ? 1 : f.kind ? 0 : wet,
      since: f.kind ? (this.time() - f.at) / 1000 + (f.since || 0) : since,
      left: f.kind ? 600 : left,
    };
  },

  /* How long until the sky may change (ms). */
  untilNext() {
    return SPELL - (this.time() % SPELL);
  },

  seasonDef(id) {
    return SEASONS.find((x) => x.id === id) || SEASONS[0];
  },

  /* "🍂 가을 · 🌧️ 비" — for the chip over the foxes' world and the card on Home. */
  chipHtml(scene = State.pet.scene, short = false) {
    const sky = this.now(scene);
    const season = this.seasonDef(sky.season);
    const climate = CLIMATES[scene];
    const def = SKIES[sky.kind];
    const emoji = sky.kind === 'clear' && document.body.classList.contains('late-night') ? '🌙' : def.emoji;
    const puddles = sky.kind !== 'rain' && sky.wet > 0.25;
    if (short) return `<span aria-hidden="true">${season.emoji}${emoji}</span><span class="sr-only">${season.name}, ${def.name}</span>`;
    return `<span aria-hidden="true">${season.emoji}</span> ${climate ? climate.label : season.name} <i aria-hidden="true">·</i> <span aria-hidden="true">${emoji}</span> ${puddles ? '비 갠 뒤' : def.name}`;
  },

  /* A sentence about it, for whoever taps that chip. */
  describe(scene = State.pet.scene) {
    const sky = this.now(scene);
    const season = this.seasonDef(sky.season);
    const climate = CLIMATES[scene];
    const where = climate ? `여기는 ${josa(climate.label.replace('늘 ', ''), '이/가')} 계속되는 곳이에요.` : `지금 여우 세상은 ${josa(season.name, '이에요/예요')}.`;
    const puddles = sky.kind !== 'rain' && sky.wet > 0.25 ? ' 비가 그쳐서 웅덩이가 남아 있어요.' : '';
    return `${where} ${SKIES[sky.kind].now}${puddles}`;
  },

  /* What to say when the sky has just changed while she is watching (or nothing). */
  news(from, to, wet) {
    if (from === to) return null;
    if (SKIES[to].on) return { icon: SKIES[to].emoji, text: SKIES[to].on };
    if (from === 'rain') return { icon: '🌤️', text: wet > 0.25 ? '비가 그쳤어요. 웅덩이가 생겼어요!' : SKIES.rain.off };
    if (SKIES[from] && SKIES[from].off) return { icon: SKIES[to].emoji, text: SKIES[from].off };
    return null;
  },

  /*
     For trying things out (index.html?debug=1, in the console):
       Weather.test({ kind: 'rain' })      rain, now — also 'snow', 'wind', 'cloudy', 'clear'
       Weather.test({ kind: 'clear', wet: 1 })   …the puddles it leaves
       Weather.test({ season: 'winter' })  another season
       Weather.test()                      back to the real sky
  */
  test(what) {
    this.forced = what ? { ...what, at: this.time() } : null;
    Pet.refresh();
    FoxRoom.sky();
    return this.now();
  },
};
