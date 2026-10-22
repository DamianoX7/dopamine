'use strict';
/* ==================================================================
   State — game progress, messages, the pet & settings in localStorage.
   A backup copy is mirrored into IndexedDB (db.js), and when the site
   runs on server.py another one goes to the server (sync.js). The covers
   themselves (audio, artwork, albums) belong to the studio modules —
   see js/cover-host.js.
   ================================================================== */
const STORE_KEY = 'dopamineWorld.v1';
const CFG = window.DW_CONFIG || {};

function defaultState() {
  return {
    version: 1,
    createdAt: new Date().toISOString(),
    onboarded: false,
    user: { nickname: '', artistName: '' },
    dopamine: { points: 0, level: 1, xp: 0, coins: 0 },
    coverMeta: {}, // cover (single) id → { plays, rare }
    singing: {
      totalRecordings: 0,
      totalSeconds: 0,
      currentStreak: 0,
      longestStreak: 0,
      lastRecordingDate: null,
      days: {}, // 'YYYY-MM-DD' → seconds sung that day
    },
    achievements: {}, // id → ISO date unlocked
    statistics: {
      gamesPlayed: 0,
      rareEvents: 0,
      secretEvents: 0,
      listens: 0,
      messagesOpened: 0,
      petTaps: 0,
      luckySpins: 0,
      best: {},
      wrappedViewed: 0,
      foxLetters: 0, // letters a fox brought her
      photos: 0, //     pictures she took of the foxes
      raised: 0, //     kits she raised into grown foxes
      concerts: 0, //   covers she played to the foxes
      trips: 0, //      gifts a fox brought her from an expedition
      rainy: 0, //      days she looked in on the foxes while it rained
      snowy: 0, //      …and while it snowed
      puddles: 0, //    times a fox jumped into a puddle while she watched
      radio: 0, //      songs the fox radio played her (js/radio.js)
    },
    daily: {
      date: null,
      challenge: null,
      challengeDone: false,
      challengeProgress: 0,
      missions: [],
      bonusClaimed: false,
      luckyFree: 3,
      takes: 0,
      golden: false,
      petDopamine: 0,
      listenDopamine: 0,
      kitCare: {}, // kit → how much it has grown today (there is only so much growing in a day)
      concerts: 0, // covers played to the foxes today that made them happier
      yardFun: 0, //  …and how often their playing in the yard did
      daysHailed: false, // a day worth remembering (js/days.js) has been announced today
      skySeen: {}, // the weather she has seen in the foxes' world today ('rain', 'snow')
    },
    messages: { custom: [], hidden: [], edited: {}, special: {}, seen: [] },
    // letters he wrote and sent her (js/post.js): { id, text, at: when written, on: 'YYYY-MM-DD' it waits for (or ''), via: 'here' | 'server', read: when she read it (0 = not yet) }
    post: { inbox: [] },
    // The foxes share one mood (happiness, fullness, bond): they are fed and played with together.
    pet: {
      name: CFG.petName || '모찌', // the name of the fox she is with — what the rest of the site calls "the fox"
      named: false, //       has she named her first fox herself?
      happiness: 80,
      fullness: 80,
      bond: 0,
      lastTick: Date.now(),
      species: 'red', //     the fox she is with: on Home, in pop-ups, the one being dressed (js/pet.js: FOXES)
      foxes: ['red'], //     foxes she has (grown ones and "-baby" kits)
      out: ['red'], //       …and which of them live in the yard together (1 to 5); the others rest
      names: {}, //          fox → what she called it
      outfits: {}, //        fox → accessories it is wearing
      growth: {}, //         kit → how far it has grown, 0 … 100 (cared for, it gets there in some days)
      stay: {}, //           kit → true: she wants it to stay a kit
      mailAt: 0, //          when a fox last brought her one of his letters
      trip: null, //         a fox that is out exploring: { fox, place, at, back } (times in ms; back = when it is home again)
      finds: {}, //          what the foxes have brought her from their expeditions: gift → how many (js/pet.js: TRIP_FINDS)
      owned: [], //          accessories she has
      things: [], //         things standing in the yard ('mic')
      decor: [], //          what she has bought for the yard: a house, a swing, a pond… (js/pet.js: YARD_ITEMS)
      yard: [], //           …and where the ones that are out stand: { id, x, z, r } (the 3D side's measure; r = eighths of a turn)
      scene: 'meadow', //    where they live (HABITATS)
      scenes: ['meadow'],
      taught: false, //      has she tapped the ground or a fox yet?
      toured: false, //      …and been told that the view slides over the country round the yard?
      metOwner: false, //    …and that the foxes have an owner now, who lives in the yard with them?
      introduced: false, //  …and has that owner said her first hello, and shown her round? (js/meet.js)
      // the chats she strikes up now and then (js/chat.js): when the last one was, how many on which day, what about,
      // the day she last gave something — and when the foxes' world was last visited
      chat: { at: 0, day: '', today: 0, last: [], gift: '', seen: 0 },
    },
    mallang: { mode: 'soft', soft: 'fox', wax: 'cotton' }, // 말랑 놀이터: the toy she had out last (js/mallang.js)
    // her diary (js/diary.js): what she did, a day at a time ('YYYY-MM-DD' → counts; kept for some weeks), the pages she
    // wrote (day → { mood, note, stickers, lines, photo, sum, at }), the months whose album she was given, the day she was told the page was ready
    diary: { log: {}, pages: {}, albums: {}, hailed: '' },
    lp: {}, // her albums pressed into records (js/lp.js): album id → { color, at }
    halloween: { year: 0 }, // the last Halloween she played trick or treat with Lorelei (js/halloween.js)
    christmas: { year: 0 }, // …and the last Christmas Lorelei gave her a present (js/christmas.js)
    opening: { seen: false, greeted: false }, //           the rooms that open on a day of their own (js/opening.js): has she stood before them shut — and been told that they opened?
    // season: 'auto' = the foxes' world follows the calendar; or 'spring', 'summer', 'autumn', 'winter' (js/weather.js)
    settings: { soundEnabled: true, theme: 'pink', lateNight: 'auto', reduceMotion: false, foxFullscreen: true, season: 'auto' },
  };
}

/* Fill in any fields added in newer versions without touching saved values. */
function mergeDefaults(def, val) {
  if (Array.isArray(def)) return Array.isArray(val) ? val : def;
  if (def && typeof def === 'object') {
    const src = val && typeof val === 'object' && !Array.isArray(val) ? val : {};
    const out = {};
    Object.keys(def).forEach((k) => (out[k] = mergeDefaults(def[k], src[k])));
    Object.keys(src).forEach((k) => {
      if (!(k in out)) out[k] = src[k];
    });
    return out;
  }
  return val === undefined ? def : val;
}

/* Older saves: first the pet wore one accessory and had no kinds or habitats; then one fox was out at a time, with one name and one outfit. */
function upgradeState(s) {
  const p = s.pet;
  const defaultName = CFG.petName || '모찌';
  if ('accessory' in p) {
    p.worn = p.worn || [];
    if (p.accessory && !p.worn.includes(p.accessory)) p.worn.push(p.accessory);
    if (p.name === 'Mochi') p.name = defaultName; // the old default name, now that the site is in Korean
    delete p.accessory;
  }
  if (!p.foxes.includes('red')) p.foxes.unshift('red');
  if (!p.scenes.includes('meadow')) p.scenes.unshift('meadow');
  if (!p.foxes.includes(p.species)) p.species = 'red';
  if (!p.scenes.includes(p.scene)) p.scene = 'meadow';
  if ('worn' in p) {
    // the fox that was out keeps its name and its outfit; the microphone now stands in the yard
    const worn = p.worn.filter((id) => p.owned.includes(id));
    p.outfits = { [p.species]: worn.filter((id) => id !== 'mic') };
    p.things = worn.includes('mic') ? ['mic'] : [];
    p.names = { [p.species]: p.name };
    p.out = [p.species];
    delete p.worn;
  }
  // a family of one to five, and the fox she is with is one of them
  p.out = p.out.filter((id, i) => p.foxes.includes(id) && p.out.indexOf(id) === i).slice(0, 5);
  if (!p.out.length) p.out = [p.species];
  if (!p.out.includes(p.species)) p.species = p.out[0];
  if (!p.names[p.species]) p.names[p.species] = p.name || defaultName;
  p.name = p.names[p.species];
  if (p.name !== defaultName) p.named = true; // she chose that name herself
  p.foxes.forEach((id) => (p.outfits[id] = (p.outfits[id] || []).filter((a) => p.owned.includes(a) && a !== 'mic')));
  p.things = p.things.filter((id) => p.owned.includes(id));
  // only things she has stand in the yard, each of them once
  p.yard = p.yard.filter((it, i) => it && p.decor.includes(it.id) && p.yard.findIndex((x) => x && x.id === it.id) === i);
  // only kits she still has are growing
  for (const key of ['growth', 'stay']) Object.keys(p[key]).forEach((id) => p.foxes.includes(id) || delete p[key][id]);
  return s;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return upgradeState(mergeDefaults(defaultState(), JSON.parse(raw)));
  } catch (e) {
    console.warn('[Store] could not read saved state', e);
  }
  return defaultState();
}

let State = loadState();
let storageWarned = false;

const Store = {
  save: debounce(() => Store.saveNow(), 250),

  saveNow() {
    if (this.wiped) return; // "Delete everything" ran — the reload must not write the old state back
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(State));
    } catch (e) {
      console.warn('[Store] localStorage write failed', e);
      if (!storageWarned && typeof UI !== 'undefined') {
        storageWarned = true;
        UI.toast('이 기기에 진행 상황을 저장하지 못했어요 (저장 공간이 가득 찼거나 막혀 있어요).', { icon: '⚠️', ms: 4500 });
      }
    }
    Store.mirror();
    Sync.noteSaved();
  },

  /* Another device's progress, fetched by Sync, takes the place of this one's. */
  adopt(json) {
    State = upgradeState(mergeDefaults(defaultState(), JSON.parse(json)));
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(State));
    } catch (e) {
      /* ignore */
    }
    Store.mirror();
  },

  mirror: debounce(() => {
    if (Store.wiped) return;
    DB.put('meta', { id: 'state', json: JSON.stringify(State), savedAt: Date.now() }).catch(() => {});
  }, 1500),

  /* If localStorage was wiped but IndexedDB kept the backup, bring it back. */
  async restoreFromMirror() {
    let hasLocal = false;
    try {
      hasLocal = !!localStorage.getItem(STORE_KEY);
    } catch (e) {
      /* ignore */
    }
    if (hasLocal) return false;
    try {
      const rec = await DB.get('meta', 'state');
      if (rec && rec.json) {
        State = upgradeState(mergeDefaults(defaultState(), JSON.parse(rec.json)));
        Store.saveNow();
        return true;
      }
    } catch (e) {
      /* ignore */
    }
    return false;
  },

  /* Game progress only — covers, albums, messages & settings stay. */
  resetProgress() {
    const d = defaultState();
    State.dopamine = d.dopamine;
    State.achievements = {};
    State.statistics = d.statistics;
    State.daily = d.daily;
    State.pet = Object.assign(d.pet, { name: State.pet.name, named: State.pet.named, names: { red: State.pet.name } });
    State.singing.currentStreak = 0;
    State.singing.longestStreak = 0;
    Store.saveNow();
  },

  /* Everything, including the covers library kept by the studio modules and the server's copy. */
  async resetAll() {
    this.wiped = true;
    await Sync.wipe();
    try {
      localStorage.removeItem(STORE_KEY);
      ['coverStudio.prefs.v1', 'coverStudio.session.v1', 'dopamineWorld.foxFace.v1', 'dopamineWorld.letterDraft.v1', 'dopamineWorld.letterPending.v1', 'dopamineWorld.writerKey.v1', 'dopamineWorld.doorTries.v1'].forEach((k) => localStorage.removeItem(k));
    } catch (e) {
      /* ignore */
    }
    await DB.clearAll().catch(() => {});
    await new Promise((resolve) => {
      try {
        const req = indexedDB.deleteDatabase('cover-studio');
        req.onsuccess = req.onerror = req.onblocked = () => resolve(); // "blocked" finishes once the page reloads
      } catch (e) {
        resolve();
      }
    });
  },
};
