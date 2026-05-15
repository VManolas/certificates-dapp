import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  useCertificateDetails,
  useCertificateVerification,
} from '@/hooks/useCertificateVerification';

const mockUseReadContract = vi.fn();
const mockValidateTuple = vi.fn();
const mockParseError = vi.fn();
const mockLogger = vi.hoisted(() => ({
  error: vi.fn(),
  debug: vi.fn(),
}));

vi.mock('wagmi', () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
}));

vi.mock('@/lib/validation', () => ({
  validateTuple: (...args: unknown[]) => mockValidateTuple(...args),
  certificateVerificationSchema: { name: 'certificateVerificationSchema' },
}));

vi.mock('@/lib/errorHandling', () => ({
  parseError: (...args: unknown[]) => mockParseError(...args),
}));

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

vi.mock('@/lib/wagmi', () => ({
  CERTIFICATE_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
}));

describe('useCertificateVerification', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    });
    mockValidateTuple.mockImplementation((_schema: unknown, data: unknown) => data);
    mockParseError.mockReturnValue({
      message: 'Normalized error',
      type: 'unknown',
      retryable: false,
    });
  });

  it('normalizes valid contract verification results', () => {
    const refetch = vi.fn();
    mockUseReadContract.mockReturnValue({
      data: [true, 42n, false],
      isLoading: false,
      error: null,
      refetch,
      dataUpdatedAt: Date.parse('2026-05-14T12:00:00.000Z'),
    });

    const { result } = renderHook(() =>
      useCertificateVerification(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )
    );

    expect(result.current.isValid).toBe(true);
    expect(result.current.isRevoked).toBe(false);
    expect(result.current.certificateId).toBe(42n);
    expect(result.current.verificationTimestamp?.toISOString()).toBe('2026-05-14T12:00:00.000Z');

    act(() => {
      result.current.refetch();
    });

    expect(refetch).toHaveBeenCalledTimes(1);
    expect(mockLogger.debug).toHaveBeenCalled();
  });

  it('returns safe defaults when tuple validation fails', () => {
    mockUseReadContract.mockReturnValue({
      data: ['bad'],
      isLoading: false,
      error: null,
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    });
    mockValidateTuple.mockReturnValue(null);

    const { result } = renderHook(() =>
      useCertificateVerification(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )
    );

    expect(result.current.isValid).toBe(false);
    expect(result.current.isRevoked).toBe(false);
    expect(result.current.certificateId).toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Certificate verification data validation failed',
      undefined,
      { data: ['bad'] }
    );
  });

  it('normalizes read errors with parseError', () => {
    mockUseReadContract.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('raw failure'),
      refetch: vi.fn(),
      dataUpdatedAt: 0,
    });
    mockParseError.mockReturnValue({
      message: 'Human readable failure',
      type: 'rpc',
      retryable: true,
    });

    const { result } = renderHook(() =>
      useCertificateVerification(
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
      )
    );

    expect(result.current.error?.message).toBe('Human readable failure');
    expect(mockLogger.error).toHaveBeenCalled();
  });

  it('passes disabled/enabled args correctly to wagmi', () => {
    renderHook(() => useCertificateVerification(undefined, false));

    expect(mockUseReadContract).toHaveBeenCalledWith(
      expect.objectContaining({
        args: undefined,
        query: expect.objectContaining({
          enabled: false,
        }),
      })
    );
  });
});

describe('certificate detail hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns certificate details by id', () => {
    const certificate = { certificateId: 7n, studentWallet: '0x1' };
    mockUseReadContract.mockReturnValue({
      data: certificate,
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    const { result } = renderHook(() => useCertificateDetails(7n));
    expect(result.current.certificate).toEqual(certificate);
  });

});
