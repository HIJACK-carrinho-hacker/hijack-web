import {
  ATTACK_STEPS,
  type AttackConfig,
  type AttackView,
  CAR_IDS,
  CRACK_DICTIONARY,
  type CarId,
  DEFAULT_ATTACK_CONFIG,
  DEFAULT_CAR_PASSWORD,
  OPPONENT_CAR,
  TEAM_IDS,
  TEAM_OF_CAR,
  type TeamId,
} from "@hijack/protocol";
import { type Result, fail, ok } from "../engine.ts";

type Step = AttackView["step"];

interface AttackState {
  attackerTeam: TeamId;
  step: Step;
  scanResults: CarId[];
  targetCarId: CarId | null;
  exploitReport: string | null;
  crackReport: string | null;
  config: AttackConfig;
}

const order = (s: Step) => ATTACK_STEPS.indexOf(s);

const initial = (attackerTeam: TeamId): AttackState => ({
  attackerTeam,
  step: "locked",
  scanResults: [],
  targetCarId: null,
  exploitReport: null,
  crackReport: null,
  config: { ...DEFAULT_ATTACK_CONFIG },
});

export const isActiveConfig = (c: AttackConfig): boolean =>
  (Object.keys(DEFAULT_ATTACK_CONFIG) as (keyof AttackConfig)[]).some((k) => c[k] !== DEFAULT_ATTACK_CONFIG[k]);

export interface ExploitContext {
  targetName: string;
  targetUsesDefaultPassword: boolean;
}

export function exploitReport(ctx: ExploitContext): string {
  const auth = ctx.targetUsesDefaultPassword
    ? "O carrinho ainda usa a senha padrão 1234, fácil de adivinhar."
    : "A senha padrão já foi trocada, mas a alteração acontece depois da autenticação, dentro de um componente autorizado (o servidor).";
  return [
    `Alvo: ${ctx.targetName}.`,
    auth,
    "Os comandos do piloto não têm verificação de integridade, então podem ser modificados no caminho até o carrinho.",
    "Relatório simulado: nenhuma falha real foi explorada e nenhuma rede foi invadida.",
  ].join(" ");
}

export function crackReport(targetName: string, targetUsesDefaultPassword: boolean): string {
  const total = CRACK_DICTIONARY.length;
  if (targetUsesDefaultPassword) {
    const attempt = CRACK_DICTIONARY.indexOf(DEFAULT_CAR_PASSWORD) + 1;
    return `Ataque de dicionário (simulado) contra o ${targetName}: senha encontrada na tentativa ${attempt} de ${total}: ${DEFAULT_CAR_PASSWORD}. Senhas padrão de fábrica estão no topo de qualquer lista. Com ela dá para entrar como piloto e sequestrar o carrinho.`;
  }
  return `Ataque de dicionário (simulado) contra o ${targetName}: ${total} senhas comuns testadas e nenhuma serviu. A senha forte resistiu; no sistema real o login ainda bloqueia depois de 5 erros. Sem a senha, o sequestro não é possível.`;
}

export class AttackManager {
  private states: Record<TeamId, AttackState> = { A: initial("A"), B: initial("B") };

  view(team: TeamId): AttackView {
    const s = this.states[team];
    return {
      attackerTeam: s.attackerTeam,
      step: s.step,
      scanResults: [...s.scanResults],
      targetCarId: s.targetCarId,
      exploitReport: s.exploitReport,
      ...s.config,
      active: isActiveConfig(s.config),
      intercepted: [],
      crackReport: s.crackReport,
      jammedUntil: null,
      jamReadyAt: null,
    };
  }

  all(): AttackView[] {
    return TEAM_IDS.map((t) => this.view(t));
  }

  config(team: TeamId): AttackConfig {
    return { ...this.states[team].config };
  }

  target(team: TeamId): CarId | null {
    return this.states[team].targetCarId;
  }

  scan(team: TeamId, visibleCars: readonly CarId[] = CAR_IDS): Result {
    const s = this.states[team];
    s.scanResults = [...visibleCars];
    if (order(s.step) < order("scan")) s.step = "scan";
    return ok;
  }

  selectTarget(team: TeamId, carId: CarId): Result {
    const s = this.states[team];
    if (order(s.step) < order("scan")) return fail("attack_step_invalid", "escaneie a rede primeiro");
    if (carId !== OPPONENT_CAR[team]) return fail("forbidden", "só é possível escolher o carrinho da equipe adversária");
    s.targetCarId = carId;
    if (order(s.step) < order("target")) s.step = "target";
    return ok;
  }

  exploit(team: TeamId, ctx: ExploitContext): Result {
    const s = this.states[team];
    if (order(s.step) < order("target") || !s.targetCarId) return fail("attack_step_invalid", "escolha o alvo primeiro");
    s.exploitReport = exploitReport(ctx);
    if (order(s.step) < order("exploit")) s.step = "exploit";
    return ok;
  }

  canManipulate(team: TeamId): Result {
    const s = this.states[team];
    if (order(s.step) < order("exploit") || !s.targetCarId) {
      return fail("attack_step_invalid", "conclua a exploração primeiro");
    }
    return ok;
  }

  configure(team: TeamId, config: AttackConfig): Result {
    const r = this.canManipulate(team);
    if (!r.ok) return r;
    const s = this.states[team];
    s.config = { ...config };
    s.step = "manipulate";
    return ok;
  }

  crack(team: TeamId, targetName: string, targetUsesDefaultPassword: boolean): Result {
    const r = this.canManipulate(team);
    if (!r.ok) return r;
    this.states[team].crackReport = crackReport(targetName, targetUsesDefaultPassword);
    return ok;
  }

  disable(team: TeamId): Result {
    this.states[team].config = { ...DEFAULT_ATTACK_CONFIG };
    return ok;
  }

  configOn(carId: CarId): { team: TeamId; config: AttackConfig } | null {
    const team: TeamId = TEAM_OF_CAR[carId] === "A" ? "B" : "A";
    const s = this.states[team];
    if (s.targetCarId !== carId || !isActiveConfig(s.config)) return null;
    return { team, config: { ...s.config } };
  }

  reset(): void {
    this.states = { A: initial("A"), B: initial("B") };
  }
}
