/**
 * Check available methods in BarretenbergBackend
 */

import { BarretenbergBackend } from '@noir-lang/backend_barretenberg';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CIRCUIT_PATH = '../../contracts/circuits/auth_login/target/auth_login.json';

async function checkMethods() {
  try {
    const circuitPath = join(__dirname, CIRCUIT_PATH);
    const circuitData = await readFile(circuitPath, 'utf-8');
    const circuit = JSON.parse(circuitData);
    
    const backend = new BarretenbergBackend(circuit);
    
    console.log('Available methods in BarretenbergBackend:');
    console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(backend)));
    
    console.log('\nAll properties:');
    for (const key in backend) {
      console.log(`- ${key}: ${typeof backend[key]}`);
    }
    
    await backend.destroy();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkMethods();

