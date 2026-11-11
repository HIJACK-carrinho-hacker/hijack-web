export class RateLimiter {
  private tokens: number;
  private last: number;

  constructor(
    private readonly perSecond: number,
    private readonly burst: number,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = burst;
    this.last = now();
  }

  take(): boolean {
    const at = this.now();
    this.tokens = Math.min(this.burst, this.tokens + ((at - this.last) / 1000) * this.perSecond);
    this.last = at;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}
