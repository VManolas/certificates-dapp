/**
 * Input sanitization utilities
 * Ensures all user inputs are validated and sanitized before use
 */

import { isAddress } from 'viem';
import { logger } from './logger';

/**
 * Sanitizes a string input by removing dangerous characters
 * @param input - The string to sanitize
 * @param maxLength - Maximum allowed length (default: 500)
 * @returns Sanitized string
 */
export function sanitizeString(input: string, maxLength: number = 500): string {
  if (typeof input !== 'string') {
    logger.warn('Invalid input type for sanitizeString', { type: typeof input });
    return '';
  }

  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');
  
  // Trim whitespace
  sanitized = sanitized.trim();
  
  // Enforce max length
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength);
  }
  
  return sanitized;
}

/**
 * Validates and sanitizes an Ethereum address
 * @param address - The address to validate
 * @returns Sanitized address or null if invalid
 */
export function sanitizeAddress(address: string): `0x${string}` | null {
  if (!address || typeof address !== 'string') {
    logger.warn('Invalid address input', { address });
    return null;
  }

  const trimmed = address.trim();
  
  if (!isAddress(trimmed)) {
    logger.warn('Invalid Ethereum address format', { address: trimmed });
    return null;
  }

  return trimmed as `0x${string}`;
}

/**
 * Sanitizes a metadata URI to prevent injection attacks
 * @param uri - The URI to sanitize
 * @returns Sanitized URI or null if invalid
 */
export function sanitizeMetadataUri(uri: string): string | null {
  if (!uri || typeof uri !== 'string') {
    logger.warn('Invalid URI input', { uri });
    return null;
  }

  const trimmed = uri.trim();
  
  // Check for valid URI patterns (ipfs://, https://, data:)
  const validProtocols = /^(ipfs:\/\/|https:\/\/|data:application\/json;base64,)/;
  
  if (!validProtocols.test(trimmed)) {
    logger.warn('Invalid metadata URI protocol', { uri: trimmed });
    return null;
  }

  // Prevent javascript: and data:text/html URIs
  if (/^(javascript:|data:text\/html)/i.test(trimmed)) {
    logger.error('Dangerous URI protocol detected', { uri: trimmed });
    return null;
  }

  // Enforce max length for URIs
  if (trimmed.length > 2048) {
    logger.warn('URI exceeds maximum length', { length: trimmed.length });
    return null;
  }

  return trimmed;
}

/**
 * Sanitizes certificate metadata object
 * @param metadata - The metadata object to sanitize
 * @returns Sanitized metadata object
 */
export function sanitizeCertificateMetadata(metadata: Record<string, unknown>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  
  const allowedKeys = [
    'studentName',
    'degree',
    'fieldOfStudy',
    'graduationDate',
    'gpa',
    'honors',
    'additionalInfo'
  ];

  for (const key of allowedKeys) {
    const value = metadata[key];
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value, key === 'additionalInfo' ? 1000 : 200);
    }
  }

  return sanitized;
}

/**
 * Validates a bigint value is within safe bounds
 * @param value - The bigint to validate
 * @param min - Minimum allowed value (default: 0)
 * @param max - Maximum allowed value (default: 2^256 - 1)
 * @returns true if valid, false otherwise
 */
export function validateBigInt(
  value: bigint,
  min: bigint = 0n,
  max: bigint = 2n ** 256n - 1n
): boolean {
  try {
    if (typeof value !== 'bigint') {
      logger.warn('Invalid bigint type', { type: typeof value });
      return false;
    }

    if (value < min || value > max) {
      logger.warn('BigInt out of bounds', { value, min, max });
      return false;
    }

    return true;
  } catch (error) {
    logger.error('BigInt validation error', error);
    return false;
  }
}

/**
 * Sanitizes file upload to ensure it's a valid PDF
 * @param file - The file to validate
 * @param maxSize - Maximum file size in bytes (default: 10MB)
 * @returns Validation result with error message if invalid
 */
export function validatePdfFile(
  file: File,
  maxSize: number = 10 * 1024 * 1024
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Check file type
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: `Invalid file type: ${file.type}. Only PDF files are allowed.`
    };
  }

  // Check file size
  if (file.size > maxSize) {
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(1);
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: `File size (${fileSizeMB}MB) exceeds maximum allowed size (${maxSizeMB}MB)`
    };
  }

  // Check file size is not zero
  if (file.size === 0) {
    return {
      valid: false,
      error: 'File is empty'
    };
  }

  return { valid: true };
}

/**
 * Rate limiter utility for client-side throttling
 */
export class RateLimiter {
  private attempts: Map<string, number[]> = new Map();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 5, windowMs: number = 60000) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  /**
   * Check if an action is allowed
   * @param key - Unique key for the action (e.g., 'certificate-issue')
   * @returns true if allowed, false if rate limited
   */
  isAllowed(key: string): boolean {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    
    // Remove old attempts outside the time window
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    if (recentAttempts.length >= this.maxAttempts) {
      logger.warn('Rate limit exceeded', { key, attempts: recentAttempts.length });
      return false;
    }

    // Record this attempt
    recentAttempts.push(now);
    this.attempts.set(key, recentAttempts);
    
    return true;
  }

  /**
   * Get remaining attempts for a key
   * @param key - Unique key for the action
   * @returns Number of remaining attempts
   */
  getRemainingAttempts(key: string): number {
    const now = Date.now();
    const attempts = this.attempts.get(key) || [];
    const recentAttempts = attempts.filter(time => now - time < this.windowMs);
    
    return Math.max(0, this.maxAttempts - recentAttempts.length);
  }

  /**
   * Reset rate limit for a key
   * @param key - Unique key for the action
   */
  reset(key: string): void {
    this.attempts.delete(key);
  }
}

// Global rate limiter instance
export const globalRateLimiter = new RateLimiter(5, 60000);
