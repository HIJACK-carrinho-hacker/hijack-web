import { randomUUID } from "node:crypto";
import { type CarId, type DeviceToServer, PROTOCOL_VERSION, type ServerToDevice } from "@hijack/protocol";
import { WebSocket } from "ws";
import {
  type Clock,
  type DeviceAdapter,
  type DeviceDriveCommand,
  type DeviceEvent,
  systemClock,
} from "../../devices/types.ts";

const HEARTBEAT_MS = 1000;

export class Esp32Adapter implements DeviceAdapter {
  readonly mode = "hardware" as const;
  readonly carId: CarId;
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<(e: DeviceEvent) => void>();
  private readonly clock: Clock;
  private readonly onDispose: (adapter: Esp32Adapter) => void;
  private heartbeat: ReturnType<typeof setInterval> | null = null;

  constructor(carId: CarId, opts: { clock?: Clock; onDispose?: (adapter: Esp32Adapter) => void } = {}) {
    this.carId = carId;
    this.clock = opts.clock ?? systemClock;
    this.onDispose = opts.onDispose ?? (() => {});
  }

  isOnline(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  bind(socket: WebSocket): void {
    if (this.socket === socket) return;
    this.unbind();
    this.socket = socket;
    this.heartbeat = setInterval(() => this.send({ protocolVersion: PROTOCOL_VERSION, type: "device.heartbeat", payload: {} }), HEARTBEAT_MS);
    this.emit({ kind: "connection", online: true, at: this.clock.now() });
  }

  unbind(socket?: WebSocket): void {
    if (!this.socket || (socket && socket !== this.socket)) return;
    this.socket = null;
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.emit({ kind: "connection", online: false, at: this.clock.now() });
  }

  drive(cmd: DeviceDriveCommand): void {
    this.send({
      protocolVersion: PROTOCOL_VERSION,
      type: "device.drive",
      requestId: randomUUID(),
      seq: cmd.seq,
      payload: { throttle: cmd.throttle, steering: cmd.steering, speedMode: "fixed", commandTtlMs: cmd.ttlMs },
    });
  }

  stop(reason: string, seq: number): void {
    this.send({
      protocolVersion: PROTOCOL_VERSION,
      type: "device.stop",
      requestId: randomUUID(),
      seq: Math.max(1, seq),
      payload: { reason: reason.slice(0, 40) },
    });
  }

  handle(msg: DeviceToServer): void {
    const at = this.clock.now();
    switch (msg.type) {
      case "device.ack":
        this.emit({ kind: "ack", seq: msg.payload.seq, throttle: msg.payload.throttle, steering: msg.payload.steering, at });
        break;
      case "device.telemetry":
        this.emit({ kind: "telemetry", telemetry: msg.payload, at });
        break;
      case "device.stopped":
        this.emit({ kind: "stopped", reason: msg.payload.reason, lastSeq: msg.payload.lastSeq, at });
        break;
      case "device.fault":
        this.emit({ kind: "fault", code: msg.payload.code, detail: msg.payload.detail, at });
        break;
      case "device.hello":
        break;
    }
  }

  pose(): null {
    return null;
  }

  onEvent(listener: (e: DeviceEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  dispose(): void {
    if (this.socket) this.stop("mode-change", 1);
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.socket = null;
    this.listeners.clear();
    this.onDispose(this);
  }

  private send(msg: ServerToDevice): void {
    if (this.socket?.readyState === WebSocket.OPEN) this.socket.send(JSON.stringify(msg));
  }

  private emit(e: DeviceEvent): void {
    for (const fn of this.listeners) fn(e);
  }
}
