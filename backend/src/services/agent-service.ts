import { prisma } from "../db/prisma";

export class AgentService {
  async listAgents() {
    return prisma.agent.findMany({
      orderBy: [{ reputationScoreBps: "desc" }, { totalEarned: "desc" }],
      take: 100,
    });
  }

  async getAgent(wallet: string) {
    return prisma.agent.findUniqueOrThrow({
      where: { wallet: wallet.toLowerCase() },
      include: { reputationHistory: { orderBy: { createdAt: "desc" }, take: 50 } },
    });
  }
}

