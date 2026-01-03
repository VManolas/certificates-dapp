// frontend/src/lib/errors/zkAuthErrors.ts
/**
 * ZK Authentication Error Handling
 * =================================
 * 
 * Provides user-friendly error messages and recovery actions for ZK auth errors.
 * 
 * Usage:
 * ```tsx
 * import { getFriendlyError, getErrorAction } from '@/lib/errors/zkAuthErrors';
 * 
 * try {
 *   await register('student');
 * } catch (error) {
 *   const message = getFriendlyError(error);
 *   const action = getErrorAction(error);
 *   // Show message and action to user
 * }
 * ```
 */

export interface ErrorAction {
  label: string;
  action: 'refresh' | 'clear-cache' | 'connect-wallet' | 'retry' | 'none';
}

/**
 * Map of technical error messages to user-friendly explanations
 */
const ZK_AUTH_ERROR_MAP: Record<string, string> = {
  // Runtime errors
  'RuntimeError: unreachable': 
    'Connection interrupted. Please refresh the page and try again.',
  
  // Constraint errors
  'Cannot satisfy constraint': 
    'Setup encountered a technical issue. Please clear your browser cache and try again.',
  
  // Contract errors
  'Contract interaction failed': 
    'Unable to connect to the blockchain. Please check your wallet connection and try again.',
  'execution reverted': 
    'Transaction was rejected by the blockchain. Please check your wallet balance and try again.',
  
  // Wallet errors
  'Wallet not connected': 
    'Please connect your wallet to continue with private login.',
  'User rejected': 
    'You cancelled the wallet request. Please try again when ready.',
  'User denied': 
    'You declined the wallet request. Please approve it to continue.',
  
  // Credential errors
  'No stored credentials': 
    'No private login found. Let\'s set one up now!',
  'Commitment mismatch': 
    'Your stored credentials don\'t match. Please clear them and set up again.',
  'Invalid credentials': 
    'Your credentials appear corrupted. Please clear them and register again.',
  
  // Network errors
  'Network Error': 
    'Network connection failed. Please check your internet and try again.',
  'timeout': 
    'Request timed out. Please check your connection and try again.',
  
  // Configuration errors
  'not configured': 
    'ZK Authentication is not properly configured. Please contact support.',
  'Registry not configured': 
    'The authentication system is not set up. Please contact support.',
};

/**
 * Get user-friendly error message from technical error
 */
export function getFriendlyError(error: unknown): string {
  if (!error) {
    return 'An unexpected error occurred. Please try again.';
  }

  const message = error instanceof Error ? error.message : String(error);

  // Check for exact matches first
  if (ZK_AUTH_ERROR_MAP[message]) {
    return ZK_AUTH_ERROR_MAP[message];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(ZK_AUTH_ERROR_MAP)) {
    if (message.toLowerCase().includes(key.toLowerCase())) {
      return value;
    }
  }

  // Default fallback
  return 'Something went wrong. Please try again or contact support if the issue persists.';
}

/**
 * Get recommended action for error
 */
export function getErrorAction(error: unknown): ErrorAction {
  if (!error) {
    return { label: 'Try Again', action: 'retry' };
  }

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Cache-related errors
  if (lowerMessage.includes('cache') || lowerMessage.includes('constraint')) {
    return { label: 'Clear Cache & Retry', action: 'clear-cache' };
  }

  // Wallet-related errors
  if (lowerMessage.includes('wallet') || lowerMessage.includes('connect')) {
    return { label: 'Connect Wallet', action: 'connect-wallet' };
  }

  // Network/connection errors
  if (lowerMessage.includes('network') || lowerMessage.includes('timeout') || 
      lowerMessage.includes('unreachable') || lowerMessage.includes('connection')) {
    return { label: 'Refresh Page', action: 'refresh' };
  }

  // Credential errors
  if (lowerMessage.includes('credential') || lowerMessage.includes('commitment')) {
    return { label: 'Clear Credentials', action: 'clear-cache' };
  }

  // Default action
  return { label: 'Try Again', action: 'retry' };
}

/**
 * Check if error is recoverable by user
 */
export function isRecoverableError(error: unknown): boolean {
  if (!error) return false;

  const message = error instanceof Error ? error.message : String(error);
  const lowerMessage = message.toLowerCase();

  // Non-recoverable errors
  const nonRecoverable = [
    'not configured',
    'registry not configured',
    'invalid contract',
  ];

  return !nonRecoverable.some(term => lowerMessage.includes(term));
}

/**
 * Log error for debugging (development only)
 */
export function logError(error: unknown, context: string): void {
  if (import.meta.env.DEV) {
    console.error(`[ZK Auth Error - ${context}]`, error);
    
    if (error instanceof Error) {
      console.error('Stack:', error.stack);
    }
  }
}

