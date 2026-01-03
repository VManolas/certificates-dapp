/**
 * Generate Solidity Verifier Script
 * 
 * This script uses the Barretenberg backend to generate a Solidity verifier contract
 * from the compiled Noir circuit.
 * 
 * Usage: node scripts/generate-verifier.mjs
 */

import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Path to the compiled circuit
const CIRCUIT_PATH = '../../contracts/circuits/auth_login/target/auth_login.json';
const OUTPUT_PATH = '../../contracts/contracts/NoirAuthVerifier.sol';

async function generateVerifier() {
  console.log('🔧 Generating Solidity verifier contract...\n');
  
  try {
    // Step 1: Load the compiled circuit
    console.log('📖 Loading circuit artifact...');
    const circuitPath = join(__dirname, CIRCUIT_PATH);
    const circuitData = await readFile(circuitPath, 'utf-8');
    const circuit = JSON.parse(circuitData);
    console.log('✅ Circuit loaded successfully\n');
    
    // Step 2: Initialize Barretenberg backend
    console.log('🔨 Initializing Barretenberg backend...');
    const backend = new BarretenbergBackend(circuit);
    console.log('✅ Backend initialized\n');
    
    // Step 3: Generate the Solidity verifier contract
    console.log('⚙️  Generating Solidity verifier...');
    const verifierContract = await backend.generateSolidityVerifier();
    console.log('✅ Verifier contract generated\n');
    
    // Step 4: Write to file
    console.log('💾 Writing verifier contract to file...');
    const outputPath = join(__dirname, OUTPUT_PATH);
    
    // Ensure the directory exists
    await mkdir(dirname(outputPath), { recursive: true });
    
    await writeFile(outputPath, verifierContract, 'utf-8');
    console.log(`✅ Verifier contract saved to: ${OUTPUT_PATH}\n`);
    
    console.log('🎉 Done! You can now deploy the NoirAuthVerifier.sol contract.\n');
    console.log('Next steps:');
    console.log('1. Review the generated contract in contracts/contracts/NoirAuthVerifier.sol');
    console.log('2. Deploy it using: cd ../contracts && npx hardhat run scripts/deploy-noir-verifier.ts --network localhost');
    console.log('3. Update ZKAuthRegistry to use the new verifier address\n');
    
    // Cleanup
    await backend.destroy();
    
  } catch (error) {
    console.error('❌ Error generating verifier:', error);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Run the generator
generateVerifier();

