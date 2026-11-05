import { ATTACK_STEPS, type AttackView, type CarId, type CarView } from "@hijack/protocol";
import { Check, Loader2 } from "lucide-react";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useHijack } from "@/hooks/use-hijack";
import { cn } from "@/lib/utils";

const SCAN_MS = 1500;
const EXPLOIT_MS = 1200;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function StepCard({
  index,
  title,
  done,
  children,
}: {
  index: number;
  title: string;
  done: boolean;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border bg-background p-4" aria-label={`Etapa ${index}: ${title}`}>
      <h3 className="flex items-center gap-2 font-semibold">
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full font-mono text-xs",
            done ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground",
          )}
        >
          {done ? <Check className="size-3.5" /> : index}
        </span>
        {title}
      </h3>
      {children}
    </section>
  );
}

export function AttackSteps({ attack, cars, running }: { attack: AttackView; cars: CarView[]; running: boolean }) {
  const { request, me } = useHijack();
  const [busy, setBusy] = useState<null | "scan" | "exploit" | "target" | "configure" | "disable">(null);
  const [error, setError] = useState<string | null>(null);
  const progress = ATTACK_STEPS.indexOf(attack.step);
  const nameOf = (id: CarId) => cars.find((c) => c.id === id)?.displayName ?? id;

  const run = async (kind: NonNullable<typeof busy>, fn: () => ReturnType<typeof request>, delay = 0) => {
    setBusy(kind);
    setError(null);
    if (delay) await wait(delay);
    const r = await fn();
    setBusy(null);
    if (!r.ok) setError(r.message);
  };

  const disabled = !running || busy !== null;

  return (
    <div className="flex flex-col gap-4">
      <StepCard index={1} title="Encontre a rede do adversário" done={progress >= 1}>
        {attack.scanResults.length > 0 && (
          <ul className="flex flex-col gap-1 font-mono text-sm">
            {attack.scanResults.map((id) => (
              <li key={id} className="flex items-center gap-2">
                <span aria-hidden className="size-1.5 rounded-full bg-primary" />
                {nameOf(id)}
                {id === me?.carId && <span className="text-muted-foreground">(sua equipe)</span>}
              </li>
            ))}
          </ul>
        )}
        {attack.scanResults.length > 0 && (
          <p className="text-xs text-muted-foreground">
            Lista apenas os carrinhos cadastrados no servidor HIJACK. Nenhuma varredura real foi feita.
          </p>
        )}
        {progress < 1 && (
          <Button className="w-fit" disabled={disabled} onClick={() => void run("scan", () => request("attack.scan", {}), SCAN_MS)}>
            {busy === "scan" ? (
              <>
                <Loader2 className="animate-spin" /> Procurando carrinhos…
              </>
            ) : (
              "Escanear rede"
            )}
          </Button>
        )}
      </StepCard>

      {progress >= 1 && (
        <StepCard index={2} title="Identifique o carrinho adversário" done={progress >= 2}>
          <div className="flex flex-wrap gap-2">
            {attack.scanResults.map((id) => {
              const own = id === me?.carId;
              const selected = attack.targetCarId === id;
              return (
                <button
                  key={id}
                  type="button"
                  disabled={own || disabled || progress >= 2}
                  aria-pressed={selected}
                  onClick={() => void run("target", () => request("attack.selectTarget", { targetCarId: id }))}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed",
                    selected ? "border-selected-border bg-selected" : "bg-card hover:enabled:bg-secondary",
                    own && "opacity-50",
                  )}
                >
                  {nameOf(id)}
                  <span className="block text-xs text-muted-foreground">{own ? "sua equipe" : "equipe adversária"}</span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-warning">Alvo simulado: a escolha só vale dentro do servidor HIJACK.</p>
        </StepCard>
      )}

      {progress >= 2 && (
        <StepCard index={3} title="Explore a vulnerabilidade" done={progress >= 3}>
          {attack.exploitReport ? (
            <p className="rounded-lg border bg-card p-3 font-mono text-xs leading-relaxed text-foreground/90">{attack.exploitReport}</p>
          ) : (
            <Button className="w-fit" disabled={disabled} onClick={() => void run("exploit", () => request("attack.exploitDemo", {}), EXPLOIT_MS)}>
              {busy === "exploit" ? (
                <>
                  <Loader2 className="animate-spin" /> Analisando…
                </>
              ) : (
                "Explorar vulnerabilidade"
              )}
            </Button>
          )}
        </StepCard>
      )}

      {progress >= 3 && (
        <StepCard index={4} title="Modifique os comandos" done={attack.active}>
          <div className="flex flex-col gap-3">
            {(
              [
                ["invertThrottle", "Frente ↔ Ré"],
                ["invertSteering", "Esquerda ↔ Direita"],
              ] as const
            ).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between gap-4 rounded-lg border bg-card px-3 py-2">
                <Label htmlFor={key} className="text-base">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={attack[key]}
                  disabled={disabled}
                  onCheckedChange={(v) =>
                    void run("configure", () =>
                      request("attack.configure", {
                        invertThrottle: key === "invertThrottle" ? v : attack.invertThrottle,
                        invertSteering: key === "invertSteering" ? v : attack.invertSteering,
                      }),
                    )
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              disabled={!attack.active || busy !== null}
              onClick={() => void run("disable", () => request("attack.disable", {}))}
            >
              Desativar ataque
            </Button>
            <span className={cn("text-sm", attack.active ? "text-primary" : "text-muted-foreground")}>
              {attack.active && attack.targetCarId ? `Ataque ativo em ${nameOf(attack.targetCarId)}` : "Nenhuma inversão ativa"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            A inversão só altera comandos enquanto o piloto adversário estiver dirigindo. Parar nunca é invertido.
          </p>
        </StepCard>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
