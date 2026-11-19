import { getTheme, DISCLOSURES, MUSIC_CREDIT, isValidTheme } from './themes.js';
import { renderScene, createParticles, CANVAS_W, CANVAS_H } from './render.js';
import {
  AUDIO_DEFAULTS, normalizeAudioSettings, bgmForTheme, sfxForEvent, sfxKindForAnimation,
} from './audio.js';

const DURATIONS = {
  follow: 2400, command: 1800, gift: 2000, 'gift-scene': 2200,
  'meter-stage': 3200, toast: 2600,
};

const canvas = document.getElementById('scene');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');

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
  // playing, and it unlocks audio the moment the browser allows it.
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
let particles = createParticles(state.theme);
let connected = false;
let reconnectDelay = 1000;

function applySnapshot(next) {
  if (!next || typeof next !== 'object') return;
  const themeChanged = next.theme && next.theme !== state.theme;
  state = next;
  if (themeChanged) {
    particles = createParticles(state.theme);
    animations = [];
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
        animations.push({
          ...data.animation,
          startedAt: performance.now(),
          duration: DURATIONS[kind] || 2000,
        });
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

// 30fps cap: skip frames that arrive sooner than 33ms after the last draw.
let lastFrameAt = 0;
function frame(now) {
  requestAnimationFrame(frame);
  if (now - lastFrameAt < 33) return;
  lastFrameAt = now;
  const theme = getTheme(state.theme);
  const live = [];
  for (const a of animations) {
    const progress = (now - a.startedAt) / a.duration;
    if (progress < 1) live.push({ ...a, progress });
  }
  animations = live;
  updateAudio(now);
  renderScene(ctx, {
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
}
requestAnimationFrame(frame);
