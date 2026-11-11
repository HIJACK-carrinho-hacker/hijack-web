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
- **Retomar exige soltar:** um `pilot.drive` ativo recusado enquanto a partida está `paused` (`demo_not_running`) marca o carro; ao retomar, comandos ativos são recusados com `bad_request` ("solte o joystick e toque de novo") até a marca ser limpa por um comando neutro (`pressed: false` ou `throttle 0` e `steering 0`), por `pilot.stop`, pela queda do WebSocket do piloto ou pela revogação ou expiração da sessão. A marca **não** é limpa ao encerrar a rodada, trocar a topologia ou o modo do carro. Vale também para clientes por script; fora da pausa (por exemplo, antes da largada) nada muda. A tela do piloto também ignora entradas enquanto está desabilitada.
- **Ataque não sobrevive à rodada nem ao atacante:** os ataques são zerados ao sair de `stopped` (nova largada) e o ataque de uma equipe é desativado quando o hacker dessa equipe sai (logout, vaga liberada pelo operador ou nova entrada); a **expiração** da sessão do hacker (TTL padrão de 4 h) ainda não desativa o ataque. Antes a inversão da rodada anterior continuava ativa sem dono e o operador não conseguia desligá-la em `running`.
- **Eventos `staff`:** os hackers dos dois times veem os eventos de ataque e defesa um do outro (o defensor vê "Equipe B: Inversão ativa", o atacante vê "Integridade ativada"). Considerado intencional e didático; não foi alterado.
- **Em aberto, sem decisão:** defesas continuam valendo depois de trocar a topologia (só os ataques são resetados); um script autenticado pode inundar o registro de eventos (sem limite de taxa por conexão); o relatório de exploração fica congelado no momento em que foi gerado; corrida possível entre um login e a troca de senha do mesmo carrinho (não reproduzida); o STOP ALL em `running` envia dois `device.stop` por carro (`admin-stop-all` e `demo-not-running`), inofensivo porque o stop é idempotente no firmware; mensagens com campos extras no schema estrito recebem `system.error` sem `requestId`, e quem usa `request()` no front espera o timeout; a marca de "solte o joystick" atravessa a troca de rodada; a recusa por "solte o joystick" usa o código genérico `bad_request` e a tela do piloto não trata `pilot.commandRejected`; zerar o ataque na nova largada não gera evento no registro.
