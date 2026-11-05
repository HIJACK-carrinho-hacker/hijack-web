import { describe, expect, test } from "bun:test";
import { applyAttack } from "../src/control/pipeline.ts";

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

  test("(1,-1) com inversão de direção → (1,1)", () => {
    expect(applyAttack({ throttle: 1, steering: -1 }, steeringOnly, false).output).toEqual({ throttle: 1, steering: 1 });
  });

  test("(1,-1) com ambas → (-1,1)", () => {
    expect(applyAttack({ throttle: 1, steering: -1 }, both, false).output).toEqual({ throttle: -1, steering: 1 });
  });

  test("(0,0) com ambas → (0,0) sem transformação", () => {
    const r = applyAttack({ throttle: 0, steering: 0 }, both, false);
    expect(r.output).toEqual({ throttle: 0, steering: 0 });
    expect(r.transformed).toBe(false);
    expect(Object.is(r.output.throttle, -0)).toBe(false);
  });

  test("eixo neutro não vira movimento", () => {
    const r = applyAttack({ throttle: 0, steering: 1 }, throttleOnly, false);
    expect(r.output).toEqual({ throttle: 0, steering: 1 });
    expect(r.transformed).toBe(false);
  });

  test("integridade didática bloqueia a inversão e registra bloqueio", () => {
    const r = applyAttack({ throttle: 1, steering: -1 }, both, true);
    expect(r).toEqual({ output: { throttle: 1, steering: -1 }, transformed: false, blocked: true });
  });

  test("sem ataque, comando passa intacto", () => {
    expect(applyAttack({ throttle: -1, steering: 1 }, null, false)).toEqual({
      output: { throttle: -1, steering: 1 },
      transformed: false,
      blocked: false,
    });
  });
});
