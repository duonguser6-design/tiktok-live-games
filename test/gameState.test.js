import test from 'node:test';
import assert from 'node:assert/strict';
import { GameState } from '../src/gameState.js';
import { normalizeEvent } from '../src/events.js';

function makeClock(start = 1_000_000) {
  let now = start;
  return { now: () => now, advance: (ms) => { now += ms; } };
}

function makeState(theme = 'sunrise-lake') {
  const clock = makeClock();
  const state = new GameState({ theme, nowFn: clock.now, streamerName: 'streamer' });
  return { state, clock };
}

function ev(partial, source = 'simulator') {
  return normalizeEvent({
    msgId: `m-${Math.random().toString(36).slice(2)}-${Date.now()}-${Math.random()}`,
    timestamp: 1_000_000, ...partial,
  }, source);
}

let msgSeq = 0;
function fresh(partial, source = 'simulator') {
  msgSeq += 1;
  return normalizeEvent({ msgId: `test-${msgSeq}`, timestamp: 1_000_000, ...partial }, source);
}

test('follow creates one spot; repeat follows do not duplicate', () => {
  const { state } = makeState();
  assert.equal(state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' })).applied, true);
  assert.equal(state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' })).reason, 'duplicate-follow');
  assert.equal(state.spots.size, 1);
  const snap = state.snapshotData();
  assert.equal(snap.spots[0].displayName, 'Maya');
  assert.equal(snap.spots[0].slot, 0);
});

test('duplicate msgIds are ignored after reconnect replays', () => {
  const { state } = makeState();
  const first = fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' });
  const replay = { ...first };
  assert.equal(state.ingest(first).applied, true);
  assert.equal(state.ingest(replay).reason, 'duplicate');
  assert.equal(state.counters.duplicates, 1);
});

test('paused/killed state drops intake', () => {
  const { state } = makeState();
  state.pause();
  assert.equal(state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' })).reason, 'paused');
  state.resume();
  assert.equal(state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' })).applied, true);
  state.kill();
  assert.equal(state.killed, true);
  assert.equal(state.queue.size, 0);
  assert.equal(state.ingest(fresh({ type: 'follow', userId: 'u2', displayName: 'Liam' })).reason, 'paused');
});

test('commands: unknown ignored, cooldown enforced, one pending per person', () => {
  const { state, clock } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  assert.equal(state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: 'hello' })).reason, 'unknown-command');
  assert.equal(state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!dance' })).reason, 'unknown-command');
  assert.equal(state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!cast' })).applied, true);
  // Still pending (queue not yet dispatched) and in cooldown.
  assert.equal(state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!bait' })).reason, 'cooldown');
  clock.advance(11000);
  // Cooldown passed but the first command is still pending in the queue.
  assert.equal(state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!bait' })).reason, 'pending');
  // Dispatch everything (advance time so spacing elapses), then the next
  // command is accepted.
  for (let i = 0; i < 5; i += 1) { clock.advance(700); state.tick(); }
  assert.equal(state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!bait' })).applied, true);
});

test('!hide toggles instantly and is exempt from cooldown', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  const hide = state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!hide' }));
  assert.equal(hide.applied, true);
  assert.equal(hide.hidden, true);
  assert.equal(state.snapshotData().spots[0].displayName, '');
  assert.equal(state.snapshotData().spots[0].hidden, true);
  const show = state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!hide' }));
  assert.equal(show.hidden, false);
  assert.equal(state.snapshotData().spots[0].displayName, 'Maya');
  // !hide before ever following: the later spot starts hidden.
  state.ingest(fresh({ type: 'comment', userId: 'u2', displayName: 'Liam', text: '!hide' }));
  state.ingest(fresh({ type: 'follow', userId: 'u2', displayName: 'Liam' }));
  const liam = state.snapshotData().spots.find((s) => s.slot === 1);
  assert.equal(liam.hidden, true);
});

test('!hide works identically in every theme', () => {
  for (const theme of ['sunrise-lake', 'firefly-garden', 'starlight-observatory', 'cozy-corner-cafe', 'balloon-sky']) {
    const { state } = makeState(theme);
    state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
    const res = state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!hide' }));
    assert.equal(res.applied, true, theme);
    assert.equal(state.snapshotData().spots[0].hidden, true, theme);
  }
});

test('like deltas use totals, never raw accumulation; resets handled', () => {
  const { state } = makeState();
  // First sighting: baseline, only the batch counts.
  assert.equal(state.ingest(fresh({ type: 'like', userId: 'u1', likeCount: 5, likeTotal: 500 })).delta, 5);
  assert.equal(state.meterTotal, 5);
  // Next total: delta only.
  assert.equal(state.ingest(fresh({ type: 'like', userId: 'u1', likeCount: 8, likeTotal: 508 })).delta, 8);
  assert.equal(state.meterTotal, 13);
  // Total reset after idle: batch count is used, total never double-counted.
  assert.equal(state.ingest(fresh({ type: 'like', userId: 'u1', likeCount: 4, likeTotal: 4 })).delta, 4);
  assert.equal(state.meterTotal, 17);
  // No total at all: batch count only, capped.
  assert.equal(state.ingest(fresh({ type: 'like', userId: 'u2', likeCount: 5000 })).delta, 1000);
});

test('meter thresholds fire once each and queue a stage animation', () => {
  const { state, clock } = makeState();
  state.ingest(fresh({ type: 'like', userId: 'u1', likeCount: 120 }));
  assert.deepEqual([...state.thresholdsHit], [100]);
  clock.advance(10000);
  const dispatched = state.tick();
  assert.ok(dispatched.some((d) => d.kind === 'meter-stage' && d.threshold === 100));
  // Crossing more thresholds later fires only the new ones.
  state.ingest(fresh({ type: 'like', userId: 'u1', likeCount: 500 }));
  assert.deepEqual([...state.thresholdsHit].sort((a, b) => a - b), [100, 500]);
});

test('gifts act only on final streak events; unknown gifts use the default', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  assert.equal(state.ingest(fresh({ type: 'gift', userId: 'u1', displayName: 'Maya', giftId: '1', giftName: 'Rose', repeatCount: 1, repeatEnd: false })).reason, 'streak-not-final');
  assert.equal(state.ingest(fresh({ type: 'gift', userId: 'u1', displayName: 'Maya', giftId: '1', giftName: 'Rose', repeatCount: 2, repeatEnd: false })).reason, 'streak-not-final');
  const final = state.ingest(fresh({ type: 'gift', userId: 'u1', displayName: 'Maya', giftId: '1', giftName: 'Rose', repeatCount: 3, repeatEnd: true }));
  assert.equal(final.applied, true);
  assert.equal(final.effect, 'blossom');
  assert.deepEqual(state.snapshotData().spots[0].decorations, ['blossom']);
  const unknown = state.ingest(fresh({ type: 'gift', userId: 'u1', displayName: 'Maya', giftId: '987654', giftName: 'ZqxUnknownGift', repeatCount: 1, repeatEnd: true }));
  assert.equal(unknown.effect, 'lantern'); // sunrise-lake default
});

test('gift mapping is deterministic per theme (same gift, same effect)', () => {
  for (const theme of ['sunrise-lake', 'firefly-garden', 'starlight-observatory', 'cozy-corner-cafe', 'balloon-sky']) {
    const { state } = makeState(theme);
    state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
    const a = state.ingest(fresh({ type: 'gift', userId: 'u1', displayName: 'Maya', giftId: '7', giftName: 'Rose', repeatEnd: true }));
    const b = state.ingest(fresh({ type: 'gift', userId: 'u1', displayName: 'Maya', giftId: '7', giftName: 'Rose', repeatEnd: true }));
    assert.equal(a.effect, b.effect, theme);
  }
});

test('decorations cap at 6 per spot, oldest replaced', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  for (let i = 0; i < 8; i += 1) {
    state.ingest(fresh({ type: 'gift', userId: 'u1', displayName: 'Maya', giftId: `${i}`, giftName: 'Rose', repeatEnd: true }));
  }
  assert.equal(state.snapshotData().spots[0].decorations.length, 6);
});

test('theme switch keeps spots and meter, clears the queue', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  state.ingest(fresh({ type: 'like', userId: 'u1', likeCount: 150 }));
  assert.equal(state.setTheme('bogus-theme'), false);
  assert.equal(state.setTheme('balloon-sky'), true);
  assert.equal(state.themeId, 'balloon-sky');
  assert.equal(state.spots.size, 1);
  assert.equal(state.meterTotal, 150);
  assert.equal(state.queue.size, 0);
  // Theme-specific commands apply after the switch.
  assert.equal(state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!cast' })).reason, 'unknown-command');
  assert.equal(state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!float' })).applied, true);
});

test('snapshot restore rebinds by filtered name on re-follow', () => {
  const { state } = makeState();
  state.restore({
    version: 1, savedAt: 999000, theme: 'firefly-garden', meterTotal: 250,
    thresholdsHit: [100, 500], // 500 hit without 250 total is inconsistent; kept as stored
    spots: [{ slot: 0, displayName: 'Maya', hidden: false, decorations: ['butterfly'] }],
  });
  assert.equal(state.themeId, 'firefly-garden');
  assert.equal(state.meterTotal, 250);
  assert.equal(state.spots.size, 1);
  const res = state.ingest(fresh({ type: 'follow', userId: 'u9', displayName: 'maya' }));
  assert.equal(res.reason, 'rebound');
  assert.equal(state.spots.size, 1);
  assert.deepEqual(state.snapshotData().spots[0].decorations, ['butterfly']);
});

test('snapshot restore rejects unknown themes and clamps/dedupes slots', () => {
  const { state } = makeState();
  state.restore({
    version: 1, savedAt: 999000, theme: 'not-a-theme', meterTotal: 10,
    spots: [
      { slot: 0, displayName: 'Maya', hidden: false, decorations: [] },
      { slot: 0, displayName: 'Duplicate', hidden: false, decorations: [] },
      { slot: 48, displayName: 'Overflow', hidden: false, decorations: [] },
      { slot: -1, displayName: 'Negative', hidden: false, decorations: [] },
      { slot: '3', displayName: 'StringSlot', hidden: false, decorations: [] },
      { slot: 47, displayName: 'Last', hidden: false, decorations: [] },
      null,
    ],
  });
  assert.equal(state.themeId, 'sunrise-lake');
  assert.equal(state.spots.size, 3);
  assert.deepEqual(
    [...state.spots.values()].map((s) => s.slot).sort((a, b) => a - b),
    [0, 3, 47],
  );
  assert.equal(state.spots.get('restored:0').displayName, 'Maya');
});

test('broadcast snapshots never contain user ids or raw text', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'secret-user-123', displayName: 'Maya' }));
  state.ingest(fresh({ type: 'comment', userId: 'secret-user-123', displayName: 'Maya', text: '!cast my secret words' }));
  const json = JSON.stringify(state.snapshotData());
  assert.ok(!json.includes('secret-user-123'));
  assert.ok(!json.includes('secret words'));
  const persisted = JSON.stringify(state.persistData());
  assert.ok(!persisted.includes('secret-user-123'));
});

test('share and join events have no game effect', () => {
  const { state } = makeState();
  assert.equal(state.ingest(fresh({ type: 'share', userId: 'u1', displayName: 'Maya' })).reason, 'no-effect');
  assert.equal(state.ingest(fresh({ type: 'join', userId: 'u1', displayName: 'Maya' })).reason, 'no-effect');
  assert.equal(state.spots.size, 0);
});

test('duplicate display names get stable numeric suffixes', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  state.ingest(fresh({ type: 'follow', userId: 'u2', displayName: 'Maya' }));
  state.ingest(fresh({ type: 'follow', userId: 'u3', displayName: 'maya' }));
  const names = state.snapshotData().spots.map((s) => s.displayName);
  // Case is preserved; matching is case-insensitive, so 'maya' is the
  // third 'Maya' and gets suffix 3.
  assert.deepEqual(names, ['Maya', 'Maya 2', 'maya 3']);
  // The suffix is display-only: identity stays by viewer id.
  assert.equal(state.spots.get('u2').baseName, 'Maya');
  assert.equal(state.spots.get('u3').baseName, 'maya'); // case preserved
});

test('duplicate-name suffixes survive snapshot save/restore', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  state.ingest(fresh({ type: 'follow', userId: 'u2', displayName: 'Maya' }));
  const saved = state.persistData();
  const restored = makeState().state;
  restored.restore(saved);
  assert.deepEqual(
    restored.snapshotData().spots.map((s) => s.displayName),
    ['Maya', 'Maya 2'],
  );
  // Both Mayas return: each re-follow rebinds one restored spot, in slot
  // order, keeping its stored suffix — no new spots are created.
  restored.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  restored.ingest(fresh({ type: 'follow', userId: 'u2', displayName: 'Maya' }));
  assert.equal(restored.spots.size, 2);
  // A third, genuinely new Maya gets the next suffix.
  restored.ingest(fresh({ type: 'follow', userId: 'u3', displayName: 'Maya' }));
  assert.equal(restored.spots.size, 3);
  assert.equal(restored.snapshotData().spots[2].displayName, 'Maya 3');
});

test('!hide targets the right viewer among duplicate names', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  state.ingest(fresh({ type: 'follow', userId: 'u2', displayName: 'Maya' }));
  const res = state.ingest(fresh({ type: 'comment', userId: 'u2', displayName: 'Maya', text: '!hide' }));
  assert.equal(res.applied, true);
  assert.equal(res.hidden, true);
  const spots = state.snapshotData().spots;
  assert.equal(spots[0].hidden, false);
  assert.equal(spots[0].displayName, 'Maya');
  assert.equal(spots[1].hidden, true);
  assert.equal(spots[1].displayName, '');
});

test('!hide survives restart: a command rebinds the restored spot', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  state.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!hide' }));
  assert.equal(state.snapshotData().spots[0].hidden, true);
  const saved = state.persistData();
  const restored = makeState().state;
  restored.restore(saved);
  // No re-follow: a plain command from the same viewer re-attaches the spot.
  const res = restored.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!cast' }));
  assert.equal(res.applied, true);
  assert.equal(restored.spots.size, 1);
  assert.equal(restored.spots.get('u1').hidden, true);
  assert.equal(restored.snapshotData().spots[0].hidden, true);
  assert.equal(restored.snapshotData().spots[0].displayName, '');
  // And !hide after restart unhides the restored spot directly.
  const show = restored.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!hide' }));
  assert.equal(show.hidden, false);
  assert.equal(restored.snapshotData().spots[0].displayName, 'Maya');
});

test('a gift rebinds a restored spot after restart', () => {
  const { state } = makeState();
  state.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' }));
  const saved = state.persistData();
  const restored = makeState().state;
  restored.restore(saved);
  const res = restored.ingest(fresh({ type: 'gift', userId: 'u1', displayName: 'Maya', giftId: '1', giftName: 'Rose', repeatEnd: true }));
  assert.equal(res.applied, true);
  assert.equal(restored.spots.get('u1').decorations.length, 1);
});

test('capacity: beyond 48 spots, follows become thank-you toasts only', () => {
  const { state, clock } = makeState();
  for (let i = 0; i < 48; i += 1) {
    state.ingest(fresh({ type: 'follow', userId: `u${i}`, displayName: `Viewer${i}` }));
  }
  assert.equal(state.spots.size, 48);
  const overflow = state.ingest(fresh({ type: 'follow', userId: 'u48', displayName: 'Late' }));
  assert.equal(overflow.reason, 'overflow-toast');
  assert.equal(state.spots.size, 48);
  const dispatched = [];
  for (let i = 0; i < 60; i += 1) { clock.advance(700); dispatched.push(...state.tick()); }
  const toast = dispatched.find((d) => d.kind === 'toast');
  assert.ok(toast, 'expected an overflow toast');
  assert.equal(toast.text, 'All 48 spots are full — thank you!');
});
