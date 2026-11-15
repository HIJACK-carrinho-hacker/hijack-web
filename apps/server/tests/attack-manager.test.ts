import { describe, expect, test } from "bun:test";
import { type AttackConfig, CRACK_DICTIONARY, DEFAULT_ATTACK_CONFIG } from "@hijack/protocol";
import { AttackManager, crackReport, exploitReport, isActiveConfig } from "../src/attacks/attack-manager.ts";
import { describeConfigChanges } from "../src/attacks/describe.ts";

const ctx = { targetName: "Carrinho B", targetUsesDefaultPassword: true };
const cfg = (c: Partial<AttackConfig>): AttackConfig => ({ ...DEFAULT_ATTACK_CONFIG, ...c });

const ready = (m: AttackManager, team: "A" | "B", target: "car-a" | "car-b") => {
  m.scan(team);
  m.selectTarget(team, target);
  m.exploit(team, ctx);
};

describe("AttackManager", () => {
  test("etapas precisam seguir a ordem", () => {
    const m = new AttackManager();
    expect(m.selectTarget("A", "car-b")).toMatchObject({ ok: false, code: "attack_step_invalid" });
    expect(m.exploit("A", ctx)).toMatchObject({ ok: false, code: "attack_step_invalid" });
    expect(m.configure("A", cfg({ invertThrottle: true }))).toMatchObject({ ok: false, code: "attack_step_invalid" });
    expect(m.crack("A", "Carrinho B", true)).toMatchObject({ ok: false, code: "attack_step_invalid" });
    expect(m.canManipulate("A")).toMatchObject({ ok: false, code: "attack_step_invalid" });
    expect(m.scan("A").ok).toBe(true);
    expect(m.view("A").scanResults).toEqual(["car-a", "car-b"]);
    expect(m.selectTarget("A", "car-b").ok).toBe(true);
    expect(m.exploit("A", ctx).ok).toBe(true);
    expect(m.configure("A", cfg({ invertThrottle: true })).ok).toBe(true);
    expect(m.view("A")).toMatchObject({ step: "manipulate", active: true, invertThrottle: true, invertSteering: false });
  });

  test("só o carrinho adversário pode ser alvo", () => {
    const m = new AttackManager();
    m.scan("B");
    expect(m.selectTarget("B", "car-b")).toMatchObject({ ok: false, code: "forbidden" });
    expect(m.selectTarget("B", "car-a").ok).toBe(true);
  });

  test("configuração vale só no alvo e some ao desativar", () => {
    const m = new AttackManager();
    ready(m, "A", "car-b");
    m.configure("A", cfg({ invertThrottle: true, steeringBias: 20, dropPct: 30 }));
    expect(m.configOn("car-b")).toEqual({ team: "A", config: cfg({ invertThrottle: true, steeringBias: 20, dropPct: 30 }) });
    expect(m.configOn("car-a")).toBeNull();
    m.disable("A");
    expect(m.configOn("car-b")).toBeNull();
    expect(m.view("A")).toMatchObject({ step: "manipulate", active: false, steeringBias: 0, dropPct: 0 });
  });

  test("qualquer ataque ligado deixa o ataque ativo", () => {
    expect(isActiveConfig(DEFAULT_ATTACK_CONFIG)).toBe(false);
    for (const c of [
      { lockSteering: true },
      { steeringBias: -5 },
      { delayMs: 150 as const },
      { dropPct: 60 as const },
      { replay: true },
      { intercept: true },
      { spoofTelemetry: true },
      { hijack: true },
    ]) {
      expect(isActiveConfig(cfg(c))).toBe(true);
    }
  });

  test("ataques das duas equipes são independentes", () => {
    const m = new AttackManager();
    ready(m, "A", "car-b");
    ready(m, "B", "car-a");
    m.configure("A", cfg({ invertSteering: true }));
    m.configure("B", cfg({ replay: true }));
    expect(m.configOn("car-b")?.config).toEqual(cfg({ invertSteering: true }));
    expect(m.configOn("car-a")?.config).toEqual(cfg({ replay: true }));
  });

  test("quebra de senha guarda o relatório no ataque", () => {
    const m = new AttackManager();
    ready(m, "A", "car-b");
    expect(m.crack("A", "Carrinho B", true).ok).toBe(true);
    expect(m.view("A").crackReport).toContain("1234");
  });

  test("relatórios deixam claro que são simulados", () => {
    expect(exploitReport(ctx)).toContain("Relatório simulado");
    expect(exploitReport({ ...ctx, targetUsesDefaultPassword: false })).toContain("já foi trocada");
    const found = crackReport("Carrinho A", true);
    expect(found).toContain("(simulado)");
    expect(found).toContain(`tentativa ${CRACK_DICTIONARY.indexOf("1234") + 1} de ${CRACK_DICTIONARY.length}: 1234`);
    const resisted = crackReport("Carrinho A", false);
    expect(resisted).toContain("nenhuma serviu");
    expect(resisted).not.toContain("1234");
  });
});

describe("describeConfigChanges", () => {
  test("descreve só o que mudou", () => {
    expect(describeConfigChanges(DEFAULT_ATTACK_CONFIG, DEFAULT_ATTACK_CONFIG, "Carrinho A")).toEqual([]);
    expect(describeConfigChanges(DEFAULT_ATTACK_CONFIG, cfg({ invertThrottle: true }), "Carrinho A")).toEqual([
      { message: "Inversão ativa: frente ↔ ré", visibility: "staff" },
    ]);
    expect(describeConfigChanges(DEFAULT_ATTACK_CONFIG, cfg({ steeringBias: -20 }), "Carrinho A")[0]?.message).toBe(
      "Viés de direção: 20% para a esquerda",
    );
  });

  test("interceptação e telemetria falsa ficam só com o atacante", () => {
    const changes = describeConfigChanges(DEFAULT_ATTACK_CONFIG, cfg({ intercept: true, spoofTelemetry: true }), "Carrinho A");
    expect(changes.map((c) => c.visibility)).toEqual(["team", "team"]);
  });
});
