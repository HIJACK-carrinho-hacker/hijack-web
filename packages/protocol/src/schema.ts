import { z } from "zod";
import {
  ATTACK_STEPS,
  CAR_IDS,
  CAR_MODES,
  DEMO_STATES,
  ERROR_CODES,
  MAX_NAME_LENGTH,
  MAX_PASSWORD_LENGTH,
  PARTICIPANT_ROLES,
  PILOT_STOP_REASONS,
  PROTOCOL_VERSION,
  ROLES,
  STOP_REASONS,
  TEAM_IDS,
} from "./constants.ts";

export const axisSchema = z.union([z.literal(-1), z.literal(0), z.literal(1)]);
export const teamIdSchema = z.enum(TEAM_IDS);
export const carIdSchema = z.enum(CAR_IDS);
export const roleSchema = z.enum(ROLES);
export const participantRoleSchema = z.enum(PARTICIPANT_ROLES);
export const carModeSchema = z.enum(CAR_MODES);
export const demoStateSchema = z.enum(DEMO_STATES);
export const attackStepSchema = z.enum(ATTACK_STEPS);
export const stopReasonSchema = z.enum(STOP_REASONS);
export const errorCodeSchema = z.enum(ERROR_CODES);

const empty = z.strictObject({});

export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(MAX_NAME_LENGTH)
  .regex(/^[^\p{C}<>]+$/u, "caracteres inválidos");

export const passwordSchema = z.string().min(1).max(MAX_PASSWORD_LENGTH);

export const driveVectorSchema = z.strictObject({
  throttle: axisSchema,
  steering: axisSchema,
});

export const loginRequestSchema = z.strictObject({
  name: displayNameSchema,
  role: participantRoleSchema,
  carId: carIdSchema,
  carDisplayName: displayNameSchema.optional(),
  password: passwordSchema,
});

export const adminLoginRequestSchema = z.strictObject({
  secret: z.string().min(1).max(256),
});

export const publicCarInfoSchema = z.strictObject({
  id: carIdSchema,
  teamId: teamIdSchema,
  displayName: z.string(),
  mode: carModeSchema,
  defaultPasswordHint: z.boolean(),
  pilotTaken: z.boolean(),
  hackerTaken: z.boolean(),
});

export const publicInfoSchema = z.strictObject({
  cars: z.array(publicCarInfoSchema),
  adminAvailable: z.boolean(),
});

const clientEnvelope = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal(type),
    requestId: z.uuid(),
    sentAt: z.number().int().nonnegative(),
    payload,
  });

export const clientMessageSchema = z.discriminatedUnion("type", [
  clientEnvelope("session.logout", empty),
  clientEnvelope("session.resume", empty),
  clientEnvelope(
    "pilot.drive",
    z.strictObject({ throttle: axisSchema, steering: axisSchema, pressed: z.boolean() }),
  ),
  clientEnvelope("pilot.stop", z.strictObject({ reason: z.enum(PILOT_STOP_REASONS) })),
  clientEnvelope("attack.scan", empty),
  clientEnvelope("attack.selectTarget", z.strictObject({ targetCarId: carIdSchema })),
  clientEnvelope("attack.exploitDemo", empty),
  clientEnvelope(
    "attack.configure",
    z.strictObject({ invertThrottle: z.boolean(), invertSteering: z.boolean() }),
  ),
  clientEnvelope("attack.disable", empty),
  clientEnvelope("defense.setIntegrityDemo", z.strictObject({ enabled: z.boolean() })),
  clientEnvelope("defense.setReplayDemo", z.strictObject({ enabled: z.boolean() })),
  clientEnvelope(
    "auth.changePassword",
    z.strictObject({ currentPassword: passwordSchema, nextPassword: passwordSchema }),
  ),
  clientEnvelope("admin.setDemoState", z.strictObject({ state: demoStateSchema })),
  clientEnvelope("admin.stopAll", z.strictObject({ reason: z.string().max(120) })),
  clientEnvelope(
    "admin.resetDemo",
    z.strictObject({ resetAttacks: z.boolean(), resetDefenses: z.boolean(), resetPasswords: z.boolean() }),
  ),
  clientEnvelope("admin.setCarMode", z.strictObject({ carId: carIdSchema, mode: carModeSchema })),
  clientEnvelope("admin.releaseSlot", z.strictObject({ carId: carIdSchema, role: participantRoleSchema })),
  clientEnvelope("sim.manualDrive", z.strictObject({ carId: carIdSchema, throttle: axisSchema, steering: axisSchema })),
]);

export const telemetrySchema = z.strictObject({
  online: z.boolean(),
  lastSeenAt: z.number().nullable(),
  uptimeMs: z.number().nullable(),
  rssi: z.number().nullable(),
  reconnects: z.number().int(),
  rejectedCommands: z.number().int(),
  lastSeq: z.number().int(),
  watchdogTrips: z.number().int(),
});

export const carViewSchema = z.strictObject({
  id: carIdSchema,
  teamId: teamIdSchema,
  displayName: z.string(),
  mode: carModeSchema,
  requested: driveVectorSchema,
  desired: driveVectorSchema,
  confirmed: driveVectorSchema,
  moving: z.boolean(),
  stopReason: stopReasonSchema.nullable(),
  telemetry: telemetrySchema,
  sim: z
    .strictObject({ x: z.number(), y: z.number(), heading: z.number() })
    .nullable(),
});

export const slotViewSchema = z.strictObject({
  carId: carIdSchema,
  pilot: z.string().nullable(),
  hacker: z.string().nullable(),
});

export const attackViewSchema = z.strictObject({
  attackerTeam: teamIdSchema,
  step: attackStepSchema,
  scanResults: z.array(carIdSchema),
  targetCarId: carIdSchema.nullable(),
  exploitReport: z.string().nullable(),
  invertThrottle: z.boolean(),
  invertSteering: z.boolean(),
  active: z.boolean(),
});

export const defenseViewSchema = z.strictObject({
  carId: carIdSchema,
  strongPasswordEnabled: z.boolean(),
  integrityDemoEnabled: z.boolean(),
  replayDemoEnabled: z.boolean(),
  level: z.number().int().min(0).max(3),
});

export const meSchema = z.strictObject({
  displayName: z.string(),
  role: roleSchema,
  teamId: teamIdSchema.nullable(),
  carId: carIdSchema.nullable(),
});

export const eventLogEntrySchema = z.strictObject({
  id: z.number().int(),
  at: z.number(),
  kind: z.string(),
  carId: carIdSchema.nullable(),
  teamId: teamIdSchema.nullable(),
  actorRole: roleSchema.nullable(),
  message: z.string(),
  mode: carModeSchema.nullable(),
});

export const metricsSchema = z.strictObject({
  carId: carIdSchema,
  mode: carModeSchema,
  received: z.number().int(),
  applied: z.number().int(),
  transformed: z.number().int(),
  blocked: z.number().int(),
  rejected: z.number().int(),
  disconnects: z.number().int(),
  watchdogTrips: z.number().int(),
  ackLatencyMsP50: z.number().nullable(),
  ackLatencyMsP95: z.number().nullable(),
});

export const publicStateSchema = z.strictObject({
  demoState: demoStateSchema,
  me: meSchema.nullable(),
  cars: z.array(carViewSchema),
  slots: z.array(slotViewSchema),
  attacks: z.array(attackViewSchema),
  defenses: z.array(defenseViewSchema),
  events: z.array(eventLogEntrySchema),
  metrics: z.array(metricsSchema),
});

const serverEnvelope = <T extends string, P extends z.ZodType>(type: T, payload: P) =>
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal(type),
    eventId: z.number().int(),
    serverTime: z.number(),
    stateRevision: z.number().int(),
    requestId: z.uuid().optional(),
    payload,
  });

export const serverMessageSchema = z.discriminatedUnion("type", [
  serverEnvelope("session.accepted", z.strictObject({ me: meSchema })),
  serverEnvelope("session.denied", z.strictObject({ code: errorCodeSchema })),
  serverEnvelope("session.revoked", z.strictObject({ reason: z.string() })),
  serverEnvelope("state.snapshot", z.strictObject({ state: publicStateSchema })),
  serverEnvelope(
    "pilot.commandApplied",
    z.strictObject({ carId: carIdSchema, seq: z.number().int() }),
  ),
  serverEnvelope(
    "pilot.commandRejected",
    z.strictObject({ carId: carIdSchema, code: errorCodeSchema }),
  ),
  serverEnvelope("event.log", z.strictObject({ entry: eventLogEntrySchema })),
  serverEnvelope("system.error", z.strictObject({ code: errorCodeSchema, message: z.string() })),
  serverEnvelope("system.warning", z.strictObject({ message: z.string() })),
  serverEnvelope("system.stopAll", z.strictObject({ reason: z.string() })),
  serverEnvelope("action.ok", z.strictObject({ type: z.string() })),
]);

export const serverToDeviceSchema = z.discriminatedUnion("type", [
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.drive"),
    requestId: z.uuid(),
    seq: z.number().int().positive(),
    payload: z.strictObject({
      throttle: axisSchema,
      steering: axisSchema,
      speedMode: z.literal("fixed"),
      commandTtlMs: z.number().int().min(50).max(2000),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.stop"),
    requestId: z.uuid(),
    seq: z.number().int().positive(),
    payload: z.strictObject({ reason: z.string().max(40) }),
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.heartbeat"),
    payload: empty,
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.welcome"),
    payload: z.strictObject({ carId: carIdSchema, commandTtlMs: z.number().int() }),
  }),
]);

export const deviceToServerSchema = z.discriminatedUnion("type", [
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.hello"),
    payload: z.strictObject({
      deviceId: carIdSchema,
      secret: z.string().min(1).max(128),
      firmwareVersion: z.string().max(32),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.ack"),
    payload: z.strictObject({
      seq: z.number().int().nonnegative(),
      throttle: axisSchema,
      steering: axisSchema,
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.telemetry"),
    payload: z.strictObject({
      uptimeMs: z.number().nonnegative(),
      rssi: z.number().nullable(),
      lastSeq: z.number().int().nonnegative(),
      throttle: axisSchema,
      steering: axisSchema,
      reconnects: z.number().int().nonnegative(),
      rejectedCommands: z.number().int().nonnegative(),
      watchdogTrips: z.number().int().nonnegative(),
      stopReason: z.string().max(40).nullable(),
    }),
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.fault"),
    payload: z.strictObject({ code: z.string().max(40), detail: z.string().max(120) }),
  }),
  z.strictObject({
    protocolVersion: z.literal(PROTOCOL_VERSION),
    type: z.literal("device.stopped"),
    payload: z.strictObject({ reason: z.string().max(40), lastSeq: z.number().int().nonnegative() }),
  }),
]);
