import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import type { Config } from "./config/env.ts";
import { createHttpApp } from "./http/app.ts";
import { BrowserHub } from "./ws/browser-hub.ts";
import { isOriginAllowed } from "./ws/origin.ts";

export interface HijackServer {
  readonly httpServer: Server;
  readonly browserHub: BrowserHub;
  listen(port?: number, host?: string): Promise<number>;
  close(): Promise<void>;
}

export function createHijackServer(config: Config): HijackServer {
  let revision = 0;
  const browserHub = new BrowserHub(() => revision);

  browserHub.setHandlers({
    onOpen(conn) {
      browserHub.send(conn, "action.ok", { type: "connected" });
    },
    onMessage(conn, msg) {
      revision++;
      browserHub.sendError(conn, "forbidden", "ação ainda não disponível", msg.requestId);
    },
    onClose() {},
  });

  const app = createHttpApp({
    health: () => ({
      env: config.NODE_ENV,
      browsers: browserHub.connections().size,
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
    listen(port = config.SERVER_PORT, host = config.SERVER_HOST) {
      return new Promise((resolve) => {
        httpServer.listen(port, host, () => resolve((httpServer.address() as AddressInfo).port));
      });
    },
    close() {
      browserHub.closeAll();
      return new Promise((resolve) => httpServer.close(() => resolve()));
    },
  };
}
