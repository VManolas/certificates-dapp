// src/lib/__tests__/errorHandling.test.ts
import { describe, it, expect, vi } from 'vitest';
import {
  ErrorType,
  parseError,
  withRetry,
} from '../errorHandling';

describe('errorHandling utilities', () => {
  describe('parseError', () => {
    it('handles null/undefined errors', () => {
      const result = parseError(null);
      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBe('An unknown error occurred');
      expect(result.retryable).toBe(false);
    });

    it('detects network errors', () => {
      const error = new Error('Network request failed');
      const result = parseError(error);

      expect(result.type).toBe(ErrorType.NETWORK);
      expect(result.retryable).toBe(true);
      expect(result.recoverable).toBe(true);
    });

    it('detects user rejected transactions', () => {
      const error = new Error('User rejected the transaction');
      const result = parseError(error);

      expect(result.type).toBe(ErrorType.PERMISSION);
      expect(result.message).toBe('Transaction was rejected');
      expect(result.retryable).toBe(true);
    });

    it('detects insufficient funds errors', () => {
      const error = new Error('insufficient funds for gas');
      const result = parseError(error);

      expect(result.type).toBe(ErrorType.CONTRACT);
      expect(result.message).toBe('Insufficient funds to complete transaction');
      expect(result.retryable).toBe(false);
    });

    it('detects contract revert errors', () => {
      const error = new Error('execution reverted: Certificate already exists');
      const result = parseError(error);

      expect(result.type).toBe(ErrorType.CONTRACT);
      expect(result.message).toBe('Smart contract rejected the transaction');
      expect(result.details).toContain('Certificate already exists');
    });

    it('detects timeout errors', () => {
      const error = new Error('Request timeout exceeded');
      const result = parseError(error);

      expect(result.type).toBe(ErrorType.TIMEOUT);
      expect(result.retryable).toBe(true);
    });

    it('handles string errors', () => {
      const result = parseError('Something went wrong');

      expect(result.type).toBe(ErrorType.UNKNOWN);
      expect(result.message).toBe('Something went wrong');
    });

    it('handles object errors', () => {
      const error = { message: 'Custom error', code: 'E001' };
      const result = parseError(error);

      expect(result.message).toBe('Custom error');
    });

    it('extracts revert reason from error message', () => {
      const error = new Error('Error: VM Exception while processing transaction: reverted with reason string \'Invalid certificate ID\'');
      const result = parseError(error);

      expect(result.details).toContain('Invalid certificate ID');
    });
  });

  describe('withRetry', () => {
    it('succeeds on first attempt', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withRetry(operation);

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('retries on failure and eventually succeeds', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue('success');

      const result = await withRetry(operation, { maxAttempts: 3, delayMs: 10 });

      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('throws after max attempts exceeded', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Network error'));

      await expect(
        withRetry(operation, { maxAttempts: 3, delayMs: 10 })
      ).rejects.toThrow('Network error');

      expect(operation).toHaveBeenCalledTimes(3);
    });

    it('respects custom shouldRetry logic', async () => {
      const operation = vi.fn().mockRejectedValue(new Error('Contract revert'));

      await expect(
        withRetry(operation, {
          maxAttempts: 3,
          delayMs: 10,
          shouldRetry: (error) => error.type === ErrorType.NETWORK
        })
      ).rejects.toThrow();

      expect(operation).toHaveBeenCalledTimes(1); // Should not retry
    });

    it('applies exponential backoff', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce(new Error('network fail'))
        .mockRejectedValueOnce(new Error('network fail'))
        .mockResolvedValue('success');

      const start = Date.now();
      await withRetry(operation, {
        maxAttempts: 3,
        delayMs: 100,
        backoffMultiplier: 2
      });
      const duration = Date.now() - start;

      // Should wait: 100ms + 200ms = 300ms minimum
      expect(duration).toBeGreaterThanOrEqual(300);
    });
  });

});
