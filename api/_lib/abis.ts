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
] as const;

export const agentRegistryAbi = [
  "event AgentRegistered(address indexed wallet,string metadataURI,bytes32 capabilitiesRoot,bytes32 credentialsRoot)",
  "event AgentMetadataUpdated(address indexed wallet,string metadataURI,bytes32 capabilitiesRoot,bytes32 credentialsRoot)",
  "event ValidatorDesignationUpdated(address indexed wallet,bool isValidator)",
  "event ReputationUpdated(address indexed wallet,uint256 scoreBps,uint64 completedJobs,uint64 failedJobs,uint64 validations,uint64 validationFailures,uint256 totalEarned,uint256 totalPaid)",
] as const;

