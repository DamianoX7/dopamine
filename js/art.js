'use strict';
/* ==================================================================
   Canvas helpers — the little shapes used by the confetti (hearts &
   sparkles) and the shareable Cover Wrapped card. Cover artwork itself
   is made in the studio (js/cover/artwork.js).
   ================================================================== */

const Art = {
  FONTS: {
    round: (s) => `700 ${s}px Fredoka, Jua, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`,
    serif: (s) => `italic 400 ${s}px "DM Serif Display", Jua, Georgia, serif`,
    hand: (s) => `700 ${s}px Gaegu, Jua, cursive`,
    label: (s) => `600 ${s}px Fredoka, Jua, "Apple SD Gothic Neo", sans-serif`,
  },

  fontsReady(text) {
    if (!document.fonts || !document.fonts.load) return Promise.resolve();
    const sample = (text || '') + 'Aa';
    const loads = ['700 40px Fredoka', '600 40px Fredoka', '400 40px Jua', 'italic 400 40px "DM Serif Display"', '700 40px Gaegu'].map((f) =>
      document.fonts.load(f, sample).catch(() => {})
    );
    return Promise.race([Promise.all(loads), sleep(2000)]);
  },

  /* ---------- shapes ---------- */
  rgba(hex, a) {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
  },

  blob(ctx, x, y, r, color, a) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, this.rgba(color, a));
    g.addColorStop(0.55, this.rgba(color, a * 0.45));
    g.addColorStop(1, this.rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  },

  heart(ctx, x, y, s, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.scale(s / 100, s / 100);
    ctx.beginPath();
    ctx.moveTo(0, 35);
    ctx.bezierCurveTo(-45, 5, -55, -25, -30, -40);
    ctx.bezierCurveTo(-15, -50, 0, -40, 0, -28);
    ctx.bezierCurveTo(0, -40, 15, -50, 30, -40);
    ctx.bezierCurveTo(55, -25, 45, 5, 0, 35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // leave the path in user space for an optional stroke
    ctx.beginPath();
    const k = s / 100;
    const c = Math.cos(rot || 0);
    const sn = Math.sin(rot || 0);
    const tp = (px, py) => [x + (px * c - py * sn) * k, y + (px * sn + py * c) * k];
    ctx.moveTo(...tp(0, 35));
    ctx.bezierCurveTo(...tp(-45, 5), ...tp(-55, -25), ...tp(-30, -40));
    ctx.bezierCurveTo(...tp(-15, -50), ...tp(0, -40), ...tp(0, -28));
    ctx.bezierCurveTo(...tp(0, -40), ...tp(15, -50), ...tp(30, -40));
    ctx.bezierCurveTo(...tp(55, -25), ...tp(45, 5), ...tp(0, 35));
    ctx.closePath();
  },

  sparkle(ctx, x, y, r, rot) {
    const k = r * 0.16;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.beginPath();
    ctx.moveTo(0, -r);
    ctx.quadraticCurveTo(k, -k, r, 0);
    ctx.quadraticCurveTo(k, k, 0, r);
    ctx.quadraticCurveTo(-k, k, -r, 0);
    ctx.quadraticCurveTo(-k, -k, 0, -r);
    ctx.fill();
    ctx.restore();
  },

  noise: null,

  grain(ctx, S, amount) {
    if (!this.noise) {
      const c = document.createElement('canvas');
      c.width = c.height = 128;
      const g = c.getContext('2d');
      const img = g.createImageData(128, 128);
      const rnd = mulberry32(99);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = Math.floor(rnd() * 255);
        img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
        img.data[i + 3] = 255;
      }
      g.putImageData(img, 0, 0);
      this.noise = c;
    }
    ctx.save();
    ctx.globalAlpha = amount;
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = ctx.createPattern(this.noise, 'repeat');
    ctx.fillRect(0, 0, S, S);
    ctx.restore();
  },

  /* ---------- exports ---------- */
  canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },

  toBlob(canvas, type = 'image/png') {
    return new Promise((resolve) => {
      if (canvas.toBlob) {
        canvas.toBlob((b) => resolve(b), type);
      } else {
        const bin = atob(canvas.toDataURL(type).split(',')[1]);
        const arr = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
        resolve(new Blob([arr], { type }));
      }
    });
  },

  fitText(ctx, text, font, maxW, size, min) {
    let s = size;
    ctx.font = font(s);
    while (s > min && ctx.measureText(text).width > maxW) {
      s -= 2;
      ctx.font = font(s);
    }
    return s;
  },

  /* 1080×1920 story-style summary. PNG blob. */
  async wrappedCard(w) {
    await this.fontsReady(`${w.topSong}${w.nickname}${w.periodLabel}`);
    const W = 1080;
    const H = 1920;
    const c = this.canvas(W, H);
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, '#ff5fa2');
    g.addColorStop(0.5, '#a855f7');
    g.addColorStop(1, '#312e81');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    const rnd = mulberry32(7);
    [['#ffd1e8', 240, 260, 380], ['#c4b5fd', 900, 700, 420], ['#fde68a', 200, 1500, 360]].forEach(([col, x, y, r]) => this.blob(ctx, x, y, r, col, 0.45));
    for (let i = 0; i < 60; i++) {
      ctx.fillStyle = `rgba(255,255,255,${0.2 + rnd() * 0.6})`;
      this.sparkle(ctx, rnd() * W, rnd() * H, 4 + rnd() * 12, 0);
    }
    this.grain(ctx, Math.max(W, H), 0.05);

    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = this.FONTS.label(40);
    ctx.fillText('✨ 나의 커버 결산 ✨', W / 2, 190);
    ctx.font = this.FONTS.label(34);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillText(`${w.nickname} · ${w.periodLabel}`, W / 2, 250);

    const rows = [
      ['발매한 커버', `${w.songs}곡`],
      ['노래한 시간', w.time],
      ['가장 자주 노래한 시간대', w.when],
      ['가장 많이 커버한 노래', w.topSong],
      ['녹음하는 방식', w.how],
    ];
    let y = 430;
    rows.forEach(([label, value]) => {
      ctx.font = this.FONTS.label(34);
      ctx.fillStyle = 'rgba(255,255,255,0.78)';
      ctx.fillText(label, W / 2, y);
      const size = this.fitText(ctx, value, this.FONTS.round, 920, 84, 40);
      ctx.font = this.FONTS.round(size);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(value, W / 2, y + 100);
      y += 270;
    });
    ctx.font = this.FONTS.label(28);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('💗 도파민 월드', W / 2, H - 90);
    return this.toBlob(c);
  },
};
