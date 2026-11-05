import type { DriveVector } from "@hijack/protocol";
import { cn } from "@/lib/utils";

const CELLS: { throttle: -1 | 0 | 1; steering: -1 | 0 | 1; glyph: string }[] = [
  { throttle: 1, steering: -1, glyph: "↖" },
  { throttle: 1, steering: 0, glyph: "↑" },
  { throttle: 1, steering: 1, glyph: "↗" },
  { throttle: 0, steering: -1, glyph: "←" },
  { throttle: 0, steering: 0, glyph: "·" },
  { throttle: 0, steering: 1, glyph: "→" },
  { throttle: -1, steering: -1, glyph: "↙" },
  { throttle: -1, steering: 0, glyph: "↓" },
  { throttle: -1, steering: 1, glyph: "↘" },
];

const describe = (v: DriveVector) => {
  const t = v.throttle === 1 ? "frente" : v.throttle === -1 ? "ré" : "parado";
  const s = v.steering === 1 ? "direita" : v.steering === -1 ? "esquerda" : "centro";
  return `${t}, direção ${s}`;
};

export function DriveIndicator({ label, vector, tone = "primary" }: { label: string; vector: DriveVector; tone?: "primary" | "muted" }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div role="img" aria-label={`${label}: ${describe(vector)}`} className="grid grid-cols-3 gap-0.5">
        {CELLS.map((c) => {
          const on = c.throttle === vector.throttle && c.steering === vector.steering;
          return (
            <span
              key={`${c.throttle}${c.steering}`}
              className={cn(
                "flex size-6 items-center justify-center rounded-sm font-mono text-xs",
                on
                  ? tone === "primary"
                    ? "bg-primary text-primary-foreground"
                    : "bg-foreground text-background"
                  : "bg-secondary text-subtle",
              )}
            >
              {c.glyph}
            </span>
          );
        })}
      </div>
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{label}</span>
    </div>
  );
}
