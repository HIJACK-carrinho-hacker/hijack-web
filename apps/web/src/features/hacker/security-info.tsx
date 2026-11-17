import { Info, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SecurityExplanation } from "./security-info-content";

export function SecurityInfo({ label, explanation }: { label: string; explanation: SecurityExplanation }) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const pinned = useRef(false);
  const openedByHover = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  const leave = () => {
    cancelClose();
    if (!pinned.current && document.activeElement !== trigger.current) {
      closeTimer.current = setTimeout(() => setOpen(false), 200);
    }
  };

  const changeOpen = (value: boolean) => {
    cancelClose();
    pinned.current = value;
    if (value) openedByHover.current = false;
    setOpen(value);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <Button
          ref={trigger}
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-primary"
          aria-label={`Saiba mais: ${label}`}
          onPointerEnter={(event) => {
            if (event.pointerType !== "mouse") return;
            cancelClose();
            if (!open) openedByHover.current = true;
            setOpen(true);
          }}
          onPointerLeave={leave}
          onKeyDown={(event) => {
            if (event.key !== "Escape" || !open) return;
            event.preventDefault();
            changeOpen(false);
          }}
          onClick={(event) => {
            event.preventDefault();
            changeOpen(!pinned.current);
          }}
        >
          <Info aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        aria-labelledby={titleId}
        align="start"
        sideOffset={8}
        className="max-h-[var(--radix-popover-content-available-height)] w-80 max-w-[calc(100vw-2rem)] gap-3 overflow-y-auto p-4"
        onPointerEnter={cancelClose}
        onPointerLeave={leave}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => {
          if (openedByHover.current) event.preventDefault();
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <h4 id={titleId} className="font-semibold">{label}</h4>
          <Button type="button" variant="ghost" size="icon-xs" aria-label="Fechar explicação" onClick={() => changeOpen(false)}>
            <X aria-hidden="true" />
          </Button>
        </div>
        <div className="space-y-1">
          <p className="font-medium text-primary">Na vida real</p>
          <p className="leading-relaxed text-muted-foreground">{explanation.realWorld}</p>
        </div>
        <div className="space-y-1 border-t pt-3">
          <p className="font-medium">No HIJACK</p>
          <p className="leading-relaxed text-muted-foreground">{explanation.inHijack}</p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
