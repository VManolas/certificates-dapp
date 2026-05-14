import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useCertificateIssuance,
  useCertificateIssuanceWithCallback,
} from '@/hooks/useCertificateIssuance';
import { useWaitForTransactionReceipt, useWriteContract } from 'wagmi';
import { decodeEventLog } from 'viem';

vi.mock('wagmi', () => ({
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
}));

vi.mock('viem', () => ({
  decodeEventLog: vi.fn(),
}));

vi.mock('@/lib/wagmi', () => ({
  CERTIFICATE_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
}));

const mockUseWriteContract = useWriteContract as ReturnType<typeof vi.fn>;
const mockUseWaitForTransactionReceipt = useWaitForTransactionReceipt as ReturnType<typeof vi.fn>;
const mockDecodeEventLog = decodeEventLog as ReturnType<typeof vi.fn>;

describe('useCertificateIssuance', () => {
  let writeState: any;
  let receiptState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.useFakeTimers();

    writeState = {
      data: undefined,
      writeContractAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    };

    receiptState = {
      isSuccess: false,
      data: undefined,
      error: null,
    };

    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);
    mockDecodeEventLog.mockReturnValue({
      eventName: 'CertificateIssued',
      args: { certificateId: 42n },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('validates certificate issuance params before submitting', async () => {
    const { result } = renderHook(() => useCertificateIssuance());

    await expect(
      result.current.issueCertificate({
        documentHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
        studentWallet: '0x1111111111111111111111111111111111111111',
        graduationYear: 2025,
      })
    ).rejects.toThrow('Valid document hash is required');

    await expect(
      result.current.issueCertificate({
        documentHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        studentWallet: '0x1111111111111111111111111111111111111111',
        graduationYear: 1800,
      })
    ).rejects.toThrow('Graduation year must be between 1900 and 2100');

    expect(writeState.writeContractAsync).not.toHaveBeenCalled();
  });

  it('submits the contract call with normalized args', async () => {
    const { result } = renderHook(() => useCertificateIssuance());

    await act(async () => {
      await result.current.issueCertificate({
        documentHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        studentWallet: '0x1111111111111111111111111111111111111111',
        graduationYear: 2025,
      });
    });

    expect(writeState.writeContractAsync).toHaveBeenCalledWith({
      address: '0x1234567890123456789012345678901234567890',
      abi: expect.any(Array),
      functionName: 'issueCertificate',
      args: [
        '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
        '0x1111111111111111111111111111111111111111',
        '',
        2025,
      ],
    });
  });

  it('tracks pending, confirming, confirmed, and reset phases', () => {
    const { result, rerender } = renderHook(() => useCertificateIssuance());

    expect(result.current.transactionPhase).toBe('idle');

    writeState.isPending = true;
    mockUseWriteContract.mockImplementation(() => writeState);
    rerender();
    expect(result.current.transactionPhase).toBe('awaiting_wallet_confirmation');

    writeState.isPending = false;
    writeState.data = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb';
    receiptState.isSuccess = false;
    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);
    rerender();
    expect(result.current.transactionPhase).toBe('pending_onchain');

    receiptState.isSuccess = true;
    receiptState.data = {
      logs: [
        {
          address: '0x1234567890123456789012345678901234567890',
          data: '0x',
          topics: ['0x1'],
        },
      ],
    };
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);
    rerender();

    expect(result.current.transactionPhase).toBe('pending_onchain');
    act(() => {
      vi.advanceTimersByTime(1200);
    });
    expect(result.current.transactionPhase).toBe('confirmed');
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.certificateId).toBe(42n);

    act(() => {
      result.current.reset();
    });
    expect(writeState.reset).toHaveBeenCalledTimes(1);
    expect(result.current.transactionPhase).toBe('idle');
  });

  it('surfaces write and confirmation errors', () => {
    writeState.error = new Error('wallet rejected');
    mockUseWriteContract.mockImplementation(() => writeState);

    const { result, rerender } = renderHook(() => useCertificateIssuance());
    expect(result.current.transactionPhase).toBe('failed');
    expect(result.current.error?.message).toBe('wallet rejected');

    writeState.error = null;
    receiptState.error = new Error('receipt failed');
    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);
    rerender();

    expect(result.current.transactionPhase).toBe('failed');
    expect(result.current.error?.message).toBe('receipt failed');
  });
});

describe('useCertificateIssuanceWithCallback', () => {
  let writeState: any;
  let receiptState: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();

    writeState = {
      data: '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      writeContractAsync: vi.fn(),
      isPending: false,
      error: null,
      reset: vi.fn(),
    };

    receiptState = {
      isSuccess: true,
      data: {
        logs: [
          {
            address: '0x1234567890123456789012345678901234567890',
            data: '0x',
            topics: ['0x1'],
          },
        ],
      },
      error: null,
    };

    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);
    mockDecodeEventLog.mockReturnValue({
      eventName: 'CertificateIssued',
      args: { certificateId: 7n },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('fires success callback once per transaction', () => {
    const onSuccess = vi.fn();
    const { rerender } = renderHook(() => useCertificateIssuanceWithCallback(onSuccess));

    act(() => {
      vi.advanceTimersByTime(1200);
    });
    rerender();
    rerender();

    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(onSuccess).toHaveBeenCalledWith(
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      7n
    );
  });

  it('fires onError callback when writeError occurs', () => {
    writeState.data = undefined;
    writeState.error = new Error('user rejected');
    receiptState.isSuccess = false;
    receiptState.data = undefined;
    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);

    const onError = vi.fn();
    renderHook(() => useCertificateIssuanceWithCallback(undefined, onError));

    expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'user rejected' }));
  });

  it('does not call onError more than once for the same error', () => {
    writeState.data = undefined;
    writeState.error = new Error('user rejected');
    receiptState.isSuccess = false;
    receiptState.data = undefined;
    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);

    const onError = vi.fn();
    const { rerender } = renderHook(() =>
      useCertificateIssuanceWithCallback(undefined, onError)
    );
    rerender();
    rerender();

    expect(onError).toHaveBeenCalledTimes(1);
  });
});
