import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { MAX_DEAD_ZONE, MIN_DEAD_ZONE } from "./joystick-math.ts";

export function DeadZoneSetting({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Ajustes do controle" className="text-muted-foreground">
          <Settings2 />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="flex w-64 flex-col gap-3">
        <Label htmlFor="dead-zone">Zona morta do analógico: {Math.round(value * 100)}%</Label>
        <Slider
          id="dead-zone"
          min={MIN_DEAD_ZONE}
          max={MAX_DEAD_ZONE}
          step={0.05}
          value={[value]}
          onValueChange={(v) => onChange(v[0] ?? value)}
        />
        <p className="text-xs text-muted-foreground">Distância mínima do centro para o comando valer.</p>
      </PopoverContent>
    </Popover>
  );
}
