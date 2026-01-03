// src/hooks/useBatchCertificateIssuance.ts
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';
import { useMemo, useCallback } from 'react';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import { decodeContractError } from '@/lib/errorDecoding';
import { logger } from '@/lib/logger';

export interface BatchCertificateData {
  documentHash: `0x${string}`;
  studentWallet: `0x${string}`;
  metadataURI: string;
}

export interface UseBatchCertificateIssuanceReturn {
  issueCertificatesBatch: (certificates: BatchCertificateData[]) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: string | null;
  transactionHash?: `0x${string}`;
  certificateIds: bigint[];
  reset: () => void;
}

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
 *     { documentHash: '0x...', studentWallet: '0x...', metadataURI: '' },
 *     { documentHash: '0x...', studentWallet: '0x...', metadataURI: '' },
 *   ];
 *   await issueCertificatesBatch(certs);
 * };
 * ```
 */
export function useBatchCertificateIssuance(): UseBatchCertificateIssuanceReturn {
  const { 
    data: hash, 
    writeContract, 
    isPending, 
    error: writeError,
    reset: resetWrite
  } = useWriteContract();

  const { 
    isLoading: isConfirming, 
    isSuccess,
    data: receipt,
    error: confirmError
  } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Issue multiple certificates in a single transaction
   */
  const issueCertificatesBatch = useCallback(async (certificates: BatchCertificateData[]) => {
    if (certificates.length === 0) {
      logger.warn('useBatchCertificateIssuance: Attempted to issue empty batch');
      throw new Error('Cannot issue empty batch of certificates');
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

    writeContract({
      address: CERTIFICATE_REGISTRY_ADDRESS as `0x${string}`,
      abi: CertificateRegistryABI.abi,
      functionName: 'issueCertificatesBatch',
      args: [documentHashes, studentWallets, metadataURIs],
    });
  }, [writeContract]);

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
    resetWrite();
  }, [resetWrite]);

  return {
    issueCertificatesBatch,
    isPending,
    isConfirming,
    isSuccess,
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

