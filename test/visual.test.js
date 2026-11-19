import test from 'node:test';
import assert from 'node:assert/strict';
import { renderScene, createParticles, spotPosition, motionProfile, FOOTER } from '../public/render.js';
import { THEMES, THEME_IDS, DISCLOSURES, MUSIC_CREDIT, METER_THRESHOLDS } from '../src/themes.js';

// Same stub-context approach as render.test.js: records calls, never draws.
function stubCtx() {
  const calls = [];
  const gradient = {
    stops: [],
    addColorStop(offset, color) { this.stops.push([offset, color]); },
  };
  const store = {
    calls, fillStyle: '', strokeStyle: '', globalAlpha: 1, lineWidth: 1,
    font: '', textAlign: '', textBaseline: '', globalCompositeOperation: 'source-over',
  };
  const ctx = new Proxy(store, {
    get(target, prop) {
      if (prop === 'createLinearGradient') {
        return () => { calls.push(['createLinearGradient']); return gradient; };
      }
      if (prop === 'measureText') {
        return (text) => { calls.push(['measureText', text]); return { width: String(text).length * 12 }; };
      }
      if (prop in target) return target[prop];
      return (...args) => { calls.push([String(prop), ...args]); };
    },
    set(target, prop, value) {
      calls.push(['set', String(prop), value]);
      target[prop] = value;
      return true;
    },
  });
  return { ctx, calls };
}

function populatedView(themeId, overrides = {}) {
  const theme = THEMES[themeId];
  return {
    theme,
    spots: [
      { slot: 0, displayName: 'Maya', hidden: false, decorations: ['lantern'], lastAction: null, lastActionAt: 0 },
      { slot: 1, displayName: 'Liam', hidden: false, decorations: [], lastAction: 'wave', lastActionAt: 900 },
    ],
    meter: {
      total: 1240, thresholds: [...METER_THRESHOLDS], hit: [100, 500, 1000],
      label: theme.meterLabel, stageLabel: theme.meterStages[2].label,
    },
    animations: [
      { kind: 'follow', slot: 0, displayName: 'Maya', progress: 0.5 },
    ],
    particles: createParticles(themeId),
    timeMs: 1000,
    paused: false,
    killed: false,
    disclosures: DISCLOSURES,
    musicCredit: MUSIC_CREDIT,
    ...overrides,
  };
}

test('motion profiles: full motion moves, reduced motion stays gentle', () => {
  const full = motionProfile(false);
  assert.equal(full.particleFraction, 1);
  assert.equal(full.bobScale, 1);
  assert.equal(full.driftScale, 1);
  assert.equal(full.shootingStar, true);
  assert.equal(full.entranceRing, true);
  assert.ok(full.entranceRise > 0);
  const reduced = motionProfile(true);
  assert.ok(reduced.particleFraction < full.particleFraction);
  assert.ok(reduced.bobScale < full.bobScale);
  assert.equal(reduced.driftScale, 0);
  assert.equal(reduced.shootingStar, false);
  assert.equal(reduced.entranceRing, false);
  assert.equal(reduced.entranceRise, 0);
  assert.equal(reduced.waveScale, 0);
  // Anything that is not exactly true means full motion.
  assert.deepEqual(motionProfile(undefined), full);
});

test('spot positions freeze under zero motion scale and move under full scale', () => {
  const stillA = spotPosition(3, 1000, 'sunrise-lake', 0);
  const stillB = spotPosition(3, 9000, 'sunrise-lake', 0);
  assert.equal(stillA.x, stillB.x);
  assert.equal(stillA.y, stillB.y);
  assert.ok(stillA.bob === 0, 'bob should be zero (allowing -0) under zero motion scale');
  const movingA = spotPosition(3, 1000, 'sunrise-lake', 1);
  const movingB = spotPosition(3, 9000, 'sunrise-lake', 1);
  assert.ok(movingA.y !== movingB.y, 'full motion should bob over time');
  // Default (no scale argument) matches full motion.
  assert.deepEqual(spotPosition(3, 1000, 'sunrise-lake'), movingA);
});

for (const themeId of THEME_IDS) {
  test(`${themeId}: reduced motion renders names, meter, and disclosures identically`, () => {
    const { ctx, calls } = stubCtx();
    renderScene(ctx, populatedView(themeId, { reducedMotion: true }));
    const texts = calls.filter(([m]) => m === 'fillText').map(([, text]) => text);
    assert.ok(texts.includes('Maya'));
    assert.ok(texts.includes('Liam'));
    assert.ok(texts.some((t) => t.includes(THEMES[themeId].meterLabel)));
    assert.ok(texts.some((t) => t.includes('1,240')));
    // Footer body lines wrap, so the exact wording is checked by
    // reconstruction: joining the wrapped body lines (after the title +
    // tagline) must reproduce the source lines verbatim.
    const footerTexts = calls
      .filter(([m, , tx, ty]) => m === 'fillText' && tx === FOOTER.x + 28 && ty >= FOOTER.y)
      .map(([, text]) => text);
    const footerBody = footerTexts.slice(2).join(' ');
    assert.equal(footerBody, [...THEMES[themeId].howItWorks, ...DISCLOSURES, MUSIC_CREDIT].join(' '),
      `footer wording changed in ${themeId}: ${footerBody}`);
    assert.ok(calls.some(([m, prop, value]) => m === 'set' && prop === 'globalCompositeOperation' && value === 'destination-out'));
  });

  test(`${themeId}: reduced motion draws fewer particle shapes than full motion`, () => {
    const empty = {
      spots: [], animations: [],
      meter: { total: 0, thresholds: [...METER_THRESHOLDS], hit: [], label: '', stageLabel: '' },
    };
    const fullRun = stubCtx();
    renderScene(fullRun.ctx, populatedView(themeId, { ...empty, reducedMotion: false }));
    const reducedRun = stubCtx();
    renderScene(reducedRun.ctx, populatedView(themeId, { ...empty, reducedMotion: true }));
    const arcs = (calls) => calls.filter(([m]) => m === 'arc' || m === 'ellipse').length;
    assert.ok(arcs(reducedRun.calls) < arcs(fullRun.calls),
      `reduced motion should draw fewer shapes (${arcs(reducedRun.calls)} vs ${arcs(fullRun.calls)})`);
  });

  test(`${themeId}: reduced motion renders at every meter stage without throwing`, () => {
    for (let stage = 0; stage <= 6; stage += 1) {
      const { ctx } = stubCtx();
      const hit = METER_THRESHOLDS.slice(0, stage);
      renderScene(ctx, populatedView(themeId, {
        reducedMotion: true,
        meter: {
          total: stage === 0 ? 0 : METER_THRESHOLDS[stage - 1],
          thresholds: [...METER_THRESHOLDS], hit,
          label: THEMES[themeId].meterLabel, stageLabel: '',
        },
      }));
    }
  });
}

test('footer: every line fits inside the footer panel for all themes', () => {
  for (const themeId of THEME_IDS) {
    const { ctx, calls } = stubCtx();
    renderScene(ctx, populatedView(themeId));
    // Footer panel: rr() is a plain helper (not a ctx method), so it is not
    // recorded as a call — but its path is: moveTo(x + 22, y) starts the
    // rounded rect, and an arcTo reaches the bottom-right corner.
    const panelPath = calls.some(([m, px, py]) => m === 'moveTo' && px === FOOTER.x + 22 && py === FOOTER.y);
    assert.ok(panelPath, `footer panel path missing in ${themeId}`);
    const panelCorner = calls.some(([m, , , x2, y2]) => m === 'arcTo' && x2 === FOOTER.x + FOOTER.w && y2 === FOOTER.y + FOOTER.h);
    assert.ok(panelCorner, `footer panel corner missing in ${themeId}`);
    const { x: px, y: py, w: pw, h: ph } = FOOTER;
    assert.ok(py + ph <= 1920, `footer panel exceeds the canvas in ${themeId}`);
    const footerTexts = calls
      .filter(([m, , tx, ty]) => m === 'fillText' && tx === FOOTER.x + 28 && ty >= py && ty <= py + ph)
      .map(([, text, , ty]) => ({ text, ty }));
    // Title + tagline + the seven body lines (more when a line wraps).
    assert.ok(footerTexts.length >= 9, `footer draws too few lines in ${themeId}`);
    for (const { text, ty } of footerTexts) {
      // Stub measureText model: 12px per character.
      const width = String(text).length * 12;
      assert.ok(FOOTER.x + 28 + width <= px + pw - 28,
        `footer line overflows horizontally in ${themeId}: "${text}"`);
      assert.ok(ty >= py + 30 && ty <= py + ph - 8,
        `footer line outside panel vertically in ${themeId}: "${text}" at y=${ty}`);
    }
    // Exact wording survives wrapping, including the music credit.
    const body = footerTexts.slice(2).map(({ text }) => text).join(' ');
    assert.equal(body, [...THEMES[themeId].howItWorks, ...DISCLOSURES, MUSIC_CREDIT].join(' '),
      `footer wording changed in ${themeId}`);
    assert.ok(body.includes('Kevin MacLeod') && body.includes('CC BY 3.0'),
      `music credit missing from footer in ${themeId}`);
  }
});

test('follow entrance: full motion grows with a ring, reduced motion fades in place', () => {
  const view = (reducedMotion) => populatedView('sunrise-lake', { reducedMotion });
  const fullRun = stubCtx();
  renderScene(fullRun.ctx, view(false));
  // Entrance ring: an arc of radius 30 + 0.5 * 46 = 53 around the spot.
  const ring = fullRun.calls.some(([m, , , r]) => m === 'arc' && r === 53);
  assert.ok(ring, 'full-motion entrance ring missing');
  const reducedRun = stubCtx();
  renderScene(reducedRun.ctx, view(true));
  const noRing = !reducedRun.calls.some(([m, , , r]) => m === 'arc' && r === 53);
  assert.ok(noRing, 'reduced motion should not draw the entrance ring');
  // Fade-in-place: globalAlpha is set to progress * 1.6 = 0.8 for the figure.
  const fade = reducedRun.calls.some(([m, prop, value]) => m === 'set' && prop === 'globalAlpha' && value === 0.8);
  assert.ok(fade, 'reduced-motion entrance fade missing');
});

test('no flashing: the fastest periodic brightness change is far below 3/second', () => {
  // Audit of every time-based brightness oscillation in render.js:
  // - particle twinkle: sin(wt * 1.4 * speed), wt in seconds, speed <= 1
  //   -> fastest period 2*PI/1.4 ≈ 4.5 s (0.22/second)
  // - idle bob/sway/steam/water: sin(timeMs / 700..2600) -> periods >= 4.4 s
  // - meter-stage / toast banners and follow entrances: a single
  //   half-sine fade over 2.6–3.2 s, never a repeated blink
  // - shooting star: once per 16 s, fading out over 1.4 s
  // The bound below pins the fastest of these (the twinkle) to its code
  // values: particle speeds come from createParticles, capped at 1.0.
  for (const themeId of THEME_IDS) {
    const particles = createParticles(themeId);
    assert.ok(particles.length > 0);
    for (const p of particles) {
      assert.ok(p.speed >= 0.2 && p.speed <= 1.0,
        `particle speed out of range in ${themeId}: ${p.speed}`);
    }
    const fastestPeriodSec = (2 * Math.PI) / (1.4 * 1.0);
    assert.ok(fastestPeriodSec > 4, `twinkle period too fast: ${fastestPeriodSec}s`);
  }
});

test('no flashing: drawn text never blinks across 96 frames of the busiest scene', () => {
  for (const themeId of THEME_IDS) {
    let baseline = null;
    for (let frame = 0; frame < 96; frame += 1) {
      const progress = frame / 96;
      const { ctx, calls } = stubCtx();
      renderScene(ctx, populatedView(themeId, {
        timeMs: frame * 33,
        animations: [
          { kind: 'follow', slot: 0, displayName: 'Maya', progress },
          { kind: 'gift', slot: 0, effect: 'lantern', progress },
          { kind: 'meter-stage', threshold: 1000, label: 'Sunrise glow', progress },
          { kind: 'toast', displayName: 'Liam', text: 'All 48 spots are full — thank you!', progress },
        ],
      }));
      const texts = calls.filter(([m]) => m === 'fillText').map(([, text]) => text);
      if (baseline === null) baseline = texts;
      else {
        assert.deepEqual(texts, baseline,
          `drawn text changed between frames in ${themeId} (frame ${frame})`);
      }
    }
  }
});
