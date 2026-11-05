import { describe, expect, test } from "bun:test";
import { axesFromKeys, axesFromVector, clampToUnitCircle } from "./joystick-math.ts";

describe("axesFromVector", () => {
  test("centro e dead zone ficam neutros", () => {
    expect(axesFromVector(0, 0)).toEqual({ throttle: 0, steering: 0 });
    expect(axesFromVector(0.2, -0.25, 0.3)).toEqual({ throttle: 0, steering: 0 });
  });

  test("para cima é frente, para baixo é ré (y da tela cresce para baixo)", () => {
    expect(axesFromVector(0, -1)).toEqual({ throttle: 1, steering: 0 });
    expect(axesFromVector(0, 1)).toEqual({ throttle: -1, steering: 0 });
  });

  test("direita e esquerda", () => {
    expect(axesFromVector(1, 0)).toEqual({ throttle: 0, steering: 1 });
    expect(axesFromVector(-1, 0)).toEqual({ throttle: 0, steering: -1 });
  });

  test("diagonal combina tração e direção", () => {
    expect(axesFromVector(0.7, -0.7)).toEqual({ throttle: 1, steering: 1 });
    expect(axesFromVector(-0.7, 0.7)).toEqual({ throttle: -1, steering: -1 });
  });

  test("vetor fora do círculo é limitado ao raio", () => {
    const p = clampToUnitCircle(3, 4);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1);
    expect(axesFromVector(30, -40)).toEqual({ throttle: 1, steering: 1 });
  });

  test("dead zone maior exige deslocamento maior", () => {
    expect(axesFromVector(0.4, 0, 0.5)).toEqual({ throttle: 0, steering: 0 });
    expect(axesFromVector(0.6, 0, 0.5)).toEqual({ throttle: 0, steering: 1 });
  });

  test("não gera valores proporcionais", () => {
    for (const v of [0.31, 0.5, 0.99]) {
      const a = axesFromVector(v, -v);
      expect([a.throttle, a.steering].every((n) => n === -1 || n === 0 || n === 1)).toBe(true);
    }
  });
});

describe("axesFromKeys", () => {
  test("WASD e setas", () => {
    expect(axesFromKeys(new Set(["w"]))).toEqual({ throttle: 1, steering: 0 });
    expect(axesFromKeys(new Set(["arrowdown", "arrowleft"]))).toEqual({ throttle: -1, steering: -1 });
    expect(axesFromKeys(new Set(["w", "d"]))).toEqual({ throttle: 1, steering: 1 });
  });

  test("teclas opostas se anulam", () => {
    expect(axesFromKeys(new Set(["w", "s", "a", "d"]))).toEqual({ throttle: 0, steering: 0 });
  });
});
