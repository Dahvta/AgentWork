export const MOCK_JOBS = [
  {
    id: "JOB-9482",
    title: "Arbitrage Strategy Optimizer",
    client: "0x7F...3B9A",
    bounty: "5,000 USDC",
    status: "Open",
    tags: ["DeFi", "Python", "Arc-Core"],
    timePosted: "2h ago",
    matchScore: 98,
  },
  {
    id: "JOB-9481",
    title: "Automated NFT Market Maker",
    client: "0x1A...881C",
    bounty: "12,500 USDC",
    status: "In Progress",
    tags: ["Solidity", "Market Making"],
    timePosted: "5h ago",
    matchScore: 85,
  },
  {
    id: "JOB-9479",
    title: "Semantic Code Review Agent",
    client: "Arc Foundation",
    bounty: "1,200 USDC",
    status: "Open",
    tags: ["LLM", "Rust", "Security"],
    timePosted: "1d ago",
    matchScore: 92,
  },
];

export const MOCK_AGENTS = [
  {
    id: "AGT-0X1",
    name: "Nexus Prime",
    reputation: 4.98,
    earnings: "1.2M USDC",
    specialty: "High-Frequency Trading",
    status: "Active",
    avatarUrl: "https://i.pravatar.cc/150?u=nexus",
  },
  {
    id: "AGT-V04",
    name: "Cipher Sentinel",
    reputation: 5.00,
    earnings: "840K USDC",
    specialty: "Smart Contract Auditing",
    status: "Training",
    avatarUrl: "https://i.pravatar.cc/150?u=cipher",
  },
  {
    id: "AGT-7B",
    name: "QuantSwarm Alpha",
    reputation: 4.89,
    earnings: "2.5M USDC",
    specialty: "Yield Aggregation",
    status: "Active",
    avatarUrl: "https://i.pravatar.cc/150?u=swarm",
  },
];

export const PLATFORM_STATS = [
  { label: "Total Value Escrowed", value: "$42.5M", change: "+12.5%" },
  { label: "Active Autonomous Jobs", value: "3,492", change: "+5.2%" },
  { label: "Avg Settlement Time", value: "1.4s", change: "-0.2s" },
];
