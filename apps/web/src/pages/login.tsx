import type { CarId, PublicInfo } from "@hijack/protocol";
import { type FormEvent, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router";
import { Brand } from "@/components/hijack/brand";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useHijack } from "@/hooks/use-hijack";
import { LOGIN_ERROR_MESSAGE, api } from "@/lib/api";
import { homeOf } from "@/lib/routes";
import { cn } from "@/lib/utils";

type Role = "pilot" | "hacker";

const ROLES: { value: Role; title: string; description: string }[] = [
  { value: "pilot", title: "Piloto", description: "Dirige o carrinho pelo celular" },
  { value: "hacker", title: "Hacker", description: "Ataca e defende pelo notebook" },
];

export function LoginPage() {
  const { me, meLoaded, login, revoked, clearRevoked } = useHijack();
  const navigate = useNavigate();
  const [info, setInfo] = useState<PublicInfo | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("pilot");
  const [carId, setCarId] = useState<CarId>("car-a");
  const [carName, setCarName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.publicInfo().then((r) => {
        if (alive && r.ok) setInfo(r.data);
      });
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  if (meLoaded && me) return <Navigate to={homeOf(me.role)} replace />;

  const car = info?.cars.find((c) => c.id === carId);
  const slotTaken = car ? (role === "pilot" ? car.pilotTaken : car.hackerTaken) : false;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    clearRevoked();
    if (!name.trim()) {
      setError("Informe seu nome.");
      return;
    }
    if (!password) {
      setError("Informe a senha do carrinho.");
      return;
    }
    setBusy(true);
    const r = await login({
      name: name.trim(),
      role,
      carId,
      password,
      ...(carName.trim() ? { carDisplayName: carName.trim() } : {}),
    });
    setBusy(false);
    if (r.ok) {
      navigate(homeOf(r.me.role), { replace: true });
      return;
    }
    setPassword("");
    setError(LOGIN_ERROR_MESSAGE[r.code] ?? "Não foi possível entrar.");
  };

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-md flex-col justify-center px-4 py-8">
      <form onSubmit={submit} className="flex flex-col gap-5" noValidate>
        <div className="flex flex-col gap-2">
          <Brand />
          <p className="text-muted-foreground">Entre com sua equipe para começar.</p>
        </div>

        {revoked && (
          <Alert>
            <AlertDescription>{revoked}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-2">
          <Label htmlFor="name">Seu nome</Label>
          <Input id="name" autoComplete="nickname" maxLength={32} value={name} onChange={(e) => setName(e.target.value)} className="h-11" />
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">Sua função</legend>
          <div role="radiogroup" aria-label="Sua função" className="grid grid-cols-2 gap-2">
            {ROLES.map((r) => {
              const selected = role === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setRole(r.value)}
                  className={cn(
                    "flex flex-col items-start gap-1 rounded-lg border px-3 py-3 text-left transition-colors",
                    selected ? "border-selected-border bg-selected" : "border-border bg-card hover:bg-secondary",
                  )}
                >
                  <span className="font-semibold">{r.title}</span>
                  <span className="text-xs text-muted-foreground">{r.description}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="car">Seu carrinho</Label>
          <Select value={carId} onValueChange={(v) => setCarId(v as CarId)}>
            <SelectTrigger id="car" className="w-full data-[size=default]:h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(info?.cars ?? [
                { id: "car-a" as const, displayName: "Carrinho A" },
                { id: "car-b" as const, displayName: "Carrinho B" },
              ]).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {slotTaken && (
            <p className="text-xs text-warning">
              A vaga de {role === "pilot" ? "piloto" : "hacker"} deste carrinho já está ocupada.
            </p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="car-name">Nome do carrinho (opcional)</Label>
          <Input
            id="car-name"
            maxLength={32}
            placeholder={car?.displayName ?? "Carrinho A"}
            value={carName}
            onChange={(e) => setCarName(e.target.value)}
            className="h-11"
          />
        </div>

        <div className="flex flex-col gap-2">
          <Label htmlFor="password">Senha do carrinho</Label>
          <Input
            id="password"
            type="password"
            autoComplete="off"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-11"
          />
          {car?.defaultPasswordHint && (
            <p className="text-xs text-warning">
              {car.mode === "simulated" ? "Modo simulado" : "Modo demonstração"}: a senha é 1234 (fraca de propósito)
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <Button type="submit" size="lg" disabled={busy} className="h-11 w-full text-base font-semibold">
          {busy ? "Conectando…" : "Conectar e entrar"}
        </Button>
      </form>
    </main>
  );
}
