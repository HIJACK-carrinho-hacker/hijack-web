import { timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import {
  type CarId,
  DEVICE_MESSAGE_TYPES,
  PROTOCOL_VERSION,
  type ServerToDevice,
  deviceToServerSchema,
  parseMessage,
} from "@hijack/protocol";
import { WebSocket, WebSocketServer } from "ws";
import { Esp32Adapter } from "../adapters/esp32/esp32-adapter.ts";
import type { Config } from "../config/env.ts";
import { FailureThrottle } from "../safety/throttle.ts";

const HELLO_TIMEOUT_MS = 3000;
const DEVICE_MAX_BYTES = 1024;

export interface DeviceKeepAlive {
  intervalMs: number;
  maxMissedPongs: number;
}

export const DEFAULT_DEVICE_KEEPALIVE: DeviceKeepAlive = { intervalMs: 2000, maxMissedPongs: 3 };

export const DEVICE_CLOSE = { authFailed: 4401, helloTimeout: 4408, replaced: 4409, rateLimited: 4429 } as const;

interface DeviceConn {
  socket: WebSocket;
  ip: string;
  carId: CarId | null;
  missedPongs: number;
  connectedAt: number;
  pongs: number;
  devicePings: number;
  droppedByKeepAlive: boolean;
}

export interface DeviceHubEvents {
  onAuthFailed(ip: string): void;
  onConnected(carId: CarId): void;
  onDisconnected(
    carId: CarId,
    info: { code: number; reason: string; connectedMs: number; pongs: number; devicePings: number; droppedByKeepAlive: boolean },
  ): void;
}

const sameSecret = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

export class DeviceHub {
  readonly wss = new WebSocketServer({ noServer: true, maxPayload: DEVICE_MAX_BYTES });
  private readonly sockets = new Map<CarId, DeviceConn>();
  private readonly adapters = new Map<CarId, Esp32Adapter>();
  private readonly config: Config;
  private readonly throttle = new FailureThrottle({ maxFailures: 5, windowMs: 60_000, baseLockMs: 10_000, maxLockMs: 120_000 });
  private readonly pingTimer: ReturnType<typeof setInterval>;
  private readonly keepAlive: DeviceKeepAlive;
  private events: DeviceHubEvents = { onAuthFailed() {}, onConnected() {}, onDisconnected() {} };

  constructor(config: Config, keepAlive: DeviceKeepAlive = DEFAULT_DEVICE_KEEPALIVE) {
    this.config = config;
    this.keepAlive = keepAlive;
    this.pingTimer = setInterval(() => this.pingAll(), keepAlive.intervalMs);
  }

  setEvents(events: DeviceHubEvents): void {
    this.events = events;
  }

  connectedCount(): number {
    return this.sockets.size;
  }

  isConnected(carId: CarId): boolean {
    return this.sockets.has(carId);
  }

  adapterFor(carId: CarId): Esp32Adapter {
    const adapter = new Esp32Adapter(carId, {
      onDispose: (a) => {
        if (this.adapters.get(carId) === a) this.adapters.delete(carId);
      },
    });
    this.adapters.set(carId, adapter);
    const existing = this.sockets.get(carId);
    if (existing) adapter.bind(existing.socket);
    return adapter;
  }

  accept(socket: WebSocket, req: IncomingMessage): void {
    const ip = req.socket.remoteAddress ?? "unknown";
    if (this.throttle.isLocked(ip)) {
      socket.close(DEVICE_CLOSE.rateLimited, "rate limited");
      return;
    }
    const conn: DeviceConn = {
      socket,
      ip,
      carId: null,
      missedPongs: 0,
      connectedAt: Date.now(),
      pongs: 0,
      devicePings: 0,
      droppedByKeepAlive: false,
    };
    const helloTimer = setTimeout(() => {
      if (!conn.carId) socket.close(DEVICE_CLOSE.helloTimeout, "hello timeout");
    }, HELLO_TIMEOUT_MS);
    socket.on("pong", () => {
      conn.missedPongs = 0;
      conn.pongs++;
    });
    socket.on("ping", () => {
      conn.devicePings++;
    });
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        if (!conn.carId) socket.close(DEVICE_CLOSE.authFailed, "auth");
        return;
      }
      const parsed = parseMessage(deviceToServerSchema, data.toString(), DEVICE_MESSAGE_TYPES, DEVICE_MAX_BYTES);
      if (!conn.carId) {
        clearTimeout(helloTimer);
        if (!parsed.ok || parsed.value.type !== "device.hello" || !this.authenticate(parsed.value.payload)) {
          this.throttle.fail(ip);
          this.events.onAuthFailed(ip);
          socket.close(DEVICE_CLOSE.authFailed, "auth");
          return;
        }
        this.throttle.succeed(ip);
        this.register(conn, parsed.value.payload.deviceId);
        return;
      }
      if (!parsed.ok) return;
      this.adapters.get(conn.carId)?.handle(parsed.value);
    });
    socket.on("close", (code, reason) => {
      clearTimeout(helloTimer);
      if (conn.carId && this.sockets.get(conn.carId) === conn) {
        this.sockets.delete(conn.carId);
        this.adapters.get(conn.carId)?.unbind(socket);
        this.events.onDisconnected(conn.carId, {
          code,
          reason: reason.toString(),
          connectedMs: Date.now() - conn.connectedAt,
          pongs: conn.pongs,
          devicePings: conn.devicePings,
          droppedByKeepAlive: conn.droppedByKeepAlive,
        });
      }
    });
    socket.on("error", (err) => {
      console.warn(`[hijack] erro no socket do dispositivo ${conn.carId ?? "?"}: ${err.message}`);
      socket.terminate();
    });
  }

  dispose(): void {
    clearInterval(this.pingTimer);
    for (const c of this.sockets.values()) c.socket.close(1001, "server shutdown");
  }

  private authenticate(p: { deviceId: CarId; secret: string }): boolean {
    const expected = p.deviceId === "car-a" ? this.config.DEVICE_SECRET_CAR_A : this.config.DEVICE_SECRET_CAR_B;
    return !!expected && sameSecret(p.secret, expected);
  }

  private register(conn: DeviceConn, carId: CarId): void {
    const previous = this.sockets.get(carId);
    conn.carId = carId;
    this.sockets.set(carId, conn);
    if (previous) {
      this.adapters.get(carId)?.unbind(previous.socket);
      previous.socket.close(DEVICE_CLOSE.replaced, "replaced");
    }
    const welcome: ServerToDevice = {
      protocolVersion: PROTOCOL_VERSION,
      type: "device.welcome",
      payload: { carId, commandTtlMs: this.config.COMMAND_TTL_MS },
    };
    conn.socket.send(JSON.stringify(welcome));
    this.adapters.get(carId)?.bind(conn.socket);
    this.events.onConnected(carId);
  }

  private pingAll(): void {
    for (const c of this.sockets.values()) {
      if (c.missedPongs >= this.keepAlive.maxMissedPongs) {
        c.droppedByKeepAlive = true;
        c.socket.terminate();
        continue;
      }
      c.missedPongs++;
      c.socket.ping();
    }
  }
}
