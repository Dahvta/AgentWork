export const MOCK_JOBS = [
  {
    id: "JOB-9482",
    title: "Circuit Board Layout Verification Agent",
    client: "0x7F...3B9A",
    bounty: "4,800 USDC",
    status: "Open",
    tags: ["EDA", "Simulation", "Validation"],
    timePosted: "2h ago",
    matchScore: 98,
  },
  {
    id: "JOB-9481",
    title: "Autonomous Solidity Guard Runner",
    client: "0x1A...881C",
    bounty: "7,250 USDC",
    status: "In Progress",
    tags: ["Solidity", "Security", "FluxArc"],
    timePosted: "5h ago",
    matchScore: 85,
  },
  {
    id: "JOB-9479",
    title: "Market Graph Forecast Validator",
    client: "Arc Foundation",
    bounty: "2,100 USDC",
    status: "Open",
    tags: ["Prediction", "Reasoning", "Proofs"],
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
    specialty: "Hardware Simulation",
    status: "Active",
    avatarUrl: "https://i.pravatar.cc/150?u=nexus",
  },
  {
    id: "AGT-V04",
    name: "Cipher Sentinel",
    reputation: 5.00,
    earnings: "840K USDC",
    specialty: "Smart Contract Verification",
    status: "Training",
    avatarUrl: "https://i.pravatar.cc/150?u=cipher",
  },
  {
    id: "AGT-7B",
    name: "QuantSwarm Alpha",
    reputation: 4.89,
    earnings: "2.5M USDC",
    specialty: "Market Graph Reasoning",
    status: "Active",
    avatarUrl: "https://i.pravatar.cc/150?u=swarm",
  },
];

export const PLATFORM_STATS = [
  { label: "Total Jobs Created", value: "128", change: "demo" },
  { label: "Total Value Escrowed", value: "42.5M USDC", change: "demo" },
  { label: "USDC Settled", value: "18.2M USDC", change: "demo" },
  { label: "Registered Agents", value: "3,492", change: "demo" },
  { label: "Completed Jobs", value: "2,870", change: "demo" },
  { label: "Avg Reputation", value: "4.91/5", change: "demo" },
];

export const MOCK_ACTIVITY = [
  {
    id: "demo-1",
    type: "PaymentReleased",
    jobId: "JOB-9481",
    description: "JOB-9481 settled 6,706.25 USDC to Cipher Sentinel",
    txHash: "0xba6685154f36a9c78b3a081680496d373037fcecf371bf93c7c58f67683fc55d",
    blockNumber: 41848803,
    timestamp: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
  },
  {
    id: "demo-2",
    type: "JobAssigned",
    jobId: "JOB-9482",
    description: "JOB-9482 assigned to Nexus Prime with validator review",
    txHash: "0x0e196e775bdc2f9035b406f869564f8786eefaaad077ccc75b0014e6cb6f5fea",
    blockNumber: 41848791,
    timestamp: new Date(Date.now() - 1000 * 60 * 22).toISOString(),
  },
  {
    id: "demo-3",
    type: "AgentRegistered",
    description: "QuantSwarm Alpha registered an onchain agent identity",
    txHash: "0xb54de181728b94324918f8628e2d5fa2bc8fd1df0a7e23c1552df25cb26e9392",
    blockNumber: 41848762,
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
];
