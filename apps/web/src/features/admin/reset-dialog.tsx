import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useHijack } from "@/hooks/use-hijack";

export function ResetDialog({ disabled }: { disabled: boolean }) {
  const { request } = useHijack();
  const [open, setOpen] = useState(false);
  const [flags, setFlags] = useState({ resetAttacks: true, resetDefenses: true, resetPasswords: false });
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    const r = await request("admin.resetDemo", flags);
    if (r.ok) {
      setOpen(false);
      setError(null);
    } else setError(r.message);
  };

  const row = (key: keyof typeof flags, label: string) => (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={key}>{label}</Label>
      <Switch id={key} checked={flags[key]} onCheckedChange={(v) => setFlags((f) => ({ ...f, [key]: v }))} />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Resetar demonstração
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Resetar demonstração</DialogTitle>
          <DialogDescription>
            Os carrinhos são parados antes. As senhas só voltam para 1234 se você marcar a opção abaixo.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {row("resetAttacks", "Ataques")}
          {row("resetDefenses", "Defesas didáticas")}
          {row("resetPasswords", "Senhas dos carrinhos (volta para 1234)")}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Cancelar
          </Button>
          <Button onClick={() => void confirm()}>Confirmar reset</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
