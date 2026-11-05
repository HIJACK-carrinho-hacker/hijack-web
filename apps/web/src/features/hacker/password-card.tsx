import type { DefenseView } from "@hijack/protocol";
import { type FormEvent, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHijack } from "@/hooks/use-hijack";

export function PasswordCard({ defense }: { defense: DefenseView | undefined }) {
  const { request } = useHijack();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const strong = defense?.strongPasswordEnabled ?? false;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (next !== confirm) {
      setFeedback({ ok: false, text: "A confirmação não confere com a nova senha." });
      return;
    }
    setBusy(true);
    const r = await request("auth.changePassword", { currentPassword: current, nextPassword: next });
    setBusy(false);
    setCurrent("");
    setNext("");
    setConfirm("");
    setFeedback(
      r.ok
        ? { ok: true, text: "Senha alterada. O piloto da sua equipe precisa entrar de novo com a nova senha." }
        : { ok: false, text: r.message },
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Autenticação
          {strong ? (
            <Badge>Senha forte ativa</Badge>
          ) : (
            <Badge variant="destructive">Vulnerável: senha padrão 1234</Badge>
          )}
        </CardTitle>
        <CardDescription>
          Troca real da senha do carrinho. A senha antiga deixa de funcionar e o piloto precisa entrar de novo.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-3" noValidate>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pw-current">Senha atual</Label>
              <Input id="pw-current" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pw-next">Nova senha</Label>
              <Input id="pw-next" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="pw-confirm">Confirmar</Label>
              <Input id="pw-confirm" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Mínimo de 8 caracteres, com letras e números.</p>
          {feedback && (
            <p role="status" className={feedback.ok ? "text-sm text-primary" : "text-sm text-destructive"}>
              {feedback.text}
            </p>
          )}
          <Button type="submit" disabled={busy || !current || !next} className="w-fit">
            {busy ? "Alterando…" : "Trocar senha"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
