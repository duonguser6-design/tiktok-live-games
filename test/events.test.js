import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEvent, parseCommand, syntheticMsgId } from '../src/events.js';

test('normalizeEvent validates type and userId', () => {
  assert.equal(normalizeEvent(null, 'live'), null);
  assert.equal(normalizeEvent({ type: 'bogus', userId: '1' }, 'live'), null);
  assert.equal(normalizeEvent({ type: 'follow' }, 'live'), null);
  const ev = normalizeEvent({ type: 'follow', userId: 'u1', displayName: 'Maya' }, 'live');
  assert.equal(ev.type, 'follow');
  assert.equal(ev.source, 'live');
  assert.ok(ev.msgId.startsWith('synth:'));
});

test('synthetic msgIds are deterministic for the same payload', () => {
  const a = syntheticMsgId('live', { type: 'like', userId: 'u1', timestamp: 5, likeCount: 3 });
  const b = syntheticMsgId('live', { type: 'like', userId: 'u1', timestamp: 5, likeCount: 3 });
  assert.equal(a, b);
});

test('comment commands are parsed from the first token only', () => {
  assert.equal(parseCommand('!cast please'), '!cast');
  assert.equal(parseCommand('  !WAVE  '), '!wave');
  assert.equal(parseCommand('hello !cast'), null);
  assert.equal(parseCommand('!'), '!');
  assert.equal(parseCommand('!' + 'x'.repeat(40)), null);
  const ev = normalizeEvent({ type: 'comment', userId: 'u1', text: '!bait now' }, 'simulator');
  assert.equal(ev.command, '!bait');
});

test('comment text is capped and numbers are coerced', () => {
  const ev = normalizeEvent({
    type: 'like', userId: 'u1', text: 'x'.repeat(500),
    likeCount: '42', likeTotal: '1000',
  }, 'live');
  assert.equal(ev.text.length, 128);
  assert.equal(ev.likeCount, 42);
  assert.equal(ev.likeTotal, 1000);
});

test('repeatEnd accepts 1, true, and "1"', () => {
  const base = { type: 'gift', userId: 'u1', giftId: '1' };
  assert.equal(normalizeEvent({ ...base, repeatEnd: 1 }, 'live').repeatEnd, true);
  assert.equal(normalizeEvent({ ...base, repeatEnd: true }, 'live').repeatEnd, true);
  assert.equal(normalizeEvent({ ...base, repeatEnd: 0 }, 'live').repeatEnd, false);
  assert.equal(normalizeEvent({ ...base }, 'live').repeatEnd, false);
});
