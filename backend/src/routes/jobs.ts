import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { JobService } from "../services/job-service";
import { SettlementService } from "../services/settlement-service";

export async function jobRoutes(app: FastifyInstance) {
  const jobs = new JobService();
  const settlements = new SettlementService();

  app.get("/jobs", async () => jobs.listJobs());
  app.get("/jobs/:id", async (request) => jobs.getJob((request.params as { id: string }).id));
  app.post("/jobs/:id/settlements", async (request, reply) => {
    const id = z.object({ id: z.string() }).parse(request.params).id;
    const settlement = await settlements.queueRelease(id);
    return reply.code(202).send(settlement);
  });
}

