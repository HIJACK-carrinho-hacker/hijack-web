# Testes

## Como rodar

| Comando | Escopo |
|---|---|
| `bun run test` | `packages/protocol`, `apps/server` e lógica pura de `apps/web/src` (`bun test`) |
| `bun run test:e2e` | Playwright em perfil desktop (Chrome) e mobile (Pixel 7), contra servidor + Vite |
| `cd ../esp32 && pio test -e native` | lógica pura do firmware (Unity) |

Os E2E reutilizam servidor e Vite já em execução (`bun run dev`) ou sobem os seus. Eles chamam `resetEnvironment()` (libera vagas, volta a `setup`, reseta ataques, defesas e senhas) para serem repetíveis, e leem o `ADMIN_SECRET` de `apps/server/.env`.

## Matriz (plano mestre, seção 12)

### Unitários

| Requisito | Onde |
|---|---|
| Transformação dos eixos (direção proporcional negada, sem `-0`) e neutro inviolável (exemplos 8.1 adaptados); `describeVector` com percentual | `apps/server/tests/pipeline.test.ts` |
| Schemas rejeitam `throttle` fora de -1/0/1, `steering` fora de -100..100 ou não inteiro, campos ausentes e extras, tipo/versão/tamanho; `admin.setTopology` | `packages/protocol/tests/protocol.test.ts` |
| Máquina de estados da demo, timeout, seq, coalescência, STOP; giro do simulador proporcional à direção | `engine.test.ts`, `car-controller.test.ts`, `simulator-adapter.test.ts` |
| Etapas do ataque na ordem, só alvo adversário, efeito por carro | `attack-manager.test.ts` |
| Joystick: tração -1/0/1, direção proporcional em passos de 5 limitada a ±100, zona morta, teclas ±100; status do piloto (inclusive carrinho desativado) | `apps/web/src/features/pilot/*.test.ts` |
| CSV sem injeção de fórmula | `export.test.ts` |
| Firmware: parse/validação, failsafe, seq, TTL, estouro de `millis` | `../esp32/test/test_core/test_main.cpp` |

### Integração (servidor + simulador / ESP32 falso)

| Requisito | Onde |
|---|---|
| Login, cookie HttpOnly, vaga ocupada, rate limit, Origin | `auth.test.ts` |
| Role spoofing e controle cruzado A/B falham | `auth.test.ts`, `attack-ws.test.ts` |
| Troca de senha: piloto revogado, senha antiga falha, nova funciona, hash argon2id | `auth.test.ts` |
| Hacker A só modifica B e vice-versa; inversões independentes | `attack-ws.test.ts` |
| Integridade de B bloqueia ataque de A sem bloquear o piloto B | `attack-ws.test.ts` |
| Repetição didática não injeta movimento | `attack-ws.test.ts` |
| STOP não invertido; ataque não move carro parado | `attack-ws.test.ts` |
| Perda do WebSocket do piloto para o carro | `auth.test.ts` |
| Restart: estado de movimento não restaurado | `engine.test.ts` |
| Mensagens malformadas/grandes não derrubam o servidor | `http-ws.test.ts`, `device.test.ts` |
| Reconexão não reexecuta comando antigo | `engine.test.ts`, `device.test.ts` |
| ESP32: autenticação, welcome, drive válido, ack → confirmado, STOP geral, queda, substituição, watchdog relatado | `device.test.ts` |
| Exportação restrita ao operador e sem segredos | `export.test.ts` |
| Topologia `single`: padrão da configuração e TTL 400, `/api/public` com `active`, sem piloto do `car-b`, equipe A só defende, equipe B só ataca o `car-a`, escaneamento só de ativos, integridade da equipe A bloqueia, `admin.setTopology` (fora de `running`, revoga piloto B, reseta ataques) | `topology.test.ts` |

### E2E (Playwright, `apps/web/tests/e2e`)

| Requisito | Arquivo |
|---|---|
| Entrada de piloto/hacker; erro neutro; vaga ocupada | `auth.spec.ts` |
| Troca de senha: antiga falha, nova funciona | `auth.spec.ts` |
| Tela aguarda largada; A/B sem efeito | `pilot.spec.ts` |
| Joystick por mouse/toque e soltar → STOP; teclado WASD; fechar a página para o carro | `pilot.spec.ts` |
| Quatro etapas e inversões independentes | `attack.spec.ts` |
| Integridade bloqueia; repetição só gera evento | `defense.spec.ts` |
| Simulador público × controles do operador | `simulator.spec.ts` |
| Topologia de 1 carrinho: opções de entrada, hacker A defensor, hacker B atacante invertendo o Carrinho A, integridade bloqueando, simulador sem o Carrinho B, `/admin` com o Carrinho B desativado e seletor travado em `running` | `topology.spec.ts` |
| Acessibilidade (axe, WCAG 2 A/AA, sem violações sérias/críticas) em todas as telas | `a11y.spec.ts` |

Os testes do servidor usam `DEMO_TOPOLOGY=dual` por padrão (`testConfig`); os E2E antigos chamam `resetEnvironment(browser, 'dual', …)`, que também define a topologia pelo `admin.setTopology`.

### Hardware (manual)

Ver `../esp32/docs/testing-hardware.md`. Nenhum resultado físico deve ser registrado sem medição real.

## Limitações conhecidas

- Toque real em celular ainda não tem resultado registrado; os E2E de "mobile" usam ponteiro de mouse com viewport e agente de celular.
- Perda de foco e aba oculta são testadas via eventos simulados no navegador.
