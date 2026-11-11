import { describe, expect, test } from "bun:test";
import { RateLimiter } from "../src/ws/rate-limiter.ts";

describe("RateLimiter", () => {
  test("aceita a rajada inicial e recusa o excesso", () => {
    let now = 0;
    const limiter = new RateLimiter(10, 5, () => now);
    const results = Array.from({ length: 8 }, () => limiter.take());
    expect(results).toEqual([true, true, true, true, true, false, false, false]);
  });

  test("recarrega com o tempo sem passar da rajada", () => {
    let now = 0;
    const limiter = new RateLimiter(10, 5, () => now);
    for (let i = 0; i < 5; i++) limiter.take();
    expect(limiter.take()).toBe(false);
    now += 200;
    expect(limiter.take()).toBe(true);
    expect(limiter.take()).toBe(true);
    expect(limiter.take()).toBe(false);
    now += 60_000;
    const after = Array.from({ length: 7 }, () => limiter.take());
    expect(after).toEqual([true, true, true, true, true, false, false]);
  });
});
