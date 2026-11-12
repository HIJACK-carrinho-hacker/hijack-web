import {
  CAR_IDS,
  type CarId,
  type CarMode,
  type CarView,
  CONFIRMED_STALE_MS,
  type DemoState,
  type DemoTopology,
  type DriveVector,
  type ErrorCode,
  MAX_DEVICE_COMMANDS_PER_SECOND,
  type PublicState,
  SINGLE_TOPOLOGY_CAR,
  STOP_REASONS,
  type StopReason,
  TEAM_OF_CAR,
  type Role,
  type TeamId,
} from "@hijack/protocol";
import { OfflineHardwareAdapter } from "./adapters/offline-adapter.ts";
import { SimulatorAdapter } from "./adapters/simulator/simulator-adapter.ts";
import type { Config } from "./config/env.ts";
import { CarController } from "./control/car-controller.ts";
import { type AttackEffect, type PipelineResult, applyAttack, isNeutral } from "./control/pipeline.ts";
import { DEMO_STATE_LABEL, allowsMovement, canTransition } from "./demo/demo-state.ts";
import { type Clock, type DeviceAdapter, type DeviceEvent, systemClock } from "./devices/types.ts";
import { EventLog, type NewEvent, type StoredEvent } from "./telemetry/event-log.ts";
import { MetricsRegistry } from "./telemetry/metrics.ts";

export type Viewer =
  | { role: "spectator" }
  | { role: "admin" }
  | { role: "pilot" | "hacker"; displayName: string; teamId: TeamId; carId: CarId };

export type Result = { ok: true } | { ok: false; code: ErrorCode; message: string };

export const ok: Result = { ok: true };
export const fail = (code: ErrorCode, message: string): Result => ({ ok: false, code, message });

export type AdapterFactory = (carId: CarId, mode: CarMode) => DeviceAdapter;

export interface EngineOptions {
  config: Config;
  clock?: Clock;
  adapterFactory?: AdapterFactory;
}

interface CarRuntime {
  id: CarId;
  teamId: TeamId;
  displayName: string;
  mode: CarMode;
  controller: CarController;
  unsubscribe: () => void;
  confirmed: DriveVector;
  confirmedStale: boolean;
  online: boolean;
  lastSeenAt: number | null;
  uptimeMs: number | null;
  rssi: number | null;
  reconnects: number;
  rejectedCommands: number;
  lastSeq: number;
  watchdogTrips: number;
  stopFromDevice: boolean;
  lastTransformKey: string | null;
  requested: DriveVector;
  lastMove: { vector: DriveVector; at: number } | null;
}

export const SIM_START: Record<CarId, { x: number; y: number; heading: number }> = {
  "car-a": { x: 0.3, y: 0.7, heading: -Math.PI / 2 },
  "car-b": { x: 0.7, y: 0.7, heading: -Math.PI / 2 },
};

export const defaultAdapterFactory: AdapterFactory = (carId, mode) =>
  mode === "simulated" ? new SimulatorAdapter(carId, { start: SIM_START[carId] }) : new OfflineHardwareAdapter(carId);

const toStopReason = (reason: string): StopReason =>
  (STOP_REASONS as readonly string[]).includes(reason) ? (reason as StopReason) : "fault";

export class HijackEngine {
  readonly events: EventLog;
  readonly metrics = new MetricsRegistry();
  private readonly clock: Clock;
  private readonly config: Config;
  private readonly adapterFactory: AdapterFactory;
  private readonly cars = new Map<CarId, CarRuntime>();
  private readonly listeners = new Set<() => void>();
  private readonly releaseRequired = new Set<CarId>();
  private readonly tickTimer: ReturnType<typeof setInterval>;
  private demo: DemoState = "setup";
  private topologyValue: DemoTopology;
  private rev = 0;
  private attackEffectFor: (carId: CarId) => { effect: AttackEffect | null; integrity: boolean } = () => ({
    effect: null,
    integrity: false,
  });

  constructor(opts: EngineOptions) {
    this.config = opts.config;
    this.clock = opts.clock ?? systemClock;
    this.adapterFactory = opts.adapterFactory ?? defaultAdapterFactory;
    this.events = new EventLog(opts.config.MAX_EVENTS);
    this.topologyValue = opts.config.DEMO_TOPOLOGY;
    const modes: Record<CarId, CarMode> = { "car-a": opts.config.CAR_A_MODE, "car-b": opts.config.CAR_B_MODE };
    for (const id of CAR_IDS) this.cars.set(id, this.createRuntime(id, modes[id]));
    this.tickTimer = setInterval(() => this.tick(), 50);
    this.log({ kind: "server.start", message: "Servidor iniciado; carrinhos parados" });
  }

  get demoState(): DemoState {
    return this.demo;
  }

  get topology(): DemoTopology {
    return this.topologyValue;
  }

  isActive(carId: CarId): boolean {
    return this.topologyValue === "dual" || carId === SINGLE_TOPOLOGY_CAR;
  }

  setTopology(next: DemoTopology): Result {
    if (this.demo === "running") return fail("forbidden", "pause ou encerre a demonstração antes de trocar a topologia");
    if (next === this.topologyValue) return ok;
    this.stopAll("admin-stop-all", false);
    this.releaseRequired.clear();
    this.topologyValue = next;
    this.log({
      kind: "demo.topology",
      actorRole: "admin",
      message: next === "single" ? "Topologia: 1 carrinho (Carrinho A)" : "Topologia: 2 carrinhos",
    });
    this.changed();
    return ok;
  }

  get revision(): number {
    return this.rev;
  }

  onChange(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  setAttackResolver(fn: (carId: CarId) => { effect: AttackEffect | null; integrity: boolean }): void {
    this.attackEffectFor = fn;
  }

  car(carId: CarId): Readonly<CarRuntime> {
    return this.mustCar(carId);
  }

  setDemoState(next: DemoState, actorRole: Role = "admin"): Result {
    if (next === this.demo) return ok;
    if (!canTransition(this.demo, next)) {
      return fail("bad_request", `transição inválida: ${this.demo} → ${next}`);
    }
    const prev = this.demo;
    this.demo = next;
    if (next !== "running" && next !== "paused") this.releaseRequired.clear();
    if (!allowsMovement(next)) this.stopAll("demo-not-running", false, next === "setup" || next === "ready");
    this.log({
      kind: "demo.state",
      actorRole,
      message: `Demonstração: ${DEMO_STATE_LABEL[prev]} → ${DEMO_STATE_LABEL[next]}`,
    });
    this.changed();
    return ok;
  }

  stopAll(reason: StopReason = "admin-stop-all", logIt = true, recordReason = false): void {
    for (const car of this.cars.values()) car.controller.stop(reason, recordReason);
    if (logIt) this.log({ kind: "safety.stopAll", actorRole: "admin", message: "STOP geral acionado" });
    this.changed();
  }

  emergencyStop(): void {
    this.stopAll("admin-stop-all", true, this.demo === "running" || this.demo === "paused");
    if (this.demo === "running") this.setDemoState("paused");
  }

  stopCar(carId: CarId, reason: StopReason): void {
    this.mustCar(carId).controller.stop(reason);
  }

  setCarMode(carId: CarId, mode: CarMode): Result {
    const car = this.mustCar(carId);
    if (car.mode === mode) return ok;
    if (this.demo === "running") return fail("forbidden", "pause a demonstração antes de trocar o modo");
    car.controller.stop("mode-change");
    this.releaseRequired.delete(carId);
    car.unsubscribe();
    car.controller.device.dispose();
    const adapter = this.adapterFactory(carId, mode);
    car.controller.replaceAdapter(adapter);
    car.mode = mode;
    car.online = adapter.isOnline();
    car.confirmed = { throttle: 0, steering: 0 };
    car.confirmedStale = false;
    car.lastSeenAt = car.online ? this.clock.now() : null;
    car.unsubscribe = adapter.onEvent((e) => this.onDeviceEvent(car, e));
    this.log({ kind: "car.mode", carId, mode, actorRole: "admin", message: `Modo alterado para ${mode === "simulated" ? "simulado" : "hardware"}` });
    this.changed();
    return ok;
  }

  attachAdapter(carId: CarId, adapter: DeviceAdapter): void {
    const car = this.mustCar(carId);
    car.controller.stop("mode-change");
    car.unsubscribe();
    car.controller.device.dispose();
    car.controller.replaceAdapter(adapter);
    car.mode = adapter.mode;
    car.online = adapter.isOnline();
    car.confirmedStale = false;
    car.lastSeenAt = car.online ? this.clock.now() : null;
    car.unsubscribe = adapter.onEvent((e) => this.onDeviceEvent(car, e));
    this.changed();
  }

  manualDrive(carId: CarId, vec: DriveVector): Result {
    const car = this.mustCar(carId);
    if (!this.isActive(carId)) return fail("forbidden", "carrinho desativado na topologia atual");
    if (car.mode !== "simulated") return fail("forbidden", "teste manual só em carrinho simulado");
    if (this.demo === "running") return fail("forbidden", "teste manual indisponível durante a demonstração");
    if (!car.online) return fail("car_offline", "carrinho offline");
    this.metrics.inc(carId, car.mode, "received");
    this.trackRequest(car, vec);
    car.controller.command(vec);
    return ok;
  }

  pilotInput(carId: CarId, input: DriveVector & { pressed: boolean }): Result {
    const car = this.mustCar(carId);
    this.metrics.inc(carId, car.mode, "received");
    if (!input.pressed || isNeutral(input)) {
      this.releaseRequired.delete(carId);
      car.lastTransformKey = null;
      car.controller.stop("pilot-release");
      return ok;
    }
    if (!this.isActive(carId)) {
      car.controller.stop("pilot-stop");
      this.metrics.inc(carId, car.mode, "rejected");
      return fail("forbidden", "carrinho desativado na topologia atual");
    }
    if (!allowsMovement(this.demo)) {
      if (this.demo === "paused") this.releaseRequired.add(carId);
      car.controller.stop("demo-not-running");
      this.metrics.inc(carId, car.mode, "rejected");
      return fail("demo_not_running", "a demonstração não está em andamento");
    }
    if (this.releaseRequired.has(carId)) {
      this.metrics.inc(carId, car.mode, "rejected");
      return fail("release_required", "solte o joystick e toque de novo para voltar a mover");
    }
    if (!car.online) {
      this.metrics.inc(carId, car.mode, "rejected");
      return fail("car_offline", "carrinho offline");
    }
    const requested = { throttle: input.throttle, steering: input.steering };
    const { effect, integrity } = this.attackEffectFor(carId);
    const result = applyAttack(requested, effect, integrity);
    if (result.transformed) this.metrics.inc(carId, car.mode, "transformed");
    if (result.blocked) this.metrics.inc(carId, car.mode, "blocked");
    this.logTransform(car, requested, result);
    this.trackRequest(car, requested);
    car.controller.command(result.output);
    return ok;
  }

  pilotStop(carId: CarId, reason: StopReason = "pilot-stop"): void {
    this.releaseRequired.delete(carId);
    this.mustCar(carId).controller.stop(reason);
  }

  log(e: NewEvent): StoredEvent {
    const entry = this.events.add(e);
    this.changed();
    return entry;
  }

  snapshot(viewer: Viewer, extra: Partial<Pick<PublicState, "slots" | "attacks" | "defenses" | "me">> = {}): PublicState {
    const cars = [...this.cars.values()].map((c) => this.carView(c, viewer.role === "pilot"));
    const canSeeAll = viewer.role === "admin" || viewer.role === "spectator";
    const eventFilter = (e: StoredEvent) => {
      if (viewer.role === "admin") return true;
      if (e.visibility === "public") return true;
      if (viewer.role === "pilot") return false;
      if (e.visibility === "staff") return true;
      if (e.visibility === "team" && viewer.role === "hacker") return e.teamId === viewer.teamId;
      return false;
    };
    return {
      demoState: this.demo,
      topology: this.topologyValue,
      me: extra.me ?? null,
      cars,
      slots: extra.slots ?? [],
      attacks: extra.attacks ?? [],
      defenses: extra.defenses ?? [],
      events: this.events.latest(canSeeAll ? 60 : 30, eventFilter),
      metrics: viewer.role === "admin" || viewer.role === "spectator"
        ? cars.map((c) => this.metrics.snapshot(c.id, c.mode))
        : [],
    };
  }

  dispose(): void {
    clearInterval(this.tickTimer);
    for (const car of this.cars.values()) {
      car.controller.stop("server-restart");
      car.controller.dispose();
      car.unsubscribe();
      car.controller.device.dispose();
    }
    this.listeners.clear();
  }

  private carView(c: CarRuntime, redact = false): CarView {
    const pose = c.controller.device.pose();
    const hidden = { throttle: 0, steering: 0 } as const;
    return {
      id: c.id,
      teamId: c.teamId,
      displayName: c.displayName,
      mode: c.mode,
      active: this.isActive(c.id),
      requested: redact || !c.controller.moving ? { ...hidden } : { ...c.requested },
      desired: redact ? { ...hidden } : c.controller.desired,
      confirmed: redact ? { ...hidden } : { ...c.confirmed },
      confirmedStale: redact ? false : c.confirmedStale,
      moving: c.controller.moving,
      stopReason: c.controller.stopReason,
      telemetry: {
        online: c.online,
        lastSeenAt: c.lastSeenAt,
        uptimeMs: c.uptimeMs,
        rssi: c.rssi,
        reconnects: c.reconnects,
        rejectedCommands: c.rejectedCommands,
        lastSeq: c.lastSeq,
        watchdogTrips: c.watchdogTrips,
      },
      sim: pose ? { x: round3(pose.x), y: round3(pose.y), heading: round3(pose.heading) } : null,
    };
  }

  setDisplayName(carId: CarId, name: string): void {
    this.mustCar(carId).displayName = name;
    this.changed();
  }

  private createRuntime(id: CarId, mode: CarMode): CarRuntime {
    const adapter = this.adapterFactory(id, mode);
    const runtime = {
      id,
      teamId: TEAM_OF_CAR[id],
      displayName: id === "car-a" ? "Carrinho A" : "Carrinho B",
      mode,
      confirmed: { throttle: 0, steering: 0 },
      confirmedStale: false,
      online: adapter.isOnline(),
      lastSeenAt: null,
      uptimeMs: null,
      rssi: null,
      reconnects: 0,
      rejectedCommands: 0,
      lastSeq: 0,
      watchdogTrips: 0,
      stopFromDevice: false,
      lastTransformKey: null,
      requested: { throttle: 0, steering: 0 },
      lastMove: null,
      unsubscribe: () => {},
    } as Omit<CarRuntime, "controller"> as CarRuntime;
    runtime.controller = new CarController(
      id,
      adapter,
      { ttlMs: this.config.COMMAND_TTL_MS, maxCommandsPerSecond: MAX_DEVICE_COMMANDS_PER_SECOND, clock: this.clock },
      {
        onSent: ({ seq, at }) => this.metrics.recordSend(id, runtime.mode, seq, at),
        onStopped: (reason) => {
          runtime.lastTransformKey = null;
          if (reason === "watchdog" && !runtime.stopFromDevice) {
            this.metrics.inc(id, runtime.mode, "watchdogTrips");
            this.log({ kind: "safety.watchdog", carId: id, mode: runtime.mode, message: "Watchdog do servidor parou a tração" });
          }
        },
        onChange: () => this.changed(),
      },
    );
    runtime.unsubscribe = adapter.onEvent((e) => this.onDeviceEvent(runtime, e));
    return runtime;
  }

  private onDeviceEvent(car: CarRuntime, e: DeviceEvent): void {
    switch (e.kind) {
      case "ack":
        if (e.seq >= car.controller.lastStopSeq) car.confirmed = { throttle: e.throttle, steering: e.steering };
        car.lastSeenAt = e.at;
        car.lastSeq = e.seq;
        this.metrics.inc(car.id, car.mode, "applied");
        this.metrics.recordAck(car.id, car.mode, e.seq, e.at);
        break;
      case "telemetry":
        car.lastSeenAt = e.at;
        car.uptimeMs = e.telemetry.uptimeMs;
        car.rssi = e.telemetry.rssi;
        car.lastSeq = e.telemetry.lastSeq;
        car.reconnects = e.telemetry.reconnects;
        car.rejectedCommands = e.telemetry.rejectedCommands;
        car.watchdogTrips = e.telemetry.watchdogTrips;
        if (e.telemetry.lastSeq >= car.controller.lastStopSeq) {
          car.confirmed = { throttle: e.telemetry.throttle, steering: e.telemetry.steering };
        }
        break;
      case "connection":
        car.online = e.online;
        car.lastSeenAt = e.at;
        if (!e.online) {
          this.metrics.inc(car.id, car.mode, "disconnects");
          car.controller.stop("device-disconnected");
          car.confirmed = { throttle: 0, steering: 0 };
        }
        this.log({
          kind: "car.connection",
          carId: car.id,
          mode: car.mode,
          message: e.online ? "Carrinho conectado" : "Carrinho desconectado; tração parada",
        });
        break;
      case "stopped": {
        car.lastSeenAt = e.at;
        const stale = e.lastSeq < car.controller.lastDriveSeq;
        const echo = car.controller.isStopSeq(e.lastSeq);
        if (!stale) car.confirmed = { throttle: 0, steering: 0 };
        if (e.reason === "watchdog" && !echo) {
          this.metrics.inc(car.id, car.mode, "watchdogTrips");
          car.watchdogTrips++;
          this.log({ kind: "safety.deviceWatchdog", carId: car.id, mode: car.mode, message: "Watchdog do carrinho parou a tração" });
        }
        if (!stale && car.controller.moving) {
          car.stopFromDevice = true;
          try {
            car.controller.stop(e.reason === "watchdog" ? "watchdog" : toStopReason(e.reason));
          } finally {
            car.stopFromDevice = false;
          }
        }
        break;
      }
      case "fault":
        car.controller.stop("fault");
        this.log({ kind: "car.fault", carId: car.id, mode: car.mode, visibility: "admin", message: `Falha relatada: ${e.code}` });
        break;
    }
    if (e.kind !== "fault") car.confirmedStale = false;
    this.changed();
  }

  lastMove(carId: CarId): { vector: DriveVector; at: number } | null {
    const m = this.mustCar(carId).lastMove;
    return m ? { vector: { ...m.vector }, at: m.at } : null;
  }

  private trackRequest(car: CarRuntime, vec: DriveVector): void {
    car.requested = { throttle: vec.throttle, steering: vec.steering };
    if (!isNeutral(vec)) car.lastMove = { vector: { ...car.requested }, at: this.clock.now() };
  }

  private logTransform(car: CarRuntime, requested: DriveVector, result: PipelineResult): void {
    const key = result.transformed || result.blocked
      ? `${result.blocked ? "b" : "t"}:${requested.throttle},${Math.sign(requested.steering)}>${result.output.throttle},${Math.sign(result.output.steering)}`
      : null;
    if (key === car.lastTransformKey) return;
    car.lastTransformKey = key;
    if (!key) return;
    const from = describeVector(requested);
    if (result.blocked) {
      this.log({
        kind: "defense.blocked",
        carId: car.id,
        teamId: car.teamId,
        mode: car.mode,
        visibility: "staff",
        message: `Alteração bloqueada pela integridade (simulada): ${from} mantido`,
      });
      return;
    }
    this.log({
      kind: "attack.transformed",
      carId: car.id,
      teamId: car.teamId,
      mode: car.mode,
      visibility: "staff",
      message: `Comando alterado: ${from} → ${describeVector(result.output)}`,
    });
  }

  private tick(): void {
    let dirty = false;
    const now = this.clock.now();
    for (const car of this.cars.values()) {
      car.controller.checkWatchdog();
      if (car.controller.moving || !isNeutral(car.confirmed)) dirty = true;
      const stale = car.online && car.lastSeenAt !== null && now - car.lastSeenAt > CONFIRMED_STALE_MS;
      if (stale !== car.confirmedStale) {
        car.confirmedStale = stale;
        dirty = true;
      }
    }
    if (dirty) this.changed();
  }

  private changed(): void {
    this.rev++;
    for (const fn of this.listeners) fn();
  }

  private mustCar(carId: CarId): CarRuntime {
    const car = this.cars.get(carId);
    if (!car) throw new Error(`carro desconhecido: ${carId}`);
    return car;
  }
}

const round3 = (v: number) => Math.round(v * 1000) / 1000;

export function describeVector(v: DriveVector): string {
  const t = v.throttle === 1 ? "frente" : v.throttle === -1 ? "ré" : "";
  const s = v.steering > 0 ? `direita ${v.steering}%` : v.steering < 0 ? `esquerda ${-v.steering}%` : "";
  return [t, s].filter(Boolean).join(" + ") || "parado";
}
