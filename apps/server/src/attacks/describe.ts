import type { AttackConfig } from "@hijack/protocol";

export interface ConfigChange {
  message: string;
  visibility: "team" | "staff";
}

const side = (bias: number) => (bias > 0 ? `${bias}% para a direita` : `${-bias}% para a esquerda`);

export function describeConfigChanges(prev: AttackConfig, next: AttackConfig, targetName: string): ConfigChange[] {
  const out: ConfigChange[] = [];
  const staff = (message: string) => out.push({ message, visibility: "staff" });
  const team = (message: string) => out.push({ message, visibility: "team" });
  if (prev.invertThrottle !== next.invertThrottle || prev.invertSteering !== next.invertSteering) {
    const parts = [next.invertThrottle && "frente ↔ ré", next.invertSteering && "esquerda ↔ direita"].filter(Boolean);
    staff(parts.length ? `Inversão ativa: ${parts.join(" e ")}` : "Inversões desligadas");
  }
  if (prev.steeringBias !== next.steeringBias) {
    staff(next.steeringBias === 0 ? "Viés de direção desligado" : `Viés de direção: ${side(next.steeringBias)}`);
  }
  if (prev.lockSteering !== next.lockSteering) {
    staff(next.lockSteering ? "Direção travada na posição atual" : "Direção destravada");
  }
  if (prev.delayMs !== next.delayMs) {
    staff(next.delayMs === 0 ? "Atraso de comandos desligado" : `Atraso de ${next.delayMs} ms nos comandos`);
  }
  if (prev.dropPct !== next.dropPct) {
    staff(next.dropPct === 0 ? "Perda de pacotes desligada" : `Perda de pacotes: ${next.dropPct}% do tempo, em rajadas de 0,5 s`);
  }
  if (prev.replay !== next.replay) {
    staff(next.replay ? "Replay ligado: o carrinho repete o que o piloto fez 5 s antes" : "Replay desligado");
  }
  if (prev.intercept !== next.intercept) {
    team(next.intercept ? `Interceptação ligada: tráfego do ${targetName} visível ao atacante` : "Interceptação desligada");
  }
  if (prev.spoofTelemetry !== next.spoofTelemetry) {
    team(
      next.spoofTelemetry
        ? "Telemetria falsa ligada: o defensor vê o carrinho obedecendo o piloto"
        : "Telemetria falsa desligada",
    );
  }
  if (prev.hijack !== next.hijack) {
    staff(next.hijack ? `Sequestro: o atacante assumiu o controle do ${targetName}` : `Sequestro encerrado: o ${targetName} voltou ao piloto`);
  }
  return out;
}
