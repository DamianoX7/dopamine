// Navigation for the studio and the covers library inside Dopamine World. The app's own hash
// router (ui.js) decides which view is on screen; this module only translates the paths these
// views use and keeps the guards that block leaving while a take is recorded or saved.

const guards = new Set();

/** '/music/albums' → '#/covers/albums' — the library lives under the My Covers tab. */
export function toHash(path) {
  if (path === '/') return '#/home';
  const music = /^\/music(?:\/(singles|albums))?$/.exec(path);
  if (music) return music[1] === 'albums' ? '#/covers/albums' : '#/covers';
  return `#${path}`;
}

/**
 * guard(nextRoute) returns a message to block navigation, or null to allow it.
 * Returns a function that removes the guard.
 */
export function addNavigationGuard(fn) {
  guards.add(fn);
  return () => guards.delete(fn);
}

/** Why the app may not switch to the view called `name` right now (null = it may). */
export function blockedReason(name) {
  for (const guard of guards) {
    const msg = guard({ name });
    if (msg) return msg;
  }
  return null;
}

export function navigate(path, { replace = false } = {}) {
  const hash = toHash(path);
  if (hash === location.hash) return;
  if (replace) {
    history.replaceState(null, '', hash);
    window.CoverHost.rerender();
  } else {
    location.hash = hash;
  }
}
