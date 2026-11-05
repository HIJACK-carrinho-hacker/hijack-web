import type { CarView } from "@hijack/protocol";
import { DriveIndicator } from "@/components/hijack/drive-indicator";
import { ModeBadge } from "@/components/hijack/mode-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { STOP_REASON_LABEL, TEAM_COLOR_CLASS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const fmtUptime = (ms: number | null) => (ms === null ? "—" : `${Math.floor(ms / 1000)} s`);

export function CarPanel({ car, children }: { car: CarView; children?: React.ReactNode }) {
  const color = TEAM_COLOR_CLASS[car.teamId];
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
          <DriveIndicator label="Desejado" vector={car.desired} tone="muted" />
          <DriveIndicator label="Confirmado" vector={car.confirmed} />
        </div>
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
