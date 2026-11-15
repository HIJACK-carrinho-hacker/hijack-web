import { type Axis, type DriveVector, STEERING_MAX, type Steering } from "@hijack/protocol";

export interface AttackEffect {
  invertThrottle: boolean;
  invertSteering: boolean;
  steeringBias: number;
  lockedSteering: Steering | null;
  replayVec: DriveVector | null;
}

export interface DefenseFlags {
  integrity: boolean;
  replay: boolean;
}

export type BlockedBy = "integrity" | "replay";

export interface PipelineResult {
  output: DriveVector;
  transformed: boolean;
  blocked: boolean;
  blockedBy: BlockedBy[];
}

export const NO_EFFECT: AttackEffect = {
  invertThrottle: false,
  invertSteering: false,
  steeringBias: 0,
  lockedSteering: null,
  replayVec: null,
};

export const NO_DEFENSE: DefenseFlags = { integrity: false, replay: false };

const invert = (v: Axis): Axis => (v === 0 ? 0 : v === 1 ? -1 : 1);
const noNegZero = (v: number): number => (v === 0 ? 0 : v);
const mirror = (v: Steering): Steering => noNegZero(-v);
const clampSteering = (v: number): Steering => noNegZero(Math.max(-STEERING_MAX, Math.min(STEERING_MAX, v)));

export function isNeutral(v: DriveVector): boolean {
  return v.throttle === 0 && v.steering === 0;
}

const same = (a: DriveVector, b: DriveVector) => a.throttle === b.throttle && a.steering === b.steering;

function tamper(v: DriveVector, attack: AttackEffect): DriveVector {
  let steering = v.steering;
  if (attack.lockedSteering !== null) steering = attack.lockedSteering;
  if (attack.steeringBias !== 0) steering = clampSteering(steering + attack.steeringBias);
  if (attack.invertSteering) steering = mirror(steering);
  const throttle = attack.invertThrottle ? invert(v.throttle) : v.throttle;
  return { throttle, steering };
}

export function applyAttack(
  input: DriveVector,
  attack: AttackEffect | null,
  defenses: DefenseFlags = NO_DEFENSE,
): PipelineResult {
  let output: DriveVector = { throttle: input.throttle, steering: input.steering };
  const blockedBy: BlockedBy[] = [];
  const result = (transformed: boolean): PipelineResult => ({
    output,
    transformed,
    blocked: blockedBy.length > 0,
    blockedBy,
  });
  if (!attack || isNeutral(input)) return result(false);
  let transformed = false;
  if (attack.replayVec && input.throttle !== 0 && !same(attack.replayVec, output)) {
    if (defenses.replay) blockedBy.push("replay");
    else {
      output = { throttle: attack.replayVec.throttle, steering: attack.replayVec.steering };
      transformed = true;
    }
  }
  if (isNeutral(output)) return result(transformed);
  const next = tamper(output, attack);
  if (!same(next, output)) {
    if (defenses.integrity) blockedBy.push("integrity");
    else {
      output = next;
      transformed = true;
    }
  }
  return result(transformed);
}
