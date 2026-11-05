import { PILOT_REFRESH_MS } from "@hijack/protocol";
import { useCallback, useEffect, useRef } from "react";

export function useHoldRepeat(onTick: () => void, onRelease: () => void, periodMs = PILOT_REFRESH_MS) {
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickRef = useRef(onTick);
  const releaseRef = useRef(onRelease);

  useEffect(() => {
    tickRef.current = onTick;
    releaseRef.current = onRelease;
  });

  const start = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    tickRef.current();
    timer.current = setInterval(() => tickRef.current(), periodMs);
  }, [periodMs]);

  const stop = useCallback(() => {
    if (!timer.current) return;
    clearInterval(timer.current);
    timer.current = null;
    releaseRef.current();
  }, []);

  useEffect(() => stop, [stop]);

  return { start, stop, active: () => timer.current !== null };
}
