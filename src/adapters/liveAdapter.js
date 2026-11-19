// Live TikTok adapter — UNVERIFIED. This code has never been run against a
// real TikTok LIVE session (no live connection was made during development).
// It wires the pinned tiktok-live-connector library (read-only, public
// username only) to the shared normalized-event interface. Before any real
// use, the streamer must test it on their own LIVE and accept the
// account-enforcement risk described in README.
//
// Hard rules enforced here:
//  - No session cookies, no OAuth tokens, no authenticated websocket.
//    The connector is constructed WITHOUT session/authenticateWs/useMobile.
//  - Never calls sendMessage() or any chat-sending route.
//  - processInitialData: false, so replayed history is not treated as live.
//  - Reconnects go through the circuit breaker: repeated signing/block
//    errors pause instead of hammering retries.
//  - Only chat/gift/like/follow events are consumed. Shares and joins have
//    no game effect. Gift events are passed through raw; the game state
//    applies the streak-end-only rule.

import { EventAdapter } from './base.js';
import { CircuitBreaker, computeDelay } from '../reconnect.js';
import { RECONNECT } from '../config.js';

function userOf(msg) {
  const user = msg && msg.user;
  return {
    userId: user && user.id ? String(user.id) : '',
    displayName: user && user.nickname ? String(user.nickname) : '',
  };
}

function msgIdOf(msg, fallback) {
  const id = msg && msg.common && msg.common.msgId;
  return id ? String(id) : fallback;
}

function createTimeOf(msg) {
  const raw = msg && msg.common && msg.common.createTime;
  const n = raw ? Number(raw) : NaN;
  return Number.isFinite(n) && n > 0 ? n : Date.now();
}

/** Connection options for the live adapter. Kept as a separate export so
 * tests can prove no credential/session option is ever passed. */
export function liveConnectionOptions() {
  return {
    processInitialData: false,
    fetchRoomInfoOnConnect: true,
    enableExtendedGiftInfo: false,
    // Deliberately absent: session, authenticateWs, useMobile, signApiKey.
    // Read-only by public username; signing uses the library default
    // (third-party Euler Stream signing — see README disclosure).
  };
}

export class LiveAdapter extends EventAdapter {
  constructor(options) {
    super('live', 'live');
    this.uniqueId = options.uniqueId;
    this.connectionFactory = options.connectionFactory; // injected in tests
    this.onStatus = options.onStatus || (() => {});
    this.reconnectOptions = options.reconnectOptions || RECONNECT;
    this.breaker = new CircuitBreaker(this.reconnectOptions, options.nowFn);
    this.sleepFn = options.sleepFn || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.connection = null;
    this.stopped = true;
    this.loopRunning = false;
    this.statusDetail = 'idle';
  }

  setStatus(detail) {
    this.statusDetail = detail;
    this.onStatus({ adapter: 'live', status: detail });
  }

  async createConnection() {
    if (this.connectionFactory) return this.connectionFactory(this.uniqueId);
    const { TikTokLiveConnection } = await import('tiktok-live-connector');
    return new TikTokLiveConnection(this.uniqueId, liveConnectionOptions());
  }

  attachHandlers(connection) {
    connection.on('chat', (msg) => {
      const { userId, displayName } = userOf(msg);
      if (!userId) return;
      this.emit({
        msgId: msgIdOf(msg, ''),
        type: 'comment',
        userId,
        displayName,
        text: typeof msg.content === 'string' ? msg.content : '',
        timestamp: createTimeOf(msg),
      });
    });
    connection.on('gift', (msg) => {
      const { userId, displayName } = userOf(msg);
      if (!userId) return;
      const gift = msg.gift || {};
      const extended = msg.extendedGiftInfo || {};
      this.emit({
        msgId: msgIdOf(msg, ''),
        type: 'gift',
        userId,
        displayName,
        giftId: msg.giftId != null ? String(msg.giftId) : '',
        giftName: extended.name || gift.name || gift.giftNameKey || '',
        repeatCount: msg.repeatCount || 0,
        repeatEnd: msg.repeatEnd === 1 || msg.repeatEnd === true,
        timestamp: createTimeOf(msg),
      });
    });
    connection.on('like', (msg) => {
      const { userId, displayName } = userOf(msg);
      if (!userId) return;
      this.emit({
        msgId: msgIdOf(msg, ''),
        type: 'like',
        userId,
        displayName,
        likeCount: msg.count,
        likeTotal: msg.total,
        timestamp: createTimeOf(msg),
      });
    });
    connection.on('follow', (msg) => {
      const { userId, displayName } = userOf(msg);
      if (!userId) return;
      this.emit({
        msgId: msgIdOf(msg, ''),
        type: 'follow',
        userId,
        displayName,
        timestamp: createTimeOf(msg),
      });
    });
    // Control events: keep the reconnect loop informed, never log payloads.
    if (typeof connection.on === 'function') {
      connection.on('disconnected', () => {
        if (!this.stopped) this.handleDisconnect('disconnected');
      });
      connection.on('error', () => {
        if (!this.stopped) this.handleDisconnect('error');
      });
      connection.on('streamEnd', () => {
        if (!this.stopped) {
          this.setStatus('stream-ended');
          this.stop().catch(() => {});
        }
      });
    }
  }

  handleDisconnect() {
    // The reconnect loop observes connection state via isConnected polling
    // in waitForDisconnect; this hook exists so tests can drive failures.
    if (this.disconnectResolve) {
      const resolve = this.disconnectResolve;
      this.disconnectResolve = null;
      resolve();
    }
  }

  waitForDisconnect() {
    return new Promise((resolve) => {
      this.disconnectResolve = resolve;
      // Safety net: if the library never emits, poll isConnected.
      const poll = setInterval(() => {
        if (this.stopped || !this.connection || this.connection.isConnected === false) {
          clearInterval(poll);
          if (this.disconnectResolve) {
            this.disconnectResolve = null;
            resolve();
          }
        }
      }, 1000);
      this.disconnectPoll = poll;
    });
  }

  async start() {
    if (this.loopRunning) return;
    this.stopped = false;
    this.loopRunning = true;
    this.status = 'running';
    this.runLoop().catch(() => {
      this.loopRunning = false;
    });
  }

  async runLoop() {
    while (!this.stopped) {
      if (!this.breaker.canAttempt()) {
        this.setStatus('paused');
        await this.sleepFn(5000);
        continue;
      }
      this.setStatus('connecting');
      try {
        this.connection = await this.createConnection();
        this.attachHandlers(this.connection);
        await this.connection.connect();
        this.breaker.recordSuccess();
        this.setStatus('connected');
        await this.waitForDisconnect();
        if (this.disconnectPoll) clearInterval(this.disconnectPoll);
      } catch (err) {
        const state = this.breaker.recordFailure();
        // Sanitize: report only the error class, never messages/tokens.
        this.setStatus(state === 'open' ? 'paused' : 'reconnecting');
        void err;
      } finally {
        if (this.connection) {
          try { await this.connection.disconnect(); } catch { /* ignore */ }
          this.connection = null;
        }
      }
      if (this.stopped) break;
      if (this.breaker.state === 'closed' || this.breaker.state === 'half-open') {
        // Wait the backoff delay before the next attempt (unless paused).
        if (this.breaker.failures > 0) {
          await this.sleepFn(computeDelay(this.breaker.failures - 1, this.reconnectOptions));
        }
      }
    }
    this.loopRunning = false;
    this.status = 'stopped';
    this.setStatus('stopped');
  }

  async stop() {
    this.stopped = true;
    if (this.disconnectPoll) clearInterval(this.disconnectPoll);
    if (this.disconnectResolve) {
      const resolve = this.disconnectResolve;
      this.disconnectResolve = null;
      resolve();
    }
    if (this.connection) {
      try { await this.connection.disconnect(); } catch { /* ignore */ }
      this.connection = null;
    }
    this.status = 'stopped';
    this.setStatus('stopped');
  }
}
