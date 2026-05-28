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
 * path tested in zkauth-integration.test.ts) works end-to-end.
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
    [admin, user] = await ethers.getSigners();
  });

  function poseidonHash(inputs: bigint[]): bigint {
    const F = poseidon.F;
    return F.toObject(poseidon(inputs.map((x) => F.e(x))));
  }

  function toBytes32(value: bigint): string {
    return '0x' + value.toString(16).padStart(64, '0');
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
});
