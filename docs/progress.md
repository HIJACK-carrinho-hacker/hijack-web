# Progresso

Legenda: ✅ concluído e verificado · 🔄 em andamento · ⏳ pendente · ⚠️ bloqueado

| Passo | Status | Observações |
|---|---|---|
| 0. Bootstrap (pastas, git, docs, AGENTS.md) | ✅ | Plano mestre e referências copiados |
| 1. Monorepo e contratos | ✅ | Workspaces Bun, protocol Zod, Express+ws com `/health` e `/ws`, Vite+shadcn tema escuro, proxy dev |
| 2. Simulador | ✅ | `HijackEngine`, `CarController`, `SimulatorAdapter`, pipeline, métricas, eventos, `/simulator`. Aguardando revisão do usuário |
| 3. Sessões e login | ⏳ | |
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

## Bloqueios reais

_(nenhum)_

## Próximo passo

Fase 3: login (`POST /api/session` + cookie), sessões, slots exclusivos, autorização por mensagem, troca de senha com revogação do piloto, admin (`ADMIN_SECRET`), rate limit; tela `/` igual à referência; restringir `sim.manualDrive` e `admin.*` ao admin.
