# Protocolo WebSocket — versão 1

Fonte de verdade em código: `packages/protocol/src/schema.ts` (schemas Zod) e `constants.ts`. Este documento explica as regras; a seção 7 do plano mestre traz o contrato de origem.

## Endpoints

| Caminho | Quem conecta | Autenticação |
|---|---|---|
| `GET /health` | qualquer | nenhuma; não expõe dados sensíveis |
| `GET /api/public` | qualquer | carrinhos, modo, se a dica de senha padrão aparece, vagas ocupadas, se há admin |
| `GET /api/session` | navegador | `me` da sessão atual ou 401 |
| `POST /api/session` | navegador | `{name, role, carId, carDisplayName?, password}` → cookie `hijack_session` (`HttpOnly; SameSite=Strict`). Erros: 400 `invalid_payload`, 401 `invalid_credentials`, 409 `slot_taken`, 429 `rate_limited` (com `Retry-After`) |
| `DELETE /api/session` | navegador | sai, libera a vaga e apaga o cookie |
| `POST /api/admin/session` | operador | `{secret}` → mesmo cookie, sessão de operador |
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

`step` indica a **última etapa concluída**: `locked` (nada feito) → `scan` → `target` → `exploit` → `manipulate`.

| Mensagem | Exige | Efeito |
|---|---|---|
| `attack.scan` | `running` | lista os carrinhos cadastrados (sem varredura real) |
| `attack.selectTarget {targetCarId}` | `running`, etapa ≥ `scan`, alvo = carrinho adversário | define o alvo |
| `attack.exploitDemo` | `running`, etapa ≥ `target` | gera o relatório simulado |
| `attack.configure {invertThrottle, invertSteering}` | `running`, etapa ≥ `exploit` | liga/desliga cada inversão; `active` = alguma ligada |
| `attack.disable` | qualquer estado | desliga as inversões (progresso mantido) |

Erros: `demo_not_running`, `attack_step_invalid`, `forbidden` (alvo da própria equipe). Pausar preserva o progresso. A troca de senha **não** bloqueia a inversão (pré-projeto: a senha forte "não impede por si só alterações nos comandos feitas por um componente autorizado"); só a integridade didática bloqueia.

## Defesa didática

| Mensagem | Quem | Efeito |
|---|---|---|
| `defense.setIntegrityDemo {enabled}` | hacker, no próprio carrinho | liga/desliga o bloqueio das inversões no servidor (`applyAttack` devolve o comando original e conta `blocked`) |
| `defense.setReplayDemo {enabled}` | hacker, no próprio carrinho | liga/desliga; cada `enabled: true` registra um exemplo didático de comando antigo recusado; nunca move o carrinho |

`level` = número de camadas demonstradas entre senha forte, integridade e repetição. Funciona em qualquer estado da demonstração. O reset do operador com `resetDefenses` desliga integridade e repetição (a senha só volta com `resetPasswords`).

## Solicitado × confirmado

`cars[].requested` é o comando que o piloto pediu (zerado quando parado). O simulador mostra `requested` ao lado de `confirmed` e destaca "comando alterado no caminho" quando diferem.

## Visibilidade

- Piloto: `requested`/`desired`/`confirmed` sempre zerados, `attacks` vazio, só eventos públicos.
- Hacker: o próprio ataque, a defesa do próprio carrinho, eventos públicos, de "staff" (comando alterado/bloqueado, ataque ativado) e da própria equipe.
- Espectador (`/simulator`) e operador: todos os ataques e defesas; eventos marcados só para o operador não aparecem ao espectador.
- Depois de uma ação aceita, o autor recebe o `state.snapshot` atualizado antes do `action.ok`.

## Autorização por tipo

| Mensagem | Quem pode |
|---|---|
| `session.resume`, `session.logout` | qualquer conexão |
| `pilot.drive`, `pilot.stop` | piloto (carro da sessão) |
| `attack.*`, `defense.*`, `auth.changePassword` | hacker (`auth.changePassword` altera o carro da sessão) |
| `admin.*`, `sim.manualDrive` | operador |

Sem sessão → `unauthenticated`; papel errado → `forbidden`. `pilot.drive` aceito não gera `action.ok` (evita ruído a 10 Hz); recusado gera `pilot.commandRejected`.

Ao abrir a conexão, o servidor envia `session.accepted` (se houver sessão) e um `state.snapshot`. Sessão revogada → `session.revoked {reason}`, e a conexão passa a ser de visitante.

## Mensagens de operação

- `sim.manualDrive {carId, throttle, steering}`: teste manual de um carro **simulado** fora de `running` (admin).
- `admin.setCarMode {carId, mode}`, `admin.releaseSlot {carId, role}`, `admin.setDemoState`, `admin.stopAll`, `admin.resetDemo {resetAttacks, resetDefenses, resetPasswords}` (só fora de `running`; senhas só voltam a `1234` com `resetPasswords: true`).
- O servidor responde `action.ok {type}` (com `requestId`) quando a ação é aceita, ou `system.error`.

## Servidor ↔ ESP32

Servidor → dispositivo: `device.welcome`, `device.drive` (`seq` positivo, `speedMode: "fixed"`, `commandTtlMs`), `device.stop`, `device.heartbeat`.
Dispositivo → servidor: `device.hello`, `device.ack`, `device.telemetry`, `device.fault`, `device.stopped`.

- `seq <= lastSeq` é descartado pelo firmware.
- A TTL conta a partir do recebimento, no relógio monotônico do ESP32.
- `device.heartbeat` não prolonga o watchdog de movimento.
- Sequência e TTL são requisitos de confiabilidade, **não** a camada didática de "proteção contra repetição".
