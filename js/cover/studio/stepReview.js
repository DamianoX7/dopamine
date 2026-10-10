// Step 4 — "Your Cover": play the actual recorded file and verify what was captured.
import { h } from '../core/dom.js';
import { icon } from '../core/icons.js';
import { confirmDialog } from '../core/sheet.js';
import { getBlob } from '../core/db.js';
import { formatTime, formatBytes, formatDb } from '../core/util.js';
import { MSG } from '../messages.js';
import { mimeLabel } from '../audio/mime.js';
import { MixPreview, getPlaybackContext } from '../audio/mixer.js';
import { button, notice, spinner, SOURCE_INFO } from '../ui/common.js';
import { createTakePlayer } from '../ui/takePlayer.js';
import * as C from './controller.js';

export function createReviewStep(s0) {
  let destroyed = false;
  let takePlayer = null;
  let solo = null; // MixPreview used for "backing only" / "voice only"
  const d0 = s0.draft;

  const playerSlot = h('div', { class: 'take-slot' }, spinner('녹음을 불러오는 중…'));
  getBlob(d0.takeId).then((blob) => {
    if (destroyed) return;
    if (!blob) {
      playerSlot.replaceChildren(notice('error', '이 기기의 저장 공간에서 녹음 파일을 찾을 수 없어요.'));
      return;
    }
    takePlayer = createTakePlayer({ blob, mimeType: d0.takeMime, knownDuration: d0.duration });
    playerSlot.replaceChildren(takePlayer.el);
  }).catch((err) => {
    if (!destroyed) playerSlot.replaceChildren(notice('error', `녹음을 불러오지 못했어요: ${err.message}`));
  });

  const noticeSlot = h('div');
  const checksSlot = h('div');
  const actionsSlot = h('div');

  const el = h('div', { class: 'step step-review' },
    h('section', { class: 'card your-cover' },
      h('h2', { class: 'card-title' }, h('span', { 'aria-hidden': 'true' }, '🎤'), '내 커버'),
      h('p', { class: 'small muted' }, `${formatTime(d0.duration)} · ${SOURCE_INFO[d0.mode].long} · 실제로 녹음된 파일이에요.`),
      playerSlot),
    noticeSlot,
    checksSlot,
    actionsSlot,
  );

  // ---------------------------------------------------------------- solo listening (real stems)
  const soloButtons = {};
  async function playSolo(which) {
    // Resume audio inside this tap (iOS), before any await.
    const ctx = getPlaybackContext();
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    if (takePlayer) takePlayer.pause();
    if (solo && solo.playing && solo.solo === which) {
      solo.pause();
      return;
    }
    try {
      const stems = await C.loadDraftStems(C.studio.get().draft);
      if (destroyed) return;
      if (!solo) {
        solo = new MixPreview(stems, { ...C.studio.get().draft.settings, trimStart: 0, trimEnd: stems.duration });
        solo.on(paintSolo);
      }
      solo.setSolo(which);
      solo.play(0);
    } catch (err) {
      noticeSlot.replaceChildren(notice('error', `따로 녹음된 트랙을 불러오지 못했어요: ${err.message}`));
    }
  }
  function paintSolo() {
    for (const [which, btn] of Object.entries(soloButtons)) {
      const on = !!(solo && solo.playing && solo.solo === which);
      btn.classList.toggle('is-on', on);
      btn.querySelector('.btn-label').textContent = on ? '멈춤' : which === 'backing' ? '반주만' : '목소리만';
    }
  }

  // ---------------------------------------------------------------- verification
  function checkRow(ok, label, detail) {
    return h('li', { class: `check-row ${ok === true ? 'is-ok' : ok === false ? 'is-bad' : 'is-maybe'}` },
      h('span', { class: 'check-icon', 'aria-hidden': 'true' }, ok === true ? '✓' : ok === false ? '✕' : '•'),
      h('span', { class: 'check-label' }, label),
      h('span', { class: 'check-text' }, detail));
  }
  function levelRow(label, verdict, peak) {
    if (verdict === 'ok') return checkRow(true, label, `들려요 — 최대 ${formatDb(peak)}`);
    if (verdict === 'quiet') return checkRow(null, label, `아주 작아요 — 최대 ${formatDb(peak)}`);
    return checkRow(false, label, '무음 — 들리는 소리가 담기지 않았어요');
  }

  function buildChecks(d) {
    const ch = d.checks || {};
    const speaker = d.mode === 'speaker';
    const rows = [];
    if (d.mode === 'tab') rows.push(checkRow(!!ch.backingTrack, '🎵 반주 오디오 트랙', ch.backingTrack ? '공유한 오디오 트랙이 살아 있었어요' : '살아 있는 공유 오디오 트랙이 없었어요'));
    if (d.mode === 'upload') rows.push(checkRow(!!ch.backingTrack, '🎵 반주 파일', `“${d.backingFileName || '올린 파일'}” 파일이 믹스에 재생됐어요`));
    rows.push(checkRow(!!ch.micTrack, '🎤 마이크 트랙', ch.micTrack ? '녹음하는 동안 살아 있었어요' : '꺼져 있었어요'));
    rows.push(checkRow(!!ch.mixedStream, speaker ? '🎚 녹음 스트림' : '🎚 믹스 스트림', speaker ? '마이크 녹음 스트림' : '반주 + 목소리를 하나의 스트림으로 섞었어요'));
    rows.push(checkRow(!!ch.recordedBlob, '💾 녹음 파일', `${mimeLabel(d.takeMime)} · ${formatBytes(d.takeSize)}`));
    if (!speaker) rows.push(levelRow('🎵 반주가 들리는지', d.backingVerdict, d.stats.backing.peak));
    rows.push(levelRow(speaker ? '🎤 마이크 소리가 들리는지' : '🎤 목소리가 들리는지', d.voiceVerdict, d.stats.voice.peak));

    const parts = [
      h('h2', { class: 'card-title' }, icon('check'), '녹음 확인하기'),
      h('ul', { class: 'check-list' }, rows),
    ];

    if (!speaker) {
      soloButtons.backing = button('반주만', { variant: 'soft', size: 'sm', icon: 'music', onClick: () => playSolo('backing') });
      soloButtons.voice = button('목소리만', { variant: 'soft', size: 'sm', icon: 'mic', onClick: () => playSolo('voice') });
      parts.push(h('div', { class: 'row-wrap' }, h('span', { class: 'small muted' }, '따로 들어 보기:'), soloButtons.backing, soloButtons.voice));
      paintSolo();
    } else {
      const answer = d.selfCheck;
      parts.push(h('div', { class: 'self-check' },
        h('p', null, h('strong', null, '위의 녹음을 들어 보세요. 목소리 뒤로 노래가 들리나요?')),
        h('div', { class: 'row-wrap' },
          button('네, 둘 다 들려요', { size: 'sm', variant: answer === 'both' ? 'primary' : 'soft', icon: 'check', onClick: () => C.updateDraft({ selfCheck: 'both' }, { immediate: true }) }),
          button('아니요 — 목소리만 들려요', { size: 'sm', variant: answer === 'voice-only' ? 'primary' : 'soft', onClick: () => C.updateDraft({ selfCheck: 'voice-only' }, { immediate: true }) }))));
    }

    const problems = C.saveProblems(d);
    const out = [h('section', { class: 'card' }, ...parts)];
    if (problems.length) {
      const why = [];
      if (C.backingCaptured(d) === false) {
        if (d.mode === 'tab') {
          why.push(d.tabSource === 'other-tab' ? '녹음하는 동안 공유한 탭이 조용했어요 — 녹음을 누른 다음 그 탭에서 노래를 시작해 주세요.'
            : d.tabSource === 'system' ? '녹음하는 동안 컴퓨터에서 소리가 나지 않았어요 — 녹음을 누른 다음 노래를 시작해 주세요.'
              : '녹음하는 동안 이 페이지가 조용했어요. 노래를 다른 곳에서 튼다면 반주 소스에서 “다른 탭”이나 “컴퓨터 전체”를 골라 주세요. 아니라면 영상이 재생되고 있는지 확인해 주세요.');
        }
        else if (d.mode === 'upload') why.push('올린 반주에서 소리가 나지 않았어요. 파일이 무음이 아닌지 확인해 주세요.');
        else why.push('마이크가 노래를 담지 못했어요. 영상을 (헤드폰 말고) 스피커로 틀거나, 깨끗한 믹스를 위해 반주 파일을 올려 주세요.');
      }
      if (d.voiceVerdict === 'silent') why.push('맞는 마이크가 선택돼 있는지, 음소거가 아닌지 확인해 주세요.');
      const ack = h('input', { type: 'checkbox', checked: !!d.incompleteAck });
      ack.addEventListener('change', () => C.updateDraft({ incompleteAck: ack.checked }, { immediate: true }));
      out.push(notice('error', why.join(' '), {
        title: problems.join(' '),
        actions: [
          button('다시 녹음', { size: 'sm', variant: 'primary', icon: 'restart', onClick: () => retake() }),
          h('label', { class: 'check' }, ack, '그래도 간직하기 (미완성으로 표시돼요)'),
        ],
      }));
    }
    return out;
  }

  // ---------------------------------------------------------------- actions
  async function retake() {
    const ok = await confirmDialog({
      title: '이 녹음을 지우고 다시 녹음할까요?',
      message: '지금 녹음이 이 기기에서 삭제돼요.',
      confirmText: '지우고 다시 녹음', danger: true,
    });
    if (ok) C.retake();
  }

  function buildActions(d) {
    const problems = C.saveProblems(d);
    const needsSelfCheck = d.mode === 'speaker' && !d.selfCheck;
    const blocked = needsSelfCheck || (problems.length > 0 && !d.incompleteAck);
    return h('div', { class: 'step-actions' },
      needsSelfCheck ? h('p', { class: 'small muted still-needed' }, '저장하기 전에 위의 질문에 답해 주세요.') : null,
      button('믹스 & 자르기', { variant: 'primary', icon: 'sliders', size: 'lg', block: true, onClick: () => C.toEdit() }),
      button('싱글로 저장', { variant: 'soft', icon: 'check', block: true, disabled: blocked, onClick: () => C.toSingleForm() }),
      button('지우고 다시 녹음', { variant: 'danger', icon: 'trash', block: true, onClick: retake }),
    );
  }

  let lastDraft = null;
  let lastNotice = undefined;
  function update(s) {
    if (s.notice !== lastNotice) {
      lastNotice = s.notice;
      noticeSlot.replaceChildren(...(s.notice ? [notice(s.notice.type, s.notice.text, { title: s.notice.type === 'warn' ? '녹음이 중간에 끊겼어요' : null })] : []));
    }
    if (s.draft && s.draft !== lastDraft) {
      lastDraft = s.draft;
      checksSlot.replaceChildren(...buildChecks(s.draft));
      actionsSlot.replaceChildren(buildActions(s.draft));
    }
  }

  update(s0);
  return {
    el,
    update,
    destroy() {
      destroyed = true;
      if (takePlayer) takePlayer.destroy();
      if (solo) solo.dispose();
    },
  };
}
