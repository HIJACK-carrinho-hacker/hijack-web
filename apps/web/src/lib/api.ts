import type { ErrorCode, LoginRequest, Me, PublicInfo } from "@hijack/protocol";

export type ApiResult<T> = { ok: true; data: T } | { ok: false; code: ErrorCode | "network" };

async function call<T>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const res = await fetch(path, {
      credentials: "same-origin",
      ...init,
      headers: { "content-type": "application/json", ...(init.headers ?? {}) },
    });
    const body = (await res.json().catch(() => ({}))) as { code?: ErrorCode };
    if (!res.ok) return { ok: false, code: body.code ?? "internal" };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, code: "network" };
  }
}

export const api = {
  publicInfo: () => call<PublicInfo>("/api/public"),
  me: () => call<{ me: Me }>("/api/session"),
  login: (req: LoginRequest) => call<{ me: Me }>("/api/session", { method: "POST", body: JSON.stringify(req) }),
  adminLogin: (secret: string) => call<{ me: Me }>("/api/admin/session", { method: "POST", body: JSON.stringify({ secret }) }),
  logout: () => call<{ ok: true }>("/api/session", { method: "DELETE" }),
};

export const LOGIN_ERROR_MESSAGE: Partial<Record<ErrorCode | "network", string>> = {
  invalid_credentials: "Não foi possível entrar. Confira o carrinho e a senha.",
  slot_taken: "Essa vaga já está ocupada. Peça ao operador para liberá-la.",
  rate_limited: "Muitas tentativas. Aguarde alguns segundos e tente de novo.",
  invalid_payload: "Confira os campos preenchidos.",
  forbidden: "Opção indisponível na demonstração atual. Atualize a página e escolha de novo.",
  network: "Sem conexão com o servidor.",
};
