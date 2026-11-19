import test from 'node:test';
import assert from 'node:assert/strict';
import { SimulatorAdapter, fakeUserId } from '../src/adapters/simulatorAdapter.js';
import { ManualAdapter, manualUserId } from '../src/adapters/manualAdapter.js';
import { LiveAdapter, liveConnectionOptions } from '../src/adapters/liveAdapter.js';

test('simulator and manual adapters share one normalized interface', () => {
  const sim = new SimulatorAdapter();
  const manual = new ManualAdapter();
  const seen = [];
  sim.onEvent((e) => seen.push(e));
  manual.onEvent((e) => seen.push(e));

  sim.follow('Maya');
  sim.comment('Maya', '!cast');
  sim.likes('Maya', 25);
  sim.gift('Maya', 'Rose', '1', 3, true);
  manual.follow('Liam');
  manual.comment('Liam', '!wave');
  manual.likes('Liam', 10);
  manual.gift('Liam', 'Star');

  assert.equal(seen.length, 8);
  for (const e of seen) {
    assert.ok(e.msgId);
    assert.ok(e.userId);
    assert.ok(e.timestamp);
    assert.ok(['follow', 'comment', 'like', 'gift'].includes(e.type));
  }
  assert.equal(seen[0].source, 'simulator');
  assert.equal(seen[4].source, 'manual');
  assert.equal(seen[0].userId, fakeUserId('Maya'));
  assert.equal(seen[4].userId, manualUserId('Liam'));
  assert.equal(seen[1].command, '!cast');
  assert.equal(seen[2].likeCount, 25);
  assert.equal(seen[3].repeatEnd, true);
  assert.equal(seen[3].giftName, 'Rose');
  // Same fake name, same user id: the 1-spot rule works in simulation.
  assert.equal(seen[0].userId, seen[1].userId);
  // Every event has a unique message id.
  assert.equal(new Set(seen.map((e) => e.msgId)).size, 8);
});

test('live connection options never include credentials or auth', () => {
  const opts = liveConnectionOptions();
  assert.equal(opts.processInitialData, false);
  assert.equal(opts.fetchRoomInfoOnConnect, true);
  assert.equal(opts.enableExtendedGiftInfo, false);
  for (const key of ['session', 'authenticateWs', 'useMobile', 'signApiKey', 'eulerApiInstance', 'cookie']) {
    assert.ok(!(key in opts), `forbidden option present: ${key}`);
  }
});

// Fake connector: records handler subscriptions and calls, never networks.
class FakeConnection {
  constructor() {
    this.handlers = new Map();
    this.isConnected = false;
    this.connectCalls = 0;
    this.disconnectCalls = 0;
    this.sendMessageCalls = 0;
    this.failConnect = false;
  }

  on(event, handler) {
    if (!this.handlers.has(event)) this.handlers.set(event, []);
    this.handlers.get(event).push(handler);
  }

  emit(event, payload) {
    for (const h of this.handlers.get(event) || []) h(payload);
  }

  async connect() {
    this.connectCalls += 1;
    if (this.failConnect) throw new Error('fake signing failure');
    this.isConnected = true;
    return { state: 'connected' };
  }

  async disconnect() {
    this.disconnectCalls += 1;
    this.isConnected = false;
  }

  async sendMessage() {
    this.sendMessageCalls += 1;
  }
}

function liveMsg(partial) {
  return {
    common: { msgId: partial.msgId || 'msg-1', createTime: '1700000000000' },
    user: { id: partial.userId || 'u1', nickname: partial.displayName || 'Maya' },
    ...partial.payload,
  };
}

test('live adapter maps connector messages to normalized events', async () => {
  const conn = new FakeConnection();
  const adapter = new LiveAdapter({
    uniqueId: 'someone',
    connectionFactory: () => conn,
    sleepFn: () => Promise.resolve(),
  });
  const seen = [];
  adapter.onEvent((e) => seen.push(e));
  await adapter.start();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(conn.connectCalls, 1);

  conn.emit('chat', liveMsg({ msgId: 'c1', payload: { content: '!cast please' } }));
  conn.emit('gift', liveMsg({
    msgId: 'g1',
    payload: { giftId: '5655', gift: { name: 'Rose' }, repeatCount: 3, repeatEnd: 1 },
  }));
  conn.emit('gift', liveMsg({
    msgId: 'g2',
    payload: { giftId: '5655', gift: { name: 'Rose' }, repeatCount: 1, repeatEnd: 0 },
  }));
  conn.emit('like', liveMsg({ msgId: 'l1', payload: { count: 12, total: '1042' } }));
  conn.emit('follow', liveMsg({ msgId: 'f1' }));

  assert.equal(seen.length, 5);
  const [chat, giftFinal, giftPartial, like, follow] = seen;
  assert.equal(chat.type, 'comment');
  assert.equal(chat.command, '!cast');
  assert.equal(chat.msgId, 'c1');
  assert.equal(giftFinal.type, 'gift');
  assert.equal(giftFinal.repeatEnd, true);
  assert.equal(giftFinal.giftName, 'Rose');
  assert.equal(giftPartial.repeatEnd, false);
  assert.equal(like.likeCount, 12);
  assert.equal(like.likeTotal, 1042);
  assert.equal(follow.type, 'follow');
  assert.equal(follow.userId, 'u1');

  await adapter.stop();
  assert.ok(conn.disconnectCalls >= 1);
  assert.equal(conn.sendMessageCalls, 0);
});

test('live adapter backs off and pauses after repeated failures (no hammering)', async () => {
  const conn = new FakeConnection();
  conn.failConnect = true;
  const delays = [];
  const statuses = [];
  const adapter = new LiveAdapter({
    uniqueId: 'someone',
    connectionFactory: () => conn,
    // Small real delay (not an immediately-resolved promise) so the
    // reconnect loop yields to the event loop instead of starving timers.
    sleepFn: (ms) => { delays.push(ms); return new Promise((r) => setTimeout(r, 1)); },
    onStatus: ({ status }) => statuses.push(status),
  });
  await adapter.start();
  await new Promise((r) => setTimeout(r, 60));
  await adapter.stop();
  assert.ok(conn.connectCalls >= 5, `expected >=5 attempts, got ${conn.connectCalls}`);
  assert.ok(statuses.includes('paused'), `expected paused status, got ${statuses.join(',')}`);
  // First backoff delay is within the jittered 2s band.
  assert.ok(delays.length >= 1);
  assert.ok(delays[0] >= 1400 && delays[0] <= 2600, `first delay ${delays[0]}`);
  // Paused waits use the 5s status sleep, not reconnect attempts.
  assert.ok(delays.includes(5000));
  assert.equal(conn.sendMessageCalls, 0);
});

test('live adapter stop disconnects (kill-switch path)', async () => {
  const conn = new FakeConnection();
  const adapter = new LiveAdapter({
    uniqueId: 'someone',
    connectionFactory: () => conn,
    sleepFn: () => Promise.resolve(),
  });
  await adapter.start();
  await new Promise((r) => setTimeout(r, 30));
  assert.equal(conn.isConnected, true);
  await adapter.stop();
  assert.equal(conn.isConnected, false);
  assert.ok(conn.disconnectCalls >= 1);
  assert.equal(adapter.status, 'stopped');
});
