import type { FastifyInstance } from "fastify";
import { eventBus } from "../events/bus";

export async function registerRealtime(app: FastifyInstance) {
  app.get("/events", async (request, reply) => {
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const send = (event: unknown) => reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    eventBus.on("event", send);
    request.raw.on("close", () => eventBus.off("event", send));
    send({ type: "connected", payload: { at: new Date().toISOString() } });
  });
}

