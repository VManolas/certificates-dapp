// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockAuthVerifier
 * @notice Mock ZK verifier for testing ZKAuthRegistry
 * SECURITY WARNING: This mock ALWAYS returns true - DO NOT use in production!
 */
contract MockAuthVerifier {
    bool public alwaysPass = true;

    function verify(
        bytes calldata /* proof */,
        bytes32[] calldata /* publicInputs */
    ) external view returns (bool) {
        return alwaysPass;
    }

    function setAlwaysPass(bool shouldPass) external {
        alwaysPass = shouldPass;
    }
}
