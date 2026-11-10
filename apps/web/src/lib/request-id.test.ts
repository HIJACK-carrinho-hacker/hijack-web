import { describe, expect, test } from "bun:test";
import { newRequestId } from "./request-id.ts";

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

const semRandomUUID = { getRandomValues: crypto.getRandomValues.bind(crypto) };

describe("newRequestId", () => {
  test("usa randomUUID quando o contexto é seguro", () => {
    const fixo = "00000000-0000-4000-8000-000000000000";
    const id = newRequestId({ getRandomValues: semRandomUUID.getRandomValues, randomUUID: () => fixo });
    expect(id).toBe(fixo);
  });

  test("sem randomUUID (HTTP na LAN) gera UUID v4 válido", () => {
    for (let i = 0; i < 50; i++) expect(newRequestId(semRandomUUID)).toMatch(UUID_V4);
  });

  test("sem randomUUID os ids não se repetem", () => {
    const ids = new Set(Array.from({ length: 200 }, () => newRequestId(semRandomUUID)));
    expect(ids.size).toBe(200);
  });

  test("com bytes fixos aplica versão 4 e variante RFC 4122", () => {
    const zeros = { getRandomValues: <T extends ArrayBufferView>(array: T): T => array };
    expect(newRequestId(zeros)).toBe("00000000-0000-4000-8000-000000000000");
    const uns = {
      getRandomValues: <T extends ArrayBufferView>(array: T): T => {
        new Uint8Array(array.buffer, array.byteOffset, array.byteLength).fill(0xff);
        return array;
      },
    };
    expect(newRequestId(uns)).toBe("ffffffff-ffff-4fff-bfff-ffffffffffff");
  });
});
