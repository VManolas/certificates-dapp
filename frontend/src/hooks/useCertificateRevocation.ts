// src/hooks/useCertificateRevocation.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useEffect, useRef, useState } from 'react';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import { logger } from '@/lib/logger';

export interface UseCertificateRevocationReturn {
  revokeCertificate: (certificateId: bigint, reason: string) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
  isSuccess: boolean;
  transactionPhase: 'idle' | 'awaiting_wallet_confirmation' | 'pending_onchain' | 'confirmed' | 'failed';
  error: Error | null;
  hash: `0x${string}` | undefined;
  transactionHash: `0x${string}` | undefined;
  reset: () => void;
}

const MIN_PENDING_DISPLAY_MS = 1200;

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
    writeContractAsync,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();

  // Transaction confirmation hook
  const {
    isSuccess: isReceiptConfirmed,
    error: confirmError,
  } = useWaitForTransactionReceipt({
    hash,
  });

  const [transactionPhase, setTransactionPhase] = useState<
    'idle' | 'awaiting_wallet_confirmation' | 'pending_onchain' | 'confirmed' | 'failed'
  >('idle');
  const pendingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (writeError || confirmError) {
      setTransactionPhase('failed');
      return;
    }

    if (isWritePending && !hash) {
      setTransactionPhase('awaiting_wallet_confirmation');
      pendingStartRef.current = null;
      return;
    }

    if (hash && !isReceiptConfirmed) {
      if (pendingStartRef.current === null) {
        pendingStartRef.current = Date.now();
      }
      setTransactionPhase('pending_onchain');
      return;
    }

    if (isReceiptConfirmed && hash) {
      const pendingSince = pendingStartRef.current ?? Date.now();
      const elapsed = Date.now() - pendingSince;
      const waitRemaining = Math.max(0, MIN_PENDING_DISPLAY_MS - elapsed);
      const timer = setTimeout(() => setTransactionPhase('confirmed'), waitRemaining);
      return () => clearTimeout(timer);
    }

    setTransactionPhase('idle');
    pendingStartRef.current = null;
  }, [isWritePending, hash, isReceiptConfirmed, writeError, confirmError]);

  /**
   * Revoke a certificate with a reason
   * @param certificateId - The ID of the certificate to revoke
   * @param reason - The reason for revocation (required for audit trail)
   */
  const revokeCertificate = async (certificateId: bigint, reason: string) => {
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

    await writeContractAsync({
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
    setTransactionPhase('idle');
    pendingStartRef.current = null;
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
    isPending: transactionPhase === 'awaiting_wallet_confirmation',
    isConfirming: transactionPhase === 'pending_onchain',
    isConfirmed: transactionPhase === 'confirmed',
    isSuccess: transactionPhase === 'confirmed',
    transactionPhase,
    error,
    hash,
    transactionHash: hash,
    reset,
  };
}
