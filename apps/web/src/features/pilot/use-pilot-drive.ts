import { PILOT_REFRESH_MS, type ClientPayload } from "@hijack/protocol";
import { useCallback, useEffect, useRef, useState } from "react";
import { useHijack } from "@/hooks/use-hijack";
import { type Axes, NEUTRAL, isNeutralAxes, sameAxes } from "./joystick-math.ts";

type StopReason = ClientPayload<"pilot.stop">["reason"];

export function usePilotDrive(enabled: boolean) {
  const { send, status } = useHijack();
  const axesRef = useRef<Axes>(NEUTRAL);
  const pressedRef = useRef(false);
  const enabledRef = useRef(enabled);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const [axes, setAxes] = useState<Axes>(NEUTRAL);
  const [resetKey, setResetKey] = useState(0);

  const clearTimer = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }, []);

  const transmit = useCallback(() => {
    if (!enabledRef.current) return;
    send("pilot.drive", { ...axesRef.current, pressed: pressedRef.current });
  }, [send]);

  const stop = useCallback(
    (reason: StopReason) => {
      const wasActive = pressedRef.current || !isNeutralAxes(axesRef.current);
      clearTimer();
      axesRef.current = NEUTRAL;
      pressedRef.current = false;
      setAxes(NEUTRAL);
      setResetKey((k) => k + 1);
      if (wasActive) send("pilot.stop", { reason });
    },
    [clearTimer, send],
  );

  const update = useCallback(
    (next: Axes, pressed: boolean) => {
      const active = pressed && !isNeutralAxes(next);
      const changed = !sameAxes(next, axesRef.current) || active !== pressedRef.current;
      axesRef.current = next;
      pressedRef.current = active;
      setAxes(next);
      if (!changed) return;
      if (!active) {
        clearTimer();
        send("pilot.stop", { reason: "release" });
        return;
      }
      transmit();
      if (!timer.current) timer.current = setInterval(transmit, PILOT_REFRESH_MS);
    },
    [clearTimer, send, transmit],
  );

  useEffect(() => {
    enabledRef.current = enabled && status === "open";
    if (!enabledRef.current) stop(status === "open" ? "manual" : "disconnect");
  }, [enabled, status, stop]);

  useEffect(() => {
    const onBlur = () => stop("blur");
    const onVisibility = () => {
      if (document.visibilityState === "hidden") stop("hidden");
    };
    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onVisibility);
      stop("unmount");
    };
  }, [stop]);

  return { axes, update, stop, resetKey };
}
