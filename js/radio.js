'use strict';
/* ==================================================================
   📻 여우 라디오 — DOPAMINE FM: her own covers, shuffled, with her fox
   as the DJ.

   Between the songs the DJ talks: says hello for the time of day,
   what that was and what comes next, now and then the weather in the
   foxes' world or a day worth remembering — and, every few songs, a
   "사연": one of his messages, read out on air. She can skip a song,
   ask for one (신청곡), pause, or switch it off.

   It goes on when she leaves its screen: the songs play on in the
   site's own player (js/cover/player.js — the radio plays them one at
   a time and is told when each one ends), and the DJ speaks up in the
   fox's pop-up, or over the fox's head in the foxes' world, where they
   dance to it. Playing something else, or recording, switches it off.
   With the site in the background (her phone locked) nobody hears
   the DJ: the songs simply follow one another.
   The station's frequency is the day they met (8월 21일 → FM 82.1).
   ================================================================== */

const RADIO_LINES = {
  hello: {
    morning: ['좋은 아침이에요! 도파민 FM, DJ {fox|이에요/예요} ☀️', '아침 공기 상쾌하죠? 도파민 FM의 DJ {fox|이에요/예요}!'],
    day: ['안녕하세요! 오후의 도파민 FM, DJ {fox|이에요/예요} 🎧', '나른한 오후엔 역시 라디오죠. DJ {fox|이에요/예요}!'],
    evening: ['좋은 저녁이에요. 도파민 FM, DJ {fox|이에요/예요} 🌆', '오늘 하루 어땠어요? 저녁의 도파민 FM, DJ {fox|이에요/예요}!'],
    night: ['깊은 밤, 라디오 켜 줘서 고마워요. DJ {fox|이에요/예요} 🌙', '잠 안 오는 밤이죠? 도파민 FM, DJ {fox|이에요/예요} 🌙'],
  },
  open: ['오늘도 {nick}의 노래로만 꽉 채워 볼게요!', '지금부터 {nick} 목소리 특집이에요 💗', '도파민 FM은 {nick}의 노래만 틀어요. 그럼 시작!'],
  intro: ['다음 곡은 {nick}의 ‘{title}’!', '이어서 들려드릴 노래는… ‘{title}’!', '‘{title}’, 바로 갑니다! 🎵', '이번 곡은 제가 아끼는 노래예요. ‘{title}’!'],
  introArtist: ['{artist}의 노래를 {nick} 목소리로 들어 볼까요? ‘{title}’!', '원곡은 {artist}, 부른 사람은 {nick}! ‘{title}’!'],
  introRare: ['✨ 레어 커버가 나왔어요! ‘{title}’!'],
  introFav: ['신청이 제일 많았던 곡이죠! ‘{title}’, {plays}번째 재생이에요 🔁'],
  outro: ['방금 들은 곡은 {nick}의 ‘{prev}’였어요.', '‘{prev}’ 들으니까 꼬리가 절로 흔들려요 🦊', '역시 {nick} 목소리는 최고예요!', '‘{prev}’, 몇 번을 들어도 좋네요 💗', '와… 방금 그 부분 들었어요? 소름 돋았어요!'],
  again: ['{nick}의 노래를 한 바퀴 다 돌았어요! 처음부터 다시 갈게요 🔁'],
  rain: ['여우 세상엔 지금 비가 와요 ☔ 빗소리랑 잘 어울리는 노래예요.'],
  snow: ['여우 세상에 눈이 펑펑 내려요 ⛄ 따뜻하게 들어요.'],
  special: ['오늘은 {day}! 특별한 날엔 특별한 노래죠.'],
  letter: ['사연이 하나 도착했어요 💌 보내 주신 분은… {bf}!'],
  letterAfter: ['꺅, 다들 들었죠? 💗', '와… 제 꼬리까지 빨개졌어요 🦊', '오늘 사연 최고예요!'],
  skip: ['다음 곡으로 넘어갈게요!', '오케이, 바로 다음 곡!'],
  request: ['신청곡 들어왔어요! 📮'],
  requested: ['신청곡이에요! ‘{title}’!', '신청해 주신 노래, ‘{title}’ 나갑니다 📮'],
  bye: ['오늘 도파민 FM은 여기까지! 들어 줘서 고마워요 💗', '다음에 또 만나요. DJ {fox|이었어요/였어요}! 🌙'],
};
const RADIO_LETTER_EVERY = 3; // a 사연 every so many songs (when its screen is open: it is read there)

const Radio = {
  on: false, //      on air
  ov: null, //       its screen
  queue: [], //      the songs still to come (ids), the next first
  wanted: [], //     …of which these she asked for
  now: null, //      the song on air
  prev: null, //     …and the one before it
  played: 0, //      songs since it was switched on
  talking: false, // the DJ is speaking (between songs)
  seq: 0, //         every stretch of talk has a number: a newer one (or switching off) cuts the old one short
  said: null, //     what the DJ is saying on the screen: { text, letter }
  timer: 0,
  seen: null, //     the song in the player when it last changed: another one put in, not by the radio, ends the radio
  // while the DJ talks the radio is what plays (js/cover/core/audioFocus.js): whatever starts meanwhile — a song in the studio, say — takes over
  owner: { pause: () => Radio.stop({ quiet: true }) },

  /** "FM 82.1" — the day they met (8월 21일), or a plain one. */
  freq() {
    const s = Days.start;
    if (!s) return 'FM 100.1';
    const md = `${+s.slice(5, 7)}${s.slice(8, 10)}`;
    return `FM ${md.slice(0, -1)}.${md.slice(-1)}`;
  },

  covers() {
    return Music.released();
  },

  /** A line with its blanks filled: {nick}, {fox}, {title}… — {fox|이에요/예요} with the right particle. */
  fill(text, vars) {
    return text.replace(/\{(\w+)(?:\|([^}]+))?\}/g, (m, key, pair) => {
      const v = vars[key] == null ? '' : String(vars[key]);
      return pair ? josa(v, pair) : v;
    });
  },

  vars(extra = {}) {
    return { nick: State.user.nickname || '너', fox: State.pet.name, bf: CFG.boyfriendName || '남자친구', ...extra };
  },

  /* ----- on and off ----- */
  /** Switch it on (from its screen, or from the foxes' jukebox: `screen` false). */
  start({ screen = true } = {}) {
    if (Opening.shut()) return void Opening.tell();
    if (!this.covers().length) {
      UI.alert({ icon: '📻', title: '아직 틀 노래가 없어요', text: '스튜디오에서 커버를 하나 저장하면 여우 라디오에서 틀어 줄게요.' });
      return;
    }
    if (screen) this.open();
    if (this.on) return;
    this.on = true;
    this.played = 0;
    this.prev = null;
    this.now = null;
    this.seen = CoverHost.player().singleId; // (what was playing stops for the DJ's hello: js/cover/core/audioFocus.js)
    this.queue = [];
    this.wanted = [];
    this.fillQueue();
    this.pill();
    this.segment('start');
    this.render();
  },

  /** Off the air: the song that is playing stops with it (`quiet`: something else has taken over — say nothing). */
  stop({ quiet = false, bye = true } = {}) {
    if (!this.on) return;
    const mine = this.now && CoverHost.player().singleId === this.now;
    this.on = false;
    this.seq++;
    this.talking = false;
    this.hold(false);
    this.now = null;
    this.said = null;
    clearTimeout(this.timer);
    if (mine && !quiet) CoverHost.stopAll();
    this.pill();
    this.render();
    if (bye && !quiet) this.speak(this.fill(pick(RADIO_LINES.bye), this.vars()), { wait: false });
  },

  /* A fresh round of every song, in a new order — not the one that just played first. */
  fillQueue() {
    const ids = shuffle(this.covers().map((c) => c.id));
    if (ids.length > 1 && ids[0] === (this.now || this.prev)) ids.push(ids.shift());
    this.queue = this.queue.concat(ids.filter((id) => !this.queue.includes(id)));
  },

  /* ----- between the songs ----- */
  /** The DJ talks, then the next song goes on. `kind`: 'start', 'between', 'skip', 'request'. */
  async segment(kind) {
    const my = ++this.seq;
    this.talking = true;
    clearTimeout(this.timer);
    this.hold(true);
    this.queue = this.queue.filter((id) => Music.get(id)); // (a cover deleted meanwhile)
    let round = false;
    if (!this.queue.length) {
      this.fillQueue();
      round = kind !== 'start';
    }
    const next = Music.get(this.queue[0]);
    if (!next) return void this.stop({ quiet: true });
    this.render();
    const lines = document.hidden ? [] : this.script(kind, next, round); // (in the background: straight on to the next song)
    if (lines.length && (kind === 'start' || kind === 'between')) this.jingle();
    for (const line of lines) {
      if (my !== this.seq) return;
      if (line.letter) await this.letter(my);
      else await this.speak(line, { my });
    }
    if (my !== this.seq || !this.on) return;
    this.talking = false;
    this.hold(false);
    this.play(this.queue.shift());
  },

  /* While the DJ talks the radio holds what plays: what was on stops — and what is started meanwhile ends the radio. */
  hold(on) {
    if (!CoverHost.api) return;
    if (on) CoverHost.api.focus(this.owner);
    else CoverHost.api.unfocus(this.owner);
  },

  /* A 사연: one of his messages, read out — on the radio's screen only (if that has been shut, there is none this time). */
  async letter(my) {
    const r = this.ov && Messages.open(); // (it counts as opening one of his messages)
    if (!r) return;
    Game.track('message');
    for (const line of [this.fill(pick(RADIO_LINES.letter), this.vars()), { letter: r.msg.text }, pick(RADIO_LINES.letterAfter)]) {
      if (my !== this.seq) return;
      await this.speak(line, { my });
    }
  },

  /** What the DJ says before `next`: a list of lines ({ letter: true } for a 사연). */
  script(kind, next, round) {
    const L = RADIO_LINES;
    const v = this.vars({ title: next.title, artist: next.originalArtist, plays: next.plays + 1 });
    const out = [];
    if (kind === 'start') {
      const h = new Date().getHours();
      out.push(this.fill(pick(L.hello[h < 5 || h >= 22 ? 'night' : h < 11 ? 'morning' : h < 18 ? 'day' : 'evening']), v));
      out.push(this.fill(pick(L.open), v));
    } else if (kind === 'between') {
      const was = this.now && Music.get(this.now); // (the song that has just ended: the next one is not on yet)
      if (was) out.push(this.fill(pick(L.outro), { ...v, prev: was.title }));
      out.push(...this.extra(v));
    } else if (kind === 'skip') out.push(pick(L.skip));
    else if (kind === 'request') out.push(pick(L.request));
    if (round) out.push(this.fill(pick(L.again), v));
    const asked = this.wanted.includes(next.id);
    const intro = asked ? L.requested : next.rare ? L.introRare : next.plays >= 3 && Math.random() < 0.5 ? L.introFav : next.originalArtist && Math.random() < 0.4 ? L.introArtist : L.intro;
    out.push(this.fill(pick(intro), v));
    return out;
  },

  /* Now and then something more between two songs: a 사연, a day worth remembering, the weather where the foxes live. */
  extra(v) {
    const L = RADIO_LINES;
    if (this.ov && this.played % RADIO_LETTER_EVERY === 0 && Messages.all().length) return [{ letter: true }];
    const day = Days.on(dateKey());
    if (day.length && this.played === 1) return [this.fill(pick(L.special), { ...v, day: day[0].name })];
    const sky = !Opening.shut() && Weather.now().kind;
    if ((sky === 'rain' || sky === 'snow') && Math.random() < 0.35) return [pick(L[sky])];
    return [];
  },

  /* Four bright notes and a chime: the station's jingle. */
  jingle() {
    if (!State.settings.soundEnabled || CoverHost.quiet) return;
    const ctx = AudioSys.resume();
    if (!ctx) return;
    try {
      const out = ctx.createGain();
      out.gain.value = 0.13;
      out.connect(ctx.destination);
      const t = ctx.currentTime + 0.02;
      [659.25, 783.99, 987.77, 1318.5].forEach((f, i) => Sfx.tone(ctx, out, t + i * 0.11, f, 0.3, { type: 'triangle', vol: 0.5 }));
      Sfx.tone(ctx, out, t + 0.48, 2637, 0.7, { vol: 0.18 });
      setTimeout(() => out.disconnect(), 2000);
    } catch (e) {
      /* sound is optional */
    }
  },

  /**
   * The DJ says `line`: typed out on the radio's screen, over the fox's head in the foxes' world, or in the fox's
   * pop-up anywhere else. Resolves when it has been said (and read). A { letter } is only read out on the screen.
   */
  speak(line, { my = this.seq, wait = true } = {}) {
    return new Promise((resolve) => {
      const letter = typeof line === 'object' ? line.letter : null;
      const text = letter || line;
      const reading = letter ? clamp(text.length / 9, 4.5, 14) : clamp(text.length / 12, 1.6, 4.2); // seconds to read it
      const done = () => {
        clearTimeout(this.timer);
        resolve();
      };
      if (this.ov) {
        this.said = { text, letter: !!letter, shown: 0 };
        this.type(my);
        const typing = letter ? 0.6 : text.length / TALK_SPEED;
        if (wait) this.timer = setTimeout(done, (typing + reading) * 1000);
        else done();
        return;
      }
      if (!letter) {
        if (FoxRoom.ov && FoxHost.api) FoxHost.say(text, reading * 1000 + 600);
        else if (!UI.stack.length) UI.petPop(`📻 ${text}`); // (not over a screen she is busy on: the diary, the LP…)
      }
      if (wait) this.timer = setTimeout(done, (letter ? 0 : reading + 0.4) * 1000);
      else done();
    });
  },

  /* The words come a letter at a time, with the DJ's voice (js/talk.js). */
  type(my) {
    const s = this.said;
    const el = this.ov && $('[data-radio-say]', this.ov.panel);
    if (!s || !el) return;
    el.classList.toggle('is-letter', s.letter);
    el.hidden = false;
    if (s.letter) {
      el.innerHTML = `<span class="rd-letter">${esc(s.text)}</span>`;
      return;
    }
    const letters = Array.from(s.text);
    const step = () => {
      if (my !== this.seq || this.said !== s || !this.ov) return;
      s.shown++;
      const ch = letters[s.shown - 1];
      el.textContent = letters.slice(0, s.shown).join('');
      if (s.shown % 2 && ch && /\S/.test(ch)) Talk.blip(ch, 1.5);
      if (s.shown < letters.length) setTimeout(step, (1000 / TALK_SPEED) * (1 + (TALK_PAUSE[ch] || 0) * 0.4));
    };
    el.textContent = '';
    s.shown = 0;
    step();
  },

  /* ----- the songs ----- */
  play(id) {
    if (!this.on || !Music.get(id)) return;
    this.prev = this.now;
    this.now = id;
    this.wanted = this.wanted.filter((x) => x !== id);
    const p = CoverHost.player();
    if (p.singleId === id && p.time > 0.5 && CoverHost.api) CoverHost.api.seek(0); // (the song that was on before the radio, stopped half-way: from the start)
    CoverHost.start(id, [id]); // (one at a time: when it ends the player tells us — ended())
    this.played++;
    State.statistics.radio = (State.statistics.radio || 0) + 1;
    Diary.note('radio');
    Store.save();
    Game.checkAchievements();
    this.render();
  },

  /** The player: a song has played to its end. */
  ended(id) {
    if (!this.on || id !== this.now || this.talking) return;
    this.segment('between');
  },

  /** The player changed: if somebody else put a song in (or it was closed), or she is recording, the radio is over. */
  watch(p) {
    if (!this.on) return;
    const was = this.seen;
    this.seen = p.singleId;
    if (CoverHost.quiet || (p.singleId !== was && p.singleId !== this.now)) return void this.stop({ quiet: true });
    if (this.ov) this.renderNow(p);
  },

  skip() {
    if (!this.on) return;
    Sfx.play('flip');
    if (this.now && CoverHost.player().playing) CoverHost.play(this.now); // (a tap on the one that plays pauses it)
    this.segment('skip');
  },

  /** She asks for a song: it is next (and the DJ says so, if a song is on). */
  ask(id) {
    if (!this.on || !Music.get(id)) return;
    this.queue = [id].concat(this.queue.filter((x) => x !== id));
    if (!this.wanted.includes(id)) this.wanted.push(id);
    Sfx.play('pop');
    UI.toast('신청곡을 접수했어요! 다음 곡으로 틀어 드릴게요 📮', { icon: '📻' });
    this.render();
  },

  toggle() {
    if (!this.on) return this.start();
    if (this.talking || !this.now) return;
    CoverHost.play(this.now);
  },

  /* ----- the screen ----- */
  open() {
    if (this.ov) return;
    const ov = (this.ov = UI.open(this.html(), {
      full: true,
      cls: 'is-radio',
      label: '여우 라디오',
      onClose: () => {
        this.ov = null;
        if (this.loop) this.loop();
        this.loop = null;
        this.pill();
      },
    }));
    Pet.fillAvatars(ov.panel);
    Pet.wantPortrait(true);
    ov.panel.addEventListener('click', (e) => {
      const on = (sel) => e.target.closest(sel);
      if (on('[data-radio-toggle]')) this.toggle();
      else if (on('[data-radio-skip]')) this.skip();
      else if (on('[data-radio-off]')) this.stop();
      else if (on('[data-radio-on]')) this.start();
      else if (on('[data-radio-ask]')) this.request();
      else if (on('[data-radio-next]')) this.ask(on('[data-radio-next]').dataset.radioNext);
      else if (on('[data-radio-say].is-letter') && this.talking) {
        clearTimeout(this.timer); // (read already: on with the show)
        this.segment('skip');
      }
    });
    this.render();
    this.pill();
    if (this.said) this.type(this.seq);
    this.loop = Loop.add(() => this.frame());
  },

  html() {
    return `<div class="radio" data-radio>
      <header class="rd-head">
        <button class="icon-btn" data-action="close-overlay" aria-label="닫기 (라디오는 계속 나와요)">‹</button>
        <div class="rd-station"><b>DOPAMINE FM</b><small>${esc(this.freq())} MHz</small></div>
        <span class="rd-onair" data-radio-onair>ON AIR</span>
      </header>
      <div class="rd-booth">
        <div class="rd-dj" data-radio-dj>
          <i class="rd-phones" aria-hidden="true"></i>
          ${Pet.avatarHtml('rd-fox')}
          <span class="rd-mic" aria-hidden="true">🎙️</span>
        </div>
        <p class="rd-name">DJ ${esc(State.pet.name)}</p>
        <div class="rd-say" data-radio-say aria-live="polite" hidden></div>
        <div class="rd-eq" aria-hidden="true">${'<i></i>'.repeat(15)}</div>
      </div>
      <div class="rd-panel" data-radio-panel></div>
    </div>`;
  },

  /* What is on, what comes next, and the buttons. */
  render() {
    if (!this.ov) return;
    const panel = $('[data-radio-panel]', this.ov.panel);
    const root = $('[data-radio]', this.ov.panel);
    root.classList.toggle('is-on', this.on);
    if (!this.on) {
      $('[data-radio-onair]', this.ov.panel).classList.remove('lit');
      $('[data-radio-say]', this.ov.panel).hidden = !this.said;
      panel.innerHTML = `<div class="rd-off">
        <p>라디오가 꺼져 있어요</p>
        <button class="btn primary huge" data-radio-on>📻 다시 켜기</button>
      </div>`;
      return;
    }
    const c = this.now && Music.get(this.now);
    const next = this.queue
      .slice(0, 3)
      .map((id) => Music.get(id))
      .filter(Boolean);
    panel.innerHTML = `<div class="rd-now" data-radio-now>
        ${c ? artImg(c, 'rd-art') : '<span class="rd-art is-empty" aria-hidden="true">📻</span>'}
        <span class="rd-text"><small data-radio-state>${this.talking ? (c ? 'DJ가 이야기하는 중' : '곧 시작해요') : '지금 나오는 노래'}</small><b>${c ? esc(c.title) : 'DOPAMINE FM'}</b><small>${c ? esc(c.coverArtist || State.user.nickname) : esc(this.freq())}</small></span>
        <i class="rd-bar" aria-hidden="true"><i data-radio-bar></i></i>
      </div>
      <div class="rd-controls">
        <button class="rd-btn" data-radio-ask aria-label="신청곡 고르기"><span aria-hidden="true">📮</span><small>신청곡</small></button>
        <button class="rd-btn is-big" data-radio-toggle aria-label="일시정지 또는 재생"><span aria-hidden="true" data-radio-play>❚❚</span></button>
        <button class="rd-btn" data-radio-skip aria-label="다음 곡"><span aria-hidden="true">⏭</span><small>다음 곡</small></button>
      </div>
      ${
        next.length
          ? `<div class="rd-next"><p class="rd-next-head">다음 곡 <small>눌러서 먼저 듣기</small></p>${next
              .map((n) => `<button class="rd-next-item" data-radio-next="${esc(n.id)}">${artImg(n, 'rd-next-art')}<span>${esc(n.title)}</span>${this.wanted.includes(n.id) ? '<em>📮 신청곡</em>' : ''}</button>`)
              .join('')}</div>`
          : ''
      }
      <button class="btn ghost rd-offbtn" data-radio-off>라디오 끄기</button>`;
    CoverHost.hydrateArt(panel);
    this.renderNow(CoverHost.player());
  },

  /* The bits that change while a song plays: the bar, ❚❚ or ▶, ON AIR. */
  renderNow(p) {
    if (!this.ov) return;
    const panel = this.ov.panel;
    const mine = this.on && this.now && p.singleId === this.now;
    const bar = $('[data-radio-bar]', panel);
    if (bar) bar.style.width = `${mine && p.duration ? clamp((p.time / p.duration) * 100, 0, 100).toFixed(1) : 0}%`;
    const play = $('[data-radio-play]', panel);
    if (play) play.textContent = mine && !p.playing && !this.talking ? '▶' : '❚❚';
    const state = $('[data-radio-state]', panel);
    if (state && !this.talking && mine) state.textContent = p.playing ? '지금 나오는 노래' : '잠깐 멈춤';
    $('[data-radio-onair]', panel).classList.toggle('lit', this.on && (this.talking || !!p.playing));
  },

  /* Every frame while the screen is open: the DJ nods to the beat, the bars follow how loud it is. */
  frame() {
    if (!this.ov) return;
    const panel = this.ov.panel;
    const dj = $('[data-radio-dj]', panel);
    const bars = $$('.rd-eq i', panel);
    const p = CoverHost.player();
    const live = this.on && !this.talking && p.playing && p.singleId === this.now;
    const b = live ? CoverHost.beats(this.now) : null;
    const t = CoverHost.clock();
    const now = performance.now() / 1000;
    let loud = 0;
    let nod = 0;
    if (live) {
      if (b && b.level) {
        const k = Math.floor(t / b.step);
        loud = (b.level[k] || 0) / 255;
      } else loud = 0.45 + 0.25 * Math.sin(now * 5.3);
      if (b && b.beats && b.beats.length > 1) {
        let i = 0;
        while (i < b.beats.length - 1 && b.beats[i + 1] <= t) i++;
        const len = (b.beats[i + 1] || b.beats[i] + 0.5) - b.beats[i];
        const ph = clamp((t - b.beats[i]) / len, 0, 1);
        nod = Math.pow(1 - ph, 3);
      } else nod = Math.pow(1 - ((now * 2) % 1), 3);
    } else if (this.talking && this.said && !this.said.letter) {
      nod = 0.25 + 0.25 * Math.sin(now * 14); // (talking)
    }
    if (reducedMotion()) nod = 0;
    dj.style.transform = `translateY(${(-nod * 6).toFixed(1)}px) rotate(${(Math.sin(now * 1.7) * nod * 4).toFixed(2)}deg) scale(${(1 + nod * 0.03).toFixed(3)})`;
    bars.forEach((el, i) => {
      const wobble = 0.55 + 0.45 * Math.sin(now * (3 + (i % 5)) + i * 1.3);
      const h = live ? clamp(loud * wobble * (1.25 - Math.abs(i - 7) / 12), 0.06, 1) : 0.06;
      el.style.transform = `scaleY(${h.toFixed(3)})`;
    });
  },

  /* 신청곡: every song she has, to pick one. */
  request() {
    if (!this.on) return;
    const list = this.covers();
    const ov = UI.open(
      `<div class="juke">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 class="juke-title">📮 신청곡</h2>
        <p class="hint">고른 노래를 다음 곡으로 틀어 드려요.</p>
        <div class="juke-list">${list
          .map(
            (c) => `<button class="juke-item ${c.id === this.now ? 'on' : ''}" data-req="${esc(c.id)}">${artImg(c, 'juke-art')}
              <span class="juke-text"><b>${esc(c.title)}</b><small>${esc(c.originalArtist || c.coverArtist || State.user.nickname)} · ${fmtTime(c.duration)}</small></span>
              <span class="juke-go" aria-hidden="true">📮</span></button>`
          )
          .join('')}</div>
        <div class="dialog-actions one"><button class="btn ghost" data-ov-cancel>닫기</button></div>
      </div>`,
      { cls: 'is-juke', label: '신청곡 고르기' }
    );
    ov.panel.addEventListener('click', (e) => {
      const row = e.target.closest('[data-req]');
      if (row) this.ask(row.dataset.req);
      else if (!e.target.closest('[data-ov-cancel]')) return;
      UI.close(ov);
    });
  },

  /* ON AIR over the page while it plays and its screen is shut: a tap opens it. */
  pill() {
    const hud = $('#topbar .hud');
    let el = $('[data-radio-pill]', hud);
    const want = this.on && !this.ov;
    if (!want) return void (el && el.remove());
    if (el) return;
    el = document.createElement('button');
    el.className = 'pill radio-pill';
    el.dataset.radioPill = '';
    el.dataset.action = 'radio-open';
    el.setAttribute('aria-label', '여우 라디오 방송 중 — 열기');
    el.innerHTML = '<span aria-hidden="true">📻</span><i aria-hidden="true"></i>';
    hud.prepend(el);
  },

  /* ----- Home ----- */
  cardHtml() {
    if (Opening.shut() || !this.covers().length) return '';
    const c = this.on && this.now && Music.get(this.now);
    return `<button class="card radio-card ${this.on ? 'is-on' : ''}" data-action="radio-open">
      ${Pet.avatarHtml('radio-card-fox')}
      <span class="radio-card-text"><span class="eyebrow">📻 여우 라디오 · ${esc(this.freq())}</span>
        <b>${this.on ? (c ? `방송 중 · ${esc(c.title)}` : '방송 중') : `DJ ${esc(State.pet.name)}의 도파민 FM`}</b>
        <small>${this.on ? '눌러서 라디오 보기' : '내 커버를 셔플로 틀고, 곡 사이사이에 소개해 줘요'}</small></span>
      <span class="radio-card-air ${this.on ? 'lit' : ''}" aria-hidden="true">ON AIR</span>
    </button>`;
  },
};

/* The site goes into the background while the DJ talks (her phone locked): nobody hears the rest — on with the next song. */
document.addEventListener('visibilitychange', () => {
  if (document.hidden && Radio.on && Radio.talking) Radio.segment('skip');
});

Object.assign(Actions, {
  'radio-open': () => Radio.start(),
});
