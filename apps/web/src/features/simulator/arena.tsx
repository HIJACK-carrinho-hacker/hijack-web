import { type CarView, STEERING_MAX } from "@hijack/protocol";
import { TEAM_COLOR_CLASS } from "@/lib/labels";
import { cn } from "@/lib/utils";

const SIZE = 400;

function SimCar({ car }: { car: CarView }) {
  if (!car.sim) return null;
  const color = TEAM_COLOR_CLASS[car.teamId];
  const deg = (car.sim.heading * 180) / Math.PI;
  const wheel = (car.confirmed.steering / STEERING_MAX) * 45;
  return (
    <g transform={`translate(${car.sim.x * SIZE} ${car.sim.y * SIZE}) rotate(${deg})`}>
      <rect x={-20} y={-12} width={40} height={24} rx={5} className={cn(color.fill, !car.telemetry.online && "opacity-30")} />
      <rect x={-17} y={-9} width={14} height={18} rx={2} className="fill-background/40" />
      {[-12, 12].map((dy) => (
        <line
          key={dy}
          x1={11}
          x2={21}
          y1={dy}
          y2={dy}
          transform={`rotate(${wheel} 16 ${dy})`}
          className="stroke-foreground"
          strokeWidth={4}
          strokeLinecap="round"
        />
      ))}
      {car.confirmed.throttle !== 0 && (
        <path
          d={car.confirmed.throttle === 1 ? "M26 0 l8 -5 v10 z" : "M-26 0 l-8 -5 v10 z"}
          className="fill-foreground"
        />
      )}
      <text x={-2} y={4} textAnchor="middle" transform={`rotate(${-deg} -2 0)`} className="fill-background font-mono text-[11px] font-bold">
        {car.teamId}
      </text>
    </g>
  );
}

export function Arena({ cars }: { cars: CarView[] }) {
  return (
    <svg
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      role="img"
      aria-label="Arena simulada com a posição ilustrativa dos carrinhos"
      className="aspect-square w-full rounded-xl border bg-card"
    >
      <defs>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0V40" fill="none" className="stroke-border" strokeWidth={1} />
        </pattern>
      </defs>
      <rect width={SIZE} height={SIZE} fill="url(#grid)" />
      {cars.map((c) => (
        <SimCar key={c.id} car={c} />
      ))}
    </svg>
  );
}
