import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeDisplayName } from '../src/nameFilter.js';

test('plain names pass through unchanged', () => {
  assert.deepEqual(sanitizeDisplayName('Maya'), { name: 'Maya', blocked: false, filtered: false });
  assert.deepEqual(sanitizeDisplayName('  Liam Smith  ').name, 'Liam Smith');
});

test('bidi and control characters are stripped', () => {
  const { name, blocked } = sanitizeDisplayName('Ma\u202eya\u200f');
  assert.equal(name, 'Maya');
  assert.equal(blocked, false);
});

test('zalgo combining-mark runs are tamed', () => {
  const zalgo = 'M' + '\u0301'.repeat(12) + 'aya';
  const { name } = sanitizeDisplayName(zalgo);
  // NFC may compose the first mark into the base letter; at most 2
  // combining marks may survive, and the readable tail stays intact.
  const combining = [...name].filter((c) => /[\u0300-\u036f]/.test(c)).length;
  assert.ok(combining <= 2, `combining marks left: ${combining}`);
  assert.ok(name.includes('aya'));
  assert.ok(name.length < zalgo.length);
});

test('long emoji runs are capped', () => {
  const { name } = sanitizeDisplayName('🔥'.repeat(10) + 'Maya');
  assert.ok(Array.from(name).filter((c) => /\p{Extended_Pictographic}/u.test(c)).length <= 6);
  assert.ok(name.includes('Maya'));
});

test('length is capped at 24 code points', () => {
  const { name, filtered } = sanitizeDisplayName('A'.repeat(60));
  assert.equal(Array.from(name).length, 24);
  assert.equal(filtered, true);
});

test('emails, URLs, and long digit runs are blocked', () => {
  assert.equal(sanitizeDisplayName('mail me a@b.com').blocked, true);
  assert.equal(sanitizeDisplayName('visit https://example.com').blocked, true);
  assert.equal(sanitizeDisplayName('call 0123456789').blocked, true);
  assert.equal(sanitizeDisplayName('user123').blocked, false);
});

test('impersonation patterns are blocked', () => {
  assert.equal(sanitizeDisplayName('TikTok Official').blocked, true);
  assert.equal(sanitizeDisplayName('tiktok support team').blocked, true);
  assert.equal(sanitizeDisplayName('admin').blocked, true);
  assert.equal(sanitizeDisplayName('StreamerFan', { streamerName: 'streamerfan' }).blocked, true);
  assert.equal(sanitizeDisplayName('TikTokFan99').blocked, false);
});

test('banned words are blocked, including with separators', () => {
  assert.equal(sanitizeDisplayName('SuperFucker').blocked, true);
  assert.equal(sanitizeDisplayName('sh.it happens').blocked, true);
  assert.equal(sanitizeDisplayName('ClassyMaya').blocked, false);
  assert.equal(sanitizeDisplayName('bloop', { extraBannedWords: 'bloop' }).blocked, true);
});

test('empty or fully-stripped names fall back to Viewer', () => {
  assert.equal(sanitizeDisplayName('').name, 'Viewer');
  assert.equal(sanitizeDisplayName('\u200e\u200f').name, 'Viewer');
  assert.equal(sanitizeDisplayName('   ').blocked, true);
});
