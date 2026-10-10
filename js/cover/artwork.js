// Square (1:1) artwork: processing uploaded photos and drawing built-in cover designs.
import { withTimeout } from './core/util.js';

export const ART_SIZE = 1024;

export const FONTS = {
  rounded: { label: '둥근체', family: 'Fredoka', stack: '"Fredoka", "Jua", ui-rounded, "Arial Rounded MT Bold", system-ui, sans-serif', weight: 600 },
  handwritten: { label: '손글씨', family: 'Caveat', stack: '"Caveat", "Gaegu", "Segoe Print", "Bradley Hand", cursive', weight: 700 },
  // Hangul in the classic style: Gowun Batang, a gentle serif (index.html asks for its bold only, to go with the display face)
  classic: { label: '클래식', family: 'DM Serif Display', stack: '"DM Serif Display", "Gowun Batang", Georgia, "Times New Roman", serif', weight: 400 },
};
const HANGUL_FACE = { rounded: 'Jua', handwritten: 'Gaegu', classic: 'Gowun Batang' };

export const PATTERNS = ['none', 'sparkles', 'stars', 'dots', 'hearts', 'waves', 'rings'];
export const EMOJIS = ['', '🎤', '🎧', '🎵', '🌙', '✨', '💜', '🌸', '🍓', '☁️', '⭐', '💿', '🎹', '🐰', '🍒', '🌈'];

export const PRESETS = [
  { name: '라벤더 드림', bg: 'gradient', colors: ['#c9b3fb', '#ffd0e4'], angle: 135, pattern: 'sparkles', patternColor: '#ffffff', emoji: '🎤', textColor: '#3a2d55', font: 'rounded', layout: 'bottom' },
  { name: '딸기 우유', bg: 'gradient', colors: ['#fff0f6', '#ffb3d1'], angle: 170, pattern: 'dots', patternColor: '#ffffff', emoji: '🍓', textColor: '#8a2d55', font: 'handwritten', layout: 'center' },
  { name: '한밤의 방', bg: 'gradient', colors: ['#241c45', '#6b4fb8'], angle: 180, pattern: 'stars', patternColor: '#ffe9a8', emoji: '🌙', textColor: '#fff6e0', font: 'classic', layout: 'bottom' },
  { name: '피치 크림', bg: 'gradient', colors: ['#fff3e0', '#ffc2a8'], angle: 120, pattern: 'waves', patternColor: '#ffffff', emoji: '🎧', textColor: '#5b3a2e', font: 'rounded', layout: 'top' },
  { name: '민트 소다', bg: 'gradient', colors: ['#d7f7ea', '#b9c8ff'], angle: 150, pattern: 'rings', patternColor: '#ffffff', emoji: '☁️', textColor: '#23415a', font: 'rounded', layout: 'center' },
  { name: '체리 테이프', bg: 'solid', colors: ['#ff8fb1', '#ff8fb1'], angle: 0, pattern: 'hearts', patternColor: '#ffe6f1', emoji: '💿', textColor: '#ffffff', font: 'handwritten', layout: 'bottom' },
];

export function defaultDesign({ title = '', artist = '' } = {}) {
  return { ...PRESETS[0], title, artist, showText: true, frame: true, seed: 7 };
}

export function randomDesign(base = {}) {
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const preset = pick(PRESETS);
  return {
    ...preset,
    title: base.title || '',
    artist: base.artist || '',
    showText: base.showText !== false,
    frame: Math.random() > 0.35,
    pattern: pick(PATTERNS.slice(1)),
    emoji: pick(EMOJIS.slice(1)),
    angle: Math.round(Math.random() * 360),
    font: pick(Object.keys(FONTS)),
    layout: pick(['top', 'center', 'bottom']),
    seed: Math.floor(Math.random() * 100000),
  };
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function ensureFonts(fontKey, text) {
  if (!document.fonts || typeof document.fonts.load !== 'function') return;
  const f = FONTS[fontKey] || FONTS.rounded;
  const sample = text && text.trim() ? text : 'Aa';
  const loads = [document.fonts.load(`${f.weight} 64px "${f.family}"`, sample)];
  // Korean-capable fallbacks (only downloaded when the text needs them).
  if (/[ㄱ-힝]/.test(sample)) loads.push(document.fonts.load(`${f.weight} 64px "${HANGUL_FACE[fontKey] || 'Jua'}"`, sample));
  try { await withTimeout(Promise.all(loads), 2500); } catch { /* offline: system fonts */ }
}

function starPath(ctx, x, y, r, points = 5, inner = 0.45) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const rad = i % 2 === 0 ? r : r * inner;
    const a = (Math.PI * i) / points - Math.PI / 2;
    ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad);
  }
  ctx.closePath();
}

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x - s * 1.1, y - s * 0.35, x - s * 0.45, y - s * 1.05, x, y - s * 0.45);
  ctx.bezierCurveTo(x + s * 0.45, y - s * 1.05, x + s * 1.1, y - s * 0.35, x, y + s * 0.35);
  ctx.closePath();
}

function drawPattern(ctx, S, d) {
  const rand = mulberry32(d.seed || 1);
  ctx.save();
  ctx.fillStyle = d.patternColor;
  ctx.strokeStyle = d.patternColor;
  switch (d.pattern) {
    case 'dots': {
      ctx.globalAlpha = 0.4;
      const step = S / 9;
      for (let y = step / 2; y < S; y += step) {
        for (let x = step / 2; x < S; x += step) {
          ctx.beginPath();
          ctx.arc(x + (rand() - 0.5) * step * 0.3, y + (rand() - 0.5) * step * 0.3, S * (0.008 + rand() * 0.01), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      break;
    }
    case 'stars':
      for (let i = 0; i < 38; i++) {
        ctx.globalAlpha = 0.35 + rand() * 0.6;
        starPath(ctx, rand() * S, rand() * S, S * (0.006 + rand() * 0.018));
        ctx.fill();
      }
      break;
    case 'sparkles':
      for (let i = 0; i < 18; i++) {
        ctx.globalAlpha = 0.45 + rand() * 0.5;
        starPath(ctx, rand() * S, rand() * S, S * (0.015 + rand() * 0.03), 4, 0.28);
        ctx.fill();
      }
      break;
    case 'hearts':
      for (let i = 0; i < 16; i++) {
        ctx.globalAlpha = 0.35 + rand() * 0.45;
        heartPath(ctx, rand() * S, rand() * S, S * (0.02 + rand() * 0.03));
        ctx.fill();
      }
      break;
    case 'waves': {
      ctx.globalAlpha = 0.35;
      ctx.lineWidth = S * 0.012;
      ctx.lineCap = 'round';
      const amp = S * 0.025;
      for (let row = 0; row < 7; row++) {
        const y0 = S * (0.08 + row * 0.14) + rand() * S * 0.02;
        ctx.beginPath();
        for (let x = -10; x <= S + 10; x += 8) ctx.lineTo(x, y0 + Math.sin((x / S) * Math.PI * 4 + row) * amp);
        ctx.stroke();
      }
      break;
    }
    case 'rings': {
      ctx.globalAlpha = 0.3;
      ctx.lineWidth = S * 0.01;
      const cx = S * (0.2 + rand() * 0.6);
      const cy = S * (0.2 + rand() * 0.6);
      for (let r = S * 0.08; r < S * 1.1; r += S * 0.07) {
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    default:
      break;
  }
  ctx.restore();
}

function wrapLines(ctx, text, maxWidth) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  // Break single words that are still too wide (e.g. long Korean titles without spaces).
  const out = [];
  for (const l of lines) {
    if (ctx.measureText(l).width <= maxWidth) { out.push(l); continue; }
    let chunk = '';
    for (const ch of Array.from(l)) {
      if (ctx.measureText(chunk + ch).width > maxWidth && chunk) { out.push(chunk); chunk = ch; } else chunk += ch;
    }
    if (chunk) out.push(chunk);
  }
  return out;
}

/** Draw a design onto `canvas` (sets its size). */
export async function renderCover(canvas, design, size = ART_SIZE) {
  const d = { ...defaultDesign(), ...design };
  const font = FONTS[d.font] || FONTS.rounded;
  await ensureFonts(d.font, `${d.title || ''} ${d.artist || ''}`);
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const S = size;

  // Background
  if (d.bg === 'gradient') {
    const a = ((d.angle || 0) * Math.PI) / 180;
    const r = S * 0.72;
    const dx = Math.sin(a) * r;
    const dy = -Math.cos(a) * r;
    const g = ctx.createLinearGradient(S / 2 - dx, S / 2 - dy, S / 2 + dx, S / 2 + dy);
    g.addColorStop(0, d.colors[0]);
    g.addColorStop(1, d.colors[1] || d.colors[0]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = d.colors[0];
  }
  ctx.fillRect(0, 0, S, S);

  // Soft glow
  for (const [x, y, rad] of [[0.18, 0.15, 0.55], [0.85, 0.9, 0.5]]) {
    const g = ctx.createRadialGradient(S * x, S * y, 0, S * x, S * y, S * rad);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, S, S);
  }

  drawPattern(ctx, S, d);

  const hasText = d.showText !== false && (d.title || d.artist);
  const layout = d.layout || 'bottom';
  let emojiY = S * 0.42;
  let textTop = S * 0.66;
  if (layout === 'center') { emojiY = S * 0.3; textTop = S * 0.5; }
  if (layout === 'top') { emojiY = S * 0.64; textTop = S * 0.12; }
  if (!hasText) emojiY = S * 0.5;

  if (d.emoji) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const es = hasText ? S * 0.26 : S * 0.4;
    ctx.font = `${Math.round(es)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.shadowColor = 'rgba(58, 45, 85, 0.18)';
    ctx.shadowBlur = S * 0.03;
    ctx.shadowOffsetY = S * 0.012;
    ctx.fillText(d.emoji, S / 2, emojiY);
    ctx.restore();
  }

  if (hasText) {
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillStyle = d.textColor;
    ctx.shadowColor = 'rgba(0,0,0,0.12)';
    ctx.shadowBlur = S * 0.012;
    ctx.shadowOffsetY = S * 0.004;
    const maxW = S * 0.84;
    const scale = d.font === 'handwritten' ? 1.25 : 1;
    let titleSize = S * 0.105 * scale;
    let lines = [];
    const title = (d.title || '').trim();
    while (titleSize > S * 0.04) {
      ctx.font = `${font.weight} ${Math.round(titleSize)}px ${font.stack}`;
      lines = title ? wrapLines(ctx, title, maxW) : [];
      if (lines.length <= 3) break;
      titleSize *= 0.9;
    }
    lines = lines.slice(0, 3);
    let y = textTop;
    for (const line of lines) {
      ctx.fillText(line, S / 2, y);
      y += titleSize * 1.08;
    }
    if (d.artist) {
      const artistSize = Math.max(S * 0.04, Math.min(S * 0.055, titleSize * 0.5)) * (d.font === 'handwritten' ? 1.15 : 1);
      ctx.font = `${font.weight} ${Math.round(artistSize)}px ${font.stack}`;
      ctx.globalAlpha = 0.85;
      const artistLine = wrapLines(ctx, d.artist.trim(), maxW)[0] || '';
      ctx.fillText(artistLine, S / 2, y + S * 0.015);
    }
    ctx.restore();
  }

  if (d.frame) {
    ctx.save();
    ctx.globalAlpha = 0.75;
    ctx.strokeStyle = d.patternColor;
    ctx.lineWidth = S * 0.01;
    const m = S * 0.045;
    const r = S * 0.06;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') ctx.roundRect(m, m, S - m * 2, S - m * 2, r);
    else ctx.rect(m, m, S - m * 2, S - m * 2);
    ctx.stroke();
    ctx.restore();
  }
  return canvas;
}

export function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('이미지를 내보내지 못했어요.'))), type, quality);
  });
}

export async function designToBlob(design) {
  const canvas = document.createElement('canvas');
  await renderCover(canvas, design);
  return canvasToBlob(canvas);
}

async function loadImageSource(file) {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file); } catch { /* fall back to <img> */ }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Center-crop an uploaded image to a square JPEG (max 1200 px). */
export async function processImageFile(file, max = 1200) {
  let src;
  try {
    src = await loadImageSource(file);
  } catch {
    throw new Error('이 이미지를 열 수 없어요. JPG나 PNG로 해 보세요.');
  }
  const w = src.width;
  const hgt = src.height;
  const side = Math.min(w, hgt);
  const out = Math.min(max, side);
  const canvas = document.createElement('canvas');
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, out, out);
  ctx.drawImage(src, (w - side) / 2, (hgt - side) / 2, side, side, 0, 0, out, out);
  if (typeof src.close === 'function') src.close();
  return canvasToBlob(canvas, 'image/jpeg', 0.9);
}
