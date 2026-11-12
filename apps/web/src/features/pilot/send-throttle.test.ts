import { describe, expect, test } from "bun:test";
import { delayUntilNextSend } from "./send-throttle.ts";

describe("delayUntilNextSend", () => {
  test("envia na hora quando o intervalo mínimo já passou", () => {
    expect(delayUntilNextSend(1000, 900, 50)).toBe(0);
    expect(delayUntilNextSend(1000, 950, 50)).toBe(0);
  });

  test("espera só o que falta para completar o intervalo", () => {
    expect(delayUntilNextSend(1000, 980, 50)).toBe(30);
    expect(delayUntilNextSend(1000, 1000, 50)).toBe(50);
  });

  test("primeiro envio, sem histórico, não espera", () => {
    expect(delayUntilNextSend(1000, 0, 50)).toBe(0);
  });

  test("nunca devolve atraso negativo", () => {
    expect(delayUntilNextSend(5000, 100, 50)).toBe(0);
  });
});
