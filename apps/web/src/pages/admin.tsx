import type { CarMode } from "@hijack/protocol";
import { Download, LogOut } from "lucide-react";
import { Brand } from "@/components/hijack/brand";
import { ConnectionBadge } from "@/components/hijack/connection-badge";
import { DemoControls } from "@/components/hijack/demo-controls";
import { EventList } from "@/components/hijack/event-list";
import { ModeBadge } from "@/components/hijack/mode-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminLogin } from "@/features/admin/admin-login";
import { LanAccessCard } from "@/features/admin/lan-access";
import { ResetDialog } from "@/features/admin/reset-dialog";
import { useHijack } from "@/hooks/use-hijack";
import { DEMO_STATE_LABEL, STOP_REASON_LABEL } from "@/lib/labels";
import { cn } from "@/lib/utils";

export function AdminPage() {
  const { me, meLoaded, status, state, send, logout } = useHijack();
  if (!meLoaded) return <p className="p-6 text-muted-foreground">Carregando…</p>;
  if (me?.role !== "admin") return <AdminLogin />;

  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3">
        <Brand className="text-xl" />
        <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">Operador</span>
        <ConnectionBadge status={status} />
        {state && <span className="text-sm text-muted-foreground">Partida: {DEMO_STATE_LABEL[state.demoState]}</span>}
        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => void logout()}>
          <LogOut /> Sair
        </Button>
      </header>

      {state && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <DemoControls demoState={state.demoState} />
            <ResetDialog disabled={state.demoState === "running"} />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {state.cars.map((car) => {
              const slot = state.slots.find((s) => s.carId === car.id);
              const defense = state.defenses.find((d) => d.carId === car.id);
              return (
                <Card key={car.id}>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>{car.displayName}</CardTitle>
                    <div className="flex items-center gap-2">
                      <ModeBadge mode={car.mode} />
                      <span className={cn("font-mono text-xs", car.telemetry.online ? "text-primary" : "text-destructive")}>
                        ● {car.telemetry.online ? "online" : "offline"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3 text-sm">
                    <div className="flex flex-wrap gap-2">
                      {(["simulated", "hardware"] as CarMode[]).map((m) => (
                        <Button
                          key={m}
                          size="sm"
                          variant={car.mode === m ? "default" : "secondary"}
                          disabled={state.demoState === "running"}
                          onClick={() => send("admin.setCarMode", { carId: car.id, mode: m })}
                        >
                          {m === "simulated" ? "Simulado" : "Hardware"}
                        </Button>
                      ))}
                    </div>
                    <p className="text-muted-foreground">
                      Estado: {car.moving ? "em movimento" : car.stopReason ? STOP_REASON_LABEL[car.stopReason] : "parado"}
                      {" · "}Senha: {defense?.strongPasswordEnabled ? "forte" : "padrão (1234)"}
                    </p>
                    {(["pilot", "hacker"] as const).map((role) => {
                      const holder = slot?.[role] ?? null;
                      return (
                        <div key={role} className="flex items-center justify-between gap-2">
                          <span>
                            <span className="text-muted-foreground">{role === "pilot" ? "Piloto" : "Hacker"}:</span>{" "}
                            {holder ?? <span className="text-muted-foreground">vago</span>}
                          </span>
                          {holder && (
                            <Button size="sm" variant="ghost" onClick={() => send("admin.releaseSlot", { carId: car.id, role })}>
                              Liberar vaga
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <LanAccessCard />

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Métricas</CardTitle>
              </CardHeader>
              <CardContent className="overflow-x-auto">
                <table className="w-full font-mono text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-1 pr-3">Carro</th>
                      <th className="pr-3">Modo</th>
                      <th className="pr-3">Receb.</th>
                      <th className="pr-3">Aplic.</th>
                      <th className="pr-3">Invert.</th>
                      <th className="pr-3">Bloq.</th>
                      <th className="pr-3">Watchdog</th>
                      <th>Ack p50/p95 (ms)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.metrics.map((m) => (
                      <tr key={`${m.carId}-${m.mode}`} className="tabular-nums">
                        <td className="py-1 pr-3">{m.carId === "car-a" ? "A" : "B"}</td>
                        <td className="pr-3">{m.mode === "simulated" ? "sim" : "hw"}</td>
                        <td className="pr-3">{m.received}</td>
                        <td className="pr-3">{m.applied}</td>
                        <td className="pr-3">{m.transformed}</td>
                        <td className="pr-3">{m.blocked}</td>
                        <td className="pr-3">{m.watchdogTrips}</td>
                        <td>
                          {m.ackLatencyMsP50 ?? "—"} / {m.ackLatencyMsP95 ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="mt-2 text-xs text-muted-foreground">
                  Latência de ack = envio do servidor até a confirmação do dispositivo; não é o tempo até a roda girar.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {(
                    [
                      ["metrics", "csv", "Métricas CSV"],
                      ["metrics", "json", "Métricas JSON"],
                      ["events", "csv", "Eventos CSV"],
                      ["events", "json", "Eventos JSON"],
                    ] as const
                  ).map(([name, format, label]) => (
                    <Button key={`${name}.${format}`} asChild size="sm" variant="secondary">
                      <a href={`/api/admin/export/${name}.${format}`} download>
                        <Download /> {label}
                      </a>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <EventList events={state.events} className="max-h-80 overflow-y-auto" />
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </main>
  );
}
