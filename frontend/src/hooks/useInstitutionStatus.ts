// src/hooks/useInstitutionStatus.ts
import { useReadContract } from 'wagmi';
import { useAccount } from 'wagmi';
import { INSTITUTION_REGISTRY_ADDRESS } from '@/lib/wagmi';
import InstitutionRegistryABI from '@/contracts/abis/InstitutionRegistry.json';
import type { Institution } from '@/types';

export interface InstitutionStatus {
  /** Whether the institution is registered */
  isRegistered: boolean;
  /** Whether the institution is verified by admin */
  isVerified: boolean;
  /** Whether the institution is active (not suspended) */
  isActive: boolean;
  /** Whether the institution can issue certificates (verified AND active) */
  canIssue: boolean;
  /** Loading state */
  isLoading: boolean;
  /** Error state */
  error: Error | null;
  /** Full institution data */
  institutionData: Institution | null;
  /** Refetch function */
  refetch: () => void;
}

/**
 * Hook to check real-time institution status from blockchain
 * 
 * This hook fetches the current status directly from the smart contract,
 * ensuring that suspended institutions cannot bypass authorization checks
 * using stale cached data.
 * 
 * @param address - Optional wallet address to check (defaults to connected wallet)
 * @param enabled - Whether to enable the query (default: true)
 * @param refetchInterval - Auto-refetch interval in ms (default: 10000ms = 10s)
 * 
 * @example
 * ```tsx
 * const { canIssue, isActive, isVerified, isLoading } = useInstitutionStatus();
 * 
 * if (!canIssue) {
 *   return <Alert>Your institution cannot issue certificates</Alert>;
 * }
 * ```
 */
export function useInstitutionStatus(
  address?: `0x${string}`,
  enabled: boolean = true,
  refetchInterval?: number
): InstitutionStatus {
  const { address: connectedAddress } = useAccount();
  const targetAddress = address || connectedAddress;

  // Fetch institution data directly from contract
  const {
    data: institutionData,
    isLoading,
    error,
    refetch,
  } = useReadContract({
    address: INSTITUTION_REGISTRY_ADDRESS!,
    abi: InstitutionRegistryABI.abi,
    functionName: 'getInstitution',
    args: targetAddress ? [targetAddress] : undefined,
    query: {
      enabled: !!targetAddress && !!INSTITUTION_REGISTRY_ADDRESS && enabled,
      // Refetch on window focus to catch status changes
      refetchOnWindowFocus: true,
      // Always refetch on mount
      refetchOnMount: 'always',
      // Consider data stale immediately to ensure fresh checks
      staleTime: 0,
      // Auto-refetch interval (default 10 seconds if not specified)
      refetchInterval: refetchInterval !== undefined ? refetchInterval : 10000,
    },
  });

  const institution = institutionData as Institution | undefined;

  // Parse institution status
  const isRegistered =
    !!institution &&
    institution.walletAddress !== '0x0000000000000000000000000000000000000000' &&
    institution.name !== '';

  const isVerified = isRegistered && institution.isVerified === true;
  const isActive = isRegistered && institution.isActive === true;
  const canIssue = isVerified && isActive;

  return {
    isRegistered,
    isVerified,
    isActive,
    canIssue,
    isLoading,
    error: error as Error | null,
    institutionData: institution || null,
    refetch,
  };
}

/**
 * Hook to check if connected wallet can issue certificates RIGHT NOW
 * 
 * Simplified version that returns a boolean and loading state.
 * Useful for quick authorization checks in UI components.
 * 
 * @example
 * ```tsx
 * const { canIssue, isLoading, reason } = useCanIssueCertificates();
 * 
 * if (isLoading) return <Spinner />;
 * if (!canIssue) return <Alert>{reason}</Alert>;
 * ```
 */
export function useCanIssueCertificates() {
  const status = useInstitutionStatus();

  let reason = '';
  if (!status.isRegistered) {
    reason = 'Your institution is not registered. Please register first.';
  } else if (!status.isVerified) {
    reason = 'Your institution is pending verification. Please wait for admin approval.';
  } else if (!status.isActive) {
    reason = 'Your institution has been suspended. Please contact an administrator.';
  }

  return {
    canIssue: status.canIssue,
    isLoading: status.isLoading,
    isVerified: status.isVerified,
    isActive: status.isActive,
    reason,
    refetch: status.refetch,
  };
}

