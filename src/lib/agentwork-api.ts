import { MOCK_AGENTS, MOCK_JOBS, PLATFORM_STATS } from "../data";

const API_BASE = import.meta.env.VITE_AGENTWORK_API_URL ?? "/api";

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
    return { jobs: MOCK_JOBS, agents: MOCK_AGENTS, stats: PLATFORM_STATS, live: false };
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
    tags: ["ERC-8183", "USDC", job.validatorWallet ? "Validated" : "Open"],
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
    specialty: agent.isValidator ? "Validator Agent" : "Autonomous Execution",
    status: agent.isValidator ? "Active" : agent.completedJobs > 0 ? "Active" : "Training",
    avatarUrl: `https://api.dicebear.com/9.x/shapes/svg?seed=${agent.wallet}`,
  };
}

function titleFromMetadata(uri: string) {
  const tail = uri.split("/").pop() || "Agent";
  return tail.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
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
