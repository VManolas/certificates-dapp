// contracts/circuits/auth_login/src/main.nr
//
// Authentication Circuit for zkCredentials
// =========================================
//
// This circuit proves that a user knows the private key corresponding
// to a public commitment WITHOUT revealing the private key or wallet address.
//
// Use Case: Privacy-preserving login for all user types
// (admin, university, student, employer)
//
// Inputs:
//   - privateKey (private): User's secret authentication key
//   - walletAddress (private): User's blockchain wallet address
//   - salt (private): Random salt for commitment uniqueness
//   - commitment (public): Public commitment to verify against
//
// Output:
//   - Proof that the user knows the private key and wallet for the commitment
//
// Security:
//   - Private inputs are never revealed
//   - Only the validity of the commitment is proven
//   - Poseidon hash used for ZK-friendly hashing (BN254 curve compatible)

use dep::poseidon::poseidon::bn254::hash_1 as poseidon_hash_1;
use dep::poseidon::poseidon::bn254::hash_2 as poseidon_hash_2;
use dep::poseidon::poseidon::bn254::hash_3 as poseidon_hash_3;

fn main(
    // Private inputs (kept secret by prover)
    private_key: Field,
    wallet_address: Field,
    salt: Field,

    // Public inputs (visible to verifier, ordered: commitment, nullifier_nonce, nullifier)
    commitment: pub Field,
    nullifier_nonce: pub Field,
    nullifier: pub Field,
) {
    // Step 1: Derive public key from private key using Poseidon hash
    let public_key = poseidon_hash_1([private_key]);

    // Step 2: Verify commitment = hash(publicKey, walletAddress, salt)
    let computed_commitment = poseidon_hash_3([public_key, wallet_address, salt]);
    assert(computed_commitment == commitment);

    // Step 3: Verify nullifier = hash(privateKey, nullifierNonce)
    // The nonce is chosen fresh per session so successive sessions produce
    // different nullifiers; the private key binding prevents forgery.
    let computed_nullifier = poseidon_hash_2([private_key, nullifier_nonce]);
    assert(computed_nullifier == nullifier);
}

#[test]
fn test_auth_login_valid() {
    let private_key: Field = 12345678901234567890;
    let wallet_address: Field = 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1;
    let salt: Field = 98765432109876543210;
    let nullifier_nonce: Field = 11111111111111111111;

    let public_key = poseidon_hash_1([private_key]);
    let expected_commitment = poseidon_hash_3([public_key, wallet_address, salt]);
    let expected_nullifier = poseidon_hash_2([private_key, nullifier_nonce]);

    main(private_key, wallet_address, salt, expected_commitment, nullifier_nonce, expected_nullifier);
}

#[test]
fn test_auth_login_different_commitments() {
    let private_key1: Field = 12345678901234567890;
    let private_key2: Field = 98765432109876543210;
    let wallet_address: Field = 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1;
    let salt: Field = 11111111111111111111;
    let nullifier_nonce: Field = 22222222222222222222;

    let public_key1 = poseidon_hash_1([private_key1]);
    let commitment1: Field = poseidon_hash_3([public_key1, wallet_address, salt]);
    let nullifier1: Field = poseidon_hash_2([private_key1, nullifier_nonce]);

    let public_key2 = poseidon_hash_1([private_key2]);
    let commitment2: Field = poseidon_hash_3([public_key2, wallet_address, salt]);
    let nullifier2: Field = poseidon_hash_2([private_key2, nullifier_nonce]);

    assert(commitment1 != commitment2);
    assert(nullifier1 != nullifier2);
}

#[test]
fn test_nullifier_uniqueness_per_nonce() {
    let private_key: Field = 12345678901234567890;
    let wallet_address: Field = 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1;
    let salt: Field = 98765432109876543210;
    let nonce1: Field = 11111111111111111111;
    let nonce2: Field = 99999999999999999999;

    let public_key = poseidon_hash_1([private_key]);
    let commitment = poseidon_hash_3([public_key, wallet_address, salt]);
    let nullifier1 = poseidon_hash_2([private_key, nonce1]);
    let nullifier2 = poseidon_hash_2([private_key, nonce2]);

    // Same commitment, different nonces -> different nullifiers
    assert(nullifier1 != nullifier2);

    // Both proofs are valid for the same commitment
    main(private_key, wallet_address, salt, commitment, nonce1, nullifier1);
    main(private_key, wallet_address, salt, commitment, nonce2, nullifier2);
}

#[test]
fn test_poseidon_compatibility() {
    let private_key: Field = 12345678901234567890;
    let wallet_address: Field = 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1;
    let salt: Field = 98765432109876543210;

    let public_key = poseidon_hash_1([private_key]);
    let computed_commitment = poseidon_hash_3([public_key, wallet_address, salt]);

    std::println(public_key);
    std::println(computed_commitment);

    assert(public_key != 0);
    assert(computed_commitment != 0);
}
