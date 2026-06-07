export const ARC_TESTNET_CHAIN_ID = "0x4cef52";
export const ARC_TESTNET_EXPLORER = "https://testnet.arcscan.app";
export const ARC_TESTNET_RPC = "https://rpc.testnet.arc.network";
export const ARC_TESTNET_WS = "wss://rpc.testnet.arc.network";
export const DEPLOYMENT_BLOCK = 41848803;

export const AGENT_REGISTRY_ADDRESS =
  import.meta.env.VITE_AGENT_REGISTRY_ADDRESS ?? "0x90e6Bc80A9b643093b68c5331CcFAE84FA6a6A2E";

export const JOB_LIFECYCLE_ADDRESS =
  import.meta.env.VITE_JOB_LIFECYCLE_ADDRESS ?? "0x6D71303B1ea2849dC715EAF0D66795edE1d8b10a";

export const USDC_ADDRESS = import.meta.env.VITE_USDC_ADDRESS ?? "0x3600000000000000000000000000000000000000";

export const jobLifecycleAbi = [
  "event JobCreated(uint256 indexed jobId,address indexed employer,uint256 rewardAmount,uint64 deadline,string metadataURI)",
  "event EscrowFunded(uint256 indexed jobId,address indexed payer,uint256 amount,uint256 escrowBalance)",
  "event JobAssigned(uint256 indexed jobId,address indexed agent,address indexed validator)",
  "event DeliverableSubmitted(uint256 indexed jobId,address indexed agent,bytes32 deliverableHash)",
  "event ValidationStarted(uint256 indexed jobId,address indexed validator)",
  "event JobValidated(uint256 indexed jobId,address indexed validator,bool passed,bytes32 evidenceHash)",
  "event PaymentReleased(uint256 indexed jobId,address indexed agent,uint256 agentAmount,address indexed validator,uint256 validatorAmount,uint256 fee)",
  "event JobDisputed(uint256 indexed jobId,address indexed actor,string reason)",
  "event JobCancelled(uint256 indexed jobId,address indexed employer,uint256 refund)",
  "function createJob(uint256 rewardAmount,uint64 deadline,string metadataURI,uint256 protocolFeeBps,uint256 validatorRewardBps) returns (uint256)",
  "function fundEscrow(uint256 jobId,uint256 amount)",
  "function acceptJob(uint256 jobId,address validator)",
] as const;

export const agentRegistryAbi = [
  "event AgentRegistered(address indexed wallet,string metadataURI,bytes32 capabilitiesRoot,bytes32 credentialsRoot)",
  "event AgentMetadataUpdated(address indexed wallet,string metadataURI,bytes32 capabilitiesRoot,bytes32 credentialsRoot)",
  "event ValidatorDesignationUpdated(address indexed wallet,bool isValidator)",
  "event ReputationUpdated(address indexed wallet,uint256 scoreBps,uint64 completedJobs,uint64 failedJobs,uint64 validations,uint64 validationFailures,uint256 totalEarned,uint256 totalPaid)",
  "function registerAgent(string metadataURI,bytes32 capabilitiesRoot,bytes32 credentialsRoot)",
] as const;

export const erc20Abi = [
  "function approve(address spender,uint256 amount) returns (bool)",
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
] as const;

export function explorerTxUrl(hash: string) {
  return `${ARC_TESTNET_EXPLORER}/tx/${hash}`;
}

