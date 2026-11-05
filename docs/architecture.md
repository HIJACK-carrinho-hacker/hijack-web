# Arquitetura

```text
navegador (piloto/hacker/admin/simulador)
   │  HTTP /api, /health      WS /ws (state.snapshot, ações)
   ▼
apps/server
   server.ts ── BrowserHub (validação Zod de toda mensagem)
      │          SnapshotBroadcaster (snapshot por visualizador, ≤ 1 a cada 80 ms)
      ▼
   HijackEngine (autoridade única: estado da demo, carros, eventos, métricas)
      │ pilotInput → applyAttack (pipeline puro) → CarController
      ▼
   CarController (seq crescente, coalescência ≤ 20 cmd/s, STOP prioritário, watchdog do servidor)
      ▼
   DeviceAdapter ── SimulatorAdapter (imita o firmware)
                 └─ Esp32Adapter (Fase 7)  /  OfflineHardwareAdapter (hardware ainda não conectado)
```

## Módulos do servidor (`apps/server/src`)

| Caminho | Responsabilidade |
|---|---|
| `config/env.ts` | lê `.env` com Zod; erro lista só nomes de campos (sem valores) |
| `http/app.ts` | Express: `/health`, `/api`, estáticos no modo produção, erros neutros |
| `ws/browser-hub.ts` | conexões de navegador, `parseMessage`, envio com envelope |
| `ws/origin.ts` | checagem do `Origin` no upgrade |
| `ws/broadcaster.ts` | agenda e envia `state.snapshot` por conexão |
| `engine.ts` | `HijackEngine`: máquina de estados da demo, carros, eventos, métricas, snapshot por visualizador |
| `control/pipeline.ts` | `applyAttack`: inversão de eixos, neutro inviolável, bloqueio pela integridade didática |
| `control/car-controller.ts` | envio ao dispositivo, `seq`, limite de taxa, STOP, watchdog do servidor |
| `demo/demo-state.ts` | transições válidas da demonstração |
| `devices/types.ts` | contrato `DeviceAdapter` e eventos do dispositivo |
| `adapters/simulator/` | simulador de carrinho com a mesma semântica do firmware |
| `telemetry/` | log de eventos em anel e métricas (contadores, latência de ack p50/p95) |

## Regras de segurança implementadas

- **Duas barreiras de parada:** o `CarController` para o carro se o piloto não renovar o comando dentro de `COMMAND_TTL_MS`; o dispositivo (simulador ou ESP32) também para sozinho quando a TTL do último comando expira.
- `STOP` nunca passa pelo pipeline de ataque, descarta envios pendentes e não conta no limite de taxa.
- Comando neutro `(0,0)` vira STOP.
- Desconexão do dispositivo → STOP no servidor e estado confirmado zerado; reconexão não retoma movimento.
- Sair de `running` (pausar, encerrar, voltar à configuração) → STOP em todos os carros.
- O simulador e o firmware descartam `seq <= lastSeq`; o `seq` do servidor nunca volta.

## Estado desejado × confirmado

- `desired`: o que o servidor quer aplicar depois do pipeline.
- `confirmed`: o que o dispositivo relatou por `ack`/telemetria. No simulador é imediato; no ESP32 é um relato do firmware, não prova física de movimento.

## Teste manual do operador (`sim.manualDrive`)

Permite mover um carrinho **simulado** na página `/simulator` fora do estado `running`, para conferir a cadeia servidor → adaptador sem pilotos. Usa o mesmo `CarController` (TTL e watchdog). A partir da Fase 3, só o admin pode enviar essa mensagem.

## Frontend (`apps/web/src`)

| Caminho | Responsabilidade |
|---|---|
| `lib/ws-client.ts` | WebSocket com reconexão exponencial, validação das mensagens do servidor, descarte de snapshot antigo |
| `app/hijack-provider.tsx` / `hijack-context.ts` / `hooks/use-hijack.ts` | estado global vindo do servidor |
| `hooks/use-hold-repeat.ts` | repete um comando a cada 100 ms enquanto pressionado e envia a liberação ao soltar |
| `components/hijack/` | componentes do domínio (marca, status, indicador de eixos, eventos, controles da demo) |
| `features/simulator/` | arena SVG, painel do carro, pad de teste manual |
| `features/pilot/` | `joystick-math` (eixos discretos, zona morta, teclas), `Joystick`, `usePilotDrive` (envio imediato + refresh 100 ms + paradas), `useDriveKeys`, `pilotStatus` |
| `features/hacker/`, `features/admin/` | cartões e diálogos do hacker e do operador |
| `lib/api.ts` | chamadas HTTP de sessão e informação pública |
| `pages/` | uma página por rota |
