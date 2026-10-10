/** Show a short message with Dopamine World's toasts. type: 'info' | 'ok' | 'warn' | 'error'. */
export function toast(message, { type = 'info', timeout = 3800 } = {}) {
  window.CoverHost.toast(message, type, timeout);
}
