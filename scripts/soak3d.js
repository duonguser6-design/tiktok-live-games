// Kiểm tra tải (soak) mô phỏng cho trình kết xuất 3D Sunrise Lake.
// Chạy máy chủ thật + trạng thái trò chơi (lake3D) + bộ điều hợp mô phỏng +
// một máy khách overlay WebSocket, và lái trình kết xuất 3D bằng một THREE
// giả (stub) + ngữ cảnh WebGL giả — KHÔNG có GPU thật. Đo chi phí khung
// hình phía JavaScript, bộ nhớ, nhịp sự kiện ambient, giới hạn hiệu ứng,
// trạng thái cần thủ. Đây KHÔNG phải phép đo GPU của trình duyệt hay thời
// gian tải khi OBS đang mã hoá.
//
//   SOAK_MINUTES=15 node scripts/soak3d.js   (mặc định là 15)

import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { GameState } from '../src/gameState.js';
import { createGameServer } from '../src/server.js';
import { SimulatorAdapter } from '../src/adapters/simulatorAdapter.js';
import { ManualAdapter } from '../src/adapters/manualAdapter.js';
import { createLakeRenderer } from '../public/render3d.js';
import { LAKE_3D } from '../src/lake3d-config.js';
import { mulberry32 } from '../public/render.js';
import { saveSnapshot } from '../src/snapshot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MINUTES = Math.max(1, Number(process.env.SOAK_MINUTES || 15));
const DURATION_MS = MINUTES * 60 * 1000;

// --- Stub THREE + stub canvas: copied from test/render3d.test.js, which
// documents the minimal THREE surface render3d.js uses. Keep in sync with
// that file if the documented surface changes. ---------------------------
function makeStubTHREE(options = {}) {
  const disposed = { geometries: 0, materials: 0, textures: 0, instanced: 0, renderer: 0 };
  class Geometry {
    constructor() { this.disposed = false; }
    scale() { return this; }
    dispose() { if (!this.disposed) { this.disposed = true; disposed.geometries += 1; } }
  }
  class Material {
    constructor(opts = {}) {
      this.disposed = false;
      this.color = { value: opts.color ?? null, set(v) { this.value = v; } };
      this.transparent = !!opts.transparent;
      this.opacity = opts.opacity ?? 1;
      this.map = opts.map || null;
    }
    dispose() { if (!this.disposed) { this.disposed = true; disposed.materials += 1; } }
  }
  class Color {
    constructor(v) { this.value = v; }
    set(v) { this.value = v; return this; }
  }
  class Vector3 {
    constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
    set(x, y, z) { this.x = x; this.y = y; this.z = z; return this; }
  }
  class Matrix4 {
    constructor() { this.translation = [0, 0, 0]; }
    makeTranslation(x, y, z) { this.translation = [x, y, z]; return this; }
  }
  class Object3D {
    constructor() {
      this.children = [];
      this.position = new Vector3();
      this.rotation = { x: 0, y: 0, z: 0 };
      this.scale = new Vector3(1, 1, 1);
      this.visible = true;
      this.userData = {};
    }
    add(...objs) { this.children.push(...objs); return this; }
  }
  class Group extends Object3D {}
  class Mesh extends Object3D {
    constructor(geometry, material) {
      super();
      this.geometry = geometry;
      this.material = material;
    }
  }
  class Sprite extends Object3D {
    constructor(material) { super(); this.material = material; }
  }
  class SpriteMaterial extends Material {}
  class CanvasTexture extends Geometry {
    constructor(canvas) { super(); this.image = canvas; this.needsUpdate = false; }
    dispose() { if (!this.disposed) { this.disposed = true; disposed.textures += 1; } }
  }
  class Scene extends Object3D {
    constructor() { super(); this.background = null; }
  }
  class PerspectiveCamera extends Object3D {
    constructor(fov, aspect, near, far) {
      super();
      this.fov = fov; this.aspect = aspect; this.near = near; this.far = far;
    }
    lookAt() {}
  }
  class InstancedMesh extends Mesh {
    constructor(geometry, material, count) {
      super(geometry, material);
      this.count = count;
      this.instanceMatrix = { needsUpdate: false };
      this.matrices = new Map();
      this.disposed = false;
    }
    setMatrixAt(i, m) { this.matrices.set(i, [...(m.translation || [0, 0, 0])]); }
    dispose() { if (!this.disposed) { this.disposed = true; disposed.instanced += 1; } }
  }
  class WebGLRenderer {
    constructor(opts) {
      if (options.rendererThrows) throw new Error('context creation failed');
      this.canvas = opts.canvas;
      this.renderCalls = 0;
      this.disposed = false;
    }
    setPixelRatio() {}
    setSize() {}
    render() { this.renderCalls += 1; }
    dispose() { if (!this.disposed) { this.disposed = true; disposed.renderer += 1; } }
    getContext() { return {}; }
  }
  const THREE = {
    WebGLRenderer, Scene, PerspectiveCamera, Color, Vector3, Matrix4,
    Group, Mesh, Sprite, SpriteMaterial, CanvasTexture,
    MeshBasicMaterial: Material, InstancedMesh,
    BoxGeometry: Geometry, CylinderGeometry: Geometry, SphereGeometry: Geometry,
    ConeGeometry: Geometry, PlaneGeometry: Geometry, CircleGeometry: Geometry,
    RingGeometry: Geometry,
  };
  return { THREE, disposed };
}

function stubCanvas() {
  const listeners = new Map();
  return {
    width: 1080, height: 1920,
    getContext: (type) => ((type === 'webgl2' || type === 'webgl') ? { stub: true } : null),
    addEventListener: (ev, fn) => {
      if (!listeners.has(ev)) listeners.set(ev, []);
      listeners.get(ev).push(fn);
    },
    removeEventListener: (ev, fn) => {
      const arr = listeners.get(ev) || [];
      const i = arr.indexOf(fn);
      if (i >= 0) arr.splice(i, 1);
    },
    _fire(ev, arg) { for (const fn of [...(listeners.get(ev) || [])]) fn(arg); },
    style: {},
  };
}
// --- End of stub (copied from test/render3d.test.js). ---------------------

const DURATIONS = {
  follow: 2400, command: 1800, gift: 2000, 'gift-scene': 2200,
  'meter-stage': 3200, toast: 2600, ticker: 20000, school: 4000, finale: 6000,
};

const NAMES = Array.from({ length: 60 }, (_, i) => `Soak3DViewer${i + 1}`);
const GIFT_NAMES = ['Rose', 'Star', 'Heart', 'Coffee', 'Cloud', 'Crown', 'Fish', 'ZqxUnknownGift'];
const NOISE = ['hello', 'nice stream', 'lol', 'good morning', '!dance', '!!!'];
const COMMANDS = ['!cast', '!bait', '!wave', '!hide'];

async function main() {
  const rand = mulberry32(20261119);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'games-soak3d-'));
  const snapshotPath = path.join(tmpDir, 'session-snapshot.json');

  const gameState = new GameState({ theme: 'sunrise-lake', lake3D: true });
  const simulator = new SimulatorAdapter();
  const manual = new ManualAdapter();
  simulator.onEvent((e) => gameState.ingest(e));
  manual.onEvent((e) => gameState.ingest(e));

  let saveTimer = null;
  let saves = 0;
  const server = createGameServer({
    gameState,
    adapters: { live: null, simulator, manual },
    publicDir: path.join(ROOT, 'public'),
    srcDir: path.join(ROOT, 'src'),
    port: 0,
    persist: { clear: async () => {} },
  });
  gameState.onChange = () => {
    server.broadcastSnapshotSoon();
    if (!saveTimer) {
      saveTimer = setTimeout(() => {
        saveTimer = null;
        saves += 1;
        saveSnapshot(snapshotPath, gameState.persistData()).catch(() => {});
      }, 500);
    }
  };
  const address = await server.listen();
  const port = address.port;

  // Máy khách overlay: nhận snapshot/animation cho trình kết xuất 3D.
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=overlay`);
  let latest = null;
  let animations = [];
  let messages = 0;
  const animKinds = {};
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  ws.on('message', (raw) => {
    messages += 1;
    try {
      const data = JSON.parse(String(raw));
      if (data.type === 'snapshot') {
        latest = data.state;
      } else if (data.type === 'animation') {
        animKinds[data.animation.kind] = (animKinds[data.animation.kind] || 0) + 1;
        animations.push({ ...data.animation, receivedAt: Date.now() });
      }
    } catch { /* bỏ qua */ }
  });

  // Trình kết xuất 3D headless (stub THREE, không GPU thật).
  const { THREE, disposed } = makeStubTHREE();
  const realConfig = { LAKE_3D, SCENE_PALETTES: (await import('../src/lake3d-config.js')).SCENE_PALETTES };
  function newRenderer() {
    return createLakeRenderer({
      THREE, canvas: stubCanvas(), config: realConfig, seed: 20261119,
    });
  }
  let renderer = newRenderer();
  let recreates = 0;
  let ambientFiredBeforeRecreate = 0; // the recreate resets the counter

  let frames = 0;
  const frameTimes = [];
  let lastFrame = Date.now();
  const frameTimer = setInterval(() => {
    const now = Date.now();
    if (now - lastFrame < 33) return;
    lastFrame = now;
    const live = [];
    for (const a of animations) {
      const duration = DURATIONS[a.kind] || 2000;
      if (now - a.receivedAt < duration) live.push(a);
    }
    animations = live;
    const start = performance.now();
    try {
      renderer.frame(now, latest, live);
    } catch (err) {
      console.error('[soak3d] renderer.frame threw:', err && err.message ? err.message : err);
      process.exitCode = 1;
    }
    frameTimes.push(performance.now() - start);
    frames += 1;
  }, 33);

  // Tiêm sự kiện: lưu lượng hỗn hợp giống thực tế mỗi 200ms.
  const likeTotals = new Map();
  let injected = 0;
  const injectTimer = setInterval(() => {
    const name = NAMES[Math.floor(rand() * NAMES.length)];
    const roll = rand();
    if (roll < 0.4) {
      const batch = 5 + Math.floor(rand() * 55);
      const prev = likeTotals.get(name) || 0;
      const reset = rand() < 0.05;
      const total = reset ? batch : prev + batch;
      likeTotals.set(name, total);
      simulator.likes(name, batch, total);
    } else if (roll < 0.6) {
      simulator.follow(name);
    } else if (roll < 0.8) {
      const text = rand() < 0.7 ? COMMANDS[Math.floor(rand() * COMMANDS.length)] : NOISE[Math.floor(rand() * NOISE.length)];
      simulator.comment(name, text);
    } else {
      const gift = GIFT_NAMES[Math.floor(rand() * GIFT_NAMES.length)];
      simulator.gift(name, gift, '', 1, false);
      simulator.gift(name, gift, '', 2, false);
      simulator.gift(name, gift, '', 3, true);
    }
    injected += 1;
    if (rand() < 0.02) {
      for (let i = 0; i < 120; i += 1) simulator.follow(`Burst${i}`);
    }
  }, 200);

  const samples = [];
  const rssStart = process.memoryUsage().rss;
  const heapStart = process.memoryUsage().heapUsed;
  samples.push({ minute: 0, rssMB: rssStart / 1048576, heapMB: heapStart / 1048576, injected: 0, frames: 0 });
  console.log(`[soak3d] minute 0: RSS ${(rssStart / 1048576).toFixed(1)} MB, heap ${(heapStart / 1048576).toFixed(1)} MB`);
  const sampleTimer = setInterval(() => {
    const mem = process.memoryUsage();
    const minute = samples.length;
    // Recreate the renderer once, halfway, to exercise dispose + re-init.
    if (minute === Math.ceil(MINUTES / 2)) {
      try {
        ambientFiredBeforeRecreate += renderer.getAmbientFired();
        renderer.dispose();
        renderer = newRenderer();
        recreates += 1;
        console.log(`[soak3d] minute ${minute}: renderer disposed + recreated (ok)`);
      } catch (err) {
        console.error('[soak3d] renderer recreate failed:', err && err.message ? err.message : err);
        process.exitCode = 1;
      }
    }
    samples.push({ minute, rssMB: mem.rss / 1048576, heapMB: mem.heapUsed / 1048576, injected, frames });
    console.log(`[soak3d] minute ${minute}: RSS ${(mem.rss / 1048576).toFixed(1)} MB, heap ${(mem.heapUsed / 1048576).toFixed(1)} MB, injected ${injected}, frames ${frames}, theme ${gameState.themeId}, spots ${gameState.spots.size}, cycle ${gameState.cycleTotal}`);
  }, 60 * 1000);

  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));

  clearInterval(injectTimer);
  clearInterval(sampleTimer);
  clearInterval(frameTimer);
  if (saveTimer) clearTimeout(saveTimer);
  const memEnd = process.memoryUsage();
  samples.push({ minute: MINUTES, rssMB: memEnd.rss / 1048576, heapMB: memEnd.heapUsed / 1048576, injected, frames });

  frameTimes.sort((a, b) => a - b);
  const avg = frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, frameTimes.length);
  const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)] || 0;
  const max = frameTimes[frameTimes.length - 1] || 0;

  const anglers = renderer.getAnglerStates();
  const report = {
    minutes: MINUTES,
    startedAt: new Date(Date.now() - DURATION_MS).toISOString(),
    renderer: '3d-headless-stub',
    eventsInjected: injected,
    wsMessagesReceived: messages,
    animationKinds: animKinds,
    framesRendered: frames,
    frameMs: { avg: +avg.toFixed(3), p95: +p95.toFixed(3), max: +max.toFixed(3) },
    rssStartMB: +(rssStart / 1048576).toFixed(1),
    rssEndMB: +(memEnd.rss / 1048576).toFixed(1),
    heapStartMB: +(heapStart / 1048576).toFixed(1),
    heapEndMB: +(memEnd.heapUsed / 1048576).toFixed(1),
    snapshotSaves: saves,
    recreates,
    ambientFired: ambientFiredBeforeRecreate + renderer.getAmbientFired(),
    qualityTier: renderer.getQualityTier(),
    particleCount: renderer.getParticleCount(),
    effectCounts: renderer.getEffectCounts(),
    stubDisposed: disposed,
    finalSpots: gameState.spots.size,
    finalCycleTotal: gameState.cycleTotal,
    finalMeterTotal: gameState.meterTotal,
    finalSceneIndex: gameState.sceneIndex,
    finalBaitOption: gameState.baitRound.option,
    finalTickerCursor: gameState.tickerCursor,
    finalTickerEntries: gameState.tickerEntries.length,
    anglersOccupied: anglers.filter((a) => a.occupied).length,
    anglersWithStates: anglers.filter((a) => a.visualStates.length > 0).length,
    counters: gameState.counters,
    samples,
  };
  const reportPath = path.join(ROOT, 'soak-report-3d.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`[soak3d] done: ${MINUTES} min, ${injected} events, ${frames} frames, frame avg ${avg.toFixed(2)}ms p95 ${p95.toFixed(2)}ms max ${max.toFixed(2)}ms`);
  console.log(`[soak3d] RSS ${(rssStart / 1048576).toFixed(1)} -> ${(memEnd.rss / 1048576).toFixed(1)} MB; heap ${(heapStart / 1048576).toFixed(1)} -> ${(memEnd.heapUsed / 1048576).toFixed(1)} MB`);
  console.log(`[soak3d] ambient fired ${report.ambientFired}, quality tier ${report.qualityTier}, recreates ${recreates}, spots ${gameState.spots.size}, cycle ${gameState.cycleTotal}`);
  console.log(`[soak3d] report: ${reportPath}`);

  renderer.dispose();
  ws.close();
  await server.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
  process.exit(process.exitCode || 0);
}

main().catch((err) => {
  console.error('[soak3d] failed:', err);
  process.exit(1);
});
