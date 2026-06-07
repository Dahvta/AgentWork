import { MOCK_AGENTS, MOCK_JOBS, PLATFORM_STATS } from "../data";
import { Interface, JsonRpcProvider } from "ethers";
import type { ActivityItem, MarketplaceAgent, MarketplaceJob, PlatformStat } from "./types";
import { AGENT_REGISTRY_ADDRESS, DEPLOYMENT_BLOCK, JOB_LIFECYCLE_ADDRESS, agentRegistryAbi, jobLifecycleAbi } from "./protocol";

const API_BASE = import.meta.env.VITE_AGENTWORK_API_URL ?? "/api";
const ARC_RPC_HTTP_URL = import.meta.env.VITE_ARC_RPC_HTTP_URL ?? "https://rpc.testnet.arc.network";
const ARC_INDEX_FROM_BLOCK = Math.max(Number(import.meta.env.VITE_ARC_INDEX_FROM_BLOCK ?? DEPLOYMENT_BLOCK), DEPLOYMENT_BLOCK);
const ARC_LOG_CHUNK_SIZE = Math.min(Number(import.meta.env.VITE_ARC_LOG_CHUNK_SIZE ?? 9_999), 9_999);
const CACHE_MS = 15_000;

const jobIface = new Interface(jobLifecycleAbi);
const agentIface = new Interface(agentRegistryAbi);
const responseCache = new Map<string, { expiresAt: number; value: unknown }>();

export type UiJob = MarketplaceJob;
export type UiAgent = MarketplaceAgent;
export type UiStat = PlatformStat;

type ApiJob = {
  id: string;
  contractJobId: string;
  employerWallet: string;
  agentWallet?: string | null;
  validatorWallet?: string | null;
  title?: string | null;
  metadataUri: string;
  rewardAmount: string;
  escrowBalance?: string;
  state: string;
  deadline: string;
  updatedAt: string;
};

type ApiAgent = {
  wallet: string;
  metadataUri: string;
  isValidator: boolean;
  reputationScoreBps: number;
  totalEarned: string;
  completedJobs: number;
};

type ApiStats = {
  totalValueEscrowed: string;
  activeAutonomousJobs: number;
  confirmedSettlements: number;
  totalJobsCreated?: number;
  fundedJobs?: number;
  completedJobs?: number;
  disputedJobs?: number;
  totalSettled?: string;
  totalRegisteredAgents?: number;
  averageReputationScoreBps?: number;
};

async function getJson<T>(path: string): Promise<T> {
  const cached = responseCache.get(path);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  const value = await retry(async () => {
    const response = await fetch(`${API_BASE}${path}`);
    if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
    return response.json() as Promise<T>;
  });
  responseCache.set(path, { expiresAt: Date.now() + CACHE_MS, value });
  return value;
}

export async function loadMarketplace() {
  try {
    const [jobs, agents, stats] = await Promise.all([
      getJson<ApiJob[]>("/jobs"),
      getJson<ApiAgent[]>("/agents"),
      getJson<ApiStats>("/platform/stats"),
    ]);
    if (jobs.length === 0 && agents.length === 0 && stats.totalValueEscrowed === "0" && stats.activeAutonomousJobs === 0 && stats.confirmedSettlements === 0) {
      const chainMarketplace = await loadMarketplaceFromChain();
      if (chainMarketplace.jobs.length > 0 || chainMarketplace.agents.length > 0) return chainMarketplace;
    }
    return {
      jobs: jobs.map(toUiJob),
      agents: agents.map(toUiAgent),
      stats: toUiStats(stats),
      live: true,
    };
  } catch {
    try {
      return await loadMarketplaceFromChain();
    } catch {
      return {
        jobs: [],
        agents: [],
        stats: [
          { label: "Total Value Escrowed", value: "0 USDC", change: "offline" },
          { label: "Active Autonomous Jobs", value: "0", change: "offline" },
          { label: "Confirmed Settlements", value: "0", change: "offline" },
        ] satisfies UiStat[],
        live: false,
      };
    }
  }
}

export function subscribeMarketplace(onEvent: (event: unknown) => void) {
  const timer = window.setInterval(() => onEvent({ type: "poll" }), 10_000);
  return () => window.clearInterval(timer);
}

export async function loadActivity(): Promise<ActivityItem[]> {
  try {
    return await getJson<ActivityItem[]>("/activity");
  } catch {
    return readActivityFromChain();
  }
}

function toUiJob(job: ApiJob): UiJob {
  return {
    id: `JOB-${job.contractJobId}`,
    title: job.title ?? titleFromMetadata(job.metadataUri),
    client: shortAddress(job.employerWallet),
    bounty: formatUsdc(job.rewardAmount),
    status: normalizeState(job.state),
    tags: tagsFromMetadata(job.metadataUri, ["ERC-8183", "USDC", job.validatorWallet ? "Validated" : "Open"]),
    timePosted: relativeTime(job.updatedAt),
    matchScore: job.state === "FUNDED" ? 98 : 86,
  };
}

function toUiAgent(agent: ApiAgent): UiAgent {
  return {
    id: shortAddress(agent.wallet),
    name: titleFromMetadata(agent.metadataUri),
    reputation: Number((agent.reputationScoreBps / 2000).toFixed(2)),
    earnings: formatUsdc(agent.totalEarned),
    specialty: specialtyFromMetadata(agent.metadataUri, agent.isValidator ? "Validator Agent" : "Autonomous Execution"),
    status: agent.isValidator ? "Active" : agent.completedJobs > 0 ? "Active" : "Training",
    avatarUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${agent.wallet}`,
  };
}

function titleFromMetadata(uri: string) {
  if (uri.startsWith("agentwork://")) {
    try {
      const parsed = new URL(uri);
      return parsed.searchParams.get("title") ?? parsed.searchParams.get("name") ?? "Onchain Agent";
    } catch {
      return "Onchain Agent";
    }
  }
  const tail = uri.split("/").pop() || "Agent";
  return tail.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function tagsFromMetadata(uri: string, fallback: string[]) {
  if (!uri.startsWith("agentwork://")) return fallback;
  try {
    const parsed = new URL(uri);
    const tags = parsed.searchParams.get("tags");
    return tags ? tags.split(",").map((tag) => tag.trim()).filter(Boolean) : fallback;
  } catch {
    return fallback;
  }
}

function specialtyFromMetadata(uri: string, fallback: string) {
  if (!uri.startsWith("agentwork://")) return fallback;
  try {
    const parsed = new URL(uri);
    return parsed.searchParams.get("specialty") ?? fallback;
  } catch {
    return fallback;
  }
}

function normalizeState(state: string) {
  const label = state.toLowerCase().replace(/^\w/, (char) => char.toUpperCase());
  return label === "Funded" ? "Open" : label;
}

function shortAddress(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

function formatUsdc(raw: string) {
  const value = Number(raw) / 1_000_000;
  if (!Number.isFinite(value)) return "0 USDC";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M USDC`;
  if (value >= 1_000) return `${value.toLocaleString(undefined, { maximumFractionDigits: 0 })} USDC`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
}

function toUiStats(stats: ApiStats): UiStat[] {
  return [
    { label: "Total Jobs Created", value: String(stats.totalJobsCreated ?? 0), change: "events" },
    { label: "Total Value Escrowed", value: formatUsdc(stats.totalValueEscrowed), change: "locked" },
    { label: "USDC Settled", value: formatUsdc(stats.totalSettled ?? "0"), change: "finalized" },
    { label: "Registered Agents", value: String(stats.totalRegisteredAgents ?? 0), change: "identity" },
    { label: "Completed Jobs", value: String(stats.completedJobs ?? stats.confirmedSettlements), change: "settled" },
    { label: "Avg Reputation", value: `${((stats.averageReputationScoreBps ?? 0) / 2000).toFixed(2)}/5`, change: "onchain" },
  ];
}

function relativeTime(date: string) {
  const diffMs = Date.now() - new Date(date).getTime();
  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function loadMarketplaceFromChain() {
  const [jobs, agents] = await Promise.all([readJobsFromChain(), readAgentsFromChain()]);
  const totalValueEscrowed = jobs.reduce((sum, job) => sum + BigInt(job.escrowBalance ?? "0"), 0n).toString();
  const activeAutonomousJobs = jobs.filter((job) => ["FUNDED", "ASSIGNED", "SUBMITTED", "VALIDATING"].includes(job.state)).length;
  const confirmedSettlements = jobs.filter((job) => job.state === "COMPLETED").length;

  return {
    jobs: jobs.map(toUiJob),
    agents: agents.map(toUiAgent),
    stats: [
      { label: "Total Jobs Created", value: String(jobs.length), change: "events" },
      { label: "Total Value Escrowed", value: formatUsdc(totalValueEscrowed), change: "locked" },
      { label: "USDC Settled", value: "0 USDC", change: "finalized" },
      { label: "Registered Agents", value: String(agents.length), change: "identity" },
      { label: "Completed Jobs", value: String(confirmedSettlements), change: "settled" },
      { label: "Active Jobs", value: String(activeAutonomousJobs), change: "live" },
    ] satisfies UiStat[],
    live: true,
  };
}

async function readActivityFromChain(): Promise<ActivityItem[]> {
  const provider = new JsonRpcProvider(ARC_RPC_HTTP_URL);
  const latest = await provider.getBlockNumber();
  const logs = await getAddressLogs(provider, JOB_LIFECYCLE_ADDRESS, ARC_INDEX_FROM_BLOCK, latest);
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
      } satisfies ActivityItem;
    })
    .filter(Boolean)
    .reverse()
    .slice(0, 40) as ActivityItem[];
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

async function readJobsFromChain(): Promise<ApiJob[]> {
  const provider = new JsonRpcProvider(ARC_RPC_HTTP_URL);
  const latest = await provider.getBlockNumber();
  const logs = await getAddressLogs(provider, JOB_LIFECYCLE_ADDRESS, ARC_INDEX_FROM_BLOCK, latest);
  const jobs = new Map<string, ApiJob & { escrowBalance: string }>();

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
    if (parsed.name === "DeliverableSubmitted") existing.state = "SUBMITTED";
    if (parsed.name === "ValidationStarted") existing.state = "VALIDATING";
    if (parsed.name === "JobValidated") existing.state = parsed.args.passed ? "VALIDATING" : "DISPUTED";
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

async function readAgentsFromChain(): Promise<ApiAgent[]> {
  const provider = new JsonRpcProvider(ARC_RPC_HTTP_URL);
  const latest = await provider.getBlockNumber();
  const logs = await getAddressLogs(provider, AGENT_REGISTRY_ADDRESS, ARC_INDEX_FROM_BLOCK, latest);
  const agents = new Map<string, ApiAgent & { updatedAt: string }>();

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
        isValidator: existing?.isValidator ?? false,
        reputationScoreBps: existing?.reputationScoreBps ?? 5000,
        totalEarned: existing?.totalEarned ?? "0",
        completedJobs: existing?.completedJobs ?? 0,
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
      existing.totalEarned = parsed.args.totalEarned.toString();
    }
  }

  return [...agents.values()].sort((a, b) => b.reputationScoreBps - a.reputationScoreBps);
}

function blockUpdatedAt(blockNumber: number) {
  return new Date(Date.now() - Math.max(0, DEPLOYMENT_BLOCK - blockNumber) * 1000).toISOString();
}

async function getAddressLogs(provider: JsonRpcProvider, address: string, start: number, end: number) {
  const logs = [];
  for (let cursor = start; cursor <= end; cursor += ARC_LOG_CHUNK_SIZE + 1) {
    const toBlock = Math.min(end, cursor + ARC_LOG_CHUNK_SIZE);
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

async function retry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => window.setTimeout(resolve, 250 * (index + 1)));
    }
  }
  throw lastError;
}
