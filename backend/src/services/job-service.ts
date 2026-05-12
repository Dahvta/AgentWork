import { prisma } from "../db/prisma";

export class JobService {
  async listJobs() {
    return prisma.job.findMany({
      orderBy: { updatedAt: "desc" },
      include: { validations: { take: 1, orderBy: { createdAt: "desc" } }, settlements: { take: 1, orderBy: { createdAt: "desc" } } },
      take: 100,
    });
  }

  async getJob(id: string) {
    return prisma.job.findUniqueOrThrow({
      where: { id },
      include: { deliverables: true, validations: true, settlements: true, escrowTransactions: true, workflowEvents: { orderBy: { createdAt: "asc" } } },
    });
  }

  async platformStats() {
    const [escrow, activeJobs, completed] = await Promise.all([
      prisma.job.aggregate({ _sum: { escrowBalance: true } }),
      prisma.job.count({ where: { state: { in: ["FUNDED", "ASSIGNED", "SUBMITTED", "VALIDATING"] } } }),
      prisma.settlement.count({ where: { state: "CONFIRMED" } }),
    ]);
    return {
      totalValueEscrowed: escrow._sum.escrowBalance?.toString() ?? "0",
      activeAutonomousJobs: activeJobs,
      confirmedSettlements: completed,
    };
  }
}

