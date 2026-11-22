# HIJACK web — instruções para agentes

Monorepo Bun da aplicação HIJACK (demonstração acadêmica de segurança em sistemas ciberfísicos, LAN isolada).

## Antes de codificar

1. Leia `docs/PLANO_IMPLEMENTACAO_HIJACK.md` (fonte de verdade: escopo, protocolo, segurança, UX, testes).
2. Leia `docs/progress.md` (fase atual, o que foi verificado, próximo passo).
3. Leia `docs/assumptions.md` (decisões do grupo × decisões técnicas × pendências).
4. Firmware fica no repositório irmão `../esp32/`.

## Estrutura

- `apps/web` — React + Vite + TypeScript + Tailwind + shadcn/ui.
- `apps/server` — Bun + Express + `ws`. Autoridade única de sessões, times, ataques, defesas e carros.
- `packages/protocol` — schemas Zod e tipos compartilhados do protocolo WebSocket (versão 1).
- `docs/` — documentação; `referencias/` — telas e pré-projeto do grupo.

## Regras inegociáveis

- Ataques são **simulações internas no servidor**: nenhum scan, sniffing ou exploração real de rede.
- Integridade e repetição na UI são **demonstrações didáticas** (não HMAC, não validação no firmware).
- Troca de senha tem efeito **real** (hash argon2id). Senha `1234` é vulnerabilidade proposital.
- `STOP` e watchdog nunca são invertidos nem desligados por ataque. Na dúvida, parar. Única exceção (decisão do usuário em 15/11/2026): durante o **sequestro** a parada pedida pelo piloto é ignorada; STOP ALL, pausa, TTL e soltar do sequestrador continuam parando. Parar nunca é atrasado nem descartado pelos ataques de atraso e perda.
- Ataques novos (viés, travar, atraso, perda, replay, interceptar, quebra de senha, link derrubado, telemetria falsa, sequestro) são simulação no servidor; nenhum tipo novo de mensagem vai ao ESP32 (tipo desconhecido para o carrinho com `device.fault`). Contrato em `docs/protocol.md`, decisões em `docs/assumptions.md` seção 7.
- Navegador nunca é autoridade de time/papel/carro; autorizar **cada mensagem** no servidor.
- Botões A/B do piloto são visuais e desabilitados.
- Nunca registrar senhas/segredos em logs, telemetria ou erros. Nunca commitar `data/` nem outro `.env`; o `apps/server/.env` é versionado por decisão do usuário (22/11/2026, repositório público, LAN isolada; ver `docs/assumptions.md` seção 10).
- O snapshot do piloto esconde `requested`, `desired` e `confirmed` (zerados por desenho): para ver o confirmado em testes, ler por um espectador sem sessão.
- O e2e do Playwright recusa rodar com carro em modo `hardware`; rodar só com o servidor da bancada parado e `CAR_A_MODE=simulated CAR_B_MODE=simulated`.
- Comandos de movimento ao carro real só quando o usuário pedir, com a mão dele na fonte; pulsos curtos, um de cada vez.

## Fluxo de trabalho

- A cada passo: `bun run lint && bun run typecheck && bun run test && bun run build`; atualizar `docs/progress.md`; commit (sem push).
- Escolhas não especificadas: decidir pelo mais simples e registrar em `docs/assumptions.md`.

## Estado do painel em 17/11/2026

- Informações educativas nos 12 controles de ataque e nas 4 defesas, publicadas no commit `18ffae7`. Texto em `apps/web/src/features/hacker/security-info-content.ts`, apresentação em `security-info.tsx`; cenário real separado do comportamento no HIJACK. Decisões e limites em `docs/assumptions.md` seção 8.
- Verificação concluída: lint, typecheck, build, 343 testes e 16 E2E direcionados (`security-info.spec.ts` e `novos-ataques.spec.ts`, desktop e mobile). Depois, a suíte completa de Playwright passou (57 aprovados, 1 pulado: WASD no perfil mobile); detalhes em `docs/testing.md`. Nenhum resultado novo de hardware.
- O usuário pediu novas sugestões de defesas; ainda não houve apresentação das opções, escolha ou implementação. As quatro defesas atuais continuam sendo autenticação, integridade, repetição e criptografia.

## Convenções do usuário

- **Sem comentários no código.** Explicações necessárias vão para `docs/`; comentários desnecessários não devem existir.
- **Usar o gerador oficial** de cada ferramenta para iniciar projetos/pacotes (`bun init`, `bun create vite`, `shadcn init/add`, `pio project init`...). Nunca criar a estrutura inteira à mão.
- **Seguir a paleta e o padrão visual das referências** (`referencias/*.jpg`), documentados em `docs/design.md`. Usar apenas os tokens do tema; não inventar cores.
