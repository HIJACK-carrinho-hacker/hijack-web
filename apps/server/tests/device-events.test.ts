import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { testConfig } from "../src/config/env.ts";
import type { DeviceAdapter, DeviceDriveCommand, DeviceEvent } from "../src/devices/types.ts";
import { HijackEngine } from "../src/engine.ts";

function fakeDevice(carId: "car-a" | "car-b") {
  const listeners = new Set<(e: DeviceEvent) => void>();
  const drives: DeviceDriveCommand[] = [];
  const stops: { reason: string; seq: number }[] = [];
  const adapter: DeviceAdapter = {
    carId,
    mode: "hardware",
    isOnline: () => true,
    drive: (c) => drives.push(c),
    stop: (reason, seq) => stops.push({ reason, seq }),
    pose: () => null,
    onEvent: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    dispose: () => {},
  };
  const emit = (e: DeviceEvent) => {
    for (const l of listeners) l(e);
  };
  return { adapter, drives, stops, emit };
}

type Fake = ReturnType<typeof fakeDevice>;

let engine: HijackEngine;
let devices: Map<string, Fake>;

beforeEach(() => {
  devices = new Map();
  engine = new HijackEngine({
    config: testConfig({ COMMAND_TTL_MS: 5000 }),
    adapterFactory: (carId) => {
      const d = fakeDevice(carId);
      devices.set(carId, d);
      return d.adapter;
    },
  });
  engine.setDemoState("ready");
  engine.setDemoState("running");
});

afterEach(() => engine.dispose());

const dev = () => devices.get("car-a") as Fake;
const drive = (throttle: -1 | 0 | 1 = 1) => engine.pilotInput("car-a", { throttle, steering: 0, pressed: true });
const release = () => engine.pilotStop("car-a", "pilot-release");
const confirmed = () => engine.snapshot({ role: "spectator" }).cars.find((c) => c.id === "car-a")?.confirmed;
const watchdogTrips = () => engine.snapshot({ role: "admin" }).metrics.find((m) => m.carId === "car-a")?.watchdogTrips;
const kinds = (kind: string) => engine.events.all().filter((e) => e.kind === kind).length;
const at = () => Date.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const driveAgain = async () => {
  await sleep(70);
  drive();
};

describe("eventos do dispositivo fora de ordem", () => {
  test("ack de um comando anterior à última parada não altera o confirmado", () => {
    drive();
    const driveSeq = dev().drives[0]?.seq ?? 0;
    release();
    dev().emit({ kind: "ack", seq: driveSeq, throttle: 1, steering: 0, at: at() });
    expect(confirmed()).toEqual({ throttle: 0, steering: 0 });
  });

  test("ack do comando atual continua atualizando o confirmado", () => {
    drive();
    const driveSeq = dev().drives[0]?.seq ?? 0;
    dev().emit({ kind: "ack", seq: driveSeq, throttle: 1, steering: 0, at: at() });
    expect(confirmed()).toEqual({ throttle: 1, steering: 0 });
  });

  test("ack posterior à parada, de um comando novo, é aplicado", async () => {
    drive();
    release();
    await driveAgain();
    const newer = dev().drives[1]?.seq ?? 0;
    dev().emit({ kind: "ack", seq: newer, throttle: 1, steering: 0, at: at() });
    expect(confirmed()).toEqual({ throttle: 1, steering: 0 });
  });

  test("stopped atrasado de uma soltura anterior não para o movimento novo", async () => {
    drive();
    release();
    const stopSeq = dev().stops[0]?.seq ?? 0;
    await driveAgain();
    expect(engine.car("car-a").controller.moving).toBe(true);
    dev().emit({ kind: "stopped", reason: "pilot-release", lastSeq: stopSeq, at: at() });
    expect(engine.car("car-a").controller.moving).toBe(true);
    expect(engine.car("car-a").controller.stopReason).toBeNull();
  });

  test("stopped do comando atual ainda para o carro", () => {
    drive();
    const driveSeq = dev().drives[0]?.seq ?? 0;
    dev().emit({ kind: "stopped", reason: "pilot-release", lastSeq: driveSeq, at: at() });
    expect(engine.car("car-a").controller.moving).toBe(false);
  });

  test("telemetria de antes da última parada não altera o confirmado", () => {
    drive();
    const driveSeq = dev().drives[0]?.seq ?? 0;
    release();
    dev().emit({
      kind: "telemetry",
      telemetry: {
        uptimeMs: 1000,
        rssi: -40,
        lastSeq: driveSeq,
        throttle: 1,
        steering: 0,
        reconnects: 0,
        rejectedCommands: 0,
        watchdogTrips: 0,
        stopReason: null,
      },
      at: at(),
    });
    expect(confirmed()).toEqual({ throttle: 0, steering: 0 });
  });
});

describe("watchdog do dispositivo", () => {
  test("uma expiração conta uma vez e é registrada como do carrinho", () => {
    drive();
    const driveSeq = dev().drives[0]?.seq ?? 0;
    dev().emit({ kind: "stopped", reason: "watchdog", lastSeq: driveSeq, at: at() });
    expect(watchdogTrips()).toBe(1);
    expect(kinds("safety.deviceWatchdog")).toBe(1);
    expect(kinds("safety.watchdog")).toBe(0);
    expect(engine.car("car-a").controller.moving).toBe(false);
  });

  test("watchdog atrasado ainda conta, mas não para um comando mais novo", async () => {
    drive();
    const firstSeq = dev().drives[0]?.seq ?? 0;
    release();
    await driveAgain();
    dev().emit({ kind: "stopped", reason: "watchdog", lastSeq: firstSeq, at: at() });
    expect(watchdogTrips()).toBe(1);
    expect(kinds("safety.deviceWatchdog")).toBe(1);
    expect(engine.car("car-a").controller.moving).toBe(true);
  });

  test("o watchdog do servidor continua contando uma vez", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    expect(watchdogTrips()).toBe(1);
    expect(kinds("safety.watchdog")).toBe(1);
  });
});
