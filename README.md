# HIJACK — aplicação web

Demonstração acadêmica de segurança em sistemas ciberfísicos: dois carrinhos ESP32, pilotos e hackers numa LAN isolada. O firmware fica no repositório irmão `../esp32`.

## Requisitos

- Bun ≥ 1.4

## Uso

```bash
bun install
cp apps/server/.env.example apps/server/.env
bun run dev
```

- Frontend (dev): http://localhost:5173 (também acessível pelo IP da LAN)
- Backend: http://localhost:3000 (`/health`, `/ws`)

| Comando | O que faz |
|---|---|
| `bun run dev` | servidor + Vite em paralelo |
| `bun run test` | testes (`bun test`) |
| `bun run lint` | oxlint |
| `bun run typecheck` | `bun check` em cada pacote |
| `bun run build` | build do frontend |
| `bun run start` | servidor em modo apresentação (serve o build) |
| `bun run fmt` | formatação com `bun fmt` |

## Estrutura

- `apps/web` — React + Vite + Tailwind + shadcn/ui
- `apps/server` — Express + `ws`
- `packages/protocol` — schemas Zod do protocolo
- `docs/` — plano mestre, premissas, progresso, protocolo
