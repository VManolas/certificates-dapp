use dep::std;

#[test]
fn test_poseidon_hash_1() {
    // Test single input Poseidon hash
    let input: Field = 123;
    let hash = std::hash::poseidon::bn254::hash_1([input]);
    assert(hash != 0);
}

#[test]
fn test_poseidon_hash_3() {
    // Test three input Poseidon hash (what we need for commitment)
    let input1: Field = 123;
    let input2: Field = 456;
    let input3: Field = 789;
    let hash = std::hash::poseidon::bn254::hash_3([input1, input2, input3]);
    assert(hash != 0);
}
