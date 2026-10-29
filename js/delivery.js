'use strict';
/* ==================================================================
   🛵 도파민 배달 — the girl in the house (js/avatar.js) orders in.

   From the menu — bubble tea, tanghulu, tteokbokki, malatang, fried
   chicken, pizza — she picks something for her and pays in coins;
   out comes her phone. A minute or so later there is a knock at the
   door: the courier, a paper bag in his hand. She goes to the door
   (out of bed, if it is a late-night snack), and on the doorstep they
   talk a little as he gives it to her — what she ordered, a word on
   the weather or the hour, goodbyes — and then she sits down and eats
   it, a mouthful at a time. The 3D side is js/house/courier.js (him),
   js/house/resident.js (her) and js/house/food.js (the dishes).

   What is on its way is State.house.food.order — it waits for her if
   she closes the house before it comes; and what she has eaten, how
   many times, State.house.food.ate.
   ================================================================== */

const RIDER_NAME = '배달원';
/* The menu: price in coins, how long it takes to come (s), how she eats it, and what the courier says about it. */
const DELIVERY_MENU = [
  { id: 'bubbletea', emoji: '🧋', name: '흑당 버블티', price: 30, wait: 35, desc: '쫀득한 펄 듬뿍', extra: ['펄 듬뿍 넣어 드렸어요 🧋', '얼음 적게 맞으시죠?'] },
  { id: 'tanghulu', emoji: '🍓', name: '딸기 탕후루', price: 30, wait: 35, desc: '와작! 달콤 바삭', extra: ['방금 만들어서 바삭해요 🍓', '녹기 전에 얼른 드세요!'] },
  { id: 'tteokbokki', emoji: '🌶️', name: '떡볶이', price: 50, wait: 50, desc: '쫀득한 떡에 어묵, 계란 반쪽', extra: ['단무지 서비스로 넣었어요 😉', '계란 하나 더 넣어 드렸어요!'] },
  { id: 'malatang', emoji: '🍜', name: '마라탕', price: 60, wait: 60, desc: '얼얼한 국물, 맵기 2단계', extra: ['맵기 2단계 맞으시죠? 🌶️', '뜨거우니까 조심해서 드세요!'] },
  { id: 'chicken', emoji: '🍗', name: '후라이드 치킨', price: 80, wait: 70, desc: '겉바속촉 닭다리', extra: ['방금 튀긴 거예요! 🍗', '콜라도 같이 넣었어요 🥤'] },
  { id: 'pizza', emoji: '🍕', name: '페퍼로니 피자', price: 70, wait: 60, desc: '치즈가 쭉 늘어나요', extra: ['피클이랑 소스 넣어 드렸어요', '아직 따끈따끈해요! 🍕'] },
];
/* What the courier says — '{food}' is what she ordered. */
const RIDER_LINES = {
  knock: ['똑똑! 배달 왔습니다~ 🛵', '배달이요~! 🛵', '똑똑똑! 주문하신 음식 왔어요~'],
  knock2: ['계세요~? 배달 왔어요!', '똑똑! 문 앞에 왔습니다~'],
  hand: ['주문하신 {food} 나왔습니다!', '{food} 시키신 분~! 여기요 😊', '{food} 배달 왔습니다! 따끈할 때 드세요'],
  rain: ['비가 와서 조금 늦었어요, 죄송해요 ☔', '비 오는 날엔 역시 배달이죠! ☔'],
  snow: ['눈길 뚫고 왔어요! ⛄', '밖에 눈 와요, 따뜻하게 드세요 ❄️'],
  cold: ['날이 추워요, 따뜻하게 드세요!'],
  hot: ['오늘 덥죠? 시원하게 드세요!'],
  night: ['야식이네요! 맛있게 드세요 🌙', '늦은 시간에도 도파민 배달! 🌙'],
  bye: ['맛있게 드세요~! 👋', '좋은 하루 보내세요!', '리뷰 부탁드려요 ⭐', '감사합니다~ 또 불러 주세요!'],
  bye_night: ['좋은 밤 되세요~ 🌙', '맛있게 드시고 푹 주무세요!'],
  tap: ['안녕하세요! 🛵', '도파민 배달입니다 😊', '오늘도 배달 중이에요!'],
};

const Delivery = {
  coming: false, //  the courier is on his way up to the door (or there)
  knocked: false, // …and has knocked
  current: null, //  what she is eating, once it is hers

  state() {
    const h = State.house;
    if (!h.food || typeof h.food !== 'object') h.food = { order: null, ate: {}, eating: null };
    return h.food;
  },
  item(id) {
    return DELIVERY_MENU.find((x) => x.id === id) || null;
  },
  /** What is on its way: { id, at, eta } — or null. */
  pending() {
    const o = this.state().order;
    return o && this.item(o.id) ? o : null;
  },
  /** Is she busy with something to eat (on its way, at the door, being eaten)? */
  busy() {
    return !!(this.pending() || this.current || (HouseHost.api && HouseHost.api.eating()));
  },
  /** What she ordered (for the lines): on its way, or being eaten. */
  foodName() {
    const o = this.pending();
    const f = this.item(this.current || (o && o.id));
    return f ? f.name : '배달 음식';
  },

  /* ----- the menu ----- */

  sheet() {
    Sfx.play('pop');
    const o = this.pending();
    const eating = !o && this.busy();
    const st = this.state();
    const name = Avatar.name();
    let hint = `${josa(name, '이/가')} 먹을 걸 골라 주세요. 주문하면 잠시 뒤에 배달원이 문을 두드려요.`;
    if (o) hint = `🛵 ${josa(this.item(o.id).name, '이/가')} 오고 있어요. 한 번에 하나씩 시킬 수 있어요.`;
    else if (eating) hint = `😋 ${josa(name, '이/가')} 먹는 중이에요. 다 먹으면 또 시킬 수 있어요.`;
    const off = !!o || eating;
    const ov = UI.open(
      `<div class="house-sheet">
        <div class="sheet-handle" aria-hidden="true"></div>
        <h2>🛵 도파민 배달</h2>
        <p class="hint">${esc(hint)}</p>
        <div class="food-menu">${DELIVERY_MENU.map((f) => {
          const n = st.ate[f.id] || 0;
          return `<button class="food-item ${o && o.id === f.id ? 'on' : ''}" data-food="${f.id}" ${off ? 'disabled' : ''}>
            <span class="food-pic" data-food-thumb="${f.id}" aria-hidden="true">${f.emoji}</span>
            <b>${esc(f.name)}</b><span class="food-desc">${esc(f.desc)}</span>
            <small><b>${f.price} 🪙</b> · 🛵 ${f.wait < 60 ? `${f.wait}초` : `약 ${Math.round(f.wait / 60)}분`}</small>
            ${n ? `<i class="food-ate">${n}번 먹었어요</i>` : ''}
          </button>`;
        }).join('')}</div>
      </div>`,
      { cls: 'is-house-sheet', label: '배달 메뉴' }
    );
    this.fillThumbs(ov.panel);
    ov.panel.addEventListener('click', (e) => {
      const b = e.target.closest('[data-food]');
      if (!b || b.disabled) return;
      UI.close(ov);
      this.order(b.dataset.food);
    });
  },

  /* The menu's pictures, one at a time (as the shop's: opening it never stutters). */
  fillThumbs(root) {
    const api = HouseHost.api;
    if (!api) return;
    const next = () => {
      const el = $('[data-food-thumb]:not(.has-img)', root);
      if (!el || !el.isConnected) return;
      el.classList.add('has-img');
      const url = api.foodThumb(el.dataset.foodThumb);
      if (url) el.innerHTML = `<img src="${url}" alt="">`;
      setTimeout(next, 30);
    };
    setTimeout(next, 60);
  },

  async order(id) {
    const f = this.item(id);
    if (!f || this.busy()) return;
    const ok = await UI.confirm({ icon: f.emoji, title: `${josa(f.name, '을/를')} 시켜 줄까요?`, text: `🪙 ${f.price} 코인이에요. 주문하면 ${f.wait < 60 ? `${f.wait}초` : `1분`}쯤 뒤에 배달원이 문을 두드려요.`, ok: `${f.price} 🪙 주문하기` });
    if (!ok || this.busy() || !Pet.spend(f.price)) return;
    const st = this.state();
    st.order = { id, at: Date.now(), eta: Date.now() + f.wait * 1000 };
    Store.save();
    Sfx.play('coin');
    if (HouseHost.api) HouseHost.api.order({ id, name: f.name });
    HouseHost.sync();
    HouseRoom.refresh();
  },

  /* ----- while the house is open (HouseRoom.frame: twice a second) ----- */

  tick() {
    if (!HouseRoom.ov) return;
    this.chip();
    const o = this.pending();
    if (!o || this.coming || Date.now() < o.eta) return;
    // (the door when nothing else is going on: not while she is arranging, being dressed, or has something open; nor while Lorelei comes or goes)
    const api = HouseHost.api;
    if (!api || HouseRoom.editOn || HouseRoom.meOn || UI.top() !== HouseRoom.ov || api.doorBusy()) return;
    if (api.deliver({ id: o.id, name: this.item(o.id).name })) {
      this.coming = true;
      this.knocked = false;
    }
  },

  /** "🛵 마라탕 오는 중 · 0:42" over the view. */
  chip() {
    const el = HouseRoom.ov && $('[data-house-food]', HouseRoom.ov.panel);
    if (!el) return;
    const o = this.pending();
    const shown = !!o && !HouseRoom.editOn && !HouseRoom.meOn;
    el.hidden = !shown;
    if (!shown) return;
    const left = Math.max(0, Math.ceil((o.eta - Date.now()) / 1000));
    const html = `<span aria-hidden="true">🛵</span> <b>${esc(this.item(o.id).name)} ${left ? '오는 중' : '도착!'}</b><small>${left ? `${Math.floor(left / 60)}:${pad2(left % 60)} 남았어요` : '문 앞에 왔어요'}</small>`;
    if (el.dataset.html !== html) {
      el.dataset.html = html;
      el.innerHTML = html;
    }
  },

  /** What the 3D side tells: 'knock' (he is at the door), 'handed' (it is hers), 'done' (all eaten), 'gone' (he has left). */
  said(what, o) {
    if (what === 'knock') {
      Sfx.play('knock');
      if (!this.knocked) UI.toast(`똑똑! ${this.foodName()} 배달 왔어요`, { icon: '🛵', kind: 'gold', ms: 3200 });
      this.knocked = true;
      return;
    }
    if (what === 'handed') {
      const st = this.state();
      const id = (o && o.id) || (st.order && st.order.id);
      st.order = null;
      if (id) {
        st.ate[id] = (st.ate[id] || 0) + 1;
        st.eating = { id, at: Date.now() };
        this.current = id;
        const f = this.item(id);
        if (f) Diary.add('food', f.name);
      }
      this.coming = false;
      this.knocked = false;
      Store.save();
      HouseHost.sync();
      HouseRoom.refresh();
      Game.checkAchievements();
      return;
    }
    if (what === 'done') {
      this.state().eating = null;
      this.current = null;
      Store.save();
      HouseRoom.refresh();
      return;
    }
    if (what === 'gone') this.coming = false;
  },

  /** The house was closed (what was on its way still is; what she was eating, she has finished). */
  closed() {
    this.coming = false;
    this.knocked = false;
    this.current = null;
    this.state().eating = null;
  },

  /** What the courier says about `kind` (the weather, the hour, the dish). */
  riderLine(kind) {
    const o = this.pending();
    const f = this.item(this.current || (o && o.id)) || DELIVERY_MENU[0];
    const hour = new Date().getHours();
    const night = hour >= 22 || hour < 5;
    let list = RIDER_LINES[kind] || [];
    if (kind === 'extra') {
      // (the dish, most often — the rain or the snow, the cold, the hour, when there is something to say about them)
      const w = House.weather();
      const city = CityWeather.now();
      list = [...(f.extra || []), ...(f.extra || [])];
      if (w.kind === 'rain') list.push(...RIDER_LINES.rain, ...RIDER_LINES.rain);
      else if (w.kind === 'snow') list.push(...RIDER_LINES.snow, ...RIDER_LINES.snow);
      else if (city && city.temp <= 5) list.push(...RIDER_LINES.cold);
      else if (city && city.temp >= 28) list.push(...RIDER_LINES.hot);
      if (night) list.push(...RIDER_LINES.night, ...RIDER_LINES.night);
    }
    if (kind === 'bye' && night) list = RIDER_LINES.bye_night;
    if (!list.length) return '';
    return pick(list).replace(/\{food\}/g, f.name);
  },
};

Object.assign(Actions, {
  'house-food': () => Delivery.sheet(),
});
