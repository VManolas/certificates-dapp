use crate::{poseidon_hash_1, poseidon_hash_3};

// Test with specific values to compare with JavaScript
#[test]
fn test_poseidon_specific_values() {
    // Use smaller test values that fit in the field
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

