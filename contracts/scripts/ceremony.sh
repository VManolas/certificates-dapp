#!/usr/bin/env bash
#
# ceremony.sh — Reproducible Groth16 Trusted Setup for zkCredentials
#
# This script performs a complete trusted setup ceremony for the auth_login
# circuit, producing all artifacts needed for deployment:
#   - R1CS constraint system
#   - WASM witness generator
#   - Proving key (.zkey)
#   - Verification key (JSON)
#   - Solidity verifier contract
#
# Prerequisites:
#   - circom >= 2.1.0 (https://docs.circom.io/getting-started/installation/)
#   - snarkjs >= 0.7.x (npm install -g snarkjs)
#   - Node.js >= 18
#
# Usage:
#   cd contracts/circuits/auth_login_groth16
#   bash ../../scripts/ceremony.sh
#
# The script logs all hashes for reproducibility verification.
# For a production deployment, replace Phase 1 with a community
# Powers of Tau ceremony (e.g., Hermez perpetual ceremony).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CIRCUIT_DIR="${SCRIPT_DIR}/../circuits/auth_login_groth16"
BUILD_DIR="${CIRCUIT_DIR}/build"
FRONTEND_CIRCUITS="${SCRIPT_DIR}/../../frontend/public/circuits"

CIRCUIT_NAME="auth_login"
PTAU_POWER=11  # 2^11 = 2048 max constraints (circuit uses ~1,698)

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  zkCredentials Groth16 Trusted Setup Ceremony               ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  Circuit:    ${CIRCUIT_NAME}.circom"
echo "║  Build dir:  ${BUILD_DIR}"
echo "║  PTAU power: ${PTAU_POWER} (max 2^${PTAU_POWER} = $((2**PTAU_POWER)) constraints)"
echo "║  Date:       $(date -u '+%Y-%m-%d %H:%M:%S UTC')"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Verify prerequisites
command -v circom >/dev/null 2>&1 || { echo "ERROR: circom not found"; exit 1; }
command -v snarkjs >/dev/null 2>&1 || { echo "ERROR: snarkjs not found"; exit 1; }

echo "Tools:"
echo "  circom:  $(circom --version 2>&1 | head -1)"
echo "  snarkjs: $(snarkjs --version 2>&1 | head -1)"
echo ""

mkdir -p "${BUILD_DIR}"
cd "${CIRCUIT_DIR}"

# ─── Phase 0: Compile Circuit ───────────────────────────────────────────────
echo "━━━ Phase 0: Compiling circuit ━━━"
circom "${CIRCUIT_NAME}.circom" --r1cs --wasm --sym -o "${BUILD_DIR}/" 2>&1
echo ""

echo "Circuit info:"
snarkjs r1cs info "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" 2>&1 | grep -v "^\[" || true
echo ""

# Record R1CS hash for reproducibility
R1CS_HASH=$(sha256sum "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" | cut -d' ' -f1)
echo "R1CS SHA-256: ${R1CS_HASH}"
echo ""

# ─── Phase 1: Powers of Tau (universal, circuit-independent) ─────────────────
echo "━━━ Phase 1: Powers of Tau ceremony ━━━"

if [ -f "pot${PTAU_POWER}_final.ptau" ]; then
    echo "Using existing pot${PTAU_POWER}_final.ptau"
    echo "SHA-256: $(sha256sum pot${PTAU_POWER}_final.ptau | cut -d' ' -f1)"
else
    echo "Generating new Powers of Tau (power=${PTAU_POWER})..."
    
    # Start new ceremony
    snarkjs powersoftau new bn128 ${PTAU_POWER} "pot${PTAU_POWER}_0000.ptau" -v 2>&1
    
    # Contribute with random entropy
    ENTROPY=$(head -c 64 /dev/urandom | xxd -p | tr -d '\n')
    snarkjs powersoftau contribute \
        "pot${PTAU_POWER}_0000.ptau" \
        "pot${PTAU_POWER}_0001.ptau" \
        --name="zkCredentials Phase 1 Contribution" \
        -e="${ENTROPY}" 2>&1
    
    # Prepare for Phase 2
    snarkjs powersoftau prepare phase2 \
        "pot${PTAU_POWER}_0001.ptau" \
        "pot${PTAU_POWER}_final.ptau" -v 2>&1
    
    echo "Phase 1 complete."
    echo "pot${PTAU_POWER}_final.ptau SHA-256: $(sha256sum pot${PTAU_POWER}_final.ptau | cut -d' ' -f1)"
fi
echo ""

# ─── Phase 2: Circuit-specific setup ────────────────────────────────────────
echo "━━━ Phase 2: Groth16 setup (circuit-specific) ━━━"

snarkjs groth16 setup \
    "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" \
    "pot${PTAU_POWER}_final.ptau" \
    "${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey" 2>&1

echo ""
echo "Circuit hash (from setup):"
snarkjs zkey verify "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" "pot${PTAU_POWER}_final.ptau" "${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey" 2>&1 | grep -i "circuit hash" || true
echo ""

# Phase 2 contribution
echo "━━━ Phase 2: Contributing randomness ━━━"
ENTROPY2=$(head -c 64 /dev/urandom | xxd -p | tr -d '\n')
snarkjs zkey contribute \
    "${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey" \
    "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" \
    --name="zkCredentials thesis ceremony v1.3.0" \
    -e="${ENTROPY2}" 2>&1

echo ""

# ─── Phase 3: Verification ──────────────────────────────────────────────────
echo "━━━ Phase 3: Verifying ceremony ━━━"
snarkjs zkey verify \
    "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" \
    "pot${PTAU_POWER}_final.ptau" \
    "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" 2>&1

echo ""

# ─── Phase 4: Export artifacts ───────────────────────────────────────────────
echo "━━━ Phase 4: Exporting artifacts ━━━"

# Verification key (JSON)
snarkjs zkey export verificationkey \
    "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" \
    "${BUILD_DIR}/verification_key.json" 2>&1

# Solidity verifier
snarkjs zkey export solidityverifier \
    "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" \
    "${BUILD_DIR}/Groth16Verifier.sol" 2>&1

echo "Exported: verification_key.json, Groth16Verifier.sol"
echo ""

# ─── Phase 5: Test proof generation ─────────────────────────────────────────
echo "━━━ Phase 5: Smoke test (proof generation + verification) ━━━"

if [ -f "test_input.json" ]; then
    snarkjs groth16 fullprove \
        test_input.json \
        "${BUILD_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm" \
        "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" \
        "${BUILD_DIR}/proof.json" \
        "${BUILD_DIR}/public.json" 2>&1

    snarkjs groth16 verify \
        "${BUILD_DIR}/verification_key.json" \
        "${BUILD_DIR}/public.json" \
        "${BUILD_DIR}/proof.json" 2>&1
    echo "Smoke test: PASSED"
else
    echo "SKIP: test_input.json not found"
fi
echo ""

# ─── Phase 6: Deploy artifacts ───────────────────────────────────────────────
echo "━━━ Phase 6: Deploying artifacts ━━━"

# Copy to circuit root (backwards compatibility)
cp "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" "${CIRCUIT_DIR}/${CIRCUIT_NAME}.r1cs"
cp "${BUILD_DIR}/${CIRCUIT_NAME}.sym" "${CIRCUIT_DIR}/${CIRCUIT_NAME}.sym"
cp "${BUILD_DIR}/${CIRCUIT_NAME}_0000.zkey" "${CIRCUIT_DIR}/${CIRCUIT_NAME}_0000.zkey"
cp "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" "${CIRCUIT_DIR}/${CIRCUIT_NAME}_final.zkey"
cp "${BUILD_DIR}/verification_key.json" "${CIRCUIT_DIR}/verification_key.json"
cp "${BUILD_DIR}/Groth16Verifier.sol" "${CIRCUIT_DIR}/Groth16AuthVerifier.sol"

# Copy WASM to circuit JS dir
mkdir -p "${CIRCUIT_DIR}/${CIRCUIT_NAME}_js"
cp "${BUILD_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm" "${CIRCUIT_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm"
cp "${BUILD_DIR}/${CIRCUIT_NAME}_js/generate_witness.js" "${CIRCUIT_DIR}/${CIRCUIT_NAME}_js/generate_witness.js" 2>/dev/null || true
cp "${BUILD_DIR}/${CIRCUIT_NAME}_js/witness_calculator.js" "${CIRCUIT_DIR}/${CIRCUIT_NAME}_js/witness_calculator.js" 2>/dev/null || true

# Copy to frontend public (for browser proving)
mkdir -p "${FRONTEND_CIRCUITS}"
cp "${BUILD_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm" "${FRONTEND_CIRCUITS}/${CIRCUIT_NAME}.wasm"
cp "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" "${FRONTEND_CIRCUITS}/${CIRCUIT_NAME}_final.zkey"

# Copy verifier to contracts directory
cp "${BUILD_DIR}/Groth16Verifier.sol" "${SCRIPT_DIR}/../contracts/Groth16AuthVerifier.sol"

echo "Artifacts deployed to:"
echo "  circuits/:          r1cs, sym, zkey, verification_key.json"
echo "  frontend/public/:   wasm, zkey (browser proving)"
echo "  contracts/:         Groth16AuthVerifier.sol"
echo ""

# ─── Summary ─────────────────────────────────────────────────────────────────
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║  CEREMONY COMPLETE                                          ║"
echo "╠══════════════════════════════════════════════════════════════╣"
echo "║  R1CS constraints:  $(snarkjs r1cs info "${BUILD_DIR}/${CIRCUIT_NAME}.r1cs" 2>&1 | grep "Constraints" | awk '{print $NF}')"
echo "║  R1CS SHA-256:      ${R1CS_HASH:0:16}..."
echo "║  Proving key:       ${CIRCUIT_NAME}_final.zkey ($(du -h "${BUILD_DIR}/${CIRCUIT_NAME}_final.zkey" | cut -f1))"
echo "║  WASM:              ${CIRCUIT_NAME}.wasm ($(du -h "${BUILD_DIR}/${CIRCUIT_NAME}_js/${CIRCUIT_NAME}.wasm" | cut -f1))"
echo "║  Verifier:          Groth16AuthVerifier.sol"
echo "║  Contributions:     1 (thesis author)"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "NEXT STEPS:"
echo "  1. Review Groth16AuthVerifier.sol for correctness"
echo "  2. Compile contracts:  cd contracts && npx hardhat compile"
echo "  3. Run tests:          npx hardhat test"
echo "  4. Deploy verifier:    npx hardhat deploy-zksync --script deploy/deploy-verifier.ts"
echo "  5. Update adapter reference if verifier address changed"
echo ""
echo "NOTE: For production, replace Phase 1 with a multi-party ceremony"
echo "      (e.g., Hermez perpetual Powers of Tau or Zcash ceremony)."
