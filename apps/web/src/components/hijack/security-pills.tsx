import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const SECURITY_LAYERS = 4;

export function SecurityPills({ level }: { level: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" tabIndex={0}>
          Segurança
          <span className="inline-flex gap-1" role="img" aria-label={`${level} de ${SECURITY_LAYERS} camadas demonstradas`}>
            {Array.from({ length: SECURITY_LAYERS }, (_, i) => (
              <span key={i} className={cn("h-2 w-5 rounded-full", i < level ? "bg-primary" : "bg-subtle")} />
            ))}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Camadas de defesa demonstradas (senha forte, integridade, repetição e criptografia). Não é uma medida real do
        nível de segurança.
      </TooltipContent>
    </Tooltip>
  );
}
