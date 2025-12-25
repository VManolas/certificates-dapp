import { useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { decodeEventLog } from 'viem';
import { useMemo, useEffect, useRef } from 'react';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';

/**
 * Parameters for issuing a certificate
 */
export interface IssueCertificateParams {
  documentHash: `0x${string}`;
  studentWallet: `0x${string}`;
  metadataURI?: string;
}

/**
 * Return type for the certificate issuance hook
 */
export interface UseCertificateIssuanceReturn {
  issueCertificate: (params: IssueCertificateParams) => Promise<void>;
  isPending: boolean;
  isConfirming: boolean;
  isSuccess: boolean;
  error: Error | null;
  transactionHash: `0x${string}` | undefined;
  certificateId: bigint | undefined;
  reset: () => void;
}

/**
 * Hook to issue certificates on the blockchain
 * 
 * Includes pre-issuance duplicate check for better UX.
 * 
 * @example
 * ```tsx
 * const { issueCertificate, isPending, isConfirming, isSuccess, error, transactionHash } = useCertificateIssuance();
 * 
 * const handleIssue = () => {
 *   issueCertificate({
 *     documentHash: '0x123...',
 *     studentWallet: '0xabc...',
 *     metadataURI: 'ipfs://...' // optional
 *   });
 * };
 * ```
 */
export function useCertificateIssuance(): UseCertificateIssuanceReturn {
  // Contract write hook
  const { 
    data: hash, 
    writeContract, 
    isPending, 
    error: writeError,
    reset: resetWrite
  } = useWriteContract();

  // Transaction confirmation hook
  const { 
    isLoading: isConfirming, 
    isSuccess,
    data: receipt,
    error: confirmError
  } = useWaitForTransactionReceipt({
    hash,
  });

  /**
   * Issue a certificate to a student
   * @param params - Certificate issuance parameters
   */
  const issueCertificate = async (params: IssueCertificateParams) => {
    const { documentHash, studentWallet, metadataURI = '' } = params;

    // Validate inputs
    if (!documentHash || documentHash === '0x0000000000000000000000000000000000000000000000000000000000000000') {
      throw new Error('Valid document hash is required');
    }

    if (!studentWallet || studentWallet === '0x0000000000000000000000000000000000000000') {
      throw new Error('Valid student wallet address is required');
    }

    if (!CERTIFICATE_REGISTRY_ADDRESS) {
      throw new Error('Certificate registry address not configured');
    }

    writeContract({
      address: CERTIFICATE_REGISTRY_ADDRESS,
      abi: CertificateRegistryABI.abi,
      functionName: 'issueCertificate',
      args: [documentHash, studentWallet, metadataURI],
    });
  };

  /**
   * Extract certificate ID from transaction logs
   * Decodes the CertificateIssued event to get the certificateId
   */
  const certificateId = useMemo(() => {
    if (!receipt?.logs || !CERTIFICATE_REGISTRY_ADDRESS) return undefined;
    
    try {
      // Find the CertificateIssued event log from our contract
      const certificateIssuedLog = receipt.logs.find((log) => 
        CERTIFICATE_REGISTRY_ADDRESS && 
        log.address?.toLowerCase() === CERTIFICATE_REGISTRY_ADDRESS.toLowerCase()
      );
      
      if (!certificateIssuedLog) return undefined;
      
      // Decode the event log
      const decoded = decodeEventLog({
        abi: CertificateRegistryABI.abi,
        data: certificateIssuedLog.data,
        topics: certificateIssuedLog.topics,
      });
      
      // Extract certificateId from the CertificateIssued event
      if (decoded.eventName === 'CertificateIssued' && decoded.args && 'certificateId' in decoded.args) {
        return decoded.args.certificateId as bigint;
      }
    } catch (error) {
      console.error('Failed to decode certificate ID from event logs:', error);
    }
    
    return undefined;
  }, [receipt]);

  /**
   * Reset the hook state
   * Use this to clear the transaction state after handling success/error,
   * or when the user wants to start a new transaction.
   * 
   * @example
   * ```tsx
   * // After successful issuance, allow user to issue another certificate
   * <button onClick={() => {
   *   setFormState('upload');
   *   reset(); // Clear previous transaction state
   * }}>
   *   Issue Another Certificate
   * </button>
   * 
   * // Or in error handling
   * if (error) {
   *   return (
   *     <div>
   *       <p>Error: {error.message}</p>
   *       <button onClick={reset}>Try Again</button>
   *     </div>
   *   );
   * }
   * ```
   */
  const reset = () => {
    resetWrite();
  };

  // Combine and normalize errors
  const error = writeError 
    ? (writeError instanceof Error ? writeError : new Error(String(writeError)))
    : confirmError 
    ? (confirmError instanceof Error ? confirmError : new Error(String(confirmError)))
    : null;

  return {
    issueCertificate,
    isPending,
    isConfirming,
    isSuccess,
    error,
    transactionHash: hash,
    certificateId,
    reset,
  };
}

/**
 * Hook with callback support for certificate issuance
 * 
 * @param onSuccess - Callback when transaction is confirmed
 * @param onError - Callback when an error occurs
 * 
 * @example
 * ```tsx
 * const { issueCertificate, isPending } = useCertificateIssuanceWithCallback(
 *   (hash, certificateId) => {
 *     console.log('Certificate issued:', certificateId);
 *     navigate('/dashboard');
 *   },
 *   (error) => {
 *     console.error('Failed to issue:', error);
 *   }
 * );
 * ```
 */
export function useCertificateIssuanceWithCallback(
  onSuccess?: (hash: `0x${string}`, certificateId?: bigint) => void,
  onError?: (error: Error) => void
): UseCertificateIssuanceReturn {
  const hook = useCertificateIssuance();
  const successCalledRef = useRef(false);
  const errorCalledRef = useRef(false);

  // Reset refs when transaction resets
  useEffect(() => {
    if (!hook.isPending && !hook.isConfirming && !hook.isSuccess && !hook.error) {
      successCalledRef.current = false;
      errorCalledRef.current = false;
    }
  }, [hook.isPending, hook.isConfirming, hook.isSuccess, hook.error]);

  // Handle success callback - only call once per transaction
  useEffect(() => {
    if (hook.isSuccess && hook.transactionHash && onSuccess && !successCalledRef.current) {
      successCalledRef.current = true;
      onSuccess(hook.transactionHash, hook.certificateId);
    }
  }, [hook.isSuccess, hook.transactionHash, hook.certificateId, onSuccess]);

  // Handle error callback - only call once per error
  useEffect(() => {
    if (hook.error && onError && !errorCalledRef.current) {
      errorCalledRef.current = true;
      onError(hook.error);
    }
  }, [hook.error, onError]);

  return hook;
}

/**
 * Hook with duplicate check support for certificate issuance
 * Uses the hashExists helper function for client-side validation
 * 
 * @param documentHash - The document hash to check for duplicates
 * @param enabled - Whether duplicate checking should be enabled
 * 
 * @example
 * ```tsx
 * const [pdfHash, setPdfHash] = useState<`0x${string}`>();
 * const { 
 *   issueCertificate, 
 *   isPending, 
 *   isDuplicate, 
 *   isCheckingDuplicate,
 *   error 
 * } = useCertificateIssuanceWithDuplicateCheck(pdfHash);
 * 
 * if (isDuplicate) {
 *   return <Alert variant="warning">This certificate has already been issued!</Alert>;
 * }
 * 
 * return (
 *   <Button 
 *     onClick={() => issueCertificate({ documentHash: pdfHash!, studentWallet, metadataURI })}
 *     disabled={isPending || isCheckingDuplicate || isDuplicate}
 *   >
 *     {isCheckingDuplicate ? 'Checking...' : 'Issue Certificate'}
 *   </Button>
 * );
 * ```
 */
export function useCertificateIssuanceWithDuplicateCheck(
  documentHash: `0x${string}` | undefined,
  enabled: boolean = true
): UseCertificateIssuanceReturn & {
  isDuplicate: boolean | undefined;
  isCheckingDuplicate: boolean;
  duplicateCheckError: Error | null;
} {
  const hook = useCertificateIssuance();
  
  // Check for duplicate hash
  const { 
    data: exists, 
    isLoading: isCheckingDuplicate, 
    error: duplicateCheckError,
  } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'hashExists',
    args: documentHash ? [documentHash] : undefined,
    query: {
      enabled: !!documentHash && !!CERTIFICATE_REGISTRY_ADDRESS && enabled,
    },
  });

  // Normalize duplicate check error
  const normalizedDuplicateError = duplicateCheckError 
    ? (duplicateCheckError instanceof Error ? duplicateCheckError : new Error(String(duplicateCheckError)))
    : null;

  return {
    ...hook,
    isDuplicate: exists as boolean | undefined,
    isCheckingDuplicate,
    duplicateCheckError: normalizedDuplicateError,
  };
}
