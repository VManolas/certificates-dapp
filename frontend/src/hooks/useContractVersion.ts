import { useReadContract } from 'wagmi';
import { CERTIFICATE_REGISTRY_ADDRESS, INSTITUTION_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import InstitutionRegistryABI from '@/contracts/abis/InstitutionRegistry.json';

/**
 * Expected contract versions
 * Update these when the frontend requires a specific contract version
 */
const EXPECTED_VERSIONS = {
  certificateRegistry: '1.0.0',
  institutionRegistry: '1.0.0',
} as const;

interface UpgradeInfo {
  version: string;
  timestamp: bigint;
  upgrader: string;
  notes: string;
}

interface VersionInfo {
  currentVersion: string | undefined;
  expectedVersion: string;
  isCompatible: boolean;
  needsUpgrade: boolean;
  isLoading: boolean;
  error: Error | null;
}

interface UpgradeHistoryResult {
  history: UpgradeInfo[] | undefined;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to check CertificateRegistry contract version
 * @returns Version information and compatibility status
 */
export function useCertificateRegistryVersion(): VersionInfo {
  const { data: version, isLoading, error } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'VERSION',
    query: {
      enabled: !!CERTIFICATE_REGISTRY_ADDRESS,
    },
  });

  const currentVersion = version as string | undefined;
  const expectedVersion = EXPECTED_VERSIONS.certificateRegistry;
  const isCompatible = currentVersion === expectedVersion;
  const needsUpgrade = !!currentVersion && currentVersion !== expectedVersion;

  return {
    currentVersion,
    expectedVersion,
    isCompatible,
    needsUpgrade,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to check InstitutionRegistry contract version
 * @returns Version information and compatibility status
 */
export function useInstitutionRegistryVersion(): VersionInfo {
  const { data: version, isLoading, error } = useReadContract({
    address: INSTITUTION_REGISTRY_ADDRESS,
    abi: InstitutionRegistryABI.abi,
    functionName: 'VERSION',
    query: {
      enabled: !!INSTITUTION_REGISTRY_ADDRESS,
    },
  });

  const currentVersion = version as string | undefined;
  const expectedVersion = EXPECTED_VERSIONS.institutionRegistry;
  const isCompatible = currentVersion === expectedVersion;
  const needsUpgrade = !!currentVersion && currentVersion !== expectedVersion;

  return {
    currentVersion,
    expectedVersion,
    isCompatible,
    needsUpgrade,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get upgrade history for CertificateRegistry
 * @returns Upgrade history with loading and error states
 */
export function useCertificateRegistryUpgradeHistory(): UpgradeHistoryResult {
  const { data, isLoading, error } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getUpgradeHistory',
    query: {
      enabled: !!CERTIFICATE_REGISTRY_ADDRESS,
    },
  });

  return {
    history: data as UpgradeInfo[] | undefined,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Hook to get upgrade history for InstitutionRegistry
 * @returns Upgrade history with loading and error states
 */
export function useInstitutionRegistryUpgradeHistory(): UpgradeHistoryResult {
  const { data, isLoading, error } = useReadContract({
    address: INSTITUTION_REGISTRY_ADDRESS,
    abi: InstitutionRegistryABI.abi,
    functionName: 'getUpgradeHistory',
    query: {
      enabled: !!INSTITUTION_REGISTRY_ADDRESS,
    },
  });

  return {
    history: data as UpgradeInfo[] | undefined,
    isLoading,
    error: error as Error | null,
  };
}

/**
 * Combined hook to check all contract versions
 * @returns Combined version information for all contracts
 */
export function useContractVersions() {
  const certificateRegistry = useCertificateRegistryVersion();
  const institutionRegistry = useInstitutionRegistryVersion();

  const allCompatible = certificateRegistry.isCompatible && institutionRegistry.isCompatible;
  const anyNeedsUpgrade = certificateRegistry.needsUpgrade || institutionRegistry.needsUpgrade;
  const isLoading = certificateRegistry.isLoading || institutionRegistry.isLoading;
  const hasError = !!certificateRegistry.error || !!institutionRegistry.error;

  return {
    certificateRegistry,
    institutionRegistry,
    allCompatible,
    anyNeedsUpgrade,
    isLoading,
    hasError,
  };
}
