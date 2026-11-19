import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { THEMES, DISCLOSURES, MUSIC_CREDIT } from '../src/themes.js';
import { BANNED_WORDS } from '../src/lake3d-config.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Call-to-action / prize / pressure patterns. Bare words like "follow" or
// "gift" are NOT flagged: the overlay describes what a follow does
// ("A follow adds a thank-you boat"), which is literal, not a
// solicitation. Only imperative or reward phrasing is forbidden.
//
// Word ban (Claude round 3): no wording may suggest that interacting
// advances, unlocks, or levels anything up. Board bans: the HOW TO PLAY
// board never promises joining, appearing, or staying, and never offers
// a turn. Promise ban: no sentence may promise recompense for
// interaction — no reward, blessing, luck, fortune, universe, destiny,
// or fate language tied to a viewer action. A plain post-hoc thank-you
// ("thank you", a name) is allowed; a promise is not.
const FORBIDDEN = [
  /follow (to|now|me|for|us)\b/i, /\bhit follow\b/i, /\btap to follow\b/i,
  /send (a )?gifts?\b/i, /gift (now|to|for)\b/i,
  /\bunlock\b/i, /\bfree\b/i, /\bprize\b/i, /\bjackpot\b/i,
  /\bwin\b/i, /\bwinner\b/i, /\braffle\b/i, /\blottery\b/i,
  /\bmystery box\b/i, /\bloot\b/i, /\bcountdown\b/i, /\bstreak\b/i,
  /\bleaderboard\b/i, /limited time/i, /\bhurry\b/i, /\bdonate\b/i,
  /\bbless(ed|ing)?\b/i, /\bpray\b/i, /double tap/i, /tap (the screen|to)\b/i,
  /lose it\b/i, /only a few left/i,
  /\bupgrade\b/i, /\blevel\b/i, /\brare\b/i, /\bcollect\b/i,
  /\bto (join|appear|stay)\b/i, /\byour turn\b/i, /\bstay to\b/i,
  /free commands/i, /no gift needed/i,
  /\breward(ed|s)?\b/i, /\buniverse\b/i, /\bfortune\b/i,
  /\bluck(y)?\b/i, /\bdestiny\b/i, /\bfate\b/i,
];

// Progress-suggestion patterns: nothing may imply that interacting moves
// a viewer forward. Applied to the same UI strings as FORBIDDEN, except
// public/render.js: its line-12 code comment quotes the word "progress"
// about the shared scene, and render.js is not owned by this change, so
// the progress patterns skip that one file (its string literals are still
// covered by FORBIDDEN above).
const PROGRESS_FORBIDDEN = [
  /try\s+!/i, /interact to/i, /\bearn\b/i, /\bprogress\b/i,
  /\bto (progress|advance)\b/i,
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

// The ban list defines itself: the BANNED_WORDS export in lake3d-config.js
// quotes the banned words as data. That one line is the definition of the
// ban, not user-facing wording, so it is removed before the literal scan;
// every other literal in the file is still scanned at full strength.
function stripBanListDefinition(source) {
  return source
    .split('\n')
    .filter((line) => !line.includes('BANNED_WORDS ='))
    .join('\n');
}

// Machine-readable kebab-case tokens (ingest reason codes such as
// "streak-not-final", animation kind ids such as "meter-stage") are
// internal identifiers returned to adapters and tests, never shown to
// viewers. The legacy tests assert the reason strings, so they cannot
// be reworded; the UI scan covers the prose literals instead (toast
// text, labels, descriptions). This filter removes identifiers only.
function uiLiterals(source) {
  return jsLiterals(source).filter((lit) => !/^[a-z][a-z0-9]*(-[a-z0-9]+)+$/.test(lit));
}

function check(strings, where, patterns = FORBIDDEN) {
  for (const s of strings) {
    const text = clean(s);
    for (const pattern of patterns) {
      assert.ok(!pattern.test(text), `forbidden ${pattern} in ${where}: ${JSON.stringify(s)}`);
    }
  }
}

test('no calls-to-action or prize wording in any UI string', () => {
  check(themeStrings(), 'themes.js');
  check(themeStrings(), 'themes.js (progress)', PROGRESS_FORBIDDEN);
  const controlHtml = readFileSync(path.join(ROOT, 'public', 'control.html'), 'utf8');
  // The Simulator and Manual cards are operator-only trigger labels
  // ("Send gift", "Fake follow" are buttons the streamer clicks, never
  // wording shown to viewers); scan the rest of the panel.
  const simAt = controlHtml.indexOf('<h2>Simulator</h2>');
  const logAt = controlHtml.indexOf('<h2>Recent activity</h2>');
  assert.ok(simAt > 0 && logAt > simAt, 'control.html section markers moved');
  const panel = controlHtml.slice(0, simAt) + controlHtml.slice(logAt);
  check([visibleText(panel)], 'control.html');
  check([visibleText(panel)], 'control.html (progress)', PROGRESS_FORBIDDEN);
  const overlayHtml = readFileSync(path.join(ROOT, 'public', 'overlay.html'), 'utf8');
  check([visibleText(overlayHtml)], 'overlay.html');
  check([visibleText(overlayHtml)], 'overlay.html (progress)', PROGRESS_FORBIDDEN);
  for (const file of ['control.js', 'overlay.js', 'render.js']) {
    const source = readFileSync(path.join(ROOT, 'public', file), 'utf8');
    check(jsLiterals(source), file);
  }
  // Progress patterns skip render.js (see PROGRESS_FORBIDDEN comment).
  for (const file of ['control.js', 'overlay.js']) {
    const source = readFileSync(path.join(ROOT, 'public', file), 'utf8');
    check(jsLiterals(source), `${file} (progress)`, PROGRESS_FORBIDDEN);
  }
  // Lake 3D sources: the config (ban-list definition stripped), the game
  // state, and the 3D renderer when it exists.
  const lakeConfig = stripBanListDefinition(
    readFileSync(path.join(ROOT, 'src', 'lake3d-config.js'), 'utf8'),
  );
  check(jsLiterals(lakeConfig), 'src/lake3d-config.js');
  check(jsLiterals(lakeConfig), 'src/lake3d-config.js (progress)', PROGRESS_FORBIDDEN);
  const gameState = readFileSync(path.join(ROOT, 'src', 'gameState.js'), 'utf8');
  check(uiLiterals(gameState), 'src/gameState.js');
  check(uiLiterals(gameState), 'src/gameState.js (progress)', PROGRESS_FORBIDDEN);
  const render3d = path.join(ROOT, 'public', 'render3d.js');
  if (existsSync(render3d)) {
    const source = readFileSync(render3d, 'utf8');
    check(jsLiterals(source), 'public/render3d.js');
    check(jsLiterals(source), 'public/render3d.js (progress)', PROGRESS_FORBIDDEN);
  }
});

// README is prose documentation, so only the word ban and the board bans
// apply there — not the full CTA list (prose legitimately describes
// follow/like behaviour). Fenced code blocks are stripped first, since
// code samples may quote command names.
test('README visible text: word ban and board bans only', () => {
  const readme = readFileSync(path.join(ROOT, 'README.md'), 'utf8');
  const noFences = readme.replace(/```[\s\S]*?```/g, ' ');
  const text = visibleText(noFences);
  const patterns = [
    ...BANNED_WORDS.map((w) => new RegExp(`\\b${w}\\b`, 'i')),
    /\bto (join|appear|stay)\b/i, /\byour turn\b/i, /\bstay to\b/i,
    /free commands/i, /no gift needed/i,
  ];
  for (const pattern of patterns) {
    assert.ok(!pattern.test(text), `forbidden ${pattern} in README.md`);
  }
});
