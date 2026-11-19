import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { GameState } from '../src/gameState.js';
import { createGameServer } from '../src/server.js';
import { SimulatorAdapter } from '../src/adapters/simulatorAdapter.js';
import { ManualAdapter } from '../src/adapters/manualAdapter.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function startServer(t) {
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
    port: 0,
    persist: { clear: async () => {} },
  });
  gameState.onChange = () => server.broadcastSnapshotSoon();
  const address = await server.listen();
  const base = `http://127.0.0.1:${address.port}`;
  t.after(async () => { await server.close(); });
  return { gameState, simulator, manual, server, base, port: address.port };
}

// Buffering WS client: messages are queued from the moment the socket
// opens, so the server's immediate snapshot cannot be missed by a race.
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

test('HTTP: overlay, control panel, modules, and health serve; unknown paths 404', async (t) => {
  const { base } = await startServer(t);
  const root = await fetch(`${base}/`, { redirect: 'manual' });
  assert.equal(root.status, 302);
  const overlay = await fetch(`${base}/overlay`);
  assert.equal(overlay.status, 200);
  const overlayHtml = await overlay.text();
  assert.ok(overlayHtml.includes('<canvas id="scene"'));
  assert.ok(overlayHtml.includes('width="1080" height="1920"'));
  const render = await fetch(`${base}/render.js`);
  assert.equal(render.status, 200);
  assert.ok((await render.text()).includes('renderScene'));
  const render3d = await fetch(`${base}/render3d.js`);
  assert.equal(render3d.status, 200);
  assert.ok((await render3d.text()).includes('createLakeRenderer'));
  const threeModule = await fetch(`${base}/vendor/three.module.js`);
  assert.equal(threeModule.status, 200);
  assert.ok((await threeModule.text()).includes('three.core.js'));
  const threeCore = await fetch(`${base}/vendor/three.core.js`);
  assert.equal(threeCore.status, 200);
  assert.ok((await threeCore.text()).includes('REVISION'));
  const lakeConfig = await fetch(`${base}/lake3d-config.js`);
  assert.equal(lakeConfig.status, 200);
  assert.ok((await lakeConfig.text()).includes('LAKE_3D'));
  const vendorOther = await fetch(`${base}/vendor/three.cjs`);
  assert.equal(vendorOther.status, 404); // allowlist: only the two vendored files serve
  const themes = await fetch(`${base}/themes.js`);
  assert.equal(themes.status, 200);
  assert.ok((await themes.text()).includes('balloon-sky'));
  const control = await fetch(`${base}/control`);
  assert.equal(control.status, 200);
  assert.ok((await control.text()).includes('Control Panel'));
  const health = await fetch(`${base}/healthz`);
  assert.equal(health.status, 200);
  const healthJson = await health.json();
  assert.equal(healthJson.ok, true);
  assert.equal(healthJson.theme, 'sunrise-lake');
  assert.ok(!JSON.stringify(healthJson).includes('userId'));
  const missing = await fetch(`${base}/../package.json`);
  assert.equal(missing.status, 404);
  const traversal = await fetch(`${base}/%2e%2e/src/index.js`);
  assert.ok([404, 400].includes(traversal.status));
});

test('WS: overlay receives a snapshot on connect and after reconnect', async (t) => {
  const { simulator, port } = await startServer(t);
  simulator.follow('Maya');
  const ws1 = await wsConnect(port, 'overlay');
  t.after(() => ws1.close());
  const first = await waitFor(ws1, (m) => m.type === 'snapshot');
  assert.equal(first.state.spots.length, 1);
  assert.equal(first.state.spots[0].displayName, 'Maya');
  ws1.close();
  await new Promise((r) => setTimeout(r, 50));
  // Reconnect: the server resends the full snapshot (state survives refresh).
  const ws2 = await wsConnect(port, 'overlay');
  t.after(() => ws2.close());
  const second = await waitFor(ws2, (m) => m.type === 'snapshot');
  assert.equal(second.state.spots.length, 1);
  assert.equal(second.state.spots[0].displayName, 'Maya');
});

test('WS: control actions switch themes, kill intake, resume, and reset', async (t) => {
  const { gameState, port } = await startServer(t);
  const control = await wsConnect(port, 'control');
  t.after(() => control.close());
  const hello = await nextMessage(control);
  assert.equal(hello.type, 'status');

  control.send({ action: 'setTheme', theme: 'balloon-sky' });
  const themed = await waitFor(control, (m) => m.type === 'status' && m.state.theme === 'balloon-sky');
  assert.equal(themed.state.theme, 'balloon-sky');
  assert.equal(gameState.themeId, 'balloon-sky');

  control.send({ action: 'sim', kind: 'follow', name: 'Maya' });
  const spotted = await waitFor(control, (m) => m.type === 'status' && m.state.spotCount === 1);
  assert.equal(spotted.state.spotCount, 1);

  control.send({ action: 'kill' });
  const killed = await waitFor(control, (m) => m.type === 'status' && m.state.status.killed === true);
  assert.equal(killed.state.status.killed, true);
  control.send({ action: 'sim', kind: 'follow', name: 'Liam' });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(gameState.spots.size, 1); // intake stopped: Liam never lands

  control.send({ action: 'resume' });
  await waitFor(control, (m) => m.type === 'status' && m.state.status.killed === false);
  control.send({ action: 'sim', kind: 'follow', name: 'Liam' });
  await waitFor(control, (m) => m.type === 'status' && m.state.spotCount === 2);

  control.send({ action: 'reset' });
  const reset = await waitFor(control, (m) => m.type === 'status' && m.state.spotCount === 0);
  assert.equal(reset.state.meter.total, 0);
});

test('WS: overlay receives dispatched animations for follow events', async (t) => {
  const { simulator, port } = await startServer(t);
  const ws1 = await wsConnect(port, 'overlay');
  t.after(() => ws1.close());
  await waitFor(ws1, (m) => m.type === 'snapshot');
  simulator.follow('Maya');
  const animation = await waitFor(ws1, (m) => m.type === 'animation' && m.animation.kind === 'follow', 5000);
  assert.equal(animation.animation.displayName, 'Maya');
  assert.equal(animation.animation.slot, 0);
});

test('WS: overlay ?theme= request switches the shared theme', async (t) => {
  const { gameState, port } = await startServer(t);
  const ws1 = await wsConnect(port, 'overlay');
  t.after(() => ws1.close());
  await waitFor(ws1, (m) => m.type === 'snapshot');
  ws1.send({ action: 'setTheme', theme: 'cozy-corner-cafe' });
  await new Promise((r) => setTimeout(r, 300));
  assert.equal(gameState.themeId, 'cozy-corner-cafe');
});
