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

## Pronto para demonstração física

| Item | Situação | Observação |
|---|---|---|
| Pinos reais confirmados; servo escolhido e calibrado | ⏳ | pinos da equipe (especificação de 10/11/2026): servo GPIO 13; esquerdo ENA 25/IN1 26/IN2 27; direito ENB 21/IN3 18/IN4 19. Fiação física, centro e sentido do servo ainda não conferidos (ver `../esp32`) |
| Alimentação do ESP32 e servo medida e estável sob carga | ⏳ | ver `esp32/docs/hardware.md` |
| Tração e esterçamento testados com rodas suspensas | ⏳ | checklist em `esp32/docs/testing-hardware.md` |
| Watchdog real para o carro em perda de WS/Wi-Fi | ⏳ | implementado e testado só em lógica (`pio test`) e com ESP32 falso; tempo real não medido |
| STOP ALL e parada física comprovados | ⏳ | — |
| Um ESP32 (topologia padrão de 1 carrinho) na LAN isolada | ⏳ | — |
| Dois ESP32 juntos na LAN isolada (opcional, `dual`) | ⏳ | — |
| Medições documentadas sem resultados inventados | ⏳ | nenhum número físico foi registrado |

## Pendências e riscos conhecidos

Fonte da parte física: `../esp32/docs/especificacao/` (10/11/2026) e `../esp32/docs/testing-hardware.md`.

1. **Fiação real** dos pinos da equipe (servo 13; esquerdo 25/26/27; direito ENB 21/18/19) e jumpers ENA/ENB retirados.
2. **Servo SG90:** centro, sentido e curso até ±45° calibrados pelo modo serial (`k`), sem forçar o batente (~48°); torque no piso.
3. **Tração:** sentido de cada motor (`MOTOR_*_INVERTE`), `PWM_MINIMO_PCT` e `PWM_CRUZEIRO_PCT` medidos; corrente e aquecimento da L298N.
4. **Alimentação:** HW-411 a 5,0 V sob carga, retroalimentação USB, capacidade da chave do porta-baterias (~3 A não confirmada), 2S **sem BMS** e **sem fusível** (células medidas uma a uma).
5. **Brownout** ao arrancar ou esterçar (o firmware imprime o motivo do reset).
6. **Tempo real de parada** por perda de Wi-Fi/WebSocket e STOP ALL.
7. **Toque em celular real:** sem resultado registrado.
8. **Riscos aceitos** (detalhes em `security-model.md`): sem TLS na LAN; sessões em memória; no `bun run dev` o rate limit vê todos os aparelhos com o IP do proxy; erros repetidos de senha podem bloquear temporariamente a entrada.
