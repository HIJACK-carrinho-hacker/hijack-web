import type { IncomingMessage } from "node:http";

export function isOriginAllowed(req: IncomingMessage, allowed: readonly string[]): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  if (allowed.includes(origin)) return true;
  try {
    const url = new URL(origin);
    return url.host === req.headers.host;
  } catch {
    return false;
  }
}
