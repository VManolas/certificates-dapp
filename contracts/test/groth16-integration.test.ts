// contracts/test/groth16-integration.test.ts
/**
 * Groth16 End-to-End Integration Test
 * ====================================
 *
 * Validates the PRODUCTION Groth16 verification path:
 * 1. Generates a real Groth16 proof via snarkjs using the compiled circuit
 * 2. Deploys the Groth16Verifier + Groth16AuthVerifierAdapter
 * 3. Deploys ZKAuthRegistry configured with the Groth16 adapter
 * 4. Registers a commitment and starts a session using the real proof
 *
 * This test ensures the deployed Groth16 path (as opposed to the UltraPlonk
 * path tested in zkauth-integration.test.ts, which is now legacy — see that file's
 * header) works end-to-end.
 *
 * Also includes the real gas/proof-generation-time benchmark for this path (see
 * "Gas & Performance Analysis" below — these are the numbers to cite, not the
 * UltraPlonk ones), and a regression test documenting the front-running-driven
 * session/role impersonation risk on startSession described in
 * circuits/SECURITY_REVIEW.md (finding 3) and circuits/THREAT_MODEL.md.
 */

import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { ZKAuthRegistry } from '../typechain-types';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';
import { buildPoseidon } from 'circomlibjs';
import * as path from 'path';

// snarkjs is loaded dynamically to handle CommonJS/ESM interop
let snarkjs: any;

describe('Groth16 End-to-End Integration', function () {
  this.timeout(120000);

  let zkAuthRegistry: ZKAuthRegistry;
  let admin: SignerWithAddress;
  let user: SignerWithAddress;
  let attacker: SignerWithAddress;
  let poseidon: any;

  const WASM_PATH = path.join(
    __dirname,
    '../circuits/auth_login_groth16/auth_login_js/generate_witness.js'
  ).replace('/auth_login_js/generate_witness.js', '_js/generate_witness.js');

  const WASM_FILE = path.join(
    __dirname,
    '../../frontend/public/circuits/auth_login.wasm'
  );

  const ZKEY_FILE = path.join(
    __dirname,
    '../../frontend/public/circuits/auth_login_final.zkey'
  );

  before(async function () {
    try {
      snarkjs = await import('snarkjs');
    } catch {
      try {
        snarkjs = require('snarkjs');
      } catch (e) {
        this.skip();
        return;
      }
    }

    poseidon = await buildPoseidon();
    [admin, user, attacker] = await ethers.getSigners();
  });

  function poseidonHash(inputs: bigint[]): bigint {
    const F = poseidon.F;
    return F.toObject(poseidon(inputs.map((x) => F.e(x))));
  }

  function toBytes32(value: bigint): string {
    return '0x' + value.toString(16).padStart(64, '0');
  }

  // Shared helper for the new tests below: generates a real Groth16 proof for the given
  // (privateKey, walletAddress, salt, nonce) tuple and returns it ABI-encoded exactly as
  // ZKAuthRegistry expects, along with the bytes32-encoded public inputs. Also returns the
  // proof-generation wall-clock time in milliseconds for benchmarking.
  async function generateAuthTuple(
    privateKey: bigint,
    walletAddress: bigint,
    salt: bigint,
    nonce: bigint
  ) {
    const skHash = poseidonHash([privateKey]);
    const commitment = poseidonHash([skHash, walletAddress, salt]);
    const nullifier = poseidonHash([privateKey, nonce]);

    const input = {
      privateKey: privateKey.toString(),
      walletAddress: walletAddress.toString(),
      salt: salt.toString(),
      commitment: commitment.toString(),
      nullifierNonce: nonce.toString(),
      nullifier: nullifier.toString(),
    };

    const proofGenStart = Date.now();
    const { proof } = await snarkjs.groth16.fullProve(input, WASM_FILE, ZKEY_FILE);
    const proofGenMs = Date.now() - proofGenStart;

    const pA: [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const pB: [[bigint, bigint], [bigint, bigint]] = [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ];
    const pC: [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

    const proofEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256[2]', 'uint256[2][2]', 'uint256[2]'],
      [pA, pB, pC]
    );

    return {
      proofEncoded,
      commitmentBytes32: toBytes32(commitment),
      nonceBytes32: toBytes32(nonce),
      nullifierBytes32: toBytes32(nullifier),
      proofGenMs,
    };
  }

  it('should deploy Groth16Verifier and adapter', async function () {
    const Groth16VerifierFactory = await ethers.getContractFactory('Groth16Verifier');
    const groth16Verifier = await Groth16VerifierFactory.deploy();
    await groth16Verifier.waitForDeployment();

    const AdapterFactory = await ethers.getContractFactory('Groth16AuthVerifierAdapter');
    const adapter = await AdapterFactory.deploy(await groth16Verifier.getAddress());
    await adapter.waitForDeployment();

    const ZKAuthFactory = await ethers.getContractFactory('ZKAuthRegistry');
    zkAuthRegistry = (await upgrades.deployProxy(ZKAuthFactory, [
      admin.address,
      await adapter.getAddress(),
    ])) as unknown as ZKAuthRegistry;
    await zkAuthRegistry.waitForDeployment();

    expect(await zkAuthRegistry.authVerifier()).to.equal(await adapter.getAddress());
  });

  it('should register a commitment with a real Groth16 proof', async function () {
    if (!snarkjs) this.skip();

    const privateKey = BigInt('987654321098765432');
    const walletAddress = BigInt(user.address);
    const salt = BigInt('112233445566778899');
    const nullifierNonce = BigInt('999888777666555444');

    const skHash = poseidonHash([privateKey]);
    const commitment = poseidonHash([skHash, walletAddress, salt]);
    const nullifier = poseidonHash([privateKey, nullifierNonce]);

    const input = {
      privateKey: privateKey.toString(),
      walletAddress: walletAddress.toString(),
      salt: salt.toString(),
      commitment: commitment.toString(),
      nullifierNonce: nullifierNonce.toString(),
      nullifier: nullifier.toString(),
    };

    const { proof, publicSignals } = await snarkjs.groth16.fullProve(
      input,
      WASM_FILE,
      ZKEY_FILE
    );

    // Transpose pi_b for EIP-197 compatibility (imaginary/real swap)
    const pA: [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const pB: [[bigint, bigint], [bigint, bigint]] = [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ];
    const pC: [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

    const proofEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256[2]', 'uint256[2][2]', 'uint256[2]'],
      [pA, pB, pC]
    );

    const commitmentBytes32 = toBytes32(commitment);
    const nullifierNonceBytes32 = toBytes32(nullifierNonce);
    const nullifierBytes32 = toBytes32(nullifier);

    const tx = await zkAuthRegistry
      .connect(user)
      .registerCommitment(
        commitmentBytes32,
        1, // Student role
        proofEncoded,
        nullifierNonceBytes32,
        nullifierBytes32
      );

    await tx.wait();
    expect(await zkAuthRegistry.isRegistered(commitmentBytes32)).to.be.true;
  });

  it('should start a session with a real Groth16 proof', async function () {
    if (!snarkjs) this.skip();

    const privateKey = BigInt('987654321098765432');
    const walletAddress = BigInt(user.address);
    const salt = BigInt('112233445566778899');
    const sessionNonce = BigInt('111222333444555666');

    const skHash = poseidonHash([privateKey]);
    const commitment = poseidonHash([skHash, walletAddress, salt]);
    const sessionNullifier = poseidonHash([privateKey, sessionNonce]);

    const input = {
      privateKey: privateKey.toString(),
      walletAddress: walletAddress.toString(),
      salt: salt.toString(),
      commitment: commitment.toString(),
      nullifierNonce: sessionNonce.toString(),
      nullifier: sessionNullifier.toString(),
    };

    const { proof } = await snarkjs.groth16.fullProve(
      input,
      WASM_FILE,
      ZKEY_FILE
    );

    const pA: [bigint, bigint] = [BigInt(proof.pi_a[0]), BigInt(proof.pi_a[1])];
    const pB: [[bigint, bigint], [bigint, bigint]] = [
      [BigInt(proof.pi_b[0][1]), BigInt(proof.pi_b[0][0])],
      [BigInt(proof.pi_b[1][1]), BigInt(proof.pi_b[1][0])],
    ];
    const pC: [bigint, bigint] = [BigInt(proof.pi_c[0]), BigInt(proof.pi_c[1])];

    const proofEncoded = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256[2]', 'uint256[2][2]', 'uint256[2]'],
      [pA, pB, pC]
    );

    const commitmentBytes32 = toBytes32(commitment);
    const sessionNonceBytes32 = toBytes32(sessionNonce);
    const sessionNullifierBytes32 = toBytes32(sessionNullifier);

    const tx = await zkAuthRegistry
      .connect(user)
      .startSession(
        commitmentBytes32,
        proofEncoded,
        sessionNonceBytes32,
        sessionNullifierBytes32
      );

    const receipt = await tx.wait();
    const event = receipt?.logs.find((log) => {
      try {
        return zkAuthRegistry.interface.parseLog(log as any)?.name === 'SessionStarted';
      } catch {
        return false;
      }
    });

    expect(event).to.not.be.undefined;
  });

  it('should reject an invalid Groth16 proof', async function () {
    if (!snarkjs) this.skip();

    const fakeCommitment = toBytes32(BigInt('12345'));
    const fakeNonce = toBytes32(BigInt('67890'));
    const fakeNullifier = toBytes32(BigInt('11111'));

    // Fabricate invalid proof bytes (correct length but wrong values)
    const invalidProof = ethers.AbiCoder.defaultAbiCoder().encode(
      ['uint256[2]', 'uint256[2][2]', 'uint256[2]'],
      [
        [1n, 2n],
        [[3n, 4n], [5n, 6n]],
        [7n, 8n],
      ]
    );

    await expect(
      zkAuthRegistry.connect(user).registerCommitment(
        fakeCommitment,
        1,
        invalidProof,
        fakeNonce,
        fakeNullifier
      )
    ).to.be.revertedWithCustomError(zkAuthRegistry, 'InvalidProof');
  });

  // Intentionally skipped, not deleted: a real malleability test would need to construct a
  // second, distinct valid proof for the same statement by manipulating curve points — a
  // nontrivial piece of cryptographic engineering, not something to fake with a trivial
  // assertion. See circuits/SECURITY_REVIEW.md finding 4: the stock snarkjs Groth16Verifier.sol
  // lacks the extra malleability-hardening checks some deployments add. Recommended as a
  // concrete task for the external audit, not attempted here.
  it.skip('should reject a malleable/re-randomized proof for the same statement (see circuits/SECURITY_REVIEW.md finding 4 — needs a real external audit, not attempted here)', async function () {});

  // ─────────────────────────────────────────────────────────────
  // Gas & Performance Analysis — the REAL production (Groth16) numbers.
  //
  // zkauth-integration.test.ts has a "Gas Cost Analysis" suite, but it measures the
  // deprecated UltraPlonk path (see that file's header comment) and never measures proof
  // generation time at all. These numbers are measured against the actual deployed Groth16
  // verifier and are what should be cited for the thesis/paper, not the UltraPlonk figures.
  // ─────────────────────────────────────────────────────────────

  // Last measured on this development machine (local Hardhat network, single run):
  //   registerCommitment: ~341,274 gas, ~1.6s proof generation
  //   startSession:        ~345,660 gas, ~1.5s proof generation
  // Re-run this test to get current numbers before citing them anywhere — proof-generation
  // time in particular depends heavily on the machine running it.
  describe('Gas & Performance Analysis (production Groth16 path)', function () {
    it('should measure real proof-generation time and on-chain gas for registerCommitment and startSession', async function () {
      if (!snarkjs) this.skip();

      const privateKey = BigInt('55555555555555555555');
      const walletAddress = BigInt(user.address);
      const salt = BigInt('66666666666666666666');
      const registrationNonce = BigInt('77777777777777777777');

      const registration = await generateAuthTuple(privateKey, walletAddress, salt, registrationNonce);

      const regTx = await zkAuthRegistry
        .connect(user)
        .registerCommitment(registration.commitmentBytes32, 1, registration.proofEncoded, registration.nonceBytes32, registration.nullifierBytes32);
      const regReceipt = await regTx.wait();
      const regGasUsed = regReceipt!.gasUsed;

      const sessionNonce = BigInt('88888888888888888888');
      const session = await generateAuthTuple(privateKey, walletAddress, salt, sessionNonce);

      const sessTx = await zkAuthRegistry
        .connect(user)
        .startSession(registration.commitmentBytes32, session.proofEncoded, session.nonceBytes32, session.nullifierBytes32);
      const sessReceipt = await sessTx.wait();
      const sessGasUsed = sessReceipt!.gasUsed;

      console.log('\n⛽ Groth16 Production-Path Gas & Performance Analysis (measured on local Hardhat network)');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log(`📊 registerCommitment: gas=${regGasUsed.toString()}, proof generation=${registration.proofGenMs}ms`);
      console.log(`📊 startSession:       gas=${sessGasUsed.toString()}, proof generation=${session.proofGenMs}ms`);
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('Note: these are local Hardhat EVM gas figures for the actual deployed Groth16');
      console.log('verifier, not the deprecated UltraPlonk path measured in zkauth-integration.test.ts.');
      console.log('They are not zkSync Era mainnet gas/cost figures — see THREAT_MODEL.md and the');
      console.log('thesis performance chapter for how zkSync Era gas differs from raw EVM gas.\n');

      // Generous sanity bounds only — the console output above is the actual documentation.
      // Do not copy the UltraPlonk suite's 550k ceiling here; Groth16 proofs are far smaller
      // (256 bytes vs ~2-4KB for UltraPlonk) and gas is expected to differ meaningfully.
      expect(regGasUsed).to.be.lessThan(1_000_000n);
      expect(sessGasUsed).to.be.lessThan(1_000_000n);
      expect(registration.proofGenMs).to.be.greaterThan(0);
      expect(session.proofGenMs).to.be.greaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────
  // Front-running startSession — session/role impersonation, not just griefing (documented,
  // not fixed in this pass — see circuits/SECURITY_REVIEW.md finding 3 and
  // circuits/THREAT_MODEL.md's adversary model). proof + public inputs are plaintext function
  // arguments, so anyone who observes a pending startSession transaction can resubmit the
  // identical tuple and consume the nullifier first. Because startSession records the caller
  // as session.initiator and validateSession has no caller check at all, the attacker who wins
  // the race ends up holding a genuinely valid session authenticated as the VICTIM's role and
  // commitment — not merely forcing a retry. This test proves both halves: the attacker's
  // session validates successfully, and the real user's identical submission then reverts.
  // It does not simulate literal mempool ordering (Hardhat's local network has no public
  // mempool to model); it proves that whoever's transaction lands first wins.
  // ─────────────────────────────────────────────────────────────

  describe('Front-running startSession (session/role impersonation, not fixed — see SECURITY_REVIEW.md)', function () {
    it('should let an attacker who copies a pending startSession tuple obtain a valid session for the victim\'s role/commitment, forcing the real user to retry', async function () {
      if (!snarkjs) this.skip();

      // Register a fresh commitment for this test so it doesn't depend on state left by
      // earlier tests in this file.
      const privateKey = BigInt('11111111111111111111');
      const walletAddress = BigInt(user.address);
      const salt = BigInt('22222222222222222222');
      const registrationNonce = BigInt('33333333333333333333');

      const registration = await generateAuthTuple(privateKey, walletAddress, salt, registrationNonce);
      await (
        await zkAuthRegistry
          .connect(user)
          .registerCommitment(registration.commitmentBytes32, 1, registration.proofEncoded, registration.nonceBytes32, registration.nullifierBytes32)
      ).wait();

      // The legitimate user generates a session proof — in a real deployment this would be
      // broadcast and sit in the public mempool for a few seconds before confirming.
      const sessionNonce = BigInt('44444444444444444444');
      const session = await generateAuthTuple(privateKey, walletAddress, salt, sessionNonce);

      // The attacker observed that pending transaction's calldata (proof + public inputs are
      // all plaintext arguments) and copies the exact same tuple into their own transaction,
      // which lands first.
      const attackerTx = await zkAuthRegistry
        .connect(attacker)
        .startSession(registration.commitmentBytes32, session.proofEncoded, session.nonceBytes32, session.nullifierBytes32);
      const attackerReceipt = await attackerTx.wait();

      // This is the impersonation, not just griefing: the attacker's own transaction now
      // owns a session (session.initiator == attacker.address) that validateSession will
      // report as active and tied to the VICTIM's role/commitment — the attacker never
      // learned the private key.
      const startedEvent = attackerReceipt!.logs
        .map((log) => {
          try {
            return zkAuthRegistry.interface.parseLog(log as any);
          } catch {
            return null;
          }
        })
        .find((parsed) => parsed?.name === 'SessionStarted');
      expect(startedEvent).to.not.be.undefined;

      const [isValid, , sessionCommitment] = await zkAuthRegistry.validateSession(startedEvent!.args[0]);
      expect(isValid).to.be.true;
      expect(sessionCommitment).to.equal(registration.commitmentBytes32);

      // The real user's identical submission — the one that was actually pending first —
      // now reverts, because the attacker already spent the nullifier.
      await expect(
        zkAuthRegistry
          .connect(user)
          .startSession(registration.commitmentBytes32, session.proofEncoded, session.nonceBytes32, session.nullifierBytes32)
      ).to.be.revertedWithCustomError(zkAuthRegistry, 'NullifierAlreadyUsed');
    });
  });
});
