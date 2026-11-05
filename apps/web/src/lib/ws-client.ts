import {
  type ClientPayload,
  type ClientMessageType,
  PROTOCOL_VERSION,
  SERVER_MESSAGE_TYPES,
  type ServerMessage,
  parseMessage,
  serverMessageSchema,
} from "@hijack/protocol";

export type ConnectionStatus = "connecting" | "open" | "closed";

export interface WsClientOptions {
  url?: string;
  onMessage: (msg: ServerMessage) => void;
  onStatus: (status: ConnectionStatus) => void;
  maxBackoffMs?: number;
}

const SERVER_MAX_BYTES = 256 * 1024;

export function defaultWsUrl(): string {
  const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${proto}//${window.location.host}/ws`;
}

export class WsClient {
  private socket: WebSocket | null = null;
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private lastRevision = -1;
  private readonly opts: WsClientOptions;

  constructor(opts: WsClientOptions) {
    this.opts = opts;
  }

  start(): void {
    this.stopped = false;
    this.open();
  }

  stop(): void {
    this.stopped = true;
    if (this.timer) clearTimeout(this.timer);
    this.socket?.close(1000, "client stop");
    this.socket = null;
  }

  reconnectNow(): void {
    const old = this.socket;
    this.socket = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (old) {
      old.onclose = null;
      old.onmessage = null;
      old.close(4000, "reconnect");
    }
    this.attempts = 0;
    if (!this.stopped) this.open();
  }

  get isOpen(): boolean {
    return this.socket?.readyState === WebSocket.OPEN;
  }

  send<T extends ClientMessageType>(type: T, payload: ClientPayload<T>): string | null {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) return null;
    const requestId = crypto.randomUUID();
    this.socket.send(
      JSON.stringify({ protocolVersion: PROTOCOL_VERSION, type, requestId, sentAt: Date.now(), payload }),
    );
    return requestId;
  }

  private open(): void {
    this.opts.onStatus("connecting");
    const socket = new WebSocket(this.opts.url ?? defaultWsUrl());
    this.socket = socket;
    socket.onopen = () => {
      this.attempts = 0;
      this.lastRevision = -1;
      this.opts.onStatus("open");
    };
    socket.onmessage = (ev) => {
      if (this.socket !== socket || typeof ev.data !== "string") return;
      const parsed = parseMessage(serverMessageSchema, ev.data, SERVER_MESSAGE_TYPES, SERVER_MAX_BYTES);
      if (!parsed.ok) {
        console.warn("[ws] mensagem do servidor ignorada:", parsed.code);
        return;
      }
      const msg = parsed.value;
      if (msg.type === "state.snapshot") {
        if (msg.stateRevision < this.lastRevision) return;
        this.lastRevision = msg.stateRevision;
      }
      this.opts.onMessage(msg);
    };
    socket.onclose = () => {
      if (this.socket === socket) this.socket = null;
      this.opts.onStatus("closed");
      if (!this.stopped) this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    const max = this.opts.maxBackoffMs ?? 5000;
    const delay = Math.min(max, 250 * 2 ** this.attempts) + Math.random() * 200;
    this.attempts++;
    this.timer = setTimeout(() => this.open(), delay);
  }
}
