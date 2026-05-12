import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { jobLifecycleAbi } from "../events/contracts";

export class SettlementService {
  private provider = new JsonRpcProvider(env.ARC_RPC_HTTP_URL);

  async queueRelease(jobId: string) {
    const job = await prisma.job.findUniqueOrThrow({ where: { id: jobId } });
    return prisma.settlement.upsert({
      where: { idempotencyKey: `${env.JOB_LIFECYCLE_ADDRESS}:${job.contractJobId}:release` },
      update: {},
      create: { jobId, idempotencyKey: `${env.JOB_LIFECYCLE_ADDRESS}:${job.contractJobId}:release` },
    });
  }

  async processPending(limit = 10) {
    if (!env.SETTLEMENT_PRIVATE_KEY) return { processed: 0, skipped: "SETTLEMENT_PRIVATE_KEY missing" };
    const wallet = new Wallet(env.SETTLEMENT_PRIVATE_KEY, this.provider);
    const contract = new Contract(env.JOB_LIFECYCLE_ADDRESS, jobLifecycleAbi, wallet);
    const pending = await prisma.settlement.findMany({ where: { state: "PENDING" }, take: limit, include: { job: true } });
    let processed = 0;
    for (const settlement of pending) {
      await prisma.settlement.update({ where: { id: settlement.id }, data: { attempts: { increment: 1 }, state: "SUBMITTED" } });
      try {
        const tx = await contract.releasePayment(settlement.job.contractJobId);
        await prisma.settlement.update({ where: { id: settlement.id }, data: { txHash: tx.hash } });
        processed += 1;
      } catch (error) {
        await prisma.settlement.update({ where: { id: settlement.id }, data: { state: "FAILED", lastError: error instanceof Error ? error.message : String(error) } });
      }
    }
    return { processed };
  }
}

