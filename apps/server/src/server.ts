import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { ClientMessage } from "@hijack/protocol";
import type { Config } from "./config/env.ts";
import { type AdapterFactory, HijackEngine, type Result, type Viewer } from "./engine.ts";
import { createHttpApp } from "./http/app.ts";
import { type BrowserConn, BrowserHub } from "./ws/browser-hub.ts";
import { SnapshotBroadcaster } from "./ws/broadcaster.ts";
import { isOriginAllowed } from "./ws/origin.ts";

export interface HijackServer {
  readonly httpServer: Server;
  readonly browserHub: BrowserHub;
  readonly engine: HijackEngine;
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export interface ServerOptions {
  adapterFactory?: AdapterFactory;
  broadcastIntervalMs?: number;
}

export function createHijackServer(config: Config, opts: ServerOptions = {}): HijackServer {
  const engine = new HijackEngine({ config, adapterFactory: opts.adapterFactory });
  const browserHub = new BrowserHub(() => engine.revision);

  const viewerOf = (_conn: BrowserConn): Viewer => ({ role: "spectator" });

  const broadcaster = new SnapshotBroadcaster({
    hub: browserHub,
    viewerOf,
    snapshotFor: (_conn, viewer) => engine.snapshot(viewer),
    intervalMs: opts.broadcastIntervalMs,
  });
  engine.onChange(() => broadcaster.schedule());

  const reply = (conn: BrowserConn, msg: ClientMessage, result: Result) => {
    if (result.ok) browserHub.send(conn, "action.ok", { type: msg.type }, msg.requestId);
    else browserHub.sendError(conn, result.code, result.message, msg.requestId);
  };

  const handle = (conn: BrowserConn, msg: ClientMessage): Result => {
    switch (msg.type) {
      case "session.resume":
        broadcaster.sendTo(conn);
        return { ok: true };
      case "sim.manualDrive":
        return engine.manualDrive(msg.payload.carId, {
          throttle: msg.payload.throttle,
          steering: msg.payload.steering,
        });
      case "admin.stopAll":
        engine.stopAll("admin-stop-all");
        browserHub.broadcast("system.stopAll", { reason: msg.payload.reason || "operador" });
        return { ok: true };
      case "admin.setDemoState":
        return engine.setDemoState(msg.payload.state);
      case "admin.setCarMode":
        return engine.setCarMode(msg.payload.carId, msg.payload.mode);
      default:
        return { ok: false, code: "forbidden", message: "ação ainda não disponível" };
    }
  };

  browserHub.setHandlers({
    onOpen(conn) {
      broadcaster.sendTo(conn);
    },
    onMessage(conn, msg) {
      reply(conn, msg, handle(conn, msg));
    },
    onClose() {},
  });

  const app = createHttpApp({
    health: () => ({
      env: config.NODE_ENV,
      browsers: browserHub.connections().size,
      demoState: engine.demoState,
    }),
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
      browserHub.wss.handleUpgrade(req, socket, head, (ws) => {
        browserHub.accept(ws, req, { sessionToken: null, isAdmin: false });
      });
      return;
    }
    socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
    socket.destroy();
  });

  return {
    httpServer,
    browserHub,
    engine,
    listen(port = config.SERVER_PORT, host = config.SERVER_HOST) {
      return new Promise((resolve) => {
        httpServer.listen(port, host, () => resolve((httpServer.address() as AddressInfo).port));
      });
    },
    close() {
      broadcaster.dispose();
      engine.dispose();
      browserHub.closeAll();
      return new Promise((resolve) => httpServer.close(() => resolve()));
    },
  };
}
