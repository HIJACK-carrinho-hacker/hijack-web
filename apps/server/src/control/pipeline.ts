import type { Axis, DriveVector } from "@hijack/protocol";

export interface AttackEffect {
  invertThrottle: boolean;
  invertSteering: boolean;
}

export interface PipelineResult {
  output: DriveVector;
  transformed: boolean;
  blocked: boolean;
}

const invert = (v: Axis): Axis => (v === 0 ? 0 : v === 1 ? -1 : 1);

export function isNeutral(v: DriveVector): boolean {
  return v.throttle === 0 && v.steering === 0;
}

export function applyAttack(
  input: DriveVector,
  attack: AttackEffect | null,
  integrityDemoEnabled: boolean,
): PipelineResult {
  const output: DriveVector = { throttle: input.throttle, steering: input.steering };
  if (!attack || isNeutral(input)) return { output, transformed: false, blocked: false };
  const wouldChange =
    (attack.invertThrottle && input.throttle !== 0) || (attack.invertSteering && input.steering !== 0);
  if (!wouldChange) return { output, transformed: false, blocked: false };
  if (integrityDemoEnabled) return { output, transformed: false, blocked: true };
  if (attack.invertThrottle) output.throttle = invert(input.throttle);
  if (attack.invertSteering) output.steering = invert(input.steering);
  return { output, transformed: true, blocked: false };
}
