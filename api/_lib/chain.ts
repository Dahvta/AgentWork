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

export type ChainActivity = {
  id: string;
  type: string;
  jobId?: string;
  description: string;
  txHash: string;
  blockNumber: number;
  timestamp: string;
};

const rpcUrl = process.env.ARC_RPC_HTTP_URL ?? "https://rpc.testnet.arc.network";
const jobAddress = process.env.JOB_LIFECYCLE_ADDRESS ?? "0x6D71303B1ea2849dC715EAF0D66795edE1d8b10a";
const registryAddress = process.env.AGENT_REGISTRY_ADDRESS ?? "0x90e6Bc80A9b643093b68c5331CcFAE84FA6a6A2E";
const deploymentBlock = 41848803;
const fromBlock = Math.max(Number(process.env.ARC_INDEX_FROM_BLOCK ?? deploymentBlock), deploymentBlock);
const logChunkSize = Math.min(Number(process.env.ARC_LOG_CHUNK_SIZE ?? 9_999), 9_999);
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
  const jobs = new Map<string, ChainJob>();

  for (const log of logs) {
    const parsed = safeParseLog(jobIface, log);
    if (!parsed) continue;
    const jobId = parsed.args.jobId.toString();
    const updatedAt = blockUpdatedAt(log.blockNumber);
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
  const agents = new Map<string, ChainAgent>();

  for (const log of logs) {
    const parsed = safeParseLog(agentIface, log);
    if (!parsed) continue;
    const wallet = parsed.args.wallet.toLowerCase();
    const updatedAt = blockUpdatedAt(log.blockNumber);
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

export async function readActivity(): Promise<ChainActivity[]> {
  if (!isConfigured()) return [];
  const provider = new JsonRpcProvider(rpcUrl);
  const latest = await provider.getBlockNumber();
  const logs = await getAddressLogs(provider, jobAddress!, fromBlock, latest);
  return logs
    .map((log) => {
      const parsed = safeParseLog(jobIface, log);
      if (!parsed) return null;
      const jobId = parsed.args.jobId?.toString();
      return {
        id: `${log.transactionHash}-${log.index}`,
        type: parsed.name,
        jobId: jobId ? `JOB-${jobId}` : undefined,
        description: describeJobEvent(parsed.name, jobId, parsed.args),
        txHash: log.transactionHash,
        blockNumber: log.blockNumber,
        timestamp: blockUpdatedAt(log.blockNumber),
      } satisfies ChainActivity;
    })
    .filter(Boolean)
    .reverse()
    .slice(0, 40) as ChainActivity[];
}

function blockUpdatedAt(blockNumber: number) {
  return new Date(Date.now() - Math.max(0, 41848803 - blockNumber) * 1000).toISOString();
}

async function getAddressLogs(provider: JsonRpcProvider, address: string, start: number, end: number) {
  const logs = [];
  for (let cursor = start; cursor <= end; cursor += logChunkSize + 1) {
    const toBlock = Math.min(end, cursor + logChunkSize);
    logs.push(...(await provider.getLogs({ address, fromBlock: cursor, toBlock })));
  }
  return logs;
}

function safeParseLog(iface: Interface, log: Parameters<Interface["parseLog"]>[0]) {
  try {
    return iface.parseLog(log);
  } catch {
    return null;
  }
}

function describeJobEvent(type: string, jobId: string | undefined, args: Record<string, any>) {
  const label = jobId ? `JOB-${jobId}` : "A job";
  if (type === "JobCreated") return `${label} created by ${shortAddress(args.employer)}`;
  if (type === "EscrowFunded") return `${label} funded with ${formatUsdc(args.amount.toString())}`;
  if (type === "JobAssigned") return `${label} assigned to ${shortAddress(args.agent)}`;
  if (type === "DeliverableSubmitted") return `${label} received a deliverable hash`;
  if (type === "ValidationStarted") return `${label} entered validator review`;
  if (type === "JobValidated") return `${label} validation ${args.passed ? "passed" : "failed"}`;
  if (type === "PaymentReleased") return `${label} settled ${formatUsdc(args.agentAmount.toString())} to the agent`;
  if (type === "JobDisputed") return `${label} was disputed`;
  if (type === "JobCancelled") return `${label} was cancelled`;
  return `${label} emitted ${type}`;
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatUsdc(raw: string) {
  const value = Number(raw) / 1_000_000;
  if (!Number.isFinite(value)) return "0 USDC";
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
}
