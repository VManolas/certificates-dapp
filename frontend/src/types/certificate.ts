// src/types/certificate.ts

/**
 * Certificate data structure matching the smart contract
 */
export interface Certificate {
  certificateId: bigint;
  documentHash: string;
  studentWallet: string;
  issuingInstitution: string;
  issueDate: bigint;
  metadataURI: string;
  isRevoked: boolean;
  revokedAt: bigint;
  revocationReason: string;
  graduationYear: number; // Year of graduation (1900-2100)
}

/**
 * Form data for single certificate issuance
 */
export interface CertificateIssuanceForm {
  studentWallet: string;
  program: string;
  graduationYear: number; // Required: graduation year (1900-2100)
  certificatePDF: File;
  metadataURI?: string;
}

/**
 * Form data for bulk certificate issuance
 */
export interface BulkCertificateForm {
  certificatePDFs: File[];
  csvFile: File;
  csvData?: CSVRow[];
}

/**
 * CSV row structure for bulk upload
 * Maps to the CSV columns: studentWallet, program, graduationYear, pdfFilename
 */
export interface CSVRow {
  studentWallet: string;
  program: string;
  graduationYear: number; // Required: graduation year (1900-2100)
  pdfFilename: string;
}

/**
 * Privacy settings for certificate sharing via QR code
 */
export interface PrivacySettings {
  includeWallet: boolean; // Whether to include student wallet address
  includeInitials: boolean; // Whether to include student initials
  initials?: string; // Student initials (e.g., "J.D.")
}

/**
 * QR code payload structure for certificate sharing
 * Version 1 format: V1:{base64(json)}
 * 
 * Always included fields:
 * - program, university, graduationYear, status
 * 
 * Optional fields (controlled by student):
 * - studentWallet, studentInitials
 */
export interface QRCodePayload {
  // Always included
  program: string;
  university: string;
  graduationYear: number;
  status: 'Verified' | 'Revoked';
  
  // Optional (privacy controls)
  studentWallet?: string;
  studentInitials?: string;
  
  // Metadata
  version: string; // Payload version (e.g., "1.0")
  generatedAt: number; // Unix timestamp
}

/**
 * Certificate verification result
 */
export interface CertificateVerificationResult {
  isValid: boolean;
  certificate?: Certificate;
  error?: string;
}

/**
 * Validation constants
 */
export const GRADUATION_YEAR_MIN = 1900;
export const GRADUATION_YEAR_MAX = 2100;

/**
 * Validate graduation year range
 */
export function isValidGraduationYear(year: number): boolean {
  return Number.isInteger(year) && year >= GRADUATION_YEAR_MIN && year <= GRADUATION_YEAR_MAX;
}

/**
 * Get current year as default graduation year
 */
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

/**
 * Format graduation year for display
 */
export function formatGraduationYear(year: number): string {
  return year.toString();
}

/**
 * Validation error messages
 */
export const VALIDATION_MESSAGES = {
  GRADUATION_YEAR_REQUIRED: 'Graduation year is required',
  GRADUATION_YEAR_INVALID: `Graduation year must be between ${GRADUATION_YEAR_MIN} and ${GRADUATION_YEAR_MAX}`,
  GRADUATION_YEAR_NOT_NUMBER: 'Graduation year must be a valid number',
  STUDENT_WALLET_REQUIRED: 'Student wallet address is required',
  STUDENT_WALLET_INVALID: 'Invalid Ethereum address format',
  PROGRAM_REQUIRED: 'Program name is required',
  PDF_REQUIRED: 'Certificate PDF is required',
  PDF_INVALID: 'File must be a valid PDF',
};
