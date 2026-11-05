import { adminLoginRequestSchema, loginRequestSchema } from "@hijack/protocol";
import express, { type Request, type Response } from "express";
import { SESSION_COOKIE, type Session, parseCookies } from "../auth/sessions.ts";
import type { Config } from "../config/env.ts";
import type { HijackService } from "../hijack-service.ts";

const tokenOf = (req: Request) => parseCookies(req.headers.cookie)[SESSION_COOKIE] ?? null;
const ipOf = (req: Request) => req.socket.remoteAddress ?? "unknown";

export function createApiRouter(service: HijackService, config: Config): express.Router {
  const router = express.Router();

  const setSessionCookie = (res: Response, session: Session) => {
    res.cookie(SESSION_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "strict",
      path: "/",
      maxAge: config.SESSION_TTL_MS,
    });
  };

  router.use((req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (req.method === "GET") return next();
    const origin = req.headers.origin;
    if (origin) {
      let host: string | null = null;
      try {
        host = new URL(origin).host;
      } catch {
        host = null;
      }
      if (host !== req.headers.host && !config.ALLOWED_ORIGINS.includes(origin)) {
        res.status(403).json({ ok: false, code: "forbidden" });
        return;
      }
    }
    next();
  });

  router.get("/public", (_req, res) => {
    res.json(service.publicInfo());
  });

  router.get("/session", (req, res) => {
    const me = service.me(service.sessions.get(tokenOf(req)));
    if (!me) {
      res.status(401).json({ ok: false, code: "unauthenticated" });
      return;
    }
    res.json({ ok: true, me });
  });

  router.post("/session", async (req, res) => {
    const parsed = loginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, code: "invalid_payload" });
      return;
    }
    const outcome = await service.login(parsed.data, ipOf(req), tokenOf(req));
    if (!outcome.ok) {
      if (outcome.retryAfterMs) res.setHeader("Retry-After", Math.ceil(outcome.retryAfterMs / 1000));
      res.status(outcome.status).json({ ok: false, code: outcome.code });
      return;
    }
    setSessionCookie(res, outcome.session);
    res.json({ ok: true, me: service.me(outcome.session) });
  });

  router.delete("/session", (req, res) => {
    service.logout(tokenOf(req));
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.json({ ok: true });
  });

  router.post("/admin/session", (req, res) => {
    const parsed = adminLoginRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ ok: false, code: "invalid_payload" });
      return;
    }
    const outcome = service.adminLogin(parsed.data.secret, ipOf(req), tokenOf(req));
    if (!outcome.ok) {
      if (outcome.retryAfterMs) res.setHeader("Retry-After", Math.ceil(outcome.retryAfterMs / 1000));
      res.status(outcome.status).json({ ok: false, code: outcome.code });
      return;
    }
    setSessionCookie(res, outcome.session);
    res.json({ ok: true, me: service.me(outcome.session) });
  });

  return router;
}
