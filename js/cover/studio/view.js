// Studio screen: keeps the YouTube player mounted in one place for the whole session
// (moving an iframe in the DOM reloads it) and swaps the step content around it.
import { h } from '../core/dom.js';
import { pageHead } from '../ui/common.js';
import { studio, attachYouTubeHost, enterStudio, onLeave } from './controller.js';
import { createPrepareStep } from './stepPrepare.js';
import { createRecordStep } from './stepRecord.js';
import { createReviewStep } from './stepReview.js';
import { createEditStep } from './stepEdit.js';
import { createSingleStep } from './stepSingle.js';
import { createSavedStep } from './stepSaved.js';

const STEPS = [
  { id: 'prepare', label: '준비' },
  { id: 'record', label: '녹음' },
  { id: 'review', label: '확인' },
  { id: 'edit', label: '믹스' },
  { id: 'single', label: '싱글' },
];

const FACTORIES = {
  prepare: createPrepareStep,
  record: createRecordStep,
  review: createReviewStep,
  edit: createEditStep,
  single: createSingleStep,
  saved: createSavedStep,
};

export function mountStudio(root) {
  const stepper = h('ol', { class: 'stepper', 'aria-label': '단계' });
  const ytHost = h('div', { class: 'yt-host' });
  const ytCard = h('section', { class: 'card yt-card', 'aria-label': '유튜브 플레이어' }, h('div', { class: 'yt-frame' }, ytHost));
  const side = h('div', { class: 'studio-side' });
  const top = h('div', { class: 'studio-top' }, ytCard, side);
  const main = h('div', { class: 'studio-main' });
  const late = document.body.classList.contains('late-night');
  const el = h('div', { class: 'cv screen studio' },
    h('div', { class: 'studio-head' },
      pageHead(late ? '🌙 심야 스튜디오' : '🎤 커버 스튜디오', { sub: late ? '조용히 불러요 — 별들이 듣고 있어요.' : '“내 목소리로 만드는 나만의 작은 발매.”' }),
      stepper),
    top,
    main,
  );
  root.append(el);

  let current = null;
  let lastStepper = '';

  function renderStepper(step) {
    if (lastStepper === step) return;
    lastStepper = step;
    const idx = step === 'saved' ? STEPS.length : STEPS.findIndex((x) => x.id === step);
    stepper.replaceChildren(...STEPS.map((x, i) => h('li', {
      class: ['step-dot', i < idx && 'is-done', i === idx && 'is-current'],
      'aria-current': i === idx ? 'step' : null,
    }, h('span', { class: 'step-num', 'aria-hidden': 'true' }, i < idx ? '✓' : String(i + 1)), h('span', { class: 'step-label' }, x.label))));
  }

  function render(s) {
    el.dataset.step = s.step;
    // A video that failed to load (e.g. embedding switched off) has nothing to show here.
    const videoUsable = !!s.yt.videoId && (s.yt.status === 'loading' || s.yt.status === 'ready');
    el.classList.toggle('has-video', videoUsable);
    ytCard.hidden = !(videoUsable && ['prepare', 'record'].includes(s.step));
    renderStepper(s.step);
    if (!current || current.id !== s.step) {
      if (current && current.view.destroy) current.view.destroy();
      main.replaceChildren();
      side.replaceChildren();
      const view = FACTORIES[s.step](s);
      main.append(view.el);
      if (view.side) side.append(view.side);
      current = { id: s.step, view };
      window.scrollTo({ top: 0, behavior: 'auto' });
    } else if (current.view.update) {
      current.view.update(s);
    }
  }

  attachYouTubeHost(ytHost);
  enterStudio();
  const unsub = studio.subscribe(render);
  render(studio.get());

  return () => {
    unsub();
    if (current && current.view.destroy) current.view.destroy();
    onLeave();
    el.remove();
  };
}
