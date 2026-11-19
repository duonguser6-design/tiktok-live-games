import test from 'node:test';
import assert from 'node:assert/strict';
import { Dedupe } from '../src/dedupe.js';
import { CircuitBreaker, computeDelay } from '../src/reconnect.js';
import { AnimationQueue, PRIORITY } from '../src/queue.js';
import { RECONNECT } from '../src/config.js';

test('dedupe flags repeats and evicts oldest (FIFO)', () => {
  const d = new Dedupe(3);
  assert.equal(d.seen('a'), false);
  assert.equal(d.seen('a'), true);
  assert.equal(d.seen('b'), false);
  assert.equal(d.seen('c'), false);
  assert.equal(d.seen('d'), false); // evicts 'a'
  assert.equal(d.seen('a'), false);
  assert.equal(d.size, 3);
});

test('backoff delay grows exponentially within jitter bounds', () => {
  const zero = () => 0.5; // no jitter at 0.5
  assert.equal(computeDelay(0, RECONNECT, zero), 2000);
  assert.equal(computeDelay(1, RECONNECT, zero), 4000);
  assert.equal(computeDelay(4, RECONNECT, zero), 32000);
  assert.equal(computeDelay(9, RECONNECT, zero), 32000); // capped
  const low = () => 0;
  assert.equal(computeDelay(0, RECONNECT, low), 1400); // -30%
  const high = () => 1;
  assert.equal(computeDelay(0, RECONNECT, high), 2600); // +30%
});

test('circuit breaker opens after max attempts and probes after cooldown', () => {
  let now = 0;
  const breaker = new CircuitBreaker(RECONNECT, () => now);
  assert.equal(breaker.canAttempt(), true);
  for (let i = 0; i < RECONNECT.maxAttempts - 1; i += 1) {
    assert.equal(breaker.recordFailure(), 'closed');
  }
  assert.equal(breaker.recordFailure(), 'open');
  assert.equal(breaker.canAttempt(), false);
  now += RECONNECT.openCooldownMs - 1;
  assert.equal(breaker.canAttempt(), false);
  now += 1;
  assert.equal(breaker.canAttempt(), true); // half-open probe
  assert.equal(breaker.recordFailure(), 'open'); // probe failed: open again
  now += RECONNECT.openCooldownMs;
  assert.equal(breaker.canAttempt(), true);
  breaker.recordSuccess();
  assert.equal(breaker.state, 'closed');
  assert.equal(breaker.failures, 0);
});

test('queue enforces minimum spacing', () => {
  let now = 100000;
  const q = new AnimationQueue({ cap: 10, minSpacingMs: 600, nowFn: () => now });
  q.push({ kind: 'a', priority: PRIORITY.command });
  q.push({ kind: 'b', priority: PRIORITY.command });
  assert.equal(q.next().kind, 'a');
  assert.equal(q.next(), null); // too soon
  now += 600;
  assert.equal(q.next().kind, 'b');
});

test('queue orders by priority then arrival, and drops lowest on overflow', () => {
  const q = new AnimationQueue({ cap: 3, minSpacingMs: 0, nowFn: () => 0 });
  q.push({ kind: 'ambient1', priority: PRIORITY.ambient });
  q.push({ kind: 'ambient2', priority: PRIORITY.ambient });
  q.push({ kind: 'cmd', priority: PRIORITY.command });
  // Queue full: a follow displaces the oldest ambient item.
  const res = q.push({ kind: 'follow', priority: PRIORITY.follow });
  assert.equal(res.queued, true);
  assert.equal(res.displaced.kind, 'ambient1');
  assert.equal(q.dropped, 1);
  // A new ambient item cannot displace anything: dropped itself.
  const res2 = q.push({ kind: 'ambient3', priority: PRIORITY.ambient });
  assert.equal(res2.queued, false);
  assert.equal(q.dropped, 2);
  // Dispatch order: follow, command, ambient2.
  assert.equal(q.next().kind, 'follow');
  assert.equal(q.next().kind, 'cmd');
  assert.equal(q.next().kind, 'ambient2');
});
