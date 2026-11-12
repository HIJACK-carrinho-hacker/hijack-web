import type { IncomingMessage } from "node:http";
import {
  BROWSER_MESSAGE_BURST,
  CLIENT_MESSAGE_TYPES,
  type ClientMessage,
  type ErrorCode,
  MAX_BROWSER_MESSAGES_PER_SECOND,
  MAX_MESSAGE_BYTES,
  MAX_PILOT_MESSAGES_PER_SECOND,
  PROTOCOL_VERSION,
  RATE_LIMIT_NOTICE_MS,
  type ServerMessage,
  type ServerMessageType,
  clientMessageSchema,
  parseMessage,
} from "@hijack/protocol";
import { WebSocket, WebSocketServer } from "ws";
import { RateLimiter } from "./rate-limiter.ts";

export interface BrowserConn {
  readonly id: number;
  readonly socket: WebSocket;
  sessionToken: string | null;
}

export interface BrowserHubHandlers {
  onOpen(conn: BrowserConn): void;
  onMessage(conn: BrowserConn, msg: ClientMessage): void | Promise<void>;
  onClose(conn: BrowserConn): void;
}

function isStopMessage(msg: ClientMessage): boolean {
  switch (msg.type) {
    case "pilot.stop":
    case "admin.stopAll":
    case "session.logout":
      return true;
    case "pilot.drive":
      return !msg.payload.pressed || (msg.payload.throttle === 0 && msg.payload.steering === 0);
    default:
      return false;
  }
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

  accept(socket: WebSocket, _req: IncomingMessage, auth: { sessionToken: string | null }): void {
    const conn: BrowserConn = { id: this.nextId++, socket, ...auth };
    this.conns.add(conn);
    const control = new RateLimiter(MAX_BROWSER_MESSAGES_PER_SECOND, BROWSER_MESSAGE_BURST);
    const pilot = new RateLimiter(MAX_PILOT_MESSAGES_PER_SECOND, MAX_PILOT_MESSAGES_PER_SECOND);
    let lastNotice = 0;
    const allowed = (type: string | null, requestId?: string): boolean => {
      const isPilot = type?.startsWith("pilot.") ?? false;
      const limiter = isPilot ? pilot : control;
      if (limiter.take()) return true;
      if (isPilot) return false;
      const at = Date.now();
      if (at - lastNotice >= RATE_LIMIT_NOTICE_MS) {
        lastNotice = at;
        this.sendError(conn, "rate_limited", "muitas mensagens; aguarde um instante", requestId);
      }
      return false;
    };
    socket.on("message", (data, isBinary) => {
      if (isBinary) {
        if (allowed(null)) this.sendError(conn, "bad_request", "mensagens binárias não são aceitas");
        return;
      }
      const raw = data.toString();
      const parsed = parseMessage(clientMessageSchema, raw, CLIENT_MESSAGE_TYPES);
      const exempt = parsed.ok && isStopMessage(parsed.value);
      if (!exempt && !allowed(parsed.ok ? parsed.value.type : null, parsed.ok ? parsed.value.requestId : undefined)) return;
      if (!parsed.ok) {
        this.sendError(conn, parsed.code, parsed.message);
        return;
      }
      const fail = (err: unknown) => {
        console.error("[ws] erro ao tratar mensagem", parsed.value.type, err);
        this.sendError(conn, "internal", "erro interno", parsed.value.requestId);
      };
      try {
        const r = this.handlers?.onMessage(conn, parsed.value);
        if (r instanceof Promise) r.catch(fail);
      } catch (err) {
        fail(err);
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
