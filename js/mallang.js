'use strict';
/* ==================================================================
   🍡 말랑 놀이터 — squishies (말랑이) to press and pull, and wax balls
   (왁뿌볼) to crack, on the whole screen. Opened from the arcade.

   The toy itself is in js/mallang (ES modules, fetched when it is
   first opened); this is the app's side of it: the screen it is shown
   on, the sound switch, the room's colours (the theme's — see
   mallang.css) and which toy she had out last.
   ================================================================== */

const Mallang = {
  api: null, //     set by js/mallang/playground.js
  loading: null,
  ov: null,
  play: null, //    the playground that is open
  themeWatch: null,

  load() {
    if (!this.loading) {
      this.loading = import(new URL('js/mallang/playground.js', document.baseURI).href).then(
        () => true,
        (err) => {
          console.error('[Mallang] the playground could not be loaded', err);
          this.loading = null; // a dropped connection: the next tap tries again
          return false;
        }
      );
    }
    return this.loading;
  },

  register(api) {
    this.api = api;
  },

  html() {
    const on = State.settings.soundEnabled;
    return `<div class="mallang" data-mallang>
      <canvas class="mg-stage" data-mg="stage" tabindex="0" aria-label="말랑이를 만지는 곳. 누르고 당겨 보세요."></canvas>
      <div class="mg-wait" data-mg="wait" aria-hidden="true"><span>🍡</span></div>
      <div class="mg-ui">
        <header class="mg-top">
          <button class="mg-btn" data-action="close-overlay" aria-label="나가기">‹</button>
          <h2 class="mg-title"><span aria-hidden="true">🍡</span> 말랑 놀이터<small>말랑이 · 왁뿌볼</small></h2>
          <button class="mg-btn" data-action="mallang-sound" data-sfx="none" data-mg="sound" aria-label="${on ? '소리 켜짐' : '소리 꺼짐'}" aria-pressed="${on}">${on ? '🔊' : '🔇'}</button>
          ${FoxRoom.canFullscreen() ? '<button class="mg-btn" data-action="fox-full" aria-label="전체 화면 켜기/끄기">⛶</button>' : ''}
        </header>
        <p class="mg-hint" data-mg="hint" role="status"></p>
        <section class="mg-dock" data-mg="dock" aria-label="장난감 고르기">
          <div class="mg-row">
            <div class="seg mg-tabs" role="tablist" aria-label="장난감 종류">
              <button class="seg-btn" type="button" role="tab" data-mode="soft" aria-selected="true">말랑이</button>
              <button class="seg-btn" type="button" role="tab" data-mode="wax" aria-selected="false">왁뿌볼</button>
            </div>
            <span class="mg-gap"></span>
            <button class="btn soft small" type="button" data-mg="recoat" hidden>다시 코팅</button>
            <button class="btn primary small mg-grip" type="button" data-mg="grip">꽉 쥐기</button>
          </div>
          <div class="mg-meter" data-mg="meter" hidden><span data-mg="meterText">왁스 100%</span><i><b data-mg="meterBar"></b></i></div>
          <div class="mg-chips" data-mg="chips"></div>
        </section>
      </div>
      <p class="mg-sorry" data-mg="sorry" hidden>이 브라우저에서는 말랑이를 그릴 수 없어요.<br>크롬이나 사파리 최신 버전으로 열어 주세요.
        <button class="btn soft" data-action="close-overlay">오락실로</button></p>
    </div>`;
  },

  async open() {
    if (this.ov) return;
    const ov = (this.ov = UI.open(this.html(), { full: true, cls: 'is-mallang', label: '말랑 놀이터', onClose: () => this.closed() }));
    const root = $('[data-mallang]', ov.panel);
    const ok = await this.load();
    if (this.ov !== ov) return; // left while loading
    try {
      if (!ok || !this.api) throw new Error('no playground');
      this.play = this.api.start(root, this.host(root));
    } catch (err) {
      console.error('[Mallang]', err);
      $('[data-mg="sorry"]', root).hidden = false;
      $('.mg-ui', root).hidden = true;
      $('[data-mg="wait"]', root).hidden = true;
      return;
    }
    root.classList.add('is-ready');
    // night falls on the minute, and the theme can be changed from another device
    this.themeWatch = new MutationObserver(() => this.play && this.play.retint());
    this.themeWatch.observe(document.body, { attributes: true, attributeFilter: ['class', 'data-theme'] });
    if (new URLSearchParams(location.search).has('debug')) window.mallang = this.play; // index.html?debug=1
  },

  /* What the playground asks of the app. */
  host(root) {
    return {
      audio: () => AudioSys.resume(),
      soundOn: () => State.settings.soundEnabled,
      kept: () => State.mallang,
      keep: (o) => {
        State.mallang = o;
        Store.save();
      },
      // the room the toy stands in: the theme's wall and table (mallang.css), and how much of the toy's own colour is let into them
      room: () => {
        const css = getComputedStyle(root);
        const hex = (name, or) => (/^#[0-9a-f]{6}$/i.test(css.getPropertyValue(name).trim()) ? css.getPropertyValue(name).trim() : or);
        const own = parseFloat(css.getPropertyValue('--mg-own'));
        return { wall: hex('--mg-wall', '#ffe6f2'), floor: hex('--mg-floor', '#ffd3e6'), own: Number.isFinite(own) ? own : 0.3 };
      },
      active: () => UI.top() === this.ov,
    };
  },

  closed() {
    this.ov = null;
    if (this.themeWatch) this.themeWatch.disconnect();
    this.themeWatch = null;
    if (this.play) this.play.destroy();
    this.play = null;
    FoxRoom.leaveFullscreen();
  },
};

window.Mallang = Mallang; // the modules reach the app through it

Object.assign(Actions, {
  'mallang-open': () => Mallang.open(),
  /* The app's one sound switch, from inside the playground. */
  'mallang-sound': (el) => {
    const on = (State.settings.soundEnabled = !State.settings.soundEnabled);
    Store.save();
    UI.updateHud();
    el.textContent = on ? '🔊' : '🔇';
    el.setAttribute('aria-label', on ? '소리 켜짐' : '소리 꺼짐');
    el.setAttribute('aria-pressed', String(on));
    if (Mallang.play) Mallang.play.setSound(on);
  },
});
