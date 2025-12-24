// src/hooks/__tests__/useCertificateRevocation.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useCertificateRevocation } from '../useCertificateRevocation';
import * as wagmi from 'wagmi';

// Mock wagmi
vi.mock('wagmi', () => ({
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
  useAccount: vi.fn(),
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
  const mockWriteContract = vi.fn();
  const mockReset = vi.fn();
  
  beforeEach(() => {
    vi.clearAllMocks();

    (wagmi.useAccount as ReturnType<typeof vi.fn>).mockReturnValue({
      address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0',
      isConnected: true,
    });

    (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
      writeContract: mockWriteContract,
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

  describe('revokeCertificate function', () => {
    it('requires certificateId parameter', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      expect(() => {
        result.current.revokeCertificate(null as unknown as bigint, 'Test reason');
      }).toThrow();
    });

    it('requires reason parameter', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      expect(() => {
        result.current.revokeCertificate(1n, '');
      }).toThrow();
    });

    it('validates reason length (minimum)', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      expect(() => {
        result.current.revokeCertificate(1n, '');
      }).toThrow();
    });

    it('validates reason length (maximum)', () => {
      const { result } = renderHook(() => useCertificateRevocation());
      const longReason = 'a'.repeat(501);

      expect(() => {
        result.current.revokeCertificate(1n, longReason);
      }).toThrow();
    });

    it('accepts valid reason within limits', () => {
      const { result } = renderHook(() => useCertificateRevocation());
      const validReason = 'Certificate revoked due to fraudulent information';

      expect(() => {
        result.current.revokeCertificate(1n, validReason);
      }).not.toThrow();

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        abi: expect.any(Array),
        functionName: 'revokeCertificate',
        args: [1n, validReason],
      });
    });

    it('calls writeContract with correct parameters', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      result.current.revokeCertificate(123n, 'Academic misconduct detected');

      expect(mockWriteContract).toHaveBeenCalledWith({
        address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
        abi: expect.any(Array),
        functionName: 'revokeCertificate',
        args: [123n, 'Academic misconduct detected'],
      });
    });

    it('handles different reason lengths', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      // Minimum valid length (1 character)
      result.current.revokeCertificate(1n, 'A');
      expect(mockWriteContract).toHaveBeenLastCalledWith(
        expect.objectContaining({
          args: [1n, 'A'],
        })
      );

      // Maximum valid length (500 characters)
      const maxReason = 'a'.repeat(500);
      result.current.revokeCertificate(2n, maxReason);
      expect(mockWriteContract).toHaveBeenLastCalledWith(
        expect.objectContaining({
          args: [2n, maxReason],
        })
      );
    });

    it('accepts various reason formats', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      const testReasons = [
        'Simple reason',
        'Reason with numbers: 12345',
        'Reason with special chars: @#$%',
        'Multi-line\nreason\ntext',
        'Reason with unicode: 日本語',
      ];

      testReasons.forEach((reason, index) => {
        const certId = BigInt(index + 1); // Start from 1, not 0
        result.current.revokeCertificate(certId, reason);
        expect(mockWriteContract).toHaveBeenLastCalledWith(
          expect.objectContaining({
            args: [certId, reason],
          })
        );
      });
    });
  });

  describe('transaction states', () => {
    it('reflects pending state', () => {
      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContract: mockWriteContract,
        data: '0xhash123',
        isPending: true,
        error: null,
        reset: mockReset,
      });

      const { result } = renderHook(() => useCertificateRevocation());

      expect(result.current.isPending).toBe(true);
    });

    it('reflects confirming state', () => {
      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContract: mockWriteContract,
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
      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContract: mockWriteContract,
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

      expect(result.current.isConfirmed).toBe(true);
    });

    it('handles errors', () => {
      const mockError = new Error('Transaction failed');
      
      (wagmi.useWriteContract as ReturnType<typeof vi.fn>).mockReturnValue({
        writeContract: mockWriteContract,
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
        writeContract: mockWriteContract,
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
    it('handles very large certificate IDs', () => {
      const { result } = renderHook(() => useCertificateRevocation());
      const largeCertId = 2n ** 200n;

      result.current.revokeCertificate(largeCertId, 'Valid reason');

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [largeCertId, 'Valid reason'],
        })
      );
    });

    it('handles reason with only whitespace as invalid', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      expect(() => {
        result.current.revokeCertificate(1n, '   ');
      }).toThrow();
    });

    it('trims whitespace from reason', () => {
      const { result } = renderHook(() => useCertificateRevocation());

      result.current.revokeCertificate(1n, '  Valid reason  ');

      expect(mockWriteContract).toHaveBeenCalledWith(
        expect.objectContaining({
          args: [1n, '  Valid reason  '],
        })
      );
    });
  });
});
