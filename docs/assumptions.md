# Premissas e decisões

Distingue **fatos/decisões do grupo**, **decisões técnicas do agente** e **pendências**. Atualizar sempre que uma escolha não especificada for feita.

## 1. Decisões do grupo (pré-projeto + plano mestre)

- Dois carrinhos (A e B), ESP32 + L298N + 2 motores DC + servo de direção; velocidade fixa; curva só pelo servo.
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
- **Piloto não vê** sinalização de comando alterado pelo ataque (padrão do plano 6.2).

## 4. Pendências físicas (não resolvidas por software)

- Pino de sinal do servo e pulsos esquerda/centro/direita (µs).
- Alimentação do ESP32 e do servo (5 V da L298N não validado; provável buck externo).
- Geometria mecânica da direção; polaridade real dos motores.
- Timeout de 300 ms é valor inicial, sujeito a medição.
