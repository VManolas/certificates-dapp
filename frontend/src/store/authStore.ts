// src/store/authStore.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * User roles in the zkCredentials system
 */
export type UserRole = 'university' | 'student' | 'employer' | 'admin' | null;

/**
 * Institution data for university users
 */
export interface InstitutionData {
  name: string;
  emailDomain: string;
  isVerified: boolean;
  isActive: boolean;
  verificationDate: number;
  totalCertificatesIssued: number;
}

/**
 * Auth state interface
 */
interface AuthState {
  /** Connected wallet address */
  address: string | null;
  /** User's selected role */
  role: UserRole;
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

  // Actions
  setAddress: (address: string | null) => void;
  setRole: (role: UserRole, isAspirational?: boolean) => void;
  setInstitutionData: (data: InstitutionData | null) => void;
  setHasSelectedRole: (selected: boolean) => void;
  setDetectedRoles: (roles: UserRole[]) => void;
  setIsRoleDetectionComplete: (complete: boolean) => void;
  setShowRoleSelector: (show: boolean) => void;
  setRefetchInstitution: (refetch: (() => void) | null) => void;
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
      isAspirationalRole: false,
      institutionData: null,
      hasSelectedRole: false,
      detectedRoles: [],
      isRoleDetectionComplete: false,
      showRoleSelector: false,
      refetchInstitution: null,

      setAddress: (address) =>
        set((state) => {
          // If address changes, reset role and institution data
          if (address !== state.address) {
            return {
              address,
              role: null,
              isAspirationalRole: false,
              institutionData: null,
              hasSelectedRole: false,
              detectedRoles: [],
              isRoleDetectionComplete: false,
              showRoleSelector: false,
              refetchInstitution: null,
            };
          }
          return { address };
        }),

      setRole: (role, isAspirational = false) => set({ role, isAspirationalRole: isAspirational, hasSelectedRole: true }),

      setInstitutionData: (institutionData) => set({ institutionData }),

      setHasSelectedRole: (hasSelectedRole) => set({ hasSelectedRole }),

      setDetectedRoles: (detectedRoles) => set({ detectedRoles }),

      setIsRoleDetectionComplete: (isRoleDetectionComplete) => 
        set({ isRoleDetectionComplete }),

      setShowRoleSelector: (showRoleSelector) => set({ showRoleSelector }),

      setRefetchInstitution: (refetchInstitution) => set({ refetchInstitution }),

      reset: () =>
        set({
          address: null,
          role: null,
          isAspirationalRole: false,
          institutionData: null,
          hasSelectedRole: false,
          detectedRoles: [],
          isRoleDetectionComplete: false,
          showRoleSelector: false,
          refetchInstitution: null,
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

