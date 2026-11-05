import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { CAR_MODES, DEFAULT_COMMAND_TTL_MS } from "@hijack/protocol";
import { z } from "zod";

const csv = z
  .string()
  .default("")
  .transform((s) =>
    s
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean),
  );

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  SERVER_HOST: z.string().default("0.0.0.0"),
  SERVER_PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  ALLOWED_ORIGINS: csv,
  ADMIN_SECRET: z.string().min(8).optional(),
  DEVICE_SECRET_CAR_A: z.string().min(8).optional(),
  DEVICE_SECRET_CAR_B: z.string().min(8).optional(),
  CAR_A_MODE: z.enum(CAR_MODES).default("simulated"),
  CAR_B_MODE: z.enum(CAR_MODES).default("simulated"),
  COMMAND_TTL_MS: z.coerce.number().int().min(50).max(2000).default(DEFAULT_COMMAND_TTL_MS),
  DATA_DIR: z.string().default("data"),
  STATIC_DIR: z.string().default("../web/dist"),
  MAX_EVENTS: z.coerce.number().int().min(50).max(50_000).default(2000),
  SESSION_TTL_MS: z.coerce.number().int().min(60_000).default(4 * 60 * 60 * 1000),
});

export type Config = z.infer<typeof envSchema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Configuração inválida: ${fields}`);
  }
  return parsed.data;
}

export function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    ...loadConfig({}),
    DATA_DIR: mkdtempSync(path.join(tmpdir(), "hijack-test-")),
    ADMIN_SECRET: "admin-secret-test",
    DEVICE_SECRET_CAR_A: "device-secret-a",
    DEVICE_SECRET_CAR_B: "device-secret-b",
    ...overrides,
  };
}
