// frontend/src/hooks/__tests__/useBatchCertificateIssuance.test.ts
import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useBatchCertificateIssuance,
  type BatchCertificateData,
} from '@/hooks/useBatchCertificateIssuance';
import { useWriteContract, useWaitForTransactionReceipt } from 'wagmi';

vi.mock('wagmi', () => ({
  useWriteContract: vi.fn(),
  useWaitForTransactionReceipt: vi.fn(),
}));

vi.mock('@/lib/wagmi', () => ({
  CERTIFICATE_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
}));

vi.mock('@/lib/errorDecoding', () => ({
  decodeContractError: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : String(err)
  ),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

const mockUseWriteContract = useWriteContract as ReturnType<typeof vi.fn>;
const mockUseWaitForTransactionReceipt = useWaitForTransactionReceipt as ReturnType<typeof vi.fn>;

const VALID_CERT: BatchCertificateData = {
  documentHash: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  studentWallet: '0x1111111111111111111111111111111111111111',
  metadataURI: '',
  graduationYear: 2024,
};

// ─────────────────────────────────────────────────────────────
// useBatchCertificateIssuance
// ─────────────────────────────────────────────────────────────

describe('useBatchCertificateIssuance', () => {
  let writeState: {
    data: `0x${string}` | undefined;
    writeContractAsync: ReturnType<typeof vi.fn>;
    isPending: boolean;
    error: Error | null;
    reset: ReturnType<typeof vi.fn>;
  };
  let receiptState: {
    isSuccess: boolean;
    data: { logs: { topics: string[] }[] } | undefined;
    error: Error | null;
  };

  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ── Validation ──────────────────────────────────────────────

  it('rejects an empty batch', async () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    await expect(result.current.issueCertificatesBatch([])).rejects.toThrow(
      'Cannot issue empty batch of certificates'
    );
    expect(writeState.writeContractAsync).not.toHaveBeenCalled();
  });

  it('rejects a batch exceeding 100 certificates', async () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    await expect(
      result.current.issueCertificatesBatch(Array(101).fill(VALID_CERT))
    ).rejects.toThrow('Batch size must be between 1 and 100 certificates');
    expect(writeState.writeContractAsync).not.toHaveBeenCalled();
  });

  it('rejects a cert with graduation year below 1900', async () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    await expect(
      result.current.issueCertificatesBatch([{ ...VALID_CERT, graduationYear: 1899 }])
    ).rejects.toThrow('Invalid graduation year: 1899');
    expect(writeState.writeContractAsync).not.toHaveBeenCalled();
  });

  it('rejects a cert with graduation year above 2100', async () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    await expect(
      result.current.issueCertificatesBatch([{ ...VALID_CERT, graduationYear: 2101 }])
    ).rejects.toThrow('Invalid graduation year: 2101');
  });

  it('rejects a non-integer graduation year', async () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    await expect(
      result.current.issueCertificatesBatch([{ ...VALID_CERT, graduationYear: 2024.5 }])
    ).rejects.toThrow('All certificates must have a valid graduation year');
  });

  it('rejects when the second cert in a multi-cert batch has an invalid year', async () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    await expect(
      result.current.issueCertificatesBatch([
        VALID_CERT,
        { ...VALID_CERT, graduationYear: 1850 },
      ])
    ).rejects.toThrow('Invalid graduation year: 1850');
  });

  // ── Contract call args ───────────────────────────────────────

  it('submits the contract call with decomposed array args', async () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    const certs: BatchCertificateData[] = [
      {
        documentHash: '0xaaaa' as `0x${string}`,
        studentWallet: '0x1111' as `0x${string}`,
        metadataURI: '',
        graduationYear: 2024,
      },
      {
        documentHash: '0xbbbb' as `0x${string}`,
        studentWallet: '0x2222' as `0x${string}`,
        metadataURI: 'ipfs://foo',
        graduationYear: 2023,
      },
    ];

    await act(async () => {
      await result.current.issueCertificatesBatch(certs);
    });

    expect(writeState.writeContractAsync).toHaveBeenCalledWith({
      address: '0x1234567890123456789012345678901234567890',
      abi: expect.any(Array),
      functionName: 'issueCertificatesBatch',
      args: [
        ['0xaaaa', '0xbbbb'],
        ['0x1111', '0x2222'],
        ['', 'ipfs://foo'],
        [2024, 2023],
      ],
    });
  });

  it('uses empty string for metadataURI when not provided', async () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    await act(async () => {
      await result.current.issueCertificatesBatch([
        { ...VALID_CERT, metadataURI: undefined as unknown as string },
      ]);
    });

    const callArgs = writeState.writeContractAsync.mock.calls[0][0];
    expect(callArgs.args[2]).toEqual(['']);
  });

  // ── Transaction phase state machine ─────────────────────────

  it('starts in idle phase with correct defaults', () => {
    const { result } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.transactionPhase).toBe('idle');
    expect(result.current.isPending).toBe(false);
    expect(result.current.isConfirming).toBe(false);
    expect(result.current.isSuccess).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.certificateIds).toEqual([]);
    expect(result.current.transactionHash).toBeUndefined();
  });

  it('enters awaiting_wallet_confirmation when write is pending', () => {
    writeState.isPending = true;
    mockUseWriteContract.mockImplementation(() => writeState);

    const { result } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.transactionPhase).toBe('awaiting_wallet_confirmation');
    expect(result.current.isPending).toBe(true);
    expect(result.current.isConfirming).toBe(false);
  });

  it('enters pending_onchain when hash is set but receipt not yet confirmed', () => {
    writeState.data = '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb' as `0x${string}`;
    mockUseWriteContract.mockImplementation(() => writeState);

    const { result } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.transactionPhase).toBe('pending_onchain');
    expect(result.current.isConfirming).toBe(true);
    expect(result.current.transactionHash).toBe(
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
    );
  });

  it('stays in pending_onchain until MIN_PENDING_DISPLAY_MS elapses after receipt', () => {
    // First: hash arrives, receipt not yet confirmed → pending_onchain
    writeState.data = '0xbbbb' as `0x${string}`;
    mockUseWriteContract.mockImplementation(() => writeState);

    const { result, rerender } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.transactionPhase).toBe('pending_onchain');

    // Now: receipt confirmed → should stay in pending_onchain until timer
    receiptState.isSuccess = true;
    receiptState.data = { logs: [] };
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);
    rerender();

    expect(result.current.transactionPhase).toBe('pending_onchain');

    act(() => { vi.advanceTimersByTime(1199); });
    expect(result.current.transactionPhase).toBe('pending_onchain');

    act(() => { vi.advanceTimersByTime(1); });
    expect(result.current.transactionPhase).toBe('confirmed');
    expect(result.current.isSuccess).toBe(true);
  });

  // ── Error handling ───────────────────────────────────────────

  it('sets failed phase and exposes decoded error string on writeError', () => {
    writeState.error = new Error('user rejected the transaction');
    mockUseWriteContract.mockImplementation(() => writeState);

    const { result } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.transactionPhase).toBe('failed');
    expect(result.current.error).toBe('user rejected the transaction');
  });

  it('sets failed phase on confirmError', () => {
    writeState.data = '0xcccc' as `0x${string}`;
    receiptState.error = new Error('receipt confirmation failed');
    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);

    const { result } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.transactionPhase).toBe('failed');
    expect(result.current.error).toBe('receipt confirmation failed');
  });

  // ── certificateIds extraction ────────────────────────────────

  it('extracts certificateIds from topics[1] of each log', () => {
    writeState.data = '0xbbbb' as `0x${string}`;
    receiptState.isSuccess = true;
    receiptState.data = {
      logs: [
        {
          topics: [
            '0xevent_sig',
            '0x0000000000000000000000000000000000000000000000000000000000000001',
          ],
        },
        {
          topics: [
            '0xevent_sig',
            '0x0000000000000000000000000000000000000000000000000000000000000002',
          ],
        },
      ],
    };
    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);

    const { result } = renderHook(() => useBatchCertificateIssuance());

    act(() => { vi.advanceTimersByTime(1200); });

    expect(result.current.certificateIds).toEqual([1n, 2n]);
  });

  it('returns empty certificateIds when logs have no topics[1]', () => {
    writeState.data = '0xbbbb' as `0x${string}`;
    receiptState.isSuccess = true;
    receiptState.data = { logs: [{ topics: ['0xevent_sig'] }] };
    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);

    const { result } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.certificateIds).toEqual([]);
  });

  it('returns empty certificateIds when receipt has no logs', () => {
    writeState.data = '0xbbbb' as `0x${string}`;
    receiptState.isSuccess = true;
    receiptState.data = undefined;
    mockUseWriteContract.mockImplementation(() => writeState);
    mockUseWaitForTransactionReceipt.mockImplementation(() => receiptState);

    const { result } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.certificateIds).toEqual([]);
  });

  // ── reset() ─────────────────────────────────────────────────

  it('reset() returns to idle and calls the wagmi resetWrite', () => {
    writeState.data = '0xbbbb' as `0x${string}`;
    mockUseWriteContract.mockImplementation(() => writeState);

    const { result } = renderHook(() => useBatchCertificateIssuance());

    expect(result.current.transactionPhase).toBe('pending_onchain');

    act(() => { result.current.reset(); });

    expect(result.current.transactionPhase).toBe('idle');
    expect(writeState.reset).toHaveBeenCalledTimes(1);
  });
});
