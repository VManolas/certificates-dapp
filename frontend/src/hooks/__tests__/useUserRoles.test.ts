// frontend/src/hooks/__tests__/useUserRoles.test.ts
import { renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUserRoles } from '../useUserRoles';
import { useAccount, useReadContracts } from 'wagmi';

// Mock wagmi hooks
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useReadContracts: vi.fn(),
}));

const mockUseAccount = useAccount as ReturnType<typeof vi.fn>;
const mockUseReadContracts = useReadContracts as ReturnType<typeof vi.fn>;

describe('useUserRoles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('when wallet is not connected', () => {
    it('should return empty roles', () => {
      mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
      mockUseReadContracts.mockReturnValue({ 
        data: undefined, 
        isLoading: false, 
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      expect(result.current.availableRoles).toEqual([]);
      expect(result.current.isAdmin).toBe(false);
      expect(result.current.isUniversity).toBe(false);
      expect(result.current.isStudent).toBe(false);
    });
  });

  describe('when wallet is connected', () => {
    const mockAddress = '0x1234567890abcdef1234567890abcdef12345678';

    beforeEach(() => {
      mockUseAccount.mockReturnValue({ address: mockAddress, isConnected: true });
    });

    it('should detect admin role correctly', async () => {
      mockUseReadContracts.mockReturnValue({
        data: [
          { result: true }, // hasRole in InstitutionRegistry
          { result: true }, // hasRole in CertificateRegistry
          { result: { walletAddress: '0x0000000000000000000000000000000000000000', name: '' } },
          { result: [] },
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.availableRoles).toContain('admin');
    });

    it('should detect university role correctly', async () => {
      mockUseReadContracts.mockReturnValue({
        data: [
          { result: false },
          { result: false },
          { result: { 
            walletAddress: mockAddress, 
            name: 'Test University',
            emailDomain: 'test.edu',
            isVerified: true,
            isActive: true,
            verificationDate: 1234567890n,
            totalCertificatesIssued: 5n,
          }},
          { result: [] },
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      expect(result.current.isUniversity).toBe(true);
      expect(result.current.isVerifiedUniversity).toBe(true);
      expect(result.current.universityData?.name).toBe('Test University');
      expect(result.current.availableRoles).toContain('university');
    });

    it('should detect student role correctly', async () => {
      mockUseReadContracts.mockReturnValue({
        data: [
          { result: false },
          { result: false },
          { result: { walletAddress: '0x0000000000000000000000000000000000000000', name: '' } },
          { result: [1n, 2n, 3n] }, // 3 certificate IDs
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      expect(result.current.isStudent).toBe(true);
      expect(result.current.studentCertificateCount).toBe(3);
      expect(result.current.availableRoles).toContain('student');
    });

    it('should detect multiple roles for multi-role users', async () => {
      mockUseReadContracts.mockReturnValue({
        data: [
          { result: true }, // isAdmin
          { result: true },
          { result: { 
            walletAddress: mockAddress, 
            name: 'Admin University',
            emailDomain: 'admin.edu',
            isVerified: true,
            isActive: true,
            verificationDate: 1234567890n,
            totalCertificatesIssued: 10n,
          }},
          { result: [] },
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      expect(result.current.isAdmin).toBe(true);
      expect(result.current.isUniversity).toBe(true);
      expect(result.current.availableRoles).toContain('admin');
      expect(result.current.availableRoles).toContain('university');
      expect(result.current.availableRoles).toContain('employer');
    });

    it('should always include employer in available roles', async () => {
      mockUseReadContracts.mockReturnValue({
        data: [
          { result: false },
          { result: false },
          { result: { walletAddress: '0x0000000000000000000000000000000000000000', name: '' } },
          { result: [] },
        ],
        isLoading: false,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      expect(result.current.availableRoles).toContain('employer');
      expect(result.current.availableRoles).toHaveLength(1);
    });

    it('should return loading state while fetching', () => {
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      expect(result.current.isLoading).toBe(true);
    });

    it('should return error state on contract read failure', () => {
      const mockError = new Error('RPC error');
      mockUseReadContracts.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: mockError,
        refetch: vi.fn(),
      });

      const { result } = renderHook(() => useUserRoles());

      expect(result.current.error).toBe(mockError);
    });
  });
});



