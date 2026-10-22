'use strict';
/* ==================================================================
   🎞️ 스티커 사진기 — four pictures of the foxes in a row, as in a
   photo booth (인생네컷).

   In the foxes' world, taking pictures, she switches the camera to
   "네 컷": a viewfinder shows what goes into a picture (the 3D side
   frames the family in it — js/fox/world.js: setFinder), and the
   shutter counts down 3, 2, 1 four times, the family taking another
   pose for each. Then the four go onto a strip: she picks its frame
   (colours, check, hearts, the season's), a long strip or two by two,
   puts stickers on it (js/stickers.js) — and it is kept in the foxes'
   photo album (js/photos.js) with the day's date printed under it,
   to save or share.
   ================================================================== */

const BOOTH_SHOT = 1200; // a picture is taken this many pixels wide (4:3)
const BOOTH_CELL = { w: 540, h: 405 };
const BOOTH_LAYOUTS = {
  strip: { name: '세로 네 컷', W: 600, H: 1854, cells: [0, 1, 2, 3].map((i) => ({ x: 30, y: 30 + i * 423 })), foot: 1704 },
  grid: { name: '2×2', W: 1158, H: 978, cells: [{ x: 30, y: 30 }, { x: 588, y: 30 }, { x: 30, y: 453 }, { x: 588, y: 453 }], foot: 858 },
};
const BOOTH_FRAMES = [
  { id: 'pink', name: '핑크', bg: '#ffc2d9', ink: '#a8285f' },
  { id: 'white', name: '화이트', bg: '#ffffff', ink: '#6b5470' },
  { id: 'black', name: '블랙', bg: '#1d1a22', ink: '#ffffff' },
  { id: 'lavender', name: '라벤더', bg: '#d9ccff', ink: '#4d33a6' },
  { id: 'sky', name: '하늘', bg: '#bfe6ff', ink: '#22608f' },
  { id: 'check', name: '체크', bg: '#fff3f8', ink: '#c2336f', pattern: 'check', color: '#ffc4da' },
  { id: 'hearts', name: '하트', bg: '#ffe3ee', ink: '#c2336f', pattern: 'hearts', color: '#ff9cc2' },
  { id: 'season', name: '계절', pattern: 'emoji' }, // (its colours and pictures are the season's: BOOTH_SEASONS)
];
const BOOTH_SEASONS = {
  spring: { bg: '#ffe8f1', ink: '#b8457a', emoji: ['🌸', '🌷', '🦋'] },
  summer: { bg: '#d6f4ff', ink: '#1f6f99', emoji: ['🌊', '☀️', '🍉'] },
  autumn: { bg: '#ffe6cc', ink: '#9a4a12', emoji: ['🍁', '🍂', '🌰'] },
  winter: { bg: '#e8f1ff', ink: '#3a5a9a', emoji: ['❄️', '⛄', '🧣'] },
};

const Booth = {
  mode: 'one', //   the camera takes one picture, or four in a row ('four')
  rect: null, //    the viewfinder (px of the view)
  running: false,
  ov: null, //      the strip she is decorating
  layout: 'strip',
  frame: 'pink',

  /* ----- the camera ----- */
  /** One picture or four: the viewfinder comes or goes. */
  setMode(mode) {
    if (this.running) return;
    this.mode = mode === 'four' ? 'four' : 'one';
    this.place();
  },

  /** The viewfinder: the largest 4:3 that fits between the camera's buttons, in the middle. */
  place() {
    const panel = FoxRoom.ov && FoxRoom.ov.panel;
    if (!panel) return;
    const four = this.mode === 'four' && FoxRoom.photoOn;
    const finder = $('[data-fp-finder]', panel);
    const btn = $('[data-fp-mode]', panel);
    if (btn) {
      btn.setAttribute('aria-pressed', String(this.mode === 'four'));
      btn.classList.toggle('on', this.mode === 'four');
    }
    if (!four) {
      finder.hidden = true;
      this.rect = null;
      if (FoxHost.api) FoxHost.api.finder(null);
      return;
    }
    const stage = $('[data-fox-stage]', panel).getBoundingClientRect();
    const top = $('.fp-top', panel).getBoundingClientRect().bottom + 14;
    const bottom = $('.fp-poses', panel).getBoundingClientRect().top - 10;
    const room = { w: stage.width - 28, h: bottom - top };
    const w = Math.max(120, Math.min(room.w, (room.h * 4) / 3, 720));
    const h = (w * 3) / 4;
    const r = { x: Math.round((stage.width - w) / 2), y: Math.round(top - stage.top + (room.h - h) / 2), w: Math.round(w), h: Math.round(h) };
    this.rect = r;
    Object.assign(finder.style, { left: `${r.x}px`, top: `${r.y}px`, width: `${r.w}px`, height: `${r.h}px` });
    finder.hidden = false;
    this.dots(0);
    if (FoxHost.api) FoxHost.api.finder(r);
  },

  dots(n) {
    const el = FoxRoom.ov && $('[data-fp-dots]', FoxRoom.ov.panel);
    if (el) $$('i', el).forEach((d, i) => d.classList.toggle('on', i < n));
  },

  count(n) {
    const el = FoxRoom.ov && $('[data-fp-count]', FoxRoom.ov.panel);
    if (!el) return;
    el.textContent = n;
    el.classList.remove('go');
    if (n === '') return;
    void el.offsetWidth;
    el.classList.add('go');
  },

  /** The shutter: 3, 2, 1 — click, four times, a new pose each time; then the strip. */
  async run() {
    if (this.running || !FoxHost.api || !FoxRoom.photoOn || !this.rect) return;
    if ((await DB.keys('photos').catch(() => [])).length >= PHOTO_MAX) {
      UI.toast(`사진첩이 가득 찼어요 (${PHOTO_MAX}장). 지난 사진을 정리하면 다시 찍을 수 있어요.`, { icon: '📷', ms: 4200 });
      return;
    }
    this.running = true;
    const room = $('[data-fox-room]', FoxRoom.ov.panel);
    room.classList.add('booth-run');
    const poses = [FoxRoom.pose].concat(shuffle(PHOTO_POSES.map(([id]) => id).filter((id) => id !== FoxRoom.pose)).slice(0, 3));
    const shots = [];
    const going = () => FoxRoom.ov && FoxRoom.photoOn && this.mode === 'four';
    try {
      for (let i = 0; i < 4; i++) {
        FoxRoom.setPose(poses[i]);
        for (let n = 3; n > 0; n--) {
          if (!going()) return;
          this.count(String(n));
          Sfx.play('count');
          await sleep(900);
        }
        if (!going()) return;
        this.count('');
        const shot = FoxHost.api.capture(BOOTH_SHOT, this.rect);
        if (!shot) return;
        Sfx.play('shutter');
        Photos.flash();
        shots.push(shot);
        this.dots(shots.length);
        await sleep(650);
      }
      if (going()) this.decorate(shots);
    } finally {
      this.running = false;
      this.count('');
      room.classList.remove('booth-run');
    }
  },

  /* ----- the strip ----- */
  frameDef(id = this.frame) {
    const f = BOOTH_FRAMES.find((x) => x.id === id) || BOOTH_FRAMES[0];
    if (f.pattern !== 'emoji') return f;
    const season = BOOTH_SEASONS[Weather.seasonIn()] || BOOTH_SEASONS.spring;
    return { ...f, ...season, name: Weather.seasonDef(Weather.seasonIn()).name };
  },

  /** The four pictures on their strip, its frame, the date under them, the stickers on it — on `canvas`. */
  async compose(canvas, shots, stickers, at = new Date()) {
    const L = BOOTH_LAYOUTS[this.layout];
    const f = this.frameDef();
    await Art.fontsReady('도파민 네컷');
    canvas.width = L.W;
    canvas.height = L.H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = f.bg;
    ctx.fillRect(0, 0, L.W, L.H);
    const rnd = mulberry32(7);
    if (f.pattern === 'check') {
      ctx.fillStyle = f.color;
      ctx.globalAlpha = 0.5;
      for (let x = 0; x < L.W; x += 48) ctx.fillRect(x, 0, 24, L.H);
      for (let y = 0; y < L.H; y += 48) ctx.fillRect(0, y, L.W, 24);
      ctx.globalAlpha = 1;
    } else if (f.pattern === 'hearts') {
      ctx.fillStyle = f.color;
      for (let i = 0; i < (L.W * L.H) / 9000; i++) Art.heart(ctx, rnd() * L.W, rnd() * L.H, 18 + rnd() * 22, (rnd() - 0.5) * 0.8);
    } else if (f.pattern === 'emoji') {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < (L.W * L.H) / 14000; i++) {
        ctx.font = `${Math.round(22 + rnd() * 20)}px ${EMOJI_FONT}`;
        ctx.globalAlpha = 0.55 + rnd() * 0.45;
        ctx.fillText(f.emoji[i % f.emoji.length], rnd() * L.W, rnd() * L.H);
      }
      ctx.globalAlpha = 1;
    }
    // the pictures
    L.cells.forEach((c, i) => {
      const shot = shots[i];
      if (!shot) return;
      ctx.save();
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(c.x, c.y, BOOTH_CELL.w, BOOTH_CELL.h, 10);
      else ctx.rect(c.x, c.y, BOOTH_CELL.w, BOOTH_CELL.h);
      ctx.clip();
      ctx.drawImage(shot, c.x, c.y, BOOTH_CELL.w, BOOTH_CELL.h);
      ctx.restore();
    });
    // under them: what it is, and the day
    const date = `${at.getFullYear()}.${pad2(at.getMonth() + 1)}.${pad2(at.getDate())}`;
    ctx.fillStyle = f.ink;
    ctx.textBaseline = 'alphabetic';
    if (this.layout === 'strip') {
      ctx.textAlign = 'center';
      ctx.font = '400 46px Jua, Fredoka, sans-serif';
      ctx.fillText('🦊 도파민 네컷', L.W / 2, L.foot + 70);
      ctx.font = '600 30px Fredoka, Jua, sans-serif';
      ctx.globalAlpha = 0.8;
      ctx.fillText(date, L.W / 2, L.foot + 116);
    } else {
      ctx.textAlign = 'left';
      ctx.font = '400 46px Jua, Fredoka, sans-serif';
      ctx.fillText('🦊 도파민 네컷', 34, L.foot + 74);
      ctx.textAlign = 'right';
      ctx.font = '600 32px Fredoka, Jua, sans-serif';
      ctx.globalAlpha = 0.8;
      ctx.fillText(date, L.W - 34, L.foot + 72);
    }
    ctx.globalAlpha = 1;
    Stickers.paint(ctx, stickers, L.W, L.H);
    return canvas;
  },

  /** The decorating: frame, shape and stickers, over the strip; then it is kept. */
  decorate(shots) {
    if (this.ov) return;
    const stickers = [];
    const ov = (this.ov = UI.open(
      `<div class="diary-ed booth">
        <header class="de-head">
          <button class="btn soft small" data-bt-again>‹ 다시 찍기</button>
          <h2>🎞️ 네 컷</h2>
          <button class="btn primary small" data-bt-save>완성 ✓</button>
        </header>
        <div class="de-stage" data-bt-stage>
          <div class="de-page bt-sheet" data-bt-sheet><canvas data-bt-canvas aria-label="네 컷 사진"></canvas></div>
        </div>
        <div class="de-tools">
          <div class="seg de-tabs" role="tablist" aria-label="꾸미기">
            <button class="seg-btn" role="tab" data-bt-tab="frame">🖼️ 프레임</button>
            <button class="seg-btn" role="tab" data-bt-tab="stickers">✨ 스티커</button>
            <button class="seg-btn" role="tab" data-bt-tab="shape">📐 모양</button>
          </div>
          <div class="de-tray" data-bt-tray></div>
        </div>
      </div>`,
      {
        full: true,
        cls: 'is-booth',
        label: '네 컷 꾸미기',
        onClose: () => {
          this.ov = null;
          board.destroy();
          window.removeEventListener('resize', fit);
        },
      }
    ));
    const panel = ov.panel;
    const canvas = $('[data-bt-canvas]', panel);
    const sheet = $('[data-bt-sheet]', panel);
    const stage = $('[data-bt-stage]', panel);
    const tray = $('[data-bt-tray]', panel);
    const fit = () => {
      const L = BOOTH_LAYOUTS[this.layout];
      const r = stage.getBoundingClientRect();
      const w = Math.max(80, Math.min(r.width - 24, ((r.height - 16) * L.W) / L.H));
      sheet.style.width = `${Math.round(w)}px`;
      sheet.style.height = `${Math.round((w * L.H) / L.W)}px`;
    };
    const paint = () => this.compose(canvas, shots, []).catch((e) => console.warn('[Booth] could not draw the strip', e));
    fit();
    paint();
    window.addEventListener('resize', fit);
    const board = Stickers.board(sheet, stickers);
    let tab = 'frame';
    const show = (name) => {
      tab = name;
      $$('[data-bt-tab]', panel).forEach((b) => {
        b.classList.toggle('on', b.dataset.btTab === name);
        b.setAttribute('aria-selected', String(b.dataset.btTab === name));
      });
      if (name === 'frame') {
        tray.innerHTML = `<div class="bt-frames" role="radiogroup" aria-label="프레임">${BOOTH_FRAMES.map((f) => {
          const d = this.frameDef(f.id);
          return `<button class="bt-frame ${this.frame === f.id ? 'on' : ''}" role="radio" aria-checked="${this.frame === f.id}" data-bt-frame="${f.id}">
            <i style="background:${d.bg}" class="is-${f.pattern || 'plain'}" aria-hidden="true">${d.emoji ? d.emoji[0] : ''}</i><span>${esc(d.name)}</span></button>`;
        }).join('')}</div>`;
      } else if (name === 'stickers') {
        tray.innerHTML = `${Stickers.trayHtml()}<p class="de-hint">붙인 스티커는 끌어서 옮기고, ↻를 돌리면 크기와 방향이 바뀌어요.</p>`;
      } else {
        tray.innerHTML = `<div class="bt-shapes" role="radiogroup" aria-label="모양">${Object.entries(BOOTH_LAYOUTS)
          .map(
            ([id, L]) => `<button class="bt-shape ${this.layout === id ? 'on' : ''}" role="radio" aria-checked="${this.layout === id}" data-bt-shape="${id}">
            <i class="is-${id}" aria-hidden="true"><b></b><b></b><b></b><b></b></i><span>${esc(L.name)}</span></button>`
          )
          .join('')}</div>`;
      }
    };
    show('frame');
    Stickers.ready().then(() => {
      if (this.ov === ov && tab === 'stickers') show('stickers');
      board.render();
    });
    panel.addEventListener('click', async (e) => {
      const on = (sel) => e.target.closest(sel);
      if (on('[data-bt-tab]')) {
        Sfx.play('tap');
        return show(on('[data-bt-tab]').dataset.btTab);
      }
      if (on('[data-bt-frame]')) {
        this.frame = on('[data-bt-frame]').dataset.btFrame;
        Sfx.play('pop');
        show('frame');
        return paint();
      }
      if (on('[data-bt-shape]')) {
        this.layout = on('[data-bt-shape]').dataset.btShape;
        Sfx.play('pop');
        show('shape');
        fit();
        return paint();
      }
      if (on('[data-stk]')) return void board.add(on('[data-stk]').dataset.stk);
      if (on('[data-bt-again]')) return UI.close(ov);
      if (on('[data-bt-save]')) {
        const btn = on('[data-bt-save]');
        btn.disabled = true;
        const ok = await this.keep(shots, stickers);
        if (ok) UI.close(ov);
        else btn.disabled = false;
      }
    });
  },

  /** Into the album with it — and offered to keep elsewhere too. */
  async keep(shots, stickers) {
    try {
      const canvas = await this.compose(Art.canvas(1, 1), shots, stickers);
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92));
      if (!blob) throw new Error('the strip could not be encoded');
      const p = State.pet;
      const rec = {
        id: `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`,
        blob,
        thumb: Photos.thumbOf(canvas),
        w: canvas.width,
        h: canvas.height,
        at: Date.now(),
        scene: p.scene,
        names: p.out.map((id) => Pet.nameOf(id)),
        kind: 'four',
      };
      await DB.put('photos', rec);
      State.statistics.fourCuts = (State.statistics.fourCuts || 0) + 1;
      Diary.note('fourcut');
      Store.save();
      Photos.last = rec;
      Photos.showLast(true);
      Game.reward({ dopamine: 20, coins: 5 });
      Game.checkAchievements();
      Sfx.play('reward');
      UI.confetti({ count: 50 });
      setTimeout(
        () => offerFile(blob, `여우 네컷 ${dateKey(new Date(rec.at))}.jpg`, { icon: '🎞️', title: '네 컷 완성! 사진첩에도 넣어 뒀어요', text: '내 기기에 저장하거나 공유할 수 있어요.', image: true }),
        320
      );
      return true;
    } catch (err) {
      console.warn('[Booth] could not keep the strip', err);
      UI.toast(err && err.code === 'quota' ? '저장 공간이 가득 차서 간직하지 못했어요. 사진첩을 정리해 주세요.' : '네 컷을 간직하지 못했어요. 다시 해 볼까요?', { icon: '🎞️', ms: 3800 });
      return false;
    }
  },
};

window.addEventListener('resize', () => Booth.mode === 'four' && FoxRoom.photoOn && !Booth.running && Booth.place());

Object.assign(Actions, {
  'photo-mode': () => Booth.setMode(Booth.mode === 'four' ? 'one' : 'four'),
});
