import { CAR_IDS, type CarId, type DefenseView } from "@hijack/protocol";

interface DefenseState {
  integrityDemoEnabled: boolean;
  replayDemoEnabled: boolean;
}

const initial = (): Record<CarId, DefenseState> => ({
  "car-a": { integrityDemoEnabled: false, replayDemoEnabled: false },
  "car-b": { integrityDemoEnabled: false, replayDemoEnabled: false },
});

export class DefenseManager {
  private states = initial();

  integrity(carId: CarId): boolean {
    return this.states[carId].integrityDemoEnabled;
  }

  replay(carId: CarId): boolean {
    return this.states[carId].replayDemoEnabled;
  }

  setIntegrity(carId: CarId, enabled: boolean): boolean {
    const changed = this.states[carId].integrityDemoEnabled !== enabled;
    this.states[carId].integrityDemoEnabled = enabled;
    return changed;
  }

  setReplay(carId: CarId, enabled: boolean): boolean {
    const changed = this.states[carId].replayDemoEnabled !== enabled;
    this.states[carId].replayDemoEnabled = enabled;
    return changed;
  }

  view(carId: CarId, strongPasswordEnabled: boolean): DefenseView {
    const s = this.states[carId];
    return {
      carId,
      strongPasswordEnabled,
      integrityDemoEnabled: s.integrityDemoEnabled,
      replayDemoEnabled: s.replayDemoEnabled,
      level: [strongPasswordEnabled, s.integrityDemoEnabled, s.replayDemoEnabled].filter(Boolean).length,
    };
  }

  all(strong: (carId: CarId) => boolean): DefenseView[] {
    return CAR_IDS.map((id) => this.view(id, strong(id)));
  }

  reset(): void {
    this.states = initial();
  }
}

export function replayExample(input: { lastSeq: number; description: string; secondsAgo: number }): string {
  const oldSeq = Math.max(1, input.lastSeq - 5);
  return `Repetição (simulada): o comando antigo nº ${oldSeq} (${input.description}, de ${input.secondsAgo} s atrás) foi reapresentado e recusado porque não é mais recente que o último aceito (nº ${input.lastSeq}). Nenhum movimento foi gerado.`;
}
