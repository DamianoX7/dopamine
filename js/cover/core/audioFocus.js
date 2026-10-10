// Only one thing plays at a time (mini-player, take review, mix preview, recording).
// An owner is any object with a pause() method.

let current = null;

export function claimAudioFocus(owner) {
  if (current && current !== owner) {
    try { current.pause(); } catch (err) { console.warn('[audioFocus] pause failed', err); }
  }
  current = owner;
}

export function releaseAudioFocus(owner) {
  if (current === owner) current = null;
}
