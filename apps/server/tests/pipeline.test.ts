import { describe, expect, test } from "bun:test";
import { applyAttack } from "../src/control/pipeline.ts";
import { describeVector } from "../src/engine.ts";

const both = { invertThrottle: true, invertSteering: true };
const throttleOnly = { invertThrottle: true, invertSteering: false };
const steeringOnly = { invertThrottle: false, invertSteering: true };

describe("pipeline de ataque (plano 8.1)", () => {
  test("(1,0) com inversão de tração → (-1,0)", () => {
    expect(applyAttack({ throttle: 1, steering: 0 }, throttleOnly, false)).toEqual({
      output: { throttle: -1, steering: 0 },
      transformed: true,
      blocked: false,
    });
  });

  test("(1,-100) com inversão de direção → (1,100)", () => {
    expect(applyAttack({ throttle: 1, steering: -100 }, steeringOnly, false).output).toEqual({ throttle: 1, steering: 100 });
  });

  test("(1,-60) com ambas → (-1,60)", () => {
    expect(applyAttack({ throttle: 1, steering: -60 }, both, false).output).toEqual({ throttle: -1, steering: 60 });
  });

  test("inversão de direção preserva a intensidade proporcional", () => {
    for (const s of [5, 35, 80, -15, -95]) {
      expect(applyAttack({ throttle: -1, steering: s }, steeringOnly, false).output).toEqual({ throttle: -1, steering: -s });
    }
  });

  test("direção sem tração também é invertida (servo vira, motores parados)", () => {
    const r = applyAttack({ throttle: 0, steering: 40 }, steeringOnly, false);
    expect(r).toEqual({ output: { throttle: 0, steering: -40 }, transformed: true, blocked: false });
  });

  test("(0,0) com ambas → (0,0) sem transformação", () => {
    const r = applyAttack({ throttle: 0, steering: 0 }, both, false);
    expect(r.output).toEqual({ throttle: 0, steering: 0 });
    expect(r.transformed).toBe(false);
    expect(Object.is(r.output.throttle, -0)).toBe(false);
    expect(Object.is(r.output.steering, -0)).toBe(false);
  });

  test("(1,0) com inversão de direção mantém 0 sem -0", () => {
    const r = applyAttack({ throttle: 1, steering: 0 }, both, false);
    expect(r.output).toEqual({ throttle: -1, steering: 0 });
    expect(Object.is(r.output.steering, -0)).toBe(false);
  });

  test("eixo neutro não vira movimento", () => {
    const r = applyAttack({ throttle: 0, steering: 100 }, throttleOnly, false);
    expect(r.output).toEqual({ throttle: 0, steering: 100 });
    expect(r.transformed).toBe(false);
  });

  test("integridade didática bloqueia a inversão e registra bloqueio", () => {
    const r = applyAttack({ throttle: 1, steering: -60 }, both, true);
    expect(r).toEqual({ output: { throttle: 1, steering: -60 }, transformed: false, blocked: true });
  });

  test("sem ataque, comando passa intacto", () => {
    expect(applyAttack({ throttle: -1, steering: 75 }, null, false)).toEqual({
      output: { throttle: -1, steering: 75 },
      transformed: false,
      blocked: false,
    });
  });
});

describe("describeVector", () => {
  test("mostra tração e direção com percentual", () => {
    expect(describeVector({ throttle: 1, steering: 60 })).toBe("frente + direita 60%");
    expect(describeVector({ throttle: -1, steering: 0 })).toBe("ré");
    expect(describeVector({ throttle: 0, steering: -100 })).toBe("esquerda 100%");
    expect(describeVector({ throttle: -1, steering: -35 })).toBe("ré + esquerda 35%");
    expect(describeVector({ throttle: 0, steering: 0 })).toBe("parado");
  });
});
