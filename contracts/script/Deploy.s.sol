// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {AgentIdentityRegistry} from "../src/AgentIdentityRegistry.sol";
import {JobLifecycle} from "../src/JobLifecycle.sol";

interface VmEnv {
  function envAddress(string calldata name) external returns (address);
}

contract Deploy is Script {
  function run() external returns (AgentIdentityRegistry registry, JobLifecycle lifecycle) {
    VmEnv vmEnv = VmEnv(address(vm));
    address admin = vmEnv.envAddress("DEPLOYER");
    address usdc = vmEnv.envAddress("USDC_ADDRESS");
    address feeRecipient = vmEnv.envAddress("FEE_RECIPIENT");
    vm.startBroadcast();
    registry = new AgentIdentityRegistry(admin);
    lifecycle = new JobLifecycle(IERC20(usdc), registry, admin, feeRecipient);
    registry.grantRole(registry.REPUTATION_WRITER_ROLE(), address(lifecycle));
    vm.stopBroadcast();
  }
}
