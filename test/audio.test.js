import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import {
  AUDIO_DEFAULTS, normalizeAudioSettings, bgmForTheme, sfxForEvent,
  sfxKindForAnimation, SFX_EVENT_KINDS,
} from '../src/audio.js';
import { THEME_IDS } from '../src/themes.js';
import { GameState } from '../src/gameState.js';
import { createGameServer } from '../src/server.js';
import { SimulatorAdapter } from '../src/adapters/simulatorAdapter.js';
import { ManualAdapter } from '../src/adapters/manualAdapter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const AUDIO_DIR = path.join(ROOT, 'assets', 'audio');

async function loadManifest() {
  return JSON.parse(await fs.readFile(path.join(AUDIO_DIR, 'MANIFEST.json'), 'utf8'));
}

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

test('manifest is valid and every referenced file exists in a supported format', async () => {
  const manifest = await loadManifest();
  assert.equal(manifest.version, 1);
  const names = Object.keys(manifest.files);
  assert.ok(names.length >= 9, `expected at least 9 audio files, got ${names.length}`);
  let total = 0;
  for (const name of names) {
    const entry = manifest.files[name];
    assert.match(name, /^(bgm|sfx)-[a-z-]+\.(mp3|ogg)$/, `unexpected file name ${name}`);
    const stat = await fs.stat(path.join(AUDIO_DIR, name));
    assert.ok(stat.isFile(), `${name} is not a file`);
    assert.equal(stat.size, entry.bytes, `${name} size mismatch with manifest`);
    assert.ok(stat.size > 1000, `${name} suspiciously small`);
    if (name.endsWith('.mp3')) assert.ok(stat.size < 2 * 1024 * 1024, `${name} over 2MB`);
    else assert.ok(stat.size < 200 * 1024, `${name} over 200KB`);
    assert.ok(entry.durationSec > 0, `${name} has no duration`);
    total += stat.size;
  }
  assert.ok(total < 15 * 1024 * 1024, `total audio ${total} bytes exceeds the 15MB budget`);
});

test('manifest checksums match the files on disk', async () => {
  const manifest = await loadManifest();
  for (const [name, entry] of Object.entries(manifest.files)) {
    const buffer = await fs.readFile(path.join(AUDIO_DIR, name));
    assert.equal(sha256(buffer), entry.sha256, `${name} SHA-256 mismatch`);
  }
});

test('manifest durations are sane: loops 30-90s, effects under 2s', async () => {
  const manifest = await loadManifest();
  for (const [name, entry] of Object.entries(manifest.files)) {
    if (entry.kind === 'bgm') {
      assert.ok(entry.durationSec >= 30 && entry.durationSec <= 90, `${name} loop is ${entry.durationSec}s`);
    } else {
      assert.ok(entry.durationSec < 2, `${name} effect is ${entry.durationSec}s`);
    }
  }
});

test('every theme has a background loop and every effect kind is mapped', async () => {
  const manifest = await loadManifest();
  for (const themeId of THEME_IDS) {
    const file = bgmForTheme(manifest, themeId);
    assert.ok(file, `no BGM for ${themeId}`);
    assert.ok(manifest.files[file], `BGM file ${file} missing from manifest`);
    assert.equal(manifest.files[file].kind, 'bgm');
  }
  // Loops are distinct per theme.
  const loops = new Set(THEME_IDS.map((id) => bgmForTheme(manifest, id)));
  assert.equal(loops.size, THEME_IDS.length, 'themes share a loop file');
  for (const kind of SFX_EVENT_KINDS) {
    const file = sfxForEvent(manifest, kind);
    assert.ok(file, `no SFX for ${kind}`);
    assert.ok(manifest.files[file], `SFX file ${file} missing from manifest`);
    assert.equal(manifest.files[file].kind, 'sfx');
  }
});

test('mapping helpers fall back safely on bad input', () => {
  assert.equal(bgmForTheme(null, 'sunrise-lake'), null);
  assert.equal(bgmForTheme({}, 'sunrise-lake'), null);
  assert.equal(bgmForTheme({ bgm: {} }, 'nope'), null);
  assert.equal(sfxForEvent(null, 'follow'), null);
  assert.equal(sfxForEvent({ sfx: {} }, 'follow'), null);
  assert.equal(sfxKindForAnimation('follow'), 'follow');
  assert.equal(sfxKindForAnimation('command'), 'command');
  assert.equal(sfxKindForAnimation('gift'), 'gift');
  assert.equal(sfxKindForAnimation('gift-scene'), 'gift');
  assert.equal(sfxKindForAnimation('meter-stage'), 'milestone');
  assert.equal(sfxKindForAnimation('toast'), null);
  assert.equal(sfxKindForAnimation('unknown-kind'), null);
});

test('audio settings normalize: defaults, clamping, coercion, unknown keys', () => {
  assert.deepEqual(normalizeAudioSettings(undefined), AUDIO_DEFAULTS);
  assert.deepEqual(normalizeAudioSettings(null), AUDIO_DEFAULTS);
  assert.equal(AUDIO_DEFAULTS.bgmVolume, 0.3); // 30%: sits under the voice over multi-hour loops
  assert.equal(AUDIO_DEFAULTS.sfxVolume, 0.7);
  assert.equal(AUDIO_DEFAULTS.muted, false);
  assert.equal(AUDIO_DEFAULTS.reducedMotion, false);
  const clamped = normalizeAudioSettings({ bgmVolume: 9, sfxVolume: -2 });
  assert.equal(clamped.bgmVolume, 1);
  assert.equal(clamped.sfxVolume, 0);
  assert.equal(clamped.muted, false);
  const coerced = normalizeAudioSettings({ muted: 'yes', reducedMotion: 1, bgmVolume: 'loud' });
  assert.equal(coerced.muted, false);
  assert.equal(coerced.reducedMotion, false);
  assert.equal(coerced.bgmVolume, 0.3);
  const partial = normalizeAudioSettings({ muted: true }, { ...AUDIO_DEFAULTS, bgmVolume: 0.25 });
  assert.equal(partial.muted, true);
  assert.equal(partial.bgmVolume, 0.25);
  const unknown = normalizeAudioSettings({ explode: true, bgmVolume: 0.5 });
  assert.deepEqual(Object.keys(unknown).sort(), ['bgmVolume', 'muted', 'reducedMotion', 'sfxVolume']);
  assert.equal(unknown.bgmVolume, 0.5);
});

test('no synthesized audio: no tone-generation code in src, public, or scripts', async () => {
  // The scan deliberately excludes test/ (this file names the tokens).
  const FORBIDDEN = [
    'OscillatorNode', 'createOscillator', 'AudioContext', 'webkitAudioContext',
    'createBuffer', 'createBufferSource', 'PeriodicWave', 'createGain',
    'createBiquadFilter', 'setValueAtTime', 'linearRampToValueAtTime',
  ];
  const hits = [];
  async function scan(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules') continue;
        // Vendored third-party Three.js: it ships WebAudio helper classes
        // (THREE.Audio, AudioListener) that this project never calls —
        // playback here is HTML Audio elements only. The guard below
        // proves our own code never touches them.
        if (entry.name === 'vendor') continue;
        await scan(full);
      } else if (/\.(js|html|sh)$/.test(entry.name)) {
        const text = await fs.readFile(full, 'utf8');
        for (const token of FORBIDDEN) {
          if (text.includes(token)) hits.push(`${path.relative(ROOT, full)}: ${token}`);
        }
      }
    }
  }
  for (const dir of ['src', 'public', 'scripts']) await scan(path.join(ROOT, dir));
  assert.deepEqual(hits, [], `tone-generation code found: ${hits.join(', ')}`);
  // Guard: our own code never uses Three.js WebAudio classes either.
  const threeAudioHits = [];
  async function scanOwn(dir) {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name === 'vendor') continue;
        await scanOwn(full);
      } else if (/\.(js|html)$/.test(entry.name)) {
        const text = await fs.readFile(full, 'utf8');
        for (const token of ['THREE.Audio', 'AudioListener', 'PositionalAudio']) {
          if (text.includes(token)) threeAudioHits.push(`${path.relative(ROOT, full)}: ${token}`);
        }
      }
    }
  }
  for (const dir of ['src', 'public', 'scripts']) await scanOwn(path.join(ROOT, dir));
  assert.deepEqual(threeAudioHits, [], `Three.js WebAudio use found: ${threeAudioHits.join(', ')}`);
  // Playback exists and uses HTML Audio elements only.
  const overlay = await fs.readFile(path.join(ROOT, 'public', 'overlay.js'), 'utf8');
  assert.ok(overlay.includes('new Audio()'), 'overlay does not use HTML Audio elements');
});

test('attribution is complete: every file has license, author, and source', async () => {
  const manifest = await loadManifest();
  const attribution = await fs.readFile(path.join(AUDIO_DIR, 'ATTRIBUTION.md'), 'utf8');
  for (const [name, entry] of Object.entries(manifest.files)) {
    assert.ok(entry.license, `${name} missing license`);
    assert.ok(entry.licenseUrl, `${name} missing license URL`);
    assert.ok(entry.author, `${name} missing author`);
    assert.ok(entry.sourcePage, `${name} missing source page`);
    assert.ok(entry.title, `${name} missing title`);
    assert.ok(attribution.includes(name), `${name} missing from ATTRIBUTION.md`);
    assert.ok(attribution.includes(entry.title.split(' (')[0]), `${entry.title} missing from ATTRIBUTION.md`);
    if (entry.kind === 'bgm') {
      assert.ok(entry.changes, `${name} missing changes note (CC-BY requires it)`);
      assert.ok(entry.downloadUrl, `${name} missing download URL`);
      assert.ok(entry.sourceSha256, `${name} missing source checksum`);
      assert.ok(entry.trim, `${name} missing trim recipe`);
    } else {
      assert.ok(entry.archiveMember, `${name} missing archive member`);
      assert.ok(entry.changes, `${name} missing changes note`);
    }
  }
  assert.ok(attribution.includes('creativecommons.org/licenses/by/3.0'), 'CC-BY 3.0 deed link missing');
  assert.ok(attribution.includes('creativecommons.org/publicdomain/zero/1.0'), 'CC0 deed link missing');
  assert.ok(manifest.kenneyZip && manifest.kenneyZip.sha256, 'Kenney zip checksum missing');
});

// --- Server audio routes, with a small fixture audio directory. ---

async function fixtureAudioDir(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'games-audio-'));
  t.after(async () => { await fs.rm(dir, { recursive: true, force: true }); });
  const loop = Buffer.from('FAKE-MP3-LOOP-DATA-'.repeat(20));
  const effect = Buffer.from('FAKE-OGG-EFFECT');
  await fs.writeFile(path.join(dir, 'bgm-test.mp3'), loop);
  await fs.writeFile(path.join(dir, 'sfx-test.ogg'), effect);
  const manifest = {
    version: 1,
    files: {
      'bgm-test.mp3': { sha256: sha256(loop), bytes: loop.length, durationSec: 65, kind: 'bgm' },
      'sfx-test.ogg': { sha256: sha256(effect), bytes: effect.length, durationSec: 0.3, kind: 'sfx' },
    },
    bgm: { 'sunrise-lake': 'bgm-test.mp3' },
    sfx: { follow: 'sfx-test.ogg' },
  };
  await fs.writeFile(path.join(dir, 'MANIFEST.json'), JSON.stringify(manifest));
  return { dir, loop, effect };
}

async function startAudioServer(t, audioDir) {
  const gameState = new GameState({ theme: 'sunrise-lake' });
  const simulator = new SimulatorAdapter();
  const manual = new ManualAdapter();
  simulator.onEvent((e) => gameState.ingest(e));
  manual.onEvent((e) => gameState.ingest(e));
  const server = createGameServer({
    gameState,
    adapters: { live: null, simulator, manual },
    publicDir: path.join(ROOT, 'public'),
    srcDir: path.join(ROOT, 'src'),
    audioDir,
    port: 0,
    persist: { clear: async () => {} },
  });
  gameState.onChange = () => server.broadcastSnapshotSoon();
  const address = await server.listen();
  t.after(async () => { await server.close(); });
  return { server, base: `http://127.0.0.1:${address.port}`, port: address.port };
}

function wsConnect(port, role) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=${role}`);
    const client = {
      ws, queue: [], waiters: [],
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

test('server serves the audio manifest, files, ranges, and /audio.js', async (t) => {
  const { dir, loop, effect } = await fixtureAudioDir(t);
  const { base } = await startAudioServer(t, dir);
  const manifestRes = await fetch(`${base}/audio/manifest.json`);
  assert.equal(manifestRes.status, 200);
  assert.match(manifestRes.headers.get('content-type'), /application\/json/);
  const manifest = await manifestRes.json();
  assert.equal(manifest.version, 1);

  const mp3 = await fetch(`${base}/audio/bgm-test.mp3`);
  assert.equal(mp3.status, 200);
  assert.equal(mp3.headers.get('content-type'), 'audio/mpeg');
  assert.equal(mp3.headers.get('accept-ranges'), 'bytes');
  assert.deepEqual(Buffer.from(await mp3.arrayBuffer()), loop);

  const ogg = await fetch(`${base}/audio/sfx-test.ogg`);
  assert.equal(ogg.status, 200);
  assert.equal(ogg.headers.get('content-type'), 'audio/ogg');
  assert.deepEqual(Buffer.from(await ogg.arrayBuffer()), effect);

  const ranged = await fetch(`${base}/audio/bgm-test.mp3`, { headers: { Range: 'bytes=0-9' } });
  assert.equal(ranged.status, 206);
  assert.equal(ranged.headers.get('content-range'), `bytes 0-9/${loop.length}`);
  assert.deepEqual(Buffer.from(await ranged.arrayBuffer()), loop.subarray(0, 10));

  const openEnded = await fetch(`${base}/audio/bgm-test.mp3`, { headers: { Range: `bytes=10-` } });
  assert.equal(openEnded.status, 206);
  assert.deepEqual(Buffer.from(await openEnded.arrayBuffer()), loop.subarray(10));

  const audioJs = await fetch(`${base}/audio.js`);
  assert.equal(audioJs.status, 200);
  assert.match(await audioJs.text(), /normalizeAudioSettings/);
});

test('server audio routes reject unknown files and traversal attempts', async (t) => {
  const { dir } = await fixtureAudioDir(t);
  const { base } = await startAudioServer(t, dir);
  assert.equal((await fetch(`${base}/audio/nope.mp3`)).status, 404);
  assert.equal((await fetch(`${base}/audio/MANIFEST.json`)).status, 404);
  assert.equal((await fetch(`${base}/audio/..%2f..%2fserver.js`)).status, 404);
  assert.equal((await fetch(`${base}/audio/%2e%2e%2fpackage.json`)).status, 404);
  assert.equal((await fetch(`${base}/audio/`)).status, 404);
});

test('server without audio reports unavailable and audio routes 404', async (t) => {
  const { base, port } = await startAudioServer(t, null);
  assert.equal((await fetch(`${base}/audio/manifest.json`)).status, 404);
  assert.equal((await fetch(`${base}/audio/bgm-test.mp3`)).status, 404);
  const health = await (await fetch(`${base}/healthz`)).json();
  assert.equal(health.audio.available, false);
  assert.equal(health.audio.files, 0);
  const control = await wsConnect(port, 'control');
  try {
    const first = await nextMessage(control);
    assert.equal(first.type, 'status');
    assert.equal(first.audioAvailable, false);
    assert.deepEqual(first.audio, AUDIO_DEFAULTS);
  } finally {
    control.close();
  }
});

test('setAudio merges validated settings and broadcasts to overlay and control', async (t) => {
  const { dir } = await fixtureAudioDir(t);
  const { port } = await startAudioServer(t, dir);
  const control = await wsConnect(port, 'control');
  const overlay = await wsConnect(port, 'overlay');
  try {
    const first = await nextMessage(control);
    assert.equal(first.audioAvailable, true);
    assert.deepEqual(first.audio, AUDIO_DEFAULTS);
    control.send({ action: 'setAudio', settings: { muted: true, bgmVolume: 9, sfxVolume: 0.25, bogus: 1 } });
    const updated = await waitFor(control, (m) => m.type === 'status' && m.audio.muted === true);
    assert.equal(updated.audio.bgmVolume, 1);
    assert.equal(updated.audio.sfxVolume, 0.25);
    assert.equal(updated.audio.reducedMotion, false);
    assert.equal('bogus' in updated.audio, false);
    const overlayMsg = await waitFor(overlay, (m) => m.type === 'snapshot' && m.audio && m.audio.muted === true);
    assert.equal(overlayMsg.audio.bgmVolume, 1);
    control.send({ action: 'setAudio', settings: { reducedMotion: true, muted: false } });
    const reduced = await waitFor(control, (m) => m.type === 'status' && m.audio.reducedMotion === true);
    assert.equal(reduced.audio.muted, false);
    assert.equal(reduced.audio.bgmVolume, 1, 'unspecified settings are preserved');
  } finally {
    control.close();
    overlay.close();
  }
});

test('fetch script exists, is executable, and only references verified URLs', async () => {
  const scriptPath = path.join(ROOT, 'scripts', 'fetch-audio.sh');
  const stat = await fs.stat(scriptPath);
  assert.ok(stat.mode & 0o100, 'fetch-audio.sh is not executable');
  const text = await fs.readFile(scriptPath, 'utf8');
  assert.ok(text.includes('incompetech.com') || text.includes('MANIFEST.json'), 'script does not use the manifest');
  assert.ok(text.includes('sha256'), 'script does not verify checksums');
  assert.ok(text.includes('kenney.nl/download-link'), 'script does not reproduce the Kenney download flow');
  assert.ok(!text.includes('mixkit'), 'script references a rejected source');
});
