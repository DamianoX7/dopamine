'use strict';
/* ==================================================================
   👋 Meet — the first time she comes into the foxes' world, Lorelei
   says hello and shows her round.

   She comes to the front and waves (a bubble over her head, as ever),
   and then has her say in the window along the bottom (js/talk.js):
   who she is, whose world this is from now on, and which fox is hers
   — it steps up beside her. A fox that has no name of its own yet gets
   it there and then, in the middle of the conversation. Then, if she
   likes, how the foxes are looked after: what Lorelei speaks of shows
   on the screen as she speaks of it (the buttons along the bottom come
   up over her window).

   It is told once. Left in the middle, it begins again the next time;
   and he can look at it beforehand (나 → 설정 → 메시지 편집).
   ================================================================== */

/*
   What Lorelei says. `meetLines` in js/config.js replaces any of these, part by part.
   {nick} = what she is called, {me} = Lorelei's name, {fox} = her fox — each also with the ending that fits the name:
   {fox:을/를}, {nick:이구나/구나} …
*/
const MEET_LINES = {
  call: ['어? 안녕! 이리 와 봐 👋', '앗, 왔구나! 여기야 여기 👋'], // (over her head, before the window opens)
  hello: ['안녕! 네가 {nick:이구나/구나}?', '얘기 많이 들었어. 만나서 반가워!'],
  me: ['나는 {me:이야/야}. 이 마당에서 여우들이랑 같이 살아.', '여기는 여우 세상이야. 오늘부터는 네 세상이기도 하고!'],
  fox: ['그리고 이 아이가… 너랑 같이 지낼 여우야.'], // (it steps up beside her)
  name: ['아직 이름이 없어. 네가 지어 줄래?'], // …it has no name of its own yet: the name tag follows
  named: ['{fox}! 정말 잘 어울리는 이름이다.'], // …and what she says to the name it was given
  known: ['{fox:이랑/랑}은 벌써 친해졌지? 너를 정말 좋아해.'], // …or it had its name already
  ask: ['여우 키우는 법, 알려 줄까?', '응, 알려 줘!', '괜찮아, 해 보면서 배울게'], // a question, and the two things to answer
  guide: [
    '{fox:을/를} 톡 건드리면 쓰다듬어 줄 수 있어. 바닥을 누르면 그쪽으로 달려오고.',
    '이 버튼들로 쓰다듬고, 먹이도 주고, 공놀이도 하고, 네가 부른 노래도 들려줄 수 있어.',
    '상점에서는 새 친구를 데려오거나, 옷이랑 마당을 꾸밀 수 있어. 코인은 노래하고 게임하면 모여.',
    '카메라로는 사진을 찍을 수 있어. 화면을 손가락으로 밀면 마당 밖도 구경할 수 있고.',
    '나침반을 누르면 여우를 탐험 보낼 수 있어. 선물을 물고 돌아오기도 해!',
  ],
  skip: ['좋아, 그게 제일 재밌지!'], // …if she would rather find out for herself
  bye: ['궁금한 게 있으면 언제든 나를 눌러 봐.', '그럼… 앞으로 잘 부탁해 💗'],
};
/* What shows on the screen with each line of the guide (js/pet.js: FoxRoom.point). */
const MEET_POINTS = [null, 'actions', 'shop', 'camera', 'trip'];

const Meet = {
  playing: false, //    she is being told right now
  rehearsing: false, // he has asked to be shown how it will be (nothing of it is kept)

  /* Is it still to be told? */
  due() {
    return State.onboarded && !State.pet.introduced && !this.playing && !this.rehearsing && !Present.rehearsing && !Halloween.rehearsing;
  },

  lines(key) {
    const mine = (CFG.meetLines || {})[key];
    const list = mine && mine.length ? [].concat(mine) : MEET_LINES[key];
    const names = { nick: State.user.nickname || '너', me: OWNER_NAME, fox: Pet.nameOf(State.pet.species) };
    return list.map((t) => String(t).replace(/\{(nick|me|fox)(?::([^}]+))?\}/g, (m, who, pair) => (pair ? josa(names[who], pair) : names[who])));
  },

  /* The second half, once her fox has its name: the question, the guide if she wants it, goodbye. */
  guide(fresh) {
    const L = (key) => this.lines(key);
    const [question, ...picks] = L('ask');
    const wanted = (answer) => answer !== 1; // (no question in it: as if she had said yes)
    return [
      ...(fresh ? L('named') : []),
      picks.length ? { text: question, ask: picks } : question,
      ...L('guide').map((text, i) => (answer) => (wanted(answer) ? { text, cue: () => FoxRoom.point(MEET_POINTS[i] || null) } : null)),
      (answer) => (wanted(answer) ? null : L('skip')[0] || null),
      ...L('bye').map((text, i, all) => ({
        text,
        cue: () => {
          FoxRoom.point(null);
          if (i === all.length - 1) OwnerSays.show('wave');
        },
      })),
    ];
  },

  /*
     Lorelei says hello. (`rehearsal`: only to see how it will be — as for somebody new, without the name tag, and
     nothing is kept.) Resolves true when it was told to the end.
  */
  async begin({ rehearsal = false } = {}) {
    const ov = FoxRoom.ov;
    if (this.playing || OwnerSays.on || Talk.on || !ov || UI.top() !== ov) return false;
    this.playing = true;
    const id = State.pet.species;
    const fresh = rehearsal || !State.pet.named; // her fox has no name of its own yet: it gets one in the middle of this
    const L = (key) => this.lines(key);
    const cued = (list, cue) => list.map((text, i) => (i ? text : { text, cue }));
    let told = false;
    try {
      if (!(await OwnerSays.enter(pick(L('call'))))) return false;
      if (!(await OwnerSays.talk([...L('hello'), ...L('me'), ...cued(L('fox'), () => OwnerSays.show('meet', id)), ...L(fresh ? 'name' : 'known')]))) return false;
      if (fresh && !rehearsal) {
        await Pet.askName(id, 'first');
        if (!OwnerSays.here()) return false;
      }
      told = !!(await OwnerSays.talk(this.guide(fresh)));
    } finally {
      this.playing = false;
      OwnerSays.leave();
    }
    if (!told) return false;
    if (rehearsal) {
      UI.toast('여기까지가 미리 보기예요. 아무것도 저장되지 않았어요 — 진짜 첫인사는 여우 세상에 처음 들어올 때!', { icon: '👀', ms: 5200 });
      return true;
    }
    // (she has been told about the country round the yard and about Lorelei: the notes that said so are not needed)
    Object.assign(State.pet, { introduced: true, toured: true, metOwner: true });
    Store.save();
    FoxHost.act('joy');
    return true;
  },

  /* For him (나 → 설정 → 메시지 편집): what it is, and whether she has heard it. */
  note() {
    const her = esc(josa(OWNER_NAME, '이/가'));
    return State.pet.introduced
      ? `이 기기에서는 ${her} 이미 첫인사를 했어요.`
      : `여우 세상에 처음 들어오면 ${her} 앞으로 나와 인사하고, 자기소개를 한 뒤 함께 지낼 여우를 소개해요. 여우 이름도 그때 지어요. 원하면 키우는 법도 알려 줘요.`;
  },

  /*
     For trying it out (index.html?debug=1, in the console; or 나 → 설정 → 메시지 편집 → 로렐라이의 첫인사):
       Meet.test()     Lorelei says her first hello, now — as a rehearsal: nothing is saved
  */
  async test() {
    this.rehearsing = true;
    try {
      if (!FoxRoom.ov) {
        await FoxRoom.open({ early: true }); // (his to look at, even before the foxes' world has opened for her)
        await sleep(600);
      }
      return await this.begin({ rehearsal: true });
    } finally {
      this.rehearsing = false;
    }
  },
};

Actions['meet-rehearse'] = async () => {
  await Router.go('#/home');
  Meet.test();
};
