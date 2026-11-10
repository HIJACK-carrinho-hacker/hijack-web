import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { serverToDeviceSchema } from "@hijack/protocol";
import { WebSocket } from "ws";
import { type Harness, type TestClient, connectAs, login, startServer } from "./helpers.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

class FakeEsp32 {
  readonly received: Record<string, unknown>[] = [];
  closeCode: number | null = null;
  pings = 0;
  private constructor(readonly ws: WebSocket) {
    ws.on("message", (d) => this.received.push(JSON.parse(d.toString())));
    ws.on("ping", () => {
      this.pings++;
    });
    ws.on("close", (code) => {
      this.closeCode = code;
    });
  }

  static async connect(port: number, opts: { autoPong?: boolean } = {}): Promise<FakeEsp32> {
    const ws = new WebSocket(`ws://127.0.0.1:${port}/device`, { autoPong: opts.autoPong ?? true });
    await new Promise((r, j) => {
      ws.once("open", r);
      ws.once("error", j);
    });
    return new FakeEsp32(ws);
  }

  send(type: string, payload: unknown) {
    this.ws.send(JSON.stringify({ protocolVersion: 1, type, payload }));
  }

  hello(deviceId: "car-a" | "car-b", secret: string) {
    this.send("device.hello", { deviceId, secret, firmwareVersion: "0.1.0" });
  }

  async waitFor(type: string, timeout = 1500): Promise<Record<string, unknown>> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const m = this.received.find((x) => x.type === type);
      if (m) return m;
      await sleep(10);
    }
    throw new Error(`timeout esperando ${type}`);
  }

  async waitClose(timeout = 1500): Promise<number> {
    const start = Date.now();
    while (this.closeCode === null && Date.now() - start < timeout) await sleep(10);
    if (this.closeCode === null) throw new Error("não fechou");
    return this.closeCode;
  }

  close() {
    this.ws.close();
  }
}

let h: Harness;
let pilotA: TestClient;

beforeEach(async () => {
  h = await startServer();
});

afterEach(async () => {
  pilotA?.close();
  await h.close();
});

const toHardware = () => expect(h.server.engine.setCarMode("car-a", "hardware").ok).toBe(true);
const run = () => {
  h.server.engine.setDemoState("ready");
  h.server.engine.setDemoState("running");
};

describe("conexão do ESP32", () => {
  test("segredo errado é recusado com 4401", async () => {
    const d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "segredo-errado");
    expect(await d.waitClose()).toBe(4401);
    const ev = h.server.engine.snapshot({ role: "admin" }).events.find((e) => e.kind === "device.authFailed");
    expect(ev?.message).not.toContain("segredo-errado");
  });

  test("primeira mensagem diferente de hello é recusada", async () => {
    const d = await FakeEsp32.connect(h.port);
    d.send("device.ack", { seq: 1, throttle: 0, steering: 0 });
    expect(await d.waitClose()).toBe(4401);
  });

  test("hello correto recebe welcome com a TTL", async () => {
    const d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    const w = await d.waitFor("device.welcome");
    expect(w.payload).toEqual({ carId: "car-a", commandTtlMs: 400 });
    expect(h.server.deviceHub.isConnected("car-a")).toBe(true);
    d.close();
  });

  test("carrinho em hardware fica offline sem ESP32 e online quando ele conecta", async () => {
    toHardware();
    expect(h.server.engine.car("car-a").online).toBe(false);
    const d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    await sleep(20);
    expect(h.server.engine.car("car-a").online).toBe(true);
    d.close();
  });

  test("ESP32 conectado antes da troca de modo é usado na hora", async () => {
    const d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    toHardware();
    expect(h.server.engine.car("car-a").online).toBe(true);
    d.close();
  });
});

describe("comandos para o ESP32", () => {
  test("piloto dirige: ESP32 recebe device.drive válido e o ack vira estado confirmado", async () => {
    toHardware();
    const d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    run();
    pilotA = await connectAs(h, (await login(h.base, { role: "pilot", carId: "car-a" })).cookie);
    pilotA.send("pilot.drive", { throttle: 1, steering: -60, pressed: true });
    const drive = await d.waitFor("device.drive");
    expect(serverToDeviceSchema.safeParse(drive).success).toBe(true);
    expect(drive.payload).toEqual({ throttle: 1, steering: -60, speedMode: "fixed", commandTtlMs: 400 });
    d.send("device.ack", { seq: drive.seq, throttle: 1, steering: -60 });
    await sleep(30);
    const car = h.server.engine.snapshot({ role: "admin" }).cars.find((c) => c.id === "car-a");
    expect(car?.confirmed).toEqual({ throttle: 1, steering: -60 });
    expect(car?.mode).toBe("hardware");
    const m = h.server.engine.snapshot({ role: "admin" }).metrics.find((x) => x.carId === "car-a" && x.mode === "hardware");
    expect(m?.ackLatencyMsP50).not.toBeNull();
    d.close();
  });

  test("STOP geral chega ao ESP32 como device.stop", async () => {
    toHardware();
    const d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    h.server.engine.stopAll();
    const stop = await d.waitFor("device.stop");
    expect(stop.payload).toEqual({ reason: "admin-stop-all" });
    d.close();
  });

  test("queda do ESP32 para o carrinho e reconexão não retoma movimento", async () => {
    toHardware();
    let d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    run();
    pilotA = await connectAs(h, (await login(h.base, { role: "pilot", carId: "car-a" })).cookie);
    pilotA.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await d.waitFor("device.drive");
    d.ws.terminate();
    await sleep(50);
    expect(h.server.engine.car("car-a").online).toBe(false);
    expect(h.server.engine.car("car-a").controller.moving).toBe(false);
    d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    await sleep(150);
    expect(d.received.some((m) => m.type === "device.drive")).toBe(false);
    d.close();
  });

  test("nova conexão do mesmo carrinho substitui a anterior", async () => {
    toHardware();
    const d1 = await FakeEsp32.connect(h.port);
    d1.hello("car-a", "device-secret-a");
    await d1.waitFor("device.welcome");
    const d2 = await FakeEsp32.connect(h.port);
    d2.hello("car-a", "device-secret-a");
    await d2.waitFor("device.welcome");
    expect(await d1.waitClose()).toBe(4409);
    expect(h.server.engine.car("car-a").online).toBe(true);
    d2.close();
  });

  test("watchdog relatado pelo ESP32 para o carrinho no servidor", async () => {
    toHardware();
    const d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    run();
    pilotA = await connectAs(h, (await login(h.base, { role: "pilot", carId: "car-a" })).cookie);
    pilotA.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    const drive = await d.waitFor("device.drive");
    d.send("device.ack", { seq: drive.seq, throttle: 1, steering: 0 });
    d.send("device.stopped", { reason: "watchdog", lastSeq: drive.seq });
    await sleep(30);
    expect(h.server.engine.car("car-a").controller.moving).toBe(false);
    const ev = h.server.engine.snapshot({ role: "admin" }).events.find((e) => e.kind === "safety.deviceWatchdog");
    expect(ev).toBeDefined();
    d.close();
  });

  test("mensagens inválidas do ESP32 autenticado são ignoradas sem derrubar", async () => {
    const d = await FakeEsp32.connect(h.port);
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    d.ws.send("{lixo");
    d.send("device.ack", { seq: 1, throttle: 9, steering: 0 });
    await sleep(30);
    expect(d.closeCode).toBeNull();
    expect((await fetch(`${h.base}/health`)).status).toBe(200);
    d.close();
  });
});

describe("keep-alive do ESP32", () => {
  const keepAlive = { intervalMs: 40, maxMissedPongs: 3 };

  const connectAuthenticated = async () => {
    await h.close();
    h = await startServer({}, { deviceKeepAlive: keepAlive });
    const d = await FakeEsp32.connect(h.port, { autoPong: false });
    d.hello("car-a", "device-secret-a");
    await d.waitFor("device.welcome");
    return d;
  };

  test("quem responde aos pings continua conectado", async () => {
    const d = await connectAuthenticated();
    d.ws.on("ping", () => d.ws.pong());
    await sleep(keepAlive.intervalMs * 10);
    expect(d.closeCode).toBeNull();
    expect(h.server.deviceHub.isConnected("car-a")).toBe(true);
    d.close();
  });

  test("sem nenhum pong, só derruba depois de 3 pings sem resposta", async () => {
    const d = await connectAuthenticated();
    await d.waitClose();
    expect(d.pings).toBe(3);
    expect(h.server.deviceHub.isConnected("car-a")).toBe(false);
  });

  test("um pong no meio zera a contagem de falhas", async () => {
    const d = await connectAuthenticated();
    d.ws.on("ping", () => {
      if (d.pings === 2) d.ws.pong();
    });
    await d.waitClose();
    expect(d.pings).toBe(5);
  });
});
