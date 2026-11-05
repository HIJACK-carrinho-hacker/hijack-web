import { randomBytes } from "node:crypto";
import { type CarId, TEAM_OF_CAR, type TeamId } from "@hijack/protocol";

export type ParticipantRole = "pilot" | "hacker";

export interface ParticipantSession {
  kind: "participant";
  token: string;
  displayName: string;
  role: ParticipantRole;
  carId: CarId;
  teamId: TeamId;
  createdAt: number;
  expiresAt: number;
}

export interface AdminSession {
  kind: "admin";
  token: string;
  displayName: string;
  createdAt: number;
  expiresAt: number;
}

export type Session = ParticipantSession | AdminSession;

export const SESSION_COOKIE = "hijack_session";

const newToken = () => randomBytes(32).toString("base64url");

export class SessionStore {
  private readonly sessions = new Map<string, Session>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(ttlMs: number, now: () => number = Date.now) {
    this.ttlMs = ttlMs;
    this.now = now;
  }

  get(token: string | null | undefined): Session | null {
    if (!token) return null;
    const s = this.sessions.get(token);
    if (!s) return null;
    if (s.expiresAt <= this.now()) return null;
    return s;
  }

  slotHolder(carId: CarId, role: ParticipantRole): ParticipantSession | null {
    for (const s of this.sessions.values()) {
      if (s.kind === "participant" && s.carId === carId && s.role === role && s.expiresAt > this.now()) return s;
    }
    return null;
  }

  createParticipant(input: { displayName: string; role: ParticipantRole; carId: CarId }): ParticipantSession {
    const at = this.now();
    const s: ParticipantSession = {
      kind: "participant",
      token: newToken(),
      displayName: input.displayName,
      role: input.role,
      carId: input.carId,
      teamId: TEAM_OF_CAR[input.carId],
      createdAt: at,
      expiresAt: at + this.ttlMs,
    };
    this.sessions.set(s.token, s);
    return s;
  }

  createAdmin(): AdminSession {
    const at = this.now();
    const s: AdminSession = { kind: "admin", token: newToken(), displayName: "Operador", createdAt: at, expiresAt: at + this.ttlMs };
    this.sessions.set(s.token, s);
    return s;
  }

  revoke(token: string): Session | null {
    const s = this.sessions.get(token) ?? null;
    this.sessions.delete(token);
    return s;
  }

  revokeWhere(pred: (s: Session) => boolean): Session[] {
    const out: Session[] = [];
    for (const [token, s] of this.sessions) {
      if (pred(s)) {
        this.sessions.delete(token);
        out.push(s);
      }
    }
    return out;
  }

  sweepExpired(): Session[] {
    const at = this.now();
    return this.revokeWhere((s) => s.expiresAt <= at);
  }

  all(): Session[] {
    return [...this.sessions.values()];
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(value);
    } catch {
      out[key] = value;
    }
  }
  return out;
}
