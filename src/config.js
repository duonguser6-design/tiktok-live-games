// Server-side constants. Theme-specific values live in themes.js (shared
// with the browser overlay). Nothing here may contain credentials: the game
// is configured by public username only. See config.example.

import { METER_THRESHOLDS } from './themes.js';

export const HOST = '127.0.0.1'; // Never bound to a public interface.
export const DEFAULT_PORT = 3000;
export const DEFAULT_THEME = 'sunrise-lake';

export const MAX_SPOTS = 48; // Visible spots per session. Extra follows get a
// short thank-you toast only (no new spot). See README "Capacity".
export const QUEUE_CAP = 100; // Pending animations. See queue.js drop policy.
export const ANIMATION_MIN_SPACING_MS = 600; // Slow idle pacing; never realtime.
export const COMMAND_COOLDOWN_MS = 10000; // Per viewer, per command stream.
export const COMMAND_MAX_LENGTH = 32; // Comment text considered for commands.
export const COMMENT_MAX_LENGTH = 128; // Raw comment text is never stored.
export const NAME_MAX_LENGTH = 24;
export const MAX_DECORATIONS_PER_SPOT = 6; // Oldest decoration is replaced.
export const LIKE_DELTA_CAP = 1000; // Sanity cap on one like batch delta.
export const DEDUPE_CAP = 5000; // Remembered message ids (FIFO eviction).
export const RATE_LIMIT_WINDOW_MS = 60000;
export const RATE_LIMIT_MAX_PER_USER = 30; // Normalized events per user/minute.
export const SNAPSHOT_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours, local only.
export const SNAPSHOT_DEBOUNCE_MS = 500;
export const METER_BROADCAST_MIN_INTERVAL_MS = 500;

export const RECONNECT = {
  baseDelayMs: 2000,
  maxDelayMs: 32000,
  maxAttempts: 5, // Consecutive failures before the circuit opens (paused).
  jitter: 0.3, // +/-30% jitter on each delay.
  openCooldownMs: 60000, // Pause before a single probe attempt.
};

export { METER_THRESHOLDS };
