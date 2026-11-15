import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type AttackConfig, DEFAULT_ATTACK_CONFIG } from "@hijack/protocol";
import { type Harness, type TestClient, connectAs, login, startServer } from "./helpers.ts";

let h: Harness;
let hackerA: TestClient;
let hackerB: TestClient;
let pilotB: TestClient;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  h = await startServer();
  hackerA = await connectAs(h, (await login(h.base, { name: "HA", role: "hacker", carId: "car-a" })).cookie);
  hackerB = await connectAs(h, (await login(h.base, { name: "HB", role: "hacker", carId: "car-b" })).cookie);
  pilotB = await connectAs(h, (await login(h.base, { name: "PB", role: "pilot", carId: "car-b" })).cookie);
  h.server.engine.setDemoState("ready");
  h.server.engine.setDemoState("running");
});

afterEach(async () => {
  for (const c of [hackerA, hackerB, pilotB]) c.close();
  await h.close();
});

async function act(c: TestClient, type: string, payload: unknown) {
  c.clear();
  const id = c.send(type, payload);
  const msg = await Promise.race([
    c.waitFor("action.ok", (m) => m.requestId === id),
    c.waitFor("system.error", (m) => m.requestId === id),
  ]);
  return msg.type === "action.ok" ? { ok: true as const } : { ok: false as const, code: msg.payload.code };
}

async function prepare() {
  expect((await act(hackerA, "attack.scan", {})).ok).toBe(true);
  expect((await act(hackerA, "attack.selectTarget", { targetCarId: "car-b" })).ok).toBe(true);
  expect((await act(hackerA, "attack.exploitDemo", {})).ok).toBe(true);
}

const configure = (c: Partial<AttackConfig>) => act(hackerA, "attack.configure", { ...DEFAULT_ATTACK_CONFIG, ...c });
const attackOf = (c: TestClient) => c.waitFor("state.snapshot", () => true).then((m) => m.payload.state.attacks[0]);
const lastAttack = () =>
  [...hackerA.messages].reverse().find((m) => m.type === "state.snapshot")?.payload.state.attacks[0];
const carB = () => h.server.engine.car("car-b");

describe("sequestro pelo WebSocket", () => {
  test("hacker assume o carrinho e o piloto perde o controle", async () => {
    await prepare();
    expect((await configure({ hijack: true })).ok).toBe(true);
    pilotB.clear();
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    const rejected = await pilotB.waitFor("pilot.commandRejected", () => true);
    expect(rejected.payload.code).toBe("hijacked");
    hackerA.send("attack.drive", { throttle: -1, steering: 40, pressed: true });
    await sleep(30);
    expect(carB().controller.desired).toEqual({ throttle: -1, steering: 40 });
    const pilotView = await pilotB.waitFor("state.snapshot", (m) => !!m.payload.state.cars.find((c) => c.id === "car-b")?.hijacked);
    expect(pilotView.payload.state.cars.find((c) => c.id === "car-b")?.hijacked).toBe(true);
    hackerA.send("attack.driveStop", {});
    await sleep(30);
    expect(carB().controller.moving).toBe(false);
  });

  test("sem o sequestro ligado o joystick do hacker não faz nada", async () => {
    await prepare();
    hackerA.clear();
    hackerA.send("attack.drive", { throttle: 1, steering: 0, pressed: true });
    const rejected = await hackerA.waitFor("pilot.commandRejected", () => true);
    expect(rejected.payload.code).toBe("forbidden");
    expect(carB().controller.moving).toBe(false);
  });

  test("senha forte impede o sequestro e a troca de senha encerra o que estava ativo", async () => {
    await prepare();
    expect((await configure({ hijack: true })).ok).toBe(true);
    expect((await act(hackerB, "auth.changePassword", { currentPassword: "1234", nextPassword: "Carrinho2026" })).ok).toBe(true);
    expect(h.server.engine.hijackedBy("car-b")).toBeNull();
    expect(h.server.service.attacks.config("A").hijack).toBe(false);
    expect(await configure({ hijack: true })).toEqual({ ok: false, code: "forbidden" });
  });

  test("joystick do sequestro a 40 Hz não recebe aviso de limite", async () => {
    await prepare();
    await configure({ hijack: true });
    hackerA.clear();
    for (let i = 0; i < 30; i++) {
      hackerA.send("attack.drive", { throttle: 1, steering: (i % 5) * 5, pressed: true });
      await sleep(25);
    }
    hackerA.send("attack.driveStop", {});
    await sleep(50);
    expect(hackerA.messages.filter((m) => m.type === "system.error" && m.payload.code === "rate_limited")).toHaveLength(0);
    expect(carB().controller.moving).toBe(false);
  });
});

describe("espionagem", () => {
  test("quebra de senha encontra 1234 e falha depois da troca", async () => {
    await prepare();
    expect((await act(hackerA, "attack.crackPassword", {})).ok).toBe(true);
    expect((await attackOf(hackerA))?.crackReport).toContain("1234");
    await act(hackerB, "auth.changePassword", { currentPassword: "1234", nextPassword: "Carrinho2026" });
    expect((await act(hackerA, "attack.crackPassword", {})).ok).toBe(true);
    const report = (await attackOf(hackerA))?.crackReport ?? "";
    expect(report).toContain("nenhuma serviu");
    expect(report).not.toContain("Carrinho2026");
  });

  test("interceptação mostra o tráfego e a criptografia embaralha", async () => {
    await prepare();
    await configure({ intercept: true });
    pilotB.send("pilot.drive", { throttle: 1, steering: -20, pressed: true });
    await sleep(120);
    hackerA.clear();
    hackerA.send("session.resume", {});
    await sleep(120);
    const plain = lastAttack()?.intercepted ?? [];
    expect(plain.some((e) => !e.encrypted && e.text.startsWith("pilot.drive"))).toBe(true);
    expect((await act(hackerB, "defense.setEncryptionDemo", { enabled: true })).ok).toBe(true);
    await sleep(120);
    const hidden = lastAttack()?.intercepted ?? [];
    expect(hidden.length).toBeGreaterThan(0);
    expect(hidden.every((e) => e.encrypted && !e.text.includes("pilot.drive"))).toBe(true);
  });

  test("defesa de criptografia conta como 4ª camada", async () => {
    await act(hackerB, "defense.setEncryptionDemo", { enabled: true });
    const snap = await hackerB.waitFor("state.snapshot", (m) => m.payload.state.defenses[0]?.encryptionDemoEnabled === true);
    expect(snap.payload.state.defenses[0]?.level).toBe(1);
  });
});

describe("derrubar o link pelo WebSocket", () => {
  test("piloto recebe link_jammed e não dá para repetir na hora", async () => {
    await prepare();
    expect((await act(hackerA, "attack.jamLink", {})).ok).toBe(true);
    pilotB.clear();
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    expect((await pilotB.waitFor("pilot.commandRejected", () => true)).payload.code).toBe("link_jammed");
    expect(await act(hackerA, "attack.jamLink", {})).toEqual({ ok: false, code: "forbidden" });
    expect((await attackOf(hackerA))?.jammedUntil).not.toBeNull();
  });

  test("antes da exploração não dá para derrubar", async () => {
    await act(hackerA, "attack.scan", {});
    expect(await act(hackerA, "attack.jamLink", {})).toEqual({ ok: false, code: "attack_step_invalid" });
  });
});

describe("correções da revisão", () => {
  test("queda da conexão do sequestrador para o carrinho na hora", async () => {
    await prepare();
    await configure({ hijack: true });
    hackerA.send("attack.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(carB().controller.moving).toBe(true);
    hackerA.close();
    await sleep(60);
    expect(carB().controller.moving).toBe(false);
    expect(carB().controller.stopReason).toBe("hijack-release");
  });

  test("mudar o atraso descarta comandos atrasados antigos", async () => {
    await prepare();
    await configure({ delayMs: 300 });
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    await configure({ delayMs: 0 });
    pilotB.send("pilot.drive", { throttle: -1, steering: 0, pressed: true });
    await sleep(400);
    expect(carB().controller.desired).toEqual({ throttle: -1, steering: 0 });
  });

  test("religar a trava pelo WebSocket guarda a direção nova", async () => {
    await prepare();
    await configure({ lockSteering: true });
    pilotB.send("pilot.drive", { throttle: 1, steering: -80, pressed: true });
    await sleep(30);
    await configure({ lockSteering: false, dropPct: 30 });
    await configure({ lockSteering: true });
    pilotB.send("pilot.drive", { throttle: 1, steering: 30, pressed: true });
    await sleep(80);
    expect(carB().controller.desired).toEqual({ throttle: 1, steering: 30 });
  });

  test("desativar não zera o intervalo entre quedas do link", async () => {
    await prepare();
    expect((await act(hackerA, "attack.jamLink", {})).ok).toBe(true);
    expect((await act(hackerA, "attack.disable", {})).ok).toBe(true);
    expect(await act(hackerA, "attack.jamLink", {})).toEqual({ ok: false, code: "forbidden" });
  });

  test("com a telemetria falsa o defensor não vê as mudanças do ataque no registro", async () => {
    await prepare();
    await configure({ spoofTelemetry: true });
    await configure({ spoofTelemetry: true, invertThrottle: true });
    await sleep(120);
    const view = (v: Parameters<typeof h.server.engine.snapshot>[0]) =>
      h.server.engine.snapshot(v).events.some((e) => e.message.includes("Inversão ativa"));
    expect(view({ role: "hacker", displayName: "HB", teamId: "B", carId: "car-b" })).toBe(false);
    expect(view({ role: "hacker", displayName: "HA", teamId: "A", carId: "car-a" })).toBe(true);
    expect(view({ role: "admin" })).toBe(true);
  });
});

describe("desativar", () => {
  test("desativar o ataque encerra sequestro e queda", async () => {
    await prepare();
    await configure({ hijack: true });
    await act(hackerA, "attack.jamLink", {});
    expect((await act(hackerA, "attack.disable", {})).ok).toBe(true);
    expect(h.server.engine.hijackedBy("car-b")).toBeNull();
    expect(h.server.engine.jamState("car-b").jammedUntil).toBeNull();
  });
});
