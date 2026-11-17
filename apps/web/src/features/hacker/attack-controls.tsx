import type { AttackConfig, AttackView } from "@hijack/protocol";
import { type ReactNode, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_DEAD_ZONE } from "@/features/pilot/joystick-math";
import { Joystick } from "@/features/pilot/joystick";
import { usePilotDrive } from "@/features/pilot/use-pilot-drive";
import { useHijack } from "@/hooks/use-hijack";
import { BIAS_OPTIONS, DELAY_OPTIONS, DROP_OPTIONS, type Option, hijackRejection } from "./attack-options";
import { SecurityInfo } from "./security-info";
import { ATTACK_EXPLANATIONS } from "./security-info-content";

const REJECTION_VISIBLE_MS = 2500;

type BooleanKey = {
  [K in keyof AttackConfig]: AttackConfig[K] extends boolean ? K : never;
}[keyof AttackConfig];

type NumberKey = "steeringBias" | "delayMs" | "dropPct";

export interface ControlProps {
  attack: AttackView;
  disabled: boolean;
  configure: (patch: Partial<AttackConfig>) => void;
}

export function ControlGroup({ title, hint, children }: { title: string; hint: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <h4 className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{title}</h4>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </section>
  );
}

function ToggleRow({ id, label, attack, disabled, configure }: ControlProps & { id: BooleanKey; label: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={`atk-${id}`} className="text-base">{label}</Label>
        <SecurityInfo label={label} explanation={ATTACK_EXPLANATIONS[id]} />
      </div>
      <Switch
        id={`atk-${id}`}
        checked={attack[id]}
        disabled={disabled}
        onCheckedChange={(v) => configure({ [id]: v })}
      />
    </div>
  );
}

function ChoiceRow({
  id,
  label,
  options,
  attack,
  disabled,
  configure,
}: ControlProps & { id: NumberKey; label: string; options: readonly Option[] }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border bg-card px-3 py-2">
      <div className="flex items-center gap-1">
        <Label htmlFor={`atk-${id}`} className="text-base">{label}</Label>
        <SecurityInfo label={label} explanation={ATTACK_EXPLANATIONS[id]} />
      </div>
      <Select
        value={String(attack[id])}
        disabled={disabled}
        onValueChange={(v) => configure({ [id]: Number(v) } as Partial<AttackConfig>)}
      >
        <SelectTrigger id={`atk-${id}`} className="min-w-36">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={String(o.value)}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function SabotageControls(p: ControlProps) {
  return (
    <ControlGroup
      title="Sabotagem dos comandos"
      hint="Só agem enquanto o piloto adversário estiver dirigindo. Parar nunca é alterado."
    >
      <ToggleRow {...p} id="invertThrottle" label="Frente ↔ Ré" />
      <ToggleRow {...p} id="invertSteering" label="Esquerda ↔ Direita" />
      <ChoiceRow {...p} id="steeringBias" label="Viés de direção" options={BIAS_OPTIONS} />
      <ToggleRow {...p} id="lockSteering" label="Travar direção" />
      <ToggleRow {...p} id="replay" label="Replay (repete 5 s atrás)" />
      <ChoiceRow {...p} id="delayMs" label="Atraso" options={DELAY_OPTIONS} />
      <ChoiceRow {...p} id="dropPct" label="Perda de pacotes" options={DROP_OPTIONS} />
    </ControlGroup>
  );
}

export function EspionageControls(
  p: ControlProps & { cracking: boolean; onCrack: () => void },
) {
  const { attack } = p;
  return (
    <ControlGroup
      title="Espionagem"
      hint="O tráfego mostrado é o que o próprio servidor recebe e envia; nenhuma rede é capturada."
    >
      <ToggleRow {...p} id="intercept" label="Interceptar tráfego" />
      {attack.intercept && attack.intercepted.some((e) => e.encrypted) && (
        <Badge variant="outline" className="w-fit border-warning/50 text-warning">
          Tráfego cifrado pelo defensor: ilegível
        </Badge>
      )}
      {attack.intercept && (
        <ol
          aria-label="Tráfego interceptado"
          className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-lg border bg-card p-2 font-mono text-xs"
          tabIndex={0}
        >
          {attack.intercepted.length === 0 && <li className="text-muted-foreground">Aguardando tráfego do piloto…</li>}
          {attack.intercepted.map((e, i) => (
            <li key={`${e.at}-${i}`} className="flex gap-2 break-all">
              <span className="shrink-0 text-muted-foreground">{new Date(e.at).toLocaleTimeString("pt-BR")}</span>
              <span className={e.encrypted ? "text-muted-foreground" : "text-foreground"}>{e.text}</span>
            </li>
          ))}
        </ol>
      )}
      <div className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-base">Quebrar senha</span>
            <SecurityInfo label="Quebrar senha" explanation={ATTACK_EXPLANATIONS.crackPassword} />
          </div>
          <Button variant="secondary" size="sm" disabled={p.disabled} onClick={p.onCrack}>
            {p.cracking ? "Testando senhas…" : "Ataque de dicionário"}
          </Button>
        </div>
        <p role="status" className="font-mono text-xs">
          {attack.crackReport}
        </p>
      </div>
    </ControlGroup>
  );
}

export function ChannelControls(p: ControlProps & { onJam: () => void }) {
  const { attack } = p;
  const jammed = attack.jammedUntil !== null;
  const cooling = !jammed && attack.jamReadyAt !== null;
  return (
    <ControlGroup
      title="Canal e telemetria"
      hint="Derrubar o link é simulado: o servidor deixa de enviar comandos e o failsafe real do carrinho o para."
    >
      <div className="flex flex-col gap-2 rounded-lg border bg-card px-3 py-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <span className="text-base">Derrubar o link</span>
            <SecurityInfo label="Derrubar o link" explanation={ATTACK_EXPLANATIONS.jamLink} />
          </div>
          <Button variant="secondary" size="sm" disabled={p.disabled || jammed || cooling} onClick={p.onJam}>
            Derrubar por 5 s
          </Button>
        </div>
        {(jammed || cooling) && (
          <p role="status" className={jammed ? "text-sm text-warning" : "text-sm text-muted-foreground"}>
            {jammed
              ? "Link derrubado: o carrinho parou e não recebe comandos."
              : "Link restabelecido; aguarde para derrubar de novo."}
          </p>
        )}
      </div>
      <ToggleRow {...p} id="spoofTelemetry" label="Falsificar telemetria" />
    </ControlGroup>
  );
}

function HijackPad({ running }: { running: boolean }) {
  const drive = usePilotDrive(running, "hijack");
  const { subscribe } = useHijack();
  const [rejection, setRejection] = useState<string | null>(null);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const off = subscribe((msg) => {
      if (msg.type !== "pilot.commandRejected") return;
      setRejection(hijackRejection(msg.payload.code));
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setRejection(null), REJECTION_VISIBLE_MS);
    });
    return () => {
      off();
      if (timer) clearTimeout(timer);
    };
  }, [subscribe]);
  return (
    <div className="flex flex-col items-center gap-2">
      <Joystick
        key={drive.resetKey}
        deadZone={DEFAULT_DEAD_ZONE}
        onChange={drive.update}
        label="Analógico do sequestro: arraste para dirigir o carrinho adversário; solte para parar"
        className="w-full max-w-56"
      />
      <span className="font-mono text-xs text-muted-foreground">Analógico do sequestro</span>
      <p role="status" className="min-h-5 text-sm text-warning">
        {rejection}
      </p>
    </div>
  );
}

export function HijackControls(p: ControlProps & { running: boolean }) {
  return (
    <ControlGroup
      title="Sequestro"
      hint="Usa a senha roubada do alvo: com a senha forte trocada, o sequestro é recusado. O STOP geral sempre vence."
    >
      <ToggleRow {...p} id="hijack" label="Sequestrar o carrinho" />
      {p.attack.hijack && <HijackPad running={p.running} />}
    </ControlGroup>
  );
}
