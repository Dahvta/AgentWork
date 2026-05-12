import type { FastifyInstance } from "fastify";
import { AgentService } from "../services/agent-service";

export async function agentRoutes(app: FastifyInstance) {
  const agents = new AgentService();
  app.get("/agents", async () => agents.listAgents());
  app.get("/agents/:wallet", async (request) => agents.getAgent((request.params as { wallet: string }).wallet));
}

