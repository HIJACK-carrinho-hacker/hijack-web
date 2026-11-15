import type { CarView, DemoState, StopReason } from "@hijack/protocol";
import type { ConnectionStatus } from "@/lib/ws-client";

export type PilotTone = "primary" | "warning" | "destructive" | "muted";

export interface PilotStatus {
  label: string;
  tone: PilotTone;
  canDrive: boolean;
}

const SAFETY_STOPS: ReadonlySet<StopReason> = new Set([
  "watchdog",
  "admin-stop-all",
  "device-disconnected",
  "fault",
  "link-jammed",
]);

export function pilotStatus(conn: ConnectionStatus, demo: DemoState | undefined, car: CarView | undefined): PilotStatus {
  if (conn !== "open") return { label: "Sem conexão", tone: "destructive", canDrive: false };
  if (!car || !demo) return { label: "Carregando…", tone: "muted", canDrive: false };
  if (!car.active) return { label: "Carrinho desativado nesta demonstração", tone: "muted", canDrive: false };
  if (!car.telemetry.online) return { label: "Carrinho desconectado", tone: "destructive", canDrive: false };
  if (car.hijacked && demo === "running") {
    return { label: "Controle tomado pelo invasor", tone: "destructive", canDrive: false };
  }
  switch (demo) {
    case "setup":
    case "ready":
      return { label: "Aguardando a largada…", tone: "muted", canDrive: false };
    case "paused":
      return { label: "Pausado", tone: "warning", canDrive: false };
    case "stopped":
      return { label: "Demonstração encerrada", tone: "muted", canDrive: false };
    case "running":
      if (!car.moving && car.stopReason && SAFETY_STOPS.has(car.stopReason)) {
        return { label: "Parada de segurança", tone: "warning", canDrive: true };
      }
      return { label: "Em demonstração", tone: "primary", canDrive: true };
  }
}
