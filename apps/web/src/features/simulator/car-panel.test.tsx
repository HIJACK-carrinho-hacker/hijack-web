import { describe, expect, test } from "bun:test";
import type { CarView } from "@hijack/protocol";
import { renderToStaticMarkup } from "react-dom/server";
import { STOP_REASON_LABEL } from "@/lib/labels";
import { CarPanel } from "./car-panel.tsx";

const car = (over: Partial<CarView> = {}): CarView => ({
  id: "car-a",
  teamId: "A",
  displayName: "Carrinho A",
  mode: "hardware",
  active: true,
  requested: { throttle: 1, steering: 0 },
  desired: { throttle: 1, steering: 0 },
  confirmed: { throttle: -1, steering: 0 },
  confirmedStale: false,
  moving: true,
  stopReason: null,
  telemetry: { online: true, lastSeenAt: null, uptimeMs: null, rssi: null, reconnects: 0, rejectedCommands: 0, lastSeq: 0, watchdogTrips: 0 },
  sim: null,
  ...over,
});

describe("CarPanel", () => {
  test("com dados recentes mostra o confirmado e o alerta de comando alterado", () => {
    const html = renderToStaticMarkup(<CarPanel car={car()} />);
    expect(html).toContain("COMANDO ALTERADO NO CAMINHO");
    expect(html).not.toContain("sem dados");
  });

  test("com o confirmado sem dados mostra o aviso e não acusa comando alterado", () => {
    const html = renderToStaticMarkup(<CarPanel car={car({ confirmedStale: true })} />);
    expect(html).toContain("sem dados");
    expect(html).not.toContain("COMANDO ALTERADO NO CAMINHO");
  });

  test("parado mostra o motivo da parada com o rótulo certo", () => {
    const parado = (stopReason: CarView["stopReason"]) => car({ moving: false, stopReason, confirmed: { throttle: 0, steering: 0 } });
    expect(renderToStaticMarkup(<CarPanel car={parado("demo-not-running")} />)).toContain("Demonstração parada");
    expect(renderToStaticMarkup(<CarPanel car={parado("admin-stop-all")} />)).toContain("STOP geral");
    const semMotivo = renderToStaticMarkup(<CarPanel car={parado(null)} />);
    expect(semMotivo).toContain("—");
    for (const rotulo of Object.values(STOP_REASON_LABEL)) expect(semMotivo).not.toContain(rotulo);
  });

  test("andando mostra em movimento mesmo com motivo de parada antigo", () => {
    const html = renderToStaticMarkup(<CarPanel car={car({ moving: true, stopReason: "watchdog" })} />);
    expect(html).toContain("em movimento");
    expect(html).not.toContain(STOP_REASON_LABEL.watchdog);
  });
});
