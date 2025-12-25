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
  'CertificateAlreadyExists': 'This PDF certificate has already been issued. Each certificate must use a unique PDF document. Please upload a different PDF file for this student.',
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
 * Recursively searches error object and its nested properties for error data
 */
function extractErrorDataFromObject(error: any): string | null {
  if (import.meta.env.DEV) {
    console.log('[Error Decoding] Extracting from error object...');
  }

  // Check direct data property
  if (error?.data && typeof error.data === 'string' && error.data.startsWith('0x')) {
    if (import.meta.env.DEV) {
      console.log('[Error Decoding] Found in error.data:', error.data);
    }
    return error.data;
  }

  // Check cause property (common in wrapped errors) - RECURSIVELY
  if (error?.cause) {
    if (import.meta.env.DEV) {
      console.log('[Error Decoding] Checking error.cause recursively...');
      console.log('[Error Decoding] Cause keys:', Object.keys(error.cause));
    }
    const causeData = extractErrorDataFromObject(error.cause);
    if (causeData) return causeData;
  }

  // Check details property (viem specific)
  if (error?.details) {
    if (import.meta.env.DEV) {
      console.log('[Error Decoding] Checking error.details:', error.details);
    }
    if (typeof error.details === 'string') {
      const hexMatch = error.details.match(/0x[a-fA-F0-9]{8,}/);
      if (hexMatch && hexMatch[0].length !== 42) {
        if (import.meta.env.DEV) {
          console.log('[Error Decoding] Found in error.details:', hexMatch[0]);
        }
        return hexMatch[0];
      }
    }
  }

  // Check metaMessages array (wagmi detailed errors)
  if (Array.isArray(error?.metaMessages)) {
    if (import.meta.env.DEV) {
      console.log('[Error Decoding] Checking metaMessages:', error.metaMessages);
    }
    for (const msg of error.metaMessages) {
      if (typeof msg === 'string') {
        const hexMatch = msg.match(/0x[a-fA-F0-9]{8,}/);
        if (hexMatch && hexMatch[0].length !== 42) { // Not an address
          if (import.meta.env.DEV) {
            console.log('[Error Decoding] Found in metaMessages:', hexMatch[0]);
          }
          return hexMatch[0];
        }
      }
    }
  }

  // Check shortMessage property (wagmi errors)
  if (error?.shortMessage && typeof error.shortMessage === 'string') {
    if (import.meta.env.DEV) {
      console.log('[Error Decoding] Checking shortMessage:', error.shortMessage);
    }
    const hexMatch = error.shortMessage.match(/0x[a-fA-F0-9]{8,}/);
    if (hexMatch && hexMatch[0].length !== 42) {
      if (import.meta.env.DEV) {
        console.log('[Error Decoding] Found in shortMessage:', hexMatch[0]);
      }
      return hexMatch[0];
    }
  }

  // Check walk property (viem nested errors)
  if (typeof error?.walk === 'function') {
    if (import.meta.env.DEV) {
      console.log('[Error Decoding] Trying error.walk() method...');
    }
    try {
      let foundData: string | null = null;
      error.walk((e: any) => {
        if (import.meta.env.DEV) {
          console.log('[Error Decoding] Walking error:', e?.name, 'keys:', Object.keys(e || {}));
        }
        if (e?.data && typeof e.data === 'string' && e.data.startsWith('0x')) {
          foundData = e.data;
          if (import.meta.env.DEV) {
            console.log('[Error Decoding] Found in walk:', foundData);
          }
          return false; // Stop walking
        }
      });
      if (foundData) return foundData;
    } catch (walkError) {
      if (import.meta.env.DEV) {
        console.log('[Error Decoding] Walk failed:', walkError);
      }
      // Ignore walk errors
    }
  }

  return null;
}

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

  const errorMessage = error.message;
  
  // Debug logging in development
  if (import.meta.env.DEV) {
    console.log('[Error Decoding] Original error:', error);
    console.log('[Error Decoding] Error message:', errorMessage);
    console.log('[Error Decoding] Error keys:', Object.keys(error));
  }

  // First, try to recursively extract error data from error object
  let errorData: `0x${string}` | null = null;
  const extractedData = extractErrorDataFromObject(error);
  if (extractedData) {
    errorData = extractedData as `0x${string}`;
    if (import.meta.env.DEV) {
      console.log('[Error Decoding] Extracted error data from object:', errorData);
    }
    
    // Try to decode it immediately
    try {
      const decoded = decodeErrorResult({
        abi: COMBINED_ABI,
        data: errorData,
      });
      if (import.meta.env.DEV) {
        console.log('[Error Decoding] Successfully decoded from extracted data:', decoded);
      }
      return mapErrorToUserMessage(decoded.errorName, decoded.args);
    } catch {
      if (import.meta.env.DEV) {
        console.log('[Error Decoding] Failed to decode extracted data:', errorData);
      }
      // Continue to try other methods
    }
  }

  // If no data property, try to extract from message
  // Look for error selector patterns (0x followed by 8 hex chars for function selector, or more for full error data)
  if (!errorData) {
    // Match error selectors (0x + 8+ hex characters, but avoid matching addresses which are 40 hex chars)
    const errorSelectorMatches = errorMessage.match(/0x[a-fA-F0-9]{8,}/g);
    
    if (errorSelectorMatches) {
      if (import.meta.env.DEV) {
        console.log('[Error Decoding] Found potential error selectors in message:', errorSelectorMatches);
      }
      
      // Try each potential error data, starting with the shortest (most likely to be error selector)
      const sortedMatches = errorSelectorMatches.sort((a, b) => a.length - b.length);
      
      for (const match of sortedMatches) {
        // Skip if it looks like an address (40 hex chars)
        if (match.length === 42) {
          if (import.meta.env.DEV) {
            console.log('[Error Decoding] Skipping address:', match);
          }
          continue;
        }
        
        // Try to decode this as error data
        try {
          const testData = match as `0x${string}`;
          const decoded = decodeErrorResult({
            abi: COMBINED_ABI,
            data: testData,
          });
          
          if (import.meta.env.DEV) {
            console.log('[Error Decoding] Successfully decoded from message:', decoded);
          }
          
          // Successfully decoded! Use this error data
          return mapErrorToUserMessage(decoded.errorName, decoded.args);
        } catch {
          // Not a valid error, try next match
          if (import.meta.env.DEV) {
            console.log('[Error Decoding] Failed to decode:', match);
          }
          continue;
        }
      }
    }
  }

  // No valid error data found, fall back to string matching
  if (import.meta.env.DEV) {
    console.log('[Error Decoding] Falling back to string matching');
  }
  return fallbackErrorParsing(errorMessage);
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

  if (import.meta.env.DEV) {
    console.log('[Error Decoding] Fallback parsing for error message');
  }

  // ⚠️ CRITICAL FIX: Handle "Internal JSON-RPC error" from hardhat
  // When hardhat can't return proper error data, it returns this generic message
  // We infer the actual error from the function context
  if (errStr.includes('internal json-rpc error')) {
    if (import.meta.env.DEV) {
      console.log('[Error Decoding] Detected "Internal JSON-RPC error"');
    }
    
    // Check function context to infer the error
    if (errStr.includes('issuecertificate')) {
      if (import.meta.env.DEV) {
        console.log('[Error Decoding] Context: issueCertificate -> Inferring CertificateAlreadyExists');
      }
      // The most common reason for issueCertificate to fail is duplicate certificate
      // This is a reasonable inference given the function context
      return ERROR_MESSAGES['CertificateAlreadyExists'];
    }
    
    // For other functions with internal JSON-RPC error, return a generic but helpful message
    return 'Transaction failed. Please check your inputs and try again.';
  }

  // Try to match common error patterns
  if (errStr.includes('unauthorizedissuer') || errStr.includes('unauthorized')) {
    return ERROR_MESSAGES['UnauthorizedIssuer'];
  }

  // Enhanced duplicate certificate detection
  if (
    errStr.includes('certificatealreadyexists') || 
    errStr.includes('already exists') ||
    errStr.includes('duplicate') ||
    errStr.includes('0x5a0e33b5') // CORRECT error selector for CertificateAlreadyExists
  ) {
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
 * Generated using: keccak256(toUtf8Bytes("ErrorName()")).substring(0, 10)
 */
export const ERROR_SELECTORS: Record<string, string> = {
  '0x5a0e33b5': 'CertificateAlreadyExists',  // CORRECT selector
  '0xb41ba2d6': 'UnauthorizedIssuer',
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

