import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function LanAccessCard() {
  const [addresses, setAddresses] = useState<string[]>([]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/lan", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : { addresses: [] }))
      .then((b: { addresses: string[] }) => {
        if (alive) setAddresses(b.addresses);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  const port = window.location.port ? `:${window.location.port}` : "";
  const urls = addresses.map((ip) => `${window.location.protocol}//${ip}${port}/`);
  const url = urls[index] ?? null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Acesso pela rede</CardTitle>
        <CardDescription>Celulares e notebooks na mesma Wi-Fi isolada abrem este endereço.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col items-start gap-4 sm:flex-row">
        {url ? (
          <>
            <div className="rounded-lg bg-white p-3">
              <QRCode value={url} size={148} aria-label={`QR code para ${url}`} />
            </div>
            <div className="flex flex-col gap-2">
              <p className="font-mono text-lg break-all text-primary">{url}</p>
              {urls.length > 1 && (
                <div className="flex flex-wrap gap-2">
                  {urls.map((u, i) => (
                    <Button key={u} size="sm" variant={i === index ? "default" : "secondary"} onClick={() => setIndex(i)}>
                      {addresses[i]}
                    </Button>
                  ))}
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                Se o celular não abrir, libere a porta no firewall do notebook (ver README).
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Nenhum endereço de rede encontrado.</p>
        )}
      </CardContent>
    </Card>
  );
}
