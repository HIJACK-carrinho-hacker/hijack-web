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
| 11. Validação do hacker (11/11/2026) | ✅ simulado e ESP32 real com saídas desligadas | Fluxo completo no Chrome (entrada, 4 etapas, inversões independentes, defesas, autorização, ciclo da partida, métricas e exportação), topologias `single` e `dual`, ESP32 real recebendo a tração invertida (a direção invertida não foi observada no hardware). Corrigido o STOP ALL (pausa a partida). **Motores, L298N e servo continuam sem teste** |

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

- Quedas do WebSocket do ESP32 (10/11/2026): com RSSI −82 dBm, o WebSocket do ESP32 caía a cada 1 a 2 minutos sem o Wi-Fi cair, porque o servidor encerrava a conexão na primeira falha de pong (ping de 2 s). `DeviceHub` agora tolera 3 pings seguidos sem pong (`DeviceKeepAlive`, ≈ 6 s, configurável por `ServerOptions`); o firmware passou a pingar a cada 2 s e desconectar após 3 falhas. A parada do movimento continua sendo a TTL de 400 ms. typecheck ✅, lint ✅, `bun run test` ✅ 177 (3 novos em `device.test.ts`), build ✅. **Aguardando novo teste na placa**.
- Causa real das quedas (10/11/2026): o log do servidor mostrou `erro no socket do dispositivo car-a: Invalid WebSocket frame: invalid UTF-8 sequence`. O firmware enviava lixo no campo `stopReason` da telemetria (ponteiro para variável local depois de um `device.stop`); corrigido no repositório `esp32` (`DriveFailsafe` copia o motivo). O servidor agora imprime no terminal cada queda (código, tempo conectado, se foi derrubado por falta de pong, contagem de pings e pongs) e cada erro de socket do dispositivo; o mesmo texto aparece em "ESP32 desconectado" no `/admin`. Teste com piloto de teste em `/pilot` (W/A/S/D em rajadas) e vários `STOP ALL` e trocas de estado da partida: nenhuma queda.

- Validação do hacker (11/11/2026): baseline lint ✅, typecheck ✅, `bun run test` ✅ 178, build ✅; firmware `pio test -e native` ✅ 28. Playwright ✅ 35 + 1 pulado (desktop e mobile), rodado antes e de novo depois da correção do STOP ALL, contra servidor de desenvolvimento com os dois carros simulados, depois de parar o servidor da bancada (os E2E resetam o ambiente com o segredo do operador lido de `apps/server/.env`).
- Chrome, topologia `single`, hacker B (ataca) e hacker A (defende), piloto de teste por script: erro de senha neutro; login com vaga ocupada 409, papel forjado e campo extra 400, origem estranha 403; ataque bloqueado antes da largada; 4 etapas com progresso mantido ao recarregar; Frente↔Ré, Esquerda↔Direita e as duas juntas independentes (ex.: "frente + direita 60%" vira "ré + esquerda 60%"); Integridade bloqueia ("mantido"), Repetição só registra exemplo sem mover; senha forte revoga `1234` (401) e a inversão continua com a Integridade desligada; indicador 3/3; hacker A recebe `forbidden` em `attack.*`, hacker B em `defense.*`, e ambos em `pilot.*`/`admin.*`; Pausar com o piloto ainda dirigindo zera o movimento; Resetar volta ataque e defesas ao padrão e, com a caixa "Senhas" marcada (desmarcada por padrão), também a senha; exportação CSV/JSON só para o operador (401 sem sessão) e sem segredos; métricas separadas por modo (`hardware`/`simulated`); console do navegador sem erros e rede sem 4xx/5xx; 412 px sem rolagem horizontal.
- `dual` (Carrinho B simulado): Ana ataca o B (só tração) e Bruno ataca o A (só direção) ao mesmo tempo, cada carro com o seu efeito; a Integridade do A bloqueia o ataque do Bruno sem bloquear o da Ana; o próprio carro não pode ser escolhido como alvo.
- ESP32 real com `esp32dev` (`saidas=desligadas`), serial capturada: o piloto pediu frente e o firmware recebeu `esquerdo=-1 direito=-1` (ré) com o ataque ativo e `esquerdo=1 direito=1` com a Integridade ligada; reiniciar a placa com o ataque ativo não gerou movimento sem novo `device.drive` e o ataque seguiu ativo no servidor. O "Confirmado" do `/simulator` veio do ack do ESP32.
- Achado F1, corrigido: o STOP ALL era um pulso e o piloto que seguia segurando o joystick retomava o movimento em ~100 ms. Agora `engine.emergencyStop()` também pausa a partida em `running`; regressão em `engine.test.ts` (2) e `simulator-ws.test.ts` (1); os dois de engine falham antes da correção por o método não existir, e o revisor confirmou que as asserções também falham com o `stopAll` antigo. `bun run test` ✅ 181.
- Achado F2, aberto (rede, não é defeito do hacker): com o ESP32 em −65 a −73 dBm e 20 % de perda no ping, o failsafe de 400 ms expirou várias vezes por condução (a tração do firmware oscila entre 0 e ±1) e o WebSocket caiu 5 vezes nos primeiros ~14 min (todas "por falta de pong", `wifi=ok`), depois ficou 10 min sem queda. A parada está correta, mas o roteador dedicado de 2,4 GHz continua necessário para a demonstração.
- Não coberto: reiniciar o servidor durante um ataque ativo (só `engine.test.ts`), foco por teclado nos switches (só `a11y.spec.ts`), toque em celular real, e qualquer teste com motores, L298N ou servo.

- Revisão independente (Opus, 11/11/2026): aprovada com ressalvas, 0 crítico, 0 alto, 2 médios, 11 baixos. Corrigidos a pedido do usuário, cada um com teste visto falhando antes: ataque zerado ao iniciar nova largada e quando o hacker atacante sai (`2521e97`); piloto que segura o joystick durante a pausa só volta a mover depois de soltar, no servidor e na tela do piloto (`b599b19`); cartões de defesa mostram o erro (`daf978b`, sem teste automático, o caminho de erro não foi exercitado no navegador); mais testes do STOP ALL em todos os estados, com 1 carrinho, pelo WebSocket e com o ESP32 falso (`8c32a37`). Depois disso: `bun run test` ✅ 193, Playwright ✅ 35 + 1 pulado. Os demais baixos (defesas após troca de topologia, inundação do registro, relatório de exploração congelado, corrida login × troca de senha, dois `device.stop` por carro, mensagens inválidas sem resposta com `requestId`) ficaram em aberto e estão em `assumptions.md` seção 6.

## Bloqueios reais

_(nenhum)_

## Próximo passo

Teste físico em etapas, conforme o material chega: `../esp32/docs/proximos-passos-hardware.md` (A: bancada com o que já existe; B: L298N; C: servo; D: chassi e chão). Medições reais vão para `../esp32/docs/testing-hardware.md` e para `docs/acceptance.md`. Antes da demonstração: roteador dedicado de 2,4 GHz e 10 min de piloto automático sem queda.
