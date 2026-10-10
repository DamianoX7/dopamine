// Step 1 — GET READY: the song, headphones, recording mode, backing source, microphone,
// listening, volume summary and the real browser capability check. Sections re-render only
// when the state they depend on changes.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { formatTime, formatBytes, pct } from '../core/util.js';
import { MSG, CHROME_UI } from '../messages.js';
import { mimeLabel } from '../audio/mime.js';
import { button, notice, spinner, segmented, badge, SOURCE_INFO } from '../ui/common.js';
import { createMeter } from '../ui/meter.js';
import { createSlider } from '../ui/slider.js';
import { createSongCard } from './songCard.js';
import * as C from './controller.js';

// Desktop Audio: the places a song can play, and what to do in the browser's sharing dialog.
const TAB_SOURCES = {
  'this-tab': {
    label: '이 페이지', icon: 'play', share: '이 탭 소리 공유', heard: '이 페이지의 플레이어',
    desc: '이 페이지에 있는 유튜브 플레이어예요. 녹음을 누르면 영상이 자동으로 시작돼요.',
    steps: () => [
      [h('strong', null, '이 탭 소리 공유'), ' 버튼을 누르세요.'],
      ['Chrome이 이 사이트가 이 탭을 봐도 되는지 물어봐요 — ', h('strong', null, CHROME_UI.allowTabAudio), ' 스위치를 켠 채로 ', h('strong', null, CHROME_UI.allow), ' 버튼을 누르세요.'],
    ],
    ready: '이 탭의 소리가 연결됐어요. 영상을 잠깐 재생해 보세요 — 미터가 움직여야 해요. (한 번 재생해 두면 광고도 미리 지나가요.)',
  },
  'other-tab': {
    label: '다른 탭', icon: 'tab', share: '다른 탭 소리 공유', heard: '다른 탭',
    desc: '이 브라우저의 다른 탭에서 재생되는 노래예요 — 예를 들면 여기에 넣을 수 없는 유튜브 영상.',
    steps: () => [
      ['다른 탭에서 노래를 열고 맨 앞에서 일시정지해 두세요.'],
      [h('strong', null, '다른 탭 소리 공유'), ' 버튼을 누르고, ', h('strong', null, CHROME_UI.tabPage), ' 화면에서 그 탭을 고르세요.'],
      [h('strong', null, CHROME_UI.tabAudio), ' 스위치를 켠 채로 ', h('strong', null, CHROME_UI.shareWithAudio), ' 버튼을 누르세요.'],
    ],
    ready: '다른 탭의 소리가 연결됐어요. 그 탭에서 노래를 잠깐 재생해 보세요 — 미터가 움직여야 해요. 녹음할 때는 여기서 녹음을 누른 다음 그 탭에서 노래를 시작하세요.',
  },
  system: {
    label: '컴퓨터 전체', icon: 'volume', share: '컴퓨터 소리 공유', heard: '컴퓨터',
    desc: '이 컴퓨터의 어떤 앱이든 돼요 — 음악 플레이어, 다른 브라우저, 게임. 컴퓨터에서 나는 모든 소리가 녹음되니 알림은 먼저 꺼 두세요.',
    steps: () => [
      [h('strong', null, '컴퓨터 소리 공유'), ' 버튼을 누르세요.'],
      [h('strong', null, CHROME_UI.screenPage), ' 화면에서 내 화면 그림을 클릭하세요.'],
      [h('strong', null, CHROME_UI.systemAudio), ' 스위치를 켜고 — Chrome은 꺼 둬요 — ', h('strong', null, CHROME_UI.shareWithAudio), ' 버튼을 누르세요.'],
    ],
    ready: '컴퓨터 소리가 연결됐어요. 노래를 잠깐 재생해 보세요 — 미터가 움직여야 해요. 컴퓨터에서 나는 모든 소리가 녹음돼요.',
  },
};

const HEARD_PEAK = 0.004; // above the noise floor: the shared source really carries sound
const BLUETOOTH_RE = /airpods|buds|bluetooth|hands-?free|\bbt\b|beats|wh-1000|wf-1000/i;
const HEADSET_RE = /headset|headphone|earphone|earbud|airpods|buds/i;

export function createPrepareStep(s0) {
  const meters = { backing: null, voice: null };
  const songCard = createSongCard(s0);
  let soundCheck = null; // Desktop Audio: the "is the song's sound arriving?" line under the meter
  const el = h('div', { class: 'step step-prepare' });
  const order = ['headphones', 'mode', 'backing', 'mic', 'listening', 'volume', 'check', 'footer'];
  const slots = {};
  for (const k of order) {
    slots[k] = { el: h('div', { class: `prep-slot prep-${k}` }), sig: null };
    el.append(slots[k].el);
  }

  // ---------------------------------------------------------------- headphones
  function buildHeadphones(s) {
    if (s.headphonesCard) {
      return h('section', { class: 'card headphones-card', role: 'note' },
        h('div', { class: 'hp-emoji', 'aria-hidden': 'true' }, '🎧'),
        h('div', { class: 'hp-body' },
          h('h2', { class: 'hp-title' }, MSG.headphonesTitle),
          h('p', null, MSG.headphonesBody),
          button('알겠어요', { variant: 'soft', size: 'sm', icon: 'check', onClick: () => C.dismissHeadphonesCard() })));
    }
    return h('p', { class: 'chip-note' }, h('span', { 'aria-hidden': 'true' }, '🎧 '), '깨끗하게 녹음하려면 헤드폰을 추천해요.');
  }

  // ---------------------------------------------------------------- mode
  function tabAvailability(s) {
    if (s.caps.displayAudio === 'likely') return { ok: true, badge: ['컴퓨터에서 가장 좋아요', 'ok'] };
    if (s.caps.displayAudio === 'unlikely') {
      return { ok: true, badge: ['여기서는 안 될 수도 있어요', 'warn'], reason: '이 브라우저는 화면은 공유해도 소리는 보통 공유하지 못해요. 그래도 해 볼 수 있어요 — 실제로 소리가 들어오는지 확인해 드려요.' };
    }
    return { ok: false, reason: MSG.tabUnavailable };
  }

  function buildMode(s) {
    const options = [
      { value: 'tab', title: SOURCE_INFO.tab.long, icon: 'tab', desc: '노래를 브라우저에서 바로 녹음해요 — 이 페이지의 플레이어, 다른 탭, 또는 컴퓨터에서 나는 모든 소리 — 거기에 마이크를 더해요.', avail: tabAvailability(s) },
      { value: 'upload', title: SOURCE_INFO.upload.long, icon: 'file', desc: '반주(MR) 파일을 올리면 마이크와 디지털로 섞여요. 휴대폰에서 가장 좋아요.', avail: { ok: !!s.caps.audioContext, badge: ['휴대폰에서 가장 깨끗해요', 'ok'] } },
      {
        value: 'speaker', title: SOURCE_INFO.speaker.long, icon: 'speaker',
        desc: '유튜브를 스피커로 틀고, 마이크가 목소리와 노래를 함께 녹음해요.',
        avail: s.yt.status === 'ready' ? { ok: true, badge: ['음질이 낮아요', 'warn'] } : { ok: false, reason: '먼저 맨 위에서 유튜브 링크를 불러와 주세요.' },
      },
    ];
    const current = options.find((o) => o.value === s.mode);
    return h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, h('span', { 'aria-hidden': 'true' }, '🎙'), '녹음 방식'),
      h('p', { class: 'mode-current' }, s.mode === 'speaker' ? '⚠ ' : '● ', current ? current.title : '방식을 골라 주세요'),
      h('p', { class: 'small muted' }, '브라우저에 맞게 자동으로 골랐어요 — 바꿔도 돼요.'),
      h('div', { class: 'mode-list', role: 'radiogroup', 'aria-label': '녹음 방식' }, options.map((o) => h('button', {
        class: ['mode-opt', s.mode === o.value && 'is-on', !o.avail.ok && 'is-off'],
        type: 'button', role: 'radio', 'aria-checked': String(s.mode === o.value), disabled: !o.avail.ok,
        onClick: () => C.selectMode(o.value),
      },
      h('span', { class: 'mode-icon' }, icon(o.icon, { size: 22 })),
      h('span', { class: 'mode-text' },
        h('span', { class: 'mode-title' }, o.title, o.avail.badge ? badge(o.avail.badge[0], o.avail.badge[1]) : null),
        h('span', { class: 'mode-desc' }, o.desc),
        o.avail.reason ? h('span', { class: 'mode-reason' }, o.avail.reason) : null),
      h('span', { class: 'mode-radio', 'aria-hidden': 'true' })))),
    );
  }

  // ---------------------------------------------------------------- backing source
  function fallbackActions(s) {
    return [
      button('반주 파일 올리기', { size: 'sm', variant: 'primary', icon: 'file', onClick: () => C.selectMode('upload') }),
      s.yt.status === 'ready' ? button('스피커 + 마이크로 하기', { size: 'sm', variant: 'ghost', icon: 'speaker', onClick: () => C.selectMode('speaker') }) : null,
    ];
  }

  function buildTabBacking(s) {
    const st = s.tab.state;
    const hasVideo = s.yt.status === 'ready';
    // Once shared, show what the browser really handed over (the user chooses in its dialog).
    const source = st === 'ready' && s.tab.source ? s.tab.source : C.tabSourceFor(s);
    const info = TAB_SOURCES[source];
    const chooser = segmented(Object.entries(TAB_SOURCES).map(([value, o]) => ({
      value, label: o.label, icon: o.icon, disabled: value === 'this-tab' && !hasVideo && source !== 'this-tab',
    })), source, (v) => C.setTabSource(v), { ariaLabel: '노래를 어디서 틀어요?', disabled: st === 'requesting' });
    const shareBtn = button(st === 'ready' ? '다시 공유' : info.share, {
      variant: st === 'ready' ? 'soft' : 'primary', icon: 'share', disabled: st === 'requesting',
      onClick: () => C.requestTab(),
    });
    let status = null;
    if (st === 'requesting') status = spinner('브라우저 창에서 고르기를 기다리는 중…');
    else if (st === 'ready') {
      status = source === 'this-tab' && !hasVideo
        ? notice('warn', '이 페이지의 플레이어에 불러온 게 없어서 이 탭에는 녹음할 노래가 없어요. 맨 위에서 유튜브 링크를 불러오거나, 노래를 트는 곳을 골라 주세요.')
        : notice('ok', info.ready, { title: '반주 준비 완료' });
    } else if (st === 'no-audio') {
      status = notice('error', s.tab.message || MSG.noAudioTrack, { actions: [button('다시 시도', { size: 'sm', variant: 'soft', onClick: () => C.requestTab() }), ...fallbackActions(s)] });
    } else if (st === 'unsupported') {
      status = notice('error', s.tab.message || MSG.tabUnavailable, { actions: fallbackActions(s) });
    } else if (st === 'cancelled' || st === 'ended') {
      status = notice('warn', s.tab.message || MSG.tabCancelled);
    } else if (st === 'error') {
      status = notice('error', s.tab.message || MSG.tabError, { actions: fallbackActions(s) });
    }
    let meterBlock = null;
    if (st === 'ready') {
      meters.backing = createMeter({ label: '노래', emoji: '🎵' });
      soundCheck = { el: h('p', { class: 'small muted sound-check' }, '아직 소리가 없어요 — 노래를 잠깐 틀어서 확인해 보세요.'), heard: false, from: info.heard };
      meterBlock = h('div', { class: 'meter-block' }, meters.backing.el, soundCheck.el);
    }
    return [
      h('p', { class: 'field-label' }, '노래를 어디서 틀어요?'),
      chooser.el,
      h('p', { class: 'muted source-desc' }, info.desc),
      !hasVideo && source !== 'this-tab' ? h('p', { class: 'small muted' }, '“이 페이지”를 쓰려면 맨 위에서 유튜브 링크를 불러와야 해요.') : null,
      st === 'ready' ? null : h('ol', { class: 'howto' }, info.steps().map((parts) => h('li', null, ...parts))),
      shareBtn,
      status,
      meterBlock,
      h('p', { class: 'small muted' }, '소리만 사용해요. 브라우저가 함께 공유하는 화면은 절대 녹화되지 않아요.'),
    ];
  }

  function buildUploadBacking(s) {
    const u = s.upload;
    const fileInput = h('input', {
      type: 'file', class: 'visually-hidden', tabIndex: -1, 'aria-hidden': 'true',
      accept: 'audio/*,.mp3,.m4a,.aac,.wav,.ogg,.oga,.opus,.flac,.webm,.aif,.aiff,.caf',
    });
    fileInput.addEventListener('change', () => {
      const file = fileInput.files && fileInput.files[0];
      fileInput.value = '';
      if (file) C.uploadBacking(file);
    });
    const choose = button(u.state === 'ready' ? '다른 파일 고르기' : '오디오 파일 고르기', {
      variant: u.state === 'ready' ? 'soft' : 'primary', icon: 'upload', disabled: u.state === 'decoding',
      onClick: () => fileInput.click(),
    });
    let status = null;
    if (u.state === 'decoding') status = spinner(`“${u.name}” 읽는 중…`);
    else if (u.state === 'error') status = notice('error', u.message || MSG.decodeFailed);
    else if (u.state === 'ready') {
      status = h('div', { class: 'file-row' },
        icon('file', { size: 22 }),
        h('div', { class: 'file-text' }, h('div', { class: 'file-name' }, u.name), h('div', { class: 'small muted' }, `${formatTime(u.duration)} · ${formatBytes(u.size)} · ${u.channels === 1 ? '모노' : '스테레오'}`)),
        badge('✓ 준비됨', 'ok'));
    } else if (u.name) {
      status = notice('info', `지난 녹음에서 “${u.name}” 파일을 썼어요. 한 번 더 녹음하려면 그 파일을 다시 골라 주세요.`);
    }
    let previewBlock = null;
    if (u.state === 'ready') {
      meters.backing = createMeter({ label: '반주', emoji: '🎵' });
      const listen = createSlider({
        label: '귀로 듣는 반주', emoji: '🎧', min: 0, max: 100, step: 5,
        value: Math.round(s.listen.backingListen * 100), format: (v) => `${v}%`,
        onInput: (v) => C.setListen({ backingListen: v / 100 }),
      });
      previewBlock = h('div', { class: 'meter-block' },
        button(s.previewing ? '테스트 멈춤' : '미리 듣기', { variant: 'soft', icon: s.previewing ? 'stop' : 'play', onClick: () => C.toggleUploadPreview() }),
        meters.backing.el,
        listen.el,
        h('p', { class: 'small muted' }, '내가 듣는 소리만 바뀌고, 녹음에는 영향이 없어요.'));
    }
    return [
      h('p', { class: 'muted' }, '기기에 있는 반주(MR) 파일을 올려 주세요 (MP3, WAV, M4A/AAC 등 브라우저가 재생할 수 있는 형식). 마이크와 디지털로 섞이기 때문에 스피커를 거치지 않아요.'),
      notice('info', MSG.uploadRights, { iconName: 'lock' }),
      h('div', { class: 'row-wrap' }, choose),
      fileInput,
      status,
      previewBlock,
      s.yt.status === 'ready' ? h('p', { class: 'small muted' }, '이 방식에서는 유튜브 소리가 녹음되지 않아요 — 올린 파일만 반주로 쓰여요.') : null,
    ];
  }

  function buildSpeakerBacking(s) {
    const box = h('input', { type: 'checkbox', checked: s.speakerAck });
    box.addEventListener('change', () => C.ackSpeaker(box.checked));
    return [
      notice('warn', MSG.speakerFull, { title: '스피커 + 마이크 방식' }),
      h('ul', { class: 'bullets' },
        h('li', null, '유튜브가 기기의 스피커로 재생돼요.'),
        h('li', null, '마이크가 목소리와 노래를 하나의 녹음으로 함께 담아요.'),
        h('li', null, '이 녹음에서는 목소리 싱크와 반주/목소리 따로 조절을 쓸 수 없어요.'),
        h('li', null, '이 방식에서 헤드폰을 쓰면 목소리만 녹음돼요.')),
      h('label', { class: 'check check-strong' }, box, '알겠어요 — 스피커 + 마이크 방식으로 할게요'),
      s.yt.status !== 'ready' ? notice('error', '먼저 맨 위에서 유튜브 링크를 불러와 주세요.') : null,
    ];
  }

  function buildBacking(s) {
    meters.backing = null;
    soundCheck = null;
    const body = s.mode === 'tab' ? buildTabBacking(s) : s.mode === 'upload' ? buildUploadBacking(s) : s.mode === 'speaker' ? buildSpeakerBacking(s) : [];
    const label = s.mode ? SOURCE_INFO[s.mode].long : '—';
    return h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, h('span', { 'aria-hidden': 'true' }, '🎵'), '반주 소스'),
      h('p', { class: 'mode-current' }, label),
      ...body);
  }

  // ---------------------------------------------------------------- microphone
  function buildMic(s) {
    meters.voice = null;
    const m = s.mic;
    const retry = button('다시 시도', { size: 'sm', variant: 'soft', icon: 'restart', onClick: () => C.requestMic() });
    let body;
    if (m.state === 'idle') {
      body = [
        h('p', { class: 'muted' }, '마이크는 녹음 직전인 지금만 요청해요. 오디오는 이 기기 안에만 남아요.'),
        button('마이크 허용', { variant: 'primary', icon: 'mic', onClick: () => C.requestMic() }),
      ];
    } else if (m.state === 'requesting') {
      body = [spinner('마이크 권한을 기다리는 중…')];
    } else if (m.state === 'granted') {
      meters.voice = createMeter({ label: '목소리', emoji: '🎤' });
      const devices = s.micDevices || [];
      const select = devices.length > 1 ? h('select', { class: 'input', 'aria-label': '마이크', value: m.deviceId || '' },
        devices.map((d) => h('option', { value: d.id }, d.label))) : null;
      if (select) select.addEventListener('change', () => C.selectMic(select.value));
      const processing = m.echoCancellation
        ? '에코 제거가 켜져 있어요 (스피커로 듣기를 골랐어요).'
        : '가장 자연스러운 노랫소리를 위해 음성 처리는 꺼 뒀어요.';
      body = [
        notice('ok', `${m.label}. ${processing}`, { title: '마이크 권한을 받았어요' }),
        select ? h('label', { class: 'field' }, h('span', { class: 'field-label' }, '마이크'), select) : null,
        h('div', { class: 'meter-block' }, meters.voice.el, h('p', { class: 'small muted' }, '노래하거나 말해 보세요 — 미터가 움직여야 해요.')),
      ];
    } else if (m.state === 'denied') {
      body = [notice('error', m.help || MSG.micDeniedHelp, { title: MSG.micDenied, actions: [retry] })];
    } else if (m.state === 'unsupported') {
      body = [notice('error', m.message || MSG.micUnsupported, { title: '이 브라우저는 마이크 녹음을 지원하지 않아요' })];
    } else {
      const title = m.state === 'notfound' ? '마이크를 찾지 못했어요' : m.state === 'unavailable' ? '마이크를 쓸 수 없어요' : '마이크에 문제가 있어요';
      body = [notice('error', m.message || MSG.micError, { title, actions: [retry] })];
    }
    return h('section', { class: 'card' }, h('h2', { class: 'card-title' }, h('span', { 'aria-hidden': 'true' }, '🎤'), '마이크'), ...body);
  }

  // ---------------------------------------------------------------- listening
  function buildListening(s) {
    const head = h('h2', { class: 'card-title' }, h('span', { 'aria-hidden': 'true' }, '🎧'), '어떻게 들을 건가요?');
    if (s.mode === 'speaker') {
      return h('section', { class: 'card' }, head, h('p', { class: 'muted' }, '스피커 + 마이크 방식에서는 마이크가 들을 수 있게 노래를 스피커로 틀어야 해요.'));
    }
    const seg = segmented([
      { value: 'headphones', label: '헤드폰', icon: 'headphones' },
      { value: 'speaker', label: '스피커', icon: 'speaker' },
    ], s.listening, (v) => C.setListening(v), { ariaLabel: '어떻게 들을 건가요?' });
    const label = s.mic.state === 'granted' ? s.mic.label || '' : '';
    const hints = [];
    if (label && HEADSET_RE.test(label)) hints.push(h('p', { class: 'small muted' }, `헤드셋 마이크를 쓰고 있는 것 같아요 (${label}).`));
    if (label && BLUETOOTH_RE.test(label)) hints.push(h('p', { class: 'small muted' }, '블루투스 헤드폰은 소리가 조금 늦게 와요. 녹음한 뒤 목소리 싱크로 다시 맞출 수 있어요.'));
    let extra = null;
    if (s.listening === 'speaker') {
      extra = notice('warn', `${MSG.speakerListening} 이를 줄이려고 에코 제거를 켜 뒀지만, 음악과 목소리를 완전히 나누지는 못해요.`);
    } else if (s.mode === 'upload') {
      const box = h('input', { type: 'checkbox', checked: !!s.listen.voiceMonitor });
      box.addEventListener('change', () => C.setListen({ voiceMonitor: box.checked }));
      extra = h('div', null,
        h('label', { class: 'check' }, box, '헤드폰으로 내 목소리 듣기'),
        h('p', { class: 'small muted' }, '브라우저 때문에 살짝 늦게 들려요 — 거슬리면 꺼 주세요. 녹음에는 영향이 없어요.'));
    } else if (s.mode === 'tab') {
      extra = h('p', { class: 'small muted' }, '이 방식에서는 페이지를 통해 내 목소리를 들을 수 없어요 — 반주에 섞여 들어갈 수 있거든요.');
    }
    return h('section', { class: 'card' }, head, seg.el, ...hints, extra);
  }

  // ---------------------------------------------------------------- volume summary
  function buildVolume(s) {
    const listening = C.effectiveListening(s);
    const hear = s.mode === 'upload'
      ? `이 페이지에서 ${pct(s.listen.backingListen)} 크기로`
      : s.mode === 'tab' && C.tabSourceFor(s) !== 'this-tab'
        ? '노래를 트는 곳에서 — 기기 음량으로 조절해요'
        : '유튜브 플레이어에서 — 기기 음량으로 조절해요';
    const voiceEar = s.mode === 'upload' && listening === 'headphones' && s.listen.voiceMonitor ? '켜짐' : '꺼짐';
    const mix = s.mode === 'speaker'
      ? `마이크 레벨 ${pct(s.mix.voiceVolume)}`
      : `🎵 반주 ${pct(s.mix.backingVolume)} · 🎤 목소리 ${pct(s.mix.voiceVolume)} · ⏱ 싱크 ${s.mix.syncMs} ms`;
    return h('section', { class: 'card' },
      h('h2', { class: 'card-title' }, h('span', { 'aria-hidden': 'true' }, '🔊'), '음량'),
      h('dl', { class: 'cv-kv' },
        h('dt', null, '반주가 들리는 곳'), h('dd', null, hear),
        h('dt', null, '귀로 듣는 내 목소리'), h('dd', null, voiceEar),
        h('dt', null, '녹음 믹스'), h('dd', null, mix)),
      h('p', { class: 'small muted' }, '녹음 믹스는 다음 화면에서 조절할 수 있고, 녹음한 뒤에 전부 다시 맞출 수도 있어요.'));
  }

  // ---------------------------------------------------------------- browser check
  function buildCheck(s) {
    const c = s.caps;
    const row = (label, ok, text) => h('li', { class: `check-row ${ok === true ? 'is-ok' : ok === false ? 'is-bad' : 'is-maybe'}` },
      h('span', { class: 'check-icon', 'aria-hidden': 'true' }, ok === true ? '✓' : ok === false ? '✕' : '•'),
      h('span', { class: 'check-label' }, label),
      h('span', { class: 'check-text' }, text));
    const probe = s.probe;
    const probeRow = probe.status === 'ok'
      ? row('믹스 스트림 녹음 테스트', true, `테스트 오디오 ${formatBytes(probe.size)} 녹음됨${probe.decodable === false ? ' (이 브라우저는 재생은 못 해도 녹음은 할 수 있어요)' : ''}`)
      : probe.status === 'running'
        ? row('믹스 스트림 녹음 테스트', null, '테스트 중…')
        : probe.status === 'fail'
          ? row('믹스 스트림 녹음 테스트', false, probe.message)
          : row('믹스 스트림 녹음 테스트', null, '마이크를 허용하면 실행돼요');
    let tabAudio;
    if (s.tab.state === 'ready') tabAudio = row('탭 / 시스템 오디오', true, '확인됨 — 오디오 트랙을 받았어요');
    else if (s.tab.state === 'no-audio') tabAudio = row('탭 / 시스템 오디오', false, '공유는 됐지만 오디오 트랙이 오지 않았어요');
    else if (c.displayAudio === 'likely') tabAudio = row('탭 / 시스템 오디오', null, '지원될 가능성이 높아요 (공유하면 확인돼요)');
    else if (c.displayAudio === 'unlikely') tabAudio = row('탭 / 시스템 오디오', null, '이 브라우저에서는 보통 지원되지 않아요');
    else tabAudio = row('탭 / 시스템 오디오', false, '이 브라우저에서는 쓸 수 없어요');
    const failed = probe.status === 'fail' || !c.microphone || !c.mediaRecorder || !c.preferredMimeType;
    return h('details', { class: 'card check-card', open: failed },
      h('summary', { class: 'card-title' }, icon('info'), `브라우저 점검 · ${c.browser}${c.isMobile ? ' (모바일)' : ''}`),
      h('ul', { class: 'check-list' },
        row('보안 페이지 (마이크에 필요)', c.secureContext, c.secureContext ? '예' : '아니요 — https로 열어 주세요'),
        row('마이크 입력', c.microphone && c.secureContext, c.microphone ? (s.mic.state === 'granted' ? '권한 받음' : '지원됨') : '지원 안 됨'),
        row('MediaRecorder', c.mediaRecorder, c.mediaRecorder ? '지원됨' : '지원 안 됨'),
        row('녹음 형식', !!c.preferredMimeType, c.preferredMimeType ? `${mimeLabel(c.preferredMimeType)}${c.preferredPlayable ? '' : ' (여기서는 재생할 수 없어요)'}` : '호환되는 형식 없음'),
        row('Web Audio 믹싱', c.audioContext && c.audioWorklet && c.mediaStreamDestination, c.audioContext && c.audioWorklet ? 'AudioContext + AudioWorklet 사용 가능' : '없음'),
        row('화면 / 탭 캡처', c.getDisplayMedia ? true : null, c.getDisplayMedia ? '사용 가능' : '사용 불가 (휴대폰에서는 정상)'),
        tabAudio,
        probeRow),
      c.supportedMimeTypes.length ? h('p', { class: 'small muted' }, `이 브라우저가 녹음할 수 있는 형식: ${c.supportedMimeTypes.join(', ')}`) : null);
  }

  // ---------------------------------------------------------------- footer
  function buildFooter(s) {
    const r = C.readiness(s);
    const cont = button('스튜디오로 계속', {
      variant: 'primary', icon: 'forward', size: 'lg', block: true,
      disabled: !r.ok || s.probe.status === 'running',
      onClick: () => C.continueToRecord(),
    });
    return h('div', { class: 'step-actions' },
      s.error ? notice('error', s.error) : null,
      !r.ok ? h('p', { class: 'small muted still-needed' }, `아직 필요한 것: ${r.missing.join(' · ')}`) : null,
      cont);
  }

  const builders = {
    headphones: [(s) => `${s.headphonesCard}`, buildHeadphones],
    mode: [(s) => `${s.mode}|${s.yt.status}|${s.caps.displayAudio}`, buildMode],
    backing: [(s) => JSON.stringify([s.mode, s.tab, s.upload, s.previewing, s.speakerAck, s.yt.status, C.tabSourceFor(s)]), buildBacking],
    mic: [(s) => JSON.stringify([s.mic, s.micDevices]), buildMic],
    listening: [(s) => JSON.stringify([s.mode, s.listening, s.listen.voiceMonitor, s.mic.label || '']), buildListening],
    volume: [(s) => JSON.stringify([s.mode, s.listen, s.mix, s.listening, C.tabSourceFor(s)]), buildVolume],
    check: [(s) => JSON.stringify([s.probe, s.tab.state, s.mic.state]), buildCheck],
    footer: [(s) => JSON.stringify([C.readiness(s), s.error, s.probe.status]), buildFooter],
  };

  function update(s) {
    songCard.update(s);
    for (const k of order) {
      const [sigFn, build] = builders[k];
      const sig = sigFn(s);
      if (sig === slots[k].sig) continue;
      slots[k].sig = sig;
      const out = build(s);
      slots[k].el.replaceChildren(...(Array.isArray(out) ? out : [out]).filter(Boolean));
    }
  }

  let raf = 0;
  const loop = () => {
    const eng = C.getEngine();
    if (eng && eng.ctx) {
      const lv = eng.getLevels();
      if (meters.backing && meters.backing.el.isConnected) meters.backing.set(lv.backing);
      if (meters.voice && meters.voice.el.isConnected) meters.voice.set(lv.voice);
      if (soundCheck && !soundCheck.heard && lv.backing > HEARD_PEAK) {
        soundCheck.heard = true;
        soundCheck.el.textContent = `✓ ${soundCheck.from}에서 소리가 들어오고 있어요.`;
        soundCheck.el.classList.add('is-ok');
      }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  update(s0);
  return {
    el,
    side: songCard.el,
    update,
    destroy() {
      cancelAnimationFrame(raf);
      songCard.destroy();
    },
  };
}
