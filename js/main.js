'use strict';
/* ==================================================================
   Boot: theme & late-night mode, onboarding, global event wiring,
   periodic checks and friendly error handling.
   ================================================================== */

const Theme = {
  lateNight: null,
  apply() {
    const s = State.settings;
    document.body.dataset.theme = s.theme || 'pink';
    const ln = s.lateNight === 'on' || (s.lateNight === 'auto' && isLateNightHour());
    document.body.classList.toggle('late-night', ln);
    document.body.classList.toggle('reduce-motion', !!s.reduceMotion);
    const colors = { pink: '#ffe3f1', lavender: '#efe8ff', peach: '#fff0e6', night: '#1b1036' };
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', ln ? '#1b1036' : colors[s.theme] || colors.pink);
    if (ln !== this.lateNight) {
      const changed = this.lateNight !== null;
      this.lateNight = ln;
      Decor.stars(ln);
      if (changed && Router.is('home')) Router.refresh();
    }
    FoxHost.sync(); // night falls in the fox's world too, and reduced motion calms it
  },
};

const Decor = {
  init() {
    const host = $('#bg .floaties');
    const items = ['💗', '✨', '💕', '⭐', '🎵', '💖', '✨', '🎶'];
    host.innerHTML = items
      .map(
        (e, i) =>
          `<span style="left:${4 + i * 12 + Math.random() * 5}%;animation-delay:${-i * 2.6}s;animation-duration:${17 + (i % 4) * 3}s;font-size:${13 + (i % 3) * 5}px">${e}</span>`
      )
      .join('');
  },
  stars(on) {
    const host = $('#bg .stars');
    if (!on) {
      host.innerHTML = '';
      return;
    }
    if (host.childElementCount) return;
    let html = '';
    for (let i = 0; i < 46; i++) {
      const size = (1 + Math.random() * 2.2).toFixed(1);
      html += `<i style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 75).toFixed(1)}%;width:${size}px;height:${size}px;animation-delay:${(-Math.random() * 6).toFixed(2)}s"></i>`;
    }
    host.innerHTML = html;
  },
};

/* ------------------------------------------------------------------
   First visit
   ------------------------------------------------------------------ */
const Onboarding = {
  show() {
    const shut = Opening.shut(); // (the studio and the foxes are not open yet: she names her fox when she first meets it)
    const face = shut ? '💗' : Pet.avatarHtml('ob-fox');
    const ov = UI.open(
      `<div class="onboard">
        <div class="ob-step" data-ob="1">
          <div class="ob-hero" aria-hidden="true">💗</div>
          <h1>도파민 월드에 온 걸 환영해요</h1>
          <p class="ob-sub">오직 너만을 위한 작은 세상.</p>
          <ul class="ob-list">
            <li><span aria-hidden="true">🎤</span> 노래하고</li>
            <li><span aria-hidden="true">🎮</span> 놀고</li>
            <li><span aria-hidden="true">💿</span> 나만의 커버를 만들고</li>
            <li><span aria-hidden="true">💌</span> 깜짝 메시지도 받아요</li>
            <li><span aria-hidden="true">🦊</span> 여우도 키워요</li>
          </ul>
          <button class="btn primary huge" data-ob-next>시작하기 ✨</button>
        </div>
        <form class="ob-step" data-ob="2" hidden>
          <div class="ob-hero" aria-hidden="true">${face}</div>
          <h1><label for="ob-nick">뭐라고 불러 줄까요?</label></h1>
          <input id="ob-nick" class="ob-input" maxlength="24" placeholder="닉네임을 입력하세요" value="${esc(CFG.suggestedNickname || '')}" autocomplete="nickname">
          <button class="btn primary huge" type="submit">${shut ? '시작' : '다음'}</button>
        </form>
        <form class="ob-step" data-ob="3" hidden>
          <div class="ob-hero" aria-hidden="true">${Pet.avatarHtml('ob-fox')}</div>
          <h1><label for="ob-fox-name">함께 지낼 여우예요</label></h1>
          <p class="ob-sub">이름을 지어 주세요. 나중에 언제든 바꿀 수 있어요.</p>
          <input id="ob-fox-name" class="ob-input" maxlength="12" placeholder="${esc(State.pet.name)}" autocomplete="off">
          <button class="btn primary huge" type="submit">시작</button>
        </form>
      </div>`,
      { full: true, locked: true, cls: 'is-onboard', label: '도파민 월드에 온 걸 환영해요' }
    );
    if (!shut) {
      Pet.fillAvatars(ov.panel);
      Pet.wantPortrait(true); // so that the fox she is about to name is her own, not an emoji
    }
    const s1 = $('[data-ob="1"]', ov.panel);
    const s2 = $('[data-ob="2"]', ov.panel);
    const s3 = $('[data-ob="3"]', ov.panel);
    $('[data-ob-next]', ov.panel).addEventListener('click', () => {
      Sfx.play('pop');
      s1.hidden = true;
      s2.hidden = false;
      setTimeout(() => $('#ob-nick').focus(), 60);
    });
    s2.addEventListener('submit', (e) => {
      e.preventDefault();
      if (shut) return void finish(false);
      Sfx.play('pop');
      s2.hidden = true;
      s3.hidden = false;
      setTimeout(() => $('#ob-fox-name').focus(), 60);
    });
    s3.addEventListener('submit', (e) => {
      e.preventDefault();
      finish(true);
    });
    const finish = (withFox) => {
      const nick = $('#ob-nick').value.trim().slice(0, 24) || '스타';
      const pet = State.pet;
      if (withFox) {
        pet.name = $('#ob-fox-name').value.trim().slice(0, 12) || pet.name;
        pet.names[pet.species] = pet.name;
        pet.named = true;
      }
      State.user.nickname = nick;
      State.user.artistName = nick;
      State.onboarded = true;
      Game.reward({ dopamine: 100, coins: 30 });
      UI.lastDopa = 0;
      Store.saveNow();
      UI.close(ov).then(() => {
        Router.render();
        UI.celebrate({
          emoji: '💗',
          title: `안녕, ${nick}!`,
          subtitle: '작은 환영 선물이에요.',
          rewards: { dopamine: 100, coins: 30 },
          message: CFG.welcomeMessage || '',
          buttons: Opening.shut()
            ? [{ label: '🎮 오락실 가 보기', primary: true, onClick: () => Router.go('#/arcade') }, { label: '둘러보기' }]
            : [{ label: '🎤 노래 부르러 가기', primary: true, onClick: () => Router.go('#/studio') }, { label: '둘러보기' }],
        });
        Opening.watch();
      });
    };
  },
};

/* ------------------------------------------------------------------
   Global event wiring (data-action / data-input / data-change)
   ------------------------------------------------------------------ */
const QUIET_ACTIONS = new Set(['pet-pet', 'catch-golden', 'shop-tap', 'shop-buy', 'toggle-sound', 'logo-tap']);

function onError(err) {
  console.error(err);
  UI.softError();
}

document.addEventListener('click', (e) => {
  if (e.target.closest('[data-ov-dismiss]')) {
    UI.dismissTop();
    return;
  }
  const el = e.target.closest('[data-action]');
  if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return;
  const name = el.dataset.action;
  const fn = Actions[name];
  if (!fn) {
    console.warn('[Dopamine World] no handler for action', name);
    return;
  }
  if (el.tagName === 'A') e.preventDefault();
  if (el.dataset.sfx !== 'none' && !QUIET_ACTIONS.has(name)) Sfx.play('tap');
  if (SHUT_ACTIONS.has(name) && Opening.shut()) return void Opening.tell(); // (a room that opens on a day of its own: js/opening.js)
  try {
    const r = fn(el, e);
    if (r && typeof r.catch === 'function') r.catch(onError);
  } catch (err) {
    onError(err);
  }
});

document.addEventListener('input', (e) => {
  const el = e.target.closest('[data-input]');
  const fn = el && Inputs[el.dataset.input];
  if (!fn) return;
  try {
    fn(el, e);
  } catch (err) {
    onError(err);
  }
});

document.addEventListener('change', (e) => {
  const el = e.target.closest('[data-change]');
  const fn = el && Changes[el.dataset.change];
  if (!fn) return;
  try {
    fn(el, e);
  } catch (err) {
    onError(err);
  }
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') UI.dismissTop();
});

window.addEventListener('popstate', () => UI.handlePop());

window.addEventListener('error', (e) => {
  if (e.filename && location.protocol !== 'file:' && !e.filename.startsWith(location.origin)) return;
  onError(e.error || e.message);
});
window.addEventListener('unhandledrejection', (e) => onError(e.reason));

/* The logo: goes home — and hides a secret for curious fingers. */
const Secret = { taps: 0, last: 0 };
Actions['logo-tap'] = (el) => {
  const now = Date.now();
  Secret.taps = now - Secret.last < 1400 ? Secret.taps + 1 : 1;
  Secret.last = now;
  if (Secret.taps >= 5) {
    Secret.taps = 0;
    if (State.daily.secretFound) {
      UI.toast('오늘의 비밀은 이미 찾았어요 🔮 내일 또 와요!', { icon: '🔮' });
      return;
    }
    State.daily.secretFound = true;
    Game.secret(el);
    const r = Messages.open();
    UI.celebrate({
      emoji: '🔮',
      title: '비밀 발견!',
      subtitle: '하트를 다섯 번 눌렀네요. 호기심쟁이 💗',
      rewards: { dopamine: 50, coins: 10 },
      message: r ? r.msg.text : '',
      sound: 'rare',
    });
    return;
  }
  Sfx.play('tap');
  if (!Router.is('home')) Router.go('#/home');
};

/* ------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------ */
async function boot() {
  if (Gate.need) return void Gate.open(); // the published site: nothing starts before she has logged in (js/gate.js)
  AudioSys.installUnlock();
  Decor.init();
  Theme.apply();

  await Promise.race([DB.open(), sleep(3000)]);
  if (await Store.restoreFromMirror()) console.info('[Dopamine World] metadata restored from the IndexedDB backup');
  await Sync.start(); // on server.py: the progress saved from her other device
  if (Sync.status === 'locked') {
    UI.banner('sync', '🔑 다른 기기와 같은 내용을 보려면 비밀번호가 필요해요. <button class="btn soft small" data-action="sync-unlock">입력하기</button>');
  }
  if (!DB.isPersistent()) {
    UI.banner('storage', '⚠️ 이 브라우저 모드에서는 저장 공간을 쓸 수 없어요 — 페이지를 닫으면 녹음이 사라져요. 간직하고 싶은 건 내려받아 두세요.');
  }

  Theme.apply();
  Game.ensureDaily();
  Pet.tick();
  UI.updateHud();
  UI.lastDopa = State.dopamine.points;
  if (Cloud.writer) {
    // his login (js/gate.js): he has come to write her a letter — and nothing else he does here reaches her
    if (!behindDoor()) history.replaceState(null, '', '#/me/write');
    UI.banner('writer', '✍️ 편지 쓰는 로그인으로 들어왔어요. 보낸 편지는 그녀의 기기로 가고, 그 밖에 여기서 하는 건 이 기기에만 남아요.');
  }
  Router.init();
  Opening.watch(); // the rooms that open on a day of their own: how their doors stand, and the moment they open
  Post.start(); // letters he sent her that have come since she was last here
  Present.wake(); // …and a day of theirs on which Lorelei has something for her
  if (!State.onboarded && !Cloud.writer) Onboarding.show();

  const newDay = () => {
    if (!Game.ensureDaily()) return;
    Present.wake();
    if (Router.is('home')) Router.refresh();
  };
  setInterval(() => {
    Theme.apply();
    Pet.tick();
    newDay();
  }, 60000);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      Store.save.flush();
      return;
    }
    Theme.apply();
    Pet.tick();
    newDay();
    Opening.watch();
  });
  window.addEventListener('pagehide', () => Store.saveNow());
}

boot().catch(onError);
