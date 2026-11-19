// Reconnect backoff + circuit breaker. Pure and clock-injectable so tests
// can drive it without waiting. The live adapter uses this so repeated
// signing/block errors pause the game instead of hammering retries.

export function computeDelay(attempt, options, random = Math.random) {
  const { baseDelayMs, maxDelayMs, jitter } = options;
  const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.max(0, attempt));
  const factor = 1 + (random() * 2 - 1) * jitter;
  return Math.max(0, Math.round(exp * factor));
}

export class CircuitBreaker {
  // states: 'closed' (normal), 'open' (paused), 'half-open' (one probe)
  constructor(options, nowFn = () => Date.now()) {
    this.options = options;
    this.nowFn = nowFn;
    this.state = 'closed';
    this.failures = 0;
    this.openedAt = 0;
  }

  canAttempt() {
    if (this.state === 'closed') return true;
    if (this.state === 'open') {
      if (this.nowFn() - this.openedAt >= this.options.openCooldownMs) {
        this.state = 'half-open';
        return true;
      }
      return false;
    }
    return true; // half-open: exactly one probe; caller records the outcome
  }

  nextDelayMs(random = Math.random) {
    return computeDelay(this.failures, this.options, random);
  }

  recordSuccess() {
    this.state = 'closed';
    this.failures = 0;
    this.openedAt = 0;
  }

  recordFailure() {
    this.failures += 1;
    if (this.state === 'half-open' || this.failures >= this.options.maxAttempts) {
      this.state = 'open';
      this.openedAt = this.nowFn();
    }
    return this.state;
  }

  reset() {
    this.state = 'closed';
    this.failures = 0;
    this.openedAt = 0;
  }
}
