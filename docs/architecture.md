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
                 └─ Esp32Adapter ◄── DeviceHub (WS /device, autenticação do ESP32)
```

## Módulos do servidor (`apps/server/src`)

| Caminho | Responsabilidade |
|---|---|
| `config/env.ts` | lê `.env` com Zod; erro lista só nomes de campos (sem valores) |
| `http/app.ts` | Express: `/health`, `/api`, estáticos no modo produção, erros neutros |
| `ws/browser-hub.ts` | conexões de navegador, `parseMessage`, envio com envelope |
| `ws/origin.ts` | checagem do `Origin` no upgrade |
| `ws/broadcaster.ts` | agenda e envia `state.snapshot` por conexão |
| `engine.ts` | `HijackEngine`: máquina de estados da demo, topologia (`single`/`dual`, `isActive`), carros, eventos, métricas, snapshot por visualizador |
| `control/pipeline.ts` | `applyAttack`: inversão de tração (1 ↔ −1) e de direção (nega o percentual), neutro inviolável, bloqueio pela integridade didática |
| `control/car-controller.ts` | envio ao dispositivo, `seq`, limite de taxa, STOP, watchdog do servidor |
| `demo/demo-state.ts` | transições válidas da demonstração |
| `devices/types.ts` | contrato `DeviceAdapter` e eventos do dispositivo |
| `adapters/simulator/` | simulador de carrinho com a mesma semântica do firmware; taxa de giro proporcional a `steering/100` |
| `adapters/esp32/esp32-adapter.ts` | envia `device.drive`/`device.stop`/`device.heartbeat` ao ESP32 e converte `ack`/`telemetry`/`stopped`/`fault` em eventos do `DeviceAdapter` |
| `ws/device-hub.ts` | endpoint `/device`: `hello` com segredo, `welcome`, substituição de conexão, ping, liga o socket ao `Esp32Adapter` do carrinho quando ele está em modo hardware |
| `telemetry/` | log de eventos em anel e métricas (contadores, latência de ack p50/p95) |
| `hijack-service.ts` | sessões, autorização por mensagem (inclusive regras da topologia de 1 carrinho), ataques, defesas, troca de senha, ações do operador (`admin.setTopology`), snapshot por visualizador |
| `auth/` | `PasswordStore` (argon2id em arquivo), `SessionStore` (tokens, vagas), leitura de cookie |
| `attacks/attack-manager.ts` | etapas do ataque por equipe e efeito (`effectOn`) sobre o carro alvo |
| `defenses/defense-manager.ts` | integridade e repetição didáticas por carrinho, nível 0–3, texto do exemplo de repetição |
| `safety/throttle.ts` | bloqueio progressivo por falhas |
| `http/api.ts` | rotas `/api` com checagem de Origin |

## Regras de segurança implementadas

- **Duas barreiras de parada:** o `CarController` para o carro se o piloto não renovar o comando dentro de `COMMAND_TTL_MS`; o dispositivo (simulador ou ESP32) também para sozinho quando a TTL do último comando expira.
- `STOP` nunca passa pelo pipeline de ataque, descarta envios pendentes e não conta no limite de taxa.
- Comando neutro `(0,0)` vira STOP.
- Desconexão do dispositivo → STOP no servidor e estado confirmado zerado; reconexão não retoma movimento.
- Sair de `running` (pausar, encerrar, voltar à configuração) → STOP em todos os carros.
- O simulador e o firmware descartam `seq <= lastSeq`; o `seq` do servidor nunca volta.

## Topologia da demonstração

`DEMO_TOPOLOGY` (`.env`, padrão `single`) define o estado inicial; o operador troca no `/admin` (`admin.setTopology`) fora de `running`.

- `single` — 1 carrinho (`car-a`). Equipe A: piloto + hacker que **defende**. Equipe B: só hacker **atacante**, que entra escolhendo "Equipe B" com a senha guardada para o `car-b`. O `car-b` continua existindo no servidor (adaptador e senha), mas fica `active: false`: não aceita comandos, some do `/simulator` e aparece como "desativado" no `/admin`.
- `dual` — 2 carrinhos, cada equipe com piloto e hacker que ataca o carrinho adversário.

A autorização da topologia fica no `HijackService` (`canAttack`/`canDefend`) e no `HijackEngine` (`isActive`, que recusa `pilotInput`/`manualDrive` em carrinho desativado). O frontend só adapta a apresentação.

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
| `features/pilot/` | `joystick-math` (tração discreta, direção proporcional em passos de 5, zona morta, teclas ±100), `Joystick`, `usePilotDrive` (envio imediato + refresh 100 ms + paradas), `useDriveKeys`, `pilotStatus` |
| `features/hacker/`, `features/admin/` | cartões e diálogos do hacker e do operador |
| `lib/api.ts` | chamadas HTTP de sessão e informação pública |
| `pages/` | uma página por rota |
