// src/hooks/useBatchCertificateIssuance.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useMemo, useCallback, useEffect, useRef, useState } from 'react';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import { decodeContractError } from '@/lib/errorDecoding';
import { logger } from '@/lib/logger';

export interface BatchCertificateData {
  documentHash: `0x${string}`;
  studentWallet: `0x${string}`;
  metadataURI: string;
  graduationYear: number; // Required: Year of graduation (1900-2100)
}

export interface UseBatchCertificateIssuanceReturn {
  issueCertificatesBatch: (certificates: BatchCertificateData[]) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  transactionPhase: 'idle' | 'awaiting_wallet_confirmation' | 'pending_onchain' | 'confirmed' | 'failed';
  error: string | null;
  transactionHash?: `0x${string}`;
  certificateIds: bigint[];
  reset: () => void;
}

const MIN_PENDING_DISPLAY_MS = 1200;

/**
 * Hook for batch certificate issuance
 * Issues multiple certificates in a single transaction
 * 
 * @returns {UseBatchCertificateIssuanceReturn} Batch issuance functions and state
 * 
 * @example
 * ```typescript
 * const { issueCertificatesBatch, isPending, isSuccess, error, certificateIds } = useBatchCertificateIssuance();
 * 
 * const handleBatchIssue = async () => {
 *   const certs = [
 *     { documentHash: '0x...', studentWallet: '0x...', metadataURI: '', graduationYear: 2024 },
 *     { documentHash: '0x...', studentWallet: '0x...', metadataURI: '', graduationYear: 2023 },
 *   ];
 *   await issueCertificatesBatch(certs);
 * };
 * ```
 */
export function useBatchCertificateIssuance(): UseBatchCertificateIssuanceReturn {
  const { 
    data: hash, 
    writeContractAsync,
    isPending: isWritePending,
    error: writeError,
    reset: resetWrite
  } = useWriteContract();

  const { 
    isSuccess: isReceiptConfirmed,
    data: receipt,
    error: confirmError
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
   * Issue multiple certificates in a single transaction
   */
  const issueCertificatesBatch = useCallback(async (certificates: BatchCertificateData[]) => {
    if (certificates.length === 0) {
      logger.warn('useBatchCertificateIssuance: Attempted to issue empty batch');
      throw new Error('Cannot issue empty batch of certificates');
    }

    // Validate batch size (1-100)
    if (certificates.length > 100) {
      throw new Error('Batch size must be between 1 and 100 certificates');
    }

    // Validate all graduation years
    for (const cert of certificates) {
      if (!cert.graduationYear || !Number.isInteger(cert.graduationYear)) {
        throw new Error('All certificates must have a valid graduation year');
      }
      if (cert.graduationYear < 1900 || cert.graduationYear > 2100) {
        throw new Error(`Invalid graduation year: ${cert.graduationYear}. Must be between 1900 and 2100`);
      }
    }

    if (!CERTIFICATE_REGISTRY_ADDRESS) {
      throw new Error('Certificate Registry address not configured');
    }

    logger.info('useBatchCertificateIssuance: Issuing batch', {
      count: certificates.length,
    });

    const documentHashes = certificates.map(c => c.documentHash);
    const studentWallets = certificates.map(c => c.studentWallet);
    const metadataURIs = certificates.map(c => c.metadataURI || '');
    const graduationYears = certificates.map(c => c.graduationYear);

    await writeContractAsync({
      address: CERTIFICATE_REGISTRY_ADDRESS as `0x${string}`,
      abi: CertificateRegistryABI.abi,
      functionName: 'issueCertificatesBatch',
      args: [documentHashes, studentWallets, metadataURIs, graduationYears],
    });
  }, [writeContractAsync]);

  /**
   * Extract certificate IDs from transaction receipt
   */
  const certificateIds = useMemo(() => {
    if (!receipt?.logs) return [];
    
    try {
      const certIds: bigint[] = [];
      
      // Parse logs to extract certificateIds
      // Each CertificateIssued event will have a certificateId
      receipt.logs.forEach((log) => {
        try {
          // The first indexed parameter is certificateId
          if (log.topics && log.topics.length > 1 && log.topics[1]) {
            const certId = BigInt(log.topics[1]);
            certIds.push(certId);
          }
        } catch (err) {
          // Skip logs that can't be parsed
        }
      });
      
      return certIds;
    } catch (err) {
      logger.error('useBatchCertificateIssuance: Error extracting certificate IDs', err);
      return [];
    }
  }, [receipt]);

  /**
   * Combine and decode errors
   */
  const error = useMemo(() => {
    const rawError = writeError || confirmError;
    if (!rawError) return null;
    
    const decodedError = decodeContractError(rawError);
    logger.error('useBatchCertificateIssuance: Error occurred', {
      rawError,
      decodedError,
    });
    
    return decodedError;
  }, [writeError, confirmError]);

  const reset = useCallback(() => {
    setTransactionPhase('idle');
    pendingStartRef.current = null;
    resetWrite();
  }, [resetWrite]);

  return {
    issueCertificatesBatch,
    isPending: transactionPhase === 'awaiting_wallet_confirmation',
    isConfirming: transactionPhase === 'pending_onchain',
    isSuccess: transactionPhase === 'confirmed',
    transactionPhase,
    error,
    transactionHash: hash,
    certificateIds,
    reset,
  };
}

/**
 * Hook for batch certificate issuance with success/error callbacks
 * 
 * @param onSuccess Callback when batch issuance succeeds
 * @param onError Callback when batch issuance fails
 * @returns {UseBatchCertificateIssuanceReturn} Batch issuance functions and state
 */
export function useBatchCertificateIssuanceWithCallback(
  onSuccess?: (transactionHash: `0x${string}`, certificateIds: bigint[]) => void,
  onError?: (error: Error) => void
): UseBatchCertificateIssuanceReturn {
  const batchIssuance = useBatchCertificateIssuance();

  // Call onSuccess when successful
  useMemo(() => {
    if (batchIssuance.isSuccess && batchIssuance.transactionHash && onSuccess) {
      onSuccess(batchIssuance.transactionHash, batchIssuance.certificateIds);
    }
  }, [batchIssuance.isSuccess, batchIssuance.transactionHash, batchIssuance.certificateIds, onSuccess]);

  // Call onError when failed
  useMemo(() => {
    if (batchIssuance.error && onError) {
      onError(new Error(batchIssuance.error));
    }
  }, [batchIssuance.error, onError]);

  return batchIssuance;
}

