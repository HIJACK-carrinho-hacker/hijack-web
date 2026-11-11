import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Harness, type TestClient, adminLogin, connectAs, startServer } from "./helpers.ts";

let h: Harness;
let c: TestClient;

beforeEach(async () => {
  h = await startServer();
  const admin = await adminLogin(h.base);
  c = await connectAs(h, admin.cookie);
});

afterEach(async () => {
  c.close();
  await h.close();
});

describe("simulador via WebSocket", () => {
  test("teste manual move só o carro escolhido e o snapshot reflete", async () => {
    c.send("sim.manualDrive", { carId: "car-a", throttle: 1, steering: 1 });
    const snap = await c.waitFor("state.snapshot", (m) =>
      m.payload.state.cars.some((car) => car.id === "car-a" && car.confirmed.throttle === 1),
    );
    const b = snap.payload.state.cars.find((car) => car.id === "car-b");
    expect(b?.confirmed).toEqual({ throttle: 0, steering: 0 });
    expect(b?.moving).toBe(false);
  });

  test("STOP geral avisa todos e para o carro", async () => {
    c.send("sim.manualDrive", { carId: "car-b", throttle: -1, steering: 0 });
    await c.waitFor("state.snapshot", (m) => m.payload.state.cars.some((car) => car.id === "car-b" && car.moving));
    c.clear();
    c.send("admin.stopAll", { reason: "teste" });
    await c.waitFor("system.stopAll");
    const snap = await c.waitFor("state.snapshot", (m) => m.payload.state.cars.every((car) => !car.moving));
    expect(snap.payload.state.cars.every((car) => car.confirmed.throttle === 0)).toBe(true);
  });

  test("STOP geral durante a partida pausa a demonstração", async () => {
    c.send("admin.setDemoState", { state: "ready" });
    c.send("admin.setDemoState", { state: "running" });
    await c.waitFor("state.snapshot", (m) => m.payload.state.demoState === "running");
    c.clear();
    c.send("admin.stopAll", { reason: "teste" });
    await c.waitFor("state.snapshot", (m) => m.payload.state.demoState === "paused");
  });

  test("stateRevision é monotônica", async () => {
    c.send("sim.manualDrive", { carId: "car-a", throttle: 1, steering: 0 });
    await c.waitFor("state.snapshot", (m) => m.payload.state.cars.some((car) => car.moving));
    const revs = c.messages.filter((m) => m.type === "state.snapshot").map((m) => m.stateRevision);
    expect([...revs].sort((a, b) => a - b)).toEqual(revs);
  });
});
