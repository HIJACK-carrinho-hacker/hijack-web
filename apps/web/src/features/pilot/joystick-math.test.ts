import { describe, expect, test } from "bun:test";
import { axesFromKeys, axesFromVector, clampToUnitCircle, steeringFromX } from "./joystick-math.ts";

describe("axesFromVector", () => {
  test("centro e dead zone ficam neutros", () => {
    expect(axesFromVector(0, 0)).toEqual({ throttle: 0, steering: 0 });
    expect(axesFromVector(0.2, -0.25, 0.3)).toEqual({ throttle: 0, steering: 0 });
  });

  test("para cima é frente, para baixo é ré (y da tela cresce para baixo)", () => {
    expect(axesFromVector(0, -1)).toEqual({ throttle: 1, steering: 0 });
    expect(axesFromVector(0, 1)).toEqual({ throttle: -1, steering: 0 });
  });

  test("direita e esquerda no fim do curso valem ±100", () => {
    expect(axesFromVector(1, 0)).toEqual({ throttle: 0, steering: 100 });
    expect(axesFromVector(-1, 0)).toEqual({ throttle: 0, steering: -100 });
  });

  test("diagonal combina tração fixa e direção proporcional", () => {
    expect(axesFromVector(0.7, -0.7)).toEqual({ throttle: 1, steering: 55 });
    expect(axesFromVector(-0.7, 0.7)).toEqual({ throttle: -1, steering: -55 });
  });

  test("vetor fora do círculo é limitado ao raio", () => {
    const p = clampToUnitCircle(3, 4);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1);
    expect(axesFromVector(30, -40)).toEqual({ throttle: 1, steering: 45 });
  });

  test("dead zone maior exige deslocamento maior", () => {
    expect(axesFromVector(0.4, 0, 0.5)).toEqual({ throttle: 0, steering: 0 });
    expect(axesFromVector(0.6, 0, 0.5)).toEqual({ throttle: 0, steering: 20 });
  });

  test("tração nunca é proporcional: só -1, 0 ou 1", () => {
    for (const v of [0.31, 0.5, 0.99]) {
      const a = axesFromVector(v, -v);
      expect([-1, 0, 1]).toContain(a.throttle);
    }
  });
});

describe("steeringFromX", () => {
  test("zona morta zera a direção", () => {
    expect(steeringFromX(0.3, 0.3)).toBe(0);
    expect(steeringFromX(-0.1, 0.3)).toBe(0);
    expect(steeringFromX(0.31, 0.3)).toBe(0);
  });

  test("escala linear depois da zona morta, em passos de 5", () => {
    expect(steeringFromX(0.65, 0.3)).toBe(50);
    expect(steeringFromX(-0.65, 0.3)).toBe(-50);
    for (const x of [0.33, 0.42, 0.5, 0.77, 0.9]) {
      expect(Math.abs(steeringFromX(x, 0.3)) % 5).toBe(0);
    }
  });

  test("monótona e limitada a ±100", () => {
    let prev = 0;
    for (let x = 0; x <= 1.5; x += 0.01) {
      const s = steeringFromX(x, 0.3);
      expect(s).toBeGreaterThanOrEqual(prev);
      expect(s).toBeLessThanOrEqual(100);
      prev = s;
    }
    expect(steeringFromX(5, 0.3)).toBe(100);
    expect(steeringFromX(-5, 0.3)).toBe(-100);
  });

  test("nunca devolve -0", () => {
    expect(Object.is(steeringFromX(-0.31, 0.3), -0)).toBe(false);
    expect(Object.is(steeringFromX(-0.1, 0.3), -0)).toBe(false);
  });
});

describe("axesFromKeys", () => {
  test("WASD e setas", () => {
    expect(axesFromKeys(new Set(["w"]))).toEqual({ throttle: 1, steering: 0 });
    expect(axesFromKeys(new Set(["arrowdown", "arrowleft"]))).toEqual({ throttle: -1, steering: -100 });
    expect(axesFromKeys(new Set(["w", "d"]))).toEqual({ throttle: 1, steering: 100 });
  });

  test("teclas opostas se anulam", () => {
    expect(axesFromKeys(new Set(["w", "s", "a", "d"]))).toEqual({ throttle: 0, steering: 0 });
  });
});
