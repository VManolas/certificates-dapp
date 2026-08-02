// contracts/scripts/benchmark-proof-generation.mjs
//
// Measures real proof-generation time for the production auth_login circuit
// (median, mean, standard deviation over N trials), using the same
// snarkjs.groth16.fullProve call path the frontend uses in production.
//
// Referenced from thesis.html Section 7.3 as the reproducible source for the
// "supplementary environment" benchmark row in Table 7.3. Run from contracts/:
//
//   node scripts/benchmark-proof-generation.mjs [N]
//
// N defaults to 25. Requires frontend/public/circuits/{auth_login.wasm,auth_login_final.zkey}
// to exist (built from contracts/circuits/auth_login_groth16/auth_login.circom).

import { buildPoseidon } from 'circomlibjs';
import * as snarkjs from 'snarkjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const WASM_FILE = path.join(ROOT, 'frontend/public/circuits/auth_login.wasm');
const ZKEY_FILE = path.join(ROOT, 'frontend/public/circuits/auth_login_final.zkey');

const N = Number(process.argv[2]) || 25;

function poseidonHash(poseidon, inputs) {
  const F = poseidon.F;
  return F.toObject(poseidon(inputs.map((x) => F.e(x))));
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function stdev(arr) {
  const m = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

async function main() {
  const poseidon = await buildPoseidon();
  const proofTimes = [];

  for (let i = 0; i < N; i++) {
    const privateKey = BigInt(1000 + i);
    const walletAddress = BigInt('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
    const salt = BigInt(2000 + i);
    const nonce = BigInt(3000 + i);

    const skHash = poseidonHash(poseidon, [privateKey]);
    const commitment = poseidonHash(poseidon, [skHash, walletAddress, salt]);
    const nullifier = poseidonHash(poseidon, [privateKey, nonce]);

    const input = {
      privateKey: privateKey.toString(),
      walletAddress: walletAddress.toString(),
      salt: salt.toString(),
      commitment: commitment.toString(),
      nullifierNonce: nonce.toString(),
      nullifier: nullifier.toString(),
    };

    const t0 = Date.now();
    const { proof } = await snarkjs.groth16.fullProve(input, WASM_FILE, ZKEY_FILE);
    const t1 = Date.now();
    proofTimes.push(t1 - t0);
    if (!proof) throw new Error('proof generation failed');
  }

  console.log(`N=${N}`);
  console.log('Proof generation times (combined witness+proof, ms):', proofTimes);
  console.log('median:', median(proofTimes).toFixed(1), 'ms');
  console.log('mean:', (proofTimes.reduce((a, b) => a + b, 0) / N).toFixed(1), 'ms');
  console.log('stdev:', stdev(proofTimes).toFixed(1), 'ms');
  console.log('min:', Math.min(...proofTimes), 'max:', Math.max(...proofTimes));
}

main().then(() => process.exit(0));
