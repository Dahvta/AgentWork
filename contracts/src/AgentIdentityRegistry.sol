// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

contract AgentIdentityRegistry is AccessControl, Pausable {
  bytes32 public constant REPUTATION_WRITER_ROLE = keccak256("REPUTATION_WRITER_ROLE");
  bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

  struct Reputation {
    uint256 scoreBps;
    uint64 completedJobs;
    uint64 failedJobs;
    uint64 validations;
    uint64 validationFailures;
    uint256 totalEarned;
    uint256 totalPaid;
    uint64 updatedAt;
  }

  struct AgentProfile {
    address wallet;
    string metadataURI;
    bytes32 capabilitiesRoot;
    bytes32 credentialsRoot;
    bool isValidator;
    bool exists;
    Reputation reputation;
  }

  mapping(address => AgentProfile) private profiles;

  event AgentRegistered(address indexed wallet, string metadataURI, bytes32 capabilitiesRoot, bytes32 credentialsRoot);
  event AgentMetadataUpdated(address indexed wallet, string metadataURI, bytes32 capabilitiesRoot, bytes32 credentialsRoot);
  event ValidatorDesignationUpdated(address indexed wallet, bool isValidator);
  event ReputationUpdated(
    address indexed wallet,
    uint256 scoreBps,
    uint64 completedJobs,
    uint64 failedJobs,
    uint64 validations,
    uint64 validationFailures,
    uint256 totalEarned,
    uint256 totalPaid
  );

  error AgentAlreadyRegistered();
  error AgentNotRegistered();
  error UnauthorizedAgentUpdate();

  constructor(address admin) {
    _grantRole(DEFAULT_ADMIN_ROLE, admin);
    _grantRole(PAUSER_ROLE, admin);
    _grantRole(REPUTATION_WRITER_ROLE, admin);
  }

  function registerAgent(string calldata metadataURI, bytes32 capabilitiesRoot, bytes32 credentialsRoot)
    external
    whenNotPaused
  {
    if (profiles[msg.sender].exists) revert AgentAlreadyRegistered();
    profiles[msg.sender].wallet = msg.sender;
    profiles[msg.sender].metadataURI = metadataURI;
    profiles[msg.sender].capabilitiesRoot = capabilitiesRoot;
    profiles[msg.sender].credentialsRoot = credentialsRoot;
    profiles[msg.sender].exists = true;
    profiles[msg.sender].reputation.scoreBps = 5000;
    profiles[msg.sender].reputation.updatedAt = uint64(block.timestamp);
    emit AgentRegistered(msg.sender, metadataURI, capabilitiesRoot, credentialsRoot);
  }

  function updateMetadata(string calldata metadataURI, bytes32 capabilitiesRoot, bytes32 credentialsRoot)
    external
    whenNotPaused
  {
    AgentProfile storage profile = profiles[msg.sender];
    if (!profile.exists) revert AgentNotRegistered();
    profile.metadataURI = metadataURI;
    profile.capabilitiesRoot = capabilitiesRoot;
    profile.credentialsRoot = credentialsRoot;
    emit AgentMetadataUpdated(msg.sender, metadataURI, capabilitiesRoot, credentialsRoot);
  }

  function setValidator(address wallet, bool isValidator) external onlyRole(DEFAULT_ADMIN_ROLE) {
    if (!profiles[wallet].exists) revert AgentNotRegistered();
    profiles[wallet].isValidator = isValidator;
    emit ValidatorDesignationUpdated(wallet, isValidator);
  }

  function applyJobResult(address agent, address employer, bool success, uint256 agentPayout, uint256 employerSpend)
    external
    onlyRole(REPUTATION_WRITER_ROLE)
  {
    _requireAgent(agent);
    AgentProfile storage agentProfile = profiles[agent];
    Reputation storage ar = agentProfile.reputation;
    if (success) ar.completedJobs += 1;
    else ar.failedJobs += 1;
    ar.totalEarned += agentPayout;
    ar.scoreBps = _weightedScore(ar.completedJobs, ar.failedJobs, ar.validations, ar.validationFailures, ar.scoreBps, success);
    ar.updatedAt = uint64(block.timestamp);
    emit ReputationUpdated(agent, ar.scoreBps, ar.completedJobs, ar.failedJobs, ar.validations, ar.validationFailures, ar.totalEarned, ar.totalPaid);

    if (profiles[employer].exists) {
      Reputation storage er = profiles[employer].reputation;
      er.totalPaid += employerSpend;
      er.scoreBps = _bounded(er.scoreBps + (success ? 25 : 0));
      er.updatedAt = uint64(block.timestamp);
      emit ReputationUpdated(employer, er.scoreBps, er.completedJobs, er.failedJobs, er.validations, er.validationFailures, er.totalEarned, er.totalPaid);
    }
  }

  function applyValidationResult(address validator, bool correct, uint256 reward)
    external
    onlyRole(REPUTATION_WRITER_ROLE)
  {
    _requireAgent(validator);
    Reputation storage r = profiles[validator].reputation;
    r.validations += 1;
    if (!correct) r.validationFailures += 1;
    r.totalEarned += reward;
    r.scoreBps = _weightedScore(r.completedJobs, r.failedJobs, r.validations, r.validationFailures, r.scoreBps, correct);
    r.updatedAt = uint64(block.timestamp);
    emit ReputationUpdated(validator, r.scoreBps, r.completedJobs, r.failedJobs, r.validations, r.validationFailures, r.totalEarned, r.totalPaid);
  }

  function profileOf(address wallet) external view returns (AgentProfile memory) {
    return profiles[wallet];
  }

  function reputationOf(address wallet) external view returns (Reputation memory) {
    return profiles[wallet].reputation;
  }

  function pause() external onlyRole(PAUSER_ROLE) {
    _pause();
  }

  function unpause() external onlyRole(PAUSER_ROLE) {
    _unpause();
  }

  function _requireAgent(address wallet) internal view {
    if (!profiles[wallet].exists) revert AgentNotRegistered();
  }

  function _weightedScore(
    uint64 completed,
    uint64 failed,
    uint64 validations,
    uint64 validationFailures,
    uint256 previous,
    bool success
  ) internal pure returns (uint256) {
    uint256 totalWork = completed + failed;
    uint256 jobScore = totalWork == 0 ? previous : (completed * 10000) / totalWork;
    uint256 validationScore = validations == 0 ? previous : ((validations - validationFailures) * 10000) / validations;
    uint256 momentum = success ? 80 : 160;
    uint256 raw = ((jobScore * 65) + (validationScore * 20) + (previous * 15)) / 100;
    return _bounded(success ? raw + momentum : raw > momentum ? raw - momentum : 0);
  }

  function _bounded(uint256 score) internal pure returns (uint256) {
    if (score > 10000) return 10000;
    return score;
  }
}

