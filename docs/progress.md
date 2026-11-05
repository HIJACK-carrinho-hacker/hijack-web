# Progresso

Legenda: ✅ concluído e verificado · 🔄 em andamento · ⏳ pendente · ⚠️ bloqueado

| Passo | Status | Observações |
|---|---|---|
| 0. Bootstrap (pastas, git, docs, AGENTS.md) | ✅ | Plano mestre e referências copiados |
| 1. Monorepo e contratos | ✅ | Workspaces Bun, protocol Zod, Express+ws com `/health` e `/ws`, Vite+shadcn tema escuro, proxy dev |
| 2. Simulador | ✅ | `HijackEngine`, `CarController`, `SimulatorAdapter`, pipeline, métricas, eventos, `/simulator`. Revisado pelo usuário |
| 3. Sessões e login | ✅ | Login HTTP + cookie, vagas, autorização por mensagem, troca de senha real com revogação do piloto, admin, rate limit; telas `/`, `/hacker` (esqueleto + Defesa/Autenticação), `/pilot` (provisória), `/admin` |
| 4. Piloto | ⏳ | Pausa para teste no celular |
| 5. Ataque guiado | ⏳ | |
| 6. Defesa | ⏳ | Pausa: fluxo simulado completo |
| 7. Firmware + Esp32Adapter | ⏳ | Pausa: checklist físico |
| 8. Robustez e apresentação | ⏳ | |
| 9. Revisão final | ⏳ | |

## Testes executados

- Fase 1 (05/11/2026): `bun run typecheck` ✅, `bun run lint` ✅ (0 avisos), `bun run test` ✅ 24 testes, `bun run build` ✅.
- Fase 1: `bun run dev` → `/health` via proxy do Vite 200; WS `/ws` via proxy recebeu `action.ok`.

- Fase 2 (05/11/2026): typecheck ✅, lint ✅, `bun run test` ✅ 59 testes (protocolo 18, servidor 41), build ✅, Playwright ✅ 4 testes (simulador em desktop e mobile).
- Fase 2: verificação manual no Chrome em `/simulator` — segurar ↗ moveu só o carrinho A (seq subiu, B parado); soltar → "Piloto soltou"; layout ok em 412 px; console sem erros.

- Fase 3 (05/11/2026): typecheck ✅, lint ✅, `bun run test` ✅ 79 testes (protocolo 18, servidor 61), build ✅, Playwright ✅ 12 (desktop + mobile: entrada, vaga ocupada, troca de senha revogando o piloto, simulador público × operador).
- Fase 3: verificação manual no Chrome — erro neutro de senha, login de piloto e hacker, abas no estilo da referência, troca de senha (selo e indicador 1/3), `/admin` com reset de senhas.

## Bloqueios reais

_(nenhum)_

## Próximo passo

Fase 4: tela do piloto com joystick virtual (pointer/touch), eixos -1/0/1 com dead zone, WASD/setas, refresh 100 ms, STOP ao soltar/perder foco/aba oculta/desmontar/perder WS, botões A/B desabilitados, estados visuais (aguardando largada, em demonstração, pausado, sem conexão, parada de segurança). Depois pausar para teste no celular.
