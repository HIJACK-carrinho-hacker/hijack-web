# Progresso

Legenda: ✅ concluído e verificado · 🔄 em andamento · ⏳ pendente · ⚠️ bloqueado

| Passo | Status | Observações |
|---|---|---|
| 0. Bootstrap (pastas, git, docs, AGENTS.md) | ✅ | Plano mestre e referências copiados |
| 1. Monorepo e contratos | ✅ | Workspaces Bun, protocol Zod, Express+ws com `/health` e `/ws`, Vite+shadcn tema escuro, proxy dev |
| 2. Simulador | ⏳ | Pausa para revisão do usuário |
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

## Bloqueios reais

_(nenhum)_

## Próximo passo

Fase 2: `DeviceAdapter`, `SimulatorAdapter` A/B, watchdog, `seq`, telemetria, STOP, `state.snapshot`, página `/simulator` (desejado × confirmado + eventos).
