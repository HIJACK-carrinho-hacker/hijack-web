import type { CarId, CarMode, Metrics } from "@hijack/protocol";

const SAMPLE_LIMIT = 500;
const PENDING_LIMIT = 200;

export type CounterName = "received" | "applied" | "transformed" | "blocked" | "rejected" | "disconnects" | "watchdogTrips";

interface CarMetrics {
  counters: Record<CounterName, number>;
  ackSamples: number[];
  pendingSends: Map<number, number>;
}

const emptyCounters = (): Record<CounterName, number> => ({
  received: 0,
  applied: 0,
  transformed: 0,
  blocked: 0,
  rejected: 0,
  disconnects: 0,
  watchdogTrips: 0,
});

export function percentile(sorted: readonly number[], p: number): number | null {
  if (sorted.length === 0) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx] ?? null;
}

export class MetricsRegistry {
  private readonly cars = new Map<string, CarMetrics>();

  private key(carId: CarId, mode: CarMode): string {
    return `${carId}:${mode}`;
  }

  private get(carId: CarId, mode: CarMode): CarMetrics {
    const k = this.key(carId, mode);
    let m = this.cars.get(k);
    if (!m) {
      m = { counters: emptyCounters(), ackSamples: [], pendingSends: new Map() };
      this.cars.set(k, m);
    }
    return m;
  }

  inc(carId: CarId, mode: CarMode, name: CounterName, by = 1): void {
    this.get(carId, mode).counters[name] += by;
  }

  recordSend(carId: CarId, mode: CarMode, seq: number, at: number): void {
    const m = this.get(carId, mode);
    m.pendingSends.set(seq, at);
    if (m.pendingSends.size > PENDING_LIMIT) {
      const first = m.pendingSends.keys().next().value;
      if (first !== undefined) m.pendingSends.delete(first);
    }
  }

  recordAck(carId: CarId, mode: CarMode, seq: number, at: number): void {
    const m = this.get(carId, mode);
    const sentAt = m.pendingSends.get(seq);
    if (sentAt === undefined) return;
    m.pendingSends.delete(seq);
    m.ackSamples.push(Math.max(0, at - sentAt));
    if (m.ackSamples.length > SAMPLE_LIMIT) m.ackSamples.shift();
  }

  snapshot(carId: CarId, mode: CarMode): Metrics {
    const m = this.get(carId, mode);
    const sorted = [...m.ackSamples].sort((a, b) => a - b);
    const round = (v: number | null) => (v === null ? null : Math.round(v * 10) / 10);
    return {
      carId,
      mode,
      ...m.counters,
      ackLatencyMsP50: round(percentile(sorted, 50)),
      ackLatencyMsP95: round(percentile(sorted, 95)),
    };
  }

  reset(): void {
    this.cars.clear();
  }
}
