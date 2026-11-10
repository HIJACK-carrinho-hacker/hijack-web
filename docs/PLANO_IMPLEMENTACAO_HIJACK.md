# HIJACK — Plano de implementação para Codex / Claude Code

**Versão:** 1.0 — 05/11/2026  
**Tipo:** especificação de software, firmware, contratos e execução incremental  
**Escopo:** demonstração acadêmica local, com dois carrinhos ESP32, dois pilotos e dois hackers.  
**Fonte de requisitos:** pré-projeto HIJACK revisado e decisões tomadas com o grupo.  
**Status:** especificação de implementação; **não** significa que o software ou hardware já foram construídos/testados.

> **Instrução principal ao agente:** Implemente o projeto por etapas verificáveis, começando por uma demonstração completa em modo simulado, depois integração com ESP32 real. Não substitua as decisões deste documento sem justificar. Não declare hardware testado quando só houver simulação. Mantenha a aplicação exclusivamente em rede de laboratório autorizada.

---

## 1. Visão executiva

HIJACK é uma demonstração didática de segurança em sistemas ciberfísicos. Há dois carrinhos físicos, A e B, controlados por ESP32 via Wi-Fi. Um notebook hospeda a aplicação web e o servidor WebSocket. Cada equipe tem um **piloto** (celular, joystick virtual) e um **hacker** (notebook, painel de ataque/defesa). O hacker pode seguir etapas guiadas simuladas — escanear, localizar carrinho, explorar falha, escolher comandos a inverter — e aplicar inversões de **frente ↔ ré** e/ou **esquerda ↔ direita** no carrinho da equipe adversária. O defensor liga proteções demonstrativas, e o público observa o resultado físico.

Não é uma ferramenta de invasão: descoberta de alvos e exploração são **simulações sobre dispositivos cadastrados no servidor**, não varreduras reais da rede. A proteção de integridade e a proteção contra repetição são **simulações didáticas**, não garantias criptográficas. A **autenticação por senha** é implementada no servidor (credencial inicial `1234` no modo demonstrativo e possibilidade real de alteração). **Parada segura do carrinho é real** no firmware e não pode ser desligada por ataque.

### 1.1 Decisões confirmadas pelo grupo

- Hardware: ESP32, L298N, dois motores DC, duas células 18650 de 3,7 V em série (7,4 V nominais), futuro chassi impresso em 3D, servo motor e mecanismo mecânico de esterçamento **ainda não dimensionados**.
- Motores de tração em **velocidade fixa**. Frente e ré pela L298N; esquerda e direita pela **posição do servo**. **Não** virar girando o carrinho no próprio eixo e **não** usar tração diferencial para curva.
- Controle liberado enquanto o piloto aciona joystick; ao soltar, tração para. Se perder comunicação, tração para automaticamente.
- ESP32 e navegadores conectados à mesma rede Wi-Fi; servidor local no notebook; transporte servidor↔ESP32 por WebSocket.
- Dois times simultâneos, sem pontuação, vencedor nem limite de tempo. Cada time: piloto + hacker.
- Hacker passa por quatro etapas guiadas; pode selecionar individualmente os eixos de inversão.
- Defesa: troca real da senha padrão; integridade e bloqueio de repetição simulados. Botões A/B da tela são visuais, sem função definida e **não** devem controlar hardware.
- Testes funcionais e métricas: latência, comandos transformados/bloqueados, desconexões, estabilidade.
- Não criar cronograma nem orçamento na aplicação apenas por constarem de modelos genéricos.

### 1.2 Premissas técnicas propostas (não são decisões originais do grupo)

- Preferir **React + Vite + TypeScript + Tailwind + shadcn/ui** no frontend e **Bun + Express + `ws` + TypeScript** no backend. Motivo: solução LAN simples, sem necessidade de SSR do Next.js ou infraestrutura externa.
- **Monorepo Bun workspaces**, com pacote de tipos/validação compartilhado. Usar Zod para validar mensagens.
- **PlatformIO + Arduino framework (C++)** para firmware; confirmar compatibilidade das versões das dependências no momento da instalação. Usar biblioteca de servo compatível com a versão escolhida do ESP32 (ex.: ESP32Servo, se validada).
- Sem banco de dados na primeira versão; guardar estado da partida em memória e persistir configurações estritamente necessárias em um arquivo local de acesso restrito. Não guardar credenciais em texto puro; usar hashing adequado.
- Usar biblioteca `ws` para WebSocket no backend; Vite dev server no desenvolvimento; backend servindo os arquivos compilados do frontend no modo apresentação.
- Não usar internet, VPS, docker obrigatório, microserviços, MQTT, bluetooth, login social ou serviços pagos.
- Defaults de laboratório (ex.: 300 ms de timeout de controle) são **parâmetros configuráveis sujeitos a testes**, não valores finais garantidos pela montagem.

---

## 2. O que o agente deve entregar

1. Repositório completo com frontend, backend, pacote de contratos e firmware ESP32.
2. Interfaces fiéis à intenção visual das imagens em `referencias/`: dark UI com destaque verde, entrada, controle do piloto, painel hacker. Adaptar responsivamente.
3. Simulador no backend para carrinhos A e B, com visualização do estado de motores/direção, capaz de rodar **sem ESP32**.
4. Comunicação WebSocket tipada e validada, com reconexão e sincronização de estado.
5. Autenticação por senha, mudança de senha, papéis `pilot`, `hacker`, e controle de acesso por equipe/carrinho; sem confiar em IDs ou roles enviados arbitrariamente pelo navegador.
6. Máquina de estados para atividade e para as etapas guiadas do ataque; controle por time com autorização.
7. Pipeline claro de comandos: entrada do piloto → transformações simuladas → aplicação de defesa didática → envio ao carrinho → telemetria. **Parada segura deve sempre prevalecer**.
8. Firmware que valide mensagens e movimente dois motores DC e servo, com watchdog / failsafe seguro e logs de diagnóstico.
9. Testes unitários, integração, WebSocket, E2E e plano de testes manuais no hardware.
10. Comandos de execução e documentação para Linux (principal) e, quando viável, Windows.
11. Documentação da pinagem real e dos pontos de alimentação **pendentes de validação elétrica**. Nunca assumir que a L298N fornece 5 V estáveis para ESP32/servo sem teste.
12. README, `.env.example`, troubleshooting, checklist de demonstração e instruções de segurança.

---

## 3. Limites e segurança da demonstração

- **Não implementar** scanner de rede real, sniffing, ARP spoofing, deauth, captura de senhas, exploração de equipamento de terceiro ou alteração de rede externa. `Escanear rede` significa listar somente carrinhos registrados no servidor HIJACK.
- O backend é **autoridade única** de times, sessões, permissões, progresso do ataque, estado das defesas e propriedade dos carrinhos. Navegadores não falam diretamente com o ESP32.
- Mudanças de direção e tração devem passar por limites de segurança. `STOP` e watchdog não podem ser invertidos nem desabilitados por atacante, mesmo em modo vulnerável.
- Falha crítica, timeout, desconexão, sessão inválida ou comando malformado → tração desligada. Ao reiniciar, carrinho entra parado. Apenas comando novo/autorizado volta a movê-lo.
- A senha `1234` só é permitida como estado vulnerável deliberado em rede isolada e deve estar identificada como tal na tela. Não expor senha em logs, telemetria ou mensagens de erro.
- Sem TLS somente em rede isolada de laboratório, com risco documentado. Não expor porta do servidor à internet. Separar configuração para rede de demonstração e ambientes não confiáveis.
- Um participante não pode trocar de papel/equipe via mensagem arbitrária. Ataque a carrinho só pode ser acionado pelo hacker da equipe oposta; defesa só pelo hacker dono do carrinho. O piloto só conduz o carrinho da equipe dele.
- Um único piloto ativo por carrinho; evitar disputas simultâneas de controle.
- Não confundir troca de senha com integridade de mensagens: o documento deve explicitar que a proteção de integridade é somente didática.

---

## 4. Arquitetura proposta

```text
Rede Wi-Fi LAN isolada
┌───────────────────────────────┐
│ Celular A (piloto)            │
│ Notebook A (hacker)           │
│ Celular B (piloto)            │
│ Notebook B (hacker)           │
└───────────────┬───────────────┘
                │ WebSocket + HTTP na LAN
                ▼
┌─────────────────────────────────────────────────────┐
│ Notebook servidor HIJACK                            │
│ HTTP: React compilado / health / API administrativa │
│ WS: autenticação, estado, ações, comandos            │
│ Modules: sessions, access, teams, devices, attacks, │
│          defenses, control, safety, telemetry        │
│                              │                      │
│   Simulator A/B ◄── DeviceAdapter ──► ESP32 A/B      │
└──────────────────────────────────┬──────────────────┘
                                   │ WS LAN
                              ┌────┴────┐
                              ▼         ▼
                            ESP32 A   ESP32 B
                            L298N     L298N
                            2 DC      2 DC
                            Servo     Servo
```

### 4.1 Princípios

- **DeviceAdapter** com a mesma interface para simulador e ESP32 real, para não duplicar regra de negócio.
- Máquina de estados explícita (não espalhar booleanos de ataque em componentes React).
- Contratos JSON versionados; `protocolVersion` obrigatório; cada mensagem tem `type`, `requestId` ou `eventId`, `sentAt`, payload validado.
- Telemetria do carrinho é **relato do firmware**, não prova física de movimento; sinalizar `simulado` vs `hardware` em toda a UI.
- Separar estado **desejado** do servidor e estado **confirmado** pelo ESP32.
- Não misturar atraso de renderização com latência do enlace físico. Medir métricas com definições explícitas.

### 4.2 Estrutura de diretórios

```text
hijack/
  README.md
  AGENTS.md
  package.json
  bun.lock
  .env.example
  apps/
    web/
      src/
        app/                  # rotas + providers
        pages/                # login, pilot, hacker, admin, simulator
        components/ui/        # shadcn
        components/hijack/    # status, joystick, attack-step, security-level
        features/auth/
        features/lobby/
        features/pilot/
        features/hacker/
        features/simulator/
        hooks/
        lib/ws-client.ts
        styles/
      tests/e2e/
    server/
      src/
        index.ts
        http/
        ws/
        config/
        modules/
          sessions/
          access/
          teams/
          devices/
          control/
          attacks/
          defenses/
          telemetry/
          demo/
        adapters/
          simulator/
          esp32/
        safety/
        persistence/
      tests/
  packages/
    protocol/
      src/
        schema.ts
        types.ts
        constants.ts
  firmware/
    platformio.ini
    include/
      config.example.h
      pins.h
    src/
      main.cpp
      wifi_client.cpp
      ws_client.cpp
      motor_driver.cpp
      steering_servo.cpp
      failsafe.cpp
    test/
  docs/
    architecture.md
    protocol.md
    hardware.md
    security-model.md
    demo-script.md
    testing.md
  referencias/
    pre_projeto.tex
    tela_login.jpg
    controle_piloto.jpg
    painel_hacker.jpg
    prototipo_carrinho.jpg
```

---

## 5. Domínio e estados

### 5.1 Entidades

- `Team`: `A | B`, nome de apresentação configurável.
- `Car`: `car-a | car-b`, `teamId`, `mode: simulated | hardware`, estado online, estado de movimento, saúde da ligação, configuração segura.
- `ParticipantSession`: identificador aleatório, `displayName`, `teamId`, `role`, `carId`, status, data de expiração; sessão protegida contra reutilização indevida.
- `Role`: `pilot | hacker | admin` (admin é função interna de configuração, não participante).
- `DemoState`: `setup | ready | running | paused | stopped`; **não** criar scoreboard, vencedores ou rounds competitivos.
- `AttackProgress`: `locked | scan | target | exploit | manipulate` e `active`/`completed` conforme necessário, com transições válidas.
- `AttackConfig`: `invertThrottle: boolean`, `invertSteering: boolean`, `initiatedByTeam`, `targetCarId`.
- `DefenseConfig`: `strongPasswordEnabled`, `integrityDemoEnabled`, `replayDemoEnabled`.
- `DriveState`: `throttle: -1|0|1`, `steering: -1|0|1`, `moving`, `lastValidCommandAt`, `sourceSession`, `sequence`.
- `Telemetry`: online, lastSeen, motion, steering, Wi-Fi RSSI (se disponível), uptime, reconnects, rejected commands, reason.

### 5.2 Transições da demonstração

```text
SETUP -> READY -> RUNNING -> PAUSED -> RUNNING -> STOPPED
                  └───────────────────────> STOPPED
```

- `SETUP`: admin configura equipes, modos e pareamentos; motores parados.
- `READY`: interfaces conectadas, motores parados, ataques bloqueados.
- `RUNNING`: libera piloto e etapas guiadas de ataque/defesa.
- `PAUSED`: bloqueia novos movimentos, força STOP; preserva UI e estado de progresso para retomar.
- `STOPPED`: força STOP, encerra sessões de controle e exige novo início.
- Não depender de pontuação ou tempo limite. A duração é livre.

### 5.3 Estados de ataque

1. `scan`: botão "Escanear rede" → animação/espera curta → resultado **somente** dos carrinhos cadastrados, sem scan real.
2. `target`: selecionar exclusivamente o carrinho da equipe adversária, com aviso "simulado".
3. `exploit`: botão "Explorar vulnerabilidade" → checagem de permissões e estado → relatório simulado explicando falha; sem scripts ofensivos reais.
4. `manipulate`: controles independentes `Frente ↔ Ré` e `Esquerda ↔ Direita` e botão de desativar todas. Só funciona durante `RUNNING`, na equipe adversária e quando a proteção didática correspondente não bloqueia.

**Importante:** a inversão dos eixos é individual e pode ser ativada simultaneamente. Interferência não causa movimento por si só: só altera um comando de piloto *enquanto* houver comando autorizado. `STOP` não é transformado.

---

## 6. UX/UI — detalhes de telas

**Visual de referência:** screenshots fornecidas pelo grupo (dark quase preto, verde como cor principal, indicadores simples). Priorizar legibilidade mobile e acessibilidade.

### 6.1 Entrada (`/`)

Campos: nome, papel `Piloto | Hacker`, carrinho A/B, nome opcional do carrinho (apenas display), senha. Mostrar rótulo `Modo simulado` quando habilitado. Em demo, informar que `1234` é senha propositalmente fraca **sem permitir essa dica quando o modo protegido estiver ativo**. Validar obrigatório, comprimento, sanitizar nome, mensagens neutras de erro. Após autenticar, redirecionar segundo o papel. Evitar exibir dados privados em query string.

**Regras:** selecionar carrinho significa escolher time, não reivindicar o carro de outra sessão; backend confirma se slot está disponível. Participante não escolhe `admin` na UI. Usuários duplicados não devem ocupar o mesmo slot sem liberação explícita.

### 6.2 Piloto (`/pilot`)

- Joystick virtual grande, operável por toque e ponteiro; suporte opcional a teclado `WASD`/setas em desktop, sem substituir mobile.
- Direção em dois eixos separados: vertical = `-1/0/1` (ré, neutro, frente); horizontal = `-1/0/1` (esquerda, centro, direita). Pode combinar vertical e horizontal para fazer curva em movimento. **Não** gerar comandos de PWM proporcional à distância do joystick: velocidade fixa.
- Dead zone configurável na interface e centralização ao soltar.
- `pointerup`, `pointercancel`, perda de foco, mudança de aba, desmontagem do componente e conexão perdida → enviar STOP (best effort) e o servidor/firmware também aplica timeout independente.
- Estado visual: `Aguardando largada` em READY, `Em demonstração` em RUNNING, `Pausado`, `Sem conexão`, `Parada de segurança`.
- Botões **A e B** visíveis, mas `disabled` e com legenda discreta `Função não definida` (nunca emitir mensagem de hardware).
- Mostrar sinalização se comando foi alterado pelo ataque (apenas se isso fizer parte da didática definida pelo grupo; por padrão não revelar ao piloto antes do efeito).

### 6.3 Hacker (`/hacker`)

Barra superior: equipe, conexão, demonstração, segurança em 3 indicadores; abas **Ataque** e **Defesa**. A aba Ataque mostra etapas guiadas e bloqueios durante READY/PAUSED. Exibir `Esta é uma simulação no servidor, não uma invasão de rede`.

**Ataque:** etapas progressivas, status de cada etapa, ações de inversão individuais, eventos `comando alterado/bloqueado`, botão `Desativar ataque` e feedback amigável. Não permitir escolha de alvo fora da equipe adversária.

**Defesa:** 
- Cartão `Autenticação`: estado vulnerável `1234`, formulário de troca por senha forte, confirmação e feedback; **a senha deve mudar de verdade** e sessões afetadas precisam seguir política explícita (reautenticação quando necessário).
- Cartão `Integridade`: chave didática que impede a inversão feita pelo servidor; rótulo permanente `Simulação, não HMAC`.
- Cartão `Repetição`: chave didática que gera/mostra exemplo de comando antigo recusado; rótulo permanente `Simulação, não validação no firmware`.
- Indicador 0 a 3 representa **camadas demonstradas**, não um nível real de segurança. Tooltip explicativo.

### 6.4 Admin (`/admin`, apenas operador)

- Escolha `simulado/hardware` por carrinho, status do ESP32, times/slots, início/pause/fim/reset.
- Ação de **STOP ALL** grande, de prioridade máxima, sempre disponível.
- Configuração de IP/host e pareamento dos ESP32 pelo lado servidor; nunca permitir que usuários comuns definam endpoints arbitrários.
- Painel de logs e métricas com exportação CSV/JSON (sem segredos).
- Reset de demo restaura etapa vulnerável mediante confirmação e só quando os motores estão parados. **Não resetar senha sem autorização explícita do operador**.

### 6.5 Simulador (`/simulator`)

Dois carrinhos em vista simplificada, posição/heading ou indicador de movimento (não prometer física realista), seta de direção do servo, movimento desejado e movimento aplicado. Etiqueta grande `SIMULAÇÃO`. Lista de eventos. Permitir testar ataque e defesa de ponta a ponta, com o backend executando a mesma lógica que usará com hardware.

---

## 7. Protocolo de mensagens WebSocket

### 7.1 Envelope geral (contrato proposto)

```json
{
  "protocolVersion": 1,
  "type": "pilot.drive",
  "requestId": "uuid-v4",
  "sentAt": 1790000000000,
  "payload": { "throttle": 1, "steering": -1, "pressed": true }
}
```

- Usar **tipos e schemas Zod** em `packages/protocol` para navegador/backend. Firmware implementa subconjunto documentado em C++ com validação de tamanho/valores.
- Rejeitar `type` desconhecido, campos inválidos e payload grande; limite conservador configurável (ex.: 2 KiB). Não aceitar identificador de time/role de mensagens de drive como autoridade.
- Mensagens com comandos não podem ser enfileiradas para execução após reconectar.
- Autenticação por sessão na conexão/browser; ESP32 usa identidade e segredo de dispositivo provisionados em arquivo local/firmware e validados pelo servidor. Nunca usar senha `1234` como segredo de dispositivo.

### 7.2 Tipos de cliente web → servidor

| Tipo | Payload essencial | Quem envia |
|---|---|---|
| `session.login` | name, role, carId, password | entrada |
| `session.logout` | vazio | participante |
| `session.resume` | token/sessão de reentrada | participante |
| `pilot.drive` | throttle, steering, pressed | piloto autorizado |
| `pilot.stop` | motivo | piloto autorizado |
| `attack.scan` | vazio | hacker durante demo |
| `attack.selectTarget` | targetCarId | hacker adversário |
| `attack.exploitDemo` | vazio | hacker autorizado |
| `attack.configure` | invertThrottle, invertSteering | hacker após etapas |
| `attack.disable` | vazio | hacker autorizado |
| `defense.setIntegrityDemo` | enabled | hacker defensor |
| `defense.setReplayDemo` | enabled | hacker defensor |
| `auth.changePassword` | currentPassword, nextPassword | autorizado |
| `admin.setDemoState` | state | operador |
| `admin.stopAll` | motivo | operador |
| `admin.resetDemo` | flags explícitas | operador |

### 7.3 Servidor → clientes web

- `session.accepted` / `session.denied` (sem expor existência da senha ou usuários).
- `state.snapshot` ao conectar/reconectar; `state.delta` ou eventos específicos durante a operação.
- `car.telemetry`, `car.connectionChanged`, `pilot.commandApplied`, `pilot.commandRejected`.
- `attack.progress`, `attack.changed`, `defense.changed`, `security.demoLevelChanged`.
- `system.error` com códigos estáveis, `system.warning`, `system.stopAll`.
- Incluir `serverTime`, `stateRevision` monotônica para ignorar mensagens antigas; nunca confiar apenas no horário do navegador para ordenação.

### 7.4 Servidor → ESP32

```json
{
  "protocolVersion": 1,
  "type": "device.drive",
  "requestId": "uuid-v4",
  "seq": 42,
  "payload": {
    "throttle": 1,
    "steering": -1,
    "speedMode": "fixed",
    "commandTtlMs": 300
  }
}
```

- `throttle=-1|0|1` e `steering=-1|0|1`. O backend pode inverter um eixo por vez, preservando neutralidade (`0`) e STOP.
- `device.stop` com prioridade sobre demais comandos; `device.heartbeat` apenas para saúde do canal, não autoriza movimento.
- Firmware → servidor: `device.hello`, `device.ack`, `device.telemetry`, `device.fault`, `device.stopped`; incluir `lastSeq` aplicado, sem expor segredo.
- **Sequência e TTL usados para evitar execução acidental de mensagens obsoletas podem existir como requisito básico de confiabilidade/safety**; isso não constitui a camada didática de “proteção contra repetição” apresentada pela UI nem promessa de defesa criptográfica.
- A TTL de movimento deve ser baseada no **tempo de recebimento no firmware e timer monotônico local**, não em clock sincronizado do navegador.

### 7.5 Cadência e tempos iniciais (configuráveis após teste)

- Piloto envia mudanças imediatamente e refresh de estado pressionado a cada **100 ms**.
- Backend encaminha no máximo 10–20 comandos/s por carrinho; coalescer estados, sem fila acumulativa.
- Firmware desliga tração se não receber **comando de movimento válido recente** em **300 ms** (parâmetro inicial), ou ao cair WS/Wi-Fi.
- Backend ao perder piloto, pausar ou detectar erro → STOP imediato + watchdog do ESP32 como segunda barreira.
- Ping/heartbeat de conexão não estende o watchdog do movimento.
- Reconexão do navegador ou ESP32 **nunca** retoma movimento antigo automaticamente.
- Mensagens fora de ordem `seq <= lastSeq` são descartadas por segurança operacional, mesmo sem a camada didática ativa.

---

## 8. Pipeline de simulação de ataque e defesa

```text
1. Autorizar sessão e ownership do piloto
2. Validar comando físico permitido; STOP passa sem transformação
3. Se demo running e ataque adversário ativo:
   a. se defesa de integridade simulada ativa: NÃO inverter
   b. caso contrário, inverter individualmente os eixos habilitados
4. Aplicar limites de segurança (STOP, TTL, sessão, state)
5. Enviar novo estado para DeviceAdapter (simulador ou hardware)
6. Receber ACK/telemetria, publicar eventos e métricas
```

### 8.1 Exemplos testáveis

- `(throttle=1, steering=0)` com inversão de tração → `(-1, 0)`.
- `(1, -1)` com inversão de direção → `(1, 1)`.
- `(1, -1)` com ambas → `(-1, 1)`.
- `(0, 0)` com ambas → `(0, 0)` (**STOP/neutral inviolável**).
- Com integridade didática ativada, nenhuma transformação ofensiva é aplicada; um log explica que houve tentativa bloqueada.
- Ataque nunca deve gerar `throttle ≠ 0` se o piloto estiver solto/desconectado.
- Simulação de replay: UI gera um **evento didático** de comando antigo e recusa; não injetar movimento físico para ilustrar replay.
- Trocar senha rejeita credencial antiga em nova autenticação; política de revogação de sessões deve ser implementada e testada.

---

## 9. Firmware ESP32 — requisitos operacionais

### 9.1 Componentes

- `WiFi`: conecta à rede definida em arquivo local ignorado pelo git; reconecta com backoff; ao desconectar chama STOP.
- `WebSocket`: conexão autenticada ao servidor; valida JSON e modo de controle do dispositivo.
- `MotorDriverL298N`: configura GPIOs IN1/IN2, IN3/IN4, ENA/ENB; sentidos de tração para frente/ré; velocidade fixa. Verificar polaridade real dos dois motores.
- `SteeringServo`: posiciona centro/esquerda/direita; **calibração** dos ângulos e limites mecânicos em config; não presumir 0°, 90°, 180° como seguros.
- `Failsafe`: watchdog independente de frames válidos de movimento; STOP em desconexão, comando expirado, erro de parse, falha de estado, timeout, boot.
- `Telemetry`: uptime, RSSI, último comando, último seq, reason de parada, contadores.

### 9.2 Pinos do pré-projeto (verificar com montagem real)

| ESP32 | L298N | Função |
|---|---|---|
| GPIO14 | ENA | habilitação A |
| GPIO27 / GPIO26 | IN1 / IN2 | direção A |
| GPIO25 / GPIO33 | IN3 / IN4 | direção B |
| GPIO32 | ENB | habilitação B |
| GND | GND | terra comum |

**Servo:** pino de sinal e alimentação **não definidos**. Tornar configurável e não escolher pino arbitrário como se estivesse confirmado. Antes do build de hardware, exigir preenchimento documentado de `STEERING_PIN`, `SERVO_LEFT_US`, `SERVO_CENTER_US`, `SERVO_RIGHT_US` e teste local. No simulador não precisa disso.

### 9.3 Alimentação / cautelas de hardware

- Duas 18650 em série: aproximadamente 7,4 V nominal e 8,4 V com carga completa. Validar proteção do pack, polaridade, chave, corrente e carregamento compatível com células em série.
- Módulo L298N **não** garante regulador 5 V confiável nas condições da montagem, e a queda na ponte afeta tensão nos motores. Validar sob carga; prever **buck regulator** externo adequado para ESP32 e servo, dimensionado conforme consumo medido.
- Servo **não** deve ser alimentado a partir de GPIO. A fonte do servo deve ser adequada, GND comum, e projeto mecânico deve evitar travamento nos batentes.
- Especificação do firmware deve ter feature flag `HARDWARE_OUTPUT_ENABLED=false` por padrão em dev; habilitar saídas só após checklist físico validado.
- Não ligar nem operar carrinho sem teste de rodas suspensas, polaridade e parada de emergência; motor pode partir inesperadamente.

### 9.4 Testes reais mínimos

1. Boot sem movimento; desligamento seguro ao desligar notebook/roteador.
2. Com rodas suspensas, confirmar sentido motor A/B para frente e ré.
3. Calibrar centro e máximos mecânicos do servo com tração desligada.
4. Joystick para frente/ré, esquerda/direita, diagonal, soltar e reconectar.
5. Desligar Wi-Fi enquanto carro se move: parar em tempo medido. Registrar resultado.
6. Repetir com bateria parcialmente descarregada, observar resets e aquecimento.
7. Testar cada carro isoladamente; depois simultaneamente e sob ataques simulados.
8. Operador consegue STOP ALL; se houver falha de software, corte físico de energia continua disponível.

---

## 10. Autenticação, autorização e segredo

- Login com nome + time/carrinho + papel + senha. A senha padrão **é vulnerabilidade pedagógica intencional**; não reutilizar para autenticação do dispositivo.
- Persistir o hash da senha (ex.: Argon2id se suportado com segurança pelo runtime) com salt; armazenar configuração em arquivo local fora de `public/`, permissões restritas. Não persistir senha em claro.
- Troca de senha exige confirmação da atual e comprimento mínimo razoável; permitir demonstração da mudança e revogar/revalidar sessões conforme política documentada. Ao trocar senha, parar o carrinho afetado até reautenticar piloto se sua sessão foi revogada.
- Sessões aleatórias e expiradas automaticamente, rate limit de tentativas de login e troca de senha, bloqueio temporário progressivo e erros genéricos.
- Admin precisa de segredo próprio de operador (`ADMIN_TOKEN` ou login separado definido na instalação) **diferente** da senha vulnerável dos carrinhos. Nunca exibir senha/admin token no frontend nem commitar `.env`.
- Browser WebSocket: checar `Origin`, autenticar handshake/sessão e reforçar autorização em **cada mensagem**; não aceitar mutação cruzada A/B.
- ESP32: identidade única e segredo de pareamento local, provisionados por config não versionada. A rede Wi-Fi isolada não substitui autenticação da conexão.
- Se usar cookies, `HttpOnly`, `SameSite` e proteção contra CSRF apropriada; se optar por token em memória, documentar expiração e riscos de XSS. Não guardar segredo persistente em `localStorage` por conveniência.

---

## 11. Métricas, logs e observabilidade

Registrar (em memória e exportar quando solicitado):

- Contagem de comandos recebidos, aplicados, invertidos e bloqueados (distinguir categorias).
- Timestamps de servidor para recebimento/aplicação, ACK do ESP32 e latência de ida/volta. `latencyAckMs` não é latência mecânica; não rotular como tempo até a roda girar.
- Picos/p95, desconexões por dispositivo, último heartbeat, watchdog trips, falhas de validação, erros de firmware.
- Alterações em integridade demo, replay demo e troca de senha, com `actorRole`, `teamId`, `timestamp` e `reason`, **sem credenciais**.
- Healthcheck `/health` sem informações sensíveis e contador de dispositivos conectados.
- Exportação com no máximo N eventos em memória / limites configuráveis; evitar logs infinitos em máquina local.
- Badge em todos os relatórios: `simulated` ou `hardware`, para não misturar resultados.

---

## 12. Testes automatizados — matriz de aceitação

### 12.1 Unitários (Vitest ou bun:test)

- transformações dos eixos e preservação de neutralidade.
- autorização de sessão por papel/time.
- máquina de estados de demo (não aceita ataque em READY/PAUSED).
- etapas guiadas na ordem correta.
- bloqueio por integridade didática.
- replay didático não injeta comando real.
- revogação de sessão/troca de senha.
- timeout, sequência, snapshot/revision e reconexão.
- schemas rejeitam valores fora de -1,0,1 e campos obrigatórios ausentes.

### 12.2 Integração servidor + simulador

- Duas equipes controlam carros distintos ao mesmo tempo.
- Hacker A só modifica B; hacker B só modifica A.
- Defesa de B bloqueia ataque de A sobre B sem bloquear controle do piloto B.
- STOP ignora ataque; perda de WebSocket do piloto para carro correspondente.
- Server restart: estado de movimento não é restaurado; simuladores param.
- Mensagens malformadas/muito grandes não derrubam o servidor.
- Reconexão recebe estado completo e não volta a executar comando antigo.

### 12.3 E2E (Playwright)

- Entrada de piloto/hacker em navegador desktop/mobile.
- Tela aguarda largada; admin muda `READY → RUNNING`.
- Joystick mouse/touch/pointer release produz STOP.
- Hacker segue quatro etapas; liga as duas inversões independentemente.
- Defensor liga integridade, alteração deixa de ocorrer.
- Troca de senha: antiga falha ao reconectar, nova funciona.
- Controles A e B não têm efeito, mas permanecem visíveis.
- Feedback visível para rede offline e perda de carrinho.

### 12.4 Hardware / manual (não alegar automático)

- Confirmar direção dos motores e centro do servo, estabilidade elétrica, failsafe medido, resposta sob carga, aquecimento, Wi-Fi, ESP32 A/B simultâneos.
- Documentar valores realmente medidos, método e limites; **não fabricar números**.

---

## 13. Desenvolvimento por fases (ordem obrigatória)

### Fase 0 — levantamento

- Ler este plano, `referencias/pre_projeto.tex` e screenshots.
- Inspecionar repositório antes de sobrescrever arquivos.
- Criar `docs/assumptions.md` distinguindo fatos do grupo, decisões de arquitetura e pontos pendentes do hardware.
- Definir scripts `dev`, `build`, `test`, `lint`, `typecheck`; documentar runtime e instalação.
- **Aceite:** estrutura aprovada pelo próprio checklist, sem hardware obrigatório.

### Fase 1 — monorepo e contratos

- Inicializar apps/web, apps/server, packages/protocol e firmware/.
- Frontend shadcn com tema escuro; backend Express+WS com endpoint de health.
- Criar schemas e mensagens JSON versionadas; validação nos dois lados.
- **Aceite:** scripts executam; HTTP responde; WS conecta; teste de contrato passa.

### Fase 2 — simulador realista o suficiente para software

- Implementar `DeviceAdapter`, `SimulatorAdapter`, cadastro de A/B, movimentos independentes, telemetria e STOP.
- Construir painel `/simulator` com estado desejado vs confirmado e eventos.
- Não implementar física complexa nem localização GPS.
- **Aceite:** comandos de teste afetam só o carro correto, STOP e timeouts funcionam.

### Fase 3 — sessões e entrada

- Implementar login nome/papel/carro/senha `1234`, limites de sessão, slots exclusivos, autorização no WS e troca de senha.
- Criar telas de entrada responsivas próximas às referências.
- Admin inicia/pausa/reseta demo e tem STOP ALL.
- **Aceite:** tentativas de role spoofing e controle cruzado falham; senha alterada tem efeito real.

### Fase 4 — piloto

- Implementar joystick virtual touch/mouse, eixos independentes, velocidade fixa, parada ao soltar, perda de foco, perda de WS.
- Botões A/B visuais desabilitados.
- **Aceite:** controle de A não afeta B; diagonal combina tração e direção; STOP funciona sem depender da UI.

### Fase 5 — ataque guiado

- Escanear apenas inventário local; seleção restrita de alvo; exploração fictícia; inversões de eixos.
- UI de ataque com estados progressivos e logs.
- **Aceite:** somente após 4 etapas, inversão A→B ocorre e preserva STOP; sem scan externo.

### Fase 6 — defesa e explicação didática

- Cartões de senha real, integridade demo e repetição demo com indicador 0/3 sem alegar garantia de segurança.
- Registrar bloqueios e comparar `desired`/`applied`.
- **Aceite:** integridade bloqueia inversão de verdade na lógica do servidor; replay é apenas evento didático; senha antiga é recusada.

### Fase 7 — firmware e `Esp32Adapter`

- Configuração Wi-Fi/WS, comandos, L298N, servo, failsafe, telemetria e sequence/timeout.
- Build de firmware sem precisar energizar placa, quando ferramenta instalada; documentar limitações.
- Implementar adaptador com mesmo contrato que simulação.
- **Aceite:** firmware compila; hardware só considerado aprovado após testes físicos manuais documentados.

### Fase 8 — robustez e apresentação

- Testes, tratamento de erro, E2E, acessibilidade, métricas, logs, exportação, README.
- Script de apresentação demonstrando duas equipes e as diferenças entre segurança real/simulada.
- Build frontend servido pelo backend em um endereço LAN; instruções para firewall e URL por QR code opcional.
- **Aceite:** fluxo ponta a ponta funciona sem internet com simuladores; fluxo ESP32 documentado e com checklist de hardware.

### Fase 9 — revisão e entrega

- `bun install`, `bun run lint`, `bun run typecheck`, `bun run test`, `bun run build` e E2E conforme scripts reais; documentar comandos executados.
- Mostrar `git diff`, problemas abertos, arquivos novos, checklist de aceitação.
- Priorizar resolver falhas de segurança física e de autenticação antes de refinamentos visuais.

---

## 14. Definition of Done

O projeto só está pronto **como software simulado** quando:

- [ ] login/papéis/equipes + sessões seguras funcionam;
- [ ] dois carros simulados funcionam ao mesmo tempo;
- [ ] controles de piloto funcionam em celular e desktop;
- [ ] soltar joystick ou perder comunicação faz parar;
- [ ] quatro etapas do hacker e duas inversões independentes funcionam;
- [ ] defensor bloqueia inversão no servidor e exibe corretamente o caráter simulado;
- [ ] troca real da senha altera autenticação;
- [ ] replay didático não se confunde com criptografia real;
- [ ] admin faz pause/STOP ALL;
- [ ] testes automáticos importantes estão verdes e README reproduz execução limpa;
- [ ] métricas separam simulado e hardware.

O projeto só está pronto **para demonstração física** quando, além do acima:

- [ ] pinos reais confirmados; servo escolhido/calibrado;
- [ ] alimentação do ESP32 e servo medida e considerada estável sob carga;
- [ ] movimentos de tração e esterçamento testados com rodas suspensas;
- [ ] watchdog real para o carro em perda de WS/Wi-Fi;
- [ ] STOP ALL e parada física comprovados;
- [ ] dois ESP32 funcionam juntos em LAN isolada;
- [ ] medição e testes documentados, sem resultados inventados.

---

## 15. Comandos de uso esperados (ajustar ao que o repositório realmente implementar)

```bash
# Na raiz do monorepo
bun install
bun run dev             # web e server em modo desenvolvimento
bun run test
bun run lint
bun run typecheck
bun run build
bun run start           # distribuição local: web estática + servidor WS

# Firmware (com PlatformIO instalado)
cd firmware
pio run                 # compilar
# Só gravar após pinos, fonte, servo, rodas suspensas e segurança conferidos
# pio run -t upload
```

Documentar `SERVER_HOST`, `SERVER_PORT`, `PUBLIC_BASE_URL`, `WIFI_SSID`, `WIFI_PASSWORD`, `DEVICE_ID`, `DEVICE_SECRET`, `ADMIN_SECRET`, `CAR_MODE`, timeout de movimento e flags de hardware com exemplos seguros. Não assumir que `.env` do backend é automaticamente lido pelo microcontrolador.

---

## 16. Prompt mestre para enviar ao agente

> **Tarefa:** Implemente o sistema HIJACK com base no arquivo `PLANO_IMPLEMENTACAO_HIJACK.md` e nas referências de `referencias/`. Trata-se de uma demonstração acadêmica local de controle de carrinhos ESP32 por WebSocket, duas equipes (piloto/hacker), ataque guiado simulado e defesa pedagógica. Use o plano como fonte de verdade para escopo, contratos, segurança, interfaces, testes e etapas.
>
> **Instruções de execução:**
> 1. Inspecione o repositório e leia o plano integralmente antes de codificar.
> 2. Crie e mantenha `docs/progress.md` com etapas pendentes, concluídas, testes executados e bloqueios reais. Faça pequenos commits/coerentes quando autorizado pelo ambiente.
> 3. Implemente fase por fase, priorizando um fluxo E2E funcional em simulação antes de depender do ESP32.
> 4. Use React/Vite/TypeScript/Tailwind/shadcn no frontend, Bun/Express/WS no backend, pacote compartilhado de validação, PlatformIO/Arduino no firmware, salvo incompatibilidade demonstrada e documentada.
> 5. Preserve a direção por **servo motor** e tração por dois motores DC com L298N, velocidade fixa. Não implementar curvas por tração diferencial.
> 6. As etapas de ataque são **simulações internas no servidor**; não escaneie redes nem implemente exploração real. Integridade e replay são **demonstrações simuladas**; senha alterada tem efeito **real**. STOP/watchdog são proteções reais e inegociáveis.
> 7. Não fabrique pinagem do servo nem declare alimentação estável sem medir. Permita rodar 100% do software em simulador e isole dependências de hardware.
> 8. A cada fase, rode lint, typecheck, testes e builds relevantes. Corrija erros antes de avançar. Não diga que testou hardware se não testou.
> 9. Produza README utilizável por outro integrante do grupo, `docs/architecture.md`, `docs/protocol.md`, `docs/hardware.md`, `docs/demo-script.md` e checklist de segurança.
> 10. Faça escolhas simples quando o plano não especificar detalhes; registre em `docs/assumptions.md`, sem expandir o escopo. Não faça perguntas sobre escolhas que já estão documentadas.
>
> **Critério de sucesso prioritário:** abrir o sistema no notebook, entrar com dois pilotos e dois hackers, controlar dois carrinhos simulados, executar a sequência guiada de ataque, inverter independentemente frente/ré e esquerda/direita, ativar as defesas, trocar a senha, observar métricas e forçar STOP; depois integrar os ESP32 mantendo o mesmo fluxo.

---

## 17. Prompts menores caso o agente tenha limite de contexto

**Prompt Fase 1–2:** “Leia o plano mestre e implemente só monorepo, contratos WebSocket, servidor e simulador de dois carrinhos. Inclua testes e documentação. Não comece firmware nem ataques antes da validação do fluxo simulado.”

**Prompt Fase 3–4:** “Leia o plano mestre e o progresso existente. Implemente autenticação, sessões, permissões, admin e controle do piloto com joystick, STOP e timeout. Execute E2E. Não altere contratos sem migrar testes.”

**Prompt Fase 5–6:** “Leia o plano mestre. Implemente ataque guiado simulado com escolha individual dos eixos, defesa didática e troca real de senha. Garanta que STOP é inviolável e nenhuma função efetua scan real de rede.”

**Prompt Fase 7:** “Leia o plano mestre. Implemente firmware ESP32 PlatformIO e Esp32Adapter, separando configurações de pinos/servo pendentes. Compile o firmware; não afirme testes físicos. Documente checklist de fonte, servo e failsafe.”

**Prompt Fase 8–9:** “Leia o plano mestre. Execute revisão integrada, E2E, métricas, acessibilidade e documentação de LAN offline. Corrija as falhas, reporte exatamente o que foi testado, e prepare o roteiro de apresentação.”

---

## 18. Riscos conhecidos e decisões ainda físicas

1. **Mecânica da direção:** o desenho compartilhado indica intenção de eixo direcionável por servo, mas não fixa geometria. O software não deve prometer um ângulo de curva ou cinemática específica.
2. **Pinos do servo:** não confirmados. Parametrizar e validar antes de energizar.
3. **Fonte:** saída 5 V da L298N para ESP32 pode ser instável com pack 2S; servo adiciona carga. Planejar fonte externa regulada após medição.
4. **Controles simultâneos:** se os dois hackers atacarem e defenderem ao mesmo tempo, manter estado isolado por carrinho e operações atômicas no servidor.
5. **Segurança didática vs criptográfica:** deixar explícito que bloqueio de inversão no servidor não prova HMAC real nem segurança de transporte.
6. **Interface vs firmware:** frontend não deve decidir sozinho se o carrinho está seguro; o ESP32 precisa parar autonomamente.
7. **WebSocket LAN:** IP do notebook pode mudar; oferecer passo a passo para descobrir IP e orientar roteador/firewall.
8. **Escala:** duas equipes, dois carros e poucas conexões locais. Não otimizar para internet/SaaS nem introduzir infraestrutura desnecessária.
9. **Rede da demonstração (atualização de 10/11/2026):** a mesh doméstica usada na bancada tem sinal fraco longe do nó e travadas de vários segundos. Usar roteador dedicado de 2,4 GHz em canal fixo, com o ESP32 perto (RSSI melhor que −70 dBm).
10. **Failsafe independente da rede (atualização de 10/11/2026):** no firmware, Wi-Fi, portal e WebSocket rodam em tarefa própria e o `loop()` de controle é o único dono de failsafe, motores, servo e LED. Detalhes em `../../esp32/docs/progress.md`.
11. **Próximos passos físicos (atualização de 10/11/2026):** ordem por módulo que chegar (L298N, servo, peças 3D) e critérios para ligar os motores com bateria em `../../esp32/docs/proximos-passos-hardware.md`.

---

## 19. Referências de implementação (documentação oficial)

- shadcn/ui + Vite: https://ui.shadcn.com/docs/installation/vite
- Bun: https://bun.com/docs
- Express: https://expressjs.com/
- WebSocket `ws`: https://github.com/websockets/ws
- PlatformIO: https://docs.platformio.org/
- ESP32 Arduino: https://docs.espressif.com/projects/arduino-esp32/en/latest/
- Vite: https://vite.dev/
- Zod: https://zod.dev/
- Playwright: https://playwright.dev/

Use essas fontes para checar versões e APIs efetivamente instaladas. **Não** fixar versões arbitrárias não testadas.
