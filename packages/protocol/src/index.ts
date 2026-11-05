import { clientMessageSchema, deviceToServerSchema, serverMessageSchema } from "./schema.ts";

export * from "./constants.ts";
export * from "./parse.ts";
export * from "./schema.ts";
export type * from "./types.ts";

const typesOf = (schema: { options: readonly { shape: { type: { value: string } } }[] }) =>
  new Set(schema.options.map((o) => o.shape.type.value));

export const CLIENT_MESSAGE_TYPES: ReadonlySet<string> = typesOf(clientMessageSchema);
export const SERVER_MESSAGE_TYPES: ReadonlySet<string> = typesOf(serverMessageSchema);
export const DEVICE_MESSAGE_TYPES: ReadonlySet<string> = typesOf(deviceToServerSchema);
