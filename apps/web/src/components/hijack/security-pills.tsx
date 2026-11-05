import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function SecurityPills({ level }: { level: number }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-2 text-sm text-muted-foreground" tabIndex={0}>
          Segurança
          <span className="inline-flex gap-1" role="img" aria-label={`${level} de 3 camadas demonstradas`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={cn("h-2 w-5 rounded-full", i < level ? "bg-primary" : "bg-subtle")} />
            ))}
          </span>
        </span>
      </TooltipTrigger>
      <TooltipContent className="max-w-64">
        Camadas de defesa demonstradas (senha forte, integridade e repetição). Não é uma medida real do nível de
        segurança.
      </TooltipContent>
    </Tooltip>
  );
}
