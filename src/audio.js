// Shared audio helpers: dependency-free on purpose, like themes.js — the
// browser overlay and control panel import it directly (served at
// /audio.js) and the Node server and tests import it too.
//
// Playback uses HTML Audio elements only. There is no synthesized audio
// anywhere in this package: no oscillators, no generated tones, no
// WebAudio tone generation. The no-synthesis test enforces this by
// scanning src/, public/, and scripts/.

export const AUDIO_DEFAULTS = {
  muted: false,
  // BGM default 30% (was 40%): the loop runs for hours, so it sits well
  // under the creator's voice and does not tire ears; SFX stay at 70%.
  bgmVolume: 0.3,
  sfxVolume: 0.7,
  reducedMotion: false,
};

export const SFX_EVENT_KINDS = ['follow', 'gift', 'milestone', 'command'];

// Animation kinds produced by the game -> sound-effect kinds in the
// manifest. Toasts stay silent: they are overflow notices, not moments.
export const ANIMATION_TO_SFX = {
  follow: 'follow',
  command: 'command',
  gift: 'gift',
  'gift-scene': 'gift',
  'meter-stage': 'milestone',
  toast: null,
};

function clamp01(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/**
 * Normalize partial audio settings over a base (defaults when omitted).
 * Volumes are clamped to 0..1, flags are coerced to booleans, and unknown
 * keys are ignored, so a stray control message can never corrupt state.
 */
export function normalizeAudioSettings(input, base = AUDIO_DEFAULTS) {
  const next = { ...base };
  if (!input || typeof input !== 'object') return next;
  if (input.muted !== undefined) next.muted = input.muted === true;
  if (input.bgmVolume !== undefined) next.bgmVolume = clamp01(input.bgmVolume, base.bgmVolume);
  if (input.sfxVolume !== undefined) next.sfxVolume = clamp01(input.sfxVolume, base.sfxVolume);
  if (input.reducedMotion !== undefined) next.reducedMotion = input.reducedMotion === true;
  return next;
}

/** File name for the background loop of a theme, or null when unmapped. */
export function bgmForTheme(manifest, themeId) {
  if (!manifest || typeof manifest !== 'object') return null;
  const map = manifest.bgm;
  if (!map || typeof map !== 'object') return null;
  const file = map[themeId];
  return typeof file === 'string' && file ? file : null;
}

/** File name for a sound-effect kind, or null when unmapped. */
export function sfxForEvent(manifest, kind) {
  if (!manifest || typeof manifest !== 'object') return null;
  const map = manifest.sfx;
  if (!map || typeof map !== 'object') return null;
  const file = map[kind];
  return typeof file === 'string' && file ? file : null;
}

/** Sound-effect kind for an animation kind, or null when it stays silent. */
export function sfxKindForAnimation(animationKind) {
  if (!Object.prototype.hasOwnProperty.call(ANIMATION_TO_SFX, animationKind)) return null;
  return ANIMATION_TO_SFX[animationKind];
}
