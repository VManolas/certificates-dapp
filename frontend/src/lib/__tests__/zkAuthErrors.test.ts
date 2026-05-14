// src/lib/__tests__/zkAuthErrors.test.ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getErrorAction,
  getFriendlyError,
  isRecoverableError,
  logError,
} from '@/lib/errors/zkAuthErrors';

describe('zkAuthErrors', () => {
  // ─── getFriendlyError ─────────────────────────────────────────────────────

  describe('getFriendlyError', () => {
    it('returns a generic message for null', () => {
      expect(getFriendlyError(null)).toMatch(/unexpected error/i);
    });

    it('returns a generic message for undefined', () => {
      expect(getFriendlyError(undefined)).toMatch(/unexpected error/i);
    });

    it('handles an exact error message match', () => {
      const err = new Error('RuntimeError: unreachable');
      expect(getFriendlyError(err)).toMatch(/refresh/i);
    });

    it('handles a partial case-insensitive message match', () => {
      const err = new Error('Something about a timeout occurred');
      expect(getFriendlyError(err)).toMatch(/timed out/i);
    });

    it('maps "User rejected" to a polite cancellation message', () => {
      const err = new Error('User rejected');
      expect(getFriendlyError(err)).toMatch(/cancelled/i);
    });

    it('maps "User denied" to an approve-it message', () => {
      const err = new Error('User denied');
      expect(getFriendlyError(err)).toMatch(/approve/i);
    });

    it('maps "Wallet not connected" appropriately', () => {
      const err = new Error('Wallet not connected');
      expect(getFriendlyError(err)).toMatch(/connect your wallet/i);
    });

    it('maps "No stored credentials" to a set-up prompt', () => {
      const err = new Error('No stored credentials');
      expect(getFriendlyError(err)).toMatch(/set one up/i);
    });

    it('maps "execution reverted" for partial match', () => {
      const err = new Error('Transaction execution reverted with gas');
      expect(getFriendlyError(err)).toMatch(/blockchain/i);
    });

    it('returns a fallback message for unknown errors', () => {
      const err = new Error('Some completely unknown error xyz');
      expect(getFriendlyError(err)).toMatch(/something went wrong/i);
    });

    it('handles non-Error objects by converting them to string', () => {
      expect(getFriendlyError('timeout in operation')).toMatch(/timed out/i);
    });

    it('handles plain objects that stringify', () => {
      const result = getFriendlyError({ toString: () => 'timeout error' });
      expect(typeof result).toBe('string');
    });
  });

  // ─── getErrorAction ───────────────────────────────────────────────────────

  describe('getErrorAction', () => {
    it('returns "retry" action for null error', () => {
      expect(getErrorAction(null).action).toBe('retry');
    });

    it('returns "clear-cache" for constraint-related errors', () => {
      const err = new Error('Cannot satisfy constraint');
      expect(getErrorAction(err).action).toBe('clear-cache');
    });

    it('returns "clear-cache" for cache-related errors', () => {
      const err = new Error('Failed to clear cache entry');
      expect(getErrorAction(err).action).toBe('clear-cache');
    });

    it('returns "connect-wallet" for wallet-related errors', () => {
      const err = new Error('Wallet not connected');
      expect(getErrorAction(err).action).toBe('connect-wallet');
    });

    it('returns "connect-wallet" for connect-related errors', () => {
      const err = new Error('Failed to connect to provider');
      expect(getErrorAction(err).action).toBe('connect-wallet');
    });

    it('returns "refresh" for network errors', () => {
      const err = new Error('Network Error');
      expect(getErrorAction(err).action).toBe('refresh');
    });

    it('returns "refresh" for timeout errors', () => {
      const err = new Error('Request timeout exceeded');
      expect(getErrorAction(err).action).toBe('refresh');
    });

    it('returns "refresh" for unreachable errors', () => {
      const err = new Error('RuntimeError: unreachable');
      expect(getErrorAction(err).action).toBe('refresh');
    });

    it('returns "clear-cache" for credential errors', () => {
      const err = new Error('Invalid credentials found');
      expect(getErrorAction(err).action).toBe('clear-cache');
    });

    it('returns "clear-cache" for commitment mismatch', () => {
      const err = new Error('Commitment mismatch detected');
      expect(getErrorAction(err).action).toBe('clear-cache');
    });

    it('returns "retry" and a label for unknown errors', () => {
      const result = getErrorAction(new Error('completely unknown'));
      expect(result.action).toBe('retry');
      expect(typeof result.label).toBe('string');
    });
  });

  // ─── isRecoverableError ───────────────────────────────────────────────────

  describe('isRecoverableError', () => {
    it('returns false for null', () => {
      expect(isRecoverableError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isRecoverableError(undefined)).toBe(false);
    });

    it('returns false for "not configured" errors', () => {
      expect(isRecoverableError(new Error('ZK Auth is not configured'))).toBe(false);
    });

    it('returns false for "registry not configured" errors', () => {
      expect(isRecoverableError(new Error('Registry not configured'))).toBe(false);
    });

    it('returns false for "invalid contract" errors', () => {
      expect(isRecoverableError(new Error('invalid contract address'))).toBe(false);
    });

    it('returns true for recoverable errors like network failures', () => {
      expect(isRecoverableError(new Error('Network Error'))).toBe(true);
    });

    it('returns true for wallet-related errors', () => {
      expect(isRecoverableError(new Error('User rejected transaction'))).toBe(true);
    });

    it('returns true for credential errors', () => {
      expect(isRecoverableError(new Error('No stored credentials'))).toBe(true);
    });
  });

  // ─── logError ─────────────────────────────────────────────────────────────

  describe('logError', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('calls console.error in DEV mode (Vitest runs in DEV)', () => {
      logError(new Error('test error'), 'TestContext');
      expect(console.error).toHaveBeenCalled();
    });

    it('includes the context string in the log output', () => {
      logError(new Error('oops'), 'MyComponent');
      const firstCall = (console.error as ReturnType<typeof vi.fn>).mock.calls[0];
      const logString = firstCall[0] as string;
      expect(logString).toContain('MyComponent');
    });

    it('also logs the stack for Error instances', () => {
      logError(new Error('stack test'), 'ctx');
      expect(console.error).toHaveBeenCalledTimes(2); // message + stack
    });

    it('does not throw for non-Error values', () => {
      expect(() => logError('a string error', 'ctx')).not.toThrow();
    });
  });
});
