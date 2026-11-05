export function ActionButtons() {
  return (
    <div className="flex flex-col items-center gap-3">
      <div className="flex items-center gap-6">
        {[
          { label: "A", key: "J" },
          { label: "B", key: "K" },
        ].map((b, i) => (
          <div key={b.label} className={i === 1 ? "-translate-y-5 flex flex-col items-center gap-2" : "flex flex-col items-center gap-2"}>
            <button
              type="button"
              disabled
              aria-label={`Botão ${b.label}: função não definida`}
              className="flex size-20 items-center justify-center rounded-full border-2 border-border bg-card font-mono text-3xl font-bold text-subtle shadow-inner disabled:cursor-not-allowed"
            >
              {b.label}
            </button>
            <span className="font-mono text-[10px] text-subtle">[{b.key}]</span>
          </div>
        ))}
      </div>
      <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        <span aria-hidden className="size-1.5 rounded-full bg-subtle" /> Botões de ação · função não definida
      </span>
    </div>
  );
}
