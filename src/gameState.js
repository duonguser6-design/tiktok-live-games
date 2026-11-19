// Shared game state for all five themes. Theme-agnostic: a "spot" is a
// boat, flower, star, seat, or balloon depending on the active theme, and
// the overlay renders the same spot list differently per theme. Spots and
// the meter persist across theme switches; queued animations do not.
//
// Privacy: user ids exist only in memory, only for the 1-spot rule,
// cooldowns, and like-delta baselines. Broadcasts, snapshots, logs, and
// health data never contain user ids, raw names, or comment text.
//
// Sunrise Lake 3D mode (new GameState({ lake3D: true }) with theme
// sunrise-lake) runs the finalized round-3 mechanisms from
// lake3d-config.js. Every lake mechanism has an automatic trigger and
// runs with no creator input at all: the fish school fires from the
// group cast event, scenes advance on the 12 minute schedule, the like
// cycle resets itself after the finale and rest, bait vote rounds roll
// every 90 seconds, and the thank-you ticker scrolls on its own timer.
// Creator hotkeys are optional overrides only, never required. Without
// the lake3D flag the legacy rules apply unchanged.

import {
  MAX_SPOTS, QUEUE_CAP, ANIMATION_MIN_SPACING_MS, COMMAND_COOLDOWN_MS,
  MAX_DECORATIONS_PER_SPOT, LIKE_DELTA_CAP, DEDUPE_CAP,
  RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX_PER_USER, METER_THRESHOLDS,
} from './config.js';
import { LAKE_3D, OVERFLOW_TOAST } from './lake3d-config.js';
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
    this.lake3D = options.lake3D === true;
    this.spots = new Map(); // userId -> spot; unbound restored spots: 'restored:<slot>'
    this.hiddenUsers = new Set();
    this.queue = new AnimationQueue({
      cap: QUEUE_CAP, minSpacingMs: ANIMATION_MIN_SPACING_MS, nowFn: this.nowFn,
    });
    this.dedupe = new Dedupe(DEDUPE_CAP);
    this.cooldowns = new Map(); // userId -> last accepted command time
    this.commandCooldowns = new Map(); // lake mode: userId -> Map(command -> time)
    this.pending = new Map(); // userId -> { command, queuedAt }
    this.lastLikeTotal = new Map(); // userId -> last seen like total
    this.rateLimit = new Map(); // userId -> [timestamps]
    this.meterTotal = 0;
    this.thresholdsHit = new Set();
    // Lake-mode like cycle. meterTotal stays cumulative; cycleTotal is the
    // running cycle only, restBank holds likes that arrive during the rest.
    this.cycleTotal = 0;
    this.cycleHit = new Set();
    this.restingUntil = 0;
    this.restBank = 0;
    this.pendingFinale = false;
    this.lastLargeLikeEventAt = 0;
    // Lake-mode group cast event: distinct viewers casting in one window.
    this.groupCast = { windowStart: 0, userIds: new Set(), lockUntil: 0 };
    // Lake-mode scene schedule and bait vote round (both automatic).
    this.sceneIndex = 0;
    this.sceneStartedAt = null;
    this.baitRound = {
      round: 0, option: LAKE_3D.BAIT_VOTE_DEFAULT, startedAt: 0, votes: new Map(),
    };
    // Lake-mode thank-you ticker: arrival order, one entry per follower.
    this.tickerEntries = []; // { name, userId, hidden } — userId in memory only
    this.tickerCursor = 0;
    this.lastTickerAt = 0;
    this.paused = false;
    this.killed = false;
    this.connection = 'offline';
    this.counters = {
      received: 0, applied: 0, duplicates: 0, droppedPaused: 0,
      droppedRateLimit: 0, droppedQueue: 0, ignoredUnknownCommand: 0,
      ignoredCooldown: 0, ignoredPending: 0, ignoredDuplicateFollow: 0,
      streakSkipped: 0, ignoredShareJoin: 0, overflowToasts: 0,
    };
    if (this.isLake3D()) this.startLakeClock(this.nowFn());
  }

  get theme() {
    return getTheme(this.themeId);
  }

  /** True only for the Sunrise Lake 3D rebuild: lake3D flag plus lake theme. */
  isLake3D() {
    return this.lake3D === true && this.themeId === 'sunrise-lake';
  }

  /** Start (or restart) the automatic lake clocks: scene at sunrise and a
   *  fresh bait vote round. Called when the lake becomes active. */
  startLakeClock(now) {
    this.sceneIndex = 0;
    this.sceneStartedAt = now;
    this.baitRound.startedAt = now;
    this.baitRound.votes.clear();
    this.lastTickerAt = now;
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
    const cap = this.isLake3D() ? LAKE_3D.MAX_ANGLERS : MAX_SPOTS;
    const used = new Set([...this.spots.values()].map((s) => s.slot));
    for (let slot = 0; slot < cap; slot += 1) {
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
        // The snapshot hidden flag is the persisted record of this
        // viewer hide choice (user ids are never written to disk), so
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

  // Thank-you ticker (lake mode only): every follower once per session,
  // in arrival order, including overflow followers. Deduped by user id;
  // a restored entry with no user id binds by name instead, with the
  // same same-name caveat as spots.
  addTickerEntry(name, userId) {
    if (!this.isLake3D()) return;
    const clean = String(name || '').slice(0, 48);
    if (!clean) return;
    if (this.tickerEntries.some((e) => e.userId && e.userId === userId)) return;
    const unbound = this.tickerEntries.find(
      (e) => !e.userId && e.name.toLowerCase() === clean.toLowerCase(),
    );
    if (unbound) {
      unbound.userId = userId;
      if (this.hiddenUsers.has(userId)) unbound.hidden = true;
      return;
    }
    this.tickerEntries.push({ name: clean, userId, hidden: this.hiddenUsers.has(userId) });
  }

  updateTickerHidden(userId, name, hidden) {
    if (!this.isLake3D()) return;
    const byUser = this.tickerEntries.find((e) => e.userId && e.userId === userId);
    if (byUser) {
      byUser.hidden = hidden;
      return;
    }
    const lower = String(name || '').toLowerCase();
    const byName = this.tickerEntries.find((e) => !e.userId && e.name.toLowerCase() === lower);
    if (byName) byName.hidden = hidden;
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
      this.addTickerEntry(rebound.displayName, event.userId);
      this.enqueue({ kind: 'follow', priority: PRIORITY.follow, slot: rebound.slot, displayName: rebound.displayName, rebound: true });
      this.counters.applied += 1;
      this.onChange();
      return { applied: true, reason: 'rebound' };
    }
    const slot = this.nextSlot();
    if (slot < 0) {
      this.counters.overflowToasts += 1;
      // Overflow followers see exactly this: no visual is promised, and
      // none is given. They still join the thank-you ticker in lake mode.
      const toastText = this.isLake3D() ? OVERFLOW_TOAST : 'All 48 spots are full — thank you!';
      this.addTickerEntry(this.filteredName(event.displayName), event.userId);
      this.enqueue({ kind: 'toast', priority: PRIORITY.ambient, displayName: this.filteredName(event.displayName), text: toastText });
      return { applied: true, reason: 'overflow-toast' };
    }
    const baseName = this.filteredName(event.displayName);
    const displayName = this.suffixedDisplayName(baseName);
    const spot = {
      userId: event.userId, slot, baseName, displayName,
      hidden: this.hiddenUsers.has(event.userId),
      decorations: [], visualStates: [], lastAction: null, lastActionAt: 0, createdAt: now,
    };
    this.spots.set(event.userId, spot);
    this.addTickerEntry(displayName, event.userId);
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
      this.updateTickerHidden(event.userId, this.filteredName(event.displayName), hidden);
      this.counters.applied += 1;
      this.onChange();
      return { applied: true, reason: 'hide', hidden };
    }
    if (this.isLake3D()) return this.applyLakeCommand(event, now);
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

  // Lake-mode commands: per-command cooldowns, one pending per person,
  // silent visual states, bait voting, and group cast tracking. Viewers
  // without a spot still take part: their commands run with slot -1.
  applyLakeCommand(event, now) {
    const command = event.command;
    const cooldownMs = LAKE_3D.COMMAND_COOLDOWNS_MS[command];
    const perUser = this.commandCooldowns.get(event.userId);
    const last = perUser ? (perUser.get(command) || 0) : 0;
    if (cooldownMs != null && now - last < cooldownMs) {
      this.counters.ignoredCooldown += 1;
      return { applied: false, reason: 'cooldown' };
    }
    if (this.pending.has(event.userId)) {
      this.counters.ignoredPending += 1;
      return { applied: false, reason: 'pending' };
    }
    const spot = this.spots.get(event.userId);
    if (perUser) perUser.set(command, now);
    else this.commandCooldowns.set(event.userId, new Map([[command, now]]));
    this.pending.set(event.userId, { command, queuedAt: now });
    const action = this.theme.commands[command].action;
    // Visual state: the first use of this command in the session adds the
    // matching state to the spot. Silent: no toast, no extra animation,
    // no announcement of any kind. The command animation below is the
    // action effect itself, not an announcement. Follow never adds one.
    if (spot && LAKE_3D.VISUAL_STATES.includes(action)) {
      if (!spot.visualStates) spot.visualStates = [];
      if (!spot.visualStates.includes(action)) spot.visualStates.push(action);
    }
    if (spot) { spot.lastAction = action; spot.lastActionAt = now; }
    if (command === '!bait') this.castBaitVote(event.userId);
    if (command === '!cast') this.recordGroupCast(event.userId, now);
    this.enqueue({
      kind: 'command', priority: PRIORITY.command, action, command,
      slot: spot ? spot.slot : -1, displayName: this.filteredName(event.displayName),
      pendingUserId: event.userId,
    });
    this.counters.applied += 1;
    this.onChange();
    return { applied: true, reason: 'command' };
  }

  // Bait vote: each !bait moves the voter single vote to the next option
  // in order. First !bait in a round votes the first option.
  castBaitVote(userId) {
    const options = LAKE_3D.BAIT_VOTE_OPTIONS.map((o) => o.id);
    const votes = this.baitRound.votes;
    const current = votes.get(userId);
    const idx = current == null ? -1 : options.indexOf(current);
    const next = options[(idx + 1) % options.length];
    votes.set(userId, next);
    return next;
  }

  // End of a bait vote round (automatic, from tick): majority wins, a tie
  // keeps the current option. Votes are per round only and never persist.
  resolveBaitRound(now) {
    const counts = new Map();
    for (const option of this.baitRound.votes.values()) {
      counts.set(option, (counts.get(option) || 0) + 1);
    }
    let best = null;
    let bestCount = 0;
    let tied = false;
    for (const [option, count] of counts) {
      if (count > bestCount) {
        best = option;
        bestCount = count;
        tied = false;
      } else if (count === bestCount) {
        tied = true;
      }
    }
    if (best != null && !tied) this.baitRound.option = best;
    this.baitRound.round += 1;
    this.baitRound.startedAt = now;
    this.baitRound.votes.clear();
    this.onChange();
  }

  // Group cast event (automatic): distinct viewers casting inside one
  // window. Each person counts once per window; on reaching the needed
  // count a fish school fires and a lock starts, during which casts do
  // not accumulate. Works for viewers without a spot.
  recordGroupCast(userId, now) {
    const g = this.groupCast;
    if (now < g.lockUntil) return false;
    if (g.windowStart === 0 || now - g.windowStart >= LAKE_3D.GROUP_CAST_WINDOW_MS) {
      g.windowStart = now;
      g.userIds.clear();
    }
    if (g.userIds.has(userId)) return false;
    g.userIds.add(userId);
    if (g.userIds.size >= LAKE_3D.GROUP_CAST_NEEDED) {
      g.userIds.clear();
      g.windowStart = 0;
      g.lockUntil = now + LAKE_3D.GROUP_LOCK_MS;
      this.triggerSchool();
      return true;
    }
    return false;
  }

  // Fish school, never attributed to a viewer. Called automatically by
  // the group cast event, or by the optional creator hotkey.
  triggerSchool() {
    this.enqueue({ kind: 'school', priority: PRIORITY.gift, effect: 'school' });
    this.onChange();
  }

  // Next scene immediately. The schedule in tick does the same thing
  // automatically; this is the optional creator override.
  advanceScene() {
    if (!this.isLake3D()) return false;
    this.sceneIndex = (this.sceneIndex + 1) % LAKE_3D.SCENES.length;
    this.sceneStartedAt = this.nowFn();
    this.onChange();
    return true;
  }

  largeLikeGapElapsed(now) {
    return this.lastLargeLikeEventAt === 0
      || now - this.lastLargeLikeEventAt >= LAKE_3D.LARGE_LIKE_EVENT_MIN_GAP_MS;
  }

  // Finale request: run at once when the large-event gap has elapsed,
  // otherwise hold in the single pending slot (extras are dropped).
  requestFinale(now) {
    if (this.largeLikeGapElapsed(now)) this.dispatchFinale(now);
    else this.pendingFinale = true;
  }

  dispatchFinale(now) {
    this.enqueue({ kind: 'finale', priority: PRIORITY.gift, effect: 'finale' });
    this.lastLargeLikeEventAt = now;
    this.restingUntil = now + LAKE_3D.FINALE_REST_MS;
    this.pendingFinale = false;
  }

  // Lake-mode like handling: likes go only to the shared meter. During
  // the rest, likes keep adding to the cumulative total and to the bank,
  // never to the running cycle, and no milestone effects fire.
  applyLakeLikes(delta, now) {
    if (now < this.restingUntil) {
      this.restBank += delta;
      return;
    }
    this.cycleTotal += delta;
    const milestones = LAKE_3D.LIKE_MILESTONES;
    for (const at of milestones) {
      if (this.cycleTotal >= at && !this.cycleHit.has(at)) {
        this.cycleHit.add(at);
        if (at === milestones[milestones.length - 1]) this.requestFinale(now);
        else {
          this.enqueue({
            kind: 'meter-stage', priority: PRIORITY.ambient, threshold: at,
          });
        }
      }
    }
  }

  // End of the finale rest (automatic, from tick): the banked likes
  // become the new cycle, and any milestones they cross fire in order.
  checkRestEnd(now) {
    if (this.restingUntil === 0 || now < this.restingUntil) return;
    this.restingUntil = 0;
    const banked = this.restBank;
    this.restBank = 0;
    this.cycleTotal = banked;
    this.cycleHit = new Set();
    const milestones = LAKE_3D.LIKE_MILESTONES;
    for (const at of milestones) {
      if (this.cycleTotal >= at && !this.cycleHit.has(at)) {
        this.cycleHit.add(at);
        if (at === milestones[milestones.length - 1]) this.requestFinale(now);
        else {
          this.enqueue({
            kind: 'meter-stage', priority: PRIORITY.ambient, threshold: at,
          });
        }
      }
    }
  }

  // Thank-you ticker (automatic, from tick): every 20 seconds the next
  // up to 3 names go out, in arrival order. Hidden entries are skipped
  // and consumed: the cursor passes them, since a hidden person chose
  // not to appear.
  emitTicker(now) {
    if (!this.isLake3D()) return;
    if (now - this.lastTickerAt < LAKE_3D.TICKER_INTERVAL_MS) return;
    if (this.tickerCursor >= this.tickerEntries.length) return;
    const names = [];
    while (this.tickerCursor < this.tickerEntries.length
      && names.length < LAKE_3D.TICKER_MAX_NAMES) {
      const entry = this.tickerEntries[this.tickerCursor];
      this.tickerCursor += 1;
      if (entry.hidden) continue;
      names.push(entry.name);
    }
    this.lastTickerAt = now;
    if (names.length === 0) return;
    this.enqueue({ kind: 'ticker', priority: PRIORITY.ambient, names });
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
    if (this.isLake3D()) {
      this.applyLakeLikes(delta, this.nowFn());
    } else {
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
    }
    this.counters.applied += 1;
    this.onChange();
    return { applied: true, reason: 'like', delta };
  }

  // Drop the oldest queued gift animation when the lake gift queue is
  // full (10). The dropped item counts as dropped, never retried.
  dropOldestGiftIfFull() {
    const giftKinds = this.queue.items.filter(
      (i) => i.kind === 'gift' || i.kind === 'gift-scene',
    ).length;
    if (giftKinds < LAKE_3D.GIFT_ANIMATION_QUEUE) return;
    const dropped = this.queue.dropOldestByKind('gift')
      || this.queue.dropOldestByKind('gift-scene');
    if (dropped) this.counters.droppedQueue += 1;
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
      if (this.isLake3D()) {
        // Lake mode: one decoration slot per spot, replaced by each new
        // gift, kept for the session. Effect by gift type only.
        spot.decorations = [effect];
        this.dropOldestGiftIfFull();
      } else {
        spot.decorations.push(effect);
        while (spot.decorations.length > MAX_DECORATIONS_PER_SPOT) spot.decorations.shift();
      }
      this.enqueue({ kind: 'gift', priority: PRIORITY.gift, slot: spot.slot, effect, displayName: spot.displayName });
    } else {
      if (this.isLake3D()) this.dropOldestGiftIfFull();
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
    if (this.isLake3D()) {
      // Automatic lake rhythm, in order: rest end, held finale, scene
      // schedule, bait vote round, thank-you ticker. Nothing here waits
      // for a creator press.
      this.checkRestEnd(now);
      if (this.pendingFinale && this.largeLikeGapElapsed(now)) {
        this.dispatchFinale(now);
      }
      if (this.sceneStartedAt != null
        && now - this.sceneStartedAt >= LAKE_3D.SCENE_MS) {
        this.sceneIndex = (this.sceneIndex + 1) % LAKE_3D.SCENES.length;
        this.sceneStartedAt = now;
        this.onChange();
      }
      if (this.baitRound.startedAt > 0
        && now - this.baitRound.startedAt >= LAKE_3D.BAIT_VOTE_ROUND_MS) {
        this.resolveBaitRound(now);
      }
      this.emitTicker(now);
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
    if (this.isLake3D()) this.startLakeClock(this.nowFn());
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
    this.commandCooldowns.clear();
    this.pending.clear();
    this.lastLikeTotal.clear();
    this.rateLimit.clear();
    this.meterTotal = 0;
    this.thresholdsHit.clear();
    this.cycleTotal = 0;
    this.cycleHit.clear();
    this.restingUntil = 0;
    this.restBank = 0;
    this.pendingFinale = false;
    this.lastLargeLikeEventAt = 0;
    this.groupCast = { windowStart: 0, userIds: new Set(), lockUntil: 0 };
    this.sceneIndex = 0;
    this.sceneStartedAt = null;
    this.baitRound = {
      round: 0, option: LAKE_3D.BAIT_VOTE_DEFAULT, startedAt: 0, votes: new Map(),
    };
    this.tickerEntries = [];
    this.tickerCursor = 0;
    this.lastTickerAt = this.nowFn();
    this.paused = false;
    this.killed = false;
    for (const key of Object.keys(this.counters)) this.counters[key] = 0;
    if (this.isLake3D()) this.startLakeClock(this.nowFn());
    this.onChange();
  }

  restore(snapshot) {
    if (!snapshot) return;
    // A snapshot is a local file, but never trust its contents blindly:
    // an unknown theme falls back to the default, and slot numbers are
    // clamped to the active capacity with duplicates dropped.
    this.themeId = isValidTheme(snapshot.theme) ? snapshot.theme : DEFAULT_THEME;
    this.meterTotal = snapshot.meterTotal || 0;
    this.thresholdsHit = new Set(snapshot.thresholdsHit || []);
    const cap = this.isLake3D() ? LAKE_3D.MAX_ANGLERS : MAX_SPOTS;
    const seenSlots = new Set();
    for (const s of snapshot.spots || []) {
      if (!s || typeof s !== 'object') continue;
      const slot = Number(s.slot);
      if (!Number.isInteger(slot) || slot < 0 || slot >= cap) continue;
      if (seenSlots.has(slot)) continue;
      seenSlots.add(slot);
      const key = `restored:${slot}`;
      const decorations = [...(s.decorations || [])];
      // Lake mode keeps one decoration slot per spot: the newest one.
      const keptDecorations = this.isLake3D() ? decorations.slice(-1) : decorations;
      const visualStates = Array.isArray(s.visualStates)
        ? [...new Set(s.visualStates.filter((v) => LAKE_3D.VISUAL_STATES.includes(v)))]
        : [];
      this.spots.set(key, {
        userId: null, slot, baseName: s.baseName || s.displayName,
        displayName: s.displayName,
        hidden: s.hidden === true, decorations: keptDecorations,
        visualStates,
        lastAction: null, lastActionAt: 0, createdAt: snapshot.savedAt || 0,
        unbound: true,
      });
    }
    if (this.isLake3D()) {
      const num = (v) => (Number.isFinite(v) ? v : 0);
      const now = this.nowFn();
      this.cycleTotal = Math.max(0, num(snapshot.cycleTotal));
      this.cycleHit = new Set(
        (Array.isArray(snapshot.cycleHit) ? snapshot.cycleHit : [])
          .filter((m) => LAKE_3D.LIKE_MILESTONES.includes(m)),
      );
      this.restingUntil = Math.max(0, num(snapshot.restingUntil));
      if (this.restingUntil > 0 && this.restingUntil <= now) this.restingUntil = 0;
      this.restBank = Math.max(0, num(snapshot.restBank));
      const sceneIndex = Number(snapshot.sceneIndex);
      this.sceneIndex = Number.isInteger(sceneIndex)
        && sceneIndex >= 0 && sceneIndex < LAKE_3D.SCENES.length ? sceneIndex : 0;
      const startedAt = Number(snapshot.sceneStartedAt);
      this.sceneStartedAt = Number.isFinite(startedAt) && startedAt > 0 ? startedAt : now;
      const bait = snapshot.baitVote && typeof snapshot.baitVote === 'object' ? snapshot.baitVote : {};
      const optionIds = LAKE_3D.BAIT_VOTE_OPTIONS.map((o) => o.id);
      const baitRound = Number(bait.round);
      this.baitRound = {
        round: Number.isInteger(baitRound) && baitRound >= 0 ? baitRound : 0,
        option: optionIds.includes(bait.option) ? bait.option : LAKE_3D.BAIT_VOTE_DEFAULT,
        startedAt: now,
        votes: new Map(),
      };
      this.tickerEntries = (Array.isArray(snapshot.ticker) ? snapshot.ticker : [])
        .filter((e) => e && typeof e.name === 'string' && e.name.length > 0)
        .map((e) => ({ name: String(e.name).slice(0, 48), userId: null, hidden: e.hidden === true }));
      const cursor = Number(snapshot.tickerCursor);
      this.tickerCursor = Number.isInteger(cursor)
        ? Math.min(Math.max(0, cursor), this.tickerEntries.length) : 0;
      this.lastTickerAt = now;
      this.lastLargeLikeEventAt = Math.max(0, num(snapshot.lastLargeLikeEventAt));
      this.pendingFinale = snapshot.pendingFinale === true;
    }
  }

  snapshotData() {
    const stage = [...this.thresholdsHit].sort((a, b) => a - b).pop();
    const stageLabel = stage
      ? (this.theme.meterStages.find((s) => s.at === stage) || {}).label || ''
      : '';
    const lake = this.isLake3D();
    const spots = [...this.spots.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((s) => {
        const entry = {
          slot: s.slot,
          displayName: s.hidden ? '' : s.displayName,
          hidden: s.hidden,
          decorations: [...s.decorations],
          lastAction: s.lastAction,
          lastActionAt: s.lastActionAt,
        };
        // Renderer data only: which first-use states this spot shows.
        // No counts, no labels, nothing that reads as a tally.
        if (lake) entry.visualStates = [...(s.visualStates || [])];
        return entry;
      });
    const snap = {
      version: 1,
      theme: this.themeId,
      status: { paused: this.paused, killed: this.killed, connection: this.connection },
      spots,
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
    if (lake) {
      const now = this.nowFn();
      snap.meter.cycle = {
        total: this.cycleTotal,
        milestones: [...LAKE_3D.LIKE_MILESTONES],
        hit: [...this.cycleHit].sort((a, b) => a - b),
        resting: this.restingUntil > now,
      };
      snap.scene = {
        index: this.sceneIndex,
        id: LAKE_3D.SCENES[this.sceneIndex],
        startedAt: this.sceneStartedAt,
      };
      snap.baitVote = { round: this.baitRound.round, option: this.baitRound.option };
    }
    return snap;
  }

  persistData(now = Date.now()) {
    const lake = this.isLake3D();
    const spots = [...this.spots.values()]
      .sort((a, b) => a.slot - b.slot)
      .map((s) => {
        const entry = {
          slot: s.slot, baseName: s.baseName, displayName: s.displayName, hidden: s.hidden,
          decorations: [...s.decorations],
        };
        if (lake) entry.visualStates = [...(s.visualStates || [])];
        return entry;
      });
    const data = {
      version: 1,
      savedAt: now,
      theme: this.themeId,
      meterTotal: this.meterTotal,
      thresholdsHit: [...this.thresholdsHit].sort((a, b) => a - b),
      spots,
    };
    if (lake) {
      data.cycleTotal = this.cycleTotal;
      data.cycleHit = [...this.cycleHit].sort((a, b) => a - b);
      data.restingUntil = this.restingUntil;
      data.restBank = this.restBank;
      data.sceneIndex = this.sceneIndex;
      data.sceneStartedAt = this.sceneStartedAt;
      data.baitVote = { round: this.baitRound.round, option: this.baitRound.option };
      // Names and hidden flags only, never user ids.
      data.ticker = this.tickerEntries.map((e) => ({ name: e.name, hidden: e.hidden }));
      data.tickerCursor = this.tickerCursor;
      data.lastLargeLikeEventAt = this.lastLargeLikeEventAt;
      data.pendingFinale = this.pendingFinale;
    }
    return data;
  }
}
