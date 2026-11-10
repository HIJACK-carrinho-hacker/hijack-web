import {
  ATTACK_STEPS,
  type AttackView,
  CAR_IDS,
  type CarId,
  OPPONENT_CAR,
  TEAM_IDS,
  TEAM_OF_CAR,
  type TeamId,
} from "@hijack/protocol";
import type { AttackEffect } from "../control/pipeline.ts";
import { type Result, fail, ok } from "../engine.ts";

type Step = AttackView["step"];

const order = (s: Step) => ATTACK_STEPS.indexOf(s);

const initial = (attackerTeam: TeamId): AttackView => ({
  attackerTeam,
  step: "locked",
  scanResults: [],
  targetCarId: null,
  exploitReport: null,
  invertThrottle: false,
  invertSteering: false,
  active: false,
});

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

export class AttackManager {
  private states: Record<TeamId, AttackView> = { A: initial("A"), B: initial("B") };

  view(team: TeamId): AttackView {
    const s = this.states[team];
    return { ...s, scanResults: [...s.scanResults] };
  }

  all(): AttackView[] {
    return TEAM_IDS.map((t) => this.view(t));
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

  configure(team: TeamId, invertThrottle: boolean, invertSteering: boolean): Result {
    const s = this.states[team];
    if (order(s.step) < order("exploit")) return fail("attack_step_invalid", "conclua a exploração primeiro");
    s.invertThrottle = invertThrottle;
    s.invertSteering = invertSteering;
    s.active = invertThrottle || invertSteering;
    s.step = "manipulate";
    return ok;
  }

  disable(team: TeamId): Result {
    const s = this.states[team];
    s.invertThrottle = false;
    s.invertSteering = false;
    s.active = false;
    return ok;
  }

  effectOn(carId: CarId): AttackEffect | null {
    const attacker = this.states[TEAM_OF_CAR[carId] === "A" ? "B" : "A"];
    if (!attacker.active || attacker.targetCarId !== carId) return null;
    return { invertThrottle: attacker.invertThrottle, invertSteering: attacker.invertSteering };
  }

  reset(): void {
    this.states = { A: initial("A"), B: initial("B") };
  }
}
