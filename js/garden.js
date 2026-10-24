'use strict';
/* ==================================================================
   🌷 The song garden — a flower for every cover she releases.

   Round the back of the foxes' yard, in rows, the first one in the
   middle and the rest out to either side (js/fox/garden.js draws
   them): what flower a song is goes by how fast it is — a rose for a
   slow ballad, then a tulip, a daisy, a cosmos, and a sunflower for
   a quick one — and its colour by its key: warm (pink to yellow) in
   a major key, cool (sky blue to violet) in a minor one. The more she
   listens to a song, the taller its flower grows. Both are found by
   ear, once, from the saved recording (js/cover/audio/beat.js and
   key.js); until then a song is a bud.

   A new flower opens the first time she sees it, and her fox goes
   over to sniff it. A tap on one says which song it is, and plays it
   if she likes: the foxes dance, and so does its flower.
   ================================================================== */

// what flower a song is, by how fast it goes (beats a minute: under `below`)
const GARDEN_KINDS = [
  { id: 'rose', name: '장미', emoji: '🌹', below: 80, pace: '아주 느린 노래' },
  { id: 'tulip', name: '튤립', emoji: '🌷', below: 96, pace: '느린 노래' },
  { id: 'daisy', name: '데이지', emoji: '🌼', below: 112, pace: '보통 빠르기' },
  { id: 'cosmos', name: '코스모스', emoji: '🌸', below: 128, pace: '조금 빠른 노래' },
  { id: 'sunflower', name: '해바라기', emoji: '🌻', below: Infinity, pace: '빠른 노래' },
];
const GARDEN_BUD = { id: 'bud', name: '꽃봉오리', emoji: '🌱', pace: '' };
// the keys, as they are called here (C = 0 … B = 11)
const KEY_NOTES = {
  major: ['다', '올림다', '라', '내림마', '마', '바', '올림바', '사', '내림가', '가', '내림나', '나'],
  minor: ['다', '올림다', '라', '내림마', '마', '바', '올림바', '사', '올림사', '가', '내림나', '나'],
};

const Garden = {
  failed: new Set(), // covers that could not be listened to (this visit)
  studying: false,
  chipTimer: 0,
  shown: null, //    the flower whose card is up

  /* What flower a song of `bpm` is. */
  kindOf(bpm) {
    return bpm ? GARDEN_KINDS.find((k) => bpm < k.below) : GARDEN_KINDS[2];
  },

  /* …and in what colour, for its key: round the circle of fifths, warm for a major key, cool for a minor one. */
  colorOf(t) {
    if (!t || t.tonic < 0) return 'hsl(330, 70%, 76%)';
    const step = (t.tonic * 7) % 12;
    return t.mode === 'minor' ? `hsl(${195 + step * 9}, 66%, 70%)` : `hsl(${(340 + step * 7.5) % 360}, 82%, 68%)`;
  },

  /* "라장조" — and how it sounds, in a word. */
  keyName(t) {
    return t && t.tonic >= 0 ? `${KEY_NOTES[t.mode === 'minor' ? 'minor' : 'major'][t.tonic]}${t.mode === 'minor' ? '단조' : '장조'}` : '';
  },
  feel(t) {
    return !t || t.tonic < 0 ? '' : t.mode === 'minor' ? '차분한 단조' : '밝은 장조';
  },

  /* Her covers as flowers, the oldest first: { id, title, at, plays, traits, kind, color, size }. */
  flowers() {
    return Music.all()
      .slice()
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
      .map((c) => {
        const t = State.garden.traits[c.id] || null;
        return { id: c.id, title: c.title, at: c.createdAt, plays: c.plays, traits: t, kind: t ? this.kindOf(t.bpm) : GARDEN_BUD, color: this.colorOf(t), size: 1.75 * (1 + Math.min(0.45, c.plays * 0.03)) };
      });
  },

  /* …as the 3D side wants them (js/fox/garden.js). */
  look() {
    if (Opening.shut()) return [];
    return this.flowers().map((f) => ({ id: f.id, kind: f.kind.id, color: f.color, minor: !!f.traits && f.traits.mode === 'minor', size: f.size, fresh: !!f.traits && !State.garden.seen.includes(f.id) }));
  },

  /* How many flowers, and of how many kinds (for the achievements). */
  count() {
    return Music.all().length;
  },
  kinds() {
    return new Set(Object.values(State.garden.traits).map((t) => this.kindOf(t.bpm).id)).size;
  },

  /* Listen to the covers that are still buds, one at a time: how fast each goes, and in what key. */
  async study() {
    if (this.studying || !CoverHost.api) return;
    this.studying = true;
    try {
      for (const c of Music.all()) {
        if (State.garden.traits[c.id] || this.failed.has(c.id)) continue;
        const t = await CoverHost.traits(c.id);
        if (!t) {
          this.failed.add(c.id);
          continue;
        }
        State.garden.traits[c.id] = { bpm: Math.round(t.bpm || 0), tonic: t.key ? t.key.tonic : -1, mode: t.key ? t.key.mode : '' };
        Store.save();
        FoxHost.sync();
        Game.checkAchievements();
      }
    } finally {
      this.studying = false;
    }
  },

  /* A cover was just released (js/game.js): its flower is planted — it opens when she next sees the yard. */
  planted(c) {
    setTimeout(() => this.study(), 1500);
    if (Opening.shut()) return;
    setTimeout(() => UI.toast(`여우 마당 노래 정원에 ${quoted(c.title, '이/가')} 꽃으로 피었어요!`, { icon: '🌷', ms: 4200 }), 2600);
  },

  /* The 3D side: a new flower has opened in front of her. */
  bloomed(id) {
    if (State.garden.seen.includes(id)) return;
    State.garden.seen.push(id);
    Store.save();
  },

  /* …and she tapped one: its card comes up over the view — which song, what flower, and a button to play it. */
  tapped(id) {
    const f = this.flowers().find((x) => x.id === id);
    const ov = FoxRoom.ov;
    if (!f || !ov) return;
    this.shown = id;
    Sfx.play('pop');
    const el = $('[data-fox-flower]', ov.panel);
    const t = f.traits;
    const about = t ? [f.kind.name, f.kind.pace, this.feel(t)].filter(Boolean).join(' · ') : '아직 무슨 꽃이 될지 듣는 중이에요';
    el.innerHTML = `<span class="ff-emoji" aria-hidden="true">${f.kind.emoji}</span>
      <button class="ff-text" data-action="garden-sheet"><b>‘${esc(f.title)}’</b><small>${esc(about)}</small></button>
      <button class="ff-play" data-action="flower-play" aria-label="이 노래 들려주기">▶</button>
      <button class="ff-close" data-action="flower-close" aria-label="닫기">✕</button>`;
    el.hidden = false;
    clearTimeout(this.chipTimer);
    this.chipTimer = setTimeout(() => this.hide(), 7000);
  },

  hide() {
    clearTimeout(this.chipTimer);
    this.shown = null;
    const el = FoxRoom.ov && $('[data-fox-flower]', FoxRoom.ov.panel);
    if (el) el.hidden = true;
  },

  /* Every flower, the newest first: what it is, and why. */
  sheet() {
    this.hide();
    const list = this.flowers().reverse();
    const ov = UI.open(
      `<div class="juke garden-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2 class="juke-title">🌷 노래 정원 <small>${list.length}송이</small></h2>
        <p class="hint">커버를 발매할 때마다 여우 마당에 꽃이 한 송이씩 피어요. 꽃 종류는 노래 빠르기, 색은 조(밝은 장조는 따뜻한 색, 차분한 단조는 시원한 색)로 정해지고, 많이 들을수록 꽃이 커져요.</p>
        <div class="garden-kinds" aria-hidden="true">${GARDEN_KINDS.map((k) => `<span>${k.emoji} ${esc(k.pace)}</span>`).join('')}</div>
        ${
          list.length
            ? `<div class="juke-list">${list
                .map((f) => {
                  const t = f.traits;
                  const bits = t ? [f.kind.name, t.bpm ? `${t.bpm} BPM` : '', this.keyName(t)].filter(Boolean).join(' · ') : '꽃봉오리 · 듣는 중';
                  return `<button class="juke-item garden-row" data-flower="${esc(f.id)}"><span class="gr-flower" style="--fc:${esc(f.color)}" aria-hidden="true">${f.kind.emoji}</span><span class="juke-text"><b>${esc(f.title)}</b><small>${esc(bits)} · ${esc(fmtDate(f.at))}${f.plays ? ` · ${f.plays}번 들음` : ''}</small></span><span class="juke-go" aria-hidden="true">▶</span></button>`;
                })
                .join('')}</div>`
            : emptyState('🌱', '아직 핀 꽃이 없어요', '스튜디오에서 커버를 발매하면 첫 꽃이 피어요.', '')
        }
        <div class="dialog-actions one"><button class="btn soft" data-ov-cancel>닫기</button></div>
      </div>`,
      { cls: 'is-juke', label: '노래 정원' }
    );
    ov.panel.addEventListener('click', (e) => {
      const row = e.target.closest('[data-flower]');
      if (row) {
        Sfx.play('pop');
        CoverHost.start(row.dataset.flower);
        UI.close(ov);
      } else if (e.target.closest('[data-ov-cancel]')) UI.close(ov);
    });
  },
};

Object.assign(Actions, {
  'flower-play': () => {
    const id = Garden.shown;
    Garden.hide();
    if (id) CoverHost.start(id); // (the foxes come and dance: js/fox/dance.js — and so does its flower)
  },
  'flower-close': () => Garden.hide(),
  'garden-sheet': () => Garden.sheet(),
});
