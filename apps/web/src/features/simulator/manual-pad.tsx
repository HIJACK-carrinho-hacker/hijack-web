import { type Axis, type CarId, STEERING_MAX } from "@hijack/protocol";
import { useHijack } from "@/hooks/use-hijack";
import { useHoldRepeat } from "@/hooks/use-hold-repeat";
import { cn } from "@/lib/utils";

const PADS: { label: string; throttle: Axis; steering: number }[] = [
  { label: "↖", throttle: 1, steering: -STEERING_MAX },
  { label: "↑", throttle: 1, steering: 0 },
  { label: "↗", throttle: 1, steering: STEERING_MAX },
  { label: "↙", throttle: -1, steering: -STEERING_MAX },
  { label: "↓", throttle: -1, steering: 0 },
  { label: "↘", throttle: -1, steering: STEERING_MAX },
];

function HoldButton({ carId, throttle, steering, label, disabled }: { carId: CarId; throttle: Axis; steering: number; label: string; disabled: boolean }) {
  const { send } = useHijack();
  const hold = useHoldRepeat(
    () => send("sim.manualDrive", { carId, throttle, steering }),
    () => send("sim.manualDrive", { carId, throttle: 0, steering: 0 }),
  );
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Teste: ${label}`}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId);
        hold.start();
      }}
      onPointerUp={hold.stop}
      onPointerCancel={hold.stop}
      onLostPointerCapture={hold.stop}
      className={cn(
        "flex size-10 touch-none items-center justify-center rounded-md border bg-secondary font-mono text-lg select-none",
        "active:bg-primary active:text-primary-foreground disabled:opacity-40",
      )}
    >
      {label}
    </button>
  );
}

export function ManualPad({ carId, disabled }: { carId: CarId; disabled: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Teste manual (segure)
      </span>
      <div className="grid w-fit grid-cols-3 gap-1">
        {PADS.map((p) => (
          <HoldButton key={p.label} carId={carId} {...p} disabled={disabled} />
        ))}
      </div>
    </div>
  );
}
