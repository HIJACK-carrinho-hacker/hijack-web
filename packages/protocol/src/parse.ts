import { MAX_MESSAGE_BYTES, PROTOCOL_VERSION } from "./constants.ts";
import type { ErrorCode } from "./types.ts";
import type { z } from "zod";

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: ErrorCode; message: string };

export function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

export function parseMessage<S extends z.ZodType>(
  schema: S,
  raw: string,
  knownTypes: ReadonlySet<string>,
  maxBytes = MAX_MESSAGE_BYTES,
): ParseResult<z.infer<S>> {
  if (byteLength(raw) > maxBytes) {
    return { ok: false, code: "message_too_large", message: "mensagem muito grande" };
  }
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return { ok: false, code: "bad_request", message: "JSON inválido" };
  }
  if (typeof data !== "object" || data === null || Array.isArray(data)) {
    return { ok: false, code: "bad_request", message: "mensagem deve ser um objeto" };
  }
  const record = data as Record<string, unknown>;
  if (record.protocolVersion !== PROTOCOL_VERSION) {
    return { ok: false, code: "unsupported_version", message: "versão de protocolo incompatível" };
  }
  if (typeof record.type !== "string" || !knownTypes.has(record.type)) {
    return { ok: false, code: "unknown_type", message: "tipo de mensagem desconhecido" };
  }
  const result = schema.safeParse(data);
  if (!result.success) {
    return { ok: false, code: "invalid_payload", message: "payload inválido" };
  }
  return { ok: true, value: result.data };
}
