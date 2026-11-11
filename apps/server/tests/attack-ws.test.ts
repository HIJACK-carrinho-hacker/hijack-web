import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { type Harness, type TestClient, adminLogin, connectAs, login, startServer } from "./helpers.ts";

let h: Harness;
let hackerA: TestClient;
let hackerB: TestClient;
let pilotA: TestClient;
let pilotB: TestClient;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

beforeEach(async () => {
  h = await startServer();
  hackerA = await connectAs(h, (await login(h.base, { name: "HA", role: "hacker", carId: "car-a" })).cookie);
  hackerB = await connectAs(h, (await login(h.base, { name: "HB", role: "hacker", carId: "car-b" })).cookie);
  pilotA = await connectAs(h, (await login(h.base, { name: "PA", role: "pilot", carId: "car-a" })).cookie);
  pilotB = await connectAs(h, (await login(h.base, { name: "PB", role: "pilot", carId: "car-b" })).cookie);
});

afterEach(async () => {
  for (const c of [hackerA, hackerB, pilotA, pilotB]) c.close();
  await h.close();
});

const run = () => {
  h.server.engine.setDemoState("ready");
  h.server.engine.setDemoState("running");
};

async function act(c: TestClient, type: string, payload: unknown) {
  c.clear();
  const id = c.send(type, payload);
  const msg = await Promise.race([
    c.waitFor("action.ok", (m) => m.requestId === id),
    c.waitFor("system.error", (m) => m.requestId === id),
  ]);
  return msg.type === "action.ok" ? { ok: true as const } : { ok: false as const, code: msg.payload.code };
}

async function fullAttack(c: TestClient, target: "car-a" | "car-b", invertThrottle: boolean, invertSteering: boolean) {
  expect((await act(c, "attack.scan", {})).ok).toBe(true);
  expect((await act(c, "attack.selectTarget", { targetCarId: target })).ok).toBe(true);
  expect((await act(c, "attack.exploitDemo", {})).ok).toBe(true);
  expect((await act(c, "attack.configure", { invertThrottle, invertSteering })).ok).toBe(true);
}

const confirmed = (carId: "car-a" | "car-b") => {
  const car = h.server.engine.snapshot({ role: "admin" }).cars.find((c) => c.id === carId);
  return car?.confirmed;
};

describe("ciclo de vida do ataque", () => {
  test("encerrar e iniciar nova largada zera o ataque", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    const admin = await connectAs(h, (await adminLogin(h.base)).cookie);
    for (const state of ["stopped", "ready", "running"]) {
      expect((await act(admin, "admin.setDemoState", { state })).ok).toBe(true);
    }
    admin.close();
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: 1, steering: 0 });
  });

  test("hacker que perde a vaga deixa o ataque desativado", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    const admin = await connectAs(h, (await adminLogin(h.base)).cookie);
    expect((await act(admin, "admin.releaseSlot", { carId: "car-a", role: "hacker" })).ok).toBe(true);
    admin.close();
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: 1, steering: 0 });
  });

  test("hacker cuja sessão expira deixa o ataque desativado", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    for (const s of h.server.service.sessions.all()) {
      if (s.kind === "participant" && s.role === "hacker") s.expiresAt = 0;
    }
    (h.server.service as unknown as { sweep(): void }).sweep();
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: 1, steering: 0 });
  });

  test("hacker que sai pelo logout deixa o ataque desativado", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    hackerA.send("session.logout", {});
    await sleep(30);
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: 1, steering: 0 });
  });
});

describe("ataque guiado", () => {
  test("bloqueado fora de RUNNING", async () => {
    expect(await act(hackerA, "attack.scan", {})).toEqual({ ok: false, code: "demo_not_running" });
  });

  test("não pula etapas nem escolhe o próprio carrinho", async () => {
    run();
    expect(await act(hackerA, "attack.exploitDemo", {})).toEqual({ ok: false, code: "attack_step_invalid" });
    await act(hackerA, "attack.scan", {});
    expect(await act(hackerA, "attack.selectTarget", { targetCarId: "car-a" })).toEqual({ ok: false, code: "forbidden" });
  });

  test("piloto não consegue atacar", async () => {
    run();
    expect(await act(pilotA, "attack.scan", {})).toEqual({ ok: false, code: "forbidden" });
  });

  test("hacker A inverte os dois eixos do carrinho B; carrinho A segue normal", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, true);
    pilotB.send("pilot.drive", { throttle: 1, steering: -100, pressed: true });
    pilotA.send("pilot.drive", { throttle: 1, steering: -100, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: -1, steering: 100 });
    expect(confirmed("car-a")).toEqual({ throttle: 1, steering: -100 });
  });

  test("inversões são independentes", async () => {
    run();
    await fullAttack(hackerB, "car-a", false, true);
    pilotA.send("pilot.drive", { throttle: 1, steering: -100, pressed: true });
    await sleep(30);
    expect(confirmed("car-a")).toEqual({ throttle: 1, steering: 100 });
    expect(await act(hackerB, "attack.configure", { invertThrottle: true, invertSteering: false })).toEqual({ ok: true });
    pilotA.send("pilot.drive", { throttle: 1, steering: -100, pressed: true });
    await sleep(70);
    expect(confirmed("car-a")).toEqual({ throttle: -1, steering: -100 });
  });

  test("ataque não move carrinho parado e STOP não é invertido", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, true);
    await sleep(30);
    expect(h.server.engine.car("car-b").controller.moving).toBe(false);
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    pilotB.send("pilot.stop", { reason: "release" });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: 0, steering: 0 });
    expect(h.server.engine.car("car-b").controller.moving).toBe(false);
  });

  test("desativar volta ao normal", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    expect((await act(hackerA, "attack.disable", {})).ok).toBe(true);
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: 1, steering: 0 });
  });

  test("piloto não vê a transformação nem eventos de ataque", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, true);
    pilotB.clear();
    pilotB.send("pilot.drive", { throttle: 1, steering: -100, pressed: true });
    const snap = await pilotB.waitFor("state.snapshot", (m) => m.payload.state.cars.some((c) => c.id === "car-b" && c.moving));
    const car = snap.payload.state.cars.find((c) => c.id === "car-b");
    expect(car?.desired).toEqual({ throttle: 0, steering: 0 });
    expect(car?.confirmed).toEqual({ throttle: 0, steering: 0 });
    expect(snap.payload.state.attacks).toEqual([]);
    expect(snap.payload.state.events.some((e) => e.kind.startsWith("attack"))).toBe(false);
  });

  test("hacker vê só o próprio ataque; evento de comando alterado aparece para hackers", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    const snap = await hackerB.waitFor("state.snapshot", (m) =>
      m.payload.state.events.some((e) => e.kind === "attack.transformed"),
    );
    expect(snap.payload.state.attacks.map((a) => a.attackerTeam)).toEqual(["B"]);
    const ev = snap.payload.state.events.find((e) => e.kind === "attack.transformed");
    expect(ev?.message).toBe("Comando alterado: frente → ré");
  });

  test("pausar preserva o progresso e bloqueia novas ações", async () => {
    run();
    await act(hackerA, "attack.scan", {});
    await act(hackerA, "attack.selectTarget", { targetCarId: "car-b" });
    h.server.engine.setDemoState("paused");
    expect(await act(hackerA, "attack.exploitDemo", {})).toEqual({ ok: false, code: "demo_not_running" });
    h.server.engine.setDemoState("running");
    expect((await act(hackerA, "attack.exploitDemo", {})).ok).toBe(true);
  });
});

describe("defesa didática", () => {
  test("integridade bloqueia a inversão sem bloquear o piloto", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, true);
    expect((await act(hackerB, "defense.setIntegrityDemo", { enabled: true })).ok).toBe(true);
    pilotB.send("pilot.drive", { throttle: 1, steering: -100, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: 1, steering: -100 });
    const m = h.server.engine.snapshot({ role: "admin" }).metrics.find((x) => x.carId === "car-b");
    expect(m?.blocked).toBeGreaterThan(0);
    expect(m?.transformed).toBe(0);
    const ev = h.server.engine.snapshot({ role: "admin" }).events.find((e) => e.kind === "defense.blocked");
    expect(ev?.message).toContain("bloqueada");
  });

  test("desligar a integridade volta a permitir a inversão", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    await act(hackerB, "defense.setIntegrityDemo", { enabled: true });
    await act(hackerB, "defense.setIntegrityDemo", { enabled: false });
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: -1, steering: 0 });
  });

  test("defesa só vale para o próprio carrinho", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    await act(hackerA, "defense.setIntegrityDemo", { enabled: true });
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(confirmed("car-b")).toEqual({ throttle: -1, steering: 0 });
  });

  test("repetição gera evento didático e não move o carrinho", async () => {
    run();
    expect((await act(hackerB, "defense.setReplayDemo", { enabled: true })).ok).toBe(true);
    await sleep(30);
    expect(h.server.engine.car("car-b").controller.moving).toBe(false);
    expect(confirmed("car-b")).toEqual({ throttle: 0, steering: 0 });
    const ev = h.server.engine.snapshot({ role: "admin" }).events.find((e) => e.kind === "defense.replay");
    expect(ev?.message).toContain("recusado");
    expect(ev?.message).toContain("Nenhum movimento");
  });

  test("indicador conta as camadas demonstradas", async () => {
    await act(hackerB, "defense.setIntegrityDemo", { enabled: true });
    await act(hackerB, "defense.setReplayDemo", { enabled: true });
    await act(hackerB, "auth.changePassword", { currentPassword: "1234", nextPassword: "Carrinho2026" });
    const snap = await hackerB.waitFor("state.snapshot", (m) => m.payload.state.defenses[0]?.level === 3);
    expect(snap.payload.state.defenses).toEqual([
      { carId: "car-b", strongPasswordEnabled: true, integrityDemoEnabled: true, replayDemoEnabled: true, level: 3 },
    ]);
  });

  test("piloto não pode ligar defesa", async () => {
    expect(await act(pilotB, "defense.setIntegrityDemo", { enabled: true })).toEqual({ ok: false, code: "forbidden" });
  });

  test("reset do operador desliga defesas didáticas e ataques", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    await act(hackerB, "defense.setIntegrityDemo", { enabled: true });
    h.server.engine.setDemoState("paused");
    const admin = await connectAs(h, (await adminLogin(h.base)).cookie);
    expect((await act(admin, "admin.resetDemo", { resetAttacks: true, resetDefenses: true, resetPasswords: false })).ok).toBe(true);
    expect(h.server.service.defenses.integrity("car-b")).toBe(false);
    expect(h.server.service.attacks.view("A").step).toBe("locked");
    admin.close();
  });
});

describe("solicitado × confirmado", () => {
  test("espectador vê o pedido do piloto e o executado", async () => {
    run();
    await fullAttack(hackerA, "car-b", true, false);
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    const car = h.server.engine.snapshot({ role: "spectator" }).cars.find((c) => c.id === "car-b");
    expect(car?.requested).toEqual({ throttle: 1, steering: 0 });
    expect(car?.confirmed).toEqual({ throttle: -1, steering: 0 });
    const pilotView = h.server.engine.snapshot({ role: "pilot", displayName: "PB", teamId: "B", carId: "car-b" });
    expect(pilotView.cars.find((c) => c.id === "car-b")?.requested).toEqual({ throttle: 0, steering: 0 });
  });
});
