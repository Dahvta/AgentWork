// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";
import {JobLifecycle} from "../src/JobLifecycle.sol";

contract MockUSDC is ERC20 {
  constructor() ERC20("USD Coin", "USDC") {}
  function decimals() public pure override returns (uint8) { return 6; }
  function mint(address to, uint256 amount) external { _mint(to, amount); }
}

contract JobLifecycleTest is Test {
  MockUSDC usdc;
  AgentIdentityRegistry registry;
  JobLifecycle lifecycle;
  address employer = address(0xE1);
  address agent = address(0xA1);
  address validator = address(0xB1);
  address feeRecipient = address(0xF1);

  function setUp() public {
    usdc = new MockUSDC();
    registry = new AgentIdentityRegistry(address(this));
    lifecycle = new JobLifecycle(usdc, registry, address(this), feeRecipient);
    registry.grantRole(registry.REPUTATION_WRITER_ROLE(), address(lifecycle));
    vm.prank(agent);
    registry.registerAgent("ipfs://agent", keccak256("cap"), keccak256("cred"));
    vm.prank(validator);
    registry.registerAgent("ipfs://validator", keccak256("val"), keccak256("cred"));
    registry.setValidator(validator, true);
    usdc.mint(employer, 1_000_000e6);
  }

  function testHappyPathSettlesAndUpdatesReputation() public {
    vm.startPrank(employer);
    uint256 jobId = lifecycle.createJob(1_000e6, uint64(block.timestamp + 7 days), "ipfs://job", 250, 500);
    usdc.approve(address(lifecycle), 1_000e6);
    lifecycle.fundEscrow(jobId, 1_000e6);
    vm.stopPrank();

    vm.prank(agent);
    lifecycle.acceptJob(jobId, validator);
    vm.prank(agent);
    lifecycle.submitDeliverable(jobId, keccak256("artifact"));
    vm.prank(validator);
    lifecycle.startValidation(jobId);
    vm.prank(validator);
    lifecycle.validateJob(jobId, true, keccak256("evidence"));

    assertEq(usdc.balanceOf(agent), 925e6);
    assertEq(usdc.balanceOf(validator), 50e6);
    assertEq(usdc.balanceOf(feeRecipient), 25e6);
    (,,,,,,,,,,, JobLifecycle.JobState state,,) = lifecycle.jobs(jobId);
    assertEq(uint8(state), uint8(JobLifecycle.JobState.COMPLETED));
    assertEq(registry.reputationOf(agent).completedJobs, 1);
  }

  function testCannotAcceptUnfundedJob() public {
    vm.prank(employer);
    uint256 jobId = lifecycle.createJob(1_000e6, uint64(block.timestamp + 7 days), "ipfs://job", 250, 500);
    vm.expectRevert(JobLifecycle.InvalidState.selector);
    vm.prank(agent);
    lifecycle.acceptJob(jobId, validator);
  }
}
