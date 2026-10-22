'use strict';
/* ==================================================================
   ✨ Stickers — for decorating things she keeps: the pages of her
   diary (js/diary.js) and the strips of the photo booth.

   A sticker on something is { k, x, y, s, r }: which one (STICKERS),
   where its middle is (0…1 across and down the thing), how wide it is
   (a share of the thing's width) and how far it is turned (degrees).

   Each one is drawn once, on a little canvas of its own (Stickers.
   sprite) — a die-cut emoji with its white edge, a label, a strip of
   washi tape — and that same picture is what shows on the screen and
   what goes into the pictures she saves (Stickers.paint).
   Stickers.board() lets her put them on, move them about, turn them,
   make them bigger or smaller, and peel them off again.
   ================================================================== */

const EMOJI_FONT = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

const STICKERS = [
  ...['💗', '💕', '✨', '⭐', '🌙', '☀️', '🌈', '☁️', '🌸', '🍀', '🎀', '🍓', '🍰', '☕', '🍦', '🎂', '🎤', '🎧', '🎵', '🦊', '🐾', '💌', '📷', '🎮', '👑', '💯', '🔥', '🥳'].map((e) => ({
    id: e,
    kind: 'emoji',
    e,
  })),
  { id: 'l-best', kind: 'label', text: '최고의 하루', bg: '#ff8fb8', ink: '#ffffff' },
  { id: 'l-happy', kind: 'label', text: '행복해', bg: '#ffd166', ink: '#7a4b00' },
  { id: 'l-yum', kind: 'label', text: '냠냠', bg: '#9be7c4', ink: '#145c43' },
  { id: 'l-sleep', kind: 'label', text: '꿀잠', bg: '#b9a6ff', ink: '#ffffff' },
  { id: 'l-love', kind: 'label', text: 'LOVE', bg: '#ff5f8f', ink: '#ffffff' },
  { id: 'l-lucky', kind: 'label', text: '럭키 데이', bg: '#8fd3ff', ink: '#0d4a6b' },
  { id: 'l-cute', kind: 'label', text: '오늘도 귀여움', bg: '#ffb4a2', ink: '#7a2e1d' },
  { id: 't-pink', kind: 'tape', color: '#ffb3cf', pattern: 'stripes' },
  { id: 't-mint', kind: 'tape', color: '#a8ecd2', pattern: 'dots' },
  { id: 't-lav', kind: 'tape', color: '#cdbdff', pattern: 'check' },
  { id: 't-sun', kind: 'tape', color: '#ffe08a', pattern: 'plain' },
];
const STICKER_SIZE = { emoji: 0.17, label: 0.34, tape: 0.36 }; // how wide a new one is, as a share of the thing
const STICKER_MAX = 30; // on one thing

const Stickers = {
  sprites: {}, // id → { canvas, url, aspect }

  def(id) {
    return STICKERS.find((d) => d.id === id) || null;
  },

  /** The sticker as a picture of its own: its white edge and its shadow included. Width / height = `aspect`. */
  sprite(id) {
    if (this.sprites[id]) return this.sprites[id];
    const def = this.def(id);
    if (!def) return null;
    const canvas = def.kind === 'label' ? this.label(def) : def.kind === 'tape' ? this.tape(def) : this.emoji(def);
    const sp = { canvas, aspect: canvas.width / canvas.height, url: '' };
    if (def.kind !== 'label' || this.fontOk) this.sprites[id] = sp; // (a label drawn before its font came is drawn again)
    return sp;
  },

  url(id) {
    const sp = this.sprite(id);
    if (!sp) return BLANK_IMG;
    return sp.url || (sp.url = sp.canvas.toDataURL('image/png'));
  },

  /* A die-cut emoji: drawn, its outline grown into a white edge, a soft shadow under it. */
  emoji(def) {
    const S = 300;
    const pad = 34;
    const glyph = Art.canvas(S, S);
    const g = glyph.getContext('2d');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `${S - pad * 2 - 16}px ${EMOJI_FONT}`;
    g.fillText(def.e, S / 2, S / 2 + 8);
    const edge = Art.canvas(S, S);
    const e = edge.getContext('2d');
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      e.drawImage(glyph, Math.cos(a) * 15, Math.sin(a) * 15);
    }
    e.globalCompositeOperation = 'source-in';
    e.fillStyle = '#ffffff';
    e.fillRect(0, 0, S, S);
    const out = Art.canvas(S, S);
    const o = out.getContext('2d');
    o.shadowColor = 'rgba(90, 40, 80, 0.32)';
    o.shadowBlur = 16;
    o.shadowOffsetY = 6;
    o.drawImage(edge, 0, 0);
    o.shadowColor = 'transparent';
    o.drawImage(glyph, 0, 0);
    return out;
  },

  /* A word on a round-cornered label with a white edge. */
  label(def) {
    const fs = 76;
    const font = `700 ${fs}px Gaegu, Jua, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
    this.fontOk = !document.fonts || document.fonts.check(font, def.text);
    const m = Art.canvas(10, 10).getContext('2d');
    m.font = font;
    const tw = Art.handW(m, def.text);
    const h = fs * 1.42;
    const w = tw + fs * 1.1;
    const pad = 22;
    const out = Art.canvas(Math.ceil(w + pad * 2), Math.ceil(h + pad * 2));
    const c = out.getContext('2d');
    const r = h / 2;
    const path = () => {
      c.beginPath();
      if (c.roundRect) c.roundRect(pad, pad, w, h, r);
      else c.rect(pad, pad, w, h);
    };
    c.shadowColor = 'rgba(90, 40, 80, 0.3)';
    c.shadowBlur = 14;
    c.shadowOffsetY = 5;
    path();
    c.fillStyle = '#ffffff';
    c.fill();
    c.shadowColor = 'transparent';
    c.lineWidth = 0;
    c.beginPath();
    if (c.roundRect) c.roundRect(pad + 8, pad + 8, w - 16, h - 16, r - 8);
    else c.rect(pad + 8, pad + 8, w - 16, h - 16);
    c.fillStyle = def.bg;
    c.fill();
    c.font = font;
    c.textBaseline = 'middle';
    c.fillStyle = def.ink;
    Art.hand(c, def.text, pad + w / 2, pad + h / 2 + 4, 'center');
    return out;
  },

  /* A strip of washi tape: see-through, a pattern on it, its ends torn. */
  tape(def) {
    const W = 420;
    const H = 128;
    const out = Art.canvas(W, H);
    const c = out.getContext('2d');
    const tooth = 9;
    c.beginPath();
    c.moveTo(tooth, 0);
    c.lineTo(W - tooth, 0);
    for (let y = 0; y <= H; y += 16) c.lineTo(W - (y % 32 ? 0 : tooth), y);
    c.lineTo(W - tooth, H);
    c.lineTo(tooth, H);
    for (let y = H; y >= 0; y -= 16) c.lineTo(y % 32 ? 0 : tooth, y);
    c.closePath();
    c.save();
    c.clip();
    c.globalAlpha = 0.82;
    c.fillStyle = def.color;
    c.fillRect(0, 0, W, H);
    c.globalAlpha = 0.45;
    c.fillStyle = '#ffffff';
    c.strokeStyle = '#ffffff';
    if (def.pattern === 'stripes') {
      c.lineWidth = 12;
      for (let x = -H; x < W + H; x += 34) {
        c.beginPath();
        c.moveTo(x, H);
        c.lineTo(x + H, 0);
        c.stroke();
      }
    } else if (def.pattern === 'dots') {
      for (let y = 18; y < H; y += 32) {
        for (let x = 18 + ((y / 32) % 2) * 16; x < W; x += 32) {
          c.beginPath();
          c.arc(x, y, 6, 0, Math.PI * 2);
          c.fill();
        }
      }
    } else if (def.pattern === 'check') {
      for (let x = 0; x < W; x += 40) c.fillRect(x, 0, 18, H);
      for (let y = 0; y < H; y += 40) c.fillRect(0, y, W, 18);
    }
    c.restore();
    return out;
  },

  /** A new sticker for the middle of something, a little askew. */
  make(id, x = 0.5, y = 0.5) {
    const def = this.def(id);
    return { k: id, x, y, s: STICKER_SIZE[def ? def.kind : 'emoji'], r: Math.round((Math.random() - 0.5) * 24) };
  },

  /** Draw the stickers on a canvas that shows the thing they are on, `W` × `H` (in the canvas's own units). */
  paint(ctx, list, W, H) {
    (list || []).forEach((s) => {
      const sp = this.sprite(s.k);
      if (!sp) return;
      const w = s.s * W;
      const h = w / sp.aspect;
      ctx.save();
      ctx.translate(s.x * W, s.y * H);
      ctx.rotate((s.r * Math.PI) / 180);
      ctx.drawImage(sp.canvas, -w / 2, -h / 2, w, h);
      ctx.restore();
    });
  },

  /** The stickers a tray offers, a row of emoji and one of labels and tape: buttons with `data-stk="<id>"`. */
  trayHtml() {
    const pick = (d) =>
      `<button class="stk-pick is-${d.kind}" data-stk="${esc(d.id)}" aria-label="${esc(d.kind === 'emoji' ? d.e : d.kind === 'label' ? d.text : '마스킹 테이프')} 스티커 붙이기"><img src="${this.url(d.id)}" alt="" draggable="false"></button>`;
    return `<div class="stk-tray">
      <div class="stk-row">${STICKERS.filter((d) => d.kind === 'emoji').map(pick).join('')}</div>
      <div class="stk-row is-wide">${STICKERS.filter((d) => d.kind !== 'emoji').map(pick).join('')}</div>
    </div>`;
  },

  /* Labels are drawn with the handwriting font: once it has come, draw them again. */
  async ready() {
    if (!document.fonts || !document.fonts.load) return;
    await Promise.race([document.fonts.load('700 76px Gaegu', '최고의하루행복해냠냠꿀잠럭키데이오늘도귀여움LOVE'), sleep(2500)]).catch(() => {});
    STICKERS.filter((d) => d.kind === 'label').forEach((d) => delete this.sprites[d.id]);
    this.fontOk = true;
  },

  /**
   * Stickers to put on `host` (an element the size of the thing): `list` is changed in place.
   * Drag one to move it, the ↻ handle (or two fingers) to turn it and size it, ✕ to peel it off;
   * a tap beside them puts the handles away. → { add(id), render(), select(i), destroy() }
   */
  board(host, list, { onChange = () => {}, max = STICKER_MAX } = {}) {
    const layer = document.createElement('div');
    layer.className = 'stk-layer';
    host.appendChild(layer);
    let sel = -1;
    const pts = new Map(); // the fingers (pointers) on it: id → { x, y }
    let grip = null; //        what they are doing: { kind: 'move' | 'turn' | 'pinch', i, … }

    const box = () => host.getBoundingClientRect();
    const render = () => {
      layer.innerHTML = list
        .map((s, i) => {
          const sp = this.sprite(s.k);
          if (!sp) return '';
          return `<div class="stk ${i === sel ? 'on' : ''}" data-i="${i}" style="left:${(s.x * 100).toFixed(2)}%;top:${(s.y * 100).toFixed(2)}%;width:${(s.s * 100).toFixed(2)}%;aspect-ratio:${sp.aspect.toFixed(3)};transform:translate(-50%,-50%) rotate(${s.r}deg)">
            <img src="${this.url(s.k)}" alt="" draggable="false">
            ${i === sel ? '<button class="stk-x" data-stk-x aria-label="스티커 떼기">✕</button><span class="stk-turn" data-stk-turn aria-hidden="true">↻</span>' : ''}
          </div>`;
        })
        .join('');
    };
    const place = (i) => {
      const el = layer.querySelector(`[data-i="${i}"]`);
      const s = list[i];
      if (!el || !s) return;
      el.style.left = `${(s.x * 100).toFixed(2)}%`;
      el.style.top = `${(s.y * 100).toFixed(2)}%`;
      el.style.width = `${(s.s * 100).toFixed(2)}%`;
      el.style.transform = `translate(-50%,-50%) rotate(${s.r.toFixed(1)}deg)`;
    };
    const select = (i) => {
      sel = i;
      render();
    };
    const centre = (i) => {
      const b = box();
      return { x: b.left + list[i].x * b.width, y: b.top + list[i].y * b.height };
    };
    const twoFingers = () => {
      const [a, b] = Array.from(pts.values());
      return { d: Math.hypot(b.x - a.x, b.y - a.y), a: Math.atan2(b.y - a.y, b.x - a.x) };
    };

    // (only a finger that has got hold of a sticker is kept to the board: a tap beside them goes to whatever is under it)
    const hold = (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try {
        host.setPointerCapture(e.pointerId);
      } catch (err) {
        /* (a pointer the browser no longer knows) */
      }
      e.preventDefault();
    };
    const down = (e) => {
      const x = e.target.closest('[data-stk-x]');
      const st = e.target.closest('.stk');
      if (x && st) {
        e.preventDefault();
        list.splice(+st.dataset.i, 1);
        sel = -1;
        grip = null;
        Sfx.play('flip');
        render();
        onChange();
        return;
      }
      if (grip && pts.size === 1 && sel >= 0) {
        // a second finger: the two of them turn the sticker that is held, and size it
        hold(e);
        const f = twoFingers();
        grip = { kind: 'pinch', i: sel, d0: f.d, a0: f.a, s0: list[sel].s, r0: list[sel].r, moved: true };
        return;
      }
      if (pts.size) return;
      if (e.target.closest('[data-stk-turn]') && sel >= 0) {
        hold(e);
        const c = centre(sel);
        grip = { kind: 'turn', i: sel, c, d0: Math.hypot(e.clientX - c.x, e.clientY - c.y) || 1, a0: Math.atan2(e.clientY - c.y, e.clientX - c.x), s0: list[sel].s, r0: list[sel].r };
        return;
      }
      if (st) {
        hold(e);
        const i = +st.dataset.i;
        if (i !== sel) select(i);
        grip = { kind: 'move', i, x0: e.clientX, y0: e.clientY, sx: list[i].x, sy: list[i].y, moved: false };
        return;
      }
      grip = null;
      if (sel >= 0) select(-1);
    };
    const move = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (!grip) return;
      const s = list[grip.i];
      if (!s) return;
      if (grip.kind === 'move') {
        const b = box();
        s.x = clamp(grip.sx + (e.clientX - grip.x0) / b.width, 0, 1);
        s.y = clamp(grip.sy + (e.clientY - grip.y0) / b.height, 0, 1);
        grip.moved = true;
      } else if (grip.kind === 'turn') {
        const c = grip.c;
        const d = Math.hypot(e.clientX - c.x, e.clientY - c.y);
        s.s = clamp((grip.s0 * d) / grip.d0, 0.05, 0.9);
        s.r = grip.r0 + ((Math.atan2(e.clientY - c.y, e.clientX - c.x) - grip.a0) * 180) / Math.PI;
      } else if (grip.kind === 'pinch' && pts.size >= 2) {
        const f = twoFingers();
        s.s = clamp((grip.s0 * f.d) / (grip.d0 || 1), 0.05, 0.9);
        s.r = grip.r0 + ((f.a - grip.a0) * 180) / Math.PI;
      }
      place(grip.i);
    };
    const up = (e) => {
      if (!pts.delete(e.pointerId)) return;
      if (grip && (grip.kind !== 'move' || grip.moved)) {
        const s = list[grip.i];
        if (s) s.r = Math.round(((s.r % 360) + 540) % 360) - 180;
        onChange();
      }
      grip = null;
    };
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);
    render();

    return {
      add: (id) => {
        if (list.length >= max) {
          UI.toast(`스티커는 ${max}개까지 붙일 수 있어요`, { icon: '✨' });
          return false;
        }
        // a new one goes a little away from the one before it, so that they do not pile up
        const n = list.length;
        list.push(this.make(id, clamp(0.5 + ((n % 5) - 2) * 0.08, 0.1, 0.9), clamp(0.45 + ((n % 3) - 1) * 0.08, 0.1, 0.9)));
        Sfx.play('pop');
        select(list.length - 1);
        onChange();
        return true;
      },
      render,
      select,
      destroy: () => {
        host.removeEventListener('pointerdown', down);
        host.removeEventListener('pointermove', move);
        host.removeEventListener('pointerup', up);
        host.removeEventListener('pointercancel', up);
        layer.remove();
      },
    };
  },
};
