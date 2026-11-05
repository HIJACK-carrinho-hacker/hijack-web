import type { ClientMessageType, ClientPayload, LoginRequest, Me, PublicState, ServerMessage } from "@hijack/protocol";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type ActionResult, type AuthResult, HijackContext } from "@/app/hijack-context";
import { api } from "@/lib/api";
import { type ConnectionStatus, WsClient } from "@/lib/ws-client";

export function HijackProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [state, setState] = useState<PublicState | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [revoked, setRevoked] = useState<string | null>(null);
  const listeners = useRef(new Set<(msg: ServerMessage) => void>());
  const clientRef = useRef<WsClient | null>(null);
  const pending = useRef(new Map<string, (r: ActionResult) => void>());

  useEffect(() => {
    const alive = { current: true };
    api.me().then((r) => {
      if (!alive.current) return;
      setMe(r.ok ? r.data.me : null);
      setMeLoaded(true);
    });
    const client = new WsClient({
      onStatus: setStatus,
      onMessage: (msg) => {
        const waiter = msg.requestId ? pending.current.get(msg.requestId) : undefined;
        if (waiter && msg.requestId && (msg.type === "action.ok" || msg.type === "system.error")) {
          pending.current.delete(msg.requestId);
          waiter(msg.type === "action.ok" ? { ok: true } : { ok: false, code: msg.payload.code, message: msg.payload.message });
          for (const fn of listeners.current) fn(msg);
          return;
        }
        switch (msg.type) {
          case "state.snapshot":
            setState(msg.payload.state);
            setMe(msg.payload.state.me);
            setMeLoaded(true);
            break;
          case "session.revoked":
            setRevoked(msg.payload.reason);
            setMe(null);
            break;
          case "system.error":
            if (msg.payload.code !== "unauthenticated") toast.error(msg.payload.message);
            break;
          case "system.stopAll":
            toast.warning(`STOP geral: ${msg.payload.reason}`);
            break;
          default:
            break;
        }
        for (const fn of listeners.current) fn(msg);
      },
    });
    clientRef.current = client;
    client.start();
    return () => {
      alive.current = false;
      client.stop();
    };
  }, []);

  const send = useCallback(
    <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) => clientRef.current?.send<T>(type, payload) ?? null,
    [],
  );

  const request = useCallback(
    <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) =>
      new Promise<ActionResult>((resolve) => {
        const id = clientRef.current?.send<T>(type, payload) ?? null;
        if (!id) {
          resolve({ ok: false, code: "network", message: "Sem conexão com o servidor." });
          return;
        }
        const timer = setTimeout(() => {
          pending.current.delete(id);
          resolve({ ok: false, code: "network", message: "O servidor não respondeu." });
        }, 8000);
        pending.current.set(id, (r) => {
          clearTimeout(timer);
          resolve(r);
        });
      }),
    [],
  );

  const subscribe = useCallback((fn: (msg: ServerMessage) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const afterAuth = useCallback((r: Awaited<ReturnType<typeof api.login>>): AuthResult => {
    if (!r.ok) return r;
    setMe(r.data.me);
    setRevoked(null);
    clientRef.current?.reconnectNow();
    return { ok: true, me: r.data.me };
  }, []);

  const login = useCallback(async (req: LoginRequest) => afterAuth(await api.login(req)), [afterAuth]);
  const adminLogin = useCallback(async (secret: string) => afterAuth(await api.adminLogin(secret)), [afterAuth]);

  const logout = useCallback(async () => {
    await api.logout();
    setMe(null);
    clientRef.current?.reconnectNow();
  }, []);

  const clearRevoked = useCallback(() => setRevoked(null), []);

  const value = useMemo(
    () => ({ status, state, me, meLoaded, revoked, send, request, subscribe, login, adminLogin, logout, clearRevoked }),
    [status, state, me, meLoaded, revoked, send, request, subscribe, login, adminLogin, logout, clearRevoked],
  );

  return <HijackContext.Provider value={value}>{children}</HijackContext.Provider>;
}
