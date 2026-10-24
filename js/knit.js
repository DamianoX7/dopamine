'use strict';
/* ==================================================================
   그려 입히는 여우 옷 — a sweater for a fox, with a picture of hers
   knitted into it.

   She draws on a chart of 32 × 32 stitches, a yarn to a stitch (a
   pencil, a bucket to fill with, an eraser, a mirror for drawing
   both halves at once — or a picture from her phone, knitted into
   the chart), picks the yarn of the sweater and of its ribbing, and
   whether her picture goes on its back, large, or all over it as a
   pattern. The fox she is dressing wears it while she draws, its
   back turned to her (js/fox/knit.js knits it to fit any fox: the
   fur lies flat under it). The sweaters she has made are in the
   shop's 🎀 tab: a tap puts one on the fox she is with — one at a
   time — and ✏️ draws on it again. The first one's yarn is free.

   KnitArt paints the knitting: the stitches on her chart, the
   pictures of the sweaters in the shop, and the texture the 3D side
   wraps round the fox (the same stitches, so it is what she drew).
   ================================================================== */

const KNIT_G = 32; //      the chart: so many stitches across and down
const KNIT_MAX = 8; //     sweaters she can have
const KNIT_PRICE = 80; //  a sweater's yarn, after the first one's
const KNIT_UNDO = 40; //   steps she can take back

/* The yarns: 1 … 16 in a chart (0: none — the sweater's own yarn shows there). */
const KNIT_YARNS = [
  null,
  { hex: '#fbf5ea', name: '아이보리' },
  { hex: '#ffb7d2', name: '연분홍' },
  { hex: '#ff5f9e', name: '진분홍' },
  { hex: '#e6394f', name: '빨강' },
  { hex: '#ff9446', name: '주황' },
  { hex: '#ffd64f', name: '노랑' },
  { hex: '#a9da74', name: '연두' },
  { hex: '#3e9f66', name: '초록' },
  { hex: '#8fdccc', name: '민트' },
  { hex: '#7cc3f0', name: '하늘' },
  { hex: '#3c6dd3', name: '파랑' },
  { hex: '#27386b', name: '남색' },
  { hex: '#b48ae4', name: '보라' },
  { hex: '#9a6441', name: '갈색' },
  { hex: '#a2a2ac', name: '회색' },
  { hex: '#2a2630', name: '검정' },
];

/* What a fox says when it puts on a sweater she made (js/config.js may have its own: petLines.knit). */
const KNIT_LINES = ['포근포근 따뜻해! 🧶', '이거 네가 그린 거야? 💗', '세상에 하나뿐인 스웨터다!', '어때? 잘 어울려?'];

/* ------------------------------------------------------------------
   KnitArt — the knitting, painted.
   ------------------------------------------------------------------ */
const KnitArt = {
  G: KNIT_G,
  YARNS: KNIT_YARNS,
  // The texture the 3D side wraps round a fox (js/fox/knit.js lays its stitches out by this): `px` pixels to a stitch;
  // the body, `around` stitches wide (more than any fox measures round) and `rows` long, its middle on the middle of
  // the fox's back; under it the sleeves; under them a strip of ribbing for the neck, the hem and the cuffs.
  ATLAS: { px: 10, around: 96, rows: 60, sleeveAround: 40, sleeveRows: 16, ribRows: 6 },
  stamps: new Map(),

  hex(yarn) {
    return (KNIT_YARNS[yarn] || KNIT_YARNS[1]).hex;
  },

  /* A colour a little darker (k < 0) or lighter (k > 0). */
  shade(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const to = k < 0 ? 0 : 255;
    const f = Math.abs(k);
    const ch = (v) => Math.round(v + (to - v) * f);
    return `rgb(${ch((n >> 16) & 255)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
  },

  canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  },

  /*
     One stitch, `s` pixels square: the two legs of a V meeting low in the middle, round and lit from above, with the
     yarn in shadow between them. (kind 'rib': a stitch of the ribbing, narrower; 'purl': the purl stitch between two
     of those, sunk in. kind 'height': a stitch as how far it stands out — for the 3D side's light.)
  */
  stamp(yarn, s, kind = 'knit') {
    const key = `${yarn}:${s}:${kind}`;
    let c = this.stamps.get(key);
    if (c) return c;
    c = this.canvas(s, s);
    const g = c.getContext('2d');
    const height = kind === 'height';
    const hex = height ? '#9a9a9a' : this.hex(yarn);
    const dark = height ? '#161616' : this.shade(hex, -0.34);
    g.fillStyle = dark;
    g.fillRect(0, 0, s, s);
    if (kind === 'purl') {
      // (a bump of yarn across the stitch, deep down between two ribs)
      g.fillStyle = this.shade(hex, -0.22);
      g.beginPath();
      g.ellipse(s / 2, s * 0.52, s * 0.42, s * 0.24, 0, 0, Math.PI * 2);
      g.fill();
    } else if (s < 5) {
      // too small for its legs to show: the yarn, a shade darker where the next row begins
      g.fillStyle = this.shade(hex, -0.12);
      g.fillRect(0, 0, s, s);
      g.fillStyle = hex;
      g.fillRect(0, 0, s, Math.max(1, s - 1));
    } else {
      const narrow = kind === 'rib' ? 0.78 : 1;
      for (const side of [-1, 1]) {
        const ax = s * (0.5 + side * 0.31 * narrow);
        const ay = s * 0.16;
        const bx = s * (0.5 + side * 0.045);
        const by = s * 0.88;
        const len = Math.hypot(bx - ax, by - ay);
        g.save();
        g.translate((ax + bx) / 2, (ay + by) / 2);
        g.rotate(Math.atan2(by - ay, bx - ax));
        const w = s * 0.235 * narrow;
        const grad = g.createLinearGradient(0, -w, 0, w);
        if (height) {
          grad.addColorStop(0, '#3a3a3a');
          grad.addColorStop(0.5, '#f4f4f4');
          grad.addColorStop(1, '#3a3a3a');
        } else {
          // (the light comes from above: on the left leg its upper edge is lit, on the right leg its lower one)
          const lit = side < 0 ? 0.32 : 0.62;
          grad.addColorStop(0, this.shade(hex, -0.12));
          grad.addColorStop(lit, this.shade(hex, 0.14));
          grad.addColorStop(1, this.shade(hex, -0.08));
        }
        g.fillStyle = grad;
        g.beginPath();
        g.ellipse(0, 0, len / 2 + s * 0.13, w, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }
    }
    this.stamps.set(key, c);
    return c;
  },

  /* ----- what is knitted where ----- */
  /* The part of a chart that has something on it: { x, y, w, h } — or null. */
  crop(chart) {
    let x0 = KNIT_G;
    let y0 = KNIT_G;
    let x1 = -1;
    let y1 = -1;
    for (let y = 0; y < KNIT_G; y++) {
      for (let x = 0; x < KNIT_G; x++) {
        if (!chart[y * KNIT_G + x]) continue;
        x0 = Math.min(x0, x);
        y0 = Math.min(y0, y);
        x1 = Math.max(x1, x);
        y1 = Math.max(y1, y);
      }
    }
    return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  },

  /*
     The yarn of every stitch of a piece `w` × `h` stitches whose middle is (cx, cy): her picture once, there ('back'),
     or ('all') what she drew, as large as she drew it, over and over — a row of them, the next row half a step along.
     `once` = only the pattern ('all') goes on this piece. → (x, y) → yarn, or 0.
  */
  layout(design, cx, cy, once) {
    const chart = design.chart;
    const G = KNIT_G;
    if (design.fit !== 'all') {
      if (once) return () => 0;
      const x0 = Math.round(cx - G / 2);
      const y0 = Math.round(cy - G / 2);
      return (x, y) => {
        const i = x - x0;
        const j = y - y0;
        return i >= 0 && j >= 0 && i < G && j < G ? chart[j * G + i] : 0;
      };
    }
    const box = this.crop(chart);
    if (!box) return () => 0;
    const px = box.w + Math.max(2, Math.round(box.w * 0.4));
    const py = box.h + Math.max(2, Math.round(box.h * 0.4));
    const ox = Math.round(cx - box.w / 2);
    const oy = Math.round(cy - box.h / 2);
    const mod = (a, n) => ((a % n) + n) % n;
    return (x, y) => {
      const ty = Math.floor((y - oy) / py);
      const my = mod(y - oy, py);
      const mx = mod(x - ox - (ty % 2 ? Math.floor(px / 2) : 0), px);
      return mx < box.w && my < box.h ? chart[(box.y + my) * G + box.x + mx] : 0;
    };
  },

  /* The texture for the 3D side (ATLAS): painted into `canvas` if there is one. */
  atlas(design, canvas) {
    const A = this.ATLAS;
    const s = A.px;
    const W = A.around * s;
    const H = (A.rows + A.sleeveRows + A.ribRows) * s;
    const c = canvas || this.canvas(W, H);
    const g = c.getContext('2d');
    const base = design.base;
    const body = this.layout(design, A.around / 2, A.rows / 2);
    for (let y = 0; y < A.rows; y++) for (let x = 0; x < A.around; x++) g.drawImage(this.stamp(body(x, y) || base, s), x * s, y * s);
    const sleeve = this.layout(design, A.sleeveAround / 2, A.sleeveRows / 2, true);
    g.fillStyle = this.shade(this.hex(base), -0.34);
    g.fillRect(0, A.rows * s, W, A.sleeveRows * s);
    for (let y = 0; y < A.sleeveRows; y++) for (let x = 0; x < A.sleeveAround; x++) g.drawImage(this.stamp(sleeve(x, y) || base, s), x * s, (A.rows + y) * s);
    const y0 = A.rows + A.sleeveRows;
    for (let y = 0; y < A.ribRows; y++) for (let x = 0; x < A.around; x++) g.drawImage(this.stamp(design.trim, s, x % 2 ? 'purl' : 'rib'), x * s, (y0 + y) * s);
    return c;
  },

  /* …and how far its stitches stand out, the same for every sweater (a canvas, painted once). */
  relief() {
    if (this.reliefCanvas) return this.reliefCanvas;
    const A = this.ATLAS;
    const s = A.px;
    const c = this.canvas(A.around * s, (A.rows + A.sleeveRows + A.ribRows) * s);
    const g = c.getContext('2d');
    const knit = this.stamp(0, s, 'height');
    for (let y = 0; y < A.rows + A.sleeveRows; y++) for (let x = 0; x < A.around; x++) g.drawImage(knit, x * s, y * s);
    for (let y = A.rows + A.sleeveRows; y < A.rows + A.sleeveRows + A.ribRows; y++) {
      for (let x = 0; x < A.around; x++) {
        g.fillStyle = x % 2 ? '#202020' : '#000000';
        g.fillRect(x * s, y * s, s, s);
        if (!(x % 2)) g.drawImage(knit, x * s, y * s);
      }
    }
    this.reliefCanvas = c;
    return c;
  },

  /* Her chart as she draws it: every stitch (`cell` pixels) in its yarn, the sweater's own where there is none. */
  paintChart(g, chart, base, cell, only = null) {
    const draw = (i) => g.drawImage(this.stamp(chart[i] || base, cell), (i % KNIT_G) * cell, Math.floor(i / KNIT_G) * cell);
    if (only) only.forEach(draw);
    else for (let i = 0; i < chart.length; i++) draw(i);
  },

  /* A picture of a sweater, for the shop (`size` px): its shape, knitted as it is — her picture on it — and ribbed. */
  picture(design, size = 180) {
    const c = this.canvas(size, size);
    const g = c.getContext('2d');
    const u = size / 100;
    // the shape: body, sleeves out to either side, a round neck
    const shape = new Path2D();
    shape.moveTo(36 * u, 14 * u);
    shape.quadraticCurveTo(50 * u, 24 * u, 64 * u, 14 * u);
    shape.lineTo(80 * u, 19 * u);
    shape.lineTo(96 * u, 50 * u);
    shape.lineTo(85 * u, 56 * u);
    shape.lineTo(76 * u, 42 * u);
    shape.lineTo(76 * u, 90 * u);
    shape.lineTo(24 * u, 90 * u);
    shape.lineTo(24 * u, 42 * u);
    shape.lineTo(15 * u, 56 * u);
    shape.lineTo(4 * u, 50 * u);
    shape.lineTo(20 * u, 19 * u);
    shape.closePath();
    g.save();
    g.shadowColor = 'rgba(80, 30, 60, 0.28)';
    g.shadowBlur = 5 * u;
    g.shadowOffsetY = 2 * u;
    g.fillStyle = this.hex(design.base);
    g.fill(shape);
    g.restore();
    g.save();
    g.clip(shape);
    // the stitches: her picture across the middle of the body (as on the fox's back), or all over
    const s = Math.max(3, Math.round((52 * u) / (KNIT_G + 4)));
    const cols = Math.ceil(size / s);
    const rows = Math.ceil(size / s);
    const cx = Math.round((50 * u) / s);
    const cy = Math.round((55 * u) / s);
    const body = this.layout(design, cx, cy);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) g.drawImage(this.stamp(body(x, y) || design.base, s), x * s, y * s);
    // …ribbed at the hem, the cuffs and the neck (each band's stitches, over the box it lies in: x0 … x1, y0 … y1)
    const rib = ([path, x0, y0, x1, y1]) => {
      g.save();
      g.clip(path);
      for (let y = Math.floor((y0 * u) / s); y <= Math.ceil((y1 * u) / s); y++) {
        for (let x = Math.floor((x0 * u) / s); x <= Math.ceil((x1 * u) / s); x++) g.drawImage(this.stamp(design.trim, s, x % 2 ? 'purl' : 'rib'), x * s, y * s);
      }
      g.restore();
    };
    const hem = new Path2D();
    hem.rect(24 * u, 82 * u, 52 * u, 8 * u);
    const cuffs = new Path2D();
    cuffs.moveTo(4 * u, 50 * u);
    cuffs.lineTo(15 * u, 56 * u);
    cuffs.lineTo(18.5 * u, 50 * u);
    cuffs.lineTo(7.5 * u, 43.5 * u);
    cuffs.closePath();
    cuffs.moveTo(96 * u, 50 * u);
    cuffs.lineTo(85 * u, 56 * u);
    cuffs.lineTo(81.5 * u, 50 * u);
    cuffs.lineTo(92.5 * u, 43.5 * u);
    cuffs.closePath();
    const neck = new Path2D();
    neck.moveTo(33 * u, 13 * u);
    neck.quadraticCurveTo(50 * u, 26 * u, 67 * u, 13 * u);
    neck.lineTo(67 * u, 19 * u);
    neck.quadraticCurveTo(50 * u, 32 * u, 33 * u, 19 * u);
    neck.closePath();
    [
      [hem, 24, 82, 76, 90],
      [cuffs, 4, 43, 96, 56],
      [neck, 33, 12, 67, 26],
    ].forEach(rib);
    g.restore();
    g.lineWidth = Math.max(1, 0.8 * u);
    g.strokeStyle = this.shade(this.hex(design.base), -0.35);
    g.stroke(shape);
    return c;
  },

  /* ----- a chart in a few letters (a run of the same yarn is its length and its letter) ----- */
  encode(chart) {
    let out = '';
    for (let i = 0; i < chart.length; ) {
      let n = 1;
      while (i + n < chart.length && chart[i + n] === chart[i]) n++;
      const ch = chart[i] ? String.fromCharCode(96 + chart[i]) : '.';
      out += n > 2 ? n + ch : ch.repeat(n);
      i += n;
    }
    return out;
  },

  decode(text) {
    const chart = new Uint8Array(KNIT_G * KNIT_G);
    let i = 0;
    let num = '';
    for (const ch of String(text || '')) {
      if (ch >= '0' && ch <= '9') {
        num += ch;
        continue;
      }
      const v = ch === '.' ? 0 : clamp(ch.charCodeAt(0) - 96, 0, KNIT_YARNS.length - 1);
      const n = Math.min(num ? +num : 1, chart.length - i);
      chart.fill(v, i, i + n);
      i += n;
      num = '';
      if (i >= chart.length) break;
    }
    return chart;
  },

  /* ----- a picture from her phone, knitted into a chart ----- */
  lab: null,
  /* sRGB → OKLab, for telling which yarn a colour is nearest to */
  oklab(r, g, b) {
    const lin = (c) => ((c /= 255) <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
    const R = lin(r);
    const G = lin(g);
    const B = lin(b);
    const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
    const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
    const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s, 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s];
  },
  nearest(r, g, b) {
    if (!this.lab) {
      this.lab = KNIT_YARNS.map((y) => {
        if (!y) return null;
        const n = parseInt(y.hex.slice(1), 16);
        return this.oklab((n >> 16) & 255, (n >> 8) & 255, n & 255);
      });
    }
    const p = this.oklab(r, g, b);
    let best = 1;
    let bestD = Infinity;
    this.lab.forEach((q, i) => {
      if (!q) return;
      const d = (p[0] - q[0]) ** 2 * 1.6 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  },

  /*
     A picture (an <img> or a canvas) as a chart: fitted into it whole, each stitch the colour most of its part of the
     picture has, in the nearest yarn. What is behind the picture — see-through, or the colour all round its edge (the
     paper of a drawing) — is left to the sweater's own yarn.
  */
  fromPicture(img) {
    const S = 8; // (pixels looked at across a stitch)
    const N = KNIT_G * S;
    const c = this.canvas(N, N);
    const g = c.getContext('2d', { willReadFrequently: true });
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const k = N / Math.max(iw, ih);
    const w = Math.round(iw * k);
    const h = Math.round(ih * k);
    g.drawImage(img, Math.round((N - w) / 2), Math.round((N - h) / 2), w, h);
    const px = g.getImageData(0, 0, N, N).data;
    // the colour round the edge of the picture itself, if most of that edge is one colour
    const edge = new Map();
    let rim = 0;
    const x0 = Math.round((N - w) / 2);
    const y0 = Math.round((N - h) / 2);
    const look = (x, y) => {
      const i = (y * N + x) * 4;
      if (px[i + 3] < 128) return;
      rim++;
      const key = ((px[i] >> 4) << 8) | ((px[i + 1] >> 4) << 4) | (px[i + 2] >> 4);
      edge.set(key, (edge.get(key) || 0) + 1);
    };
    for (let x = x0; x < x0 + w; x += 2) {
      look(x, y0);
      look(x, y0 + h - 1);
    }
    for (let y = y0; y < y0 + h; y += 2) {
      look(x0, y);
      look(x0 + w - 1, y);
    }
    let paper = null;
    const top = [...edge.entries()].sort((a, b) => b[1] - a[1])[0];
    if (top && top[1] > rim * 0.45) paper = [((top[0] >> 8) & 15) * 16 + 8, ((top[0] >> 4) & 15) * 16 + 8, (top[0] & 15) * 16 + 8];
    const behind = (i) => px[i + 3] < 128 || (paper && Math.abs(px[i] - paper[0]) + Math.abs(px[i + 1] - paper[1]) + Math.abs(px[i + 2] - paper[2]) < 60);
    const chart = new Uint8Array(KNIT_G * KNIT_G);
    for (let cy = 0; cy < KNIT_G; cy++) {
      for (let cx = 0; cx < KNIT_G; cx++) {
        let n = 0;
        let r = 0;
        let gg = 0;
        let b = 0;
        for (let y = cy * S; y < cy * S + S; y++) {
          for (let x = cx * S; x < cx * S + S; x++) {
            const i = (y * N + x) * 4;
            if (behind(i)) continue;
            n++;
            r += px[i];
            gg += px[i + 1];
            b += px[i + 2];
          }
        }
        if (n >= S * S * 0.4) chart[cy * KNIT_G + cx] = this.nearest(r / n, gg / n, b / n);
      }
    }
    return chart;
  },
};
window.KnitArt = KnitArt;

/* ------------------------------------------------------------------
   Knit — her sweaters, and the knitting of them.
   ------------------------------------------------------------------ */
const Knit = {
  ov: null, //       the knitting, while it is open (a sheet over the foxes' world)
  draft: null, //    what she is knitting: { id (of the sweater it is, or null: a new one), chart, base, trim, fit, rev }
  charts: {}, //     sweater id → { rev, chart } (her charts, read out of their letters)
  pictures: {}, //   …and their pictures for the shop: id@rev → data URL
  kept: {}, //       what she was drawing when the knitting was closed without being finished (this visit): target → draft
  undos: [],
  tool: 'pen', //    'pen' · 'fill' · 'erase'
  size: 1, //        how thick the pencil is: 1, 2, 3
  yarn: 3, //        the yarn she draws with
  mirror: false, //  both halves at once
  pick: null, //     the yarn row sets the sweater's own yarn ('base') or its ribbing's ('trim') instead
  dirty: false,
  stroke: null, //   the line she is drawing: { last: [x, y], id: its pointer, any: whether it has laid any yarn yet }

  isKnit: (id) => /^knit/.test(String(id)),
  list() {
    return State.knit.list;
  },
  get(id) {
    return this.list().find((k) => k.id === id) || null;
  },
  /* The id the 3D side knows a sweater by: with how often she has drawn on it (so pictures of it are drawn again). */
  worn(id) {
    const k = this.get(String(id).split('@')[0]);
    return k ? `${k.id}@${k.rev}` : id;
  },
  chartOf(k) {
    const had = this.charts[k.id];
    if (had && had.rev === k.rev) return had.chart;
    const chart = KnitArt.decode(k.chart);
    this.charts[k.id] = { rev: k.rev, chart };
    return chart;
  },
  /* What the 3D side knits (js/fox/knit.js, through FoxHost.knitOf): a sweater of hers, or the one she is knitting. */
  design(id) {
    if (id === 'knit-draft') return this.draft ? { ...this.draft, id: 'knit-draft' } : null;
    const k = this.get(id);
    return k ? { id: k.id, chart: this.chartOf(k), base: k.base, trim: k.trim, fit: k.fit, rev: k.rev } : null;
  },
  /* "스웨터 2" */
  name(k) {
    return `스웨터 ${k.n}`;
  },
  /* What the next one costs: the first one's yarn is free. */
  price() {
    return State.knit.made ? KNIT_PRICE : 0;
  },
  /* The shop's picture of a sweater. */
  picture(k) {
    const key = `${k.id}@${k.rev}`;
    if (!this.pictures[key]) this.pictures[key] = KnitArt.picture(this.design(k.id), 300).toDataURL('image/png');
    return this.pictures[key];
  },

  /* Is this fox wearing one of her sweaters? */
  wears(fox) {
    return Pet.outfit(fox).some((x) => this.isKnit(x));
  },

  /* A sweater for the fox she is with: one at a time (and a fox without one, if `id` is null). */
  dress(fox, id) {
    const worn = Pet.outfit(fox).filter((x) => !this.isKnit(x));
    if (id) worn.push(id);
    State.pet.outfits[fox] = worn;
  },

  /* ----- the shop's 🎀 tab: her sweaters, and a new one ----- */
  shopHtml() {
    const p = State.pet;
    const list = this.list();
    const price = this.price();
    const cards = list
      .map((k) => {
        const on = Pet.outfit().includes(k.id);
        return `<div class="shop-cell">
          <button class="shop-item owned ${on ? 'worn' : ''}" data-action="knit-wear" data-id="${k.id}" data-sfx="none" aria-pressed="${on}">
            <span class="shop-pic is-knit" aria-hidden="true"><img src="${this.picture(k)}" alt=""></span>
            <b>${esc(this.name(k))}</b>
            <span class="shop-desc">${k.fit === 'all' ? '온몸 무늬' : '등에 그림'}</span>
            <small>${on ? '✓ 입는 중' : '입히기'}</small></button>
          <button class="shop-edit" data-action="knit-edit" data-id="${k.id}" aria-label="${esc(this.name(k))}에 다시 그리기">✏️</button>
        </div>`;
      })
      .join('');
    const more =
      list.length < KNIT_MAX
        ? `<button class="shop-item knit-new" data-action="knit-new" data-sfx="none">
            <span class="shop-pic is-knit" aria-hidden="true">🧶</span>
            <b>새로 뜨기</b>
            <span class="shop-desc">그림을 그려서 떠요</span>
            <small>${price ? `${price} 🪙` : '첫 털실은 무료!'}</small></button>`
        : '';
    return `<h3 class="shop-head">🧶 그려 입히는 스웨터${list.length ? ` <small>${list.length}벌</small>` : ''}</h3>
      <p class="hint">${list.length ? `누르면 ${esc(josa(p.name, '이/가'))} 입고 벗어요. ✏️로 그림을 다시 그릴 수 있어요.` : '그림을 그리면 한 코 한 코 뜨개 무늬가 돼서 여우가 입어요.'}</p>
      <div class="shop-grid">${cards}${more}</div>
      <h3 class="shop-head">🎀 장식</h3>`;
  },

  /* A tap on one of her sweaters: on the fox she is with — or off again. */
  wear(id) {
    if (!this.get(id) || !Pet.anyoneHome('스웨터를 입혀 주세요')) return;
    const fox = State.pet.species;
    const on = Pet.outfit(fox).includes(id);
    this.dress(fox, on ? null : id);
    Pet.previewing = null;
    Store.save();
    Sfx.play('pop');
    Pet.refresh();
    if (!on) {
      FoxHost.act('dress', fox);
      FoxHost.say(this.saying(), 2600);
    }
    Pet.wantFace();
    Game.checkAchievements();
    FoxRoom.renderShop();
  },

  /* What a fox says as it puts on one of her sweaters. */
  saying() {
    const mine = (CFG.petLines || {}).knit;
    return pick(mine && mine.length ? mine : KNIT_LINES);
  },

  /* ----- the knitting ----- */
  /* Begin a new sweater (`id` null) or draw on one of hers again. */
  open(id = null) {
    if (this.ov || !FoxRoom.ov) return;
    if (!Pet.anyoneHome('스웨터를 떠 주세요')) return;
    const k = id ? this.get(id) : null;
    if (id && !k) return;
    if (!k && this.list().length >= KNIT_MAX) return void UI.toast(`스웨터는 ${KNIT_MAX}벌까지 가질 수 있어요. ✏️로 다시 그려 보세요.`, { icon: '🧶', ms: 3600 });
    if (!k && State.dopamine.coins < this.price()) return void Pet.spend(this.price()); // (says how many coins are missing)
    const target = k ? k.id : 'new';
    const kept = this.kept[target];
    delete this.kept[target];
    const fresh = () => {
      const light = /arctic|marble|gumiho|animud/.test(State.pet.species); // (on a white coat, a sweater with some colour)
      return { id: null, chart: new Uint8Array(KNIT_G * KNIT_G), base: light ? 2 : 1, trim: light ? 1 : 3, fit: 'back', rev: 1 };
    };
    this.draft = kept || (k ? { id: k.id, chart: this.chartOf(k).slice(), base: k.base, trim: k.trim, fit: k.fit, rev: 1 } : fresh());
    this.undos = [];
    this.dirty = !!kept;
    this.pick = null;
    this.back = FoxRoom.tab || 'acc';
    Sfx.play('pop');
    FoxRoom.setShop(null);
    $('[data-fox-room]', FoxRoom.ov.panel).classList.add('knit-on'); // (the game's buttons make way)
    this.ov = UI.open(this.html(), { cls: 'is-knit', label: k ? `${this.name(k)}에 다시 그리기` : '새 스웨터 뜨기', onClose: () => this.closed() });
    this.bind();
    this.layoutPad();
    requestAnimationFrame(() => {
      this.layoutPad();
      this.frame();
    });
    FoxHost.sync(); // (the fox she is dressing puts it on)
    if (FoxHost.api) FoxHost.api.knit(this.design('knit-draft'));
    this.frame();
    if (kept) UI.toast('그리던 그림을 이어서 그려요', { icon: '🧶', ms: 2400 });
  },

  html() {
    const k = this.draft.id ? this.get(this.draft.id) : null;
    const price = k ? 0 : this.price();
    const tools = [
      ['pen', '✏️', '연필'],
      ['fill', '🪣', '채우기'],
      ['erase', '🧽', '지우개'],
    ];
    return `<div class="knit" data-knit>
      <div class="kn-head">
        <h2 class="kn-title">🧶 ${k ? esc(this.name(k)) : '새 스웨터'}</h2>
        <button class="btn primary small" data-kn="done">${price ? `완성 · ${price} 🪙` : '완성'}</button>
        <button class="icon-btn small" data-kn="cancel" aria-label="그만두기">✕</button>
      </div>
      <div class="kn-padbox" data-kn-padbox>
        <canvas class="kn-pad" data-kn-pad aria-label="뜨개 그림판: 손가락으로 그려요" role="img"></canvas>
        <p class="kn-tip" data-kn-tip ${this.draft.chart.some((v) => v) ? 'hidden' : ''}>여기에 손가락으로 그려 보세요 ✏️<br><small>한 칸이 한 코 · 위쪽이 여우 머리 쪽이에요</small></p>
      </div>
      <div class="kn-yarns" data-kn-yarns role="radiogroup" aria-label="실 색깔">
        ${KNIT_YARNS.map((y, i) => (y ? `<button class="kn-yarn" role="radio" data-yarn="${i}" style="--y:${y.hex}" aria-label="${esc(y.name)}"></button>` : '')).join('')}
      </div>
      <div class="kn-tools">
        <div class="kn-seg" role="radiogroup" aria-label="도구">
          ${tools.map(([id, e, name]) => `<button class="kn-tool" role="radio" data-tool="${id}" aria-label="${name}"><span aria-hidden="true">${e}</span><small>${name}</small></button>`).join('')}
        </div>
        <button class="kn-tool" data-kn="size" aria-label="굵기"><span class="kn-dot" data-kn-dot aria-hidden="true"></span><small>굵기</small></button>
        <button class="kn-tool" data-kn="mirror" aria-pressed="false" aria-label="좌우 대칭"><span aria-hidden="true">🦋</span><small>대칭</small></button>
        <button class="kn-tool" data-kn="undo" aria-label="되돌리기"><span aria-hidden="true">↶</span><small>되돌리기</small></button>
        <button class="kn-tool" data-kn="more" aria-label="더 보기"><span aria-hidden="true">⋯</span><small>더 보기</small></button>
      </div>
      <div class="kn-opts">
        <button class="kn-swatch" data-kn="base" aria-label="스웨터 색"><i data-kn-base></i>스웨터</button>
        <button class="kn-swatch" data-kn="trim" aria-label="고무단 색"><i data-kn-trim></i>고무단</button>
        <div class="seg kn-fit" role="radiogroup" aria-label="그림을 놓을 곳">
          <button class="seg-btn" role="radio" data-fit="back">등에 크게</button>
          <button class="seg-btn" role="radio" data-fit="all">온몸 무늬</button>
        </div>
      </div>
      <p class="kn-pick" data-kn-pick hidden></p>
      <input type="file" accept="image/*" data-kn-file hidden>
    </div>`;
  },

  bind() {
    const panel = this.ov.panel;
    const pad = $('[data-kn-pad]', panel);
    pad.addEventListener('pointerdown', (e) => this.down(e));
    pad.addEventListener('pointermove', (e) => this.move(e));
    pad.addEventListener('pointerup', (e) => this.up(e));
    pad.addEventListener('pointercancel', (e) => this.up(e));
    panel.addEventListener('click', (e) => {
      const on = (sel) => e.target.closest(sel);
      const yarn = on('[data-yarn]');
      const tool = on('[data-tool]');
      const fit = on('[data-fit]');
      const kn = on('[data-kn]');
      if (yarn) return void this.chooseYarn(+yarn.dataset.yarn);
      if (tool) {
        this.tool = tool.dataset.tool;
        this.pick = null;
        Sfx.play('tap');
        return void this.paintUi();
      }
      if (fit) return void this.setFit(fit.dataset.fit);
      if (!kn) return;
      const what = kn.dataset.kn;
      if (what === 'done') this.finish();
      else if (what === 'cancel') this.cancel();
      else if (what === 'size') {
        this.size = (this.size % 3) + 1;
        Sfx.play('tap');
        this.paintUi();
      } else if (what === 'mirror') {
        this.mirror = !this.mirror;
        Sfx.play('tap');
        this.paintUi();
      } else if (what === 'undo') this.undo();
      else if (what === 'more') this.more();
      else if (what === 'base' || what === 'trim') {
        this.pick = this.pick === what ? null : what;
        Sfx.play('tap');
        this.paintUi();
      }
    });
    $('[data-kn-file]', panel).addEventListener('change', (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = '';
      if (file) this.fromFile(file);
    });
    this.paintUi();
  },

  /* The pad as large as there is room for: a whole number of device pixels to a stitch. */
  layoutPad() {
    if (!this.ov) return;
    const box = $('[data-kn-padbox]', this.ov.panel);
    const pad = $('[data-kn-pad]', this.ov.panel);
    const room = Math.max(120, Math.min(box.clientWidth, box.clientHeight || box.clientWidth));
    const dpr = Math.min(3, window.devicePixelRatio || 1);
    const cell = Math.max(4, Math.floor((room * dpr) / KNIT_G));
    if (pad.width !== cell * KNIT_G) {
      pad.width = pad.height = cell * KNIT_G;
      this.cell = cell;
    }
    pad.style.width = pad.style.height = `${(cell * KNIT_G) / dpr}px`;
    this.paintPad();
  },

  paintPad(only = null) {
    if (!this.ov) return;
    const pad = $('[data-kn-pad]', this.ov.panel);
    KnitArt.paintChart(pad.getContext('2d'), this.draft.chart, this.draft.base, this.cell || Math.floor(pad.width / KNIT_G), only);
  },

  /* The buttons as things are: which tool, which yarn, how thick, which way her picture goes. */
  paintUi() {
    if (!this.ov) return;
    const panel = this.ov.panel;
    const d = this.draft;
    const chosen = this.pick === 'base' ? d.base : this.pick === 'trim' ? d.trim : this.tool === 'erase' ? -1 : this.yarn;
    $$('[data-yarn]', panel).forEach((b) => {
      const on = +b.dataset.yarn === chosen;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    $$('[data-tool]', panel).forEach((b) => {
      const on = b.dataset.tool === this.tool && !this.pick;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    $$('[data-fit]', panel).forEach((b) => {
      const on = b.dataset.fit === d.fit;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    const mirror = $('[data-kn="mirror"]', panel);
    mirror.classList.toggle('on', this.mirror);
    mirror.setAttribute('aria-pressed', String(this.mirror));
    $('[data-kn-padbox]', panel).classList.toggle('is-mirror', this.mirror);
    $('[data-kn-dot]', panel).dataset.size = this.size;
    $('[data-kn-base]', panel).style.background = KnitArt.hex(d.base);
    $('[data-kn-trim]', panel).style.background = KnitArt.hex(d.trim);
    $('[data-kn="base"]', panel).classList.toggle('on', this.pick === 'base');
    $('[data-kn="trim"]', panel).classList.toggle('on', this.pick === 'trim');
    $('[data-kn="undo"]', panel).disabled = !this.undos.length;
    const hint = $('[data-kn-pick]', panel);
    hint.hidden = !this.pick;
    hint.textContent = this.pick === 'base' ? '스웨터 바탕 색을 골라요' : this.pick === 'trim' ? '목둘레·소매·밑단 고무단 색을 골라요' : '';
  },

  chooseYarn(i) {
    Sfx.play('tap');
    const d = this.draft;
    if (this.pick === 'base' || this.pick === 'trim') {
      if (d[this.pick] !== i) {
        this.remember();
        d[this.pick] = i;
        if (this.pick === 'base') this.paintPad();
        this.changed(true);
      }
      this.pick = null;
    } else {
      this.yarn = i;
      if (this.tool === 'erase') this.tool = 'pen';
    }
    this.paintUi();
  },

  setFit(fit) {
    if (this.draft.fit === fit) return;
    Sfx.play('tap');
    this.remember();
    this.draft.fit = fit;
    this.changed(true);
    this.paintUi();
    if (fit === 'all' && !this.toldAll) {
      this.toldAll = true;
      UI.toast('그린 그림이 그 크기 그대로 온몸에 되풀이돼요. 작게 그릴수록 무늬가 촘촘해져요.', { icon: '🧶', ms: 4200 });
    }
  },

  /* ----- drawing ----- */
  cellAt(e) {
    const r = e.currentTarget.getBoundingClientRect();
    return [clamp(Math.floor(((e.clientX - r.left) / r.width) * KNIT_G), 0, KNIT_G - 1), clamp(Math.floor(((e.clientY - r.top) / r.height) * KNIT_G), 0, KNIT_G - 1)];
  },

  /* The stitches a pencil this thick covers round (x, y). */
  brush(x, y) {
    const r = [0, 0.5, 1.2, 2.3][this.size];
    const out = [];
    const n = Math.ceil(r);
    for (let dy = -n; dy <= n; dy++) for (let dx = -n; dx <= n; dx++) if (dx * dx + dy * dy <= r * r + 0.01) out.push([x + dx, y + dy]);
    return out;
  },

  /* Lay the yarn on (x, y) — and on its mirror image, if she draws both halves at once. → the stitches that changed */
  dab(x, y, v, out) {
    const chart = this.draft.chart;
    for (const [bx, by] of this.brush(x, y)) {
      for (const cx of this.mirror ? [bx, KNIT_G - 1 - bx] : [bx]) {
        if (cx < 0 || by < 0 || cx >= KNIT_G || by >= KNIT_G) continue;
        const i = by * KNIT_G + cx;
        if (chart[i] === v) continue;
        chart[i] = v;
        out.push(i);
      }
    }
  },

  down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    this.pick = null;
    const [x, y] = this.cellAt(e);
    if (this.tool === 'fill') {
      this.remember();
      const changed = this.fill(x, y, this.yarn);
      if (!changed.length) return void this.undos.pop();
      Sfx.play('pop');
      this.paintPad(changed);
      this.changed(true);
      return this.paintUi();
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch (err) {
      /* fine */
    }
    this.remember();
    this.stroke = { last: [x, y], id: e.pointerId, any: false };
    this.line(x, y);
    this.paintUi();
  },

  move(e) {
    const s = this.stroke;
    if (!s || s.id !== e.pointerId) return;
    const [x, y] = this.cellAt(e);
    if (x === s.last[0] && y === s.last[1]) return;
    this.line(x, y);
  },

  up(e) {
    const s = this.stroke;
    if (!s || s.id !== e.pointerId) return;
    this.stroke = null;
    if (!s.any) this.undos.pop(); // (nothing changed: nothing to take back)
    else this.changed(true);
    this.paintUi();
  },

  /* From where the pencil was to (x, y), stitch by stitch. */
  line(x, y) {
    const s = this.stroke;
    const v = this.tool === 'erase' ? 0 : this.yarn;
    const changed = [];
    let [x0, y0] = s.any ? s.last : [x, y];
    const dx = Math.abs(x - x0);
    const dy = -Math.abs(y - y0);
    const sx = x0 < x ? 1 : -1;
    const sy = y0 < y ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      this.dab(x0, y0, v, changed);
      if (x0 === x && y0 === y) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
    s.last = [x, y];
    s.any = true;
    if (!changed.length) return;
    this.paintPad(changed);
    this.changed();
  },

  /* The bucket: every stitch of the same yarn that touches (x, y), and (with the mirror) its mirror image's. */
  fill(x, y, v) {
    const chart = this.draft.chart;
    const out = [];
    const from = chart[y * KNIT_G + x];
    const flood = (sx, sy) => {
      const was = chart[sy * KNIT_G + sx];
      if (was === v || was !== from) return;
      const todo = [[sx, sy]];
      while (todo.length) {
        const [cx, cy] = todo.pop();
        if (cx < 0 || cy < 0 || cx >= KNIT_G || cy >= KNIT_G) continue;
        const i = cy * KNIT_G + cx;
        if (chart[i] !== from) continue;
        chart[i] = v;
        out.push(i);
        todo.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }
    };
    flood(x, y);
    if (this.mirror) flood(KNIT_G - 1 - x, y);
    return out;
  },

  remember() {
    const d = this.draft;
    this.undos.push({ chart: d.chart.slice(), base: d.base, trim: d.trim, fit: d.fit });
    if (this.undos.length > KNIT_UNDO) this.undos.shift();
  },

  undo() {
    const u = this.undos.pop();
    if (!u) return;
    Sfx.play('tap');
    Object.assign(this.draft, { chart: u.chart, base: u.base, trim: u.trim, fit: u.fit });
    this.paintPad();
    this.changed(true);
    this.paintUi();
  },

  /* Something changed: the fox shows it — at once (`show`), or when she lifts the pencil (painting the knitting again
     takes a while on a phone, and her line has to keep up with her finger). */
  changed(show = false) {
    const d = this.draft;
    this.dirty = true;
    d.rev++;
    const tip = this.ov && $('[data-kn-tip]', this.ov.panel);
    if (tip && !tip.hidden && d.chart.some((v) => v)) tip.hidden = true;
    if (show && FoxHost.api) FoxHost.api.knit(this.design('knit-draft'));
  },

  more() {
    const k = this.draft.id ? this.get(this.draft.id) : null;
    const items = [
      { icon: '🖼️', label: '사진에서 그림 가져오기', onClick: () => $('[data-kn-file]', this.ov.panel).click() },
      { icon: '🗑️', label: '그림 모두 지우기', onClick: () => this.clearAll() },
    ];
    if (k) items.push({ icon: '🧶', label: `${this.name(k)} 풀기`, danger: true, onClick: () => this.unravel(k) });
    UI.menu('뜨개 그림판', items);
  },

  clearAll() {
    if (!this.draft || !this.draft.chart.some((v) => v)) return;
    this.remember();
    this.draft.chart.fill(0);
    this.paintPad();
    this.changed(true);
    this.paintUi();
    UI.toast('지웠어요. ↶로 되돌릴 수 있어요.', { icon: '🗑️', ms: 2400 });
  },

  /* A picture from her phone: knitted into the chart (to be taken back with ↶). */
  async fromFile(file) {
    if (!this.ov || !/^image\//.test(file.type || 'image/')) return;
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((resolve, reject) => {
        const im = new Image();
        im.onload = () => resolve(im);
        im.onerror = reject;
        im.src = url;
      });
      if (!this.ov) return;
      this.remember();
      this.draft.chart = KnitArt.fromPicture(img);
      if (!this.draft.chart.some((v) => v)) UI.toast('그림을 찾지 못했어요. 배경이 단순한 그림이 잘 돼요.', { icon: '🖼️', ms: 3200 });
      else UI.toast('그림을 한 코 한 코 옮겼어요! 손으로 다듬어 보세요.', { icon: '🧶', ms: 3000 });
      this.paintPad();
      this.changed(true);
      this.paintUi();
    } catch (e) {
      UI.toast('이 사진은 열 수 없어요.', { icon: '🖼️' });
    } finally {
      URL.revokeObjectURL(url);
    }
  },

  /* Done: a new sweater (its yarn paid for) on the fox she is dressing — or the one she drew on, as it is now. */
  finish() {
    const d = this.draft;
    if (!d) return;
    const fox = State.pet.species;
    const old = d.id ? this.get(d.id) : null;
    if (old) {
      const same = old.base === d.base && old.trim === d.trim && old.fit === d.fit && old.chart === KnitArt.encode(d.chart);
      if (!same) Object.assign(old, { chart: KnitArt.encode(d.chart), base: d.base, trim: d.trim, fit: d.fit, rev: old.rev + 1, at: Date.now() });
      if (!same) Diary.note('knit');
      this.dirty = false;
      Store.save();
      this.close();
      if (!same) {
        if (FoxHost.api) FoxHost.api.knit(this.design(old.id)); // (whoever wears it shows it at once)
        UI.toast(`${this.name(old)}의 그림을 바꿨어요!`, { icon: '🧶', ms: 2600 });
        Pet.wantFace();
      }
      return;
    }
    const price = this.price();
    if (price && !Pet.spend(price)) return;
    const s = State.knit;
    s.made += 1;
    const k = { id: `knit${s.made}`, n: s.made, chart: KnitArt.encode(d.chart), base: d.base, trim: d.trim, fit: d.fit, rev: 1, at: Date.now() };
    s.list.push(k);
    this.dress(fox, k.id);
    Diary.note('knit');
    this.dirty = false;
    Store.save();
    if (price) Sfx.play('coin');
    this.close();
    UI.confetti({ count: 40 });
    UI.toast(`${josa(Pet.nameOf(fox), '이/가')} ${josa(this.name(k), '을/를')} 입었어요!`, { icon: '🧶', kind: 'gold', ms: 3200 });
    FoxHost.act('dress', fox);
    FoxHost.say(this.saying(), 2800, fox);
    Pet.wantFace();
    setTimeout(() => Game.checkAchievements(), 2600); // (what the fox says about it first)
  },

  async cancel() {
    if (this.dirty && this.draft && !(await UI.confirm({ title: '그리던 그림을 버릴까요?', text: '완성을 누르지 않으면 스웨터에 남지 않아요.', ok: '버리기', cancel: '계속 그리기', icon: '🧶' }))) return;
    this.dirty = false;
    this.close();
  },

  /* Unravel one of hers: the fox wearing it takes it off, and it is gone. */
  async unravel(k) {
    const ok = await UI.confirm({ title: `${josa(this.name(k), '을/를')} 풀까요?`, text: '털실로 풀면 다시 되돌릴 수 없어요. 입고 있던 여우는 벗어요.', ok: '풀기', cancel: '두기', danger: true, icon: '🧶' });
    if (!ok) return;
    State.knit.list = this.list().filter((x) => x !== k);
    Object.keys(State.pet.outfits).forEach((fox) => (State.pet.outfits[fox] = State.pet.outfits[fox].filter((x) => x !== k.id)));
    delete this.charts[k.id];
    Store.save();
    this.dirty = false;
    this.close();
    if (FoxHost.api) FoxHost.api.unknit(k.id);
    UI.toast(`${josa(this.name(k), '을/를')} 털실로 풀었어요`, { icon: '🧶', ms: 2600 });
    Pet.wantFace();
  },

  close() {
    if (this.ov) UI.close(this.ov);
  },

  /* The knitting is closed (finished, cancelled — or the back button: then what she drew is kept for this visit). */
  closed() {
    this.ov = null;
    if (this.dirty && this.draft) this.kept[this.draft.id || 'new'] = this.draft;
    this.draft = null;
    this.stroke = null;
    if (FoxRoom.ov) {
      $('[data-fox-room]', FoxRoom.ov.panel).classList.remove('knit-on');
      FoxRoom.setShop(this.back || 'acc'); // (back to the shop — the fox wears what it wore)
    }
    if (FoxHost.api) FoxHost.api.unknit('knit-draft'); // (…and the knitting of what she drew goes, now that nobody wears it)
  },

  /* The foxes' world was left while she was knitting. */
  left() {
    if (this.ov) UI.close(this.ov);
  },

  /* How much of the view the knitting covers (the fox she is dressing stays in the rest). */
  frame() {
    if (!this.ov || !FoxHost.api || !FoxHost.stage) return;
    const panel = this.ov.panel;
    const side = panel.offsetHeight > window.innerHeight * 0.9;
    FoxHost.api.frame('knit', side ? { right: panel.offsetWidth } : { bottom: panel.offsetHeight });
  },
};

window.addEventListener('resize', () => {
  if (!Knit.ov) return;
  Knit.layoutPad();
  Knit.frame();
});

Object.assign(Actions, {
  'knit-new': () => Knit.open(null),
  'knit-edit': (el) => Knit.open(el.dataset.id),
  'knit-wear': (el) => Knit.wear(el.dataset.id),
});
