// src/hooks/__tests__/useInstitutionStatus.test.ts
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import {
  useCanIssueCertificates,
  useInstitutionStatus,
} from '@/hooks/useInstitutionStatus';

// ─── Mocks ────────────────────────────────────────────────────────────────────

const mockUseReadContract = vi.fn();
const mockUseAccount = vi.fn();

vi.mock('wagmi', () => ({
  useReadContract: (...args: unknown[]) => mockUseReadContract(...args),
  useAccount: () => mockUseAccount(),
}));

vi.mock('@/lib/wagmi', () => ({
  INSTITUTION_REGISTRY_ADDRESS: '0x1234567890123456789012345678901234567890',
}));

vi.mock('@/contracts/abis/InstitutionRegistry.json', () => ({
  default: { abi: [] },
  abi: [],
}));

vi.mock('@/lib/adminContact', () => ({
  withAdminContact: (msg: string) => `${msg} Contact admin.`,
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const CONNECTED_WALLET = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const mockRefetch = vi.fn();

function makeInstitution(overrides: Partial<{
  name: string;
  walletAddress: string;
  isVerified: boolean;
  isActive: boolean;
}> = {}) {
  return {
    name: overrides.name ?? 'Test University',
    walletAddress: overrides.walletAddress ?? CONNECTED_WALLET,
    emailDomain: 'test.edu',
    isVerified: overrides.isVerified ?? true,
    isActive: overrides.isActive ?? true,
    verificationDate: 1000n,
    totalCertificatesIssued: 5n,
  };
}

function setReadContract(data: unknown, isLoading = false, error: Error | null = null) {
  mockUseReadContract.mockReturnValue({ data, isLoading, error, refetch: mockRefetch });
}

describe('useInstitutionStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccount.mockReturnValue({ address: CONNECTED_WALLET });
    setReadContract(undefined); // default: no data
  });

  // ─── Loading ─────────────────────────────────────────────────────────────

  it('returns isLoading=true while the contract call is pending', () => {
    setReadContract(undefined, true);
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.isLoading).toBe(true);
  });

  // ─── Unregistered (zero struct) ───────────────────────────────────────────

  it('treats a zero-address struct as unregistered', () => {
    setReadContract(makeInstitution({ walletAddress: ZERO_ADDRESS, name: '' }));
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.isRegistered).toBe(false);
    expect(result.current.canIssue).toBe(false);
  });

  it('treats a struct with an empty name as unregistered', () => {
    setReadContract(makeInstitution({ name: '' }));
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.isRegistered).toBe(false);
  });

  it('returns isRegistered=false and all false flags when data is undefined', () => {
    setReadContract(undefined);
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.isRegistered).toBe(false);
    expect(result.current.isVerified).toBe(false);
    expect(result.current.isActive).toBe(false);
    expect(result.current.canIssue).toBe(false);
  });

  // ─── Registered but pending verification ─────────────────────────────────

  it('returns isRegistered=true but isVerified=false when not yet verified', () => {
    setReadContract(makeInstitution({ isVerified: false, isActive: false }));
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.isRegistered).toBe(true);
    expect(result.current.isVerified).toBe(false);
    expect(result.current.canIssue).toBe(false);
  });

  // ─── Verified but suspended ───────────────────────────────────────────────

  it('returns isVerified=true but isActive=false when suspended', () => {
    setReadContract(makeInstitution({ isVerified: true, isActive: false }));
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.isVerified).toBe(true);
    expect(result.current.isActive).toBe(false);
    expect(result.current.canIssue).toBe(false);
  });

  // ─── Fully active ─────────────────────────────────────────────────────────

  it('returns canIssue=true when verified AND active', () => {
    setReadContract(makeInstitution({ isVerified: true, isActive: true }));
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.isRegistered).toBe(true);
    expect(result.current.isVerified).toBe(true);
    expect(result.current.isActive).toBe(true);
    expect(result.current.canIssue).toBe(true);
  });

  it('exposes the full institution data object', () => {
    const inst = makeInstitution();
    setReadContract(inst);
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.institutionData?.name).toBe('Test University');
  });

  // ─── Address override ─────────────────────────────────────────────────────

  it('passes the provided address to useReadContract instead of the connected wallet', () => {
    const customAddress = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';
    setReadContract(makeInstitution());
    renderHook(() => useInstitutionStatus(customAddress as `0x${string}`));
    const callArgs = mockUseReadContract.mock.calls[0][0];
    expect(callArgs.args).toEqual([customAddress]);
  });

  it('falls back to the connected wallet when no address is provided', () => {
    setReadContract(makeInstitution());
    renderHook(() => useInstitutionStatus());
    const callArgs = mockUseReadContract.mock.calls[0][0];
    expect(callArgs.args).toEqual([CONNECTED_WALLET]);
  });

  // ─── Disabled query ───────────────────────────────────────────────────────

  it('disables the query when enabled=false', () => {
    setReadContract(makeInstitution());
    renderHook(() => useInstitutionStatus(undefined, false));
    const callArgs = mockUseReadContract.mock.calls[0][0];
    expect(callArgs.query.enabled).toBe(false);
  });

  // ─── Error passthrough ────────────────────────────────────────────────────

  it('passes through the contract error', () => {
    const err = new Error('Contract call failed');
    setReadContract(undefined, false, err);
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.error).toBe(err);
  });

  // ─── refetch passthrough ──────────────────────────────────────────────────

  it('exposes the refetch function from useReadContract', () => {
    setReadContract(makeInstitution());
    const { result } = renderHook(() => useInstitutionStatus());
    expect(result.current.refetch).toBe(mockRefetch);
  });
});

// ─── useCanIssueCertificates ─────────────────────────────────────────────────

describe('useCanIssueCertificates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAccount.mockReturnValue({ address: CONNECTED_WALLET });
    setReadContract(undefined);
  });

  it('returns canIssue=true and empty reason for a fully active institution', () => {
    setReadContract(makeInstitution({ isVerified: true, isActive: true }));
    const { result } = renderHook(() => useCanIssueCertificates());
    expect(result.current.canIssue).toBe(true);
    expect(result.current.reason).toBe('');
  });

  it('returns reason about registration when not registered', () => {
    setReadContract(makeInstitution({ walletAddress: ZERO_ADDRESS, name: '' }));
    const { result } = renderHook(() => useCanIssueCertificates());
    expect(result.current.canIssue).toBe(false);
    expect(result.current.reason).toMatch(/not registered/i);
  });

  it('returns reason about pending verification when registered but not verified', () => {
    setReadContract(makeInstitution({ isVerified: false, isActive: false }));
    const { result } = renderHook(() => useCanIssueCertificates());
    expect(result.current.reason).toMatch(/pending verification/i);
  });

  it('returns a suspended reason (with admin contact) when verified but inactive', () => {
    setReadContract(makeInstitution({ isVerified: true, isActive: false }));
    const { result } = renderHook(() => useCanIssueCertificates());
    expect(result.current.reason).toContain('suspended');
    expect(result.current.reason).toContain('Contact admin');
  });

  it('exposes isLoading, isVerified, isActive, and refetch', () => {
    setReadContract(makeInstitution(), true);
    const { result } = renderHook(() => useCanIssueCertificates());
    expect(result.current.isLoading).toBe(true);
    expect(typeof result.current.refetch).toBe('function');
  });
});
