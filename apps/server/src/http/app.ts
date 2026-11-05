import { existsSync } from "node:fs";
import path from "node:path";
import express, { type Express } from "express";

export interface HttpDeps {
  health: () => Record<string, unknown>;
  api?: express.Router;
  staticDir?: string;
}

export function createHttpApp(deps: HttpDeps): Express {
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "2kb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, ...deps.health() });
  });

  if (deps.api) app.use("/api", deps.api);

  if (deps.staticDir && existsSync(deps.staticDir)) {
    const dir = path.resolve(deps.staticDir);
    app.use(express.static(dir, { index: false }));
    app.get(/^\/(?!api|ws|device|health).*/, (_req, res) => {
      res.sendFile(path.join(dir, "index.html"));
    });
  }

  app.use(
    (err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const status = (err as { status?: number }).status ?? 500;
      res.status(status >= 400 && status < 500 ? status : 500).json({
        ok: false,
        code: status === 413 ? "message_too_large" : status < 500 ? "bad_request" : "internal",
      });
    },
  );

  return app;
}
