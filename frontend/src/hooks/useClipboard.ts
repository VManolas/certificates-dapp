/**
 * useClipboard Hook
 * =================
 * 
 * React hook for clipboard operations with feedback state management.
 * Provides a simple API for copying text to clipboard with automatic reset.
 * 
 * Features:
 * - Copy text to clipboard
 * - Track copy state (success/error)
 * - Automatic state reset after timeout
 * - Field-specific tracking (optional)
 * - Error handling
 * 
 * @module hooks/useClipboard
 */

import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseClipboardOptions {
  /** Duration in ms to show success state (default: 2000) */
  resetDelay?: number;
  
  /** Callback on successful copy */
  onSuccess?: (text: string, field?: string) => void;
  
  /** Callback on copy error */
  onError?: (error: Error, text: string, field?: string) => void;
}

export interface UseClipboardReturn {
  /** Currently copied text */
  copiedText: string | null;
  
  /** Currently copied field identifier */
  copiedField: string | null;
  
  /** Whether text is currently copied */
  isCopied: boolean;
  
  /** Copy text to clipboard */
  copy: (text: string, field?: string) => Promise<boolean>;
  
  /** Reset copied state */
  reset: () => void;
  
  /** Check if a specific field is copied */
  isFieldCopied: (field: string) => boolean;
}

/**
 * Hook for managing clipboard operations
 * 
 * @param options - Configuration options
 * @returns Clipboard state and methods
 * 
 * @example
 * ```tsx
 * function Component() {
 *   const { copy, isCopied, isFieldCopied } = useClipboard({
 *     resetDelay: 2000,
 *     onSuccess: (text) => console.log('Copied:', text),
 *   });
 * 
 *   return (
 *     <button onClick={() => copy('Hello', 'greeting')}>
 *       {isFieldCopied('greeting') ? 'Copied!' : 'Copy'}
 *     </button>
 *   );
 * }
 * ```
 */
export function useClipboard(options: UseClipboardOptions = {}): UseClipboardReturn {
  const {
    resetDelay = 2000,
    onSuccess,
    onError,
  } = options;

  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  /**
   * Reset copied state
   */
  const reset = useCallback(() => {
    setCopiedText(null);
    setCopiedField(null);
    setIsCopied(false);
    
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  /**
   * Copy text to clipboard
   */
  const copy = useCallback(
    async (text: string, field?: string): Promise<boolean> => {
      // Clear any existing timeout
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }

      try {
        // Use Clipboard API
        await navigator.clipboard.writeText(text);
        
        // Update state
        setCopiedText(text);
        setCopiedField(field || null);
        setIsCopied(true);
        
        // Call success callback
        onSuccess?.(text, field);
        
        // Auto-reset after delay
        timeoutRef.current = window.setTimeout(() => {
          reset();
        }, resetDelay);
        
        return true;
      } catch (error) {
        console.error('Failed to copy to clipboard:', error);
        
        // Call error callback
        onError?.(error as Error, text, field);
        
        // Reset state on error
        reset();
        
        return false;
      }
    },
    [resetDelay, onSuccess, onError, reset]
  );

  /**
   * Check if a specific field is currently copied
   */
  const isFieldCopied = useCallback(
    (field: string): boolean => {
      return isCopied && copiedField === field;
    },
    [isCopied, copiedField]
  );

  return {
    copiedText,
    copiedField,
    isCopied,
    copy,
    reset,
    isFieldCopied,
  };
}

/**
 * Simple copy to clipboard utility function
 * For one-off copies without state management
 * 
 * @param text - Text to copy
 * @returns Promise resolving to success boolean
 * 
 * @example
 * ```tsx
 * async function handleCopy() {
 *   const success = await copyToClipboard('Hello World');
 *   if (success) {
 *     alert('Copied!');
 *   }
 * }
 * ```
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}
