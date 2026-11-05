import type { ClientMessageType, ClientPayload, ErrorCode, LoginRequest, Me, PublicState, ServerMessage } from "@hijack/protocol";
import { createContext } from "react";
import type { ConnectionStatus } from "@/lib/ws-client";

export type ActionResult = { ok: true } | { ok: false; code: ErrorCode | "network"; message: string };

export type AuthResult = { ok: true; me: Me } | { ok: false; code: ErrorCode | "network" };

export interface HijackContextValue {
  status: ConnectionStatus;
  state: PublicState | null;
  me: Me | null;
  meLoaded: boolean;
  revoked: string | null;
  send: <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) => string | null;
  subscribe: (fn: (msg: ServerMessage) => void) => () => void;
  request: <T extends ClientMessageType>(type: T, payload: ClientPayload<T>) => Promise<ActionResult>;
  login: (req: LoginRequest) => Promise<AuthResult>;
  adminLogin: (secret: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  clearRevoked: () => void;
}

export const HijackContext = createContext<HijackContextValue | null>(null);
