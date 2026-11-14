# Aceitação — Definition of Done (plano mestre, seção 14)

Revisão de 05/11/2026. Legenda: ✅ verificado · ⚠️ verificado parcialmente · ⏳ pendente.

## Pronto como software simulado

| Item | Situação | Evidência |
|---|---|---|
| Login, papéis, equipes e sessões seguras | ✅ | `auth.test.ts` (cookie HttpOnly/SameSite, vaga exclusiva, rate limit, Origin, spoofing de papel/carro); `auth.spec.ts` |
| Dois carros simulados ao mesmo tempo | ✅ | `engine.test.ts` ("dois carrinhos…"), `attack-ws.test.ts` |
| Controles do piloto em celular e desktop | ⚠️ | E2E em perfil desktop e mobile (`pilot.spec.ts`), verificação manual no Chrome desktop e em largura de celular. **Toque em celular real ainda sem resultado registrado** |
| Soltar o joystick ou perder comunicação faz parar | ✅ | `pilot.spec.ts` (soltar, fechar página), `engine.test.ts` (watchdog), `auth.test.ts` (piloto desconectado), verificação manual do `blur` |
| Quatro etapas do hacker e duas inversões independentes | ✅ | `attack-manager.test.ts`, `attack-ws.test.ts`, `attack.spec.ts` (repetido 4× nos dois perfis) |
| Defensor bloqueia a inversão no servidor e o caráter simulado é exibido | ✅ | `attack-ws.test.ts` (integridade), `defense.spec.ts`; rótulos permanentes "Simulação, não HMAC" / "Simulação, não validação no firmware" |
| Troca real de senha altera a autenticação | ✅ | `auth.test.ts` (hash argon2id persistido, senha antiga falha, piloto revogado), `auth.spec.ts` |
| Repetição didática não se confunde com criptografia | ✅ | só gera evento e não move o carrinho (`attack-ws.test.ts`, `defense.spec.ts`); texto e rótulo explícitos; `security-model.md` |
| Operador faz pausa e STOP ALL | ✅ | `engine.test.ts`, `simulator-ws.test.ts`, `device.test.ts` (STOP chega ao ESP32) |
| Testes automáticos verdes e README reproduz execução limpa | ✅ | clone limpo dos dois repositórios: `bun install`, `lint`, `typecheck`, `test` (134), `build`; `pio run`, `pio test -e native` (13). E2E: 29 + 1 pulado na cópia de trabalho (passo 10: `test` 170, E2E 35 + 1 pulado) |
| Métricas separam simulado e hardware | ✅ | `MetricsRegistry` indexado por carro **e** modo; coluna `mode` na exportação (`export.test.ts`) |

## Atualização da especificação (10/11/2026)

| Critério | Situação | Evidência |
|---|---|---|
| Direção proporcional -100..+100 no protocolo, servidor, simulador e telas; tração continua -1/0/1 | ✅ software | `protocol.test.ts`, `pipeline.test.ts`, `simulator-adapter.test.ts`, `joystick-math.test.ts`, E2E `attack.spec.ts` |
| TTL padrão 400 ms | ✅ software | `topology.test.ts`, `device.test.ts` |
| Topologia de 1 carrinho como padrão, 2 como opção | ✅ software | `topology.test.ts`, E2E `topology.spec.ts` |
| Direção proporcional e failsafe de 400 ms no carrinho real | ⚠️ | firmware `../esp32` (`1e637ba`) implementa o mesmo contrato (steering -100..100, `FAILSAFE_MS` 400, ±45°, rampa) com 26 testes nativos; falta teste físico |

## Validação do hacker (11/11/2026)

| Critério | Situação | Evidência |
|---|---|---|
| Entrada, vagas e autorização do hacker (defensor só defende, atacante só ataca, sem trocar papel/carro por mensagem) | ✅ | Chrome + WebSocket: `forbidden` em `attack.*`/`defense.*`/`pilot.*`/`admin.*` fora do papel; 409, 400 e 403 no login; `auth.test.ts`, `topology.test.ts` |
| Quatro etapas e duas inversões independentes, em `single` e `dual` | ✅ | Chrome com `/simulator`; `attack.spec.ts`, `topology.spec.ts` |
| Defesas: senha real, Integridade e Repetição (rotuladas como simulação) | ✅ | Chrome; `defense.spec.ts`, `auth.test.ts` |
| Inversões (tração e direção) chegam ao ESP32 real e a Integridade as bloqueia | ⚠️ saídas desligadas | serial: `esquerdo=-1 direito=-1` (ré) com ataque de tração, `esquerdo=1 direito=1` com Integridade. Direção: o firmware não a imprime na serial, a evidência é o ack que o ESP32 devolve (o "Confirmado" do `/simulator`): frente + D 60% vira frente + E 60% (só direção), ré + E 60% (as duas) e volta ao original com a Integridade. Não há roda nem servo para observar |
| Reinício do ESP32 com ataque ativo não retoma movimento | ⚠️ saídas desligadas | serial: só `INICIANDO → PARADO` até o novo `device.drive` |
| STOP ALL e Pausar com o piloto ainda dirigindo | ✅ software e ESP32 real (saídas desligadas): a partida pausa e o firmware vai a `PARADO` sem voltar a andar com o piloto seguindo a mandar comandos | STOP ALL passou a pausar a partida (`engine.test.ts`, `simulator-ws.test.ts`, `device.test.ts` com ESP32 falso); serial do ESP32 real: `ANDANDO → PARADO` às 21:52:38 no STOP ALL, sem voltar a andar; parada física com motores ainda ⏳ |
| Exportação restrita ao operador, sem segredos, métricas por modo | ✅ | 401 sem sessão; busca por senhas/segredos/hash sem ocorrências |
| Regressão automática | ✅ | `bun run test` 218 (depois das correções da revisão), Playwright 35 + 1 pulado (rodado antes e de novo depois da correção), `pio test -e native` 28 |

Em aberto: a rede do ESP32 (RSSI −65 a −73 dBm, 20 % de perda, failsafe expirando várias vezes por condução) segue abaixo do necessário; ver `progress.md`.

## Pronto para demonstração física

| Item | Situação | Observação |
|---|---|---|
| Pinos reais confirmados; servo escolhido e calibrado | ⏳ | pinos da equipe (especificação de 10/11/2026): servo GPIO 13; esquerdo ENA 25/IN1 26/IN2 27; direito ENB 21/IN3 18/IN4 19. Fiação física, centro e sentido do servo ainda não conferidos (ver `../esp32`) |
| Alimentação do ESP32 e servo medida e estável sob carga | ⚠️ | parcial: LM2596 em 5 V em vazio e 4,98 V com o ESP32; falta servo, varredura de entrada e motores (`../esp32/docs/proximos-passos-hardware.md`) |
| Tração e esterçamento testados com rodas suspensas | ⏳ | checklist em `esp32/docs/testing-hardware.md` |
| Watchdog real para o carro em perda de WS/Wi-Fi | ⚠️ | com o ESP32 real e as saídas desligadas: rede presa por 3 s (`esp32dev_trava`), failsafe parou em 347, 367, 385 e 399 ms (log serial); falta medir até as rodas pararem, que exige a L298N |
| STOP ALL e parada física comprovados | ⏳ | — |
| Um ESP32 (topologia padrão de 1 carrinho) na LAN isolada | ⚠️ | ESP32 autenticado e pilotado pelo protocolo real (saídas desligadas); 10 min sem queda a −36 a −55 dBm numa mesh doméstica. Em 12/11/2026 três apagões de 3,7 a 9,8 s, coincidindo com a troca de chave da mesh, derrubaram o WebSocket; o firmware passou a perceber junto com o servidor em 5 s (monitor de silêncio), mas no apagão de 9,8 s a tarefa de rede ficou bloqueada (causa ainda não medida; o log `[rede] tarefa bloqueada` existe no código e não foi gravado na placa). Em 14/11/2026, no hotspot do celular (PC e ESP32 no mesmo Wi-Fi 2,4 GHz) 30 min contínuos sem apagão, 3561 pings sem perda e média de 25 ms (saídas desligadas). Falta repetir no local da apresentação e por 60 min |
| Dois ESP32 juntos na LAN isolada (opcional, `dual`) | ⏳ | — |
| Medições documentadas sem resultados inventados | ⚠️ | medições de 10/11/2026 em `../esp32/docs/testing-hardware.md` e `../esp32/docs/progress.md`; motores e servo sem números |

## Pendências e riscos conhecidos

Fonte da parte física: `../esp32/docs/especificacao/` (10/11/2026) e `../esp32/docs/testing-hardware.md`.

1. **Fiação real** dos pinos da equipe (servo 13; esquerdo 25/26/27; direito ENB 21/18/19) e jumpers ENA/ENB retirados.
2. **Servo SG90:** centro, sentido e curso até ±45° calibrados pelo modo serial (`k`), sem forçar o batente (~48°); torque no piso.
3. **Tração:** sentido de cada motor (`MOTOR_*_INVERTE`), `PWM_MINIMO_PCT` e `PWM_CRUZEIRO_PCT` medidos; corrente e aquecimento da L298N.
4. **Alimentação:** HW-411 a 5,0 V sob carga, retroalimentação USB, capacidade da chave do porta-baterias (~3 A não confirmada), 2S **sem BMS** e **sem fusível** (células medidas uma a uma).
5. **Brownout** ao arrancar ou esterçar (o firmware imprime o motivo do reset).
6. **Tempo real de parada** por perda de Wi-Fi/WebSocket e STOP ALL. A parada lógica foi medida com a rede presa (347 a 399 ms, saídas desligadas); falta medir até as rodas.
7. **Toque em celular real:** sem resultado registrado.
8. **Riscos aceitos** (detalhes em `security-model.md`): sem TLS na LAN; sessões em memória; no `bun run dev` o rate limit vê todos os aparelhos com o IP do proxy; erros repetidos de senha podem bloquear temporariamente a entrada.
