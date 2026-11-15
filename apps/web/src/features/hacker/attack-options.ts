import { ATTACK_DELAYS_MS, ATTACK_DROP_PCTS } from "@hijack/protocol";

export interface Option {
  value: number;
  label: string;
}

export const BIAS_OPTIONS: readonly Option[] = [-40, -20, -10, 0, 10, 20, 40].map((v) => ({
  value: v,
  label: v === 0 ? "Desligado" : `${Math.abs(v)}% ${v > 0 ? "direita" : "esquerda"}`,
}));

export const DELAY_OPTIONS: readonly Option[] = ATTACK_DELAYS_MS.map((v) => ({
  value: v,
  label: v === 0 ? "Desligado" : `${v} ms`,
}));

export const DROP_OPTIONS: readonly Option[] = ATTACK_DROP_PCTS.map((v) => ({
  value: v,
  label: v === 0 ? "Desligada" : `${v}%`,
}));

const HIJACK_REJECTION: Partial<Record<string, string>> = {
  link_jammed: "O link do alvo está derrubado; os comandos não chegam.",
  release_required: "Solte o analógico e toque de novo para voltar a mover.",
  demo_not_running: "A partida não está em andamento.",
  car_offline: "O carrinho alvo está desconectado.",
  forbidden: "O sequestro não está ativo.",
};

export function hijackRejection(code: string): string {
  return HIJACK_REJECTION[code] ?? "Comando recusado pelo servidor.";
}
