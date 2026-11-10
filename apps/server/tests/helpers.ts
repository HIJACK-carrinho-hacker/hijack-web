import type { ServerMessage } from "@hijack/protocol";
import { WebSocket } from "ws";
import { type Config, testConfig } from "../src/config/env.ts";
import { type HijackServer, type ServerOptions, createHijackServer } from "../src/server.ts";

export interface Harness {
  server: HijackServer;
  port: number;
  base: string;
  dataDir: string;
  close(): Promise<void>;
}

export async function startServer(overrides: Partial<Config> = {}, serverOptions: ServerOptions = {}): Promise<Harness> {
  const config = testConfig(overrides);
  const server = createHijackServer(config, serverOptions);
  const port = await server.listen(0, "127.0.0.1");
  return {
    server,
    port,
    base: `http://127.0.0.1:${port}`,
    dataDir: config.DATA_DIR,
    close: () => server.close(),
  };
}

export class TestClient {
  readonly messages: ServerMessage[] = [];
  private waiters: { pred: (m: ServerMessage) => boolean; resolve: (m: ServerMessage) => void }[] = [];

  private constructor(readonly ws: WebSocket) {
    ws.on("message", (data) => {
      const msg = JSON.parse(data.toString()) as ServerMessage;
      this.messages.push(msg);
      this.waiters = this.waiters.filter((w) => {
        if (w.pred(msg)) {
          w.resolve(msg);
          return false;
        }
        return true;
      });
    });
  }

  static connect(port: number, opts: { origin?: string; cookie?: string } = {}): Promise<TestClient> {
    const headers: Record<string, string> = { origin: opts.origin ?? `http://127.0.0.1:${port}` };
    if (opts.cookie) headers.cookie = opts.cookie;
    const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { headers });
    const client = new TestClient(ws);
    return new Promise((resolve, reject) => {
      ws.once("open", () => resolve(client));
      ws.once("error", reject);
    });
  }

  send(type: string, payload: unknown, extra: Record<string, unknown> = {}): string {
    const requestId = crypto.randomUUID();
    this.ws.send(JSON.stringify({ protocolVersion: 1, type, requestId, sentAt: Date.now(), payload, ...extra }));
    return requestId;
  }

  sendRaw(raw: string): void {
    this.ws.send(raw);
  }

  waitFor<T extends ServerMessage["type"]>(
    type: T,
    pred: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
    timeoutMs = 2000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const match = (m: ServerMessage) => m.type === type && pred(m as Extract<ServerMessage, { type: T }>);
    const existing = this.messages.find(match);
    if (existing) return Promise.resolve(existing as Extract<ServerMessage, { type: T }>);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout esperando ${type}`)), timeoutMs);
      this.waiters.push({
        pred: match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  clear(): void {
    this.messages.length = 0;
  }

  close(): void {
    this.ws.close();
  }
}

export interface LoginResult {
  status: number;
  cookie: string | null;
  body: { ok: boolean; code?: string; me?: unknown };
}

const cookieFrom = (res: Response) => {
  const set = res.headers.get("set-cookie");
  if (!set) return null;
  return set.split(";")[0] ?? null;
};

export async function login(
  base: string,
  input: { name?: string; role: "pilot" | "hacker"; carId: "car-a" | "car-b"; password?: string; carDisplayName?: string },
  cookie?: string | null,
): Promise<LoginResult> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  const res = await fetch(`${base}/api/session`, {
    method: "POST",
    headers,
    body: JSON.stringify({ ...input, name: input.name ?? "Teste", password: input.password ?? "1234" }),
  });
  return { status: res.status, cookie: cookieFrom(res) ?? cookie ?? null, body: (await res.json()) as LoginResult["body"] };
}

export async function adminLogin(base: string, secret = "admin-secret-test"): Promise<LoginResult> {
  const res = await fetch(`${base}/api/admin/session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ secret }),
  });
  return { status: res.status, cookie: cookieFrom(res), body: (await res.json()) as LoginResult["body"] };
}

export async function connectAs(h: Harness, cookie: string | null): Promise<TestClient> {
  const c = await TestClient.connect(h.port, cookie ? { cookie } : {});
  await c.waitFor("state.snapshot");
  return c;
}
