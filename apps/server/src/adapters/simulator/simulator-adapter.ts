import { type Axis, type CarId, STEERING_MAX, type Steering } from "@hijack/protocol";
import {
  type Clock,
  type DeviceAdapter,
  type DeviceDriveCommand,
  type DeviceEvent,
  type DevicePose,
  systemClock,
} from "../../devices/types.ts";

export interface SimulatorOptions {
  tickMs?: number;
  telemetryMs?: number;
  speed?: number;
  turnRate?: number;
  clock?: Clock;
  start?: DevicePose;
}

export class SimulatorAdapter implements DeviceAdapter {
  readonly mode = "simulated" as const;
  readonly carId: CarId;
  private readonly clock: Clock;
  private readonly speed: number;
  private readonly turnRate: number;
  private readonly listeners = new Set<(e: DeviceEvent) => void>();
  private readonly bootAt: number;
  private readonly tickTimer: ReturnType<typeof setInterval>;
  private readonly telemetryTimer: ReturnType<typeof setInterval>;
  private online = true;
  private throttle: Axis = 0;
  private steering: Steering = 0;
  private lastSeq = 0;
  private expiresAt = 0;
  private rejected = 0;
  private watchdogTrips = 0;
  private reconnects = 0;
  private stopReason: string | null = "boot";
  private pos: DevicePose;
  private lastTickAt: number;

  constructor(carId: CarId, opts: SimulatorOptions = {}) {
    this.carId = carId;
    this.clock = opts.clock ?? systemClock;
    this.speed = opts.speed ?? 0.22;
    this.turnRate = opts.turnRate ?? 1.8;
    this.pos = { ...(opts.start ?? { x: 0.5, y: 0.5, heading: -Math.PI / 2 }) };
    this.bootAt = this.clock.now();
    this.lastTickAt = this.bootAt;
    this.tickTimer = setInterval(() => this.tick(), opts.tickMs ?? 50);
    this.telemetryTimer = setInterval(() => this.emitTelemetry(), opts.telemetryMs ?? 500);
  }

  isOnline(): boolean {
    return this.online;
  }

  drive(cmd: DeviceDriveCommand): void {
    if (!this.online) return;
    if (cmd.seq <= this.lastSeq) {
      this.rejected++;
      return;
    }
    this.lastSeq = cmd.seq;
    const now = this.clock.now();
    this.throttle = cmd.throttle;
    this.steering = cmd.steering;
    this.expiresAt = now + cmd.ttlMs;
    this.stopReason = null;
    this.emit({ kind: "ack", seq: cmd.seq, throttle: this.throttle, steering: this.steering, at: now });
  }

  stop(reason: string, seq: number): void {
    if (!this.online) return;
    this.lastSeq = Math.max(this.lastSeq, seq);
    this.halt(reason);
  }

  pose(): DevicePose {
    return { ...this.pos };
  }

  setOnline(online: boolean): void {
    if (online === this.online) return;
    if (!online) this.halt("device-disconnected");
    this.online = online;
    if (online) {
      this.reconnects++;
      this.lastSeq = 0;
      this.halt("boot");
    }
    this.emit({ kind: "connection", online, at: this.clock.now() });
  }

  onEvent(listener: (e: DeviceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    clearInterval(this.tickTimer);
    clearInterval(this.telemetryTimer);
    this.listeners.clear();
  }

  private halt(reason: string): void {
    const wasMoving = this.throttle !== 0 || this.steering !== 0;
    this.throttle = 0;
    this.steering = 0;
    this.expiresAt = 0;
    this.stopReason = reason;
    if (wasMoving) {
      this.emit({ kind: "stopped", reason, lastSeq: this.lastSeq, at: this.clock.now() });
    }
  }

  private tick(): void {
    const now = this.clock.now();
    const dt = Math.min(0.2, (now - this.lastTickAt) / 1000);
    this.lastTickAt = now;
    if (!this.online) return;
    if ((this.throttle !== 0 || this.steering !== 0) && now > this.expiresAt) {
      this.watchdogTrips++;
      this.halt("watchdog");
      return;
    }
    if (this.throttle === 0) return;
    this.pos.heading += (this.steering / STEERING_MAX) * this.throttle * this.turnRate * dt;
    let x = this.pos.x + Math.cos(this.pos.heading) * this.throttle * this.speed * dt;
    let y = this.pos.y + Math.sin(this.pos.heading) * this.throttle * this.speed * dt;
    if (x < 0.05 || x > 0.95) {
      x = Math.min(0.95, Math.max(0.05, x));
      this.pos.heading = Math.PI - this.pos.heading;
    }
    if (y < 0.05 || y > 0.95) {
      y = Math.min(0.95, Math.max(0.05, y));
      this.pos.heading = -this.pos.heading;
    }
    this.pos.x = x;
    this.pos.y = y;
  }

  private emitTelemetry(): void {
    if (!this.online) return;
    const now = this.clock.now();
    this.emit({
      kind: "telemetry",
      at: now,
      telemetry: {
        uptimeMs: Math.round(now - this.bootAt),
        rssi: null,
        lastSeq: this.lastSeq,
        throttle: this.throttle,
        steering: this.steering,
        reconnects: this.reconnects,
        rejectedCommands: this.rejected,
        watchdogTrips: this.watchdogTrips,
        stopReason: this.stopReason,
      },
    });
  }

  private emit(e: DeviceEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}
