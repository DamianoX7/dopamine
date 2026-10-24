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
      }, fn.ms || 2500); // (a sound that goes on longer says so)
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
    // a knock at the door: two soft raps on wood
    knock: (c, o, t) => {
      [0, 0.17].forEach((d) => {
        Sfx.tone(c, o, t + d, 190, 0.09, { type: 'triangle', vol: 0.9, glide: 120 });
        Sfx.tone(c, o, t + d, 420, 0.03, { type: 'square', vol: 0.12 });
      });
    },
    // a camera: click-clack
    shutter: (c, o, t) => {
      Sfx.tone(c, o, t, 2200, 0.025, { type: 'square', vol: 0.3 });
      Sfx.tone(c, o, t + 0.07, 1300, 0.045, { type: 'square', vol: 0.26 });
    },
    // a star of ours coming out in the night sky (js/stars.js): a soft bell — while they keep coming, each a step further
    // up the scale, like a music box
    twinkle: (c, o, t) => {
      const now = performance.now();
      Sfx.twinkles = now - (Sfx.twinkleAt || 0) < 1500 ? (Sfx.twinkles || 0) + 1 : 0;
      Sfx.twinkleAt = now;
      const f = [1046.5, 1174.7, 1318.5, 1568, 1760][Sfx.twinkles % 5] * (Sfx.twinkles % 10 < 5 ? 1 : 2);
      Sfx.tone(c, o, t, f, 0.7, { vol: 0.2, attack: 0.004 });
      Sfx.tone(c, o, t, f * 3, 0.25, { vol: 0.03 });
    },
    // the foxes' song to the full moon (js/moon.js): long "아우우—"s, one coming in after another, wavering, and down at the end
    howl: Object.assign(
      (c, o, t) => {
        [392, 494, 587].forEach((f, i) => {
          const at = t + 0.35 + 0.15 * i;
          const end = at + 3.3 - 0.15 * i;
          const voice = c.createGain();
          const soft = c.createBiquadFilter();
          soft.type = 'lowpass';
          soft.frequency.value = 1700;
          voice.gain.setValueAtTime(0.0001, at);
          voice.gain.exponentialRampToValueAtTime(0.3, at + 0.3);
          voice.gain.setValueAtTime(0.3, end - 0.7);
          voice.gain.exponentialRampToValueAtTime(0.0001, end);
          const wobble = c.createOscillator();
          const depth = c.createGain();
          wobble.frequency.value = 5.2 + i * 0.4;
          depth.gain.value = f * 0.012;
          wobble.connect(depth);
          [['sine', 1, 1], ['triangle', 2, 0.16]].forEach(([type, k, vol]) => {
            const osc = c.createOscillator();
            const g = c.createGain();
            osc.type = type;
            osc.frequency.setValueAtTime(f * k * 0.72, at);
            osc.frequency.exponentialRampToValueAtTime(f * k, at + 0.45);
            osc.frequency.linearRampToValueAtTime(f * k * 1.06, at + 1.6);
            osc.frequency.linearRampToValueAtTime(f * k * 1.02, end - 0.6);
            osc.frequency.exponentialRampToValueAtTime(f * k * 0.68, end);
            depth.connect(osc.frequency);
            g.gain.value = vol;
            osc.connect(g);
            g.connect(soft);
            osc.start(at);
            osc.stop(end + 0.05);
          });
          soft.connect(voice);
          voice.connect(o);
          wobble.start(at);
          wobble.stop(end + 0.05);
        });
      },
      { ms: 4800 }
    ),
  },
};
