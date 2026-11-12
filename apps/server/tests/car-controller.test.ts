import { describe, expect, test } from "bun:test";
import type { DriveVector, StopReason } from "@hijack/protocol";
import { CarController } from "../src/control/car-controller.ts";
import type { DeviceAdapter, DeviceDriveCommand } from "../src/devices/types.ts";
import { systemClock } from "../src/devices/types.ts";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function fakeAdapter() {
  const drives: DeviceDriveCommand[] = [];
  const stops: { reason: string; seq: number }[] = [];
  const adapter: DeviceAdapter = {
    carId: "car-a",
    mode: "simulated",
    isOnline: () => true,
    drive: (c) => drives.push(c),
    stop: (reason, seq) => stops.push({ reason, seq }),
    pose: () => null,
    onEvent: () => () => {},
    dispose: () => {},
  };
  return { adapter, drives, stops };
}

function make(ttlMs = 300, rate = 20) {
  const f = fakeAdapter();
  const stopped: StopReason[] = [];
  const ctl = new CarController("car-a", f.adapter, { ttlMs, maxCommandsPerSecond: rate, clock: systemClock }, {
    onSent: () => {},
    onStopped: (r) => stopped.push(r),
    onChange: () => {},
  });
  return { ...f, ctl, stopped };
}

const v = (throttle: -1 | 0 | 1, steering: -1 | 0 | 1): DriveVector => ({ throttle, steering });

function makeWithClock() {
  const f = fakeAdapter();
  const time = { value: 1_000_000 };
  const clock = { now: () => time.value };
  const ctl = new CarController("car-a", f.adapter, { ttlMs: 300, maxCommandsPerSecond: 20, clock }, {
    onSent: () => {},
    onStopped: () => {},
    onChange: () => {},
  });
  return { ...f, ctl, time };
}

describe("CarController: paradas repetidas", () => {
  test("com o carro parado, paradas em rajada geram um único stop para o dispositivo", () => {
    const { ctl, stops } = makeWithClock();
    ctl.command(v(1, 0));
    for (let i = 0; i < 50; i++) ctl.stop("pilot-release");
    expect(stops).toHaveLength(1);
  });

  test("passado o intervalo mínimo, uma nova parada volta a ser enviada", () => {
    const { ctl, stops, time } = makeWithClock();
    ctl.command(v(1, 0));
    ctl.stop("pilot-release");
    time.value += 60;
    ctl.stop("pilot-release");
    expect(stops).toHaveLength(2);
  });

  test("parada com o carro andando nunca é suprimida", () => {
    const { ctl, stops } = makeWithClock();
    ctl.command(v(1, 0));
    ctl.stop("pilot-release");
    ctl.command(v(1, 0));
    ctl.stop("admin-stop-all");
    expect(stops.map((s) => s.reason)).toEqual(["pilot-release", "admin-stop-all"]);
  });

  test("a primeira parada de um carro que nunca andou é enviada", () => {
    const { ctl, stops } = makeWithClock();
    ctl.stop("admin-stop-all");
    expect(stops).toHaveLength(1);
  });

  test("STOP ALL grava o motivo mesmo com o carro já parado por outro motivo", () => {
    const { ctl, time } = makeWithClock();
    ctl.command(v(1, 0));
    ctl.stop("watchdog");
    time.value += 60;
    ctl.stop("admin-stop-all", true);
    expect(ctl.stopReason).toBe("admin-stop-all");
  });

  test("sem pedir para gravar o motivo, um carro já parado mantém o motivo anterior", () => {
    const { ctl, time } = makeWithClock();
    ctl.command(v(1, 0));
    ctl.stop("watchdog");
    time.value += 60;
    ctl.stop("admin-stop-all");
    expect(ctl.stopReason).toBe("watchdog");
  });

  test("a janela de stops lembrados é maior que 32", () => {
    const { ctl, stops, time } = makeWithClock();
    ctl.command(v(1, 0));
    ctl.stop("pilot-release");
    const first = stops[0]?.seq ?? 0;
    for (let i = 0; i < 100; i++) {
      time.value += 60;
      ctl.stop("pilot-release");
    }
    expect(ctl.isStopSeq(first)).toBe(true);
  });

  test("lembra os seq dos stops enviados e esquece os mais antigos", () => {
    const { ctl, stops, time } = makeWithClock();
    ctl.command(v(1, 0));
    ctl.stop("pilot-release");
    const first = stops[0]?.seq ?? 0;
    expect(ctl.isStopSeq(first)).toBe(true);
    expect(ctl.isStopSeq(first + 1000)).toBe(false);
    for (let i = 0; i < 300; i++) {
      time.value += 60;
      ctl.stop("pilot-release");
    }
    expect(ctl.isStopSeq(first)).toBe(false);
    expect(ctl.isStopSeq(stops.at(-1)?.seq ?? 0)).toBe(true);
  });

  test("trocar o adaptador libera o próximo stop mesmo dentro do intervalo", () => {
    const { ctl, stops } = makeWithClock();
    ctl.command(v(1, 0));
    ctl.stop("pilot-release");
    const second = fakeAdapter();
    ctl.replaceAdapter(second.adapter);
    ctl.stop("admin-stop-all");
    expect(stops).toHaveLength(1);
    expect(second.stops.length).toBeGreaterThanOrEqual(1);
  });
});

describe("CarController", () => {
  test("coalesce rajadas: no máximo um envio pendente, com o último estado", async () => {
    const { ctl, drives } = make(300, 20);
    ctl.command(v(1, 0));
    ctl.command(v(1, 1));
    ctl.command(v(1, -1));
    ctl.command(v(-1, -1));
    expect(drives).toHaveLength(1);
    await sleep(70);
    expect(drives).toHaveLength(2);
    expect(drives[1]).toMatchObject({ throttle: -1, steering: -1 });
    ctl.dispose();
  });

  test("seq é estritamente crescente, inclusive no STOP", () => {
    const { ctl, drives, stops } = make();
    ctl.command(v(1, 0));
    ctl.stop("pilot-stop");
    expect(stops[0]?.seq).toBeGreaterThan(drives[0]?.seq ?? Infinity);
  });

  test("STOP descarta envio pendente e tem prioridade", async () => {
    const { ctl, drives, stops } = make(300, 20);
    ctl.command(v(1, 0));
    ctl.command(v(1, 1));
    ctl.stop("admin-stop-all");
    await sleep(80);
    expect(drives).toHaveLength(1);
    expect(stops).toHaveLength(1);
    expect(ctl.moving).toBe(false);
  });

  test("comando neutro vira STOP", () => {
    const { ctl, stops } = make();
    ctl.command(v(1, 0));
    ctl.command(v(0, 0));
    expect(stops.at(-1)?.reason).toBe("pilot-release");
  });

  test("watchdog do servidor para sem comando recente", async () => {
    const { ctl, stopped } = make(50);
    ctl.command(v(1, 0));
    await sleep(80);
    ctl.checkWatchdog();
    expect(stopped).toContain("watchdog");
    expect(ctl.moving).toBe(false);
  });
});
