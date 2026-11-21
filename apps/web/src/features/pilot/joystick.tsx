import { type PointerEvent, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { type Axes, axesFromVector, clampToUnitCircle } from "./joystick-math.ts";

interface JoystickProps {
  deadZone: number;
  onChange: (axes: Axes, pressed: boolean) => void;
  className?: string;
  label?: string;
}

const TRAVEL = 0.62;

export function Joystick({
  deadZone,
  onChange,
  className,
  label = "Analógico: arraste para dirigir; solte para parar",
}: JoystickProps) {
  const ref = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const lastThrottle = useRef<Axes["throttle"]>(0);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const move = (e: PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const radius = (rect.width / 2) * TRAVEL;
    const raw = {
      x: (e.clientX - (rect.left + rect.width / 2)) / radius,
      y: (e.clientY - (rect.top + rect.height / 2)) / radius,
    };
    const p = clampToUnitCircle(raw.x, raw.y);
    setKnob(p);
    const axes = axesFromVector(p.x, p.y, deadZone, lastThrottle.current);
    lastThrottle.current = axes.throttle;
    onChange(axes, true);
  };

  const release = () => {
    if (pointer.current === null) return;
    pointer.current = null;
    lastThrottle.current = 0;
    setActive(false);
    setKnob({ x: 0, y: 0 });
    onChange({ throttle: 0, steering: 0 }, false);
  };

  return (
    <div
      ref={ref}
      role="application"
      aria-label={label}
      className={cn("@container relative aspect-square touch-none select-none", className)}
      onPointerDown={(e) => {
        if (pointer.current !== null) return;
        pointer.current = e.pointerId;
        setActive(true);
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={(e) => {
        if (e.pointerId === pointer.current) move(e);
      }}
      onPointerUp={(e) => {
        if (e.pointerId === pointer.current) release();
      }}
      onPointerCancel={release}
      onLostPointerCapture={release}
      onContextMenu={(e) => e.preventDefault()}
    >
      <svg viewBox="0 0 200 200" className="absolute inset-0 size-full" aria-hidden>
        <circle cx={100} cy={100} r={98} className="fill-card/40 stroke-border" strokeWidth={1.5} />
        <circle cx={100} cy={100} r={74} className="fill-none stroke-border/70" strokeWidth={1} />
        <circle cx={100} cy={100} r={100 * deadZone * TRAVEL} className="fill-none stroke-subtle/40" strokeDasharray="2 4" />
        {[0, 90, 180, 270].map((deg) => (
          <line
            key={deg}
            x1={100}
            y1={8}
            x2={100}
            y2={16}
            transform={`rotate(${deg} 100 100)`}
            className="stroke-subtle"
            strokeWidth={2}
            strokeLinecap="round"
          />
        ))}
      </svg>
      <div
        className={cn(
          "absolute top-1/2 left-1/2 flex size-[38%] items-center justify-center rounded-full border-2 shadow-lg transition-[background-color,border-color]",
          active ? "border-primary/60 bg-secondary" : "border-border bg-card",
        )}
        style={{
          transform: `translate(calc(-50% + ${knob.x * TRAVEL * 50}cqw), calc(-50% + ${knob.y * TRAVEL * 50}cqw))`,
        }}
      >
        <div className="flex size-[62%] items-center justify-center rounded-full border border-border bg-background/60">
          <span className={cn("size-1.5 rounded-full", active ? "bg-primary" : "bg-muted-foreground")} />
        </div>
      </div>
    </div>
  );
}
