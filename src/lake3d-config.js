// Published, tunable numbers for the Sunrise Lake 3D rebuild (flagship).
// Dependency-free on purpose: the Node server and tests import this file,
// and the browser overlay imports it too (served at /lake3d-config.js).
// Every number in the finalized round-3 mechanism list lives here and
// nowhere else, so it can be tuned after real testing without hunting
// through the renderer or the game state.
//
// Wording rule for everything in this file: none of the words in
// BANNED_WORDS below may appear in any user-facing string — decorations
// and thank-yous only. The CTA-scan test enforces the ban over this file
// and every UI string.

export const LAKE_3D = Object.freeze({
  // 3D scene: at most 16 anglers sit around the lake. Followers past 16
  // see only the thank-you toast (no visual is promised, none is given).
  MAX_ANGLERS: 16,

  // Per-person cooldowns, per command. Commands sent during cooldown are
  // dropped silently. 1 pending command per person.
  COMMAND_COOLDOWNS_MS: Object.freeze({ '!cast': 8000, '!wave': 8000, '!bait': 10000 }),
  MAX_PENDING_PER_USER: 1,

  // Effect concurrency (renderer-side): at most 4 small effects and 1
  // large effect on screen at once; the queue holds 100 (drop oldest).
  MAX_SMALL_EFFECTS: 4,
  MAX_LARGE_EFFECTS: 1,
  EFFECT_QUEUE_CAP: 100,

  // 3 fixed visual states per viewer, each added once per session by
  // their FIRST use of that command (never by follow, never counted or
  // labelled on screen): !cast, !bait, !wave.
  VISUAL_STATES: Object.freeze(['cast', 'bait', 'wave']),

  // Gifts: 1 decoration slot per person, kept for the session. At most 5
  // mapped gift types, by gift TYPE only (never by coin value); anything
  // unmapped falls back to the default lantern. Only 1 gift animation at
  // a time, queue 10. No randomness, no rarity, no prizes.
  GIFT_MAX_MAPPED_TYPES: 5,
  GIFT_DEFAULT: 'lantern',
  GIFT_MAPPED_TYPES: Object.freeze(['lantern', 'blossom', 'sun-hat', 'flag', 'fish-charm']),
  GIFT_SLOTS_PER_SPOT: 1,
  GIFT_ANIMATION_QUEUE: 10,

  // Shared like meter: 6 milestones per cycle. At 1200 the finale runs,
  // the scene rests 2 minutes, the cycle resets to 0 and repeats. The
  // meter shows fill only — no remaining count, no countdown, no urging.
  // Large like-events: at most 1 per 3 minutes (extras queue, max 1).
  LIKE_MILESTONES: Object.freeze([50, 150, 300, 500, 800, 1200]),
  FINALE_REST_MS: 120000,
  LARGE_LIKE_EVENT_MIN_GAP_MS: 180000,
  LARGE_LIKE_EVENT_QUEUE: 1,

  // Ambient events: on average one visible event every 8s (6-10s range),
  // visual-only randomness with a seed, never attributed to a viewer.
  AMBIENT_MIN_MS: 6000,
  AMBIENT_MAX_MS: 10000,

  // Group event: 3 DIFFERENT people !cast within 30s triggers a fish
  // school; each person counts once per window, then a 60s lock.
  GROUP_CAST_WINDOW_MS: 30000,
  GROUP_CAST_NEEDED: 3,
  GROUP_LOCK_MS: 60000,

  // Scene schedule: sunrise -> noon -> sunset -> starry night, 12 minutes
  // each (48-minute loop), 20s crossfade, no flashing.
  SCENES: Object.freeze(['sunrise', 'noon', 'sunset', 'starry']),
  SCENE_MS: 720000,
  SCENE_CROSSFADE_MS: 20000,

  // !bait vote: 3 options, 90s rounds, 1 vote per person per round
  // (changeable, still counts as 1). Majority wins; a tie keeps the
  // current option. The result only changes bobber/lantern colour.
  // Voting: each !bait moves the voter's single vote to the next option
  // in order (worm -> corn -> berry -> worm ...).
  BAIT_VOTE_ROUND_MS: 90000,
  BAIT_VOTE_OPTIONS: Object.freeze([
    Object.freeze({ id: 'worm', label: 'Worm', color: '#e07840' }),
    Object.freeze({ id: 'corn', label: 'Corn', color: '#ffd94a' }),
    Object.freeze({ id: 'berry', label: 'Berry', color: '#b06ab3' }),
  ]),
  BAIT_VOTE_DEFAULT: 'worm',

  // Thank-you ticker: scrolls every 20s, max 3 names per pass, each
  // person once per session, in arrival order (never by contribution).
  TICKER_INTERVAL_MS: 20000,
  TICKER_MAX_NAMES: 3,

  // Creator hotkeys (control panel): 4 keys, at most 1 action per 10s.
  // Creator-triggered events are never attributed to a viewer.
  HOTKEY_LIMIT_MS: 10000,
  HOTKEYS: Object.freeze([
    Object.freeze({ id: 'school', key: '1', label: 'Fish school' }),
    Object.freeze({ id: 'scene', key: '2', label: 'Next scene' }),
    Object.freeze({ id: 'pause', key: '3', label: 'Pause / resume' }),
    Object.freeze({ id: 'mute', key: '4', label: 'Mute / unmute' }),
  ]),

  // Photosensitivity: nothing oscillates faster than this period.
  FLASH_MIN_PERIOD_S: 4.5,
});

// Pure thank-you for followers past the 16 seats: no promise, no
// mention of anything in return, just thanks.
export const OVERFLOW_TOAST = 'All 16 seats are full — thank you!';

// Scene palettes for the 12-minute day cycle (sunrise values match the
// existing 2D lake palette). The renderer crossfades between neighbours.
export const SCENE_PALETTES = Object.freeze({
  sunrise: Object.freeze({ skyTop: '#1d3a5f', skyBottom: '#f7b267', waterTop: '#3e7ca8', waterBottom: '#1d4e6b', sun: '#ffd97a' }),
  noon: Object.freeze({ skyTop: '#2f6da8', skyBottom: '#bfe3f2', waterTop: '#4a90c8', waterBottom: '#2a6a8a', sun: '#fff3b0' }),
  sunset: Object.freeze({ skyTop: '#3b2a4a', skyBottom: '#f78d5c', waterTop: '#7a4a6a', waterBottom: '#3a2a4a', sun: '#ff9a5c' }),
  starry: Object.freeze({ skyTop: '#070b1d', skyBottom: '#1c2a52', waterTop: '#131c38', waterBottom: '#0a0f24', sun: '#f4f1de' }),
});

// Words banned from every user-facing string (UI, overlay, README,
// visible source). Use "decoration" / "thank-you" wording instead.
export const BANNED_WORDS = Object.freeze(['upgrade', 'unlock', 'level', 'rare', 'collect']);

// HOW TO PLAY board: the only commands, with literal descriptions.
// Never mentions follow or gifts. The cooldown is stated literally per
// command; !hide has no cooldown (it is exempt). Rendered on the overlay
// for Sunrise Lake, small, outside the creator camera zone.
export const HOW_TO_PLAY = Object.freeze([
  Object.freeze({ command: '!cast', description: 'cast your line', cooldownSeconds: 8 }),
  Object.freeze({ command: '!bait', description: 'vote for bait', cooldownSeconds: 10 }),
  Object.freeze({ command: '!wave', description: 'wave', cooldownSeconds: 8 }),
  Object.freeze({ command: '!hide', description: 'hides your name', cooldownSeconds: 0 }),
]);

export function howToPlayText() {
  return HOW_TO_PLAY.map((line) => {
    const cooldown = line.cooldownSeconds > 0
      ? `${line.cooldownSeconds}s cooldown`
      : 'no cooldown';
    return `${line.command}: ${line.description} (${cooldown})`;
  });
}
