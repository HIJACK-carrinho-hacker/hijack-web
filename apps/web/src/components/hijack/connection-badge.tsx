import type { ConnectionStatus } from "@/lib/ws-client";
import { cn } from "@/lib/utils";

const LABEL: Record<ConnectionStatus, string> = {
  open: "Conectado",
  connecting: "Conectando…",
  closed: "Sem conexão",
};

export function ConnectionBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  return (
    <span
      role="status"
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-xs",
        status === "open" && "text-primary",
        status === "connecting" && "text-warning",
        status === "closed" && "text-destructive",
        className,
      )}
    >
      <span
        aria-hidden
        className={cn(
          "size-1.5 rounded-full",
          status === "open" && "bg-primary",
          status === "connecting" && "animate-pulse bg-warning",
          status === "closed" && "bg-destructive",
        )}
      />
      {LABEL[status]}
    </span>
  );
}
