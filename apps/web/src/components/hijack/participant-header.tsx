import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { ConnectionBadge } from "@/components/hijack/connection-badge";
import { Button } from "@/components/ui/button";
import { useHijack } from "@/hooks/use-hijack";
import { DEMO_STATE_LABEL } from "@/lib/labels";

export function ParticipantHeader({ children }: { children?: ReactNode }) {
  const { me, status, state, logout } = useHijack();
  return (
    <header className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3">
      <span className="font-bold">{me?.displayName}</span>
      <ConnectionBadge status={status} />
      {state && <span className="text-sm text-muted-foreground">Partida: {DEMO_STATE_LABEL[state.demoState]}</span>}
      {children}
      <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => void logout()}>
        <LogOut /> Sair
      </Button>
    </header>
  );
}
