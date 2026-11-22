# Premissas e decisões

Distingue **fatos/decisões do grupo**, **decisões técnicas do agente** e **pendências**. Atualizar sempre que uma escolha não especificada for feita.

## 1. Decisões do grupo (pré-projeto + plano mestre)

- Dois carrinhos (A e B), ESP32 + L298N + 2 motores DC + servo de direção; velocidade fixa; curva só pelo servo. **Atualizado em 10/11/2026:** a primeira construção é de 1 carrinho; ver seção 5.
- Dois times, cada um com piloto (celular) e hacker (notebook); sem pontuação, vencedor ou tempo limite.
- Servidor local no notebook; navegadores e ESP32 na mesma Wi-Fi; servidor↔ESP32 por WebSocket.
- Ataque em 4 etapas guiadas simuladas; inversões independentes frente↔ré e esquerda↔direita.
- Defesa: troca **real** de senha; integridade e repetição **simuladas**.
- Botões A/B do piloto visíveis, sem função.

## 2. Decisões tomadas com o usuário nesta implementação (05/11/2026)

| Tema | Decisão |
|---|---|
| Pastas | `projeto_fcsc/web/` (este repo) e `projeto_fcsc/esp32/` (firmware) |
| Git | Um repositório por pasta; commit a cada passo verificado; sem push |
| Firmware | Linguagem Arduino com PlatformIO; placa ESP32-WROOM DevKit (`esp32dev`) |
| Senha | Uma senha **por carrinho**, ambas começam em `1234` |
| Troca de senha | Revoga a sessão do **piloto** daquele carrinho e para o carro; o hacker que trocou continua logado |

## 3. Decisões técnicas do agente

- **Scaffolding com geradores oficiais** (pedido do usuário): `bun init` (raiz, server, protocol), `bun create vite --template react-ts` (web), `shadcn init -t vite -b radix -p nova` + `shadcn add`.
- **Backend Express 5 + `ws`** (usuário preferiu seguir o plano em vez de `Bun.serve`).
- **Ferramentas (usuário aprovou):** lint com **oxlint** (veio no template do Vite), formatação com `bun fmt`, typecheck com `bun check` (Bun 1.4.4, compatível com `tsc`), testes com `bun test` (inclusive lógica pura do frontend) e Playwright para E2E. Biome e Vitest descartados.
- **Sem comentários no código** (pedido do usuário). Explicações vão para `docs/`.
- **TypeScript 7** (vindo dos geradores): sem `baseUrl` e sem parameter properties (`erasableSyntaxOnly` no web).
- **Login por HTTP + cookie:** `POST /api/session` → cookie `HttpOnly; SameSite=Strict`. O upgrade do WebSocket valida cookie e `Origin`; a autorização é refeita em cada mensagem. Os tipos `session.*` continuam no protocolo, mas o login inicial usa HTTP para permitir cookie HttpOnly (evita token em `localStorage`).
- **Dev em mesma origem:** Vite faz proxy de `/api` e `/ws` para o servidor.
- **Hash de senha:** `Bun.password` (argon2id). Persistência em `apps/server/data/state.json` (gitignored, permissão 600). Estado da partida só em memória.
- **Admin:** login separado em `/admin` com `ADMIN_SECRET` do `.env`.
- **ESP32:** WebSocket em `/device`; `device.hello {deviceId, secret}` comparado com `DEVICE_SECRET_A/B` via `timingSafeEqual`.
- **Playwright sem gerador:** o `create-playwright` só usa npm/yarn/pnpm e falha com dependências `workspace:*`. Exceção à regra dos geradores: `bun add -d @playwright/test@1.64.1` + `bunx playwright install chromium` + `playwright.config.ts` mínimo. A versão 1.64.1 foi fixada porque a 1.65.0 publicada referencia um `playwright-core` ainda indisponível no registro.
- **Teste manual do operador** (`sim.manualDrive`): só para carros simulados e fora de `running`. Na Fase 2 ainda não há autenticação; a partir da Fase 3 fica restrito ao admin.
- **STOP não conta no limite de taxa** de 20 cmd/s; só comandos de movimento são coalescidos.
- **Cor da equipe B:** token `chart-4` (`#2b7fff`); a equipe A usa `primary`. As referências não definem cor por equipe.
- **Uma sessão por navegador**; vaga ocupada só é liberada por logout, expiração ou pelo operador. Não há "tomar a vaga" automático.
- **Visitante** (sem sessão) recebe o snapshot público: é o modo da página `/simulator` para projetar ao público.
- **Política de senha forte:** ≥ 8 caracteres, letras e números, diferente de `1234` e da atual.
- **Limites de força bruta:** ver `security-model.md`.
- **Shadcn customizado:** `Input` e `SelectTrigger` usam `dark:bg-card` (#18181b) para bater com a referência.
- **Zona morta** do analógico padrão 30%, ajustável de 10% a 60% no ícone de ajustes; guardada no `localStorage` do aparelho (conveniência local).
- **Parada forçada** (blur, aba oculta, perda de conexão, demonstração fora de `running`) recentraliza a manopla; é preciso tocar de novo para voltar a dirigir.
- **Teclado** (WASD/setas) e analógico compartilham o mesmo envio; vale a última entrada.
- **Piloto não vê** sinalização de comando alterado pelo ataque (padrão do plano 6.2).

## 3.1 Repositórios e infraestrutura (05/11/2026)

- Repositórios privados na organização `HIJACK-carrinho-hacker`: `hijack` (documentação geral, raiz), `hijack-web` (este) e `hijack-esp32`.
- O usuário liberou o uso de PostgreSQL, Redis etc. **se necessário**. Hoje não é: o estado da partida fica em memória de propósito (reinício sempre volta parado), só os hashes das senhas persistem em arquivo, e a escala é de dois carrinhos numa LAN. Candidato a usar PostgreSQL no futuro: histórico de várias apresentações (eventos e métricas por sessão).

## 4. Pendências físicas (não resolvidas por software)

- Pino de sinal do servo e pulsos esquerda/centro/direita (µs).
- Alimentação do ESP32 e do servo (5 V da L298N não validado; provável buck externo).
- Geometria mecânica da direção; polaridade real dos motores.
- Timeout de 400 ms (faixa 300–500 ms) é valor inicial, sujeito a medição.

## 5. Atualização da especificação do carrinho — 10/11/2026

A equipe do carrinho consolidou a especificação do hardware a partir do modelo mecânico final (Fusion v6). Ela fica em `../esp32/docs/especificacao/` (servo SG90 limitado a ±45° do centro calibrado, failsafe, tração, alimentação 2S sem BMS, pinos). Para a aplicação web, ela **substitui** os seguintes pontos do plano mestre (`PLANO_IMPLEMENTACAO_HIJACK.md`):

| Plano mestre | Agora |
|---|---|
| `steering` discreto -1/0/1 | **inteiro de -100 a +100** (direção proporcional; positivo = direita). `throttle` continua -1/0/1 (velocidade fixa; o piloto nunca controla velocidade proporcional) |
| TTL do comando 300 ms | **400 ms** (`DEFAULT_COMMAND_TTL_MS` e padrão de `COMMAND_TTL_MS`; faixa 300–500 ms) |
| Sempre 2 carrinhos, 2 equipes completas | **1 carrinho primeiro** (`DEMO_TOPOLOGY=single`, padrão); 2 carrinhos (`dual`) como opção |
| Exemplos 8.1 com ±1 | Inversão de direção nega o percentual: `(1,-100)` → `(1,100)`; `(1,-60)` com ambas → `(-1,60)`; `(0,0)` intacto |

O firmware (`../esp32`) está sendo alterado em paralelo para o mesmo contrato.

Decisões técnicas desta atualização:

- **Joystick:** fora da zona morta, `steering = sinal × (|x| − zona) / (1 − zona) × 100`, quantizado em passos de 5 (evita enviar uma mensagem a cada pixel) e limitado a ±100; tração pela zona morta vertical. Teclado A/D/setas = ±100. O envio continua imediato a cada mudança, com refresh de 100 ms; a coalescência do servidor (≤ 20 cmd/s) não mudou.
- **Registro de comando alterado:** o evento "Comando alterado: frente + esquerda 60% → ré + direita 60%" é emitido quando muda o **sentido** (sinal) dos eixos, não a cada variação de percentual, para não inundar o registro.
- **Indicador de direção:** a grade 3×3 acende pelo sinal da direção; abaixo, uma barra a partir do centro e o percentual (`E 60%`, `centro`, `D 100%`). O `aria-label` é "Confirmado: frente, direção 60% à direita" / "direção centro".
- **Arena do simulador:** ângulo visual das rodas = `steering/100 × 45°`; giro do carrinho simulado proporcional a `steering/100`.
- **Topologia `single`:** só o `car-a` é ativo. O `car-b` continua cadastrado (adaptador, senha, segredo do dispositivo), mas não recebe comandos e não aparece no simulador. A "senha da equipe B" é a senha guardada para o `car-b`; o hacker B entra com `carId: "car-b"` (sessão da equipe B) e o alvo do ataque é o `car-a` (`OPPONENT_CAR`). O servidor recusa `attack.*` da equipe A e `defense.*`/`auth.changePassword` da equipe B; o hacker B não pode trocar a própria senha nesta topologia (o operador reseta senhas pelo `/admin`).
- **Troca de topologia:** só fora de `running`; para todos os carros, reseta **todos** os ataques e revoga só os pilotos de carrinhos desativados (o hacker B continua logado e vira atacante). Hackers e pilotos da equipe A não são afetados.
- **Visibilidade em `single`:** hacker A não recebe ataques no snapshot (a aba Ataque explica que a equipe A defende); hacker B não recebe defesas (aba Defesa e indicador de segurança ocultos); operador e espectador veem só o ataque da equipe B.
- **Login em `single`:** piloto só vê o Carrinho A; hacker escolhe "Equipe A — defende o Carrinho A" ou "Equipe B — ataca o Carrinho A"; o rótulo da senha da equipe B é "Senha da equipe B" e o campo "Nome do carrinho" some para ela.
- **Testes:** `testConfig` do servidor usa `dual` para manter os testes de 2 carrinhos; `topology.test.ts` e `topology.spec.ts` cobrem `single`.

## 6. Revisão da validação do hacker (11/11/2026)

Decisões tomadas depois da revisão independente (`progress.md`, passo 11):

- **STOP ALL pausa a partida:** com a partida em `running`, o `admin.stopAll` para os carros e muda para `paused`. Antes era só um pulso e o piloto que seguia segurando o joystick retomava o movimento em ~100 ms. Fora de `running` continua sendo só parada.
- **Retomar exige soltar:** um `pilot.drive` ativo recusado enquanto a partida está `paused` (`demo_not_running`) marca o carro; ao retomar, comandos ativos são recusados com o código `release_required` ("solte o joystick e toque de novo") até a marca ser limpa por um comando neutro (`pressed: false` ou `throttle 0` e `steering 0`), por `pilot.stop`, pela queda do WebSocket do piloto ou pela revogação ou expiração da sessão. A marca também é limpa ao trocar a rodada (qualquer estado fora de `running`/`paused`), a topologia ou o modo do carro. Vale para clientes por script; fora da pausa (por exemplo, antes da largada) nada muda. A tela do piloto ignora entradas enquanto está desabilitada e mostra um aviso quando recebe `release_required`.
- **Ataque não sobrevive à rodada nem ao atacante:** os ataques são zerados ao sair de `stopped` (nova largada), com um evento no registro se havia progresso, e o ataque de uma equipe é desativado quando o hacker dessa equipe sai (logout, vaga liberada pelo operador, nova entrada ou expiração da sessão). Antes a inversão da rodada anterior continuava ativa sem dono e o operador não conseguia desligá-la em `running`.
- **Limite de mensagens por conexão do navegador:** token bucket, `pilot.*` até 40/s e as demais até 10/s com rajada de 20; excedente descartado, com `rate_limited` no máximo uma vez por segundo (o excedente de `pilot.*` é descartado sem aviso). **Mensagens de parada nunca são limitadas** (`pilot.stop`, `pilot.drive` neutro ou com `pressed: false`, `admin.stopAll`, `session.logout`): a primeira versão as descartava e a revisão reproduziu o STOP ALL ignorado. A tela do piloto envia no máximo uma mensagem a cada 50 ms. Reduz a inundação do registro por um script autenticado, mas o limite é **por conexão**: várias conexões com o mesmo cookie o contornam. Dispositivos (ESP32) não passam por esse limite.
- **Paradas repetidas:** o `CarController` não repete `device.stop` se o carro já estava parado e o último stop saiu há menos de 50 ms; com o carro andando a parada nunca é suprimida, e trocar o adaptador libera o próximo stop. Evita que uma rajada de `pilot.stop` (isenta do limite de mensagens) sature a fila do firmware e o Wi-Fi, e também elimina o segundo `device.stop` do STOP ALL em `running` (o motivo `demo-not-running` chegava logo depois de `admin-stop-all`).
- **Eventos do ESP32 fora de ordem (R2 da sexta revisão):** a rede com apagões de 6 a 9 s entrega `device.stopped` e `device.ack` atrasados. Antes, um `stopped` de uma soltura anterior parava o movimento novo e um `ack` anterior à parada voltava a mostrar o carro andando. Agora o servidor compara a sequência: `ack` e telemetria anteriores à última parada não mudam o "Confirmado", e `stopped` anterior ao último comando enviado não para o carro (o ESP32 que realmente parou volta a andar no próximo `device.drive`, que é o pedido do piloto). Erro sempre para o lado seguro: o pior caso é o painel mostrar o confirmado antigo até o próximo ack ou telemetria (até ≈ 500 ms, o intervalo da telemetria do firmware). Num apagão de rede o confirmado também fica no último valor até o servidor derrubar a conexão (≈ 6 s sem pong), efeito que já existia e não é tratado (em aberto: marcar o confirmado como desatualizado quando `lastSeenAt` passar de ≈ 1 s).
- **STOP ALL grava o motivo (R3):** o STOP ALL do operador (`admin.stopAll`, o único `stopAll` com registro no log) agora grava `admin-stop-all` como motivo da parada mesmo com o carro já parado, por exemplo por um watchdog que venceu no mesmo segundo (antes o painel continuava mostrando "Watchdog"). Confirmado no hardware (décima rodada): carro parado por watchdog e depois STOP ALL passou de `watchdog` para `admin-stop-all` (painel "STOP geral"), sem somar watchdog. Reset da demonstração, troca de topologia e mudança de estado continuam não gravando motivo em carros já parados; a primeira versão amarrava isso ao motivo `admin-stop-all` e fez a tela do piloto mostrar "Parada de segurança" no início de toda largada (o Playwright acusou 10 falhas), por isso virou um parâmetro explícito. Ajustes depois da décima revisão: `recordReason` é um parâmetro próprio de `engine.stopAll` (padrão `false`, separado do registro no log), só o `emergencyStop` o liga, e só com a partida em `running` ou `paused`; assim um `stopAll()` sem argumentos registra no log mas não grava o motivo. Décima primeira revisão: o motivo de parada de segurança (STOP ALL em `running` ou `paused`, watchdog, desconexão, falha) vazava para a largada seguinte (Encerrar, Nova largada, Iniciar), que começava com "Parada de segurança" na tela do piloto até ele mexer; o vazamento já existia antes do R3 e foi provado por uma sonda do revisor. Agora, ao entrar em `setup` ou `ready`, o `setDemoState` grava `demo-not-running` (que não é parada de segurança) em todos os carros; pausar e retomar não trocam o motivo. Efeito colateral aceito: em `setup` e `ready` o cartão do operador mostra "Demonstração parada" em vez do último motivo da rodada anterior (inclusive `fault`), que continua só no registro de eventos (`car.fault` com visibilidade admin); reset da demonstração e troca de topologia não gravam, mas só são permitidos fora de `running` e a volta a `running` passa sempre por `ready`. Há testes de componente e de unidade dos rótulos (`car-panel.test.tsx`: "Demonstração parada", "STOP geral", carro sem motivo e carro andando com motivo antigo; `pilot-status.test.ts`: todos os `STOP_REASONS`, só os quatro de segurança viram "Parada de segurança", e `setup`/`ready` mostram a espera da largada). O vazamento do motivo para a largada seguinte está coberto no engine (`apps/server/tests/device-events.test.ts`). Não há teste de navegador, e nada disso foi repetido no hardware.
- **Tela do piloto sem sessão não dirige (R5):** ao receber `session.revoked` o provider zera o `me`, o `RequireRole` redireciona para a entrada e a `PilotPage` desmonta; o efeito de desmontagem do `usePilotDrive` chama `stop("unmount")` (limpa os timers e manda no máximo um `pilot.stop`, que o servidor responde com `unauthenticated` sem aviso). Confirmado pela leitura do código (nona/décima revisão) e por um teste manual no Chrome (liberar a vaga no `/admin` levou a tela do piloto à entrada com "Vaga liberada pelo operador", sem joystick); o teste de `pilotStatus` sem carro cobre um estado que não acontece nesse fluxo, e há teste automatizado de navegador para o R5 (`regressoes.spec.ts`: o operador libera a vaga do piloto com `admin.releaseSlot`, enviado por WebSocket com a sessão dele, e o piloto vai à entrada com "vaga liberada pelo operador" e sem joystick; a mutação do guarda `RequireRole` o derruba). O `setMe(null)` do provider não é coberto por esse teste: sem ele o `state.snapshot` seguinte já traz `me` nulo, mas ele fecha a janela entre o `session.revoked` e esse snapshot, então fica. O servidor continua respondendo `unauthenticated` a cada mensagem de uma conexão sem sessão (um script que ignora o `session.revoked` recebe um erro por mensagem).
- **Confirmado sem dados:** com a rede caindo, o painel mostrava por cerca de 6 s o último valor confirmado de um carro que o firmware já tinha parado (o servidor só percebe a queda por falta de pong). Agora o servidor publica `cars[].confirmedStale` (online, com algum dado recebido e sem nenhum evento do dispositivo há mais de 1500 ms): o painel do carro mostra "sem dados" no lugar do vetor e some o alerta de comando alterado, e a arena apaga o carro e a seta. É só visual: não toca parada, watchdog nem controle; o piloto não vê. O limite de 1,5 s é três vezes o intervalo da telemetria do firmware (500 ms). Visto no hardware e no navegador em 12/11/2026: com a placa reiniciando (pulso de RTS) o painel mostrou "sem dados" em amarelo sob "Confirmado" com o carro ainda online e voltou ao normal ao reconectar, e o espectador registrou `confirmedStale` virando `true` cerca de 1,2 a 1,5 s depois do início de cada apagão real. Na troca de modo e ao anexar um adaptador, `lastSeenAt` recomeça em "agora" (o evento `connection` do `bind` se perdia antes de o engine se inscrever) e `confirmedStale` zera; um `fault` não tira a marca, porque não traz estado do carro (ambos com teste).
- **Firmware percebia a queda tarde (N3):** o firmware levava de 11 a 26 s para perceber a queda do WebSocket (o servidor, ≈ 6 s). Pela leitura da biblioteca `WebSockets` 2.7.3, a contagem de pongs perdidos só avança quando a tarefa de rede roda e o `write` do `WiFiClient` bloqueia por segundos quando o buffer TCP de um socket morto enche de telemetria. Agora um monitor de silêncio (`LinkSilenceWatch`) para a telemetria com 1,5 s sem nenhum quadro do servidor e fecha o WebSocket com 5 s (o servidor manda `device.heartbeat` a cada 1 s; o limite começou em 3 s e a oitava revisão mostrou que um apagão de 3 a 6 s, que o servidor tolerava, viraria queda e reconexão, então ficou abaixo dos ≈ 6 s do servidor). A causa é inferida pela leitura, não medida. Observado no hardware (12/11/2026, 15:42 a 15:55, firmware com 5 s, três apagões reais coincidindo com a troca de chave da mesh, `iwlwifi: Unhandled alg: 0x703` às 15:43:53, 15:49:01 e 15:54:10): (1) apagão de 8,9 s (41 pings perdidos): o firmware registrou `[ws] sem dados do servidor ha 5000 ms; forcando a reconexao` às 15:43:58, o servidor derrubou às 15:43:59 e a placa reconectou às 15:44:03, ou seja, o firmware passou a perceber junto com o servidor (antes: 11 a 26 s depois); (2) apagão de 3,7 s (16 pings): sem reconexão, só "sem dados" na tela por ≈ 2,6 s (com o limite antigo de 3 s teria derrubado); (3) apagão de 9,8 s (45 pings): **a linha de silêncio não apareceu**; o firmware só registrou `[ws] desconectado apos 617222 ms` às 15:54:20, quando o link voltou (15:54:19,9), enquanto o servidor tinha derrubado às 15:54:17. A hipótese, não medida, é a tarefa de rede bloqueada ~10 s num `write` com a fila de transmissão do Wi-Fi travada, o que o monitor (que roda nessa mesma tarefa) não consegue evitar. Conclusão: o N3 melhorou (caso 1) mas não está resolvido para todo apagão; o bloqueio da tarefa de rede continua sem diagnóstico. Em 14/11/2026, com o log de volta lenta na placa e a mesh da casa (PC no cabo): o ping teve 8 lacunas de 1,1 a 7,6 s a cada ≈ 5 min 05 s (59 de 4411 pings perdidos), e a serial, que só cobre 15:57 a 16:24, registrou dois apagões recuperados pelo monitor de silêncio, um de ≈ 4,5 s sem reconexão (≥ 1,1 s bloqueado em `ws.loop`) e uma volta de 1,9 s em `ws.disconnect`. O apagão de ≈ 7 s das 16:29 e outra queda por pong por volta de 16:44 ficaram sem log do firmware. A hipótese do `write` bloqueado por ≈ 10 s segue sem confirmação nem refutação. No hotspot do celular (PC e ESP32 no mesmo Wi-Fi, 2,4 GHz, 17:06 a 17:36) não houve nenhum apagão (3561 de 3561 pings, média de 25 ms, uma única conexão de 1815 s no servidor): o N3 não foi exercitado ali, então isso não mostra que o hotspot o resolve.
- **Watchdog do carrinho contado uma vez (R4):** o `stopped` por watchdog vindo do ESP32 incrementava a métrica e registrava "Watchdog do carrinho" e, ao parar o controlador, o gancho do servidor incrementava de novo e registrava "Watchdog do servidor" (contagem dobrada, registro enganoso). Agora a parada originada no dispositivo não passa pelo contador do servidor, e o eco que o firmware devolve a qualquer `device.stop` (mesmo motivo, `lastSeq` igual ao `seq` do stop enviado) não conta como watchdog do carrinho; o hardware mostrou o eco contando em dobro antes dessa segunda correção; repetida na bancada (nona revisão, 12/11/2026, 3 pausas reais do piloto): +2 por pausa (1 "Watchdog do servidor" e 1 "Watchdog do carrinho", dois watchdogs distintos), firmware +1, sem terceiro evento, e `pilot.stop`, STOP ALL e fechamento do WebSocket do piloto contaram 0. A ressalva da nona revisão (eco atrasado de um stop anterior contado como watchdog do carrinho quando o servidor manda um segundo `device.stop` antes de o eco do primeiro chegar) foi corrigida: o `CarController` lembra os `seq` dos últimos 256 stops enviados e o engine reconhece o eco de qualquer um deles (teste com dispositivo falso; a contagem por pausa no hardware foi +2 e STOP ALL +0 na décima rodada, que ainda usava a janela de 32; a janela de 256 não foi repetida no hardware). Limite conhecido, só de contagem: o conjunto lembra os 256 últimos `seq` de stop (era 32), então só um apagão com mais de 256 stops enviados (um script mandando `pilot.stop` a cada pouco mais de 50 ms por vários segundos) pode esquecer um eco, e só importa se o stop esquecido tinha motivo `watchdog`. Com o carro parado, 256 stops levam pelo menos 12,8 s por causa do limite de 50 ms, mais que os ≈ 6 s em que o servidor derruba a conexão sem pong, então na prática só um carro alternando andar e parar chegaria perto.
- **Eventos `staff`:** os hackers dos dois times veem os eventos de ataque e defesa um do outro (o defensor vê "Equipe B: Inversão ativa", o atacante vê "Integridade ativada"). Considerado intencional e didático; não foi alterado.
- ****O snapshot do piloto esconde `requested`, `desired` e `confirmed` (zerados, por desenho)**: em 14/11/2026 três scripts de bancada leram o estado pela conexão do piloto e viram "confirmado 0" com os motores girando; lendo por um espectador sem sessão o confirmado foi `1` na frente e `-1` na ré, ou seja, a placa reporta o sentido certo. Qualquer ferramenta de teste que queira ver o confirmado precisa de um espectador. Em aberto, sem decisão (sexta e sétima revisões, 12/11/2026):** rede com dois DHCP e ARP flux no PC (N2) e apagões do Wi-Fi com RSSI forte (N1), ver `progress.md`. Itens anteriores: as mensagens de parada isentas do limite valem também para visitantes sem sessão (recebem um erro por mensagem); os descartes de `pilot.*` não aparecem em nenhuma métrica; o ritmo de envio do joystick (`use-pilot-drive`) não tem teste de integração; limite de mensagens por sessão e por IP, e limite de conexões por sessão (o limite atual é por conexão); a marca "solte o joystick" é limpa ao trocar topologia ou modo mesmo durante `paused`, o que pode deixar um script que segura o joystick andar na hora ao retomar (o cliente oficial não é afetado); defesas continuam valendo depois de trocar a topologia (só os ataques são resetados); o relatório de exploração fica congelado no momento em que foi gerado; corrida possível entre um login e a troca de senha do mesmo carrinho (não reproduzida); mensagens com campos extras no schema estrito recebem `system.error` sem `requestId`, e quem usa `request()` no front espera o timeout.

## 7. Ataques novos do hacker (15/11/2026)

O usuário escolheu dez ataques novos além da inversão: viés de direção, travar direção, atraso, perda de pacotes, replay, interceptar tráfego, quebra de senha, derrubar o link, falsificar telemetria e sequestro completo. Todos continuam sendo **simulação no servidor** e liberam só depois da etapa de exploração, com a partida em `running`. Contrato em `protocol.md` ("Configuração do ataque").

Decisões do usuário:

- **Sequestro:** o hacker atacante dirige o carrinho e os comandos do piloto são ignorados, inclusive a parada dele. É uma **exceção explícita** à regra 5.3 do plano mestre ("interferência não causa movimento por si só"). O carrinho para quando o sequestrador solta, no STOP ALL, na pausa, pela TTL do servidor e do firmware, ao desligar o sequestro, ao trocar a senha do alvo e quando o atacante sai.
- **Criptografia (simulada, não TLS)** é a 4ª defesa; o indicador vai de 0 a 4.
- **Derrubar o link** suspende o envio de comandos por 5 s em vez de fechar o WebSocket do ESP32 (a reconexão já teve instabilidades na bancada).
- **Piloto só vê aviso no sequestro** ("Controle tomado pelo invasor"); nas sabotagens ele só percebe pelo carrinho, como antes.

Decisões técnicas do agente:

| Tema | Decisão |
|---|---|
| Ataque → defesa | Integridade bloqueia inversão, viés, travamento e telemetria falsa; repetição bloqueia o replay (deixou de ser só um evento); criptografia embaralha a interceptação; senha forte bloqueia quebra de senha e sequestro. Atraso, perda e link derrubado não têm camada: mostram que a disponibilidade cai e que o failsafe real para o carrinho |
| Configuração única | `attack.configure` leva todos os campos (o cliente reenvia o objeto inteiro), para não haver estado parcial; `active` = algum campo diferente do padrão |
| Ordem do pipeline | neutro intocado → replay → travar → viés → inversões; replay ou travamento que resultam em neutro **param** o carrinho |
| Travar | guarda a direção do primeiro comando depois de ligar (não a do instante do clique, quando o piloto pode estar solto) |
| Replay | histórico de 10 s dos pedidos do piloto (inclusive as solturas); usa o pedido de 5 s antes; sem histórico, nada muda |
| Atraso | `setTimeout` por comando com contador de geração; qualquer parada (soltar, STOP ALL, pausa, queda, troca de modo) cancela os pendentes. Atrasos de 150 e 300 ms ficam abaixo da TTL de 400 ms |
| Perda | em rajadas: janelas de 0,5 s sorteadas inteiras com a chance escolhida (antes era sorteio por comando, e na bancada de 15/11 com motores 16 comandos descartados em 4 s não pararam o carrinho nenhuma vez, porque a 10 comandos/s o ESP só para com ≈ 4 perdas seguidas); parar nunca é descartado; contador `dropped` nas métricas e coluna "Perd." no `/admin` (a coluna "Invert." virou "Alter.") |
| Link derrubado | 5 s de queda e 10 s de intervalo até a próxima; o fim do intervalo gera um snapshot novo para liberar o botão |
| Interceptação | até 15 quadros (`pilot.drive` recebido e `device.drive` enviado, este já alterado pelo ataque); zera ao religar; o texto cifrado é um embaralhamento determinístico, não criptografia |
| Quebra de senha | lista fixa de 20 senhas comuns com o `1234` na 10ª posição; usa só a marca de senha padrão |
| Telemetria falsa | só o hacker dono do carrinho vê o confirmado igual ao solicitado, no novo "Monitor do seu carrinho" da aba Defesa; o evento "Comando alterado" vai só para a equipe atacante enquanto o ataque estiver ativo |
| Sequestro | `attack.drive`/`attack.driveStop` com o mesmo `CarController` (mesmo `seq` crescente, TTL e coalescência); limite de 40/s como o piloto e parada isenta; o analógico do sequestro reaproveita o `Joystick` e o `usePilotDrive` (parâmetro `channel`), sem teclado para não disputar as setas com as abas |
| Firmware | nenhuma mudança: atraso e perda viram watchdog, replay com `seq` novo é aceito e a queda simulada mantém o heartbeat. O servidor não manda tipos novos ao ESP32 (tipo desconhecido gera `device.fault`) |

Ajustes da revisão Opus (15/11/2026, aprovada com ressalvas):

- **Replay só com tração pedida:** um comando só de direção (`throttle 0`) nunca vira movimento pelo replay; antes, `(0,30)` podia virar `(1,0)` e o carrinho andava sem o piloto pedir tração.
- **Queda da conexão do sequestrador para o carrinho na hora** (`hijack-release`), como já acontecia com o piloto; antes ficava até a TTL de 400 ms.
- **Mudar o atraso ou desligar todos os ataques descarta os comandos atrasados**, para um comando antigo não passar por cima de um mais novo. O watchdog do servidor também cancela os atrasados.
- **Religar "Travar direção" guarda a direção nova** (antes reaproveitava a do travamento anterior).
- **Desativar o ataque mantém o intervalo de 10 s entre quedas do link** (antes dava para burlar com "Desativar ataque"); o reset do operador e a nova largada zeram tudo.
- **Com a telemetria falsa ativa, as mudanças de configuração do ataque também ficam só com a equipe atacante** no registro.
- **O histórico do replay só guarda pedidos aceitos** (e as solturas), não os recusados com a partida pausada ou o link derrubado.
- O analógico do sequestro mostra por que um comando foi recusado (link derrubado, solte e toque de novo, partida parada).
- Não corrigido (já existia): se a gravação da nova senha falhar no disco, a troca lança erro antes de revogar o piloto e de encerrar o sequestro. Comandos do cliente montados a partir de um snapshot antigo podem reenviar `hijack: true` logo depois de o servidor encerrar o sequestro; o servidor recusa a configuração inteira com a mensagem da senha trocada.

## 8. Informações educativas nos ataques e defesas (17/11/2026)

Pedido do usuário: acrescentar informações curtas sobre como cada ataque poderia acontecer na vida real, sem ensinar sua execução, e aplicar a mesma ideia às defesas.

- Os 12 controles de ataque (incluindo as duas inversões) e as 4 defesas recebem um ícone de informação ao lado do nome. A ajuda continua disponível quando o controle está desabilitado, inclusive durante uma pausa.
- Cada balão separa **Na vida real** (cenário conceitual, condições necessárias e efeito) de **No HIJACK** (comportamento demonstrado e limites). Os cenários de comprometimento são exemplos possíveis, não descrições de uma vulnerabilidade real encontrada no carrinho.
- Interação: passar o mouse abre sem tirar o foco do campo em uso; mover o ponteiro até o balão permite ler o texto; clicar fixa a explicação. Toque, Enter e Espaço também abrem. Escape, o botão de fechar ou um clique fora fecham. O conteúdo cabe na largura da tela e pode rolar verticalmente.
- O componente reutiliza o Popover existente do shadcn/Radix, com nome acessível e botão independente dos rótulos dos controles. Abrir ajuda não envia mensagens de ataque, defesa ou troca de senha.
- Conteúdo concentrado em `apps/web/src/features/hacker/security-info-content.ts`; apresentação em `security-info.tsx`. Nenhuma alteração de protocolo, servidor ou firmware.
- As explicações deixam explícitos os limites: integridade e repetição não são a mesma proteção; criptografia não garante disponibilidade; os quatro controles de defesa não eliminam atraso, perda ou queda do link; parar com failsafe limita o risco, mas não recupera a comunicação. Trocar a senha é real; os outros três interruptores continuam didáticos.

Referências conceituais consultadas: [NIST — códigos de autenticação de mensagem](https://csrc.nist.gov/glossary/term/message_authentication_code), [NIST — negação de serviço](https://csrc.nist.gov/glossary/term/denial_of_service) e [RFC 8446 — TLS 1.3, seções 1 e 8](https://www.rfc-editor.org/rfc/rfc8446). O comportamento demonstrado segue a seção 7 acima e o código atual do projeto.

## 9. Tração mantida com o analógico todo para o lado (20/11/2026)

Pedido do usuário: com o analógico todo para o lado o motor desligava e o carrinho parava, porque a tração só vinha do eixo vertical (zona morta de 30 %). Na diagonal a direção chegava a só ≈ 60 %, então pelo analógico era impossível andar com a direção a 100 %. Opção escolhida pelo usuário: **manter o sentido**.

- `axesFromVector` recebe o sentido anterior. Se o eixo vertical está dentro da zona morta e há direção (`steering ≠ 0`), a tração continua a anterior (frente ou ré). O `Joystick` guarda o último sentido enviado e o zera ao soltar.
- Partindo parado e indo direto para o lado, só o servo vira (igual antes).
- Passar da zona morta para a metade oposta troca o sentido; voltar ao centro (sem direção e sem tração) manda neutro e para; soltar para na hora.
- Só a tela muda: `frente + 100 %` já era comando válido (o teclado W+D já o mandava). Servidor, protocolo, ataques, watchdog e firmware não mudaram. Vale também para o analógico do sequestro, que usa o mesmo componente.
- Hardware: a corrente com servo e motores juntos é a mesma da diagonal (pico de ≈ 540 mA visto na bancada). Sem o diferencial eletrônico, a roda de dentro pode arrastar na curva fechada; não testado no chão.

## 10. `.env` do servidor no repositório (22/11/2026)

- **Decisão do usuário:** `apps/server/.env` passa a ser versionado para que um clone novo rode sem copiar o arquivo de outra máquina. O `.gitignore` continua ignorando qualquer outro `.env`.
- **Por que é aceitável:** o repositório `hijack-web` é privado e os segredos (`ADMIN_SECRET`, `DEVICE_SECRET_CAR_A`, `DEVICE_SECRET_CAR_B`) só valem no servidor da demonstração, numa LAN isolada (hotspot).
- **Limite:** se o repositório ficar público, trocar os três segredos (gravando o novo `DEVICE_SECRET_CAR_A` no carrinho pelo portal) e tirar o `.env` do git.
