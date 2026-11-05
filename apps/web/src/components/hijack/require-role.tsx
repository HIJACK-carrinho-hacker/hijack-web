import type { Role } from "@hijack/protocol";
import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useHijack } from "@/hooks/use-hijack";

export function RequireRole({ role, children, fallback = "/" }: { role: Role; children: ReactNode; fallback?: string }) {
  const { me, meLoaded } = useHijack();
  if (!meLoaded) {
    return <p className="p-6 text-muted-foreground">Carregando…</p>;
  }
  if (!me || me.role !== role) return <Navigate to={fallback} replace />;
  return <>{children}</>;
}
