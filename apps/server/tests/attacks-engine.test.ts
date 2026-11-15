import { afterEach, describe, expect, test } from "bun:test";
import { type AttackConfig, DEFAULT_ATTACK_CONFIG, JAM_COOLDOWN_MS, JAM_MS, REPLAY_DELAY_MS } from "@hijack/protocol";
import { testConfig } from "../src/config/env.ts";
import type { DeviceAdapter, DeviceDriveCommand, DeviceEvent } from "../src/devices/types.ts";
import { HijackEngine, type Viewer } from "../src/engine.ts";

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
let now = 1_000_000;
let rnd = 0.5;

const make = () => {
  devices = new Map();
  now = 1_000_000;
  engine = new HijackEngine({
    config: testConfig({ COMMAND_TTL_MS: 5000 }),
    clock: { now: () => now },
    random: () => rnd,
    adapterFactory: (carId) => {
      const d = fakeDevice(carId);
      devices.set(carId, d);
      return d.adapter;
    },
  });
  engine.setDemoState("ready");
  engine.setDemoState("running");
};

afterEach(() => engine.dispose());

const dev = () => devices.get("car-a") as Fake;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const lastDrive = () => {
  const d = dev().drives.at(-1);
  return d ? { throttle: d.throttle, steering: d.steering } : null;
};
const attack = (c: Partial<AttackConfig>, d: { integrity?: boolean; replay?: boolean } = {}) =>
  engine.setAttackResolver((carId) =>
    carId === "car-a"
      ? {
          attackerTeam: "B",
          config: { ...DEFAULT_ATTACK_CONFIG, ...c },
          integrity: d.integrity ?? false,
          replayDefense: d.replay ?? false,
        }
      : null,
  );
const pilot = (throttle: -1 | 0 | 1, steering = 0, pressed = true) =>
  engine.pilotInput("car-a", { throttle, steering, pressed });
const carFor = (viewer: Viewer) => engine.snapshot(viewer).cars.find((c) => c.id === "car-a");
const defender: Viewer = { role: "hacker", displayName: "HA", teamId: "A", carId: "car-a" };
const attacker: Viewer = { role: "hacker", displayName: "HB", teamId: "B", carId: "car-b" };
const pilotA: Viewer = { role: "pilot", displayName: "PA", teamId: "A", carId: "car-a" };

describe("atraso de comandos", () => {
  test("comando chega ao carrinho só depois do atraso", async () => {
    make();
    attack({ delayMs: 150 });
    pilot(1);
    expect(dev().drives).toHaveLength(0);
    await sleep(200);
    expect(lastDrive()).toEqual({ throttle: 1, steering: 0 });
  });

  test("soltar cancela os comandos atrasados e para na hora", async () => {
    make();
    attack({ delayMs: 150 });
    pilot(1);
    pilot(0, 0, false);
    await sleep(200);
    expect(dev().drives).toHaveLength(0);
    expect(engine.car("car-a").controller.moving).toBe(false);
  });

  test("STOP geral cancela os comandos atrasados", async () => {
    make();
    attack({ delayMs: 300 });
    pilot(1);
    engine.emergencyStop();
    await sleep(350);
    expect(dev().drives).toHaveLength(0);
  });
});

describe("perda de pacotes", () => {
  test("comando sorteado é descartado e contado", () => {
    make();
    attack({ dropPct: 60 });
    rnd = 0.1;
    pilot(1);
    expect(dev().drives).toHaveLength(0);
    expect(engine.snapshot({ role: "admin" }).metrics.find((m) => m.carId === "car-a")?.dropped).toBe(1);
    rnd = 0.9;
    pilot(1);
    expect(dev().drives).toHaveLength(1);
  });

  test("soltar nunca é descartado", () => {
    make();
    attack({ dropPct: 60 });
    rnd = 0.9;
    pilot(1);
    rnd = 0;
    pilot(0, 0, false);
    expect(engine.car("car-a").controller.moving).toBe(false);
    expect(dev().stops.at(-1)?.reason).toBe("pilot-release");
  });
});

describe("replay", () => {
  test("carrinho repete o comando de 5 s atrás", () => {
    make();
    attack({ replay: true });
    pilot(-1, -40);
    now += REPLAY_DELAY_MS;
    pilot(1, 0);
    expect(lastDrive()).toEqual({ throttle: -1, steering: -40 });
  });

  test("sem histórico de 5 s o comando passa intacto", () => {
    make();
    attack({ replay: true });
    pilot(1, 20);
    expect(lastDrive()).toEqual({ throttle: 1, steering: 20 });
  });

  test("defesa de repetição recusa e registra", () => {
    make();
    attack({ replay: true }, { replay: true });
    pilot(-1, -40);
    now += REPLAY_DELAY_MS;
    pilot(1, 0);
    expect(lastDrive()).toEqual({ throttle: 1, steering: 0 });
    expect(engine.events.all().some((e) => e.message.startsWith("Repetição recusada"))).toBe(true);
  });
});

describe("travar direção", () => {
  test("direção fica na posição do primeiro comando depois de travar", () => {
    make();
    attack({ lockSteering: true });
    pilot(1, 30);
    now += 100;
    pilot(1, -80);
    expect(lastDrive()).toEqual({ throttle: 1, steering: 30 });
  });

  test("destravar volta a obedecer o piloto", () => {
    make();
    attack({ lockSteering: true });
    pilot(1, 30);
    attack({});
    now += 100;
    pilot(1, -80);
    expect(lastDrive()).toEqual({ throttle: 1, steering: -80 });
  });
});

describe("derrubar o link", () => {
  test("para na hora, recusa comandos por 5 s e volta sozinho", async () => {
    make();
    pilot(1);
    expect(engine.jamLink("car-a").ok).toBe(true);
    expect(engine.car("car-a").controller.stopReason).toBe("link-jammed");
    expect(pilot(1)).toMatchObject({ ok: false, code: "link_jammed" });
    expect(carFor(pilotA)?.jammed).toBe(true);
    now += JAM_MS;
    await sleep(80);
    expect(carFor(pilotA)?.jammed).toBe(false);
    expect(pilot(1).ok).toBe(true);
    expect(engine.events.all().some((e) => e.kind === "attack.jamEnded")).toBe(true);
  });

  test("não dá para derrubar de novo antes do intervalo", () => {
    make();
    engine.jamLink("car-a");
    now += JAM_MS;
    expect(engine.jamLink("car-a")).toMatchObject({ ok: false, code: "forbidden" });
    now += JAM_COOLDOWN_MS;
    expect(engine.jamLink("car-a").ok).toBe(true);
  });

  test("soltar o joystick continua parando durante a queda", () => {
    make();
    engine.jamLink("car-a");
    expect(pilot(0, 0, false).ok).toBe(true);
    expect(engine.car("car-a").controller.moving).toBe(false);
  });
});

describe("sequestro", () => {
  test("hacker dirige, piloto é ignorado e o piloto vê o aviso", () => {
    make();
    pilot(1);
    engine.setHijack("car-a", "B");
    expect(engine.car("car-a").controller.stopReason).toBe("hijack-start");
    expect(engine.car("car-a").controller.moving).toBe(false);
    expect(pilot(1)).toMatchObject({ ok: false, code: "hijacked" });
    now += 100;
    expect(engine.hijackInput("car-a", "B", { throttle: -1, steering: 60, pressed: true }).ok).toBe(true);
    expect(lastDrive()).toEqual({ throttle: -1, steering: 60 });
    const stops = dev().stops.length;
    expect(pilot(0, 0, false).ok).toBe(true);
    engine.pilotStop("car-a", "pilot-stop");
    expect(dev().stops).toHaveLength(stops);
    expect(engine.car("car-a").controller.moving).toBe(true);
    expect(carFor(pilotA)?.hijacked).toBe(true);
  });

  test("só a equipe que sequestrou dirige", () => {
    make();
    engine.setHijack("car-a", "B");
    expect(engine.hijackInput("car-a", "A", { throttle: 1, steering: 0, pressed: true })).toMatchObject({
      ok: false,
      code: "forbidden",
    });
  });

  test("hacker solta, STOP geral e fim do sequestro param o carrinho", () => {
    make();
    engine.setHijack("car-a", "B");
    engine.hijackInput("car-a", "B", { throttle: 1, steering: 0, pressed: true });
    engine.hijackInput("car-a", "B", { throttle: 0, steering: 0, pressed: false });
    expect(engine.car("car-a").controller.stopReason).toBe("hijack-release");
    engine.hijackInput("car-a", "B", { throttle: 1, steering: 0, pressed: true });
    engine.emergencyStop();
    expect(engine.car("car-a").controller.moving).toBe(false);
    engine.hijackInput("car-a", "B", { throttle: 1, steering: 0, pressed: true });
    engine.setDemoState("running");
    now += 100;
    expect(engine.hijackInput("car-a", "B", { throttle: 1, steering: 0, pressed: true })).toMatchObject({
      ok: false,
      code: "release_required",
    });
    engine.hijackInput("car-a", "B", { throttle: 0, steering: 0, pressed: false });
    engine.hijackInput("car-a", "B", { throttle: 1, steering: 0, pressed: true });
    engine.setHijack("car-a", null);
    expect(engine.car("car-a").controller.moving).toBe(false);
    expect(pilot(1).ok).toBe(true);
  });

  test("sequestro não anda com a partida pausada", () => {
    make();
    engine.setHijack("car-a", "B");
    engine.setDemoState("paused");
    expect(engine.hijackInput("car-a", "B", { throttle: 1, steering: 0, pressed: true })).toMatchObject({
      ok: false,
      code: "demo_not_running",
    });
  });
});

describe("interceptar tráfego", () => {
  test("registra o que o piloto manda e o que o servidor envia ao carrinho", () => {
    make();
    attack({ intercept: true, invertThrottle: true });
    pilot(1, 20);
    const texts = engine.intercepted("car-a").map((r) => r.text);
    expect(texts.some((t) => t.startsWith("pilot.drive") && t.includes('"throttle":1'))).toBe(true);
    expect(texts.some((t) => t.startsWith("device.drive seq=") && t.includes('"throttle":-1'))).toBe(true);
  });

  test("sem interceptação nada é registrado e o registro tem limite", () => {
    make();
    pilot(1);
    expect(engine.intercepted("car-a")).toEqual([]);
    attack({ intercept: true });
    for (let i = 0; i < 40; i++) {
      now += 100;
      pilot(1, i % 2 ? 10 : -10);
    }
    expect(engine.intercepted("car-a").length).toBeLessThanOrEqual(15);
  });
});

describe("telemetria falsa", () => {
  const setup = (integrity: boolean) => {
    make();
    attack({ spoofTelemetry: true, invertThrottle: true }, { integrity });
    pilot(1, 0);
    const seq = dev().drives.at(-1)?.seq ?? 0;
    dev().emit({ kind: "ack", seq, throttle: integrity ? 1 : -1, steering: 0, at: now });
  };

  test("defensor vê o carrinho obedecendo; projetor e atacante veem a verdade", () => {
    setup(false);
    expect(carFor(defender)?.confirmed).toEqual({ throttle: 1, steering: 0 });
    expect(carFor({ role: "spectator" })?.confirmed).toEqual({ throttle: -1, steering: 0 });
    expect(carFor(attacker)?.confirmed).toEqual({ throttle: -1, steering: 0 });
  });

  test("evento de comando alterado fica escondido do defensor", () => {
    setup(false);
    const has = (v: Viewer) => engine.snapshot(v).events.some((e) => e.kind === "attack.transformed");
    expect(has(defender)).toBe(false);
    expect(has(attacker)).toBe(true);
    expect(has({ role: "admin" })).toBe(true);
  });

  test("integridade derruba a telemetria falsa", () => {
    setup(true);
    expect(carFor(defender)?.confirmed).toEqual({ throttle: 1, steering: 0 });
    expect(carFor({ role: "spectator" })?.confirmed).toEqual({ throttle: 1, steering: 0 });
    attack({ spoofTelemetry: true }, { integrity: true });
    dev().emit({ kind: "ack", seq: dev().drives.at(-1)?.seq ?? 0, throttle: -1, steering: 0, at: now });
    expect(carFor(defender)?.confirmed).toEqual({ throttle: -1, steering: 0 });
  });
});

describe("limpeza do estado de ataque", () => {
  test("clearAttackState encerra sequestro, queda e interceptação", () => {
    make();
    attack({ intercept: true });
    pilot(1);
    engine.setHijack("car-a", "B");
    engine.jamLink("car-a");
    engine.clearAttackState("car-a");
    expect(engine.hijackedBy("car-a")).toBeNull();
    expect(engine.jamState("car-a")).toEqual({ jammedUntil: null, jamReadyAt: null });
    expect(engine.intercepted("car-a")).toEqual([]);
  });
});
