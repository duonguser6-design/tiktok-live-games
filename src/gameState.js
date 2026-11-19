// Shared game state for all five themes. Theme-agnostic: a "spot" is a
// boat, flower, star, seat, or balloon depending on the active theme, and
// the overlay renders the same spot list differently per theme. Spots and
// the meter persist across theme switches; queued animations do not.
//
// Privacy: user ids exist only in memory, only for the 1-spot rule,
// cooldowns, and like-delta baselines. Broadcasts, snapshots, logs, and
// health data never contain user ids, raw names, or comment text.

import {
  MAX_SPOTS, QUEUE_CAP, ANIMATION_MIN_SPACING_MS, COMMAND_COOLDOWN_MS,
  MAX_DECORATIONS_PER_SPOT, LIKE_DELTA_CAP, DEDUPE_CAP,
  RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_PER_USER, METER_THRESHOLDS,
} from './config.js';
import { getTheme, giftEffectFor, isValidTheme, DEFAULT_THEME } from './themes.js';
import { sanitizeDisplayName } from './nameFilter.js';
import { Dedupe } from './dedupe.js';
import { AnimationQueue, PRIORITY } from './queue.js';

const PENDING_TTL_MS = 60000;

export class GameState {
  constructor(options = {}) {
    this.nowFn = options.nowFn || (() => Date.now());
    this.onChange = options.onChange || (() => {});
    this.streamerName = options.streamerName || '';
    this.extraBannedWords = options.extraBannedWords || '';
    this.themeId = options.theme || 'sunrise-lake';
    this.spots = new Map(); // userId -> spot; unbound restored spots: 'restored:<slot>'
    this.hiddenUsers = new Set();
    this.queue = new AnimationQueue({
      cap: QUEUE_CAP, minSpacingMs: ANIMATION_MIN_SPACING_MS, nowFn: this.nowFn,
    });
    this.dedupe = new Dedupe(DEDUPE_CAP);
    this.cooldowns = new Map(); // userId -> last accepted command time
    this.pending = new Map(); // userId -> { command, queuedAt }
    this.lastLikeTotal = new Map(); // userId -> last seen like total
    this.rateLimit = new Map(); // userId -> [timestamps]
    this.meterTotal = 0;
    this.thresholdsHit = new Set();
    this.paused = false;
    this.killed = false;
    this.connection = 'offline';
    this.counters = {
      received: 0, applied: 0, duplicates: 0, droppedPaused: 0,
      droppedRateLimit: 0, droppedQueue: 0, ignoredUnknownCommand: 0,
      ignoredCooldown: 0, ignoredPending: 0, ignoredDuplicateFollow: 0,
      streakSkipped: 0, ignoredShareJoin: 0, overflowToasts: 0,
    };
  }

  get theme() {
    return getTheme(this.themeId);
  }

  setConnection(status) {
    this.connection = status;
    this.onChange();
  }

  filteredName(raw) {
    return sanitizeDisplayName(raw, {
      streamerName: this.streamerName,
      extraBannedWords: this.extraBannedWords,
    }).name;
  }

  rateLimited(userId, now) {
    const windowStart = now - RATE_LIMIT_WINDOW_MS;
    const stamps = (this.rateLimit.get(userId) || []).filter((t) => t > windowStart);
    if (stamps.length >= RATE_LIMIT_MAX_PER_USER) {
      this.rateLimit.set(userId, stamps);
      return true;
    }
    stamps.push(now);
    this.rateLimit.set(userId, stamps);
    return false;
  }

  nextSlot() {
    const used = new Set([...this.spots.values()].map((s) => s.slot));
    for (let slot = 0; slot < MAX_SPOTS; slot += 1) {
      if (!used.has(slot)) return slot;
    }
    return -1;
  }

  // Display name for a new spot. Two viewers with the same filtered name
  // must never look identical on screen (impersonation): the first keeps
  // the bare name, later ones get a stable numeric suffix — "Maya 2",
  // "Maya 3" — counted from the spots already present, so the suffix is
  // deterministic within a session and survives restarts via the snapshot
  // (the suffixed display name is stored, not recomputed).
  suffixedDisplayName(baseName) {
    const lower = baseName.toLowerCase();
    const taken = [...this.spots.values()]
      .filter((s) => (s.baseName || '').toLowerCase() === lower).length;
    return taken === 0 ? baseName : `${baseName} ${taken + 1}`;
  }

  // Bind a restored (unbound) spot to the viewer behind an event, by
  // filtered-name match. Identity stays by user id, not by name: the
  // match only re-attaches a spot that has no viewer yet, in slot order.
  // With duplicate base names the earliest unbound same-name spot binds
  // first — names alone cannot tell two same-name viewers apart after a
  // restart (user ids are never written to disk). Callers must check
  // spots.has(userId) first, so a viewer who already owns a spot can
  // never steal a second one.
  bindRestoredSpot(event) {
    if (this.spots.has(event.userId)) return null;
    const name = this.filteredName(event.displayName);
    for (const [key, spot] of this.spots) {
      if (spot.unbound && (spot.baseName || '').toLowerCase() === name.toLowerCase()) {
        this.spots.delete(key);
        spot.unbound = false;
        spot.userId = event.userId;
        // The snapshot's hidden flag is the persisted record of this
        // viewer's hide choice (user ids are never written to disk), so
        // re-attach it to the toggle set: without this, the first !hide
        // after a restart would hide again instead of unhiding.
        if (spot.hidden) this.hiddenUsers.add(event.userId);
        else if (this.hiddenUsers.has(event.userId)) spot.hidden = true;
        this.spots.set(event.userId, spot);
        return spot;
      }
    }
    return null;
  }

  ingest(event) {
    this.counters.received += 1;
    if (this.paused || this.killed) {
      this.counters.droppedPaused += 1;
      return { applied: false, reason: 'paused' };
    }
    if (this.dedupe.seen(event.msgId)) {
      this.counters.duplicates += 1;
      return { applied: false, reason: 'duplicate' };
    }
    const now = this.nowFn();
    if (this.rateLimited(event.userId, now)) {
      this.counters.droppedRateLimit += 1;
      return { applied: false, reason: 'rate-limit' };
    }
    switch (event.type) {
      case 'follow': return this.applyFollow(event, now);
      case 'comment': return this.applyComment(event, now);
      case 'like': return this.applyLike(event, now);
      case 'gift': return this.applyGift(event, now);
      default:
        this.counters.ignoredShareJoin += 1;
        return { applied: false, reason: 'no-effect' };
    }
  }

  applyFollow(event, now) {
    if (this.spots.has(event.userId)) {
      this.counters.ignoredDuplicateFollow += 1;
      return { applied: false, reason: 'duplicate-follow' };
    }
    // Rebind a restored (unbound) spot by filtered-name match after restart.
    const rebound = this.bindRestoredSpot(event);
    if (rebound) {
      this.enqueue({ kind: 'follow', priority: PRIORITY.follow, slot: rebound.slot, displayName: rebound.displayName, rebound: true });
      this.counters.applied += 1;
      this.onChange();
      return { applied: true, reason: 'rebound' };
    }
    const slot = this.nextSlot();
    if (slot < 0) {
      this.counters.overflowToasts += 1;
      // The 49th follower sees exactly this: no visual is promised, and
      // none is given — the toast says all 48 spots are full.
      this.enqueue({ kind: 'toast', priority: PRIORITY.ambient, displayName: this.filteredName(event.displayName), text: 'All 48 spots are full — thank you!' });
      return { applied: true, reason: 'overflow-toast' };
    }
    const baseName = this.filteredName(event.displayName);
    const displayName = this.suffixedDisplayName(baseName);
    const spot = {
      userId: event.userId, slot, baseName, displayName,
      hidden: this.hiddenUsers.has(event.userId),
      decorations: [], lastAction: null, lastActionAt: 0, createdAt: now,
    };
    this.spots.set(event.userId, spot);
    this.enqueue({ kind: 'follow', priority: PRIORITY.follow, slot, displayName });
    this.counters.applied += 1;
    this.onChange();
    return { applied: true, reason: 'follow' };
  }

  applyComment(event, now) {
    const command = event.command;
    const commands = this.theme.commands;
    if (!command || !commands[command]) {
      this.counters.ignoredUnknownCommand += 1;
      return { applied: false, reason: 'unknown-command' };
    }
    // A valid command from a viewer also re-attaches their restored spot,
    // so !hide (and any command) keeps working after a restart without a
    // re-follow. Unknown text never binds: it carries no identity signal.
    this.bindRestoredSpot(event);
    // !hide is instant, exempt from cooldown/pending: hiding a name must
    // always work, immediately.
    if (command === '!hide') {
      const hidden = !this.hiddenUsers.has(event.userId);
      if (hidden) this.hiddenUsers.add(event.userId);
      else this.hiddenUsers.delete(event.userId);
      const spot = this.spots.get(event.userId);
      if (spot) spot.hidden = hidden;
      this.counters.applied += 1;
      this.onChange();
      return { applied: true, reason: 'hide', hidden };
    }
    const last = this.cooldowns.get(event.userId) || 0;
    if (now - last < COMMAND_COOLDOWN_MS) {
      this.counters.ignoredCooldown += 1;
      return { applied: false, reason: 'cooldown' };
    }
    if (this.pending.has(event.userId)) {
      this.counters.ignoredPending += 1;
      return { applied: false, reason: 'pending' };
    }
    const spot = this.spots.get(event.userId);
    this.cooldowns.set(event.userId, now);
    this.pending.set(event.userId, { command, queuedAt: now });
    const action = commands[command].action;
    if (spot) { spot.lastAction = action; spot.lastActionAt = now; }
    this.enqueue({
      kind: 'command', priority: PRIORITY.command, action, command,
      slot: spot ? spot.slot : -1, displayName: this.filteredName(event.displayName),
      pendingUserId: event.userId,
    });
    this.counters.applied += 1;
    this.onChange();
    return { applied: true, reason: 'command' };
  }

  applyLike(event) {
    let delta = 0;
    if (event.likeTotal != null) {
      const last = this.lastLikeTotal.get(event.userId);
      if (last == null) {
        // First sighting establishes the baseline; only the batch counts.
        delta = event.likeCount ?? 0;
      } else if (event.likeTotal >= last) {
        delta = event.likeTotal - last;
      } else {
        // Total reset (e.g. after idle): fall back to the batch count.
        delta = event.likeCount ?? event.likeTotal;
      }
      this.lastLikeTotal.set(event.userId, event.likeTotal);
    } else {
      delta = event.likeCount ?? 0;
    }
    delta = Math.max(0, Math.min(LIKE_DELTA_CAP, Math.floor(delta)));
    if (delta <= 0) return { applied: false, reason: 'no-delta' };
    const before = this.meterTotal;
    this.meterTotal += delta;
    for (const at of METER_THRESHOLDS) {
      if (before < at && this.meterTotal >= at && !this.thresholdsHit.has(at)) {
        this.thresholdsHit.add(at);
        const stage = this.theme.meterStages.find((s) => s.at === at);
        this.enqueue({
          kind: 'meter-stage', priority: PRIORITY.ambient,
          threshold: at, label: stage ? stage.label : '',
        });
      }
    }
    this.counters.applied += 1;
    this.onChange();
    return { applied: true, reason: 'like', delta };
  }

  applyGift(event) {
    if (!event.repeatEnd) {
      this.counters.streakSkipped += 1;
      return { applied: false, reason: 'streak-not-final' };
    }
    // A gift from a viewer also re-attaches their restored spot, so
    // decorations land on the right visual after a restart.
    this.bindRestoredSpot(event);
    const effect = giftEffectFor(this.themeId, event.giftId, event.giftName);
    const spot = this.spots.get(event.userId);
    if (spot) {
      spot.decorations.push(effect);
      while (spot.decorations.length > MAX_DECORATIONS_PER_SPOT) spot.decorations.shift();
      this.enqueue({ kind: 'gift', priority: PRIORITY.gift, slot: spot.slot, effect, displayName: spot.displayName });
    } else {
      this.enqueue({ kind: 'gift-scene', priority: PRIORITY.gift, effect, displayName: this.filteredName(event.displayName) });
    }
    this.counters.applied += 1;
    this.onChange();
    return { applied: true, reason: 'gift', effect };
  }

  enqueue(item) {
    const result = this.queue.push(item);
    if (result.displaced && result.displaced.pendingUserId) {
      this.pending.delete(result.displaced.pendingUserId);
    }
    if (!result.queued) {
      this.counters.droppedQueue += 1;
      if (item.pendingUserId) this.pending.delete(item.pendingUserId);
    }
    if (result.displaced) this.counters.droppedQueue += 1;
    return result;
  }

  /** Dispatch due animations (spacing enforced). Returns dispatched items. */
  tick() {
    const now = this.nowFn();
    for (const [userId, p] of [...this.pending]) {
      if (now - p.queuedAt > PENDING_TTL_MS) this.pending.delete(userId);
    }
    const dispatched = [];
    let item;
    while ((item = this.queue.next())) {
      if (item.pendingUserId) this.pending.delete(item.pendingUserId);
      dispatched.push(item);
    }
    return dispatched;
  }

  setTheme(themeId) {
    if (!isValidTheme(themeId)) return false;
    if (themeId === this.themeId) return true;
    this.themeId = themeId;
    this.queue.clear();
    this.pending.clear();
    this.onChange();
    return true;
  }

  pause() {
    this.paused = true;
    this.onChange();
  }

  resume() {
    this.paused = false;
    this.killed = false;
    this.onChange();
  }

  kill() {
    this.paused = true;
    this.killed = true;
    this.queue.clear();
    this.pending.clear();
    this.onChange();
  }

  reset() {
    this.spots.clear();
    this.hiddenUsers.clear();
    this.queue.clear();
    this.dedupe.clear();
    this.cooldowns.clear();
    this.pending.clear();
    this.lastLikeTotal.clear();
    this.rateLimit.clear();
    this.meterTotal = 0;
    this.thresholdsHit.clear();
    this.paused = false;
    this.killed = false;
    for (const key of Object.keys(this.counters)) this.counters[key] = 0;
    this.onChange();
  }

  restore(snapshot) {
    if (!snapshot) return;
    // A snapshot is a local file, but never trust its contents blindly:
    // an unknown theme falls back to the default, and slot numbers are
    // clamped to the 48-spot capacity with duplicates dropped.
    this.themeId = isValidTheme(snapshot.theme) ? snapshot.theme : DEFAULT_THEME;
    this.meterTotal = snapshot.meterTotal || 0;
    this.thresholdsHit = new Set(snapshot.thresholdsHit || []);
    const seenSlots = new Set();
    for (const s of snapshot.spots || []) {
      if (!s || typeof s !== 'object') continue;
      const slot = Number(s.slot);
      if (!Number.isInteger(slot) || slot < 0 || slot >= MAX_SPOTS) continue;
      if (seenSlots.has(slot)) continue;
      seenSlots.add(slot);
      const key = `restored:${slot}`;
      this.spots.set(key, {
        userId: null, slot, baseName: s.baseName || s.displayName,
        displayName: s.displayName,
        hidden: s.hidden === true, decorations: [...(s.decorations || [])],
        lastAction: null, lastActionAt: 0, createdAt: snapshot.savedAt || 0,
        unbound: true,
      });
    }
  }

  snapshotData() {
    const stage = [...this.thresholdsHit].sort((a, b) => a - b).pop();
    const stageLabel = stage
      ? (this.theme.meterStages.find((s) => s.at === stage) || {}).label || ''
      : '';
    return {
      version: 1,
      theme: this.themeId,
      status: { paused: this.paused, killed: this.killed, connection: this.connection },
      spots: [...this.spots.values()]
        .sort((a, b) => a.slot - b.slot)
        .map((s) => ({
          slot: s.slot,
          displayName: s.hidden ? '' : s.displayName,
          hidden: s.hidden,
          decorations: [...s.decorations],
          lastAction: s.lastAction,
          lastActionAt: s.lastActionAt,
        })),
      meter: {
        total: this.meterTotal,
        thresholds: [...METER_THRESHOLDS],
        hit: [...this.thresholdsHit].sort((a, b) => a - b),
        label: this.theme.meterLabel,
        stageLabel,
      },
      counters: { ...this.counters },
      queueSize: this.queue.size,
      spotCount: this.spots.size,
    };
  }

  persistData(now = Date.now()) {
    return {
      version: 1,
      savedAt: now,
      theme: this.themeId,
      meterTotal: this.meterTotal,
      thresholdsHit: [...this.thresholdsHit].sort((a, b) => a - b),
      spots: [...this.spots.values()]
        .sort((a, b) => a.slot - b.slot)
        .map((s) => ({
          slot: s.slot, baseName: s.baseName, displayName: s.displayName, hidden: s.hidden,
          decorations: [...s.decorations],
        })),
    };
  }
}
