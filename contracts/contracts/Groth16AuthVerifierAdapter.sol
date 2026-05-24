// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IGroth16Verifier {
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[3] calldata _pubSignals
    ) external view returns (bool);
}

/**
 * @title Groth16AuthVerifierAdapter
 * @notice Adapts the snarkjs-generated Groth16Verifier to the IAuthVerifier interface
 *         expected by ZKAuthRegistry.
 *
 * Proof encoding (bytes parameter):
 *   abi.encode(uint[2] pA, uint[2][2] pB, uint[2] pC) = 256 bytes
 *
 * Public inputs order (matches circuit):
 *   publicInputs[0] = commitment
 *   publicInputs[1] = nullifierNonce
 *   publicInputs[2] = nullifier
 */
contract Groth16AuthVerifierAdapter {

    IGroth16Verifier public immutable verifier;

    string public constant CIRCUIT_NAME = "auth_login_groth16";
    string public constant VERSION = "2.0.0";

    event VerificationAttempted(
        bool indexed success,
        bytes32 indexed publicInputHash,
        uint256 proofLength
    );

    event VerificationFailed(
        string reason,
        bytes32 indexed publicInputHash
    );

    error InvalidVerifierAddress();
    error InvalidProofLength();
    error InvalidPublicInputsLength();

    constructor(address _verifier) {
        if (_verifier == address(0)) revert InvalidVerifierAddress();
        verifier = IGroth16Verifier(_verifier);
    }

    /**
     * @notice Verify a Groth16 ZK proof (IAuthVerifier interface)
     * @param proof  abi.encode(uint[2] pA, uint[2][2] pB, uint[2] pC) — 256 bytes
     * @param publicInputs [commitment, nullifierNonce, nullifier] as bytes32
     */
    function verify(
        bytes calldata proof,
        bytes32[] calldata publicInputs
    ) external returns (bool valid) {
        if (proof.length != 256) revert InvalidProofLength();
        if (publicInputs.length != 3) revert InvalidPublicInputsLength();

        bytes32 publicInputHash = keccak256(abi.encodePacked(publicInputs));

        (uint[2] memory pA, uint[2][2] memory pB, uint[2] memory pC) =
            abi.decode(proof, (uint[2], uint[2][2], uint[2]));

        uint[3] memory pubSignals = [
            uint256(publicInputs[0]),
            uint256(publicInputs[1]),
            uint256(publicInputs[2])
        ];

        try verifier.verifyProof(pA, pB, pC, pubSignals) returns (bool result) {
            valid = result;
            emit VerificationAttempted(valid, publicInputHash, proof.length);
            if (!valid) {
                emit VerificationFailed("Proof verification returned false", publicInputHash);
            }
            return valid;
        } catch Error(string memory reason) {
            emit VerificationFailed(reason, publicInputHash);
            emit VerificationAttempted(false, publicInputHash, proof.length);
            return false;
        } catch {
            emit VerificationFailed("Verifier reverted", publicInputHash);
            emit VerificationAttempted(false, publicInputHash, proof.length);
            return false;
        }
    }

    function isProductionReady() external pure returns (bool) { return true; }
    function getCircuitName() external pure returns (string memory) { return CIRCUIT_NAME; }
    function getVersion() external pure returns (string memory) { return VERSION; }
    function getVerifierAddress() external view returns (address) { return address(verifier); }
    function getProofFormat() external pure returns (string memory) {
        return "Groth16 proof: abi.encode(uint[2] pA, uint[2][2] pB, uint[2] pC)";
    }
}
