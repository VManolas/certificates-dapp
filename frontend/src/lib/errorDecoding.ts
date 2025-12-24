// src/lib/errorDecoding.ts
import { decodeErrorResult, type Abi } from 'viem';
import CertificateRegistryABI from '@/contracts/abis/CertificateRegistry.json';
import InstitutionRegistryABI from '@/contracts/abis/InstitutionRegistry.json';

/**
 * Maps of custom error names to user-friendly messages
 */
const ERROR_MESSAGES: Record<string, string> = {
  // CertificateRegistry errors
  'UnauthorizedIssuer': 'Your institution is not authorized to issue certificates. Please ensure your institution is verified and active, or contact an administrator.',
  'CertificateAlreadyExists': 'This certificate already exists in the system. The PDF hash matches an existing certificate. Please use a unique PDF document for each certificate.',
  'CertificateNotFound': 'Certificate not found in the registry.',
  'CertificateAlreadyRevoked': 'This certificate has already been revoked.',
  'NotCertificateIssuer': 'Only the institution that issued this certificate can revoke it.',
  'InvalidStudentAddress': 'The student wallet address provided is invalid (cannot be zero address).',
  'InvalidDocumentHash': 'The document hash is invalid (cannot be empty).',
  'InvalidAddress': 'The provided address is invalid (cannot be zero address).',
  
  // InstitutionRegistry errors
  'InstitutionAlreadyExists': 'This wallet address is already registered as an institution.',
  'InstitutionNotFound': 'Institution not found in the registry.',
  'InstitutionNotVerified': 'Your institution has not been verified yet. Please wait for admin approval.',
  'InstitutionAlreadyVerified': 'This institution has already been verified.',
  'InstitutionNotActive': 'Your institution is currently suspended. Please contact an administrator.',
  'InstitutionAlreadyActive': 'This institution is already active.',
  'EmailDomainAlreadyRegistered': 'This email domain is already registered to another institution.',
  'InvalidEmailDomain': 'The email domain provided is invalid (cannot be empty).',
  'InvalidName': 'The institution name is invalid (cannot be empty).',
  'AdminCannotRegisterAsInstitution': 'Administrator accounts cannot register as institutions.',
};

/**
 * Combined ABI for error decoding
 */
const COMBINED_ABI = [
  ...(CertificateRegistryABI.abi as Abi),
  ...(InstitutionRegistryABI.abi as Abi),
];

/**
 * Decodes a contract error and returns a user-friendly message
 * 
 * @param error - The error object from a contract call
 * @returns User-friendly error message
 * 
 * @example
 * ```typescript
 * try {
 *   await issueCertificate(...);
 * } catch (error) {
 *   const message = decodeContractError(error);
 *   toast.error(message);
 * }
 * ```
 */
export function decodeContractError(error: unknown): string {
  // Handle non-Error types
  if (!(error instanceof Error)) {
    return 'An unknown error occurred';
  }

  // Try to extract error data (hex string like 0xb41ba2d6...)
  const errorDataMatch = error.message.match(/0x[a-fA-F0-9]+/);
  
  if (!errorDataMatch) {
    // No hex data found, fall back to string matching
    return fallbackErrorParsing(error.message);
  }

  const errorData = errorDataMatch[0] as `0x${string}`;

  // Try decoding with viem
  try {
    const decoded = decodeErrorResult({
      abi: COMBINED_ABI,
      data: errorData,
    });

    return mapErrorToUserMessage(decoded.errorName, decoded.args);
  } catch (decodeError) {
    // Decoding failed, fall back to string matching
    return fallbackErrorParsing(error.message);
  }
}

/**
 * Maps a decoded error name to a user-friendly message
 */
function mapErrorToUserMessage(errorName: string, args?: readonly unknown[]): string {
  // Check if we have a predefined message
  if (errorName in ERROR_MESSAGES) {
    let message = ERROR_MESSAGES[errorName];
    
    // Add args to message if available (for debugging)
    if (args && args.length > 0 && process.env.NODE_ENV === 'development') {
      message += ` (Args: ${JSON.stringify(args)})`;
    }
    
    return message;
  }

  // Unknown error name
  return `Contract error: ${errorName}${args ? ` (${JSON.stringify(args)})` : ''}`;
}

/**
 * Fallback error parsing using string matching
 * Used when error data cannot be decoded
 */
function fallbackErrorParsing(errorMessage: string): string {
  const errStr = errorMessage.toLowerCase();

  // Try to match common error patterns
  if (errStr.includes('unauthorizedissuer') || errStr.includes('unauthorized')) {
    return ERROR_MESSAGES['UnauthorizedIssuer'];
  }

  if (errStr.includes('certificatealreadyexists') || errStr.includes('already exists')) {
    return ERROR_MESSAGES['CertificateAlreadyExists'];
  }

  if (errStr.includes('invalidstudentaddress')) {
    return ERROR_MESSAGES['InvalidStudentAddress'];
  }

  if (errStr.includes('invaliddocumenthash')) {
    return ERROR_MESSAGES['InvalidDocumentHash'];
  }

  if (errStr.includes('institutionnotverified')) {
    return ERROR_MESSAGES['InstitutionNotVerified'];
  }

  if (errStr.includes('institutionnotactive')) {
    return ERROR_MESSAGES['InstitutionNotActive'];
  }

  if (errStr.includes('certificatenotfound')) {
    return ERROR_MESSAGES['CertificateNotFound'];
  }

  if (errStr.includes('user rejected') || errStr.includes('user denied')) {
    return 'Transaction was rejected. Please try again and confirm the transaction in your wallet.';
  }

  if (errStr.includes('insufficient funds')) {
    return 'Insufficient funds to complete the transaction. Please ensure you have enough ETH for gas fees.';
  }

  if (errStr.includes('nonce too low')) {
    return 'Transaction nonce error. Please refresh the page and try again.';
  }

  if (errStr.includes('network') || errStr.includes('fetch failed')) {
    return 'Network error. Please check your connection and try again.';
  }

  if (errStr.includes('timeout')) {
    return 'Request timed out. Please try again.';
  }

  // Return original message if we can't categorize it
  return errorMessage;
}

/**
 * Checks if an error is retryable
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('nonce too low') ||
    message.includes('fetch failed')
  );
}

/**
 * Checks if an error is a user rejection
 */
export function isUserRejectionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();
  return (
    message.includes('user rejected') ||
    message.includes('user denied') ||
    message.includes('user cancelled')
  );
}

/**
 * Type guard for checking if error has specific properties
 */
export function hasErrorData(error: unknown): error is { data?: string } {
  return (
    typeof error === 'object' &&
    error !== null &&
    'data' in error
  );
}

/**
 * Extracts the error selector (first 4 bytes) from error data
 */
export function getErrorSelector(errorData: string): string | null {
  if (!errorData.startsWith('0x') || errorData.length < 10) {
    return null;
  }
  return errorData.slice(0, 10);
}

/**
 * Known error selectors for quick lookup
 * Generated using: cast sig "ErrorName()"
 */
export const ERROR_SELECTORS: Record<string, string> = {
  '0xb41ba2d6': 'UnauthorizedIssuer',
  '0xdd35fc59': 'CertificateAlreadyExists',
  '0x5f945ea8': 'CertificateNotFound',
  '0x71e8da46': 'CertificateAlreadyRevoked',
  '0x2f1ca8a3': 'NotCertificateIssuer',
  '0x0db8c87a': 'InvalidStudentAddress',
  '0x9f2c2d6d': 'InvalidDocumentHash',
  '0xaa1b103f': 'InstitutionAlreadyExists',
  '0x24bb5f30': 'InstitutionNotFound',
  '0x8301cc4d': 'InstitutionNotVerified',
  '0x7ba5e4a1': 'InstitutionAlreadyVerified',
  '0x19d5cd7e': 'InstitutionNotActive',
  '0x8e1e4d13': 'InstitutionAlreadyActive',
  '0xf89cd599': 'EmailDomainAlreadyRegistered',
  '0x1a1b4f4e': 'InvalidEmailDomain',
  '0x5ef16c07': 'InvalidName',
  '0xe6c4247b': 'InvalidAddress',
  '0xca2f217a': 'AdminCannotRegisterAsInstitution',
};

/**
 * Gets error name from selector
 */
export function getErrorNameFromSelector(selector: string): string | null {
  return ERROR_SELECTORS[selector.toLowerCase()] || null;
}

