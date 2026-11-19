// Animation queue with minimum spacing and a documented drop policy.
//
// Drop policy (also stated in README): the queue holds at most QUEUE_CAP
// items. When full, a new item displaces the lowest-priority oldest item;
// if the new item's priority is not higher than the lowest present, the new
// item is dropped instead. Priorities: follow 3, gift 2, command 1,
// ambient/meter 0. Dropped items are counted, never silently retried.

export const PRIORITY = { ambient: 0, command: 1, gift: 2, follow: 3 };

export class AnimationQueue {
  constructor({ cap, minSpacingMs, nowFn = () => Date.now() }) {
    this.cap = cap;
    this.minSpacingMs = minSpacingMs;
    this.nowFn = nowFn;
    this.items = [];
    this.dropped = 0;
    this.lastDispatchAt = 0;
    this.seq = 0;
  }

  get size() {
    return this.items.length;
  }

  push(item) {
    const entry = { ...item, seq: this.seq += 1, enqueuedAt: this.nowFn() };
    if (this.items.length >= this.cap) {
      // Find the lowest-priority oldest item.
      let victim = 0;
      for (let i = 1; i < this.items.length; i += 1) {
        const a = this.items[i];
        const b = this.items[victim];
        if (a.priority < b.priority || (a.priority === b.priority && a.seq < b.seq)) victim = i;
      }
      if (entry.priority <= this.items[victim].priority) {
        this.dropped += 1;
        return { queued: false, reason: 'queue-full' };
      }
      const [displaced] = this.items.splice(victim, 1);
      this.dropped += 1;
      this.insertOrdered(entry);
      return { queued: true, displaced };
    }
    this.insertOrdered(entry);
    return { queued: true };
  }

  insertOrdered(entry) {
    // Keep the queue ordered by priority (high first), then arrival order.
    let at = this.items.length;
    while (at > 0) {
      const prev = this.items[at - 1];
      if (prev.priority > entry.priority) break;
      if (prev.priority === entry.priority && prev.seq < entry.seq) break;
      at -= 1;
    }
    this.items.splice(at, 0, entry);
  }

  /** Take the next item if the minimum spacing has elapsed, else null. */
  next() {
    if (this.items.length === 0) return null;
    const now = this.nowFn();
    if (now - this.lastDispatchAt < this.minSpacingMs) return null;
    this.lastDispatchAt = now;
    return this.items.shift();
  }

  /** Drain everything due right now (used by tests and shutdown paths). */
  drainDue() {
    const out = [];
    let item;
    while ((item = this.next())) out.push(item);
    return out;
  }

  clear() {
    const n = this.items.length;
    this.items = [];
    return n;
  }
}
