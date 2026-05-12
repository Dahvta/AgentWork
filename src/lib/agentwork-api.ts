import { MOCK_AGENTS, MOCK_JOBS, PLATFORM_STATS } from "../data";
import { Interface, JsonRpcProvider } from "ethers";

const API_BASE = import.meta.env.VITE_AGENTWORK_API_URL ?? "/api";
const ARC_RPC_HTTP_URL = import.meta.env.VITE_ARC_RPC_HTTP_URL ?? "https://rpc.testnet.arc.network";
const AGENT_REGISTRY_ADDRESS =
  import.meta.env.VITE_AGENT_REGISTRY_ADDRESS ?? "0x90e6Bc80A9b643093b68c5331CcFAE84FA6a6A2E";
const JOB_LIFECYCLE_ADDRESS =
  import.meta.env.VITE_JOB_LIFECYCLE_ADDRESS ?? "0x6D71303B1ea2849dC715EAF0D66795edE1d8b10a";
const ARC_INDEX_FROM_BLOCK = Number(import.meta.env.VITE_ARC_INDEX_FROM_BLOCK ?? 41848803);
const ARC_LOG_CHUNK_SIZE = Number(import.meta.env.VITE_ARC_LOG_CHUNK_SIZE ?? 50_000);

const jobLifecycleAbi = [
  "event JobCreated(uint256 indexed jobId,address indexed employer,uint256 rewardAmount,uint64 deadline,string metadataURI)",
  "event EscrowFunded(uint256 indexed jobId,address indexed payer,uint256 amount,uint256 escrowBalance)",
  "event JobAssigned(uint256 indexed jobId,address indexed agent,address indexed validator)",
  "event DeliverableSubmitted(uint256 indexed jobId,address indexed agent,bytes32 deliverableHash)",
  "event ValidationStarted(uint256 indexed jobId,address indexed validator)",
  "event JobValidated(uint256 indexed jobId,address indexed validator,bool passed,bytes32 evidenceHash)",
  "event PaymentReleased(uint256 indexed jobId,address indexed agent,uint256 agentAmount,address indexed validator,uint256 validatorAmount,uint256 fee)",
  "event JobDisputed(uint256 indexed jobId,address indexed actor,string reason)",
  "event JobCancelled(uint256 indexed jobId,address indexed employer,uint256 refund)",
] as const;

const agentRegistryAbi = [
  "event AgentRegistered(address indexed wallet,string metadataURI,bytes32 capabilitiesRoot,bytes32 credentialsRoot)",
  "event AgentMetadataUpdated(address indexed wallet,string metadataURI,bytes32 capabilitiesRoot,bytes32 credentialsRoot)",
  "event ValidatorDesignationUpdated(address indexed wallet,bool isValidator)",
  "event ReputationUpdated(address indexed wallet,uint256 scoreBps,uint64 completedJobs,uint64 failedJobs,uint64 validations,uint64 validationFailures,uint256 totalEarned,uint256 totalPaid)",
] as const;

const jobIface = new Interface(jobLifecycleAbi);
const agentIface = new Interface(agentRegistryAbi);

export type UiJob = (typeof MOCK_JOBS)[number];
export type UiAgent = (typeof MOCK_AGENTS)[number];
export type UiStat = (typeof PLATFORM_STATS)[number];

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

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`);
  if (!response.ok) throw new Error(`${path} failed with ${response.status}`);
  return response.json() as Promise<T>;
}

export async function loadMarketplace() {
  try {
    const [jobs, agents, stats] = await Promise.all([
      getJson<ApiJob[]>("/jobs"),
      getJson<ApiAgent[]>("/agents"),
      getJson<{ totalValueEscrowed: string; activeAutonomousJobs: number; confirmedSettlements: number }>("/platform/stats"),
    ]);
    return {
      jobs: jobs.map(toUiJob),
      agents: agents.map(toUiAgent),
      stats: [
        { label: "Total Value Escrowed", value: formatUsdc(stats.totalValueEscrowed), change: "onchain" },
        { label: "Active Autonomous Jobs", value: String(stats.activeAutonomousJobs), change: "live" },
        { label: "Confirmed Settlements", value: String(stats.confirmedSettlements), change: "finalized" },
      ] satisfies UiStat[],
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
  const timer = window.setInterval(() => onEvent({ type: "poll" }), 15_000);
  return () => window.clearInterval(timer);
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
      { label: "Total Value Escrowed", value: formatUsdc(totalValueEscrowed), change: "onchain" },
      { label: "Active Autonomous Jobs", value: String(activeAutonomousJobs), change: "live" },
      { label: "Confirmed Settlements", value: String(confirmedSettlements), change: "finalized" },
    ] satisfies UiStat[],
    live: true,
  };
}

async function readJobsFromChain(): Promise<ApiJob[]> {
  const provider = new JsonRpcProvider(ARC_RPC_HTTP_URL);
  const latest = await provider.getBlockNumber();
  const logs = await getAddressLogs(provider, JOB_LIFECYCLE_ADDRESS, ARC_INDEX_FROM_BLOCK, latest);
  const blockTimes = new Map<number, string>();
  const jobs = new Map<string, ApiJob & { escrowBalance: string }>();

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
  const blockTimes = new Map<number, string>();
  const agents = new Map<string, ApiAgent & { updatedAt: string }>();

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
  for (let cursor = start; cursor <= end; cursor += ARC_LOG_CHUNK_SIZE + 1) {
    const toBlock = Math.min(end, cursor + ARC_LOG_CHUNK_SIZE);
    logs.push(...(await provider.getLogs({ address, fromBlock: cursor, toBlock })));
  }
  return logs;
}
