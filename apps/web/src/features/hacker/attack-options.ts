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
