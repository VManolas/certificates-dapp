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
use dep::poseidon::poseidon::bn254::hash_3 as poseidon_hash_3;

fn main(
    // Private inputs (kept secret by prover)
    private_key: Field,
    wallet_address: Field,
    salt: Field,
    
    // Public inputs (visible to verifier)
    commitment: pub Field
) {
    // Step 1: Derive public key from private key using Poseidon hash
    // This is a one-way function - knowing public key doesn't reveal private key
    let public_key = poseidon_hash_1([private_key]);
    
    // Step 2: Compute commitment = hash(publicKey, walletAddress, salt)
    // The salt prevents rainbow table attacks and allows multiple commitments per wallet
    let computed_commitment = poseidon_hash_3([
        public_key,
        wallet_address,
        salt
    ]);
    
    // Step 3: Constrain that computed commitment matches the public commitment
    // This proves the user knows the private key and wallet without revealing them
    assert(computed_commitment == commitment);
}

#[test]
fn test_auth_login_valid() {
    // Test case: Valid authentication proof
    let private_key: Field = 12345678901234567890;
    let wallet_address: Field = 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1;
    let salt: Field = 98765432109876543210;
    
    // Compute expected commitment using Poseidon
    let public_key = poseidon_hash_1([private_key]);
    let expected_commitment = poseidon_hash_3([
        public_key,
        wallet_address,
        salt
    ]);
    
    // This should pass
    main(private_key, wallet_address, salt, expected_commitment);
}

#[test]
fn test_auth_login_different_commitments() {
    // Test case: Different private keys produce different commitments
    let private_key1: Field = 12345678901234567890;
    let private_key2: Field = 98765432109876543210;
    let wallet_address: Field = 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1;
    let salt: Field = 11111111111111111111;
    
    // Compute commitments for both keys using Poseidon
    let public_key1 = poseidon_hash_1([private_key1]);
    let commitment1: Field = poseidon_hash_3([
        public_key1,
        wallet_address,
        salt
    ]);
    
    let public_key2 = poseidon_hash_1([private_key2]);
    let commitment2: Field = poseidon_hash_3([
        public_key2,
        wallet_address,
        salt
    ]);
    
    // Verify they produce different commitments
    assert(commitment1 != commitment2);
}

// Test with specific values to compare with JavaScript poseidon-lite
#[test]
fn test_poseidon_compatibility() {
    // Use simple test values
    let private_key: Field = 12345678901234567890;
    let wallet_address: Field = 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1;
    let salt: Field = 98765432109876543210;
    
    // Compute public key
    let public_key = poseidon_hash_1([private_key]);
    
    // Compute commitment
    let computed_commitment = poseidon_hash_3([
        public_key,
        wallet_address,
        salt
    ]);
    
    // Print for comparison with JavaScript
    std::println(public_key);
    std::println(computed_commitment);
    
    // This test should pass - it just computes the values
    assert(public_key != 0);
    assert(computed_commitment != 0);
}
