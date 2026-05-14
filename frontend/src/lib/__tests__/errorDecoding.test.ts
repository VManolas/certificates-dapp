// src/lib/__tests__/errorDecoding.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Hoist stable vi.fn() references ─────────────────────────────────────────
const { mockDecodeErrorResult } = vi.hoisted(() => ({
  mockDecodeErrorResult: vi.fn(),
}));

// ─── Mocks ───────────────────────────────────────────────────────────────────
vi.mock('viem', () => ({
  decodeErrorResult: mockDecodeErrorResult,
}));

vi.mock('@/contracts/abis/CertificateRegistry.json', () => ({
  default: { abi: [] },
  abi: [],
}));

vi.mock('@/contracts/abis/InstitutionRegistry.json', () => ({
  default: { abi: [] },
  abi: [],
}));

vi.mock('@/lib/adminContact', () => ({
  withAdminContact: (msg: string) => msg + ' Contact admin.',
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ─── Import after mocks ───────────────────────────────────────────────────────
import {
  decodeContractError,
  isRetryableError,
  isUserRejectionError,
  hasErrorData,
  getErrorSelector,
  getErrorNameFromSelector,
  ERROR_SELECTORS,
} from '../errorDecoding';

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('decodeContractError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDecodeErrorResult.mockImplementation(() => {
      throw new Error('decode failed');
    });
  });

  // Non-Error inputs
  it('returns "An unknown error occurred" for non-Error input (null)', () => {
    expect(decodeContractError(null)).toBe('An unknown error occurred');
  });

  it('returns "An unknown error occurred" for non-Error input (string)', () => {
    expect(decodeContractError('some string error')).toBe('An unknown error occurred');
  });

  it('returns "An unknown error occurred" for non-Error input (number)', () => {
    expect(decodeContractError(42)).toBe('An unknown error occurred');
  });

  // Fallback keyword matching
  it('fallback: user rejected → rejection message', () => {
    const err = new Error('User rejected the request');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('rejected');
  });

  it('fallback: user denied → rejection message', () => {
    const err = new Error('MetaMask: user denied transaction signature');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('rejected');
  });

  it('fallback: insufficient funds → gas message', () => {
    const err = new Error('insufficient funds for gas');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('insufficient funds');
  });

  it('fallback: network error → network message', () => {
    const err = new Error('network request failed');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('network');
  });

  it('fallback: timeout → timeout message', () => {
    const err = new Error('Request timeout exceeded');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('timed out');
  });

  it('fallback: nonce too low → nonce message', () => {
    const err = new Error('nonce too low: next nonce = 5');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('nonce');
  });

  it('fallback: fetch failed → network message', () => {
    const err = new Error('fetch failed: could not connect');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('network');
  });

  it('fallback: internal json-rpc error + issuecertificate → CertificateAlreadyExists', () => {
    const err = new Error('Internal JSON-RPC error in issueCertificate call');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('already been issued');
  });

  it('fallback: certificatealreadyexists in message', () => {
    const err = new Error('CertificateAlreadyExists() revert');
    const result = decodeContractError(err);
    expect(result.toLowerCase()).toContain('already been issued');
  });

  it('fallback: unknown error message is passed through', () => {
    const err = new Error('Something totally unknown happened XYZ');
    const result = decodeContractError(err);
    expect(result).toBe('Something totally unknown happened XYZ');
  });

  // Data extraction: direct .data property
  it('data extraction: error.data with hex → decodes via decodeErrorResult', () => {
    mockDecodeErrorResult.mockReturnValueOnce({
      errorName: 'CertificateAlreadyExists',
      args: [],
    });

    const err = new Error('contract error') as Error & { data: string };
    err.data = '0x5a0e33b5';

    const result = decodeContractError(err);
    expect(mockDecodeErrorResult).toHaveBeenCalledWith(
      expect.objectContaining({ data: '0x5a0e33b5' })
    );
    expect(result.toLowerCase()).toContain('already been issued');
  });

  // Data extraction: nested cause
  it('data extraction: error.cause.data (recursive) → decodes correctly', () => {
    mockDecodeErrorResult.mockReturnValueOnce({
      errorName: 'CertificateNotFound',
      args: [],
    });

    const causeErr = { data: '0x5f945ea8', message: 'inner cause' };
    const err = new Error('outer error') as Error & { cause: unknown };
    err.cause = causeErr;

    const result = decodeContractError(err);
    expect(mockDecodeErrorResult).toHaveBeenCalled();
    expect(result).toBe('Certificate not found in the registry.');
  });

  // Data extraction: details property
  it('data extraction: error.details containing hex → decodes correctly', () => {
    mockDecodeErrorResult.mockReturnValueOnce({
      errorName: 'UnauthorizedIssuer',
      args: [],
    });

    const err = new Error('error') as Error & { details: string };
    err.details = 'Execution reverted with error 0xb41ba2d6 at contract';

    const result = decodeContractError(err);
    expect(mockDecodeErrorResult).toHaveBeenCalled();
    expect(result).toContain('not authorized to issue');
  });

  // Data extraction: metaMessages array
  it('data extraction: error.metaMessages array containing hex → decodes correctly', () => {
    mockDecodeErrorResult.mockReturnValueOnce({
      errorName: 'InstitutionNotFound',
      args: [],
    });

    const err = new Error('error') as Error & { metaMessages: string[] };
    err.metaMessages = ['some context', 'data: 0x24bb5f30 was the selector'];

    const result = decodeContractError(err);
    expect(mockDecodeErrorResult).toHaveBeenCalled();
    expect(result).toBe('Institution not found in the registry.');
  });

  // Data extraction: walk() method
  it('data extraction: error.walk() method → extracts data and decodes', () => {
    mockDecodeErrorResult.mockReturnValueOnce({
      errorName: 'InstitutionAlreadyExists',
      args: [],
    });

    const innerErr = { data: '0xaa1b103f', message: 'inner' };
    const err = new Error('outer') as Error & { walk: (fn: (e: unknown) => void) => void };
    err.walk = (fn) => { fn(innerErr); };

    const result = decodeContractError(err);
    expect(mockDecodeErrorResult).toHaveBeenCalledWith(
      expect.objectContaining({ data: '0xaa1b103f' })
    );
    expect(result).toBe('This wallet address is already registered as an institution.');
  });

  // Message containing hex selector
  it('error message containing hex selector → decodeErrorResult called with that hex', () => {
    mockDecodeErrorResult.mockReturnValueOnce({
      errorName: 'CertificateAlreadyRevoked',
      args: [],
    });

    const err = new Error('Transaction reverted with error 0x71e8da46');

    const result = decodeContractError(err);
    expect(mockDecodeErrorResult).toHaveBeenCalledWith(
      expect.objectContaining({ data: '0x71e8da46' })
    );
    expect(result).toBe('This certificate has already been revoked.');
  });

  // Addresses (42 hex chars) skipped
  it('skips 42-char address-like hex in message and falls through to fallback', () => {
    // mockDecodeErrorResult should not be called for addresses (42 chars = 0x + 40 hex)
    const err = new Error(
      'Transfer failed from 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0 some unknown reason'
    );

    const result = decodeContractError(err);
    // Either fallback passes through or it returns the original message
    // The address itself should not cause decodeErrorResult to be called with the address
    expect(result).not.toBe('An unknown error occurred');
    // Verify the address-shaped hex was not used as the decode target
    const calls = mockDecodeErrorResult.mock.calls;
    const addressCalls = calls.filter(
      (c) => c[0]?.data === '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb0'
    );
    expect(addressCalls).toHaveLength(0);
  });

  // Unknown error name from decoder
  it('unknown error name from decodeErrorResult → "Contract error: <name>"', () => {
    mockDecodeErrorResult.mockReturnValueOnce({
      errorName: 'SomeUnknownCustomError',
      args: [],
    });

    const err = new Error('error') as Error & { data: string };
    err.data = '0xdeadbeef';

    const result = decodeContractError(err);
    // The function appends args when present, even if empty array is truthy
    expect(result).toContain('Contract error: SomeUnknownCustomError');
  });

  // InstitutionNotActive uses withAdminContact
  it('InstitutionNotActive message contains withAdminContact text', () => {
    mockDecodeErrorResult.mockReturnValueOnce({
      errorName: 'InstitutionNotActive',
      args: [],
    });

    const err = new Error('error') as Error & { data: string };
    err.data = '0x19d5cd7e';

    const result = decodeContractError(err);
    expect(result).toContain('suspended');
    expect(result).toContain('Contact admin.');
  });
});

describe('isRetryableError', () => {
  it('returns true for network errors', () => {
    expect(isRetryableError(new Error('network request failed'))).toBe(true);
  });

  it('returns true for timeout errors', () => {
    expect(isRetryableError(new Error('request timeout exceeded'))).toBe(true);
  });

  it('returns true for nonce too low errors', () => {
    expect(isRetryableError(new Error('nonce too low'))).toBe(true);
  });

  it('returns true for fetch failed errors', () => {
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
  });

  it('returns false for user rejection errors', () => {
    expect(isRetryableError(new Error('User rejected transaction'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isRetryableError(null)).toBe(false);
    expect(isRetryableError('network')).toBe(false);
    expect(isRetryableError(42)).toBe(false);
  });
});

describe('isUserRejectionError', () => {
  it('returns true for "user rejected"', () => {
    expect(isUserRejectionError(new Error('User rejected the request'))).toBe(true);
  });

  it('returns true for "user denied"', () => {
    expect(isUserRejectionError(new Error('MetaMask: user denied signature'))).toBe(true);
  });

  it('returns true for "user cancelled"', () => {
    expect(isUserRejectionError(new Error('user cancelled the action'))).toBe(true);
  });

  it('returns false for network errors', () => {
    expect(isUserRejectionError(new Error('network failed'))).toBe(false);
  });

  it('returns false for non-Error values', () => {
    expect(isUserRejectionError(null)).toBe(false);
    expect(isUserRejectionError('user rejected')).toBe(false);
  });
});

describe('hasErrorData', () => {
  it('returns true for objects with data property', () => {
    expect(hasErrorData({ data: '0xdeadbeef' })).toBe(true);
    expect(hasErrorData({ data: undefined })).toBe(true);
  });

  it('returns false for primitives', () => {
    expect(hasErrorData(null)).toBe(false);
    expect(hasErrorData('string')).toBe(false);
    expect(hasErrorData(42)).toBe(false);
    expect(hasErrorData(undefined)).toBe(false);
  });

  it('returns false for objects without data property', () => {
    expect(hasErrorData({ message: 'error', code: 100 })).toBe(false);
  });
});

describe('getErrorSelector', () => {
  it('returns first 10 chars (0x + 8 hex) for valid hex', () => {
    expect(getErrorSelector('0x5a0e33b5deadbeef1234')).toBe('0x5a0e33b5');
  });

  it('returns the 10-char string for exactly 10 chars', () => {
    expect(getErrorSelector('0x5a0e33b5')).toBe('0x5a0e33b5');
  });

  it('returns null for strings not starting with 0x', () => {
    expect(getErrorSelector('5a0e33b5')).toBeNull();
  });

  it('returns null for strings shorter than 10 chars', () => {
    expect(getErrorSelector('0x12ab')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(getErrorSelector('')).toBeNull();
  });
});

describe('getErrorNameFromSelector', () => {
  it('maps 0x5a0e33b5 to CertificateAlreadyExists', () => {
    expect(getErrorNameFromSelector('0x5a0e33b5')).toBe('CertificateAlreadyExists');
  });

  it('maps 0xb41ba2d6 to UnauthorizedIssuer', () => {
    expect(getErrorNameFromSelector('0xb41ba2d6')).toBe('UnauthorizedIssuer');
  });

  it('maps 0x19d5cd7e to InstitutionNotActive', () => {
    expect(getErrorNameFromSelector('0x19d5cd7e')).toBe('InstitutionNotActive');
  });

  it('returns null for unknown selector', () => {
    expect(getErrorNameFromSelector('0xdeadbeef')).toBeNull();
  });

  it('is case-insensitive', () => {
    expect(getErrorNameFromSelector('0x5A0E33B5')).toBe('CertificateAlreadyExists');
  });
});

describe('ERROR_SELECTORS', () => {
  it('contains known selectors', () => {
    expect(ERROR_SELECTORS['0x5a0e33b5']).toBe('CertificateAlreadyExists');
    expect(ERROR_SELECTORS['0xb41ba2d6']).toBe('UnauthorizedIssuer');
    expect(ERROR_SELECTORS['0x8301cc4d']).toBe('InstitutionNotVerified');
    expect(ERROR_SELECTORS['0xca2f217a']).toBe('AdminCannotRegisterAsInstitution');
  });

  it('is a non-empty record', () => {
    expect(Object.keys(ERROR_SELECTORS).length).toBeGreaterThan(0);
  });
});
