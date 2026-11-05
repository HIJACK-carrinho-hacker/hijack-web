import { useContext } from "react";
import { HijackContext, type HijackContextValue } from "@/app/hijack-context";

export function useHijack(): HijackContextValue {
  const ctx = useContext(HijackContext);
  if (!ctx) throw new Error("useHijack fora do HijackProvider");
  return ctx;
}
