import { describe, expect, test } from "bun:test";
import type { CarView } from "@hijack/protocol";
import { pilotStatus } from "./pilot-status.ts";

const car = (over: Partial<CarView> = {}): CarView => ({
  id: "car-a",
  teamId: "A",
  displayName: "Carrinho A",
  mode: "simulated",
  active: true,
  requested: { throttle: 0, steering: 0 },
  desired: { throttle: 0, steering: 0 },
  confirmed: { throttle: 0, steering: 0 },
  moving: false,
  stopReason: null,
  telemetry: { online: true, lastSeenAt: null, uptimeMs: null, rssi: null, reconnects: 0, rejectedCommands: 0, lastSeq: 0, watchdogTrips: 0 },
  sim: null,
  ...over,
});

describe("pilotStatus", () => {
  test("sem conexão tem prioridade", () => {
    expect(pilotStatus("closed", "running", car())).toMatchObject({ label: "Sem conexão", canDrive: false });
  });
  test("aguardando largada em ready", () => {
    expect(pilotStatus("open", "ready", car())).toMatchObject({ label: "Aguardando a largada…", canDrive: false });
  });
  test("em demonstração permite dirigir", () => {
    expect(pilotStatus("open", "running", car())).toMatchObject({ label: "Em demonstração", canDrive: true });
  });
  test("parada de segurança após watchdog", () => {
    expect(pilotStatus("open", "running", car({ stopReason: "watchdog" }))).toMatchObject({ label: "Parada de segurança" });
  });
  test("sessão revogada deixa a tela sem carro e sem poder dirigir, mesmo em running", () => {
    expect(pilotStatus("open", "running", undefined)).toMatchObject({ label: "Carregando…", canDrive: false });
  });
  test("pausado não dirige", () => {
    expect(pilotStatus("open", "paused", car())).toMatchObject({ label: "Pausado", canDrive: false });
  });
  test("carrinho desativado pela topologia não dirige", () => {
    expect(pilotStatus("open", "running", car({ active: false }))).toMatchObject({
      label: "Carrinho desativado nesta demonstração",
      canDrive: false,
    });
  });
  test("carrinho offline", () => {
    const offline = car({ telemetry: { ...car().telemetry, online: false } });
    expect(pilotStatus("open", "running", offline)).toMatchObject({ label: "Carrinho desconectado", canDrive: false });
  });
});
