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

import { useEffect, useCallback } from 'react';
import { useAccount } from 'wagmi';
import { useAuthStore, type AuthMethod, type UserRole } from '@/store/authStore';
import { useZKAuth } from './useZKAuth';
import { useUserRoles } from './useUserRoles';
import { logger } from '@/lib/logger';

export interface UnifiedAuthState {
  // Authentication status
  isAuthenticated: boolean;
  role: UserRole;
  authMethod: AuthMethod;
  
  // Method selector
  showAuthMethodSelector: boolean;
  preferredAuthMethod: AuthMethod;
  
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
    register: (role: 'student' | 'university' | 'employer') => Promise<string>;
    login: () => Promise<void>;
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
  };
}

export function useUnifiedAuth(): UnifiedAuthState {
  const { address, isConnected } = useAccount();
  
  // Auth store
  const {
    role,
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
  
  // Determine authentication status
  const isAuthenticated = 
    (authMethod === 'zk' && zkAuthState.isZKAuthenticated) ||
    (authMethod === 'web3' && role !== null);
  
  // Get effective role
  const effectiveRole = authMethod === 'zk' ? zkAuthState.zkRole : role;
  
  // Auto-select auth method based on preference or detection
  useEffect(() => {
    if (!isConnected || !address) {
      return;
    }
    
    // If already authenticated, don't change
    if (isAuthenticated) {
      return;
    }
    
    // If user has a preferred method, use it
    if (preferredAuthMethod && !authMethod) {
      logger.info('Using preferred auth method', { method: preferredAuthMethod });
      setAuthMethod(preferredAuthMethod);
      
      // If preferred is Web3 and user has role, auto-authenticate
      if (preferredAuthMethod === 'web3' && userRoles.primaryRole) {
        setRole(userRoles.primaryRole);
      }
      
      return;
    }
    
    // Check if user has ZK credentials stored
    if (zkAuth.hasCredentials && !authMethod) {
      logger.info('User has ZK credentials, suggesting ZK auth');
      setAuthMethod('zk');
      return;
    }
    
    // Check if user has Web3 roles detected
    if (userRoles.primaryRole && !authMethod) {
      logger.info('User has Web3 role, suggesting Web3 auth', { role: userRoles.primaryRole });
      // Show selector instead of auto-selecting
      setShowAuthMethodSelector(true);
      return;
    }
    
    // New user - show method selector
    if (!authMethod && !showAuthMethodSelector) {
      logger.info('New user, showing auth method selector');
      setShowAuthMethodSelector(true);
    }
  }, [
    isConnected,
    address,
    isAuthenticated,
    preferredAuthMethod,
    authMethod,
    zkAuth.hasCredentials,
    userRoles.primaryRole,
    showAuthMethodSelector,
    setAuthMethod,
    setShowAuthMethodSelector,
    setRole,
  ]);
  
  /**
   * Select authentication method
   */
  const selectAuthMethod = useCallback((method: AuthMethod, remember: boolean) => {
    logger.info('Auth method selected', { method, remember });
    
    setAuthMethod(method);
    setShowAuthMethodSelector(false);
    
    if (remember) {
      setPreferredAuthMethod(method);
    }
    
    // If Web3 selected and user has role, auto-set it
    if (method === 'web3' && userRoles.primaryRole) {
      setRole(userRoles.primaryRole);
    }
  }, [setAuthMethod, setShowAuthMethodSelector, setPreferredAuthMethod, setRole, userRoles.primaryRole]);
  
  /**
   * Switch authentication method
   */
  const switchAuthMethod = useCallback(async (newMethod: AuthMethod) => {
    logger.info('Switching auth method', { from: authMethod, to: newMethod });
    
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
  }, [authMethod, zkAuthState.isZKAuthenticated, zkAuth, setRole, setAuthMethod, userRoles.primaryRole]);
  
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
    },
  };
}

