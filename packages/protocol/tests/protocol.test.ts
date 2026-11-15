import { describe, expect, test } from "bun:test";
import {
  CLIENT_MESSAGE_TYPES,
  DEFAULT_ATTACK_CONFIG,
  DEVICE_MESSAGE_TYPES,
  MAX_MESSAGE_BYTES,
  clientMessageSchema,
  deviceToServerSchema,
  loginRequestSchema,
  parseMessage,
  serverToDeviceSchema,
} from "../src/index.ts";

const uuid = "8f14e45f-ceea-4e7a-9b1d-3c2a1b0e9d77";

const drive = (payload: unknown, extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    protocolVersion: 1,
    type: "pilot.drive",
    requestId: uuid,
    sentAt: 1,
    payload,
    ...extra,
  });

const parseClient = (raw: string) => parseMessage(clientMessageSchema, raw, CLIENT_MESSAGE_TYPES);

describe("mensagens do cliente", () => {
  test("aceita pilot.drive válido", () => {
    const r = parseClient(drive({ throttle: 1, steering: -100, pressed: true }));
    expect(r.ok).toBe(true);
  });

  test.each([2, -2, 0.5, "1", null])("rejeita tração fora de -1/0/1: %p", (value) => {
    const r = parseClient(drive({ throttle: value, steering: 0, pressed: true }));
    expect(r).toMatchObject({ ok: false, code: "invalid_payload" });
  });

  test.each([-100, -55, 0, 5, 60, 100])("aceita direção proporcional inteira: %p", (value) => {
    const r = parseClient(drive({ throttle: 0, steering: value, pressed: true }));
    expect(r.ok).toBe(true);
  });

  test.each([101, -101, 200, 0.5, "10", null])("rejeita direção fora de -100..100 ou não inteira: %p", (value) => {
    const r = parseClient(drive({ throttle: 1, steering: value, pressed: true }));
    expect(r).toMatchObject({ ok: false, code: "invalid_payload" });
  });

  test("admin.setTopology aceita single e dual e rejeita outros valores", () => {
    const msg = (topology: unknown) =>
      JSON.stringify({ protocolVersion: 1, type: "admin.setTopology", requestId: uuid, sentAt: 1, payload: { topology } });
    expect(parseClient(msg("single")).ok).toBe(true);
    expect(parseClient(msg("dual")).ok).toBe(true);
    expect(parseClient(msg("triple"))).toMatchObject({ ok: false, code: "invalid_payload" });
  });

  test("rejeita campo obrigatório ausente", () => {
    const r = parseClient(drive({ throttle: 1, pressed: true }));
    expect(r).toMatchObject({ ok: false, code: "invalid_payload" });
  });

  test("rejeita campos extras (ex.: tentativa de informar time/papel)", () => {
    const r = parseClient(drive({ throttle: 1, steering: 0, pressed: true, teamId: "B" }));
    expect(r).toMatchObject({ ok: false, code: "invalid_payload" });
    const r2 = parseClient(drive({ throttle: 1, steering: 0, pressed: true }, { role: "admin" }));
    expect(r2).toMatchObject({ ok: false, code: "invalid_payload" });
  });

  test("rejeita tipo desconhecido", () => {
    const raw = JSON.stringify({
      protocolVersion: 1,
      type: "network.realScan",
      requestId: uuid,
      sentAt: 1,
      payload: {},
    });
    expect(parseClient(raw)).toMatchObject({ ok: false, code: "unknown_type" });
  });

  test("rejeita versão incompatível", () => {
    const r = parseClient(drive({ throttle: 0, steering: 0, pressed: false }, { protocolVersion: 2 }));
    expect(r).toMatchObject({ ok: false, code: "unsupported_version" });
  });

  test("rejeita JSON inválido e não-objeto", () => {
    expect(parseClient("{")).toMatchObject({ ok: false, code: "bad_request" });
    expect(parseClient("[]")).toMatchObject({ ok: false, code: "bad_request" });
  });

  test("rejeita mensagem maior que o limite", () => {
    const big = drive({ throttle: 0, steering: 0, pressed: false }, { pad: "x".repeat(MAX_MESSAGE_BYTES) });
    expect(parseClient(big)).toMatchObject({ ok: false, code: "message_too_large" });
  });

  test("requestId precisa ser UUID", () => {
    const r = parseClient(drive({ throttle: 0, steering: 0, pressed: false }, { requestId: "abc" }));
    expect(r).toMatchObject({ ok: false, code: "invalid_payload" });
  });
});

describe("ataques novos", () => {
  const msg = (type: string, payload: unknown) =>
    JSON.stringify({ protocolVersion: 1, type, requestId: uuid, sentAt: 1, payload });
  const configure = (extra: Record<string, unknown>) =>
    parseClient(msg("attack.configure", { ...DEFAULT_ATTACK_CONFIG, ...extra }));

  test("attack.configure aceita a configuração padrão e cada ataque", () => {
    expect(configure({}).ok).toBe(true);
    expect(configure({ steeringBias: -40, lockSteering: true, delayMs: 300, dropPct: 60 }).ok).toBe(true);
    expect(configure({ replay: true, intercept: true, spoofTelemetry: true, hijack: true }).ok).toBe(true);
  });

  test.each([
    { steeringBias: 45 },
    { steeringBias: -45 },
    { steeringBias: 7 },
    { delayMs: 200 },
    { delayMs: 1000 },
    { dropPct: 100 },
    { dropPct: 10 },
  ])("attack.configure rejeita valor fora das opções: %p", (extra) => {
    expect(configure(extra)).toMatchObject({ ok: false, code: "invalid_payload" });
  });

  test("attack.configure exige todos os campos e recusa extras", () => {
    expect(parseClient(msg("attack.configure", { invertThrottle: true, invertSteering: false }))).toMatchObject({
      ok: false,
      code: "invalid_payload",
    });
    expect(configure({ targetCarId: "car-b" })).toMatchObject({ ok: false, code: "invalid_payload" });
  });

  test("attack.drive segue as faixas do piloto", () => {
    expect(parseClient(msg("attack.drive", { throttle: 1, steering: -60, pressed: true })).ok).toBe(true);
    expect(parseClient(msg("attack.drive", { throttle: 2, steering: 0, pressed: true }))).toMatchObject({
      ok: false,
      code: "invalid_payload",
    });
  });

  test("mensagens vazias e a defesa de criptografia", () => {
    for (const type of ["attack.crackPassword", "attack.jamLink", "attack.driveStop"]) {
      expect(parseClient(msg(type, {})).ok).toBe(true);
      expect(parseClient(msg(type, { carId: "car-a" }))).toMatchObject({ ok: false, code: "invalid_payload" });
    }
    expect(parseClient(msg("defense.setEncryptionDemo", { enabled: true })).ok).toBe(true);
  });
});

describe("login", () => {
  test("aceita login de piloto", () => {
    const r = loginRequestSchema.safeParse({ name: "Ana", role: "pilot", carId: "car-a", password: "1234" });
    expect(r.success).toBe(true);
  });

  test("não aceita papel admin no login de participante", () => {
    const r = loginRequestSchema.safeParse({ name: "Ana", role: "admin", carId: "car-a", password: "1234" });
    expect(r.success).toBe(false);
  });

  test("rejeita nome com marcação HTML ou vazio", () => {
    expect(loginRequestSchema.safeParse({ name: "<b>x</b>", role: "pilot", carId: "car-a", password: "1" }).success).toBe(false);
    expect(loginRequestSchema.safeParse({ name: "   ", role: "pilot", carId: "car-a", password: "1" }).success).toBe(false);
  });
});

describe("protocolo do dispositivo", () => {
  test("device.drive exige velocidade fixa e seq positivo", () => {
    const ok = serverToDeviceSchema.safeParse({
      protocolVersion: 1,
      type: "device.drive",
      requestId: uuid,
      seq: 42,
      payload: { throttle: 1, steering: -60, speedMode: "fixed", commandTtlMs: 400 },
    });
    expect(ok.success).toBe(true);
    const bad = serverToDeviceSchema.safeParse({
      protocolVersion: 1,
      type: "device.drive",
      requestId: uuid,
      seq: 0,
      payload: { throttle: 1, steering: -60, speedMode: "pwm", commandTtlMs: 400 },
    });
    expect(bad.success).toBe(false);
  });

  test("device.drive rejeita direção acima de 100", () => {
    const bad = serverToDeviceSchema.safeParse({
      protocolVersion: 1,
      type: "device.drive",
      requestId: uuid,
      seq: 1,
      payload: { throttle: 1, steering: 150, speedMode: "fixed", commandTtlMs: 400 },
    });
    expect(bad.success).toBe(false);
  });

  test("device.ack e device.telemetry levam direção proporcional", () => {
    const ack = JSON.stringify({ protocolVersion: 1, type: "device.ack", payload: { seq: 3, throttle: 1, steering: 45 } });
    expect(parseMessage(deviceToServerSchema, ack, DEVICE_MESSAGE_TYPES).ok).toBe(true);
    const badAck = JSON.stringify({ protocolVersion: 1, type: "device.ack", payload: { seq: 3, throttle: 1, steering: -101 } });
    expect(parseMessage(deviceToServerSchema, badAck, DEVICE_MESSAGE_TYPES)).toMatchObject({ ok: false, code: "invalid_payload" });
  });

  test("device.hello é reconhecido", () => {
    const raw = JSON.stringify({
      protocolVersion: 1,
      type: "device.hello",
      payload: { deviceId: "car-a", secret: "s3cr3t", firmwareVersion: "0.1.0" },
    });
    expect(parseMessage(deviceToServerSchema, raw, DEVICE_MESSAGE_TYPES).ok).toBe(true);
  });
});
