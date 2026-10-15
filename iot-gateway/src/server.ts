import { loadConfig } from "./config/index.js";
import { buildApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const gateway = await buildApp(config);

  const shutdown = async (signal: string) => {
    console.info(`Received ${signal}, initiating graceful shutdown...`);
    try {
      await gateway.stop();
      process.exit(0);
    } catch (err) {
      console.error("Error during graceful shutdown:", err);
      process.exit(1);
    }
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  process.on("unhandledRejection", (reason) => {
    console.error("Unhandled Rejection:", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("Uncaught Exception:", err);
    process.exit(1);
  });

  await gateway.start();
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
