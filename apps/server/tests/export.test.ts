import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { csvCell, toCsv } from "../src/telemetry/export.ts";
import { type Harness, adminLogin, connectAs, login, startServer } from "./helpers.ts";

describe("CSV", () => {
  test("escapa aspas, vírgulas e quebras de linha", () => {
    expect(csvCell('a "b", c')).toBe('"a ""b"", c"');
    expect(csvCell(null)).toBe("");
    expect(toCsv(["x", "y"], [{ x: 1, y: "z" }])).toBe("x,y\r\n1,z\r\n");
  });

  test("neutraliza fórmulas de planilha", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(csvCell("+1")).toBe("'+1");
    expect(csvCell(-1)).toBe("-1");
  });
});

let h: Harness;

beforeEach(async () => {
  h = await startServer();
});

afterEach(async () => {
  await h.close();
});

describe("exportação", () => {
  test("exige operador", async () => {
    expect((await fetch(`${h.base}/api/admin/export/events.csv`)).status).toBe(401);
    const p = await login(h.base, { role: "pilot", carId: "car-a" });
    expect((await fetch(`${h.base}/api/admin/export/events.csv`, { headers: { cookie: p.cookie ?? "" } })).status).toBe(403);
  });

  test("eventos em CSV e métricas em JSON, separando o modo e sem segredos", async () => {
    const pw = "=SenhaForte1";
    const hk = await login(h.base, { name: "=Bruno", role: "hacker", carId: "car-a" });
    const c = await connectAs(h, hk.cookie);
    c.send("auth.changePassword", { currentPassword: "1234", nextPassword: pw });
    await c.waitFor("action.ok");
    c.close();
    h.server.engine.manualDrive("car-b", { throttle: 1, steering: 0 });
    const admin = await adminLogin(h.base);
    const headers = { cookie: admin.cookie ?? "" };

    const csvRes = await fetch(`${h.base}/api/admin/export/events.csv`, { headers });
    expect(csvRes.headers.get("content-type")).toContain("text/csv");
    expect(csvRes.headers.get("content-disposition")).toContain("attachment");
    const csv = await csvRes.text();
    expect(csv.split("\r\n")[0]).toBe("id,at,kind,carId,teamId,actorRole,mode,visibility,message");
    expect(csv).toContain("'=Bruno entrou como hacker");
    expect(csv).not.toContain(pw);
    expect(csv).not.toContain("1234");
    expect(csv).not.toContain("admin-secret-test");

    const json = (await (await fetch(`${h.base}/api/admin/export/metrics.json`, { headers })).json()) as {
      metrics: { carId: string; mode: string; received: number }[];
    };
    expect(json.metrics.find((m) => m.carId === "car-b")).toMatchObject({ mode: "simulated", received: 1 });
  });

  test("formato ou nome desconhecido devolve 404", async () => {
    const admin = await adminLogin(h.base);
    const headers = { cookie: admin.cookie ?? "" };
    expect((await fetch(`${h.base}/api/admin/export/events.xml`, { headers })).status).toBe(404);
    expect((await fetch(`${h.base}/api/admin/export/sessions.json`, { headers })).status).toBe(404);
  });

  test("operador obtém os endereços da LAN", async () => {
    const admin = await adminLogin(h.base);
    const r = await fetch(`${h.base}/api/admin/lan`, { headers: { cookie: admin.cookie ?? "" } });
    const body = (await r.json()) as { addresses: string[]; serverPort: number };
    expect(Array.isArray(body.addresses)).toBe(true);
  });
});
