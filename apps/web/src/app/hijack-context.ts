import type { ClientMessageType, ClientPayload, EventLogEntry, PublicState, ServerMessage } from "@hijack/protocol";
import { createContext } from "react";
import type { ConnectionStatus } from "@/lib/ws-client";

export interface HijackContextValue {
  status: ConnectionStatus;
  state: PublicState | null;
  liveEvents: EventLogEntry[];
  revoked: string | null;
  send: <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) => string | null;
  reconnect: () => void;
  subscribe: (fn: (msg: ServerMessage) => void) => () => void;
}

export const HijackContext = createContext<HijackContextValue | null>(null);
