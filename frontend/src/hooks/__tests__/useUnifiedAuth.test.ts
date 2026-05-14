// frontend/src/hooks/__tests__/useUnifiedAuth.test.ts
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useUnifiedAuth } from '../useUnifiedAuth';
import { useAccount, useDisconnect } from 'wagmi';
import { useAuthStore } from '@/store/authStore';
import { useZKAuth } from '../useZKAuth';
import { useUserRoles } from '../useUserRoles';
import { useInstitutionStatus } from '../useInstitutionStatus';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

// Mock all dependencies
vi.mock('wagmi', () => ({
  useAccount: vi.fn(),
  useDisconnect: vi.fn(),
}));

vi.mock('@/store/authStore', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('../useZKAuth', () => ({
  useZKAuth: vi.fn(),
}));

vi.mock('../useUserRoles', () => ({
  useUserRoles: vi.fn(),
}));

vi.mock('../useInstitutionStatus', () => ({
  useInstitutionStatus: vi.fn(),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: vi.fn(),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockUseAccount = useAccount as ReturnType<typeof vi.fn>;
const mockUseDisconnect = useDisconnect as ReturnType<typeof vi.fn>;
const mockUseAuthStore = useAuthStore as ReturnType<typeof vi.fn>;
const mockUseZKAuth = useZKAuth as ReturnType<typeof vi.fn>;
const mockUseUserRoles = useUserRoles as ReturnType<typeof vi.fn>;
const mockUseInstitutionStatus = useInstitutionStatus as ReturnType<typeof vi.fn>;
const mockUseQueryClient = useQueryClient as ReturnType<typeof vi.fn>;
const mockUseNavigate = useNavigate as ReturnType<typeof vi.fn>;

describe('useUnifiedAuth', () => {
  let mockAuthStore: any;
  let mockZKAuth: any;
  let mockUserRoles: any;
  let mockInstitutionStatus: any;
  let mockQueryClient: any;
  let mockNavigate: ReturnType<typeof vi.fn>;
  let mockDisconnect: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});

    // Default mock implementations
    mockAuthStore = {
      role: null,
      preSelectedRole: null,
      authMethod: null,
      showAuthMethodSelector: false,
      preferredAuthMethod: null,
      isLogoutCooldown: false,
      requiresManualAuthSelection: false,
      setAuthMethod: vi.fn(),
      setShowAuthMethodSelector: vi.fn(),
      setPreferredAuthMethod: vi.fn(),
      setRole: vi.fn(),
      setPreSelectedRole: vi.fn(),
      setIsLogoutCooldown: vi.fn(),
      setRequiresManualAuthSelection: vi.fn(),
      bumpAuthEpoch: vi.fn(),
      zkAuth: {
        isZKAuthenticated: false,
        zkRole: null,
      },
      setZKAuthEnabled: vi.fn(),
      setZKAuthenticated: vi.fn(),
      setZKCommitment: vi.fn(),
      setZKSessionId: vi.fn(),
      setZKRole: vi.fn(),
    };

    mockZKAuth = {
      hasCredentials: false,
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      clearCredentials: vi.fn(),
      isLoading: false,
      error: null,
    };

    mockUserRoles = {
      primaryRole: null,
      availableRoles: [],
      canRegisterAsEmployer: false,
      isAdmin: false,
      isUniversity: false,
      isStudent: false,
      isEmployer: false,
      universityData: null,
      isLoading: false,
      error: null,
    };

    mockInstitutionStatus = {
      isRegistered: false,
      isVerified: false,
      isActive: true,
    };

    mockQueryClient = {
      cancelQueries: vi.fn().mockResolvedValue(undefined),
      removeQueries: vi.fn(),
    };
    mockNavigate = vi.fn();
    mockDisconnect = vi.fn();

    mockUseAuthStore.mockReturnValue(mockAuthStore);
    mockUseZKAuth.mockReturnValue(mockZKAuth);
    mockUseUserRoles.mockReturnValue(mockUserRoles);
    mockUseInstitutionStatus.mockReturnValue(mockInstitutionStatus);
    mockUseQueryClient.mockReturnValue(mockQueryClient);
    mockUseNavigate.mockReturnValue(mockNavigate);
    mockUseDisconnect.mockReturnValue({ disconnect: mockDisconnect });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Initialization and Basic State', () => {
    it('should return unauthenticated state when wallet not connected', () => {
      mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.role).toBeNull();
      expect(result.current.authMethod).toBeNull();
      expect(result.current.authContextResolving).toBe(false);
    });

    it('should return correct loading state', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockZKAuth.isLoading = true;
      mockUseZKAuth.mockReturnValue(mockZKAuth);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.isLoading).toBe(true);
    });

    it('should return error from ZK auth', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      const mockError = new Error('ZK Auth failed');
      mockZKAuth.error = mockError;
      mockUseZKAuth.mockReturnValue(mockZKAuth);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.error).toBe(mockError);
    });

    it('should return error from user roles', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      const mockError = new Error('Role detection failed');
      mockUserRoles.error = mockError;
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.error).toBe(mockError);
    });
  });

  describe('Role-Based Authentication Restrictions', () => {
    it('should allow only Web3 auth for admin', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'admin';
      mockUserRoles.isAdmin = true;
      mockUserRoles.availableRoles = ['admin'];
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.allowedAuthMethods).toEqual(['web3']);
      expect(result.current.defaultAuthMethod).toBe('web3');
      expect(result.current.canUseZKAuth).toBe(false);
      expect(result.current.canUseWeb3Auth).toBe(true);
    });

    it('should allow only Web3 auth for university', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'university';
      mockUserRoles.isUniversity = true;
      mockUserRoles.availableRoles = ['university'];
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.allowedAuthMethods).toEqual(['web3']);
      expect(result.current.defaultAuthMethod).toBe('web3');
      expect(result.current.canUseZKAuth).toBe(false);
      expect(result.current.canUseWeb3Auth).toBe(true);
    });

    it('should allow both auth methods for student with ZK recommended', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'student';
      mockUserRoles.isStudent = true;
      mockUserRoles.availableRoles = ['student'];
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.allowedAuthMethods).toContain('zk');
      expect(result.current.allowedAuthMethods).toContain('web3');
      expect(result.current.defaultAuthMethod).toBe('zk');
      expect(result.current.canUseZKAuth).toBe(true);
      expect(result.current.canUseWeb3Auth).toBe(true);
    });

    it('should allow both auth methods for employer with Web3 default', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'employer';
      mockUserRoles.isEmployer = true;
      mockUserRoles.availableRoles = ['employer'];
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.allowedAuthMethods).toContain('web3');
      expect(result.current.allowedAuthMethods).toContain('zk');
      expect(result.current.defaultAuthMethod).toBe('web3');
      expect(result.current.canUseZKAuth).toBe(true);
      expect(result.current.canUseWeb3Auth).toBe(true);
    });
  });

  describe('Web3 Authentication', () => {
    it('should authenticate with Web3 when role is set', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'web3';
      mockAuthStore.role = 'admin';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.role).toBe('admin');
      expect(result.current.authMethod).toBe('web3');
    });

    it('should provide Web3 auth specific data', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'university';
      mockUserRoles.isUniversity = true;
      mockUserRoles.universityData = {
        name: 'Test University',
        emailDomain: 'test.edu',
        isVerified: true,
        isActive: true,
        verificationDate: BigInt(123456),
        totalCertificatesIssued: BigInt(10),
      };
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.web3Auth.isUniversity).toBe(true);
      expect(result.current.web3Auth.universityData?.name).toBe('Test University');
      expect(result.current.web3Auth.primaryRole).toBe('university');
    });
  });

  describe('ZK Authentication', () => {
    it('should authenticate with ZK when ZK credentials are valid', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'zk';
      mockAuthStore.zkAuth.isZKAuthenticated = true;
      mockAuthStore.zkAuth.zkRole = 'student';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.role).toBe('student');
      expect(result.current.authMethod).toBe('zk');
    });

    it('should provide ZK auth specific methods', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockZKAuth.hasCredentials = true;
      mockUseZKAuth.mockReturnValue(mockZKAuth);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(result.current.zkAuth.hasCredentials).toBe(true);
      expect(typeof result.current.zkAuth.register).toBe('function');
      expect(typeof result.current.zkAuth.login).toBe('function');
      expect(typeof result.current.zkAuth.clearCredentials).toBe('function');
    });
  });

  describe('Authentication Method Selection', () => {
    it('should allow selecting Web3 auth method', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      result.current.selectAuthMethod('web3', false);

      expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith('web3');
      expect(mockAuthStore.setShowAuthMethodSelector).toHaveBeenCalledWith(false);
    });

    it('should allow selecting ZK auth method with preference', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      result.current.selectAuthMethod('zk', true);

      expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith('zk');
      expect(mockAuthStore.setPreferredAuthMethod).toHaveBeenCalledWith('zk');
      expect(mockAuthStore.setShowAuthMethodSelector).toHaveBeenCalledWith(false);
    });

    it('should reject selecting disallowed auth method', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'admin';
      mockUserRoles.isAdmin = true;
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      expect(() => {
        result.current.selectAuthMethod('zk', false);
      }).toThrow();
    });
  });

  describe('Switching Authentication Methods', () => {
    it('should switch from Web3 to ZK auth', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'web3';
      mockAuthStore.role = 'student';
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      await result.current.switchAuthMethod('zk');

      expect(mockAuthStore.setRole).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith('zk');
    });

    it('should switch from ZK to Web3 auth', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'zk';
      mockAuthStore.zkAuth.isZKAuthenticated = true;
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      await result.current.switchAuthMethod('web3');

      expect(mockZKAuth.logout).toHaveBeenCalled();
      expect(mockZKAuth.clearCredentials).not.toHaveBeenCalled();
      expect(mockAuthStore.setRole).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith('web3');
    });

    it('should reject switching to disallowed auth method', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'web3';
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'admin';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      await expect(result.current.switchAuthMethod('zk')).rejects.toThrow();
    });
  });

  describe('Logout Functionality', () => {
    it('should logout from Web3 auth', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'web3';
      mockAuthStore.role = 'admin';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      await result.current.logout();

      expect(mockAuthStore.setZKAuthEnabled).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setZKRole).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setRole).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setPreSelectedRole).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setRequiresManualAuthSelection).toHaveBeenCalledWith(true);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('should logout from ZK auth', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'zk';
      mockAuthStore.zkAuth.isZKAuthenticated = true;
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      await result.current.logout();

      expect(mockZKAuth.logout).toHaveBeenCalled();
      expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setRole).toHaveBeenCalledWith(null);
      expect(mockDisconnect).toHaveBeenCalledTimes(1);
    });

    it('should preserve preferred auth method after logout', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'web3';
      mockAuthStore.preferredAuthMethod = 'web3';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      await result.current.logout();

      // Verify preferredAuthMethod was NOT cleared
      expect(mockAuthStore.setPreferredAuthMethod).not.toHaveBeenCalled();
    });
  });

  describe('Suspended University Handling', () => {
    it('should block authentication for suspended university', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'university';
      mockUserRoles.isUniversity = true;
      mockUseUserRoles.mockReturnValue(mockUserRoles);
      mockInstitutionStatus.isRegistered = true;
      mockInstitutionStatus.isActive = false; // Suspended
      mockUseInstitutionStatus.mockReturnValue(mockInstitutionStatus);

      const { result } = renderHook(() => useUnifiedAuth());

      await waitFor(() => {
        expect(result.current.allowedAuthMethods).toEqual(['web3']);
        expect(mockAuthStore.setAuthMethod).not.toHaveBeenCalledWith('web3');
      });
    });

    it('should clear active auth state for suspended university', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'web3';
      mockAuthStore.role = 'university';
      mockAuthStore.showAuthMethodSelector = true;
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'university';
      mockUserRoles.isUniversity = true;
      mockUseUserRoles.mockReturnValue(mockUserRoles);
      mockInstitutionStatus.isRegistered = true;
      mockInstitutionStatus.isActive = false;
      mockUseInstitutionStatus.mockReturnValue(mockInstitutionStatus);

      renderHook(() => useUnifiedAuth());

      await waitFor(() => {
        expect(mockAuthStore.setShowAuthMethodSelector).toHaveBeenCalledWith(false);
        expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith(null);
        expect(mockAuthStore.setRole).toHaveBeenCalledWith(null);
      });
    });

    it('should allow authentication for active university', () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'university';
      mockUserRoles.isUniversity = true;
      mockUseUserRoles.mockReturnValue(mockUserRoles);
      mockInstitutionStatus.isRegistered = true;
      mockInstitutionStatus.isActive = true; // Active
      mockUseInstitutionStatus.mockReturnValue(mockInstitutionStatus);

      const { result } = renderHook(() => useUnifiedAuth());

      // Should allow normal auth flow
      expect(result.current.allowedAuthMethods).toEqual(['web3']);
    });
  });

  describe('Role Conflict Handling', () => {
    it('should detect pre-selected role conflict', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.preSelectedRole = 'employer';
      mockAuthStore.role = null;
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'student';
      mockUserRoles.availableRoles = ['student'];
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      renderHook(() => useUnifiedAuth());

      // Should clear auth method when conflict detected
      await waitFor(() => {
        expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith(null);
      });
    });
  });

  describe('Wallet Scoped State Reset', () => {
    it('clears wallet-scoped auth state and redirects on disconnect', async () => {
      mockUseAccount
        .mockReturnValueOnce({ address: '0x123', isConnected: true })
        .mockReturnValueOnce({ address: undefined, isConnected: false });

      const { rerender } = renderHook(() => useUnifiedAuth());
      rerender();

      await waitFor(() => {
        expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({ queryKey: ['userRoles'] });
        expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({ queryKey: ['readContract'] });
        expect(mockQueryClient.removeQueries).toHaveBeenCalledWith({ queryKey: ['userRoles'] });
        expect(mockQueryClient.removeQueries).toHaveBeenCalledWith({ queryKey: ['readContract'] });
        expect(mockAuthStore.setZKAuthEnabled).toHaveBeenCalledWith(false);
        expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
        expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith(null);
        expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
        expect(mockAuthStore.setZKRole).toHaveBeenCalledWith(null);
        expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith(null);
        expect(mockAuthStore.setRole).toHaveBeenCalledWith(null);
        expect(mockAuthStore.setPreSelectedRole).toHaveBeenCalledWith(null);
        expect(mockAuthStore.setShowAuthMethodSelector).toHaveBeenCalledWith(false);
        expect(mockAuthStore.setRequiresManualAuthSelection).toHaveBeenCalledWith(false);
        expect(mockAuthStore.bumpAuthEpoch).toHaveBeenCalled();
        expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
      });
    });

    it('clears wallet-scoped auth state when connected address changes', async () => {
      mockUseAccount
        .mockReturnValueOnce({ address: '0x123', isConnected: true })
        .mockReturnValueOnce({ address: '0x456', isConnected: true });

      const { rerender } = renderHook(() => useUnifiedAuth());
      rerender();

      await waitFor(() => {
        expect(mockQueryClient.cancelQueries).toHaveBeenCalledWith({ queryKey: ['userRoles'] });
        expect(mockQueryClient.removeQueries).toHaveBeenCalledWith({ queryKey: ['readContract'] });
        expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith(null);
        expect(mockAuthStore.setRole).toHaveBeenCalledWith(null);
        expect(mockAuthStore.bumpAuthEpoch).toHaveBeenCalled();
      });
    });
  });

  describe('Auto-Selection Logic', () => {
    it('should not auto-select auth method when manual selection is required', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.requiresManualAuthSelection = true;
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'employer';
      mockUserRoles.isEmployer = true;
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      renderHook(() => useUnifiedAuth());

      await waitFor(() => {
        expect(mockAuthStore.setAuthMethod).not.toHaveBeenCalledWith('web3');
        expect(mockAuthStore.setRole).not.toHaveBeenCalledWith('employer');
      });
    });

    it('should not auto-select auth method during logout cooldown', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.isLogoutCooldown = true;
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'employer';
      mockUserRoles.isEmployer = true;
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      renderHook(() => useUnifiedAuth());

      await waitFor(() => {
        expect(mockAuthStore.setAuthMethod).not.toHaveBeenCalledWith('web3');
        expect(mockAuthStore.setRole).not.toHaveBeenCalledWith('employer');
      });
    });

    it('should auto-select Web3 for admin on connection', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'admin';
      mockUserRoles.isAdmin = true;
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      renderHook(() => useUnifiedAuth());

      await waitFor(() => {
        expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith('web3');
        expect(mockAuthStore.setRole).toHaveBeenCalledWith('admin');
      });
    });

    it('should auto-select ZK when credentials exist for student', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);
      mockZKAuth.hasCredentials = true;
      mockUseZKAuth.mockReturnValue(mockZKAuth);

      renderHook(() => useUnifiedAuth());

      await waitFor(() => {
        expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith('zk');
      });
    });

    it('should show auth method selector when user has choice', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      renderHook(() => useUnifiedAuth());

      await waitFor(() => {
        expect(mockAuthStore.setShowAuthMethodSelector).toHaveBeenCalledWith(true);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // logout() — complete behaviour (navigate, cooldown, flags)
  // ─────────────────────────────────────────────────────────────

  describe('logout() — complete behaviour', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('navigates to home page after logout', async () => {
      mockAuthStore.authMethod = 'web3';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });

    it('sets requiresManualAuthSelection=true after logout', async () => {
      mockAuthStore.authMethod = 'web3';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthStore.setRequiresManualAuthSelection).toHaveBeenCalledWith(true);
    });

    it('sets isLogoutCooldown=true immediately and false after 3 seconds', async () => {
      mockAuthStore.authMethod = 'web3';
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockAuthStore.setIsLogoutCooldown).toHaveBeenCalledWith(true);

      // Cooldown has not ended yet
      expect(mockAuthStore.setIsLogoutCooldown).not.toHaveBeenCalledWith(false);

      act(() => { vi.advanceTimersByTime(3000); });

      expect(mockAuthStore.setIsLogoutCooldown).toHaveBeenCalledWith(false);
    });

    it('calls zkAuth.logout before clearing state when method is zk', async () => {
      mockAuthStore.authMethod = 'zk';
      mockAuthStore.zkAuth.isZKAuthenticated = true;
      mockUseAuthStore.mockReturnValue(mockAuthStore);

      const { result } = renderHook(() => useUnifiedAuth());

      await act(async () => {
        await result.current.logout();
      });

      expect(mockZKAuth.logout).toHaveBeenCalled();
      expect(mockAuthStore.setAuthMethod).toHaveBeenCalledWith(null);
      expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
    });
  });

  // ─────────────────────────────────────────────────────────────
  // switchAuthMethod() — store-state clearing and edge cases
  // ─────────────────────────────────────────────────────────────

  describe('switchAuthMethod() — store-state clearing and edge cases', () => {
    it('clears all ZK store state when switching from authenticated ZK to web3', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'zk';
      mockAuthStore.zkAuth.isZKAuthenticated = true;
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      await act(async () => {
        await result.current.switchAuthMethod('web3');
      });

      expect(mockAuthStore.setZKAuthEnabled).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKAuthenticated).toHaveBeenCalledWith(false);
      expect(mockAuthStore.setZKCommitment).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setZKSessionId).toHaveBeenCalledWith(null);
      expect(mockAuthStore.setZKRole).toHaveBeenCalledWith(null);
    });

    it('does NOT call zkAuth.logout when switching from web3 (not ZK-authenticated)', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'web3';
      mockAuthStore.zkAuth.isZKAuthenticated = false;
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      await act(async () => {
        await result.current.switchAuthMethod('zk');
      });

      expect(mockZKAuth.logout).not.toHaveBeenCalled();
    });

    it('sets requiresManualAuthSelection=false after switching', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'web3';
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      await act(async () => {
        await result.current.switchAuthMethod('zk');
      });

      expect(mockAuthStore.setRequiresManualAuthSelection).toHaveBeenCalledWith(false);
    });

    it('auto-sets role when switching to web3 and a primary role is detected', async () => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockAuthStore.authMethod = 'zk';
      mockAuthStore.zkAuth.isZKAuthenticated = true;
      mockUseAuthStore.mockReturnValue(mockAuthStore);
      mockUserRoles.primaryRole = 'student';
      mockUseUserRoles.mockReturnValue(mockUserRoles);

      const { result } = renderHook(() => useUnifiedAuth());

      await act(async () => {
        await result.current.switchAuthMethod('web3');
      });

      // setRole(null) clears current, then setRole('student') sets the new role
      const setRoleCalls = mockAuthStore.setRole.mock.calls.map((c: any[]) => c[0]);
      expect(setRoleCalls).toContain(null);
      expect(setRoleCalls).toContain('student');
    });
  });

  // ─────────────────────────────────────────────────────────────
  // selectAuthMethod() — complete behaviour
  // ─────────────────────────────────────────────────────────────

  describe('selectAuthMethod() — complete behaviour', () => {
    beforeEach(() => {
      mockUseAccount.mockReturnValue({ address: '0x123', isConnected: true });
      mockUserRoles.primaryRole = 'student';
      mockUserRoles.availableRoles = ['student'];
      mockUseUserRoles.mockReturnValue(mockUserRoles);
    });

    it('auto-sets role when selecting web3 and primaryRole is detected', () => {
      const { result } = renderHook(() => useUnifiedAuth());

      result.current.selectAuthMethod('web3', false);

      expect(mockAuthStore.setRole).toHaveBeenCalledWith('student');
    });

    it('sets requiresManualAuthSelection=false on selection', () => {
      const { result } = renderHook(() => useUnifiedAuth());

      result.current.selectAuthMethod('web3', false);

      expect(mockAuthStore.setRequiresManualAuthSelection).toHaveBeenCalledWith(false);
    });

    it('does NOT call setPreferredAuthMethod when remember=false', () => {
      const { result } = renderHook(() => useUnifiedAuth());

      result.current.selectAuthMethod('zk', false);

      expect(mockAuthStore.setPreferredAuthMethod).not.toHaveBeenCalled();
    });

    it('calls setPreferredAuthMethod when remember=true', () => {
      const { result } = renderHook(() => useUnifiedAuth());

      result.current.selectAuthMethod('zk', true);

      expect(mockAuthStore.setPreferredAuthMethod).toHaveBeenCalledWith('zk');
    });

    it('hides the auth method selector after selection', () => {
      const { result } = renderHook(() => useUnifiedAuth());

      result.current.selectAuthMethod('web3', false);

      expect(mockAuthStore.setShowAuthMethodSelector).toHaveBeenCalledWith(false);
    });
  });
});
