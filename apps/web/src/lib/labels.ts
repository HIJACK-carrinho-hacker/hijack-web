import type { CarMode, DemoState, DemoTopology, DriveVector, StopReason } from "@hijack/protocol";

export const DEMO_STATE_LABEL: Record<DemoState, string> = {
  setup: "Configuração",
  ready: "Aguardando largada",
  running: "Em demonstração",
  paused: "Pausado",
  stopped: "Encerrado",
};

export const TOPOLOGY_LABEL: Record<DemoTopology, string> = {
  single: "1 carrinho",
  dual: "2 carrinhos",
};

export function describeSteering(steering: number): string {
  if (steering === 0) return "direção centro";
  return `direção ${Math.abs(steering)}% à ${steering > 0 ? "direita" : "esquerda"}`;
}

export function describeDrive(v: DriveVector): string {
  const t = v.throttle === 1 ? "frente" : v.throttle === -1 ? "ré" : "parado";
  return `${t}, ${describeSteering(v.steering)}`;
}

export const MODE_LABEL: Record<CarMode, string> = {
  simulated: "Simulado",
  hardware: "Hardware",
};

export const STOP_REASON_LABEL: Record<StopReason, string> = {
  boot: "Inicialização",
  "pilot-release": "Piloto soltou",
  "pilot-stop": "Piloto parou",
  "pilot-disconnected": "Piloto desconectou",
  "session-revoked": "Sessão revogada",
  watchdog: "Watchdog (sem comando recente)",
  "demo-not-running": "Demonstração parada",
  "admin-stop-all": "STOP geral",
  "device-disconnected": "Carrinho desconectado",
  "server-restart": "Servidor reiniciado",
  "mode-change": "Troca de modo",
  fault: "Falha",
};

export const TEAM_COLOR_CLASS = {
  A: { text: "text-primary", fill: "fill-primary", stroke: "stroke-primary", bg: "bg-primary" },
  B: { text: "text-chart-4", fill: "fill-chart-4", stroke: "stroke-chart-4", bg: "bg-chart-4" },
} as const;
