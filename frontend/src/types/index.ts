// src/types/index.ts

/**
 * Re-export certificate types from certificate module
 */
export type { 
  Certificate,
  CertificateVerificationResult,
  CertificateIssuanceForm,
  BulkCertificateForm,
  CSVRow,
  PrivacySettings,
  QRCodePayload
} from './certificate';

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
 * Contract-level verification result (from smart contract reads)
 * This is different from CertificateVerificationResult which includes full certificate data
 */
export interface ContractVerificationResult {
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


