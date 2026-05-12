// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity >=0.6.0 <0.9.0;

contract DSTest {
  event log(string);
  event logs(bytes);
  event log_address(address);
  event log_bytes32(bytes32);
  event log_int(int256);
  event log_uint(uint256);
  event log_bytes(bytes);
  event log_string(string);
  event log_named_address(string key, address val);
  event log_named_bytes32(string key, bytes32 val);
  event log_named_decimal_int(string key, int256 val, uint256 decimals);
  event log_named_decimal_uint(string key, uint256 val, uint256 decimals);
  event log_named_int(string key, int256 val);
  event log_named_uint(string key, uint256 val);
  event log_named_bytes(string key, bytes val);
  event log_named_string(string key, string val);

  bool public IS_TEST = true;
  bool private _failed;
  address private constant HEVM_ADDRESS = address(bytes20(uint160(uint256(keccak256("hevm cheat code")))));

  modifier mayRevert() {
    _;
  }

  modifier testopts(string memory) {
    _;
  }

  function failed() public returns (bool) {
    return _failed;
  }

  function fail() internal virtual {
    if (hasHEVMContext()) {
      (bool status,) = HEVM_ADDRESS.call(
        abi.encodePacked(
          bytes4(keccak256("store(address,bytes32,bytes32)")),
          abi.encode(HEVM_ADDRESS, bytes32("failed"), bytes32(uint256(1)))
        )
      );
      status;
    }
    _failed = true;
  }

  function hasHEVMContext() internal view returns (bool) {
    uint256 size;
    assembly {
      size := extcodesize(0x7109709ECfa91a80626fF3989D68f67F5b1DD12D)
    }
    return size > 0;
  }

  function assertTrue(bool condition) internal {
    if (!condition) {
      emit log("Error: Assertion Failed");
      fail();
    }
  }

  function assertTrue(bool condition, string memory err) internal {
    if (!condition) {
      emit log_named_string("Error", err);
      assertTrue(condition);
    }
  }

  function assertEq(address a, address b) internal {
    if (a != b) {
      emit log("Error: a == b not satisfied [address]");
      emit log_named_address(" Left", a);
      emit log_named_address(" Right", b);
      fail();
    }
  }

  function assertEq(address a, address b, string memory err) internal {
    if (a != b) {
      emit log_named_string("Error", err);
      assertEq(a, b);
    }
  }

  function assertEq(bytes32 a, bytes32 b) internal {
    if (a != b) {
      emit log("Error: a == b not satisfied [bytes32]");
      emit log_named_bytes32(" Left", a);
      emit log_named_bytes32(" Right", b);
      fail();
    }
  }

  function assertEq(bytes32 a, bytes32 b, string memory err) internal {
    if (a != b) {
      emit log_named_string("Error", err);
      assertEq(a, b);
    }
  }

  function assertEq(int256 a, int256 b) internal {
    if (a != b) {
      emit log("Error: a == b not satisfied [int]");
      emit log_named_int(" Left", a);
      emit log_named_int(" Right", b);
      fail();
    }
  }

  function assertEq(int256 a, int256 b, string memory err) internal {
    if (a != b) {
      emit log_named_string("Error", err);
      assertEq(a, b);
    }
  }

  function assertEq(uint256 a, uint256 b) internal {
    if (a != b) {
      emit log("Error: a == b not satisfied [uint]");
      emit log_named_uint(" Left", a);
      emit log_named_uint(" Right", b);
      fail();
    }
  }

  function assertEq(uint256 a, uint256 b, string memory err) internal {
    if (a != b) {
      emit log_named_string("Error", err);
      assertEq(a, b);
    }
  }

  function checkEq0(bytes memory a, bytes memory b) internal pure returns (bool ok) {
    if (a.length != b.length) return false;
    for (uint256 i = 0; i < a.length; i++) {
      if (a[i] != b[i]) return false;
    }
    return true;
  }

  function assertEq0(bytes memory a, bytes memory b) internal {
    if (!checkEq0(a, b)) {
      emit log("Error: a == b not satisfied [bytes]");
      emit log_named_bytes(" Left", a);
      emit log_named_bytes(" Right", b);
      fail();
    }
  }

  function assertEq0(bytes memory a, bytes memory b, string memory err) internal {
    if (!checkEq0(a, b)) {
      emit log_named_string("Error", err);
      assertEq0(a, b);
    }
  }
}

