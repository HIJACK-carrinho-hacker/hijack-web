import { type DriveVector, STEERING_MAX } from "@hijack/protocol";
import { describeDrive } from "@/lib/labels";
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

const steeringText = (s: number) => (s === 0 ? "centro" : `${s > 0 ? "D" : "E"} ${Math.abs(s)}%`);

export function DriveIndicator({
  label,
  vector,
  tone = "primary",
  unavailable = false,
}: {
  label: string;
  vector: DriveVector;
  tone?: "primary" | "muted";
  unavailable?: boolean;
}) {
  const share = Math.min(1, Math.abs(vector.steering) / STEERING_MAX) * 50;
  const fill = tone === "primary" ? "bg-primary" : "bg-foreground";
  return (
    <div role="img" aria-label={`${label}: ${unavailable ? "sem dados" : describeDrive(vector)}`} className="flex flex-col items-center gap-1.5">
      <div className="grid grid-cols-3 gap-0.5">
        {CELLS.map((c) => {
          const on = !unavailable && c.throttle === vector.throttle && c.steering === Math.sign(vector.steering);
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
      <div className="relative h-1.5 w-[4.75rem] overflow-hidden rounded-full bg-secondary">
        <span aria-hidden className="absolute inset-y-0 left-1/2 w-px bg-subtle" />
        <span
          aria-hidden
          className={cn("absolute inset-y-0", fill)}
          style={unavailable ? { width: 0 } : vector.steering >= 0 ? { left: "50%", width: `${share}%` } : { right: "50%", width: `${share}%` }}
        />
      </div>
      <span className={cn("font-mono text-[10px] tabular-nums", unavailable ? "text-warning" : "text-muted-foreground")}>
        {unavailable ? "sem dados" : steeringText(vector.steering)}
      </span>
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">{label}</span>
    </div>
  );
}
