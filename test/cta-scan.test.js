import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, DISCLOSURES, MUSIC_CREDIT } from '../src/themes.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Call-to-action / prize / pressure patterns. Bare words like "follow" or
// "gift" are NOT flagged: the overlay describes what a follow does
// ("A follow adds a thank-you boat"), which is literal, not a
// solicitation. Only imperative or reward phrasing is forbidden.
const FORBIDDEN = [
  /follow (to|now|me|for|us)\b/i, /\bhit follow\b/i, /\btap to follow\b/i,
  /send (a )?gifts?\b/i, /gift (now|to|for)\b/i,
  /\bunlock\b/i, /\bfree\b/i, /\bprize\b/i, /\bjackpot\b/i,
  /\bwin\b/i, /\bwinner\b/i, /\braffle\b/i, /\blottery\b/i,
  /\bmystery box\b/i, /\bloot\b/i, /\bcountdown\b/i, /\bstreak\b/i,
  /\bleaderboard\b/i, /limited time/i, /\bhurry\b/i, /\bdonate\b/i,
  /\bbless\b/i, /\bpray\b/i, /double tap/i, /tap (the screen|to)\b/i,
  /lose it\b/i, /only a few left/i,
];

// The disclosure "No prizes." is the required negation, not a prize tease.
function clean(text) {
  return String(text).replace(/no prizes\.?/gi, '');
}

function themeStrings() {
  const out = [];
  for (const theme of Object.values(THEMES)) {
    const walk = (v) => {
      if (typeof v === 'string') out.push(v);
      else if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') Object.values(v).forEach(walk);
    };
    walk(theme);
  }
  out.push(...DISCLOSURES, MUSIC_CREDIT);
  return out;
}

function visibleText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&');
}

// String literals from a JS source file (no apostrophes in comments in
// these files, so a plain literal scan is safe).
function jsLiterals(source) {
  const out = [];
  const re = /'([^'\\\n]*)'|"([^"\\\n]*)"|`([^`\\]*)`/g;
  let m;
  while ((m = re.exec(source)) !== null) out.push(m[1] ?? m[2] ?? m[3]);
  return out;
}

function check(strings, where) {
  for (const s of strings) {
    const text = clean(s);
    for (const pattern of FORBIDDEN) {
      assert.ok(!pattern.test(text), `forbidden ${pattern} in ${where}: ${JSON.stringify(s)}`);
    }
  }
}

test('no calls-to-action or prize wording in any UI string', () => {
  check(themeStrings(), 'themes.js');
  const controlHtml = readFileSync(path.join(ROOT, 'public', 'control.html'), 'utf8');
  // The Simulator and Manual cards are operator-only trigger labels
  // ("Send gift", "Fake follow" are buttons the streamer clicks, never
  // wording shown to viewers); scan the rest of the panel.
  const simAt = controlHtml.indexOf('<h2>Simulator</h2>');
  const logAt = controlHtml.indexOf('<h2>Recent activity</h2>');
  assert.ok(simAt > 0 && logAt > simAt, 'control.html section markers moved');
  const panel = controlHtml.slice(0, simAt) + controlHtml.slice(logAt);
  check([visibleText(panel)], 'control.html');
  const overlayHtml = readFileSync(path.join(ROOT, 'public', 'overlay.html'), 'utf8');
  check([visibleText(overlayHtml)], 'overlay.html');
  for (const file of ['control.js', 'overlay.js', 'render.js']) {
    const source = readFileSync(path.join(ROOT, 'public', file), 'utf8');
    check(jsLiterals(source), file);
  }
});
