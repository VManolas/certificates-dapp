// contracts/config/deployment.config.ts
/**
 * Deployment Configuration System
 * ================================
 * 
 * Centralized configuration for all deployment scenarios.
 * Supports multiple environments, networks, and verifier types.
 * 
 * Usage:
 *   import { getDeploymentConfig } from './config/deployment.config';
 *   const config = getDeploymentConfig('development');
 */

export type DeploymentEnvironment = 'development' | 'staging' | 'production';
export type NetworkType = 'hardhat' | 'zksync-local' | 'zksync-sepolia' | 'zksync-mainnet';
export type VerifierType = 'mock' | 'ultraplonk' | 'groth16';

export interface DeploymentConfig {
  environment: DeploymentEnvironment;
  network: NetworkType;
  verifier: VerifierType;
  gasLimit: number;
  skipVerification?: boolean;
  description: string;
}

/**
 * Deployment configurations for different environments
 */
export const deploymentConfigs: Record<DeploymentEnvironment, DeploymentConfig> = {
  development: {
    environment: 'development',
    network: 'hardhat',
    verifier: 'groth16',
    gasLimit: 30000000,
    skipVerification: true,
    description: 'Local Hardhat development with Groth16 verifier',
  },
  staging: {
    environment: 'staging',
    network: 'zksync-sepolia',
    verifier: 'groth16',
    gasLimit: 50000000,
    skipVerification: false,
    description: 'zkSync Sepolia testnet with Groth16 verifier',
  },
  production: {
    environment: 'production',
    network: 'zksync-mainnet',
    verifier: 'groth16',
    gasLimit: 50000000,
    skipVerification: false,
    description: 'zkSync Era mainnet with Groth16 verifier',
  },
};

/**
 * Get deployment configuration for specified environment
 * @param env Environment name or override via DEPLOYMENT_ENV
 * @returns Deployment configuration object
 */
export function getDeploymentConfig(
  env: DeploymentEnvironment = 'development'
): DeploymentConfig {
  // Allow environment variable override
  const envOverride = process.env.DEPLOYMENT_ENV as DeploymentEnvironment;
  const environment = envOverride || env;
  
  const config = deploymentConfigs[environment];
  
  if (!config) {
    throw new Error(
      `Invalid deployment environment: ${environment}. Valid options: ${Object.keys(deploymentConfigs).join(', ')}`
    );
  }
  
  // Allow verifier type override via environment variable
  const verifierOverride = process.env.VERIFIER_TYPE as VerifierType;
  if (verifierOverride) {
    if (verifierOverride !== 'mock' && verifierOverride !== 'ultraplonk' && verifierOverride !== 'groth16') {
      throw new Error(`Invalid VERIFIER_TYPE: ${verifierOverride}. Valid options: mock, groth16, ultraplonk`);
    }

    return {
      ...config,
      verifier: verifierOverride,
    };
  }
  
  return config;
}

/**
 * Validate deployment configuration
 * @param config Deployment configuration to validate
 * @throws Error if configuration is invalid
 */
export function validateDeploymentConfig(config: DeploymentConfig): void {
  // Production checks
  if (config.environment === 'production') {
    if (config.verifier !== 'groth16' && config.verifier !== 'ultraplonk') {
      throw new Error('Production deployments must use groth16 or ultraplonk verifier');
    }
    if (config.skipVerification) {
      throw new Error('Production deployments must enable contract verification');
    }
  }
  
  // Network-verifier compatibility
  if (config.network.startsWith('zksync') && config.verifier === 'mock') {
    console.warn(
      '⚠️  WARNING: Using mock verifier on zkSync network. ' +
      'This is only recommended for testing. Use VERIFIER_TYPE=ultraplonk for production-grade security.'
    );
  }
}

/**
 * Print deployment configuration summary
 * @param config Deployment configuration
 */
export function printDeploymentConfig(config: DeploymentConfig): void {
  console.log('\n' + '═'.repeat(60));
  console.log('DEPLOYMENT CONFIGURATION');
  console.log('═'.repeat(60));
  console.log(`Environment:    ${config.environment.toUpperCase()}`);
  console.log(`Network:        ${config.network}`);
  const verifierLabel = config.verifier === 'mock' ? '⚠️ (Development Only)' : '✅ (Production-Grade)';
  console.log(`Verifier Type:  ${config.verifier.toUpperCase()} ${verifierLabel}`);
  console.log(`Gas Limit:      ${config.gasLimit.toLocaleString()}`);
  console.log(`Block Explorer: ${config.skipVerification ? 'Verification Disabled (local network)' : 'Verification Enabled'}`);
  console.log(`Description:    ${config.description}`);
  console.log('═'.repeat(60) + '\n');
}
