import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createLakeRenderer, anglerPosition, chairLayout, anglerWorldPosition,
  sceneColorsAt, baitColorFor, createAmbientScheduler, createEffectManager,
  effectCategoryForKind, createQualityTracker, OSCILLATION_PERIODS_S,
  meterFillFraction, tickerText, toastText, howToPlayBoardData,
  webglAvailable, CAMERA_WINDOW, PLAY_TOP, PLAY_BOTTOM, DEFAULT_CONFIG,
} from '../public/render3d.js';
import { LAKE_3D, SCENE_PALETTES, HOW_TO_PLAY, howToPlayText } from '../src/lake3d-config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REAL_CONFIG = { LAKE_3D, SCENE_PALETTES };

// --- Stub THREE: implements only the surface render3d.js documents. -------
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

function stubCanvas({ webgl = true } = {}) {
  const listeners = new Map();
  return {
    width: 1080, height: 1920,
    getContext: (type) => (webgl && (type === 'webgl2' || type === 'webgl') ? { stub: true } : null),
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

function lakeSnapshot(overrides = {}) {
  return {
    theme: 'sunrise-lake',
    status: { paused: false, killed: false, connection: 'live' },
    spots: [
      { slot: 0, displayName: 'Maya', decorations: ['lantern'], visualStates: [] },
      { slot: 1, displayName: 'Liam', decorations: ['blossom', 'flag'], visualStates: ['cast'] },
      { slot: 2, displayName: '', decorations: [], visualStates: [] },
    ],
    meter: {
      total: 120, thresholds: [100, 500, 1000, 2500, 5000, 10000], hit: [100],
      cycle: { total: 120, milestones: [50, 150, 300, 500, 800, 1200], hit: [50], resting: false },
    },
    scene: { index: 0, id: 'sunrise', startedAt: 0 },
    baitVote: { round: 1, option: 'worm' },
    ...overrides,
  };
}

function makeRenderer(opts = {}) {
  const { THREE, disposed } = makeStubTHREE(opts.three || {});
  const canvas = stubCanvas(opts.canvas || {});
  const renderer = createLakeRenderer({
    THREE, canvas, config: REAL_CONFIG, reducedMotion: !!opts.reducedMotion,
  });
  return { renderer, canvas, disposed, THREE };
}

function runFrames(renderer, snapshot, animations, startMs, count, step = 1000) {
  let info = null;
  for (let i = 0; i < count; i += 1) {
    info = renderer.frame(startMs + i * step, snapshot, animations);
  }
  return info;
}

// --- Layout ----------------------------------------------------------------

test('chair layout: 16 slots, inside the play area, outside the safe zone', () => {
  const layout = chairLayout();
  assert.equal(layout.length, 16);
  const seen = new Set();
  for (let slot = 0; slot < 16; slot += 1) {
    const p = anglerPosition(slot);
    assert.equal(p.slot, slot);
    assert.ok(p.x >= 40 && p.x <= 1040, `slot ${slot} x out of play area: ${p.x}`);
    assert.ok(p.y >= PLAY_TOP && p.y <= PLAY_BOTTOM, `slot ${slot} y out of play area: ${p.y}`);
    // Outside the creator camera window (with margin).
    const inCamera = p.x >= CAMERA_WINDOW.x && p.x <= CAMERA_WINDOW.x + CAMERA_WINDOW.w
      && p.y >= CAMERA_WINDOW.y && p.y <= CAMERA_WINDOW.y + CAMERA_WINDOW.h;
    assert.ok(!inCamera, `slot ${slot} inside the camera window`);
    const key = `${p.x},${p.y}`;
    assert.ok(!seen.has(key), `duplicate chair position for slot ${slot}`);
    seen.add(key);
  }
  assert.deepEqual(anglerPosition(3), anglerPosition(3), 'layout must be deterministic');
  const world = anglerWorldPosition(0);
  assert.ok(Number.isFinite(world.x) && Number.isFinite(world.z));
});

// --- Scene colours -----------------------------------------------------------

test('scene colour: mid-crossfade mixes neighbours, reduced motion cuts', () => {
  const mid = sceneColorsAt(REAL_CONFIG, 0, 710000, false);
  assert.equal(mid.sceneId, 'sunrise');
  assert.equal(mid.nextSceneId, 'noon');
  assert.equal(mid.blend, 0.5);
  // Midpoint of sunrise skyTop #1d3a5f and noon skyTop #2f6da8.
  assert.equal(mid.skyTop, '#265484');
  const early = sceneColorsAt(REAL_CONFIG, 0, 1000, false);
  assert.equal(early.blend, 0);
  assert.equal(early.skyTop, SCENE_PALETTES.sunrise.skyTop);
  // Reduced motion: no blend even deep into the fade window.
  const reduced = sceneColorsAt(REAL_CONFIG, 0, 710000, true);
  assert.equal(reduced.blend, 0);
  assert.equal(reduced.skyTop, SCENE_PALETTES.sunrise.skyTop);
  // Wrap: starry fades into sunrise.
  const wrap = sceneColorsAt(REAL_CONFIG, 3, 710000, false);
  assert.equal(wrap.sceneId, 'starry');
  assert.equal(wrap.nextSceneId, 'sunrise');
  assert.equal(wrap.blend, 0.5);
});

// --- Ambient scheduler -------------------------------------------------------

test('ambient scheduler: seeded, 6-10s gaps, average ~8s', () => {
  const a = createAmbientScheduler(42, { config: REAL_CONFIG });
  const b = createAmbientScheduler(42, { config: REAL_CONFIG });
  const gapsA = a.schedule(60, 0);
  const gapsB = b.schedule(60, 0);
  assert.deepEqual(gapsA, gapsB, 'same seed must give the same schedule');
  let prev = 0;
  let sum = 0;
  for (const e of gapsA) {
    const gap = e.atMs - prev;
    assert.ok(gap >= 6000 && gap <= 10000, `gap out of range: ${gap}`);
    assert.ok(['fish-jump', 'ripple', 'bird', 'dragonfly'].includes(e.type));
    sum += gap;
    prev = e.atMs;
  }
  const avg = sum / gapsA.length;
  assert.ok(avg >= 7500 && avg <= 8500, `average gap should be ~8s, got ${avg}`);
  // Reduced motion: fewer kinds, slower gaps.
  const reduced = createAmbientScheduler(42, { config: REAL_CONFIG, reducedMotion: true });
  const slow = reduced.schedule(20, 0);
  let prevR = 0;
  for (const e of slow) {
    const gap = e.atMs - prevR;
    assert.ok(gap >= 9000, `reduced-motion gap too short: ${gap}`);
    assert.ok(['ripple', 'fish-jump'].includes(e.type));
    prevR = e.atMs;
  }
});

// --- Effect caps -------------------------------------------------------------

test('effect caps: 5th small waits, 2nd large waits, 2nd gift waits', () => {
  const mgr = createEffectManager(REAL_CONFIG);
  for (let i = 0; i < 4; i += 1) {
    assert.equal(mgr.enqueue('follow', { startedAt: 0 }).status, 'active');
  }
  assert.equal(mgr.enqueue('command', { startedAt: 0 }).status, 'queued');
  assert.equal(mgr.enqueue('school', { startedAt: 0 }).status, 'active');
  assert.equal(mgr.enqueue('finale', { startedAt: 0 }).status, 'queued');
  assert.equal(mgr.enqueue('gift', { startedAt: 0 }).status, 'active');
  assert.equal(mgr.enqueue('gift-scene', { startedAt: 0 }).status, 'queued');
  assert.deepEqual(mgr.counts(), { small: 4, large: 1, gift: 1, queued: 3, dropped: 0 });
  // Completing one small promotes the queued small.
  const smallId = mgr.activeEffects().find((e) => e.category === 'small').id;
  assert.ok(mgr.complete(smallId, 100));
  assert.equal(mgr.counts().small, 4);
  assert.equal(mgr.counts().queued, 2);
  // Ticker is a DOM effect, unknown kinds are ignored.
  assert.equal(mgr.enqueue('ticker', {}).status, 'ignored');
  assert.equal(mgr.enqueue('mystery-kind', {}).status, 'ignored');
  assert.equal(effectCategoryForKind('ticker'), 'dom');
  assert.equal(effectCategoryForKind('nope'), null);
});

test('effect queue: drops the oldest past 100', () => {
  const mgr = createEffectManager(REAL_CONFIG);
  for (let i = 0; i < 4; i += 1) mgr.enqueue('follow', { startedAt: 0 });
  let lastId = 0;
  for (let i = 0; i < 106; i += 1) {
    const res = mgr.enqueue('command', { startedAt: 0 });
    lastId = res.effect.id;
  }
  assert.equal(mgr.queueLength(), 100);
  assert.equal(mgr.droppedCount(), 6);
  assert.equal(mgr.counts().small, 4);
  // The oldest queued effects were dropped, the newest survived.
  assert.ok(mgr.queuedEffects().some((e) => e.id === lastId));
  assert.ok(!mgr.queuedEffects().some((e) => e.id === 5));
});

// --- Quality tiers -----------------------------------------------------------

test('quality tiers step down on slow frames and back up on fast ones', () => {
  const q = createQualityTracker();
  assert.equal(q.tier, 0);
  for (let i = 0; i < 40; i += 1) q.note(60);
  assert.equal(q.tier, 2);
  for (let i = 0; i < 60; i += 1) q.note(10);
  assert.equal(q.tier, 0);
  const { renderer } = makeRenderer();
  try {
    for (let i = 0; i < 40; i += 1) renderer.noteFrameTime(60);
    assert.equal(renderer.getQualityTier(), 2);
    for (let i = 0; i < 60; i += 1) renderer.noteFrameTime(10);
    assert.equal(renderer.getQualityTier(), 0);
  } finally {
    renderer.dispose();
  }
});

// --- Flashing bound ----------------------------------------------------------

test('flashing bound: every exported oscillation period is >= 4.5s', () => {
  assert.ok(OSCILLATION_PERIODS_S.length > 0);
  for (const p of OSCILLATION_PERIODS_S) {
    assert.ok(p.seconds >= 4.5, `${p.name} period too fast: ${p.seconds}s`);
    assert.ok(p.seconds >= LAKE_3D.FLASH_MIN_PERIOD_S);
  }
});

// --- Fallback triggers -------------------------------------------------------

test('fallback triggers when WebGL is unavailable and on init throw', () => {
  assert.equal(webglAvailable(stubCanvas({ webgl: false })), false);
  assert.equal(webglAvailable(stubCanvas({ webgl: true })), true);
  assert.equal(webglAvailable(null), false);
  const { THREE } = makeStubTHREE();
  assert.throws(
    () => createLakeRenderer({ THREE, canvas: stubCanvas({ webgl: false }), config: REAL_CONFIG }),
    /WebGL unavailable/,
  );
  assert.throws(() => createLakeRenderer({ THREE: null, canvas: stubCanvas(), config: REAL_CONFIG }));
  const throwing = makeStubTHREE({ rendererThrows: true });
  assert.throws(
    () => createLakeRenderer({ THREE: throwing.THREE, canvas: stubCanvas(), config: REAL_CONFIG }),
    /context creation failed/,
  );
});

// --- Renderer: spots, names, vote colour, decorations -----------------------

test('renderer: hidden spots get no name sprite; named spots do', () => {
  const { renderer } = makeRenderer();
  try {
    renderer.frame(1000, lakeSnapshot(), []);
    const states = renderer.getAnglerStates();
    assert.equal(states.length, 16);
    assert.equal(states[0].hasNameSprite, true);
    assert.equal(states[0].displayName, 'Maya');
    assert.equal(states[1].hasNameSprite, true);
    assert.equal(states[2].hasNameSprite, false, 'hidden spot must have no name sprite');
    assert.equal(states[2].displayName, '');
    assert.equal(states[3].occupied, false);
    assert.equal(states[3].hasNameSprite, false);
  } finally {
    renderer.dispose();
  }
});

test('renderer: vote colour applied to bobber; unknown vote falls back', () => {
  const { renderer } = makeRenderer();
  try {
    renderer.frame(1000, lakeSnapshot({ baitVote: { round: 2, option: 'corn' } }), []);
    let states = renderer.getAnglerStates();
    assert.equal(states[0].bobberColor, '#ffd94a');
    renderer.frame(2000, lakeSnapshot({ baitVote: { round: 3, option: 'berry' } }), []);
    states = renderer.getAnglerStates();
    assert.equal(states[0].bobberColor, '#b06ab3');
    renderer.frame(3000, lakeSnapshot({ baitVote: { round: 4, option: 'mystery' } }), []);
    states = renderer.getAnglerStates();
    assert.equal(states[0].bobberColor, '#e07840');
    assert.equal(baitColorFor('corn', REAL_CONFIG), '#ffd94a');
    assert.equal(baitColorFor('nope', REAL_CONFIG), '#e07840');
  } finally {
    renderer.dispose();
  }
});

test('renderer: exactly 1 gift decoration per spot (first listed)', () => {
  const { renderer } = makeRenderer();
  try {
    renderer.frame(1000, lakeSnapshot(), []);
    const states = renderer.getAnglerStates();
    assert.equal(states[0].decoration, 'lantern');
    assert.equal(states[0].decorationCount, 1);
    assert.equal(states[1].decoration, 'blossom', 'first of several wins');
    assert.equal(states[1].decorationCount, 1);
    assert.equal(states[2].decoration, null);
    assert.equal(states[2].decorationCount, 0);
  } finally {
    renderer.dispose();
  }
});

test('renderer: empty chairs show a rod ready, inviting someone to sit', () => {
  const { renderer } = makeRenderer();
  try {
    renderer.frame(1000, lakeSnapshot({ spots: [] }), []);
    const states = renderer.getAnglerStates();
    assert.ok(states.every((s) => !s.occupied));
    assert.ok(states.every((s) => s.rodReady), 'every empty chair keeps a rod ready');
    assert.ok(states.every((s) => !s.hasNameSprite));
  } finally {
    renderer.dispose();
  }
});

// --- Visual states: silent, persistent, distinct ----------------------------

test('visual states: cast/bait/wave are distinct, persistent, cumulative', () => {
  const { renderer } = makeRenderer();
  try {
    const snap = lakeSnapshot({
      spots: [
        { slot: 0, displayName: 'Maya', decorations: [], visualStates: [] },
        { slot: 1, displayName: 'Liam', decorations: [], visualStates: ['cast'] },
        { slot: 2, displayName: 'Noor', decorations: [], visualStates: ['bait'] },
        { slot: 3, displayName: 'Ivy', decorations: [], visualStates: ['wave'] },
        { slot: 4, displayName: 'Omar', decorations: [], visualStates: ['cast', 'bait', 'wave'] },
      ],
    });
    renderer.frame(1000, snap, []);
    const s = renderer.getAnglerStates();
    // Base angler: plain rod, no state items.
    assert.deepEqual(s[0].stateVisuals, {
      fancyRod: false, lineInWater: false, bobberGlow: false, baitBucket: false, parasol: false,
    });
    // cast: nicer rod + line in the water, nothing else.
    assert.equal(s[1].stateVisuals.fancyRod, true);
    assert.equal(s[1].stateVisuals.lineInWater, true);
    assert.equal(s[1].stateVisuals.baitBucket, false);
    assert.equal(s[1].stateVisuals.parasol, false);
    // bait: glowing bobber + bait bucket, plain rod stays.
    assert.equal(s[2].stateVisuals.bobberGlow, true);
    assert.equal(s[2].stateVisuals.baitBucket, true);
    assert.equal(s[2].stateVisuals.fancyRod, false);
    assert.equal(s[2].stateVisuals.parasol, false);
    // wave: striped parasol only.
    assert.equal(s[3].stateVisuals.parasol, true);
    assert.equal(s[3].stateVisuals.fancyRod, false);
    assert.equal(s[3].stateVisuals.baitBucket, false);
    // All three together: cumulative.
    assert.deepEqual(s[4].stateVisuals, {
      fancyRod: true, lineInWater: true, bobberGlow: true, baitBucket: true, parasol: true,
    });
    // Persistent: still there on a later frame with no new commands.
    renderer.frame(20000, snap, []);
    const later = renderer.getAnglerStates();
    assert.equal(later[1].stateVisuals.fancyRod, true);
    assert.equal(later[3].stateVisuals.parasol, true);
    assert.equal(later[4].stateVisuals.baitBucket, true);
  } finally {
    renderer.dispose();
  }
});

test('visual states change silently: a gentle transition, no effect, no text', () => {
  const { renderer } = makeRenderer();
  try {
    const before = lakeSnapshot({
      spots: [{ slot: 0, displayName: 'Maya', decorations: [], visualStates: [] }],
    });
    renderer.frame(1000, before, []);
    assert.equal(renderer.getEffectCounts().small, 0);
    const after = lakeSnapshot({
      spots: [{ slot: 0, displayName: 'Maya', decorations: [], visualStates: ['cast'] }],
    });
    renderer.frame(2000, after, []);
    const states = renderer.getAnglerStates();
    assert.equal(states[0].stateVisuals.fancyRod, true);
    assert.equal(states[0].hasTransition, true, 'a visible transition runs for the new item');
    // No effect was enqueued, no toast, no label: the change is visual only.
    assert.deepEqual(renderer.getEffectCounts(), { small: 0, large: 0, gift: 0, queued: 0, dropped: 0 });
    // The transition finishes and the item stays.
    renderer.frame(5000, after, []);
    assert.equal(renderer.getAnglerStates()[0].hasTransition, false);
    assert.equal(renderer.getAnglerStates()[0].stateVisuals.fancyRod, true);
  } finally {
    renderer.dispose();
  }
});

// --- Reduced motion, idle life, dispose --------------------------------------

test('reduced motion: no camera drift, instant scene cuts, fewer particles', () => {
  const full = makeRenderer();
  const reduced = makeRenderer({ reducedMotion: true });
  try {
    const snap = lakeSnapshot();
    full.renderer.frame(1000, snap, []);
    reduced.renderer.frame(1000, snap, []);
    const fullCamA = full.renderer.getCameraPosition();
    const reducedCamA = reduced.renderer.getCameraPosition();
    full.renderer.frame(4000, snap, []);
    reduced.renderer.frame(4000, snap, []);
    const fullCamB = full.renderer.getCameraPosition();
    const reducedCamB = reduced.renderer.getCameraPosition();
    assert.ok(fullCamA.x !== fullCamB.x, 'full motion camera should drift');
    assert.deepEqual(reducedCamA, reducedCamB, 'reduced motion camera must stay static');
    assert.ok(reduced.renderer.getParticleCount() < full.renderer.getParticleCount(),
      'reduced motion shows fewer particles');
    // Scene cut: the frame info reports no blend in reduced motion, even
    // late in the crossfade window.
    const late = lakeSnapshot({ scene: { index: 0, id: 'sunrise', startedAt: 0 } });
    const info = reduced.renderer.frame(710000, late, []);
    assert.equal(info.blend, 0);
    assert.equal(info.sceneId, 'sunrise');
  } finally {
    full.renderer.dispose();
    reduced.renderer.dispose();
  }
});

test('idle life: with zero spots the lake still moves (ambient + fish)', () => {
  const { renderer } = makeRenderer();
  try {
    const empty = lakeSnapshot({ spots: [] });
    renderer.frame(1000, empty, []);
    const fishA = renderer.getFishPositions();
    runFrames(renderer, empty, [], 2000, 40);
    assert.ok(renderer.getAmbientFired() > 0, 'ambient events fire with no viewers');
    assert.ok(renderer.getAmbientFired() < 12, 'ambient stays near one per 8s');
    const fishB = renderer.getFishPositions();
    assert.ok(fishA.length > 0 && fishB.length > 0);
    assert.notDeepEqual(fishA, fishB, 'fish keep swimming with no spots');
  } finally {
    renderer.dispose();
  }
});

test('scene schedule comes from the snapshot', () => {
  const { renderer } = makeRenderer();
  try {
    renderer.frame(1000, lakeSnapshot({ scene: { index: 1, id: 'noon', startedAt: 0 } }), []);
    assert.equal(renderer.getSceneId(), 'noon');
    // Missing scene fields fall back to a schedule derived from the clock.
    renderer.frame(2000, lakeSnapshot({ scene: undefined }), []);
    assert.ok(['sunrise', 'noon', 'sunset', 'starry'].includes(renderer.getSceneId()));
  } finally {
    renderer.dispose();
  }
});

test('dispose frees resources and stops the renderer', () => {
  const { renderer, disposed } = makeRenderer();
  renderer.frame(1000, lakeSnapshot(), []);
  assert.equal(renderer.disposed, false);
  renderer.dispose();
  assert.equal(renderer.disposed, true);
  assert.ok(disposed.geometries > 0, 'geometries disposed');
  assert.ok(disposed.materials > 0, 'materials disposed');
  assert.ok(disposed.renderer > 0, 'renderer disposed');
  assert.deepEqual(renderer.frame(2000, lakeSnapshot(), []), { disposed: true });
});

test('context lost shows the fallback flag; restore re-inits', () => {
  const { renderer, canvas } = makeRenderer();
  try {
    renderer.frame(1000, lakeSnapshot(), []);
    assert.equal(renderer.contextLost, false);
    canvas._fire('webglcontextlost', { preventDefault() {} });
    assert.equal(renderer.contextLost, true);
    canvas._fire('webglcontextrestored', {});
    assert.equal(renderer.contextLost, false);
    const info = renderer.frame(2000, lakeSnapshot(), []);
    assert.equal(info.sceneId, 'sunrise');
    assert.equal(renderer.getAnglerStates().length, 16);
  } finally {
    renderer.dispose();
  }
});

test('frame rate cap: frames closer than 33ms reuse the last frame', () => {
  const { renderer } = makeRenderer();
  try {
    const a = renderer.frame(1000, lakeSnapshot(), []);
    const b = renderer.frame(1010, lakeSnapshot(), []);
    assert.equal(a, b);
    const c = renderer.frame(1100, lakeSnapshot(), []);
    assert.notEqual(c, a);
  } finally {
    renderer.dispose();
  }
});

test('effects from animations: school and finale take the large slot', () => {
  const { renderer } = makeRenderer();
  try {
    const school = { kind: 'school', slot: null };
    const finale = { kind: 'finale', slot: null };
    const ticker = { kind: 'ticker', names: ['Maya', 'Liam'] };
    const mystery = { kind: 'mystery-kind' };
    renderer.frame(1000, lakeSnapshot(), [school, ticker, mystery]);
    assert.deepEqual(renderer.getEffectCounts(), { small: 0, large: 1, gift: 0, queued: 0, dropped: 0 });
    // A second large effect waits; the ticker never reaches the 3D scene.
    renderer.frame(2000, lakeSnapshot(), [school, finale, ticker]);
    assert.equal(renderer.getEffectCounts().large, 1);
    assert.equal(renderer.getEffectCounts().queued, 1);
    // Hotkey-triggered effects take the same path as automatic ones: the
    // renderer only ever sees the animation kind, never its origin.
    assert.equal(effectCategoryForKind('school'), 'large');
    assert.equal(effectCategoryForKind('finale'), 'large');
  } finally {
    renderer.dispose();
  }
});

// --- Meter, ticker, toast wording --------------------------------------------

test('meter fill: cycle milestones, resting, and legacy thresholds', () => {
  assert.equal(meterFillFraction({
    cycle: { total: 120, milestones: [50, 150, 300, 500, 800, 1200], hit: [50], resting: false },
  }), 0.7);
  assert.equal(meterFillFraction({
    cycle: { total: 1200, milestones: [50, 150, 300, 500, 800, 1200], hit: [50, 150, 300, 500, 800, 1200], resting: true },
  }), 1);
  assert.equal(meterFillFraction({
    total: 1240, thresholds: [100, 500, 1000, 2500, 5000, 10000], hit: [100, 500, 1000],
  }), 0.16);
  assert.equal(meterFillFraction(null), 0);
  assert.equal(meterFillFraction({}), 0);
});

test('thank-you wording: pure thanks + names only, max 3 names', () => {
  assert.equal(tickerText(['Maya', 'Liam']), 'Thank you · Maya · Liam');
  assert.equal(tickerText(['A', 'B', 'C', 'D']), 'Thank you · A · B · C');
  assert.equal(tickerText([]), '');
  assert.equal(toastText({ displayName: 'Maya' }), 'Thank you, Maya');
  assert.equal(toastText({ text: 'All 16 spots are full — thank you!', displayName: 'Maya' }),
    'All 16 spots are full — thank you!');
  assert.equal(toastText({}), 'Thank you');
  const banned = [/reward/i, /luck/i, /fortune/i, /destiny/i, /universe/i, /bless/i,
    /unlock/i, /level/i, /progress/i, /earn/i];
  for (const text of [tickerText(['Maya']), toastText({ displayName: 'Maya' })]) {
    for (const pattern of banned) assert.ok(!pattern.test(text), `${pattern} in ${JSON.stringify(text)}`);
  }
});

test('HOW TO PLAY board: all 4 lines, icons, text matches howToPlayText()', () => {
  const rows = howToPlayBoardData(HOW_TO_PLAY);
  assert.equal(rows.length, 4);
  assert.deepEqual(rows.map((r) => r.text), howToPlayText());
  assert.deepEqual(rows.map((r) => r.command), ['!cast', '!bait', '!wave', '!hide']);
  const icons = rows.map((r) => r.icon);
  assert.equal(new Set(icons).size, 4, 'each command needs its own icon');
  for (const icon of icons) {
    assert.ok(icon.includes('<svg'), 'icon must be drawn SVG, not emoji');
    assert.ok(!/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(icon), 'no emoji in icons');
  }
  // No line suggests that interacting advances anything.
  const banned = [/unlock/i, /\blevel\b/i, /progress/i, /\btry\b/i, /\bearn\b/i,
    /reward/i, /collect/i, /rare/i, /join/i, /interact/i];
  for (const row of rows) {
    for (const pattern of banned) assert.ok(!pattern.test(row.text), `${pattern} in ${JSON.stringify(row.text)}`);
  }
  // The module default mirrors the real config exactly.
  assert.deepEqual(DEFAULT_CONFIG.LAKE_3D.SCENES, LAKE_3D.SCENES);
  assert.deepEqual(DEFAULT_CONFIG.SCENE_PALETTES, SCENE_PALETTES);
  assert.deepEqual(DEFAULT_CONFIG.HOW_TO_PLAY, HOW_TO_PLAY);
});

// --- Source hygiene: no synthesis, no banned wording -------------------------

test('source hygiene: no tone-generation or 3D sound tokens in our files', () => {
  const forbidden = ['OscillatorNode', 'createOscillator', 'AudioContext', 'webkitAudioContext',
    'createBuffer', 'createBufferSource', 'PeriodicWave', 'createGain',
    'createBiquadFilter', 'setValueAtTime', 'linearRampToValueAtTime',
    'THREE.Audio', 'AudioListener', 'PositionalAudio'];
  for (const file of ['public/render3d.js', 'public/overlay.js', 'public/overlay.html']) {
    const text = readFileSync(path.join(ROOT, file), 'utf8');
    for (const token of forbidden) {
      assert.ok(!text.includes(token), `${token} in ${file}`);
    }
    assert.ok(!/unlock/i.test(text), `"unlock" wording in ${file}`);
  }
  const render3d = readFileSync(path.join(ROOT, 'public/render3d.js'), 'utf8');
  assert.ok(!render3d.includes("from './render.js'"), 'render3d must not import the 2D renderer');
  assert.ok(!/cdn/i.test(render3d), 'render3d must not load anything from outside the project');
});

test('overlay wiring: HUD, durations, and board container exist', () => {
  const html = readFileSync(path.join(ROOT, 'public/overlay.html'), 'utf8');
  for (const id of ['scene', 'scene3d', 'hud', 'meter', 'meter-fill', 'howto', 'howto-list',
    'ticker', 'toast', 'footer', 'state-notice']) {
    assert.ok(html.includes(`id="${id}"`), `overlay.html missing #${id}`);
  }
  assert.ok(html.includes('How to play'), 'board heading missing');
  assert.ok(!/unlock/i.test(html), '"unlock" wording in overlay.html');
  const overlay = readFileSync(path.join(ROOT, 'public/overlay.js'), 'utf8');
  assert.ok(overlay.includes('ticker: 20000'), 'DURATIONS needs ticker 20000');
  assert.ok(overlay.includes('school: 4000'), 'DURATIONS needs school 4000');
  assert.ok(overlay.includes('finale: 6000'), 'DURATIONS needs finale 6000');
  assert.ok(overlay.includes('howToPlayText()'), 'board must render via howToPlayText()');
  assert.ok(overlay.includes("import('./vendor/three.module.js')"), 'THREE loads from the vendor');
  assert.ok(overlay.includes("import('./render.js')"), '2D renderer loads lazily, not in the lake path');
  assert.ok(!overlay.includes("from './render.js'"), 'overlay must not statically import render.js');
  assert.ok(overlay.includes('audio starts the moment the browser allows it'),
    'the "unlocks audio" comment must say "audio starts"');
});
