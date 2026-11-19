// Adapter interface. Every event source (live TikTok connection,
// simulator, manual/mod control) implements this interface and emits ONLY
// normalized events (see events.js). The game server consumes normalized
// events, so adapters are interchangeable and the live adapter can be
// replaced without touching game logic.
//
//   adapter.onEvent(fn)   — register the consumer (game server ingest)
//   adapter.start()       — begin emitting (live: connect; local: enable)
//   adapter.stop()        — stop emitting (kill-switch path: live disconnects)
//   adapter.status        — 'idle' | 'running' | 'stopped' | 'error'

import { normalizeEvent } from '../events.js';

export class EventAdapter {
  constructor(name, source) {
    this.name = name;
    this.source = source;
    this.status = 'idle';
    this.handler = null;
    this.emitted = 0;
  }

  onEvent(handler) {
    this.handler = handler;
  }

  emit(raw) {
    const event = normalizeEvent(raw, this.source);
    if (!event) return null;
    this.emitted += 1;
    if (this.handler) this.handler(event);
    return event;
  }

  async start() {
    this.status = 'running';
  }

  async stop() {
    this.status = 'stopped';
  }
}

/** Shared base for local (non-network) adapters: simulator and manual. */
export class LocalEventSource extends EventAdapter {
  constructor(name, source) {
    super(name, source);
    this.seq = 0;
  }

  trigger(partial) {
    this.seq += 1;
    return this.emit({
      ...partial,
      msgId: partial.msgId || `${this.source}-${this.seq}-${Date.now()}`,
      timestamp: partial.timestamp || Date.now(),
    });
  }
}
