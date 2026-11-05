import { ModeBadge } from "@/components/hijack/mode-badge";
import { ParticipantHeader } from "@/components/hijack/participant-header";
import { ActionButtons } from "@/features/pilot/action-buttons";
import { DeadZoneSetting } from "@/features/pilot/dead-zone-setting";
import { Joystick } from "@/features/pilot/joystick";
import { DEFAULT_DEAD_ZONE, MAX_DEAD_ZONE, MIN_DEAD_ZONE } from "@/features/pilot/joystick-math";
import { pilotStatus } from "@/features/pilot/pilot-status";
import { useDriveKeys } from "@/features/pilot/use-drive-keys";
import { usePilotDrive } from "@/features/pilot/use-pilot-drive";
import { useHijack } from "@/hooks/use-hijack";
import { useLocalNumber } from "@/hooks/use-local-number";
import { cn } from "@/lib/utils";

const TONE = {
  primary: "text-primary",
  warning: "text-warning",
  destructive: "text-destructive",
  muted: "text-muted-foreground",
} as const;

export function PilotPage() {
  const { state, me, status } = useHijack();
  const car = state?.cars.find((c) => c.id === me?.carId);
  const st = pilotStatus(status, state?.demoState, car);
  const [deadZone, setDeadZone] = useLocalNumber("hijack.deadZone", DEFAULT_DEAD_ZONE, MIN_DEAD_ZONE, MAX_DEAD_ZONE);
  const drive = usePilotDrive(st.canDrive);
  useDriveKeys(drive.update);

  return (
    <main className="mx-auto flex min-h-svh max-w-4xl flex-col gap-4 overscroll-none px-4 py-4">
      <ParticipantHeader>
        {car && (
          <span className="flex items-center gap-2 text-sm">
            {car.displayName}
            <ModeBadge mode={car.mode} />
          </span>
        )}
      </ParticipantHeader>

      <section className="flex flex-1 flex-col items-center justify-center gap-10 landscape:flex-row landscape:justify-around">
        <div className="flex flex-col items-center gap-3">
          <Joystick
            key={drive.resetKey}
            deadZone={deadZone}
            onChange={drive.update}
            className="w-[min(78vw,20rem)] landscape:w-[min(60svh,20rem)]"
          />
          <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            <span aria-hidden className="size-1.5 rounded-full bg-chart-4/70" /> Analógico L
          </span>
        </div>
        <ActionButtons />
      </section>

      <footer className="flex items-center justify-center gap-2 pb-2">
        <p role="status" aria-live="polite" className={cn("text-center text-base", TONE[st.tone])}>
          {st.label}
        </p>
        <DeadZoneSetting value={deadZone} onChange={setDeadZone} />
      </footer>
      <p className="sr-only">Use W, A, S, D ou as setas do teclado para dirigir no computador.</p>
    </main>
  );
}
