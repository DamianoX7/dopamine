'use strict';
/* ==================================================================
   🎮 Arcade — five quick mini-games for quick dopamine.
   Every game ends with XP, coins and dopamine. Next to them is the
   door to the squishy playground (js/mallang.js), a toy with no score.
   ================================================================== */

const luckyLabel = () => (State.daily.luckyFree > 0 ? `오늘 무료 ${State.daily.luckyFree}번 남음` : '한 번에 10 🪙');

const GAMES = [
  { id: 'reaction', emoji: '⚡', name: '반응 속도 테스트', desc: '분홍색으로 바뀌는 순간 터치!', best: (b) => (b.reaction ? `최고 ${b.reaction} ms` : '기록 없음') },
  { id: 'memory', emoji: '🃏', name: '카드 짝 맞추기', desc: '여섯 쌍을 모두 찾아요.', best: (b) => (b.memory ? `최고 ${b.memory}번` : '기록 없음') },
  { id: 'colors', emoji: '🎨', name: '컬러 탭', desc: '맞는 색을 재빨리 터치!', best: (b) => (b.colors ? `최고 ${b.colors}점` : '기록 없음') },
  { id: 'numbers', emoji: '🔢', name: '숫자 기억', desc: '점점 길어지는 숫자를 기억해요.', best: (b) => (b.numbers ? `최고 ${b.numbers}자리` : '기록 없음') },
  { id: 'lucky', emoji: '🍀', name: '행운의 버튼', desc: '눌러 보세요. 좋은 일이 생겨요.', best: () => luckyLabel() },
];

const tier = (score, steps) => {
  const r = steps.find(([min]) => score >= min) || steps[steps.length - 1];
  return { dopamine: r[1], xp: r[2], coins: r[3] };
};

Views.arcade = {
  render() {
    Game.ensureDaily();
    return `<section class="arcade">
      <header class="page-head"><h1>🎮 오락실</h1><p class="sub">짧은 게임으로 빠르게 도파민 충전.</p></header>
      <div class="game-grid">${GAMES.map(
        (g) => `<button class="game-card" data-action="game-open" data-id="${g.id}">
          <span class="game-emoji" aria-hidden="true">${g.emoji}</span>
          <b>${g.name}</b><small>${g.desc}</small>
          <span class="chip">${esc(g.best(State.statistics.best))}</span></button>`
      ).join('')}</div>
      <button class="mallang-card" data-action="mallang-open">
        <span class="mc-toys" aria-hidden="true"><i style="--a:#fff4f2;--b:#ffb3c4"></i><i style="--a:#c9f0ff;--b:#4dbbff"></i><i style="--a:#e2d8ff;--b:#9a7bff"></i></span>
        <span class="mc-text"><b>말랑 놀이터</b><small>말랑이를 꾹 누르고, 왁뿌볼을 바사삭 깨요.</small></span>
        <span class="mc-go" aria-hidden="true">›</span>
      </button>
      <div class="card arcade-note">
        <p>🎮 지금까지 <b>${fmtNum(State.statistics.gamesPlayed)}</b>판 · 게임을 할 때마다 ✨ 도파민, ⭐ XP, 🪙 코인을 받아요.</p>
        ${
          Opening.shut()
            ? `<p class="hint">🔒 노래방과 여우 키우기는 ${esc(Opening.whenText())}에 열려요.</p>`
            : `<p class="hint">게임도 재밌지만, 주인공은 네 목소리예요.</p>
        <button class="btn soft" data-action="sing">🎤 노래 부르기</button>`
        }
      </div>
    </section>`;
  },
};

const Arcade = {
  ov: null,
  game: null,

  open(id) {
    const g = GAMES.find((x) => x.id === id);
    if (!g) return;
    this.ov = UI.open(
      `<div class="game" data-game="${id}">
        <header class="game-head">
          <button class="icon-btn" data-action="close-overlay" aria-label="게임 닫기">✕</button>
          <h2>${g.emoji} ${g.name}</h2>
          <span class="game-best" data-best>${esc(g.best(State.statistics.best))}</span>
        </header>
        <div class="game-body" data-body></div>
      </div>`,
      {
        full: true,
        cls: 'is-game',
        label: g.name,
        onClose: () => {
          if (this.game && this.game.stop) this.game.stop();
          this.game = null;
          this.ov = null;
          if (Router.is('arcade')) Router.refresh();
        },
      }
    );
    this.play(id);
  },

  play(id) {
    if (this.game && this.game.stop) this.game.stop();
    const body = $('[data-body]', this.ov.panel);
    this.game = Object.assign(Object.create(GameImpl[id]), { id, body });
    this.game.start();
  },

  result(id, { emoji, title, big, sub, rewards, newBest }) {
    if (!this.ov) return;
    const g = GAMES.find((x) => x.id === id);
    Game.onGame(id, big, rewards);
    const body = $('[data-body]', this.ov.panel);
    $('[data-best]', this.ov.panel).textContent = g.best(State.statistics.best);
    body.innerHTML = `<div class="game-result">
      <div class="res-emoji" aria-hidden="true">${emoji}</div>
      <h3>${esc(title)}</h3>
      <div class="res-big">${esc(big)}</div>
      ${newBest ? '<p class="new-best">🏆 최고 기록 경신!</p>' : ''}
      ${sub ? `<p class="hint center">${esc(sub)}</p>` : ''}
      <div class="rewards">
        <div class="rw"><b>+${rewards.dopamine}</b><span>✨ 도파민</span></div>
        <div class="rw"><b>+${rewards.xp}</b><span>⭐ XP</span></div>
        <div class="rw"><b>+${rewards.coins}</b><span>🪙 코인</span></div>
      </div>
      <div class="dialog-actions">
        <button class="btn soft" data-action="close-overlay">오락실로</button>
        <button class="btn primary" data-action="game-again" data-id="${id}">한 판 더</button>
      </div>
    </div>`;
    Sfx.play(newBest ? 'achievement' : 'reward');
    if (newBest) UI.confetti({ count: 60 });
  },
};

const GameImpl = {
  /* ⚡ Reaction Test — 3 rounds, average time */
  reaction: {
    start() {
      this.times = [];
      this.state = 'intro';
      this.body.innerHTML = `<div class="react-wrap">
        <button class="react-pad is-intro" data-pad>
          <span class="react-icon" aria-hidden="true">⚡</span>
          <span class="react-text">눌러서 시작</span>
          <span class="react-sub">패드가 분홍색으로 바뀌며 “터치!”가 뜨면 최대한 빨리 누르세요. 3라운드예요.</span>
        </button></div>`;
      this.pad = $('[data-pad]', this.body);
      this.pad.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        this.tap();
      });
      this.pad.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
          e.preventDefault();
          this.tap();
        }
      });
    },
    set(cls, icon, text, sub) {
      this.pad.className = `react-pad ${cls}`;
      this.pad.innerHTML = `<span class="react-icon" aria-hidden="true">${icon}</span><span class="react-text">${text}</span><span class="react-sub">${sub}</span>`;
    },
    arm() {
      this.state = 'wait';
      this.set('is-wait', '⏳', '분홍색을 기다려요…', `3라운드 중 ${this.times.length + 1}라운드`);
      this.timer = setTimeout(() => {
        this.state = 'go';
        this.t0 = performance.now();
        this.set('is-go', '👆', '터치!', '지금!');
      }, 1200 + Math.random() * 2600);
    },
    tap() {
      if (this.state === 'intro' || this.state === 'next') return this.arm();
      if (this.state === 'wait') {
        clearTimeout(this.timer);
        this.state = 'next';
        Sfx.play('error');
        this.set('is-early', '😅', '너무 빨랐어요!', '눌러서 이번 라운드 다시 하기');
        return;
      }
      if (this.state === 'go') {
        const ms = Math.round(performance.now() - this.t0);
        this.times.push(ms);
        Sfx.play('pop');
        if (this.times.length >= 3) return this.done();
        this.state = 'next';
        this.set('is-result', '✨', `${ms} ms`, '눌러서 다음 라운드');
      }
    },
    done() {
      this.state = 'done';
      const avg = Math.round(this.times.reduce((a, b) => a + b, 0) / this.times.length);
      const best = State.statistics.best;
      const newBest = !best.reaction || avg < best.reaction;
      if (newBest) best.reaction = avg;
      Arcade.result('reaction', {
        emoji: avg < 300 ? '⚡' : '😊',
        title: avg < 250 ? '번개처럼 빨라요!' : avg < 350 ? '반사신경 최고!' : '좋아요!',
        big: `${avg} ms`,
        sub: `라운드별: ${this.times.join(' · ')} ms`,
        rewards: tier(-avg, [[-250, 40, 20, 12], [-350, 30, 15, 8], [-500, 20, 10, 5], [-Infinity, 12, 6, 3]]),
        newBest,
      });
    },
    stop() {
      clearTimeout(this.timer);
    },
  },

  /* 🃏 Memory — six pairs */
  memory: {
    start() {
      const pool = shuffle(['🎤', '🎧', '💿', '🌙', '💗', '✨', '🦊', '🌸', '🍓', '🎀']).slice(0, 6);
      this.cards = shuffle(pool.concat(pool)).map((e) => ({ e, open: false, done: false }));
      this.moves = 0;
      this.first = null;
      this.lock = false;
      this.matched = 0;
      this.t0 = performance.now();
      this.body.innerHTML = `<div class="mem-top"><span>횟수 <b data-moves>0</b></span><span>짝 <b data-pairs>0</b>/6</span></div>
        <div class="mem-grid">${this.cards
          .map(
            (c, i) => `<button class="mem-card" data-i="${i}" aria-label="${i + 1}번 카드, 뒤집혀 있음">
              <span class="mem-inner"><span class="mem-face mem-front" aria-hidden="true">💗</span><span class="mem-face mem-back" aria-hidden="true">${c.e}</span></span></button>`
          )
          .join('')}</div>`;
      $('.mem-grid', this.body).addEventListener('click', (e) => {
        const b = e.target.closest('.mem-card');
        if (b) this.flip(+b.dataset.i);
      });
    },
    btn(i) {
      return $(`.mem-card[data-i="${i}"]`, this.body);
    },
    flip(i) {
      const c = this.cards[i];
      if (this.lock || c.open || c.done) return;
      c.open = true;
      const b = this.btn(i);
      b.classList.add('open');
      b.setAttribute('aria-label', `${i + 1}번 카드, ${c.e}`);
      Sfx.play('flip');
      if (this.first == null) {
        this.first = i;
        return;
      }
      this.moves += 1;
      $('[data-moves]', this.body).textContent = this.moves;
      const j = this.first;
      const a = this.cards[j];
      this.first = null;
      if (a.e === c.e) {
        a.done = c.done = true;
        this.btn(i).classList.add('done');
        this.btn(j).classList.add('done');
        this.matched += 1;
        $('[data-pairs]', this.body).textContent = this.matched;
        Sfx.play('match');
        if (this.matched === 6) this.timer = setTimeout(() => this.done(), 550);
      } else {
        this.lock = true;
        this.timer = setTimeout(() => {
          a.open = c.open = false;
          [i, j].forEach((k) => {
            const bb = this.btn(k);
            if (!bb) return;
            bb.classList.remove('open');
            bb.setAttribute('aria-label', `${k + 1}번 카드, 뒤집혀 있음`);
          });
          this.lock = false;
        }, 750);
      }
    },
    done() {
      const secs = Math.round((performance.now() - this.t0) / 1000);
      const best = State.statistics.best;
      const newBest = !best.memory || this.moves < best.memory;
      if (newBest) best.memory = this.moves;
      Arcade.result('memory', {
        emoji: this.moves <= 9 ? '🧠' : '🃏',
        title: this.moves <= 8 ? '완벽한 기억력!' : this.moves <= 11 ? '잘했어요!' : '짝을 모두 찾았어요!',
        big: `${this.moves}번`,
        sub: `${secs}초 만에 완료`,
        rewards: tier(-this.moves, [[-8, 45, 22, 14], [-11, 32, 16, 10], [-15, 22, 11, 6], [-Infinity, 14, 7, 4]]),
        newBest,
      });
    },
    stop() {
      clearTimeout(this.timer);
    },
  },

  /* 🎨 Color Tap — 20 seconds, tap a tile of the named color */
  colors: {
    COLORS: [
      { id: 'pink', name: '분홍', hex: '#ff5fa2', emoji: '💗' },
      { id: 'purple', name: '보라', hex: '#9b5cff', emoji: '💜' },
      { id: 'blue', name: '파랑', hex: '#3d9bff', emoji: '💙' },
      { id: 'yellow', name: '노랑', hex: '#f5b700', emoji: '💛' },
      { id: 'green', name: '초록', hex: '#2fb872', emoji: '💚' },
      { id: 'orange', name: '주황', hex: '#ff7a2f', emoji: '🧡' },
    ],
    start() {
      this.score = 0;
      this.left = 20;
      this.running = false;
      this.body.innerHTML = `<div class="ct-top"><span>점수 <b data-score>0</b></span><span>⏱ <b data-left>20</b>초</span></div>
        <div class="ct-target" data-target>말하는 색을 터치하세요. 틀리면 1점 감점!</div>
        <div class="ct-grid" data-grid></div>
        <button class="btn primary huge" data-start>▶ 시작</button>`;
      $('[data-start]', this.body).addEventListener('click', (e) => {
        e.currentTarget.remove();
        this.begin();
      });
      $('[data-grid]', this.body).addEventListener('pointerdown', (e) => {
        const t = e.target.closest('.ct-tile');
        if (t) {
          e.preventDefault();
          this.tap(t);
        }
      });
      $('[data-grid]', this.body).addEventListener('keydown', (e) => {
        const t = e.target.closest('.ct-tile');
        if (t && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          this.tap(t);
        }
      });
    },
    begin() {
      this.running = true;
      this.end = performance.now() + 20000;
      this.timer = setInterval(() => {
        const left = Math.max(0, Math.ceil((this.end - performance.now()) / 1000));
        const el = $('[data-left]', this.body);
        if (el) el.textContent = left;
        if (left <= 0) this.finish();
      }, 100);
      this.next();
    },
    next() {
      const target = pick(this.COLORS);
      this.target = target;
      const others = this.COLORS.filter((c) => c.id !== target.id);
      const n = randInt(2, 3);
      const tiles = shuffle(Array.from({ length: 9 }, (_, i) => (i < n ? target : pick(others))));
      $('[data-target]', this.body).innerHTML = `<span class="ct-pill" style="--c:${target.hex}">${target.emoji} ${target.name}</span> 터치!`;
      $('[data-grid]', this.body).innerHTML = tiles
        .map((c) => `<button class="ct-tile" style="--c:${c.hex}" data-c="${c.id}" aria-label="${c.name}"><span aria-hidden="true">${c.emoji}</span><small>${c.name}</small></button>`)
        .join('');
    },
    tap(tile) {
      if (!this.running) return;
      if (tile.dataset.c === this.target.id) {
        this.score += 1;
        Sfx.play('pop');
        this.next();
      } else {
        this.score = Math.max(0, this.score - 1);
        Sfx.play('error');
        tile.classList.add('miss');
      }
      $('[data-score]', this.body).textContent = this.score;
    },
    finish() {
      if (!this.running) return;
      this.running = false;
      clearInterval(this.timer);
      const best = State.statistics.best;
      const newBest = !best.colors || this.score > best.colors;
      if (newBest) best.colors = this.score;
      Arcade.result('colors', {
        emoji: this.score >= 20 ? '🌈' : '🎨',
        title: this.score >= 25 ? '색깔 마스터!' : this.score >= 18 ? '손이 정말 빨라요!' : '잘했어요!',
        big: `${this.score}점`,
        sub: '20초 동안의 초집중',
        rewards: tier(this.score, [[25, 45, 22, 14], [18, 34, 17, 10], [12, 24, 12, 7], [-Infinity, 14, 7, 4]]),
        newBest,
      });
    },
    stop() {
      this.running = false;
      clearInterval(this.timer);
    },
  },

  /* 🔢 Number Memory — one more digit every round */
  numbers: {
    start() {
      this.digits = 3;
      this.body.innerHTML = `<div class="nm-wrap">
        <div class="res-emoji" aria-hidden="true">🔢</div>
        <p class="nm-intro">숫자가 잠깐 나타나요. 기억했다가 입력하세요. 라운드마다 한 자리씩 늘어나요!</p>
        <button class="btn primary huge" data-go>▶ 시작</button></div>`;
      $('[data-go]', this.body).addEventListener('click', () => this.show());
    },
    show() {
      let n = String(randInt(1, 9));
      for (let i = 1; i < this.digits; i++) n += String(randInt(0, 9));
      this.num = n;
      const ms = 1000 + this.digits * 550;
      this.body.innerHTML = `<div class="nm-wrap">
        <p class="hint">이 숫자를 기억하세요</p>
        <div class="nm-num" aria-live="polite">${n}</div>
        <div class="nm-bar" aria-hidden="true"><i></i></div>
        <p class="hint">${this.digits}자리</p></div>`;
      const bar = $('.nm-bar i', this.body);
      bar.style.transitionDuration = `${ms}ms`;
      void bar.offsetWidth;
      bar.style.width = '0%';
      this.timer = setTimeout(() => this.ask(), ms);
    },
    ask() {
      this.body.innerHTML = `<form class="nm-form" data-form>
        <label class="nm-label" for="nm-input">숫자가 뭐였죠?</label>
        <input id="nm-input" class="nm-input" inputmode="numeric" pattern="[0-9]*" autocomplete="off" maxlength="24" enterkeyhint="done">
        <button class="btn primary big" type="submit">확인</button></form>`;
      const input = $('#nm-input', this.body);
      setTimeout(() => input.focus(), 50);
      $('[data-form]', this.body).addEventListener('submit', (e) => {
        e.preventDefault();
        const ans = input.value.replace(/\D/g, '');
        if (!ans) return;
        if (ans === this.num) {
          Sfx.play('match');
          this.body.innerHTML = `<div class="nm-wrap"><div class="nm-ok">✓ 정답!</div><p class="hint">다음: ${this.digits + 1}자리</p></div>`;
          this.digits += 1;
          this.timer = setTimeout(() => this.show(), 800);
        } else {
          this.done(ans);
        }
      });
    },
    done(ans) {
      const score = this.digits - 1;
      const best = State.statistics.best;
      const newBest = !best.numbers || score > best.numbers;
      if (newBest) best.numbers = score;
      Arcade.result('numbers', {
        emoji: score >= 8 ? '🧠' : '🔢',
        title: score >= 9 ? '빅 브레인!' : score >= 7 ? '대단해요!' : '잘했어요!',
        big: `${score}자리`,
        sub: `정답은 ${this.num} · 입력한 숫자는 ${ans}`,
        rewards: tier(score, [[9, 50, 25, 15], [7, 38, 19, 12], [5, 26, 13, 8], [-Infinity, 15, 8, 4]]),
        newBest,
      });
    },
    stop() {
      clearTimeout(this.timer);
    },
  },

  /* 🍀 Lucky Button — 3 free presses a day, then 10 coins */
  lucky: {
    OUTCOMES: [
      { w: 40, kind: 'dopamine' },
      { w: 20, kind: 'coins' },
      { w: 15, kind: 'xp' },
      { w: 10, kind: 'message' },
      { w: 8, kind: 'snack' },
      { w: 5, kind: 'big' },
      { w: 2, kind: 'jackpot' },
    ],
    start() {
      this.busy = false;
      this.body.innerHTML = `<div class="lucky-wrap">
        <p class="hint center" data-lucky-info>${luckyLabel()}</p>
        <button class="lucky-btn" data-lucky aria-label="행운의 버튼 누르기"><span class="lucky-face" data-reel aria-hidden="true">🍀</span><span class="lucky-label">꾹!</span></button>
        <div class="lucky-result" data-lucky-result aria-live="polite"></div>
      </div>`;
      $('[data-lucky]', this.body).addEventListener('click', () => this.press());
    },
    roll() {
      const total = this.OUTCOMES.reduce((s, o) => s + o.w, 0);
      let r = Math.random() * total;
      return this.OUTCOMES.find((o) => (r -= o.w) < 0) || this.OUTCOMES[0];
    },
    press() {
      if (this.busy) return;
      if (State.daily.luckyFree > 0) State.daily.luckyFree -= 1;
      else if (!Pet.spend(10)) return;
      State.statistics.luckySpins += 1;
      Store.save();
      this.busy = true;
      const reel = $('[data-reel]', this.body);
      const out = $('[data-lucky-result]', this.body);
      out.innerHTML = '';
      $('[data-lucky-info]', this.body).textContent = luckyLabel();
      const faces = ['🍓', '💗', '✨', '🪙', '🎁', '💌', '🍖', '⭐'];
      let i = 0;
      const spin = () => {
        if (i < 14 && !reducedMotion()) {
          reel.textContent = faces[i % faces.length];
          Sfx.play('flip');
          i++;
          this.timer = setTimeout(spin, 45 + i * 10);
        } else {
          this.reveal(this.roll(), reel, out);
        }
      };
      spin();
    },
    reveal(o, reel, out) {
      let rewards = { dopamine: 0, xp: 0, coins: 0 };
      let html = '';
      if (o.kind === 'dopamine') {
        rewards.dopamine = randInt(15, 30);
        reel.textContent = '✨';
        html = `<b>도파민 +${rewards.dopamine}!</b><p class="hint">작은 반짝임을 드려요.</p>`;
      } else if (o.kind === 'coins') {
        rewards.coins = randInt(10, 25);
        reel.textContent = '🪙';
        html = `<b>코인 +${rewards.coins}!</b><p class="hint">여우 간식 사 줄까요?</p>`;
      } else if (o.kind === 'xp') {
        rewards.xp = 20;
        reel.textContent = '⭐';
        html = '<b>XP +20!</b><p class="hint">레벨 업 에너지 충전.</p>';
      } else if (o.kind === 'message') {
        rewards.dopamine = 10;
        reel.textContent = '💌';
        const r = Messages.open();
        Game.track('message');
        html = r ? `<b>메시지가 툭 떨어졌어요!</b>${letterHtml(r.msg.text)}` : '<b>도파민 +10!</b>';
      } else if (o.kind === 'snack') {
        rewards.dopamine = 10;
        reel.textContent = '🍖';
        State.pet.fullness = Math.min(100, State.pet.fullness + 20);
        State.pet.happiness = Math.min(100, State.pet.happiness + 10);
        html = `<b>${esc(josa(State.pet.name, '이/가'))} 간식을 찾았어요!</b><p class="hint">포만감 +20 · 행복 +10</p>`;
      } else if (o.kind === 'big') {
        rewards = { dopamine: 100, xp: 20, coins: 10 };
        reel.textContent = '🎁';
        html = '<b>대박! 도파민 +100</b><p class="hint">오늘은 운이 좋은 날이에요.</p>';
      } else {
        rewards = { dopamine: 777, xp: 77, coins: 77 };
        reel.textContent = '👑';
        State.statistics.best.jackpot = true;
        Game.rare();
        html = '<b class="jackpot">🎰 잭팟! 도파민 +777</b><p class="hint">초레어! 캡처해 두세요!</p>';
        UI.confetti({ gold: true, count: 120 });
        Sfx.play('rare');
      }
      Game.onGame('lucky', o.kind, rewards);
      Sfx.play(o.kind === 'jackpot' ? 'rare' : 'reward');
      const chips = [
        rewards.dopamine ? `<span class="chip">+${rewards.dopamine} ✨</span>` : '',
        rewards.xp ? `<span class="chip">+${rewards.xp} ⭐</span>` : '',
        rewards.coins ? `<span class="chip">+${rewards.coins} 🪙</span>` : '',
      ].join('');
      out.innerHTML = `${html}<div class="chip-row center">${chips}</div>`;
      $('[data-lucky-info]', this.body).textContent = luckyLabel();
      const best = $('[data-best]', Arcade.ov ? Arcade.ov.panel : document);
      if (best) best.textContent = luckyLabel();
      this.busy = false;
    },
    stop() {
      clearTimeout(this.timer);
    },
  },
};

Object.assign(Actions, {
  'game-open': (el) => Arcade.open(el.dataset.id),
  'game-again': (el) => Arcade.play(el.dataset.id),
});
