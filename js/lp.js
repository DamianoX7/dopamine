'use strict';
/* ==================================================================
   💿 LP — an album pressed into a record, and the turntable to play it.

   The first time she opens an album as an LP it is pressed: she picks
   the colour of the vinyl (black, strawberry milk, clear, marble…),
   the press comes down, steam, the grooves are cut — and there it is,
   her album's artwork as its label (State.lp[albumId]).

   Then it goes on the turntable, on the whole screen. START drops the
   needle and the album plays through (the site's own player); the arm
   follows the music across the grooves — one band of them for every
   song, the way they show on a real record — and a tap on a band puts
   the needle down there. A finger held on the record holds it back
   (the voice sinks with it, as on a real one), the switch plays it at
   45 instead of 33⅓, and the needle crackles in the grooves.
   ================================================================== */

const LP_COLORS = [
  { id: 'black', name: '클래식 블랙', base: '#16141a', groove: '#3a3542', edge: '#000000' },
  { id: 'pink', name: '딸기 우유', base: '#ff8db6', groove: '#d9608f', edge: '#c74f7d' },
  { id: 'lavender', name: '라벤더', base: '#b49cff', groove: '#8a6fe0', edge: '#7a5fd0' },
  { id: 'mint', name: '민트', base: '#87e0c4', groove: '#4fb898', edge: '#3fa384' },
  { id: 'clear', name: '투명', base: 'rgba(255, 255, 255, 0.34)', groove: 'rgba(255, 255, 255, 0.55)', edge: 'rgba(255, 255, 255, 0.7)', clear: true },
  { id: 'marble', name: '마블', base: '#ffd6e6', groove: '#e79bbd', edge: '#d987ab', marble: ['#ffffff', '#ff9fc4', '#c8b6ff', '#ffe0a8'] },
];
const LP_SPEEDS = { 33: 1, 45: 1.35 }; // 45: the same record turning faster — and singing higher
const LP_DECK = { cx: 40, cy: 41, r: 36, px: 88, py: 14, arm: 50, rest: 92 }; // the deck in its own units (100 × 82): platter, the arm's pivot, its length, where it rests
const LP_GROOVES = [0.94, 0.4]; // the grooved part of the record, outer and inner edge (shares of its radius)

const LP = {
  ov: null,
  album: null, // the album on the turntable: { id, title, artist, artworkId, tracks: [{ id, title, duration, at }], total }
  speed: 33,
  angle: 0, //    how far round the record has turned (degrees)
  spin: 0, //     how fast it turns now, as a share of its proper speed (it spins up and down)
  arm: LP_DECK.rest, // the arm's angle (degrees), on its way to `armTo`
  lifted: true,
  held: false, // a finger is holding the record back
  holdT: 0,
  rateSent: 0,
  noise: null, // the needle's crackle: { src, gain }

  pressed(id) {
    return !!State.lp[id];
  },
  color(id) {
    return LP_COLORS.find((c) => c.id === (State.lp[id] || {}).color) || LP_COLORS[0];
  },

  /** The album, as the record player needs it — or null. */
  info(id) {
    const a = CoverHost.lib.albums.find((x) => x.id === id);
    if (!a) return null;
    let at = 0;
    const tracks = a.trackIds
      .map((tid) => CoverHost.lib.singles.find((s) => s.id === tid))
      .filter(Boolean)
      .map((s) => {
        const t = { id: s.id, title: s.title || '제목 없는 커버', duration: s.duration || 0, artworkId: s.artworkId, at };
        at += t.duration;
        return t;
      });
    return { id: a.id, title: a.title, artist: a.artist || State.user.artistName || State.user.nickname, artworkId: a.artworkId || (tracks[0] && tracks[0].artworkId) || null, tracks, total: at };
  },

  /** From the album page: press it first, if it has never been. */
  async open(id) {
    if (this.busy || this.ov) return; // (a second tap while the record is still being got ready)
    const album = this.info(id);
    if (!album) return;
    if (!album.tracks.length) {
      UI.alert({ icon: '💿', title: '앨범이 비어 있어요', text: '싱글을 하나 이상 넣으면 LP로 구울 수 있어요.' });
      return;
    }
    this.busy = true;
    try {
      if (!this.pressed(id)) {
        const color = await this.pick(album);
        if (!color) return;
        await this.press(album, color);
      }
      await this.show(album);
    } finally {
      this.busy = false;
    }
  },

  /* ----- pressing it ----- */
  /** Which vinyl: a sheet of them → the colour's id, or null if she changed her mind. */
  pick(album) {
    return new Promise((resolve) => {
      let chosen = null;
      let color = LP_COLORS[0].id;
      const ov = UI.open(
        `<div class="lp-pick">
          <div class="sheet-handle" aria-hidden="true"></div>
          <h2>💿 어떤 LP로 구울까요?</h2>
          <p class="hint">‘${esc(album.title)}’의 ${album.tracks.length}곡이 한 장의 레코드에 새겨져요. 앨범 그림은 가운데 라벨이 돼요.</p>
          <div class="lp-swatches" role="radiogroup" aria-label="LP 색">${LP_COLORS.map(
            (c, i) => `<button class="lp-swatch ${i ? '' : 'on'}" role="radio" aria-checked="${!i}" data-lp-color="${c.id}">
              <i class="lp-mini is-${c.id}" aria-hidden="true"></i><span>${esc(c.name)}</span></button>`
          ).join('')}</div>
          <button class="btn primary huge" data-lp-go>🔥 LP 굽기</button>
        </div>`,
        { cls: 'is-lp-pick', label: 'LP 색 고르기', onClose: () => resolve(chosen) }
      );
      ov.panel.addEventListener('click', (e) => {
        const sw = e.target.closest('[data-lp-color]');
        if (sw) {
          color = sw.dataset.lpColor;
          Sfx.play('pop');
          $$('[data-lp-color]', ov.panel).forEach((b) => {
            b.classList.toggle('on', b === sw);
            b.setAttribute('aria-checked', String(b === sw));
          });
        } else if (e.target.closest('[data-lp-go]')) {
          chosen = color;
          UI.close(ov);
        }
      });
    });
  },

  /** The press: heat, a squeeze, steam, the grooves cut — and the record is kept. */
  async press(album, colorId) {
    const color = LP_COLORS.find((c) => c.id === colorId) || LP_COLORS[0];
    const disc = await this.record(album, color);
    const ov = UI.open(
      `<div class="lp-press" data-lp-press>
        <p class="lp-press-title">💿 ‘${esc(album.title)}’ LP 굽는 중</p>
        <div class="lp-machine">
          <i class="lp-plate is-top" aria-hidden="true"></i>
          <div class="lp-blank" data-lp-blank style="--vinyl:${color.clear ? 'rgba(255,255,255,0.5)' : color.base}"></div>
          <div class="lp-made" data-lp-made style="--vinyl:${color.clear ? 'rgba(235,235,245,0.92)' : color.base}"></div>
          <i class="lp-plate is-bottom" aria-hidden="true"></i>
          <span class="lp-steam" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        </div>
        <p class="lp-press-step" data-lp-step aria-live="polite">비닐을 데우는 중… 🔥</p>
      </div>`,
      { full: true, locked: true, cls: 'is-lp-press', label: 'LP 굽는 중' }
    );
    const root = $('[data-lp-press]', ov.panel);
    const step = $('[data-lp-step]', root);
    const made = $('[data-lp-made]', root);
    made.appendChild(disc);
    const quick = reducedMotion();
    const wait = (ms) => sleep(quick ? Math.min(ms, 250) : ms);
    await wait(900);
    root.classList.add('is-pressing');
    step.textContent = '꾹! 누르는 중…';
    this.thump();
    await wait(700);
    root.classList.add('is-steam');
    this.hiss();
    await wait(1100);
    step.textContent = '홈을 새기는 중… 🎶';
    root.classList.add('is-open');
    await this.cut(disc, quick ? 300 : 1500);
    step.textContent = '완성!';
    root.classList.add('is-done');
    Sfx.play('reward');
    await wait(900);
    State.lp[album.id] = { color: color.id, at: Date.now() };
    State.statistics.lpPressed = (State.statistics.lpPressed || 0) + 1;
    Diary.add('lps', album.title);
    Store.save();
    UI.close(ov);
    Game.checkAchievements();
    UI.confetti({ count: 70 });
    Game.reward({ dopamine: 50, xp: 20, coins: 20 });
    UI.toast(`‘${album.title}’ LP 완성! +50 ✨ +20 🪙`, { icon: '💿', kind: 'gold', ms: 3600 });
  },

  /* The grooves are cut from the edge inwards: a ring of light runs over the record (`disc`, already drawn). */
  cut(disc, ms) {
    return new Promise((resolve) => {
      const made = disc.parentElement; // (--cut: how far in the plain vinyl over the grooves still reaches)
      const ring = document.createElement('i');
      ring.className = 'lp-cutter';
      made.appendChild(ring);
      const [o, i] = LP_GROOVES;
      const t0 = performance.now();
      const step = (t) => {
        const k = Math.min(1, (t - t0) / ms);
        made.style.setProperty('--cut', `${((o - (o - i) * k) * 100).toFixed(2)}%`);
        if (k < 1) requestAnimationFrame(step);
        else {
          ring.remove();
          made.classList.add('is-cut');
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  },

  /* ----- the record itself ----- */
  /**
   * The record, seen from above, on a canvas (1024 × 1024): vinyl of `color`, a band of grooves for every song
   * (as wide as the song is long), a smooth gap between two, the run-out, and the album's artwork as its label.
   */
  async record(album, color) {
    const S = 1024;
    const R = S / 2;
    const c = Art.canvas(S, S);
    c.className = 'lp-vinyl';
    const x = c.getContext('2d');
    const art = album.artworkId ? await this.image(album.artworkId) : null;
    await Art.fontsReady(album.title);
    x.translate(R, R);
    x.save();
    x.beginPath();
    x.arc(0, 0, R - 1, 0, Math.PI * 2);
    x.clip();
    // the vinyl
    x.fillStyle = color.base;
    x.fillRect(-R, -R, S, S);
    if (color.marble) {
      const rnd = mulberry32(hashStr(album.id));
      for (let i = 0; i < 26; i++) {
        x.globalAlpha = 0.35 + rnd() * 0.4;
        x.fillStyle = color.marble[i % color.marble.length];
        x.beginPath();
        const a = rnd() * Math.PI * 2;
        const d = rnd() * R;
        x.ellipse(Math.cos(a) * d, Math.sin(a) * d, 40 + rnd() * 140, 12 + rnd() * 40, rnd() * Math.PI, 0, Math.PI * 2);
        x.fill();
      }
      x.globalAlpha = 1;
    }
    // the grooves: fine rings, a little different each
    const [outer, inner] = LP_GROOVES.map((k) => k * R);
    const rnd = mulberry32(7);
    x.lineWidth = 1.1;
    for (let r = outer; r > inner; r -= 1.7) {
      x.globalAlpha = 0.18 + rnd() * 0.32;
      x.strokeStyle = color.groove;
      x.beginPath();
      x.arc(0, 0, r, 0, Math.PI * 2);
      x.stroke();
    }
    x.globalAlpha = 1;
    // the gaps between the songs: smooth, and they catch the light
    const total = album.total || 1;
    album.tracks.slice(1).forEach((t) => {
      const r = outer - ((outer - inner) * t.at) / total;
      x.lineWidth = 5;
      x.strokeStyle = color.base;
      x.beginPath();
      x.arc(0, 0, r, 0, Math.PI * 2);
      x.stroke();
      x.lineWidth = 1.5;
      x.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      x.beginPath();
      x.arc(0, 0, r - 1, 0, Math.PI * 2);
      x.stroke();
    });
    // the lead-in at the edge, the run-out by the label
    x.lineWidth = 1;
    x.strokeStyle = color.groove;
    for (const r of [0.965 * R, 0.975 * R, 0.988 * R]) {
      x.globalAlpha = 0.5;
      x.beginPath();
      x.arc(0, 0, r, 0, Math.PI * 2);
      x.stroke();
    }
    x.globalAlpha = 0.45;
    x.beginPath();
    for (let a = 0; a < Math.PI * 6; a += 0.05) {
      const r = inner - 4 - a * 2.2;
      x.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    x.stroke();
    x.globalAlpha = 1;
    x.restore();
    // the edge
    x.lineWidth = 6;
    x.strokeStyle = color.edge;
    x.beginPath();
    x.arc(0, 0, R - 4, 0, Math.PI * 2);
    x.stroke();
    // the label: her artwork
    const L = 0.33 * R;
    x.save();
    x.beginPath();
    x.arc(0, 0, L, 0, Math.PI * 2);
    x.clip();
    if (art) {
      const side = Math.min(art.width, art.height);
      x.drawImage(art, (art.width - side) / 2, (art.height - side) / 2, side, side, -L, -L, L * 2, L * 2);
    } else {
      const g = x.createLinearGradient(-L, -L, L, L);
      g.addColorStop(0, '#ffb3d1');
      g.addColorStop(1, '#c9b3fb');
      x.fillStyle = g;
      x.fillRect(-L, -L, L * 2, L * 2);
      x.font = `${Math.round(L * 0.7)}px ${EMOJI_FONT}`;
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText('💿', 0, -L * 0.1);
    }
    const shade = x.createRadialGradient(0, 0, L * 0.6, 0, 0, L);
    shade.addColorStop(0, 'rgba(0, 0, 0, 0)');
    shade.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
    x.fillStyle = shade;
    x.fillRect(-L, -L, L * 2, L * 2);
    x.restore();
    x.lineWidth = 3;
    x.strokeStyle = 'rgba(0, 0, 0, 0.25)';
    x.beginPath();
    x.arc(0, 0, L, 0, Math.PI * 2);
    x.stroke();
    // …and what is printed round it
    x.fillStyle = 'rgba(255, 255, 255, 0.95)';
    x.strokeStyle = 'rgba(0, 0, 0, 0.35)';
    x.lineWidth = 4;
    x.font = '600 26px Fredoka, Jua, sans-serif';
    x.textAlign = 'center';
    x.strokeText('33⅓ RPM', 0, L * 0.82);
    x.fillText('33⅓ RPM', 0, L * 0.82);
    // the hole for the spindle
    x.fillStyle = '#1a1820';
    x.beginPath();
    x.arc(0, 0, 0.024 * R, 0, Math.PI * 2);
    x.fill();
    return c;
  },

  image(id) {
    return CoverHost.api
      ? CoverHost.api.artUrl(id).then(
          (url) =>
            url &&
            new Promise((resolve) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = () => resolve(null);
              img.src = url;
            })
        )
      : Promise.resolve(null);
  },

  /* ----- the turntable ----- */
  async show(album) {
    if (this.ov) return;
    this.album = album;
    const color = this.color(album.id);
    const disc = await this.record(album, color);
    const sides = this.sides(album);
    const ov = (this.ov = UI.open(
      `<div class="lp" data-lp>
        <header class="lp-head">
          <button class="icon-btn" data-action="close-overlay" aria-label="닫기">‹</button>
          <h2>💿 LP</h2>
          <button class="btn soft small" data-lp-repress>색 바꾸기</button>
        </header>
        <div class="lp-sleeve">
          <div class="lp-cover">${album.artworkId ? '<img data-lp-art alt="">' : '<span aria-hidden="true">💿</span>'}<i class="lp-peek" style="--vinyl:${color.clear ? 'rgba(255,255,255,0.6)' : color.base}" aria-hidden="true"></i></div>
          <div class="lp-info"><b>${esc(album.title)}</b><small>${esc(album.artist)}</small><small>${album.tracks.length}곡 · ${fmtTime(album.total)} · ${esc(color.name)} LP</small></div>
        </div>
        <div class="lp-scene">
          <div class="lp-deck" data-lp-deck>
            <div class="lp-platter" data-lp-platter>
              <div class="lp-disc" data-lp-disc></div>
              <i class="lp-sheen" aria-hidden="true"></i>
              <i class="lp-spindle" aria-hidden="true"></i>
            </div>
            <svg class="lp-arm" viewBox="0 0 100 82" aria-hidden="true">
              <defs>
                <linearGradient id="lpMetal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.5" stop-color="#c9c9d6"/><stop offset="1" stop-color="#8d8da0"/></linearGradient>
              </defs>
              <circle cx="${LP_DECK.px}" cy="${LP_DECK.py}" r="6.2" fill="url(#lpMetal)" stroke="#7d7d90" stroke-width="0.5"/>
              <circle cx="${LP_DECK.px}" cy="${LP_DECK.py}" r="3.3" fill="#4a4658"/>
              <rect x="${LP_DECK.px - 3}" y="62" width="6" height="4" rx="1.5" fill="#4a4658"/>
              <g data-lp-arm>
                <g class="lp-arm-shadow"><line x1="${LP_DECK.px}" y1="${LP_DECK.py}" x2="${LP_DECK.px + LP_DECK.arm - 4}" y2="${LP_DECK.py}" stroke="rgba(0,0,0,0.25)" stroke-width="2.4" stroke-linecap="round"/></g>
                <g class="lp-arm-body">
                  <rect x="${LP_DECK.px - 13}" y="${LP_DECK.py - 3.2}" width="8" height="6.4" rx="2" fill="#3d3a48"/>
                  <line x1="${LP_DECK.px - 5}" y1="${LP_DECK.py}" x2="${LP_DECK.px + LP_DECK.arm - 6}" y2="${LP_DECK.py}" stroke="url(#lpMetal)" stroke-width="1.7" stroke-linecap="round"/>
                  <g transform="rotate(22 ${LP_DECK.px + LP_DECK.arm - 6} ${LP_DECK.py})">
                    <rect x="${LP_DECK.px + LP_DECK.arm - 7}" y="${LP_DECK.py - 2.4}" width="9" height="4.8" rx="1" fill="#2a2733"/>
                    <rect x="${LP_DECK.px + LP_DECK.arm - 6}" y="${LP_DECK.py - 1.2}" width="3" height="2.4" fill="#ff5fa2"/>
                  </g>
                </g>
              </g>
            </svg>
            <button class="lp-start" data-lp-start aria-label="재생 또는 멈춤"><span data-lp-start-label>START</span></button>
            <div class="lp-speed" role="radiogroup" aria-label="회전 속도">
              <button role="radio" data-lp-speed="33" aria-checked="true">33</button><button role="radio" data-lp-speed="45" aria-checked="false">45</button>
            </div>
            <i class="lp-light" aria-hidden="true"></i>
          </div>
        </div>
        <p class="lp-tip">줄무늬를 누르면 그 자리에 바늘이 내려가요 · 판을 꾹 누르고 있으면 멈칫해요</p>
        <ol class="lp-tracks">${sides
          .map(
            (t) => `<li><button class="lp-track" data-lp-track="${esc(t.id)}"><span class="lp-side">${t.side}</span><span class="lp-t">${esc(t.title)}</span><span class="lp-len">${fmtTime(t.duration)}</span></button></li>`
          )
          .join('')}</ol>
      </div>`,
      {
        full: true,
        cls: 'is-lp',
        label: `${album.title} LP`,
        onClose: () => this.closed(),
      }
    ));
    const panel = ov.panel;
    $('[data-lp-disc]', panel).appendChild(disc);
    const img = $('[data-lp-art]', panel);
    if (img) CoverHost.api.artUrl(album.artworkId).then((url) => url && (img.src = url));
    this.speed = 33;
    this.held = false;
    this.rateSent = 0;
    this.rateFor = null;
    const p = CoverHost.player();
    const playing = p.playing && this.trackOf(p.singleId);
    this.lifted = !playing;
    this.arm = playing ? this.armFor(this.position(p)) : LP_DECK.rest;
    this.spin = playing ? 1 : 0;
    this.wire(panel);
    this.loop = Loop.add(() => this.frame());
    this.place();
  },

  /* Its songs, side A and side B: A1, A2… B1… */
  sides(album) {
    const n = album.tracks.length;
    const half = Math.ceil(n / 2);
    return album.tracks.map((t, i) => ({ ...t, side: n > 1 ? `${i < half ? 'A' : 'B'}${i < half ? i + 1 : i - half + 1}` : 'A1' }));
  },

  trackOf(id) {
    return this.album && this.album.tracks.find((t) => t.id === id);
  },

  /** Where in the album the music is (seconds from the start of side A). */
  position(p = CoverHost.player()) {
    const t = this.trackOf(p.singleId);
    return t ? t.at + (p.singleId ? CoverHost.clock() || p.time : 0) : 0;
  },

  /** The arm's angle that puts the needle at `sec` seconds into the album. */
  armFor(sec) {
    const [o, i] = LP_GROOVES;
    const k = clamp(sec / (this.album.total || 1), 0, 1);
    return this.angleAt((o - (o - i) * k) * LP_DECK.r);
  },

  /* The arm's angle (degrees) for the needle to be `rho` (deck units) from the middle of the record. */
  angleAt(rho) {
    const D = LP_DECK;
    const dx = D.cx - D.px;
    const dy = D.cy - D.py;
    const d = Math.hypot(dx, dy);
    const phi = Math.atan2(dy, dx);
    const c = clamp((D.arm * D.arm + d * d - rho * rho) / (2 * D.arm * d), -1, 1);
    return ((phi - Math.acos(c)) * 180) / Math.PI;
  },

  wire(panel) {
    const platter = $('[data-lp-platter]', panel);
    let down = null; // { t, x, y }: a finger on the record
    platter.addEventListener('pointerdown', (e) => {
      down = { t: performance.now(), x: e.clientX, y: e.clientY };
      try {
        platter.setPointerCapture(e.pointerId);
      } catch (err) {
        /* ignore */
      }
      clearTimeout(this.holdT);
      this.holdT = setTimeout(() => {
        if (down && CoverHost.player().playing) {
          this.held = true;
          platter.classList.add('is-held');
        }
      }, 230);
    });
    const up = (e) => {
      clearTimeout(this.holdT);
      if (!down) return;
      const tap = !this.held && performance.now() - down.t < 400 && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 14;
      down = null;
      if (this.held) {
        this.held = false;
        platter.classList.remove('is-held');
      }
      if (tap) this.dropAt(e.clientX, e.clientY, platter);
    };
    platter.addEventListener('pointerup', up);
    platter.addEventListener('pointercancel', up);
    panel.addEventListener('click', (e) => {
      const on = (sel) => e.target.closest(sel);
      if (on('[data-lp-start]')) this.toggle();
      else if (on('[data-lp-speed]')) this.setSpeed(+on('[data-lp-speed]').dataset.lpSpeed);
      else if (on('[data-lp-track]')) this.needle(on('[data-lp-track]').dataset.lpTrack, 0);
      else if (on('[data-lp-repress]')) this.repress();
    });
  },

  /* A tap on the grooves: where on the record was that — and which song, how far into it? */
  dropAt(x, y, platter) {
    const r = platter.getBoundingClientRect();
    const k = Math.hypot((x - (r.left + r.width / 2)) / (r.width / 2), (y - (r.top + r.height / 2)) / (r.height / 2));
    const [o, i] = LP_GROOVES;
    if (k > o + 0.03 || k < i - 0.03) return; // the label, or off the record
    const sec = clamp((o - k) / (o - i), 0, 1) * this.album.total;
    const t = this.album.tracks.filter((tr) => tr.at <= sec + 0.01).pop() || this.album.tracks[0];
    this.needle(t.id, Math.max(0, sec - t.at));
  },

  /** Put the needle on song `id`, `at` seconds into it: the arm swings over, comes down, and it plays. */
  async needle(id, at = 0) {
    const t = this.trackOf(id);
    if (!t) return;
    const ids = this.album.tracks.map((x) => x.id);
    this.lifted = true;
    this.armTo = this.armFor(t.at + at);
    await sleep(420);
    if (!this.ov) return;
    CoverHost.start(id, ids.slice(ids.indexOf(id)));
    if (at > 0.5) {
      // (once that song is in the player — not the one before it, which may still be)
      let tries = 0;
      const go = () => {
        const p = CoverHost.player();
        if (p.singleId === id && !p.loading) CoverHost.api.seek(at);
        else if (++tries < 40) setTimeout(go, 50);
      };
      go();
    }
    this.drop();
  },

  drop() {
    this.lifted = false;
    this.thump(0.5);
    State.statistics.lpPlays = (State.statistics.lpPlays || 0) + 1;
    Diary.note('lp');
    Store.save();
  },

  /** The player: a song has played to its end. After the record's last one the arm goes back to its rest (and the record stops). */
  ended(id) {
    if (!this.ov || !this.trackOf(id)) return;
    const p = CoverHost.player();
    if (p.singleId !== id || p.playing) return; // (it went on to the next song)
    this.lifted = true;
    this.armTo = LP_DECK.rest;
  },

  /* START / STOP: the needle goes down where it was (or at the start), or the music stops and the arm goes back to its rest. */
  toggle() {
    const p = CoverHost.player();
    const mine = this.trackOf(p.singleId);
    if (mine && p.playing) {
      CoverHost.play(p.singleId); // (pauses it)
      this.lifted = true;
      this.armTo = LP_DECK.rest;
      return;
    }
    if (mine && p.time > 0.2) {
      this.lifted = true;
      this.armTo = this.armFor(this.position(p));
      setTimeout(() => {
        if (!this.ov) return;
        CoverHost.play(p.singleId);
        this.drop();
      }, 420);
      return;
    }
    this.needle(this.album.tracks[0].id, 0);
  },

  setSpeed(rpm) {
    this.speed = LP_SPEEDS[rpm] ? rpm : 33;
    Sfx.play('tap');
    $$('[data-lp-speed]', this.ov.panel).forEach((b) => b.setAttribute('aria-checked', String(+b.dataset.lpSpeed === this.speed)));
    if (this.speed === 45) UI.toast('45 RPM! 목소리가 귀여워져요 🐿️', { icon: '💿' });
  },

  async repress() {
    const color = await this.pick(this.album);
    if (!color || !this.ov) return;
    State.lp[this.album.id].color = color;
    Store.save();
    const disc = await this.record(this.album, this.color(this.album.id));
    const host = this.ov && $('[data-lp-disc]', this.ov.panel);
    if (!host) return;
    host.replaceChildren(disc);
    const c = this.color(this.album.id);
    $('.lp-peek', this.ov.panel).style.setProperty('--vinyl', c.clear ? 'rgba(255,255,255,0.6)' : c.base);
    $('.lp-info small:last-child', this.ov.panel).textContent = `${this.album.tracks.length}곡 · ${fmtTime(this.album.total)} · ${c.name} LP`;
    Sfx.play('reward');
  },

  /* Every frame: the record turns (and is slowed by a finger), the arm follows the music, the voice follows the record. */
  frame() {
    if (!this.ov) return;
    const now = performance.now();
    const dt = Math.min(0.05, (now - (this.t0 || now)) / 1000);
    this.t0 = now;
    const p = CoverHost.player();
    const mine = !!this.trackOf(p.singleId);
    const playing = mine && p.playing;
    const motor = playing || (!this.lifted && mine);
    const want = !motor ? 0 : this.held ? 0.18 : 1;
    this.spin += (want - this.spin) * Math.min(1, dt * (this.held ? 5 : want ? 2.6 : 1.4));
    const speed = LP_SPEEDS[this.speed];
    this.angle = (this.angle + dt * 200 * speed * this.spin) % 360; // 33⅓ turns a minute = 200° a second
    if (playing && !this.lifted) this.armTo = this.armFor(this.position(p));
    if (this.armTo == null) this.armTo = this.arm;
    this.arm += (this.armTo - this.arm) * Math.min(1, dt * (this.lifted ? 4 : 12));
    if (mine && p.playing) {
      const rate = (this.held ? Math.max(0.25, this.spin) : 1) * speed;
      // (a new song starts at its own speed: tell it again)
      if (Math.abs(rate - this.rateSent) > 0.02 || p.singleId !== this.rateFor) {
        this.rateSent = rate;
        this.rateFor = p.singleId;
        CoverHost.api.rate(rate, false);
      }
    }
    this.crackle(playing && !this.lifted);
    this.place();
    this.paintLabels(p, mine);
  },

  place() {
    if (!this.ov) return;
    const panel = this.ov.panel;
    const disc = $('.lp-vinyl', panel);
    if (disc) disc.style.transform = `rotate(${this.angle.toFixed(2)}deg)`;
    const arm = $('[data-lp-arm]', panel);
    if (arm) {
      arm.setAttribute('transform', `rotate(${this.arm.toFixed(2)} ${LP_DECK.px} ${LP_DECK.py})`);
      arm.classList.toggle('is-up', this.lifted);
    }
  },

  /* START or STOP, the light, and which song is on. */
  paintLabels(p, mine) {
    const panel = this.ov.panel;
    const on = mine && p.playing;
    const key = `${on}|${p.singleId}`;
    if (key === this.lastKey) return;
    this.lastKey = key;
    $('[data-lp-start-label]', panel).textContent = on ? 'STOP' : 'START';
    $('.lp-light', panel).classList.toggle('on', on);
    $$('[data-lp-track]', panel).forEach((b) => b.classList.toggle('on', b.dataset.lpTrack === p.singleId));
  },

  /* ----- sounds ----- */
  /* The needle in the grooves: a soft hiss with a pop now and then (only while it plays, and only with sound on). */
  crackle(on) {
    on = on && State.settings.soundEnabled && !document.hidden;
    const ctx = on || this.noise ? AudioSys.get() : null;
    if (on && !this.noise && ctx) {
      try {
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          d[i] = (Math.random() * 2 - 1) * 0.08;
          if (Math.random() < 0.0004) d[i] = (Math.random() < 0.5 ? -1 : 1) * (0.5 + Math.random() * 0.5);
        }
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;
        const band = ctx.createBiquadFilter();
        band.type = 'bandpass';
        band.frequency.value = 2400;
        band.Q.value = 0.7;
        const gain = ctx.createGain();
        gain.gain.value = 0;
        src.connect(band).connect(gain).connect(ctx.destination);
        src.start();
        this.noise = { src, gain };
      } catch (e) {
        this.noise = null;
      }
    }
    if (this.noise && ctx) {
      const g = this.noise.gain.gain;
      g.setTargetAtTime(on ? 0.05 : 0, ctx.currentTime, 0.15);
    }
  },

  stopNoise() {
    if (!this.noise) return;
    try {
      this.noise.src.stop();
      this.noise.src.disconnect();
    } catch (e) {
      /* ignore */
    }
    this.noise = null;
  },

  /* The needle coming down, the press closing: a soft low knock. */
  thump(vol = 1) {
    if (!State.settings.soundEnabled) return;
    const ctx = AudioSys.resume();
    if (!ctx) return;
    try {
      const out = ctx.createGain();
      out.gain.value = 0.22 * vol;
      out.connect(ctx.destination);
      Sfx.tone(ctx, out, ctx.currentTime + 0.01, 120, 0.22, { vol: 0.8, glide: 60 });
      setTimeout(() => out.disconnect(), 800);
    } catch (e) {
      /* sound is optional */
    }
  },

  /* Steam out of the press. */
  hiss() {
    if (!State.settings.soundEnabled) return;
    const ctx = AudioSys.resume();
    if (!ctx) return;
    try {
      const len = Math.round(ctx.sampleRate * 0.9);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass';
      hp.frequency.value = 3000;
      const g = ctx.createGain();
      g.gain.value = 0.06;
      src.connect(hp).connect(g).connect(ctx.destination);
      src.start();
    } catch (e) {
      /* sound is optional */
    }
  },

  closed() {
    if (this.loop) this.loop();
    this.loop = null;
    this.ov = null;
    this.album = null;
    this.armTo = null;
    this.t0 = 0;
    this.lastKey = '';
    this.stopNoise();
    if (CoverHost.api) CoverHost.api.rate(1, true); // (whatever plays on, plays as it was recorded)
  },
};
