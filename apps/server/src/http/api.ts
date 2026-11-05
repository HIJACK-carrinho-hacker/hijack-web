import { adminLoginRequestSchema, loginRequestSchema } from "@hijack/protocol";
import { networkInterfaces } from "node:os";
import express, { type NextFunction, type Request, type Response } from "express";
import { SESSION_COOKIE, type Session, parseCookies } from "../auth/sessions.ts";
import type { Config } from "../config/env.ts";
import type { HijackService } from "../hijack-service.ts";
import { type Cell, toCsv } from "../telemetry/export.ts";

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

  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    const s = service.sessions.get(tokenOf(req));
    if (s?.kind !== "admin") {
      res.status(s ? 403 : 401).json({ ok: false, code: s ? "forbidden" : "unauthenticated" });
      return;
    }
    next();
  };

  const stamp = () => new Date().toISOString().replace(/[:.]/g, "-");

  const sendExport = (res: Response, name: string, format: string, columns: readonly string[], rows: Record<string, Cell>[]) => {
    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="hijack-${name}-${stamp()}.csv"`);
      res.send(toCsv(columns, rows));
      return;
    }
    res.setHeader("Content-Disposition", `attachment; filename="hijack-${name}-${stamp()}.json"`);
    res.json({ generatedAt: new Date().toISOString(), [name]: rows });
  };

  router.get("/admin/export/:name.:format", requireAdmin, (req, res) => {
    const { name, format } = req.params as { name: string; format: string };
    if (!["csv", "json"].includes(format)) {
      res.status(404).json({ ok: false, code: "bad_request" });
      return;
    }
    if (name === "events") {
      const rows = service.exportEvents().map((e) => ({
        id: e.id,
        at: new Date(e.at).toISOString(),
        kind: e.kind,
        carId: e.carId,
        teamId: e.teamId,
        actorRole: e.actorRole,
        mode: e.mode,
        visibility: e.visibility,
        message: e.message,
      }));
      sendExport(res, "events", format, ["id", "at", "kind", "carId", "teamId", "actorRole", "mode", "visibility", "message"], rows);
      return;
    }
    if (name === "metrics") {
      const rows = service.exportMetrics().map((m) => ({ ...m }));
      sendExport(
        res,
        "metrics",
        format,
        ["carId", "mode", "received", "applied", "transformed", "blocked", "rejected", "disconnects", "watchdogTrips", "ackLatencyMsP50", "ackLatencyMsP95"],
        rows,
      );
      return;
    }
    res.status(404).json({ ok: false, code: "bad_request" });
  });

  router.get("/admin/lan", requireAdmin, (_req, res) => {
    const addresses = Object.values(networkInterfaces())
      .flat()
      .filter((n) => n && n.family === "IPv4" && !n.internal)
      .map((n) => n?.address as string);
    res.json({ addresses, serverPort: config.SERVER_PORT });
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
