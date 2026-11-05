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
