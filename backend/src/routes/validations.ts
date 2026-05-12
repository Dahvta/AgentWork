import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../db/prisma";
import { ValidationService } from "../services/validation-service";

const ValidationRequest = z.object({
  validatorWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  rubric: z.record(z.unknown()).optional(),
});

export async function validationRoutes(app: FastifyInstance) {
  const validations = new ValidationService();

  app.post("/jobs/:id/validations/audit", async (request, reply) => {
    const { id } = z.object({ id: z.string() }).parse(request.params);
    const body = ValidationRequest.parse(request.body);
    const job = await prisma.job.findUniqueOrThrow({ where: { id } });
    if (!job.deliverableHash) return reply.code(409).send({ error: "job has no deliverable hash" });
    const audit = await validations.prepareAudit({
      jobId: id,
      metadataUri: job.metadataUri,
      deliverableHash: job.deliverableHash,
      validatorWallet: body.validatorWallet.toLowerCase(),
      rubric: body.rubric,
    });
    return reply.code(201).send(audit);
  });
}

