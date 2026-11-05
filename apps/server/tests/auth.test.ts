import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { type Harness, adminLogin, connectAs, login, startServer } from "./helpers.ts";

let h: Harness;

beforeEach(async () => {
  h = await startServer();
});

afterEach(async () => {
  await h.close();
});

const run = async () => {
  h.server.engine.setDemoState("ready");
  h.server.engine.setDemoState("running");
};

describe("login HTTP", () => {
  test("entra com a senha padrão e recebe cookie HttpOnly", async () => {
    const res = await fetch(`${h.base}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Ana", role: "pilot", carId: "car-a", password: "1234" }),
    });
    expect(res.status).toBe(200);
    const cookie = res.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    const body = (await res.json()) as { me: unknown };
    expect(body.me).toEqual({ displayName: "Ana", role: "pilot", teamId: "A", carId: "car-a" });
  });

  test("senha errada tem erro genérico e sem cookie", async () => {
    const r = await login(h.base, { role: "pilot", carId: "car-a", password: "0000" });
    expect(r.status).toBe(401);
    expect(r.body).toEqual({ ok: false, code: "invalid_credentials" });
    expect(r.cookie).toBeNull();
  });

  test("bloqueio progressivo após várias falhas", async () => {
    for (let i = 0; i < 5; i++) await login(h.base, { role: "pilot", carId: "car-b", password: "x" });
    const r = await login(h.base, { role: "pilot", carId: "car-b", password: "1234" });
    expect(r.status).toBe(429);
    expect(r.body.code).toBe("rate_limited");
  });

  test("papel admin não é aceito no login de participante", async () => {
    const res = await fetch(`${h.base}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "X", role: "admin", carId: "car-a", password: "1234" }),
    });
    expect(res.status).toBe(400);
  });

  test("vaga ocupada é recusada; mesmo navegador pode reentrar", async () => {
    const first = await login(h.base, { name: "Ana", role: "pilot", carId: "car-a" });
    const other = await login(h.base, { name: "Bia", role: "pilot", carId: "car-a" });
    expect(other.status).toBe(409);
    expect(other.body.code).toBe("slot_taken");
    const again = await login(h.base, { name: "Ana", role: "pilot", carId: "car-a" }, first.cookie);
    expect(again.status).toBe(200);
  });

  test("POST com Origin de outro site é recusado", async () => {
    const res = await fetch(`${h.base}/api/session`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://evil.example" },
      body: JSON.stringify({ name: "Ana", role: "pilot", carId: "car-a", password: "1234" }),
    });
    expect(res.status).toBe(403);
  });

  test("informação pública indica a dica da senha padrão e vagas", async () => {
    await login(h.base, { role: "hacker", carId: "car-b" });
    const info = (await (await fetch(`${h.base}/api/public`)).json()) as {
      cars: { id: string; defaultPasswordHint: boolean; hackerTaken: boolean }[];
    };
    expect(info.cars.map((c) => c.defaultPasswordHint)).toEqual([true, true]);
    expect(info.cars.find((c) => c.id === "car-b")?.hackerTaken).toBe(true);
    expect(JSON.stringify(info)).not.toContain("1234");
  });

  test("admin exige o segredo do operador", async () => {
    expect((await adminLogin(h.base, "errado-errado")).status).toBe(401);
    const ok = await adminLogin(h.base);
    expect(ok.status).toBe(200);
    expect(ok.cookie).not.toBeNull();
  });

  test("logout libera a vaga", async () => {
    const a = await login(h.base, { role: "pilot", carId: "car-a" });
    await fetch(`${h.base}/api/session`, { method: "DELETE", headers: { cookie: a.cookie ?? "" } });
    expect((await login(h.base, { name: "Outro", role: "pilot", carId: "car-a" })).status).toBe(200);
  });
});

describe("autorização por mensagem", () => {
  test("visitante não dirige nem usa ações de operador", async () => {
    const c = await connectAs(h, null);
    c.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    expect((await c.waitFor("system.error")).payload.code).toBe("unauthenticated");
    c.clear();
    c.send("admin.stopAll", { reason: "x" });
    expect((await c.waitFor("system.error")).payload.code).toBe("unauthenticated");
    c.close();
  });

  test("piloto não pode usar ações de operador nem de hacker", async () => {
    const p = await login(h.base, { role: "pilot", carId: "car-a" });
    const c = await connectAs(h, p.cookie);
    for (const [type, payload] of [
      ["admin.setDemoState", { state: "ready" }],
      ["sim.manualDrive", { carId: "car-b", throttle: 1, steering: 0 }],
      ["attack.scan", {}],
      ["auth.changePassword", { currentPassword: "1234", nextPassword: "Senha123forte" }],
    ] as const) {
      c.clear();
      c.send(type, payload);
      expect((await c.waitFor("system.error")).payload.code).toBe("forbidden");
    }
    c.close();
  });

  test("hacker não dirige", async () => {
    const hk = await login(h.base, { role: "hacker", carId: "car-a" });
    const c = await connectAs(h, hk.cookie);
    c.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    expect((await c.waitFor("system.error")).payload.code).toBe("forbidden");
    c.close();
  });

  test("piloto A só controla o carro A, mesmo se tentar informar outro carro", async () => {
    await run();
    const p = await login(h.base, { role: "pilot", carId: "car-a" });
    const c = await connectAs(h, p.cookie);
    c.send("pilot.drive", { throttle: 1, steering: 0, pressed: true, carId: "car-b" });
    expect((await c.waitFor("system.error")).payload.code).toBe("invalid_payload");
    c.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await c.waitFor("state.snapshot", (m) => m.payload.state.cars.some((car) => car.id === "car-a" && car.moving));
    expect(h.server.engine.car("car-b").controller.moving).toBe(false);
    c.close();
  });

  test("snapshot do piloto traz `me` e não traz métricas", async () => {
    const p = await login(h.base, { name: "Ana", role: "pilot", carId: "car-b" });
    const c = await connectAs(h, p.cookie);
    const snap = await c.waitFor("state.snapshot");
    expect(snap.payload.state.me).toEqual({ displayName: "Ana", role: "pilot", teamId: "B", carId: "car-b" });
    expect(snap.payload.state.metrics).toEqual([]);
    expect(snap.payload.state.defenses).toEqual([]);
    c.close();
  });

  test("piloto desconectado para o carro", async () => {
    await run();
    const p = await login(h.base, { role: "pilot", carId: "car-a" });
    const c = await connectAs(h, p.cookie);
    c.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await c.waitFor("state.snapshot", (m) => m.payload.state.cars.some((car) => car.moving));
    c.close();
    await new Promise((r) => setTimeout(r, 50));
    expect(h.server.engine.car("car-a").controller.moving).toBe(false);
    expect(h.server.engine.car("car-a").controller.stopReason).toBe("pilot-disconnected");
  });
});

describe("troca de senha", () => {
  test("hacker troca a senha: piloto do mesmo carro é revogado, hacker continua", async () => {
    await run();
    const pilotA = await login(h.base, { role: "pilot", carId: "car-a" });
    const pilotB = await login(h.base, { role: "pilot", carId: "car-b" });
    const hackerA = await login(h.base, { role: "hacker", carId: "car-a" });
    const cp = await connectAs(h, pilotA.cookie);
    const cpb = await connectAs(h, pilotB.cookie);
    const ch = await connectAs(h, hackerA.cookie);
    cp.send("pilot.drive", { throttle: 1, steering: 0, pressed: true });
    await cp.waitFor("state.snapshot", (m) => m.payload.state.cars.some((car) => car.id === "car-a" && car.moving));

    ch.send("auth.changePassword", { currentPassword: "1234", nextPassword: "Carrinho2026" });
    await ch.waitFor("action.ok", (m) => m.payload.type === "auth.changePassword");

    const revoked = await cp.waitFor("session.revoked");
    expect(revoked.payload.reason).toContain("senha");
    expect(h.server.engine.car("car-a").controller.moving).toBe(false);

    expect((await login(h.base, { role: "pilot", carId: "car-a" })).status).toBe(401);
    expect((await login(h.base, { role: "pilot", carId: "car-a", password: "Carrinho2026" })).status).toBe(200);

    ch.clear();
    ch.send("session.resume", {});
    const snap = await ch.waitFor("state.snapshot");
    expect(snap.payload.state.me?.role).toBe("hacker");
    expect(snap.payload.state.defenses[0]).toMatchObject({ carId: "car-a", strongPasswordEnabled: true, level: 1 });

    expect(cpb.messages.some((m) => m.type === "session.revoked")).toBe(false);
    expect((await login(h.base, { role: "hacker", carId: "car-b" })).status).toBe(200);
    for (const c of [cp, cpb, ch]) c.close();
  });

  test("senha fraca ou senha atual errada são recusadas", async () => {
    const hk = await login(h.base, { role: "hacker", carId: "car-b" });
    const c = await connectAs(h, hk.cookie);
    c.send("auth.changePassword", { currentPassword: "1234", nextPassword: "12345678" });
    expect((await c.waitFor("system.error")).payload.code).toBe("weak_password");
    c.clear();
    c.send("auth.changePassword", { currentPassword: "9999", nextPassword: "Carrinho2026" });
    expect((await c.waitFor("system.error")).payload.code).toBe("invalid_credentials");
    c.close();
  });

  test("senha é persistida só como hash argon2id", async () => {
    const hk = await login(h.base, { role: "hacker", carId: "car-b" });
    const c = await connectAs(h, hk.cookie);
    c.send("auth.changePassword", { currentPassword: "1234", nextPassword: "SegredoForte99" });
    await c.waitFor("action.ok");
    const raw = readFileSync(path.join(h.dataDir, "state.json"), "utf8");
    expect(raw).not.toContain("SegredoForte99");
    expect(raw).not.toContain('"1234"');
    expect(raw).toContain("$argon2id$");
    c.close();
  });

  test("operador reseta senhas só com flag explícita e fora de running", async () => {
    const hk = await login(h.base, { role: "hacker", carId: "car-a" });
    const ch = await connectAs(h, hk.cookie);
    ch.send("auth.changePassword", { currentPassword: "1234", nextPassword: "Carrinho2026" });
    await ch.waitFor("action.ok");
    const admin = await adminLogin(h.base);
    const ca = await connectAs(h, admin.cookie);
    ca.send("admin.resetDemo", { resetAttacks: true, resetDefenses: true, resetPasswords: false });
    await ca.waitFor("action.ok");
    expect(h.server.service.passwords.isDefault("car-a")).toBe(false);
    ca.clear();
    ca.send("admin.resetDemo", { resetAttacks: true, resetDefenses: true, resetPasswords: true });
    await ca.waitFor("action.ok");
    expect(h.server.service.passwords.isDefault("car-a")).toBe(true);
    ch.close();
    ca.close();
  });
});

describe("operador", () => {
  test("libera vaga e revoga a sessão correspondente", async () => {
    const p = await login(h.base, { role: "pilot", carId: "car-a" });
    const cp = await connectAs(h, p.cookie);
    const admin = await adminLogin(h.base);
    const ca = await connectAs(h, admin.cookie);
    ca.send("admin.releaseSlot", { carId: "car-a", role: "pilot" });
    await cp.waitFor("session.revoked");
    expect((await login(h.base, { name: "Novo", role: "pilot", carId: "car-a" })).status).toBe(200);
    cp.close();
    ca.close();
  });
});
