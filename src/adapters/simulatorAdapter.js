// Simulator adapter: fake events for offline testing and rehearsal.
// Produces the same normalized events as the live adapter, with
// deterministic fake user ids (one per fake name) so the 1-spot rule,
// cooldowns, and like-delta logic behave exactly as they would live.

import { LocalEventSource } from './base.js';

export function fakeUserId(name) {
  const slug = String(name || 'viewer').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'viewer';
  return `sim:${slug}`;
}

const DEMO_NAMES = [
  'Maya', 'Liam', 'Sofia', 'Noah', 'Ava', 'Lucas', 'Mia', 'Ethan',
  'Isla', 'Oliver', 'Freya', 'George', 'Luna', 'Harry', 'Elsie', 'Jack',
];

export class SimulatorAdapter extends LocalEventSource {
  constructor() {
    super('simulator', 'simulator');
    this.demoTimer = null;
    this.demoStep = 0;
  }

  follow(displayName) {
    return this.trigger({ type: 'follow', userId: fakeUserId(displayName), displayName });
  }

  comment(displayName, text) {
    return this.trigger({ type: 'comment', userId: fakeUserId(displayName), displayName, text });
  }

  likes(displayName, likeCount, likeTotal) {
    return this.trigger({
      type: 'like', userId: fakeUserId(displayName), displayName,
      likeCount, likeTotal: likeTotal == null ? undefined : likeTotal,
    });
  }

  gift(displayName, giftName, giftId = '', repeatCount = 1, repeatEnd = true) {
    return this.trigger({
      type: 'gift', userId: fakeUserId(displayName), displayName,
      giftId, giftName, repeatCount, repeatEnd,
    });
  }

  /** Slow ambient demo traffic for rehearsal. Off by default. */
  setAutoDemo(on, intervalMs = 4000) {
    if (this.demoTimer) {
      clearInterval(this.demoTimer);
      this.demoTimer = null;
    }
    if (!on) return;
    this.demoTimer = setInterval(() => {
      const name = DEMO_NAMES[this.demoStep % DEMO_NAMES.length];
      const kind = this.demoStep % 4;
      this.demoStep += 1;
      if (kind === 0) this.follow(name);
      else if (kind === 1) this.comment(name, ['!cast', '!wave', '!bloom', '!sip', '!float'][this.demoStep % 5]);
      else if (kind === 2) this.likes(name, 12 + (this.demoStep % 20));
      else this.gift(name, ['Rose', 'Star', 'Coffee', 'Cloud'][this.demoStep % 4]);
    }, intervalMs);
    if (typeof this.demoTimer.unref === 'function') this.demoTimer.unref();
  }

  async stop() {
    this.setAutoDemo(false);
    await super.stop();
  }
}
