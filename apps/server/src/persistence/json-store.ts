import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import path from "node:path";

export class JsonFileStore<T extends object> {
  private readonly file: string;

  constructor(dir: string, name: string) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    this.file = path.join(dir, name);
  }

  read(): Partial<T> | null {
    if (!existsSync(this.file)) return null;
    try {
      return JSON.parse(readFileSync(this.file, "utf8")) as Partial<T>;
    } catch {
      return null;
    }
  }

  write(data: T): void {
    const tmp = `${this.file}.tmp`;
    writeFileSync(tmp, JSON.stringify(data, null, 2), { mode: 0o600 });
    renameSync(tmp, this.file);
    chmodSync(this.file, 0o600);
  }
}
