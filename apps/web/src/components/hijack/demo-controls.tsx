import type { DemoState } from "@hijack/protocol";
import { OctagonX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useHijack } from "@/hooks/use-hijack";

const NEXT: Record<DemoState, { to: DemoState; label: string }[]> = {
  setup: [{ to: "ready", label: "Pronto" }],
  ready: [
    { to: "running", label: "Iniciar" },
    { to: "setup", label: "Voltar à configuração" },
  ],
  running: [
    { to: "paused", label: "Pausar" },
    { to: "stopped", label: "Encerrar" },
  ],
  paused: [
    { to: "running", label: "Retomar" },
    { to: "stopped", label: "Encerrar" },
  ],
  stopped: [
    { to: "ready", label: "Nova largada" },
    { to: "setup", label: "Configuração" },
  ],
};

export function DemoControls({ demoState }: { demoState: DemoState }) {
  const { send } = useHijack();
  return (
    <div className="flex flex-wrap items-center gap-2">
      {NEXT[demoState].map((n) => (
        <Button key={n.to} variant="secondary" onClick={() => send("admin.setDemoState", { state: n.to })}>
          {n.label}
        </Button>
      ))}
      <Button variant="destructive" onClick={() => send("admin.stopAll", { reason: "operador" })} className="font-bold">
        <OctagonX /> STOP ALL
      </Button>
    </div>
  );
}
