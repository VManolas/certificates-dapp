// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * User roles in the zkCredentials system
 */
export type UserRole = 'university' | 'student' | 'employer' | 'admin' | null;

/**
 * Authentication method
 */
export type AuthMethod = 'web3' | 'zk' | null;

/**
 * Institution data for university users
 */
export interface InstitutionData {
  name: string;
  emailDomain: string;
  isVerified: boolean;
  isActive: boolean;
  verificationDate: bigint;
  totalCertificatesIssued: bigint;
}

/**
 * ZK Authentication state
 */
export interface ZKAuthState {
  /** Whether user has enabled ZK authentication */
  isZKAuthEnabled: boolean;
  /** ZK authentication commitment (if registered) */
  zkCommitment: string | null;
  /** ZK session ID (if authenticated) */
  zkSessionId: string | null;
  /** Whether user is currently authenticated via ZK proof */
  isZKAuthenticated: boolean;
  /** ZK authentication role */
  zkRole: UserRole;
}

/**
 * Auth state interface
 */
interface AuthState {
  /** Connected wallet address */
  address: string | null;
  /** User's selected role */
  role: UserRole;
  /** Pre-selected role before wallet connection */
  preSelectedRole: UserRole | null;
  /** Whether the role is aspirational (not yet on-chain verified) */
  isAspirationalRole: boolean;
  /** Institution data if user is a university */
  institutionData: InstitutionData | null;
  /** Whether the user has completed role selection */
  hasSelectedRole: boolean;
  /** All roles detected for the current wallet */
  detectedRoles: UserRole[];
  /** Whether role detection is complete */
  isRoleDetectionComplete: boolean;
  /** Whether role selector modal should be shown */
  showRoleSelector: boolean;
  /** Optional refetch callback for institution data */
  refetchInstitution: (() => void) | null;
  /** ZK authentication state */
  zkAuth: ZKAuthState;
  /** Current authentication method (web3 or zk) */
  authMethod: AuthMethod;
  /** Whether authentication method selector should be shown */
  showAuthMethodSelector: boolean;
  /** User's preferred authentication method (saved preference) */
  preferredAuthMethod: AuthMethod;

  // Actions
  setAddress: (address: string | null) => void;
  setRole: (role: UserRole, isAspirational?: boolean) => void;
  setPreSelectedRole: (role: UserRole | null) => void;
  setInstitutionData: (data: InstitutionData | null) => void;
  setHasSelectedRole: (selected: boolean) => void;
  setDetectedRoles: (roles: UserRole[]) => void;
  setIsRoleDetectionComplete: (complete: boolean) => void;
  setShowRoleSelector: (show: boolean) => void;
  setRefetchInstitution: (refetch: (() => void) | null) => void;
  setZKAuthEnabled: (enabled: boolean) => void;
  setZKCommitment: (commitment: string | null) => void;
  setZKSessionId: (sessionId: string | null) => void;
  setZKAuthenticated: (authenticated: boolean) => void;
  setZKRole: (role: UserRole) => void;
  setAuthMethod: (method: AuthMethod) => void;
  setShowAuthMethodSelector: (show: boolean) => void;
  setPreferredAuthMethod: (method: AuthMethod) => void;
  reset: () => void;
}

/**
 * Zustand store for authentication state
 * 
 * Persists to localStorage to maintain session across page reloads.
 * Clears automatically when wallet is disconnected.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      address: null,
      role: null,
      preSelectedRole: null,
      isAspirationalRole: false,
      institutionData: null,
      hasSelectedRole: false,
      detectedRoles: [],
      isRoleDetectionComplete: false,
      showRoleSelector: false,
      refetchInstitution: null,
      zkAuth: {
        isZKAuthEnabled: false,
        zkCommitment: null,
        zkSessionId: null,
        isZKAuthenticated: false,
        zkRole: null,
      },
      authMethod: null,
      showAuthMethodSelector: false,
      preferredAuthMethod: null,

      setAddress: (address) =>
        set((state) => {
          // If address changes (including disconnect), reset ALL auth state
          if (address !== state.address) {
            console.log('🔄 Address changed in store, resetting auth state', {
              from: state.address,
              to: address,
              previousRole: state.role,
            });
            return {
              address,
              role: null,
              preSelectedRole: null, // Clear pre-selected role too
              isAspirationalRole: false,
              institutionData: null,
              hasSelectedRole: false, // Reset this to allow re-detection
              detectedRoles: [],
              isRoleDetectionComplete: false,
              showRoleSelector: false,
              refetchInstitution: null,
              zkAuth: {
                isZKAuthEnabled: false,
                zkCommitment: null,
                zkSessionId: null,
                isZKAuthenticated: false,
                zkRole: null,
              },
              authMethod: null,
              showAuthMethodSelector: false,
              // Keep preferredAuthMethod - user's saved preference
            };
          }
          return { address };
        }),

      setRole: (role, isAspirational = false) => set({ role, isAspirationalRole: isAspirational, hasSelectedRole: true }),

      setPreSelectedRole: (preSelectedRole) => set({ preSelectedRole }),

      setInstitutionData: (institutionData) => set({ institutionData }),

      setHasSelectedRole: (hasSelectedRole) => set({ hasSelectedRole }),

      setDetectedRoles: (detectedRoles) => set({ detectedRoles }),

      setIsRoleDetectionComplete: (isRoleDetectionComplete) => 
        set({ isRoleDetectionComplete }),

      setShowRoleSelector: (showRoleSelector) => set({ showRoleSelector }),

      setRefetchInstitution: (refetchInstitution) => set({ refetchInstitution }),

      setZKAuthEnabled: (isZKAuthEnabled) => 
        set((state) => ({ zkAuth: { ...state.zkAuth, isZKAuthEnabled } })),

      setZKCommitment: (zkCommitment) =>
        set((state) => ({ zkAuth: { ...state.zkAuth, zkCommitment } })),

      setZKSessionId: (zkSessionId) =>
        set((state) => ({ zkAuth: { ...state.zkAuth, zkSessionId } })),

      setZKAuthenticated: (isZKAuthenticated) =>
        set((state) => ({ zkAuth: { ...state.zkAuth, isZKAuthenticated } })),

      setZKRole: (zkRole) =>
        set((state) => ({ zkAuth: { ...state.zkAuth, zkRole } })),

      setAuthMethod: (authMethod) => set({ authMethod }),

      setShowAuthMethodSelector: (showAuthMethodSelector) => set({ showAuthMethodSelector }),

      setPreferredAuthMethod: (preferredAuthMethod) => set({ preferredAuthMethod }),

      reset: () =>
        set({
          address: null,
          role: null,
          preSelectedRole: null,
          isAspirationalRole: false,
          institutionData: null,
          hasSelectedRole: false,
          detectedRoles: [],
          isRoleDetectionComplete: false,
          showRoleSelector: false,
          refetchInstitution: null,
          zkAuth: {
            isZKAuthEnabled: false,
            zkCommitment: null,
            zkSessionId: null,
            isZKAuthenticated: false,
            zkRole: null,
          },
          authMethod: null,
          showAuthMethodSelector: false,
          // Keep preferredAuthMethod even on reset
        }),
    }),
    {
      name: 'zkcredentials-auth',
      partialize: (state) => ({
        address: state.address,
        role: state.role,
        isAspirationalRole: state.isAspirationalRole,
        hasSelectedRole: state.hasSelectedRole,
        detectedRoles: state.detectedRoles,
        zkAuth: state.zkAuth,
        authMethod: state.authMethod,
        preferredAuthMethod: state.preferredAuthMethod,
        // Don't persist modal state or detection state or institution data
      }),
    }
  )
);

/**
 * Hook to check if user is a verified university
 */
export function useIsVerifiedUniversity(): boolean {
  const { role, institutionData } = useAuthStore();
  return role === 'university' && institutionData?.isVerified === true && institutionData?.isActive === true;
}

/**
 * Hook to check if user is an admin
 */
export function useIsAdmin(): boolean {
  const { role } = useAuthStore();
  return role === 'admin';
}

/**
 * Hook to check if user has multiple roles
 */
export function useHasMultipleRoles(): boolean {
  const { detectedRoles } = useAuthStore();
  // Filter out null and employer (always available)
  const specialRoles = detectedRoles.filter(r => r && r !== 'employer');
  return specialRoles.length > 0;
}

/**
 * Hook to check if user is authenticated (via any method)
 */
export function useIsAuthenticated(): boolean {
  const { role, zkAuth, authMethod } = useAuthStore();
  
  // Check ZK authentication
  if (authMethod === 'zk' && zkAuth.isZKAuthenticated) {
    return true;
  }
  
  // Check Web3 authentication (has role from on-chain detection)
  if (authMethod === 'web3' && role !== null) {
    return true;
  }
  
  return false;
}

/**
 * Hook to get the effective role (from either auth method)
 */
export function useEffectiveRole(): UserRole {
  const { role, zkAuth, authMethod } = useAuthStore();
  
  // ZK auth takes precedence if active
  if (authMethod === 'zk' && zkAuth.isZKAuthenticated) {
    return zkAuth.zkRole;
  }
  
  // Otherwise use Web3 role
  return role;
}

