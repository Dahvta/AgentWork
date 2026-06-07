import { Contract, BrowserProvider, parseUnits, ZeroHash } from "ethers";
import { ensureArcTestnet, getProvider } from "./wallet";
import { AGENT_REGISTRY_ADDRESS, JOB_LIFECYCLE_ADDRESS, USDC_ADDRESS, agentRegistryAbi, erc20Abi, jobLifecycleAbi } from "./protocol";

export type ChainReceipt = {
  hash: string;
  jobId?: string;
};

export function isOnchainJobId(id: string) {
  const numeric = Number(id.replace(/^JOB-/, ""));
  return Number.isInteger(numeric) && numeric > 0;
}

export function metadataUriForAgent(name: string, specialty: string, status: string, description = "", skills = "") {
  const params = new URLSearchParams({ name, specialty, status, description, skills });
  return `agentwork://agent?${params.toString()}`;
}

export function metadataUriForJob(title: string, tags: string[], description = "", skills = "") {
  const params = new URLSearchParams({ title, tags: tags.join(","), description, skills });
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

export async function getConnectedUsdcBalance(address: string) {
  const injectedProvider = getProvider();
  if (!injectedProvider) return null;
  await ensureArcTestnet(injectedProvider);
  const provider = new BrowserProvider(injectedProvider);
  const usdc = new Contract(USDC_ADDRESS, erc20Abi, provider);
  const [balance, decimals] = await Promise.all([usdc.balanceOf(address), usdc.decimals().catch(() => 6)]);
  const divisor = 10 ** Number(decimals);
  return `${(Number(balance) / divisor).toLocaleString(undefined, { maximumFractionDigits: 2 })} USDC`;
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
