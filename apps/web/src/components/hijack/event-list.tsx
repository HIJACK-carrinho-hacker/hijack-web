import type { EventLogEntry } from "@hijack/protocol";
import { cn } from "@/lib/utils";

const time = (at: number) =>
  new Date(at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

const carLabel = (carId: EventLogEntry["carId"]) => (carId === "car-a" ? "A" : carId === "car-b" ? "B" : null);

export function EventList({ events, className, empty = "Nenhum evento ainda." }: { events: EventLogEntry[]; className?: string; empty?: string }) {
  if (events.length === 0) return <p className="text-sm text-muted-foreground">{empty}</p>;
  return (
    <ol className={cn("flex flex-col gap-1 font-mono text-xs", className)} aria-live="polite">
      {events.map((e) => (
        <li key={e.id} className="flex gap-2">
          <span className="text-subtle tabular-nums">{time(e.at)}</span>
          {carLabel(e.carId) && <span className="text-muted-foreground">[{carLabel(e.carId)}]</span>}
          <span className={cn(e.kind.startsWith("safety") ? "text-warning" : "text-foreground/90")}>{e.message}</span>
        </li>
      ))}
    </ol>
  );
}
