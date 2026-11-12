import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { testConfig } from "../src/config/env.ts";
import type { Clock, DeviceAdapter, DeviceDriveCommand, DeviceEvent } from "../src/devices/types.ts";
import { HijackEngine } from "../src/engine.ts";

let echoStops = false;

function fakeDevice(carId: "car-a" | "car-b") {
  const listeners = new Set<(e: DeviceEvent) => void>();
  const drives: DeviceDriveCommand[] = [];
  const stops: { reason: string; seq: number }[] = [];
  const emit = (e: DeviceEvent) => {
    for (const l of listeners) l(e);
  };
  const adapter: DeviceAdapter = {
    carId,
    mode: "hardware",
    isOnline: () => true,
    drive: (c) => drives.push(c),
    stop: (reason, seq) => {
      stops.push({ reason, seq });
      if (echoStops) emit({ kind: "stopped", reason, lastSeq: seq, at: Date.now() });
    },
    pose: () => null,
    onEvent: (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    dispose: () => {},
  };
  return { adapter, drives, stops, emit };
}

type Fake = ReturnType<typeof fakeDevice>;

let engine: HijackEngine;
let devices: Map<string, Fake>;

const makeEngine = (clock?: Clock) => {
  devices = new Map();
  engine = new HijackEngine({
    config: testConfig({ COMMAND_TTL_MS: 5000 }),
    ...(clock ? { clock } : {}),
    adapterFactory: (carId) => {
      const d = fakeDevice(carId);
      devices.set(carId, d);
      return d.adapter;
    },
  });
  engine.setDemoState("ready");
  engine.setDemoState("running");
};

beforeEach(() => {
  echoStops = false;
  makeEngine();
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
    const stopSeq = dev().stops.at(-1)?.seq ?? 0;
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

  test("o eco do firmware ao stop de watchdog do servidor não conta como watchdog do carrinho", () => {
    echoStops = true;
    drive();
    engine.car("car-a").controller.stop("watchdog");
    expect(watchdogTrips()).toBe(1);
    expect(kinds("safety.watchdog")).toBe(1);
    expect(kinds("safety.deviceWatchdog")).toBe(0);
  });

  test("com o eco ligado, uma expiração do firmware ainda conta uma vez", () => {
    echoStops = true;
    drive();
    const driveSeq = dev().drives[0]?.seq ?? 0;
    dev().emit({ kind: "stopped", reason: "watchdog", lastSeq: driveSeq, at: at() });
    expect(watchdogTrips()).toBe(1);
    expect(kinds("safety.deviceWatchdog")).toBe(1);
    expect(kinds("safety.watchdog")).toBe(0);
  });

  test("o eco de outros motivos de parada não conta nem registra watchdog", () => {
    echoStops = true;
    drive();
    release();
    engine.stopAll();
    expect(watchdogTrips()).toBe(0);
    expect(kinds("safety.deviceWatchdog")).toBe(0);
  });

  test("eco atrasado de um stop anterior, depois de um segundo stop, não conta como watchdog do carrinho", async () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    const firstStopSeq = dev().stops.at(-1)?.seq ?? 0;
    const before = dev().stops.length;
    await sleep(70);
    engine.car("car-a").controller.stop("pilot-release");
    expect(dev().stops).toHaveLength(before + 1);
    dev().emit({ kind: "stopped", reason: "watchdog", lastSeq: firstStopSeq, at: at() });
    expect(watchdogTrips()).toBe(1);
    expect(kinds("safety.deviceWatchdog")).toBe(0);
  });
});

describe("motivo da parada", () => {
  const stopReason = () => engine.snapshot({ role: "spectator" }).cars.find((c) => c.id === "car-a")?.stopReason;

  test("STOP ALL grava o motivo mesmo com o carro já parado por watchdog", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    expect(stopReason()).toBe("watchdog");
    engine.emergencyStop();
    expect(stopReason()).toBe("admin-stop-all");
  });

  test("STOP ALL com a partida pausada também grava o motivo", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    engine.setDemoState("paused");
    engine.emergencyStop();
    expect(stopReason()).toBe("admin-stop-all");
  });

  test("STOP ALL fora de running e paused não grava o motivo, para a largada seguinte não começar em parada de segurança", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    engine.setDemoState("stopped");
    engine.setDemoState("ready");
    engine.emergencyStop();
    expect(stopReason()).toBe("demo-not-running");
  });

  test("o motivo de parada de segurança não vaza para a largada seguinte depois de STOP ALL com a partida pausada", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    engine.setDemoState("paused");
    engine.emergencyStop();
    expect(stopReason()).toBe("admin-stop-all");
    engine.setDemoState("stopped");
    engine.setDemoState("ready");
    engine.setDemoState("running");
    expect(stopReason()).toBe("demo-not-running");
  });

  test("o motivo de parada de segurança não vaza para a largada seguinte depois de STOP ALL com o carro andando", () => {
    drive();
    engine.emergencyStop();
    expect(stopReason()).toBe("admin-stop-all");
    engine.setDemoState("stopped");
    engine.setDemoState("ready");
    engine.setDemoState("running");
    expect(stopReason()).toBe("demo-not-running");
  });

  test("voltar à configuração também troca o motivo por demo-not-running", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    engine.setDemoState("stopped");
    engine.setDemoState("setup");
    expect(stopReason()).toBe("demo-not-running");
  });

  test("pausar e retomar não troca o motivo da parada de segurança", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    engine.setDemoState("paused");
    engine.setDemoState("running");
    expect(stopReason()).toBe("watchdog");
  });

  test("stopAll sem argumentos registra no log mas não grava o motivo", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    engine.stopAll();
    expect(stopReason()).toBe("watchdog");
    expect(kinds("safety.stopAll")).toBe(1);
  });

  test("reset e troca de topologia não gravam o motivo de STOP ALL em carros parados", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    engine.stopAll("admin-stop-all", false);
    expect(stopReason()).toBe("watchdog");
  });

  test("outros motivos não sobrescrevem o motivo de um carro já parado", () => {
    drive();
    engine.car("car-a").controller.stop("watchdog");
    engine.car("car-a").controller.stop("pilot-release");
    expect(stopReason()).toBe("watchdog");
  });
});

describe("confirmado sem dados", () => {
  let now = 1_000_000;
  const staleOf = (viewer: Parameters<HijackEngine["snapshot"]>[0] = { role: "spectator" }) =>
    engine.snapshot(viewer).cars.find((c) => c.id === "car-a")?.confirmedStale;
  const telemetry = (): DeviceEvent => ({
    kind: "telemetry",
    telemetry: {
      uptimeMs: 1000,
      rssi: -40,
      lastSeq: 0,
      throttle: 0,
      steering: 0,
      reconnects: 0,
      rejectedCommands: 0,
      watchdogTrips: 0,
      stopReason: null,
    },
    at: now,
  });

  beforeEach(() => {
    engine.dispose();
    now = 1_000_000;
    makeEngine({ now: () => now });
  });

  test("com dados recentes o confirmado não é marcado como sem dados", async () => {
    dev().emit(telemetry());
    now += 1000;
    await sleep(70);
    expect(staleOf()).toBe(false);
  });

  test("online e calado por mais de 1,5 s marca o confirmado como sem dados", async () => {
    dev().emit(telemetry());
    now += 1600;
    await sleep(70);
    expect(staleOf()).toBe(true);
  });

  test("qualquer evento novo do dispositivo tira a marca na hora", async () => {
    dev().emit(telemetry());
    now += 1600;
    await sleep(70);
    expect(staleOf()).toBe(true);
    dev().emit({ kind: "ack", seq: 1, throttle: 0, steering: 0, at: now });
    expect(staleOf()).toBe(false);
  });

  test("carrinho offline não é marcado como sem dados, o estado offline já aparece", async () => {
    dev().emit({ kind: "connection", online: false, at: now });
    now += 5000;
    await sleep(70);
    expect(staleOf()).toBe(false);
  });

  test("sem nenhum dado recebido ainda, não há o que marcar como velho", async () => {
    now += 5000;
    await sleep(70);
    expect(staleOf()).toBe(false);
  });

  test("o piloto nunca vê a marca, porque não vê o confirmado", async () => {
    dev().emit(telemetry());
    now += 1600;
    await sleep(70);
    expect(staleOf({ role: "pilot", displayName: "p", teamId: "A", carId: "car-a" })).toBe(false);
  });

  test("um fault não tira a marca, porque não traz estado do carro", async () => {
    dev().emit(telemetry());
    now += 1600;
    await sleep(70);
    expect(staleOf()).toBe(true);
    dev().emit({ kind: "fault", code: "teste", detail: "x", at: now });
    expect(staleOf()).toBe(true);
  });

  test("trocar o modo do carrinho recomeça a contagem em vez de herdar a marca antiga", async () => {
    dev().emit(telemetry());
    now += 1600;
    await sleep(70);
    expect(staleOf()).toBe(true);
    engine.setDemoState("paused");
    const target = engine.car("car-a").mode === "hardware" ? "simulated" : "hardware";
    engine.setCarMode("car-a", target);
    await sleep(70);
    expect(staleOf()).toBe(false);
  });

  test("a virada é transmitida uma vez, sem mensagens repetidas enquanto continua calado", async () => {
    dev().emit(telemetry());
    let changes = 0;
    engine.onChange(() => changes++);
    now += 1600;
    await sleep(70);
    const afterFlip = changes;
    expect(afterFlip).toBeGreaterThanOrEqual(1);
    await sleep(150);
    expect(changes).toBe(afterFlip);
  });
});
