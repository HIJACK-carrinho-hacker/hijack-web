interface Entry {
  failures: number[];
  lockedUntil: number;
  level: number;
}

export interface ThrottleOptions {
  maxFailures: number;
  windowMs: number;
  baseLockMs: number;
  maxLockMs: number;
  now?: () => number;
}

export class FailureThrottle {
  private readonly entries = new Map<string, Entry>();
  private readonly opts: Required<ThrottleOptions>;

  constructor(opts: ThrottleOptions) {
    this.opts = { now: Date.now, ...opts };
  }

  isLocked(key: string): boolean {
    const e = this.entries.get(key);
    return !!e && e.lockedUntil > this.opts.now();
  }

  retryAfterMs(key: string): number {
    const e = this.entries.get(key);
    return e ? Math.max(0, e.lockedUntil - this.opts.now()) : 0;
  }

  fail(key: string): void {
    const now = this.opts.now();
    const e = this.entries.get(key) ?? { failures: [], lockedUntil: 0, level: 0 };
    e.failures = e.failures.filter((t) => now - t < this.opts.windowMs);
    e.failures.push(now);
    if (e.failures.length >= this.opts.maxFailures) {
      e.lockedUntil = now + Math.min(this.opts.maxLockMs, this.opts.baseLockMs * 2 ** e.level);
      e.level++;
      e.failures = [];
    }
    this.entries.set(key, e);
  }

  succeed(key: string): void {
    this.entries.delete(key);
  }
}
