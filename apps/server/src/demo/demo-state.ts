import type { DemoState } from "@hijack/protocol";

const TRANSITIONS: Record<DemoState, readonly DemoState[]> = {
  setup: ["ready"],
  ready: ["running", "setup"],
  running: ["paused", "stopped"],
  paused: ["running", "stopped"],
  stopped: ["setup", "ready"],
};

export function canTransition(from: DemoState, to: DemoState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function allowsMovement(state: DemoState): boolean {
  return state === "running";
}

export const DEMO_STATE_LABEL: Record<DemoState, string> = {
  setup: "Configuração",
  ready: "Aguardando largada",
  running: "Em demonstração",
  paused: "Pausado",
  stopped: "Encerrado",
};
