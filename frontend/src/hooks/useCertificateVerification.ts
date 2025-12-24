import { useReadContract } from 'wagmi';
import { CERTIFICATE_REGISTRY_ADDRESS } from '@/lib/wagmi';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import { validateTuple, certificateVerificationSchema } from '@/lib/validation';
import { logger } from '@/lib/logger';
import { parseError } from '@/lib/errorHandling';

/**
 * Certificate verification result from smart contract
 */
export interface CertificateVerificationResult {
  isValid: boolean;
  certificateId: bigint;
  isRevoked: boolean;
}

/**
 * Return type for certificate verification hook
 */
export interface UseCertificateVerificationReturn {
  data: CertificateVerificationResult | undefined;
  isValid: boolean;
  isRevoked: boolean;
  certificateId: bigint | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to verify if a certificate is valid using its document hash
 * 
 * @param documentHash - SHA-256 hash of the PDF document (must start with 0x)
 * @param enabled - Whether the query should be enabled (default: true if hash is provided)
 * @param sessionKey - Session key to force cache invalidation between verifications
 * 
 * @example
 * ```tsx
 * const { isValid, isRevoked, certificateId, isLoading, error, refetch } = useCertificateVerification(
 *   '0x1234567890abcdef...'
 * );
 * 
 * if (isLoading) return <Spinner />;
 * if (error) return <Error message={error.message} />;
 * if (isValid && !isRevoked) {
 *   return <SuccessBadge>Certificate #{certificateId.toString()} is valid</SuccessBadge>;
 * }
 * ```
 */
export function useCertificateVerification(
  documentHash: `0x${string}` | undefined,
  enabled: boolean = true,
  sessionKey?: number
): UseCertificateVerificationReturn {
  const { 
    data, 
    isLoading, 
    error,
    refetch: refetchQuery
  } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'isValidCertificate',
    args: documentHash ? [documentHash] : undefined,
    query: {
      enabled: !!documentHash && !!CERTIFICATE_REGISTRY_ADDRESS && enabled,
      staleTime: 0,
      gcTime: 0,
      refetchOnMount: 'always',
      refetchOnWindowFocus: true,
      queryKey: sessionKey !== undefined 
        ? ['isValidCertificate', documentHash, sessionKey] 
        : ['isValidCertificate', documentHash],
    },
  });

  // Parse and validate the result tuple: [bool isValid, uint256 certificateId, bool isRevoked]
  const validatedData = data ? validateTuple(certificateVerificationSchema, data) : null;
  
  const verificationResult: CertificateVerificationResult | undefined = validatedData
    ? {
        isValid: validatedData[0],
        certificateId: validatedData[1],
        isRevoked: validatedData[2],
      }
    : undefined;

  // Log validation failures
  if (data && !validatedData) {
    logger.error('Certificate verification data validation failed', undefined, { data });
  }

  const refetch = () => {
    logger.debug('Refetching certificate verification');
    refetchQuery();
  };

  // Normalize error and provide user-friendly message
  let normalizedError: Error | null = null;
  if (error) {
    const errorResponse = parseError(error);
    normalizedError = new Error(errorResponse.message);
    logger.error('Certificate verification error', error, {
      documentHash,
      errorType: errorResponse.type,
      retryable: errorResponse.retryable
    });
  }

  return {
    data: verificationResult,
    isValid: verificationResult?.isValid ?? false,
    isRevoked: verificationResult?.isRevoked ?? false,
    certificateId: verificationResult?.certificateId,
    isLoading,
    error: normalizedError,
    refetch,
  };
}

/**
 * Certificate details from smart contract
 */
export interface CertificateDetails {
  documentHash: `0x${string}`;
  studentWallet: `0x${string}`;
  issuingInstitution: `0x${string}`;
  issueDate: bigint;
  certificateId: bigint;
  metadataURI: string;
  isRevoked: boolean;
  revokedAt: bigint;
  revocationReason: string;
}

/**
 * Return type for certificate details hook
 */
export interface UseCertificateDetailsReturn {
  certificate: CertificateDetails | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
}

/**
 * Hook to get full certificate details by ID
 * 
 * @param certificateId - The unique certificate ID
 * @param enabled - Whether the query should be enabled (default: true if ID is provided)
 * 
 * @example
 * ```tsx
 * const { certificate, isLoading, error } = useCertificateDetails(123n);
 * 
 * if (certificate) {
 *   return (
 *     <div>
 *       <p>Student: {certificate.studentWallet}</p>
 *       <p>Issued: {new Date(Number(certificate.issueDate) * 1000).toLocaleDateString()}</p>
 *       <p>Institution: {certificate.issuingInstitution}</p>
 *     </div>
 *   );
 * }
 * ```
 */
export function useCertificateDetails(
  certificateId: bigint | undefined,
  enabled: boolean = true
): UseCertificateDetailsReturn {
  const { 
    data, 
    isLoading, 
    error,
    refetch: refetchQuery
  } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getCertificate',
    args: certificateId !== undefined ? [certificateId] : undefined,
    query: {
      enabled: certificateId !== undefined && !!CERTIFICATE_REGISTRY_ADDRESS && enabled,
    },
  });

  const refetch = () => {
    refetchQuery();
  };

  // Normalize error to proper Error type
  const normalizedError = error 
    ? (error instanceof Error ? error : new Error(String(error)))
    : null;

  return {
    certificate: data as CertificateDetails | undefined,
    isLoading,
    error: normalizedError,
    refetch,
  };
}

/**
 * Hook to get certificate details by document hash
 * 
 * @param documentHash - SHA-256 hash of the PDF document
 * @param enabled - Whether the query should be enabled (default: true if hash is provided)
 * 
 * @example
 * ```tsx
 * const { certificate, isLoading } = useCertificateByHash('0x123...');
 * ```
 */
export function useCertificateByHash(
  documentHash: `0x${string}` | undefined,
  enabled: boolean = true
): UseCertificateDetailsReturn {
  const { 
    data, 
    isLoading, 
    error,
    refetch: refetchQuery
  } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getCertificateByHash',
    args: documentHash ? [documentHash] : undefined,
    query: {
      enabled: !!documentHash && !!CERTIFICATE_REGISTRY_ADDRESS && enabled,
    },
  });

  const refetch = () => {
    refetchQuery();
  };

  // Normalize error to proper Error type
  const normalizedError = error 
    ? (error instanceof Error ? error : new Error(String(error)))
    : null;

  return {
    certificate: data as CertificateDetails | undefined,
    isLoading,
    error: normalizedError,
    refetch,
  };
}

/**
 * Hook to get all certificate IDs for a student
 * 
 * @param studentWallet - The wallet address of the student
 * @param enabled - Whether the query should be enabled (default: true if address is provided)
 * 
 * @example
 * ```tsx
 * const { certificateIds, isLoading } = useStudentCertificates('0xabc...');
 * 
 * return (
 *   <ul>
 *     {certificateIds?.map(id => (
 *       <li key={id.toString()}>Certificate #{id.toString()}</li>
 *     ))}
 *   </ul>
 * );
 * ```
 */
export function useStudentCertificates(
  studentWallet: `0x${string}` | undefined,
  enabled: boolean = true
): {
  certificateIds: readonly bigint[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { 
    data, 
    isLoading, 
    error,
    refetch: refetchQuery
  } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getCertificatesByStudent',
    args: studentWallet ? [studentWallet] : undefined,
    query: {
      enabled: !!studentWallet && !!CERTIFICATE_REGISTRY_ADDRESS && enabled,
    },
  });

  const refetch = () => {
    refetchQuery();
  };

  // Normalize error to proper Error type
  const normalizedError = error 
    ? (error instanceof Error ? error : new Error(String(error)))
    : null;

  return {
    certificateIds: data as readonly bigint[] | undefined,
    isLoading,
    error: normalizedError,
    refetch,
  };
}

/**
 * Hook to check if a certificate exists (non-reverting)
 * 
 * @param certificateId - The ID of the certificate to check
 * @param enabled - Whether the query should be enabled (default: true if ID is provided)
 * 
 * @example
 * ```tsx
 * const { exists, isLoading } = useCertificateExists(123n);
 * 
 * if (exists) {
 *   return <Badge>Certificate Found</Badge>;
 * }
 * ```
 */
export function useCertificateExists(
  certificateId: bigint | undefined,
  enabled: boolean = true
): {
  exists: boolean | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { 
    data, 
    isLoading, 
    error,
    refetch: refetchQuery
  } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'certificateExists',
    args: certificateId !== undefined ? [certificateId] : undefined,
    query: {
      enabled: certificateId !== undefined && !!CERTIFICATE_REGISTRY_ADDRESS && enabled,
    },
  });

  const refetch = () => {
    refetchQuery();
  };

  // Normalize error to proper Error type
  const normalizedError = error 
    ? (error instanceof Error ? error : new Error(String(error)))
    : null;

  return {
    exists: data as boolean | undefined,
    isLoading,
    error: normalizedError,
    refetch,
  };
}

/**
 * Hook to check if a document hash exists (duplicate prevention)
 * 
 * @param documentHash - The SHA-256 hash to check
 * @param enabled - Whether the query should be enabled (default: true if hash is provided)
 * 
 * @example
 * ```tsx
 * const [pdfHash, setPdfHash] = useState<`0x${string}`>();
 * const { exists, isLoading } = useHashExists(pdfHash);
 * 
 * if (exists) {
 *   return <Alert>This certificate has already been issued!</Alert>;
 * }
 * ```
 */
export function useHashExists(
  documentHash: `0x${string}` | undefined,
  enabled: boolean = true
): {
  exists: boolean | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { 
    data, 
    isLoading, 
    error,
    refetch: refetchQuery
  } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'hashExists',
    args: documentHash ? [documentHash] : undefined,
    query: {
      enabled: !!documentHash && !!CERTIFICATE_REGISTRY_ADDRESS && enabled,
    },
  });

  const refetch = () => {
    refetchQuery();
  };

  // Normalize error to proper Error type
  const normalizedError = error 
    ? (error instanceof Error ? error : new Error(String(error)))
    : null;

  return {
    exists: data as boolean | undefined,
    isLoading,
    error: normalizedError,
    refetch,
  };
}

/**
 * Return type for batch certificates hook
 */
export interface BatchCertificatesResult {
  certificates: readonly CertificateDetails[];
  foundFlags: readonly boolean[];
}

/**
 * Hook to get multiple certificates in a single batch call
 * 
 * @param certificateIds - Array of certificate IDs to retrieve
 * @param enabled - Whether the query should be enabled (default: true if IDs are provided)
 * 
 * @example
 * ```tsx
 * const studentIds = [1n, 2n, 3n];
 * const { certificates, foundFlags, isLoading } = useCertificatesBatch(studentIds);
 * 
 * return (
 *   <div>
 *     {certificates?.map((cert, i) => (
 *       foundFlags?.[i] ? (
 *         <CertificateCard key={i} certificate={cert} />
 *       ) : (
 *         <div key={i}>Certificate {studentIds[i].toString()} not found</div>
 *       )
 *     ))}
 *   </div>
 * );
 * ```
 */
export function useCertificatesBatch(
  certificateIds: bigint[] | undefined,
  enabled: boolean = true
): {
  data: BatchCertificatesResult | undefined;
  certificates: readonly CertificateDetails[] | undefined;
  foundFlags: readonly boolean[] | undefined;
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
} {
  const { 
    data, 
    isLoading, 
    error,
    refetch: refetchQuery
  } = useReadContract({
    address: CERTIFICATE_REGISTRY_ADDRESS,
    abi: CertificateRegistryABI.abi,
    functionName: 'getCertificatesBatch',
    args: certificateIds ? [certificateIds] : undefined,
    query: {
      enabled: !!certificateIds && certificateIds.length > 0 && !!CERTIFICATE_REGISTRY_ADDRESS && enabled,
    },
  });

  const refetch = () => {
    refetchQuery();
  };

  // Parse the result tuple: [Certificate[] certificates, bool[] foundFlags]
  const result = data as [readonly CertificateDetails[], readonly boolean[]] | undefined;
  
  const batchResult: BatchCertificatesResult | undefined = result
    ? {
        certificates: result[0],
        foundFlags: result[1],
      }
    : undefined;

  // Normalize error to proper Error type
  const normalizedError = error 
    ? (error instanceof Error ? error : new Error(String(error)))
    : null;

  return {
    data: batchResult,
    certificates: batchResult?.certificates,
    foundFlags: batchResult?.foundFlags,
    isLoading,
    error: normalizedError,
    refetch,
  };
}
