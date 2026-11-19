// Bounded message-id dedupe (FIFO eviction). Used so a reconnect that
// replays recent events cannot double-apply follows, gifts, or likes.

export class Dedupe {
  constructor(cap = 5000) {
    this.cap = cap;
    this.ids = new Map(); // insertion-ordered
  }

  /** Returns true if the id was already seen (duplicate), else records it. */
  seen(id) {
    const key = String(id);
    if (this.ids.has(key)) return true;
    this.ids.set(key, 1);
    while (this.ids.size > this.cap) {
      const oldest = this.ids.keys().next().value;
      this.ids.delete(oldest);
    }
    return false;
  }

  get size() {
    return this.ids.size;
  }

  clear() {
    this.ids.clear();
  }
}
