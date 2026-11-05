import { describe, expect, test } from "bun:test";
import { AttackManager, exploitReport } from "../src/attacks/attack-manager.ts";

const ctx = { targetName: "Carrinho B", targetUsesDefaultPassword: true };

describe("AttackManager", () => {
  test("etapas precisam seguir a ordem", () => {
    const m = new AttackManager();
    expect(m.selectTarget("A", "car-b")).toMatchObject({ ok: false, code: "attack_step_invalid" });
    expect(m.exploit("A", ctx)).toMatchObject({ ok: false, code: "attack_step_invalid" });
    expect(m.configure("A", true, false)).toMatchObject({ ok: false, code: "attack_step_invalid" });
    expect(m.scan("A").ok).toBe(true);
    expect(m.view("A").scanResults).toEqual(["car-a", "car-b"]);
    expect(m.selectTarget("A", "car-b").ok).toBe(true);
    expect(m.exploit("A", ctx).ok).toBe(true);
    expect(m.configure("A", true, false).ok).toBe(true);
    expect(m.view("A")).toMatchObject({ step: "manipulate", active: true, invertThrottle: true, invertSteering: false });
  });

  test("só o carrinho adversário pode ser alvo", () => {
    const m = new AttackManager();
    m.scan("B");
    expect(m.selectTarget("B", "car-b")).toMatchObject({ ok: false, code: "forbidden" });
    expect(m.selectTarget("B", "car-a").ok).toBe(true);
  });

  test("efeito vale só no alvo e some ao desativar", () => {
    const m = new AttackManager();
    m.scan("A");
    m.selectTarget("A", "car-b");
    m.exploit("A", ctx);
    m.configure("A", true, true);
    expect(m.effectOn("car-b")).toEqual({ invertThrottle: true, invertSteering: true });
    expect(m.effectOn("car-a")).toBeNull();
    m.disable("A");
    expect(m.effectOn("car-b")).toBeNull();
    expect(m.view("A").step).toBe("manipulate");
  });

  test("ataques das duas equipes são independentes", () => {
    const m = new AttackManager();
    for (const [team, target] of [["A", "car-b"], ["B", "car-a"]] as const) {
      m.scan(team);
      m.selectTarget(team, target);
      m.exploit(team, ctx);
    }
    m.configure("A", false, true);
    m.configure("B", true, false);
    expect(m.effectOn("car-b")).toEqual({ invertThrottle: false, invertSteering: true });
    expect(m.effectOn("car-a")).toEqual({ invertThrottle: true, invertSteering: false });
  });

  test("relatório deixa claro que é simulado", () => {
    expect(exploitReport(ctx)).toContain("Relatório simulado");
    expect(exploitReport({ ...ctx, targetUsesDefaultPassword: false })).toContain("já foi trocada");
  });
});
