// contracts/deploy/upgrade-all-registries.ts
/**
 * Upgrade All Registry Implementations (zkSync)
 * ==============================================
 *
 * Upgrades InstitutionRegistry, CertificateRegistry, and EmployerRegistry
 * to their current implementations via UUPS proxy upgrade.
 *
 * This is a "no-op" upgrade when the source hasn't changed — it simply
 * redeploys the implementation to get a verifiable bytecode on-chain.
 * For EmployerRegistry, this deploys the custom-errors migration.
 *
 * Prerequisites:
 *   1. DEPLOYER_PRIVATE_KEY in .env (must hold ADMIN_ROLE on all proxies)
 *   2. Sepolia ETH in the deployer wallet
 *
 * Usage:
 *   npx hardhat deploy-zksync --script deploy/upgrade-all-registries.ts --network zkSyncSepoliaTestnet
 */

import { Deployer } from "@matterlabs/hardhat-zksync-deploy";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { Wallet, Provider } from "zksync-ethers";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

interface RegistryInfo {
  name: string;
  contractPath: string;
  proxyAddress: string;
}

function findLatestDeployment(network: string): Record<string, string> | null {
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) return null;

  const files = fs.readdirSync(deploymentsDir)
    .filter(f => f.startsWith(`zksync-${network}-`) && f.endsWith(".json"))
    .sort()
    .reverse();

  if (files.length === 0) return null;

  return JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, files[0]), "utf-8")
  );
}

export default async function (hre: HardhatRuntimeEnvironment) {
  console.log("=".repeat(60));
  console.log("Upgrade All Registry Implementations");
  console.log("=".repeat(60));

  if (!process.env.DEPLOYER_PRIVATE_KEY) {
    throw new Error("DEPLOYER_PRIVATE_KEY not set in .env");
  }

  const provider = new Provider(hre.network.config.url);
  const wallet = new Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  const deployer = new Deployer(hre, wallet);

  console.log(`\nNetwork:  ${hre.network.name}`);
  console.log(`Deployer: ${wallet.address}`);

  const balance = await provider.getBalance(wallet.address);
  console.log(`Balance:  ${hre.ethers.formatEther(balance)} ETH\n`);

  if (balance === 0n) {
    throw new Error("Deployer wallet has zero balance");
  }

  const deployment = findLatestDeployment(hre.network.name);
  if (!deployment) {
    throw new Error("No deployment found for " + hre.network.name);
  }

  const registries: RegistryInfo[] = [
    {
      name: "InstitutionRegistry",
      contractPath: "contracts/InstitutionRegistry.sol:InstitutionRegistry",
      proxyAddress: deployment.institutionRegistry,
    },
    {
      name: "CertificateRegistry",
      contractPath: "contracts/CertificateRegistry.sol:CertificateRegistry",
      proxyAddress: deployment.certificateRegistry,
    },
    {
      name: "EmployerRegistry",
      contractPath: "contracts/EmployerRegistry.sol:EmployerRegistry",
      proxyAddress: deployment.employerRegistry,
    },
  ];

  const results: { name: string; proxy: string; impl: string }[] = [];

  for (const reg of registries) {
    console.log(`${"─".repeat(60)}`);
    console.log(`Upgrading ${reg.name}...`);
    console.log(`  Proxy: ${reg.proxyAddress}`);
    console.log(`${"─".repeat(60)}`);

    try {
      const artifact = await deployer.loadArtifact(reg.contractPath);

      const upgraded = await hre.zkUpgrades.upgradeProxy(
        deployer.zkWallet,
        reg.proxyAddress,
        artifact
      );

      await upgraded.waitForDeployment();
      const implAddress = await upgraded.getAddress();

      console.log(`  ✅ ${reg.name} upgraded`);
      console.log(`     New impl: ${implAddress}\n`);

      results.push({ name: reg.name, proxy: reg.proxyAddress, impl: implAddress });
    } catch (err: any) {
      console.error(`  ❌ ${reg.name} upgrade failed: ${err.message}\n`);
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("Upgrade Summary");
  console.log("=".repeat(60));
  for (const r of results) {
    console.log(`  ${r.name}:`);
    console.log(`    Proxy: ${r.proxy}`);
    console.log(`    Impl:  ${r.impl}`);
  }
  console.log("=".repeat(60));
  console.log("\nNext steps:");
  console.log("  Run verification for each proxy:");
  for (const r of results) {
    console.log(`    npx hardhat verify --network ${hre.network.name} ${r.proxy}`);
  }
  console.log("=".repeat(60) + "\n");
}
