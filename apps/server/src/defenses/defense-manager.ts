import { CAR_IDS, type CarId, type DefenseView } from "@hijack/protocol";

interface DefenseState {
  integrityDemoEnabled: boolean;
  replayDemoEnabled: boolean;
  encryptionDemoEnabled: boolean;
}

const fresh = (): DefenseState => ({
  integrityDemoEnabled: false,
  replayDemoEnabled: false,
  encryptionDemoEnabled: false,
});

const initial = (): Record<CarId, DefenseState> => ({ "car-a": fresh(), "car-b": fresh() });

export class DefenseManager {
  private states = initial();

  integrity(carId: CarId): boolean {
    return this.states[carId].integrityDemoEnabled;
  }

  replay(carId: CarId): boolean {
    return this.states[carId].replayDemoEnabled;
  }

  encryption(carId: CarId): boolean {
    return this.states[carId].encryptionDemoEnabled;
  }

  setIntegrity(carId: CarId, enabled: boolean): boolean {
    return this.set(carId, "integrityDemoEnabled", enabled);
  }

  setReplay(carId: CarId, enabled: boolean): boolean {
    return this.set(carId, "replayDemoEnabled", enabled);
  }

  setEncryption(carId: CarId, enabled: boolean): boolean {
    return this.set(carId, "encryptionDemoEnabled", enabled);
  }

  view(carId: CarId, strongPasswordEnabled: boolean): DefenseView {
    const s = this.states[carId];
    return {
      carId,
      strongPasswordEnabled,
      integrityDemoEnabled: s.integrityDemoEnabled,
      replayDemoEnabled: s.replayDemoEnabled,
      encryptionDemoEnabled: s.encryptionDemoEnabled,
      level: [strongPasswordEnabled, s.integrityDemoEnabled, s.replayDemoEnabled, s.encryptionDemoEnabled].filter(
        Boolean,
      ).length,
    };
  }

  all(strong: (carId: CarId) => boolean): DefenseView[] {
    return CAR_IDS.map((id) => this.view(id, strong(id)));
  }

  reset(): void {
    this.states = initial();
  }

  private set(carId: CarId, key: keyof DefenseState, enabled: boolean): boolean {
    const changed = this.states[carId][key] !== enabled;
    this.states[carId][key] = enabled;
    return changed;
  }
}

export function replayExample(input: { lastSeq: number; description: string; secondsAgo: number }): string {
  const oldSeq = Math.max(1, input.lastSeq - 5);
  return `Repetição (simulada): o comando antigo nº ${oldSeq} (${input.description}, de ${input.secondsAgo} s atrás) foi reapresentado e recusado porque não é mais recente que o último aceito (nº ${input.lastSeq}). Nenhum movimento foi gerado.`;
}

export function scramble(text: string): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let h = 2166136261;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    h = Math.imul(h ^ text.charCodeAt(i), 16777619) >>> 0;
    out += alphabet[h % alphabet.length];
  }
  return out;
}
