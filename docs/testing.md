# Testes

## Como rodar

| Comando | Escopo |
|---|---|
| `bun run test` | `packages/protocol`, `apps/server` e lógica pura de `apps/web/src` (`bun test`) |
| `bun run test:e2e` | Playwright em perfil desktop (Chrome) e mobile (Pixel 7), contra servidor + Vite |
| `cd ../esp32 && pio test -e native` | lógica pura do firmware (Unity) |

Os E2E reutilizam servidor e Vite já em execução (`bun run dev`) ou sobem os seus. Eles chamam `resetEnvironment()` (libera vagas, volta a `setup`, reseta ataques, defesas e senhas) para serem repetíveis, e leem o `ADMIN_SECRET` de `apps/server/.env`. Por isso o servidor precisa ser subido à mão antes (`CAR_A_MODE=simulated CAR_B_MODE=simulated DEMO_TOPOLOGY=dual bun run dev` na raiz): o servidor que o próprio Playwright sobe usa outro segredo (`e2e-admin-secret`) e o login do operador falha.

### Resultado mais recente — informações educativas (17/11/2026)

Lint, typecheck, build e 343 testes passaram. A execução concluída de navegador foi `bun run test:e2e security-info.spec.ts novos-ataques.spec.ts --trace=retain-on-failure`: **16/16**, desktop e Pixel 7 emulado. As tentativas da suíte completa foram interrompidas por falhas e timeouts; houve correções no fechamento por Escape, na seleção do combobox e no encerramento de contextos dos cenários antigos de ataques. Em seguida, a suíte completa (`bun run test:e2e`, servidor subido com `CAR_A_MODE=simulated CAR_B_MODE=simulated DEMO_TOPOLOGY=dual bun run dev`) terminou com **57 aprovados e 1 pulado** (WASD no perfil mobile, que não tem teclado), em 4,1 min; lint, typecheck, build e os 343 testes foram reexecutados e passaram. Não houve teste novo de hardware.

### Conferência manual dos balões

1. Subir a aplicação com os dois carrinhos simulados. Para uma prévia só neste computador: `CAR_A_MODE=simulated CAR_B_MODE=simulated DEMO_TOPOLOGY=dual SERVER_HOST=127.0.0.1 bun run dev`.
2. Abrir `http://127.0.0.1:5173/` no navegador. Em Linux, `xdg-open http://127.0.0.1:5173/` usa o navegador padrão; uma janela lançada por automação pode ficar em outra área de trabalho. Confirmar que a página apareceu antes de dizer que está visível.
3. Usar sessões separadas para operador e hacker (outro perfil ou janela privativa). Abas no mesmo contexto compartilham o cookie: uma sessão de operador pode redirecionar o participante e impedir que apareça o formulário de entrada.
4. Entrar como hacker e abrir a aba Defesa para conferir os quatro ícones. Para os ataques, iniciar pelo operador e completar as três primeiras etapas guiadas; depois pausar a demonstração e ler os balões da etapa 4 sem ligar ataques.
5. Conferir abertura por mouse, clique, toque e teclado; fechamento por Escape, botão de fechar e clique fora; leitura sem cortar o texto em tela pequena. Para capturas, aguardar o fim da animação ou desativá-la na captura.

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
| Ataque zerado ao iniciar nova largada (com evento) e quando o hacker atacante sai (logout, vaga liberada ou expiração da sessão) | `attack-ws.test.ts` |
| Limite de mensagens por conexão: token bucket, rajada recebe `rate_limited` com um aviso por segundo, uso normal não é limitado, piloto sem aviso de erro; `pilot.stop`, comando neutro, `pressed: false` e `admin.stopAll` depois de uma rajada são obedecidos na hora; regra de tempo do joystick (50 ms) em `send-throttle.test.ts` | `rate-limiter.test.ts`, `rate-limit-ws.test.ts`, `send-throttle.test.ts` (só a função pura de tempo; o hook `use-pilot-drive` não tem teste) |
| Depois da pausa ou do STOP ALL o piloto que segurou o joystick só volta a mover depois de soltar (engine e WebSocket); a marca não atravessa a troca de rodada, topologia ou modo; STOP ALL em `ready`/`paused`/`stopped`, com 1 carrinho e com o ESP32 falso | `engine.test.ts`, `simulator-ws.test.ts`, `device.test.ts` |
| Paradas repetidas com o carro parado viram um único `device.stop` (50 ms), parada com o carro andando nunca é suprimida, e uma rajada de 300 `pilot.stop` chega ao ESP32 falso como poucos `device.stop` | `car-controller.test.ts`, `device.test.ts` |
| Confirmado sem dados: online e calado por mais de 1,5 s marca `confirmedStale`, evento novo tira na hora, offline e nenhum dado ainda não marcam, o piloto nunca vê, a virada é transmitida uma vez (relógio falso); o `CarPanel` mostra "sem dados" e não acusa comando alterado | `device-events.test.ts`, `car-panel.test.tsx` |
| Eventos do ESP32 fora de ordem: `ack`, telemetria e `stopped` anteriores à última parada ou ao último comando não sobrescrevem o confirmado nem param um movimento novo; o watchdog do carrinho conta e registra uma vez, atrasado ou não; o watchdog do servidor continua contando uma vez; o eco do firmware a um `device.stop` (dispositivo falso que ecoa, como o firmware real) não conta como watchdog do carrinho | `device-events.test.ts` |
| STOP ALL durante a partida pausa a demonstração (WebSocket) e recusa o piloto que continua segurando o joystick (engine) | `simulator-ws.test.ts`, `engine.test.ts` |
| Perda do WebSocket do piloto para o carro | `auth.test.ts` |
| Restart: estado de movimento não restaurado | `engine.test.ts` |
| Mensagens malformadas/grandes não derrubam o servidor | `http-ws.test.ts`, `device.test.ts` |
| Reconexão não reexecuta comando antigo | `engine.test.ts`, `device.test.ts` |
| ESP32: autenticação, welcome, drive válido, ack → confirmado, STOP geral, queda, substituição, watchdog relatado | `device.test.ts` |
| Exportação restrita ao operador e sem segredos | `export.test.ts` |
| Ataques novos no pipeline: viés (limite ±100, sem `-0`), travamento, replay (só com tração pedida, saída neutra para), ordem, bloqueio por integridade e por repetição | `pipeline.test.ts` |
| Ataques novos no engine: atraso cancelado por qualquer parada (inclusive sem pausar), perda com sorteio injetável sem descartar a soltura, replay de 5 s e histórico só de pedidos aceitos, trava e trava religada, link derrubado (parada, recusa, volta, intervalo e snapshot no fim do intervalo), sequestro (piloto ignorado, só a equipe certa, solta/STOP ALL/pausa/solte e toque de novo), interceptação com limite, telemetria falsa por visualizador, limpeza do estado | `attacks-engine.test.ts` |
| Ataques novos pelo WebSocket: sequestro e queda da conexão do sequestrador, senha forte encerra e bloqueia, analógico do sequestro a 40 Hz sem `rate_limited`, quebra de senha, interceptação e criptografia, 4ª camada, link derrubado e intervalo mantido ao desativar, mudar o atraso descarta atrasados, trava religada, telemetria falsa esconde as mudanças do ataque | `attacks-ws.test.ts`, `attack-manager.test.ts` |
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
| Ataques novos: viés e integridade, interceptação e criptografia, quebra de senha, link derrubado e volta, telemetria falsa no monitor do defensor, sequestro (piloto perde o controle, hacker dirige) | `novos-ataques.spec.ts` |
| Informações educativas: 12 ataques e 4 defesas, ajuda com controles desabilitados, nenhum comando disparado pela ajuda, toque emulado, largura do balão, teclado/fechamento/foco, hover sem roubar foco e auditoria axe com balão aberto | `security-info.spec.ts` |
| Acessibilidade (axe, WCAG 2 A/AA, sem violações sérias/críticas) em todas as telas, inclusive a etapa 4 do hacker com o analógico do sequestro | `a11y.spec.ts` |

Os testes do servidor usam `DEMO_TOPOLOGY=dual` por padrão (`testConfig`); os E2E antigos chamam `resetEnvironment(browser, 'dual', …)`, que também define a topologia pelo `admin.setTopology`.

### Hardware (manual)

Ver `../esp32/docs/testing-hardware.md`. Nenhum resultado físico deve ser registrado sem medição real.

## Limitações conhecidas

- Toque real em celular ainda não tem resultado registrado. Os E2E de "mobile" emulam viewport e agente de celular; os testes dos balões de ataque em `security-info.spec.ts` usam `tap()`, mas isso continua sendo toque emulado. Os testes antigos usam majoritariamente ponteiro de mouse.
- Perda de foco e aba oculta são testadas via eventos simulados no navegador.
