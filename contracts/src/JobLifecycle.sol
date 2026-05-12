// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentIdentityRegistry} from "./AgentIdentityRegistry.sol";

contract JobLifecycle is AccessControl, Pausable, ReentrancyGuard {
  using SafeERC20 for IERC20;

  enum JobState {
    CREATED,
    FUNDED,
    ASSIGNED,
    SUBMITTED,
    VALIDATING,
    COMPLETED,
    DISPUTED,
    CANCELLED
  }

  struct Job {
    address employer;
    address agent;
    address validator;
    uint256 rewardAmount;
    uint256 escrowBalance;
    uint256 protocolFeeBps;
    uint256 validatorRewardBps;
    uint64 deadline;
    string metadataURI;
    bytes32 deliverableHash;
    bool validationResult;
    JobState state;
    uint64 createdAt;
    uint64 updatedAt;
  }

  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");
  bytes32 public constant SETTLEMENT_ROLE = keccak256("SETTLEMENT_ROLE");
  uint256 public constant BPS = 10000;
  IERC20 public immutable usdc;
  AgentIdentityRegistry public immutable registry;
  address public feeRecipient;
  uint256 public nextJobId = 1;
  mapping(uint256 => Job) public jobs;

  event JobCreated(uint256 indexed jobId, address indexed employer, uint256 rewardAmount, uint64 deadline, string metadataURI);
  event EscrowFunded(uint256 indexed jobId, address indexed payer, uint256 amount, uint256 escrowBalance);
  event JobAssigned(uint256 indexed jobId, address indexed agent, address indexed validator);
  event DeliverableSubmitted(uint256 indexed jobId, address indexed agent, bytes32 deliverableHash);
  event ValidationStarted(uint256 indexed jobId, address indexed validator);
  event JobValidated(uint256 indexed jobId, address indexed validator, bool passed, bytes32 evidenceHash);
  event PaymentReleased(uint256 indexed jobId, address indexed agent, uint256 agentAmount, address indexed validator, uint256 validatorAmount, uint256 fee);
  event JobDisputed(uint256 indexed jobId, address indexed actor, string reason);
  event JobCancelled(uint256 indexed jobId, address indexed employer, uint256 refund);

  error InvalidState();
  error Unauthorized();
  error InvalidAmount();
  error InvalidDeadline();
  error ZeroAddress();
  error DeadlineExpired();

  constructor(IERC20 usdc_, AgentIdentityRegistry registry_, address admin, address feeRecipient_) {
    if (address(usdc_) == address(0) || address(registry_) == address(0) || admin == address(0) || feeRecipient_ == address(0)) revert ZeroAddress();
    usdc = usdc_;
    registry = registry_;
    feeRecipient = feeRecipient_;
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(PAUSER_ROLE, admin);
    _grantRole(SETTLEMENT_ROLE, admin);
  }

  function createJob(uint256 rewardAmount, uint64 deadline, string calldata metadataURI, uint256 protocolFeeBps, uint256 validatorRewardBps)
    external
    whenNotPaused
    returns (uint256 jobId)
  {
    if (rewardAmount == 0) revert InvalidAmount();
    if (deadline <= block.timestamp) revert InvalidDeadline();
    if (protocolFeeBps + validatorRewardBps >= BPS) revert InvalidAmount();
    jobId = nextJobId++;
    jobs[jobId] = Job({
      employer: msg.sender,
      agent: address(0),
      validator: address(0),
      rewardAmount: rewardAmount,
      escrowBalance: 0,
      protocolFeeBps: protocolFeeBps,
      validatorRewardBps: validatorRewardBps,
      deadline: deadline,
      metadataURI: metadataURI,
      deliverableHash: bytes32(0),
      validationResult: false,
      state: JobState.CREATED,
      createdAt: uint64(block.timestamp),
      updatedAt: uint64(block.timestamp)
    });
    emit JobCreated(jobId, msg.sender, rewardAmount, deadline, metadataURI);
  }

  function fundEscrow(uint256 jobId, uint256 amount) external nonReentrant whenNotPaused {
    Job storage job = jobs[jobId];
    if (job.state != JobState.CREATED && job.state != JobState.FUNDED) revert InvalidState();
    if (amount == 0) revert InvalidAmount();
    usdc.safeTransferFrom(msg.sender, address(this), amount);
    job.escrowBalance += amount;
    if (job.escrowBalance >= job.rewardAmount) job.state = JobState.FUNDED;
    job.updatedAt = uint64(block.timestamp);
    emit EscrowFunded(jobId, msg.sender, amount, job.escrowBalance);
  }

  function acceptJob(uint256 jobId, address validator) external whenNotPaused {
    Job storage job = jobs[jobId];
    if (job.state != JobState.FUNDED) revert InvalidState();
    if (block.timestamp > job.deadline) revert DeadlineExpired();
    if (validator == address(0) || validator == msg.sender) revert ZeroAddress();
    job.agent = msg.sender;
    job.validator = validator;
    job.state = JobState.ASSIGNED;
    job.updatedAt = uint64(block.timestamp);
    emit JobAssigned(jobId, msg.sender, validator);
  }

  function submitDeliverable(uint256 jobId, bytes32 deliverableHash) external whenNotPaused {
    Job storage job = jobs[jobId];
    if (job.state != JobState.ASSIGNED) revert InvalidState();
    if (msg.sender != job.agent) revert Unauthorized();
    if (deliverableHash == bytes32(0)) revert InvalidAmount();
    job.deliverableHash = deliverableHash;
    job.state = JobState.SUBMITTED;
    job.updatedAt = uint64(block.timestamp);
    emit DeliverableSubmitted(jobId, msg.sender, deliverableHash);
  }

  function startValidation(uint256 jobId) external whenNotPaused {
    Job storage job = jobs[jobId];
    if (job.state != JobState.SUBMITTED) revert InvalidState();
    if (msg.sender != job.validator) revert Unauthorized();
    job.state = JobState.VALIDATING;
    job.updatedAt = uint64(block.timestamp);
    emit ValidationStarted(jobId, msg.sender);
  }

  function validateJob(uint256 jobId, bool passed, bytes32 evidenceHash) external whenNotPaused {
    Job storage job = jobs[jobId];
    if (job.state != JobState.VALIDATING) revert InvalidState();
    if (msg.sender != job.validator) revert Unauthorized();
    job.validationResult = passed;
    job.updatedAt = uint64(block.timestamp);
    emit JobValidated(jobId, msg.sender, passed, evidenceHash);
    if (passed) _releasePayment(jobId, job);
    else job.state = JobState.DISPUTED;
  }

  function releasePayment(uint256 jobId) external onlyRole(SETTLEMENT_ROLE) whenNotPaused {
    Job storage job = jobs[jobId];
    if (job.state != JobState.VALIDATING || !job.validationResult) revert InvalidState();
    _releasePayment(jobId, job);
  }

  function disputeJob(uint256 jobId, string calldata reason) external whenNotPaused {
    Job storage job = jobs[jobId];
    if (msg.sender != job.employer && msg.sender != job.agent && msg.sender != job.validator) revert Unauthorized();
    if (job.state == JobState.COMPLETED || job.state == JobState.CANCELLED) revert InvalidState();
    job.state = JobState.DISPUTED;
    job.updatedAt = uint64(block.timestamp);
    emit JobDisputed(jobId, msg.sender, reason);
  }

  function cancelJob(uint256 jobId) external nonReentrant whenNotPaused {
    Job storage job = jobs[jobId];
    if (msg.sender != job.employer) revert Unauthorized();
    if (job.state != JobState.CREATED && job.state != JobState.FUNDED) revert InvalidState();
    uint256 refund = job.escrowBalance;
    job.escrowBalance = 0;
    job.state = JobState.CANCELLED;
    job.updatedAt = uint64(block.timestamp);
    if (refund > 0) usdc.safeTransfer(job.employer, refund);
    emit JobCancelled(jobId, job.employer, refund);
  }

  function _releasePayment(uint256 jobId, Job storage job) internal nonReentrant {
    if (job.state == JobState.COMPLETED) return;
    uint256 amount = job.escrowBalance;
    if (amount < job.rewardAmount) revert InvalidAmount();
    job.escrowBalance = 0;
    job.state = JobState.COMPLETED;
    job.updatedAt = uint64(block.timestamp);
    uint256 fee = (amount * job.protocolFeeBps) / BPS;
    uint256 validatorAmount = (amount * job.validatorRewardBps) / BPS;
    uint256 agentAmount = amount - fee - validatorAmount;
    if (fee > 0) usdc.safeTransfer(feeRecipient, fee);
    if (validatorAmount > 0) usdc.safeTransfer(job.validator, validatorAmount);
    usdc.safeTransfer(job.agent, agentAmount);
    registry.applyJobResult(job.agent, job.employer, true, agentAmount, amount);
    registry.applyValidationResult(job.validator, true, validatorAmount);
    emit PaymentReleased(jobId, job.agent, agentAmount, job.validator, validatorAmount, fee);
  }

  function setFeeRecipient(address recipient) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (recipient == address(0)) revert ZeroAddress();
    feeRecipient = recipient;
  }

  function pause() external onlyRole(PAUSER_ROLE) {
    _pause();
  }

  function unpause() external onlyRole(PAUSER_ROLE) {
    _unpause();
  }
}

