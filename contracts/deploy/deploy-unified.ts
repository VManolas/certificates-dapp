// contracts/deploy/deploy-unified.ts
/**
 * Unified zkSync Deployment Script
 * =================================
 * 
 * Single deployment script for zkSync networks (local, testnet, mainnet).
 * Replaces: deploy-local.ts, deploy.ts, deploy-local-hardhat.ts
 * 
 * Features:
 * - Configurable environments (staging, production)
 * - UUPS proxy pattern with zkSync-specific deployment
 * - Complete contract linking
 * - Production-grade verifier deployment
 * 
 * Usage:
 *   # Staging (zkSync Sepolia testnet)
 *   npm run deploy:staging
 * 
 *   # Production (zkSync Era mainnet)
 *   npm run deploy:production
 * 
 *   # Local zkSync node (for testing)
 *   npm run deploy:local
 */

import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, Provider } from "zksync-ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import {
  getDeploymentConfig,
  validateDeploymentConfig,
  printDeploymentConfig,
  DeploymentEnvironment,
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

dotenv.config();

/**
 * zkSync-specific contract deployer implementation
 */
class ZkSyncContractDeployer implements ContractDeployer {
  constructor(
    private deployer: Deployer,
    private hre: HardhatRuntimeEnvironment,
    private wallet: Wallet
  ) {}

  async deployProxy(
    contractName: string,
    initArgs: any[],
    options?: any
  ): Promise<{ address: string; contract: any }> {
    const artifact = await this.deployer.loadArtifact(contractName);

    const contract = await this.hre.zkUpgrades.deployProxy(
      this.wallet,
      artifact,
      initArgs,
      { initializer: "initialize", ...options }
    );

    await contract.waitForDeployment();
    const address = await contract.getAddress();
    return { address, contract };
  }

  async deployContract(
    contractName: string,
    constructorArgs: any[] = []
  ): Promise<{ address: string; contract: any }> {
    const artifact = await this.deployer.loadArtifact(contractName);
    const contract = await this.deployer.deploy(artifact, constructorArgs);
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    return { address, contract };
  }

  async getSignerAddress(): Promise<string> {
    return this.wallet.address;
  }
}

/**
 * Determine deployment environment based on network
 */
function getEnvironmentFromNetwork(
  networkName: string
): DeploymentEnvironment {
  if (networkName.includes("mainnet") || networkName.includes("Mainnet")) {
    return "production";
  } else if (
    networkName.includes("sepolia") ||
    networkName.includes("Sepolia") ||
    networkName.includes("testnet") ||
    networkName.includes("Testnet")
  ) {
    return "staging";
  } else {
    return "development";
  }
}

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log(
    "\n🚀 Starting zkCredentials Unified Deployment (zkSync)...\n"
  );

  // Initialize provider and wallet
  const provider = new Provider(hre.network.config.url);

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in environment");
  }

  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const deployer = new Deployer(hre, wallet);

  // Get deployment configuration based on network
  const environment = getEnvironmentFromNetwork(hre.network.name);
  const config = getDeploymentConfig(environment);

  // Override network in config to match actual network
  config.network = hre.network.name as any;

  validateDeploymentConfig(config);
  printDeploymentConfig(config);

  console.log(`📍 Deploying with wallet: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`💰 Wallet balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  // Create deployer instance
  const contractDeployer = new ZkSyncContractDeployer(deployer, hre, wallet);

  try {
    // ============================================
    // STEP 1-3: Deploy Core Contracts
    // ============================================
    const coreContracts = await deployCoreContracts(
      contractDeployer,
      wallet.address
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
    const institutionRegistryArtifact = await deployer.loadArtifact(
      "InstitutionRegistry"
    );
    const institutionRegistry = new hre.ethers.Contract(
      coreContracts.institutionRegistry,
      institutionRegistryArtifact.abi,
      wallet
    );

    const employerRegistryArtifact = await deployer.loadArtifact(
      "EmployerRegistry"
    );
    const employerRegistry = new hre.ethers.Contract(
      coreContracts.employerRegistry,
      employerRegistryArtifact.abi,
      wallet
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
      wallet.address,
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
      admin: wallet.address,
      network: hre.network.name,
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
      `zksync-${hre.network.name}-${timestamp}.json`
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

    return result;
  } catch (error) {
    console.error("\n❌ Deployment failed:", error);
    throw error;
  }
}
