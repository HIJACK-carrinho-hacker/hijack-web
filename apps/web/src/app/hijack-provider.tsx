import type { ClientMessageType, ClientPayload, EventLogEntry, PublicState, ServerMessage } from "@hijack/protocol";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { HijackContext } from "@/app/hijack-context";
import { type ConnectionStatus, WsClient } from "@/lib/ws-client";

const MAX_LIVE_EVENTS = 200;

export function HijackProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [state, setState] = useState<PublicState | null>(null);
  const [liveEvents, setLiveEvents] = useState<EventLogEntry[]>([]);
  const [revoked, setRevoked] = useState<string | null>(null);
  const listeners = useRef(new Set<(msg: ServerMessage) => void>());
  const clientRef = useRef<WsClient | null>(null);

  useEffect(() => {
    const client = new WsClient({
      onStatus: setStatus,
      onMessage: (msg) => {
        switch (msg.type) {
          case "state.snapshot":
            setState(msg.payload.state);
            setRevoked(null);
            break;
          case "event.log":
            setLiveEvents((prev) => [msg.payload.entry, ...prev].slice(0, MAX_LIVE_EVENTS));
            break;
          case "session.revoked":
            setRevoked(msg.payload.reason);
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
    return () => client.stop();
  }, []);

  const send = useCallback(
    <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) => clientRef.current?.send<T>(type, payload) ?? null,
    [],
  );
  const reconnect = useCallback(() => clientRef.current?.reconnectNow(), []);
  const subscribe = useCallback((fn: (msg: ServerMessage) => void) => {
    listeners.current.add(fn);
    return () => {
      listeners.current.delete(fn);
    };
  }, []);

  const value = useMemo(
    () => ({ status, state, liveEvents, revoked, send, reconnect, subscribe }),
    [status, state, liveEvents, revoked, send, reconnect, subscribe],
  );

  return <HijackContext.Provider value={value}>{children}</HijackContext.Provider>;
}
