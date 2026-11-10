import { type Axis, STEERING_MAX } from "@hijack/protocol";

export interface Axes {
  throttle: Axis;
  steering: number;
}

export const NEUTRAL: Axes = { throttle: 0, steering: 0 };

export const DEFAULT_DEAD_ZONE = 0.3;
export const MIN_DEAD_ZONE = 0.1;
export const MAX_DEAD_ZONE = 0.6;
export const STEERING_STEP = 5;

export function clampToUnitCircle(x: number, y: number): { x: number; y: number } {
  const len = Math.hypot(x, y);
  if (len <= 1) return { x, y };
  return { x: x / len, y: y / len };
}

export function steeringFromX(x: number, deadZone = DEFAULT_DEAD_ZONE): number {
  const magnitude = Math.abs(x);
  if (magnitude <= deadZone) return 0;
  const scaled = Math.min(1, (magnitude - deadZone) / (1 - deadZone)) * STEERING_MAX;
  const quantized = Math.min(STEERING_MAX, Math.round(scaled / STEERING_STEP) * STEERING_STEP);
  return quantized === 0 ? 0 : Math.sign(x) * quantized;
}

export function axesFromVector(x: number, y: number, deadZone = DEFAULT_DEAD_ZONE): Axes {
  const p = clampToUnitCircle(x, y);
  const throttle: Axis = p.y < -deadZone ? 1 : p.y > deadZone ? -1 : 0;
  return { throttle, steering: steeringFromX(p.x, deadZone) };
}

export function axesFromKeys(keys: ReadonlySet<string>): Axes {
  const up = keys.has("w") || keys.has("arrowup");
  const down = keys.has("s") || keys.has("arrowdown");
  const left = keys.has("a") || keys.has("arrowleft");
  const right = keys.has("d") || keys.has("arrowright");
  const throttle: Axis = up === down ? 0 : up ? 1 : -1;
  const steering = left === right ? 0 : right ? STEERING_MAX : -STEERING_MAX;
  return { throttle, steering };
}

export const sameAxes = (a: Axes, b: Axes) => a.throttle === b.throttle && a.steering === b.steering;

export const isNeutralAxes = (a: Axes) => a.throttle === 0 && a.steering === 0;

export const DRIVE_KEYS = new Set(["w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"]);
