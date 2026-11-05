# Roteiro da apresentação

Duração livre, sem pontuação nem vencedor. Duas equipes (A e B), cada uma com piloto (celular) e hacker (notebook). Um operador conduz pelo `/admin` e o `/simulator` fica no projetor.

## Preparação (antes do público)

1. `bun run demo` no notebook servidor; anotar o endereço da LAN (aparece no terminal e no `/admin`).
2. `/admin`: entrar com o segredo do operador.
   - Modo de cada carrinho: **Hardware** se o ESP32 estiver pronto e testado; senão **Simulado**.
   - **Resetar demonstração** marcando ataques, defesas e **senhas** (volta ao `1234`).
3. Projetor em `/simulator`.
4. Pilotos entram em `/` pelo QR code do `/admin`: nome, **Piloto**, carrinho da equipe, senha `1234`.
5. Hackers entram em `/` nos notebooks: nome, **Hacker**, carrinho da equipe, senha `1234`.
6. Conferir no `/admin` as quatro vagas ocupadas e os carrinhos online.

## 1. Largada (≈ 2 min)

- Operador: **Pronto** → **Iniciar**. Pilotos veem "Em demonstração".
- Pilotos dirigem livremente. No projetor, **Solicitado** e **Confirmado** são iguais.
- Mostrar a segurança física: piloto solta o joystick → carrinho para. Operador aperta **STOP ALL** → tudo para.

## 2. Ataque guiado (≈ 4 min)

Hacker A ataca o carrinho B (e/ou o hacker B ataca o A), explicando cada etapa:

1. **Escanear rede** — lista só os carrinhos cadastrados no servidor; nenhuma varredura real.
2. **Identificar o adversário** — só o carrinho da outra equipe pode ser escolhido.
3. **Explorar vulnerabilidade** — relatório simulado: senha padrão `1234` e comandos sem verificação de integridade.
4. **Modificar comandos** — ligar **Frente ↔ Ré**. O piloto B tenta ir para frente e o carrinho vai de ré.
   - Projetor: **Solicitado: frente**, **Confirmado: ré**, faixa "COMANDO ALTERADO NO CAMINHO".
   - Depois ligar também **Esquerda ↔ Direita** e mostrar a curva invertida.

Ponto didático: a inversão nunca move um carrinho parado e nunca impede o STOP.

## 3. Defesa (≈ 4 min)

Hacker B na aba **Defesa**:

1. **Autenticação (real):** trocar `1234` por uma senha forte.
   - O piloto B é desconectado e precisa entrar com a nova senha; `1234` deixa de funcionar.
   - **Mostrar que a inversão continua acontecendo**: senha forte impede acesso indevido, mas não protege contra alterações feitas por um componente já autorizado (o servidor, nesta simulação).
2. **Integridade (simulada, não HMAC):** ligar.
   - O piloto B volta a ir para frente; o projetor mostra Solicitado = Confirmado.
   - O hacker A vê "Alteração bloqueada pela integridade (simulada)".
3. **Repetição (simulada, não validação no firmware):** ligar e gerar um exemplo.
   - O registro mostra um comando antigo reapresentado e recusado, sem mover o carrinho.
4. Indicador de segurança chega a 3/3 — lembrar que conta **camadas demonstradas**, não segurança real.

## 4. Encerramento (≈ 2 min)

- Operador: **Pausar** (todos param) e depois **Encerrar**.
- `/admin` → **Métricas**: comandos recebidos, aplicados, invertidos, bloqueados, watchdog e latência de confirmação (envio → ack; não é o tempo até a roda girar). Exportar CSV/JSON se for usar no relatório.
- Mensagens finais:
  - senha padrão é risco real e trocá-la tem efeito real;
  - integridade e proteção contra repetição precisam de mecanismos criptográficos de verdade (HMAC, contadores), aqui só ilustrados;
  - a parada segura no próprio carrinho funciona independentemente do software de ataque.

## Plano B

| Problema | Ação |
|---|---|
| ESP32 instável | `/admin` → pausar → mudar o carrinho para **Simulado** → retomar; o projetor mostra a arena |
| Celular sem conexão | entrar de outro aparelho; o operador libera a vaga antiga |
| Qualquer comportamento inesperado do carrinho | **STOP ALL** e, se preciso, corte físico de energia |
