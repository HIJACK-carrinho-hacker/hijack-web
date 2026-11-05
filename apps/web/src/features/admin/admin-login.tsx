import { type FormEvent, useState } from "react";
import { Brand } from "@/components/hijack/brand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useHijack } from "@/hooks/use-hijack";
import { LOGIN_ERROR_MESSAGE } from "@/lib/api";

export function AdminLogin() {
  const { adminLogin } = useHijack();
  const [secret, setSecret] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await adminLogin(secret);
    setBusy(false);
    setSecret("");
    if (!r.ok) setError(r.code === "invalid_credentials" ? "Segredo do operador incorreto." : (LOGIN_ERROR_MESSAGE[r.code] ?? "Não foi possível entrar."));
  };

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col justify-center px-4">
      <form onSubmit={submit} className="flex flex-col gap-4">
        <Brand />
        <p className="text-muted-foreground">Acesso do operador.</p>
        <div className="flex flex-col gap-2">
          <Label htmlFor="secret">Segredo do operador</Label>
          <Input id="secret" type="password" autoComplete="off" value={secret} onChange={(e) => setSecret(e.target.value)} className="h-11" />
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" disabled={busy || !secret} className="h-11">
          Entrar
        </Button>
      </form>
    </main>
  );
}
