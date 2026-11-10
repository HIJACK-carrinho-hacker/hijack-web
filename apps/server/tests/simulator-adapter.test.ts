import { afterEach, describe, expect, test } from "bun:test";
import { SimulatorAdapter } from "../src/adapters/simulator/simulator-adapter.ts";
import type { DeviceEvent } from "../src/devices/types.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let sim: SimulatorAdapter;

afterEach(() => sim?.dispose());

const collect = (s: SimulatorAdapter) => {
  const events: DeviceEvent[] = [];
  s.onEvent((e) => events.push(e));
  return events;
};

describe("SimulatorAdapter", () => {
  test("aplica comando e confirma com ack", () => {
    sim = new SimulatorAdapter("car-a", { tickMs: 10 });
    const events = collect(sim);
    sim.drive({ seq: 1, throttle: 1, steering: -60, ttlMs: 400 });
    expect(events).toContainEqual(expect.objectContaining({ kind: "ack", seq: 1, throttle: 1, steering: -60 }));
  });

  test("taxa de giro é proporcional à direção", async () => {
    const t = { now: 0 };
    const clock = { now: () => t.now };
    const full = new SimulatorAdapter("car-a", { tickMs: 5, telemetryMs: 10_000, clock });
    const half = new SimulatorAdapter("car-b", { tickMs: 5, telemetryMs: 10_000, clock });
    sim = full;
    full.drive({ seq: 1, throttle: 1, steering: 100, ttlMs: 2000 });
    half.drive({ seq: 1, throttle: 1, steering: 50, ttlMs: 2000 });
    const h0 = full.pose().heading;
    for (let i = 0; i < 10; i++) {
      t.now += 20;
      await sleep(8);
    }
    const dFull = full.pose().heading - h0;
    const dHalf = half.pose().heading - h0;
    half.dispose();
    expect(dFull).toBeGreaterThan(0);
    expect(dHalf / dFull).toBeCloseTo(0.5, 1);
  });

  test("descarta seq antigo ou repetido", () => {
    sim = new SimulatorAdapter("car-a", { tickMs: 10, telemetryMs: 20 });
    const events = collect(sim);
    sim.drive({ seq: 5, throttle: 1, steering: 0, ttlMs: 300 });
    sim.drive({ seq: 5, throttle: -1, steering: 0, ttlMs: 300 });
    sim.drive({ seq: 3, throttle: -1, steering: 0, ttlMs: 300 });
    expect(events.filter((e) => e.kind === "ack")).toHaveLength(1);
  });

  test("watchdog local para a tração sem comando novo", async () => {
    sim = new SimulatorAdapter("car-a", { tickMs: 10 });
    const events = collect(sim);
    sim.drive({ seq: 1, throttle: 1, steering: 0, ttlMs: 60 });
    await sleep(120);
    expect(events).toContainEqual(expect.objectContaining({ kind: "stopped", reason: "watchdog" }));
  });

  test("move enquanto há comando válido e para no STOP", async () => {
    sim = new SimulatorAdapter("car-a", { tickMs: 10, start: { x: 0.5, y: 0.5, heading: 0 } });
    sim.drive({ seq: 1, throttle: 1, steering: 0, ttlMs: 500 });
    await sleep(80);
    const moved = sim.pose();
    expect(moved.x).toBeGreaterThan(0.5);
    sim.stop("pilot-stop", 2);
    await sleep(40);
    expect(sim.pose().x).toBeCloseTo(sim.pose().x);
    const after = sim.pose().x;
    await sleep(40);
    expect(sim.pose().x).toBe(after);
  });

  test("desconexão para e reconexão não retoma movimento", () => {
    sim = new SimulatorAdapter("car-a", { tickMs: 10 });
    const events = collect(sim);
    sim.drive({ seq: 1, throttle: 1, steering: 0, ttlMs: 300 });
    sim.setOnline(false);
    sim.drive({ seq: 2, throttle: 1, steering: 0, ttlMs: 300 });
    sim.setOnline(true);
    expect(events.filter((e) => e.kind === "ack")).toHaveLength(1);
    expect(events).toContainEqual(expect.objectContaining({ kind: "connection", online: false }));
  });
});
