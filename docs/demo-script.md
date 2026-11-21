# Roteiro da apresentação

Duração livre, sem pontuação nem vencedor. Um operador conduz pelo `/admin` e o `/simulator` fica no projetor.

**Padrão — 1 carrinho (`DEMO_TOPOLOGY=single`):** equipe A = piloto do Carrinho A (celular) + hacker que **defende** (notebook); equipe B = hacker que **ataca** o Carrinho A (notebook). **Opção — 2 carrinhos (`dual`):** cada equipe tem piloto e hacker e ataca o carrinho adversário; as diferenças estão em "Variante com 2 carrinhos" no fim.

O piloto controla frente/ré em velocidade fixa e a direção **proporcional** (quanto mais o analógico vai para o lado, mais o servo esterça, até ±45° no carrinho real). Andando, o analógico todo para o lado mantém a frente ou a ré com a direção a 100 %; parado, só vira as rodas.

## Preparação (antes do público)

1. `bun run demo` no notebook servidor; anotar o endereço da LAN (aparece no terminal e no `/admin`).
2. `/admin`: entrar com o segredo do operador.
   - **Topologia:** conferir "1 carrinho" (ou escolher "2 carrinhos"); só dá para trocar fora da partida.
   - Modo do Carrinho A (e do B, se `dual`): **Hardware** se o ESP32 estiver pronto e testado; senão **Simulado**.
   - **Resetar demonstração** marcando ataques, defesas e **senhas** (volta ao `1234`).
3. Projetor em `/simulator`.
4. Piloto entra em `/` pelo QR code do `/admin`: nome, **Piloto**, Carrinho A, senha `1234`.
5. Hackers entram em `/` nos notebooks: nome, **Hacker**, equipe ("Equipe A — defende o Carrinho A" ou "Equipe B — ataca o Carrinho A"), senha `1234` (a da equipe B é a senha guardada para o Carrinho B).
6. Conferir no `/admin` as três vagas ocupadas (piloto A, hacker A, hacker B) e o Carrinho A online; o Carrinho B aparece "desativado".

## 1. Largada (≈ 2 min)

- Operador: **Pronto** → **Iniciar**. Pilotos veem "Em demonstração".
- O piloto dirige livremente; no projetor a direção aparece em percentual (ex.: "D 60%"). No projetor, **Solicitado** e **Confirmado** são iguais.
- Mostrar a segurança física: piloto solta o joystick → carrinho para. Operador aperta **STOP ALL** → tudo para e a partida fica **Pausada**: comandos de piloto são recusados enquanto estiver pausada. Depois de **Retomar**, o piloto que estava segurando ou tocou nos controles durante a pausa precisa soltar e tocar de novo antes de o carrinho voltar a andar.

## 2. Ataque guiado (≈ 4 min)

O hacker B ataca o Carrinho A, explicando cada etapa (o hacker A vê na aba Ataque que, com 1 carrinho, sua equipe defende):

1. **Escanear rede** — lista só os carrinhos ativos cadastrados no servidor; nenhuma varredura real.
2. **Identificar o adversário** — só o Carrinho A (o alvo) pode ser escolhido.
3. **Explorar vulnerabilidade** — relatório simulado: senha padrão `1234` e comandos sem verificação de integridade.
4. **Modificar comandos** — ligar **Frente ↔ Ré**. O piloto A tenta ir para frente e o carrinho vai de ré.
   - Projetor: **Solicitado: frente**, **Confirmado: ré**, faixa "COMANDO ALTERADO NO CAMINHO".
   - Depois ligar também **Esquerda ↔ Direita**: a direção é espelhada com a mesma intensidade (pedido "E 60%" vira "D 60%").

Ponto didático: a inversão nunca move um carrinho parado e nunca impede o STOP.

Ao apresentar um controle de ataque, abrir o ícone de informação ao lado do nome. Ler **Na vida real** para contextualizar a ameaça e **No HIJACK** para explicar o efeito simulado e seus limites. O balão abre por mouse, clique, toque ou teclado e continua acessível com a partida pausada. As explicações são conceituais, sem instruções para executar ataques reais.

### Ataques extras (≈ 5 min, opcionais)

Depois das inversões, o hacker B pode mostrar os outros ataques da etapa 4 (todos simulados no servidor):

- **Sabotagem:** viés de direção (o carrinho puxa para um lado), travar direção, atraso de 150/300 ms, perda de 30/60 % dos comandos (o carrinho engasga e o watchdog aparece nas métricas) e replay (o carrinho repete o que o piloto fez 5 s antes).
- **Espionagem:** interceptar tráfego (o feed mostra os comandos do piloto e o que o servidor manda ao carrinho, em texto claro) e quebrar a senha por dicionário (acha o `1234`).
- **Canal:** derrubar o link por 5 s (o carrinho para sozinho pelo failsafe; o projetor mostra "LINK DERRUBADO") e falsificar a telemetria (o monitor do hacker A mostra o carrinho obedecendo enquanto o projetor mostra "COMANDO ALTERADO NO CAMINHO").
- **Sequestro:** o hacker B liga "Sequestrar o carrinho" e dirige pelo analógico dele; o piloto A vê "Controle tomado pelo invasor" e o projetor mostra "CARRINHO SEQUESTRADO". O STOP ALL continua parando tudo.

## 3. Defesa (≈ 4 min)

Hacker A na aba **Defesa**:

Os quatro cartões também têm ícones de informação: usar os balões para explicar o mecanismo real e distinguir a proteção demonstrada daquela que existe de fato no projeto.

1. **Autenticação (real):** trocar `1234` por uma senha forte.
   - O piloto A é desconectado e precisa entrar com a nova senha; `1234` deixa de funcionar.
   - **Mostrar que a inversão continua acontecendo**: senha forte impede acesso indevido, mas não protege contra alterações feitas por um componente já autorizado (o servidor, nesta simulação).
   - Se o sequestro estava ativo, ele termina na hora e não pode ser religado; a quebra de senha passa a falhar.
2. **Integridade (simulada, não HMAC):** ligar.
   - O piloto A volta a ir para frente; o projetor mostra Solicitado = Confirmado.
   - O hacker B vê "Alteração bloqueada pela integridade (simulada)".
3. **Repetição (simulada, não validação no firmware):** ligar e gerar um exemplo.
   - O registro mostra um comando antigo reapresentado e recusado, sem mover o carrinho; com o replay do hacker B ligado, o carrinho volta a obedecer o piloto ("Repetição recusada").
4. **Criptografia (simulada, não TLS):** ligar; o feed de interceptação do hacker B fica ilegível.
5. Indicador de segurança chega a 4/4 — lembrar que conta **camadas demonstradas**, não segurança real.
   - A integridade também derruba a telemetria falsa: o monitor do hacker A volta a mostrar a verdade.
   - Atraso, perda e link derrubado não têm camada: o failsafe real limita o risco ao parar o carrinho, mas não recupera a comunicação.

## 4. Encerramento (≈ 2 min)

- Operador: **Pausar** (todos param) e depois **Encerrar**.
- `/admin` → **Métricas**: comandos recebidos, aplicados, invertidos, bloqueados, watchdog e latência de confirmação (envio → ack; não é o tempo até a roda girar). Exportar CSV/JSON se for usar no relatório.
- Mensagens finais:
  - senha padrão é risco real e trocá-la tem efeito real;
  - integridade e proteção contra repetição precisam de mecanismos criptográficos de verdade (HMAC, contadores), aqui só ilustrados;
  - a parada segura no próprio carrinho funciona independentemente do software de ataque.

## Variante com 2 carrinhos (`dual`)

- `/admin` → Topologia **2 carrinhos** antes de **Pronto**. Quatro vagas: piloto e hacker por carrinho, todos com o carrinho da própria equipe no login.
- Cada hacker ataca o carrinho adversário e defende o próprio; o roteiro acima vale trocando os papéis (por exemplo, hacker A ataca o Carrinho B e o hacker B defende).
- Cada ESP32 precisa do próprio `deviceId` (`car-a`/`car-b`) e segredo.

## Plano B

| Problema | Ação |
|---|---|
| ESP32 instável | `/admin` → pausar → mudar o carrinho para **Simulado** → retomar; o projetor mostra a arena |
| Celular sem conexão | entrar de outro aparelho; o operador libera a vaga antiga |
| Qualquer comportamento inesperado do carrinho | **STOP ALL** e, se preciso, corte físico de energia |
