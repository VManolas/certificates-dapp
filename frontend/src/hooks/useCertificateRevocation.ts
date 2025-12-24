// src/hooks/useCertificateRevocation.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import { logger } from '@/lib/logger';

export interface UseCertificateRevocationReturn {
  revokeCertificate: (certificateId: bigint, reason: string) => void;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  isSuccess: boolean;
  error: Error | null;
  hash: `0x${string}` | undefined;
  transactionHash: `0x${string}` | undefined;
  reset: () => void;
}

/**
 * Hook to revoke a certificate (institution only)
 * 
 * Only the issuing institution can revoke their own certificates.
 * Revocation is permanent and recorded on-chain with a reason.
 * 
 * @example
 * ```tsx
 * const { revokeCertificate, isPending, isSuccess, error } = useCertificateRevocation();
 * 
 * const handleRevoke = () => {
 *   revokeCertificate(123n, 'Student expelled for misconduct');
 * };
 * 
 * if (isSuccess) {
 *   toast.success('Certificate revoked successfully');
 * }
 * ```
 */
export function useCertificateRevocation(): UseCertificateRevocationReturn {
  // Contract write hook
  const {
    data: hash,
    writeContract,
    isPending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  // Transaction confirmation hook
  const {
    isLoading: isConfirming,
    isSuccess,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Revoke a certificate with a reason
   * @param certificateId - The ID of the certificate to revoke
   * @param reason - The reason for revocation (required for audit trail)
   */
  const revokeCertificate = (certificateId: bigint, reason: string) => {
    if (!CERTIFICATE_REGISTRY_ADDRESS) {
      throw new Error('Certificate registry address not configured');
    }

    if (certificateId < 1n) {
      throw new Error('Invalid certificate ID');
    }

    if (!reason || reason.trim().length === 0) {
      throw new Error('Revocation reason is required');
    }

    if (reason.length > 500) {
      throw new Error('Revocation reason must be less than 500 characters');
    }

    logger.contract('Revoking certificate', CERTIFICATE_REGISTRY_ADDRESS, {
      certificateId: certificateId.toString(),
      reason,
    });

    writeContract({
      address: CERTIFICATE_REGISTRY_ADDRESS,
      abi: CertificateRegistryABI.abi as readonly unknown[],
      functionName: 'revokeCertificate',
      args: [certificateId, reason],
    });
  };

  /**
   * Reset the hook state
   * Clears transaction state to allow new revocation attempts
   */
  const reset = () => {
    resetWrite();
  };

  // Combine and normalize errors
  const error = writeError
    ? writeError instanceof Error
      ? writeError
      : new Error(String(writeError))
    : confirmError
    ? confirmError instanceof Error
      ? confirmError
      : new Error(String(confirmError))
    : null;

  return {
    revokeCertificate,
    isPending,
    isConfirming,
    isConfirmed: isSuccess,
    isSuccess,
    error,
    hash,
    transactionHash: hash,
    reset,
  };
}
