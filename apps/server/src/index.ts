import { networkInterfaces } from "node:os";
import { loadConfig } from "./config/env.ts";
import { createHijackServer } from "./server.ts";

const config = loadConfig();
const server = createHijackServer(config);
const port = await server.listen();

const lanAddresses = Object.values(networkInterfaces())
  .flat()
  .filter((n) => n && n.family === "IPv4" && !n.internal)
  .map((n) => n?.address);

console.log(`[hijack] servidor ouvindo em ${config.SERVER_HOST}:${port}`);
for (const ip of lanAddresses) console.log(`[hijack] na LAN: http://${ip}:${port}`);
if (!config.ADMIN_SECRET) console.warn("[hijack] ADMIN_SECRET não definido: /admin ficará indisponível");

const shutdown = async () => {
  console.log("[hijack] encerrando...");
  await server.close();
  process.exit(0);
};
process.on("unhandledRejection", (err) => {
  console.error("[hijack] erro não tratado:", err);
  server.engine.stopAll("fault", false);
});
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
