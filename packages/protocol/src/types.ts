import type { z } from "zod";
import type {
  CAR_IDS,
  CAR_MODES,
  DEMO_STATES,
  DEMO_TOPOLOGIES,
  ERROR_CODES,
  ROLES,
  TEAM_IDS,
} from "./constants.ts";
import type {
  attackViewSchema,
  axisSchema,
  carViewSchema,
  clientMessageSchema,
  defenseViewSchema,
  deviceToServerSchema,
  driveVectorSchema,
  eventLogEntrySchema,
  loginRequestSchema,
  meSchema,
  metricsSchema,
  publicInfoSchema,
  publicStateSchema,
  serverMessageSchema,
  serverToDeviceSchema,
  slotViewSchema,
  steeringSchema,
  stopReasonSchema,
  telemetrySchema,
} from "./schema.ts";

export type Axis = z.infer<typeof axisSchema>;
export type TeamId = (typeof TEAM_IDS)[number];
export type CarId = (typeof CAR_IDS)[number];
export type Role = (typeof ROLES)[number];
export type CarMode = (typeof CAR_MODES)[number];
export type DemoState = (typeof DEMO_STATES)[number];
export type DemoTopology = (typeof DEMO_TOPOLOGIES)[number];
export type ErrorCode = (typeof ERROR_CODES)[number];
export type StopReason = z.infer<typeof stopReasonSchema>;
export type DriveVector = z.infer<typeof driveVectorSchema>;
export type Steering = z.infer<typeof steeringSchema>;

export type LoginRequest = z.infer<typeof loginRequestSchema>;
export type ClientMessage = z.infer<typeof clientMessageSchema>;
export type ClientMessageType = ClientMessage["type"];
export type ClientMessageOf<T extends ClientMessageType> = Extract<ClientMessage, { type: T }>;

export type ServerMessage = z.infer<typeof serverMessageSchema>;
export type ServerMessageType = ServerMessage["type"];
export type ServerMessageOf<T extends ServerMessageType> = Extract<ServerMessage, { type: T }>;

export type Telemetry = z.infer<typeof telemetrySchema>;
export type CarView = z.infer<typeof carViewSchema>;
export type SlotView = z.infer<typeof slotViewSchema>;
export type AttackView = z.infer<typeof attackViewSchema>;
export type DefenseView = z.infer<typeof defenseViewSchema>;
export type Me = z.infer<typeof meSchema>;
export type EventLogEntry = z.infer<typeof eventLogEntrySchema>;
export type Metrics = z.infer<typeof metricsSchema>;
export type PublicState = z.infer<typeof publicStateSchema>;

export type ServerToDevice = z.infer<typeof serverToDeviceSchema>;
export type DeviceToServer = z.infer<typeof deviceToServerSchema>;
export type ClientPayload<T extends ClientMessageType> = ClientMessageOf<T>["payload"];
export type ServerPayload<T extends ServerMessageType> = ServerMessageOf<T>["payload"];
export type PublicInfo = z.infer<typeof publicInfoSchema>;
