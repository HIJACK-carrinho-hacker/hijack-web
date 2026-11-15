import { describe, expect, test } from "bun:test";
import { type AttackEffect, NO_EFFECT, applyAttack } from "../src/control/pipeline.ts";
import { describeVector } from "../src/engine.ts";

const fx = (e: Partial<AttackEffect>): AttackEffect => ({ ...NO_EFFECT, ...e });
const both = fx({ invertThrottle: true, invertSteering: true });
const throttleOnly = fx({ invertThrottle: true });
const steeringOnly = fx({ invertSteering: true });
const integrity = { integrity: true, replay: false };
const replayDefense = { integrity: false, replay: true };

describe("pipeline de ataque (plano 8.1)", () => {
  test("(1,0) com inversão de tração → (-1,0)", () => {
    expect(applyAttack({ throttle: 1, steering: 0 }, throttleOnly)).toEqual({
      output: { throttle: -1, steering: 0 },
      transformed: true,
      blocked: false,
      blockedBy: [],
    });
  });

  test("(1,-100) com inversão de direção → (1,100)", () => {
    expect(applyAttack({ throttle: 1, steering: -100 }, steeringOnly).output).toEqual({ throttle: 1, steering: 100 });
  });

  test("(1,-60) com ambas → (-1,60)", () => {
    expect(applyAttack({ throttle: 1, steering: -60 }, both).output).toEqual({ throttle: -1, steering: 60 });
  });

  test("inversão de direção preserva a intensidade proporcional", () => {
    for (const s of [5, 35, 80, -15, -95]) {
      expect(applyAttack({ throttle: -1, steering: s }, steeringOnly).output).toEqual({ throttle: -1, steering: -s });
    }
  });

  test("direção sem tração também é invertida (servo vira, motores parados)", () => {
    const r = applyAttack({ throttle: 0, steering: 40 }, steeringOnly);
    expect(r).toEqual({ output: { throttle: 0, steering: -40 }, transformed: true, blocked: false, blockedBy: [] });
  });

  test("(0,0) com ambas → (0,0) sem transformação", () => {
    const r = applyAttack({ throttle: 0, steering: 0 }, both);
    expect(r.output).toEqual({ throttle: 0, steering: 0 });
    expect(r.transformed).toBe(false);
    expect(Object.is(r.output.throttle, -0)).toBe(false);
    expect(Object.is(r.output.steering, -0)).toBe(false);
  });

  test("(1,0) com inversão de direção mantém 0 sem -0", () => {
    const r = applyAttack({ throttle: 1, steering: 0 }, both);
    expect(r.output).toEqual({ throttle: -1, steering: 0 });
    expect(Object.is(r.output.steering, -0)).toBe(false);
  });

  test("eixo neutro não vira movimento", () => {
    const r = applyAttack({ throttle: 0, steering: 100 }, throttleOnly);
    expect(r.output).toEqual({ throttle: 0, steering: 100 });
    expect(r.transformed).toBe(false);
  });

  test("integridade didática bloqueia a inversão e registra bloqueio", () => {
    const r = applyAttack({ throttle: 1, steering: -60 }, both, integrity);
    expect(r).toEqual({ output: { throttle: 1, steering: -60 }, transformed: false, blocked: true, blockedBy: ["integrity"] });
  });

  test("sem ataque, comando passa intacto", () => {
    expect(applyAttack({ throttle: -1, steering: 75 }, null)).toEqual({
      output: { throttle: -1, steering: 75 },
      transformed: false,
      blocked: false,
      blockedBy: [],
    });
  });
});

describe("pipeline: viés, travamento e replay", () => {
  test("viés soma à direção e respeita ±100", () => {
    expect(applyAttack({ throttle: 1, steering: 0 }, fx({ steeringBias: 20 })).output).toEqual({ throttle: 1, steering: 20 });
    expect(applyAttack({ throttle: 1, steering: 90 }, fx({ steeringBias: 40 })).output).toEqual({ throttle: 1, steering: 100 });
    expect(applyAttack({ throttle: -1, steering: -80 }, fx({ steeringBias: -40 })).output).toEqual({ throttle: -1, steering: -100 });
  });

  test("viés não deixa -0 e não move carrinho parado", () => {
    const r = applyAttack({ throttle: 1, steering: 20 }, fx({ steeringBias: -20 }));
    expect(Object.is(r.output.steering, -0)).toBe(false);
    expect(applyAttack({ throttle: 0, steering: 0 }, fx({ steeringBias: 40 })).output).toEqual({ throttle: 0, steering: 0 });
  });

  test("travar fixa a direção guardada, inclusive no centro", () => {
    expect(applyAttack({ throttle: 1, steering: -100 }, fx({ lockedSteering: 30 })).output).toEqual({ throttle: 1, steering: 30 });
    const r = applyAttack({ throttle: 1, steering: 70 }, fx({ lockedSteering: 0 }));
    expect(r.output).toEqual({ throttle: 1, steering: 0 });
    expect(r.transformed).toBe(true);
  });

  test("travar com o pedido igual ao travado não conta como alteração", () => {
    expect(applyAttack({ throttle: 1, steering: 30 }, fx({ lockedSteering: 30 })).transformed).toBe(false);
  });

  test("travar sem tração e direção travada no centro vira neutro (para)", () => {
    expect(applyAttack({ throttle: 0, steering: 60 }, fx({ lockedSteering: 0 })).output).toEqual({ throttle: 0, steering: 0 });
  });

  test("combinação: travar, viés e inversões na ordem", () => {
    const r = applyAttack(
      { throttle: 1, steering: -90 },
      fx({ lockedSteering: 10, steeringBias: 20, invertSteering: true, invertThrottle: true }),
    );
    expect(r.output).toEqual({ throttle: -1, steering: -30 });
  });

  test("integridade bloqueia viés e travamento", () => {
    for (const e of [fx({ steeringBias: 20 }), fx({ lockedSteering: 50 })]) {
      const r = applyAttack({ throttle: 1, steering: 0 }, e, integrity);
      expect(r.output).toEqual({ throttle: 1, steering: 0 });
      expect(r.blockedBy).toEqual(["integrity"]);
    }
  });

  test("replay troca o comando atual pelo gravado", () => {
    const r = applyAttack({ throttle: 1, steering: 0 }, fx({ replayVec: { throttle: -1, steering: 40 } }));
    expect(r).toMatchObject({ output: { throttle: -1, steering: 40 }, transformed: true, blocked: false });
  });

  test("replay de um momento parado faz o carrinho parar, nunca andar", () => {
    const r = applyAttack({ throttle: 1, steering: 0 }, fx({ replayVec: { throttle: 0, steering: 0 }, steeringBias: 40 }));
    expect(r.output).toEqual({ throttle: 0, steering: 0 });
  });

  test("defesa de repetição recusa o replay sem bloquear as outras alterações", () => {
    const r = applyAttack(
      { throttle: 1, steering: 0 },
      fx({ replayVec: { throttle: -1, steering: 40 }, invertSteering: true }),
      replayDefense,
    );
    expect(r.output).toEqual({ throttle: 1, steering: 0 });
    expect(r.blockedBy).toEqual(["replay"]);
    const r2 = applyAttack({ throttle: 1, steering: 30 }, fx({ replayVec: { throttle: -1, steering: 40 }, invertSteering: true }), replayDefense);
    expect(r2.output).toEqual({ throttle: 1, steering: -30 });
    expect(r2).toMatchObject({ transformed: true, blockedBy: ["replay"] });
  });

  test("integridade não bloqueia o replay", () => {
    const r = applyAttack({ throttle: 1, steering: 0 }, fx({ replayVec: { throttle: -1, steering: 40 } }), integrity);
    expect(r.output).toEqual({ throttle: -1, steering: 40 });
  });

  test("replay igual ao comando atual não conta como alteração", () => {
    const r = applyAttack({ throttle: 1, steering: 0 }, fx({ replayVec: { throttle: 1, steering: 0 } }), replayDefense);
    expect(r).toMatchObject({ transformed: false, blocked: false });
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
