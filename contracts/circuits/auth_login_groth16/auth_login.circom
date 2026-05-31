pragma circom 2.1.0;

include "node_modules/circomlib/circuits/poseidon.circom";
include "node_modules/circomlib/circuits/bitify.circom";

/*
 * AuthLogin circuit for zkCredentials
 * =====================================
 * Proves knowledge of a private key whose derived commitment matches the
 * public commitment, and that the nullifier was computed correctly.
 *
 * Private inputs:
 *   privateKey    - user's secret authentication key
 *   walletAddress - user's blockchain wallet address (constrained to 160 bits)
 *   salt          - random salt chosen at registration
 *
 * Public inputs:
 *   commitment    - Poseidon(Poseidon(privateKey), walletAddress, salt)
 *   nullifierNonce - fresh random nonce chosen per session
 *   nullifier     - Poseidon(privateKey, nullifierNonce)
 */
template AuthLogin() {
    // Private inputs
    signal input privateKey;
    signal input walletAddress;
    signal input salt;

    // Public inputs
    signal input commitment;
    signal input nullifierNonce;
    signal input nullifier;

    // Step 0: Range check — walletAddress must fit in 160 bits (valid Ethereum address)
    component addrBits = Num2Bits(160);
    addrBits.in <== walletAddress;

    // Step 1: publicKey = Poseidon(privateKey)
    component pubKeyHash = Poseidon(1);
    pubKeyHash.inputs[0] <== privateKey;

    // Step 2: commitment = Poseidon(publicKey, walletAddress, salt)
    component commitmentHash = Poseidon(3);
    commitmentHash.inputs[0] <== pubKeyHash.out;
    commitmentHash.inputs[1] <== walletAddress;
    commitmentHash.inputs[2] <== salt;
    commitmentHash.out === commitment;

    // Step 3: nullifier = Poseidon(privateKey, nullifierNonce)
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== privateKey;
    nullifierHash.inputs[1] <== nullifierNonce;
    nullifierHash.out === nullifier;
}

component main { public [commitment, nullifierNonce, nullifier] } = AuthLogin();
