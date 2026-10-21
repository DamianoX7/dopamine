'use strict';
/* ==================================================================
   💬 Talk — a conversation in a window along the bottom of the screen,
   the way the neighbours talk in Animal Crossing: a name tag, the
   words typed out a letter at a time, a tap for the next page, now
   and then something to answer.

   The speech bubbles over the foxes' heads are another thing, and
   stay what they were: a word in passing. This is for when somebody
   has something to say to her: Lorelei's present (js/present.js), her
   first hello (js/meet.js), the chats she strikes up (js/chat.js).

     const said = await Talk.run([
       '안녕!',                                            // a page
       { text: '줄 게 있어.', cue: () => … },             // cue: as the page comes up
       { text: '받을래?', ask: ['응!', '뭔데?'] },         // something to answer: its number goes to what follows
       (answer) => (answer ? '후후, 궁금하지?' : '좋아!'), // …a page may be made of the last answer
       { rest: 1600, cue: () => … },                       // the window makes way for what happens meanwhile
       '…',
     ], { who: '로렐라이', speaking: (on) => … });         // speaking: told when the words begin to come, and when they are all there

   Nothing closes it but its end: it is a handful of pages. `said` is
   the answers she gave, in order — or null, if it was not told to
   the end after all (the app took everything off the screen).
   ================================================================== */

const TALK_SPEED = 26; //  letters a second
const TALK_PAUSE = { ',': 5, '.': 9, '!': 9, '?': 9, '…': 11, '~': 4, '\n': 6 }; // …and how many letters' worth of time to wait after these

const Talk = {
  ov: null, // the conversation that is on (one at a time)

  /** Is somebody talking to her right now? */
  get on() {
    return !!this.ov;
  },

  run(pages, { who = '', tint = '', voice = 1, speaking = null } = {}) {
    if (this.ov) return Promise.resolve(null);
    return new Promise((resolve) => {
      const ov = (this.ov = UI.open(
        `<div class="talk" data-talk>
          <div class="talk-ask" data-talk-ask role="group" aria-label="대답" hidden></div>
          <button class="talk-box" data-talk-next data-sfx="none">
            ${who ? `<span class="talk-name" ${tint ? `style="--talk-tint:${esc(tint)}"` : ''}>${esc(who)}</span>` : ''}
            <span class="talk-text" data-talk-text aria-hidden="true"></span>
            <span class="sr-only" data-talk-say aria-live="polite"></span>
            <i class="talk-more" data-talk-more aria-hidden="true"></i>
          </button>
        </div>`,
        { cls: 'is-talk', locked: true, noHistory: true, label: who ? `${who}의 이야기` : '이야기', onClose: () => finish(false) }
      ));
      const root = $('[data-talk]', ov.panel);
      const textEl = $('[data-talk-text]', root);
      const sayEl = $('[data-talk-say]', root);
      const askEl = $('[data-talk-ask]', root);
      const said = [];
      let i = -1; //         the page that shows
      let page = null; //    …as it was made: { text, ask, cue, rest }
      let typing = 0; //     the timer that types it out
      let shown = 0; //      how many letters of it show
      let letters = []; //   …of these
      let resting = 0; //    the window has made way (a timer)
      let answer = null; //  the last answer she gave
      let done = false;
      const speak = (on) => {
        try {
          if (speaking) speaking(on);
        } catch (e) {
          console.error(e);
        }
      };

      /* It is over: told to the end — or (`told` false) closed from outside, by an app that is going somewhere else. */
      const finish = (told = true) => {
        if (done) return;
        done = true;
        clearTimeout(typing);
        clearTimeout(resting);
        speak(false);
        ov.el.removeEventListener('click', tap);
        document.removeEventListener('keydown', key, true);
        this.ov = null;
        UI.close(ov).then(() => resolve(told ? said : null));
      };

      /* All of the page shows: what is there to do next? */
      const settled = () => {
        clearTimeout(typing);
        typing = 0;
        shown = letters.length;
        textEl.textContent = page.text;
        speak(false);
        if (page.ask && page.ask.length) {
          askEl.innerHTML = page.ask.map((label, n) => `<button class="talk-pick" data-talk-pick="${n}" data-sfx="none">${esc(label)}</button>`).join('');
          askEl.hidden = false;
          root.classList.add('is-asking');
          const first = $('[data-talk-pick]', askEl);
          if (first) first.focus({ preventScroll: true });
        } else root.classList.add('is-waiting');
      };

      const type = () => {
        if (shown >= letters.length) return void settled();
        const ch = letters[shown++];
        textEl.textContent = letters.slice(0, shown).join('');
        if (shown % 2 && /\S/.test(ch)) Talk.blip(ch, voice);
        typing = setTimeout(type, (1000 / TALK_SPEED) * (1 + (TALK_PAUSE[ch] || 0)));
      };

      /* The next page — or the end. */
      const next = () => {
        i += 1;
        if (i >= pages.length) return void finish();
        let p = pages[i];
        if (typeof p === 'function') p = p(answer, said);
        if (p == null || p === false) return void next(); // (a page that has nothing to say this time)
        page = typeof p === 'string' ? { text: p } : p;
        root.classList.remove('is-waiting', 'is-asking');
        askEl.hidden = true;
        askEl.innerHTML = '';
        try {
          if (page.cue) page.cue(answer);
        } catch (e) {
          console.error(e);
        }
        if (page.rest) {
          // nothing is said for a moment: the window goes, so that what happens can be seen
          root.classList.add('is-away');
          resting = setTimeout(() => {
            root.classList.remove('is-away');
            next();
          }, page.rest);
          return;
        }
        letters = Array.from(String(page.text || ''));
        shown = 0;
        textEl.textContent = '';
        sayEl.textContent = page.text || '';
        if (reducedMotion()) settled();
        else {
          speak(true);
          typing = setTimeout(type, 120);
        }
      };

      /* A tap anywhere: the rest of the page at once — or, when it is all there, the next one. */
      const advance = () => {
        if (done || root.classList.contains('is-away') || !page) return;
        if (typing) return void settled();
        if (page.ask && page.ask.length) return; // (she has to pick an answer)
        Sfx.play('tap');
        next();
      };
      const tap = (e) => {
        const pick = e.target.closest('[data-talk-pick]');
        if (pick) {
          answer = +pick.dataset.talkPick;
          said.push(answer);
          Sfx.play('pop');
          ov.panel.focus({ preventScroll: true });
          return void next();
        }
        advance();
      };
      const key = (e) => {
        if (UI.top() !== ov) return;
        if (e.key === 'Escape') e.stopPropagation(); // (it is not something to be dismissed)
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('[data-talk-pick]')) {
          e.preventDefault();
          advance();
        }
      };
      ov.el.addEventListener('click', tap);
      document.addEventListener('keydown', key, true);
      next();
    });
  },

  /* The sound of somebody talking: a soft blip for every other letter, a little higher or lower for each. */
  blip(ch, voice = 1) {
    if (!State.settings.soundEnabled || (typeof CoverHost !== 'undefined' && CoverHost.quiet)) return;
    const ctx = AudioSys.resume();
    if (!ctx) return;
    try {
      const out = ctx.createGain();
      out.gain.value = 0.11;
      out.connect(ctx.destination);
      const step = [0, 2, 4, 7, 9][ch.codePointAt(0) % 5]; // (five notes that go together, whichever comes)
      Sfx.tone(ctx, out, ctx.currentTime + 0.005, 560 * voice * Math.pow(2, step / 12), 0.055, { type: 'triangle', vol: 0.4, attack: 0.004 });
      setTimeout(() => {
        try {
          out.disconnect();
        } catch (e) {
          /* ignore */
        }
      }, 400);
    } catch (e) {
      /* sound is optional */
    }
  },
};
