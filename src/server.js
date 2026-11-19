// Local HTTP + WebSocket server. Binds 127.0.0.1 only, serves an allowlist
// of static files (overlay, control panel, shared theme/render modules),
// and broadcasts game snapshots and animations to overlay clients.
//
// No request logging of payloads: logs carry counts and status only, never
// names, user ids, or comment text. The control panel has no auth because
// the server never listens on a public interface; do not proxy it.

import http from 'node:http';
import { promises as fs } from 'node:fs';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { HOST, METER_BROADCAST_MIN_INTERVAL_MS } from './config.js';
import { isValidTheme, THEME_IDS } from './themes.js';
import { AUDIO_DEFAULTS, normalizeAudioSettings } from './audio.js';

const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
};

function clampText(value, max) {
  return String(value ?? '').slice(0, max);
}

export function createGameServer(options) {
  const {
    gameState, adapters, publicDir, srcDir, port, host = HOST,
    persist, nowFn = () => Date.now(), audioDir = null,
  } = options;

  let mode = options.mode || 'simulator';
  let lastMeterBroadcast = 0;
  let snapshotTimer = null;
  let tickTimer = null;
  const overlays = new Set();
  const controls = new Set();

  // Audio: the manifest is the allowlist for /audio/* routes. When the
  // audio directory or manifest is absent (e.g. a GitHub clone before
  // scripts/fetch-audio.sh runs), the game runs silent and the control
  // panel says so — nothing else changes.
  let audioManifest = null;
  if (audioDir) {
    try {
      const parsed = JSON.parse(readFileSync(path.join(audioDir, 'MANIFEST.json'), 'utf8'));
      if (parsed && typeof parsed === 'object' && parsed.files && typeof parsed.files === 'object') {
        audioManifest = parsed;
      }
    } catch {
      audioManifest = null;
    }
  }
  const audioAvailable = audioManifest !== null;
  let audioSettings = { ...AUDIO_DEFAULTS };

  function audioEnvelope() {
    return { audio: { ...audioSettings }, audioAvailable };
  }

  function snapshotMessage() {
    return JSON.stringify({ type: 'snapshot', state: gameState.snapshotData(), ...audioEnvelope() });
  }

  function broadcastTo(clients, message) {
    for (const ws of clients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(message);
    }
  }

  function broadcastSnapshotSoon() {
    if (snapshotTimer) return;
    snapshotTimer = setTimeout(() => {
      snapshotTimer = null;
      const msg = snapshotMessage();
      broadcastTo(overlays, msg);
      broadcastTo(controls, JSON.stringify({ type: 'status', state: gameState.snapshotData(), mode, ...audioEnvelope() }));
    }, 120);
  }

  function broadcastAnimation(animation) {
    const msg = JSON.stringify({ type: 'animation', animation });
    broadcastTo(overlays, msg);
  }

  function tick() {
    const dispatched = gameState.tick();
    for (const item of dispatched) broadcastAnimation(item);
    // Meter-only freshness: overlays poll the snapshot on animation frames,
    // but a quiet meter still needs periodic updates while likes flow.
    const now = nowFn();
    if (now - lastMeterBroadcast >= METER_BROADCAST_MIN_INTERVAL_MS) {
      lastMeterBroadcast = now;
      broadcastSnapshotSoon();
    }
  }

  async function setSourceAdapter(nextMode) {
    const source = adapters.live;
    const sim = adapters.simulator;
    if (source && source.status === 'running') await source.stop();
    if (sim) sim.setAutoDemo(false);
    if (nextMode === 'live' && source) {
      await source.start();
      gameState.setConnection('connecting');
    } else if (nextMode === 'simulator') {
      gameState.setConnection('simulator');
    } else {
      gameState.setConnection('manual');
    }
    mode = nextMode;
  }

  async function setMode(nextMode) {
    if (!['live', 'simulator', 'manual'].includes(nextMode)) return false;
    if (nextMode === 'live' && !adapters.live) return false;
    await setSourceAdapter(nextMode);
    broadcastSnapshotSoon();
    return true;
  }

  async function kill() {
    gameState.kill();
    if (adapters.live && adapters.live.status === 'running') await adapters.live.stop();
    if (adapters.simulator) adapters.simulator.setAutoDemo(false);
    gameState.setConnection('stopped');
    broadcastSnapshotSoon();
  }

  async function resume() {
    gameState.resume();
    await setSourceAdapter(mode);
    broadcastSnapshotSoon();
  }

  function handleControlAction(ws, data) {
    if (!data || typeof data !== 'object') return;
    const action = data.action;
    const name = clampText(data.name, 48) || 'Viewer';
    switch (action) {
      case 'setTheme': {
        if (typeof data.theme === 'string' && isValidTheme(data.theme)) {
          gameState.setTheme(data.theme);
        }
        break;
      }
      case 'setAudio': {
        audioSettings = normalizeAudioSettings(data.settings, audioSettings);
        break;
      }
      case 'setMode': {
        if (typeof data.mode === 'string') void setMode(data.mode);
        break;
      }
      case 'pause': gameState.pause(); break;
      case 'resume': void resume(); break;
      case 'kill': void kill(); break;
      case 'reset': {
        gameState.reset();
        if (persist) void persist.clear();
        break;
      }
      case 'demo': {
        if (adapters.simulator) adapters.simulator.setAutoDemo(data.on === true);
        break;
      }
      case 'sim':
      case 'manual': {
        const adapter = action === 'sim' ? adapters.simulator : adapters.manual;
        if (!adapter) break;
        const kind = data.kind;
        if (kind === 'follow') adapter.follow(name);
        else if (kind === 'comment') adapter.comment(name, clampText(data.text, 128));
        else if (kind === 'likes') {
          const n = Math.floor(Number(data.count));
          if (Number.isFinite(n) && n > 0) adapter.likes(name, Math.min(n, 1000));
        } else if (kind === 'gift') {
          adapter.gift(name, clampText(data.giftName, 64), clampText(data.giftId, 32));
        }
        break;
      }
      default: break;
    }
    broadcastSnapshotSoon();
  }

  const routes = {
    '/control': path.join(publicDir, 'control.html'),
    '/control.js': path.join(publicDir, 'control.js'),
    '/overlay': path.join(publicDir, 'overlay.html'),
    '/overlay.js': path.join(publicDir, 'overlay.js'),
    '/render.js': path.join(publicDir, 'render.js'),
    '/themes.js': path.join(srcDir, 'themes.js'),
    '/audio.js': path.join(srcDir, 'audio.js'),
  };

  // Parse a single Range header (bytes=start-end, bytes=start-, bytes=-suffix).
  // Returns [start, end] inclusive, or null when the header is unusable.
  function parseRange(header, size) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(String(header || '').trim());
    if (!m) return null;
    if (m[1] === '' && m[2] === '') return null;
    if (m[1] === '') {
      const suffix = Number(m[2]);
      if (!Number.isFinite(suffix) || suffix <= 0) return null;
      return [Math.max(0, size - suffix), size - 1];
    }
    const start = Number(m[1]);
    const end = m[2] === '' ? size - 1 : Number(m[2]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) return null;
    return [start, Math.min(end, size - 1)];
  }

  async function serveAudioFile(req, res, name) {
    // Allowlist only: the name must be an exact manifest entry (a bare
    // filename). Anything else — including traversal attempts — 404s.
    if (!audioAvailable || !Object.prototype.hasOwnProperty.call(audioManifest.files, name)) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const body = await fs.readFile(path.join(audioDir, name));
    const type = CONTENT_TYPES[path.extname(name)] || 'application/octet-stream';
    const range = parseRange(req.headers.range, body.length);
    if (range) {
      const [start, end] = range;
      res.writeHead(206, {
        'Content-Type': type,
        'Accept-Ranges': 'bytes',
        'Content-Range': `bytes ${start}-${end}/${body.length}`,
        'Content-Length': end - start + 1,
        'Cache-Control': 'no-cache',
      });
      res.end(body.subarray(start, end + 1));
      return;
    }
    res.writeHead(200, {
      'Content-Type': type,
      'Accept-Ranges': 'bytes',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  }

  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      if (req.method === 'GET' && url.pathname === '/') {
        res.writeHead(302, { Location: '/control' });
        res.end();
        return;
      }
      if (req.method === 'GET' && url.pathname === '/healthz') {
        const state = gameState.snapshotData();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          ok: true, mode, theme: state.theme, status: state.status,
          spotCount: state.spotCount, meterTotal: state.meter.total,
          queueSize: state.queueSize, counters: state.counters,
          themes: THEME_IDS,
          audio: { available: audioAvailable, files: audioAvailable ? Object.keys(audioManifest.files).length : 0 },
        }));
        return;
      }
      if (req.method === 'GET' && url.pathname === '/audio/manifest.json') {
        if (!audioAvailable) {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
        res.end(JSON.stringify(audioManifest));
        return;
      }
      if (req.method === 'GET' && url.pathname.startsWith('/audio/')) {
        let name = '';
        try {
          name = decodeURIComponent(url.pathname.slice('/audio/'.length));
        } catch {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not found');
          return;
        }
        await serveAudioFile(req, res, name);
        return;
      }
      if (req.method === 'GET' && Object.prototype.hasOwnProperty.call(routes, url.pathname)) {
        const file = routes[url.pathname];
        const body = await fs.readFile(file);
        res.writeHead(200, { 'Content-Type': CONTENT_TYPES[path.extname(file)] || 'application/octet-stream' });
        res.end(body);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
    } catch {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Server error');
    }
  });

  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '/', 'http://localhost');
    const role = url.searchParams.get('role') === 'control' ? 'control' : 'overlay';
    if (role === 'control') {
      controls.add(ws);
      ws.send(JSON.stringify({ type: 'status', state: gameState.snapshotData(), mode, ...audioEnvelope() }));
      ws.on('message', (raw) => {
        try {
          handleControlAction(ws, JSON.parse(String(raw)));
        } catch { /* ignore malformed control messages */ }
      });
      ws.on('close', () => controls.delete(ws));
    } else {
      overlays.add(ws);
      // Full snapshot on every (re)connect so a refreshed OBS source
      // repaints the current scene immediately.
      ws.send(snapshotMessage());
      ws.on('message', (raw) => {
        try {
          const data = JSON.parse(String(raw));
          // Overlays may request a theme (from ?theme= in the source URL).
          if (data && data.action === 'setTheme' && typeof data.theme === 'string' && isValidTheme(data.theme)) {
            gameState.setTheme(data.theme);
            broadcastSnapshotSoon();
          }
        } catch { /* ignore */ }
      });
      ws.on('close', () => overlays.delete(ws));
    }
  });

  return {
    httpServer,
    get mode() { return mode; },
    get audioAvailable() { return audioAvailable; },
    get audioSettings() { return { ...audioSettings }; },
    broadcastSnapshotSoon,
    setMode,
    kill,
    resume,
    async listen() {
      await new Promise((resolve) => httpServer.listen(port, host, resolve));
      tickTimer = setInterval(tick, 100);
      return httpServer.address();
    },
    async close() {
      if (tickTimer) clearInterval(tickTimer);
      if (snapshotTimer) clearTimeout(snapshotTimer);
      for (const ws of [...overlays, ...controls]) {
        try { ws.close(); } catch { /* ignore */ }
      }
      wss.close();
      await new Promise((resolve) => httpServer.close(resolve));
    },
  };
}
