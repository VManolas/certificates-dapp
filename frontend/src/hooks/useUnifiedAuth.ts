// frontend/src/hooks/useUnifiedAuth.ts
/**
 * Unified Authentication Hook
 * ===========================
 * 
 * Provides a single interface for both ZK Auth and Web3 Auth.
 * Automatically handles method selection and switching.
 * 
 * Features:
 * - Unified authentication state
 * - Seamless method switching
 * - Automatic role detection
 * - Single API for both methods
 * 
 * Usage:
 * ```tsx
 * const {
 *   isAuthenticated,
 *   role,
 *   authMethod,
 *   showAuthMethodSelector,
 *   selectAuthMethod,
 *   logout,
 * } = useUnifiedAuth();
 * ```
 */

import { useEffect, useCallback, useMemo } from 'react';
import { useAccount } from 'wagmi';
import { useAuthStore, type AuthMethod, type UserRole } from '@/store/authStore';
import { useZKAuth } from './useZKAuth';
import { useUserRoles } from './useUserRoles';
import { useInstitutionStatus } from './useInstitutionStatus';
import { logger } from '@/lib/logger';

export interface UnifiedAuthState {
  // Authentication status
  isAuthenticated: boolean;
  role: UserRole;
  authMethod: AuthMethod;
  
  // Method selector
  showAuthMethodSelector: boolean;
  preferredAuthMethod: AuthMethod;
  
  // Role-based auth restrictions
  allowedAuthMethods: AuthMethod[];
  defaultAuthMethod: AuthMethod | null;
  canUseZKAuth: boolean;
  canUseWeb3Auth: boolean;
  
  // Loading states
  isLoading: boolean;
  
  // Errors
  error: Error | null;
  
  // Actions
  selectAuthMethod: (method: AuthMethod, remember: boolean) => void;
  switchAuthMethod: (method: AuthMethod) => Promise<void>;
  logout: () => Promise<void>;
  
  // ZK Auth specific (when authMethod === 'zk')
  zkAuth: {
    hasCredentials: boolean;
    register: (role: 'student' | 'employer') => Promise<string>;
    login: () => Promise<void>;
    clearCredentials: () => void;
  };
  
  // Web3 Auth specific (when authMethod === 'web3')
  web3Auth: {
    primaryRole: UserRole;
    availableRoles: UserRole[];
    canRegisterAsEmployer: boolean;
    isAdmin: boolean;
    isUniversity: boolean;
    isStudent: boolean;
    isEmployer: boolean;
    universityData: {
      name: string;
      emailDomain: string;
      isVerified: boolean;
      isActive: boolean;
      verificationDate: bigint;
      totalCertificatesIssued: bigint;
    } | null;
  };
}

/**
 * Determine allowed authentication methods based on user role
 * 
 * Role-based restrictions:
 * - Admin: Web3 only (accountability required)
 * - University: Web3 only (public institution, high transaction volume)
 * - Student: ZKP recommended, Web3 as fallback (privacy protection)
 * - Employer: Web3 default, ZKP optional (business context-dependent)
 */
function getAllowedAuthMethods(role: UserRole | null): {
  allowed: AuthMethod[];
  default: AuthMethod | null;
} {
  switch (role) {
    case 'admin':
      // Admin must use Web3 only - public accountability
      return { allowed: ['web3'], default: 'web3' };
    
    case 'university':
      // University must use Web3 only - public institution + cost efficiency
      return { allowed: ['web3'], default: 'web3' };
    
    case 'student':
      // Student should use ZKP by default - privacy protection
      return { allowed: ['zk', 'web3'], default: 'zk' };
    
    case 'employer':
      // Employer defaults to Web3, ZKP optional - business flexibility
      return { allowed: ['web3', 'zk'], default: 'web3' };
    
    default:
      // Before role detection, allow both
      return { allowed: ['web3', 'zk'], default: null };
  }
}

export function useUnifiedAuth(): UnifiedAuthState {
  const { address, isConnected } = useAccount();
  
  // Auth store
  const {
    role,
    preSelectedRole,
    authMethod,
    showAuthMethodSelector,
    preferredAuthMethod,
    setAuthMethod,
    setShowAuthMethodSelector,
    setPreferredAuthMethod,
    setRole,
    zkAuth: zkAuthState,
  } = useAuthStore();
  
  // ZK Auth hook
  const zkAuth = useZKAuth();
  
  // Web3 role detection
  const userRoles = useUserRoles();
  
  // Check institution suspension status (only for universities)
  // IMPORTANT: Only enable this query AFTER we've detected the user is a university
  // to avoid unnecessary blockchain queries for students/employers/admins
  const institutionStatus = useInstitutionStatus(
    address,
    isConnected && userRoles.isUniversity, // Only query for universities
    60000 // Check every 60 seconds (reduced from 5s - suspension is rare)
  );
  
  // Determine authentication status
  const isAuthenticated = 
    (authMethod === 'zk' && zkAuthState.isZKAuthenticated) ||
    (authMethod === 'web3' && role !== null);
  
  // Get effective role
  const effectiveRole = authMethod === 'zk' ? zkAuthState.zkRole : role;
  
  // Determine allowed auth methods based on detected role
  const { allowed: allowedAuthMethods, default: defaultAuthMethod } = useMemo(() => {
    // Use pre-selected role first, then Web3 role, otherwise use current role
    const detectedRole = preSelectedRole || userRoles.primaryRole || effectiveRole;
    return getAllowedAuthMethods(detectedRole);
  }, [preSelectedRole, userRoles.primaryRole, effectiveRole]);
  
  // Check if specific auth methods are allowed
  const canUseZKAuth = allowedAuthMethods.includes('zk');
  const canUseWeb3Auth = allowedAuthMethods.includes('web3');
  
  // Auto-select auth method based on preference, role restrictions, and detection
  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }
    
    // CRITICAL: Block authentication for suspended universities
    // This prevents signature requests before SuspensionGuard disconnects the wallet
    if (userRoles.isUniversity && institutionStatus.isRegistered && !institutionStatus.isActive) {
      logger.warn('🚫 Suspended university detected - blocking authentication flow', {
        address,
        isRegistered: institutionStatus.isRegistered,
        isVerified: institutionStatus.isVerified,
        isActive: institutionStatus.isActive,
      });
      
      // Clear any auth state to prevent automatic auth attempts
      setAuthMethod(null);
      setRole(null);
      
      // Don't proceed with any authentication logic
      // SuspensionGuard will handle disconnection and show modal
      return;
    }
    
    // CONFLICT PREVENTION: If pre-selected role conflicts with detected role,
    // don't auto-select - let Layout.tsx handle conflict modal
    const hasPreSelection = preSelectedRole && !role;
    const preSelectionConflict = hasPreSelection && 
                                 userRoles.primaryRole && 
                                 preSelectedRole !== userRoles.primaryRole &&
                                 !userRoles.availableRoles.includes(preSelectedRole);
    
    if (preSelectionConflict) {
      logger.info('⚠️ Pre-selected role conflicts with detected role - waiting for user resolution', {
        preSelected: preSelectedRole,
        detected: userRoles.primaryRole,
        availableRoles: userRoles.availableRoles,
      });
      
      // Don't auto-select anything - Layout will show conflict modal
      // Clear any auth method to prevent confusion
      setAuthMethod(null);
      return;
    }
    
    // If already authenticated, don't change
    if (isAuthenticated) {
      return;
    }
    
    // If user has a preferred method AND it's allowed, use it
    if (preferredAuthMethod && !authMethod && allowedAuthMethods.includes(preferredAuthMethod)) {
      logger.info('Using preferred auth method', { method: preferredAuthMethod, allowed: allowedAuthMethods });
      setAuthMethod(preferredAuthMethod);
      
      // If preferred is Web3 and user has role, auto-authenticate
      if (preferredAuthMethod === 'web3' && userRoles.primaryRole) {
        setRole(userRoles.primaryRole);
      }
      
      return;
    }
    
    // Clear invalid preferred method if it's not in allowed methods
    if (preferredAuthMethod && !allowedAuthMethods.includes(preferredAuthMethod)) {
      logger.warn('Clearing invalid preferred auth method', { 
        preferredMethod: preferredAuthMethod, 
        allowed: allowedAuthMethods 
      });
      setPreferredAuthMethod(null);
      return;
    }
    
    // Check if user has ZK credentials stored (and ZK is allowed) - auto-login with ZK
    if (zkAuth.hasCredentials && !authMethod && canUseZKAuth) {
      logger.info('User has ZK credentials, suggesting ZK auth');
      setAuthMethod('zk');
      return;
    }
    
    // Auto-select if only one method is allowed (for admin/university)
    if (!authMethod && allowedAuthMethods.length === 1) {
      logger.info('Auto-selecting only available auth method', { 
        method: allowedAuthMethods[0],
        role: userRoles.primaryRole,
        allowed: allowedAuthMethods 
      });
      setAuthMethod(allowedAuthMethods[0]);
      
      // If auto-selected method is Web3 and user has role, auto-authenticate
      if (allowedAuthMethods[0] === 'web3' && userRoles.primaryRole) {
        logger.info('Auto-authenticating with Web3 role', { role: userRoles.primaryRole });
        setRole(userRoles.primaryRole);
      }
      
      return;
    }
    
    // Additional fallback: If auth method is set to Web3 but role is not set yet, 
    // and we have a detected role, set it now
    if (authMethod === 'web3' && !role && userRoles.primaryRole) {
      logger.info('Setting role for Web3 auth method', { role: userRoles.primaryRole });
      setRole(userRoles.primaryRole);
      return;
    }
    
    // ONLY show auth method selector when user has a CHOICE
    // 1. User connects wallet for the first time (no authMethod set)
    // 2. User has NOT saved a preference (preferredAuthMethod is null)
    // 3. User is not already in the selector flow
    // 4. User has MORE THAN ONE auth method available
    if (!authMethod && !showAuthMethodSelector && !preferredAuthMethod && allowedAuthMethods.length > 1) {
      logger.info('Showing auth method selector for connected wallet', { 
        role: userRoles.primaryRole,
        allowed: allowedAuthMethods 
      });
      setShowAuthMethodSelector(true);
      return;
    }
  }, [
    isConnected,
    address,
    isAuthenticated,
    preferredAuthMethod,
    authMethod,
    role,
    preSelectedRole,
    zkAuth.hasCredentials,
    userRoles.primaryRole,
    userRoles.isUniversity,
    userRoles.availableRoles,
    institutionStatus.isRegistered,
    institutionStatus.isActive,
    showAuthMethodSelector,
    allowedAuthMethods,
    defaultAuthMethod,
    canUseZKAuth,
    setAuthMethod,
    setShowAuthMethodSelector,
    setRole,
    setPreferredAuthMethod,
  ]);
  
  /**
   * Select authentication method (with role-based validation)
   */
  const selectAuthMethod = useCallback((method: AuthMethod, remember: boolean) => {
    // Validate that selected method is allowed for this role
    if (!allowedAuthMethods.includes(method)) {
      logger.warn('Attempted to select disallowed auth method', { 
        method, 
        role: userRoles.primaryRole,
        allowed: allowedAuthMethods 
      });
      throw new Error(`${method} authentication is not available for ${userRoles.primaryRole || 'this role'}`);
    }
    
    logger.info('Auth method selected', { method, remember, allowed: allowedAuthMethods });
    
    setAuthMethod(method);
    setShowAuthMethodSelector(false);
    
    if (remember) {
      setPreferredAuthMethod(method);
    }
    
    // If Web3 selected and user has role, auto-set it
    if (method === 'web3' && userRoles.primaryRole) {
      setRole(userRoles.primaryRole);
    }
  }, [setAuthMethod, setShowAuthMethodSelector, setPreferredAuthMethod, setRole, userRoles.primaryRole, allowedAuthMethods]);
  
  /**
   * Switch authentication method (with role-based validation)
   */
  const switchAuthMethod = useCallback(async (newMethod: AuthMethod) => {
    // Validate that new method is allowed for this role
    if (!allowedAuthMethods.includes(newMethod)) {
      logger.warn('Attempted to switch to disallowed auth method', { 
        newMethod, 
        role: userRoles.primaryRole,
        allowed: allowedAuthMethods 
      });
      throw new Error(`${newMethod} authentication is not available for ${userRoles.primaryRole || 'this role'}`);
    }
    
    logger.info('Switching auth method', { from: authMethod, to: newMethod, allowed: allowedAuthMethods });
    
    // Logout from current method
    if (authMethod === 'zk' && zkAuthState.isZKAuthenticated) {
      await zkAuth.logout();
    }
    
    // Clear current role
    setRole(null);
    
    // Set new method
    setAuthMethod(newMethod);
    
    // If switching to Web3 and user has role, auto-set it
    if (newMethod === 'web3' && userRoles.primaryRole) {
      setRole(userRoles.primaryRole);
    }
  }, [authMethod, zkAuthState.isZKAuthenticated, zkAuth, setRole, setAuthMethod, userRoles.primaryRole, allowedAuthMethods]);
  
  /**
   * Unified logout
   */
  const logout = useCallback(async () => {
    logger.info('Unified logout', { authMethod });
    
    if (authMethod === 'zk') {
      await zkAuth.logout();
    }
    
    // Clear auth state
    setAuthMethod(null);
    setRole(null);
    
    // Don't clear preferred method - user can reuse it
  }, [authMethod, zkAuth, setAuthMethod, setRole]);
  
  return {
    // Authentication status
    isAuthenticated,
    role: effectiveRole,
    authMethod,
    
    // Method selector
    showAuthMethodSelector,
    preferredAuthMethod,
    
    // Role-based auth restrictions
    allowedAuthMethods,
    defaultAuthMethod,
    canUseZKAuth,
    canUseWeb3Auth,
    
    // Loading states
    isLoading: zkAuth.isLoading || userRoles.isLoading,
    
    // Errors
    error: zkAuth.error || userRoles.error,
    
    // Actions
    selectAuthMethod,
    switchAuthMethod,
    logout,
    
    // ZK Auth specific
    zkAuth: {
      hasCredentials: zkAuth.hasCredentials,
      register: zkAuth.register,
      login: zkAuth.login,
      clearCredentials: zkAuth.clearCredentials,
    },
    
    // Web3 Auth specific
    web3Auth: {
      primaryRole: userRoles.primaryRole,
      availableRoles: userRoles.availableRoles,
      canRegisterAsEmployer: userRoles.canRegisterAsEmployer,
      isAdmin: userRoles.isAdmin,
      isUniversity: userRoles.isUniversity,
      isStudent: userRoles.isStudent,
      isEmployer: userRoles.isEmployer,
      universityData: userRoles.universityData,
    },
  };
}

