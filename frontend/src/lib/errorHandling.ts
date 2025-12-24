/**
 * Comprehensive error handling utilities
 * Provides retry logic, error recovery, and user-friendly error messages
 */

import { logger } from './logger';

/**
 * Error types for categorization
 */
export enum ErrorType {
  NETWORK = 'NETWORK',
  VALIDATION = 'VALIDATION',
  CONTRACT = 'CONTRACT',
  PERMISSION = 'PERMISSION',
  TIMEOUT = 'TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Standard error response interface
 */
export interface ErrorResponse {
  type: ErrorType;
  message: string;
  details?: string;
  recoverable: boolean;
  retryable: boolean;
}

/**
 * Extracts user-friendly error message from various error types
 * @param error - The error to parse
 * @returns ErrorResponse object
 */
export function parseError(error: unknown): ErrorResponse {
  // Handle null/undefined
  if (!error) {
    return {
      type: ErrorType.UNKNOWN,
      message: 'An unknown error occurred',
      recoverable: false,
      retryable: false
    };
  }

  // Handle Error objects
  if (error instanceof Error) {
    const message = error.message.toLowerCase();

    // Network errors
    if (message.includes('network') || message.includes('fetch')) {
      return {
        type: ErrorType.NETWORK,
        message: 'Network error. Please check your connection and try again.',
        details: error.message,
        recoverable: true,
        retryable: true
      };
    }

    // User rejected transaction
    if (message.includes('user rejected') || message.includes('user denied')) {
      return {
        type: ErrorType.PERMISSION,
        message: 'Transaction was rejected',
        details: error.message,
        recoverable: true,
        retryable: true
      };
    }

    // Insufficient funds
    if (message.includes('insufficient funds')) {
      return {
        type: ErrorType.CONTRACT,
        message: 'Insufficient funds to complete transaction',
        details: error.message,
        recoverable: false,
        retryable: false
      };
    }

    // Contract revert
    if (message.includes('revert') || message.includes('execution reverted')) {
      return {
        type: ErrorType.CONTRACT,
        message: 'Smart contract rejected the transaction',
        details: extractRevertReason(error.message),
        recoverable: false,
        retryable: false
      };
    }

    // Timeout
    if (message.includes('timeout')) {
      return {
        type: ErrorType.TIMEOUT,
        message: 'Request timed out. Please try again.',
        details: error.message,
        recoverable: true,
        retryable: true
      };
    }

    // Generic error
    return {
      type: ErrorType.UNKNOWN,
      message: error.message || 'An unexpected error occurred',
      recoverable: false,
      retryable: false
    };
  }

  // Handle string errors
  if (typeof error === 'string') {
    return {
      type: ErrorType.UNKNOWN,
      message: error,
      recoverable: false,
      retryable: false
    };
  }

  // Handle object errors (e.g., from wagmi)
  if (typeof error === 'object') {
    const errorObj = error as Record<string, unknown>;
    const message = String(errorObj.message || errorObj.reason || 'Unknown error');
    
    return parseError(new Error(message));
  }

  return {
    type: ErrorType.UNKNOWN,
    message: 'An unknown error occurred',
    recoverable: false,
    retryable: false
  };
}

/**
 * Extracts the revert reason from an error message
 * @param message - The error message
 * @returns The extracted revert reason
 */
function extractRevertReason(message: string): string {
  // Try to extract reason from common patterns
  const patterns = [
    /reason="([^"]+)"/,
    /reverted with reason string '([^']+)'/,
    /execution reverted: ([^\n]+)/
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return message;
}

/**
 * Retry configuration
 */
export interface RetryConfig {
  maxAttempts: number;
  delayMs: number;
  backoffMultiplier: number;
  shouldRetry?: (error: ErrorResponse) => boolean;
}

/**
 * Default retry configuration
 */
const defaultRetryConfig: RetryConfig = {
  maxAttempts: 3,
  delayMs: 1000,
  backoffMultiplier: 2,
  shouldRetry: (error) => error.retryable
};

/**
 * Retries an async operation with exponential backoff
 * @param operation - The async operation to retry
 * @param config - Retry configuration
 * @returns The result of the operation
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const finalConfig = { ...defaultRetryConfig, ...config };
  let lastError: ErrorResponse | undefined;

  for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
    try {
      logger.debug(`Attempt ${attempt}/${finalConfig.maxAttempts}`);
      return await operation();
    } catch (error) {
      lastError = parseError(error);
      
      logger.warn(`Attempt ${attempt} failed`, {
        error: lastError,
        retriesLeft: finalConfig.maxAttempts - attempt
      });

      // Check if we should retry
      const shouldRetry = finalConfig.shouldRetry
        ? finalConfig.shouldRetry(lastError)
        : lastError.retryable;

      if (!shouldRetry || attempt === finalConfig.maxAttempts) {
        throw error;
      }

      // Wait before retrying with exponential backoff
      const delay = finalConfig.delayMs * Math.pow(finalConfig.backoffMultiplier, attempt - 1);
      await sleep(delay);
    }
  }

  // This should never happen, but TypeScript needs it
  throw new Error(lastError?.message || 'Operation failed after retries');
}

/**
 * Sleep utility
 * @param ms - Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Wraps an async operation with timeout
 * @param operation - The async operation
 * @param timeoutMs - Timeout in milliseconds
 * @returns The result of the operation
 */
export async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return Promise.race([
    operation,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Operation timed out')), timeoutMs)
    )
  ]);
}

/**
 * Safe async wrapper that catches errors and returns Result type
 * @param operation - The async operation
 * @returns Result with either data or error
 */
export async function safeAsync<T>(
  operation: () => Promise<T>
): Promise<{ data?: T; error?: ErrorResponse }> {
  try {
    const data = await operation();
    return { data };
  } catch (error) {
    const errorResponse = parseError(error);
    logger.error('Safe async operation failed', errorResponse);
    return { error: errorResponse };
  }
}

/**
 * Debounce utility for rate limiting user actions
 * @param fn - The function to debounce
 * @param delayMs - Delay in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
}

/**
 * Throttle utility for rate limiting user actions
 * @param fn - The function to throttle
 * @param limitMs - Minimum time between calls in milliseconds
 * @returns Throttled function
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number
): (...args: Parameters<T>) => void {
  let lastRun = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastRun >= limitMs) {
      fn(...args);
      lastRun = now;
    }
  };
}
