'use strict';
/* ==================================================================
   🏠 Home — dopamine counter, the big SING button, continue
   listening, latest covers, today's challenge, a letter & the pet.
   ================================================================== */

function coverCardHtml(c, opts = {}) {
  return `<article class="cover-card ${c.rare ? 'is-rare' : ''}">
    <button class="cover-art-btn" data-action="open-cover" data-id="${c.id}" aria-label="${esc(c.title)} 열기">
      ${artImg(c)}
      ${c.rare ? '<span class="badge rare">✨ 레어</span>' : ''}
    </button>
    <div class="cover-info">
      <h3 class="cover-title">${esc(c.title)}</h3>
      <p class="cover-artist">${esc(c.coverArtist || State.user.nickname)}</p>
      <div class="cover-bottom">
        <button class="mini-play" data-action="play-cover" data-id="${c.id}" ${opts.queue ? `data-queue="${opts.queue}"` : ''} aria-label="${esc(c.title)} 재생"><span data-play-icon>▶</span> ${fmtTime(c.duration)}</button>
        <span class="cover-date">${fmtDate(c.releasedAt)}</span>
      </div>
    </div>
  </article>`;
}

Views.home = {
  golden: false,

  render(params, opts = {}) {
    const u = State.user;
    const d = State.dopamine;
    const need = Game.xpToNext(d.level);
    const title = Game.title();
    const streak = Game.displayStreak();
    const late = document.body.classList.contains('late-night');
    const shut = Opening.shut(); // the studio and the foxes open on a day of their own (js/opening.js): until then, one card says so
    const cont = shut ? null : Music.continueListening();
    const latest = Music.released().slice(0, 3);
    if (!opts.refresh) this.golden = !State.daily.golden && Math.random() < 0.14;
    if (State.daily.golden) this.golden = false;

    return `<section class="home">
      <div class="hello">
        <p class="eyebrow">${late ? '🌙 도파민 월드의 깊은 밤' : '💗 도파민 월드'}</p>
        <h1 class="hello-title">어서 와, <span class="name">${esc(u.nickname || '너')}</span>!</h1>
      </div>

      ${Days.cardHtml()}

      ${Post.cardHtml()}

      ${Diary.cardHtml()}

      ${Moon.cardHtml()}

      ${Dream.cardHtml()}

      <div class="card dopa-card">
        <div class="dopa-top">
          <div>
            <div class="stat-label">✨ 지금 도파민</div>
            <div class="hero-num" data-dopa>${fmtNum(d.points)}</div>
          </div>
          <div class="title-badge" title="나의 아티스트 칭호">${title.emoji} ${esc(title.name)}</div>
        </div>
        <div class="xp-row">
          <span class="lv">Lv ${d.level}</span>
          ${meterHtml(d.xp, need, '다음 레벨까지 XP')}
          <span class="xp-num">${d.xp}/${need} XP</span>
        </div>
        <div class="dopa-chips">
          <span class="chip">🪙 <b data-live="coins">${fmtNum(d.coins)}</b> 코인</span>
          ${shut ? '' : `<span class="chip ${Game.sangToday() ? 'chip-hot' : ''}">🔥 ${streak ? `${streak}일 연속 노래 중` : '노래 연속 기록 시작하기'}</span>`}
        </div>
      </div>

      ${
        shut
          ? Opening.homeHtml()
          : `<button class="sing-btn" data-action="sing">
        <span class="sing-mic" aria-hidden="true">🎤</span>
        <span class="sing-label">노래 부르기</span>
        <span class="sing-sub">따라 부르고 · 믹스하고 · 나만의 커버로</span>
      </button>`
      }

      <div class="quick-row">
        ${shut ? '<button class="quick" data-action="nav" data-to="#/arcade"><span aria-hidden="true">🎮</span> 오락실 가기</button>' : '<button class="quick" data-action="surprise"><span aria-hidden="true">🎲</span> 노래 골라줘</button>'}
        <button class="quick" data-action="open-message"><span aria-hidden="true">💌</span> 메시지 열기</button>
      </div>

      ${cont ? this.continueHtml(cont) : ''}

      ${Radio.cardHtml()}

      ${
        shut
          ? ''
          : `<section class="section">
        <div class="section-head">
          <h2 class="section-title">💿 최근 내 커버</h2>
          ${latest.length ? '<a class="link" href="#/covers">전체 보기</a>' : ''}
        </div>
        ${
          latest.length
            ? `<div class="cover-row">${latest.map((c) => coverCardHtml(c)).join('')}</div>`
            : `<div class="card">${emptyState('💿', '여기에 내 커버가 모여요', '첫 노래를 부르면 나만의 발매곡이 돼요.', '<button class="btn primary" data-action="sing">🎤 첫 노래 부르기</button>')}</div>`
        }
      </section>`
      }

      ${this.challengeHtml()}

      <section class="card letter-card">
        <div class="envelope" aria-hidden="true">💌</div>
        <div class="letter-card-text">
          <h2 class="card-title">남자친구의 편지</h2>
          <p class="hint">메시지 ${Messages.all().length}개 중 ${Messages.collected().length}개 발견</p>
        </div>
        <button class="btn primary" data-action="open-message">열기</button>
      </section>

      ${shut ? '' : `<section class="card pet-card" data-pet-card>${Pet.cardHtml()}</section>`}

      ${this.golden ? '<button class="golden-heart" data-action="catch-golden" data-sfx="none" aria-label="황금 하트를 잡아요!">💛</button>' : ''}
    </section>`;
  },

  continueHtml(c) {
    return `<section class="section">
      <h2 class="section-title">🎧 이어서 듣기</h2>
      <div class="card continue-card">
        <button class="continue-main" data-action="open-cover" data-id="${c.id}" aria-label="${esc(c.title)} 열기">
          ${artImg(c, 'continue-art')}
          <span class="continue-text"><b>${esc(c.title)}</b>
            <small>${esc(c.coverArtist || State.user.nickname)} · ${fmtTime(c.duration)}</small></span>
        </button>
        <button class="play-fab" data-action="play-cover" data-id="${c.id}" aria-label="${esc(c.title)} 재생"><span data-play-icon>▶</span></button>
      </div>
    </section>`;
  },

  challengeHtml() {
    Game.ensureDaily();
    const d = State.daily;
    const ch = Game.challenge();
    const all = Game.missionsAllDone();
    return `<section class="card challenge-card ${d.challengeDone ? 'is-done' : ''} ${ch ? '' : 'no-challenge'}">
      ${
        ch
          ? `<div class="challenge-top">
        <span class="eyebrow">🎤 오늘의 챌린지</span>
        ${d.challengeDone ? '<span class="chip chip-done">✓ 완료</span>' : '<span class="chip">+30 ✨ +10 🪙</span>'}
      </div>`
          : ''
      }
      ${ch ? `<p class="challenge-text"><span aria-hidden="true">${ch.emoji}</span> ${esc(ch.text)}</p>
        <p class="hint">${esc(ch.hint)}${ch.target ? ` (${Math.min(d.challengeProgress, ch.target)}/${ch.target})` : ''}</p>` : ''}
      ${!d.challengeDone && ch && ch.on !== 'listen' ? '<button class="btn soft small" data-action="sing">🎤 지금 도전</button>' : ''}
      <div class="missions">
        <h3>오늘의 미션</h3>
        <ul>${d.missions
          .map((m) => {
            const def = MISSIONS.find((x) => x.id === m.id);
            if (!def) return '';
            return `<li class="${m.done ? 'done' : ''}">
              <span class="m-check" aria-hidden="true">${m.done ? '✓' : ''}</span>
              <span class="m-text">${def.emoji} ${esc(missionText(def))}${m.done ? '<span class="sr-only"> (완료)</span>' : ''}</span>
              <span class="m-prog">${Math.min(m.progress, def.target)}/${def.target}</span></li>`;
          })
          .join('')}</ul>
        ${
          all
            ? d.bonusClaimed
              ? '<p class="hint">🎁 보너스를 받았어요 — 내일 또 만나요!</p>'
              : '<button class="btn primary wide" data-action="claim-daily">🎁 오늘의 보너스 받기</button>'
            : `<p class="hint">${d.missions.length === 3 ? '세 개를' : '미션을'} 모두 끝내면 보너스 선물이 있어요 🎁</p>`
        }
      </div>
    </section>`;
  },

  mount(root) {
    const el = $('[data-dopa]', root);
    const from = UI.lastDopa == null ? State.dopamine.points : UI.lastDopa;
    UI.countUp(el, from, State.dopamine.points);
    UI.lastDopa = State.dopamine.points;
    const gh = $('.golden-heart', root);
    if (gh) {
      gh.style.left = `${10 + Math.random() * 70}%`;
      gh.style.top = `${30 + Math.random() * 40}%`;
    }
    if (!Opening.shut()) Pet.wantPortrait();
    Days.hail();
    Diary.hail();
    Moon.hail();
    Dream.hail();
  },
};

/* ------------------------------------------------------------------
   🎲 Surprise song: one of the songs she already covered, or a fun prompt.
   ------------------------------------------------------------------ */
const Surprise = {
  PROMPTS: [
    '고등학교 때 좋아했던 노래',
    '노래방 18번',
    '영화나 드라마에 나온 노래',
    '우리가 떠오르는 노래 💗',
    '팝송 한 곡',
    '후렴만 아는 노래',
    '요즘 머릿속에 맴도는 노래',
    '어릴 때 듣던 노래',
    '비 오는 날 어울리는 노래',
    '새벽 3시에 부르고 싶은 노래',
  ],

  roll() {
    const songs = Music.songs();
    const useSong = songs.length >= 2 ? Math.random() < 0.85 : songs.length === 1 ? Math.random() < 0.5 : false;
    if (useSong) {
      const s = pick(songs);
      return { title: s.title, artist: s.originalArtist };
    }
    return { prompt: pick(this.PROMPTS) };
  },

  open() {
    let result = this.roll();
    const ov = UI.open(
      `<div class="surprise">
        <div class="dice" aria-hidden="true">🎲</div>
        <p class="eyebrow">오늘의 미션</p>
        <p class="surprise-lead">이 노래를 불러요</p>
        <h2 class="surprise-song" data-roll aria-live="polite">…</h2>
        <p class="surprise-artist" data-roll-artist></p>
        <p class="surprise-lead">준비됐나요?</p>
        <button class="btn primary huge" data-sing>🎤 부르러 가기</button>
        <button class="btn ghost" data-reroll>🎲 다시 굴리기</button>
      </div>`,
      { cls: 'is-dialog', label: '노래 골라줘' }
    );
    const songEl = $('[data-roll]', ov.panel);
    const artistEl = $('[data-roll-artist]', ov.panel);
    const show = (r) => {
      songEl.textContent = r.prompt ? r.prompt : r.title.toUpperCase();
      songEl.classList.toggle('is-prompt', !!r.prompt);
      artistEl.textContent = r.prompt ? '어울리는 노래라면 뭐든 좋아요!' : r.artist || '';
    };
    const spin = () => {
      result = this.roll();
      if (reducedMotion()) {
        show(result);
        return;
      }
      const pool = Music.songs().map((s) => s.title.toUpperCase()).concat(this.PROMPTS.slice(0, 4));
      let i = 0;
      const steps = 14;
      const tick = () => {
        if (i < steps) {
          songEl.textContent = pick(pool);
          artistEl.textContent = '';
          i++;
          Sfx.play('flip');
          setTimeout(tick, 50 + i * 12);
        } else {
          show(result);
          Sfx.play('pop');
        }
      };
      tick();
    };
    spin();
    ov.panel.addEventListener('click', (e) => {
      if (e.target.closest('[data-reroll]')) spin();
      else if (e.target.closest('[data-sing]')) {
        CoverHost.fromSurprise = true; // the next take completes the "surprise" challenge
        UI.close(ov).then(() => Actions.sing());
      }
    });
  },
};

/* ------------------------------------------------------------------
   💌 Open a random message (`by` = the fox that brought it, when one did)
   ------------------------------------------------------------------ */
function openMessage(anchor, { by = '' } = {}) {
  const r = Messages.open();
  if (!r) {
    UI.alert({ icon: '💌', title: '아직 메시지가 없어요', text: '나 → 설정 → 메시지 편집에서 메시지를 추가할 수 있어요.' });
    return;
  }
  Sfx.play('heart');
  Game.reward({ dopamine: 5 }, anchor);
  Game.track('message');
  UI.open(
    `<div class="message-modal">
      <div class="env-anim" aria-hidden="true">💌</div>
      ${by ? `<p class="fox-post">🦊 ${esc(josa(by, '이/가'))} 물어다 준 편지</p>` : ''}
      ${r.isNew ? '<p class="new-badge">✨ 새 메시지 발견!</p>' : ''}
      ${letterHtml(r.msg.text, { cls: 'big' })}
      <p class="hint center">${Messages.all().length}개 중 ${Messages.collected().length}개 모음 ·
        <button class="link-btn" data-action="nav" data-to="#/me/letters">편지 모두 보기</button></p>
      <div class="dialog-actions one"><button class="btn primary" data-action="close-overlay">💗 고마워</button></div>
    </div>`,
    { cls: 'is-dialog', label: '남자친구가 보낸 메시지' }
  );
  const count = $('.letter-card .hint');
  if (count) count.textContent = `메시지 ${Messages.all().length}개 중 ${Messages.collected().length}개 발견`;
}

Object.assign(Actions, {
  sing: () => {
    if (CoverHost.api) CoverHost.api.startCover();
    Router.go('#/studio');
  },
  surprise: () => Surprise.open(),
  'open-message': (el) => openMessage(el),
  'claim-daily': (el) => {
    Game.claimDailyBonus(el);
    Router.refresh();
  },
  'catch-golden': (el) => {
    State.daily.golden = true;
    Game.rare();
    Game.reward({ dopamine: 77, coins: 7 }, el);
    Sfx.play('rare');
    UI.confetti({ gold: true, count: 70 });
    UI.toast('레어! 황금 하트를 잡았어요 💛 +77 ✨', { icon: '💛', kind: 'gold', ms: 3200 });
    el.remove();
  },
  nav: (el) => Router.go(el.dataset.to),
});
