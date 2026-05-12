import type { FastifyInstance } from "fastify";
import { prisma } from "../db/prisma";
import { StorageService } from "../services/storage-service";

export async function storageRoutes(app: FastifyInstance) {
  const storage = new StorageService();

  app.post("/jobs/:id/deliverables", async (request, reply) => {
    const params = request.params as { id: string };
    const file = await request.file();
    if (!file) return reply.code(400).send({ error: "file is required" });
    const buffer = await file.toBuffer();
    const stored = await storage.pinBuffer(buffer, file.filename, file.mimetype);
    const deliverable = await prisma.deliverable.create({
      data: {
        jobId: params.id,
        submittedBy: String(request.headers["x-agent-wallet"] ?? "unknown").toLowerCase(),
        contentHash: stored.contentHash,
        storageUri: stored.storageUri,
        mimeType: file.mimetype,
        bytes: buffer.length,
      },
    });
    return reply.code(201).send(deliverable);
  });
}
