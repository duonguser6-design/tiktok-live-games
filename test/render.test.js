import test from 'node:test';
import assert from 'node:assert/strict';
import { renderScene, createParticles, spotPosition, CANVAS_W, CANVAS_H, FOOTER } from '../public/render.js';
import { THEMES, THEME_IDS, DISCLOSURES, MUSIC_CREDIT, METER_THRESHOLDS } from '../src/themes.js';

// Stub 2D context: records every method call and property set, never draws.
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
      { slot: 1, displayName: 'Liam', hidden: false, decorations: ['butterfly', 'cloud'], lastAction: 'wave', lastActionAt: 900 },
      { slot: 2, displayName: '', hidden: true, decorations: [], lastAction: null, lastActionAt: 0 },
    ],
    meter: {
      total: 1240, thresholds: [...METER_THRESHOLDS], hit: [100, 500, 1000],
      label: theme.meterLabel, stageLabel: theme.meterStages[2].label,
    },
    animations: [
      { kind: 'follow', slot: 0, displayName: 'Maya', progress: 0.5 },
      { kind: 'command', slot: 1, action: 'wave', progress: 0.4 },
      { kind: 'gift', slot: 0, effect: 'lantern', progress: 0.3 },
      { kind: 'meter-stage', threshold: 1000, label: 'Sunrise glow', progress: 0.5 },
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

test('toast renders its explicit text, or the thank-you fallback', () => {
  const { ctx, calls } = stubCtx();
  renderScene(ctx, populatedView('sunrise-lake', {
    spots: [],
    animations: [{ kind: 'toast', displayName: 'Late', text: 'All 48 spots are full — thank you!', progress: 0.5 }],
  }));
  const texts = calls.filter(([m]) => m === 'fillText').map(([, text]) => text);
  assert.ok(texts.includes('All 48 spots are full — thank you!'));
  const stub2 = stubCtx();
  renderScene(stub2.ctx, populatedView('sunrise-lake', {
    spots: [],
    animations: [{ kind: 'toast', displayName: 'Maya', progress: 0.5 }],
  }));
  const texts2 = stub2.calls.filter(([m]) => m === 'fillText').map(([, text]) => text);
  assert.ok(texts2.includes('Thank you, Maya'));
});

test('canvas size is 1080x1920', () => {
  assert.equal(CANVAS_W, 1080);
  assert.equal(CANVAS_H, 1920);
});

test('particles and spot positions are deterministic', () => {
  assert.deepEqual(createParticles('sunrise-lake'), createParticles('sunrise-lake'));
  assert.notDeepEqual(createParticles('sunrise-lake'), createParticles('balloon-sky'));
  const a = spotPosition(3, 5000, 'sunrise-lake');
  const b = spotPosition(3, 5000, 'sunrise-lake');
  assert.deepEqual(a, b);
  const c = spotPosition(4, 5000, 'sunrise-lake');
  assert.ok(a.x !== c.x || a.y !== c.y);
});

for (const themeId of THEME_IDS) {
  test(`${themeId}: renders an empty scene without throwing`, () => {
    const { ctx, calls } = stubCtx();
    const view = populatedView(themeId, {
      spots: [], animations: [],
      meter: { total: 0, thresholds: [...METER_THRESHOLDS], hit: [], label: '', stageLabel: '' },
    });
    renderScene(ctx, view);
    assert.ok(calls.some(([m]) => m === 'fillRect'), 'expected background fill');
    assert.ok(calls.some(([m]) => m === 'clearRect'), 'expected transparent clear');
  });

  test(`${themeId}: renders a populated scene, names, meter, and disclosures`, () => {
    const { ctx, calls } = stubCtx();
    renderScene(ctx, populatedView(themeId));
    const texts = calls.filter(([m]) => m === 'fillText').map(([, text]) => text);
    // Follow spot names are drawn and readable.
    assert.ok(texts.includes('Maya'), `Maya missing in ${themeId}: ${texts.join(' | ')}`);
    assert.ok(texts.includes('Liam'));
    // Hidden names are never drawn.
    assert.ok(!texts.some((t) => t === ''), 'empty name pill drawn');
    // Meter label and total are drawn.
    assert.ok(texts.some((t) => t.includes(THEMES[themeId].meterLabel)));
    assert.ok(texts.some((t) => t.includes('1,240')));
    // Footer body lines wrap, so no single fillText carries a whole long
    // line — but the exact wording survives: joining the wrapped body
    // lines (everything after the title + tagline) reproduces the source
    // how-it-works, disclosure, and music-credit lines verbatim.
    const footerTexts = calls
      .filter(([m, , tx, ty]) => m === 'fillText' && tx === FOOTER.x + 28 && ty >= FOOTER.y)
      .map(([, text]) => text);
    const footerBody = footerTexts.slice(2).join(' ');
    assert.equal(footerBody, [...THEMES[themeId].howItWorks, ...DISCLOSURES, MUSIC_CREDIT].join(' '),
      `footer wording changed in ${themeId}: ${footerBody}`);
    // The on-screen music credit (CC BY 3.0) is actually drawn.
    assert.ok(texts.some((t) => t.includes('Kevin MacLeod') && t.includes('CC BY 3.0')),
      `music credit missing in ${themeId}`);
    // Camera window is cut out (destination-out composite used).
    assert.ok(calls.some(([m, prop, value]) => m === 'set' && prop === 'globalCompositeOperation' && value === 'destination-out'));
  });

  test(`${themeId}: renders paused and stopped states with a calm notice`, () => {
    const { ctx, calls } = stubCtx();
    renderScene(ctx, populatedView(themeId, { paused: true }));
    const texts = calls.filter(([m]) => m === 'fillText').map(([, text]) => text);
    assert.ok(texts.some((t) => t.includes('Paused')));
    const stub2 = stubCtx();
    renderScene(stub2.ctx, populatedView(themeId, { killed: true }));
    const texts2 = stub2.calls.filter(([m]) => m === 'fillText').map(([, text]) => text);
    assert.ok(texts2.some((t) => t.includes('stopped')));
  });

  test(`${themeId}: renders every gift effect glyph without throwing`, () => {
    const { ctx } = stubCtx();
    const theme = THEMES[themeId];
    const spots = Object.keys(theme.giftEffects).map((effect, i) => ({
      slot: i, displayName: `V${i}`, hidden: false,
      decorations: [effect], lastAction: null, lastActionAt: 0,
    }));
    const view = populatedView(themeId, { spots, animations: [] });
    renderScene(ctx, view);
    // Also exercise the floating gift animation for each effect.
    for (const effect of Object.keys(theme.giftEffects)) {
      const stub = stubCtx();
      renderScene(stub.ctx, populatedView(themeId, {
        spots: [],
        animations: [{ kind: 'gift-scene', effect, displayName: 'Maya', progress: 0.5 }],
      }));
    }
  });

  test(`${themeId}: renders at every meter stage without throwing`, () => {
    for (let stage = 0; stage <= 6; stage += 1) {
      const { ctx } = stubCtx();
      const hit = METER_THRESHOLDS.slice(0, stage);
      renderScene(ctx, populatedView(themeId, {
        meter: {
          total: stage === 0 ? 0 : METER_THRESHOLDS[stage - 1],
          thresholds: [...METER_THRESHOLDS], hit,
          label: THEMES[themeId].meterLabel, stageLabel: '',
        },
      }));
    }
  });
}
