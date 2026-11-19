import { getTheme, DISCLOSURES, MUSIC_CREDIT, isValidTheme } from './themes.js';
import {
  AUDIO_DEFAULTS, normalizeAudioSettings, bgmForTheme, sfxForEvent, sfxKindForAnimation,
} from './audio.js';
import { LAKE_3D, SCENE_PALETTES, HOW_TO_PLAY, howToPlayText } from './lake3d-config.js';
import {
  CANVAS_W, CANVAS_H, createLakeRenderer, anglerPosition, sceneColorsAt,
  baitColorFor, meterFillFraction, tickerText, toastText, howToPlayBoardData,
} from './render3d.js';

// Animation durations (ms). The ticker scrolls every 20s; the school and
// finale are the large 3D effects.
const DURATIONS = {
  follow: 2400, command: 1800, gift: 2000, 'gift-scene': 2200,
  'meter-stage': 3200, toast: 2600, ticker: 20000, school: 4000, finale: 6000,
};

const canvas = document.getElementById('scene');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

const glCanvas = document.getElementById('scene3d');
glCanvas.width = CANVAS_W;
glCanvas.height = CANVAS_H;

const hud = document.getElementById('hud');
const meterFill = document.getElementById('meter-fill');
const howtoList = document.getElementById('howto-list');
const tickerEl = document.getElementById('ticker');
const toastEl = document.getElementById('toast');
const footerEl = document.getElementById('footer');
const noticeEl = document.getElementById('state-notice');

const params = new URLSearchParams(window.location.search);
const requestedTheme = params.get('theme');

// --- Audio: real recorded files only, played through HTML Audio elements.
// No synthesized audio anywhere: no oscillators, no generated tones.
// The manifest lists every file; when it (or the files) are missing the
// game runs silent and the control panel says so.
let audioManifest = null;
let audioSettings = { ...AUDIO_DEFAULTS };
const bgm = new Audio();
bgm.loop = true;
bgm.preload = 'auto';
bgm.volume = 0;
let bgmFile = null; // file currently loaded in the element
let bgmGain = 0; // 0..1 fade multiplier, eased in the frame loop
let bgmSwapAtZero = null; // file to load once the fade-out reaches silence

const sfxPools = new Map(); // kind -> { elements: Audio[], next: number }
function sfxPool(kind) {
  let pool = sfxPools.get(kind);
  if (!pool) {
    const file = sfxForEvent(audioManifest, kind);
    if (!file) return null;
    const elements = [];
    for (let i = 0; i < 3; i += 1) {
      const el = new Audio();
      el.src = `/audio/${encodeURIComponent(file)}`;
      el.preload = 'auto';
      elements.push(el);
    }
    pool = { elements, next: 0 };
    sfxPools.set(kind, pool);
  }
  return pool;
}

function playSfx(kind) {
  if (!audioManifest || audioSettings.muted || !kind) return;
  const pool = sfxPool(kind);
  if (!pool) return;
  const el = pool.elements[pool.next];
  pool.next = (pool.next + 1) % pool.elements.length;
  el.volume = audioSettings.sfxVolume;
  el.currentTime = 0;
  // Autoplay gating: play() rejects until the browser allows sound. Every
  // game event retries, so audio starts as soon as the browser allows it
  // (see README: the streamer clicks once in the browser source, or OBS
  // allows autoplay for the source).
  el.play().catch(() => {});
}

function desiredBgmFile() {
  return bgmForTheme(audioManifest, state.theme);
}

// Fade the loop in the frame loop (no extra timers): fade out over ~400ms,
// swap the source at silence, fade back in over ~600ms. Volume follows the
// control-panel settings every frame, so mute/sliders act immediately.
function updateAudio(now) {
  if (!audioManifest) return;
  if (!updateAudio.lastNow) updateAudio.lastNow = now;
  // Clamp the step so a tab switch or a slow frame cannot jump the fade.
  const dt = Math.min(100, Math.max(0, now - updateAudio.lastNow));
  updateAudio.lastNow = now;
  const target = desiredBgmFile();
  const audible = !audioSettings.muted && target;
  if (target && target !== bgmFile && !bgmSwapAtZero) {
    bgmSwapAtZero = target;
  }
  if (bgmSwapAtZero) {
    bgmGain = Math.max(0, bgmGain - dt / 400);
    if (bgmGain <= 0) {
      bgmFile = bgmSwapAtZero;
      bgmSwapAtZero = null;
      bgm.src = `/audio/${encodeURIComponent(bgmFile)}`;
      bgm.play().catch(() => {});
    }
  } else if (audible) {
    bgmGain = Math.min(1, bgmGain + dt / 600);
  } else {
    bgmGain = Math.max(0, bgmGain - dt / 400);
  }
  bgm.volume = audioSettings.muted ? 0 : audioSettings.bgmVolume * bgmGain;
  // Retry playback on every frame while a loop is loaded: harmless once
  // playing, and audio starts the moment the browser allows it.
  if (bgmFile && bgm.paused && !audioSettings.muted) bgm.play().catch(() => {});
}
updateAudio.lastNow = 0;

fetch('/audio/manifest.json')
  .then((res) => (res.ok ? res.json() : null))
  .then((manifest) => {
    if (manifest && manifest.files) audioManifest = manifest;
  })
  .catch(() => { /* silent mode: manifest or files missing */ });

// --- Reduced motion: the control-panel toggle OR the OS preference.
// Names, the meter, and disclosures stay fully readable either way.
const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
function reducedMotionActive() {
  return audioSettings.reducedMotion || motionQuery.matches;
}

let state = {
  theme: 'sunrise-lake',
  status: { paused: false, killed: false, connection: 'offline' },
  spots: [],
  meter: { total: 0, thresholds: [100, 500, 1000, 2500, 5000, 10000], hit: [], label: '', stageLabel: '' },
  counters: {},
  queueSize: 0,
  spotCount: 0,
};
let animations = [];
let particles = null; // created lazily with the 2D renderer module
let connected = false;
let reconnectDelay = 1000;

// --- 2D renderer: loaded lazily, only for the non-lake themes. The lake
// fallback never touches it; it paints its own static scene below.
let render2dModule = null;
let render2dPromise = null;
function ensureRender2d() {
  if (render2dModule) return Promise.resolve(render2dModule);
  if (!render2dPromise) {
    render2dPromise = import('./render.js')
      .then((mod) => { render2dModule = mod; return mod; })
      .catch(() => { render2dPromise = null; return null; });
  }
  return render2dPromise;
}

// --- Sunrise Lake 3D path -------------------------------------------------
// lakeMode: 'off' (another theme), 'static' (3D unavailable: the 2D canvas
// paints the scene once per snapshot and the DOM HUD keeps working), or
// '3d' (the WebGL renderer is live).
let lakeMode = 'off';
let lakeRenderer = null;
let lakeInitPromise = null;
let lastReducedMotion = reducedMotionActive();
let lastStaticKey = '';
let lastStaticPaintMs = 0;
let tickerUntil = 0;
let toastUntil = 0;
let lastMeterFill = -1;
let boardBuilt = false;

const lakeConfig = { LAKE_3D, SCENE_PALETTES };

function showHud(show) {
  if (hud) hud.style.display = show ? '' : 'none';
  if (canvas) canvas.style.display = show && lakeMode === '3d' ? 'none' : '';
  if (glCanvas) glCanvas.style.display = show && lakeMode === '3d' ? '' : 'none';
}

function buildHowToPlayBoard() {
  if (!howtoList || boardBuilt) return;
  // The lines come from howToPlayText(); the icons come with the rows.
  // Each line is a pure literal description of the command.
  const texts = howToPlayText();
  const rows = howToPlayBoardData(HOW_TO_PLAY);
  rows.forEach((row, i) => {
    const li = document.createElement('li');
    const icon = document.createElement('span');
    icon.className = 'howto-icon';
    icon.innerHTML = row.icon;
    const text = document.createElement('span');
    text.className = 'howto-text';
    text.textContent = texts[i] || row.text;
    li.appendChild(icon);
    li.appendChild(text);
    howtoList.appendChild(li);
  });
  boardBuilt = true;
}

function buildFooter() {
  if (!footerEl || footerEl.dataset.built) return;
  for (const line of [...DISCLOSURES, MUSIC_CREDIT]) {
    const p = document.createElement('p');
    p.textContent = line;
    footerEl.appendChild(p);
  }
  footerEl.dataset.built = '1';
}

function paintStaticLakeScene(nowMs) {
  // Static fallback for the lake: sky gradient, lake, reeds, chairs with
  // names. Painted once per snapshot (plus a slow refresh so the daylight
  // colours keep up with the schedule). Never imports the 2D renderer.
  const snapshot = state;
  const sceneInfo = snapshot.scene && typeof snapshot.scene === 'object' ? snapshot.scene : {};
  const sceneIndex = Number.isInteger(sceneInfo.index)
    ? sceneInfo.index
    : Math.floor(nowMs / LAKE_3D.SCENE_MS) % LAKE_3D.SCENES.length;
  const startedAt = Number.isFinite(sceneInfo.startedAt) ? sceneInfo.startedAt : nowMs;
  const colours = sceneColorsAt(lakeConfig, sceneIndex, Math.max(0, nowMs - startedAt), reducedMotionActive());
  const key = JSON.stringify([
    sceneIndex, Math.floor((nowMs - startedAt) / 60000),
    snapshot.spots, snapshot.baitVote, snapshot.status,
  ]);
  if (key === lastStaticKey && nowMs - lastStaticPaintMs < 10000) return;
  lastStaticKey = key;
  lastStaticPaintMs = nowMs;

  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  sky.addColorStop(0, colours.skyTop);
  sky.addColorStop(0.55, colours.skyBottom);
  sky.addColorStop(1, colours.waterBottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  // Sun disc.
  ctx.fillStyle = colours.sun;
  ctx.beginPath();
  ctx.arc(CANVAS_W * 0.78, 300, 54, 0, Math.PI * 2);
  ctx.fill();
  // Lake.
  ctx.fillStyle = colours.waterTop;
  ctx.beginPath();
  ctx.ellipse(CANVAS_W / 2, 1150, 470, 330, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = colours.waterBottom;
  ctx.beginPath();
  ctx.ellipse(CANVAS_W / 2, 1180, 430, 280, 0, 0, Math.PI * 2);
  ctx.fill();
  // Reeds in the bottom corners.
  ctx.strokeStyle = '#2e5d43';
  ctx.lineWidth = 5;
  for (const baseX of [46, 78, 1010, 1042]) {
    const h = 90 + ((baseX * 7) % 40);
    ctx.beginPath();
    ctx.moveTo(baseX, 1608);
    ctx.quadraticCurveTo(baseX + 8, 1608 - h * 0.6, baseX + 2, 1608 - h);
    ctx.stroke();
  }
  // Chairs around the lake; empty chairs show a rod leaning ready.
  const bySlot = new Map();
  for (const spot of snapshot.spots || []) {
    if (spot && Number.isInteger(spot.slot)) bySlot.set(spot.slot, spot);
  }
  const baitColour = baitColorFor(
    (snapshot.baitVote && snapshot.baitVote.option) || LAKE_3D.BAIT_VOTE_DEFAULT, lakeConfig,
  );
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (let slot = 0; slot < LAKE_3D.MAX_ANGLERS; slot += 1) {
    const pos = anglerPosition(slot);
    const spot = bySlot.get(slot);
    const occupied = !!spot;
    // Chair seat + back.
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(pos.x - 26, pos.y - 6, 52, 12);
    ctx.fillRect(pos.x - 26, pos.y - 34, 52, 10);
    // Rod leaning ready on an empty chair; held rod for a seated angler.
    ctx.strokeStyle = '#5d3a22';
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (occupied) {
      ctx.moveTo(pos.x + 18, pos.y - 20);
      ctx.lineTo(pos.x + 44, pos.y - 52);
      ctx.moveTo(pos.x + 44, pos.y - 52);
      ctx.lineTo(pos.x + 52, pos.y + 6);
    } else {
      ctx.moveTo(pos.x + 24, pos.y - 6);
      ctx.lineTo(pos.x + 34, pos.y - 58);
    }
    ctx.stroke();
    if (occupied) {
      // Simple seated figure: body, head, hat.
      ctx.fillStyle = '#3f6d8e';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - 22, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#f2c89b';
      ctx.beginPath();
      ctx.arc(pos.x, pos.y - 40, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b23e';
      ctx.beginPath();
      ctx.ellipse(pos.x, pos.y - 46, 13, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      // Bobber on the water in the vote colour.
      ctx.fillStyle = baitColour;
      ctx.beginPath();
      ctx.arc(pos.x + 52, pos.y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
      const name = spot.displayName || '';
      if (name) {
        ctx.font = '600 24px system-ui, sans-serif';
        ctx.fillStyle = 'rgba(12, 24, 38, 0.72)';
        const w = ctx.measureText(name).width + 24;
        ctx.beginPath();
        ctx.roundRect(pos.x - w / 2, pos.y + 18, w, 34, 17);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.fillText(name, pos.x, pos.y + 36);
      }
    }
  }
  if (!connected) {
    ctx.fillStyle = 'rgba(10,18,30,0.75)';
    ctx.beginPath();
    ctx.roundRect(390, 640, 300, 44, 22);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = '600 24px system-ui, sans-serif';
    ctx.fillText('Reconnecting…', CANVAS_W / 2, 663);
  }
}

async function initLake3d() {
  if (lakeRenderer || lakeInitPromise) return lakeInitPromise;
  lakeInitPromise = (async () => {
    try {
      const three = await import('./vendor/three.module.js');
      const renderer = createLakeRenderer({
        THREE: three,
        canvas: glCanvas,
        config: lakeConfig,
        reducedMotion: reducedMotionActive(),
        onContextLost: () => {
          lakeRenderer = null;
          lakeMode = 'static';
          lastStaticKey = '';
          showHud(true);
        },
        onContextRestored: () => {
          lakeMode = '3d';
          showHud(true);
        },
      });
      lakeRenderer = renderer;
      lakeMode = '3d';
      showHud(true);
    } catch {
      // Any failure (no WebGL, context creation throws, module fails):
      // stay on the static scene. The HUD keeps working.
      lakeRenderer = null;
      lakeMode = 'static';
      lastStaticKey = '';
      showHud(true);
    } finally {
      lakeInitPromise = null;
    }
    return lakeRenderer;
  })();
  return lakeInitPromise;
}

function enterLakeTheme() {
  buildHowToPlayBoard();
  buildFooter();
  lakeMode = 'static';
  lastStaticKey = '';
  showHud(true);
  void initLake3d();
}

function exitLakeTheme() {
  if (lakeRenderer) {
    try { lakeRenderer.dispose(); } catch { /* ignore */ }
    lakeRenderer = null;
  }
  lakeMode = 'off';
  tickerUntil = 0;
  toastUntil = 0;
  if (tickerEl) { tickerEl.textContent = ''; tickerEl.style.display = 'none'; }
  if (toastEl) { toastEl.style.display = 'none'; }
  if (noticeEl) noticeEl.style.display = 'none';
  showHud(false);
}

function updateHud(now) {
  if (lakeMode === 'off') return;
  // Meter: fill only. No numbers, no remaining count, no countdown.
  if (meterFill) {
    const fill = meterFillFraction(state.meter);
    const pct = Math.round(fill * 1000) / 10;
    if (pct !== lastMeterFill) {
      lastMeterFill = pct;
      meterFill.style.width = `${pct}%`;
    }
  }
  // Thank-you ticker strip: names only, with a plain thank-you.
  if (tickerEl) {
    if (now < tickerUntil && tickerEl.textContent) {
      tickerEl.style.display = '';
    } else {
      tickerEl.style.display = 'none';
      if (now >= tickerUntil) tickerEl.textContent = '';
    }
  }
  if (toastEl && now >= toastUntil) toastEl.style.display = 'none';
  // State notice: paused / stopped / reconnecting. Nothing else.
  if (noticeEl) {
    let text = '';
    if (state.status.killed) text = 'The game has stopped.';
    else if (state.status.paused) text = 'Paused';
    else if (!connected) text = 'Reconnecting…';
    if (text) {
      noticeEl.textContent = text;
      noticeEl.style.display = '';
    } else {
      noticeEl.style.display = 'none';
    }
  }
  // Reduced-motion changes reach the 3D renderer live.
  const reduced = reducedMotionActive();
  if (reduced !== lastReducedMotion) {
    lastReducedMotion = reduced;
    if (lakeRenderer) lakeRenderer.setReducedMotion(reduced);
  }
}

function applySnapshot(next) {
  if (!next || typeof next !== 'object') return;
  const themeChanged = next.theme && next.theme !== state.theme;
  const wasLake = state.theme === 'sunrise-lake';
  state = next;
  if (themeChanged) {
    particles = null;
    animations = [];
    const isLake = state.theme === 'sunrise-lake';
    if (isLake && !wasLake) enterLakeTheme();
    else if (!isLake && wasLake) exitLakeTheme();
  }
}

function connect() {
  const proto = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(`${proto}://${window.location.host}/ws?role=overlay`);
  ws.onopen = () => {
    connected = true;
    reconnectDelay = 1000;
    if (requestedTheme && isValidTheme(requestedTheme)) {
      ws.send(JSON.stringify({ action: 'setTheme', theme: requestedTheme }));
    }
  };
  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      if (data.type === 'snapshot') {
        applySnapshot(data.state);
        if (data.audio) audioSettings = normalizeAudioSettings(data.audio, audioSettings);
      } else if (data.type === 'animation' && data.animation) {
        const kind = data.animation.kind;
        const anim = {
          ...data.animation,
          startedAt: performance.now(),
          duration: DURATIONS[kind] || 2000,
        };
        animations.push(anim);
        // Ticker names go to the DOM strip, never into the 3D scene.
        if (kind === 'ticker' && lakeMode !== 'off' && tickerEl) {
          const names = Array.isArray(data.animation.names)
            ? data.animation.names
            : (data.animation.displayName ? [data.animation.displayName] : []);
          const text = tickerText(names);
          if (text) {
            tickerEl.textContent = text;
            tickerEl.style.display = '';
            tickerUntil = performance.now() + (DURATIONS.ticker || 20000);
          }
        }
        // Toasts show their text in the DOM in lake mode (plain
        // thank-you wording); the 3D scene only gets the small ripple.
        if (kind === 'toast' && lakeMode !== 'off' && toastEl) {
          const text = toastText(data.animation);
          if (text) {
            toastEl.textContent = text;
            toastEl.style.display = '';
            toastUntil = performance.now() + anim.duration;
          }
        }
        playSfx(sfxKindForAnimation(kind));
      }
    } catch { /* ignore malformed frames */ }
  };
  ws.onclose = () => {
    connected = false;
    setTimeout(connect, reconnectDelay);
    reconnectDelay = Math.min(10000, reconnectDelay * 2);
  };
  ws.onerror = () => {
    try { ws.close(); } catch { /* ignore */ }
  };
}
connect();

// Start on the lake theme when that is the current theme.
if (state.theme === 'sunrise-lake') enterLakeTheme();

// 30fps cap: skip frames that arrive sooner than 33ms after the last draw.
let lastFrameAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (now - lastFrameAt < 33) return;
  lastFrameAt = now;
  const live = [];
  for (const a of animations) {
    const progress = (now - a.startedAt) / a.duration;
    if (progress < 1) live.push({ ...a, progress });
  }
  animations = live;
  updateAudio(now);
  if (state.theme === 'sunrise-lake') {
    updateHud(now);
    if (lakeMode === '3d' && lakeRenderer) {
      lakeRenderer.frame(now, state, live);
    } else {
      paintStaticLakeScene(now);
    }
    return;
  }
  // Non-lake themes use the existing 2D renderer, loaded on demand.
  void ensureRender2d().then((mod) => {
    if (!mod || state.theme === 'sunrise-lake') return;
    if (!particles) particles = mod.createParticles(state.theme);
    const theme = getTheme(state.theme);
    mod.renderScene(ctx, {
      theme,
      spots: state.spots,
      meter: state.meter,
      animations: live,
      particles,
      timeMs: now,
      paused: state.status.paused,
      killed: state.status.killed,
      disclosures: DISCLOSURES,
      musicCredit: MUSIC_CREDIT,
      reducedMotion: reducedMotionActive(),
    });
    if (!connected) {
      ctx.fillStyle = 'rgba(10,18,30,0.75)';
      ctx.beginPath();
      ctx.roundRect(390, 640, 300, 44, 22);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = '600 24px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Reconnecting…', CANVAS_W / 2, 663);
    }
  });
}
requestAnimationFrame(frame);
