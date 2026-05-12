import { WebSocketProvider, JsonRpcProvider, Interface, Log } from "ethers";
import { prisma } from "../db/prisma";
import { env } from "../config/env";
import { agentRegistryAbi, jobLifecycleAbi } from "../events/contracts";
import { eventBus } from "../events/bus";

const jobIface = new Interface(jobLifecycleAbi);
const agentIface = new Interface(agentRegistryAbi);

export class ContractIndexer {
  private http = new JsonRpcProvider(env.ARC_RPC_HTTP_URL);
  private ws = new WebSocketProvider(env.ARC_RPC_WS_URL);

  async start() {
    await this.backfillRecent(2_000);
    this.ws.on({ address: env.JOB_LIFECYCLE_ADDRESS }, async (log) => this.handleJobEvent(log));
    this.ws.on({ address: env.AGENT_REGISTRY_ADDRESS }, async (log) => this.handleAgentEvent(log));
  }

  private async backfillRecent(window: number) {
    const latest = await this.http.getBlockNumber();
    const fromBlock = Math.max(0, latest - window);
    const logs = await this.http.getLogs({
      address: [env.JOB_LIFECYCLE_ADDRESS, env.AGENT_REGISTRY_ADDRESS],
      fromBlock,
      toBlock: latest,
    });
    for (const log of logs) {
      if (log.address.toLowerCase() === env.JOB_LIFECYCLE_ADDRESS.toLowerCase()) await this.handleJobEvent(log);
      if (log.address.toLowerCase() === env.AGENT_REGISTRY_ADDRESS.toLowerCase()) await this.handleAgentEvent(log);
    }
  }

  private async handleJobEvent(log: Log) {
    const parsed = jobIface.parseLog(log);
    if (!parsed) return;
    const key = { txHash_logIndex: { txHash: log.transactionHash, logIndex: log.index } };
    const jobId = parsed.args.jobId?.toString();
    await prisma.$transaction(async (tx) => {
      const existing = await tx.workflowEvent.findUnique({ where: key });
      if (existing) return;
      await tx.workflowEvent.create({
        data: {
          jobId: jobId && parsed.name !== "JobCreated" ? `job-${jobId}` : undefined,
          type: parsed.name,
          payload: JSON.parse(JSON.stringify(parsed.args, (_, value) => (typeof value === "bigint" ? value.toString() : value))),
          txHash: log.transactionHash,
          logIndex: log.index,
          blockNumber: BigInt(log.blockNumber),
        },
      });
      if (parsed.name === "JobCreated") {
        await tx.employer.upsert({
          where: { wallet: parsed.args.employer.toLowerCase() },
          update: {},
          create: { wallet: parsed.args.employer.toLowerCase() },
        });
        await tx.job.upsert({
          where: { contractJobId: BigInt(jobId) },
          update: {},
          create: {
            id: `job-${jobId}`,
            contractJobId: BigInt(jobId),
            employerWallet: parsed.args.employer.toLowerCase(),
            rewardAmount: parsed.args.rewardAmount.toString(),
            deadline: new Date(Number(parsed.args.deadline) * 1000),
            metadataUri: parsed.args.metadataURI,
            blockNumber: BigInt(log.blockNumber),
            txHash: log.transactionHash,
          },
        });
      }
      if (parsed.name === "EscrowFunded") {
        await tx.job.update({ where: { id: `job-${jobId}` }, data: { state: "FUNDED", escrowBalance: parsed.args.escrowBalance.toString() } });
        await tx.escrowTransaction.create({
          data: { jobId: `job-${jobId}`, type: "FUND", amount: parsed.args.amount.toString(), actor: parsed.args.payer.toLowerCase(), txHash: log.transactionHash, blockNumber: BigInt(log.blockNumber) },
        });
      }
      if (parsed.name === "JobAssigned") {
        await tx.job.update({ where: { id: `job-${jobId}` }, data: { state: "ASSIGNED", agentWallet: parsed.args.agent.toLowerCase(), validatorWallet: parsed.args.validator.toLowerCase() } });
      }
      if (parsed.name === "DeliverableSubmitted") {
        await tx.job.update({ where: { id: `job-${jobId}` }, data: { state: "SUBMITTED", deliverableHash: parsed.args.deliverableHash } });
      }
      if (parsed.name === "ValidationStarted") {
        await tx.job.update({ where: { id: `job-${jobId}` }, data: { state: "VALIDATING" } });
      }
      if (parsed.name === "JobValidated") {
        await tx.job.update({ where: { id: `job-${jobId}` }, data: { validationResult: parsed.args.passed } });
        await tx.validation.create({ data: { jobId: `job-${jobId}`, validatorWallet: parsed.args.validator.toLowerCase(), passed: parsed.args.passed, confidenceBps: parsed.args.passed ? 9200 : 4000, evidenceHash: parsed.args.evidenceHash } });
      }
      if (parsed.name === "PaymentReleased") {
        await tx.job.update({ where: { id: `job-${jobId}` }, data: { state: "COMPLETED", escrowBalance: "0" } });
        await tx.settlement.upsert({
          where: { idempotencyKey: `${env.JOB_LIFECYCLE_ADDRESS}:${jobId}:release` },
          update: { state: "CONFIRMED", txHash: log.transactionHash },
          create: { jobId: `job-${jobId}`, idempotencyKey: `${env.JOB_LIFECYCLE_ADDRESS}:${jobId}:release`, state: "CONFIRMED", agentAmount: parsed.args.agentAmount.toString(), validatorAmount: parsed.args.validatorAmount.toString(), protocolFee: parsed.args.fee.toString(), txHash: log.transactionHash },
        });
      }
    });
    eventBus.publish({ type: parsed.name, payload: { jobId }, jobId: `job-${jobId}`, txHash: log.transactionHash, blockNumber: String(log.blockNumber) });
  }

  private async handleAgentEvent(log: Log) {
    const parsed = agentIface.parseLog(log);
    if (!parsed) return;
    const wallet = parsed.args.wallet.toLowerCase();
    const existing = await prisma.workflowEvent.findUnique({ where: { txHash_logIndex: { txHash: log.transactionHash, logIndex: log.index } } });
    if (existing) return;
    await prisma.workflowEvent.create({
      data: {
        type: parsed.name,
        payload: JSON.parse(JSON.stringify(parsed.args, (_, value) => (typeof value === "bigint" ? value.toString() : value))),
        txHash: log.transactionHash,
        logIndex: log.index,
        blockNumber: BigInt(log.blockNumber),
      },
    });
    if (parsed.name === "AgentRegistered" || parsed.name === "AgentMetadataUpdated") {
      await prisma.agent.upsert({
        where: { wallet },
        update: { metadataUri: parsed.args.metadataURI, capabilitiesRoot: parsed.args.capabilitiesRoot, credentialsRoot: parsed.args.credentialsRoot },
        create: { wallet, metadataUri: parsed.args.metadataURI, capabilitiesRoot: parsed.args.capabilitiesRoot, credentialsRoot: parsed.args.credentialsRoot },
      });
    }
    if (parsed.name === "ValidatorDesignationUpdated") {
      await prisma.agent.update({ where: { wallet }, data: { isValidator: parsed.args.isValidator } });
    }
    if (parsed.name === "ReputationUpdated") {
      await prisma.agent.update({
        where: { wallet },
        data: {
          reputationScoreBps: Number(parsed.args.scoreBps),
          completedJobs: Number(parsed.args.completedJobs),
          failedJobs: Number(parsed.args.failedJobs),
          validations: Number(parsed.args.validations),
          validationFailures: Number(parsed.args.validationFailures),
          totalEarned: parsed.args.totalEarned.toString(),
          totalPaid: parsed.args.totalPaid.toString(),
        },
      });
      await prisma.reputationHistory.create({ data: { agentWallet: wallet, scoreBps: Number(parsed.args.scoreBps), reason: "onchain_update", txHash: log.transactionHash, blockNumber: BigInt(log.blockNumber) } });
    }
    eventBus.publish({ type: parsed.name, payload: { wallet }, txHash: log.transactionHash, blockNumber: String(log.blockNumber) });
  }
}
