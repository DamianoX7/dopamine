// Bottom sheet (mobile) / dialog (desktop) for forms and pickers. Simple yes/no questions use
// Dopamine World's own confirm dialog.
import { h } from './dom.js';
import { icon } from './icons.js';

let openCount = 0;
const openSheets = new Set();

/** Close every open sheet (used when the route changes). */
export function closeAllSheets() {
  for (const close of [...openSheets]) close();
}

/**
 * openSheet({ title, content, footer, dismissible, onClose, wide })
 * Returns { el, body, close }.
 */
export function openSheet({ title, content, footer = null, dismissible = true, onClose = null, wide = false } = {}) {
  const previouslyFocused = document.activeElement;
  const closeBtn = dismissible
    ? h('button', { class: 'btn icon ghost small sheet-close', type: 'button', 'aria-label': '닫기' }, icon('x'))
    : null;
  const body = h('div', { class: 'sheet-body' }, content);
  const panel = h('div', { class: `sheet${wide ? ' sheet-wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title || '대화 상자' },
    h('div', { class: 'sheet-grabber', 'aria-hidden': 'true' }),
    title ? h('div', { class: 'sheet-head' }, h('h2', { class: 'sheet-title' }, title), closeBtn) : closeBtn,
    body,
    footer ? h('div', { class: 'sheet-foot' }, footer) : null,
  );
  const backdrop = h('div', { class: 'cv sheet-backdrop' }, panel);
  let closed = false;

  function close(result) {
    if (closed) return;
    closed = true;
    openSheets.delete(close);
    // Leaving: not interactive and hidden from assistive tech while it animates out.
    backdrop.inert = true;
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.style.pointerEvents = 'none';
    backdrop.classList.remove('in');
    document.removeEventListener('keydown', onKey, true);
    openCount = Math.max(0, openCount - 1);
    if (!openCount) document.body.classList.remove('cv-sheet-open');
    setTimeout(() => backdrop.remove(), 220);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      try { previouslyFocused.focus({ preventScroll: true }); } catch { /* ignore */ }
    }
    if (onClose) onClose(result);
  }

  function onKey(e) {
    if (e.key === 'Escape' && dismissible) { e.stopPropagation(); close(); }
  }

  if (closeBtn) closeBtn.addEventListener('click', () => close());
  backdrop.addEventListener('pointerdown', (e) => {
    if (e.target === backdrop && dismissible) close();
  });
  document.addEventListener('keydown', onKey, true);
  document.body.append(backdrop);
  openSheets.add(close);
  openCount++;
  document.body.classList.add('cv-sheet-open');
  requestAnimationFrame(() => {
    backdrop.classList.add('in');
    const focusable = panel.querySelector('input, textarea, select, button:not(.sheet-close)');
    (focusable || panel).focus?.({ preventScroll: true });
  });
  panel.tabIndex = -1;
  return { el: panel, body, close };
}

/** confirmDialog({ title, message, confirmText, cancelText, danger }) -> Promise<boolean> */
export function confirmDialog({ title = '계속할까요?', message = '', confirmText = '확인', cancelText = '취소', danger = false } = {}) {
  return window.CoverHost.confirm({ title, text: message, ok: confirmText, cancel: cancelText, danger });
}
