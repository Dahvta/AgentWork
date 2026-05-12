import Fastify from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import { env } from "./config/env";
import { jobRoutes } from "./routes/jobs";
import { agentRoutes } from "./routes/agents";
import { platformRoutes } from "./routes/platform";
import { storageRoutes } from "./routes/storage";
import { validationRoutes } from "./routes/validations";
import { registerRealtime } from "./ws/realtime";
import { ContractIndexer } from "./indexer/contract-indexer";

const app = Fastify({
  logger: {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    redact: ["req.headers.authorization", "SETTLEMENT_PRIVATE_KEY"],
  },
});

await app.register(cors, { origin: true });
await app.register(multipart);
await app.register(platformRoutes, { prefix: "/api" });
await app.register(jobRoutes, { prefix: "/api" });
await app.register(agentRoutes, { prefix: "/api" });
await app.register(storageRoutes, { prefix: "/api" });
await app.register(validationRoutes, { prefix: "/api" });
await registerRealtime(app);

if (process.env.DISABLE_INDEXER !== "true") {
  new ContractIndexer().start().catch((error) => app.log.error({ error }, "indexer failed"));
}

await app.listen({ host: "0.0.0.0", port: env.PORT });
