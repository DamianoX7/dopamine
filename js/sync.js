'use strict';
/* ==================================================================
   Sync — the same world on the phone and on the computer.

   When the site is served by server.py, the progress (State) is also
   kept on that server, and so are the covers (js/cover/sync.js does
   that half). Opened any other way — Live Server, a plain static host —
   this stays off and everything lives in this browser only, as before.

   The rule for the progress is simple: a device saves on top of the
   version it last saw. If another device saved in between, this one
   takes that version instead (the server answers 409), so a tab left
   open somewhere can never overwrite a newer session.
   ================================================================== */
const SYNC_KEY = 'dopamineWorld.sync.v1';
const SYNC_BEFORE_KEY = 'dopamineWorld.beforeSync.v1'; // this device's own progress, from before it joined a server that already had some

/* ==================================================================
   Cloud — the same thing on the published site, with Supabase in the
   place of server.py (js/config.js → supabase). The login typed in at
   the door (js/gate.js) is a Supabase user as well, and tools/publish.py
   seals that user into the config behind it:

   • hers keeps her progress there — one row in the table `progress`
     (data, rev), which only she can read or write (row level
     security) — and gets the letters;
   • his (`writer`) keeps no progress there: it sends her the letters.

   The table `letters` takes them (tools/supabase.sql: he may put one
   in, and take it back unread; she may read them, and say when she
   has). The covers stay with server.py.

   It answers the very requests server.py answers — `state?rev=`,
   `state` (PUT, with the version it builds on), `all` (DELETE), and
   `letters` (js/post.js) — so Sync below and Post work the same with
   either. A save on top of a version that is no longer the newest
   gets 409 and the newest, as there.
   ================================================================== */
const Cloud = {
  cfg: (window.DW_CONFIG || {}).supabase || {},
  session: null, // { token, uid, until }

  get ready() {
    const c = this.cfg;
    return !!(c.url && c.key && c.email && c.password);
  },

  /** On the published site, signed in with a Supabase user: hers, or his. */
  get on() {
    return this.ready && Gate.on;
  },

  /** …his: the one the letters are written with. */
  get writer() {
    return this.on && !!this.cfg.writer;
  },

  base() {
    return String(this.cfg.url).replace(/\/+$/, '');
  },

  async login(timeout) {
    const res = await this.fetch('POST', '/auth/v1/token?grant_type=password', { email: this.cfg.email, password: this.cfg.password }, { timeout, anon: true });
    const out = await res.json().catch(() => ({}));
    if (!res.ok || !out.access_token) {
      console.warn('[Dopamine World] Supabase login failed — is this login a user under Authentication → Users, with the same password? (tools/publish.py --set-login / --set-writer)', out);
      throw Object.assign(new Error('cloud login'), { code: 'auth' });
    }
    this.session = { token: out.access_token, uid: out.user.id, until: Date.now() + (out.expires_in || 3600) * 1000 - 60000 };
  },

  fetch(method, path, body, o = {}) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), o.timeout || 15000);
    const headers = { apikey: this.cfg.key, 'Content-Type': 'application/json' };
    if (!o.anon) headers.Authorization = `Bearer ${this.session.token}`;
    if (o.prefer) headers.Prefer = o.prefer;
    return fetch(this.base() + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: ctl.signal,
      cache: 'no-store',
      keepalive: !!o.keepalive,
    }).finally(() => clearTimeout(timer));
  },

  /* A request with this login — hers, or his (made, or made again, when needed). */
  async rest(method, path, body, o = {}) {
    // (an answer is always read, even one there is nothing in: one left unread is cut off when it is cleared away,
    //  and the browser lists the request as failed although it went through)
    const drain = (res) => res.text().catch(() => '');
    if (!this.session || Date.now() > this.session.until) await this.login(o.timeout);
    let res = await this.fetch(method, `/rest/v1/${path}`, body, o);
    if (res.status === 401) {
      await drain(res);
      await this.login(o.timeout);
      res = await this.fetch(method, `/rest/v1/${path}`, body, o);
    }
    if (!res.ok && res.status !== 409) throw Object.assign(new Error(`cloud ${res.status} ${await drain(res)}`), { code: 'refused', status: res.status });
    if (o.prefer === 'return=minimal' || (method === 'DELETE' && !o.prefer)) await drain(res); // (nothing in it to read)
    return res;
  },

  mine() {
    return `progress?user_id=eq.${this.session.uid}`;
  },

  async row(timeout) {
    if (!this.session) await this.login(timeout);
    const res = await this.rest('GET', `${this.mine()}&select=data,rev,updated_at`, undefined, { timeout });
    return (await res.json())[0] || null;
  },

  reply(row, withJson = true) {
    const out = { rev: row ? row.rev : 0, savedAt: row ? Date.parse(row.updated_at) : 0, epoch: 'cloud' };
    if (row && withJson) out.json = JSON.stringify(row.data);
    return out;
  },

  answer(out, status = 200) {
    return new Response(JSON.stringify(out), { status, headers: { 'Content-Type': 'application/json' } });
  },

  /* What Sync.api() asks server.py, answered from Supabase. */
  async api(path, o = {}) {
    const method = o.method || 'GET';
    const t = o.timeout;
    if (path.startsWith('state') && method === 'GET') {
      const have = new URLSearchParams(path.split('?')[1] || '').get('rev');
      const row = await this.row(t);
      return this.answer(this.reply(row, !row || String(row.rev) !== have));
    }
    if (path === 'state' && method === 'PUT') {
      const { base, json } = o.json;
      const data = JSON.parse(json);
      if (!this.session) await this.login(t);
      let res;
      if (!base) {
        res = await this.rest('POST', 'progress', { user_id: this.session.uid, data, rev: 1 }, { timeout: t, keepalive: o.keepalive, prefer: 'return=minimal' });
        if (res.ok) return this.answer({ rev: 1, epoch: 'cloud' });
      } else {
        const body = { data, rev: base + 1, updated_at: new Date().toISOString() };
        res = await this.rest('PATCH', `${this.mine()}&rev=eq.${base}`, body, { timeout: t, keepalive: o.keepalive, prefer: 'return=representation' });
        if ((await res.json()).length) return this.answer({ rev: base + 1, epoch: 'cloud' });
      }
      // another device saved in between (or the row is gone): the newest, as server.py answers it
      return this.answer(this.reply(await this.row(t)), 409);
    }
    if (path === 'all' && method === 'DELETE') {
      if (!this.session) await this.login(t);
      await this.rest('DELETE', this.mine(), undefined, { timeout: t });
      return this.answer({ ok: true, epoch: 'cloud' });
    }
    throw new Error(`cloud: no ${method} ${path}`);
  },

  /* What Post.call() asks server.py's letter box, answered from the table `letters` (columns: id, body, sent_at, day,
     read_at — the letter's id, text, at, on and read). Throws with a code: 'refused' (row level security, or a letter
     she has read and that cannot be taken back), 'auth' (the login), 'offline' (nothing answered). */
  async letters(path, o = {}) {
    const method = o.method || 'GET';
    const m = /^letters(?:\/([^/]+)(\/read)?)?$/.exec(path);
    try {
      if (!m) throw new Error(`cloud: no ${method} ${path}`);
      const one = m[1] ? `letters?id=eq.${encodeURIComponent(decodeURIComponent(m[1]))}` : '';
      if (!m[1] && method === 'GET') {
        const rows = await (await this.rest('GET', 'letters?select=id,body,sent_at,day,read_at&order=sent_at.asc')).json();
        return { letters: rows.map((r) => ({ id: r.id, text: r.body, at: +r.sent_at || 0, on: r.day || '', read: +r.read_at || 0 })) };
      }
      if (!m[1] && method === 'POST') {
        const l = o.json;
        // (409: sent again after an answer that got lost — it is there already)
        await this.rest('POST', 'letters', { id: l.id, body: l.text, sent_at: l.at, day: l.on || '' }, { prefer: 'return=minimal' });
        return { ok: true };
      }
      if (m[2] && method === 'POST') {
        await this.rest('PATCH', `${one}&read_at=eq.0`, { read_at: o.json.read }, { prefer: 'return=minimal' });
        return { ok: true };
      }
      if (m[1] && !m[2] && method === 'DELETE') {
        const gone = await (await this.rest('DELETE', `${one}&read_at=eq.0`, undefined, { prefer: 'return=representation' })).json();
        if (!gone.length) {
          const [left] = await (await this.rest('GET', `${one}&select=read_at`)).json();
          if (left && +left.read_at) throw Object.assign(new Error('she has read it'), { code: 'refused' });
        }
        return { ok: true };
      }
      throw new Error(`cloud: no ${method} ${path}`);
    } catch (e) {
      if (!e.code) e.code = 'offline';
      throw e;
    }
  },
};

const Sync = {
  on: false, //      the server is there
  cloud: false, //   …or, on the published site, Supabase is (see Cloud above)
  where: '', //      which of the two the rev below belongs to
  status: 'off', //  off | ok | offline | locked
  rev: 0, //         the server's version this device last saw
  epoch: '', //      changes when everything on the server was deleted
  dirty: false, //   progress the server doesn't have yet
  key: '', //        the passcode, if the server asks for one
  sig: '',
  busy: false,
  libraryReady: false, // the covers have been compared with the server at least once
  syncLibrary: null, //   set by js/cover/sync.js

  /* ----- what this device remembers about the server ----- */
  loadMeta() {
    try {
      const m = JSON.parse(localStorage.getItem(SYNC_KEY) || '{}');
      this.rev = m.rev || 0;
      this.epoch = m.epoch || '';
      this.dirty = !!m.dirty;
      this.key = m.key || '';
      this.where = m.where || '';
    } catch (e) {
      /* start as a new device */
    }
  },

  saveMeta() {
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify({ rev: this.rev, epoch: this.epoch, dirty: this.dirty, key: this.key, where: this.where }));
    } catch (e) {
      /* ignore */
    }
  },

  /* The progress as text, without what merely passes with time (the fox getting hungry):
     an idle tab must not look as if something had been done in it. */
  signature() {
    const p = State.pet;
    const keep = [p.happiness, p.fullness, p.lastTick];
    p.happiness = p.fullness = p.lastTick = 0;
    const s = JSON.stringify(State);
    [p.happiness, p.fullness, p.lastTick] = keep;
    return s;
  },

  setStatus(status) {
    if (this.status === status) return;
    this.status = status;
    if (typeof Views !== 'undefined' && Views.me && Router.is('me')) Views.me.fillStorage();
  },

  /** Progress is being kept somewhere besides this browser. */
  get live() {
    return this.on || this.cloud;
  },

  /* The rev and epoch this device remembers belong to one place: moving to the other starts afresh. */
  place(where) {
    if (this.where === where) return;
    if (this.where) {
      this.rev = 0;
      this.epoch = '';
    }
    this.where = where;
  },

  /* ----- talking to the server ----- */
  async api(path, o = {}) {
    if (this.cloud) return Cloud.api(path, o);
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), o.timeout || 15000);
    const headers = {};
    if (this.key) headers['X-DW-Key'] = encodeURIComponent(this.key);
    let body = o.body;
    if (o.json !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(o.json);
    } else if (o.type) headers['Content-Type'] = o.type;
    try {
      const res = await fetch(new URL(`api/${path}`, document.baseURI), {
        method: o.method || 'GET',
        headers,
        body,
        signal: ctl.signal,
        cache: 'no-store',
        keepalive: !!o.keepalive,
      });
      if (res.status === 401) {
        this.setStatus('locked');
        throw Object.assign(new Error('passcode needed'), { code: 'locked' });
      }
      return res;
    } finally {
      clearTimeout(timer);
    }
  },

  /* Is this site running on server.py? `null` = couldn't reach anything. */
  async ping() {
    try {
      const res = await this.api('ping', { timeout: 2500 });
      const isJson = (res.headers.get('content-type') || '').includes('json');
      const info = res.ok && isJson ? await res.json() : {};
      return info.app === 'dopamine-world' ? info : false;
    } catch (e) {
      return null;
    }
  },

  /* Called once while the app boots, before anything reads State. */
  async start() {
    this.loadMeta();
    this.sig = this.signature();
    // the published site (js/gate.js) has no server.py: Supabase, if it is set up — and only there, so that a copy
    // opened to try something out never writes into her progress. (His login keeps none there: it is for writing her
    // letters, and whatever else is done on his device stays on it.)
    if (Gate.on) {
      if (Cloud.on && !Cloud.writer) await this.startCloud();
      return;
    }
    const info = await this.ping();
    if (info === false) return;
    this.place('server');
    if (info === null) {
      // it synced before, so the server exists — it just can't be reached right now
      if (!this.rev) return;
      this.on = true;
      this.setStatus('offline');
    } else {
      this.on = true;
      if (info.locked && !info.authed) this.setStatus('locked');
      else await this.pull(true);
    }
    this.libraryNow(); // if the studio modules loaded first, they were told "not yet"
    this.watch();
  },

  async startCloud() {
    this.cloud = true;
    this.place(`cloud:${Cloud.cfg.email}`); // (another login: another row — this device starts afresh with it)
    if (!this.rev && State.onboarded) this.dirty = true; // what she did here before: the first save sends it
    await this.pull(true);
    this.watch();
  },

  watch() {
    setInterval(() => this.tick(), 20000);
    setInterval(() => this.libraryNow(), 60000);
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) return;
      this.tick();
      this.libraryNow();
    });
    window.addEventListener('pagehide', () => this.lastCall());
  },

  tick() {
    if (!this.live || document.hidden || this.status === 'locked' || CoverHost.quiet) return;
    this.pull(false);
  },

  libraryNow() {
    if (this.on && !document.hidden && this.status !== 'locked' && this.syncLibrary) this.syncLibrary();
  },

  /* ----- progress: server → this device ----- */
  async pull(boot) {
    if (this.busy) return;
    this.busy = true;
    try {
      const res = await this.api(`state?rev=${this.rev}`, { timeout: boot ? (this.cloud ? 8000 : 4000) : 10000 });
      if (!res.ok) throw new Error(`state ${res.status}`);
      const remote = await res.json();
      if (this.epoch && remote.epoch !== this.epoch) {
        // the server started over (everything was deleted there): this device is new to it
        this.rev = 0;
        this.dirty = true;
      }
      this.epoch = remote.epoch;
      if (remote.rev < this.rev) {
        this.rev = remote.rev;
        this.dirty = true;
      }
      if (remote.rev > this.rev && remote.json) {
        const own = !this.rev && State.onboarded; // progress made here before this device ever synced
        if (own && (await this.keepOwn())) {
          this.rev = remote.rev;
          this.dirty = true;
        } else {
          if (own) {
            try {
              localStorage.setItem(SYNC_BEFORE_KEY, JSON.stringify(State));
            } catch (e) {
              /* ignore */
            }
          }
          this.adopt(remote, boot);
        }
      }
      this.setStatus('ok');
      this.saveMeta();
    } catch (e) {
      if (e.code !== 'locked') this.setStatus('offline');
    } finally {
      this.busy = false;
    }
    if (this.dirty && this.status === 'ok') this.push();
  },

  /* Closing the question without choosing takes the server's side: that is the copy the other devices share. */
  keepOwn() {
    return UI.confirm({
      icon: '🔄',
      title: '어느 쪽 진행 상황을 쓸까요?',
      text: '이 기기에도, 서버에도 진행 상황이 있어요. 둘 중 하나만 남아요.',
      ok: '이 기기 것 올리기',
      cancel: '서버 것 불러오기',
    });
  },

  adopt(remote, boot) {
    Store.adopt(remote.json);
    this.rev = remote.rev;
    this.dirty = false;
    this.sig = this.signature();
    this.saveMeta();
    if (boot) return;
    Game.ensureDaily();
    Pet.tick();
    Theme.apply();
    UI.lastDopa = State.dopamine.points;
    UI.updateHud();
    if (FoxRoom.ov) FoxRoom.refresh();
    if (!UI.stack.length && (Router.is('home') || Router.is('me'))) Router.refresh();
    UI.toast('다른 기기에서 한 내용을 불러왔어요', { icon: '🔄' });
  },

  /* ----- progress: this device → server ----- */
  /* Store.saveNow() reports every save; only real changes are sent. */
  noteSaved() {
    if (!this.live) return;
    const sig = this.signature();
    if (sig === this.sig) return;
    this.sig = sig;
    this.dirty = true;
    this.saveMeta();
    this.push();
  },

  push: debounce(() => Sync.pushNow(), 2000),

  async pushNow() {
    if (!this.live || !this.dirty || this.status === 'locked' || !State.onboarded) return;
    if (this.busy) return void this.push();
    this.busy = true;
    const sent = this.sig;
    try {
      const res = await this.api('state', { method: 'PUT', json: { base: this.rev, json: JSON.stringify(State) } });
      const out = await res.json();
      if (res.status === 409) {
        if (out.json) this.adopt(out, false);
        else this.rev = out.rev;
      } else if (res.ok) {
        this.rev = out.rev;
        this.epoch = out.epoch;
        this.dirty = this.sig !== sent;
      } else throw new Error(`state ${res.status}`);
      this.setStatus('ok');
      this.saveMeta();
    } catch (e) {
      if (e.code !== 'locked') this.setStatus('offline');
    } finally {
      this.busy = false;
    }
    if (this.dirty && this.status === 'ok') this.push();
  },

  /* The page is going away with something unsent: one last try that outlives the page. */
  lastCall() {
    Store.saveNow();
    if (!this.live || !this.dirty || !this.rev || this.status !== 'ok' || !State.onboarded) return;
    this.api('state', { method: 'PUT', json: { base: this.rev, json: JSON.stringify(State) }, keepalive: true }).catch(() => {});
  },

  /* ----- passcode ----- */
  async unlock(key) {
    this.key = key;
    const info = await this.ping();
    if (!info || (info.locked && !info.authed)) {
      this.key = '';
      return false;
    }
    this.saveMeta();
    this.status = 'offline'; // not locked any more; pull() settles it
    await this.pull(false);
    this.libraryNow();
    return true;
  },

  askKey() {
    const ov = UI.open(
      `<form class="dialog" data-sync-key>
        <div class="dialog-icon" aria-hidden="true">🔑</div>
        <h2><label for="sync-key">동기화 비밀번호</label></h2>
        <p>이 기기에서 한 번만 입력하면 돼요.</p>
        <input id="sync-key" class="ob-input" type="password" maxlength="100" autocomplete="off" autofocus>
        <div class="dialog-actions">
          <button class="btn soft" type="button" data-ov-cancel>취소</button>
          <button class="btn primary" type="submit">확인</button>
        </div>
      </form>`,
      { cls: 'is-dialog', label: '동기화 비밀번호' }
    );
    $('[data-ov-cancel]', ov.panel).addEventListener('click', () => UI.close(ov));
    $('[data-sync-key]', ov.panel).addEventListener('submit', async (e) => {
      e.preventDefault();
      const ok = await this.unlock($('#sync-key', ov.panel).value);
      if (!ok) return UI.toast('비밀번호가 맞지 않아요', { icon: '🔑' });
      UI.close(ov);
      const banner = $('[data-banner="sync"]');
      if (banner) banner.remove();
      UI.toast('이제 다른 기기와 같은 내용을 봐요', { icon: '🔄' });
    });
  },

  /* "Delete everything": the server's copy goes too. This device forgets all but the passcode. */
  async wipe() {
    if (this.live && this.status !== 'locked') {
      try {
        await this.api('all', { method: 'DELETE' });
      } catch (e) {
        /* unreachable — the local data is deleted anyway */
      }
    }
    this.on = this.cloud = false; // nothing more is sent before the page reloads
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify({ key: this.key }));
      ['dopamineWorld.syncGone.v1', SYNC_BEFORE_KEY].forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      /* ignore */
    }
  },
};
window.Sync = Sync;
