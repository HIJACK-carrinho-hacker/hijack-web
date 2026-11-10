import type { Axis, CarId, CarMode, Steering } from "@hijack/protocol";

export interface DeviceDriveCommand {
  seq: number;
  throttle: Axis;
  steering: Steering;
  ttlMs: number;
}

export interface DevicePose {
  x: number;
  y: number;
  heading: number;
}

export interface DeviceTelemetry {
  uptimeMs: number | null;
  rssi: number | null;
  lastSeq: number;
  throttle: Axis;
  steering: Steering;
  reconnects: number;
  rejectedCommands: number;
  watchdogTrips: number;
  stopReason: string | null;
}

export type DeviceEvent =
  | { kind: "ack"; seq: number; throttle: Axis; steering: Steering; at: number }
  | { kind: "telemetry"; telemetry: DeviceTelemetry; at: number }
  | { kind: "connection"; online: boolean; at: number }
  | { kind: "stopped"; reason: string; lastSeq: number; at: number }
  | { kind: "fault"; code: string; detail: string; at: number };

export interface DeviceAdapter {
  readonly carId: CarId;
  readonly mode: CarMode;
  isOnline(): boolean;
  drive(cmd: DeviceDriveCommand): void;
  stop(reason: string, seq: number): void;
  pose(): DevicePose | null;
  onEvent(listener: (event: DeviceEvent) => void): () => void;
  dispose(): void;
}

export interface Clock {
  now(): number;
}

export const systemClock: Clock = { now: () => performance.timeOrigin + performance.now() };
