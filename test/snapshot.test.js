import test from 'node:test';
import assert from 'node:assert/strict';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadSnapshot, saveSnapshot, clearSnapshot } from '../src/snapshot.js';

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
