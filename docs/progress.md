# Progresso

Legenda: ✅ concluído e verificado · 🔄 em andamento · ⏳ pendente · ⚠️ bloqueado

| Passo | Status | Observações |
|---|---|---|
| 0. Bootstrap (pastas, git, docs, AGENTS.md) | ✅ | Plano mestre e referências copiados |
| 1. Monorepo e contratos | ✅ | Workspaces Bun, protocol Zod, Express+ws com `/health` e `/ws`, Vite+shadcn tema escuro, proxy dev |
| 2. Simulador | ✅ | `HijackEngine`, `CarController`, `SimulatorAdapter`, pipeline, métricas, eventos, `/simulator`. Revisado pelo usuário |
| 3. Sessões e login | ✅ | Login HTTP + cookie, vagas, autorização por mensagem, troca de senha real com revogação do piloto, admin, rate limit; telas `/`, `/hacker` (esqueleto + Defesa/Autenticação), `/pilot` (provisória), `/admin` |
| 4. Piloto | ✅ | Joystick pointer/touch com dead zone ajustável, WASD/setas, refresh 100 ms, STOP em soltar/blur/aba oculta/desmontar/sem WS, manopla volta ao centro em parada forçada, A/B desabilitados, estados visuais |
| 5. Ataque guiado | ✅ | `AttackManager` (4 etapas, alvo só adversário, inversões independentes), eventos de comando alterado sem repetição, ocultação para o piloto, aba Ataque com etapas progressivas e registro |
| 6. Defesa | ✅ | `DefenseManager` (integridade bloqueia a inversão no servidor; repetição gera evento didático sem movimento), indicador 0–3, cartões com rótulos permanentes de simulação, simulador compara solicitado × confirmado e destaca "comando alterado". Aguardando teste do fluxo completo pelo usuário |
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

- Fase 4 (05/11/2026): typecheck ✅ (5 projetos), lint ✅, `bun run test` ✅ 94 (protocolo 18, servidor 61, web 15), build ✅, Playwright ✅ 19 + 1 pulado (teclado no perfil mobile).
- Fase 4: verificação manual no Chrome — analógico em diagonal manteve o carrinho A em movimento por > 2 s com `seq` subindo (refresh), B parado; `blur` da janela parou o carrinho na hora; layout retrato em 412 px ok.

- Fase 5 (05/11/2026): typecheck ✅, lint ✅, `bun run test` ✅ 109 (protocolo 18, servidor 76, web 15), build ✅, Playwright ✅ 23 + 1 pulado; E2E de ataque repetido 4× em desktop e mobile sem falha.
- Fase 5: verificação manual no Chrome — 4 etapas pela UI; piloto B (script) pediu frente e o carrinho B executou ré; registro mostrou "Comando alterado: frente → ré".
- Correção na Fase 5: o servidor envia o `state.snapshot` atualizado ao autor **antes** do `action.ok`, evitando que a UI use estado antigo logo após uma ação.

- Fase 6 (05/11/2026): typecheck ✅, lint ✅, `bun run test` ✅ 117 (protocolo 18, servidor 84, web 15), build ✅, Playwright ✅ 27 + 1 pulado.
- Fase 6: verificação manual no Chrome — aba Defesa com os três cartões, integridade e repetição ligadas, indicador 2/3, exemplo de repetição no registro.

## Bloqueios reais

_(nenhum)_

## Próximo passo

Pausa: o usuário testa o fluxo simulado completo (2 pilotos + 2 hackers + `/simulator` + `/admin`). Depois, Fase 7: firmware ESP32 (PlatformIO + Arduino) e `Esp32Adapter`.
