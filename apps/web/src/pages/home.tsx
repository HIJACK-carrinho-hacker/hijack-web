import { useHijack } from "@/hooks/use-hijack";
import { Brand } from "@/components/hijack/brand";
import { ConnectionBadge } from "@/components/hijack/connection-badge";

export function HomePage() {
  const { status } = useHijack();
  return (
    <main className="mx-auto flex min-h-svh max-w-md flex-col justify-center gap-4 px-6">
      <Brand />
      <p className="text-muted-foreground">Demonstração de segurança em sistemas ciberfísicos.</p>
      <ConnectionBadge status={status} />
    </main>
  );
}
