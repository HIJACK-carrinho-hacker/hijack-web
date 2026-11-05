import { useEffect, useRef } from "react";
import { type Axes, DRIVE_KEYS, axesFromKeys } from "./joystick-math.ts";

export function useDriveKeys(onChange: (axes: Axes, pressed: boolean) => void) {
  const cb = useRef(onChange);
  useEffect(() => {
    cb.current = onChange;
  });

  useEffect(() => {
    const keys = new Set<string>();
    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName));
    const emit = () => {
      const axes = axesFromKeys(keys);
      cb.current(axes, keys.size > 0);
    };
    const down = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!DRIVE_KEYS.has(k) || isTyping(e.target)) return;
      e.preventDefault();
      if (keys.has(k)) return;
      keys.add(k);
      emit();
    };
    const up = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (!keys.delete(k)) return;
      emit();
    };
    const reset = () => {
      if (keys.size === 0) return;
      keys.clear();
      emit();
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", reset);
    };
  }, []);
}
