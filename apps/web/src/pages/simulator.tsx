import { Brand } from "@/components/hijack/brand";
import { ConnectionBadge } from "@/components/hijack/connection-badge";
import { DemoControls } from "@/components/hijack/demo-controls";
import { EventList } from "@/components/hijack/event-list";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Arena } from "@/features/simulator/arena";
import { CarPanel } from "@/features/simulator/car-panel";
import { ManualPad } from "@/features/simulator/manual-pad";
import { useHijack } from "@/hooks/use-hijack";
import { DEMO_STATE_LABEL } from "@/lib/labels";

export function SimulatorPage() {
  const { status, state } = useHijack();
  return (
    <main className="mx-auto flex min-h-svh max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border bg-card px-4 py-3">
        <Brand className="text-xl" />
        <span className="rounded-md border border-warning/40 px-2 py-0.5 font-mono text-lg font-bold tracking-[0.3em] text-warning">
          SIMULAÇÃO
        </span>
        <ConnectionBadge status={status} />
        {state && (
          <span className="text-sm text-muted-foreground">Partida: {DEMO_STATE_LABEL[state.demoState]}</span>
        )}
      </header>

      {!state ? (
        <p className="text-muted-foreground">Aguardando estado do servidor…</p>
      ) : (
        <>
          <DemoControls demoState={state.demoState} />
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="flex flex-col gap-2">
              <Arena cars={state.cars} />
              <p className="text-xs text-muted-foreground">
                Posição apenas ilustrativa; não representa física real nem a posição do carrinho físico.
              </p>
            </div>
            <div className="flex flex-col gap-4">
              {state.cars.map((car) => (
                <CarPanel key={car.id} car={car}>
                  {car.mode === "simulated" && (
                    <ManualPad carId={car.id} disabled={state.demoState === "running" || !car.telemetry.online} />
                  )}
                </CarPanel>
              ))}
            </div>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Eventos</CardTitle>
            </CardHeader>
            <CardContent>
              <EventList events={state.events} className="max-h-72 overflow-y-auto" />
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
