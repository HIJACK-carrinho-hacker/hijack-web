import { ParticipantHeader } from "@/components/hijack/participant-header";
import { useHijack } from "@/hooks/use-hijack";

export function PilotPage() {
  const { state, me } = useHijack();
  const car = state?.cars.find((c) => c.id === me?.carId);
  return (
    <main className="mx-auto flex min-h-svh max-w-3xl flex-col gap-6 px-4 py-6">
      <ParticipantHeader />
      <p className="text-muted-foreground">{car ? car.displayName : "Carregando carrinho…"}</p>
    </main>
  );
}
