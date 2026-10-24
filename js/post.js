'use strict';
/* ==================================================================
   📮 Post — letters he writes himself and sends her.

   Not the ready-made messages of js/config.js (those are drawn at
   random — Messages in js/game.js): a letter is written once, in the
   boyfriend-only space (나 → 설정 → 편지 쓰기), arrives once — a fox
   brings it, and Home says that it has come — and is then kept under
   나 → 편지, with its date. It may be told to wait for a day (her
   birthday, an anniversary).

   Where a letter goes when it is sent:
   • the site runs on the save server (server.py): to the server's
     letter box (api/letters), and from there to every device of hers;
   • the published site (js/gate.js), opened with his login: to the
     table `letters` in Supabase (Cloud in js/sync.js), and from there
     to every device opened with hers;
   • opened any other way (Live Server, a plain static host): into the
     letter box of this browser — there is nothing else to send it to.
   (Not by a link for her to tap: a messenger opens links in a browser
   of its own, which is not the one her world is saved in.)
   ================================================================== */
const LETTER_MAX = 2000;
const POST_DRAFT_KEY = 'dopamineWorld.letterDraft.v1'; //  what he is in the middle of writing: { text, on }
const POST_KEY_KEY = 'dopamineWorld.writerKey.v1'; //      the server's passcode on a device that only writes (it does not join her world)
const POST_PENDING_KEY = 'dopamineWorld.letterPending.v1'; // a letter on its way to the server, until the server has said that it has it
const POST_EVERY = 5 * 60000; //                           how often her devices look in the server's letter box

/** Text that can be sent anywhere: half an emoji (cut off at the length limit, say) becomes "�" rather than breaking the letter. */
const wellFormed = (s) => (typeof s.toWellFormed === 'function' ? s.toWellFormed() : s);

const Post = {
  seen: null, //     how many letters were waiting when this device last looked (more than that: one has just come)
  fetching: null,
  lastFetch: 0,
  askedKey: '',

  /** Where letters go and come from: 'server' (server.py), 'cloud' (Supabase, on the published site) or 'here' (this browser). */
  box() {
    return Sync.on ? 'server' : Cloud.on ? 'cloud' : 'here';
  },

  /** Is this one of her devices, the ones letters come to? On the server, one that shares her world; on the published
   *  site, one opened with her login (not with his, which only writes). */
  hers() {
    const box = this.box();
    return box === 'server' ? Sync.status === 'ok' : box === 'cloud' ? !Cloud.writer : true;
  },

  /** What the letter box is called, for "it cannot be reached just now". */
  boxName() {
    return this.box() === 'cloud' ? '클라우드' : '저장 서버';
  },

  /* ----- the letter box (her side) ----- */

  /** Letters that have arrived and are not read yet, the oldest first. One with a day waits for that day. */
  waiting() {
    if (!State.onboarded) return [];
    const today = dateKey();
    return State.post.inbox.filter((l) => !l.read && (!l.on || l.on <= today)).sort((a, b) => a.at - b.at);
  },

  /** The ones she has read, the newest first. */
  kept() {
    return State.post.inbox.filter((l) => l.read).sort((a, b) => b.read - a.read);
  },

  /** What her side shows changed: the mailbox's flag in the foxes' world, the cards on Home and under 나. */
  changed() {
    this.seen = this.waiting().length;
    Pet.refresh();
    FoxRoom.mailButton();
    HouseRoom.refresh(); // (…and the flag of the mailbox in the house)
    HouseHost.sync();
    // (never the pages he writes on: rebuilding them would take what he is typing)
    if (Router.is('home') || (Router.is('me') && [undefined, 'letters'].includes(Router.cur.params[0]))) Router.refresh();
  },

  /** A new letter has come while she is here. */
  announce(n) {
    Sfx.play('heart');
    UI.toast(n > 1 ? `새 편지가 ${n}통 도착했어요!` : '새 편지가 도착했어요!', { icon: '💌', ms: 4200 });
  },

  /** She opens a letter: `by` = the fox that brought it. Without a letter given, the one that has waited longest. */
  open(letter, { by = '', anchor = null } = {}) {
    letter = letter || this.waiting()[0];
    if (!letter) return false;
    const first = !letter.read;
    if (first) {
      letter.read = Date.now();
      Diary.note('letters');
      Game.reward({ dopamine: 10 }, anchor);
      Game.track('message');
      Store.save();
      this.changed();
      this.report();
    }
    Sfx.play('heart');
    const left = this.waiting().length;
    UI.open(
      `<div class="message-modal">
        <div class="env-anim" aria-hidden="true">💌</div>
        ${by ? `<p class="fox-post">🦊 ${esc(josa(by, '이/가'))} 물어다 준 편지</p>` : ''}
        ${first ? '<p class="new-badge">✨ 너에게 쓴 편지</p>' : ''}
        ${this.html(letter, 'big')}
        <div class="dialog-actions ${left ? '' : 'one'}">
          ${left ? `<button class="btn soft" data-action="post-next">💌 다음 편지 (${left})</button>` : ''}
          <button class="btn primary" data-action="close-overlay">💗 고마워</button>
        </div>
      </div>`,
      { cls: 'is-dialog is-post', label: '남자친구가 쓴 편지' }
    );
    return true;
  },

  /** The letter on its paper: who it is from, the text as he broke it into lines, and the day he wrote it. */
  html(letter, cls = '') {
    const from = CFG.boyfriendName ? `${esc(CFG.boyfriendName)}의 편지` : '남자친구의 편지';
    return `<div class="letter is-post ${cls}">
      <div class="letter-from">💌 ${from}</div>
      <p class="letter-text">${esc(letter.text)}</p>
      <div class="letter-date">${fmtDateLong(letter.at)}</div>
    </div>`;
  },

  /* ----- Home ----- */

  /** The letters' card on Home: a letter that has come goes before the ready-made messages. */
  cardHtml() {
    const n = this.waiting().length;
    if (!n) return '';
    return `<section class="card letter-card is-new">
      <div class="envelope" aria-hidden="true">💌</div>
      <div class="letter-card-text">
        <h2 class="card-title">새 편지가 도착했어요!</h2>
        <p class="hint">${n > 1 ? `너에게 쓴 편지 ${n}통` : '너에게 쓴 편지예요'} · 여우에게 받아도 돼요</p>
      </div>
      <button class="btn primary" data-action="post-open">읽기</button>
    </section>`;
  },

  /* ----- sending (his side) ----- */

  draft() {
    try {
      const d = JSON.parse(localStorage.getItem(POST_DRAFT_KEY) || '{}');
      return { text: typeof d.text === 'string' ? d.text : '', on: /^\d{4}-\d{2}-\d{2}$/.test(d.on) ? d.on : '' };
    } catch (e) {
      return { text: '', on: '' };
    }
  },

  keepDraft(d) {
    try {
      if (d && (d.text || d.on)) localStorage.setItem(POST_DRAFT_KEY, JSON.stringify(d));
      else localStorage.removeItem(POST_DRAFT_KEY);
    } catch (e) {
      /* private mode: the draft lives as long as the page */
    }
  },

  /** The passcode letters are sent with: the one this device syncs with, or one given for writing only. */
  key() {
    if (Sync.key && Sync.status === 'ok') return Sync.key;
    let own = this.askedKey;
    try {
      own = localStorage.getItem(POST_KEY_KEY) || own;
    } catch (e) {
      /* private mode: the one given since the page was opened */
    }
    return own || Sync.key || ''; // (a passcode this device once synced with may have been changed since)
  },

  keepKey(key) {
    this.askedKey = key;
    try {
      localStorage.setItem(POST_KEY_KEY, key);
    } catch (e) {
      /* private mode: it is asked again next time */
    }
  },

  /** The server's letter box. Throws { code: 'locked' } where the passcode is missing or wrong, { code: 'offline' } where nothing answers. */
  async call(path, o = {}) {
    if (this.box() === 'cloud') return Cloud.letters(path, o); // (the same requests, answered from Supabase)
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    const headers = {};
    const key = o.key !== undefined ? o.key : this.key();
    if (key) headers['X-DW-Key'] = encodeURIComponent(key);
    if (o.json !== undefined) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await fetch(new URL(`api/${path}`, document.baseURI), { method: o.method || 'GET', headers, body: o.json !== undefined ? JSON.stringify(o.json) : undefined, signal: ctl.signal, cache: 'no-store' });
    } catch (e) {
      throw Object.assign(new Error('the save server did not answer'), { code: 'offline' });
    } finally {
      clearTimeout(timer);
    }
    if (res.status === 401) throw Object.assign(new Error('passcode needed'), { code: 'locked' });
    if (!res.ok) throw Object.assign(new Error(`letters ${res.status}`), { code: 'refused' });
    return res.json();
  },

  /** Sends a letter. Resolves 'server' or 'here' (which letter box it went into); throws as call() does. */
  async send(text, on) {
    text = wellFormed(wellFormed(text).slice(0, LETTER_MAX));
    on = on || '';
    if (this.box() === 'here') {
      State.post.inbox.push({ id: uid('l'), text, at: Date.now(), on, via: 'here', read: 0 });
      Store.save();
      this.changed();
      return 'here';
    }
    // Should the server's answer get lost on the way, he sends again — and that must be the same letter, not a second one:
    // until the server has said it has it, the letter keeps its id (the server takes an id only once).
    const was = this.pending();
    const letter = was && was.text === text && was.on === on ? was : { id: uid('l'), text, at: Date.now(), on };
    this.keepPending(letter);
    await this.call('letters', { method: 'POST', json: letter });
    this.keepPending(null);
    if (this.hers()) this.fetch(true); // this device is one of hers as well
    return 'server';
  },

  pending() {
    try {
      const p = JSON.parse(localStorage.getItem(POST_PENDING_KEY) || 'null');
      return p && typeof p.id === 'string' && typeof p.text === 'string' ? p : null;
    } catch (e) {
      return this.onItsWay || null;
    }
  },

  keepPending(letter) {
    this.onItsWay = letter;
    try {
      if (letter) localStorage.setItem(POST_PENDING_KEY, JSON.stringify(letter));
      else localStorage.removeItem(POST_PENDING_KEY);
    } catch (e) {
      /* private mode: remembered as long as the page is open */
    }
  },

  /** Takes a letter back, as long as she has not read it. */
  async unsend(id) {
    if (this.box() !== 'here') await this.call(`letters/${encodeURIComponent(id)}`, { method: 'DELETE' });
    const before = State.post.inbox.length;
    State.post.inbox = State.post.inbox.filter((l) => l.id !== id || l.read);
    if (State.post.inbox.length !== before) {
      Store.save();
      this.changed();
    }
  },

  /** What the composer lists: the newest first, each with whether she has read it. */
  async list() {
    if (this.box() === 'here') return State.post.inbox.slice().sort((a, b) => b.at - a.at);
    const out = await this.call('letters');
    return (Array.isArray(out.letters) ? out.letters : [])
      .filter((l) => l && typeof l.id === 'string' && typeof l.text === 'string')
      .map((l) => ({ id: l.id, text: l.text, at: +l.at || 0, on: /^\d{4}-\d{2}-\d{2}$/.test(l.on) ? l.on : '', read: +l.read || 0 }))
      .sort((a, b) => b.at - a.at);
  },

  /* ----- the save server (or Supabase) → this device (her devices only) ----- */

  async fetch(now) {
    if (this.box() === 'here' || !this.hers() || document.hidden) return;
    if (!now && Date.now() - this.lastFetch < POST_EVERY) return;
    if (this.fetching) return this.fetching;
    this.lastFetch = Date.now();
    this.fetching = this.call('letters')
      .then((out) => this.take(out.letters || []))
      .catch(() => {}) // not reachable just now: the next look will do
      .finally(() => (this.fetching = null));
    return this.fetching;
  },

  /**
   * The server's letters as they are now: new ones arrive, ones he took back before she read them go — and one she has
   * read on another device of hers is read here too (so a device that lost its copy gets its kept letters back as kept,
   * not as new ones all over again).
   */
  take(remote) {
    remote = (Array.isArray(remote) ? remote : []).filter((r) => r && typeof r.id === 'string' && typeof r.text === 'string' && r.text.trim());
    const inbox = State.post.inbox;
    const waitingBefore = this.waiting().length;
    const ids = new Set(remote.map((l) => l.id));
    let changed = false;
    for (const r of remote) {
      const read = +r.read > 0 ? +r.read : 0;
      const have = inbox.find((l) => l.id === r.id);
      if (!have) {
        inbox.push({ id: r.id, text: r.text.slice(0, LETTER_MAX), at: +r.at || Date.now(), on: /^\d{4}-\d{2}-\d{2}$/.test(r.on) ? r.on : '', via: 'server', read, told: !!read });
        changed = true;
      } else if (!have.read && read) {
        have.read = read;
        have.told = true;
        changed = true;
      }
    }
    const kept = inbox.filter((l) => l.via !== 'server' || l.read || ids.has(l.id));
    if (kept.length !== inbox.length) {
      State.post.inbox = kept;
      changed = true;
    }
    if (changed) {
      Store.save();
      this.changed();
      const more = this.waiting().length - waitingBefore;
      if (more > 0) this.announce(more);
    }
    this.report(remote);
  },

  /** Tells the server which letters she has read, so that he can see it where he wrote them. */
  report(remote) {
    if (this.box() === 'here' || !this.hers()) return;
    const known = remote ? new Map(remote.filter(Boolean).map((l) => [l.id, l])) : null;
    for (const l of State.post.inbox) {
      if (!l.read || l.via !== 'server' || l.told) continue;
      if (known && !known.has(l.id)) continue; // he deleted it from the server; she keeps her copy
      if (known && known.get(l.id).read) {
        l.told = true;
        continue;
      }
      this.call(`letters/${encodeURIComponent(l.id)}/read`, { method: 'POST', json: { read: l.read } })
        .then(() => {
          l.told = true;
          Store.save();
        })
        .catch(() => {});
    }
  },

  /** A day has begun on which a letter was to arrive (called every minute, and when the page is looked at again). */
  tick() {
    const n = this.waiting().length;
    const more = n - (this.seen == null ? n : this.seen);
    if (n !== this.seen) this.changed(); // (…or her other device has read one)
    if (more > 0) this.announce(more);
    this.fetch(false);
  },

  start() {
    this.seen = this.waiting().length;
    this.fetch(true);
    setInterval(() => this.tick(), 60000);
    document.addEventListener('visibilitychange', () => document.hidden || this.tick());
  },
};

/* ------------------------------------------------------------------
   ✍️ 편지 쓰기 — #/me/write, behind the same door as the message editor (Door in js/views/me.js).
   ------------------------------------------------------------------ */
const PostDesk = {
  list: null, //   the letters sent so far (null: not fetched yet), or { error }
  busy: false,

  html() {
    if (!Door.isOpen) return Door.html('✍️ 편지 쓰기', '쉿… 여기는 편지를 쓰는 곳이에요.', '남자친구가 편지를 써서 보내는 곳이에요. 다 쓴 편지는 여우가 물어다 줄 거예요.');
    if (Post.box() === 'cloud' && !Cloud.writer) {
      // her login: letters reach this device, but they are written with his (the table takes them from him only)
      return `<section class="me-sub post-desk">
        ${subHead('✍️ 편지 쓰기')}
        <div class="card center">
          <div class="empty-icon" aria-hidden="true">💌</div>
          <h2>편지는 남자친구 로그인으로 써요</h2>
          <p class="hint">이 기기는 그녀의 로그인으로 들어와 있어요. 편지는 남자친구가 자기 로그인으로 들어온 기기에서 쓰고 보내요. 보낸 편지는 이 기기로 와요.</p>
        </div>
        <a class="btn ghost wide" href="#/me/messages">✏️ 랜덤 메시지 편집으로</a>
      </section>`;
    }
    const d = Post.draft();
    const today = dateKey();
    const where = Post.box() === 'cloud'
      ? '보내면 그녀가 로그인한 모든 기기에 도착하고, 여우가 물어다 줘요. 사이트를 열어 둔 기기에는 몇 분 안에 가요.'
      : !Sync.on
      ? '보내면 이 브라우저의 우편함에 들어가고, 여우가 물어다 줘요. 다른 기기로는 가지 않아요 (저장 서버로 연 사이트에서만 다른 기기로 전해져요).'
      : {
          ok: '보내면 저장 서버를 거쳐 그녀의 모든 기기에 도착하고, 여우가 물어다 줘요.',
          offline: '지금은 저장 서버에 닿지 않아요. 편지는 써 둘 수 있고, 연결되면 보낼 수 있어요.',
          locked: '보내면 저장 서버를 거쳐 그녀의 기기에 도착해요. 이 기기는 그녀의 세상과 이어져 있지 않아서, 처음 보낼 때 서버 비밀번호를 물어봐요.',
        }[Sync.status] || '';
    return `<section class="me-sub post-desk">
      ${subHead('✍️ 편지 쓰기')}
      <div class="card">
        <label class="card-title" for="post-text">💌 그녀에게</label>
        <textarea id="post-text" class="post-text" data-post-text data-input="post-draft" rows="9" maxlength="${LETTER_MAX}" placeholder="하고 싶은 말을 적어 보세요. 줄을 바꾼 그대로 전해져요.">${esc(d.text)}</textarea>
        <p class="post-count hint"><span data-post-count>${d.text.length}</span> / ${LETTER_MAX}자 · 쓰는 동안 이 기기에 저장돼요</p>
        <div class="set-block"><span id="post-when">📅 전할 날</span>
          <div class="seg" role="radiogroup" aria-labelledby="post-when">
            <button class="seg-btn ${d.on ? '' : 'on'}" role="radio" aria-checked="${!d.on}" data-action="post-when" data-v="now">지금 바로</button>
            <button class="seg-btn ${d.on ? 'on' : ''}" role="radio" aria-checked="${!!d.on}" data-action="post-when" data-v="day">날짜 정하기</button>
          </div>
          ${d.on ? `<input class="ob-input post-day" type="date" data-change="post-day" min="${today}" value="${esc(d.on)}" aria-label="편지를 전할 날짜">
          <p class="hint">${fmtDay(d.on)}에 여우가 물어다 줘요. 그날까지는 그녀에게 보이지 않아요.</p>` : ''}
        </div>
        <p class="hint">${where}</p>
        <div class="dialog-actions">
          <button class="btn soft" data-action="post-preview">👀 미리 보기</button>
          <button class="btn primary" data-action="post-send">💌 보내기</button>
        </div>
      </div>
      <div class="card">
        <h2 class="card-title">📮 보낸 편지</h2>
        <div data-post-sent>${this.sentHtml()}</div>
      </div>
      <a class="btn ghost wide" href="#/me/messages">✏️ 랜덤 메시지 편집으로</a>
    </section>`;
  },

  sentHtml() {
    const list = this.list;
    if (!list) return '<p class="hint">불러오는 중…</p>';
    if (list.error === 'locked') return '<p class="hint">서버 비밀번호를 넣으면 보낸 편지가 보여요.</p><button class="btn soft small" data-action="post-key">🔑 비밀번호 입력</button>';
    if (list.error) return `<p class="hint">지금은 ${Post.boxName()}에 닿지 않아요. 잠시 뒤에 다시 열어 주세요.</p>`;
    if (!list.length) return '<p class="hint">아직 보낸 편지가 없어요.</p>';
    const today = dateKey();
    return `<ul class="post-sent">${list
      .map((l) => {
        const state = l.read ? `<span class="chip chip-done">✓ ${fmtDate(l.read)} 읽음</span>` : l.on && l.on > today ? `<span class="chip">🗓️ ${fmtDay(l.on)}에 전달</span>` : '<span class="chip chip-hot">📮 아직 안 읽음</span>';
        return `<li>
          <button class="post-row" data-action="post-reread" data-id="${esc(l.id)}">
            <span class="post-meta">${fmtDateLong(l.at)} ${state}</span>
            <span class="post-peek">${esc(l.text.replace(/\s+/g, ' ').slice(0, 60))}</span>
          </button>
          ${l.read ? '' : `<button class="icon-btn small" data-action="post-unsend" data-id="${esc(l.id)}" aria-label="이 편지 보내기 취소">🗑️</button>`}
        </li>`;
      })
      .join('')}</ul>`;
  },

  /** Fetches the sent letters and fills them in (the page itself is not rebuilt: he may be typing). */
  async load() {
    if (Post.box() === 'cloud' && !Cloud.writer) return; // (her login: the desk has nothing to list)
    try {
      this.list = await Post.list();
    } catch (e) {
      this.list = { error: e.code || 'offline' };
    }
    const el = $('[data-post-sent]');
    if (el) el.innerHTML = this.sentHtml();
  },

  /** The text and the day as they are on the page right now. */
  read() {
    const ta = $('[data-post-text]');
    const d = Post.draft();
    return { text: (ta ? ta.value : d.text).trim(), on: d.on };
  },

  /** Asks for the server's passcode, for a device that only writes. Resolves true once one that works is kept. */
  askKey() {
    return new Promise((resolve) => {
      let done = false;
      const ov = UI.open(
        `<form class="dialog" data-post-key>
          <div class="dialog-icon" aria-hidden="true">🔑</div>
          <h2><label for="post-key">저장 서버 비밀번호</label></h2>
          <p>편지를 보낼 때만 쓰여요. 이 기기가 그녀의 세상과 이어지지는 않아요.</p>
          <input id="post-key" class="ob-input" type="password" maxlength="100" autocomplete="off" autofocus>
          <div class="dialog-actions">
            <button class="btn soft" type="button" data-ov-cancel>취소</button>
            <button class="btn primary" type="submit">확인</button>
          </div>
        </form>`,
        { cls: 'is-dialog', label: '저장 서버 비밀번호', onClose: () => resolve(done) }
      );
      $('[data-ov-cancel]', ov.panel).addEventListener('click', () => UI.close(ov));
      $('[data-post-key]', ov.panel).addEventListener('submit', async (e) => {
        e.preventDefault();
        const key = $('#post-key', ov.panel).value;
        try {
          await Post.call('letters', { key }); // tried first: a wrong one is never kept
        } catch (err) {
          if (err.code === 'locked') return UI.toast('비밀번호가 맞지 않아요', { icon: '🔑' });
          return UI.toast('지금은 저장 서버에 닿지 않아요', { icon: '⚠️' });
        }
        Post.keepKey(key);
        done = true;
        UI.close(ov);
      });
    });
  },

  async send() {
    if (this.busy) return;
    const { text, on } = this.read();
    if (!text) return UI.toast('먼저 편지를 적어 주세요', { icon: '✏️' });
    if (on && on < dateKey()) return UI.toast('전할 날이 이미 지났어요. 날짜를 다시 골라 주세요.', { icon: '📅' });
    this.busy = true;
    try {
      let where;
      try {
        where = await Post.send(text, on);
      } catch (e) {
        if (e.code !== 'locked') throw e;
        if (!(await this.askKey())) return;
        where = await Post.send(text, on);
      }
      Post.keepDraft(null);
      Sfx.play('reward');
      UI.toast(on ? `편지를 부쳤어요. ${fmtDay(on)}에 전해져요` : where === 'server' ? '편지를 부쳤어요. 그녀가 들어오면 여우가 물어다 줘요' : '편지를 우편함에 넣었어요. 여우가 물어다 줘요', { icon: '📮', ms: 4200 });
      this.list = null;
      Router.refresh();
    } catch (e) {
      UI.toast(e.code === 'offline' ? `지금은 ${Post.boxName()}에 닿지 않아요. 편지는 그대로 있으니 잠시 뒤에 다시 보내 주세요.` : '편지를 보내지 못했어요. 편지는 그대로 있어요.', { icon: '⚠️', ms: 4800 });
    } finally {
      this.busy = false;
    }
  },
};

Object.assign(Actions, {
  'post-open': (el) => Post.open(null, { anchor: el }),
  'post-next': async () => {
    await UI.close(UI.top());
    Post.open();
  },
  'post-read': (el) => {
    const l = State.post.inbox.find((x) => x.id === el.dataset.id);
    if (l) Post.open(l);
  },
  'post-when': (el) => {
    const d = PostDesk.read();
    Post.keepDraft({ text: $('[data-post-text]').value, on: el.dataset.v === 'day' ? d.on || addDays(dateKey(), 1) : '' });
    Router.refresh();
  },
  'post-preview': () => {
    const { text } = PostDesk.read();
    if (!text) return UI.toast('먼저 편지를 적어 주세요', { icon: '✏️' });
    UI.open(
      `<div class="message-modal">
        <div class="env-anim" aria-hidden="true">💌</div>
        <p class="new-badge">👀 그녀에게는 이렇게 보여요</p>
        ${Post.html({ text, at: Date.now() }, 'big')}
        <div class="dialog-actions one"><button class="btn primary" data-action="close-overlay">닫기</button></div>
      </div>`,
      { cls: 'is-dialog is-post', label: '편지 미리 보기' }
    );
  },
  'post-send': () => PostDesk.send(),
  'post-reread': (el) => {
    const l = (Array.isArray(PostDesk.list) ? PostDesk.list : []).find((x) => x.id === el.dataset.id);
    if (!l) return;
    UI.open(
      `<div class="message-modal">${Post.html(l, 'big')}
        <div class="dialog-actions one"><button class="btn primary" data-action="close-overlay">닫기</button></div></div>`,
      { cls: 'is-dialog is-post', label: '보낸 편지' }
    );
  },
  'post-unsend': async (el) => {
    const ok = await UI.confirm({ icon: '🗑️', title: '이 편지를 보내지 않을까요?', text: '아직 읽지 않은 편지라서 되돌릴 수 있어요. 쓰던 편지가 없으면 책상으로 돌아와요.', ok: '보내기 취소', danger: true });
    if (!ok) return;
    const letter = (Array.isArray(PostDesk.list) ? PostDesk.list : []).find((x) => x.id === el.dataset.id);
    try {
      await Post.unsend(el.dataset.id);
      const ta = $('[data-post-text]');
      if (letter && ta && !ta.value.trim()) {
        // the desk is empty: the letter goes back onto it, to be put right and sent again
        Post.keepDraft({ text: letter.text, on: letter.on && letter.on >= dateKey() ? letter.on : '' });
        PostDesk.list = null;
        Router.refresh();
        UI.toast('편지를 되돌렸어요. 고쳐서 다시 보낼 수 있어요', { icon: '↩️', ms: 3600 });
        return;
      }
      UI.toast('편지를 되돌렸어요', { icon: '🗑️' });
    } catch (e) {
      UI.toast(e.code === 'locked' ? '서버 비밀번호가 필요해요' : e.code === 'refused' ? '그사이에 읽은 편지라서 되돌릴 수 없어요' : `지금은 ${Post.boxName()}에 닿지 않아요`, { icon: '⚠️' });
    }
    PostDesk.load();
  },
  'post-key': async () => {
    if (await PostDesk.askKey()) PostDesk.load();
  },
});

Object.assign(Inputs, {
  'post-draft': (el) => {
    Post.keepDraft({ text: el.value, on: Post.draft().on });
    const n = $('[data-post-count]');
    if (n) n.textContent = el.value.length;
  },
});

Object.assign(Changes, {
  'post-day': (el) => {
    Post.keepDraft({ text: $('[data-post-text]').value, on: /^\d{4}-\d{2}-\d{2}$/.test(el.value) ? el.value : '' });
    Router.refresh();
  },
});
