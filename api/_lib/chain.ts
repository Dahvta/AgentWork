import { Interface, JsonRpcProvider } from "ethers";
import { agentRegistryAbi, jobLifecycleAbi } from "./abis";

export type ChainJob = {
  id: string;
  contractJobId: string;
  employerWallet: string;
  agentWallet?: string | null;
  validatorWallet?: string | null;
  title?: string | null;
  metadataUri: string;
  rewardAmount: string;
  escrowBalance: string;
  state: string;
  deadline: string;
  deliverableHash?: string | null;
  validationResult?: boolean | null;
  updatedAt: string;
};

export type ChainAgent = {
  wallet: string;
  metadataUri: string;
  capabilitiesRoot: string;
  credentialsRoot: string;
  isValidator: boolean;
  reputationScoreBps: number;
  completedJobs: number;
  failedJobs: number;
  validations: number;
  validationFailures: number;
  totalEarned: string;
  totalPaid: string;
  updatedAt: string;
};

const rpcUrl = process.env.ARC_RPC_HTTP_URL;
const jobAddress = process.env.JOB_LIFECYCLE_ADDRESS;
const registryAddress = process.env.AGENT_REGISTRY_ADDRESS;
const fromBlock = Number(process.env.ARC_INDEX_FROM_BLOCK ?? 0);
const logChunkSize = Number(process.env.ARC_LOG_CHUNK_SIZE ?? 50_000);
const jobIface = new Interface(jobLifecycleAbi);
const agentIface = new Interface(agentRegistryAbi);

export function isConfigured() {
  return Boolean(rpcUrl && jobAddress && registryAddress && !jobAddress?.match(/^0x0{40}$/) && !registryAddress?.match(/^0x0{40}$/));
}

export async function readJobs(): Promise<ChainJob[]> {
  if (!isConfigured()) return [];
  const provider = new JsonRpcProvider(rpcUrl);
  const latest = await provider.getBlockNumber();
  const logs = await getAddressLogs(provider, jobAddress!, fromBlock, latest);
  const blockTimes = new Map<number, string>();
  const jobs = new Map<string, ChainJob>();

  for (const log of logs) {
    const parsed = jobIface.parseLog(log);
    if (!parsed) continue;
    const jobId = parsed.args.jobId.toString();
    const updatedAt = await blockTime(provider, blockTimes, log.blockNumber);
    const existing = jobs.get(jobId);

    if (parsed.name === "JobCreated") {
      jobs.set(jobId, {
        id: `job-${jobId}`,
        contractJobId: jobId,
        employerWallet: parsed.args.employer.toLowerCase(),
        metadataUri: parsed.args.metadataURI,
        rewardAmount: parsed.args.rewardAmount.toString(),
        escrowBalance: "0",
        state: "CREATED",
        deadline: new Date(Number(parsed.args.deadline) * 1000).toISOString(),
        updatedAt,
      });
      continue;
    }

    if (!existing) continue;
    existing.updatedAt = updatedAt;
    if (parsed.name === "EscrowFunded") {
      existing.escrowBalance = parsed.args.escrowBalance.toString();
      existing.state = "FUNDED";
    }
    if (parsed.name === "JobAssigned") {
      existing.agentWallet = parsed.args.agent.toLowerCase();
      existing.validatorWallet = parsed.args.validator.toLowerCase();
      existing.state = "ASSIGNED";
    }
    if (parsed.name === "DeliverableSubmitted") {
      existing.deliverableHash = parsed.args.deliverableHash;
      existing.state = "SUBMITTED";
    }
    if (parsed.name === "ValidationStarted") existing.state = "VALIDATING";
    if (parsed.name === "JobValidated") {
      existing.validationResult = parsed.args.passed;
      existing.state = parsed.args.passed ? "VALIDATING" : "DISPUTED";
    }
    if (parsed.name === "PaymentReleased") {
      existing.escrowBalance = "0";
      existing.state = "COMPLETED";
    }
    if (parsed.name === "JobDisputed") existing.state = "DISPUTED";
    if (parsed.name === "JobCancelled") {
      existing.escrowBalance = "0";
      existing.state = "CANCELLED";
    }
  }

  return [...jobs.values()].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
}

export async function readAgents(): Promise<ChainAgent[]> {
  if (!isConfigured()) return [];
  const provider = new JsonRpcProvider(rpcUrl);
  const latest = await provider.getBlockNumber();
  const logs = await getAddressLogs(provider, registryAddress!, fromBlock, latest);
  const blockTimes = new Map<number, string>();
  const agents = new Map<string, ChainAgent>();

  for (const log of logs) {
    const parsed = agentIface.parseLog(log);
    if (!parsed) continue;
    const wallet = parsed.args.wallet.toLowerCase();
    const updatedAt = await blockTime(provider, blockTimes, log.blockNumber);
    const existing = agents.get(wallet);

    if (parsed.name === "AgentRegistered" || parsed.name === "AgentMetadataUpdated") {
      agents.set(wallet, {
        wallet,
        metadataUri: parsed.args.metadataURI,
        capabilitiesRoot: parsed.args.capabilitiesRoot,
        credentialsRoot: parsed.args.credentialsRoot,
        isValidator: existing?.isValidator ?? false,
        reputationScoreBps: existing?.reputationScoreBps ?? 5000,
        completedJobs: existing?.completedJobs ?? 0,
        failedJobs: existing?.failedJobs ?? 0,
        validations: existing?.validations ?? 0,
        validationFailures: existing?.validationFailures ?? 0,
        totalEarned: existing?.totalEarned ?? "0",
        totalPaid: existing?.totalPaid ?? "0",
        updatedAt,
      });
      continue;
    }

    if (!existing) continue;
    existing.updatedAt = updatedAt;
    if (parsed.name === "ValidatorDesignationUpdated") existing.isValidator = parsed.args.isValidator;
    if (parsed.name === "ReputationUpdated") {
      existing.reputationScoreBps = Number(parsed.args.scoreBps);
      existing.completedJobs = Number(parsed.args.completedJobs);
      existing.failedJobs = Number(parsed.args.failedJobs);
      existing.validations = Number(parsed.args.validations);
      existing.validationFailures = Number(parsed.args.validationFailures);
      existing.totalEarned = parsed.args.totalEarned.toString();
      existing.totalPaid = parsed.args.totalPaid.toString();
    }
  }

  return [...agents.values()].sort((a, b) => b.reputationScoreBps - a.reputationScoreBps);
}

async function blockTime(provider: JsonRpcProvider, cache: Map<number, string>, blockNumber: number) {
  const cached = cache.get(blockNumber);
  if (cached) return cached;
  const block = await provider.getBlock(blockNumber);
  const value = new Date(Number(block?.timestamp ?? 0) * 1000).toISOString();
  cache.set(blockNumber, value);
  return value;
}

async function getAddressLogs(provider: JsonRpcProvider, address: string, start: number, end: number) {
  const logs = [];
  for (let cursor = start; cursor <= end; cursor += logChunkSize + 1) {
    const toBlock = Math.min(end, cursor + logChunkSize);
    logs.push(...(await provider.getLogs({ address, fromBlock: cursor, toBlock })));
  }
  return logs;
}
