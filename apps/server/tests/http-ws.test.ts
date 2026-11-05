import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { WebSocket } from "ws";
import { type Harness, TestClient, startServer } from "./helpers.ts";

let h: Harness;

beforeEach(async () => {
  h = await startServer();
});

afterEach(async () => {
  await h.close();
});

describe("HTTP", () => {
  test("/health responde sem dados sensíveis", async () => {
    const res = await fetch(`${h.base}/health`);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(true);
    const text = JSON.stringify(body);
    expect(text).not.toContain("secret");
    expect(text).not.toContain("1234");
  });

  test("corpo JSON grande é recusado com código estável", async () => {
    const res = await fetch(`${h.base}/health`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ x: "y".repeat(5000) }),
    });
    expect(res.status).toBe(413);
  });
});

describe("WebSocket", () => {
  test("conecta com Origin da mesma origem", async () => {
    const c = await TestClient.connect(h.port);
    const snap = await c.waitFor("state.snapshot");
    expect(snap.payload.state.cars.map((car) => car.id)).toEqual(["car-a", "car-b"]);
    c.close();
  });

  test("recusa Origin de outro site", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${h.port}/ws`, { headers: { origin: "http://evil.example" } });
    const err = await new Promise<Error>((resolve) => ws.once("error", resolve));
    expect(err.message).toContain("403");
  });

  test("mensagem malformada não derruba o servidor", async () => {
    const c = await TestClient.connect(h.port);
    c.sendRaw("{nao-json");
    const e1 = await c.waitFor("system.error");
    expect(e1.payload.code).toBe("bad_request");
    c.clear();
    c.sendRaw(JSON.stringify({ protocolVersion: 1, type: "x", pad: "a".repeat(3000) }));
    const e2 = await c.waitFor("system.error");
    expect(e2.payload.code).toBe("message_too_large");
    const res = await fetch(`${h.base}/health`);
    expect(res.status).toBe(200);
    c.close();
  });

  test("caminho desconhecido é recusado", async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${h.port}/outro`);
    const err = await new Promise<Error>((resolve) => ws.once("error", resolve));
    expect(err.message).toContain("404");
  });
});
