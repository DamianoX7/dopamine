'use strict';
/* ==================================================================
   🔒 Opening — two rooms of her world open on a day of their own.

   The studio (🎤 스튜디오 · 💿 내 커버) and the foxes (🦊 여우 키우기)
   stay shut until `opensAt` (js/config.js). Until then their doors say
   when they open and how long that still is; the rest — the arcade,
   the messages, the calendar — is there from the first day. When the
   hour comes they open by themselves, and she is told so, once.

   It goes by the clock of her device. It is a promise, not a lock:
   nothing of hers is behind it, and he can step in early on his own
   device (나 → 설정 → 메시지 편집).
   ================================================================== */

const OPEN_EARLY_KEY = 'dopamineWorld.openEarly.v1'; // "this device is in already": kept on the device, not in her progress
const SHUT_ROUTES = { studio: 'studio', covers: 'covers', single: 'covers', album: 'covers' }; // a route that waits → the tab it belongs to
/* What cannot be done while they are shut: a tap on one of these says when they open instead. */
const SHUT_ACTIONS = new Set(['sing', 'surprise', 'open-cover', 'play-cover', 'fox-open', 'photo-album', 'open-wrapped']);

const Opening = {
  /* When they open (ms), or 0: they are open from the start. */
  at: (() => {
    let s = String(CFG.opensAt || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) s += 'T00:00'; // (a day alone: from its first minute, by her clock — not by Greenwich's)
    const t = s ? new Date(s).getTime() : NaN;
    return Number.isFinite(t) ? t : 0;
  })(),
  early: (() => {
    try {
      return localStorage.getItem(OPEN_EARLY_KEY) === '1';
    } catch (e) {
      return false;
    }
  })(),
  timer: 0,
  was: null, // how the doors stood when this last looked

  /** Are the studio and the foxes still shut? */
  shut() {
    return !!this.at && !this.early && Date.now() < this.at;
  },

  /** …and from when on a fox can have been hungry: there were none before. */
  since() {
    return this.early ? 0 : this.at;
  },

  /** '10월 31일 (토) 저녁 6시' */
  whenText() {
    const d = new Date(this.at);
    const h = d.getHours();
    const m = d.getMinutes();
    const part = h < 5 ? '새벽' : h < 12 ? '오전' : h === 12 ? '낮' : h < 18 ? '오후' : h < 22 ? '저녁' : '밤';
    return `${fmtDay(dateKey(d))}${h || m ? ` ${part} ${h % 12 || 12}시${m ? ` ${m}분` : ''}` : ''}`;
  },

  /** How long still: 'D-21' — and on the day itself, the hours and minutes. */
  leftText() {
    const ms = this.at - Date.now();
    if (ms <= 0) return '';
    const days = daysBetween(dateKey(), dateKey(new Date(this.at)));
    if (days > 0) return `D-${days}`;
    const mins = Math.ceil(ms / 60000);
    return mins >= 60 ? `${Math.floor(mins / 60)}시간${mins % 60 ? ` ${mins % 60}분` : ''} 남았어요` : `${mins}분 남았어요`;
  },

  note() {
    return String(CFG.opensNote || '').trim() || '그날 만나요 💗';
  },

  /* ----- what stands in their place ----- */

  /** The page behind a shut door (or null: that room is open, or is not one of them). */
  view(name) {
    if (!this.shut() || !(name in SHUT_ROUTES)) return null;
    const tab = SHUT_ROUTES[name];
    return {
      tab,
      render: () => `<section class="shut-room">
        <div class="card shut-card">
          <div class="shut-lock" aria-hidden="true">🔒</div>
          <p class="eyebrow">${tab === 'covers' ? '💿 내 커버' : '🎤 스튜디오'}</p>
          <h1 class="shut-when">${esc(this.whenText())}에 열려요</h1>
          <p class="shut-left"><span class="chip" data-opening-left>${esc(this.leftText())}</span></p>
          <p class="shut-note">${esc(this.note())}</p>
          <div class="chip-row">
            <a class="btn primary" href="#/arcade">🎮 오락실에서 놀기</a>
            <button class="btn soft" data-action="open-message">💌 메시지 열기</button>
          </div>
        </div>
      </section>`,
    };
  },

  /** Home: one card for both rooms, where the big SING button and the foxes' card will be. */
  homeHtml() {
    return `<button class="card opening-card" data-action="opening-tell" aria-label="노래방과 여우 키우기는 ${esc(this.whenText())}에 열려요">
      <span class="opening-top"><span class="eyebrow">🔒 곧 열려요</span><span class="chip" data-opening-left>${esc(this.leftText())}</span></span>
      <span class="opening-rooms"><span><i aria-hidden="true">🎤</i> 노래방</span><span><i aria-hidden="true">🦊</i> 여우 키우기</span></span>
      <span class="opening-when">${esc(this.whenText())}에 열려요</span>
      <span class="opening-note">${esc(this.note())}</span>
    </button>`;
  },

  /** A tap on something that is not open yet. */
  tell() {
    UI.alert({ icon: '🔒', title: `${this.whenText()}에 열려요`, text: `${this.leftText()} · ${this.note()}` });
  },

  /* ----- keeping watch ----- */

  /* Looks at the clock: the doors as they stand, the time that is left — and the moment they open. (At the start, every
     half minute while they are shut, and whenever she comes back to the page.) */
  watch() {
    clearTimeout(this.timer);
    const shut = this.shut();
    $$('#tabbar a').forEach((a) => a.classList.toggle('is-shut', shut && a.dataset.tab in SHUT_ROUTES));
    if (shut) {
      const left = this.leftText();
      $$('[data-opening-left]').forEach((el) => (el.textContent = left));
      if (State.onboarded && !State.opening.seen) {
        State.opening.seen = true; // she has stood before the doors: she will be told when they open
        Store.save();
      }
      this.timer = setTimeout(() => this.watch(), Math.min(this.at - Date.now() + 60, 30000));
    }
    if (this.was === true && !shut) this.opened();
    else if (!shut) this.greet();
    this.was = shut;
  },

  /* They have opened while she was here: everything that showed a shut door shows the room. */
  opened() {
    State.pet.lastTick = Date.now(); // (a fox that was not there cannot have gone hungry)
    Store.save();
    if (Router.cur) Router.render(true);
    Pet.refresh();
    this.greet();
  },

  /* …and she is told, once — if she ever stood before them shut. */
  greet() {
    const o = State.opening;
    if (!this.at || this.early || o.greeted || !State.onboarded || Date.now() < this.at) return;
    o.greeted = true;
    Store.save();
    if (!o.seen) return;
    Sfx.play('levelup');
    UI.confetti({ count: 120 });
    UI.celebrate({
      emoji: '🎉',
      title: '열렸어요!',
      subtitle: '노래방과 여우 키우기가 열렸어요. 기다려 줘서 고마워 💗',
      message: String(CFG.opensDone || '').trim(),
      buttons: [
        { label: '🎤 노래 부르러 가기', primary: true, onClick: () => Actions.sing() },
        { label: '🦊 여우 만나러 가기', onClick: () => FoxRoom.open() },
      ],
    });
  },

  /* ----- his side ----- */

  /** For the boyfriend-only page: when they open, and whether this device is in already. */
  noteHtml() {
    if (!this.at) return '<code>js/config.js</code>에 <code>opensAt</code>이 없어서, 노래방과 여우 키우기는 처음부터 열려 있어요.';
    if (Date.now() >= this.at) return `노래방과 여우 키우기는 ${esc(this.whenText())}에 열렸어요.`;
    return `노래방(스튜디오 · 내 커버)과 여우 키우기는 <b>${esc(this.whenText())}</b>에 열려요 (${esc(this.leftText())}). 그 전까지는 잠긴 문에 “${esc(this.note())}”가 보여요. 날짜와 문구는 <code>js/config.js</code>의 <code>opensAt</code>, <code>opensNote</code>예요.`;
  },

  setEarly(on) {
    this.early = !!on;
    try {
      if (on) localStorage.setItem(OPEN_EARLY_KEY, '1');
      else localStorage.removeItem(OPEN_EARLY_KEY);
    } catch (e) {
      /* a device that keeps nothing: until the page is closed, then */
    }
    this.was = this.shut(); // (no fanfare for him)
    this.watch();
    Game.ensureDaily();
    Pet.refresh();
  },
};

Object.assign(Actions, {
  'opening-tell': () => Opening.tell(),
  'opening-early': () => {
    Opening.setEarly(!Opening.early);
    Router.refresh();
    UI.toast(Opening.early ? '이 기기에서는 지금부터 열려 있어요.' : '이 기기에서도 다시 그날까지 잠겨요.', { icon: Opening.early ? '🔓' : '🔒' });
  },
});
