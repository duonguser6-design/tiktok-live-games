import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { GameState } from '../src/gameState.js';
import { normalizeEvent } from '../src/events.js';
import { LAKE_3D, OVERFLOW_TOAST } from '../src/lake3d-config.js';
import { THEMES, giftEffectFor } from '../src/themes.js';
import { AnimationQueue } from '../src/queue.js';
import { createGameServer } from '../src/server.js';
import { SimulatorAdapter } from '../src/adapters/simulatorAdapter.js';
import { ManualAdapter } from '../src/adapters/manualAdapter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function makeClock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms) => { now += ms; } };
}

function makeLake(theme = 'sunrise-lake', clock = makeClock()) {
  const state = new GameState({ theme, lake3D: true, nowFn: clock.now, streamerName: 'streamer' });
  return { state, clock };
}

let msgSeq = 0;
function fresh(partial, source = 'simulator') {
  msgSeq += 1;
  return normalizeEvent({ msgId: `lake3d-${msgSeq}`, timestamp: 1_000_000, ...partial }, source);
}

// Advance the clock and run one tick, collecting dispatched animations.
function step(state, clock, ms = 700) {
  clock.advance(ms);
  return state.tick();
}

// Drain the queue: advance in small steps so the spacing elapses.
function drain(state, clock, steps = 10) {
  const out = [];
  for (let i = 0; i < steps; i += 1) out.push(...step(state, clock));
  return out;
}

function follow(state, userId, name) {
  const res = state.ingest(fresh({ type: 'follow', userId, displayName: name }));
  assert.equal(res.applied, true, `follow ${name} should apply: ${res.reason}`);
  return res;
}

function command(state, userId, name, text) {
  return state.ingest(fresh({ type: 'comment', userId, displayName: name, text }));
}

// Accept a command and settle the queue so the next command can proceed.
// Returns the animations dispatched while settling.
function doCommand(state, clock, userId, name, text) {
  const res = command(state, userId, name, text);
  assert.equal(res.applied, true, `${text} from ${name} should apply: ${res.reason}`);
  return drain(state, clock, 2);
}

function like(state, userId, count) {
  const res = state.ingest(fresh({ type: 'like', userId, likeCount: count }));
  assert.equal(res.applied, true, `like ${count} should apply: ${res.reason}`);
  return res;
}

function gift(state, userId, name, giftName, giftId = '1') {
  return state.ingest(fresh({ type: 'gift', userId, displayName: name, giftId, giftName, repeatEnd: true }));
}

test('lake: numbers come from LAKE_3D, never hardcoded in the state', () => {
  assert.deepEqual(LAKE_3D.COMMAND_COOLDOWNS_MS, { '!cast': 8000, '!wave': 8000, '!bait': 10000 });
  assert.equal(LAKE_3D.MAX_ANGLERS, 16);
  assert.deepEqual(LAKE_3D.LIKE_MILESTONES, [50, 150, 300, 500, 800, 1200]);
  assert.equal(LAKE_3D.FINALE_REST_MS, 120000);
  assert.equal(LAKE_3D.LARGE_LIKE_EVENT_MIN_GAP_MS, 180000);
  assert.equal(LAKE_3D.GROUP_CAST_WINDOW_MS, 30000);
  assert.equal(LAKE_3D.GROUP_CAST_NEEDED, 3);
  assert.equal(LAKE_3D.GROUP_LOCK_MS, 60000);
  assert.equal(LAKE_3D.SCENE_MS, 720000);
  assert.deepEqual(LAKE_3D.SCENES, ['sunrise', 'noon', 'sunset', 'starry']);
  assert.equal(LAKE_3D.BAIT_VOTE_ROUND_MS, 90000);
  assert.equal(LAKE_3D.TICKER_INTERVAL_MS, 20000);
  assert.equal(LAKE_3D.TICKER_MAX_NAMES, 3);
  assert.equal(LAKE_3D.HOTKEY_LIMIT_MS, 10000);
  assert.equal(OVERFLOW_TOAST, 'All 16 seats are full — thank you!');
});

test('lake: per-command cooldowns are independent (!cast 8s, !wave 8s, !bait 10s)', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  drain(state, clock, 2);
  assert.equal(command(state, 'u1', 'Maya', '!cast').applied, true);
  drain(state, clock, 2);
  // !wave has its own cooldown: accepted right after !cast.
  assert.equal(command(state, 'u1', 'Maya', '!wave').applied, true);
  drain(state, clock, 2);
  // !cast again inside 8s: dropped silently, nothing new enqueued.
  const before = state.queue.items.length;
  const dropped = command(state, 'u1', 'Maya', '!cast');
  assert.equal(dropped.applied, false);
  assert.equal(dropped.reason, 'cooldown');
  assert.equal(state.queue.items.length, before);
  // !bait has its own 10s cooldown and was never used: accepted.
  assert.equal(command(state, 'u1', 'Maya', '!bait').applied, true);
  drain(state, clock, 2);
  // !bait again inside 10s: cooldown.
  assert.equal(command(state, 'u1', 'Maya', '!bait').reason, 'cooldown');
  clock.advance(8000);
  assert.equal(command(state, 'u1', 'Maya', '!cast').applied, true);
  drain(state, clock, 2);
  clock.advance(2000); // 10s since the first !bait
  assert.equal(command(state, 'u1', 'Maya', '!bait').applied, true);
});

test('lake: one pending command per person', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  drain(state, clock, 2);
  assert.equal(command(state, 'u1', 'Maya', '!cast').applied, true);
  clock.advance(9000); // past the 8s cooldown, but the first command is still queued
  assert.equal(command(state, 'u1', 'Maya', '!wave').reason, 'pending');
  drain(state, clock, 2); // dispatch clears the pending slot
  assert.equal(command(state, 'u1', 'Maya', '!wave').applied, true);
});

test('lake: 16 seats; the 17th follower gets the overflow toast only', () => {
  const { state, clock } = makeLake();
  for (let i = 0; i < 16; i += 1) follow(state, `u${i}`, `Viewer${i}`);
  assert.equal(state.spots.size, 16);
  const overflow = state.ingest(fresh({ type: 'follow', userId: 'u16', displayName: 'Late' }));
  assert.equal(overflow.applied, true);
  assert.equal(overflow.reason, 'overflow-toast');
  assert.equal(state.spots.size, 16);
  const dispatched = drain(state, clock, 40);
  const toast = dispatched.find((d) => d.kind === 'toast' && d.displayName === 'Late');
  assert.ok(toast, 'expected an overflow toast for Late');
  assert.equal(toast.text, OVERFLOW_TOAST);
  assert.equal(toast.text, 'All 16 seats are full — thank you!');
});

test('lake: visual states add on first use per command, never on follow', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  assert.deepEqual(state.snapshotData().spots[0].visualStates, []);
  doCommand(state, clock, 'u1', 'Maya', '!cast');
  assert.deepEqual(state.snapshotData().spots[0].visualStates, ['cast']);
  clock.advance(9000);
  doCommand(state, clock, 'u1', 'Maya', '!cast');
  assert.deepEqual(state.snapshotData().spots[0].visualStates, ['cast']);
  doCommand(state, clock, 'u1', 'Maya', '!wave');
  assert.deepEqual(state.snapshotData().spots[0].visualStates, ['cast', 'wave']);
  clock.advance(11000);
  doCommand(state, clock, 'u1', 'Maya', '!bait');
  assert.deepEqual(state.snapshotData().spots[0].visualStates, ['cast', 'wave', 'bait']);
  // No counts or labels anywhere in the snapshot for these states.
  const spot = state.snapshotData().spots[0];
  assert.deepEqual(
    Object.keys(spot).sort(),
    ['decorations', 'displayName', 'hidden', 'lastAction', 'lastActionAt', 'slot', 'visualStates'],
  );
});

test('lake: first !cast adds the state silently — exactly the command animation, nothing else', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  drain(state, clock, 2);
  assert.equal(state.queue.items.length, 0);
  const res = command(state, 'u1', 'Maya', '!cast');
  assert.equal(res.applied, true);
  assert.equal(state.queue.items.length, 1);
  assert.equal(state.queue.items[0].kind, 'command');
  assert.equal(state.queue.items[0].action, 'cast');
  assert.deepEqual(state.snapshotData().spots[0].visualStates, ['cast']);
});

test('lake: gift map is exactly the five mapped types, default lantern', () => {
  assert.deepEqual(
    Object.keys(THEMES['sunrise-lake'].giftEffects).sort(),
    [...LAKE_3D.GIFT_MAPPED_TYPES].sort(),
  );
  assert.equal(THEMES['sunrise-lake'].giftDefault, 'lantern');
  assert.equal(LAKE_3D.GIFT_DEFAULT, 'lantern');
  assert.equal(giftEffectFor('sunrise-lake', '1', 'Rose'), 'blossom');
  assert.equal(giftEffectFor('sunrise-lake', '1', 'Ball'), 'lantern'); // no bobber mapping any more
  assert.equal(giftEffectFor('sunrise-lake', '987654', 'ZqxUnknownGift'), 'lantern');
});

test('lake: one decoration slot per spot — a new gift replaces the old one', () => {
  const { state } = makeLake();
  follow(state, 'u1', 'Maya');
  assert.equal(gift(state, 'u1', 'Maya', 'Rose').effect, 'blossom');
  assert.deepEqual(state.snapshotData().spots[0].decorations, ['blossom']);
  assert.equal(gift(state, 'u1', 'Maya', 'Star').effect, 'lantern');
  assert.deepEqual(state.snapshotData().spots[0].decorations, ['lantern']);
  // Same gift name with a different gift id: same effect, never by value.
  assert.equal(gift(state, 'u1', 'Maya', 'Rose', '777').effect, 'blossom');
  assert.deepEqual(state.snapshotData().spots[0].decorations, ['blossom']);
});

test('queue: dropOldestByKind removes the oldest item of that kind only', () => {
  const queue = new AnimationQueue({ cap: 10, minSpacingMs: 0, nowFn: () => 1000 });
  queue.push({ kind: 'gift', priority: 2 });
  queue.push({ kind: 'command', priority: 1 });
  queue.push({ kind: 'gift', priority: 2 });
  const dropped = queue.dropOldestByKind('gift');
  assert.equal(dropped.kind, 'gift');
  assert.equal(queue.size, 2);
  assert.equal(queue.dropOldestByKind('toast'), null);
});

test('lake: gift animation queue holds 10; the 11th drops the oldest gift', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  drain(state, clock, 2);
  for (let i = 0; i < 11; i += 1) {
    assert.equal(gift(state, 'u1', 'Maya', 'Rose', `${i}`).applied, true);
  }
  const gifts = state.queue.items.filter((d) => d.kind === 'gift');
  assert.equal(gifts.length, 10);
  assert.ok(state.queue.dropped >= 1, 'expected the oldest gift to count as dropped');
  assert.ok(state.counters.droppedQueue >= 1);
});

test('lake: like cycle — milestones in order, finale at 1200, 2-min rest with banked likes, reset', () => {
  const { state, clock } = makeLake();
  like(state, 'u1', 50);
  let dispatched = drain(state, clock, 3);
  assert.deepEqual(dispatched.filter((d) => d.kind === 'meter-stage').map((d) => d.threshold), [50]);
  assert.equal(state.snapshotData().meter.cycle.total, 50);
  like(state, 'u2', 100);
  dispatched = drain(state, clock, 3);
  assert.deepEqual(dispatched.filter((d) => d.kind === 'meter-stage').map((d) => d.threshold), [150]);
  // 1000 more: crosses 300, 500, 800; then 50 more reaches 1200 and the finale.
  like(state, 'u3', 1000);
  dispatched = drain(state, clock, 8);
  assert.deepEqual(dispatched.filter((d) => d.kind === 'meter-stage').map((d) => d.threshold), [300, 500, 800]);
  like(state, 'u4', 50);
  dispatched = drain(state, clock, 3);
  assert.equal(dispatched.filter((d) => d.kind === 'finale').length, 1);
  assert.equal(state.snapshotData().meter.cycle.total, 1200);
  assert.equal(state.snapshotData().meter.cycle.resting, true);
  assert.equal(state.snapshotData().meter.total, 1200);
  // During the rest, likes add to the cumulative total and the bank only.
  like(state, 'u5', 200);
  assert.equal(state.snapshotData().meter.total, 1400);
  assert.equal(state.snapshotData().meter.cycle.total, 1200);
  assert.equal(state.restBank, 200);
  dispatched = drain(state, clock, 3);
  assert.equal(dispatched.filter((d) => d.kind === 'meter-stage').length, 0);
  assert.equal(dispatched.filter((d) => d.kind === 'finale').length, 0);
  // Rest ends after 2 minutes: the bank becomes the new cycle and its
  // milestones (50, 150) fire in order.
  clock.advance(120000);
  dispatched = drain(state, clock, 4);
  assert.deepEqual(dispatched.filter((d) => d.kind === 'meter-stage').map((d) => d.threshold), [50, 150]);
  assert.equal(state.snapshotData().meter.cycle.total, 200);
  assert.deepEqual(state.snapshotData().meter.cycle.hit, [50, 150]);
  assert.equal(state.snapshotData().meter.cycle.resting, false);
  assert.equal(state.restBank, 0);
});

test('lake: large like-event throttle — at most 1 finale per 3 min, one held', () => {
  const { state, clock } = makeLake();
  const finales = [];
  like(state, 'u1', 1000);
  like(state, 'u2', 200);
  finales.push(...drain(state, clock, 8).filter((d) => d.kind === 'finale'));
  assert.equal(finales.length, 1);
  assert.equal(state.snapshotData().meter.cycle.resting, true);
  // Bank 1200 likes during the rest so the next cycle hits 1200 at once.
  like(state, 'u3', 1000);
  like(state, 'u4', 200);
  assert.equal(state.restBank, 1200);
  clock.advance(120000);
  let dispatched = drain(state, clock, 8);
  // The bank crosses every milestone, but the finale is due only 2
  // minutes after the last one, so it is held in the single pending slot.
  assert.deepEqual(dispatched.filter((d) => d.kind === 'meter-stage').map((d) => d.threshold), [50, 150, 300, 500, 800]);
  assert.equal(dispatched.filter((d) => d.kind === 'finale').length, 0);
  assert.equal(state.persistData().pendingFinale, true);
  // Once 3 minutes have passed since the last finale, tick dispatches it.
  clock.advance(60000);
  dispatched = drain(state, clock, 2);
  finales.push(...dispatched.filter((d) => d.kind === 'finale'));
  assert.equal(finales.length, 2);
  assert.equal(state.snapshotData().meter.cycle.resting, true);
  assert.equal(state.persistData().pendingFinale, false);
});

test('lake: group event — 3 distinct !cast in 30s fires a fish school; same person twice counts once', () => {
  const { state, clock } = makeLake();
  const dispatched = [];
  // Spotless viewers count: nobody has followed.
  dispatched.push(...doCommand(state, clock, 'u1', 'Ava', '!cast'));
  clock.advance(9000);
  dispatched.push(...doCommand(state, clock, 'u1', 'Ava', '!cast')); // same person again: still one
  dispatched.push(...doCommand(state, clock, 'u2', 'Ben', '!cast'));
  dispatched.push(...drain(state, clock, 2));
  assert.equal(dispatched.filter((d) => d.kind === 'school').length, 0);
  dispatched.push(...doCommand(state, clock, 'u3', 'Cleo', '!cast'));
  dispatched.push(...drain(state, clock, 3));
  assert.equal(dispatched.filter((d) => d.kind === 'school').length, 1);
  // 60s lock: three more casts do nothing.
  dispatched.push(...doCommand(state, clock, 'u4', 'Dan', '!cast'));
  dispatched.push(...doCommand(state, clock, 'u5', 'Eli', '!cast'));
  dispatched.push(...doCommand(state, clock, 'u6', 'Fay', '!cast'));
  dispatched.push(...drain(state, clock, 3));
  assert.equal(dispatched.filter((d) => d.kind === 'school').length, 1);
  // After the lock, three fresh casts fire again.
  clock.advance(61000);
  dispatched.push(...doCommand(state, clock, 'u7', 'Gus', '!cast'));
  dispatched.push(...doCommand(state, clock, 'u8', 'Hal', '!cast'));
  dispatched.push(...doCommand(state, clock, 'u9', 'Ivy', '!cast'));
  dispatched.push(...drain(state, clock, 3));
  assert.equal(dispatched.filter((d) => d.kind === 'school').length, 2);
});

test('lake: group window expires after 30s without 3 distinct casters', () => {
  const { state, clock } = makeLake();
  const dispatched = [];
  dispatched.push(...doCommand(state, clock, 'u1', 'Ava', '!cast'));
  clock.advance(31000);
  dispatched.push(...doCommand(state, clock, 'u2', 'Ben', '!cast'));
  dispatched.push(...doCommand(state, clock, 'u3', 'Cleo', '!cast'));
  // Only Ben and Cleo are inside the new window.
  dispatched.push(...drain(state, clock, 2));
  assert.equal(dispatched.filter((d) => d.kind === 'school').length, 0);
  dispatched.push(...doCommand(state, clock, 'u4', 'Dan', '!cast'));
  dispatched.push(...drain(state, clock, 3));
  assert.equal(dispatched.filter((d) => d.kind === 'school').length, 1);
});

test('lake: scenes advance automatically every 12 minutes and loop through 4', () => {
  const { state, clock } = makeLake();
  assert.deepEqual(state.snapshotData().scene, { index: 0, id: 'sunrise', startedAt: 1000000 });
  clock.advance(720000);
  state.tick();
  assert.equal(state.snapshotData().scene.id, 'noon');
  assert.equal(state.snapshotData().scene.index, 1);
  for (const id of ['sunset', 'starry', 'sunrise']) {
    clock.advance(720000);
    state.tick();
    assert.equal(state.snapshotData().scene.id, id);
  }
});

test('lake: scene hotkey override advances immediately', () => {
  const { state, clock } = makeLake();
  assert.equal(state.advanceScene(), true);
  assert.equal(state.snapshotData().scene.id, 'noon');
  assert.equal(state.snapshotData().scene.startedAt, 1000000);
  clock.advance(1000);
  assert.equal(state.advanceScene(), true);
  assert.equal(state.snapshotData().scene.id, 'sunset');
});

test('lake: scene clock restarts at sunrise when the theme switches to the lake', () => {
  const { state, clock } = makeLake('balloon-sky');
  assert.equal(state.isLake3D(), false);
  clock.advance(5000);
  assert.equal(state.setTheme('sunrise-lake'), true);
  assert.equal(state.isLake3D(), true);
  assert.deepEqual(state.snapshotData().scene, { index: 0, id: 'sunrise', startedAt: 1005000 });
});

test('lake: bait vote cycles per voter, majority wins, tie keeps the current option', () => {
  const { state, clock } = makeLake();
  // Round 1 (all spotless voters): Ava and Ben vote corn (two !bait
  // each: worm, then corn), Cleo votes worm once.
  doCommand(state, clock, 'u1', 'Ava', '!bait');
  clock.advance(11000);
  doCommand(state, clock, 'u1', 'Ava', '!bait');
  doCommand(state, clock, 'u2', 'Ben', '!bait');
  clock.advance(11000);
  doCommand(state, clock, 'u2', 'Ben', '!bait');
  doCommand(state, clock, 'u3', 'Cleo', '!bait');
  assert.equal(state.snapshotData().baitVote.option, 'worm');
  assert.equal(state.snapshotData().baitVote.round, 0);
  clock.advance(90000);
  drain(state, clock, 2);
  assert.deepEqual(state.snapshotData().baitVote, { round: 1, option: 'corn' });
  // Round 2: a 1–1 tie keeps corn.
  doCommand(state, clock, 'u1', 'Ava', '!bait'); // worm
  doCommand(state, clock, 'u2', 'Ben', '!bait'); // worm
  clock.advance(11000);
  doCommand(state, clock, 'u2', 'Ben', '!bait'); // corn
  clock.advance(90000);
  drain(state, clock, 2);
  assert.deepEqual(state.snapshotData().baitVote, { round: 2, option: 'corn' });
  // The snapshot carries no names and no counts.
  const json = JSON.stringify(state.snapshotData().baitVote);
  assert.ok(!json.includes('Ava') && !json.includes('Ben'));
});

test('lake: bait votes do not survive a restart, but the winning option does', () => {
  const { state, clock } = makeLake();
  doCommand(state, clock, 'u1', 'Ava', '!bait');
  clock.advance(11000);
  doCommand(state, clock, 'u1', 'Ava', '!bait');
  doCommand(state, clock, 'u2', 'Ben', '!bait');
  clock.advance(11000);
  doCommand(state, clock, 'u2', 'Ben', '!bait');
  clock.advance(90000);
  drain(state, clock, 2);
  assert.equal(state.snapshotData().baitVote.option, 'corn');
  const saved = state.persistData();
  const restored = makeLake('sunrise-lake', clock).state;
  restored.restore(saved);
  assert.deepEqual(restored.snapshotData().baitVote, { round: 1, option: 'corn' });
  assert.equal(restored.baitRound.votes.size, 0);
});

test('lake: thank-you ticker scrolls every 20s, max 3 names per pass, arrival order', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  follow(state, 'u2', 'Liam');
  follow(state, 'u3', 'Noah');
  follow(state, 'u4', 'Zoe');
  clock.advance(20000);
  let dispatched = drain(state, clock, 6);
  assert.deepEqual(
    dispatched.filter((d) => d.kind === 'ticker').map((d) => d.names),
    [['Maya', 'Liam', 'Noah']],
  );
  clock.advance(20000);
  dispatched = drain(state, clock, 3);
  assert.deepEqual(
    dispatched.filter((d) => d.kind === 'ticker').map((d) => d.names),
    [['Zoe']],
  );
  clock.advance(20000);
  dispatched = drain(state, clock, 3);
  assert.equal(dispatched.filter((d) => d.kind === 'ticker').length, 0);
});

test('lake: hidden ticker entries are skipped and consumed, never shown', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  follow(state, 'u2', 'Liam');
  follow(state, 'u3', 'Noah');
  follow(state, 'u4', 'Zoe');
  assert.equal(command(state, 'u2', 'Liam', '!hide').hidden, true);
  clock.advance(20000);
  const dispatched = drain(state, clock, 6);
  assert.deepEqual(
    dispatched.filter((d) => d.kind === 'ticker').map((d) => d.names),
    [['Maya', 'Noah', 'Zoe']],
  );
  clock.advance(20000);
  const more = drain(state, clock, 3);
  assert.equal(more.filter((d) => d.kind === 'ticker').length, 0);
});

test('lake: overflow followers join the ticker too', () => {
  const { state, clock } = makeLake();
  for (let i = 0; i < 16; i += 1) follow(state, `u${i}`, `Viewer${i}`);
  follow(state, 'u16', 'Late');
  // Drain every ticker pass (20s apart) and collect all names shown.
  const shown = [];
  for (let pass = 0; pass < 8; pass += 1) {
    clock.advance(20000);
    const dispatched = drain(state, clock, 8);
    for (const d of dispatched.filter((d) => d.kind === 'ticker')) shown.push(...d.names);
  }
  assert.equal(shown.length, 17);
  assert.ok(shown.includes('Late'));
  assert.equal(new Set(shown).size, 17);
});

test('lake: ticker entries and cursor survive a restart', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  follow(state, 'u2', 'Liam');
  follow(state, 'u3', 'Noah');
  follow(state, 'u4', 'Zoe');
  follow(state, 'u5', 'Ana');
  clock.advance(20000);
  let dispatched = drain(state, clock, 6);
  assert.deepEqual(dispatched.filter((d) => d.kind === 'ticker').map((d) => d.names), [['Maya', 'Liam', 'Noah']]);
  const saved = state.persistData();
  assert.equal(saved.tickerCursor, 3);
  assert.equal(JSON.stringify(saved).includes('u1'), false);
  const restored = makeLake('sunrise-lake', clock).state;
  restored.restore(saved);
  clock.advance(20000);
  dispatched = drain(restored, clock, 3);
  assert.deepEqual(dispatched.filter((d) => d.kind === 'ticker').map((d) => d.names), [['Zoe', 'Ana']]);
});

test('lake: viewers without a spot can still cast, vote, and wave', () => {
  const { state, clock } = makeLake();
  // No follows at all: all three commands are accepted with slot -1.
  assert.equal(command(state, 'u1', 'Ava', '!cast').applied, true);
  drain(state, clock, 2);
  clock.advance(9000);
  assert.equal(command(state, 'u1', 'Ava', '!wave').applied, true);
  drain(state, clock, 2);
  assert.equal(command(state, 'u2', 'Ben', '!bait').applied, true);
  drain(state, clock, 2);
  // Ava cast counted toward the group event; Ben bait voted.
  assert.equal(state.groupCast.userIds.has('u1'), true);
  assert.equal(state.baitRound.votes.get('u2'), 'worm');
  // Their follow still gets the overflow toast plus a ticker entry when
  // the seats are full — nobody is fully left out.
  for (let i = 0; i < 16; i += 1) follow(state, `s${i}`, `Viewer${i}`);
  const overflow = state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Ava' }));
  assert.equal(overflow.reason, 'overflow-toast');
  assert.ok(state.tickerEntries.some((e) => e.name === 'Ava'));
});

test('lake: follow and likes grant no personal advantage and no visual state', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  assert.deepEqual(state.snapshotData().spots[0].visualStates, []);
  like(state, 'u1', 500);
  like(state, 'u2', 500);
  assert.deepEqual(state.snapshotData().spots[0].visualStates, []);
  // Likes go only to the shared meter: the snapshot has no per-person
  // like totals, no ranks, and no leaderboard anywhere.
  const json = JSON.stringify(state.snapshotData());
  assert.ok(!json.includes('u1') && !json.includes('u2'));
  assert.ok(!/leaderboard|rank/i.test(json));
  assert.deepEqual(Object.keys(state.snapshotData().meter.cycle).sort(), ['hit', 'milestones', 'resting', 'total']);
});

test('lake: no gift speeds anything up or jumps any queue', () => {
  const { state } = makeLake();
  follow(state, 'u1', 'Maya');
  const before = state.queue.items.length;
  gift(state, 'u1', 'Maya', 'Rose');
  // A gift adds exactly one gift animation and one decoration; it does
  // not touch cooldowns, pending, or the ticker.
  assert.equal(state.queue.items.length, before + 1);
  assert.equal(state.queue.items.at(-1).kind, 'gift');
  assert.deepEqual(state.snapshotData().spots[0].decorations, ['blossom']);
  assert.equal(state.pending.size, 0);
  assert.equal(state.commandCooldowns.size, 0);
});

test('lake: hidden spot restores HIDDEN immediately, with no further action', () => {
  const { state } = makeLake();
  follow(state, 'u1', 'Maya');
  command(state, 'u1', 'Maya', '!hide');
  const saved = state.persistData();
  const restored = makeLake().state;
  restored.restore(saved);
  const spot = restored.snapshotData().spots[0];
  assert.equal(spot.hidden, true);
  assert.equal(spot.displayName, '');
});

test('lake: RESIDUAL SAME-NAME RISK — after restart, a different viewer with the same name inherits the hidden spot', () => {
  // Documented behaviour, not a bug fix: user ids are never stored on
  // disk, so a restored spot can only rebind by filtered display name.
  // A hides, the server restarts, then B (same display name, different
  // viewer) sends a command: B binds to A restored spot by name match,
  // inherits hidden=true (hiddenUsers gains B), B command applies to
  // that spot, and B next !hide UNHIDES the spot. The docs worker copies
  // this into the README.
  const { state } = makeLake();
  follow(state, 'u1', 'Maya');
  assert.equal(command(state, 'u1', 'Maya', '!hide').hidden, true);
  const saved = state.persistData();
  const restored = makeLake().state;
  restored.restore(saved);
  assert.equal(restored.snapshotData().spots[0].displayName, '');
  const res = restored.ingest(fresh({ type: 'comment', userId: 'u2', displayName: 'Maya', text: '!cast' }));
  assert.equal(res.applied, true);
  assert.equal(restored.spots.get('u2').hidden, true);
  assert.equal(restored.hiddenUsers.has('u2'), true);
  assert.equal(restored.snapshotData().spots[0].hidden, true);
  assert.equal(restored.snapshotData().spots[0].displayName, '');
  const show = restored.ingest(fresh({ type: 'comment', userId: 'u2', displayName: 'Maya', text: '!hide' }));
  assert.equal(show.hidden, false);
  assert.equal(restored.snapshotData().spots[0].hidden, false);
  assert.equal(restored.snapshotData().spots[0].displayName, 'Maya');
});

test('lake: persist/restore roundtrips cycle, scene, bait option, ticker, and visual states', () => {
  const { state, clock } = makeLake();
  follow(state, 'u1', 'Maya');
  follow(state, 'u2', 'Liam');
  follow(state, 'u3', 'Zoe');
  doCommand(state, clock, 'u1', 'Maya', '!cast');
  like(state, 'u9', 60);
  clock.advance(20000);
  drain(state, clock, 6); // ticker emits the first batch
  const saved = state.persistData(1234567);
  const restored = makeLake('sunrise-lake', clock).state;
  restored.restore(saved);
  assert.equal(restored.cycleTotal, 60);
  assert.deepEqual([...restored.cycleHit], [50]);
  assert.equal(restored.sceneIndex, 0);
  assert.deepEqual(restored.snapshotData().spots.map((s) => s.visualStates), [['cast'], [], []]);
  assert.equal(restored.tickerCursor, 3);
  assert.deepEqual(restored.tickerEntries.map((e) => e.name), ['Maya', 'Liam', 'Zoe']);
  assert.deepEqual(restored.snapshotData().baitVote, { round: 0, option: 'worm' });
  // Malformed lake fields are dropped or clamped, never trusted blindly.
  const broken = makeLake('sunrise-lake', clock).state;
  broken.restore({
    version: 1, savedAt: 999000, theme: 'sunrise-lake', meterTotal: 0,
    cycleTotal: -5, cycleHit: [50, 9999, 'x'], restingUntil: 'soon',
    restBank: -3, sceneIndex: 9, sceneStartedAt: 'nope',
    baitVote: { round: -1, option: 'nope' },
    ticker: [{ name: 'Maya', hidden: true }, null, { name: 42 }, { name: 'Liam' }],
    tickerCursor: 99, lastLargeLikeEventAt: -10, pendingFinale: 'yes',
    spots: [{ slot: 0, displayName: 'Maya', hidden: false, decorations: ['lantern', 'blossom'], visualStates: ['cast', 'nope', 'cast'] }],
  });
  assert.equal(broken.cycleTotal, 0);
  assert.deepEqual([...broken.cycleHit], [50]);
  assert.equal(broken.restingUntil, 0);
  assert.equal(broken.restBank, 0);
  assert.equal(broken.sceneIndex, 0);
  assert.deepEqual(broken.snapshotData().baitVote, { round: 0, option: 'worm' });
  assert.equal(broken.tickerCursor, 2);
  assert.deepEqual(broken.tickerEntries.map((e) => e.name), ['Maya', 'Liam']);
  assert.equal(broken.pendingFinale, false);
  assert.deepEqual(broken.snapshotData().spots[0].decorations, ['blossom']);
  assert.deepEqual(broken.snapshotData().spots[0].visualStates, ['cast']);
});

test('lake: every event advances automatically — no creator press required', () => {
  const { state, clock } = makeLake();
  // School via group event, scene via schedule, bait rounds via timer,
  // ticker via timer, like cycle via finale + rest — all from tick().
  follow(state, 'u1', 'Maya');
  follow(state, 'u2', 'Liam');
  follow(state, 'u3', 'Noah');
  const dispatched = [];
  dispatched.push(...doCommand(state, clock, 'u1', 'Maya', '!cast'));
  dispatched.push(...doCommand(state, clock, 'u2', 'Liam', '!cast'));
  dispatched.push(...doCommand(state, clock, 'u3', 'Noah', '!cast'));
  dispatched.push(...drain(state, clock, 4));
  assert.equal(dispatched.filter((d) => d.kind === 'school').length, 1);
  // Ticker fires on its own timer.
  clock.advance(20000);
  const ticked = drain(state, clock, 6);
  assert.equal(ticked.filter((d) => d.kind === 'ticker').length, 1);
  // Scene advances on the schedule with no hotkey.
  clock.advance(720000);
  state.tick();
  assert.equal(state.snapshotData().scene.id, 'noon');
});

test('no flag, no lake rules: legacy 48 spots, 10s cooldown, old thresholds', () => {
  const clock = makeClock();
  const legacy = new GameState({ theme: 'sunrise-lake', nowFn: clock.now, streamerName: 'streamer' });
  assert.equal(legacy.isLake3D(), false);
  for (let i = 0; i < 17; i += 1) {
    assert.equal(legacy.ingest(fresh({ type: 'follow', userId: `u${i}`, displayName: `Viewer${i}` })).applied, true);
  }
  assert.equal(legacy.spots.size, 17);
  const snap = legacy.snapshotData();
  assert.equal(snap.meter.cycle, undefined);
  assert.equal(snap.scene, undefined);
  assert.equal(snap.baitVote, undefined);
  assert.equal('visualStates' in snap.spots[0], false);
});

test('lake3D flag with another theme keeps legacy rules', () => {
  const { state } = makeLake('firefly-garden');
  assert.equal(state.isLake3D(), false);
  assert.equal(state.snapshotData().meter.cycle, undefined);
});

// --- Server-level hotkey test (shared 1-per-10s limit, server-side) ---

function wsConnect(port, role) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=${role}`);
    const client = {
      ws,
      queue: [],
      waiters: [],
      send(data) { ws.send(JSON.stringify(data)); },
      close() { ws.close(); },
    };
    ws.on('message', (raw) => {
      let msg;
      try { msg = JSON.parse(String(raw)); } catch { return; }
      const waiter = client.waiters.shift();
      if (waiter) waiter(msg);
      else client.queue.push(msg);
    });
    ws.once('open', () => resolve(client));
    ws.once('error', reject);
  });
}

function nextMessage(client, timeoutMs = 3000) {
  if (client.queue.length > 0) return Promise.resolve(client.queue.shift());
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timed out waiting for message')), timeoutMs);
    client.waiters.push((msg) => { clearTimeout(timer); resolve(msg); });
  });
}

async function waitFor(client, predicate, timeoutMs = 5000) {
  const started = Date.now();
  for (;;) {
    const remaining = timeoutMs - (Date.now() - started);
    if (remaining <= 0) throw new Error('timed out waiting for matching message');
    const msg = await nextMessage(client, remaining);
    if (predicate(msg)) return msg;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

test('server: hotkey school fires, second press inside 10s is ignored, later press works', async (t) => {
  const clock = makeClock();
  const gameState = new GameState({ theme: 'sunrise-lake', lake3D: true, nowFn: clock.now });
  const simulator = new SimulatorAdapter();
  const manual = new ManualAdapter();
  simulator.onEvent((e) => gameState.ingest(e));
  manual.onEvent((e) => gameState.ingest(e));
  const server = createGameServer({
    gameState,
    adapters: { live: null, simulator, manual },
    publicDir: path.join(ROOT, 'public'),
    srcDir: path.join(ROOT, 'src'),
    port: 0,
    nowFn: clock.now,
    persist: { clear: async () => {} },
  });
  gameState.onChange = () => server.broadcastSnapshotSoon();
  const address = await server.listen();
  t.after(async () => { await server.close(); });

  const overlay = await wsConnect(address.port, 'overlay');
  t.after(() => overlay.close());
  await waitFor(overlay, (m) => m.type === 'snapshot');
  const control = await wsConnect(address.port, 'control');
  t.after(() => control.close());
  await nextMessage(control);

  control.send({ action: 'hotkey', kind: 'school' });
  await waitFor(overlay, (m) => m.type === 'animation' && m.animation.kind === 'school');
  // Inside the 10s window: ignored, no second school animation arrives.
  clock.advance(5000);
  control.send({ action: 'hotkey', kind: 'school' });
  await sleep(1500);
  assert.equal(
    overlay.queue.filter((m) => m.type === 'animation' && m.animation.kind === 'school').length,
    0,
  );
  // After the window: the scene hotkey works again.
  clock.advance(6000);
  control.send({ action: 'hotkey', kind: 'scene' });
  const moved = await waitFor(control, (m) => m.type === 'status' && m.state.scene && m.state.scene.index === 1);
  assert.equal(moved.state.scene.id, 'noon');
  // And mute toggles after its own window.
  clock.advance(11000);
  control.send({ action: 'hotkey', kind: 'mute' });
  const muted = await waitFor(control, (m) => m.type === 'status' && m.audio && m.audio.muted === true);
  assert.equal(muted.audio.muted, true);
  // Unknown hotkey kinds are ignored without crashing.
  control.send({ action: 'hotkey', kind: 'nope' });
  await sleep(200);
  assert.equal(gameState.sceneIndex, 1);
});
