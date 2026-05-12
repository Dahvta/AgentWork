import { Contract, BrowserProvider, parseUnits, ZeroHash } from "ethers";
import { ensureArcTestnet, getProvider } from "./wallet";

const AGENT_REGISTRY_ADDRESS =
  import.meta.env.VITE_AGENT_REGISTRY_ADDRESS ?? "0x90e6Bc80A9b643093b68c5331CcFAE84FA6a6A2E";
const JOB_LIFECYCLE_ADDRESS =
  import.meta.env.VITE_JOB_LIFECYCLE_ADDRESS ?? "0x6D71303B1ea2849dC715EAF0D66795edE1d8b10a";
const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000";

const agentRegistryAbi = [
  "function registerAgent(string metadataURI, bytes32 capabilitiesRoot, bytes32 credentialsRoot)",
] as const;

const jobLifecycleAbi = [
  "function createJob(uint256 rewardAmount, uint64 deadline, string metadataURI, uint256 protocolFeeBps, uint256 validatorRewardBps) returns (uint256)",
  "function fundEscrow(uint256 jobId, uint256 amount)",
  "function acceptJob(uint256 jobId, address validator)",
  "event JobCreated(uint256 indexed jobId,address indexed employer,uint256 rewardAmount,uint64 deadline,string metadataURI)",
] as const;

const erc20Abi = [
  "function approve(address spender, uint256 amount) returns (bool)",
] as const;

export type ChainReceipt = {
  hash: string;
  jobId?: string;
};

export function isOnchainJobId(id: string) {
  const numeric = Number(id.replace(/^JOB-/, ""));
  return Number.isInteger(numeric) && numeric > 0;
}

export function metadataUriForAgent(name: string, specialty: string, status: string) {
  const params = new URLSearchParams({ name, specialty, status });
  return `agentwork://agent?${params.toString()}`;
}

export function metadataUriForJob(title: string, tags: string[]) {
  const params = new URLSearchParams({ title, tags: tags.join(",") });
  return `agentwork://job?${params.toString()}`;
}

export async function registerAgentOnchain(metadataURI: string): Promise<ChainReceipt> {
  const { signer } = await getSigner();
  const registry = new Contract(AGENT_REGISTRY_ADDRESS, agentRegistryAbi, signer);
  const tx = await registry.registerAgent(metadataURI, ZeroHash, ZeroHash);
  const receipt = await tx.wait();
  return { hash: receipt.hash };
}

export async function createAndFundJobOnchain(args: {
  rewardAmount: string;
  deadlineDays: number;
  metadataURI: string;
}): Promise<ChainReceipt> {
  const { signer } = await getSigner();
  const amount = parseUsdcAmount(args.rewardAmount);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + args.deadlineDays * 24 * 60 * 60);
  const jobs = new Contract(JOB_LIFECYCLE_ADDRESS, jobLifecycleAbi, signer);
  const usdc = new Contract(USDC_ADDRESS, erc20Abi, signer);

  const createTx = await jobs.createJob(amount, deadline, args.metadataURI, 250, 500);
  const createReceipt = await createTx.wait();
  const jobId = readCreatedJobId(jobs, createReceipt);

  const approveTx = await usdc.approve(JOB_LIFECYCLE_ADDRESS, amount);
  await approveTx.wait();

  const fundTx = await jobs.fundEscrow(jobId, amount);
  const fundReceipt = await fundTx.wait();
  return { hash: fundReceipt.hash, jobId: `JOB-${jobId.toString()}` };
}

export async function acceptJobOnchain(jobId: string, validator: string): Promise<ChainReceipt> {
  const { signer } = await getSigner();
  const jobs = new Contract(JOB_LIFECYCLE_ADDRESS, jobLifecycleAbi, signer);
  const numericJobId = BigInt(jobId.replace(/^JOB-/, ""));
  const tx = await jobs.acceptJob(numericJobId, validator);
  const receipt = await tx.wait();
  return { hash: receipt.hash };
}

async function getSigner() {
  const injectedProvider = getProvider();
  if (!injectedProvider) {
    throw new Error("No EVM wallet found. Connect MetaMask, Rabby, or Coinbase Wallet first.");
  }
  await ensureArcTestnet(injectedProvider);
  const provider = new BrowserProvider(injectedProvider);
  const signer = await provider.getSigner();
  return { provider, signer };
}

function parseUsdcAmount(value: string) {
  const normalized = value.replace(/usdc/gi, "").replace(/,/g, "").trim();
  return parseUnits(normalized, 6);
}

function readCreatedJobId(contract: Contract, receipt: { logs: Array<unknown> }) {
  for (const log of receipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log as Parameters<typeof contract.interface.parseLog>[0]);
      if (parsed?.name === "JobCreated") return parsed.args.jobId as bigint;
    } catch {
      // Ignore logs emitted by other contracts in the same transaction.
    }
  }
  throw new Error("Job was created, but the JobCreated event was not found in the receipt.");
}
