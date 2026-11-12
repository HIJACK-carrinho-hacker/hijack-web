import type { CarId, DriveVector, StopReason } from "@hijack/protocol";
import type { Clock, DeviceAdapter } from "../devices/types.ts";
import { isNeutral } from "./pipeline.ts";

export interface CarControllerOptions {
  ttlMs: number;
  maxCommandsPerSecond: number;
  clock: Clock;
}

export interface CarControllerHooks {
  onSent(info: { seq: number; vector: DriveVector; at: number }): void;
  onStopped(reason: StopReason): void;
  onChange(): void;
}

const ZERO: DriveVector = { throttle: 0, steering: 0 };
const MIN_STOP_REPEAT_MS = 50;

export class CarController {
  readonly carId: CarId;
  private adapter: DeviceAdapter;
  private readonly opts: CarControllerOptions;
  private readonly hooks: CarControllerHooks;
  private desiredVec: DriveVector = { ...ZERO };
  private seq = 0;
  private lastInputAt = 0;
  private lastSentAt = 0;
  private pending: ReturnType<typeof setTimeout> | null = null;
  private pendingVec: DriveVector | null = null;
  private stopReasonValue: StopReason | null = "boot";
  private lastStopAt = Number.NEGATIVE_INFINITY;

  constructor(carId: CarId, adapter: DeviceAdapter, opts: CarControllerOptions, hooks: CarControllerHooks) {
    this.carId = carId;
    this.adapter = adapter;
    this.opts = opts;
    this.hooks = hooks;
  }

  get desired(): DriveVector {
    return { ...this.desiredVec };
  }

  get stopReason(): StopReason | null {
    return this.stopReasonValue;
  }

  get device(): DeviceAdapter {
    return this.adapter;
  }

  get moving(): boolean {
    return !isNeutral(this.desiredVec);
  }

  replaceAdapter(adapter: DeviceAdapter): void {
    this.stop("mode-change");
    this.adapter = adapter;
    this.lastStopAt = Number.NEGATIVE_INFINITY;
  }

  command(vec: DriveVector): void {
    if (isNeutral(vec)) {
      this.stop("pilot-release");
      return;
    }
    this.lastInputAt = this.opts.clock.now();
    this.desiredVec = { ...vec };
    this.stopReasonValue = null;
    const minInterval = 1000 / this.opts.maxCommandsPerSecond;
    const elapsed = this.lastInputAt - this.lastSentAt;
    if (elapsed >= minInterval && !this.pending) {
      this.send(vec);
    } else {
      this.pendingVec = { ...vec };
      if (!this.pending) {
        this.pending = setTimeout(() => {
          this.pending = null;
          const next = this.pendingVec;
          this.pendingVec = null;
          if (next && !isNeutral(this.desiredVec)) this.send(next);
        }, Math.max(0, minInterval - elapsed));
      }
    }
    this.hooks.onChange();
  }

  stop(reason: StopReason): void {
    this.clearPending();
    const wasMoving = this.moving;
    const now = this.opts.clock.now();
    this.desiredVec = { ...ZERO };
    if (wasMoving || now - this.lastStopAt >= MIN_STOP_REPEAT_MS) {
      this.seq++;
      this.lastStopAt = now;
      this.adapter.stop(reason, this.seq);
    }
    if (wasMoving || this.stopReasonValue === null) {
      this.stopReasonValue = reason;
      this.hooks.onStopped(reason);
    }
    this.hooks.onChange();
  }

  checkWatchdog(): void {
    if (!this.moving) return;
    if (this.opts.clock.now() - this.lastInputAt > this.opts.ttlMs) this.stop("watchdog");
  }

  dispose(): void {
    this.clearPending();
  }

  private send(vec: DriveVector): void {
    this.seq++;
    const at = this.opts.clock.now();
    this.lastSentAt = at;
    this.hooks.onSent({ seq: this.seq, vector: { ...vec }, at });
    this.adapter.drive({ seq: this.seq, throttle: vec.throttle, steering: vec.steering, ttlMs: this.opts.ttlMs });
  }

  private clearPending(): void {
    if (this.pending) clearTimeout(this.pending);
    this.pending = null;
    this.pendingVec = null;
  }
}
