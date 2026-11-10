# Modelo de segurança

O HIJACK roda em uma **LAN isolada de laboratório**. Este documento separa o que é proteção **real** do que é **demonstração didática**.

## Real

| Proteção | Como funciona |
|---|---|
| Senha do carrinho | Uma por carrinho, com hash **argon2id** (`Bun.password`) em `apps/server/data/state.json` (permissão 600, fora do git). Começa em `1234` de propósito. Trocar a senha tem efeito imediato: a antiga deixa de autenticar. |
| Política de senha forte | Mínimo de 8 caracteres, letras e números, diferente de `1234` e da senha atual, não pode repetir um só caractere. |
| Revogação na troca | Quando o hacker troca a senha do próprio carrinho, a sessão do **piloto** daquele carrinho é revogada (`session.revoked`) e o carrinho para. O hacker que trocou continua logado. |
| Sessão | Token aleatório de 256 bits em cookie `HttpOnly; SameSite=Strict; Path=/`, expira em `SESSION_TTL_MS` (padrão 4 h). Uma sessão por navegador: novo login no mesmo navegador revoga a anterior. |
| Topologia | Em `single` (padrão) só o Carrinho A é ativo: não há vaga de piloto do `car-b` (login → 403); o servidor recusa `attack.*` da equipe A e `defense.*`/`auth.changePassword` da equipe B, mesmo que o navegador envie. Trocar a topologia (`admin.setTopology`, só operador e fora de `running`) para os carros, reseta ataques e revoga pilotos de carrinhos desativados. |
| Vagas exclusivas | Um piloto e um hacker por carrinho. Outro navegador não ocupa a vaga sem o operador liberá-la (`admin.releaseSlot`) ou a sessão expirar ou sair. |
| Autorização por mensagem | Toda mensagem WebSocket consulta a sessão de novo. Time, papel e carro vêm **só** da sessão; payloads com campos extras são rejeitados. |
| Operador | Login separado com `ADMIN_SECRET` (comparação em tempo constante), diferente da senha dos carrinhos. |
| Força bruta | Login: 5 falhas em 60 s por IP **ou** por carrinho → bloqueio de 15 s, dobrando até 5 min. Troca de senha: 3 falhas por sessão. Admin: 5 falhas por IP. Mensagens de erro genéricas. |
| Origem | `Origin` obrigatório e igual ao `Host` (ou em `ALLOWED_ORIGINS`) no WebSocket; `POST`/`DELETE` em `/api` com `Origin` de outro site → 403. |
| Tamanho | Mensagens WS > 2 KiB e corpos HTTP > 2 KiB são recusados. |
| Parada segura | STOP e watchdog nunca são transformados pelo ataque (ver `architecture.md`). |
| Logs | Nenhuma senha, segredo ou token aparece em eventos, métricas, `/health` ou erros. |

## Didático (simulado)

| Item | O que é |
|---|---|
| Ataque em etapas | Simulação no servidor sobre os carrinhos cadastrados; não há scan, sniffing nem exploração de rede. |
| Integridade | Chave que impede a inversão no servidor; **não é HMAC** nem assinatura. |
| Repetição | Gera um evento didático de comando antigo recusado; **não é validação no firmware**. A checagem de `seq` do firmware existe por confiabilidade, não como essa camada. |
| Indicador 0–3 | Conta camadas demonstradas, não mede segurança real. |

## Riscos aceitos e limitações

- **Sem TLS:** tráfego em texto claro; aceitável apenas na LAN isolada. Por isso o cookie não usa `Secure`. Não expor a porta à internet.
- **Rate limit por IP no modo dev:** com o proxy do Vite, todos os clientes aparecem como `127.0.0.1`; um bloqueio afeta todos. No modo apresentação (`bun run start`) o servidor vê o IP real.
- **Sessões em memória:** reiniciar o servidor desconecta todos (os carros iniciam parados). Só as senhas persistem.
- **Senha `1234` visível na tela de entrada** enquanto o carrinho estiver com a senha padrão; a dica some quando a senha é trocada.
