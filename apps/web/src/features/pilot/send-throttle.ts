export function delayUntilNextSend(now: number, lastSentAt: number, minIntervalMs: number): number {
  return Math.max(0, lastSentAt + minIntervalMs - now);
}
