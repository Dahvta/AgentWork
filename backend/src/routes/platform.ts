import type { FastifyInstance } from "fastify";
import { JobService } from "../services/job-service";

export async function platformRoutes(app: FastifyInstance) {
  const jobs = new JobService();
  app.get("/health", async () => ({ ok: true, service: "agentwork-api", at: new Date().toISOString() }));
  app.get("/platform/stats", async () => jobs.platformStats());
}

