'use strict';
/* ==================================================================
   The dopamine game: points, XP & levels, coins, achievements, the
   singing streak, today's challenge & missions, boyfriend messages,
   rare events and playful titles.
   ================================================================== */

const TITLES = [
  { min: 0, emoji: '🌱', name: '미래의 스타' },
  { min: 1, emoji: '🎤', name: '루키' },
  { min: 5, emoji: '💿', name: '믹스테이프' },
  { min: 10, emoji: '🎧', name: '방구석 아티스트' },
  { min: 20, emoji: '🌟', name: '주인공' },
  { min: 50, emoji: '👑', name: '도파민 레전드' },
];

const ACHIEVEMENTS = [
  { id: 'first_take', emoji: '🎤', name: '첫 녹음', desc: '첫 번째 노래를 녹음해요.', test: (s) => s.singing.totalRecordings >= 1 },
  { id: 'first_release', emoji: '💿', name: '첫 발매', desc: '첫 커버를 저장해요.', test: () => Music.released().length >= 1 },
  { id: 'listener', emoji: '🎧', name: '리스너', desc: '내 녹음을 10번 들어요.', test: (s) => s.statistics.listens >= 10 },
  { id: 'singer', emoji: '🎙️', name: '가수', desc: '커버 5곡을 저장해요.', test: () => Music.released().length >= 5 },
  { id: 'mixtape', emoji: '📼', name: '믹스테이프', desc: '커버 10곡을 만들어요.', test: () => Music.released().length >= 10 },
  { id: 'streak7', emoji: '🔥', name: '노래 연속 기록', desc: '7일 연속으로 노래해요.', test: (s) => s.singing.longestStreak >= 7 },
  { id: 'perfectionist', emoji: '✨', name: '완벽주의자', desc: '같은 노래의 커버를 5개 저장해요.', test: () => Music.songs().some((so) => so.covers.length >= 5) },
  { id: 'artist3am', emoji: '🌙', name: '새벽 3시의 아티스트', desc: '늦은 밤에 노래를 녹음해요.', test: () => Music.all().some((c) => c.lateNight) },
  { id: 'main_character', emoji: '🌟', name: '주인공', desc: '커버 20곡을 만들어요.', test: () => Music.released().length >= 20 },
  { id: 'legend', emoji: '👑', name: '도파민 레전드', desc: '커버 50곡을 만들어요.', test: () => Music.released().length >= 50 },
  { id: 'full_song', emoji: '🎼', name: '완곡', desc: '3분이 넘는 녹음을 해요.', test: (s) => (s.singing.longestTake || 0) >= 180 || Music.all().some((c) => c.rawDuration >= 180) },
  { id: 'marathon', emoji: '⏱️', name: '마라톤', desc: '모두 합쳐 30분 동안 노래해요.', test: (s) => s.singing.totalSeconds >= 1800 },
  { id: 'straight_in', emoji: '🖥️', name: '원음 그대로', desc: '데스크톱 오디오로 녹음한 커버를 저장해요.', test: () => Music.released().some((c) => c.sourceType === 'tab') },
  { id: 'art_director', emoji: '🎨', name: '아트 디렉터', desc: '커버에 나만의 그림을 넣어요.', test: () => Music.released().some((c) => c.hasArtwork) },
  { id: 'lyric_sheet', emoji: '📝', name: '가사집', desc: '가사와 함께 커버를 저장해요.', test: () => Music.released().some((c) => c.hasLyrics) },
  { id: 'on_repeat', emoji: '🔁', name: '무한 반복', desc: '커버 하나를 5번 들어요.', test: () => Music.all().some((c) => c.plays >= 5) },
  { id: 'lucky_take', emoji: '🍀', name: '행운의 녹음', desc: '레어 커버를 얻어요.', test: () => Music.all().some((c) => c.rare) },
  { id: 'album', emoji: '📀', name: '앨범 발매', desc: '첫 앨범을 만들어요.', test: () => Music.albums().length >= 1 },
  { id: 'gamer', emoji: '🎮', name: '플레이어 원', desc: '미니게임을 10번 해요.', test: (s) => s.statistics.gamesPlayed >= 10 },
  { id: 'lightning', emoji: '⚡', name: '번개 같은 반사신경', desc: '반응 속도 테스트에서 평균 250ms 안에 들어요.', test: (s) => (s.statistics.best.reaction || 9999) < 250 },
  { id: 'big_brain', emoji: '🧠', name: '빅 브레인', desc: '숫자 기억에서 8자리를 기억해요.', test: (s) => (s.statistics.best.numbers || 0) >= 8 },
  { id: 'memory_master', emoji: '🃏', name: '기억력 마스터', desc: '카드 짝 맞추기를 9번 안에 끝내요.', test: (s) => (s.statistics.best.memory || 99) <= 9 },
  { id: 'color_pro', emoji: '🌈', name: '컬러 프로', desc: '컬러 탭에서 20점 이상을 받아요.', test: (s) => (s.statistics.best.colors || 0) >= 20 },
  { id: 'jackpot', emoji: '🎰', name: '잭팟', desc: '행운의 버튼에서 잭팟을 터뜨려요.', test: (s) => !!s.statistics.best.jackpot },
  { id: 'level5', emoji: '⭐', name: '레벨 5', desc: '레벨 5가 돼요.', test: (s) => s.dopamine.level >= 5 },
  { id: 'level10', emoji: '🌠', name: '레벨 10', desc: '레벨 10이 돼요.', test: (s) => s.dopamine.level >= 10 },
  { id: 'letters', emoji: '💌', name: '러브레터', desc: '남자친구의 메시지를 10번 열어요.', test: (s) => s.statistics.messagesOpened >= 10 },
  { id: 'best_friends', emoji: '🦊', name: '단짝 친구', desc: '여우를 30번 쓰다듬어요.', test: (s) => s.statistics.petTaps >= 30 },
  { id: 'fashion', emoji: '🎀', name: '패셔니스타', desc: '여우에게 장식을 사 줘요.', test: (s) => s.pet.owned.length >= 1 },
  { id: 'fox_family', emoji: '🐾', name: '여우 가족', desc: '여우 세 마리와 함께해요.', test: (s) => s.pet.foxes.length >= 3 },
  { id: 'fox_baby', emoji: '🍼', name: '아기 여우', desc: '아기 여우를 데려와요.', test: (s) => s.statistics.raised > 0 || s.pet.foxes.some((id) => id.includes('-baby')) },
  { id: 'full_house', emoji: '🏡', name: '북적북적', desc: '여우 다섯 마리가 함께 지내요.', test: (s) => s.pet.out.length >= 5 },
  { id: 'grown_up', emoji: '🌱', name: '다 컸네', desc: '아기 여우를 어른으로 키워요.', test: (s) => s.statistics.raised >= 1 },
  { id: 'fox_post', emoji: '📮', name: '여우 우체부', desc: '여우가 물어다 준 편지를 5번 받아요.', test: (s) => s.statistics.foxLetters >= 5 },
  { id: 'shutterbug', emoji: '📷', name: '사진작가', desc: '여우 사진을 10장 찍어요.', test: (s) => s.statistics.photos >= 10 },
  { id: 'traveler', emoji: '🧳', name: '이사의 달인', desc: '여우가 살 곳을 세 군데 마련해요.', test: (s) => s.pet.scenes.length >= 3 },
  { id: 'fox_concert', emoji: '🪩', name: '여우 콘서트', desc: '여우들에게 내 커버를 들려줘요.', test: (s) => s.statistics.concerts >= 1 },
  { id: 'yard_first', emoji: '🏡', name: '마당 꾸미기', desc: '마당에 물건을 하나 놓아요.', test: (s) => s.pet.yard.length >= 1 },
  { id: 'playground', emoji: '🎠', name: '여우 놀이터', desc: '마당에 물건을 다섯 개 놓아요.', test: (s) => s.pet.yard.length >= 5 },
  { id: 'first_trip', emoji: '🧭', name: '첫 탐험', desc: '탐험에서 돌아온 여우에게 선물을 받아요.', test: (s) => s.statistics.trips >= 1 },
  { id: 'collector', emoji: '🧺', name: '선물 수집가', desc: '여우가 가져온 선물을 10가지 모아요.', test: (s) => Object.keys(s.pet.finds).length >= 10 },
  { id: 'lucky_find', emoji: '🍀', name: '행운의 발견', desc: '여우가 희귀한 선물을 가져와요.', test: (s) => Object.keys(s.pet.finds).some((id) => (TRIP_FINDS[id] || {}).rare) },
  { id: 'rainy_day', emoji: '☔', name: '비 오는 날', desc: '비 오는 날 여우들을 만나러 가요.', test: (s) => s.statistics.rainy >= 1 },
  { id: 'puddle_jump', emoji: '💦', name: '첨벙첨벙', desc: '여우가 웅덩이에 뛰어드는 모습을 봐요.', test: (s) => s.statistics.puddles >= 1 },
  { id: 'first_snow', emoji: '⛄', name: '첫눈', desc: '눈 오는 날 여우들을 만나러 가요.', test: (s) => s.statistics.snowy >= 1 },
  // (this one comes with a present: on that day Lorelei has a fox for her that no shop sells — js/present.js)
  { id: 'hundred_days', emoji: '💯', name: '백일', desc: '우리가 만난 지 100일째 되는 날을 함께 맞아요.', gift: true, test: () => Present.due() },
  { id: 'halloween', emoji: '🎃', name: '트릭 오어 트릿', desc: '핼러윈에 로렐라이와 사탕 놀이를 해요.', test: (s) => s.halloween.year > 0 },
  { id: 'christmas', emoji: '🎄', name: '메리 크리스마스', desc: '크리스마스에 로렐라이와 소원을 빌어요.', test: (s) => s.christmas.year > 0 },
  { id: 'moon_gaze', emoji: '🌙', name: '달 구경', desc: '여우 세상의 밤하늘을 올려다봐요.', test: (s) => s.moon.looked >= 1 },
  { id: 'full_moon', emoji: '🌕', name: '보름달 소원', desc: '보름달 뜨는 밤에 로렐라이와 소원을 빌어요.', test: (s) => s.moon.wishes.length >= 1 },
  { id: 'moon_year', emoji: '🌝', name: '열두 번의 보름달', desc: '보름달에 소원을 열두 번 빌어요.', test: (s) => s.moon.wishes.length >= 12 },
  { id: 'star_night', emoji: '🌌', name: '별 헤는 밤', desc: '밤하늘에서 우리 별자리의 별을 눌러 그날을 떠올려요.', test: (s) => !!s.stars.tapped },
  { id: 'star_sky', emoji: '🌠', name: '별이 빛나는 밤', desc: '우리 별자리에 별이 서른 개 떠요.', test: () => Stars.count() >= 30 },
  { id: 'dream_first', emoji: '💭', name: '꿈 이야기', desc: '여우가 꾼 꿈 이야기를 처음 들어요.', test: (s) => Object.keys(s.dreams.list).length >= 1 },
  { id: 'dream_week', emoji: '🛌', name: '꿈 일기장', desc: '여우의 꿈 이야기를 일곱 번 들어요.', test: (s) => Object.keys(s.dreams.list).length >= 7 },
  { id: 'garden_10', emoji: '💐', name: '꽃밭', desc: '노래 정원에 꽃이 열 송이 피어요.', test: () => Garden.count() >= 10 },
  { id: 'garden_kinds', emoji: '🌈', name: '다섯 가지 꽃', desc: '노래 정원에 다섯 가지 꽃이 모두 피어요.', test: () => Garden.kinds() >= 5 },
  { id: 'knit_first', emoji: '🧶', name: '한 땀 한 땀', desc: '그림을 그려 여우에게 스웨터를 떠 줘요.', test: (s) => s.knit.made >= 1 },
  { id: 'knit_family', emoji: '🧣', name: '패밀리룩', desc: '여우 세 마리가 내가 뜬 스웨터를 입어요.', test: (s) => s.pet.out.filter((id) => (s.pet.outfits[id] || []).some((a) => /^knit/.test(a))).length >= 3 },
  { id: 'house_warm', emoji: '🏠', name: '우리 집', desc: '둘의 집에 처음 들어가요.', test: (s) => !!s.house.made },
  { id: 'house_lp', emoji: '🎶', name: '우리 집 턴테이블', desc: '둘의 집 턴테이블로 LP를 들어요.', test: (s) => (s.statistics.houseLP || 0) >= 1 },
  { id: 'house_guest', emoji: '👧', name: '손님 맞이', desc: '로렐라이가 둘의 집에 놀러 와요.', test: (s) => !!s.house.guest.met },
  { id: 'house_decor', emoji: '🛋️', name: '인테리어 디자이너', desc: '둘의 집에 물건을 스무 개 놓아요.', test: (s) => s.house.items.length >= 20 },
  { id: 'house_big', emoji: '🏡', name: '넓은 집', desc: '둘의 집을 넓혀요.', test: (s) => s.house.size >= 1 },
  { id: 'house_style', emoji: '👗', name: '오늘의 코디', desc: '둘의 집에 사는 나에게 새 옷을 사 입혀요.', test: (s) => ((s.house.me && s.house.me.owned) || []).length >= 1 },
  { id: 'house_closet', emoji: '🛍️', name: '옷장 부자', desc: '둘의 집에 사는 나의 옷과 소품을 열 가지 모아요.', test: (s) => ((s.house.me && s.house.me.owned) || []).length >= 10 },
  { id: 'house_food', emoji: '🛵', name: '배달 왔어요', desc: '둘의 집에서 배달 음식을 처음 시켜 먹어요.', test: (s) => Object.keys((s.house.food && s.house.food.ate) || {}).length >= 1 },
  { id: 'house_foodie', emoji: '🍽️', name: '배달 맛집 탐방', desc: '배달 메뉴를 모두 한 번씩 먹어 봐요.', test: (s) => Object.keys((s.house.food && s.house.food.ate) || {}).length >= DELIVERY_MENU.length },
  { id: 'town_out', emoji: '🏘️', name: '동네 산책', desc: '둘의 집 밖, 우리 동네에 처음 나가요.', test: (s) => ((s.house.town && s.house.town.outs) || 0) >= 1 },
  { id: 'town_store', emoji: '🏪', name: '편의점 단골', desc: '도파민 편의점에서 열 번 계산해요.', test: (s) => ((s.house.town && s.house.town.shops) || 0) >= 10 },
  { id: 'town_cafe', emoji: '☕', name: '카페 몽글 손님', desc: '카페 몽글에서 음료를 마셔요.', test: (s) => Object.keys((s.house.town && s.house.town.cafe) || {}).length >= 1 },
  { id: 'town_sing', emoji: '🎤', name: '코노 스타', desc: '코인노래방에서 내 커버를 불러요.', test: (s) => ((s.house.town && s.house.town.sung) || 0) >= 1 },
  { id: 'cook_first', emoji: '🍳', name: '첫 요리', desc: '둘의 집 부엌에서 처음 요리해요.', test: (s) => Object.keys((s.house.cook && s.house.cook.made) || {}).length >= 1 },
  { id: 'cook_all', emoji: '👩‍🍳', name: '요리왕', desc: '레시피를 모두 만들어 봐요.', test: (s) => Object.keys((s.house.cook && s.house.cook.made) || {}).length >= RECIPES.length },
  { id: 'cook_star', emoji: '⭐', name: '완벽한 한 접시', desc: '별 세 개짜리 요리를 만들어요.', test: (s) => Object.values((s.house.cook && s.house.cook.best) || {}).some((n) => n >= 3) },
  { id: 'cook_burnt', emoji: '🔥', name: '앗 뜨거', desc: '요리를 태워 봐요. 그래도 맛있게 먹었어요!', test: (s) => ((s.house.cook && s.house.cook.burnt) || 0) >= 1 },
  { id: 'radio_fm', emoji: '📻', name: '도파민 FM', desc: '여우 라디오로 내 노래를 세 곡 들어요.', test: (s) => (s.statistics.radio || 0) >= 3 },
  { id: 'four_cut', emoji: '🎞️', name: '인생네컷', desc: '여우들과 네 컷 사진을 찍어요.', test: (s) => (s.statistics.fourCuts || 0) >= 1 },
  { id: 'lp_press', emoji: '💿', name: '레코드 프레스', desc: '앨범을 LP로 구워요.', test: (s) => Object.keys(s.lp).length >= 1 },
  { id: 'diary_first', emoji: '📔', name: '오늘의 한 장', desc: '하루 끝 한 장을 처음 완성해요.', test: (s) => Object.keys(s.diary.pages).length >= 1 },
  { id: 'diary_week', emoji: '🗓️', name: '일주일 일기', desc: '일기를 일곱 장 써요.', test: (s) => Object.keys(s.diary.pages).length >= 7 },
  { id: 'month_album', emoji: '📖', name: '한 달의 우리', desc: '한 달 동안 쓴 일기가 앨범이 돼요.', test: (s) => Object.keys(s.diary.albums).length >= 1 },
  { id: 'wrapped', emoji: '🎁', name: '결산 완료', desc: '커버 결산을 봐요.', test: (s) => s.statistics.wrappedViewed >= 1 },
  { id: 'night_owl', emoji: '🦉', name: '올빼미', desc: '심야 스튜디오에 들러요.', test: (s) => !!s.statistics.lateNightVisit },
  { id: 'secret', emoji: '🔮', name: '비밀 발견', desc: '비밀을 찾아요.', test: (s) => s.statistics.secretEvents >= 1 },
];

/* One per day. `on` = which event can complete it. */
const CHALLENGES = [
  { id: 'sing30', emoji: '⏱️', text: '30초 동안 노래하기', hint: '30초 이상 한 번 녹음해 보세요.', on: 'take', test: (t) => t.rawDuration >= 30 },
  { id: 'trimIt', emoji: '✂️', text: '커버를 박자에 딱 맞게 자르기', hint: '믹스 & 자르기에서 앞이나 뒤를 잘라 낸 다음 저장하세요.', on: 'release', test: (c) => c.trimmed },
  { id: 'chorusTwice', emoji: '🔁', text: '후렴을 두 번 녹음하기', hint: '오늘 두 번 녹음해 보세요.', on: 'take', test: () => State.daily.takes >= 2 },
  { id: 'newSong', emoji: '🆕', text: '처음 불러 보는 노래에 도전하기', hint: '아직 커버한 적 없는 노래를 저장하세요.', on: 'release', test: (c) => Music.takesOf(c.songId).length <= 1 },
  { id: 'artwork', emoji: '🎨', text: '커버 그림 꾸미기', hint: '“커버 디자인하기”를 쓰거나 사진을 넣은 다음 저장하세요.', on: 'release', test: (c) => c.hasArtwork },
  { id: 'lyrics', emoji: '📝', text: '가사와 함께 커버 저장하기', hint: '녹음 화면에서 가사를 입력하거나 붙여 넣으세요.', on: 'release', test: (c) => c.hasLyrics },
  { id: 'oneMinute', emoji: '🎼', text: '1분 내내 노래하기', hint: '60초 이상 한 번 녹음해 보세요.', on: 'take', test: (t) => t.rawDuration >= 60 },
  { id: 'fullSong', emoji: '🎶', text: '한 곡을 끝까지 부르기', hint: '3분 이상 한 번 녹음해 보세요.', on: 'take', test: (t) => t.rawDuration >= 180 },
  { id: 'listen3', emoji: '🎧', text: '내 커버 3번 듣기', hint: '내 커버를 세 번 재생해 보세요.', on: 'listen', target: 3 },
  { id: 'surprise', emoji: '🎲', text: '“노래 골라줘”가 골라 준 노래 부르기', hint: '홈에서 🎲을 누른 다음 녹음해 보세요.', on: 'take', test: (t) => !!t.fromSurprise },
];

/* `room` = it takes the studio or the foxes: not one for a day on which those are still shut (js/opening.js). */
const MISSIONS = [
  { id: 'record', emoji: '🎤', text: '노래 한 번 녹음하기', target: 1, on: 'take', room: 'studio' },
  { id: 'games', emoji: '🎮', text: '미니게임 2번 하기', target: 2, on: 'game' },
  { id: 'listen', emoji: '🎧', text: '커버 하나 듣기', target: 1, on: 'listen', room: 'studio' },
  { id: 'pet', emoji: '🦊', text: '{pet} 3번 쓰다듬기', target: 3, on: 'pet', room: 'fox' },
  { id: 'message', emoji: '💌', text: '메시지 하나 열기', target: 1, on: 'message' },
  { id: 'feed', emoji: '🍖', text: '{pet}에게 먹이 주기', target: 1, on: 'feed', room: 'fox' },
  { id: 'release', emoji: '💿', text: '커버 하나 저장하기', target: 1, on: 'release', room: 'studio' },
];

/* Mission texts name the pet. */
const missionText = (def) => def.text.replace('{pet}', State.pet.name);

const Game = {
  batch: null,
  checking: false,

  xpToNext(level) {
    return 80 + (level - 1) * 40;
  },

  /* Add points. Level-ups give +50 coins each. */
  reward({ dopamine = 0, xp = 0, coins = 0 } = {}, anchor) {
    const d = State.dopamine;
    d.points += dopamine;
    d.coins += coins;
    d.xp += xp;
    const levelUps = [];
    while (d.xp >= this.xpToNext(d.level)) {
      d.xp -= this.xpToNext(d.level);
      d.level += 1;
      d.coins += 50;
      levelUps.push(d.level);
      Diary.add('levels', d.level);
    }
    if (this.batch) {
      this.batch.dopamine += dopamine;
      this.batch.xp += xp;
      this.batch.coins += coins + levelUps.length * 50;
      this.batch.levelUps.push(...levelUps);
    } else {
      if (anchor && (dopamine || coins)) UI.floatText(dopamine ? `+${dopamine} ✨` : `+${coins} 🪙`, anchor);
      if (levelUps.length) this.celebrateLevel(levelUps);
    }
    Store.save();
    UI.updateHud();
    this.checkAchievements();
    return levelUps;
  },

  celebrateLevel(levels) {
    const lv = levels[levels.length - 1];
    Pet.react('levelup');
    UI.celebrate({
      emoji: '⭐',
      title: `레벨 ${lv}!`,
      subtitle: '레벨이 올랐어요 — 여우에게 쓸 코인을 드려요.',
      rewards: { coins: 50 * levels.length },
      sound: 'levelup',
    });
  },

  startBatch() {
    this.batch = { dopamine: 0, xp: 0, coins: 0, levelUps: [], achievements: [], notes: [] };
  },
  endBatch() {
    const b = this.batch;
    this.batch = null;
    return b;
  },

  checkAchievements() {
    if (this.checking) return [];
    this.checking = true;
    const unlocked = [];
    try {
      for (let pass = 0; pass < 5; pass++) {
        const fresh = ACHIEVEMENTS.filter((a) => {
          if (State.achievements[a.id]) return false;
          try {
            return !!a.test(State);
          } catch (e) {
            return false;
          }
        });
        if (!fresh.length) break;
        fresh.forEach((a) => (State.achievements[a.id] = new Date().toISOString()));
        fresh.forEach((a) => {
          this.reward({ dopamine: 40, xp: 20, coins: 25 });
          unlocked.push(a);
        });
      }
    } finally {
      this.checking = false;
    }
    if (unlocked.length) {
      Store.save();
      if (this.batch) {
        this.batch.achievements.push(...unlocked);
      } else {
        unlocked.forEach((a, i) =>
          setTimeout(() => {
            UI.toast(`업적 달성: ${a.name} (+25 🪙)`, { icon: a.emoji, ms: 3400, kind: 'gold' });
            Sfx.play('achievement');
          }, i * 800)
        );
        setTimeout(() => Pet.react('achievement'), 400);
      }
    }
    return unlocked;
  },

  /* ----- titles ----- */
  title() {
    const n = Music.released().length;
    return TITLES.filter((t) => n >= t.min).pop();
  },
  nextTitle() {
    const n = Music.released().length;
    return TITLES.find((t) => t.min > n) || null;
  },

  /* ----- singing streak (one missed day is forgiven) ----- */
  registerSingingDay(seconds) {
    const sg = State.singing;
    const today = dateKey();
    sg.days[today] = (sg.days[today] || 0) + seconds;
    if (sg.lastRecordingDate === today) return { newDay: false };
    const gap = sg.lastRecordingDate ? daysBetween(sg.lastRecordingDate, today) : null;
    sg.currentStreak = gap === 1 || gap === 2 ? sg.currentStreak + 1 : 1;
    sg.lastRecordingDate = today;
    sg.longestStreak = Math.max(sg.longestStreak, sg.currentStreak);
    return { newDay: true, forgiven: gap === 2, restarted: gap != null && gap > 2 };
  },
  displayStreak() {
    const sg = State.singing;
    if (!sg.lastRecordingDate) return 0;
    return daysBetween(sg.lastRecordingDate, dateKey()) <= 2 ? sg.currentStreak : 0;
  },
  sangToday() {
    return State.singing.lastRecordingDate === dateKey();
  },

  /* ----- today's challenge & missions ----- */
  ensureDaily() {
    const today = dateKey();
    if (State.daily.date === today) return false;
    Diary.prune(); // (what she did weeks ago is not kept: the pages she wrote are)
    const rnd = mulberry32(hashStr(today + State.createdAt));
    const ch = pick(CHALLENGES, rnd);
    const extra = shuffle(
      MISSIONS.filter((m) => m.id !== 'record'),
      rnd
    ).slice(0, 2);
    // while the studio and the foxes are still shut: no challenge (every one of them is sung), and only what can be done
    const shut = Opening.shut();
    State.daily = Object.assign(defaultState().daily, {
      date: today,
      challenge: shut ? null : ch.id,
      missions: (shut ? MISSIONS.filter((m) => !m.room) : [MISSIONS[0]].concat(extra)).map((m) => ({ id: m.id, progress: 0, done: false })),
    });
    Store.save();
    return true;
  },
  challenge() {
    return CHALLENGES.find((c) => c.id === State.daily.challenge) || null;
  },

  track(event, payload = {}) {
    this.ensureDaily();
    const d = State.daily;
    d.missions.forEach((m) => {
      const def = MISSIONS.find((x) => x.id === m.id);
      if (!def || m.done || def.on !== event) return;
      m.progress += payload.amount || 1;
      if (m.progress >= def.target) {
        m.done = true;
        this.reward({ dopamine: 15, xp: 5, coins: 5 });
        if (this.batch) this.batch.notes.push(`${def.emoji} 미션 완료: ${missionText(def)}`);
        else UI.toast(`미션 완료: ${missionText(def)} (+15 ✨)`, { icon: def.emoji });
      }
    });
    const ch = this.challenge();
    if (ch && !d.challengeDone && ch.on === event) {
      let ok = false;
      if (ch.target) {
        d.challengeProgress += payload.amount || 1;
        ok = d.challengeProgress >= ch.target;
      } else {
        try {
          ok = !!ch.test(payload);
        } catch (e) {
          ok = false;
        }
      }
      if (ok) {
        d.challengeDone = true;
        this.reward({ dopamine: 30, xp: 15, coins: 10 });
        if (this.batch) this.batch.notes.push(`🏆 오늘의 챌린지 완료: ${ch.text}`);
        else {
          UI.toast('챌린지 완료! +30 ✨ +10 🪙', { icon: '🏆', ms: 3200, kind: 'gold' });
          Sfx.play('achievement');
        }
      }
    }
    Store.save();
  },

  missionsAllDone() {
    return State.daily.missions.length > 0 && State.daily.missions.every((m) => m.done);
  },

  claimDailyBonus(anchor) {
    if (!this.missionsAllDone() || State.daily.bonusClaimed) return;
    State.daily.bonusClaimed = true;
    this.reward({ dopamine: 50, xp: 20, coins: 20 }, anchor);
    Sfx.play('reward');
    UI.confetti({ count: 60 });
    UI.toast('오늘의 보너스를 받았어요! +50 ✨ +20 🪙', { icon: '🎁' });
  },

  /* ----- events from the music side ----- */
  onTake(take) {
    State.singing.totalRecordings += 1;
    State.singing.totalSeconds += take.rawDuration;
    State.singing.longestTake = Math.max(State.singing.longestTake || 0, take.rawDuration);
    Diary.note('takes');
    Diary.note('sang', Math.round(take.rawDuration));
    this.ensureDaily();
    State.daily.takes = (State.daily.takes || 0) + 1;
    const streak = this.registerSingingDay(take.rawDuration);
    this.reward({ dopamine: 10, xp: 5 });
    this.track('take', take);
    if (streak.newDay && streak.forgiven) UI.toast('하루 빠졌어도 괜찮아요 — 연속 기록은 그대로예요 💗', { icon: '🔥', ms: 3200 });
    else if (streak.newDay && State.singing.currentStreak > 1) UI.toast(`노래 연속 ${State.singing.currentStreak}일째!`, { icon: '🔥' });
    else if (streak.newDay && streak.restarted) UI.toast('오늘부터 새로운 연속 기록이 시작돼요 ✨', { icon: '🔥' });
    if (streak.newDay && State.singing.currentStreak === 7) {
      const msg = Messages.special('streak7');
      if (msg) UI.celebrate({ emoji: '🔥', title: '7일 연속!', message: msg, sound: 'achievement' });
    }
    Pet.react('recorded');
    Store.save();
  },

  onListen() {
    State.statistics.listens += 1;
    Diary.note('listens');
    if (State.daily.listenDopamine < 10) {
      State.daily.listenDopamine += 1;
      this.reward({ dopamine: 3 });
    }
    this.track('listen');
    Store.save();
  },

  /* A cover was just saved (released): rewards, milestones, a letter — and sometimes a rare one. */
  onRelease(c) {
    const count = Music.released().length;
    Diary.add('covers', c.title);
    Garden.planted(c); // (its flower in the foxes' yard: js/garden.js)
    const rare = Math.random() < 0.07;
    if (rare) {
      (State.coverMeta[c.id] || (State.coverMeta[c.id] = {})).rare = true;
      c.rare = true;
      this.rare();
    }
    this.startBatch();
    this.reward({ dopamine: 50, xp: 30, coins: 20 });
    if (rare) this.reward({ dopamine: 100, coins: 20 });
    this.track('release', c);
    this.checkAchievements();
    const b = this.endBatch();

    const milestones = { 1: 'firstCover', 5: 'covers5', 10: 'covers10', 20: 'covers20', 50: 'covers50' };
    let msg = milestones[count] ? Messages.special(milestones[count]) : '';
    if (!msg && rare) msg = Messages.special('rare');
    if (!msg && c.lateNight && Math.random() < 0.6) msg = Messages.special('lateNight');
    if (!msg && Math.random() < 0.35) {
      const r = Messages.open();
      if (r) msg = r.msg.text;
    }
    Store.saveNow();
    if (count === 1 && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

    UI.celebrate({
      emoji: rare ? '🌟' : '🎤',
      title: rare ? '레어 커버!' : '커버 완성!',
      subtitle:
        count === 1 ? '✨ 첫 커버! 처음으로 발매한 곡이에요.' : rare ? '이번 곡은 왠지 더 특별해요 ✨' : `“${c.title}” 발매 완료 — 오직 나만 들을 수 있어요.`,
      rewards: b,
      achievements: b.achievements,
      levelUps: b.levelUps,
      message: msg,
      rare,
      extraHtml: b.notes.map((n) => `<p class="cel-note">${esc(n)}</p>`).join(''),
      buttons: [{ label: '▶ 지금 듣기', primary: true, onClick: () => CoverHost.play(c.id) }, { label: '신난다! 💗' }],
    }).then(() => Pet.react('released'));
  },

  /* A new album was created: the first one gets a little party. */
  onAlbum() {
    Diary.note('albums');
    const unlocked = this.checkAchievements();
    if (Music.albums().length !== 1) return;
    const album = Music.albums()[0];
    UI.celebrate({
      emoji: '📀',
      title: '앨범 완성!',
      subtitle: '커버들이 함께 지낼 집이 생겼어요.',
      message: Messages.special('album'),
      sound: unlocked.length ? 'achievement' : 'reward',
      // (her first album can go straight into the press: js/lp.js)
      buttons: album && album.trackIds.length ? [{ label: '💿 LP로 굽기', primary: true, onClick: () => LP.open(album.id) }, { label: '신난다! 💗' }] : undefined,
    });
  },

  onGame(id, result, rewards) {
    State.statistics.gamesPlayed += 1;
    Diary.note('games');
    Diary.tally('gameBy', id);
    this.reward(rewards);
    this.track('game');
    Pet.react('game');
    Store.save();
  },

  secret(anchor) {
    State.statistics.secretEvents += 1;
    this.reward({ dopamine: 50, coins: 10 }, anchor);
    Sfx.play('rare');
    Store.save();
  },

  rare() {
    State.statistics.rareEvents += 1;
    Store.save();
  },
};

/* ------------------------------------------------------------------
   Messages from the boyfriend. Built-ins come from config.js (so new
   ones show up after a re-deploy); in-app edits are stored as overrides.
   ------------------------------------------------------------------ */
const Messages = {
  defaults() {
    return (CFG.boyfriendMessages || []).filter(Boolean).map((t) => ({ id: `d${hashStr(t).toString(36)}`, text: t, builtIn: true }));
  },
  all() {
    const m = State.messages;
    const list = this.defaults()
      .filter((x) => !m.hidden.includes(x.id))
      .map((x) => (m.edited[x.id] ? Object.assign({}, x, { text: m.edited[x.id] }) : x));
    return list.concat(m.custom.map((c) => Object.assign({ builtIn: false }, c)));
  },
  /* A random message, unseen ones first. */
  open() {
    const list = this.all();
    if (!list.length) return null;
    const seen = new Set(State.messages.seen);
    const unseen = list.filter((x) => !seen.has(x.id));
    let pool = unseen.length ? unseen : list.filter((x) => x.id !== State.messages.lastId);
    if (!pool.length) pool = list;
    const msg = pick(pool);
    const isNew = !seen.has(msg.id);
    if (isNew) State.messages.seen.push(msg.id);
    State.messages.lastId = msg.id;
    State.statistics.messagesOpened += 1;
    Diary.note('messages');
    Store.save();
    return { msg, isNew };
  },
  collected() {
    const seen = new Set(State.messages.seen);
    return this.all().filter((x) => seen.has(x.id));
  },
  special(key) {
    const o = State.messages.special[key];
    return o != null && o !== '' ? o : (CFG.specialMessages || {})[key] || '';
  },
  add(text) {
    State.messages.custom.push({ id: uid('m'), text });
    Store.save();
  },
  update(id, text) {
    const c = State.messages.custom.find((x) => x.id === id);
    if (c) c.text = text;
    else State.messages.edited[id] = text;
    Store.save();
  },
  remove(id) {
    const before = State.messages.custom.length;
    State.messages.custom = State.messages.custom.filter((x) => x.id !== id);
    if (State.messages.custom.length === before && !State.messages.hidden.includes(id)) State.messages.hidden.push(id);
    Store.save();
  },
  resetToDefaults() {
    State.messages.custom = [];
    State.messages.hidden = [];
    State.messages.edited = {};
    State.messages.special = {};
    Store.save();
  },
};
