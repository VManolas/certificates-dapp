// Generate UltraPlonk Solidity Verifier using Noir.js
// This script uses the @noir-lang/backend_barretenberg package
// to generate a Solidity verifier from the compiled Noir circuit

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CIRCUIT_PATH = join(__dirname, '../circuits/auth_login/target/auth_login.json');
const OUTPUT_PATH = join(__dirname, '../contracts/UltraPlonkAuthVerifier.sol');

console.log('🔧 UltraPlonk Verifier Generation (via Noir.js)');
console.log('===============================================\n');

async function generateVerifier() {
  try {
    // Step 1: Load circuit artifact
    console.log('📂 Loading circuit artifact...');
    console.log(`   Path: ${CIRCUIT_PATH}`);
    
    const circuitData = JSON.parse(readFileSync(CIRCUIT_PATH, 'utf8'));
    console.log('✅ Circuit loaded successfully\n');
    
    // Step 2: Create Barretenberg backend
    console.log('🔨 Creating Barretenberg backend...');
    const backend = new BarretenbergBackend(circuitData);
    console.log('✅ Backend created\n');
    
    // Step 3: Generate Solidity verifier
    console.log('⚡ Generating Solidity verifier...');
    console.log('   This may take a minute...\n');
    
    const verifierCode = await backend.generateSolidityVerifier();
    
    console.log('✅ Verifier generated successfully\n');
    console.log(`   Code length: ${verifierCode.length} characters`);
    console.log(`   Lines: ${verifierCode.split('\n').length}`);
    
    // Step 4: Write to file
    console.log('\n📝 Writing verifier to file...');
    console.log(`   Output: ${OUTPUT_PATH}`);
    
    writeFileSync(OUTPUT_PATH, verifierCode, 'utf8');
    
    console.log('✅ File written successfully\n');
    
    // Step 5: Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Verifier Generation Complete!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('Next steps:');
    console.log('1. Review: ' + OUTPUT_PATH);
    console.log('2. Compile: npx hardhat compile');
    console.log('3. Deploy: Run deployment script');
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error generating verifier:');
    console.error(error);
    process.exit(1);
  }
}

generateVerifier();
