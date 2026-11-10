# HIJACK — aplicação web

Demonstração acadêmica de segurança em sistemas ciberfísicos numa **LAN isolada**, com **1 carrinho ESP32** (padrão: a equipe A pilota e defende, a equipe B só ataca) ou, opcionalmente, **2 carrinhos** (cada equipe com piloto no celular e hacker no notebook). O piloto controla frente/ré em velocidade fixa e a **direção proporcional** (-100 a +100 %). O hacker faz um ataque **simulado no servidor** que inverte frente↔ré e/ou esquerda↔direita do carrinho adversário; o defensor troca a senha (efeito real) e liga defesas **didáticas**. O firmware fica no repositório irmão `../esp32`.

> Não é uma ferramenta de invasão: não há varredura, captura ou exploração real de rede. Detalhes em `docs/security-model.md`.

## Requisitos

- [Bun](https://bun.com) ≥ 1.4 (Linux, macOS ou Windows)
- Navegadores modernos nos celulares e notebooks
- Uma rede Wi-Fi **isolada** (roteador do laboratório, sem internet obrigatória)

## Primeira instalação

```bash
bun install
cp apps/server/.env.example apps/server/.env
```

Edite `apps/server/.env` e troque **todos** os segredos de exemplo:

| Variável | Para quê |
|---|---|
| `ADMIN_SECRET` | senha do operador em `/admin` (mín. 8 caracteres; diferente de `1234`) |
| `DEVICE_SECRET_CAR_A` / `_B` | segredo que cada ESP32 envia no `device.hello` (igual ao `DEVICE_SECRET` do `secrets.h` do firmware) |
| `CAR_A_MODE` / `CAR_B_MODE` | `simulated` ou `hardware` ao iniciar (pode mudar no `/admin`) |
| `SERVER_PORT` | porta HTTP/WS (padrão 3000) |
| `DEMO_TOPOLOGY` | `single` (padrão: 1 carrinho, o Carrinho A) ou `dual` (2 carrinhos); pode mudar no `/admin` fora da partida |
| `COMMAND_TTL_MS` | tempo sem comando até parar (padrão 400 ms; a especificação do carrinho recomenda 300–500 ms) |
| `ALLOWED_ORIGINS` | origens extras aceitas no WebSocket (normalmente vazio) |
| `SESSION_TTL_MS`, `MAX_EVENTS`, `DATA_DIR` | duração da sessão, tamanho do registro em memória, pasta das senhas |

Gerar um segredo aleatório: `openssl rand -hex 16`.

## Rodar

| Comando | Quando usar |
|---|---|
| `bun run demo` | **apresentação**: compila o frontend e sobe só o servidor (porta 3000) servindo tudo |
| `bun run dev` | desenvolvimento: servidor (3000) + Vite (5173) com recarga automática |
| `bun run start` | servidor em modo produção (usa o build existente em `apps/web/dist`) |

Ao iniciar, o servidor imprime os endereços da LAN (`[hijack] na LAN: http://192.168.x.y:3000`). O `/admin` também mostra o endereço e um **QR code**.

| Página | Quem usa |
|---|---|
| `/` | entrada de pilotos e hackers (senha inicial dos carrinhos: `1234`) |
| `/pilot` | celular do piloto (joystick; WASD/setas no computador) |
| `/hacker` | notebook do hacker (abas Ataque e Defesa) |
| `/simulator` | telão/projetor: arena simulada, pedido × executado, eventos |
| `/admin` | operador: estados da partida, STOP ALL, modos, vagas, reset, métricas, exportação, QR code |

Cada navegador guarda **uma** sessão. Para testar vários papéis num computador, use navegadores diferentes ou janelas anônimas.

## Ligando os carrinhos reais (ESP32)

O passo a passo de montagem, pinagem e gravação está em [`../esp32/README.md`](../esp32/README.md); a especificação do carrinho (servo ±45°, failsafe, pinos) está em `../esp32/docs/especificacao/`. Pinos da equipe: servo **GPIO 13**; motor esquerdo ENA **25**, IN1 **26**, IN2 **27**; motor direito ENB **21**, IN3 **18**, IN4 **19**. Do lado do servidor:

1. Em `apps/server/.env`, defina `DEVICE_SECRET_CAR_A` e `DEVICE_SECRET_CAR_B` (mín. 8 caracteres) e **reinicie** o servidor.
2. No portal Wi-Fi de cada carrinho (com 1 carrinho, só o `car-a`) (rede `HIJACK-…` criada pelo ESP32; segurar BOOT 3 s para reabrir), informe o IP do notebook, a porta, `car-a` ou `car-b` e o mesmo segredo do `.env`.
3. Com o servidor rodando, ligue o ESP32: ele se conecta em `ws://<IP>:3000/device` e se autentica.
4. No `/admin`, troque o carrinho para **Hardware** (com a partida fora de "Em demonstração"). O cartão mostra **online** quando o ESP32 está conectado; os eventos do operador mostram "ESP32 de Carrinho A autenticado" ou "Conexão de dispositivo recusada".
5. Para voltar ao simulador a qualquer momento: pausar e trocar para **Simulado**.

Também é possível iniciar já em hardware com `CAR_A_MODE=hardware` / `CAR_B_MODE=hardware` no `.env`.

## Rede e firewall

1. Conecte o notebook servidor, os celulares, os notebooks e os ESP32 na **mesma** Wi-Fi isolada.
2. Descubra o IP do notebook: o servidor imprime ao iniciar; ou `ip -4 addr` (Linux), `ipconfig` (Windows), `ipconfig getifaddr en0` (macOS).
3. Libere a porta no firewall do notebook servidor (3000; em desenvolvimento também 5173):
   - Linux com UFW: `sudo ufw allow 3000/tcp`
   - Linux com firewalld: `sudo firewall-cmd --add-port=3000/tcp`
   - Windows (PowerShell como administrador): `New-NetFirewallRule -DisplayName HIJACK -Direction Inbound -Protocol TCP -LocalPort 3000 -Action Allow`
4. Desative o "isolamento de clientes/AP isolation" do roteador, se existir, para os aparelhos se enxergarem.
5. **Nunca** exponha a porta para a internet. Não há TLS (ver `docs/security-model.md`).

## Comandos de qualidade

```bash
bun run lint        # oxlint
bun run typecheck   # bun check em cada pacote
bun run test        # testes unitários e de integração (bun test)
bun run build       # build do frontend
bun run test:e2e    # Playwright (sobe ou reutiliza servidor e Vite)
```

Para os E2E pela primeira vez: `cd apps/web && bunx playwright install chromium`.

## Solução de problemas

| Sintoma | O que verificar |
|---|---|
| Celular não abre a página | mesma Wi-Fi? IP certo? porta liberada no firewall? isolamento de clientes do roteador? |
| "Sem conexão" no topo | servidor parou ou o IP do notebook mudou; recarregue a página |
| "Essa vaga já está ocupada" | alguém já entrou nesse papel/carrinho; o operador libera em `/admin` → "Liberar vaga" |
| "Muitas tentativas" | bloqueio progressivo após senhas erradas; aguarde (até 5 min). No `bun run dev` todos os aparelhos aparecem com o mesmo IP do proxy |
| Senha `1234` não funciona mais | o hacker trocou a senha; use a nova ou, no `/admin`, "Resetar demonstração" marcando "Senhas" |
| `/admin` diz que o segredo está errado | confira `ADMIN_SECRET` em `apps/server/.env` e reinicie o servidor (o `.env` só é lido na partida) |
| Carrinho em "Hardware" aparece offline | ESP32 ligado? `secrets.h` com IP/porta/segredo certos? monitor serial mostra `[ws] autenticado`? |
| O piloto mexe e nada acontece | a partida está em **Em demonstração**? o carrinho está online? |
| Carrinho para sozinho | comportamento esperado ao soltar, trocar de aba, perder Wi-Fi ou ficar `COMMAND_TTL_MS` (400 ms) sem comando |

## Checklist de segurança da demonstração

- [ ] Rede isolada, sem acesso externo à porta do servidor.
- [ ] `ADMIN_SECRET` e `DEVICE_SECRET_*` trocados; `.env` fora do git.
- [ ] Senhas dos carrinhos resetadas para `1234` antes de começar (vulnerabilidade proposital).
- [ ] Carrinhos físicos testados com rodas suspensas (`../esp32/docs/testing-hardware.md`).
- [ ] Operador com `/admin` aberto e o botão **STOP ALL** à vista.
- [ ] Corte físico de energia de cada carrinho ao alcance.
- [ ] Público informado de que ataque, integridade e repetição são **simulações**; só a troca de senha é real.

## Documentação

| Arquivo | Conteúdo |
|---|---|
| `docs/PLANO_IMPLEMENTACAO_HIJACK.md` | especificação original (fonte de verdade) |
| `docs/progress.md` | o que foi feito e verificado, próximo passo |
| `docs/assumptions.md` | decisões do grupo, decisões técnicas, pendências |
| `docs/architecture.md` | módulos, fluxo de comandos, segurança física |
| `docs/protocol.md` | protocolo WebSocket v1 (navegador e ESP32) |
| `docs/security-model.md` | o que é real × didático, riscos aceitos |
| `docs/design.md` | paleta e padrões visuais das referências |
| `docs/testing.md` | estratégia e matriz de testes |
| `docs/demo-script.md` | roteiro da apresentação |
| `docs/acceptance.md` | checklist de aceitação (Definition of Done) com evidências e pendências |
