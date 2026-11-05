# Design visual

A paleta foi extraída por amostragem de pixels das telas em `referencias/` (`tela_login.jpg`, `painel_hacker.jpg`, `controle_piloto.jpg`). Ela corresponde às escalas **zinc** e **emerald** do Tailwind v4. **Toda tela nova deve usar esses tokens**, sem cores soltas.

## Tokens (`apps/web/src/index.css`, classe `.dark`)

| Token | Hex | Onde aparece na referência |
|---|---|---|
| `background` | `#09090b` | fundo de todas as telas |
| `card` / `input` (fundo) | `#18181b` | campos do login, barra superior do hacker, cartão não selecionado |
| `border` / `secondary` / `muted` | `#27272a` | bordas, linha das abas, círculo numerado da etapa |
| `subtle` | `#3f3f46` | indicador de segurança desligado |
| `primary` | `#00bc7d` | botão "Conectar e entrar", indicador de segurança ligado, aba ativa |
| `primary-strong` | `#00d492` | logotipo HIJACK |
| `primary-foreground` | `#09090b` | texto escuro sobre o botão verde |
| `selected` | `#002c22` | fundo do cartão de papel selecionado (Piloto) |
| `selected-border` | `#00bc7d` a 40% | borda do cartão selecionado |
| `foreground` | `#fafafa` | títulos e rótulos |
| `muted-foreground` | `#9f9fa9` | subtítulos, "Partida: …", textos auxiliares |
| `warning` | `#fac800` | "Modo simulado: a senha é 1234" |
| `destructive` | `#fb2c36` | STOP, erros, sem conexão |

## Padrões observados

- Logotipo "HIJACK" em fonte monoespaçada, negrito, espaçado, verde.
- Status com fonte monoespaçada pequena e um ponto colorido ("● Conectado").
- Botão primário verde em largura total com texto escuro; botão desabilitado = verde com opacidade reduzida (o "Escanear rede" bloqueado mede `#06513a`, ou seja, `primary` a ~40%).
- Cartões de seleção lado a lado: título em branco, descrição em `muted-foreground`.
- Abas sublinhadas: ativa em verde com traço inferior, inativa em `muted-foreground`.
- Etapas do ataque em cartão com borda, número dentro de círculo `#27272a`.
- Indicador de segurança: três pílulas pequenas (verde = ligada, `subtle` = desligada).
- Piloto: fundo `#09090b`, joystick com anéis concêntricos discretos, botões A/B circulares escuros, legendas monoespaçadas em caixa alta (`ANALÓGICO L`, `BOTÕES DE AÇÃO`) e teclas entre colchetes (`[J]`, `[K]`).
- Fontes: Geist (texto) e Geist Mono (logotipo, status, legendas).
