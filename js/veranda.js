'use strict';
/* ==================================================================
   🌱 베란다 텃밭 — the veranda outside the window of 둘의 집, and what
   she grows on it.

   Through the window is a veranda (the 3D side: js/house/veranda.js),
   with planter boxes along its railing: two to begin with, two more for
   coins. In each she sows what she likes — 상추, 대파, 방울토마토, 딸기 —
   and it grows in real time, for as long as its soil is damp: a watering
   keeps it so for most of a day (and the city's rain, falling on the
   veranda, waters it for her). Left dry, it droops and waits; watered,
   it lifts and grows on. When it is ripe she picks it into her basket
   and takes it in to the fridge (State.house.pantry) — to cook with:
   some of the kitchen's recipes want what grows out here (js/town.js).
   Picked, it grows again.

   What is in which box, and how far it has grown, is State.house.veranda.
   ================================================================== */

const VERANDA_WET = 20 * 3600e3; //       how long a watering keeps the soil damp
const VERANDA_BOXES = [0, 0, 80, 160]; // what each box costs (the first two come with the veranda)
const VERANDA_HOUR = 3600e3;

/*
 * What she can grow: what its packet of seeds costs, how many hours it takes to be ripe the first time (grow) and again
 * once it has been picked (again) — hours of damp soil — how much there is to pick each time (n, in `unit`s), how far
 * grown it looks just after it has been picked (back: a lettuce keeps most of its leaves, spring onions are cut down to the
 * root), whether it flowers and fruits (fruit), and the colour of its packet.
 */
const VERANDA_CROPS = [
  { id: 'lettuce', emoji: '🥬', name: '상추', short: '상추', seed: 8, grow: 4, again: 2.5, n: 3, unit: '장', back: 0.62, fruit: false, packet: '#d8f0b8', desc: '빨리 자라요 · 겉잎부터 똑똑' },
  { id: 'leek', emoji: '🌿', name: '대파', short: '대파', seed: 6, grow: 6, again: 3, n: 2, unit: '대', back: 0.3, fruit: false, packet: '#e2f2d0', desc: '잘라도 또 자라는 파테크!' },
  { id: 'tomato', emoji: '🍅', name: '방울토마토', short: '토마토', seed: 14, grow: 16, again: 7, n: 5, unit: '알', back: 0.66, fruit: true, packet: '#ffd6cc', desc: '노란 꽃이 지면 주렁주렁' },
  { id: 'strawberry', emoji: '🍓', name: '딸기', short: '딸기', seed: 18, grow: 22, again: 9, n: 4, unit: '알', back: 0.66, fruit: true, packet: '#ffd3df', desc: '하얀 꽃 다음에 빨간 딸기' },
];

/* …and what it is in the fridge, as the store's shelves are (js/town.js: TownLife.storeItem) — spring onions are the
   store's own already. */
const VERANDA_GROWN = [
  { id: 'lettuce', kind: 'ing', emoji: '🥬', name: '상추', grown: true },
  { id: 'tomato', kind: 'ing', emoji: '🍅', name: '방울토마토', grown: true },
  { id: 'strawberry', kind: 'ing', emoji: '🍓', name: '딸기', grown: true },
];

/* How each box is coming on, in words (the garden's sheet, her looking it over). */
const VERANDA_STAGES = {
  seed: '흙 속에서 싹 틔우는 중',
  sprout: '새싹이 났어요 🌱',
  young: '쑥쑥 크는 중',
  flower: '꽃이 폈어요 🌼',
  fruit: '열매가 맺혔어요',
  ripe: '다 익었어요! 🧺',
};

/* What the girl says out there (TownLife.meLine has them, with the street's: they are hers). */
const VERANDA_LINES = {
  veranda_go: ['베란다 나가 볼까~ 🌱', '텃밭 보러 가야지!', '우리 텃밭 잘 있나~'],
  veranda_out: ['베란다 공기 좋다~', '햇볕 좋다 ☀️', '오늘도 쑥쑥 자랐으려나?'],
  veranda_out_rain: ['비 온다! 텃밭이 좋아하겠다 ☔', '빗소리 좋다~'],
  veranda_out_snow: ['눈 온다! ⛄ 화분들 춥겠다', '하얗다~ ❄️'],
  veranda_out_night: ['밤바람 시원하다 🌙', '불빛 반짝반짝 예쁘다'],
  veranda_in: ['다시 방으로~ 🏠', '텃밭 구경 끝!'],
  fill: ['물 받아야지 💧', '콸콸콸~'],
  water: ['쑥쑥 자라라~ 💧', '시원하지? 💧', '물 마시고 힘내!'],
  water_last: ['너도 물 마셔~ 💧', '골고루 골고루~'],
  water_done: ['물 다 줬다! 💧', '촉촉해졌다~'],
  sow_lettuce: ['상추 씨앗 쏙쏙! 🌱', '상추야 무럭무럭 자라라~'],
  sow_leek: ['파테크 시작! 🌿', '대파 쑥쑥 자라라~'],
  sow_tomato: ['방울토마토 주렁주렁 열려라 🍅', '토마토 씨앗 쏙!'],
  sow_strawberry: ['딸기야 무럭무럭 자라라 🍓', '빨간 딸기 기대된다!'],
  pick_lettuce: ['상추 한 장, 두 장~ 🥬', '겉잎부터 똑똑!'],
  pick_leek: ['싹둑! 파테크 성공 🌿', '대파 잘 자랐다!'],
  pick_tomato: ['빨갛게 잘 익었다 🍅', '토마토 땄다!'],
  pick_strawberry: ['딸기 땄다! 🍓', '새빨갛게 익었네~'],
  pick_done: ['냉장고에 넣어야지 🧊', '오늘 수확 끝! 🧺'],
  taste_strawberry: ['음~ 달다! 🍓', '갓 딴 딸기 최고야 💗'],
  taste_tomato: ['톡 터진다! 🍅', '새콤달콤~'],
  look_seed: ['언제 싹이 날까…', '흙 속에서 자라는 중이겠지?'],
  look_sprout: ['새싹 귀여워 🌱', '쪼끄만 잎 났다!'],
  look_young: ['쑥쑥 크고 있다!', '잎이 많아졌어 🌿'],
  look_flower: ['꽃 폈다! 🌼', '이제 열매 맺히겠다'],
  look_fruit: ['조금만 더 익어라~', '열매 달렸다!'],
  look_ripe: ['다 익었다! 따야지 🧺', '맛있겠다~ 😋'],
  look_dry: ['목마르겠다… 물 줘야지 💧', '흙이 바싹 말랐어'],
  veranda_sit: ['잠깐 앉아서 쉬어야지', '햇볕 따뜻하다~'],
  veranda_view: ['바람 솔솔~', '오늘 하늘 예쁘다', '저 멀리까지 보인다'],
  veranda_view_night: ['밤하늘 예쁘다 🌙', '불빛 반짝반짝'],
  veranda_view_rain: ['비 오는 거 구경 중 ☔', '빗방울 톡톡~'],
};
Object.assign(TOWN_LINES, VERANDA_LINES);

const VerandaLife = {
  out: false, // she is out on the veranda (it is shown)

  /* ----- what is hers ----- */

  state() {
    const h = State.house;
    if (!h.veranda || typeof h.veranda !== 'object') h.veranda = { made: 0, boxes: 2, plots: [], picked: {}, sown: {}, watered: 0, gift: false, rainAt: 0, news: false };
    const v = h.veranda;
    if (!Array.isArray(v.plots)) v.plots = [];
    while (v.plots.length < VERANDA_BOXES.length) v.plots.push(null);
    v.boxes = clamp(v.boxes | 0 || 2, 2, VERANDA_BOXES.length);
    return v;
  },
  crop: (id) => VERANDA_CROPS.find((c) => c.id === id) || null,

  /** Growth since it was last looked at — for as long as its soil has been damp. */
  tick(now = Date.now()) {
    for (const p of this.state().plots) {
      if (!p || !p.crop) continue;
      const c = this.crop(p.crop);
      const until = Math.min(now, p.wet || 0);
      if (c && until > (p.last || 0)) p.grown = Math.min((p.grown || 0) + (until - (p.last || 0)), (p.picks ? c.again : c.grow) * VERANDA_HOUR);
      p.last = now;
    }
  },

  /** Box `i` as it is now: { open, crop, k (how grown it looks, 0 … 1), ripe, wet, dry, wilt, stage, left (ms of damp soil
   *  until it is ripe), wetLeft (ms) }. */
  info(i, now = Date.now()) {
    const v = this.state();
    if (i >= v.boxes) return { i, open: false };
    const p = v.plots[i];
    const c = p && this.crop(p.crop);
    if (!c) return { i, open: true, crop: null };
    const need = (p.picks ? c.again : c.grow) * VERANDA_HOUR;
    const f = Math.min(1, (p.grown || 0) / need);
    const k = p.picks ? c.back + (1 - c.back) * f : f;
    const ripe = f >= 1;
    const wet = (p.wet || 0) > now;
    const stage = ripe ? 'ripe' : k < 0.06 ? 'seed' : k < 0.25 ? 'sprout' : !c.fruit || k < 0.56 ? 'young' : k < 0.72 ? 'flower' : 'fruit';
    return {
      i,
      open: true,
      crop: c,
      k,
      ripe,
      wet,
      dry: !wet,
      wilt: wet ? 0 : clamp((now - (p.wet || 0)) / (6 * VERANDA_HOUR), 0.25, 1), // (drooping more, the longer it has been dry)
      stage,
      left: ripe ? 0 : need - (p.grown || 0),
      wetLeft: wet ? p.wet - now : 0,
      picks: p.picks || 0,
    };
  },

  boxes() {
    this.tick();
    return VERANDA_BOXES.map((_, i) => this.info(i));
  },

  /** What the 3D side shows (js/house/veranda.js). */
  look() {
    const v = this.state();
    const list = this.boxes();
    return { open: v.boxes, plots: list.map((b) => (b.crop ? { crop: { id: b.crop.id, emoji: b.crop.emoji, short: b.crop.short }, k: b.k, ripe: b.ripe, wet: b.wet, dry: b.dry, wilt: b.wilt, stage: b.stage } : null)) };
  },

  /** What wants her out there: what is ripe, what is dry (and whether she has never been). */
  news() {
    const v = this.state();
    const list = this.boxes().filter((b) => b.open && b.crop);
    return { fresh: !v.made, ripe: list.filter((b) => b.ripe), dry: list.filter((b) => b.dry) };
  },

  /** "🍓 베란다 딸기가 다 익었어요" — or what else wants her there — for the chip over the room and the card on Home ('' if nothing). */
  note() {
    const n = this.news();
    if (n.ripe.length) {
      const c = n.ripe[0].crop;
      return n.ripe.length > 1 ? '🧺 베란다 텃밭에 수확할 게 있어요' : `${c.emoji} 베란다 ${josa(c.name, '이/가')} 다 ${c.fruit ? '익었어요' : '자랐어요'}`;
    }
    if (n.dry.length) return '💧 베란다 텃밭이 목말라요';
    return '';
  },

  /** How long until `ms` of damp soil has gone by, in words: "5시간", "40분". */
  hours(ms) {
    const min = Math.max(1, Math.round(ms / 60000));
    if (min < 60) return `${min}분`;
    const h = Math.floor(min / 60);
    const m = Math.round((min % 60) / 10) * 10;
    return m && h < 10 ? `${h}시간 ${m}분` : `${h}시간`;
  },

  /* ----- out onto it, and in again ----- */

  /** Why she cannot go out onto it now — or ''. */
  whyNot() {
    const api = HouseHost.api;
    if (!api || !HouseRoom.ov) return '…';
    if (TownLife.out) return '동네에 나가 있어요. 집에 돌아와서 가요 🏠';
    if (Delivery.pending()) return `🛵 ${josa(Delivery.foodName(), '이/가')} 오고 있어요. 받고 나서 나가요`;
    if (Delivery.busy() || api.eating()) return `${josa(Avatar.name(), '이/가')} 먹는 중이에요 😋`;
    if (TownLife.cooking) return `${josa(Avatar.name(), '이/가')} 요리하는 중이에요 🍳`;
    if (api.guestHere()) return `${josa(OWNER_NAME, '이/가')} 놀러 와 있어요 💗 ${josa(OWNER_NAME, '이/가')} 가고 나서 나가요`;
    if (api.doorBusy()) return '현관에 누가 와 있어요. 잠깐만요!';
    return '';
  },

  /** Out onto the veranda (the 🌱 button) — asleep, up first. */
  go() {
    if (this.out) return this.sheet();
    const why = this.whyNot();
    if (why) return UI.toast(why, { icon: '🌱' });
    if (HouseRoom.editOn) HouseRoom.setEdit(false);
    if (HouseRoom.meOn) HouseRoom.setMe(false);
    if (!HouseHost.api.verandaGo()) return UI.toast('지금은 나갈 수 없어요. 잠깐 뒤에 다시 해 보세요', { icon: '🌱' });
    Sfx.play('pop');
  },

  goIn() {
    const api = HouseHost.api;
    if (!this.out || !api) return;
    if (api.verandaBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    this.closeSheets();
    if (api.verandaIn()) Sfx.play('tap');
  },

  busyText() {
    const b = HouseHost.api && HouseHost.api.verandaBusy();
    return b === 'water' ? '물 주는 중이에요 💧' : b === 'sow' ? '씨앗 심는 중이에요 🌱' : b === 'pick' ? '수확하는 중이에요 🧺' : '잠깐만요!';
  },

  /** The 3D side: she is out ('out'), in again ('in'); she has sown ('sown'), watered ('watered'), picked a box
   *  ('picked') and all she was picking ('pickedAll'); a tap out there ('tap': { kind, i }). */
  said(what, o) {
    if (what === 'out') return this.wentOut();
    if (what === 'in') return this.cameIn();
    if (what === 'tap') return this.tapped(o.kind, o.i);
    if (what === 'sown') return this.sown(o.i);
    if (what === 'watered') return o.sown ? null : UI.toast(o.ids.length > 1 ? '텃밭에 물을 줬어요 💧 하루 동안 촉촉해요' : '물을 줬어요 💧 하루 동안 촉촉해요', { icon: '💧' }); // (just sown: that was said)
    if (what === 'pickedAll') return this.picked(o.list);
  },

  wentOut() {
    const v = this.state();
    const first = !v.made;
    if (first) v.made = Date.now();
    v.news = true;
    this.out = true;
    Diary.note('veranda');
    Store.save();
    this.hud();
    HouseRoom.refresh();
    Game.checkAchievements();
    this.rain();
    if (first) setTimeout(() => this.out && UI.toast('베란다 텃밭이에요! 🌱 텃밭 상자를 누르면 씨앗을 심을 수 있어요. 첫 씨앗은 선물이에요 🎁', { icon: '🌱', kind: 'gold', ms: 6000 }), 1600);
  },

  cameIn() {
    this.out = false;
    this.closeSheets();
    this.hud();
    HouseRoom.refresh();
  },

  /** The house was closed: next time, she is in the room. */
  closed() {
    this.out = false;
  },

  /** A tap out there: a box, the can, the basket, the door, the tap, the air conditioner. */
  tapped(kind, i) {
    if (kind === 'box') return this.boxMenu(i);
    if (kind === 'can') return this.water();
    if (kind === 'basket') return this.harvest();
    if (kind === 'door') return this.goIn();
    Sfx.play('tap');
    if (kind === 'tap') return UI.toast('수도꼭지예요 💧 물뿌리개에 물을 받아요', { icon: '🚰' });
    if (kind === 'ac') return UI.toast(Weather.calendar() === 'summer' ? '에어컨 실외기가 윙윙 돌아가요 🌀' : '에어컨 실외기예요. 위에 다육이가 살아요 🪴', { icon: '🌀' });
    if (kind === 'stool') return UI.toast('목욕탕 의자예요. 앉아서 햇볕 쬐기 딱 좋아요 ☀️', { icon: '🪑' });
  },

  /* ----- what she does to it ----- */

  /** 💧 Water the boxes `ids` (or all that have something in them): she fills the can and goes round. */
  water(ids) {
    const api = HouseHost.api;
    if (!this.out || !api) return;
    if (api.verandaBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    const planted = this.boxes().filter((b) => b.open && b.crop).map((b) => b.i);
    const list = (ids || planted).filter((i) => planted.includes(i));
    if (!list.length) return UI.toast('먼저 씨앗을 심어요 🌱 빈 상자를 누르면 심을 수 있어요', { icon: '💧' });
    this.closeSheets();
    if (!api.verandaWater(list)) return;
    // (damp from now on: what she is seen doing follows)
    const v = this.state();
    const now = Date.now();
    this.tick(now);
    list.forEach((i) => (v.plots[i].wet = now + VERANDA_WET));
    v.watered = (v.watered || 0) + 1;
    Diary.note('water');
    Store.save();
    HouseHost.sync();
  },

  /** 🧺 Pick what is ripe (of `ids`, or anywhere): into the fridge with it, as she picks it. */
  harvest(ids) {
    const api = HouseHost.api;
    if (!this.out || !api) return;
    if (api.verandaBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    const all = this.boxes().filter((b) => b.open && b.crop);
    const ripe = all.filter((b) => b.ripe && (!ids || ids.includes(b.i)));
    if (!ripe.length) return this.notYet(all);
    this.closeSheets();
    if (!api.verandaPick(ripe.map((b) => ({ i: b.i, id: b.crop.id, n: b.crop.n })))) return;
    const v = this.state();
    const h = TownLife.state();
    this.tick();
    for (const b of ripe) {
      const p = v.plots[b.i];
      const c = b.crop;
      h.pantry[c.id] = (h.pantry[c.id] || 0) + c.n;
      v.picked[c.id] = (v.picked[c.id] || 0) + c.n;
      p.picks = (p.picks || 0) + 1;
      p.grown = 0;
      Diary.add('harvest', c.name);
    }
    Store.save();
    HouseHost.sync();
  },

  /* Nothing ripe yet: when there will be. */
  notYet(all) {
    Sfx.play('tap');
    if (!all.length) return UI.toast('먼저 씨앗을 심어요 🌱 빈 상자를 누르면 심을 수 있어요', { icon: '🧺' });
    const growing = all.filter((b) => !b.dry).sort((a, b) => a.left - b.left);
    if (!growing.length) return UI.toast('흙이 말라서 자라지 못하고 있어요. 💧 물부터 줘요!', { icon: '🧺' });
    const b = growing[0];
    UI.toast(`아직 익은 게 없어요. ${josa(b.crop.name, '은/는')} ${this.hours(b.left)} 뒤에 ${b.crop.fruit ? '익어요' : '다 자라요'}`, { icon: '🧺', ms: 3200 });
  },

  /* All she was picking is in the basket (and was in the fridge already): what it came to. */
  picked(list) {
    const parts = list.map((p) => {
      const c = this.crop(p.id);
      return `${c.emoji} ${c.name} ${p.n}${c.unit}`;
    });
    const v = this.state();
    const total = Object.values(v.picked).reduce((s, n) => s + n, 0);
    Sfx.play('reward');
    if (total <= list.reduce((s, p) => s + p.n, 0)) {
      // (the very first)
      UI.confetti({ count: 70 });
      UI.celebrate({ emoji: '🧺', title: '첫 수확!', subtitle: `${josa(parts.join(', '), '을/를')} 땄어요. 냉장고에 넣어 둘게요 🧊 부엌에서 요리할 수 있어요!`, buttons: [{ label: '신난다! 💗', primary: true }] });
    } else UI.toast(`${josa(parts.join(', '), '을/를')} 땄어요! 냉장고에 넣어 둘게요 🧊`, { icon: '🧺', kind: 'gold', ms: 3800 });
    Game.checkAchievements();
  },

  /** Sow `id` in box `i` (her first packet is a present; then the packet's price). */
  sow(i, id) {
    const api = HouseHost.api;
    const c = this.crop(id);
    const v = this.state();
    if (!this.out || !api || !c) return;
    if (api.verandaBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    const free = !v.gift;
    if (!free && !Pet.spend(c.seed)) return;
    if (!api.verandaSow(i, { id: c.id, emoji: c.emoji, short: c.short, packet: c.packet })) {
      if (!free) Game.reward({ coins: c.seed });
      return;
    }
    if (free) v.gift = true;
    else Sfx.play('coin');
    const now = Date.now();
    v.plots[i] = { crop: id, grown: 0, picks: 0, wet: now + VERANDA_WET, last: now, at: now };
    v.sown[id] = (v.sown[id] || 0) + 1;
    Diary.add('sow', c.name);
    Store.save();
    HouseHost.sync();
  },

  sown(i) {
    const b = this.info(i);
    if (!b.crop) return;
    UI.toast(`${b.crop.emoji} ${b.crop.name} 씨앗을 심었어요! 물을 잘 주면 ${this.hours(b.crop.grow * VERANDA_HOUR)} 뒤에 ${b.crop.fruit ? '익어요' : '다 자라요'}`, { icon: '🌱', ms: 4200 });
    Game.checkAchievements();
  },

  /** Pull up what is in box `i` (to sow something else). */
  async clear(i) {
    const b = this.info(i);
    if (!b.crop) return;
    if (HouseHost.api && HouseHost.api.verandaBusy()) return UI.toast(this.busyText(), { icon: '⏳' });
    const ok = await UI.confirm({ icon: b.crop.emoji, title: `${josa(b.crop.name, '을/를')} 뽑을까요?`, text: b.ripe ? '다 익은 게 있어요! 뽑으면 수확하지 못해요. 빈 상자에는 새 씨앗을 심을 수 있어요.' : '뽑은 자리에는 새 씨앗을 심을 수 있어요.', ok: '🌱 뽑기', danger: b.ripe });
    if (!ok) return;
    this.state().plots[i] = null;
    Sfx.play('pop');
    Store.save();
    HouseHost.sync();
    this.renderSheet();
  },

  /** One more planter box along the railing. */
  async buyBox() {
    const v = this.state();
    if (v.boxes >= VERANDA_BOXES.length) return;
    const price = VERANDA_BOXES[v.boxes];
    const ok = await UI.confirm({ icon: '🪴', title: '텃밭 상자를 하나 더 놓을까요?', text: `🪙 ${price} 코인이에요. 베란다 난간 앞에 새 상자가 생겨요.`, ok: `${price} 🪙 놓기` });
    if (!ok || !Pet.spend(price)) return;
    v.boxes += 1;
    Sfx.play('coin');
    Diary.add('houseNew', '텃밭 상자');
    Store.save();
    HouseHost.sync();
    this.renderSheet();
    this.hud();
    Game.checkAchievements();
    UI.toast('새 텃밭 상자가 생겼어요! 🪴 눌러서 씨앗을 심어요', { icon: '🪴', kind: 'gold' });
  },

  /** The rain waters it (it is open to the sky): when the city's weather is rain, every box is damp again. */
  rain() {
    const v = this.state();
    if (!v.made) return;
    const w = House.weather();
    if (!w || w.kind !== 'rain') return;
    const now = Date.now();
    if (now - (v.rainAt || 0) < 30 * 60000) return;
    this.tick(now);
    let dry = 0;
    v.plots.forEach((p, i) => {
      if (!p || !p.crop || i >= v.boxes) return;
      if ((p.wet || 0) < now) dry++;
      p.wet = Math.max(p.wet || 0, now + VERANDA_WET);
    });
    v.rainAt = now;
    Store.save();
    if (!dry) return;
    HouseHost.sync();
    UI.toast('☔ 비가 와서 베란다 텃밭이 촉촉해졌어요', { icon: '☔', ms: 3600 });
  },

  /* ----- the sheets ----- */

  closeSheets() {
    for (const ov of [...UI.stack]) if (ov.opts && /is-veranda-sheet/.test(ov.opts.cls || '')) UI.close(ov);
  },

  /** What a box's tap brings: sowing it (empty), what can be done with it (growing), one more box (not there yet). */
  boxMenu(i) {
    const b = this.info(i);
    if (!b.open) return this.buyBox();
    if (!b.crop) return this.seedSheet(i);
    Sfx.play('pop');
    const status = b.dry ? '목말라요 💧' : b.ripe ? (b.crop.fruit ? '다 익었어요! 🧺' : '다 자랐어요! 🧺') : `${VERANDA_STAGES[b.stage]} · ${this.hours(b.left)} 뒤 수확`;
    UI.menu(`${b.crop.emoji} ${b.crop.name} · ${status}`, [
      ...(b.ripe ? [{ icon: '🧺', label: '수확하기', onClick: () => this.harvest([i]) }] : []),
      { icon: '💧', label: b.dry ? '물 주기' : `물 주기 (${this.hours(b.wetLeft)} 동안 촉촉해요)`, onClick: () => this.water([i]) },
      { icon: '🌱', label: '뽑고 다른 씨앗 심기', onClick: () => this.clear(i) },
    ]);
  },

  /** Which seeds to sow in box `i`. */
  seedSheet(i) {
    const v = this.state();
    const free = !v.gift;
    Sfx.play('pop');
    const ov = TownLife.sheet(
      `<div class="house-sheet town-sheet veranda-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>🌱 어떤 씨앗을 심을까요?</h2>
        <p class="hint">${free ? '첫 씨앗은 선물이에요 🎁 ' : ''}흙이 촉촉하면 자라요. 하루에 한 번 물을 주세요.</p>
        <div class="seed-list">${VERANDA_CROPS.map(
          (c) => `<button class="seed" data-seed="${c.id}">
            <span class="seed-pack" style="--pack:${c.packet}" aria-hidden="true">${c.emoji}</span>
            <span class="seed-text"><b>${esc(c.name)}</b><small>${esc(c.desc)}</small>
              <small class="seed-time">⏱️ ${c.grow}시간이면 첫 수확 · 한 번에 ${c.n}${c.unit}</small></span>
            <span class="seed-go">${free ? '🎁 선물' : `${c.seed} 🪙`}</span>
          </button>`
        ).join('')}</div>
      </div>`,
      '씨앗 심기'
    );
    ov.opts.cls += ' is-veranda-sheet';
    ov.el.classList.add('is-veranda-sheet');
    ov.panel.addEventListener('click', (e) => {
      const s = e.target.closest('[data-seed]');
      if (!s) return;
      UI.close(ov);
      this.sow(i, s.dataset.seed);
    });
  },

  /** 🌱 The garden at a glance: each box, how it is coming on, what can be done with it. */
  sheet() {
    if (!this.out) return;
    Sfx.play('pop');
    const ov = TownLife.sheet('<div class="house-sheet town-sheet veranda-sheet" data-veranda-sheet></div>', '베란다 텃밭');
    ov.opts.cls += ' is-veranda-sheet';
    ov.el.classList.add('is-veranda-sheet');
    this.sheetOv = ov;
    this.renderSheet();
    TownLife.lift(ov);
    ov.panel.addEventListener('click', (e) => {
      const box = e.target.closest('[data-vbox]');
      if (box) {
        const i = +box.dataset.vbox;
        const b = this.info(i);
        if (!b.open) return this.buyBox();
        UI.close(ov);
        return b.crop ? this.boxMenu(i) : this.seedSheet(i);
      }
      if (e.target.closest('[data-vwater]')) return this.water();
      if (e.target.closest('[data-vpick]')) return this.harvest();
    });
  },

  renderSheet() {
    const ov = this.sheetOv;
    if (!ov || ov.closed) return;
    const root = $('[data-veranda-sheet]', ov.panel);
    const list = this.boxes();
    const v = this.state();
    const next = VERANDA_BOXES[v.boxes];
    const ripe = list.some((b) => b.ripe);
    root.innerHTML = `<div class="sheet-handle" aria-hidden="true"></div>
      <h2>🌱 베란다 텃밭</h2>
      <p class="hint">흙이 촉촉한 동안 자라요. 물을 주면 하루 동안 촉촉하고, 비가 오면 저절로 물이 돼요 ☔</p>
      <div class="vg-boxes">${list
        .map((b) => {
          if (!b.open) return b.i === v.boxes ? `<button class="vg-box is-locked" data-vbox="${b.i}"><span class="vg-pic" aria-hidden="true">🪴</span><b>상자 늘리기</b><small>${next} 🪙</small></button>` : '';
          if (!b.crop) return `<button class="vg-box is-empty" data-vbox="${b.i}"><span class="vg-pic" aria-hidden="true">🕳️</span><b>빈 상자</b><small>🌱 씨앗 심기</small></button>`;
          const pct = Math.round(Math.min(1, b.ripe ? 1 : 1 - b.left / ((b.picks ? b.crop.again : b.crop.grow) * VERANDA_HOUR)) * 100);
          return `<button class="vg-box ${b.ripe ? 'is-ripe' : ''} ${b.dry ? 'is-dry' : ''}" data-vbox="${b.i}">
            <span class="vg-pic" aria-hidden="true">${b.crop.emoji}</span>
            <b>${esc(b.crop.name)}</b>
            <small>${b.ripe ? (b.crop.fruit ? '다 익었어요! 🧺' : '다 자랐어요! 🧺') : esc(VERANDA_STAGES[b.stage])}</small>
            <span class="vg-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
            <small class="vg-wet">${b.dry ? '🥀 목말라요 · 자라지 않아요' : b.ripe ? `💧 ${this.hours(b.wetLeft)} 촉촉` : `⏱️ ${this.hours(b.left)} 뒤 · 💧 ${this.hours(b.wetLeft)}`}</small>
          </button>`;
        })
        .join('')}</div>
      <div class="dialog-actions">
        <button class="btn soft" data-vwater>💧 모두 물 주기</button>
        <button class="btn ${ripe ? 'primary' : 'soft'}" data-vpick>🧺 수확하기</button>
      </div>`;
  },

  /* ----- over the view ----- */

  /** The house's view shows the room, or the veranda: its buttons and its name follow. */
  hud() {
    const ov = HouseRoom.ov;
    if (!ov) return;
    const root = $('[data-house-room]', ov.panel);
    root.classList.toggle('in-veranda', this.out);
    const name = $('.house-id b', ov.panel);
    if (name && !TownLife.out) name.textContent = this.out ? '🌱 베란다 텃밭' : `🏠 ${HOUSE_NAME}`;
    const n = this.news();
    const pick = $('[data-veranda-n="pick"]', ov.panel);
    if (pick) pick.textContent = n.ripe.length || '';
    const water = $('[data-veranda-n="water"]', ov.panel);
    if (water) water.textContent = n.dry.length ? '!' : '';
    requestAnimationFrame(() => HouseRoom.inset());
  },

  hudHtml() {
    return `<div class="fh-actions veranda-acts">
        <button class="fh-act is-home" data-action="veranda-in"><span aria-hidden="true">🏠</span><b>방으로</b></button>
        <button class="fh-act" data-action="veranda-water"><span aria-hidden="true">💧</span><b>물 주기</b><i class="va-n" data-veranda-n="water"></i></button>
        <button class="fh-act" data-action="veranda-pick"><span aria-hidden="true">🧺</span><b>수확</b><i class="va-n" data-veranda-n="pick"></i></button>
        <button class="fh-act" data-action="veranda-sheet"><span aria-hidden="true">🌱</span><b>텃밭</b></button>
      </div>`;
  },

  /** The 🌱 button down the side of the room, and the chip over it when something wants her out there (the house's refresh). */
  chip() {
    const ov = HouseRoom.ov;
    if (!ov) return;
    this.rain();
    const n = this.news();
    const btn = $('[data-house-veranda]', ov.panel);
    if (btn) btn.classList.toggle('has-news', !!(n.fresh || n.ripe.length || n.dry.length));
    const el = $('[data-house-garden]', ov.panel);
    if (el) {
      const note = this.note();
      const shown = !!note && !this.out && !TownLife.out && !HouseRoom.editOn && !HouseRoom.meOn;
      el.hidden = !shown;
      if (shown) {
        const html = `<span aria-hidden="true">${n.ripe.length ? '🧺' : '💧'}</span> <b>${esc(note.replace(/^\S+\s/, ''))}</b><small>${n.ripe.length ? '따러 가 볼까요?' : '물 주러 가요'}</small>`;
        if (el.dataset.html !== html) {
          el.dataset.html = html;
          el.innerHTML = html;
        }
      }
    }
    if (this.out) this.hud();
  },
};

/* (the veranda's sounds: the glass door sliding, water out of the can's rose, seeds sown, a strawberry picked, scissors) */
Object.assign(Sfx.sounds, {
  slide: (c, o, t) => {
    const n = c.createBufferSource();
    const len = 0.45;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / d.length) * Math.PI) * 0.6;
    n.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 700;
    n.connect(f);
    f.connect(o);
    n.start(t);
  },
  sprinkle: (c, o, t) => {
    const n = c.createBufferSource();
    const len = 1.9;
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * len), c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.08 ? 1 : 0.25) * Math.min(1, i / 3000) * Math.min(1, (d.length - i) / 9000);
    n.buffer = buf;
    const f = c.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2600;
    f.Q.value = 0.7;
    const g = c.createGain();
    g.gain.value = 0.45;
    n.connect(f);
    f.connect(g);
    g.connect(o);
    n.start(t);
  },
  sow: (c, o, t) => [0, 0.05, 0.11].forEach((d) => Sfx.tone(c, o, t + d, 1900 + Math.random() * 500, 0.03, { type: 'triangle', vol: 0.12 })),
  pluck: (c, o, t) => Sfx.tone(c, o, t, 620, 0.09, { type: 'sine', vol: 0.4, glide: 980 }),
  snip: (c, o, t) => [0, 0.09].forEach((d) => Sfx.tone(c, o, t + d, 2800, 0.035, { type: 'square', vol: 0.08, glide: 1800 })),
});

Object.assign(Actions, {
  'house-veranda': () => VerandaLife.go(),
  'veranda-in': () => VerandaLife.goIn(),
  'veranda-water': () => VerandaLife.water(),
  'veranda-pick': () => VerandaLife.harvest(),
  'veranda-sheet': () => VerandaLife.sheet(),
});
