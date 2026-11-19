import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSnapshot, saveSnapshot, clearSnapshot } from '../src/snapshot.js';
import { GameState } from '../src/gameState.js';
import { normalizeEvent } from '../src/events.js';

const TTL = 24 * 60 * 60 * 1000;

async function tmpFile(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'games-snap-'));
  t.after(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  return path.join(dir, 'session-snapshot.json');
}

test('save/load roundtrip keeps only the documented fields', async (t) => {
  const file = await tmpFile(t);
  await saveSnapshot(file, {
    version: 1, savedAt: 1000, theme: 'balloon-sky', meterTotal: 42,
    thresholdsHit: [100],
    spots: [{ slot: 0, displayName: 'Maya', hidden: false, decorations: ['cloud'] }],
  });
  const { snapshot, reason } = await loadSnapshot(file, TTL, 2000);
  assert.equal(reason, 'ok');
  assert.equal(snapshot.theme, 'balloon-sky');
  assert.equal(snapshot.meterTotal, 42);
  assert.deepEqual(snapshot.spots[0], { slot: 0, displayName: 'Maya', hidden: false, decorations: ['cloud'] });
  const raw = await fs.readFile(file, 'utf8');
  assert.ok(!raw.includes('userId'));
});

test('expired snapshots are ignored', async (t) => {
  const file = await tmpFile(t);
  await saveSnapshot(file, { version: 1, savedAt: 1000, theme: 'sunrise-lake', meterTotal: 0, thresholdsHit: [], spots: [] });
  const { snapshot, reason } = await loadSnapshot(file, TTL, 1000 + TTL + 1);
  assert.equal(snapshot, null);
  assert.equal(reason, 'expired');
});

test('corrupt and invalid snapshots are ignored', async (t) => {
  const file = await tmpFile(t);
  await fs.writeFile(file, '{not json');
  assert.equal((await loadSnapshot(file, TTL)).reason, 'corrupt');
  await fs.writeFile(file, JSON.stringify({ version: 99, spots: [] }));
  assert.equal((await loadSnapshot(file, TTL)).reason, 'invalid');
  await fs.writeFile(file, JSON.stringify({ version: 1, spots: 'nope' }));
  assert.equal((await loadSnapshot(file, TTL)).reason, 'invalid');
});

test('missing snapshot reports missing; clear removes the file', async (t) => {
  const file = await tmpFile(t);
  assert.equal((await loadSnapshot(file, TTL)).reason, 'missing');
  await saveSnapshot(file, { version: 1, savedAt: 1000, theme: 'sunrise-lake', meterTotal: 0, thresholdsHit: [], spots: [] });
  assert.equal(await clearSnapshot(file), true);
  assert.equal((await loadSnapshot(file, TTL)).reason, 'missing');
  assert.equal(await clearSnapshot(file), true); // clearing twice is fine
});

test('lake file roundtrip keeps cycle, scene, vote, ticker and visual states', async (t) => {
  // Regression test for the snapshot whitelist gap: loadSnapshot used to
  // drop every lake-mode field, so a real file-based restart silently
  // lost the cycle, scene, vote, ticker and looks (GameState-level
  // persistData -> restore worked, the file roundtrip did not).
  const file = await tmpFile(t);
  let now = 1_000_000;
  const clock = { now: () => now, advance: (ms) => { now += ms; } };
  let seq = 0;
  const fresh = (partial) => normalizeEvent(
    { msgId: `lake-snap-${seq += 1}`, timestamp: now, ...partial }, 'simulator',
  );
  const drain = (gs) => { for (let i = 0; i < 5; i += 1) { clock.advance(700); gs.tick(); } };
  const gs = new GameState({ lake3D: true, nowFn: clock.now });
  assert.equal(gs.ingest(fresh({ type: 'follow', userId: 'u1', displayName: 'Maya' })).applied, true);
  assert.equal(gs.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!cast' })).applied, true);
  drain(gs);
  assert.equal(gs.ingest(fresh({ type: 'like', userId: 'u1', displayName: 'Maya', likeCount: 60, likeTotal: 60 })).applied, true);
  assert.equal(gs.ingest(fresh({ type: 'comment', userId: 'u1', displayName: 'Maya', text: '!bait' })).applied, true);
  drain(gs);
  assert.equal(gs.ingest(fresh({ type: 'follow', userId: 'u2', displayName: 'Noor' })).applied, true);
  assert.equal(gs.ingest(fresh({ type: 'comment', userId: 'u2', displayName: 'Noor', text: '!hide' })).applied, true);
  clock.advance(20000);
  gs.tick(); // thank-you ticker fires: Maya shown, Noor skipped (hidden)
  const data = gs.persistData(now);
  await saveSnapshot(file, data);
  const raw = await fs.readFile(file, 'utf8');
  assert.ok(!raw.includes('userId'), 'snapshot file must never contain user ids');

  const { snapshot, reason } = await loadSnapshot(file, TTL, now);
  assert.equal(reason, 'ok');
  const gs2 = new GameState({ lake3D: true, nowFn: clock.now });
  gs2.restore(snapshot);
  assert.equal(gs2.spots.size, 2);
  const maya = [...gs2.spots.values()].find((s) => s.slot === 0);
  assert.equal(maya.baseName, 'Maya');
  assert.deepEqual(maya.visualStates, ['cast', 'bait']);
  const noor = [...gs2.spots.values()].find((s) => s.slot === 1);
  assert.equal(noor.hidden, true);
  // Hidden restores HIDDEN immediately on snapshot load: no further
  // action is needed before the name is withheld from the overlay.
  assert.equal(gs2.snapshotData().spots.find((s) => s.slot === 1).displayName, '');
  assert.equal(gs2.cycleTotal, 60);
  assert.ok(gs2.cycleHit.has(50));
  assert.equal(gs2.sceneIndex, 0);
  assert.equal(gs2.sceneStartedAt, 1_000_000);
  assert.equal(gs2.baitRound.option, 'worm');
  assert.deepEqual(gs2.tickerEntries.map((e) => e.name), ['Maya', 'Noor']);
  assert.equal(gs2.tickerEntries[1].hidden, true);
  assert.equal(gs2.tickerCursor, 2);
});
