'use strict';
/* ==================================================================
   UI toolkit: action dispatch, router, overlays (dialogs, sheets,
   full screens) with back-button support, toasts, celebrations,
   confetti and small template helpers.
   ================================================================== */

const Actions = {}; // data-action="x" → Actions.x(el, event)   (click)
const Inputs = {}; //  data-input="x"  → Inputs.x(el, event)    (input)
const Changes = {}; // data-change="x" → Changes.x(el, event)   (change)
const Views = {}; //   route → { render(params), mount(root, params), unmount(), tab, live }

const BLANK_IMG = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/* One requestAnimationFrame loop for everything that animates. */
const Loop = {
  fns: new Set(),
  raf: 0,
  add(fn) {
    this.fns.add(fn);
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    return () => this.fns.delete(fn);
  },
  tick: () => {
    Loop.raf = 0;
    if (!Loop.fns.size) return;
    Loop.fns.forEach((fn) => {
      try {
        fn();
      } catch (e) {
        console.error(e);
      }
    });
    Loop.raf = requestAnimationFrame(Loop.tick);
  },
};

/* ------------------------------------------------------------------
   Router — hash based: #/home, #/studio, #/covers, #/single/<id> …
   ------------------------------------------------------------------ */
const Router = {
  cur: null,
  view: null,
  hash: null, // the hash of the view on screen (to return to when leaving is blocked)

  init() {
    window.addEventListener('hashchange', () => this.render());
    if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/home');
    this.render();
  },

  parse() {
    const parts = location.hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
    return { name: parts[0] || 'home', params: parts.slice(1) };
  },

  async go(path) {
    if (UI.stack.length) await UI.closeAll();
    if (location.hash !== path) location.hash = path;
    else if (!(this.view && this.view.live && this.hash === path)) this.render();
  },

  render(keepScroll) {
    const { name, params } = this.parse();
    // Never leave in the middle of a take, or while a cover is being saved.
    const blocked = this.hash && location.hash !== this.hash ? CoverHost.blockedReason(name) : null;
    if (blocked) {
      history.replaceState(null, '', this.hash);
      UI.toast(blocked, { icon: '⏺️' });
      return;
    }
    const view = Opening.view(name) || Views[name] || Views.home; // (a room that is not open yet shows its door: js/opening.js)
    if (this.view && this.view.unmount) {
      try {
        this.view.unmount();
      } catch (e) {
        console.error(e);
      }
    }
    const root = $('#view');
    root.innerHTML = view.render(params, { refresh: !!keepScroll });
    this.cur = { name, params };
    this.view = view;
    this.hash = location.hash;
    if (view.mount) view.mount(root, params);
    CoverHost.hydrateArt(root);
    const tab = view.tab || name;
    $$('#tabbar a').forEach((a) => {
      const on = a.dataset.tab === tab;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });
    if (!keepScroll) window.scrollTo(0, 0);
  },

  /* Re-render the current view, keeping the scroll position. Live views update themselves. */
  refresh() {
    if (this.view && this.view.live) return;
    const y = window.scrollY;
    this.render(true);
    window.scrollTo(0, y);
  },

  is(name) {
    return !!(this.cur && this.cur.name === name);
  },
};

/* ------------------------------------------------------------------
   UI helpers
   ------------------------------------------------------------------ */
const UI = {
  stack: [],
  ignorePops: 0,
  popWaiters: [],
  pushQueue: [], // history entries of overlays that opened while another one's "back" was under way

  /* ----- overlays ----- */
  open(html, opts = {}) {
    const wrap = document.createElement('div');
    wrap.className = `overlay ${opts.full ? 'is-full' : 'is-sheet'} ${opts.cls || ''}`;
    wrap.innerHTML = `${opts.full ? '' : '<div class="ov-backdrop" data-ov-dismiss></div>'}
      <div class="ov-panel" role="dialog" aria-modal="true" ${opts.label ? `aria-label="${esc(opts.label)}"` : ''} tabindex="-1">${html}</div>`;
    $('#overlays').appendChild(wrap);
    const ov = { el: wrap, panel: wrap.querySelector('.ov-panel'), opts, closed: false, prevFocus: document.activeElement };
    this.stack.push(ov);
    document.body.classList.add('has-overlay');
    if (opts.full) $('#pet-pop').classList.remove('show'); // (a fox's pop-up still showing would sit on the new screen's buttons)
    void wrap.offsetWidth; // commit the closed state so the opening transition runs
    wrap.classList.add('open');
    if (!opts.noHistory) {
      this.afterPops(() => {
        if (ov.closed) return;
        try {
          history.pushState({ dwOverlay: true }, '');
          ov.pushed = true;
        } catch (e) {
          /* ignore */
        }
      });
    }
    setTimeout(() => {
      const f = ov.panel.querySelector('[autofocus]') || ov.panel;
      try {
        f.focus({ preventScroll: true });
      } catch (e) {
        /* ignore */
      }
    }, 60);
    CoverHost.hydrateArt(ov.panel);
    return ov;
  },

  close(ov, fromPop) {
    ov = ov || this.top();
    if (!ov || ov.closed) return Promise.resolve();
    ov.closed = true;
    this.stack = this.stack.filter((o) => o !== ov);
    ov.el.classList.remove('open');
    ov.el.classList.add('closing');
    setTimeout(() => ov.el.remove(), 280);
    if (!this.stack.length) document.body.classList.remove('has-overlay');
    try {
      if (ov.opts.onClose) ov.opts.onClose();
    } catch (e) {
      console.error(e);
    }
    try {
      if (ov.prevFocus && ov.prevFocus.focus && document.contains(ov.prevFocus)) ov.prevFocus.focus({ preventScroll: true });
    } catch (e) {
      /* ignore */
    }
    if (ov.pushed && !fromPop) {
      this.ignorePops++;
      return new Promise((resolve) => {
        this.popWaiters.push(resolve);
        history.back();
        setTimeout(resolve, 450);
      });
    }
    return Promise.resolve();
  },

  /* Run `fn` once no "back" of a closing overlay is still on its way. An overlay that opens the
     moment another closes must not push its history entry before that: the pending back would
     land on the new entry, and every later one would go a step too far — in the end out of the app. */
  afterPops(fn) {
    if (!this.ignorePops) return void fn();
    this.pushQueue.push(fn);
    setTimeout(() => this.flushPushes(), 500); // …or soon enough, should that back never report
  },

  flushPushes() {
    this.pushQueue.splice(0).forEach((fn) => fn());
  },

  async closeAll() {
    while (this.stack.length) await this.close(this.top());
  },

  top() {
    return this.stack[this.stack.length - 1] || null;
  },

  handlePop() {
    if (this.ignorePops > 0) {
      this.ignorePops--;
      const w = this.popWaiters.shift();
      if (w) w();
      if (!this.ignorePops) this.flushPushes();
      return;
    }
    const top = this.top();
    if (!top) return;
    if (top.opts.locked) {
      try {
        history.pushState({ dwOverlay: true }, '');
      } catch (e) {
        /* ignore */
      }
      return;
    }
    this.close(top, true);
  },

  dismissTop() {
    const top = this.top();
    if (top && !top.opts.locked) this.close(top);
  },

  confirm({ title, text = '', ok = '확인', cancel = '취소', danger = false, icon = '' }) {
    return new Promise((resolve) => {
      let result = false;
      const ov = this.open(
        `<div class="dialog">
          ${icon ? `<div class="dialog-icon" aria-hidden="true">${icon}</div>` : ''}
          <h2>${esc(title)}</h2>
          ${text ? `<p>${esc(text)}</p>` : ''}
          <div class="dialog-actions">
            <button class="btn soft" data-ov-cancel>${esc(cancel)}</button>
            <button class="btn ${danger ? 'danger' : 'primary'}" data-ov-ok>${esc(ok)}</button>
          </div>
        </div>`,
        { cls: 'is-dialog', label: title, onClose: () => resolve(result) }
      );
      ov.panel.querySelector('[data-ov-ok]').addEventListener('click', () => {
        result = true;
        this.close(ov);
      });
      ov.panel.querySelector('[data-ov-cancel]').addEventListener('click', () => this.close(ov));
    });
  },

  alert({ icon = '💗', title, text = '', ok = '확인' }) {
    return new Promise((resolve) => {
      const ov = this.open(
        `<div class="dialog">
          <div class="dialog-icon" aria-hidden="true">${icon}</div>
          <h2>${esc(title)}</h2>
          ${text ? `<p>${esc(text)}</p>` : ''}
          <div class="dialog-actions one"><button class="btn primary" data-ov-ok autofocus>${esc(ok)}</button></div>
        </div>`,
        { cls: 'is-dialog', label: title, onClose: resolve }
      );
      ov.panel.querySelector('[data-ov-ok]').addEventListener('click', () => this.close(ov));
    });
  },

  /* Bottom action sheet. items: [{ icon, label, onClick, danger }] */
  menu(title, items) {
    const ov = this.open(
      `<div class="menu">
        <div class="sheet-handle" aria-hidden="true"></div>
        ${title ? `<h3 class="menu-title">${esc(title)}</h3>` : ''}
        <div class="menu-list">
          ${items
            .map(
              (it, i) => `<button class="menu-item ${it.danger ? 'danger' : ''}" data-mi="${i}">
                <span class="mi-icon" aria-hidden="true">${it.icon || ''}</span><span>${esc(it.label)}</span></button>`
            )
            .join('')}
        </div>
        <button class="btn soft wide" data-ov-cancel>취소</button>
      </div>`,
      { cls: 'is-menu', label: title || '메뉴' }
    );
    ov.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-mi]');
      if (b) {
        const it = items[+b.dataset.mi];
        Sfx.play('tap');
        this.close(ov).then(() => it.onClick && it.onClick());
      } else if (e.target.closest('[data-ov-cancel]')) {
        this.close(ov);
      }
    });
    return ov;
  },

  loading(text) {
    return this.open(`<div class="loading"><div class="spinner" aria-hidden="true"></div><p>${esc(text)}</p></div>`, {
      cls: 'is-dialog is-loading',
      locked: true,
      noHistory: true,
      label: text,
    });
  },

  /* Queue so celebrations never stack on top of each other. */
  queue(fn) {
    this.q = (this.q || Promise.resolve()).then(fn).catch((e) => console.error(e));
    return this.q;
  },

  celebrate(o) {
    return this.queue(
      () =>
        new Promise((resolve) => {
          const r = o.rewards || {};
          const rw = [
            r.dopamine ? `<div class="rw"><b>+${fmtNum(r.dopamine)}</b><span>✨ 도파민</span></div>` : '',
            r.xp ? `<div class="rw"><b>+${fmtNum(r.xp)}</b><span>⭐ XP</span></div>` : '',
            r.coins ? `<div class="rw"><b>+${fmtNum(r.coins)}</b><span>🪙 코인</span></div>` : '',
          ].join('');
          const ach = (o.achievements || [])
            .map(
              (a) => `<div class="cel-ach"><span class="ach-emoji" aria-hidden="true">${a.emoji}</span>
                <div><b>업적 달성!</b><small>${esc(a.name)} — ${esc(a.desc)}</small></div></div>`
            )
            .join('');
          const lv = (o.levelUps || []).length
            ? `<div class="cel-level">⭐ 레벨 업! 이제 <b>Lv ${o.levelUps[o.levelUps.length - 1]}</b></div>`
            : '';
          const msg = o.message ? letterHtml(o.message) : '';
          const buttons = o.buttons || [{ label: '신난다! 💗', primary: true }];
          const ov = this.open(
            `<div class="celebrate ${o.rare ? 'is-rare' : ''}">
              <div class="cel-emoji" aria-hidden="true">${o.emoji || '🎉'}</div>
              <h2 class="cel-title">${esc(o.title)}</h2>
              ${o.subtitle ? `<p class="cel-sub">${esc(o.subtitle)}</p>` : ''}
              ${rw ? `<div class="rewards">${rw}</div>` : ''}
              ${lv}${ach}${msg}${o.extraHtml || ''}
              <div class="cel-actions">${buttons
                .map((b, i) => `<button class="btn ${b.primary ? 'primary' : 'soft'} wide" data-cb="${i}">${esc(b.label)}</button>`)
                .join('')}</div>
            </div>`,
            { cls: 'is-celebrate', label: o.title, onClose: resolve }
          );
          ov.panel.addEventListener('click', (e) => {
            const b = e.target.closest('[data-cb]');
            if (!b) return;
            const def = buttons[+b.dataset.cb];
            this.close(ov).then(() => def && def.onClick && def.onClick());
          });
          Sfx.play(o.sound || 'reward');
          if ((o.levelUps || []).length) setTimeout(() => Sfx.play('levelup'), 450);
          this.confetti({ gold: !!o.rare });
        })
    );
  },

  /* ----- toasts & floating numbers ----- */
  toast(msg, opts = {}) {
    const host = $('#toasts');
    const el = document.createElement('div');
    el.className = `toast ${opts.kind || ''}`;
    el.innerHTML = `<span class="toast-icon" aria-hidden="true">${opts.icon || '✨'}</span><span class="toast-text">${esc(msg)}</span>`;
    host.appendChild(el);
    while (host.children.length > 3) host.firstElementChild.remove();
    void el.offsetWidth;
    el.classList.add('show');
    setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => el.remove(), 400);
    }, opts.ms || 2600);
  },

  floatText(text, anchor) {
    if (!anchor) return;
    const r = anchor.getBoundingClientRect();
    const el = document.createElement('div');
    el.className = 'float-text';
    el.textContent = text;
    el.style.left = `${r.left + r.width / 2}px`;
    el.style.top = `${r.top + 4}px`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1300);
  },

  countUp(el, from, to, ms = 900) {
    if (!el) return;
    if (reducedMotion() || from === to) {
      el.textContent = fmtNum(to);
      return;
    }
    const t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / ms);
      el.textContent = fmtNum(from + (to - from) * (1 - Math.pow(1 - k, 3)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },

  /* ----- confetti (skipped with reduced motion) ----- */
  confetti(opts = {}) {
    if (reducedMotion()) return;
    const cv = $('#confetti');
    const ctx = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = window.innerWidth;
    const H = window.innerHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const colors = opts.gold ? ['#ffd166', '#ffe9a8', '#f7b733', '#ffffff'] : ['#ff5fa2', '#b36bff', '#ffd166', '#7ee0c3', '#8fd3ff', '#ff9ecb'];
    const parts = Array.from({ length: opts.count || 90 }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H * 0.38,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 11 - 4,
      r: 3 + Math.random() * 4,
      c: pick(colors),
      rot: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.3,
      shape: pick(['c', 'r', 'h', 's']),
    }));
    this.parts = (this.parts || []).concat(parts);
    if (this.confettiRunning) return;
    this.confettiRunning = true;
    cv.classList.add('on');
    const frame = () => {
      ctx.clearRect(0, 0, W, H);
      this.parts = this.parts.filter((p) => p.y < H + 30);
      this.parts.forEach((p) => {
        p.vy += 0.3;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.c;
        if (p.shape === 'c') {
          ctx.beginPath();
          ctx.arc(0, 0, p.r, 0, Math.PI * 2);
          ctx.fill();
        } else if (p.shape === 'r') {
          ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r);
        } else if (p.shape === 'h') {
          Art.heart(ctx, 0, 0, p.r * 3.2, 0);
        } else {
          Art.sparkle(ctx, 0, 0, p.r * 1.6, 0);
        }
        ctx.restore();
      });
      if (this.parts.length) requestAnimationFrame(frame);
      else {
        this.confettiRunning = false;
        cv.classList.remove('on');
        ctx.clearRect(0, 0, W, H);
      }
    };
    requestAnimationFrame(frame);
  },

  /* ----- persistent HUD ----- */
  updateHud() {
    const c = $('#hud-coins');
    if (c) c.textContent = fmtCompact(State.dopamine.coins);
    const l = $('#hud-level');
    if (l) l.textContent = State.dopamine.level;
    const sb = $('#sound-btn');
    if (sb) {
      const on = State.settings.soundEnabled;
      sb.textContent = on ? '🔊' : '🔇';
      sb.setAttribute('aria-label', on ? '소리 켜짐' : '소리 꺼짐');
      sb.setAttribute('aria-pressed', String(on));
    }
    $$('[data-live="dopamine"]').forEach((el) => (el.textContent = fmtNum(State.dopamine.points)));
    $$('[data-live="coins"]').forEach((el) => (el.textContent = fmtNum(State.dopamine.coins)));
    $$('[data-live="coins-short"]').forEach((el) => (el.textContent = fmtCompact(State.dopamine.coins))); // where there is little room: 12,345 → 1.2만
  },

  banner(id, html) {
    const slot = $('#banner-slot');
    if (!slot || slot.querySelector(`[data-banner="${id}"]`)) return;
    const el = document.createElement('div');
    el.className = 'banner';
    el.dataset.banner = id;
    el.innerHTML = `${html}<button class="banner-x" data-action="banner-close" aria-label="닫기">✕</button>`;
    slot.appendChild(el);
  },

  /* ----- the pet pops up to react ----- */
  petPop(text, opts = {}) {
    if (CoverHost.quiet || !text) return;
    if (typeof HouseRoom !== 'undefined' && HouseRoom.ov) return; // (in the house the fox is not there to say it)
    // a softer reaction never interrupts one that is still on screen
    if (opts.soft && Date.now() - (this.petAt || 0) < 3500) return;
    this.petAt = Date.now();
    const host = $('#pet-pop');
    host.innerHTML = `<button class="pet-pop-card" data-action="pet-pop-close" aria-label="${esc(State.pet.name)}: ${esc(text)}">
      ${Pet.avatarHtml('pet-pop-avatar')}<span class="pet-pop-bubble">${esc(text)}</span></button>`;
    Pet.fillAvatars(host);
    host.classList.add('show');
    clearTimeout(this.petTimer);
    this.petTimer = setTimeout(() => host.classList.remove('show'), 3800);
  },

  softError: (() => {
    let last = 0;
    return () => {
      if (Date.now() - last < 8000) return;
      last = Date.now();
      UI.toast('앗, 잠깐 문제가 생겼어요. 다시 시도해 주세요 💗', { icon: '🩹' });
    };
  })(),
};

/* ------------------------------------------------------------------
   Template helpers
   ------------------------------------------------------------------ */
/* A cover's artwork. The studio modules fill it in (CoverHost.hydrateArt). */
function artImg(cover, cls = '') {
  return `<span class="art ${cls}" data-cover-art="${esc(cover.id)}" role="img" aria-label="${esc(cover.title)} 커버 그림"></span>`;
}

function letterHtml(text, opts = {}) {
  const from = CFG.boyfriendName ? `${esc(CFG.boyfriendName)}의 편지` : '남자친구의 편지';
  return `<div class="letter ${opts.cls || ''}">
    <div class="letter-from">💌 ${from}</div>
    <p class="letter-text">${esc(text)}</p>
  </div>`;
}

function meterHtml(value, max, label) {
  const pct = max ? clamp((value / max) * 100, 0, 100) : 0;
  return `<div class="meter" role="progressbar" aria-label="${esc(label || '진행도')}" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${Math.round(value)}">
    <i style="width:${pct.toFixed(1)}%"></i></div>`;
}

function emptyState(icon, title, text, action = '') {
  return `<div class="empty"><div class="empty-icon" aria-hidden="true">${icon}</div><h3>${esc(title)}</h3>
    ${text ? `<p>${esc(text)}</p>` : ''}${action}</div>`;
}

/* ------------------------------------------------------------------
   Files: offer a generated file (the Wrapped image) to save or share.
   Nothing is uploaded.
   ------------------------------------------------------------------ */
function offerFile(blob, name, o) {
  const url = URL.createObjectURL(blob);
  const share = canShareFile(blob, name);
  const ov = UI.open(
    `<div class="dialog">
      ${o.image ? `<img class="offer-preview" src="${url}" alt="${esc(name)} 미리 보기">` : `<div class="dialog-icon" aria-hidden="true">${o.icon}</div>`}
      <h2>${esc(o.title)}</h2>
      <p>${esc(o.text)}</p>
      <div class="dialog-actions col">
        <a class="btn primary wide" href="${url}" download="${esc(name)}" data-offer-dl>⬇️ 내 기기에 저장</a>
        ${share ? '<button class="btn soft wide" data-offer-share>📤 공유하거나 파일에 저장</button>' : ''}
        <button class="btn ghost wide" data-ov-cancel>닫기</button>
      </div>
    </div>`,
    { cls: 'is-dialog', label: o.title, onClose: () => setTimeout(() => URL.revokeObjectURL(url), 60000) }
  );
  ov.panel.querySelector('[data-offer-dl]').addEventListener('click', () => {
    Sfx.play('coin');
    UI.toast('저장 중… 다운로드 폴더를 확인해 보세요 💗', { icon: '⬇️' });
  });
  const sh = ov.panel.querySelector('[data-offer-share]');
  if (sh) {
    sh.addEventListener('click', () =>
      shareFile(blob, name, o.title).catch(() => UI.toast('여기서는 공유할 수 없어요 — 저장을 이용해 주세요.', { icon: '📤' }))
    );
  }
  ov.panel.querySelector('[data-ov-cancel]').addEventListener('click', () => UI.close(ov));
}

/* Paint the filled part of a range input. */
function styleRange(el) {
  if (!el) return;
  const min = +el.min || 0;
  const max = +el.max || 100;
  el.style.setProperty('--val', `${(((+el.value - min) / (max - min)) * 100).toFixed(1)}%`);
}

Object.assign(Actions, {
  'close-overlay': () => UI.dismissTop(),
  'banner-close': (el) => el.closest('.banner').remove(),
  'pet-pop-close': () => $('#pet-pop').classList.remove('show'),
});
