import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { SimulatorAdapter } from "../src/adapters/simulator/simulator-adapter.ts";
import { testConfig } from "../src/config/env.ts";
import { HijackEngine } from "../src/engine.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let engine: HijackEngine;
const sims = new Map<string, SimulatorAdapter>();

beforeEach(() => {
  sims.clear();
  engine = new HijackEngine({
    config: testConfig({ COMMAND_TTL_MS: 120 }),
    adapterFactory: (carId) => {
      const s = new SimulatorAdapter(carId, { tickMs: 10, telemetryMs: 50 });
      sims.set(carId, s);
      return s;
    },
  });
});

afterEach(() => engine.dispose());

const run = () => {
  engine.setDemoState("ready");
  engine.setDemoState("running");
};

describe("HijackEngine", () => {
  test("inicia em setup com os dois carros parados", () => {
    const s = engine.snapshot({ role: "spectator" });
    expect(s.demoState).toBe("setup");
    expect(s.cars.every((c) => !c.moving)).toBe(true);
  });

  test("piloto só move durante RUNNING", () => {
    const r = engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    expect(r).toMatchObject({ ok: false, code: "demo_not_running" });
    run();
    expect(engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true }).ok).toBe(true);
    expect(engine.car("car-a").controller.moving).toBe(true);
  });

  test("comando afeta somente o carro correto", async () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: -1, pressed: true });
    await sleep(20);
    const s = engine.snapshot({ role: "spectator" });
    const a = s.cars.find((c) => c.id === "car-a");
    const b = s.cars.find((c) => c.id === "car-b");
    expect(a?.confirmed).toEqual({ throttle: 1, steering: -1 });
    expect(b?.confirmed).toEqual({ throttle: 0, steering: 0 });
    expect(b?.moving).toBe(false);
  });

  test("dois carros podem ser controlados ao mesmo tempo", async () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    engine.pilotInput("car-b", { throttle: -1, steering: 1, pressed: true });
    await sleep(20);
    const s = engine.snapshot({ role: "spectator" });
    expect(s.cars.map((c) => c.confirmed)).toEqual([
      { throttle: 1, steering: 0 },
      { throttle: -1, steering: 1 },
    ]);
  });

  test("soltar o joystick para", () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: false });
    expect(engine.car("car-a").controller.moving).toBe(false);
  });

  test("timeout para o carro sem refresh do piloto", async () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    await sleep(220);
    expect(engine.car("car-a").controller.moving).toBe(false);
    expect(engine.car("car-a").controller.stopReason).toBe("watchdog");
  });

  test("refresh contínuo mantém o movimento", async () => {
    run();
    for (let i = 0; i < 5; i++) {
      engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
      await sleep(60);
    }
    expect(engine.car("car-a").controller.moving).toBe(true);
  });

  test("pausar força STOP e bloqueia novos movimentos", () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    engine.pilotInput("car-b", { throttle: 1, steering: 0, pressed: true });
    expect(engine.setDemoState("paused").ok).toBe(true);
    expect(engine.car("car-a").controller.moving).toBe(false);
    expect(engine.car("car-b").controller.moving).toBe(false);
    expect(engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true }).ok).toBe(false);
  });

  test("STOP ALL para tudo", () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    engine.pilotInput("car-b", { throttle: -1, steering: 0, pressed: true });
    engine.stopAll();
    expect(engine.car("car-a").controller.moving).toBe(false);
    expect(engine.car("car-b").controller.moving).toBe(false);
  });

  test("transição inválida é recusada", () => {
    expect(engine.setDemoState("running")).toMatchObject({ ok: false });
    expect(engine.demoState).toBe("setup");
  });

  test("desconexão do carrinho para a tração e não retoma ao reconectar", async () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    sims.get("car-a")?.setOnline(false);
    expect(engine.car("car-a").controller.moving).toBe(false);
    sims.get("car-a")?.setOnline(true);
    await sleep(20);
    expect(engine.car("car-a").controller.moving).toBe(false);
    expect(engine.snapshot({ role: "spectator" }).cars[0]?.confirmed).toEqual({ throttle: 0, steering: 0 });
  });

  test("teste manual do operador só fora da demonstração e em carro simulado", () => {
    expect(engine.manualDrive("car-b", { throttle: 1, steering: 0 }).ok).toBe(true);
    run();
    expect(engine.manualDrive("car-b", { throttle: 1, steering: 0 })).toMatchObject({ ok: false });
  });

  test("métricas registram ack e separam o modo", async () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    await sleep(20);
    const m = engine.snapshot({ role: "admin" }).metrics.find((x) => x.carId === "car-a");
    expect(m?.mode).toBe("simulated");
    expect(m?.received).toBe(1);
    expect(m?.applied).toBe(1);
    expect(m?.ackLatencyMsP50).not.toBeNull();
  });

  test("piloto não recebe métricas", () => {
    const s = engine.snapshot({ role: "pilot", displayName: "Ana", teamId: "A", carId: "car-a" });
    expect(s.metrics).toEqual([]);
  });

  test("encerrar o motor (restart) deixa tudo parado", () => {
    run();
    engine.pilotInput("car-a", { throttle: 1, steering: 0, pressed: true });
    engine.dispose();
    expect(engine.car("car-a").controller.moving).toBe(false);
  });
});
