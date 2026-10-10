'use strict';
/* ==================================================================
   Audio — the UI sounds (synthesized on the fly, no sound files) on
   one shared AudioContext. Recording, mixing and playing covers live
   in the studio modules (js/cover/audio).
   ================================================================== */

const AudioSys = {
  ctx: null,

  get() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try {
      this.ctx = new AC({ latencyHint: 'interactive' });
    } catch (e) {
      try {
        this.ctx = new AC();
      } catch (e2) {
        return null;
      }
    }
    return this.ctx;
  },

  resume() {
    const ctx = this.get();
    if (ctx && ctx.state !== 'running') {
      try {
        const p = ctx.resume();
        if (p && p.catch) p.catch(() => {});
      } catch (e) {
        /* ignore */
      }
    }
    return ctx;
  },

  /* Browsers only allow audio after a tap — unlock on the first gesture. */
  installUnlock() {
    const events = ['pointerdown', 'touchend', 'keydown'];
    const unlock = () => {
      const ctx = this.resume();
      if (!ctx) return;
      if (!this.primed) {
        this.primed = true;
        try {
          const src = ctx.createBufferSource();
          src.buffer = ctx.createBuffer(1, 1, 22050);
          src.connect(ctx.destination);
          src.start(0);
        } catch (e) {
          /* ignore */
        }
      }
      if (ctx.state === 'running') events.forEach((t) => document.removeEventListener(t, unlock, true));
    };
    events.forEach((t) => document.addEventListener(t, unlock, true));
  },
};

/* ------------------------------------------------------------------
   UI sounds — short and soft. Muted while recording so they never
   end up inside a take.
   ------------------------------------------------------------------ */
const Sfx = {
  play(name) {
    if (!State.settings.soundEnabled) return;
    if (typeof CoverHost !== 'undefined' && CoverHost.quiet) return;
    const fn = this.sounds[name];
    const ctx = AudioSys.resume();
    if (!fn || !ctx) return;
    try {
      const out = ctx.createGain();
      out.gain.value = 0.16;
      out.connect(ctx.destination);
      fn(ctx, out, ctx.currentTime + 0.01);
      setTimeout(() => {
        try {
          out.disconnect();
        } catch (e) {
          /* ignore */
        }
      }, 2500);
    } catch (e) {
      /* sound is optional */
    }
  },

  tone(ctx, out, t, freq, dur, opt = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = opt.type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opt.glide) o.frequency.exponentialRampToValueAtTime(opt.glide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(opt.vol || 0.5, t + (opt.attack || 0.008));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  },

  sounds: {
    tap: (c, o, t) => Sfx.tone(c, o, t, 740, 0.07, { vol: 0.3 }),
    pop: (c, o, t) => Sfx.tone(c, o, t, 520, 0.12, { vol: 0.55, glide: 1040 }),
    heart: (c, o, t) => {
      Sfx.tone(c, o, t, 660, 0.12, { vol: 0.4 });
      Sfx.tone(c, o, t + 0.09, 880, 0.18, { vol: 0.35 });
    },
    coin: (c, o, t) => {
      Sfx.tone(c, o, t, 988, 0.08, { type: 'triangle', vol: 0.5 });
      Sfx.tone(c, o, t + 0.07, 1319, 0.18, { type: 'triangle', vol: 0.5 });
    },
    reward: (c, o, t) =>
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => Sfx.tone(c, o, t + i * 0.07, f, 0.22, { type: 'triangle', vol: 0.5 })),
    levelup: (c, o, t) => {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) =>
        Sfx.tone(c, o, t + i * 0.08, f, 0.3, { type: 'triangle', vol: 0.45 })
      );
      Sfx.tone(c, o, t + 0.42, 2093, 0.5, { vol: 0.2 });
    },
    achievement: (c, o, t) => {
      Sfx.tone(c, o, t, 784, 0.18, { type: 'triangle', vol: 0.5 });
      Sfx.tone(c, o, t + 0.12, 1175, 0.35, { type: 'triangle', vol: 0.5 });
      Sfx.tone(c, o, t + 0.12, 2350, 0.35, { vol: 0.12 });
    },
    rare: (c, o, t) => {
      Sfx.tone(c, o, t, 600, 0.5, { vol: 0.3, glide: 1800 });
      [1568, 2093, 2637].forEach((f, i) => Sfx.tone(c, o, t + 0.25 + i * 0.09, f, 0.25, { vol: 0.22 }));
    },
    recStart: (c, o, t) => {
      Sfx.tone(c, o, t, 660, 0.09, { vol: 0.45 });
      Sfx.tone(c, o, t + 0.1, 990, 0.14, { vol: 0.45 });
    },
    recStop: (c, o, t) => {
      Sfx.tone(c, o, t, 880, 0.09, { vol: 0.45 });
      Sfx.tone(c, o, t + 0.1, 587, 0.16, { vol: 0.45 });
    },
    count: (c, o, t) => Sfx.tone(c, o, t, 880, 0.08, { vol: 0.4 }),
    flip: (c, o, t) => Sfx.tone(c, o, t, 420, 0.06, { type: 'triangle', vol: 0.3, glide: 620 }),
    match: (c, o, t) => {
      Sfx.tone(c, o, t, 880, 0.1, { type: 'triangle', vol: 0.4 });
      Sfx.tone(c, o, t + 0.08, 1175, 0.16, { type: 'triangle', vol: 0.4 });
    },
    error: (c, o, t) => Sfx.tone(c, o, t, 260, 0.18, { type: 'triangle', vol: 0.35, glide: 180 }),
    // a camera: click-clack
    shutter: (c, o, t) => {
      Sfx.tone(c, o, t, 2200, 0.025, { type: 'square', vol: 0.3 });
      Sfx.tone(c, o, t + 0.07, 1300, 0.045, { type: 'square', vol: 0.26 });
    },
  },
};
