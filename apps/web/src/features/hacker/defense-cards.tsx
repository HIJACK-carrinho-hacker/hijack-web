import type { DefenseView } from "@hijack/protocol";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useHijack } from "@/hooks/use-hijack";
import { SecurityInfo } from "./security-info";
import { DEFENSE_EXPLANATIONS } from "./security-info-content";

function SimBadge({ children }: { children: string }) {
  return (
    <Badge variant="outline" className="border-warning/50 text-warning">
      {children}
    </Badge>
  );
}

function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="text-sm text-destructive">
      {message}
    </p>
  );
}

export function IntegrityCard({ defense }: { defense: DefenseView | undefined }) {
  const { request } = useHijack();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = defense?.integrityDemoEnabled ?? false;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Integridade
          <SecurityInfo label="Integridade" explanation={DEFENSE_EXPLANATIONS.integrity} />
          <SimBadge>Simulação, não HMAC</SimBadge>
        </CardTitle>
        <CardDescription>
          Quando ligada, o servidor deixa de aplicar as alterações pedidas pelo hacker adversário no seu carrinho
          (inversão, viés e travamento da direção) e o monitor volta a mostrar a telemetria verdadeira. O piloto
          continua dirigindo normalmente.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="integrity" className="text-base">
            {enabled ? "Bloqueando alterações" : "Desligada"}
          </Label>
          <Switch
            id="integrity"
            checked={enabled}
            disabled={busy}
            onCheckedChange={async (v) => {
              setBusy(true);
              setError(null);
              const r = await request("defense.setIntegrityDemo", { enabled: v });
              setBusy(false);
              if (!r.ok) setError(r.message);
            }}
          />
        </div>
        <ErrorNote message={error} />
      </CardContent>
    </Card>
  );
}

export function EncryptionCard({ defense }: { defense: DefenseView | undefined }) {
  const { request } = useHijack();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = defense?.encryptionDemoEnabled ?? false;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Criptografia
          <SecurityInfo label="Criptografia" explanation={DEFENSE_EXPLANATIONS.encryption} />
          <SimBadge>Simulação, não TLS</SimBadge>
        </CardTitle>
        <CardDescription>
          Quando ligada, quem intercepta o tráfego do seu carrinho só vê texto embaralhado. No sistema real isso exige
          TLS; aqui a rede continua em texto claro.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="encryption" className="text-base">
            {enabled ? "Tráfego cifrado" : "Desligada"}
          </Label>
          <Switch
            id="encryption"
            checked={enabled}
            disabled={busy}
            onCheckedChange={async (v) => {
              setBusy(true);
              setError(null);
              const r = await request("defense.setEncryptionDemo", { enabled: v });
              setBusy(false);
              if (!r.ok) setError(r.message);
            }}
          />
        </div>
        <ErrorNote message={error} />
      </CardContent>
    </Card>
  );
}

export function ReplayCard({ defense }: { defense: DefenseView | undefined }) {
  const { request } = useHijack();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enabled = defense?.replayDemoEnabled ?? false;
  const set = async (v: boolean) => {
    setBusy(true);
    setError(null);
    const r = await request("defense.setReplayDemo", { enabled: v });
    setBusy(false);
    if (!r.ok) setError(r.message);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          Repetição
          <SecurityInfo label="Repetição" explanation={DEFENSE_EXPLANATIONS.replay} />
          <SimBadge>Simulação, não validação no firmware</SimBadge>
        </CardTitle>
        <CardDescription>
          Quando ligada, o servidor recusa os comandos antigos que o atacante reapresenta (replay) no seu carrinho e
          registra um exemplo do comando recusado. A defesa nunca move o carrinho.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="replay" className="text-base">
            {enabled ? "Recusando comandos antigos" : "Desligada"}
          </Label>
          <Switch id="replay" checked={enabled} disabled={busy} onCheckedChange={(v) => void set(v)} />
        </div>
        {enabled && (
          <Button variant="secondary" className="w-fit" disabled={busy} onClick={() => void set(true)}>
            Gerar outro exemplo
          </Button>
        )}
        <ErrorNote message={error} />
      </CardContent>
    </Card>
  );
}
