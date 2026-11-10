import { ParticipantHeader } from "@/components/hijack/participant-header";
import { SecurityPills } from "@/components/hijack/security-pills";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EventList } from "@/components/hijack/event-list";
import { AttackSteps } from "@/features/hacker/attack-steps";
import { IntegrityCard, ReplayCard } from "@/features/hacker/defense-cards";
import { PasswordCard } from "@/features/hacker/password-card";
import { useHijack } from "@/hooks/use-hijack";

const TAB = "flex-none px-4 text-base font-semibold after:bg-primary data-active:text-primary dark:data-active:text-primary";

export function HackerPage() {
  const { state, me } = useHijack();
  const defense = state?.defenses.find((d) => d.carId === me?.carId);
  const running = state?.demoState === "running";
  const attack = state?.attacks.find((a) => a.attackerTeam === me?.teamId);
  const single = state?.topology === "single";
  const defendsOnly = single && me?.teamId === "A";
  const attacksOnly = single && me?.teamId === "B";
  const targetName = state?.cars.find((c) => c.active)?.displayName ?? "Carrinho A";
  const log = (state?.events ?? []).filter((e) => /^(attack|defense)\./.test(e.kind)).slice(0, 12);
  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col gap-6 px-4 py-6">
      <ParticipantHeader>
        {!attacksOnly && <SecurityPills level={defense?.level ?? 0} />}
      </ParticipantHeader>
      <Tabs defaultValue="attack" className="gap-4">
        <TabsList variant="line" className="h-11 w-full justify-start gap-4 border-b">
          <TabsTrigger value="attack" className={TAB}>
            Ataque
          </TabsTrigger>
          {!attacksOnly && (
            <TabsTrigger value="defense" className={TAB}>
              Defesa
            </TabsTrigger>
          )}
        </TabsList>
        <TabsContent value="attack" className="flex flex-col gap-4">
          {defendsOnly ? (
            <p role="note" className="rounded-xl border bg-card p-4 text-sm">
              Na demonstração com 1 carrinho, a equipe A <strong>defende</strong> o {targetName}. O ataque é feito pela
              equipe B. Use a aba Defesa.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              {attacksOnly && `Equipe B: seu alvo é o ${targetName}, defendido pela equipe A. `}
              {running ? "Siga as etapas guiadas." : "O ataque é liberado quando a partida começar."}
            </p>
          )}
          {!defendsOnly && attack && state && <AttackSteps attack={attack} cars={state.cars} running={running} />}
          <p className="text-xs text-warning">Esta é uma simulação no servidor, não uma invasão de rede.</p>
          {log.length > 0 && (
            <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
              <h3 className="text-sm font-semibold">Registro</h3>
              <EventList events={log} />
            </section>
          )}
        </TabsContent>
        {!attacksOnly && (
          <TabsContent value="defense" className="flex flex-col gap-4">
            <PasswordCard defense={defense} />
            <IntegrityCard defense={defense} />
            <ReplayCard defense={defense} />
            <p className="text-xs text-muted-foreground">
              O indicador de segurança conta as camadas demonstradas (0 a 3). Ele não mede o nível real de segurança do
              sistema.
            </p>
            {log.length > 0 && (
              <section className="flex flex-col gap-2 rounded-xl border bg-card p-4">
                <h3 className="text-sm font-semibold">Registro</h3>
                <EventList events={log} />
              </section>
            )}
          </TabsContent>
        )}
      </Tabs>
    </main>
  );
}
