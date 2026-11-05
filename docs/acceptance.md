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
| Testes automáticos verdes e README reproduz execução limpa | ✅ | clone limpo dos dois repositórios: `bun install`, `lint`, `typecheck`, `test` (134), `build`; `pio run`, `pio test -e native` (13). E2E: 29 + 1 pulado na cópia de trabalho |
| Métricas separam simulado e hardware | ✅ | `MetricsRegistry` indexado por carro **e** modo; coluna `mode` na exportação (`export.test.ts`) |

## Pronto para demonstração física

| Item | Situação | Observação |
|---|---|---|
| Pinos reais confirmados; servo escolhido e calibrado | ⏳ | `esp32/include/pins.h` com os pinos do pré-projeto; `SERVO_DIRECAO_SINAL_PWM` e pulsos em `calibracao.h` ainda não definidos (o ambiente com saídas ligadas recusa compilar) |
| Alimentação do ESP32 e servo medida e estável sob carga | ⏳ | ver `esp32/docs/hardware.md` |
| Tração e esterçamento testados com rodas suspensas | ⏳ | checklist em `esp32/docs/testing-hardware.md` |
| Watchdog real para o carro em perda de WS/Wi-Fi | ⏳ | implementado e testado só em lógica (`pio test`) e com ESP32 falso; tempo real não medido |
| STOP ALL e parada física comprovados | ⏳ | — |
| Dois ESP32 juntos na LAN isolada | ⏳ | — |
| Medições documentadas sem resultados inventados | ⏳ | nenhum número físico foi registrado |

## Pendências e riscos conhecidos

1. **Servo:** pino, pulsos e geometria da direção.
2. **Alimentação:** 5 V da L298N não validado; provável regulador externo.
3. **GPIO14 (ENA)** emite PWM no boot: verificar tranco do motor A.
4. **Polaridade** dos motores e `TRACAO_PWM_VELOCIDADE_FIXA_0_A_255` a ajustar em bancada.
5. **Convivência PWM:** `analogWrite` (L298N) e `ESP32Servo` usam o LEDC do ESP32; compila, mas o funcionamento simultâneo só será confirmado no hardware.
6. **`enableLoopWDT`:** comportamento de reinício por travamento não testado na placa.
7. **Toque real em celular:** sem resultado registrado.
8. **Riscos aceitos** (detalhes em `security-model.md`): sem TLS na LAN; sessões em memória; no `bun run dev` o rate limit vê todos os aparelhos com o IP do proxy; erros repetidos de senha podem bloquear temporariamente a entrada num carrinho.
