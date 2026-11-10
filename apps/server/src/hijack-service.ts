import { timingSafeEqual } from "node:crypto";
import {
  CAR_IDS,
  type AttackView,
  type ClientMessage,
  type DefenseView,
  type ErrorCode,
  type LoginRequest,
  type Me,
  type PublicInfo,
  type PublicState,
  SINGLE_TOPOLOGY_ATTACKER,
  type SlotView,
  type TeamId,
} from "@hijack/protocol";
import { AttackManager } from "./attacks/attack-manager.ts";
import { PasswordStore, checkStrongPassword } from "./auth/password-store.ts";
import { DefenseManager, replayExample } from "./defenses/defense-manager.ts";
import { type ParticipantSession, type Session, SessionStore } from "./auth/sessions.ts";
import type { Config } from "./config/env.ts";
import { type HijackEngine, type Result, type Viewer, describeVector, fail, ok } from "./engine.ts";
import { FailureThrottle } from "./safety/throttle.ts";
import type { BrowserConn, BrowserHub } from "./ws/browser-hub.ts";

export type LoginOutcome =
  | { ok: true; session: Session }
  | { ok: false; code: ErrorCode; status: number; retryAfterMs?: number };

const sameSecret = (a: string, b: string) => {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
};

const loginThrottleOptions = { maxFailures: 5, windowMs: 60_000, baseLockMs: 15_000, maxLockMs: 5 * 60_000 };

export class HijackService {
  readonly sessions: SessionStore;
  readonly passwords: PasswordStore;
  readonly attacks = new AttackManager();
  readonly defenses = new DefenseManager();
  private readonly config: Config;
  private readonly engine: HijackEngine;
  private readonly hub: BrowserHub;
  private readonly loginThrottle = new FailureThrottle(loginThrottleOptions);
  private readonly passwordThrottle = new FailureThrottle({ ...loginThrottleOptions, maxFailures: 3 });
  private readonly sweepTimer: ReturnType<typeof setInterval>;
  private onStateChanged: () => void = () => {};

  constructor(opts: { config: Config; engine: HijackEngine; hub: BrowserHub }) {
    this.config = opts.config;
    this.engine = opts.engine;
    this.hub = opts.hub;
    this.sessions = new SessionStore(opts.config.SESSION_TTL_MS);
    this.passwords = new PasswordStore(opts.config.DATA_DIR);
    this.sweepTimer = setInterval(() => this.sweep(), 30_000);
    this.engine.setAttackResolver((carId) => ({
      effect: this.attacks.effectOn(carId),
      integrity: this.defenses.integrity(carId),
    }));
  }

  setStateChangedListener(fn: () => void): void {
    this.onStateChanged = fn;
  }

  dispose(): void {
    clearInterval(this.sweepTimer);
  }

  exportEvents() {
    return this.engine.events.all();
  }

  exportMetrics() {
    return this.engine.metrics.all();
  }

  publicInfo(): PublicInfo {
    return {
      adminAvailable: !!this.config.ADMIN_SECRET,
      topology: this.engine.topology,
      cars: CAR_IDS.map((id) => {
        const car = this.engine.car(id);
        return {
          id,
          teamId: car.teamId,
          displayName: car.displayName,
          mode: car.mode,
          defaultPasswordHint: this.passwords.isDefault(id),
          pilotTaken: !!this.sessions.slotHolder(id, "pilot"),
          hackerTaken: !!this.sessions.slotHolder(id, "hacker"),
          active: this.engine.isActive(id),
        };
      }),
    };
  }

  async login(req: LoginRequest, ip: string, currentToken: string | null): Promise<LoginOutcome> {
    if (req.role === "pilot" && !this.engine.isActive(req.carId)) return { ok: false, code: "forbidden", status: 403 };
    const keys = [`ip:${ip}`, `car:${req.carId}`];
    const locked = keys.find((k) => this.loginThrottle.isLocked(k));
    if (locked) {
      return { ok: false, code: "rate_limited", status: 429, retryAfterMs: this.loginThrottle.retryAfterMs(locked) };
    }
    const valid = await this.passwords.verify(req.carId, req.password);
    if (!valid) {
      for (const k of keys) this.loginThrottle.fail(k);
      this.engine.log({
        kind: "auth.loginFailed",
        carId: req.carId,
        teamId: this.engine.car(req.carId).teamId,
        visibility: "admin",
        message: "Tentativa de login recusada",
      });
      return { ok: false, code: "invalid_credentials", status: 401 };
    }
    const holder = this.sessions.slotHolder(req.carId, req.role);
    if (holder && holder.token !== currentToken) return { ok: false, code: "slot_taken", status: 409 };
    for (const k of keys) this.loginThrottle.succeed(k);
    if (currentToken) this.revokeTokens([currentToken], "nova entrada neste navegador");
    const session = this.sessions.createParticipant({ displayName: req.name, role: req.role, carId: req.carId });
    if (req.carDisplayName) this.engine.setDisplayName(req.carId, req.carDisplayName);
    this.engine.log({
      kind: "auth.login",
      carId: req.carId,
      teamId: session.teamId,
      actorRole: req.role,
      message: `${req.name} entrou como ${req.role === "pilot" ? "piloto" : "hacker"}`,
    });
    this.onStateChanged();
    return { ok: true, session };
  }

  adminLogin(secret: string, ip: string, currentToken: string | null): LoginOutcome {
    const key = `admin:${ip}`;
    if (!this.config.ADMIN_SECRET) return { ok: false, code: "forbidden", status: 403 };
    if (this.loginThrottle.isLocked(key)) {
      return { ok: false, code: "rate_limited", status: 429, retryAfterMs: this.loginThrottle.retryAfterMs(key) };
    }
    if (!sameSecret(secret, this.config.ADMIN_SECRET)) {
      this.loginThrottle.fail(key);
      return { ok: false, code: "invalid_credentials", status: 401 };
    }
    this.loginThrottle.succeed(key);
    if (currentToken) this.revokeTokens([currentToken], "nova entrada neste navegador");
    const session = this.sessions.createAdmin();
    this.engine.log({ kind: "auth.admin", actorRole: "admin", visibility: "admin", message: "Operador entrou" });
    return { ok: true, session };
  }

  logout(token: string | null): void {
    if (!token) return;
    this.revokeTokens([token], "saída");
  }

  sessionOf(conn: BrowserConn): Session | null {
    return this.sessions.get(conn.sessionToken);
  }

  me(session: Session | null): Me | null {
    if (!session) return null;
    if (session.kind === "admin") return { displayName: session.displayName, role: "admin", teamId: null, carId: null };
    return { displayName: session.displayName, role: session.role, teamId: session.teamId, carId: session.carId };
  }

  viewerOf(conn: BrowserConn): Viewer {
    const s = this.sessionOf(conn);
    if (!s) return { role: "spectator" };
    if (s.kind === "admin") return { role: "admin" };
    return { role: s.role, displayName: s.displayName, teamId: s.teamId, carId: s.carId };
  }

  snapshotFor(conn: BrowserConn, viewer: Viewer): PublicState {
    const session = this.sessionOf(conn);
    return this.engine.snapshot(viewer, {
      me: this.me(session),
      slots: this.slots(),
      attacks: this.attacksFor(viewer),
      defenses: this.defensesFor(viewer),
    });
  }

  onConnOpen(conn: BrowserConn): void {
    const me = this.me(this.sessionOf(conn));
    if (me) this.hub.send(conn, "session.accepted", { me });
  }

  onConnClose(conn: BrowserConn): void {
    const s = this.sessionOf(conn);
    if (!s || s.kind !== "participant" || s.role !== "pilot") return;
    const stillOpen = [...this.hub.connections()].some((c) => c !== conn && c.sessionToken === s.token);
    if (!stillOpen) this.engine.pilotStop(s.carId, "pilot-disconnected");
  }

  async handle(conn: BrowserConn, msg: ClientMessage): Promise<Result | null> {
    const session = this.sessionOf(conn);
    switch (msg.type) {
      case "session.resume":
        return ok;
      case "session.logout":
        this.logout(conn.sessionToken);
        return ok;
      case "pilot.drive": {
        const pilot = this.requireParticipant(session, "pilot");
        if (!pilot.ok) return pilot.result;
        const r = this.engine.pilotInput(pilot.session.carId, msg.payload);
        if (!r.ok) this.hub.send(conn, "pilot.commandRejected", { carId: pilot.session.carId, code: r.code });
        return null;
      }
      case "pilot.stop": {
        const pilot = this.requireParticipant(session, "pilot");
        if (!pilot.ok) return pilot.result;
        this.engine.pilotStop(pilot.session.carId, "pilot-stop");
        return null;
      }
      case "auth.changePassword": {
        const hacker = this.requireParticipant(session, "hacker");
        if (!hacker.ok) return hacker.result;
        if (!this.canDefend(hacker.session.teamId)) return this.attackerOnly();
        return this.changePassword(hacker.session, msg.payload.currentPassword, msg.payload.nextPassword);
      }
      case "attack.scan":
      case "attack.selectTarget":
      case "attack.exploitDemo":
      case "attack.configure":
      case "attack.disable": {
        const hacker = this.requireParticipant(session, "hacker");
        if (!hacker.ok) return hacker.result;
        if (!this.canAttack(hacker.session.teamId)) {
          return fail("forbidden", "na topologia de 1 carrinho a equipe A defende o Carrinho A; o ataque é da equipe B");
        }
        return this.handleAttack(hacker.session, msg);
      }
      case "defense.setIntegrityDemo":
      case "defense.setReplayDemo": {
        const hacker = this.requireParticipant(session, "hacker");
        if (!hacker.ok) return hacker.result;
        if (!this.canDefend(hacker.session.teamId)) return this.attackerOnly();
        return this.handleDefense(hacker.session, msg);
      }
      case "admin.setDemoState":
      case "admin.stopAll":
      case "admin.resetDemo":
      case "admin.setCarMode":
      case "admin.setTopology":
      case "admin.releaseSlot":
      case "sim.manualDrive": {
        if (session?.kind !== "admin") return session ? fail("forbidden", "ação restrita ao operador") : fail("unauthenticated", "entre para continuar");
        return this.handleAdmin(msg);
      }
    }
  }

  private canAttack(team: TeamId): boolean {
    return this.engine.topology === "dual" || team === SINGLE_TOPOLOGY_ATTACKER;
  }

  private canDefend(team: TeamId): boolean {
    return this.engine.topology === "dual" || team !== SINGLE_TOPOLOGY_ATTACKER;
  }

  private attackerOnly(): Result {
    return fail("forbidden", "na topologia de 1 carrinho a equipe B só ataca; a defesa é da equipe A");
  }

  private setTopology(topology: PublicState["topology"]): Result {
    const before = this.engine.topology;
    const r = this.engine.setTopology(topology);
    if (!r.ok || before === topology) return r;
    this.attacks.reset();
    const invalid = this.sessions
      .all()
      .filter((s) => s.kind === "participant" && s.role === "pilot" && !this.engine.isActive(s.carId))
      .map((s) => s.token);
    this.revokeTokens(invalid, "carrinho desativado: a demonstração passou a usar 1 carrinho");
    this.onStateChanged();
    return ok;
  }

  private handleAttack(session: ParticipantSession, msg: ClientMessage): Result {
    const team = session.teamId;
    if (msg.type === "attack.disable") {
      const was = this.attacks.view(team).active;
      const r = this.attacks.disable(team);
      if (was) this.logAttack(session, "Ataque desativado");
      this.onStateChanged();
      return r;
    }
    if (this.engine.demoState !== "running") return fail("demo_not_running", "o ataque é liberado quando a partida começar");
    let r: Result;
    switch (msg.type) {
      case "attack.scan":
        r = this.attacks.scan(team, CAR_IDS.filter((id) => this.engine.isActive(id)));
        if (r.ok) this.logAttack(session, "Varredura simulada: carrinhos cadastrados no servidor listados", "team");
        break;
      case "attack.selectTarget":
        r = this.engine.isActive(msg.payload.targetCarId)
          ? this.attacks.selectTarget(team, msg.payload.targetCarId)
          : fail("forbidden", "carrinho desativado na topologia atual");
        if (r.ok) this.logAttack(session, `Alvo escolhido: ${this.engine.car(msg.payload.targetCarId).displayName}`, "team");
        break;
      case "attack.exploitDemo": {
        const target = this.attacks.view(team).targetCarId;
        r = target
          ? this.attacks.exploit(team, {
              targetName: this.engine.car(target).displayName,
              targetUsesDefaultPassword: this.passwords.isDefault(target),
            })
          : fail("attack_step_invalid", "escolha o alvo primeiro");
        if (r.ok) this.logAttack(session, "Exploração simulada concluída", "team");
        break;
      }
      case "attack.configure": {
        const { invertThrottle, invertSteering } = msg.payload;
        r = this.attacks.configure(team, invertThrottle, invertSteering);
        if (r.ok) {
          const parts = [invertThrottle && "frente ↔ ré", invertSteering && "esquerda ↔ direita"].filter(Boolean);
          this.logAttack(session, parts.length ? `Inversão ativa: ${parts.join(" e ")}` : "Inversões desligadas");
        }
        break;
      }
      default:
        r = fail("bad_request", "ação desconhecida");
    }
    this.onStateChanged();
    return r;
  }

  private handleDefense(session: ParticipantSession, msg: ClientMessage): Result {
    const carId = session.carId;
    const base = { carId, teamId: session.teamId, actorRole: "hacker" as const };
    if (msg.type === "defense.setIntegrityDemo") {
      if (this.defenses.setIntegrity(carId, msg.payload.enabled)) {
        this.engine.log({
          ...base,
          kind: "defense.integrity",
          visibility: "staff",
          message: msg.payload.enabled
            ? "Integridade (simulada) ativada: o servidor deixa de aplicar inversões neste carrinho"
            : "Integridade (simulada) desativada",
        });
      }
    } else if (msg.type === "defense.setReplayDemo") {
      const changed = this.defenses.setReplay(carId, msg.payload.enabled);
      if (changed && !msg.payload.enabled) {
        this.engine.log({ ...base, kind: "defense.replay", visibility: "staff", message: "Proteção contra repetição (simulada) desativada" });
      }
      if (msg.payload.enabled) {
        const last = this.engine.lastMove(carId);
        const lastSeq = this.engine.car(carId).lastSeq;
        this.engine.log({
          ...base,
          kind: "defense.replay",
          visibility: "staff",
          message: replayExample({
            lastSeq: Math.max(lastSeq, 6),
            description: last ? describeVector(last.vector) : "frente",
            secondsAgo: last ? Math.max(1, Math.round((Date.now() - last.at) / 1000)) : 5,
          }),
        });
      }
    }
    this.onStateChanged();
    return ok;
  }

  private logAttack(session: ParticipantSession, message: string, visibility: "team" | "staff" = "staff"): void {
    const target = this.attacks.view(session.teamId).targetCarId;
    this.engine.log({
      kind: "attack.step",
      carId: target,
      teamId: session.teamId,
      actorRole: "hacker",
      visibility,
      message: `Equipe ${session.teamId}: ${message}`,
    });
  }

  private handleAdmin(msg: ClientMessage): Result {
    switch (msg.type) {
      case "admin.setDemoState":
        return this.engine.setDemoState(msg.payload.state);
      case "admin.stopAll":
        this.engine.stopAll("admin-stop-all");
        this.hub.broadcast("system.stopAll", { reason: msg.payload.reason || "operador" });
        return ok;
      case "admin.setCarMode":
        return this.engine.setCarMode(msg.payload.carId, msg.payload.mode);
      case "admin.setTopology":
        return this.setTopology(msg.payload.topology);
      case "admin.releaseSlot": {
        const holder = this.sessions.slotHolder(msg.payload.carId, msg.payload.role);
        if (holder) this.revokeTokens([holder.token], "vaga liberada pelo operador");
        return ok;
      }
      case "admin.resetDemo":
        return this.resetDemo(msg.payload);
      case "sim.manualDrive":
        return this.engine.manualDrive(msg.payload.carId, {
          throttle: msg.payload.throttle,
          steering: msg.payload.steering,
        });
      default:
        return fail("bad_request", "ação desconhecida");
    }
  }

  private resetDemo(flags: { resetAttacks: boolean; resetDefenses: boolean; resetPasswords: boolean }): Result {
    if (this.engine.demoState === "running") return fail("forbidden", "pause ou encerre a demonstração antes de resetar");
    this.engine.stopAll("admin-stop-all", false);
    if (flags.resetAttacks) this.attacks.reset();
    if (flags.resetDefenses) this.defenses.reset();
    if (flags.resetPasswords) {
      for (const id of CAR_IDS) this.passwords.resetToDefault(id);
      this.engine.log({ kind: "auth.passwordReset", actorRole: "admin", message: "Senhas dos carrinhos voltaram ao padrão vulnerável" });
    }
    this.engine.log({ kind: "demo.reset", actorRole: "admin", message: "Demonstração resetada pelo operador" });
    this.onStateChanged();
    return ok;
  }

  private async changePassword(session: ParticipantSession, current: string, next: string): Promise<Result> {
    const key = `pw:${session.token}`;
    if (this.passwordThrottle.isLocked(key)) return fail("rate_limited", "muitas tentativas; aguarde");
    if (!(await this.passwords.verify(session.carId, current))) {
      this.passwordThrottle.fail(key);
      return fail("invalid_credentials", "senha atual incorreta");
    }
    if (checkStrongPassword(next, current)) {
      return fail("weak_password", "use ao menos 8 caracteres, com letras e números, diferente da atual");
    }
    this.passwordThrottle.succeed(key);
    await this.passwords.change(session.carId, next);
    const revoked = this.sessions
      .all()
      .filter((s) => s.kind === "participant" && s.carId === session.carId && s.role === "pilot")
      .map((s) => s.token);
    this.revokeTokens(revoked, "senha do carrinho alterada; entre novamente com a nova senha");
    this.engine.stopCar(session.carId, "session-revoked");
    this.engine.log({
      kind: "defense.password",
      carId: session.carId,
      teamId: session.teamId,
      actorRole: "hacker",
      message: "Senha padrão substituída por uma senha forte",
    });
    this.onStateChanged();
    return ok;
  }

  private requireParticipant(
    session: Session | null,
    role: "pilot" | "hacker",
  ): { ok: true; session: ParticipantSession } | { ok: false; result: Result } {
    if (!session) return { ok: false, result: fail("unauthenticated", "entre para continuar") };
    if (session.kind !== "participant" || session.role !== role) {
      return { ok: false, result: fail("forbidden", "ação não permitida para o seu papel") };
    }
    return { ok: true, session };
  }

  private revokeTokens(tokens: string[], reason: string): void {
    if (tokens.length === 0) return;
    const set = new Set(tokens);
    for (const t of tokens) {
      const s = this.sessions.revoke(t);
      if (s?.kind === "participant" && s.role === "pilot") this.engine.pilotStop(s.carId, "session-revoked");
    }
    for (const conn of this.hub.connections()) {
      if (conn.sessionToken && set.has(conn.sessionToken)) {
        this.hub.send(conn, "session.revoked", { reason });
        conn.sessionToken = null;
      }
    }
    this.onStateChanged();
  }

  private sweep(): void {
    const expired = this.sessions.sweepExpired();
    for (const s of expired) {
      if (s.kind === "participant" && s.role === "pilot") this.engine.pilotStop(s.carId, "session-revoked");
    }
    if (expired.length) {
      const tokens = new Set(expired.map((s) => s.token));
      for (const conn of this.hub.connections()) {
        if (conn.sessionToken && tokens.has(conn.sessionToken)) {
          this.hub.send(conn, "session.revoked", { reason: "sessão expirada" });
          conn.sessionToken = null;
        }
      }
      this.onStateChanged();
    }
  }

  private slots(): SlotView[] {
    return CAR_IDS.map((carId) => ({
      carId,
      pilot: this.sessions.slotHolder(carId, "pilot")?.displayName ?? null,
      hacker: this.sessions.slotHolder(carId, "hacker")?.displayName ?? null,
    }));
  }

  private attacksFor(viewer: Viewer): AttackView[] {
    if (viewer.role === "admin" || viewer.role === "spectator") return this.attacks.all().filter((a) => this.canAttack(a.attackerTeam));
    if (viewer.role === "hacker") return this.canAttack(viewer.teamId) ? [this.attacks.view(viewer.teamId)] : [];
    return [];
  }

  private defensesFor(viewer: Viewer): DefenseView[] {
    const all = this.defenses.all((carId) => !this.passwords.isDefault(carId));
    if (viewer.role === "admin" || viewer.role === "spectator") return all;
    if (viewer.role === "hacker") return this.canDefend(viewer.teamId) ? all.filter((d) => d.carId === viewer.carId) : [];
    return [];
  }
}
