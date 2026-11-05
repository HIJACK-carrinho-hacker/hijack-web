import { ParticipantHeader } from "@/components/hijack/participant-header";
import { SecurityPills } from "@/components/hijack/security-pills";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PasswordCard } from "@/features/hacker/password-card";
import { useHijack } from "@/hooks/use-hijack";

const TAB = "flex-none px-4 text-base font-semibold after:bg-primary data-active:text-primary dark:data-active:text-primary";

export function HackerPage() {
  const { state, me } = useHijack();
  const defense = state?.defenses.find((d) => d.carId === me?.carId);
  const running = state?.demoState === "running";
  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col gap-6 px-4 py-6">
      <ParticipantHeader>
        <SecurityPills level={defense?.level ?? 0} />
      </ParticipantHeader>
      <Tabs defaultValue="attack" className="gap-4">
        <TabsList variant="line" className="h-11 w-full justify-start gap-4 border-b">
          <TabsTrigger value="attack" className={TAB}>
            Ataque
          </TabsTrigger>
          <TabsTrigger value="defense" className={TAB}>
            Defesa
          </TabsTrigger>
        </TabsList>
        <TabsContent value="attack" className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {running ? "Siga as etapas guiadas." : "O ataque é liberado quando a partida começar."}
          </p>
          <p className="text-xs text-warning">Esta é uma simulação no servidor, não uma invasão de rede.</p>
        </TabsContent>
        <TabsContent value="defense" className="flex flex-col gap-4">
          <PasswordCard defense={defense} />
        </TabsContent>
      </Tabs>
    </main>
  );
}
