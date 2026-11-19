// Kiểm tra tải (soak) mô phỏng liên tục. Chạy máy chủ thật + trạng thái trò chơi +
// bộ điều hợp mô phỏng (simulator adapter) + một máy khách overlay WebSocket kết xuất
// mọi khung hình bằng một ngữ cảnh canvas giả (stub) (đo chi phí khung hình phía
// JavaScript, không phải thời gian GPU của trình duyệt), đổi chủ đề theo lịch trình.
// Lấy mẫu bộ nhớ mỗi phút và ghi soak-report.json.
//
//   SOAK_MINUTES=15 node scripts/soak.js   (mặc định là 15)

import path from 'node:path';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { WebSocket } from 'ws';
import { GameState } from '../src/gameState.js';
import { createGameServer } from '../src/server.js';
import { SimulatorAdapter } from '../src/adapters/simulatorAdapter.js';
import { ManualAdapter } from '../src/adapters/manualAdapter.js';
import { renderScene, createParticles, mulberry32 } from '../public/render.js';
import { getTheme, DISCLOSURES, THEME_IDS } from '../src/themes.js';
import { saveSnapshot } from '../src/snapshot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MINUTES = Math.max(1, Number(process.env.SOAK_MINUTES || 15));
const DURATION_MS = MINUTES * 60 * 1000;

function stubCtx() {
  const gradient = { addColorStop() {} };
  const store = {};
  return new Proxy(store, {
    get(target, prop) {
      if (prop === 'createLinearGradient') return () => gradient;
      if (prop === 'measureText') return (text) => ({ width: String(text).length * 12 });
      if (prop in target) return target[prop];
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; },
  });
}

const NAMES = Array.from({ length: 60 }, (_, i) => `SoakViewer${i + 1}`);
const GIFT_NAMES = ['Rose', 'Star', 'Heart', 'Coffee', 'Cloud', 'Crown', 'Fish', 'ZqxUnknownGift'];
const NOISE = ['hello', 'nice stream', 'lol', 'good morning', '!dance', '!!!'];

async function main() {
  const rand = mulberry32(20261119);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'games-soak-'));
  const snapshotPath = path.join(tmpDir, 'session-snapshot.json');

  const gameState = new GameState({ theme: THEME_IDS[0] });
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

  // Máy khách overlay: nhận các snapshot/animation, kết xuất với giới hạn 30fps.
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws?role=overlay`);
  let latest = null;
  let animations = [];
  let messages = 0;
  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', reject);
  });
  ws.on('message', (raw) => {
    messages += 1;
    try {
      const data = JSON.parse(String(raw));
      if (data.type === 'snapshot') {
        if (latest && data.state.theme !== latest.theme) {
          animations = [];
        }
        latest = data.state;
      } else if (data.type === 'animation') {
        animations.push({ ...data.animation, startedAt: Date.now(), duration: 2000 });
      }
    } catch { /* bỏ qua */ }
  });

  const ctx = stubCtx();
  let particles = createParticles(THEME_IDS[0]);
  let currentTheme = THEME_IDS[0];
  let frames = 0;
  const frameTimes = [];
  let lastFrame = Date.now();
  const frameTimer = setInterval(() => {
    const now = Date.now();
    if (now - lastFrame < 33) return;
    lastFrame = now;
    if (!latest) return;
    if (latest.theme !== currentTheme) {
      currentTheme = latest.theme;
      particles = createParticles(currentTheme);
    }
    const live = [];
    for (const a of animations) {
      const progress = (now - a.startedAt) / a.duration;
      if (progress < 1) live.push({ ...a, progress });
    }
    animations = live;
    const start = performance.now();
    renderScene(ctx, {
      theme: getTheme(latest.theme),
      spots: latest.spots,
      meter: latest.meter,
      animations: live,
      particles,
      timeMs: now,
      paused: latest.status.paused,
      killed: latest.status.killed,
      disclosures: DISCLOSURES,
    });
    frameTimes.push(performance.now() - start);
    frames += 1;
  }, 33);

  // Tiêm sự kiện: lưu lượng hỗn hợp giống thực tế mỗi 200ms.
  const likeTotals = new Map();
  let injected = 0;
  let themeIndex = 0;
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
      const theme = getTheme(gameState.themeId);
      const cmds = Object.keys(theme.commands);
      const text = rand() < 0.7 ? cmds[Math.floor(rand() * cmds.length)] : NOISE[Math.floor(rand() * NOISE.length)];
      simulator.comment(name, text);
    } else {
      const gift = GIFT_NAMES[Math.floor(rand() * GIFT_NAMES.length)];
      // Các phần của chuỗi (streak) rồi đến sự kiện cuối cùng, như lưu lượng live thực tế.
      simulator.gift(name, gift, '', 1, false);
      simulator.gift(name, gift, '', 2, false);
      simulator.gift(name, gift, '', 3, true);
    }
    injected += 1;
    // Thỉnh thoảng bùng nổ (burst) để gây áp lực lên hàng đợi.
    if (rand() < 0.02) {
      for (let i = 0; i < 120; i += 1) simulator.follow(`Burst${i}`);
    }
  }, 200);

  // Đổi chủ đề mỗi 3 phút.
  const themeTimer = setInterval(() => {
    themeIndex = (themeIndex + 1) % THEME_IDS.length;
    gameState.setTheme(THEME_IDS[themeIndex]);
  }, 3 * 60 * 1000);

  const samples = [];
  const rssStart = process.memoryUsage().rss;
  const heapStart = process.memoryUsage().heapUsed;
  samples.push({ minute: 0, rssMB: rssStart / 1048576, heapMB: heapStart / 1048576, injected: 0, frames: 0 });
  console.log(`[soak] minute 0: RSS ${(rssStart / 1048576).toFixed(1)} MB, heap ${(heapStart / 1048576).toFixed(1)} MB`);
  const sampleTimer = setInterval(() => {
    const mem = process.memoryUsage();
    const minute = samples.length;
    samples.push({ minute, rssMB: mem.rss / 1048576, heapMB: mem.heapUsed / 1048576, injected, frames });
    console.log(`[soak] minute ${minute}: RSS ${(mem.rss / 1048576).toFixed(1)} MB, heap ${(mem.heapUsed / 1048576).toFixed(1)} MB, injected ${injected}, frames ${frames}, theme ${gameState.themeId}`);
  }, 60 * 1000);

  await new Promise((resolve) => setTimeout(resolve, DURATION_MS));

  clearInterval(injectTimer);
  clearInterval(themeTimer);
  clearInterval(sampleTimer);
  clearInterval(frameTimer);
  if (saveTimer) clearTimeout(saveTimer);
  const memEnd = process.memoryUsage();
  samples.push({ minute: MINUTES, rssMB: memEnd.rss / 1048576, heapMB: memEnd.heapUsed / 1048576, injected, frames });

  frameTimes.sort((a, b) => a - b);
  const avg = frameTimes.reduce((a, b) => a + b, 0) / Math.max(1, frameTimes.length);
  const p95 = frameTimes[Math.floor(frameTimes.length * 0.95)] || 0;
  const max = frameTimes[frameTimes.length - 1] || 0;

  const report = {
    minutes: MINUTES,
    startedAt: new Date(Date.now() - DURATION_MS).toISOString(),
    eventsInjected: injected,
    wsMessagesReceived: messages,
    framesRendered: frames,
    frameMs: { avg: +avg.toFixed(3), p95: +p95.toFixed(3), max: +max.toFixed(3) },
    rssStartMB: +(rssStart / 1048576).toFixed(1),
    rssEndMB: +(memEnd.rss / 1048576).toFixed(1),
    heapStartMB: +(heapStart / 1048576).toFixed(1),
    heapEndMB: +(memEnd.heapUsed / 1048576).toFixed(1),
    snapshotSaves: saves,
    themesCycled: THEME_IDS,
    finalTheme: gameState.themeId,
    finalSpots: gameState.spots.size,
    finalMeter: gameState.meterTotal,
    counters: gameState.counters,
    samples,
  };
  const reportPath = path.join(ROOT, 'soak-report.json');
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(`[soak] done: ${MINUTES} min, ${injected} events, ${frames} frames, frame avg ${avg.toFixed(2)}ms p95 ${p95.toFixed(2)}ms max ${max.toFixed(2)}ms`);
  console.log(`[soak] RSS ${(rssStart / 1048576).toFixed(1)} -> ${(memEnd.rss / 1048576).toFixed(1)} MB; heap ${(heapStart / 1048576).toFixed(1)} -> ${(memEnd.heapUsed / 1048576).toFixed(1)} MB`);
  console.log(`[soak] report: ${reportPath}`);

  ws.close();
  await server.close();
  await fs.rm(tmpDir, { recursive: true, force: true });
  process.exit(0);
}

main().catch((err) => {
  console.error('[soak] failed:', err);
  process.exit(1);
});
