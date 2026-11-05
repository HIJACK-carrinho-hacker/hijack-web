import type { CarView, DefenseView } from "@hijack/protocol";
import { DriveIndicator } from "@/components/hijack/drive-indicator";
import { ModeBadge } from "@/components/hijack/mode-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STOP_REASON_LABEL, TEAM_COLOR_CLASS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const fmtUptime = (ms: number | null) => (ms === null ? "—" : `${Math.floor(ms / 1000)} s`);

export function CarPanel({ car, defense, children }: { car: CarView; defense?: DefenseView; children?: React.ReactNode }) {
  const color = TEAM_COLOR_CLASS[car.teamId];
  const altered =
    car.moving &&
    (car.requested.throttle !== car.confirmed.throttle || car.requested.steering !== car.confirmed.steering) &&
    (car.confirmed.throttle !== 0 || car.confirmed.steering !== 0);
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <span aria-hidden className={cn("size-2.5 rounded-full", color.bg)} />
          {car.displayName}
          <span className="font-mono text-xs text-muted-foreground">equipe {car.teamId}</span>
        </CardTitle>
        <div className="flex items-center gap-2">
          <ModeBadge mode={car.mode} />
          <span className={cn("font-mono text-xs", car.telemetry.online ? "text-primary" : "text-destructive")}>
            ● {car.telemetry.online ? "online" : "offline"}
          </span>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-start justify-around gap-4">
          <DriveIndicator label="Solicitado" vector={car.requested} tone="muted" />
          <DriveIndicator label="Confirmado" vector={car.confirmed} />
        </div>
        {altered && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-center font-mono text-xs text-destructive">
            COMANDO ALTERADO NO CAMINHO
          </p>
        )}
        {defense && (defense.integrityDemoEnabled || defense.replayDemoEnabled || defense.strongPasswordEnabled) && (
          <p className="font-mono text-xs text-primary">
            Defesas: {[defense.strongPasswordEnabled && "senha forte", defense.integrityDemoEnabled && "integridade", defense.replayDemoEnabled && "repetição"].filter(Boolean).join(" · ")}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-muted-foreground">Parada</dt>
          <dd className={cn(car.stopReason === "watchdog" && "text-warning")}>
            {car.moving ? "em movimento" : car.stopReason ? STOP_REASON_LABEL[car.stopReason] : "—"}
          </dd>
          <dt className="text-muted-foreground">Último seq</dt>
          <dd className="tabular-nums">{car.telemetry.lastSeq}</dd>
          <dt className="text-muted-foreground">Watchdog</dt>
          <dd className="tabular-nums">{car.telemetry.watchdogTrips}</dd>
          <dt className="text-muted-foreground">Recusados</dt>
          <dd className="tabular-nums">{car.telemetry.rejectedCommands}</dd>
          <dt className="text-muted-foreground">Uptime</dt>
          <dd className="tabular-nums">{fmtUptime(car.telemetry.uptimeMs)}</dd>
        </dl>
        {children}
      </CardContent>
    </Card>
  );
}
