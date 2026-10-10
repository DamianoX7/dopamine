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

const Sync = {
  on: false, //      the server is there
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
    } catch (e) {
      /* start as a new device */
    }
  },

  saveMeta() {
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify({ rev: this.rev, epoch: this.epoch, dirty: this.dirty, key: this.key }));
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

  /* ----- talking to the server ----- */
  async api(path, o = {}) {
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
    const info = await this.ping();
    if (info === false) return;
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
    if (!this.on || document.hidden || this.status === 'locked' || CoverHost.quiet) return;
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
      const res = await this.api(`state?rev=${this.rev}`, { timeout: boot ? 4000 : 10000 });
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
    if (!this.on) return;
    const sig = this.signature();
    if (sig === this.sig) return;
    this.sig = sig;
    this.dirty = true;
    this.saveMeta();
    this.push();
  },

  push: debounce(() => Sync.pushNow(), 2000),

  async pushNow() {
    if (!this.on || !this.dirty || this.status === 'locked' || !State.onboarded) return;
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
    if (!this.on || !this.dirty || !this.rev || this.status !== 'ok' || !State.onboarded) return;
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
    if (this.on && this.status !== 'locked') {
      try {
        await this.api('all', { method: 'DELETE' });
      } catch (e) {
        /* unreachable — the local data is deleted anyway */
      }
    }
    this.on = false; // nothing more is sent before the page reloads
    try {
      localStorage.setItem(SYNC_KEY, JSON.stringify({ key: this.key }));
      ['dopamineWorld.syncGone.v1', SYNC_BEFORE_KEY].forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      /* ignore */
    }
  },
};
window.Sync = Sync;
