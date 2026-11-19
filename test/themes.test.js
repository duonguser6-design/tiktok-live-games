import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THEMES, THEME_IDS, DISCLOSURES, METER_THRESHOLDS,
  getTheme, isValidTheme, giftEffectFor,
} from '../src/themes.js';

const EXPECTED_THEMES = [
  'sunrise-lake', 'firefly-garden', 'starlight-observatory',
  'cozy-corner-cafe', 'balloon-sky',
];

test('all five themes exist and only those five', () => {
  assert.deepEqual([...THEME_IDS].sort(), [...EXPECTED_THEMES].sort());
  for (const id of EXPECTED_THEMES) assert.equal(isValidTheme(id), true);
  assert.equal(isValidTheme('temple'), false);
  assert.equal(getTheme('bogus').id, 'sunrise-lake');
});

for (const id of EXPECTED_THEMES) {
  test(`${id}: has exactly the fixed command set including !hide`, () => {
    const theme = THEMES[id];
    const commands = Object.keys(theme.commands);
    assert.equal(commands.length, 4);
    assert.ok(commands.includes('!hide'));
    assert.ok(commands.includes('!wave'));
    for (const cmd of commands) {
      assert.ok(cmd.startsWith('!'));
      assert.ok(theme.commands[cmd].action);
      assert.ok(theme.commands[cmd].description);
    }
    assert.equal(theme.commands['!hide'].action, 'hide');
  });

  test(`${id}: meter has 6 fixed thresholds with a stage label each`, () => {
    const theme = THEMES[id];
    assert.deepEqual(METER_THRESHOLDS, [100, 500, 1000, 2500, 5000, 10000]);
    assert.equal(theme.meterStages.length, 6);
    theme.meterStages.forEach((stage, i) => {
      assert.equal(stage.at, METER_THRESHOLDS[i]);
      assert.ok(stage.label.length > 3);
    });
    assert.ok(theme.meterLabel.length > 3);
  });

  test(`${id}: gift mapping is deterministic with one default fallback`, () => {
    const theme = THEMES[id];
    assert.ok(theme.giftEffects[theme.giftDefault]);
    // Same input, same output.
    assert.equal(giftEffectFor(id, '1', 'Rose'), giftEffectFor(id, '1', 'Rose'));
    assert.equal(giftEffectFor(id, '1', 'Rose'), giftEffectFor(id, '999', 'Rose'));
    // Unknown gift id/name falls back to the single default.
    assert.equal(giftEffectFor(id, '987654', 'ZqxUnknownGift'), theme.giftDefault);
    assert.equal(giftEffectFor(id, '', ''), theme.giftDefault);
    // Every mapped effect exists in the theme's effect list.
    for (const [, effectId] of theme.giftKeywords) {
      assert.ok(theme.giftEffects[effectId], `missing effect ${effectId}`);
    }
  });

  test(`${id}: has a spot noun, how-it-works lines, and a palette`, () => {
    const theme = THEMES[id];
    assert.ok(theme.spotNoun.length > 2);
    assert.equal(theme.howItWorks.length, 4);
    for (const key of ['skyTop', 'skyBottom', 'skyTopLate', 'skyBottomLate', 'accent', 'text', 'panel']) {
      assert.ok(theme.palette[key], `missing palette ${key}`);
    }
  });
}

test('disclosures carry the required lines', () => {
  assert.ok(DISCLOSURES.some((d) => d.includes('No prizes')));
  assert.ok(DISCLOSURES.some((d) => d.includes('cosmetic only, non-refundable, and give no gameplay advantage')));
  assert.ok(DISCLOSURES.some((d) => d.includes('not affiliated with or endorsed by TikTok')));
});

// User-facing strings must never contain calls-to-action, prize/gambling
// language, religious wording, or forbidden retention pressure. The only
// allowed "prize" wording is the "No prizes" disclosure itself.
const FORBIDDEN = [
  'follow to', 'follow now', 'follow me', 'send a gift', 'send gifts',
  'tap to', 'tap the screen', 'double tap', 'bless', 'pray', 'jackpot',
  'you win', 'win a', 'raffle', 'lottery', 'mystery box', 'loot',
  'countdown', 'lose it', 'leave and', 'streak', 'rare drop',
  'limited time', 'only a few left', 'hurry', 'donate',
];

test('no forbidden wording in any user-facing theme string', () => {
  const strings = [];
  for (const theme of Object.values(THEMES)) {
    strings.push(theme.name, theme.tagline, theme.spotLabel, theme.meterLabel);
    strings.push(...theme.howItWorks);
    strings.push(...theme.meterStages.map((s) => s.label));
    strings.push(...Object.values(theme.commands).map((c) => `${c.label} ${c.description}`));
    strings.push(...Object.values(theme.giftEffects).map((e) => e.label));
  }
  for (const s of strings) {
    const lower = s.toLowerCase();
    for (const phrase of FORBIDDEN) {
      assert.ok(!lower.includes(phrase), `forbidden phrase "${phrase}" in: ${s}`);
    }
    assert.ok(!/\bwin\b/.test(lower), `win wording in: ${s}`);
    assert.ok(!lower.includes('prize'), `prize wording in theme string: ${s}`);
  }
});
