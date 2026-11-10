import { afterEach, describe, expect, test } from "bun:test";
import { loadConfig } from "../src/config/env.ts";
import { type Harness, type TestClient, adminLogin, connectAs, login, startServer } from "./helpers.ts";

let h: Harness;
const clients: TestClient[] = [];

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

afterEach(async () => {
  for (const c of clients.splice(0)) c.close();
  await (h as Harness | undefined)?.close();
  h = undefined as unknown as Harness;
});

async function as(input: Parameters<typeof login>[1]) {
  const r = await login(h.base, input);
  expect(r.status).toBe(200);
  const c = await connectAs(h, r.cookie);
  clients.push(c);
  return c;
}

async function act(c: TestClient, type: string, payload: unknown) {
  c.clear();
  const id = c.send(type, payload);
  const msg = await Promise.race([
    c.waitFor("action.ok", (m) => m.requestId === id),
    c.waitFor("system.error", (m) => m.requestId === id),
  ]);
  return msg.type === "action.ok" ? { ok: true as const } : { ok: false as const, code: msg.payload.code, message: msg.payload.message };
}

const run = () => {
  h.server.engine.setDemoState("ready");
  h.server.engine.setDemoState("running");
};

const confirmed = (carId: "car-a" | "car-b") =>
  h.server.engine.snapshot({ role: "admin" }).cars.find((c) => c.id === carId)?.confirmed;

describe("configuração", () => {
  test("padrão é 1 carrinho; COMMAND_TTL_MS padrão é 400", () => {
    const cfg = loadConfig({});
    expect(cfg.DEMO_TOPOLOGY).toBe("single");
    expect(cfg.COMMAND_TTL_MS).toBe(400);
    expect(() => loadConfig({ DEMO_TOPOLOGY: "triple" })).toThrow("DEMO_TOPOLOGY");
  });
});

describe("topologia de 1 carrinho", () => {
  test("informação pública marca só o carrinho A como ativo", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "single" });
    const info = (await (await fetch(`${h.base}/api/public`)).json()) as {
      topology: string;
      cars: { id: string; active: boolean }[];
    };
    expect(info.topology).toBe("single");
    expect(info.cars.map((c) => [c.id, c.active])).toEqual([
      ["car-a", true],
      ["car-b", false],
    ]);
    const snap = h.server.engine.snapshot({ role: "spectator" });
    expect(snap.topology).toBe("single");
    expect(snap.cars.map((c) => c.active)).toEqual([true, false]);
  });

  test("não há vaga de piloto para o carrinho B; hacker B entra com a senha da equipe B", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "single" });
    expect((await login(h.base, { role: "pilot", carId: "car-b" })).status).toBe(403);
    expect((await login(h.base, { role: "hacker", carId: "car-b" })).status).toBe(200);
    expect((await login(h.base, { role: "pilot", carId: "car-a" })).status).toBe(200);
  });

  test("equipe A defende: ataque recusado com mensagem clara", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "single" });
    const hackerA = await as({ name: "HA", role: "hacker", carId: "car-a" });
    run();
    const r = await act(hackerA, "attack.scan", {});
    expect(r).toMatchObject({ ok: false, code: "forbidden" });
    expect(r.ok ? "" : r.message).toContain("equipe A defende");
    expect(h.server.engine.snapshot({ role: "hacker", displayName: "HA", teamId: "A", carId: "car-a" }).attacks).toEqual([]);
  });

  test("equipe B só ataca: defesa e troca de senha recusadas", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "single" });
    const hackerB = await as({ name: "HB", role: "hacker", carId: "car-b" });
    expect(await act(hackerB, "defense.setIntegrityDemo", { enabled: true })).toMatchObject({ ok: false, code: "forbidden" });
    expect(await act(hackerB, "defense.setReplayDemo", { enabled: true })).toMatchObject({ ok: false, code: "forbidden" });
    expect(
      await act(hackerB, "auth.changePassword", { currentPassword: "1234", nextPassword: "Carrinho2026" }),
    ).toMatchObject({ ok: false, code: "forbidden" });
    const snap = await hackerB.waitFor("state.snapshot");
    expect(snap.payload.state.defenses).toEqual([]);
  });

  test("hacker B escaneia só o carrinho A, ataca e inverte; integridade da equipe A bloqueia", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "single" });
    const hackerA = await as({ name: "HA", role: "hacker", carId: "car-a" });
    const hackerB = await as({ name: "HB", role: "hacker", carId: "car-b" });
    const pilotA = await as({ name: "PA", role: "pilot", carId: "car-a" });
    run();
    expect((await act(hackerB, "attack.scan", {})).ok).toBe(true);
    expect(h.server.service.attacks.view("B").scanResults).toEqual(["car-a"]);
    expect(await act(hackerB, "attack.selectTarget", { targetCarId: "car-b" })).toMatchObject({ ok: false, code: "forbidden" });
    expect((await act(hackerB, "attack.selectTarget", { targetCarId: "car-a" })).ok).toBe(true);
    expect((await act(hackerB, "attack.exploitDemo", {})).ok).toBe(true);
    expect((await act(hackerB, "attack.configure", { invertThrottle: true, invertSteering: true })).ok).toBe(true);
    pilotA.send("pilot.drive", { throttle: 1, steering: -60, pressed: true });
    await sleep(30);
    expect(confirmed("car-a")).toEqual({ throttle: -1, steering: 60 });
    expect((await act(hackerA, "defense.setIntegrityDemo", { enabled: true })).ok).toBe(true);
    pilotA.send("pilot.drive", { throttle: 1, steering: -40, pressed: true });
    await sleep(70);
    expect(confirmed("car-a")).toEqual({ throttle: 1, steering: -40 });
    const spectator = h.server.engine.snapshot({ role: "spectator" });
    expect(spectator.cars.find((c) => c.id === "car-b")?.active).toBe(false);
  });

  test("operador vê só o ataque da equipe B", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "single" });
    const admin = await connectAs(h, (await adminLogin(h.base)).cookie);
    clients.push(admin);
    const snap = await admin.waitFor("state.snapshot");
    expect(snap.payload.state.attacks.map((a) => a.attackerTeam)).toEqual(["B"]);
  });

  test("carrinho B desativado não aceita comando nem teste manual", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "single" });
    expect(h.server.engine.manualDrive("car-b", { throttle: 1, steering: 0 })).toMatchObject({ ok: false, code: "forbidden" });
    run();
    expect(h.server.engine.pilotInput("car-b", { throttle: 1, steering: 0, pressed: true })).toMatchObject({
      ok: false,
      code: "forbidden",
    });
    expect(h.server.engine.car("car-b").controller.moving).toBe(false);
  });
});

describe("admin.setTopology", () => {
  test("só fora de running; dual → single revoga o piloto B, para os carros e reseta ataques", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "dual" });
    const admin = await connectAs(h, (await adminLogin(h.base)).cookie);
    clients.push(admin);
    const hackerA = await as({ name: "HA", role: "hacker", carId: "car-a" });
    const hackerB = await as({ name: "HB", role: "hacker", carId: "car-b" });
    const pilotB = await as({ name: "PB", role: "pilot", carId: "car-b" });
    run();
    await act(hackerA, "attack.scan", {});
    pilotB.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await sleep(30);
    expect(await act(admin, "admin.setTopology", { topology: "single" })).toMatchObject({ ok: false, code: "forbidden" });
    h.server.engine.setDemoState("paused");
    expect((await act(admin, "admin.setTopology", { topology: "single" })).ok).toBe(true);
    await pilotB.waitFor("session.revoked");
    expect(h.server.engine.topology).toBe("single");
    expect(h.server.engine.car("car-b").controller.moving).toBe(false);
    expect(h.server.service.attacks.view("A").step).toBe("locked");
    expect(h.server.service.sessions.slotHolder("car-b", "pilot")).toBeNull();
    expect(h.server.service.sessions.slotHolder("car-b", "hacker")?.displayName).toBe("HB");
    expect(hackerB.messages.some((m) => m.type === "session.revoked")).toBe(false);
    expect((await act(admin, "admin.setTopology", { topology: "dual" })).ok).toBe(true);
    expect(h.server.engine.isActive("car-b")).toBe(true);
  });

  test("participante não pode trocar a topologia", async () => {
    h = await startServer({ DEMO_TOPOLOGY: "dual" });
    const hackerA = await as({ name: "HA", role: "hacker", carId: "car-a" });
    expect(await act(hackerA, "admin.setTopology", { topology: "single" })).toMatchObject({ ok: false, code: "forbidden" });
  });
});
