import type { IncomingMessage } from "node:http";
import {
  CLIENT_MESSAGE_TYPES,
  type ClientMessage,
  type ErrorCode,
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  type ServerMessage,
  type ServerMessageType,
  clientMessageSchema,
  parseMessage,
} from "@hijack/protocol";
import { WebSocket, WebSocketServer } from "ws";

export interface BrowserConn {
  readonly id: number;
  readonly socket: WebSocket;
  sessionToken: string | null;
  isAdmin: boolean;
}

export interface BrowserHubHandlers {
  onOpen(conn: BrowserConn): void;
  onMessage(conn: BrowserConn, msg: ClientMessage): void;
  onClose(conn: BrowserConn): void;
}

type PayloadOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>["payload"];

export class BrowserHub {
  readonly wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES * 2 });
  private readonly conns = new Set<BrowserConn>();
  private nextId = 1;
  private nextEventId = 1;
  private handlers: BrowserHubHandlers | null = null;

  constructor(private readonly revision: () => number) {}

  setHandlers(handlers: BrowserHubHandlers): void {
    this.handlers = handlers;
  }

  accept(socket: WebSocket, _req: IncomingMessage, auth: { sessionToken: string | null; isAdmin: boolean }): void {
    const conn: BrowserConn = { id: this.nextId++, socket, ...auth };
    this.conns.add(conn);
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        this.sendError(conn, "bad_request", "mensagens binárias não são aceitas");
        return;
      }
      const raw = data.toString();
      const parsed = parseMessage(clientMessageSchema, raw, CLIENT_MESSAGE_TYPES);
      if (!parsed.ok) {
        this.sendError(conn, parsed.code, parsed.message);
        return;
      }
      try {
        this.handlers?.onMessage(conn, parsed.value);
      } catch (err) {
        console.error("[ws] erro ao tratar mensagem", parsed.value.type, err);
        this.sendError(conn, "internal", "erro interno");
      }
    });
    socket.on("close", () => {
      this.conns.delete(conn);
      this.handlers?.onClose(conn);
    });
    socket.on("error", () => socket.terminate());
    this.handlers?.onOpen(conn);
  }

  connections(): ReadonlySet<BrowserConn> {
    return this.conns;
  }

  send<T extends ServerMessageType>(conn: BrowserConn, type: T, payload: PayloadOf<T>, requestId?: string): void {
    if (conn.socket.readyState !== WebSocket.OPEN) return;
    const msg = {
      protocolVersion: PROTOCOL_VERSION,
      type,
      eventId: this.nextEventId++,
      serverTime: Date.now(),
      stateRevision: this.revision(),
      ...(requestId ? { requestId } : {}),
      payload,
    };
    conn.socket.send(JSON.stringify(msg));
  }

  broadcast<T extends ServerMessageType>(type: T, payload: PayloadOf<T>, filter: (c: BrowserConn) => boolean = () => true): void {
    for (const c of this.conns) if (filter(c)) this.send(c, type, payload);
  }

  sendError(conn: BrowserConn, code: ErrorCode, message: string, requestId?: string): void {
    this.send(conn, "system.error", { code, message }, requestId);
  }

  closeAll(code = 1001, reason = "server shutdown"): void {
    for (const c of this.conns) c.socket.close(code, reason);
  }
}
