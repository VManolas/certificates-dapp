// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title MockAuthVerifier
 * @notice Mock ZK verifier for testing ZKAuthRegistry
 * @dev In production, this will be replaced with the actual Noir-generated verifier
 * 
 * SECURITY WARNING: This mock ALWAYS returns true - DO NOT use in production!
 */
contract MockAuthVerifier {
    // For testing: track verification calls
    uint256 public verificationCount;
    mapping(bytes32 => uint256) public verificationsByInput;
    
    // For testing: allow setting verification result
    bool public alwaysPass = true;
    
    event ProofVerified(bytes32 indexed publicInputsHash, bool result);
    
    /**
     * @notice Verify a ZK proof (MOCK VERSION)
     * @return True if proof is valid (always true in mock unless configured otherwise)
     */
    function verify(
        bytes calldata /* proof */,
        bytes32 /* publicInputsHash */
    ) external view returns (bool) {
        return alwaysPass;
    }
    
    /**
     * @notice Configure mock to fail verifications (for testing)
     * @param shouldPass Whether verifications should pass
     */
    function setAlwaysPass(bool shouldPass) external {
        alwaysPass = shouldPass;
    }
    
    /**
     * @notice Reset verification counter
     */
    function resetCounter() external {
        verificationCount = 0;
    }
}

