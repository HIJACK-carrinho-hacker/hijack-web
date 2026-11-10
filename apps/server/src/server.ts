import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { SESSION_COOKIE, parseCookies } from "./auth/sessions.ts";
import type { Config } from "./config/env.ts";
import { SimulatorAdapter } from "./adapters/simulator/simulator-adapter.ts";
import { type AdapterFactory, HijackEngine, SIM_START } from "./engine.ts";
import { HijackService } from "./hijack-service.ts";
import { createApiRouter } from "./http/api.ts";
import { createHttpApp } from "./http/app.ts";
import { BrowserHub } from "./ws/browser-hub.ts";
import { SnapshotBroadcaster } from "./ws/broadcaster.ts";
import { DeviceHub, type DeviceKeepAlive } from "./ws/device-hub.ts";
import { isOriginAllowed } from "./ws/origin.ts";

export interface HijackServer {
  readonly httpServer: Server;
  readonly browserHub: BrowserHub;
  readonly engine: HijackEngine;
  readonly service: HijackService;
  readonly deviceHub: DeviceHub;
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export interface ServerOptions {
  adapterFactory?: AdapterFactory;
  broadcastIntervalMs?: number;
  deviceKeepAlive?: DeviceKeepAlive;
}

export function createHijackServer(config: Config, opts: ServerOptions = {}): HijackServer {
  const deviceHub = new DeviceHub(config, opts.deviceKeepAlive);
  const adapterFactory: AdapterFactory =
    opts.adapterFactory ??
    ((carId, mode) =>
      mode === "simulated" ? new SimulatorAdapter(carId, { start: SIM_START[carId] }) : deviceHub.adapterFor(carId));
  const engine = new HijackEngine({ config, adapterFactory });
  deviceHub.setEvents({
    onAuthFailed: () =>
      engine.log({ kind: "device.authFailed", visibility: "admin", message: "Conexão de dispositivo recusada (credencial inválida)" }),
    onConnected: (carId) => {
      const car = engine.car(carId);
      engine.log({
        kind: "device.connected",
        carId,
        mode: "hardware",
        visibility: "admin",
        message:
          car.mode === "hardware"
            ? `ESP32 de ${car.displayName} autenticado`
            : `ESP32 de ${car.displayName} autenticado; o carrinho está em modo simulado`,
      });
    },
    onDisconnected: (carId, info) =>
      engine.log({
        kind: "device.disconnected",
        carId,
        mode: "hardware",
        visibility: "admin",
        message: `ESP32 desconectado (código ${info.code}${info.reason ? ` "${info.reason}"` : ""}, conectado há ${(info.connectedMs / 1000).toFixed(1)} s)`,
      }),
  });
  const browserHub = new BrowserHub(() => engine.revision);
  const service = new HijackService({ config, engine, hub: browserHub });

  const broadcaster = new SnapshotBroadcaster({
    hub: browserHub,
    viewerOf: (conn) => service.viewerOf(conn),
    snapshotFor: (conn, viewer) => service.snapshotFor(conn, viewer),
    intervalMs: opts.broadcastIntervalMs,
  });
  engine.onChange(() => broadcaster.schedule());
  service.setStateChangedListener(() => broadcaster.schedule());

  browserHub.setHandlers({
    onOpen(conn) {
      service.onConnOpen(conn);
      broadcaster.sendTo(conn);
    },
    async onMessage(conn, msg) {
      const result = await service.handle(conn, msg);
      if (msg.type === "session.resume" || msg.type === "session.logout") broadcaster.sendTo(conn);
      if (!result) return;
      if (result.ok && msg.type !== "session.resume" && msg.type !== "session.logout") broadcaster.sendTo(conn);
      if (result.ok) browserHub.send(conn, "action.ok", { type: msg.type }, msg.requestId);
      else browserHub.sendError(conn, result.code, result.message, msg.requestId);
    },
    onClose(conn) {
      service.onConnClose(conn);
    },
  });

  const app = createHttpApp({
    health: () => ({
      env: config.NODE_ENV,
      browsers: browserHub.connections().size,
      devices: deviceHub.connectedCount(),
      demoState: engine.demoState,
    }),
    api: createApiRouter(service, config),
    staticDir: config.NODE_ENV === "production" ? config.STATIC_DIR : undefined,
  });

  const httpServer = createServer(app);

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    if (url.pathname === "/ws") {
      if (!isOriginAllowed(req, config.ALLOWED_ORIGINS)) {
        socket.write("HTTP/1.1 403 Forbidden\r\n\r\n");
        socket.destroy();
        return;
      }
      const sessionToken = parseCookies(req.headers.cookie)[SESSION_COOKIE] ?? null;
      browserHub.wss.handleUpgrade(req, socket, head, (ws) => {
        browserHub.accept(ws, req, { sessionToken });
      });
      return;
    }
    if (url.pathname === "/device") {
      deviceHub.wss.handleUpgrade(req, socket, head, (ws) => deviceHub.accept(ws, req));
      return;
    }
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
  });

  return {
    httpServer,
    browserHub,
    engine,
    service,
    deviceHub,
    listen(port = config.SERVER_PORT, host = config.SERVER_HOST) {
      return new Promise((resolve) => {
        httpServer.listen(port, host, () => resolve((httpServer.address() as AddressInfo).port));
      });
    },
    close() {
      broadcaster.dispose();
      service.dispose();
      engine.dispose();
      deviceHub.dispose();
      browserHub.closeAll();
      return new Promise((resolve) => httpServer.close(() => resolve()));
    },
  };
}
