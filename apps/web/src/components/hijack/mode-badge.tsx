import type { CarMode } from "@hijack/protocol";
import { Badge } from "@/components/ui/badge";
import { MODE_LABEL } from "@/lib/labels";

export function ModeBadge({ mode }: { mode: CarMode }) {
  return (
    <Badge variant={mode === "simulated" ? "outline" : "secondary"} className="font-mono uppercase">
      {MODE_LABEL[mode]}
    </Badge>
  );
}
