# Protocolo WebSocket — versão 1

Fonte de verdade em código: `packages/protocol/src/schema.ts` (schemas Zod) e `constants.ts`. Este documento explica as regras; a seção 7 do plano mestre traz o contrato de origem.

## Endpoints

| Caminho | Quem conecta | Autenticação |
|---|---|---|
| `GET /health` | qualquer | nenhuma; não expõe dados sensíveis |
| `GET /api/public` | qualquer | `topology`, carrinhos (modo, `active`, dica de senha padrão, vagas ocupadas), se há admin |
| `GET /api/session` | navegador | `me` da sessão atual ou 401 |
| `POST /api/session` | navegador | `{name, role, carId, carDisplayName?, password}` → cookie `hijack_session` (`HttpOnly; SameSite=Strict`). Erros: 400 `invalid_payload`, 401 `invalid_credentials`, 403 `forbidden` (piloto de carrinho desativado pela topologia), 409 `slot_taken`, 429 `rate_limited` (com `Retry-After`) |
| `DELETE /api/session` | navegador | sai, libera a vaga e apaga o cookie |
| `POST /api/admin/session` | operador | `{secret}` → mesmo cookie, sessão de operador |
| `WS /ws` | navegador | `Origin` igual ao `Host` ou listado em `ALLOWED_ORIGINS`; cookie de sessão; autorização por mensagem |
| `WS /device` | ESP32 | `device.hello` em até 3 s com `deviceId` + segredo (`DEVICE_SECRET_CAR_A/B`, comparação em tempo constante); fecha com 4401/4408/4429; nova conexão do mesmo carrinho fecha a anterior com 4409 |

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
5. Schema falhou (`throttle` fora de -1/0/1, `steering` fora de -100..100 ou não inteiro, campo ausente, **campo extra**) → `invalid_payload`.

Os payloads são `strictObject`: campos extras (por exemplo `teamId` ou `role` enviados pelo navegador) são rejeitados. O servidor nunca usa time, papel ou carro vindos da mensagem; usa sempre a sessão.

## Eixos

- `throttle`: -1 ré, 0 neutro, 1 frente. **Velocidade fixa**: o piloto nunca controla velocidade proporcional.
- `steering`: **inteiro de -100 a +100** (percentual de direção proporcional; **positivo = direita**, negativo = esquerda, 0 = centro). Vale em `pilot.drive`, `sim.manualDrive`, `requested`/`desired`/`confirmed`, `device.drive`, `device.ack` e `device.telemetry`. O firmware mapeia ±100 para o curso validado do servo (até ±45° em torno do centro calibrado).
- Neutro = `throttle 0` e `steering 0` (vira STOP). `throttle 0` com `steering ≠ 0` é comando válido: o servo vira e os motores ficam parados.
- O analógico do piloto gera `steering` em passos de 5 (zona morta ajustável); teclado A/D/setas mandam ±100.
- TTL padrão do comando: **400 ms** (`DEFAULT_COMMAND_TTL_MS`; faixa recomendada 300–500 ms).

## Estado público (`state.snapshot`)

| Campo | Significado |
|---|---|
| `demoState` | `setup`, `ready`, `running`, `paused`, `stopped` |
| `topology` | `single` (1 carrinho, só o `car-a` ativo) ou `dual` (2 carrinhos) |
| `cars[].active` | se o carrinho participa da topologia atual (o `car-b` fica `false` em `single`) |
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
| `attack.scan` | `running` | lista os carrinhos **ativos** cadastrados (sem varredura real) |
| `attack.selectTarget {targetCarId}` | `running`, etapa ≥ `scan`, alvo = carrinho adversário e ativo | define o alvo |
| `attack.exploitDemo` | `running`, etapa ≥ `target` | gera o relatório simulado |
| `attack.configure {invertThrottle, invertSteering}` | `running`, etapa ≥ `exploit` | liga/desliga cada inversão; `active` = alguma ligada |
| `attack.disable` | qualquer estado | desliga as inversões (progresso mantido) |

A inversão de direção **nega o percentual** (−60 → 60, −100 → 100; 0 continua 0, sem `-0`) e preserva a intensidade; a inversão de tração troca 1 ↔ −1. Exemplos: `(1,-100)` com inversão de direção → `(1,100)`; `(1,-60)` com ambas → `(-1,60)`; `(0,0)` nunca muda.

Erros: `demo_not_running`, `attack_step_invalid`, `forbidden` (alvo da própria equipe, carrinho desativado ou equipe sem papel de ataque na topologia). Pausar preserva o progresso. O ataque de uma equipe é zerado ao sair de `stopped` (nova largada, com o evento "Ataques zerados para a nova largada" se havia progresso) e desativado quando o hacker dessa equipe sai (logout, `admin.releaseSlot`, nova entrada ou expiração da sessão). A troca de senha **não** bloqueia a inversão (pré-projeto: a senha forte "não impede por si só alterações nos comandos feitas por um componente autorizado"); só a integridade didática bloqueia.

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

### Topologia de 1 carrinho (`single`)

| Participante | Sessão | Pode |
|---|---|---|
| Piloto do Carrinho A | `car-a`, equipe A | dirigir o `car-a` |
| Hacker da equipe A | `car-a`, equipe A | **só defender** o `car-a` (`defense.*`, `auth.changePassword`); `attack.*` → `forbidden` ("a equipe A defende") |
| Hacker da equipe B | `car-b`, equipe B (entra com a senha guardada para o `car-b`, a "senha da equipe B") | **só atacar** o `car-a`; `defense.*` e `auth.changePassword` → `forbidden` |
| Piloto do `car-b` | — | não existe: login → 403 `forbidden` |

O snapshot do hacker A não traz ataques; o do hacker B não traz defesas; operador e espectador veem só o ataque da equipe B. Em `dual` tudo funciona como antes.

Sem sessão → `unauthenticated`; papel errado → `forbidden`. **Limite por conexão do navegador** (token bucket): mensagens `pilot.*` até 40/s; as demais até 10/s com rajada de 20. O excedente é descartado; nas mensagens não `pilot.*` a conexão recebe `rate_limited` (no máximo um aviso por segundo) e o excedente de `pilot.*` é descartado sem aviso. **Mensagens de parada nunca são limitadas**: `pilot.stop`, `pilot.drive` neutro ou com `pressed: false`, `admin.stopAll` e `session.logout`. O limite vale por conexão (várias conexões com o mesmo cookie o contornam). A tela do piloto envia `pilot.drive` no máximo a cada 50 ms (≈ 20/s). `pilot.drive` aceito não gera `action.ok` (evita ruído a 10 Hz); recusado gera `pilot.commandRejected`. Um comando ativo recusado com a partida em `paused` marca o carro: a marca é limpa por qualquer comando neutro, por `pilot.stop`, pela queda do WebSocket do piloto, pela revogação ou expiração da sessão e ao trocar a rodada, a topologia ou o modo do carro; depois de retomar, comandos ativos geram `pilot.commandRejected` com `release_required` até chegar um comando neutro (`pressed: false` ou `throttle 0` e `steering 0`).

Ao abrir a conexão, o servidor envia `session.accepted` (se houver sessão) e um `state.snapshot`. Sessão revogada → `session.revoked {reason}`, e a conexão passa a ser de visitante.

## Mensagens de operação

- `sim.manualDrive {carId, throttle, steering}`: teste manual de um carro **simulado** fora de `running` (admin).
- `admin.setTopology {topology}`: só fora de `running`; para todos os carros, reseta os ataques e revoga sessões de piloto de carrinhos que ficaram desativados.
- `admin.setCarMode {carId, mode}`, `admin.releaseSlot {carId, role}`, `admin.setDemoState`, `admin.stopAll` (para todos os carros e, se a partida estiver em `running`, muda para `paused`; sem isso o piloto que segue segurando o joystick retomaria o movimento em ~100 ms), `admin.resetDemo {resetAttacks, resetDefenses, resetPasswords}` (só fora de `running`; senhas só voltam a `1234` com `resetPasswords: true`).
- O servidor responde `action.ok {type}` (com `requestId`) quando a ação é aceita, ou `system.error`.

## Servidor ↔ ESP32

Servidor → dispositivo: `device.welcome`, `device.drive` (`seq` positivo, `speedMode: "fixed"`, `commandTtlMs`), `device.stop`, `device.heartbeat`.
Dispositivo → servidor: `device.hello`, `device.ack`, `device.telemetry`, `device.fault`, `device.stopped`.

- `device.welcome {carId, commandTtlMs}` é enviado após o `hello` válido; o firmware só aceita `device.drive` depois dele e zera `lastSeq` a cada conexão.
- O servidor envia `device.heartbeat` a cada 1 s e ping WebSocket a cada 2 s; encerra a conexão depois de 3 pings seguidos sem pong (≈ 6 s). A parada do movimento não depende disso: sem `device.drive` válido a TTL de 400 ms para o carrinho. O firmware pinga o servidor a cada 2 s e desconecta depois de 3 pongs perdidos de 2 s.
- `seq <= lastSeq` é descartado pelo firmware.
- O servidor numera com o mesmo `seq` crescente os `device.drive` e os `device.stop` de um carro. Eventos do dispositivo que chegam atrasados não valem sobre o estado mais novo: `device.ack` e `device.telemetry` com `seq`/`lastSeq` menor que o do último `device.stop` enviado não alteram o "Confirmado"; `device.stopped` com `lastSeq` menor que o do último `device.drive` enviado não para o movimento nem zera o confirmado. O contador e o registro de watchdog do carrinho valem mesmo para um `stopped` atrasado, mas não para o eco: o firmware responde a todo `device.stop` com `device.stopped` (motivo recebido e `lastSeq` igual ao `seq` do stop), e um `stopped` cujo `lastSeq` é o `seq` de um dos últimos 256 `device.stop` enviados (o servidor os lembra) não é contado como watchdog do carrinho, mesmo que chegue depois de um stop mais novo. Um watchdog legítimo do firmware carrega o `seq` de um `device.drive`.
- A TTL conta a partir do recebimento, no relógio monotônico do ESP32.
- `device.heartbeat` não prolonga o watchdog de movimento.
- Sequência e TTL são requisitos de confiabilidade, **não** a camada didática de "proteção contra repetição".
