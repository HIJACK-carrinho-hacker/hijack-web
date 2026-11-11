import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Harness, type TestClient, connectAs, login, startServer } from "./helpers.ts";

let h: Harness;
let hacker: TestClient;
let pilot: TestClient;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  h = await startServer();
  hacker = await connectAs(h, (await login(h.base, { name: "HA", role: "hacker", carId: "car-a" })).cookie);
  pilot = await connectAs(h, (await login(h.base, { name: "PA", role: "pilot", carId: "car-a" })).cookie);
});

afterEach(async () => {
  hacker.close();
  pilot.close();
  await h.close();
});

const rateLimitedErrors = (c: TestClient) =>
  c.messages.filter((m) => m.type === "system.error" && m.payload.code === "rate_limited");

describe("limite de mensagens por conexão", () => {
  test("rajada de ações do hacker recebe rate_limited e não inunda o registro", async () => {
    for (let i = 0; i < 80; i++) hacker.send("defense.setReplayDemo", { enabled: true });
    await sleep(200);
    expect(rateLimitedErrors(hacker).length).toBeGreaterThan(0);
    const replays = h.server.engine.snapshot({ role: "admin" }).events.filter((e) => e.kind === "defense.replay");
    expect(replays.length).toBeLessThan(30);
  });

  test("aviso de limite não é repetido a cada mensagem recusada", async () => {
    for (let i = 0; i < 200; i++) hacker.send("attack.disable", {});
    await sleep(200);
    expect(rateLimitedErrors(hacker).length).toBeLessThan(5);
  });

  test("uso normal do hacker não é limitado", async () => {
    for (let i = 0; i < 8; i++) {
      hacker.send("attack.disable", {});
      await sleep(120);
    }
    expect(rateLimitedErrors(hacker)).toHaveLength(0);
  });

  test("piloto dirigindo a 10 Hz com paradas não é limitado", async () => {
    h.server.engine.setDemoState("ready");
    h.server.engine.setDemoState("running");
    for (let i = 0; i < 40; i++) {
      pilot.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
      await sleep(25);
    }
    pilot.send("pilot.stop", { reason: "release" });
    await sleep(50);
    expect(rateLimitedErrors(pilot)).toHaveLength(0);
  });
});
