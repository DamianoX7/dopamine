'use strict';
/* ==================================================================
   🔑 Gate — the published site asks who is there.

   The site lives at a public address, so what is personal in it — all
   of js/config.js: his messages to her, their dates, the passcode of
   his pages — is not published as it is. tools/publish.py seals it
   with her id and her password (PBKDF2 → AES-GCM) into
   `window.DW_SEALED`, and that is what js/config.js holds in the
   published copy. This file opens it again:

   • the first time on a device she logs in; the key made of her
     password, and the config it opened, are then kept on that device,
     and the site starts at once from then on;
   • when the site has been published anew, the kept key opens the new
     config without asking (it costs one reload);
   • a changed password asks her again.

   In the private copy (Live Server, server.py) js/config.js is the
   plain file: there is no DW_SEALED, and none of this happens.

   What it is not: a lock on the code. The pages and scripts are as
   public as those of any site; but without the password they start
   nothing, and none of his words are in them.
   ================================================================== */
const GATE_KEY = 'dopamineWorld.gate.v1'; //        { id, key, config }: which sealing this device opened, with what key, and what was in it
const GATE_TRIES_KEY = 'dopamineWorld.gateTries.v1'; // { n, until }: wrong tries in a row, and until when she has to wait

const Gate = {
  sealed: window.DW_SEALED || null,
  need: null, // null: she is in (or nothing is sealed) · 'login': she has to say who she is · 'renew': published anew — the kept key opens it

  /** Is this the published site, with its config sealed? */
  get on() {
    return !!this.sealed;
  },

  kept() {
    try {
      return JSON.parse(localStorage.getItem(GATE_KEY) || 'null');
    } catch (e) {
      return null;
    }
  },

  /* Before any other script runs: the config this device has kept — if it is the one that is published now. */
  start() {
    if (!this.sealed) return;
    const kept = this.kept();
    if (kept && kept.id === this.sealed.id && kept.config && typeof kept.config === 'object') {
      window.DW_CONFIG = kept.config;
      return;
    }
    window.DW_CONFIG = {}; // (nothing boots on it: js/main.js asks `need` first)
    this.need = kept && kept.key ? 'renew' : 'login';
  },

  /* ----- sealing and unsealing (the same steps as tools/publish.py) ----- */
  bytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },

  /** Her id and password → the key (base64). An id is not particular about capitals or stray spaces; a password is. */
  async derive(id, password) {
    const text = new TextEncoder().encode(`${String(id).trim().toLowerCase()}\n${password}`);
    const base = await crypto.subtle.importKey('raw', text, 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: this.bytes(this.sealed.salt), iterations: this.sealed.iter }, base, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  },

  /** The key → the config that was sealed. Throws if the key is not the one. */
  async unseal(key) {
    const k = await crypto.subtle.importKey('raw', this.bytes(key), 'AES-GCM', false, ['decrypt']);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: this.bytes(this.sealed.iv) }, k, this.bytes(this.sealed.data));
    // (what was sealed is the plain js/config.js: it is run, with a box in the place of `window`, and leaves DW_CONFIG in it)
    const box = {};
    new Function('window', new TextDecoder().decode(plain))(box);
    if (!box.DW_CONFIG || typeof box.DW_CONFIG !== 'object') throw new Error('the sealed config is empty');
    return JSON.parse(JSON.stringify(box.DW_CONFIG));
  },

  /* She is in: kept on this device, and the page starts over — this time with its config. */
  enter(key, config) {
    try {
      localStorage.setItem(GATE_KEY, JSON.stringify({ id: this.sealed.id, key, config }));
    } catch (e) {
      return void this.form('이 브라우저는 로그인을 기억할 수 없어요. 사생활 보호(시크릿) 모드라면 꺼 주세요.');
    }
    location.reload();
  },

  /** Log out on this device. (Her songs and her progress stay where they are.) */
  leave() {
    try {
      localStorage.removeItem(GATE_KEY);
    } catch (e) {
      /* nothing was kept, then */
    }
    location.reload();
  },

  /* ----- wrong tries: five in a row, and she waits (30 s, then twice as long each time, 10 minutes at most) ----- */
  tries() {
    try {
      return JSON.parse(localStorage.getItem(GATE_TRIES_KEY) || 'null') || { n: 0, until: 0 };
    } catch (e) {
      return { n: 0, until: 0 };
    }
  },
  tried(ok) {
    try {
      if (ok) return void localStorage.removeItem(GATE_TRIES_KEY);
      const t = this.tries();
      t.n += 1;
      if (t.n % 5 === 0) t.until = Date.now() + Math.min(600000, 30000 * 2 ** (t.n / 5 - 1));
      localStorage.setItem(GATE_TRIES_KEY, JSON.stringify(t));
    } catch (e) {
      /* a device that keeps nothing counts nothing */
    }
  },

  /* ----- the door ----- */
  async open() {
    document.body.classList.add('is-gated');
    if (!window.crypto || !crypto.subtle) return void this.form('이 주소로는 로그인할 수 없어요. https:// 로 시작하는 주소로 열어 주세요.', true);
    if (this.need === 'renew') {
      try {
        const kept = this.kept();
        return void this.enter(kept.key, await this.unseal(kept.key));
      } catch (e) {
        /* the password has been changed since: she is asked */
      }
    }
    this.form();
  },

  form(note = '', dead = false) {
    let el = document.getElementById('gate');
    if (!el) {
      el = document.createElement('div');
      el.id = 'gate';
      document.body.appendChild(el);
    }
    el.innerHTML = `<form class="gate-card" novalidate>
        <div class="gate-heart" aria-hidden="true">💗</div>
        <h1>도파민 월드</h1>
        <p class="gate-sub">오직 한 사람을 위한 작은 세상이에요.</p>
        <label class="gate-field"><span>아이디</span>
          <input name="who" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" maxlength="40" ${dead ? 'disabled' : ''}></label>
        <label class="gate-field"><span>비밀번호</span>
          <input name="pass" type="password" autocomplete="current-password" maxlength="80" ${dead ? 'disabled' : ''}></label>
        <p class="gate-msg" role="alert"></p>
        <button class="btn primary huge" type="submit" ${dead ? 'disabled' : ''}>들어가기</button>
      </form>`;
    const form = el.querySelector('form');
    const who = form.elements.who;
    const pass = form.elements.pass;
    const btn = form.querySelector('button');
    const msg = form.querySelector('.gate-msg');
    const say = (text) => {
      msg.textContent = text;
      form.classList.remove('is-wrong');
      if (text) {
        void form.offsetWidth;
        form.classList.add('is-wrong');
      }
    };
    msg.textContent = note;
    if (dead) return;
    let busy = false;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (busy) return;
      const wait = this.tries().until - Date.now();
      if (wait > 0) return void say(`잠깐만요 — ${wait >= 60000 ? `${Math.ceil(wait / 60000)}분` : `${Math.ceil(wait / 1000)}초`} 뒤에 다시 해 주세요.`);
      if (!who.value.trim() || !pass.value) return void say('아이디와 비밀번호를 적어 주세요.');
      busy = true;
      btn.disabled = true;
      btn.textContent = '확인하는 중…';
      msg.textContent = '';
      try {
        const key = await this.derive(who.value, pass.value);
        const config = await this.unseal(key);
        this.tried(true);
        btn.textContent = '어서 와요 💗';
        return void this.enter(key, config);
      } catch (err) {
        if (err && err.name !== 'OperationError') console.error(err);
        this.tried(false);
        const t = this.tries();
        say(t.until > Date.now() ? '여러 번 틀렸어요. 잠시 뒤에 다시 해 주세요.' : '아이디나 비밀번호가 맞지 않아요.');
        pass.value = '';
        pass.focus();
      }
      busy = false;
      btn.disabled = false;
      btn.textContent = '들어가기';
    });
    setTimeout(() => who.focus(), 80);
  },
};
Gate.start();
