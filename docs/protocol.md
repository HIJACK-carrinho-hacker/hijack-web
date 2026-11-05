# Protocolo WebSocket — versão 1

Fonte de verdade em código: `packages/protocol/src/schema.ts` (schemas Zod) e `constants.ts`. Este documento explica as regras; a seção 7 do plano mestre traz o contrato de origem.

## Endpoints

| Caminho | Quem conecta | Autenticação |
|---|---|---|
| `GET /health` | qualquer | nenhuma; não expõe dados sensíveis |
| `POST /api/session` | navegador | nome + papel + carrinho + senha → cookie `HttpOnly; SameSite=Strict` (Fase 3) |
| `WS /ws` | navegador | `Origin` igual ao `Host` ou listado em `ALLOWED_ORIGINS`; cookie de sessão; autorização por mensagem |
| `WS /device` | ESP32 | `device.hello` com `deviceId` + segredo do dispositivo (Fase 7) |

## Envelope

Cliente → servidor:

```json
{ "protocolVersion": 1, "type": "pilot.drive", "requestId": "<uuid>", "sentAt": 1790000000000, "payload": { } }
```

Servidor → cliente:

```json
{ "protocolVersion": 1, "type": "state.snapshot", "eventId": 12, "serverTime": 1790000000000, "stateRevision": 40, "requestId": "<uuid opcional>", "payload": { } }
```

- `stateRevision` é monotônica; o cliente descarta `state.snapshot` com revisão menor que a última recebida (reinicia a cada nova conexão).
- `requestId` aparece na resposta quando ela se refere a um pedido do cliente.

## Validação (`parseMessage`)

Ordem e códigos de erro devolvidos em `system.error`:

1. Mais de 2048 bytes → `message_too_large`.
2. JSON inválido ou não-objeto → `bad_request`.
3. `protocolVersion` diferente de 1 → `unsupported_version`.
4. `type` desconhecido → `unknown_type`.
5. Schema falhou (eixo fora de -1/0/1, campo ausente, **campo extra**) → `invalid_payload`.

Os payloads são `strictObject`: campos extras (por exemplo `teamId` ou `role` enviados pelo navegador) são rejeitados. O servidor nunca usa time, papel ou carro vindos da mensagem; usa sempre a sessão.

## Eixos

- `throttle`: -1 ré, 0 neutro, 1 frente.
- `steering`: -1 esquerda, 0 centro, 1 direita.
- Velocidade fixa; não há valor proporcional.

## Estado público (`state.snapshot`)

| Campo | Significado |
|---|---|
| `demoState` | `setup`, `ready`, `running`, `paused`, `stopped` |
| `me` | sessão de quem está vendo (null = visitante) |
| `cars[].desired` | comando calculado pelo servidor depois do pipeline (ataque, defesa, segurança) |
| `cars[].confirmed` | estado relatado pelo dispositivo (simulador ou ESP32); não é prova física de movimento |
| `cars[].mode` | `simulated` ou `hardware`, exibido em toda a UI |
| `cars[].sim` | posição meramente ilustrativa no simulador |
| `attacks` | hacker vê o próprio ataque; admin e simulador veem todos |
| `defenses[].level` | camadas **demonstradas** (0–3), não nível real de segurança |
| `metrics` | somente admin e simulador |

## Etapas do ataque

`locked` (não iniciado) → `scan` → `target` → `exploit` → `manipulate` (inversões liberadas). Tudo é simulado no servidor; `scan` lista apenas os carrinhos cadastrados.

## Servidor ↔ ESP32

Servidor → dispositivo: `device.welcome`, `device.drive` (`seq` positivo, `speedMode: "fixed"`, `commandTtlMs`), `device.stop`, `device.heartbeat`.
Dispositivo → servidor: `device.hello`, `device.ack`, `device.telemetry`, `device.fault`, `device.stopped`.

- `seq <= lastSeq` é descartado pelo firmware.
- A TTL conta a partir do recebimento, no relógio monotônico do ESP32.
- `device.heartbeat` não prolonga o watchdog de movimento.
- Sequência e TTL são requisitos de confiabilidade, **não** a camada didática de "proteção contra repetição".
