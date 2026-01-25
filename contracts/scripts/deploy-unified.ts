// contracts/scripts/deploy-unified.ts
/**
 * Unified Hardhat Deployment Script
 * ==================================
 * 
 * Single deployment script for Hardhat local network.
 * Replaces: deploy-local.ts, deploy-ultraplonk.ts, deploy-simple.ts
 * 
 * Features:
 * - Configurable verifier (mock or ultraplonk)
 * - UUPS proxy pattern
 * - Complete contract linking
 * - Environment variable support
 * 
 * Usage:
 *   # Development (mock verifier)
 *   npm run deploy:dev
 * 
 *   # Development with production verifier
 *   VERIFIER_TYPE=ultraplonk npm run deploy:dev
 *   # or
 *   npm run deploy:dev:ultraplonk
 */

import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";
import {
  getDeploymentConfig,
  validateDeploymentConfig,
  printDeploymentConfig,
} from "../config/deployment.config";
import {
  ContractDeployer,
  DeploymentResult,
  deployCoreContracts,
  deployVerifier,
  deployZKAuthRegistry,
  linkContracts,
  printDeploymentSummary,
} from "../lib/deployment-core";

/**
 * Hardhat-specific contract deployer implementation
 */
class HardhatContractDeployer implements ContractDeployer {
  constructor(private signerAddress: string) {}

  async deployProxy(
    contractName: string,
    initArgs: any[],
    options?: any
  ): Promise<{ address: string; contract: any }> {
    const Factory = await ethers.getContractFactory(contractName);
    const contract = await upgrades.deployProxy(Factory, initArgs, {
      initializer: "initialize",
      kind: "uups",
      ...options,
    });
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    return { address, contract };
  }

  async deployContract(
    contractName: string,
    constructorArgs: any[] = []
  ): Promise<{ address: string; contract: any }> {
    const Factory = await ethers.getContractFactory(contractName);
    const contract = await Factory.deploy(...constructorArgs);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    return { address, contract };
  }

  async getSignerAddress(): Promise<string> {
    return this.signerAddress;
  }
}

async function main() {
  console.log("\n🚀 Starting zkCredentials Unified Deployment (Hardhat)...\n");

  // Get deployment configuration
  const config = getDeploymentConfig("development");
  validateDeploymentConfig(config);
  printDeploymentConfig(config);

  // Get deployer signer
  const [deployer] = await ethers.getSigners();
  console.log(`📍 Deploying with wallet: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`💰 Wallet balance: ${ethers.formatEther(balance)} ETH\n`);

  // Create deployer instance
  const contractDeployer = new HardhatContractDeployer(deployer.address);

  try {
    // ============================================
    // STEP 1-3: Deploy Core Contracts
    // ============================================
    const coreContracts = await deployCoreContracts(
      contractDeployer,
      deployer.address
    );

    // ============================================
    // STEP 4: Deploy Verifier
    // ============================================
    console.log("═".repeat(60));
    console.log(`STEP 4: Deploy ${config.verifier.toUpperCase()} Verifier`);
    console.log("═".repeat(60) + "\n");

    const verifierAddresses = await deployVerifier(
      contractDeployer,
      config.verifier
    );

    // ============================================
    // STEP 5: Link Contracts
    // ============================================
    const institutionRegistry = await ethers.getContractAt(
      "InstitutionRegistry",
      coreContracts.institutionRegistry
    );

    const employerRegistry = await ethers.getContractAt(
      "EmployerRegistry",
      coreContracts.employerRegistry
    );

    await linkContracts(coreContracts, async (from, to, method) => {
      if (method === "setCertificateRegistry") {
        const tx = await institutionRegistry.setCertificateRegistry(to);
        await tx.wait();
      } else if (method === "setRegistries") {
        const [instAddr, certAddr] = to.split(",");
        const tx = await employerRegistry.setRegistries(instAddr, certAddr);
        await tx.wait();
      }
    });

    // ============================================
    // STEP 6: Deploy ZKAuthRegistry
    // ============================================
    const zkAuthRegistryAddress = await deployZKAuthRegistry(
      contractDeployer,
      deployer.address,
      verifierAddresses.adapter
    );

    // ============================================
    // Create Deployment Result
    // ============================================
    const result: DeploymentResult = {
      institutionRegistry: coreContracts.institutionRegistry,
      certificateRegistry: coreContracts.certificateRegistry,
      employerRegistry: coreContracts.employerRegistry,
      zkAuthRegistry: zkAuthRegistryAddress,
      verifier: verifierAddresses.verifier,
      verifierAdapter: verifierAddresses.adapter,
      admin: deployer.address,
      network: "hardhat-local",
      timestamp: Date.now(),
      config,
    };

    // ============================================
    // Print Summary
    // ============================================
    printDeploymentSummary(result);

    // ============================================
    // Save Deployment Result
    // ============================================
    const deploymentsDir = path.join(__dirname, "..", "deployments");
    if (!fs.existsSync(deploymentsDir)) {
      fs.mkdirSync(deploymentsDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = path.join(
      deploymentsDir,
      `hardhat-${config.verifier}-${timestamp}.json`
    );

    fs.writeFileSync(
      filename,
      JSON.stringify(
        {
          ...result,
          timestamp: new Date(result.timestamp).toISOString(),
        },
        null,
        2
      )
    );

    console.log(`\n💾 Deployment result saved to: ${filename}\n`);

    // ============================================
    // Auto-update frontend/.env.local
    // ============================================
    const envLocalPath = path.join(__dirname, "..", "..", "frontend", ".env.local");
    
    console.log('📝 Updating frontend/.env.local...');
    
    let envContent = `VITE_INSTITUTION_REGISTRY_ADDRESS=${result.institutionRegistry}
VITE_CERTIFICATE_REGISTRY_ADDRESS=${result.certificateRegistry}
VITE_EMPLOYER_REGISTRY_ADDRESS=${result.employerRegistry}
VITE_ZK_AUTH_REGISTRY_ADDRESS=${result.zkAuthRegistry}
VITE_VERIFIER_ADAPTER_ADDRESS=${result.verifierAdapter}
VITE_ENVIRONMENT=${result.config.environment}
`;

    // Add network-specific variables for local development
    if (config.network === 'hardhat' || result.network.includes('local')) {
      envContent += `VITE_CHAIN_ID=1337
VITE_RPC_URL=http://127.0.0.1:8545
VITE_DEBUG=true
`;
    }

    try {
      fs.writeFileSync(envLocalPath, envContent);
      console.log(`✅ Updated: ${envLocalPath}\n`);
    } catch (error) {
      console.log(`⚠️  Could not auto-update .env.local: ${error}`);
      console.log('   Please copy the values manually from above.\n');
    }

    return result;
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
