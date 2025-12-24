// src/types/index.ts

/**
 * Certificate data structure matching the smart contract
 */
export interface Certificate {
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
 * Institution data structure matching the smart contract
 */
export interface Institution {
  name: string;
  emailDomain: string;
  walletAddress: `0x${string}`;
  isVerified: boolean;
  isActive: boolean;
  verificationDate: bigint;
  totalCertificatesIssued: bigint;
}

/**
 * Certificate verification result
 */
export interface VerificationResult {
  isValid: boolean;
  certificateId: bigint;
  isRevoked: boolean;
}

/**
 * Certificate issuance form data
 */
export interface IssueCertificateFormData {
  documentHash: `0x${string}`;
  studentWallet: `0x${string}`;
  metadataURI?: string;
}

/**
 * Institution registration form data
 */
export interface RegisterInstitutionFormData {
  name: string;
  emailDomain: string;
}

/**
 * Transaction status for UI feedback
 */
export type TransactionStatus = 'idle' | 'pending' | 'confirming' | 'success' | 'error';

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
}

/**
 * Pagination parameters
 */
export interface PaginationParams {
  offset: number;
  limit: number;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  offset: number;
  limit: number;
  hasMore: boolean;
}

