import { describe, expect, test } from "bun:test";
import { type AttackView, DEFAULT_ATTACK_CONFIG } from "@hijack/protocol";
import { configOf } from "./attack-config.ts";
import { BIAS_OPTIONS, DELAY_OPTIONS, DROP_OPTIONS, hijackRejection } from "./attack-options.ts";

const view: AttackView = {
  attackerTeam: "B",
  step: "manipulate",
  scanResults: ["car-a"],
  targetCarId: "car-a",
  exploitReport: "x",
  ...DEFAULT_ATTACK_CONFIG,
  steeringBias: 20,
  replay: true,
  active: true,
  intercepted: [{ at: 1, text: "pilot.drive", encrypted: false }],
  crackReport: null,
  jammedUntil: null,
  jamReadyAt: null,
};

describe("configOf", () => {
  test("copia só os campos aceitos pelo attack.configure", () => {
    expect(configOf(view)).toEqual({ ...DEFAULT_ATTACK_CONFIG, steeringBias: 20, replay: true });
    expect(Object.keys(configOf(view)).sort()).toEqual(Object.keys(DEFAULT_ATTACK_CONFIG).sort());
  });
});

describe("opções dos ataques", () => {
  test("cada opção tem rótulo e o zero é o desligado", () => {
    expect(BIAS_OPTIONS.find((o) => o.value === 0)?.label).toBe("Desligado");
    expect(BIAS_OPTIONS.find((o) => o.value === -20)?.label).toBe("20% esquerda");
    expect(DELAY_OPTIONS.map((o) => o.value)).toEqual([0, 150, 300]);
    expect(DROP_OPTIONS.map((o) => o.label)).toEqual(["Desligada", "30%", "60%"]);
  });

  test("valores de viés passam no schema (múltiplos de 5 até 40)", () => {
    for (const o of BIAS_OPTIONS) {
      expect(Math.abs(o.value)).toBeLessThanOrEqual(40);
      expect(Math.abs(o.value) % 5).toBe(0);
    }
  });
});

describe("hijackRejection", () => {
  test("explica os motivos conhecidos e tem texto padrão", () => {
    expect(hijackRejection("link_jammed")).toContain("link");
    expect(hijackRejection("release_required")).toContain("Solte");
    expect(hijackRejection("internal")).toBe("Comando recusado pelo servidor.");
  });
});
