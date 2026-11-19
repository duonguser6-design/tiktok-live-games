// True 3D renderer for the Sunrise Lake TikTok LIVE game (flagship only).
// ES module. THREE is injected, never imported here, so Node tests can pass
// a stub and the browser loads the vendored build (public/vendor/).
// No sound is created anywhere in this module; playback stays with the
// HTML elements in overlay.js. Nothing is loaded from outside this project
// at runtime.
//
// Stub surface (the minimal THREE surface this module uses):
//   WebGLRenderer({ canvas, alpha, antialias }) with setPixelRatio,
//   setSize, render(scene, camera), dispose, getContext
//   Scene with add(); PerspectiveCamera with position, lookAt()
//   Color with set(hex); Vector3 with set(); Matrix4 with makeTranslation()
//   Group / Mesh / Sprite with position, rotation, scale, visible, add()
//   BoxGeometry, CylinderGeometry, SphereGeometry, ConeGeometry,
//   PlaneGeometry, CircleGeometry, RingGeometry — each with dispose()
//   MeshBasicMaterial({ color, transparent, opacity }) with dispose()
//   SpriteMaterial({ map, transparent }); CanvasTexture(canvas) with dispose()
//   InstancedMesh(geometry, material, count) with setMatrixAt(i, matrix),
//   instanceMatrix.needsUpdate, and a settable count
//
// The scene runs fully automatically: ambient events on their timer, scene
// changes on the schedule, angler idle activity, water and light life.
// Nothing here waits for creator input. Effects triggered by a creator
// hotkey arrive as ordinary animations and take the same path as automatic
// ones; this module never distinguishes their origin.
//
// Inviting scene: chairs that are empty still show a rod leaning ready, so
// they read as waiting for someone. Seated anglers keep moving on slow
// idle loops (rod sway, bobber bob, an occasional cast and reel-in) even
// with no new commands, and the lake stays alive with zero spots: water
// moving, fish, ripples, birds, light changing with the time of day.
//
// The 3 fixed visual states are cumulative, persistent, and clearly
// different at a glance, with no labels, no toast, and no on-screen text:
//   cast  -> a visibly nicer rod (thicker, golden reel) + line in the water
//   bait  -> a glowing bobber + a bait bucket beside the chair
//   wave  -> a striped parasol over the chair
// Each differs from the base angler look and from the gift decorations
// (lantern, blossom, sun-hat, flag, fish-charm). When a state appears, the
// new item fades/scales in with a soft glow sweep; that visible moment is
// the whole announcement — no text accompanies it. The transient wave
// animation (an arm raising) stays the command's own literal effect and is
// separate from the persistent parasol.
//
// Photosensitivity: nothing oscillates faster than 3/second. Every periodic
// motion in this module has a period of at least 4.5 seconds; see
// OSCILLATION_PERIODS_S. One-shot eases (a cast, a transition) are single
// motions, never repeated blinks.
//
// No per-frame allocation in the hot loop: temp vectors, matrices, and
// colours are reused module-level objects.

// Default numbers, mirroring src/lake3d-config.js (the source of truth).
// The browser overlay passes the real imported config into
// createLakeRenderer and the pure helpers; these defaults only cover
// direct use and tests. A test pins them equal to the real config.
export const DEFAULT_CONFIG = Object.freeze({
  LAKE_3D: Object.freeze({
    MAX_ANGLERS: 16,
    MAX_SMALL_EFFECTS: 4,
    MAX_LARGE_EFFECTS: 1,
    EFFECT_QUEUE_CAP: 100,
    GIFT_SLOTS_PER_SPOT: 1,
    GIFT_DEFAULT: 'lantern',
    GIFT_MAPPED_TYPES: Object.freeze(['lantern', 'blossom', 'sun-hat', 'flag', 'fish-charm']),
    LIKE_MILESTONES: Object.freeze([50, 150, 300, 500, 800, 1200]),
    AMBIENT_MIN_MS: 6000,
    AMBIENT_MAX_MS: 10000,
    SCENES: Object.freeze(['sunrise', 'noon', 'sunset', 'starry']),
    SCENE_MS: 720000,
    SCENE_CROSSFADE_MS: 20000,
    BAIT_VOTE_OPTIONS: Object.freeze([
      Object.freeze({ id: 'worm', label: 'Worm', color: '#e07840' }),
      Object.freeze({ id: 'corn', label: 'Corn', color: '#ffd94a' }),
      Object.freeze({ id: 'berry', label: 'Berry', color: '#b06ab3' }),
    ]),
    BAIT_VOTE_DEFAULT: 'worm',
    TICKER_MAX_NAMES: 3,
    FLASH_MIN_PERIOD_S: 4.5,
  }),
  SCENE_PALETTES: Object.freeze({
    sunrise: Object.freeze({ skyTop: '#1d3a5f', skyBottom: '#f7b267', waterTop: '#3e7ca8', waterBottom: '#1d4e6b', sun: '#ffd97a' }),
    noon: Object.freeze({ skyTop: '#2f6da8', skyBottom: '#bfe3f2', waterTop: '#4a90c8', waterBottom: '#2a6a8a', sun: '#fff3b0' }),
    sunset: Object.freeze({ skyTop: '#3b2a4a', skyBottom: '#f78d5c', waterTop: '#7a4a6a', waterBottom: '#3a2a4a', sun: '#ff9a5c' }),
    starry: Object.freeze({ skyTop: '#070b1d', skyBottom: '#1c2a52', waterTop: '#131c38', waterBottom: '#0a0f24', sun: '#f4f1de' }),
  }),
  HOW_TO_PLAY: Object.freeze([
    Object.freeze({ command: '!cast', description: 'cast your line', cooldownSeconds: 8 }),
    Object.freeze({ command: '!bait', description: 'vote for bait', cooldownSeconds: 10 }),
    Object.freeze({ command: '!wave', description: 'wave', cooldownSeconds: 8 }),
    Object.freeze({ command: '!hide', description: 'hides your name', cooldownSeconds: 0 }),
  ]),
});

export const CANVAS_W = 1080;
export const CANVAS_H = 1920;
// Creator camera window: kept clear of all gameplay, in screen pixels.
export const CAMERA_WINDOW = Object.freeze({ x: 70, y: 70, w: 940, h: 540 });
export const PLAY_TOP = 720;
export const PLAY_BOTTOM = 1580;
export const MAX_ANGLERS = 16;
export const VISUAL_STATES = Object.freeze(['cast', 'bait', 'wave']);
export const GIFT_DECORATIONS = Object.freeze(['lantern', 'blossom', 'sun-hat', 'flag', 'fish-charm', 'bobber']);

// Every periodic motion in this module, in seconds. All are >= 4.5s by
// construction; the flashing test pins this list.
export const OSCILLATION_PERIODS_S = Object.freeze([
  Object.freeze({ name: 'water-sway', seconds: 6 }),
  Object.freeze({ name: 'bobber-bob', seconds: 5 }),
  Object.freeze({ name: 'rod-sway', seconds: 6 }),
  Object.freeze({ name: 'lantern-glow', seconds: 6 }),
  Object.freeze({ name: 'fish-swim', seconds: 8 }),
  Object.freeze({ name: 'bird-crossing', seconds: 12 }),
  Object.freeze({ name: 'dragonfly-drift', seconds: 9 }),
  Object.freeze({ name: 'camera-drift', seconds: 12 }),
  Object.freeze({ name: 'particle-drift', seconds: 10 }),
  Object.freeze({ name: 'ripple-ring', seconds: 6 }),
  Object.freeze({ name: 'sun-shimmer', seconds: 7 }),
]);

export function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}
export function lerp(a, b, t) {
  return a + (b - a) * t;
}
export function easeOutCubic(t) {
  const u = clamp(t, 0, 1);
  return 1 - (1 - u) ** 3;
}
export function easeInOut(t) {
  const u = clamp(t, 0, 1);
  return u < 0.5 ? 2 * u * u : 1 - ((-2 * u + 2) ** 2) / 2;
}
// Seeded RNG, copied from public/render.js (do not import render.js here).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function hexToRgb(hex) {
  const h = String(hex).replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}
function rgbToHex(r, g, b) {
  const c = (v) => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}
export function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t));
}

// --- Layout: 16 chairs in an arc around the near side of the lake. -------
// Screen pixels (1080x1920), for the static fallback painter and the
// layout tests. Chairs sit below the camera window and above the footer,
// spread along the lower half of an ellipse centred on the lake.
export function anglerPosition(slot) {
  const s = ((slot % MAX_ANGLERS) + MAX_ANGLERS) % MAX_ANGLERS;
  const angleDeg = 15 + (s / (MAX_ANGLERS - 1)) * 150;
  const angle = (angleDeg * Math.PI) / 180;
  const x = Math.round(540 + 430 * Math.cos(angle));
  const y = Math.round(1060 + 400 * Math.sin(angle));
  return { slot: s, x, y, angle };
}
export function chairLayout() {
  const out = [];
  for (let slot = 0; slot < MAX_ANGLERS; slot += 1) out.push(anglerPosition(slot));
  return out;
}
// World-space position for the 3D scene (metres-ish, y = 0 is the shore).
export function anglerWorldPosition(slot) {
  const p = anglerPosition(slot);
  return { slot: p.slot, x: (p.x - 540) / 60, y: 0, z: (p.y - 1060) / 55, angle: p.angle };
}

// --- Scene schedule: colour at a moment in the 12-minute day cycle. ------
// sceneIndex: index into SCENES. elapsedMs: ms since the scene started.
// Inside the last SCENE_CROSSFADE_MS the palette blends toward the next
// scene; reduced motion makes it an instant cut at the boundary instead.
export function sceneColorsAt(config, sceneIndex, elapsedMs, reducedMotion = false) {
  const cfg = config || DEFAULT_CONFIG;
  const scenes = cfg.LAKE_3D.SCENES;
  const sceneMs = cfg.LAKE_3D.SCENE_MS;
  const fadeMs = cfg.LAKE_3D.SCENE_CROSSFADE_MS;
  const idx = ((Math.floor(sceneIndex) % scenes.length) + scenes.length) % scenes.length;
  const nextIdx = (idx + 1) % scenes.length;
  const sceneId = scenes[idx];
  const nextSceneId = scenes[nextIdx];
  const elapsed = Math.max(0, Number(elapsedMs) || 0);
  const blend = reducedMotion
    ? 0
    : clamp((elapsed - (sceneMs - fadeMs)) / fadeMs, 0, 1);
  const from = cfg.SCENE_PALETTES[sceneId];
  const to = cfg.SCENE_PALETTES[nextSceneId];
  return {
    sceneId,
    nextSceneId,
    blend,
    skyTop: mixHex(from.skyTop, to.skyTop, blend),
    skyBottom: mixHex(from.skyBottom, to.skyBottom, blend),
    waterTop: mixHex(from.waterTop, to.waterTop, blend),
    waterBottom: mixHex(from.waterBottom, to.waterBottom, blend),
    sun: mixHex(from.sun, to.sun, blend),
  };
}

// Bobber / lantern colour follows the current bait-vote result.
export function baitColorFor(optionId, config = DEFAULT_CONFIG) {
  const options = config.LAKE_3D.BAIT_VOTE_OPTIONS;
  const found = options.find((o) => o.id === optionId);
  if (found) return found.color;
  const fallback = options.find((o) => o.id === config.LAKE_3D.BAIT_VOTE_DEFAULT);
  return fallback ? fallback.color : '#e07840';
}

// --- Ambient events: one visible event every 8s on average (6-10s). ------
export const AMBIENT_TYPES = Object.freeze(['fish-jump', 'ripple', 'bird', 'dragonfly']);
export function createAmbientScheduler(seed = 20261119, options = {}) {
  const reducedMotion = !!options.reducedMotion;
  const cfg = options.config || DEFAULT_CONFIG;
  const minMs = cfg.LAKE_3D.AMBIENT_MIN_MS;
  const maxMs = cfg.LAKE_3D.AMBIENT_MAX_MS;
  const rand = mulberry32(seed);
  function nextGapMs() {
    const gap = minMs + rand() * (maxMs - minMs);
    return reducedMotion ? Math.round(gap * 1.5) : Math.round(gap);
  }
  function pickType() {
    if (reducedMotion) return rand() < 0.5 ? 'ripple' : 'fish-jump';
    return AMBIENT_TYPES[Math.floor(rand() * AMBIENT_TYPES.length)];
  }
  return {
    nextGapMs,
    pickType,
    nextEvent(afterMs = 0) {
      return { atMs: afterMs + nextGapMs(), type: pickType() };
    },
    schedule(count, startMs = 0) {
      const out = [];
      let t = startMs;
      for (let i = 0; i < count; i += 1) {
        const e = this.nextEvent(t);
        out.push(e);
        t = e.atMs;
      }
      return out;
    },
  };
}

// --- Effect caps: renderer-side queue for animation kinds. ---------------
export function effectCategoryForKind(kind) {
  switch (kind) {
    case 'follow':
    case 'command':
    case 'meter-stage':
    case 'toast':
      return 'small';
    case 'gift':
    case 'gift-scene':
      return 'gift';
    case 'school':
    case 'finale':
      return 'large';
    case 'ticker':
      return 'dom'; // rendered in the DOM HUD strip, not in 3D
    default:
      return null; // unknown kinds are ignored
  }
}
export function effectDurationForKind(kind) {
  if (kind === 'school') return 4000;
  if (kind === 'finale') return 6000;
  return 2000;
}
export function createEffectManager(config = DEFAULT_CONFIG) {
  const caps = {
    small: config.LAKE_3D.MAX_SMALL_EFFECTS,
    large: config.LAKE_3D.MAX_LARGE_EFFECTS,
    gift: 1,
  };
  const queueCap = config.LAKE_3D.EFFECT_QUEUE_CAP;
  let seq = 0;
  const active = new Map(); // id -> effect
  const queue = [];
  let dropped = 0;
  function activeCount(category) {
    let n = 0;
    for (const e of active.values()) if (e.category === category) n += 1;
    return n;
  }
  function promote(category, nowMs) {
    const idx = queue.findIndex((e) => e.category === category);
    if (idx < 0) return;
    const [effect] = queue.splice(idx, 1);
    effect.startedAt = nowMs;
    active.set(effect.id, effect);
  }
  return {
    enqueue(kind, data = {}) {
      const category = effectCategoryForKind(kind);
      if (!category || category === 'dom') return { status: 'ignored', category };
      const effect = {
        id: seq + 1,
        kind,
        category,
        slot: data.slot ?? null,
        displayName: data.displayName || '',
        effect: data.effect || '',
        startedAt: data.startedAt ?? 0,
        duration: data.duration ?? effectDurationForKind(kind),
      };
      seq = effect.id;
      if (activeCount(category) < caps[category]) {
        active.set(effect.id, effect);
        return { status: 'active', effect };
      }
      queue.push(effect);
      while (queue.length > queueCap) {
        queue.shift();
        dropped += 1;
      }
      return { status: 'queued', effect };
    },
    complete(id, nowMs = 0) {
      const effect = active.get(id);
      if (!effect) return false;
      active.delete(id);
      promote(effect.category, nowMs);
      return true;
    },
    tick(nowMs) {
      for (const effect of [...active.values()]) {
        if (nowMs >= effect.startedAt + effect.duration) this.complete(effect.id, nowMs);
      }
    },
    activeEffects() {
      return [...active.values()];
    },
    queuedEffects() {
      return [...queue];
    },
    activeCount,
    queueLength() {
      return queue.length;
    },
    droppedCount() {
      return dropped;
    },
    counts() {
      return {
        small: activeCount('small'),
        large: activeCount('large'),
        gift: activeCount('gift'),
        queued: queue.length,
        dropped,
      };
    },
  };
}

// --- Quality tiers: frame-time EMA steps down, then back up. -------------
export function createQualityTracker() {
  let ema = 33;
  let tier = 0; // 0 high, 1 medium, 2 low
  return {
    get tier() {
      return tier;
    },
    get ema() {
      return ema;
    },
    note(dtMs) {
      const dt = clamp(Number(dtMs) || 33, 1, 500);
      ema = ema * 0.9 + dt * 0.1;
      if (ema > 45 && tier < 2) tier += 1;
      else if (ema < 18 && tier > 0) tier -= 1;
      return tier;
    },
    reset() {
      ema = 33;
      tier = 0;
    },
  };
}
export const FISH_PER_TIER = Object.freeze([24, 14, 7]);
export const PARTICLES_PER_TIER = Object.freeze([60, 36, 18]);

// --- Meter fill (fill only: no numbers, no counts, no urging). ------------
export function meterFillFraction(meter) {
  if (!meter || typeof meter !== 'object') return 0;
  const cycle = meter.cycle && typeof meter.cycle === 'object' ? meter.cycle : null;
  const milestones = cycle?.milestones ?? meter.thresholds ?? DEFAULT_CONFIG.LAKE_3D.LIKE_MILESTONES;
  const hit = cycle?.hit ?? meter.hit ?? [];
  const total = cycle?.total ?? meter.total ?? 0;
  if (cycle?.resting) return 1;
  const hitCount = Array.isArray(hit) ? hit.length : 0;
  if (hitCount >= milestones.length) return 1;
  const prev = hitCount === 0 ? 0 : milestones[hitCount - 1];
  const next = milestones[hitCount];
  if (!(next > prev)) return 1;
  return clamp((total - prev) / (next - prev), 0, 1);
}

// --- Thank-you wording: pure thank-you + name only. -----------------------
// No promise, no wishful phrasing, no luck / fortune / destiny / universe
// language tied to a viewer's actions. The ticker shows names only, with
// a plain thank-you in front; toasts use the server's text when it sends
// one, otherwise a plain thank-you with the name.
export function tickerText(names) {
  const list = (Array.isArray(names) ? names : []).filter(Boolean).slice(0, 3);
  if (list.length === 0) return '';
  return `Thank you · ${list.join(' · ')}`;
}
export function toastText(animation) {
  if (!animation || typeof animation !== 'object') return '';
  if (typeof animation.text === 'string' && animation.text.trim()) return animation.text;
  if (animation.displayName) return `Thank you, ${animation.displayName}`;
  return 'Thank you';
}

// --- HOW TO PLAY board data: pure literal descriptions, nothing more. -----
// The text for each line is built exactly like howToPlayText() in
// lake3d-config.js; a test pins the two equal. No line suggests that
// interacting helps the viewer in any way.
export const HOW_TO_PLAY_ICONS = Object.freeze({
  '!cast': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 20 L15 7"/><circle cx="17" cy="5" r="2.6"/><path d="M15 7 Q18 12 18 18"/></svg>',
  '!bait': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="13" r="7.5"/><path d="M4.5 13 h15"/><path d="M12 5.5 v-2.5"/></svg>',
  '!wave': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M3 8 q2.5 -3 5 0 t5 0 5 0"/><path d="M3 13 q2.5 -3 5 0 t5 0 5 0"/><path d="M3 18 q2.5 -3 5 0 t5 0 5 0"/></svg>',
  '!hide': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M2 12 s3.5 -6 10 -6 10 6 10 6 -3.5 6 -10 6 -10 -6 -10 -6 z"/><circle cx="12" cy="12" r="2.6"/><path d="M4 4 L20 20"/></svg>',
});
export function howToPlayBoardData(lines = DEFAULT_CONFIG.HOW_TO_PLAY) {
  return lines.map((line) => {
    const cooldown = line.cooldownSeconds > 0
      ? `${line.cooldownSeconds}s cooldown`
      : 'no cooldown';
    return {
      command: line.command,
      description: line.description,
      cooldownSeconds: line.cooldownSeconds,
      text: `${line.command}: ${line.description} (${cooldown})`,
      icon: HOW_TO_PLAY_ICONS[line.command] || '',
    };
  });
}

// --- WebGL availability probe (no renderer is created here). --------------
export function webglAvailable(canvas) {
  if (!canvas || typeof canvas.getContext !== 'function') return false;
  try {
    return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

// --- The 3D renderer ------------------------------------------------------
// Reused temp objects: the hot loop allocates nothing per frame.
const _tmpMatrix = { current: null }; // set once THREE arrives (Matrix4)
const _tmpColor = { current: null }; // set once THREE arrives (Color)
const _tmpVec = { current: null }; // set once THREE arrives (Vector3)

const SHIRT_COLORS = ['#3f6d8e', '#a34a3a', '#5d9a52', '#c9a7ff', '#e8b23e', '#7fb7e8'];
const SKIN_COLOR = '#f2c89b';
const HAT_COLOR = '#e8b23e';
const WOOD_COLOR = '#7a5230';
const WOOD_DARK = '#5d3a22';
const GOLD_COLOR = '#ffd94a';
const PARASOL_A = '#ff8c66';
const PARASOL_B = '#f4f1de';

function track(disposables, obj) {
  if (obj && typeof obj.dispose === 'function') disposables.add(obj);
  return obj;
}

export function createLakeRenderer(options = {}) {
  const THREE = options.THREE;
  const canvas = options.canvas;
  const config = options.config || DEFAULT_CONFIG;
  if (!THREE) throw new Error('3D renderer needs THREE (injected)');
  if (!canvas) throw new Error('3D renderer needs a canvas');
  if (!webglAvailable(canvas)) throw new Error('WebGL unavailable');

  const reducedMotionState = { value: !!options.reducedMotion };
  const onContextLost = typeof options.onContextLost === 'function' ? options.onContextLost : null;
  const onContextRestored = typeof options.onContextRestored === 'function' ? options.onContextRestored : null;

  const disposables = new Set();
  const materialCache = new Map();
  const geometryCache = new Map();
  let disposed = false;
  let contextLost = false;
  let renderer = null;
  let scene = null;
  let camera = null;
  let skyMat = null;
  let waterMat = null;
  let groundMat = null;
  let sunMesh = null;
  let starsMesh = null;
  let waterMesh = null;
  let fishMesh = null;
  let schoolMesh = null;
  let particleMesh = null;
  let reedMesh = null;
  let finaleWash = null;
  let giftGlow = null;

  const quality = createQualityTracker();
  const effects = createEffectManager(config);
  const ambient = createAmbientScheduler(options.seed ?? 20261119, {
    reducedMotion: reducedMotionState.value, config,
  });
  const seenAnimations = new Map(); // animation object -> effect id
  const ripplePool = []; // { mesh, active, startedAt, x, z }
  const birds = []; // { group, wingL, wingR, active, startedAt, fromX }
  let dragonfly = null;
  let particleSeeds = []; // precomputed once: no per-frame allocation
  let nextAmbient = null;
  let ambientFired = 0;
  let lastFrameMs = 0;
  let lastInfo = null;
  let frozenMs = null; // while paused, motion time stands still
  let currentScene = { sceneId: config.LAKE_3D.SCENES[0], blend: 0 };
  let baitOption = config.LAKE_3D.BAIT_VOTE_DEFAULT;
  let lastSnapshot = null;
  const anglers = []; // per slot: { group, figure, nameSprite, ... }
  const transitions = []; // { slot, state, startedAt, item, sweep }

  function mat(color, opts = {}) {
    const key = `${color}|${opts.transparent ? 1 : 0}|${opts.opacity ?? 1}`;
    let m = materialCache.get(key);
    if (!m) {
      m = new THREE.MeshBasicMaterial({ color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1 });
      materialCache.set(key, m);
      track(disposables, m);
    }
    return m;
  }
  function geo(kind, maker) {
    let g = geometryCache.get(kind);
    if (!g) {
      g = maker();
      geometryCache.set(kind, g);
      track(disposables, g);
    }
    return g;
  }
  function box(w, h, d) {
    return geo(`box:${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d));
  }
  function cyl(rt, rb, h, seg = 10) {
    return geo(`cyl:${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg));
  }
  function sph(r, w = 12, h = 10) {
    return geo(`sph:${r},${w},${h}`, () => new THREE.SphereGeometry(r, w, h));
  }
  function cone(r, h, seg = 12) {
    return geo(`cone:${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg));
  }
  function mesh(geometry, material) {
    return new THREE.Mesh(geometry, material);
  }
  function place(obj, x, y, z) {
    obj.position.set(x, y, z);
    return obj;
  }

  // A name sprite above an angler. In Node (no document) this returns a
  // lightweight record carrying the name, so tests can assert presence
  // without a canvas. Hidden spots (displayName '') get no sprite at all.
  function makeNameSprite(name) {
    if (typeof document === 'undefined') {
      return { isNameSprite: true, name, dispose() {} };
    }
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = 'rgba(12, 24, 38, 0.72)';
    g.beginPath();
    g.roundRect(6, 6, 244, 52, 26);
    g.fill();
    g.fillStyle = '#ffffff';
    g.font = '600 28px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    let label = name;
    while (g.measureText(label).width > 220 && label.length > 4) label = label.slice(0, -2);
    if (label !== name) label += '…';
    g.fillText(label, 128, 34);
    const tex = new THREE.CanvasTexture(c);
    track(disposables, tex);
    if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
    const spriteMat = new THREE.SpriteMaterial({ map: tex, transparent: true });
    track(disposables, spriteMat);
    const sprite = new THREE.Sprite(spriteMat);
    sprite.userData.spriteTex = tex;
    sprite.userData.spriteMat = spriteMat;
    sprite.scale.set(2.4, 0.6, 1);
    return sprite;
  }

  function buildDecorationMesh(kind) {
    const group = new THREE.Group();
    const id = GIFT_DECORATIONS.includes(kind) ? kind : config.LAKE_3D.GIFT_DEFAULT;
    if (id === 'lantern') {
      const body = mesh(box(0.22, 0.3, 0.22), mat('#e8b23e'));
      place(body, 0, 0.15, 0);
      const glow = mesh(sph(0.12), mat('#ffd97a', { transparent: true, opacity: 0.85 }));
      place(glow, 0, 0.15, 0);
      group.add(body, glow);
    } else if (id === 'blossom') {
      for (let i = 0; i < 5; i += 1) {
        const a = (Math.PI * 2 * i) / 5;
        const petal = mesh(sph(0.09), mat('#ff9ebb'));
        place(petal, Math.cos(a) * 0.14, 0.1, Math.sin(a) * 0.14);
        group.add(petal);
      }
      const centre = mesh(sph(0.08), mat('#ffd97a'));
      place(centre, 0, 0.12, 0);
      group.add(centre);
    } else if (id === 'sun-hat') {
      const brim = mesh(cyl(0.26, 0.26, 0.04, 12), mat('#e8b23e'));
      place(brim, 0, 0.1, 0);
      const top = mesh(cyl(0.12, 0.16, 0.14, 12), mat('#e8b23e'));
      place(top, 0, 0.18, 0);
      group.add(brim, top);
    } else if (id === 'flag') {
      const pole = mesh(cyl(0.02, 0.02, 0.6, 6), mat(WOOD_DARK));
      place(pole, 0, 0.3, 0);
      const cloth = mesh(box(0.34, 0.2, 0.02), mat('#ff8c66'));
      place(cloth, 0.18, 0.48, 0);
      group.add(pole, cloth);
    } else if (id === 'fish-charm') {
      const body = mesh(sph(0.16), mat('#7fb7e8'));
      body.scale.set(1.4, 0.7, 0.7);
      place(body, 0, 0.12, 0);
      const tail = mesh(cone(0.1, 0.2, 6), mat('#7fb7e8'));
      tail.rotation.z = -Math.PI / 2;
      place(tail, -0.3, 0.12, 0);
      group.add(body, tail);
    } else { // bobber
      const top = mesh(sph(0.11), mat('#ff6b6b'));
      place(top, 0, 0.16, 0);
      const bottom = mesh(sph(0.11), mat('#f4f1de'));
      place(bottom, 0, 0.05, 0);
      group.add(top, bottom);
    }
    return group;
  }

  function buildAngler(slot) {
    const world = anglerWorldPosition(slot);
    const group = new THREE.Group();
    place(group, world.x, 0, world.z);
    group.rotation.y = Math.PI + world.angle * 0.3;

    // Chair: seat + back + legs. Always present, occupied or not.
    const chair = new THREE.Group();
    const seat = mesh(box(0.95, 0.12, 0.9), mat(WOOD_COLOR));
    place(seat, 0, 0.45, 0);
    const back = mesh(box(0.95, 0.7, 0.1), mat(WOOD_COLOR));
    place(back, 0, 0.85, 0.48);
    const legL = mesh(cyl(0.05, 0.05, 0.45, 6), mat(WOOD_DARK));
    place(legL, -0.38, 0.22, -0.32);
    const legR = mesh(cyl(0.05, 0.05, 0.45, 6), mat(WOOD_DARK));
    place(legR, 0.38, 0.22, -0.32);
    chair.add(seat, back, legL, legR);
    group.add(chair);

    // A rod leaning on the chair, ready: empty chairs read as waiting
    // for someone to sit down, not as bare furniture.
    const readyRod = mesh(cyl(0.025, 0.025, 1.7, 6), mat(WOOD_DARK));
    place(readyRod, 0.55, 0.85, -0.2);
    readyRod.rotation.z = -0.35;
    group.add(readyRod);

    // Angler figure, built from primitives; hidden while the chair is empty.
    const figure = new THREE.Group();
    const shirt = SHIRT_COLORS[slot % SHIRT_COLORS.length];
    const body = mesh(cyl(0.26, 0.32, 0.7, 10), mat(shirt));
    place(body, 0, 0.85, 0);
    const head = mesh(sph(0.22), mat(SKIN_COLOR));
    place(head, 0, 1.38, 0);
    const hatTop = mesh(cone(0.3, 0.26, 12), mat(HAT_COLOR));
    place(hatTop, 0, 1.58, 0);
    const hatBrim = mesh(cyl(0.34, 0.34, 0.04, 12), mat(HAT_COLOR));
    place(hatBrim, 0, 1.48, 0);
    const arm = mesh(cyl(0.06, 0.06, 0.6, 6), mat(SKIN_COLOR));
    place(arm, 0.34, 1.05, -0.15);
    arm.rotation.z = -0.7;
    figure.add(body, head, hatTop, hatBrim, arm);

    // Basic rod, held toward the water.
    const rod = mesh(cyl(0.03, 0.03, 1.7, 6), mat(WOOD_DARK));
    place(rod, 0.45, 1.15, -0.35);
    rod.rotation.x = -0.9;
    rod.rotation.z = -0.25;
    // Nicer rod for the cast state: thicker, with a golden reel.
    const fancyRod = new THREE.Group();
    const fancyShaft = mesh(cyl(0.055, 0.055, 1.8, 8), mat('#8a5a33'));
    place(fancyShaft, 0, 0, 0);
    const reel = mesh(cyl(0.11, 0.11, 0.08, 10), mat(GOLD_COLOR));
    reel.rotation.z = Math.PI / 2;
    place(reel, 0, -0.3, 0.12);
    fancyRod.add(fancyShaft, reel);
    place(fancyRod, 0.45, 1.15, -0.35);
    fancyRod.rotation.x = -0.9;
    fancyRod.rotation.z = -0.25;
    fancyRod.visible = false;
    // Line from the rod tip down to the water (cast state).
    const line = mesh(cyl(0.008, 0.008, 1.5, 4), mat('#f4f1de', { transparent: true, opacity: 0.7 }));
    place(line, 0.55, 0.45, -0.95);
    line.rotation.x = 0.35;
    line.visible = false;
    // Bobber on the water; its colour follows the bait-vote result.
    const bobber = mesh(sph(0.09), mat(baitColorFor(baitOption, config)));
    place(bobber, 0.55, 0.06, -1.15);
    const bobberGlow = mesh(sph(0.16), mat(baitColorFor(baitOption, config), { transparent: true, opacity: 0.45 }));
    place(bobberGlow, 0.55, 0.06, -1.15);
    bobberGlow.visible = false;
    // Bait bucket beside the chair (bait state).
    const bucket = new THREE.Group();
    const bucketBody = mesh(cyl(0.16, 0.12, 0.24, 10), mat('#6b4a2a'));
    place(bucketBody, 0, 0.12, 0);
    const bucketTop = mesh(cyl(0.15, 0.15, 0.03, 10), mat('#3e7ca8'));
    place(bucketTop, 0, 0.25, 0);
    bucket.add(bucketBody, bucketTop);
    place(bucket, -0.62, 0, -0.35);
    bucket.visible = false;
    // Striped parasol over the chair (wave state): pole, coral canopy,
    // and a wider cream rim band so it reads striped at a glance.
    const parasol = new THREE.Group();
    const pole = mesh(cyl(0.03, 0.03, 1.6, 6), mat(WOOD_DARK));
    place(pole, 0, 1.5, 0.35);
    const canopy = mesh(cone(0.85, 0.5, 12), mat(PARASOL_A));
    place(canopy, 0, 2.35, 0.35);
    const rim = mesh(cone(0.95, 0.16, 12), mat(PARASOL_B));
    place(rim, 0, 2.18, 0.35);
    parasol.add(pole, canopy, rim);
    parasol.visible = false;

    figure.add(rod, fancyRod, line, bobber, bobberGlow, bucket, parasol);
    figure.visible = false;
    group.add(figure);

    // Gift decoration (at most one) sits beside the chair.
    const decorationSlot = new THREE.Group();
    place(decorationSlot, 0.75, 0, 0.35);
    group.add(decorationSlot);

    // Glow sweep shown when a visual state appears: a ring that grows
    // and fades once. No text, no badge — the item itself is the change.
    const sweep = mesh(
      new THREE.RingGeometry(0.3, 0.38, 24),
      new THREE.MeshBasicMaterial({ color: '#ffd97a', transparent: true, opacity: 0 }),
    );
    track(disposables, sweep.geometry);
    track(disposables, sweep.material);
    sweep.rotation.x = -Math.PI / 2;
    place(sweep, 0, 0.06, 0);
    sweep.visible = false;
    group.add(sweep);

    scene.add(group);
    return {
      slot, group, chair, readyRod, figure, arm, rod, fancyRod, line,
      bobber, bobberGlow, bucket, parasol, decorationSlot, sweep,
      nameSprite: null, nameSpriteName: '',
      decoration: null, decorationMesh: null,
      visualStates: [], displayName: '', occupied: false,
      phase: (hashStr(`slot:${slot}`) % 1000) / 1000,
    };
  }

  function build() {
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'low-power' });
    renderer.setPixelRatio(1);
    renderer.setSize(CANVAS_W, CANVAS_H, false);
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(42, CANVAS_W / CANVAS_H, 0.1, 100);
    place(camera, 0, 13, 15);
    camera.lookAt(0, 0, -1);

    _tmpMatrix.current = new THREE.Matrix4();
    _tmpColor.current = new THREE.Color('#ffffff');
    _tmpVec.current = new THREE.Vector3(0, 0, -1);

    const palette = sceneColorsAt(config, 0, 0, false);
    skyMat = mat(palette.skyTop);
    scene.background = new THREE.Color(palette.skyTop);
    track(disposables, scene.background);

    // Ground (shore) + water.
    groundMat = mat(palette.waterBottom);
    const ground = mesh(new THREE.PlaneGeometry(26, 18), groundMat);
    track(disposables, ground.geometry);
    ground.rotation.x = -Math.PI / 2;
    place(ground, 0, -0.06, 0);
    scene.add(ground);
    waterMat = mat(palette.waterTop, { transparent: true, opacity: 0.92 });
    waterMesh = mesh(new THREE.PlaneGeometry(19, 13), waterMat);
    track(disposables, waterMesh.geometry);
    waterMesh.rotation.x = -Math.PI / 2;
    place(waterMesh, 0, 0, -0.5);
    scene.add(waterMesh);

    // Sun / moon disc, drifting slowly with the scene.
    sunMesh = mesh(new THREE.CircleGeometry(1.1, 24), mat(palette.sun));
    track(disposables, sunMesh.geometry);
    place(sunMesh, 6.5, 7.5, -8);
    scene.add(sunMesh);

    // Stars: only visible in the starry scene.
    const starGeo = sph(0.06, 6, 5);
    starsMesh = new THREE.InstancedMesh(starGeo, mat('#ffffff'), 40);
    track(disposables, starsMesh);
    const rand = mulberry32(77);
    for (let i = 0; i < 40; i += 1) {
      _tmpMatrix.current.makeTranslation(-9 + rand() * 18, 4 + rand() * 7, -8);
      starsMesh.setMatrixAt(i, _tmpMatrix.current);
    }
    starsMesh.visible = false;
    scene.add(starsMesh);

    // Reeds along the near shore (instanced, static).
    const reedGeo = cyl(0.03, 0.05, 1.4, 5);
    reedMesh = new THREE.InstancedMesh(reedGeo, mat('#2e5d43'), 24);
    track(disposables, reedMesh);
    for (let i = 0; i < 24; i += 1) {
      const side = i % 2 === 0 ? -1 : 1;
      _tmpMatrix.current.makeTranslation(side * (7.5 + (i % 6) * 0.5), 0.7, 6.5 - (i % 4) * 0.4);
      reedMesh.setMatrixAt(i, _tmpMatrix.current);
    }
    scene.add(reedMesh);

    // Fish: instanced, swimming slow ellipses on the water.
    const fishGeo = sph(0.22, 8, 6);
    fishGeo.scale(1.6, 0.6, 0.7);
    fishMesh = new THREE.InstancedMesh(fishGeo, mat('#7fb7e8'), FISH_PER_TIER[0]);
    track(disposables, fishMesh);
    scene.add(fishMesh);
    // School fish for the large school effect.
    schoolMesh = new THREE.InstancedMesh(fishGeo, mat('#ffd97a'), 8);
    track(disposables, schoolMesh);
    schoolMesh.visible = false;
    scene.add(schoolMesh);

    // Drifting light particles (instanced dots). Seeds are fixed at
    // build time so the hot loop allocates nothing per frame.
    particleMesh = new THREE.InstancedMesh(sph(0.05, 6, 5), mat('#fff6d8', { transparent: true, opacity: 0.8 }), PARTICLES_PER_TIER[0]);
    track(disposables, particleMesh);
    scene.add(particleMesh);
    {
      const seedRand = mulberry32(5150);
      particleSeeds = [];
      for (let i = 0; i < PARTICLES_PER_TIER[0]; i += 1) {
        particleSeeds.push({
          x: (seedRand() * 2 - 1) * 8,
          y: 0.5 + seedRand() * 6,
          z: (seedRand() * 2 - 1) * 6,
          phase: seedRand() * Math.PI * 2,
        });
      }
    }

    // Ripple ring pool (small effects + ambient ripples).
    for (let i = 0; i < 6; i += 1) {
      const ringGeo = new THREE.RingGeometry(0.28, 0.36, 24);
      track(disposables, ringGeo);
      const ringMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0 });
      track(disposables, ringMat);
      const ring = mesh(ringGeo, ringMat);
      ring.rotation.x = -Math.PI / 2;
      ring.visible = false;
      scene.add(ring);
      ripplePool.push({ mesh: ring, active: false, startedAt: 0, x: 0, z: 0 });
    }

    // Birds: two simple two-wing figures crossing the sky.
    for (let b = 0; b < 2; b += 1) {
      const group = new THREE.Group();
      const wingL = mesh(box(0.5, 0.04, 0.16), mat('#3b2a20'));
      place(wingL, -0.28, 0, 0);
      const wingR = mesh(box(0.5, 0.04, 0.16), mat('#3b2a20'));
      place(wingR, 0.28, 0, 0);
      group.add(wingL, wingR);
      group.visible = false;
      scene.add(group);
      birds.push({ group, wingL, wingR, active: false, startedAt: 0, fromX: -10 });
    }

    // Dragonfly: body + two wings, wandering on a slow path.
    {
      const group = new THREE.Group();
      const body = mesh(cyl(0.03, 0.03, 0.5, 6), mat('#5d9a52'));
      body.rotation.z = Math.PI / 2;
      const w1 = mesh(box(0.34, 0.02, 0.14), mat('#d8f26a', { transparent: true, opacity: 0.7 }));
      place(w1, 0, 0.06, 0.14);
      const w2 = mesh(box(0.34, 0.02, 0.14), mat('#d8f26a', { transparent: true, opacity: 0.7 }));
      place(w2, 0, 0.06, -0.14);
      group.add(body, w1, w2);
      group.visible = false;
      scene.add(group);
      dragonfly = { group, active: false, startedAt: 0 };
    }

    // Finale wash: a full-scene golden veil, faded in and out once.
    const washGeo = new THREE.PlaneGeometry(20, 14);
    track(disposables, washGeo);
    const washMat = new THREE.MeshBasicMaterial({ color: '#ffd97a', transparent: true, opacity: 0 });
    track(disposables, washMat);
    finaleWash = mesh(washGeo, washMat);
    place(finaleWash, 0, 6, -4);
    finaleWash.visible = false;
    scene.add(finaleWash);

    // Gift shimmer glow at an angler.
    giftGlow = mesh(sph(0.5), mat('#ffd97a', { transparent: true, opacity: 0 }));
    giftGlow.visible = false;
    scene.add(giftGlow);

    for (let slot = 0; slot < MAX_ANGLERS; slot += 1) {
      anglers.push(buildAngler(slot));
    }
    nextAmbient = ambient.nextEvent(0);
  }

  function onLost(event) {
    if (event && typeof event.preventDefault === 'function') event.preventDefault();
    contextLost = true;
    if (onContextLost) onContextLost();
  }
  function onRestored() {
    contextLost = false;
    try {
      disposeScene();
      build();
      if (lastSnapshot) syncSnapshot(lastSnapshot, lastFrameMs || 0);
      if (onContextRestored) onContextRestored();
    } catch {
      if (onContextLost) onContextLost();
    }
  }
  if (canvas && typeof canvas.addEventListener === 'function') {
    canvas.addEventListener('webglcontextlost', onLost);
    canvas.addEventListener('webglcontextrestored', onRestored);
  }

  function disposeScene() {
    if (renderer) {
      try { renderer.dispose(); } catch { /* ignore */ }
      renderer = null;
    }
    for (const obj of disposables) {
      try { obj.dispose(); } catch { /* ignore */ }
    }
    disposables.clear();
    materialCache.clear();
    geometryCache.clear();
    anglers.length = 0;
    ripplePool.length = 0;
    birds.length = 0;
    dragonfly = null;
    transitions.length = 0;
    seenAnimations.clear();
    scene = null;
    camera = null;
  }

  function dispose() {
    if (disposed) return;
    disposed = true;
    if (canvas && typeof canvas.removeEventListener === 'function') {
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
    }
    disposeScene();
  }

  function setReducedMotion(flag) {
    reducedMotionState.value = !!flag;
  }

  function setNameSprite(angler, displayName) {
    if (angler.nameSpriteName === displayName) return;
    if (angler.nameSprite) {
      const old = angler.nameSprite;
      if (old.userData) {
        for (const key of ['spriteTex', 'spriteMat']) {
          const res = old.userData[key];
          if (res && typeof res.dispose === 'function') {
            try { res.dispose(); } catch { /* ignore */ }
          }
        }
      }
      if (old.isNameSprite !== true) {
        const idx = angler.group.children.indexOf(old);
        if (idx >= 0) angler.group.children.splice(idx, 1);
      }
    }
    angler.nameSprite = null;
    angler.nameSpriteName = '';
    if (!displayName) return;
    const sprite = makeNameSprite(displayName);
    angler.nameSprite = sprite;
    angler.nameSpriteName = displayName;
    if (sprite && sprite.isNameSprite !== true) {
      place(sprite, 0, 2.2, 0);
      angler.group.add(sprite);
    }
  }

  function setDecoration(angler, decorationId) {
    const wanted = decorationId && GIFT_DECORATIONS.includes(decorationId)
      ? decorationId
      : (decorationId ? config.LAKE_3D.GIFT_DEFAULT : null);
    if (angler.decoration === wanted) return;
    if (angler.decorationMesh) {
      const idx = angler.decorationSlot.children.indexOf(angler.decorationMesh);
      if (idx >= 0) angler.decorationSlot.children.splice(idx, 1);
      angler.decorationMesh = null;
    }
    angler.decoration = wanted;
    if (!wanted) return;
    const deco = buildDecorationMesh(wanted);
    angler.decorationSlot.add(deco);
    angler.decorationMesh = deco;
  }

  // Apply one visual state's persistent items, and start the gentle
  // visible transition (glow sweep + item fading/scaling in) when the
  // state is newly present. No text, no toast, no badge.
  function applyVisualState(angler, state, nowMs, isNew) {
    let item = null;
    if (state === 'cast') {
      angler.fancyRod.visible = true;
      angler.rod.visible = false;
      angler.line.visible = true;
      item = angler.fancyRod;
    } else if (state === 'bait') {
      angler.bobberGlow.visible = true;
      angler.bucket.visible = true;
      item = angler.bucket;
    } else if (state === 'wave') {
      angler.parasol.visible = true;
      item = angler.parasol;
    }
    if (isNew && item) {
      if (reducedMotionState.value) {
        item.scale.set(1, 1, 1);
      } else {
        item.scale.set(0.6, 0.6, 0.6);
        angler.sweep.visible = true;
        angler.sweep.material.opacity = 0.5;
        angler.sweep.scale.set(0.5, 0.5, 0.5);
      }
      transitions.push({ slot: angler.slot, state, startedAt: nowMs, item, sweep: angler.sweep });
    }
  }

  function syncSnapshot(snapshot, nowMs) {
    if (!snapshot || typeof snapshot !== 'object') return;
    lastSnapshot = snapshot;
    const spots = Array.isArray(snapshot.spots) ? snapshot.spots : [];
    const bySlot = new Map();
    for (const spot of spots) {
      if (spot && Number.isInteger(spot.slot)) bySlot.set(spot.slot, spot);
    }
    const sceneInfo = snapshot.scene && typeof snapshot.scene === 'object' ? snapshot.scene : {};
    const sceneIndex = Number.isInteger(sceneInfo.index)
      ? sceneInfo.index
      : Math.floor(nowMs / config.LAKE_3D.SCENE_MS) % config.LAKE_3D.SCENES.length;
    const startedAt = Number.isFinite(sceneInfo.startedAt) ? sceneInfo.startedAt : nowMs;
    const elapsed = Math.max(0, nowMs - startedAt);
    currentScene = sceneColorsAt(config, sceneIndex, elapsed, reducedMotionState.value);
    baitOption = (snapshot.baitVote && snapshot.baitVote.option) || config.LAKE_3D.BAIT_VOTE_DEFAULT;

    for (const angler of anglers) {
      const spot = bySlot.get(angler.slot);
      const occupied = !!spot;
      const displayName = spot && typeof spot.displayName === 'string' ? spot.displayName : '';
      const prevStates = angler.visualStates;
      const states = spot && Array.isArray(spot.visualStates)
        ? spot.visualStates.filter((s) => VISUAL_STATES.includes(s))
        : [];
      angler.occupied = occupied;
      angler.displayName = displayName;
      angler.figure.visible = occupied;
      angler.readyRod.visible = !occupied;
      setNameSprite(angler, displayName);
      // At most one gift decoration per spot: the first listed.
      const decorations = spot && Array.isArray(spot.decorations) ? spot.decorations : [];
      setDecoration(angler, occupied ? (decorations[0] || null) : null);
      // Reset state items, then apply the current set; newly present
      // states get the gentle transition.
      angler.fancyRod.visible = false;
      angler.rod.visible = true;
      angler.line.visible = false;
      angler.bobberGlow.visible = false;
      angler.bucket.visible = false;
      angler.parasol.visible = false;
      for (const state of states) {
        applyVisualState(angler, state, nowMs, !prevStates.includes(state));
      }
      angler.visualStates = states;
      // Bobber colour follows the bait-vote result (bobber and its glow
      // share one material each, so setting the colour updates all of them).
      const colour = baitColorFor(baitOption, config);
      if (angler.bobber.material && angler.bobber.material.color) angler.bobber.material.color.set(colour);
      if (angler.bobberGlow.material && angler.bobberGlow.material.color) angler.bobberGlow.material.color.set(colour);
    }
  }

  function startRipple(x, z, nowMs) {
    const slot = ripplePool.find((r) => !r.active) || ripplePool[0];
    if (!slot) return;
    slot.active = true;
    slot.startedAt = nowMs;
    slot.x = x;
    slot.z = z;
    slot.mesh.visible = true;
  }

  function fireAmbient(event, nowMs) {
    ambientFired += 1;
    const slot = Math.floor((event.atMs / 1000) % MAX_ANGLERS);
    const world = anglerWorldPosition(slot);
    if (event.type === 'ripple') {
      startRipple(world.x + 0.5, world.z - 1.2, nowMs);
    } else if (event.type === 'fish-jump') {
      startRipple(world.x, world.z - 1.5, nowMs);
    } else if (event.type === 'bird') {
      const bird = birds.find((b) => !b.active) || birds[0];
      if (bird) {
        bird.active = true;
        bird.startedAt = nowMs;
        bird.fromX = -10;
        bird.group.visible = true;
      }
    } else if (event.type === 'dragonfly') {
      if (dragonfly) {
        dragonfly.active = true;
        dragonfly.startedAt = nowMs;
        dragonfly.group.visible = true;
      }
    }
  }

  function updateEffects(animations, nowMs) {
    const present = new Set();
    for (const anim of animations || []) {
      if (!anim || typeof anim !== 'object') continue;
      present.add(anim);
      if (seenAnimations.has(anim)) continue;
      const category = effectCategoryForKind(anim.kind);
      if (!category || category === 'dom') continue;
      const res = effects.enqueue(anim.kind, {
        slot: anim.slot ?? null,
        displayName: anim.displayName || '',
        effect: anim.effect || '',
        startedAt: nowMs,
        duration: anim.duration || effectDurationForKind(anim.kind),
      });
      if (res.effect) seenAnimations.set(anim, res.effect.id);
    }
    for (const [anim, id] of [...seenAnimations.entries()]) {
      if (!present.has(anim)) {
        effects.complete(id, nowMs);
        seenAnimations.delete(anim);
      }
    }
    effects.tick(nowMs);
  }

  function updateEffectVisuals(nowMs) {
    let schoolActive = null;
    let finaleActive = null;
    let giftActive = null;
    for (const effect of effects.activeEffects()) {
      const p = clamp((nowMs - effect.startedAt) / effect.duration, 0, 1);
      if (effect.category === 'small') {
        const world = Number.isInteger(effect.slot)
          ? anglerWorldPosition(effect.slot)
          : { x: 0, z: 0 };
        // One ripple per effect, at its start — not one per frame.
        if (p < 0.15 && !effect.rippleStarted) {
          effect.rippleStarted = true;
          startRipple(world.x + 0.5, world.z - 1.2, nowMs);
        }
      } else if (effect.category === 'gift') {
        giftActive = { effect, p };
      } else if (effect.category === 'large') {
        if (effect.kind === 'school') schoolActive = { effect, p };
        else finaleActive = { effect, p };
      }
    }
    if (schoolMesh) {
      schoolMesh.visible = !!schoolActive;
      if (schoolActive) {
        const x = lerp(-8, 8, easeInOut(schoolActive.p));
        for (let i = 0; i < 8; i += 1) {
          _tmpMatrix.current.makeTranslation(x - i * 0.7, 0.12, -1 + (i % 3) * 0.8);
          schoolMesh.setMatrixAt(i, _tmpMatrix.current);
        }
        schoolMesh.instanceMatrix.needsUpdate = true;
      }
    }
    if (finaleWash) {
      finaleWash.visible = !!finaleActive;
      if (finaleActive) {
        finaleWash.material.opacity = Math.sin(finaleActive.p * Math.PI) * 0.22;
      }
    }
    if (giftGlow) {
      giftGlow.visible = !!giftActive;
      if (giftActive) {
        const world = Number.isInteger(giftActive.effect.slot)
          ? anglerWorldPosition(giftActive.effect.slot)
          : { x: 0, z: 0 };
        place(giftGlow, world.x, 1.2, world.z - 0.5);
        giftGlow.material.opacity = Math.sin(giftActive.p * Math.PI) * 0.55;
        const s = 0.7 + Math.sin(giftActive.p * Math.PI) * 0.5;
        giftGlow.scale.set(s, s, s);
      }
    }
  }

  function updateIdle(nowMs, motionTimeMs) {
    const t = motionTimeMs / 1000;
    const bobScale = reducedMotionState.value ? 0.25 : 1;
    for (const angler of anglers) {
      if (!angler.occupied) continue;
      const phase = angler.phase * Math.PI * 2;
      // Slow rod sway + bobber bob (periods >= 4.5s, see the period list).
      angler.rod.rotation.z = -0.25 + Math.sin((t / 6) * Math.PI * 2 + phase) * 0.05 * bobScale;
      angler.fancyRod.rotation.z = -0.25 + Math.sin((t / 6) * Math.PI * 2 + phase) * 0.05 * bobScale;
      angler.bobber.position.y = 0.06 + Math.sin((t / 5) * Math.PI * 2 + phase) * 0.03 * bobScale;
      angler.bobberGlow.position.y = angler.bobber.position.y;
      // Occasional cast and reel-in: a slow one-shot ease, staggered per
      // angler, about once every 20s. Never a rapid jitter.
      const cycle = (motionTimeMs + angler.slot * 7000) % 20000;
      if (cycle < 2000 && !reducedMotionState.value) {
        const p = easeInOut(cycle / 2000);
        angler.arm.rotation.z = -0.7 - Math.sin(p * Math.PI) * 0.5;
        angler.rod.rotation.x = -0.9 - Math.sin(p * Math.PI) * 0.25;
      } else {
        angler.arm.rotation.z = -0.7;
        angler.rod.rotation.x = -0.9;
      }
    }
    // Fish swim slow ellipses; a jump is a one-shot arc, never a blink.
    const fishCount = FISH_PER_TIER[quality.tier];
    if (fishMesh) {
      fishMesh.count = fishCount;
      for (let i = 0; i < fishCount; i += 1) {
        const period = 8 + (i % 5) * 2;
        const a = (motionTimeMs / (period * 1000)) * Math.PI * 2 + i * 1.3;
        const x = Math.cos(a) * 6.5;
        const z = Math.sin(a) * 2.5 - 1;
        _tmpMatrix.current.makeTranslation(x, 0.12, z);
        fishMesh.setMatrixAt(i, _tmpMatrix.current);
      }
      fishMesh.instanceMatrix.needsUpdate = true;
    }
    // Drifting light particles; frozen in reduced motion.
    const particleCount = PARTICLES_PER_TIER[quality.tier];
    if (particleMesh) {
      particleMesh.count = reducedMotionState.value ? Math.floor(particleCount * 0.35) : particleCount;
      const pt = reducedMotionState.value ? 0 : t;
      for (let i = 0; i < particleMesh.count; i += 1) {
        const seed = particleSeeds[i] || { x: 0, y: 1, z: 0, phase: 0 };
        const drift = Math.sin((pt / 10) * Math.PI * 2 + seed.phase) * 0.4;
        _tmpMatrix.current.makeTranslation(seed.x + drift, seed.y, seed.z);
        particleMesh.setMatrixAt(i, _tmpMatrix.current);
      }
      particleMesh.instanceMatrix.needsUpdate = true;
    }
    // Water: a slow swell; frozen in reduced motion.
    if (waterMesh) {
      const swell = reducedMotionState.value ? 0 : Math.sin((t / 6) * Math.PI * 2) * 0.008;
      waterMesh.scale.set(1 + swell, 1 + swell, 1);
    }
    // Ripple rings: one-shot expand + fade.
    for (const ring of ripplePool) {
      if (!ring.active) continue;
      const p = (nowMs - ring.startedAt) / 2000;
      if (p >= 1) {
        ring.active = false;
        ring.mesh.visible = false;
        continue;
      }
      const e = easeOutCubic(p);
      ring.mesh.position.set(ring.x, 0.05, ring.z);
      ring.mesh.scale.set(1 + e * 3, 1 + e * 3, 1);
      ring.mesh.material.opacity = 0.5 * (1 - p);
    }
    // Birds cross the sky over 12s; dragonfly wanders on a slow path.
    for (const bird of birds) {
      if (!bird.active) continue;
      const p = (nowMs - bird.startedAt) / 12000;
      if (p >= 1) {
        bird.active = false;
        bird.group.visible = false;
        continue;
      }
      const x = lerp(bird.fromX, 10, p);
      const y = 7 + Math.sin(p * Math.PI) * 1.5;
      place(bird.group, x, y, -6);
      const flap = Math.sin((t / 6) * Math.PI * 2 + p * 4) * 0.35;
      bird.wingL.rotation.z = flap;
      bird.wingR.rotation.z = -flap;
    }
    if (dragonfly && dragonfly.active) {
      const p = (nowMs - dragonfly.startedAt) / 9000;
      if (p >= 1) {
        dragonfly.active = false;
        dragonfly.group.visible = false;
      } else {
        const a = p * Math.PI * 2;
        place(dragonfly.group, Math.cos(a) * 4, 1.5 + Math.sin(a * 2) * 0.5, Math.sin(a) * 3 - 1);
      }
    }
    // State transitions: the new item scales in with a glow sweep.
    for (let i = transitions.length - 1; i >= 0; i -= 1) {
      const tr = transitions[i];
      const p = (nowMs - tr.startedAt) / 1200;
      if (p >= 1) {
        tr.item.scale.set(1, 1, 1);
        if (tr.sweep) {
          tr.sweep.visible = false;
          tr.sweep.material.opacity = 0;
        }
        transitions.splice(i, 1);
        continue;
      }
      const s = 0.6 + 0.4 * easeOutCubic(p);
      tr.item.scale.set(s, s, s);
      if (tr.sweep && tr.sweep.visible) {
        tr.sweep.scale.set(0.5 + p * 1.7, 0.5 + p * 1.7, 0.5 + p * 1.7);
        tr.sweep.material.opacity = 0.5 * (1 - p);
      }
    }
  }

  function applySceneColours() {
    if (!scene || !scene.background) return;
    scene.background.set(currentScene.skyTop);
    if (skyMat) skyMat.color.set(currentScene.skyTop);
    if (waterMat) waterMat.color.set(currentScene.waterTop);
    if (groundMat) groundMat.color.set(currentScene.waterBottom);
    if (sunMesh) sunMesh.material.color.set(currentScene.sun);
    if (starsMesh) starsMesh.visible = currentScene.sceneId === 'starry';
    if (sunMesh) {
      // Sun rides higher at noon, lower toward sunset; a pale disc at night.
      const heights = { sunrise: 7.5, noon: 9.5, sunset: 5.5, starry: 8.5 };
      sunMesh.position.y = heights[currentScene.sceneId] ?? 7.5;
    }
  }

  function frame(nowMs, snapshot, animations) {
    if (disposed) return { disposed: true };
    if (contextLost) return { contextLost: true };
    if (lastFrameMs && nowMs - lastFrameMs < 33) return lastInfo;
    const dt = lastFrameMs ? nowMs - lastFrameMs : 33;
    lastFrameMs = nowMs;
    quality.note(dt);

    const paused = !!(snapshot && snapshot.status && snapshot.status.paused);
    if (paused && frozenMs === null) frozenMs = nowMs;
    if (!paused) frozenMs = null;
    const motionMs = paused ? frozenMs : nowMs;

    if (snapshot) syncSnapshot(snapshot, nowMs);
    applySceneColours();

    // Ambient events fire on their seeded timer, with no input.
    if (!paused) {
      if (!nextAmbient) nextAmbient = ambient.nextEvent(nowMs);
      while (nextAmbient && nowMs >= nextAmbient.atMs) {
        fireAmbient(nextAmbient, nowMs);
        nextAmbient = ambient.nextEvent(nowMs);
      }
    }

    updateEffects(animations || [], nowMs);
    updateEffectVisuals(nowMs);
    updateIdle(nowMs, motionMs);

    // Camera: a slow drift in full motion, perfectly static when reduced.
    if (camera) {
      if (reducedMotionState.value) {
        camera.position.set(0, 13, 15);
      } else {
        const t = motionMs / 1000;
        camera.position.set(
          Math.sin((t / 12) * Math.PI * 2) * 0.35,
          13 + Math.sin((t / 15) * Math.PI * 2) * 0.15,
          15,
        );
      }
      camera.lookAt(_tmpVec.current);
    }

    if (renderer && scene && camera) renderer.render(scene, camera);
    lastInfo = {
      tier: quality.tier,
      sceneId: currentScene.sceneId,
      blend: currentScene.blend,
      baitOption,
      activeEffects: effects.counts(),
      ambientFired,
      reducedMotion: reducedMotionState.value,
      contextLost: false,
    };
    return lastInfo;
  }

  try {
    build();
  } catch (err) {
    dispose();
    throw err;
  }

  return {
    frame,
    dispose,
    setReducedMotion,
    getQualityTier() {
      return quality.tier;
    },
    noteFrameTime(dtMs) {
      return quality.note(dtMs);
    },
    getSceneId() {
      return currentScene.sceneId;
    },
    getCameraPosition() {
      return camera ? { x: camera.position.x, y: camera.position.y, z: camera.position.z } : null;
    },
    getParticleCount() {
      return particleMesh ? particleMesh.count : 0;
    },
    getAmbientFired() {
      return ambientFired;
    },
    getFishPositions() {
      if (!fishMesh || !fishMesh.matrices) return [];
      return [...fishMesh.matrices.values()];
    },
    getAnglerStates() {
      return anglers.map((a) => ({
        slot: a.slot,
        occupied: a.occupied,
        displayName: a.displayName,
        hasNameSprite: a.displayName !== '',
        decoration: a.decoration,
        decorationCount: a.decoration ? 1 : 0,
        visualStates: [...a.visualStates],
        stateVisuals: {
          fancyRod: a.fancyRod.visible,
          lineInWater: a.line.visible,
          bobberGlow: a.bobberGlow.visible,
          baitBucket: a.bucket.visible,
          parasol: a.parasol.visible,
        },
        hasTransition: transitions.some((t) => t.slot === a.slot),
        rodReady: a.readyRod.visible,
        bobberColor: (() => {
          const c = a.bobber.material && a.bobber.material.color;
          if (!c) return baitColorFor(baitOption, config);
          if (typeof c.getHexString === 'function') return `#${c.getHexString()}`;
          return c.value || baitColorFor(baitOption, config);
        })(),
        position: anglerPosition(a.slot),
      }));
    },
    getEffectCounts() {
      return effects.counts();
    },
    get disposed() {
      return disposed;
    },
    get contextLost() {
      return contextLost;
    },
  };
}
