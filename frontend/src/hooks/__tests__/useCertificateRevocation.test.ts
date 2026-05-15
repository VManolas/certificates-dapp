// src/hooks/__tests__/useCertificateRevocation.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useCertificateRevocation } from '../useCertificateRevocation';
import * as wagmi from 'wagmi';

// Mock wagmi
vi.mock('wagmi', () => ({
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    transaction: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    contract: vi.fn(),
  },
}));

// Mock wagmi config
vi.mock('@/lib/wagmi', () => ({
  CERTIFICATE_REGISTRY_ADDRESS: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
}));

describe('useCertificateRevocation', () => {
  const mockWriteContractAsync = vi.fn();
  const mockReset = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();

    (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
      writeContractAsync: mockWriteContractAsync,
      data: undefined,
      isPending: false,
      error: null,
      reset: mockReset,
    });

    (wagmi.useWaitForTransactionReceipt as ReturnType<typeof vi.fn>).mockReturnValue({
      isLoading: false,
      isSuccess: false,
      error: null,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('revokeCertificate function', () => {
    it('requires certificateId parameter', async () => {
      const { result } = renderHook(() => useCertificateRevocation());
      await expect(
        result.current.revokeCertificate(null as unknown as bigint, 'Test reason')
      ).rejects.toThrow('Invalid certificate ID');
    });

    it('requires reason parameter', async () => {
      const { result } = renderHook(() => useCertificateRevocation());
      await expect(result.current.revokeCertificate(1n, '')).rejects.toThrow(
        'Revocation reason is required'
      );
    });

    it('validates reason length (maximum)', async () => {
      const { result } = renderHook(() => useCertificateRevocation());
      const longReason = 'a'.repeat(501);
      await expect(result.current.revokeCertificate(1n, longReason)).rejects.toThrow(
        'Revocation reason must be less than 500 characters'
      );
    });

    it('accepts valid reason within limits', async () => {
      const { result } = renderHook(() => useCertificateRevocation());
      const validReason = 'Certificate revoked due to fraudulent information';
      await result.current.revokeCertificate(1n, validReason);
      expect(mockWriteContractAsync).toHaveBeenCalledWith({
        address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        abi: expect.any(Array),
        functionName: 'revokeCertificate',
        args: [1n, validReason],
      });
    });

    it('calls writeContractAsync with correct parameters', async () => {
      const { result } = renderHook(() => useCertificateRevocation());
      await result.current.revokeCertificate(123n, 'Academic misconduct detected');
      expect(mockWriteContractAsync).toHaveBeenCalledWith({
        address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        abi: expect.any(Array),
        functionName: 'revokeCertificate',
        args: [123n, 'Academic misconduct detected'],
      });
    });

    it('handles different reason lengths', async () => {
      const { result } = renderHook(() => useCertificateRevocation());

      // Minimum valid length (1 character)
      await result.current.revokeCertificate(1n, 'A');
      expect(mockWriteContractAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({
          args: [1n, 'A'],
        })
      );

      // Maximum valid length (500 characters)
      const maxReason = 'a'.repeat(500);
      await result.current.revokeCertificate(2n, maxReason);
      expect(mockWriteContractAsync).toHaveBeenLastCalledWith(
        expect.objectContaining({
          args: [2n, maxReason],
        })
      );
    });

    it('accepts various reason formats', async () => {
      const { result } = renderHook(() => useCertificateRevocation());

      const testReasons = [
        'Simple reason',
        'Reason with numbers: 12345',
        'Reason with special chars: @#$%',
        'Multi-line\nreason\ntext',
        'Reason with unicode: 日本語',
      ];

      for (const [index, reason] of testReasons.entries()) {
        const certId = BigInt(index + 1); // Start from 1, not 0
        await result.current.revokeCertificate(certId, reason);
        expect(mockWriteContractAsync).toHaveBeenLastCalledWith(
          expect.objectContaining({
            args: [certId, reason],
          })
        );
      }
    });
  });

  describe('transaction states', () => {
    it('reflects pending state', () => {
      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContractAsync: mockWriteContractAsync,
        data: undefined,
        isPending: true,
        error: null,
        reset: mockReset,
      });

      const { result } = renderHook(() => useCertificateRevocation());

      expect(result.current.isPending).toBe(true);
    });

    it('reflects confirming state', () => {
      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContractAsync: mockWriteContractAsync,
        data: '0xhash123',
        isPending: false,
        error: null,
        reset: mockReset,
      });

      (wagmi.useWaitForTransactionReceipt as ReturnType<typeof vi.fn>).mockReturnValue({
        isLoading: true,
        isSuccess: false,
        error: null,
      });

      const { result } = renderHook(() => useCertificateRevocation());
      expect(result.current.isConfirming).toBe(true);
    });

    it('reflects confirmed state', () => {
      vi.useFakeTimers();

      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContractAsync: mockWriteContractAsync,
        data: '0xhash123',
        isPending: false,
        error: null,
        reset: mockReset,
      });

      (wagmi.useWaitForTransactionReceipt as ReturnType<typeof vi.fn>).mockReturnValue({
        isLoading: false,
        isSuccess: true,
        error: null,
      });

      const { result } = renderHook(() => useCertificateRevocation());
      act(() => {
        vi.advanceTimersByTime(1300);
      });

      expect(result.current.isConfirmed).toBe(true);
      expect(result.current.isSuccess).toBe(true);
    });

    it('handles errors', () => {
      const mockError = new Error('Transaction failed');
      
      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContractAsync: mockWriteContractAsync,
        data: undefined,
        isPending: false,
        error: mockError,
        reset: mockReset,
      });

      const { result } = renderHook(() => useCertificateRevocation());

      expect(result.current.error).toBe(mockError);
    });
  });

  describe('reset functionality', () => {
    it('provides reset function', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      expect(result.current.reset).toBeDefined();
      expect(typeof result.current.reset).toBe('function');
    });

    it('calls wagmi reset when invoked', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      result.current.reset();

      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('transaction hash', () => {
    it('returns transaction hash when available', () => {
      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContractAsync: mockWriteContractAsync,
        data: '0x1234567890abcdef',
        isPending: false,
        error: null,
        reset: mockReset,
      });

      const { result } = renderHook(() => useCertificateRevocation());

      expect(result.current.hash).toBe('0x1234567890abcdef');
      expect(result.current.transactionHash).toBe('0x1234567890abcdef');
    });
  });

  describe('edge cases', () => {
    it('handles very large certificate IDs', async () => {
      const { result } = renderHook(() => useCertificateRevocation());
      const largeCertId = 2n ** 200n;

      await result.current.revokeCertificate(largeCertId, 'Valid reason');

      expect(mockWriteContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [largeCertId, 'Valid reason'],
        })
      );
    });

    it('handles reason with only whitespace as invalid', async () => {
      const { result } = renderHook(() => useCertificateRevocation());
      await expect(result.current.revokeCertificate(1n, '   ')).rejects.toThrow(
        'Revocation reason is required'
      );
    });

    it('preserves whitespace in reason payload after validation', async () => {
      const { result } = renderHook(() => useCertificateRevocation());

      await result.current.revokeCertificate(1n, '  Valid reason  ');

      expect(mockWriteContractAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [1n, '  Valid reason  '],
        })
      );
    });
  });
});
