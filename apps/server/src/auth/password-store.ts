import { CAR_IDS, type CarId, DEFAULT_CAR_PASSWORD, MIN_STRONG_PASSWORD_LENGTH } from "@hijack/protocol";
import { JsonFileStore } from "../persistence/json-store.ts";

interface CarCredential {
  hash: string;
  isDefault: boolean;
  changedAt: number | null;
}

interface PersistedState {
  version: 1;
  cars: Record<CarId, CarCredential>;
}

export type PasswordPolicyError = "weak_password";

const defaultCredential = (): CarCredential => ({
  hash: Bun.password.hashSync(DEFAULT_CAR_PASSWORD, { algorithm: "argon2id" }),
  isDefault: true,
  changedAt: null,
});

export function checkStrongPassword(next: string, current: string): PasswordPolicyError | null {
  if (next.length < MIN_STRONG_PASSWORD_LENGTH) return "weak_password";
  if (next === DEFAULT_CAR_PASSWORD || next === current) return "weak_password";
  if (!/[A-Za-zÀ-ÿ]/.test(next) || !/\d/.test(next)) return "weak_password";
  if (/^(.)\1+$/.test(next)) return "weak_password";
  return null;
}

export class PasswordStore {
  private readonly store: JsonFileStore<PersistedState>;
  private state: PersistedState;

  constructor(dataDir: string) {
    this.store = new JsonFileStore<PersistedState>(dataDir, "state.json");
    const loaded = this.store.read();
    const cars = {} as Record<CarId, CarCredential>;
    for (const id of CAR_IDS) {
      const c = loaded?.cars?.[id];
      cars[id] = c && typeof c.hash === "string" ? c : defaultCredential();
    }
    this.state = { version: 1, cars };
    this.store.write(this.state);
  }

  async verify(carId: CarId, password: string): Promise<boolean> {
    try {
      return await Bun.password.verify(password, this.state.cars[carId].hash);
    } catch {
      return false;
    }
  }

  isDefault(carId: CarId): boolean {
    return this.state.cars[carId].isDefault;
  }

  async change(carId: CarId, next: string): Promise<void> {
    const hash = await Bun.password.hash(next, { algorithm: "argon2id" });
    this.state.cars[carId] = { hash, isDefault: false, changedAt: Date.now() };
    this.store.write(this.state);
  }

  resetToDefault(carId: CarId): void {
    this.state.cars[carId] = defaultCredential();
    this.store.write(this.state);
  }
}
