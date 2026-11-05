import type { CarId, CarMode, EventLogEntry, Role, TeamId } from "@hijack/protocol";

export type EventVisibility = "public" | "team" | "admin";

export interface StoredEvent extends EventLogEntry {
  visibility: EventVisibility;
}

export interface NewEvent {
  kind: string;
  message: string;
  carId?: CarId | null;
  teamId?: TeamId | null;
  actorRole?: Role | null;
  mode?: CarMode | null;
  visibility?: EventVisibility;
}

export class EventLog {
  private readonly entries: StoredEvent[] = [];
  private nextId = 1;
  private readonly max: number;
  private readonly now: () => number;

  constructor(max: number, now: () => number = Date.now) {
    this.max = max;
    this.now = now;
  }

  add(e: NewEvent): StoredEvent {
    const entry: StoredEvent = {
      id: this.nextId++,
      at: this.now(),
      kind: e.kind,
      message: e.message,
      carId: e.carId ?? null,
      teamId: e.teamId ?? null,
      actorRole: e.actorRole ?? null,
      mode: e.mode ?? null,
      visibility: e.visibility ?? "public",
    };
    this.entries.push(entry);
    if (this.entries.length > this.max) this.entries.splice(0, this.entries.length - this.max);
    return entry;
  }

  latest(limit: number, filter: (e: StoredEvent) => boolean = () => true): EventLogEntry[] {
    const out: EventLogEntry[] = [];
    for (let i = this.entries.length - 1; i >= 0 && out.length < limit; i--) {
      const e = this.entries[i];
      if (e && filter(e)) {
        const { visibility: _v, ...pub } = e;
        out.push(pub);
      }
    }
    return out;
  }

  all(): readonly StoredEvent[] {
    return this.entries;
  }

  clear(): void {
    this.entries.length = 0;
  }
}
