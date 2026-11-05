import { useCallback, useState } from "react";

const read = (key: string, fallback: number) => {
  try {
    const raw = localStorage.getItem(key);
    const n = raw === null ? Number.NaN : Number(raw);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
};

export function useLocalNumber(key: string, fallback: number, min: number, max: number) {
  const [value, setValue] = useState(() => Math.min(max, Math.max(min, read(key, fallback))));
  const set = useCallback(
    (v: number) => {
      const clamped = Math.min(max, Math.max(min, v));
      setValue(clamped);
      try {
        localStorage.setItem(key, String(clamped));
      } catch {}
    },
    [key, min, max],
  );
  return [value, set] as const;
}
