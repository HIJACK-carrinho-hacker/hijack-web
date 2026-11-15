import { type AttackConfig, type AttackView, DEFAULT_ATTACK_CONFIG } from "@hijack/protocol";

export function configOf(attack: AttackView): AttackConfig {
  const out = { ...DEFAULT_ATTACK_CONFIG };
  for (const key of Object.keys(DEFAULT_ATTACK_CONFIG) as (keyof AttackConfig)[]) {
    (out as Record<keyof AttackConfig, unknown>)[key] = attack[key];
  }
  return out;
}
