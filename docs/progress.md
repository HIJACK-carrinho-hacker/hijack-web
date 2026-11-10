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
| 6. Defesa | ✅ | `DefenseManager` (integridade bloqueia a inversão no servidor; repetição gera evento didático sem movimento), indicador 0–3, cartões com rótulos permanentes de simulação, simulador compara solicitado × confirmado e destaca "comando alterado" |
| 7. Firmware + Esp32Adapter | ✅ software | Firmware em `../esp32` compila e passa 13 testes nativos; pinos descritivos em `include/pins.h` (DevKit 38 pinos) com checagem em compilação; `DeviceHub` + `Esp32Adapter` testados com ESP32 falso. **Hardware não testado** — aguardando checklist físico do grupo |
| 8. Robustez e apresentação | ✅ | Exportação CSV/JSON (só operador, sem segredos, anti-fórmula), `bun run demo` (servidor entrega o build), QR code e endereços da LAN no `/admin`, auditoria axe sem violações sérias, README com LAN/firewall/solução de problemas/checklist, `testing.md`, `demo-script.md` |
| 9. Revisão final | ✅ | Clone limpo dos dois repositórios verificado; `docs/acceptance.md` com a Definition of Done item a item e pendências físicas |
| 10. Especificação do carrinho (10/11/2026) | ✅ software | Direção proporcional -100..+100 (protocolo, pipeline, simulador, joystick, indicador, arena), TTL 400 ms, topologia `single` (padrão) / `dual` com `admin.setTopology`, regras de equipe A defensora e equipe B atacante; ver `assumptions.md` seção 5. Firmware alterado em paralelo em `../esp32`. **Hardware não testado** |

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

- Fase 7 (05/11/2026): web — typecheck ✅, lint ✅, `bun run test` ✅ 128 (servidor 95, incluindo 11 com ESP32 falso), build ✅, Playwright ✅ 27 + 1 pulado. esp32 — `pio run` ✅, `pio test -e native` ✅ 13, `esp32dev_hw` bloqueia sem `secrets.h` e sem servo (verificado) e compila com valores fictícios de teste (não versionados).

- Fase 8 (05/11/2026): typecheck ✅, lint ✅, `bun run test` ✅ 134, build ✅, Playwright ✅ 29 + 1 pulado (inclui acessibilidade em desktop e mobile). Modo produção verificado: `/`, `/pilot`, assets, `/api/public` e `/health` respondendo pelo servidor na porta alternativa 3100.
- Fase 8: verificação manual no Chrome do `/admin` (QR code, endereços, exportação).
- Correções de acessibilidade: contraste das legendas `[J]`/`[K]`, horários do registro e "vago"; selo "Vulnerável" em contorno; STOP ALL sólido; lista de eventos focável.

- Fase 9 (05/11/2026): clone limpo do `web` — `bun install` (428 pacotes), `lint` ✅, `typecheck` ✅ (5 projetos), `test` ✅ 134, `build` ✅. Clone limpo do `esp32` — `pio run` ✅ (RAM 14,8%, flash 38,9%), `pio test -e native` ✅ 13. E2E na cópia de trabalho: 29 ✅ + 1 pulado.

- Passo 10 (10/11/2026): typecheck ✅ (5 projetos), lint ✅ (0 avisos), `bun run test` ✅ 170 (protocolo 33, servidor 117, web 20), build ✅, Playwright ✅ 35 + 1 pulado (desktop + mobile, inclui `topology.spec.ts`), rodado duas vezes seguidas contra o mesmo servidor.
- Correção no passo 10: o registro "Comando alterado" deixava de aparecer quando o mesmo tipo de alteração se repetia depois de um `pilot.stop` (a chave de deduplicação só era limpa ao soltar pelo `pilot.drive`); agora qualquer parada limpa a chave.

- Correção na integração com o ESP32 (10/11/2026): `crypto.randomUUID` não existe em contexto inseguro (HTTP pelo IP da LAN), então toda mensagem enviada pelo navegador (Pronto no `/admin`, joystick do `/pilot`) lançava `TypeError`. `newRequestId` (`apps/web/src/lib/request-id.ts`) usa `randomUUID` quando existe e cai para `getRandomValues` com UUID v4. typecheck ✅, lint ✅, `bun run test` ✅ 174 (4 novos), build ✅. Verificado no Chrome em `http://192.168.0.198:3000/admin`: Pronto → "Aguardando largada". Playwright não foi reexecutado (roda em localhost, contexto seguro).

## Bloqueios reais

_(nenhum)_

## Próximo passo

Integrar com o firmware atualizado para o mesmo contrato (direção proporcional, TTL 400 ms) e testar com 1 carrinho físico, seguindo a ordem de testes de `../esp32/docs/especificacao/05_requisitos_firmware.md` e `../esp32/docs/testing-hardware.md`, registrando medições reais em `docs/acceptance.md`.
