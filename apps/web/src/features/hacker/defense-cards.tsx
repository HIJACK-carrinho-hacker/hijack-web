import type { DefenseView } from "@hijack/protocol";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useHijack } from "@/hooks/use-hijack";

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
          <SimBadge>Simulação, não HMAC</SimBadge>
        </CardTitle>
        <CardDescription>
          Quando ligada, o servidor deixa de aplicar as inversões pedidas pelo hacker adversário no seu carrinho. O
          piloto continua dirigindo normalmente.
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
          <SimBadge>Simulação, não validação no firmware</SimBadge>
        </CardTitle>
        <CardDescription>
          Mostra o conceito de recusar um comando antigo reenviado. Gera apenas um exemplo no registro; nenhum
          movimento é injetado no carrinho.
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
